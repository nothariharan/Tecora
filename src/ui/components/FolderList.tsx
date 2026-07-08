import React from 'react';
import type { Folder, Platform } from '@/src/core/types';
import type { Chat } from '@/src/core/types';
import { FolderItem } from './FolderItem';
import { NewFolderForm } from './NewFolderForm';

interface Props {
  folders: Folder[];
  allChats: Chat[];
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  platform: Platform;
  account: string;
}

export function FolderList({ folders, allChats, selectedFolderId, onSelect, platform, account }: Props) {
  const allCount = allChats.length;
  const unassignedCount = allChats.filter((c) => !c.folderId).length;

  return (
    <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 6 }}>
      {/* All chats */}
      <div
        onClick={() => onSelect(null)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '5px 14px',
          cursor: 'pointer',
          borderRadius: 5,
          margin: '1px 4px',
          background: selectedFolderId === null ? '#eff6ff' : 'transparent',
          color: selectedFolderId === null ? '#1d4ed8' : '#374151',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        <span>All chats</span>
        <span style={{
          fontSize: 11,
          background: selectedFolderId === null ? '#bfdbfe' : '#e5e7eb',
          borderRadius: 10,
          padding: '1px 6px',
        }}>
          {allCount}
        </span>
      </div>

      {/* Unassigned */}
      {unassignedCount > 0 && folders.length > 0 && (
        <div
          onClick={() => onSelect('')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 14px',
            cursor: 'pointer',
            borderRadius: 5,
            margin: '1px 4px',
            background: selectedFolderId === '' ? '#eff6ff' : 'transparent',
            color: selectedFolderId === '' ? '#1d4ed8' : '#6b7280',
            fontSize: 13,
          }}
        >
          <span>Unassigned</span>
          <span style={{
            fontSize: 11,
            background: selectedFolderId === '' ? '#bfdbfe' : '#e5e7eb',
            borderRadius: 10,
            padding: '1px 6px',
          }}>
            {unassignedCount}
          </span>
        </div>
      )}

      {/* User folders */}
      {folders.map((f) => (
        <FolderItem
          key={f.id}
          folder={f}
          count={allChats.filter((c) => c.folderId === f.id).length}
          selected={selectedFolderId === f.id}
          onSelect={() => onSelect(f.id)}
        />
      ))}

      <NewFolderForm platform={platform} account={account} />
    </div>
  );
}
