'use strict';
(() => {
  if (window.DownloadStarryResultPolish) return;

  const result = document.getElementById('result');
  const urlInput = document.getElementById('url');
  const platform = window.SaveVideoPlatform;
  let applied = false;
  let attempts = 0;

  const iosShareIcon = '<svg class="resource-share-icon resource-share-icon-ios" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 15V3m0 0L8 7m4-4 4 4M6 10H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const androidShareIcon = '<svg class="resource-share-icon resource-share-icon-android" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="18" cy="5" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="19" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="m8.7 10.7 6.6-4.1M8.7 13.3l6.6 4.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const genericShareIcon = '<svg class="resource-share-icon resource-share-icon-generic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 15V4m0 0L8 8m4-4 4 4M5 11v8h14v-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const downloadIcon = '<svg class="resource-download-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="width:34px;height:34px;flex:0 0 34px;stroke:currentColor"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const deviceName = () => platform?.runtime?.isIOS ? 'ios' : platform?.runtime?.isAndroid ? 'android' : 'web';
  const expectedIconClass = () => platform?.runtime?.isIOS ? 'resource-share-icon-ios' : platform?.runtime?.isAndroid ? 'resource-share-icon-android' : 'resource-share-icon-generic';
  const shareIconMarkup = () => {
    if (platform?.runtime?.isIOS) return iosShareIcon;
    if (platform?.runtime?.isAndroid) return androidShareIcon;
    return genericShareIcon;
  };

  const syncShareIcon = button => {
    if (!button) return;
    const icon = button.querySelector('.resource-share-icon');
    if (icon && !icon.classList.contains(expectedIconClass())) icon.outerHTML = shareIconMarkup();
    button.dataset.shareDevice = deviceName();
  };

  const watchShareIcon = button => {
    if (!button || button.dataset.shareIconWatch === '1') return;
    button.dataset.shareIconWatch = '1';
    syncShareIcon(button);
    new MutationObserver(() => syncShareIcon(button)).observe(button, {childList: true, subtree: true});
  };

  const renderShareButton = (button, label) => {
    if (!button) return;
    button.innerHTML = `${shareIconMarkup()}${label}`;
    button.setAttribute('aria-label', label);
    button.dataset.shareDevice = deviceName();
  };

  const renderDownloadButton = (button, label) => {
    if (!button) return;
    button.classList.add('resource-download-button');
    button.innerHTML = `${downloadIcon}${label}`;
    button.setAttribute('aria-label', label);
    button.style.setProperty('display', 'flex', 'important');
    button.style.setProperty('flex-direction', 'column', 'important');
    button.style.setProperty('align-items', 'center', 'important');
    button.style.setProperty('justify-content', 'center', 'important');
    button.style.setProperty('gap', '2px', 'important');
    button.style.setProperty('text-align', 'center', 'important');
  };

  const installCss = () => {
    if (document.getElementById('downloadstarry-result-polish-style')) return;
    const css = document.createElement('style');
    css.id = 'downloadstarry-result-polish-style';
    css.textContent = `
#video-download-actions,
#video-download-actions .download-action-grid{
  width:100%!important;
  min-width:0!important;
}
#video-download-actions .download-action-grid{
  display:grid!important;
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
  column-gap:14px!important;
  row-gap:10px!important;
  align-items:stretch!important;
}
#video-download-actions .resource-action-group{
  display:grid!important;
  grid-template-rows:auto 1fr!important;
  gap:5px!important;
  width:100%!important;
  min-width:0!important;
  padding:0!important;
  border:0!important;
  border-radius:0!important;
  background:transparent!important;
}
#video-download-actions .resource-action-group-label{
  display:block!important;
  width:100%!important;
  text-align:center!important;
  color:var(--muted)!important;
  font:800 11px/1.15 "Noto Sans TC",sans-serif!important;
  letter-spacing:.08em!important;
}
#video-download-actions .resource-action-group-buttons{
  display:grid!important;
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
  gap:6px!important;
  width:100%!important;
  min-width:0!important;
}
#video-download-actions .resource-action-group .download-action-button{
  width:100%!important;
  min-width:0!important;
  min-height:62px!important;
  padding:8px 5px!important;
  border:0!important;
  border-radius:14px!important;
  background:var(--button-bg)!important;
  color:var(--button-text)!important;
  font:800 14px/1.15 "Noto Sans TC",sans-serif!important;
  letter-spacing:0!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  box-shadow:none!important;
}
#video-download-actions .resource-action-group .download-action-button:hover{
  background:var(--button-bg)!important;
  color:var(--button-text)!important;
  filter:brightness(1.08);
}
#video-download-actions .resource-share-button{
  display:flex!important;
  flex-direction:column!important;
  align-items:center!important;
  justify-content:center!important;
  gap:2px!important;
  text-align:center!important;
}
#video-download-actions .resource-share-icon{
  width:30px!important;
  height:30px!important;
  flex:0 0 30px!important;
  stroke:currentColor!important;
}
#video-download-actions .report-download-button{
  grid-column:1/-1!important;
  width:100%!important;
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
  height:auto!important;
  aspect-ratio:16/9!important;
  margin:0!important;
  min-width:0!important;
  align-self:start!important;
}
.media-card>.thumb-wrap img{
  width:100%!important;
  height:100%!important;
  object-fit:cover!important;
}
.media-card>.media-meta{
  grid-area:meta!important;
  display:flex!important;
  flex-direction:column!important;
  justify-content:flex-start!important;
  align-items:flex-start!important;
  width:100%!important;
  height:auto!important;
  min-height:0!important;
  min-width:0!important;
  margin:0!important;
  padding:0!important;
  align-self:start!important;
  overflow:hidden!important;
}
.media-card>.media-meta h2{
  order:1!important;
  display:-webkit-box!important;
  width:100%!important;
  max-width:100%!important;
  margin:0!important;
  color:var(--ink)!important;
  font-size:17px!important;
  line-height:1.38!important;
  white-space:normal!important;
  overflow:hidden!important;
  overflow-wrap:anywhere!important;
  word-break:break-word!important;
  -webkit-line-clamp:4!important;
  -webkit-box-orient:vertical!important;
}
.media-card>.media-meta>span{
  order:2!important;
  display:block!important;
  max-width:100%!important;
  margin:7px 0 0!important;
  color:var(--muted)!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  white-space:nowrap!important;
}
.download-actions{margin-top:8px!important;gap:8px!important}
@media(max-width:650px){
  #video-download-actions .download-action-grid{column-gap:10px!important;row-gap:9px!important}
  #video-download-actions .resource-action-group-buttons{gap:5px!important}
  #video-download-actions .resource-action-group .download-action-button{
    min-height:62px!important;
    padding:7px 2px!important;
    border-radius:13px!important;
    font-size:13px!important;
  }
  #video-download-actions .resource-share-icon{
    width:31px!important;
    height:31px!important;
    flex-basis:31px!important;
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
    margin:0!important;
    font-size:15px!important;
    line-height:1.35!important;
    -webkit-line-clamp:5!important;
  }
  .media-card>.media-meta>span{
    margin-top:6px!important;
    font-size:12px!important;
  }
}
@media(max-width:380px){
  #video-download-actions .download-action-grid{column-gap:8px!important;row-gap:8px!important}
  #video-download-actions .resource-action-group{gap:4px!important}
  #video-download-actions .resource-action-group-buttons{gap:4px!important}
  #video-download-actions .resource-action-group .download-action-button{
    min-height:60px!important;
    padding-left:1px!important;
    padding-right:1px!important;
    font-size:12px!important;
  }
  #video-download-actions .resource-share-button{gap:1px!important}
  #video-download-actions .resource-share-icon{
    width:28px!important;
    height:28px!important;
    flex-basis:28px!important;
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
  };

  const ensureActionGroup = (grid, className, label, firstButton, secondButton) => {
    let group = grid.querySelector(`.${className}`);
    if (!group) {
      group = document.createElement('div');
      group.className = `resource-action-group ${className}`;
    }
    let labelNode = group.querySelector('.resource-action-group-label');
    if (!labelNode) {
      labelNode = document.createElement('span');
      labelNode.className = 'resource-action-group-label';
    }
    labelNode.textContent = label;
    let buttons = group.querySelector('.resource-action-group-buttons');
    if (!buttons) {
      buttons = document.createElement('div');
      buttons.className = 'resource-action-group-buttons';
    }
    buttons.replaceChildren(firstButton, secondButton);
    group.replaceChildren(labelNode, buttons);
    return group;
  };

  const applyLayout = () => {
    if (applied) return true;
    const grid = document.querySelector('#video-download-actions .download-action-grid');
    const videoButton = document.getElementById('download-video-button');
    const shareVideo = document.getElementById('share-video-button');
    const audioButton = document.getElementById('download-audio-button');
    const shareAudio = document.getElementById('share-audio-button');
    const reportButton = document.getElementById('report-download-button');
    if (!result || !grid || !videoButton || !audioButton || !shareVideo || !shareAudio) return false;

    renderDownloadButton(videoButton, '下載');
    renderDownloadButton(audioButton, '下載');
    const videoGroup = ensureActionGroup(grid, 'resource-action-group-video', '影片', videoButton, shareVideo);
    const audioGroup = ensureActionGroup(grid, 'resource-action-group-audio', '音檔', audioButton, shareAudio);
    grid.replaceChildren(videoGroup, audioGroup);
    if (reportButton) grid.append(reportButton);

    renderShareButton(shareVideo, '分享');
    renderShareButton(shareAudio, '分享');
    watchShareIcon(shareVideo);
    watchShareIcon(shareAudio);
    installCss();
    applied = true;
    return true;
  };

  const ensureLayout = () => {
    if (applyLayout()) return;
    attempts += 1;
    if (attempts < 40) requestAnimationFrame(ensureLayout);
  };

  const showUrlFromStart = () => {
    if (!urlInput?.value) return;
    const resetScroll = () => {
      urlInput.blur();
      try { urlInput.setSelectionRange(0, 0); } catch (_) {}
      urlInput.scrollLeft = 0;
    };
    requestAnimationFrame(() => requestAnimationFrame(resetScroll));
  };

  ensureLayout();
  if (!result?.hidden) showUrlFromStart();
  const observer = new MutationObserver(() => {
    if (!result?.hidden) {
      applied = false;
      ensureLayout();
      showUrlFromStart();
    }
  });
  if (result) observer.observe(result, {attributes: true, attributeFilter: ['hidden']});

  window.DownloadStarryResultPolish = Object.freeze({showUrlFromStart, applyLayout});
})();
