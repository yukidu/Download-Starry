from __future__ import annotations
import json, os, secrets, subprocess, sys
from pathlib import Path
from urllib.parse import urlparse
import urllib.request
from flask import jsonify, request
from .components import Components, port_open

ROOT=Path(__file__).resolve().parents[1]
TOKEN=secrets.token_urlsafe(32)
components=Components(ROOT)

def helper_state():
    """Read only our helper status; token never leaves this process."""
    import re
    try:
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
        html=opener.open('http://127.0.0.1:5031/',timeout=2).read(200_000).decode()
        match=re.search(r'name="app-token" content="([^"]+)"',html)
        if not match:return None
        req=urllib.request.Request('http://127.0.0.1:5031/api/status',headers={'X-App-Token':match.group(1)})
        return json.load(opener.open(req,timeout=2))
    except Exception:return None

def launch_helper():
    status=helper_state()
    if status and not status.get('preview'):return
    if port_open(5031):raise ValueError('微信工具網址被其他程序或預覽占用，請先關閉該程序。')
    script=ROOT/'wechat-channels/launch.ps1'
    if not script.exists():raise ValueError('微信輔助程式不完整，請重新解壓完整攜帶版。')
    if os.name!='nt':raise ValueError('微信影音號輔助功能需要 Windows。')
    result=subprocess.run(['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',str(script),'-NoBrowser'],capture_output=True,timeout=90,creationflags=0x08000000)
    if result.returncode:raise ValueError('微信輔助工具未啟動。請允許管理員權限；也可從 wechat-channels 資料夾手動雙擊啟動。')
    import time
    for _ in range(50):
        if helper_state():return
        time.sleep(.2)
    raise ValueError('微信輔助工具未回應，請檢查管理員權限或手動啟動。')

def register(app, jobs, jobs_lock):
    @app.before_request
    def protect_integration():
        if not request.path.startswith('/api/integration/'):return
        if request.host.split(':')[0] not in {'127.0.0.1','localhost'}:return jsonify(error='無效的本機網址。'),403
        if request.headers.get('X-App-Token')!=TOKEN:return jsonify(error='請重新整理工具頁面。'),403
        if request.method=='POST' and request.headers.get('Origin') and urlparse(request.headers['Origin']).netloc!=request.host:return jsonify(error='禁止跨網站操作。'),403
    @app.get('/api/integration/components')
    def status():return jsonify(components.status())
    @app.post('/api/integration/check')
    def check():components.check();return jsonify(ok=True)
    @app.post('/api/integration/update')
    def update():
        with jobs_lock:
            if any(j['status'] not in {'finished','error','cancelled'} for j in jobs.values()):return jsonify(error='請先完成或停止主工具的下載，再更新元件。'),409
        try:
            ids=(request.get_json(silent=True) or {}).get('ids')
            if not isinstance(ids,list) or not all(isinstance(v,str) for v in ids):raise ValueError('元件清單格式不符。')
            components.update(ids);return jsonify(ok=True)
        except ValueError as e:return jsonify(error=str(e)),400
    @app.post('/api/integration/wechat')
    def wechat():
        if components.busy:return jsonify(error='元件更新進行中，請稍後再開啟微信工具。'),409
        try:launch_helper();return jsonify(url='http://127.0.0.1:5031/')
        except Exception as e:return jsonify(error=str(e)),400
