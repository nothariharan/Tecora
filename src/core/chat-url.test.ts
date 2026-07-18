import { describe, it, expect } from 'vitest';
import { chatUrl, platformHost } from './chat-url';

describe('chatUrl', () => {
  it('uses the right path per platform', () => {
    expect(chatUrl('claude', 'abc-123')).toBe('https://claude.ai/chat/abc-123');
    expect(chatUrl('chatgpt', 'abc-123')).toBe('https://chatgpt.com/c/abc-123');
    expect(chatUrl('gemini', 'abc-123')).toBe('https://gemini.google.com/app/abc-123');
  });
});

describe('platformHost', () => {
  it('maps platforms to hosts', () => {
    expect(platformHost('claude')).toBe('claude.ai');
    expect(platformHost('chatgpt')).toBe('chatgpt.com');
    expect(platformHost('gemini')).toBe('gemini.google.com');
  });
});
