# 隱私權分頁（Privacy practices）填寫內容

在開發人員資訊主頁的「隱私權」分頁中填寫。審查人員通常以英文閱讀，所以下列欄位建議直接貼上英文內容；中文說明只是讓你了解每一欄在問什麼。

## 單一用途說明（Single purpose）

> 說明：擴充功能必須只有一個明確用途。

```text
Open Gmail attachments that the browser can display (PDF, images, text, audio and video) directly in a new tab, instead of Gmail's preview overlay or a download.
```

## 權限理由（Permission justification）

> 說明：每個權限一欄，說明為什麼需要。

**declarativeNetRequestWithHostAccess**

```text
Gmail serves attachments with "Content-Disposition: attachment", which makes Chrome download them. For each tab that Tabachment opens, it adds a session rule limited to that one tab and to Gmail's attachment URLs. The rule changes the header to "inline" (and relabels files sent as application/octet-stream with their real type) so that Chrome displays the file. Rules only apply when the response is a passive format (PDF, raster images, audio, video, plain text); HTML and other active content are never changed. The rules are removed when the tab closes. No other requests are touched.
```

**scripting**

```text
Used only right after installation or an update, to add Tabachment's own packaged content script and stylesheet to Gmail tabs that are already open, so the extension works without reloading Gmail. No remote or dynamically generated code is injected.
```

**storage**

```text
chrome.storage.sync keeps the user's settings (which file types open in a tab, background tabs, whether to show the "New tab" button). chrome.storage.session remembers which attachment each Tabachment tab shows, so its "Open again" button works; these records are deleted when the tab or browser closes.
```

**主機權限（Host permissions）**

```text
https://mail.google.com/* — the content script runs in Gmail to detect clicks on attachments and to add the "New tab" button, and the session rules need host access to Gmail's attachment URLs.
https://mail-attachment.googleusercontent.com/* — Gmail redirects attachment downloads to this host; the rule that displays the file inline must apply to its response.
```

## 遠端程式碼（Remote code）

選擇：**No, I am not using remote code**（否，我沒有使用遠端程式碼）。
所有 JavaScript 都包含在上傳的套件中。

## 資料使用（Data usage）

> 說明：勾選你「收集」的使用者資料類型。Tabachment 只在瀏覽器內讀取附件的檔名與連結來開啟分頁，不會傳送到任何地方，因此**全部不勾選**。

- 個人識別資訊、健康資訊、財務與付款資訊、驗證資訊、個人通訊、位置、網路記錄、使用者活動、網站內容：**全部不勾選**

接著勾選下列三項聲明（Tabachment 都符合）：

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

## 隱私權政策網址（Privacy policy URL）

```text
https://github.com/NariakiShipo/tabachment/blob/main/PRIVACY.md
```

（這個網址要等本分支合併到 `main` 之後才會生效；在那之前可以改用
`https://github.com/NariakiShipo/tabachment/blob/claude/magical-edison-iqaomj/PRIVACY.md`。）
