"use client";

import type { ReactNode } from "react";

/*
 * Feature Grid: a marketing grid of cards, each carrying a heading, one short copy line and a
 * visual slot that fills the rest of the card. Cards slide in from the right and below on the
 * choreographed curve, staggered left to right, and lift by shadow alone on hover. The visual
 * slot centres whatever it is given and clips it inside a rounded rect, so a preview wider than
 * the card is cropped instead of widening it. Styles are injected below, so no extra files are
 * needed.
 */

export type FeatureCard = {
  /** Stable key for the card */
  id: string;
  /** Card heading, one line */
  title: string;
  /** One or two lines of supporting copy, held to 36 characters per line */
  copy: string;
  /** The scene under the copy: a preview, a thread, a cluster, drawn by the caller */
  visual: ReactNode;
};

export type FeatureGridProps = {
  /** Cards in reading order; the grid reveals them in this order */
  items: readonly FeatureCard[];
  /** Cards per row once the viewport clears the medium breakpoint */
  columns?: 2 | 3;
  /** Extra class on the root */
  className?: string;
};

export function FeatureGrid({ items, columns = 2, className }: FeatureGridProps) {
  return (
    <div className={["ui-fgr", className].filter(Boolean).join(" ")} data-columns={columns}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-feature-grid" precedence="default">
        {css}
      </style>

      {items.map((card, index) => (
        <article
          className="ui-fgr__card"
          key={card.id}
          style={{ animationDelay: `calc(var(--ui-fgr-stagger, 90ms) * ${Math.min(index, 8)})` }}
        >
          <h3 className="ui-fgr__title">{card.title}</h3>
          <p className="ui-fgr__copy">{card.copy}</p>
          <div className="ui-fgr__visual">{card.visual}</div>
        </article>
      ))}
    </div>
  );
}

const css = /* css */ `
.ui-fgr {
  /* Knobs. Override any of these on .ui-fgr to retheme the grid in a host. */
  --ui-fgr-ink: var(--text, #1a1410);
  --ui-fgr-copy: var(--text-muted, #6f625a);
  --ui-fgr-card: #7a4a1c0d;
  --ui-fgr-edge: #1a14100f;
  --ui-fgr-shadow: 0 1px 2px #1a14100a, 0 10px 24px -20px #1a141026;
  --ui-fgr-lift: 0 2px 3px #1a14100d, 0 24px 48px -22px #1a141033;
  --ui-fgr-focus: var(--accent, #c2410c);
  --ui-fgr-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-fgr-dur-2: var(--nm-dur-2, 160ms);
  --ui-fgr-dur-5: var(--nm-dur-5, 620ms);
  --ui-fgr-stagger: 90ms;
  --ui-fgr-cols: 2;

  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  width: 100%;
  color: var(--ui-fgr-ink, var(--text, #1a1410));
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  line-height: 24px;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-fgr *,
.ui-fgr *::before,
.ui-fgr *::after {
  box-sizing: border-box;
}
.ui-fgr__title,
.ui-fgr__copy {
  margin: 0;
}

/* Two columns from the medium breakpoint; one column below it, so a 320px
 * viewport never has to squeeze two cards into one row. */
@media (min-width: 48rem) {
  .ui-fgr {
    grid-template-columns: repeat(var(--ui-fgr-cols, 2), minmax(0, 1fr));
  }
}
.ui-fgr[data-columns="3"] {
  --ui-fgr-cols: 3;
}

/* Card -------------------------------------------------------------------- */
.ui-fgr__card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 24px;
  border-radius: 1.5rem;
  background: var(--ui-fgr-card, #7a4a1c0d);
  box-shadow: inset 0 0 0 1px var(--ui-fgr-edge, #1a14100f),
    var(--ui-fgr-shadow, 0 1px 2px #1a14100a, 0 10px 24px -20px #1a141026);
  /* backwards, not both: the final keyframe must not keep owning the transform,
   * or the hover lift below would never win. */
  animation: ui-fgr-in var(--ui-fgr-dur-5, var(--nm-dur-5, 620ms))
    var(--ui-fgr-ease-out, var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))) backwards;
  transition:
    transform var(--ui-fgr-dur-2, var(--nm-dur-2, 160ms))
      var(--ui-fgr-ease-out, var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))),
    box-shadow var(--ui-fgr-dur-2, var(--nm-dur-2, 160ms))
      var(--ui-fgr-ease-out, var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)));
}
@media (hover: hover) {
  .ui-fgr__card:hover {
    transform: translateY(-3px);
    box-shadow: inset 0 0 0 1px var(--ui-fgr-edge, #1a14100f),
      var(--ui-fgr-lift, 0 2px 3px #1a14100d, 0 24px 48px -22px #1a141033);
  }
}
.ui-fgr__card :focus-visible {
  outline: 2px solid var(--ui-fgr-focus, var(--accent, #c2410c));
  outline-offset: 2px;
}
@keyframes ui-fgr-in {
  from {
    opacity: 0;
    transform: translate3d(32px, 24px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

/* Copy -------------------------------------------------------------------- */
.ui-fgr__title {
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.02em;
  color: var(--ui-fgr-ink, var(--text, #1a1410));
  text-wrap: balance;
}
/* Copy sits at 62 percent of the ink; --text-muted carries that value in both themes. */
.ui-fgr__copy {
  max-width: 36ch;
  margin-top: 8px;
  font-size: 0.875rem;
  line-height: 1.5rem;
  letter-spacing: -0.01em;
  color: var(--ui-fgr-copy, var(--text-muted, #6f625a));
}

/* Visual ------------------------------------------------------------------ */
.ui-fgr__visual {
  display: grid;
  flex: 1;
  place-items: center;
  min-width: 0;
  min-height: 11.5rem;
  margin-top: 24px;
  overflow: hidden;
  border-radius: 1rem;
}

:where(.dark, [data-theme="dark"]) .ui-fgr {
  --ui-fgr-ink: var(--text, #f4ece4);
  --ui-fgr-copy: var(--text-muted, #a2958a);
  --ui-fgr-card: #ffffff0a;
  --ui-fgr-edge: #ffffff12;
  --ui-fgr-shadow: 0 1px 2px #0000004d, 0 10px 24px -20px #00000073;
  --ui-fgr-lift: 0 2px 3px #00000059, 0 24px 48px -22px #000000a6;
}

@media (prefers-reduced-motion: reduce) {
  .ui-fgr__card {
    animation: none;
    transition-duration: 1ms;
  }
  .ui-fgr__card:hover {
    transform: none;
  }
}
`;
