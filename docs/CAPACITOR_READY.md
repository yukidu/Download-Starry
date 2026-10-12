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

## B. 此次需要調整的部分

- 剪貼簿直接使用 `navigator.clipboard`。
- 主題設定直接使用 `localStorage`。
- 單檔下載直接建立 `<a>`。
- 播放清單直接使用 `showDirectoryPicker`、File System Access API。
- 離開頁面取消工作直接使用 `navigator.sendBeacon`。
- API endpoint 分散在 `static/app.js`。
- 來源頁面另有直接 `window.open`。
- 專案原本沒有 manifest / service worker，因此尚不是完整 PWA。

此次建立：

- `static/platform.js`：runtime、storage、clipboard、files、browser、lifecycle、network、PWA、version 統一入口。
- `static/api.js`：API endpoint 與下載 API 統一入口。
- PWA manifest、Service Worker、離線提示頁與 App 圖示。

## C. 高風險、不應現在動的部分

- `app.py` 的 yt-dlp / FFmpeg / 微信 / Facebook / 照片下載邏輯。
- Cloudflare Worker → Container 的內部驗證。
- 單一 Container、暫存檔、續傳與檔案清理機制。
- Windows 本機版的 `integration.js` / 元件更新 / 微信輔助流程。

這些與「未來 Capacitor-ready」沒有直接必要關係，所以此次不大改。

## D. 仍屬 Web-only 的能力

- Web PWA 安裝提示與 Service Worker。
- Chrome / Edge 的播放清單資料夾選擇與直接串流寫入。
- 外部來源頁面的瀏覽器開新分頁。
- Windows 本機專用整合功能。

其中一般檔案、瀏覽器與 storage 能力已先有 platform service；真正加入 Capacitor 時只需在 `window.SaveVideoNative` 後面接 Native implementation，不應在各 UI component 到處寫 `if (ios)` / `if (android)`。

## E. API / URL / OAuth 寫死盤點

- 正式下載 API 目前採同源相對 `/api/...`，對 Web 是安全且簡單的做法。
- 新增 `app-api-base` / `SaveVideoAPI` 後，未來 Native runtime 可以集中指定 API base，不必改每個畫面。
- `wrangler.jsonc` 的正式 custom domain 是部署設定，保留。
- 專案目前沒有會員登入、Google OAuth、Cookie session，因此此次不新增或假裝存在第二套 Auth。
- 若未來接中央會員中心，Web / PWA / Android / iOS 應共用同一會員 ID 與後端 API；Native OAuth callback / deep link 再由平台層接入。

## F. 可以抽象化但現在不急著改的部分

- `provider-ui.js` 的來源頁面 `window.open` 可下一輪改接 `platform.browser.openExternal()`。
- Windows 本機 `integration.js` 有自己的 local API 與視窗流程；它不是雲端 Capacitor 核心，不應為了目錄漂亮而重構。
- 通知、相機、生物辨識、Push、Native Share 目前產品沒有使用，因此只保留未來擴充原則，不安裝任何 Capacitor Plugin / Firebase / APNs。

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
