'use strict';
(() => {
  if (window.DownloadStarryUiStability) return;

  const pasteButton = document.getElementById('paste-url-button');
  const lookupButton = document.getElementById('lookup-button');

  const pinPasteLabel = () => {
    if (!pasteButton) return;
    if (pasteButton.textContent !== '貼上網址') pasteButton.textContent = '貼上網址';
  };

  pinPasteLabel();
  if (pasteButton && 'MutationObserver' in window) {
    new MutationObserver(pinPasteLabel).observe(pasteButton, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  if (lookupButton) {
    lookupButton.hidden = true;
    lookupButton.setAttribute('aria-hidden', 'true');
    lookupButton.tabIndex = -1;
    lookupButton.style.setProperty('display', 'none', 'important');
  }

  const legacyAdvancedButton = document.getElementById('report-download-button');
  if (legacyAdvancedButton && legacyAdvancedButton.dataset.advancedListenerReset !== '1') {
    const cleanAdvancedButton = legacyAdvancedButton.cloneNode(true);
    cleanAdvancedButton.dataset.advancedListenerReset = '1';
    cleanAdvancedButton.className = 'download-button advanced-member-toggle';
    cleanAdvancedButton.type = 'button';
    cleanAdvancedButton.setAttribute('aria-expanded', 'false');
    cleanAdvancedButton.setAttribute('aria-controls', 'advanced-member-panel');
    cleanAdvancedButton.innerHTML = '進階功能｜會員限定 <span aria-hidden="true">⌄</span>';
    legacyAdvancedButton.replaceWith(cleanAdvancedButton);
  }

  window.DownloadStarryUiStability = Object.freeze({pinPasteLabel});
})();
