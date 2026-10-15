'use strict';
(() => {
  if (window.DownloadStarryReportUI) return;
  const platform = window.DownloadStarryMemberPlatform;
  const api = window.DownloadStarryMemberAPI;
  if (!platform || !api) throw new Error('Download Starry member bootstrap missing');
  let sessionCache;
  let pageRoot;

  const h = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const safeHttp = value => { try { const u = new URL(String(value || '')); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch (_) { return ''; } };
  const reportTime = row => {
    const raw = Number(row?.createdAt || 0) || row?.reportedAt || '';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '';
    try {
      return new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      }).format(date);
    } catch (_) {
      return date.toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'});
    }
  };

  function ensurePage() {
    if (pageRoot) return pageRoot;
    const main = document.querySelector('main');
    if (!main) throw new Error('main page missing');
    Array.from(main.children).forEach(child => { child.hidden = true; });
    const style = document.createElement('style');
    style.id = 'downloadstarry-native-page-style';
    style.textContent = `
.dsr-native-page{display:block;width:min(100% - 28px,900px);margin:22px auto 64px;padding:0}.dsr-page-card{border:1px solid var(--line);border-radius:24px;background:var(--panel-bg);color:var(--ink);box-shadow:0 24px 70px rgba(15,23,42,.16);overflow:hidden}.dsr-page-head{padding:20px 22px 16px;border-bottom:1px solid var(--line)}.dsr-page-head h1{margin:0 0 6px;font:900 24px/1.3 "Noto Sans TC",sans-serif}.dsr-page-head p{margin:0;color:var(--muted);line-height:1.6}.dsr-body{padding:20px 22px}.dsr-member{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-bottom:18px}.dsr-chip{padding:10px 12px;border:1px solid var(--line);border-radius:13px;background:var(--soft-bg);min-width:0}.dsr-chip small{display:block;color:var(--muted);font-size:11px;margin-bottom:3px}.dsr-chip b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}.dsr-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.dsr-primary,.dsr-secondary,.dsr-status{border:0;border-radius:12px;padding:10px 14px;font:800 14px inherit;cursor:pointer}.dsr-primary{background:var(--accent);color:#fff}.dsr-secondary{background:var(--soft-bg);color:var(--ink);border:1px solid var(--line)}.dsr-message{min-height:20px;margin-bottom:10px;font-weight:800;font-size:13px;color:var(--accent)}.dsr-admin{margin:0;padding:0;border:0}.dsr-admin h2{margin:0 0 12px;font-size:18px}.dsr-report{display:grid;grid-template-columns:170px minmax(0,1fr);gap:15px;padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--card);margin-bottom:11px}.dsr-report-thumb{width:170px;aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:var(--soft-bg);display:grid;place-items:center;color:var(--muted);font-size:12px}.dsr-report-thumb img{display:block;width:100%;height:100%;object-fit:cover}.dsr-report-thumb img[hidden]{display:none}.dsr-report-main{min-width:0}.dsr-report-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.dsr-report-head b{min-width:0}.dsr-report-head time{color:var(--muted);font-size:12px;white-space:nowrap}.dsr-report-title{display:block;margin:7px 0 4px;color:var(--ink);font-weight:900;line-height:1.45;text-decoration:none;word-break:break-word}.dsr-report p{margin:5px 0;font-size:13px;line-height:1.55;word-break:break-word}.dsr-report small{color:var(--muted)}.dsr-status{padding:7px 9px;font-size:12px;background:var(--soft-bg);color:var(--ink);border:1px solid var(--line)}.dsr-login-panel{display:grid;gap:14px;justify-items:start}.dsr-login-panel p{margin:0;color:var(--muted);line-height:1.8}.dsr-account-note{color:var(--muted);line-height:1.7;margin:0 0 18px}.dsr-hidden{display:none!important}@media(max-width:620px){.dsr-native-page{width:min(100% - 18px,900px);margin-top:14px}.dsr-page-head,.dsr-body{padding:15px}.dsr-member{grid-template-columns:1fr}.dsr-report{grid-template-columns:112px minmax(0,1fr);gap:11px;padding:12px}.dsr-report-thumb{width:112px}.dsr-report-head{display:block}.dsr-report-head time{display:block;margin-top:3px;white-space:normal}.dsr-actions>*{flex:1 1 90px}}
`;
    document.head.appendChild(style);
    pageRoot = document.createElement('section');
    pageRoot.id = 'downloadstarry-page';
    pageRoot.className = 'dsr-native-page';
    pageRoot.setAttribute('aria-live', 'polite');
    main.appendChild(pageRoot);
    window.scrollTo({top: 0, behavior: 'auto'});
    return pageRoot;
  }

  function shell(title, subtitle) {
    const root = ensurePage();
    root.innerHTML = `<article class="dsr-page-card"><header class="dsr-page-head"><h1>${h(title)}</h1><p>${h(subtitle)}</p></header><div class="dsr-body" id="dsr-body"></div></article>`;
    document.title = `${title}｜繁星下載`;
    return root.querySelector('#dsr-body');
  }

  async function session(force = false) {
    if (!force && sessionCache !== undefined) return sessionCache;
    sessionCache = await api.session().catch(() => null);
    return sessionCache;
  }

  function memberHtml(user) {
    return [
      ['Starry ID', user.id], ['姓名', user.name], ['Email', user.email],
      ['獎銜', user.rank || '—'], ['體系／中心', user.center || '—'], ['居住地', user.residence || '—']
    ].map(([label,value]) => `<div class="dsr-chip"><small>${h(label)}</small><b>${h(value)}</b></div>`).join('');
  }

  const statusLabel = status => ({new:'待處理',in_progress:'處理中',resolved:'已解決'}[status] || status);
  const notifyLabel = value => ({sent:'已通知',not_configured:'未設定',failed:'失敗'}[value] || value || '—');

  async function renderAdmin(container, force = false) {
    let section = container.querySelector('.dsr-admin');
    if (!section) {
      section = document.createElement('section');
      section.className = 'dsr-admin';
      section.innerHTML = '<div class="dsr-admin-message dsr-message"></div><div class="dsr-admin-list">讀取中…</div>';
      container.appendChild(section);
    }
    const list = section.querySelector('.dsr-admin-list');
    const message = section.querySelector('.dsr-admin-message');
    if (!force && list.dataset.loaded === '1') return;
    list.textContent = '讀取中…';
    try {
      const data = await api.reports();
      const rows = data.reports || [];
      list.dataset.loaded = '1';
      list.innerHTML = rows.length ? rows.map(row => {
        const url = safeHttp(row.url);
        const thumb = safeHttp(row.thumbnail);
        const title = String(row.title || '').trim() || '回報的影片';
        return `<article class="dsr-report" data-id="${h(row.id)}"><div class="dsr-report-thumb">${thumb ? `<img src="${h(thumb)}" alt="${h(title)} 縮圖" loading="lazy" referrerpolicy="no-referrer"><span hidden>無縮圖</span>` : '<span>無縮圖</span>'}</div><div class="dsr-report-main"><div class="dsr-report-head"><b>${h(row.name || row.email || row.userId || '會員')} · ${h(statusLabel(row.status))}</b><time datetime="${h(row.reportedAt || '')}">${h(reportTime(row))}</time></div>${url ? `<a class="dsr-report-title" href="${h(url)}" target="_blank" rel="noopener noreferrer">${h(title)}</a>` : `<div class="dsr-report-title">${h(title)}</div>`}<p><strong>網址：</strong>${url ? `<a href="${h(url)}" target="_blank" rel="noopener noreferrer">${h(row.url)}</a>` : '（未填）'}</p><p><strong>會員：</strong>${h(row.email || row.userId || '—')} ${h(row.approvedRank || row.rank || '')} ${h(row.center || '')}</p>${row.note ? `<p><strong>備註：</strong>${h(row.note)}</p>` : ''}<p><strong>通知：</strong>Email ${h(notifyLabel(row.emailStatus))}／LINE ${h(notifyLabel(row.lineStatus))}</p><div class="dsr-actions"><button class="dsr-status" data-status="new" type="button">待處理</button><button class="dsr-status" data-status="in_progress" type="button">處理中</button><button class="dsr-status" data-status="resolved" type="button">已解決</button></div></div></article>`;
      }).join('') : '<div class="dsr-message">目前沒有回報。</div>';
      list.querySelectorAll('.dsr-report-thumb img').forEach(img => img.addEventListener('error', () => {
        img.hidden = true;
        const fallback = img.nextElementSibling;
        if (fallback) fallback.hidden = false;
      }, {once: true}));
      list.querySelectorAll('.dsr-status').forEach(button => button.addEventListener('click', async () => {
        const article = button.closest('.dsr-report');
        button.disabled = true;
        message.textContent = '更新中…';
        try {
          await api.updateReportStatus(article.dataset.id, button.dataset.status);
          message.textContent = '已更新';
          await renderAdmin(container, true);
        } catch (error) {
          message.textContent = error.message || '更新失敗';
        } finally {
          button.disabled = false;
        }
      }));
    } catch (error) {
      list.textContent = error.message || '無法讀取回報';
    }
  }

  async function renderReportAdmin() {
    const body = shell('回報錯誤管理', '超級管理員專用｜所有回報時間皆以台北時間顯示');
    const data = await session(true);
    const user = data?.authenticated ? data.user : null;
    if (!user?.isAdmin) {
      location.replace('/');
      return;
    }
    await renderAdmin(body, true);
  }

  async function renderAccount() {
    const params = new URLSearchParams(location.search);
    const state = params.get('starry');
    if (state) {
      params.delete('starry');
      const query = params.toString();
      history.replaceState(null, '', `/account${query ? `?${query}` : ''}`);
    }
    const body = shell('Starry ID 登入', '使用繁星生態系共用的 Starry ID；繁星下載不建立第二套會員資料。');
    const data = await session(true);
    const user = data?.authenticated ? data.user : null;
    if (!user) {
      body.innerHTML = `<div class="dsr-login-panel"><p>${state === 'error' ? '剛才登入沒有完成，請再試一次。' : '登入後可顯示你的 Starry ID 基本資料，並使用會員限定功能。'}</p><button id="dsr-login" class="dsr-primary" type="button">使用 Google 登入</button></div>`;
      body.querySelector('#dsr-login').addEventListener('click', () => platform.auth.login());
      return;
    }
    body.innerHTML = `<p class="dsr-account-note">${state === 'login' ? '登入成功。' : ''} 目前使用 Starry ID 中央會員資料。</p><div class="dsr-member">${memberHtml(user)}</div><div class="dsr-actions"><button id="dsr-logout" class="dsr-secondary" type="button">登出 Starry ID</button></div><div id="dsr-account-message" class="dsr-message"></div>`;
    body.querySelector('#dsr-logout').addEventListener('click', async () => {
      const message = body.querySelector('#dsr-account-message');
      message.textContent = '正在登出…';
      try { await api.logout(); sessionCache = undefined; location.reload(); }
      catch (error) { message.textContent = error.message || '登出失敗'; }
    });
  }

  async function mount() {
    if (location.pathname === '/report') return renderReportAdmin();
    return renderAccount();
  }

  window.DownloadStarryReportUI = Object.freeze({mount});
})();
