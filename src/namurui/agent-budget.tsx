"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/*
 * Agent Budget: what a run has spent against its token ceiling, the allowance left, and where
 * the run lands if the current rate holds. The three segments grow to their share of the bar
 * once on mount and again whenever a count changes, each on its own step of the stagger so the
 * reveal reads left to right; the limit marker and its tag travel with them. Once the run has
 * passed its ceiling the overflowed part of the bar breathes at the ambient step, which is slow
 * and low enough to be noticed over a long session without being alarming. Styles are injected
 * below, so no extra files are needed.
 */

export type BudgetPartKind = "input" | "output" | "cached";

export type BudgetPart = {
  /** Which window the tokens were spent in */
  kind: BudgetPartKind;
  /** Tokens counted in this part */
  tokens: number;
};

export type BudgetState = "measuring" | "under" | "tight" | "over";

export type AgentBudgetProps = {
  /** Run the budget belongs to */
  title?: string;
  /** Token ceiling for the run */
  limit?: number;
  /** Token parts, in bar and legend order */
  segments?: readonly BudgetPart[];
  /** Tokens per minute measured over the last turns; omit until there is a rate */
  rate?: number;
  /** Seconds of run left, so the projection knows where the run lands */
  endsInSeconds?: number;
  /** Extra class on the root */
  className?: string;
};

const PART_LABEL: Record<BudgetPartKind, string> = {
  input: "Input",
  output: "Output",
  cached: "Cached",
};

const STATE_WORD: Record<BudgetState, string> = {
  measuring: "Measuring",
  under: "Within budget",
  tight: "Pacing over",
  over: "Over budget",
};

/* Read into the meter's value text, where a bare word would be ambiguous */
const METER_WORD: Record<BudgetState, string> = {
  measuring: "no projection yet",
  under: "within budget",
  tight: "pacing over the limit",
  over: "over budget",
};

/* Tokens per window. The arrow points the way the tokens travel: into the context,
 * out of it, and back into it when they are served from cache. */
const PART_GLYPH: Record<BudgetPartKind, ReactNode> = {
  input: (
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.4 7h5.4" />
      <path d="M5.3 4.5 7.8 7l-2.5 2.5" />
      <path d="M10.9 2.7v8.6" />
    </svg>
  ),
  output: (
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.1 2.7v8.6" />
      <path d="M5.4 7h5.4" />
      <path d="M8.5 4.5 11 7l-2.5 2.5" />
    </svg>
  ),
  cached: (
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11.5 9.4A4.6 4.6 0 0 0 6.9 4.8H4.5" />
      <path d="M7 2.3 4.5 4.8 7 7.3" />
    </svg>
  ),
};

/* One glyph per state: how far a bar reaches against its mark. */
const STATE_GLYPH: Record<BudgetState, ReactNode> = {
  measuring: (
    <svg viewBox="0 0 12 12" width="12" height="12" fill="none" aria-hidden="true">
      <circle cx="2.4" cy="6" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="6" cy="6" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="9.6" cy="6" r="0.95" fill="currentColor" stroke="none" />
    </svg>
  ),
  under: (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M1.4 6h3.9" />
      <path d="M9.5 3.3v5.4" />
    </svg>
  ),
  tight: (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M1.4 6h6.4" />
      <path d="M9.5 3.3v5.4" />
    </svg>
  ),
  over: (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M1.4 6h9.2" />
      <path d="M6.1 3.3v5.4" />
    </svg>
  ),
};

/* The track carries a quarter again the ceiling, so the limit marker stands inside
 * the bar and everything before it reads as spend against a reference. */
const HEADROOM = 1.25;

/* Visual gap between two segments, in pixels of the track */
const GAP = 3;

const exact = (value: number) => Math.max(0, Math.round(value)).toLocaleString("en-US");

/* Thousands separate below ten thousand; from there the figure goes compact, so a
 * budget read-out stays a glance rather than a count. */
function compact(value: number): string {
  const n = Math.max(0, Math.round(value));
  if (n < 10_000) return exact(n);
  const one = (part: number) => (Math.round(part * 10) / 10).toFixed(1).replace(/\.0$/, "");
  if (n < 1_000_000) return `${n >= 100_000 ? exact(Math.round(n / 1000)) : one(n / 1000)}k`;
  return `${one(n / 1_000_000)}M`;
}

function duration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes}m ${String(total % 60).padStart(2, "0")}s`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

export function AgentBudget({
  title = "Untitled",
  limit = 200_000,
  segments = [],
  rate,
  endsInSeconds,
  className,
}: AgentBudgetProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackW, setTrackW] = useState(0);
  const [grown, setGrown] = useState(false);
  const [solo, setSolo] = useState<BudgetPartKind | null>(null);

  /* The bar is laid out in pixels of a measured track, so the segments stay exact and
   * the gaps between them stay a real gap at any width from 320px up. */
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => setTrackW(el.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* One frame at zero width, then every segment grows to its share */
  useEffect(() => {
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const ceiling = Math.max(0, limit);
  const spent = segments.reduce((sum, part) => sum + Math.max(0, part.tokens), 0);
  const over = spent > ceiling;
  const scale = Math.max(spent, ceiling * HEADROOM, 1);
  const under = Math.max(0, ceiling - spent);
  const overBy = Math.max(0, spent - ceiling);

  const perSecond = rate !== undefined && rate > 0 ? rate / 60 : undefined;
  const projected =
    perSecond !== undefined && endsInSeconds !== undefined
      ? spent + perSecond * Math.max(0, endsInSeconds)
      : undefined;
  const state: BudgetState = over
    ? "over"
    : projected === undefined
      ? "measuring"
      : projected > ceiling
        ? "tight"
        : "under";

  const drawn = segments.filter((part) => part.tokens > 0);
  const span = Math.max(0, trackW - Math.max(0, drawn.length - 1) * GAP);
  const placed: { kind: BudgetPartKind; tokens: number; before: number; x: number; w: number }[] = [];
  let cum = 0;
  drawn.forEach((part, index) => {
    placed.push({
      kind: part.kind,
      tokens: part.tokens,
      before: cum,
      x: (cum / scale) * span + index * GAP,
      w: (part.tokens / scale) * span,
    });
    cum += part.tokens;
  });

  const last = placed[placed.length - 1];
  const trackEnd = last ? last.x + last.w : 0;
  const hit = placed.find((part) => part.before + part.tokens > ceiling);
  const markerX = hit
    ? hit.x + ((ceiling - hit.before) / hit.tokens) * hit.w
    : (ceiling / scale) * span + Math.max(0, placed.length - 1) * GAP;
  const spillW = over ? Math.max(0, trackEnd - markerX) : 0;

  const tagAnchor = trackW > 0 && markerX > trackW - 58 ? "-100%" : "-50%";
  const rateText = rate === undefined ? "" : `${compact(rate)} tokens/min`;
  const slack = projected === undefined ? 0 : ceiling - projected;

  let projection: ReactNode;
  if (state === "over") {
    projection =
      projected === undefined ? (
        <>
          Over the ceiling by <b>{compact(overBy)}</b> tokens. Nothing to project the finish from
          yet.
        </>
      ) : (
        <>
          Over the ceiling by <b>{compact(overBy)}</b> tokens, and at {rateText} the run lands at{" "}
          <b>{compact(projected)}</b>.
        </>
      );
  } else if (state === "measuring" || projected === undefined) {
    projection = <>No projection yet. The rate settles once the first turn finishes.</>;
  } else if (state === "tight") {
    projection = (
      <>
        At {rateText} the ceiling is reached in <b>{duration((ceiling - spent) / (perSecond ?? 1))}</b>
        , with <b>{compact(projected - ceiling)}</b> past it by the end of the run.
      </>
    );
  } else if (slack < 1) {
    projection = <>At {rateText} the run lands on the ceiling exactly.</>;
  } else {
    projection = (
      <>
        At {rateText} the run lands at <b>{compact(projected)}</b> tokens,{" "}
        <b>{compact(slack)}</b> under the ceiling.
      </>
    );
  }

  return (
    <div
      className={["ui-agbg", className].filter(Boolean).join(" ")}
      data-state={state}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-agent-budget" precedence="default">
        {css}
      </style>

      <header className="ui-agbg__head">
        <p className="ui-agbg__title" title={title}>
          {title}
        </p>
        <span className="ui-agbg__badge">
          <span className="ui-agbg__badge-glyph" aria-hidden="true">
            {STATE_GLYPH[state]}
          </span>
          {STATE_WORD[state]}
        </span>
      </header>

      <p className="ui-agbg__figure">
        <span className="ui-agbg__spent" title={`${exact(spent)} tokens spent`}>
          <span className="ui-agbg__big">{compact(spent)}</span>
          <span className="ui-agbg__of">of {compact(ceiling)} tokens</span>
        </span>
        <span className="ui-agbg__rest">
          <span
            className="ui-agbg__rest-num"
            title={over ? `${exact(overBy)} over` : `${exact(under)} left`}
          >
            {compact(over ? overBy : under)}
          </span>
          <span className="ui-agbg__rest-word">{over ? "over" : "left"}</span>
        </span>
      </p>

      <div className="ui-agbg__graph">
        <div className="ui-agbg__scale" aria-hidden="true">
          <span
            className="ui-agbg__limit-tag"
            style={{ transform: `translateX(${markerX}px) translateX(${tagAnchor})` }}
          >
            limit {compact(ceiling)}
          </span>
        </div>

        <div
          className="ui-agbg__track"
          ref={trackRef}
          role="meter"
          aria-label={`${title} token budget`}
          aria-valuemin={0}
          aria-valuemax={Math.round(ceiling)}
          aria-valuenow={Math.min(Math.round(spent), Math.round(ceiling))}
          aria-valuetext={`${exact(spent)} of ${exact(ceiling)} tokens spent, ${METER_WORD[state]}`}
        >
          {placed.map((part, index) => (
            <span
              key={part.kind}
              className="ui-agbg__seg"
              data-kind={part.kind}
              data-dim={solo !== null && solo !== part.kind ? "true" : undefined}
              style={{
                transform: `translateX(${part.x}px) scaleX(${grown && trackW > 0 ? part.w / trackW : 0})`,
                transitionDelay: `calc(var(--ui-agbg-stagger) * ${index})`,
              }}
            />
          ))}
          {spillW > 0 ? (
            <span
              className="ui-agbg__spill"
              style={{ transform: `translateX(${markerX}px) scaleX(${grown && trackW > 0 ? spillW / trackW : 0})` }}
            />
          ) : null}
          <span className="ui-agbg__mark" style={{ transform: `translateX(${markerX}px)` }} />
        </div>
      </div>

      <div className="ui-agbg__legend" role="group" aria-label="Tokens by window">
        {segments.map((part) => (
          <button
            key={part.kind}
            type="button"
            className="ui-agbg__part"
            data-kind={part.kind}
            data-dim={solo !== null && solo !== part.kind ? "true" : undefined}
            aria-pressed={solo === part.kind}
            title={`${exact(part.tokens)} tokens`}
            onClick={() => setSolo((current) => (current === part.kind ? null : part.kind))}
          >
            <span className="ui-agbg__glyph">{PART_GLYPH[part.kind]}</span>
            <span className="ui-agbg__part-label">{PART_LABEL[part.kind]}</span>
            <span className="ui-agbg__part-value">{compact(part.tokens)}</span>
            <span className="ui-agbg__part-share">
              {spent > 0 ? Math.round((part.tokens / spent) * 100) : 0}%
            </span>
          </button>
        ))}
      </div>

      <p className="ui-agbg__projection" role="status" aria-live="polite">
        <span className="ui-agbg__rail" aria-hidden="true" />
        {projection}
      </p>
    </div>
  );
}

const css = /* css */ `
.ui-agbg {
  /* Knobs. Override any of these on .ui-agbg to retheme the meter in a host. */
  --ui-agbg-ink: var(--text, #1a1410);
  --ui-agbg-muted: var(--text-muted, #6f625a);
  --ui-agbg-panel: var(--panel, #fffdfb);
  --ui-agbg-line: var(--border, #e8e0d7);
  --ui-agbg-edge: var(--border-soft, #1a14101a);
  --ui-agbg-track: #7a4a1c0f;
  --ui-agbg-wash: #7a4a1c0a;
  --ui-agbg-mark: #1a141066;
  --ui-agbg-input: var(--accent, #c2410c);
  --ui-agbg-output: #8a4b1f;
  --ui-agbg-cached: #a2958a;
  --ui-agbg-spill: var(--accent, #c2410c);
  --ui-agbg-ok: var(--success, #1a7a4a);
  --ui-agbg-warn: var(--warning, #9a6410);
  --ui-agbg-danger: var(--danger, #b3261e);
  --ui-agbg-focus: var(--accent, #c2410c);
  --ui-agbg-ease: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-agbg-ease-soft: var(--nm-ease-soft, cubic-bezier(0.4, 0, 0.2, 1));
  --ui-agbg-dur: var(--nm-dur-2, 160ms);
  --ui-agbg-dur-grow: var(--nm-dur-5, 620ms);
  --ui-agbg-dur-pulse: var(--nm-dur-6, 1100ms);
  --ui-agbg-stagger: var(--nm-stagger, 45ms);
  /* The tone carries the state; the word beside it says the same thing, so a status
   * is never colour alone. */
  --ui-agbg-tone: var(--ui-agbg-muted);

  box-sizing: border-box;
  display: grid;
  gap: 10px;
  width: 100%;
  padding: 16px 18px 18px;
  background: var(--ui-agbg-panel);
  border-radius: var(--radius-card, 16px);
  box-shadow: inset 0 0 0 1px var(--ui-agbg-line);
  color: var(--ui-agbg-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 18px;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-agbg *,
.ui-agbg *::before,
.ui-agbg *::after {
  box-sizing: border-box;
}
.ui-agbg p {
  margin: 0;
}
:where(.ui-agbg) button {
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
:where(.ui-agbg) svg {
  display: block;
}

/* One tone per state, so the badge, the rest read-out and the projection rail agree.
 * Measuring keeps the muted tone: there is no verdict to colour yet. */
.ui-agbg[data-state="under"] {
  --ui-agbg-tone: var(--ui-agbg-ok);
}
.ui-agbg[data-state="tight"] {
  --ui-agbg-tone: var(--ui-agbg-warn);
}
.ui-agbg[data-state="over"] {
  --ui-agbg-tone: var(--ui-agbg-danger);
}

/* Header ------------------------------------------------------------------ */
.ui-agbg__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 20px;
}
.ui-agbg__title {
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  color: var(--ui-agbg-ink);
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-agbg__badge {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  height: 20px;
  padding: 0 8px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-agbg-wash);
  color: var(--ui-agbg-tone);
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
  transition: color var(--ui-agbg-dur) var(--ui-agbg-ease);
}
.ui-agbg__badge-glyph {
  display: grid;
  place-items: center;
  width: 12px;
  height: 12px;
}

/* Figures ----------------------------------------------------------------- */
.ui-agbg__figure {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 2px 12px;
}
.ui-agbg__spent {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}
.ui-agbg__big {
  font-size: 26px;
  font-weight: 500;
  line-height: 32px;
  letter-spacing: -0.02em;
  color: var(--ui-agbg-ink);
  font-variant-numeric: tabular-nums;
}
.ui-agbg__of {
  font-size: 12px;
  line-height: 18px;
  color: var(--ui-agbg-muted);
  white-space: nowrap;
}
.ui-agbg__rest {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  padding-bottom: 3px;
}
.ui-agbg__rest-num {
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  color: var(--ui-agbg-muted);
  font-variant-numeric: tabular-nums;
  transition: color var(--ui-agbg-dur) var(--ui-agbg-ease);
}
.ui-agbg[data-state="over"] .ui-agbg__rest-num {
  color: var(--ui-agbg-tone);
}
.ui-agbg__rest-word {
  font-size: 11.5px;
  color: var(--ui-agbg-muted);
}

/* The bar ----------------------------------------------------------------- */
.ui-agbg__graph {
  display: grid;
  gap: 5px;
}
.ui-agbg__scale {
  position: relative;
  height: 14px;
}
.ui-agbg__limit-tag {
  position: absolute;
  top: 0;
  left: 0;
  font-size: 10.5px;
  font-weight: 500;
  line-height: 14px;
  color: var(--ui-agbg-muted);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  transition: transform var(--ui-agbg-dur-grow) var(--ui-agbg-ease);
}
.ui-agbg__track {
  position: relative;
  height: 12px;
  overflow: hidden;
  background: var(--ui-agbg-track);
  border-radius: var(--radius-pill, 999px);
  box-shadow: inset 0 0 0 1px var(--ui-agbg-edge);
}
/* Every segment is a full-width element moved and sized by transform, so the bar
 * grows without a single width or left transition. */
.ui-agbg__seg {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  border-radius: 3px;
  transform: translateX(0) scaleX(0);
  transform-origin: 0 50%;
  transition:
    transform var(--ui-agbg-dur-grow) var(--ui-agbg-ease),
    opacity var(--ui-agbg-dur) var(--ui-agbg-ease);
}
.ui-agbg__seg[data-kind="input"] {
  background: var(--ui-agbg-input);
}
.ui-agbg__seg[data-kind="output"] {
  background: var(--ui-agbg-output);
}
.ui-agbg__seg[data-kind="cached"] {
  background: var(--ui-agbg-cached);
}
.ui-agbg__seg[data-dim="true"] {
  opacity: 0.3;
}
/* The part of the bar past the ceiling. Hatching keeps it legible when the fill under
 * it is light, and the pulse is ambient so an exceeded budget is noticed, not shouted. */
.ui-agbg__spill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  transform: translateX(0) scaleX(0);
  transform-origin: 0 50%;
  background: repeating-linear-gradient(
    115deg,
    var(--ui-agbg-spill) 0 2px,
    transparent 2px 5px
  );
  opacity: 0.32;
  pointer-events: none;
  transition: transform var(--ui-agbg-dur-grow) var(--ui-agbg-ease);
  animation: ui-agbg-spill var(--ui-agbg-dur-pulse) var(--ui-agbg-ease-soft) infinite alternate;
}
@keyframes ui-agbg-spill {
  from {
    opacity: 0.16;
  }
  to {
    opacity: 0.46;
  }
}
.ui-agbg__mark {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  transform: translateX(0);
  box-shadow: inset 1.5px 0 0 0 var(--ui-agbg-mark);
  pointer-events: none;
  transition: transform var(--ui-agbg-dur-grow) var(--ui-agbg-ease);
}

/* Legend ------------------------------------------------------------------ */
.ui-agbg__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.ui-agbg__part {
  display: flex;
  flex: 1 1 104px;
  align-items: center;
  gap: 6px;
  min-width: 0;
  height: 26px;
  padding: 0 8px;
  border-radius: 8px;
  color: var(--ui-agbg-muted);
  font-size: 11.5px;
  line-height: 16px;
  transition:
    color var(--ui-agbg-dur) var(--ui-agbg-ease),
    background-color var(--ui-agbg-dur) var(--ui-agbg-ease),
    opacity var(--ui-agbg-dur) var(--ui-agbg-ease);
}
.ui-agbg__part:hover {
  background: var(--ui-agbg-wash);
  color: var(--ui-agbg-ink);
}
.ui-agbg__part[aria-pressed="true"] {
  background: var(--ui-agbg-wash);
  box-shadow: inset 0 0 0 1px var(--ui-agbg-edge);
  color: var(--ui-agbg-ink);
}
.ui-agbg__part[data-dim="true"] {
  opacity: 0.36;
}
.ui-agbg__part:focus-visible {
  outline: 2px solid var(--ui-agbg-focus);
  outline-offset: 1px;
}
.ui-agbg__glyph {
  display: grid;
  flex: none;
  place-items: center;
  width: 14px;
  height: 14px;
}
.ui-agbg__part[data-kind="input"] .ui-agbg__glyph {
  color: var(--ui-agbg-input);
}
.ui-agbg__part[data-kind="output"] .ui-agbg__glyph {
  color: var(--ui-agbg-output);
}
.ui-agbg__part[data-kind="cached"] .ui-agbg__glyph {
  color: var(--ui-agbg-cached);
}
.ui-agbg__part-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-agbg__part-value {
  flex: none;
  color: var(--ui-agbg-ink);
  font-variant-numeric: tabular-nums;
}
.ui-agbg__part-share {
  flex: none;
  color: var(--ui-agbg-muted);
  font-variant-numeric: tabular-nums;
}

/* Projection -------------------------------------------------------------- */
.ui-agbg__projection {
  position: relative;
  padding: 8px 11px 8px 16px;
  border-radius: var(--radius-preview, 12px);
  background: var(--ui-agbg-wash);
  color: var(--ui-agbg-muted);
  font-size: 12px;
  line-height: 18px;
}
.ui-agbg__projection b {
  font-weight: 500;
  color: var(--ui-agbg-ink);
  font-variant-numeric: tabular-nums;
}
.ui-agbg__rail {
  position: absolute;
  left: 6px;
  top: 9px;
  bottom: 9px;
  width: 2px;
  border-radius: 999px;
  background: var(--ui-agbg-tone);
  transition: background-color var(--ui-agbg-dur) var(--ui-agbg-ease);
}

:where(.dark, [data-theme="dark"]) .ui-agbg {
  --ui-agbg-ink: var(--text, #f4ece4);
  --ui-agbg-muted: var(--text-muted, #a2958a);
  --ui-agbg-panel: var(--panel, #1a1512);
  --ui-agbg-line: var(--border, #33291f);
  --ui-agbg-edge: var(--border-soft, #ffffff12);
  --ui-agbg-track: #ffffff12;
  --ui-agbg-wash: #ffffff0d;
  --ui-agbg-mark: #ffffff80;
  --ui-agbg-input: var(--accent, #ff6b35);
  --ui-agbg-output: #c2703a;
  --ui-agbg-cached: #8f7f70;
  --ui-agbg-spill: var(--accent, #ff6b35);
  --ui-agbg-ok: var(--success, #4f9d6e);
  --ui-agbg-warn: var(--warning, #d99530);
  --ui-agbg-danger: var(--danger, #e2544a);
  --ui-agbg-focus: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  .ui-agbg {
    --ui-agbg-stagger: 0ms;
  }
  .ui-agbg__seg,
  .ui-agbg__spill,
  .ui-agbg__mark,
  .ui-agbg__limit-tag,
  .ui-agbg__part,
  .ui-agbg__badge,
  .ui-agbg__rest-num,
  .ui-agbg__rail {
    transition-duration: 1ms;
  }
  .ui-agbg__spill {
    animation: none;
    opacity: 0.32;
  }
}
`;