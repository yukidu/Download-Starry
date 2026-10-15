"""Member-only advanced preview and trim jobs for the cloud container."""
from __future__ import annotations

import shutil
import subprocess
import tempfile
import time
import uuid
from pathlib import Path
from threading import Event

from flask import jsonify, request, send_file
from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadCancelled, DownloadError

from app import (
    MAX_ACTIVE_JOBS,
    MAX_DOWNLOAD_BYTES,
    ORIGINAL_VIDEO_PLATFORMS,
    app,
    cleanup_stale_jobs,
    download_executor,
    download_jobs,
    download_jobs_lock,
    platform_for_url,
    remove_job,
    safe_title,
    update_job,
)


def _cancelled(job_id: str) -> bool:
    with download_jobs_lock:
        job = download_jobs.get(job_id)
        return not job or job.get("cancel_event").is_set()


def _advanced_worker(
    job_id: str,
    url: str,
    mode: str,
    quality: str,
    platform: str,
    trim_start: float,
    trim_end: float,
) -> None:
    with download_jobs_lock:
        job = download_jobs.get(job_id)
        if not job:
            return
        temp_dir = job["temp_dir"]

    output_template = str(Path(temp_dir) / "source.%(ext)s")
    stream_sizes: dict[str, int] = {}

    def progress_hook(data: dict) -> None:
        if _cancelled(job_id):
            raise DownloadCancelled("進階處理已停止")
        if data.get("status") == "downloading":
            downloaded = int(data.get("downloaded_bytes") or 0)
            total = int(data.get("total_bytes") or data.get("total_bytes_estimate") or 0)
            filename = str(data.get("filename") or "source")
            stream_sizes[filename] = downloaded
            if MAX_DOWNLOAD_BYTES and (sum(stream_sizes.values()) > MAX_DOWNLOAD_BYTES or total > MAX_DOWNLOAD_BYTES):
                raise DownloadError("CLOUD_SIZE_LIMIT")
            percent = 70 if mode == "trim" else 92
            ratio = (downloaded / total) if total else 0
            update_job(
                job_id,
                status="downloading",
                progress=round(min(percent, ratio * percent), 1),
                downloaded_bytes=downloaded,
                total_bytes=total,
                speed=data.get("speed"),
                eta=data.get("eta"),
                message="正在準備低流量預覽" if mode == "preview" else "正在下載裁切來源",
            )
        elif data.get("status") == "finished":
            update_job(
                job_id,
                status="processing",
                progress=94 if mode == "preview" else 72,
                speed=None,
                eta=None,
                message="正在整理預覽" if mode == "preview" else "下載完成，準備裁切",
            )

    options = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "outtmpl": output_template,
        "restrictfilenames": True,
        "continuedl": True,
        "retries": 12,
        "fragment_retries": 12,
        "extractor_retries": 4,
        "socket_timeout": 30,
        "concurrent_fragment_downloads": 1,
        "max_filesize": MAX_DOWNLOAD_BYTES or None,
        "progress_hooks": [progress_hook],
    }

    if mode == "preview":
        options.update({
            "format": "bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best[height<=360]/worst",
            "merge_output_format": "mp4",
        })
    elif platform in ORIGINAL_VIDEO_PLATFORMS or quality == "original":
        options["format"] = "best"
    elif quality == "best":
        options.update({
            "format": "bestvideo+bestaudio/best",
            "merge_output_format": "mp4",
        })
    else:
        try:
            height = min(4320, max(144, int(quality)))
        except (TypeError, ValueError):
            height = 1080
        options.update({
            "format": f"bestvideo[height<={height}]+bestaudio/best[height<={height}]",
            "merge_output_format": "mp4",
        })

    try:
        if _cancelled(job_id):
            raise DownloadCancelled("進階處理已停止")
        update_job(job_id, status="downloading", progress=0, message="正在連線至影片平台")
        with YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=True)

        candidates = [
            path for path in Path(temp_dir).iterdir()
            if path.is_file() and path.suffix.lower() not in {".part", ".ytdl"}
        ]
        if not candidates:
            raise RuntimeError("output file missing")
        source = max(candidates, key=lambda path: path.stat().st_size)
        title = safe_title((info or {}).get("title") or f"{platform}-video")

        if mode == "preview":
            result = source
            filename = f"{title}-preview{result.suffix or '.mp4'}"
            update_job(
                job_id,
                status="finished",
                progress=100,
                downloaded_bytes=result.stat().st_size,
                total_bytes=result.stat().st_size,
                speed=None,
                eta=0,
                message="預覽已準備完成",
                result=str(result),
                filename=filename,
            )
            return

        if _cancelled(job_id):
            raise DownloadCancelled("進階處理已停止")
        duration = max(0.5, trim_end - trim_start)
        result = Path(temp_dir) / "trimmed.mp4"
        update_job(job_id, status="processing", progress=78, message="正在精準裁切影片")
        command = [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-ss", f"{trim_start:.3f}", "-i", str(source), "-t", f"{duration:.3f}",
            "-map", "0:v:0?", "-map", "0:a:0?",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
            "-c:a", "aac", "-b:a", "160k",
            "-movflags", "+faststart", str(result),
        ]
        subprocess.run(command, check=True, timeout=420)
        if not result.is_file() or result.stat().st_size <= 0:
            raise RuntimeError("trim output missing")
        source.unlink(missing_ok=True)
        filename = f"{title}_{trim_start:.1f}-{trim_end:.1f}s.mp4"
        update_job(
            job_id,
            status="finished",
            progress=100,
            downloaded_bytes=result.stat().st_size,
            total_bytes=result.stat().st_size,
            speed=None,
            eta=0,
            message="裁切完成",
            result=str(result),
            filename=filename,
        )
    except DownloadCancelled:
        shutil.rmtree(temp_dir, ignore_errors=True)
        update_job(job_id, status="cancelled", progress=0, message="已停止進階處理", error=None, temp_dir=None)
    except Exception as exc:
        detail = str(exc)
        if "CLOUD_SIZE_LIMIT" in detail:
            message = "檔案超過單次處理大小限制，請縮短內容或改用較短影片"
        elif isinstance(exc, subprocess.TimeoutExpired):
            message = "裁切時間較長，處理逾時，請縮短裁切範圍後再試"
        else:
            message = "進階影片處理失敗，請稍後再試或改用一般下載"
        app.logger.exception("Advanced media job failed: job=%s mode=%s platform=%s", job_id, mode, platform)
        shutil.rmtree(temp_dir, ignore_errors=True)
        update_job(job_id, status="error", message=message, error=message, temp_dir=None, speed=None, eta=None)


@app.post("/api/advanced/download")
def advanced_download():
    cleanup_stale_jobs()
    data = request.form
    url = str(data.get("url") or "").strip()
    mode = str(data.get("mode") or "preview").strip()
    quality = str(data.get("quality") or "best").strip()
    platform = platform_for_url(url)
    if not platform:
        return jsonify(error="請先解析支援平台的影片網址"), 400
    if platform == "WeChat":
        return jsonify(error="微信影音號目前暫不支援即時裁切預覽"), 400
    if mode not in {"preview", "trim"}:
        return jsonify(error="進階處理模式無效"), 400

    trim_start = 0.0
    trim_end = 0.0
    if mode == "trim":
        try:
            trim_start = max(0.0, float(data.get("start") or 0))
            trim_end = max(0.0, float(data.get("end") or 0))
        except (TypeError, ValueError):
            return jsonify(error="裁切時間格式不正確"), 400
        if trim_end <= trim_start or trim_end - trim_start < 0.5:
            return jsonify(error="結束時間必須晚於開始時間"), 400
        if trim_end - trim_start > 6 * 60 * 60:
            return jsonify(error="單次裁切長度最多 6 小時"), 400

    request_key = ("advanced", mode, url, quality, round(trim_start, 3), round(trim_end, 3))
    temp_dir = tempfile.mkdtemp(prefix="downloadstarry_advanced_")
    job_id = uuid.uuid4().hex
    now = time.time()
    with download_jobs_lock:
        existing_job_id = next((
            existing_id for existing_id, existing in download_jobs.items()
            if existing.get("request_key") == request_key and existing.get("status") in {"queued", "downloading", "processing"}
        ), None)
        active_count = sum(job.get("status") not in {"finished", "error", "cancelled"} for job in download_jobs.values())
        if existing_job_id is None and active_count >= MAX_ACTIVE_JOBS:
            shutil.rmtree(temp_dir, ignore_errors=True)
            return jsonify(error="目前有檔案正在處理，請完成或停止後再試"), 429
        if existing_job_id is None:
            download_jobs[job_id] = {
                "status": "queued",
                "progress": 0,
                "downloaded_bytes": 0,
                "total_bytes": 0,
                "speed": None,
                "eta": None,
                "message": "等待開始進階處理",
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
            _advanced_worker, job_id, url, mode, quality, platform, trim_start, trim_end
        )
    except RuntimeError:
        remove_job(job_id)
        return jsonify(error="目前無法建立進階處理工作，請稍後再試"), 503
    return jsonify(job_id=job_id), 202


@app.get("/api/advanced/file/<job_id>")
def advanced_file(job_id: str):
    with download_jobs_lock:
        job = download_jobs.get(job_id)
        if not job:
            return jsonify(error="找不到進階處理檔案，可能已逾時"), 404
        if job.get("status") != "finished":
            return jsonify(error="檔案仍在處理中"), 409
        result = str(job.get("result") or "")
        filename = str(job.get("filename") or "video.mp4")
        job["last_seen"] = time.time()
        job["updated_at"] = time.time()
    if not result or not Path(result).is_file():
        remove_job(job_id)
        return jsonify(error="進階處理檔案不存在，請重新操作"), 410
    as_attachment = request.args.get("download") == "1"
    return send_file(
        result,
        as_attachment=as_attachment,
        download_name=filename,
        max_age=0,
        conditional=True,
    )
