"""Cloud deployment bootstrap helpers.

Desktop launches import app.py directly and therefore do not activate these
Cloudflare-container-specific resilience patches.
"""
from __future__ import annotations

import time
from urllib.parse import urlparse

import yt_dlp
from yt_dlp.utils import DownloadCancelled, DownloadError


_OriginalYoutubeDL = yt_dlp.YoutubeDL
_FACEBOOK_ACTIVE_STATUSES = {"queued", "downloading", "processing"}
_FACEBOOK_RETRY_MESSAGE = "Facebook 連線暫時不穩，正在重新解析影音來源並自動重試…"


def _is_facebook_url(value: str) -> bool:
    try:
        hostname = (urlparse(str(value)).hostname or "").lower().rstrip(".")
    except ValueError:
        return False
    return any(
        hostname == domain or hostname.endswith(f".{domain}")
        for domain in ("facebook.com", "fb.watch")
    )


def _should_retry_facebook_download(exc: DownloadError) -> bool:
    if isinstance(exc, DownloadCancelled):
        return False
    detail = str(exc)
    if "CLOUD_SIZE_LIMIT" in detail:
        return False
    return True


def _mark_facebook_retry(url: str, detail: str) -> None:
    """Keep the existing job alive while a fresh Facebook extraction is attempted."""
    try:
        import app as core
    except Exception:
        return

    now = time.time()
    with core.download_jobs_lock:
        for job in core.download_jobs.values():
            request_key = job.get("request_key") or ()
            if not request_key or request_key[0] != url:
                continue
            if job.get("status") not in _FACEBOOK_ACTIVE_STATUSES:
                continue
            job.update(
                status="downloading",
                progress=0,
                downloaded_bytes=0,
                total_bytes=0,
                speed=None,
                eta=None,
                error=None,
                message=_FACEBOOK_RETRY_MESSAGE,
                updated_at=now,
            )

    try:
        core.app.logger.warning(
            "Facebook download source expired/failed; re-extracting once: detail=%s",
            detail,
        )
    except Exception:
        pass


class FacebookRetryYoutubeDL(_OriginalYoutubeDL):
    """Re-extract Facebook once when the real media transfer fails.

    Metadata probing (download=False) is untouched. For an actual Facebook
    download, the first DownloadError triggers one brand-new YoutubeDL instance.
    That forces yt-dlp to fetch fresh Facebook media/CDN URLs while allowing its
    normal continued-download logic to reuse any safe partial file already on
    disk.
    """

    def extract_info(self, url, download=True, *args, **kwargs):
        try:
            return super().extract_info(url, download, *args, **kwargs)
        except DownloadError as exc:
            if not download or not _is_facebook_url(url) or not _should_retry_facebook_download(exc):
                raise

            _mark_facebook_retry(str(url), str(exc))
            time.sleep(0.75)

            # Use the unwrapped base class so this is exactly one retry, not a
            # recursive retry loop. A fresh instance also discards stale
            # extractor/CDN state from the failed first attempt.
            retry_params = dict(self.params)
            with _OriginalYoutubeDL(retry_params) as fresh_ydl:
                return fresh_ydl.extract_info(url, download, *args, **kwargs)


# app.py uses `from yt_dlp import YoutubeDL`; deployment.server imports this
# package first, so cloud mode receives the resilient class while desktop mode
# remains unchanged.
yt_dlp.YoutubeDL = FacebookRetryYoutubeDL
