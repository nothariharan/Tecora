import React from 'react';
import type { Chat, Folder } from '@/src/core/types';
import { ChatItem } from './ChatItem';
import { T } from '../theme';

interface Props {
  chats: Chat[];
  folders: Folder[];
}

export function ChatList({ chats, folders }: Props) {
  if (chats.length === 0) {
    return (
      <div style={{ padding: '24px 14px', textAlign: 'center', color: T.faint, fontSize: 13 }}>
        No chats found.
      </div>
    );
  }

  return (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {chats.map((chat) => (
        <ChatItem key={chat.pk} chat={chat} folders={folders} />
      ))}
    </div>
  );
}
