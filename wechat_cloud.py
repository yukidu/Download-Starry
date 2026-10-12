"""Cloud-only WeChat quality selection policy."""
import wechat


def best_video(detail):
    """Choose the highest-quality source available to the cloud downloader.

    res-downloader succeeds by using the first objectDesc.media item exposed by
    the official Channels page, including its urlToken/decodeKey metadata.  The
    preview API's originVideoUrl / H.265 labels are not reliable quality signals,
    so they are deliberately lower-priority fallbacks here.
    """
    feed = detail.get('feedInfo') if isinstance(detail, dict) else None
    feed = feed if isinstance(feed, dict) else {}

    object_media = wechat._object_media_candidates(detail)
    if object_media:
        selected = object_media[0]
        return (
            selected['url'],
            selected['decode_key'],
            selected['encrypted_bytes'],
            'object',
        )

    # Preserve the pre-regression behaviour when the richer page media object is
    # unavailable.  For the user's failing sample this keeps the 4.4 MB H.264
    # stream instead of incorrectly preferring the 2.1 MB HEVC/origin preview.
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
