'use strict';
(() => {
  const head = document.head;
  const mark=document.querySelector('.site-brand-mark');
  if(mark){mark.replaceChildren();mark.style.cssText+=';background:url(/static/app-icon.svg?v=4) center/cover;box-shadow:none'}
  head.insertAdjacentHTML('beforeend','<style>body.dark-theme .site-brand-mark{outline:1px solid #263158;outline-offset:1px}.report-download-button{background:var(--soft-bg)!important;color:var(--ink)!important;border:1px solid var(--line)!important}</style><link rel="manifest" href="/static/manifest.webmanifest"><meta name="theme-color" content="#0b1026"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">');

  document.querySelectorAll('.support-button-copy span').forEach(node=>{if(node.textContent.includes('贊助開發者'))node.textContent='請開發者喝杯咖啡'});
  const pasteButton=document.getElementById('paste-url-button'),lookupButton=document.getElementById('lookup-button'),clearButton=document.getElementById('clear-url-button');
  if(pasteButton&&lookupButton&&clearButton){pasteButton.after(lookupButton);lookupButton.after(clearButton)}

  const videoButton=document.getElementById('download-video-button'),audioButton=document.getElementById('download-audio-button');
  let reportButton=document.getElementById('report-download-button');
  if(videoButton&&audioButton&&!reportButton){
    reportButton=document.createElement('button');reportButton.id='report-download-button';reportButton.className='download-button download-action-button report-download-button';reportButton.type='button';reportButton.innerHTML='<span>!</span> 無法下載';audioButton.before(reportButton);
    reportButton.parentElement?.style.setProperty('grid-template-columns','repeat(3,minmax(0,1fr))','important');
  }

  const menu = document.querySelector('.main-menu-panel');
  const themeRow = document.getElementById('menu-theme-toggle');
  const makeMenuRow=(id,label,svg)=>{let button=document.getElementById(id);if(!button&&menu){button=document.createElement('button');button.id=id;button.className='main-menu-row';button.type='button';button.setAttribute('role','menuitem');button.innerHTML=`${svg}<span>${label}</span>`;if(themeRow)themeRow.before(button);else menu.appendChild(button)}return button};
  const memberButton=makeMenuRow('starry-member-button','Starry ID 登入','<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 21c.8-4 3.4-6 8-6s7.2 2 8 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>');
  const menuReportButton=makeMenuRow('menu-report-button','回報無法下載','<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.8 20h18.4L12 3Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 9v5m0 3h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>');
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
  const baseReady=Promise.all([load(sources[0]),load(sources[1])]);
  let installUiPromise = null,memberUiPromise=null;
  const memberUi=async()=>{await baseReady;memberUiPromise||=load('/static/member-report.js');await memberUiPromise;return window.DownloadStarryReportUI};
  const syncInstallButton = () => {
    if (!installButton) return;
    const installed = Boolean(window.SaveVideoPlatform?.pwa?.isInstalled);
    installButton.style.opacity = installed ? '.45' : '';
    installButton.setAttribute('aria-disabled', String(installed));
    installButton.title = installed ? '你已安裝' : '安裝到桌面';
  };
  installButton?.addEventListener('click', async () => {
    try {
      await baseReady;
      installUiPromise ||= load('/static/install-pwa.js');
      await installUiPromise;
      await window.DownloadStarryInstallUI?.(installButton);
      syncInstallButton();
    } catch (error) { console.error('Download Starry install UI failed', error); }
  });
  memberButton?.addEventListener('click',async()=>{try{await (await memberUi()).account()}catch(error){console.error('Starry ID UI failed',error)}});
  menuReportButton?.addEventListener('click',async()=>{try{await (await memberUi()).open({source:'manual'})}catch(error){console.error('Report UI failed',error)}});
  reportButton?.addEventListener('click',async()=>{try{await (await memberUi()).open({source:'parsed',url:document.getElementById('download-url')?.value||''})}catch(error){console.error('Report UI failed',error)}});

  baseReady.then(() => {
    syncInstallButton();
    const core=load(sources[2]);
    const resume=new URLSearchParams(location.search).has('starry')?memberUi().then(ui=>ui.resume()):Promise.resolve();
    return Promise.all([core,resume]);
  }).catch(error => {
    console.error('Download Starry bootstrap failed', error);
    const message = document.getElementById('message');
    if (!message) return;
    message.textContent = '程式載入未完成，請重新整理頁面後再試';
    message.classList.add('show');
  });
})();
