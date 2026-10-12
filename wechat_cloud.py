"""Cloud-only WeChat quality selection policy."""
from urllib.parse import parse_qs, parse_qsl, urlencode, urlparse, urlunparse

import wechat


def _ultra_hd_url(url):
    """Mirror res-downloader's WeChat Ultra HD URL rule.

    WeChat object media URLs can carry transcoding/quality query parameters.
    res-downloader's Ultra HD mode deliberately discards those parameters when
    both encfilekey and token are present, retaining only the two authorization
    values so the CDN can serve the highest source available for that media.
    """
    if not isinstance(url, str) or not url:
        return url
    try:
        parsed = urlparse(url)
        params = parse_qs(parsed.query, keep_blank_values=True)
        encfilekey = (params.get('encfilekey') or [''])[0]
        token = (params.get('token') or [''])[0]
        if not encfilekey or not token:
            return url
        query = urlencode((('encfilekey', encfilekey), ('token', token)))
        return urlunparse((parsed.scheme, parsed.netloc, parsed.path, '', query, ''))
    except (TypeError, ValueError):
        return url


def _spec_url(url, file_format):
    """Request one explicit WeChat Channels quality variant.

    ``objectDesc.media[].spec`` exposes fileFormat values such as xWT111.
    The official media CDN selects that variant through X-snsvideoflag.  Replace
    any lower-quality flag already present in the URL instead of appending a
    duplicate query parameter whose interpretation would be ambiguous.
    """
    if not isinstance(url, str) or not url or not isinstance(file_format, str):
        return url
    file_format = file_format.strip()
    if not file_format:
        return url
    try:
        parsed = urlparse(url)
        params = [
            (key, value)
            for key, value in parse_qsl(parsed.query, keep_blank_values=True)
            if key.lower() != 'x-snsvideoflag'
        ]
        params.append(('X-snsvideoflag', file_format))
        return urlunparse(parsed._replace(query=urlencode(params)))
    except (TypeError, ValueError):
        return url


def _first_object_media(detail):
    """Return the first usable official objectDesc video media and its full URL."""
    if not isinstance(detail, dict):
        return None, None
    roots = []
    obj = detail.get('object')
    if isinstance(obj, dict):
        roots.append(obj)
    feed = detail.get('feedInfo')
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
            media_type = wechat._number(item.get('mediaType'), 0)
            if media_type not in (0, 4):
                continue
            raw_url = next(
                (
                    item.get(key)
                    for key in ('url', 'Url', 'mediaUrl', 'videoUrl', 'originalUrl')
                    if item.get(key)
                ),
                '',
            )
            token = next(
                (
                    item.get(key)
                    for key in ('urlToken', 'URLToken', 'url_token')
                    if item.get(key)
                ),
                '',
            )
            full_url = wechat._trusted_media_url(
                wechat._append_url_token(raw_url, token),
                allow_wxapp=True,
            )
            if full_url:
                return item, full_url
    return None, None


def _highest_spec(item):
    """Pick the spec with the largest declared resolution; keep server order on ties."""
    if not isinstance(item, dict):
        return None
    specs = item.get('spec')
    if not isinstance(specs, list):
        return None

    ranked = []
    for index, spec in enumerate(specs):
        if not isinstance(spec, dict):
            continue
        file_format = str(spec.get('fileFormat') or '').strip()
        if not file_format:
            continue
        width = wechat._number(spec.get('width'))
        height = wechat._number(spec.get('height'))
        ranked.append({
            'file_format': file_format,
            'width': width,
            'height': height,
            'pixels': width * height,
            'index': index,
        })
    if not ranked:
        return None
    return max(ranked, key=lambda spec: (spec['pixels'], -spec['index']))


def _decode_info(item):
    decode_key = str(item.get('decodeKey') or item.get('decryptKey') or '').strip()
    encrypted_bytes = wechat._number(
        item.get('encryptedByteLength') or item.get('encrypted_byte_length'),
        wechat._WECHAT_ENCRYPTED_PREFIX_BYTES,
    )
    if encrypted_bytes <= 0:
        encrypted_bytes = wechat._WECHAT_ENCRYPTED_PREFIX_BYTES
    return decode_key, encrypted_bytes


def best_video(detail):
    """Choose the highest explicit quality source available to the cloud downloader."""
    feed = detail.get('feedInfo') if isinstance(detail, dict) else None
    feed = feed if isinstance(feed, dict) else {}

    item, full_url = _first_object_media(detail)
    if item and full_url:
        decode_key, encrypted_bytes = _decode_info(item)
        highest = _highest_spec(item)
        if highest:
            # A concrete spec is more deterministic than labels such as "origin"
            # or codec names. Ask WeChat's CDN for the largest declared resolution
            # explicitly, replacing any low-quality X-snsvideoflag already present.
            return (
                _spec_url(full_url, highest['file_format']),
                decode_key,
                encrypted_bytes,
                'object-spec',
            )

        # Older responses may not expose spec[]. Keep the previous Ultra-HD rule
        # as a compatibility fallback rather than regressing to HEVC previews.
        return (
            _ultra_hd_url(full_url),
            decode_key,
            encrypted_bytes,
            'object',
        )

    # Preserve the known-good pre-regression fallback when objectDesc media is
    # unavailable. Do not mistake a smaller HEVC/origin preview for higher quality.
    h264 = wechat._trusted_media_url(
        (feed.get('h264VideoInfo') or {}).get('videoUrl'),
        allow_wxapp=True,
    )
    if h264:
        return h264, '', 0, 'h264'

    fallback = wechat._trusted_media_url(feed.get('videoUrl'), allow_wxapp=True)
    if fallback:
        return fallback, '', 0, 'default'

    origin = wechat._trusted_media_url(feed.get('originVideoUrl'), allow_wxapp=True)
    if origin:
        return origin, '', 0, 'origin'

    h265 = wechat._trusted_media_url(
        (feed.get('h265VideoInfo') or {}).get('videoUrl'),
        allow_wxapp=True,
    )
    if h265:
        return h265, '', 0, 'h265'

    return None, '', 0, ''
