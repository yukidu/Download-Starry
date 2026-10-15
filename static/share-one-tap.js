'use strict';
(() => {
  if (window.DownloadStarryOneTapShare) return;

  const api = window.SaveVideoAPI;
  const platform = window.SaveVideoPlatform;
  const result = document.getElementById('result');
  const sourceUrl = document.getElementById('download-url');
  const visibleUrl = document.getElementById('url');
  const qualityInput = document.getElementById('quality');
  const titleNode = document.getElementById('title');
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
  if (!api || !platform || !result || !sourceUrl) return;

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

  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  const formatBytes = bytes => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / (1024 ** index);
    return `${value.toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
  };

  const buttonFor = type => type === 'audio' ? shareAudio : shareVideo;
  const mimeFor = type => type === 'audio' ? 'audio/mpeg' : 'video/mp4';
  const filenameFor = type => type === 'audio' ? 'audio-download.mp3' : 'video-download.mp4';
  const typeName = type => type === 'audio' ? '音檔' : '影片';
  const shareKey = type => `${type}|${String(sourceUrl.value || '').trim()}|${String(qualityInput?.value || 'best')}`;

  const setShareLabel = (type, text) => {
    const button = buttonFor(type);
    if (!button) return;
    const icon = button.querySelector('.resource-share-icon')?.outerHTML || '';
    button.innerHTML = `${icon}${text}`;
    button.setAttribute('aria-label', text === '分享' ? `分享${typeName(type)}` : text);
  };

  const setAllActionDisabled = disabled => {
    [videoDownloadButton, audioDownloadButton, shareVideo, shareAudio].forEach(button => {
      if (button) button.disabled = disabled;
    });
  };

  const placeProgress = () => {
    const grid = document.querySelector('#video-download-actions .download-action-grid');
    const reportButton = document.getElementById('report-download-button');
    if (grid && reportButton && progressPanel) grid.insertBefore(progressPanel, reportButton);
    window.DownloadStarryResultLayout?.syncActionWidth?.();
  };

  const resetProgress = type => {
    placeProgress();
    if (!progressPanel) return;
    progressPanel.hidden = false;
    progressPanel.classList.remove('processing');
    if (progressBar) progressBar.style.width = '0%';
    progressTrack?.setAttribute('aria-valuenow', '0');
    if (progressStatus) progressStatus.textContent = `正在準備${typeName(type)}分享檔案`;
    if (progressPercent) progressPercent.textContent = '0%';
    if (progressSize) progressSize.textContent = '';
    if (progressSpeed) progressSpeed.textContent = '';
    if (progressEta) progressEta.textContent = '';
    if (stopButton) {
      stopButton.hidden = false;
      stopButton.disabled = false;
      stopButton.textContent = '■ 停止下載';
    }
  };

  const updateProgress = (type, data) => {
    if (!progressPanel) return;
    const percent = Math.max(0, Math.min(100, Number(data.progress) || 0));
    progressPanel.hidden = false;
    progressPanel.classList.toggle('processing', data.status === 'processing');
    if (progressBar) progressBar.style.width = `${percent}%`;
    progressTrack?.setAttribute('aria-valuenow', String(Math.round(percent)));
    if (progressStatus) progressStatus.textContent = `正在準備${typeName(type)}分享檔案`;
    if (progressPercent) progressPercent.textContent = `${Math.round(percent)}%`;
    const downloaded = formatBytes(Number(data.downloaded_bytes));
    const total = formatBytes(Number(data.total_bytes));
    if (progressSize) progressSize.textContent = downloaded ? `${downloaded}${total ? ` / ${total}` : ''}` : '';
    if (progressSpeed) progressSpeed.textContent = data.speed ? `${formatBytes(Number(data.speed))}/s` : '';
    if (progressEta) progressEta.textContent = Number(data.eta) > 0 ? `剩餘 ${Math.ceil(Number(data.eta))} 秒` : '';
  };

  const sharePayload = type => {
    const resourceTitle = String(titleNode?.textContent || '繁星下載').trim() || '繁星下載';
    return {title: `${resourceTitle}｜${typeName(type)}`, text: resourceTitle};
  };

  const cache = {video: null, audio: null};
  let generation = 0;
  let activeJobId = null;
  let activeTransferController = null;
  let activeType = null;

  const resetButtons = () => {
    shareVideo.disabled = false;
    shareAudio.disabled = false;
    shareVideo.dataset.shareReady = '0';
    shareAudio.dataset.shareReady = '0';
    setShareLabel('video', '分享');
    setShareLabel('audio', '分享');
  };

  const clearCache = () => {
    cache.video = null;
    cache.audio = null;
    resetButtons();
  };

  const cancelPreparation = () => {
    generation += 1;
    const jobId = activeJobId;
    activeJobId = null;
    activeType = null;
    activeTransferController?.abort();
    activeTransferController = null;
    if (jobId) void api.cancel(jobId).catch(() => {});
    setAllActionDisabled(false);
    if (stopButton) stopButton.hidden = true;
  };

  const prepareShare = async type => {
    if (activeType) return;
    const url = String(sourceUrl.value || '').trim();
    if (!url) return;

    const token = ++generation;
    const key = shareKey(type);
    activeType = type;
    setAllActionDisabled(true);
    setShareLabel(type, '準備中…');
    resetProgress(type);

    try {
      const startData = await api.startDownload({
        url,
        type,
        quality: qualityInput?.value || 'best',
        subtitle: '',
      });
      if (token !== generation) {
        void api.cancel(startData.job_id).catch(() => {});
        return;
      }
      activeJobId = startData.job_id;

      let finished = null;
      while (!finished && token === generation) {
        await wait(750);
        const data = await api.progress(activeJobId);
        updateProgress(type, data);
        if (data.status === 'error') throw new Error(data.error || '分享檔案準備失敗');
        if (data.status === 'cancelled') return;
        if (data.status === 'finished') {
          finished = {jobId: activeJobId, filename: data.filename || filenameFor(type)};
          activeJobId = null;
        }
      }
      if (!finished || token !== generation) return;

      if (progressStatus) progressStatus.textContent = `正在載入${typeName(type)}分享檔案`;
      activeTransferController = new AbortController();
      const response = await api.fileResponse(finished.jobId, {signal: activeTransferController.signal});
      const blob = await response.blob();
      activeTransferController = null;
      if (token !== generation) return;

      const responseType = String(blob.type || '').toLowerCase();
      const file = new File([blob], finished.filename, {
        type: !responseType || responseType === 'application/octet-stream' ? mimeFor(type) : responseType,
      });
      await loadSharePlatform();
      if (token !== generation) return;

      cache[type] = {key, file};
      if (progressStatus) progressStatus.textContent = `${typeName(type)}已準備完成，請再按一次分享`;
      if (progressPercent) progressPercent.textContent = '100%';
      setAllActionDisabled(false);
      const button = buttonFor(type);
      if (button) {
        button.dataset.shareReady = '1';
        setShareLabel(type, '點此分享');
      }
      if (stopButton) stopButton.hidden = true;
    } catch (error) {
      if (error?.name !== 'AbortError' && token === generation) {
        if (progressStatus) progressStatus.textContent = error?.message || '分享檔案準備失敗，請稍後再試';
        if (progressPercent) progressPercent.textContent = '';
      }
      cache[type] = null;
      setAllActionDisabled(false);
      setShareLabel(type, '分享');
      const button = buttonFor(type);
      if (button) button.dataset.shareReady = '0';
      if (stopButton) stopButton.hidden = true;
    } finally {
      if (token === generation) {
        activeJobId = null;
        activeTransferController = null;
        activeType = null;
      }
    }
  };

  const sharePrepared = type => {
    const cached = cache[type];
    const share = window.DownloadStarryMemberPlatform?.share;
    if (!cached?.file || cached.key !== shareKey(type) || !share?.file) {
      void prepareShare(type);
      return;
    }

    let shareResult;
    try {
      shareResult = share.file(cached.file, sharePayload(type));
    } catch (_) {
      if (progressPanel) progressPanel.hidden = false;
      if (progressStatus) progressStatus.textContent = '目前無法開啟手機分享選單';
      return;
    }

    Promise.resolve(shareResult).then(() => {
      if (progressPanel) progressPanel.hidden = true;
    }).catch(() => {
      if (progressPanel) progressPanel.hidden = false;
      if (progressStatus) progressStatus.textContent = '目前無法開啟手機分享選單，請再試一次';
    });
  };

  shareVideo.addEventListener('click', () => sharePrepared('video'));
  shareAudio.addEventListener('click', () => sharePrepared('audio'));

  const resetForNewUrl = () => {
    cancelPreparation();
    clearCache();
    if (progressPanel) progressPanel.hidden = true;
  };
  visibleUrl?.addEventListener('input', resetForNewUrl);

  new MutationObserver(() => {
    if (result.hidden) resetForNewUrl();
    else {
      clearCache();
      if (progressPanel) progressPanel.hidden = true;
    }
  }).observe(result, {attributes: true, attributeFilter: ['hidden']});

  stopButton?.addEventListener('click', event => {
    if (!activeJobId && !activeTransferController) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    cancelPreparation();
    clearCache();
    if (progressStatus) progressStatus.textContent = '已停止分享檔案準備';
  }, true);

  platform.lifecycle.onPageHide(() => {
    const jobId = activeJobId;
    activeTransferController?.abort();
    if (jobId) platform.lifecycle.sendBeacon(api.cancelUrl(jobId));
  });

  resetButtons();
  window.DownloadStarryOneTapShare = Object.freeze({
    prepare: prepareShare,
    share: sharePrepared,
  });
})();
