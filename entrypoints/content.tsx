import React, { useEffect, useState } from 'react';
import { isPageEnvelope } from '@/src/core/bus';
import type { FetchedConversation, RuntimeRequest, RuntimeResponse } from '@/src/core/bus';
import { ClaudeAdapter, normalizeMessages } from '@/src/adapters/claude';
import { mountShadowApp } from '@/src/ui/shadow-root';
import { Palette, PALETTE_STYLES } from '@/src/ui/Palette';
import { StatusChip, CHIP_STYLES } from '@/src/ui/StatusChip';

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
    const claude = new ClaudeAdapter();
    let pushed = false;

    const bridge = {
      setOpen: (_v: boolean) => {},
      setAccount: (_a: string | null) => {},
      setChatCount: (_n: number) => {},
      getOpen: () => false,
    };

    mountShadowApp(
      <OverlayApp adapter={claude} bridge={bridge} />,
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
    // bodies from claude in the page's own authed context, then hand them back.
    browser.runtime.onMessage.addListener(
      (message: RuntimeRequest, _sender, sendResponse): boolean => {
        if (message.type === 'fetch_conversations') {
          fetchConversations(message.orgId, message.chatIds).then((results) => {
            sendResponse({ type: 'fetch_conversations_ok', results } satisfies RuntimeResponse);
          });
          return true; // async response
        }

        if (message.type === 'execute_delete') {
          const uuid = message.chatPk.split(':').pop();
          if (!uuid) {
            sendResponse({ type: 'execute_delete_error', error: 'Invalid chat PK format' } satisfies RuntimeResponse);
            return false;
          }
          claude.delete(uuid)
            .then(() => {
              sendResponse({ type: 'execute_delete_ok' } satisfies RuntimeResponse);
            })
            .catch((err) => {
              sendResponse({ type: 'execute_delete_error', error: String(err) } satisfies RuntimeResponse);
            });
          return true; // async response
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

      if (msg.kind === 'chats_intercepted' && msg.platform === 'claude') {
        await pushChats(msg.raw, msg.account);
      }

      if (msg.kind === 'messages_intercepted' && msg.platform === 'claude') {
        await pushMessages(msg.chatId, msg.raw, msg.account);
      }
    });

    // primary source of truth: actively pull claude's chat list ourselves, with
    // real names + updated_at. beats waiting for a passive intercept (which only
    // fires on the Chats page) and beats DOM scraping (fake times, doubled text).
    const activeFetch = async () => {
      if (pushed) return;
      const org = await resolveClaudeOrg();
      if (!org) return;
      const list = await fetchClaudeChatList(org);
      if (pushed || list.length === 0) return;
      console.log('[tecora] active fetch found', list.length, 'chats');
      await pushChats(list, org);
    };

    // last resort only — the sidebar DOM. real org (so folders line up) and
    // decreasing timestamps so at least the order matches claude's sidebar.
    const scrapeOnce = async () => {
      if (pushed) return;
      const org = (await resolveClaudeOrg()) ?? 'dom';
      const scraped = scrapeClaudeChatLinks();
      if (scraped.length === 0) return;
      console.log('[tecora] dom fallback found', scraped.length, 'chats');
      await pushChats(scraped, org);
    };

    void activeFetch();
    setTimeout(() => void activeFetch(), 3000);
    setTimeout(() => void scrapeOnce(), 5000);
    setTimeout(() => void scrapeOnce(), 9000);

    async function pushChats(raw: unknown[], account: string) {
      claude.ingestRaw(raw, account);
      bridge.setAccount(account);

      const chats = await claude.listChats();
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
      const chatPk = `claude:${account}:${chatId}`;
      const messages = normalizeMessages(chatPk, raw);
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

// fetch conversation detail for each chatId from claude's api, in the page's
// authed (cookie) context. small concurrency cap so we don't hammer the api.
async function fetchConversations(
  orgId: string,
  chatIds: string[],
): Promise<FetchedConversation[]> {
  const results: FetchedConversation[] = [];
  const limit = 3;

  for (let i = 0; i < chatIds.length; i += limit) {
    const batch = chatIds.slice(i, i + limit);
    const settled = await Promise.all(batch.map((id) => fetchOne(orgId, id)));
    results.push(...settled);
  }
  return results;
}

async function fetchOne(orgId: string, chatId: string): Promise<FetchedConversation> {
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

function OverlayApp({
  adapter,
  bridge,
}: {
  adapter: ClaudeAdapter;
  bridge: {
    setOpen: (v: boolean) => void;
    setAccount: (a: string | null) => void;
    setChatCount: (n: number) => void;
    getOpen: () => boolean;
  };
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
        platform="claude"
        account={account}
        onOpenChat={(chatId) => adapter.openChat(chatId)}
      />
    </>
  );
}
