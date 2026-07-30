# Roadmap and future

What to say about the future on the landing page — and what to keep only in docs/judges Q&A.

Source snapshot: `docs/status-and-roadmap.md` (2026-07-20 research pass) + README “Not done yet”.

---

## Product north star

Stay the **local OS for AI chat history** across the tools people already use.

Expand coverage and honesty of platform data — without becoming a cloud sync product or an AI wrapper.

---

## Done now (v0.1) — safe to market

- Multi-platform capture (Claude, ChatGPT, Gemini with known limits)  
- Folders, tags, pins, resume  
- Side panel + `Ctrl/Cmd+K` palette + τ dock  
- MiniSearch full-text (when messages captured)  
- Markdown / JSON archive / ZIP export  
- Privacy toggles + wipe  
- Local usage awareness (estimates)  
- Safety-gated bulk delete  

---

## Near-term workstreams (good “Coming next” material)

Use a quiet **Coming next** strip or FAQ — don’t put unfinished items in the hero.

| Priority | Item | Why it matters |
| --- | --- | --- |
| 1 | Real usage from Claude `/usage` + ChatGPT `/wham/usage` | Turns estimates into real % + reset when possible |
| 2 | ChatGPT Projects visibility | Completes a major missing library slice |
| 3 | Claude projects | Same for Claude’s project world |
| 4 | Canvas + richer artifact gallery | Better export/browse for rich docs |
| 5 | Memory / custom instructions mirror | Optional, privacy-gated |
| 6 | Platform rename / soft-delete | Close native archive/rename gaps |
| 7 | Store polish + onboarding | Marketing + first-run UX |

---

## Explicit gaps (be ready if judges ask)

- ChatGPT **project** conversations not in the main list API Tecora uses today  
- ChatGPT **Canvas** not harvested  
- Gemini messages only when the chat is open; no network intercept  
- Platform-native archive/rename not done  
- Account scoping still simplistic in places  
- Chrome Web Store listing polish still open  

---

## Future themes (longer horizon)

Frame as direction, not promises:

1. **Deeper personalization packs** — local organization intelligence without server-side AI  
2. **Broader export fidelity** — more asset types, cleaner archives  
3. **More platforms** — only if architecture stays local-first  
4. **Onboarding / education** — teach capture + privacy in-product  
5. **Optional community distribution** — Store, Firefox package polish  

---

## What not to promise on the marketing site

- Cloud team sync  
- “Exact messages remaining” as a shipping feature today  
- Universal support for every ChatGPT surface  
- Tecora-hosted AI summaries  
- Guaranteed unbroken private API adapters forever (sites change)

---

## How to present “Future” on the page

**Recommended pattern:**

```text
Coming next
· Real platform usage meters (where APIs allow)
· ChatGPT & Claude projects in your library
· Richer artifact / Canvas export
```

One short paragraph max. Link judges to this doc or `docs/status-and-roadmap.md` for depth.

---

## Strategic constraint (identity)

Every future feature should still pass:

1. Does it require a Tecora backend? If yes, rethink.  
2. Does it wrap a model? If yes, it’s a different product.  
3. Does it help multi-model memory / organization / export / privacy? If no, deprioritize.  

## Related docs

- [hackathon-brief.md](./hackathon-brief.md)
- [features.md](./features.md)
- Repo: `docs/status-and-roadmap.md`
