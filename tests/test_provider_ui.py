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


def test_provider_detection_covers_all_supported_logo_hosts():
    script = (ROOT / 'static' / 'provider-ui.js').read_text(encoding='utf-8')
    for host in (
        'youtube.com', 'youtu.be', 'instagram.com', 'facebook.com', 'fb.watch',
        'weixin.qq.com', 'ganjingworld.com', 'ganjing.com', 'gjw.us', 'odysee.com',
        'tiktok.com', 'threads.net', 'threads.com', 'x.com', 'twitter.com', 'dcard.tw',
        'xiaohongshu.com', 'xhslink.com', 'bilibili.com', 'b23.tv', 'twitch.tv',
        'vimeo.com', 'reddit.com', 'redd.it', 'pinterest.com', 'pin.it',
    ):
        assert host in script

    for provider in (
        'tiktok', 'threads', 'x', 'dcard', 'xiaohongshu', 'bilibili',
        'twitch', 'vimeo', 'reddit', 'pinterest',
    ):
        assert f"'{provider}'" in script

    assert "document.querySelectorAll('.platform-icon[data-provider]')" in script
    assert "icon.dataset.provider = provider" in script
    assert "icon.classList.toggle('is-detected', selected)" in script
    assert "window.open(sourceUrl, '_blank', 'noopener,noreferrer')" in script
    assert "mediaCard.setAttribute('role', 'link')" in script


def test_brand_marks_are_replaced_with_recognizable_versions():
    script = (ROOT / 'static' / 'provider-ui.js').read_text(encoding='utf-8')
    assert 'provider-brand-mark-ganjing' in script
    assert '>乾淨<' in script
    assert '>GJW<' in script
    assert 'provider-brand-mark-odysee' in script
    assert 'odysee-official-gradient' in script


def test_detected_provider_uses_single_refined_frame_and_fades_all_others():
    stylesheet = (ROOT / 'static' / 'provider-ui.css').read_text(encoding='utf-8')
    assert '.platform-icons.has-detected-provider .platform-icon[data-provider]:not(.is-detected)' in stylesheet
    assert 'opacity: .28' in stylesheet
    assert '.platform-icon[data-provider].is-detected' in stylesheet
    assert 'border: 2px solid currentColor' in stylesheet
    assert 'scale(1.08)' in stylesheet
    assert 'providerDetectedPulse' not in stylesheet
    assert '.media-card.media-source-link' in stylesheet
