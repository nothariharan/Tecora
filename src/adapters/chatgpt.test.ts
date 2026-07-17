import { describe, it, expect } from 'vitest';
import { normalizeChatGPTMessages } from './chatgpt';

describe('ChatGPTAdapter messages normalizer', () => {
  it('should parse raw mapping payload into unified messages format', () => {
    const rawPayload = {
      mapping: {
        'node-1': {
          message: {
            id: 'msg-1',
            author: { role: 'user' },
            content: { content_type: 'text', parts: ['hello how are you'] },
            create_time: 1721200000.123,
          },
        },
        'node-2': {
          message: {
            id: 'msg-2',
            author: { role: 'assistant' },
            content: { content_type: 'text', parts: ['i am doing great thanks'] },
            create_time: 1721200005.456,
          },
        },
        'node-system': {
          message: {
            id: 'msg-sys',
            author: { role: 'system' },
            content: { content_type: 'text', parts: ['system instruction'] },
            create_time: 1721199999.0,
          },
        },
      },
    };

    const chatPk = 'chatgpt:default:chat-uuid';
    const messages = normalizeChatGPTMessages(chatPk, rawPayload);

    expect(messages).toHaveLength(3);
    expect(messages[0].role).toBe('system');
    expect(messages[0].text).toBe('system instruction');
    expect(messages[0].ts).toBe(1721199999000);

    expect(messages[1].role).toBe('user');
    expect(messages[1].text).toBe('hello how are you');
    expect(messages[1].ts).toBe(1721200000123);

    expect(messages[2].role).toBe('assistant');
    expect(messages[2].text).toBe('i am doing great thanks');
    expect(messages[2].ts).toBe(1721200005456);
  });
});
