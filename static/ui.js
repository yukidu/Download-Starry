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

  setTheme(readTheme());

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
