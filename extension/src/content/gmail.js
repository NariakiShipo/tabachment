/*
 * Tabachment — Gmail content script.
 *
 * Makes a click on a browser-viewable attachment (PDF, image, text, audio,
 * video) open it in a new tab instead of Gmail's preview overlay, and adds a
 * small "New tab" button to those attachment cards. The tab itself is opened
 * by the service worker, which also makes sure the file is shown inline.
 */
(() => {
  'use strict';

  const T = globalThis.Tabachment;
  if (!T || window.top !== window) return;

  // Gmail's attachment cards; they carry a `download_url` attribute in Chrome.
  // Compose windows show uploaded files as plain links instead.
  const CARD_SELECTOR = 'span.aZo, span[download_url], div[download_url]';
  const BUTTON_CLASS = 'tabachment-open';
  const CARD_ATTRIBUTE = 'data-tabachment';
  const CONTROL_SELECTOR =
    'button, [role="button"], [role="menuitem"], [role="menuitemcheckbox"], [role="checkbox"], ' +
    '[role="switch"], [role="tab"], input, select, textarea';
  const POINTER_EVENTS = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'auxclick', 'dblclick'];

  let settings = T.normalizeSettings();
  let scanQueued = false;
  const observer = new MutationObserver(scheduleScan);

  // --- Reading attachments from the page ------------------------------------

  function attachmentFromCard(card) {
    const parsed = T.parseDownloadUrl(card.getAttribute('download_url'));
    const link = Array.from(card.querySelectorAll('a[href]')).find((a) => T.isGmailAttachmentUrl(a.href));
    const url = link ? link.href : parsed && T.isGmailAttachmentUrl(parsed.url) ? parsed.url : '';
    if (!url) return null; // Google Drive attachments and cards that are still loading.
    const nameElement = card.querySelector('.aV3');
    const filename = (parsed && parsed.filename) || (nameElement ? nameElement.textContent : '');
    return describe(url, filename, parsed ? parsed.mime : '');
  }

  function attachmentFromLink(link) {
    if (!T.isGmailAttachmentUrl(link.href)) return null;
    const nameElement = link.querySelector('.vI');
    const filename =
      link.getAttribute('download') ||
      (nameElement ? nameElement.textContent : link.textContent) ||
      link.getAttribute('aria-label') ||
      link.title;
    return describe(link.href, filename, '');
  }

  function describe(url, rawFilename, declaredMime) {
    const filename = T.cleanFilename(rawFilename);
    const type = T.classify(filename, declaredMime);
    if (!type || !settings.kinds[type.kind]) return null;
    return { url, filename, declaredMime, kind: type.kind };
  }

  function asElement(node) {
    return node instanceof Element ? node : (node && node.parentElement) || null;
  }

  /** Finds the attachment (card or link) an event target belongs to, if Tabachment handles it. */
  function findTarget(element) {
    if (!element || element.isContentEditable) return null;
    const card = element.closest(CARD_SELECTOR);
    if (card) {
      const attachment = attachmentFromCard(card);
      return attachment && { container: card, attachment };
    }
    const link = element.closest('a[href]');
    const attachment = link && attachmentFromLink(link);
    return attachment && { container: link, attachment };
  }

  function isOwnButton(element) {
    return Boolean(element.closest('.' + BUTTON_CLASS));
  }

  /** True for Gmail's own controls on a card (download, save to Drive, ...), which keep working. */
  function isGmailControl(element, container) {
    const control = element.closest(CONTROL_SELECTOR);
    if (!control || control === container || !container.contains(control)) return false;
    const mainLink = container.matches('a[href]') ? container : container.querySelector('a[href]');
    return !(mainLink && (control.contains(mainLink) || mainLink.contains(control)));
  }

  // --- Intercepting clicks --------------------------------------------------

  // Listeners run on window in the capture phase, before any of Gmail's own
  // handlers, so a handled click never reaches Gmail's preview code.
  function onPointerEvent(event) {
    if (!event.isTrusted || (event.button !== 0 && event.button !== 1)) return;
    if (!extensionAlive()) return teardown();
    const element = asElement(event.target);
    const hit = findTarget(element);
    if (!hit) return;
    if (!isOwnButton(element) && (!settings.interceptClicks || event.altKey || isGmailControl(element, hit.container))) {
      return;
    }

    event.stopImmediatePropagation();
    // Keep the primary button's default mousedown (focus, drag-and-drop to the
    // desktop); cancel link navigation and the middle button's autoscroll.
    if (event.type === 'click' || event.type === 'auxclick' || event.type === 'dblclick' || event.button === 1) {
      event.preventDefault();
    }
    const opens = (event.type === 'click' && event.button === 0) || (event.type === 'auxclick' && event.button === 1);
    // event.detail counts clicks: the second click of a double-click opens nothing.
    if (opens && event.detail <= 1) {
      const newTabGesture = event.button === 1 || event.ctrlKey || event.metaKey;
      open(hit.attachment, newTabGesture ? !event.shiftKey : settings.openInBackground);
    }
  }

  function onKeyDown(event) {
    if (!event.isTrusted || event.key !== 'Enter' || event.repeat || event.altKey || event.isComposing) return;
    if (!extensionAlive()) return teardown();
    const element = asElement(event.target);
    // Our own <button> turns Enter into a click event, handled above.
    if (!element || isOwnButton(element)) return;
    const hit = findTarget(element);
    if (!hit || !settings.interceptClicks || isGmailControl(element, hit.container)) return;
    event.stopImmediatePropagation();
    event.preventDefault();
    open(hit.attachment, event.ctrlKey || event.metaKey ? !event.shiftKey : settings.openInBackground);
  }

  function open(attachment, background) {
    const message = {
      type: 'tabachment:open',
      url: attachment.url,
      filename: attachment.filename,
      declaredMime: attachment.declaredMime,
      background,
    };
    const fallback = () => window.open(T.toInlineUrl(attachment.url), '_blank', 'noopener');
    try {
      chrome.runtime.sendMessage(message).then((response) => {
        if (!response || !response.ok) console.warn('[Tabachment] Could not open the attachment:', response && response.error);
      }, fallback);
    } catch {
      fallback();
    }
  }

  // --- "New tab" buttons on attachment cards ----------------------------------

  function scheduleScan() {
    if (scanQueued) return;
    scanQueued = true;
    setTimeout(() => {
      scanQueued = false;
      scan();
    }, 50);
  }

  function scan() {
    if (!extensionAlive()) return teardown();
    for (const card of document.querySelectorAll(CARD_SELECTOR)) syncCard(card);
  }

  function syncCard(card) {
    const attachment = settings.showButton ? attachmentFromCard(card) : null;
    const button = card.querySelector(':scope > .' + BUTTON_CLASS);
    if (!attachment) {
      if (button) button.remove();
      if (card.hasAttribute(CARD_ATTRIBUTE)) card.removeAttribute(CARD_ATTRIBUTE);
      return;
    }
    if (card.getAttribute(CARD_ATTRIBUTE) !== attachment.kind) card.setAttribute(CARD_ATTRIBUTE, attachment.kind);
    if (button) return;
    if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
    card.appendChild(createButton());
  }

  function createButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = BUTTON_CLASS;
    button.title = message('cardButtonTitle', 'Open in a new tab');
    button.setAttribute('aria-label', button.title);
    const label = document.createElement('span');
    label.textContent = message('cardButtonLabel', 'New tab');
    button.append(createIcon(), label);
    return button;
  }

  function createIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5']) {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
    }
    return svg;
  }

  function message(key, fallback) {
    try {
      return chrome.i18n.getMessage(key) || fallback;
    } catch {
      return fallback;
    }
  }

  // --- Lifecycle ------------------------------------------------------------

  // After the extension is updated or reloaded this script is orphaned; it then
  // steps aside so Gmail works normally until the page is reloaded.
  function extensionAlive() {
    try {
      return Boolean(chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  }

  function teardown() {
    observer.disconnect();
    for (const type of POINTER_EVENTS) window.removeEventListener(type, onPointerEvent, true);
    window.removeEventListener('keydown', onKeyDown, true);
    for (const button of document.querySelectorAll('.' + BUTTON_CLASS)) button.remove();
    for (const card of document.querySelectorAll('[' + CARD_ATTRIBUTE + ']')) card.removeAttribute(CARD_ATTRIBUTE);
  }

  for (const type of POINTER_EVENTS) window.addEventListener(type, onPointerEvent, true);
  window.addEventListener('keydown', onKeyDown, true);
  observer.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['download_url', 'href'] });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes.settings) return;
    settings = T.normalizeSettings(changes.settings.newValue);
    scheduleScan();
  });
  chrome.storage.sync.get('settings').then(
    (stored) => {
      settings = T.normalizeSettings(stored.settings);
      scheduleScan();
    },
    () => {},
  );
})();
