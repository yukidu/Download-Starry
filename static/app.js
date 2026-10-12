'use strict';
(() => {
  const sources = ['/static/platform.js', '/static/api.js', '/static/app-core.js'];

  for (const href of sources) {
    if (document.querySelector(`link[rel="preload"][href="${href}"]`)) continue;
    const preload = document.createElement('link');
    preload.rel = 'preload';
    preload.as = 'script';
    preload.href = href;
    document.head.appendChild(preload);
  }

  const loadScript = src => new Promise((resolve, reject) => {
    const selector = `script[data-savevideo-bootstrap="${src}"]`;
    const existing = document.querySelector(selector);
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
    script.async = true;
    script.dataset.savevideoBootstrap = src;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, {once: true});
    script.addEventListener('error', () => reject(new Error(`無法載入 ${src}`)), {once: true});
    document.head.appendChild(script);
  });

  Promise.all([
    window.SaveVideoPlatform ? Promise.resolve() : loadScript('/static/platform.js'),
    window.SaveVideoAPI ? Promise.resolve() : loadScript('/static/api.js'),
  ])
    .then(() => loadScript('/static/app-core.js'))
    .catch(error => {
      console.error('SaveVideo bootstrap failed', error);
      const message = document.getElementById('message');
      if (!message) return;
      message.textContent = '程式載入未完成，請重新整理頁面後再試';
      message.classList.add('show');
    });
})();
