import React from 'react';
import type { Folder } from '@/src/core/types';
import type { RuntimeRequest } from '@/src/core/bus';

interface Props {
  folder: Folder;
  count: number;
  selected: boolean;
  onSelect: () => void;
}

export function FolderItem({ folder, count, selected, onSelect }: Props) {
  async function deleteFolder(e: React.MouseEvent) {
    e.stopPropagation();
    await browser.runtime.sendMessage({
      type: 'delete_folder',
      folderId: folder.id,
    } satisfies RuntimeRequest);
  }

  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '5px 14px',
        cursor: 'pointer',
        borderRadius: 5,
        margin: '1px 4px',
        background: selected ? '#eff6ff' : 'transparent',
        color: selected ? '#1d4ed8' : '#374151',
        fontSize: 13,
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        📁 {folder.name}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{
          fontSize: 11,
          background: selected ? '#bfdbfe' : '#e5e7eb',
          borderRadius: 10,
          padding: '1px 6px',
        }}>
          {count}
        </span>
        <span
          onClick={deleteFolder}
          title="Delete folder"
          style={{ fontSize: 11, color: '#9ca3af', cursor: 'pointer', lineHeight: 1 }}
        >
          ✕
        </span>
      </span>
    </div>
  );
}
