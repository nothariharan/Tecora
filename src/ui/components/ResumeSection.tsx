import React from 'react';
import type { Chat } from '@/src/core/types';
import { chatUrl } from '@/src/core/chat-url';
import type { ChatPresentation } from '../hooks/useChatPresentations';
import { T } from '../theme';

const PLATFORM_LABEL: Record<Chat['platform'], string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
};

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

async function openChat(chat: Chat) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    await browser.tabs.update(tab.id, { url: chatUrl(chat.platform, chat.chatId) });
  }
}

export function ResumeSection({
  chats,
  presentations,
}: {
  chats: Chat[];
  presentations: Record<string, ChatPresentation>;
}) {
  if (chats.length === 0) return null;

  return (
    <section style={{
      padding: '10px 12px',
      borderBottom: `1px solid ${T.border}`,
      background: T.noticeBg,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.fg, letterSpacing: '0.02em' }}>
          Continue where you left off
        </span>
        <span style={{ fontSize: 10.5, color: T.faint }}>latest across Tecora</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {chats.slice(0, 3).map((chat) => {
          const presentation = presentations[chat.pk];
          return (
            <button
              key={chat.pk}
              type="button"
              onClick={() => void openChat(chat)}
              style={{
                border: `1px solid ${T.border}`,
                borderRadius: T.radius,
                background: T.bg,
                color: T.fg,
                textAlign: 'left',
                padding: '8px 9px',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {chat.pinned ? '★ ' : ''}{presentation?.title ?? chat.title}
                </span>
                <span style={{ color: T.faint, fontSize: 10.5, flexShrink: 0 }}>
                  {PLATFORM_LABEL[chat.platform]} · {relativeTime(chat.updatedAt)}
                </span>
              </div>
              {presentation?.preview && (
                <div style={{
                  marginTop: 3,
                  fontSize: 11,
                  color: T.muted,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {presentation.preview}
                </div>
              )}
              {presentation?.usageWarning && (
                <div style={{
                  marginTop: 4,
                  fontSize: 10.5,
                  color: T.danger,
                }}>
                  {presentation.usageWarning} · start fresh if replies feel slow
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
