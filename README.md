# SaveVideo

給音響組使用的社群影音下載工具。

## Cloudflare 雲端版（部署準備中）

雲端處理影片後，透過瀏覽器下載至使用者自己的電腦或手機；**不使用 R2、不建立雲端影片庫**。登入保護、暫存清理與 GitHub 自動部署設定已加入。部署方式、費用估算與目前限制請參閱 [雲端部署說明](deployment/README.md)。

以下保留原本 Windows 本機攜帶版的使用說明。

目前正式版本：**1.0.0**（對外簡稱 1.0）。重要變更請參閱 [CHANGELOG.md](CHANGELOG.md)。

本機執行的網頁工具，可解析 YouTube、Instagram 與 Facebook 影片、選擇可用畫質下載 MP4、轉換成 192 kbps MP3，或選擇可用的 CC 字幕下載成 SRT。

## 安裝

需要 Python 3.11+ 與 FFmpeg。Windows 可先安裝 FFmpeg：

```powershell
winget install Gyan.FFmpeg
```

安裝完成後，直接雙擊 `start.bat` 即可。批次檔會為目前的 Windows 使用者安裝 Python 套件、將 `yt-dlp` 更新至最新版並開啟網站，不需要系統管理員權限。專案也會安裝 `curl_cffi`，讓 Instagram 等平台能以瀏覽器相容的連線方式解析公開影片。

也可以手動啟動：

接著安裝 Python 套件並啟動：

```powershell
cd C:\CODEX\youtube-downloader
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

瀏覽器開啟 <http://127.0.0.1:5000>。

## 建立免安裝攜帶版

在 Windows PowerShell 執行：

```powershell
.\build-portable.ps1
```

建置程式會下載官方 Python 3.11 嵌入式執行環境、Python 套件與 FFmpeg，並在 `dist` 產生可直接分享的 ZIP。朋友只需完整解壓縮，雙擊套用圖示的「寰宇台南影片下載工具」捷徑，不需要另外安裝 Python 或 FFmpeg。若資料夾搬移後捷徑失效，執行一次「啟動寰宇台南影片下載工具.bat」即可自動修復。執行中的黑色視窗必須保持開啟；關閉視窗會同時停止本機網站。

程式會把診斷資訊寫入攜帶版的 `logs` 資料夾；下載錯誤記錄在 `downloader.log`，主控台輸出記錄在 `console.log`，啟動與結束記錄在 `launcher.log`。

## 版本編號規則

版本採用 `主版本.次版本.修訂版`：

- `1.0.1`：修正錯誤、相容性或安全問題，沒有新增主要功能。
- `1.1.0`：新增功能或明顯改善，並維持既有使用方式相容。
- `2.0.0`：介面、設定、資料格式或使用方式出現不相容的大改版。

每次正式發佈前先更新 `VERSION` 與 `CHANGELOG.md`，再執行 `build-portable.ps1`。建置器會檢查版本格式，並自動把版本號加入資料夾及 ZIP 檔名。

## 注意

- 接受 YouTube、Instagram 與 Facebook 影片網址；YouTube 播放清單可選擇只處理目前影片或批次下載全部影片。
- 私人、需要登入、受地區或年齡限制的內容可能無法下載。
- Instagram 下載需要 `yt-dlp 2026.08.19` 以上版本；若解析突然失敗，請關閉程式後重新執行 `start.bat` 更新套件。
- 影片有人工或自動產生的 CC 字幕時，介面會顯示「CC 字幕」分頁；同一語言優先使用人工字幕。
- YouTube 網址同時包含影片與播放清單時，介面會詢問是否下載整份清單。批次下載需使用支援資料夾選擇的最新版 Chrome 或 Edge，影片會依序串流寫入使用者指定的資料夾。
- 大型影片會使用分段傳輸、自動續傳與重試；下載頁面會顯示進度、速度、剩餘時間及合併狀態。可隨時按「停止下載」，關閉或離開頁面也會自動中止工作並清除未完成的暫存檔。
- 下載及 MP3 轉換需要 FFmpeg；平台規格變更時請更新 `yt-dlp`。
- 請遵守各平台服務條款及著作權法，只下載你擁有權利或已獲授權的內容。

## 1.1.0：微信影音號與元件更新

請完整解壓「整合攜帶版」，雙擊「啟動寰宇台南影片下載工具.bat」。主頁的「開啟微信影音號工具」會開啟輔助視窗，需要 Windows 管理員權限。按「開啟輔助擷取」，再到電腦版微信重新開啟並播放影片；不需要分享網址。微信輔助工具是獨立程序，結束主工具時請另外停止擷取並按「結束工具」，讓代理設定正常復原。

攜帶版包含 Python、Flask 及其依賴、yt-dlp、yt-dlp-ejs、Deno、FFmpeg 和微信引擎。Deno 的用途是 YouTube JavaScript 解析。啟動時會檢查 yt-dlp、yt-dlp-ejs、Deno、FFmpeg、微信引擎的本機狀態與官方穩定版本。若有缺少或更新，會彈出元件清單，顯示「目前版本 → 最新版本」。只有按「更新勾選元件」才會下載。可取消、稍後再從「檢查元件」操作。

更新來源限定 PyPI、Deno 官方 GitHub、Gyan FFmpeg GitHub 與微信引擎原專案 GitHub。下載檔案必須有官方 SHA-256，下載後先驗證並暫存到 `data/component-updates`。完整停止微信輔助工具與主工具，再重新啟動主工具才套用。主工具正在下載時禁止開始更新；微信輔助仍開啟時延後套用微信引擎。請勿直接刪除失敗更新的暫存與備份。

離線或 GitHub 請求限制不會阻止已有元件使用；缺少元件時，相應功能仍不可用，請連網後重試。缺少或損壞 Flask 時，啟動器會詢問是否從 PyPI 修復；缺少 Python 本體時，請重新完整解壓攜帶包。Python 本體、Flask 正常版本及其他底層依賴不做背景版本升級，應以完整攜帶包更新，避免破壞執行環境。原始碼模式的元件更新不會修改系統 Python，請以完整攜帶版使用更新功能。

微信引擎仍採原專案 MIT + Commons Clause 授權，原授權保存在 `wechat-channels/engine/LICENSE.upstream.txt`，不得銷售其功能。其他授權見 `THIRD-PARTY.txt`。微信憑證與代理流程見 [微信輔助說明](wechat-channels/README.md)。分享整合包時不要包含使用後的 data、logs、downloads，因其中可能含憑證私鑰與影片資訊。

整合包建置：`python scripts/build-integrated.py --runtime-source <完整既有攜帶版/runtime>`；事先將官方 Deno 校驗封裝與授權放到 build/integration-cache。原 build-portable.ps1 可另外從官方來源重建共享 runtime，並打包同一套整合檔案。
