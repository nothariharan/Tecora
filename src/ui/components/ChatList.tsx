import React from 'react';
import type { Chat, Folder, Tag } from '@/src/core/types';
import { ChatItem } from './ChatItem';
import { T } from '../theme';

interface Props {
  chats: Chat[];
  folders: Folder[];
  tags: Tag[];
  editMode?: boolean;
  selectedChatPks?: Set<string>;
  onToggleSelectChat?: (chatPk: string) => void;
}

export function ChatList({
  chats,
  folders,
  tags,
  editMode = false,
  selectedChatPks = new Set(),
  onToggleSelectChat,
}: Props) {
  if (chats.length === 0) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        textAlign: 'center',
        color: T.faint,
        fontSize: 13,
      }}>
        No chats found.
      </div>
    );
  }

  return (
    <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0 8px' }}>
      {chats.map((chat) => (
        <ChatItem
          key={chat.pk}
          chat={chat}
          folders={folders}
          tags={tags}
          editMode={editMode}
          selected={selectedChatPks.has(chat.pk)}
          onToggleSelect={() => onToggleSelectChat?.(chat.pk)}
        />
      ))}
    </div>
  );
}
