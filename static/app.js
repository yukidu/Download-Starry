(()=>{
  const route=location.pathname;
  const home=route==='/';
  const deepRoutes=new Set(['/account','/report','/install','/history']);
  const deep=deepRoutes.has(route);
  const main=document.querySelector('main');
  if(deep&&main){main.style.visibility='hidden';main.setAttribute('aria-busy','true')}

  if(home){
    const u=document.getElementById('url');
    if(u?.type){
      const t=document.createElement('textarea');
      for(const a of u.attributes)if(a.name!=='type')t.setAttribute(a.name,a.value);
      t.value=u.value;u.replaceWith(t);
    }
  }

  const h=document.head;
  const load=src=>new Promise((resolve,reject)=>{
    const e=document.createElement('script');e.src=src;e.onload=resolve;e.onerror=reject;h.append(e);
  });
  const platform='/static/platform.js',api='/static/api.js',core='/static/app-core.js';
  h.insertAdjacentHTML('beforeend','<link rel="manifest" href="/static/manifest.webmanifest"><meta name="theme-color" content="#0b1026"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">');
  [platform,api,...(home?[core]:[])].forEach(src=>{const e=document.createElement('link');e.rel='preload';e.as='script';e.href=src;h.append(e)});
  if(home)load('/static/url-field-wrap.js?6');

  Promise.all([load(platform),load(api)]).then(async()=>{
    for(const src of ['/static/toolbar.js','/static/report-gate.js','/static/header-member-fix.js'])await load(src);
    if(home)await load('/static/ui-stability.js?v=20261015-1');

    const coreTask=home?load(core):Promise.resolve();
    const routeTask=Promise.all([
      window.DownloadStarryToolbar?.resume?.(),
      window.DownloadStarryHeaderFix?.resume?.(),
    ]);
    const gateTask=route==='/report'
      ? window.DownloadStarryReportGate?.syncSuperAdminAccess?.()
      : Promise.resolve(true);
    const [, , allowed]=await Promise.all([coreTask,routeTask,gateTask]);

    if(deep&&main&&(route!=='/report'||allowed!==false)){
      main.style.visibility='';main.removeAttribute('aria-busy');
    }

    if(home){
      const r=document.querySelector('#result');
      if(r){
        const o=new MutationObserver(()=>{
          if(!r.hidden){
            o.disconnect();r.style.opacity=0;
            load('/static/result-loader.js?e').then(()=>DownloadStarryResultReady).finally(()=>r.style.opacity=1);
          }
        });
        o.observe(r,{attributes:true});
      }
      if(sessionStorage.getItem('downloadstarry.redownload.v1')){
        await load('/static/history-redownload.js');
        await window.DownloadStarryRedownload?.resume?.();
      }
    }
  }).catch(()=>{
    if(main){main.style.visibility='';main.removeAttribute('aria-busy')}
    const x=document.querySelector('#message');if(x){x.textContent='請重新整理';x.classList.add('show')}
  });
})()
