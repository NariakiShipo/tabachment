// Text for the store images. Pick the language with ?lang=en or ?lang=zh_TW.
const STRINGS = {
  en: {
    tagline: 'Gmail attachments in a new tab',
    promoSub: 'PDF · images · text · audio · video',
    clickTitle: 'Click an attachment. It opens in a new tab.',
    clickSub: 'No preview pop-up, no download: Chrome shows the file right away.',
    sender: 'Wang Hsiao-ming',
    initial: 'W',
    subject: 'Q3 report and data',
    inbox: 'Inbox',
    pdfName: 'Q3 report.pdf',
    newTab: 'New tab',
    formatsTitle: 'PDFs, images, text, audio and video',
    formatsSub: 'Shown by Chrome itself, in a tab of their own.',
    pdf: 'PDF',
    images: 'Images',
    text: 'Text',
    video: 'Video',
    audio: 'Audio',
    textNote: 'UTF-8 and Big5 both display correctly',
    otherFiles: 'Word, Excel, ZIP… keep Gmail’s preview',
    altClick: 'Alt-click: use Gmail’s preview',
    ctrlClick: 'Ctrl/⌘-click or middle-click: background tab',
    optionsTitle: 'Works the way you like',
    optionsPoints: [
      'Choose which file types open in a tab',
      'Open in the background and stay in Gmail',
      'Show or hide the “New tab” button',
    ],
    privacy: 'Runs only in your browser. Collects no data.',
  },
  zh_TW: {
    tagline: 'Gmail 附件，直接在新分頁開啟',
    promoSub: 'PDF · 圖片 · 文字 · 影片 · 音訊',
    clickTitle: '點一下附件，直接在新分頁開啟',
    clickSub: '不跳出預覽視窗、不用下載，Chrome 立即顯示檔案內容。',
    sender: '王小明',
    initial: '王',
    subject: 'Q3 報告與資料',
    inbox: '收件匣',
    pdfName: 'Q3 報告.pdf',
    newTab: '新分頁',
    formatsTitle: 'PDF、圖片、文字、影片、音訊',
    formatsSub: '由 Chrome 直接顯示，每個檔案一個分頁。',
    pdf: 'PDF',
    images: '圖片',
    text: '文字檔',
    video: '影片',
    audio: '音訊',
    textNote: 'UTF-8 與 Big5 中文都能正確顯示',
    otherFiles: 'Word、Excel、ZIP 等維持 Gmail 預覽',
    altClick: '按住 Alt 點擊：使用 Gmail 預覽',
    ctrlClick: 'Ctrl/⌘ 或中鍵點擊：背景分頁',
    optionsTitle: '依你的習慣調整',
    optionsPoints: ['選擇要在分頁開啟的檔案類型', '在背景開啟，繼續留在 Gmail', '顯示或隱藏「新分頁」按鈕'],
    privacy: '只在你的瀏覽器中運作，不收集任何資料。',
  },
};

const params = new URLSearchParams(location.search);
const lang = STRINGS[params.get('lang')] ? params.get('lang') : 'en';
const t = STRINGS[lang];
document.documentElement.lang = lang.replace('_', '-');

function fillStrings(root = document) {
  for (const element of root.querySelectorAll('[data-t]')) element.textContent = t[element.dataset.t];
}
