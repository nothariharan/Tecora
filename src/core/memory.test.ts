import { describe, expect, it } from 'vitest';
import {
  deriveChatPreview,
  deriveChatTitle,
  isGenericChatTitle,
  sortMemoryChats,
} from './memory';
import type { Chat, Message } from './types';

const chat: Chat = {
  pk: 'chatgpt:default:1',
  platform: 'chatgpt',
  account: 'default',
  chatId: '1',
  title: 'New chat',
  updatedAt: 10,
};

describe('memory helpers', () => {
  it('detects generic platform titles', () => {
    expect(isGenericChatTitle('New chat')).toBe(true);
    expect(isGenericChatTitle('Untitled Chat')).toBe(true);
    expect(isGenericChatTitle('Trip plan')).toBe(false);
  });

  it('derives a local title from the first user message only for generic titles', () => {
    const messages: Message[] = [
      {
        pk: 'chatgpt:default:1:0',
        chatPk: chat.pk,
        role: 'user',
        text: 'Help me plan a Kyoto trip for early spring with museums and food.',
        ts: 1,
      },
    ];

    expect(deriveChatTitle(chat, messages)).toBe(
      'Help me plan a Kyoto trip for early spring with museums and foo…',
    );
    expect(deriveChatTitle({ ...chat, title: 'Existing title' }, messages)).toBe('Existing title');
  });

  it('derives a recall preview from the first exchange', () => {
    const messages: Message[] = [
      { pk: '1', chatPk: chat.pk, role: 'user', text: 'What is indexeddb?', ts: 1 },
      { pk: '2', chatPk: chat.pk, role: 'assistant', text: 'IndexedDB is a browser database.', ts: 2 },
    ];

    expect(deriveChatPreview(messages)).toBe(
      'What is indexeddb? → IndexedDB is a browser database.',
    );
  });

  it('sorts pinned chats first, then newest first', () => {
    const chats: Chat[] = [
      { ...chat, pk: 'old', updatedAt: 1 },
      { ...chat, pk: 'new', updatedAt: 3 },
      { ...chat, pk: 'pinned', pinned: true, updatedAt: 2 },
    ];

    expect(sortMemoryChats(chats).map((c) => c.pk)).toEqual(['pinned', 'new', 'old']);
  });
});
