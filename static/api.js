'use strict';
(() => {
  if (window.SaveVideoAPI) return;

  const runtimeConfig = window.__SAVEVIDEO_CONFIG__ || {};
  const metaBase = document.querySelector('meta[name="app-api-base"]')?.content?.trim() || '';
  const rawBase = String(runtimeConfig.apiBaseUrl || metaBase || '').replace(/\/+$/, '');

  const endpoint = path => {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return rawBase ? `${rawBase}${normalized}` : normalized;
  };

  const readJson = async (response, fallbackMessage) => {
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data.error || fallbackMessage);
    return data;
  };

  const api = {
    endpoint,
    async info(url) {
      const response = await fetch(endpoint('/api/info'), {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({url}),
      });
      return readJson(response, '無法解析網址');
    },
    async startDownload({url, type, quality = 'best', subtitle = ''}) {
      const formData = new FormData();
      formData.append('url', url);
      formData.append('type', type);
      formData.append('quality', quality || 'best');
      formData.append('subtitle', subtitle || '');
      const response = await fetch(endpoint('/api/download'), {method: 'POST', body: formData});
      return readJson(response, '無法開始下載');
    },
    async progress(jobId) {
      const response = await fetch(endpoint(`/api/download/${jobId}/progress`), {cache: 'no-store'});
      return readJson(response, '無法取得下載進度');
    },
    cancelUrl(jobId) {
      return endpoint(`/api/download/${jobId}/cancel`);
    },
    async cancel(jobId) {
      const response = await fetch(this.cancelUrl(jobId), {method: 'POST'});
      return readJson(response, '無法停止下載');
    },
    fileUrl(jobId) {
      return endpoint(`/api/download/${jobId}/file`);
    },
    async fileResponse(jobId, {signal} = {}) {
      const response = await fetch(this.fileUrl(jobId), {signal});
      if (!response.ok) {
        let data = {};
        try { data = await response.json(); } catch (_) {}
        throw new Error(data.error || '無法取得已下載的檔案');
      }
      return response;
    },
  };

  window.SaveVideoAPI = Object.freeze(api);
})();
