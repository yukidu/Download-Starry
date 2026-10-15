'use strict';
(() => {
  if (window.DownloadStarryResultReady) return;

  const head = document.head;
  const loadScript = src => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(src));
    head.append(script);
  });
  const loadStyle = (href, id) => new Promise((resolve, reject) => {
    if (document.getElementById(id)) return resolve();
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = resolve;
    link.onerror = () => reject(new Error(href));
    head.append(link);
  });
  const removeLegacyVisualLayers = () => {
    [
      'downloadstarry-resource-actions-style',
      'downloadstarry-result-visual-tune-style',
    ].forEach(id => document.getElementById(id)?.remove());

    const polishStyle = document.getElementById('downloadstarry-result-polish-style');
    if (polishStyle) {
      polishStyle.textContent = '';
      polishStyle.dataset.neutralized = '1';
    }
  };

  window.DownloadStarryResultReady = Promise.all([
    loadStyle('/static/result-ui.css?v=20261015-11', 'downloadstarry-result-ui-style'),
    loadStyle('/static/advanced-member.css?v=20261015-1', 'downloadstarry-advanced-member-style'),
  ])
    .then(() => loadScript('/static/resource-actions.js?v=20261015-11'))
    .then(() => loadScript('/static/result-polish.js?v=20261015-11'))
    .then(() => loadScript('/static/result-layout.js?v=20261015-11'))
    .then(() => loadScript('/static/share-one-tap.js?v=20261015-4'))
    .then(() => loadScript('/static/advanced-member.js?v=20261015-1'))
    .then(() => {
      removeLegacyVisualLayers();
      window.DownloadStarryAdvancedMember?.ensurePlacement?.();
      window.DownloadStarryResultLayout?.syncActionWidth?.();
      return true;
    })
    .catch(error => {
      console.error('Download Starry result UI failed', error);
      return false;
    });
})();
