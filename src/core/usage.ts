import type { Chat, Message, Platform } from './types';

export interface ChatUsageEstimate {
  messageCount: number;
  characterCount: number;
  approximateTokens: number;
  level: 'normal' | 'long' | 'very_long';
}

export interface PlatformUsageEstimate {
  platform: Platform;
  messagesLastFiveHours: number;
  chatsTouchedLastFiveHours: number;
  longestChat?: {
    chatPk: string;
    title: string;
    messageCount: number;
    approximateTokens: number;
    level: ChatUsageEstimate['level'];
  };
}

// real usage pulled from the platform's own (undocumented) endpoints. these are
// best-effort adapters — a null result means "fall back to the local estimate",
// never "show zero as if it were live".
export interface LiveUsageWindow {
  key: string;
  label: string; // '5h' | '7d'
  usedPercent: number; // 0-100
  resetsAt: number | null; // epoch ms
}

export interface PlatformLiveUsage {
  platform: Platform;
  planType: string | null;
  windows: LiveUsageWindow[];
  limitReached: boolean;
  fetchedAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

// accept either a 0-1 fraction or an already-percent number, clamp to 0-100
function fractionToPercent(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const pct = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function parseResetTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // heuristic: seconds vs ms epoch
    return value < 1e12 ? Math.round(value * 1000) : Math.round(value);
  }
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

function parseClaudeWindow(
  window: unknown,
): { usedPercent: number; resetsAt: number | null } | null {
  if (typeof window === 'number') {
    const pct = fractionToPercent(window);
    return pct === null ? null : { usedPercent: pct, resetsAt: null };
  }
  if (!isRecord(window)) return null;
  const pct =
    fractionToPercent(window['utilization']) ??
    fractionToPercent(window['used']) ??
    fractionToPercent(window['used_percent']);
  if (pct === null) return null;
  const resetsAt =
    parseResetTimestamp(window['resets_at']) ??
    parseResetTimestamp(window['reset_at']) ??
    parseResetTimestamp(window['resets_at_utc']);
  return { usedPercent: pct, resetsAt };
}

// Claude: GET /api/organizations/{org}/usage — % used + reset per window
export function parseClaudeUsage(data: unknown, now = Date.now()): PlatformLiveUsage | null {
  if (!isRecord(data)) return null;
  const defs: [string, string][] = [
    ['five_hour', '5h'],
    ['seven_day', '7d'],
  ];
  const windows: LiveUsageWindow[] = [];
  for (const [key, label] of defs) {
    const parsed = parseClaudeWindow(data[key]);
    if (parsed) windows.push({ key, label, ...parsed });
  }
  if (windows.length === 0) return null;
  return {
    platform: 'claude',
    planType: readString(data['plan']) ?? readString(data['plan_type']),
    windows,
    limitReached: windows.some((w) => w.usedPercent >= 100),
    fetchedAt: now,
  };
}

// ChatGPT: GET /backend-api/wham/usage — primary (~5h) / secondary (~7d)
export function parseChatGPTUsage(data: unknown, now = Date.now()): PlatformLiveUsage | null {
  if (!isRecord(data)) return null;
  const defs: [string, string][] = [
    ['primary', '5h'],
    ['secondary', '7d'],
  ];
  const windows: LiveUsageWindow[] = [];
  let limitReached = false;
  for (const [key, label] of defs) {
    const window = data[key];
    if (!isRecord(window)) continue;
    const pct = fractionToPercent(window['used_percent']);
    if (pct === null) continue;
    const resetAfter = window['reset_after_seconds'];
    const resetsAt =
      typeof resetAfter === 'number' && Number.isFinite(resetAfter)
        ? now + Math.round(resetAfter * 1000)
        : parseResetTimestamp(window['resets_at']);
    if (window['limit_reached'] === true) limitReached = true;
    windows.push({ key, label, usedPercent: pct, resetsAt });
  }
  if (typeof data['limit_reached'] === 'boolean') {
    limitReached = limitReached || data['limit_reached'];
  }
  if (windows.length === 0) return null;
  return {
    platform: 'chatgpt',
    planType: readString(data['plan_type']),
    windows,
    limitReached,
    fetchedAt: now,
  };
}

// "resets in 40m" / "resets in 2h" — null when we don't have a reset time
export function formatReset(resetsAt: number | null, now = Date.now()): string | null {
  if (resetsAt === null) return null;
  const diff = resetsAt - now;
  if (diff <= 0) return 'resetting now';
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `resets in ${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `resets in ${hrs}h`;
  return `resets in ${Math.round(hrs / 24)}d`;
}

export function estimateChatUsage(messages: Message[]): ChatUsageEstimate {
  const characterCount = messages.reduce((sum, message) => sum + message.text.length, 0);
  const approximateTokens = Math.ceil(characterCount / 4);
  const messageCount = messages.length;
  const level: ChatUsageEstimate['level'] =
    approximateTokens >= 16000 || messageCount >= 80
      ? 'very_long'
      : approximateTokens >= 8000 || messageCount >= 40
        ? 'long'
        : 'normal';

  return {
    messageCount,
    characterCount,
    approximateTokens,
    level,
  };
}

export function usageLabel(estimate: ChatUsageEstimate): string | null {
  if (estimate.level === 'normal') return null;
  const tokenText =
    estimate.approximateTokens >= 1000
      ? `~${Math.round(estimate.approximateTokens / 100) / 10}k tokens`
      : `~${estimate.approximateTokens} tokens`;
  return estimate.level === 'very_long'
    ? `Very long chat (${tokenText})`
    : `Long chat (${tokenText})`;
}

export function platformUsageEstimate(
  platform: Platform,
  chats: Chat[],
  messagesByChatPk: Map<string, Message[]>,
  now = Date.now(),
): PlatformUsageEstimate {
  const fiveHoursAgo = now - 5 * 60 * 60 * 1000;
  let messagesLastFiveHours = 0;
  let chatsTouchedLastFiveHours = 0;
  let longest: PlatformUsageEstimate['longestChat'] | undefined;

  for (const chat of chats.filter((c) => c.platform === platform)) {
    const messages = messagesByChatPk.get(chat.pk) ?? [];
    const recentMessages = messages.filter((message) => message.ts >= fiveHoursAgo);
    messagesLastFiveHours += recentMessages.length;
    if (recentMessages.length > 0) chatsTouchedLastFiveHours++;

    const estimate = estimateChatUsage(messages);
    if (
      estimate.level !== 'normal' &&
      (!longest || estimate.approximateTokens > longest.approximateTokens)
    ) {
      longest = {
        chatPk: chat.pk,
        title: chat.title,
        messageCount: estimate.messageCount,
        approximateTokens: estimate.approximateTokens,
        level: estimate.level,
      };
    }
  }

  return {
    platform,
    messagesLastFiveHours,
    chatsTouchedLastFiveHours,
    longestChat: longest,
  };
}
