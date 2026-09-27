/*
 * Tabachment — shared logic.
 *
 * Loaded as a classic script by the Gmail content script, the service worker
 * (importScripts), the options page and the unit tests (node:vm), so it must
 * not touch the DOM or chrome.* APIs. Everything is exposed on
 * globalThis.Tabachment.
 */
(function (root) {
  'use strict';

  const GMAIL_HOST = 'mail.google.com';

  // File kinds Tabachment can open in a tab. Each one can be toggled in the options.
  const KINDS = Object.freeze(['pdf', 'image', 'text', 'video', 'audio']);

  const DEFAULT_SETTINGS = Object.freeze({
    interceptClicks: true,
    showButton: true,
    openInBackground: false,
    kinds: Object.freeze({ pdf: true, image: true, text: true, video: true, audio: true }),
  });

  // File extension -> [kind, MIME type the tab displays the file as].
  const EXTENSION_TYPES = {
    pdf: ['pdf', 'application/pdf'],
    png: ['image', 'image/png'],
    apng: ['image', 'image/apng'],
    jpg: ['image', 'image/jpeg'],
    jpeg: ['image', 'image/jpeg'],
    jpe: ['image', 'image/jpeg'],
    jfif: ['image', 'image/jpeg'],
    pjpeg: ['image', 'image/jpeg'],
    pjp: ['image', 'image/jpeg'],
    gif: ['image', 'image/gif'],
    webp: ['image', 'image/webp'],
    bmp: ['image', 'image/bmp'],
    ico: ['image', 'image/x-icon'],
    avif: ['image', 'image/avif'],
    mp4: ['video', 'video/mp4'],
    m4v: ['video', 'video/mp4'],
    mov: ['video', 'video/mp4'], // Chrome plays H.264 QuickTime files when labelled as MP4.
    webm: ['video', 'video/webm'],
    ogv: ['video', 'video/ogg'],
    mp3: ['audio', 'audio/mpeg'],
    m4a: ['audio', 'audio/mp4'],
    aac: ['audio', 'audio/aac'],
    wav: ['audio', 'audio/wav'],
    oga: ['audio', 'audio/ogg'],
    ogg: ['audio', 'audio/ogg'],
    opus: ['audio', 'audio/ogg'],
    flac: ['audio', 'audio/flac'],
    weba: ['audio', 'audio/webm'],
  };
  for (const ext of (
    'txt text log csv tsv md markdown json jsonl ndjson geojson xml yaml yml toml ini cfg conf ' +
    'properties env sql sh bash zsh bat cmd ps1 py rb pl php js mjs cjs jsx tsx java kt kts swift ' +
    'c h cc cpp cxx hpp cs go rs scala r lua dart vue svelte css scss sass less srt vtt diff patch ' +
    'tex bib rst adoc gradle'
  ).split(' ')) {
    EXTENSION_TYPES[ext] = ['text', 'text/plain'];
  }

  // Declared MIME type -> [kind, display MIME type]. Used when the file name has
  // no extension we know about (e.g. "scan" sent as application/pdf).
  const MIME_TYPES = {
    'application/pdf': ['pdf', 'application/pdf'],
    'application/x-pdf': ['pdf', 'application/pdf'],
    'application/acrobat': ['pdf', 'application/pdf'],
    'application/vnd.pdf': ['pdf', 'application/pdf'],
    'text/pdf': ['pdf', 'application/pdf'],
    'text/x-pdf': ['pdf', 'application/pdf'],
    'image/png': ['image', 'image/png'],
    'image/x-png': ['image', 'image/png'],
    'image/apng': ['image', 'image/apng'],
    'image/jpeg': ['image', 'image/jpeg'],
    'image/jpg': ['image', 'image/jpeg'],
    'image/pjpeg': ['image', 'image/jpeg'],
    'image/gif': ['image', 'image/gif'],
    'image/webp': ['image', 'image/webp'],
    'image/bmp': ['image', 'image/bmp'],
    'image/x-ms-bmp': ['image', 'image/bmp'],
    'image/x-icon': ['image', 'image/x-icon'],
    'image/vnd.microsoft.icon': ['image', 'image/x-icon'],
    'image/avif': ['image', 'image/avif'],
    'video/mp4': ['video', 'video/mp4'],
    'video/x-m4v': ['video', 'video/mp4'],
    'video/quicktime': ['video', 'video/mp4'],
    'video/webm': ['video', 'video/webm'],
    'video/ogg': ['video', 'video/ogg'],
    'audio/mpeg': ['audio', 'audio/mpeg'],
    'audio/mp3': ['audio', 'audio/mpeg'],
    'audio/mp4': ['audio', 'audio/mp4'],
    'audio/x-m4a': ['audio', 'audio/mp4'],
    'audio/aac': ['audio', 'audio/aac'],
    'audio/wav': ['audio', 'audio/wav'],
    'audio/x-wav': ['audio', 'audio/wav'],
    'audio/wave': ['audio', 'audio/wav'],
    'audio/ogg': ['audio', 'audio/ogg'],
    'audio/opus': ['audio', 'audio/ogg'],
    'audio/flac': ['audio', 'audio/flac'],
    'audio/x-flac': ['audio', 'audio/flac'],
    'audio/webm': ['audio', 'audio/webm'],
    'text/plain': ['text', 'text/plain'],
    'text/csv': ['text', 'text/plain'],
    'text/tab-separated-values': ['text', 'text/plain'],
    'text/markdown': ['text', 'text/plain'],
    'application/json': ['text', 'text/plain'],
    'application/xml': ['text', 'text/plain'],
    'text/xml': ['text', 'text/plain'],
  };

  // Extensions that must keep Gmail's own handling even if the declared type
  // looks harmless: these formats can run script when rendered by a browser.
  const ACTIVE_EXTENSIONS = new Set(['html', 'htm', 'shtml', 'xhtml', 'xht', 'svg', 'svgz', 'mht', 'mhtml', 'xsl', 'xslt']);

  // Response Content-Types Chrome renders without running any page script.
  // Only responses with one of these types are switched to inline display as-is.
  const PASSIVE_TYPES = [
    'application/pdf',
    'image/png', 'image/x-png', 'image/apng', 'image/jpeg', 'image/jpg', 'image/pjpeg', 'image/gif',
    'image/webp', 'image/bmp', 'image/x-ms-bmp', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/avif',
    'audio/*', 'video/*',
    'text/plain',
  ];
  // Passive, but Chrome does not play it under this label; relabelled for video files instead.
  const RELABELLED_PASSIVE_TYPES = ['video/quicktime'];
  // Labels mail clients use when they do not know the type. Safe to relabel for binary kinds.
  const GENERIC_TYPES = [
    'application/octet-stream', 'binary/octet-stream', 'application/binary', 'application/unknown',
    'application/x-unknown', 'application/download', 'application/x-download', 'application/force-download',
  ];
  const KIND_ALIASES = {
    pdf: ['application/x-pdf', 'application/acrobat', 'application/vnd.pdf', 'applications/vnd.pdf', 'text/pdf', 'text/x-pdf'],
    video: RELABELLED_PASSIVE_TYPES,
  };
  // Never rewritten: an HTML response is most likely a Gmail error or sign-in page.
  const HTML_TYPES = ['text/html'];
  const UTF8_PATTERNS = ['*charset=utf-8*', '*charset="utf-8"*', "*charset='utf-8'*", '*charset=utf8*'];

  // Top-level responses Tabachment may modify: Gmail's attachment endpoint and the
  // dedicated attachment host it redirects to.
  const ATTACHMENT_URL_REGEX =
    '^https://(mail\\.google\\.com/.*[?&]view=att(&|$)|mail-attachment\\.googleusercontent\\.com/)';

  function normalizeMime(value) {
    return typeof value === 'string' ? value.split(';')[0].trim().toLowerCase() : '';
  }

  function extensionOf(filename) {
    const match = /\.([a-z0-9]{1,10})$/i.exec(String(filename || '').trim());
    return match ? match[1].toLowerCase() : '';
  }

  /**
   * Returns {kind, mime} for files a browser tab can display, or null.
   * The file extension wins over the declared type because mail clients often
   * send PDFs and images as application/octet-stream.
   */
  function classify(filename, declaredMime) {
    const ext = extensionOf(filename);
    if (ACTIVE_EXTENSIONS.has(ext)) return null;
    const entry = EXTENSION_TYPES[ext] || MIME_TYPES[normalizeMime(declaredMime)];
    return entry ? { kind: entry[0], mime: entry[1] } : null;
  }

  /**
   * Parses Gmail's `download_url` attribute ("mime:filename:url"), which Gmail
   * puts on attachment cards for drag-and-drop downloads in Chrome.
   */
  function parseDownloadUrl(value) {
    if (typeof value !== 'string') return null;
    const match = /^([^:]*):([\s\S]*):(https:\/\/\S+)$/.exec(value.trim());
    if (!match) return null;
    return { mime: match[1].trim(), filename: match[2].trim(), url: match[3] };
  }

  function parseUrl(value) {
    try {
      return new URL(value);
    } catch {
      return null;
    }
  }

  /** True for Gmail's own attachment URLs (https://mail.google.com/...&view=att&attid=...). */
  function isGmailAttachmentUrl(value) {
    const url = typeof value === 'string' ? parseUrl(value) : null;
    return Boolean(
      url &&
        url.protocol === 'https:' &&
        url.hostname === GMAIL_HOST &&
        !url.port &&
        !url.username &&
        !url.password &&
        url.searchParams.get('view') === 'att' &&
        url.searchParams.has('attid'),
    );
  }

  /**
   * Returns Gmail's download URL for an attachment (disp=safe; Gmail's own card
   * links use disp=inline). Tabachment always loads this URL, never asks Gmail
   * for inline display: only its type-checked rules may turn the response into
   * inline display, so anything they reject (or any failure) stays a download.
   * The query ends up with exactly one disp parameter, whatever spelling the
   * input used ("%64isp", repeats); the fragment and every other parameter are
   * kept byte for byte (URLSearchParams would re-encode Gmail's query, e.g.
   * "&zw" -> "&zw=").
   */
  function toDownloadUrl(value) {
    if (typeof value !== 'string') return value;
    const hash = value.indexOf('#');
    const beforeHash = hash === -1 ? value : value.slice(0, hash);
    const fragment = hash === -1 ? '' : value.slice(hash);
    const question = beforeHash.indexOf('?');
    const base = question === -1 ? beforeHash : beforeHash.slice(0, question);
    const query = question === -1 ? '' : beforeHash.slice(question + 1);

    const params = [];
    let replaced = false;
    for (const param of query ? query.split('&') : []) {
      if (paramName(param) !== 'disp') params.push(param);
      else if (!replaced) {
        params.push('disp=safe');
        replaced = true;
      }
    }
    if (!replaced) params.push('disp=safe');
    return `${base}?${params.join('&')}${fragment}`;
  }

  function paramName(param) {
    const name = param.split('=')[0].replace(/\+/g, ' ');
    try {
      return decodeURIComponent(name);
    } catch {
      return name;
    }
  }

  /** Cleans a file name read from page text, e.g. "notes.txt (12 K)" -> "notes.txt". */
  function cleanFilename(value) {
    const firstLine = String(value || '').split(/[\r\n]/).map((line) => line.trim()).find(Boolean) || '';
    return firstLine
      .replace(/\s*\([^()]*\d[^()]*\)\s*$/, '')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim()
      .slice(0, 255);
  }

  function encodeRFC5987(value) {
    return encodeURIComponent(value).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  }

  function contentDisposition(filename) {
    const safe = cleanFilename(filename).replace(/[\\/]/g, '_').slice(0, 180);
    return safe ? `inline; filename*=UTF-8''${encodeRFC5987(safe)}` : 'inline';
  }

  /** Expands MIME types into DNR header patterns that also match parameters ("; charset=..."). */
  function typePatterns(types) {
    return types.flatMap((type) => (type.endsWith('/*') ? [type] : [type, type + ';*']));
  }

  /**
   * Builds the declarativeNetRequest session rules for one Tabachment tab.
   *
   * Every rule is limited to that tab, to top-level documents and to Gmail
   * attachment URLs, and only ever turns a response into inline display of a
   * passive type:
   *   1. passive Content-Type (PDF, image, audio, video, plain text): switch
   *      Content-Disposition from "attachment" to "inline";
   *   2. generic Content-Type (application/octet-stream, ...): also relabel it
   *      with the file's real type (binary kinds);
   *   3. text files with any other non-HTML type (text/csv, application/json,
   *      ...): relabel as text/plain, keeping a declared UTF-8 charset because
   *      Chrome never auto-detects UTF-8.
   * Anything else (text/html, image/svg+xml, ...) keeps Gmail's download behaviour.
   */
  function buildTabRules({ tabId, kind, mime, filename }, firstRuleId) {
    let nextId = firstRuleId;
    const disposition = { header: 'content-disposition', operation: 'set', value: contentDisposition(filename) };
    const relabel = (value) => ({ header: 'content-type', operation: 'set', value });
    const condition = (extra) => ({
      tabIds: [tabId],
      resourceTypes: ['main_frame'],
      regexFilter: ATTACHMENT_URL_REGEX,
      ...extra,
    });
    const rule = (responseHeaders, extra) => ({
      id: nextId++,
      priority: 1,
      action: { type: 'modifyHeaders', responseHeaders },
      condition: condition(extra),
    });

    const rules = [
      rule([disposition], {
        responseHeaders: [
          {
            header: 'content-type',
            values: typePatterns(PASSIVE_TYPES),
            excludedValues: typePatterns(RELABELLED_PASSIVE_TYPES),
          },
        ],
      }),
    ];

    if (kind === 'text') {
      const keep = typePatterns([...PASSIVE_TYPES, ...HTML_TYPES]);
      rules.push(
        rule([disposition, relabel('text/plain; charset=utf-8')], {
          responseHeaders: [{ header: 'content-type', values: UTF8_PATTERNS }],
          excludedResponseHeaders: [{ header: 'content-type', values: keep }],
        }),
        rule([disposition, relabel('text/plain')], {
          excludedResponseHeaders: [{ header: 'content-type', values: [...keep, ...UTF8_PATTERNS] }],
        }),
      );
    } else {
      rules.push(
        rule([disposition, relabel(mime)], {
          responseHeaders: [
            { header: 'content-type', values: typePatterns([...GENERIC_TYPES, ...(KIND_ALIASES[kind] || [])]) },
          ],
        }),
      );
    }
    return rules;
  }

  /**
   * Validates an "open" request coming from the content script and returns the
   * attachment to open, or throws. The service worker trusts nothing else.
   */
  function validateOpenRequest(message) {
    if (!message || typeof message !== 'object') throw new Error('Invalid request');
    const { url, filename = '', declaredMime = '' } = message;
    if (typeof url !== 'string' || url.length > 8192 || !isGmailAttachmentUrl(url)) {
      throw new Error('Not a Gmail attachment URL');
    }
    if (typeof filename !== 'string' || typeof declaredMime !== 'string') throw new Error('Invalid request');
    const name = cleanFilename(filename);
    const type = classify(name, declaredMime);
    if (!type) throw new Error('Unsupported file type');
    return { url: toDownloadUrl(url), filename: name, kind: type.kind, mime: type.mime };
  }

  function normalizeSettings(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const bool = (value, fallback) => (typeof value === 'boolean' ? value : fallback);
    const kinds = {};
    for (const kind of KINDS) {
      kinds[kind] = bool(source.kinds && source.kinds[kind], DEFAULT_SETTINGS.kinds[kind]);
    }
    return {
      interceptClicks: bool(source.interceptClicks, DEFAULT_SETTINGS.interceptClicks),
      showButton: bool(source.showButton, DEFAULT_SETTINGS.showButton),
      openInBackground: bool(source.openInBackground, DEFAULT_SETTINGS.openInBackground),
      kinds,
    };
  }

  root.Tabachment = Object.freeze({
    KINDS,
    DEFAULT_SETTINGS,
    ATTACHMENT_URL_REGEX,
    classify,
    parseDownloadUrl,
    isGmailAttachmentUrl,
    toDownloadUrl,
    cleanFilename,
    contentDisposition,
    buildTabRules,
    validateOpenRequest,
    normalizeSettings,
  });
})(globalThis);
