from pathlib import Path


UI = Path('static/ui.js').read_text(encoding='utf-8')


def test_platforms_move_below_url():
    assert "movePlatformsBelowUrl" in UI
    assert "message.insertAdjacentElement('afterend', hero)" in UI


def test_platform_icons_show_name_on_click():
    assert "showPlatformName" in UI
    assert "item.addEventListener('click'" in UI
    assert "platform-name-bubble" in UI
