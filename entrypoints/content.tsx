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
import { TodayPanel, TODAY_STYLES } from '@/src/ui/TodayPanel';
import type { Adapter } from '@/src/adapters/base';
import type { Message, Platform, TodayTask } from '@/src/core/types';
import { chatIdFromUrl } from '@/src/core/chat-url';
import {
  estimateChatUsage,
  parseChatGPTUsage,
  parseClaudeUsage,
  usageLabel,
  type PlatformLiveUsage,
} from '@/src/core/usage';
import { scanForSecrets, findingsSignature, type SecretFinding } from '@/src/core/secrets';
import { extractTasks, extractKeyFor } from '@/src/core/task-extract';

// after chrome://extensions → Reload, old content scripts stay alive until the
// tab refreshes. their browser.runtime calls then throw this — catch it so we
// don't spam the console with uncaught promises.
function isExtensionContextInvalidated(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /Extension context invalidated/i.test(msg);
}

// local calendar day, matching the today panel's bucketing
function localDayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

// per-tab guard so we don't re-run the summarizer for a chat whose messages
// haven't changed since we last extracted from it
const extractedChatKeys = new Map<string, string>();

// pull explicit next-steps from a freshly captured chat and store them as auto
// tasks for today. summarizer lives in this dom world, so extraction runs here
// (not the service worker) and only the resulting rows cross to the background.
async function maybeExtractTasks(
  platform: Platform,
  chatPk: string,
  messages: Message[],
): Promise<void> {
  if (messages.length === 0) return;
  const key = extractKeyFor(chatPk, messages);
  if (extractedChatKeys.get(chatPk) === key) return;
  extractedChatKeys.set(chatPk, key);

  try {
    const { lines, source } = await extractTasks(messages);
    const date = localDayStr();
    const now = Date.now();
    const tasks: TodayTask[] = lines.map((text, i) => ({
      id: `auto:${chatPk}:${date}:${i}`,
      date,
      source: 'auto',
      text,
      done: false,
      createdAt: now,
      chatPk,
      platform,
      extractKey: key,
      extractSource: source,
    }));
    await runtimeSend({ type: 'replace_auto_tasks', chatPk, date, extractKey: key, tasks });
  } catch {
    // best-effort; drop the guard so a later capture can retry
    extractedChatKeys.delete(chatPk);
  }
}

async function runtimeSend(msg: RuntimeRequest): Promise<RuntimeResponse | undefined> {
  try {
    return (await browser.runtime.sendMessage(msg)) as RuntimeResponse;
  } catch (err) {
    if (isExtensionContextInvalidated(err)) return undefined;
    throw err;
  }
}

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
      `${PALETTE_STYLES}\n${CHIP_STYLES}\n${TODAY_STYLES}`,
    );

    console.log('[tecora] content script ready');

    // chatgpt buckets everything under a stable user id (not "default"), so a
    // second login can't collide with the first. resolved from the same session
    // endpoint the authed fetches already use.
    const resolveAccount = async (): Promise<string> => {
      if (platform === 'chatgpt') return resolveChatGPTAccount();
      return (await adapter.currentAccount()) ?? 'default';
    };

    let chatgptMigrated = false;
    const ensureChatGPTMigrated = async (account: string) => {
      if (platform !== 'chatgpt' || chatgptMigrated || account === 'default') return;
      chatgptMigrated = true;
      await runtimeSend({
        type: 'migrate_chatgpt_account',
        account,
      });
    };

    // pin the side panel to this tab's platform immediately — don't wait for chats
    const announceContext = async () => {
      try {
        const account = await resolveAccount();
        bridge.setAccount(account);
        await ensureChatGPTMigrated(account);
        await runtimeSend({
          type: 'set_active_context',
          platform,
          account,
        });
      } catch {
        // stale script after extension reload — refresh the tab
      }
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
            const account = await resolveAccount();
            bridge.setAccount(account);
            sendResponse({
              type: 'get_page_context_ok',
              platform,
              account,
            } satisfies RuntimeResponse);
          })();
          return true;
        }

        if (message.type === 'get_usage') {
          void (async () => {
            const usage = await fetchLiveUsage(platform);
            sendResponse({ type: 'get_usage_ok', usage } satisfies RuntimeResponse);
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
            // prefer each platform's authed REST delete when we have one. works for
            // virtualized / project chats the sidebar never renders. fall back to
            // DOM puppetry only if the api path fails (or gemini, which has none).
            if (platform === 'claude') {
              try {
                const parts = message.chatPk.split(':');
                const pkOrg = parts.length >= 3 ? parts[1]! : '';
                const org =
                  pkOrg && pkOrg !== 'dom' && pkOrg !== 'default'
                    ? pkOrg
                    : await resolveClaudeOrg();
                if (org) {
                  await deleteClaudeConversation(org, uuid);
                  syncHostUiAfterDelete(platform, uuid);
                  sendResponse({ type: 'execute_delete_ok' } satisfies RuntimeResponse);
                  return;
                }
              } catch (err) {
                console.warn('[tecora] claude api delete failed, falling back to dom', err);
              }
            }

            if (platform === 'chatgpt') {
              try {
                await deleteChatGPTConversation(uuid);
                syncHostUiAfterDelete(platform, uuid);
                sendResponse({ type: 'execute_delete_ok' } satisfies RuntimeResponse);
                return;
              } catch (err) {
                console.warn('[tecora] chatgpt api delete failed, falling back to dom', err);
              }
            }

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
              // dom path already removes the row via the site ui; still bounce
              // if we're sitting inside the deleted thread
              leaveDeletedChatIfOpen(platform, uuid);
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
        const account = platform === 'chatgpt' ? await resolveChatGPTAccount() : msg.account;
        await pushChats(msg.raw, account);
      }

      if (msg.kind === 'messages_intercepted' && msg.platform === platform) {
        const account = platform === 'chatgpt' ? await resolveChatGPTAccount() : msg.account;
        await pushMessages(msg.chatId, msg.raw, account);
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

    const fetchClaudeProjectsOnce = async () => {
      if (platform !== 'claude') return;
      if (!(adapter instanceof ClaudeAdapter)) return;
      const org = await resolveClaudeOrg();
      if (!org) return;
      const projects = await fetchClaudeProjects(org);
      if (projects.length === 0) return;
      let added = 0;
      for (const project of projects.slice(0, 30)) {
        const convos = await fetchClaudeProjectConversations(org, project.id);
        if (convos.length === 0) continue;
        adapter.ingestProjectConversations(convos, org, { id: project.id, title: project.title });
        added += convos.length;
      }
      if (added === 0) return;
      console.log('[tecora] claude projects added', added, 'chats across', projects.length, 'projects');
      await upsertFromCache(org);
    };

    if (platform === 'claude') {
      void activeFetchClaude();
      setTimeout(() => void activeFetchClaude(), 3000);
      setTimeout(() => void scrapeClaudeOnce(), 5000);
      setTimeout(() => void scrapeClaudeOnce(), 9000);
      setTimeout(() => void fetchClaudeProjectsOnce(), 6000);
    }

    const activeFetchChatGPT = async () => {
      if (platform !== 'chatgpt') return;
      if (pushed) return;
      const account = await resolveChatGPTAccount();
      await ensureChatGPTMigrated(account);
      const list = await fetchChatGPTChatList();
      if (pushed || list.length === 0) return;
      console.log('[tecora] chatgpt active fetch found', list.length, 'chats');
      await pushChats(list, account);
    };

    const scrapeChatGPTOnce = async () => {
      if (platform !== 'chatgpt') return;
      if (pushed) return;
      const account = await resolveChatGPTAccount();
      const scraped = scrapeChatGPTChatLinks();
      if (scraped.length === 0) return;
      console.log('[tecora] chatgpt dom fallback found', scraped.length, 'chats');
      await pushChats(scraped, account);
    };

    // project/gpt conversations are hidden from the normal list endpoint
    const fetchChatGPTProjectsOnce = async () => {
      if (platform !== 'chatgpt') return;
      if (!(adapter instanceof ChatGPTAdapter)) return;
      const account = await resolveChatGPTAccount();
      const projects = await fetchChatGPTProjects();
      if (projects.length === 0) return;
      let added = 0;
      for (const project of projects) {
        adapter.ingestProjectConversations(project.conversations, account, {
          id: project.id,
          title: project.title,
        });
        added += project.conversations.length;
      }
      console.log('[tecora] chatgpt projects added', added, 'chats across', projects.length, 'projects');
      await upsertFromCache(account);
    };

    if (platform === 'chatgpt') {
      void activeFetchChatGPT();
      setTimeout(() => void activeFetchChatGPT(), 3000);
      setTimeout(() => void scrapeChatGPTOnce(), 5000);
      setTimeout(() => void scrapeChatGPTOnce(), 9000);
      setTimeout(() => void fetchChatGPTProjectsOnce(), 6000);
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
      const chatPk = `gemini:${account}:${chatId}`;
      await runtimeSend({
        type: 'upsert_messages',
        chatPk,
        messages,
      });
      void maybeExtractTasks('gemini', chatPk, messages);
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

    // push whatever the adapter currently holds (normal chats + any projects
    // ingested since) to the worker, keeping the side panel pinned here.
    async function upsertFromCache(account: string) {
      bridge.setAccount(account);

      const chats = await adapter.listChats();
      bridge.setChatCount(chats.length);
      console.log('[tecora] chats ready', { count: chats.length });

      // keep side panel pinned to this page even if another tab upserts later
      await runtimeSend({
        type: 'set_active_context',
        platform,
        account,
      });

      if (chats.length === 0) return;

      pushed = true;
      await runtimeSend({
        type: 'upsert_chats',
        chats,
      });
    }

    async function pushChats(raw: unknown[], account: string) {
      adapter.ingestRaw(raw, account);
      await upsertFromCache(account);
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

      await runtimeSend({
        type: 'upsert_messages',
        chatPk,
        messages,
      });
      void maybeExtractTasks(platform, chatPk, messages);
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

// real REST delete in the page's authed context — no sidebar/DOM dependency, so
// it works for chats that aren't rendered (virtualized lists, project convos).
async function deleteClaudeConversation(orgId: string, chatId: string): Promise<void> {
  const url = `https://claude.ai/api/organizations/${orgId}/chat_conversations/${chatId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    credentials: 'include',
    headers: { accept: 'application/json' },
  });
  // 404 = already gone; treat as success so the local row still clears
  if (!res.ok && res.status !== 404) {
    throw new Error(`claude delete http ${res.status}`);
  }
}

// soft-delete — same request the website's own Delete button sends. hides the
// chat from the sidebar; openai may still retain the data server-side.
async function deleteChatGPTConversation(chatId: string): Promise<void> {
  const token = await resolveChatGPTAccessToken();
  if (!token) throw new Error('chatgpt delete: no access token');

  const url = `https://chatgpt.com/backend-api/conversation/${chatId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      ...chatgptHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ is_visible: false }),
  });
  // 404 = already gone
  if (!res.ok && res.status !== 404) {
    throw new Error(`chatgpt delete http ${res.status}`);
  }
}

// api deletes don't touch react state — drop the sidebar row and leave the
// thread if it's open so the host ui matches tecora without a full reload
function syncHostUiAfterDelete(platform: Platform, chatId: string): void {
  removeSidebarItemForChat(platform, chatId);
  // chatgpt/claude often re-paint the row from cache — keep killing it briefly
  keepSidebarItemGone(platform, chatId, 12_000);
  leaveDeletedChatIfOpen(platform, chatId);
}

function chatHrefNeedle(platform: Platform, chatId: string): string {
  if (platform === 'claude') return `/chat/${chatId}`;
  if (platform === 'chatgpt') return `/c/${chatId}`;
  return chatId;
}

function hrefMatchesChat(href: string, platform: Platform, chatId: string): boolean {
  const needle = chatHrefNeedle(platform, chatId);
  if (!href.includes(needle)) return false;
  // avoid partial uuid collisions
  try {
    const path = href.startsWith('http') ? new URL(href).pathname : href;
    return path.includes(needle) || href.includes(needle);
  } catch {
    return true;
  }
}

function closestChatRow(anchor: HTMLElement, platform: Platform): HTMLElement {
  const linkNeedle =
    platform === 'claude' ? '/chat/' : platform === 'chatgpt' ? '/c/' : '/app/';
  let el: HTMLElement = anchor;
  for (let i = 0; i < 8; i++) {
    const parent = el.parentElement;
    if (!parent || parent === document.body) break;
    const siblingLinks = parent.querySelectorAll(`a[href*="${linkNeedle}"]`).length;
    // parent owns multiple chats — remove only this branch
    if (siblingLinks > 1) return el;
    el = parent;
  }
  return (
    (anchor.closest('li') as HTMLElement | null) ||
    anchor.parentElement ||
    anchor
  );
}

function removeSidebarItemForChat(platform: Platform, chatId: string): void {
  const links = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
  for (const a of links) {
    const href = a.getAttribute('href') || a.href;
    if (!hrefMatchesChat(href, platform, chatId)) continue;
    const row = closestChatRow(a, platform);
    // hide + remove — hide survives brief react re-inserts until observer catches up
    row.style.display = 'none';
    row.setAttribute('data-tecora-deleted', chatId);
    row.remove();
  }
}

function keepSidebarItemGone(platform: Platform, chatId: string, ms: number): void {
  const tick = () => removeSidebarItemForChat(platform, chatId);
  tick();
  const obs = new MutationObserver(() => tick());
  obs.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(() => obs.disconnect(), ms);
}

function leaveDeletedChatIfOpen(platform: Platform, chatId: string): void {
  const openId = chatIdFromUrl(platform, window.location.href);
  if (openId !== chatId) return;
  if (platform === 'claude') window.location.href = 'https://claude.ai/new';
  else if (platform === 'chatgpt') window.location.href = 'https://chatgpt.com/';
  else if (platform === 'gemini') window.location.href = 'https://gemini.google.com/app';
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

// stable per-login account key for chatgpt, from the session's user id.
// cached because it never changes within a session and gates data bucketing.
let chatgptAccountCache: string | null = null;
async function resolveChatGPTAccount(): Promise<string> {
  if (chatgptAccountCache) return chatgptAccountCache;
  try {
    const res = await fetch('https://chatgpt.com/api/auth/session', {
      credentials: 'include',
      headers: { accept: 'application/json' },
    });
    if (res.ok) {
      const data: unknown = await res.json();
      const user = (data as { user?: { id?: unknown } } | null)?.user;
      const id = user?.id;
      if (typeof id === 'string' && id) {
        chatgptAccountCache = id;
        return id;
      }
    }
  } catch {
    // fall through to default; better than colliding two logins
  }
  return 'default';
}

// real usage limits — undocumented private endpoints, read-only, no quota burned.
// null means "couldn't read it" so the panel falls back to local estimates.
async function fetchLiveUsage(platform: Platform): Promise<PlatformLiveUsage | null> {
  if (platform === 'claude') {
    const org = await resolveClaudeOrg();
    return org ? fetchClaudeUsage(org) : null;
  }
  if (platform === 'chatgpt') return fetchChatGPTUsage();
  return null;
}

async function fetchClaudeUsage(org: string): Promise<PlatformLiveUsage | null> {
  try {
    const res = await fetch(`https://claude.ai/api/organizations/${org}/usage`, {
      credentials: 'include',
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    return parseClaudeUsage(await res.json());
  } catch {
    return null;
  }
}

async function fetchChatGPTUsage(): Promise<PlatformLiveUsage | null> {
  try {
    const token = await resolveChatGPTAccessToken();
    const res = await fetch('https://chatgpt.com/backend-api/wham/usage', {
      credentials: 'include',
      headers: chatgptHeaders(token),
    });
    if (!res.ok) return null;
    return parseChatGPTUsage(await res.json());
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

// snorlax sidebar returns pinned gizmos (projects + gpts) in a loosely-typed
// tree. walk it and pull out anything that looks like a gizmo (id starts "g-").
function extractGizmoProjects(data: unknown): { id: string; title: string }[] {
  const out: { id: string; title: string }[] = [];
  const seen = new Set<string>();

  const readTitle = (node: Record<string, unknown>): string => {
    const display = asRecord(node['display']);
    const name = display?.['name'] ?? node['title'] ?? node['name'];
    return typeof name === 'string' && name ? name : 'Project';
  };

  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const rec = asRecord(node);
    if (!rec) return;

    const gizmo = asRecord(rec['gizmo']) ?? rec;
    const id = typeof gizmo['id'] === 'string' ? gizmo['id'] : null;
    if (id && id.startsWith('g-') && !seen.has(id)) {
      seen.add(id);
      out.push({ id, title: readTitle(gizmo) });
    }
    for (const value of Object.values(rec)) visit(value);
  };

  visit(data);
  return out;
}

async function fetchChatGPTProjects(): Promise<
  { id: string; title: string; conversations: unknown[] }[]
> {
  const out: { id: string; title: string; conversations: unknown[] }[] = [];
  try {
    const token = await resolveChatGPTAccessToken();
    const res = await fetch('https://chatgpt.com/backend-api/gizmos/snorlax/sidebar', {
      credentials: 'include',
      headers: chatgptHeaders(token),
    });
    if (!res.ok) return out;
    const projects = extractGizmoProjects(await res.json());
    for (const project of projects.slice(0, 30)) {
      const conversations = await fetchChatGPTProjectConversations(project.id, token);
      if (conversations.length > 0) out.push({ ...project, conversations });
    }
  } catch {
    // projects are additive — a failure just leaves the normal list intact
  }
  return out;
}

async function fetchChatGPTProjectConversations(
  gizmoId: string,
  token: string | null,
): Promise<unknown[]> {
  try {
    const res = await fetch(
      `https://chatgpt.com/backend-api/gizmos/${gizmoId}/conversations?limit=100`,
      { credentials: 'include', headers: chatgptHeaders(token) },
    );
    if (!res.ok) return [];
    const data: unknown = await res.json();
    const rec = asRecord(data);
    if (rec && Array.isArray(rec['items'])) return rec['items'];
    if (Array.isArray(data)) return data;
    return [];
  } catch {
    return [];
  }
}

async function fetchClaudeProjects(org: string): Promise<{ id: string; title: string }[]> {
  try {
    const res = await fetch(`https://claude.ai/api/organizations/${org}/projects`, {
      credentials: 'include',
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    const arr = Array.isArray(data) ? data : [];
    const projects: { id: string; title: string }[] = [];
    for (const item of arr) {
      const rec = asRecord(item);
      if (!rec) continue;
      const id = rec['uuid'];
      if (typeof id !== 'string') continue;
      const name = rec['name'];
      projects.push({ id, title: typeof name === 'string' && name ? name : 'Project' });
    }
    return projects;
  } catch {
    return [];
  }
}

async function fetchClaudeProjectConversations(org: string, projectId: string): Promise<unknown[]> {
  try {
    const res = await fetch(
      `https://claude.ai/api/organizations/${org}/projects/${projectId}/conversations`,
      { credentials: 'include', headers: { accept: 'application/json' } },
    );
    if (!res.ok) return [];
    const data: unknown = await res.json();
    if (Array.isArray(data)) return data;
    const rec = asRecord(data);
    if (rec) {
      for (const key of ['conversations', 'data', 'items']) {
        if (Array.isArray(rec[key])) return rec[key] as unknown[];
      }
    }
    return [];
  } catch {
    return [];
  }
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
  const [todayOpen, setTodayOpen] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [chatCount, setChatCount] = useState(0);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [longChatWarning, setLongChatWarning] = useState<string | null>(null);
  const [dismissedChatPk, setDismissedChatPk] = useState<string | null>(null);
  const [secretFindings, setSecretFindings] = useState<SecretFinding[]>([]);
  const [dismissedSecretSig, setDismissedSecretSig] = useState('');

  useEffect(() => {
    bridge.setOpen = setOpen;
    bridge.setAccount = setAccount;
    bridge.setChatCount = setChatCount;
    bridge.getOpen = () => open;
  }, [bridge, open]);

  // track the open conversation so the palette can scope search to it (spa nav
  // doesn't fire a load event, so poll the url)
  useEffect(() => {
    const update = () => setCurrentChatId(chatIdFromUrl(platform, window.location.href));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [platform]);

  const chatPk = account && currentChatId ? `${platform}:${account}:${currentChatId}` : null;

  // proactive nudge: warn before the browser bogs down on a huge conversation.
  // based on captured message volume, no dom surgery.
  useEffect(() => {
    if (!chatPk) {
      setLongChatWarning(null);
      return;
    }
    let cancelled = false;
    const check = async () => {
      try {
        const res = await runtimeSend({
          type: 'get_stored_messages',
          chatPks: [chatPk],
        });
        if (cancelled || !res || res.type !== 'get_stored_messages_ok') return;
        const estimate = estimateChatUsage(res.byChatPk[chatPk] ?? []);
        setLongChatWarning(estimate.level === 'very_long' ? usageLabel(estimate) : null);
      } catch {
        // ignore — nudge is best-effort
      }
    };
    void check();
    const id = window.setInterval(check, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [chatPk]);

  const notice = longChatWarning && chatPk && dismissedChatPk !== chatPk ? longChatWarning : null;

  // watch composer typing for pasted secrets. selector-free: any input event whose
  // target is a textarea/contenteditable in the page (our palette lives in a shadow
  // root, so its events retarget to the mount host and never match here).
  useEffect(() => {
    let timer: number | undefined;
    const handle = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      let text: string | null = null;
      if (t instanceof HTMLTextAreaElement) text = t.value;
      else if (t.isContentEditable) text = t.innerText;
      if (text === null) return;

      const snapshot = text;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const found = scanForSecrets(snapshot);
        setSecretFindings(found);
        if (found.length === 0) setDismissedSecretSig('');
      }, 250);
    };
    document.addEventListener('input', handle, true);
    return () => {
      document.removeEventListener('input', handle, true);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const secretSig = findingsSignature(secretFindings);
  const showSecretWarning = secretFindings.length > 0 && secretSig !== dismissedSecretSig;

  return (
    <>
      {showSecretWarning && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 24,
            transform: 'translateX(-50%)',
            zIndex: 2147483647,
            maxWidth: 420,
            width: 'max-content',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            background: '#1a1206',
            color: '#fde68a',
            border: '1px solid #b45309',
            borderRadius: 10,
            padding: '10px 12px',
            boxShadow: '0 6px 24px rgba(0,0,0,0.45)',
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
            fontSize: 12.5,
            lineHeight: 1.4,
          }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>⚠</span>
          <span style={{ flex: 1 }}>
            <strong style={{ color: '#fcd34d' }}>Possible secret in your message</strong>
            <div style={{ marginTop: 3, color: '#fbbf24' }}>
              {secretFindings.map((f) => f.label).join(', ')} — double-check before sending.
              Local check only; Tecora sends nothing.
            </div>
          </span>
          <button
            type="button"
            onClick={() => setDismissedSecretSig(secretSig)}
            style={{
              flexShrink: 0,
              background: 'transparent',
              color: '#fcd34d',
              border: 'none',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              padding: 0,
            }}
            title="dismiss"
          >
            ×
          </button>
        </div>
      )}
      <StatusChip
        onOpenPalette={() => setOpen(true)}
        onOpenToday={() => setTodayOpen(true)}
        notice={notice}
        onDismissNotice={() => setDismissedChatPk(chatPk)}
      />
      <Palette
        open={open}
        onClose={() => setOpen(false)}
        platform={platform}
        account={account}
        currentChatId={currentChatId}
        onOpenChat={(chatId) => adapter.openChat(chatId)}
      />
      <TodayPanel
        open={todayOpen}
        onClose={() => setTodayOpen(false)}
        platform={platform}
        account={account}
      />
    </>
  );
}
