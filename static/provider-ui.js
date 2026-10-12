(() => {
  const urlInput = document.querySelector('#url');
  const lookupForm = document.querySelector('#lookup-form');
  const platformStrip = document.querySelector('.platform-icons');
  const platformIcons = [...document.querySelectorAll('.platform-icon[data-provider]')];
  const result = document.querySelector('#result');
  const mediaCard = result?.querySelector('.media-card');
  const downloadUrl = document.querySelector('#download-url');

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
    } catch (_) {
      return null;
    }

    return null;
  };

  const emphasizeProvider = rawUrl => {
    const provider = detectProvider(rawUrl);
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
    syncProviderFromInput();
  }

  lookupForm?.addEventListener('submit', syncProviderFromInput);

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
