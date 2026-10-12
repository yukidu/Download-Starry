# SaveVideo｜Web First + PWA + Capacitor-ready 架構盤點

更新日期：2026-10-13

## 結論

SaveVideo 是 Flask + 原生 JavaScript / HTML / CSS + Cloudflare Workers / Containers，不是 React / TypeScript 專案。本專案不為 Capacitor 重寫框架，也不建立 Android / iOS project。

目前原則：Web 第一、PWA 保留、Native Optional、Cloudflare 後端共用。未使用的 Native 能力不得進入目前 Web 啟動路徑。

## A. 已符合 Capacitor-ready

- Cloudflare / Flask API 與下載資料來源維持同一套；未來 Android / iOS 不另建後端。
- 標準 HTTP route 可直接延伸 Universal Links / App Links。
- 下載工作、進度、取消、檔案取得都由後端 API 管理，前端不直接操作資料庫。
- Cloudflare Worker / Container、Durable Object、GitHub Actions 保留。
- `static/api.js` 集中 `/api/...` endpoint，預設同源；未來 Native 可透過 `window.__SAVEVIDEO_CONFIG__.apiBaseUrl` 或 `app-api-base` 集中指定 API base。

## B. 本輪已處理的平台邊界

目前首頁真正使用的平台能力集中在 `static/platform.js`：

- runtime：`isWeb`、`isPWA`、`isCapacitor`、`isAndroid`、`isIOS`、`isStandalone`，啟動時只判斷一次。
- clipboard：Web 使用 Clipboard API；未來可由 `window.SaveVideoNative.clipboard` 提供 Native implementation。
- files：Web 使用 Browser / File System Access API；未來可由 `window.SaveVideoNative.files` 接 Filesystem / File Picker。
- lifecycle：pagehide / sendBeacon 集中處理。
- pwa：Service Worker 註冊延後到 browser idle，不阻塞首頁主要工作。

`static/app-core.js` 只透過 Platform Service / API client 呼叫上述能力，不自行判斷 Android、iOS 或 Capacitor。

## C. 未使用 Native 功能的處理原則

目前產品沒有使用相機、通知、Web Push、Google/會員登入、生物辨識或 Native Share，因此這些能力目前**不加入首頁 platform.js、不安裝 Plugin、不做初始化**。

真正增加其中一項產品功能時，才新增對應的輕量 adapter / lazy-loaded module。這是刻意遵守「現在 Web 使用者不為未使用 Native 功能付效能成本」。

## D. PWA 與 Service Worker

- manifest、Service Worker、offline fallback、App icon 保留。
- `/api/*` 永遠不由 Service Worker 快取。
- 影片、音檔、照片 ZIP、字幕下載不由 Service Worker 快取。
- Service Worker 不再攔截每支 JS / CSS，也不做 stale-while-revalidate 背景重抓。
- 只預存離線提示頁；正常瀏覽完全走既有 HTTP/browser cache，降低額外 CPU、RAM 與網路使用。

## E. API / URL / OAuth

- Web 目前 API 是同源相對 `/api/...`，集中由 `SaveVideoAPI` 建立 endpoint。
- 正式 custom domain 留在 `wrangler.jsonc` 部署設定，不散落在 UI component。
- 專案目前沒有 OAuth callback、會員 Cookie session，因此不新增假想 Auth config。
- 未來若接中央會員中心，Web / PWA / Android / iOS 必須共用同一 member ID、API 與資料來源；Native OAuth callback / deep link 再由平台層加入。

## F. 刻意不大改的 Web-only 區域

- `provider-ui.js` 的來源頁跳轉仍是一般 Web `window.open`；它不是下載核心，也沒有 Native dependency。
- `ui.js` 的主題偏好仍使用少量 `localStorage`。
- Windows 本機版 `integration.js` 保持原樣。

這些區域目前沒有造成 Android / iOS 核心重寫風險，因此先保留，避免大規模 diff。若未來 Native App 對其中某能力有實際需求，再遷入 Platform adapter。

## 效能護欄

本專案沒有前端 bundler/chunk，因此用「首頁實際載入的原始 JS/CSS 檔案大小」作可重現的等價比較：

- Capacitor-ready 前首頁 JS：62,596 bytes（約 62.6 KB）。
- 第一版架構升級後：73,550 bytes（約 73.6 KB，+17.5%），不符合效能目標，因此已再精簡。
- 本輪修正後首頁 JS：約 68.7 KB，較原始版本約 +9.8%。
- 首頁 CSS：35,899 bytes（約 35.9 KB），前後不變。
- 新增 production dependency：0。
- Capacitor / Firebase / Native Plugin：0。

另外 `tests/performance-budget.test.js` 將首頁 JS 上限固定為 69,000 bytes、CSS 上限 36,000 bytes，避免之後因「為未來 App 預留」無意間持續膨脹 Web。

bootstrap 會立即 preload Platform / API / shared core，Platform 與 API 平行載入，shared core 已同步預抓，避免原先串行載入造成的 network waterfall。

## CPU / RAM / 網路風險

- runtime detection 只初始化一次，不使用反覆 getter 判斷。
- 移除沒有消費者的 online/offline global listener。
- 不監聽未使用的 `beforeinstallprompt`。
- Service Worker 不再對每個靜態資源背景 re-fetch。
- Service Worker 註冊延後至 browser idle。
- 沒有新增 polling、全域 state、Context、Native initialization 或重複 API request。

## 未來真正加入 Android / iOS 時

1. 屆時才安裝 Capacitor Core 並建立 Android / iOS native project。
2. 依實際需求才安裝 Share / Filesystem / Browser / App 等 Plugin。
3. 由 `window.SaveVideoNative` adapter 接目前 Platform Service，不重寫下載 UI / shared core。
4. 設定 Native API base、CORS / CSRF / OAuth callback。
5. 設定 Android App Links 與 Apple Universal Links。
6. 若接中央會員中心，使用同一會員 ID / API / DB，敏感 token 不放 localStorage。
7. 進行 Android / iOS 實機大檔案下載、儲存、背景切換與權限測試。
8. 最後才處理簽署與商店上架。
