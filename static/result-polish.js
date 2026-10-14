'use strict';
(() => {
  if (window.DownloadStarryResultPolish) return;

  const result = document.getElementById('result');
  const urlInput = document.getElementById('url');
  const grid = document.querySelector('#video-download-actions .download-action-grid');
  const videoButton = document.getElementById('download-video-button');
  const shareVideo = document.getElementById('share-video-button');
  const audioButton = document.getElementById('download-audio-button');
  const shareAudio = document.getElementById('share-audio-button');
  const reportButton = document.getElementById('report-download-button');

  if (!result || !grid || !videoButton || !audioButton || !shareVideo || !shareAudio) return;

  // A 方案：四個主要操作維持 2×2，全部同尺寸，不再用外框分組。
  grid.replaceChildren(videoButton, shareVideo, audioButton, shareAudio);
  if (reportButton) grid.append(reportButton);

  const css = document.createElement('style');
  css.id = 'downloadstarry-result-polish-style';
  css.textContent = `
#video-download-actions .download-action-grid{
  display:grid!important;
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
  gap:8px!important;
  align-items:stretch!important;
}
#video-download-actions .download-action-grid>.download-action-button{
  width:100%!important;
  min-width:0!important;
  min-height:58px!important;
  padding:10px 8px!important;
  border:0!important;
  border-radius:14px!important;
  background:var(--button-bg)!important;
  color:var(--button-text)!important;
  font:800 15px/1.15 "Noto Sans TC",sans-serif!important;
  letter-spacing:0!important;
  white-space:nowrap!important;
  box-shadow:none!important;
}
#video-download-actions .download-action-grid>.download-action-button:hover{
  background:var(--button-bg)!important;
  color:var(--button-text)!important;
  filter:brightness(1.08);
}
#video-download-actions .resource-share-button{
  display:flex!important;
  flex-direction:row!important;
  align-items:center!important;
  justify-content:center!important;
  gap:7px!important;
}
#video-download-actions .resource-share-icon{
  width:22px!important;
  height:22px!important;
  flex:0 0 22px!important;
  stroke:currentColor!important;
}
#video-download-actions .report-download-button{
  grid-column:1/-1!important;
  min-height:58px!important;
  margin-top:2px!important;
  border-radius:14px!important;
  line-height:1.25!important;
  white-space:normal!important;
  background:var(--button-bg)!important;
  color:var(--button-text)!important;
}
.result{padding:12px 8px 4px!important}
.result:not([hidden]) #download-form{order:1!important}
.result:not([hidden]) .media-card{
  order:2!important;
  display:grid!important;
  grid-template-columns:190px minmax(0,1fr)!important;
  grid-template-areas:"thumb meta"!important;
  grid-template-rows:auto!important;
  column-gap:14px!important;
  row-gap:0!important;
  align-items:start!important;
  width:100%!important;
  min-height:0!important;
  margin:12px 0 0!important;
  padding:10px!important;
  border:1px solid var(--line)!important;
  border-radius:16px!important;
  background:color-mix(in srgb,var(--card) 88%,transparent)!important;
  box-shadow:0 8px 22px rgba(20,28,55,.08)!important;
}
.media-card>.thumb-wrap{
  grid-area:thumb!important;
  width:190px!important;
  height:107px!important;
  margin:0!important;
  min-width:0!important;
  align-self:start!important;
}
.media-card>.media-meta{
  grid-area:meta!important;
  width:100%!important;
  min-width:0!important;
  margin:0!important;
  padding:0!important;
  align-self:start!important;
  overflow:hidden!important;
}
.media-card>.media-meta>span{
  display:block!important;
  max-width:100%!important;
  margin:0!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  white-space:nowrap!important;
}
.media-card>.media-meta h2{
  display:-webkit-box!important;
  width:100%!important;
  max-width:100%!important;
  margin:4px 0 0!important;
  font-size:17px!important;
  line-height:1.38!important;
  white-space:normal!important;
  overflow:hidden!important;
  overflow-wrap:anywhere!important;
  word-break:break-word!important;
  -webkit-line-clamp:4!important;
  -webkit-box-orient:vertical!important;
}
.download-actions{margin-top:8px!important;gap:8px!important}
@media(max-width:650px){
  #video-download-actions .download-action-grid{gap:7px!important}
  #video-download-actions .download-action-grid>.download-action-button{
    min-height:56px!important;
    padding:9px 5px!important;
    border-radius:13px!important;
    font-size:14px!important;
  }
  #video-download-actions .resource-share-icon{
    width:20px!important;
    height:20px!important;
    flex-basis:20px!important;
  }
  .result{padding:10px 6px 3px!important}
  .result:not([hidden]) .media-card{
    grid-template-columns:minmax(118px,42%) minmax(0,1fr)!important;
    grid-template-areas:"thumb meta"!important;
    grid-template-rows:auto!important;
    column-gap:10px!important;
    margin-top:10px!important;
    padding:8px!important;
    border-radius:14px!important;
  }
  .media-card>.thumb-wrap{
    width:100%!important;
    height:auto!important;
    aspect-ratio:16/9!important;
    margin:0!important;
  }
  .media-card>.media-meta h2{
    margin-top:3px!important;
    font-size:15px!important;
    line-height:1.35!important;
    -webkit-line-clamp:4!important;
  }
}
@media(max-width:380px){
  #video-download-actions .download-action-grid{gap:6px!important}
  #video-download-actions .download-action-grid>.download-action-button{
    min-height:54px!important;
    padding-left:3px!important;
    padding-right:3px!important;
    font-size:13px!important;
  }
  #video-download-actions .resource-share-button{gap:5px!important}
  #video-download-actions .resource-share-icon{
    width:18px!important;
    height:18px!important;
    flex-basis:18px!important;
  }
  .result:not([hidden]) .media-card{
    grid-template-columns:minmax(108px,40%) minmax(0,1fr)!important;
    column-gap:8px!important;
    padding:7px!important;
  }
  .media-card>.media-meta h2{font-size:14px!important}
}
`;
  document.head.appendChild(css);

  const showUrlFromStart = () => {
    if (!urlInput?.value) return;
    const resetScroll = () => {
      urlInput.blur();
      try { urlInput.setSelectionRange(0, 0); } catch (_) {}
      urlInput.scrollLeft = 0;
    };
    requestAnimationFrame(() => requestAnimationFrame(resetScroll));
  };

  if (!result.hidden) showUrlFromStart();
  const observer = new MutationObserver(() => {
    if (!result.hidden) showUrlFromStart();
  });
  observer.observe(result, {attributes: true, attributeFilter: ['hidden']});

  window.DownloadStarryResultPolish = Object.freeze({showUrlFromStart});
})();
