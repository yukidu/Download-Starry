import tempfile
import time
import zipfile
from pathlib import Path
from threading import Event

import app as app_module


def _photo_post_info():
    return {
        '_type': 'playlist',
        'id': 'PHOTO123',
        'title': 'Post by demo',
        'channel': 'demo',
        'entries': [
            {
                'id': 'PHOTO123-1',
                'formats': [],
                'thumbnail': 'https://scontent.cdninstagram.com/photo-1.jpg',
                'thumbnails': [
                    {'url': 'https://scontent.cdninstagram.com/photo-1-small.jpg', 'width': 320, 'height': 400},
                    {'url': 'https://scontent.cdninstagram.com/photo-1.jpg', 'width': 1080, 'height': 1350},
                ],
            },
            {
                'id': 'PHOTO123-2',
                'formats': [],
                'thumbnail': 'https://scontent.cdninstagram.com/photo-2.jpg',
                'thumbnails': [
                    {'url': 'https://scontent.cdninstagram.com/photo-2.jpg', 'width': 1080, 'height': 1350},
                ],
            },
        ],
    }


def test_instagram_photo_entries_detects_image_only_carousel():
    entries = app_module.instagram_photo_entries(_photo_post_info())
    assert len(entries) == 2
    assert app_module.best_thumbnail_url(entries[0]).endswith('photo-1.jpg')


def test_instagram_photo_entries_does_not_replace_video_posts():
    info = _photo_post_info()
    info['entries'][0]['formats'] = [{
        'url': 'https://example.com/video.mp4',
        'vcodec': 'h264',
        'height': 1080,
    }]
    assert app_module.instagram_photo_entries(info) == []


def test_info_api_auto_switches_instagram_photo(monkeypatch):
    class FakeYDL:
        def __init__(self, options):
            assert options['ignore_no_formats_error'] is True
            assert options['noplaylist'] is False

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def extract_info(self, _url, download=False):
            assert download is False
            return _photo_post_info()

    monkeypatch.setattr(app_module, 'YoutubeDL', FakeYDL)
    response = app_module.app.test_client().post(
        '/api/info', json={'url': 'https://www.instagram.com/p/PHOTO123/'})
    assert response.status_code == 200
    data = response.get_json()
    assert data['media_type'] == 'image'
    assert data['image_count'] == 2
    assert data['qualities'] == []
    assert data['subtitles'] == []
    assert data['playlist'] is None


def test_image_download_is_restricted_to_instagram():
    response = app_module.app.test_client().post('/api/download', data={
        'url': 'https://www.youtube.com/watch?v=abcdefghijk',
        'type': 'image',
        'quality': 'original',
    })
    assert response.status_code == 400
    assert 'Instagram' in response.get_json()['error']


def test_image_worker_packages_instagram_carousel(monkeypatch):
    class FakeYDL:
        def __init__(self, options):
            self.options = options
            assert options['writethumbnail'] is True
            assert options['ignore_no_formats_error'] is True
            assert options['noplaylist'] is False

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def extract_info(self, _url, download=True):
            assert download is True
            root = Path(self.options['outtmpl']).parent
            (root / 'photo-one.jpg').write_bytes(b'first-photo')
            (root / 'photo-two.webp').write_bytes(b'second-photo')
            return {'title': 'Post by demo'}

    monkeypatch.setattr(app_module, 'YoutubeDL', FakeYDL)
    temp_dir = tempfile.mkdtemp(prefix='instagram_photo_test_')
    job_id = 'instagram-photo-test-job'
    app_module.download_jobs[job_id] = {
        'status': 'queued',
        'progress': 0,
        'downloaded_bytes': 0,
        'total_bytes': 0,
        'speed': None,
        'eta': None,
        'message': '等待開始下載',
        'error': None,
        'result': None,
        'filename': None,
        'temp_dir': temp_dir,
        'cancel_event': Event(),
        'request_key': ('https://www.instagram.com/p/PHOTO123/', 'image', 'original', ''),
        'last_seen': time.time(),
        'created_at': time.time(),
        'updated_at': time.time(),
    }

    try:
        app_module.download_worker(
            job_id,
            'https://www.instagram.com/p/PHOTO123/',
            'image',
            'original',
            'Instagram',
            None,
        )
        job = app_module.download_jobs[job_id]
        assert job['status'] == 'finished'
        assert job['filename'].endswith('.zip')
        result = Path(job['result'])
        assert result.is_file()
        with zipfile.ZipFile(result) as archive:
            names = archive.namelist()
            assert len(names) == 2
            assert any(name.endswith('.jpg') for name in names)
            assert any(name.endswith('.webp') for name in names)
    finally:
        app_module.remove_job(job_id)
