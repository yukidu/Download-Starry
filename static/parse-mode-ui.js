'use strict';
(() => {
  if (window.DownloadStarryParseModeUI) return;

  const urlInput = document.getElementById('url');
  const platformStrip = document.querySelector('.platform-icons');
  const result = document.getElementById('result');
  if (!urlInput || !platformStrip) return;

  const style = document.createElement('style');
  style.id = 'downloadstarry-parse-mode-style';
  style.textContent = `
.platform-icons.is-parsing-mode{
  display:grid!important;
  grid-template-columns:repeat(8,minmax(0,1fr))!important;
  grid-auto-rows:auto!important;
  width:min(520px,100%)!important;
  max-width:100%!important;
  margin:10px auto 0!important;
  gap:7px 8px!important;
  align-items:center!important;
  justify-items:center!important;
}
.platform-icons.is-parsing-mode .platform-icon{
  width:42px!important;
  height:42px!important;
  border-radius:13px!important;
  animation:none!important;
}
.platform-icons.is-parsing-mode .platform-icon svg,
.platform-icons.is-parsing-mode .platform-icon .provider-official-mark{
  width:23px!important;
  height:23px!important;
}
.platform-icons.is-parsing-mode .platform-icon.is-detected{
  transform:scale(1.05)!important;
}
@media(max-width:700px){
  .platform-icons.is-parsing-mode{
    width:100%!important;
    gap:6px 4px!important;
    margin-top:8px!important;
  }
  .platform-icons.is-parsing-mode .platform-icon{
    width:36px!important;
    height:36px!important;
    border-radius:11px!important;
  }
  .platform-icons.is-parsing-mode .platform-icon svg,
  .platform-icons.is-parsing-mode .platform-icon .provider-official-mark{
    width:20px!important;
    height:20px!important;
  }
}
@media(max-width:390px){
  .platform-icons.is-parsing-mode{gap:5px 3px!important}
  .platform-icons.is-parsing-mode .platform-icon{width:34px!important;height:34px!important}
  .platform-icons.is-parsing-mode .platform-icon svg,
  .platform-icons.is-parsing-mode .platform-icon .provider-official-mark{width:19px!important;height:19px!important}
}
`;
  document.head.appendChild(style);

  const sync = () => {
    const hasUrl = Boolean(String(urlInput.value || '').trim());
    const parsed = Boolean(result && !result.hidden);
    platformStrip.classList.toggle('is-parsing-mode', hasUrl || parsed || document.body.classList.contains('loading'));
  };

  urlInput.addEventListener('input', sync);
  urlInput.addEventListener('change', sync);
  urlInput.addEventListener('paste', () => requestAnimationFrame(sync));

  if ('MutationObserver' in window) {
    new MutationObserver(sync).observe(document.body, {attributes: true, attributeFilter: ['class']});
    if (result) new MutationObserver(sync).observe(result, {attributes: true, attributeFilter: ['hidden']});
    new MutationObserver(sync).observe(platformStrip, {childList: true});
  }

  requestAnimationFrame(sync);
  window.DownloadStarryParseModeUI = Object.freeze({sync});
})();
