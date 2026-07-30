import { useEffect, useState } from 'react';
import type { Platform } from '@/src/core/types';
import type { PlatformLiveUsage } from '@/src/core/usage';
import type { RuntimeRequest, RuntimeResponse } from '@/src/core/bus';

// pull real usage from the active tab's content script (authed page context).
// null = couldn't read it → caller shows the local estimate instead.
export function useLiveUsage(platform: Platform | null): PlatformLiveUsage | null {
  const [usage, setUsage] = useState<PlatformLiveUsage | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUsage(null);
    // gemini has no usage endpoint we can read
    if (!platform || platform === 'gemini') return;

    void (async () => {
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0]?.id;
        if (tabId == null) return;
        const res = (await browser.tabs.sendMessage(tabId, {
          type: 'get_usage',
        } satisfies RuntimeRequest)) as RuntimeResponse;
        if (!cancelled && res?.type === 'get_usage_ok') setUsage(res.usage);
      } catch {
        // content script not ready / not a platform tab — stay on local estimate
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [platform]);

  return usage;
}
