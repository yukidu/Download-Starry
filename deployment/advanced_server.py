"""Cloud container entry point with member advanced routes enabled."""
from deployment.server import app  # noqa: F401
from deployment import advanced  # noqa: F401,E402
