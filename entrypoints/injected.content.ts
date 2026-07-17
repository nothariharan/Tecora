import { PAGE_MSG_KEY, type PageEnvelope } from '@/src/core/bus';

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
        const listMatch = matchClaudeChatList(url);
        const detailMatch = matchClaudeChatDetail(url);
        if (listMatch) {
          handleListPayload(listMatch.orgId, data);
        } else if (detailMatch) {
          handleDetailPayload(detailMatch.orgId, detailMatch.chatId, data);
        }
      } catch {
        // not json — ignore
      }
    });
    return _send.apply(this, args);
  };
}

function tryIntercept(url: string, response: Response) {
  const listMatch = matchClaudeChatList(url);
  const detailMatch = matchClaudeChatDetail(url);
  if (!listMatch && !detailMatch) return;

  response
    .json()
    .then((data: unknown) => {
      if (listMatch) {
        handleListPayload(listMatch.orgId, data);
      } else if (detailMatch) {
        handleDetailPayload(detailMatch.orgId, detailMatch.chatId, data);
      }
    })
    .catch(() => {});
}

function handleListPayload(orgId: string, data: unknown) {
  const raw = extractChatArray(data);
  if (!raw) {
    console.warn('[tecora] chat_conversations response was not a list', typeof data);
    return;
  }

  const envelope: PageEnvelope = {
    [PAGE_MSG_KEY]: true,
    msg: {
      kind: 'chats_intercepted',
      platform: 'claude',
      account: orgId,
      raw,
      at: Date.now(),
    },
  };
  window.postMessage(envelope, window.location.origin);
  console.log('[tecora] intercepted', raw.length, 'chats');
}

function handleDetailPayload(orgId: string, chatId: string, data: unknown) {
  const envelope: PageEnvelope = {
    [PAGE_MSG_KEY]: true,
    msg: {
      kind: 'messages_intercepted',
      platform: 'claude',
      account: orgId,
      chatId,
      raw: data,
      at: Date.now(),
    },
  };
  window.postMessage(envelope, window.location.origin);
  console.log('[tecora] intercepted conversation detail for', chatId);
}

// claude has returned a bare array historically; stay tolerant if they wrap it.
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
    // list endpoint only — skip /chat_conversations/{uuid} detail fetches
    const m = pathname.match(
      /^\/api\/organizations\/([^/]+)\/chat_conversations\/?$/,
    );
    if (m) return { orgId: m[1] };
  } catch {
    // bad/relative url — ignore
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
