import React from 'react';
import type { Tag, Platform } from '@/src/core/types';
import type { Chat } from '@/src/core/types';
import { TagItem } from './TagItem';
import { NewTagForm } from './NewTagForm';
import { T } from '../theme';

interface Props {
  tags: Tag[];
  allChats: Chat[];
  selectedTagId: string | null;
  onSelect: (tagId: string | null) => void;
  platform: Platform;
  account: string;
}

export function TagList({ tags, allChats, selectedTagId, onSelect, platform, account }: Props) {
  return (
    <div style={{ borderBottom: `1px solid ${T.border}`, padding: '6px 0' }}>
      {tags.length > 0 && (
        <div style={{
          padding: '8px 16px 4px',
          fontSize: 10.5,
          fontWeight: 650,
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          color: T.faint,
        }}>
          Tags
        </div>
      )}

      {tags.map((t) => (
        <TagItem
          key={t.id}
          tag={t}
          chats={allChats.filter((c) => c.tagIds && c.tagIds.includes(t.id))}
          selected={selectedTagId === t.id}
          onSelect={() => {
            if (selectedTagId === t.id) {
              onSelect(null);
            } else {
              onSelect(t.id);
            }
          }}
        />
      ))}

      <NewTagForm platform={platform} account={account} />
    </div>
  );
}
