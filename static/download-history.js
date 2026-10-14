'use strict';
(()=>{
if(window.DownloadStarryHistoryUI)return;
const platform=()=>window.DownloadStarryMemberPlatform,api=()=>window.DownloadStarryMemberAPI,device=()=>window.SaveVideoPlatform;
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const typeLabel=value=>({video:'影片',audio:'音檔',subtitle:'CC 字幕',photo:'照片',image:'照片',report:'回報無法下載'}[String(value||'').toLowerCase()]||String(value||'下載'));
const statusLabel=value=>({new:'待處理',in_progress:'處理中',resolved:'已修復'}[String(value||'').toLowerCase()]||'');
const qualityLabel=value=>{const raw=String(value||'').trim();if(!raw)return '';if(raw==='best')return '最佳畫質';if(raw==='original')return '原始畫質';if(/^\d+$/.test(raw))return `${raw}p`;return raw};
const when=value=>{const n=Number(value||0);if(!n)return '';try{return new Intl.DateTimeFormat('zh-TW',{dateStyle:'medium',timeStyle:'short'}).format(new Date(n))}catch{return new Date(n).toLocaleString('zh-TW')}};
const safeHttp=value=>{try{const url=new URL(String(value||''));return /^https?:$/.test(url.protocol)?url.href:''}catch{return ''}};
const host=value=>{try{return new URL(String(value||'')).hostname.replace(/^www\./,'')}catch{return '來源網址'}};
function mountShell(){
  document.title='下載紀錄｜繁星下載';
  const style=document.createElement('style');style.textContent=`
  .history-page{width:min(820px,calc(100% - 28px));margin:22px auto 48px}.history-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.history-title{margin:0;font-size:clamp(26px,6vw,38px);font-weight:900}.history-back{color:inherit;text-decoration:none;font-weight:800;opacity:.78}.history-note{margin:0 0 16px;opacity:.7;line-height:1.65}.history-card{border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:20px;padding:16px;margin:12px 0;background:color-mix(in srgb,Canvas 88%,transparent);box-shadow:0 10px 30px rgba(0,0,0,.06)}.history-card.is-report{border-color:color-mix(in srgb,var(--accent,currentColor) 42%,transparent)}.history-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.history-type{font-weight:900;font-size:18px}.history-time{font-size:13px;opacity:.62;white-space:nowrap}.history-media{display:grid;grid-template-columns:148px minmax(0,1fr);gap:14px;margin-top:12px;align-items:start}.history-thumb{width:148px;aspect-ratio:16/9;border-radius:13px;overflow:hidden;background:color-mix(in srgb,currentColor 8%,transparent);display:grid;place-items:center}.history-thumb img{width:100%;height:100%;display:block;object-fit:cover}.history-thumb span{font-size:12px;opacity:.5}.history-link-title{display:block;color:inherit;text-decoration:none;font-size:16px;font-weight:900;line-height:1.45;word-break:break-word}.history-source{font-size:13px;font-weight:800;margin-top:5px;opacity:.78}.history-url{display:block;margin-top:5px;color:inherit;opacity:.62;text-decoration:none;word-break:break-all;font-size:12px;line-height:1.5}.history-meta{margin-top:8px;font-size:13px;opacity:.7}.history-badges{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.history-status,.history-watch{display:inline-flex;align-items:center;padding:4px 9px;border-radius:999px;font-size:12px;font-weight:800;background:color-mix(in srgb,var(--accent,currentColor) 12%,transparent);color:var(--accent,currentColor)}.history-watch{background:color-mix(in srgb,currentColor 8%,transparent);color:inherit;opacity:.78}.history-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.history-action{appearance:none;border:1px solid color-mix(in srgb,currentColor 20%,transparent);border-radius:11px;background:color-mix(in srgb,Canvas 92%,transparent);color:inherit;padding:9px 13px;font:800 13px/1 inherit;cursor:pointer}.history-action.primary{background:var(--accent,#7568f8);border-color:transparent;color:#fff}.history-action:disabled{opacity:.55;cursor:default}.history-empty,.history-login{border:1px dashed color-mix(in srgb,currentColor 22%,transparent);border-radius:22px;padding:28px 18px;text-align:center;line-height:1.7}.history-login button{margin-top:14px;border:0;border-radius:999px;padding:12px 20px;font:inherit;font-weight:900;cursor:pointer;background:#5b5cf0;color:white}@media(max-width:560px){.history-page{width:min(100% - 20px,820px);margin-top:14px}.history-card{border-radius:17px;padding:14px}.history-row{display:block}.history-time{display:block;margin-top:3px}.history-title{font-size:28px}.history-media{grid-template-columns:112px minmax(0,1fr);gap:11px}.history-thumb{width:112px;border-radius:11px}.history-link-title{font-size:15px}.history-actions{display:grid;grid-template-columns:1fr 1fr}.history-action{width:100%;padding:10px 8px}}
  `;document.head.appendChild(style);
  const main=document.querySelector('main')||document.body;main.innerHTML=`<section class="history-page"><div class="history-head"><h1 class="history-title">下載紀錄</h1><a class="history-back" href="/">返回首頁</a></div><div id="history-content"><div class="history-empty">正在讀取下載紀錄…</div></div></section>`;
  return document.getElementById('history-content');
}
function card(row,index){
  const isReport=row.recordKind==='report'||row.type==='report';
  const status=isReport?statusLabel(row.status):'';
  const url=safeHttp(row.url);
  const thumb=safeHttp(row.thumbnail);
  const title=String(row.title||'').trim()||host(row.url);
  const q=qualityLabel(row.quality);
  const metadata=[q?`畫質：${q}`:'',row.subtitle?`字幕：${String(row.subtitle)}`:''].filter(Boolean).join('　');
  return `<article class="history-card${isReport?' is-report':''}" data-index="${index}"><div class="history-row"><span class="history-type">${esc(typeLabel(row.type))}</span><time class="history-time">${esc(when(row.createdAt))}</time></div><div class="history-media"><div class="history-thumb">${thumb?`<img src="${esc(thumb)}" alt="${esc(title)} 預覽縮圖" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>無預覽</span>`:'<span>無預覽</span>'}</div><div><a class="history-link-title" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a><div class="history-source">${esc(host(row.url))}</div><a class="history-url" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(row.url)}</a>${metadata?`<div class="history-meta">${esc(metadata)}</div>`:''}<div class="history-badges">${status?`<span class="history-status">${esc(status)}</span>`:''}${isReport&&Number(row.watching)===1?'<span class="history-watch">修復後會通知</span>':''}</div></div></div><div class="history-actions"><button type="button" class="history-action primary history-redownload" data-index="${index}">重新下載</button><button type="button" class="history-action history-share" data-index="${index}">分享</button></div></article>`;
}
function bindActions(content,rows){
  content.querySelectorAll('.history-redownload').forEach(button=>button.addEventListener('click',()=>{
    const row=rows[Number(button.dataset.index)];if(!row?.url)return;
    try{sessionStorage.setItem('downloadstarry.redownload.v1',JSON.stringify({url:row.url,type:row.type==='report'?'video':row.type,quality:row.quality||'best',subtitle:row.subtitle||''}))}catch(_){}
    location.assign('/');
  }));
  content.querySelectorAll('.history-share').forEach(button=>button.addEventListener('click',async()=>{
    const row=rows[Number(button.dataset.index)];if(!row?.url)return;
    const original=button.textContent;button.disabled=true;
    try{
      const title=String(row.title||'').trim()||`${typeLabel(row.type)}｜繁星下載`;
      const result=await device()?.share?.share?.({title,text:title,url:row.url});
      button.textContent=result?.mode==='copied'?'已複製連結':'已分享';
      setTimeout(()=>{button.textContent=original;button.disabled=false},1400);
    }catch(error){
      if(error?.name==='AbortError'){button.disabled=false;return}
      button.textContent='分享失敗';setTimeout(()=>{button.textContent=original;button.disabled=false},1400);
    }
  }));
}
async function mount(){
  const content=mountShell();
  let session=null;try{session=await api().session()}catch{}
  if(!session?.authenticated){
    content.innerHTML='<div class="history-login"><strong>登入後即可查看自己的下載紀錄</strong><br><span>紀錄只會顯示目前 Starry ID 會員自己的下載與回報操作。</span><br><button type="button" id="history-login">使用 Google 登入</button></div>';
    document.getElementById('history-login')?.addEventListener('click',()=>platform().auth.login({chooseAccount:true}));
    return;
  }
  let data;try{data=await api().downloadHistory()}catch(error){content.innerHTML=`<div class="history-empty">${esc(error?.message||'無法讀取下載紀錄')}</div>`;return}
  const rows=Array.isArray(data?.history)?data.history:[];
  if(!rows.length){content.innerHTML='<p class="history-note">之後以這個會員身份開始下載影片、音檔、字幕，或送出「回報無法下載」，都會顯示在這裡。</p><div class="history-empty">目前還沒有下載或回報紀錄。</div>';return}
  content.innerHTML='<p class="history-note">以下顯示目前會員最近 100 筆下載與回報紀錄。</p>'+rows.map(card).join('');
  bindActions(content,rows);
}
window.DownloadStarryHistoryUI=Object.freeze({mount});
})();
