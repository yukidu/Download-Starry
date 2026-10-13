'use strict';
(() => {
  if (window.SaveVideoPlatform) return;
  const native = () => window.SaveVideoNative || null;
  const capacitor = window.Capacitor || null;
  let platform = 'web';
  if (capacitor) {
    try { platform = capacitor.getPlatform?.() || capacitor.platform || 'web'; }
    catch (_) { platform = capacitor.platform || 'web'; }
  }
  let isCapacitor = platform !== 'web';
  try { if (capacitor?.isNativePlatform) isCapacitor = Boolean(capacitor.isNativePlatform()); } catch (_) {}
  const ua = navigator.userAgent || '';
  const webIOS = !isCapacitor && (/iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  const webAndroid = !isCapacitor && /Android/i.test(ua);
  const isStandalone = Boolean(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true);
  const runtime = Object.freeze({
    platform, isCapacitor, isWeb: !isCapacitor,
    isAndroid: platform === 'android' || webAndroid, isIOS: platform === 'ios' || webIOS,
    isStandalone, isPWA: !isCapacitor && isStandalone,
  });

  const clipboard = Object.freeze({
    get canReadText() { return Boolean(native()?.clipboard?.readText || navigator.clipboard?.readText); },
    async readText() {
      const adapter = native()?.clipboard;
      if (adapter?.readText) return String(await adapter.readText());
      if (navigator.clipboard?.readText) return navigator.clipboard.readText();
      throw new Error('目前環境無法直接讀取剪貼簿');
    },
  });

  const files = Object.freeze({
    get canPickDirectory() { return Boolean(native()?.files?.pickDirectory || window.showDirectoryPicker); },
    async pickDirectory(options = {mode: 'readwrite'}) {
      const adapter = native()?.files;
      if (adapter?.pickDirectory) return adapter.pickDirectory(options);
      if (window.showDirectoryPicker) return window.showDirectoryPicker(options);
      throw new Error('目前環境不支援選擇資料夾');
    },
    async saveResponseToDirectory(response, directoryHandle, filename, {signal} = {}) {
      const adapter = native()?.files;
      if (adapter?.saveResponseToDirectory) return adapter.saveResponseToDirectory(response, directoryHandle, filename, {signal});
      if (!directoryHandle?.getFileHandle) throw new Error('目前環境不支援寫入指定資料夾');
      const handle = await directoryHandle.getFileHandle(filename, {create: true});
      const writable = await handle.createWritable();
      try {
        if (response.body) await response.body.pipeTo(writable, {signal});
        else { await writable.write(await response.blob()); await writable.close(); }
      } catch (error) {
        await writable.abort?.().catch(() => {});
        throw error;
      }
    },
    async download(url, filename = '') {
      const adapter = native()?.files;
      if (adapter?.download) return adapter.download(url, filename);
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
      try { if (navigator.sendBeacon?.(url, body)) return true; } catch (_) {}
      fetch(url, {method: 'POST', body, keepalive: true}).catch(() => {});
      return false;
    },
  });

  let installPrompt = null;
  let installed = isStandalone;
  if (!isCapacitor && !installed) {
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      installPrompt = event;
    });
    window.addEventListener('appinstalled', () => {
      installed = true;
      installPrompt = null;
    });
  }

  const pwa = Object.freeze({
    get isInstalled() { return installed; },
    get canPromptInstall() { return Boolean(installPrompt); },
    async promptInstall() {
      if (installed) return 'installed';
      if (!installPrompt) return 'unavailable';
      const prompt = installPrompt;
      installPrompt = null;
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice?.outcome === 'accepted') installed = true;
      return choice?.outcome || 'dismissed';
    },
    registerServiceWorker(url = '/static/service-worker.js') {
      if (runtime.isCapacitor || !navigator.serviceWorker) return Promise.resolve(null);
      return new Promise(resolve => {
        const register = async () => {
          try { resolve(await navigator.serviceWorker.register(url, {scope: '/'})); }
          catch (_) { resolve(null); }
        };
        if (window.requestIdleCallback) window.requestIdleCallback(register, {timeout: 2000});
        else window.setTimeout(register, 0);
      });
    },
  });
  window.SaveVideoPlatform = Object.freeze({runtime, clipboard, files, lifecycle, pwa});
})();
