'use strict';
(() => {
  if (window.DownloadStarryResourceActions) return;

  const result = document.getElementById('result');
  const grid = document.querySelector('#video-download-actions .download-action-grid');
  const videoButton = document.getElementById('download-video-button');
  const audioButton = document.getElementById('download-audio-button');
  const reportButton = document.getElementById('report-download-button');
  const sourceUrl = document.getElementById('download-url');
  const titleNode = document.getElementById('title');
  const message = document.getElementById('message');

  if (!result || !grid || !videoButton || !audioButton) return;

  const css = document.createElement('style');
  css.id = 'downloadstarry-resource-actions-style';
  css.textContent = `
#video-download-actions .download-action-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
#video-download-actions .resource-share-button{width:100%;border:1px solid color-mix(in srgb,var(--accent) 24%,var(--line));background:color-mix(in srgb,var(--soft-bg) 88%,var(--card));color:var(--ink)}
#video-download-actions .resource-share-button:hover{border-color:color-mix(in srgb,var(--accent) 48%,var(--line));color:var(--accent)}
#video-download-actions .report-download-button{grid-column:1/-1!important;line-height:1.25!important;white-space:normal!important}
@media(min-width:651px){
  .media-card>.media-meta{min-width:0!important;overflow:hidden!important}
  .media-card>.media-meta>span{display:block!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
  .media-card>.media-meta h2{display:block!important;width:100%!important;max-width:100%!important;margin:5px 0 0!important;line-height:1.35!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important}
}
@media(max-width:560px){
  #video-download-actions .download-action-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
  #video-download-actions .download-action-button{min-width:0!important;padding-left:7px!important;padding-right:7px!important;font-size:14px!important}
}
`;
  document.head.appendChild(css);

  const makeShareButton = (id, label, type) => {
    let button = document.getElementById(id);
    if (!button) {
      button = document.createElement('button');
      button.id = id;
      button.type = 'button';
      button.className = 'download-button download-action-button resource-share-button';
      button.dataset.shareType = type;
      button.textContent = label;
    }
    return button;
  };

  const shareVideo = makeShareButton('share-video-button', '分享影片', 'video');
  const shareAudio = makeShareButton('share-audio-button', '分享音檔', 'audio');

  if (reportButton) {
    reportButton.innerHTML = '回報當前資源無法下載';
    reportButton.setAttribute('aria-label', '回報當前資源無法下載');
  }

  grid.style.setProperty('grid-template-columns', 'repeat(2,minmax(0,1fr))', 'important');
  grid.append(videoButton, shareVideo, audioButton, shareAudio);
  if (reportButton) grid.append(reportButton);

  const showMessage = text => {
    if (!message) return;
    message.textContent = text;
    message.classList.add('show');
  };

  const currentSharePayload = type => {
    const url = String(sourceUrl?.value || '').trim();
    const resourceTitle = String(titleNode?.textContent || '繁星下載').trim() || '繁星下載';
    const typeLabel = type === 'audio' ? '音檔' : '影片';
    return {
      title: `${resourceTitle}｜${typeLabel}`,
      text: `分享${typeLabel}：${resourceTitle}`,
      url,
    };
  };

  const invokeNativeShare = async type => {
    const payload = currentSharePayload(type);
    if (!payload.url) {
      showMessage('請先解析網址，再使用分享功能。');
      return;
    }

    const native = window.SaveVideoNative;
    const nativeShare = native?.sharing?.share || native?.share?.share || native?.share;
    try {
      if (typeof nativeShare === 'function') {
        await nativeShare(payload);
        return;
      }
      if (typeof navigator.share === 'function') {
        await navigator.share(payload);
        return;
      }
      showMessage('目前這台裝置不支援原生分享，請複製網址後分享。');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      showMessage(error?.message || '目前無法開啟分享清單，請稍後再試。');
    }
  };

  shareVideo.addEventListener('click', () => invokeNativeShare('video'));
  shareAudio.addEventListener('click', () => invokeNativeShare('audio'));

  const mirrorDisabled = (source, target) => {
    const sync = () => { target.disabled = source.disabled; };
    sync();
    new MutationObserver(sync).observe(source, {attributes: true, attributeFilter: ['disabled']});
  };
  mirrorDisabled(videoButton, shareVideo);
  mirrorDisabled(audioButton, shareAudio);

  window.DownloadStarryResourceActions = Object.freeze({share: invokeNativeShare});
})();