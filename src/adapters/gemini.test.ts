/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { GeminiAdapter } from './gemini';

describe('GeminiAdapter scrape helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // jsdom location is sticky; set via history when available
    window.history.pushState({}, '', '/app/chat-abc');
  });

  it('scrapes sidebar chat links into Chat objects', () => {
    document.body.innerHTML = `
      <a href="/app/chat-abc">First chat</a>
      <a href="/app/chat-xyz">Second chat</a>
      <a href="/app/new">New chat</a>
    `;
    const adapter = new GeminiAdapter();
    const chats = adapter.scrapeChatsFromDOM('acct-1');
    expect(chats.map((c) => c.chatId).sort()).toEqual(['chat-abc', 'chat-xyz']);
    expect(chats[0]?.account).toBe('acct-1');
    expect(chats[0]?.platform).toBe('gemini');
    expect(chats[0]?.pk).toContain('gemini:acct-1:');
  });

  it('scrapes role-attributed messages from open chat', () => {
    document.body.innerHTML = `
      <div data-message-author-role="user">what is 2+2</div>
      <div data-message-author-role="assistant">4</div>
    `;
    const adapter = new GeminiAdapter();
    const messages = adapter.scrapeMessagesFromDOM('chat-abc', 'acct-1');
    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe('user');
    expect(messages[0]?.text).toBe('what is 2+2');
    expect(messages[1]?.role).toBe('assistant');
    expect(messages[1]?.text).toBe('4');
  });

  it('reads chat id from url', () => {
    const adapter = new GeminiAdapter();
    expect(adapter.currentChatIdFromUrl()).toBe('chat-abc');
  });
});
