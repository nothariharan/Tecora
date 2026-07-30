# Prime UI reference

Study target: [https://primeui.com/](https://primeui.com/)  
Observed: 2026-07-21

This doc captures **what to borrow** (structure, craft, motion quality) and **what not to copy** (brand colors, product metaphor).

---

## What Prime UI is doing well

Prime UI sells a site builder with a landing page that feels like a product film:

1. Dark void background  
2. Centered hero with a single glassy illustration  
3. Split headline (bright + muted)  
4. One primary CTA  
5. Numbered narrative sections (`01`, `02`, `03`)  
6. Interactive / illustrated demos per section  
7. Feature carousel with short punchy claims  
8. FAQ accordion  
9. Closing loop / “ship it” energy + sparse footer  

That **section storytelling** is what Tecora’s landing page should emulate.

---

## Observed visual system (Prime UI)

| Element | Observation |
| --- | --- |
| Background | Pure black `rgb(0,0,0)` |
| Type | Inter, display ~60px / weight 600 / letter-spacing ~`-1.5px` |
| Headline pattern | “Build sites fast.” + muted “Fear no code.” |
| CTA | Pill button, blue `rgb(37, 99, 235)` |
| Hero art | Frosted glass icon + soft magenta/cyan glow |
| Rhythm | Large vertical space; one idea per section |
| Interaction | Tabs, carousels, hover “Change” affordances on sitemap cards |
| Close | Video / marquee energy before footer |

Meta description pattern (problem → outcome → time):

> Prime UI is the missing foundation for AI-generated websites. Go from sitemaps and wireframes to production-ready Next.js and Tailwind CSS code in minutes.

---

## Page skeleton (Prime UI)

```text
Nav (logo · Live Demo · Get Started)
Hero (illustration · split H1 · CTA · short paragraph under a rule)
Product video / visual break
01 — Start with a sitemap (+ interactive illustration)
02 — Experiment quickly (+ mode toggles + explanation)
03 — Export to code (+ CTA)
Complete site / tabbed product areas
Features carousel
Pricing
FAQ
Closing visual + footer
```

---

## What Tecora should borrow

| Borrow | Why |
| --- | --- |
| Dark full-bleed atmosphere | Matches Tecora’s mono product UI |
| Split headlines | Clear hierarchy without clutter |
| Numbered story sections | Explains a multi-step product cleanly |
| One primary CTA repeated | Download/Install instead of Get Started |
| Large illustration per section | Makes an extension feel tangible |
| Feature carousel / horizontal highlights | Show many capabilities without a wall of cards |
| FAQ accordion | Handle privacy + “is this an AI?” questions |
| Sparse nav + sparse footer | Premium calm |

---

## What Tecora should not copy

| Don’t copy | Why |
| --- | --- |
| Blue pill brand CTAs | Wrong brand; Tecora is mono |
| Inter-as-identity | Fine as fallback, not as “our look” |
| Neon purple/cyan hero glow as the brand | Fights τ / black-white identity |
| Pricing tables | Extension landing for hackathon doesn’t need Personal/Business $ tiers |
| “AI-generated websites” metaphor | Different product |
| Dense component marketing (200+ UI kit claims) | Not our story |
| Marquee spam unless it fits | Only if it feels on-brand; optional |

---

## Translation map: Prime UI → Tecora

| Prime UI section | Tecora equivalent |
| --- | --- |
| Build sites fast / Fear no code | Your AI chats / One local library (or similar) |
| Get Started | Download / Install extension |
| Live Demo | Live Demo (Loom) or “See how it works” anchor |
| 01 Sitemap | 01 Capture from Claude, ChatGPT, Gemini |
| 02 Experiment | 02 Organize with folders, tags, resume |
| 03 Export to code | 03 Search + export without leaving your device |
| Complete site tabs | Surfaces tabs: Side panel / Palette / Privacy |
| Features carousel | Feature highlights (local-first, ZIP, bulk clean…) |
| Pricing | Skip — or replace with “Free for hackathon / open install” |
| FAQ | Privacy, platforms, permissions FAQ |
| Ship it closer | Final Download band |

---

## Craft details worth matching

1. **Secondary headline opacity** — second line clearly quieter  
2. **Hairline separator** under hero CTA before the supporting paragraph  
3. **Section numbers** as a quiet typographic device  
4. **Illustration fidelity** — demos look real, not clip-art  
5. **Motion restraint** — smooth, purposeful, not particle chaos  
6. **One job per section** — headline + one sentence + one visual  

---

## Success criteria (does our page “feel like” that quality bar?)

- [ ] First screen is one composition, not a dashboard  
- [ ] Brand (τ / Tecora) is hero-level  
- [ ] Sections are numbered or otherwise sequenced  
- [ ] Each section has a custom illustration or UI mock  
- [ ] Download CTA appears in nav, hero, mid-page, and closer  
- [ ] Motion is clean (see [motion-and-animation.md](./motion-and-animation.md))  
- [ ] Page still reads as Tecora with Prime UI’s logo swapped out  

## Related docs

- [landing-page-structure.md](./landing-page-structure.md)
- [design-system.md](./design-system.md)
