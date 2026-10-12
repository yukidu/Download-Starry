'use strict';
(() => {
  const THEME_KEY = 'savevideo_theme_v1';
  const body = document.body;
  const menuToggle = document.getElementById('menu-toggle');
  const menu = document.getElementById('main-menu');
  const topThemeToggle = document.getElementById('top-theme-toggle');
  const menuThemeToggle = document.getElementById('menu-theme-toggle');
  const menuThemeLabel = document.getElementById('menu-theme-label');
  const urlInput = document.getElementById('url');
  const lookupForm = document.getElementById('lookup-form');
  const message = document.getElementById('message');
  const hero = document.querySelector('.hero');

  const readTheme = () => {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === 'dark' || stored === 'light') return stored;
    } catch (_) {}
    return 'light';
  };

  const syncThemeControls = () => {
    const dark = body.classList.contains('dark-theme');
    const label = dark ? '開燈' : '關燈';
    if (menuThemeLabel) menuThemeLabel.textContent = label;
    [topThemeToggle, menuThemeToggle].forEach(button => {
      if (!button) return;
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.setAttribute('aria-pressed', String(dark));
    });
  };

  const setTheme = theme => {
    const dark = theme === 'dark';
    body.classList.toggle('dark-theme', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (_) {}
    syncThemeControls();
  };

  const toggleTheme = () => {
    setTheme(body.classList.contains('dark-theme') ? 'light' : 'dark');
  };

  const openMenu = () => {
    if (!menu || !menuToggle) return;
    menu.hidden = false;
    menuToggle.setAttribute('aria-expanded', 'true');
    menuToggle.setAttribute('title', '關閉主選單');
  };

  const closeMenu = () => {
    if (!menu || !menuToggle) return;
    menu.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('title', '開啟主選單');
  };

  const toggleMenu = () => {
    if (!menu) return;
    if (menu.hidden) openMenu();
    else closeMenu();
  };

  const installPlatformStyles = () => {
    if (document.getElementById('platform-interaction-style')) return;
    const style = document.createElement('style');
    style.id = 'platform-interaction-style';
    style.textContent = `
      .downloader > .hero {
        max-width: none;
        margin: 14px auto 8px;
        padding: 0;
      }
      .downloader > .hero .platform-icons {
        margin-top: 0;
      }
      .platform-icon {
        cursor: pointer;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
      }
      .platform-icon:focus-visible {
        outline: 3px solid color-mix(in srgb, var(--accent) 56%, transparent);
        outline-offset: 3px;
      }
      .platform-icon.platform-active {
        transform: translateY(-5px) scale(1.08);
        box-shadow: 0 18px 38px rgba(62,69,140,.26), 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
      }
      .platform-name-bubble {
        width: fit-content;
        max-width: calc(100% - 24px);
        margin: 9px auto 0;
        padding: 7px 13px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: var(--card);
        color: var(--ink);
        box-shadow: 0 8px 22px rgba(35,42,82,.13);
        font: 800 15px/1.2 "Noto Sans TC", sans-serif;
        text-align: center;
        animation: platformNameReveal .16s ease-out both;
      }
      .platform-name-bubble[hidden] { display: none !important; }
      @keyframes platformNameReveal {
        from { opacity: 0; transform: translateY(-4px) scale(.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @media (max-width: 700px) {
        .downloader > .hero { margin-top: 10px; }
        .platform-name-bubble { font-size: 14px; }
      }
    `;
    document.head.appendChild(style);
  };

  const movePlatformsBelowUrl = () => {
    if (!hero || !lookupForm) return;
    if (message && message.parentElement === lookupForm.parentElement) {
      message.insertAdjacentElement('afterend', hero);
    } else {
      lookupForm.insertAdjacentElement('afterend', hero);
    }
  };

  let platformLabelTimer = 0;
  const showPlatformName = item => {
    const container = item.closest('.platform-icons');
    if (!container) return;
    let bubble = container.parentElement?.querySelector('.platform-name-bubble');
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.className = 'platform-name-bubble';
      bubble.setAttribute('role', 'status');
      bubble.setAttribute('aria-live', 'polite');
      bubble.hidden = true;
      container.insertAdjacentElement('afterend', bubble);
    }

    const name = item.getAttribute('aria-label') || item.title || '影音平台';
    document.querySelectorAll('.platform-icon.platform-active').forEach(icon => icon.classList.remove('platform-active'));
    item.classList.add('platform-active');
    bubble.textContent = name;
    bubble.hidden = false;

    window.clearTimeout(platformLabelTimer);
    platformLabelTimer = window.setTimeout(() => {
      bubble.hidden = true;
      item.classList.remove('platform-active');
    }, 2200);
  };

  const wirePlatformIcons = () => {
    document.querySelectorAll('.platform-icon').forEach(item => {
      if (item.dataset.nameClickBound === 'true') return;
      item.dataset.nameClickBound = 'true';
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.addEventListener('click', () => showPlatformName(item));
      item.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        showPlatformName(item);
      });
    });
  };

  const addPlatformIcons = () => {
    const container = document.querySelector('.platform-icons');
    if (!container || container.dataset.expanded === 'true') return;
    container.dataset.expanded = 'true';
    container.setAttribute('aria-label', '支援 YouTube、Instagram、Facebook、微信影音號、TikTok、Threads、X、Dcard、小紅書、Bilibili、Twitch、Vimeo、Reddit、Pinterest');
    container.style.flexWrap = 'wrap';
    container.style.rowGap = '10px';

    const platforms = [
      ['TikTok', '♪', '#25f4ee'],
      ['Threads', '@', 'var(--ink)'],
      ['X', '𝕏', 'var(--ink)'],
      ['Dcard', 'D', '#3397cf'],
      ['小紅書', 'RED', '#ff2442'],
      ['Bilibili', 'B', '#00aeec'],
      ['Twitch', '▰', '#9146ff'],
      ['Vimeo', 'V', '#1ab7ea'],
      ['Reddit', 'r/', '#ff4500'],
      ['Pinterest', 'P', '#e60023'],
    ];

    platforms.forEach(([name, glyph, color], index) => {
      const item = document.createElement('span');
      item.className = `platform-icon platform-extra platform-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      item.title = name;
      item.setAttribute('aria-label', name);
      item.style.color = color;
      item.style.animationDelay = `${-(index + 4) * 0.38}s`;

      const mark = document.createElement('span');
      mark.textContent = glyph;
      mark.setAttribute('aria-hidden', 'true');
      mark.style.fontFamily = 'DM Sans, Noto Sans TC, sans-serif';
      mark.style.fontWeight = '900';
      mark.style.fontSize = glyph.length > 2 ? '12px' : '20px';
      mark.style.letterSpacing = glyph.length > 2 ? '-0.04em' : '0';
      item.appendChild(mark);
      container.appendChild(item);
    });
  };

  setTheme(readTheme());
  installPlatformStyles();
  movePlatformsBelowUrl();
  addPlatformIcons();
  wirePlatformIcons();

  menuToggle?.addEventListener('click', event => {
    event.stopPropagation();
    toggleMenu();
  });

  topThemeToggle?.addEventListener('click', toggleTheme);
  menuThemeToggle?.addEventListener('click', () => {
    toggleTheme();
    closeMenu();
  });

  document.querySelectorAll('[data-menu-action="home"]').forEach(button => {
    button.addEventListener('click', () => {
      closeMenu();
      window.scrollTo({top: 0, behavior: 'smooth'});
    });
  });

  document.querySelectorAll('[data-menu-action="focus-url"]').forEach(button => {
    button.addEventListener('click', () => {
      closeMenu();
      urlInput?.scrollIntoView({behavior: 'smooth', block: 'center'});
      window.setTimeout(() => urlInput?.focus({preventScroll: true}), 280);
    });
  });

  menu?.querySelectorAll('#open-wechat, #check-components').forEach(button => {
    button.addEventListener('click', () => closeMenu());
  });

  document.addEventListener('click', event => {
    if (!menu || menu.hidden) return;
    const header = document.getElementById('site-header');
    if (header && event.target instanceof Node && !header.contains(event.target)) closeMenu();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenu();
  });
})();
