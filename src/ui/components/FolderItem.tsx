import React, { useState } from 'react';
import type { Chat, Folder } from '@/src/core/types';
import type { RuntimeRequest } from '@/src/core/bus';
import { useExport } from '../ExportContext';
import { T } from '../theme';

interface Props {
  folder: Folder;
  chats: Chat[];
  selected: boolean;
  onSelect: () => void;
}

export function FolderItem({ folder, chats, selected, onSelect }: Props) {
  const [hover, setHover] = useState(false);
  const { busy, exportChats } = useExport();

  async function deleteFolder(e: React.MouseEvent) {
    e.stopPropagation();
    await browser.runtime.sendMessage({
      type: 'delete_folder',
      folderId: folder.id,
    } satisfies RuntimeRequest);
  }

  function exportFolder(e: React.MouseEvent) {
    e.stopPropagation();
    if (busy || chats.length === 0) return;
    exportChats(chats, folder.name);
  }

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '5px 14px',
        cursor: 'pointer',
        borderRadius: 5,
        margin: '1px 4px',
        background: selected ? T.selectedBg : hover ? T.hover : 'transparent',
        color: selected ? T.selectedFg : T.fg,
        fontWeight: selected ? 600 : 400,
        fontSize: 13,
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {folder.name}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {hover && chats.length > 0 && (
          <span
            onClick={exportFolder}
            title="Export folder as markdown"
            style={{
              fontSize: 10,
              color: T.muted,
              cursor: 'pointer',
              lineHeight: 1,
              border: `1px solid ${T.borderStrong}`,
              borderRadius: 3,
              padding: '1px 4px',
            }}
          >
            Export
          </span>
        )}
        <span style={{
          fontSize: 11,
          background: selected ? '#d9d9d9' : T.pillBg,
          color: T.pillFg,
          borderRadius: 10,
          padding: '1px 6px',
        }}>
          {chats.length}
        </span>
        <span
          onClick={deleteFolder}
          title="Delete folder"
          style={{ fontSize: 11, color: T.faint, cursor: 'pointer', lineHeight: 1 }}
        >
          ✕
        </span>
      </span>
    </div>
  );
}
