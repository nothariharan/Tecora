import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// smoke: can chromium load our unpacked build without blowing up?
// does NOT hit claude.ai (needs your login + real network traffic).

const root = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.join(root, '..', '.output', 'chrome-mv3');

async function main() {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.waitForTimeout(1500);

  const injected = await page.evaluate(() => !!document.getElementById('tecora-root'));
  console.log('tecora root on example.com (should be false):', injected);

  console.log('service workers seen:', context.serviceWorkers().length);

  await context.close();
  console.log('extension load smoke: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
