import React, { useState } from 'react';
import type { Chat, Folder } from '@/src/core/types';
import type { RuntimeRequest } from '@/src/core/bus';
import { useExport } from '../ExportContext';
import { T } from '../theme';

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
  const { busy, exportChats } = useExport();

  async function assignFolder(folderId: string | null) {
    setShowMenu(false);
    await browser.runtime.sendMessage({
      type: 'assign_folder',
      chatPk: chat.pk,
      folderId,
    } satisfies RuntimeRequest);
  }

  function exportThis() {
    setShowMenu(false);
    if (!busy) exportChats([chat], chat.title, true);
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

  const menuItem: React.CSSProperties = {
    padding: '5px 12px',
    cursor: 'pointer',
    color: T.fg,
  };

  return (
    <div style={{ position: 'relative', borderBottom: `1px solid ${T.border}` }}>
      <div
        onClick={openChat}
        style={{
          padding: '8px 12px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = T.hover)}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <span style={{
            fontSize: 13,
            fontWeight: 500,
            color: T.fg,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {chat.title}
          </span>
          <span style={{ fontSize: 11, color: T.faint, flexShrink: 0 }}>
            {relativeTime(chat.updatedAt)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {currentFolder ? (
            <span style={{ fontSize: 11, color: T.muted }}>{currentFolder.name}</span>
          ) : (
            <span />
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v); }}
            style={{
              fontSize: 13,
              color: T.faint,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 2px',
              lineHeight: 1,
            }}
          >
            ⋯
          </button>
        </div>
      </div>

      {showMenu && (
        <div style={{
          background: T.hover,
          borderTop: `1px solid ${T.border}`,
          padding: '4px 0',
          fontSize: 12,
        }}>
          <div
            onClick={exportThis}
            style={{ ...menuItem, fontWeight: 600 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = T.selectedBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Export as markdown
          </div>
          <div style={{ height: 1, background: T.border, margin: '4px 0' }} />
          <div style={{ padding: '4px 12px', color: T.faint, fontWeight: 600, fontSize: 11 }}>Move to folder</div>
          {chat.folderId && (
            <div
              onClick={() => assignFolder(null)}
              style={menuItem}
              onMouseEnter={(e) => (e.currentTarget.style.background = T.selectedBg)}
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
                ...menuItem,
                fontWeight: chat.folderId === f.id ? 600 : 400,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = T.selectedBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {chat.folderId === f.id ? '✓ ' : ''}{f.name}
            </div>
          ))}
          {folders.length === 0 && (
            <div style={{ padding: '5px 12px', color: T.faint }}>
              No folders yet — create one under the folder list above.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
