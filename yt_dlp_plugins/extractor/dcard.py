from __future__ import annotations

import html
import re

from yt_dlp.extractor.common import InfoExtractor
from yt_dlp.utils import ExtractorError


_DCARD_VIDEO_RE = re.compile(
    r'https?://megapx-assets\.dcard\.tw/videos/'
    r'(?P<uuid>[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/'
)


def dcard_original_video_url(webpage: str) -> str | None:
    """Return the public original Dcard video asset exposed by the post page."""
    normalized = html.unescape(webpage or '')
    normalized = normalized.replace('\\u002F', '/').replace('\\/', '/')
    match = _DCARD_VIDEO_RE.search(normalized)
    if not match:
        return None
    return f"https://megapx-assets.dcard.tw/videos/{match.group('uuid')}/orig"


class DcardIE(InfoExtractor):
    IE_NAME = 'dcard'
    _VALID_URL = r'https?://(?:www\.)?dcard\.tw/(?:f/[^/?#]+/)?p/(?P<id>\d+)'
    _TESTS = [{
        'url': 'https://www.dcard.tw/f/video_demo/p/253467695',
        'only_matching': True,
    }]

    def _real_extract(self, url):
        video_id = self._match_id(url)
        webpage = self._download_webpage(url, video_id)
        media_url = dcard_original_video_url(webpage)
        if not media_url:
            raise ExtractorError(
                '這篇 Dcard 公開貼文沒有找到可下載的原生影片', expected=True)

        return {
            'id': video_id,
            'title': self._og_search_title(webpage, default=f'Dcard {video_id}'),
            'description': self._og_search_description(webpage, default=None),
            'thumbnail': self._og_search_thumbnail(webpage, default=None),
            'formats': [{
                'format_id': 'original',
                'url': media_url,
                'ext': 'mp4',
                'quality': 1,
                'http_headers': {'Referer': 'https://www.dcard.tw/'},
            }],
        }
