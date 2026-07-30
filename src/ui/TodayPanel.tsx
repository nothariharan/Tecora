import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { RuntimeRequest, RuntimeResponse } from '@/src/core/bus';
import type { DayDigest, Message, Platform, TodayTask } from '@/src/core/types';
import { buildDigest } from '@/src/core/digest';

interface Props {
  open: boolean;
  onClose: () => void;
  platform: Platform;
  account: string | null;
}

const PLATFORM_LABEL: Record<Platform, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
};

// local calendar day, not utc — "today" should match the user's wall clock
function localDay(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

async function send(req: RuntimeRequest): Promise<RuntimeResponse | undefined> {
  try {
    return (await browser.runtime.sendMessage(req)) as RuntimeResponse;
  } catch {
    return undefined;
  }
}

// return yesterday's cached recap, rebuilding it only when the underlying day
// actually changed (hash differs) so an idle day never re-runs the summarizer.
async function loadYesterday(): Promise<DayDigest | null> {
  const date = localDay(-1);
  const statsRes = await send({ type: 'get_day_stats', date });
  if (statsRes?.type !== 'get_day_stats_ok') return null;
  const stats = statsRes.stats;
  if (stats.chatCount === 0 && stats.tasksCompleted === 0) return null;

  const cachedRes = await send({ type: 'get_day_digest', date });
  const cached = cachedRes?.type === 'get_day_digest_ok' ? cachedRes.digest : null;
  if (cached && cached.hash === stats.hash) return cached;

  // summarizer reads Message[]; a single synthetic assistant turn is enough
  let summary = '';
  let source: DayDigest['source'] = 'extractive';
  if (stats.text.trim()) {
    const synthetic: Message[] = [
      { pk: 'day', chatPk: 'day', role: 'assistant', text: stats.text, ts: Date.now() },
    ];
    const digest = await buildDigest(synthetic);
    summary = digest.text;
    source = digest.source;
  }
  if (!summary.trim()) {
    summary = stats.titles.length
      ? `Worked across ${stats.chatCount} chat${stats.chatCount === 1 ? '' : 's'}: ${stats.titles.join(', ')}.`
      : `Worked across ${stats.chatCount} chat${stats.chatCount === 1 ? '' : 's'}.`;
  }

  const digest: DayDigest = {
    date,
    summary,
    chatCount: stats.chatCount,
    tasksCompleted: stats.tasksCompleted,
    source,
    hash: stats.hash,
  };
  await send({ type: 'put_day_digest', digest });
  return digest;
}

export function TodayPanel({ open, onClose }: Props) {
  const [tasks, setTasks] = useState<TodayTask[]>([]);
  const [notes, setNotes] = useState('');
  const [yesterday, setYesterday] = useState<DayDigest | null>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const notesTimer = useRef<number | undefined>(undefined);

  const today = localDay();

  const refreshTasks = useCallback(async () => {
    const res = await send({ type: 'list_tasks', date: today });
    if (res?.type === 'list_tasks_ok') setTasks(res.tasks);
  }, [today]);

  // initial + periodic load while open (background extract may add auto rows)
  useEffect(() => {
    if (!open) return;
    void refreshTasks();
    void (async () => {
      const notesRes = await send({ type: 'get_notes' });
      if (notesRes?.type === 'get_notes_ok') setNotes(notesRes.note?.text ?? '');
      setYesterday(await loadYesterday());
    })();
    const id = window.setInterval(() => void refreshTasks(), 6000);
    return () => window.clearInterval(id);
  }, [open, refreshTasks]);

  // escape + reclaim keystrokes the host tries to steal (same trick as the palette)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    const onKeypress = (e: KeyboardEvent) => e.stopPropagation();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keypress', onKeypress, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keypress', onKeypress, true);
    };
  }, [open, onClose]);

  async function addTask() {
    const text = draft.trim();
    if (!text) return;
    const task: TodayTask = {
      id: `manual:${crypto.randomUUID()}`,
      date: today,
      source: 'manual',
      text,
      done: false,
      createdAt: Date.now(),
    };
    setTasks((prev) => [...prev, task]);
    setDraft('');
    inputRef.current?.focus();
    await send({ type: 'upsert_task', task });
  }

  async function toggle(task: TodayTask) {
    const done = !task.done;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done } : t)));
    await send({ type: 'set_task_done', id: task.id, done });
  }

  async function remove(task: TodayTask) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    await send({ type: 'delete_task', id: task.id });
  }

  function onNotesChange(text: string) {
    setNotes(text);
    if (notesTimer.current) window.clearTimeout(notesTimer.current);
    notesTimer.current = window.setTimeout(() => {
      void send({ type: 'set_notes', text });
    }, 500);
  }

  if (!open) return null;

  const manual = tasks.filter((t) => t.source === 'manual');
  const auto = tasks.filter((t) => t.source === 'auto');
  const done = tasks.filter((t) => t.done).length;

  return (
    <div
      className="today-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="today-panel">
        <div className="today-head">
          <div className="today-title">Today</div>
          <div className="today-sub">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
            {tasks.length > 0 && ` · ${done}/${tasks.length} done`}
          </div>
          <button type="button" className="today-x" title="close (esc)" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="today-body">
          <section className="today-section">
            <div className="today-label">Tasks</div>
            {tasks.length === 0 && (
              <div className="today-empty">
                Nothing yet. Add a task below — anything you pick up from your chats shows here
                automatically.
              </div>
            )}
            <ul className="today-list">
              {manual.map((t) => (
                <TaskRow key={t.id} task={t} onToggle={toggle} onRemove={remove} />
              ))}
              {auto.map((t) => (
                <TaskRow key={t.id} task={t} onToggle={toggle} onRemove={remove} />
              ))}
            </ul>
            {auto.length > 0 && (
              <div className="today-note">
                Auto items come from your captured chats, on-device. “Detected phrase” means it was
                matched by wording, not AI-summarized — double-check before relying on them.
              </div>
            )}
            <div className="today-add">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void addTask();
                  }
                }}
                placeholder="add a task…"
                spellCheck={false}
              />
              <button type="button" className="today-add-btn" onClick={() => void addTask()}>
                Add
              </button>
            </div>
          </section>

          <section className="today-section">
            <div className="today-label">Notes</div>
            <textarea
              className="today-notes"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="a persistent scratchpad — kept across days, saved as you type"
              spellCheck={false}
            />
          </section>

          <section className="today-section">
            <div className="today-label">Yesterday</div>
            {yesterday ? (
              <div className="today-recap">
                <div className="today-recap-meta">
                  {yesterday.chatCount} chat{yesterday.chatCount === 1 ? '' : 's'} ·{' '}
                  {yesterday.tasksCompleted} done ·{' '}
                  {yesterday.source === 'summarizer' ? 'AI recap' : 'quick recap'}
                </div>
                <div className="today-recap-text">{yesterday.summary}</div>
              </div>
            ) : (
              <div className="today-empty">No recap for yesterday.</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onRemove,
}: {
  task: TodayTask;
  onToggle: (t: TodayTask) => void;
  onRemove: (t: TodayTask) => void;
}) {
  return (
    <li className={task.done ? 'today-item done' : 'today-item'}>
      <button
        type="button"
        className="today-check"
        aria-pressed={task.done}
        onClick={() => onToggle(task)}
        title={task.done ? 'mark not done' : 'mark done'}
      >
        {task.done ? '✓' : ''}
      </button>
      <div className="today-item-body">
        <div className="today-item-text">{task.text}</div>
        {task.source === 'auto' && (
          <div className="today-item-from">
            {task.platform ? `from ${PLATFORM_LABEL[task.platform]} · ` : ''}
            {relativeTime(task.createdAt)}
            {task.extractSource === 'extractive' && ' · detected phrase'}
          </div>
        )}
      </div>
      <button
        type="button"
        className="today-del"
        title="remove"
        onClick={() => onRemove(task)}
      >
        ×
      </button>
    </li>
  );
}

export const TODAY_STYLES = `
  .today-overlay {
    pointer-events: auto;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 12vh;
    z-index: 2147483647;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .today-panel {
    width: min(520px, calc(100vw - 32px));
    max-height: 76vh;
    display: flex;
    flex-direction: column;
    background: #111111;
    color: #ffffff;
    border: 1px solid #404040;
    border-radius: 4px;
    overflow: hidden;
    pointer-events: auto;
  }
  .today-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid #262626;
  }
  .today-title { font-size: 16px; font-weight: 600; }
  .today-sub { flex: 1; font-size: 12px; color: #a3a3a3; }
  .today-x {
    background: transparent;
    border: none;
    color: #a3a3a3;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    padding: 0;
  }
  .today-x:hover { color: #ffffff; }
  .today-body { overflow-y: auto; padding: 6px 0 10px; }
  .today-section { padding: 12px 16px 4px; }
  .today-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #737373;
    margin-bottom: 8px;
  }
  .today-empty {
    font-size: 13px;
    color: #737373;
    line-height: 1.45;
    padding: 4px 0 8px;
  }
  .today-note {
    font-size: 11px;
    color: #737373;
    line-height: 1.4;
    margin: 6px 0 2px;
  }
  .today-list { list-style: none; margin: 0; padding: 0; }
  .today-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 7px 0;
    border-bottom: 1px solid #1a1a1a;
  }
  .today-item:last-child { border-bottom: none; }
  .today-check {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    margin-top: 1px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    color: #ffffff;
    border: 1.5px solid #404040;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
    padding: 0;
  }
  .today-item.done .today-check { background: #ffffff; color: #111111; border-color: #ffffff; }
  .today-item-body { flex: 1; min-width: 0; }
  .today-item-text { font-size: 13.5px; line-height: 1.4; word-break: break-word; }
  .today-item.done .today-item-text { color: #737373; text-decoration: line-through; }
  .today-item-from { font-size: 11px; color: #737373; margin-top: 2px; }
  .today-del {
    flex-shrink: 0;
    background: transparent;
    border: none;
    color: #525252;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    padding: 0 2px;
  }
  .today-del:hover { color: #ffffff; }
  .today-add { display: flex; gap: 8px; margin-top: 10px; }
  .today-add input {
    flex: 1;
    background: #0a0a0a;
    border: 1px solid #262626;
    border-radius: 4px;
    color: #ffffff;
    font-size: 13px;
    padding: 8px 10px;
    outline: none;
  }
  .today-add input:focus { border-color: #404040; }
  .today-add-btn {
    background: #ffffff;
    color: #111111;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    padding: 0 14px;
    cursor: pointer;
  }
  .today-notes {
    width: 100%;
    min-height: 96px;
    resize: vertical;
    background: #0a0a0a;
    border: 1px solid #262626;
    border-radius: 4px;
    color: #ffffff;
    font-size: 13px;
    line-height: 1.5;
    padding: 10px;
    outline: none;
    font-family: inherit;
  }
  .today-notes:focus { border-color: #404040; }
  .today-recap { }
  .today-recap-meta { font-size: 11px; color: #737373; margin-bottom: 5px; }
  .today-recap-text { font-size: 13px; color: #d4d4d4; line-height: 1.5; white-space: pre-wrap; }
`;
