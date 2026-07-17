import { PAGE_MSG_KEY, type PageEnvelope } from '@/src/core/bus';
import type { Platform } from '@/src/core/types';

// L0 — main world. isolated content scripts can't see fetch responses, so this
// runs in the page's js context and patches fetch/xhr before claude boots.
//
// endpoint we care about rn:
//   GET /api/organizations/{org_uuid}/chat_conversations
// org uuid in the path = account id for storage scoping.
export default defineContentScript({
  matches: [
    'https://claude.ai/*',
    'https://chatgpt.com/*',
    'https://gemini.google.com/*',
  ],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    const hello: PageEnvelope = {
      [PAGE_MSG_KEY]: true,
      msg: { kind: 'hello', from: 'injected', at: Date.now() },
    };
    window.postMessage(hello, window.location.origin);

    patchFetch();
    patchXhr();
    console.log('[tecora] main-world intercept ready');
  },
});

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (typeof URL !== 'undefined' && input instanceof URL) return input.href;
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  return String(input);
}

function patchFetch() {
  const _fetch = window.fetch.bind(window);

  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const response = await _fetch(...args);
    tryIntercept(getRequestUrl(args[0]), response.clone());
    return response;
  };
}

function patchXhr() {
  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    (this as XMLHttpRequest & { __tecoraUrl?: string }).__tecoraUrl = String(url);
    return _open.apply(this, [method, url, ...rest] as Parameters<typeof _open>);
  };

  XMLHttpRequest.prototype.send = function (...args: Parameters<typeof _send>) {
    this.addEventListener('load', () => {
      const url = (this as XMLHttpRequest & { __tecoraUrl?: string }).__tecoraUrl;
      if (!url) return;
      try {
        const data: unknown = JSON.parse(this.responseText);
        const claudeList = matchClaudeChatList(url);
        const claudeDetail = matchClaudeChatDetail(url);
        const chatgptList = matchChatGPTChatList(url);
        const chatgptDetail = matchChatGPTChatDetail(url);

        if (claudeList) {
          handleListPayload('claude', claudeList.orgId, data);
        } else if (claudeDetail) {
          handleDetailPayload('claude', claudeDetail.orgId, claudeDetail.chatId, data);
        } else if (chatgptList) {
          handleListPayload('chatgpt', 'default', data);
        } else if (chatgptDetail) {
          handleDetailPayload('chatgpt', 'default', chatgptDetail.chatId, data);
        }
      } catch {
        // not json — ignore
      }
    });
    return _send.apply(this, args);
  };
}

function tryIntercept(url: string, response: Response) {
  const claudeList = matchClaudeChatList(url);
  const claudeDetail = matchClaudeChatDetail(url);
  const chatgptList = matchChatGPTChatList(url);
  const chatgptDetail = matchChatGPTChatDetail(url);

  if (!claudeList && !claudeDetail && !chatgptList && !chatgptDetail) return;

  response
    .json()
    .then((data: unknown) => {
      if (claudeList) {
        handleListPayload('claude', claudeList.orgId, data);
      } else if (claudeDetail) {
        handleDetailPayload('claude', claudeDetail.orgId, claudeDetail.chatId, data);
      } else if (chatgptList) {
        handleListPayload('chatgpt', 'default', data);
      } else if (chatgptDetail) {
        handleDetailPayload('chatgpt', 'default', chatgptDetail.chatId, data);
      }
    })
    .catch(() => {});
}

function handleListPayload(platform: Platform, orgId: string, data: unknown) {
  const raw = extractChatArray(data);
  if (!raw) {
    console.warn('[tecora] chat response was not a list', typeof data);
    return;
  }

  const envelope: PageEnvelope = {
    [PAGE_MSG_KEY]: true,
    msg: {
      kind: 'chats_intercepted',
      platform,
      account: orgId,
      raw,
      at: Date.now(),
    },
  };
  window.postMessage(envelope, window.location.origin);
  console.log('[tecora] intercepted', raw.length, 'chats for', platform);
}

function handleDetailPayload(platform: Platform, orgId: string, chatId: string, data: unknown) {
  const envelope: PageEnvelope = {
    [PAGE_MSG_KEY]: true,
    msg: {
      kind: 'messages_intercepted',
      platform,
      account: orgId,
      chatId,
      raw: data,
      at: Date.now(),
    },
  };
  window.postMessage(envelope, window.location.origin);
  console.log('[tecora] intercepted conversation detail for', chatId, 'on', platform);
}

function extractChatArray(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  if (typeof data !== 'object' || data === null) return null;

  const o = data as Record<string, unknown>;
  for (const key of ['chat_conversations', 'data', 'items', 'conversations']) {
    if (Array.isArray(o[key])) return o[key] as unknown[];
  }
  return null;
}

function matchClaudeChatList(url: string): { orgId: string } | null {
  try {
    const { pathname } = new URL(url, window.location.origin);
    const m = pathname.match(
      /^\/api\/organizations\/([^/]+)\/chat_conversations\/?$/,
    );
    if (m) return { orgId: m[1] };
  } catch {
    // ignore
  }
  return null;
}

function matchClaudeChatDetail(url: string): { orgId: string; chatId: string } | null {
  try {
    const { pathname } = new URL(url, window.location.origin);
    const m = pathname.match(
      /^\/api\/organizations\/([^/]+)\/chat_conversations\/([0-9a-f-]{8,})\/?$/,
    );
    if (m) return { orgId: m[1], chatId: m[2] };
  } catch {
    // ignore
  }
  return null;
}

function matchChatGPTChatList(url: string): boolean {
  try {
    const { pathname } = new URL(url, window.location.origin);
    return pathname.startsWith('/backend-api/conversations') && !pathname.includes('/conversation/');
  } catch {
    return false;
  }
}

function matchChatGPTChatDetail(url: string): { chatId: string } | null {
  try {
    const { pathname } = new URL(url, window.location.origin);
    const m = pathname.match(
      /^\/backend-api\/conversation\/([0-9a-f-]{8,})\/?$/
    );
    if (m) return { chatId: m[1] };
  } catch {
    // ignore
  }
  return null;
}
