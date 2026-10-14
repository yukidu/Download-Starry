'use strict';
(() => {
  if (window.DownloadStarryResourceActions) return;

  const api = window.SaveVideoAPI;
  const platform = window.SaveVideoPlatform;
  const result = document.getElementById('result');
  const grid = document.querySelector('#video-download-actions .download-action-grid');
  const videoButton = document.getElementById('download-video-button');
  const audioButton = document.getElementById('download-audio-button');
  const reportButton = document.getElementById('report-download-button');
  const sourceUrl = document.getElementById('download-url');
  const visibleUrl = document.getElementById('url');
  const qualityInput = document.getElementById('quality');
  const titleNode = document.getElementById('title');
  const message = document.getElementById('message');
  const progressPanel = document.getElementById('download-progress');
  const progressBar = document.getElementById('progress-bar');
  const progressTrack = document.querySelector('.progress-track');
  const progressStatus = document.getElementById('progress-status');
  const progressPercent = document.getElementById('progress-percent');
  const progressSize = document.getElementById('progress-size');
  const progressSpeed = document.getElementById('progress-speed');
  const progressEta = document.getElementById('progress-eta');
  const stopButton = document.getElementById('stop-download');

  if (!api || !platform || !result || !grid || !videoButton || !audioButton) return;

  const shareIcon = '<svg class="resource-share-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 15V4m0 0L8 8m4-4 4 4M5 11v8h14v-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const css = document.createElement('style');
  css.id = 'downloadstarry-resource-actions-style';
  css.textContent = `
#video-download-actions .download-action-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:8px!important}
#video-download-actions .download-action-grid>.download-action-button{min-width:0!important;width:100%!important;border:0!important;background:var(--button-bg)!important;color:var(--button-text)!important;white-space:nowrap!important}
#video-download-actions .download-action-grid>.download-action-button:hover{background:var(--button-bg)!important;color:var(--button-text)!important;filter:brightness(1.08)}
#video-download-actions .resource-share-button{display:flex!important;align-items:center!important;justify-content:center!important;gap:5px!important}
#video-download-actions .resource-share-icon{width:17px;height:17px;flex:0 0 17px;stroke:currentColor}
#video-download-actions .report-download-button{grid-column:1/-1!important;line-height:1.25!important;white-space:normal!important;background:var(--button-bg)!important;color:var(--button-text)!important}
@media(min-width:651px){
  .media-card>.media-meta{min-width:0!important;overflow:hidden!important}
  .media-card>.media-meta>span{display:block!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
  .media-card>.media-meta h2{display:block!important;width:100%!important;max-width:100%!important;margin:5px 0 0!important;line-height:1.35!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important}
}
@media(max-width:560px){
  #video-download-actions .download-action-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:5px!important}
  #video-download-actions .download-action-button{min-width:0!important;padding:11px 2px!important;font-size:11.5px!important;letter-spacing:-.02em!important}
  #video-download-actions .resource-share-button{gap:3px!important}
  #video-download-actions .resource-share-icon{width:13px;height:13px;flex-basis:13px}
  #video-download-actions .report-download-button{font-size:13px!important;padding-left:8px!important;padding-right:8px!important}
}
@media(max-width:380px){
  #video-download-actions .download-action-grid{gap:4px!important}
  #video-download-actions .download-action-button{font-size:10.5px!important;padding-left:1px!important;padding-right:1px!important}
  #video-download-actions .resource-share-icon{width:12px;height:12px;flex-basis:12px}
}
`;
  document.head.appendChild(css);

  const renderShareButton = (button, label) => {
    button.innerHTML = `${shareIcon}${label}`;
    button.setAttribute('aria-label', label);
  };

  const makeShareButton = (id, label, type) => {
    let button = document.getElementById(id);
    if (!button) {
      button = document.createElement('button');
      button.id = id;
      button.type = 'button';
      button.className = 'download-button download-action-button resource-share-button';
      button.dataset.shareType = type;
    }
    renderShareButton(button, label);
    return button;
  };

  const shareVideo = makeShareButton('share-video-button', '分享影片', 'video');
  const shareAudio = makeShareButton('share-audio-button', '分享音檔', 'audio');

  if (reportButton) {
    reportButton.innerHTML = '回報當前資源無法下載';
    reportButton.setAttribute('aria-label', '回報當前資源無法下載');
  }

  grid.style.setProperty('grid-template-columns', 'repeat(4,minmax(0,1fr))', 'important');
  grid.append(videoButton, shareVideo, audioButton, shareAudio);
  if (reportButton) grid.append(reportButton);

  const showMessage = text => {
    if (!message) return;
    message.textContent = text;
    message.classList.add('show');
  };

  const clearMessage = () => {
    if (!message) return;
    message.textContent = '';
    message.classList.remove('show');
  };

  let sharePlatformPromise = null;
  const loadSharePlatform = () => {
    if (window.DownloadStarryMemberPlatform?.share?.file) return Promise.resolve(window.DownloadStarryMemberPlatform.share);
    if (!sharePlatformPromise) {
      sharePlatformPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-downloadstarry-share-platform]');
        const script = existing || document.createElement('script');
        const finish = () => {
          const share = window.DownloadStarryMemberPlatform?.share;
          if (share?.file) resolve(share);
          else reject(new Error('分享功能載入未完成，請再試一次。'));
        };
        if (existing) {
          if (window.DownloadStarryMemberPlatform) finish();
          else {
            existing.addEventListener('load', finish, {once: true});
            existing.addEventListener('error', () => reject(new Error('分享功能載入失敗，請重新整理後再試。')), {once: true});
          }
          return;
        }
        script.src = '/static/member-platform.js';
        script.dataset.downloadstarrySharePlatform = '1';
        script.addEventListener('load', finish, {once: true});
        script.addEventListener('error', () => reject(new Error('分享功能載入失敗，請重新整理後再試。')), {once: true});
        document.head.appendChild(script);
      }).catch(error => {
        sharePlatformPromise = null;
        throw error;
      });
    }
    return sharePlatformPromise;
  };

  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  const formatBytes = bytes => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / (1024 ** index);
    return `${value.toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
  };

  const updateShareProgress = data => {
    if (!progressPanel) return;
    const percent = Math.max(0, Math.min(100, Number(data.progress) || 0));
    progressPanel.hidden = false;
    progressPanel.classList.toggle('processing', data.status === 'processing');
    if (progressBar) progressBar.style.width = `${percent}%`;
    progressTrack?.setAttribute('aria-valuenow', String(Math.round(percent)));
    if (progressStatus) progressStatus.textContent = data.message || '正在準備分享檔案';
    if (progressPercent) progressPercent.textContent = `${Math.round(percent)}%`;
    const downloaded = formatBytes(Number(data.downloaded_bytes));
    const total = formatBytes(Number(data.total_bytes));
    if (progressSize) progressSize.textContent = downloaded ? `${downloaded}${total ? ` / ${total}` : ''}` : '';
    if (progressSpeed) progressSpeed.textContent = data.speed ? `${formatBytes(Number(data.speed))}/s` : '';
    if (progressEta) progressEta.textContent = Number(data.eta) > 0 ? `剩餘 ${Math.ceil(Number(data.eta))} 秒` : '';
  };

  const setShareControlsDisabled = disabled => {
    [videoButton, audioButton, shareVideo, shareAudio].forEach(button => { button.disabled = disabled; });
  };

  const defaultShareLabel = type => type === 'audio' ? '分享音檔' : '分享影片';
  const shareButtonFor = type => type === 'audio' ? shareAudio : shareVideo;
  const mimeFor = type => type === 'audio' ? 'audio/mpeg' : 'video/mp4';
  const fallbackFilename = type => type === 'audio' ? 'audio-download.mp3' : 'video-download.mp4';
  const shareKey = type => `${type}|${String(sourceUrl?.value || '').trim()}|${String(qualityInput?.value || 'best')}`;

  let activeShareJobId = null;
  let activeTransferController = null;
  let pendingShare = null;

  const clearPendingShare = () => { pendingShare = null; };
  visibleUrl?.addEventListener('input', clearPendingShare);

  const runShareDownload = async type => {
    const url = String(sourceUrl?.value || '').trim();
    if (!url) throw new Error('請先解析網址，再使用分享功能。');

    const startData = await api.startDownload({
      url,
      type,
      quality: qualityInput?.value || 'best',
      subtitle: '',
    });
    activeShareJobId = startData.job_id;
    if (stopButton) {
      stopButton.hidden = false;
      stopButton.disabled = false;
      stopButton.textContent = '■ 停止下載';
    }

    while (true) {
      await wait(750);
      const data = await api.progress(activeShareJobId);
      updateShareProgress(data);
      if (data.status === 'error') throw new Error(data.error || '下載失敗');
      if (data.status === 'cancelled') return null;
      if (data.status === 'finished') {
        const jobId = activeShareJobId;
        activeShareJobId = null;
        return {jobId, filename: data.filename || fallbackFilename(type)};
      }
    }
  };

  const downloadShareFile = async type => {
    const job = await runShareDownload(type);
    if (!job) return null;
    if (progressStatus) progressStatus.textContent = '正在下載完成檔案…';
    activeTransferController = new AbortController();
    try {
      const response = await api.fileResponse(job.jobId, {signal: activeTransferController.signal});
      const blob = await response.blob();
      const responseType = String(blob.type || '').toLowerCase();
      const typeValue = !responseType || responseType === 'application/octet-stream' ? mimeFor(type) : responseType;
      const file = new File([blob], job.filename, {type: typeValue});
      if (progressStatus) progressStatus.textContent = '檔案下載完成，準備分享';
      if (progressPercent) progressPercent.textContent = '100%';
      return {file, filename: job.filename};
    } finally {
      activeTransferController = null;
    }
  };

  const currentSharePayload = type => {
    const resourceTitle = String(titleNode?.textContent || '繁星下載').trim() || '繁星下載';
    const typeLabel = type === 'audio' ? '音檔' : '影片';
    return {
      title: `${resourceTitle}｜${typeLabel}`,
      text: resourceTitle,
    };
  };

  const requiresFreshTap = error => error?.name === 'NotAllowedError' || /user gesture|activation|not allowed|permission/i.test(String(error?.message || ''));

  const sharePreparedFile = async prepared => {
    const share = window.DownloadStarryMemberPlatform?.share;
    if (!share?.file) throw new Error('分享功能載入未完成，請再試一次。');
    try {
      await share.file(prepared.file, currentSharePayload(prepared.type));
      pendingShare = null;
      renderShareButton(shareButtonFor(prepared.type), defaultShareLabel(prepared.type));
      if (progressStatus) progressStatus.textContent = '已開啟手機分享清單';
      return true;
    } catch (error) {
      if (error?.name === 'AbortError') {
        pendingShare = null;
        renderShareButton(shareButtonFor(prepared.type), defaultShareLabel(prepared.type));
        return false;
      }
      if (requiresFreshTap(error)) {
        pendingShare = prepared;
        renderShareButton(shareButtonFor(prepared.type), '點此分享');
        showMessage('檔案已下載完成，請再按一次分享按鈕開啟手機分享清單。');
        return false;
      }
      pendingShare = null;
      renderShareButton(shareButtonFor(prepared.type), defaultShareLabel(prepared.type));
      throw error;
    }
  };

  const invokeDownloadedShare = async type => {
    const button = shareButtonFor(type);
    const key = shareKey(type);

    if (pendingShare?.type === type && pendingShare?.key === key) {
      clearMessage();
      try {
        await sharePreparedFile(pendingShare);
      } catch (error) {
        showMessage(error?.message || '目前無法開啟分享清單，請稍後再試。');
      }
      return;
    }

    pendingShare = null;
    if (!String(sourceUrl?.value || '').trim()) {
      showMessage('請先解析網址，再使用分享功能。');
      return;
    }

    clearMessage();
    setShareControlsDisabled(true);
    renderShareButton(button, '下載中…');
    if (progressPanel) progressPanel.hidden = false;
    if (progressStatus) progressStatus.textContent = `正在下載${type === 'audio' ? '音檔' : '影片'}，完成後開啟分享`;

    try {
      await loadSharePlatform();
      const downloaded = await downloadShareFile(type);
      if (!downloaded) return;
      const prepared = {...downloaded, type, key};
      pendingShare = prepared;
      if (stopButton) stopButton.hidden = true;
      await sharePreparedFile(prepared);
    } catch (error) {
      if (error?.name !== 'AbortError') showMessage(error?.message || '下載分享檔案失敗，請稍後再試。');
      if (progressStatus) progressStatus.textContent = error?.name === 'AbortError' ? '已停止下載' : '分享檔案未完成';
      pendingShare = null;
    } finally {
      activeShareJobId = null;
      activeTransferController = null;
      if (stopButton) stopButton.hidden = true;
      setShareControlsDisabled(false);
      if (!(pendingShare?.type === type && pendingShare?.key === key)) renderShareButton(button, defaultShareLabel(type));
    }
  };

  shareVideo.addEventListener('click', () => invokeDownloadedShare('video'));
  shareAudio.addEventListener('click', () => invokeDownloadedShare('audio'));

  stopButton?.addEventListener('click', async () => {
    activeTransferController?.abort();
    if (!activeShareJobId) return;
    const jobId = activeShareJobId;
    activeShareJobId = null;
    try { await api.cancel(jobId); } catch (_) {}
  });

  const mirrorDisabled = (source, target) => {
    const sync = () => { target.disabled = source.disabled; };
    sync();
    new MutationObserver(sync).observe(source, {attributes: true, attributeFilter: ['disabled']});
  };
  mirrorDisabled(videoButton, shareVideo);
  mirrorDisabled(audioButton, shareAudio);

  platform.lifecycle.onPageHide(() => {
    activeTransferController?.abort();
    if (activeShareJobId) platform.lifecycle.sendBeacon(api.cancelUrl(activeShareJobId));
  });

  window.DownloadStarryResourceActions = Object.freeze({share: invokeDownloadedShare});
})();
