import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const extensionDir = path.join(root, 'extension');

/** Loads extension/src/shared/attachments.js (a classic script) and returns globalThis.Tabachment. */
export function loadShared() {
  if (!globalThis.Tabachment) {
    const file = path.join(extensionDir, 'src/shared/attachments.js');
    vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
  }
  return globalThis.Tabachment;
}
