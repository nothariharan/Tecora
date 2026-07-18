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
