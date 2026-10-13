'use strict';
(() => {
  const head = document.head;
  const mark=document.querySelector('.site-brand-mark');
  if(mark){mark.replaceChildren();mark.style.cssText+=';background:url(/static/app-icon.svg?v=4) center/cover;box-shadow:none'}

  head.insertAdjacentHTML('beforeend', '<link rel="manifest" href="/static/manifest.webmanifest"><meta name="theme-color" content="#0b1026"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">');

  const menu = document.querySelector('.main-menu-panel');
  const themeRow = document.getElementById('menu-theme-toggle');
  let installButton = document.getElementById('install-app-button');
  if (menu && !installButton) {
    installButton = document.createElement('button');
    installButton.id = 'install-app-button';
    installButton.className = 'main-menu-row';
    installButton.type = 'button';
    installButton.setAttribute('role', 'menuitem');
    installButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>安裝到桌面</span>';
    if (themeRow) themeRow.before(installButton); else menu.appendChild(installButton);
  }

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
  let installUiPromise = null;
  const syncInstallButton = () => {
    if (!installButton) return;
    const installed = Boolean(window.SaveVideoPlatform?.pwa?.isInstalled);
    installButton.style.opacity = installed ? '.45' : '';
    installButton.setAttribute('aria-disabled', String(installed));
    installButton.title = installed ? '你已安裝' : '安裝到桌面';
  };
  installButton?.addEventListener('click', async () => {
    try {
      installUiPromise ||= load('/static/install-pwa.js');
      await installUiPromise;
      await window.DownloadStarryInstallUI?.(installButton);
      syncInstallButton();
    } catch (error) {
      console.error('Download Starry install UI failed', error);
    }
  });

  Promise.all([load(sources[0]), load(sources[1])])
    .then(() => {
      syncInstallButton();
      return load(sources[2]);
    })
    .catch(error => {
      console.error('Download Starry bootstrap failed', error);
      const message = document.getElementById('message');
      if (!message) return;
      message.textContent = '程式載入未完成，請重新整理頁面後再試';
      message.classList.add('show');
    });
})();