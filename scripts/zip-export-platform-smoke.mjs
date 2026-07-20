import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// checks content-script inject on all three platforms.
// full artifact zip needs a logged-in session — we report that honestly.

const root = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.join(root, '..', '.output', 'chrome-mv3');

const SITES = [
  { platform: 'claude', url: 'https://claude.ai/' },
  { platform: 'chatgpt', url: 'https://chatgpt.com/' },
  { platform: 'gemini', url: 'https://gemini.google.com/app' },
];

async function probe(context, site) {
  const page = await context.newPage();
  const result = {
    platform: site.platform,
    url: site.url,
    loaded: false,
    tecoraReady: false,
    likelyLoggedIn: false,
    notes: [],
  };

  try {
    await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    result.loaded = true;
    await page.waitForTimeout(3500);

    result.tecoraReady = await page.evaluate(() => {
      return Boolean(
        window.__tecoraContentScriptActive ||
          document.querySelector('.chip') ||
          [...document.querySelectorAll('*')].some((el) =>
            (el.shadowRoot?.textContent || '').toLowerCase().includes('tecora'),
          ),
      );
    });

    const bodyText = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
    if (site.platform === 'claude') {
      result.likelyLoggedIn = !bodyText.includes('log in') && !bodyText.includes('sign in to claude');
    } else if (site.platform === 'chatgpt') {
      result.likelyLoggedIn =
        bodyText.includes('new chat') ||
        bodyText.includes('search chats') ||
        (!bodyText.includes('log in') && !bodyText.includes('sign up'));
    } else {
      result.likelyLoggedIn =
        bodyText.includes('gemini') &&
        !bodyText.includes('sign in') &&
        !bodyText.includes('use your google account');
    }

    if (!result.tecoraReady) {
      result.notes.push('content script not detected — hard refresh after reloading the extension');
    }
    if (!result.likelyLoggedIn) {
      result.notes.push('session looks logged out — open a chat with artifacts/images then use Export ZIP');
    } else {
      result.notes.push('session looks active — open a chat with files and click Export ZIP (with files)');
    }
  } catch (err) {
    result.notes.push(String(err));
  } finally {
    await page.close().catch(() => {});
  }

  return result;
}

async function main() {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  const rows = [];
  for (const site of SITES) {
    console.log('probing', site.platform, '...');
    rows.push(await probe(context, site));
  }

  await context.close();

  console.log('\nZIP export platform smoke');
  for (const row of rows) {
    console.log(
      JSON.stringify(
        {
          platform: row.platform,
          loaded: row.loaded,
          tecoraReady: row.tecoraReady,
          likelyLoggedIn: row.likelyLoggedIn,
          notes: row.notes,
        },
        null,
        2,
      ),
    );
  }

  const allLoaded = rows.every((r) => r.loaded);
  if (!allLoaded) process.exit(1);
  console.log('\npage load smoke: ok (artifact bytes still need your logged-in browser session)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
