'use strict';
(() => {
  if (window.DownloadStarryResultLayout) return;

  const syncActionLayout = () => {
    const actions = document.getElementById('video-download-actions');
    const grid = actions?.querySelector('.download-action-grid');
    const videoGroup = actions?.querySelector('.resource-action-group-video');
    const audioGroup = actions?.querySelector('.resource-action-group-audio');
    const reportButton = document.getElementById('report-download-button');
    if (!actions || !grid || !videoGroup || !audioGroup) return;

    actions.style.setProperty('width', '100%', 'important');
    actions.style.setProperty('max-width', 'none', 'important');

    grid.style.setProperty('display', 'grid', 'important');
    grid.style.setProperty('width', '100%', 'important');
    grid.style.setProperty('max-width', 'none', 'important');
    grid.style.setProperty('grid-template-columns', 'minmax(0,1fr) minmax(0,1fr)', 'important');

    videoGroup.style.setProperty('grid-column', '1', 'important');
    audioGroup.style.setProperty('grid-column', '2', 'important');
    videoGroup.style.setProperty('width', '100%', 'important');
    audioGroup.style.setProperty('width', '100%', 'important');
    videoGroup.style.setProperty('max-width', 'none', 'important');
    audioGroup.style.setProperty('max-width', 'none', 'important');

    if (reportButton) {
      reportButton.style.setProperty('grid-column', '1 / -1', 'important');
      reportButton.style.setProperty('justify-self', 'center', 'important');
    }
  };

  syncActionLayout();

  window.DownloadStarryResultLayout = Object.freeze({
    syncActionLayout,
    syncActionWidth: syncActionLayout,
  });
})();
