'use strict';
(() => {
  if (window.DownloadStarryInstallUI) return;
  let pageRoot;

  function ensurePage() {
    if (pageRoot) return pageRoot;
    const main = document.querySelector('main');
    if (!main) throw new Error('main page missing');
    Array.from(main.children).forEach(child => { child.hidden = true; });
    const style = document.createElement('style');
    style.id = 'downloadstarry-install-page-style';
    style.textContent = `
.dsi-page{display:block;width:min(100% - 28px,760px);margin:28px auto 64px}.dsi-card{border:1px solid var(--line);border-radius:24px;background:var(--panel-bg);color:var(--ink);box-shadow:0 24px 70px rgba(15,23,42,.16);overflow:hidden}.dsi-head{padding:22px;border-bottom:1px solid var(--line)}.dsi-head h1{margin:0 0 8px;font:900 24px/1.3 "Noto Sans TC",sans-serif}.dsi-head p{margin:0;color:var(--muted);line-height:1.7}.dsi-body{display:grid;gap:16px;padding:22px}.dsi-icon{width:72px;height:72px;border-radius:20px;background:url(/static/app-icon.svg?v=4) center/cover}.dsi-primary{justify-self:start;border:0;border-radius:12px;padding:12px 17px;background:var(--accent);color:#fff;font:800 14px inherit;cursor:pointer}.dsi-message{min-height:24px;color:var(--muted);font-weight:700;line-height:1.7}@media(max-width:560px){.dsi-page{width:min(100% - 18px,760px);margin-top:16px}.dsi-head,.dsi-body{padding:16px}.dsi-primary{width:100%}}
`;
    document.head.appendChild(style);
    pageRoot = document.createElement('section');
    pageRoot.id = 'downloadstarry-install-page';
    pageRoot.className = 'dsi-page';
    main.appendChild(pageRoot);
    return pageRoot;
  }

  async function mount() {
    const platform = window.SaveVideoPlatform;
    const pwa = platform?.pwa;
    const root = ensurePage();
    document.title = '安裝到桌面｜繁星下載';
    root.innerHTML = '<article class="dsi-card"><header class="dsi-head"><h1>安裝到桌面</h1><p>將繁星下載加入桌面或主畫面，之後可以像 App 一樣直接開啟。</p></header><div class="dsi-body"><div class="dsi-icon" aria-hidden="true"></div><button id="dsi-install" class="dsi-primary" type="button">安裝繁星下載</button><div id="dsi-message" class="dsi-message" aria-live="polite"></div></div></article>';
    const button = root.querySelector('#dsi-install');
    const message = root.querySelector('#dsi-message');
    if (!pwa) {
      button.disabled = true;
      message.textContent = '目前瀏覽器沒有提供安裝功能。';
      return;
    }
    const sync = () => {
      if (pwa.isInstalled) {
        button.disabled = true;
        button.textContent = '已安裝';
        message.textContent = '你已安裝繁星下載。';
      } else if (platform.runtime.isIOS) {
        message.textContent = '請點 Safari 的分享按鈕，再選「加入主畫面」。';
      } else if (!pwa.canPromptInstall) {
        message.textContent = '若沒有看到安裝按鈕，請使用瀏覽器選單中的「安裝應用程式」或「加到主畫面」。';
      }
    };
    button.addEventListener('click', async () => {
      if (pwa.isInstalled) { sync(); return; }
      if (pwa.canPromptInstall) {
        button.disabled = true;
        message.textContent = '正在開啟瀏覽器安裝功能…';
        const outcome = await pwa.promptInstall();
        button.disabled = false;
        message.textContent = outcome === 'accepted' ? '安裝完成。' : '尚未安裝，你可以稍後再試。';
        sync();
        return;
      }
      sync();
    });
    sync();
  }

  window.DownloadStarryInstallUI = Object.freeze({mount});
})();
