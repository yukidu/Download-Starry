"""Resolve public WeChat Channels shares using the owner's Yuanbao session."""
import json
import os
import re
from urllib.parse import urlparse, parse_qs
from urllib.request import Request, urlopen


class WeChatError(Exception):
    pass


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


def media_url(value):
    if not isinstance(value, str):
        return None
    try:
        p = urlparse(value)
        host = p.hostname or ''
        if (p.scheme == 'https' and not p.username and not p.password
                and p.port in (None, 443)
                and (host == 'video.qq.com' or host.endswith('.video.qq.com'))):
            return value
    except ValueError:
        pass
    return None


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
    video = media_url((feed.get('h264VideoInfo') or {}).get('videoUrl')) or media_url(feed.get('videoUrl'))
    if not video:
        raise WeChatError('微信未提供可下載的影片；圖片貼文、直播或受限內容可能不支援')
    return {
        'id': identifier, 'title': (feed.get('description') or '微信視頻號影片').strip(),
        'channel': (detail.get('authorInfo') or {}).get('nickname') or '微信視頻號',
        'thumbnail': media_url(feed.get('coverUrl')), 'ext': 'mp4', 'url': video,
        'http_headers': {'Referer': 'https://channels.weixin.qq.com/', 'User-Agent': 'Mozilla/5.0'},
        'extractor': 'wechat', 'webpage_url': f'https://weixin.qq.com/sph/{identifier}',
    }
