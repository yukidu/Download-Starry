'use strict';
(() => {
  if (window.DownloadStarryTopReportButton) return;
  const lookupButton = document.getElementById('lookup-button');
  const clearButton = document.getElementById('clear-url-button');
  if (!lookupButton || !clearButton?.parentElement) return;

  lookupButton.hidden = true;
  lookupButton.setAttribute('aria-hidden', 'true');
  lookupButton.tabIndex = -1;

  let reportButton = document.getElementById('top-report-button');
  if (!reportButton) {
    reportButton = document.createElement('button');
    reportButton.id = 'top-report-button';
    reportButton.type = 'button';
    reportButton.className = 'top-report-button';
    reportButton.textContent = '回報錯誤';
    reportButton.setAttribute('aria-label', '回報錯誤');
    clearButton.insertAdjacentElement('afterend', reportButton);
  }

  window.DownloadStarryTopReportButton = Object.freeze({button: reportButton});
})();
