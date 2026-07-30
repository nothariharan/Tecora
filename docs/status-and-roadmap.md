# Tecora — status and roadmap

Snapshot of what ships today, what still needs work, and platform data we can extract next. Written after the Claude / ChatGPT extractables research (2026-07-20).

---

## Product in one line

Local-first MV3 extension that organizes AI chats on Claude, ChatGPT, and Gemini. Not an AI wrapper. No backend. Nothing leaves the device.

---

## Done so far (v0.1)

### Core platform

- [x] WXT + TypeScript + Manifest V3 scaffold
- [x] Adapters for Claude, ChatGPT, Gemini → shared `Chat` / `Message` types
- [x] Dexie IndexedDB via service worker (chats, messages, folders, tags, activity)
- [x] MiniSearch over titles + captured message text
- [x] Side panel UI (browse, folders, tags, select/export, archive, bulk delete)
- [x] Shadow DOM `ctrl/cmd+k` command palette on supported pages
- [x] Remote selector config for delete-UI resilience

### Extraction (what we pull from the sites)

| Platform | Chat list | Messages | Rich assets | How |
| --- | --- | --- | --- | --- |
| Claude | Yes | Yes | Artifacts, sandbox/wiggle files, uploads (export-time) | Fetch/XHR intercept + authed API + DOM fallback |
| ChatGPT | Yes (non-project) | Yes | Images, files, long code fences (export-time) | Fetch/XHR intercept + authed API + DOM fallback |
| Gemini | Yes | Only when chat is open | DOM images on export if open | DOM scrape only |

### Organization & memory (Tecora-local)

- [x] Folders and tags
- [x] Pins
- [x] Derived titles / one-line previews from captured messages
- [x] “Continue where you left off”
- [x] Cross-platform search when “All platforms” is selected

### Privacy, export, cleanup

- [x] Per-platform message-content capture toggles
- [x] Recent local activity log
- [x] Wipe-all-data
- [x] Portable JSON archive export/import (chats, messages, folders, tags)
- [x] ZIP/markdown export with asset harvest + `MISSING.md`
- [x] Safety-gated bulk delete queue (platform tab must stay open)

### Usage awareness (local only today)

- [x] Rolling 5h captured-message counts
- [x] Long-chat token estimates (`chars/4`)
- [x] Explicit UI disclaimer: not platform quota

### Developer features + on-device digest (Sprint 2)

- [x] Shared code-fence extraction (`src/core/code-fences.ts`) — all fences from Claude/ChatGPT/Gemini text, with `language` on `ChatAsset`
- [x] Language-aware search — `codeLangs` on chats + index; "Code only" + language filters in the palette and side panel
- [x] Jump-to-code outline in the palette (in-chat scope) with DOM `scrollIntoView`
- [x] ZIP export emits code blocks as real files under `assets/` with filename hints (works offline from captured text)
- [x] Usage honesty — live quota and local activity never blended; explicit undercount + `chars/4` disclaimers
- [x] On-device digest — Chrome Summarizer (Gemini Nano) with map-reduce for long chats, extractive fallback, cached per chat, on the Resume cards
- [x] Copy-with-context (provenance header) + dev prompt snippet starter pack (`> snippet` in palette)
- [x] Local secret/credential warn-before-send (dismissible, never blocks)
- [x] Cross-chat code-block gallery (Code-only mode in the side panel)

### Explicitly not done yet (called out in README)

- [ ] Platform-native archive / rename
- [ ] Chrome Web Store listing polish
- [ ] Deeper personalization packs
- [ ] Deferred dev catalog P2/P3: code-iteration diffs, export-as-project-scaffold, per-project usage, cross-model side-by-side

---

## Needs improvement (existing features)

### Extraction gaps

- ~~ChatGPT **project** conversations are invisible to `/backend-api/conversations`~~ — now pulled via `gizmos/snorlax/sidebar` + per-gizmo `/conversations` (Sprint 1)
- ChatGPT **Canvas** not harvested (only images/files/code fences)
- Claude artifacts are harvest-on-export from `tool_use`, not a cross-chat artifact gallery index
- Gemini has no network intercept; message capture only works when that chat is open
- Adapter stubs: `archive()` unimplemented; `capabilities.rename` always false; Claude adapter `getMessages` comment about endpoint wiring

### Usage UI

- ~~Panel is local estimates only~~ — now calls Claude `/usage` + ChatGPT `/wham/usage` on the active tab, shows real % + reset + plan badge, falls back to local estimates when the fetch fails (Sprint 1)
- Live in-chat "this chat is getting long" nudge on the dock; per-chat long-chat warnings in the library

### Reliability / polish

- Intercept URL matchers only cover chat list + detail — other useful payloads are ignored
- Soft-delete / rename via platform APIs not wired (ChatGPT PATCH title / `is_visible`)
- ~~Account scoping: ChatGPT account bucket hard-coded `"default"`~~ — now keyed to the session user id, with a one-time migration of legacy `chatgpt:default:*` rows (Sprint 1)
- Store listing / onboarding / marketing polish still open

---

## Research: what the websites expose that we don’t use yet

Same extension capabilities we already have (main-world intercept + content-script authed `fetch` while the user is logged in). No separate “search for limits” product action required — if the tab is open, a quiet GET is enough.

Undocumented private web APIs. Expect breakage; treat as best-effort adapters with fallback to local estimates.

### Highest value: real usage limits

#### Claude — `claude.ai`

| Endpoint | Useful fields |
| --- | --- |
| `GET /api/organizations/{org}/usage` | Per-window utilization (`five_hour`, `seven_day`, model-specific weekly buckets) as 0–1 fractions + `resets_at` |
| `GET /api/organizations/{org}/overage_spend_limit` | Extra-usage / overage cap |
| `GET /api/organizations/{org}/subscription_details` | Plan / billing hints |

Auth: existing session cookies (same as chat list). May need `Referer: https://claude.ai/settings/usage`. Shape is **% used + reset**, not “messages remaining.”

Stream events can also carry `message_limit` with 5h/7d windows while chatting.

#### ChatGPT — `chatgpt.com`

| Endpoint | Useful fields |
| --- | --- |
| `GET /backend-api/wham/usage` | `plan_type`, primary (~5h) / secondary (~7d) `used_percent`, `reset_after_seconds`, `limit_reached`, credits |
| `GET /backend-api/accounts/check/v4-…` | Plan, entitlement, feature flags |

Auth: Bearer from `/api/auth/session` (already used). Read-only; does not burn quota.

**Suggested first experiment:** on tab open, one authed usage fetch → show real % + reset in `UsageAwarenessPanel`.

### Other extractables (priority order)

| Priority | Surface | Claude | ChatGPT | Why |
| --- | --- | --- | --- | --- |
| 1 | Usage / plan | `/usage`, subscription | `/wham/usage`, accounts/check | Upgrades usage panel |
| 2 | Projects | `/api/organizations/{org}/projects` (+ chats/docs/files under project) | `/gizmos/snorlax/sidebar` + `/gizmos/{id}/conversations` | Completes chat library; ChatGPT projects are currently missing |
| 3 | Memory / instructions | org memory + memory-settings | `/backend-api/memories`, `/user_system_messages` | Cross-chat personalization |
| 4 | Rich docs beyond today | Artifact versions / published gallery | Canvas (`canvas_asset_pointer` + file download) | Richer export/browse |
| 5 | Account extras | Skills, MCP bootstrap, subscription | Shared chats, models, beta flags | Plan badge / connected tools |
| 6 | Platform mutations | (various) | PATCH rename / soft-delete | Native archive/rename |

### How we’d extract (same as today)

```text
1. Intercept — widen injected.content.ts URL matchers (usage, projects, memory, gizmos)
2. Active fetch — same pattern as fetchClaudeChatList / resolveChatGPTAccessToken
3. DOM scrape — last resort only (Gemini-style)
```

Not used today for platform data (and not required for the above): reading site IndexedDB/localStorage; `webRequest` interception.

---

## Suggested next workstreams

1. ~~**Real usage** — Claude `/usage` + ChatGPT `/wham/usage` into the usage panel; keep local estimates as fallback~~ (done, Sprint 1)
2. ~~**ChatGPT projects** — snorlax sidebar + per-gizmo conversation lists so project chats appear in Tecora~~ (done, Sprint 1)
3. ~~**Claude projects** — list projects + project-scoped conversations / docs~~ (done, Sprint 1 — conversations; docs/files still pending)
4. **Canvas + artifact gallery** — extend asset harvest beyond current tool_use / image_asset_pointer paths
5. **Memory / custom instructions** — optional local mirror for search/export (privacy-gated)
6. **Platform rename / soft-delete** — close the README “not done yet” gaps
7. **Store polish** — listing, screenshots, onboarding

Also shipped in Sprint 1: in-chat (Ctrl+F-style) search over captured messages in the palette, a plan badge in the usage panel, and a proactive long-chat nudge.

Sprint 2 shipped the developer catalog (P0/P1) + on-device digest + usage honesty (see "Developer features" above). Still deferred: auto-continue helper, memory mirror, Canvas harvesting, outage-awareness banner, native rename/soft-delete, and the dev catalog P2/P3 (iteration diffs, project scaffold, per-project usage, cross-model side-by-side).

---

## Architecture reminder

```text
page (main world)     patches fetch/xhr — chat list + detail today
       -> postMessage
content script        adapters, palette, active platform fetch
       -> runtime msg
service worker        Dexie, search, folders/tags, bulk queue
       -> IndexedDB
```

Supported hosts: `claude.ai`, `chatgpt.com`, `gemini.google.com`.

Key paths:

- `entrypoints/injected.content.ts` — L0 intercept
- `entrypoints/content.tsx` — L1 adapters + active fetch + asset resolve
- `entrypoints/background.ts` — L2 Dexie / search / bulk
- `src/core/assets.ts` — harvest-on-export (code fences via `src/core/code-fences.ts`)
- `src/core/usage.ts` + `UsageAwarenessPanel` — live quota + local estimate, kept separate
- `src/core/digest.ts` — on-device Summarizer + extractive fallback
- `src/core/secrets.ts` — local secret warn-before-send; `src/core/snippets.ts` — prompt snippets + copy-with-context

---

## References (community / reverse-engineered)

Private endpoints; verify against live Network tab before shipping.

- Claude consumer usage: `GET https://claude.ai/api/organizations/{org}/usage` (used by settings/usage UI; community tools like claude-web-usage / ClaudeMeter)
- ChatGPT quota: `GET https://chatgpt.com/backend-api/wham/usage`
- ChatGPT projects: `/backend-api/gizmos/snorlax/sidebar`, `/backend-api/gizmos/{id}/conversations`
- ChatGPT surface notes: [everything-chatgpt](https://github.com/terminalcommandnewsletter/everything-chatgpt)
- Claude web client patterns: community AnthropicWebClient gists / lm-assist route maps
