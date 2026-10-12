"""Authenticated container entry point. Desktop launches continue using app.py."""
import hmac
import os
from threading import Event, Thread

os.environ['APP_MODE'] = 'cloud'
from flask import jsonify, request
from app import app, cleanup_stale_jobs, APP_VERSION
import wechat


def _cloud_best_wechat_video(detail):
    """Prefer the actual Channels page media, matching res-downloader's strategy.

    The preview API's originVideoUrl / HEVC labels are not reliable indicators of
    bitrate or visual quality.  The objectDesc.media entry is the media object the
    official Channels page itself exposes, including urlToken/decodeKey/fileSize.
    If that richer object is unavailable, keep the pre-change H.264 behaviour so
    cloud downloads never regress merely because a smaller HEVC URL exists.
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


# Cloud-only selection policy.  app.py imports the same wechat module object, so
# replacing the selector here affects only the container entry point and leaves
# the Windows/local launch path unchanged.
wechat._best_video = _cloud_best_wechat_video

backend_token = os.environ.get('CLOUD_BACKEND_TOKEN', '')
if len(backend_token) < 32:
    raise RuntimeError('CLOUD_BACKEND_TOKEN must be configured before serving cloud traffic')


@app.before_request
def authenticate_backend():
    supplied = request.headers.get('X-Backend-Token', '')
    if not hmac.compare_digest(supplied.encode(), backend_token.encode()):
        return jsonify(error='需要登入才能使用此服務'), 401
    if request.path.startswith('/api/integration/'):
        return jsonify(error='此功能僅供 Windows 本機版使用'), 404


@app.get('/api/health')
def health():
    return jsonify(ok=True, version=APP_VERSION, mode='cloud')


def sweep():
    timer = Event()
    while not timer.wait(30):
        cleanup_stale_jobs()


Thread(target=sweep, name='temporary-file-cleanup', daemon=True).start()
