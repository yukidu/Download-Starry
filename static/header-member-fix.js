'use strict';
(()=>{
if(window.DownloadStarryHeaderFix)return;
const head=document.head;
const style=document.createElement('style');style.textContent='#top-login-button[hidden],.top-member-rank[hidden]{display:none!important}';head.appendChild(style);
const menu=document.querySelector('.main-menu-panel');
if(menu&&!document.getElementById('menu-history-button')){
  const button=document.createElement('button');
  button.id='menu-history-button';button.className='main-menu-row';button.type='button';button.setAttribute('role','menuitem');
  button.innerHTML='<span aria-hidden="true">↺</span><span>下載紀錄</span>';
  const before=document.getElementById('install-app-button')||document.getElementById('menu-theme-toggle');
  before?before.before(button):menu.appendChild(button);
  button.addEventListener('click',()=>location.assign('/history'));
}
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
normalizeMemberHeader();
const observer=new MutationObserver(normalizeMemberHeader);observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden']});
let shellPromise;
const load=src=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(new Error(`無法載入 ${src}`));head.appendChild(s)});
const resume=async()=>{if(location.pathname!=='/history')return;shellPromise||=load('/static/member-shell.js');await shellPromise;await window.DownloadStarryMemberShell?.mount?.()};
window.DownloadStarryHeaderFix=Object.freeze({resume,normalizeMemberHeader});
})();
