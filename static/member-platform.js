'use strict';
(() => {
  if (window.DownloadStarryMemberPlatform) return;
  const native = () => window.SaveVideoNative || null;
  const session = Object.freeze({
    get(key) { try { return sessionStorage.getItem(key); } catch (_) { return null; } },
    set(key, value) { try { sessionStorage.setItem(key, String(value)); return true; } catch (_) { return false; } },
    remove(key) { try { sessionStorage.removeItem(key); } catch (_) {} },
  });
  const auth = Object.freeze({
    login({chooseAccount = true} = {}) {
      const adapter = native()?.auth;
      if (adapter?.login) return adapter.login({provider: 'google', account: 'starry-id', chooseAccount});
      window.location.assign(`/api/auth/starry/login${chooseAccount ? '?choose=1' : ''}`);
    },
  });
  const share = Object.freeze({
    async open({title = '', text = '', url = ''} = {}) {
      const payload = {title: String(title || ''), text: String(text || ''), url: String(url || '')};
      const adapter = native()?.share;
      if (adapter?.share) {
        await adapter.share(payload);
        return {mode: 'shared'};
      }
      if (navigator.share) {
        await navigator.share(payload);
        return {mode: 'shared'};
      }
      const fallback = payload.url || payload.text;
      if (fallback && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fallback);
        return {mode: 'copied'};
      }
      throw new Error('目前裝置不支援分享功能');
    },
  });
  window.DownloadStarryMemberPlatform = Object.freeze({session, auth, share});
})();
