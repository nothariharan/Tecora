import React, { useState } from 'react';
import type { Chat, Tag } from '@/src/core/types';
import type { RuntimeRequest } from '@/src/core/bus';
import { useExport } from '../ExportContext';
import { IconTag, IconExport, IconTrash } from './Icons';
import { T } from '../theme';

interface Props {
  tag: Tag;
  chats: Chat[];
  selected: boolean;
  onSelect: () => void;
}

export function TagItem({ tag, chats, selected, onSelect }: Props) {
  const [hover, setHover] = useState(false);
  const { busy, exportChats } = useExport();

  async function deleteTag(e: React.MouseEvent) {
    e.stopPropagation();
    await browser.runtime.sendMessage({
      type: 'delete_tag',
      tagId: tag.id,
    } satisfies RuntimeRequest);
  }

  function exportTag(e: React.MouseEvent) {
    e.stopPropagation();
    if (busy || chats.length === 0) return;
    exportChats(chats, tag.name);
  }

  const actionBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 22, height: 22, border: 'none', background: 'transparent',
    borderRadius: 5, cursor: 'pointer', color: T.icon, padding: 0,
  };

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        cursor: 'pointer',
        borderRadius: T.radius,
        margin: '1px 6px',
        background: selected ? T.selectedBg : hover ? T.hover : 'transparent',
        color: selected ? T.selectedFg : T.fg,
        fontWeight: selected ? 600 : 450,
        fontSize: 13,
        gap: 8,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <IconTag size={15} style={{ color: selected ? T.fg : T.icon }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          #{tag.name}
        </span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        {hover ? (
          <>
            {chats.length > 0 && (
              <span
                onClick={exportTag}
                title="Export tagged chats"
                style={actionBtn}
                onMouseEnter={(e) => { e.currentTarget.style.background = T.selectedBg; e.currentTarget.style.color = T.fg; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.icon; }}
              >
                <IconExport size={14} />
              </span>
            )}
            <span
              onClick={deleteTag}
              title="Delete tag"
              style={actionBtn}
              onMouseEnter={(e) => { e.currentTarget.style.background = T.selectedBg; e.currentTarget.style.color = T.fg; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.icon; }}
            >
              <IconTrash size={14} />
            </span>
          </>
        ) : (
          <span style={{
            fontSize: 11,
            fontWeight: 550,
            minWidth: 18,
            textAlign: 'center',
            background: selected ? T.pillStrongBg : T.pillBg,
            color: T.pillFg,
            borderRadius: T.radius,
            padding: '1px 7px',
          }}>
            {chats.length}
          </span>
        )}
      </span>
    </div>
  );
}
