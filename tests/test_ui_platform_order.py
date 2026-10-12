from pathlib import Path


UI = Path('static/ui.js').read_text(encoding='utf-8')


def test_platforms_move_below_url():
    assert "movePlatformsBelowUrl" in UI
    assert "message.insertAdjacentElement('afterend', hero)" in UI


def test_platform_icons_show_persistent_name_beside_icon():
    assert "showPlatformName" in UI
    assert "hidePlatformName" in UI
    assert "item.addEventListener('click'" in UI
    assert "event.stopPropagation()" in UI
    assert "platform-name-bubble" in UI
    assert "positionPlatformBubble" in UI
    assert "platform-bubble-left" in UI
    assert "platform-bubble-below" in UI
    assert "2200" not in UI


def test_platform_name_closes_on_outside_click():
    assert "document.addEventListener('click'" in UI
    assert "hidePlatformName();" in UI


def test_header_uses_twinkle_starfield_reference_style():
    assert "installHeaderStarfield" in UI
    assert "header-starfield" in UI
    assert "star-twinkle-slow" in UI
    assert "star-twinkle-medium" in UI
    assert "star-twinkle-fast" in UI
    assert "#f59e0b" in UI
    assert "#38bdf8" in UI
    assert "#c084fc" in UI
