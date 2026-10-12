import importlib
import sys


def _load_server(monkeypatch):
    monkeypatch.setenv('CLOUD_BACKEND_TOKEN', 'x' * 32)
    sys.modules.pop('deployment.server', None)
    return importlib.import_module('deployment.server')


def test_cloud_prefers_object_desc_media_over_preview_variants(monkeypatch):
    server = _load_server(monkeypatch)
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

    url, decode_key, encrypted_bytes, source = server._cloud_best_wechat_video(detail)
    assert url == 'https://wxapp.tc.qq.com/251/20304/full-quality.mp4?token=full'
    assert decode_key == '123'
    assert encrypted_bytes == 65536
    assert source == 'object'


def test_cloud_fallback_does_not_choose_smaller_hevc_or_origin_first(monkeypatch):
    server = _load_server(monkeypatch)
    detail = {
        'feedInfo': {
            'originVideoUrl': 'https://finder.video.qq.com/origin-small.mp4',
            'h265VideoInfo': {'videoUrl': 'https://finder.video.qq.com/h265-small.mp4'},
            'h264VideoInfo': {'videoUrl': 'https://finder.video.qq.com/h264-known-good.mp4'},
            'videoUrl': 'https://finder.video.qq.com/default.mp4',
        },
    }

    url, decode_key, encrypted_bytes, source = server._cloud_best_wechat_video(detail)
    assert url == 'https://finder.video.qq.com/h264-known-good.mp4'
    assert decode_key == ''
    assert encrypted_bytes == 0
    assert source == 'h264'
