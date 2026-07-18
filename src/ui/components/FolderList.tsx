import React from 'react';
import type { Folder, Platform } from '@/src/core/types';
import type { Chat } from '@/src/core/types';
import { FolderItem } from './FolderItem';
import { NewFolderForm } from './NewFolderForm';
import { IconChats, IconInbox } from './Icons';
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
  padding: '6px 10px',
  cursor: 'pointer',
  borderRadius: T.radius,
  margin: '1px 6px',
  fontSize: 13,
};

function pill(selected: boolean): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 500,
    minWidth: 18,
    textAlign: 'center',
    background: selected ? T.pillStrongBg : T.pillBg,
    color: T.pillFg,
    borderRadius: T.radius,
    padding: '1px 6px',
  };
}

export function FolderList({ folders, allChats, selectedFolderId, onSelect, platform, account }: Props) {
  const allCount = allChats.length;
  const unassignedCount = allChats.filter((c) => !c.folderId).length;
  const showUnassigned = unassignedCount > 0 && folders.length > 0;

  return (
    <div style={{ borderBottom: `1px solid ${T.border}`, padding: '6px 0' }}>
      {/* All chats */}
      <div
        onClick={() => onSelect(null)}
        style={{
          ...rowBase,
          background: selectedFolderId === null ? T.selectedBg : 'transparent',
          color: selectedFolderId === null ? T.selectedFg : T.fg,
          fontWeight: selectedFolderId === null ? 600 : 500,
        }}
        onMouseEnter={(e) => { if (selectedFolderId !== null) e.currentTarget.style.background = T.hover; }}
        onMouseLeave={(e) => { if (selectedFolderId !== null) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <IconChats size={15} style={{ color: selectedFolderId === null ? T.fg : T.icon }} />
          <span>All chats</span>
        </span>
        <span style={pill(selectedFolderId === null)}>{allCount}</span>
      </div>

      {/* Unassigned */}
      {showUnassigned && (
        <div
          onClick={() => onSelect('')}
          style={{
            ...rowBase,
            background: selectedFolderId === '' ? T.selectedBg : 'transparent',
            color: selectedFolderId === '' ? T.selectedFg : T.muted,
            fontWeight: selectedFolderId === '' ? 600 : 450,
          }}
          onMouseEnter={(e) => { if (selectedFolderId !== '') e.currentTarget.style.background = T.hover; }}
          onMouseLeave={(e) => { if (selectedFolderId !== '') e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            <IconInbox size={15} style={{ color: selectedFolderId === '' ? T.fg : T.icon }} />
            <span>Unassigned</span>
          </span>
          <span style={pill(selectedFolderId === '')}>{unassignedCount}</span>
        </div>
      )}

      {folders.length > 0 && (
        <div style={{
          padding: '8px 16px 4px',
          fontSize: 10.5,
          fontWeight: 650,
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          color: T.faint,
        }}>
          Folders
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
