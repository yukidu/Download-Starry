'use strict';
(() => {
  if (window.DownloadStarryPermissionRecheckFix) return;

  const RETRY_KEY = 'downloadstarry_repair_permission_retry';
  const DRAFT_KEY = 'downloadstarry_repair_permission_draft';

  function saveDraft() {
    try {
      const draft = {
        url: document.querySelector('#dsr-url')?.value || '',
        time: document.querySelector('#dsr-time')?.value || '',
        note: document.querySelector('#dsr-note')?.value || ''
      };
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (_) {}
  }

  function restoreDraft() {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      sessionStorage.removeItem(DRAFT_KEY);
      const draft = JSON.parse(raw);
      const url = document.querySelector('#dsr-url');
      const time = document.querySelector('#dsr-time');
      const note = document.querySelector('#dsr-note');
      if (url && draft?.url) url.value = draft.url;
      if (time && draft?.time) time.value = draft.time;
      if (note && draft?.note) note.value = draft.note;
    } catch (_) {}
  }

  function scheduleFreshPermissionCheck() {
    let shouldRetry = false;
    try {
      shouldRetry = sessionStorage.getItem(RETRY_KEY) === '1';
      if (shouldRetry) sessionStorage.removeItem(RETRY_KEY);
    } catch (_) {}
    if (!shouldRetry) return;

    let completed = false;
    const tryRun = () => {
      if (completed) return true;
      const notifyButton = document.querySelector('#dsr-repair-notify');
      if (!notifyButton || notifyButton.disabled) return false;
      completed = true;
      restoreDraft();
      const message = document.querySelector('#dsr-message');
      if (message) message.textContent = '正在重新讀取手機通知權限…';
      window.setTimeout(() => notifyButton.click(), 180);
      return true;
    };

    if (tryRun()) return;
    const observer = new MutationObserver(() => {
      if (tryRun()) observer.disconnect();
    });
    observer.observe(document.documentElement, {childList: true, subtree: true});
    window.setTimeout(() => observer.disconnect(), 8000);
  }

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('#dsr-permission-retry');
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    saveDraft();
    try { sessionStorage.setItem(RETRY_KEY, '1'); } catch (_) {}

    button.disabled = true;
    button.textContent = '正在重新檢查…';
    const modal = document.querySelector('#dsr-permission-guide');
    if (modal) modal.hidden = true;

    window.setTimeout(() => location.reload(), 80);
  }, true);

  scheduleFreshPermissionCheck();
  window.DownloadStarryPermissionRecheckFix = Object.freeze({scheduleFreshPermissionCheck});
})();
