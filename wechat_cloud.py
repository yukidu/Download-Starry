"""Cloud-only WeChat quality selection policy."""
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

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


def best_video(detail):
    """Choose the highest-quality source available to the cloud downloader."""
    feed = detail.get('feedInfo') if isinstance(detail, dict) else None
    feed = feed if isinstance(feed, dict) else {}

    object_media = wechat._object_media_candidates(detail)
    if object_media:
        # Match res-downloader's WeChat Ultra HD behaviour: first use the
        # official objectDesc.media source, then remove the quality/transcode
        # query parameters while preserving encfilekey + token authorization.
        selected = object_media[0]
        return (
            _ultra_hd_url(selected['url']),
            selected['decode_key'],
            selected['encrypted_bytes'],
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
