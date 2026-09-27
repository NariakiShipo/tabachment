# 商店資訊（Store listing）

在 Chrome 線上應用程式商店開發人員資訊主頁的「商店資訊」分頁中填寫。
名稱與摘要會自動從 `extension/_locales/*/messages.json` 取用（英文、繁中、簡中、日文），這裡只需要貼上**詳細說明**。

| 欄位 | 內容 |
| --- | --- |
| 類別（Category） | 生產力 › 通訊（Productivity › Communication） |
| 語言（Language） | 英文為預設；可再為「中文 (繁體)」提供下方的中文說明 |
| 商店圖示 | `store/images/icon-128.png` |
| 螢幕截圖（1280×800） | `store/images/screenshot-1-click-*.png`、`screenshot-2-formats-*.png`、`screenshot-3-options-*.png` |
| 小型宣傳圖塊（440×280） | `store/images/promo-small-440x280-*.png` |
| 大型宣傳圖塊（1400×560，可省略） | `store/images/promo-marquee-1400x560-*.png` |
| 首頁網址 | `https://github.com/NariakiShipo/tabachment` |
| 支援網址 | `https://github.com/NariakiShipo/tabachment/issues` |

`*` 為 `zh_TW`（中文版商店頁）或 `en`（英文版商店頁）。

---

## 詳細說明 — 中文（繁體）

```text
在 Gmail™ 點一下附件，就直接在新分頁開啟：不跳出預覽視窗，也不用先下載。

Tabachment 讓 Chrome 直接顯示 PDF、圖片、文字、影片與音訊附件：
• PDF：用 Chrome 內建的 PDF 檢視器開啟，可以縮放、搜尋、列印、儲存。
• 圖片：PNG、JPG、GIF、WebP、BMP、ICO、AVIF，以原始大小顯示。
• 文字檔：TXT、CSV、JSON、Markdown、XML、記錄檔與程式碼，以純文字顯示；UTF-8 與 Big5 中文都能正確顯示。
• 影片與音訊：MP4、WebM、MOV、OGV、MP3、M4A、WAV、OGG、FLAC、AAC，直接播放。

使用方式
• 點擊附件：在新分頁開啟。
• 按住 Ctrl（Mac 為 ⌘）點擊，或用滑鼠中鍵點擊：在背景分頁開啟。
• 按住 Alt（Mac 為 Option）點擊：使用 Gmail 原本的預覽。
• 附件上的「新分頁」按鈕：即使關閉了點擊開啟功能也能使用。
• 撰寫郵件時已上傳的附件，也能點擊在新分頁開啟。
• Word、Excel、PowerPoint、ZIP、HTML 等 Chrome 無法直接顯示的檔案，維持 Gmail 原本的預覽。

設定
可以選擇要在新分頁開啟的檔案類型、是否在背景開啟，以及是否顯示「新分頁」按鈕。

隱私
Tabachment 完全在你的瀏覽器中運作：不收集、不傳送、不儲存任何郵件內容或個人資料，也沒有任何分析追蹤。它只在 mail.google.com 上運作，而且只調整它自己開啟的附件分頁：把 Gmail 回應中的「下載」改為「在分頁中顯示」，並只限 PDF、圖片、影音與純文字這類不會執行程式的格式。

原始碼：https://github.com/NariakiShipo/tabachment

Gmail 是 Google LLC 的商標。Tabachment 與 Google 無關，也未獲 Google 背書。
```

## Detailed description — English

```text
Click an attachment in Gmail™ and it opens right away in a new tab: no preview pop-up, no download first.

Tabachment lets Chrome display PDF, image, text, video and audio attachments itself:
• PDFs open in Chrome's built-in PDF viewer: zoom, search, print and save as usual.
• Images: PNG, JPG, GIF, WebP, BMP, ICO and AVIF, at full size.
• Text files: TXT, CSV, JSON, Markdown, XML, logs and source code, shown as plain text, including UTF-8 and legacy encodings such as Big5.
• Video and audio: MP4, WebM, MOV, OGV, MP3, M4A, WAV, OGG, FLAC and AAC play directly.

How to use
• Click an attachment: it opens in a new tab.
• Ctrl-click (⌘-click on a Mac) or middle-click: open it in a background tab.
• Alt-click (Option-click on a Mac): use Gmail's own preview.
• The "New tab" button on each attachment works even when click-to-open is turned off.
• Files you attached while writing an email open the same way.
• Files Chrome cannot display (Word, Excel, PowerPoint, ZIP, HTML, …) keep Gmail's preview.

Settings
Choose which file types open in a tab, whether tabs open in the background, and whether to show the "New tab" button.

Privacy
Tabachment runs entirely in your browser. It collects, sends and stores no email content or personal data, and contains no analytics. It only runs on mail.google.com and only changes the tabs it opens itself: there it tells Chrome to display the attachment instead of downloading it, and only for formats that cannot run code (PDF, images, audio, video, plain text).

Source code: https://github.com/NariakiShipo/tabachment

Gmail is a trademark of Google LLC. Tabachment is not affiliated with or endorsed by Google.
```
