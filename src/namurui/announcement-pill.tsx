"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TransitionEvent as ReactTransitionEvent,
} from "react";

/*
 * Announcement Pill: one line of launch news, a small ember chip, the message beside it, and an
 * optional dismiss. The root is an anchor when the pill points somewhere and a span when it does
 * not, so the whole notice is a single target. A dismiss fades and lifts the pill on the leave
 * curve and reports once the fade has finished; the pill never removes itself, the host does.
 * Styles are injected below, so no extra files are needed.
 */

export type AnnouncementPillProps = {
  /** Chip text, set in small caps: "Baru", "New", "Beta" */
  label?: string;
  /** The notice itself */
  children: ReactNode;
  /** Called once the leave animation has finished; without it no dismiss button renders */
  onDismiss?: () => void;
  /** Makes the whole pill a link */
  href?: string;
  /** Accessible name for the dismiss button */
  dismissLabel?: string;
  /** Extra class on the root */
  className?: string;
};

/* A fallback for a pill that is hidden before its transition can end, where no transition event
 * arrives. A visible pill is timed from its own computed leave duration instead. */
const LEAVE_FLOOR = 320;

export function AnnouncementPill({
  label = "Baru",
  children,
  onDismiss,
  href,
  dismissLabel = "Dismiss announcement",
  className,
}: AnnouncementPillProps) {
  const [phase, setPhase] = useState<"in" | "out">("in");
  const anchor = useRef<HTMLAnchorElement>(null);
  const span = useRef<HTMLSpanElement>(null);
  const latest = useRef(onDismiss);
  const reported = useRef(false);

  /* The callback is read through a ref, so a host that re-renders with a fresh arrow function
   * does not restart the leave timer or the report. */
  useEffect(() => {
    latest.current = onDismiss;
  }, [onDismiss]);

  /* Both the transition end and the timer floor can land, and a host that keeps the pill mounted
   * would otherwise hear the callback twice. */
  const report = () => {
    if (reported.current) return;
    reported.current = true;
    latest.current?.();
  };

  useEffect(() => {
    if (phase !== "out") return;
    const node = anchor.current ?? span.current;
    let wait = LEAVE_FLOOR;
    if (node !== null) {
      const durations = window
        .getComputedStyle(node)
        .transitionDuration.split(",")
        .map((part) => Number.parseFloat(part) || 0);
      const longest = durations.reduce((most, value) => Math.max(most, value), 0);
      if (longest > 0) wait = Math.round(longest * 1000) + 80;
    }
    const timer = window.setTimeout(report, wait);
    return () => window.clearTimeout(timer);
    // `report` closes over refs only, so the phase is the whole dependency.
  }, [phase]);

  const onLeaveEnd = (event: ReactTransitionEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.propertyName !== "opacity") return;
    if (phase !== "out") return;
    report();
  };

  const rootClass = ["ui-anp", className].filter(Boolean).join(" ");

  const body = (
    <>
      <style href="ui-announcement-pill" precedence="default">
        {css}
      </style>
      <span className="ui-anp__chip">{label}</span>
      <span className="ui-anp__message">{children}</span>
      {onDismiss ? (
        <button
          type="button"
          className="ui-anp__dismiss"
          aria-label={dismissLabel}
          onClick={(event) => {
            /* The button can sit inside the anchor, so a dismiss must never follow the link. */
            event.preventDefault();
            event.stopPropagation();
            setPhase("out");
          }}
        >
          <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" focusable="false">
            <path
              d="M1.5 1.5 8.5 8.5M8.5 1.5 1.5 8.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      ) : null}
    </>
  );

  if (href !== undefined) {
    return (
      <a
        ref={anchor}
        className={rootClass}
        href={href}
        data-state={phase}
        data-dismiss={onDismiss ? "true" : undefined}
        onTransitionEnd={onLeaveEnd}
      >
        {body}
      </a>
    );
  }

  return (
    <span
      ref={span}
      className={rootClass}
      data-state={phase}
      data-dismiss={onDismiss ? "true" : undefined}
      onTransitionEnd={onLeaveEnd}
    >
      {body}
    </span>
  );
}

const css = /* css */ `
.ui-anp {
  /* Knobs. Override any of these on .ui-anp to retheme the pill in a host. */
  --ui-anp-ink: var(--text, #1a1410);
  --ui-anp-muted: var(--text-muted, #6f625a);
  --ui-anp-bg: var(--panel, #fffdfb);
  --ui-anp-bg-hover: #f8f0e9;
  --ui-anp-line: var(--border, #e8e0d7);
  --ui-anp-line-hover: #d6c5b5;
  --ui-anp-wash: #7a4a1c12;
  --ui-anp-chip: var(--accent, #c2410c);
  --ui-anp-chip-ink: var(--accent-fg, #fffdfb);
  --ui-anp-focus: var(--accent, #c2410c);
  --ui-anp-dur: var(--nm-dur-3, 240ms);
  --ui-anp-dur-out: var(--nm-dur-3, 240ms);
  --ui-anp-dur-fast: var(--nm-dur-2, 160ms);
  --ui-anp-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-anp-ease-in: var(--nm-ease-in, cubic-bezier(0.55, 0, 0.68, 0.19));

  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  max-width: 100%;
  height: 29px;
  padding: 0 4px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-anp-bg);
  box-shadow: inset 0 0 0 1px var(--ui-anp-line);
  color: var(--ui-anp-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 0.8rem;
  line-height: 1.35;
  text-decoration: none;
  vertical-align: middle;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
  -webkit-tap-highlight-color: transparent;
  animation: ui-anp-in var(--ui-anp-dur) var(--ui-anp-ease-out) backwards;
  transition:
    background-color var(--ui-anp-dur-fast) var(--ui-anp-ease-out),
    box-shadow var(--ui-anp-dur-fast) var(--ui-anp-ease-out),
    opacity var(--ui-anp-dur-out) var(--ui-anp-ease-in),
    transform var(--ui-anp-dur-out) var(--ui-anp-ease-in);
}
.ui-anp *,
.ui-anp *::before,
.ui-anp *::after {
  box-sizing: border-box;
}

/* A pill that points somewhere lifts its ground and its line on hover, so the whole notice reads
 * as one target rather than as a label with a link buried in it. */
a.ui-anp:hover {
  background: var(--ui-anp-bg-hover);
  box-shadow: inset 0 0 0 1px var(--ui-anp-line-hover);
}
a.ui-anp:focus-visible {
  outline: 2px solid var(--ui-anp-focus);
  outline-offset: 2px;
}

/* The chip ---------------------------------------------------------------- */
.ui-anp__chip {
  display: inline-flex;
  align-items: center;
  flex: none;
  height: 21px;
  padding: 0 8px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-anp-chip);
  color: var(--ui-anp-chip-ink);
  /* 11px, the floor for text that carries meaning. The tracking keeps the uppercase label
   * reading as a chip rather than as a shouted word. */
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  white-space: nowrap;
}

/* The message ------------------------------------------------------------- */
.ui-anp__message {
  min-width: 0;
  padding-inline-end: 9px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-anp[data-dismiss="true"] {
  /* The dismiss box is 44px wide with -11px inline margins, so its 22px visible footprint lands
   * at the pill's end padding edge. Without this 12px the box hung 7px past the rounded cap and
   * the pill's scroll width exceeded its border box. */
  padding-inline-end: 12px;
}


/* The notice fits on one line down to about 420px; below that it truncates to "Billing move…",
 * which carries nothing. Under 420px the pill takes the band's full width and the message wraps
 * and clamps to two lines, with the chip and the dismiss centred on the taller pill. */
@media (max-width: 419px) {
  .ui-anp {
    width: 100%;
    height: auto;
    min-height: 29px;
    padding-block: 5px;
  }
  .ui-anp__message {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    padding-block: 1px;
    white-space: normal;
    overflow-wrap: break-word;
  }
}

/* The dismiss button ------------------------------------------------------ */
/* The button's own box is the 44px target. Negative margins give it a 22px footprint inside the
 * 29px pill, and the visible hover ground is drawn on the inner 22px circle, so nothing on screen
 * grows with the pointer target. */
.ui-anp__dismiss {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 44px;
  height: 44px;
  margin: -7.5px -11px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-pill, 999px);
  background: transparent;
  color: var(--ui-anp-muted);
  font: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: color var(--ui-anp-dur-fast) var(--ui-anp-ease-out);
}
.ui-anp__dismiss::before {
  content: "";
  position: absolute;
  inset: 11px;
  border-radius: var(--radius-pill, 999px);
  background: transparent;
  transition: background-color var(--ui-anp-dur-fast) var(--ui-anp-ease-out);
}
.ui-anp__dismiss:hover {
  color: var(--ui-anp-ink);
}
.ui-anp__dismiss:hover::before {
  background: var(--ui-anp-wash);
}
.ui-anp__dismiss:focus-visible {
  outline: 2px solid var(--ui-anp-focus);
  outline-offset: -11px;
}

/* Leaving ----------------------------------------------------------------- */
/* Only opacity and transform move. The pill keeps its space until the host removes it, so a row
 * of chrome does not reflow twice for one dismissal. */
.ui-anp[data-state="out"] {
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
  pointer-events: none;
  transition:
    opacity var(--ui-anp-dur-out) var(--ui-anp-ease-in),
    transform var(--ui-anp-dur-out) var(--ui-anp-ease-in);
}

@keyframes ui-anp-in {
  from {
    opacity: 0;
    transform: translateY(3px) scale(0.98);
  }
}

:where(.dark, [data-theme="dark"]) .ui-anp {
  --ui-anp-ink: var(--text, #f4ece4);
  --ui-anp-muted: var(--text-muted, #a2958a);
  --ui-anp-bg: var(--panel, #1a1512);
  --ui-anp-bg-hover: #241d17;
  --ui-anp-line: var(--border, #33291f);
  --ui-anp-line-hover: #4b3a2c;
  --ui-anp-wash: #ffffff14;
  --ui-anp-chip: var(--accent, #ff6b35);
  --ui-anp-chip-ink: var(--accent-fg, #1a0f08);
  --ui-anp-focus: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  .ui-anp,
  .ui-anp[data-state="out"] {
    animation: none;
    transition-duration: 1ms;
  }
  .ui-anp[data-state="out"] {
    transform: none;
  }
}
`;
