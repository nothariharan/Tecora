import type { Platform } from './types';

const HOST: Record<Platform, string> = {
  claude: 'claude.ai',
  chatgpt: 'chatgpt.com',
  gemini: 'gemini.google.com',
};

// platform path shapes differ — never assume /chat/{id}
export function chatUrl(platform: Platform, chatId: string): string {
  if (platform === 'chatgpt') return `https://${HOST.chatgpt}/c/${chatId}`;
  if (platform === 'gemini') return `https://${HOST.gemini}/app/${chatId}`;
  return `https://${HOST.claude}/chat/${chatId}`;
}

export function platformHost(platform: Platform): string {
  return HOST[platform];
}

// pull the open conversation id out of a platform url, or null on a non-chat page
export function chatIdFromUrl(platform: Platform, url: string): string | null {
  try {
    const { pathname } = new URL(url);
    if (platform === 'claude') return pathname.match(/\/chat\/([0-9a-f-]{8,})/i)?.[1] ?? null;
    if (platform === 'chatgpt') return pathname.match(/\/(?:c|g\/[^/]+\/c)\/([0-9a-f-]{8,})/i)?.[1] ?? null;
    if (platform === 'gemini') return pathname.match(/\/(?:app|chat)\/([a-zA-Z0-9_-]+)/)?.[1] ?? null;
  } catch {
    // ignore bad urls
  }
  return null;
}

// map a tab url to the platform we support, or null if it's not one of ours
export function platformFromUrl(url: string | undefined | null): Platform | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    if (host === 'claude.ai' || host.endsWith('.claude.ai')) return 'claude';
    if (host === 'chatgpt.com' || host.endsWith('.chatgpt.com')) return 'chatgpt';
    if (host === 'gemini.google.com' || host.endsWith('.gemini.google.com')) return 'gemini';
  } catch {
    // ignore bad urls
  }
  return null;
}
