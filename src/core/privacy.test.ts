import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRIVACY_SETTINGS,
  normalizePrivacySettings,
  platformFromChatPk,
} from './privacy';

describe('privacy settings', () => {
  it('normalizes missing settings to capture messages by default', () => {
    expect(normalizePrivacySettings(null)).toEqual(DEFAULT_PRIVACY_SETTINGS);
  });

  it('accepts known platform overrides and ignores malformed values', () => {
    expect(
      normalizePrivacySettings({
        captureMessages: {
          claude: false,
          chatgpt: 'nope',
          gemini: true,
        },
      }),
    ).toEqual({
      captureMessages: {
        claude: false,
        chatgpt: true,
        gemini: true,
      },
    });
  });

  it('reads supported platforms from chat primary keys', () => {
    expect(platformFromChatPk('claude:org:abc')).toBe('claude');
    expect(platformFromChatPk('chatgpt:default:abc')).toBe('chatgpt');
    expect(platformFromChatPk('unknown:default:abc')).toBeNull();
  });
});
