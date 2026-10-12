from __future__ import annotations

from urllib.parse import urlparse

from yt_dlp.extractor.common import InfoExtractor
from yt_dlp.utils import ExtractorError


_TARGETS = {
    'b23.tv': ('bilibili.com', 'bilibili.tv'),
    'pin.it': ('pinterest.com', 'pinterest.tw'),
    'xhslink.com': ('xiaohongshu.com',),
    'gjw.us': ('ganjingworld.com', 'ganjing.com'),
}


def _host_matches(hostname: str, domains: tuple[str, ...]) -> bool:
    hostname = hostname.lower().rstrip('.')
    return any(hostname == domain or hostname.endswith(f'.{domain}') for domain in domains)


class SaveVideoShortRedirectIE(InfoExtractor):
    IE_NAME = 'savevideo:shortredirect'
    _VALID_URL = r'https?://(?:www\.)?(?P<host>b23\.tv|pin\.it|xhslink\.com|gjw\.us)/(?P<id>[^?#]+)'

    def _real_extract(self, url):
        match = self._match_valid_url(url)
        short_host = match.group('host').lower()
        display_id = match.group('id').strip('/') or short_host
        response = self._request_webpage(
            url,
            display_id,
            note='解析分享短網址',
            headers={'User-Agent': 'Mozilla/5.0'},
        )
        final_url = response.url
        final_host = (urlparse(final_url).hostname or '').lower().rstrip('.')
        if not _host_matches(final_host, _TARGETS[short_host]):
            raise ExtractorError('分享短網址沒有導向支援的平台', expected=True)
        return self.url_result(final_url)
