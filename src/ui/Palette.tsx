import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { RuntimeRequest, RuntimeResponse } from '@/src/core/bus';
import type { Folder, Platform } from '@/src/core/types';
import type { SearchHit } from '@/src/core/search';

type Mode = 'search' | 'commands';

interface Props {
  open: boolean;
  onClose: () => void;
  platform: Platform;
  account: string | null;
  onOpenChat: (chatId: string) => void;
}

function getSnippet(text: string | undefined, query: string): string | null {
  if (!text || !query) return null;
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return null;

  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + query.length + 60);
  let snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}

async function searchChats(
  query: string,
  platform: Platform,
  account: string | null,
): Promise<SearchHit[]> {
  const res = (await browser.runtime.sendMessage({
    type: 'search_chats',
    query,
    platform,
    account: account ?? undefined,
    limit: 12,
  } satisfies RuntimeRequest)) as RuntimeResponse;

  if (res.type !== 'search_chats_ok') return [];
  return res.hits;
}

async function listFolders(platform: Platform, account: string): Promise<Folder[]> {
  const res = (await browser.runtime.sendMessage({
    type: 'list_folders',
    platform,
    account,
  } satisfies RuntimeRequest)) as RuntimeResponse;

  if (res.type !== 'list_folders_ok') return [];
  return res.folders;
}

export function Palette({ open, onClose, platform, account, onOpenChat }: Props) {
  const [input, setInput] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const mode: Mode = input.startsWith('>') ? 'commands' : 'search';
  const commandQuery = mode === 'commands' ? input.slice(1).trim().toLowerCase() : '';

  const commands = useMemo(() => {
    if (mode !== 'commands') return [];
    const base = [
      { id: 'hint-move', label: 'move to folder…', detail: 'open a chat first, then use the side panel' },
      { id: 'hint-side', label: 'open side panel', detail: 'click the tecora toolbar icon' },
    ];
    if (!commandQuery) return base;
    return base.filter((c) => c.label.includes(commandQuery));
  }, [mode, commandQuery]);

  const folderName = (id?: string) => folders.find((f) => f.id === id)?.name;

  useEffect(() => {
    if (!open) return;
    setInput('');
    setActive(0);
    inputRef.current?.focus();

    if (account) {
      listFolders(platform, account).then(setFolders);
    }
    searchChats('', platform, account).then(setHits);
  }, [open, platform, account]);

  useEffect(() => {
    if (!open || mode !== 'search') return;

    const t = setTimeout(() => {
      searchChats(input, platform, account).then((next) => {
        setHits(next);
        setActive(0);
      });
    }, 80);

    return () => clearTimeout(t);
  }, [input, open, mode, platform, account]);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      const count = mode === 'search' ? hits.length : commands.length;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setActive((i) => (count === 0 ? 0 : (i + 1) % count));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setActive((i) => (count === 0 ? 0 : (i - 1 + count) % count));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (mode === 'search' && hits[active]) {
          onOpenChat(hits[active].chatId);
          onClose();
        }
      }
    }

    // capture so we beat the host page's own shortcuts while open
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, mode, hits, commands, active, onClose, onOpenChat]);

  if (!open) return null;

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel" style={{ pointerEvents: 'auto' }}>
        <div className="input-row">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='search chats…  or type ">" for commands'
            spellCheck={false}
          />
          <span className="badge">full-text</span>
        </div>

        {mode === 'search' ? (
          <ul className="list">
            {hits.length === 0 && (
              <li className="empty">no chats match</li>
            )}
            {hits.map((hit, i) => (
              <li
                key={hit.pk}
                className={i === active ? 'item active' : 'item'}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onOpenChat(hit.chatId);
                  onClose();
                }}
              >
                <div className="title">{hit.title}</div>
                {hit.text && mode === 'search' && input && (
                  <div className="snippet">{getSnippet(hit.text, input)}</div>
                )}
                <div className="meta">
                  <span>{folderName(hit.folderId) ?? 'unfiled'}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="list">
            {commands.length === 0 && <li className="empty">no commands</li>}
            {commands.map((cmd, i) => (
              <li key={cmd.id} className={i === active ? 'item active' : 'item'}>
                <div className="title">{cmd.label}</div>
                <div className="meta"><span>{cmd.detail}</span></div>
              </li>
            ))}
          </ul>
        )}

        <div className="footer">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}

export const PALETTE_STYLES = `
  :host, * { box-sizing: border-box; }
  .overlay {
    pointer-events: auto;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 14vh;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .panel {
    width: min(560px, calc(100vw - 32px));
    background: #111111;
    color: #ffffff;
    border: 1px solid #404040;
    border-radius: 4px;
    overflow: hidden;
  }
  .input-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    border-bottom: 1px solid #262626;
  }
  .input-row input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #ffffff;
    font-size: 15px;
  }
  .badge {
    font-size: 10px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #a3a3a3;
    border: 1px solid #404040;
    border-radius: 4px;
    padding: 2px 7px;
    white-space: nowrap;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 4px;
    max-height: 360px;
    overflow-y: auto;
  }
  .item {
    padding: 10px 12px;
    border-radius: 4px;
    cursor: pointer;
  }
  .item.active { background: #262626; }
  .title {
    font-size: 13px;
    font-weight: 500;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .snippet {
    font-size: 11px;
    color: #a3a3a3;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .meta {
    margin-top: 3px;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 11px;
    color: #a3a3a3;
  }
  .empty {
    padding: 18px 12px;
    text-align: center;
    color: #737373;
    font-size: 13px;
  }
  .footer {
    display: flex;
    gap: 14px;
    padding: 8px 14px;
    border-top: 1px solid #262626;
    font-size: 11px;
    color: #737373;
  }
`;
