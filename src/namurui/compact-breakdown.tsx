"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/*
 * Compact Breakdown – one total split into its parts, in one small card.
 *
 * The total and every row's figure roll to their new numbers in one rAF loop; the stacked bar
 * keeps a segment per part in the order the period lists them, so a period change only glides
 * their widths; the ranked rows slide to their new order with a FLIP; hovering or focusing a row
 * dims the rest and lifts its segment; the period switch is a radiogroup whose pill glides to the
 * checked option. Parts a period drops collapse out and close the gap. Styles are injected below.
 */

export type BreakdownSegment = {
  /** Stable identity across periods – its colour follows it, so a part keeps its hue */
  id: string;
  label: string;
  value: number;
};

export type BreakdownPeriod = {
  id: string;
  /** Copy on the period switch, e.g. "30d" */
  label: string;
  /** The parts of this period's total, in the order the stacked bar shows them */
  segments: BreakdownSegment[];
  /** Change against the previous period in percent – a green or red pill beside the total */
  delta?: number;
};

export type CompactBreakdownProps = {
  /** One entry per period: its parts, and how the total moved into it */
  periods: BreakdownPeriod[];
  /** Controlled period id; leave out to let the card hold its own */
  period?: string;
  /** Period shown first when uncontrolled */
  defaultPeriod?: string;
  onPeriodChange?: (id: string) => void;
  title?: string;
  /** Name of the total under the big number */
  caption?: string;
  /** How every figure is written – money by default */
  formatValue?: (value: number) => string;
  /** Accessible name of the period switch */
  periodLabel?: string;
  /** Replaces the automatic "Largest: …" line; pass null to drop the foot entirely */
  footer?: ReactNode;
  className?: string;
};

const SERIES = [
  "var(--ui-cbc-c1)",
  "var(--ui-cbc-c2)",
  "var(--ui-cbc-c3)",
  "var(--ui-cbc-c4)",
  "var(--ui-cbc-c5)",
];

/** The total rides in the same tween as the parts, under this key rather than an id. */
const TOTAL_KEY = "ui-cbc-total";

/* The sheet owns the bar's choreography; the FLIP and the pill need numbers in JS. Both repeat
 * the sheet's own 320ms and cubic-bezier(0.22, 1, 0.36, 1). */
const FLIP_MS = 320;
const FLIP_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const ROLL_MS = 560;

type Pill = { width: number; height: number; x: number; y: number };

/**
 * Tween every keyed number towards its target in one rAF loop and return what to draw.
 * `signature` describes the targets by value, so a parent rebuilding its arrays each render does
 * not restart the tween; a key that disappears simply stops being drawn.
 */
function useRolledValues(targets: Record<string, number>, signature: string) {
  const latest = useRef(targets);
  latest.current = targets;
  const live = useRef<Record<string, number>>(targets);
  const frame = useRef(0);
  const [shown, setShown] = useState<Record<string, number>>(targets);

  useEffect(() => {
    const target = latest.current;
    const from: Record<string, number> = {};
    let moving = false;
    for (const key of Object.keys(target)) {
      const previous = live.current[key];
      from[key] = previous ?? target[key];
      if (previous !== undefined && previous !== target[key]) moving = true;
    }

    /* Nothing moved: the drawn numbers already equal the targets. */
    if (!moving) {
      live.current = { ...live.current, ...target };
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      live.current = target;
      setShown(target);
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / ROLL_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next: Record<string, number> = {};
      for (const key of Object.keys(target)) {
        next[key] = progress === 1 ? target[key] : from[key] + (target[key] - from[key]) * eased;
      }
      live.current = next;
      setShown(next);
      if (progress < 1) frame.current = requestAnimationFrame(step);
      else live.current = target;
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [signature]);

  return shown;
}

export function CompactBreakdown({
  periods,
  period,
  defaultPeriod,
  onPeriodChange,
  title = "Revenue by channel",
  caption = "Total revenue",
  formatValue = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`,
  periodLabel = "Period",
  footer,
  className,
}: CompactBreakdownProps) {
  const titleId = `${useId()}-title`;
  const [innerPeriod, setInnerPeriod] = useState(defaultPeriod ?? periods[0]?.id ?? "");
  const activeId = period ?? innerPeriod;
  const current = periods.find((entry) => entry.id === activeId) ?? periods[0] ?? EMPTY;

  const [active, setActive] = useState<string | null>(null);
  const [pill, setPill] = useState<Pill | null>(null);

  /* A part keeps the series slot it was first met with, whichever period it turns up in. */
  const slotOf: Record<string, number> = {};
  let nextSlot = 0;
  for (const entry of periods) {
    for (const segment of entry.segments) {
      if (slotOf[segment.id] === undefined) slotOf[segment.id] = nextSlot++;
    }
  }

  const total = current.segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  const ranked = [...current.segments].sort((a, b) => b.value - a.value);
  const largest = ranked[0];

  const targets: Record<string, number> = {};
  for (const segment of current.segments) targets[segment.id] = Math.max(0, segment.value);
  targets[TOTAL_KEY] = total;
  const signature = Object.entries(targets)
    .map(([key, value]) => `${key}:${value}`)
    .join("|");

  const shown = useRolledValues(targets, signature);
  const shownTotal = shown[TOTAL_KEY] ?? total;

  /* Parts of the previous period that this one no longer has, kept one beat to collapse out. */
  const [tracked, setTracked] = useState<{ period: string; segments: BreakdownSegment[]; leaving: BreakdownSegment[] }>(
    { period: current.id, segments: current.segments, leaving: [] },
  );
  if (tracked.period !== current.id) {
    const present = new Set(current.segments.map((segment) => segment.id));
    setTracked({
      period: current.id,
      segments: current.segments,
      leaving: tracked.segments.filter((segment) => !present.has(segment.id)),
    });
  }
  const leaving = tracked.leaving;

  useEffect(() => {
    if (leaving.length === 0) return;
    const timer = window.setTimeout(
      () => setTracked((previous) => (previous.leaving.length === 0 ? previous : { ...previous, leaving: [] })),
      FLIP_MS + 30,
    );
    return () => window.clearTimeout(timer);
  }, [leaving]);

  /* The pill is measured from the checked option – the sheet only animates it there. */
  const options = useRef(new Map<string, HTMLButtonElement>());
  useLayoutEffect(() => {
    const node = options.current.get(current.id);
    if (!node) {
      setPill(null);
      return;
    }
    const next: Pill = { width: node.offsetWidth, height: node.offsetHeight, x: node.offsetLeft, y: node.offsetTop };
    setPill((previous) =>
      previous &&
      previous.width === next.width &&
      previous.height === next.height &&
      previous.x === next.x &&
      previous.y === next.y
        ? previous
        : next,
    );
  });

  /* FLIP: rows are laid out in the new order, then slid back to where they sat a frame ago. */
  const list = useRef<HTMLUListElement>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const tops = useRef(new Map<string, number>());
  const order = [...ranked.map((segment) => segment.id), ...leaving.map((segment) => segment.id)].join("|");

  useLayoutEffect(() => {
    const root = list.current;
    if (!root) return;
    const before = tops.current;
    const after = new Map<string, number>();
    rows.current.forEach((node, id) => {
      if (root.contains(node)) after.set(id, node.offsetTop);
    });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      rows.current.forEach((node, id) => {
        const was = before.get(id);
        const settled = after.get(id);
        if (was === undefined || settled === undefined || was === settled || !root.contains(node)) return;
        node.animate([{ transform: `translateY(${was - settled}px)` }, { transform: "translateY(0px)" }], {
          duration: FLIP_MS,
          easing: FLIP_EASE,
        });
      });
    }
    tops.current = after;
  }, [order]);

  const choosePeriod = (id: string) => {
    if (id === current.id) return;
    if (period === undefined) setInnerPeriod(id);
    onPeriodChange?.(id);
  };

  const onSwitchKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = periods.findIndex((entry) => entry.id === current.id);
    if (index === -1) return;
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % periods.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + periods.length) % periods.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = periods.length - 1;
    else return;
    event.preventDefault();
    choosePeriod(periods[next].id);
    options.current.get(periods[next].id)?.focus();
  };

  /* Held as a number or null so the sign, the copy and the ARIA sentence read one narrowed value. */
  const delta = current.delta !== undefined && Number.isFinite(current.delta) ? current.delta : null;
  const deltaText = delta === null ? "" : `${Math.abs(delta).toFixed(1)}%`;

  return (
    <div className={["ui-cbc", className].filter(Boolean).join(" ")} role="group" aria-labelledby={titleId}>
      <style href="ui-compact-breakdown" precedence="default">
        {css}
      </style>

      <div className="ui-cbc__body">
        <header className="ui-cbc__head">
          <h3 className="ui-cbc__title" id={titleId}>
            {title}
          </h3>

          {periods.length > 0 && (
            <div className="ui-cbc__switch" role="radiogroup" aria-label={periodLabel} onKeyDown={onSwitchKeyDown}>
              <span
                className="ui-cbc__pill"
                aria-hidden="true"
                style={
                  pill
                    ? {
                        width: pill.width,
                        height: pill.height,
                        transform: `translate(${pill.x}px, ${pill.y}px)`,
                        opacity: 1,
                      }
                    : { opacity: 0 }
                }
              />
              {periods.map((entry) => (
                <button
                  key={entry.id}
                  ref={(node) => {
                    if (node) options.current.set(entry.id, node);
                    else options.current.delete(entry.id);
                  }}
                  type="button"
                  role="radio"
                  aria-checked={entry.id === current.id}
                  tabIndex={entry.id === current.id ? 0 : -1}
                  className="ui-cbc__option"
                  onClick={() => choosePeriod(entry.id)}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          )}
        </header>

        <div className="ui-cbc__figure">
          <p className="ui-cbc__big" aria-hidden="true">
            {formatValue(shownTotal)}
          </p>
          {delta !== null && (
            <span
              key={`${current.id}-${deltaText}`}
              className="ui-cbc__delta"
              data-up={delta >= 0 ? "true" : undefined}
            >
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d={delta >= 0 ? "M6 9.5v-7M2.8 5.6 6 2.4l3.2 3.2" : "M6 2.5v7M2.8 6.4 6 9.6l3.2-3.2"} />
              </svg>
              {deltaText}
            </span>
          )}
        </div>

        <p className="ui-cbc__caption" aria-hidden="true">
          <span key={current.id} className="ui-cbc__caption-in">
            {caption}
          </span>
        </p>

        <p className="ui-cbc__sr">
          {caption}: {formatValue(total)}
          {delta === null ? "" : `, ${delta >= 0 ? "up" : "down"} ${deltaText} against the previous period`}
        </p>

        <div className="ui-cbc__bar" aria-hidden="true" data-active={active === null ? undefined : "true"}>
          {current.segments.map((segment) => (
            <span
              key={segment.id}
              className="ui-cbc__seg"
              data-active={active === segment.id ? "true" : undefined}
              style={{
                flexGrow:
                  shownTotal > 0
                    ? Number((((shown[segment.id] ?? segment.value) / shownTotal) * 100).toPrecision(6))
                    : 0,
                background: SERIES[(slotOf[segment.id] ?? 0) % SERIES.length],
              }}
            />
          ))}
        </div>

        <ul className="ui-cbc__list" ref={list} data-active={active === null ? undefined : "true"}>
          {ranked.map((segment) => (
            <li
              key={segment.id}
              className="ui-cbc__row"
              ref={(node) => {
                if (node) rows.current.set(segment.id, node);
                else rows.current.delete(segment.id);
              }}
            >
              <div
                className="ui-cbc__item"
                tabIndex={0}
                data-active={active === segment.id ? "true" : undefined}
                onMouseEnter={() => setActive(segment.id)}
                onMouseLeave={() => setActive((previous) => (previous === segment.id ? null : previous))}
                onFocus={() => setActive(segment.id)}
                onBlur={() => setActive((previous) => (previous === segment.id ? null : previous))}
              >
                <i
                  className="ui-cbc__swatch"
                  style={{ background: SERIES[(slotOf[segment.id] ?? 0) % SERIES.length] }}
                />
                <span className="ui-cbc__label">{segment.label}</span>
                <span className="ui-cbc__value">{formatValue(shown[segment.id] ?? segment.value)}</span>
                <span className="ui-cbc__share">
                  {shownTotal > 0 ? Math.round(((shown[segment.id] ?? segment.value) / shownTotal) * 100) : 0}%
                </span>
              </div>
            </li>
          ))}

          {leaving.map((segment) => (
            <li key={segment.id} className="ui-cbc__row" data-leaving="true">
              <div className="ui-cbc__item">
                <i
                  className="ui-cbc__swatch"
                  style={{ background: SERIES[(slotOf[segment.id] ?? 0) % SERIES.length] }}
                />
                <span className="ui-cbc__label">{segment.label}</span>
                <span className="ui-cbc__value">{formatValue(segment.value)}</span>
                <span className="ui-cbc__share">
                  {shownTotal > 0 ? Math.round((Math.max(0, segment.value) / shownTotal) * 100) : 0}%
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {footer !== null && (
        <div className="ui-cbc__foot">
          <span key={`${current.id}-${largest?.id ?? ""}`} className="ui-cbc__foot-in">
            {footer ?? (
              <>
                Largest: <b>{largest?.label ?? "—"}</b>
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

const EMPTY: BreakdownPeriod = { id: "", label: "", segments: [] };

const css = /* css */ `
.ui-cbc{--ui-cbc-card: #fffdfb;--ui-cbc-ink: rgba(11, 9, 8, 0.88);--ui-cbc-strong: #0b0908;--ui-cbc-text: rgba(11, 9, 8, 0.61);--ui-cbc-muted: rgba(11, 9, 8, 0.45);--ui-cbc-faint: rgba(11, 9, 8, 0.27);--ui-cbc-line: rgba(11, 9, 8, 0.06);--ui-cbc-wash: rgba(11, 9, 8, 0.03);--ui-cbc-fill: rgba(11, 9, 8, 0.06);--ui-cbc-up: #2f8d5c;--ui-cbc-up-bg: rgba(47, 141, 92, 0.08);--ui-cbc-down: #e2544a;--ui-cbc-down-bg: rgba(226, 84, 74, 0.08);--ui-cbc-c1: rgba(217, 84, 31, 0.765);--ui-cbc-c2: rgba(217, 84, 31, 0.5);--ui-cbc-c3: rgba(217, 84, 31, 0.32);--ui-cbc-c4: rgba(217, 84, 31, 0.18);--ui-cbc-c5: rgba(11, 9, 8, 0.14);--ui-cbc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-cbc-focus: rgba(217, 84, 31, 0.35);--ui-cbc-ease: cubic-bezier(0.22, 1, 0.36, 1);--ui-cbc-snap: cubic-bezier(0.25, 0.9, 0.3, 1);box-sizing: border-box;container-type: inline-size;display: grid;width: 100%;max-width: 360px;overflow: hidden;border-radius: 10px;background: var(--ui-cbc-card);box-shadow: var(--ui-cbc-shadow);font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;font-weight: 400;color: var(--ui-cbc-ink);-webkit-font-smoothing: antialiased}
.ui-cbc *, .ui-cbc *::before, .ui-cbc *::after{box-sizing: border-box}
:where(.ui-cbc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;cursor: pointer}
:where(.ui-cbc) :is(h3, p, ul){margin: 0;padding: 0}
:where(.ui-cbc) ul{list-style: none}
:where(.ui-cbc) svg{display: block;flex: none}
.ui-cbc :is(button, [tabindex="0"]):focus-visible{outline: 2px solid var(--ui-cbc-focus);outline-offset: 1px}
.ui-cbc b{font-weight: 500;color: var(--ui-cbc-ink)}
.ui-cbc__sr{position: absolute;width: 1px;height: 1px;overflow: hidden;clip: rect(0 0 0 0);white-space: nowrap}
.ui-cbc__body{padding: 16px 16px 10px}
.ui-cbc__head{display: flex;align-items: center;justify-content: space-between;gap: 12px;min-height: 28px}
.ui-cbc__title{overflow: hidden;font-size: 15px;font-weight: 500;line-height: 24px;color: var(--ui-cbc-strong);white-space: nowrap;text-overflow: ellipsis}
.ui-cbc__switch{position: relative;display: grid;grid-auto-columns: auto;grid-auto-flow: column;gap: 4px;flex: none}
.ui-cbc__pill{position: absolute;top: 0;left: 0;border-radius: 6px;background: var(--ui-cbc-fill);opacity: 0;pointer-events: none;transition: transform var(--nm-dur-2, 160ms) var(--ui-cbc-snap), width var(--nm-dur-2, 160ms) var(--ui-cbc-snap)}
.ui-cbc__option{position: relative;z-index: 1;height: 28px;padding: 4px 10px;border-radius: 6px;box-shadow: inset 0 0 0 0.5px var(--ui-cbc-line);font-size: 13px;font-weight: 500;line-height: 20px;color: var(--ui-cbc-text);white-space: nowrap;transition: color 90ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color 90ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cbc__option[aria-checked="true"]{color: var(--ui-cbc-ink)}
@media (hover: hover){.ui-cbc__option[aria-checked="false"]:hover{background: var(--ui-cbc-wash)}
}
.ui-cbc__figure{display: flex;align-items: center;gap: 8px;margin-top: 14px}
.ui-cbc__big{font-size: 24px;font-weight: 500;line-height: 32px;letter-spacing: -0.02em;color: var(--ui-cbc-strong);font-variant-numeric: tabular-nums}
.ui-cbc__delta{display: inline-flex;align-items: center;gap: 2px;height: 20px;padding: 0 6px 0 4px;border-radius: 5px;background: var(--ui-cbc-down-bg);color: var(--ui-cbc-down);font-size: 12px;font-weight: 500;line-height: 16px;font-variant-numeric: tabular-nums;animation: ui-cbc-pop 380ms var(--ui-cbc-ease) both}
.ui-cbc__delta[data-up]{background: var(--ui-cbc-up-bg);color: var(--ui-cbc-up)}
.ui-cbc__delta svg{width: 12px;height: 12px;fill: none;stroke: currentColor;stroke-width: 1.3;stroke-linecap: round;stroke-linejoin: round}
.ui-cbc__caption{height: 16px;overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-cbc-muted);font-variant-numeric: tabular-nums}
.ui-cbc__caption-in{display: inline-flex;align-items: center;gap: 6px;animation: ui-cbc-in var(--nm-dur-3, 240ms) var(--ui-cbc-ease) both}
.ui-cbc__bar{display: flex;gap: 2px;height: 6px;margin-top: 16px;padding: 0;border-radius: 3px}
.ui-cbc__seg{flex: 0 1 0;height: 100%;min-width: 2px;border-radius: 1.5px;transition: opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-2, 160ms) var(--ui-cbc-ease)}
.ui-cbc__seg:first-child{border-radius: 3px 1.5px 1.5px 3px}
.ui-cbc__seg:last-child{border-radius: 1.5px 3px 3px 1.5px}
.ui-cbc__bar[data-active] .ui-cbc__seg:not([data-active]){opacity: 0.3}
.ui-cbc__seg[data-active]{transform: scaleY(1.5)}
.ui-cbc__list{position: relative;display: grid;margin-top: 10px}
.ui-cbc__row{display: grid;grid-template-rows: 1fr;transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-cbc-ease), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cbc__row[data-leaving]{grid-template-rows: 0fr;opacity: 0;pointer-events: none}
.ui-cbc__item{display: flex;align-items: center;gap: 10px;min-height: 0;height: 32px;margin: 0 -8px;padding: 0 8px;overflow: hidden;border-radius: 6px;cursor: default;transition: background-color 90ms ease-out, opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cbc__item[data-active]{background: var(--ui-cbc-wash)}
.ui-cbc__list[data-active] .ui-cbc__item:not([data-active]){opacity: 0.45}
.ui-cbc__swatch{flex: none;width: 8px;height: 8px;border-radius: 2px}
.ui-cbc__label{flex: 1;min-width: 0;overflow: hidden;color: var(--ui-cbc-ink);white-space: nowrap;text-overflow: ellipsis}
.ui-cbc__value{color: var(--ui-cbc-ink);font-weight: 500;font-variant-numeric: tabular-nums}
.ui-cbc__share{width: 34px;font-size: 12px;line-height: 16px;text-align: right;color: var(--ui-cbc-muted);font-variant-numeric: tabular-nums}
.ui-cbc__foot{display: flex;align-items: center;min-height: 40px;padding: 0 16px;overflow: hidden;border-top: 0.5px solid var(--ui-cbc-line);font-size: 12px;line-height: 16px;color: var(--ui-cbc-muted);white-space: nowrap}
.ui-cbc__foot-in{overflow: hidden;text-overflow: ellipsis;animation: ui-cbc-in var(--nm-dur-4, 380ms) var(--ui-cbc-ease) both}
@keyframes ui-cbc-in{from{opacity: 0;transform: translateY(4px);filter: blur(2px)}
to{opacity: 1;transform: none;filter: none}
}
@keyframes ui-cbc-pop{from{opacity: 0;transform: scale(0.85)}
to{opacity: 1;transform: none}
}
@container (max-width: 320px){.ui-cbc__body{padding: 14px 14px 8px}
.ui-cbc__foot{padding: 0 14px}
.ui-cbc__switch{gap: 2px}
.ui-cbc__option{padding: 4px 8px}
}
@container (max-width: 250px){.ui-cbc__share{display: none}
.ui-cbc__option{padding: 4px 6px}
}
@media (hover: none) and (pointer: coarse){.ui-cbc__option{height: 32px;padding: 6px 10px}
.ui-cbc__item{height: 40px}
.ui-cbc__foot{min-height: 44px}
}
@media (prefers-reduced-motion: reduce){.ui-cbc *, .ui-cbc *::before, .ui-cbc *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-cbc{--ui-cbc-card: #211b16;--ui-cbc-ink: rgba(255, 253, 251, 0.9);--ui-cbc-strong: #fffdfb;--ui-cbc-text: rgba(255, 253, 251, 0.62);--ui-cbc-muted: rgba(255, 253, 251, 0.46);--ui-cbc-faint: rgba(255, 253, 251, 0.3);--ui-cbc-line: rgba(255, 253, 251, 0.08);--ui-cbc-wash: rgba(255, 253, 251, 0.04);--ui-cbc-fill: rgba(255, 253, 251, 0.08);--ui-cbc-up: #2f8d5c;--ui-cbc-up-bg: rgba(47, 141, 92, 0.14);--ui-cbc-down: #e2544a;--ui-cbc-down-bg: rgba(226, 84, 74, 0.14);--ui-cbc-c1: #ff8a5c;--ui-cbc-c2: rgba(255, 138, 92, 0.62);--ui-cbc-c3: rgba(255, 138, 92, 0.4);--ui-cbc-c4: rgba(255, 138, 92, 0.22);--ui-cbc-c5: rgba(255, 253, 251, 0.16);--ui-cbc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-cbc-focus: rgba(255, 138, 92, 0.5)}

`;
