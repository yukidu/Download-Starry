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
    async memberSession() {
      const response = await fetch(endpoint('/api/auth/starry/session'), {cache: 'no-store'});
      if (response.status === 401) return null;
      return readJson(response, '無法取得 Starry ID 會員資料');
    },
    async memberLogout() {
      const response = await fetch(endpoint('/api/auth/starry/logout'), {method: 'POST'});
      return readJson(response, '無法登出');
    },
    async createReport(report) {
      const response = await fetch(endpoint('/api/reports'), {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(report),
      });
      return readJson(response, '無法送出回報');
    },
    async reports() {
      const response = await fetch(endpoint('/api/reports'), {cache: 'no-store'});
      return readJson(response, '無法讀取回報');
    },
    async updateReportStatus(id, status) {
      const response = await fetch(endpoint(`/api/reports/${encodeURIComponent(id)}/status`), {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({status}),
      });
      return readJson(response, '無法更新回報狀態');
    },
  };

  window.SaveVideoAPI = Object.freeze(api);
})();
