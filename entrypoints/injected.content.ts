import { PAGE_MSG_KEY, type PageEnvelope } from '@/src/core/bus';

// L0 — main world. isolated content scripts can't see fetch responses, so this
// runs in the page's js context and patches fetch before claude boots.
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
  },
});

function patchFetch() {
  const _fetch = window.fetch.bind(window);

  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const response = await _fetch(...args);

    const url =
      typeof args[0] === 'string'
        ? args[0]
        : args[0] instanceof Request
          ? args[0].url
          : '';

    tryIntercept(url, response);
    return response;
  };
}

function tryIntercept(url: string, response: Response) {
  const claude = matchClaudeChatList(url);
  if (!claude) return;

  // clone first — reading the body consumes it and breaks the page's own .json()
  response
    .clone()
    .json()
    .then((data: unknown) => {
      if (!Array.isArray(data)) return;

      const envelope: PageEnvelope = {
        [PAGE_MSG_KEY]: true,
        msg: {
          kind: 'chats_intercepted',
          platform: 'claude',
          account: claude.orgId,
          raw: data,
          at: Date.now(),
        },
      };
      window.postMessage(envelope, window.location.origin);
    })
    .catch(() => {});
}

function matchClaudeChatList(url: string): { orgId: string } | null {
  try {
    const { pathname } = new URL(url, window.location.origin);
    const m = pathname.match(/^\/api\/organizations\/([^/]+)\/chat_conversations/);
    if (m) return { orgId: m[1] };
  } catch {
    // bad/relative url — ignore
  }
  return null;
}
