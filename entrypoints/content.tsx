import React, { useEffect, useState } from 'react';
import { isPageEnvelope } from '@/src/core/bus';
import type { RuntimeRequest } from '@/src/core/bus';
import { ClaudeAdapter } from '@/src/adapters/claude';
import { mountShadowApp } from '@/src/ui/shadow-root';
import { Palette, PALETTE_STYLES } from '@/src/ui/Palette';

// L1 — isolated world. listens for L0 postMessages, hands off to the adapter,
// and hosts the ctrl/cmd+k palette in a shadow root.
export default defineContentScript({
  matches: [
    'https://claude.ai/*',
    'https://chatgpt.com/*',
    'https://gemini.google.com/*',
  ],
  runAt: 'document_start',
  main() {
    const claude = new ClaudeAdapter();

    // filled in once the react tree mounts
    const bridge = {
      setOpen: (_v: boolean) => {},
      setAccount: (_a: string | null) => {},
      getOpen: () => false,
    };

    mountShadowApp(
      <PaletteApp adapter={claude} bridge={bridge} />,
      PALETTE_STYLES,
    );

    window.addEventListener(
      'keydown',
      (e) => {
        const mod = e.metaKey || e.ctrlKey;
        if (!mod || e.key.toLowerCase() !== 'k') return;

        const t = e.target as HTMLElement | null;
        const typing =
          t &&
          (t.tagName === 'INPUT' ||
            t.tagName === 'TEXTAREA' ||
            t.isContentEditable);
        if (typing && !bridge.getOpen()) return;

        e.preventDefault();
        e.stopPropagation();
        bridge.setOpen(!bridge.getOpen());
      },
      true,
    );

    window.addEventListener('message', async (event) => {
      if (event.source !== window) return;
      if (!isPageEnvelope(event.data)) return;

      const msg = event.data.msg;
      if (msg.kind === 'hello') return;

      if (msg.kind === 'chats_intercepted' && msg.platform === 'claude') {
        claude.ingestRaw(msg.raw, msg.account);
        bridge.setAccount(msg.account);

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

function PaletteApp({
  adapter,
  bridge,
}: {
  adapter: ClaudeAdapter;
  bridge: {
    setOpen: (v: boolean) => void;
    setAccount: (a: string | null) => void;
    getOpen: () => boolean;
  };
}) {
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState<string | null>(null);

  useEffect(() => {
    bridge.setOpen = setOpen;
    bridge.setAccount = setAccount;
    bridge.getOpen = () => open;
  }, [bridge, open]);

  return (
    <Palette
      open={open}
      onClose={() => setOpen(false)}
      platform="claude"
      account={account}
      onOpenChat={(chatId) => adapter.openChat(chatId)}
    />
  );
}
