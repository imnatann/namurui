# Theming

NamurUI ships one identity, called **Ember**: warm charcoal surfaces, unbleached paper in light
mode, and a single ember-orange accent reserved for the one thing that is currently live. Every
value lives in `src/styles/tokens.css` as a plain CSS custom property, so a host re-themes the
library without a provider, a theme object or a build step.

The library ships four stylesheets: `tokens.css`, the page layer documented here; `motion.css`, the
durations and curves described in `motion.md`; `gallery.css`, chrome for the docs site; and
`high-contrast.css`, an opt-in layer a host turns on with `data-contrast="high"` on the root.
`motion.css` is the sheet that makes `--ease` below resolve.

There are two levels of variables and they behave differently. Read both before overriding
anything: an override only lands where the sheet you are targeting actually reads that variable.

## Level 1: page tokens (`src/styles/tokens.css`)

Declared on `:root` and re-declared for dark. This is the surface the gallery and a host app sit
on, and the layer a consumer styles their own layout with.

### Ground (the surface ramp)

| Token | Light | Dark |
| --- | --- | --- |
| `--bg` | `#faf7f4` | `#14100d` |
| `--panel` | `#fffdfb` | `#1a1512` |
| `--card` | `#ffffff` | `#201a15` |
| `--preview` | `#fdfaf7` | `#26201a` |
| `--muted-bg` | `#7a4a1c0a` | `#ffffff0d` |
| `--hover-bg` | `#7a4a1c12` | `#ffffff12` |

The dark ramp is four steps (`--bg` → `--panel` → `--card` → `--preview`), each one a step
lighter and warmer than the one before, so elevation reads as heat rather than as a drawn line.
Light mode is parchment, not white, so the theme switch changes brightness without changing
identity. `--muted-bg` and `--hover-bg` are translucent washes: warm ink at 4% and 7% over paper
in light, white at 5% and 7% over charcoal in dark.

### Text

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--text` | `#1a1410` | `#f4ece4` | body, headings |
| `--text-muted` | `#6f625a` | `#a2958a` | captions, timestamps, secondary labels |
| `--text-subtle` | `#1a141099` | `#f4ece48c` | decorative and disabled marks |

`--text-subtle` is a translucent ink (60% in light, 55% in dark). Composited over the ground it
measures 4.65:1 in light and 5.47:1 in dark, so it is readable but tight; it stays on decorative and
disabled marks rather than text that has to be read. `accessibility.md` carries the measured pairs.

### Lines and strokes

`--border` (`#e8e0d7` light, `#33291f` dark) is the standard hairline. `--border-soft`,
`--card-stroke`, `--panel-stroke` and `--tier-stroke` are the softer variants used inside stacked
surfaces. In dark they are alpha whites: a solid lighter line on charcoal reads as a stripe, an
alpha white reads as an edge.

### Roles

| Token | Light | Dark |
| --- | --- | --- |
| `--primary` | `#1a1410` | `#f4ece4` |
| `--primary-fg` | `#fffdfb` | `#14100d` |
| `--accent` | `#c2410c` | `#ff6b35` |
| `--accent-hover` | `#9a3412` | `#ff8256` |
| `--accent-fg` | `#fffdfb` | `#1a0f08` |
| `--accent-soft` | `#c2410c1a` | `#ff6b3524` |

The primary pair inverts. A dark chip on a dark page disappears, so in dark mode `--primary` is the
warm off-white and `--primary-fg` is the ground colour. The accent is a burnt orange on paper
(`#c2410c`) and a brighter ember on charcoal (`#ff6b35`), because one orange cannot clear AA on
both grounds.

### Semantic

| Token | Light | Dark |
| --- | --- | --- |
| `--success` | `#1a7a4a` | `#4f9d6e` |
| `--warning` | `#9a6410` | `#d99530` |
| `--danger` | `#b3261e` | `#e87068` |

Ember orange is reserved for `--accent` and is never reused as a status colour, so "live" and
"warning" can appear on the same screen without ambiguity.

### The rest of the page layer

- `--guarantee-bg`, `--guarantee-tray`: the inset tray fills used by gallery chrome.
- `--pro-bg`, `--pro-from`, `--pro-to`: the Pro badge wash and its two gradient stops.
- `--font-sans` (Inter), `--font-display` (Georgia), `--font-mono` (`ui-monospace`). Georgia is for
  gallery display headings only, never inside a component.
- `--radius-panel` `20px`, `--radius-card` `16px`, `--radius-preview` `12px`, `--radius-pill`
  `999px`.
- `--panel-shadow`, `--shadow-card`, `--shadow-pop`. The dark values are re-cut rather than
  darkened, since a black shadow on warm charcoal greys the surface it is meant to lift.
- `--grain` (an inline SVG turbulence data URI) and `--grain-opacity` (`0.035` light, `0.05` dark),
  applied through the `.nm-grain` class.
- `--code-keyword`, `--code-string`, `--code-comment`, `--code-number`, `--code-function`,
  `--code-type`: six syntax roles for a code panel, warm-shifted so a code block keeps the
  identity's heat. Each one clears 4.5:1 on `--preview` in its own theme.
- `--ease`: `var(--nm-ease-out)`, an alias for the entering curve. It resolves because the gallery
  loads `motion.css` alongside this sheet; thirteen screen sheets shadow the same name locally
  (`--ease: cubic-bezier(0.22, 1, 0.36, 1)`) instead of reading it. See `motion.md`.

## Level 2: component tokens

Every component declares its own scope on its root class, prefixed with the component's
abbreviation; the ellipses below stand for the literal values in that sheet. A screen that composes
a component carries that component's own block as well, under a comment saying it is composed into
this item.

```css
.ui-button { --ui-btn-ink: …; --ui-btn-line: …; --ui-btn-fill: …; }
.ui-tc     { --ui-tc-ink: …; --ui-tc-line: …; --ui-tc-ease: cubic-bezier(0.22, 1, 0.36, 1); }
```

Override only what you need. In this example `--ui-tc-line` is the card's inset hairline:

```css
.ui-tc { --ui-tc-line: #33291f; }
```

The full set for an item is the declaration block at the top of the `const css` template at the
bottom of that item's `.tsx` file. There is no separate index of variables; `docs/catalogue.md`
lists props, not variables.

## The catch: component sheets carry literals

A component's sheet is self-contained. It declares its palette as literal colour values on its own
root class and does not read the page tokens. Two consequences:

1. Overriding a page token re-themes the gallery chrome, which reads `var(--text)`,
   `var(--border)`, `var(--card)`, `var(--hover-bg)` and friends, and any token-aware surface such
   as a demo wrapper that paints itself with `var(--bg)`. It does **not** reach a component whose
   sheet hard-codes its own palette.
2. Several component sheets reuse the short names the page layer uses (`--card`, `--panel`,
   `--text`, `--accent`, `--radius-panel`) on their own root class. Such a declaration shadows the
   page token for that whole subtree, whether or not you wanted it to. A page-level `--card`
   override therefore misses those components, and a component-level `--card` override never leaks
   out of it.

To re-theme a component, override its own `--ui-x-*` variables. That is the whole override
mechanism: there is no other channel into a component's palette.

## Dark mode

One convention, no JavaScript in the library:

```html
<html class="dark">        <!-- class convention -->
<html data-theme="dark">   <!-- attribute convention -->
```

`tokens.css` matches both, `[data-theme="dark"]` and `.dark`, and re-declares every colour token
plus `color-scheme`, so form controls and scrollbars follow the theme. 180 of the 181 item files
mirror it with rules of this shape (repeated once per rule in most sheets, rather than written as a
single block):

```css
:where(.dark, [data-theme="dark"]) .ui-x { /* custom-property overrides only */ }
```

`:where()` contributes no selector weight, so your own override still wins.

`project-flow` is the one exception. It is an illustration whose extracted original themed itself,
so its sheet carries no document-level selector at all: it takes a `theme` prop, writes it to
`data-theme` on its own root, and keys its scoped variables off `.ui-pf[data-theme="light"]` and
`.ui-pf[data-theme="dark"]`. Give that component the theme explicitly.

Nothing in the library reads `prefers-color-scheme` itself: the decision belongs to the host. The
gallery's `index.html` reads `localStorage.theme` before first paint and sets both the attribute and
the class from it, with an explicit store changing both together in `App.tsx`. With nothing stored
it opens dark rather than following the system, because Ember is a warm-dark identity.

## Fonts

Inter is self-hosted as woff2 under `public/fonts/`, at 400/500/600/700, declared with `@font-face`
at the top of `tokens.css`. Body type is 15px with `line-height: 1.5`, `letter-spacing: -0.011em`
and `-webkit-font-smoothing: antialiased`. Nothing is fetched from a CDN at runtime. If your page
already loads Inter, the components use yours.

## Contrast

Every pair a consumer is likely to combine is measured in `accessibility.md`, together with the
command that re-measures them after a palette change. Two rules the palette relies on:
`--text-subtle` never carries information on its own, and status is never conveyed by colour alone.