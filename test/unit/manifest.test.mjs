import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { extensionDir, root } from '../helpers/load-shared.mjs';

const read = (file) => fs.readFileSync(path.join(extensionDir, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(extensionDir, file));
const manifest = JSON.parse(read('manifest.json'));
const locales = fs.readdirSync(path.join(extensionDir, '_locales'));
const messages = Object.fromEntries(locales.map((locale) => [locale, JSON.parse(read(`_locales/${locale}/messages.json`))]));

function walk(dir) {
  return fs.readdirSync(path.join(extensionDir, dir), { withFileTypes: true }).flatMap((entry) => {
    const file = path.posix.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

describe('manifest.json', () => {
  test('is a Manifest V3 extension whose version matches package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    assert.equal(manifest.manifest_version, 3);
    assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
    assert.equal(manifest.version, pkg.version);
  });

  test('asks only for the permissions it needs', () => {
    assert.deepEqual(manifest.permissions, ['declarativeNetRequestWithHostAccess', 'scripting', 'storage']);
    assert.deepEqual(manifest.host_permissions, [
      'https://mail.google.com/*',
      'https://mail-attachment.googleusercontent.com/*',
    ]);
    assert.equal(manifest.externally_connectable, undefined);
    assert.equal(manifest.web_accessible_resources, undefined);
  });

  test('references files that exist', () => {
    const files = [
      ...Object.values(manifest.icons),
      ...Object.values(manifest.action.default_icon),
      manifest.options_ui.page,
      manifest.background.service_worker,
      ...manifest.content_scripts.flatMap((entry) => [...entry.js, ...(entry.css || [])]),
    ];
    for (const file of files) assert.ok(exists(file), file);
  });

  test('pages reference files that exist', () => {
    for (const page of walk('src').filter((file) => file.endsWith('.html'))) {
      for (const [, ref] of read(page).matchAll(/(?:src|href)="([^"#]+)"/g)) {
        const target = ref.startsWith('/') ? ref.slice(1) : path.posix.join(path.posix.dirname(page), ref);
        assert.ok(exists(target), `${page} -> ${ref}`);
      }
    }
  });

  test('the service worker imports the shared script', () => {
    const [, imported] = /importScripts\('([^']+)'\)/.exec(read(manifest.background.service_worker));
    assert.ok(exists(path.posix.join(path.posix.dirname(manifest.background.service_worker), imported)));
  });
});

describe('_locales', () => {
  test('the default locale exists', () => {
    assert.ok(locales.includes(manifest.default_locale));
  });

  test('every locale defines the same non-empty messages', () => {
    const keys = Object.keys(messages.en).sort();
    for (const locale of locales) {
      assert.deepEqual(Object.keys(messages[locale]).sort(), keys, locale);
      for (const [key, value] of Object.entries(messages[locale])) {
        assert.ok(value.message && value.message.trim(), `${locale}.${key}`);
        assert.ok(!/\$(?!\$)/.test(value.message), `${locale}.${key} has an unescaped $`);
      }
    }
  });

  test('store name and summary fit the Chrome Web Store limits', () => {
    for (const locale of locales) {
      assert.ok([...messages[locale].extName.message].length <= 75, `${locale} name too long`);
      assert.ok([...messages[locale].extDescription.message].length <= 132, `${locale} description too long`);
    }
  });

  test('every message the code uses exists', () => {
    const used = new Set();
    for (const [, key] of JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)) used.add(key);
    for (const file of walk('src')) {
      const text = read(file);
      for (const [, key] of text.matchAll(/data-i18n="(\w+)"/g)) used.add(key);
      for (const [, key] of text.matchAll(/(?:getMessage|message)\('(\w+)'/g)) used.add(key);
    }
    assert.ok(used.size > 20);
    for (const key of used) assert.ok(messages.en[key], key);
  });
});
