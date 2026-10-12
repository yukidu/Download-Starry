from __future__ import annotations

from urllib.parse import urlparse

from yt_dlp.extractor.common import InfoExtractor
from yt_dlp.utils import ExtractorError


_VIDEO_EXTENSIONS = ('.mp4', '.m4v', '.mov', '.webm', '.m3u8')
_IMAGE_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif')


def _https_url(value) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value if value.startswith('https://') else None


def _looks_like_video(media: dict) -> bool:
    if not isinstance(media, dict):
        return False
    url = _https_url(media.get('url'))
    if not url:
        return False
    media_type = str(media.get('type') or '').lower()
    path = urlparse(url).path.lower()
    if any(token in media_type for token in ('video', 'hls', 'mpeg')):
        return True
    if path.endswith(_IMAGE_EXTENSIONS):
        return False
    return path.endswith(_VIDEO_EXTENSIONS) or '.m3u8' in url.lower()


def public_media_candidates(item: dict) -> list[tuple[str, dict]]:
    """Return de-duplicated public video URLs exposed by Gan Jing World's API."""
    candidates: list[tuple[str, dict]] = []
    seen = set()

    primary = _https_url(item.get('video_url')) if isinstance(item, dict) else None
    if primary:
        candidates.append((primary, {}))
        seen.add(primary)

    for media in (item.get('media') or []) if isinstance(item, dict) else []:
        if not _looks_like_video(media):
            continue
        media_url = _https_url(media.get('url'))
        if media_url and media_url not in seen:
            candidates.append((media_url, media))
            seen.add(media_url)
    return candidates


def scheduled_timestamp(value) -> float | None:
    try:
        timestamp = float(value)
    except (TypeError, ValueError):
        return None
    if timestamp <= 0:
        return None
    return timestamp / 1000 if timestamp > 10_000_000_000 else timestamp


class GanJingWorldIE(InfoExtractor):
    IE_NAME = 'ganjingworld'
    _VALID_URL = (
        r'https?://(?:www\.)?(?:ganjingworld\.com|ganjing\.com)/'
        r'(?:(?:[a-z]{2}(?:-[A-Za-z]{2})?)/)?(?:video|shorts?)/(?P<id>[A-Za-z0-9]+)'
    )
    _API_URL = 'https://gw.ganjingworld.com/v1.1/content/query'
    _TESTS = [{
        'url': 'https://www.ganjingworld.com/video/1f7srq4ett0373aCVOuRtTA1h1i61c',
        'only_matching': True,
    }, {
        'url': 'https://www.ganjingworld.com/zh-TW/video/1f7srq4ett0373aCVOuRtTA1h1i61c',
        'only_matching': True,
    }]

    def _real_extract(self, url):
        video_id = self._match_id(url)
        webpage_url = f'https://www.ganjingworld.com/video/{video_id}'
        response = self._download_json(
            self._API_URL,
            video_id,
            note='讀取乾淨世界公開影片資料',
            query={
                'id': video_id,
                'ids': video_id,
                'lang': 'zh-TW',
                'with_desc': 'true',
                'query': 'basic,translations,watch_count',
                'include_unlisted': 'true',
            },
            headers={
                'Origin': 'https://www.ganjingworld.com',
                'Referer': webpage_url,
            },
        )
        items = ((response or {}).get('data') or {}).get('list') or []
        item = next(
            (entry for entry in items if isinstance(entry, dict) and entry.get('id') == video_id),
            next((entry for entry in items if isinstance(entry, dict)), None),
        )
        if not item:
            raise ExtractorError(
                '找不到可公開讀取的乾淨世界影片；內容可能已刪除、設為私人或需要登入',
                expected=True,
            )

        headers = {
            'Origin': 'https://www.ganjingworld.com',
            'Referer': webpage_url,
        }
        formats = []
        for index, (media_url, media) in enumerate(public_media_candidates(item), start=1):
            if '.m3u8' in media_url.lower():
                hls_formats = self._extract_m3u8_formats(
                    media_url,
                    video_id,
                    ext='mp4',
                    m3u8_id='hls',
                    fatal=False,
                    headers=headers,
                )
                formats.extend(hls_formats)
                continue

            path = urlparse(media_url).path.lower()
            extension = next((ext[1:] for ext in _VIDEO_EXTENSIONS if path.endswith(ext) and ext != '.m3u8'), None)
            fmt = {
                'format_id': 'original' if index == 1 else f'media-{index}',
                'url': media_url,
                'http_headers': headers,
                'source_preference': 10 if index == 1 else 0,
            }
            if extension:
                fmt['ext'] = extension
            for dimension in ('width', 'height'):
                try:
                    value = int(media.get(dimension) or 0)
                except (TypeError, ValueError):
                    value = 0
                if value > 0:
                    fmt[dimension] = value
            formats.append(fmt)

        if not formats:
            raise ExtractorError(
                '乾淨世界官方資料沒有提供可下載的公開影片來源',
                expected=True,
            )

        channel = item.get('channel') if isinstance(item.get('channel'), dict) else {}
        thumbnail = _https_url(item.get('poster_url')) or _https_url(item.get('image_auto_url'))
        if not thumbnail:
            thumbnail = next((
                _https_url(media.get('url'))
                for media in (item.get('media') or [])
                if isinstance(media, dict)
                and str(media.get('type') or '').lower().startswith('image')
            ), None)

        return {
            'id': video_id,
            'title': item.get('title') or f'乾淨世界 {video_id}',
            'description': item.get('description'),
            'thumbnail': thumbnail,
            'timestamp': scheduled_timestamp(item.get('time_scheduled')),
            'channel': channel.get('name'),
            'channel_id': channel.get('id'),
            'uploader': channel.get('name'),
            'uploader_id': channel.get('id'),
            'formats': formats,
        }
