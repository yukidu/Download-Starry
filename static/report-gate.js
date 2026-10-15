'use strict';
(() => {
  if (window.DownloadStarryReportGate) return;

  const endpoint = path => window.SaveVideoAPI?.endpoint?.(path) || path;
  let modal;

  function installTopReportButton() {
    const lookupButton = document.getElementById('lookup-button');
    const clearButton = document.getElementById('clear-url-button');
    if (!lookupButton || !clearButton?.parentElement) return null;
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
    return reportButton;
  }

  async function isMember() {
    try {
      const response = await fetch(endpoint('/api/auth/starry/session'), {cache: 'no-store'});
      if (!response.ok) return false;
      const data = await response.json().catch(() => ({}));
      return Boolean(data?.authenticated && data?.user?.id);
    } catch (_) {
      return false;
    }
  }

  function ensureModal() {
    if (modal) return modal;
    const style = document.createElement('style');
    style.id = 'downloadstarry-report-gate-style';
    style.textContent = `
.drg-backdrop{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:20px;background:rgba(5,8,24,.58);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}.drg-backdrop[hidden]{display:none!important}.drg-card{width:min(100%,360px);padding:24px;border:1px solid color-mix(in srgb,var(--line) 75%,transparent);border-radius:22px;background:var(--panel-bg);color:var(--ink);box-shadow:0 24px 70px rgba(0,0,0,.30);text-align:center}.drg-card h2{margin:0 0 8px;font:900 21px/1.35 "Noto Sans TC",sans-serif}.drg-card p{margin:0;color:var(--muted);font-size:13px;line-height:1.7}.drg-actions{display:grid;gap:9px;margin-top:18px}.drg-primary,.drg-secondary{min-height:44px;border:0;border-radius:12px;padding:10px 14px;font:800 14px/1.3 "Noto Sans TC",sans-serif;cursor:pointer}.drg-primary{background:var(--accent);color:#fff}.drg-secondary{border:1px solid var(--line);background:var(--soft-bg);color:var(--ink)}
`;
    document.head.appendChild(style);

    modal = document.createElement('div');
    modal.className = 'drg-backdrop';
    modal.hidden = true;
    modal.innerHTML = `
      <section class="drg-card" role="dialog" aria-modal="true" aria-labelledby="drg-title">
        <h2 id="drg-title">只提供給註冊會員使用</h2>
        <p>登入 Starry ID 後即可回報無法下載，並可選擇修復完成後收到手機通知。</p>
        <div class="drg-actions">
          <button id="drg-register" class="drg-primary" type="button">按此免費註冊</button>
          <button id="drg-close" class="drg-secondary" type="button">稍後再說</button>
        </div>
      </section>`;
    document.body.appendChild(modal);
    modal.querySelector('#drg-register').addEventListener('click', () => {
      try { sessionStorage.setItem('downloadstarry.pending-report-after-login', '1'); } catch (_) {}
      location.assign('/api/auth/starry/login?choose=1');
    });
    modal.querySelector('#drg-close').addEventListener('click', () => { modal.hidden = true; });
    modal.addEventListener('click', event => { if (event.target === modal) modal.hidden = true; });
    return modal;
  }

  function openModal() {
    const box = ensureModal();
    box.hidden = false;
    box.querySelector('#drg-register')?.focus();
  }

  function currentResourceUrl() {
    return String(
      document.getElementById('download-url')?.value ||
      document.getElementById('url')?.value ||
      ''
    ).trim();
  }

  async function openReport(parsed) {
    if (!await isMember()) {
      openModal();
      return;
    }
    const resourceUrl = currentResourceUrl();
    if (parsed && resourceUrl) {
      try {
        sessionStorage.setItem('downloadstarry.report-draft.v2', JSON.stringify({
          source: 'parsed',
          url: resourceUrl,
          reportedAt: new Date().toISOString(),
        }));
      } catch (_) {}
      location.assign('/report?source=parsed');
      return;
    }
    location.assign('/report');
  }

  document.addEventListener('click', event => {
    const target = event.target.closest?.('#menu-report-button,#top-report-button');
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openReport(target.id === 'top-report-button');
  }, true);

  const topReportButton = installTopReportButton();
  window.DownloadStarryReportGate = Object.freeze({openModal, openReport, topReportButton});
})();
