/*
 * Tabachment — service worker.
 *
 * Opens attachments in a new tab. Gmail serves attachments with
 * "Content-Disposition: attachment", which makes Chrome download them, so for
 * every tab it opens Tabachment first adds declarativeNetRequest session rules,
 * limited to that one tab, that switch passive file types to inline display
 * (see buildTabRules in shared/attachments.js). The rules are removed when the
 * tab closes.
 */
importScripts('../shared/attachments.js');

const T = self.Tabachment;
const GMAIL_ORIGIN = 'https://mail.google.com';
const OPENING_PAGE = 'src/pages/opening.html';
const RECORD_PREFIX = 'tab:';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !message) return false;
  let task;
  if (message.type === 'tabachment:open') task = openAttachment(message, sender);
  else if (message.type === 'tabachment:reopen') task = reopenAttachment(sender);
  else return false;
  task.then(
    () => sendResponse({ ok: true }),
    (error) => {
      console.warn('[Tabachment]', error);
      sendResponse({ ok: false, error: String((error && error.message) || error) });
    },
  );
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  forgetTab(tabId);
});
chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  forgetTab(removedTabId);
});
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(() => {
  withRules(pruneRules);
});
chrome.runtime.onInstalled.addListener((details) => {
  withRules(pruneRules);
  if (details.reason === 'install' || details.reason === 'update') injectIntoOpenGmailTabs();
});

async function openAttachment(message, sender) {
  const opener = sender.tab;
  if (!opener || sender.frameId !== 0 || sender.origin !== GMAIL_ORIGIN) throw new Error('Unexpected sender');
  const attachment = T.validateOpenRequest(message);

  const tab = await createTab(
    {
      url: chrome.runtime.getURL(OPENING_PAGE) + '#' + new URLSearchParams({ name: attachment.filename }),
      active: message.background !== true,
    },
    opener,
  );
  await chrome.storage.session.set({ [RECORD_PREFIX + tab.id]: attachment });
  await Promise.all([
    // Without the rules the navigation below is an ordinary Gmail download:
    // nothing is ever displayed without their type checks (fail closed).
    installRules(tab.id, attachment).catch((error) => {
      console.warn('[Tabachment] Could not add display rules; the file will download instead:', error);
    }),
    // Let the placeholder page commit first so that Back always returns to it
    // (it offers "Open again") instead of sometimes to nothing.
    waitForTabLoad(tab.id, 2000),
  ]);
  // attachment.url is Gmail's download URL; only the rules added above can
  // turn its response into inline display. The navigation is browser-
  // initiated, so Gmail sees it exactly like a URL typed into the address bar.
  await chrome.tabs.update(tab.id, { url: attachment.url });
}

function waitForTabLoad(tabId, timeout) {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    };
    const onUpdated = (id, change) => {
      if (id === tabId && change.status === 'complete') done();
    };
    const timer = setTimeout(done, timeout);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.get(tabId).then((tab) => tab.status === 'complete' && done(), done);
  });
}

async function createTab(properties, opener) {
  try {
    return await chrome.tabs.create({
      ...properties,
      index: opener.index + 1,
      openerTabId: opener.id,
      windowId: opener.windowId,
    });
  } catch {
    // The opener is not in a normal window (e.g. a popped-out compose window).
    return chrome.tabs.create(properties);
  }
}

async function reopenAttachment(sender) {
  const tab = sender.tab;
  if (!tab || !sender.url || !sender.url.startsWith(chrome.runtime.getURL(OPENING_PAGE))) {
    throw new Error('Unexpected sender');
  }
  const key = RECORD_PREFIX + tab.id;
  const attachment = (await chrome.storage.session.get(key))[key];
  if (!attachment) throw new Error('Nothing to reopen');
  await installRules(tab.id, attachment);
  await chrome.tabs.update(tab.id, { url: T.toDownloadUrl(attachment.url) });
}

// --- Session rules ------------------------------------------------------------

// Serializes rule updates so that concurrent opens never allocate the same rule ID.
let ruleQueue = Promise.resolve();
function withRules(task) {
  const run = ruleQueue.then(task, task);
  ruleQueue = run.catch((error) => console.warn('[Tabachment]', error));
  return run;
}

function tabsOf(rule) {
  return (rule.condition && rule.condition.tabIds) || [];
}

function installRules(tabId, attachment) {
  return withRules(async () => {
    const existing = await pruneRules();
    const firstId = existing.reduce((max, rule) => Math.max(max, rule.id), 0) + 1;
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: existing.filter((rule) => tabsOf(rule).includes(tabId)).map((rule) => rule.id),
      addRules: T.buildTabRules({ tabId, ...attachment }, firstId),
    });
  });
}

/** Removes rules and records of tabs that no longer exist; returns the remaining rules. */
async function pruneRules() {
  const [rules, tabs, records] = await Promise.all([
    chrome.declarativeNetRequest.getSessionRules(),
    chrome.tabs.query({}),
    chrome.storage.session.get(null),
  ]);
  const alive = new Set(tabs.map((tab) => tab.id));
  const dead = rules.filter((rule) => tabsOf(rule).some((id) => !alive.has(id)));
  if (dead.length) {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: dead.map((rule) => rule.id) });
  }
  const deadRecords = Object.keys(records).filter(
    (key) => key.startsWith(RECORD_PREFIX) && !alive.has(Number(key.slice(RECORD_PREFIX.length))),
  );
  if (deadRecords.length) await chrome.storage.session.remove(deadRecords);
  return rules.filter((rule) => !dead.includes(rule));
}

function forgetTab(tabId) {
  return Promise.all([
    withRules(async () => {
      const rules = await chrome.declarativeNetRequest.getSessionRules();
      const ids = rules.filter((rule) => tabsOf(rule).includes(tabId)).map((rule) => rule.id);
      if (ids.length) await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: ids });
    }),
    chrome.storage.session.remove(RECORD_PREFIX + tabId),
  ]).catch((error) => console.warn('[Tabachment]', error));
}

// --- Install / update ---------------------------------------------------------

// Content scripts only run in pages loaded after installation. Add them to the
// Gmail tabs that are already open so Tabachment works without a reload.
async function injectIntoOpenGmailTabs() {
  const script = chrome.runtime
    .getManifest()
    .content_scripts.find((entry) => entry.js.some((file) => file.endsWith('/gmail.js')));
  const tabs = await chrome.tabs.query({ url: GMAIL_ORIGIN + '/*' });
  for (const tab of tabs) {
    const target = { tabId: tab.id };
    try {
      await chrome.scripting.insertCSS({ target, files: script.css });
      await chrome.scripting.executeScript({ target, files: script.js });
    } catch {
      // Discarded or still-loading tab: it gets the scripts when it (re)loads.
    }
  }
}
