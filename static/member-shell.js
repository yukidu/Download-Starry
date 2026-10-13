'use strict';
(()=>{
if(window.DownloadStarryMemberShell)return;
const h=document.head,load=src=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(new Error(`無法載入 ${src}`));h.appendChild(s)});let uiP;
const ui=async()=>{uiP||=Promise.all([load('/static/member-platform.js'),load('/static/member-api.js')]).then(()=>load('/static/member-report.js'));await uiP;return window.DownloadStarryReportUI};
const menu=document.querySelector('.main-menu-panel'),theme=document.getElementById('menu-theme-toggle');function row(id,label,icon){let b=document.getElementById(id);if(!b&&menu){b=document.createElement('button');b.id=id;b.className='main-menu-row';b.type='button';b.setAttribute('role','menuitem');b.innerHTML=`<span aria-hidden="true">${icon}</span><span>${label}</span>`;theme?theme.before(b):menu.appendChild(b)}return b}
const member=row('starry-member-button','Starry ID 登入','★'),manual=row('menu-report-button','回報無法下載','!');
member?.addEventListener('click',async()=>{try{await(await ui()).account()}catch(e){console.error('Starry ID UI failed',e)}});manual?.addEventListener('click',async()=>{try{await(await ui()).open({source:'manual'})}catch(e){console.error('Report UI failed',e)}});
const a=document.getElementById('download-audio-button');let report=document.getElementById('report-download-button');if(a&&!report){report=document.createElement('button');report.id='report-download-button';report.className='download-button download-action-button report-download-button';report.type='button';report.innerHTML='<span>!</span> 無法下載';a.before(report);report.parentElement?.style.setProperty('grid-template-columns','repeat(3,minmax(0,1fr))','important')}
report?.addEventListener('click',async()=>{try{await(await ui()).open({source:'parsed',url:document.getElementById('download-url')?.value||''})}catch(e){console.error('Report UI failed',e)}});
const resume=async()=>{if(new URLSearchParams(location.search).has('starry'))await(await ui()).resume()};
window.DownloadStarryMemberShell=Object.freeze({resume});
})();
