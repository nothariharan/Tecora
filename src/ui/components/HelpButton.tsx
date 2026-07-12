import React, { useState } from 'react';
import { T } from '../theme';

// a "?" affordance that reveals a structured how-it-works card on hover.
export function HelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          borderRadius: '50%',
          border: `1px solid ${T.borderStrong}`,
          color: T.muted,
          fontSize: 11,
          fontWeight: 700,
          cursor: 'help',
          lineHeight: 1,
        }}
      >
        ?
      </span>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '130%',
            right: 0,
            width: 268,
            background: T.bg,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: '12px 14px',
            zIndex: 50,
            fontSize: 12,
            lineHeight: 1.5,
            color: T.fg,
            fontWeight: 400,
            textAlign: 'left',
            cursor: 'default',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>How Tecora works</div>

          {SECTIONS.map((s) => (
            <div key={s.title} style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{s.title}</div>
              <div style={{ color: T.muted }}>{s.body}</div>
            </div>
          ))}

          <div style={{ color: T.faint, fontSize: 11, marginTop: 2 }}>
            Everything stays on your device — no account, no backend.
          </div>
        </div>
      )}
    </span>
  );
}

const SECTIONS = [
  {
    title: '1 · Capturing chats',
    body:
      'Keep claude.ai open and logged in. Tecora reads your chat list straight from the page — no import needed. If it looks empty, open Claude and give it a few seconds.',
  },
  {
    title: '2 · Filing into folders',
    body:
      'Make a folder with “+ New folder”. Then on any chat, click the ⋯ button and pick a folder under “Move to folder”. Click a folder in the list to filter to just its chats.',
  },
  {
    title: '3 · Exporting',
    body:
      'A chat’s ⋯ menu → “Export as markdown” saves that conversation with full messages. Hover a folder → “Export” bundles every chat in it. “Export all” (top-right) dumps everything into one file.',
  },
  {
    title: '4 · Search',
    body:
      'Use the search box for titles, or press Ctrl/Cmd + K on claude.ai for the quick command palette.',
  },
] as const;
