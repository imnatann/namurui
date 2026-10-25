# Motion

Motion is this product's subject. An agent console shows work happening over time, so a duration
explains how far a thing travelled and where it came from. The values are named once, in
`src/styles/motion.css`, and `DESIGN.md` § Motion carries the reasoning behind each value. A
component repeats the literal value inline as a fallback, because it has to be correct without that
sheet (see The rule for components, below), but the token is the source.

The stylesheets themselves are a reconstruction of the extraction in structure and geometry. Colour
and timing are re-themed to NamurUI, which is what the tokens in this layer exist to make possible.

## Durations: six steps

| Token | Value | Use |
| --- | --- | --- |
| `--nm-dur-1` | 90ms | press, hover-in. Must feel instant |
| `--nm-dur-2` | 160ms | hover, focus ring |
| `--nm-dur-3` | 240ms | element enter and exit |
| `--nm-dur-4` | 380ms | surface change: panel, sheet, drawer |
| `--nm-dur-5` | 620ms | choreographed reveal: fan-out, graph draw |
| `--nm-dur-6` | 1100ms | ambience: breathe, idle pulse |

Each step is roughly 1.5x the one before, so the difference between two timings reads as deliberate
rather than arbitrary. Nothing user-triggered goes above `--nm-dur-5`; only ambience reaches
`--nm-dur-6`.

## Curves: five

| Token | Value | Use |
| --- | --- | --- |
| `--nm-ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | entering: leaves fast, arrives slowly |
| `--nm-ease-in` | `cubic-bezier(0.55, 0, 0.68, 0.19)` | leaving |
| `--nm-ease-both` | `cubic-bezier(0.65, 0, 0.35, 1)` | moving within the screen |
| `--nm-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | spawn, pop, attach: a small overshoot |
| `--nm-ease-soft` | `cubic-bezier(0.4, 0, 0.2, 1)` | ambient loops |

Four rules come from these five curves:

- Enter with `--nm-ease-out`, leave with `--nm-ease-in`. The same curve on both halves makes an
  exit read as a rewind.
- Ambient loops get `--nm-ease-soft`, which is the calmest of the five. An ambience that draws
  attention is a defect.
- `--nm-spring` is for a spawn, a pop or an attach. Never on text, never on a layout property, and
  never on anything that could jitter at rest.
- Animate `transform` and `opacity`. A property that triggers layout on every frame is a defect,
  not a style choice.

## Stagger and the shared loop rate

`--nm-stagger: 45ms` is the delay between successive items in a choreographed group, such as a
fan-out or a list reveal. `--nm-delay-max: 12` caps the number of staggered steps in one group, so
a long list cannot accumulate an unbounded lead-in.

`--nm-spin` is registered with `@property` as an `<angle>` that does not inherit and starts at
`0deg`. It is one shared angle that any number of spinners can be driven by, so the gallery runs at
one update rate instead of each indicator inventing its own.

## Reduced motion

`motion.css` ends with the floor that sits underneath the per-component blocks:

- All six duration steps become 60ms, `--nm-spring` becomes `linear` and `--nm-stagger` becomes
  `0ms`.
- Globally, animation and transition durations drop to `0.01ms`, animation iteration count to `1`,
  and `scroll-behavior` to `auto`.
- Ambient decoration is removed rather than frozen: anything matched by `[class*="breathe"]`,
  `[class*="shimmer"]` or `[class*="pulse"]` gets `animation: none`. A frozen loop reads as a
  broken image; a removed one reads as nothing, which is correct.

Every one of the 181 item files handles reduced motion on its own, because a component has to be
correct on its own: 176 carry a CSS block of their own, and the other four (`frost-cloud`,
`glow-cloud`, `lead-sourcing`, `model-wheel`) move in JavaScript and check `matchMedia` before they
start, so there is nothing for a media query to switch off. The last file, `highlight-band`, animates
nothing, so it carries no block at all. The CSS shapes differ: some collapse the
subtree's durations to `1ms` on every descendant (`animation-duration`, `animation-delay` and
`transition-duration`), others name the decorative parts and remove them outright, for example the
tool call card's shine or the button label's shimmer. In most sheets the dark-mode block is what
closes the stylesheet rather than this one.

The rule underneath all of them: **the end state must still be correct.** Removing motion never
removes meaning. A spinner still indicates work, a check still indicates done, a moved row is still
in its new place, and nothing is left mid-transition.

Motion driven from JavaScript cannot be reached by a media query. Eleven sheets animate through the
Web Animations API, and the guard for them is a JavaScript check of
`matchMedia("(prefers-reduced-motion: reduce)")` before the call; 42 item files contain that check.

One wording difference to be aware of: `DESIGN.md` states the reduced-motion rule as "collapses to
`--nm-dur-1`", while the sheet sets all six steps to 60ms, which is below the 90ms press step. The
effect is the same in every band: reduced motion is instant.

## The rule for components: inline the literal fallback

A component is one self-contained file whose styles are injected with it, and `motion.css` is a
separate sheet a host page may never load. So a component that uses a motion token must write the
literal value inline as its fallback:

```css
.ui-x { transition: transform var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)); }
```

This is not belt and braces. A `var()` that cannot be resolved makes the whole declaration invalid
at computed-value time, and the property then falls back to its initial value. For the `transition`
shorthand that means `all 0s ease 0s`, so the transition does not run at all; for
`transition-timing-function` alone it means the CSS default `ease`. With the literal in place the
component is correct by itself, and a host that does load the token sheet can still retune it.

At page level the alias needs no literal, because the gallery loads `motion.css` with the rest of
the layer: `--ease` in `tokens.css` is `var(--nm-ease-out)`. Thirteen screen sheets shadow that name
locally instead, declaring `--ease: cubic-bezier(0.22, 1, 0.36, 1)` on their own root.

## Why the extracted sheets used `ease`, and what changed

The stylesheets were reconstructed from the original site, which wrote its transitions with the CSS
default keyword. That was the state of the extraction, not of the library: 1,887 bare `ease`
keywords were written across the reconstructed sheets. The default curve spends most of its budget
on a slow start, so a hover written with it read as sluggish and an exit read as a rewind, which is
the opposite of settling.

A re-time pass has since replaced every one of them: **0 bare CSS `ease` keywords remain, where
there were 1,887.** 1,776 timing declarations were rewritten to name a `--nm-*` curve, and 2,111
durations were snapped to the six-step scale, repointed by direction of travel: entering takes
`--nm-ease-out`, leaving takes `--nm-ease-in`, movement inside a screen takes `--nm-ease-both`,
ambient loops take `--nm-ease-soft`, and a spawn or a pop takes `--nm-spring`. Durations now land on
the six steps instead of the ad-hoc 120ms to 480ms literals the extraction recorded.

Three deliberate exceptions, so a later sweep does not undo them:

- Durations inside `prefers-reduced-motion` blocks were left exactly as the extraction wrote them.
  The reduced-motion floor is already the instant step, and re-timing an override that collapses to
  `1ms` would only fight it.
- `animation-delay` and `transition-delay` values were left alone. A delay is a schedule rather
  than a length, and snapping one would change when a thing happens, not how long it takes.
- The `9999s` sentinel in `otp-input`, which suppresses Chrome's autofill background flash, is not
  an animation length and was left untouched.

Every repointed declaration keeps its literal fallback inline, so
`transform var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))` is what a
retimed sheet actually reads.

## What the animation is for

1. **Glide to the new place.** Layout changes are animated, not jumped: a pill moves between tabs
   by transitioning `transform`, a row reorders by animating its translate, a card resizes by
   measuring the incoming content and transitioning width and height. Where list order changes, the
   few FLIP animations measure, reorder, invert, then play.
2. **Blur as an entrance.** Content that replaces other content enters with `filter: blur(3px)` to
   `0` plus a small `translateY` (23 sheets). It reads as focus being pulled, and it hides the
   moment where two things are briefly both visible.
3. **The shimmer is a light source.** Loading states run a linear-gradient band across the surface
   rather than pulsing opacity (21 sheets).
4. **Numbers roll, they do not swap.** A changing digit slides inside a clipped box, staggered by
   place value, and values count up from zero the first time they scroll into view.
5. **Movement is measured from the element.** Pointers sit on characters, pins on blocks, pulses on
   links, because the position comes from `getBoundingClientRect` against the container (57 sheets)
   and never from a hardcoded offset. Reflow and zoom keep them attached.
6. **Loops pause.** An infinite animation stops when the element leaves the viewport
   (`IntersectionObserver`, 17 sheets), when the tab is hidden, or when the pointer rests on it.
7. **Exit is faster than entry.** Out is shorter than in, because a thing leaving should not hold
   attention.

## What is never done

- `transition: all`. Name the properties. No item sheet does this.
- Animating `box-shadow`, `filter` or `backdrop-filter` in a loop. Loops use `transform` and
  `opacity`; if a shadow must move, animate a pseudo-element's `transform`.
- `setInterval` driving anything visible. Timers may tick data (clocks, counters; 21 sheets use
  one), but pixels move on `requestAnimationFrame` (48 sheets), a CSS transition or the Web
  Animations API.
- Layout thrash. Reads (`getBoundingClientRect`) and writes are separated into different frames.
- Motion on scroll without `IntersectionObserver` gating.
- Springs on text, or on anything that could jitter at rest.