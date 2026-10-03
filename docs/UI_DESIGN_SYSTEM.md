# Nettmark UI design system

Runtime-computed styles have not yet been browser-verified in this environment. This document reflects the canonical authored source styles and should be updated if rendered verification reveals differences.

## Canonical UI reference

Future Nettmark UI work should use the mobile Business Overview as the current visual benchmark unless founder direction explicitly changes it. Extend its existing visual language before introducing new patterns. Changing the core visual language requires explicit founder approval.

This document records existing implementation, not a proposed redesign or a finished token system. The benchmark is the overview at `/business/my-business` below 768px, including its empty, pending-review, active, and launch-setup-required states. The offers and setup panels provide supporting context, not replacements for the overview benchmark.

## Evidence and scope

Static source audit on 2026-10-03. Browser rendering, computed styles, and production appearance were not verified. Pixel equivalents below assume the existing 16px root font size.

- [MobileBusinessOverview.tsx](../app/business/my-business/MobileBusinessOverview.tsx): icons (lines 10–74), secondary actions (90–91), state-driven next action (135–169), overview layout and styling (178–341).
- [mobile-business.css](../app/business/my-business/mobile-business.css): mobile visibility, font, colour overrides, status-dot removal, primary button defaults, and focus outline.
- [page.tsx](../app/business/my-business/page.tsx): wrapper and mobile integration (971–979), setup panel (1137 onward), offers panel (1356 onward).
- [globals.css](../app/globals.css): theme variables (27–119), global typography and light-theme overrides, and `.my-business-theme` remapping (638–677).
- [tailwind.config.js](../tailwind.config.js): default Tailwind scales with Satoshi configured as the sans family. Mobile CSS overrides the inherited font family.

Read these sources together: JSX class values alone do not establish the final appearance.

## Colour palette and surfaces

The current Nettmark brand accent is **cyan `#00C2CB`** (`#00c2cb` is the same colour). It identifies primary actions, completion marks, arrows, and focus outlines. Dark neutral surfaces dominate the overview component.

| Role | Existing values and treatment |
|---|---|
| Page background | `var(--background)`: dark `#0f0f0f`; root/light `#f9fafb`. Wrapper has `min-h-screen`. |
| Main overview cards | `#151718`, used consistently for overview, action hub, progress, and help. |
| Nested metric and activity surfaces | Black at 10% opacity over the parent surface. Non-overview header pill uses black at 20%. |
| Next-action surface | Explicit important `#101415`, with a subtle cyan inset glow. |
| Secondary action / neutral pill fill | White at 2% opacity. |
| Theme card variable | Dark `#1a1a1a`; root/light white. Used where global remapping matches, including the activity clock's authored white/4% background. |
| Heading and strong text | Authored white; global light `.text-white` rule changes ordinary white utilities to `#111827`. Important white on the next-action title remains a special case. |
| Muted text | Mobile CSS maps ordinary `text-slate-300`, `400`, and `500` to `var(--muted-foreground)`: dark `#94a3b8`, light `#6b7280`. |
| Secondary button text | Authored slate-200 (`#e2e8f0`); hover white. |
| Next-action description | Important slate-300 (`#cbd5e1`), bypassing the ordinary mobile muted override. |
| Cyan highlights | Icon variants `#19d4dd`, `#1cd3dc`, `#21d9e2`; pill text `#63e8ee`, completion text `#5fe6ec`; next-action eyebrow `#5ae5eb`. These are existing variations, not separate formal brand tokens. |
| Required status | Amber-200 text (`#fde68a`), amber-300 (`#fcd34d`) at 10% fill and 30% border opacity. |

## Borders

Dominant borders are **1px solid**, with white at **9% opacity** on main cards and metric tiles. Nested progress/activity containers and row dividers use white at 7%. Secondary actions use white at 11%; other existing values include 8%, 10%, and 16%.

Authored cyan borders are 20% for icon circles, 25% for the next-action box, and 30% for status pills. However, global `.my-business-theme` substring selectors override these values to `var(--border)` with `!important`: dark `#2a2a2a`, light `#e5e7eb`. The secondary action's authored cyan/40% hover border also matches that remapping. Preserve this distinction between declared styling and cascade behaviour.

## Typography

Mobile uses `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` through `.my-business-theme[data-mobile-view]` below 768px. Satoshi is the surrounding application's global family, not this mobile benchmark's effective inherited family.

| Hierarchy | Existing sizing and weight |
|---|---|
| Page title | 25px, semibold 600, tight tracking (`-0.025em`). |
| Major section headings | 23px, semibold 600, tight tracking. |
| Metric numbers | 24px, semibold 600, line-height 1. |
| Next-action and help headings | 16px, semibold 600. |
| Action/progress row titles | 14px, semibold 600. |
| Introductory body | 14px, line-height 20px. |
| Row descriptions / next-action body | Usually 12px, sometimes explicit 20px line-height. |
| Supporting details / metric labels | 11px; activity details use 16px line-height. Setup metric uses 13px semibold. |
| Status labels | 9–11px, semibold 600. |
| Section eyebrows | 9px semibold, uppercase, tracking 0.2–0.22em. Next-action eyebrow is 10px bold 700, uppercase, tracking 0.2em. |
| Primary CTA | 14px bold 700 in the overview; compact Chat action is 12px bold. |

Ordinary body copy generally uses normal 400 weight. Labels and headings favour 600, with 700 reserved for prominent actions and the next-action eyebrow. Explicit line-height utilities vary; there is no single component-wide heading line-height token.

## Spacing and shape

The dominant rhythm uses 4px-based Tailwind spacing, with smaller 2px text offsets and occasional half-step values.

- Page padding: 16px horizontally and 24px vertically; horizontal padding becomes 24px at the `sm` breakpoint (640px), still within mobile visibility through 767px.
- Overview cards: 16px padding and 16px vertical spacing (`space-y-4`). The containing page also uses 24px gaps/spacing.
- Rows: 12px gaps between icon, text, and action; action-hub rows have 16px vertical padding; progress rows have 12px padding.
- Metric grid: three columns, 8px gaps, 12px tile padding, 20px margin above it.
- Common internal spacing: 16px between blocks, 12px between smaller blocks, 4px after headings, and 2px before supporting details.
- Cards commonly use larger radii around 20–24px: **24px radius** dominates the main cards. Help uses 22px; the non-overview back header uses 20px.
- Nested surfaces: metric tiles 17px; progress/activity containers 18px; next-action box 19px.
- Primary CTA buttons are pill-shaped (`rounded-full`). Primary CSS defaults to 8px, but overview CTA classes explicitly override it to fully rounded. Interactive metric/action tiles may use smaller rounded radii, such as the metric tiles' 17px. Icon holders and status pills use `rounded-full`.

These are observed patterns, not a normalised spacing or radius token scale.

## Icons

The overview defines small inline SVG icons with a 24×24 viewBox, no fill, `currentColor` strokes, and predominantly **1.8 stroke width**. Paths generally use round caps and joins; rects/circles retain their declared SVG geometry. The completion check uses stroke width 2.

Most icons render at 20px inside circular holders: 36px for metrics, 44px for action rows and next action, and 40px for activity. Completion markers are 28px circles with 16px checks. Chat/help icons are 16px.

Icon holders usually declare cyan at 10% fill with brighter cyan strokes. The global `[class*="bg-[#00C2CB]"]` rule also matches opacity-suffixed classes, replacing those fills with solid `var(--primary)` and applying `var(--primary-foreground)` to the holder. This also affects cyan status-pill fills. Complete steps declare solid brand cyan with dark checks; incomplete steps use a neutral outline. Directional arrows are text glyphs, not SVG icons. Icon-only activity/help links have descriptive `aria-label` values.

## Shadows

Main cards use broad, soft black shadows: `0 22px 60px rgba(0,0,0,0.22)`, with 0.25 opacity on the overview hero. Help uses `0 18px 45px rgba(0,0,0,0.2)`; the back header uses the same dimensions at 0.22 opacity.

The primary CTA uses `0 10px 24px rgba(0,194,203,0.16)`. The next-action box uses `inset 0 0 24px rgba(0,194,203,0.025)`. Depth comes from subdued shadows and borders rather than strong elevation contrasts.

## Status pills

Status pills are compact, fully rounded, bordered, and semibold. Colours and fills below are authored source values; global/theme CSS may override their final rendered appearance, including remapping translucent cyan fills to solid theme cyan and changing text and border colours.

The overview status uses 11px text, 12px horizontal / 6px vertical padding, and declares cyan/7% fill and pale cyan text. Its decorative status dot is explicitly hidden by mobile CSS; the remaining label is centred with zero gap.

Progress statuses use 10px text and 10px horizontal / 4px vertical padding: Complete declares cyan/8% fill and pale cyan text; Required declares amber colours; Optional and Not started declare white/2% fill and muted text. The smaller inline Optional badge uses 9px text and 8px horizontal / 2px vertical padding. Cyan borders are subject to the global remapping described above.

## Actions and focus

The dominant primary CTA is the cyan, fully rounded, centred action below the next-action copy. CSS supplies flex alignment, minimum 44px height, 10px vertical / 16px horizontal padding, and 14px sizing. Overview utilities override its margin to 16px, weight to 700, radius to fully rounded, and request black text. Global theme rules also participate in the final foreground colour; dark primary foreground is `#0f0f0f`, light is white.

Secondary actions are quiet outlined pills with 40px minimum height, 16px horizontal padding, 8px content gap, 12px semibold labels, white/2% fill, and cyan directional arrows. The activity and help shortcuts are 40px circular outlined controls. Chat is a compact filled cyan pill with 40px minimum height and 14px horizontal padding; its authored hover fill is `#14d5de`, subject to the important global background rule.

Below 768px, all overview anchors and buttons receive a **2px solid `#00c2cb` focus-visible outline with 4px offset**. Hover treatments are present on selected controls rather than uniformly on every interactive tile. No distinct pressed-state system is defined in the overview.

## Information hierarchy and mobile layout principles

The overview follows a single vertical sequence: business title/status → three summary tiles → one next action → action hub → progress/activity → help. State chooses the next action in this order: required launch billing setup, pending submissions, first offer creation, then brand content. It does not present every setup requirement as the primary task simultaneously.

Large semibold headings establish sections; numbers and concise row titles carry the main information; muted descriptions and small uppercase eyebrows support it. Cyan draws attention to action and progress.

Below 768px, the overview is displayed while desktop panels are hidden. Choosing Offers or Launch setup shows a back-to-overview header and the corresponding existing panel; navigation scrolls to the top smoothly. The overview itself has no separate tab bar.

Rows pair a fixed-size icon with flexible text (`min-w-0`, `flex-1`) and a non-shrinking action. Selected supporting details truncate; summaries use a compact three-column grid. The layout favours stacked cards, concise copy, and locally grouped actions over desktop sidebars. Main CTA height is at least 44px, while several secondary controls are 40px; this is existing sizing, not a claim that every control meets a uniform touch-target standard.

## Existing inconsistencies and limitations

1. **Mixed theme handling:** the page background and muted text use theme variables, while most overview card surfaces remain hard-coded dark. Global light text overrides coexist with those surfaces. Light-mode appearance needs rendered verification before treating it as a separate canonical palette.
2. **Cyan border declarations are remapped:** global important selectors replace several cyan borders and a secondary hover border with the theme border colour. The declared cyan outline is not always the effective outline.
3. **Primary fill/text/hover overrides:** global important primary rules also match translucent cyan icon and status fills, replacing them with solid cyan and the theme primary foreground. They compete with authored black foreground and Chat hover fill. The overview contains important utility overrides as well. Verify computed styles before changing these interactions.
4. **Several nearby cyan shades exist:** icon, eyebrow, and status colours differ. Brand cyan remains `#00C2CB`; this audit does not consolidate the variants.
5. **Radius and shadow variations:** main cards, help, back header, nested containers, and panel styles use nearby but different values. Primary CSS's 8px radius differs from the overview's explicit pill override.
6. **Typography is locally overridden:** mobile uses the system stack while global UI uses Satoshi. Ordinary slate text tiers collapse to one muted variable; important next-action text and slate-200 actions remain exceptions.
7. **A selector targets a different shape:** the mobile `[aria-label="Next action"]` background rule has no matching next-action element in the current component; the actual box uses its explicit important background.
8. **Status decoration and sizing vary:** a structural CSS selector hides the hero dot, while other completion icons remain visible. Pill sizing spans 9–11px; control heights vary between 40px and 44px.

Document these differences when extending the reference. Do not silently normalise them or introduce new colours, fonts, radii, components, or UI behaviour as part of applying this document.
