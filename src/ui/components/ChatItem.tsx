import React, { useState } from 'react';
import type { Chat, Folder } from '@/src/core/types';
import type { RuntimeRequest } from '@/src/core/bus';

interface Props {
  chat: Chat;
  folders: Folder[];
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ChatItem({ chat, folders }: Props) {
  const [showMenu, setShowMenu] = useState(false);

  async function assignFolder(folderId: string | null) {
    setShowMenu(false);
    await browser.runtime.sendMessage({
      type: 'assign_folder',
      chatPk: chat.pk,
      folderId,
    } satisfies RuntimeRequest);
  }

  async function openChat() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await browser.tabs.update(tab.id, {
        url: `https://${chat.platform === 'claude' ? 'claude.ai' : chat.platform === 'chatgpt' ? 'chatgpt.com' : 'gemini.google.com'}/chat/${chat.chatId}`,
      });
    }
  }

  const currentFolder = folders.find((f) => f.id === chat.folderId);

  return (
    <div style={{ position: 'relative', borderBottom: '1px solid #f3f4f6' }}>
      <div
        onClick={openChat}
        style={{
          padding: '8px 12px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <span style={{
            fontSize: 13,
            fontWeight: 500,
            color: '#111827',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {chat.title}
          </span>
          <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>
            {relativeTime(chat.updatedAt)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {currentFolder ? (
            <span style={{ fontSize: 11, color: '#6b7280' }}>📁 {currentFolder.name}</span>
          ) : (
            <span />
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v); }}
            style={{
              fontSize: 11,
              color: '#9ca3af',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 2px',
            }}
          >
            ⋯
          </button>
        </div>
      </div>

      {showMenu && (
        <div style={{
          position: 'absolute',
          right: 10,
          bottom: '100%',
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          zIndex: 10,
          minWidth: 150,
          padding: '4px 0',
          fontSize: 12,
        }}>
          <div style={{ padding: '4px 10px', color: '#9ca3af', fontWeight: 600, fontSize: 11 }}>Move to folder</div>
          {chat.folderId && (
            <div
              onClick={() => assignFolder(null)}
              style={{ padding: '5px 12px', cursor: 'pointer', color: '#374151' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              Remove from folder
            </div>
          )}
          {folders.map((f) => (
            <div
              key={f.id}
              onClick={() => assignFolder(f.id)}
              style={{
                padding: '5px 12px',
                cursor: 'pointer',
                color: chat.folderId === f.id ? '#1d4ed8' : '#374151',
                fontWeight: chat.folderId === f.id ? 600 : 400,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              📁 {f.name}
            </div>
          ))}
          {folders.length === 0 && (
            <div style={{ padding: '5px 12px', color: '#9ca3af' }}>No folders yet</div>
          )}
        </div>
      )}
    </div>
  );
}
