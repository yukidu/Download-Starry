'use strict';
(()=>{
if(window.DownloadStarryRedownload)return;
const KEY='downloadstarry.redownload.v1';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function resume(){
  if(location.pathname!=='/')return;
  let item=null;try{item=JSON.parse(sessionStorage.getItem(KEY)||'null')}catch(_){}
  try{sessionStorage.removeItem(KEY)}catch(_){}
  if(!item?.url)return;
  const input=document.getElementById('url'),form=document.getElementById('lookup-form'),result=document.getElementById('result');
  if(!input||!form||!result)return;
  input.value=String(item.url);
  input.dispatchEvent(new Event('input',{bubbles:true}));
  form.requestSubmit();
  const started=Date.now();
  while(result.hidden&&Date.now()-started<30000)await wait(120);
  if(result.hidden)return;
  const quality=document.getElementById('quality');if(quality&&item.quality)quality.value=String(item.quality);
  const subtitle=document.getElementById('subtitle-language');if(subtitle&&item.subtitle){const exists=Array.from(subtitle.options||[]).some(option=>option.value===String(item.subtitle));if(exists)subtitle.value=String(item.subtitle)}
  const id=({video:'download-video-button',audio:'download-audio-button',image:'download-image-button',photo:'download-image-button',subtitle:'download-subtitle-button'})[String(item.type||'video').toLowerCase()]||'download-video-button';
  const button=document.getElementById(id);
  if(button&&!button.hidden&&!button.disabled)button.click();
}
window.DownloadStarryRedownload=Object.freeze({resume});
})();
