import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { buildExportZip } from './zip-export';
import type { Chat, Message } from './types';
import type { ChatAsset } from './assets';

const chat: Chat = {
  pk: 'claude:org:c1',
  platform: 'claude',
  account: 'org',
  chatId: 'c1',
  title: 'Artifact Demo',
  updatedAt: Date.UTC(2026, 6, 20),
};

const messages: Message[] = [
  {
    pk: 'claude:org:c1:0',
    chatPk: chat.pk,
    role: 'user',
    text: 'make a doc',
    ts: Date.UTC(2026, 6, 20),
  },
  {
    pk: 'claude:org:c1:1',
    chatPk: chat.pk,
    role: 'assistant',
    text: 'done',
    ts: Date.UTC(2026, 6, 20, 0, 1),
  },
];

describe('buildExportZip', () => {
  it('packs conversation markdown plus included assets and lists missing ones', () => {
    const assets: ChatAsset[] = [
      {
        id: 'a1',
        chatId: 'c1',
        platform: 'claude',
        kind: 'artifact',
        filename: 'spec.md',
        source: 'tool_use:artifacts:create',
        text: '# Spec\n',
      },
      {
        id: 'a2',
        chatId: 'c1',
        platform: 'claude',
        kind: 'image',
        filename: 'missing.png',
        source: 'https://example.com/x.png',
        missingReason: 'http 404',
      },
    ];

    const { bytes, included, missing } = buildExportZip(
      [{ chat, messages, assets }],
      'demo',
    );

    expect(included).toBe(1);
    expect(missing).toBe(1);

    const unzipped = unzipSync(bytes);
    const paths = Object.keys(unzipped);
    expect(paths.some((p) => p.endsWith('/conversation.md'))).toBe(true);
    expect(paths.some((p) => p.endsWith('/assets/spec.md'))).toBe(true);
    expect(paths.some((p) => p.endsWith('/MISSING.md'))).toBe(true);
    expect(paths.some((p) => p.endsWith('/README.md'))).toBe(true);

    const mdPath = paths.find((p) => p.endsWith('/conversation.md'))!;
    expect(strFromU8(unzipped[mdPath]!)).toContain('Artifact Demo');
    expect(strFromU8(unzipped[mdPath]!)).toContain('make a doc');

    const missingPath = paths.find((p) => p.endsWith('/MISSING.md'))!;
    expect(strFromU8(unzipped[missingPath]!)).toContain('missing.png');
  });

  it('works for chatgpt and gemini chat folders in one zip', () => {
    const gpt: Chat = { ...chat, pk: 'chatgpt:default:g1', platform: 'chatgpt', chatId: 'g1', title: 'GPT Chat' };
    const gem: Chat = { ...chat, pk: 'gemini:default:m1', platform: 'gemini', chatId: 'm1', title: 'Gemini Chat' };

    const { bytes } = buildExportZip(
      [
        { chat: gpt, messages, assets: [] },
        {
          chat: gem,
          messages,
          assets: [
            {
              id: 'img',
              chatId: 'm1',
              platform: 'gemini',
              kind: 'image',
              filename: 'photo.png',
              source: 'https://lh3.googleusercontent.com/x',
              base64: btoa('fakepng'),
            },
          ],
        },
      ],
      'all-platforms',
    );

    const paths = Object.keys(unzipSync(bytes));
    expect(paths.some((p) => p.includes('gpt-chat') || p.includes('GPT'))).toBe(true);
    expect(paths.some((p) => p.includes('gemini-chat') || p.includes('Gemini'))).toBe(true);
    expect(paths.some((p) => p.endsWith('/assets/photo.png'))).toBe(true);
  });
});
