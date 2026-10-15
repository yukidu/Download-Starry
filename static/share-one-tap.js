'use strict';
(() => {
  if (window.DownloadStarryOneTapShare) return;

  const api = window.SaveVideoAPI;
  const platform = window.SaveVideoPlatform;
  const sourceUrl = document.getElementById('download-url');
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
  const videoDownloadButton = document.getElementById('download-video-button');
  const audioDownloadButton = document.getElementById('download-audio-button');
  if (!api || !platform) return;

  const replaceShareButton = id => {
    const oldButton = document.getElementById(id);
    if (!oldButton) return null;
    const button = oldButton.cloneNode(true);
    oldButton.replaceWith(button);
    return button;
  };

  const shareVideo = replaceShareButton('share-video-button');
  const shareAudio = replaceShareButton('share-audio-button');
  if (!shareVideo || !shareAudio) return;

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
    if (sharePlatformPromise) return sharePlatformPromise;
    sharePlatformPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-downloadstarry-share-platform]');
      const script = existing || document.createElement('script');
      const finish = () => {
        const share = window.DownloadStarryMemberPlatform?.share;
        if (share?.file) resolve(share);
        else reject(new Error('分享功能載入未完成'));
      };
      if (existing) {
        if (window.DownloadStarryMemberPlatform) finish();
        else {
          existing.addEventListener('load', finish, {once: true});
          existing.addEventListener('error', () => reject(new Error('分享功能載入失敗')), {once: true});
        }
        return;
      }
      script.src = '/static/member-platform.js';
      script.dataset.downloadstarrySharePlatform = '1';
      script.addEventListener('load', finish, {once: true});
      script.addEventListener('error', () => reject(new Error('分享功能載入失敗')), {once: true});
      document.head.appendChild(script);
    }).catch(error => {
      sharePlatformPromise = null;
      throw error;
    });
    return sharePlatformPromise;
  };

  void loadSharePlatform().catch(() => {});

  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  const formatBytes = bytes => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / (1024 ** index);
    return `${value.toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
  };

  const placeProgress = () => {
    const grid = document.querySelector('#video-download-actions .download-action-grid');
    const reportButton = document.getElementById('report-download-button');
    if (grid && reportButton && progressPanel) grid.insertBefore(progressPanel, reportButton);
    window.DownloadStarryResultLayout?.syncActionWidth?.();
  };

  const updateProgress = data => {
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

  const buttonFor = type => type === 'audio' ? shareAudio : shareVideo;
  const downloadButtonFor = type => type === 'audio' ? audioDownloadButton : videoDownloadButton;
  const mimeFor = type => type === 'audio' ? 'audio/mpeg' : 'video/mp4';
  const filenameFor = type => type === 'audio' ? 'audio-download.mp3' : 'video-download.mp4';
  const labelFor = type => type === 'audio' ? '分享音檔' : '分享影片';
  const compactLabelFor = () => '分享';

  let activeJobId = null;
  let transferController = null;
  let activeType = null;

  const setDisabled = disabled => {
    [videoDownloadButton, audioDownloadButton, shareVideo, shareAudio].forEach(button => {
      if (button) button.disabled = disabled;
    });
  };

  const setShareLabel = (type, text) => {
    const button = buttonFor(type);
    if (!button) return;
    const icon = button.querySelector('.resource-share-icon')?.outerHTML || '';
    button.innerHTML = `${icon}${text}`;
    button.setAttribute('aria-label', text === '分享' ? labelFor(type) : text);
  };

  const sharePayload = type => {
    const resourceTitle = String(titleNode?.textContent || '繁星下載').trim() || '繁星下載';
    return {title: `${resourceTitle}｜${type === 'audio' ? '音檔' : '影片'}`, text: resourceTitle};
  };

  const oneTapShare = async type => {
    if (activeJobId || activeType) return;
    const url = String(sourceUrl?.value || '').trim();
    if (!url) {
      showMessage('請先解析網址，再使用分享功能。');
      return;
    }

    clearMessage();
    placeProgress();
    setDisabled(true);
    activeType = type;
    setShareLabel(type, '準備中…');
    if (progressPanel) progressPanel.hidden = false;
    if (progressStatus) progressStatus.textContent = `正在準備${type === 'audio' ? '音檔' : '影片'}，完成後自動開啟分享選單`;

    try {
      const share = await loadSharePlatform();
      const startData = await api.startDownload({url, type, quality: qualityInput?.value || 'best', subtitle: ''});
      activeJobId = startData.job_id;
      if (stopButton) {
        stopButton.hidden = false;
        stopButton.disabled = false;
        stopButton.textContent = '■ 停止下載';
      }

      let finished = null;
      while (!finished) {
        await wait(750);
        const data = await api.progress(activeJobId);
        updateProgress(data);
        if (data.status === 'error') throw new Error(data.error || '下載失敗');
        if (data.status === 'cancelled') return;
        if (data.status === 'finished') finished = {jobId: activeJobId, filename: data.filename || filenameFor(type)};
      }

      activeJobId = null;
      if (progressStatus) progressStatus.textContent = '正在取得分享檔案…';
      transferController = new AbortController();
      const response = await api.fileResponse(finished.jobId, {signal: transferController.signal});
      const blob = await response.blob();
      transferController = null;
      const responseType = String(blob.type || '').toLowerCase();
      const file = new File([blob], finished.filename, {
        type: !responseType || responseType === 'application/octet-stream' ? mimeFor(type) : responseType,
      });

      if (stopButton) stopButton.hidden = true;
      if (progressStatus) progressStatus.textContent = '正在自動開啟手機分享選單…';
      if (progressPercent) progressPercent.textContent = '100%';
      await share.file(file, sharePayload(type));
      if (progressStatus) progressStatus.textContent = '已開啟手機分享選單';
    } catch (error) {
      if (error?.name === 'AbortError') {
        if (progressStatus) progressStatus.textContent = '已停止分享準備';
      } else if (error?.name === 'NotAllowedError' || /user gesture|activation|not allowed|permission/i.test(String(error?.message || ''))) {
        if (progressStatus) progressStatus.textContent = '手機瀏覽器阻擋自動分享';
        showMessage('這台手機的瀏覽器禁止在檔案準備完成後自動叫出分享選單；網站不會再要求你按第二次。');
      } else {
        if (progressStatus) progressStatus.textContent = '分享未完成';
        showMessage(error?.message || '目前無法開啟分享選單，請稍後再試。');
      }
    } finally {
      activeJobId = null;
      transferController = null;
      activeType = null;
      if (stopButton) stopButton.hidden = true;
      setDisabled(false);
      setShareLabel(type, compactLabelFor());
    }
  };

  shareVideo.addEventListener('click', () => oneTapShare('video'));
  shareAudio.addEventListener('click', () => oneTapShare('audio'));

  [shareVideo, shareAudio].forEach(button => button.addEventListener('pointerdown', () => { void loadSharePlatform().catch(() => {}); }, {passive: true}));

  stopButton?.addEventListener('click', event => {
    if (!activeJobId && !transferController) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    transferController?.abort();
    if (activeJobId) {
      const jobId = activeJobId;
      activeJobId = null;
      void api.cancel(jobId).catch(() => {});
    }
  }, true);

  const mirrorDisabled = (source, target) => {
    if (!source || !target) return;
    const sync = () => {
      if (!activeType) target.disabled = source.disabled;
    };
    sync();
    new MutationObserver(sync).observe(source, {attributes: true, attributeFilter: ['disabled']});
  };
  mirrorDisabled(videoDownloadButton, shareVideo);
  mirrorDisabled(audioDownloadButton, shareAudio);

  platform.lifecycle.onPageHide(() => {
    transferController?.abort();
    if (activeJobId) platform.lifecycle.sendBeacon(api.cancelUrl(activeJobId));
  });

  window.DownloadStarryOneTapShare = Object.freeze({share: oneTapShare});
})();
