import type { Chat, Message } from './types';

const GENERIC_TITLE_RE = /^(new chat|untitled chat|new conversation|untitled|chat)$/i;

function cleanInlineText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function truncate(text: string, max: number): string {
  const clean = cleanInlineText(text);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function isGenericChatTitle(title: string): boolean {
  return GENERIC_TITLE_RE.test(cleanInlineText(title));
}

export function deriveChatTitle(chat: Chat, messages: Message[]): string {
  if (!isGenericChatTitle(chat.title)) return chat.title;

  const firstUser = messages.find((message) => message.role === 'user' && message.text.trim());
  const firstAny = messages.find((message) => message.text.trim());
  const source = firstUser ?? firstAny;
  if (!source) return chat.title;

  return truncate(source.text, 64);
}

export function deriveChatPreview(messages: Message[]): string | null {
  const firstUser = messages.find((message) => message.role === 'user' && message.text.trim());
  const firstAssistant = messages.find((message) => message.role === 'assistant' && message.text.trim());

  if (firstUser && firstAssistant) {
    return `${truncate(firstUser.text, 76)} → ${truncate(firstAssistant.text, 88)}`;
  }

  const first = firstUser ?? firstAssistant ?? messages.find((message) => message.text.trim());
  return first ? truncate(first.text, 140) : null;
}

export function sortMemoryChats(chats: Chat[]): Chat[] {
  return [...chats].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}
