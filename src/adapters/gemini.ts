import type { Adapter } from './base';
import type { Chat, HealthState, Message } from '@/src/core/types';
import { getSelectors } from '@/src/core/config';

export class GeminiAdapter implements Adapter {
  readonly id = 'gemini' as const;

  readonly capabilities = {
    archive: false,
    delete: true,
    rename: false,
    exportMessages: false,
  };

  private chatCache = new Map<string, Chat>();
  private account: string | null = null;
  private lastIngestAt: number | null = null;

  matches(url: URL): boolean {
    return url.hostname.includes('gemini.google.com');
  }

  ingestRaw(items: unknown[], account: string): void {
    this.account = account;
    this.lastIngestAt = Date.now();

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const raw = item as Chat;
      this.chatCache.set(raw.chatId, raw);
    }
  }

  async listChats(): Promise<Chat[]> {
    return Array.from(this.chatCache.values());
  }

  async getMessages(_chatId: string): Promise<Message[]> {
    return [];
  }

  async currentAccount(): Promise<string | null> {
    return this.account;
  }

  async archive(_chatId: string): Promise<void> {
    throw new Error('archive not implemented yet');
  }

  async delete(chatId: string): Promise<void> {
    const selectors = (await getSelectors()).gemini;

    // 1. Find sidebar list item for chatId
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

    // 2. Find menu button inside or near the list item
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

    // 3. Click menu button
    menuBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 300)); // wait for menu dropdown

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
    if (isAuthed) {
      return { level: 'green' };
    }
    return { level: 'degraded', failing: ['google_session'] };
  }

  scrapeChatsFromDOM(account: string): Chat[] {
    const selectors = ['a[href*="/app/"]', 'a[href*="/chat/"]'];
    const chats: Chat[] = [];
    const seen = new Set<string>();
    const now = Date.now();

    for (const sel of selectors) {
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(sel));
      for (const a of links) {
        const href = a.href;
        const m = href.match(/\/app\/([a-zA-Z0-9_-]+)/) || href.match(/\/chat\/([a-zA-Z0-9_-]+)/);
        if (!m) continue;
        const chatId = m[1];
        if (seen.has(chatId)) continue;
        seen.add(chatId);

        const title = a.textContent?.trim() || 'Untitled Chat';
        const ts = now - seen.size * 1000;

        chats.push({
          pk: `${this.id}:${account}:${chatId}`,
          chatId,
          platform: this.id,
          account,
          title,
          updatedAt: ts,
        });
      }
    }

    return chats;
  }
}
