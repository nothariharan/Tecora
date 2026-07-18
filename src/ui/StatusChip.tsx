import React from 'react';

// always-on chip so you can see tecora is injected even before chats land
export function StatusChip({
  chatCount,
  onOpenPalette,
}: {
  chatCount: number;
  onOpenPalette: () => void;
}) {
  return (
    <button
      type="button"
      className="chip"
      title="tecora is running — click or press ctrl/cmd+k"
      onClick={onOpenPalette}
    >
      <span className="dot" />
      tecora
      <span className="count">{chatCount > 0 ? chatCount : '…'}</span>
    </button>
  );
}

export const CHIP_STYLES = `
  .chip {
    pointer-events: auto;
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 2147483647;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1px solid #404040;
    background: #111111;
    color: #ffffff;
    border-radius: 4px;
    padding: 8px 12px;
    font: 500 12px/1 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    letter-spacing: 0.02em;
    cursor: pointer;
  }
  .chip:hover { background: #000000; }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ffffff;
  }
  .count {
    min-width: 1.4em;
    text-align: center;
    color: #a3a3a3;
    font-weight: 500;
  }
`;
