/*
 * Tabachment — placeholder page a new tab shows while the attachment loads.
 * It stays visible only if the file never replaces it (e.g. Chrome downloaded
 * it) or when the user comes back to it with the Back button.
 */
(() => {
  'use strict';

  const name = new URLSearchParams(location.hash.slice(1)).get('name') || '';
  document.getElementById('filename').textContent = name;
  if (name) document.title = name;

  const status = document.getElementById('status');
  const later = document.getElementById('later');
  let timer = 0;

  function showLater() {
    clearTimeout(timer);
    status.hidden = true;
    later.hidden = false;
  }

  function waitForFile() {
    status.hidden = false;
    later.hidden = true;
    clearTimeout(timer);
    timer = setTimeout(showLater, 8000);
  }

  const navigation = performance.getEntriesByType('navigation')[0];
  if (navigation && navigation.type === 'back_forward') showLater();
  else waitForFile();
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) showLater();
  });

  document.getElementById('reopen').addEventListener('click', () => {
    waitForFile();
    chrome.runtime.sendMessage({ type: 'tabachment:reopen' }).then((response) => {
      if (!response || !response.ok) showLater();
    }, showLater);
  });
})();
