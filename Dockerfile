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
COPY app.py wechat.py wechat_cloud.py VERSION ./
COPY deployment/server.py deployment/__init__.py deployment/
COPY templates/ templates/
COPY static/ static/
RUN mkdir /app/logs && chown downloader:downloader /app/logs
USER downloader
EXPOSE 8080
# Jobs live in process memory: use exactly ONE worker, with threaded HTTP handling.
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--threads", "8", "--timeout", "180", "--graceful-timeout", "30", "deployment.server:app"]
