'use strict';
(() => {
  if (window.DownloadStarryAdvancedMember) return;

  const api = window.SaveVideoAPI;
  const platform = window.SaveVideoPlatform;
  const result = document.getElementById('result');
  const videoActions = document.getElementById('video-download-actions');
  const sourceUrl = document.getElementById('download-url');
  const visibleUrl = document.getElementById('url');
  const titleNode = document.getElementById('title');
  const channelNode = document.getElementById('channel');
  const thumbnailNode = document.getElementById('thumbnail');
  const durationNode = document.getElementById('duration');
  const subtitleActions = document.getElementById('subtitle-download-actions');
  const qualityInput = document.getElementById('quality');
  const lookupButton = document.getElementById('lookup-button');
  const clearButton = document.getElementById('clear-url-button');
  if (!api || !platform || !result || !videoActions || !sourceUrl || !lookupButton) return;

  const grid = videoActions.querySelector('.download-action-grid');
  if (!grid) return;

  // 保留真正的解析 submit 按鈕供自動解析流程使用，但從畫面上隱藏。
  lookupButton.hidden = true;
  lookupButton.setAttribute('aria-hidden', 'true');
  lookupButton.tabIndex = -1;

  let topReportButton = document.getElementById('top-report-button');
  if (!topReportButton) {
    topReportButton = document.createElement('button');
    topReportButton.id = 'top-report-button';
    topReportButton.type = 'button';
    topReportButton.className = 'top-report-button';
    topReportButton.textContent = '回報錯誤';
    topReportButton.setAttribute('aria-label', '回報錯誤');
    if (clearButton?.parentElement) clearButton.insertAdjacentElement('afterend', topReportButton);
  }

  let toggle = document.getElementById('report-download-button');
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.id = 'report-download-button';
    toggle.type = 'button';
    grid.appendChild(toggle);
  }
  toggle.className = 'download-button advanced-member-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'advanced-member-panel');
  toggle.innerHTML = '進階功能｜會員限定 <span aria-hidden="true">⌄</span>';

  const panel = document.createElement('section');
  panel.id = 'advanced-member-panel';
  panel.className = 'advanced-member-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="advanced-member-stack">
      <div>
        <h3 class="advanced-member-title">會員進階功能</h3>
        <p class="advanced-member-note">收藏、CC 字幕、自訂裁切都集中在這裡。</p>
      </div>
      <button id="advanced-favorite-button" class="advanced-feature-button" type="button">☆ 加入我的收藏</button>
      <section id="advanced-cc-section" class="advanced-section" hidden>
        <div><strong>CC 字幕</strong></div>
        <div id="advanced-cc-slot"></div>
      </section>
      <button id="advanced-trim-toggle" class="advanced-feature-button" type="button">✂ 自訂裁切影片</button>
      <section id="advanced-trim-section" class="advanced-section" hidden>
        <div>
          <strong>自訂裁切</strong>
          <p class="advanced-member-note">拖曳時間軸的頭尾位置，影片會即時跳到該位置預覽。</p>
        </div>
        <div class="advanced-preview-shell">
          <video id="advanced-preview-video" controls playsinline preload="metadata"></video>
          <div id="advanced-preview-status" class="advanced-preview-status">尚未準備預覽</div>
        </div>
        <div class="advanced-timeline" aria-label="裁切時間軸">
          <div class="advanced-timeline-track" aria-hidden="true"></div>
          <input id="advanced-trim-start" type="range" min="0" max="1" step="0.1" value="0" aria-label="裁切開始時間">
          <input id="advanced-trim-end" type="range" min="0" max="1" step="0.1" value="1" aria-label="裁切結束時間">
        </div>
        <div class="advanced-time-summary">
          <div class="advanced-time-chip">開始 <span id="advanced-start-label">00:00</span></div>
          <div class="advanced-time-chip">結束 <span id="advanced-end-label">00:00</span></div>
          <div class="advanced-time-chip">片段 <span id="advanced-length-label">00:00</span></div>
        </div>
        <div class="advanced-trim-actions">
          <button id="advanced-preview-play" type="button">▶ 預覽片段</button>
          <button id="advanced-trim-download" type="button">下載裁切</button>
          <button id="advanced-trim-share" type="button">分享裁切</button>
        </div>
      </section>
    </div>`;
  grid.appendChild(panel);

  const favoriteButton = panel.querySelector('#advanced-favorite-button');
  const ccSection = panel.querySelector('#advanced-cc-section');
  const ccSlot = panel.querySelector('#advanced-cc-slot');
  const trimToggle = panel.querySelector('#advanced-trim-toggle');
  const trimSection = panel.querySelector('#advanced-trim-section');
  const previewVideo = panel.querySelector('#advanced-preview-video');
  const previewStatus = panel.querySelector('#advanced-preview-status');
  const startRange = panel.querySelector('#advanced-trim-start');
  const endRange = panel.querySelector('#advanced-trim-end');
  const startLabel = panel.querySelector('#advanced-start-label');
  const endLabel = panel.querySelector('#advanced-end-label');
  const lengthLabel = panel.querySelector('#advanced-length-label');
  const previewPlay = panel.querySelector('#advanced-preview-play');
  const trimDownload = panel.querySelector('#advanced-trim-download');
  const trimShare = panel.querySelector('#advanced-trim-share');

  let memberCache = null;
  let memberCacheAt = 0;
  let favorite = false;
  let previewJobId = null;
  let previewReadyKey = '';
  let previewPreparing = false;
  let trimJobCache = null;
  let generation = 0;

  const endpoint = path => api.endpoint(path);
  const currentUrl = () => String(sourceUrl.value || visibleUrl?.value || '').trim();
  const currentKey = () => `${currentUrl()}|${String(titleNode?.textContent || '').trim()}`;
  const parsedDuration = () => {
    const text = String(durationNode?.textContent || '').trim();
    if (!text) return 0;
    const parts = text.split(':').map(Number);
    if (parts.some(value => !Number.isFinite(value))) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
  };
  const formatTime = seconds => {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

  const showGate = () => {
    let gate = document.getElementById('advanced-member-gate');
    if (!gate) {
      gate = document.createElement('div');
      gate.id = 'advanced-member-gate';
      gate.className = 'advanced-gate';
      gate.hidden = true;
      gate.innerHTML = `
        <section class="advanced-gate-card" role="dialog" aria-modal="true" aria-labelledby="advanced-gate-title">
          <h2 id="advanced-gate-title">進階功能｜會員限定</h2>
          <p>登入 Starry ID 後，即可使用收藏、CC 字幕與自訂裁切。</p>
          <div class="advanced-gate-actions">
            <button class="advanced-gate-login" type="button">登入／免費註冊</button>
            <button class="advanced-gate-close" type="button">稍後再說</button>
          </div>
        </section>`;
      document.body.appendChild(gate);
      gate.querySelector('.advanced-gate-login').addEventListener('click', () => location.assign('/api/auth/starry/login?choose=1'));
      gate.querySelector('.advanced-gate-close').addEventListener('click', () => { gate.hidden = true; });
      gate.addEventListener('click', event => { if (event.target === gate) gate.hidden = true; });
    }
    gate.hidden = false;
    gate.querySelector('.advanced-gate-login')?.focus();
  };

  const session = async ({force = false} = {}) => {
    if (!force && memberCache && Date.now() - memberCacheAt < 30000) return memberCache;
    try {
      const response = await fetch(endpoint('/api/auth/starry/session'), {cache: 'no-store'});
      if (!response.ok) {
        memberCache = null;
        return null;
      }
      const data = await response.json().catch(() => ({}));
      memberCache = data?.authenticated ? data.user : null;
      memberCacheAt = Date.now();
      return memberCache;
    } catch {
      memberCache = null;
      return null;
    }
  };

  const syncCcVisibility = () => {
    const available = Boolean(subtitleActions && !subtitleActions.hidden && subtitleActions.querySelector('option'));
    ccSection.hidden = !available;
  };

  const syncMediaAvailability = () => {
    const isVideo = !videoActions.hidden && Boolean(currentUrl());
    trimToggle.hidden = !isVideo;
    if (!isVideo) trimSection.hidden = true;
  };

  const ensurePlacement = () => {
    if (toggle.parentElement !== grid) grid.appendChild(toggle);
    if (panel.parentElement !== grid) grid.appendChild(panel);
    if (subtitleActions && subtitleActions.parentElement !== ccSlot) ccSlot.appendChild(subtitleActions);
    toggle.className = 'download-button advanced-member-toggle';
    toggle.innerHTML = `進階功能｜會員限定 <span aria-hidden="true">${panel.hidden ? '⌄' : '⌃'}</span>`;
    syncCcVisibility();
    syncMediaAvailability();
    window.DownloadStarryResultLayout?.syncActionWidth?.();
  };

  const favoritePayload = () => ({
    url: currentUrl(),
    title: String(titleNode?.textContent || '').trim(),
    thumbnail: String(thumbnailNode?.src || '').trim(),
    platform: String(channelNode?.textContent || '').trim(),
    duration: parsedDuration(),
  });

  const renderFavorite = () => {
    favoriteButton.textContent = favorite ? '★ 已加入我的收藏' : '☆ 加入我的收藏';
    favoriteButton.classList.toggle('is-active', favorite);
  };

  const refreshFavorite = async () => {
    const url = currentUrl();
    favorite = false;
    renderFavorite();
    if (!url) return;
    try {
      const response = await fetch(endpoint(`/api/favorites?url=${encodeURIComponent(url)}`), {cache: 'no-store'});
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      favorite = Boolean(data.favorite);
      renderFavorite();
    } catch (_) {}
  };

  favoriteButton.addEventListener('click', async () => {
    if (!await session()) return showGate();
    const payload = favoritePayload();
    if (!payload.url) return;
    favoriteButton.disabled = true;
    try {
      const response = await fetch(endpoint('/api/favorites'), {
        method: favorite ? 'DELETE' : 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '收藏操作失敗');
      favorite = Boolean(data.favorite);
      renderFavorite();
    } catch (error) {
      previewStatus.textContent = error.message || '收藏操作失敗';
    } finally {
      favoriteButton.disabled = false;
    }
  });

  const updateTimelineLabels = () => {
    const start = Number(startRange.value) || 0;
    const end = Number(endRange.value) || 0;
    startLabel.textContent = formatTime(start);
    endLabel.textContent = formatTime(end);
    lengthLabel.textContent = formatTime(Math.max(0, end - start));
  };

  const setTimelineDuration = seconds => {
    const duration = Math.max(0, Number(seconds) || 0);
    const max = Math.max(1, duration);
    startRange.max = String(max);
    endRange.max = String(max);
    startRange.value = '0';
    endRange.value = String(max);
    startRange.disabled = duration <= 0;
    endRange.disabled = duration <= 0;
    trimJobCache = null;
    updateTimelineLabels();
  };

  const constrainRange = changed => {
    const max = Number(endRange.max) || 1;
    let start = Math.max(0, Number(startRange.value) || 0);
    let end = Math.min(max, Number(endRange.value) || max);
    const gap = Math.min(0.5, max);
    if (end - start < gap) {
      if (changed === 'start') start = Math.max(0, end - gap);
      else end = Math.min(max, start + gap);
    }
    startRange.value = String(start);
    endRange.value = String(end);
    trimJobCache = null;
    updateTimelineLabels();
    if (previewVideo.readyState >= 1 && Number.isFinite(previewVideo.duration)) {
      const target = changed === 'end' ? end : start;
      try { previewVideo.currentTime = Math.min(target, Math.max(0, previewVideo.duration - 0.05)); } catch (_) {}
    }
  };

  startRange.addEventListener('input', () => constrainRange('start'));
  endRange.addEventListener('input', () => constrainRange('end'));

  const postAdvancedJob = async ({mode, start = 0, end = 0}) => {
    const form = new FormData();
    form.append('url', currentUrl());
    form.append('mode', mode);
    form.append('quality', qualityInput?.value || 'best');
    if (mode === 'trim') {
      form.append('start', String(start));
      form.append('end', String(end));
    }
    const response = await fetch(endpoint('/api/advanced/download'), {method: 'POST', body: form});
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      showGate();
      throw new Error('請先登入 Starry ID');
    }
    if (!response.ok) throw new Error(data.error || '無法開始進階處理');
    return String(data.job_id || '');
  };

  const pollJob = async (jobId, statusPrefix) => {
    while (true) {
      await wait(700);
      const data = await api.progress(jobId);
      const percent = Math.max(0, Math.min(100, Number(data.progress) || 0));
      previewStatus.textContent = `${statusPrefix} ${Math.round(percent)}%${data.message ? `｜${data.message}` : ''}`;
      if (data.status === 'error') throw new Error(data.error || `${statusPrefix}失敗`);
      if (data.status === 'cancelled') throw new Error('處理已停止');
      if (data.status === 'finished') return data;
    }
  };

  const resetPreview = () => {
    generation += 1;
    previewReadyKey = '';
    previewPreparing = false;
    trimJobCache = null;
    previewJobId = null;
    previewVideo.pause();
    previewVideo.removeAttribute('src');
    previewVideo.load();
    previewStatus.textContent = '尚未準備預覽';
    setTimelineDuration(parsedDuration());
  };

  const preparePreview = async () => {
    if (!await session()) {
      showGate();
      return false;
    }
    const key = currentKey();
    if (!currentUrl()) return false;
    if (previewReadyKey === key && previewVideo.currentSrc) return true;
    if (previewPreparing) return false;

    const token = ++generation;
    previewPreparing = true;
    trimToggle.disabled = true;
    previewStatus.textContent = '正在準備低流量預覽…';
    try {
      const jobId = await postAdvancedJob({mode: 'preview'});
      previewJobId = jobId;
      await pollJob(jobId, '準備預覽');
      if (token !== generation) return false;
      const fileUrl = endpoint(`/api/advanced/file/${jobId}`);
      previewVideo.src = `${fileUrl}?v=${Date.now()}`;
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('預覽載入逾時')), 30000);
        const done = () => { clearTimeout(timeout); cleanup(); resolve(); };
        const fail = () => { clearTimeout(timeout); cleanup(); reject(new Error('預覽影片無法載入')); };
        const cleanup = () => {
          previewVideo.removeEventListener('loadedmetadata', done);
          previewVideo.removeEventListener('error', fail);
        };
        previewVideo.addEventListener('loadedmetadata', done, {once: true});
        previewVideo.addEventListener('error', fail, {once: true});
        previewVideo.load();
      });
      if (token !== generation) return false;
      const duration = Number(previewVideo.duration) || parsedDuration();
      setTimelineDuration(duration);
      previewReadyKey = key;
      previewStatus.textContent = '預覽已就緒，可拖曳頭尾時間軸。';
      return true;
    } catch (error) {
      if (token === generation) previewStatus.textContent = error.message || '預覽準備失敗';
      return false;
    } finally {
      if (token === generation) {
        previewPreparing = false;
        trimToggle.disabled = false;
      }
    }
  };

  let previewEndWatcher = null;
  const previewSelection = async () => {
    if (!await preparePreview()) return;
    const start = Number(startRange.value) || 0;
    const end = Number(endRange.value) || 0;
    if (end <= start) return;
    previewVideo.pause();
    try { previewVideo.currentTime = start; } catch (_) {}
    if (previewEndWatcher) previewVideo.removeEventListener('timeupdate', previewEndWatcher);
    previewEndWatcher = () => {
      if (previewVideo.currentTime >= end - 0.05) {
        previewVideo.pause();
        previewVideo.removeEventListener('timeupdate', previewEndWatcher);
        previewEndWatcher = null;
      }
    };
    previewVideo.addEventListener('timeupdate', previewEndWatcher);
    try { await previewVideo.play(); } catch (_) {}
  };

  const trimKey = () => `${currentKey()}|${Number(startRange.value).toFixed(1)}|${Number(endRange.value).toFixed(1)}|${qualityInput?.value || 'best'}`;

  const ensureTrimJob = async () => {
    if (!await session()) {
      showGate();
      return null;
    }
    const key = trimKey();
    if (trimJobCache?.key === key && trimJobCache?.jobId) return trimJobCache;
    const start = Number(startRange.value) || 0;
    const end = Number(endRange.value) || 0;
    if (end <= start) throw new Error('請先設定正確的裁切起點與終點');
    trimDownload.disabled = true;
    trimShare.disabled = true;
    previewStatus.textContent = '正在製作裁切片段…';
    try {
      const jobId = await postAdvancedJob({mode: 'trim', start, end});
      const data = await pollJob(jobId, '裁切處理');
      trimJobCache = {key, jobId, filename: data.filename || 'trimmed-video.mp4'};
      previewStatus.textContent = '裁切完成，可下載或分享。';
      return trimJobCache;
    } finally {
      trimDownload.disabled = false;
      trimShare.disabled = false;
    }
  };

  const loadSharePlatform = async () => {
    if (window.DownloadStarryMemberPlatform?.share?.file) return window.DownloadStarryMemberPlatform.share;
    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-downloadstarry-share-platform]');
      const script = existing || document.createElement('script');
      const finish = () => window.DownloadStarryMemberPlatform?.share?.file ? resolve() : reject(new Error('分享功能載入未完成'));
      if (existing) {
        existing.addEventListener('load', finish, {once: true});
        existing.addEventListener('error', () => reject(new Error('分享功能載入失敗')), {once: true});
        setTimeout(finish, 0);
      } else {
        script.src = '/static/member-platform.js';
        script.dataset.downloadstarrySharePlatform = '1';
        script.addEventListener('load', finish, {once: true});
        script.addEventListener('error', () => reject(new Error('分享功能載入失敗')), {once: true});
        document.head.appendChild(script);
      }
    });
    return window.DownloadStarryMemberPlatform.share;
  };

  trimToggle.addEventListener('click', async () => {
    if (!await session()) return showGate();
    trimSection.hidden = !trimSection.hidden;
    trimToggle.classList.toggle('is-active', !trimSection.hidden);
    if (!trimSection.hidden) await preparePreview();
  });

  previewPlay.addEventListener('click', previewSelection);

  trimDownload.addEventListener('click', async () => {
    try {
      const job = await ensureTrimJob();
      if (!job) return;
      await platform.files.download(endpoint(`/api/advanced/file/${job.jobId}?download=1`), job.filename);
    } catch (error) {
      previewStatus.textContent = error.message || '裁切下載失敗';
    }
  });

  trimShare.addEventListener('click', async () => {
    try {
      const job = await ensureTrimJob();
      if (!job) return;
      trimShare.disabled = true;
      previewStatus.textContent = '正在載入裁切片段準備分享…';
      const response = await fetch(endpoint(`/api/advanced/file/${job.jobId}`), {cache: 'no-store'});
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || '無法取得裁切檔案');
      }
      const blob = await response.blob();
      const file = new File([blob], job.filename, {type: blob.type || 'video/mp4'});
      const share = await loadSharePlatform();
      await share.file(file, {
        title: `${String(titleNode?.textContent || '繁星下載').trim()}｜裁切片段`,
        text: String(titleNode?.textContent || '繁星下載').trim(),
      });
      previewStatus.textContent = '已開啟手機分享選單';
    } catch (error) {
      previewStatus.textContent = error.message || '裁切分享失敗';
    } finally {
      trimShare.disabled = false;
    }
  });

  toggle.addEventListener('click', async event => {
    event.preventDefault();
    event.stopPropagation();
    if (!await session()) return showGate();
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
    toggle.innerHTML = `進階功能｜會員限定 <span aria-hidden="true">${panel.hidden ? '⌄' : '⌃'}</span>`;
    if (!panel.hidden) {
      ensurePlacement();
      await refreshFavorite();
      setTimelineDuration(parsedDuration());
    }
  });

  const resetForNewResource = () => {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    favorite = false;
    renderFavorite();
    trimSection.hidden = true;
    trimToggle.classList.remove('is-active');
    resetPreview();
    ensurePlacement();
  };

  visibleUrl?.addEventListener('input', resetForNewResource);
  new MutationObserver(() => {
    if (result.hidden) resetForNewResource();
    else {
      requestAnimationFrame(() => {
        ensurePlacement();
        syncCcVisibility();
        setTimelineDuration(parsedDuration());
      });
    }
  }).observe(result, {attributes: true, attributeFilter: ['hidden']});

  if (subtitleActions) {
    new MutationObserver(() => {
      syncCcVisibility();
      ensurePlacement();
    }).observe(subtitleActions, {attributes: true, childList: true, subtree: true, attributeFilter: ['hidden']});
  }

  ensurePlacement();
  renderFavorite();
  setTimelineDuration(parsedDuration());

  window.DownloadStarryAdvancedMember = Object.freeze({
    ensurePlacement,
    session,
    preparePreview,
  });
})();
