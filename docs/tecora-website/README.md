# Tecora website — documentation pack

This folder is the brief for the Tecora hackathon landing page.

It is **docs only** — not the site build. Use these files when designing, writing copy, or implementing the page later.

---

## What this pack is for

Tecora is a browser extension. The landing page exists to:

1. Explain what Tecora does in under a minute
2. Show the product with clean, Prime UI–style section storytelling + illustrations
3. Give a clear **Download** / install CTA for the extension
4. Support a hackathon submission story (privacy, local-first, cross-platform)

---

## Read order

| # | Doc | Purpose |
| --- | --- | --- |
| 1 | [product-overview.md](./product-overview.md) | What Tecora is / is not |
| 2 | [problem-and-audience.md](./problem-and-audience.md) | Pain, who it’s for |
| 3 | [features.md](./features.md) | Full feature inventory |
| 4 | [how-it-works.md](./how-it-works.md) | User flows + architecture |
| 5 | [use-cases.md](./use-cases.md) | Concrete scenarios |
| 6 | [brand-and-voice.md](./brand-and-voice.md) | Mark, tone, naming |
| 7 | [design-direction.md](./design-direction.md) | Executive design doc |
| 8 | [design-system.md](./design-system.md) | Colors, type, UI tokens |
| 9 | [prime-ui-reference.md](./prime-ui-reference.md) | What we borrow from [primeui.com](https://primeui.com/) |
| 10 | [landing-page-structure.md](./landing-page-structure.md) | Section-by-section page map |
| 11 | [illustrations.md](./illustrations.md) | Illustration / visual concepts |
| 12 | [motion-and-animation.md](./motion-and-animation.md) | Motion language |
| 13 | [copy-and-messaging.md](./copy-and-messaging.md) | Headlines, CTAs, FAQ |
| 14 | [download-and-cta.md](./download-and-cta.md) | Install button behavior |
| 15 | [roadmap-and-future.md](./roadmap-and-future.md) | What’s next |
| 16 | [hackathon-brief.md](./hackathon-brief.md) | Pitch + judging angles |

---

## Non-negotiables for the site

- **Product truth:** local-first, no backend, not an AI wrapper
- **Visual identity:** Tecora’s black / white / gray + τ mark (not Prime UI’s blue brand)
- **Structure inspiration:** Prime UI’s numbered story sections, product demos, FAQ, final CTA
- **Primary CTA:** Download / Install the extension
- **Supported platforms today:** Claude, ChatGPT, Gemini

---

## Source of truth in the repo

| Topic | Source |
| --- | --- |
| Product description | `README.md` |
| Status + roadmap | `docs/status-and-roadmap.md` |
| Theme tokens | `src/ui/theme.ts` |
| In-app help copy | `src/ui/components/HelpButton.tsx` |
| Brand mark | `docs/Greek_lc_tau.svg`, `assets/icon.svg` |
