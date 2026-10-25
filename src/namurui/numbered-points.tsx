"use client";

import type { CSSProperties, ReactNode } from "react";

/*
 * Numbered Points: a commercial argument set in two columns, the heading and lead on one side and
 * the supporting rows on the other. Each row is a real list item carrying a square badge with its
 * position padded to two digits; the badge is decorative and hidden from assistive technology, so
 * the position is heard once, from the list itself. Rows rise in order on the entry curve, one
 * stagger step apart. Styles are injected below, so no extra files are needed.
 */

export type NumberedPoint = {
  /** The sentence this row carries, in the page's own voice */
  text: string;
};

export type NumberedPointsProps = {
  /** The argument's heading, held to a sixteen character measure */
  title: ReactNode;
  /** Supporting sentence under the heading, held to the reading measure */
  lead?: ReactNode;
  /** Rows, numbered from `start` in the order given */
  points: readonly NumberedPoint[];
  /** First number in the list, so a set that continues another starts where it left off */
  start?: number;
  /** Extra class on the root */
  className?: string;
};

/* Two digits from one, so the first row reads 01 and a set starting at 4 reads 04. */
const pad = (value: number): string => String(value).padStart(2, "0");

export function NumberedPoints({
  title,
  lead,
  points,
  start = 1,
  className,
}: NumberedPointsProps) {
  return (
    <div className={["ui-npt", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many blocks render */}
      <style href="ui-numbered-points" precedence="default">
        {css}
      </style>

      <div className="ui-npt__grid">
        <div className="ui-npt__intro">
          <h2 className="ui-npt__title">{title}</h2>
          {lead ? <p className="ui-npt__lead">{lead}</p> : null}
        </div>

        {/* `start` moves the announced position with the drawn digits; role="list" keeps the
         * semantics that `list-style: none` drops in Safari. */}
        <ol className="ui-npt__list" start={start} role="list">
          {points.map((point, index) => (
            <li
              className="ui-npt__point"
              key={`${point.text}-${index}`}
              style={{ "--ui-npt-step": index } as CSSProperties}
            >
              <span className="ui-npt__badge" aria-hidden="true">
                {pad(start + index)}
              </span>
              <p className="ui-npt__text">{point.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

const css = /* css */ `
.ui-npt {
  /* Knobs. Override any of these on .ui-npt to retheme the block in a host. */
  --ui-npt-ink: var(--text, #1a1410);
  --ui-npt-muted: var(--text-muted, #6f625a);
  --ui-npt-badge-ink: var(--accent-hover, #9a3412);
  --ui-npt-badge: #c2410c1a;
  --ui-npt-heading-measure: 16ch;
  --ui-npt-lead-measure: 34rem;
  --ui-npt-dur-4: var(--nm-dur-4, 380ms);
  --ui-npt-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-npt-stagger: var(--nm-stagger, 45ms);

  display: block;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  container-type: inline-size;
  color: var(--ui-npt-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-npt *,
.ui-npt *::before,
.ui-npt *::after {
  box-sizing: border-box;
}
.ui-npt p {
  margin: 0;
}

/* Columns ---------------------------------------------------------------- */
/* One column until the block itself is wide enough for two. The container query follows the
 * block rather than the viewport, so a narrow preview stacks at the same width a phone does. */
.ui-npt__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 2.5rem;
  min-width: 0;
}
@container (min-width: 56rem) {
  .ui-npt__grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}
.ui-npt__intro {
  display: grid;
  gap: 1.25rem;
  align-content: center;
  min-width: 0;
}
.ui-npt__title {
  max-width: min(var(--ui-npt-heading-measure), 100%);
  margin: 0;
  color: var(--ui-npt-ink);
  font-size: 1.9rem;
  font-weight: 700;
  line-height: 1.12;
  letter-spacing: -0.03em;
  text-wrap: balance;
  overflow-wrap: break-word;
}
.ui-npt__lead {
  max-width: min(var(--ui-npt-lead-measure), 100%);
  color: var(--ui-npt-muted);
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.75rem;
  text-wrap: pretty;
  overflow-wrap: break-word;
}

/* Rows ------------------------------------------------------------------- */
.ui-npt__list {
  display: grid;
  gap: 1.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
  min-width: 0;
}
.ui-npt__point {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  min-width: 0;
  min-height: 2.75rem;
  animation: ui-npt-rise var(--ui-npt-dur-4) var(--ui-npt-ease-out) both;
  animation-delay: calc(var(--ui-npt-step, 0) * var(--ui-npt-stagger));
}
@keyframes ui-npt-rise {
  from {
    opacity: 0;
    transform: translateY(0.5rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
/* The badge holds the digits and nothing else: fixed width, so a long sentence beside it wraps
 * instead of squeezing the number. */
.ui-npt__badge {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 5px;
  background: var(--ui-npt-badge);
  color: var(--ui-npt-badge-ink);
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
  user-select: none;
}
.ui-npt__text {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--ui-npt-ink);
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.5;
  overflow-wrap: break-word;
}

:where(.dark, [data-theme="dark"]) .ui-npt {
  --ui-npt-ink: var(--text, #f4ece4);
  --ui-npt-muted: var(--text-muted, #a2958a);
  /* The dark block takes the hover step for ink, as the light block does: the base accent reads
   * 4.88:1 on this wash, this step 5.66:1. */
  --ui-npt-badge-ink: var(--accent-hover, #ff8256);
  --ui-npt-badge: #ff6b3526;
}

@media (prefers-reduced-motion: reduce) {
  .ui-npt__point {
    animation: none;
    animation-delay: 0ms;
    opacity: 1;
    transform: none;
  }
}
`;
