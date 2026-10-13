'use strict';
(()=>{
if(window.DownloadStarryMemberShell)return;
const h=document.head,load=src=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(new Error(`無法載入 ${src}`));h.appendChild(s)});let uiP,pushP;
const ui=async()=>{uiP||=Promise.all([load('/static/member-platform.js'),load('/static/member-api.js')]).then(()=>load('/static/member-report.js'));await uiP;return window.DownloadStarryReportUI};
const push=async()=>{pushP||=load('/static/push-notifications.js');await pushP;return window.DownloadStarryPushUI};
const mount=async()=>{await(await ui()).mount();await(await push()).mount?.();};
window.DownloadStarryMemberShell=Object.freeze({mount});
})();
