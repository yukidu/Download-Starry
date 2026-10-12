import wechat_cloud


def test_cloud_prefers_object_desc_media_over_preview_variants():
    detail = {
        'object': {
            'objectDesc': {
                'media': [{
                    'mediaType': 4,
                    'url': 'http://wxapp.tc.qq.com/251/20304/full-quality.mp4',
                    'urlToken': '&token=full',
                    'fileSize': 25000000,
                    'decodeKey': '123',
                    'encryptedByteLength': 65536,
                }],
            },
        },
        'feedInfo': {
            'originVideoUrl': 'https://finder.video.qq.com/origin-small.mp4',
            'h265VideoInfo': {'videoUrl': 'https://finder.video.qq.com/h265-small.mp4'},
            'h264VideoInfo': {'videoUrl': 'https://finder.video.qq.com/h264-preview.mp4'},
        },
    }

    url, decode_key, encrypted_bytes, source = wechat_cloud.best_video(detail)
    assert url == 'https://wxapp.tc.qq.com/251/20304/full-quality.mp4?token=full'
    assert decode_key == '123'
    assert encrypted_bytes == 65536
    assert source == 'object'


def test_cloud_ultra_hd_strips_transcode_limits_but_keeps_auth():
    detail = {
        'object': {
            'objectDesc': {
                'media': [{
                    'mediaType': 4,
                    'url': 'http://wxapp.tc.qq.com/251/20304/video.mp4?X-snsvideoflag=low&adaptivelytrans=1',
                    'urlToken': '&token=token-value&encfilekey=enc-value&scene=2&foo=bar',
                    'fileSize': 157000000,
                    'decodeKey': '456',
                }],
            },
        },
    }

    url, decode_key, encrypted_bytes, source = wechat_cloud.best_video(detail)
    assert url == 'https://wxapp.tc.qq.com/251/20304/video.mp4?encfilekey=enc-value&token=token-value'
    assert 'X-snsvideoflag' not in url
    assert 'adaptivelytrans' not in url
    assert 'scene=' not in url
    assert 'foo=' not in url
    assert decode_key == '456'
    assert encrypted_bytes > 0
    assert source == 'object'


def test_cloud_ultra_hd_leaves_url_unchanged_without_both_auth_params():
    url = 'https://wxapp.tc.qq.com/video.mp4?token=only&X-snsvideoflag=low'
    assert wechat_cloud._ultra_hd_url(url) == url


def test_cloud_fallback_does_not_choose_smaller_hevc_or_origin_first():
    detail = {
        'feedInfo': {
            'originVideoUrl': 'https://finder.video.qq.com/origin-small.mp4',
            'h265VideoInfo': {'videoUrl': 'https://finder.video.qq.com/h265-small.mp4'},
            'h264VideoInfo': {'videoUrl': 'https://finder.video.qq.com/h264-known-good.mp4'},
            'videoUrl': 'https://finder.video.qq.com/default.mp4',
        },
    }

    url, decode_key, encrypted_bytes, source = wechat_cloud.best_video(detail)
    assert url == 'https://finder.video.qq.com/h264-known-good.mp4'
    assert decode_key == ''
    assert encrypted_bytes == 0
    assert source == 'h264'
