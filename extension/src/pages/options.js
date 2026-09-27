/* Tabachment — options page. Settings live in chrome.storage.sync under "settings". */
(() => {
  'use strict';

  const T = globalThis.Tabachment;
  const settingInputs = document.querySelectorAll('input[data-setting]');
  const kindInputs = document.querySelectorAll('input[data-kind]');
  const toast = document.getElementById('toast');
  let toastTimer = 0;

  function render(settings) {
    for (const input of settingInputs) input.checked = settings[input.dataset.setting];
    for (const input of kindInputs) input.checked = settings.kinds[input.dataset.kind];
  }

  function readForm() {
    const raw = { kinds: {} };
    for (const input of settingInputs) raw[input.dataset.setting] = input.checked;
    for (const input of kindInputs) raw.kinds[input.dataset.kind] = input.checked;
    return T.normalizeSettings(raw);
  }

  function showToast() {
    toast.textContent = chrome.i18n.getMessage('savedStatus') || 'Saved';
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 1500);
  }

  document.addEventListener('change', (event) => {
    if (!event.target.matches('input[data-setting], input[data-kind]')) return;
    chrome.storage.sync.set({ settings: readForm() }).then(showToast);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.settings) render(T.normalizeSettings(changes.settings.newValue));
  });

  document.getElementById('version').textContent = chrome.runtime.getManifest().version;
  render(T.normalizeSettings());
  chrome.storage.sync.get('settings').then((stored) => render(T.normalizeSettings(stored.settings)));
})();
