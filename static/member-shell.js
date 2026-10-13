'use strict';
(()=>{
if(window.DownloadStarryMemberShell)return;
const h=document.head,load=src=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(new Error(`無法載入 ${src}`));h.appendChild(s)});let baseP,uiP,pushP,historyP,repairP;
const base=async()=>{baseP||=Promise.all([load('/static/member-platform.js'),load('/static/member-api.js')]);await baseP;};
const ui=async()=>{await base();uiP||=load('/static/member-report.js');await uiP;return window.DownloadStarryReportUI};
const push=async()=>{pushP||=load('/static/push-notifications.js');await pushP;return window.DownloadStarryPushUI};
const repair=async()=>{await base();repairP||=Promise.all([load('/static/repair-notifications.js'),load('/static/repair-permission-recheck.js')]);await repairP;return window.DownloadStarryRepairNotifications};
const history=async()=>{await base();historyP||=load('/static/download-history.js');await historyP;return window.DownloadStarryHistoryUI};
const fixCopy=()=>{if(location.pathname==='/report'){const p=document.querySelector('.dsr-page-head p');if(p)p.textContent='只提供給註冊會員使用；登入後可送出回報，並可選擇修復完成後通知。'}if(location.pathname==='/account'){const p=document.querySelector('.dsr-login-panel p');if(p&&p.textContent.includes('下載與回報錯誤仍可在未登入狀態使用'))p.textContent=p.textContent.replace('下載與回報錯誤仍可在未登入狀態使用。','下載功能可未登入使用；回報無法下載需登入或免費註冊 Starry ID。')}};
const mount=async()=>{if(location.pathname==='/history'){await(await history()).mount();return}await(await ui()).mount();if(location.pathname==='/report')await(await repair()).mount?.();fixCopy();await(await push()).mount?.();};
window.DownloadStarryMemberShell=Object.freeze({mount});
})();
