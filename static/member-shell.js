'use strict';
(()=>{
if(window.DownloadStarryMemberShell)return;
const h=document.head,load=src=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(new Error(`無法載入 ${src}`));h.appendChild(s)});let baseP,uiP,pushP,historyP;
const base=async()=>{baseP||=Promise.all([load('/static/member-platform.js'),load('/static/member-api.js')]);await baseP;};
const ui=async()=>{await base();uiP||=load('/static/member-report.js');await uiP;return window.DownloadStarryReportUI};
const push=async()=>{pushP||=load('/static/push-notifications.js');await pushP;return window.DownloadStarryPushUI};
const history=async()=>{await base();historyP||=load('/static/download-history.js');await historyP;return window.DownloadStarryHistoryUI};
const mount=async()=>{
  if(location.pathname==='/history'){await(await history()).mount();return}
  await(await ui()).mount();
  if(location.pathname==='/account')await(await push()).mount?.();
};
window.DownloadStarryMemberShell=Object.freeze({mount});
})();
