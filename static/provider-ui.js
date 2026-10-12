(() => {
  const urlInput = document.querySelector('#url');
  const lookupForm = document.querySelector('#lookup-form');
  const platformStrip = document.querySelector('.platform-icons');
  const result = document.querySelector('#result');
  const mediaCard = result?.querySelector('.media-card');
  const downloadUrl = document.querySelector('#download-url');

  const PROVIDER_BY_LABEL = new Map([
    ['YouTube', 'youtube'],
    ['Instagram', 'instagram'],
    ['Facebook', 'facebook'],
    ['微信影音號／視頻號', 'wechat'],
    ['乾淨世界 Gan Jing World', 'ganjingworld'],
    ['Odysee', 'odysee'],
    ['TikTok', 'tiktok'],
    ['Threads', 'threads'],
    ['X', 'x'],
    ['Dcard', 'dcard'],
    ['小紅書', 'xiaohongshu'],
    ['Bilibili', 'bilibili'],
    ['Twitch', 'twitch'],
    ['Vimeo', 'vimeo'],
    ['Reddit', 'reddit'],
    ['Pinterest', 'pinterest'],
  ]);

  const hostMatches = (host, domains) => domains.some(domain => host === domain || host.endsWith(`.${domain}`));

  const detectProvider = rawUrl => {
    const value = String(rawUrl || '').trim();
    if (!value) return null;

    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol)) return null;
      const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

      if (hostMatches(host, ['youtube.com', 'youtu.be', 'youtube-nocookie.com'])) return 'youtube';
      if (hostMatches(host, ['instagram.com'])) return 'instagram';
      if (hostMatches(host, ['facebook.com', 'fb.watch'])) return 'facebook';
      if (hostMatches(host, ['weixin.qq.com'])) return 'wechat';
      if (hostMatches(host, ['ganjingworld.com', 'ganjing.com', 'gjw.us'])) return 'ganjingworld';
      if (hostMatches(host, ['odysee.com'])) return 'odysee';
      if (hostMatches(host, ['tiktok.com'])) return 'tiktok';
      if (hostMatches(host, ['threads.net', 'threads.com'])) return 'threads';
      if (hostMatches(host, ['x.com', 'twitter.com'])) return 'x';
      if (hostMatches(host, ['dcard.tw'])) return 'dcard';
      if (hostMatches(host, ['xiaohongshu.com', 'xhslink.com'])) return 'xiaohongshu';
      if (hostMatches(host, ['bilibili.com', 'b23.tv'])) return 'bilibili';
      if (hostMatches(host, ['twitch.tv'])) return 'twitch';
      if (hostMatches(host, ['vimeo.com'])) return 'vimeo';
      if (hostMatches(host, ['reddit.com', 'redd.it'])) return 'reddit';
      if (hostMatches(host, ['pinterest.com', 'pin.it'])) return 'pinterest';
    } catch (_) {
      return null;
    }

    return null;
  };

  const syncProviderHooks = () => {
    const icons = [...document.querySelectorAll('.platform-icon')];
    icons.forEach(icon => {
      if (icon.dataset.provider) return;
      const label = icon.getAttribute('aria-label') || icon.title || '';
      const provider = PROVIDER_BY_LABEL.get(label);
      if (provider) icon.dataset.provider = provider;
    });
    return [...document.querySelectorAll('.platform-icon[data-provider]')];
  };

  const installBrandMarks = () => {
    const ganjing = document.querySelector('.platform-icon[data-provider="ganjingworld"]');
    if (ganjing) {
      ganjing.innerHTML = `
        <svg class="provider-brand-mark provider-brand-mark-ganjing" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="gjw-sky" x1="8" y1="4" x2="52" y2="48" gradientUnits="userSpaceOnUse">
              <stop stop-color="#e9fbff"/>
              <stop offset="1" stop-color="#d7f4ff"/>
            </linearGradient>
          </defs>
          <rect x="4" y="4" width="56" height="56" rx="15" fill="url(#gjw-sky)"/>
          <g fill="none" stroke="#244b9b" stroke-linecap="round">
            <circle cx="32" cy="27" r="19.5" stroke-width="1.9"/>
            <path d="M13 27h38M32 7.5c-6 5.2-9 11.7-9 19.5s3 14.3 9 19.5M32 7.5c6 5.2 9 11.7 9 19.5s-3 14.3-9 19.5M17 17.5c8 4.2 22 4.2 30 0M17 36.5c8-4.2 22-4.2 30 0" stroke-width="1.25" opacity=".92"/>
          </g>
          <text x="32" y="32.5" text-anchor="middle" fill="#5e8fd5" font-family="Noto Sans TC, sans-serif" font-size="15" font-weight="900" letter-spacing="-1.4">乾淨</text>
          <text x="32" y="55" text-anchor="middle" fill="#e97316" font-family="DM Sans, sans-serif" font-size="9.7" font-weight="900" letter-spacing=".6">GJW</text>
        </svg>`;
    }

    const odysee = document.querySelector('.platform-icon[data-provider="odysee"]');
    if (odysee) {
      odysee.innerHTML = `
        <svg class="provider-brand-mark provider-brand-mark-odysee" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="odysee-official-gradient" x1="12" y1="7" x2="52" y2="57" gradientUnits="userSpaceOnUse">
              <stop stop-color="#f52768"/>
              <stop offset=".52" stop-color="#f6534d"/>
              <stop offset="1" stop-color="#ff9418"/>
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="28" fill="url(#odysee-official-gradient)"/>
          <path d="M9.2 38.1c-3.7 1.9-6.8-2.7-3.6-5.5l14.5-12.7c-.8-6.1 3.4-11.3 9-11.7 6.4-.4 10.8 4 11.5 10.1l.5 4.5 5.2-4.8c4-3.8 10.1-2.3 11.5 2.8 1 3.7-.7 6.6-3.8 8.6l-7.9 5.2c-3.7 2.5-5.1 6.2-4 10.5l1.8 7c1.1 4.2-3.8 7.2-7.1 4.4l-6.4-5.3c-3.5 4.9-9.5 7.5-15.2 5.7-5.1-1.6-6.5-7.6-3.1-11.3l4.6-5.1-7.5-2.4Z" fill="#fff"/>
          <ellipse cx="29" cy="16.4" rx="1.8" ry="2.8" fill="#f7455c" transform="rotate(-21 29 16.4)"/>
          <ellipse cx="34.2" cy="21.2" rx="1.7" ry="3.3" fill="#f7455c" transform="rotate(8 34.2 21.2)"/>
          <circle cx="51.2" cy="10.4" r="1.3" fill="#fff" opacity=".95"/>
          <path d="m52 29.7 1.4 3.4 3.5 1.3-3.5 1.4-1.4 3.4-1.4-3.4-3.4-1.4 3.4-1.3 1.4-3.4Z" fill="#fff" opacity=".95"/>
        </svg>`;
    }
  };

  const emphasizeProvider = rawUrl => {
    const provider = detectProvider(rawUrl);
    const platformIcons = syncProviderHooks();
    platformStrip?.classList.toggle('has-detected-provider', Boolean(provider));

    platformIcons.forEach(icon => {
      const selected = Boolean(provider) && icon.dataset.provider === provider;
      icon.classList.toggle('is-detected', selected);
      if (selected) icon.setAttribute('aria-current', 'true');
      else icon.removeAttribute('aria-current');
    });

    return provider;
  };

  const syncProviderFromInput = () => emphasizeProvider(urlInput?.value);

  if (urlInput) {
    urlInput.addEventListener('input', syncProviderFromInput);
    urlInput.addEventListener('change', syncProviderFromInput);
    urlInput.addEventListener('paste', () => requestAnimationFrame(syncProviderFromInput));
  }

  lookupForm?.addEventListener('submit', syncProviderFromInput);

  if (platformStrip && 'MutationObserver' in window) {
    const observer = new MutationObserver(() => {
      syncProviderHooks();
      installBrandMarks();
    });
    observer.observe(platformStrip, {childList: true});
  }

  requestAnimationFrame(() => {
    syncProviderHooks();
    installBrandMarks();
    syncProviderFromInput();
  });

  const getSourceUrl = () => {
    const rawUrl = String(downloadUrl?.value || urlInput?.value || '').trim();
    if (!rawUrl) return null;

    try {
      const parsed = new URL(rawUrl);
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
    } catch (_) {
      return null;
    }
  };

  const openSourcePage = () => {
    const sourceUrl = getSourceUrl();
    if (!sourceUrl) return;
    window.open(sourceUrl, '_blank', 'noopener,noreferrer');
  };

  if (mediaCard) {
    mediaCard.classList.add('media-source-link');
    mediaCard.setAttribute('role', 'link');
    mediaCard.setAttribute('tabindex', '0');
    mediaCard.setAttribute('aria-label', '開啟原始來源網頁');
    mediaCard.setAttribute('title', '點擊開啟原始來源網頁');

    mediaCard.addEventListener('click', event => {
      if (event.target.closest('a, button, input, select, textarea')) return;
      openSourcePage();
    });

    mediaCard.addEventListener('keydown', event => {
      if (!['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      openSourcePage();
    });
  }
})();
