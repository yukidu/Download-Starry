from pathlib import Path

import app as core


class FakeYDL:
    def __init__(self, _options):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def extract_info(self, url, download=False):
        assert download is False
        return {
            'id': 'demo',
            'title': 'Demo video',
            'channel': 'Demo channel',
            'formats': [{
                'url': 'https://cdn.example.com/demo.mp4',
                'vcodec': 'h264',
            }],
        }


def test_ganjing_and_odysee_use_original_quality(monkeypatch):
    monkeypatch.setattr(core, 'YoutubeDL', FakeYDL)
    client = core.app.test_client()
    for url, platform in (
        ('https://www.ganjingworld.com/video/1f7srq4ett0373aCVOuRtTA1h1i61c', '乾淨世界'),
        ('https://odysee.com/@demo:1/video:2', 'Odysee'),
    ):
        response = client.post('/api/info', json={'url': url})
        assert response.status_code == 200
        assert response.get_json()['platform'] == platform
        assert response.get_json()['original_quality'] is True


def test_ganjing_extractor_uses_official_public_api():
    source = Path('yt_dlp_plugins/extractor/ganjingworld.py').read_text(encoding='utf-8')
    assert 'https://gw.ganjingworld.com/v1.1/content/query' in source
    assert 'video_url' in source
    assert "item.get('media')" in source
    assert 'third-party' not in source.lower()


def test_ganjing_short_link_stays_on_official_domains():
    source = Path('yt_dlp_plugins/extractor/savevideo_redirects.py').read_text(encoding='utf-8')
    assert "'gjw.us': ('ganjingworld.com', 'ganjing.com')" in source


def test_homepage_shows_new_platform_icons():
    template = Path('templates/index.html').read_text(encoding='utf-8')
    assert 'title="乾淨世界 Gan Jing World"' in template
    assert 'title="Odysee"' in template
    assert 'flex-wrap:wrap' in template
