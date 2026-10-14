---
name: Subloom
description: The established forest and mint subscription interface.
colors:
  light-background: "#F8FAF8"
  light-surface: "#FFFFFF"
  light-text: "#182D25"
  light-secondary: "#586F61"
  light-faint: "#607266"
  light-border: "#E8EEE9"
  light-primary: "#087F68"
  light-accent: "#0BB999"
  light-pressed: "#066551"
  light-mint: "#EAF6EE"
  light-mintStrong: "#D8EEDE"
  light-warning: "#9B631D"
  light-warningBg: "#FFF3E0"
  light-error: "#BA4343"
  light-errorBg: "#FDEEEE"
  light-sidebar: "#FFFFFF"
  light-hero: "#E1F0DE"
  light-heroText: "#20432D"
  light-heroSecondary: "#527259"
  light-heroArt: "#A4C694"
  dark-background: "#101A16"
  dark-surface: "#18251E"
  dark-text: "#E7F2E9"
  dark-secondary: "#A0B4A5"
  dark-faint: "#879B8C"
  dark-border: "#2A3A30"
  dark-primary: "#70D2AD"
  dark-accent: "#0BB999"
  dark-pressed: "#ADE9CC"
  dark-mint: "#243F30"
  dark-mintStrong: "#2B4B36"
  dark-warning: "#EAC187"
  dark-warningBg: "#3D3020"
  dark-error: "#F4A1A1"
  dark-errorBg: "#3D2424"
  dark-sidebar: "#142019"
  dark-hero: "#27432F"
  dark-heroText: "#E1F5DB"
  dark-heroSecondary: "#B1CEAB"
  dark-heroArt: "#527B43"
  dark-on-primary: "#102219"
typography:
  heading:
    fontFamily: "Manrope_700Bold"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.65px"
  page-heading-wide:
    fontFamily: "Manrope_700Bold"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.75px"
  page-heading-compact:
    fontFamily: "Manrope_700Bold"
    fontSize: "27px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.675px"
  body:
    fontFamily: "DMSans_400Regular"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  body-bold:
    fontFamily: "DMSans_600SemiBold"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.45
  field-label:
    fontFamily: "DMSans_600SemiBold"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.45
  field-input:
    fontFamily: "DMSans_400Regular"
    fontSize: "16px"
    fontWeight: 400
  tab-label:
    fontFamily: "DMSans_500Medium"
    fontSize: "10px"
    fontWeight: 500
rounded:
  sm: "10px"
  md: "16px"
  lg: "24px"
  pill: "999px"
  control: "12px"
  badge: "7px"
  dialog: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  button-primary-light:
    backgroundColor: "{colors.light-primary}"
    textColor: "{colors.light-surface}"
    typography: "{typography.body-bold}"
    rounded: "{rounded.control}"
    padding: "11px 21px"
  button-primary-dark:
    backgroundColor: "{colors.dark-primary}"
    textColor: "{colors.dark-on-primary}"
    typography: "{typography.body-bold}"
    rounded: "{rounded.control}"
    padding: "11px 21px"
  button-secondary-light:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
    rounded: "{rounded.control}"
    padding: "11px 21px"
  button-danger-light:
    backgroundColor: "{colors.light-errorBg}"
    textColor: "{colors.light-error}"
    rounded: "{rounded.control}"
    padding: "11px 21px"
  card-light:
    backgroundColor: "{colors.light-surface}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
  card-dark:
    backgroundColor: "{colors.dark-surface}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
  field-light:
    backgroundColor: "{colors.light-background}"
    textColor: "{colors.light-text}"
    rounded: "{rounded.control}"
  chip-selected-light:
    backgroundColor: "{colors.light-primary}"
    textColor: "{colors.light-surface}"
    rounded: "{rounded.control}"
    padding: "11px 15px"
  nav-selected-light:
    backgroundColor: "{colors.light-mint}"
    textColor: "{colors.light-primary}"
    rounded: "{rounded.sm}"
---

# Design System: Subloom

## Overview

**Creative North Star: "Forest and mint Subloom"**

This is a factual extraction of the incumbent interface, preserving the visual direction in `feature-docs/ux-direction.md`: forest/mint colors, DM Sans/Manrope, Lucide icons and restrained bordered surfaces. The interface is calm, readable and task-oriented. Selection, focus and state carry the accent.

The system uses shared React Native primitives across Expo native and web surfaces. Rounded controls and lightly separated surfaces establish hierarchy without decorative depth. Responsive navigation and protected selection sheets keep the same visual identity on desktop and phones. This document records source facts, not a replacement identity or a new whole-surface review.

**Key Characteristics:**

- Forest text and backgrounds, mint selections and green actions.
- Manrope headings above DM Sans body text, labels and tabular numbers.
- Thin semantic borders, rounded surfaces and visible focus.
- Bounded feedback motion with shared system reduced-motion checks.

## Colors

The palette moves from pale green paper and white surfaces in light appearance to forest backgrounds and layered green surfaces in dark appearance. The frontmatter preserves every semantic color in `src/theme/tokens.ts`; `light-` and `dark-` identify the corresponding theme object.

### Primary

- **Forest action / mint action** (`primary`): primary buttons, selected navigation, field focus and selected choices. Dark primary actions use the separate `dark-on-primary` foreground; light actions use white.
- **Deeper forest / pale mint feedback** (`pressed`): primary button hover backgrounds. This semantic name is retained from the source; it does not imply every press uses this color.
- **Bright green accent** (`accent`): the shared accent token, distinct from the theme-specific action color.
- **Soft mint / forest mint** (`mint`, `mintStrong`): selected and hovered controls, icon grounds, avatars and browser text selection.
- **Hero greens** (`hero`, `heroText`, `heroSecondary`, `heroArt`): the established illustrated hero color family.

### Neutral

- **Green paper / deep forest** (`background`): page canvas, field fill and neutral badges.
- **White / raised forest** (`surface`): cards, secondary buttons, sheets and dialogs.
- **Forest ink / pale green ink** (`text`): primary reading text.
- **Muted green / sage** (`secondary`, `faint`): secondary text and quiet labels, retaining their separate source roles.
- **Pale green stroke / forest stroke** (`border`): cards, fields, navigation separators and dividers.
- **Sidebar surface** (`sidebar`): the wide-layout navigation background.

### Semantic feedback

Warning and error each have a foreground/background pair (`warning`/`warningBg`, `error`/`errorBg`). Badges and alerts pair color with visible text; error controls retain an error stroke and message. These are feedback roles, not alternative brand accents.

**The Theme Pair Rule.** Resolve semantic colors through `useTheme()`; keep foregrounds, grounds and borders in the same theme. Appearance honors the saved light/dark/system preference through React Native's system color scheme.

## Typography

**Display Font:** Manrope, installed as `Manrope_600SemiBold` and `Manrope_700Bold`.
**Body Font:** DM Sans, installed as `DMSans_400Regular`, `DMSans_500Medium` and `DMSans_600SemiBold`.

The root layout loads these five faces through `expo-font`. No custom fallback stack or mono family is declared by the shared primitives. `tokens.fonts.display` points to Manrope 600 and `displayBold` to 700; `body`, `medium` and `bold` point to DM Sans 400, 500 and 600.

### Hierarchy

- **Heading:** the frontmatter records its default and wide/compact page variants. Every `Heading` uses Manrope 700, line height of size × 1.25 and letter spacing of size × −0.025; it exposes the header accessibility role.
- **Section title:** `SectionTitle` uses a (19 px) heading; sheets use (22 px) and confirmations (20 px). These are component sizes, not new global font tokens.
- **Body:** `Label` uses the recorded body or body-bold role, line height of size × 1.45 and `tabular-nums`. Call sites can supply a size.
- **Supporting text:** page subtitles use (13 px); hints use (12 px); badges use (11 px) semibold.
- **Fields and navigation:** the frontmatter records field text, labels and tab labels. Sidebar rows use (13 px), with semibold selected text.

**The Numeric Reading Rule.** Preserve the shared tabular-number treatment and keep financial labels readable while motion runs; do not move exact money calculations into animation worklets.

## Layout

The shared spacing scale is in the frontmatter. The implementation also uses explicit component measurements; these should not be mistaken for additional global spacing tokens. `useWide()` switches at width ≥ (900 px).

`Page` centers a full-width scrolling container with a maximum width of (1280 px). Padding is (38 px) wide and (22 px) compact. Bottom padding is (110 px) without a footer and (28 px) with one. The header has a (16 px) gap and (30 px) bottom margin. A footer uses (22 px) horizontal padding, (12 px) top padding and bottom padding of at least (12 px), respecting the safe-area inset. `FeaturePage` spaces its child groups by (20 px).

The tab shell shows a (232 px) sidebar at the wide threshold, with (24 px) padding and (32 px) top padding. Below that threshold, it shows bottom navigation: height (84 px) on iOS or (72 px) elsewhere, top padding (9 px), and bottom padding (26 px) on iOS or (12 px) elsewhere. Feature routes outside the tab shell use the shared page and back control.

Sheets center on wide layouts and attach to the bottom on compact layouts. The selection sheet is full width, capped at (460 px) wide or (600 px) compact, and at (88%) height. Its top space includes the safe-area inset plus (20 px); compact bottom padding is at least (16 px). Confirmations use (90%) width, a (460 px) maximum width and (85%) maximum height, with a (24 px) compact bottom margin.

## Elevation & Depth

The shared card, button, field, navigation and sheet primitives declare no shadows. Depth comes from semantic surface fills, thin borders and modal dimming. The selection backdrop is `rgba(8, 22, 16, 0.46)`; the confirmation backdrop is `rgba(10,25,18,0.45)`. This is a source description of these primitives, not a claim that every component in the repository is shadow-free.

**The Restrained Surface Rule.** Extend the incumbent bordered, tonal surfaces rather than adding an unrelated shadow system.

## Shapes

The base radius scale and reused control, badge and dialog radii are in the frontmatter. Cards use the medium token; buttons, icon buttons, fields, selection rows and chips use the control radius. Sidebar rows use the small token. The selection sheet uses the dialog radius on wide layouts and the large radius on compact top corners, with square compact bottom corners. Its compact handle measures (36 × 4 px), with (2 px) corners.

Cards, fields, secondary buttons and navigation separators generally use a (1 px) semantic border. Focused fields and selection triggers use a (2 px) stroke, with padding compensation so the text does not jump.

## Components

### Buttons

Rounded, readable actions with explicit state feedback. Normal buttons have a minimum height of (50 px); small buttons have a minimum height of (44 px), horizontal padding of (16 px) and the same (11 px) vertical padding. Icon buttons measure (44 × 44 px) with (19 px) Lucide icons; button icons use (18 px).

Primary colors and normal padding are recorded in the frontmatter. Secondary buttons use surface fill and a border, shifting to mint on hover. Ghost buttons start transparent and shift to mint on hover. Danger buttons use the error pair. Disabled/busy buttons block activation and show (0.6) opacity; icon buttons use (0.5). Busy buttons expose busy state and show an activity indicator. Web buttons have a (2 px) primary outline offset by (3 px); icon-button focus uses a (2 px) offset. The browser stylesheet also supplies a focus-visible ring for buttons and tabs.

Press feedback scales ordinary buttons to (0.985) over (100 ms), then returns over the shared fast duration (150 ms). Reduced motion holds scale at 1. Native activation requests selection haptics.

### Chips and badges

Chips are accessible selected buttons, with selected primary fill and an appropriate theme foreground, a minimum height of (44 px), (11 px) vertical and (15 px) horizontal padding. They use an (8 px) gap; rows scroll horizontally unless wrapping is explicitly requested. Disabled chips block changes and use (0.5) opacity. Badges use (4 px) vertical and (9 px) horizontal padding and semantic text/background pairs.

### Cards / Containers

Cards use the theme surface, a border, the medium radius and large spacing token for padding. Local style overrides are supported. The control-center screens reuse this existing primitive rather than introduce a separate container system.

### Inputs / Fields

Fields use the canvas fill, a semantic stroke and the control radius. Minimum outer height is (52 px); text-input minimum height is (50 px). Default horizontal padding is (14 px), becoming (13 px) with the thicker focus border. Input vertical padding is (12 px), becoming (11 px) on focus. Label/content gap is (8 px); fields have (18 px) bottom margin. Read-only fields use (0.6) opacity. Error labels expose a polite live region; web fields expose invalid state.

Select fields use the same minimum height and focus-border pattern, with visible chevron, descriptive accessibility label and expanded/disabled state. Compact selection fields omit the visible label and detail while preserving the accessible label. Searchable sheets use an autofocus search field. Options form an accessible radio group with checked state and a check icon; rows have (54 px) minimum height, (14 px) padding and (4 px) gaps. Arrow keys, Home and End move web option focus; selecting an option closes the sheet and returns web focus to its trigger.

### Navigation

Wide sidebar rows have a minimum height of (48 px), (14 px) horizontal padding, (12 px) icon/text gap and (7 px) bottom margin. Selected rows use mint fill, primary text/icon, semibold text and a small primary dot. Compact navigation uses theme active/inactive colors and the tab-label role. Quick actions are available from the existing controls and Cmd/Ctrl K.

### Sheets, confirmations and feedback

The shared `PickerSheet` is the signature protected-selection container for choices, quick actions and subscription actions. Its header uses (20 px) padding, with (16 px) bottom padding; its scroll content uses (20 px) horizontal padding. It exposes modal semantics and supports platform back dismissal. Busy state blocks close controls and backdrop dismissal. Confirmation content uses (26 px) padding and an (18 px) gap; repeated submission is guarded, failures display an alert and retain the dialog for recovery.

Shared motion tokens are fast (150 ms) and normal (240 ms). `AnimatedIn` uses a fast fade with delay capped at (80 ms), removed under reduced motion. Modal fades become `none`; root navigation's `slide_from_right` becomes `none`. Toasts enter over (150 ms), exit over (120 ms), show for (4500 ms), expose a polite alert and include a dismiss control with a (44 × 44 px) minimum target. Charts use their own bounded transition; `ChartBar` uses (420 ms) with `ReduceMotion.System`.

**The Feedback Without Travel Rule.** Preserve state and readable labels when system reduced motion suppresses spatial or entrance animation. Source support is established; native runtime and browser reduced-motion emulation were not tested in the control-center handoff.

## Do's and Don'ts

### Do:

- **Do** use the existing semantic theme pairs, installed fonts, Lucide icons and shared primitives.
- **Do** preserve visible focus, named actions, selected/busy/disabled semantics and usable compact touch controls.
- **Do** retain bounded feedback and system reduced-motion paths.
- **Do** keep original currencies and date-only financial semantics legible; distinguish recurring estimates from imported payment facts.
- **Do** preserve guest persistence, owner-isolated saves, draft protection and contextual error recovery.

### Don't:

- **Don't** replace the established forest/mint identity or introduce an unrelated visual system in a refinement.
- **Don't** hide required compact actions behind hover or swiping.
- **Don't** communicate financial or error meaning through color alone.
- **Don't** imply planning records, simulations, reminders or manually recorded cancellation perform merchant billing or money movement.
- **Don't** treat source-level accessibility or native bundle exports as proof of untested device behavior.
