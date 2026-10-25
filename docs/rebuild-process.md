# Task template used for the 79 rebuild subagents

Each subagent receives one item. The task text is generated from the manifest so it carries the
slug, the kind and the root class, and it points at `REBUILD.md` for the contract. The paths it
reads live in `.affectui/`, the workspace-level corpus of artifacts extracted from the upstream
affectui.com site, which sits at the workspace root beside this project rather than inside it.

```
# Target
Rebuild the Pro item `<slug>` (`<kind>`) so it renders the same DOM as the original.

# Read, in this order, do not skip
1. `REBUILD.md`: the contract. Follow it exactly.
2. `.affectui/reference/<slug>/meta.json`: `rootClass` is `<root>`. Use it verbatim.
3. `.affectui/reference/<slug>/prepared.css`: the sheet that gets injected afterwards. Every
   class name you write MUST exist in it; if you invent one, it will render unstyled.
4. `.affectui/reference/<slug>/dom.html`: the DOM you must reproduce, element for element.
5. `.affectui/reference/<slug>/nodes.json`: computed style and box for every element, so you
   know which values are inline (`--d`, `transform`, `height`) and which come from the sheet.
6. `.affectui/reference/<slug>/text.txt`: the exact copy.

# Change
Write exactly two files:
- `src/namurui/<slug>.tsx`
- `src/namurui/demos/<slug>.tsx`

The component's `const css` block must stay LAST and must contain only the placeholder comment:
the orchestrator injects the extracted stylesheet into it afterwards. Do not write CSS by hand.

Structural requirements:
- Root element carries `className={["<root>", className].filter(Boolean).join(" ")}`.
- Reproduce every class in `dom.html`, in the same nesting order, with the same `data-*`,
  `aria-*` and `role` attributes.
- Copy inline SVG paths verbatim from `dom.html`, including brand marks and `viewBox`.
- Distinguish the states the CSS selects on (`data-status`, `data-view`, `aria-checked`,
  `data-open`, …) and drive them from props with sensible defaults.

API requirements:
- `export type <Name>Props` with a `/** */` on every field.
- Props must be able to express what the reference DOM shows. Where the original clearly held
  state (drums, selections, uploads, live timers), expose the value and an `onChange`.
- Renders standalone with no props: supply a small default dataset inside the component so the
  gallery preview is not empty. The demo may pass richer data.

# Acceptance
- `<root>` appears as the root class; every class in `dom.html` appears in your JSX.
- `npm run typecheck` is not run by you; the file must parse and use no `any`.
- The demo mounts with zero props and exercises the real handlers.

# Do not
- Do not write or edit the `css` block beyond the placeholder.
- Do not touch any file other than the two above.
- Do not run npm, tsc, vite, linters or formatters.
```

## Why the placeholder

Every item's own sheet is roughly 1 KB to 31 KB of production CSS, and a composed screen's
injected sheet runs past 80 KB. Asking 79 models to retype that would lose fidelity in 79
different ways. `scripts/inject-css.mjs` writes the extracted text in, so the sheet's structure,
class names and layout rules are the original's by construction, and the model's job is reduced
to the part that actually needs judgement: the JSX and the props API.