'use strict';
(() => {
  if (window.DownloadStarryPushUI) return;

  const memberApi = window.DownloadStarryMemberAPI;
  const platform = window.SaveVideoPlatform;
  const endpoint = path => window.SaveVideoAPI?.endpoint?.(path) || path;

  function supported() {
    return Boolean('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
  }

  function base64UrlToBytes(value) {
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, char => char.charCodeAt(0));
  }

  async function readJson(response, fallback) {
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data.error || fallback);
    return data;
  }

  async function config() {
    return readJson(await fetch(endpoint('/api/push/config'), {cache: 'no-store'}), '無法讀取通知設定');
  }

  async function saveSubscription(subscription) {
    return readJson(await fetch(endpoint('/api/push/subscribe'), {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(subscription.toJSON()),
    }), '無法儲存通知訂閱');
  }

  async function revokeSubscription(subscription) {
    return readJson(await fetch(endpoint('/api/push/unsubscribe'), {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({endpoint: subscription?.endpoint || ''}),
    }), '無法停用通知訂閱');
  }

  async function sendTest() {
    return readJson(await fetch(endpoint('/api/push/test'), {method: 'POST'}), '測試通知沒有送出');
  }

  async function syncAdminSubscription(settings = null) {
    if (!supported() || Notification.permission !== 'granted') return {settings, subscription: null, synced: false};
    if (platform?.runtime?.isIOS && !platform.runtime.isStandalone) return {settings, subscription: null, synced: false};
    const resolved = settings || await config();
    if (!resolved?.configured || !resolved.publicKey) return {settings: resolved, subscription: null, synced: false};
    await platform?.pwa?.registerServiceWorker?.();
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(resolved.publicKey),
      });
    }
    await saveSubscription(subscription);
    return {settings: resolved, subscription, synced: true};
  }

  function ensureStyle() {
    if (document.querySelector('#downloadstarry-push-style')) return;
    const style = document.createElement('style');
    style.id = 'downloadstarry-push-style';
    style.textContent = `
.dsp-card{margin-top:22px;padding-top:20px;border-top:1px solid var(--line)}.dsp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.dsp-head h2{margin:0 0 7px;font-size:18px}.dsp-head p{margin:0;color:var(--muted);font-size:13px;line-height:1.7}.dsp-badge{flex:0 0 auto;padding:6px 9px;border-radius:999px;background:var(--soft-bg);border:1px solid var(--line);font-size:12px;font-weight:800}.dsp-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:14px}.dsp-actions button{border:0;border-radius:12px;padding:10px 14px;font:800 13px inherit;cursor:pointer}.dsp-primary{background:var(--accent);color:#fff}.dsp-secondary{background:var(--soft-bg);color:var(--ink);border:1px solid var(--line)!important}.dsp-message{min-height:22px;margin-top:10px;color:var(--muted);font-size:13px;font-weight:700;line-height:1.7}@media(max-width:560px){.dsp-head{display:grid}.dsp-badge{justify-self:start}.dsp-actions>*{flex:1 1 120px}}
`;
    document.head.appendChild(style);
  }

  async function mount() {
    if (!['/account', '/report'].includes(location.pathname) || !memberApi) return;
    const data = await memberApi.session().catch(() => null);
    const user = data?.authenticated ? data.user : null;
    if (!user?.isAdmin) return;

    let settings = null;
    let subscription = null;
    let syncError = '';
    if (supported() && Notification.permission === 'granted') {
      try {
        const synced = await syncAdminSubscription();
        settings = synced.settings;
        subscription = synced.subscription;
      } catch (error) {
        syncError = error.message || '管理員通知訂閱同步失敗。';
      }
    }

    if (location.pathname !== '/account') return;
    const body = document.querySelector('#dsr-body');
    if (!body || body.querySelector('#downloadstarry-push-card')) return;

    ensureStyle();
    const section = document.createElement('section');
    section.id = 'downloadstarry-push-card';
    section.className = 'dsp-card';
    section.innerHTML = `
      <div class="dsp-head"><div><h2>系統通知</h2><p>使用 Web Push 直接送到這支裝置的系統通知中心，不消耗 LINE 訊息額度。</p></div><span id="dsp-badge" class="dsp-badge">檢查中</span></div>
      <div class="dsp-actions"><button id="dsp-toggle" class="dsp-primary" type="button">啟用系統通知</button><button id="dsp-test" class="dsp-secondary" type="button">發送測試通知</button></div>
      <div id="dsp-message" class="dsp-message" aria-live="polite"></div>`;
    body.appendChild(section);

    const badge = section.querySelector('#dsp-badge');
    const toggle = section.querySelector('#dsp-toggle');
    const test = section.querySelector('#dsp-test');
    const message = section.querySelector('#dsp-message');

    const setBusy = value => { toggle.disabled = value; test.disabled = value; };
    const render = () => {
      const enabled = Boolean(subscription && Notification.permission === 'granted');
      badge.textContent = enabled ? '已啟用' : Notification.permission === 'denied' ? '已封鎖' : '未啟用';
      toggle.textContent = enabled ? '停用這支裝置通知' : '啟用系統通知';
      toggle.className = enabled ? 'dsp-secondary' : 'dsp-primary';
      test.hidden = !enabled;
    };

    if (!supported()) {
      badge.textContent = '不支援';
      toggle.disabled = true;
      test.hidden = true;
      message.textContent = '目前瀏覽器不支援 Web Push 系統通知。';
      return;
    }

    if (platform?.runtime?.isIOS && !platform.runtime.isStandalone) {
      badge.textContent = '需安裝';
      toggle.disabled = true;
      test.hidden = true;
      message.textContent = 'iPhone / iPad 請先用 Safari 將繁星下載「加入主畫面」，再從主畫面的 App 開啟並啟用通知。';
      return;
    }

    try {
      settings = settings || await config();
      if (!settings.configured) {
        badge.textContent = '待設定';
        toggle.disabled = true;
        test.hidden = true;
        message.textContent = 'Web Push 金鑰尚未完成 Cloudflare 設定。';
        return;
      }
      await platform?.pwa?.registerServiceWorker?.();
      const registration = await navigator.serviceWorker.ready;
      subscription = subscription || await registration.pushManager.getSubscription();
      if (subscription && Notification.permission === 'granted') {
        await saveSubscription(subscription);
        syncError = '';
      }
      render();
      if (subscription) message.textContent = syncError || '這支裝置已訂閱繁星下載系統通知，伺服器訂閱也已同步。';
      else if (syncError) message.textContent = syncError;
    } catch (error) {
      badge.textContent = '錯誤';
      toggle.disabled = true;
      test.hidden = true;
      message.textContent = error.message || '無法初始化系統通知。';
      return;
    }

    toggle.addEventListener('click', async () => {
      setBusy(true);
      try {
        const registration = await navigator.serviceWorker.ready;
        if (subscription) {
          await revokeSubscription(subscription).catch(() => ({}));
          await subscription.unsubscribe();
          subscription = null;
          message.textContent = '這支裝置的系統通知已停用。';
        } else {
          if (Notification.permission === 'denied') throw new Error('通知權限已被瀏覽器封鎖，請到網站／系統通知設定重新允許。');
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') throw new Error('你尚未允許系統通知。');
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64UrlToBytes(settings.publicKey),
          });
          await saveSubscription(subscription);
          message.textContent = '已啟用。接下來發送一則測試通知…';
          await sendTest();
          message.textContent = '已啟用，測試通知已送出。';
        }
        render();
      } catch (error) {
        message.textContent = error.message || '通知設定失敗，請稍後再試。';
        render();
      } finally {
        setBusy(false);
      }
    });

    test.addEventListener('click', async () => {
      setBusy(true);
      message.textContent = '正在發送測試通知…';
      try {
        if (subscription) await saveSubscription(subscription);
        await sendTest();
        message.textContent = '測試通知已送出。';
      }
      catch (error) { message.textContent = error.message || '測試通知失敗。'; }
      finally { setBusy(false); }
    });
  }

  window.DownloadStarryPushUI = Object.freeze({mount, syncAdminSubscription});
})();
