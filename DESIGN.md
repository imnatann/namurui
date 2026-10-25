# NamurUI — design direction

**Reading this as:** an agent-console component library for React/TypeScript engineers, in a
warm-dark *Ember* visual language, dial **ENERGY 2 / RHYTHM 3 / MOTION 3**.

NamurUI is the agent-console component library formerly published as affectUI. The library's
structure is a byte-exact reconstruction of the original stylesheets; the visual identity is its
own. This document is the identity contract: it is what a new component must be consistent with.

## Identity

NamurUI is the surface an autonomous system is watched through. Sessions run for hours, agents
fan out, tool calls stream. The interface is therefore **calm at rest and warm under load**: quiet
warm-charcoal surfaces that do not glare over a long session, and a single ember accent that marks
exactly one thing per screen — the thing currently alive.

The identity motif is **heat**. The accent is ember, the neutrals are warm rather than grey, motion
eases like something settling rather than snapping, and the light theme is unbleached paper rather
than white. Nothing is cold.

**Personality:** watchful, exact, unhurried. It reports; it does not perform.
**Not:** neon-terminal, glassmorphic, gradient-soaked, or playful.

## Dials

| Dial | Value | Why |
|---|---|---|
| **ENERGY** | 2 | It is a working tool: confident and legible, not shouting. Loud chrome would compete with the user's own data. |
| **RHYTHM** | 3 | An agent console is not one screen — it is traces, fanned-out graphs, dense tables, and overflowing logs. Uniform section rhythm would flatten real differences in density. |
| **MOTION** | 3 | The product's whole subject is work happening over time: streams, spawns, propagation. Motion is information here, not decoration. |

## Palette

Two core colours plus one accent. Neutrals (warm charcoals and papers) are not counted.

| Role | Dark (default) | Light | Reason |
|---|---|---|---|
| Accent — ember | `#ff6b35` | `#c2410c` | Exactly one accent, used only for the live/active moment. Two values because a single orange cannot clear AA on both a warm charcoal and a warm paper. |
| Core — warm charcoal | `#14100d` | — | The console is where work happens; blue-black reads clinical over hours. |
| Core — unbleached paper | — | `#faf7f4` | Light mode is parchment, not white, so the same warmth survives the theme switch. |

### Surfaces (dark)

`#14100d` bg · `#1a1512` panel · `#201a15` card · `#26201a` raised.
Each step is ~4% lighter and warmer, so elevation reads as heat rather than as a line.

### Text

`#f4ece4` primary · `#a2958a` muted · `#f4ece48c` subtle.
Pure white on warm charcoal glares; the off-white keeps contrast without the sting. Both muted
and subtle are held above 4.5:1 on every surface they are used on, because tertiary text is still
text: subtle lands at 5.47:1 on the dark ground and muted at 6.49:1.

### Semantic

`#4f9d6e` success · `#d99530` warning · `#e87068` danger (dark)
`#1a7a4a` · `#9a6410` · `#b3261e` (light)

All six clear AA on their own theme's surface. Dark danger sits at 6.26:1 on the ground and 5.33:1
on the raised surface (`#26201a`), because a status label can appear on either. Ember orange is
reserved for accent and is never reused as a status colour, so "live" and "warning" can appear on
the same screen without ambiguity.

## Typography

| Face | Use | Reason |
|---|---|---|
| **Inter** | UI, dense data, body | Not a default pick: the components this library hosts are drawn in Inter, and a host face with different metrics would break the layout of reconstructed sheets. Metric compatibility is the reason. |
| **Georgia** | Gallery display headings only | The ember identity needs a warmth a neutral grotesque cannot supply. Georgia is a high-contrast humanist serif present on every target platform, so it costs nothing to ship. |
| `ui-monospace` | Code, traces, ids | Monospace is functional here: aligned columns in a trace must line up. |

Display headings are never used inside a component — only in the gallery chrome. Components keep
the type stack their reconstructed stylesheet specifies.

## Form

Radii soften one step from the original: `6 → 8`, `10 → 12`, `14 → 16`, panels `18 → 20`. Softer
corners are the cheapest way to read as warm rather than geometric, and they are applied through
tokens so the change is auditable in one file.

A single subtle grain overlay sits on the gallery surface, not on components. Reason: an ember
identity implies a physical surface; a perfectly flat charcoal reads as a screenshot of one.

## Motion

Motion is the product's subject, so it carries meaning rather than decoration.

| Token | Value | Use |
|---|---|---|
| `--nm-dur-1` | 90ms | press, hover-in — must feel instant |
| `--nm-dur-2` | 160ms | hover, focus ring |
| `--nm-dur-3` | 240ms | element enter/exit |
| `--nm-dur-4` | 380ms | surface change: panel, sheet, drawer |
| `--nm-dur-5` | 620ms | choreographed reveal (a fan-out, a graph draw) |
| `--nm-dur-6` | 1100ms | ambience: breathe, idle pulse |

| Curve | Value | Use |
|---|---|---|
| `--nm-ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | entering — fast in, long settle |
| `--nm-ease-in` | `cubic-bezier(0.55, 0, 0.68, 0.19)` | leaving |
| `--nm-ease-both` | `cubic-bezier(0.65, 0, 0.35, 1)` | moving within the screen |
| `--nm-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | spawn, pop, attach — a small overshoot |
| `--nm-ease-soft` | `cubic-bezier(0.4, 0, 0.2, 1)` | ambient loops |

**Rules**

1. Animate `transform` and `opacity` only. A property that triggers layout on every frame is a
   defect, not a style choice.
2. No bare `ease`. The CSS default curve spends most of its budget on a slow start, which is
   exactly the sluggishness that makes an interface feel heavy.
3. Enter with `--nm-ease-out`, leave with `--nm-ease-in`. A symmetric curve on both halves makes
   an exit feel like a rewind.
4. Ambient loops get `--nm-ease-soft`; they must never draw attention.
5. Nothing exceeds `--nm-dur-5` except ambience. A 900ms transition on a control is a defect.
6. `prefers-reduced-motion` collapses to `--nm-dur-1` and removes transforms. Opacity and colour
   changes stay, because they carry meaning without moving anything.

## Every decision, one line

- **Warm charcoal, not blue-black** — hours-long sessions; a cold ground reads clinical.
- **Ember orange as the only accent** — one thing can be alive per screen, or nothing is.
- **Unbleached paper in light mode** — so the theme switch changes brightness, not identity.
- **Georgia for display** — warmth the grotesque cannot supply, at zero shipping cost.
- **Softened radii** — the cheapest honest signal of warmth.
- **Grain on the gallery only** — implies a surface without putting texture behind the user's data.
- **Ease-out on entry, ease-in on exit** — settles rather than snaps, and never rewinds.
- **Motion up to 1100ms for ambience only** — streams and spawns are the subject; a progress ring
  that stops moving is a worse lie than a slow one.