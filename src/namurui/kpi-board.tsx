"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

/*
 * KPI Board – the top of a dashboard, one self-contained file.
 *
 * Three trend cards with sparklines, an overview that compares this period with the one before, and a
 * single plan in focus. The bar carries the range picker; the overview carries its own segment picker.
 *
 * Every number is an odometer: when the range or the segment changes, each digit column rolls to its
 * new value while the currency sign, separators and unit stay where they are. The lines are drawn in
 * again from the left, and the cards rise one after the other on the first paint.
 *
 * Pointing at a plot marks the day under the pointer with a dashed rule, a dot and a small tag, and
 * moves the axis label with it; over the overview it answers with both periods in a dark tooltip.
 * The styles are injected below, so no other file is needed.
 */

/** How a number is written */
export type KpiFormat = "money" | "number" | "percent";

/** The move against the period before */
export type KpiChange = {
  /** Size of the move, always given as a positive number */
  amount: number;
  /** How it is written – percent is 44.9%, money and number follow the card */
  format?: KpiFormat;
  /** "down" flips the arrow and writes a minus on a signed percentage */
  direction?: "up" | "down";
  /** True (the default) paints it green, false paints it red */
  good?: boolean;
  /** Writes +44.9% rather than 44.9% */
  signed?: boolean;
  /** Wins over amount, for copy that is already formatted */
  text?: string;
};

/** One trend card */
export type KpiStat = {
  /** Stable key – keeps the card's roll going when the data swaps */
  id: string;
  /** Name under the number */
  label: string;
  /** The big number */
  value: number;
  /** Move against the period before */
  change: KpiChange;
  /** Points for the sparkline, oldest first */
  series: number[];
  /** How the number is written – defaults to number */
  format?: KpiFormat;
};

/** The two lines of the overview */
export type BoardSeries = {
  /** This period, oldest first */
  current: number[];
  /** The period before, index-aligned with current */
  previous: number[];
};

/** The wide card that compares periods */
export type KpiOverview = {
  /** Small name above the figure, e.g. "Sales overview" */
  label?: string;
  /** The big figure */
  value: number;
  /** Move against the period before – a percentage when no format is given */
  change: KpiChange;
  /** Both lines */
  series: BoardSeries;
  /** How the figure and the tooltip are written */
  format?: KpiFormat;
  /** Filter inside the card – the first option is chosen when none is given */
  segments?: { id: string; label: string }[];
  /** Controlled segment id */
  segment?: string;
  /** Starting segment when uncontrolled */
  defaultSegment?: string;
  /** Called with the new segment */
  onSegmentChange?: (id: string) => void;
  /** Accessible name of the segment button – defaults to "Segment" */
  segmentLabel?: string;
};

/** The narrow card on the right */
export type KpiFocus = {
  /** Product name beside the mark, e.g. "Pro license" */
  title: string;
  /** Line under the name, e.g. "One-time" */
  caption?: string;
  /** Replaces the default box mark */
  icon?: ReactNode;
  /** Small name above the figure, e.g. "Licenses sold" */
  label?: string;
  /** The figure */
  value: number;
  /** Sits after the figure, e.g. "licenses" */
  unit?: string;
  /** How the figure is written – defaults to number */
  format?: KpiFormat;
  /** Move against the period before */
  change: KpiChange;
  /** Points under the figure, oldest first */
  series: number[];
  /** Total of the period before, for the legend */
  previousValue: number;
  /** The small button in the header, e.g. Set up */
  setup?: { label: string; onClick?: () => void };
  /** The button at the bottom of the card */
  action?: { label: string; onClick?: () => void };
};

/** The range picker in the bar */
export type KpiRange = {
  /** Options, in menu order */
  options: { id: string; label: string }[];
  /** Controlled id */
  value?: string;
  /** Starting id when uncontrolled – the first option when omitted */
  defaultValue?: string;
  /** Called with the new id */
  onChange?: (id: string) => void;
  /** Accessible name of the button – defaults to "Date range" */
  label?: string;
};

export type KpiBoardProps = {
  /** The trend cards, normally three */
  stats: KpiStat[];
  /** The wide comparison card */
  overview: KpiOverview;
  /** The narrow card on the right */
  focus: KpiFocus;
  /** The range picker in the bar */
  range: KpiRange;
  /** Axis and tooltip labels, oldest first – the last one is usually "Today" */
  labels?: string[];
  /** Heading on the left of the bar */
  title?: string;
  /** Words after every change */
  compareLabel?: string;
  /** Names of the two lines in the tooltip and the focus legend */
  periods?: { current: string; previous: string };
  /** Extra class on the root */
  className?: string;
};

const MONEY = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const COUNT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const PERCENT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

const DEFAULT_LABELS = ["13 Sep", "Today"];
const DEFAULT_PERIODS = { current: "This period", previous: "Last period" };

/** Space kept free above and below every line, in the 0–100 viewBox */
const PAD = 12;

function formatValue(value: number, format: KpiFormat = "number", unit?: string) {
  const body =
    format === "money"
      ? MONEY.format(value)
      : format === "percent"
        ? `${PERCENT.format(value)}%`
        : COUNT.format(value);
  return unit ? `${body} ${unit}` : body;
}

/** A change follows the card unless it names its own format; percentages are the fallback */
function formatChange(change: KpiChange, fallback: KpiFormat) {
  if (change.text) return change.text;
  const format = change.format ?? fallback;
  const sign = change.signed ? (change.direction === "down" ? "−" : "+") : "";
  if (format === "money") return `${sign}${MONEY.format(change.amount)}`;
  if (format === "percent") return `${sign}${PERCENT.format(change.amount)}%`;
  return `${sign}${COUNT.format(change.amount)}`;
}

/* ---------- Geometry ---------- */

type Point = { x: number; y: number };

/** Both lines share one domain, with a little air above the peak and below the trough */
function extentOf(lists: number[][]): [number, number] {
  const all = lists.flat();
  if (all.length === 0) return [0, 1];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const air = (max - min || Math.abs(max) || 1) * 0.06;
  return [min - air, max + air];
}

function scale(values: number[], domain: [number, number]): Point[] {
  if (values.length === 0) return [];
  const span = domain[1] - domain[0] || 1;
  const last = Math.max(1, values.length - 1);
  return values.map((value, i) => ({
    x: (i / last) * 100,
    y: PAD + (1 - (value - domain[0]) / span) * (100 - PAD * 2),
  }));
}

function linePath(points: Point[]) {
  return points.map((point, i) => `${i ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join("");
}

function areaPath(points: Point[]) {
  if (points.length === 0) return "";
  return `${linePath(points)}L100,100L0,100Z`;
}

/** Where the pointer sits in the series, as an index */
function indexAt(event: ReactPointerEvent<HTMLDivElement>, count: number) {
  const rect = event.currentTarget.getBoundingClientRect();
  if (!rect.width || count === 0) return null;
  const ratio = (event.clientX - rect.left) / rect.width;
  return Math.max(0, Math.min(count - 1, Math.round(ratio * (count - 1))));
}

/* ---------- The odometer ---------- */

const mod10 = (value: number) => ((value % 10) + 10) % 10;

/** One character of the target text: letters and signs stay, digits sit on a 0–9 wheel */
type Wheel = { char: string; from: number; steps: number };

function wheelsOf(previous: string, target: string): Wheel[] {
  const before = Array.from(previous);
  const after = Array.from(target);
  const offset = after.length - before.length;
  const up = Number(target.replace(/[^0-9]/g, "")) >= Number(previous.replace(/[^0-9]/g, ""));
  return after.map((char, i) => {
    if (char < "0" || char > "9") return { char, from: 0, steps: 0 };
    const earlier = before[i - offset];
    const from = earlier && earlier >= "0" && earlier <= "9" ? earlier.charCodeAt(0) - 48 : 0;
    const to = char.charCodeAt(0) - 48;
    return { char, from, steps: up ? mod10(to - from) : -mod10(from - to) };
  });
}

/** The old text rolls to the new one column by column; the first paint is already settled */
function useRollingText(target: string, duration = 620): string {
  const [text, setText] = useState(target);
  const shown = useRef(target);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (target === shown.current) return;
    if (
      typeof window.matchMedia !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      shown.current = target;
      setText(target);
      return;
    }
    const wheels = wheelsOf(shown.current, target);
    const start = window.performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 4);
      const next = wheels
        .map((wheel) => (wheel.steps ? String(mod10(wheel.from + Math.round(wheel.steps * eased))) : wheel.char))
        .join("");
      shown.current = next;
      setText(next);
      if (p < 1) {
        frame.current = window.requestAnimationFrame(step);
      } else {
        shown.current = target;
        setText(target);
      }
    };
    frame.current = window.requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    };
  }, [target, duration]);

  return text;
}

/** A readout that rolls – one text node, so the layout of the card never shifts */
function Roll({ text }: { text: string }) {
  return <>{useRollingText(text)}</>;
}

/* ---------- Icons ---------- */

function Chevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="m2.5 3.8 2.5 2.5 2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrendArrow({ down }: { down: boolean }) {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true" style={down ? { transform: "scaleY(-1)" } : undefined}>
      <path d="M4 1.2 7.2 6.4H.8L4 1.2Z" fill="currentColor" />
    </svg>
  );
}

function BoxMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 1.9 13.3 4.8v6.4L8 14.1 2.7 11.2V4.8L8 1.9Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M2.9 4.9 8 7.7l5.1-2.8M8 7.7V14" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function Sliders() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 4.2h5.2M10.2 4.2H12M2 9.8h1.8M6.8 9.8H12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8.7" cy="4.2" r="1.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="5.3" cy="9.8" r="1.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2 5.2 4.1 7.3 8 3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- Picker ---------- */

type PickerProps = {
  options: { id: string; label: string }[];
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  label: string;
};

function Picker({ options, value, defaultValue, onChange, label }: PickerProps) {
  const [own, setOwn] = useState(defaultValue ?? options[0]?.id ?? "");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const listId = `${useId()}-list`;
  const wrap = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const list = useRef<HTMLUListElement | null>(null);

  const picked = value ?? own;
  const current = options.find((option) => option.id === picked) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: Event) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.focus();
  }, [open]);

  const drop = () => {
    setCursor(Math.max(0, options.findIndex((option) => option.id === picked)));
    setOpen(true);
  };

  /* Closing hands the focus back to the button, so the menu never strands the caret */
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  const commit = (id: string) => {
    setOwn(id);
    onChange?.(id);
    close();
  };

  const onKey = (event: KeyboardEvent<HTMLUListElement>) => {
    const last = options.length - 1;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((at) => Math.min(last, at + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((at) => Math.max(0, at - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setCursor(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setCursor(last);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const option = options[cursor];
      if (option) commit(option.id);
    } else if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      close();
    }
  };

  return (
    <div className="ui-kb__pick" data-open={open ? "true" : undefined} ref={wrap}>
      <button
        type="button"
        className="ui-kb__pick-button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        ref={trigger}
        onClick={() => (open ? setOpen(false) : drop())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            drop();
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      >
        <span>{current?.label ?? ""}</span>
        <Chevron />
      </button>
      {open ? (
        <ul
          className="ui-kb__menu"
          id={listId}
          role="listbox"
          aria-label={label}
          tabIndex={-1}
          ref={list}
          onKeyDown={onKey}
        >
          {options.map((option, index) => (
            <li
              key={option.id}
              className="ui-kb__option"
              role="option"
              aria-selected={option.id === picked}
              data-active={index === cursor ? "true" : undefined}
              onPointerMove={() => setCursor(index)}
              onClick={() => commit(option.id)}
            >
              <span>{option.label}</span>
              {option.id === picked ? <Check /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ---------- Plots ---------- */

/** Hover bookkeeping shared by the three small plots */
function usePlot(series: number[]) {
  const [raw, setRaw] = useState<number | null>(null);
  const domain = extentOf([series]);
  const points = scale(series, domain);
  /* The pointer can outlive a shorter series after a range change, so the index is clamped */
  const hover = raw !== null && raw < series.length ? raw : null;
  return {
    points,
    hover,
    move: (event: ReactPointerEvent<HTMLDivElement>) => setRaw(indexAt(event, series.length)),
    leave: () => setRaw(null),
  };
}

/** The axis under a small plot – it also carries the label of the day under the pointer */
function PlotAxis({
  labels,
  at,
}: {
  labels: string[];
  at: { x: number; label: string | undefined } | null;
}) {
  return (
    <div className="ui-kb__axis" aria-hidden="true">
      <span>{labels[0]}</span>
      <span>{labels[labels.length - 1]}</span>
      {at ? (
        <span className="ui-kb__axis-tag" style={{ left: `${at.x}%` }}>
          {at.label}
        </span>
      ) : null}
    </div>
  );
}

/* ---------- Cards ---------- */

type StatCardProps = {
  stat: KpiStat;
  index: number;
  labels: string[];
  compareLabel: string;
};

function StatCard({ stat, index, labels, compareLabel }: StatCardProps) {
  const chart = usePlot(stat.series);
  const good = stat.change.good ?? true;
  const at =
    chart.hover === null
      ? null
      : {
          x: chart.points[chart.hover]?.x ?? 0,
          y: chart.points[chart.hover]?.y ?? 0,
          label: labels[chart.hover],
          value: stat.series[chart.hover],
        };

  return (
    <section className="ui-kb__card ui-kb__stat" aria-label={stat.label} style={{ "--n": index } as CSSProperties}>
      <header className="ui-kb__row">
        <span className="ui-kb__pair">
          <b>
            <Roll text={formatValue(stat.value, stat.format)} />
          </b>
          <span>{stat.label}</span>
        </span>
        <span className="ui-kb__pair ui-kb__pair--end">
          <span className="ui-kb__change" data-good={good ? "" : undefined}>
            <TrendArrow down={stat.change.direction === "down"} />
            <Roll text={formatChange(stat.change, stat.format ?? "number")} />
          </span>
          <span>{compareLabel}</span>
        </span>
      </header>
      <div className="ui-kb__plot ui-kb__plot--small" onPointerMove={chart.move} onPointerLeave={chart.leave}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path className="ui-kb__fill" d={areaPath(chart.points)} />
          <path className="ui-kb__line" d={linePath(chart.points)} />
        </svg>
        {at ? (
          <>
            <span className="ui-kb__rule" style={{ left: `${at.x}%`, height: "100%" }} />
            <span className="ui-kb__dot" style={{ left: `${at.x}%`, top: `${at.y}%` }} />
            <span
              className="ui-kb__tag"
              data-side={at.x > 55 ? "left" : undefined}
              style={{ left: `${at.x}%`, top: `${at.y}%` }}
            >
              <span>{at.label}</span>
              <b>{formatValue(at.value, stat.format)}</b>
            </span>
          </>
        ) : null}
      </div>
      <PlotAxis labels={labels} at={at} />
    </section>
  );
}

type OverviewCardProps = {
  overview: KpiOverview;
  index: number;
  labels: string[];
  compareLabel: string;
  periods: { current: string; previous: string };
};

function OverviewCard({ overview, index, labels, compareLabel, periods }: OverviewCardProps) {
  const [raw, setRaw] = useState<number | null>(null);
  const fade = `${useId()}-fade`;
  const { current, previous } = overview.series;
  const hover = raw !== null && raw < current.length ? raw : null;
  const domain = extentOf([current, previous]);
  const upper = scale(current, domain);
  const lower = scale(previous, domain);
  const good = overview.change.good ?? true;

  const at =
    hover === null
      ? null
      : {
          x: upper[hover]?.x ?? 0,
          top: Math.min(upper[hover]?.y ?? 0, lower[hover]?.y ?? 0),
          current: current[hover],
          previous: previous[hover],
          label: labels[hover],
          dot: upper[hover],
          soft: lower[hover],
        };

  const swing =
    at && at.previous
      ? formatChange(
          {
            amount: Math.abs(((at.current - at.previous) / at.previous) * 100),
            direction: at.current >= at.previous ? "up" : "down",
            signed: true,
          },
          "percent",
        )
      : "";

  return (
    <section
      className="ui-kb__card ui-kb__overview"
      aria-label={overview.label ?? "Sales overview"}
      style={{ "--n": index } as CSSProperties}
    >
      <header className="ui-kb__row ui-kb__row--top">
        <div>
          <div className="ui-kb__label">{overview.label ?? "Sales overview"}</div>
          <div className="ui-kb__figure">
            <b>
              <Roll text={formatValue(overview.value, overview.format)} />
            </b>
            <span className="ui-kb__vs">
              <i data-good={good ? "" : undefined}>
                <Roll text={formatChange(overview.change, "percent")} />
              </i>{" "}
              {compareLabel}
            </span>
          </div>
        </div>
        {overview.segments && overview.segments.length > 0 ? (
          <Picker
            options={overview.segments}
            value={overview.segment}
            defaultValue={overview.defaultSegment}
            onChange={overview.onSegmentChange}
            label={overview.segmentLabel ?? "Segment"}
          />
        ) : null}
      </header>
      <div
        className="ui-kb__plot ui-kb__plot--large"
        onPointerMove={(event) => setRaw(indexAt(event, current.length))}
        onPointerLeave={() => setRaw(null)}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={fade} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--ui-kb-accent)" stopOpacity="0.14" />
              <stop offset="1" stopColor="var(--ui-kb-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {Array.from({ length: 19 }, (_, i) => ((i / 18) * 100).toFixed(2)).map((x) => (
            <path key={x} className="ui-kb__grid" d={`M${x},0V100`} />
          ))}
          <path d={areaPath(upper)} fill={`url(#${fade})`} />
          <path className="ui-kb__line ui-kb__line--soft" d={linePath(lower)} />
          <path className="ui-kb__line" d={linePath(upper)} />
        </svg>
        {at ? (
          <>
            <span className="ui-kb__rule" style={{ left: `${at.x}%`, height: "100%" }} />
            {at.soft ? (
              <span className="ui-kb__dot ui-kb__dot--soft" style={{ left: `${at.soft.x}%`, top: `${at.soft.y}%` }} />
            ) : null}
            {at.dot ? (
              <span className="ui-kb__dot" style={{ left: `${at.dot.x}%`, top: `${at.dot.y}%` }} />
            ) : null}
            <div
              className="ui-kb__tip"
              data-side={at.x > 55 ? "left" : undefined}
              style={{ left: `${at.x}%`, top: `${at.top}%` }}
            >
              <div className="ui-kb__tip-head">
                <span>{at.label}</span>
                <b>{swing}</b>
              </div>
              <span className="ui-kb__tip-row">
                <i />
                <span>{periods.current}</span>
                <b>{formatValue(at.current, overview.format)}</b>
              </span>
              <span className="ui-kb__tip-row" data-soft="">
                <i />
                <span>{periods.previous}</span>
                <b>{formatValue(at.previous, overview.format)}</b>
              </span>
            </div>
          </>
        ) : null}
      </div>
      <PlotAxis labels={labels} at={at ? { x: at.x, label: at.label } : null} />
    </section>
  );
}

type FocusCardProps = {
  focus: KpiFocus;
  index: number;
  labels: string[];
  compareLabel: string;
  periods: { current: string; previous: string };
};

function FocusCard({ focus, index, labels, compareLabel, periods }: FocusCardProps) {
  const chart = usePlot(focus.series);
  const good = focus.change.good ?? true;
  const at =
    chart.hover === null
      ? null
      : {
          x: chart.points[chart.hover]?.x ?? 0,
          y: chart.points[chart.hover]?.y ?? 0,
          label: labels[chart.hover],
          value: focus.series[chart.hover],
        };

  return (
    <section className="ui-kb__card ui-kb__focus" aria-label={focus.title} style={{ "--n": index } as CSSProperties}>
      <header className="ui-kb__row ui-kb__row--top">
        <div className="ui-kb__product">
          <span className="ui-kb__icon">{focus.icon ?? <BoxMark />}</span>
          <span className="ui-kb__pair">
            <b>{focus.title}</b>
            {focus.caption ? <span>{focus.caption}</span> : null}
          </span>
        </div>
        {focus.setup ? (
          <button type="button" className="ui-kb__setup" onClick={focus.setup.onClick}>
            <Sliders />
            {focus.setup.label}
          </button>
        ) : null}
      </header>
      <div className="ui-kb__label">{focus.label ?? "Licenses sold"}</div>
      <div className="ui-kb__figure ui-kb__figure--small">
        <b>
          <Roll text={formatValue(focus.value, focus.format, focus.unit)} />
        </b>
        <span className="ui-kb__vs">
          <span className="ui-kb__change" data-good={good ? "" : undefined}>
            <TrendArrow down={focus.change.direction === "down"} />
            <Roll text={formatChange(focus.change, "percent")} />
          </span>{" "}
          {compareLabel}
        </span>
      </div>
      <div className="ui-kb__plot ui-kb__plot--small" onPointerMove={chart.move} onPointerLeave={chart.leave}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path className="ui-kb__fill" d={areaPath(chart.points)} />
          <path className="ui-kb__line" d={linePath(chart.points)} />
        </svg>
        {at ? (
          <>
            <span className="ui-kb__rule" style={{ left: `${at.x}%`, height: "100%" }} />
            <span className="ui-kb__dot" style={{ left: `${at.x}%`, top: `${at.y}%` }} />
            <span
              className="ui-kb__tag"
              data-side={at.x > 55 ? "left" : undefined}
              style={{ left: `${at.x}%`, top: `${at.y}%` }}
            >
              <span>{at.label}</span>
              <b>{formatValue(at.value, focus.format)}</b>
            </span>
          </>
        ) : null}
      </div>
      <div className="ui-kb__legend">
        <span>{periods.previous}</span>
        <b data-soft="">
          <Roll text={formatValue(focus.previousValue, focus.format)} />
        </b>
        <span>{periods.current}</span>
        <b>
          <Roll text={formatValue(focus.value, focus.format)} />
        </b>
      </div>
      {focus.action ? (
        <button type="button" className="ui-kb__action" onClick={focus.action.onClick}>
          {focus.action.label}
        </button>
      ) : null}
    </section>
  );
}

/* ---------- The board ---------- */

export function KpiBoard({
  stats,
  overview,
  focus,
  range,
  labels = DEFAULT_LABELS,
  title = "Dashboard",
  compareLabel = "vs. last period",
  periods = DEFAULT_PERIODS,
  className,
}: KpiBoardProps) {
  return (
    <div className={["ui-kb", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-kpi-board" precedence="default">
        {css}
      </style>
      <div className="ui-kb__bar">
        <h2 className="ui-kb__heading">{title}</h2>
        <Picker
          options={range.options}
          value={range.value}
          defaultValue={range.defaultValue}
          onChange={range.onChange}
          label={range.label ?? "Date range"}
        />
      </div>
      {stats.map((stat, index) => (
        <StatCard key={stat.id} stat={stat} index={index} labels={labels} compareLabel={compareLabel} />
      ))}
      <OverviewCard
        overview={overview}
        index={stats.length}
        labels={labels}
        compareLabel={compareLabel}
        periods={periods}
      />
      <FocusCard
        focus={focus}
        index={stats.length + 1}
        labels={labels}
        compareLabel={compareLabel}
        periods={periods}
      />
    </div>
  );
}

const css = /* css */ `
.ui-kb{--ui-kb-card: #fffdfb;--ui-kb-line: #e4dbd2;--ui-kb-ink: #29221b;--ui-kb-text: #4f4133;--ui-kb-muted: #908071;--ui-kb-well: #f7f1eb;--ui-kb-rule: #9a8c7f;--ui-kb-accent: #ff6b35;--ui-kb-soft: #ffb28f;--ui-kb-good: #2f8d5c;--ui-kb-bad: #b3261e;--ui-kb-tip: #221c16;--ui-kb-focus: rgba(28, 23, 19, 0.22);--ui-kb-ease: cubic-bezier(0.32, 0.72, 0.24, 1);box-sizing: border-box;display: grid;grid-template-columns: repeat(6, minmax(0, 1fr));gap: 8px;width: 100%;min-width: 0;container-type: inline-size;font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13.5px;line-height: 20px;color: var(--ui-kb-text);text-align: left;-webkit-font-smoothing: antialiased}
.ui-kb *, .ui-kb *::before, .ui-kb *::after{box-sizing: border-box}
:where(.ui-kb) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-kb button:focus-visible{outline: 2px solid var(--ui-kb-focus);outline-offset: 2px}
.ui-kb svg{display: block}
.ui-kb b{font-weight: 600;color: var(--ui-kb-ink)}
.ui-kb i{font-style: normal}
.ui-kb__bar{grid-column: 1 / -1;display: flex;align-items: center;justify-content: flex-end;gap: 12px;min-height: 30px}
.ui-kb__heading{flex: 1;min-width: 0;margin: 0;overflow: hidden;font-size: 17px;font-weight: 600;line-height: 24px;letter-spacing: -0.01em;color: var(--ui-kb-ink);white-space: nowrap;text-overflow: ellipsis}
.ui-kb__card{grid-column: span 2;display: flex;flex-direction: column;min-width: 0;padding: 16px 16px 14px;border: 1px solid var(--ui-kb-line);border-radius: 12px;background: var(--ui-kb-card);box-shadow: 0 1px 2px rgba(26, 21, 18, 0.04);animation: ui-kb-rise 620ms var(--ui-kb-ease) both;animation-delay: calc(var(--n) * 60ms)}
.ui-kb__overview{grid-column: span 4}
.ui-kb__focus{padding-bottom: 16px}
.ui-kb__row{display: flex;align-items: flex-start;justify-content: space-between;gap: 12px;min-width: 0}
.ui-kb__pair{display: grid;min-width: 0;font-variant-numeric: tabular-nums}
.ui-kb__pair > *{overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-kb__pair b{font-size: 14px}
.ui-kb__pair span{color: var(--ui-kb-muted)}
.ui-kb__pair--end{justify-items: end;flex: none;text-align: right}
.ui-kb__change{display: inline-flex;align-items: center;gap: 5px;font-size: 14px;font-weight: 600;color: var(--ui-kb-bad);font-variant-numeric: tabular-nums}
.ui-kb__change[data-good]{color: var(--ui-kb-good)}
.ui-kb__plot{position: relative;margin-top: 14px;border-bottom: 1px solid var(--ui-kb-line);cursor: crosshair;touch-action: pan-y}
.ui-kb__plot--small{height: 64px}
.ui-kb__plot--large{flex: 1;min-height: 190px;margin-top: 16px;border-bottom: 0}
.ui-kb__plot svg{position: absolute;inset: 0;width: 100%;height: 100%;overflow: visible;animation: ui-kb-draw 1100ms var(--ui-kb-ease) both;animation-delay: calc(120ms + var(--n) * 60ms)}
.ui-kb__line{fill: none;stroke: var(--ui-kb-accent);stroke-width: 1.5;stroke-linejoin: miter;stroke-linecap: round;vector-effect: non-scaling-stroke}
.ui-kb__line--soft{stroke: var(--ui-kb-soft)}
.ui-kb__fill{fill: var(--ui-kb-well)}
.ui-kb__grid{fill: none;stroke: var(--ui-kb-line);stroke-width: 1;stroke-dasharray: 4 4;vector-effect: non-scaling-stroke}
.ui-kb__axis{position: relative;display: flex;justify-content: space-between;height: 16px;margin-top: 8px;font-size: 12px;line-height: 16px;color: var(--ui-kb-muted);white-space: nowrap}
.ui-kb__rule{position: absolute;bottom: 0;width: 0;margin-left: -0.5px;border-left: 1px dashed var(--ui-kb-rule);pointer-events: none}
.ui-kb__dot{position: absolute;z-index: 1;width: 8px;height: 8px;margin: -4px 0 0 -4px;border: 1.5px solid var(--ui-kb-accent);border-radius: 50%;background: var(--ui-kb-card);pointer-events: none}
.ui-kb__dot--soft{border-color: var(--ui-kb-soft)}
.ui-kb__tag{position: absolute;z-index: 2;display: inline-flex;gap: 12px;height: 24px;padding: 0 8px;border: 1px solid var(--ui-kb-line);border-radius: 6px;background: var(--ui-kb-card);box-shadow: 0 2px 6px rgba(26, 21, 18, 0.06);font-size: 12px;line-height: 22px;color: var(--ui-kb-text);white-space: nowrap;pointer-events: none;transform: translate(10px, -130%);font-variant-numeric: tabular-nums;animation: ui-kb-in 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-kb__tag[data-side="left"]{transform: translate(calc(-100% - 10px), -130%)}
.ui-kb__tag b{font-weight: 500;color: var(--ui-kb-accent)}
.ui-kb__axis-tag{position: absolute;top: -4px;height: 22px;padding: 0 7px;border: 1px solid var(--ui-kb-line);border-radius: 6px;background: var(--ui-kb-card);line-height: 20px;color: var(--ui-kb-ink);transform: translateX(-50%)}
.ui-kb__row--top{padding-bottom: 14px;border-bottom: 1px solid var(--ui-kb-line)}
.ui-kb__label{font-size: 13px;color: var(--ui-kb-text)}
.ui-kb__figure{display: flex;flex-wrap: wrap;align-items: baseline;gap: 2px 10px;margin-top: 4px;font-variant-numeric: tabular-nums}
.ui-kb__figure b{font-size: 24px;line-height: 30px;letter-spacing: -0.02em}
.ui-kb__figure--small b{font-size: 19px;line-height: 26px}
.ui-kb__vs{display: inline-flex;align-items: baseline;gap: 5px;font-size: 13px;color: var(--ui-kb-muted);white-space: nowrap}
.ui-kb__vs i{font-weight: 600;color: var(--ui-kb-bad)}
.ui-kb__vs i[data-good]{color: var(--ui-kb-good)}
.ui-kb__vs .ui-kb__change{font-size: 13px}
.ui-kb__pick{position: relative;flex: none}
.ui-kb__pick-button{display: inline-flex;align-items: center;gap: 8px;height: 30px;padding: 0 9px 0 11px;border: 1px solid var(--ui-kb-line);border-radius: 8px;background: var(--ui-kb-card);box-shadow: 0 1px 1px rgba(26, 21, 18, 0.04);font-size: 12.5px;color: var(--ui-kb-ink);white-space: nowrap;transition: border-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-kb__pick-button:hover, .ui-kb__pick[data-open] .ui-kb__pick-button{border-color: #c4b8ae}
.ui-kb__pick[data-open] .ui-kb__pick-button{background: var(--ui-kb-well)}
.ui-kb__pick-button svg{color: var(--ui-kb-muted);transition: transform 240ms var(--ui-kb-ease)}
.ui-kb__pick[data-open] .ui-kb__pick-button svg{transform: rotate(180deg)}
.ui-kb__menu{position: absolute;top: calc(100% + 6px);right: 0;z-index: 10;min-width: max(100%, 148px);margin: 0;padding: 4px;border: 1px solid var(--ui-kb-line);border-radius: 10px;background: var(--ui-kb-card);box-shadow: 0 10px 28px rgba(26, 21, 18, 0.1), 0 2px 6px rgba(26, 21, 18, 0.05);list-style: none;transform-origin: 100% 0;animation: ui-kb-menu var(--nm-dur-2, 160ms) var(--ui-kb-ease) both}
.ui-kb__option{display: flex;align-items: center;justify-content: space-between;gap: 14px;height: 30px;padding: 0 8px 0 9px;border-radius: 7px;font-size: 12.5px;color: var(--ui-kb-text);white-space: nowrap;cursor: pointer}
.ui-kb__option[data-active]{background: var(--ui-kb-well);color: var(--ui-kb-ink)}
.ui-kb__option[aria-selected="true"]{font-weight: 500;color: var(--ui-kb-ink)}
.ui-kb__option svg{color: var(--ui-kb-accent)}
.ui-kb__tip{position: absolute;z-index: 3;min-width: 168px;padding: 9px 11px 10px;border-radius: 8px;background: var(--ui-kb-tip);box-shadow: 0 8px 24px rgba(26, 21, 18, 0.18);font-size: 12.5px;line-height: 20px;color: rgba(255, 253, 251, 0.72);pointer-events: none;transform: translate(14px, calc(-100% - 12px));font-variant-numeric: tabular-nums;animation: ui-kb-in 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-kb__tip[data-side="left"]{transform: translate(calc(-100% - 14px), calc(-100% - 12px))}
.ui-kb__tip b{font-weight: 500;color: #fffdfb}
.ui-kb__tip-head{display: flex;justify-content: space-between;gap: 16px;margin-bottom: 6px;color: #fffdfb}
.ui-kb__tip-head b{color: #4f9d6e}
.ui-kb__tip-row{display: flex;align-items: center;gap: 7px}
.ui-kb__tip-row span{flex: 1}
.ui-kb__tip-row i{width: 7px;height: 7px;border: 1.5px solid #ff8a5c;border-radius: 50%}
.ui-kb__tip-row[data-soft] i{border-color: #ff6b35}
.ui-kb__focus .ui-kb__row--top{align-items: center;min-height: 69px;margin-bottom: 16px}
.ui-kb__focus .ui-kb__plot--small{flex: 1;min-height: 64px;margin-top: 16px}
.ui-kb__product{display: flex;align-items: center;gap: 12px;min-width: 0}
.ui-kb__product b{font-size: 14.5px;font-weight: 500}
.ui-kb__icon{display: grid;flex: none;place-items: center;width: 36px;height: 36px;border: 1px solid var(--ui-kb-line);border-radius: 9px;box-shadow: 0 1px 1px rgba(26, 21, 18, 0.04);color: var(--ui-kb-text)}
.ui-kb__focus .ui-kb__label{font-size: 12.5px;color: var(--ui-kb-muted)}
.ui-kb__legend{display: flex;flex-wrap: wrap;align-items: baseline;gap: 2px 8px;margin-top: 12px;font-size: 12.5px;color: var(--ui-kb-muted);white-space: nowrap;font-variant-numeric: tabular-nums}
.ui-kb__legend b{margin-right: 6px;font-weight: 500;color: var(--ui-kb-accent)}
.ui-kb__legend b[data-soft]{color: var(--ui-kb-soft)}
.ui-kb__setup{display: inline-flex;flex: none;align-items: center;gap: 6px;height: 30px;padding: 0 11px 0 9px;border: 1px solid var(--ui-kb-line);border-radius: 8px;background: var(--ui-kb-card);box-shadow: 0 1px 1px rgba(26, 21, 18, 0.04);font-size: 12.5px;color: var(--ui-kb-ink);white-space: nowrap;transition: border-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-kb__setup:hover{border-color: #c4b8ae;background: var(--ui-kb-well)}
.ui-kb__setup svg{color: var(--ui-kb-muted)}
.ui-kb__action{height: 34px;margin-top: auto;border: 1px solid var(--ui-kb-line);border-radius: 8px;background: var(--ui-kb-card);box-shadow: 0 1px 2px rgba(26, 21, 18, 0.06);font-size: 13px;font-weight: 500;color: var(--ui-kb-ink);transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-kb__legend + .ui-kb__action{margin-top: 16px}
.ui-kb__action:hover{background: var(--ui-kb-well)}
@keyframes ui-kb-rise{from{opacity: 0;transform: translateY(8px)}
}
@keyframes ui-kb-draw{from{clip-path: inset(0 100% 0 0)}
to{clip-path: inset(-8px -8px -8px -8px)}
}
@keyframes ui-kb-in{from{opacity: 0}
}
@keyframes ui-kb-menu{from{opacity: 0;transform: translateY(-4px) scale(0.97)}
}
@container (max-width: 820px){.ui-kb__overview, .ui-kb__focus{grid-column: span 6}
.ui-kb__stat .ui-kb__row{flex-direction: column;gap: 2px}
.ui-kb__stat .ui-kb__pair--end{justify-items: start;text-align: left}
.ui-kb__stat .ui-kb__change{font-size: 12.5px}
.ui-kb__stat .ui-kb__pair--end > span:last-child{display: none}
}
@container (max-width: 600px){.ui-kb{gap: 8px}
.ui-kb__card{grid-column: span 6}
.ui-kb__stat .ui-kb__row{flex-direction: row;gap: 12px}
.ui-kb__stat .ui-kb__pair--end{justify-items: end;text-align: right}
.ui-kb__stat .ui-kb__change{font-size: 14px}
.ui-kb__stat .ui-kb__pair--end > span:last-child{display: block}
.ui-kb__row--top{flex-wrap: wrap}
.ui-kb__plot--large{min-height: 160px}
}
@media (pointer: coarse){.ui-kb__pick-button, .ui-kb__setup{height: 36px}
.ui-kb__option{height: 38px}
.ui-kb__action{height: 40px}
}
@media (prefers-reduced-motion: reduce){.ui-kb *, .ui-kb *::before, .ui-kb *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-kb{--ui-kb-card: #1e1914;--ui-kb-line: #2c241b;--ui-kb-ink: #ebe3da;--ui-kb-text: #ac9f94;--ui-kb-muted: #7e6e61;--ui-kb-well: #251f19;--ui-kb-rule: #625245;--ui-kb-accent: #ff8a5c;--ui-kb-soft: #d9541f;--ui-kb-good: #4f9d6e;--ui-kb-bad: #f0938c;--ui-kb-tip: #2f261d;--ui-kb-focus: rgba(255, 253, 251, 0.3)}
:where(.dark, [data-theme="dark"]) .ui-kb__pick-button:hover, :where(.dark, [data-theme="dark"]) .ui-kb__pick[data-open] .ui-kb__pick-button{border-color: #43372a}
:where(.dark, [data-theme="dark"]) .ui-kb__menu{box-shadow: 0 12px 30px rgba(11, 9, 8, 0.5)}

`;
