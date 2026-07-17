import type { Adapter } from './base';
import type { Chat, HealthState, Message } from '@/src/core/types';
import { getSelectors } from '@/src/core/config';

interface RawChatGPTMessageNode {
  message?: {
    id: string;
    author: {
      role: 'user' | 'assistant' | 'system';
    };
    content: {
      content_type: string;
      parts?: unknown[];
    };
    create_time?: number;
  };
}

export function normalizeChatGPTMessages(chatPk: string, data: unknown): Message[] {
  if (typeof data !== 'object' || data === null) return [];
  const mapping = (data as Record<string, unknown>)['mapping'];
  if (typeof mapping !== 'object' || mapping === null) return [];

  const messages: Message[] = [];
  const nodes = Object.values(mapping) as RawChatGPTMessageNode[];

  // sort nodes by create_time if available, or keep order
  const validNodes = nodes
    .filter((n) => n.message && n.message.author && n.message.content)
    .sort((a, b) => {
      const ta = a.message?.create_time ?? 0;
      const tb = b.message?.create_time ?? 0;
      return ta - tb;
    });

  validNodes.forEach((node, index) => {
    const msg = node.message!;
    const role = msg.author.role;
    if (role !== 'user' && role !== 'assistant' && role !== 'system') return;

    let text = '';
    if (Array.isArray(msg.content.parts)) {
      text = msg.content.parts
        .map((p) => (typeof p === 'string' ? p : ''))
        .filter(Boolean)
        .join('\n');
    }

    if (!text.trim()) return;

    messages.push({
      pk: `${chatPk}:${index}`,
      chatPk,
      role: role === 'user' ? 'user' : role === 'assistant' ? 'assistant' : 'system',
      text,
      ts: msg.create_time ? msg.create_time * 1000 : Date.now(),
    });
  });

  return messages;
}

export class ChatGPTAdapter implements Adapter {
  readonly id = 'chatgpt' as const;

  readonly capabilities = {
    archive: false,
    delete: true,
    rename: false,
    exportMessages: true,
  };

  private chatCache = new Map<string, Chat>();
  private account: string | null = null;
  private lastIngestAt: number | null = null;

  matches(url: URL): boolean {
    return url.hostname.includes('chatgpt.com');
  }

  ingestRaw(items: unknown[], account: string): void {
    this.account = account;
    this.lastIngestAt = Date.now();

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const raw = item as { id?: unknown; title?: unknown; create_time?: unknown; update_time?: unknown };
      if (typeof raw.id !== 'string') continue;

      const title = typeof raw.title === 'string' ? raw.title : 'Untitled Chat';
      const createdAt = typeof raw.create_time === 'number' ? raw.create_time * 1000 : Date.now();
      const updatedAt = typeof raw.update_time === 'number' ? raw.update_time * 1000 : createdAt;

      const chat: Chat = {
        pk: `${this.id}:${account}:${raw.id}`,
        chatId: raw.id,
        platform: this.id,
        account,
        title,
        updatedAt,
      };
      this.chatCache.set(raw.id, chat);
    }
  }

  async listChats(): Promise<Chat[]> {
    return Array.from(this.chatCache.values());
  }

  async getMessages(_chatId: string): Promise<Message[]> {
    // retrieved via network interception L0 on demand
    return [];
  }

  async currentAccount(): Promise<string | null> {
    return this.account;
  }

  async archive(_chatId: string): Promise<void> {
    throw new Error('archive not implemented yet');
  }

  async delete(chatId: string): Promise<void> {
    const selectors = (await getSelectors()).chatgpt;

    // 1. Find sidebar list item for chatId
    const itemSelector = `a[href*="/c/${chatId}"]`;
    const chatItem = document.querySelector(itemSelector) as HTMLElement | null;
    if (!chatItem) {
      throw new Error(`Could not find sidebar item for chat ${chatId}`);
    }

    chatItem.scrollIntoView({ block: 'center' });

    // 2. Find menu button
    let menuBtn: HTMLElement | null = null;
    for (const sel of selectors.chatMenuButton) {
      const btn = chatItem.querySelector(sel) as HTMLElement | null;
      if (btn) {
        menuBtn = btn;
        break;
      }
      const parent = chatItem.parentElement;
      if (parent) {
        const pBtn = parent.querySelector(sel) as HTMLElement | null;
        if (pBtn) {
          menuBtn = pBtn;
          break;
        }
      }
    }

    if (!menuBtn) {
      throw new Error(`Could not find actions menu button for chat ${chatId}`);
    }

    // 3. Click actions menu button
    menuBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 300)); // wait for dropdown

    // 4. Find the Delete menu item in the body/dropdown
    let deleteItem: HTMLElement | null = null;
    for (const sel of selectors.deleteMenuItem) {
      const items = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
      const found = items.find((el) => el.textContent?.toLowerCase().includes('delete'));
      if (found) {
        deleteItem = found;
        break;
      }
    }

    if (!deleteItem) {
      const allItems = Array.from(document.querySelectorAll('[role="menuitem"], button, div')) as HTMLElement[];
      const found = allItems.find((el) => el.textContent?.toLowerCase().includes('delete'));
      if (found) deleteItem = found;
    }

    if (!deleteItem) {
      throw new Error(`Could not find Delete menu item in dropdown`);
    }

    // 5. Click the Delete menu item to open confirmation modal
    deleteItem.click();
    await new Promise((resolve) => setTimeout(resolve, 300)); // wait for modal

    // 6. Find the confirmation button inside the modal
    let confirmBtn: HTMLElement | null = null;
    for (const sel of selectors.confirmDeleteBtn) {
      const btns = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
      const found = btns.find((el) => el.textContent?.toLowerCase().includes('delete'));
      if (found) {
        confirmBtn = found;
        break;
      }
    }

    if (!confirmBtn) {
      const allButtons = Array.from(document.querySelectorAll('button')) as HTMLElement[];
      const found = allButtons.find((el) => el.textContent?.toLowerCase().includes('delete'));
      if (found) confirmBtn = found;
    }

    if (!confirmBtn) {
      throw new Error(`Could not find confirmation Delete button in modal`);
    }

    // 7. Confirm deletion
    confirmBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 800)); // wait for delete to process

    // 8. Verify it's gone
    const verifyItem = document.querySelector(itemSelector);
    if (verifyItem) {
      throw new Error(`Verification failed: chat item ${chatId} is still present in the sidebar`);
    }
  }

  openChat(chatId: string): void {
    window.location.href = `https://chatgpt.com/c/${chatId}`;
  }

  async health(): Promise<HealthState> {
    const isAuthed = document.cookie.includes('__Secure-next-auth') || document.cookie.includes('session');
    if (isAuthed) {
      return { level: 'green' };
    }
    return { level: 'degraded', failing: ['session_cookie'] };
  }
}
