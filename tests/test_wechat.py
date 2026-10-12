import pytest
import wechat


def test_share_validation():
    assert wechat.share_id('https://weixin.qq.com/sph/AAes3OFGNS') == 'AAes3OFGNS'
    for url in ['http://weixin.qq.com/sph/a', 'https://weixin.qq.com.evil.test/sph/a',
                'https://user@weixin.qq.com/sph/a', 'https://weixin.qq.com:444/sph/a',
                'https://weixin.qq.com/sph/a/b', 'https://weixin.qq.com/sph/']:
        assert wechat.share_id(url) is None


def test_resolution_scopes_cookie_to_yuanbao(monkeypatch):
    monkeypatch.setenv('YUANBAO_COOKIE', 'session=test-secret')
    calls = []
    def post(url, payload, headers):
        calls.append((url, payload, headers))
        if len(calls) == 1:
            return {'data': {'playable_url': 'https://channels.weixin.qq.com/finder-preview/pages/feed?token=t&eid=e'}}
        return {'data': {'feedInfo': {'description': 'test', 'videoUrl': 'https://finder.video.qq.com/video.mp4'}, 'authorInfo': {'nickname': 'author'}}}
    monkeypatch.setattr(wechat, 'post_json', post)
    info = wechat.resolve('https://weixin.qq.com/sph/AAes3OFGNS')
    assert info['url'] == 'https://finder.video.qq.com/video.mp4'
    assert calls[0][2]['Cookie'] == 'session=test-secret'
    assert 'Cookie' not in calls[1][2]
    assert 'Cookie' not in info['http_headers']
    assert 'test-secret' not in str(info)


def test_missing_or_expired_login(monkeypatch):
    monkeypatch.delenv('YUANBAO_COOKIE', raising=False)
    with pytest.raises(wechat.WeChatError, match='尚未連接'):
        wechat.resolve('https://weixin.qq.com/sph/a')
    monkeypatch.setenv('YUANBAO_COOKIE', 'session=secret')
    monkeypatch.setattr(wechat, 'post_json', lambda *args: {'error': {'message': 'private raw details'}})
    with pytest.raises(wechat.WeChatError, match='重新登入'):
        wechat.resolve('https://weixin.qq.com/sph/a')


def test_reject_non_tencent_media():
    for url in ['https://127.0.0.1/a', 'http://finder.video.qq.com/a',
                'https://finder.video.qq.com.evil.test/a', 'https://u@finder.video.qq.com/a']:
        assert wechat.media_url(url) is None


def _mock_resolve(monkeypatch, feed, extra_detail=None):
    monkeypatch.setenv('YUANBAO_COOKIE', 'session=test-secret')
    detail = {'feedInfo': feed, 'authorInfo': {'nickname': 'author'}}
    if extra_detail:
        detail.update(extra_detail)
    calls = []

    def post(url, payload, headers):
        calls.append((url, payload, headers))
        if len(calls) == 1:
            return {'data': {'playable_url': 'https://channels.weixin.qq.com/finder-preview/pages/feed?token=t&eid=e'}}
        return {'data': detail}

    monkeypatch.setattr(wechat, 'post_json', post)
    return wechat.resolve('https://weixin.qq.com/sph/AAes3OFGNS')


def test_resolution_prefers_origin_stream(monkeypatch):
    info = _mock_resolve(monkeypatch, {
        'description': 'origin-test',
        'originVideoUrl': 'https://finder.video.qq.com/original.mp4',
        'h265VideoInfo': {'videoUrl': 'https://finder.video.qq.com/h265.mp4'},
        'h264VideoInfo': {'videoUrl': 'https://finder.video.qq.com/h264.mp4'},
        'videoUrl': 'https://finder.video.qq.com/default.mp4',
    })
    assert info['url'] == 'https://finder.video.qq.com/original.mp4'
    assert info['_wechat_quality_source'] == 'origin'
    assert info['_wechat_decode_key'] == ''


def test_resolution_uses_richest_object_media_when_origin_missing(monkeypatch):
    info = _mock_resolve(monkeypatch, {
        'description': 'object-test',
        'h264VideoInfo': {'videoUrl': 'https://finder.video.qq.com/h264.mp4'},
    }, {
        'object': {'objectDesc': {'media': [
            {
                'mediaType': 4,
                'url': 'http://wxapp.tc.qq.com/251/20304/video-small.mp4',
                'urlToken': '&token=small',
                'fileSize': 4000000,
                'width': 720,
                'height': 1280,
                'decodeKey': '123',
            },
            {
                'mediaType': 4,
                'url': 'http://wxapp.tc.qq.com/251/20304/video-large.mp4',
                'urlToken': '&token=large',
                'fileSize': 24000000,
                'width': 1080,
                'height': 1920,
                'decodeKey': '456',
                'encryptedByteLength': 65536,
            },
        ]}},
    })
    assert info['url'].startswith('https://wxapp.tc.qq.com/251/20304/video-large.mp4?token=large')
    assert info['_wechat_quality_source'] == 'object'
    assert info['_wechat_decode_key'] == '456'
    assert info['_wechat_encrypted_bytes'] == 65536


def test_resolution_falls_back_to_h265_then_h264(monkeypatch):
    info = _mock_resolve(monkeypatch, {
        'description': 'codec-test',
        'h265VideoInfo': {'videoUrl': 'https://finder.video.qq.com/h265.mp4'},
        'h264VideoInfo': {'videoUrl': 'https://finder.video.qq.com/h264.mp4'},
    })
    assert info['url'] == 'https://finder.video.qq.com/h265.mp4'
    assert info['_wechat_quality_source'] == 'h265'


def test_decrypt_file_restores_mp4_prefix(tmp_path):
    plain = b'\x00\x00\x00\x18ftypisom' + (b'video-data' * 20000)
    encrypted_len = min(len(plain), 131072)
    stream = wechat._isaac64_keystream(12345, encrypted_len)
    encrypted = bytes(a ^ b for a, b in zip(plain[:encrypted_len], stream)) + plain[encrypted_len:]
    target = tmp_path / 'encrypted.mp4'
    target.write_bytes(encrypted)

    assert wechat.decrypt_file(target, '12345', encrypted_len) is True
    assert target.read_bytes() == plain
