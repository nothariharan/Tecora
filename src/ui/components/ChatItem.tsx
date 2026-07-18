import React, { useState } from 'react';
import type { Chat, Folder, Tag } from '@/src/core/types';
import type { RuntimeRequest } from '@/src/core/bus';
import { chatUrl } from '@/src/core/chat-url';
import { useExport } from '../ExportContext';
import { IconMore, IconExport, IconFolder, IconCheck, IconFolderInput, IconTag } from './Icons';
import { T } from '../theme';

interface Props {
  chat: Chat;
  folders: Folder[];
  tags: Tag[];
  editMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
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

export function ChatItem({ chat, folders, tags, editMode = false, selected = false, onToggleSelect }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [hover, setHover] = useState(false);
  const { busy, exportChats } = useExport();

  async function assignFolder(folderId: string | null) {
    setShowMenu(false);
    await browser.runtime.sendMessage({
      type: 'assign_folder',
      chatPk: chat.pk,
      folderId,
    } satisfies RuntimeRequest);
  }

  async function toggleTag(tagId: string) {
    const currentTags = chat.tagIds || [];
    const newTags = currentTags.includes(tagId)
      ? currentTags.filter((t) => t !== tagId)
      : [...currentTags, tagId];

    await browser.runtime.sendMessage({
      type: 'assign_tags',
      chatPk: chat.pk,
      tagIds: newTags,
    } satisfies RuntimeRequest);
  }

  function exportThis() {
    setShowMenu(false);
    if (!busy) exportChats([chat], chat.title, true);
  }

  function exportArchive() {
    setShowMenu(false);
    if (!busy) exportChats([chat], chat.title, true, 'archive');
  }

  async function openChat() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await browser.tabs.update(tab.id, { url: chatUrl(chat.platform, chat.chatId) });
    }
  }

  const currentFolder = folders.find((f) => f.id === chat.folderId);

  const menuItem: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    padding: '7px 12px',
    cursor: 'pointer',
    color: T.fg,
    fontSize: 12.5,
  };

  return (
    <div
      style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {editMode && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          style={{
            margin: '0 4px 0 12px',
            width: 14,
            height: 14,
            cursor: 'pointer',
            accentColor: T.fg,
          }}
        />
      )}
      <div
        onClick={editMode ? onToggleSelect : openChat}
        style={{
          flex: 1,
          padding: '9px 12px',
          margin: editMode ? '0 6px 0 0' : '0 6px',
          borderRadius: 8,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          background: hover || showMenu ? T.hover : 'transparent',
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
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
          {hover || showMenu ? (
            <button
              aria-label="Chat actions"
              onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v); }}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 22, height: 22, flexShrink: 0,
                background: showMenu ? T.selectedBg : 'transparent',
                color: showMenu ? T.fg : T.icon,
                border: 'none', borderRadius: 5, cursor: 'pointer', padding: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = T.selectedBg; e.currentTarget.style.color = T.fg; }}
              onMouseLeave={(e) => { if (!showMenu) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.icon; } }}
            >
              <IconMore size={15} />
            </button>
          ) : (
            <span style={{ fontSize: 11, color: T.faint, flexShrink: 0 }}>
              {relativeTime(chat.updatedAt)}
            </span>
          )}
        </div>

        {(currentFolder || (chat.tagIds && chat.tagIds.length > 0)) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
            {currentFolder && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                <IconFolder size={11} style={{ color: T.faint }} />
                <span style={{
                  fontSize: 11, color: T.muted,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {currentFolder.name}
                </span>
              </span>
            )}
            {chat.tagIds?.map((tid) => {
              const tag = tags.find((t) => t.id === tid);
              if (!tag) return null;
              return (
                <span
                  key={tid}
                  style={{
                    fontSize: 10,
                    color: T.muted,
                    background: T.pillBg,
                    padding: '0px 6px',
                    borderRadius: 4,
                    border: `1px solid ${T.border}`,
                  }}
                >
                  #{tag.name}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {showMenu && (
        <>
          <div
            onClick={() => setShowMenu(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 20 }}
          />
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 6,
            left: 6,
            marginTop: -2,
            background: T.bg,
            border: `1px solid ${T.borderStrong}`,
            borderRadius: T.radius,
            padding: '4px 0',
            zIndex: 21,
            overflow: 'hidden',
          }}>
            <div
              onClick={exportThis}
              style={menuItem}
              onMouseEnter={(e) => (e.currentTarget.style.background = T.hover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <IconExport size={14} style={{ color: T.icon }} />
              Export as markdown
            </div>

            <div
              onClick={exportArchive}
              style={menuItem}
              onMouseEnter={(e) => (e.currentTarget.style.background = T.hover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <IconExport size={14} style={{ color: T.icon }} />
              Export portable archive
            </div>

            <div style={{ height: 1, background: T.border, margin: '4px 0' }} />

            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '4px 12px', color: T.faint, fontWeight: 600, fontSize: 10.5,
              letterSpacing: '0.4px', textTransform: 'uppercase',
            }}>
              <IconFolderInput size={12} />
              Move to folder
            </div>

            {chat.folderId && (
              <div
                onClick={() => assignFolder(null)}
                style={{ ...menuItem, color: T.muted }}
                onMouseEnter={(e) => (e.currentTarget.style.background = T.hover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ width: 14, flexShrink: 0 }} />
                Remove from folder
              </div>
            )}

            {folders.map((f) => {
              const active = chat.folderId === f.id;
              return (
                <div
                  key={f.id}
                  onClick={() => assignFolder(f.id)}
                  style={{ ...menuItem, fontWeight: active ? 600 : 400 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = T.hover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {active
                    ? <IconCheck size={14} style={{ color: T.fg }} />
                    : <IconFolder size={14} style={{ color: T.icon }} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.name}
                  </span>
                </div>
              );
            })}

            {folders.length === 0 && (
              <div style={{ padding: '6px 12px', color: T.faint, fontSize: 12 }}>
                No folders yet — create one above.
              </div>
            )}

            <div style={{ height: 1, background: T.border, margin: '4px 0' }} />

            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '4px 12px', color: T.faint, fontWeight: 600, fontSize: 10.5,
              letterSpacing: '0.4px', textTransform: 'uppercase',
            }}>
              <IconTag size={12} />
              Tags
            </div>

            {tags.map((t) => {
              const active = (chat.tagIds || []).includes(t.id);
              return (
                <div
                  key={t.id}
                  onClick={() => toggleTag(t.id)}
                  style={{ ...menuItem, fontWeight: active ? 600 : 400 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = T.hover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {active
                    ? <IconCheck size={14} style={{ color: T.fg }} />
                    : <IconTag size={14} style={{ color: T.icon }} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.name}
                  </span>
                </div>
              );
            })}

            {tags.length === 0 && (
              <div style={{ padding: '6px 12px', color: T.faint, fontSize: 12 }}>
                No tags yet — create one.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
