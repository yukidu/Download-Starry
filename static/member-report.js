'use strict';
(() => {
  if (window.DownloadStarryReportUI) return;
  const platform = window.SaveVideoPlatform;
  const api = window.SaveVideoAPI;
  const PENDING_KEY = 'downloadstarry.pending-report.v1';
  let sessionCache;
  let dialog;

  const h = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const localDateTime = date => {
    const d = date || new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 16);
  };

  function ensureUi() {
    if (dialog) return dialog;
    const style = document.createElement('style');
    style.textContent = `
#downloadstarry-report{width:min(94vw,720px);max-height:88vh;border:1px solid var(--line);border-radius:24px;padding:0;background:var(--panel-bg);color:var(--ink);box-shadow:0 28px 90px rgba(15,23,42,.28)}
#downloadstarry-report::backdrop{background:rgba(5,10,25,.58);backdrop-filter:blur(4px)}
.dsr-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid var(--line);background:var(--panel-bg)}
.dsr-head strong{font:900 20px/1.2 "Noto Sans TC",sans-serif}.dsr-close{border:0;background:var(--soft-bg);color:var(--ink);width:38px;height:38px;border-radius:12px;font-size:22px;cursor:pointer}.dsr-body{padding:20px;overflow:auto}.dsr-member{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-bottom:18px}.dsr-chip{padding:10px 12px;border:1px solid var(--line);border-radius:13px;background:var(--soft-bg);min-width:0}.dsr-chip small{display:block;color:var(--muted);font-size:11px;margin-bottom:3px}.dsr-chip b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}.dsr-form{display:grid;gap:13px}.dsr-form label{display:grid;gap:6px;padding:0;align-items:stretch;justify-content:stretch}.dsr-form label>span{font-size:13px;font-weight:800}.dsr-form input,.dsr-form textarea{width:100%;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);font:500 14px/1.55 inherit;padding:11px 12px;outline:none}.dsr-form textarea{min-height:110px;resize:vertical}.dsr-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:4px}.dsr-primary,.dsr-secondary,.dsr-status{border:0;border-radius:12px;padding:11px 15px;font:800 14px inherit;cursor:pointer}.dsr-primary{background:var(--accent);color:#fff}.dsr-secondary{background:var(--soft-bg);color:var(--ink);border:1px solid var(--line)}.dsr-message{min-height:22px;margin-top:9px;font-weight:800;font-size:13px;color:var(--accent)}.dsr-admin{margin-top:24px;padding-top:20px;border-top:1px solid var(--line)}.dsr-admin h3{margin:0 0 12px;font-size:17px}.dsr-report{padding:14px;border:1px solid var(--line);border-radius:15px;background:var(--card);margin-bottom:10px}.dsr-report-head{display:flex;justify-content:space-between;gap:10px;align-items:start}.dsr-report p{margin:7px 0;font-size:13px;line-height:1.6;word-break:break-word}.dsr-report small{color:var(--muted)}.dsr-status{padding:7px 9px;font-size:12px;background:var(--soft-bg);color:var(--ink);border:1px solid var(--line)}.dsr-account-note{color:var(--muted);line-height:1.7;margin:4px 0 18px}.dsr-hidden{display:none!important}@media(max-width:560px){#downloadstarry-report{width:96vw}.dsr-body{padding:16px}.dsr-member{grid-template-columns:1fr}.dsr-actions>*{flex:1 1 120px}}
`;
    document.head.appendChild(style);
    dialog = document.createElement('dialog');
    dialog.id = 'downloadstarry-report';
    dialog.innerHTML = `<div class="dsr-head"><strong id="dsr-title">回報無法下載</strong><button class="dsr-close" type="button" aria-label="關閉">×</button></div><div class="dsr-body"><div id="dsr-member" class="dsr-member"></div><p id="dsr-account-note" class="dsr-account-note dsr-hidden">你現在使用 Starry ID 中央會員登入。繁星下載不建立第二套會員資料。</p><form id="dsr-form" class="dsr-form"><label><span>無法下載的網址</span><input id="dsr-url" type="url" placeholder="https://…"></label><label><span>日期時間</span><input id="dsr-time" type="datetime-local"></label><label><span>備註</span><textarea id="dsr-note" maxlength="2000" placeholder="可以補充發生狀況、平台或錯誤訊息…"></textarea></label><div class="dsr-actions"><button class="dsr-primary" type="submit">送出給管理員</button><button id="dsr-logout" class="dsr-secondary" type="button">登出 Starry ID</button></div><div id="dsr-message" class="dsr-message" aria-live="polite"></div></form><section id="dsr-admin" class="dsr-admin dsr-hidden"><h3>管理員｜無法下載回報</h3><div id="dsr-admin-list">讀取中…</div></section></div>`;
    document.body.appendChild(dialog);
    dialog.querySelector('.dsr-close').onclick = () => dialog.close?.() || dialog.removeAttribute('open');
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close?.(); });
    dialog.querySelector('#dsr-logout').onclick = async () => {
      await api.memberLogout();
      sessionCache = null;
      dialog.close?.();
      location.reload();
    };
    dialog.querySelector('#dsr-form').addEventListener('submit', submitReport);
    return dialog;
  }

  function showDialog() {
    ensureUi();
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else dialog.setAttribute('open', '');
  }

  async function session() {
    if (sessionCache !== undefined) return sessionCache;
    sessionCache = await api.memberSession().catch(() => null);
    return sessionCache;
  }

  function savePending(value) {
    platform.storage.session.set(PENDING_KEY, JSON.stringify(value));
  }

  function loginFor(value) {
    savePending(value);
    platform.auth.login();
  }

  function memberHtml(user) {
    return [
      ['Starry ID', user.id], ['姓名', user.name], ['Email', user.email],
      ['獎銜', user.rank || '—'], ['體系／中心', user.center || '—'], ['居住地', user.residence || '—']
    ].map(([label,value]) => `<div class="dsr-chip"><small>${h(label)}</small><b>${h(value)}</b></div>`).join('');
  }

  async function prepareMember(intent) {
    const data = await session();
    if (!data?.authenticated || !data.user) {
      loginFor(intent);
      return null;
    }
    ensureUi();
    dialog.querySelector('#dsr-member').innerHTML = memberHtml(data.user);
    dialog.querySelector('#dsr-logout').classList.remove('dsr-hidden');
    return data.user;
  }

  async function open(options = {}) {
    const intent = {
      mode: 'report',
      source: options.source === 'parsed' ? 'parsed' : 'manual',
      url: String(options.url || ''),
      reportedAt: String(options.reportedAt || '')
    };
    const user = await prepareMember(intent);
    if (!user) return;
    ensureUi();
    dialog.querySelector('#dsr-title').textContent = '回報無法下載';
    dialog.querySelector('#dsr-account-note').classList.add('dsr-hidden');
    dialog.querySelector('#dsr-form').classList.remove('dsr-hidden');
    const url = dialog.querySelector('#dsr-url');
    const time = dialog.querySelector('#dsr-time');
    const note = dialog.querySelector('#dsr-note');
    const parsed = intent.source === 'parsed';
    url.value = intent.url;
    time.value = parsed ? (intent.reportedAt || localDateTime()) : '';
    note.value = '';
    url.readOnly = parsed;
    time.readOnly = parsed;
    dialog.dataset.source = intent.source;
    dialog.querySelector('#dsr-message').textContent = parsed ? '已自動帶入目前網址、日期時間與 Starry ID 會員資料。' : '請手動填寫網址、日期時間與備註。';
    await renderAdmin(user);
    showDialog();
  }

  async function account() {
    const user = await prepareMember({mode: 'account'});
    if (!user) return;
    ensureUi();
    dialog.querySelector('#dsr-title').textContent = 'Starry ID 會員';
    dialog.querySelector('#dsr-account-note').classList.remove('dsr-hidden');
    dialog.querySelector('#dsr-form').classList.add('dsr-hidden');
    await renderAdmin(user);
    showDialog();
  }

  async function submitReport(event) {
    event.preventDefault();
    const message = dialog.querySelector('#dsr-message');
    const url = dialog.querySelector('#dsr-url').value.trim();
    const reportedAt = dialog.querySelector('#dsr-time').value.trim();
    const note = dialog.querySelector('#dsr-note').value.trim();
    if (!reportedAt) { message.textContent = '請填寫日期時間'; return; }
    if (dialog.dataset.source === 'parsed' && !url) { message.textContent = '目前沒有可回報的網址'; return; }
    const submit = dialog.querySelector('.dsr-primary');
    submit.disabled = true;
    message.textContent = '正在送出…';
    try {
      await api.createReport({source: dialog.dataset.source || 'manual', url, reportedAt, note});
      message.textContent = '已送出給管理員，謝謝你的回報。';
      if (sessionCache?.user?.isAdmin) await renderAdmin(sessionCache.user, true);
    } catch (error) {
      message.textContent = error.message || '回報失敗，請稍後再試';
    } finally { submit.disabled = false; }
  }

  const statusLabel = status => ({new:'待處理',in_progress:'處理中',resolved:'已解決'}[status] || status);

  async function renderAdmin(user, force = false) {
    ensureUi();
    const section = dialog.querySelector('#dsr-admin');
    if (!user?.isAdmin) { section.classList.add('dsr-hidden'); return; }
    section.classList.remove('dsr-hidden');
    const list = dialog.querySelector('#dsr-admin-list');
    if (!force && list.dataset.loaded === '1') return;
    list.textContent = '讀取中…';
    try {
      const data = await api.reports();
      const rows = data.reports || [];
      list.dataset.loaded = '1';
      list.innerHTML = rows.length ? rows.map(row => `<article class="dsr-report" data-id="${h(row.id)}"><div class="dsr-report-head"><b>${h(row.name || row.email || row.userId)} · ${h(statusLabel(row.status))}</b><small>${h(row.reportedAt || '')}</small></div><p><strong>網址：</strong>${row.url ? `<a href="${h(row.url)}" target="_blank" rel="noopener noreferrer">${h(row.url)}</a>` : '（未填）'}</p><p><strong>會員：</strong>${h(row.email || '')} ${h(row.approvedRank || row.rank || '')} ${h(row.center || '')}</p><p><strong>備註：</strong>${h(row.note || '（無）')}</p><div class="dsr-actions"><button class="dsr-status" data-status="new" type="button">待處理</button><button class="dsr-status" data-status="in_progress" type="button">處理中</button><button class="dsr-status" data-status="resolved" type="button">已解決</button></div></article>`).join('') : '目前沒有回報。';
      list.querySelectorAll('.dsr-status').forEach(button => button.addEventListener('click', async () => {
        const article = button.closest('.dsr-report');
        button.disabled = true;
        try { await api.updateReportStatus(article.dataset.id, button.dataset.status); await renderAdmin(user, true); }
        catch (error) { alert(error.message || '更新失敗'); }
        finally { button.disabled = false; }
      }));
    } catch (error) {
      list.textContent = error.message || '無法讀取回報';
    }
  }

  async function resume() {
    const params = new URLSearchParams(location.search);
    const state = params.get('starry');
    if (!state) return;
    params.delete('starry');
    const query = params.toString();
    history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
    if (state !== 'login') { alert('Starry ID 登入沒有完成，請再試一次。'); return; }
    let pending = null;
    try { pending = JSON.parse(platform.storage.session.get(PENDING_KEY) || 'null'); } catch (_) {}
    platform.storage.session.remove(PENDING_KEY);
    sessionCache = undefined;
    if (pending?.mode === 'report') await open(pending);
    else await account();
  }

  window.DownloadStarryReportUI = Object.freeze({open, account, resume});
})();
