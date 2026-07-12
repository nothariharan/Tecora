import React from 'react';
import type { Folder, Platform } from '@/src/core/types';
import type { Chat } from '@/src/core/types';
import { FolderItem } from './FolderItem';
import { NewFolderForm } from './NewFolderForm';
import { T } from '../theme';

interface Props {
  folders: Folder[];
  allChats: Chat[];
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  platform: Platform;
  account: string;
}

const rowBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '5px 14px',
  cursor: 'pointer',
  borderRadius: 5,
  margin: '1px 4px',
  fontSize: 13,
};

function pill(selected: boolean): React.CSSProperties {
  return {
    fontSize: 11,
    background: selected ? '#d9d9d9' : T.pillBg,
    color: T.pillFg,
    borderRadius: 10,
    padding: '1px 6px',
  };
}

export function FolderList({ folders, allChats, selectedFolderId, onSelect, platform, account }: Props) {
  const allCount = allChats.length;
  const unassignedCount = allChats.filter((c) => !c.folderId).length;

  return (
    <div style={{ borderBottom: `1px solid ${T.border}`, paddingBottom: 6 }}>
      {/* All chats */}
      <div
        onClick={() => onSelect(null)}
        style={{
          ...rowBase,
          background: selectedFolderId === null ? T.selectedBg : 'transparent',
          color: selectedFolderId === null ? T.selectedFg : T.fg,
          fontWeight: selectedFolderId === null ? 600 : 500,
        }}
      >
        <span>All chats</span>
        <span style={pill(selectedFolderId === null)}>{allCount}</span>
      </div>

      {/* Unassigned */}
      {unassignedCount > 0 && folders.length > 0 && (
        <div
          onClick={() => onSelect('')}
          style={{
            ...rowBase,
            background: selectedFolderId === '' ? T.selectedBg : 'transparent',
            color: selectedFolderId === '' ? T.selectedFg : T.muted,
            fontWeight: selectedFolderId === '' ? 600 : 400,
          }}
        >
          <span>Unassigned</span>
          <span style={pill(selectedFolderId === '')}>{unassignedCount}</span>
        </div>
      )}

      {/* User folders */}
      {folders.map((f) => (
        <FolderItem
          key={f.id}
          folder={f}
          chats={allChats.filter((c) => c.folderId === f.id)}
          selected={selectedFolderId === f.id}
          onSelect={() => onSelect(f.id)}
        />
      ))}

      <NewFolderForm platform={platform} account={account} />
    </div>
  );
}
