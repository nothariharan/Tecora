import { useState, useEffect } from 'react';
import type { Platform } from '@/src/core/types';
import type { RuntimeRequest, RuntimeResponse } from '@/src/core/bus';
import { platformFromUrl } from '@/src/core/chat-url';

interface ActivePlatform {
  platform: Platform;
  account: string;
}

export function useActivePlatform(): ActivePlatform | null {
  const [active, setActive] = useState<ActivePlatform | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      let tabId: number | undefined;
      let urlPlatform: Platform | null = null;

      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        tabId = tabs[0]?.id;
        urlPlatform = platformFromUrl(tabs[0]?.url);
        if (urlPlatform && !cancelled) {
          const detected = urlPlatform;
          setActive((prev) =>
            prev?.platform === detected
              ? prev
              : { platform: detected, account: prev?.account ?? 'default' },
          );
        }
      } catch {
        // ignore
      }

      // authoritative: ask the page's content script (same source as the palette)
      if (tabId != null) {
        try {
          const page = (await browser.tabs.sendMessage(tabId, {
            type: 'get_page_context',
          } satisfies RuntimeRequest)) as RuntimeResponse;

          if (!cancelled && page?.type === 'get_page_context_ok') {
            setActive({ platform: page.platform, account: page.account });
            await browser.runtime.sendMessage({
              type: 'set_active_context',
              platform: page.platform,
              account: page.account,
              force: true,
            } satisfies RuntimeRequest);
            // kick a scrape so gemini chats land in the db for this account
            void browser.tabs.sendMessage(tabId, {
              type: 'refresh_chats',
            } satisfies RuntimeRequest);
            return;
          }
        } catch {
          // content script missing — fall through
        }
      }

      try {
        const res = (await browser.runtime.sendMessage({
          type: 'sync_active_context',
          tabId,
        } satisfies RuntimeRequest)) as RuntimeResponse;
        if (
          !cancelled &&
          res?.type === 'sync_active_context_ok' &&
          res.platform &&
          res.account
        ) {
          // never accept a platform that contradicts the visible tab url
          if (urlPlatform && res.platform !== urlPlatform) {
            const detected = urlPlatform;
            setActive((prev) => ({
              platform: detected,
              account: prev?.account ?? res.account ?? 'default',
            }));
            return;
          }
          setActive({ platform: res.platform, account: res.account });
          return;
        }
      } catch {
        // fall through
      }

      if (urlPlatform && !cancelled) {
        const detected = urlPlatform;
        setActive((prev) => ({
          platform: detected,
          account: prev?.account ?? 'default',
        }));
        return;
      }

      const s = await browser.storage.session.get(['activePlatform', 'activeAccount']);
      const p = s['activePlatform'] as string | undefined;
      const a = s['activeAccount'] as string | undefined;
      if (!cancelled && p && a) setActive({ platform: p as Platform, account: a });
    }

    void hydrate();

    const interval = window.setInterval(() => void hydrate(), 2000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void hydrate();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    const listener = (
      changes: Record<string, { newValue?: unknown }>,
      areaName: string,
    ) => {
      if (areaName !== 'session') return;
      void (async () => {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const urlPlatform = platformFromUrl(tabs[0]?.url);
        const p =
          'activePlatform' in changes
            ? (changes['activePlatform']?.newValue as Platform | undefined)
            : undefined;
        const a =
          'activeAccount' in changes
            ? (changes['activeAccount']?.newValue as string | undefined)
            : undefined;

        // ignore session writes from another window's platform
        if (urlPlatform && p && p !== urlPlatform) return;

        setActive((prev) => {
          const nextPlatform = p ?? prev?.platform;
          const nextAccount = a ?? prev?.account;
          if (nextPlatform && nextAccount) {
            return { platform: nextPlatform, account: nextAccount };
          }
          return prev;
        });
      })();
    };

    browser.storage.onChanged.addListener(listener);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      browser.storage.onChanged.removeListener(listener);
    };
  }, []);

  return active;
}
