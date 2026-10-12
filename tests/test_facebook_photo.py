import os
import tempfile
import time
import zipfile
from pathlib import Path
from threading import Event
from types import SimpleNamespace

import app as app_module
import facebook_gallery


def _backend_headers():
    token = os.environ.get('CLOUD_BACKEND_TOKEN')
    return {'X-Backend-Token': token} if token else {}


def test_facebook_photo_url_detection_is_bounded():
    assert facebook_gallery.looks_like_photo_or_album_url(
        'https://www.facebook.com/photo/?fbid=123456789'
    )
    assert facebook_gallery.looks_like_photo_or_album_url(
        'https://www.facebook.com/media/set/?set=a.123456&type=3'
    )
    assert facebook_gallery.looks_like_photo_or_album_url(
        'https://www.facebook.com/demo/posts/123456789'
    )
    assert facebook_gallery.may_contain_photos_url(
        'https://www.facebook.com/share/p/AbCdEfGh/'
    )
    assert not facebook_gallery.may_contain_photos_url(
        'https://www.facebook.com/reel/123456789'
    )
    assert not facebook_gallery.may_contain_photos_url(
        'https://www.facebook.com/demo'
    )
    assert not facebook_gallery.may_contain_photos_url(
        'https://facebook.com.evil.example/photo/?fbid=123'
    )


def test_facebook_probe_reads_public_image_urls(monkeypatch):
    captured = {}

    def fake_run(command, **kwargs):
        captured['command'] = command
        assert kwargs['timeout'] == 45
        return SimpleNamespace(
            returncode=0,
            stdout=(
                'https://scontent.example/photo-one.jpg\n'
                'https://scontent.example/photo-two.webp\n'
            ),
            stderr='',
        )

    monkeypatch.setattr(facebook_gallery.subprocess, 'run', fake_run)
    info = facebook_gallery.probe(
        'https://www.facebook.com/media/set/?set=a.123456&type=3'
    )
    assert info['title'] == 'Facebook 相簿'
    assert info['image_count'] == 2
    assert info['thumbnail'].endswith('photo-one.jpg')
    assert '--get-urls' in captured['command']
    assert '--range' in captured['command']
    assert 'extractor.facebook.include=photos' in captured['command']


def test_info_api_switches_facebook_photo_to_image_mode(monkeypatch):
    monkeypatch.setattr(app_module.facebook_gallery, 'probe', lambda _url: {
        'title': 'Facebook 相簿',
        'thumbnail': 'https://scontent.example/photo-one.jpg',
        'image_count': 12,
        'image_count_truncated': False,
    })
    response = app_module.app.test_client().post(
        '/api/info',
        headers=_backend_headers(),
        json={'url': 'https://www.facebook.com/media/set/?set=a.123456&type=3'},
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data['platform'] == 'Facebook'
    assert data['media_type'] == 'image'
    assert data['image_count'] == 12
    assert data['thumbnail'].endswith('photo-one.jpg')
    assert data['qualities'] == []
    assert data['playlist'] is None


def test_facebook_photo_download_request_is_allowed(monkeypatch):
    monkeypatch.setattr(app_module.download_executor, 'submit', lambda *args: None)
    response = app_module.app.test_client().post(
        '/api/download',
        headers=_backend_headers(),
        data={
            'url': 'https://www.facebook.com/photo/?fbid=123456789',
            'type': 'image',
            'quality': 'best',
        },
    )
    assert response.status_code == 202
    job_id = response.get_json()['job_id']
    app_module.remove_job(job_id)


def test_facebook_album_worker_packages_multiple_photos(monkeypatch):
    def fake_download(_url, destination, **kwargs):
        root = Path(destination) / 'facebook-album'
        root.mkdir(parents=True, exist_ok=True)
        (root / 'one.jpg').write_bytes(b'first-facebook-photo')
        (root / 'two.webp').write_bytes(b'second-facebook-photo')
        kwargs['progress'](42, 2)
        return {'title': 'Facebook 相簿', 'image_count': 2}

    monkeypatch.setattr(app_module.facebook_gallery, 'download', fake_download)
    temp_dir = tempfile.mkdtemp(prefix='facebook_photo_test_')
    job_id = 'facebook-photo-test-job'
    now = time.time()
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
        'request_key': ('https://www.facebook.com/media/set/?set=a.123', 'image', 'best', ''),
        'last_seen': now,
        'created_at': now,
        'updated_at': now,
    }

    try:
        app_module.download_worker(
            job_id,
            'https://www.facebook.com/media/set/?set=a.123',
            'image',
            'best',
            'Facebook',
            None,
        )
        job = app_module.download_jobs[job_id]
        assert job['status'] == 'finished'
        assert job['filename'].endswith('.zip')
        result = Path(job['result'])
        assert result.name == 'facebook-photos.zip'
        with zipfile.ZipFile(result) as archive:
            names = archive.namelist()
            assert len(names) == 2
            assert any(name.endswith('.jpg') for name in names)
            assert any(name.endswith('.webp') for name in names)
    finally:
        app_module.remove_job(job_id)
