<div align="center">

<img src="docs/250px-Greek_lc_tau.svg.webp" alt="Tecora — tau mark" width="96" />

# Tecora · τ

**Your AI chats. One local library.**

Folders, search, cleanup, and export for Claude, ChatGPT, and Gemini —
without another account, another cloud, or anything leaving your device.

[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-111111?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Built with WXT](https://img.shields.io/badge/built%20with-WXT-111111?style=flat-square)](https://wxt.dev)
[![React](https://img.shields.io/badge/React-19-111111?style=flat-square)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-111111?style=flat-square)](https://www.typescriptlang.org/)
[![Local-first](https://img.shields.io/badge/data-100%25%20on--device-111111?style=flat-square)](#-privacy)
[![License: MIT](https://img.shields.io/badge/license-MIT-111111?style=flat-square)](LICENSE)

</div>

---

## τ · What is Tecora?

Tecora sits on top of the AI chat apps you already use and turns scattered
histories into **one private library** you can search, tag, resume, export, and
clean up.

It is **not** a chat client and **not** an AI wrapper — it never calls a model.
It captures chat metadata (and, only if you allow it, message content) from
`claude.ai`, `chatgpt.com`, and `gemini.google.com`, stores everything in
on-device IndexedDB, and gives you the organization tools those sites don't
share with each other.

| Tecora is… | Tecora is **not**… |
| --- | --- |
| A cross-platform memory + organization layer for AI chats | An AI chat app |
| A local archive with markdown / JSON / ZIP export | An AI wrapper or "second Copilot" |
| A privacy-first tool — no account, no backend, no sync server | Cloud sync for your chats |
| A side panel + command palette + floating τ dock | A tool that works on every site (three hosts only) |

---

## τ · Supported platforms

| Platform | Chat list | Messages | Rich assets on export |
| --- | --- | --- | --- |
| **Claude** (`claude.ai`) | ✅ | ✅ | Artifacts, sandbox files, uploads |
| **ChatGPT** (`chatgpt.com`) | ✅ (incl. projects) | ✅ | Images, files, long code fences |
| **Gemini** (`gemini.google.com`) | ✅ (DOM scrape) | While the chat is open | DOM images when open |

---

## τ · Features

**Capture across platforms** — reads your chats while you browse; normalizes
Claude / ChatGPT / Gemini into one shared model. No CSV upload to get started.

**Organize & resume** — folders, `#tags`, pins, derived titles for "New chat",
one-line previews, and a *Continue where you left off* list across every model.

**Search everywhere** — a Shadow-DOM command palette (`Ctrl/Cmd + K`) plus
full-text MiniSearch over titles and captured messages, scoped to one account or
all platforms at once.

**Today panel** — a centered overlay for the day: manual + auto-detected tasks
pulled from your chats (on-device), a persistent notes scratchpad, and a cached
"Yesterday" recap.

**Export & backup** — single/bulk **Markdown**, a portable **JSON archive**
(chats, messages, folders, tags, tasks, notes), and **ZIP** export with harvested
assets and a `MISSING.md` manifest.

**Developer tools** — cross-chat code-block gallery, jump-to-code outline,
copy-with-provenance, a prompt-snippet starter pack (`>` in the palette), and a
local warn-before-send secret scanner.

**On-device digest** — chat summaries via Chrome's built-in Summarizer
(Gemini Nano) with a dependency-free extractive fallback. Nothing is uploaded.

**Privacy & control** — per-platform message-capture toggles, a local activity
log, and one-click *wipe all data*.

**Draggable τ dock** — the floating mark stays out of the way; drag it anywhere,
click to expand Search / Today / Library. Its position is remembered.

> **Honesty note:** usage numbers shown in-product are *local estimates*
> (`~chars/4` tokens), never a claim of your exact platform quota.

---

## τ · Install (load unpacked)

Tecora isn't on the Chrome Web Store yet, so you build it from source and load
the unpacked extension. Takes ~2 minutes.

### Prerequisites

- **Node.js 20+** and npm
- A Chromium browser (Chrome, Edge, Brave, Arc…)
- lil bit patience ig 

### 1. Clone and build

```bash
git clone https://github.com/nothariharan/Tecora.git
cd Tecora
npm install
npm run build
```

This produces the unpacked extension in `.output/chrome-mv3`.

### 2. Load it into Chrome

1. Open `chrome://extensions`
2. Toggle **Developer mode** on (top-right)
3. Click **Load unpacked**
4. Select the `.output/chrome-mv3` folder

You'll see the **τ** icon appear in your toolbar.

> **Firefox:** run `npm run build:firefox` and load `.output/firefox-mv2`
> via `about:debugging` → *This Firefox* → *Load Temporary Add-on*.

---

## τ · Try it out

1. **Open a chat site logged in** — visit [Claude](https://claude.ai),
   [ChatGPT](https://chatgpt.com), or [Gemini](https://gemini.google.com). Tecora
   quietly captures your chat list; a floating **τ** dock appears bottom-right.
2. **Open the library** — click the τ dock (or the toolbar icon) → **Library**
   to browse everything Tecora has captured. Try folders, tags, and pins.
3. **Search** — press **`Ctrl/Cmd + K`** on any supported page. Search across one
   account or *All platforms*, or type `>` for snippets and commands.
4. **Today panel** — click the τ dock → **Today**. Add a task, jot a note, and
   watch auto-detected next-steps show up from your recent chats.
5. **Export** — in the side panel, select a few chats → export as Markdown, a
   portable JSON archive, or a ZIP with assets.
6. **Privacy** — open Settings in the side panel to flip per-platform capture
   toggles, review the activity log, or **wipe all data**.
7. **Drag the dock** — grab the τ circle and move it anywhere; the spot sticks.

### Developer scripts

```bash
npm run dev        # hot-reloading dev build (Chrome)
npm run compile    # type-check (tsc --noEmit)
npm test           # vitest unit suite
npm run build      # production build → .output/chrome-mv3
npm run zip        # packaged .zip for distribution
```

> **Tip:** after reloading the extension at `chrome://extensions`, hard-refresh
> any open Claude/ChatGPT/Gemini tabs so the new content script takes over.

---

## τ · How it works

Three isolated layers keep host-page access minimal and auditable:

```text
page (main world)     patches fetch/xhr — captures chat list + detail
      → postMessage
content script (L1)   adapters, τ dock, Ctrl+K palette, Today panel, authed fetch
      → runtime message
service worker (L2)   Dexie (IndexedDB), MiniSearch, folders/tags, bulk queue
      → IndexedDB
```

Key paths:

| Path | Role |
| --- | --- |
| `entrypoints/injected.content.ts` | L0 — main-world fetch/XHR intercept |
| `entrypoints/content.tsx` | L1 — adapters, UI surfaces, active fetch, task extract |
| `entrypoints/background.ts` | L2 — Dexie, search index, bulk delete, CRUD |
| `src/adapters/*` | Per-platform normalization (Claude/ChatGPT/Gemini) |
| `src/core/*` | Types, search, export, digest, secrets, task-extract |
| `src/ui/*` | Side panel, palette, τ dock, Today panel, components |

---

## τ · Privacy

- **On-device only.** All data lives in your browser's IndexedDB (via Dexie).
- **No Tecora account. No Tecora backend. No sync server.**
- **You control capture.** Message-content capture is per-platform and toggleable;
  turn it off and Tecora keeps only titles/metadata.
- **The Summarizer runs locally** (Chrome's built-in Gemini Nano). No prompts or
  chats are sent anywhere by Tecora.
- **Wipe anytime.** One button clears every local table.

---

## τ · Tech stack

**WXT** · **React 19** · **TypeScript (strict)** · **Dexie / IndexedDB** ·
**MiniSearch** · **fflate** (ZIP) · **Vitest** · Chrome **Manifest V3**.

Host permissions are limited to the three supported chat sites; the only
extension permissions are `storage`, `sidePanel`, and `tabs`.

---

## τ · Roadmap

See [`docs/status-and-roadmap.md`](docs/status-and-roadmap.md) for the full
picture. Not done yet (and honestly labeled as such): platform-native
archive/rename, ChatGPT Canvas harvest, real platform usage %, and Web Store
listing polish.

---

## τ · License

Released under the [MIT License](LICENSE).

<div align="center">

**τ** · Built for people who live across Claude, ChatGPT, and Gemini.
Nothing leaves the device.

</div>
