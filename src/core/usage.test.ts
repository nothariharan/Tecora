import { describe, expect, it } from 'vitest';
import {
  estimateChatUsage,
  formatReset,
  parseChatGPTUsage,
  parseClaudeUsage,
  platformUsageEstimate,
  usageLabel,
} from './usage';
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

describe('live usage parsers', () => {
  const now = Date.parse('2026-07-21T09:00:00.000Z');

  it('parses claude usage fractions + reset time into percent windows', () => {
    const usage = parseClaudeUsage(
      {
        plan: 'pro',
        five_hour: { utilization: 0.42, resets_at: '2026-07-21T10:00:00.000Z' },
        seven_day: { utilization: 0.1 },
      },
      now,
    );
    expect(usage).not.toBeNull();
    expect(usage!.planType).toBe('pro');
    expect(usage!.windows).toHaveLength(2);
    expect(usage!.windows[0]).toMatchObject({ label: '5h', usedPercent: 42 });
    expect(usage!.windows[0].resetsAt).toBe(Date.parse('2026-07-21T10:00:00.000Z'));
    expect(usage!.windows[1]).toMatchObject({ label: '7d', usedPercent: 10, resetsAt: null });
  });

  it('parses chatgpt wham usage with reset_after_seconds', () => {
    const usage = parseChatGPTUsage(
      {
        plan_type: 'plus',
        primary: { used_percent: 80, reset_after_seconds: 3600, limit_reached: false },
        secondary: { used_percent: 12, reset_after_seconds: 200000 },
      },
      now,
    );
    expect(usage).not.toBeNull();
    expect(usage!.planType).toBe('plus');
    expect(usage!.windows[0]).toMatchObject({ label: '5h', usedPercent: 80 });
    expect(usage!.windows[0].resetsAt).toBe(now + 3600 * 1000);
    expect(usage!.limitReached).toBe(false);
  });

  it('returns null on unrecognisable payloads so callers fall back to estimates', () => {
    expect(parseClaudeUsage(null)).toBeNull();
    expect(parseClaudeUsage({ nonsense: true })).toBeNull();
    expect(parseChatGPTUsage({})).toBeNull();
  });

  it('formats reset countdowns', () => {
    expect(formatReset(now + 40 * 60000, now)).toBe('resets in 40m');
    expect(formatReset(now + 3 * 3600 * 1000, now)).toBe('resets in 3h');
    expect(formatReset(null)).toBeNull();
  });
});
