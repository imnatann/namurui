# Coherence audit

What was checked across the 157 items, what was wrong, and what the tree does now. Every
figure here was measured on the tree after the fixes, not before.

The audit ran eight parallel passes over the same 157 files: semantic duplication, class
prefix hygiene, token coherence, demo fidelity, docs drift, prop API consistency, gallery
wiring, and composition fit. The four that found structural defects are below. The four
that found only naming drift are recorded in [`CONVENTIONS.md`](../CONVENTIONS.md) under
`## Host vocabulary`.

## The mechanism that made collisions matter

Every component ships its own `<style href precedence="default">`. React 19 hoists those
into `<head>` and **never removes them**. Measured in the browser: after visiting
`glow-cloud`, `ghosted-chat` and `frost-cloud`, `<head>` holds six item sheets and they
stay there. Visiting more routes keeps adding.

So the gallery's original assumption, that one item renders at a time and collisions can
never show, is false. Any class two components both define is live at once, and the winner
depends on route order. That is what turned four latent name clashes into four real ones.

## The four real collisions, all fixed

Each pair was confirmed by driving the gallery: visit one item, then the other, and read
the computed style.

| Class | Owners | What the second one got | Fix |
| --- | --- | --- | --- |
| `.ui-ob` | `onboarding`, `outreach-branches` | `display: grid`, `padding: 52px 40px 64px` from the onboarding page grid, on an illustration that should be `display: block` at `aspect-ratio: 3 / 2` | `onboarding` renamed to `.ui-onb`, 305 tokens |
| `.ui-alc__*` | `agent-ledger`, `agent-lanes` | four children collided with different bodies: `__bar` got `padding: 14px 16px` **and** `margin-bottom: 16px` at once | `agent-ledger` children renamed to `.ui-ald__*`, 94 tokens |
| `.ui-gc` | `glow-cloud`, `ghosted-chat` | glow-cloud's palette block sat on ghosted-chat's root, and glow-cloud's own element matched nothing, so its sky never painted | `glow-cloud` sheet renamed to `.ui-glc`, 4 selectors |
| `.ui-tc` | `tilt-card`, `tool-call-card` | `display: block; position: relative; padding: 0` from the tool-call card, on a card that needs `display: inline-block` with a `perspective` | `tilt-card` renamed to `.ui-tlt`, 26 tokens including its own custom properties |

The first two were the interesting ones: `docs/rea-rebuild.md` claimed
`scripts/reference-rename.mjs` had renamed them, and it had not. The script's boundary
pattern `(?<![\w-])old(?![\\w-])` refuses to match `.ui-ob-head`, because the hyphen after
`ui-ob` fails the negative lookahead. It could only ever rename a bare root, so every
BEM child kept the colliding prefix. The guard is now `(?![A-Za-z0-9]|_(?!_))`, which keeps
`-` and `__` inside the namespace and still leaves `ui-onboarding` alone.

`agent-ledger` also defined `@keyframes ui-alc-in` with a different body from
`agent-lanes`'s. Keyframe names are global, so that leaked too. The three ledger keyframes
are now `ui-ald-*`.

## What the audit cleared

These looked like duplicates from the manifest and are not, after reading both sides:

| Pair | Verdict |
| --- | --- |
| `frost-cloud` / `glow-cloud` | different renders: frosted white with cut-out eyes, versus a glowing body. Both Free, both from upstream |
| `glass-folder` / `side-folder` | front view versus side view, different DOM and different props |
| `app-shell` / `app-shell-flat` | inset frame versus edge-to-edge page; the flat one is 800 bytes of overrides on the same shell |
| `permission-request` / `agent-permissions` | one live ask with a countdown, versus a policy matrix for many tools |
| `approval-card` / `permission-request` | risk badge plus preview, versus a named right plus scope |
| `review-center` / `human-review-queue` | code-and-diff workspace, versus a decision queue. Overlapping on purpose; `CONVENTIONS.md` says which to reach for |
| `chat-composer` / `ai-workspace` | the composer is a field; the workspace is the page around it |

`ui-button` appears in 10 sheets because each screen composes the button in. The rules are
byte-identical apart from the leading comment, and the two local overrides
(`.ui-onb-link .ui-button`, `.ui-sb-tier .ui-button`) are both scoped. That is the intended
composition pattern, not a leak.

## Type names that were declared twice

Thirteen exported names existed in two components. Five had incompatible shapes, which
means a module importing both could not compile. Those were renamed on the smaller side:

| Name | Was in | Now |
| --- | --- | --- |
| `PermissionRisk`, `PermissionScope`, `PermissionDecision` | `permission-request` + `agent-permissions` | `RequestRisk`, `RequestScope`, `RequestDecision` |
| `ReviewItem`, `ReviewDecision` | `review-center` + `human-review-queue` | `CenterReviewItem`, `CenterDecision` |
| `Decision` | `decision-inbox` + `decision-tree` | `InboxDecision` |
| `KpiSeries` | `kpi-board` + `kpi-chart` | `BoardSeries` |
| `CellValue` | `crm` + `data-table` | `CrmCellValue` |
| `defaultModels` | `model-wheel` + `chat-composer` | `wheelDefaultModels` |
| `defaultApps` | `app-directory` + `chat-composer` | `directoryDefaultApps` |
| `TagTone` | `crm` + `data-table` | `CrmTagTone` |
| `ShellNavItem` | `app-shell-flat` + `app-shell` | `FlatShellNavItem` |
| `BillingPeriod` | `pricing-plans` + `settings-billing` | `PlanPeriod` |

## Rules aimed at the wrong element

Three screen sheets carried a rule written against `.ui-as`, the app-shell root, when it
belongs to an inner node. Because the shell root is also the screen root, these made the
whole screen into a chat bubble or a composer tray.

| File | Rule | Now on |
| --- | --- | --- |
| `agent-chat.tsx` | `align-self: flex-end; max-width: 80%; background: var(--chip)` | `.ui-as-chat__user` |
| `agent-chat.tsx` | `width: 100%; padding: 4px; border-radius: 18px; background: var(--tray)` | `.ui-as-composer` |
| `assistant-home.tsx` | same composer tray rule | `.ui-as-composer` |

## A screen that shipped with no stylesheet

`settings-billing.tsx` declared 70 KB of `const css` and never rendered a `<style>`
element. Measured in the browser before the fix: `.ui-um`, `.ui-sb` and `.ui-um__bar` all
computed `padding: 0; border-radius: 0; background: transparent`. After inserting the
style element as the root's first child: 20px panel radius, 16px cards, real surfaces, and
204 more measurable text pairs in the contrast audit.

## Tokens

Four components read a token that no stylesheet declared, so the value froze at its
literal fallback: `--radius-control` (`error-card`), `--radius-input` (`ghost-text`),
`--panel-raised` (`file-mention`), `--raised` (`session-browser`). All four are now in
`tokens.css` in both themes. `--ui-agcc-tray` (`agent-cursors`) and `--ad` / `--ad-ink`
(`agent-chat`) were declared nowhere at all, so the sheet background and the ad tile
computed to nothing; both are declared now, with dark overrides.

Seven tokens were defined and read by nothing, and are gone: `--panel-stroke`,
`--tier-stroke`, `--guarantee-bg`, `--guarantee-tray`, `--pro-from`, `--pro-to`,
`--nm-delay-max`.

## Gallery chrome

| Defect | Effect | Fix |
| --- | --- | --- |
| preview keyed on `nonce` only | one thrown demo made every later item page report "This demo threw" | key is now `slug:nonce` |
| search matched title, description, category | `components` gave 0 of 101, `motion` 0 of 8, `core` 1 of 38 | `kind` and `tier` are in the haystack: 101 / 8 / 38 |
| empty state always blamed the query | Core + Screens read as broken search | it names the filters: "Nothing matches Screens + Core." |
| `decodeURIComponent` unguarded in a `useState` initialiser | `#/%` threw and left a blank page | wrapped, falls back to the raw hash |
| one document title for all 157 routes | no route was identifiable in a tab or a link | `Session browser · NamurUI` per item |
| kind chips could not be turned off | picking a kind was one-way | second click clears it |
| `CodeView`'s Demo tab never received its source | dead tab | `registry.ts` gained a raw demo glob; the tab renders |

## Demos that bypassed their component

Five demos either reimplemented component markup or drove it through private classes.

| Demo | Was | Now |
| --- | --- | --- |
| `app-shell` | hand-wrote `.ui-as-page` and `.ui-as-empty` from the shell's private sheet | the page goes through the exported `children` slot |
| `stepper-form` | rendered a raw `<button class="ui-sfc__btn ui-sfc__btn-secondary">` | the exported `Button` with `variant="secondary"` |
| `trace-waterfall` | a local `Step` type with `parent` required and `end` required, so a failure was inexpressible | `TraceSpan[]`, with one `status: "failed"` tool and its `error` |
| `agent-tree` | no `onSelect`, so the component rendered inert; every node hardcoded `"running"` | `onSelect` passed, and all six statuses present |
| `approval-card` | an effect queried `.ui-apc__approve` and wrote `data-pressed` on it | the exported `onApprove` and `status` prop |

## Docs

The catalogue's prop tables came from the upstream spec files, not from the components.
That produced 38 items with no table at all and 84 documented props the component does not
accept. `scripts/gen-catalogue.mjs` now derives every table from the component's exported
props type: 157 tables, 1,580 rows, no phantom names.

Counts and figures corrected across `README.md`, `DESIGN.md`, `CONVENTIONS.md` and
`docs/`: Core 18 → 38, the injected href for `tool-call-card`, the number of sheets that
declare no custom properties (5), the reduced-motion split (153 CSS plus 4 JavaScript),
the dark-block count (156), the `--danger` value and its ratios, the `--text-subtle` rows
that were still on the pre-Ember palette, the extracted CSS volume, and every contrast
figure after the palette and the settings-billing sheet changed.

## State now

| Check | Result |
| --- | --- |
| `tsc --noEmit` | 0 errors |
| `vite build` | green, 357.71 kB entry / 100.39 kB gzip |
| Routes that mount | 157 / 157, 0 empty, 0 threw, 0 missing, 0 horizontal overflow |
| Console errors across the sweep | 0 |
| Cross-component class collisions | 0 (was 4) |
| Exported names declared twice | 0 (was 13) |
| `var(--nm-*)` without a literal fallback | 0 of 3,829 |
| Contrast, default theme | light 1,287 failing pairs over 82 routes; dark 977 over 69 |
| Contrast, `data-contrast="high"` | light 740 (−42.5%); dark 425 (−56.5%) |

## What is still open

**Sheets accumulate.** React 19 keeps every hoisted `precedence` stylesheet for the life of
the root, so a long session in the gallery ends with 157 sheets in `<head>`. That is React's
documented behaviour for SSR deduplication, not a bug in a component. The consequence for
this library is only that collisions are permanent rather than per-route, which is why they
are audited to zero above. A host that mounts one screen at a time does not see it at all.

**The demo loop cannot reset.** `ItemPage` remounts the boundary per item now, but a demo
that throws still leaves the Replay button as the only way to retry that item. Acceptable
for a gallery.

**Status vocabulary is not unified.** Six spellings for success and eleven for failure
across the 157 components. Each component is internally consistent, so this costs nothing
until two are wired together, at which point the host writes one adapter. The spellings and
the recommended canonical set are recorded in `CONVENTIONS.md` rather than renamed, because
a rename across twenty components would be churn with no visible gain.

---

## After this audit

The library has since grown from 157 items to 181: 24 more `Core` items were built from a surface
audit of `chatrigo.id`, recorded in [`15-chatrigo-surfaces.md`](./15-chatrigo-surfaces.md). Every
figure in the state table above describes the 157-item tree this audit ran against. The mechanism
the audit found has not changed: React 19 still keeps every hoisted `precedence` stylesheet in
`<head>` for the life of the root, so class names must stay globally unique. The 24 new root classes
were checked against the 279 `ui-*` tokens already on disk before they were written, and the new
type names against the 874 exports, so the counts this audit drove to zero are still zero.

## Categories

`category` was the one field the audit left alone, and by 181 items it was the untidiest
thing in the manifest: **28 labels**, and they were cut on three different axes at once.
`Buttons`, `Inputs`, `Cards`, `Text`, `Numbers` name a shape. `App screens`,
`Card illustrations`, `Product scenes` name a medium. `Webview` named the product the item
was written for. `Agents`, `Feedback`, `Navigation` named a job. Sizes ran from 38 to 1,
and seven buckets held a single item.

The field now answers one question only, **what job does this do in a product**, and the
28 labels collapsed into eight. Read forward, which is the direction that matters when
adding an item:

| Now | Was |
| --- | --- |
| `Agents` (43) | `Agents` (38), `App screens` (2: `agent-chat`, `agent-run`), `Webview` (2: `goal-tracker`, `todo-phases`), `Numbers` (1: `cost-meter`) |
| `Conversation` (24) | `Chat` (11), `Webview` (9: `entry-actions`, `slash-palette`, `attachment-tray`, `compaction-divider`, `reasoning-block`, `side-question`, `voice-session`, `file-mention`, `ghost-text`), `Cards` (2: `email-draft`, `smart-recommendation`), `App screens` (1: `assistant-home`), `Buttons` (1: `reaction-bar`) |
| `Workspace` (20) | `App screens` (8: shells, `crm`, `files`, `folder`, `integrations`, `onboarding`, `settings-billing`), `Webview` (5: session list, session tree, image viewer, runtime settings, auth), `Productivity` (3), `Cards` (2: `project-card`, `tips-panel`), `Integrations` (1: `app-directory`), `Feedback` (1: `setup-guide`) |
| `Data display` (12) | `Data display` (7), `Analytics` (2), `App screens` (2: `analytics`, `evals`), `Billing` (1: `invoice-credit`) |
| `Controls` (14) | `Inputs` (9), `Navigation` (4: profile, segmented, command, integration picker), `Buttons` (1: `button`) |
| `Feedback` (8) | `Feedback` (4), `Webview` (4: widget strip, status strip, connection banner, error card) |
| `Marketing` (28) | `Marketing` (19), `Navigation` (2: `site-header`, `site-footer`), `Social proof` (2), `Pricing` (2), `Feature sections` (1), `Legal` (1), `Data display` (1: `comparison-matrix`) |
| `Artwork & motion` (32) | `Card illustrations` (17), `Product scenes` (5), `Maps` (2), `Backgrounds` (2), `Text` (2), `Numbers` (1: `number-ticker`), `Transitions` (1), `Hover` (1), `Loaders` (1) |

Three consequences worth naming:

- **`Webview` was a provenance label in a job field.** The 20 console items were written
  for one product, but they are a session list, a settings panel, a status strip and a
  transcript marker, and they now sit where a reader would look for them. Provenance is
  already `tier`, and the specific origin is recorded in
  [`13-webview-component-plan.md`](./13-webview-component-plan.md).
- **`Navigation` dissolved.** Two of its six were site chrome and four were inputs, which
  is why it never had a coherent membership.
- **The bucket is the filter, the kind is still the shape.** `kind` and `tier` stay as
  chips; only the grouping changed. A screen that is agent work sorts under `Agents`, and
  the `Screens` chip still finds it.

The eight are listed in `src/gallery/categories.json`, which the rail, the overview and
`docs/catalogue.md` all read, so the order and the scope text have one home. The rules that
decide the awkward cases are in `CONVENTIONS.md`.
