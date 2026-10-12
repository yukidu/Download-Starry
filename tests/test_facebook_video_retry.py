import os

import pytest
from yt_dlp.utils import DownloadError

os.environ['APP_MODE'] = 'cloud'
os.environ['CLOUD_BACKEND_TOKEN'] = 'test-only-backend-token-' + 'x' * 40

import deployment
import app as core


FACEBOOK_URL = 'https://www.facebook.com/reel/1746520369833907'
YOUTUBE_URL = 'https://www.youtube.com/watch?v=abcdefghijk'


def _fake_job(url: str) -> dict:
    return {
        'status': 'downloading',
        'progress': 21,
        'downloaded_bytes': 15_600_000,
        'total_bytes': 70_900_000,
        'speed': 2_300_000,
        'eta': 24,
        'message': '正在下載影片資料',
        'error': None,
        'request_key': (url, 'video', '1440', ''),
        'updated_at': 0,
    }


def test_facebook_download_reextracts_once_with_fresh_ytdlp(monkeypatch):
    calls = []

    def fake_extract(self, url, download=True, *args, **kwargs):
        calls.append((url, download, id(self)))
        if len(calls) == 1:
            raise DownloadError('HTTP Error 403: Forbidden')
        return {'id': '1746520369833907', 'title': 'Facebook retry success'}

    monkeypatch.setattr(deployment._OriginalYoutubeDL, 'extract_info', fake_extract)
    monkeypatch.setattr(deployment.time, 'sleep', lambda _seconds: None)

    core.download_jobs['facebook-retry-test'] = _fake_job(FACEBOOK_URL)
    try:
        with deployment.FacebookRetryYoutubeDL({'quiet': True}) as ydl:
            result = ydl.extract_info(FACEBOOK_URL, download=True)

        assert result['title'] == 'Facebook retry success'
        assert len(calls) == 2
        assert calls[0][2] != calls[1][2]  # retry must use a fresh YoutubeDL instance
        job = core.download_jobs['facebook-retry-test']
        assert job['status'] == 'downloading'
        assert job['progress'] == 0
        assert job['downloaded_bytes'] == 0
        assert '重新解析影音來源' in job['message']
        assert job['error'] is None
    finally:
        core.download_jobs.pop('facebook-retry-test', None)


def test_non_facebook_download_is_not_given_cloud_retry(monkeypatch):
    calls = []

    def fake_extract(self, url, download=True, *args, **kwargs):
        calls.append(url)
        raise DownloadError('HTTP Error 403: Forbidden')

    monkeypatch.setattr(deployment._OriginalYoutubeDL, 'extract_info', fake_extract)
    monkeypatch.setattr(deployment.time, 'sleep', lambda _seconds: None)

    with deployment.FacebookRetryYoutubeDL({'quiet': True}) as ydl:
        with pytest.raises(DownloadError):
            ydl.extract_info(YOUTUBE_URL, download=True)

    assert calls == [YOUTUBE_URL]


def test_metadata_probe_is_not_retried(monkeypatch):
    calls = []

    def fake_extract(self, url, download=True, *args, **kwargs):
        calls.append((url, download))
        raise DownloadError('metadata failed')

    monkeypatch.setattr(deployment._OriginalYoutubeDL, 'extract_info', fake_extract)
    monkeypatch.setattr(deployment.time, 'sleep', lambda _seconds: None)

    with deployment.FacebookRetryYoutubeDL({'quiet': True}) as ydl:
        with pytest.raises(DownloadError):
            ydl.extract_info(FACEBOOK_URL, download=False)

    assert calls == [(FACEBOOK_URL, False)]


def test_cloud_size_limit_and_cancel_are_not_retried(monkeypatch):
    calls = []

    def fake_extract(self, url, download=True, *args, **kwargs):
        calls.append(url)
        raise DownloadError('CLOUD_SIZE_LIMIT')

    monkeypatch.setattr(deployment._OriginalYoutubeDL, 'extract_info', fake_extract)
    monkeypatch.setattr(deployment.time, 'sleep', lambda _seconds: None)

    with deployment.FacebookRetryYoutubeDL({'quiet': True}) as ydl:
        with pytest.raises(DownloadError):
            ydl.extract_info(FACEBOOK_URL, download=True)

    assert calls == [FACEBOOK_URL]
