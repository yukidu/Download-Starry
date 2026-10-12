"""Resolve public WeChat Channels shares using the owner's Yuanbao session."""
import json
import os
import re
from pathlib import Path
from urllib.parse import parse_qs, urlparse, urlunparse
from urllib.request import Request, urlopen


class WeChatError(Exception):
    pass


_WECHAT_ENCRYPTED_PREFIX_BYTES = 128 * 1024
_U64 = (1 << 64) - 1


def share_id(url):
    try:
        p = urlparse(url.strip())
        if p.scheme != 'https' or p.hostname != 'weixin.qq.com' or p.username or p.password or p.port not in (None, 443):
            return None
        m = re.fullmatch(r'/sph/([A-Za-z0-9_-]{1,128})/?', p.path)
        return m.group(1) if m else None
    except (ValueError, AttributeError):
        return None


def post_json(url, payload, headers):
    req = Request(url, data=json.dumps(payload).encode(), headers={
        'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', **headers,
    })
    try:
        with urlopen(req, timeout=35) as response:
            body = response.read(2 * 1024 * 1024 + 1)
        if len(body) > 2 * 1024 * 1024:
            raise ValueError('response too large')
        result = json.loads(body)
        if not isinstance(result, dict):
            raise ValueError('invalid response')
        return result
    except Exception:
        raise WeChatError('微信解析服務暫時無法連線，請稍後再試') from None


def _trusted_media_url(value, *, allow_wxapp=False):
    if not isinstance(value, str):
        return None
    raw = value.strip()
    if not raw:
        return None
    if raw.startswith('//'):
        raw = f'https:{raw}'
    try:
        p = urlparse(raw)
        host = (p.hostname or '').lower()
        if p.username or p.password or p.port not in (None, 443):
            return None
        if host == 'video.qq.com' or host.endswith('.video.qq.com'):
            return raw if p.scheme == 'https' else None
        if allow_wxapp and host == 'wxapp.tc.qq.com':
            if p.scheme == 'http':
                p = p._replace(scheme='https')
                return urlunparse(p)
            if p.scheme == 'https':
                return raw
    except ValueError:
        pass
    return None


def media_url(value):
    return _trusted_media_url(value)


def _append_url_token(url, token):
    if not isinstance(url, str) or not isinstance(token, str):
        return url
    url, token = url.strip(), token.strip()
    if not token:
        return url
    if token.startswith('&') and '?' not in url:
        token = '?' + token[1:]
    elif token.startswith('?') and '?' in url:
        token = '&' + token[1:]
    elif not token.startswith(('?', '&')):
        token = ('&' if '?' in url else '?') + token
    return url + token


def _number(value, default=0):
    try:
        return int(float(value))
    except (TypeError, ValueError, OverflowError):
        return default


def _object_media_candidates(detail):
    """Collect full media descriptors when the official response exposes them."""
    candidates = []
    roots = []
    obj = detail.get('object') if isinstance(detail, dict) else None
    if isinstance(obj, dict):
        roots.append(obj)
    feed = detail.get('feedInfo') if isinstance(detail, dict) else None
    if isinstance(feed, dict):
        roots.append(feed)

    for root in roots:
        desc = root.get('objectDesc') if isinstance(root.get('objectDesc'), dict) else root
        media_items = desc.get('media') if isinstance(desc, dict) else None
        if not isinstance(media_items, list):
            continue
        for item in media_items:
            if not isinstance(item, dict):
                continue
            media_type = _number(item.get('mediaType'), 0)
            if media_type not in (0, 4):
                continue
            raw_url = next((item.get(key) for key in ('url', 'Url', 'mediaUrl', 'videoUrl', 'originalUrl') if item.get(key)), '')
            token = next((item.get(key) for key in ('urlToken', 'URLToken', 'url_token') if item.get(key)), '')
            full_url = _trusted_media_url(_append_url_token(raw_url, token), allow_wxapp=True)
            if not full_url:
                continue
            specs = item.get('spec') if isinstance(item.get('spec'), list) else []
            max_pixels = 0
            for spec in specs:
                if isinstance(spec, dict):
                    max_pixels = max(max_pixels, _number(spec.get('width')) * _number(spec.get('height')))
            pixels = max(
                _number(item.get('width')) * _number(item.get('height')),
                max_pixels,
            )
            decode_key = str(item.get('decodeKey') or item.get('decryptKey') or '').strip()
            encrypted_bytes = _number(
                item.get('encryptedByteLength') or item.get('encrypted_byte_length'),
                _WECHAT_ENCRYPTED_PREFIX_BYTES,
            )
            candidates.append({
                'url': full_url,
                'decode_key': decode_key,
                'encrypted_bytes': encrypted_bytes if encrypted_bytes > 0 else _WECHAT_ENCRYPTED_PREFIX_BYTES,
                'file_size': _number(item.get('fileSize')),
                'pixels': pixels,
            })
    return candidates


def _best_video(detail):
    feed = detail.get('feedInfo') if isinstance(detail, dict) else None
    feed = feed if isinstance(feed, dict) else {}

    # The preview API can expose a true original stream. Prefer it over transcoded
    # H.264/H.265 previews because it is closest to what the creator uploaded.
    origin = _trusted_media_url(feed.get('originVideoUrl'), allow_wxapp=True)
    if origin:
        return origin, '', 0, 'origin'

    # Some responses also expose the full object media descriptor (the structure
    # used by the official Channels web page). Pick the richest item by pixels and
    # declared file size; encrypted items are supported by decrypt_file().
    object_media = _object_media_candidates(detail)
    if object_media:
        selected = max(object_media, key=lambda item: (item['pixels'], item['file_size']))
        return selected['url'], selected['decode_key'], selected['encrypted_bytes'], 'object'

    h265 = _trusted_media_url((feed.get('h265VideoInfo') or {}).get('videoUrl'), allow_wxapp=True)
    if h265:
        return h265, '', 0, 'h265'
    h264 = _trusted_media_url((feed.get('h264VideoInfo') or {}).get('videoUrl'), allow_wxapp=True)
    if h264:
        return h264, '', 0, 'h264'
    fallback = _trusted_media_url(feed.get('videoUrl'), allow_wxapp=True)
    if fallback:
        return fallback, '', 0, 'default'
    return None, '', 0, ''


def _mix(a, b, c, d, e, f, g, h):
    a = (a - e) & _U64
    f = (f ^ (h >> 9)) & _U64
    h = (h + a) & _U64
    b = (b - f) & _U64
    g = (g ^ ((a << 9) & _U64)) & _U64
    a = (a + b) & _U64
    c = (c - g) & _U64
    h = (h ^ (b >> 23)) & _U64
    b = (b + c) & _U64
    d = (d - h) & _U64
    a = (a ^ ((c << 15) & _U64)) & _U64
    c = (c + d) & _U64
    e = (e - a) & _U64
    b = (b ^ (d >> 14)) & _U64
    d = (d + e) & _U64
    f = (f - b) & _U64
    c = (c ^ ((e << 20) & _U64)) & _U64
    e = (e + f) & _U64
    g = (g - c) & _U64
    d = (d ^ (f >> 17)) & _U64
    f = (f + g) & _U64
    h = (h - d) & _U64
    e = (e ^ ((g << 14) & _U64)) & _U64
    g = (g + h) & _U64
    return a, b, c, d, e, f, g, h


def _isaac64_keystream(seed, length):
    randrsl = [0] * 256
    mm = [0] * 256
    randrsl[0] = seed & _U64
    golden = 0x9E3779B97F4A7C13
    a = b = c = d = e = f = g = h = golden
    for _ in range(4):
        a, b, c, d, e, f, g, h = _mix(a, b, c, d, e, f, g, h)
    for base in range(0, 256, 8):
        a = (a + randrsl[base]) & _U64
        b = (b + randrsl[base + 1]) & _U64
        c = (c + randrsl[base + 2]) & _U64
        d = (d + randrsl[base + 3]) & _U64
        e = (e + randrsl[base + 4]) & _U64
        f = (f + randrsl[base + 5]) & _U64
        g = (g + randrsl[base + 6]) & _U64
        h = (h + randrsl[base + 7]) & _U64
        a, b, c, d, e, f, g, h = _mix(a, b, c, d, e, f, g, h)
        mm[base:base + 8] = [a, b, c, d, e, f, g, h]
    for base in range(0, 256, 8):
        a = (a + mm[base]) & _U64
        b = (b + mm[base + 1]) & _U64
        c = (c + mm[base + 2]) & _U64
        d = (d + mm[base + 3]) & _U64
        e = (e + mm[base + 4]) & _U64
        f = (f + mm[base + 5]) & _U64
        g = (g + mm[base + 6]) & _U64
        h = (h + mm[base + 7]) & _U64
        a, b, c, d, e, f, g, h = _mix(a, b, c, d, e, f, g, h)
        mm[base:base + 8] = [a, b, c, d, e, f, g, h]

    aa = bb = cc = 0

    def isaac():
        nonlocal aa, bb, cc
        cc = (cc + 1) & _U64
        bb = (bb + cc) & _U64
        for index in range(256):
            x = mm[index]
            mode = index & 3
            if mode == 0:
                aa = (~(aa ^ ((aa << 21) & _U64))) & _U64
            elif mode == 1:
                aa = (aa ^ (aa >> 5)) & _U64
            elif mode == 2:
                aa = (aa ^ ((aa << 12) & _U64)) & _U64
            else:
                aa = (aa ^ (aa >> 33)) & _U64
            aa = (aa + mm[(index + 128) & 255]) & _U64
            y = (mm[(x >> 3) & 255] + aa + bb) & _U64
            mm[index] = y
            bb = (mm[(y >> 11) & 255] + x) & _U64
            randrsl[index] = bb

    isaac()
    randcnt = 256
    output = bytearray()
    while len(output) < length:
        if randcnt == 0:
            isaac()
            randcnt = 256
        randcnt -= 1
        output.extend(randrsl[randcnt].to_bytes(8, 'big'))
    return bytes(output[:length])


def decrypt_file(path, decode_key, encrypted_bytes=_WECHAT_ENCRYPTED_PREFIX_BYTES):
    """Decrypt the encrypted prefix used by full-quality WeChat Channels media."""
    key_text = str(decode_key or '').strip()
    if not key_text or key_text == '0':
        return False
    try:
        seed = int(key_text, 10)
    except ValueError:
        raise WeChatError('微信高畫質影片解碼資訊無效，請重新取得分享連結') from None
    path = Path(path)
    try:
        with path.open('r+b') as handle:
            prefix = handle.read(max(1, int(encrypted_bytes or _WECHAT_ENCRYPTED_PREFIX_BYTES)))
            if not prefix:
                raise WeChatError('微信高畫質影片內容為空，請重新下載')
            if any(box in prefix[:64] for box in (b'ftyp', b'styp', b'moov', b'mdat')):
                return False
            key_stream = _isaac64_keystream(seed, len(prefix))
            decoded = bytes(a ^ b for a, b in zip(prefix, key_stream))
            # MP4 family files normally expose one of these boxes very close to
            # the start. Validate before overwriting so a stale key cannot corrupt
            # an otherwise usable download.
            header = decoded[:64]
            if not any(box in header for box in (b'ftyp', b'styp', b'moov', b'mdat')):
                raise WeChatError('微信高畫質影片解碼失敗，請重新整理分享連結後再試')
            handle.seek(0)
            handle.write(decoded)
        return True
    except OSError:
        raise WeChatError('微信高畫質影片暫存處理失敗，請稍後再試') from None


def resolve(url):
    identifier = share_id(url)
    if not identifier:
        raise WeChatError('請貼上 https://weixin.qq.com/sph/ 開頭的視頻號分享連結')
    cookie = os.environ.get('YUANBAO_COOKIE', '')
    if not cookie:
        raise WeChatError('微信視頻號尚未連接騰訊登入，請聯絡管理員')
    parsed = post_json('https://yuanbao.tencent.com/api/weixin/get_parse_result', {
        'type': 'video_channel_url', 'url': f'https://weixin.qq.com/sph/{identifier}', 'scene': 1,
    }, {'Cookie': cookie, 'Origin': 'https://yuanbao.tencent.com',
        'Referer': 'https://yuanbao.tencent.com/', 'x-source': 'web',
        'x-requested-with': 'XMLHttpRequest'})
    data = parsed.get('data') or {}
    playable = data.get('playable_url', '')
    p = urlparse(playable)
    if p.scheme != 'https' or p.hostname != 'channels.weixin.qq.com':
        raise WeChatError('微信影片無法解析，可能需要管理員重新登入騰訊元寶，或該內容不支援下載')
    q = parse_qs(p.query)
    token, eid = q.get('token', [''])[0], q.get('eid', [''])[0]
    if not token or not eid:
        raise WeChatError('微信未提供影片播放資訊，請確認連結有效且內容可觀看')
    result = post_json('https://channels.weixin.qq.com/finder-preview/api/feed/get_feed_info', {
        'baseReq': {'generalToken': token}, 'exportId': eid,
    }, {'Referer': playable, 'Origin': 'https://channels.weixin.qq.com'})
    detail = result.get('data') or {}
    feed = detail.get('feedInfo') or {}
    video, decode_key, encrypted_bytes, source = _best_video(detail)
    if not video:
        raise WeChatError('微信未提供可下載的影片；圖片貼文、直播或受限內容可能不支援')
    return {
        'id': identifier, 'title': (feed.get('description') or '微信視頻號影片').strip(),
        'channel': (detail.get('authorInfo') or {}).get('nickname') or '微信視頻號',
        'thumbnail': media_url(feed.get('coverUrl')), 'ext': 'mp4', 'url': video,
        'http_headers': {'Referer': 'https://channels.weixin.qq.com/', 'User-Agent': 'Mozilla/5.0'},
        'extractor': 'wechat', 'webpage_url': f'https://weixin.qq.com/sph/{identifier}',
        '_wechat_decode_key': decode_key,
        '_wechat_encrypted_bytes': encrypted_bytes,
        '_wechat_quality_source': source,
    }
