'use strict';
(()=>{
if(window.DownloadStarryHeaderFix)return;
const head=document.head;
const style=document.createElement('style');style.textContent='#top-login-button[hidden],.top-member-rank[hidden]{display:none!important}.support-developer-button,.support-button-copy,.support-button-copy span,.support-button-divider{font-weight:400!important}';head.appendChild(style);
const menu=document.querySelector('.main-menu-panel');
if(menu&&!document.getElementById('menu-history-button')){
  const button=document.createElement('button');
  button.id='menu-history-button';button.className='main-menu-row';button.type='button';button.setAttribute('role','menuitem');
  button.innerHTML='<span aria-hidden="true">↺</span><span>下載紀錄</span>';
  const before=document.getElementById('install-app-button')||document.getElementById('menu-theme-toggle');
  before?before.before(button):menu.appendChild(button);
  button.addEventListener('click',()=>location.assign('/history'));
}
const topLogin=document.getElementById('top-login-button');
if(topLogin){
  const label=topLogin.querySelector('span:last-child');
  if(label)label.textContent='按此註冊或登入';
  topLogin.title='按此註冊或登入';topLogin.setAttribute('aria-label','按此註冊或登入');
}
const authRow=document.getElementById('starry-member-button');
const authLabel=authRow?.querySelector('span:last-child');
if(menu&&authRow)menu.appendChild(authRow);
let authenticated=false;
const endpoint=path=>window.SaveVideoAPI?.endpoint?.(path)||path;
const syncMenuAuth=async()=>{
  try{
    const response=await fetch(endpoint('/api/auth/starry/session'),{cache:'no-store'});
    const data=response.ok?await response.json().catch(()=>({})):{};
    authenticated=Boolean(response.ok&&data?.authenticated);
  }catch(_){authenticated=false}
  if(authLabel)authLabel.textContent=authenticated?'登出':'登入';
  if(authRow){authRow.title=authenticated?'登出 Starry ID':'登入 Starry ID';authRow.setAttribute('aria-label',authRow.title);if(menu)menu.appendChild(authRow)}
};
if(authRow){authRow.addEventListener('click',async event=>{
  event.preventDefault();event.stopImmediatePropagation();
  if(!authenticated){location.assign('/account');return}
  authRow.disabled=true;
  try{await fetch(endpoint('/api/auth/starry/logout'),{method:'POST'});authenticated=false;location.assign('/')}
  catch(_){authRow.disabled=false;location.assign('/account')}
},true)}
const parsedReport=document.getElementById('report-download-button');
if(parsedReport){parsedReport.addEventListener('click',()=>{
  const url=String(document.getElementById('url')?.value||'').trim();
  const title=String(document.getElementById('title')?.textContent||'').trim();
  const thumb=document.getElementById('thumbnail');
  const thumbnail=String(!thumb?.hidden?thumb?.src||'':'').trim();
  try{sessionStorage.setItem('downloadstarry.report-metadata.v1',JSON.stringify({url,title,thumbnail}))}catch(_){}
},true)}
const emptyRanks=new Set(['','無','會員','—','-','none','null']);
const normalizeMemberHeader=()=>{
  const login=document.getElementById('top-login-button');
  const member=document.getElementById('top-member-summary');
  const rank=document.querySelector('.top-member-rank');
  if(member&&!member.hidden&&login&&!login.hidden)login.hidden=true;
  if(rank){
    const value=String(rank.textContent||'').trim();
    const shouldHide=emptyRanks.has(value.toLowerCase())||emptyRanks.has(value);
    if(rank.hidden!==shouldHide)rank.hidden=shouldHide;
  }
};
normalizeMemberHeader();syncMenuAuth();
const observer=new MutationObserver(normalizeMemberHeader);observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden']});
let shellPromise;
const load=src=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(new Error(`無法載入 ${src}`));head.appendChild(s)});
const resume=async()=>{if(location.pathname!=='/history')return;shellPromise||=load('/static/member-shell.js');await shellPromise;await window.DownloadStarryMemberShell?.mount?.()};
window.DownloadStarryHeaderFix=Object.freeze({resume,normalizeMemberHeader,syncMenuAuth});
})();
