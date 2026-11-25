# SparrowX Design System — Master Specification

> **LOGIC:** When building or updating any SparrowX platform page (`sparrowx.net`, `infra.`, `db.`, `file.`, `password.`, `sec.`, `game.`, `deploy.`, `ai.`, `agents.`, `dpdp.`, `netsec.`), follow this Master file unless a page-specific override exists in `design-system/sparrowx/pages/[page-name].md`.

---

**Project:** SparrowX Sovereign Cloud & Autonomous Security Platform  
**Updated:** 2026-11-25  
**Category:** Sovereign Cloud Infrastructure, Cybersecurity & Developer Platform  
**Design Dials:** Variance 6/10 (Balanced / Modern) | Motion 5/10 (Standard, Reduced-Motion Safe) | Density 5/10 (Standard)

---

## Global Rules

### Core Obsidian Surface Palette (Dark-First)

| Role | Token | Value | Minimum Contrast |
|------|-------|-------|------------------|
| Canvas Background | `--background` | `#020307` | Base |
| Elevated Card | `--card` | `oklch(0.115 0.012 260)` (`#090B12`) | — |
| Primary Foreground | `--foreground` | `oklch(0.96 0.005 255)` (`#F4F6FA`) | > 16:1 on `#020307` |
| Muted Foreground | `--muted-foreground` | `oklch(0.76 0.010 255)` (`#A9B4C4`) | > 7.5:1 on `#020307` |
| Border Hairline | `--border` | `oklch(0.28 0.014 258)` | >= 3:1 non-text UI boundary |
| Focus Ring | `--ring` | `oklch(0.84 0.010 255)` | High-contrast keyboard ring |
| Destructive | `--destructive` | `oklch(0.62 0.22 25)` | Paired with icon + text |

### Per-Service Accent Identity (Never mix accents across services)

| Service | Subdomain | Accent Hex | 3D PNG Logo |
|---------|-----------|------------|-------------|
| SparrowX Core | `sparrowx.net` | `#F4F6FA` / `#38BDF8` | `/sparrowx-logo.png` |
| Cloud Infra (Xeon / Ryzen) | `infra.sparrowx.net` | `#38BDF8` (Xeon) / `#F43F5E` (Ryzen) / `#FFA14A` (CTA) | `/logos/sparrowx-silver.png` |
| Cloud Database | `db.sparrowx.net` | `#3ECF8E` / `#A3E635` | `/logos/sparrowx-db.png` |
| Drop File Vault | `file.sparrowx.net` | `#A855F7` | `/logos/sparrowx-drop.png` |
| Password & Keys | `password.sparrowx.net` | `#F59E0B` | `/logos/sparrowx-keys.png` |
| Shield SOC & WAF | `sec.sparrowx.net` | `#F9103A` / `#F96246` | `/logos/sparrowx-shield.png` |
| Game Hosting | `game.sparrowx.net` | `#FF5A1F` / `#5865F2` | `/logos/sparrowx-main.png` |
| Deploy / API / Story | `deploy.` / `api.` | `#38BDF8` / `#818CF8` | `/logos/sparrowx-network.png` |

---

### Typography

- **Display / Headings:** `Plus Jakarta Sans`, `Inter`, sans-serif (`letter-spacing: -0.025em`, `text-wrap: balance`)
- **Body:** `Inter`, `Plus Jakarta Sans`, sans-serif (`line-height: 1.5–1.65`, `text-wrap: pretty`)
- **Telemetry / Code / Pricing:** `JetBrains Mono` (`font-variant-numeric: tabular-nums`)
- **Game Hosting Surface:** `Unbounded` (display) + `Manrope` (body)

### Spacing Scale (Density 5/10 — Standard)

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight icon/label gaps |
| `--space-sm` | `8px` / `0.5rem` | Control clusters, pills |
| `--space-md` | `16px` / `1rem` | Standard card/input padding |
| `--space-lg` | `24px` / `1.5rem` | Card inner padding, grid gaps |
| `--space-xl` | `32px` / `2rem` | Component group separation |
| `--space-2xl` | `48px` / `3rem` | Section vertical padding |
| `--space-3xl` | `64px` / `4rem` | Hero vertical padding |

---

## Mandatory Interaction & Accessibility Standards

1. **WCAG 2.2 Focus Not Obscured:** `html { scroll-padding-top: 5.25rem; }` ensures sticky headers never cover keyboard-focused links or fields.
2. **Visible Keyboard Focus:** Every interactive element uses `:focus-visible` (`outline: 2px solid var(--ring); outline-offset: 2px;`) and never strips outlines without a high-contrast replacement.
3. **Color Contrast & Non-Color Cues:** Normal text >= 4.5:1 (`#94A3B8` or lighter on obsidian backgrounds); never use dim `#64748B` or `white/40` for readable body/meta text. Never communicate error/success states by color alone — always pair with icons and text.
4. **Forced Colors & High Contrast:** Provide `@media (forced-colors: active)` border/outline fallbacks and `@media (prefers-contrast: more)` token reinforcement.
5. **Color Interpolation:** Prefer `in oklab` for gradients and `color-mix()` with neutrals (gated behind `@supports` progressive tokens) to avoid Chromium's low-chroma `oklch` magenta-tint bug.
6. **Reduced Motion:** Gate all ambient/floating/pulse animations behind `@media (prefers-reduced-motion: no-preference)`.
7. **Transparent 3D Logos Only:** Always use transparent-background `.png` logos in navbars, dropdowns, and favicons — never boxed `.jpg` thumbnails.
8. **Real Telemetry Only:** Never display hardcoded CPU/RAM/Disk percentages or simulated metrics as live telemetry.

---

## Pre-Delivery Checklist

- [ ] No emojis used as UI icons (Lucide SVG icons only)
- [ ] Transparent 3D `.png` logos used across navbars, dropdowns, and favicons
- [ ] `cursor-pointer` on all interactive buttons, links, and selectable cards
- [ ] Keyboard accessibility (`tabIndex`, Enter/Space, `aria-expanded`, `focus-visible`) on custom interactive elements
- [ ] Text contrast >= 4.5:1 on obsidian dark surfaces
- [ ] `scroll-padding-top` set for sticky headers; `text-wrap: balance` on headings
- [ ] `prefers-reduced-motion`, `prefers-contrast: more`, and `forced-colors: active` respected
- [ ] Zero horizontal overflow across 375px, 768px, 1024px, and 1440px
