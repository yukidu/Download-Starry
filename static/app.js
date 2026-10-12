'use strict';

(() => {
  const ensureMeta = (name, content) => {
    let meta = document.querySelector(`meta[name="${name}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = name;
      document.head.appendChild(meta);
    }
    if (!meta.content) meta.content = content;
  };

  if (!document.querySelector('link[rel="manifest"]')) {
    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = '/static/manifest.webmanifest';
    document.head.appendChild(manifest);
  }
  ensureMeta('theme-color', '#0b1026');
  ensureMeta('apple-mobile-web-app-capable', 'yes');
  ensureMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
  ensureMeta('app-api-base', '');

  const loadScript = src => new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-savevideo-bootstrap="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') resolve();
      else {
        existing.addEventListener('load', resolve, {once: true});
        existing.addEventListener('error', reject, {once: true});
      }
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset.savevideoBootstrap = src;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, {once: true});
    script.addEventListener('error', () => reject(new Error(`無法載入 ${src}`)), {once: true});
    document.head.appendChild(script);
  });

  const boot = async () => {
    if (!window.SaveVideoPlatform) await loadScript('/static/platform.js');
    if (!window.SaveVideoAPI) await loadScript('/static/api.js');
    await loadScript('/static/app-core.js');
  };

  boot().catch(error => {
    console.error('SaveVideo bootstrap failed', error);
    const message = document.getElementById('message');
    if (message) {
      message.textContent = '程式載入未完成，請重新整理頁面後再試';
      message.classList.add('show');
    }
  });
})();
