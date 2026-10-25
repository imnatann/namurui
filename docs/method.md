# How this reconstruction was made

The goal was a complete, usable copy of the original library: the same items, the same shapes, the
same motion patterns, droppable into a site without buying anything or touching the original. Shape
and geometry were taken from the extraction as published; colour and timing are re-themed to
NamurUI, and section 5 spells out what each of those covers.

## 1. Read the catalogue, not the marketing

The site publishes three machine-readable surfaces, and they carry everything needed:

| Surface | What it gives |
| --- | --- |
| `llms.txt` | all 119 upstream items with slug, category, tier and a one-line description |
| `llms-full.txt` (423 KB) | per item: when to use, when not to, a usage example, the **full props table**, keyboard map, accessibility contract, motion description, responsive behaviour, CSS variable names |
| `/r/<slug>.json` | the shadcn registry item: for free items, the complete `.tsx` source |

Locally, those two files are `.affectui/llms.txt` and `.affectui/llms-full.txt`; `.affectui/`
is the workspace-level corpus of artifacts extracted from the upstream affectui.com site,
sitting at the workspace root beside this project rather than inside it.

The corpus holds the 119 upstream items, which are the `Free` and `Pro` rows of this library.
The library itself ships 181, because 62 `Core` items were written here and have no upstream
counterpart; the 24 newest of them were written from a surface audit of `chatrigo.id` rather than
from upstream, recorded in `15-chatrigo-surfaces.md`. The provenance table in `README.md` breaks
that down by tier.

Fetching the 40 free registry items produced 40 files and 16,434 lines of TypeScript. Every
one of them is `"use client"`, imports only from `react`, declares its props type inline, and
injects its CSS through `<style href="ui-<slug>" precedence="default">{css}</style>`. That
uniformity is what made the rest mechanical: the conventions are not a style guide someone
wrote, they are a property of the corpus.

`/r/<slug>.json` for a Pro item answers `401` with a JSON error naming the access key
requirement. No attempt was made to work around that.

## 2. Derive the house style from the corpus

`CONVENTIONS.md` was written by measuring the 40 MIT originals shipped in `src/namurui/`
rather than guessing:

```
40 files        (the MIT originals in this repository)
16,434 lines
40/40  "use client" as line 1
36/40  a CSS prefers-reduced-motion block; 4 guard in JavaScript instead
40/40  a :where(.dark, [data-theme="dark"]) block, 16 as one block and 24 once per rule
38/40  the dark block is last in the sheet, or followed only by a reduced-motion guard
14/40  ResizeObserver
14/40  requestAnimationFrame
12/40  IntersectionObserver
183×   cubic-bezier(0.22, 1, 0.36, 1) across 32 files
```

The original measurement also covered four clean-style variants of these items. They are not
shipped in this repository, so they are not counted above.

Those numbers became the rules. Anything that broke one of them would not look like the
library even if it worked.

## 3. Build the shell first, so every file is verifiable on arrival

The gallery was finished and green before a single component was written. It discovers files
by glob, so a component and its demo appear the moment they are saved. That turned 181
independent item files into one continuously checkable surface: typecheck, build, and a browser
sweep that walks every route.

## 4. Reimplement the Pro items from the spec

Each Pro item's spec pins its public API (prop names, types, defaults) and describes its
motion and accessibility contract in prose. The reimplementations follow the API literally and
the prose closely, and are marked `Pro` everywhere they appear: in the gallery badge, in
`docs/catalogue.md`, and in the README's provenance table.

They are independent implementations, not the originals. If a Pro item earns a place in a
shipped product, buy it.

## 5. What "same style, motion and shape" means concretely

These are the equivalence rules the first pass was written against. Shape and geometry still
hold, apart from the one-step radius softening described in `DESIGN.md`. Colour and timing no
longer do: a re-theme pass remaps every colour value to the NamurUI Ember palette and a re-time
pass repoints every timing function at the NamurUI motion tokens (see `docs/rea-rebuild.md`).

- **Shape**: the same radii scale (`12 / 16 / 20 / 999`), one step softer than the source's,
  the same hairline-over-border technique (`inset 0 0 0 1px`), the same padding rhythm, the
  same 40/32/48 button heights.
- **Style**: the source palette (`#171717` ink, `#fafafa` paper, `#e5e5e5` hairlines, the
  pink to violet Pro gradient) was what the first pass aimed at. It is not what ships: the
  re-theme pass replaces those literals with the Ember palette. The Inter stack with `-0.01em`
  tracking and the antialiasing are unchanged.
- **Motion**: the source's four curves, duration bands and seven patterns (glide to the new
  place, blur as an entrance, one shimmer per group, digits that roll, positions measured from
  the element, loops that pause, exits faster than entries) were what the first pass aimed at.
  The re-time pass now points them at the NamurUI motion tokens. See `docs/motion.md`.

## 6. Verification

- `npm run typecheck`: strict, no `any`.
- `npm run build`: production bundle.
- Browser sweep: every route mounted, preview measured for height, console watched for errors.
- Each component checked in both themes and at 320 px, 768 px and 1440 px.