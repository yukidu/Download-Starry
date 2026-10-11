# 雲端搬移評估

檢查日期：2026-10-10。原始版本：1.1.0 整合攜帶版。

## 已確認架構

- 介面已是 Flask + HTML/CSS/JavaScript，不需要重寫整個介面。
- `/api/info` 使用 yt-dlp 解析影片與播放清單。
- `/api/download` 在 Python 背景執行緒下載影片，FFmpeg 合併影片、轉 MP3 或 SRT。
- 工作狀態保存在單一 Python 程序記憶體，影片暫存在本機磁碟。因此後端只能啟動一個 WSGI worker，或另行實作共用佇列與儲存。
- 微信影音號透過 Windows 管理員權限、代理與本機微信擷取，不能直接搬到雲端。
- 元件更新功能會寫入本機 runtime，雲端模式應改由重新建置部署更新元件。

## 部署選擇

1. Cloudflare 提供介面，使用者電腦執行下載後端：沒有雲端運算主機月租，但使用時電腦須開機；需要實作安全的連接方式。
2. Cloudflare Workers + Containers：可執行 Python、FFmpeg 及 Deno，使用時不需要自己的電腦作為伺服器；需要 Workers Paid 方案。

Cloudflare Containers 官方費率（查詢日期 2026-10-10）：
https://developers.cloudflare.com/containers/platform/pricing/

Workers Paid 基本費 US$5/月；另有容器 CPU、記憶體、磁碟、傳出流量、Workers、Durable Objects 等用量。不可僅以影片部數推算總帳單。尚未開通付費方案。

## 帳號連接狀態

- 已確認 GitHub 連接帳號為 yukidu。
- 已安裝並登入 GitHub CLI，建立私人儲存庫 `yukidu/SaveVideo`。
- 已安裝並登入 Cloudflare Wrangler；已確認 workers.dev 子網域為 `yukidu`。
- Plugin Management 未找到可用的 Cloudflare 外掛。
- 2026-10-11：本機 15 項程式測試、Worker 打包，以及桌面／手機尺寸瀏覽器模擬下載測試通過。正式社群影片與容器建置仍待驗證。
- 現有 OAuth 權限無法讀取帳單訂閱或建立長效 API token。GitHub 持續部署還需要專用 API token；付費開通需確認價格。

## 上傳範圍

只上傳程式、介面、測試、部署設定及文件。不包含 Windows 執行環境、下載影片、日誌、cookies、私鑰、憑證或使用者資料。

## 驗收條件

- 雲端入口需要驗證，未登入者不能解析或啟動下載。
- 雲端模式不能呼叫 Windows 輔助工具或本機元件更新。
- 支援原有影片、MP3、字幕與播放清單下載流程。
- GitHub 更新後能自動部署；部署失敗不應被回報為成功。
- 完成實際影片解析、下載、轉檔及瀏覽器驗證後，才能宣稱整體搬移完成。
