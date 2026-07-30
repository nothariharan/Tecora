# Design direction (executive summary)

Single-page design doc for the Tecora landing site. Details live in the linked files.

---

## Thesis

Build a **Prime UI–class narrative landing page** with **Tecora’s black/white τ identity**.

Borrow Prime UI’s *structure and craft*. Do not borrow Prime UI’s blue pill brand or neon AI aesthetic.

---

## Product truth the design must express

- Extension, not another chatbot  
- Cross-platform library for Claude / ChatGPT / Gemini  
- Local-first — no account, no backend  
- Calm mono UI that matches the shipping product  

---

## Visual north star

| Pillar | Spec |
| --- | --- |
| Atmosphere | Near-black full-bleed pages |
| Brand | τ as hero-level signal |
| Type | Large split headlines; muted second lines |
| Color | Mono tokens from `src/ui/theme.ts`; white primary CTAs |
| Imagery | Product-real illustrations per section |
| Motion | 2–3+ intentional reveals; soft ease; reduced-motion safe |
| Layout | One job per section; numbered 01–03 story |
| CTA | Download repeated (nav, hero, mid, close) |

---

## Page shape (short)

```text
Nav
Hero (brand + promise + Download + one visual)
01 Capture
02 Organize / resume
03 Search
Export
Privacy
Surfaces tabs
Feature highlights
Install steps
FAQ
Closing Download
Footer
```

Full map: [landing-page-structure.md](./landing-page-structure.md)

---

## Inspiration notes from primeui.com

Observed patterns to emulate:

- Black void canvas  
- Centered hero with a single strong illustration  
- Split H1 (bright / muted)  
- Hairline + short paragraph under the hero CTA  
- Numbered feature chapters with interactive/illustrated demos  
- Tabbed “complete product” area  
- Feature carousel  
- FAQ accordion  
- Sparse footer  

Translation table: [prime-ui-reference.md](./prime-ui-reference.md)

---

## Explicit non-goals for v1 site

- Pricing tables  
- Blog  
- Fake testimonials / logo farms  
- Purple gradient “AI startup” template  
- Dashboard-style hero with ten widgets  
- Claiming unfinished roadmap items as shipped  

---

## Definition of done (design)

The page is done when:

1. A stranger understands Tecora in one scroll screen + two sections  
2. They know it’s local-first and not an AI wrapper  
3. They can click **Download** without hunting  
4. The page feels like the same product as the extension UI  
5. Illustrations and motion feel intentional, not stock  

---

## Detail index

| Topic | File |
| --- | --- |
| Tokens, type, components | [design-system.md](./design-system.md) |
| Brand & voice | [brand-and-voice.md](./brand-and-voice.md) |
| Illustrations | [illustrations.md](./illustrations.md) |
| Motion | [motion-and-animation.md](./motion-and-animation.md) |
| Copy | [copy-and-messaging.md](./copy-and-messaging.md) |
| CTAs | [download-and-cta.md](./download-and-cta.md) |
