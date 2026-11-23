# CollabSpace Design System

## 1. What Makes This UI Not Generic

1. The interface itself is strictly monochrome slate with zero brand accent hue, intentionally avoiding the generic purple/blue gradients, soft-shadowed cards, and letter-spaced eyebrow labels typical of AI-generated interfaces.
2. Every single pixel of color on screen belongs exclusively to human collaborators—their carets, avatars, and selection highlights—making real-time human presence the sole memorable aesthetic element in the entire product.
3. Typography deliberately pairs the geometric restraint of self-hosted Hanken Grotesk for UI chrome with the editorial warmth of Source Serif 4 for documents, ensuring the writing surface feels like a tactile printed page rather than a web app.

---

## 2. Design Tokens

### Neutrals

| Token | Hex | Role |
|---|---|---|
| `--fog` | `#ECEEF1` | App background |
| `--paper` | `#FFFFFF` | Document page, dialogs, inputs |
| `--ink` | `#1B2230` | Primary text, primary buttons |
| `--ink-soft` | `#566073` | Secondary text, placeholders, metadata |
| `--line` | `#D8DCE2` | Hairlines, input borders, dividers |
| `--wash` | `#F5F6F8` | Row hover, toolbar hover |
| `--focus` | `#3555D6` | Keyboard focus ring and text links only |
| `--danger` | `#B3261E` | Destructive text and destructive actions only |

### Presence Palette

Colors are deterministically assigned by hashing `userId`. Every color holds white text with a WCAG contrast ratio exceeding 4.5:1 against `#FFFFFF`:

| Name | Hex | WCAG Contrast vs #FFFFFF |
|---|---|---|
| `coral` | `#C4412E` | 5.09:1 (Pass AA) |
| `ochre` | `#936000` | 5.43:1 (Pass AA) |
| `moss` | `#37762A` | 5.57:1 (Pass AA) |
| `teal` | `#0B7480` | 5.51:1 (Pass AA) |
| `cobalt` | `#2B58CE` | 6.22:1 (Pass AA) |
| `violet` | `#7046C9` | 6.19:1 (Pass AA) |
| `magenta` | `#AE2F86` | 5.88:1 (Pass AA) |

- **Selection highlight**: Presence color at 20% alpha (`--selection-alpha: 0.2`).

### Radius Hierarchy

- **Controls**: `6px` (`--radius-control`) — Buttons, inputs, menu items, select triggers.
- **Dialogs & Menus**: `10px` (`--radius-layer`) — Modals, popovers, dropdown sheets, toasts.
- **Document Page**: `2px` (`--radius-page`) — Paper is nearly square, like real stationery.

### Depth & Elevation

- **Document Page**: `0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)`
- **Floating Layers**: `0 4px 12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)`
- **Tooltips**: `0 2px 6px rgba(0, 0, 0, 0.1)`
- **Panels & rows**: Hairlines (`1px solid var(--line)`), never box shadows.

---

## 3. Type Scale

All fonts are self-hosted via `@fontsource-variable` packages with zero external CDN dependencies.

### UI Typography (`Hanken Grotesk Variable`)

- `text-ui-xs` (13px, line-height 18px): Badges, tooltips, hints, secondary captions.
- `text-ui-sm` (15px, line-height 20px): Primary UI copy, button labels, inputs, table cells.
- `text-ui-md` (18px, line-height 24px): Section titles, dialog titles.
- `text-ui-lg` (24px, line-height 30px): Page titles, dashboard heading.

### Document Typography (`Source Serif 4 Variable`)

- `text-doc-body` (17px, line-height 1.65): Main prose and paragraphs (measure capped at 75ch).
- `text-doc-h3` (19px, line-height 24px, weight 600): Sub-subheadings.
- `text-doc-h2` (24px, line-height 30px, weight 600): Subheadings.
- `text-doc-h1` (32px, line-height 38px, weight 600): Document title / main heading.

---

## 4. Component Primitives (Radix Foundation)

All components are built on accessible Radix primitives with custom styling and strict keyboard navigation:

1. **Button**: `primary` (solid ink), `secondary` (outlined line on paper), `ghost` (transparent on paper/fog), `danger` (destructive red). States: default, hover, focus-visible, disabled, loading.
2. **IconButton**: Always requires an accessible `label` prop. Renders centered icon with 6px radius, hover wash, and focus ring.
3. **TextInput**: Clean field with sentence-case label, accessible hint, and error message with `--danger` styling.
4. **Dialog**: Accessible modal dialog trapping focus, closing on Escape, with `--paper` background, 10px radius, `--shadow-layer`, and 120ms entrance.
5. **DropdownMenu**: Accessible context menu with item highlights, separators, and destructive item support.
6. **Select**: Accessible dropdown picker with scroll buttons and selected state indicators.
7. **Tooltip**: Compact, high-contrast dark tooltip (`--ink` background, white text) with delay duration.
8. **Avatar**: 28px presence circle with collaborator initials, deterministic presence color fill, and 2px `--fog` ring (or `--ink` ring for active user).
9. **AvatarStack**: Overlapping presence avatars (-8px offset) with tooltip names and `+N` collapse for overflow beyond 4 collaborators.
10. **Toast**: Lightweight notification toast with 10px radius, title, description, and dismiss trigger.
11. **Spinner**: Quiet circular SVG monochrome spinner with `--line` track and `--ink` (or `--paper`) arc.
