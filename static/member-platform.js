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
  window.DownloadStarryMemberPlatform = Object.freeze({session, auth});
})();
