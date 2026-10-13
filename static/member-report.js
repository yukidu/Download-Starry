'use strict';
(() => {
  if (window.DownloadStarryReportUI) return;
  const platform = window.DownloadStarryMemberPlatform;
  const api = window.DownloadStarryMemberAPI;
  if (!platform || !api) throw new Error('Download Starry member bootstrap missing');
  const DRAFT_KEY = 'downloadstarry.report-draft.v2';
  let sessionCache;
  let pageRoot;

  const h = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char]));
  const localDateTime = value => {
    const d = value ? new Date(value) : new Date();
    if (Number.isNaN(d.getTime())) return '';
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 16);
  };

  function ensurePage() {
    if (pageRoot) return pageRoot;
    const main = document.querySelector('main');
    if (!main) throw new Error('main page missing');
    Array.from(main.children).forEach(child => { child.hidden = true; });
    const style = document.createElement('style');
    style.id = 'downloadstarry-native-page-style';
    style.textContent = `
.dsr-native-page{display:block;width:min(100% - 28px,820px);margin:28px auto 64px;padding:0}.dsr-page-card{border:1px solid var(--line);border-radius:24px;background:var(--panel-bg);color:var(--ink);box-shadow:0 24px 70px rgba(15,23,42,.16);overflow:hidden}.dsr-page-head{padding:22px 22px 18px;border-bottom:1px solid var(--line)}.dsr-page-head h1{margin:0 0 8px;font:900 24px/1.3 "Noto Sans TC",sans-serif}.dsr-page-head p{margin:0;color:var(--muted);line-height:1.7}.dsr-body{padding:22px}.dsr-member{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-bottom:18px}.dsr-chip{padding:10px 12px;border:1px solid var(--line);border-radius:13px;background:var(--soft-bg);min-width:0}.dsr-chip small{display:block;color:var(--muted);font-size:11px;margin-bottom:3px}.dsr-chip b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}.dsr-form{display:grid;gap:13px}.dsr-form label{display:grid;gap:6px}.dsr-form label>span{font-size:13px;font-weight:800}.dsr-form input,.dsr-form textarea{width:100%;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);font:500 14px/1.55 inherit;padding:11px 12px;outline:none}.dsr-form textarea{min-height:120px;resize:vertical}.dsr-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:4px}.dsr-primary,.dsr-secondary,.dsr-status{border:0;border-radius:12px;padding:11px 15px;font:800 14px inherit;cursor:pointer}.dsr-primary{background:var(--accent);color:#fff}.dsr-secondary{background:var(--soft-bg);color:var(--ink);border:1px solid var(--line)}.dsr-message{min-height:22px;margin-top:9px;font-weight:800;font-size:13px;color:var(--accent)}.dsr-admin{margin-top:24px;padding-top:20px;border-top:1px solid var(--line)}.dsr-admin h2{margin:0 0 12px;font-size:18px}.dsr-report{padding:14px;border:1px solid var(--line);border-radius:15px;background:var(--card);margin-bottom:10px}.dsr-report-head{display:flex;justify-content:space-between;gap:10px;align-items:start}.dsr-report p{margin:7px 0;font-size:13px;line-height:1.6;word-break:break-word}.dsr-report small{color:var(--muted)}.dsr-status{padding:7px 9px;font-size:12px;background:var(--soft-bg);color:var(--ink);border:1px solid var(--line)}.dsr-login-panel{display:grid;gap:14px;justify-items:start}.dsr-login-panel p{margin:0;color:var(--muted);line-height:1.8}.dsr-account-note{color:var(--muted);line-height:1.7;margin:0 0 18px}.dsr-hidden{display:none!important}@media(max-width:560px){.dsr-native-page{width:min(100% - 18px,820px);margin-top:16px}.dsr-page-head,.dsr-body{padding:16px}.dsr-member{grid-template-columns:1fr}.dsr-actions>*{flex:1 1 120px}}
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

  function visitorHtml() {
    return '<div class="dsr-chip"><small>回報身分</small><b>訪客（不需登入）</b></div><div class="dsr-chip"><small>會員資料</small><b>未附加</b></div>';
  }

  const statusLabel = status => ({new:'待處理',in_progress:'處理中',resolved:'已解決'}[status] || status);
  const notifyLabel = value => ({sent:'已通知',not_configured:'未設定',failed:'失敗'}[value] || value || '—');

  async function renderAdmin(container, user, force = false) {
    if (!user?.isAdmin) return;
    let section = container.querySelector('.dsr-admin');
    if (!section) {
      section = document.createElement('section');
      section.className = 'dsr-admin';
      section.innerHTML = '<h2>管理員｜無法下載回報</h2><div class="dsr-admin-message"></div><div class="dsr-admin-list">讀取中…</div>';
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
      list.innerHTML = rows.length ? rows.map(row => `<article class="dsr-report" data-id="${h(row.id)}"><div class="dsr-report-head"><b>${h(row.name || row.email || row.userId || '訪客')} · ${h(statusLabel(row.status))}</b><small>${h(row.reportedAt || '')}</small></div><p><strong>網址：</strong>${row.url ? `<a href="${h(row.url)}" target="_blank" rel="noopener noreferrer">${h(row.url)}</a>` : '（未填）'}</p><p><strong>身分：</strong>${row.userId ? `${h(row.email || row.userId)} ${h(row.approvedRank || row.rank || '')} ${h(row.center || '')}` : '訪客（未登入）'}</p><p><strong>備註：</strong>${h(row.note || '（無）')}</p><p><strong>通知：</strong>Email ${h(notifyLabel(row.emailStatus))}／LINE ${h(notifyLabel(row.lineStatus))}</p><div class="dsr-actions"><button class="dsr-status" data-status="new" type="button">待處理</button><button class="dsr-status" data-status="in_progress" type="button">處理中</button><button class="dsr-status" data-status="resolved" type="button">已解決</button></div></article>`).join('') : '目前沒有回報。';
      list.querySelectorAll('.dsr-status').forEach(button => button.addEventListener('click', async () => {
        const article = button.closest('.dsr-report');
        button.disabled = true;
        message.textContent = '更新中…';
        try { await api.updateReportStatus(article.dataset.id, button.dataset.status); message.textContent = '已更新'; await renderAdmin(container, user, true); }
        catch (error) { message.textContent = error.message || '更新失敗'; }
        finally { button.disabled = false; }
      }));
    } catch (error) {
      list.textContent = error.message || '無法讀取回報';
    }
  }

  async function renderReport() {
    const body = shell('回報無法下載', '不需要登入會員也可以直接送出；若已登入 Starry ID，會自動附上會員資料。');
    const data = await session();
    const user = data?.authenticated ? data.user : null;
    const params = new URLSearchParams(location.search);
    const parsed = params.get('source') === 'parsed';
    let draft = null;
    if (parsed) {
      try { draft = JSON.parse(platform.session.get(DRAFT_KEY) || 'null'); } catch (_) {}
      platform.session.remove(DRAFT_KEY);
    }
    const source = parsed ? 'parsed' : 'manual';
    const valueUrl = parsed ? String(draft?.url || '') : '';
    const valueTime = parsed ? localDateTime(draft?.reportedAt || new Date()) : '';
    body.innerHTML = `<div class="dsr-member">${user ? memberHtml(user) : visitorHtml()}</div><form id="dsr-form" class="dsr-form"><label><span>無法下載的網址</span><input id="dsr-url" type="url" placeholder="https://…" ${parsed ? 'readonly' : ''}></label><label><span>日期時間</span><input id="dsr-time" type="datetime-local" ${parsed ? 'readonly' : ''}></label><label><span>備註</span><textarea id="dsr-note" maxlength="2000" placeholder="可以補充發生狀況、平台或錯誤訊息…"></textarea></label><div class="dsr-actions"><button class="dsr-primary" type="submit">送出給管理員</button></div><div id="dsr-message" class="dsr-message">${parsed ? `已自動帶入目前網址與日期時間${user ? '，並附上 Starry ID 會員資料。' : '；目前以訪客身分回報。'}` : `請手動填寫網址、日期時間與備註${user ? '。' : '；不需登入即可送出。'}`}</div></form>`;
    const url = body.querySelector('#dsr-url'), time = body.querySelector('#dsr-time'), form = body.querySelector('#dsr-form'), message = body.querySelector('#dsr-message');
    url.value = valueUrl;
    time.value = valueTime;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const submit = form.querySelector('.dsr-primary');
      const reportUrl = url.value.trim(), reportedAt = time.value.trim(), note = body.querySelector('#dsr-note').value.trim();
      if (!reportedAt) { message.textContent = '請填寫日期時間'; return; }
      if (source === 'parsed' && !reportUrl) { message.textContent = '目前沒有可回報的網址'; return; }
      submit.disabled = true;
      message.textContent = '正在送出並通知管理員…';
      try { await api.createReport({source, url: reportUrl, reportedAt, note}); message.textContent = '已送出給管理員，謝謝你的回報。'; if (user?.isAdmin) await renderAdmin(body, user, true); }
      catch (error) { message.textContent = error.message || '回報失敗，請稍後再試'; }
      finally { submit.disabled = false; }
    });
    await renderAdmin(body, user);
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
      body.innerHTML = `<div class="dsr-login-panel"><p>${state === 'error' ? '剛才登入沒有完成，請再試一次。' : '登入後可顯示你的 Starry ID 基本資料；下載與回報錯誤仍可在未登入狀態使用。'}</p><button id="dsr-login" class="dsr-primary" type="button">使用 Google 登入</button></div>`;
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
    await renderAdmin(body, user);
  }

  async function mount() {
    if (location.pathname === '/report') return renderReport();
    return renderAccount();
  }

  window.DownloadStarryReportUI = Object.freeze({mount});
})();
