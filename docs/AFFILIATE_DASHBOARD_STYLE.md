# Affiliate Dashboard UI Reference

Last updated: 2026-03-11

This doc captures the current visual system for the Nettmark affiliate surfaces (Affiliate Dashboard, Manage Campaigns, Wallet, NettmarkShop editor, etc.). Treat it as the single source of truth when styling new screens so we keep parity across the portal.

---

## 1. Core Shell & Background

- **Global background**: `bg-[#0b0b0b]` base with subtle radial gradients (class alias: `bg-surface`).
- **Card shell (`CARD_SHELL`)**
  - `rounded-3xl`
  - `border border-white/10`
  - `bg-[#0c1118]/95`
  - `shadow-[0_25px_70px_rgba(0,0,0,0.55)]`
- **Panel card (`PANEL_CARD`)**
  - `rounded-2xl`
  - `border border-white/10`
  - `bg-[#111317]/90`
  - `shadow-[0_20px_55px_rgba(0,0,0,0.45)]`
- These classes are applied to headers, stats, forms, hero modules, offer editors, and skeleton placeholders so every block uses the same dark glass aesthetic as the dashboard.

## 2. Typography & Accent Palette

- **Primary text**: `text-white` / `text-white/90`
- **Secondary text**: `text-white/60` – `text-white/70`
- **Accent teal**: `#00C2CB` (primary highlight for CTA buttons, badges, icon fills)
- **Soft teal glow**: `#7ff5fb` for gradients, hover glows, and dual-tone accents
- **Status colors**: Emerald for success (`text-emerald-300`, `border-emerald-500/30`), red for errors (`border-red-500/30`, `bg-red-500/10`)

## 3. Buttons & CTAs

- **Primary pill**: `bg-[#00C2CB] text-black rounded-full px-5 py-2 shadow-[0_12px_35px_rgba(0,194,203,0.35)] hover:bg-[#00b0b8]`
- **Secondary pill / outline**: `border border-white/20 bg-transparent` (or `bg-white/10`), white text, subtle hover fill
- **Icon badges**: `inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[#00C2CB]`

## 4. Metrics & Stat Cards

- Based on `PANEL_CARD`
- Uppercase label (`text-xs text-white/60 tracking-wide`), icon badge, large metric (`text-2xl font-semibold text-white`)
- Used for Views/Clicks/Featured Product, payouts, checklist progress, etc.

## 5. Charts & Data Viz

- Recharts area chart theme:
  - Transparent background, no default grid
  - Area fill gradient: `from-[#00C2CB]/35 to transparent`
  - Rolling-average line: `stroke-[#7ff5fb]`
  - Tooltip/container styled with the same charcoal card colors and `border-white/10`

## 6. Forms & Inputs

- Inputs/textareas: `rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:border-[#00C2CB]`
- File uploads: pill-style badges (`border-white/15 bg-black/20 px-3 py-1 text-[11px]`) with lucide icons
- Toggles/switches use the same teal accent color for active states

## 7. Notifications & Empty States

- **Success/info**: `border-emerald-500/30 bg-emerald-500/10 text-emerald-200`
- **Errors**: `border-red-500/30 bg-red-500/10 text-red-200`
- **Empty states**: reuse `CARD_SHELL` with centered copy so the spacing matches full cards

## 8. Theming Blocks & Offer Editors

- Theme selector buttons: `rounded-2xl border p-3` with active state `border-[#00C2CB] bg-[#00c2cb1f] shadow-[0_15px_40px_rgba(0,194,203,0.25)]`
- Custom palette inputs share the same dark input styling
- Offer editor cards: `CARD_SHELL` wrapper, icon badge, lucide icons for Reset/Upload, etc.

## 9. Skeletons / Loading State

- Skeleton cards reuse the exact shells (`CARD_SHELL` / `PANEL_CARD`) and swap interior content for `animate-pulse bg-white/10` lines to preserve layout stability

## 10. Component Inventory

- **`DashboardCard`**: shared wrapper (`rounded-2xl bg-[#111317]/95 shadow-[0_20px_60px_rgba(0,0,0,0.45)]`, optional hover scale)
- **Icon badges**: `bg-white/10 rounded-full` containers sized 6–7 px with teal lucide icons
- **Action pills**: teal primary, white-outline secondary
- **Status chips**: uppercase pill text (Active, Request Sent, etc.) using the relevant status color

---

### Usage Notes

- Any new affiliate/business shell should build on `CARD_SHELL`/`PANEL_CARD` for instant parity.
- Keep CTAs teal-on-black to preserve hierarchy; avoid introducing new bright fills unless product explicitly expands the palette.
- When embedding third-party widgets, wrap them in `PANEL_CARD` so shadows/borders remain consistent.

This doc should be updated whenever we adjust the visual language, so the entire team—and future us—can keep the UI cohesive.
