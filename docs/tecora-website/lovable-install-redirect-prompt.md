# Lovable change prompt — point install/download to GitHub

Paste everything under **THE PROMPT** into Lovable on the existing Tecora landing
project. This is a **surgical change** — do not redesign, restructure, or restyle
the page. Only rewire the calls-to-action and the Install section to the public
GitHub repository.

Repo: `https://github.com/nothariharan/Tecora`

---

## THE PROMPT (copy from here)

You are editing the **existing Tecora landing page**. Make ONLY the changes below.
Do **not** change layout, colors, typography, illustrations, motion, section
order, or copy anywhere except where explicitly stated. Keep the black/white/τ
brand exactly as-is.

### 1. Wire every install/download action to GitHub

Update the shared link constants (create/replace wherever they live, e.g.
`src/config/links.ts` or the constants file already used by the CTAs):

```ts
export const GITHUB_URL = "https://github.com/nothariharan/Tecora";
// Downloads/installs go to the repo (README has load-unpacked instructions).
// There is no Chrome Web Store listing yet.
export const DOWNLOAD_URL = GITHUB_URL;
```

Every primary **Download** / **Install Tecora** button must now be a real anchor
that opens the repo in a new tab:

- Render as `<a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">`
  (not a `<button>` with no navigation).
- Keep the exact same visual style (white fill, black label) and label text.
- Apply this to **all** Download CTA placements:
  1. Nav (top-right)
  2. Hero
  3. Mid-page CTA in the **Export** section
  4. The **Install** section button
  5. The **Closing** Download band

The **Footer** "GitHub" link must also point to `GITHUB_URL` with the same
`target="_blank" rel="noopener noreferrer"`.

Secondary links ("See how it works", "Watch demo") stay as in-page anchors —
do not repoint those.

### 2. Rewrite the Install section copy

The current Install section has generic steps. Replace its steps with the real
"load unpacked" flow (there is no Web Store link or zip yet). Keep the section's
existing title style, spacing, and the Download button — only swap the step
content.

**Section title:** keep `Up in a minute.` (or current title).

**Intro line (small, muted):**
> Tecora isn't on the Chrome Web Store yet — build it from source and load the
> unpacked extension. Takes about two minutes.

**Steps (numbered, same visual treatment as now):**

1. **Get the code** — Clone the repo and build:

   ```bash
   git clone https://github.com/nothariharan/Tecora.git
   cd Tecora
   npm install
   npm run build
   ```

2. **Load it in Chrome** — Open `chrome://extensions`, turn on **Developer
   mode**, click **Load unpacked**, and select the `.output/chrome-mv3` folder.

3. **Open a chat site** — Visit Claude, ChatGPT, or Gemini while logged in. The
   floating **τ** dock appears and your library starts filling in.

Render the shell commands and paths (`chrome://extensions`, `.output/chrome-mv3`)
in **monospace**, consistent with how `Ctrl/Cmd+K` and `MISSING.md` are already
styled.

Below the steps, keep/add the primary Download button (→ `DOWNLOAD_URL`) with the
label **View on GitHub** (or keep **Download** if you prefer consistency), plus
this muted microcopy line:
> Open source · Chrome Manifest V3 · No Tecora account

### 3. Trust microcopy (small addition, optional)

Anywhere the hero/CTA microcopy currently reads
`No Tecora account · No backend · Chrome MV3`, you may append ` · Open source on
GitHub`. Do not add new badges, stats strips, or logos.

### 4. Do NOT change

- Any section design, illustration, animation, or ordering
- Brand colors, τ mark, fonts, spacing
- Product claims / FAQ copy (no cloud, no AI wrapper, no fake quota)
- The "See how it works" / demo anchors

### 5. Acceptance checklist

- [ ] `DOWNLOAD_URL` and `GITHUB_URL` both resolve to
      `https://github.com/nothariharan/Tecora`
- [ ] All 5 Download/Install CTAs are anchors opening GitHub in a new tab
- [ ] Footer GitHub link points to the repo
- [ ] Install section shows the clone → build → load-unpacked flow with
      monospace commands and `.output/chrome-mv3`
- [ ] Nothing else on the page changed visually

---

## END OF PROMPT

---

## Notes for you (not for Lovable)

- There's **no Chrome Web Store listing** and no packaged release yet, so every
  CTA sensibly lands on the repo, whose README carries the full install/test
  guide. If you later cut a GitHub Release with a built `.zip`, change only
  `DOWNLOAD_URL` to that release URL and keep `GITHUB_URL` as the repo.
- Keep `nothariharan/Tecora` in sync with the actual repo owner/name if it ever
  changes.
