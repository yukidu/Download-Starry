'use strict';
(() => {
  if (window.SaveVideoPlatform) return;

  const getNativeAdapter = () => window.SaveVideoNative || null;
  const getCapacitor = () => window.Capacitor || null;
  const nativePlatform = () => {
    const capacitor = getCapacitor();
    if (!capacitor) return 'web';
    try {
      if (typeof capacitor.getPlatform === 'function') return capacitor.getPlatform();
    } catch (_) {}
    return capacitor.platform || 'web';
  };

  const runtime = {
    get isCapacitor() {
      const capacitor = getCapacitor();
      if (!capacitor) return false;
      try {
        if (typeof capacitor.isNativePlatform === 'function') return capacitor.isNativePlatform();
      } catch (_) {}
      return nativePlatform() !== 'web';
    },
    get isWeb() { return !this.isCapacitor; },
    get isAndroid() { return nativePlatform() === 'android'; },
    get isIOS() { return nativePlatform() === 'ios'; },
    get isStandalone() {
      return Boolean(
        window.matchMedia?.('(display-mode: standalone)').matches ||
        window.navigator?.standalone === true
      );
    },
    get isPWA() { return this.isWeb && this.isStandalone; },
    get platform() { return nativePlatform(); },
  };

  const memoryStorage = new Map();
  const storage = {
    get(key, fallback = null) {
      try {
        const value = window.localStorage.getItem(key);
        return value === null ? fallback : value;
      } catch (_) {
        return memoryStorage.has(key) ? memoryStorage.get(key) : fallback;
      }
    },
    set(key, value) {
      const normalized = String(value);
      memoryStorage.set(key, normalized);
      try { window.localStorage.setItem(key, normalized); } catch (_) {}
    },
    remove(key) {
      memoryStorage.delete(key);
      try { window.localStorage.removeItem(key); } catch (_) {}
    },
  };

  const clipboard = {
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
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand?.('copy');
      textarea.remove();
      if (!copied) throw new Error('目前環境無法複製到剪貼簿');
    },
  };

  const files = {
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
        if (response.body) {
          await response.body.pipeTo(writable, {signal});
        } else {
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
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
    },
  };

  const browser = {
    async openExternal(url) {
      const native = getNativeAdapter()?.browser;
      if (native?.openExternal) return native.openExternal(url);
      const popup = window.open(url, '_blank', 'noopener,noreferrer');
      if (!popup) window.location.assign(url);
    },
  };

  const lifecycle = {
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
  };

  const networkListeners = new Set();
  const emitNetwork = () => {
    const online = navigator.onLine !== false;
    networkListeners.forEach(listener => {
      try { listener(online); } catch (_) {}
    });
  };
  window.addEventListener('online', emitNetwork);
  window.addEventListener('offline', emitNetwork);
  const network = {
    get isOnline() { return navigator.onLine !== false; },
    subscribe(listener) {
      networkListeners.add(listener);
      return () => networkListeners.delete(listener);
    },
  };

  let deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
  });
  const pwa = {
    get installAvailable() { return Boolean(deferredInstallPrompt); },
    async promptInstall() {
      if (!deferredInstallPrompt) return {outcome: 'unavailable'};
      const prompt = deferredInstallPrompt;
      deferredInstallPrompt = null;
      await prompt.prompt();
      return prompt.userChoice;
    },
    async registerServiceWorker(url = '/static/service-worker.js') {
      if (runtime.isCapacitor || !('serviceWorker' in navigator)) return null;
      try {
        return await navigator.serviceWorker.register(url, {scope: '/'});
      } catch (_) {
        try {
          return await navigator.serviceWorker.register(url);
        } catch (_) {
          return null;
        }
      }
    },
  };

  const version = {
    get webVersion() {
      return document.querySelector('meta[name="app-version"]')?.content?.trim() || 'dev';
    },
    get nativeVersion() {
      return getNativeAdapter()?.version?.appVersion || null;
    },
    get nativeBuildNumber() {
      return getNativeAdapter()?.version?.buildNumber || null;
    },
    snapshot() {
      return {
        webVersion: this.webVersion,
        nativeVersion: this.nativeVersion,
        nativeBuildNumber: this.nativeBuildNumber,
        runtime: runtime.platform,
        standalone: runtime.isStandalone,
      };
    },
  };

  window.SaveVideoPlatform = Object.freeze({
    runtime: Object.freeze(runtime),
    storage: Object.freeze(storage),
    clipboard: Object.freeze(clipboard),
    files: Object.freeze(files),
    browser: Object.freeze(browser),
    lifecycle: Object.freeze(lifecycle),
    network: Object.freeze(network),
    pwa: Object.freeze(pwa),
    version: Object.freeze(version),
  });
})();
