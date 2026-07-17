import { describe, expect, it } from 'vitest';
import { ClaudeAdapter } from '../adapters/claude';
import { rebuildIndex, upsertChatsIntoIndex } from './search';
import type { Chat } from './types';
import { isPageEnvelope, PAGE_MSG_KEY } from './bus';

describe('claude adapter', () => {
  it('normalizes raw api rows into chats', async () => {
    const adapter = new ClaudeAdapter();
    adapter.ingestRaw(
      [
        {
          uuid: 'aaa',
          name: 'refactor notes',
          updated_at: '2026-07-01T10:00:00.000Z',
          created_at: '2026-07-01T09:00:00.000Z',
        },
        {
          uuid: 'bbb',
          name: null,
          updated_at: '2026-07-02T10:00:00.000Z',
          created_at: '2026-07-02T09:00:00.000Z',
        },
        { nonsense: true },
      ],
      'org-1',
    );

    const chats = await adapter.listChats();
    expect(chats).toHaveLength(2);
    expect(chats[0]?.chatId).toBe('bbb'); // newest first
    expect(chats[0]?.title).toBe('untitled chat');
    expect(chats[1]?.pk).toBe('claude:org-1:aaa');
    expect(await adapter.health()).toEqual({ level: 'green' });
  });

  it('stays degraded until real data shows up', async () => {
    const adapter = new ClaudeAdapter();
    expect(await adapter.health()).toMatchObject({ level: 'degraded' });

    adapter.ingestRaw([], 'org-1');
    expect(await adapter.health()).toMatchObject({ level: 'degraded' });
  });
});

describe('search index', () => {
  const sample: Chat[] = [
    {
      pk: 'claude:o:1',
      platform: 'claude',
      account: 'o',
      chatId: '1',
      title: 'shipping the palette',
      updatedAt: 2,
    },
    {
      pk: 'claude:o:2',
      platform: 'claude',
      account: 'o',
      chatId: '2',
      title: 'dexie folders',
      updatedAt: 1,
    },
  ];

  it('finds chats by title prefix', () => {
    const index = rebuildIndex(sample);
    const hits = index.search('palette');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.id).toBe('claude:o:1');
  });

  it('finds chats by message content', () => {
    const index = rebuildIndex(sample, [
      {
        pk: 'claude:o:1:0',
        chatPk: 'claude:o:1',
        role: 'user',
        text: 'we should build a glassmorphic sidebar component',
        ts: 1,
      },
    ]);
    const hits = index.search('glassmorphic');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.id).toBe('claude:o:1');
  });

  it('updates an existing doc on upsert', async () => {
    const index = rebuildIndex(sample);
    await upsertChatsIntoIndex(index, [
      { ...sample[0]!, title: 'shipping the command palette' },
    ]);
    expect(index.search('command')).toHaveLength(1);
  });
});

describe('bus envelope', () => {
  it('only accepts tagged page messages', () => {
    expect(isPageEnvelope({ hello: true })).toBe(false);
    expect(
      isPageEnvelope({
        [PAGE_MSG_KEY]: true,
        msg: { kind: 'hello', from: 'injected', at: 1 },
      }),
    ).toBe(true);
  });
});
