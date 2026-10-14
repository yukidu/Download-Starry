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
    async file(file, {title = '', text = ''} = {}) {
      if (!(file instanceof File)) throw new Error('找不到可分享的檔案');
      const payload = {file, files: [file], filename: file.name, title: String(title || ''), text: String(text || '')};
      const adapter = native()?.share;
      if (adapter?.shareFile) {
        await adapter.shareFile(payload);
        return {mode: 'shared'};
      }
      if (adapter?.shareFiles) {
        await adapter.shareFiles(payload);
        return {mode: 'shared'};
      }
      if (navigator.share) {
        if (navigator.canShare && !navigator.canShare({files: [file]})) {
          throw new Error('目前這台裝置不支援直接分享下載檔案');
        }
        await navigator.share({files: [file], title: payload.title, text: payload.text});
        return {mode: 'shared'};
      }
      throw new Error('目前這台裝置不支援原生檔案分享');
    },
  });
  window.DownloadStarryMemberPlatform = Object.freeze({session, auth, share});
})();
