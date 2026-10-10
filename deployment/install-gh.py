"""Download the official GitHub CLI into ignored project-local .tools."""
import hashlib
import io
import json
import platform
from pathlib import Path
import urllib.request
import zipfile


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "huanyu-deploy-setup"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


if platform.system() != "Darwin" or platform.machine() != "arm64":
    raise SystemExit("This bootstrap is for Apple Silicon macOS only.")
release = json.loads(fetch("https://api.github.com/repos/cli/cli/releases/latest"))
asset = next(a for a in release["assets"] if a["name"].endswith("macOS_arm64.zip"))
checksums = next(a for a in release["assets"] if a["name"].endswith("checksums.txt"))
expected = next(line.split()[0] for line in fetch(checksums["browser_download_url"]).decode().splitlines()
                if line.split()[-1] == asset["name"])
content = fetch(asset["browser_download_url"])
if hashlib.sha256(content).hexdigest() != expected:
    raise SystemExit("GitHub CLI checksum mismatch")
with zipfile.ZipFile(io.BytesIO(content)) as archive:
    member = next(name for name in archive.namelist() if name.endswith("/bin/gh"))
    target = Path(__file__).resolve().parents[1] / ".tools" / "gh"
    target.parent.mkdir(exist_ok=True)
    target.write_bytes(archive.read(member))
    target.chmod(0o755)
print("Installed verified GitHub CLI", release["tag_name"])
