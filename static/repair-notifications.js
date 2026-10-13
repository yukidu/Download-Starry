'use strict';
(() => {
  if (window.DownloadStarryRepairNotifications) return;

  const api = window.DownloadStarryMemberAPI;
  const memberPlatform = window.DownloadStarryMemberPlatform;
  const platform = window.SaveVideoPlatform;

  function supported() {
    return Boolean('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
  }

  function base64UrlToBytes(value) {
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, char => char.charCodeAt(0));
  }

  function ensureStyle() {
    if (document.querySelector('#downloadstarry-repair-notify-style')) return;
    const style = document.createElement('style');
    style.id = 'downloadstarry-repair-notify-style';
    style.textContent = `
.dsr-repair-notify{border:1px solid color-mix(in srgb,var(--accent) 42%,var(--line));background:color-mix(in srgb,var(--accent) 10%,var(--soft-bg));color:var(--ink)}.dsr-repair-notify.is-active{border-color:color-mix(in srgb,var(--accent) 70%,var(--line));background:color-mix(in srgb,var(--accent) 18%,var(--soft-bg));color:var(--accent)}.dsr-member-only{display:grid;gap:13px;justify-items:start}.dsr-member-only h2{margin:0;font-size:20px}.dsr-member-only p{margin:0;color:var(--muted);line-height:1.7}.dsr-install-backdrop{position:fixed;inset:0;z-index:10020;display:grid;place-items:center;padding:20px;background:rgba(5,8,24,.60);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}.dsr-install-backdrop[hidden]{display:none!important}.dsr-install-card{width:min(100%,390px);padding:22px;border:1px solid var(--line);border-radius:20px;background:var(--panel-bg);color:var(--ink);box-shadow:0 24px 70px rgba(0,0,0,.32)}.dsr-install-card h2{margin:0 0 8px;font-size:20px}.dsr-install-card p{margin:0;color:var(--muted);font-size:13px;line-height:1.7}.dsr-install-card .dsr-actions{margin-top:16px}@media(max-width:560px){.dsr-repair-notify{min-height:40px}}
`;
    document.head.appendChild(style);
  }

  function showInstallGuide() {
    let modal = document.querySelector('#dsr-install-guide');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'dsr-install-guide';
      modal.className = 'dsr-install-backdrop';
      modal.innerHTML = `
        <section class="dsr-install-card" role="dialog" aria-modal="true" aria-labelledby="dsr-install-title">
          <h2 id="dsr-install-title">先加入主畫面才能接收通知</h2>
          <p>iPhone／iPad 的 Web Push 規則要求先用 Safari 將「繁星下載」加入主畫面，再從主畫面的 App 開啟並允許通知。Apple 不允許網站自動或強制安裝，因此最後的「加入主畫面」必須由你本人確認。</p>
          <div class="dsr-actions"><button id="dsr-install-help" class="dsr-primary" type="button">查看安裝方式</button><button id="dsr-install-close" class="dsr-secondary" type="button">知道了</button></div>
        </section>`;
      document.body.appendChild(modal);
      modal.querySelector('#dsr-install-help').addEventListener('click', () => location.assign('/install'));
      modal.querySelector('#dsr-install-close').addEventListener('click', () => { modal.hidden = true; });
      modal.addEventListener('click', event => { if (event.target === modal) modal.hidden = true; });
    }
    modal.hidden = false;
  }

  async function ensureSubscription() {
    if (platform?.runtime?.isIOS && !platform.runtime.isStandalone) {
      showInstallGuide();
      throw new Error('iPhone／iPad 請先將繁星下載加入主畫面，再從主畫面的 App 開啟此功能。');
    }
    if (!supported()) throw new Error('目前瀏覽器不支援手機系統通知。');
    if (Notification.permission === 'denied') {
      throw new Error('通知權限已被封鎖，請到瀏覽器或系統通知設定重新允許。');
    }
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('你尚未允許系統通知。');
    }

    const settings = await api.repairConfig();
    if (!settings.configured || !settings.publicKey) {
      throw new Error('系統通知尚未完成伺服器設定。');
    }
    await platform?.pwa?.registerServiceWorker?.();
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(settings.publicKey),
      });
    }
    await api.repairSubscribe(subscription.toJSON());
    return subscription;
  }

  async function mount() {
    if (location.pathname !== '/report' || !api || !memberPlatform) return;
    ensureStyle();
    const body = document.querySelector('#dsr-body');
    if (!body) return;
    const data = await api.session().catch(() => null);
    const user = data?.authenticated ? data.user : null;

    if (!user) {
      body.innerHTML = `
        <section class="dsr-member-only">
          <h2>只提供給註冊會員使用</h2>
          <p>登入或免費註冊 Starry ID 後，即可回報無法下載。</p>
          <button id="dsr-member-register" class="dsr-primary" type="button">按此免費註冊</button>
        </section>`;
      body.querySelector('#dsr-member-register').addEventListener('click', () => memberPlatform.auth.login());
      return;
    }

    const form = body.querySelector('#dsr-form');
    const actions = form?.querySelector('.dsr-actions');
    const message = body.querySelector('#dsr-message');
    if (!form || !actions || !message || actions.querySelector('#dsr-repair-notify')) return;

    const notifyButton = document.createElement('button');
    notifyButton.id = 'dsr-repair-notify';
    notifyButton.className = 'dsr-secondary dsr-repair-notify';
    notifyButton.type = 'button';
    notifyButton.textContent = '修復後通知我';
    actions.appendChild(notifyButton);

    let notifyRequested = false;
    let enabling = false;

    const renderNotify = () => {
      notifyButton.classList.toggle('is-active', notifyRequested);
      notifyButton.textContent = notifyRequested ? '✓ 已設定修復後通知我' : '修復後通知我';
      notifyButton.setAttribute('aria-pressed', String(notifyRequested));
    };
    renderNotify();

    notifyButton.addEventListener('click', async () => {
      if (enabling) return;
      if (notifyRequested) {
        notifyRequested = false;
        renderNotify();
        message.textContent = '這筆回報將不主動通知修復結果。';
        return;
      }
      enabling = true;
      notifyButton.disabled = true;
      message.textContent = '正在啟用修復完成通知…';
      try {
        await ensureSubscription();
        notifyRequested = true;
        renderNotify();
        message.textContent = '已啟用。送出回報後，管理員標記「已解決」時會通知這支裝置。';
      } catch (error) {
        notifyRequested = false;
        renderNotify();
        message.textContent = error.message || '無法啟用修復通知。';
      } finally {
        enabling = false;
        notifyButton.disabled = false;
      }
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const submit = form.querySelector('.dsr-primary[type="submit"]');
      const url = body.querySelector('#dsr-url');
      const time = body.querySelector('#dsr-time');
      const note = body.querySelector('#dsr-note');
      const source = new URLSearchParams(location.search).get('source') === 'parsed' ? 'parsed' : 'manual';
      const reportUrl = url?.value.trim() || '';
      const reportedAt = time?.value.trim() || '';
      const reportNote = note?.value.trim() || '';
      if (!reportedAt) { message.textContent = '請填寫日期時間'; return; }
      if (source === 'parsed' && !reportUrl) { message.textContent = '目前沒有可回報的網址'; return; }
      if (submit) submit.disabled = true;
      notifyButton.disabled = true;
      message.textContent = '正在送出並通知管理員…';
      try {
        const result = await api.createReport({source, url: reportUrl, reportedAt, note: reportNote});
        if (notifyRequested) {
          try {
            await api.repairWatch(result.id);
            message.textContent = '已送出給管理員；修復完成後會通知這支裝置。';
          } catch (watchError) {
            message.textContent = `回報已送出，但修復通知沒有完成：${watchError.message || '請稍後再試'}`;
          }
        } else {
          message.textContent = '已送出給管理員，謝謝你的回報。';
        }
      } catch (error) {
        message.textContent = error.message || '回報失敗，請稍後再試';
      } finally {
        if (submit) submit.disabled = false;
        notifyButton.disabled = false;
      }
    }, true);
  }

  window.DownloadStarryRepairNotifications = Object.freeze({mount, ensureSubscription});
})();
