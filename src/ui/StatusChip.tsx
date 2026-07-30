import React, { useEffect, useRef, useState } from 'react';
import { IconFile, IconSearch, IconTau, IconToday } from './components/Icons';
import type { RuntimeRequest, RuntimeResponse } from '@/src/core/bus';

const DOCK_POS_KEY = 'tecora_dock_pos';

// distance from the viewport's right/bottom edges — keeps the actions expanding
// leftward like the default corner anchor even after a drag
interface DockPos {
  right: number;
  bottom: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// floating tau dock — click the mark to expand the action row (search, library,
// today), click again / outside / escape to collapse. drag the mark to reposition
// it anywhere; the spot is remembered across page loads.
export function StatusChip({
  onOpenPalette,
  onOpenToday,
  notice,
  onDismissNotice,
}: {
  chatCount?: number;
  onOpenPalette: () => void;
  onOpenToday: () => void;
  notice?: string | null;
  onDismissNotice?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pos, setPos] = useState<DockPos | null>(null);
  const [dragging, setDragging] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);
  const posRef = useRef<DockPos | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    right: number;
    bottom: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);

  // restore a saved position once
  useEffect(() => {
    browser.storage.local
      .get(DOCK_POS_KEY)
      .then((data) => {
        const saved = data[DOCK_POS_KEY] as DockPos | undefined;
        if (saved && typeof saved.right === 'number' && typeof saved.bottom === 'number') {
          posRef.current = saved;
          setPos(saved);
        }
      })
      .catch(() => {});
  }, []);

  // collapse on outside click / escape. composedPath crosses the shadow boundary,
  // so we can tell "inside our dock" from "somewhere on the host page".
  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (e: Event) => {
      const dock = dockRef.current;
      if (dock && !e.composedPath().includes(dock)) setExpanded(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [expanded]);

  // drag the chip to move the whole dock; below a small threshold it's a click
  function startDrag(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    const base = posRef.current ?? { right: 20, bottom: 20 };
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      right: base.right,
      bottom: base.bottom,
      moved: false,
    };

    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      if (!d.moved && Math.hypot(dx, dy) < 4) return;
      d.moved = true;
      setDragging(true);
      const next: DockPos = {
        right: clamp(d.right - dx, 6, window.innerWidth - 58),
        bottom: clamp(d.bottom - dy, 6, window.innerHeight - 58),
      };
      posRef.current = next;
      setPos(next);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      const d = dragRef.current;
      dragRef.current = null;
      setDragging(false);
      if (d?.moved) {
        // eat the click that follows a drag so it doesn't toggle the row
        suppressClick.current = true;
        if (posRef.current) {
          void browser.storage.local.set({ [DOCK_POS_KEY]: posRef.current }).catch(() => {});
        }
      }
    };

    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
  }

  function onChipClick() {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setExpanded((v) => !v);
  }

  // fire the message in the same turn as the gesture — async wrappers lose it on chrome
  function requestSidePanel() {
    browser.runtime
      .sendMessage({ type: 'open_side_panel' } satisfies RuntimeRequest)
      .then((res) => {
        const reply = res as RuntimeResponse;
        if (reply?.type === 'open_side_panel_error') {
          console.warn('[tecora] could not open side panel', reply.error);
        }
      })
      .catch((err) => {
        console.warn('[tecora] could not open side panel', err);
      });
  }

  return (
    <div
      className="dock"
      title="tecora"
      ref={dockRef}
      style={pos ? { right: pos.right, bottom: pos.bottom } : undefined}
    >
      {notice && (
        <div className="notice">
          <span className="notice-text">{notice} · consider a fresh chat</span>
          <button
            type="button"
            className="notice-x"
            title="dismiss"
            onClick={onDismissNotice}
          >
            ×
          </button>
        </div>
      )}
      <div className="dock-row">
        <div className={expanded ? 'actions open' : 'actions'} aria-hidden={!expanded}>
          <button
            type="button"
            className="action"
            title="search chats (ctrl/cmd+k)"
            onClick={() => {
              onOpenPalette();
              // keep the row open so switching panels is one click
              setExpanded(true);
            }}
          >
            <IconSearch size={16} />
          </button>
          <button
            type="button"
            className="action"
            title="today — tasks, notes, recap"
            onClick={() => {
              onOpenToday();
              setExpanded(true);
            }}
          >
            <IconToday size={16} />
          </button>
          <button
            type="button"
            className="action"
            title="open tecora side panel"
            onMouseDown={(e) => {
              // mousedown keeps the chrome user-gesture token more reliably than click
              if (e.button !== 0) return;
              e.preventDefault();
              requestSidePanel();
              setExpanded(true);
            }}
          >
            <IconFile size={16} />
          </button>
        </div>
        <button
          type="button"
          className={dragging ? 'chip dragging' : 'chip'}
          title="tecora — click for actions, drag to move"
          aria-expanded={expanded}
          onPointerDown={startDrag}
          onClick={onChipClick}
        >
          <span className="mark" aria-hidden>
            <IconTau size={22} />
          </span>
        </button>
      </div>
    </div>
  );
}

export const CHIP_STYLES = `
  .dock {
    pointer-events: auto;
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }
  .dock-row {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0;
  }
  .notice {
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 260px;
    background: #111111;
    color: #ffffff;
    border: 2px solid #ffffff;
    border-radius: 10px;
    padding: 7px 10px;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.4);
    font-size: 12px;
    line-height: 1.35;
  }
  .notice-text { flex: 1; }
  .notice-x {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    color: #a3a3a3;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 0;
  }
  .notice-x:hover { color: #ffffff; }
  .actions {
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 0;
    opacity: 0;
    overflow: hidden;
    margin-right: 0;
    pointer-events: none;
    transition:
      max-width 220ms cubic-bezier(0.22, 1, 0.36, 1),
      opacity 180ms ease,
      margin-right 220ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .actions.open {
    max-width: 180px;
    opacity: 1;
    margin-right: 8px;
    pointer-events: auto;
  }
  .action {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #ffffff;
    background: #111111;
    color: #ffffff;
    border-radius: 999px;
    cursor: pointer;
    padding: 0;
  }
  .action:hover { background: #000000; }
  .chip {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #ffffff;
    background: #111111;
    color: #ffffff;
    border-radius: 999px;
    cursor: grab;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.4);
    touch-action: none;
    user-select: none;
  }
  .chip:hover { background: #000000; }
  .chip.dragging { cursor: grabbing; }
  .mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 0;
  }
`;
