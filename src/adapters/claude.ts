import type { Adapter } from './base';
import type { Chat, HealthState, Message } from '@/src/core/types';

// claude's conversation object — only the fields we actually pull out
interface RawClaudeChat {
  uuid: string;
  name: string | null;
  updated_at: string;
  created_at: string;
}

function isRawClaudeChat(x: unknown): x is RawClaudeChat {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o['uuid'] === 'string' && typeof o['updated_at'] === 'string';
}

// conversation-detail shape from
//   GET /api/organizations/{org}/chat_conversations/{uuid}?rendering_mode=messages
interface RawClaudeContentBlock {
  type?: string;
  text?: string;
}
interface RawClaudeMessage {
  uuid?: string;
  sender?: string; // 'human' | 'assistant'
  text?: string;
  content?: RawClaudeContentBlock[];
  created_at?: string;
}

// pull readable text out of a claude message. newer responses put the body in
// `content[].text` blocks; older ones use a flat `text`. prefer blocks, fall back.
function messageText(m: RawClaudeMessage): string {
  if (Array.isArray(m.content)) {
    const joined = m.content
      .map((b) => (typeof b?.text === 'string' ? b.text : ''))
      .filter(Boolean)
      .join('\n\n')
      .trim();
    if (joined) return joined;
  }
  return typeof m.text === 'string' ? m.text : '';
}

// turn a raw conversation-detail payload into our Message[]. tolerant of the
// array being bare or wrapped under `chat_messages`.
export function normalizeMessages(chatPk: string, data: unknown): Message[] {
  let raw: unknown[] = [];
  if (Array.isArray(data)) {
    raw = data;
  } else if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    const arr = o['chat_messages'] ?? o['messages'];
    if (Array.isArray(arr)) raw = arr;
  }

  const messages: Message[] = [];
  raw.forEach((item, index) => {
    if (typeof item !== 'object' || item === null) return;
    const m = item as RawClaudeMessage;
    const role: Message['role'] =
      m.sender === 'human' ? 'user' : m.sender === 'assistant' ? 'assistant' : 'system';
    messages.push({
      pk: `${chatPk}:${index}`,
      chatPk,
      role,
      text: messageText(m),
      ts: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
    });
  });
  return messages;
}

export class ClaudeAdapter implements Adapter {
  readonly id = 'claude' as const;

  readonly capabilities = {
    archive: false,
    delete: false,
    rename: false,
    exportMessages: true,
  };

  // staging cache — normalizes raw api data before background.ts writes to dexie.
  private chatCache = new Map<string, Chat>();
  private account: string | null = null;
  private lastIngestAt: number | null = null;

  matches(url: URL): boolean {
    return url.hostname === 'claude.ai';
  }

  // called from content.ts when L0 catches a chat-list response.
  // not on the Adapter interface bc ingestion is platform-specific shape work.
  ingestRaw(raw: unknown[], account: string): void {
    this.account = account;
    this.lastIngestAt = Date.now();

    for (const item of raw) {
      if (!isRawClaudeChat(item)) continue;

      const pk = `claude:${account}:${item.uuid}`;
      this.chatCache.set(item.uuid, {
        pk,
        platform: 'claude',
        account,
        chatId: item.uuid,
        title: item.name ?? 'untitled chat',
        updatedAt: new Date(item.updated_at).getTime(),
      });
    }
  }

  async listChats(): Promise<Chat[]> {
    return [...this.chatCache.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // needs its own endpoint intercept — not wired yet
  async getMessages(_chatId: string): Promise<Message[]> {
    return [];
  }

  async currentAccount(): Promise<string | null> {
    return this.account;
  }

  async archive(_chatId: string): Promise<void> {
    throw new Error('archive not implemented yet');
  }

  async delete(_chatId: string): Promise<void> {
    throw new Error('delete not implemented yet');
  }

  openChat(chatId: string): void {
    window.location.href = `/chat/${chatId}`;
  }

  async health(): Promise<HealthState> {
    if (this.lastIngestAt === null) {
      return { level: 'degraded', failing: ['no chat data received yet'] };
    }
    if (this.chatCache.size > 0) {
      return { level: 'green' };
    }
    // interceptor ran but nothing parsed — new account or schema drift
    return { level: 'degraded', failing: ['intercepted response had no recognisable chats'] };
  }
}
