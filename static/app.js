'use strict';
(() => {
  const head = document.head;
  head.insertAdjacentHTML('beforeend', '<link rel="manifest" href="/static/manifest.webmanifest"><meta name="theme-color" content="#0b1026"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">');

  const sources = ['/static/platform.js', '/static/api.js', '/static/app-core.js'];
  sources.forEach(href => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'script';
    link.href = href;
    head.appendChild(link);
  });
  const load = src => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`無法載入 ${src}`));
    head.appendChild(script);
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
