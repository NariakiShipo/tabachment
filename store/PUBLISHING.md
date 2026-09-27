# 上架到 Chrome 線上應用程式商店（Chrome Web Store）

這份指南帶你把 Tabachment 交給 Google 審查並公開上架。送出審查需要你自己的 Google 帳戶、一次性的註冊費與在網頁上填表，這些無法由程式代勞；其餘需要的檔案都已經在這個專案裡準備好了：

| 需要的東西 | 位置 |
| --- | --- |
| 上傳用的 ZIP 套件 | 執行 `npm run build` 後產生 `dist/tabachment-1.0.0.zip` |
| 商店說明文字（繁中／英文） | [`store/listing.md`](listing.md) |
| 隱私權分頁的答案 | [`store/privacy-practices.md`](privacy-practices.md) |
| 隱私權政策 | [`PRIVACY.md`](../PRIVACY.md) |
| 圖示、截圖、宣傳圖塊 | [`store/images/`](images/) |

---

## 步驟 0：先在真正的 Gmail 上測試（很重要）

自動化測試使用的是模擬 Gmail，所以上架前請務必在你自己的 Gmail 上確認一次：

1. 在 Chrome 網址列輸入 `chrome://extensions`，開啟右上角的「**開發人員模式**」。
2. 點「**載入未封裝項目**」，選擇本專案的 `extension` 資料夾。
3. 打開（或重新整理）Gmail，找一封有附件的郵件，逐項確認：
   - [ ] 點擊 **PDF** 附件 → 新分頁用 Chrome 的 PDF 檢視器顯示，而不是下載。
   - [ ] 點擊 **圖片** 附件 → 新分頁顯示圖片。
   - [ ] 點擊 **.txt 或 .csv** 附件 → 新分頁顯示文字，中文沒有亂碼。
   - [ ] 點擊 **Word／Excel／ZIP** 附件 → 仍是 Gmail 原本的預覽。
   - [ ] 滑鼠移到附件上 → 左上角出現「↗ 新分頁」按鈕。
   - [ ] **Alt**（Mac 為 Option）＋點擊 → Gmail 原本的預覽。
   - [ ] 附件上的 Gmail 按鈕（下載、儲存到雲端硬碟）仍然正常。
   - [ ] 撰寫新郵件並夾帶 PDF，點擊附件名稱 → 在新分頁開啟。
4. 如果某一項不正常（例如 Gmail 改版了），請把狀況回報給開發者，修正後再上架。

## 步驟 1：註冊開發人員帳戶（只需一次）

1. 用要發布的 Google 帳戶開啟 **Chrome 線上應用程式商店開發人員資訊主頁**：<https://chrome.google.com/webstore/devconsole>
2. 這個帳戶必須已開啟 **兩步驟驗證**（Google 帳戶 › 安全性）。
3. 同意開發人員協議，支付一次性的註冊費 **US$5**。
4. 在「帳戶」設定中填寫發布者名稱、驗證聯絡用電子郵件。
5. 依畫面要求聲明「交易者／非交易者」身分（歐盟法規）。免費的個人作品通常選「非交易者」；若不確定，依畫面說明判斷。

## 步驟 2：產生 ZIP 套件

在專案根目錄執行：

```bash
npm install      # 第一次才需要
npm test         # 確認單元測試全部通過
npm run build    # 產生 dist/tabachment-1.0.0.zip
```

沒有安裝 Node.js 也可以：把 **`extension` 資料夾裡面的所有檔案**壓縮成 ZIP（`manifest.json` 必須在 ZIP 的最上層，而不是在 `extension/` 子資料夾裡）。

## 步驟 3：新增項目並上傳

在開發人員資訊主頁點「**新增項目**」（New item），上傳 `dist/tabachment-1.0.0.zip`。

## 步驟 4：商店資訊（Store listing）

依照 [`store/listing.md`](listing.md) 填寫：

- **說明**：貼上英文的詳細說明；再把語言切換到「中文 (繁體)」貼上中文說明。
- **類別**：生產力 › 通訊。
- **圖片**：商店圖示用 `icon-128.png`；截圖上傳三張 `screenshot-*.png`（英文頁用 `-en`，繁中頁用 `-zh_TW`）；小型宣傳圖塊 `promo-small-440x280-*.png`；大型宣傳圖塊可省略或上傳 `promo-marquee-1400x560-*.png`。
- **網址**：首頁 `https://github.com/NariakiShipo/tabachment`，支援 `https://github.com/NariakiShipo/tabachment/issues`。

> 建議：截圖是示意圖。等上架後有空時，可以用你自己的 Gmail 實際畫面截一張 1280×800 的圖替換第一張，會更有說服力（記得先遮掉郵件中的個人資料）。

## 步驟 5：隱私權（Privacy）

依照 [`store/privacy-practices.md`](privacy-practices.md) 逐欄貼上：單一用途、每個權限的理由、「未使用遠端程式碼」、資料使用（全部不勾選＋三項聲明），以及隱私權政策網址。

隱私權政策網址 `https://github.com/NariakiShipo/tabachment/blob/main/PRIVACY.md` 需要先把這個分支合併到 `main`（本專案是公開儲存庫，合併後任何人都能開啟）。

## 步驟 6：發布設定（Distribution）

- **付費**：免費。
- **瀏覽權限**：「公開」；若想先給朋友試用，可選「不公開」（只有拿到連結的人能安裝）。
- **地區**：所有地區。

## 步驟 7：送出審查

1. 若資訊主頁有「**測試說明**」（Test instructions）欄位，可以填：

   ```text
   Sign in to any Gmail account and open an email that has a PDF or image attachment. Click the attachment: it opens in a new tab and is displayed by Chrome instead of Gmail's preview. Alt-click keeps Gmail's preview. Settings: click the extension's toolbar icon.
   ```

2. 點「**提交審查**」（Submit for review）。可以選擇審查通過後自動發布，或之後手動發布。
3. 審查通常需要幾天，有時會更久；結果會寄到你的電子郵件，也可以在資訊主頁查看狀態。

## 如果審查沒有通過

資訊主頁與電子郵件會說明原因，常見情況與處理方式：

| 退件原因 | 處理 |
| --- | --- |
| 權限說明不足 | 對照 `privacy-practices.md` 補充說明後重新提交。Tabachment 只要求必要的權限，且只作用於 Gmail。 |
| 名稱使用了「Gmail」 | 名稱只是描述用途並附上商標聲明；若仍被要求修改，改掉各語系 `extension/_locales/*/messages.json` 裡的 `extName`（例如「Tabachment – Open email attachments in a new tab」），更新版本號後重新上傳。 |
| 功能無法運作 | 通常是 Gmail 改版造成，請回報問題並附上截圖。 |

## 之後發布新版本

1. 修改程式後，同時更新 `extension/manifest.json` 與 `package.json` 的 `version`（例如 `1.0.1`；單元測試會檢查兩者一致）。
2. `npm test`，再 `npm run build`。
3. 在資訊主頁該項目的「**套件**」（Package）分頁上傳新的 ZIP，然後再次提交審查。已安裝的使用者會自動更新。

## 重新產生圖片

圖示與商店圖片的來源在 `store/assets-src/`，修改後執行：

```bash
npx playwright install chromium   # 第一次才需要
npm run assets
```
