'use strict';
(() => {
  const manifest = document.createElement('link');
  manifest.rel = 'manifest';
  manifest.href = '/static/manifest.webmanifest';
  document.head.appendChild(manifest);

  const sources = ['/static/platform.js', '/static/api.js', '/static/app-core.js'];
  sources.forEach(href => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'script';
    link.href = href;
    document.head.appendChild(link);
  });

  const load = src => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`無法載入 ${src}`));
    document.head.appendChild(script);
  });

  Promise.all([load(sources[0]), load(sources[1])])
    .then(() => load(sources[2]))
    .catch(error => {
      console.error('SaveVideo bootstrap failed', error);
      const message = document.getElementById('message');
      if (!message) return;
      message.textContent = '程式載入未完成，請重新整理頁面後再試';
      message.classList.add('show');
    });
})();
