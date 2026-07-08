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

    const listener = (changes: Record<string, { newValue?: unknown }>) => {
      const p = changes['activePlatform']?.newValue as string | undefined;
      const a = changes['activeAccount']?.newValue as string | undefined;
      if (p && a) setActive({ platform: p as Platform, account: a });
    };

    browser.storage.session.onChanged.addListener(listener);
    return () => browser.storage.session.onChanged.removeListener(listener);
  }, []);

  return active;
}
