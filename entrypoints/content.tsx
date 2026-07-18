import React, { useEffect, useState } from 'react';
import { isPageEnvelope } from '@/src/core/bus';
import type { FetchedConversation, RuntimeRequest, RuntimeResponse } from '@/src/core/bus';
import { ClaudeAdapter, normalizeMessages } from '@/src/adapters/claude';
import { ChatGPTAdapter, normalizeChatGPTMessages } from '@/src/adapters/chatgpt';
import { GeminiAdapter } from '@/src/adapters/gemini';
import { mountShadowApp } from '@/src/ui/shadow-root';
import { Palette, PALETTE_STYLES } from '@/src/ui/Palette';
import { StatusChip, CHIP_STYLES } from '@/src/ui/StatusChip';
import type { Adapter } from '@/src/adapters/base';
import type { Platform } from '@/src/core/types';

// L1 — isolated world. listens for L0 postMessages, hands off to the adapter,
// and hosts the ctrl/cmd+k palette + a visible status chip in a shadow root.
export default defineContentScript({
  matches: [
    'https://claude.ai/*',
    'https://chatgpt.com/*',
    'https://gemini.google.com/*',
  ],
  runAt: 'document_start',
  main() {
    if ((window as any).__tecoraContentScriptActive) {
      console.log('[tecora] content script already initialized for this tab');
      return;
    }
    (window as any).__tecoraContentScriptActive = true;

    const hostname = window.location.hostname;
    const platform = hostname.includes('chatgpt.com')
      ? 'chatgpt'
      : hostname.includes('gemini.google.com')
        ? 'gemini'
        : 'claude';

    const adapter: Adapter =
      platform === 'chatgpt'
        ? new ChatGPTAdapter()
        : platform === 'gemini'
          ? new GeminiAdapter()
          : new ClaudeAdapter();
    let pushed = false;

    const bridge = {
      setOpen: (_v: boolean) => {},
      setAccount: (_a: string | null) => {},
      setChatCount: (_n: number) => {},
      getOpen: () => false,
    };

    mountShadowApp(
      <OverlayApp adapter={adapter} bridge={bridge} platform={platform} />,
      `${PALETTE_STYLES}\n${CHIP_STYLES}`,
    );

    console.log('[tecora] content script ready');

    window.addEventListener(
      'keydown',
      (e) => {
        const mod = e.metaKey || e.ctrlKey;
        if (!mod || e.key.toLowerCase() !== 'k') return;

        const t = e.target as HTMLElement | null;
        const typing =
          t &&
          (t.tagName === 'INPUT' ||
            t.tagName === 'TEXTAREA' ||
            t.isContentEditable);
        if (typing && !bridge.getOpen()) return;

        e.preventDefault();
        e.stopPropagation();
        bridge.setOpen(!bridge.getOpen());
      },
      true,
    );

    // side panel → this content script (targeted). fetch full conversation
    // bodies in the page's own authed context, then hand them back.
    browser.runtime.onMessage.addListener(
      (message: RuntimeRequest, _sender, sendResponse): boolean => {
        if (message.type === 'fetch_conversations') {
          fetchConversations(platform, message.orgId, message.chatIds).then((results) => {
            sendResponse({ type: 'fetch_conversations_ok', results } satisfies RuntimeResponse);
          });
          return true;
        }

        if (message.type === 'execute_delete') {
          const uuid = message.chatPk.split(':').pop();
          if (!uuid) {
            sendResponse({ type: 'execute_delete_error', error: 'Invalid chat PK format' } satisfies RuntimeResponse);
            return false;
          }
          void (async () => {
            const health = await adapter.health();
            if (health.level === 'red') {
              sendResponse({
                type: 'execute_delete_error',
                error: `adapter unhealthy: ${health.reason}`,
              } satisfies RuntimeResponse);
              return;
            }
            if (health.level === 'degraded') {
              sendResponse({
                type: 'execute_delete_error',
                error: `adapter degraded: ${health.failing.join(', ')}`,
              } satisfies RuntimeResponse);
              return;
            }
            try {
              await adapter.delete(uuid);
              sendResponse({ type: 'execute_delete_ok' } satisfies RuntimeResponse);
            } catch (err) {
              sendResponse({ type: 'execute_delete_error', error: String(err) } satisfies RuntimeResponse);
            }
          })();
          return true;
        }

        return false;
      },
    );

    window.addEventListener('message', async (event) => {
      if (event.source !== window) return;
      if (!isPageEnvelope(event.data)) return;

      const msg = event.data.msg;
      if (msg.kind === 'hello') {
        console.log('[tecora] injected world is live');
        return;
      }

      if (msg.kind === 'chats_intercepted' && msg.platform === platform) {
        await pushChats(msg.raw, msg.account);
      }

      if (msg.kind === 'messages_intercepted' && msg.platform === platform) {
        await pushMessages(msg.chatId, msg.raw, msg.account);
      }
    });

    const activeFetchClaude = async () => {
      if (platform !== 'claude') return;
      if (pushed) return;
      const org = await resolveClaudeOrg();
      if (!org) return;
      const list = await fetchClaudeChatList(org);
      if (pushed || list.length === 0) return;
      console.log('[tecora] active fetch found', list.length, 'chats');
      await pushChats(list, org);
    };

    const scrapeClaudeOnce = async () => {
      if (platform !== 'claude') return;
      if (pushed) return;
      const org = (await resolveClaudeOrg()) ?? 'dom';
      const scraped = scrapeClaudeChatLinks();
      if (scraped.length === 0) return;
      console.log('[tecora] dom fallback found', scraped.length, 'chats');
      await pushChats(scraped, org);
    };

    if (platform === 'claude') {
      void activeFetchClaude();
      setTimeout(() => void activeFetchClaude(), 3000);
      setTimeout(() => void scrapeClaudeOnce(), 5000);
      setTimeout(() => void scrapeClaudeOnce(), 9000);
    }

    const activeFetchChatGPT = async () => {
      if (platform !== 'chatgpt') return;
      if (pushed) return;
      const list = await fetchChatGPTChatList();
      if (pushed || list.length === 0) return;
      console.log('[tecora] chatgpt active fetch found', list.length, 'chats');
      await pushChats(list, 'default');
    };

    const scrapeChatGPTOnce = async () => {
      if (platform !== 'chatgpt') return;
      if (pushed) return;
      const scraped = scrapeChatGPTChatLinks();
      if (scraped.length === 0) return;
      console.log('[tecora] chatgpt dom fallback found', scraped.length, 'chats');
      await pushChats(scraped, 'default');
    };

    if (platform === 'chatgpt') {
      void activeFetchChatGPT();
      setTimeout(() => void activeFetchChatGPT(), 3000);
      setTimeout(() => void scrapeChatGPTOnce(), 5000);
      setTimeout(() => void scrapeChatGPTOnce(), 9000);
    }

    const scrapeGemini = async () => {
      if (platform !== 'gemini') return;
      if (!(adapter instanceof GeminiAdapter)) return;
      const account = adapter.resolveAccount();
      const scraped = adapter.scrapeChatsFromDOM(account);
      if (scraped.length === 0) return;
      console.log('[tecora] gemini scraped', scraped.length, 'chats');
      await pushChats(scraped, account);
    };

    const captureGeminiMessages = async () => {
      if (platform !== 'gemini') return;
      if (!(adapter instanceof GeminiAdapter)) return;
      const chatId = adapter.currentChatIdFromUrl();
      if (!chatId) return;
      const account = adapter.resolveAccount();
      const messages = adapter.scrapeMessagesFromDOM(chatId, account);
      if (messages.length === 0) return;
      console.log('[tecora] gemini scraped messages', messages.length, 'for', chatId);
      await browser.runtime.sendMessage({
        type: 'upsert_messages',
        chatPk: `gemini:${account}:${chatId}`,
        messages,
      } satisfies RuntimeRequest);
    };

    if (platform === 'gemini') {
      setTimeout(() => void scrapeGemini(), 3000);
      setTimeout(() => void scrapeGemini(), 7000);
      setInterval(() => void scrapeGemini(), 15000);
      setTimeout(() => void captureGeminiMessages(), 4000);
      setInterval(() => void captureGeminiMessages(), 8000);
    }

    async function pushChats(raw: unknown[], account: string) {
      adapter.ingestRaw(raw, account);
      bridge.setAccount(account);

      const chats = await adapter.listChats();
      bridge.setChatCount(chats.length);
      console.log('[tecora] chats ready', { count: chats.length });

      if (chats.length === 0) return;

      pushed = true;
      await browser.runtime.sendMessage({
        type: 'upsert_chats',
        chats,
      } satisfies RuntimeRequest);
    }

    async function pushMessages(chatId: string, raw: unknown, account: string) {
      const chatPk = `${platform}:${account}:${chatId}`;
      const messages =
        platform === 'chatgpt'
          ? normalizeChatGPTMessages(chatPk, raw)
          : platform === 'claude'
            ? normalizeMessages(chatPk, raw)
            : [];
      console.log('[tecora] messages ready for', chatId, { count: messages.length });

      if (messages.length === 0) return;

      await browser.runtime.sendMessage({
        type: 'upsert_messages',
        chatPk,
        messages,
      } satisfies RuntimeRequest);
    }
  },
});

// fetch conversation detail per platform in the page's authed context.
async function fetchConversations(
  platform: Platform,
  orgId: string,
  chatIds: string[],
): Promise<FetchedConversation[]> {
  if (platform === 'gemini') {
    return chatIds.map((chatId) => ({
      chatId,
      messages: [],
      error: 'gemini uses stored messages only',
    }));
  }

  const results: FetchedConversation[] = [];
  const limit = 3;
  const fetchOne =
    platform === 'chatgpt'
      ? (id: string) => fetchChatGPTOne(orgId, id)
      : (id: string) => fetchClaudeOne(orgId, id);

  for (let i = 0; i < chatIds.length; i += limit) {
    const batch = chatIds.slice(i, i + limit);
    const settled = await Promise.all(batch.map(fetchOne));
    results.push(...settled);
  }
  return results;
}

async function fetchClaudeOne(orgId: string, chatId: string): Promise<FetchedConversation> {
  const pk = `claude:${orgId}:${chatId}`;
  const url =
    `https://claude.ai/api/organizations/${orgId}/chat_conversations/${chatId}` +
    `?tree=True&rendering_mode=messages&render_all_tools=true`;

  try {
    const res = await fetch(url, {
      credentials: 'include',
      headers: { accept: 'application/json' },
    });
    if (!res.ok) {
      return { chatId, messages: [], error: `http ${res.status}` };
    }
    const data: unknown = await res.json();
    return { chatId, messages: normalizeMessages(pk, data) };
  } catch (err) {
    return { chatId, messages: [], error: String(err) };
  }
}

async function resolveChatGPTAccessToken(): Promise<string | null> {
  try {
    const res = await fetch('https://chatgpt.com/api/auth/session', {
      credentials: 'include',
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (data && typeof data === 'object') {
      const token = (data as Record<string, unknown>)['accessToken'];
      if (typeof token === 'string' && token) return token;
    }
  } catch {
    // ignore
  }
  return null;
}

function chatgptHeaders(token: string | null): HeadersInit {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function fetchChatGPTOne(account: string, chatId: string): Promise<FetchedConversation> {
  const pk = `chatgpt:${account}:${chatId}`;
  const url = `https://chatgpt.com/backend-api/conversation/${chatId}`;
  const token = await resolveChatGPTAccessToken();

  try {
    const res = await fetch(url, {
      credentials: 'include',
      headers: chatgptHeaders(token),
    });
    if (!res.ok) {
      return { chatId, messages: [], error: `http ${res.status}` };
    }
    const data: unknown = await res.json();
    return { chatId, messages: normalizeChatGPTMessages(pk, data) };
  } catch (err) {
    return { chatId, messages: [], error: String(err) };
  }
}

// resolve the active org uuid = our account scope. cookie first (fast), else
// ask the api. keeps the account identical to what the detail/list endpoints use.
async function resolveClaudeOrg(): Promise<string | null> {
  const m = document.cookie.match(/(?:^|; )lastActiveOrg=([^;]+)/);
  if (m) return decodeURIComponent(m[1]!);

  try {
    const res = await fetch('https://claude.ai/api/organizations', {
      credentials: 'include',
      headers: { accept: 'application/json' },
    });
    if (res.ok) {
      const data: unknown = await res.json();
      if (Array.isArray(data)) {
        const first = data.find(
          (o) => o && typeof (o as { uuid?: unknown }).uuid === 'string',
        ) as { uuid: string } | undefined;
        if (first) return first.uuid;
      }
    }
  } catch {
    // ignore — fall through to null
  }
  return null;
}

// authed pull of the chat list — real names + real updated_at for correct order.
async function fetchClaudeChatList(org: string): Promise<unknown[]> {
  try {
    const res = await fetch(
      `https://claude.ai/api/organizations/${org}/chat_conversations?limit=1000&offset=0`,
      { credentials: 'include', headers: { accept: 'application/json' } },
    );
    if (!res.ok) return [];
    const data: unknown = await res.json();
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      for (const k of ['chat_conversations', 'data', 'items', 'conversations']) {
        const arr = (data as Record<string, unknown>)[k];
        if (Array.isArray(arr)) return arr;
      }
    }
    return [];
  } catch {
    return [];
  }
}

// claude's sidebar renders the title twice into one node ("FooFoo"). collapse it.
function cleanScrapedTitle(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const half = s.length / 2;
  if (Number.isInteger(half) && s.slice(0, half) === s.slice(half)) {
    return s.slice(0, half);
  }
  return s;
}

function scrapeClaudeChatLinks(): unknown[] {
  const links = Array.from(
    document.querySelectorAll<HTMLAnchorElement>('a[href*="/chat/"]'),
  );

  const chats: unknown[] = [];
  const seen = new Set<string>();
  const now = Date.now();

  for (const a of links) {
    const m = a.pathname.match(/^\/chat\/([0-9a-f-]{8,})$/i);
    if (!m) continue;
    const uuid = m[1]!;
    if (seen.has(uuid)) continue;
    seen.add(uuid);

    // sidebar is newest-first — step timestamps down so order survives even
    // though we don't have the real ones here.
    const ts = new Date(now - seen.size * 1000).toISOString();
    chats.push({
      uuid,
      name: cleanScrapedTitle(a.textContent || ''),
      updated_at: ts,
      created_at: ts,
    });
  }

  return chats;
}

async function fetchChatGPTChatList(): Promise<unknown[]> {
  try {
    const token = await resolveChatGPTAccessToken();
    const res = await fetch(
      'https://chatgpt.com/backend-api/conversations?offset=0&limit=100&order=updated',
      { credentials: 'include', headers: chatgptHeaders(token) },
    );
    if (!res.ok) return [];
    const data: unknown = await res.json();
    if (data && typeof data === 'object') {
      const items = (data as Record<string, unknown>)['items'];
      if (Array.isArray(items)) return items;
    }
    if (Array.isArray(data)) return data;
    return [];
  } catch {
    return [];
  }
}

function scrapeChatGPTChatLinks(): unknown[] {
  const links = Array.from(
    document.querySelectorAll<HTMLAnchorElement>('a[href*="/c/"]'),
  );
  const chats: unknown[] = [];
  const seen = new Set<string>();
  const now = Date.now();

  for (const a of links) {
    const m = a.pathname.match(/^\/c\/([0-9a-f-]{8,})$/i);
    if (!m) continue;
    const id = m[1]!;
    if (seen.has(id)) continue;
    seen.add(id);
    const ts = (now - seen.size * 1000) / 1000;
    chats.push({
      id,
      title: cleanScrapedTitle(a.textContent || '') || 'Untitled Chat',
      create_time: ts,
      update_time: ts,
    });
  }
  return chats;
}

function OverlayApp({
  adapter,
  bridge,
  platform,
}: {
  adapter: Adapter;
  bridge: {
    setOpen: (v: boolean) => void;
    setAccount: (a: string | null) => void;
    setChatCount: (n: number) => void;
    getOpen: () => boolean;
  };
  platform: Platform;
}) {
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [chatCount, setChatCount] = useState(0);

  useEffect(() => {
    bridge.setOpen = setOpen;
    bridge.setAccount = setAccount;
    bridge.setChatCount = setChatCount;
    bridge.getOpen = () => open;
  }, [bridge, open]);

  return (
    <>
      <StatusChip chatCount={chatCount} onOpenPalette={() => setOpen(true)} />
      <Palette
        open={open}
        onClose={() => setOpen(false)}
        platform={platform}
        account={account}
        onOpenChat={(chatId) => adapter.openChat(chatId)}
      />
    </>
  );
}
