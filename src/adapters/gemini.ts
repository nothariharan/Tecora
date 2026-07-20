import type { Adapter } from './base';
import type { Chat, HealthState, Message } from '@/src/core/types';
import { getSelectors } from '@/src/core/config';

function cleanTitle(raw: string): string {
  const s = raw.replace(/\s+/g, ' ').trim();
  if (!s) return 'Untitled Chat';
  const half = s.length / 2;
  if (Number.isInteger(half) && s.slice(0, half) === s.slice(half)) {
    return s.slice(0, half) || 'Untitled Chat';
  }
  return s;
}

export class GeminiAdapter implements Adapter {
  readonly id = 'gemini' as const;

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
    return url.hostname.includes('gemini.google.com');
  }

  resolveAccount(): string {
    if (this.account) return this.account;
    // keep gemini on a stable bucket — cookie hints change and orphan chats
    this.account = 'default';
    return this.account;
  }

  currentChatIdFromUrl(): string | null {
    const m =
      window.location.pathname.match(/\/app\/([a-zA-Z0-9_-]+)/) ||
      window.location.pathname.match(/\/chat\/([a-zA-Z0-9_-]+)/);
    return m?.[1] ?? null;
  }

  ingestRaw(items: unknown[], account: string): void {
    this.account = account;
    this.lastIngestAt = Date.now();

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const raw = item as Chat;
      if (typeof raw.chatId !== 'string') continue;
      this.chatCache.set(raw.chatId, {
        ...raw,
        platform: 'gemini',
        account,
        pk: `gemini:${account}:${raw.chatId}`,
      });
    }
  }

  async listChats(): Promise<Chat[]> {
    return Array.from(this.chatCache.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getMessages(_chatId: string): Promise<Message[]> {
    return [];
  }

  async currentAccount(): Promise<string | null> {
    return this.account ?? this.resolveAccount();
  }

  async archive(_chatId: string): Promise<void> {
    throw new Error('archive not implemented yet');
  }

  async delete(chatId: string): Promise<void> {
    const selectors = (await getSelectors()).gemini;

    let chatItem: HTMLElement | null = null;
    for (const sel of selectors.chatListItem) {
      const links = Array.from(document.querySelectorAll(sel)) as HTMLAnchorElement[];
      const found = links.find((a) => a.href.includes(chatId));
      if (found) {
        chatItem = found;
        break;
      }
    }

    if (!chatItem) {
      throw new Error(`Could not find sidebar item for chat ${chatId}`);
    }

    chatItem.scrollIntoView({ block: 'center' });

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
        const grandparent = parent.parentElement;
        if (grandparent) {
          const gpBtn = grandparent.querySelector(sel) as HTMLElement | null;
          if (gpBtn) {
            menuBtn = gpBtn;
            break;
          }
        }
      }
    }

    if (!menuBtn) {
      throw new Error(`Could not find actions menu button for chat ${chatId}`);
    }

    menuBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 300));

    let deleteItem: HTMLElement | null = null;
    for (const sel of selectors.deleteMenuItem) {
      const items = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
      const found = items.find((el) => {
        const t = el.textContent?.toLowerCase().trim() ?? '';
        return t === 'delete' || t.startsWith('delete');
      });
      if (found) {
        deleteItem = found;
        break;
      }
    }

    if (!deleteItem) {
      throw new Error(`Could not find Delete menu item in dropdown`);
    }

    deleteItem.click();
    await new Promise((resolve) => setTimeout(resolve, 300));

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
      const dialog = document.querySelector('[role="dialog"], [aria-modal="true"]');
      if (dialog) {
        const btns = Array.from(dialog.querySelectorAll('button')) as HTMLElement[];
        confirmBtn =
          btns.find((el) => el.textContent?.toLowerCase().includes('delete')) ?? null;
      }
    }

    if (!confirmBtn) {
      throw new Error(`Could not find confirmation Delete button in modal`);
    }

    confirmBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 800));

    let verifyItem: HTMLElement | null = null;
    for (const sel of selectors.chatListItem) {
      const links = Array.from(document.querySelectorAll(sel)) as HTMLAnchorElement[];
      const found = links.find((a) => a.href.includes(chatId));
      if (found) {
        verifyItem = found;
        break;
      }
    }
    if (verifyItem) {
      throw new Error(`Verification failed: chat item ${chatId} is still present in the sidebar`);
    }
  }

  openChat(chatId: string): void {
    window.location.href = `https://gemini.google.com/app/${chatId}`;
  }

  async health(): Promise<HealthState> {
    const isAuthed = document.cookie.includes('SID') || document.cookie.includes('HSID');
    if (!isAuthed) {
      return { level: 'degraded', failing: ['google_session'] };
    }
    if (this.lastIngestAt === null) {
      return { level: 'degraded', failing: ['no chat data received yet'] };
    }
    if (this.chatCache.size > 0) {
      return { level: 'green' };
    }
    return { level: 'degraded', failing: ['dom scrape found no chats'] };
  }

  scrapeChatsFromDOM(account: string): Chat[] {
    this.account = account;
    this.lastIngestAt = Date.now();

    const selectors = [
      'a[href*="/app/"]',
      'a[href*="/gemini/chat/"]',
      'a[href*="/chat/"]',
      'conversation-list-item a',
      '[data-test-id*="conversation"] a',
      'nav a[href*="/app/"]',
      '[role="navigation"] a[href*="/app/"]',
      '[role="listbox"] a[href*="/app/"]',
      '[role="option"] a[href*="/app/"]',
    ];
    const chats: Chat[] = [];
    const seen = new Set<string>();
    const now = Date.now();

    for (const sel of selectors) {
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(sel));
      for (const a of links) {
        const href = a.getAttribute('href') || a.href;
        const m =
          href.match(/\/app\/([a-zA-Z0-9_-]+)/) ||
          href.match(/\/gemini\/chat\/([a-zA-Z0-9_-]+)/) ||
          href.match(/\/chat\/([a-zA-Z0-9_-]+)/);
        if (!m) continue;
        const chatId = m[1]!;
        if (chatId === 'new' || chatId === 'app' || seen.has(chatId)) continue;
        seen.add(chatId);

        const title = cleanTitle(a.textContent || '');
        // prefer data attributes when gemini exposes a real timestamp
        const rawTs =
          a.getAttribute('data-timestamp') ||
          a.closest('[data-timestamp]')?.getAttribute('data-timestamp');
        const updatedAt = rawTs ? Number(rawTs) || now - seen.size * 1000 : now - seen.size * 1000;

        chats.push({
          pk: `${this.id}:${account}:${chatId}`,
          chatId,
          platform: this.id,
          account,
          title,
          updatedAt,
        });
      }
    }

    for (const chat of chats) {
      this.chatCache.set(chat.chatId, chat);
    }
    return chats;
  }

  // scrape the open conversation turns for export + search indexing
  scrapeMessagesFromDOM(chatId: string, account: string): Message[] {
    const chatPk = `${this.id}:${account}:${chatId}`;
    const messages: Message[] = [];

    const turnSelectors = [
      '[data-message-author-role]',
      'message-content',
      '.model-response-text',
      '.user-query-text',
      '[class*="query-text"]',
      '[class*="response-text"]',
    ];

    const nodes: HTMLElement[] = [];
    for (const sel of turnSelectors) {
      for (const el of Array.from(document.querySelectorAll(sel)) as HTMLElement[]) {
        if (!nodes.includes(el)) nodes.push(el);
      }
    }

    // structured role attributes first
    const roleNodes = Array.from(
      document.querySelectorAll('[data-message-author-role]'),
    ) as HTMLElement[];

    if (roleNodes.length > 0) {
      roleNodes.forEach((el, index) => {
        const roleAttr = el.getAttribute('data-message-author-role') || '';
        const role: Message['role'] =
          roleAttr === 'user' || roleAttr === 'human'
            ? 'user'
            : roleAttr === 'system'
              ? 'system'
              : 'assistant';
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text) return;
        messages.push({
          pk: `${chatPk}:${index}`,
          chatPk,
          role,
          text,
          ts: Date.now() - (roleNodes.length - index) * 1000,
        });
      });
      return messages;
    }

    // fallback: alternate user/assistant from query/response blocks
    const blocks = Array.from(
      document.querySelectorAll(
        '.user-query-bubble-with-background, .user-query-text, message-content, .model-response-text, [class*="response-container"]',
      ),
    ) as HTMLElement[];

    blocks.forEach((el, index) => {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length < 2) return;
      const cls = (el.className || '').toString().toLowerCase();
      const tag = el.tagName.toLowerCase();
      const isUser =
        cls.includes('user-query') ||
        cls.includes('query-text') ||
        tag.includes('user');
      messages.push({
        pk: `${chatPk}:${index}`,
        chatPk,
        role: isUser ? 'user' : 'assistant',
        text,
        ts: Date.now() - (blocks.length - index) * 1000,
      });
    });

    return messages;
  }
}
