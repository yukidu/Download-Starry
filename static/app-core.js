'use strict';

const platform = window.SaveVideoPlatform;
const api = window.SaveVideoAPI;

if (!platform || !api) {
  throw new Error('SaveVideo platform/API bootstrap missing');
}

const lookupForm = document.querySelector('#lookup-form');
const urlInput = document.querySelector('#url');
const result = document.querySelector('#result');
const message = document.querySelector('#message');
const pasteUrlButton = document.querySelector('#paste-url-button');
const lookupButton = document.querySelector('#lookup-button');
const downloadVideoButton = document.querySelector('#download-video-button');
const downloadAudioButton = document.querySelector('#download-audio-button');
const downloadImageButton = document.querySelector('#download-image-button');
const downloadSubtitleButton = document.querySelector('#download-subtitle-button');
const downloadActionButtons = [
  downloadVideoButton,
  downloadAudioButton,
  downloadImageButton,
  downloadSubtitleButton,
].filter(Boolean);
const videoDownloadActions = document.querySelector('#video-download-actions');
const imageDownloadActions = document.querySelector('#image-download-actions');
const subtitleDownloadActions = document.querySelector('#subtitle-download-actions');
const highestQualityLabel = document.querySelector('#highest-quality-label');
const qualityInput = document.querySelector('#quality');
const downloadUrl = document.querySelector('#download-url');
const subtitleSelect = document.querySelector('#subtitle-language');
const progressPanel = document.querySelector('#download-progress');
const progressBar = document.querySelector('#progress-bar');
const progressTrack = document.querySelector('.progress-track');
const progressStatus = document.querySelector('#progress-status');
const progressPercent = document.querySelector('#progress-percent');
const progressSize = document.querySelector('#progress-size');
const progressSpeed = document.querySelector('#progress-speed');
const progressEta = document.querySelector('#progress-eta');
const stopDownloadButton = document.querySelector('#stop-download');
const playlistDialog = document.querySelector('#playlist-dialog');
const playlistDescription = document.querySelector('#playlist-description');
const playlistSingleButton = document.querySelector('#playlist-single');
const playlistAllButton = document.querySelector('#playlist-all');
let activeJobId = null;
let activeBatch = null;
let activeFileTransferController = null;
let pendingPlaylist = null;
let currentImageCount = 0;
let currentImageCountTruncated = false;

const showError = text => {
  message.textContent = text;
  message.classList.add('show');
};

const clearError = () => {
  message.textContent = '';
  message.classList.remove('show');
};
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

const formatDuration = seconds => {
  if (!seconds) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return [
    hours ? String(hours) : null,
    String(minutes).padStart(hours ? 2 : 1, '0'),
    String(remainingSeconds).padStart(2, '0'),
  ].filter(Boolean).join(':');
};

const formatBytes = bytes => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** unitIndex);
  return `${value.toFixed(unitIndex > 1 ? 1 : 0)} ${units[unitIndex]}`;
};

const defaultButtonHtml = type => {
  if (type === 'audio') return '<span>♫</span> 下載 MP3';
  if (type === 'image') {
    if (currentImageCount > 1) {
      const count = `${currentImageCount}${currentImageCountTruncated ? '+' : ''}`;
      return `<span>↓</span> 打包下載 ${count} 張照片`;
    }
    return '<span>↓</span> 下載照片';
  }
  if (type === 'subtitle') return '<span>CC</span> 下載 CC 字幕';
  return '<span>↓</span> 下載 MP4';
};

const resetActionButtonLabels = () => {
  downloadVideoButton.innerHTML = defaultButtonHtml('video');
  downloadAudioButton.innerHTML = defaultButtonHtml('audio');
  downloadImageButton.innerHTML = defaultButtonHtml('image');
  downloadSubtitleButton.innerHTML = defaultButtonHtml('subtitle');
};

const clearParsedResult = ({clearMessage = true} = {}) => {
  if (playlistDialog?.open) playlistDialog.close();
  pendingPlaylist = null;
  currentImageCount = 0;
  currentImageCountTruncated = false;
  result.hidden = true;
  progressPanel.hidden = true;
  progressPanel.classList.remove('processing');
  downloadUrl.value = '';
  qualityInput.value = 'best';
  highestQualityLabel.textContent = '最高畫質';
  videoDownloadActions.hidden = false;
  imageDownloadActions.hidden = true;
  subtitleDownloadActions.hidden = true;
  subtitleSelect.innerHTML = '';
  document.querySelector('#title').textContent = '';
  document.querySelector('#channel').textContent = '';
  document.querySelector('#duration').textContent = '';
  const thumbnail = document.querySelector('#thumbnail');
  thumbnail.hidden = true;
  thumbnail.removeAttribute('src');
  resetActionButtonLabels();
  if (clearMessage) clearError();
};

const resetProgress = () => {
  progressPanel.hidden = false;
  progressPanel.classList.remove('processing');
  progressBar.style.width = '0%';
  progressTrack.setAttribute('aria-valuenow', '0');
  progressStatus.textContent = '準備下載';
  progressPercent.textContent = '0%';
  progressSize.textContent = '';
  progressSpeed.textContent = '';
  progressEta.textContent = '';
  stopDownloadButton.hidden = false;
  stopDownloadButton.disabled = true;
  stopDownloadButton.textContent = '■ 停止下載';
};

const updateProgress = data => {
  const percent = Math.max(0, Math.min(100, Number(data.progress) || 0));
  progressPanel.classList.toggle('processing', data.status === 'processing');
  progressBar.style.width = `${percent}%`;
  progressTrack.setAttribute('aria-valuenow', String(Math.round(percent)));
  progressStatus.textContent = data.message || '正在處理';
  progressPercent.textContent = `${Math.round(percent)}%`;

  const downloaded = formatBytes(Number(data.downloaded_bytes));
  const total = formatBytes(Number(data.total_bytes));
  progressSize.textContent = downloaded ? `${downloaded}${total ? ` / ${total}` : ''}` : '';
  progressSpeed.textContent = data.speed ? `${formatBytes(Number(data.speed))}/s` : '';
  progressEta.textContent = Number.isFinite(data.eta) && data.eta > 0
    ? `剩餘 ${formatDuration(data.eta)}`
    : '';
  const active = ['queued', 'downloading', 'processing', 'cancelling'].includes(data.status);
  stopDownloadButton.hidden = !active;
  stopDownloadButton.disabled = data.status === 'cancelling';
  stopDownloadButton.textContent = data.status === 'cancelling' ? '停止中…' : '■ 停止下載';
};

const setLookupLoading = loading => {
  lookupButton.disabled = loading;
  pasteUrlButton.disabled = loading;
  urlInput.disabled = loading;
  lookupButton.firstChild.textContent = loading ? '解析中… ' : '解析網址 ';
  document.body.classList.toggle('loading', loading);
};

urlInput.addEventListener('input', () => {
  const previousParsedUrl = downloadUrl.value.trim();
  if (previousParsedUrl || !result.hidden || !progressPanel.hidden) clearParsedResult();
  else clearError();
});

pasteUrlButton.addEventListener('click', async () => {
  clearError();
  if (!platform.clipboard.canReadText) {
    showError('目前瀏覽器無法直接讀取剪貼簿，請手動貼到網址欄位');
    urlInput.focus();
    return;
  }
  try {
    const value = (await platform.clipboard.readText()).trim();
    if (!value) throw new Error('剪貼簿裡沒有網址');
    urlInput.value = value;
    urlInput.dispatchEvent(new Event('input', {bubbles: true}));
    urlInput.focus();
  } catch (error) {
    showError(error.message || '無法讀取剪貼簿，請手動貼到網址欄位');
    urlInput.focus();
  }
});

lookupForm.addEventListener('submit', async event => {
  event.preventDefault();
  const url = urlInput.value.trim();
  clearParsedResult();
  clearError();
  setLookupLoading(true);

  try {
    const data = await api.info(url);

    const thumbnail = document.querySelector('#thumbnail');
    thumbnail.hidden = !data.thumbnail;
    if (data.thumbnail) thumbnail.src = data.thumbnail;
    document.querySelector('#title').textContent = data.title;
    document.querySelector('#channel').textContent = data.channel;
    document.querySelector('#duration').textContent = formatDuration(data.duration);
    downloadUrl.value = url;

    const imageMode = data.media_type === 'image';
    currentImageCount = imageMode ? Math.max(1, Number(data.image_count) || 1) : 0;
    currentImageCountTruncated = imageMode && Boolean(data.image_count_truncated);

    if (imageMode) {
      qualityInput.value = 'best';
      videoDownloadActions.hidden = true;
      imageDownloadActions.hidden = false;
      subtitleDownloadActions.hidden = true;
      downloadImageButton.innerHTML = defaultButtonHtml('image');
    } else {
      qualityInput.value = data.original_quality ? 'original' : 'best';
      const highest = data.highest_quality || (data.qualities || [])[0];
      highestQualityLabel.textContent = data.original_quality
        ? '最高畫質 · 原始畫質'
        : highest
          ? `最高畫質 · ${highest}p`
          : '最高畫質';
      videoDownloadActions.hidden = false;
      imageDownloadActions.hidden = true;

      subtitleSelect.innerHTML = '';
      (data.subtitles || []).forEach(track => {
        const suffix = track.automatic ? ' · 自動產生' : ' · 人工字幕';
        subtitleSelect.add(new Option(`${track.label} (${track.code})${suffix}`, track.code));
      });
      subtitleDownloadActions.hidden = subtitleSelect.options.length === 0;
    }

    resetActionButtonLabels();
    if (!imageMode) {
      const highest = data.highest_quality || (data.qualities || [])[0];
      highestQualityLabel.textContent = data.original_quality
        ? '最高畫質 · 原始畫質'
        : highest
          ? `最高畫質 · ${highest}p`
          : '最高畫質';
    }
    result.hidden = false;
    result.scrollIntoView({behavior: 'smooth', block: 'nearest'});

    pendingPlaylist = imageMode ? null : data.playlist;
    if (pendingPlaylist) {
      playlistDescription.textContent = `「${pendingPlaylist.title}」共有 ${pendingPlaylist.count} 部影片。是否下載整份播放清單？`;
      playlistDialog.showModal();
    }
  } catch (error) {
    clearParsedResult({clearMessage: false});
    showError(error.message);
  } finally {
    setLookupLoading(false);
  }
});

const setDownloadControlsDisabled = disabled => {
  lookupButton.disabled = disabled;
  pasteUrlButton.disabled = disabled;
  urlInput.disabled = disabled;
  subtitleSelect.disabled = disabled;
  downloadActionButtons.forEach(button => { button.disabled = disabled; });
};

const runDownloadJob = async ({url, type, quality, subtitle, onProgress = updateProgress}) => {
  const startData = await api.startDownload({url, type, quality, subtitle});
  const jobId = startData.job_id;
  activeJobId = jobId;
  stopDownloadButton.disabled = false;

  while (true) {
    await wait(750);
    let progressData;
    try {
      progressData = await api.progress(jobId);
    } catch (error) {
      activeJobId = null;
      throw error;
    }
    onProgress(progressData);
    if (progressData.status === 'error') {
      activeJobId = null;
      throw new Error(progressData.error || '下載失敗');
    }
    if (progressData.status === 'cancelled') {
      activeJobId = null;
      return {cancelled: true, jobId};
    }
    if (progressData.status === 'finished') {
      activeJobId = null;
      const fallbackNames = {
        image: 'photos.zip',
        audio: 'audio-download.mp3',
        subtitle: 'subtitle.srt',
        video: 'video-download.mp4',
      };
      return {cancelled: false, jobId, filename: progressData.filename || fallbackNames[type]};
    }
  }
};

const sendFileToBrowser = job => platform.files.download(api.fileUrl(job.jobId), job.filename);

const completedButtonHtml = type => {
  if (type === 'audio') return '<span>✓</span> MP3 已送出';
  if (type === 'image') return '<span>✓</span> 照片已送出';
  if (type === 'subtitle') return '<span>✓</span> CC 字幕已送出';
  return '<span>✓</span> MP4 已送出';
};

const startSingleDownload = async (button, type) => {
  if (activeJobId || activeBatch || button.disabled || !downloadUrl.value) return;
  clearError();
  resetProgress();
  setDownloadControlsDisabled(true);
  button.innerHTML = '<span>◌</span> 正在處理，請稍候…';
  let completed = false;

  try {
    const job = await runDownloadJob({
      url: downloadUrl.value,
      type,
      quality: qualityInput.value || 'best',
      subtitle: type === 'subtitle' ? subtitleSelect.value : '',
    });
    if (job.cancelled) return;
    completed = true;
    stopDownloadButton.hidden = true;
    await sendFileToBrowser(job);
    button.innerHTML = completedButtonHtml(type);
  } catch (error) {
    showError(error.message);
    progressStatus.textContent = '下載未完成';
    stopDownloadButton.hidden = true;
  } finally {
    activeJobId = null;
    setDownloadControlsDisabled(false);
    if (!completed) button.innerHTML = defaultButtonHtml(type);
  }
};

downloadVideoButton.addEventListener('click', () => startSingleDownload(downloadVideoButton, 'video'));
downloadAudioButton.addEventListener('click', () => startSingleDownload(downloadAudioButton, 'audio'));
downloadImageButton.addEventListener('click', () => startSingleDownload(downloadImageButton, 'image'));
downloadSubtitleButton.addEventListener('click', () => startSingleDownload(downloadSubtitleButton, 'subtitle'));

const saveJobToDirectory = async (job, directoryHandle, itemNumber, totalItems) => {
  const digits = String(totalItems).length;
  const filename = `${String(itemNumber).padStart(digits, '0')} - ${job.filename}`;
  activeFileTransferController = new AbortController();
  const response = await api.fileResponse(job.jobId, {
    signal: activeFileTransferController.signal,
  });

  try {
    await platform.files.saveResponseToDirectory(response, directoryHandle, filename, {
      signal: activeFileTransferController.signal,
    });
  } finally {
    activeFileTransferController = null;
  }
};

const startPlaylistBatch = async (playlist, directoryHandle) => {
  if (activeJobId || activeBatch) return;
  clearError();
  resetProgress();
  setDownloadControlsDisabled(true);
  activeBatch = {cancelled: false};
  downloadVideoButton.innerHTML = '<span>◌</span> 正在批次下載…';
  const quality = qualityInput.value || 'best';
  let completedCount = 0;

  try {
    for (let index = 0; index < playlist.entries.length; index += 1) {
      if (activeBatch.cancelled) break;
      const itemNumber = index + 1;
      const job = await runDownloadJob({
        url: playlist.entries[index].url,
        type: 'video',
        quality,
        subtitle: '',
        onProgress: data => {
          const itemProgress = Math.max(0, Math.min(100, Number(data.progress) || 0));
          const overallProgress = ((index + itemProgress / 100) / playlist.entries.length) * 100;
          updateProgress({
            ...data,
            status: data.status === 'cancelling' ? 'cancelling' : 'downloading',
            progress: overallProgress,
            message: `第 ${itemNumber}/${playlist.entries.length} 部 · ${data.message}`,
          });
        },
      });
      if (job.cancelled || activeBatch.cancelled) break;

      progressStatus.textContent = `第 ${itemNumber}/${playlist.entries.length} 部 · 正在儲存到指定資料夾`;
      await saveJobToDirectory(job, directoryHandle, itemNumber, playlist.entries.length);
      completedCount = itemNumber;
      const overallProgress = (completedCount / playlist.entries.length) * 100;
      progressBar.style.width = `${overallProgress}%`;
      progressTrack.setAttribute('aria-valuenow', String(Math.round(overallProgress)));
      progressPercent.textContent = `${Math.round(overallProgress)}%`;
    }

    if (activeBatch.cancelled) {
      progressStatus.textContent = `批次下載已停止，已完成 ${completedCount}/${playlist.entries.length} 部`;
      downloadVideoButton.innerHTML = defaultButtonHtml('video');
    } else {
      progressStatus.textContent = `播放清單下載完成，共 ${completedCount} 部`;
      progressPercent.textContent = '100%';
      progressBar.style.width = '100%';
      downloadVideoButton.innerHTML = '<span>✓</span> 全部下載完成';
    }
  } catch (error) {
    if (error.name !== 'AbortError') showError(error.message);
    progressStatus.textContent = `批次下載未完成，已完成 ${completedCount}/${playlist.entries.length} 部`;
    downloadVideoButton.innerHTML = defaultButtonHtml('video');
  } finally {
    activeJobId = null;
    activeBatch = null;
    activeFileTransferController = null;
    stopDownloadButton.hidden = true;
    setDownloadControlsDisabled(false);
  }
};

playlistSingleButton.addEventListener('click', () => playlistDialog.close());

playlistAllButton.addEventListener('click', async () => {
  if (!pendingPlaylist) return;
  if (!platform.files.canPickDirectory) {
    playlistDialog.close();
    showError('目前瀏覽器不支援選擇資料夾，請改用最新版 Chrome 或 Edge');
    return;
  }
  try {
    const directoryHandle = await platform.files.pickDirectory({mode: 'readwrite'});
    const playlist = pendingPlaylist;
    playlistDialog.close();
    await startPlaylistBatch(playlist, directoryHandle);
  } catch (error) {
    if (error.name !== 'AbortError') showError(`無法使用指定資料夾：${error.message}`);
  }
});

stopDownloadButton.addEventListener('click', async () => {
  if ((!activeJobId && !activeBatch) || stopDownloadButton.disabled) return;
  if (activeBatch) activeBatch.cancelled = true;
  activeFileTransferController?.abort();
  stopDownloadButton.disabled = true;
  stopDownloadButton.textContent = '停止中…';
  progressStatus.textContent = '正在停止下載';
  if (!activeJobId) return;

  try {
    await api.cancel(activeJobId);
  } catch (error) {
    showError(error.message);
  }
});

platform.lifecycle.onPageHide(() => {
  if (activeBatch) activeBatch.cancelled = true;
  activeFileTransferController?.abort();
  if (!activeJobId) return;
  platform.lifecycle.sendBeacon(api.cancelUrl(activeJobId));
});

clearParsedResult();
platform.pwa.registerServiceWorker().catch(() => {});
