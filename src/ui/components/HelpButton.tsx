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
          borderRadius: T.radius,
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
            style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.55)' }}
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
              border: `1px solid ${T.borderStrong}`,
              borderRadius: T.radius,
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
      'Open Claude, ChatGPT, or Gemini logged in. Tecora reads the chat list from the page — no import. If the panel looks empty, refresh and wait a few seconds.',
  },
  {
    title: 'Folders & tags',
    body:
      'Create a folder or tag, then use a chat’s ⋯ menu to assign it. Click a folder/tag to filter. Select mode (top-right) lets you export or delete many chats at once.',
  },
  {
    title: 'Exporting',
    body:
      '⋯ → markdown, portable archive, or ZIP (with files). ZIP pulls Claude artifacts, ChatGPT images/files, and Gemini images from the open tab when possible. Open chats with those assets first — missing ones land in MISSING.md.',
  },
  {
    title: 'Search',
    body:
      'Side panel search filters titles. Ctrl/Cmd+K opens the palette and searches titles plus any captured message text.',
  },
] as const;
