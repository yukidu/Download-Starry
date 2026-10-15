import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('深層功能頁先隱藏首頁內容且不載入首頁 app-core', async () => {
  const app = await read('static/app.js');
  assert.match(app, /deepRoutes=new Set\(\['\/account','\/report','\/install','\/history'\]\)/);
  assert.match(app, /main\.style\.visibility='hidden'/);
  assert.match(app, /const coreTask=home\?load\(core\):Promise\.resolve\(\)/);
  assert.match(app, /main\.style\.visibility=''/);
});

test('下載紀錄只完整渲染一次，不再背景逐筆重新解析並重畫整頁', async () => {
  const history = await read('static/download-history.js');
  assert.match(history, /renderRows\(content,rows\)/);
  assert.doesNotMatch(history, /enrichMissing|saveMetadata|baseApi\(\)\?\.info/);
});

test('回報管理 API 將會員網址 metadata 的標題與縮圖一起帶回', async () => {
  const admin = await read('cloudflare/admin-reports.js');
  const worker = await read('cloudflare/worker.js');
  assert.match(admin, /LEFT JOIN downloadstarry_url_metadata m ON m\.userId = r\.userId AND m\.url = r\.url/);
  assert.match(admin, /AS thumbnail/);
  assert.match(worker, /url\.pathname === '\/api\/reports' && method === 'GET'/);
  assert.match(worker, /handleAdminReportList/);
});
