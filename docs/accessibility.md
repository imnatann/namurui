# Accessibility

What is built in, how to re-measure contrast now that the palette has changed, and what is not done.

## Built into every component

| Concern | How it is handled |
| --- | --- |
| Semantics | Real `<button>`, `<input>`, `<a>`, `<ul>`, `<table>`, plus `role="dialog"` (11 item sheets), `role="tree"`, `role="listbox"`. No clickable `<div>`s. |
| Keyboard | Every interactive surface is reachable and operable by keyboard. Lists and grids manage focus with `tabIndex` (69 item sheets), 70 sheets move focus programmatically (for example into an open command menu's input), and dialogs close on `Escape` (66 item sheets). |
| Focus | `:focus-visible` rings are the default: the page layer sets `outline: 2px solid var(--accent)` with `outline-offset: 2px`, and 129 item sheets carry focus rules of their own. All 60 sheets that clear the browser ring with `outline: none` supply a replacement. |
| Live regions | Changing text is announced with `aria-live` (95 item sheets). 54 use `role="status"`, which is implicitly polite; `trace-waterfall` announces its status through an `aria-live="polite"` pill. |
| Status | Never colour alone. Every state carries a shape, an icon or a word (`Needs you`, `Failed`, `Done`). |
| Reduced motion | A `@media (prefers-reduced-motion: reduce)` block in 176 of the 181 item files, plus the floor in `src/styles/motion.css`. Four more (`frost-cloud`, `glow-cloud`, `lead-sourcing`, `model-wheel`) animate from JavaScript, which a media query cannot reach, so they check `matchMedia("(prefers-reduced-motion: reduce)")` before they start. The last one, `highlight-band`, carries neither a media block nor a JavaScript guard, because it animates nothing and has no motion to reduce. Motion stops either way, the end state stays correct, and ambient decoration is removed rather than frozen. |
| Dark mode | `:where(.dark, [data-theme="dark"])` rules in 180 of the 181 item files, overriding custom properties only. The exception is `project-flow`, which themes itself through a component-scoped `.ui-pf[data-theme="light"|"dark"]` mechanism instead, faithfully to the extracted original. |
| Layout | 72 item sheets measure with `ResizeObserver`; the layouts hold from 320px to 1920px and under zoom. |

## Contrast

### The palette changed, so the old figures are out of date

NamurUI ships the Ember palette. The measurements this document used to carry (the node counts
across the demos, and the per-pair ratios behind them) were taken against the previous palette and
no longer describe what ships. They are not reproduced here. The figures below are the ones
measured after the re-theme, in a real browser.

Read them as rates per route, not as bare totals: the pre-re-theme baseline and the current audit
cover different numbers of routes and a different number of themes, so the two sets of totals are
not comparable on their own.

### How to re-measure

`scripts/audit-contrast.mjs` exports `auditContrast`, a snippet that is meant to run inside the
page (browser MCP or Playwright), not in Node. It walks every route in `/src/gallery/manifest.json`,
collects the text nodes inside `.g-preview`, resolves each node's effective backdrop by compositing
its ancestor chain, and skips anything painted over a gradient or an image, since the backdrop
there is not a single colour and a ratio would be meaningless. A pair is reported when it misses
the threshold: 4.5:1 for normal text, 3:1 for large text (24px, or 18.66px at weight 700). The
result is `{ slug: [{ fg, bg, ratio }] }`.

```bash
# 1. print the snippet, then evaluate it in the running gallery
node -e "import('./scripts/audit-contrast.mjs').then(m => console.log(m.auditContrast))"
# 2. save its result as .tmp/contrast-dom.json one level above the package directory, then rebuild the sheet
node scripts/gen-high-contrast.mjs
```

Single pairs can be checked without a browser: take the two values from `src/styles/tokens.css` and
apply the standard sRGB relative-luminance formula, `(L1 + 0.05) / (L2 + 0.05)`.

### Token pairs, measured

The figures below are measurements of the shipped token values, one token against the ground it is
placed on, using the formula above. They describe the palette in `src/styles/tokens.css`, not the
rendered demos: a component whose sheet hard-codes its own palette is not covered by them.

Light theme:

| Pair | Values | Ratio | AA normal text |
| --- | --- | --- | --- |
| `--text` on `--bg` | `#1a1410` on `#faf7f4` | 17.09:1 | pass |
| `--text-muted` on `--bg` | `#6f625a` on `#faf7f4` | 5.51:1 | pass |
| `--text-muted` on `--card` | `#6f625a` on `#ffffff` | 5.88:1 | pass |
| `--text-subtle` on `--bg` | `#1a141099` on `#faf7f4`, compositing to `#746f6b` | 4.65:1 | pass |
| `--accent` on `--bg` | `#c2410c` on `#faf7f4` | 4.85:1 | pass |
| `--accent-fg` on `--accent` | `#fffdfb` on `#c2410c` | 5.10:1 | pass |
| `--primary-fg` on `--primary` | `#fffdfb` on `#1a1410` | 17.97:1 | pass |
| `--success` on `--card` | `#1a7a4a` on `#ffffff` | 5.35:1 | pass |
| `--warning` on `--card` | `#9a6410` on `#ffffff` | 4.99:1 | pass |
| `--danger` on `--card` | `#b3261e` on `#ffffff` | 6.54:1 | pass |

Dark theme:

| Pair | Values | Ratio | AA normal text |
| --- | --- | --- | --- |
| `--text` on `--bg` | `#f4ece4` on `#14100d` | 16.19:1 | pass |
| `--text` on `--card` | `#f4ece4` on `#201a15` | 14.73:1 | pass |
| `--text-muted` on `--bg` | `#a2958a` on `#14100d` | 6.49:1 | pass |
| `--text-muted` on `--card` | `#a2958a` on `#201a15` | 5.90:1 | pass |
| `--text-subtle` on `--bg` | `#f4ece48c` on `#14100d`, compositing to `#8f8983` | 5.47:1 | pass |
| `--accent` on `--bg` | `#ff6b35` on `#14100d` | 6.67:1 | pass |
| `--accent` on `--card` | `#ff6b35` on `#201a15` | 6.07:1 | pass |
| `--accent-fg` on `--accent` | `#1a0f08` on `#ff6b35` | 6.64:1 | pass |
| `--primary-fg` on `--primary` | `#14100d` on `#f4ece4` | 16.19:1 | pass |
| `--success` on `--card` | `#4f9d6e` on `#201a15` | 5.23:1 | pass |
| `--warning` on `--card` | `#d99530` on `#201a15` | 6.80:1 | pass |
| `--danger` on `--card` | `#e87068` on `#201a15` | 5.70:1 | pass |

`--text-subtle` is translucent, so its rows use the composited colour: `#1a141099` over `#faf7f4`
is `#746f6b`, and `#f4ece48c` over `#14100d` is `#8f8983`. Both clear AA as normal text, at 4.65:1
and 5.47:1, but the light one has almost no headroom and the token stays reserved for decorative and
disabled marks. Among the solid inks the narrowest pass in the set is light `--accent` at 4.85:1, so
do not place it at reduced opacity either.

### The demo audit, measured

Run by the procedure above, in a real browser, after the re-theme and across both themes. It walks
every route in the gallery and reports the text pairs that miss AA (4.5:1 normal text, 3:1 large).

| Theme | Routes with failing pairs | Failing text pairs | Failing pairs per route |
| --- | --- | --- | --- |
| Light | 82 of 181 | 1,287 | 7.11 |
| Dark | 69 of 181 | 977 | 5.40 |

Measured over 5,563 text pairs in light and 5,562 in dark. Twenty-one of the 181 routes are outside
the audit: in each of them no text node resolves to a single opaque backdrop, because the text sits
on a gradient or an image or the route carries no text, so the route is recorded as zero coverage
rather than as passing. They are 10 of the 24 illustrations, `logo-marquee`, 6 of the 8 motion
pieces, and the three webview items `compaction-divider`, `connection-banner` and `ghost-text`. The
twenty-first is `process-steps`, which paints no ground of its own, so its text sits on the
gallery's preview gradient. Those three were checked against both stops of the preview gradient by
hand, where muted ink measures 5.52 to 5.90:1 and body ink 13.78 to 14.73:1.

One correction to the method. The earlier audit composited stacked translucent layers by forcing
alpha to 1 after each step, so the first wash a text node sat inside became its reported backdrop
and the result was a ratio of exactly 1.0:1. It mis-attributed which token failed and inflated the
count. Compositing now preserves accumulated alpha and keeps climbing to the opaque surface behind
the wash. The figures above are from the corrected rule, and are not comparable with the earlier
ones.

### The opt-in layer, measured

`data-contrast="high"` was measured against the regenerated sheet, in both themes, over all 181
routes:

| theme | failing pairs, layer off | failing pairs, layer on | reduction |
|---|---|---|---|
| light | 1,287 | 740 | 42.5% |
| dark | 977 | 425 | 56.5% |

The last batch of 24 routes moved neither the totals nor the sheet, because the 9 light and 5 dark
failures the new components introduced were fixed in the components themselves rather than in the
layer.

It closes 42 percent of the remaining gap in light and 57 percent in dark, and never opens a new
one. It does not reach zero: the layer can only move tokens, so text coloured by a hard-coded
literal in a component sheet, and text whose contrast comes from a gradient or image backdrop, is
outside its reach.

## The opt-in layer

`src/styles/high-contrast.css` raises **only** the tokens an audit measured as failing text, each to
the nearest value that clears 4.5:1 on the surface it was measured against. Surfaces, lines and
shadows are never touched. It is opt-in: a host turns it on to lift the failing pairs to AA without
changing what the default palette renders.

```html
<html data-contrast="high">          <!-- every component on the page -->
<div class="ui-tc" data-contrast>    <!-- one component only -->
```

The gallery's rail has a toggle for it, labelled "High contrast". The sheet is generated by
`scripts/gen-high-contrast.mjs` from `.tmp/contrast-dom.json` one level above the package directory
(the workspace root), so regenerate it after any palette change instead of editing it by hand. It
emits a light block and a theme-scoped dark block; the dark block must list every token the light
block sets, otherwise a light-mode fix leaks onto a dark ground and makes contrast worse. Both blocks
are generated from a per-theme audit, and the direction of each adjustment follows the backdrop: text
is darkened on a light surface and lightened on a dark one.

## Two cascade traps

Both were found by the contrast audit, and both are worth checking whenever a palette or a root
class changes.

1. **A generic `button` reset outranks a part rule.** `.ui-x button { color: inherit }` weighs
   (0,1,1) and beats a rule that colours the button itself at (0,1,0), so a button can render its
   label in the same colour as its fill. The fix is `:where(button)`, which contributes no selector
   weight: 5 item sheets write the reset that way, and 14 rules across 13 item sheets still carry
   the plain form with `color: inherit`, so their button labels are worth a look when their colours
   change.
2. **A shared root class.** Two items must not root on the same class: mounting both lets one
   sheet restyle the other, and an override meant for one lands on both. `agent-graph` roots on
   `.ui-aggc` so it no longer collides with `agent-gallery`'s `.ui-ag`, but two pairs still share:
   `tilt-card` and `tool-call-card` both root on `.ui-tc` (and both declare `--ui-tc-*`), and
   `ghosted-chat` and `glow-cloud` both root on `.ui-gc`. Do not mount one of those pairs in the
   same document.

## What is not done

- No automated axe or Lighthouse pass in CI. The sweep in `scripts/` covers contrast, mount errors
  and layout collapse, not ARIA correctness.
- Screen-reader testing has not been performed. The ARIA in each component follows its published
  spec, but it has not been verified with VoiceOver or NVDA.
- Some charts (`kpi-chart`, `trace-waterfall`, `analytics`) convey trend through shape and position.
  `kpi-chart` and `analytics` give the plot a labelled keyboard readout (its group is labelled
  "use the arrow keys to read the values per day"), `trace-waterfall` announces its status through
  an `aria-live="polite"` pill, and `breakdown-chart` labels its sections and slices. A full
  data-table alternative is present only in `breakdown-chart`.