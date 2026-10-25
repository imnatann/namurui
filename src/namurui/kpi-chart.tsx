"use client";

import {
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

/*
 * KPI Chart – a headline metric over a multi-line revenue chart, one card wide.
 *
 * The chart draws itself once on mount: the polyline set is clipped from the right
 * by `ui-kpic-draw` (1100 ms on the card's own easing) and the sheet drops the
 * animation under `prefers-reduced-motion`.
 *
 * The pointer and the keyboard drive the same cursor. Moving over the plot snaps to
 * the nearest day – a guide drops from the top edge, one dot lands on each series,
 * and the tooltip slides to that day, flipping to the left of the point past the
 * midpoint so it never leaves the card. Tabbing into the plot opens the cursor as
 * well; the arrow keys walk the days, Home/End jump to the ends, Escape closes, and
 * the tooltip is a live region so a screen reader reads each day's numbers as they
 * change.
 */

export type KpiSeries = {
  /** Channel name – printed beside the swatch in the tooltip. */
  label: string;
  /** Line, dot and swatch colour. Falls back to the built-in palette. */
  color?: string;
  /** One value per label, in the same order as `labels`. */
  values: number[];
};

export type KpiChartProps = {
  /** Card heading, e.g. "Revenue". */
  title: string;
  /** Axis labels in order – one per point. */
  labels: string[];
  /** One or more lines, each with a value for every label. */
  series: KpiSeries[];
  /** Formats axis ticks, the headline number, the delta and every tooltip value. */
  formatValue?: (value: number) => string;
  /** Headline number. Defaults to the sum of every series' last point. */
  value?: number;
  /** Change chip beside the headline. Omitted hides it; its sign picks the trend. */
  delta?: number;
  /** Formats the change chip, sign included. Defaults to `+`/`−` over `formatValue`. */
  formatDelta?: (value: number) => string;
  /** Longer per-point labels for the tooltip headline, e.g. "Mon, Mar 3". */
  dates?: string[];
  /** Caption below the rule at the foot of the card. */
  footer?: string;
  /** Levels on the y axis, top down to zero. Defaults to 3. */
  tickCount?: number;
  /** Day the cursor sits on before the pointer arrives. Defaults to the first. */
  defaultIndex?: number;
  /** Replaces the plot's screen-reader instructions. */
  ariaLabel?: string;
  className?: string;
};

/** 960 → "960", 5_900 → "5.9k", 2_400_000 → "2.4M". */
export function compactValue(value: number): string {
  const abs = Math.abs(value);
  if (abs < 1000) return String(Math.round(value * 10) / 10);
  const units: Array<[number, string]> = [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "k"],
  ];
  for (const [size, suffix] of units) {
    if (abs >= size) return (value / size).toFixed(1).replace(/\.0$/, "") + suffix;
  }
  return String(value);
}

/** Palette for series that do not name a colour, in draw order. */
const SERIES_COLORS = ["#2f6bff", "#ec4899", "#8b5cf6", "#14b8a6", "#a3a3a3"];

/** Rounds the top of the scale up to a step a person would have picked. */
function scaleTop(max: number, ticks: number): number {
  if (!(max > 0)) return 0;
  const steps = Math.max(1, ticks - 1);
  const rough = max / steps;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const ladder = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10];
  const step = (ladder.find((multiple) => multiple * magnitude >= rough) ?? 10) * magnitude;
  return step * steps;
}

/** Horizontal position of a point, as a percentage of the plot width. */
function offset(index: number, count: number): number {
  return count > 1 ? (index / (count - 1)) * 100 : 50;
}

export function KpiChart({
  title,
  labels,
  series,
  formatValue = compactValue,
  value,
  delta,
  formatDelta,
  dates,
  footer,
  tickCount = 3,
  defaultIndex = 0,
  ariaLabel,
  className,
}: KpiChartProps) {
  const count = labels.length;
  const steps = Math.max(1, tickCount - 1);
  const peak = series.reduce(
    (high, line) => line.values.reduce((a, b) => Math.max(a, b), high),
    0,
  );
  const top = scaleTop(peak, tickCount);
  const ticks = Array.from({ length: tickCount }, (_, i) => top - (top / steps) * i);
  const axisPoints =
    count <= 3 ? labels.map((_, i) => i) : [0, Math.round((count - 1) / 2), count - 1];

  const [cursor, setCursor] = useState(defaultIndex);
  const [open, setOpen] = useState(false);
  const index = Math.min(Math.max(cursor, 0), Math.max(count - 1, 0));
  const x = offset(index, count);
  const headline =
    value ?? series.reduce((sum, line) => sum + (line.values[line.values.length - 1] ?? 0), 0);

  /* The line, dot and swatch of one series always agree on this colour. */
  const colorOf = (line: KpiSeries, at: number) =>
    line.color ?? SERIES_COLORS[at % SERIES_COLORS.length];

  const follow = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width <= 0 || count === 0) return;
    const ratio = (event.clientX - box.left) / box.width;
    setCursor(Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1)))));
    setOpen(true);
  };

  const walk = (event: KeyboardEvent<HTMLDivElement>) => {
    if (count === 0) return;
    if (event.key === "Escape") {
      setOpen(false);
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      setCursor(Math.max(0, index - 1));
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      setCursor(Math.min(count - 1, index + 1));
    } else if (event.key === "Home") {
      setCursor(0);
    } else if (event.key === "End") {
      setCursor(count - 1);
    } else {
      return;
    }
    setOpen(true);
    event.preventDefault();
  };

  return (
    <section className={["ui-kpic", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-kpi-chart" precedence="default">
        {css}
      </style>

      <div className="ui-kpic__body">
        <h3 className="ui-kpic__title">{title}</h3>
        <p className="ui-kpic__value">
          {formatValue(headline)}
          {delta === undefined ? null : (
            <span className="ui-kpic__delta" data-trend={delta < 0 ? "down" : "up"}>
              {formatDelta
                ? formatDelta(delta)
                : `${delta > 0 ? "+" : delta < 0 ? "\u2212" : ""}${formatValue(
                    Math.abs(delta),
                  )}`}
            </span>
          )}
        </p>

        {count === 0 ? null : (
          <div className="ui-kpic__chart">
            <div className="ui-kpic__yaxis" aria-hidden="true">
              {ticks.map((tick, at) => (
                <span key={at}>{formatValue(tick)}</span>
              ))}
            </div>

            <div
              className="ui-kpic__plot"
              tabIndex={0}
              role="group"
              aria-label={
                ariaLabel ??
                `${title} chart \u2013 use the arrow keys to read the values per day`
              }
              onPointerMove={follow}
              onPointerDown={follow}
              onPointerLeave={() => setOpen(false)}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              onKeyDown={walk}
            >
              {ticks.map((_, at) => (
                <span
                  key={at}
                  className="ui-kpic__grid"
                  style={{ top: `${(at / steps) * 100}%` }}
                />
              ))}

              <svg
                className="ui-kpic__lines"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {series.map((line, at) => (
                  <polyline
                    key={line.label}
                    points={labels
                      .map(
                        (_, i) =>
                          `${offset(i, count)},${
                            top > 0 ? (1 - (line.values[i] ?? 0) / top) * 100 : 100
                          }`,
                      )
                      .join(" ")}
                    stroke={colorOf(line, at)}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>

              <div
                className="ui-kpic__marker"
                aria-hidden="true"
                data-open={open ? "" : undefined}
              >
                <span className="ui-kpic__guide" style={{ left: `${x}%` }} />
                {series.map((line, at) => (
                  <span
                    key={line.label}
                    className="ui-kpic__dot"
                    style={{
                      left: `${x}%`,
                      top: `${
                        top > 0 ? (1 - (line.values[index] ?? 0) / top) * 100 : 100
                      }%`,
                      background: colorOf(line, at),
                    }}
                  />
                ))}
              </div>

              <div
                className="ui-kpic__tooltip"
                data-side={x > 50 ? "left" : "right"}
                data-open={open ? "" : undefined}
                role="status"
                aria-live="polite"
                style={{ left: `${x}%` }}
              >
                <p className="ui-kpic__date">{dates?.[index] ?? labels[index]}</p>
                <ul>
                  {series.map((line, at) => (
                    <li key={line.label}>
                      <span
                        className="ui-kpic__swatch"
                        style={{ background: colorOf(line, at) }}
                      />
                      <span className="ui-kpic__label">{line.label}</span>
                      <span className="ui-kpic__num">
                        {formatValue(line.values[index] ?? 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="ui-kpic__xaxis" aria-hidden="true">
              {axisPoints.map((at) => (
                <span
                  key={at}
                  data-edge={at === 0 ? "start" : at === count - 1 ? "end" : undefined}
                  style={{ left: `${offset(at, count)}%` }}
                >
                  {labels[at]}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {footer ? <p className="ui-kpic__footer">{footer}</p> : null}
    </section>
  );
}

const css = /* css */ `
.ui-kpic{--ui-kpic-card: #fffdfb;--ui-kpic-pop: #fffdfb;--ui-kpic-ink: rgba(11, 9, 8, 0.88);--ui-kpic-strong: #0b0908;--ui-kpic-text: rgba(11, 9, 8, 0.61);--ui-kpic-muted: rgba(11, 9, 8, 0.45);--ui-kpic-line: rgba(11, 9, 8, 0.06);--ui-kpic-grid: rgba(11, 9, 8, 0.06);--ui-kpic-guide: rgba(11, 9, 8, 0.12);--ui-kpic-up: #2f8d5c;--ui-kpic-up-bg: rgba(47, 141, 92, 0.08);--ui-kpic-down: #e2544a;--ui-kpic-down-bg: rgba(226, 84, 74, 0.08);--ui-kpic-focus: rgba(217, 84, 31, 0.35);--ui-kpic-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-kpic-shadow-pop: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 12px 28px -10px rgba(11, 9, 8, 0.16), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-kpic-ease: cubic-bezier(0.22, 1, 0.36, 1);box-sizing: border-box;container-type: inline-size;width: 100%;max-width: 460px;border-radius: 10px;background: var(--ui-kpic-card);box-shadow: var(--ui-kpic-shadow);font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;font-weight: 400;color: var(--ui-kpic-ink);-webkit-font-smoothing: antialiased;font-variant-numeric: tabular-nums}
.ui-kpic *, .ui-kpic *::before, .ui-kpic *::after{box-sizing: border-box}
.ui-kpic__body{padding: 14px 16px 12px}
.ui-kpic__title{margin: 0;overflow: hidden;font-size: 15px;font-weight: 500;line-height: 24px;color: var(--ui-kpic-strong);white-space: nowrap;text-overflow: ellipsis}
.ui-kpic__value{display: flex;align-items: center;gap: 8px;margin: 6px 0 0;font-size: 24px;font-weight: 500;line-height: 32px;letter-spacing: -0.02em;color: var(--ui-kpic-strong)}
.ui-kpic__delta{display: inline-flex;align-items: center;height: 20px;padding: 0 6px;border-radius: 5px;font-size: 12px;font-weight: 500;line-height: 16px;letter-spacing: 0}
.ui-kpic__delta[data-trend="up"]{background: var(--ui-kpic-up-bg);color: var(--ui-kpic-up)}
.ui-kpic__delta[data-trend="down"]{background: var(--ui-kpic-down-bg);color: var(--ui-kpic-down)}
.ui-kpic__chart{display: grid;grid-template-columns: auto 1fr;grid-template-rows: 124px 16px;column-gap: 10px;row-gap: 8px;margin-top: 20px}
.ui-kpic__yaxis{display: flex;flex-direction: column;justify-content: space-between;margin: -8px 0;font-size: 11px;line-height: 16px;text-align: right;color: var(--ui-kpic-muted)}
.ui-kpic__plot{position: relative;touch-action: pan-y;outline: none;cursor: crosshair}
.ui-kpic__plot:focus-visible{border-radius: 4px;outline: 2px solid var(--ui-kpic-focus);outline-offset: 4px}
.ui-kpic__grid{position: absolute;left: 0;right: 0;height: 0;border-top: 0.5px solid var(--ui-kpic-grid)}
.ui-kpic__lines{position: absolute;inset: 0;width: 100%;height: 100%;overflow: visible;animation: ui-kpic-draw 1100ms var(--ui-kpic-ease) both}
.ui-kpic__lines polyline{fill: none;stroke-width: 1.5;stroke-linecap: round;stroke-linejoin: round}
.ui-kpic__marker{position: absolute;inset: 0;pointer-events: none;opacity: 0;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-kpic__marker[data-open]{opacity: 1}
.ui-kpic__guide, .ui-kpic__dot{position: absolute;transition: left 90ms ease-out, top 90ms ease-out}
.ui-kpic__guide{top: -4px;bottom: 0;width: 0;border-left: 1px solid var(--ui-kpic-guide);margin-left: -0.5px}
.ui-kpic__dot{width: 8px;height: 8px;margin: -4px 0 0 -4px;border-radius: 50%;box-shadow: 0 0 0 2px var(--ui-kpic-card)}
.ui-kpic__tooltip{position: absolute;top: -8px;z-index: 2;min-width: 160px;padding: 6px 10px 8px;border-radius: 10px;background: var(--ui-kpic-pop);box-shadow: var(--ui-kpic-shadow-pop);pointer-events: none;opacity: 0;transform: translateX(var(--ui-kpic-shift)) scale(0.98);transition: left 90ms ease-out, opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-2, 160ms) var(--ui-kpic-ease)}
.ui-kpic__tooltip[data-side="right"]{--ui-kpic-shift: 14px;transform-origin: left top}
.ui-kpic__tooltip[data-side="left"]{--ui-kpic-shift: calc(-100% - 14px);transform-origin: right top}
.ui-kpic__tooltip[data-open]{opacity: 1;transform: translateX(var(--ui-kpic-shift))}
.ui-kpic__date{margin: 0;font-size: 13px;line-height: 20px;font-weight: 500;color: var(--ui-kpic-strong);white-space: nowrap}
.ui-kpic__tooltip ul{display: grid;gap: 0;margin: 4px 0 0;padding: 4px 0 0;border-top: 0.5px solid var(--ui-kpic-line);list-style: none}
.ui-kpic__tooltip li{display: flex;align-items: center;gap: 8px;font-size: 12px;line-height: 20px;color: var(--ui-kpic-text)}
.ui-kpic__swatch{flex: none;width: 8px;height: 8px;border-radius: 2px}
.ui-kpic__label{flex: 1;white-space: nowrap}
.ui-kpic__num{padding-left: 16px;color: var(--ui-kpic-ink)}
.ui-kpic__xaxis{position: relative;grid-column: 2;font-size: 11px;line-height: 16px;color: var(--ui-kpic-muted)}
.ui-kpic__xaxis span{position: absolute;top: 0;white-space: nowrap;transform: translateX(-50%)}
.ui-kpic__xaxis span[data-edge="start"]{transform: none}
.ui-kpic__xaxis span[data-edge="end"]{transform: translateX(-100%)}
.ui-kpic__footer{margin: 0;padding: 10px 16px;border-top: 0.5px solid var(--ui-kpic-line);font-size: 12px;line-height: 16px;color: var(--ui-kpic-muted)}
@keyframes ui-kpic-draw{from{clip-path: inset(-10% 100% -10% 0)}
to{clip-path: inset(-10% -2% -10% 0)}
}
@container (max-width: 360px){.ui-kpic__body{padding: 12px 12px 10px}
.ui-kpic__chart{grid-template-rows: 112px 16px;column-gap: 8px}
.ui-kpic__footer{padding: 10px 12px}
.ui-kpic__tooltip{min-width: 144px}
.ui-kpic__num{padding-left: 12px}
}
@media (prefers-reduced-motion: reduce){.ui-kpic__lines{animation: none}
.ui-kpic__marker, .ui-kpic__guide, .ui-kpic__dot, .ui-kpic__tooltip{transition: none}
}
:where(.dark, [data-theme="dark"]) .ui-kpic{--ui-kpic-card: #211b16;--ui-kpic-pop: #28211a;--ui-kpic-ink: rgba(255, 253, 251, 0.9);--ui-kpic-strong: #fffdfb;--ui-kpic-text: rgba(255, 253, 251, 0.62);--ui-kpic-muted: rgba(255, 253, 251, 0.46);--ui-kpic-line: rgba(255, 253, 251, 0.08);--ui-kpic-grid: rgba(255, 253, 251, 0.08);--ui-kpic-guide: rgba(255, 253, 251, 0.2);--ui-kpic-up: #2f8d5c;--ui-kpic-up-bg: rgba(47, 141, 92, 0.14);--ui-kpic-down: #e2544a;--ui-kpic-down-bg: rgba(226, 84, 74, 0.14);--ui-kpic-focus: rgba(255, 138, 92, 0.5);--ui-kpic-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-kpic-shadow-pop: 0 0 0 0.5px rgba(255, 253, 251, 0.12), 0 12px 28px -10px rgba(11, 9, 8, 0.6)}

`;
