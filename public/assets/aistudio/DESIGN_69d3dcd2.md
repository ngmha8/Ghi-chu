---
name: Executive Precision
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#006591'
  on-secondary: '#ffffff'
  secondary-container: '#39b8fd'
  on-secondary-container: '#004666'
  tertiary: '#784b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#996100'
  on-tertiary-container: '#ffeedd'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#c9e6ff'
  secondary-fixed-dim: '#89ceff'
  on-secondary-fixed: '#001e2f'
  on-secondary-fixed-variant: '#004c6e'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-hero:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.06em
  label-bold:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  label-regular:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  caption:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-lg: 1.5rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system targets knowledge workers, executive operators, and engineering leads requiring high-clarity operational oversight. The visual posture reflects **Modern Enterprise SaaS**—systematic, disciplined, and frictionless. 

The aesthetic is characterized by:
- Pure functional density: low padding variance, clear content grouping, and high scannability.
- Crisp boundary delineation: crisp 1px borders paired with subtle ambient elevation rather than heavy drop shadows.
- Deliberate semantic signaling: strict prioritization rules (Eisenhower Matrix system) to channel focus without cognitive fatigue.
- Professional neutrality: cool slate grounds combined with rich, sharp action colors.

## Colors

The system uses a calibrated light mode palette centered around a cool `#F8FAFC` foundation and pure `#FFFFFF` structural containers. 

### Core Palette
- **Primary Canvas**: `#F8FAFC` (Slate 50)
- **Card / Surface**: `#FFFFFF`
- **Surface Hover**: `#F1F5F9`
- **Border Default**: `#E2E8F0`
- **Border Strong**: `#CBD5E1`
- **Text Primary**: `#172033` (High-contrast slate black)
- **Text Secondary / Muted**: `#64748B`
- **Brand Action (Primary)**: `#2563EB` (Royal Blue)

### Semantic & Eisenhower Matrix Status Tokens
- **Q1 Do First (Urgent & Important / Danger)**: `#EF4444` (Bg tint: `#FEF2F2`, Border tint: `#FECACA`)
- **Q2 Schedule (Important, Not Urgent / Warning)**: `#F59E0B` (Bg tint: `#FFFBEB`, Border tint: `#FDE68A`)
- **Q3 Delegate (Urgent, Not Important / Info)**: `#0EA5E9` (Bg tint: `#F0F9FF`, Border tint: `#BAE6FD`)
- **Q4 Eliminate (Low Priority / Neutral Muted)**: `#94A3B8` (Bg tint: `#F8FAFC`, Border tint: `#E2E8F0`)
- **Success / Completed**: `#10B981` (Bg tint: `#ECFDF5`, Border tint: `#A7F3D0`)

## Typography

The type hierarchy prioritizes high information density, rapid scanning, and semantic structural clarity. `Inter` drives both UI and display tiers with tailored weights and tight tracking for compact tabular readouts.

- **Hero & Section Headers**: Utilize negative tracking (`-0.02em` to `-0.025em`) and semi-bold/bold weights to anchor dense data regions.
- **Section Badges & Metric Headers**: Explicitly leverage `label-caps` in uppercase format to clearly separate metric tags from values.
- **Body & Data Grid**: Standardize on `13px` (`body-md`) for content descriptions, tasks, and notes to maximize viewport utilization while preserving legibility.

## Layout & Spacing

The architecture operates on an 8px modular spacing framework with a 4px sub-grid for tightly grouped interface micro-elements (such as tags, action pills, and status chips).

### Grid Structure
- **Desktop (1200px+)**: Dual-region operational dashboard. A flexible 8-column main operational quadrant paired with a fixed or 4-column utility and stream sidebar (`360px` to `420px`).
- **Tablet (768px - 1199px)**: Columns stack with horizontal priority, transitioning sidebar utilities to collapsible bottom drawer panels or full-width secondary blocks.
- **Mobile (<768px)**: Unified single-column flow with horizontal swipeable views for Eisenhower quadrants and bottom navigation.

### Internal Spacing Rhythm
- **Card Padding**: Fixed at `space-lg` (`16px`) for primary cards and metric modules, stepped down to `space-md` (`12px`) for nested task item wrappers.
- **Micro Gaps**: Compact items (icon-to-label, badge groups) rely strictly on `space-xs` (4px) or `space-sm` (8px).

## Elevation & Depth

Visual separation relies on structural outlines paired with light, non-intrusive shadow layers to prevent cognitive visual clutter.

- **Elevation 0 (Canvas Base)**: `#F8FAFC` flat surface.
- **Elevation 1 (Card & Module Surface)**: Pure `#FFFFFF` surface enclosed with `1px solid #E2E8F0` and `box-shadow: 0 1px 2px 0 rgba(15, 23, 42, 0.04)`.
- **Elevation 2 (Interactive Floating / Hover)**: Active panels, flyouts, and hovered task cards lift with `box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`.
- **Elevation 3 (Dropdowns & Modals)**: Fixed overlays use `box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.03)` with a `1px solid #CBD5E1` boundary.
- **Tinted Tonal Containers**: Notification strips and matrix sub-headers adopt 4% to 8% tinted background fills with matching 20% border tones for immediate cognitive indexing without elevation shifts.

## Shapes

The geometric signature balances enterprise precision with modern softness:

- **Dashboard Cards & Quadrant Modules**: Standardized to `rounded-xl` (12px), creating distinct structural zones.
- **Inputs, Buttons, & Dropdown Triggers**: Set to `rounded-lg` (8px) for comfortable hit targets.
- **Badges, Tags, & Status Pills**: Rendered with fully rounded pill radii (`9999px`) or `rounded-md` (6px) depending on density requirements.

## Components

### Buttons
- **Primary Action**: Solid `#172033` (Slate 900) or `#2563EB` (Primary Brand) with white text, 8px radius, `8px 14px` padding, font `label-bold`.
- **Secondary / Utility**: White background, `1px solid #E2E8F0`, `#172033` label, with hover transition to `#F8FAFC`.
- **Ghost Action**: Borderless, text `#64748B`, hover to `#F1F5F9`.

### Badges & Chips
- **Quadrant Pill (Eisenhower)**: Semi-transparent background (tint 8-12%) of the quadrant color, matching 1px border, bold uppercase font (`label-caps`), and saturated colored leading dot (6px circle).
- **Metric Count Badges**: Small rounded-full or rounded-md badge in `#0F172A` with contrasting white typography for item counts.

### Input Fields & Search Bars
- Standard input height: `36px` to `40px`.
- Crisp `#FFFFFF` surface with `1px solid #E2E8F0`, transitioning to `1px solid #2563EB` and a `0 0 0 2px rgba(37, 99, 235, 0.12)` focus ring.
- Integrated keyboard shortcut hints (`#94A3B8` mono caps) and Lucide search icons (`16px`, `#94A3B8`).

### Cards & Matrix Panels
- **Quadrant Card Structure**: Header row with matrix title, quadrant number, urgency badge, and rapid "Add" trigger.
- Thin `1px solid #E2E8F0` divider line separating header from the task container.
- Empty states featuring centered soft italicized copy (`#94A3B8`) and subtle dotted or muted dashed inline interaction prompts.

### Task List Items
- Clean row layout: Leading status check trigger (square with rounded 4px corners or circular toggle), inline title, followed by flexible metadata tags (due dates, assignee initials, tags).
- Bordered or surface-separated with a `4px` gap, elevating slightly on pointer hover.