'use strict';
(() => {
  if (window.DownloadStarryResultLayout) return;

  const syncActionWidth = () => {
    const actions = document.getElementById('video-download-actions');
    const grid = actions?.querySelector('.download-action-grid');
    const audioGroup = actions?.querySelector('.resource-action-group-audio');
    const clearButton = document.getElementById('clear-url-button');
    const lastButton = document.getElementById('share-audio-button');
    if (!actions || !grid || !audioGroup || !clearButton || !lastButton) return;

    actions.style.width = '100%';
    grid.style.width = '100%';

    const actionRect = actions.getBoundingClientRect();
    const clearRect = clearButton.getBoundingClientRect();
    const lastRect = lastButton.getBoundingClientRect();
    const audioRect = audioGroup.getBoundingClientRect();
    const viewportRight = document.documentElement.clientWidth - 10;
    const targetRight = Math.min(clearRect.right, viewportRight);
    const rightInset = Math.max(0, audioRect.right - lastRect.right);
    const desired = Math.max(240, Math.min(targetRight - actionRect.left + rightInset, viewportRight - actionRect.left));

    actions.style.width = `${Math.floor(desired)}px`;
    grid.style.width = '100%';
  };

  const scheduleSync = () => requestAnimationFrame(() => requestAnimationFrame(syncActionWidth));
  scheduleSync();
  window.addEventListener('resize', scheduleSync, {passive:true});
  window.addEventListener('orientationchange', scheduleSync, {passive:true});
  if (window.ResizeObserver) {
    const urlRow = document.querySelector('.url-row');
    if (urlRow) new ResizeObserver(scheduleSync).observe(urlRow);
  }

  window.DownloadStarryResultLayout = Object.freeze({syncActionWidth});
})();
