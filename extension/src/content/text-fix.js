/*
 * Tabachment — fixes UTF-8 text attachments shown as mojibake.
 *
 * Chrome never auto-detects UTF-8 for text served without a charset, so a
 * UTF-8 .txt/.csv attachment would render as "å°åŒ—". Chrome falls back to
 * windows-1252 in that case, which maps every byte to exactly one character,
 * so the original bytes can be recovered and decoded as UTF-8. The text is
 * only replaced when those bytes are valid UTF-8; Big5, GBK, Shift_JIS etc.
 * are detected correctly by Chrome and left alone.
 */
(() => {
  'use strict';

  if (window.top !== window || document.contentType !== 'text/plain') return;
  if (!['windows-1252', 'iso-8859-1', 'us-ascii'].includes(String(document.characterSet).toLowerCase())) return;

  const pre = document.querySelector('body > pre');
  const text = pre ? pre.textContent : '';
  if (!/[^\x00-\x7f]/.test(text)) return;

  const decoder = new TextDecoder('windows-1252');
  const byteOf = new Map();
  for (let byte = 0; byte < 256; byte++) byteOf.set(decoder.decode(Uint8Array.of(byte)), byte);

  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const byte = byteOf.get(text[i]);
    if (byte === undefined) return;
    bytes[i] = byte;
  }

  try {
    pre.textContent = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // Not UTF-8: Chrome's rendering is already right.
  }
})();
