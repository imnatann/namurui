# How the Pro items were rebuilt

The first pass at the 79 Pro items was written from `.affectui/llms-full.txt`, the published
prose spec, where `.affectui/` is the workspace-level corpus of artifacts extracted from the
upstream affectui.com site, sitting at the workspace root beside this project rather than
inside it. It produced components that were recognisably *in the same family* and wrong in the
details: invented class names, approximated geometry, motion that read as similar but not the
same. The agent graph was the clearest example: circular avatars instead of squircles, Bézier
curves instead of orthogonal elbows, no legend.

This is the second pass. It does not interpret prose. It extracts the original stylesheets
verbatim, then re-themes and re-times them to NamurUI. The section "What is byte-exact, and
what is not" states exactly where the extraction still holds and where the two later passes
change it.

---

## 1. Capture the real implementation

The original site ships every item's CSS **inside the page**, as a React 19 hoisted style tag:

```html
<style data-href="ui-agent-graph-clean" data-precedence="default">…18,384 bytes…</style>
```

That is the design system itself, not a description of it. So the capture is done with the
Chrome DevTools Protocol against the live page:

```
cdp-chrome  → :9333 ─┐
                     ├─ scripts/extract-item.mjs <kind> <slug>
cdp2        → :9334 ─┘
```

For each item it writes `.affectui/reference/<slug>/`:

| File | What it is | Why it matters |
| --- | --- | --- |
| `component.css` | the item's injected sheet, captured verbatim | the original's structure, geometry, class names and layout rules |
| `prepared.css` | that sheet, plus shared shell chrome where the item is composed | the sheet that gets injected |
| `dom.html` | the rendered subtree | the structural contract |
| `nodes.json` | every element: tag, attributes, computed style, box | geometry and states |
| `keyframes.json` | authored `@keyframes` | real timings |
| `text.txt` | `innerText` | exact copy |
| `meta.json` | root class, sheets, dominance, breakpoints | orientation |
| `reference.png` | 2× screenshot | visual diff target |

79 items, 895 kB of component CSS and 1.43 MB of prepared CSS captured at extraction time.

Colour values and timing functions in those captures are the source's. They are the input to
two later passes, not the shipped output: a re-theme pass remaps the colour values to the
NamurUI Ember palette and a re-time pass repoints the timing functions at the NamurUI motion
tokens (see "What is byte-exact, and what is not").

### Three things the extraction had to get right

**Root classes are not the outermost element.** `screens/app-shell-flat` renders the app shell
and adds 800 bytes of `--frame-gap` overrides, so its "own" sheet cannot be the root. Screens
render *inside* the shell, so their panels (`ui-as-rev`, `ui-as-chat`) are not roots either.
The rule that works: **a sheet is authored tokens-first, so its first selector is its root**;
and screens are captured with `--root .ui-as`.

**Two items share an abbreviation.** `agent-lanes` and `agent-ledger` both ship `.ui-alc`;
`onboarding` collided with `outreach-branches` on `.ui-ob`. On the source site each lives on its
own page so it never shows. In a gallery both sheets are hoisted into one document, so
`scripts/reference-rename.mjs` has been run on one side of each collision: `agent-ledger` ships
`.ui-ald` and `onboarding` ships `.ui-onb`. The same pass moved `agent-ledger`'s `__`-prefixed
children to `.ui-ald__*`; apart from the class tokens themselves, every byte is unchanged.

**Screens are composed.** `ui-screen-agent-chat` is 11 KB of layout that assumes it sits inside
the 26 KB app-shell sheet for its colours and chrome. `scripts/prepare-css.mjs` detects the
variables a sheet reads but never declares, lifts them from the companion, and re-points the
shell's own root rules at the screen so its palette lands correctly.

---

## 2. Split the work at the right seam

Retyping 1.43 MB of production CSS through 79 models would lose fidelity in 79 different ways.
So the seam is:

| Owned by | Artifact |
| --- | --- |
| a subagent, per item | `.tsx` JSX + props API, with a placeholder `const css` |
| `scripts/inject-css.mjs` | the `const css` block, spliced in from `prepared.css` |

The model writes the part that needs judgement (what the DOM is, what the props should be). The
sheet is spliced in from the capture, so its structure, class names and layout rules are the
original's by construction, with no retyping. Colour and timing are then changed by the
re-theme and re-time passes, not by the model.

Each subagent gets `REBUILD.md` (the contract), its own `meta.json`, and its own `dom.html`.
The instruction is explicit: *every class in `dom.html` must appear in your JSX, spelled
identically, in the same nesting order, with the same `data-*` attributes, because the CSS
selects on them.*

---

## 3. Verify with three independent lenses

| Check | What it proves | Script | Result |
| --- | --- | --- | --- |
| Typecheck + build | it compiles | `npm run typecheck`, `npm run build` | 0 errors, clean build |
| Class coverage | the JSX can produce every class the sheet styles | `scripts/class-coverage.mjs` | 79/79 ≥ 90% |
| Structural match | the rendered tree matches the captured one | `scripts/compare-item.mjs` | **79/79** ≥ 85%, most 100% |
| Visual diff | it looks like the original | `scripts/visual-diff.mjs` | 64/79 within 12% at reference width |

Class coverage compares the `ui-*` tokens in `dom.html` against those in the `.tsx`. A class in
the DOM but not in the JSX is a state the component cannot render, and the sheet has dead rules
for it.

The comparator walks the same `tag.class` sequence in both trees, so it catches a missing wrapper,
a dropped `<svg>`, or an element that moved a level, things a class-set comparison cannot see.
It polls for the root rather than assuming a fixed delay, because every demo is a lazy chunk, and
it waits one settle window before measuring, because several items reveal their children on a
timer (a thinking panel, a fan-out grid, a streamed answer) and would otherwise be compared
against an empty shell.

The visual diff screenshots the gallery at 2× and compares against `reference.png` pixel by
pixel, using the browser's own PNG decoder through a canvas. It cannot prove identity, because
antialiasing, font hinting and animation phase all move pixels, but it catches the failures that
matter: missing sheet, collapsed height, stacked instead of gridded.

---

## What is byte-exact, and what is not

The pipeline has three stages: extract, then re-theme and re-time. This is where the byte-exact
property still holds, and where it stops.

**Byte-exact: the extraction.** The capture step writes the page's own stylesheet to
`component.css` byte for byte, and `prepared.css` is that sheet plus the shared shell chrome
named above. Nothing in this step reformats, renames or paraphrases. Every character of the
original sheet, including its class names and its layout rules, arrives intact.

**Byte-exact: the class names and the layout rules.** The sheet that ships is the captured one,
so every selector name, every declaration and every layout rule in it is the original's, apart
from the two renamed abbreviations above. The JSX reproduces the same class set, spelled
identically.

**Not byte-exact: the colour values.** A re-theme pass remaps every colour value in the sheet to
the NamurUI Ember palette. Declarations keep their positions and their roles; the colour literals
inside them change.

**Not byte-exact: the timing functions.** A re-time pass repoints every timing function in the
sheet at the NamurUI motion tokens, so literal `cubic-bezier(...)` values become token
references.

One line, honestly: **structure, geometry and class names are the extracted originals; colour
and timing are re-themed to NamurUI.**

The JSX is a faithful reproduction of the reference DOM, but it is *written*, not decompiled:
where the original's React code held state in a particular shape, the props API here is a
reasonable reconstruction that produces the same DOM. Behaviour that the reference DOM does not
record, such as an internal animation curve not expressed in CSS, or a data flow across
components, is inferred.

That is the honest boundary: **extracted structure and geometry, re-themed colour and timing,
reproduced behaviour.**