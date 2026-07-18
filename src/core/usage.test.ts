import { describe, expect, it } from 'vitest';
import { estimateChatUsage, platformUsageEstimate, usageLabel } from './usage';
import type { Chat, Message } from './types';

const chat: Chat = {
  pk: 'claude:org:1',
  platform: 'claude',
  account: 'org',
  chatId: '1',
  title: 'Long research chat',
  updatedAt: 10,
};

function message(idx: number, text: string, ts = 10): Message {
  return {
    pk: `${chat.pk}:${idx}`,
    chatPk: chat.pk,
    role: idx % 2 === 0 ? 'user' : 'assistant',
    text,
    ts,
  };
}

describe('usage estimates', () => {
  it('estimates approximate tokens from captured message text', () => {
    const estimate = estimateChatUsage([message(0, 'a'.repeat(400))]);
    expect(estimate.characterCount).toBe(400);
    expect(estimate.approximateTokens).toBe(100);
    expect(estimate.level).toBe('normal');
  });

  it('labels long and very long chats without claiming exact platform quota', () => {
    const long = estimateChatUsage([message(0, 'a'.repeat(32_000))]);
    expect(long.level).toBe('long');
    expect(usageLabel(long)).toBe('Long chat (~8k tokens)');

    const veryLong = estimateChatUsage([message(0, 'a'.repeat(64_000))]);
    expect(veryLong.level).toBe('very_long');
    expect(usageLabel(veryLong)).toBe('Very long chat (~16k tokens)');
  });

  it('summarizes recent local activity by platform', () => {
    const now = Date.parse('2026-07-18T12:00:00.000Z');
    const recent = message(0, 'recent', now - 60_000);
    const old = message(1, 'old', now - 6 * 60 * 60 * 1000);
    const byChat = new Map([[chat.pk, [recent, old]]]);

    const estimate = platformUsageEstimate('claude', [chat], byChat, now);
    expect(estimate.messagesLastFiveHours).toBe(1);
    expect(estimate.chatsTouchedLastFiveHours).toBe(1);
  });
});
