import React, { useEffect, useState } from 'react';
import { isPageEnvelope } from '@/src/core/bus';
import type { FetchedConversation, RuntimeRequest, RuntimeResponse } from '@/src/core/bus';
import { ClaudeAdapter, normalizeMessages } from '@/src/adapters/claude';
import { ChatGPTAdapter, normalizeChatGPTMessages } from '@/src/adapters/chatgpt';
import { GeminiAdapter } from '@/src/adapters/gemini';
import {
  base64FromBytes,
  claudeFileDownloadUrl,
  dedupeAssets,
  extractChatGPTAssets,
  extractClaudeAssets,
  extractGeminiAssetsFromDOM,
  type ChatAsset,
} from '@/src/core/assets';
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

    // pin the side panel to this tab's platform immediately — don't wait for chats
    const announceContext = async () => {
      const account = (await adapter.currentAccount()) ?? 'default';
      bridge.setAccount(account);
      await browser.runtime.sendMessage({
        type: 'set_active_context',
        platform,
        account,
      } satisfies RuntimeRequest);
    };
    void announceContext();
    // re-announce when the tab becomes visible again (side panel may have drifted)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void announceContext();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

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
        if (message.type === 'get_page_context') {
          void (async () => {
            const account = (await adapter.currentAccount()) ?? 'default';
            bridge.setAccount(account);
            sendResponse({
              type: 'get_page_context_ok',
              platform,
              account,
            } satisfies RuntimeResponse);
          })();
          return true;
        }

        if (message.type === 'refresh_chats') {
          void (async () => {
            try {
              if (platform === 'gemini' && adapter instanceof GeminiAdapter) {
                const account = adapter.resolveAccount();
                const scraped = adapter.scrapeChatsFromDOM(account);
                if (scraped.length > 0) {
                  await pushChats(scraped, account);
                }
                sendResponse({
                  type: 'refresh_chats_ok',
                  count: scraped.length,
                } satisfies RuntimeResponse);
                return;
              }

              if (platform === 'claude') {
                await activeFetchClaude();
              } else if (platform === 'chatgpt') {
                await activeFetchChatGPT();
              }
              const chats = await adapter.listChats();
              sendResponse({
                type: 'refresh_chats_ok',
                count: chats.length,
              } satisfies RuntimeResponse);
            } catch (err) {
              console.warn('[tecora] refresh_chats failed', err);
              sendResponse({ type: 'refresh_chats_ok', count: 0 } satisfies RuntimeResponse);
            }
          })();
          return true;
        }

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
      void scrapeGemini();
      setTimeout(() => void scrapeGemini(), 1500);
      setTimeout(() => void scrapeGemini(), 4000);
      setTimeout(() => void scrapeGemini(), 8000);
      setInterval(() => void scrapeGemini(), 10000);
      setTimeout(() => void captureGeminiMessages(), 4000);
      setInterval(() => void captureGeminiMessages(), 8000);
    }

    async function pushChats(raw: unknown[], account: string) {
      adapter.ingestRaw(raw, account);
      bridge.setAccount(account);

      const chats = await adapter.listChats();
      bridge.setChatCount(chats.length);
      console.log('[tecora] chats ready', { count: chats.length });

      // keep side panel pinned to this page even if another tab upserts later
      await browser.runtime.sendMessage({
        type: 'set_active_context',
        platform,
        account,
      } satisfies RuntimeRequest);

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

async function fetchAssetBytes(
  url: string,
  headers: HeadersInit = {},
): Promise<{ base64: string; mimeType?: string } | { error: string }> {
  try {
    const res = await fetch(url, { credentials: 'include', headers });
    if (!res.ok) return { error: `http ${res.status}` };
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0) return { error: 'empty response' };
    const mimeType = res.headers.get('content-type')?.split(';')[0] || undefined;
    return { base64: base64FromBytes(buf), mimeType };
  } catch (err) {
    return { error: String(err) };
  }
}

async function resolveAssetBytes(
  assets: ChatAsset[],
  opts: { orgId?: string; chatgptToken?: string | null } = {},
): Promise<ChatAsset[]> {
  const out: ChatAsset[] = [];

  for (const asset of assets) {
    if (asset.text != null || asset.base64 || asset.missingReason) {
      out.push(asset);
      continue;
    }

    let url = asset.source;
    if (url.startsWith('file_uuid:') && opts.orgId) {
      url = claudeFileDownloadUrl(opts.orgId, url.slice('file_uuid:'.length));
    }

    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('blob:')) {
      out.push({ ...asset, missingReason: 'no downloadable url' });
      continue;
    }

    const headers: Record<string, string> = {};
    if (asset.platform === 'chatgpt' && opts.chatgptToken) {
      headers['Authorization'] = `Bearer ${opts.chatgptToken}`;
    }

    const result = await fetchAssetBytes(url, headers);
    if ('error' in result) {
      out.push({ ...asset, missingReason: result.error });
    } else {
      out.push({
        ...asset,
        base64: result.base64,
        mimeType: result.mimeType ?? asset.mimeType,
      });
    }
  }

  return out;
}

async function fetchClaudeWiggleAssets(orgId: string, chatId: string): Promise<ChatAsset[]> {
  const assets: ChatAsset[] = [];
  try {
    const listUrl =
      `https://claude.ai/api/organizations/${orgId}/conversations/${chatId}/wiggle/list-files`;
    const res = await fetch(listUrl, {
      credentials: 'include',
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return assets;
    const data: unknown = await res.json();
    const paths: string[] = [];
    if (Array.isArray(data)) {
      for (const item of data) {
        if (typeof item === 'string') paths.push(item);
        else if (item && typeof item === 'object') {
          const p = (item as { path?: unknown; name?: unknown }).path
            ?? (item as { path?: unknown; name?: unknown }).name;
          if (typeof p === 'string') paths.push(p);
        }
      }
    } else if (data && typeof data === 'object') {
      const files = (data as { files?: unknown }).files;
      if (Array.isArray(files)) {
        for (const item of files) {
          if (typeof item === 'string') paths.push(item);
          else if (item && typeof item === 'object' && typeof (item as { path?: unknown }).path === 'string') {
            paths.push((item as { path: string }).path);
          }
        }
      }
    }

    const outputs = paths.filter(
      (p) => p.includes('/mnt/user-data/outputs/') || p.includes('/outputs/'),
    );
    let i = 0;
    for (const path of outputs.slice(0, 40)) {
      const downloadUrl =
        `https://claude.ai/api/organizations/${orgId}/conversations/${chatId}` +
        `/wiggle/download-file?path=${encodeURIComponent(path)}`;
      const name = path.split('/').pop() || `wiggle-${i + 1}`;
      assets.push({
        id: `claude:${chatId}:wiggle:${i++}`,
        chatId,
        platform: 'claude',
        kind: 'file',
        filename: name,
        source: downloadUrl,
      });
    }
  } catch {
    // wiggle is optional — artifacts still come from tool_use
  }
  return assets;
}

// fetch conversation detail per platform in the page's authed context.
async function fetchConversations(
  platform: Platform,
  orgId: string,
  chatIds: string[],
): Promise<FetchedConversation[]> {
  if (platform === 'gemini') {
    return fetchGeminiConversations(chatIds);
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

async function fetchGeminiConversations(chatIds: string[]): Promise<FetchedConversation[]> {
  // gemini has no clean conversation json — scrape the open chat when it matches
  const openId =
    window.location.pathname.match(/\/app\/([a-zA-Z0-9_-]+)/)?.[1] ||
    window.location.pathname.match(/\/chat\/([a-zA-Z0-9_-]+)/)?.[1] ||
    null;

  const results: FetchedConversation[] = [];
  for (const chatId of chatIds) {
    if (openId && openId === chatId) {
      const extracted = extractGeminiAssetsFromDOM(chatId);
      const assets = await resolveAssetBytes(extracted);
      results.push({ chatId, messages: [], assets });
    } else {
      results.push({
        chatId,
        messages: [],
        assets: [],
        error: 'gemini assets require the chat to be open in this tab',
      });
    }
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
      return { chatId, messages: [], assets: [], error: `http ${res.status}` };
    }
    const data: unknown = await res.json();
    const messages = normalizeMessages(pk, data);
    const fromTools = extractClaudeAssets(chatId, data);
    const fromWiggle = await fetchClaudeWiggleAssets(orgId, chatId);
    // wiggle often re-lists the same html/md artifacts we already got from tool_use
    const assets = await resolveAssetBytes(dedupeAssets([...fromTools, ...fromWiggle]), { orgId });
    return { chatId, messages, assets };
  } catch (err) {
    return { chatId, messages: [], assets: [], error: String(err) };
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
      return { chatId, messages: [], assets: [], error: `http ${res.status}` };
    }
    const data: unknown = await res.json();
    const messages = normalizeChatGPTMessages(pk, data);
    const extracted = extractChatGPTAssets(chatId, data);
    const assets = await resolveAssetBytes(extracted, { chatgptToken: token });
    return { chatId, messages, assets };
  } catch (err) {
    return { chatId, messages: [], assets: [], error: String(err) };
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
      <StatusChip onOpenPalette={() => setOpen(true)} />
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
