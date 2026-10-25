"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

/*
 * Breakdown Chart – a total cut by two dimensions, in a single self-contained file.
 * Three listboxes pick the measure, the dimension along the bars and the dimension that stacks
 * them; the stacked bars re-stack and glide to their new heights when any of them changes.
 * Pointing at a bar (or focusing it, or clicking to pin it) dims the other columns, lifts the
 * faint "rest" band behind the bar, floats its breakdown above the plot and closes a pill over the
 * axis glyph below it; the table underneath mirrors the same selection in its rows. Legend chips
 * take a segment out of the picture and bring it back.
 * Geometry the original set inline – bar heights, segment flex factors, gridline positions,
 * column counts, the table shell height – stays inline here with the same properties.
 */

export type BreakdownRecord = {
  /** Stable identity – not used for grouping, only for keys */
  id?: string;
  [field: string]: string | number | undefined;
};

export type Dimension = {
  key: string;
  label: string;
  /** The values, in the order the bars, table rows and legend follow */
  values: string[];
  /** Optional colour per value – used by the swatches and the segment fills */
  colors?: Record<string, string>;
  /** Optional glyph per value, drawn beside the axis label and the table row */
  icons?: Record<string, ReactNode>;
};

export type Measure = {
  key: string;
  label: string;
  /** Unit after a number, e.g. "tasks" */
  unit?: string;
  /** The record field to sum – without it every record counts as one */
  field?: string;
};

export type BreakdownChartProps = {
  /** Flat records – one per task, ticket or order */
  records: BreakdownRecord[];
  /** Dimensions offered in the Slice and Segment pickers */
  dimensions: Dimension[];
  /** Measures offered in the Measure picker */
  measures: Measure[];
  /** Heading at the top of the card */
  title?: string;
  /** Measure shown first */
  defaultMeasure?: string;
  /** Dimension along the bars */
  defaultSlice?: string;
  /** Dimension that stacks the bars – "none" draws single blocks */
  defaultSegment?: string;
  className?: string;
};

const DEFAULT_COLORS = ["#3c85e9", "#e5484d", "#e8a20c", "#5b5bd6", "#2f9e8f", "#8c8c8c"];

function valueOf(record: BreakdownRecord, measure: Measure): number {
  if (!measure.field) return 1;
  const raw = record[measure.field];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

/** A percentage with at most two decimals, for the inline bar and gridline geometry */
function percent(part: number, whole: number): number {
  if (!(whole > 0)) return 0;
  return Math.round((part / whole) * 10000) / 100;
}

/** Round the tallest bar up to a readable axis, with a tick every step */
function axisFor(max: number): { top: number; ticks: number[] } {
  if (!(max > 0)) return { top: 1, ticks: [0, 1] };
  const rough = max / 5;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const step =
    (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10) *
    magnitude;
  const top = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let tick = 0; tick <= top + step / 2; tick += step) ticks.push(tick);
  return { top, ticks };
}

export function BreakdownChart({
  records,
  dimensions,
  measures,
  title = "Breakdown",
  defaultMeasure,
  defaultSlice,
  defaultSegment,
  className,
}: BreakdownChartProps) {
  const [measureKey, setMeasureKey] = useState(defaultMeasure ?? measures[0]?.key ?? "");
  const [sliceKey, setSliceKey] = useState(defaultSlice ?? dimensions[0]?.key ?? "");
  const [segmentKey, setSegmentKey] = useState(defaultSegment ?? dimensions[1]?.key ?? "");
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [tableHeight, setTableHeight] = useState<number | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const measure = measures.find((item) => item.key === measureKey) ?? measures[0];
  const sliceDim = dimensions.find((item) => item.key === sliceKey) ?? dimensions[0];
  const segmentDim = dimensions.find((item) => item.key === segmentKey);

  // One tally per slice, then per segment inside it
  const cells = useMemo(() => {
    const table: Record<string, Record<string, number>> = {};
    if (!measure || !sliceDim) return table;
    for (const slice of sliceDim.values) table[slice] = {};
    for (const record of records) {
      const bucket = table[String(record[sliceDim.key] ?? "")];
      if (!bucket) continue;
      const segment = segmentDim ? String(record[segmentDim.key] ?? "") : "";
      bucket[segment] = (bucket[segment] ?? 0) + valueOf(record, measure);
    }
    return table;
  }, [records, measure, sliceDim, segmentDim]);

  // The table shell keeps a fixed height so switching measures morphs instead of jumping
  useEffect(() => {
    const node = tableRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const sync = () => setTableHeight(Math.round(node.getBoundingClientRect().height));
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (!measure || !sliceDim) {
    return (
      <section className={["ui-bcc", className].filter(Boolean).join(" ")} aria-label={title}>
        {/* React 19 hoists this into <head> once, no matter how many charts render */}
        <style href="ui-breakdown-chart" precedence="default">
          {css}
        </style>
        <p className="ui-bcc__hint">Add a dimension and a measure to draw a breakdown.</p>
      </section>
    );
  }

  const slices = sliceDim.values;
  const segments = segmentDim?.values ?? [];
  const isHidden = (segment: string) => hidden[`${segmentDim?.key ?? ""}:${segment}`] === true;
  const visible = segments.filter((segment) => !isHidden(segment));

  const cellValue = (slice: string, segment: string) => cells[slice]?.[segment] ?? 0;
  const sliceTotal = (slice: string) =>
    segmentDim
      ? visible.reduce((sum, segment) => sum + (cells[slice]?.[segment] ?? 0), 0)
      : cells[slice]?.[""] ?? 0;

  const totals = slices.map(sliceTotal);
  const axis = axisFor(Math.max(0, ...totals));
  const grandTotal = totals.reduce((sum, total) => sum + total, 0);
  const unit = measure.unit;

  const active = hovered ?? pinned;
  const activeIndex = active === null ? -1 : slices.indexOf(active);
  const activeSlice = activeIndex >= 0 ? slices[activeIndex] : null;
  const colorOf = (segment: string) => {
    const position = segments.indexOf(segment);
    return segmentDim?.colors?.[segment] ?? DEFAULT_COLORS[Math.max(0, position) % DEFAULT_COLORS.length];
  };

  const columns = `repeat(${slices.length}, minmax(0px, 1fr))`;

  return (
    <section className={["ui-bcc", className].filter(Boolean).join(" ")} aria-label={title}>
      {/* React 19 hoists this into <head> once, no matter how many charts render */}
      <style href="ui-breakdown-chart" precedence="default">
        {css}
      </style>

      <header className="ui-bcc__head">
        <span className="ui-bcc__title">{title}</span>
        <span className="ui-bcc__total">
          <strong>{formatNumber(grandTotal)}</strong>
          {unit ? ` ${unit}` : null}
        </span>
      </header>

      <div className="ui-bcc__controls">
        <Picker
          label="Measure"
          value={measure.key}
          options={measures.map((item) => ({ value: item.key, label: item.label }))}
          onChange={setMeasureKey}
        />
        <Picker
          label="Slice"
          value={sliceDim.key}
          options={dimensions.map((item) => ({ value: item.key, label: item.label }))}
          onChange={setSliceKey}
        />
        <Picker
          label="Segment"
          value={segmentDim?.key ?? "none"}
          options={[
            { value: "none", label: "None" },
            ...dimensions.map((item) => ({ value: item.key, label: item.label })),
          ]}
          onChange={setSegmentKey}
        />
      </div>

      <div className="ui-bcc__chart">
        <div className="ui-bcc__plot">
          {[...axis.ticks].reverse().map((tick) => (
            <span
              key={tick}
              className="ui-bcc__grid"
              data-zero={tick === 0 ? "true" : undefined}
              style={{ bottom: `${percent(tick, axis.top)}%` }}
            >
              <span className="ui-bcc__tick">{formatNumber(tick)}</span>
            </span>
          ))}

          <div className="ui-bcc__bars" style={{ gridTemplateColumns: columns }}>
            {slices.map((slice, index) => {
              const total = totals[index];
              const isActive = activeSlice === slice;
              return (
                <button
                  key={slice}
                  type="button"
                  className="ui-bcc__col"
                  aria-label={`${slice}: ${formatNumber(total)}${unit ? ` ${unit}` : ""}`}
                  data-active={isActive ? "true" : undefined}
                  data-dim={activeSlice !== null && !isActive ? "true" : undefined}
                  onPointerEnter={() => setHovered(slice)}
                  onPointerLeave={() => setHovered((current) => (current === slice ? null : current))}
                  onFocus={() => setHovered(slice)}
                  onBlur={() => setHovered((current) => (current === slice ? null : current))}
                  onClick={() => setPinned((current) => (current === slice ? null : slice))}
                >
                  <span className="ui-bcc__rest" style={{ bottom: `${percent(total, axis.top)}%` }} />
                  <span className="ui-bcc__bar" style={{ height: `${percent(total, axis.top)}%` }}>
                    {segmentDim ? (
                      visible.map((segment) => {
                        const amount = cellValue(slice, segment);
                        if (amount <= 0) return null;
                        return (
                          <span
                            key={segment}
                            className="ui-bcc__seg"
                            style={{ flexGrow: amount, background: colorOf(segment) }}
                          />
                        );
                      })
                    ) : (
                      <span
                        className="ui-bcc__seg"
                        style={{ flexGrow: total, background: "var(--ui-bcc-accent)" }}
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {activeSlice !== null ? (
            <div
              className="ui-bcc__tooltip"
              data-side={activeIndex < slices.length / 2 ? "right" : "left"}
              style={{ left: `${percent(activeIndex + 0.5, slices.length)}%` }}
            >
              <p className="ui-bcc__tip-head">
                <span className="ui-bcc__tip-label">
                  {sliceDim.icons?.[activeSlice]}
                  {activeSlice}
                </span>
                <strong>{formatNumber(totals[activeIndex])}</strong>
              </p>
              {segmentDim ? (
                <ul>
                  {visible.map((segment) => {
                    const amount = cellValue(activeSlice, segment);
                    if (amount <= 0) return null;
                    return (
                      <li key={segment}>
                        <span className="ui-bcc__swatch" style={{ background: colorOf(segment) }} />
                        <span className="ui-bcc__tip-seg">{segment}</span>
                        <span className="ui-bcc__tip-num">{formatNumber(amount)}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="ui-bcc__xaxis" style={{ gridTemplateColumns: columns }}>
          {slices.map((slice, index) => {
            const glyph = sliceDim.icons?.[slice];
            return (
              <span key={slice} className="ui-bcc__xlabel" title={slice}>
                {activeSlice === slice ? (
                  <span className="ui-bcc__pill">
                    {glyph}
                    {formatNumber(totals[index])}
                  </span>
                ) : (
                  (glyph ?? <span className="ui-bcc__xtext">{slice}</span>)
                )}
              </span>
            );
          })}
        </div>
      </div>

      <div
        className="ui-bcc__morph"
        data-smooth=""
        style={tableHeight === null ? undefined : { height: `${tableHeight}px` }}
      >
        <div className="ui-bcc__table-wrap" ref={tableRef}>
          <table className="ui-bcc__table">
            <thead>
              <tr>
                <th scope="col">{sliceDim.label}</th>
                <th scope="col" data-num="true">
                  {measure.label}
                </th>
                {segments.map((segment) => (
                  <th
                    key={segment}
                    scope="col"
                    data-num="true"
                    data-hidden={isHidden(segment) ? "true" : undefined}
                  >
                    <span className="ui-bcc__th-seg">
                      <span className="ui-bcc__swatch" style={{ background: colorOf(segment) }} />
                      {segment}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slices.map((slice, index) => (
                <tr
                  key={slice}
                  data-active={activeSlice === slice ? "true" : undefined}
                  onPointerEnter={() => setHovered(slice)}
                  onPointerLeave={() => setHovered((current) => (current === slice ? null : current))}
                >
                  <th scope="row">
                    <span className="ui-bcc__row-label">
                      {sliceDim.icons?.[slice]}
                      {slice}
                    </span>
                  </th>
                  <td data-num="true" data-total="true">
                    {formatNumber(totals[index])}
                  </td>
                  {segments.map((segment) => (
                    <td
                      key={segment}
                      data-num="true"
                      data-hidden={isHidden(segment) ? "true" : undefined}
                    >
                      {formatNumber(cellValue(slice, segment))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <footer className="ui-bcc__foot">
        {segmentDim ? (
          <>
            <div
              className="ui-bcc__legend"
              role="group"
              aria-label={`${segmentDim.label} – click to show or hide`}
            >
              {segments.map((segment) => (
                <button
                  key={segment}
                  type="button"
                  className="ui-bcc__chip"
                  aria-pressed={!isHidden(segment)}
                  onClick={() =>
                    setHidden((current) => ({
                      ...current,
                      [`${segmentDim.key}:${segment}`]: !current[`${segmentDim.key}:${segment}`],
                    }))
                  }
                >
                  <span className="ui-bcc__swatch" style={{ background: colorOf(segment) }} />
                  {segment}
                </button>
              ))}
            </div>
            {visible.length < segments.length ? (
              <button type="button" className="ui-bcc__reset" onClick={() => setHidden({})}>
                Reset
              </button>
            ) : null}
          </>
        ) : (
          <p className="ui-bcc__hint">Pick a segment dimension to break the bars down.</p>
        )}
      </footer>
    </section>
  );
}

type Option = { value: string; label: string };

function Picker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<Array<HTMLButtonElement | null>>([]);
  const landing = useRef(0);

  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    items.current[landing.current]?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === "Tab") {
      close(false);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const current = items.current.findIndex((item) => item === document.activeElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    const next = (current + step + options.length) % options.length;
    items.current[next]?.focus();
  };

  return (
    <div className="ui-bcc__select" ref={root}>
      <span className="ui-bcc__select-label" id={id}>
        {label}
      </span>
      <button
        type="button"
        className="ui-bcc__select-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={id}
        ref={button}
        onClick={() => {
          if (!open) {
            const position = options.findIndex((option) => option.value === value);
            landing.current = position < 0 ? 0 : position;
          }
          setOpen(!open);
        }}
      >
        <span>{selected?.label}</span>
        <svg
          viewBox="0 0 16 16"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
        </svg>
      </button>

      {open ? (
        <div className="ui-bcc__menu" role="listbox" aria-labelledby={id} onKeyDown={onKeyDown}>
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              className="ui-bcc__option"
              aria-selected={option.value === value}
              ref={(node) => {
                items.current[index] = node;
              }}
              onClick={() => {
                onChange(option.value);
                close(true);
              }}
            >
              <span>{option.label}</span>
              {option.value === value ? (
                <svg
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m3.5 8.5 3 3 6-7" />
                </svg>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const css = /* css */ `
.ui-bcc{--ui-bcc-card: #fffdfb;--ui-bcc-ink: rgba(11, 9, 8, 0.88);--ui-bcc-strong: #0b0908;--ui-bcc-text: rgba(11, 9, 8, 0.61);--ui-bcc-muted: rgba(11, 9, 8, 0.45);--ui-bcc-faint: rgba(11, 9, 8, 0.27);--ui-bcc-icon: rgba(11, 9, 8, 0.447);--ui-bcc-line: rgba(11, 9, 8, 0.06);--ui-bcc-grid: rgba(11, 9, 8, 0.06);--ui-bcc-zero: rgba(11, 9, 8, 0.12);--ui-bcc-fill: rgba(11, 9, 8, 0.06);--ui-bcc-wash: rgba(11, 9, 8, 0.03);--ui-bcc-rest: rgba(11, 9, 8, 0.035);--ui-bcc-accent: rgba(217, 84, 31, 0.765);--ui-bcc-focus: rgba(217, 84, 31, 0.35);--ui-bcc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-bcc-shadow-hover: 0 0 0 0.5px rgba(11, 9, 8, 0.12), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-bcc-shadow-pop: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 12px 28px -10px rgba(11, 9, 8, 0.16), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-bcc-ease: cubic-bezier(0.22, 1, 0.36, 1);position: relative;box-sizing: border-box;container-type: inline-size;width: 100%;max-width: 560px;border-radius: 10px;background: var(--ui-bcc-card);box-shadow: var(--ui-bcc-shadow);font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;font-weight: 400;color: var(--ui-bcc-ink);-webkit-font-smoothing: antialiased;font-variant-numeric: tabular-nums}
.ui-bcc *, .ui-bcc *::before, .ui-bcc *::after{box-sizing: border-box}
:where(.ui-bcc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;cursor: pointer}
:where(.ui-bcc) svg{display: block;flex: none}
.ui-bcc button:focus-visible{outline: 2px solid var(--ui-bcc-focus);outline-offset: 1px}
.ui-bcc__head{display: flex;align-items: baseline;justify-content: space-between;gap: 12px;padding: 14px 16px 0}
.ui-bcc__title{min-width: 0;overflow: hidden;font-size: 15px;line-height: 24px;font-weight: 500;color: var(--ui-bcc-strong);white-space: nowrap;text-overflow: ellipsis}
.ui-bcc__total{flex: none;font-size: 12px;line-height: 16px;color: var(--ui-bcc-muted)}
.ui-bcc__total strong{font-size: 15px;line-height: 24px;font-weight: 500;color: var(--ui-bcc-ink)}
.ui-bcc__controls{display: grid;grid-template-columns: repeat(3, minmax(0, 1fr));gap: 8px;padding: 12px 16px 0}
.ui-bcc__select{position: relative;display: grid;grid-template-columns: minmax(0, 1fr);gap: 4px;min-width: 0}
.ui-bcc__select-label{padding-left: 2px;font-size: 12px;line-height: 16px;color: var(--ui-bcc-muted)}
.ui-bcc__select-btn{display: flex;align-items: center;justify-content: space-between;gap: 6px;height: 28px;padding: 0 6px 0 10px;border-radius: 6px;background: var(--ui-bcc-card);box-shadow: var(--ui-bcc-shadow);font-size: 13px;line-height: 20px;font-weight: 500;color: var(--ui-bcc-strong);text-align: left;transition: box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-bcc__select-btn:hover{box-shadow: var(--ui-bcc-shadow-hover)}
.ui-bcc__select-btn span{overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-bcc__select-btn svg{color: var(--ui-bcc-icon);transition: transform var(--nm-dur-3, 240ms) var(--ui-bcc-ease)}
.ui-bcc__select-btn[aria-expanded="true"] svg{transform: rotate(180deg)}
.ui-bcc__menu{position: absolute;top: calc(100% + 4px);left: 0;right: 0;z-index: 6;display: grid;gap: 0;min-width: 140px;padding: 4px;border-radius: 10px;background: var(--ui-bcc-card);box-shadow: var(--ui-bcc-shadow-pop);transform-origin: top center;animation: ui-bcc-drop var(--nm-dur-2, 160ms) var(--ui-bcc-ease)}
.ui-bcc__option{display: flex;align-items: center;justify-content: space-between;gap: 8px;height: 28px;padding: 0 6px 0 8px;border-radius: 6px;font-size: 13px;line-height: 20px;color: var(--ui-bcc-ink);text-align: left;white-space: nowrap}
.ui-bcc__option span{overflow: hidden;text-overflow: ellipsis}
.ui-bcc__option:hover, .ui-bcc__option:focus-visible{background: var(--ui-bcc-fill);outline: none}
.ui-bcc__option svg{color: var(--ui-bcc-accent)}
.ui-bcc__chart{padding: 20px 16px 10px}
.ui-bcc__plot{position: relative;height: 196px;margin-right: 28px}
.ui-bcc__grid{position: absolute;left: 0;right: 0;height: 0;border-top: 0.5px solid var(--ui-bcc-grid)}
.ui-bcc__grid[data-zero]{border-color: var(--ui-bcc-zero)}
.ui-bcc__tick{position: absolute;right: -28px;top: -8px;width: 24px;font-size: 11px;line-height: 16px;text-align: right;color: var(--ui-bcc-muted)}
.ui-bcc__bars{position: absolute;inset: 0;display: grid;gap: 4px}
.ui-bcc__col{position: relative;display: flex;align-items: flex-end;justify-content: center;height: 100%;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-bcc__col:focus-visible{outline-offset: 4px;border-radius: 6px}
.ui-bcc__col[data-dim]{opacity: 0.35}
.ui-bcc__rest{position: absolute;top: 0;left: 50%;width: 12px;margin-left: -6px;border-radius: 3px 3px 0 0;background: var(--ui-bcc-rest);opacity: 0;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), bottom var(--nm-dur-5, 620ms) var(--ui-bcc-ease)}
.ui-bcc__col[data-active] .ui-bcc__rest{opacity: 1}
.ui-bcc__bar{position: relative;display: flex;flex-direction: column-reverse;gap: 1px;width: 12px;min-height: 0;overflow: hidden;border-radius: 3px 3px 0 0;transition: height var(--nm-dur-5, 620ms) var(--ui-bcc-ease)}
.ui-bcc__seg{flex-basis: 0;min-height: 2px;transition: flex-grow var(--nm-dur-5, 620ms) var(--ui-bcc-ease), background-color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-bcc__tooltip{position: absolute;z-index: 4;min-width: 152px;padding: 6px 10px 8px;border-radius: 10px;background: var(--ui-bcc-card);box-shadow: var(--ui-bcc-shadow-pop);top: 0;pointer-events: none;transition: left var(--nm-dur-2, 160ms) var(--ui-bcc-ease);animation: ui-bcc-pop 160ms var(--ui-bcc-ease)}
.ui-bcc__tooltip[data-side="right"]{transform: translateX(18px)}
.ui-bcc__tooltip[data-side="left"]{transform: translateX(calc(-100% - 18px))}
.ui-bcc__tip-head{display: flex;align-items: center;justify-content: space-between;gap: 16px;margin: 0;font-size: 13px;line-height: 20px;font-weight: 500;color: var(--ui-bcc-strong)}
.ui-bcc__tip-head strong{font-weight: 500}
.ui-bcc__tip-label{display: inline-flex;align-items: center;gap: 6px;white-space: nowrap}
.ui-bcc__tooltip ul{display: grid;gap: 0;margin: 4px 0 0;padding: 4px 0 0;border-top: 0.5px solid var(--ui-bcc-line);list-style: none}
.ui-bcc__tooltip li{display: flex;align-items: center;gap: 8px;font-size: 12px;line-height: 20px;color: var(--ui-bcc-text)}
.ui-bcc__tip-seg{flex: 1;white-space: nowrap}
.ui-bcc__tip-num{color: var(--ui-bcc-ink)}
.ui-bcc__swatch{flex: none;width: 8px;height: 8px;border-radius: 2px}
.ui-bcc__xaxis{display: grid;gap: 4px;margin: 8px 28px 0 0}
.ui-bcc__xlabel{position: relative;display: grid;place-items: center;height: 24px;min-width: 0;overflow: visible;color: var(--ui-bcc-icon)}
.ui-bcc__pill{position: absolute;top: 50%;left: 50%;z-index: 2;display: inline-flex;align-items: center;gap: 6px;height: 24px;padding: 0 8px 0 6px;border-radius: 6px;background: var(--ui-bcc-card);box-shadow: var(--ui-bcc-shadow);font-size: 12px;line-height: 16px;font-weight: 500;white-space: nowrap;color: var(--ui-bcc-ink);transform: translate(-50%, -50%);animation: ui-bcc-pill var(--nm-dur-2, 160ms) var(--ui-bcc-ease)}
.ui-bcc__xtext{overflow: hidden;max-width: 100%;font-size: 11px;line-height: 16px;white-space: nowrap;text-overflow: ellipsis;color: var(--ui-bcc-muted)}
.ui-bcc__table-wrap{overflow-x: auto;border-top: 0.5px solid var(--ui-bcc-line);scrollbar-width: thin}
.ui-bcc__table{width: 100%;border-collapse: collapse;font-size: 13px;line-height: 20px}
.ui-bcc__table th, .ui-bcc__table td{height: 36px;padding: 0 10px;border-top: 0.5px solid var(--ui-bcc-line);background: var(--ui-bcc-card);text-align: left;white-space: nowrap}
.ui-bcc__table th:first-child, .ui-bcc__table td:first-child{padding-left: 16px}
.ui-bcc__table th:last-child, .ui-bcc__table td:last-child{padding-right: 16px}
.ui-bcc__table thead th{height: 32px;border-top: 0;font-size: 10px;line-height: 16px;font-weight: 500;letter-spacing: 0.5px;text-transform: uppercase;color: var(--ui-bcc-muted)}
.ui-bcc__table [data-num]{text-align: right}
.ui-bcc__table tbody th{position: sticky;left: 0;z-index: 1;font-weight: 400;color: var(--ui-bcc-ink)}
.ui-bcc__table tbody tr[data-active] th, .ui-bcc__table tbody tr[data-active] td{background: linear-gradient(var(--ui-bcc-wash), var(--ui-bcc-wash)) var(--ui-bcc-card)}
.ui-bcc__table td{color: var(--ui-bcc-text)}
.ui-bcc__table td[data-total]{color: var(--ui-bcc-ink)}
.ui-bcc__table [data-hidden]{opacity: 0.35}
.ui-bcc__row-label, .ui-bcc__th-seg{display: inline-flex;align-items: center;gap: 8px}
.ui-bcc__row-label svg{color: var(--ui-bcc-icon)}
.ui-bcc__th-seg{gap: 6px}
.ui-bcc__foot{display: flex;align-items: center;justify-content: space-between;gap: 8px;min-height: 44px;padding: 8px;border-top: 0.5px solid var(--ui-bcc-line)}
.ui-bcc__legend{display: flex;flex-wrap: nowrap;gap: 2px;min-width: 0;overflow-x: auto;scrollbar-width: none}
.ui-bcc__legend::-webkit-scrollbar{display: none}
.ui-bcc__chip{flex: none}
.ui-bcc .ui-bcc__chip:focus-visible{outline-offset: -2px}
.ui-bcc__chip{display: inline-flex;align-items: center;gap: 6px;height: 28px;padding: 0 8px;border-radius: 6px;font-size: 12px;line-height: 16px;font-weight: 500;color: var(--ui-bcc-text);white-space: nowrap;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-bcc__chip:hover{background: var(--ui-bcc-wash);color: var(--ui-bcc-ink)}
.ui-bcc__chip[aria-pressed="false"]{opacity: 0.45;text-decoration: line-through;text-decoration-color: var(--ui-bcc-faint)}
.ui-bcc__hint{padding-left: 8px;font-size: 12px;line-height: 16px;color: var(--ui-bcc-muted)}
.ui-bcc__reset{flex: none;height: 28px;padding: 0 10px;border-radius: 6px;font-size: 13px;line-height: 20px;font-weight: 500;color: var(--ui-bcc-ink);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));animation: ui-bcc-pop 160ms var(--ui-bcc-ease)}
.ui-bcc__reset:hover{background: var(--ui-bcc-wash)}
@keyframes ui-bcc-drop{from{opacity: 0;transform: translateY(-4px) scale(0.98)}
}
@keyframes ui-bcc-pop{from{opacity: 0}
}
@keyframes ui-bcc-pill{from{opacity: 0;transform: translate(-50%, -50%) scale(0.92)}
}
.ui-bcc__morph{overflow: hidden}
.ui-bcc__morph[data-smooth]{transition: height 380ms var(--ui-bcc-ease)}
@container (max-width: 420px){.ui-bcc__head{padding: 12px 12px 0}
.ui-bcc__controls{gap: 6px;padding: 10px 12px 0}
.ui-bcc__select-btn{padding: 0 4px 0 8px}
.ui-bcc__chart{padding: 18px 12px 8px}
.ui-bcc__plot{height: 168px}
.ui-bcc__bar, .ui-bcc__rest{width: 10px}
.ui-bcc__rest{margin-left: -5px}
.ui-bcc__table th:first-child, .ui-bcc__table td:first-child{padding-left: 12px}
.ui-bcc__table th:last-child, .ui-bcc__table td:last-child{padding-right: 12px}
.ui-bcc__foot{padding: 6px}
.ui-bcc__legend{gap: 0}
.ui-bcc__chip{gap: 5px;padding: 0 6px}
}
@media (hover: none) and (pointer: coarse){.ui-bcc__select-btn{height: 36px}
.ui-bcc__option{height: 40px}
.ui-bcc__chip, .ui-bcc__reset{height: 36px}
}
@media (prefers-reduced-motion: reduce){.ui-bcc__bar, .ui-bcc__seg, .ui-bcc__tooltip, .ui-bcc__col, .ui-bcc__rest, .ui-bcc__morph[data-smooth]{transition: none}
.ui-bcc__menu, .ui-bcc__tooltip, .ui-bcc__pill, .ui-bcc__reset{animation: none}
}
:where(.dark, [data-theme="dark"]) .ui-bcc{--ui-bcc-card: #211b16;--ui-bcc-ink: rgba(255, 253, 251, 0.9);--ui-bcc-strong: #fffdfb;--ui-bcc-text: rgba(255, 253, 251, 0.62);--ui-bcc-muted: rgba(255, 253, 251, 0.46);--ui-bcc-faint: rgba(255, 253, 251, 0.3);--ui-bcc-icon: rgba(255, 253, 251, 0.5);--ui-bcc-line: rgba(255, 253, 251, 0.08);--ui-bcc-grid: rgba(255, 253, 251, 0.08);--ui-bcc-zero: rgba(255, 253, 251, 0.16);--ui-bcc-fill: rgba(255, 253, 251, 0.08);--ui-bcc-wash: rgba(255, 253, 251, 0.04);--ui-bcc-rest: rgba(255, 253, 251, 0.05);--ui-bcc-accent: #ff8a5c;--ui-bcc-focus: rgba(255, 138, 92, 0.5);--ui-bcc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-bcc-shadow-hover: 0 0 0 0.5px rgba(255, 253, 251, 0.16), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-bcc-shadow-pop: 0 0 0 0.5px rgba(255, 253, 251, 0.12), 0 12px 28px -10px rgba(11, 9, 8, 0.6)}
:where(.dark, [data-theme="dark"]) .ui-bcc__menu, :where(.dark, [data-theme="dark"]) .ui-bcc__tooltip, :where(.dark, [data-theme="dark"]) .ui-bcc__pill{background: #28211a}
:where(.dark, [data-theme="dark"]) .ui-bcc__select-btn{background: #26201a}

`;
