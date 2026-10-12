import os
import time
from pathlib import Path
from threading import Event

os.environ['APP_MODE'] = 'cloud'
os.environ['CLOUD_BACKEND_TOKEN'] = 'test-only-backend-token-' + 'x' * 40
from deployment.server import app
import app as core

import pytest


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client
    for job_id in list(core.download_jobs):
        core.remove_job(job_id)


HEADERS = {'X-Backend-Token': os.environ['CLOUD_BACKEND_TOKEN']}


def test_authentication_and_cloud_ui(client):
    assert client.get('/').status_code == 401
    assert client.post('/api/info', json={'url': 'https://youtu.be/example'}).status_code == 401
    response = client.get('/', headers=HEADERS)
    assert response.status_code == 200
    assert '繁星回憶（串流影音下載）' in response.text
    assert '系統開發者 段承志、杜杜龍 2026' not in response.text
    assert 'id="menu-toggle"' in response.text
    assert 'id="top-theme-toggle"' in response.text
    assert 'static/ui.js' in response.text
    assert '自由選擇畫質' not in response.text
    assert '下載時間取決於影片長度與網路速度' not in response.text
    assert '儲存到你的裝置' not in response.text
    assert 'open-wechat' not in response.text
    assert 'integration.js' not in response.text
    assert client.post('/api/integration/update', headers=HEADERS).status_code == 404


@pytest.mark.parametrize('payload', [None, [], {'url': None}, {'url': 123}, {'url': 'http://localhost/'}, {'url': 'https://youtube.com:22/a'}])
def test_invalid_urls_and_payloads(client, payload):
    assert client.post('/api/info', headers=HEADERS, json=payload).status_code == 400


def test_download_lifecycle_and_file_cleanup(client, monkeypatch, tmp_path):
    monkeypatch.setattr(core.shutil, 'which', lambda value: '/usr/bin/ffmpeg')
    monkeypatch.setattr(core.download_executor, 'submit', lambda *args: None)
    data = {'url': 'https://www.youtube.com/watch?v=abcdefghijk', 'type': 'video', 'quality': '720'}
    response = client.post('/api/download', headers=HEADERS, data=data)
    assert response.status_code == 202
    job_id = response.json['job_id']
    duplicate = client.post('/api/download', headers=HEADERS, data=data)
    assert duplicate.json['job_id'] == job_id
    other = dict(data, url='https://www.youtube.com/watch?v=lmnopqrstuv')
    assert client.post('/api/download', headers=HEADERS, data=other).status_code == 429
    assert client.get(f'/api/download/{job_id}/file', headers=HEADERS).status_code == 409
    job = core.download_jobs[job_id]
    result = Path(job['temp_dir']) / 'video.mp4'
    result.write_bytes(b'0123456789')
    core.update_job(job_id, status='finished', result=str(result), filename='測試.mp4')
    response = client.get(f'/api/download/{job_id}/file', headers={**HEADERS, 'Range': 'bytes=0-3'})
    assert response.status_code == 206
    assert response.data == b'0123'
    assert 'attachment' in response.headers['Content-Disposition']
    response.close()
    assert result.exists()  # A partial download must remain available for resume.
    job['updated_at'] = time.time() - core.JOB_TTL_SECONDS - 1
    job['active_transfers'] = 1
    core.cleanup_stale_jobs()
    assert result.exists()  # Never delete a file during transfer.
    job['active_transfers'] = 0
    core.cleanup_stale_jobs()
    assert not result.exists()
    assert job_id not in core.download_jobs


def test_cancel_marks_running_job(client, monkeypatch):
    monkeypatch.setattr(core.shutil, 'which', lambda value: '/usr/bin/ffmpeg')
    monkeypatch.setattr(core.download_executor, 'submit', lambda *args: None)
    response = client.post('/api/download', headers=HEADERS, data={
        'url': 'https://youtu.be/abcdefghijk', 'type': 'audio',
    })
    job_id = response.json['job_id']
    assert client.post(f'/api/download/{job_id}/cancel', headers=HEADERS).status_code == 202
    assert core.download_jobs[job_id]['cancel_event'].is_set()


def test_wechat_metadata_and_original_download(client, monkeypatch):
    monkeypatch.setattr(core.wechat, 'resolve', lambda url: {
        'id': 'AAes3OFGNS', 'title': '微信測試', 'channel': '作者',
        'url': 'https://finder.video.qq.com/example.mp4', 'ext': 'mp4',
    })
    url = 'https://weixin.qq.com/sph/AAes3OFGNS'
    metadata = client.post('/api/info', headers=HEADERS, json={'url': url})
    assert metadata.status_code == 200
    assert metadata.json['original_quality'] is True
    assert metadata.json['qualities'] == []
    assert 'url' not in metadata.json
    monkeypatch.setattr(core.shutil, 'which', lambda value: '/usr/bin/ffmpeg')
    monkeypatch.setattr(core.download_executor, 'submit', lambda *args: None)
    response = client.post('/api/download', headers=HEADERS, data={
        'url': url, 'type': 'video', 'quality': 'original',
    })
    assert response.status_code == 202
    assert client.post('/api/download', headers=HEADERS, data={
        'url': url, 'type': 'subtitle', 'subtitle': 'zh',
    }).status_code == 400
