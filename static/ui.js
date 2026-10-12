'use strict';
(() => {
  const THEME_KEY = 'savevideo_theme_v1';
  const body = document.body;
  const menuToggle = document.getElementById('menu-toggle');
  const menu = document.getElementById('main-menu');
  const siteHeader = document.getElementById('site-header');
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
        overflow: visible;
        -webkit-tap-highlight-color: transparent;
      }
      .platform-icon:focus-visible {
        outline: 3px solid color-mix(in srgb, var(--accent) 56%, transparent);
        outline-offset: 3px;
      }
      .platform-icon.platform-active {
        z-index: 24;
        transform: translateY(-5px) scale(1.08);
        box-shadow: 0 18px 38px rgba(62,69,140,.26), 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
      }
      .platform-name-bubble {
        position: absolute;
        top: 50%;
        left: calc(100% + 12px);
        z-index: 40;
        width: max-content;
        max-width: min(250px, calc(100vw - 28px));
        padding: 9px 15px 10px;
        border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line));
        border-radius: 13px;
        background: color-mix(in srgb, var(--panel-bg) 94%, transparent);
        color: var(--ink);
        box-shadow: 0 13px 32px rgba(25,31,68,.20), 0 0 0 1px rgba(255,255,255,.34) inset;
        backdrop-filter: blur(16px) saturate(145%);
        -webkit-backdrop-filter: blur(16px) saturate(145%);
        font: 900 19px/1.25 "Noto Sans TC", sans-serif;
        letter-spacing: .02em;
        text-align: center;
        white-space: nowrap;
        pointer-events: none;
        transform: translateY(-50%);
        transform-origin: left center;
        animation: platformNameReveal .18s cubic-bezier(.2,.8,.2,1) both;
      }
      .platform-name-bubble::before {
        content: "";
        position: absolute;
        top: 50%;
        left: -7px;
        width: 12px;
        height: 12px;
        border-left: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line));
        border-bottom: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line));
        background: color-mix(in srgb, var(--panel-bg) 96%, transparent);
        transform: translateY(-50%) rotate(45deg);
      }
      .platform-name-bubble.platform-bubble-left {
        right: calc(100% + 12px);
        left: auto;
        transform-origin: right center;
      }
      .platform-name-bubble.platform-bubble-left::before {
        right: -7px;
        left: auto;
        border: 0;
        border-top: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line));
        border-right: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line));
      }
      .platform-name-bubble.platform-bubble-below {
        top: calc(100% + 12px);
        left: 50%;
        right: auto;
        transform: translateX(-50%);
        transform-origin: center top;
      }
      .platform-name-bubble.platform-bubble-below::before {
        top: -7px;
        left: 50%;
        border: 0;
        border-left: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line));
        border-top: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line));
        transform: translateX(-50%) rotate(45deg);
      }
      .platform-name-bubble[hidden] { display: none !important; }
      @keyframes platformNameReveal {
        from { opacity: 0; scale: .92; }
        to { opacity: 1; scale: 1; }
      }
      @media (max-width: 700px) {
        .downloader > .hero { margin-top: 10px; }
        .platform-name-bubble { font-size: 18px; padding: 9px 13px; }
      }
    `;
    document.head.appendChild(style);
  };

  const installHeaderStarStyles = () => {
    if (document.getElementById('header-starfield-style')) return;
    const style = document.createElement('style');
    style.id = 'header-starfield-style';
    style.textContent = `
      .site-header {
        isolation: isolate;
        overflow: visible;
        border-bottom-color: rgba(154,174,255,.22);
        background:
          radial-gradient(circle at 18% 15%, rgba(192,132,252,.22), transparent 34%),
          radial-gradient(circle at 80% 16%, rgba(56,189,248,.18), transparent 32%),
          linear-gradient(112deg, rgba(8,12,34,.96), rgba(27,20,68,.94) 52%, rgba(7,31,55,.95));
        box-shadow: 0 8px 28px rgba(17,24,62,.24);
        backdrop-filter: blur(18px) saturate(150%);
        -webkit-backdrop-filter: blur(18px) saturate(150%);
      }
      body.dark-theme .site-header {
        background:
          radial-gradient(circle at 18% 15%, rgba(192,132,252,.24), transparent 34%),
          radial-gradient(circle at 80% 16%, rgba(56,189,248,.20), transparent 32%),
          linear-gradient(112deg, rgba(4,7,23,.98), rgba(21,14,53,.97) 52%, rgba(4,22,42,.98));
      }
      .site-header-row,
      .main-menu-shell {
        z-index: 3;
      }
      .site-header .site-brand {
        color: #f8fbff;
      }
      .site-header .site-brand-text {
        color: #f8fbff;
        text-shadow: 0 0 12px rgba(255,255,255,.25), 0 0 24px rgba(192,132,252,.24);
      }
      .site-header .site-brand-wave i {
        background: #7dd3fc;
        box-shadow: 0 0 8px rgba(125,211,252,.58);
      }
      .site-header .top-action-button,
      .site-header .hamburger-button {
        border-color: rgba(255,255,255,.13);
        background: rgba(255,255,255,.10);
        color: #f8fbff;
        box-shadow: 0 7px 20px rgba(0,0,0,.12);
      }
      .site-header .top-action-button:hover,
      .site-header .hamburger-button:hover {
        border-color: rgba(125,211,252,.42);
        background: rgba(255,255,255,.16);
        box-shadow: 0 9px 24px rgba(0,0,0,.18), 0 0 18px rgba(125,211,252,.12);
      }
      .header-starfield {
        position: absolute;
        inset: 0;
        z-index: 1;
        overflow: hidden;
        pointer-events: none;
        user-select: none;
      }
      .header-starfield::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(105deg, transparent 16%, rgba(255,255,255,.055) 46%, transparent 66%);
        transform: translateX(-115%);
        animation: headerStarSweep 12s ease-in-out infinite;
      }
      .header-star {
        position: absolute;
        display: block;
        color: var(--star-color, #fff);
        opacity: var(--star-opacity, .72);
        transform: translate(-50%, -50%);
        transform-origin: center;
      }
      .header-star.star-dot {
        border-radius: 50%;
        background: currentColor;
        box-shadow: 0 0 7px currentColor;
      }
      .header-star.star-cross,
      .header-star.star-sparkle {
        background: currentColor;
        clip-path: polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%);
        filter: drop-shadow(0 0 3px currentColor);
      }
      .header-star.star-sparkle {
        filter: drop-shadow(0 0 4px currentColor) drop-shadow(0 0 8px color-mix(in srgb, currentColor 48%, transparent));
      }
      .header-star.star-twinkle-slow { animation: headerStarTwinkleSlow 4s ease-in-out infinite; }
      .header-star.star-twinkle-medium { animation: headerStarTwinkleMedium 2.8s ease-in-out infinite; }
      .header-star.star-twinkle-fast { animation: headerStarTwinkleFast 1.8s ease-in-out infinite; }
      @keyframes headerStarTwinkleSlow {
        0%, 100% { opacity: .15; scale: .75; }
        50% { opacity: 1; scale: 1.25; }
      }
      @keyframes headerStarTwinkleMedium {
        0%, 100% { opacity: .85; scale: 1.15; }
        50% { opacity: .20; scale: .70; }
      }
      @keyframes headerStarTwinkleFast {
        0%, 100% { opacity: .25; scale: .85; }
        50% { opacity: .95; scale: 1.30; }
      }
      @keyframes headerStarSweep {
        0%, 68% { transform: translateX(-115%); opacity: 0; }
        76% { opacity: .72; }
        100% { transform: translateX(115%); opacity: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .header-star,
        .header-starfield::after { animation: none !important; }
      }
    `;
    document.head.appendChild(style);
  };

  const installHeaderStarfield = () => {
    if (!siteHeader || siteHeader.querySelector('.header-starfield')) return;
    const field = document.createElement('div');
    field.className = 'header-starfield';
    field.setAttribute('aria-hidden', 'true');

    const colors = ['#f59e0b', '#fbbf24', '#f43f5e', '#ec4899', '#38bdf8', '#ffffff', '#c084fc'];
    const speeds = ['star-twinkle-slow', 'star-twinkle-medium', 'star-twinkle-fast'];
    const types = ['star-dot', 'star-dot', 'star-cross', 'star-dot', 'star-sparkle'];

    for (let i = 0; i < 30; i += 1) {
      const seed = (i * 9301 + 49297) % 233280;
      const rnd1 = seed / 233280;
      const rnd2 = ((seed * 9301 + 49297) % 233280) / 233280;
      const rnd3 = ((seed * 1337 + 7919) % 233280) / 233280;
      const star = document.createElement('span');
      const type = types[i % types.length];
      const speed = speeds[i % speeds.length];
      const size = type === 'star-sparkle' ? Math.round(rnd1 * 5 + 8) : type === 'star-cross' ? Math.round(rnd1 * 4 + 5) : Math.round(rnd1 * 2.5 + 2);
      star.className = `header-star ${type} ${speed}`;
      star.style.left = `${Math.round(rnd2 * 96 + 2)}%`;
      star.style.top = `${Math.round(rnd1 * 82 + 9)}%`;
      star.style.width = `${size}px`;
      star.style.height = `${size}px`;
      star.style.setProperty('--star-color', colors[i % colors.length]);
      star.style.setProperty('--star-opacity', String(Math.min(.92, Math.max(.36, rnd3))));
      star.style.animationDelay = `${(i * .35) % 3.5}s`;
      field.appendChild(star);
    }

    siteHeader.insertBefore(field, siteHeader.firstChild);
  };

  const movePlatformsBelowUrl = () => {
    if (!hero || !lookupForm) return;
    if (message && message.parentElement === lookupForm.parentElement) {
      message.insertAdjacentElement('afterend', hero);
    } else {
      lookupForm.insertAdjacentElement('afterend', hero);
    }
  };

  let activePlatformIcon = null;
  let activePlatformBubble = null;

  const hidePlatformName = () => {
    if (activePlatformBubble) activePlatformBubble.hidden = true;
    if (activePlatformIcon) activePlatformIcon.classList.remove('platform-active');
    activePlatformIcon = null;
    activePlatformBubble = null;
  };

  const positionPlatformBubble = (item, bubble) => {
    bubble.classList.remove('platform-bubble-left', 'platform-bubble-below');
    const itemRect = item.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();
    const gap = 16;
    const roomRight = window.innerWidth - itemRect.right;
    const roomLeft = itemRect.left;

    if (roomRight >= bubbleRect.width + gap) return;
    if (roomLeft >= bubbleRect.width + gap) {
      bubble.classList.add('platform-bubble-left');
      return;
    }
    bubble.classList.add('platform-bubble-below');
  };

  const showPlatformName = item => {
    if (activePlatformIcon === item && activePlatformBubble && !activePlatformBubble.hidden) return;
    hidePlatformName();

    let bubble = item.querySelector('.platform-name-bubble');
    if (!bubble) {
      bubble = document.createElement('span');
      bubble.className = 'platform-name-bubble';
      bubble.setAttribute('role', 'status');
      bubble.setAttribute('aria-live', 'polite');
      bubble.hidden = true;
      item.appendChild(bubble);
    }

    const name = item.getAttribute('aria-label') || item.title || '影音平台';
    item.classList.add('platform-active');
    bubble.textContent = name;
    bubble.hidden = false;
    activePlatformIcon = item;
    activePlatformBubble = bubble;

    window.requestAnimationFrame(() => positionPlatformBubble(item, bubble));
  };

  const wirePlatformIcons = () => {
    document.querySelectorAll('.platform-icon').forEach(item => {
      if (item.dataset.nameClickBound === 'true') return;
      item.dataset.nameClickBound = 'true';
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.addEventListener('click', event => {
        event.stopPropagation();
        showPlatformName(item);
      });
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
  installHeaderStarStyles();
  installHeaderStarfield();
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
    hidePlatformName();
    if (!menu || menu.hidden) return;
    if (siteHeader && event.target instanceof Node && !siteHeader.contains(event.target)) closeMenu();
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    hidePlatformName();
    closeMenu();
  });

  window.addEventListener('resize', () => {
    if (activePlatformIcon && activePlatformBubble && !activePlatformBubble.hidden) {
      positionPlatformBubble(activePlatformIcon, activePlatformBubble);
    }
  });
})();