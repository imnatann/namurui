"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

/*
 * Date Range Picker – a trigger that opens a dialog with presets on the left and two month
 * grids side by side on the right.
 *
 * It moves in five places. The panel unfolds from the trigger with a short drop and scale; the
 * months slide 14px from the side the navigation went, and slide back the other way when it
 * returns, so the direction is legible. Picking a start turns the range into a lighter preview
 * band that follows the pointer across both grids until the second pick, which stamps the two
 * ends with a dark chip that springs from 0.82. Turning comparison on unfolds a range line out
 * of the footer and lays the previous period behind the calendars as a blue-washed band with
 * outlined ends, so the two spans read at once.
 *
 * Every day is a real button in a grid with one tab stop: arrows move by day, PageUp/PageDown by
 * month, Home/End to the week edges, Enter or Space picks, Escape closes. The calendar is
 * computed here – no date library – and the comparison period is derived from the chosen span,
 * never stored. Styles are injected below, so no extra files are needed.
 */

/** An inclusive range of whole days. */
export type DateRange = { start: Date; end: Date };

/** One row of the preset column. `range` is resolved against the picker's reference day. */
export type DatePreset = {
  /** Stable key for React */
  id: string;
  /** Copy shown in the column */
  label: string;
  /** The span this preset means, given "today" */
  range: (today: Date) => DateRange;
};

/** Which period sits behind the range as a comparison band. */
export type CompareMode = "off" | "previous" | "year";

export type DateRangePickerProps = {
  /** Controlled range. Leave undefined to let the picker hold it */
  value?: DateRange;
  /** Range it opens on when uncontrolled – defaults to the last 30 days */
  defaultValue?: DateRange;
  /** Fired on Apply with the range, the comparison span it implies and the mode */
  onChange?: (range: DateRange, compare: DateRange | null, mode: CompareMode) => void;
  /** Rows of the preset column – defaults to the nine the picker ships with */
  presets?: DatePreset[];
  /** Show the "Compare" segmented control and its band */
  compare?: boolean;
  /** Comparison selected on first render – defaults to off */
  defaultCompare?: CompareMode;
  /** 0 starts the week on Sunday, 1 on Monday (the default) */
  weekStartsOn?: 0 | 1;
  /** Earliest selectable day */
  min?: Date;
  /** Latest selectable day – defaults to the reference day, so the future stays closed */
  max?: Date;
  /** Reference day for the presets and "today" – handy for tests and screenshots */
  today?: Date;
  /** Render with the dialog already open */
  defaultOpen?: boolean;
  /** Extra class on the root */
  className?: string;
};

type RangeDraft = { start: Date | null; end: Date | null };

const DAY_MS = 86_400_000;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const COMPARE_OPTIONS: { id: CompareMode; label: string }[] = [
  { id: "off", label: "Off" },
  { id: "previous", label: "Previous period" },
  { id: "year", label: "Previous year" },
];

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (month: Date, count: number) =>
  new Date(month.getFullYear(), month.getMonth() + count, 1);

/** Keeps the day of the month, clamped to the shorter month it lands in. */
const shiftMonths = (date: Date, months: number) => {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), last));
};

/** Index of the day inside its week row, for the configured first day. */
const weekOffset = (date: Date, weekStartsOn: 0 | 1) => (date.getDay() - weekStartsOn + 7) % 7;

/** Where a key moves the roving focus from the day it sits on. */
const GRID_KEYS: Record<string, ((from: Date, weekStartsOn: 0 | 1) => Date) | undefined> = {
  ArrowLeft: (from) => addDays(from, -1),
  ArrowRight: (from) => addDays(from, 1),
  ArrowUp: (from) => addDays(from, -7),
  ArrowDown: (from) => addDays(from, 7),
  PageUp: (from) => shiftMonths(from, -1),
  PageDown: (from) => shiftMonths(from, 1),
  Home: (from, weekStartsOn) => addDays(from, -weekOffset(from, weekStartsOn)),
  End: (from, weekStartsOn) => addDays(from, 6 - weekOffset(from, weekStartsOn)),
};

/** UTC midnight of the same calendar day – day arithmetic that never trips on a DST change. */
const dayKey = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

const spanOf = (range: DateRange) => Math.round((dayKey(range.end) - dayKey(range.start)) / DAY_MS) + 1;

const normalizeRange = (range: DateRange): DateRange =>
  dayKey(range.start) <= dayKey(range.end)
    ? { start: startOfDay(range.start), end: startOfDay(range.end) }
    : { start: startOfDay(range.end), end: startOfDay(range.start) };

const shortDate = (date: Date) => `${MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}`;

const rangeLabel = (range: DateRange) =>
  range.start.getFullYear() === range.end.getFullYear()
    ? `${shortDate(range.start)} – ${shortDate(range.end)}, ${range.end.getFullYear()}`
    : `${shortDate(range.start)}, ${range.start.getFullYear()} – ${shortDate(range.end)}, ${range.end.getFullYear()}`;

const fullDateLabel = (date: Date) =>
  `${WEEKDAYS_LONG[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

/** The period laid behind the calendars for a comparison mode. */
function compareRangeOf(range: DateRange, mode: CompareMode): DateRange | null {
  if (mode === "off") return null;
  if (mode === "year") {
    return { start: shiftMonths(range.start, -12), end: shiftMonths(range.end, -12) };
  }
  const length = spanOf(range);
  return { start: addDays(range.start, -length), end: addDays(range.start, -1) };
}

const DEFAULT_PRESETS: DatePreset[] = [
  { id: "today", label: "Today", range: (day) => ({ start: day, end: day }) },
  {
    id: "yesterday",
    label: "Yesterday",
    range: (day) => ({ start: addDays(day, -1), end: addDays(day, -1) }),
  },
  { id: "last-7", label: "Last 7 days", range: (day) => ({ start: addDays(day, -6), end: day }) },
  { id: "last-30", label: "Last 30 days", range: (day) => ({ start: addDays(day, -29), end: day }) },
  { id: "last-90", label: "Last 90 days", range: (day) => ({ start: addDays(day, -89), end: day }) },
  {
    id: "this-month",
    label: "This month",
    range: (day) => ({ start: startOfMonth(day), end: day }),
  },
  {
    id: "last-month",
    label: "Last month",
    range: (day) => ({
      start: addMonths(day, -1),
      end: new Date(day.getFullYear(), day.getMonth(), 0),
    }),
  },
  {
    id: "this-quarter",
    label: "This quarter",
    range: (day) => ({
      start: new Date(day.getFullYear(), day.getMonth() - (day.getMonth() % 3), 1),
      end: day,
    }),
  },
  {
    id: "year-to-date",
    label: "Year to date",
    range: (day) => ({ start: new Date(day.getFullYear(), 0, 1), end: day }),
  },
];

type GridCell = Date | null;

/** The month's own days, padded to whole weeks – outside days are holes, not greyed neighbours. */
function monthRows(month: Date, weekStartsOn: 0 | 1): GridCell[][] {
  const year = month.getFullYear();
  const index = month.getMonth();
  const lead = weekOffset(new Date(year, index, 1), weekStartsOn);
  const total = new Date(year, index + 1, 0).getDate();

  const cells: GridCell[] = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let day = 1; day <= total; day += 1) cells.push(new Date(year, index, day));
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: GridCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

export function DateRangePicker({
  value,
  defaultValue,
  onChange,
  presets = DEFAULT_PRESETS,
  compare = true,
  defaultCompare = "off",
  weekStartsOn = 1,
  min,
  max,
  today,
  defaultOpen = false,
  className,
}: DateRangePickerProps) {
  const ids = useId();
  const panelId = `${ids}-panel`;

  const [reference] = useState(() => startOfDay(today ?? new Date()));
  const upperBound = startOfDay(max ?? reference);
  const lowerBound = min ? startOfDay(min) : new Date(1970, 0, 1);

  const clampDay = (date: Date) => {
    const key = dayKey(date);
    if (key < dayKey(lowerBound)) return lowerBound;
    if (key > dayKey(upperBound)) return upperBound;
    return date;
  };

  const [innerRange, setInnerRange] = useState<DateRange>(() =>
    normalizeRange(defaultValue ?? { start: addDays(reference, -29), end: reference }),
  );
  const applied = value ? normalizeRange(value) : innerRange;

  const [open, setOpen] = useState(defaultOpen);
  const [draft, setDraft] = useState<RangeDraft>(() => ({ start: applied.start, end: applied.end }));
  const [hover, setHover] = useState<Date | null>(null);
  const [mode, setMode] = useState<CompareMode>(compare ? defaultCompare : "off");
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(applied.start));
  const [dir, setDir] = useState<1 | -1>(1);
  const [focused, setFocused] = useState<Date>(() => clampDay(applied.end));
  const [triggerWidth, setTriggerWidth] = useState<number | null>(null);
  const [clipHeight, setClipHeight] = useState<number | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const appliedCompare = compare && mode !== "off" ? compareRangeOf(applied, mode) : null;
  const triggerLabel = rangeLabel(applied);
  const compareLabel = appliedCompare ? rangeLabel(appliedCompare) : null;

  /** The trigger is pinned to the width its content needs, so a new label animates instead of jumping. */
  const measureTrigger = useCallback(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const content = inner.getBoundingClientRect().width;
    if (content < 1) return;
    const next = Math.ceil(content) + 16;
    setTriggerWidth((previous) => (previous === next ? previous : next));
  }, []);

  useEffect(measureTrigger, [measureTrigger, triggerLabel, compareLabel]);

  useEffect(() => {
    let alive = true;
    void document.fonts?.ready.then(() => {
      if (alive) measureTrigger();
    });
    return () => {
      alive = false;
    };
  }, [measureTrigger]);

  /** The clip animates on its measured height, so the panel can change height without a jump. */
  useEffect(() => {
    if (!open) return;
    const body = bodyRef.current;
    if (!body) return;
    const sync = () => setClipHeight(Math.round(body.getBoundingClientRect().height));
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(body);
    return () => observer.disconnect();
  }, [open]);

  const closePanel = useCallback((refocus = true) => {
    setOpen(false);
    setHover(null);
    if (refocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (root && !root.contains(event.target as Node)) closePanel(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, closePanel]);

  const focusDay = useCallback((date: Date) => {
    const stamp = date.getTime();
    requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLButtonElement>(`button[data-day="${stamp}"]`)
        ?.focus({ preventScroll: true });
    });
  }, []);

  const openPanel = () => {
    setDraft({ start: applied.start, end: applied.end });
    setViewMonth(startOfMonth(applied.start));
    setFocused(clampDay(applied.end));
    setHover(null);
    setDir(1);
    setOpen(true);
    focusDay(clampDay(applied.end));
  };

  const pick = (date: Date) => {
    if (dayKey(date) < dayKey(lowerBound) || dayKey(date) > dayKey(upperBound)) return;
    setFocused(date);
    setHover(null);
    if (!draft.start || draft.end) {
      setDraft({ start: date, end: null });
      return;
    }
    if (dayKey(date) < dayKey(draft.start)) {
      setDraft({ start: date, end: null });
      return;
    }
    setDraft({ start: draft.start, end: date });
  };

  const choosePreset = (preset: DatePreset) => {
    const range = preset.range(reference);
    setDraft({ start: range.start, end: range.end });
    setFocused(clampDay(range.end));
    setViewMonth(startOfMonth(range.start));
    setHover(null);
    setDir(1);
  };

  const apply = () => {
    if (!draft.start || !draft.end) return;
    const range: DateRange = { start: draft.start, end: draft.end };
    if (value === undefined) setInnerRange(range);
    onChange?.(range, compareRangeOf(range, compare ? mode : "off"), compare ? mode : "off");
    closePanel();
  };

  const stepMonths = (delta: 1 | -1) => {
    const next = addMonths(viewMonth, delta);
    setDir(delta);
    setViewMonth(next);
    const lastVisible = new Date(next.getFullYear(), next.getMonth() + 2, 0);
    if (dayKey(focused) < dayKey(next)) setFocused(clampDay(next));
    else if (dayKey(focused) > dayKey(lastVisible)) setFocused(clampDay(lastVisible));
  };

  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = GRID_KEYS[event.key];
    if (!step) return;
    event.preventDefault();

    const target = clampDay(step(focused, weekStartsOn));
    setFocused(target);

    const targetMonth = startOfMonth(target);
    if (dayKey(targetMonth) < dayKey(viewMonth)) {
      setDir(-1);
      setViewMonth(targetMonth);
    } else if (dayKey(targetMonth) > dayKey(addMonths(viewMonth, 1))) {
      setDir(1);
      setViewMonth(addMonths(targetMonth, -1));
    }
    focusDay(target);
  };

  const committed: DateRange | null =
    draft.start && draft.end ? { start: draft.start, end: draft.end } : null;
  const anchor = draft.start;

  /* While only a start is chosen the band follows the pointer, and dragging backwards flips
   * which end is which rather than blanking the preview. */
  let preview: DateRange | null = null;
  if (anchor && draft.end === null) {
    const reach = hover ?? anchor;
    preview =
      dayKey(reach) < dayKey(anchor)
        ? { start: reach, end: anchor }
        : { start: anchor, end: reach };
  }
  const comparison = committed && compare && mode !== "off" ? compareRangeOf(committed, mode) : null;

  const bandFrom = committed ? dayKey(committed.start) : null;
  const bandTo = committed ? dayKey(committed.end) : null;
  const previewFrom = preview ? dayKey(preview.start) : null;
  const previewTo = preview ? dayKey(preview.end) : null;
  const compareFrom = comparison ? dayKey(comparison.start) : null;
  const compareTo = comparison ? dayKey(comparison.end) : null;
  const focusedKey = dayKey(focused);

  const customActive =
    committed !== null &&
    !presets.some((preset) => {
      const range = preset.range(reference);
      return dayKey(range.start) === bandFrom && dayKey(range.end) === bandTo;
    });

  const renderDay = (date: Date, rowStart: boolean, rowEnd: boolean) => {
    const key = dayKey(date);
    const selected = bandFrom !== null && bandTo !== null && key >= bandFrom && key <= bandTo;
    const previewed = previewFrom !== null && previewTo !== null && key >= previewFrom && key <= previewTo;
    const compared = compareFrom !== null && compareTo !== null && key >= compareFrom && key <= compareTo;
    const isStart = key === bandFrom || key === previewFrom;
    const isEnd = key === bandTo || key === previewTo;

    return (
      <span
        key={key}
        role="gridcell"
        className="ui-drpc__day"
        aria-selected={selected ? true : undefined}
        data-range={selected ? "true" : undefined}
        data-preview={previewed ? "true" : undefined}
        data-compare={compared ? "true" : undefined}
        data-start={isStart ? "true" : undefined}
        data-end={isEnd ? "true" : undefined}
        data-compare-start={key === compareFrom ? "true" : undefined}
        data-compare-end={key === compareTo ? "true" : undefined}
        data-row-start={rowStart ? "true" : undefined}
        data-row-end={rowEnd ? "true" : undefined}
        onMouseEnter={() => {
          if (anchor && draft.end === null) setHover(date);
        }}
      >
        <button
          type="button"
          data-day={date.getTime()}
          tabIndex={key === focusedKey ? 0 : -1}
          disabled={dayKey(date) < dayKey(lowerBound) || dayKey(date) > dayKey(upperBound)}
          aria-current={key === dayKey(reference) ? "date" : undefined}
          aria-label={fullDateLabel(date)}
          onClick={() => pick(date)}
        >
          {date.getDate()}
        </button>
      </span>
    );
  };

  const renderMonth = (month: Date, second: boolean) => {
    const title = `${MONTHS[month.getMonth()]} ${month.getFullYear()}`;
    return (
      <div
        key={month.getTime()}
        className="ui-drpc__month"
        data-second={second ? "true" : undefined}
      >
        <div className="ui-drpc__month-name" aria-live={second ? undefined : "polite"}>
          {title}
        </div>
        <div role="grid" aria-label={title} className="ui-drpc__grid">
          <div role="row" className="ui-drpc__weekdays">
            {Array.from({ length: 7 }, (_, index) => {
              const day = (index + weekStartsOn) % 7;
              return (
                <span key={day} role="columnheader" className="ui-drpc__weekday">
                  {WEEKDAYS_SHORT[day]}
                </span>
              );
            })}
          </div>
          {monthRows(month, weekStartsOn).map((row, rowIndex) => {
            const first = row.findIndex((cell) => cell !== null);
            const last = row.reduce((found, cell, index) => (cell ? index : found), -1);
            return (
              <div role="row" className="ui-drpc__week" key={rowIndex}>
                {row.map((date, index) =>
                  date === null ? (
                    <span
                      key={`empty-${index}`}
                      className="ui-drpc__day ui-drpc__day-empty"
                      role="gridcell"
                    />
                  ) : (
                    renderDay(date, index === first, index === last)
                  ),
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const dayCount = committed ? spanOf(committed) : 0;
  const summary = committed
    ? rangeLabel(committed)
    : anchor
      ? `${shortDate(anchor)} – pick an end date`
      : "Select a range";

  return (
    <div
      ref={rootRef}
      className={["ui-drpc", className].filter(Boolean).join(" ")}
      data-open={open ? "true" : undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          closePanel();
        }
      }}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-date-range-picker" precedence="default">
        {css}
      </style>

      <button
        ref={triggerRef}
        type="button"
        className="ui-drpc__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        style={{ width: triggerWidth !== null ? `${triggerWidth}px` : undefined }}
        onClick={() => (open ? closePanel(false) : openPanel())}
      >
        <span ref={innerRef} className="ui-drpc__trigger-inner">
          <svg viewBox="0 0 24 24" className="ui-drpc__glyph" aria-hidden="true">
            <path d="M7 3v3M17 3v3M4.5 9.5h15M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
          </svg>
          <span className="ui-drpc__trigger-text">
            <span className="ui-drpc__trigger-range">{triggerLabel}</span>
            {compareLabel ? (
              <span className="ui-drpc__trigger-compare">vs {compareLabel}</span>
            ) : null}
          </span>
          <svg viewBox="0 0 24 24" className="ui-drpc__glyph ui-drpc__chevron" aria-hidden="true">
            <path d="M8 10l4 4 4-4" />
          </svg>
        </span>
      </button>

      {open ? (
        <div ref={panelRef} id={panelId} role="dialog" aria-label="Choose a date range" className="ui-drpc__panel">
          <div className="ui-drpc__clip" style={{ height: clipHeight !== null ? `${clipHeight}px` : undefined }}>
            <div ref={bodyRef} className="ui-drpc__body">
              <div className="ui-drpc__presets" role="listbox" aria-label="Presets">
                {presets.map((preset) => {
                  const range = preset.range(reference);
                  const selected =
                    committed !== null &&
                    dayKey(range.start) === bandFrom &&
                    dayKey(range.end) === bandTo;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className="ui-drpc__preset"
                      onClick={() => choosePreset(preset)}
                    >
                      {preset.label}
                    </button>
                  );
                })}
                <span
                  className="ui-drpc__preset ui-drpc__preset-custom"
                  aria-hidden="true"
                  data-active={customActive ? "true" : undefined}
                >
                  Custom
                </span>
              </div>

              <div className="ui-drpc__cal">
                <div className="ui-drpc__nav">
                  <button
                    type="button"
                    className="ui-drpc__icon-btn"
                    aria-label="Previous month"
                    onClick={() => stepMonths(-1)}
                  >
                    <svg viewBox="0 0 24 24" className="ui-drpc__glyph" aria-hidden="true">
                      <path d="M14.5 6l-6 6 6 6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="ui-drpc__icon-btn"
                    aria-label="Next month"
                    onClick={() => stepMonths(1)}
                  >
                    <svg viewBox="0 0 24 24" className="ui-drpc__glyph" aria-hidden="true">
                      <path d="M9.5 6l6 6-6 6" />
                    </svg>
                  </button>
                </div>

                <div
                  className="ui-drpc__months"
                  data-dir={dir}
                  key={viewMonth.getTime()}
                  onKeyDown={onGridKeyDown}
                  onMouseLeave={() => setHover(null)}
                >
                  {renderMonth(viewMonth, false)}
                  {renderMonth(addMonths(viewMonth, 1), true)}
                </div>
              </div>
            </div>
          </div>

          <div className="ui-drpc__foot">
            <div className="ui-drpc__summary">
              <div className="ui-drpc__summary-range">
                <span>{summary}</span>
                {dayCount > 0 ? (
                  <span className="ui-drpc__count">
                    {dayCount === 1 ? "1 day" : `${dayCount} days`}
                  </span>
                ) : null}
              </div>

              {compare ? (
                <div className="ui-drpc__compare">
                  <span className="ui-drpc__compare-label">Compare</span>
                  <div className="ui-drpc__segments" role="radiogroup" aria-label="Compare to">
                    {COMPARE_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={mode === option.id}
                        className="ui-drpc__segment"
                        onClick={() => setMode(option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="ui-drpc__fold" data-open={comparison ? "true" : undefined}>
                <div>
                  {comparison ? (
                    <div className="ui-drpc__compare-range">{rangeLabel(comparison)}</div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="ui-drpc__buttons">
              <button type="button" className="ui-drpc__btn" onClick={() => closePanel()}>
                Cancel
              </button>
              <button
                type="button"
                className="ui-drpc__btn ui-drpc__btn-primary"
                disabled={!draft.start || !draft.end}
                onClick={apply}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const css = /* css */ `
.ui-drpc{--ui-drpc-card: #fffdfb;--ui-drpc-ink: rgba(11, 9, 8, 0.88);--ui-drpc-strong: #0b0908;--ui-drpc-text: rgba(11, 9, 8, 0.61);--ui-drpc-muted: rgba(11, 9, 8, 0.45);--ui-drpc-faint: rgba(11, 9, 8, 0.27);--ui-drpc-icon: rgba(11, 9, 8, 0.447);--ui-drpc-line: rgba(11, 9, 8, 0.06);--ui-drpc-wash: rgba(11, 9, 8, 0.03);--ui-drpc-fill: rgba(11, 9, 8, 0.06);--ui-drpc-fill-strong: rgba(11, 9, 8, 0.1);--ui-drpc-chip: rgba(11, 9, 8, 0.88);--ui-drpc-chip-hover: rgba(11, 9, 8, 0.78);--ui-drpc-on-chip: #fcf9f7;--ui-drpc-band: rgba(11, 9, 8, 0.06);--ui-drpc-band-preview: rgba(11, 9, 8, 0.04);--ui-drpc-compare: rgba(217, 84, 31, 0.08);--ui-drpc-compare-edge: rgba(217, 84, 31, 0.4);--ui-drpc-accent: rgba(217, 84, 31, 0.765);--ui-drpc-today-on-chip: #ff8a5c;--ui-drpc-focus: rgba(217, 84, 31, 0.35);--ui-drpc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-drpc-shadow-hover: 0 0 0 0.5px rgba(11, 9, 8, 0.12), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-drpc-shadow-pop: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 12px 28px -10px rgba(11, 9, 8, 0.16), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-drpc-ease: cubic-bezier(0.22, 1, 0.36, 1);--ui-drpc-spring: cubic-bezier(0.34, 1.56, 0.64, 1);position: relative;display: inline-block;max-width: 100%;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;font-weight: 400;color: var(--ui-drpc-ink);-webkit-font-smoothing: antialiased}
.ui-drpc *, .ui-drpc *::before, .ui-drpc *::after{box-sizing: border-box}
:where(.ui-drpc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
:where(.ui-drpc) svg{display: block;flex: none}
.ui-drpc button:focus-visible{outline: 2px solid var(--ui-drpc-focus);outline-offset: 1px}
.ui-drpc__glyph{width: 16px;height: 16px;fill: none;stroke: currentColor;stroke-width: 1.65;stroke-linecap: round;stroke-linejoin: round}
.ui-drpc__trigger{display: inline-flex;align-items: center;overflow: hidden;max-width: 100%;height: 32px;padding: 0 8px;border-radius: 8px;background: var(--ui-drpc-card);box-shadow: var(--ui-drpc-shadow);text-align: left;transition: box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), width var(--nm-dur-4, 380ms) var(--ui-drpc-ease)}
.ui-drpc__trigger:hover{box-shadow: var(--ui-drpc-shadow-hover)}
.ui-drpc__trigger-inner{display: inline-flex;flex: none;align-items: center;gap: 8px;max-width: calc(100vw - 56px);color: var(--ui-drpc-icon)}
.ui-drpc__trigger-text{display: flex;align-items: baseline;gap: 6px;min-width: 0;white-space: nowrap;animation: ui-drpc-in 240ms var(--ui-drpc-ease) both}
.ui-drpc__trigger-range{flex: 0 0 auto;max-width: 100%;overflow: hidden;color: var(--ui-drpc-ink);font-weight: 500;text-overflow: ellipsis}
.ui-drpc__trigger-compare{flex: 0 1 auto;min-width: 0;overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-drpc-muted);text-overflow: ellipsis}
.ui-drpc__chevron{transition: transform var(--nm-dur-3, 240ms) var(--ui-drpc-ease)}
.ui-drpc[data-open] .ui-drpc__chevron{transform: rotate(180deg)}
.ui-drpc__panel{position: absolute;z-index: 30;top: calc(100% + 6px);left: 0;container-type: inline-size;width: var(--ui-drpc-panel-width, min(652px, calc(100vw - 32px)));overflow: hidden;border-radius: 10px;background: var(--ui-drpc-card);box-shadow: var(--ui-drpc-shadow-pop);transform-origin: top left;animation: ui-drpc-open 240ms var(--ui-drpc-ease) both}
.ui-drpc__clip{overflow: hidden;transition: height var(--nm-dur-4, 380ms) var(--ui-drpc-ease)}
.ui-drpc__body{display: grid;grid-template-columns: 140px 1fr}
.ui-drpc__presets{position: relative;display: flex;flex-direction: column;gap: 2px;padding: 4px;border-right: 0.5px solid var(--ui-drpc-line)}
.ui-drpc__preset{display: flex;align-items: center;flex: none;height: 28px;padding: 0 10px;border-radius: 6px;text-align: left;white-space: nowrap;font-weight: 500;color: var(--ui-drpc-text);transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
button.ui-drpc__preset:hover:not([aria-selected="true"]){background: var(--ui-drpc-wash);color: var(--ui-drpc-ink)}
.ui-drpc__preset[aria-selected="true"], .ui-drpc__preset-custom[data-active]{background: var(--ui-drpc-fill);color: var(--ui-drpc-ink)}
.ui-drpc__preset-custom{margin-top: auto;color: var(--ui-drpc-faint);cursor: default}
.ui-drpc__cal{position: relative;padding: 10px 12px 10px;overflow: hidden}
.ui-drpc__nav{position: absolute;top: 10px;left: 12px;right: 12px;z-index: 1;display: flex;justify-content: space-between;pointer-events: none}
.ui-drpc__nav > *{pointer-events: auto}
.ui-drpc__icon-btn{display: grid;place-items: center;width: 28px;height: 28px;border-radius: 6px;color: var(--ui-drpc-icon);transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-drpc__icon-btn:hover{background: var(--ui-drpc-wash);color: var(--ui-drpc-ink)}
.ui-drpc__months{display: grid;grid-template-columns: repeat(2, auto);justify-content: center;gap: 24px;animation: ui-drpc-slide var(--nm-dur-4, 380ms) var(--ui-drpc-ease) both}
.ui-drpc__months[data-dir="-1"]{animation-name: ui-drpc-slide-back}
.ui-drpc__month-name{height: 28px;margin-bottom: 4px;font-weight: 500;line-height: 28px;text-align: center;color: var(--ui-drpc-strong)}
.ui-drpc__grid{display: grid;gap: 2px}
.ui-drpc__weekdays, .ui-drpc__week{display: grid;grid-template-columns: repeat(7, 32px)}
.ui-drpc__weekday{height: 24px;font-size: 10px;font-weight: 500;line-height: 24px;letter-spacing: 0.5px;text-transform: uppercase;text-align: center;color: var(--ui-drpc-muted)}
.ui-drpc__day{position: relative;display: grid;height: 32px}
.ui-drpc__day::before{content: "";position: absolute;inset: 2px 0;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), border-radius var(--nm-dur-3, 240ms) var(--ui-drpc-ease), left var(--nm-dur-3, 240ms) var(--ui-drpc-ease), right var(--nm-dur-3, 240ms) var(--ui-drpc-ease)}
.ui-drpc__day[data-range]::before{background: var(--ui-drpc-band)}
.ui-drpc__day[data-preview]::before{background: var(--ui-drpc-band-preview)}
.ui-drpc__day[data-compare]::before{background: var(--ui-drpc-compare)}
.ui-drpc__day[data-start]::before, .ui-drpc__day[data-compare-start]::before, .ui-drpc__day[data-row-start]::before{left: 2px;border-top-left-radius: 6px;border-bottom-left-radius: 6px}
.ui-drpc__day[data-end]::before, .ui-drpc__day[data-compare-end]::before, .ui-drpc__day[data-row-end]::before{right: 2px;border-top-right-radius: 6px;border-bottom-right-radius: 6px}
.ui-drpc__day button{position: relative;margin: 2px;border-radius: 6px;font-size: 13px;line-height: 20px;font-variant-numeric: tabular-nums;color: var(--ui-drpc-ink);transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 160ms var(--ui-drpc-ease)}
.ui-drpc__day button:hover:not(:disabled){background: var(--ui-drpc-fill)}
.ui-drpc__day button:active:not(:disabled){transform: scale(0.94)}
.ui-drpc__day button:disabled{color: var(--ui-drpc-faint);cursor: default}
.ui-drpc__day button[aria-current="date"]{color: var(--ui-drpc-accent);font-weight: 500}
.ui-drpc__day button[aria-current="date"]::after{content: "";position: absolute;left: 50%;bottom: 3px;width: 4px;height: 4px;margin-left: -2px;border-radius: 50%;background: var(--ui-drpc-accent)}
.ui-drpc__day[data-start] button, .ui-drpc__day[data-end] button{background: var(--ui-drpc-chip) !important;color: var(--ui-drpc-on-chip);font-weight: 500;box-shadow: none !important;animation: ui-drpc-pick 380ms var(--ui-drpc-spring)}
.ui-drpc__day[data-start] button[aria-current="date"]::after, .ui-drpc__day[data-end] button[aria-current="date"]::after{background: var(--ui-drpc-today-on-chip)}
.ui-drpc__day[data-preview][data-end] button{animation: none}
.ui-drpc__day[data-compare-start] button, .ui-drpc__day[data-compare-end] button{box-shadow: inset 0 0 0 0.5px var(--ui-drpc-compare-edge)}
.ui-drpc__day-empty::before{display: none}
.ui-drpc__foot{display: flex;align-items: flex-end;justify-content: space-between;gap: 12px;padding: 10px 10px 10px 14px;border-top: 0.5px solid var(--ui-drpc-line)}
.ui-drpc__summary{display: grid;gap: 8px;min-width: 0}
.ui-drpc__summary-range{display: flex;align-items: baseline;gap: 8px;min-width: 0;white-space: nowrap;color: var(--ui-drpc-strong);font-weight: 500}
.ui-drpc__summary-range > span:first-child{min-width: 0;overflow: hidden;text-overflow: ellipsis;animation: ui-drpc-in 240ms var(--ui-drpc-ease) both}
.ui-drpc__count{flex: none;font-size: 12px;line-height: 16px;font-weight: 400;font-variant-numeric: tabular-nums;color: var(--ui-drpc-muted);animation: ui-drpc-in 240ms var(--ui-drpc-ease) both}
.ui-drpc__compare{display: flex;align-items: center;gap: 8px}
.ui-drpc__compare-label{font-size: 12px;line-height: 16px;color: var(--ui-drpc-muted)}
.ui-drpc__segments{display: inline-flex;flex-wrap: wrap;gap: 4px}
.ui-drpc__segment{padding: 4px 10px;border-radius: 6px;box-shadow: inset 0 0 0 0.5px var(--ui-drpc-line);font-weight: 500;white-space: nowrap;color: var(--ui-drpc-text);transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-drpc__segment:hover:not([aria-checked="true"]){background: var(--ui-drpc-wash);color: var(--ui-drpc-ink)}
.ui-drpc__segment[aria-checked="true"]{background: var(--ui-drpc-fill);color: var(--ui-drpc-ink)}
.ui-drpc__fold{display: grid;grid-template-rows: 0fr;opacity: 0;margin-top: -8px;transition: grid-template-rows var(--nm-dur-3, 240ms) var(--ui-drpc-ease), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), margin-top var(--nm-dur-3, 240ms) var(--ui-drpc-ease)}
.ui-drpc__fold[data-open]{grid-template-rows: 1fr;opacity: 1;margin-top: 0}
.ui-drpc__fold > div{min-height: 0;overflow: hidden}
.ui-drpc__compare-range{display: flex;align-items: center;gap: 6px;font-size: 12px;line-height: 16px;color: var(--ui-drpc-muted);animation: ui-drpc-in var(--nm-dur-3, 240ms) var(--ui-drpc-ease) both}
.ui-drpc__compare-range::before{content: "";flex: none;width: 14px;height: 8px;border-radius: 3px;background: var(--ui-drpc-compare);box-shadow: inset 0 0 0 0.5px var(--ui-drpc-compare-edge)}
.ui-drpc__buttons{display: flex;flex: none;gap: 8px}
.ui-drpc__btn{display: inline-flex;align-items: center;height: 28px;padding: 0 10px;border-radius: 6px;background: var(--ui-drpc-card);box-shadow: var(--ui-drpc-shadow);font-weight: 500;color: var(--ui-drpc-strong);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-drpc__btn:not(.ui-drpc__btn-primary):hover{box-shadow: var(--ui-drpc-shadow-hover)}
.ui-drpc__btn-primary{background: var(--ui-drpc-chip);box-shadow: none;color: var(--ui-drpc-on-chip)}
.ui-drpc__btn-primary:hover:not(:disabled){background: var(--ui-drpc-chip-hover)}
.ui-drpc__btn:active:not(:disabled){transform: scale(0.97)}
.ui-drpc__btn-primary:disabled{opacity: 0.35;cursor: default}
@keyframes ui-drpc-open{from{opacity: 0;transform: translateY(-4px) scale(0.98)}
to{opacity: 1;transform: none}
}
@keyframes ui-drpc-slide{from{opacity: 0;transform: translateX(14px)}
to{opacity: 1;transform: none}
}
@keyframes ui-drpc-slide-back{from{opacity: 0;transform: translateX(-14px)}
to{opacity: 1;transform: none}
}
@keyframes ui-drpc-in{from{opacity: 0;transform: translateY(3px)}
to{opacity: 1;transform: none}
}
@keyframes ui-drpc-pick{0%{transform: scale(0.82)}
60%{transform: scale(1.06)}
100%{transform: scale(1)}
}
@container (max-width: 600px){.ui-drpc__body{grid-template-columns: 1fr}
.ui-drpc__presets{flex-direction: row;gap: 4px;padding: 8px;overflow-x: auto;border-right: 0;border-bottom: 0.5px solid var(--ui-drpc-line);scrollbar-width: none}
.ui-drpc__presets::-webkit-scrollbar{display: none}
.ui-drpc__preset{height: auto;padding: 4px 10px;box-shadow: inset 0 0 0 0.5px var(--ui-drpc-line)}
.ui-drpc__preset-custom{display: none}
.ui-drpc__months{grid-template-columns: 1fr;justify-items: center}
.ui-drpc__month:not([data-second]){display: none}
.ui-drpc__foot{flex-direction: column;align-items: stretch;padding: 10px 10px 10px 12px}
.ui-drpc__buttons{justify-content: flex-end}
.ui-drpc__compare{flex-wrap: wrap}
}
@container (max-width: 340px){.ui-drpc__weekdays, .ui-drpc__week{grid-template-columns: repeat(7, 1fr)}
.ui-drpc__cal{padding: 10px 8px}
.ui-drpc__nav{left: 8px;right: 8px}
.ui-drpc__months{justify-items: stretch}
}
@media (hover: none) and (pointer: coarse){.ui-drpc__trigger{height: 40px}
.ui-drpc__day{height: 40px}
.ui-drpc__weekdays, .ui-drpc__week{grid-template-columns: repeat(7, minmax(0, 40px))}
.ui-drpc__icon-btn{width: 36px;height: 36px}
.ui-drpc__month-name{height: 36px;line-height: 36px}
.ui-drpc__preset{height: 36px}
.ui-drpc__btn{height: 36px;padding: 0 14px}
.ui-drpc__segment{padding: 8px 12px}
}
@media (prefers-reduced-motion: reduce){.ui-drpc *, .ui-drpc *::before, .ui-drpc *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-drpc{--ui-drpc-card: #211b16;--ui-drpc-ink: rgba(255, 253, 251, 0.9);--ui-drpc-strong: #fffdfb;--ui-drpc-text: rgba(255, 253, 251, 0.62);--ui-drpc-muted: rgba(255, 253, 251, 0.46);--ui-drpc-faint: rgba(255, 253, 251, 0.3);--ui-drpc-icon: rgba(255, 253, 251, 0.5);--ui-drpc-line: rgba(255, 253, 251, 0.08);--ui-drpc-wash: rgba(255, 253, 251, 0.04);--ui-drpc-fill: rgba(255, 253, 251, 0.08);--ui-drpc-fill-strong: rgba(255, 253, 251, 0.13);--ui-drpc-chip: rgba(255, 253, 251, 0.9);--ui-drpc-chip-hover: rgba(255, 253, 251, 0.8);--ui-drpc-on-chip: #181310;--ui-drpc-band: rgba(255, 253, 251, 0.08);--ui-drpc-band-preview: rgba(255, 253, 251, 0.05);--ui-drpc-compare: rgba(255, 138, 92, 0.14);--ui-drpc-compare-edge: rgba(255, 138, 92, 0.55);--ui-drpc-accent: #ff8a5c;--ui-drpc-today-on-chip: #d9541f;--ui-drpc-focus: rgba(255, 138, 92, 0.5);--ui-drpc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-drpc-shadow-hover: 0 0 0 0.5px rgba(255, 253, 251, 0.18), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-drpc-shadow-pop: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 12px 28px -10px rgba(11, 9, 8, 0.6), 0 1px 2px 0 rgba(11, 9, 8, 0.4)}

`;
