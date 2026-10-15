'use strict';
(() => {
  if (window.DownloadStarryResultLayout) return;

  const progressPanel = document.getElementById('download-progress');
  const progressHome = progressPanel?.parentElement || null;
  const progressAnchor = progressPanel?.nextElementSibling || null;

  const restoreProgressPanel = () => {
    if (!progressPanel || !progressHome) return;
    if (progressAnchor?.parentElement === progressHome) progressHome.insertBefore(progressPanel, progressAnchor);
    else progressHome.prepend(progressPanel);
    progressPanel.classList.add('top-download-progress');
    progressPanel.classList.remove('result-download-progress');
    progressPanel.style.removeProperty('grid-column');
    progressPanel.style.removeProperty('width');
    progressPanel.style.removeProperty('justify-self');
    progressPanel.style.removeProperty('margin');
  };

  const syncActionLayout = () => {
    const actions = document.getElementById('video-download-actions');
    const grid = actions?.querySelector('.download-action-grid');
    const videoGroup = actions?.querySelector('.resource-action-group-video');
    const audioGroup = actions?.querySelector('.resource-action-group-audio');
    const advancedToggle = document.getElementById('report-download-button');
    const advancedPanel = document.getElementById('advanced-member-panel');
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

    if (!actions.hidden && progressPanel && advancedToggle) {
      grid.insertBefore(progressPanel, advancedToggle);
      progressPanel.classList.remove('top-download-progress');
      progressPanel.classList.add('result-download-progress');
      progressPanel.style.setProperty('grid-column', '1 / -1', 'important');
      progressPanel.style.setProperty('width', '100%', 'important');
      progressPanel.style.setProperty('justify-self', 'stretch', 'important');
      progressPanel.style.setProperty('margin', '0', 'important');
    } else if (actions.hidden) {
      restoreProgressPanel();
    }

    if (advancedToggle) {
      advancedToggle.style.setProperty('grid-column', '1 / -1', 'important');
      advancedToggle.style.setProperty('width', 'min(82%, 480px)', 'important');
      advancedToggle.style.setProperty('min-height', '46px', 'important');
      advancedToggle.style.setProperty('padding', '10px 16px', 'important');
      advancedToggle.style.setProperty('margin-top', '0', 'important');
      advancedToggle.style.setProperty('justify-self', 'center', 'important');
    }

    if (advancedPanel) {
      advancedPanel.style.setProperty('grid-column', '1 / -1', 'important');
      advancedPanel.style.setProperty('width', '100%', 'important');
      advancedPanel.style.setProperty('justify-self', 'stretch', 'important');
    }
  };

  syncActionLayout();

  const actions = document.getElementById('video-download-actions');
  if (actions && 'MutationObserver' in window) {
    new MutationObserver(syncActionLayout).observe(actions, {attributes: true, attributeFilter: ['hidden']});
  }

  window.DownloadStarryResultLayout = Object.freeze({
    syncActionLayout,
    syncActionWidth: syncActionLayout,
    restoreProgressPanel,
  });
})();
