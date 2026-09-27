#!/usr/bin/env node
/*
 * Renders the extension icons and the Chrome Web Store images with headless
 * Chromium (Playwright).
 *
 *   node scripts/render-assets.mjs            # icons + store images
 *   node scripts/render-assets.mjs icons      # extension/icons/*.png only
 *   node scripts/render-assets.mjs store      # store/images/*.png only
 *
 * Sources live in store/assets-src/. Store images that show the extension's
 * own pages load the unpacked extension, so render the icons first.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extensionDir = path.join(root, 'extension');
const sourceDir = path.join(root, 'store', 'assets-src');
const storeDir = path.join(root, 'store', 'images');

// size -> [artwork size, padding, simplified]. Chrome Web Store asks for a
// 128px icon with 96px of artwork; small toolbar icons drop the paperclip.
const ICONS = {
  16: [16, 0, true],
  32: [32, 0, true],
  48: [48, 0, false],
  128: [96, 16, false],
};

const LOCALES = ['en', 'zh_TW'];

async function renderIcons(browser) {
  const svg = await fs.readFile(path.join(sourceDir, 'icon.svg'), 'utf8');
  const page = await browser.newPage();
  for (const [size, [artwork, padding, simplified]] of Object.entries(ICONS)) {
    await page.setViewportSize({ width: Number(size), height: Number(size) });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}.simplified .detail{display:none}</style>` +
        `<div class="${simplified ? 'simplified' : ''}" style="padding:${padding}px;width:${artwork}px;height:${artwork}px">` +
        svg.replace('<svg ', `<svg width="${artwork}" height="${artwork}" `) +
        `</div>`,
    );
    const file = path.join(extensionDir, 'icons', `icon${size}.png`);
    await page.screenshot({ path: file, omitBackground: true });
    console.log('wrote', path.relative(root, file));
  }
  await page.close();
}

async function renderStoreImages() {
  await fs.mkdir(storeDir, { recursive: true });
  await fs.copyFile(path.join(extensionDir, 'icons', 'icon128.png'), path.join(storeDir, 'icon-128.png'));
  console.log('wrote store/images/icon-128.png');

  for (const locale of LOCALES) {
    const lang = locale.replace('_', '-');
    const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tabachment-assets-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: true,
      locale: lang,
      args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`, `--lang=${lang}`],
    });
    try {
      const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
      const extensionId = new URL(worker.url()).host;
      const shots = [
        ['promo.html?size=small', 440, 280, `promo-small-440x280-${locale}.png`],
        ['promo.html?size=marquee', 1400, 560, `promo-marquee-1400x560-${locale}.png`],
        ['screenshot.html?scene=click', 1280, 800, `screenshot-1-click-${locale}.png`],
        ['screenshot.html?scene=formats', 1280, 800, `screenshot-2-formats-${locale}.png`],
        [`chrome-extension://${extensionId}/src/pages/options.html`, 1280, 800, `screenshot-3-options-${locale}.png`],
      ];
      const page = await context.newPage();
      for (const [source, width, height, name] of shots) {
        await page.setViewportSize({ width, height });
        const url = source.startsWith('chrome-extension://')
          ? source
          : `file://${path.join(sourceDir, source.split('?')[0])}?${source.split('?')[1]}&lang=${locale}`;
        await page.goto(url);
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: path.join(storeDir, name) });
        console.log('wrote', path.join('store', 'images', name));
      }
    } finally {
      await context.close();
      await fs.rm(userDataDir, { recursive: true, force: true });
    }
  }
}

const what = process.argv[2] || 'all';
if (what === 'all' || what === 'icons') {
  const browser = await chromium.launch();
  try {
    await renderIcons(browser);
  } finally {
    await browser.close();
  }
}
if (what === 'all' || what === 'store') await renderStoreImages();
