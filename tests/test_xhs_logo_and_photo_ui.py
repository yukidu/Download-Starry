from pathlib import Path


UI = Path('static/ui.js').read_text(encoding='utf-8')
APP_JS = Path('static/app.js').read_text(encoding='utf-8')
INDEX = Path('templates/index.html').read_text(encoding='utf-8')


def test_xiaohongshu_icon_uses_red_wordmark_logo():
    assert "platform-xiaohongshu" in UI
    assert "#ff2442" in UI
    assert "小红书" in UI
    assert "xiaohongshu-wordmark" in UI


def test_instagram_photo_mode_exists_in_ui():
    assert 'id="image-tab"' in INDEX
    assert 'data-type="image"' in INDEX
    assert '貼上影音／照片網址' in INDEX
    assert "data.media_type === 'image'" in APP_JS
    assert "selectDownloadType(imageMode ? 'image' : 'video')" in APP_JS
    assert '下載照片' in APP_JS
    assert '照片 ${currentImageCount} 張' in APP_JS
