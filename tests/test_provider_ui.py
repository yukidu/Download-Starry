from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_provider_logo_hooks_are_rendered():
    template = (ROOT / 'templates' / 'index.html').read_text(encoding='utf-8')
    for provider in ('youtube', 'instagram', 'facebook', 'wechat', 'ganjingworld', 'odysee'):
        assert f'data-provider="{provider}"' in template
    assert '乾淨世界 Gan Jing World' in template
    assert 'title="Odysee"' in template
    assert 'provider-ui.css' in template
    assert 'provider-ui.js' in template


def test_provider_detection_covers_supported_hosts():
    script = (ROOT / 'static' / 'provider-ui.js').read_text(encoding='utf-8')
    for host in (
        'youtube.com', 'youtu.be', 'instagram.com', 'facebook.com', 'fb.watch',
        'weixin.qq.com', 'ganjingworld.com', 'ganjing.com', 'gjw.us', 'odysee.com',
    ):
        assert host in script
    assert "icon.classList.toggle('is-detected', selected)" in script
    assert "window.open(sourceUrl, '_blank', 'noopener,noreferrer')" in script
    assert "mediaCard.setAttribute('role', 'link')" in script


def test_detected_provider_has_strong_visual_frame():
    stylesheet = (ROOT / 'static' / 'provider-ui.css').read_text(encoding='utf-8')
    assert '.platform-icon[data-provider].is-detected' in stylesheet
    assert 'border: 3px solid currentColor' in stylesheet
    assert 'providerDetectedPulse' in stylesheet
    assert '.media-card.media-source-link' in stylesheet
