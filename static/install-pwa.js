'use strict';
(() => {
  const showDialog = (title, message) => {
    let dialog = document.getElementById('install-app-dialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'install-app-dialog';
      dialog.className = 'playlist-dialog';
      dialog.innerHTML = '<div class="playlist-dialog-icon">✦</div><h2 id="install-app-title"></h2><p id="install-app-message"></p><div class="playlist-dialog-actions"><button class="dialog-primary" type="button">知道了</button></div>';
      dialog.querySelector('button')?.addEventListener('click', () => dialog.close());
      document.body.appendChild(dialog);
    }
    dialog.querySelector('#install-app-title').textContent = title;
    dialog.querySelector('#install-app-message').textContent = message;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else window.alert(message);
  };

  window.DownloadStarryInstallUI = async button => {
    const platform = window.SaveVideoPlatform;
    const pwa = platform?.pwa;
    if (!pwa) return;

    if (pwa.isInstalled) {
      button.style.opacity = '.45';
      button.setAttribute('aria-disabled', 'true');
      showDialog('繁星下載 · Download Starry', '你已安裝');
      return;
    }

    if (pwa.canPromptInstall) {
      const outcome = await pwa.promptInstall();
      if (outcome === 'accepted' || pwa.isInstalled) {
        button.style.opacity = '.45';
        button.setAttribute('aria-disabled', 'true');
        showDialog('繁星下載 · Download Starry', '安裝完成');
      }
      return;
    }

    const message = platform.runtime.isIOS
      ? '請點 Safari 的分享按鈕，再選「加入主畫面」。'
      : '請使用瀏覽器選單中的「安裝應用程式」或「加到主畫面」。';
    showDialog('安裝到桌面', message);
  };
})();