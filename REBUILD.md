# Rebuild from the extracted reference

This project reproduces the upstream affectUI library as **NamurUI**. For the **Pro** items the CSS
and DOM have been extracted from the live pages at `affectui.com` with CDP, so the original
implementation is available as evidence, not as a written spec to interpret.

**A component is correct when its rendered DOM and its stylesheet match the reference** for
structure and geometry, and when nothing you author contradicts the NamurUI *Ember* identity
documented in [`DESIGN.md`](./DESIGN.md).

---

## The identity you are writing into

The extracted sheet already carries the reference's own colour and timing, and the orchestrator
re-themes it afterwards: colour literals are remapped to the Ember palette and timing functions
are repointed at the motion tokens in `src/styles/motion.css`. You do not choose colours or curves
by hand, and you do not run either pass yourself.

What you must get right, from [`DESIGN.md`](./DESIGN.md):

- Warm charcoal ground, warm off-white text, one ember accent (`#ff6b35`) that marks the single
  live thing on screen. The accent is never a status colour; status uses the semantic trio
  (success, warning, danger).
- Motion is information: it shows work happening over time, so it is never decorative filler.
- Animate `transform` and `opacity` only, and never write a bare `ease`.
- Enter with `--nm-ease-out`, leave with `--nm-ease-in`, ambient loops with `--nm-ease-soft`,
  and take every duration from the `--nm-dur-*` scale. Any motion you write yourself reads
  `var(--nm-<token>, <literal>)` with the literal carried inline, because a component must
  animate in a host page that never loads `motion.css`.
- Never inline a colour in JSX. Set a CSS custom property or a `data-*` attribute and let the
  sheet do the rest.

---

## Where the evidence is

`.affectui/reference/<slug>/`, the workspace-level directory of artifacts extracted from the
upstream site (it sits next to the project, not inside it, and the scripts in `scripts/` read it
by that path).

| File | What it is |
| --- | --- |
| `component.css` | the item's own injected stylesheet, as captured from the live page |
| `component.pretty.css` | the same CSS, one rule per line: read this one |
| `dom.html` | the rendered subtree, exactly as React produced it |
| `nodes.json` | every element: tag, attributes, computed style, box (x, y, w, h) |
| `text.txt` | `innerText`, so all copy is exact |
| `meta.json` | `rootClass`, `styleHref`, `cssBytes`, `keyframes`, `breakpoints`, `sheets`, `dominance`, `companions` |
| `prepared.css` | **the sheet to inject**: the item's own CSS, plus any shared shell chrome it is composed from |
| `keyframes.json` | authored `@keyframes` with real timings |
| `reference.png` | 2× screenshot of the original |
| `companion-*.css` | sheets the item leans on (screens sit inside the app shell) |

Read `meta.json` first for `rootClass`, then `prepared.css`, then `nodes.json`, then `dom.html`.
`nodes.json` is the ground truth for geometry and DOM shape; treat the colour values it records as
the input to the re-theme, not as the target. The target palette is `DESIGN.md`.

`meta.json.sheets` lists every stylesheet on the page with the classes it styles, and
`meta.json.dominance` lists which class wraps the most of them. Some items are **composed**: for
`screens/app-shell-flat`, `ui-app-shell-flat` is only 800 bytes of overrides on top of the
26 KB `ui-app-shell` sheet. `prepared.css` already contains both, so you do not have to decide
anything: just use it.

---

## What you write

**`affectui/src/namurui/<slug>.tsx`**: the component. One self-contained file. Paths in this file
are written the way the workspace uses them: the project directory is still named `affectui/`, the
module directory inside it is now `src/namurui/`, and the extracted artifacts live in the
workspace-level `.affectui/` directory described above.

```
"use client";

import { … } from "react";

/* Doc comment: what it is, how it moves. */

export type <Name>Props = { /* fields with /** */ each */ };

export function <Name>({ … }: <Name>Props) {
  return (
    <… className={["<rootClass>", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-<slug>" precedence="default">
        {css}
      </style>
      …JSX that produces the reference DOM…
    </…>
  );
}

/* icons and helpers */

const css = /* css */ `
/* placeholder: scripts/inject-css.mjs replaces this block with component.css */
`;
```

### The CSS block is not yours to write

Leave the `const css = /* css */ \`…\`;` block exactly as shown, with a placeholder inside.
The orchestrator replaces it with the extracted stylesheet afterwards, then re-themes its colours
and repoints its timing. **Never retype or summarise the reference CSS**: doing so is how fidelity
is lost. The block must exist and must be the last statement in the file.

Use the reference CSS to learn the class names, states and attribute selectors your JSX has to
produce.

---

## Hard rules

- **Exact class names.** `meta.rootClass` is the root. Every class in the reference DOM must
  appear, spelled identically. The CSS selects on them; a renamed class renders unstyled.
- **Exact DOM shape.** Same nesting order, same `data-*` attributes, same `aria-*`, same SVG.
  Copy the structure out of `dom.html`.
- **React 19 only.** Imports from `"react"` and nothing else. No Tailwind, no animation
  library, no icon package, no `clsx`.
- **Icons are inline SVG.** Lift the real paths from `dom.html`, brand marks included. Keep
  `viewBox` and `fill`/`stroke` as the original has them.
- **Behaviour lives in props.** The original drove its demo with state. Give your component a
  props API that can express what the DOM shows (`nodes`, `calls`, `value`, `onChange`, …), with
  sensible defaults so it renders standalone.
- **No `any`.** Discriminated unions for variants.
- **Colours come from the CSS.** Never hardcode a colour in JSX; set a CSS custom property or a
  `data-*` attribute and let the sheet do the rest. The sheet's own colours are not yours either:
  the re-theme pass owns every literal in it.
- **Geometry that the original set inline** (`--d`, `--i`, `transform: translate3d(…)`, `height`)
  must be set inline the same way, with the same CSS custom property names.
- **Reduced motion and dark mode are already in the extracted CSS.** Do not add your own
  blocks; the reference already has them.

---

## The demo

**`affectui/src/namurui/demos/<slug>.tsx`**: `export default function Demo()`, no props.

- Keep an existing demo if it still typechecks against your props API; otherwise rewrite it.
- Realistic content, real handlers, no lorem ipsum, no "Item 1".
- The demo must produce a DOM as close to the reference as the reference's own demo did:
  same number of rows, cards, chips in the same states where the reference shows them.

---

## Do not

- Do not touch any file other than your component and its demo.
- Do not edit `src/gallery/*`, `src/styles/*`, `package.json`, `tsconfig.json`, `vite.config.ts`.
- Do not run `npm`, `tsc`, `vite`, linters or formatters. Syntax-check your own file by eye; the
  orchestrator runs the gates.
- Do not fabricate a `data-*` state the CSS does not select on.
- Do not write a colour literal or a hand-rolled easing curve of your own anywhere.