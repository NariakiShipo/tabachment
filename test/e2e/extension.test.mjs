/*
 * End-to-end tests: loads the unpacked extension into Chromium and drives the
 * fake Gmail from fake-gmail.mjs.
 *
 *   npm run test:e2e          (HEADED=1 to watch the browser)
 *
 * Needs a Chromium build with extension support: `npx playwright install chromium`.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import { chromium } from 'playwright';
import { extensionDir } from '../helpers/load-shared.mjs';
import { FILES, hasOpenSsl, startFakeGmail } from './fake-gmail.mjs';

const GMAIL_URL = 'https://mail.google.com/mail/u/0/#inbox';
const ATTACHMENT_PAGE = /^https:\/\/mail-attachment\.googleusercontent\.com\/attachment\//;
const DEFAULT_SETTINGS = {
  interceptClicks: true,
  showButton: true,
  openInBackground: false,
  kinds: { pdf: true, image: true, text: true, video: true, audio: true },
};

async function launch(server, userDataDir, lang = 'en-US') {
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: !process.env.HEADED,
    acceptDownloads: true,
    ignoreHTTPSErrors: true,
    locale: lang,
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
      '--no-proxy-server',
      '--ignore-certificate-errors',
      `--host-resolver-rules=MAP mail.google.com:443 127.0.0.1:${server.port},` +
        `MAP mail-attachment.googleusercontent.com:443 127.0.0.1:${server.port}`,
      `--lang=${lang}`,
    ],
  });
  const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  return { context, worker, extensionId: new URL(worker.url()).host };
}

describe('Tabachment in Chromium', { skip: !hasOpenSsl() && 'openssl is needed to create a test certificate' }, () => {
  let server;
  let userDataDir;
  let context;
  let worker;
  let extensionId;
  let gmail;

  before(async () => {
    server = await startFakeGmail();
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tabachment-profile-'));
    ({ context, worker, extensionId } = await launch(server, userDataDir));
    gmail = context.pages()[0] || (await context.newPage());
    await gmail.goto(GMAIL_URL);
    await gmail.waitForSelector('#card-pdf .tabachment-open', { state: 'attached' });
  });

  after(async () => {
    await context?.close();
    await server?.close();
    if (userDataDir) fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await setSettings({});
    await gmail.bringToFront();
    await gmail.evaluate(() => window.gmailEvents.splice(0));
  });

  afterEach(async () => {
    for (const page of context.pages()) if (page !== gmail) await page.close();
  });

  // --- helpers ---------------------------------------------------------------

  async function setSettings(partial) {
    const settings = { ...DEFAULT_SETTINGS, ...partial, kinds: { ...DEFAULT_SETTINGS.kinds, ...partial.kinds } };
    await worker.evaluate((value) => chrome.storage.sync.set({ settings: value }), settings);
    // The content script picks the change up through storage.onChanged.
    await gmail.waitForTimeout(150);
  }

  /** Runs `action` and returns the tab it opens. */
  async function newTabFrom(action) {
    const opened = context.waitForEvent('page', { timeout: 5000 });
    await action();
    return opened;
  }

  /** Runs `action` and asserts that it opens no tab. */
  async function noNewTab(action) {
    let opened = false;
    const listener = () => (opened = true);
    context.on('page', listener);
    await action();
    await gmail.waitForTimeout(700);
    context.off('page', listener);
    assert.equal(opened, false, 'a tab was opened');
  }

  async function shownFile(page) {
    await page.waitForURL(ATTACHMENT_PAGE, { timeout: 10_000 });
    await page.waitForLoadState('load');
    return page.evaluate(() => ({
      contentType: document.contentType,
      pdfViewer: Boolean(document.querySelector('embed[type="application/pdf"]')),
      imageWidth: document.querySelector('img') ? document.querySelector('img').naturalWidth : 0,
      text: document.body ? document.body.innerText.trim() : '',
      historyLength: history.length,
    }));
  }

  const gmailEvents = () => gmail.evaluate(() => window.gmailEvents.splice(0));
  const sessionRules = () => worker.evaluate(() => chrome.declarativeNetRequest.getSessionRules());
  const tabs = () => worker.evaluate(() => chrome.tabs.query({}));

  // --- tests -----------------------------------------------------------------

  test('adds a "New tab" button to viewable attachments only', async () => {
    const withButton = await gmail.$$eval('span.aZo', (cards) =>
      cards.filter((card) => card.querySelector(':scope > .tabachment-open')).map((card) => card.id),
    );
    assert.deepEqual(withButton, [
      'card-pdf',
      'card-octet',
      'card-png',
      'card-csv',
      'card-csv-sandbox',
      'card-big5',
      'card-json',
      'card-evil', // named .pdf; the server's HTML type is refused later (see below)
    ]);
    assert.equal(await gmail.textContent('#card-pdf .tabachment-open'), 'New tab');
  });

  test('clicking a PDF opens it in a new tab next to Gmail, displayed instead of downloaded', async () => {
    const tab = await newTabFrom(() => gmail.click('#card-pdf .aV3'));
    let downloaded = false;
    tab.on('download', () => (downloaded = true));
    const shown = await shownFile(tab);
    assert.equal(shown.contentType, 'application/pdf');
    assert.ok(shown.pdfViewer, 'Chrome PDF viewer');
    assert.equal(downloaded, false);
    assert.deepEqual(await gmailEvents(), [], "Gmail's preview must not see the click");

    const all = await tabs();
    const gmailTab = all.find((t) => t.url === GMAIL_URL);
    const fileTab = all.find((t) => ATTACHMENT_PAGE.test(t.url || ''));
    assert.equal(fileTab.active, true);
    assert.equal(fileTab.index, gmailTab.index + 1);
    assert.equal(fileTab.openerTabId, gmailTab.id);
  });

  test('reloading the tab keeps showing the file', async () => {
    const tab = await newTabFrom(() => gmail.click('#card-pdf .aV3'));
    await shownFile(tab);
    await tab.reload();
    assert.equal((await shownFile(tab)).contentType, 'application/pdf');
  });

  test('the display rules only apply to that tab and are removed when it closes', async () => {
    const tab = await newTabFrom(() => gmail.click('#card-pdf .aV3'));
    await shownFile(tab);
    const fileTab = (await tabs()).find((t) => ATTACHMENT_PAGE.test(t.url || ''));
    const rules = await sessionRules();
    assert.ok(rules.length >= 2);
    assert.ok(rules.every((rule) => rule.condition.tabIds.length === 1 && rule.condition.tabIds[0] === fileTab.id));

    // The same URL in any other tab is still downloaded, as without the extension.
    const other = await context.newPage();
    const download = other.waitForEvent('download');
    await other.goto(tab.url()).catch(() => {});
    await (await download).cancel();

    await tab.close();
    for (let i = 0; i < 20 && (await sessionRules()).length; i++) await gmail.waitForTimeout(100);
    assert.deepEqual(await sessionRules(), []);
  });

  test('a PDF sent as application/octet-stream opens too', async () => {
    const tab = await newTabFrom(() => gmail.click('#card-octet .aV3'));
    const shown = await shownFile(tab);
    assert.equal(shown.contentType, 'application/pdf');
    assert.ok(shown.pdfViewer);
  });

  test('images open in a new tab', async () => {
    const tab = await newTabFrom(() => gmail.click('#card-png .aV3'));
    const shown = await shownFile(tab);
    assert.equal(shown.contentType, 'image/png');
    assert.equal(shown.imageWidth, 40);
  });

  test('a UTF-8 CSV served without a charset is readable', async () => {
    const tab = await newTabFrom(() => gmail.click('#card-csv .aV3'));
    const shown = await shownFile(tab);
    assert.equal(shown.contentType, 'text/plain');
    assert.match(shown.text, /王小明,台北市/);
  });

  test('a UTF-8 CSV behind a sandbox CSP is readable', async () => {
    const tab = await newTabFrom(() => gmail.click('#card-csv-sandbox .aV3'));
    const shown = await shownFile(tab);
    assert.equal(shown.contentType, 'text/plain');
    assert.match(shown.text, /王小明,台北市/);
  });

  test('Big5 text keeps its charset', async () => {
    const tab = await newTabFrom(() => gmail.click('#card-big5 .aV3'));
    const shown = await shownFile(tab);
    assert.equal(shown.contentType, 'text/plain');
    assert.match(shown.text, /陳美麗,高雄市/);
  });

  test('JSON is shown as UTF-8 text', async () => {
    const tab = await newTabFrom(() => gmail.click('#card-json .aV3'));
    const shown = await shownFile(tab);
    assert.equal(shown.contentType, 'text/plain');
    assert.equal(shown.text, '{"城市":"台北市"}');
  });

  test('formats Chrome cannot display keep Gmail’s behavior', async () => {
    await noNewTab(() => gmail.click('#card-docx .aV3'));
    assert.deepEqual(await gmailEvents(), ['mousedown:card-docx', 'mouseup:card-docx', 'click:card-docx']);
  });

  test('an HTML file disguised as a PDF is never rendered', async () => {
    const tab = await newTabFrom(() => gmail.click('#card-evil .aV3'));
    const download = await tab.waitForEvent('download', { timeout: 10_000 });
    await download.cancel();
    assert.equal(download.suggestedFilename(), 'invoice.pdf');
    await tab.waitForTimeout(300);
    assert.match(tab.url(), /^chrome-extension:\/\/[a-z]+\/src\/pages\/opening\.html#name=invoice\.pdf$/);
    for (const page of context.pages()) assert.notEqual(await page.title(), 'PWNED');
  });

  test('if the display rules cannot be added, the file downloads instead (fail closed)', async () => {
    await worker.evaluate(() => {
      self.realUpdateSessionRules = chrome.declarativeNetRequest.updateSessionRules;
      chrome.declarativeNetRequest.updateSessionRules = () => Promise.reject(new Error('Simulated quota error'));
    });
    try {
      for (const card of ['#card-pdf', '#card-evil']) {
        await gmail.bringToFront();
        const tab = await newTabFrom(() => gmail.click(`${card} .aV3`));
        const download = await tab.waitForEvent('download', { timeout: 10_000 });
        await download.cancel();
        assert.match(tab.url(), /opening\.html/, `${card} must not be displayed`);
      }
      for (const page of context.pages()) assert.notEqual(await page.title(), 'PWNED');
    } finally {
      await worker.evaluate(() => {
        chrome.declarativeNetRequest.updateSessionRules = self.realUpdateSessionRules;
      });
    }
  });

  test('Alt-click keeps Gmail’s preview', async () => {
    await noNewTab(() => gmail.click('#card-pdf .aV3', { modifiers: ['Alt'] }));
    assert.ok((await gmailEvents()).includes('click:card-pdf'));
  });

  test('Gmail’s own buttons on a card keep working', async () => {
    await noNewTab(() => gmail.click('#card-pdf [data-action="download"]'));
    assert.ok((await gmailEvents()).includes('click:card-pdf:download'));
  });

  test('Ctrl-click and middle-click open a background tab', async () => {
    for (const options of [{ modifiers: ['ControlOrMeta'] }, { button: 'middle' }]) {
      const tab = await newTabFrom(() => gmail.click('#card-png .aV3', options));
      await shownFile(tab);
      const all = await tabs();
      assert.equal(all.find((t) => t.url === GMAIL_URL).active, true, JSON.stringify(options));
      assert.equal(all.find((t) => ATTACHMENT_PAGE.test(t.url || '')).active, false);
      await tab.close();
    }
    assert.deepEqual(await gmailEvents(), []);
  });

  test('a double-click opens a single tab', async () => {
    let opened = 0;
    const count = () => opened++;
    context.on('page', count);
    await gmail.dblclick('#card-png .aV3');
    await gmail.waitForTimeout(1000);
    context.off('page', count);
    assert.equal(opened, 1);
    assert.deepEqual(await gmailEvents(), []);
  });

  test('the "Open in the background" setting', async () => {
    await setSettings({ openInBackground: true });
    const tab = await newTabFrom(() => gmail.click('#card-png .aV3'));
    await shownFile(tab);
    assert.equal((await tabs()).find((t) => t.url === GMAIL_URL).active, true);
  });

  test('pressing Enter on a focused attachment opens it', async () => {
    await gmail.focus('#card-png a');
    const tab = await newTabFrom(() => gmail.keyboard.press('Enter'));
    assert.equal((await shownFile(tab)).contentType, 'image/png');
    assert.deepEqual(await gmailEvents(), []);
  });

  test('the button still works when click interception is off', async () => {
    await setSettings({ interceptClicks: false });
    await noNewTab(() => gmail.click('#card-pdf .aV3'));
    assert.ok((await gmailEvents()).includes('click:card-pdf'));

    await gmail.hover('#card-pdf');
    const tab = await newTabFrom(() => gmail.click('#card-pdf .tabachment-open'));
    assert.equal((await shownFile(tab)).contentType, 'application/pdf');
    assert.deepEqual(await gmailEvents(), []);
  });

  test('turning a file type off leaves it to Gmail', async () => {
    await setSettings({ kinds: { pdf: false } });
    await gmail.waitForSelector('#card-pdf .tabachment-open', { state: 'detached' });
    await noNewTab(() => gmail.click('#card-pdf .aV3'));
    assert.ok((await gmailEvents()).includes('click:card-pdf'));
    await setSettings({});
    await gmail.waitForSelector('#card-pdf .tabachment-open', { state: 'attached' });
  });

  test('turning the button off removes it', async () => {
    await setSettings({ showButton: false });
    await gmail.waitForSelector('.tabachment-open', { state: 'detached' });
    await setSettings({});
    await gmail.waitForSelector('#card-pdf .tabachment-open', { state: 'attached' });
  });

  test('attachments in the compose window open too', async () => {
    const tab = await newTabFrom(() => gmail.click('#compose-chip .vI'));
    const shown = await shownFile(tab);
    assert.equal(shown.contentType, 'text/plain');
    assert.equal(shown.text, 'Draft notes from the compose window');
    await noNewTab(() => gmail.click('#compose-chip [role="button"]'));
  });

  test('attachments that appear later are handled', async () => {
    await gmail.evaluate(() => window.addCard('card-late', 'f_late', 'image/png', 'late.png'));
    await gmail.waitForSelector('#card-late .tabachment-open', { state: 'attached' });
    const tab = await newTabFrom(() => gmail.click('#card-late .aV3'));
    assert.equal((await shownFile(tab)).imageWidth, 20);
  });

  test('injecting the script again (as after an update) leaves one working copy', async () => {
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: 'https://mail.google.com/*' });
      const script = chrome.runtime.getManifest().content_scripts[0];
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: script.css });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: script.js });
    });
    // The previous copy removed its buttons when it stopped; the new one adds them back.
    await gmail.waitForSelector('#card-png .tabachment-open', { state: 'attached' });
    const buttons = await gmail.$$eval('span.aZo', (cards) =>
      cards.map((card) => card.querySelectorAll(':scope > .tabachment-open').length),
    );
    assert.ok(buttons.every((count) => count <= 1), JSON.stringify(buttons));

    let opened = 0;
    const count = () => opened++;
    context.on('page', count);
    await gmail.click('#card-png .aV3');
    await gmail.waitForTimeout(1000);
    context.off('page', count);
    assert.equal(opened, 1);
    assert.deepEqual(await gmailEvents(), []);
  });

  test('Back returns to a page that can open the file again', async () => {
    const tab = await newTabFrom(() => gmail.click('#card-pdf .aV3'));
    const shown = await shownFile(tab);
    assert.equal(shown.historyLength, 2);
    await tab.goBack();
    assert.match(tab.url(), /opening\.html#name=report/);
    assert.equal(await tab.textContent('#filename'), FILES.f_pdf.name);
    await tab.click('#reopen');
    assert.equal((await shownFile(tab)).contentType, 'application/pdf');
  });

  test('the options page saves settings', async () => {
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/src/pages/options.html`);
    assert.equal(await options.title(), 'Tabachment settings');
    assert.equal(await options.isChecked('[data-setting="interceptClicks"]'), true);
    await options.click('label:has([data-setting="openInBackground"])');
    await options.click('label:has([data-kind="audio"])');
    await options.waitForSelector('#toast.visible');
    const stored = await worker.evaluate(() => chrome.storage.sync.get('settings'));
    assert.equal(stored.settings.openInBackground, true);
    assert.equal(stored.settings.kinds.audio, false);
    await options.reload();
    assert.equal(await options.isChecked('[data-setting="openInBackground"]'), true);
    assert.equal(await options.isChecked('[data-kind="audio"]'), false);
  });

  // Runs last: covers every attachment request made by the tests above.
  test('never asks Gmail for inline display', () => {
    const attachmentRequests = server.requests.filter((request) => request.includes('view=att'));
    assert.ok(attachmentRequests.length > 10);
    assert.deepEqual(attachmentRequests.filter((request) => /[?&]disp=inline(&|$)/.test(request)), []);
  });
});

describe('Tabachment in Traditional Chinese', { skip: !hasOpenSsl() && 'openssl is needed' }, () => {
  test('uses the zh_TW translations', async () => {
    const server = await startFakeGmail();
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tabachment-profile-'));
    const { context, extensionId } = await launch(server, userDataDir, 'zh-TW');
    try {
      const gmail = context.pages()[0] || (await context.newPage());
      await gmail.goto(GMAIL_URL);
      await gmail.waitForSelector('#card-pdf .tabachment-open', { state: 'attached' });
      assert.equal(await gmail.textContent('#card-pdf .tabachment-open'), '新分頁');
      const options = await context.newPage();
      await options.goto(`chrome-extension://${extensionId}/src/pages/options.html`);
      assert.equal(await options.title(), 'Tabachment 設定');
    } finally {
      await context.close();
      await server.close();
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});
