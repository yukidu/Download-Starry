import pytest

import app as core


@pytest.mark.parametrize(('url', 'platform'), [
    ('https://www.tiktok.com/@demo/video/1234567890', 'TikTok'),
    ('https://vt.tiktok.com/ZSdemo/', 'TikTok'),
    ('https://www.threads.com/@demo/post/ABC123', 'Threads'),
    ('https://www.threads.net/@demo/post/ABC123', 'Threads'),
    ('https://x.com/demo/status/1234567890', 'X'),
    ('https://twitter.com/demo/status/1234567890', 'X'),
    ('https://www.dcard.tw/f/video_demo/p/253467695', 'Dcard'),
    ('https://www.xiaohongshu.com/explore/6411cf99000000001300b6d9', '小紅書'),
    ('https://xhslink.com/m/demo', '小紅書'),
    ('https://www.bilibili.com/video/BV1xx411c7mD', 'Bilibili'),
    ('https://b23.tv/demo', 'Bilibili'),
    ('https://www.twitch.tv/videos/1234567890', 'Twitch'),
    ('https://clips.twitch.tv/DemoClip', 'Twitch'),
    ('https://vimeo.com/123456789', 'Vimeo'),
    ('https://www.reddit.com/r/videos/comments/abc123/demo/', 'Reddit'),
    ('https://v.redd.it/demo', 'Reddit'),
    ('https://www.pinterest.com/pin/123456789/', 'Pinterest'),
    ('https://pin.it/demo', 'Pinterest'),
    ('https://www.ganjingworld.com/video/1f7srq4ett0373aCVOuRtTA1h1i61c', '乾淨世界'),
    ('https://www.ganjing.com/zh-TW/video/1f7srq4ett0373aCVOuRtTA1h1i61c', '乾淨世界'),
    ('https://gjw.us/s/T32X0', '乾淨世界'),
    ('https://odysee.com/@demo:1/video:2', 'Odysee'),
])
def test_new_platform_url_detection(url, platform):
    assert core.platform_for_url(url) == platform


@pytest.mark.parametrize('url', [
    'https://tiktok.com.evil.example/video/123',
    'https://threads.com.evil.example/@demo/post/ABC',
    'https://dcard.tw.evil.example/f/demo/p/1',
    'https://xhslink.com.evil.example/demo',
    'https://b23.tv.evil.example/demo',
    'https://pin.it.evil.example/demo',
    'https://ganjingworld.com.evil.example/video/demo',
    'https://gjw.us.evil.example/s/demo',
    'https://odysee.com.evil.example/@demo:1/video:2',
])
def test_supported_host_suffix_cannot_be_spoofed(url):
    assert core.platform_for_url(url) is None
