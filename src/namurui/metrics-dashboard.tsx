"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

/*
 * Metrics Dashboard – a compact sales overview in a single self-contained file.
 *
 * The top bar carries the period switch and Export; four KPI cards act as tabs for the one chart
 * below them – the chosen card turns fully opaque while the others dim. The chart draws the chosen
 * series either as a smoothed line with its dots popping on one after another, or as columns that
 * grow up from the baseline, and the previous period can be overlaid as a dashed line.
 *
 * Pointing at the plot snaps to the nearest day: a guide drops from the top edge, dots land on both
 * series and a dark tooltip follows the point, flipping to its left past the midpoint so it never
 * leaves the card. Tabbing into the plot opens the same cursor; the arrow keys walk the points,
 * Home/End jump to the ends and Escape closes. The tooltip is a status region, so a screen reader
 * reads the day's figures as they change.
 *
 * Figures count to their new amounts on range and metric changes (the sheet drops the transitions
 * under prefers-reduced-motion, and the numbers switch instantly there).
 */

/** How a figure is written */
export type MdUnits = {
  /** money writes $1,234, count writes 1,234, percent writes 12.3% */
  kind?: "money" | "count" | "percent";
  /** Fraction digits on the figure. Defaults to 0 for money and count, 1 for percent. */
  decimals?: number;
};

/** The move against the period before */
export type MdChange = {
  /** Size of the move, always a positive number */
  amount: number;
  /** "%" writes 11.7%, "pts" writes 0.0 pts. Defaults to percent. */
  unit?: "%" | "pts";
  /** "up" draws the rising chevron, "down" the falling one. Defaults to up. */
  trend?: "up" | "down";
  /** Paints the chip green. Defaults to true – a falling refund rate is good too, a rising one is not. */
  good?: boolean;
};

/** One line in the two lists at the foot of the card */
export type MdRow = {
  /** Product or channel name */
  name: string;
  /** Figure in the chosen metric's own unit */
  value: number;
};

/** One KPI card, and the series its chart shows when the card is picked */
export type MdMetric = {
  /** Stable key – keeps the cards and the chart steady across range changes */
  id: string;
  /** Card label, e.g. "Revenue" */
  label: string;
  /** The headline figure */
  value: number;
  /** The move against the period before */
  change: MdChange;
  /** How the figure, the axis and the lists are written. Defaults to a plain count. */
  units?: MdUnits;
  /** Points for the chart, oldest first */
  series: number[];
  /** The period before, index-aligned with series. Overlaid when Compare is on. */
  previous?: number[];
  /** One caption per point – dates for a day series, week endings for a quarter */
  labels?: string[];
  /** Top products for this metric */
  products?: MdRow[];
  /** Channels for this metric */
  channels?: MdRow[];
};

/** One period the switch can pick */
export type MdRangeOption = {
  /** Stable key, handed to onRangeChange and onExport */
  id: string;
  /** Button label, e.g. "Month" */
  label: string;
  /** Caption under the title and in the chart's screen-reader label, e.g. "Last 30 days" */
  caption: string;
};

/** The period switch */
export type MdRange = {
  /** Week, month, quarter – the switch sizes itself to three of them */
  options: MdRangeOption[];
  /** Group label for the switch. Defaults to "Period". */
  label?: string;
  /** Controlled value. Leave out to let the switch keep its own. */
  value?: string;
  /** Period to start on */
  defaultValue?: string;
  /** Fires with the new period id, whether controlled or not */
  onChange?: (id: string) => void;
};

/** The two chart views */
export type MdChart = "line" | "bars";

export type MetricsDashboardProps = {
  /** The four KPI cards. The first is in focus on mount. */
  metrics: MdMetric[];
  /** The period switch */
  range: MdRange;
  /** Title in the bar on top. Defaults to "Sales". */
  title?: string;
  /** Site or workspace under the title. Defaults to "Northwind Store". */
  site?: string;
  /** Metric in focus to start on. Defaults to the first card. */
  defaultMetric?: string;
  /** View to start on. Defaults to the line. */
  defaultChart?: MdChart;
  /** Starts with the previous period overlaid */
  defaultCompare?: boolean;
  /** Called when Export is pressed; the button confirms locally either way. */
  onExport?: (range: string, metric: string) => void;
  /** Extra class on the root */
  className?: string;
};

const WIDTH = 600;
const HEIGHT = 200;
const TICK_COUNT = 4;

/* ---------- Formatting ---------- */

function formatUnits(value: number, units: MdUnits = {}): string {
  const kind = units.kind ?? "count";
  const decimals = units.decimals ?? (kind === "percent" ? 1 : 0);
  const text = value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (kind === "money") return `$${text}`;
  if (kind === "percent") return `${text}%`;
  return text;
}

/** Axis ticks are compact – $20K rather than $20,000 */
function formatTick(value: number, units: MdUnits = {}): string {
  const kind = units.kind ?? "count";
  const abs = Math.abs(value);
  let text: string;
  if (abs >= 1000) {
    const thousands = value / 1000;
    text = `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}K`;
  } else {
    text = Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
  if (kind === "money") return `$${text}`;
  if (kind === "percent") return `${text}%`;
  return text;
}

/** Four steps up to a round ceiling, so the top gridline sits above the peak */
function axisFor(values: number[]): { max: number; ticks: number[] } {
  const peak = values.reduce((top, value) => (value > top ? value : top), 0);
  if (!(peak > 0)) return { max: TICK_COUNT, ticks: [4, 3, 2, 1, 0] };
  const rough = peak / TICK_COUNT;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  const step =
    (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10) *
    magnitude;
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => step * (TICK_COUNT - i));
  return { max: step * TICK_COUNT, ticks };
}

/* ---------- Geometry ---------- */

const round = (value: number) => Math.round(value * 1000) / 1000;

/** Percentages are written to six significant digits, as the original did */
const pct = (value: number) => Number(value.toPrecision(6));

const pointY = (value: number, max: number) =>
  HEIGHT - (Math.min(Math.max(value, 0), max) / max) * HEIGHT;

const leftPercent = (index: number, count: number) =>
  count <= 1 ? 0 : pct((index / (count - 1)) * 100);

const topPercent = (value: number, max: number) => pct((pointY(value, max) / HEIGHT) * 100);

/** A smoothed line through every point, flattened at the peaks so it never overshoots a day */
function curveFor(values: number[], max: number): string {
  const count = values.length;
  if (count === 0) return "";
  const points = values.map((value, index) => ({
    x: count === 1 ? 0 : (index / (count - 1)) * WIDTH,
    y: pointY(value, max),
  }));
  if (count === 1) return `M${round(points[0].x)},${round(points[0].y)}`;

  const slopes = points.slice(0, -1).map((point, index) => {
    const next = points[index + 1];
    return (next.y - point.y) / (next.x - point.x);
  });
  const tangents = points.map((_, index) => {
    if (index === 0) return slopes[0];
    if (index === count - 1) return slopes[count - 2];
    const before = slopes[index - 1];
    const after = slopes[index];
    if (before * after <= 0) return 0;
    const centred = (before + after) / 2;
    const limit = 3 * Math.min(Math.abs(before), Math.abs(after));
    return (centred > 0 ? 1 : -1) * Math.min(Math.abs(centred), limit);
  });

  let d = `M${round(points[0].x)},${round(points[0].y)}`;
  for (let index = 0; index < count - 1; index += 1) {
    const span = points[index + 1].x - points[index].x;
    const c1x = points[index].x + span / 3;
    const c1y = points[index].y + (tangents[index] * span) / 3;
    const c2x = points[index + 1].x - span / 3;
    const c2y = points[index + 1].y - (tangents[index + 1] * span) / 3;
    d += `C${round(c1x)},${round(c1y)} ${round(c2x)},${round(c2y)} ${round(points[index + 1].x)},${round(points[index + 1].y)}`;
  }
  return d;
}

/* ---------- Motion ---------- */

/** Counts to a new amount with tabular numerals; switches instantly under reduced motion */
function useCountUp(value: number, duration = 720): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (from.current === value) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      from.current = value;
      setShown(value);
      return;
    }
    const origin = from.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const next = origin + (value - origin) * (1 - (1 - t) ** 3);
      from.current = next;
      setShown(next);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        from.current = value;
        setShown(value);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return shown;
}

export function MetricsDashboard({
  metrics,
  range,
  title = "Sales",
  site = "Northwind Store",
  defaultMetric,
  defaultChart = "line",
  defaultCompare = false,
  onExport,
  className,
}: MetricsDashboardProps) {
  const [period, setPeriod] = useState(range.defaultValue ?? range.options[0]?.id ?? "");
  const [metricId, setMetricId] = useState(defaultMetric ?? metrics[0]?.id ?? "");
  const [chart, setChart] = useState<MdChart>(defaultChart);
  const [compare, setCompare] = useState(defaultCompare);
  const [point, setPoint] = useState<number | null>(null);
  const [exported, setExported] = useState(false);
  const confirmTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (confirmTimer.current !== null) window.clearTimeout(confirmTimer.current);
    },
    [],
  );

  const activePeriod = range.value ?? period;
  const option = range.options.find((entry) => entry.id === activePeriod) ?? range.options[0];
  const active = metrics.find((entry) => entry.id === metricId) ?? metrics[0];

  const pickPeriod = (id: string) => {
    if (range.value === undefined) setPeriod(id);
    setPoint(null);
    range.onChange?.(id);
  };

  const pickMetric = (id: string) => {
    setMetricId(id);
    setPoint(null);
  };

  const exportNow = (metric: string) => {
    onExport?.(activePeriod, metric);
    setExported(true);
    if (confirmTimer.current !== null) window.clearTimeout(confirmTimer.current);
    confirmTimer.current = window.setTimeout(() => setExported(false), 1800);
  };

  if (!active) {
    return (
      <div className={["ui-md", className].filter(Boolean).join(" ")}>
        <style href="ui-metrics-dashboard" precedence="default">
          {css}
        </style>
      </div>
    );
  }

  const units = active.units;
  const values = active.series;
  const count = values.length;
  const previous = compare ? active.previous : undefined;
  const axis = axisFor(previous ? [...values, ...previous] : values);
  const captions = active.labels ?? [];
  const caption = option?.caption ?? "";
  const heading = `${active.label} over the ${caption.replace(/^./, (letter) => letter.toLowerCase())}`;
  const spoken =
    count > 0
      ? `${heading}, from ${formatUnits(values[0], units)} to ${formatUnits(values[count - 1], units)}. Use the arrow keys to inspect points.`
      : `${heading}. Use the arrow keys to inspect points.`;

  const at = point !== null && point < count ? point : null;
  const line = curveFor(values, axis.max);
  const areaLine = previous ? curveFor(previous, axis.max) : "";
  const gradientId = `ui-md_${active.id.charAt(0)}_${Math.max(1, range.options.findIndex((entry) => entry.id === activePeriod) + 1)}_-area`;

  const indexAt = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0 || count === 0) return 0;
    const ratio = (event.clientX - box.left) / box.width;
    return Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1))));
  };

  const walk = (event: KeyboardEvent<HTMLDivElement>) => {
    if (count === 0) return;
    const current = at ?? 0;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const next = current + (event.key === "ArrowRight" ? 1 : -1);
      setPoint(Math.min(count - 1, Math.max(0, next)));
    } else if (event.key === "Home") {
      event.preventDefault();
      setPoint(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setPoint(count - 1);
    } else if (event.key === "Escape") {
      setPoint(null);
    }
  };

  const tipLeft = at !== null ? leftPercent(at, count) : 0;
  const tickLabels = axis.ticks.map((tick) => formatTick(tick, units));
  const captionStep = Math.max(1, Math.ceil(count / 6));
  const captionAt = Array.from({ length: Math.ceil(count / captionStep) }, (_, step) => step * captionStep);

  return (
    <div className={["ui-md", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-metrics-dashboard" precedence="default">
        {css}
      </style>

      <div className="ui-md__bar">
        <div className="ui-md__heading">
          <span className="ui-md__title">{title}</span>
          <span className="ui-md__site">
            {site} · {caption}
          </span>
        </div>
        <div className="ui-md__actions">
          <div className="ui-md__range" role="group" aria-label={range.label ?? "Period"}>
            <span
              className="ui-md__range-thumb"
              aria-hidden="true"
              style={{
                transform: `translateX(${
                  Math.max(0, range.options.findIndex((entry) => entry.id === activePeriod)) * 100
                }%)`,
              }}
            />
            {range.options.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={entry.id === activePeriod}
                onClick={() => pickPeriod(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="ui-md__export"
            onClick={() => exportNow(active.id)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" />
            </svg>
            <span aria-live="polite">{exported ? "Exported" : "Export"}</span>
          </button>
        </div>
      </div>

      <div className="ui-md__kpis" role="tablist" aria-label="Metric">
        {metrics.map((entry) => (
          <KpiCard
            key={entry.id}
            metric={entry}
            selected={entry.id === active.id}
            onSelect={() => pickMetric(entry.id)}
          />
        ))}
      </div>

      <div className="ui-md__card">
        <div className="ui-md__chart">
          <div className="ui-md__chart-head">
            <span className="ui-md__legend">
              <i aria-hidden="true" />
              {active.label}
            </span>
            <div className="ui-md__chart-tools">
              <div className="ui-md__kind" role="group" aria-label="Chart type">
                <span
                  className="ui-md__kind-thumb"
                  aria-hidden="true"
                  style={chart === "bars" ? { transform: "translateX(100%)" } : undefined}
                />
                <button
                  type="button"
                  aria-pressed={chart === "line"}
                  aria-label="Line chart"
                  onClick={() => setChart("line")}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3.5 16.5 9 11l4 3.5 7.5-8" />
                    <circle cx="9" cy="11" r="1.6" />
                    <circle cx="13" cy="14.5" r="1.6" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-pressed={chart === "bars"}
                  aria-label="Bar chart"
                  onClick={() => setChart("bars")}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5.5 19.5v-6M10 19.5V8M14.5 19.5v-9M19 19.5V5" />
                  </svg>
                </button>
              </div>
              <label className="ui-md__compare">
                <input
                  type="checkbox"
                  checked={compare}
                  onChange={(event) => {
                    setCompare(event.target.checked);
                    setPoint(null);
                  }}
                />
                <span className="ui-md__switch" aria-hidden="true" />
                Compare to previous period
              </label>
            </div>
          </div>

          <div className="ui-md__plot-wrap">
            <div className="ui-md__axis" aria-hidden="true">
              {tickLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div
              className="ui-md__plot"
              tabIndex={0}
              role="img"
              aria-label={spoken}
              onPointerMove={(event) => setPoint(indexAt(event))}
              onPointerLeave={() => setPoint(null)}
              onFocus={() => setPoint((current) => current ?? 0)}
              onBlur={() => setPoint(null)}
              onKeyDown={walk}
            >
              <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" className="ui-md__area-a" />
                    <stop offset="100%" className="ui-md__area-b" />
                  </linearGradient>
                </defs>
                <line
                  className="ui-md__base"
                  x1="0"
                  x2={WIDTH}
                  y1={HEIGHT}
                  y2={HEIGHT}
                />
                {axis.ticks.slice(0, -1).map((tick) => {
                  const y = pointY(tick, axis.max);
                  return (
                    <line
                      key={tick}
                      className="ui-md__grid"
                      x1="0"
                      x2={WIDTH}
                      y1={round(y)}
                      y2={round(y)}
                    />
                  );
                })}
                {chart === "line" ? (
                  <g
                    key={`${active.id}-${activePeriod}`}
                    className="ui-md__series"
                  >
                    {previous ? (
                      <path key="previous" className="ui-md__prev" d={areaLine} />
                    ) : null}
                    <path
                      className="ui-md__area"
                      d={line ? `${line}L${WIDTH},${HEIGHT}L0,${HEIGHT}Z` : ""}
                      fill={`url(#${gradientId})`}
                    />
                    <path className="ui-md__line" d={line} />
                  </g>
                ) : null}
                {at !== null ? (
                  <line
                    className="ui-md__guide"
                    x1={round(leftPercent(at, count) * (WIDTH / 100))}
                    x2={round(leftPercent(at, count) * (WIDTH / 100))}
                    y1="0"
                    y2={HEIGHT}
                  />
                ) : null}
              </svg>

              {chart === "line" ? (
                <div
                  key={`dots-${active.id}-${activePeriod}`}
                  className="ui-md__dots"
                  aria-hidden="true"
                >
                  {values.map((value, index) => (
                    <span
                      key={index}
                      style={{
                        left: `${leftPercent(index, count)}%`,
                        top: `${topPercent(value, axis.max)}%`,
                        animationDelay: `${pct((index * 700) / Math.max(1, count))}ms`,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div
                  key={`bars-${active.id}-${activePeriod}`}
                  className="ui-md__bars"
                  data-compare={previous ? "" : undefined}
                  aria-hidden="true"
                >
                  {values.map((value, index) => (
                    <div
                      key={index}
                      className="ui-md__bar-slot"
                      data-active={at === index ? "" : undefined}
                    >
                      {previous && previous[index] !== undefined ? (
                        <span
                          className="ui-md__col ui-md__col--prev"
                          style={
                            {
                              height: `${pct((previous[index] / axis.max) * 100)}%`,
                              "--d": `${index * 14}ms`,
                            } as CSSProperties
                          }
                        />
                      ) : null}
                      <span
                        className="ui-md__col"
                        style={
                          {
                            height: `${pct((value / axis.max) * 100)}%`,
                            "--d": `${index * 14}ms`,
                          } as CSSProperties
                        }
                      />
                    </div>
                  ))}
                </div>
              )}

              {chart === "line" && at !== null ? (
                <>
                  <span
                    className="ui-md__dot"
                    style={{
                      left: `${leftPercent(at, count)}%`,
                      top: `${topPercent(values[at], axis.max)}%`,
                    }}
                  />
                  {previous && previous[at] !== undefined ? (
                    <span
                      className="ui-md__dot ui-md__dot--prev"
                      style={{
                        left: `${leftPercent(at, count)}%`,
                        top: `${topPercent(previous[at], axis.max)}%`,
                      }}
                    />
                  ) : null}
                </>
              ) : null}

              {at !== null ? (
                <div
                  className="ui-md__tip"
                  role="status"
                  data-side={tipLeft > 55 ? "left" : "right"}
                  style={{ left: `${tipLeft}%` }}
                >
                  <span className="ui-md__tip-date">{captions[at] ?? `${at + 1}`}</span>
                  <span className="ui-md__tip-row">
                    <i />
                    <span>{active.label}</span>
                    <b>{formatUnits(values[at], units)}</b>
                  </span>
                  {previous && previous[at] !== undefined ? (
                    <span className="ui-md__tip-row ui-md__tip-row--prev">
                      <i />
                      <span>Previous</span>
                      <b>{formatUnits(previous[at], units)}</b>
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="ui-md__dates" aria-hidden="true">
              {captionAt.map((index) => (
                <span
                  key={index}
                  data-start={index === 0 ? "" : undefined}
                  data-end={index === count - 1 ? "" : undefined}
                  style={{ left: `${leftPercent(index, count)}%` }}
                >
                  {captions[index] ?? index + 1}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="ui-md__lists">
          <ChartList
            title="Top products"
            heading={active.label}
            rows={active.products}
            units={units}
          />
          <ChartList
            title="Channels"
            heading={active.label}
            rows={active.channels}
            units={units}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------- KPI card ---------- */

function KpiCard({
  metric,
  selected,
  onSelect,
}: {
  metric: MdMetric;
  selected: boolean;
  onSelect: () => void;
}) {
  const shown = useCountUp(metric.value);
  const trend = metric.change.trend ?? "up";
  const good = metric.change.good ?? true;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className="ui-md__kpi"
      onClick={onSelect}
    >
      <span className="ui-md__kpi-label">{metric.label}</span>
      <span className="ui-md__kpi-value">{formatUnits(shown, metric.units)}</span>
      <span className="ui-md__delta" data-good={good ? "" : undefined}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d={trend === "up" ? "M7 14.5 12 9.5l5 5" : "M7 9.5 12 14.5l5-5"} />
        </svg>
        {metric.change.unit === "pts"
          ? `${metric.change.amount.toFixed(1)} pts`
          : `${metric.change.amount.toFixed(1)}%`}
        <span className="ui-md__sr">{` ${trend} versus the previous period`}</span>
      </span>
    </button>
  );
}

/* ---------- Breakdown list ---------- */

function ChartList({
  title,
  heading,
  rows,
  units,
}: {
  title: string;
  heading: string;
  rows?: MdRow[];
  units?: MdUnits;
}) {
  const list = rows ?? [];
  const top = list.reduce((max, row) => (row.value > max ? row.value : max), 0);

  return (
    <div className="ui-md__list">
      <div className="ui-md__list-head">
        <span>{title}</span>
        <span>{heading}</span>
      </div>
      <ul>
        {list.map((row) => (
          <BreakdownRow key={row.name} row={row} top={top} units={units} />
        ))}
      </ul>
    </div>
  );
}

function BreakdownRow({ row, top, units }: { row: MdRow; top: number; units?: MdUnits }) {
  const shown = useCountUp(row.value);

  return (
    <li className="ui-md__row">
      <span
        className="ui-md__row-bar"
        aria-hidden="true"
        style={{ width: `${top > 0 ? pct((row.value / top) * 100) : 0}%` }}
      />
      <span className="ui-md__row-name">{row.name}</span>
      <span className="ui-md__row-value">{formatUnits(shown, units)}</span>
    </li>
  );
}

const css = /* css */ `
.ui-md{--ui-md-tray: #eee6de;--ui-md-card: #fffdfb;--ui-md-card-line: #ded4ca;--ui-md-line: #eae2d9;--ui-md-ink: #1c1713;--ui-md-text: #3d3226;--ui-md-muted: #857567;--ui-md-accent: #ff6b35;--ui-md-area: rgba(255, 107, 53, 0.16);--ui-md-prev: #a5988d;--ui-md-good: #1a7a4a;--ui-md-good-bg: #eee6dd;--ui-md-bad: #b3261e;--ui-md-bad-bg: #f4ece4;--ui-md-bar: #f9f5f1;--ui-md-chip: #fffdfb;--ui-md-thumb: #fffdfb;--ui-md-hover: rgba(11, 9, 8, 0.04);--ui-md-tip: #1c1713;--ui-md-tip-text: #fffdfb;--ui-md-shadow: 0 1px 2px rgba(11, 9, 8, 0.06);--ui-md-ease: cubic-bezier(0.65, 0, 0.25, 1);--ui-md-spring: cubic-bezier(0.34, 1.3, 0.64, 1);container-type: inline-size;padding: 0 6px 6px;border-radius: 24px;background: var(--ui-md-tray);font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;color: var(--ui-md-ink);-webkit-font-smoothing: antialiased}
.ui-md *, .ui-md *::before, .ui-md *::after{box-sizing: border-box}
.ui-md button{font: inherit;color: inherit;margin: 0;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-md :focus-visible{outline: 2px solid var(--ui-md-accent);outline-offset: 2px}
.ui-md__sr{position: absolute;width: 1px;height: 1px;overflow: hidden;clip: rect(0 0 0 0);white-space: nowrap}
.ui-md__bar{display: flex;align-items: center;justify-content: space-between;gap: 12px;padding: 12px 8px 12px 14px}
.ui-md__heading{display: flex;flex-direction: column;gap: 1px;min-width: 0}
.ui-md__title{font-size: 15px;font-weight: 600;letter-spacing: -0.01em}
.ui-md__site{font-size: 12.5px;color: var(--ui-md-muted);white-space: nowrap}
.ui-md__actions{display: flex;align-items: center;gap: 8px}
.ui-md__range{position: relative;display: grid;grid-template-columns: repeat(3, 64px);padding: 3px;border-radius: 10px;background: rgba(11, 9, 8, 0.05)}
.ui-md__range-thumb{position: absolute;top: 3px;left: 3px;width: 64px;height: calc(100% - 6px);border-radius: 7px;background: var(--ui-md-thumb);box-shadow: 0 1px 2px rgba(11, 9, 8, 0.08), 0 0 0 1px rgba(11, 9, 8, 0.04);transition: transform var(--nm-dur-4, 380ms) var(--ui-md-spring)}
.ui-md__range button{position: relative;height: 28px;padding: 0;border: 0;border-radius: 7px;background: none;font-size: 12.5px;font-weight: 500;color: var(--ui-md-muted);transition: color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-md__range button[aria-pressed="true"]{color: var(--ui-md-ink)}
.ui-md__export{display: inline-flex;align-items: center;gap: 6px;height: 34px;padding: 0 12px 0 10px;border: 0;border-radius: 10px;background: var(--ui-md-chip);box-shadow: 0 0 0 1px var(--ui-md-card-line), var(--ui-md-shadow);font-size: 13px;font-weight: 500;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-md__export:hover{background: color-mix(in srgb, var(--ui-md-chip) 92%, var(--ui-md-ink))}
.ui-md__export svg{width: 16px;height: 16px;fill: none;stroke: currentColor;stroke-width: 1.8;stroke-linecap: round;stroke-linejoin: round}
.ui-md__card{overflow: hidden;border: 1px solid var(--ui-md-card-line);border-radius: 20px;background: var(--ui-md-card);box-shadow: var(--ui-md-shadow)}
.ui-md__kpis{display: grid;grid-template-columns: repeat(4, minmax(0, 1fr));gap: 6px;margin-bottom: 6px}
.ui-md__kpi{display: flex;flex-direction: column;align-items: flex-start;gap: 4px;min-width: 0;padding: 14px 16px 13px;border: 1px solid var(--ui-md-card-line);border-radius: 16px;background: var(--ui-md-card);box-shadow: var(--ui-md-shadow);text-align: left;opacity: 0.5;filter: saturate(0.2);transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), filter var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-3, 240ms) var(--ui-md-spring)}
.ui-md__kpi:hover{opacity: 0.8}
.ui-md__kpi[aria-selected="true"]{opacity: 1;filter: none}
.ui-md__kpi:active{transform: scale(0.98)}
.ui-md__kpi-label{font-size: 12.5px;color: var(--ui-md-text)}
.ui-md__kpi-value{font-size: 24px;font-weight: 600;letter-spacing: -0.02em;line-height: 1.15;font-variant-numeric: tabular-nums}
.ui-md__delta{display: inline-flex;align-items: center;gap: 2px;height: 20px;padding: 0 7px 0 4px;border-radius: 999px;background: var(--ui-md-bad-bg);font-size: 11.5px;font-weight: 500;font-variant-numeric: tabular-nums;color: var(--ui-md-bad)}
.ui-md__delta[data-good]{background: var(--ui-md-good-bg);color: var(--ui-md-good)}
.ui-md__delta svg{width: 14px;height: 14px;fill: none;stroke: currentColor;stroke-width: 2;stroke-linecap: round;stroke-linejoin: round}
.ui-md__chart{padding: 16px 18px 12px;border-bottom: 1px solid var(--ui-md-line)}
.ui-md__chart-head{display: flex;align-items: center;justify-content: space-between;gap: 12px;margin-bottom: 14px}
.ui-md__legend{display: inline-flex;align-items: center;gap: 7px;font-size: 12.5px;font-weight: 500;color: var(--ui-md-text)}
.ui-md__legend i{width: 14px;height: 2.5px;border-radius: 2px;background: var(--ui-md-accent)}
.ui-md__chart-tools{display: flex;align-items: center;gap: 14px}
.ui-md__kind{position: relative;display: grid;grid-template-columns: 30px 30px;padding: 2px;border-radius: 9px;background: rgba(11, 9, 8, 0.05)}
.ui-md__kind-thumb{position: absolute;top: 2px;left: 2px;width: 30px;height: calc(100% - 4px);border-radius: 7px;background: var(--ui-md-thumb);box-shadow: 0 1px 2px rgba(11, 9, 8, 0.08), 0 0 0 1px rgba(11, 9, 8, 0.04);transition: transform 380ms var(--ui-md-spring)}
.ui-md__kind button{position: relative;display: grid;place-items: center;height: 24px;padding: 0;border: 0;background: none;color: var(--ui-md-muted);transition: color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-md__kind button[aria-pressed="true"]{color: var(--ui-md-ink)}
.ui-md__kind svg{width: 16px;height: 16px;fill: none;stroke: currentColor;stroke-width: 1.8;stroke-linecap: round;stroke-linejoin: round}
.ui-md__kind circle{fill: var(--ui-md-thumb)}
.ui-md__compare{display: inline-flex;align-items: center;gap: 8px;font-size: 12.5px;color: var(--ui-md-muted);cursor: pointer;user-select: none}
.ui-md__compare input{position: absolute;opacity: 0;pointer-events: none}
.ui-md__switch{position: relative;width: 28px;height: 16px;border-radius: 999px;background: #ccc1b6;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-md__switch::after{content: "";position: absolute;top: 2px;left: 2px;width: 12px;height: 12px;border-radius: 50%;background: #fffdfb;box-shadow: 0 1px 2px rgba(11, 9, 8, 0.2);transition: transform var(--nm-dur-3, 240ms) var(--ui-md-spring)}
.ui-md__compare input:checked + .ui-md__switch{background: var(--ui-md-accent)}
.ui-md__compare input:checked + .ui-md__switch::after{transform: translateX(12px)}
.ui-md__compare input:focus-visible + .ui-md__switch{outline: 2px solid var(--ui-md-accent);outline-offset: 2px}
.ui-md__plot-wrap{display: grid;grid-template-columns: auto minmax(0, 1fr);grid-template-rows: 200px auto;column-gap: 10px}
.ui-md__axis{display: flex;flex-direction: column;justify-content: space-between;margin: -7px 0;font-size: 11px;font-variant-numeric: tabular-nums;text-align: right;color: var(--ui-md-muted)}
.ui-md__plot{position: relative;outline-offset: 4px;border-radius: 4px;touch-action: pan-y}
.ui-md__plot svg{display: block;width: 100%;height: 100%;overflow: visible}
.ui-md__grid{stroke: var(--ui-md-line);stroke-width: 1;stroke-dasharray: 3 4;vector-effect: non-scaling-stroke}
.ui-md__base{stroke: var(--ui-md-line);stroke-width: 1;vector-effect: non-scaling-stroke}
.ui-md__area-a{stop-color: var(--ui-md-area)}
.ui-md__area-b{stop-color: var(--ui-md-area);stop-opacity: 0}
.ui-md__series{animation: ui-md-reveal var(--nm-dur-6, 1100ms) var(--ui-md-ease) both}
.ui-md__line{fill: none;stroke: var(--ui-md-accent);stroke-width: 2;stroke-linejoin: round;stroke-linecap: round;vector-effect: non-scaling-stroke}
.ui-md__prev{fill: none;stroke: var(--ui-md-prev);stroke-width: 1.5;stroke-dasharray: 4 4;vector-effect: non-scaling-stroke;animation: ui-md-fade var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-md__dots{position: absolute;inset: 0;pointer-events: none}
.ui-md__dots span{position: absolute;width: 7px;height: 7px;margin: -3.5px 0 0 -3.5px;border: 1.5px solid var(--ui-md-accent);border-radius: 50%;background: var(--ui-md-card);animation: ui-md-pop var(--nm-dur-4, 380ms) var(--ui-md-spring) both}
.ui-md__bars{position: absolute;inset: 0;display: flex;align-items: flex-end;pointer-events: none}
.ui-md__bar-slot{flex: 1;display: flex;align-items: flex-end;justify-content: center;gap: 2px;min-width: 0;height: 100%}
.ui-md__col{width: 56%;max-width: 22px;border-radius: 5px 5px 2px 2px;background: linear-gradient(180deg, var(--ui-md-accent), color-mix(in srgb, var(--ui-md-accent) 55%, var(--ui-md-card)));transform-origin: bottom;animation: ui-md-grow 620ms var(--ui-md-ease) both;animation-delay: var(--d);transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-md__bars[data-compare] .ui-md__col{width: 34%;max-width: 12px}
.ui-md__col--prev{background: var(--ui-md-prev);opacity: 0.55}
.ui-md__bars:has([data-active]) .ui-md__bar-slot:not([data-active]) .ui-md__col{opacity: 0.45}
.ui-md__guide{stroke: var(--ui-md-muted);stroke-width: 1;stroke-dasharray: 2 3;opacity: 0.6;vector-effect: non-scaling-stroke}
.ui-md__dot{position: absolute;width: 10px;height: 10px;margin: -5px 0 0 -5px;border: 2px solid var(--ui-md-card);border-radius: 50%;background: var(--ui-md-accent);box-shadow: 0 1px 3px rgba(11, 9, 8, 0.2);pointer-events: none}
.ui-md__dot--prev{background: var(--ui-md-prev)}
.ui-md__tip{position: absolute;top: 6px;z-index: 2;display: grid;gap: 4px;min-width: 150px;padding: 9px 11px;border-radius: 10px;background: var(--ui-md-tip);box-shadow: 0 8px 24px rgba(11, 9, 8, 0.16);font-size: 12px;color: var(--ui-md-tip-text);pointer-events: none}
.ui-md__tip[data-side="right"]{transform: translateX(14px)}
.ui-md__tip[data-side="left"]{transform: translateX(calc(-100% - 14px))}
.ui-md__tip-date{font-size: 11.5px;opacity: 0.6}
.ui-md__tip-row{display: flex;align-items: center;gap: 7px}
.ui-md__tip-row i{width: 8px;height: 8px;border-radius: 50%;background: var(--ui-md-accent)}
.ui-md__tip-row--prev i{background: var(--ui-md-prev)}
.ui-md__tip-row b{margin-left: auto;padding-left: 12px;font-weight: 600;font-variant-numeric: tabular-nums}
.ui-md__dates{position: relative;grid-column: 2;height: 26px;font-size: 11px;color: var(--ui-md-muted)}
.ui-md__dates span{position: absolute;top: 9px;transform: translateX(-50%);white-space: nowrap}
.ui-md__dates span[data-start]{transform: none}
.ui-md__dates span[data-end]{transform: translateX(-100%)}
.ui-md__lists{display: grid;grid-template-columns: 1fr 1fr}
.ui-md__list{min-width: 0;padding: 14px 12px 12px}
.ui-md__list + .ui-md__list{border-left: 1px solid var(--ui-md-line)}
.ui-md__list-head{display: flex;justify-content: space-between;padding: 0 8px 8px;font-size: 12.5px;font-weight: 500}
.ui-md__list-head span + span{font-weight: 400;color: var(--ui-md-muted)}
.ui-md__list ul{display: grid;gap: 2px;margin: 0;padding: 0;list-style: none}
.ui-md__row{position: relative;display: flex;align-items: center;justify-content: space-between;gap: 12px;height: 32px;padding: 0 8px;font-size: 13px}
.ui-md__row-bar{position: absolute;inset: 0 auto 0 0;border-radius: 8px;background: var(--ui-md-bar);transition: width var(--nm-dur-5, 620ms) var(--ui-md-ease)}
.ui-md__row-name{position: relative;min-width: 0;overflow: hidden;white-space: nowrap;text-overflow: ellipsis;color: var(--ui-md-text)}
.ui-md__row-value{position: relative;font-variant-numeric: tabular-nums;color: var(--ui-md-ink)}
@keyframes ui-md-reveal{from{clip-path: inset(-10% 100% -10% 0)}
to{clip-path: inset(-10% -1% -10% 0)}
}
@keyframes ui-md-fade{from{opacity: 0}
}
@keyframes ui-md-pop{from{transform: scale(0)}
}
@keyframes ui-md-grow{from{transform: scaleY(0)}
}
@container (max-width: 640px){.ui-md__kpis{grid-template-columns: 1fr 1fr}
.ui-md__lists{grid-template-columns: 1fr}
.ui-md__list + .ui-md__list{border-left: 0;border-top: 1px solid var(--ui-md-line)}
.ui-md__compare{font-size: 0;gap: 0}
.ui-md__compare::after{content: "Compare";font-size: 12.5px;margin-left: 8px}
}
@container (max-width: 460px){.ui-md__bar{flex-wrap: wrap;padding: 12px 4px 12px 10px}
.ui-md__actions{width: 100%}
.ui-md__range{flex: 1;grid-template-columns: repeat(3, 1fr)}
.ui-md__range-thumb{width: calc((100% - 6px) / 3)}
.ui-md__kpi{padding: 12px 14px}
.ui-md__kpi-value{font-size: 20px}
.ui-md__chart{padding: 14px 12px 10px}
.ui-md__plot-wrap{grid-template-rows: 168px auto}
.ui-md__dates span:nth-child(even){display: none}
}
@media (prefers-reduced-motion: reduce){.ui-md__range-thumb, .ui-md__kind-thumb, .ui-md__kpi, .ui-md__row-bar, .ui-md__switch::after{transition: none}
.ui-md__series, .ui-md__prev, .ui-md__dots span, .ui-md__col{animation: none}
}
.ui-md input:not([type="checkbox"]):not([type="radio"]):focus-visible, .ui-md textarea:focus-visible, .ui-md [contenteditable]:focus-visible{outline: none}
:where(.dark, [data-theme="dark"]) .ui-md{--ui-md-tray: #1c1713;--ui-md-card: #27201a;--ui-md-card-line: rgba(255, 253, 251, 0.08);--ui-md-line: rgba(255, 253, 251, 0.07);--ui-md-ink: #ebe3da;--ui-md-text: #b4a89d;--ui-md-muted: #857567;--ui-md-accent: #ff8a5c;--ui-md-area: rgba(255, 138, 92, 0.2);--ui-md-prev: #544537;--ui-md-good: #2f8d5c;--ui-md-good-bg: rgba(47, 141, 92, 0.14);--ui-md-bad: #e2544a;--ui-md-bad-bg: rgba(226, 84, 74, 0.14);--ui-md-bar: rgba(255, 138, 92, 0.12);--ui-md-chip: #2b231b;--ui-md-thumb: #33291f;--ui-md-hover: rgba(255, 253, 251, 0.04);--ui-md-tip: #ebe3da;--ui-md-tip-text: #191411;--ui-md-shadow: 0 1px 2px rgba(11, 9, 8, 0.4)}
:where(.dark, [data-theme="dark"]) .ui-md__range, :where(.dark, [data-theme="dark"]) .ui-md__kind{background: rgba(255, 253, 251, 0.06)}
:where(.dark, [data-theme="dark"]) .ui-md__switch{background: #3a2f24}

`;
