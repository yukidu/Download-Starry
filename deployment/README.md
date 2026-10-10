# GitHub → Cloudflare 雲端部署

影片從社群網站下載到容器的暫存目錄，經 FFmpeg 處理後，使用者以瀏覽器下載到自己的電腦或手機。**不使用 R2，不建立雲端影片庫。**

## 已準備的部署內容

- `Dockerfile`：Python 3.12、FFmpeg、Deno、yt-dlp 及 Gunicorn。
- `cloudflare/worker.js`：單一 Cloudflare Container，閒置 2 分鐘後休眠。
- `cloudflare/access.js`：瀏覽器登入、跨站操作保護及串流轉送。
- `deployment/server.py`：後端驗證、定期清除暫存。
- `.github/workflows/deploy.yml`：main 推送 → 測試及容器建置 → 部署。
- 容器限制為 1 台 `basic`（1 GiB 記憶體、1/4 vCPU、4 GB 磁碟）；同時 1 個下載工作。
- 單次來源資料預設限制 512 MiB（影音分流合計）；單獨的 MP3、轉檔及 FFmpeg 工作檔仍會消耗額外空間。這是初始節費設定，非原本平台限制。
- 完成傳送後保留約 2 分鐘以支援續傳；未取回的完成檔案約 15 分鐘後清除。清理週期 30 秒，正在傳送的檔案不刪除。
- 休眠、重啟及重新部署可能清除尚未取回的暫存和下載工作；請在處理完成後立即下載。
- Windows 微信擷取與攜帶版元件更新只在本機模式提供。

## 費用提案（尚未啟用）

查核來源：https://developers.cloudflare.com/containers/platform/pricing/

Workers Paid 基本費 **US$5/月**。若帳號已有此方案，是否增加基本費須以帳號狀態確認。以下額度為整個帳號共享，不是每個 App 各有一份：

| 項目 | 每月包含 | 超額 |
|---|---|---|
| 容器記憶體 | 25 GiB 小時 | US$0.009 / GiB 小時 |
| 容器 CPU | 375 vCPU 分鐘 | US$0.0012 / vCPU 分鐘 |
| 容器磁碟 | 200 GB 小時 | US$0.000252 / GB 小時 |
| 台灣、韓國、大洋洲傳出流量 | 500 GB | US$0.05 / GB |

傳出流量費率依實際容器所在區域，不是使用者所在地；不同區域適用不同額度與費率。Workers、Durable Objects、可能的記錄用量另依方案計算。本專案不啟用 Workers observability。

**例子（假設，不是保證）：**每部 500 MB，每次下載連同處理、傳送及休眠等待平均使用容器 7 分鐘；單一 basic instance，CPU 按最高 1/4 vCPU 全程忙碌估算；採台灣區流量費率，且帳號額度未被其他 App 使用。

| 每月部數 | 容器時間 | 傳出流量 | 基本費＋容器記憶體／CPU／磁碟／流量估算 |
|---|---|---|---|
| 10 | 1.17 小時 | 5 GB | 約 US$5 |
| 100 | 11.67 小時 | 50 GB | 約 US$5 |
| 1,000 | 116.67 小時 | 500 GB | 約 US$7.54 |

上表未計 Workers／Durable Objects 超額、重試、額外網路請求與稅費；不是總帳單上限。轉 MP3、慢速下載、持續使用或來源網站重試可能提高用量。每月 1,000 部需要遠長於這個假設的處理時間時，費用也會更高。

最低方案有月費，**不是下載到第幾部才開始付費**。單一容器與檔案大小限制可控制規模，不能保證硬性帳單上限。應先完成少量實際測試，再依用量資料調整。

## 上線步驟

1. 建立私人 GitHub 儲存庫 `yukidu/huanyu-video-downloader`，只上傳程式與設定。
2. Cloudflare 登入並確認帳號；使用者確認上述價格後才啟用 Workers Paid 或付費部署。
3. 在 GitHub repository secrets 設定 `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`。Token 應限定此 Cloudflare 帳號並包含 Workers、Durable Objects、Containers 及映像檔部署所需權限。
4. 先執行測試流程；確認容器能成功建置。
5. 設定 GitHub repository variable `DEPLOY_ENABLED=true` 後，main 推送或手動 workflow_dispatch 才會部署。
6. 首次部署後，在 Cloudflare Worker 的 Secrets 中設定 `AUTH_PASSWORD`（至少 20 字元的隨機 ASCII 密碼）。預設使用者名稱為 `samuel`。未設定密碼時入口回傳 503，不允許啟動容器。
7. 以該帳號密碼開啟部署網址，測試影片解析、MP4、MP3、SRT、取消、續傳及手機下載。

如使用 Workers Builds 原生 Git 整合，請停用上述 GitHub deploy job，避免重複部署。每次部署會更新程式；不會將影片同步到 GitHub。

## 本機驗證

```sh
python -m venv .venv
.venv/bin/python -m pip install 'Flask>=3.1,<4' pytest
.venv/bin/python -m pytest -q
node --test tests/worker.test.js
pnpm install --frozen-lockfile
pnpm exec wrangler deploy --dry-run --containers-rollout=none
```

最後一行僅驗證 Worker 打包，不建置 Docker 映像檔。完整容器建置由 GitHub Actions 的 dry-run（不含 rollout=none）完成，或有 Docker 的電腦執行 `docker build .`。

平台可能拒絕雲端主機 IP、要求登入或限制部分影片；通過程式測試不代表所有社群平台影片都能下載。不要將私人 cookies 或帳密提交到 GitHub。手機單部下載使用瀏覽器下載功能，並非直接寫入相簿；播放清單資料夾批次儲存仍須瀏覽器支援 `showDirectoryPicker`。
