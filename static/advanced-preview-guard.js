'use strict';
(() => {
  if (window.DownloadStarryAdvancedPreviewGuard) return;

  const video = document.getElementById('advanced-preview-video');
  const startRange = document.getElementById('advanced-trim-start');
  const endRange = document.getElementById('advanced-trim-end');
  const status = document.getElementById('advanced-preview-status');
  if (!video || !startRange || !endRange) return;

  let frameToken = 0;
  const bounds = () => ({
    start: Math.max(0, Number(startRange.value) || 0),
    end: Math.max(0, Number(endRange.value) || 0),
  });
  const formatTime = seconds => {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return hours
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const stopAtEnd = () => {
    const {end} = bounds();
    if (!end || video.currentTime < end - 0.025) return false;
    if (!video.paused) video.pause();
    if (Math.abs(video.currentTime - end) > 0.02) {
      try { video.currentTime = end; } catch (_) {}
    }
    if (status) status.textContent = `預覽已在 ${formatTime(end)} 停止`;
    return true;
  };

  const watchFrames = () => {
    const token = ++frameToken;
    const tick = () => {
      if (token !== frameToken || video.paused || video.ended) return;
      if (stopAtEnd()) return;
      if (typeof video.requestVideoFrameCallback === 'function') video.requestVideoFrameCallback(tick);
      else requestAnimationFrame(tick);
    };
    if (typeof video.requestVideoFrameCallback === 'function') video.requestVideoFrameCallback(tick);
    else requestAnimationFrame(tick);
  };

  video.addEventListener('play', () => {
    const {start, end} = bounds();
    if (end <= start) {
      video.pause();
      return;
    }
    if (video.currentTime < start - 0.05 || video.currentTime >= end - 0.025) {
      try { video.currentTime = start; } catch (_) {}
    }
    watchFrames();
  });
  video.addEventListener('timeupdate', stopAtEnd);
  video.addEventListener('pause', () => { frameToken += 1; });
  endRange.addEventListener('input', () => {
    if (!video.paused) stopAtEnd();
  });

  window.DownloadStarryAdvancedPreviewGuard = Object.freeze({stopAtEnd});
})();
