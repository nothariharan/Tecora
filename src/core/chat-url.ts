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
