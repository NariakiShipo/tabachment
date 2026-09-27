# Tabachment 隱私權政策 / Privacy Policy

生效日期 / Effective date: 2026-09-27

[中文](#中文) · [English](#english)

---

## 中文

Tabachment 是一個 Chrome 擴充功能：在 Gmail 點擊附件時，讓瀏覽器可直接顯示的檔案（PDF、圖片、文字、影片、音訊）在新分頁開啟。

### 我們收集的資料

**沒有。** Tabachment 不收集、不傳送、不販售任何個人資料或郵件內容；沒有伺服器、沒有分析追蹤、沒有廣告。

### 只在你的瀏覽器中處理的資料

- **附件資訊**：當你點擊附件，或 Tabachment 在附件上顯示「新分頁」按鈕時，它會讀取 Gmail 頁面上該附件的檔名、檔案類型與 Gmail 連結，用來判斷能否在新分頁顯示，並開啟分頁。這些資訊只在你的瀏覽器中使用，不會傳送到任何地方。
- **設定**：你的選項（要開啟的檔案類型、是否在背景開啟、是否顯示按鈕）儲存在 `chrome.storage.sync`。如果你開啟了 Chrome 同步，Chrome 會把它同步到你的其他裝置；Tabachment 本身無法存取同步伺服器。
- **分頁記錄**：Tabachment 會暫時記住它開啟的每個分頁顯示哪個附件（`chrome.storage.session`），讓「重新開啟」按鈕可以運作。關閉分頁或瀏覽器時就會刪除。

### 網路連線

Tabachment 本身不發出任何網路請求。它開啟的分頁會直接向 Gmail 載入附件，就像你自己點擊附件連結一樣。

### 權限用途

| 權限 | 用途 |
| --- | --- |
| `mail.google.com` | 在 Gmail 頁面偵測附件點擊、顯示「新分頁」按鈕。 |
| `mail-attachment.googleusercontent.com` | Gmail 從這個網域提供附件檔案；Tabachment 需要在這裡把「下載」改為「在分頁中顯示」。 |
| `declarativeNetRequestWithHostAccess` | 只在 Tabachment 開啟的分頁中，把 Gmail 附件回應的 `Content-Disposition: attachment` 改為 `inline`，並只限 PDF、圖片、影音與純文字這類不會執行程式的格式。分頁關閉時規則即被移除。 |
| `scripting` | 安裝或更新後，把 Tabachment 自己的程式加入已開啟的 Gmail 分頁，讓你不必重新整理 Gmail。 |
| `storage` | 儲存你的設定與上述的分頁記錄。 |

### 政策變更

若本政策有所變更，會更新本頁並修改上方的生效日期。

### 聯絡方式

請在 GitHub 提出問題：<https://github.com/NariakiShipo/tabachment/issues>

---

## English

Tabachment is a Chrome extension that opens Gmail attachments the browser can display (PDF, images, text, video, audio) directly in a new tab when you click them.

### Data we collect

**None.** Tabachment does not collect, transmit or sell any personal data or email content. It has no servers, no analytics and no ads.

### Data processed only in your browser

- **Attachment details**: when you click an attachment, or when Tabachment shows its "New tab" button on one, it reads that attachment's file name, file type and Gmail link from the Gmail page to decide whether the file can be shown in a tab and to open the tab. This information is used only inside your browser and is never sent anywhere.
- **Settings**: your options (file types to open, background tabs, button visibility) are stored with `chrome.storage.sync`. If Chrome sync is turned on, Chrome syncs them to your other devices; Tabachment itself has no access to the sync servers.
- **Tab records**: Tabachment briefly remembers which attachment each of its tabs shows (`chrome.storage.session`) so that the "Open again" button works. Records are deleted when the tab or the browser closes.

### Network connections

Tabachment makes no network requests of its own. The tabs it opens load the attachment directly from Gmail, exactly as if you had clicked the attachment link yourself.

### Permissions

| Permission | Why |
| --- | --- |
| `mail.google.com` | Detect clicks on attachments in Gmail and show the "New tab" button. |
| `mail-attachment.googleusercontent.com` | Gmail serves attachment files from this host; Tabachment must switch "download" to "display" here. |
| `declarativeNetRequestWithHostAccess` | In the tabs Tabachment opens, and only there, change `Content-Disposition: attachment` on Gmail attachment responses to `inline`, only for formats that cannot run code (PDF, images, audio, video, plain text). The rules are removed when the tab closes. |
| `scripting` | After installation or an update, add Tabachment's own scripts to Gmail tabs that are already open, so Gmail does not need to be reloaded. |
| `storage` | Store your settings and the tab records described above. |

### Changes to this policy

If this policy changes, this page will be updated and the effective date above changed.

### Contact

Please open an issue on GitHub: <https://github.com/NariakiShipo/tabachment/issues>
