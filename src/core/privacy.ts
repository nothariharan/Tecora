import type { Platform, PrivacySettings } from './types';

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  captureMessages: {
    claude: true,
    chatgpt: true,
    gemini: true,
  },
};

const PLATFORMS: Platform[] = ['claude', 'chatgpt', 'gemini'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function normalizePrivacySettings(value: unknown): PrivacySettings {
  if (!isRecord(value) || !isRecord(value['captureMessages'])) {
    return DEFAULT_PRIVACY_SETTINGS;
  }

  const rawCapture = value['captureMessages'];
  const captureMessages = { ...DEFAULT_PRIVACY_SETTINGS.captureMessages };
  for (const platform of PLATFORMS) {
    const raw = rawCapture[platform];
    if (typeof raw === 'boolean') {
      captureMessages[platform] = raw;
    }
  }

  return { captureMessages };
}

export function platformFromChatPk(chatPk: string): Platform | null {
  const [platform] = chatPk.split(':');
  return platform === 'claude' || platform === 'chatgpt' || platform === 'gemini'
    ? platform
    : null;
}
