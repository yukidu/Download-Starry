FROM denoland/deno:bin-2.6.8 AS deno
FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    APP_MODE=cloud \
    MAX_ACTIVE_JOBS=1 \
    MAX_DOWNLOAD_BYTES=536870912 \
    JOB_TTL_SECONDS=900

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 downloader
COPY --from=deno /deno /usr/local/bin/deno
WORKDIR /app
COPY requirements.txt ./
COPY deployment/requirements.txt deployment/requirements.txt
RUN pip install --no-cache-dir -r deployment/requirements.txt
COPY app.py wechat.py wechat_cloud.py facebook_gallery.py VERSION ./
COPY yt_dlp_plugins/ yt_dlp_plugins/
RUN python -c "import gallery_dl, facebook_gallery; from yt_dlp_plugins.extractor.dcard import DcardIE; from yt_dlp_plugins.extractor.ganjingworld import GanJingWorldIE; from yt_dlp_plugins.extractor.savevideo_redirects import SaveVideoShortRedirectIE; from yt_dlp_plugins.extractor.threads import ThreadsIE; from yt_dlp.extractor.lbry import LBRYIE; assert facebook_gallery.looks_like_photo_or_album_url('https://www.facebook.com/photo/?fbid=123'); assert GanJingWorldIE.suitable('https://www.ganjingworld.com/video/1f7srq4ett0373aCVOuRtTA1h1i61c'); assert LBRYIE.suitable('https://odysee.com/@demo:1/video:2')"
COPY deployment/server.py deployment/advanced.py deployment/advanced_server.py deployment/__init__.py deployment/
COPY templates/ templates/
COPY static/ static/
RUN mkdir /app/logs && chown downloader:downloader /app/logs
USER downloader
EXPOSE 8080
# Jobs live in process memory: use exactly ONE worker, with threaded HTTP handling.
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--threads", "8", "--timeout", "180", "--graceful-timeout", "30", "deployment.advanced_server:app"]
