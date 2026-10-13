'use strict';
(() => {
  if (window.DownloadStarryMemberAPI) return;
  const base = window.SaveVideoAPI;
  if (!base?.endpoint) throw new Error('SaveVideo API bootstrap missing');
  const readJson = async (response, fallback) => {
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data.error || fallback);
    return data;
  };
  const endpoint = base.endpoint;
  window.DownloadStarryMemberAPI = Object.freeze({
    async session() {
      const response = await fetch(endpoint('/api/auth/starry/session'), {cache:'no-store'});
      if (response.status === 401) return null;
      return readJson(response, '無法取得 Starry ID 會員資料');
    },
    async logout() {
      return readJson(await fetch(endpoint('/api/auth/starry/logout'), {method:'POST'}), '無法登出');
    },
    async createReport(report) {
      return readJson(await fetch(endpoint('/api/reports'), {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report)}), '無法送出回報');
    },
    async reports() {
      return readJson(await fetch(endpoint('/api/reports'), {cache:'no-store'}), '無法讀取回報');
    },
    async updateReportStatus(id, status) {
      return readJson(await fetch(endpoint('/api/report-repair/status'), {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})}), '無法更新回報狀態');
    },
    async repairConfig() {
      return readJson(await fetch(endpoint('/api/report-repair/config'), {cache:'no-store'}), '無法讀取修復通知設定');
    },
    async repairSubscribe(subscription) {
      return readJson(await fetch(endpoint('/api/report-repair/subscribe'), {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(subscription)}), '無法啟用修復通知');
    },
    async repairWatch(reportId) {
      return readJson(await fetch(endpoint('/api/report-repair/watch'), {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reportId})}), '無法設定修復通知');
    },
    async repairTest() {
      return readJson(await fetch(endpoint('/api/report-repair/test'), {method:'POST'}), '修復通知測試失敗');
    },
    async downloadHistory() {
      return readJson(await fetch(endpoint('/api/download-history'), {cache:'no-store'}), '無法讀取下載紀錄');
    },
  });
})();
