"""Cloud container entry point with member advanced routes enabled."""
from deployment.server import app  # noqa: F401
import app as core
from yt_dlp import YoutubeDL as UpstreamYoutubeDL


class CloudYoutubeDL(UpstreamYoutubeDL):
    """Cloud-only YouTube transport tuning without changing desktop downloads."""

    def extract_info(self, url, *args, **kwargs):
        if self.params.get("progress_hooks") and core.platform_for_url(url) == "YouTube":
            self.params["concurrent_fragment_downloads"] = max(
                4, int(self.params.get("concurrent_fragment_downloads") or 1)
            )
            self.params["http_chunk_size"] = 8 * 1024 * 1024
            self.params["throttled_rate"] = 512 * 1024
        return super().extract_info(url, *args, **kwargs)


# A brief progress-poll outage must not cancel a healthy background download.
core.CLIENT_HEARTBEAT_TIMEOUT = 45
core.YoutubeDL = CloudYoutubeDL

from deployment import advanced  # noqa: F401,E402
