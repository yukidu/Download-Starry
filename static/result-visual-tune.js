'use strict';
(() => {
  if (window.DownloadStarryResultVisualTune) return;

  const install = () => {
    if (document.getElementById('downloadstarry-result-visual-tune-style')) return;
    const style = document.createElement('style');
    style.id = 'downloadstarry-result-visual-tune-style';
    style.textContent = `
#video-download-actions{
  display:block!important;
  width:100%!important;
  max-width:none!important;
  margin-left:0!important;
  margin-right:0!important;
  box-sizing:border-box!important;
}
#video-download-actions .download-action-grid{
  display:grid!important;
  width:100%!important;
  max-width:none!important;
  grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
  column-gap:10px!important;
  row-gap:12px!important;
  justify-items:stretch!important;
  align-items:stretch!important;
  box-sizing:border-box!important;
}
#video-download-actions .resource-action-group{
  width:100%!important;
  min-width:0!important;
  max-width:none!important;
  justify-self:stretch!important;
  box-sizing:border-box!important;
  padding:10px!important;
  border-radius:20px!important;
  box-shadow:0 10px 26px rgba(28,35,76,.08)!important;
}
#video-download-actions .resource-action-group-video{
  background:linear-gradient(145deg,rgba(244,224,255,.92),rgba(233,226,255,.76))!important;
  border:1px solid rgba(151,92,235,.20)!important;
}
#video-download-actions .resource-action-group-audio{
  background:linear-gradient(145deg,rgba(220,246,255,.94),rgba(217,238,255,.78))!important;
  border:1px solid rgba(61,151,224,.20)!important;
}
#video-download-actions .resource-action-group-label{
  margin:0 0 7px!important;
  font:900 25px/1.05 "Noto Sans TC",sans-serif!important;
  letter-spacing:.06em!important;
  text-align:center!important;
}
#video-download-actions .resource-action-group-video .resource-action-group-label{
  color:#7a41ce!important;
}
#video-download-actions .resource-action-group-audio .resource-action-group-label{
  color:#2a79bf!important;
}
#video-download-actions .resource-action-group-buttons{
  display:grid!important;
  width:100%!important;
  min-width:0!important;
  max-width:none!important;
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
  gap:8px!important;
  justify-content:stretch!important;
  align-items:stretch!important;
  box-sizing:border-box!important;
}
#video-download-actions .resource-action-group .download-action-button{
  min-height:72px!important;
  width:100%!important;
  min-width:0!important;
  max-width:none!important;
  padding:9px 4px!important;
  border-radius:16px!important;
  font-size:14px!important;
  justify-self:stretch!important;
  box-sizing:border-box!important;
}
#video-download-actions .resource-action-group-video .download-action-button{
  background:linear-gradient(145deg,#7447d7,#5d43c7)!important;
  color:#fff!important;
  box-shadow:0 8px 18px rgba(100,70,205,.20)!important;
}
#video-download-actions .resource-action-group-audio .download-action-button{
  background:linear-gradient(145deg,#2f8bd6,#2f9fb5)!important;
  color:#fff!important;
  box-shadow:0 8px 18px rgba(47,139,214,.18)!important;
}
#video-download-actions .resource-share-icon{
  width:34px!important;
  height:34px!important;
  flex-basis:34px!important;
}
#video-download-actions .report-download-button{
  min-height:56px!important;
  margin-top:2px!important;
  border:1px solid rgba(95,116,151,.20)!important;
  background:linear-gradient(145deg,rgba(230,237,248,.96),rgba(218,228,243,.92))!important;
  color:#53637c!important;
  box-shadow:0 7px 18px rgba(59,78,112,.08)!important;
}
#video-download-actions .report-download-button:hover{
  background:linear-gradient(145deg,rgba(224,233,246,.98),rgba(210,222,240,.94))!important;
  color:#43546f!important;
}
@media(max-width:650px){
  #video-download-actions .download-action-grid{
    column-gap:8px!important;
  }
  #video-download-actions .resource-action-group{
    padding:8px 6px 9px!important;
    border-radius:18px!important;
  }
  #video-download-actions .resource-action-group-label{
    margin-bottom:6px!important;
    font-size:23px!important;
    line-height:1!important;
  }
  #video-download-actions .resource-action-group-buttons{
    gap:5px!important;
  }
  #video-download-actions .resource-action-group .download-action-button{
    min-height:70px!important;
    padding:8px 1px!important;
    font-size:13px!important;
    border-radius:15px!important;
  }
  #video-download-actions .resource-share-icon{
    width:33px!important;
    height:33px!important;
    flex-basis:33px!important;
  }
  #video-download-actions .report-download-button{
    min-height:54px!important;
    font-size:14px!important;
  }
}
@media(max-width:380px){
  #video-download-actions .resource-action-group{
    padding-left:4px!important;
    padding-right:4px!important;
  }
  #video-download-actions .resource-action-group-label{
    font-size:21px!important;
  }
  #video-download-actions .resource-action-group .download-action-button{
    min-height:68px!important;
    font-size:12px!important;
  }
}
`;
    document.head.appendChild(style);
  };

  const syncActionWidth = () => {
    const actions = document.getElementById('video-download-actions');
    const grid = actions?.querySelector('.download-action-grid');
    const audioGroup = actions?.querySelector('.resource-action-group-audio');
    const clearButton = document.getElementById('clear-url-button');
    const lastButton = document.getElementById('share-audio-button');
    if (!actions || !grid || !audioGroup || !clearButton || !lastButton) return;

    actions.style.width = '100%';
    grid.style.width = '100%';

    const actionRect = actions.getBoundingClientRect();
    const clearRect = clearButton.getBoundingClientRect();
    const lastRect = lastButton.getBoundingClientRect();
    const audioRect = audioGroup.getBoundingClientRect();
    const viewportRight = document.documentElement.clientWidth - 10;
    const targetRight = Math.min(clearRect.right, viewportRight);
    const rightInset = Math.max(0, audioRect.right - lastRect.right);
    const desired = Math.max(240, Math.min(targetRight - actionRect.left + rightInset, viewportRight - actionRect.left));

    actions.style.width = `${Math.floor(desired)}px`;
    grid.style.width = '100%';
  };

  const scheduleSync = () => requestAnimationFrame(() => requestAnimationFrame(syncActionWidth));

  install();
  scheduleSync();
  window.addEventListener('resize', scheduleSync, {passive:true});
  window.addEventListener('orientationchange', scheduleSync, {passive:true});
  if (window.ResizeObserver) {
    const urlRow = document.querySelector('.url-row');
    if (urlRow) new ResizeObserver(scheduleSync).observe(urlRow);
  }

  window.DownloadStarryResultVisualTune = Object.freeze({install, syncActionWidth});
})();
