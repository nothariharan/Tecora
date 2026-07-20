import React from 'react';
import { IconFile, IconSearch, IconTau } from './components/Icons';
import type { RuntimeRequest, RuntimeResponse } from '@/src/core/bus';

// floating tau dock — hover expands left with search + side panel actions
export function StatusChip({
  onOpenPalette,
}: {
  chatCount?: number;
  onOpenPalette: () => void;
}) {
  async function openSidePanel() {
    try {
      const res = (await browser.runtime.sendMessage({
        type: 'open_side_panel',
      } satisfies RuntimeRequest)) as RuntimeResponse;
      if (res?.type === 'open_side_panel_error') {
        console.warn('[tecora] could not open side panel', res.error);
      }
    } catch (err) {
      console.warn('[tecora] could not open side panel', err);
    }
  }

  return (
    <div className="dock" title="tecora">
      <div className="actions" aria-hidden="false">
        <button
          type="button"
          className="action"
          title="search chats (ctrl/cmd+k)"
          onClick={onOpenPalette}
        >
          <IconSearch size={16} />
        </button>
        <button
          type="button"
          className="action"
          title="open tecora side panel"
          onClick={() => void openSidePanel()}
        >
          <IconFile size={16} />
        </button>
      </div>
      <button
        type="button"
        className="chip"
        title="tecora — hover for actions"
        onClick={onOpenPalette}
      >
        <span className="mark" aria-hidden>
          <IconTau size={22} />
        </span>
      </button>
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
    align-items: center;
    justify-content: flex-end;
    gap: 0;
  }
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
  .dock:hover .actions,
  .dock:focus-within .actions {
    max-width: 120px;
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
    cursor: pointer;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.4);
  }
  .chip:hover { background: #000000; }
  .mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 0;
  }
`;
