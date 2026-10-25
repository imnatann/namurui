"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

/*
 * Usage Meter – what a plan has spent and what is left, in a single self-contained file.
 * A stacked bar splits the credits by category; hovering a legend row (or arrowing through the
 * bar) dims the other segments and floats a small label above the one being read. Thin meters
 * below carry the hard limits, the sparkline carries the days so far and reads them one at a time
 * on the arrow keys, and the quiet button turns solid and changes its words as the total nears
 * the cap. The card measures its own content, so switching periods rolls the height rather than
 * snapping, and the pill behind the period switch is measured onto the checked option.
 * The styles are injected below, so no extra files are needed.
 */

export type UsageState = "ok" | "warn" | "limit";

export type UsageMeterCategory = {
  /** Stable key */
  id: string;
  /** Legend label and tooltip title */
  label: string;
  /** Credits spent in this period */
  value: number;
};

export type UsageMeterLimit = {
  /** Stable key */
  id: string;
  /** Name above the number, e.g. "Seats" */
  label: string;
  /** Amount in use */
  used: number;
  /** Cap; null renders the hatched unlimited track */
  total: number | null;
  /** Unit after the numbers, e.g. "GB" */
  unit?: string;
  /** Fraction digits for both numbers – 1 gives "3.2 of 5 GB" */
  decimals?: number;
};

export type UsageMeterDay = {
  /** Day read out while stepping, e.g. "Nov 4" */
  label: string;
  /** Credits that day; null for a day still to come */
  value: number | null;
};

export type UsageMeterPeriod = {
  id: string;
  /** Text on the option, e.g. "This month" */
  label: string;
};

export type UsageMeterProps = {
  /** Card title – the workspace or product the plan belongs to */
  title: string;
  /** Plan line beside the reset, e.g. "Pro plan" */
  plan?: string;
  /** When the credits reset; drives "Resets in 9 days" */
  resetAt?: Date | string | number;
  /** Credits included in the plan – the full width of the bar */
  total: number;
  /** What the credits went into, in bar and legend order */
  categories: UsageMeterCategory[];
  /** Thin meters under the legend; leave out for none */
  limits?: UsageMeterLimit[];
  /** Days for the sparkline, oldest first; null values are days still to come */
  daily?: UsageMeterDay[];
  /** Options of the period switch; no switch when left out */
  periods?: UsageMeterPeriod[];
  /** Controlled period id */
  period?: string;
  /** Period shown on first render when uncontrolled */
  defaultPeriod?: string;
  onPeriodChange?: (id: string) => void;
  /** Called with the current state when the button is pressed */
  onAction?: (state: UsageState) => void;
  /** Word counted in the bar and the read-outs */
  unit?: string;
  /** Button text while there is room */
  actionLabel?: string;
  /** Button text once the plan is close to spent */
  actionNearLimitLabel?: string;
  /** Share of the total (0–1) from which the meter and the limits warn */
  warnAt?: number;
  /** Extra class on the root */
  className?: string;
};

/* `ui-umc-c1` … `ui-umc-c5` are the five shades the sheet carries */
const shade = (index: number) => `var(--ui-umc-c${(index % 5) + 1})`;

const number = (value: number) => value.toLocaleString("en-US");

/* One decimal at most, so 39.8% stays 39.8% and 80% does not become 80.0% */
const widthOf = (value: number, total: number) => (total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0);

function resetStamp(resetAt: Date | string | number): { iso: string; title: string; short: string } | null {
  const date = resetAt instanceof Date ? resetAt : new Date(resetAt);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  // Whole calendar days, so "in 9 days" does not flip with the hour of the day
  const days = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86400000,
  );
  const on = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const short =
    days <= 0 ? "Resets today" : days === 1 ? "Resets tomorrow" : `Resets in ${days}\u00a0days`;
  return { iso: date.toISOString(), title: `Resets on ${on}`, short };
}

export function UsageMeter({
  title,
  plan,
  resetAt,
  total,
  categories,
  limits = [],
  daily: days = [],
  periods,
  period,
  defaultPeriod,
  onPeriodChange,
  onAction,
  unit = "credits",
  actionLabel = "Upgrade",
  actionNearLimitLabel = "Add credits",
  warnAt = 0.8,
  className,
}: UsageMeterProps) {
  const titleId = useId();
  const options = periods ?? [];
  const [innerPeriod, setInnerPeriod] = useState(defaultPeriod ?? options[0]?.id ?? "");
  const shown = period ?? innerPeriod;

  const [active, setActive] = useState<number | null>(null);
  const [dayIndex, setDayIndex] = useState<number | null>(null);
  const [announce, setAnnounce] = useState("");
  const [regrow, setRegrow] = useState(true);
  const [pill, setPill] = useState({ x: 0, y: 0, w: 0, h: 0, ready: false });

  const cardRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const switchRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const actionInnerRef = useRef<HTMLSpanElement>(null);

  const used = categories.reduce((sum, category) => sum + category.value, 0);
  const share = total > 0 ? used / total : 0;
  const state: UsageState = share >= 1 ? "limit" : share >= warnAt ? "warn" : "ok";
  const pct = Math.round(share * 100);
  const remaining = Math.max(0, total - used);
  const reset = resetAt === undefined ? null : resetStamp(resetAt);

  const top = Math.max(1, ...days.map((day) => day.value ?? 0));
  const elapsed = days.reduce((last, day, index) => (day.value !== null ? index : last), -1);
  const avg = elapsed >= 0 ? Math.round(used / (elapsed + 1)) : 0;
  const signature = days.map((day) => day.value ?? "-").join(",");

  const activeIndex = active !== null && categories[active] ? active : null;
  const activeCategory = activeIndex === null ? null : categories[activeIndex];
  const activeShare =
    activeCategory && used > 0 ? Math.round((activeCategory.value / used) * 100) : 0;
  const activeCentre =
    activeCategory && total > 0
      ? ((categories
          .slice(0, activeIndex ?? 0)
          .reduce((sum, category) => sum + category.value, 0) +
          activeCategory.value / 2) /
          total) *
        100
      : 50;
  const tipLeft = Math.min(92, Math.max(8, activeCentre));
  const tipAnchor = activeCentre < 8 ? "0%" : activeCentre > 92 ? "-100%" : "-50%";

  const activeDay = dayIndex !== null ? days[dayIndex] : undefined;
  const buttonLabel = state === "ok" ? actionLabel : actionNearLimitLabel;

  // Let the bars rise again whenever the days change, then drop the flag so the resting DOM is clean
  useEffect(() => {
    setRegrow(true);
    setDayIndex(null);
    const timer = window.setTimeout(() => setRegrow(false), 700 + days.length * 18);
    return () => window.clearTimeout(timer);
  }, [signature, days.length]);

  // Announce a plan that has moved into the amber or the red on its own
  useEffect(() => {
    if (state === "limit") setAnnounce(`No ${unit} left on this plan`);
    else if (state === "warn") setAnnounce(`${pct}% of the ${unit} used`);
    else setAnnounce("");
  }, [state, pct, unit]);

  // The card holds its content tightly so the height can glide between periods
  useLayoutEffect(() => {
    const inner = innerRef.current;
    const card = cardRef.current;
    if (!inner || !card) return;
    const apply = () => {
      const height = Math.round(inner.getBoundingClientRect().height);
      if (height > 0 && card.style.height !== `${height}px`) card.style.height = `${height}px`;
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  // The pill is slid onto whichever option is checked
  useLayoutEffect(() => {
    const host = switchRef.current;
    if (!host) return;
    const place = () => {
      const checked = host.querySelector<HTMLElement>('[aria-checked="true"]');
      if (!checked) return;
      const next = {
        x: checked.offsetLeft,
        y: checked.offsetTop,
        w: checked.offsetWidth,
        h: checked.offsetHeight,
        ready: true,
      };
      setPill((prev) =>
        prev.ready &&
        prev.x === next.x &&
        prev.y === next.y &&
        prev.w === next.w &&
        prev.h === next.h
          ? prev
          : next,
      );
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(host);
    return () => observer.disconnect();
  }, [shown, options.length]);

  // The button carries its own width so a change of words glides instead of jumping
  useLayoutEffect(() => {
    const button = actionRef.current;
    const inner = actionInnerRef.current;
    if (!button || !inner) return;
    const apply = () => {
      const width = Math.round(inner.getBoundingClientRect().width);
      if (width > 0 && button.style.width !== `${width}px`) button.style.width = `${width}px`;
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [buttonLabel]);

  const pickPeriod = (id: string) => {
    if (period === undefined) setInnerPeriod(id);
    onPeriodChange?.(id);
  };

  const movePeriod = (step: 1 | -1) => {
    if (options.length < 2) return;
    const index = options.findIndex((option) => option.id === shown);
    const next = (index + step + options.length) % options.length;
    pickPeriod(options[next].id);
    switchRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };

  const readCategory = (index: number) => {
    const category = categories[index];
    if (!category) return;
    setActive(index);
    setAnnounce(
      `${category.label}: ${number(category.value)} ${unit}, ${used > 0 ? Math.round((category.value / used) * 100) : 0}%`,
    );
  };

  const readDay = (index: number) => {
    const day = days[index];
    if (!day) return;
    setDayIndex(index);
    setAnnounce(day.value === null ? `${day.label}: no usage yet` : `${day.label}: ${number(day.value)} ${unit}`);
  };

  const onBarKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      if (categories.length === 0) return;
      const step = event.key === "ArrowRight" ? 1 : -1;
      const from = active ?? (step === 1 ? -1 : categories.length);
      readCategory(Math.max(0, Math.min(categories.length - 1, from + step)));
    } else if (event.key === "Escape") {
      setActive(null);
      setAnnounce("");
    }
  };

  const onSparkKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (days.length === 0) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const step = event.key === "ArrowRight" ? 1 : -1;
      const from = dayIndex ?? (step === 1 ? elapsed : 0);
      readDay(Math.max(0, Math.min(days.length - 1, from + step)));
    } else if (event.key === "Escape") {
      setDayIndex(null);
      setAnnounce("");
    }
  };

  return (
    <section
      className={["ui-umc", className].filter(Boolean).join(" ")}
      aria-labelledby={`${titleId}-title`}
      data-state={state}
    >
      <style href="ui-usage-meter" precedence="default">
        {css}
      </style>

      <div className="ui-umc__card" ref={cardRef}>
        <div className="ui-umc__inner" ref={innerRef}>
          <header className="ui-umc__head">
            <div className="ui-umc__heading">
              <h3 id={`${titleId}-title`} className="ui-umc__title">
                {title}
              </h3>
              <p className="ui-umc__sub">
                {plan}
                {plan && reset ? <span className="ui-umc__sep">·</span> : null}
                {reset ? (
                  <time dateTime={reset.iso} title={reset.title}>
                    {reset.short}
                  </time>
                ) : null}
              </p>
            </div>

            {options.length ? (
              <div className="ui-umc__switch" role="radiogroup" aria-label="Period" ref={switchRef}>
                <span
                  className="ui-umc__pill"
                  aria-hidden="true"
                  data-ready={pill.ready ? "1" : undefined}
                  style={{
                    opacity: pill.ready ? 1 : 0,
                    width: pill.ready ? pill.w : undefined,
                    height: pill.ready ? pill.h : undefined,
                    transform: `translate(${pill.x}px, ${pill.y}px)`,
                  }}
                />
                {options.map((option) => {
                  const checked = option.id === shown;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      tabIndex={checked ? 0 : -1}
                      className="ui-umc__option"
                      onClick={() => pickPeriod(option.id)}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                          event.preventDefault();
                          movePeriod(1);
                        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                          event.preventDefault();
                          movePeriod(-1);
                        }
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </header>

          <div className="ui-umc__figure">
            <p className="ui-umc__amount">
              <span className="ui-umc__big">{number(used)}</span>
              <span className="ui-umc__of">
                of {number(total)}
                {"\u00a0"}
                {unit}
              </span>
            </p>
            <span className="ui-umc__pct" data-state={state}>
              {state === "ok" ? null : <span className="ui-umc__dot" aria-hidden="true" />}
              {pct}%
            </span>
          </div>

          <div
            className="ui-umc__bar"
            tabIndex={0}
            role="group"
            aria-label={`${number(used)} of ${number(total)} ${unit} used – arrow keys read each category`}
            data-active={activeIndex === null ? undefined : "true"}
            onKeyDown={onBarKey}
            onBlur={() => setActive(null)}
          >
            <div
              className="ui-umc__track"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={Math.round(used)}
              aria-valuetext={`${number(used)} of ${number(total)} ${unit}`}
            >
              {categories.map((category, index) => (
                <span
                  key={category.id}
                  className="ui-umc__seg"
                  data-active={activeIndex === index ? "true" : undefined}
                  style={{ width: `${widthOf(category.value, total)}%`, background: shade(index) }}
                />
              ))}
            </div>
            <div
              className="ui-umc__tip"
              aria-live="polite"
              data-open={activeCategory ? "true" : undefined}
              style={{ left: `${activeCategory ? tipLeft : 50}%`, "--ui-umc-tip-x": activeCategory ? tipAnchor : "-50%" } as CSSProperties}
            >
              {activeCategory && activeIndex !== null ? (
                <>
                  <span className="ui-umc__tip-label">
                    <span className="ui-umc__swatch" style={{ background: shade(activeIndex) }} />
                    {activeCategory.label}
                  </span>
                  <span className="ui-umc__tip-value">
                    {number(activeCategory.value)}{" "}
                    <span className="ui-umc__muted">{activeShare}%</span>
                  </span>
                </>
              ) : null}
            </div>
          </div>

          <ul
            className="ui-umc__legend"
            aria-label="By category"
            data-active={activeIndex === null ? undefined : "true"}
          >
            {categories.map((category, index) => (
              <li
                key={category.id}
                className="ui-umc__row"
                onPointerEnter={() => setActive(index)}
                onPointerLeave={() => setActive(null)}
              >
                <div className="ui-umc__item" data-active={activeIndex === index ? "true" : undefined}>
                  <span className="ui-umc__swatch" style={{ background: shade(index) }} />
                  <span className="ui-umc__label">{category.label}</span>
                  <span className="ui-umc__value">{number(category.value)}</span>
                  <span className="ui-umc__share">
                    {used > 0 ? Math.round((category.value / used) * 100) : 0}%
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {days.length ? (
            <div className="ui-umc__daily">
              <div className="ui-umc__daily-head">
                <span>Per day</span>
                <span className="ui-umc__daily-read" key={activeDay ? activeDay.label : "avg"}>
                  {activeDay ? (
                    <>
                      {activeDay.label} ·{" "}
                      <b>{activeDay.value === null ? "—" : number(activeDay.value)}</b>
                    </>
                  ) : (
                    <>
                      Avg <b>{number(avg)}</b> / day
                    </>
                  )}
                </span>
              </div>
              <div
                className="ui-umc__spark"
                tabIndex={0}
                role="img"
                aria-label={`${title} per day, ${number(avg)} ${unit} on average – arrow keys read each day`}
                data-few={days.length <= 10 ? "true" : undefined}
                data-hover={dayIndex === null ? undefined : "true"}
                data-regrow={regrow ? "true" : undefined}
                onKeyDown={onSparkKey}
                onFocus={() => {
                  if (dayIndex === null && elapsed >= 0) readDay(elapsed);
                }}
                onBlur={() => setDayIndex(null)}
              >
                {days.map((day, index) => (
                  <span
                    key={`${day.label}-${index}`}
                    className="ui-umc__day"
                    data-future={day.value === null ? "true" : undefined}
                    data-active={dayIndex === index ? "true" : undefined}
                    style={{ "--i": index } as CSSProperties}
                  >
                    <span
                      style={
                        day.value === null
                          ? undefined
                          : { height: `${Number(((day.value / top) * 100).toFixed(4))}%` }
                      }
                    />
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {limits.length ? (
            <ul
              className="ui-umc__limits"
              aria-label="Plan limits"
              style={{ "--n": limits.length } as CSSProperties}
            >
              {limits.map((limit) => {
                const cap = limit.total;
                const ratio = cap === null ? 0 : Math.min(1, limit.used / Math.max(1, cap));
                const limitState: UsageState = ratio >= 1 ? "limit" : ratio >= warnAt ? "warn" : "ok";
                const decimals = limit.decimals ?? 0;
                const usedText = limit.used.toLocaleString("en-US", {
                  minimumFractionDigits: decimals,
                  maximumFractionDigits: decimals,
                });
                // The cap drops trailing zeros – "3.2 of 5 GB", not "3.2 of 5.0 GB"
                const capText = cap === null ? "∞" : number(cap);
                return (
                  <li key={limit.id} className="ui-umc__limit" data-state={limitState}>
                    <span className="ui-umc__limit-label">
                      {limit.label}
                      {limitState === "ok" ? null : (
                        <span
                          className="ui-umc__dot"
                          aria-label={limitState === "limit" ? "At the limit" : "Close to the limit"}
                        />
                      )}
                    </span>
                    <span className="ui-umc__limit-value">
                      {usedText}
                      <span className="ui-umc__muted">
                        {" of "}
                        {capText}
                        {limit.unit ? `\u00a0${limit.unit}` : ""}
                      </span>
                    </span>
                    {cap === null ? (
                      <span
                        className="ui-umc__thin"
                        data-unlimited=""
                        aria-label={`${limit.label}: ${usedText}, unlimited`}
                        role="img"
                      />
                    ) : (
                      <span
                        className="ui-umc__thin"
                        role="meter"
                        aria-label={limit.label}
                        aria-valuemin={0}
                        aria-valuemax={cap}
                        aria-valuenow={limit.used}
                        aria-valuetext={`${usedText} of ${capText}${limit.unit ? `\u00a0${limit.unit}` : ""}`}
                      >
                        <span style={{ width: `${widthOf(limit.used, cap)}%` }} />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="ui-umc__foot">
        <span className="ui-umc__status">
          {state === "ok" ? null : <span className="ui-umc__dot" aria-hidden="true" />}
          <span>
            {state === "limit" ? (
              "Limit reached"
            ) : (
              <>
                {number(remaining)}
                {"\u00a0"}
                {unit} left
              </>
            )}
          </span>
        </span>
        <button
          type="button"
          className="ui-umc__action"
          ref={actionRef}
          data-strong={state === "ok" ? undefined : "true"}
          onClick={() => onAction?.(state)}
        >
          <span className="ui-umc__action-inner" ref={actionInnerRef}>
            <span className="ui-umc__action-text" key={buttonLabel}>
              {buttonLabel}
            </span>
          </span>
        </button>
      </div>

      <span className="ui-umc__live" aria-live="polite">
        {announce}
      </span>
    </section>
  );
}

const css = /* css */ `
.ui-umc{--ui-umc-card: #fffdfb;--ui-umc-strong: #0b0908;--ui-umc-ink: rgba(11, 9, 8, 0.88);--ui-umc-text: rgba(11, 9, 8, 0.61);--ui-umc-muted: rgba(11, 9, 8, 0.45);--ui-umc-faint: rgba(11, 9, 8, 0.27);--ui-umc-line: rgba(11, 9, 8, 0.06);--ui-umc-wash: rgba(11, 9, 8, 0.03);--ui-umc-fill: rgba(11, 9, 8, 0.06);--ui-umc-track: rgba(11, 9, 8, 0.06);--ui-umc-spark: rgba(11, 9, 8, 0.12);--ui-umc-accent: rgba(217, 84, 31, 0.765);--ui-umc-warn: #d99530;--ui-umc-warn-text: #9a6410;--ui-umc-warn-bg: rgba(217, 149, 48, 0.12);--ui-umc-full: #e2544a;--ui-umc-full-text: #b3261e;--ui-umc-full-bg: rgba(226, 84, 74, 0.08);--ui-umc-c1: rgba(217, 84, 31, 0.765);--ui-umc-c2: rgba(217, 84, 31, 0.5);--ui-umc-c3: rgba(217, 84, 31, 0.3);--ui-umc-c4: rgba(217, 84, 31, 0.16);--ui-umc-c5: rgba(11, 9, 8, 0.14);--ui-umc-dark: rgba(11, 9, 8, 0.88);--ui-umc-on-dark: #fcf9f7;--ui-umc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-umc-tip-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 2px 0 rgba(11, 9, 8, 0.05), 0 8px 20px -8px rgba(11, 9, 8, 0.14);--ui-umc-focus: rgba(217, 84, 31, 0.35);--ui-umc-ease: cubic-bezier(0.22, 1, 0.36, 1);box-sizing: border-box;container-type: inline-size;position: relative;display: grid;width: 100%;max-width: 460px;border-radius: 10px;background: var(--ui-umc-card);box-shadow: var(--ui-umc-shadow);font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;font-weight: 400;color: var(--ui-umc-ink);text-align: left;-webkit-font-smoothing: antialiased}
.ui-umc *, .ui-umc *::before, .ui-umc *::after{box-sizing: border-box}
:where(.ui-umc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
:where(.ui-umc) :is(h3, p, ul){margin: 0;padding: 0}
:where(.ui-umc) ul{list-style: none}
.ui-umc :is(button, [tabindex="0"]):focus-visible{outline: 2px solid var(--ui-umc-focus);outline-offset: 1px}
.ui-umc b{font-weight: 500;color: var(--ui-umc-ink)}
.ui-umc__muted{color: var(--ui-umc-muted)}
.ui-umc__card{overflow: hidden;border-radius: 10px 10px 0 0;transition: height var(--nm-dur-4, 380ms) var(--ui-umc-ease)}
.ui-umc__inner{display: flow-root;padding: 16px 16px 16px}
.ui-umc__head{display: flex;align-items: flex-start;justify-content: space-between;gap: 12px}
.ui-umc__heading{min-width: 0}
.ui-umc__title{overflow: hidden;font-size: 15px;font-weight: 500;line-height: 24px;color: var(--ui-umc-strong);white-space: nowrap;text-overflow: ellipsis}
.ui-umc__sub{overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-umc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-umc__sep{margin: 0 6px;color: var(--ui-umc-faint)}
.ui-umc__switch{position: relative;display: grid;grid-auto-columns: auto;grid-auto-flow: column;gap: 8px;flex: none}
.ui-umc__pill{position: absolute;top: 0;left: 0;border-radius: 6px;background: var(--ui-umc-fill);opacity: 0;pointer-events: none;transition: transform var(--nm-dur-4, 380ms) var(--ui-umc-ease), width var(--nm-dur-4, 380ms) var(--ui-umc-ease), height var(--nm-dur-4, 380ms) var(--ui-umc-ease), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-umc__option{position: relative;z-index: 1;min-width: 0;height: 28px;padding: 4px 10px;overflow: hidden;border-radius: 6px;box-shadow: inset 0 0 0 0.5px var(--ui-umc-line);font-size: 13px;font-weight: 500;line-height: 20px;color: var(--ui-umc-text);white-space: nowrap;text-overflow: ellipsis;transition: color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-umc__option[aria-checked="true"]{color: var(--ui-umc-ink)}
@media (hover: hover){.ui-umc__option[aria-checked="false"]:hover{background: var(--ui-umc-wash);color: var(--ui-umc-ink)}
}
.ui-umc__figure{display: flex;align-items: center;justify-content: space-between;gap: 12px;margin-top: 14px}
.ui-umc__amount{display: flex;flex-wrap: wrap;align-items: baseline;column-gap: 8px;min-width: 0}
.ui-umc__big{font-size: 24px;font-weight: 500;line-height: 32px;letter-spacing: -0.24px;color: var(--ui-umc-strong);font-variant-numeric: tabular-nums}
.ui-umc__of{font-size: 12px;line-height: 16px;color: var(--ui-umc-muted);font-variant-numeric: tabular-nums;white-space: nowrap}
.ui-umc__pct{display: inline-flex;flex: none;align-items: center;gap: 5px;height: 20px;padding: 0 6px;border-radius: 5px;background: var(--ui-umc-fill);font-size: 12px;font-weight: 500;line-height: 16px;color: var(--ui-umc-text);font-variant-numeric: tabular-nums;transition: color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-umc__pct[data-state="warn"]{background: var(--ui-umc-warn-bg);color: var(--ui-umc-warn-text)}
.ui-umc__pct[data-state="limit"]{background: var(--ui-umc-full-bg);color: var(--ui-umc-full-text)}
.ui-umc__dot{display: inline-block;flex: none;width: 6px;height: 6px;border-radius: 50%;background: var(--ui-umc-warn);animation: ui-umc-pop var(--nm-dur-4, 380ms) cubic-bezier(0.34, 1.56, 0.64, 1) both}
.ui-umc[data-state="limit"] :is(.ui-umc__pct, .ui-umc__status) .ui-umc__dot, .ui-umc__limit[data-state="limit"] .ui-umc__dot{background: var(--ui-umc-full)}
.ui-umc__bar{position: relative;margin-top: 10px;padding: 4px 0;border-radius: 4px;cursor: default}
.ui-umc__track{display: flex;height: 8px;overflow: hidden;border-radius: 4px;background: var(--ui-umc-track)}
.ui-umc__seg{position: relative;flex: none;height: 100%;overflow: hidden;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-umc__seg::after{content: "";position: absolute;top: 0;right: 0;bottom: 0;width: 2px;background: var(--ui-umc-card)}
.ui-umc__bar[data-active] .ui-umc__seg:not([data-active]){opacity: 0.3}
.ui-umc__tip{position: absolute;bottom: calc(100% + 6px);z-index: 2;display: grid;gap: 2px;padding: 6px 10px 7px;border-radius: 8px;background: var(--ui-umc-card);box-shadow: var(--ui-umc-tip-shadow);white-space: nowrap;pointer-events: none;opacity: 0;transform: translate(var(--ui-umc-tip-x), 4px) scale(0.97);transition: left var(--nm-dur-3, 240ms) var(--ui-umc-ease), transform var(--nm-dur-3, 240ms) var(--ui-umc-ease), opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-umc__tip[data-open]{opacity: 1;transform: translate(var(--ui-umc-tip-x), 0)}
.ui-umc__tip-label{display: flex;align-items: center;gap: 6px;font-size: 12px;line-height: 16px;color: var(--ui-umc-muted)}
.ui-umc__tip-value{font-size: 13px;font-weight: 500;line-height: 20px;color: var(--ui-umc-ink);font-variant-numeric: tabular-nums}
.ui-umc__tip-value .ui-umc__muted{font-weight: 400}
.ui-umc__legend{display: grid;margin-top: 10px}
.ui-umc__row{display: grid;grid-template-rows: 1fr;animation: ui-umc-grow 380ms var(--ui-umc-ease) both;transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-umc-ease) 80ms, opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-umc__row[data-leaving]{grid-template-rows: 0fr;opacity: 0;pointer-events: none}
.ui-umc__item{display: flex;align-items: center;gap: 10px;min-height: 0;height: 32px;margin: 0 -8px;padding: 0 8px;overflow: hidden;border-radius: 6px;transition: background-color var(--nm-dur-1, 90ms) ease-out, opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-umc__row[data-leaving] .ui-umc__item{background: none}
.ui-umc__item[data-active]{background: var(--ui-umc-wash)}
.ui-umc__legend[data-active] .ui-umc__item:not([data-active]){opacity: 0.45}
.ui-umc__swatch{flex: none;width: 8px;height: 8px;border-radius: 2px}
.ui-umc__label{flex: 1;min-width: 0;overflow: hidden;white-space: nowrap;text-overflow: ellipsis;color: var(--ui-umc-ink)}
.ui-umc__value{color: var(--ui-umc-ink);font-weight: 500;font-variant-numeric: tabular-nums}
.ui-umc__share{width: 40px;font-size: 12px;line-height: 16px;text-align: right;color: var(--ui-umc-muted);font-variant-numeric: tabular-nums}
.ui-umc__daily{margin-top: 14px}
.ui-umc__daily-head{display: flex;align-items: center;justify-content: space-between;gap: 12px;font-size: 12px;line-height: 16px;color: var(--ui-umc-muted);white-space: nowrap}
.ui-umc__daily-head > :first-child{font-size: 10px;font-weight: 500;line-height: 16px;letter-spacing: 0.5px;text-transform: uppercase}
.ui-umc__daily-read{font-variant-numeric: tabular-nums;animation: ui-umc-in var(--nm-dur-3, 240ms) var(--ui-umc-ease) both}
.ui-umc__spark{display: flex;align-items: stretch;gap: 2px;height: 32px;margin-top: 8px;border-radius: 4px;cursor: default}
.ui-umc__spark[data-few]{gap: 5px}
.ui-umc__day{display: flex;flex: 1 1 0;align-items: flex-end;min-width: 0}
.ui-umc__day > span{width: 100%;border-radius: 2px;background: var(--ui-umc-spark);transform-origin: bottom;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-umc__spark[data-regrow] .ui-umc__day > span{animation: ui-umc-rise var(--nm-dur-5, 620ms) var(--ui-umc-ease) both;animation-delay: calc(var(--i) * 18ms)}
.ui-umc__day[data-future] > span{height: 2px;background: var(--ui-umc-track)}
.ui-umc__spark[data-hover] .ui-umc__day:not([data-active]) > span{opacity: 0.6}
.ui-umc__day[data-active] > span{background: var(--ui-umc-accent)}
.ui-umc__limits{display: grid;grid-template-columns: repeat(var(--n, 3), minmax(0, 1fr));gap: 12px 18px;margin-top: 16px;padding-top: 14px;border-top: 0.5px solid var(--ui-umc-line)}
.ui-umc__limit{display: grid;grid-template-columns: minmax(0, 1fr);align-content: start;min-width: 0}
.ui-umc__limit-label{display: flex;align-items: center;gap: 6px;min-width: 0;overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-umc-muted);white-space: nowrap}
.ui-umc__limit-value{overflow: hidden;color: var(--ui-umc-ink);font-weight: 500;font-variant-numeric: tabular-nums;white-space: nowrap;text-overflow: ellipsis}
.ui-umc__limit-value .ui-umc__muted{font-weight: 400}
.ui-umc__thin{position: relative;display: block;height: 4px;margin-top: 6px;overflow: hidden;border-radius: 2px;background: var(--ui-umc-track)}
.ui-umc__thin > span{position: absolute;top: 0;bottom: 0;left: 0;border-radius: inherit;background: var(--ui-umc-accent);transition: background-color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-umc__limit[data-state="warn"] .ui-umc__thin > span{background: var(--ui-umc-warn)}
.ui-umc__limit[data-state="limit"] .ui-umc__thin > span{background: var(--ui-umc-full)}
.ui-umc__thin[data-unlimited]{background: repeating-linear-gradient(-45deg, var(--ui-umc-track) 0 3px, transparent 3px 6px)}
.ui-umc__foot{display: flex;align-items: center;justify-content: space-between;gap: 12px;min-height: 44px;padding: 0 8px 0 16px;border-top: 0.5px solid var(--ui-umc-line);font-size: 12px;line-height: 16px;color: var(--ui-umc-muted)}
.ui-umc__status{display: flex;align-items: center;gap: 6px;min-width: 0;overflow: hidden;white-space: nowrap;font-variant-numeric: tabular-nums;animation: ui-umc-in var(--nm-dur-3, 240ms) var(--ui-umc-ease) both}
.ui-umc__status > :last-child{overflow: hidden;text-overflow: ellipsis}
.ui-umc__action{display: inline-flex;flex: none;justify-content: center;height: 28px;overflow: hidden;border-radius: 6px;font-size: 13px;font-weight: 500;line-height: 20px;color: var(--ui-umc-strong);background: var(--ui-umc-card);box-shadow: var(--ui-umc-shadow);transition: background-color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), width var(--nm-dur-4, 380ms) var(--ui-umc-ease), transform var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-umc__action:hover{background: #faf7f4}
.ui-umc__action:active{transform: scale(0.97)}
.ui-umc__action[data-strong]{background: var(--ui-umc-dark);color: var(--ui-umc-on-dark);box-shadow: 0 1px 2px 0 rgba(11, 9, 8, 0.12);animation: ui-umc-nudge var(--nm-dur-5, 620ms) cubic-bezier(0.34, 1.56, 0.64, 1)}
.ui-umc__action[data-strong]:hover{background: var(--ui-umc-dark);opacity: 0.88}
.ui-umc__action-inner{display: inline-flex;align-items: center;flex: none;height: 100%;padding: 0 10px;white-space: nowrap}
.ui-umc__action-text{animation: ui-umc-in var(--nm-dur-3, 240ms) var(--ui-umc-ease) both}
.ui-umc__live{position: absolute;width: 1px;height: 1px;overflow: hidden;clip-path: inset(50%);white-space: nowrap}
@keyframes ui-umc-in{from{opacity: 0;transform: translateY(3px);filter: blur(2px)}
to{opacity: 1;transform: none;filter: none}
}
@keyframes ui-umc-grow{from{grid-template-rows: 0fr;opacity: 0}
to{grid-template-rows: 1fr;opacity: 1}
}
@keyframes ui-umc-rise{from{transform: scaleY(0)}
to{transform: none}
}
@keyframes ui-umc-pop{0%{transform: scale(0.3)}
60%{transform: scale(1.25)}
100%{transform: scale(1)}
}
@keyframes ui-umc-nudge{0%{transform: scale(0.94)}
60%{transform: scale(1.04)}
100%{transform: scale(1)}
}
@container (max-width: 400px){.ui-umc__inner{padding: 14px 14px 14px}
.ui-umc__foot{padding: 0 8px 0 14px}
.ui-umc__head{flex-direction: column;align-items: stretch;gap: 12px}
.ui-umc__switch{grid-auto-columns: minmax(0, auto);gap: 4px}
.ui-umc__option{padding: 4px 8px}
.ui-umc__limits{grid-template-columns: minmax(0, 1fr);gap: 12px}
.ui-umc__limit{grid-template-columns: minmax(0, 1fr) auto;column-gap: 12px}
.ui-umc__limit-value{font-size: 12px;line-height: 16px}
.ui-umc__thin{grid-column: 1 / -1;margin-top: 6px}
}
@container (max-width: 300px){.ui-umc__option{padding: 4px 6px}
.ui-umc__share{width: 34px}
}
@media (hover: none) and (pointer: coarse){.ui-umc__option{height: 34px;padding: 7px 10px}
.ui-umc__item{height: 36px}
.ui-umc__action{height: 36px}
.ui-umc__foot{min-height: 52px}
.ui-umc__bar{padding: 10px 0;margin-top: 4px}
}
@media (prefers-reduced-motion: reduce){.ui-umc *, .ui-umc *::before, .ui-umc *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-umc{--ui-umc-card: #211b16;--ui-umc-strong: #fffdfb;--ui-umc-ink: rgba(255, 253, 251, 0.9);--ui-umc-text: rgba(255, 253, 251, 0.62);--ui-umc-muted: rgba(255, 253, 251, 0.46);--ui-umc-faint: rgba(255, 253, 251, 0.3);--ui-umc-line: rgba(255, 253, 251, 0.08);--ui-umc-wash: rgba(255, 253, 251, 0.04);--ui-umc-fill: rgba(255, 253, 251, 0.08);--ui-umc-track: rgba(255, 253, 251, 0.08);--ui-umc-spark: rgba(255, 253, 251, 0.16);--ui-umc-accent: #ff8a5c;--ui-umc-warn: #e8b05c;--ui-umc-warn-text: #e8b05c;--ui-umc-warn-bg: rgba(217, 149, 48, 0.16);--ui-umc-full: #e2544a;--ui-umc-full-text: #f0938c;--ui-umc-full-bg: rgba(226, 84, 74, 0.14);--ui-umc-c1: #ff8a5c;--ui-umc-c2: rgba(255, 138, 92, 0.62);--ui-umc-c3: rgba(255, 138, 92, 0.4);--ui-umc-c4: rgba(255, 138, 92, 0.22);--ui-umc-c5: rgba(255, 253, 251, 0.16);--ui-umc-dark: rgba(255, 253, 251, 0.9);--ui-umc-on-dark: #181310;--ui-umc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-umc-tip-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 8px 20px -8px rgba(11, 9, 8, 0.6);--ui-umc-focus: rgba(255, 138, 92, 0.5)}
:where(.dark, [data-theme="dark"]) .ui-umc__action:hover{background: #27201a}
:where(.dark, [data-theme="dark"]) .ui-umc__tip{background: #2b231b}

`;
