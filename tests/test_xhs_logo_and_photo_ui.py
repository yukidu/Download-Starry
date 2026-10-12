from pathlib import Path


UI = Path('static/ui.js').read_text(encoding='utf-8')
APP_JS = Path('static/app.js').read_text(encoding='utf-8')
INDEX = Path('templates/index.html').read_text(encoding='utf-8')


def test_xiaohongshu_icon_uses_red_wordmark_logo():
    assert "platform-xiaohongshu" in UI
    assert "#ff2442" in UI
    assert "小红书" in UI
    assert "xiaohongshu-wordmark" in UI


def test_url_and_download_ui_matches_simplified_flow():
    assert 'id="paste-url-button"' in INDEX
    assert '>貼上網址<' in INDEX
    assert '解析網址' in INDEX
    assert 'id="quality"' in INDEX
    assert 'type="hidden" value="best"' in INDEX
    assert 'id="quality-group"' not in INDEX
    assert 'class="type-tabs"' not in INDEX
    assert 'id="download-video-button"' in INDEX
    assert 'id="download-audio-button"' in INDEX
    assert 'id="download-image-button"' in INDEX
    assert 'data-download-type="video"' in INDEX
    assert 'data-download-type="audio"' in INDEX
    assert 'data-download-type="image"' in INDEX
    assert "navigator.clipboard?.readText" in APP_JS
    assert "clearParsedResult" in APP_JS
    assert "urlInput.addEventListener('input'" in APP_JS
    assert "data.media_type === 'image'" in APP_JS
    assert "qualityInput.value = data.original_quality ? 'original' : 'best'" in APP_JS
    assert "startSingleDownload(downloadVideoButton, 'video')" in APP_JS
    assert "startSingleDownload(downloadAudioButton, 'audio')" in APP_JS
    assert '打包下載 ${count} 張照片' in APP_JS
