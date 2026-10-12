'use strict';
(() => {
  if (window.SaveVideoPlatform) return;

  const getNativeAdapter = () => window.SaveVideoNative || null;
  const capacitor = window.Capacitor || null;

  let platformName = 'web';
  if (capacitor) {
    try {
      if (typeof capacitor.getPlatform === 'function') platformName = capacitor.getPlatform() || 'web';
      else platformName = capacitor.platform || 'web';
    } catch (_) {
      platformName = capacitor.platform || 'web';
    }
  }

  let isCapacitor = platformName !== 'web';
  if (capacitor && typeof capacitor.isNativePlatform === 'function') {
    try { isCapacitor = Boolean(capacitor.isNativePlatform()); } catch (_) {}
  }

  const isStandalone = Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator?.standalone === true
  );

  const runtime = Object.freeze({
    platform: platformName,
    isCapacitor,
    isWeb: !isCapacitor,
    isAndroid: platformName === 'android',
    isIOS: platformName === 'ios',
    isStandalone,
    isPWA: !isCapacitor && isStandalone,
  });

  const clipboard = Object.freeze({
    get canReadText() {
      return Boolean(getNativeAdapter()?.clipboard?.readText || navigator.clipboard?.readText);
    },
    async readText() {
      const native = getNativeAdapter()?.clipboard;
      if (native?.readText) return String(await native.readText());
      if (navigator.clipboard?.readText) return navigator.clipboard.readText();
      throw new Error('目前環境無法直接讀取剪貼簿');
    },
    async writeText(value) {
      const text = String(value ?? '');
      const native = getNativeAdapter()?.clipboard;
      if (native?.writeText) return native.writeText(text);
      if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);

      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand?.('copy');
      textarea.remove();
      if (!copied) throw new Error('目前環境無法複製到剪貼簿');
    },
  });

  const files = Object.freeze({
    get canPickDirectory() {
      return Boolean(getNativeAdapter()?.files?.pickDirectory || window.showDirectoryPicker);
    },
    async pickDirectory(options = {mode: 'readwrite'}) {
      const native = getNativeAdapter()?.files;
      if (native?.pickDirectory) return native.pickDirectory(options);
      if (window.showDirectoryPicker) return window.showDirectoryPicker(options);
      throw new Error('目前環境不支援選擇資料夾');
    },
    async saveResponseToDirectory(response, directoryHandle, filename, {signal} = {}) {
      const native = getNativeAdapter()?.files;
      if (native?.saveResponseToDirectory) {
        return native.saveResponseToDirectory(response, directoryHandle, filename, {signal});
      }
      if (!directoryHandle?.getFileHandle) throw new Error('目前環境不支援寫入指定資料夾');

      const fileHandle = await directoryHandle.getFileHandle(filename, {create: true});
      const writable = await fileHandle.createWritable();
      try {
        if (response.body) await response.body.pipeTo(writable, {signal});
        else {
          await writable.write(await response.blob());
          await writable.close();
        }
      } catch (error) {
        await writable.abort?.().catch(() => {});
        throw error;
      }
    },
    async download(url, filename = '') {
      const native = getNativeAdapter()?.files;
      if (native?.download) return native.download(url, filename);

      const link = document.createElement('a');
      link.href = url;
      if (filename) link.download = filename;
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      link.remove();
    },
  });

  const lifecycle = Object.freeze({
    onPageHide(handler) {
      window.addEventListener('pagehide', handler);
      return () => window.removeEventListener('pagehide', handler);
    },
    sendBeacon(url, body = new Blob([], {type: 'application/octet-stream'})) {
      try {
        if (navigator.sendBeacon?.(url, body)) return true;
      } catch (_) {}
      fetch(url, {method: 'POST', body, keepalive: true}).catch(() => {});
      return false;
    },
  });

  const registerWorker = async url => {
    try {
      return await navigator.serviceWorker.register(url, {scope: '/'});
    } catch (_) {
      try { return await navigator.serviceWorker.register(url); } catch (_) { return null; }
    }
  };

  const pwa = Object.freeze({
    registerServiceWorker(url = '/static/service-worker.js') {
      if (runtime.isCapacitor || !('serviceWorker' in navigator)) return Promise.resolve(null);
      return new Promise(resolve => {
        const run = () => registerWorker(url).then(resolve, () => resolve(null));
        if (typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(run, {timeout: 2000});
        } else {
          window.setTimeout(run, 0);
        }
      });
    },
  });

  window.SaveVideoPlatform = Object.freeze({runtime, clipboard, files, lifecycle, pwa});
})();
