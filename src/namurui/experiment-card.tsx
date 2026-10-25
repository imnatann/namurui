"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

/*
 * Experiment Card – an A/B test folded into two lines that unfolds on hover, in a single file.
 * The head is the whole summary: one tiny column per variant, the experiment's name and status, and
 * the leader's lift. Hovering a row widens its column and fades the others. The body glides open with
 * a metric switch – its thumb measured, not guessed – and one row per variant: bars scaled to the
 * leader and numbers that roll when the metric changes. Picking a row turns its badge into a check
 * and pops a commit button onto the tray. The styles are injected below, so no extra files are needed.
 */

export type ExperimentTone = "red" | "amber" | "green" | "blue" | "violet" | "gray";

export type ExperimentMetric = {
  /** Stable id, matched against every variant's values */
  id: string;
  /** Label on the metric switch */
  label: string;
  /** Formats a raw number for display – defaults to one decimal and a percent sign */
  format?: (value: number) => string;
  /** A drop is an improvement: the change keeps its sign but the tone turns green */
  lowerIsBetter?: boolean;
};

export type ExperimentVariant = {
  id: string;
  /** The badge letter, e.g. "B" */
  key: string;
  /** What the variant actually is, e.g. "Try it free" */
  name: string;
  /** One raw number per metric id */
  values: Record<string, number>;
  /** The baseline the others are measured against – defaults to the first variant */
  control?: boolean;
  /** Column colour; defaults to the card's own palette, var(--ui-xcc-c0) and on */
  color?: string;
};

export type ExperimentCardProps = {
  /** Name of the experiment, e.g. "Signup button copy" */
  name: string;
  /** The variants – two or more; the first without an explicit control is the baseline */
  variants: ExperimentVariant[];
  /** The metric switch; the first one is selected and drives the head chart */
  metrics: ExperimentMetric[];
  /** Called from the commit button once a row has been picked */
  onPickWinner?: (variant: ExperimentVariant, metric: ExperimentMetric) => void;
  /** Tag under the name – the dot is drawn by the styles */
  status?: { label: string; tone?: ExperimentTone };
  /** Short text next to the status, e.g. "Day 9 of 14" */
  note?: string;
  /** Controlled metric id */
  metric?: string;
  /** Starting metric when uncontrolled */
  defaultMetric?: string;
  onMetricChange?: (id: string) => void;
  /** Controlled id of the picked variant */
  winner?: string | null;
  /** Starting pick when uncontrolled */
  defaultWinner?: string | null;
  onWinnerChange?: (id: string) => void;
  /** Controlled disclosure state */
  open?: boolean;
  /** Open on mount and stay open until the toggle folds it */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Instruction in the tray before a row is picked */
  pickLabel?: string;
  /** Label on the commit button that appears after a pick */
  commitLabel?: string;
  /** Extra class on the root */
  className?: string;
};

const TONE_DEFAULT: ExperimentTone = "green";

/** Fixed one-decimal percent with a typographic minus, matching the copy in the reference. */
function signed(change: number): string {
  const magnitude = Math.abs(change);
  if (magnitude < 0.05) return "0.0%";
  return `${change > 0 ? "+" : "−"}${magnitude.toFixed(1)}%`;
}

function readValue(variant: ExperimentVariant | undefined, metric: ExperimentMetric | undefined): number {
  if (!variant || !metric) return 0;
  return variant.values[metric.id] ?? 0;
}

/**
 * Rolls every displayed number from where it was to where it now is, so switching the metric
 * reads as one count instead of a jump. Mount renders the real values; a reduced-motion
 * preference skips the count entirely.
 */
function useRolling(target: number[], duration = 520): number[] {
  const [shown, setShown] = useState<number[]>(target);
  const shownRef = useRef<number[]>(target);
  const signature = target.join("|");

  useEffect(() => {
    const goal = signature === "" ? [] : signature.split("|").map(Number);
    const origin = shownRef.current;
    if (origin.length !== goal.length) {
      shownRef.current = goal;
      setShown(goal);
      return;
    }
    if (goal.every((value, index) => value === origin[index])) return;
    if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      shownRef.current = goal;
      setShown(goal);
      return;
    }

    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = goal.map((value, index) => origin[index] + (value - origin[index]) * eased);
      shownRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [signature, duration]);

  return shown.length === target.length ? shown : target;
}

export function ExperimentCard({
  name,
  variants,
  metrics,
  onPickWinner,
  status,
  note,
  metric,
  defaultMetric,
  onMetricChange,
  winner,
  defaultWinner = null,
  onWinnerChange,
  open,
  defaultOpen = false,
  onOpenChange,
  pickLabel = "Pick a winner",
  commitLabel = "Ship winner",
  className,
}: ExperimentCardProps) {
  const uid = useId();
  const bodyId = `${uid}-body`;

  const [metricState, setMetricState] = useState(defaultMetric ?? metrics[0]?.id ?? "");
  const activeId = metric ?? metricState;
  const activeIndex = Math.max(
    0,
    metrics.findIndex((entry) => entry.id === activeId),
  );
  const activeMetric: ExperimentMetric | undefined = metrics[activeIndex];

  const [winnerState, setWinnerState] = useState<string | null>(defaultWinner);
  const pickedId = winner === undefined ? winnerState : winner;
  const picked = variants.find((variant) => variant.id === pickedId) ?? null;

  const [hot, setHot] = useState<number | null>(null);

  const controlledOpen = open !== undefined;
  const [openState, setOpenState] = useState(defaultOpen);
  const [locked, setLocked] = useState(defaultOpen);
  const isOpen = controlledOpen ? open : openState;

  const changeOpen = (next: boolean) => {
    if (!controlledOpen) setOpenState(next);
    onOpenChange?.(next);
  };

  const switchRef = useRef<HTMLDivElement | null>(null);
  const metricRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  const metricKey = metrics.map((entry) => entry.label).join("|");

  useLayoutEffect(() => {
    const wrap = switchRef.current;
    const button = metricRefs.current[activeIndex];
    if (!wrap || !button) return;
    const measure = () => {
      const x = button.offsetLeft;
      const w = button.offsetWidth;
      setThumb((prev) => (prev && prev.x === x && prev.w === w ? prev : { x, w }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    for (const node of metricRefs.current) if (node) observer.observe(node);
    return () => observer.disconnect();
  }, [activeIndex, metricKey]);

  const control = variants.find((variant) => variant.control) ?? variants[0];
  const baseValue = readValue(control, activeMetric);
  const format = activeMetric?.format ?? ((value: number) => `${value.toFixed(1)}%`);

  const changeOf = (variant: ExperimentVariant) => {
    const value = readValue(variant, activeMetric);
    return baseValue === 0 ? 0 : ((value - baseValue) / baseValue) * 100;
  };

  const toneOf = (change: number): ExperimentTone => {
    if (Math.abs(change) < 0.05) return "gray";
    const improved = activeMetric?.lowerIsBetter ? change < 0 : change > 0;
    return improved ? "green" : "red";
  };

  const leader = variants.reduce<ExperimentVariant | null>((best, variant) => {
    if (!best) return variant;
    const current = readValue(best, activeMetric);
    const candidate = readValue(variant, activeMetric);
    if (candidate === current) return best;
    const improved = activeMetric?.lowerIsBetter ? candidate < current : candidate > current;
    return improved ? variant : best;
  }, null);

  const leadChange = leader ? changeOf(leader) : 0;
  const statusLabel = status?.label ?? "Running";
  const statusTone = status?.tone ?? TONE_DEFAULT;

  const summary = !leader
    ? `${name}, ${statusLabel}`
    : Math.abs(leadChange) < 0.05
      ? `${name}, ${statusLabel}, ${leader.name} matches the baseline`
      : `${name}, ${statusLabel}, ${leader.name} is ahead by ${Math.abs(leadChange).toFixed(1)} percent`;

  const values = variants.map((variant) => readValue(variant, activeMetric));
  const rolling = useRolling(values);
  const barMax = Math.max(0, ...values);

  const chartSource = metrics[0];
  const chartValues = variants.map((variant) => readValue(variant, chartSource));
  const chartMin = Math.min(...chartValues);
  const chartMax = Math.max(...chartValues);
  const chartSizes = chartValues.map((value) =>
    chartMax === chartMin ? 1 : 0.38 + (0.62 * (value - chartMin)) / (chartMax - chartMin),
  );

  const selectMetricAt = (index: number, focus: boolean) => {
    const next = metrics[index];
    if (!next) return;
    if (metric === undefined) setMetricState(next.id);
    onMetricChange?.(next.id);
    if (focus) metricRefs.current[index]?.focus();
  };

  const onSwitchKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!metrics.length) return;
    let next = activeIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (activeIndex + 1) % metrics.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (activeIndex - 1 + metrics.length) % metrics.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = metrics.length - 1;
    else return;
    event.preventDefault();
    selectMetricAt(next, true);
  };

  const pick = (variant: ExperimentVariant) => {
    if (winner === undefined) setWinnerState(variant.id);
    onWinnerChange?.(variant.id);
  };

  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const onRowsKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!variants.length) return;
    const at = rowRefs.current.findIndex((node) => node === event.target);
    const from = at === -1 ? 0 : at;
    let next = from;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (from + 1) % variants.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = (from - 1 + variants.length) % variants.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = variants.length - 1;
    else return;
    event.preventDefault();
    pick(variants[next]);
    rowRefs.current[next]?.focus();
  };

  const commit = () => {
    if (!picked || !activeMetric) return;
    onPickWinner?.(picked, activeMetric);
  };

  const toggle = () => {
    const next = !isOpen;
    setLocked(next);
    changeOpen(next);
  };

  const onPointerEnter = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    if (!isOpen) changeOpen(true);
  };

  const onPointerLeave = () => {
    setHot(null);
    if (isOpen && !locked) changeOpen(false);
  };

  const onFocus = () => {
    if (!isOpen) changeOpen(true);
  };

  const onBlur = (event: ReactFocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    if (isOpen && !locked) changeOpen(false);
  };

  const caption = !picked
    ? pickLabel
    : picked === control
      ? `${picked.name} is the baseline`
      : `${picked.name} picked · ${signed(changeOf(picked))} vs ${control?.key ?? "base"}`;

  return (
    <div
      className={["ui-xcc", className].filter(Boolean).join(" ")}
      data-open={isOpen ? "" : undefined}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-experiment-card" precedence="default">
        {css}
      </style>

      <div className="ui-xcc__card">
        <div className="ui-xcc__head">
          <button
            type="button"
            className="ui-xcc__toggle"
            aria-expanded={isOpen}
            aria-controls={bodyId}
            aria-label={summary}
            onClick={toggle}
          />

          <span className="ui-xcc__chart" aria-hidden="true">
            {variants.map((variant, index) => (
              <span
                key={variant.id}
                className="ui-xcc__col"
                data-hot={hot === index ? "" : undefined}
                data-dim={hot !== null && hot !== index ? "" : undefined}
                data-passed={picked !== null && picked.id !== variant.id ? "" : undefined}
                onPointerEnter={() => setHot(index)}
                onPointerLeave={() => setHot((current) => (current === index ? null : current))}
                style={
                  {
                    "--ui-xcc-color": variant.color ?? `var(--ui-xcc-c${Math.min(index, 4)})`,
                    "--ui-xcc-size": chartSizes[index],
                  } as CSSProperties
                }
              />
            ))}
          </span>

          <span className="ui-xcc__titles">
            <span className="ui-xcc__name">{name}</span>
            <span className="ui-xcc__sub">
              <span className="ui-xcc__tag" data-tone={statusTone}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <circle cx="5" cy="5" r="4.5" fill="currentColor" opacity="0.22" />
                  <circle cx="5" cy="5" r="2.25" fill="currentColor" />
                </svg>
                {statusLabel}
              </span>
              {note ? <span className="ui-xcc__note">{note}</span> : null}
            </span>
          </span>

          {leader ? (
            <span className="ui-xcc__lead" data-tone={toneOf(leadChange)}>
              <b>{leader.key}</b>
              {Math.abs(leadChange) >= 0.05 ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path
                    d={leadChange > 0 ? "M1.5 8.5 4.5 5.5l2 2 4-4M8 3.5h2.5V6" : "M1.5 3.5 4.5 6.5l2-2 4 4M8 8.5h2.5V6"}
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
              {Math.abs(leadChange) < 0.05 ? "Base" : signed(leadChange)}
            </span>
          ) : null}
        </div>

        <div id={bodyId} className="ui-xcc__fold">
          <div className="ui-xcc__clip">
            <div className="ui-xcc__body">
              <div className="ui-xcc__switch" ref={switchRef} role="radiogroup" aria-label="Metric" onKeyDown={onSwitchKeyDown}>
                <span
                  className="ui-xcc__thumb"
                  style={thumb ? { transform: `translateX(${thumb.x}px)`, width: thumb.w } : undefined}
                />
                {metrics.map((entry, index) => {
                  const checked = index === activeIndex;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      tabIndex={checked ? 0 : -1}
                      className="ui-xcc__metric"
                      ref={(node) => {
                        metricRefs.current[index] = node;
                      }}
                      onClick={() => selectMetricAt(index, false)}
                    >
                      {entry.label}
                    </button>
                  );
                })}
              </div>

              <div className="ui-xcc__rows" role="radiogroup" aria-label="Winner" onKeyDown={onRowsKeyDown}>
                {variants.map((variant, index) => {
                  const value = values[index];
                  const change = changeOf(variant);
                  const isControl = control?.id === variant.id;
                  const checked = picked?.id === variant.id;
                  const direction = change > 0.05 ? "up" : change < -0.05 ? "down" : "level with baseline";
                  const rowLabel = isControl
                    ? `${variant.name}: ${format(value)}, baseline`
                    : `${variant.name}: ${format(value)}, ${direction === "level with baseline" ? direction : `${direction} ${Math.abs(change).toFixed(1)} percent`}`;
                  const bar = barMax > 0 ? Math.min(1, Math.max(0, value / barMax)) : 0;

                  return (
                    <button
                      key={variant.id}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      aria-label={rowLabel}
                      className="ui-xcc__row"
                      ref={(node) => {
                        rowRefs.current[index] = node;
                      }}
                      data-hot={hot === index ? "" : undefined}
                      data-dim={hot !== null && hot !== index ? "" : undefined}
                      style={
                        { "--ui-xcc-color": variant.color ?? `var(--ui-xcc-c${Math.min(index, 4)})` } as CSSProperties
                      }
                      onClick={() => pick(variant)}
                      onPointerEnter={() => setHot(index)}
                      onPointerLeave={() => setHot((current) => (current === index ? null : current))}
                    >
                      <span className="ui-xcc__badge">
                        <span>{variant.key}</span>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <path
                            d="m3 6.2 2 2 4-4.4"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <span className="ui-xcc__label">{variant.name}</span>
                      <span className="ui-xcc__value">{format(rolling[index] ?? value)}</span>
                      <span className="ui-xcc__lift" data-tone={isControl ? "gray" : toneOf(change)}>
                        {isControl ? "Base" : signed(change)}
                      </span>
                      <span className="ui-xcc__track">
                        <span
                          className="ui-xcc__bar"
                          style={{ transform: `scaleX(${Number(bar.toFixed(6))})` }}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="ui-xcc__fold">
          <div className="ui-xcc__clip">
            <div className="ui-xcc__foot">
              <span className="ui-xcc__caption" aria-live="polite">
                <span key={caption}>{caption}</span>
              </span>
              {picked ? (
                <button type="button" className="ui-xcc__action" onClick={commit}>
                  {commitLabel}
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path
                      d="M2.5 6h7M6.5 3.2 9.3 6l-2.8 2.8"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const css = /* css */ `
.ui-xcc{--ui-xcc-card: #fffdfb;--ui-xcc-ink: rgba(11, 9, 8, 0.88);--ui-xcc-strong: #0b0908;--ui-xcc-text: rgba(11, 9, 8, 0.61);--ui-xcc-muted: rgba(11, 9, 8, 0.45);--ui-xcc-faint: rgba(11, 9, 8, 0.27);--ui-xcc-icon: rgba(11, 9, 8, 0.447);--ui-xcc-line: rgba(11, 9, 8, 0.06);--ui-xcc-fill: rgba(11, 9, 8, 0.06);--ui-xcc-wash: rgba(11, 9, 8, 0.03);--ui-xcc-track: rgba(11, 9, 8, 0.06);--ui-xcc-pick: rgba(217, 84, 31, 0.05);--ui-xcc-pick-line: rgba(217, 84, 31, 0.35);--ui-xcc-primary: rgba(11, 9, 8, 0.88);--ui-xcc-on-primary: #fcf9f7;--ui-xcc-c0: rgba(11, 9, 8, 0.22);--ui-xcc-c1: rgba(217, 84, 31, 0.765);--ui-xcc-c2: #ff6b35;--ui-xcc-c3: #d99530;--ui-xcc-c4: #2f8d5c;--ui-xcc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-xcc-focus: rgba(217, 84, 31, 0.35);--ui-xcc-ease: cubic-bezier(0.22, 1, 0.36, 1);--ui-xcc-time: 520ms;box-sizing: border-box;width: 100%;max-width: 340px;container-type: inline-size;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;font-weight: 400;color: var(--ui-xcc-ink);text-align: left;-webkit-font-smoothing: antialiased}
.ui-xcc *, .ui-xcc *::before, .ui-xcc *::after{box-sizing: border-box}
:where(.ui-xcc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;text-align: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-xcc button:focus-visible{outline: 2px solid var(--ui-xcc-focus);outline-offset: 1px}
:where(.ui-xcc) svg{display: block;flex: none}
.ui-xcc b{font-weight: 500;color: var(--ui-xcc-ink)}
.ui-xcc [data-tone="red"]{--ui-xcc-tag: #b3261e;--ui-xcc-tag-bg: rgba(226, 84, 74, 0.08)}
.ui-xcc [data-tone="amber"]{--ui-xcc-tag: #9a6410;--ui-xcc-tag-bg: rgba(217, 149, 48, 0.1)}
.ui-xcc [data-tone="green"]{--ui-xcc-tag: #2f8d5c;--ui-xcc-tag-bg: rgba(47, 141, 92, 0.08)}
.ui-xcc [data-tone="blue"]{--ui-xcc-tag: rgba(217, 84, 31, 0.9);--ui-xcc-tag-bg: rgba(217, 84, 31, 0.06)}
.ui-xcc [data-tone="violet"]{--ui-xcc-tag: #ff6b35;--ui-xcc-tag-bg: rgba(255, 107, 53, 0.08)}
.ui-xcc [data-tone="gray"]{--ui-xcc-tag: rgba(11, 9, 8, 0.61);--ui-xcc-tag-bg: rgba(11, 9, 8, 0.05)}
.ui-xcc__card{border-radius: 10px;background: var(--ui-xcc-card);box-shadow: var(--ui-xcc-shadow)}
.ui-xcc__fold{display: grid;grid-template-rows: 0fr;opacity: 0;transition: grid-template-rows var(--ui-xcc-time) var(--ui-xcc-ease), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-xcc__clip{min-height: 0;overflow: hidden}
.ui-xcc[data-open] > .ui-xcc__card > .ui-xcc__fold{grid-template-rows: 1fr;opacity: 1;transition: grid-template-rows var(--ui-xcc-time) var(--ui-xcc-ease), opacity 380ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 120ms}
.ui-xcc__head{position: relative;display: flex;align-items: center;gap: 10px;padding: 12px}
.ui-xcc__toggle{position: absolute;inset: 0;border-radius: 10px}
.ui-xcc__head > :not(.ui-xcc__toggle){position: relative;pointer-events: none}
.ui-xcc[data-open] .ui-xcc__chart{pointer-events: auto}
.ui-xcc__chart{display: flex;flex: none;align-items: flex-end;justify-content: center;gap: 3px;width: 36px;height: 36px;padding: 7px 6px 6px;border-radius: 8px;background: var(--ui-xcc-wash);box-shadow: inset 0 0 0 0.5px var(--ui-xcc-line)}
.ui-xcc__col{flex: 1;max-width: 6px;height: calc(var(--ui-xcc-size) * 100%);border-radius: 1.5px;background: var(--ui-xcc-color);cursor: pointer;transition: height 620ms var(--ui-xcc-ease), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-3, 240ms) var(--ui-xcc-ease);transform-origin: 50% 100%}
.ui-xcc__col[data-hot]{transform: scaleX(1.25)}
.ui-xcc__col[data-dim]{opacity: 0.3}
.ui-xcc__col[data-passed]:not([data-hot]){opacity: 0.35}
.ui-xcc__titles{display: grid;grid-template-columns: minmax(0, 1fr);flex: 1;min-width: 0}
.ui-xcc__name{overflow: hidden;font-size: 13px;line-height: 20px;font-weight: 500;color: var(--ui-xcc-strong);white-space: nowrap;text-overflow: ellipsis}
.ui-xcc__sub{display: flex;align-items: center;gap: 6px;min-width: 0;height: 20px;overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-xcc-muted);white-space: nowrap}
.ui-xcc__tag{display: inline-flex;flex: none;align-items: center;gap: 5px;height: 20px;padding: 0 6px 0 5px;border-radius: 5px;background: var(--ui-xcc-tag-bg);font-size: 12px;font-weight: 500;color: var(--ui-xcc-tag)}
.ui-xcc__note{min-width: 0;overflow: hidden;text-overflow: ellipsis}
.ui-xcc__lead{display: inline-flex;flex: none;align-items: center;gap: 4px;height: 24px;padding: 0 7px;border-radius: 6px;background: var(--ui-xcc-tag-bg);font-size: 12px;line-height: 16px;font-weight: 500;color: var(--ui-xcc-tag);white-space: nowrap;font-variant-numeric: tabular-nums;animation: ui-xcc-pop var(--nm-dur-4, 380ms) var(--ui-xcc-ease) both}
.ui-xcc__lead b{color: inherit}
.ui-xcc__body{padding: 0 12px 10px}
.ui-xcc__switch{position: relative;display: flex;gap: 4px}
.ui-xcc__thumb{position: absolute;top: 0;left: 0;height: 100%;border-radius: 6px;background: var(--ui-xcc-fill);transition: transform 90ms ease-out, width 90ms ease-out}
.ui-xcc__metric{position: relative;height: 28px;padding: 4px 10px;border-radius: 6px;box-shadow: inset 0 0 0 0.5px var(--ui-xcc-line);font-size: 13px;line-height: 20px;font-weight: 500;color: var(--ui-xcc-text);text-align: center;white-space: nowrap;transition: color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-xcc__metric:hover{background: var(--ui-xcc-wash);color: var(--ui-xcc-ink)}
.ui-xcc__metric[aria-checked="true"]{background: none;color: var(--ui-xcc-ink)}
.ui-xcc__rows{display: grid;gap: 2px;margin-top: 8px}
.ui-xcc__row{display: grid;grid-template-columns: auto minmax(0, 1fr) auto auto;align-items: center;column-gap: 8px;row-gap: 6px;width: calc(100% + 12px);margin: 0 -6px;padding: 7px 6px 8px;border-radius: 6px;transition: background-color var(--nm-dur-1, 90ms) ease-out, opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-xcc__row[data-hot]{background: var(--ui-xcc-wash)}
.ui-xcc__row[data-dim]{opacity: 0.55}
.ui-xcc__row[aria-checked="true"]{background: var(--ui-xcc-pick);box-shadow: 0 0 0 0.5px var(--ui-xcc-pick-line)}
.ui-xcc__badge{display: grid;place-items: center;width: 20px;height: 20px;border-radius: 5px;background: color-mix(in srgb, var(--ui-xcc-color) 14%, transparent);font-size: 11px;font-weight: 500;line-height: 1;color: color-mix(in srgb, var(--ui-xcc-color) 80%, var(--ui-xcc-strong));transition: background-color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-xcc__badge > *{grid-area: 1 / 1;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-3, 240ms) var(--ui-xcc-ease)}
.ui-xcc__badge svg{opacity: 0;transform: scale(0.5)}
.ui-xcc__row[aria-checked="true"] .ui-xcc__badge{background: var(--ui-xcc-color);color: #fffdfb}
.ui-xcc__row[aria-checked="true"] .ui-xcc__badge span{opacity: 0;transform: scale(0.5)}
.ui-xcc__row[aria-checked="true"] .ui-xcc__badge svg{opacity: 1;transform: none}
.ui-xcc__label{overflow: hidden;color: var(--ui-xcc-ink);white-space: nowrap;text-overflow: ellipsis}
.ui-xcc__value{font-weight: 500;color: var(--ui-xcc-strong);font-variant-numeric: tabular-nums}
.ui-xcc__lift{min-width: 50px;height: 20px;padding: 0 6px;border-radius: 5px;background: var(--ui-xcc-tag-bg);font-size: 11px;font-weight: 500;line-height: 20px;color: var(--ui-xcc-tag);text-align: center;font-variant-numeric: tabular-nums;transition: background-color 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-xcc__track{grid-column: 2 / -1;height: 3px;overflow: hidden;border-radius: 1.5px;background: var(--ui-xcc-track)}
.ui-xcc__bar{display: block;width: 100%;height: 100%;border-radius: 1.5px;background: var(--ui-xcc-color);transform-origin: 0 50%;transition: transform 620ms var(--ui-xcc-ease)}
.ui-xcc__foot{display: flex;align-items: center;gap: 8px;height: 44px;padding: 0 8px 0 12px;border-top: 0.5px solid var(--ui-xcc-line)}
.ui-xcc__caption{flex: 1;min-width: 0;overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-xcc-muted);white-space: nowrap;text-overflow: ellipsis;font-variant-numeric: tabular-nums}
.ui-xcc__caption > span{display: inline-block;animation: ui-xcc-in var(--nm-dur-3, 240ms) var(--ui-xcc-ease) both}
.ui-xcc__action{display: inline-flex;align-items: center;gap: 4px;flex: none;height: 28px;padding: 0 7px 0 10px;border-radius: 6px;background: var(--ui-xcc-primary);font-size: 13px;line-height: 20px;font-weight: 500;color: var(--ui-xcc-on-primary);white-space: nowrap;animation: ui-xcc-pop var(--nm-dur-4, 380ms) var(--ui-xcc-ease) both;transition: opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-xcc__action:hover{opacity: 0.9}
.ui-xcc__action svg{transition: transform var(--nm-dur-3, 240ms) var(--ui-xcc-ease)}
.ui-xcc__action:hover svg{transform: translateX(2px)}
@keyframes ui-xcc-in{from{opacity: 0;transform: translateY(3px)}
}
@keyframes ui-xcc-pop{from{opacity: 0;transform: scale(0.94)}
}
@container (max-width: 300px){.ui-xcc__head{gap: 8px;padding: 10px}
.ui-xcc__chart{width: 32px;height: 32px;padding: 6px 5px 5px;gap: 2.5px}
.ui-xcc__note{display: none}
.ui-xcc__lead{gap: 3px;padding: 0 6px}
.ui-xcc__lead svg{display: none}
.ui-xcc__body{padding: 0 10px 10px}
.ui-xcc__switch{gap: 2px}
.ui-xcc__metric{flex: 1;padding: 4px 6px}
.ui-xcc__row{column-gap: 7px}
.ui-xcc__lift{min-width: 44px;padding: 0 4px}
.ui-xcc__foot{padding: 0 8px 0 10px}
}
@media (pointer: coarse){.ui-xcc__metric{height: 34px;padding: 7px 12px}
.ui-xcc__row{padding: 10px 6px 11px}
.ui-xcc__foot{height: 52px}
.ui-xcc__action{height: 34px}
}
@media (prefers-reduced-motion: reduce){.ui-xcc *, .ui-xcc *::before, .ui-xcc *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-xcc{--ui-xcc-card: #211b16;--ui-xcc-ink: rgba(255, 253, 251, 0.9);--ui-xcc-strong: #fffdfb;--ui-xcc-text: rgba(255, 253, 251, 0.62);--ui-xcc-muted: rgba(255, 253, 251, 0.46);--ui-xcc-faint: rgba(255, 253, 251, 0.3);--ui-xcc-icon: rgba(255, 253, 251, 0.5);--ui-xcc-line: rgba(255, 253, 251, 0.08);--ui-xcc-fill: rgba(255, 253, 251, 0.08);--ui-xcc-wash: rgba(255, 253, 251, 0.04);--ui-xcc-track: rgba(255, 253, 251, 0.08);--ui-xcc-pick: rgba(255, 138, 92, 0.14);--ui-xcc-pick-line: rgba(255, 138, 92, 0.4);--ui-xcc-primary: rgba(255, 253, 251, 0.9);--ui-xcc-on-primary: #211b16;--ui-xcc-c0: rgba(255, 253, 251, 0.3);--ui-xcc-c1: #ff8a5c;--ui-xcc-c2: #ff8a5c;--ui-xcc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-xcc-focus: rgba(255, 138, 92, 0.5)}
:where(.dark, [data-theme="dark"]) .ui-xcc [data-tone="red"]{--ui-xcc-tag: #f0938c;--ui-xcc-tag-bg: rgba(226, 84, 74, 0.14)}
:where(.dark, [data-theme="dark"]) .ui-xcc [data-tone="amber"]{--ui-xcc-tag: #e8b05c;--ui-xcc-tag-bg: rgba(217, 149, 48, 0.14)}
:where(.dark, [data-theme="dark"]) .ui-xcc [data-tone="green"]{--ui-xcc-tag: #4f9d6e;--ui-xcc-tag-bg: rgba(47, 141, 92, 0.14)}
:where(.dark, [data-theme="dark"]) .ui-xcc [data-tone="blue"]{--ui-xcc-tag: #ffb28f;--ui-xcc-tag-bg: rgba(255, 138, 92, 0.14)}
:where(.dark, [data-theme="dark"]) .ui-xcc [data-tone="violet"]{--ui-xcc-tag: #ffb28f;--ui-xcc-tag-bg: rgba(255, 107, 53, 0.18)}
:where(.dark, [data-theme="dark"]) .ui-xcc [data-tone="gray"]{--ui-xcc-tag: rgba(255, 253, 251, 0.62);--ui-xcc-tag-bg: rgba(255, 253, 251, 0.08)}
:where(.dark, [data-theme="dark"]) .ui-xcc__badge{color: color-mix(in srgb, var(--ui-xcc-color) 75%, #fff)}
:where(.dark, [data-theme="dark"]) .ui-xcc__row[aria-checked="true"] .ui-xcc__badge{color: #211b16}

`;
