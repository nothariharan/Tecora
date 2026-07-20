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
