import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

// launches chrome with tecora loaded and opens claude.ai.
// leave this running — close the browser window when you're done.

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// prefer the live WXT dev build when `npm run dev` is up
const devPath = path.join(root, '.output', 'chrome-mv3-dev');
const prodPath = path.join(root, '.output', 'chrome-mv3');
const extensionPath = fs.existsSync(path.join(devPath, 'manifest.json'))
  ? devPath
  : prodPath;
const profilePath = path.join(root, '.tecora-chrome-profile');

if (!fs.existsSync(path.join(extensionPath, 'manifest.json'))) {
  console.error('no build found. run: npm run build  (or npm run dev)');
  process.exit(1);
}

console.log('loading extension from', extensionPath);

fs.mkdirSync(profilePath, { recursive: true });

const context = await chromium.launchPersistentContext(profilePath, {
  headless: false,
  viewport: null,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--start-maximized',
  ],
});

const page = context.pages()[0] ?? (await context.newPage());
await page.goto('https://claude.ai', { waitUntil: 'domcontentloaded' });

console.log('tecora chrome is up.');
console.log('1. log into claude if needed');
console.log('2. look for the green "tecora" chip bottom-right');
console.log('3. click it or press ctrl/cmd+k');
console.log('close the browser window to stop.');

// keep process alive until browser closes
await new Promise((resolve) => {
  context.on('close', resolve);
});
