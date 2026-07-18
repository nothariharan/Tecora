import { describe, it, expect } from 'vitest';
import {
  bulkToMarkdown,
  chatToMarkdown,
  isPortableArchive,
  portableArchive,
  slugify,
} from './export';
import type { Chat, Message } from './types';

const chat: Chat = {
  pk: 'claude:org:1',
  platform: 'claude',
  account: 'org',
  chatId: '1',
  title: 'Hello World!',
  updatedAt: Date.parse('2026-07-01T00:00:00.000Z'),
};

describe('export markdown', () => {
  it('slugifies titles', () => {
    expect(slugify('Hello World!')).toBe('hello-world');
    expect(slugify('')).toBe('chat');
  });

  it('marks empty conversations honestly', () => {
    const md = chatToMarkdown(chat, []);
    expect(md).toContain('tecora_export: 1');
    expect(md).toContain('platform: claude');
    expect(md).toContain('chat_id: "1"');
    expect(md).toContain('message_count: 0');
    expect(md).toContain('# Hello World!');
    expect(md).toContain('_No messages captured for this conversation._');
  });

  it('renders filled turns', () => {
    const messages: Message[] = [
      { pk: 'claude:org:1:0', chatPk: chat.pk, role: 'user', text: 'hi', ts: 1 },
      { pk: 'claude:org:1:1', chatPk: chat.pk, role: 'assistant', text: 'hello', ts: 2 },
    ];
    const md = chatToMarkdown(chat, messages);
    expect(md).toContain('**You**');
    expect(md).toContain('hi');
    expect(md).toContain('**Claude**');
    expect(md).toContain('hello');
  });

  it('bulk export includes empty placeholders', () => {
    const md = bulkToMarkdown([{ chat, messages: [] }], 'selected');
    expect(md).toContain('export_type: bulk_markdown');
    expect(md).toContain('chat_count: 1');
    expect(md).toContain('<!-- tecora: platform=claude account="org" chat_id="1" messages=0 -->');
    expect(md).toContain('# selected');
    expect(md).toContain('_No messages captured._');
  });

  it('builds a portable archive with chats and messages intact', () => {
    const messages: Message[] = [
      { pk: 'claude:org:1:0', chatPk: chat.pk, role: 'user', text: 'continue this', ts: 1 },
    ];
    const archive = portableArchive([{ chat, messages }]);

    expect(archive).toMatchObject({
      tecora_export: 1,
      export_type: 'portable_archive',
      chat_count: 1,
      message_count: 1,
    });
    expect(archive.chats[0]?.chat).toEqual(chat);
    expect(archive.chats[0]?.messages).toEqual(messages);
    expect(isPortableArchive(archive)).toBe(true);
  });

  it('rejects malformed portable archives', () => {
    expect(isPortableArchive({ tecora_export: 1, export_type: 'portable_archive' })).toBe(false);
    expect(
      isPortableArchive({
        tecora_export: 1,
        export_type: 'portable_archive',
        chats: [{ chat, messages: [{ pk: 'bad', chatPk: 'other', role: 'user', text: 'x', ts: 1 }] }],
      }),
    ).toBe(false);
  });
});
