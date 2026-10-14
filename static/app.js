(()=>{
  const source=document.getElementById('url');
  if(source&&source.tagName==='INPUT'){
    const field=document.createElement('textarea');
    for(const attr of Array.from(source.attributes)){
      if(attr.name!=='type') field.setAttribute(attr.name,attr.value);
    }
    field.rows=1;
    field.inputMode='url';
    field.spellcheck=false;
    field.wrap='soft';
    field.value=source.value;
    source.replaceWith(field);

    const style=document.createElement('style');
    style.id='downloadstarry-url-wrap-style';
    style.textContent=`
.url-row textarea#url{
  width:100%;
  min-width:0;
  flex:1 1 100%;
  min-height:46px;
  max-height:none;
  margin:0;
  padding:11px 10px;
  border:0;
  outline:0;
  resize:none;
  overflow-x:hidden;
  overflow-y:hidden;
  background:transparent;
  color:var(--ink);
  font:700 16px/1.35 "Noto Sans TC",sans-serif;
  white-space:pre-wrap;
  overflow-wrap:anywhere;
  word-break:break-all;
}
.url-row textarea#url::placeholder{
  color:color-mix(in srgb,var(--muted) 75%,transparent);
}
@media(max-width:700px){
  .url-row textarea#url{
    flex-basis:100%;
    padding:10px 8px;
    font-size:15px;
    line-height:1.35;
  }
}
`;
    document.head.appendChild(style);

    const resizeUrlField=()=>{
      const cs=getComputedStyle(field);
      const lineHeight=parseFloat(cs.lineHeight)||21;
      const padding=(parseFloat(cs.paddingTop)||0)+(parseFloat(cs.paddingBottom)||0);
      const maxHeight=Math.ceil(lineHeight*3+padding+2);
      field.style.height='auto';
      const target=Math.min(field.scrollHeight,maxHeight);
      field.style.height=`${Math.max(Math.ceil(lineHeight+padding),Math.ceil(target))}px`;
      field.style.overflowY=field.scrollHeight>maxHeight?'auto':'hidden';
    };
    field.addEventListener('input',resizeUrlField);
    field.addEventListener('change',resizeUrlField);
    field.addEventListener('keydown',event=>{
      if(event.key==='Enter'){
        event.preventDefault();
        field.form?.requestSubmit();
      }
    });
    window.addEventListener('resize',resizeUrlField,{passive:true});
    requestAnimationFrame(resizeUrlField);
    window.DownloadStarryUrlField=Object.freeze({resize:resizeUrlField});
  }

  let h=document.head,
    L=s=>new Promise((r,j)=>{let e=document.createElement('script');e.src=s;e.onload=r;e.onerror=()=>j(Error(s));h.append(e)}),
    S=['/static/platform.js','/static/api.js','/static/app-core.js'];
  h.insertAdjacentHTML('beforeend','<link rel="manifest" href="/static/manifest.webmanifest"><meta name="theme-color" content="#0b1026"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">');
  S.forEach(s=>{let e=document.createElement('link');e.rel='preload';e.as='script';e.href=s;h.append(e)});
  Promise.all([L(S[0]),L(S[1])]).then(async()=>{
    for(let s of ['/static/toolbar.js','/static/report-gate.js','/static/header-member-fix.js']) await L(s);
    let a=L(S[2]),b=window.DownloadStarryToolbar?.resume?.()||0,c=window.DownloadStarryHeaderFix?.resume?.()||0;
    await Promise.all([a,b,c]);
    if(location.pathname==='/'){
      let r=document.querySelector('#result'),o=new MutationObserver(()=>{
        if(!r.hidden){
          o.disconnect();
          L('/static/resource-actions.js?v=20261015-5')
            .then(()=>L('/static/result-polish.js?v=20261015-5'))
            .then(()=>L('/static/result-visual-tune.js?v=20261015-5'))
            .catch(e=>console.error('Download Starry result UI failed',e));
        }
      });
      o.observe(r,{attributes:1});
      if(sessionStorage.getItem('downloadstarry.redownload.v1')){
        await L('/static/history-redownload.js');
        await window.DownloadStarryRedownload?.resume?.();
      }
    }
  }).catch(e=>{
    console.error('Download Starry bootstrap failed',e);
    let x=document.querySelector('#message');
    if(x){x.textContent='程式載入未完成，請重新整理頁面後再試';x.classList.add('show')}
  });
})();