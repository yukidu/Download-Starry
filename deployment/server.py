"""Authenticated container entry point. Desktop launches continue using app.py."""
import hmac
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Event, Lock, Thread
from urllib.parse import quote

os.environ['APP_MODE'] = 'cloud'
from flask import jsonify, request
import opencc
from app import (
    APP_VERSION,
    app,
    cleanup_stale_jobs,
    download_jobs,
    download_jobs_lock,
    platform_for_url,
)
import wechat
import wechat_cloud

# Cloud-only selection policy. app.py imports the same wechat module object, so
# replacing the selector here affects only the real container entry point. During
# pytest we leave the base module untouched; wechat_cloud.best_video has its own
# isolated regression tests and this prevents test-order pollution.
if 'pytest' not in sys.modules:
    wechat._best_video = wechat_cloud.best_video

backend_token = os.environ.get('CLOUD_BACKEND_TOKEN', '')
if len(backend_token) < 32:
    raise RuntimeError('CLOUD_BACKEND_TOKEN must be configured before serving cloud traffic')

TAIPEI_TZ = timezone(timedelta(hours=8))
TITLE_CONVERTER = opencc.OpenCC('s2twp')
INVALID_FILENAME_CHARS = re.compile(r'[\\/:*?"<>|\x00-\x1f]')
MULTISPACE = re.compile(r'\s+')
CJK_CHAR = re.compile(r'[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]')
SOURCE_LABELS = {
    'WeChat': '微信',
    'YouTube': 'YouTube',
    'Facebook': 'Facebook',
    'Instagram': 'Instagram',
}
GENERIC_TITLES = {
    '',
    '未命名影片',
    'video-download',
    'audio-download',
    'download',
}
TITLE_FIRST_STYLE = """
<style id="savevideo-title-first-layout">
#result .media-card {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  grid-template-areas:
    "title title"
    "thumb meta";
  column-gap: 19px;
  row-gap: 12px;
}
#result .media-card .thumb-wrap {
  grid-area: thumb;
}
#result .media-card .media-meta {
  display: contents;
}
#result .media-card .media-meta h2 {
  grid-area: title;
  margin: 0;
  color: var(--ink);
  font: 800 20px/1.5 "Noto Sans TC", sans-serif;
  display: block;
  overflow: visible;
  -webkit-line-clamp: unset;
  -webkit-box-orient: initial;
}
#result .media-card .media-meta > span {
  grid-area: meta;
  align-self: center;
}
@media (max-width: 700px) {
  #result .media-card {
    display: grid;
    grid-template-columns: 1fr;
    grid-template-areas:
      "title"
      "thumb"
      "meta";
    row-gap: 10px;
  }
  #result .media-card .thumb-wrap {
    width: 100%;
    margin-bottom: 0;
  }
  #result .media-card .media-meta h2 {
    font-size: 18px;
  }
  #result .media-card .media-meta > span {
    padding-top: 2px;
  }
}
</style>
"""

_metadata_cache: dict[str, dict] = {}
_metadata_lock = Lock()
_download_contexts: dict[str, dict] = {}
_download_contexts_lock = Lock()
_filename_registry: dict[tuple[str, str, str, str, str], dict] = {}
_filename_registry_lock = Lock()
_job_filename_cache: dict[str, str] = {}
_job_filename_cache_lock = Lock()


def traditionalize_title(value: str | None) -> str:
    text = MULTISPACE.sub(' ', str(value or '')).strip()
    if not text:
        return ''
    return TITLE_CONVERTER.convert(text)


def source_label(platform: str | None) -> str:
    value = traditionalize_title(platform or '影音')
    value = SOURCE_LABELS.get(platform or '', value)
    value = INVALID_FILENAME_CHARS.sub('', value)
    value = MULTISPACE.sub(' ', value).strip(' .')
    return value or '影音'


def normalize_title_for_filename(value: str | None) -> str:
    title = traditionalize_title(value)
    title = INVALID_FILENAME_CHARS.sub('', title)
    title = MULTISPACE.sub(' ', title).strip(' .')
    if not title:
        return ''

    output: list[str] = []
    cjk_count = 0
    for char in title:
        if len(output) >= 30:
            break
        if CJK_CHAR.fullmatch(char):
            if cjk_count >= 20:
                break
            cjk_count += 1
        output.append(char)
    return ''.join(output).rstrip(' .')


def _is_missing_title(title: str, platform: str) -> bool:
    folded = title.casefold()
    platform_download = f'{platform}-download'.casefold()
    return folded in {item.casefold() for item in GENERIC_TITLES} or folded == platform_download


def reset_filename_registry_for_tests() -> None:
    with _filename_registry_lock:
        _filename_registry.clear()


def build_download_filename(
    platform: str | None,
    title: str | None,
    kind: str,
    extension: str,
    now: datetime | None = None,
) -> str:
    now = now or datetime.now(TAIPEI_TZ)
    if now.tzinfo is None:
        now = now.replace(tzinfo=TAIPEI_TZ)
    else:
        now = now.astimezone(TAIPEI_TZ)

    extension = extension if extension.startswith('.') else f'.{extension}'
    source = source_label(platform)
    cleaned_title = normalize_title_for_filename(title)
    if _is_missing_title(cleaned_title, platform or ''):
        cleaned_title = ''

    date_text = now.strftime('%Y%m%d')
    minute_text = now.strftime('%Y%m%d%H%M')
    media_label = '音檔' if kind == 'audio' else '影片'
    registry_title = cleaned_title or media_label
    key = (date_text, source, registry_title, kind, extension.lower())

    with _filename_registry_lock:
        state = _filename_registry.setdefault(key, {'count': 0, 'minutes': {}})
        count = int(state['count'])
        state['count'] = count + 1

        if count == 0:
            if cleaned_title:
                return f'{date_text}_{source}_{cleaned_title}_download.starry.phd{extension}'
            return f'{source}{media_label}_{date_text}{extension}'

        minute_count = int(state['minutes'].get(minute_text, 0))
        state['minutes'][minute_text] = minute_count + 1
        sequence = f'_{minute_count:02d}' if minute_count else ''
        if cleaned_title:
            return f'{minute_text}_{source}_{cleaned_title}_download.starry.phd{sequence}{extension}'
        return f'{source}{media_label}_{minute_text}{sequence}{extension}'


def _remember_metadata(url: str, payload: dict) -> None:
    title = traditionalize_title(payload.get('title'))
    platform = payload.get('platform') or platform_for_url(url)
    with _metadata_lock:
        _metadata_cache[url] = {'title': title, 'platform': platform}
        if len(_metadata_cache) > 2048:
            _metadata_cache.pop(next(iter(_metadata_cache)))


def _remember_download_context(job_id: str, url: str, kind: str) -> None:
    with _metadata_lock:
        metadata = dict(_metadata_cache.get(url) or {})
    context = {
        'url': url,
        'kind': kind,
        'title': metadata.get('title') or '',
        'platform': metadata.get('platform') or platform_for_url(url),
    }
    with _download_contexts_lock:
        _download_contexts.setdefault(job_id, context)
        if len(_download_contexts) > 4096:
            _download_contexts.pop(next(iter(_download_contexts)))


def _job_context(job_id: str) -> tuple[dict, dict]:
    with _download_contexts_lock:
        context = dict(_download_contexts.get(job_id) or {})
    with download_jobs_lock:
        job = dict(download_jobs.get(job_id) or {})

    request_key = job.get('request_key') or ()
    if not context.get('url') and len(request_key) >= 1:
        context['url'] = request_key[0]
    if not context.get('kind') and len(request_key) >= 2:
        context['kind'] = request_key[1]
    if not context.get('platform') and context.get('url'):
        context['platform'] = platform_for_url(context['url'])
    if not context.get('title'):
        original_name = str(job.get('filename') or '')
        if original_name:
            context['title'] = Path(original_name).stem
    return context, job


def desired_job_filename(job_id: str) -> str | None:
    with _job_filename_cache_lock:
        existing = _job_filename_cache.get(job_id)
    if existing:
        return existing

    context, job = _job_context(job_id)
    kind = str(context.get('kind') or '')
    if kind not in {'video', 'audio'}:
        return None

    result = str(job.get('result') or '')
    result_suffix = Path(result).suffix if result else ''
    extension = '.mp3' if kind == 'audio' else (result_suffix or '.mp4')
    if kind == 'video' and extension.lower() not in {'.mp4', '.mov', '.m4v', '.webm', '.mkv'}:
        extension = '.mp4'

    filename = build_download_filename(
        context.get('platform'),
        context.get('title'),
        kind,
        extension,
    )
    with _job_filename_cache_lock:
        _job_filename_cache[job_id] = filename
        if len(_job_filename_cache) > 4096:
            _job_filename_cache.pop(next(iter(_job_filename_cache)))
    return filename


def _rewrite_json_response(response, payload: dict):
    response.set_data(app.json.dumps(payload))
    response.content_type = 'application/json; charset=utf-8'
    return response


def _job_id_from_path(path: str) -> str | None:
    match = re.fullmatch(r'/api/download/([0-9a-f]{32})/(?:progress|file)', path)
    return match.group(1) if match else None


@app.before_request
def authenticate_backend():
    supplied = request.headers.get('X-Backend-Token', '')
    if not hmac.compare_digest(supplied.encode(), backend_token.encode()):
        return jsonify(error='需要登入才能使用此服務'), 401
    if request.path.startswith('/api/integration/'):
        return jsonify(error='此功能僅供 Windows 本機版使用'), 404


@app.after_request
def apply_title_and_filename_rules(response):
    if response.status_code >= 400:
        return response

    if request.path == '/' and response.mimetype == 'text/html':
        html = response.get_data(as_text=True)
        if 'savevideo-title-first-layout' not in html and '</head>' in html:
            response.set_data(html.replace('</head>', f'{TITLE_FIRST_STYLE}</head>', 1))
        return response

    if request.path == '/api/info' and response.is_json:
        payload = response.get_json(silent=True)
        if isinstance(payload, dict) and payload.get('title'):
            payload['title'] = traditionalize_title(payload.get('title'))
            playlist = payload.get('playlist')
            if isinstance(playlist, dict):
                if playlist.get('title'):
                    playlist['title'] = traditionalize_title(playlist.get('title'))
                for entry in playlist.get('entries') or []:
                    if isinstance(entry, dict) and entry.get('title'):
                        entry['title'] = traditionalize_title(entry.get('title'))
            request_payload = request.get_json(silent=True) or {}
            url = str(request_payload.get('url') or '').strip()
            if url:
                _remember_metadata(url, payload)
            return _rewrite_json_response(response, payload)
        return response

    if request.path == '/api/download' and response.is_json:
        payload = response.get_json(silent=True)
        if isinstance(payload, dict) and payload.get('job_id'):
            url = str(request.form.get('url') or '').strip()
            kind = str(request.form.get('type') or 'video').strip()
            if url and kind in {'video', 'audio'}:
                _remember_download_context(str(payload['job_id']), url, kind)
        return response

    job_id = _job_id_from_path(request.path)
    if not job_id:
        return response

    if request.path.endswith('/progress') and response.is_json:
        payload = response.get_json(silent=True)
        if isinstance(payload, dict) and payload.get('status') == 'finished':
            filename = desired_job_filename(job_id)
            if filename:
                payload['filename'] = filename
                return _rewrite_json_response(response, payload)
        return response

    if request.path.endswith('/file'):
        filename = desired_job_filename(job_id)
        if filename:
            encoded = quote(filename, safe='')
            response.headers['Content-Disposition'] = (
                f'attachment; filename="download{Path(filename).suffix}"; '
                f"filename*=UTF-8''{encoded}"
            )
    return response


@app.get('/api/health')
def health():
    return jsonify(ok=True, version=APP_VERSION, mode='cloud')


def sweep():
    timer = Event()
    while not timer.wait(30):
        cleanup_stale_jobs()


Thread(target=sweep, name='temporary-file-cleanup', daemon=True).start()
