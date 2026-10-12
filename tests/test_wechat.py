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
