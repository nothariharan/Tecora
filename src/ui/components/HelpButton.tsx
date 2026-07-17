import React, { useState } from 'react';
import { T } from '../theme';
import { IconHelp, IconClose } from './Icons';

// a "?" affordance that reveals a structured how-it-works card. click to toggle
// (hover was too fiddly in a narrow panel), with a full-panel backdrop so it
// closes on any outside click and never spills past the panel edges.
export function HelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="How Tecora works"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          padding: 0,
          borderRadius: 6,
          border: 'none',
          background: open ? T.selectedBg : 'transparent',
          color: open ? T.fg : T.icon,
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = T.hover; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = 'transparent'; }}
      >
        <IconHelp size={15} />
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.4)' }}
          />
          <div
            style={{
              position: 'fixed',
              top: 46,
              left: 10,
              right: 10,
              maxHeight: 'calc(100vh - 60px)',
              overflowY: 'auto',
              background: T.bg,
              border: `1px solid ${T.border}`,
              borderRadius: T.radius,
              boxShadow: '0 12px 32px rgba(0,0,0,0.14)',
              padding: '14px 16px',
              zIndex: 41,
              fontSize: 12,
              lineHeight: 1.55,
              color: T.fg,
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>How Tecora works</span>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 22, height: 22, border: 'none', background: 'transparent',
                  color: T.icon, cursor: 'pointer', borderRadius: 6,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = T.hover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <IconClose size={15} />
              </button>
            </div>

            {SECTIONS.map((s) => (
              <div key={s.title} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>{s.title}</div>
                <div style={{ color: T.muted }}>{s.body}</div>
              </div>
            ))}

            <div style={{ color: T.faint, fontSize: 11, marginTop: 2 }}>
              Everything stays on your device — no account, no backend.
            </div>
          </div>
        </>
      )}
    </>
  );
}

const SECTIONS = [
  {
    title: 'Capturing chats',
    body:
      'Keep claude.ai open and logged in. Tecora reads your chat list straight from the page — no import needed. If it looks empty, open Claude and give it a few seconds.',
  },
  {
    title: 'Filing into folders',
    body:
      'Make a folder with “New folder”. Then on any chat, open its ⋯ menu and pick a folder under “Move to folder”. Click a folder in the list to filter to just its chats.',
  },
  {
    title: 'Exporting',
    body:
      'A chat’s ⋯ menu → “Export as markdown” saves that conversation with full messages. Hover a folder → export icon bundles every chat in it. “Export all” (top-right) dumps everything into one file.',
  },
  {
    title: 'Search',
    body:
      'Use the search box for titles, or press Ctrl/Cmd + K on claude.ai for the quick command palette.',
  },
] as const;
