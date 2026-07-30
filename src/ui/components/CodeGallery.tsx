import React, { useEffect, useMemo, useState } from 'react';
import type { Chat, Platform } from '@/src/core/types';
import type { RuntimeRequest, RuntimeResponse } from '@/src/core/bus';
import { extractCodeFences } from '@/src/core/code-fences';
import { codeWithContext } from '@/src/core/snippets';
import { chatUrl } from '@/src/core/chat-url';
import { T } from '../theme';

const PLATFORM_LABEL: Record<Platform, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
};

interface GalleryBlock {
  key: string;
  chatPk: string;
  chatId: string;
  platform: Platform;
  title: string;
  language: string | null;
  body: string;
  lineCount: number;
  question: string | null;
}

const MAX_BLOCKS = 200;

async function openChat(platform: Platform, chatId: string) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) await browser.tabs.update(tab.id, { url: chatUrl(platform, chatId) });
}

export function CodeGallery({
  chats,
  language,
  query,
}: {
  chats: Chat[];
  language: string | null;
  query: string;
}) {
  const [blocks, setBlocks] = useState<GalleryBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const chatPks = useMemo(() => chats.map((c) => c.pk), [chats]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      if (chatPks.length === 0) {
        if (!cancelled) {
          setBlocks([]);
          setLoading(false);
        }
        return;
      }
      const res = (await browser.runtime.sendMessage({
        type: 'get_stored_messages',
        chatPks,
      } satisfies RuntimeRequest)) as RuntimeResponse;
      if (cancelled || res.type !== 'get_stored_messages_ok') {
        if (!cancelled) setLoading(false);
        return;
      }

      const byChat = new Map(chats.map((c) => [c.pk, c]));
      const out: GalleryBlock[] = [];
      for (const [chatPk, messages] of Object.entries(res.byChatPk)) {
        const chat = byChat.get(chatPk);
        if (!chat) continue;
        const question = messages.find((m) => m.role === 'user')?.text ?? null;
        messages.forEach((m, mi) => {
          const fences = extractCodeFences(m.text);
          fences.forEach((fence, fi) => {
            out.push({
              key: `${chatPk}:${mi}:${fi}`,
              chatPk,
              chatId: chat.chatId,
              platform: chat.platform,
              title: chat.title,
              language: fence.language,
              body: fence.body,
              lineCount: fence.body.split('\n').length,
              question,
            });
          });
        });
      }
      if (!cancelled) {
        setBlocks(out);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chatPks, chats]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = blocks;
    if (language) list = list.filter((b) => b.language === language);
    if (q) list = list.filter((b) => b.body.toLowerCase().includes(q));
    return list.slice(0, MAX_BLOCKS);
  }, [blocks, language, query]);

  const copy = async (block: GalleryBlock) => {
    try {
      await navigator.clipboard.writeText(
        codeWithContext({
          body: block.body,
          platform: block.platform,
          language: block.language,
          question: block.question,
        }),
      );
      setCopied(block.key);
      window.setTimeout(() => setCopied((c) => (c === block.key ? null : c)), 1400);
    } catch {
      // clipboard blocked
    }
  };

  if (loading) {
    return <div style={{ padding: '16px 14px', fontSize: 12, color: T.faint }}>Reading captured code…</div>;
  }

  if (visible.length === 0) {
    return (
      <div style={{ padding: '16px 14px', fontSize: 12, color: T.faint, lineHeight: 1.5 }}>
        No captured code blocks{language ? ` in ${language}` : ''}
        {query.trim() ? ' match your search' : ''}. Open chats with code so Tecora can capture them.
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: T.faint, padding: '0 2px' }}>
        {visible.length} code block{visible.length === 1 ? '' : 's'}
        {blocks.length > visible.length ? ` of ${blocks.length}` : ''}
      </div>
      {visible.map((block) => (
        <div
          key={block.key}
          style={{
            border: `1px solid ${T.border}`,
            borderRadius: T.radius,
            background: T.bg,
            overflow: 'hidden',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '6px 8px',
            borderBottom: `1px solid ${T.border}`,
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{
                fontSize: 9.5,
                fontFamily: 'ui-monospace, monospace',
                color: T.muted,
                border: `1px solid ${T.borderStrong}`,
                borderRadius: 3,
                padding: '1px 5px',
              }}>
                {block.language ?? 'code'}
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={() => void openChat(block.platform, block.chatId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') void openChat(block.platform, block.chatId);
                }}
                title={block.title}
                style={{
                  fontSize: 11,
                  color: T.muted,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                {PLATFORM_LABEL[block.platform]} · {block.title}
              </span>
            </span>
            <button
              type="button"
              onClick={() => void copy(block)}
              style={{
                flexShrink: 0,
                fontSize: 10,
                fontWeight: 600,
                color: copied === block.key ? '#22c55e' : T.muted,
                background: 'transparent',
                border: `1px solid ${T.borderStrong}`,
                borderRadius: 4,
                padding: '2px 7px',
                cursor: 'pointer',
              }}
            >
              {copied === block.key ? 'copied' : 'copy'}
            </button>
          </div>
          <pre style={{
            margin: 0,
            padding: '7px 9px',
            fontSize: 11,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            color: T.fg,
            background: T.hover,
            maxHeight: 132,
            overflow: 'auto',
            whiteSpace: 'pre',
          }}>
            {block.body.length > 1200 ? `${block.body.slice(0, 1200)}\n…` : block.body}
          </pre>
        </div>
      ))}
    </div>
  );
}
