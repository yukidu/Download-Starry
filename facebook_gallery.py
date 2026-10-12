from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import parse_qs, urlparse


IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"}
FACEBOOK_HOSTS = ("facebook.com", "fb.watch")


class FacebookGalleryError(RuntimeError):
    pass


class FacebookGalleryCancelled(FacebookGalleryError):
    pass


def _is_facebook_host(hostname: str) -> bool:
    hostname = hostname.lower().rstrip(".")
    return any(hostname == domain or hostname.endswith(f".{domain}") for domain in FACEBOOK_HOSTS)


def _parsed_url(value: str):
    try:
        parsed = urlparse(value.strip())
    except ValueError:
        return None
    if parsed.scheme not in {"http", "https"} or not _is_facebook_host(parsed.hostname or ""):
        return None
    if parsed.username or parsed.password or parsed.port not in {None, 80, 443}:
        return None
    return parsed


def looks_like_photo_or_album_url(value: str) -> bool:
    """Match URL shapes that explicitly address a Facebook photo/post/album."""
    parsed = _parsed_url(value)
    if parsed is None or (parsed.hostname or "").lower().endswith("fb.watch"):
        return False

    path = parsed.path.lower().rstrip("/")
    query = parse_qs(parsed.query)
    if any(marker in path for marker in ("/reel", "/videos/", "/watch/", "/share/v/")):
        return False
    if path.startswith("/photo") or "/photos/" in path or path.startswith("/media/set"):
        return True
    if path.startswith("/share/p/") or "/posts/" in path:
        return True
    return bool(query.get("fbid") or query.get("set"))


def may_contain_photos_url(value: str) -> bool:
    """Allow explicit photo URLs and Facebook's public share-post URLs only.

    Profiles are intentionally excluded so image mode cannot become an
    unbounded profile scraper.
    """
    parsed = _parsed_url(value)
    if parsed is None or (parsed.hostname or "").lower().endswith("fb.watch"):
        return False
    path = parsed.path.lower().rstrip("/")
    if any(marker in path for marker in ("/reel", "/videos/", "/watch/", "/share/v/")):
        return False
    return looks_like_photo_or_album_url(value) or path.startswith("/share/")


def _is_album_url(value: str) -> bool:
    parsed = _parsed_url(value)
    if parsed is None:
        return False
    path = parsed.path.lower()
    query = parse_qs(parsed.query)
    return path.startswith("/media/set") or bool(query.get("set"))


def _base_args(value: str) -> list[str]:
    return [
        sys.executable,
        "-m",
        "gallery_dl",
        "--ignore-config",
        "--no-input",
        "--quiet",
        "--no-colors",
        "-o",
        "extractor.facebook.include=photos",
        "-o",
        "extractor.facebook.videos=false",
        "-o",
        "output.fallback=false",
        value,
    ]


def probe(value: str, *, limit: int = 501, timeout: int = 45) -> dict:
    if not may_contain_photos_url(value):
        raise FacebookGalleryError("FACEBOOK_PHOTO_URL_INVALID")

    command = _base_args(value)
    command[4:4] = ["--get-urls", "--range", f"1-{limit}"]
    try:
        completed = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise FacebookGalleryError("FACEBOOK_GALLERY_TIMEOUT") from exc

    urls: list[str] = []
    seen: set[str] = set()
    for raw_line in completed.stdout.splitlines():
        candidate = raw_line.strip()
        try:
            parsed = urlparse(candidate)
        except ValueError:
            continue
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            continue
        if candidate not in seen:
            seen.add(candidate)
            urls.append(candidate)

    if not urls:
        detail = completed.stderr.lower()
        if "no module named gallery_dl" in detail:
            raise FacebookGalleryError("FACEBOOK_GALLERY_COMPONENT_MISSING")
        raise FacebookGalleryError("FACEBOOK_IMAGE_MISSING")

    album = _is_album_url(value) or len(urls) > 1
    return {
        "title": "Facebook 相簿" if album else "Facebook 照片",
        "thumbnail": urls[0],
        "image_count": len(urls),
        "image_count_truncated": len(urls) >= limit,
    }


def _tree_size(root: Path) -> tuple[int, int]:
    total = 0
    completed_images = 0
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        try:
            total += path.stat().st_size
        except OSError:
            continue
        if path.suffix.lower() in IMAGE_SUFFIXES:
            completed_images += 1
    return total, completed_images


def _stop_process(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=2)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=2)


def download(
    value: str,
    destination: str | Path,
    *,
    cancelled,
    progress,
    max_bytes: int = 0,
) -> dict:
    if not may_contain_photos_url(value):
        raise FacebookGalleryError("FACEBOOK_PHOTO_URL_INVALID")

    root = Path(destination)
    root.mkdir(parents=True, exist_ok=True)
    command = _base_args(value)
    command[4:4] = ["--directory", str(root), "--restrict-filenames", "windows"]

    try:
        process = subprocess.Popen(
            command,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except OSError as exc:
        raise FacebookGalleryError("FACEBOOK_GALLERY_COMPONENT_MISSING") from exc

    try:
        while process.poll() is None:
            if cancelled():
                _stop_process(process)
                raise FacebookGalleryCancelled("下載已由使用者停止")
            total_bytes, image_count = _tree_size(root)
            if max_bytes and total_bytes > max_bytes:
                _stop_process(process)
                raise FacebookGalleryError("CLOUD_SIZE_LIMIT")
            progress(total_bytes, image_count)
            time.sleep(0.35)
        return_code = process.wait()
    finally:
        if cancelled() and process.poll() is None:
            _stop_process(process)

    if cancelled():
        raise FacebookGalleryCancelled("下載已由使用者停止")

    total_bytes, image_count = _tree_size(root)
    if max_bytes and total_bytes > max_bytes:
        raise FacebookGalleryError("CLOUD_SIZE_LIMIT")
    if return_code != 0 or image_count < 1:
        raise FacebookGalleryError("FACEBOOK_IMAGE_MISSING")

    album = _is_album_url(value) or image_count > 1
    return {
        "title": "Facebook 相簿" if album else "Facebook 照片",
        "image_count": image_count,
    }
