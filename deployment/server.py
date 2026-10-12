"""Authenticated container entry point. Desktop launches continue using app.py."""
import hmac
import os
from threading import Event, Thread

os.environ['APP_MODE'] = 'cloud'
from flask import jsonify, request
from app import app, cleanup_stale_jobs, APP_VERSION
import wechat
import wechat_cloud

# Cloud-only selection policy. app.py imports the same wechat module object, so
# replacing the selector here affects only the container entry point and leaves
# the Windows/local launch path unchanged.
wechat._best_video = wechat_cloud.best_video

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
