import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { RuntimeRequest, RuntimeResponse } from '@/src/core/bus';
import type { Folder, Message, Platform } from '@/src/core/types';
import type { SearchHit } from '@/src/core/search';
import { collectCodeBlocks, revealCodeBlock, type CodeBlockRef } from '@/src/adapters/code-blocks';
import { codeWithContext, loadSnippets, type Snippet } from '@/src/core/snippets';

type Mode = 'search' | 'commands';
type Scope = 'chat' | 'all';

interface ChatMatch {
  pk: string;
  role: Message['role'];
  snippet: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  platform: Platform;
  account: string | null;
  currentChatId: string | null;
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
    limit: 50,
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

async function fetchChatMessages(chatPk: string): Promise<Message[]> {
  const res = (await browser.runtime.sendMessage({
    type: 'get_stored_messages',
    chatPks: [chatPk],
  } satisfies RuntimeRequest)) as RuntimeResponse;

  if (res.type !== 'get_stored_messages_ok') return [];
  return res.byChatPk[chatPk] ?? [];
}

// native ctrl+f only sees mounted dom; we search every captured message instead
function matchMessages(messages: Message[], query: string): ChatMatch[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches: ChatMatch[] = [];
  for (const message of messages) {
    if (!message.text.toLowerCase().includes(q)) continue;
    const snippet = getSnippet(message.text, query);
    if (snippet) matches.push({ pk: message.pk, role: message.role, snippet });
  }
  return matches;
}

export function Palette({ open, onClose, platform, account, currentChatId, onOpenChat }: Props) {
  const [input, setInput] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [active, setActive] = useState(0);
  const [scope, setScope] = useState<Scope>('all');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [codeBlocks, setCodeBlocks] = useState<CodeBlockRef[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chatPk =
    currentChatId && account ? `${platform}:${account}:${currentChatId}` : null;
  const mode: Mode = input.startsWith('>') ? 'commands' : 'search';
  const inChat = mode === 'search' && scope === 'chat' && Boolean(chatPk);
  const commandQuery = mode === 'commands' ? input.slice(1).trim().toLowerCase() : '';

  const chatMatches = useMemo(
    () => (inChat ? matchMessages(chatMessages, input) : []),
    [inChat, chatMessages, input],
  );

  const commands = useMemo(() => {
    if (mode !== 'commands') return [];
    const base = [
      { id: 'hint-move', label: 'move to folder…', detail: 'open a chat first, then use the side panel' },
      { id: 'hint-side', label: 'open side panel', detail: 'click the tecora toolbar icon' },
    ];
    if (!commandQuery) return base;
    return base.filter((c) => c.label.includes(commandQuery));
  }, [mode, commandQuery]);

  const visibleSnippets = useMemo(() => {
    if (mode !== 'commands') return [];
    const q = commandQuery.replace(/^snippets?\s*/, '');
    if (!q) return snippets;
    return snippets.filter(
      (s) => s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q),
    );
  }, [mode, commandQuery, snippets]);

  const folderName = (id?: string) => folders.find((f) => f.id === id)?.name;

  useEffect(() => {
    if (!open) return;
    setInput('');
    setActive(0);
    // default to searching the open chat when there is one
    setScope(chatPk ? 'chat' : 'all');
    // focus now and again next frame — the host often grabs focus on open
    inputRef.current?.focus();
    const raf = requestAnimationFrame(() => inputRef.current?.focus());

    setCopied(null);
    loadSnippets().then(setSnippets);
    if (account) {
      listFolders(platform, account).then(setFolders);
    }
    searchChats('', platform, account).then(setHits);

    return () => cancelAnimationFrame(raf);
  }, [open, platform, account, chatPk]);

  // scan the open chat's rendered code blocks for the jump-to-code outline
  useEffect(() => {
    if (!open || !inChat) {
      setCodeBlocks([]);
      return;
    }
    setCodeBlocks(collectCodeBlocks(platform));
  }, [open, inChat, platform, currentChatId]);

  const jumpToCode = (block: CodeBlockRef) => {
    revealCodeBlock(block.el);
    onClose();
  };

  const flashCopied = (label: string) => {
    setCopied(label);
    window.setTimeout(() => setCopied((c) => (c === label ? null : c)), 1400);
  };

  const copyBlockWithContext = async (block: CodeBlockRef) => {
    const code = (block.el.querySelector('code') ?? block.el).textContent ?? '';
    const question = chatMessages.find((m) => m.role === 'user')?.text ?? null;
    const withCtx = codeWithContext({
      body: code,
      platform,
      language: block.language,
      question,
    });
    try {
      await navigator.clipboard.writeText(withCtx);
      flashCopied(`code-${block.index}`);
    } catch {
      // clipboard blocked — nothing else we can do from here
    }
  };

  const copySnippet = async (snippet: Snippet) => {
    try {
      await navigator.clipboard.writeText(snippet.body);
      flashCopied(snippet.id);
    } catch {
      // ignore
    }
  };

  // load the open chat's captured messages once, for in-chat search
  useEffect(() => {
    if (!open || !chatPk) {
      setChatMessages([]);
      return;
    }
    let cancelled = false;
    fetchChatMessages(chatPk).then((messages) => {
      if (!cancelled) setChatMessages(messages);
    });
    return () => {
      cancelled = true;
    };
  }, [open, chatPk]);

  useEffect(() => {
    if (!open || mode !== 'search' || scope === 'chat') return;

    const t = setTimeout(() => {
      searchChats(input, platform, account).then((next) => {
        setHits(next);
        setActive(0);
      });
    }, 80);

    return () => clearTimeout(t);
  }, [input, open, mode, scope, platform, account]);

  useEffect(() => {
    if (!open) return;

    // claude/chatgpt "type anywhere to focus the composer" can't see into our
    // shadow root, so it hijacks keystrokes. keep our field focused instead.
    const refocus = () => {
      const el = inputRef.current;
      if (!el) return;
      const rootActive = (el.getRootNode() as ShadowRoot | Document).activeElement;
      if (rootActive !== el) el.focus();
    };

    function onKey(e: KeyboardEvent) {
      // beat the host's own key handlers (window capture fires before document)
      e.stopPropagation();

      // in-chat results are read-only (no reliable scroll target), so nav is off
      const count = inChat ? 0 : mode === 'search' ? hits.length : commands.length;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => (count === 0 ? 0 : (i + 1) % count));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => (count === 0 ? 0 : (i - 1 + count) % count));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (mode === 'search' && !inChat && hits[active]) {
          onOpenChat(hits[active].chatId);
          onClose();
        }
        return;
      }

      // printable key while the host may hold focus — reclaim it so the char
      // lands in our input's default insertion (not the page composer)
      if (!e.metaKey && !e.ctrlKey && !e.altKey) refocus();
    }

    // some hosts hijack on keypress too — block it without touching input/beforeinput
    function onKeypress(e: KeyboardEvent) {
      e.stopPropagation();
    }

    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keypress', onKeypress, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keypress', onKeypress, true);
    };
  }, [open, mode, inChat, hits, commands, active, onClose, onOpenChat]);

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
            placeholder={
              inChat
                ? 'search this chat…'
                : 'search chats…  or ">" for snippets & commands'
            }
            spellCheck={false}
          />
          <span className="badge">{inChat ? 'this chat' : 'full-text'}</span>
        </div>

        {chatPk && mode === 'search' && (
          <div className="scope-row">
            <button
              type="button"
              className={scope === 'chat' ? 'scope-btn active' : 'scope-btn'}
              onMouseDown={(e) => {
                e.preventDefault();
                setScope('chat');
                setActive(0);
              }}
            >
              This chat{chatMessages.length ? ` (${chatMessages.length})` : ''}
            </button>
            <button
              type="button"
              className={scope === 'all' ? 'scope-btn active' : 'scope-btn'}
              onMouseDown={(e) => {
                e.preventDefault();
                setScope('all');
                setActive(0);
              }}
            >
              All chats
            </button>
          </div>
        )}

        {inChat && !input.trim() ? (
          <ul className="list">
            {codeBlocks.length === 0 && (
              <li className="empty">
                no code blocks on screen — type to search this chat's captured messages
              </li>
            )}
            {codeBlocks.length > 0 && (
              <li className="section-label">
                {codeBlocks.length} code block{codeBlocks.length === 1 ? '' : 's'} in view · click to jump
              </li>
            )}
            {codeBlocks.map((block) => (
              <li
                key={block.index}
                className="item"
                onMouseDown={(e) => {
                  e.preventDefault();
                  jumpToCode(block);
                }}
              >
                <div className="meta">
                  <span className="role-tag">{block.language ?? 'code'}</span>
                  <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span>{block.lineCount} line{block.lineCount === 1 ? '' : 's'}</span>
                    <button
                      type="button"
                      className="ghost-btn"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void copyBlockWithContext(block);
                      }}
                    >
                      {copied === `code-${block.index}` ? 'copied' : 'copy'}
                    </button>
                  </span>
                </div>
                <div className="snippet mono">{block.preview || '(empty block)'}</div>
              </li>
            ))}
          </ul>
        ) : inChat ? (
          <ul className="list">
            {chatMessages.length === 0 && (
              <li className="empty">no messages captured for this chat yet — open it and let it load</li>
            )}
            {chatMessages.length > 0 && input.trim() && chatMatches.length === 0 && (
              <li className="empty">no messages match</li>
            )}
            {chatMatches.map((match) => (
              <li key={match.pk} className="item static">
                <div className="meta">
                  <span className="role-tag">{match.role}</span>
                </div>
                <div className="snippet wrap">{match.snippet}</div>
              </li>
            ))}
          </ul>
        ) : mode === 'search' ? (
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
            <li className="section-label">Prompt snippets · click to copy, then paste</li>
            {visibleSnippets.length === 0 && (
              <li className="empty">no snippets match</li>
            )}
            {visibleSnippets.map((snippet) => (
              <li
                key={snippet.id}
                className="item"
                onMouseDown={(e) => {
                  e.preventDefault();
                  void copySnippet(snippet);
                }}
              >
                <div className="title">
                  {snippet.title}
                  {copied === snippet.id && <span className="copied-tag"> · copied</span>}
                </div>
                <div className="snippet">{snippet.body.replace(/\s+/g, ' ').trim()}</div>
              </li>
            ))}
            {commands
              .filter((c) => c.id.startsWith('hint'))
              .map((cmd) => (
                <li key={cmd.id} className="item static">
                  <div className="title">{cmd.label}</div>
                  <div className="meta"><span>{cmd.detail}</span></div>
                </li>
              ))}
          </ul>
        )}

        <div className="footer">
          {inChat && !input.trim() ? (
            <span>outline of code blocks on screen — click to scroll there</span>
          ) : inChat ? (
            <span>searching this chat — reads captured messages, not just what's on screen</span>
          ) : (
            <>
              <span>↑↓ navigate</span>
              <span>↵ open</span>
              <span>esc close</span>
            </>
          )}
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
  .item.static { cursor: default; }
  .scope-row {
    display: flex;
    gap: 6px;
    padding: 8px 12px;
    border-bottom: 1px solid #262626;
  }
  .scope-btn {
    font-size: 11px;
    font-weight: 600;
    color: #a3a3a3;
    background: transparent;
    border: 1px solid #404040;
    border-radius: 4px;
    padding: 3px 9px;
    cursor: pointer;
  }
  .scope-btn.active {
    color: #111111;
    background: #ffffff;
    border-color: #ffffff;
  }
  .role-tag {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #a3a3a3;
    border: 1px solid #404040;
    border-radius: 3px;
    padding: 1px 6px;
  }
  .snippet.wrap {
    white-space: normal;
    overflow: visible;
  }
  .snippet.mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: #d4d4d4;
  }
  .section-label {
    padding: 6px 12px 4px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #737373;
  }
  .ghost-btn {
    font-size: 10px;
    font-weight: 600;
    color: #a3a3a3;
    background: transparent;
    border: 1px solid #404040;
    border-radius: 4px;
    padding: 1px 7px;
    cursor: pointer;
  }
  .ghost-btn:hover { color: #ffffff; border-color: #ffffff; }
  .copied-tag { color: #22c55e; font-weight: 600; }
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
