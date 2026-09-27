import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { loadShared } from '../helpers/load-shared.mjs';

const T = loadShared();

const ATTACHMENT_URL =
  'https://mail.google.com/mail/u/0?ui=2&ik=4b86ba4469&attid=0.1&permmsgid=msg-f:1712345678901234567&th=18f0c0ffee&view=att&disp=safe&realattid=f_lx1&zw';

describe('parseDownloadUrl', () => {
  test('parses the mime:filename:url attribute Gmail puts on attachment cards', () => {
    assert.deepEqual(T.parseDownloadUrl(`application/pdf:report.pdf:${ATTACHMENT_URL}`), {
      mime: 'application/pdf',
      filename: 'report.pdf',
      url: ATTACHMENT_URL,
    });
  });

  test('keeps colons and non-ASCII characters in file names', () => {
    const parsed = T.parseDownloadUrl(`image/png:會議 12:30 截圖.png:${ATTACHMENT_URL}`);
    assert.equal(parsed.filename, '會議 12:30 截圖.png');
    assert.equal(parsed.url, ATTACHMENT_URL);
  });

  test('rejects malformed values', () => {
    for (const value of [null, undefined, '', 'application/pdf', 'a:b:http://mail.google.com/', 'a:b:javascript:alert(1)']) {
      assert.equal(T.parseDownloadUrl(value), null, String(value));
    }
  });
});

describe('isGmailAttachmentUrl', () => {
  test('accepts Gmail attachment URLs', () => {
    for (const url of [
      ATTACHMENT_URL,
      'https://mail.google.com/mail/?ui=2&ik=5a14ab333d&attid=0.2&permmsgid=msg-a:r128&view=att&realattid=f_jx&zw',
      'https://mail.google.com/mail/u/1/?view=att&th=158de724051f63cf&attid=0.3&disp=inline&safe=1&zw',
    ]) {
      assert.equal(T.isGmailAttachmentUrl(url), true, url);
    }
  });

  test('rejects everything else', () => {
    for (const url of [
      ATTACHMENT_URL.replace('https:', 'http:'),
      'https://mail.google.com.evil.example/mail/?view=att&attid=0.1',
      'https://evil.example/mail/?view=att&attid=0.1&host=mail.google.com',
      'https://user@mail.google.com/mail/?view=att&attid=0.1',
      'https://mail.google.com:8443/mail/?view=att&attid=0.1',
      'https://mail.google.com/mail/u/0/?view=cv&attid=0.1',
      'https://mail.google.com/mail/u/0/?view=att',
      'https://mail.google.com/mail/u/0/#inbox',
      'https://drive.google.com/file/d/abc/view',
      'javascript:alert(1)',
      'not a url',
      '',
      undefined,
    ]) {
      assert.equal(T.isGmailAttachmentUrl(url), false, String(url));
    }
  });
});

describe('toDownloadUrl', () => {
  const INLINE_URL = ATTACHMENT_URL.replace('disp=safe', 'disp=inline');

  test("turns Gmail's inline link into its download URL and leaves the rest untouched", () => {
    assert.equal(T.toDownloadUrl(INLINE_URL), ATTACHMENT_URL);
    assert.equal(T.toDownloadUrl(ATTACHMENT_URL), ATTACHMENT_URL);
  });

  test('adds disp=safe when missing', () => {
    assert.equal(
      T.toDownloadUrl('https://mail.google.com/mail/?ui=2&attid=0.1&view=att&zw'),
      'https://mail.google.com/mail/?ui=2&attid=0.1&view=att&zw&disp=safe',
    );
    assert.equal(T.toDownloadUrl('https://mail.google.com/mail/#x'), 'https://mail.google.com/mail/?disp=safe#x');
  });

  test('does not touch parameters that merely end in "disp"', () => {
    assert.equal(
      T.toDownloadUrl('https://mail.google.com/mail/?xdisp=1&view=att&attid=0.1'),
      'https://mail.google.com/mail/?xdisp=1&view=att&attid=0.1&disp=safe',
    );
  });
});

describe('classify', () => {
  const cases = [
    ['report.PDF', '', { kind: 'pdf', mime: 'application/pdf' }],
    ['scan.pdf', 'application/octet-stream', { kind: 'pdf', mime: 'application/pdf' }],
    ['invoice', 'application/pdf', { kind: 'pdf', mime: 'application/pdf' }],
    ['photo.JPG', 'image/jpeg', { kind: 'image', mime: 'image/jpeg' }],
    ['image', 'image/png', { kind: 'image', mime: 'image/png' }],
    ['clip.mov', 'video/quicktime', { kind: 'video', mime: 'video/mp4' }],
    ['voice.m4a', '', { kind: 'audio', mime: 'audio/mp4' }],
    ['data.csv', 'text/csv', { kind: 'text', mime: 'text/plain' }],
    ['main.py', 'application/octet-stream', { kind: 'text', mime: 'text/plain' }],
    ['README', 'text/plain', { kind: 'text', mime: 'text/plain' }],
  ];
  for (const [filename, mime, expected] of cases) {
    test(`${filename} (${mime || 'no type'})`, () => assert.deepEqual(T.classify(filename, mime), expected));
  }

  test('leaves active and unsupported formats to Gmail', () => {
    for (const [filename, mime] of [
      ['page.html', 'text/plain'],
      ['page.htm', 'application/octet-stream'],
      ['logo.svg', 'image/svg+xml'],
      ['archive.mhtml', 'text/plain'],
      ['memo.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      ['sheet.xlsx', 'application/octet-stream'],
      ['archive.zip', 'application/zip'],
      ['photo.heic', 'image/heic'],
      ['page', 'text/html'],
      ['drawing', 'image/svg+xml'],
      ['', ''],
    ]) {
      assert.equal(T.classify(filename, mime), null, filename);
    }
  });
});

describe('cleanFilename', () => {
  test('strips a trailing size and whitespace', () => {
    assert.equal(T.cleanFilename('  notes.txt (12 K) '), 'notes.txt');
    assert.equal(T.cleanFilename('draft.pdf(1.2 MB)'), 'draft.pdf');
  });

  test('keeps parentheses that are part of the name', () => {
    assert.equal(T.cleanFilename('report (final).pdf'), 'report (final).pdf');
    assert.equal(T.cleanFilename('report (1).pdf'), 'report (1).pdf');
  });

  test('uses the first line and drops control characters', () => {
    assert.equal(T.cleanFilename('\n a.pdf\u0000 \nsecond line'), 'a.pdf');
  });
});

describe('contentDisposition', () => {
  test('encodes the file name per RFC 5987', () => {
    assert.equal(T.contentDisposition('report 報告.pdf'), "inline; filename*=UTF-8''report%20%E5%A0%B1%E5%91%8A.pdf");
    assert.equal(T.contentDisposition("it's (1).pdf"), "inline; filename*=UTF-8''it%27s%20%281%29.pdf");
  });

  test('never produces path separators or line breaks', () => {
    const value = T.contentDisposition('a/b\\c\r\nSet-Cookie: x.pdf');
    assert.equal(value, "inline; filename*=UTF-8''a_b_c");
    assert.equal(T.contentDisposition(''), 'inline');
  });
});

// --- declarativeNetRequest rules ------------------------------------------------

// Mirrors Chrome's HeaderInfo matching: case-insensitive glob over the whole
// header value, where * matches any run of characters and ? zero or one.
function globMatches(pattern, value) {
  const source = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.?');
  return new RegExp(`^${source}$`, 'i').test(value);
}

function headerInfoMatches(info, value) {
  if (value === undefined) return false;
  const included = info.values ? info.values.some((pattern) => globMatches(pattern, value)) : true;
  const excluded = info.excludedValues ? info.excludedValues.some((pattern) => globMatches(pattern, value)) : false;
  return included && !excluded;
}

function ruleApplies(rule, contentType) {
  const { responseHeaders, excludedResponseHeaders } = rule.condition;
  if (responseHeaders && !responseHeaders.some((info) => headerInfoMatches(info, contentType))) return false;
  if (excludedResponseHeaders && excludedResponseHeaders.some((info) => headerInfoMatches(info, contentType))) return false;
  return true;
}

/** Simulates the headers Chrome ends up with; asserts at most one rule fires. */
function simulate(rules, contentType) {
  const applied = rules.filter((rule) => ruleApplies(rule, contentType));
  assert.ok(applied.length <= 1, `several rules apply to ${contentType}`);
  if (!applied.length) return null;
  const headers = Object.fromEntries(applied[0].action.responseHeaders.map((h) => [h.header, h.value]));
  return { disposition: headers['content-disposition'], contentType: headers['content-type'] ?? contentType };
}

function rulesFor(filename, declaredMime = '') {
  const type = T.classify(filename, declaredMime);
  return T.buildTabRules({ tabId: 42, filename, ...type }, 7);
}

describe('buildTabRules', () => {
  test('scopes every rule to the tab, top-level documents and attachment URLs', () => {
    const rules = rulesFor('report.pdf');
    assert.deepEqual(rules.map((rule) => rule.id), [7, 8]);
    for (const rule of rules) {
      assert.deepEqual(rule.condition.tabIds, [42]);
      assert.deepEqual(rule.condition.resourceTypes, ['main_frame']);
      assert.equal(rule.condition.regexFilter, T.ATTACHMENT_URL_REGEX);
      assert.equal(rule.action.type, 'modifyHeaders');
      assert.equal(rule.action.responseHeaders[0].value, "inline; filename*=UTF-8''report.pdf");
    }
    assert.equal(rulesFor('notes.txt').length, 3);
  });

  test('URL filter only matches Gmail attachment responses', () => {
    const regex = new RegExp(T.ATTACHMENT_URL_REGEX);
    for (const url of [
      ATTACHMENT_URL,
      'https://mail.google.com/mail/u/0/?view=att&attid=0.1',
      'https://mail-attachment.googleusercontent.com/attachment/u/0/?ui=2&attid=0.1&saddbat=abc',
    ]) {
      assert.ok(regex.test(url), url);
    }
    for (const url of [
      'https://mail.google.com/mail/u/0/#inbox',
      'https://mail.google.com/mail/u/0/?view=attx&attid=0.1',
      'https://mail.google.com.evil.example/?view=att',
      'https://evil.example/?u=https://mail-attachment.googleusercontent.com/',
      'http://mail-attachment.googleusercontent.com/attachment/',
    ]) {
      assert.ok(!regex.test(url), url);
    }
  });

  const INLINE = "inline; filename*=UTF-8''";
  const expectations = {
    'report.pdf': {
      'application/pdf': 'application/pdf',
      'Application/PDF; name="report.pdf"': 'Application/PDF; name="report.pdf"',
      'application/octet-stream': 'application/pdf',
      'binary/octet-stream; charset=binary': 'application/pdf',
      'application/x-pdf': 'application/pdf',
      'image/png': 'image/png',
    },
    'photo.png': {
      'image/png': 'image/png',
      'application/octet-stream': 'image/png',
    },
    'clip.mov': {
      'video/quicktime': 'video/mp4',
      'video/mp4': 'video/mp4',
      'application/octet-stream': 'video/mp4',
    },
    'notes.txt': {
      'text/plain; charset=Big5': 'text/plain; charset=Big5',
      'text/plain': 'text/plain',
      'text/csv': 'text/plain',
      'text/csv; charset=UTF-8': 'text/plain; charset=utf-8',
      'application/json; charset="utf-8"': 'text/plain; charset=utf-8',
      'application/vnd.ms-excel': 'text/plain',
      'image/svg+xml': 'text/plain',
      undefined: 'text/plain',
    },
  };
  for (const [filename, table] of Object.entries(expectations)) {
    for (const [served, shown] of Object.entries(table)) {
      test(`${filename} served as ${served} is shown inline as ${shown}`, () => {
        const result = simulate(rulesFor(filename), served === 'undefined' ? undefined : served);
        assert.ok(result, 'no rule applied');
        assert.ok(result.disposition.startsWith(INLINE));
        assert.equal(result.contentType, shown);
      });
    }
  }

  test('never makes a browser render active content', () => {
    const activeTypes = [
      'text/html',
      'text/html; charset=utf-8',
      'TEXT/HTML',
      'image/svg+xml',
      'application/xhtml+xml',
      'text/xml',
      'application/xml',
      'application/javascript',
      'multipart/related',
    ];
    const safeResults = new Set(['application/pdf', 'image/png', 'image/jpeg', 'video/mp4', 'audio/mpeg', 'text/plain', 'text/plain; charset=utf-8']);
    for (const filename of ['report.pdf', 'photo.jpg', 'clip.mov', 'song.mp3', 'notes.txt', 'data.csv', 'invoice']) {
      const rules = rulesFor(filename, filename === 'invoice' ? 'application/pdf' : '');
      for (const served of activeTypes) {
        const result = simulate(rules, served);
        assert.ok(!result || safeResults.has(result.contentType), `${filename} served as ${served} -> ${result && result.contentType}`);
      }
      // An HTML response (e.g. a Gmail error or sign-in page) is never touched.
      assert.equal(simulate(rules, 'text/html; charset=UTF-8'), null, filename);
    }
  });
});

describe('validateOpenRequest', () => {
  test('returns the attachment to open', () => {
    assert.deepEqual(
      T.validateOpenRequest({ url: ATTACHMENT_URL, filename: ' report 報告.pdf ', declaredMime: 'application/pdf' }),
      { url: ATTACHMENT_URL, filename: 'report 報告.pdf', kind: 'pdf', mime: 'application/pdf' },
    );
  });

  test("always opens Gmail's download URL, never asks Gmail for inline display", () => {
    const inline = ATTACHMENT_URL.replace('disp=safe', 'disp=inline');
    assert.equal(T.validateOpenRequest({ url: inline, filename: 'report.pdf' }).url, ATTACHMENT_URL);
  });

  test('rejects anything that is not a supported Gmail attachment', () => {
    const bad = [
      null,
      'x',
      {},
      { url: 'https://evil.example/?view=att&attid=0.1', filename: 'a.pdf' },
      { url: ATTACHMENT_URL, filename: 'page.html' },
      { url: ATTACHMENT_URL, filename: 'a.docx' },
      { url: ATTACHMENT_URL, filename: 42 },
      { url: ATTACHMENT_URL + '&x=' + 'a'.repeat(9000), filename: 'a.pdf' },
    ];
    for (const message of bad) assert.throws(() => T.validateOpenRequest(message), JSON.stringify(message)?.slice(0, 60));
  });
});

describe('normalizeSettings', () => {
  test('fills in defaults', () => {
    assert.deepEqual(T.normalizeSettings(undefined), {
      interceptClicks: true,
      showButton: true,
      openInBackground: false,
      kinds: { pdf: true, image: true, text: true, video: true, audio: true },
    });
  });

  test('keeps valid values and ignores invalid ones', () => {
    const settings = T.normalizeSettings({ interceptClicks: false, showButton: 'no', kinds: { pdf: false, text: 1 }, extra: 1 });
    assert.equal(settings.interceptClicks, false);
    assert.equal(settings.showButton, true);
    assert.deepEqual(settings.kinds, { pdf: false, image: true, text: true, video: true, audio: true });
    assert.equal('extra' in settings, false);
  });
});
