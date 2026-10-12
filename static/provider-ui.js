(() => {
  const urlInput = document.querySelector('#url');
  const lookupForm = document.querySelector('#lookup-form');
  const platformStrip = document.querySelector('.platform-icons');
  const hero = document.querySelector('.hero');
  const message = document.querySelector('#message');
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

  const OFFICIAL_EXTRA_MARKS = {
    tiktok: `
      <svg class="provider-official-mark provider-official-tiktok" viewBox="0 0 32 32" aria-hidden="true" focusable="false" style="width:34px;height:34px;display:block">
        <rect x="1" y="1" width="30" height="30" rx="8" fill="#101010"/>
        <g transform="translate(4 4)">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" fill="#25F4EE" transform="translate(-.65 .55)"/>
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" fill="#FE2C55" transform="translate(.65 -.35)"/>
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" fill="#fff"/>
        </g>
      </svg>`,
    threads: `
      <svg class="provider-official-mark provider-official-threads" viewBox="0 0 32 32" aria-hidden="true" focusable="false" style="width:34px;height:34px;display:block">
        <circle cx="16" cy="16" r="15" fill="#000"/>
        <g transform="translate(4 4)"><path d="M18.263 11.097c-.03-3.486-1.92-5.586-5.111-5.586-2.13 0-3.922.963-4.863 2.499l2.062 1.438c.535-.843 1.272-1.543 2.628-1.543 1.528 0 2.318.85 2.544 2.431a15 15 0 0 0-2.236-.173c-4.125 0-6.068 1.867-6.068 4.336s1.943 3.99 4.804 3.99c3.139 0 5.013-2.115 5.781-4.735.798.361 1.348 1.204 1.348 2.47 0 3.387-3.907 5.232-7.22 5.232-4.885 0-8.077-3.207-8.077-8.424 0-6.392 4.223-10.487 9.9-10.487 3.808 0 5.69 1.671 6.97 3.914l2.108-1.475C21.44 2.078 18.331 0 13.663 0 6.227 0 1.168 5.277 1.168 12.934c0 7 4.953 11.066 10.856 11.066 4.878 0 9.809-2.846 9.809-7.716 0-2.545-1.46-4.231-3.569-5.187m-6.33 4.855c-1.077 0-2.026-.512-2.026-1.453 0-1.483 1.822-1.934 3.606-1.934.678 0 1.34.045 1.927.173-.422 1.927-1.671 3.215-3.508 3.214Z" fill="#fff"/></g>
      </svg>`,
    x: `
      <svg class="provider-official-mark provider-official-x" viewBox="0 0 32 32" aria-hidden="true" focusable="false" style="width:34px;height:34px;display:block">
        <circle cx="16" cy="16" r="15" fill="#000"/>
        <g transform="translate(6 6) scale(.84)"><path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" fill="#fff"/></g>
      </svg>`,
    dcard: `
      <img class="provider-official-mark provider-official-dcard" src="https://upload.wikimedia.org/wikipedia/commons/f/f8/Dcard_Favicon_x520.png" alt="" aria-hidden="true" referrerpolicy="no-referrer" style="width:34px;height:34px;border-radius:9px;display:block;object-fit:cover">`,
    xiaohongshu: `
      <svg class="provider-official-mark provider-official-xiaohongshu" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="width:37px;height:37px;display:block">
        <path d="M22.405 9.879c.002.016.01.02.07.019h.725a.797.797 0 0 0 .78-.972.794.794 0 0 0-.884-.618.795.795 0 0 0-.692.794c0 .101-.002.666.001.777zm-11.509 4.808c-.203.001-1.353.004-1.685.003a2.528 2.528 0 0 1-.766-.126.025.025 0 0 0-.03.014L7.7 16.127a.025.025 0 0 0 .01.032c.111.06.336.124.495.124.66.01 1.32.002 1.981 0 .01 0 .02-.006.023-.015l.712-1.545a.025.025 0 0 0-.024-.036zM.477 9.91c-.071 0-.076.002-.076.01a.834.834 0 0 0-.01.08c-.027.397-.038.495-.234 3.06-.012.24-.034.389-.135.607-.026.057-.033.042.003.112.046.092.681 1.523.787 1.74.008.015.011.02.017.02.008 0 .033-.026.047-.044.147-.187.268-.391.371-.606.306-.635.44-1.325.486-1.706.014-.11.021-.22.03-.33l.204-2.616.022-.293c.003-.029 0-.033-.03-.034zm7.203 3.757a1.427 1.427 0 0 1-.135-.607c-.004-.084-.031-.39-.235-3.06a.443.443 0 0 0-.01-.082c-.004-.011-.052-.008-.076-.008h-1.48c-.03.001-.034.005-.03.034l.021.293c.076.982.153 1.964.233 2.946.05.4.186 1.085.487 1.706.103.215.223.419.37.606.015.018.037.051.048.049.02-.003.742-1.642.804-1.765.036-.07.03-.055.003-.112zm3.861-.913h-.872a.126.126 0 0 1-.116-.178l1.178-2.625a.025.025 0 0 0-.023-.035l-1.318-.003a.148.148 0 0 1-.135-.21l.876-1.954a.025.025 0 0 0-.023-.035h-1.56c-.01 0-.02.006-.024.015l-.926 2.068c-.085.169-.314.634-.399.938a.534.534 0 0 0-.02.191.46.46 0 0 0 .23.378.981.981 0 0 0 .46.119h.59c.041 0-.688 1.482-.834 1.972a.53.53 0 0 0-.023.172.465.465 0 0 0 .23.398c.15.092.342.12.475.12l1.66-.001c.01 0 .02-.006.023-.015l.575-1.28a.025.025 0 0 0-.024-.035zm-6.93-4.937H3.1a.032.032 0 0 0-.034.033c0 1.048-.01 2.795-.01 6.829 0 .288-.269.262-.28.262h-.74c-.04.001-.044.004-.04.047.001.037.465 1.064.555 1.263.01.02.03.033.051.033.157.003.767.009.938-.014.153-.02.3-.06.438-.132.3-.156.49-.419.595-.765.052-.172.075-.353.075-.533.002-2.33 0-4.66-.007-6.991a.032.032 0 0 0-.032-.032zm11.784 6.896c0-.014-.01-.021-.024-.022h-1.465c-.048-.001-.049-.002-.05-.049v-4.66c0-.072-.005-.07.07-.07h.863c.08 0 .075.004.075-.074V8.393c0-.082.006-.076-.08-.076h-3.5c-.064 0-.075-.006-.075.073v1.445c0 .083-.006.077.08.077h.854c.075 0 .07-.004.07.07v4.624c0 .095.008.084-.085.084-.37 0-1.11-.002-1.304 0-.048.001-.06.03-.06.03l-.697 1.519s-.014.025-.008.036c.006.01.013.008.058.008 1.748.003 3.495.002 5.243.002.03-.001.034-.006.035-.033v-1.539zm4.177-3.43c0 .013-.007.023-.02.024-.346.006-.692.004-1.037.004-.014-.002-.022-.01-.022-.024-.005-.434-.007-.869-.01-1.303 0-.072-.006-.071.07-.07l.733-.003c.041 0 .081.002.12.015.093.025.16.107.165.204.006.431.002 1.153.001 1.153zm2.67.244a1.953 1.953 0 0 0-.883-.222h-.18c-.04-.001-.04-.003-.042-.04V10.21c0-.132-.007-.263-.025-.394a1.823 1.823 0 0 0-.153-.53 1.533 1.533 0 0 0-.677-.71 2.167 2.167 0 0 0-1-.258c-.153-.003-.567 0-.72 0-.07 0-.068.004-.068-.065V7.76c0-.031-.01-.041-.046-.039H17.93s-.016 0-.023.007c-.006.006-.008.012-.008.023v.546c-.008.036-.057.015-.082.022h-.95c-.022.002-.028.008-.03.032v1.481c0 .09-.004.082.082.082h.913c.082 0 .072.128.072.128V11.19s.003.117-.06.117h-1.482c-.068 0-.06.082-.06.082v1.445s-.01.068.064.068h1.457c.082 0 .076-.006.076.079v3.225c0 .088-.007.081.082.081h1.43c.09 0 .082.007.082-.08v-3.27c0-.029.006-.035.033-.035l2.323-.003c.098 0 .191.02.28.061a.46.46 0 0 1 .274.407c.008.395.003.79.003 1.185 0 .259-.107.367-.33.367h-1.218c-.023.002-.029.008-.028.033.184.437.374.871.57 1.303a.045.045 0 0 0 .04.026c.17.005.34.002.51.003.15-.002.517.004.666-.01a2.03 2.03 0 0 0 .408-.075c.59-.18.975-.698.976-1.313v-1.981c0-.128-.01-.254-.034-.38 0 .078-.029-.641-.724-.998z" fill="#fff"/>
      </svg>`,
    bilibili: `
      <svg class="provider-official-mark provider-official-bilibili" viewBox="0 0 32 32" aria-hidden="true" focusable="false" style="width:34px;height:34px;display:block">
        <rect x="1" y="1" width="30" height="30" rx="8" fill="#00AEEC"/>
        <g transform="translate(4 4)"><path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c0-.373.129-.689.386-.947.258-.257.574-.386.947-.386zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373Z" fill="#fff"/></g>
      </svg>`,
    twitch: `
      <svg class="provider-official-mark provider-official-twitch" viewBox="0 0 32 32" aria-hidden="true" focusable="false" style="width:34px;height:34px;display:block">
        <rect x="1" y="1" width="30" height="30" rx="8" fill="#9146FF"/>
        <g transform="translate(5 4.5) scale(.92)"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" fill="#fff"/></g>
      </svg>`,
    vimeo: `
      <svg class="provider-official-mark provider-official-vimeo" viewBox="0 0 32 32" aria-hidden="true" focusable="false" style="width:34px;height:34px;display:block">
        <circle cx="16" cy="16" r="15" fill="#1AB7EA"/>
        <g transform="translate(4 4)"><path d="M23.9765 6.4168c-.105 2.338-1.739 5.5429-4.894 9.6088-3.2679 4.247-6.0258 6.3699-8.2898 6.3699-1.409 0-2.578-1.294-3.553-3.881l-1.9179-7.1138c-.719-2.584-1.488-3.878-2.312-3.878-.179 0-.806.378-1.8809 1.132l-1.129-1.457a315.06 315.06 0 0 0 3.501-3.1279c1.579-1.368 2.765-2.085 3.5539-2.159 1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.5069.5389 2.45 1.1309 3.674 1.7759 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.8679 3.434-5.7568 6.7619-5.6368 2.4729.06 3.6279 1.664 3.4929 4.7969z" fill="#fff"/></g>
      </svg>`,
    reddit: `
      <svg class="provider-official-mark provider-official-reddit" viewBox="0 0 32 32" aria-hidden="true" focusable="false" style="width:34px;height:34px;display:block">
        <circle cx="16" cy="16" r="15" fill="#FF4500"/>
        <g transform="translate(4 4)"><path d="M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z" fill="#fff"/></g>
      </svg>`,
    pinterest: `
      <svg class="provider-official-mark provider-official-pinterest" viewBox="0 0 32 32" aria-hidden="true" focusable="false" style="width:34px;height:34px;display:block">
        <circle cx="16" cy="16" r="15" fill="#E60023"/>
        <g transform="translate(4 4)"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z" fill="#fff"/></g>
      </svg>`,
  };

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

  const installOfficialExtraMarks = () => {
    Object.entries(OFFICIAL_EXTRA_MARKS).forEach(([provider, markup]) => {
      const icon = document.querySelector(`.platform-icon[data-provider="${provider}"]`);
      if (!icon || icon.dataset.officialMarkInstalled === 'true') return;
      icon.innerHTML = markup;
      icon.dataset.officialMarkInstalled = 'true';
    });
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

    installOfficialExtraMarks();
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

  const syncPlatformPosition = () => {
    if (!hero || !lookupForm || !result) return;

    if (!result.hidden) {
      result.insertAdjacentElement('afterend', hero);
      hero.dataset.position = 'after-result';
      return;
    }

    if (message && message.parentElement === lookupForm.parentElement) {
      message.insertAdjacentElement('afterend', hero);
    } else {
      lookupForm.insertAdjacentElement('afterend', hero);
    }
    hero.dataset.position = 'after-url';
  };

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

  if (result && 'MutationObserver' in window) {
    const resultObserver = new MutationObserver(mutations => {
      if (mutations.some(mutation => mutation.attributeName === 'hidden')) syncPlatformPosition();
    });
    resultObserver.observe(result, {attributes: true, attributeFilter: ['hidden']});
  }

  requestAnimationFrame(() => {
    syncProviderHooks();
    installBrandMarks();
    syncProviderFromInput();
    syncPlatformPosition();
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
