const lookupForm = document.querySelector('#lookup-form');
const result = document.querySelector('#result');
const message = document.querySelector('#message');
const lookupButton = document.querySelector('#lookup-button');
const downloadButton = document.querySelector('#download-button');
const progressPanel = document.querySelector('#download-progress');
const progressBar = document.querySelector('#progress-bar');
const progressTrack = document.querySelector('.progress-track');
const progressStatus = document.querySelector('#progress-status');
const progressPercent = document.querySelector('#progress-percent');
const progressSize = document.querySelector('#progress-size');
const progressSpeed = document.querySelector('#progress-speed');
const progressEta = document.querySelector('#progress-eta');
const stopDownloadButton = document.querySelector('#stop-download');
const subtitleTab = document.querySelector('#subtitle-tab');
const subtitleSelect = document.querySelector('#subtitle-language');
const playlistDialog = document.querySelector('#playlist-dialog');
const playlistDescription = document.querySelector('#playlist-description');
const playlistSingleButton = document.querySelector('#playlist-single');
const playlistAllButton = document.querySelector('#playlist-all');
let activeJobId = null;
let activeBatch = null;
let activeFileTransferController = null;
let pendingPlaylist = null;

const showError = text => {
  message.textContent = text;
  message.classList.add('show');
};

const clearError = () => message.classList.remove('show');
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

lookupForm.addEventListener('submit', async event => {
  event.preventDefault();
  clearError();
  result.hidden = true;
  progressPanel.hidden = true;
  lookupButton.disabled = true;
  lookupButton.firstChild.textContent = '解析中… ';
  document.body.classList.add('loading');
  const url = document.querySelector('#url').value.trim();

  try {
    const response = await fetch('/api/info', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({url}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '無法解析影片');

    const thumbnail = document.querySelector('#thumbnail');
    thumbnail.hidden = !data.thumbnail;
    if (data.thumbnail) thumbnail.src = data.thumbnail;
    document.querySelector('#title').textContent = data.title;
    document.querySelector('#channel').textContent = data.channel;
    document.querySelector('#duration').textContent = formatDuration(data.duration);
    document.querySelector('#download-url').value = url;

    const select = document.querySelector('#quality');
    select.innerHTML = '';
    if (data.original_quality) {
      select.add(new Option('原始畫質', 'original'));
    } else (data.qualities.length ? data.qualities : [720]).forEach((height, index) => {
      select.add(new Option(`${height}p${index === 0 ? ' · 最佳畫質' : ''}`, height));
    });

    subtitleSelect.innerHTML = '';
    (data.subtitles || []).forEach(track => {
      const suffix = track.automatic ? ' · 自動產生' : ' · 人工字幕';
      subtitleSelect.add(new Option(`${track.label} (${track.code})${suffix}`, track.code));
    });
    subtitleTab.hidden = subtitleSelect.options.length === 0;
    selectDownloadType('video');
    result.hidden = false;
    result.scrollIntoView({behavior: 'smooth', block: 'nearest'});
    pendingPlaylist = data.playlist;
    if (pendingPlaylist) {
      playlistDescription.textContent = `「${pendingPlaylist.title}」共有 ${pendingPlaylist.count} 部影片。是否下載整份播放清單？`;
      playlistDialog.showModal();
    }
  } catch (error) {
    showError(error.message);
  } finally {
    lookupButton.disabled = false;
    lookupButton.firstChild.textContent = '解析影片 ';
    document.body.classList.remove('loading');
  }
});

const selectDownloadType = type => {
  document.querySelectorAll('.type-tab').forEach(item => item.classList.remove('active'));
  const selectedTab = document.querySelector(`.type-tab[data-type="${type}"]`);
  selectedTab.classList.add('active');
  document.querySelectorAll('.type-tab').forEach(item => {
    item.setAttribute('aria-selected', String(item === selectedTab));
  });
  const audio = type === 'audio';
  const subtitle = type === 'subtitle';
  document.querySelector('#download-type').value = type;
  document.querySelector('#quality-group').hidden = audio || subtitle;
  document.querySelector('#audio-note').hidden = !audio;
  document.querySelector('#subtitle-group').hidden = !subtitle;
  if (!downloadButton.disabled) {
    downloadButton.innerHTML = subtitle
      ? '<span>↓</span> 下載 CC 字幕'
      : '<span>↓</span> 開始下載';
  }
};

document.querySelectorAll('.type-tab').forEach(tab => {
  tab.addEventListener('click', () => selectDownloadType(tab.dataset.type));
});

selectDownloadType('video');

const setDownloadControlsDisabled = disabled => {
  downloadButton.disabled = disabled;
  lookupButton.disabled = disabled;
  document.querySelectorAll('.type-tab').forEach(tab => { tab.disabled = disabled; });
};

const runDownloadJob = async ({url, type, quality, subtitle, onProgress = updateProgress}) => {
  const formData = new FormData();
  formData.append('url', url);
  formData.append('type', type);
  formData.append('quality', quality);
  formData.append('subtitle', subtitle || '');
  const startResponse = await fetch('/api/download', {method: 'POST', body: formData});
  const startData = await startResponse.json();
  if (!startResponse.ok) throw new Error(startData.error || '無法開始下載');

  const jobId = startData.job_id;
  activeJobId = jobId;
  stopDownloadButton.disabled = false;
  while (true) {
    await wait(750);
    const progressResponse = await fetch(`/api/download/${jobId}/progress`, {cache: 'no-store'});
    const progressData = await progressResponse.json();
    if (!progressResponse.ok) {
      activeJobId = null;
      throw new Error(progressData.error || '無法取得下載進度');
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
      return {cancelled: false, jobId, filename: progressData.filename || 'video-download.mp4'};
    }
  }
};

const saveJobToDirectory = async (job, directoryHandle, itemNumber, totalItems) => {
  const digits = String(totalItems).length;
  const filename = `${String(itemNumber).padStart(digits, '0')} - ${job.filename}`;
  activeFileTransferController = new AbortController();
  const response = await fetch(`/api/download/${job.jobId}/file`, {
    signal: activeFileTransferController.signal,
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || '無法取得已下載的影片');
  }

  const fileHandle = await directoryHandle.getFileHandle(filename, {create: true});
  const writable = await fileHandle.createWritable();
  try {
    if (response.body) {
      await response.body.pipeTo(writable, {signal: activeFileTransferController.signal});
    } else {
      await writable.write(await response.blob());
      await writable.close();
    }
  } catch (error) {
    await writable.abort().catch(() => {});
    throw error;
  } finally {
    activeFileTransferController = null;
  }
};

downloadButton.addEventListener('click', async () => {
  if (activeJobId || activeBatch || downloadButton.disabled) return;
  clearError();
  resetProgress();
  setDownloadControlsDisabled(true);
  downloadButton.innerHTML = '<span>◌</span> 正在處理，請稍候…';
  let completed = false;

  try {
    const job = await runDownloadJob({
      url: document.querySelector('#download-url').value,
      type: document.querySelector('#download-type').value,
      quality: document.querySelector('#quality').value,
      subtitle: subtitleSelect.value,
    });
    if (job.cancelled) return;
    completed = true;
    stopDownloadButton.hidden = true;
    const link = document.createElement('a');
    link.href = `/api/download/${job.jobId}/file`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    downloadButton.innerHTML = '<span>✓</span> 已送出，請查看瀏覽器下載項目';
  } catch (error) {
    showError(error.message);
    progressStatus.textContent = '下載未完成';
    stopDownloadButton.hidden = true;
  } finally {
    activeJobId = null;
    setDownloadControlsDisabled(false);
    if (!completed) downloadButton.innerHTML = '<span>↓</span> 重新下載';
  }
});

const startPlaylistBatch = async (playlist, directoryHandle) => {
  if (activeJobId || activeBatch) return;
  clearError();
  resetProgress();
  setDownloadControlsDisabled(true);
  activeBatch = {cancelled: false};
  downloadButton.innerHTML = '<span>◌</span> 正在批次下載…';
  const quality = document.querySelector('#quality').value || '720';
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
      downloadButton.innerHTML = '<span>↓</span> 重新下載';
    } else {
      progressStatus.textContent = `播放清單下載完成，共 ${completedCount} 部`;
      progressPercent.textContent = '100%';
      progressBar.style.width = '100%';
      downloadButton.innerHTML = '<span>✓</span> 全部下載完成';
    }
  } catch (error) {
    if (error.name !== 'AbortError') showError(error.message);
    progressStatus.textContent = `批次下載未完成，已完成 ${completedCount}/${playlist.entries.length} 部`;
    downloadButton.innerHTML = '<span>↓</span> 重新下載';
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
  if (!window.showDirectoryPicker) {
    playlistDialog.close();
    showError('目前瀏覽器不支援選擇資料夾，請改用最新版 Chrome 或 Edge');
    return;
  }
  try {
    const directoryHandle = await window.showDirectoryPicker({mode: 'readwrite'});
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
    const response = await fetch(`/api/download/${activeJobId}/cancel`, {method: 'POST'});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '無法停止下載');
  } catch (error) {
    showError(error.message);
  }
});

window.addEventListener('pagehide', () => {
  if (activeBatch) activeBatch.cancelled = true;
  activeFileTransferController?.abort();
  if (!activeJobId) return;
  const cancelUrl = `/api/download/${activeJobId}/cancel`;
  const sent = navigator.sendBeacon(cancelUrl, new Blob([], {type: 'application/octet-stream'}));
  if (!sent) fetch(cancelUrl, {method: 'POST', keepalive: true}).catch(() => {});
});
