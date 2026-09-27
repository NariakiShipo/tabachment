// Replaces the text of every element with a data-i18n attribute by the message
// of that name from _locales/<lang>/messages.json.
(() => {
  'use strict';
  for (const element of document.querySelectorAll('[data-i18n]')) {
    const text = chrome.i18n.getMessage(element.dataset.i18n);
    if (text) element.textContent = text;
  }
  document.documentElement.lang = chrome.i18n.getUILanguage();
})();
