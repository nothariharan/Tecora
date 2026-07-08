import { isPageEnvelope } from '@/src/core/bus';
import type { RuntimeRequest } from '@/src/core/bus';
import { ClaudeAdapter } from '@/src/adapters/claude';

// L1 — isolated world. listens for L0 postMessages and hands off to the right adapter.
export default defineContentScript({
  matches: [
    'https://claude.ai/*',
    'https://chatgpt.com/*',
    'https://gemini.google.com/*',
  ],
  runAt: 'document_start',
  main() {
    const claude = new ClaudeAdapter();

    window.addEventListener('message', async (event) => {
      if (event.source !== window) return;
      if (!isPageEnvelope(event.data)) return;

      const msg = event.data.msg;

      if (msg.kind === 'hello') return;

      if (msg.kind === 'chats_intercepted' && msg.platform === 'claude') {
        claude.ingestRaw(msg.raw, msg.account);

        const chats = await claude.listChats();
        const health = await claude.health();

        if (health.level !== 'green') {
          console.warn('[tecora] adapter health', health);
        }

        if (chats.length > 0) {
          await browser.runtime.sendMessage({
            type: 'upsert_chats',
            chats,
          } satisfies RuntimeRequest);
        }
      }
    });
  },
});
