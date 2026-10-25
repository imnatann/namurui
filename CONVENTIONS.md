# House conventions: read this before writing any component

Every item in this library is **one self-contained `.tsx` file**. No Tailwind, no
animation library, no CSS files, no icon packages. React 19 only. These rules are
derived from the 40 MIT-licensed originals in `src/namurui/`: match them. Colour and
timing are the one deliberate departure, because the palette is NamurUI's own *Ember*
identity and motion comes from the NamurUI token scale. [`DESIGN.md`](./DESIGN.md) is the
source of truth for both.

## Categories

`manifest.json` carries one `category` per item, and it answers one question: **what job
does this piece do in a product?** It is not a shape and not a provenance. `kind` already
says whether a piece is a component, screen, block, illustration or motion effect, and
`tier` says whether it is upstream, reconstructed or first-party. Reusing either as the
category is what produced 28 overlapping labels, so the two are kept apart.

The eight buckets, in the order the rail and the overview present them:

| Category | Scope |
| --- | --- |
| `Agents` | Planning, steering, reviewing and paying for agent work: plans, queues, lanes, trees, fan-outs, memory, budgets, permissions, approvals, guardrails, traces, replays, logs, diffs, terminals, agent screens |
| `Conversation` | Messages, answers, drafts and the composer around them: threads, citations, model pickers, reasoning, side questions, voice, attachment and mention chrome, inline completion |
| `Workspace` | App frames, screens, sessions, files and settings: shells, CRM, folders, task board, integrations, onboarding, auth, runtime settings, session list and tree |
| `Data display` | Tables, charts, meters and money: data table, KPI and breakdown charts, usage and cost meters, invoice and credit note, analytics and eval dashboards |
| `Controls` | Buttons, fields, pickers and the forms built from them: button, combobox, filter menu, OTP, date range, dropzone, segmented control, command and profile menus, prompt library, stepper form, billing schedule |
| `Feedback` | Progress, notices and the state of the system: toasts, notification stack, decision inbox, progress tracker, status and widget strips, connection banner, error card |
| `Marketing` | Public site: header and footer, hero, feature grid, CTA, pricing, legal, FAQ, social proof, comparison matrix, process and use case sections, product mock windows |
| `Artwork & motion` | Illustrations, backgrounds and motion primitives: every `illustrations` and `motion` item |

Three rules decide the awkward ones:

1. **Group by the job, not the container.** `agent-chat` and `agent-run` are screens but
   they are agent work, so they sit in `Agents`. `analytics` and `evals` are screens but
   they are dashboards, so they sit in `Data display`.
2. **A landing-page version of a thing is `Marketing`.** `chat-window`, `mock-thread`,
   `phone-mock` and the two inbox previews are chat and inbox surfaces, but their job is
   to sell the product on a public page. The real ones live in `Conversation` and
   `Workspace`.
3. **Composer chrome is `Conversation`, app-wide chrome is `Controls`.** `slash-palette`,
   `attachment-tray`, `ghost-text` and `model-picker` exist inside a message composer.
   `command-menu`, `combobox` and `filter-menu` are general inputs.

Adding a category means editing `src/gallery/categories.json` (order and scope) and the
manifest together; the rail, the overview and `docs/catalogue.md` all read that file, so
nothing else needs to change. A new item must land in one of the eight. If it does not
fit, the taxonomy is wrong, not the item.

## File shape

```tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/*
 * Component Name: one sentence on what it is.
 * Two or three sentences on the interaction and the motion.
 * The styles are injected below, so no extra files are needed.
 */

export type ComponentNameProps = {
  /** Sentence, ends without a period */
  title?: string;
  className?: string;
};

export function ComponentName({ title = "Untitled", className }: ComponentNameProps) {
  return (
    <div className={["ui-cn", className].filter(Boolean).join(" ")} data-…>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-component-name" precedence="default">
        {css}
      </style>
      …
    </div>
  );
}

const css = /* css */ `
…
`;
```

Rules every file follows:

1. `"use client";` is the first line.
2. One `<style href>` naming the item sits **inside** the returned tree, as the first child;
   React 19 hoists and deduplicates it. The canonical spelling is `ui-<slug>`; three variants are
   accepted, matching the name each file was written with: `ui-screen-<slug>` on the four screens
   that carry it (`agent-chat`, `assistant-home`, `crm`, `folder`), a `-clean` suffix on six items
   (`ai-answer`, `dropzone`, `memory-panel`, `stepper-form`, `thinking-state`, `toaster`), and
   `ui-tool-call` on `tool-call-card`. Every file has one.
3. The CSS lives in a `const css = /* css */ \`…\`;` **after** the component.
4. Root class is `ui-<abbrev>`; children use BEM-ish `ui-<abbrev>__part` and
   `ui-<abbrev>[data-state="…"]`. Never invent a second root class.
5. Props are `export type <Name>Props = { … }` with `/** … */` on each field.
   Optional `className` last. Spread nothing except `...rest` on a real DOM element.
6. Named exports only, no default export. Helpers used by consumers are exported too
   (e.g. `acceptSuggestion`).

## Host vocabulary

Every component is self-contained, and that includes its vocabulary: the prop names are
the ones its own demo and spec use, and no component imports another component's types.
A host that composes two or more of them therefore owns one adapter at the boundary,
mapping its model into each component's props and back out of each callback. This table
is the contract for that adapter, so the translation is written once instead of
discovered at integration time. It records the spellings as they ship; nothing here is
scheduled for a rename.

| Concept | Canonical | Variants in the library | Where |
| --- | --- | --- | --- |
| success status literal | `done` | `ok`, `success`, `complete`, `completed`, `applied` | `done` in `agent-plan`, `agent-queue`, `agent-tree`, `dropzone`, `todo-phases` and most other status types; `ok` in `agent-graph`, `agent-schedule`, `subagent-spawn`, `widget-strip`; `success` in `otp-input`, `tool-call-card`; `complete` in `branch-explorer`, `side-question`; `completed` in `goal-tracker`; `applied` in `agent-diff` |
| failure status literal | `failed` | `error`, `blocked`, `cancelled`, `abandoned`, `dropped`, `declined`, `expired`, `denied`, `rejected`, `discarded` | `failed` in `agent-plan`, `agent-queue`, `agent-terminal`, `agent-tree`, `trace-waterfall` and others; `error` in `agent-graph`, `tool-call-card`, `dropzone`, `otp-input`, `side-question`, `widget-strip`; `blocked` in `agent-handoff`, `todo-phases`; `cancelled` in `side-question`, `subagent-spawn`; `abandoned` in `branch-explorer`; `dropped` in `goal-tracker`; `declined` and `expired` in `agent-handoff`; `denied` in `approval-card`; `rejected` in `attachment-tray`; `discarded` in `agent-diff` |
| selection callback | `onSelect` | `onPick`, `onChoose` | `onSelect` in `agent-graph`, `agent-tree`, `cover-flow`, `fan-out-grid`, `memory-graph`, `pricing-plans`, `prompt-library`, `session-tree`; `onPick` in `agent-permissions`, `parallel-attempts`, `slash-palette`; `onChoose` in `decision-tree` |
| selected id | `selectedId` | `activeId`, `selection`, `value` | `selectedId` in `memory-graph`, `session-tree`; `activeId` in `session-browser`; `selection` in `session-replay`; `value` in `model-picker`, `integration-picker`, `segmented-control` |
| uncontrolled initial value | `default*` | `initial*` | `default*` in 60 components; `initial*` in `stepper-form` (`initialValues`, `initialStep`), `session-replay` (`initialSpeed`), `writing-assistant` (`initialMessages`), `agent-terminal` (`initialLines`), `agent-chat` (`initialAngle`) |
| list data prop | `items` | `rows`, `entries`, and payload-specific names (`files`, `nodes`, `messages`, `series`) | `items` in `agent-chat`, `agent-inbox`, `analytics`, `context-window`, `human-review-queue`, `review-center`, `todo-phases`; `rows` in `agent-ledger`, `agent-logs`, `crm`, `data-table`, `permission-request`, `stepper-form`; `entries` in `agent-gallery`; `files`, `nodes`, `messages` and `series` where the list is the component's subject |
| queued work | `tasks` | `jobs` | `tasks` in `agent-inbox`, `agent-lanes`, `delegate-board`, `fan-out-grid`, `setup-guide`, `subagent-spawn`, `task-board`; `jobs` in `agent-queue` |

For new components, the canonical column is the recommendation: status literals are
`done`, `running`, `failed`, `waiting` and `stopped`; selection is `onSelect` carrying an
id that the component also accepts as `selectedId`; an uncontrolled initial value takes
the `default*` prefix; list data is `items`; queued work is `tasks`. Existing components
keep the spellings in the variants column, which is why the adapter exists.

Eight shared type names now have exactly one owner each. `PermissionRisk`,
`PermissionScope` and `PermissionDecision` are declared only in `agent-permissions.tsx`;
`ReviewItem` and `ReviewDecision` only in `human-review-queue.tsx`; `Decision` only in
`decision-tree.tsx`; `KpiSeries` only in `kpi-chart.tsx`; `CellValue` only in
`data-table.tsx`. Each had a competing declaration in a sibling with an incompatible
shape, so a module that imported both components failed at the type level. The
duplicates were renamed to `RequestRisk`, `RequestScope` and `RequestDecision` in
`permission-request.tsx`, `CenterReviewItem` and `CenterDecision` in `review-center.tsx`,
`InboxDecision` in `decision-inbox.tsx`, `BoardSeries` in `kpi-board.tsx` and
`CrmCellValue` in `crm.tsx`. Import the canonical name when one shape is shared across
components; import the renamed name when you mean that component's own shape.

The two review surfaces overlap on purpose. `review-center` is a code-and-diff review
workspace: a queue sorted by risk, flagged spans the agent was unsure about, files and
hunks, and an undo for the last decision. `human-review-queue` is a decision queue: one
request at a time with its evidence and rationale open, edit-then-approve, and a tally
once the queue is empty. Reach for `review-center` when the item under review is a change
with code in it, and for `human-review-queue` when the item is a decision whose evidence
must be read before a verdict. A host that needs both routes by payload: files or hunks
go to `review-center`, evidence plus a proposal to edit go to `human-review-queue`.

## CSS conventions

- All colours, timings and sizes are **CSS custom properties declared on the root class**,
  prefixed with the component's abbreviation: `--ui-tl-ink`, `--ui-btn-ease`, `--ui-agg-link`.
  A consumer overrides them on `.ui-tl { … }`; document that in a comment.
- **Colours come from the Ember palette in [`DESIGN.md`](./DESIGN.md), and from nowhere else.**
  Do not mix a new hue in. The ember accent marks exactly one live thing per screen and is
  never reused as a status colour; status uses the semantic trio (success, warning, danger).
- **Motion comes from the tokens in `src/styles/motion.css`**, and each reference carries the
  literal value inline as its fallback, because every component is self-contained: it must
  animate correctly in a host page that never loads `motion.css`.

  ```css
  transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  ```

  Write `var(--nm-<token>, <literal>)`, never a bare hand-rolled `cubic-bezier(...)` in its
  place, and never a bare `ease`.
- **Durations come from the `--nm-dur-*` scale, never an ad-hoc value.** The scale, and the
  interaction each step belongs to, is `DESIGN.md` § Motion:

  | Token | Value | Use |
  | --- | --- | --- |
  | `--nm-dur-1` | 90ms | press, hover-in |
  | `--nm-dur-2` | 160ms | hover, focus ring |
  | `--nm-dur-3` | 240ms | element enter/exit |
  | `--nm-dur-4` | 380ms | surface change: panel, sheet, drawer |
  | `--nm-dur-5` | 620ms | choreographed reveal: fan-out, graph draw |
  | `--nm-dur-6` | 1100ms | ambience: breathe, idle pulse |

- **Easing, by direction of travel**, again with the literal fallback inline:

  | Token | Fallback | Use |
  | --- | --- | --- |
  | `--nm-ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | entering |
  | `--nm-ease-in` | `cubic-bezier(0.55, 0, 0.68, 0.19)` | leaving |
  | `--nm-ease-both` | `cubic-bezier(0.65, 0, 0.35, 1)` | moving within the screen |
  | `--nm-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | spawn, pop, attach |
  | `--nm-ease-soft` | `cubic-bezier(0.4, 0, 0.2, 1)` | ambient loops |

- Animate `transform` and `opacity` only. A property that triggers layout on every frame is a
  defect, not a style choice. A symmetric curve on both halves of an interaction makes an exit
  feel like a rewind: enter and leave use different tokens for that reason.
- Font stack, verbatim:
  `"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
- `-webkit-font-smoothing: antialiased;` and `letter-spacing: -0.01em` on text roots.
- Dark mode: `:where(.dark, [data-theme="dark"]) .ui-x { … }`, overriding only the custom
  properties. Most sheets repeat that selector once per rule rather than writing a single block
  (77 of the 180 that carry it), and its position within the sheet is not fixed: 101 of those files
  close the sheet with it. `project-flow` carries no document-level selector at all; it takes a
  `theme` prop and keys its scoped variables off `.ui-pf[data-theme="…"]`.
- Reduced motion: one `@media (prefers-reduced-motion: reduce) { … }` block, position within the
  sheet not fixed: 62 of the 181 files close the sheet with it. It removes
  `animation`, sets `transition-duration: 1ms`, and leaves the end state correct. The floor at the
  bottom of `src/styles/motion.css` catches anything a component block misses. Colour and opacity
  changes survive, because they carry meaning without moving anything. Four items carry no block
  and check `matchMedia("(prefers-reduced-motion: reduce)")` in JavaScript instead:
  `frost-cloud`, `glow-cloud`, `lead-sourcing`, `model-wheel`. One item carries no block at all:
  `highlight-band`, which animates nothing, so there is nothing to reduce.
- Prefer `box-shadow: inset 0 0 0 1px` over `border` where the originals do, so size
  never shifts on state change.
- No `!important` in new code. 17 of the 40 Free files use it defensively, to beat a
  host's global `font-size` or to force a transform during an exit animation, and those
  declarations are kept as they are. Match that only when a host style would otherwise win.
- No `:has()` unless the original uses it. No vendor prefixes except `-webkit-` where shown.

## Behaviour conventions

- Animation goes through `requestAnimationFrame`, CSS transitions or the Web Animations
  API. **No** `setInterval` for anything visible; timers only drive data (counters, clocks).
- Every timer and rAF loop is cleaned up in the effect's return, and loops pause when
  `document.hidden` or the element is off screen (`IntersectionObserver`).
- Everything is measured, not assumed: `ResizeObserver` for widths, `getBoundingClientRect`
  for positions. Layouts must survive 320px → 1920px.
- Controlled **and** uncontrolled where a value can be owned by the caller: accept
  `value` + `onChange`, and fall back to internal state (`value === undefined`).
- Never read `window` during render. Guard SSR: `typeof window === "undefined"`.
- Text that changes is announced: `role="status"` + `aria-live="polite"`, or a hidden
  live region for richer summaries.
- Interactive elements are real `<button>`/`<input>`/`<a>`. Add `:focus-visible` styles.
  Never `outline: none` without a replacement ring.
- Status is never colour alone: pair it with a shape, icon or text.

## Types

- No `any`. No `as` casts on DOM nodes beyond `useRef<HTMLDivElement>(null)`.
- Discriminated unions for variants: `kind: "agent" | "tool" | "user"`.
- `ReactNode` for slots, `ReactElement` never.
- Refs use the React 19 style: `ref?: Ref<HTMLButtonElement>` in props, assigned inline.

## Demo files

Every component ships `src/namurui/demos/<slug>.tsx`:

```tsx
import { useState } from "react";
import { ComponentName } from "../component-name";

export default function Demo() {
  return <ComponentName … />;
}
```

- `export default` a zero-prop component. The gallery mounts it inside a preview frame.
- Show the component doing the thing its description promises: real state, real motion,
  realistic content (no "Lorem ipsum", no "Item 1").
- Demos are interactive: clicking must exercise the component's actual handlers.
- Keep demos around 120 lines as a soft target, not a gate: 55 of the 181 are longer, the longest
  `feature-grid` at 429, then `client-context` at 362. Compose with plain `<div style={{ display: "grid", gap: 16 }}>`.
- Demos must render standalone with no props.