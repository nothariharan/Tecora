# How it works

Two layers of explanation: **user story** (for the landing page) and **technical architecture** (for hackathon judges / deep FAQ).

---

## User story (keep this short on the site)

### 1. Install

Install Tecora (Chrome MV3 extension). No Tecora signup.

### 2. Open a chat app

Go to Claude, ChatGPT, or Gemini while logged in.

### 3. Tecora starts capturing

The extension reads the chat list from the page (and messages when available / allowed). No CSV import to get started.

### 4. Organize in the side panel

Open the toolbar icon → side panel. Create folders and tags, pin chats, resume recent work, switch to **All platforms**.

### 5. Search instantly

Use the panel search, or press `Ctrl/Cmd+K` on a supported page for the full-text palette.

### 6. Export or clean up

Export markdown, a portable JSON archive, or a ZIP with files. Or select many chats and run a safety-gated bulk delete.

### 7. Stay in control

Toggle message-content capture per platform. Wipe all Tecora data anytime.

---

## In-app help copy (canonical)

From the product help card — reuse or lightly adapt:

1. **Capturing chats** — Open Claude, ChatGPT, or Gemini logged in. Tecora reads the chat list from the page — no import. If the panel looks empty, refresh and wait a few seconds.
2. **Folders & tags** — Create a folder or tag, then use a chat’s ⋯ menu to assign it. Click a folder/tag to filter. Select mode lets you export or delete many chats at once.
3. **Exporting** — Markdown, portable archive, or ZIP (with files). ZIP pulls Claude artifacts, ChatGPT images/files, and Gemini images from the open tab when possible. Missing assets land in `MISSING.md`.
4. **Search** — Side panel search filters titles. Ctrl/Cmd+K opens the palette and searches titles plus any captured message text.

Footer line: *Everything stays on your device — no account, no backend.*

---

## Technical architecture (judge-facing)

```text
page (main world)     patches fetch/xhr — catches chat list + detail JSON
       -> postMessage
content script        adapters normalize data, hosts palette + τ dock
       -> runtime messages
service worker        Dexie writes, folders/tags, MiniSearch, bulk queue
       -> IndexedDB (on device)
side panel            React UI over local data
```

### Layers

| Layer | File(s) | Job |
| --- | --- | --- |
| L0 intercept | `entrypoints/injected.content.ts` | Main-world fetch/XHR patch (Claude, ChatGPT) |
| L1 content | `entrypoints/content.tsx` | Adapters, active authed fetch, Shadow DOM UI |
| L2 background | `entrypoints/background.ts` | Dexie, search index, bulk queue, privacy |
| UI | `src/ui/*`, `entrypoints/sidepanel/` | Side panel + palette |

### Stack

- WXT (MV3)
- React 19
- TypeScript
- Dexie (IndexedDB)
- MiniSearch
- fflate (ZIP)
- Vitest for unit tests

### Hosts & permissions

Supported hosts only:

- `claude.ai`
- `chatgpt.com`
- `gemini.google.com`

Permissions: `storage`, `sidePanel`, `tabs`, plus host permissions for those sites.

### Privacy model (explain simply)

- Tecora does **not** operate a server for your chats
- Data lives in the browser profile’s IndexedDB
- Message text capture can be disabled per platform
- Wipe clears local Tecora state

### Reliability notes (optional FAQ depth)

- MV3 service workers can sleep; durable state is in storage, not RAM
- Delete UI uses remote selector config for resilience
- Gemini has no network intercept today — DOM scrape path

---

## Demo script (2–3 minutes)

1. Open Claude with chats → show side panel filling  
2. Create a folder + tag; pin a chat  
3. Switch to ChatGPT → show **All platforms** resume  
4. `Ctrl/Cmd+K` → search a phrase from a past chat  
5. Export one chat as markdown; mention archive/ZIP  
6. Open Privacy → show capture toggle + “no backend” line  
7. End on Download CTA for judges to try  

## Related docs

- [features.md](./features.md)
- [download-and-cta.md](./download-and-cta.md)
- [hackathon-brief.md](./hackathon-brief.md)
