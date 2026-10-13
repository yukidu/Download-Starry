'use strict';
(() => {
  if (window.DownloadStarryRepairNotifications) return;

  const api = window.DownloadStarryMemberAPI;
  const memberPlatform = window.DownloadStarryMemberPlatform;
  const platform = window.SaveVideoPlatform;
  const notifications = platform?.notifications;

  function supported() {
    if (platform?.runtime?.isCapacitor) return Boolean(notifications?.isSupported && window.SaveVideoNative?.notifications?.ensurePushSubscription);
    return Boolean(notifications?.isSupported && 'serviceWorker' in navigator && 'PushManager' in window);
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
.dsr-repair-notify{border:1px solid color-mix(in srgb,var(--accent) 42%,var(--line));background:color-mix(in srgb,var(--accent) 10%,var(--soft-bg));color:var(--ink)}.dsr-repair-notify.is-active{border-color:color-mix(in srgb,var(--accent) 70%,var(--line));background:color-mix(in srgb,var(--accent) 18%,var(--soft-bg));color:var(--accent)}.dsr-member-only{display:grid;gap:13px;justify-items:start}.dsr-member-only h2{margin:0;font-size:20px}.dsr-member-only p{margin:0;color:var(--muted);line-height:1.7}.dsr-dialog-backdrop{position:fixed;inset:0;z-index:10020;display:grid;place-items:center;padding:20px;background:rgba(5,8,24,.60);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}.dsr-dialog-backdrop[hidden]{display:none!important}.dsr-dialog-card{width:min(100%,390px);padding:22px;border:1px solid var(--line);border-radius:20px;background:var(--panel-bg);color:var(--ink);box-shadow:0 24px 70px rgba(0,0,0,.32)}.dsr-dialog-card h2{margin:0 0 8px;font-size:20px}.dsr-dialog-card p{margin:0;color:var(--muted);font-size:13px;line-height:1.7}.dsr-dialog-card p+p{margin-top:8px}.dsr-dialog-card .dsr-actions{margin-top:16px}.dsr-dialog-card .dsr-actions>*{min-width:0}.dsr-permission-steps{margin:10px 0 0;padding-left:20px;color:var(--muted);font-size:13px;line-height:1.75}.dsr-success-card{text-align:center}.dsr-success-card .dsr-primary{width:100%}@media(max-width:560px){.dsr-repair-notify{min-height:40px}}
`;
    document.head.appendChild(style);
  }

  function showInstallGuide() {
    let modal = document.querySelector('#dsr-install-guide');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'dsr-install-guide';
      modal.className = 'dsr-dialog-backdrop';
      modal.innerHTML = `
        <section class="dsr-dialog-card" role="dialog" aria-modal="true" aria-labelledby="dsr-install-title">
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

  function permissionGuideContent(blocked) {
    const runtime = platform?.runtime || {};
    if (runtime.isAndroid && runtime.isPWA) {
      return {
        mode: 'android-pwa',
        title: '請開啟繁星下載的通知權限',
        copy: blocked
          ? '你目前是從已安裝的繁星下載開啟，畫面沒有 Chrome 網址列。通知已被封鎖，請改從 Android 的 App 通知設定解除封鎖。'
          : '你目前是從已安裝的繁星下載開啟。若系統沒有跳出允許通知視窗，請從 Android 的 App 通知設定確認權限。',
        steps: [
          '回到手機桌面，長按「繁星下載」圖示，點「應用程式資訊」或 ⓘ。',
          '進入「通知」，開啟「允許通知」。',
          '回到繁星下載，按下方「設定完成，重新檢查」。',
          '若 App 資訊中找不到通知設定，再到 Chrome → 設定 → 網站設定 → 通知，確認 download.starry.phd 為允許。'
        ],
        foot: '已安裝 PWA 不需要再找網址列；系統會依目前執行模式顯示正確步驟。'
      };
    }
    if (runtime.isIOS && runtime.isStandalone) {
      return {
        mode: 'ios-pwa',
        title: '請開啟繁星下載的通知權限',
        copy: blocked
          ? '繁星下載的通知已被 iPhone／iPad 封鎖，請到系統設定重新允許。'
          : '若沒有看到通知允許視窗，請到系統設定確認繁星下載的通知權限。',
        steps: [
          '打開 iPhone／iPad「設定」。',
          '進入「通知」，找到「繁星下載」。',
          '開啟「允許通知」。',
          '回到繁星下載，按下方「設定完成，重新檢查」。'
        ],
        foot: 'iPhone／iPad 必須從已加入主畫面的繁星下載開啟，才能使用 Web Push。'
      };
    }
    if (runtime.isAndroid) {
      return {
        mode: 'android-browser',
        title: '請允許繁星下載傳送通知',
        copy: blocked
          ? '目前 Chrome 已封鎖這個網站的通知，因此系統不會再次跳出允許視窗。請先在網站權限中改成允許。'
          : 'Chrome 這次沒有完成通知授權。若沒有看到系統允許視窗，請直接從網址列的網站權限開啟通知。',
        steps: [
          '點 Chrome 網址列左側的網站設定圖示、鎖頭或被劃線的鈴鐺。',
          '找到「通知」，改成「允許」。',
          '回到繁星下載，按下方「設定完成，重新檢查」。'
        ],
        foot: 'Android Chrome 一般瀏覽器不需要先安裝到桌面。'
      };
    }
    return {
      mode: 'browser',
      title: '請允許繁星下載傳送通知',
      copy: blocked
        ? '瀏覽器已封鎖這個網站的通知。請到瀏覽器的網站權限或通知設定改成允許。'
        : '這次沒有完成通知授權，請到瀏覽器的網站權限或通知設定開啟通知。',
      steps: [
        '打開目前瀏覽器的網站資訊或網站權限。',
        '把「通知」改成「允許」。',
        '回到繁星下載，按下方「設定完成，重新檢查」。'
      ],
      foot: '若瀏覽器已明確封鎖通知，網站基於安全限制無法自行解除。'
    };
  }

  function showPermissionGuide(blocked = false) {
    let modal = document.querySelector('#dsr-permission-guide');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'dsr-permission-guide';
      modal.className = 'dsr-dialog-backdrop';
      modal.innerHTML = `
        <section class="dsr-dialog-card" role="dialog" aria-modal="true" aria-labelledby="dsr-permission-title">
          <h2 id="dsr-permission-title"></h2>
          <p id="dsr-permission-copy"></p>
          <ol id="dsr-permission-steps" class="dsr-permission-steps"></ol>
          <p id="dsr-permission-foot"></p>
          <div class="dsr-actions"><button id="dsr-permission-retry" class="dsr-primary" type="button">設定完成，重新檢查</button><button id="dsr-permission-close" class="dsr-secondary" type="button">稍後處理</button></div>
        </section>`;
      document.body.appendChild(modal);
      modal.querySelector('#dsr-permission-retry').addEventListener('click', () => {
        modal.hidden = true;
        window.setTimeout(() => document.querySelector('#dsr-repair-notify')?.click(), 0);
      });
      modal.querySelector('#dsr-permission-close').addEventListener('click', () => { modal.hidden = true; });
    }
    const guide = permissionGuideContent(blocked);
    modal.dataset.mode = guide.mode;
    modal.querySelector('#dsr-permission-title').textContent = guide.title;
    modal.querySelector('#dsr-permission-copy').textContent = guide.copy;
    modal.querySelector('#dsr-permission-steps').innerHTML = guide.steps.map(step => `<li>${step}</li>`).join('');
    modal.querySelector('#dsr-permission-foot').textContent = guide.foot;
    modal.hidden = false;
  }

  function showReportSuccess(detail) {
    let modal = document.querySelector('#dsr-report-success');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'dsr-report-success';
      modal.className = 'dsr-dialog-backdrop';
      modal.innerHTML = `
        <section class="dsr-dialog-card dsr-success-card" role="dialog" aria-modal="true" aria-labelledby="dsr-success-title">
          <h2 id="dsr-success-title">已回報完成</h2>
          <p id="dsr-success-copy"></p>
          <div class="dsr-actions"><button id="dsr-success-close" class="dsr-primary" type="button">關閉</button></div>
        </section>`;
      document.body.appendChild(modal);
      modal.querySelector('#dsr-success-close').addEventListener('click', () => location.assign('/'));
    }
    modal.querySelector('#dsr-success-copy').textContent = detail || '管理員已收到你的回報。';
    modal.hidden = false;
    modal.querySelector('#dsr-success-close')?.focus();
  }

  async function ensureSubscription() {
    if (platform?.runtime?.isIOS && !platform.runtime.isStandalone) {
      showInstallGuide();
      throw new Error('iPhone／iPad 請先將繁星下載加入主畫面，再從主畫面的 App 開啟此功能。');
    }
    if (!supported()) throw new Error('目前瀏覽器不支援手機系統通知。');

    const currentPermission = notifications?.permission || 'unsupported';
    if (currentPermission === 'denied') {
      showPermissionGuide(true);
      throw new Error(platform?.runtime?.isPWA
        ? '通知已被系統封鎖，請依畫面指引到 App 通知設定改成允許。'
        : '通知已被瀏覽器封鎖，請先到網站權限把「通知」改成允許。');
    }
    if (currentPermission === 'default') {
      const permission = await notifications.requestPermission();
      if (permission !== 'granted') {
        showPermissionGuide(permission === 'denied');
        throw new Error(permission === 'denied'
          ? (platform?.runtime?.isPWA ? '通知已被系統封鎖，請到 App 通知設定改成允許。' : '通知已被瀏覽器封鎖，請先到網站權限把「通知」改成允許。')
          : '你尚未允許系統通知，請完成通知權限設定。');
      }
    } else if (currentPermission !== 'granted') {
      throw new Error('目前環境無法取得系統通知權限。');
    }

    const settings = await api.repairConfig();
    if (!settings.configured || !settings.publicKey) {
      throw new Error('系統通知尚未完成伺服器設定。');
    }

    if (platform?.runtime?.isCapacitor) {
      const nativePush = window.SaveVideoNative?.notifications?.ensurePushSubscription;
      if (!nativePush) throw new Error('目前原生 App 尚未啟用通知介面。');
      const nativeSubscription = await nativePush({publicKey: settings.publicKey});
      await api.repairSubscribe(nativeSubscription);
      return nativeSubscription;
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

    const renameResolvedButtons = () => {
      body.querySelectorAll('.dsr-status[data-status="resolved"]').forEach(button => {
        if (button.textContent !== '已修復') button.textContent = '已修復';
      });
    };
    renameResolvedButtons();
    new MutationObserver(renameResolvedButtons).observe(body, {childList: true, subtree: true});

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
      notifyButton.textContent = notifyRequested ? '✓ 已訂閱修復通知' : '修復後通知我';
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
      message.textContent = '正在要求系統通知權限…';
      try {
        await ensureSubscription();
        notifyRequested = true;
        renderNotify();
        message.textContent = '已訂閱修復通知。送出回報後，管理員標記「已修復」時會通知這支裝置。';
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
        let detail = '管理員已收到你的回報。';
        if (notifyRequested) {
          try {
            await api.repairWatch(result.id);
            detail = '管理員已收到你的回報；修復完成後會通知這支裝置。';
          } catch (watchError) {
            detail = `回報已送出，但修復通知尚未完成：${watchError.message || '請稍後再試'}`;
          }
        }
        message.textContent = '已回報完成。';
        showReportSuccess(detail);
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