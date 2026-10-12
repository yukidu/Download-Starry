from __future__ import annotations

import os
import re
import shutil
import tempfile
import time
import uuid
import logging
from concurrent.futures import ThreadPoolExecutor
from logging.handlers import RotatingFileHandler
from pathlib import Path
from threading import Event, Lock
from urllib.parse import parse_qs, urlparse

from flask import Flask, jsonify, render_template, request, send_file
import wechat
try:
    from yt_dlp import YoutubeDL
    from yt_dlp.utils import DownloadCancelled, DownloadError
except ImportError:
    class DownloadError(Exception): pass
    class DownloadCancelled(DownloadError): pass
    class YoutubeDL:
        def __init__(self, *_args, **_kwargs):
            raise DownloadError("影片解析元件缺少或損壞，請使用「檢查元件」修復後重新啟動。")


app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024
CLOUD_MODE = os.environ.get("APP_MODE") == "cloud"
VERSION_FILE = Path(__file__).resolve().parent / "VERSION"
APP_VERSION = VERSION_FILE.read_text(encoding="utf-8").strip() if VERSION_FILE.exists() else "dev"


def configure_file_logging() -> Path:
    app_root = Path(__file__).resolve().parent
    log_dir = app_root / "logs"
    try:
        log_dir.mkdir(parents=True, exist_ok=True)
    except OSError:
        log_dir = Path(tempfile.gettempdir()) / "huanyu-video-downloader-logs"
        log_dir.mkdir(parents=True, exist_ok=True)

    log_path = log_dir / "downloader.log"
    handler = RotatingFileHandler(
        log_path, maxBytes=5 * 1024 * 1024, backupCount=5, encoding="utf-8"
    )
    handler.setFormatter(logging.Formatter(
        "[%(asctime)s] %(levelname)s %(name)s: %(message)s"
    ))
    handler.setLevel(logging.INFO)
    app.logger.addHandler(handler)
    app.logger.setLevel(logging.INFO)
    logging.getLogger("werkzeug").addHandler(handler)
    app.logger.info("Application logging started (Python %s)", os.sys.version.split()[0])
    return log_path


LOG_PATH = configure_file_logging()

DOWNLOAD_WORKERS = 1 if CLOUD_MODE else 2
MAX_ACTIVE_JOBS = int(os.environ.get("MAX_ACTIVE_JOBS", "1" if CLOUD_MODE else "4"))
MAX_DOWNLOAD_BYTES = int(os.environ.get("MAX_DOWNLOAD_BYTES", "536870912" if CLOUD_MODE else "0"))
JOB_TTL_SECONDS = int(os.environ.get("JOB_TTL_SECONDS", "900" if CLOUD_MODE else "3600"))
CLIENT_HEARTBEAT_TIMEOUT = 15
download_executor = ThreadPoolExecutor(max_workers=DOWNLOAD_WORKERS, thread_name_prefix="video-download")
download_jobs: dict[str, dict] = {}
download_jobs_lock = Lock()

SUPPORTED_HOSTS = {
    "YouTube": ("youtube.com", "youtu.be"),
    "Instagram": ("instagram.com",),
    "Facebook": ("facebook.com", "fb.watch"),
}


def platform_for_url(value: str) -> str | None:
    if wechat.share_id(value):
        return "WeChat"
    try:
        parsed = urlparse(value.strip())
        hostname = (parsed.hostname or "").lower().rstrip(".")
        if parsed.scheme not in {"http", "https"}:
            return None
        if parsed.username or parsed.password or parsed.port not in {None, 80, 443}:
            return None
        for platform, domains in SUPPORTED_HOSTS.items():
            if any(hostname == domain or hostname.endswith(f".{domain}") for domain in domains):
                return platform
    except ValueError:
        pass
    return None


def youtube_playlist_id(value: str) -> str | None:
    try:
        parsed = urlparse(value.strip())
        hostname = (parsed.hostname or "").lower().rstrip(".")
        if not (hostname == "youtube.com" or hostname.endswith(".youtube.com")):
            return None
        playlist_id = (parse_qs(parsed.query).get("list") or [""])[0]
        return playlist_id if re.fullmatch(r"[A-Za-z0-9_-]{10,80}", playlist_id) else None
    except ValueError:
        return None


def safe_title(value: str) -> str:
    value = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", value).strip(" .")
    return value[:120] or "video-download"


def subtitle_tracks(info: dict) -> list[dict]:
    tracks = []
    seen_languages = set()
    for automatic, source in (
        (False, info.get("subtitles") or {}),
        (True, info.get("automatic_captions") or {}),
    ):
        for language, formats in source.items():
            if language in seen_languages or language in {"live_chat", "live_chat_replay"}:
                continue
            formats = formats or []
            label = next((item.get("name") for item in formats if item.get("name")), language)
            tracks.append({"code": language, "label": label, "automatic": automatic})
            seen_languages.add(language)
    return sorted(tracks, key=lambda track: (track["automatic"], track["label"].casefold()))


def update_job(job_id: str, **changes) -> None:
    with download_jobs_lock:
        job = download_jobs.get(job_id)
        if job is not None:
            job.update(changes, updated_at=time.time())


def remove_job(job_id: str) -> None:
    with download_jobs_lock:
        job = download_jobs.pop(job_id, None)
    if job and job.get("temp_dir"):
        shutil.rmtree(job["temp_dir"], ignore_errors=True)


def cleanup_stale_jobs() -> None:
    cutoff = time.time() - JOB_TTL_SECONDS
    with download_jobs_lock:
        stale_ids = [
            job_id for job_id, job in download_jobs.items()
            if job["status"] in {"finished", "error", "cancelled"}
            and job["updated_at"] < cutoff and not job.get("active_transfers")
        ]
    for job_id in stale_ids:
        remove_job(job_id)


def download_worker(
    job_id: str,
    url: str,
    kind: str,
    quality: str,
    platform: str,
    subtitle_language: str | None,
) -> None:
    with download_jobs_lock:
        job = download_jobs.get(job_id)
        if job is None:
            return
        temp_dir = job["temp_dir"]
        cancel_event: Event = job["cancel_event"]

    output_template = str(Path(temp_dir) / "%(title).120s [%(id)s].%(ext)s")
    download_files: list[str] = []
    stream_sizes: dict[str, int] = {}

    def cancellation_requested() -> bool:
        with download_jobs_lock:
            current_job = download_jobs.get(job_id)
            client_timed_out = (
                current_job is not None
                and time.time() - current_job["last_seen"] > CLIENT_HEARTBEAT_TIMEOUT
            )
        return cancel_event.is_set() or client_timed_out

    def progress_hook(data: dict) -> None:
        if cancellation_requested():
            cancel_event.set()
            raise DownloadCancelled("下載已由使用者停止")

        status = data.get("status")
        if status == "downloading":
            downloaded = int(data.get("downloaded_bytes") or 0)
            total = int(data.get("total_bytes") or data.get("total_bytes_estimate") or 0)
            filename = str(data.get("filename") or "download")
            stream_sizes[filename] = downloaded
            if MAX_DOWNLOAD_BYTES and (
                sum(stream_sizes.values()) > MAX_DOWNLOAD_BYTES or total > MAX_DOWNLOAD_BYTES
            ):
                raise DownloadError("CLOUD_SIZE_LIMIT")
            if filename not in download_files:
                download_files.append(filename)

            info_dict = data.get("info_dict") or {}
            stream_count = len(info_dict.get("requested_formats") or []) or 1
            stream_index = download_files.index(filename)
            stream_progress = downloaded / total if total else 0
            overall_progress = ((stream_index + stream_progress) / max(stream_count, stream_index + 1)) * 95

            update_job(
                job_id,
                status="downloading",
                progress=round(min(overall_progress, 95), 1),
                downloaded_bytes=downloaded,
                total_bytes=total,
                speed=data.get("speed"),
                eta=data.get("eta"),
                message="正在下載字幕" if kind == "subtitle" else "正在下載影片資料",
            )
        elif status == "finished":
            update_job(
                job_id,
                status="processing",
                progress=96,
                speed=None,
                eta=None,
                message="下載完成，正在合併與轉檔",
            )

    def postprocessor_hook(data: dict) -> None:
        if cancellation_requested():
            cancel_event.set()
            raise DownloadCancelled("下載已由使用者停止")
        if data.get("status") in {"started", "processing"}:
            update_job(
                job_id,
                status="processing",
                progress=98,
                speed=None,
                eta=None,
                message="正在使用 FFmpeg 合併與轉檔",
            )

    options = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "outtmpl": output_template,
        "restrictfilenames": True,
        "continuedl": True,
        "retries": 15,
        "fragment_retries": 15,
        "extractor_retries": 5,
        "file_access_retries": 5,
        "socket_timeout": 30,
        "http_chunk_size": 4 * 1024 * 1024,
        "concurrent_fragment_downloads": 1,
        "max_filesize": MAX_DOWNLOAD_BYTES or None,
        "retry_sleep_functions": {
            "http": lambda attempt: min(2 ** attempt, 20),
            "fragment": lambda attempt: min(2 ** attempt, 20),
            "extractor": lambda attempt: min(2 ** attempt, 10),
        },
        "progress_hooks": [progress_hook],
        "postprocessor_hooks": [postprocessor_hook],
    }
    if kind == "subtitle":
        options.update({
            "skip_download": True,
            "writesubtitles": True,
            "writeautomaticsub": True,
            "subtitleslangs": [subtitle_language],
            "subtitlesformat": "srt/best",
            "postprocessors": [{
                "key": "FFmpegSubtitlesConvertor",
                "format": "srt",
            }],
        })
    elif kind == "audio":
        options.update({
            "format": "bestaudio/best",
            "postprocessors": [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }],
        })
    elif platform == "WeChat":
        options["format"] = "best"
    else:
        height = int(quality)
        options.update({
            "format": f"bestvideo[height<={height}]+bestaudio/best[height<={height}]",
            "merge_output_format": "mp4",
        })

    try:
        if cancellation_requested():
            cancel_event.set()
            raise DownloadCancelled("下載已由使用者停止")
        update_job(job_id, status="downloading", progress=0, message="正在連線至影片平台")
        with YoutubeDL(options) as ydl:
            if platform == "WeChat":
                info = ydl.process_ie_result(wechat.resolve(url), download=True)
            else:
                info = ydl.extract_info(url, download=True)
        if cancellation_requested():
            cancel_event.set()
            raise DownloadCancelled("下載已由使用者停止")

        expected_extension = {"audio": ".mp3", "subtitle": ".srt"}.get(kind, ".mp4")
        candidates = list(Path(temp_dir).glob(f"*{expected_extension}"))
        if not candidates:
            candidates = [
                path for path in Path(temp_dir).iterdir()
                if path.is_file() and path.suffix not in {".part", ".ytdl"}
            ]
        if not candidates:
            raise RuntimeError("output file missing")

        result = max(candidates, key=lambda path: path.stat().st_size)
        language_suffix = f" [{subtitle_language}]" if kind == "subtitle" else ""
        filename = f"{safe_title(info.get('title') or f'{platform}-download')}{language_suffix}{result.suffix}"
        update_job(
            job_id,
            status="finished",
            progress=100,
            downloaded_bytes=result.stat().st_size,
            total_bytes=result.stat().st_size,
            speed=None,
            eta=0,
            message="處理完成，準備儲存檔案",
            result=str(result),
            filename=filename,
        )
    except DownloadCancelled:
        shutil.rmtree(temp_dir, ignore_errors=True)
        update_job(
            job_id,
            status="cancelled",
            message="下載已停止，未完成的暫存檔已刪除",
            error=None,
            temp_dir=None,
            speed=None,
            eta=None,
        )
    except Exception as exc:
        error_detail = str(exc)
        if isinstance(exc, wechat.WeChatError):
            error_message = str(exc)
        elif "CLOUD_SIZE_LIMIT" in error_detail:
            error_message = "影片超過此服務的單次大小限制，請降低畫質或使用本機版"
        elif "RemoteDisconnected" in error_detail or "Connection aborted" in error_detail:
            error_message = "影片平台中斷連線，自動續傳與重試後仍未完成。請稍後再試或降低畫質"
        else:
            error_message = "下載失敗。請確認影片可公開播放且不需要登入，或稍後再試"
        app.logger.exception(
            "Download failed: job=%s platform=%s type=%s quality=%s subtitle=%s",
            job_id, platform, kind, quality, subtitle_language or "-",
        )
        shutil.rmtree(temp_dir, ignore_errors=True)
        update_job(
            job_id,
            status="error",
            message=error_message,
            error=error_message,
            temp_dir=None,
            speed=None,
            eta=None,
        )


@app.get("/")
def index():
    return render_template("index.html", app_version=APP_VERSION, integration_token=integration_token, cloud_mode=CLOUD_MODE)


@app.post("/api/info")
def video_info():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or not isinstance(payload.get("url"), str):
        return jsonify(error="影片網址格式無效"), 400
    url = payload["url"].strip()
    platform = platform_for_url(url)
    if not platform:
        return jsonify(error="請輸入有效的 YouTube、Instagram、Facebook 或微信視頻號分享網址"), 400

    try:
        with YoutubeDL({"quiet": True, "no_warnings": True, "noplaylist": True}) as ydl:
            info = wechat.resolve(url) if platform == "WeChat" else ydl.extract_info(url, download=False)
    except wechat.WeChatError as exc:
        return jsonify(error=str(exc)), 422
    except DownloadError as exc:
        app.logger.warning("Metadata failed: platform=%s detail=%s", platform, exc)
        if platform == "Instagram" and "empty media response" in str(exc).lower():
            return jsonify(error="Instagram 解析元件需要更新。請關閉程式並重新執行 start.bat；若更新後仍失敗，該內容可能需要登入"), 422
        return jsonify(error="無法讀取影片。內容可能設為私人、需要登入、受地區限制或網址無效"), 422

    heights = sorted({
        int(f["height"]) for f in info.get("formats", [])
        if f.get("height") and f.get("vcodec") != "none"
    }, reverse=True)
    qualities = [h for h in heights if h <= 4320]
    playlist = None
    playlist_id = youtube_playlist_id(url)
    if playlist_id:
        try:
            with YoutubeDL({
                "quiet": True,
                "no_warnings": True,
                "extract_flat": True,
                "skip_download": True,
                "ignoreerrors": True,
            }) as ydl:
                playlist_info = ydl.extract_info(
                    f"https://www.youtube.com/playlist?list={playlist_id}", download=False
                )
            entries = []
            for entry in playlist_info.get("entries", []) if playlist_info else []:
                if not entry:
                    continue
                video_id = entry.get("id")
                entry_url = entry.get("webpage_url")
                if not entry_url and video_id and re.fullmatch(r"[A-Za-z0-9_-]{6,20}", video_id):
                    entry_url = f"https://www.youtube.com/watch?v={video_id}"
                if entry_url and platform_for_url(entry_url) == "YouTube":
                    entries.append({
                        "url": entry_url,
                        "title": entry.get("title") or "未命名影片",
                    })
            if len(entries) > 1:
                playlist = {
                    "id": playlist_id,
                    "title": playlist_info.get("title") or "YouTube 播放清單",
                    "count": len(entries),
                    "entries": entries,
                }
        except DownloadError as exc:
            app.logger.warning("Playlist metadata failed: detail=%s", exc)

    return jsonify({
        "title": info.get("title") or "未命名影片",
        "thumbnail": info.get("thumbnail"),
        "duration": info.get("duration"),
        "channel": info.get("channel") or info.get("uploader") or platform,
        "platform": platform,
        "qualities": qualities,
        "original_quality": platform == "WeChat",
        "subtitles": subtitle_tracks(info),
        "playlist": playlist,
    })


@app.post("/api/download")
def download():
    cleanup_stale_jobs()
    data = request.form
    url = data.get("url", "").strip()
    kind = data.get("type", "video")
    quality = data.get("quality", "720")
    subtitle_language = data.get("subtitle", "").strip()

    platform = platform_for_url(url)
    if not platform or kind not in {"video", "audio", "subtitle"}:
        return jsonify(error="下載參數無效"), 400
    if platform == "WeChat" and kind == "subtitle":
        return jsonify(error="微信視頻號未提供可下載字幕"), 400
    if kind == "video" and not (platform == "WeChat" and quality == "original") and (not quality.isdigit() or not 144 <= int(quality) <= 4320):
        return jsonify(error="畫質選項無效"), 400
    if kind == "subtitle" and not re.fullmatch(r"[A-Za-z0-9._@-]{1,64}", subtitle_language):
        return jsonify(error="字幕語言選項無效"), 400
    if shutil.which("ffmpeg") is None:
        return jsonify(error="系統尚未安裝 FFmpeg，請先依 README 完成安裝"), 503
    if CLOUD_MODE and shutil.disk_usage(tempfile.gettempdir()).free < 2 * MAX_DOWNLOAD_BYTES + 512 * 1024 * 1024:
        return jsonify(error="暫存空間不足，請稍後重試或降低畫質"), 507

    request_key = (url, kind, quality, subtitle_language)
    temp_dir = tempfile.mkdtemp(prefix="video_web_")
    job_id = uuid.uuid4().hex
    now = time.time()
    with download_jobs_lock:
        existing_job_id = next((
            existing_id for existing_id, existing_job in download_jobs.items()
            if existing_job.get("request_key") == request_key
            and existing_job["status"] in {"queued", "downloading", "processing"}
        ), None)
        active_count = sum(job["status"] not in {"finished", "error", "cancelled"} for job in download_jobs.values())
        if existing_job_id is None and active_count >= MAX_ACTIVE_JOBS:
            shutil.rmtree(temp_dir, ignore_errors=True)
            return jsonify(error="目前有影片正在處理，請完成或停止後再試"), 429
        if existing_job_id is None:
            download_jobs[job_id] = {
                "status": "queued",
                "progress": 0,
                "downloaded_bytes": 0,
                "total_bytes": 0,
                "speed": None,
                "eta": None,
                "message": "等待開始下載",
                "error": None,
                "result": None,
                "filename": None,
                "temp_dir": temp_dir,
                "cancel_event": Event(),
                "request_key": request_key,
                "last_seen": now,
                "created_at": now,
                "updated_at": now,
            }

    if existing_job_id is not None:
        shutil.rmtree(temp_dir, ignore_errors=True)
        return jsonify(job_id=existing_job_id, reused=True), 202

    try:
        download_executor.submit(
            download_worker, job_id, url, kind, quality, platform, subtitle_language or None
        )
    except RuntimeError:
        remove_job(job_id)
        return jsonify(error="目前無法建立下載工作，請重新啟動程式後再試"), 503

    return jsonify(job_id=job_id), 202


@app.get("/api/download/<job_id>/progress")
def download_progress(job_id: str):
    cleanup_stale_jobs()
    with download_jobs_lock:
        job = download_jobs.get(job_id)
        if job is None:
            return jsonify(error="找不到下載工作，可能已逾時或完成"), 404
        job["last_seen"] = time.time()
        snapshot = {
            "status": job["status"],
            "progress": job["progress"],
            "downloaded_bytes": job["downloaded_bytes"],
            "total_bytes": job["total_bytes"],
            "speed": job["speed"],
            "eta": job["eta"],
            "message": job["message"],
            "error": job["error"],
            "filename": job["filename"],
        }
    return jsonify(snapshot)


@app.post("/api/download/<job_id>/cancel")
def cancel_download(job_id: str):
    with download_jobs_lock:
        job = download_jobs.get(job_id)
        if job is None:
            return jsonify(error="找不到下載工作，可能已經結束"), 404
        if job["status"] in {"finished", "error", "cancelled"}:
            return jsonify(status=job["status"], message=job["message"]), 200
        job["cancel_event"].set()
        job.update(
            status="cancelling",
            message="正在停止下載",
            speed=None,
            eta=None,
            updated_at=time.time(),
        )
    return jsonify(status="cancelling", message="正在停止下載"), 202


@app.get("/api/download/<job_id>/file")
def download_file(job_id: str):
    with download_jobs_lock:
        job = download_jobs.get(job_id)
        if job is None:
            return jsonify(error="找不到下載檔案，可能已逾時"), 404
        if job["status"] != "finished":
            return jsonify(error="影片仍在處理中"), 409
        result = job["result"]
        filename = job["filename"]

    if not result or not Path(result).is_file():
        remove_job(job_id)
        return jsonify(error="下載檔案不存在，請重新下載"), 410

    # Track the iterable's lifetime, including WSGI file-wrapper responses.
    # Keep cloud files briefly for HTTP Range retries; a periodic sweep removes them.
    response = send_file(result, as_attachment=True, download_name=filename, max_age=0)
    with download_jobs_lock:
        current = download_jobs.get(job_id)
        if current:
            current["active_transfers"] = current.get("active_transfers", 0) + 1

    def transfer_closed():
        if not CLOUD_MODE:
            remove_job(job_id)
            return
        with download_jobs_lock:
            current = download_jobs.get(job_id)
            if current:
                current["active_transfers"] = max(0, current.get("active_transfers", 1) - 1)
                current["updated_at"] = time.time() - JOB_TTL_SECONDS + 120

    from werkzeug.wsgi import ClosingIterator
    response.response = ClosingIterator(response.response, transfer_closed)
    return response


@app.errorhandler(413)
def too_large(_error):
    return jsonify(error="請求內容過大"), 413


integration_token = ""
if not CLOUD_MODE:
    from integration.routes import register as register_integration, TOKEN as integration_token
    register_integration(app, download_jobs, download_jobs_lock)

if __name__ == "__main__":
    app.logger.info(
        "Web server starting at http://127.0.0.1:%s; log=%s",
        os.environ.get("PORT", 5000), LOG_PATH,
    )
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", 5000)), debug=False)
