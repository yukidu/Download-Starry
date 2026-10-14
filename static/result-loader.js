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
  const loadStyle = href => new Promise((resolve, reject) => {
    if (document.getElementById('downloadstarry-result-ui-style')) return resolve();
    const link = document.createElement('link');
    link.id = 'downloadstarry-result-ui-style';
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = resolve;
    link.onerror = () => reject(new Error(href));
    head.append(link);
  });
  const removeLegacyVisualLayers = () => {
    [
      'downloadstarry-resource-actions-style',
      'downloadstarry-result-polish-style',
      'downloadstarry-result-visual-tune-style',
    ].forEach(id => document.getElementById(id)?.remove());
  };

  window.DownloadStarryResultReady = loadStyle('/static/result-ui.css?v=20261015-7')
    .then(() => loadScript('/static/resource-actions.js?v=20261015-7'))
    .then(() => loadScript('/static/result-polish.js?v=20261015-7'))
    .then(() => loadScript('/static/result-layout.js?v=20261015-7'))
    .then(() => {
      removeLegacyVisualLayers();
      window.DownloadStarryResultLayout?.syncActionWidth?.();
      return true;
    })
    .catch(error => {
      console.error('Download Starry result UI failed', error);
      return false;
    });
})();
