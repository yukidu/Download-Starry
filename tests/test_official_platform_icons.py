from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = (ROOT / 'static' / 'provider-ui.js').read_text(encoding='utf-8')


def test_extra_platforms_use_brand_icon_assets():
    for provider in (
        'tiktok', 'threads', 'x', 'dcard', 'xiaohongshu',
        'bilibili', 'twitch', 'vimeo', 'reddit', 'pinterest',
    ):
        assert f'provider-official-{provider}' in SCRIPT

    assert 'OFFICIAL_EXTRA_MARKS' in SCRIPT
    assert 'Dcard_Favicon_x520.png' in SCRIPT
    assert '#25F4EE' in SCRIPT
    assert '#FE2C55' in SCRIPT
    assert '#9146FF' in SCRIPT
    assert '#1AB7EA' in SCRIPT
    assert '#FF4500' in SCRIPT
    assert '#E60023' in SCRIPT


def test_platform_strip_moves_below_result_only_when_result_is_visible():
    assert 'const syncPlatformPosition' in SCRIPT
    assert "if (!result.hidden)" in SCRIPT
    assert "result.insertAdjacentElement('afterend', hero)" in SCRIPT
    assert "message.insertAdjacentElement('afterend', hero)" in SCRIPT
    assert "attributeFilter: ['hidden']" in SCRIPT
    assert "hero.dataset.position = 'after-result'" in SCRIPT
    assert "hero.dataset.position = 'after-url'" in SCRIPT
