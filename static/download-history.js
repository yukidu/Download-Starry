'use strict';
(()=>{
if(window.DownloadStarryHistoryUI)return;
const platform=()=>window.DownloadStarryMemberPlatform,api=()=>window.DownloadStarryMemberAPI;
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const typeLabel=value=>({video:'影片',audio:'音檔',subtitle:'CC 字幕',photo:'照片'}[String(value||'').toLowerCase()]||String(value||'下載'));
const when=value=>{const n=Number(value||0);if(!n)return '';try{return new Intl.DateTimeFormat('zh-TW',{dateStyle:'medium',timeStyle:'short'}).format(new Date(n))}catch{return new Date(n).toLocaleString('zh-TW')}};
const host=value=>{try{return new URL(String(value||'')).hostname.replace(/^www\./,'')}catch{return '來源網址'}};
function mountShell(){
  document.title='下載紀錄｜繁星下載';
  const style=document.createElement('style');style.textContent=`
  .history-page{width:min(760px,calc(100% - 28px));margin:22px auto 48px}.history-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.history-title{margin:0;font-size:clamp(26px,6vw,38px);font-weight:900}.history-back{color:inherit;text-decoration:none;font-weight:800;opacity:.78}.history-note{margin:0 0 16px;opacity:.7;line-height:1.65}.history-card{border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:20px;padding:16px;margin:12px 0;background:color-mix(in srgb,Canvas 88%,transparent);box-shadow:0 10px 30px rgba(0,0,0,.06)}.history-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.history-type{font-weight:900;font-size:18px}.history-time{font-size:13px;opacity:.62;white-space:nowrap}.history-source{font-weight:800;margin-top:8px}.history-url{display:block;margin-top:6px;color:inherit;opacity:.72;text-decoration:none;word-break:break-all;font-size:13px;line-height:1.5}.history-meta{margin-top:8px;font-size:13px;opacity:.65}.history-empty,.history-login{border:1px dashed color-mix(in srgb,currentColor 22%,transparent);border-radius:22px;padding:28px 18px;text-align:center;line-height:1.7}.history-login button{margin-top:14px;border:0;border-radius:999px;padding:12px 20px;font:inherit;font-weight:900;cursor:pointer;background:#5b5cf0;color:white}@media(max-width:520px){.history-page{width:min(100% - 20px,760px);margin-top:14px}.history-card{border-radius:17px;padding:14px}.history-row{display:block}.history-time{display:block;margin-top:3px}.history-title{font-size:28px}}
  `;document.head.appendChild(style);
  const main=document.querySelector('main')||document.body;main.innerHTML=`<section class="history-page"><div class="history-head"><h1 class="history-title">下載紀錄</h1><a class="history-back" href="/">返回首頁</a></div><div id="history-content"><div class="history-empty">正在讀取下載紀錄…</div></div></section>`;
  return document.getElementById('history-content');
}
async function mount(){
  const content=mountShell();
  let session=null;try{session=await api().session()}catch{}
  if(!session?.authenticated){
    content.innerHTML='<div class="history-login"><strong>登入後即可查看自己的下載紀錄</strong><br><span>紀錄只會顯示目前 Starry ID 會員自己的下載操作。</span><br><button type="button" id="history-login">使用 Google 登入</button></div>';
    document.getElementById('history-login')?.addEventListener('click',()=>platform().auth.login({chooseAccount:true}));
    return;
  }
  let data;try{data=await api().downloadHistory()}catch(error){content.innerHTML=`<div class="history-empty">${esc(error?.message||'無法讀取下載紀錄')}</div>`;return}
  const rows=Array.isArray(data?.history)?data.history:[];
  if(!rows.length){content.innerHTML='<p class="history-note">之後以這個會員身份開始下載的影片、音檔或字幕，會顯示在這裡。</p><div class="history-empty">目前還沒有下載紀錄。</div>';return}
  content.innerHTML='<p class="history-note">以下顯示目前會員最近 100 筆下載紀錄。</p>'+rows.map(row=>`<article class="history-card"><div class="history-row"><span class="history-type">${esc(typeLabel(row.type))}</span><time class="history-time">${esc(when(row.createdAt))}</time></div><div class="history-source">${esc(host(row.url))}</div><a class="history-url" href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">${esc(row.url)}</a>${row.quality||row.subtitle?`<div class="history-meta">${row.quality?`畫質：${esc(row.quality)}`:''}${row.quality&&row.subtitle?'　':''}${row.subtitle?`字幕：${esc(row.subtitle)}`:''}</div>`:''}</article>`).join('');
}
window.DownloadStarryHistoryUI=Object.freeze({mount});
})();
