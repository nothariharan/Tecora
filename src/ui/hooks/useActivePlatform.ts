import { useState, useEffect } from 'react';
import type { Platform } from '@/src/core/types';

interface ActivePlatform {
  platform: Platform;
  account: string;
}

export function useActivePlatform(): ActivePlatform | null {
  const [active, setActive] = useState<ActivePlatform | null>(null);

  useEffect(() => {
    browser.storage.session.get(['activePlatform', 'activeAccount']).then((s) => {
      const p = s['activePlatform'] as string | undefined;
      const a = s['activeAccount'] as string | undefined;
      if (p && a) setActive({ platform: p as Platform, account: a });
    });

    const listener = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
      if (areaName !== 'session') return;
      setActive((prev) => {
        const p = 'activePlatform' in changes ? (changes['activePlatform']?.newValue as Platform | undefined) : prev?.platform;
        const a = 'activeAccount' in changes ? (changes['activeAccount']?.newValue as string | undefined) : prev?.account;
        if (p && a) {
          return { platform: p, account: a };
        }
        return prev;
      });
    };

    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);

  return active;
}
