"use client";

import type { CSSProperties, ReactNode } from "react";

/*
 * Section Intro: the eyebrow, heading and lead that open a marketing section, either centred or
 * set flush to the left of the host column. The three lines rise into place once on mount on the
 * entry curve, each one a stagger step behind the line above it, and an optional slot under the
 * lead arrives on the step after that. The stack carries a reading measure, and the measure moves
 * with the text when the block is left aligned, so it sits on the host's edge instead of floating
 * centred inside it. Styles are injected below, so no extra files are needed.
 */

export type SectionIntroProps = {
  /** Small label above the heading, set in the accent */
  eyebrow?: ReactNode;
  /** The heading itself */
  title: ReactNode;
  /** Supporting sentence under the heading, held to the reading measure */
  lead?: ReactNode;
  /** Heading level, so a section nested in a section keeps the outline honest */
  as?: "h2" | "h3";
  /** Centred, or flush to the left edge of the host column */
  align?: "center" | "left";
  /** Slot under the lead, for a switch or a pair of actions */
  children?: ReactNode;
  /** Extra class on the root */
  className?: string;
};

export function SectionIntro({
  eyebrow,
  title,
  lead,
  as: Heading = "h2",
  align = "center",
  children,
  className,
}: SectionIntroProps) {
  /* The stagger counts only the lines that are actually rendered, so a block without an eyebrow
   * does not wait through a step that has nothing to show. */
  const titleStep = eyebrow ? 1 : 0;
  const leadStep = titleStep + 1;
  const extraStep = lead ? leadStep + 1 : leadStep;

  return (
    <div className={["ui-sci", className].filter(Boolean).join(" ")} data-align={align}>
      {/* React 19 hoists this into <head> once, no matter how many intros render */}
      <style href="ui-section-intro" precedence="default">
        {css}
      </style>
      <div className="ui-sci__body">
        {eyebrow ? (
          <p className="ui-sci__eyebrow" style={{ "--ui-sci-step": 0 } as CSSProperties}>
            {eyebrow}
          </p>
        ) : null}
        <Heading className="ui-sci__title" style={{ "--ui-sci-step": titleStep } as CSSProperties}>
          {title}
        </Heading>
        {lead ? (
          <p className="ui-sci__lead" style={{ "--ui-sci-step": leadStep } as CSSProperties}>
            {lead}
          </p>
        ) : null}
        {children ? (
          <div className="ui-sci__extra" style={{ "--ui-sci-step": extraStep } as CSSProperties}>
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const css = /* css */ `
.ui-sci {
  /* Knobs. Override any of these on .ui-sci to retheme the block in a host. */
  --ui-sci-ink: var(--text, #1a1410);
  --ui-sci-muted: var(--text-muted, #6f625a);
  --ui-sci-accent: var(--accent, #c2410c);
  --ui-sci-width: 42rem;
  --ui-sci-measure: 36rem;
  --ui-sci-dur: var(--nm-dur-4, 380ms);
  --ui-sci-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-sci-stagger: var(--nm-stagger, 45ms);

  display: block;
  box-sizing: border-box;
  width: 100%;
  color: var(--ui-sci-ink, #1a1410);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-sci *,
.ui-sci *::before,
.ui-sci *::after {
  box-sizing: border-box;
}

/* The stack and its measure. "left" carries the cap with the text: the block keeps a 42rem
 * column, but the column itself starts at the host's edge instead of being centred in it. */
.ui-sci__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: var(--ui-sci-width, 42rem);
  margin-inline: auto;
  text-align: center;
}
.ui-sci[data-align="left"] .ui-sci__body {
  align-items: flex-start;
  margin-inline: 0 auto;
  text-align: left;
}

.ui-sci__eyebrow {
  margin: 0 0 0.7rem;
  color: var(--ui-sci-accent, #c2410c);
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.ui-sci__title {
  width: 100%;
  max-width: var(--ui-sci-width, 42rem);
  margin: 0;
  color: var(--ui-sci-ink, #1a1410);
  font-size: clamp(1.7rem, 1.45rem + 1.1vw, 1.9rem);
  font-weight: 600;
  line-height: 1.12;
  letter-spacing: -0.03em;
  text-wrap: balance;
  overflow-wrap: break-word;
}

.ui-sci__lead {
  width: 100%;
  max-width: var(--ui-sci-measure, 36rem);
  margin: 0.85rem 0 0;
  color: var(--ui-sci-muted, #6f625a);
  font-size: 1rem;
  line-height: 1.75rem;
  text-wrap: pretty;
  overflow-wrap: break-word;
}

/* A switch or a pair of actions under the lead. The gap belongs to the slot, so a host never
 * has to space its own buttons here. */
.ui-sci__extra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  width: 100%;
  max-width: var(--ui-sci-measure, 36rem);
  margin-top: 1.6rem;
}
.ui-sci[data-align="left"] .ui-sci__extra {
  justify-content: flex-start;
}

/* Entry ------------------------------------------------------------------ */
/* One animation per line, held at its opening frame through the delay, so the block paints
 * complete and then plays exactly once per mount. */
.ui-sci__eyebrow,
.ui-sci__title,
.ui-sci__lead,
.ui-sci__extra {
  animation: ui-sci-rise var(--ui-sci-dur, 380ms) var(--ui-sci-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both;
  animation-delay: calc(var(--ui-sci-step, 0) * var(--ui-sci-stagger, 45ms));
}
@keyframes ui-sci-rise {
  from {
    opacity: 0;
    transform: translateY(0.7rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

:where(.dark, [data-theme="dark"]) .ui-sci {
  --ui-sci-ink: var(--text, #f4ece4);
  --ui-sci-muted: var(--text-muted, #a2958a);
  --ui-sci-accent: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  .ui-sci__eyebrow,
  .ui-sci__title,
  .ui-sci__lead,
  .ui-sci__extra {
    animation: none;
    animation-delay: 0ms;
    transform: none;
  }
}
`;
