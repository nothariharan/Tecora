import bakedSelectors from '@/config/selectors.v1.json';
import type { Platform } from './types';

export interface SelectorConfig {
  version: number;
  claude: {
    chatListItem: string[];
    chatMenuButton: string[];
    deleteMenuItem: string[];
    confirmDeleteBtn: string[];
  };
  chatgpt: {
    chatListItem: string[];
    chatMenuButton: string[];
    deleteMenuItem: string[];
    confirmDeleteBtn: string[];
  };
}

const STORAGE_KEY = 'tecora_remote_selectors';
const REMOTE_CONFIG_URL = 'https://raw.githubusercontent.com/nothariharan/Tecora/main/config/selectors.v1.json';

export async function getSelectors(): Promise<SelectorConfig> {
  try {
    const data = await browser.storage.local.get(STORAGE_KEY);
    if (typeof data[STORAGE_KEY] === 'string') {
      const parsed = JSON.parse(data[STORAGE_KEY] as string) as SelectorConfig;
      if (parsed.version >= bakedSelectors.version) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[tecora] failed to read stored selectors config:', err);
  }
  return bakedSelectors as unknown as SelectorConfig;
}

export async function fetchRemoteConfig(): Promise<void> {
  try {
    const res = await fetch(REMOTE_CONFIG_URL);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json() as SelectorConfig;
    if (typeof json.version === 'number' && json.claude) {
      await browser.storage.local.set({ [STORAGE_KEY]: JSON.stringify(json) });
      console.log('[tecora] successfully updated remote selectors config to version', json.version);
    }
  } catch (err) {
    console.error('[tecora] failed to fetch remote selectors config:', err);
  }
}
