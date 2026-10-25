"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/*
 * Process Steps: an ordered delivery process as a line of steps, each a numbered circle
 * badge with its title set beside it.
 * Horizontal, one rule runs behind the badges and closes on a ring dot; stacked, a connector
 * drops from each badge to the next. Both extents are read from the rendered badges on mount
 * and on every resize, so the line never assumes a gap. The steps rise in on a stagger, then
 * each connector draws after the badge it leaves. Styles are injected below, so no extra files
 * are needed.
 */

export type ProcessStep = {
  /** Stable key, and the only identity the list needs */
  id: string;
  /** The step name, set at body size */
  title: string;
  /** One line of context, read under the name when present */
  detail?: string;
};

export type ProcessStepsProps = {
  /** The process, in order */
  steps: readonly ProcessStep[];
  /** Layout from 640px up; below that the steps stack whichever way this is set */
  orientation?: "horizontal" | "vertical";
  /** Index of the step reached last; it and every earlier step take the accent, and a
   * negative index leaves every step ahead */
  current?: number;
  /** Extra class on the root */
  className?: string;
};

export function ProcessSteps({
  steps,
  orientation = "horizontal",
  current,
  className,
}: ProcessStepsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  /* The rule runs from the first badge's centre to the ring dot, and each connector spans the
   * gap down to the next badge. Both are read off the rendered badges, so a wider viewport, a
   * longer title or a host's larger badge moves the geometry with them. Only absolutely
   * positioned pieces are written, so a measurement never reflows the list and never feeds
   * back into the observer. */
  useEffect(() => {
    const root = rootRef.current;
    const rail = railRef.current;
    if (!root || !rail) return;

    const measure = () => {
      const badges = Array.from(rail.querySelectorAll<HTMLElement>(".ui-pst__badge"));
      if (badges.length === 0) return;

      /* The steps rise on a stagger, and a rect read mid rise carries that translateY. The
       * rail's own geometry has to come from layout instead, or a measurement that lands
       * during the stamp bakes six pixels of lift into the line and never settles. */
      const laidOutTop = (node: HTMLElement) => {
        let top = 0;
        for (let el: HTMLElement | null = node; el && el !== rail; el = el.offsetParent as HTMLElement | null) {
          top += el.offsetTop;
        }
        return top;
      };

      const railBox = rail.getBoundingClientRect();
      const boxes = badges.map((badge) => {
        const rect = badge.getBoundingClientRect();
        return {
          left: rect.left,
          width: rect.width,
          top: railBox.top + laidOutTop(badge),
          height: badge.offsetHeight,
        };
      });
      /* Two badges sharing a top means the columns are side by side. The prop is not
       * consulted, because the media query can have stacked a horizontal list. */
      const stacked = boxes.length === 1 || Math.abs(boxes[1].top - boxes[0].top) > 1;

      if (stacked) {
        const rows = Array.from(rail.querySelectorAll<HTMLElement>(".ui-pst__step"));
        rows.forEach((row, index) => {
          const here = boxes[index];
          const next = boxes[index + 1];
          if (!next) return;
          /* Six pixels of air under the badge and above the next one. */
          const span = Math.max(0, Math.round(next.top - (here.top + here.height) - 12));
          row.style.setProperty("--ui-pst-conn-h", `${span}px`);
        });
        return;
      }

      const first = boxes[0];
      const last = boxes[boxes.length - 1];
      const dot = rail.querySelector<HTMLElement>(".ui-pst__dot");
      const dotBox = dot ? dot.getBoundingClientRect() : null;

      const start = first.left + first.width / 2;
      const end = dotBox ? dotBox.left + dotBox.width / 2 : last.left + last.width / 2;
      const span = end - start;

      root.style.setProperty("--ui-pst-rule-x", `${Math.round(start - railBox.left)}px`);
      root.style.setProperty(
        "--ui-pst-rule-y",
        `${Math.round(first.top + first.height / 2 - railBox.top)}px`,
      );
      root.style.setProperty("--ui-pst-rule-w", `${Math.max(0, Math.round(span))}px`);

      /* Where the reached ink stops. The last reached badge's centre is the boundary, so the
       * part behind it and the tail to the ring dot stay on the quiet track. */
      const reached = current === undefined ? -1 : Math.min(current, boxes.length - 1);
      let fill = 0;
      if (reached >= 0) {
        if (reached >= boxes.length - 1) fill = 100;
        else if (span > 0) {
          const boundary = boxes[reached].left + boxes[reached].width / 2;
          fill = Math.max(0, Math.min(100, ((boundary - start) / span) * 100));
        }
      }
      root.style.setProperty("--ui-pst-fill", `${fill.toFixed(2)}%`);
    };

    measure();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    for (const badge of rail.querySelectorAll(".ui-pst__badge")) observer.observe(badge);
    return () => observer.disconnect();
  }, [orientation, steps.length, current]);

  /* The stamp stops at eight steps: a long list keeps its rhythm instead of waiting several
   * seconds for the last row. */
  const stamp = Math.max(0, Math.min(steps.length - 1, 7));

  return (
    <div
      ref={rootRef}
      className={["ui-pst", className].filter(Boolean).join(" ")}
      data-orientation={orientation}
      style={{ "--ui-pst-last": stamp } as CSSProperties}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-process-steps" precedence="default">
        {css}
      </style>

      <p className="ui-pst__sr" role="status" aria-live="polite">
        {current !== undefined && steps[current]
          ? `Step ${current + 1} of ${steps.length}: ${steps[current].title}`
          : ""}
      </p>

      {steps.length === 0 ? (
        <p className="ui-pst__empty">No steps yet.</p>
      ) : (
        <div className="ui-pst__rail" ref={railRef}>
          <span className="ui-pst__rule" aria-hidden="true" />
          <ol className="ui-pst__list" aria-label="Process">
            {steps.map((step, index) => (
              <li
                key={step.id}
                className="ui-pst__step"
                data-state={current !== undefined && index <= current ? "reached" : "ahead"}
                data-link={current !== undefined && index < current ? "on" : "off"}
                data-last={index === steps.length - 1 ? "true" : "false"}
                aria-current={current === index ? "step" : undefined}
                style={{ "--ui-pst-i": Math.min(index, 7) } as CSSProperties}
              >
                <span className="ui-pst__mark" aria-hidden="true">
                  <span className="ui-pst__badge">{index + 1}</span>
                  <span className="ui-pst__connector" />
                  {index === steps.length - 1 ? <span className="ui-pst__dot" /> : null}
                </span>
                <span className="ui-pst__body">
                  <span className="ui-pst__title">{step.title}</span>
                  {step.detail ? <span className="ui-pst__detail">{step.detail}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

const css = /* css */ `
.ui-pst {
  /* Knobs. Override any of these on .ui-pst to retheme the steps in a host. The rule extent
   * is written by the component at runtime; the values here are only what renders before the
   * first measurement. */
  --ui-pst-ink: var(--text, #1a1410);
  --ui-pst-muted: var(--text-muted, #6f625a);
  --ui-pst-accent: var(--accent, #c2410c);
  --ui-pst-on-accent: var(--accent-fg, #fffdfb);
  --ui-pst-line: var(--border, #e8e0d7);
  /* The rail is a hairline on a near-black ground, so the plain border vanishes in the dark
   * block. Both strengths come from the same two tokens: the track is mostly the border, the
   * reached ink is mostly the subtle text tone. Neither invents a hue. */
  --ui-pst-line-on: var(--text-subtle, #6f625a);
  --ui-pst-track: color-mix(in srgb, var(--ui-pst-line, #e8e0d7) 70%, var(--ui-pst-line-on, #6f625a));
  --ui-pst-fill-ink: color-mix(in srgb, var(--ui-pst-line-on, #6f625a) 62%, var(--ui-pst-line, #e8e0d7));
  --ui-pst-fill: 0%;
  --ui-pst-ground: var(--panel, #fffdfb);
  --ui-pst-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-pst-dur-4: var(--nm-dur-4, 380ms);
  --ui-pst-dur-5: var(--nm-dur-5, 620ms);
  --ui-pst-stagger: var(--nm-stagger, 45ms);
  --ui-pst-badge: 36px;
  --ui-pst-dot: 12px;
  --ui-pst-tail: 20px;
  --ui-pst-rule-x: 0px;
  --ui-pst-rule-y: 18px;
  --ui-pst-rule-w: 0px;
  --ui-pst-conn-h: 64px;
  --ui-pst-last: 0;

  position: relative;
  width: 100%;
  color: var(--ui-pst-ink, #1a1410);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 1rem;
  line-height: 1.375;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-pst *,
.ui-pst *::before,
.ui-pst *::after {
  box-sizing: border-box;
}
.ui-pst p {
  margin: 0;
}

/* Rail -------------------------------------------------------------------- */
/* The rail is the measuring frame: the rule and the list share its origin. */
.ui-pst__rail {
  position: relative;
}
/* The stacked gap is the room the connector crosses: one line of air above and below the
 * segment, which the script measures per row so a two-line step keeps the same air. */
.ui-pst__list {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 40px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Rule -------------------------------------------------------------------- */
/* Hidden while stacked; the horizontal layout turns it on and the script sets its span.
 * The reached share is laid over the track as a hard stop at the measured boundary, so the
 * ink never leans on a colour the palette does not already carry. */
.ui-pst__rule {
  display: none;
  position: absolute;
  z-index: 0;
  top: calc(var(--ui-pst-rule-y, 18px) - 0.5px);
  left: var(--ui-pst-rule-x, 0px);
  width: var(--ui-pst-rule-w, 0px);
  height: 1px;
  background-color: var(--ui-pst-track, #e8e0d7);
  background-image: linear-gradient(
    90deg,
    var(--ui-pst-fill-ink, #6f625a) 0,
    var(--ui-pst-fill-ink, #6f625a) var(--ui-pst-fill, 0%),
    transparent var(--ui-pst-fill, 0%),
    transparent 100%
  );
  pointer-events: none;
  transform-origin: 0 50%;
  animation: ui-pst-draw-x var(--ui-pst-dur-5, 620ms) var(--ui-pst-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both;
  animation-delay: calc(var(--ui-pst-stagger, 45ms) * var(--ui-pst-last, 0) + var(--ui-pst-dur-4, 380ms));
}
@keyframes ui-pst-draw-x {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

/* Step -------------------------------------------------------------------- */
.ui-pst__step {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  min-width: 0;
  animation: ui-pst-step-in var(--ui-pst-dur-4, 380ms) var(--ui-pst-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both;
  animation-delay: calc(var(--ui-pst-stagger, 45ms) * var(--ui-pst-i, 0));
}
@keyframes ui-pst-step-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
/* The last badge's column holds the ring dot inside the block, centred on the tail's end. */
.ui-pst__step[data-last="true"] .ui-pst__mark {
  min-height: calc(
    var(--ui-pst-badge, 36px) + 6px + var(--ui-pst-tail, 20px) + var(--ui-pst-dot, 12px) / 2
  );
}

/* Mark -------------------------------------------------------------------- */
.ui-pst__mark {
  position: relative;
  display: flex;
  flex: none;
  align-self: stretch;
  align-items: flex-start;
  justify-content: center;
  width: var(--ui-pst-badge, 36px);
}
.ui-pst__badge {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: var(--ui-pst-badge, 36px);
  height: var(--ui-pst-badge, 36px);
  border-radius: 999px;
  background: var(--ui-pst-ground, #fffdfb);
  box-shadow: inset 0 0 0 1px var(--ui-pst-track, #e8e0d7);
  color: var(--ui-pst-muted, #6f625a);
  font-size: 1rem;
  font-weight: 500;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  transition:
    color var(--ui-pst-dur-4, 380ms) var(--ui-pst-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    background-color var(--ui-pst-dur-4, 380ms) var(--ui-pst-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    box-shadow var(--ui-pst-dur-4, 380ms) var(--ui-pst-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-pst__step[data-state="reached"] .ui-pst__badge {
  background: var(--ui-pst-accent, #c2410c);
  box-shadow: inset 0 0 0 1px var(--ui-pst-accent, #c2410c);
  color: var(--ui-pst-on-accent, #fffdfb);
}

/* Connector --------------------------------------------------------------- */
/* Its height is the measured gap to the next badge; the last one is the short tail. */
.ui-pst__connector {
  position: absolute;
  top: calc(var(--ui-pst-badge, 36px) + 6px);
  left: 50%;
  width: 1px;
  height: var(--ui-pst-conn-h, 64px);
  margin-left: -0.5px;
  background: var(--ui-pst-track, #e8e0d7);
  transform-origin: 50% 0;
  animation: ui-pst-draw-y var(--ui-pst-dur-5, 620ms) var(--ui-pst-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both;
  animation-delay: calc(var(--ui-pst-stagger, 45ms) * var(--ui-pst-i, 0) + var(--ui-pst-dur-4, 380ms));
}
/* The segment between two reached badges carries the reached ink; the one that leaves the
 * last reached badge stays on the track. */
.ui-pst__step[data-link="on"] .ui-pst__connector {
  background: var(--ui-pst-fill-ink, #6f625a);
}
.ui-pst__step[data-last="true"] .ui-pst__connector {
  height: var(--ui-pst-tail, 20px);
}
@keyframes ui-pst-draw-y {
  from {
    transform: scaleY(0);
  }
  to {
    transform: scaleY(1);
  }
}

/* Ring dot ---------------------------------------------------------------- */
/* The ring is centred on the line's end, so the line closes into it instead of stopping
 * short. It carries the reached ink once the last step is reached; before that it stays on
 * the track, because the ember belongs to the steps and not to a marker nobody reached. */
.ui-pst__dot {
  position: absolute;
  top: calc(
    var(--ui-pst-badge, 36px) + 6px + var(--ui-pst-tail, 20px) - var(--ui-pst-dot, 12px) / 2
  );
  left: 50%;
  width: var(--ui-pst-dot, 12px);
  height: var(--ui-pst-dot, 12px);
  margin-left: calc(var(--ui-pst-dot, 12px) / -2);
  border-radius: 999px;
  background: var(--ui-pst-ground, #fffdfb);
  box-shadow: inset 0 0 0 2px var(--ui-pst-track, #e8e0d7);
  transition: box-shadow var(--ui-pst-dur-4, 380ms) var(--ui-pst-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-pst__step[data-last="true"][data-state="reached"] .ui-pst__dot {
  box-shadow: inset 0 0 0 2px var(--ui-pst-accent, #c2410c);
}

/* Body -------------------------------------------------------------------- */
.ui-pst__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding-top: 7px;
}
.ui-pst__title {
  max-width: 34rem;
  color: var(--ui-pst-muted, #6f625a);
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.375;
  overflow-wrap: anywhere;
  transition: color var(--ui-pst-dur-4, 380ms) var(--ui-pst-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-pst__step[data-state="reached"] .ui-pst__title {
  color: var(--ui-pst-accent, #c2410c);
}
.ui-pst__detail {
  max-width: 34rem;
  color: var(--ui-pst-muted, #6f625a);
  font-size: 0.8125rem;
  font-weight: 400;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

/* Horizontal -------------------------------------------------------------- */
/* From 640px up the steps share a row; below it the stacked layout above holds, so the rule
 * never runs past the edge at 320px. */
@media (min-width: 640px) {
  .ui-pst[data-orientation="horizontal"] .ui-pst__list {
    grid-template-columns: none;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 24px;
  }
  /* The badge rides above the text; the mark leaves the flow so the text starts at the
   * column's left edge. */
  .ui-pst[data-orientation="horizontal"] .ui-pst__step {
    display: block;
  }
  .ui-pst[data-orientation="horizontal"] .ui-pst__mark {
    position: absolute;
    top: 0;
    left: 0;
    min-height: 0;
    align-self: auto;
  }
  .ui-pst[data-orientation="horizontal"] .ui-pst__connector {
    display: none;
  }
  /* The text sits below the badge, out of the band the rule crosses. It keeps the badge's
   * left edge instead of indenting past it: in a four-column row the indent only bought a
   * ragged second line, and the width is better spent on the title. */
  .ui-pst[data-orientation="horizontal"] .ui-pst__body {
    padding: calc(var(--ui-pst-badge, 36px) + 4px) 0 0 0;
  }
  .ui-pst[data-orientation="horizontal"] .ui-pst__title,
  .ui-pst[data-orientation="horizontal"] .ui-pst__detail {
    max-width: 16rem;
  }
  .ui-pst[data-orientation="horizontal"] .ui-pst__dot {
    top: calc(var(--ui-pst-badge, 36px) / 2 - var(--ui-pst-dot, 12px) / 2);
    left: calc(var(--ui-pst-badge, 36px) + 14px);
    margin-left: 0;
  }
  .ui-pst[data-orientation="horizontal"] .ui-pst__rule {
    display: block;
  }
}

/* Edges ------------------------------------------------------------------- */
.ui-pst__empty {
  color: var(--ui-pst-muted, #6f625a);
  font-size: 0.9375rem;
  line-height: 1.5;
}
.ui-pst__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

:where(.dark, [data-theme="dark"]) .ui-pst {
  --ui-pst-ink: var(--text, #f4ece4);
  --ui-pst-muted: var(--text-muted, #a2958a);
  --ui-pst-accent: var(--accent, #ff6b35);
  --ui-pst-on-accent: var(--accent-fg, #14100d);
  --ui-pst-line: var(--border, #33291f);
  --ui-pst-ground: var(--panel, #1a1512);
}

@media (prefers-reduced-motion: reduce) {
  .ui-pst__step,
  .ui-pst__connector,
  .ui-pst__rule {
    animation: none;
  }
  .ui-pst__badge,
  .ui-pst__dot,
  .ui-pst__title {
    transition-duration: 1ms;
  }
}
`;
