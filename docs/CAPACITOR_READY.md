# SaveVideo｜Web First + PWA + Capacitor-ready 架構盤點

更新日期：2026-10-13

## 先說結論

SaveVideo 目前不是 React / TypeScript 專案，而是 Flask + 原生 JavaScript / HTML / CSS + Cloudflare Workers / Containers。這次不為了 Capacitor 重寫框架，而是在既有穩定架構上建立清楚的平台與 API 邊界。

目標維持：Web 第一、PWA 可用、Capacitor 未來可選、Cloudflare 後端共用。

## A. 已經符合 Capacitor-ready 的部分

- API 使用同一套 Cloudflare / Flask 後端，不需要為 Android / iOS 建第二套資料來源。
- 主要內容網址與 API 都是標準 HTTP route，沒有只有桌面程式才懂的 App route。
- 雲端下載工作、進度、取消與檔案取得已由後端 API 管理，前端沒有直接碰資料庫。
- Cloudflare Worker / Container、Durable Object、GitHub Actions 可以原樣保留。
- 正式站已使用自訂網域 `download.starry.phd`，未來 Universal Links / App Links 可沿用同一網站網域。

## B. 原本需要調整、且本輪已處理的部分

原本下載主流程直接使用 `navigator.clipboard`、`showDirectoryPicker`、File System Access API、`navigator.sendBeacon`、自行建立 `<a>` 下載，且 `/api/...` endpoint 分散在 `static/app.js`。

本輪已將下載主流程移到：

- `static/platform.js`：runtime、storage、clipboard、files、browser、lifecycle、network、PWA、version 統一入口。
- `static/api.js`：API endpoint 與下載 API 統一入口。
- `static/app-core.js`：只呼叫 Platform Service / API client，不自行判斷 Web、Android、iOS。
- `static/app.js`：只負責 bootstrap，共用核心不再綁死 HTML 載入順序。
- PWA manifest、Service Worker、離線提示頁與 App 圖示。

專案原本沒有 manifest / service worker，因此本輪補上最低風險 PWA shell。

## C. 高風險、不應現在動的部分

- `app.py` 的 yt-dlp / FFmpeg / 微信 / Facebook / 照片下載邏輯。
- Cloudflare Worker → Container 的內部驗證。
- 單一 Container、暫存檔、續傳與檔案清理機制。
- Windows 本機版的 `integration.js` / 元件更新 / 微信輔助流程。

這些與「未來 Capacitor-ready」沒有直接必要關係，所以此次不大改。

## D. 仍屬 Web-only，但已有未來接點的能力

- Web PWA 安裝提示與 Service Worker。
- Web 的播放清單資料夾選擇與串流寫入；主流程已改走 `platform.files`，未來可接 Native Filesystem/File Picker。
- 外部來源頁面目前仍由 `provider-ui.js` 直接使用瀏覽器 `window.open`；`platform.browser.openExternal()` 已存在，之後若 Native App 真正需要再遷移。
- `ui.js` 的主題偏好仍直接使用少量 `localStorage`；`platform.storage` 已準備好，但這次不為了兩個存取點重寫整個大型視覺腳本。
- Windows 本機專用 `integration.js` 仍維持 local API / 視窗流程，不納入 Capacitor 核心。

這些保留項目不會阻止未來 App 化，也避免本輪製造不必要的大 diff。

## E. API / URL / OAuth 寫死盤點

- 正式下載 API 目前採同源相對 `/api/...`，對 Web 是安全且簡單的做法。
- 新增 `app-api-base` / `SaveVideoAPI` 後，未來 Native runtime 可以集中指定 API base，不必改每個畫面。
- `wrangler.jsonc` 的正式 custom domain 是部署設定，保留。
- 專案目前沒有會員登入、Google OAuth、Cookie session，因此此次不新增或假裝存在第二套 Auth。
- 若未來接中央會員中心，Web / PWA / Android / iOS 應共用同一會員 ID 與後端 API；Native OAuth callback / deep link 再由平台層接入。

## F. 可以抽象化但現在不急著加入的能力

- 通知、相機、生物辨識、Push、Native Share 目前產品沒有使用，因此不為未來假需求安裝 Capacitor Plugin / Firebase / APNs。
- `platform.js` 已保留 `window.SaveVideoNative` adapter 邊界；真正需要某個 Native 能力時才實作對應 adapter。
- 版本服務目前提供 Web / Native / build number 的統一讀取介面；目前 Web build 尚未在 CI 注入 commit SHA / build date，因此不偽造這兩個欄位。

## PWA 快取安全原則

- `/api/*` 永遠 network-only，不進 Cache Storage。
- 影片、音檔、照片 ZIP、字幕下載不由 Service Worker 快取。
- 只快取 CSS / JS / manifest / icon / offline page 等靜態 shell。
- 頁面導覽優先走網路；真正離線才顯示靜態離線頁。

## 未來真正加入 Android / iOS 時還要做的事

1. 安裝 Capacitor 核心並建立 Android / iOS native project。
2. 依「實際需求」才安裝 Share / Filesystem / Browser / App 等 Plugin。
3. 建立 `window.SaveVideoNative` adapter，讓 `platform.js` 呼叫原生能力。
4. 為 Native runtime 設定正式 API base 與 CORS / CSRF / OAuth callback 策略。
5. 設定 Android App Links 與 Apple Universal Links。
6. 若接中央會員中心，加入安全的 Native OAuth / deep link 流程，不把敏感 token 放 localStorage。
7. 針對 Android / iOS 實機驗證大檔案下載、背景切換、儲存位置與權限。
8. 最後才處理商店簽署、圖示、安全聲明與上架流程。

目前不需要 Android Studio / Xcode / Firebase / APNs，也不新增 Capacitor dependency。
