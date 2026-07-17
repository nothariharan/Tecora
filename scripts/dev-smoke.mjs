import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

// quick smoke against the live WXT dev build — checks inject, not full login flows.

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const extensionPath = path.join(root, '.output', 'chrome-mv3-dev');

if (!fs.existsSync(path.join(extensionPath, 'manifest.json'))) {
  console.error('no chrome-mv3-dev build — is npm run dev up?');
  process.exit(1);
}

const userDataDir = path.join(root, '.tecora-chrome-profile-smoke');
fs.mkdirSync(userDataDir, { recursive: true });

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});

const page = await context.newPage();
const errors = [];
page.on('console', (msg) => {
  const t = msg.text();
  if (t.includes('[tecora]')) console.log('console:', t);
});
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto('https://claude.ai', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);

const host = await page.evaluate(() => {
  const el = document.getElementById('tecora-root');
  if (!el?.shadowRoot) return { present: false };
  const chip = el.shadowRoot.querySelector('.chip');
  return {
    present: true,
    chipText: chip?.textContent?.trim() ?? null,
  };
});

console.log('tecora host on claude.ai:', host);
console.log('page errors:', errors.length);

await context.close();

if (!host.present) {
  console.error('FAIL: tecora root not injected');
  process.exit(1);
}
console.log('PASS: tecora injected on claude.ai');
