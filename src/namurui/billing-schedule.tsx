"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

/*
 * Billing Schedule – one phase of billing, priced as you build it, in a single self-contained file.
 * The header names the phase and reads out the window: start date → milestone or end date. Below, the
 * duration opens a listbox that goes from a single milestone up to twelve months. The table holds the
 * product lines – each with its repeat rhythm and whether it is billed in advance or in arrears – plus an
 * optional discount and an optional minimum commitment, all editable in place. Adding a line slides the
 * rows in and the frame glides to its new height; totals follow every keystroke.
 * Below 500px of its own width the fields stack, the repeats column folds away and the totals drop under
 * the buttons. The styles are injected below, so no extra files are needed.
 */

export type RepeatId = "once" | "monthly" | "quarterly" | "yearly";

export type Timing = "advance" | "arrears";

export type DurationId = "milestone" | "1m" | "3m" | "6m" | "12m";

export type RepeatOption = {
  id: RepeatId;
  label: string;
  /** Charges per year; 0 for a one-off */
  perYear: number;
};

export type DurationOption = {
  id: DurationId;
  label: string;
  /** Length of the phase in months; 0 for a milestone */
  months: number;
};

export type ProductLine = {
  /** Stable id */
  id: string;
  kind: "product";
  /** What is being sold */
  name: string;
  repeat: RepeatId;
  /** Amount charged per repeat */
  price: number;
  timing: Timing;
};

export type DiscountLine = {
  /** Stable id */
  id: string;
  kind: "discount";
  /** Shown in the row and on the remove button */
  name: string;
  /** Percent off the whole phase, 0–100 */
  percent: number;
};

export type MinimumLine = {
  /** Stable id */
  id: string;
  kind: "minimum";
  name: string;
  /** Floor for the phase total */
  amount: number;
};

export type ScheduleLine = ProductLine | DiscountLine | MinimumLine;

/** Fields a row can edit in place – each kind reads only the ones it owns */
type LinePatch = {
  name?: string;
  repeat?: RepeatId;
  price?: number;
  timing?: Timing;
  percent?: number;
  amount?: number;
};

export type CatalogItem = {
  name: string;
  repeat: RepeatId;
  price: number;
};

/** What the builder reports as the user edits */
export type ScheduleValue = {
  phase: string;
  /** ISO date, e.g. "2026-01-01" */
  start: string;
  duration: DurationId;
  lines: ScheduleLine[];
};

export type BillingScheduleProps = {
  /** Heading above the phase summary */
  title?: string;
  /** Currency symbol in front of every amount */
  currency?: string;
  /** Products offered by the Add product menu */
  catalog?: CatalogItem[];
  /** Controlled schedule; omit to let the builder keep its own */
  value?: ScheduleValue;
  /** Phase name the builder starts with when uncontrolled */
  defaultPhase?: string;
  /** Phase start, ISO date */
  defaultStart?: string;
  /** How long the phase runs */
  defaultDuration?: DurationId;
  /** Lines the phase starts with */
  defaultLines?: ScheduleLine[];
  /** Called with the whole schedule on the first render and on every change */
  onChange?: (value: ScheduleValue) => void;
  /** Extra class on the root */
  className?: string;
};

export const DURATIONS: DurationOption[] = [
  { id: "milestone", label: "Milestone", months: 0 },
  { id: "1m", label: "1 month", months: 1 },
  { id: "3m", label: "3 months", months: 3 },
  { id: "6m", label: "6 months", months: 6 },
  { id: "12m", label: "12 months", months: 12 },
];

export const REPEATS: RepeatOption[] = [
  { id: "once", label: "Once", perYear: 0 },
  { id: "monthly", label: "Monthly", perYear: 12 },
  { id: "quarterly", label: "Quarterly", perYear: 4 },
  { id: "yearly", label: "Yearly", perYear: 1 },
];

const DEFAULT_CATALOG: CatalogItem[] = [
  { name: "Set-up fee", repeat: "once", price: 4999 },
  { name: "Platform licence", repeat: "monthly", price: 1200 },
  { name: "Premium support", repeat: "monthly", price: 350 },
  { name: "Extra seats (10)", repeat: "monthly", price: 240 },
  { name: "Onboarding workshop", repeat: "once", price: 1500 },
];

const DEFAULT_LINES: ScheduleLine[] = [
  { id: "seed-1", kind: "product", name: "Set-up fee", repeat: "once", price: 4999, timing: "advance" },
];

/** Ids for lines added while the page is open */
let nextLine = 0;
const lineId = () => `l${++nextLine}`;

export function BillingSchedule({
  title = "Create a billing schedule",
  currency = "$",
  catalog = DEFAULT_CATALOG,
  value,
  defaultPhase = "Build-out phase",
  defaultStart = "2026-01-01",
  defaultDuration = "milestone",
  defaultLines = DEFAULT_LINES,
  onChange,
  className,
}: BillingScheduleProps) {
  const [inner, setInner] = useState<ScheduleValue>({
    phase: defaultPhase,
    start: defaultStart,
    duration: defaultDuration,
    lines: defaultLines,
  });
  const [open, setOpen] = useState<"duration" | "product" | null>(null);
  const rowsInner = useRef<HTMLDivElement>(null);
  const rowsOuter = useSmoothHeight(rowsInner);

  const schedule = value ?? inner;
  const { phase, start, lines } = schedule;
  const durationId = schedule.duration;

  const commit = (next: ScheduleValue) => {
    if (value === undefined) setInner(next);
    onChange?.(next);
  };

  /* Hand the parent the starting schedule once, so it can price it before the first edit */
  const announced = useRef(false);
  useEffect(() => {
    if (announced.current) return;
    announced.current = true;
    onChange?.(schedule);
  }, [onChange, schedule]);

  const duration = DURATIONS.find((option) => option.id === durationId) ?? DURATIONS[0];
  const end = (() => {
    if (!duration.months) return "Milestone";
    const date = new Date(`${start}T12:00:00`);
    if (Number.isNaN(date.getTime())) return "–";
    date.setMonth(date.getMonth() + duration.months);
    date.setDate(date.getDate() - 1);
    return formatDate(date.toISOString().slice(0, 10));
  })();

  const changeLine = (id: string, patch: LinePatch) =>
    commit({
      ...schedule,
      lines: lines.map((line) => {
        if (line.id !== id) return line;
        if (line.kind === "product") {
          return {
            ...line,
            name: patch.name ?? line.name,
            repeat: patch.repeat ?? line.repeat,
            price: patch.price ?? line.price,
            timing: patch.timing ?? line.timing,
          };
        }
        if (line.kind === "discount") {
          return { ...line, name: patch.name ?? line.name, percent: patch.percent ?? line.percent };
        }
        return { ...line, name: patch.name ?? line.name, amount: patch.amount ?? line.amount };
      }),
    });

  const removeLine = (id: string) => commit({ ...schedule, lines: lines.filter((line) => line.id !== id) });

  const addProduct = (item: CatalogItem) => {
    commit({
      ...schedule,
      lines: [
        ...lines.filter((line) => line.kind === "product"),
        { id: lineId(), kind: "product", name: item.name, repeat: item.repeat, price: item.price, timing: "advance" },
        ...lines.filter((line) => line.kind !== "product"),
      ],
    });
    setOpen(null);
  };

  const hasDiscount = lines.some((line) => line.kind === "discount");
  const hasMinimum = lines.some((line) => line.kind === "minimum");
  const products = lines.filter((line): line is ProductLine => line.kind === "product");
  const discount = lines.find((line): line is DiscountLine => line.kind === "discount");
  const minimum = lines.find((line): line is MinimumLine => line.kind === "minimum");

  const discountFactor = 1 - (discount?.percent ?? 0) / 100;
  const firstInvoice = products
    .filter((line) => line.timing === "advance")
    .reduce((sum, line) => sum + line.price, 0) * discountFactor;
  const months = duration.months || 1;
  const phaseSubtotal =
    products.reduce((sum, line) => {
      const perYear = REPEATS.find((repeat) => repeat.id === line.repeat)?.perYear ?? 0;
      return sum + (perYear ? line.price * Math.max(1, Math.round((perYear * months) / 12)) : line.price);
    }, 0) * discountFactor;
  const phaseTotal = Math.max(phaseSubtotal, minimum?.amount ?? 0);

  return (
    <div className={["ui-bsc", className].filter(Boolean).join(" ")}>
      <style href="ui-billing-schedule" precedence="default">
        {css}
      </style>

      <div className="ui-bsc__head">
        <p className="ui-bsc__title">{title}</p>
        <div className="ui-bsc__summary">
          <input
            className="ui-bsc__phase"
            value={phase}
            onChange={(event) => commit({ ...schedule, phase: event.target.value })}
            aria-label="Phase name"
            size={Math.max(6, phase.length)}
          />
          <span className="ui-bsc__dot" aria-hidden="true">
            ·
          </span>
          <span className="ui-bsc__date">{formatDate(start)}</span>
          <Icon d={ARROW} />
          <span className="ui-bsc__end">{end}</span>
        </div>
      </div>

      <div className="ui-bsc__fields">
        <label className="ui-bsc__field">
          <span className="ui-bsc__label">Start date</span>
          <span className="ui-bsc__input">
            <input
              type="date"
              value={start}
              onChange={(event) => commit({ ...schedule, start: event.target.value })}
            />
            <Icon d={CALENDAR} />
          </span>
        </label>
        <div className="ui-bsc__field">
          <span className="ui-bsc__label" id="ui-bsc-duration">
            Duration
          </span>
          <Dropdown
            open={open === "duration"}
            onOpenChange={(next) => setOpen(next ? "duration" : null)}
            label={duration.label}
            labelledBy="ui-bsc-duration"
          >
            {DURATIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={option.id === durationId}
                onClick={() => {
                  commit({ ...schedule, duration: option.id });
                  setOpen(null);
                }}
              >
                {option.label}
                {option.id === durationId && <Icon d={CHECK} />}
              </button>
            ))}
          </Dropdown>
        </div>
      </div>

      <div className="ui-bsc__table" role="table" aria-label="Billing lines">
        <div className="ui-bsc__row ui-bsc__row--head" role="row">
          <span role="columnheader">Name</span>
          <span role="columnheader">Repeats</span>
          <span role="columnheader" className="ui-bsc__right">
            Price
          </span>
        </div>
        <div className="ui-bsc__rows-outer" ref={rowsOuter}>
          <div ref={rowsInner}>
            {lines.length === 0 && <p className="ui-bsc__empty">No products yet – add one below.</p>}
            {lines.map((line) => (
              <div key={line.id} className="ui-bsc__row" role="row" data-kind={line.kind}>
                <span role="cell" className="ui-bsc__name">
                  {line.kind !== "product" && (
                    <span className="ui-bsc__tag" aria-hidden="true">
                      <Icon d={line.kind === "discount" ? DISCOUNT : MINIMUM} />
                    </span>
                  )}
                  <span className="ui-bsc__name-text">{line.name}</span>
                </span>
                <span role="cell">
                  {line.kind === "product" ? (
                    <label className="ui-bsc__repeat">
                      <Icon d={LOOP} />
                      <select
                        value={line.repeat}
                        onChange={(event) => changeLine(line.id, { repeat: event.target.value as RepeatId })}
                        aria-label={`${line.name} repeats`}
                      >
                        {REPEATS.map((repeat) => (
                          <option key={repeat.id} value={repeat.id}>
                            {repeat.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <span className="ui-bsc__muted">{line.kind === "discount" ? "Whole phase" : "Per phase"}</span>
                  )}
                </span>
                <span role="cell" className="ui-bsc__price">
                  <span className="ui-bsc__price-main">
                    {line.kind === "product" && (
                      <Fragment>
                        <MoneyInput
                          value={line.price}
                          prefix={currency}
                          onChange={(price) => changeLine(line.id, { price })}
                          label={`${line.name} price`}
                        />
                        <span className="ui-bsc__muted">
                          /{" "}
                          {line.repeat === "once"
                            ? "once"
                            : (REPEATS.find((repeat) => repeat.id === line.repeat)?.label ?? "").toLowerCase().replace("ly", "")}
                        </span>
                      </Fragment>
                    )}
                    {line.kind === "discount" && (
                      <Fragment>
                        <MoneyInput
                          value={line.percent}
                          suffix="%"
                          max={100}
                          onChange={(percent) => changeLine(line.id, { percent })}
                          label="Discount percent"
                        />
                        <span className="ui-bsc__muted">off</span>
                      </Fragment>
                    )}
                    {line.kind === "minimum" && (
                      <Fragment>
                        <MoneyInput
                          value={line.amount}
                          prefix={currency}
                          onChange={(amount) => changeLine(line.id, { amount })}
                          label="Minimum commitment"
                        />
                        <span className="ui-bsc__muted">minimum</span>
                      </Fragment>
                    )}
                    <button
                      type="button"
                      className="ui-bsc__remove"
                      aria-label={`Remove ${line.name}`}
                      onClick={() => removeLine(line.id)}
                    >
                      <Icon d={REMOVE} />
                    </button>
                  </span>
                  {line.kind === "product" && (
                    <select
                      className="ui-bsc__timing"
                      value={line.timing}
                      onChange={(event) => changeLine(line.id, { timing: event.target.value as Timing })}
                      aria-label={`${line.name} billed`}
                    >
                      <option value="advance">Billed in advance</option>
                      <option value="arrears">Billed in arrears</option>
                    </select>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ui-bsc__actions">
        <Dropdown
          open={open === "product"}
          onOpenChange={(next) => setOpen(next ? "product" : null)}
          label={
            <Fragment>
              <Icon d={PLUS} />
              Add product
            </Fragment>
          }
          button
          up
        >
          {catalog.map((item) => (
            <button key={item.name} type="button" role="option" aria-selected={false} onClick={() => addProduct(item)}>
              <span>
                {item.name}
                <small>
                  {formatMoney(currency, item.price)} · {(REPEATS.find((repeat) => repeat.id === item.repeat)?.label ?? "").toLowerCase()}
                </small>
              </span>
            </button>
          ))}
        </Dropdown>
        <span className="ui-bsc__spacer" />
        <button
          type="button"
          className="ui-bsc__btn"
          disabled={hasDiscount}
          onClick={() =>
            commit({
              ...schedule,
              lines: [...lines, { id: lineId(), kind: "discount", name: "Discount", percent: 10 }],
            })
          }
        >
          <Icon d={DISCOUNT} />
          Add discount
        </button>
        <button
          type="button"
          className="ui-bsc__btn"
          disabled={hasMinimum}
          onClick={() =>
            commit({
              ...schedule,
              lines: [...lines, { id: lineId(), kind: "minimum", name: "Minimum commitment", amount: 10000 }],
            })
          }
        >
          <Icon d={MINIMUM} />
          Add minimum
        </button>
      </div>

      <div className="ui-bsc__totals" aria-live="polite">
        <span className="ui-bsc__total">
          <span className="ui-bsc__total-label">First invoice</span>
          <b>{formatMoney(currency, firstInvoice)}</b>
        </span>
        <span className="ui-bsc__total ui-bsc__total--phase">
          {minimum && phaseSubtotal < minimum.amount && <em>Minimum applies</em>}
          <span className="ui-bsc__total-label">
            {duration.months ? `Phase total (${duration.label})` : "Phase total"}
          </span>
          <b>{formatMoney(currency, phaseTotal)}</b>
        </span>
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */

/** Amount with the currency in front, two decimals */
function formatMoney(currency: string, value: number): string {
  return `${currency}${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "2026-01-01" → "1 Jan 2026", or an en dash when the date is empty */
function formatDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? "–"
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Amount field that shows a formatted value, edits raw digits and clamps on blur */
function MoneyInput({
  value,
  onChange,
  prefix,
  suffix,
  max,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  max?: number;
  label: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? value.toLocaleString("en-US", { minimumFractionDigits: suffix ? 0 : 2, maximumFractionDigits: 2 });

  return (
    <span className="ui-bsc__num">
      {prefix}
      <input
        value={display}
        inputMode="decimal"
        aria-label={label}
        size={Math.max(2, display.length)}
        onFocus={() => setDraft(String(value))}
        onChange={(event) => setDraft(event.target.value.replace(/[^\d.]/g, ""))}
        onBlur={() => {
          onChange(Math.max(0, Math.min(max ?? Number.POSITIVE_INFINITY, parseFloat(draft ?? "") || 0)));
          setDraft(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      {suffix}
    </span>
  );
}

/** Select-like button with a floating listbox that closes on outside pointerdown or Escape */
function Dropdown({
  open,
  onOpenChange,
  label,
  labelledBy,
  button,
  up,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: ReactNode;
  labelledBy?: string;
  /** Render the trigger as an action button instead of a field */
  button?: boolean;
  /** Open upwards – for a trigger sitting low in the card */
  up?: boolean;
  children: ReactNode;
}) {
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div className="ui-bsc__dd" ref={wrap}>
      <button
        type="button"
        className={button ? "ui-bsc__btn" : "ui-bsc__select"}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelledBy}
        onClick={() => onOpenChange(!open)}
      >
        <span className="ui-bsc__select-label">{label}</span>
        {!button && <Icon d={CHEVRON} />}
      </button>
      {open && (
        <div className="ui-bsc__menu" role="listbox" data-up={up ? "" : undefined}>
          {children}
        </div>
      )}
    </div>
  );
}

/** Keeps the outer box at the inner box's height, with a transition after the first frame */
function useSmoothHeight(inner: RefObject<HTMLDivElement | null>) {
  const outer = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const box = outer.current;
    const content = inner.current;
    if (!box || !content) return;
    const sync = () => {
      box.style.height = `${content.offsetHeight}px`;
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(content);
    const frame = requestAnimationFrame(() => box.setAttribute("data-smooth", ""));
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [inner]);
  return outer;
}

/* ---------- Icons ---------- */

const ARROW = "M5 12h14m0 0-5-5m5 5-5 5";
const CALENDAR = "M7 4v3M17 4v3M4.5 9.5h15M6 6h12a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1 6 6Z";
const CHEVRON = "m7 10 5 5 5-5";
const CHECK = "m6 12.5 4 4 8-9";
const LOOP = "M17 3.5 19.5 6 17 8.5M19.5 6H9a5 5 0 0 0-5 5M7 20.5 4.5 18 7 15.5M4.5 18H15a5 5 0 0 0 5-5";
const DISCOUNT =
  "M9 15 15 9M9.5 9.5h.01M14.5 14.5h.01M12 3l2.1 1.6 2.6-.2.9 2.5 2.3 1.2-.4 2.6L21 12.6l-1.5 2.1.4 2.6-2.3 1.2-.9 2.5-2.6-.2L12 21.4l-2.1-1.6-2.6.2-.9-2.5L4.1 16.3l.4-2.6L3 12l1.5-2.1-.4-2.6 2.3-1.2.9-2.5 2.6.2Z";
const MINIMUM = "M5 19.5h14M7 15.5h10M9 11.5h6M10 7.5h4M12 4v1";
const PLUS = "M12 5.5v13M5.5 12h13";
const REMOVE = "M7 7l10 10M17 7 7 17";

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const css = /* css */ `
.ui-bsc{--ui-bsc-card: #fffdfb;--ui-bsc-ink: rgba(11, 9, 8, 0.88);--ui-bsc-strong: #0b0908;--ui-bsc-text: rgba(11, 9, 8, 0.61);--ui-bsc-muted: rgba(11, 9, 8, 0.45);--ui-bsc-faint: rgba(11, 9, 8, 0.27);--ui-bsc-icon: rgba(11, 9, 8, 0.447);--ui-bsc-line: rgba(11, 9, 8, 0.06);--ui-bsc-wash: rgba(11, 9, 8, 0.03);--ui-bsc-fill: rgba(11, 9, 8, 0.06);--ui-bsc-accent: rgba(217, 84, 31, 0.765);--ui-bsc-pick: rgba(217, 84, 31, 0.05);--ui-bsc-pick-edge: rgba(217, 84, 31, 0.35);--ui-bsc-focus: rgba(217, 84, 31, 0.35);--ui-bsc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-bsc-shadow-hover: 0 0 0 0.5px rgba(11, 9, 8, 0.12), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-bsc-shadow-pop: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 12px 28px -10px rgba(11, 9, 8, 0.16), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-bsc-ease: cubic-bezier(0.22, 1, 0.36, 1);position: relative;box-sizing: border-box;container-type: inline-size;width: 100%;max-width: 560px;border-radius: 10px;background: var(--ui-bsc-card);box-shadow: var(--ui-bsc-shadow);font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;font-weight: 400;color: var(--ui-bsc-ink);-webkit-font-smoothing: antialiased}
.ui-bsc *, .ui-bsc *::before, .ui-bsc *::after{box-sizing: border-box}
:where(.ui-bsc) button, :where(.ui-bsc) select, :where(.ui-bsc) input{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit}
:where(.ui-bsc) button{cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-bsc button:focus-visible, .ui-bsc select:focus-visible{outline: 2px solid var(--ui-bsc-focus);outline-offset: 1px}
.ui-bsc svg{display: block;width: 16px;height: 16px;flex: none;fill: none;stroke: currentColor;stroke-width: 1.65;stroke-linecap: round;stroke-linejoin: round}
.ui-bsc__head{display: grid;gap: 2px;padding: 14px 14px 12px}
.ui-bsc__title{margin: 0;font-size: 15px;line-height: 24px;font-weight: 500;color: var(--ui-bsc-strong)}
.ui-bsc__summary{display: flex;align-items: center;gap: 6px;min-width: 0;color: var(--ui-bsc-text);white-space: nowrap}
.ui-bsc__phase{min-width: 0;max-width: 100%;margin-left: -4px;padding: 0 4px;border-radius: 5px;font-weight: 500;color: var(--ui-bsc-ink);outline: none;text-overflow: ellipsis;field-sizing: content;transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-bsc__phase:hover{background: var(--ui-bsc-wash)}
.ui-bsc__phase:focus{background: var(--ui-bsc-pick);box-shadow: inset 0 0 0 0.5px var(--ui-bsc-pick-edge)}
.ui-bsc__dot{color: var(--ui-bsc-faint)}
.ui-bsc__summary svg{width: 14px;height: 14px;color: var(--ui-bsc-faint)}
.ui-bsc__end{animation: ui-bsc-fade var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-bsc__fields{display: grid;grid-template-columns: 1fr 1fr;gap: 10px;padding: 0 14px 14px}
.ui-bsc__field{display: grid;gap: 6px;min-width: 0}
.ui-bsc__label{font-size: 12px;line-height: 16px;color: var(--ui-bsc-text)}
.ui-bsc__input, .ui-bsc__select{position: relative;display: flex;align-items: center;justify-content: space-between;gap: 8px;width: 100%;height: 32px;padding: 0 8px 0 10px;border-radius: 8px;background: var(--ui-bsc-card);box-shadow: var(--ui-bsc-shadow);color: var(--ui-bsc-ink);text-align: left;transition: box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-bsc__select:hover, .ui-bsc__input:hover{box-shadow: var(--ui-bsc-shadow-hover)}
.ui-bsc__input input{flex: 1;min-width: 0;height: 100%;outline: none;font-variant-numeric: tabular-nums}
.ui-bsc__input input::-webkit-calendar-picker-indicator{position: absolute;inset: 0;width: auto;height: auto;opacity: 0;cursor: pointer}
.ui-bsc__input svg{color: var(--ui-bsc-icon);pointer-events: none}
.ui-bsc__input:focus-within{outline: 2px solid var(--ui-bsc-focus);outline-offset: 1px}
.ui-bsc__select svg{color: var(--ui-bsc-icon);transition: transform var(--nm-dur-3, 240ms) var(--ui-bsc-ease)}
.ui-bsc__select[aria-expanded="true"] svg{transform: rotate(180deg)}
.ui-bsc__select--accent{background: var(--ui-bsc-pick);box-shadow: inset 0 0 0 0.5px var(--ui-bsc-pick-edge)}
.ui-bsc__dd{position: relative}
.ui-bsc__menu{position: absolute;top: calc(100% + 6px);left: 0;right: 0;z-index: 5;display: grid;gap: 1px;min-width: 220px;padding: 4px;border-radius: 10px;background: var(--ui-bsc-card);box-shadow: var(--ui-bsc-shadow-pop);animation: ui-bsc-menu var(--nm-dur-2, 160ms) var(--ui-bsc-ease) both;transform-origin: top}
.ui-bsc__menu[data-up]{top: auto;bottom: calc(100% + 6px);right: auto;transform-origin: bottom left}
.ui-bsc__menu button{display: flex;align-items: center;justify-content: space-between;gap: 10px;min-height: 28px;padding: 4px 8px;border-radius: 6px;text-align: left;color: var(--ui-bsc-ink);transition: background-color 90ms ease-out}
.ui-bsc__menu button:hover{background: var(--ui-bsc-fill)}
.ui-bsc__menu button svg{color: var(--ui-bsc-accent)}
.ui-bsc__menu small{display: block;font-size: 12px;line-height: 16px;color: var(--ui-bsc-muted)}
.ui-bsc__table{border-top: 0.5px solid var(--ui-bsc-line)}
.ui-bsc__row{display: grid;grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr) 216px;align-items: center;gap: 12px;min-height: 48px;padding: 6px 10px 6px 14px;border-bottom: 0.5px solid var(--ui-bsc-line);transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));animation: ui-bsc-row var(--nm-dur-4, 380ms) var(--ui-bsc-ease) both}
.ui-bsc__rows-outer .ui-bsc__row:hover{background: var(--ui-bsc-wash)}
.ui-bsc__row--head{min-height: 32px;padding-top: 8px;padding-bottom: 8px;font-size: 10px;line-height: 16px;font-weight: 500;letter-spacing: 0.5px;text-transform: uppercase;color: var(--ui-bsc-muted);animation: none}
.ui-bsc__right{text-align: right;padding-right: 36px}
.ui-bsc__rows-outer{overflow: hidden}
.ui-bsc__rows-outer[data-smooth]{transition: height var(--nm-dur-4, 380ms) var(--ui-bsc-ease)}
.ui-bsc__empty{margin: 0;padding: 14px;border-bottom: 0.5px solid var(--ui-bsc-line);color: var(--ui-bsc-muted)}
.ui-bsc__name{display: flex;align-items: center;gap: 8px;min-width: 0;font-weight: 500;color: var(--ui-bsc-ink)}
.ui-bsc__name-text{min-width: 0;overflow: hidden;text-overflow: ellipsis;white-space: nowrap}
.ui-bsc__tag{display: grid;place-items: center;width: 20px;height: 20px;flex: none;border-radius: 5px;background: var(--ui-bsc-fill);color: var(--ui-bsc-icon)}
.ui-bsc__tag svg{width: 14px;height: 14px}
.ui-bsc__muted{font-size: 12px;line-height: 16px;color: var(--ui-bsc-muted);white-space: nowrap}
.ui-bsc__repeat{position: relative;display: inline-flex;align-items: center;gap: 4px;color: var(--ui-bsc-icon)}
.ui-bsc__repeat select{color: var(--ui-bsc-text)}
.ui-bsc__repeat select, .ui-bsc__timing{height: 24px;padding: 0 6px;border-radius: 6px;appearance: none;cursor: pointer;transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-bsc__repeat select:hover, .ui-bsc__timing:hover{background: var(--ui-bsc-fill);color: var(--ui-bsc-ink)}
.ui-bsc__timing{height: 20px;margin: 0 30px 0 0;padding: 0 4px;font-size: 12px;line-height: 16px;color: var(--ui-bsc-muted);text-align: right}
.ui-bsc__price{display: grid;justify-items: end;min-width: 0}
.ui-bsc__price-main{display: flex;align-items: center;gap: 4px;white-space: nowrap}
.ui-bsc__num{display: inline-flex;align-items: center;font-weight: 500;color: var(--ui-bsc-ink);font-variant-numeric: tabular-nums}
.ui-bsc__num input{height: 24px;padding: 0 1px;border-radius: 5px;outline: none;font-weight: 500;text-align: right;font-variant-numeric: tabular-nums;field-sizing: content;min-width: 2ch;transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-bsc__num input:hover{background: var(--ui-bsc-fill)}
.ui-bsc__num input:focus{background: var(--ui-bsc-pick);box-shadow: inset 0 0 0 0.5px var(--ui-bsc-pick-edge)}
.ui-bsc__remove{display: grid;place-items: center;width: 28px;height: 28px;margin-left: 2px;border-radius: 6px;color: var(--ui-bsc-icon);opacity: 0;transition: opacity var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-bsc__row:hover .ui-bsc__remove, .ui-bsc__remove:focus-visible{opacity: 1}
.ui-bsc__remove:hover{background: var(--ui-bsc-wash);color: var(--ui-bsc-ink)}
.ui-bsc__actions{display: flex;align-items: center;gap: 8px;padding: 10px 14px 12px}
.ui-bsc__spacer{flex: 1}
.ui-bsc__btn{display: inline-flex;align-items: center;gap: 6px;height: 28px;padding: 0 10px 0 8px;border-radius: 6px;background: var(--ui-bsc-card);box-shadow: var(--ui-bsc-shadow);font-weight: 500;color: var(--ui-bsc-strong);white-space: nowrap;transition: box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-bsc__btn:hover:not(:disabled){box-shadow: var(--ui-bsc-shadow-hover)}
.ui-bsc__btn:active:not(:disabled){transform: scale(0.97)}
.ui-bsc__btn:disabled{opacity: 0.4;cursor: default}
.ui-bsc__btn svg{color: var(--ui-bsc-icon)}
.ui-bsc__select-label{display: inline-flex;align-items: center;gap: 6px;min-width: 0}
.ui-bsc__totals{display: flex;align-items: center;justify-content: space-between;gap: 6px 16px;flex-wrap: wrap;padding: 10px 14px;border-top: 0.5px solid var(--ui-bsc-line)}
.ui-bsc__total{display: inline-flex;align-items: baseline;gap: 8px;min-width: 0;white-space: nowrap}
.ui-bsc__total-label{font-size: 12px;line-height: 16px;color: var(--ui-bsc-muted)}
.ui-bsc__total b{font-size: 15px;line-height: 24px;font-weight: 500;color: var(--ui-bsc-strong);font-variant-numeric: tabular-nums}
.ui-bsc__total em{align-self: center;padding: 2px 6px;border-radius: 5px;background: var(--ui-bsc-pick);font-size: 11px;line-height: 16px;font-style: normal;font-weight: 500;color: var(--ui-bsc-accent);animation: ui-bsc-fade var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
@keyframes ui-bsc-fade{from{opacity: 0}
}
@keyframes ui-bsc-row{from{opacity: 0;transform: translateY(-4px)}
}
@keyframes ui-bsc-menu{from{opacity: 0;transform: scale(0.97) translateY(-4px)}
}
@container (max-width: 500px){.ui-bsc__fields{grid-template-columns: 1fr}
.ui-bsc__summary{flex-wrap: wrap;row-gap: 0}
.ui-bsc__row{grid-template-columns: minmax(0, 1fr);gap: 2px;padding: 10px 8px 10px 14px}
.ui-bsc__row > :nth-child(2){display: none}
.ui-bsc__row--head{display: none}
.ui-bsc__price{justify-items: stretch}
.ui-bsc__price-main{justify-content: flex-start}
.ui-bsc__num{margin-left: -2px}
.ui-bsc__timing{justify-self: start;margin: 0 0 0 -4px}
.ui-bsc__remove{opacity: 1;margin-left: auto}
.ui-bsc__actions{flex-wrap: wrap}
.ui-bsc__spacer{display: none}
.ui-bsc__totals{flex-direction: column;align-items: stretch}
.ui-bsc__total{justify-content: space-between}
.ui-bsc__total--phase .ui-bsc__total-label{margin-right: auto;order: -1}
}
@media (hover: none) and (pointer: coarse){.ui-bsc__input, .ui-bsc__select{height: 40px}
.ui-bsc__btn{height: 36px;padding: 0 12px 0 10px}
.ui-bsc__menu button{min-height: 40px}
.ui-bsc__remove{width: 36px;height: 36px;opacity: 1}
.ui-bsc__repeat select{height: 32px}
.ui-bsc__num input{height: 32px}
}
@media (prefers-reduced-motion: reduce){.ui-bsc__rows-outer[data-smooth]{transition: none}
.ui-bsc__row, .ui-bsc__menu, .ui-bsc__end, .ui-bsc__total em{animation: none}
}
.ui-bsc input:not([type="checkbox"]):not([type="radio"]):focus-visible, .ui-bsc textarea:focus-visible, .ui-bsc [contenteditable]:focus-visible{outline: none}
:where(.dark, [data-theme="dark"]) .ui-bsc{--ui-bsc-card: #211b16;--ui-bsc-ink: rgba(255, 253, 251, 0.9);--ui-bsc-strong: #fffdfb;--ui-bsc-text: rgba(255, 253, 251, 0.62);--ui-bsc-muted: rgba(255, 253, 251, 0.46);--ui-bsc-faint: rgba(255, 253, 251, 0.3);--ui-bsc-icon: rgba(255, 253, 251, 0.5);--ui-bsc-line: rgba(255, 253, 251, 0.08);--ui-bsc-wash: rgba(255, 253, 251, 0.04);--ui-bsc-fill: rgba(255, 253, 251, 0.08);--ui-bsc-accent: #ff8a5c;--ui-bsc-pick: rgba(255, 138, 92, 0.14);--ui-bsc-pick-edge: rgba(255, 138, 92, 0.5);--ui-bsc-focus: rgba(255, 138, 92, 0.5);--ui-bsc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-bsc-shadow-hover: 0 0 0 0.5px rgba(255, 253, 251, 0.18), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-bsc-shadow-pop: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 12px 28px -10px rgba(11, 9, 8, 0.6), 0 1px 2px 0 rgba(11, 9, 8, 0.4)}
:where(.dark, [data-theme="dark"]) .ui-bsc__input input{color-scheme: dark}
:where(.dark, [data-theme="dark"]) .ui-bsc select option{background: #211b16;color: rgba(255, 253, 251, 0.9)}

`;
