# Plan: Unify app styling with slide theme

Use the slides’ colors and typography in the MUI theme and across the demo app. Keep MUI as the framework; adopt the slides’ palette and fonts so the whole experience (intro slides + demo) feels like one deck.

---

## 1. Design tokens from the slides

Extracted from `client/src/slides/slide-1.html` and `slide-2.html`:

| Token | Value | Usage |
|-------|--------|--------|
| **Background (base)** | `#0F172A` | Slide container, body (Slate 900) |
| **Surface / card** | `#1E293B` | Step circles, elevated surfaces (Slate 800) |
| **Surface (translucent)** | `rgba(30, 41, 59, 0.8)` | Cards, panels |
| **Border / divider** | `#334155`, `rgba(51, 65, 85, 0.5)` | Borders, dashed dividers (Slate 700) |
| **Muted border** | `#475569` | Arrows, connectors (Slate 600) |
| **Text primary** | `#F8FAFC` | Headings, primary text (Slate 50) |
| **Text secondary** | `#94A3B8` | Subtitles, labels (Slate 400) |
| **Text tertiary** | `#64748B` | Plus sign, low emphasis (Slate 500) |
| **Primary accent** | `#38BDF8` | Highlights, CTAs, icons, dividers (Sky 400) |
| **Accent tint** | `rgba(56, 189, 248, 0.1)` | Tag pill bg, card tint |
| **Accent border** | `rgba(56, 189, 248, 0.3)` | Tag pill border |
| **Purple** | `#A855F7` | Card accent (e.g. LLM/Brain) |
| **Emerald** | `#10B981` | Card accent (e.g. Memory) |
| **Rose** | `#F43F5E` | Card accent (e.g. Persona) |

**Typography**

- **Body:** Inter (300, 400, 500, 600)
- **Headings:** Space Grotesk (400, 500, 600, 700)
- Load via Google Fonts in `index.html` (or MUI `theme.typography.fontFamily` + link tag).

---

## 2. MUI theme updates ([`client/src/theme.ts`](client/src/theme.ts))

- **Tokens first** – At the top of `theme.ts`, define constants for every value from Section 1 (e.g. `const SLATE_900 = '#0F172A'`, `const SKY_400 = '#38BDF8'`, …). Use only these constants inside `createTheme`. That gives a single source of truth and makes Section 8 (robustness/durability/scalability) possible.
- **Palette**
  - **Primary:** `#38BDF8` (slide accent). Contrast text: `#0F172A` on buttons/chips.
  - **Background (dark):** `default: #0F172A`, `paper: #1E293B`.
  - **Background (light):** Keep default or set `paper` to a light Slate (e.g. `#F8FAFC`) so light mode still matches the “slate” feel if you use it.
  - **Text:** `primary: #F8FAFC`, `secondary: #94A3B8` in dark; adjust for light if needed.
  - **Divider / border:** use `#334155` or equivalent in `divider` / component overrides where relevant.
- **Typography**
  - Set `fontFamily` to include Inter and Space Grotesk (e.g. `'"Space Grotesk", "Inter", sans-serif'` for headings; body Inter).
  - Use MUI’s `typography` variants (h1–h6, body1, body2, subtitle1, etc.) so the app uses the same type scale as the slides where appropriate.
- **Shape**
  - Keep `borderRadius: 8` (or align with slides: 12 for cards). Use consistently (cards, buttons, tabs).
- **Components (optional overrides)**
  - **AppBar:** background `#0F172A`, border bottom `#334155`.
  - **Button (primary):** bg `#38BDF8`, text `#0F172A`.
  - **Paper / Card:** bg `#1E293B` or translucent, border `#334155`.
  - **Tabs:** indicator and selected text `#38BDF8`.
  - **Alert / Chip:** use primary or surface colors so they match the deck.

Keep the existing `getAppTheme(mode)` structure; only change the palette/typography values and add overrides as above.

---

## 3. Load fonts

- In **`client/index.html`**: add Google Fonts link for Inter and Space Grotesk (same as in the slides).
- In **theme.ts**: set `typography.fontFamily` and, if needed, a separate `fontFamily` for headings (e.g. via variant overrides for h1–h6 to use Space Grotesk).

---

## 4. Apply theme across the app (no slide conversion)

- Use the updated theme everywhere: no new components required.
- **AppBar / Toolbar:** already use `theme.palette.primary`; they will pick up the new Sky primary and dark background if you set `AppBar` background to `#0F172A` in dark mode.
- **Buttons, Tabs, Papers, Alerts:** rely on theme; optionally add `sx` overrides only where you want an exact slide color (e.g. a specific card border).
- **ContactsTable, CompanySelect, Contact match, etc.:** no structural changes; they inherit the new palette and fonts.

Result: same MUI patterns and components, with slide-derived colors and fonts applied globally.

---

## 5. (Optional) Convert slides to MUI

If you want the intro slides to be part of the same React/MUI tree (no iframes):

- **Slide 1:** One MUI page with:
  - Background `#0F172A`, optional grid overlay (CSS or MUI Box with backgroundImage).
  - Typography (Space Grotesk) for “What is an AI Agent?” and subtitle.
  - Accent color `#38BDF8` for highlight and divider.
  - Icons via MUI Icons or the same icon font as slides (e.g. Font Awesome) if you keep it.
- **Slide 2:** One MUI page with:
  - Same background and typography.
  - Four “anatomy” cards as MUI `Card` or `Paper` with border-top accents (purple, sky, emerald, rose).
  - Loop steps as a row of Box/Card with step number and label.
  - Connectors can stay as SVG or be simplified to lines in MUI.

Benefits: single theme, no iframe, easier to tweak copy and layout in code. Downside: more work and you lose pixel-perfect match to current HTML/CSS. Recommendation: do **Section 2 + 3 + 4** first (theme + fonts + apply everywhere); only do Section 5 if you explicitly want slides in MUI.

---

## 6. Implementation order

1. **Fonts** – Add Inter + Space Grotesk in `index.html` and reference in theme.
2. **Theme** – Update [`client/src/theme.ts`](client/src/theme.ts) with the palette and typography above; add AppBar/Button/Paper/Tabs overrides if desired.
3. **Smoke test** – Run app, confirm header, tabs, buttons, and cards use the new colors and fonts.
4. **Slides** – Keep current iframe-based HTML slides; they will still look the same, and the demo app will now match their look and feel.
5. **(Optional)** – Convert slide-1 and slide-2 to MUI components and remove iframe usage.

---

## 7. Files to touch

| File | Change |
|------|--------|
| `client/index.html` | Add Google Fonts link for Inter, Space Grotesk |
| `client/src/theme.ts` | New palette (primary #38BDF8, dark bg #0F172A, paper #1E293B, text, divider); typography (font families); optional component overrides |
| Rest of app | No required changes; optional `sx` overrides for specific components to match slides exactly |

No changes to slide HTML files unless you later replace them with MUI slide components (Section 5).

---

## 8. Robustness, durability, and scalability

### Robustness

- **Single source of truth for tokens** – In `theme.ts`, define all slide-derived values once (e.g. `const SLATE_900 = '#0F172A'`, `const SKY_400 = '#38BDF8'`) and use those constants in the palette and component overrides. No hex/rgba duplicated in components; reference `theme.palette.*` or the constants only. That way a typo or wrong value is fixed in one place.
- **Light mode** – Define a full light palette (e.g. background default/paper, text primary/secondary) so light mode stays readable and on-brand. Plan currently emphasizes dark; add explicit light-mode values so both modes are robust.
- **Font fallback** – Set `fontFamily` to `'"Space Grotesk", "Inter", sans-serif'` (or similar) so if the font link fails, the app still renders with system fonts.
- **Accessibility** – Ensure primary buttons and tabs meet contrast (e.g. Sky `#38BDF8` on `#0F172A`; contrast text on primary). Document or add a quick check that text/background combos are WCAG AA where required.

### Durability

- **Token layer** – Implement the theme so that “slide colors” live in one token object or at the top of `theme.ts`. Future changes (e.g. rebrand to a different accent) mean editing that one layer, not hunting through components.
- **Font loading** – Prefer a stable, versioned Google Fonts URL (e.g. with a version or subset) so updates don’t unexpectedly change the typeface. Optionally document “self-host fonts for durability” if the app must work offline or without Google.
- **Document the token set** – Keep Section 1 (design tokens) as the canonical list. When adding new UI (e.g. a new card type), reuse tokens from that list instead of introducing new hex codes. That keeps the design consistent and the plan durable for handoff.

### Scalability

- **New components** – Any new MUI (or custom) component should use only `theme.palette.*`, `theme.typography.*`, and `theme.shape`. No hardcoded colors in `sx` or styled components. Then adding new screens or components doesn’t require re-syncing with the slides; the theme scales.
- **Semantic palette slots** – Map slide accents to MUI palette roles where it helps: e.g. `primary` = Sky, `secondary` = muted Slate, and optionally use `success` / `error` / `info` for the emerald/rose/sky card accents so future components can use `color="primary"` or `color="success"` instead of custom hex. That scales to more components and more slide-derived accents.
- **Optional theme variants** – If you later need a third mode (e.g. “presentation” vs “demo”), keep `getAppTheme(mode)` and extend it with a small set of overrides per variant rather than duplicating the whole theme. The token-based structure supports that.
- **Slides** – Adding slide-3, slide-4, etc. (HTML or MUI) doesn’t require theme changes; they already consume the same visual language. Converting more slides to MUI is scalable because they all use the same theme.

### Summary

- **Robust:** One token source, full light + dark palette, font fallbacks, contrast in mind.
- **Durable:** Tokens and font strategy documented; theme is the single place to change look and feel.
- **Scalable:** New UI uses theme only; semantic palette slots and optional theme variants keep the approach usable as the app grows.
