import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('新的回報 Push 僅使用最高管理員／管理員訂閱，並可從修復通知訂閱自癒', async () => {
  const push = await read('cloudflare/push.js');
  assert.match(push, /const ADMIN_EMAIL = 'yukidu@gmail.com'/);
  assert.match(push, /downloadstarry_repair_push_subscriptions/);
  assert.match(push, /loadHighestAdminSubscriptions/);
  assert.match(push, /LOWER\(COALESCE\(u\.primaryEmail, ''\)\) = \?/);
  assert.match(push, /am\.appId = \?/);
  assert.match(push, /dedupeSubscriptions\(\[\.\.\.primary, \.\.\.repair\]\)/);
  assert.match(push, /sendAdminPushNotification\(env, data, targetUserId = ''\)/);
  assert.match(push, /sendAdminPushNotification\(env,[\s\S]*admin\.id\)/);
});

test('失效 Push endpoint 會同步在管理員與修復通知資料表撤銷', async () => {
  const push = await read('cloudflare/push.js');
  const revoke = push.match(/async function markRevoked[\s\S]*?\n}\n\nasync function deliver/)?.[0] || '';
  assert.match(revoke, /downloadstarry_push_subscriptions/);
  assert.match(revoke, /downloadstarry_repair_push_subscriptions/);
  assert.match(push, /response\.status === 404 \|\| response\.status === 410/);
});

test('管理員已允許通知時會自動重新同步本機 Push 訂閱到伺服器', async () => {
  const ui = await read('static/push-notifications.js');
  assert.match(ui, /async function syncAdminSubscription/);
  assert.match(ui, /Notification\.permission !== 'granted'/);
  assert.match(ui, /registration\.pushManager\.getSubscription\(\)/);
  assert.match(ui, /registration\.pushManager\.subscribe/);
  assert.match(ui, /await saveSubscription\(subscription\)/);
  assert.match(ui, /\['\/account', '\/report'\]\.includes\(location\.pathname\)/);
  assert.match(ui, /Object\.freeze\(\{mount, syncAdminSubscription\}\)/);
});
