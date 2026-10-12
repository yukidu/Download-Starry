import os
from datetime import datetime

os.environ.setdefault('CLOUD_BACKEND_TOKEN', 'test-token-' + ('x' * 40))

from deployment import server


def setup_function():
    server.reset_filename_registry_for_tests()


def test_simplified_title_converts_to_taiwan_traditional():
    assert server.traditionalize_title('今天活动精彩花絮与学员分享') == '今天活動精彩花絮與學員分享'


def test_facebook_engagement_prefix_removed_from_display_title():
    assert server.clean_title(
        '30K views · 706 reactions | 今天活动精彩花絮与学员分享',
        'Facebook',
    ) == '今天活動精彩花絮與學員分享'
    assert server.clean_title(
        '1.2M views · 8.5K reactions | 成功者的五个习惯',
        'Facebook',
    ) == '成功者的五個習慣'


def test_filename_uses_date_source_traditional_title_and_domain():
    now = datetime(2026, 10, 13, 2, 49, tzinfo=server.TAIPEI_TZ)
    filename = server.build_download_filename(
        'WeChat',
        '今天活动精彩花絮与学员分享',
        'video',
        '.mp4',
        now,
    )
    assert filename == '20261013_微信_今天活動精彩花絮與學員分享_download.starry.phd.mp4'


def test_facebook_engagement_prefix_never_enters_filename():
    now = datetime(2026, 10, 13, 2, 49, tzinfo=server.TAIPEI_TZ)
    filename = server.build_download_filename(
        'Facebook',
        '30K views · 706 reactions | 今天活动精彩花絮与学员分享',
        'video',
        '.mp4',
        now,
    )
    assert filename == '20261013_Facebook_今天活動精彩花絮與學員分享_download.starry.phd.mp4'
    assert 'views' not in filename
    assert 'reactions' not in filename


def test_same_name_adds_minute_then_two_digit_sequence():
    now = datetime(2026, 10, 13, 2, 49, tzinfo=server.TAIPEI_TZ)
    first = server.build_download_filename('YouTube', '成功者的五个习惯与行动方法', 'audio', '.mp3', now)
    second = server.build_download_filename('YouTube', '成功者的五个习惯与行动方法', 'audio', '.mp3', now)
    third = server.build_download_filename('YouTube', '成功者的五个习惯与行动方法', 'audio', '.mp3', now)

    assert first == '20261013_YouTube_成功者的五個習慣與行動方法_download.starry.phd.mp3'
    assert second == '202610130249_YouTube_成功者的五個習慣與行動方法_download.starry.phd.mp3'
    assert third == '202610130249_YouTube_成功者的五個習慣與行動方法_download.starry.phd_01.mp3'


def test_filename_sanitizes_spaces_illegal_chars_and_limits_title():
    cleaned = server.normalize_title_for_filename('  一二三四五六七八九十十一十二十三十四十五十六十七十八十九二十廿一 / \\ : * ? " < > |  ABC   DEF  ')
    assert '/' not in cleaned
    assert '\\' not in cleaned
    assert ':' not in cleaned
    assert '*' not in cleaned
    assert '?' not in cleaned
    assert '"' not in cleaned
    assert '<' not in cleaned
    assert '>' not in cleaned
    assert '|' not in cleaned
    assert '  ' not in cleaned
    assert sum(1 for char in cleaned if server.CJK_CHAR.fullmatch(char)) <= 20
    assert len(cleaned) <= 30
    assert not cleaned.endswith((' ', '.'))


def test_missing_title_uses_requested_fallback():
    now = datetime(2026, 10, 13, 2, 49, tzinfo=server.TAIPEI_TZ)
    assert server.build_download_filename('WeChat', '', 'video', '.mp4', now) == '微信影片_20261013.mp4'


def test_thumbnail_style_preserves_natural_portrait_and_landscape_ratio():
    assert 'height: auto !important;' in server.TITLE_FIRST_STYLE
    assert 'aspect-ratio: auto !important;' in server.TITLE_FIRST_STYLE
    assert 'object-fit: contain !important;' in server.TITLE_FIRST_STYLE
