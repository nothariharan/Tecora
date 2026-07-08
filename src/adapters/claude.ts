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

export class ClaudeAdapter implements Adapter {
  readonly id = 'claude' as const;

  readonly capabilities = {
    archive: false,
    delete: false,
    rename: false,
    exportMessages: false,
  };

  // per-tab cache for now. dexie takes over in m2 once folders need to survive reloads.
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
