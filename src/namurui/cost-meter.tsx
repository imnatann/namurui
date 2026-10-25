"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

/*
 * Cost Meter – what a session has actually spent, as a running figure with a rate sparkline and a
 * per-model breakdown. The figure counts up from zero once on mount and lands exactly on the prop;
 * later spend is emphasised with a short pop on the delta chip instead of re-animating the number.
 * The sparkline is computed from the series and draws left to right once, the model bars grow in
 * sequence, and the projection is labelled as an estimate so it is never read as a measurement.
 * The styles are injected below, so no extra files are needed.
 */

/** One model's share of the session spend. */
export type CostMeterModel = {
  /** Stable key */
  id: string;
  /** Model name as the provider spells it, e.g. "claude-sonnet-4-5" */
  name: string;
  /** Tokens billed for this model, input plus output */
  tokens: number;
  /** Spend attributed to this model, in the currency's major unit */
  cost: number;
};

/** One interval of the rate sparkline. */
export type CostMeterPoint = {
  /** Stable key */
  id: string;
  /** Time the interval ends, e.g. "14:35" */
  label: string;
  /** Spend during the interval, in the currency's major unit */
  cost: number;
};

export type CostMeterProps = {
  /** Label above the figure */
  title?: string;
  /** Total spent so far, in the currency's major unit */
  total?: number;
  /** Tokens billed so far */
  tokens?: number;
  /** Seconds the session has been running */
  elapsedSeconds?: number;
  /** Spend per interval, oldest first – drives the sparkline and the recent rate */
  series?: readonly CostMeterPoint[];
  /** Per-model split, shown largest cost first */
  models?: readonly CostMeterModel[];
  /** Symbol before every figure */
  currency?: string;
  /** Seconds one sparkline interval covers */
  intervalSeconds?: number;
  /** Extra class on the root */
  className?: string;
};

/* The chart is drawn in measured pixels, so 1 viewBox unit is 1 CSS pixel and the stroke keeps its
   weight at every width. The pad keeps the last point's halo inside the box. */
const CHART_HEIGHT = 46;
const CHART_PAD = 4;
const CHART_INSET = 3;
/* Matches --nm-dur-5, the choreographed reveal step */
const COUNT_MS = 620;

/* Cents are always shown: a running ledger whose last digits flicker between one and two
   decimal places is unreadable at a glance. */
const MONEY = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const money = (value: number, currency: string) => `${currency}${MONEY.format(value)}`;

/* Two significant decimals for millions, one for thousands, whole numbers below that */
function tokenCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 100_000) return `${Math.round(value / 1_000)}K`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${Math.round(value)}`;
}

function clock(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = whole % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(rest).padStart(2, "0")}s`;
  return `${rest}s`;
}

/* The bar always carries its share as text, so the breakdown reads without colour */
function shareLabel(share: number) {
  const pct = share * 100;
  if (pct > 0 && pct < 1) return "<1%";
  if (pct >= 10) return `${Math.round(pct)}%`;
  return `${pct.toFixed(1)}%`;
}

function intervalSpan(seconds: number) {
  if (seconds >= 3600 && seconds % 3600 === 0) return `${seconds / 3600} h`;
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60} min`;
  return `${Math.round(seconds)} s`;
}

function buildChart(series: readonly CostMeterPoint[], width: number) {
  const peak = series.reduce((top, point) => Math.max(top, point.cost), 0);
  const usable = CHART_HEIGHT - CHART_PAD * 2;
  const track = Math.max(1, width - CHART_INSET * 2);
  const xAt = (index: number) =>
    series.length <= 1 ? width / 2 : CHART_INSET + (index / (series.length - 1)) * track;
  const yAt = (value: number) =>
    CHART_HEIGHT - CHART_PAD - (peak > 0 ? value / peak : 0) * usable;

  let line = "";
  if (series.length === 1) {
    const y = yAt(series[0].cost).toFixed(1);
    line = `M0 ${y} L${width.toFixed(1)} ${y}`;
  } else if (series.length > 1) {
    line = series
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${xAt(index).toFixed(1)} ${yAt(point.cost).toFixed(1)}`,
      )
      .join(" ");
  }

  const last = series[series.length - 1];
  return {
    peak,
    line,
    area: line ? `${line} L${width.toFixed(1)} ${CHART_HEIGHT} L0 ${CHART_HEIGHT} Z` : "",
    latest: last ? last.cost : 0,
    lastX: last ? xAt(series.length - 1) : 0,
    lastY: last ? yAt(last.cost) : 0,
  };
}

export function CostMeter({
  title = "Session spend",
  total = 0,
  tokens = 0,
  elapsedSeconds = 0,
  series = [],
  models = [],
  currency = "$",
  intervalSeconds = 300,
  className,
}: CostMeterProps) {
  const labelId = useId();
  const [shown, setShown] = useState(0);
  const [counted, setCounted] = useState(false);
  const [delta, setDelta] = useState<{ value: number; seq: number } | null>(null);
  const mountedTotal = useRef(total);
  const lastTotal = useRef(total);
  const deltaSeq = useRef(0);
  const sparkRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(320);

  /* One count-up on mount. The final frame writes the prop value itself, never an eased
     approximation, so the figure can only ever land on the number it was given. */
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const target = mountedTotal.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || target <= 0) {
      setShown(target);
      setCounted(true);
      return;
    }
    const started = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / COUNT_MS);
      if (progress >= 1 || document.hidden) {
        setShown(target);
        setCounted(true);
        return;
      }
      setShown(target * (1 - Math.pow(1 - progress, 3)));
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  /* After the count has landed, the figure follows the prop exactly. The mount count owns
     `shown` until then, so a value arriving mid-count cannot fight it. */
  useEffect(() => {
    if (!counted) return;
    setShown(total);
  }, [total, counted]);

  /* Later spend is read as a change, not as a re-run of the entrance */
  useEffect(() => {
    const change = total - lastTotal.current;
    lastTotal.current = total;
    if (Math.abs(change) < 0.005) return;
    deltaSeq.current += 1;
    setDelta({ value: change, seq: deltaSeq.current });
  }, [total]);

  /* The chart is drawn in pixels, so its width is measured rather than assumed */
  useEffect(() => {
    const host = sparkRef.current;
    if (!host) return;
    const measure = () => {
      const next = Math.max(80, Math.round(host.getBoundingClientRect().width));
      setChartWidth((prev) => (Math.abs(prev - next) > 0.5 ? next : prev));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const chart = useMemo(() => buildChart(series, chartWidth), [series, chartWidth]);
  const sorted = useMemo(() => [...models].sort((a, b) => b.cost - a.cost), [models]);
  const modelTotal = sorted.reduce((sum, model) => sum + model.cost, 0);
  const windowCost = series.reduce((sum, point) => sum + point.cost, 0);

  /* The recent window is the current rate; the session average is the fallback while the window
     is still filling. With neither, the projection says so instead of inventing a number. */
  const recentRate =
    series.length >= 2 && intervalSeconds > 0
      ? (windowCost / (series.length * intervalSeconds)) * 3600
      : null;
  const sessionRate = elapsedSeconds >= 60 ? (total / elapsedSeconds) * 3600 : null;
  const hourly = recentRate ?? sessionRate;
  const basis =
    recentRate !== null
      ? `estimate from the last ${series.length} intervals`
      : sessionRate !== null
        ? "estimate from the session average"
        : "needs a minute of data";

  const span = intervalSpan(intervalSeconds);
  const spent = total > 0;

  return (
    <section
      className={["ui-cstm", className].filter(Boolean).join(" ")}
      data-state={spent ? "spent" : "empty"}
      aria-labelledby={labelId}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-cost-meter" precedence="default">
        {css}
      </style>

      <header className="ui-cstm__head">
        <h3 className="ui-cstm__title" id={labelId}>
          {title}
        </h3>
        <span className="ui-cstm__window">{span} window</span>
      </header>

      <div className="ui-cstm__figure">
        <p className="ui-cstm__amount" aria-hidden="true">
          <span className="ui-cstm__currency">{currency}</span>
          <span className="ui-cstm__value">{MONEY.format(shown)}</span>
        </p>
        {delta && counted ? (
          <span className="ui-cstm__delta" key={delta.seq} data-dir={delta.value < 0 ? "down" : "up"}>
            <svg className="ui-cstm__delta-icon" viewBox="0 0 8 8" aria-hidden="true">
              <path d="M4 1.2 7 6.6H1z" />
            </svg>
            {delta.value < 0 ? "\u2212" : "+"}
            {money(Math.abs(delta.value), currency)}
            <span className="ui-cstm__sr"> since the last update</span>
          </span>
        ) : null}
        <span className="ui-cstm__sr" role="status" aria-live="polite">
          {money(total, currency)} spent this session
        </span>
      </div>

      <div className="ui-cstm__meta">
        <span className="ui-cstm__stat">
          <span className="ui-cstm__stat-value">{tokenCount(tokens)}</span>
          <span className="ui-cstm__stat-label">tokens</span>
        </span>
        <span className="ui-cstm__stat">
          <span className="ui-cstm__stat-value">{clock(elapsedSeconds)}</span>
          <span className="ui-cstm__stat-label">elapsed</span>
        </span>
      </div>

      <div className="ui-cstm__rate">
        <div className="ui-cstm__rate-head">
          <span className="ui-cstm__label">Spend rate</span>
          {chart.peak > 0 ? (
            <span className="ui-cstm__peak">peak {money(chart.peak, currency)}</span>
          ) : null}
        </div>

        <div className="ui-cstm__spark" ref={sparkRef}>
          <svg
            className="ui-cstm__chart"
            viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}
            role="img"
            aria-label={
              series.length
                ? `Spend per ${span} over the last ${series.length} intervals. Peak ${money(
                    chart.peak,
                    currency,
                  )}, latest ${money(chart.latest, currency)}.`
                : `No spend recorded in the last ${span} window.`
            }
          >
            <line
              className="ui-cstm__baseline"
              x1="0"
              y1={CHART_HEIGHT - 0.5}
              x2={chartWidth}
              y2={CHART_HEIGHT - 0.5}
            />
            {chart.area ? <path className="ui-cstm__area" d={chart.area} /> : null}
            {chart.line ? <path className="ui-cstm__line" d={chart.line} pathLength={1} /> : null}
            {series.length ? (
              <g>
                <circle className="ui-cstm__halo" cx={chart.lastX} cy={chart.lastY} r="4" />
                <circle className="ui-cstm__point" cx={chart.lastX} cy={chart.lastY} r="2" />
              </g>
            ) : null}
          </svg>
          {series.length === 0 ? <p className="ui-cstm__spark-empty">No intervals yet</p> : null}
        </div>

        <div className="ui-cstm__axis" aria-hidden="true">
          <span>oldest</span>
          <span>now</span>
        </div>
      </div>

      <div className="ui-cstm__projection">
        <div className="ui-cstm__projection-main">
          <svg className="ui-cstm__projection-icon" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M2.5 11.5 10.5 3.9" />
            <path d="M6.4 3.9h4.1v4.1" />
          </svg>
          <span className="ui-cstm__projection-label">Projected per hour</span>
          {hourly === null ? (
            <span className="ui-cstm__projection-value" data-pending="true">
              Pending
            </span>
          ) : (
            <span className="ui-cstm__projection-value">{"\u2248 "}{money(hourly, currency)}</span>
          )}
        </div>
        <span className="ui-cstm__projection-note">{basis}</span>
      </div>

      <div className="ui-cstm__models">
        <div className="ui-cstm__models-head">
          <span className="ui-cstm__label">By model</span>
          {sorted.length ? (
            <span className="ui-cstm__models-count">
              {sorted.length === 1 ? "1 model" : `${sorted.length} models`}
            </span>
          ) : null}
        </div>

        {sorted.length === 0 ? (
          <p className="ui-cstm__none">No per-model split yet</p>
        ) : (
          <ul className="ui-cstm__list">
            {sorted.map((model, index) => {
              const share = modelTotal > 0 ? model.cost / modelTotal : 0;
              return (
                <li className="ui-cstm__model" key={model.id}>
                  <div className="ui-cstm__model-top">
                    <span className="ui-cstm__model-name">{model.name}</span>
                    <span className="ui-cstm__model-cost">{money(model.cost, currency)}</span>
                  </div>
                  <div className="ui-cstm__model-bar" aria-hidden="true">
                    <span
                      className="ui-cstm__model-fill"
                      style={{ "--share": share, "--rank": index } as CSSProperties}
                    />
                  </div>
                  <div className="ui-cstm__model-foot">
                    <span>{tokenCount(model.tokens)} tokens</span>
                    <span className="ui-cstm__model-pct">{shareLabel(share)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

const css = /* css */ `
/* Override any of these on .ui-cstm. Each one prefers the document token and falls back to the
   literal from the token sheet, so the meter is correct in a host that only loads this file. */
.ui-cstm{--ui-cstm-ink: var(--text, #1a1410);--ui-cstm-soft: var(--text-muted, #6f625a);--ui-cstm-line: var(--border-soft, #1a14101a);--ui-cstm-edge: var(--border, #e8e0d7);--ui-cstm-surface: var(--card, #ffffff);--ui-cstm-track: var(--border-soft, #1a14101a);--ui-cstm-bar: var(--text-muted, #6f625a);--ui-cstm-accent: var(--accent, #c2410c);--ui-cstm-strong: var(--accent-hover, #9a3412);--ui-cstm-wash: var(--accent-soft, #c2410c1a);--ui-cstm-shadow: var(--shadow-card, 0 1px 1.5px #3d1f0a0a, inset 0 -1px 0 #3d1f0a0f);--ui-cstm-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));--ui-cstm-ease-soft: var(--nm-ease-soft, cubic-bezier(0.4, 0, 0.2, 1));--ui-cstm-spring: var(--nm-spring, cubic-bezier(0.34, 1.56, 0.64, 1));--ui-cstm-dur-2: var(--nm-dur-2, 160ms);--ui-cstm-dur-3: var(--nm-dur-3, 240ms);--ui-cstm-dur-4: var(--nm-dur-4, 380ms);--ui-cstm-dur-5: var(--nm-dur-5, 620ms);--ui-cstm-dur-6: var(--nm-dur-6, 1100ms);--ui-cstm-stagger: var(--nm-stagger, 45ms);--ui-cstm-mono: var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace);--ui-cstm-radius: var(--radius-card, 16px)}
.ui-cstm{position: relative;container-type: inline-size;padding: 18px 18px 16px;border-radius: var(--ui-cstm-radius);background: var(--ui-cstm-surface);box-shadow: inset 0 0 0 1px var(--ui-cstm-line), var(--ui-cstm-shadow);color: var(--ui-cstm-ink);font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;letter-spacing: -0.01em;-webkit-font-smoothing: antialiased}
.ui-cstm *, .ui-cstm *::before, .ui-cstm *::after{box-sizing: border-box}
:where(.ui-cstm) :is(h3, p, ul, li){margin: 0;padding: 0}
:where(.ui-cstm) ul{list-style: none}
.ui-cstm__head{display: flex;align-items: center;justify-content: space-between;gap: 12px}
.ui-cstm__title{overflow: hidden;font-size: 11px;font-weight: 600;line-height: 16px;letter-spacing: 0.08em;text-transform: uppercase;color: var(--ui-cstm-soft);white-space: nowrap;text-overflow: ellipsis}
.ui-cstm__window{flex: none;padding: 2px 8px;border-radius: var(--radius-pill, 999px);box-shadow: inset 0 0 0 1px var(--ui-cstm-line);font-size: 10px;font-weight: 500;line-height: 16px;letter-spacing: 0.04em;text-transform: uppercase;color: var(--ui-cstm-soft);white-space: nowrap}
.ui-cstm__figure{display: flex;flex-wrap: wrap;align-items: flex-end;gap: 10px;margin-top: 12px}
.ui-cstm__amount{display: flex;align-items: baseline;gap: 1px;min-width: 0}
.ui-cstm__currency{font-size: 20px;font-weight: 500;line-height: 1;color: var(--ui-cstm-soft);font-variant-numeric: tabular-nums}
.ui-cstm__value{font-size: 40px;font-weight: 600;line-height: 1;letter-spacing: -0.035em;color: var(--ui-cstm-ink);font-variant-numeric: tabular-nums}
.ui-cstm__delta{display: inline-flex;align-items: center;gap: 3px;height: 22px;margin-bottom: 2px;padding: 0 8px;border-radius: var(--radius-pill, 999px);background: var(--ui-cstm-wash);font-size: 12px;font-weight: 600;line-height: 16px;color: var(--ui-cstm-strong);font-variant-numeric: tabular-nums;white-space: nowrap;animation: ui-cstm-pop var(--ui-cstm-dur-4) var(--ui-cstm-spring) both}
.ui-cstm__delta-icon{width: 8px;height: 8px;fill: currentColor}
.ui-cstm__delta[data-dir="down"] .ui-cstm__delta-icon{transform: rotate(180deg)}
.ui-cstm__meta{display: flex;flex-wrap: wrap;gap: 6px 20px;margin-top: 10px}
.ui-cstm__stat{display: grid;gap: 1px;min-width: 0}
.ui-cstm__stat-value{font-size: 13px;font-weight: 500;line-height: 18px;color: var(--ui-cstm-ink);font-variant-numeric: tabular-nums}
.ui-cstm__stat-label{font-size: 10px;line-height: 14px;letter-spacing: 0.06em;text-transform: uppercase;color: var(--ui-cstm-soft)}
.ui-cstm__rate{margin-top: 16px;padding-top: 14px;box-shadow: inset 0 1px 0 var(--ui-cstm-line)}
.ui-cstm__rate-head{display: flex;align-items: baseline;justify-content: space-between;gap: 10px}
.ui-cstm__label{font-size: 10px;font-weight: 600;line-height: 16px;letter-spacing: 0.08em;text-transform: uppercase;color: var(--ui-cstm-soft)}
.ui-cstm__peak{font-size: 11px;line-height: 16px;color: var(--ui-cstm-soft);font-variant-numeric: tabular-nums;white-space: nowrap}
.ui-cstm__spark{position: relative;height: 46px;margin-top: 6px}
.ui-cstm__chart{display: block;width: 100%;height: 46px;overflow: visible;color: var(--ui-cstm-accent)}
.ui-cstm__baseline{stroke: var(--ui-cstm-line);stroke-width: 1;fill: none}
.ui-cstm__area{fill: var(--ui-cstm-wash);stroke: none;opacity: 1;animation: ui-cstm-fade var(--ui-cstm-dur-4) var(--ui-cstm-ease-out) var(--ui-cstm-dur-3) both}
.ui-cstm__line{fill: none;stroke: currentColor;stroke-width: 1.5;stroke-linecap: round;stroke-linejoin: round;stroke-dasharray: 1;stroke-dashoffset: 0;animation: ui-cstm-draw var(--ui-cstm-dur-5) var(--ui-cstm-ease-out) var(--ui-cstm-dur-2) both}
.ui-cstm__halo{fill: currentColor;opacity: 0.18;transform-box: fill-box;transform-origin: center;animation: ui-cstm-breathe var(--ui-cstm-dur-6) var(--ui-cstm-ease-soft) infinite alternate}
.ui-cstm__point{fill: currentColor}
.ui-cstm__spark-empty{position: absolute;inset: 0;display: flex;align-items: center;justify-content: center;font-size: 12px;line-height: 16px;color: var(--ui-cstm-soft);pointer-events: none}
.ui-cstm__axis{display: flex;justify-content: space-between;gap: 12px;margin-top: 2px;font-size: 10px;line-height: 14px;letter-spacing: 0.05em;text-transform: uppercase;color: var(--ui-cstm-soft)}
.ui-cstm__projection{margin-top: 12px;padding-top: 10px;border-top: 1px dashed var(--ui-cstm-edge)}
.ui-cstm__projection-main{display: flex;align-items: center;gap: 6px;min-width: 0}
.ui-cstm__projection-icon{flex: none;width: 13px;height: 13px;color: var(--ui-cstm-soft)}
.ui-cstm__projection-icon path{fill: none;stroke: currentColor;stroke-width: 1.2;stroke-linecap: round;stroke-linejoin: round}
.ui-cstm__projection-icon path:first-child{stroke-dasharray: 1.8 2}
.ui-cstm__projection-label{font-size: 11px;line-height: 16px;color: var(--ui-cstm-soft)}
.ui-cstm__projection-value{margin-left: auto;font-size: 14px;font-weight: 600;line-height: 18px;color: var(--ui-cstm-ink);font-variant-numeric: tabular-nums;white-space: nowrap}
.ui-cstm__projection-value[data-pending="true"]{font-size: 12px;font-weight: 500;color: var(--ui-cstm-soft)}
.ui-cstm__projection-note{display: block;margin-top: 1px;font-size: 11px;line-height: 15px;color: var(--ui-cstm-soft)}
.ui-cstm__models{margin-top: 16px;padding-top: 14px;box-shadow: inset 0 1px 0 var(--ui-cstm-line)}
.ui-cstm__models-head{display: flex;align-items: baseline;justify-content: space-between;gap: 10px}
.ui-cstm__models-count{font-size: 11px;line-height: 16px;color: var(--ui-cstm-soft);font-variant-numeric: tabular-nums;white-space: nowrap}
.ui-cstm__none{margin-top: 10px;font-size: 12px;line-height: 18px;color: var(--ui-cstm-soft)}
.ui-cstm__list{display: grid;gap: 11px;margin-top: 10px}
.ui-cstm__model{display: grid;gap: 5px;min-width: 0}
.ui-cstm__model-top{display: flex;align-items: baseline;gap: 10px;min-width: 0}
.ui-cstm__model-name{flex: 1;min-width: 0;overflow: hidden;font-family: var(--ui-cstm-mono);font-size: 12px;line-height: 16px;color: var(--ui-cstm-ink);white-space: nowrap;text-overflow: ellipsis}
.ui-cstm__model-cost{flex: none;font-size: 12px;font-weight: 600;line-height: 16px;color: var(--ui-cstm-ink);font-variant-numeric: tabular-nums}
.ui-cstm__model-bar{position: relative;height: 4px;overflow: hidden;border-radius: 2px;background: var(--ui-cstm-track)}
.ui-cstm__model-fill{position: absolute;inset: 0;border-radius: 2px;background: var(--ui-cstm-bar);opacity: calc(1 - min(var(--rank, 0), 3) * 0.16);transform: scaleX(var(--share, 0));transform-origin: left center;animation: ui-cstm-bar var(--ui-cstm-dur-5) var(--ui-cstm-ease-out) both;animation-delay: calc(var(--rank, 0) * var(--ui-cstm-stagger))}
.ui-cstm__model-foot{display: flex;align-items: baseline;justify-content: space-between;gap: 10px;font-size: 11px;line-height: 15px;color: var(--ui-cstm-soft);font-variant-numeric: tabular-nums}
.ui-cstm__model-pct{font-weight: 500;color: var(--ui-cstm-ink)}
.ui-cstm[data-state="empty"] .ui-cstm__value{color: var(--ui-cstm-soft)}
.ui-cstm__sr{position: absolute;width: 1px;height: 1px;overflow: hidden;clip-path: inset(50%);white-space: nowrap}
@keyframes ui-cstm-draw{from{stroke-dashoffset: 1}
to{stroke-dashoffset: 0}
}
@keyframes ui-cstm-fade{from{opacity: 0}
to{opacity: 1}
}
@keyframes ui-cstm-pop{from{opacity: 0;transform: scale(0.86)}
to{opacity: 1;transform: none}
}
@keyframes ui-cstm-bar{from{transform: scaleX(0)}
to{transform: scaleX(var(--share, 0))}
}
@keyframes ui-cstm-breathe{from{transform: scale(0.7);opacity: 0.06}
to{transform: scale(1.3);opacity: 0.22}
}
@container (max-width: 340px){.ui-cstm__value{font-size: 32px}
.ui-cstm__currency{font-size: 17px}
}
:where(.dark, [data-theme="dark"]) .ui-cstm{--ui-cstm-ink: var(--text, #f4ece4);--ui-cstm-soft: var(--text-muted, #a2958a);--ui-cstm-line: var(--border-soft, #ffffff12);--ui-cstm-edge: var(--border, #33291f);--ui-cstm-surface: var(--card, #201a15);--ui-cstm-track: var(--border-soft, #ffffff12);--ui-cstm-bar: var(--text-muted, #a2958a);--ui-cstm-accent: var(--accent, #ff6b35);--ui-cstm-strong: var(--accent-hover, #ff8256);--ui-cstm-wash: var(--accent-soft, #ff6b3524);--ui-cstm-shadow: var(--shadow-card, 0 1px 1.5px #0000004d, inset 0 -1px 0 #ffffff0a)}
@media (prefers-reduced-motion: reduce){.ui-cstm, .ui-cstm *, .ui-cstm *::before, .ui-cstm *::after{animation: none;transition-duration: 1ms}
}
`;
