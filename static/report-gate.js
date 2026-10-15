'use strict';
(() => {
  if (window.DownloadStarryReportGate) return;

  const endpoint = path => window.SaveVideoAPI?.endpoint?.(path) || path;
  const SUPER_ADMIN_EMAIL = 'yukidu@gmail.com';
  let modal;
  let sessionPromise;
  let memberApiPromise;

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

  async function sessionUser({force = false} = {}) {
    if (force || !sessionPromise) {
      sessionPromise = (async () => {
        try {
          const response = await fetch(endpoint('/api/auth/starry/session'), {cache: 'no-store'});
          if (!response.ok) return null;
          const data = await response.json().catch(() => ({}));
          return data?.authenticated ? data.user : null;
        } catch (_) {
          return null;
        }
      })();
    }
    return sessionPromise;
  }

  const isSuperAdmin = user => String(user?.email || '').trim().toLowerCase() === SUPER_ADMIN_EMAIL;

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
        <p>登入 Starry ID 後即可一鍵回報目前無法下載的影片。</p>
        <div class="drg-actions">
          <button id="drg-register" class="drg-primary" type="button">按此免費註冊</button>
          <button id="drg-close" class="drg-secondary" type="button">稍後再說</button>
        </div>
      </section>`;
    document.body.appendChild(modal);
    modal.querySelector('#drg-register').addEventListener('click', () => {
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
    const result = document.getElementById('result');
    const parsed = String(document.getElementById('download-url')?.value || '').trim();
    const visible = String(document.getElementById('url')?.value || '').trim();
    if (result && !result.hidden && parsed) return parsed;
    return visible || parsed;
  }

  function feedback(message) {
    const node = document.getElementById('message');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
  }

  function resetReportButton(button = document.getElementById('top-report-button')) {
    if (!button) return;
    const current = currentResourceUrl();
    if (button.dataset.reportedUrl && button.dataset.reportedUrl === current) return;
    button.disabled = false;
    button.textContent = '回報錯誤';
    button.setAttribute('aria-label', '回報錯誤');
    button.removeAttribute('data-reported-url');
    button.classList.remove('is-reported');
  }

  function loadMemberApi() {
    if (window.DownloadStarryMemberAPI?.createReport) return Promise.resolve(window.DownloadStarryMemberAPI);
    if (!memberApiPromise) {
      memberApiPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-downloadstarry-member-api]');
        const script = existing || document.createElement('script');
        const finish = () => window.DownloadStarryMemberAPI?.createReport
          ? resolve(window.DownloadStarryMemberAPI)
          : reject(new Error('回報功能載入未完成'));
        if (existing) {
          existing.addEventListener('load', finish, {once: true});
          existing.addEventListener('error', () => reject(new Error('回報功能載入失敗')), {once: true});
          setTimeout(finish, 0);
        } else {
          script.src = '/static/member-api.js';
          script.dataset.downloadstarryMemberApi = '1';
          script.addEventListener('load', finish, {once: true});
          script.addEventListener('error', () => reject(new Error('回報功能載入失敗')), {once: true});
          document.head.appendChild(script);
        }
      }).catch(error => {
        memberApiPromise = null;
        throw error;
      });
    }
    return memberApiPromise;
  }

  async function reportCurrent(button = document.getElementById('top-report-button')) {
    if (!button || button.disabled) return false;
    const user = await sessionUser();
    if (!user) {
      openModal();
      return false;
    }
    const resourceUrl = currentResourceUrl();
    if (!resourceUrl) {
      feedback('目前沒有可回報的網址');
      return false;
    }
    if (button.dataset.reportedUrl === resourceUrl) return true;

    button.disabled = true;
    button.textContent = '回報中…';
    button.setAttribute('aria-label', '回報中');
    try {
      const api = await loadMemberApi();
      await api.createReport({
        source: 'parsed',
        url: resourceUrl,
        reportedAt: new Date().toISOString(),
        note: '',
      });
      button.dataset.reportedUrl = resourceUrl;
      button.textContent = '已回報';
      button.setAttribute('aria-label', '已回報');
      button.classList.add('is-reported');
      feedback('已回報給管理員');
      return true;
    } catch (error) {
      button.disabled = false;
      button.textContent = '回報錯誤';
      button.setAttribute('aria-label', '回報錯誤');
      feedback(error.message || '回報失敗，請稍後再試');
      return false;
    }
  }

  async function openAdminReport() {
    const user = await sessionUser();
    if (!isSuperAdmin(user)) return false;
    location.assign('/report');
    return true;
  }

  async function syncSuperAdminAccess() {
    const menuReport = document.getElementById('menu-report-button');
    if (menuReport) {
      menuReport.hidden = true;
      menuReport.setAttribute('aria-hidden', 'true');
    }
    const reportMain = location.pathname === '/report' ? document.querySelector('main') : null;
    if (reportMain) reportMain.style.visibility = 'hidden';

    const user = await sessionUser();
    const allowed = isSuperAdmin(user);
    if (menuReport && allowed) {
      menuReport.hidden = false;
      menuReport.removeAttribute('aria-hidden');
    }
    if (location.pathname === '/report') {
      if (!allowed) {
        location.replace('/');
        return false;
      }
      if (reportMain) reportMain.style.visibility = '';
    }
    return allowed;
  }

  document.addEventListener('click', event => {
    const target = event.target.closest?.('#menu-report-button,#top-report-button');
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (target.id === 'top-report-button') {
      void reportCurrent(target);
      return;
    }
    void openAdminReport();
  }, true);

  const topReportButton = installTopReportButton();
  const visibleUrl = document.getElementById('url');
  visibleUrl?.addEventListener('input', () => resetReportButton(topReportButton));
  const result = document.getElementById('result');
  if (result) {
    new MutationObserver(() => {
      if (result.hidden) resetReportButton(topReportButton);
    }).observe(result, {attributes: true, attributeFilter: ['hidden']});
  }
  void syncSuperAdminAccess();

  window.DownloadStarryReportGate = Object.freeze({
    openModal,
    openAdminReport,
    reportCurrent,
    resetReportButton,
    syncSuperAdminAccess,
    topReportButton,
  });
})();
