"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";

/*
 * Pricing Tiers: a four-card pricing block for a marketing page, with a monthly or yearly switch
 * above it. The switch swaps the amount each card shows, a chip carries the yearly discount, and a
 * ribbon sits on the top edge of the plans that need one. Every feature row can carry a help glyph
 * that opens a tooltip on hover and on focus, and each card ends in its own call to action. Cards
 * slide in from the right and below, staggered, and a ribbon pops on the spring curve. The styles
 * are injected below, so no extra files are needed.
 */

export type PlanRibbon = {
  /** Ribbon text, e.g. "Mulai di sini" */
  label: string;
  /** Neutral reads as a note; accent marks the plan the page recommends */
  tone: "neutral" | "accent";
  /** A pill floats above the card edge; a tab sits across it */
  shape?: "pill" | "tab";
};

export type TierFeature = {
  /** The row text, e.g. "150 kontak" */
  text: string;
  /** false renders the muted dash and says so to a screen reader; defaults to true */
  included?: boolean;
  /** Extra detail behind the help glyph; a row without it has no glyph */
  help?: string;
};

export type TierPlan = {
  /** Stable id, used as the key */
  id: string;
  /** Plan name, e.g. "Kecil" */
  name: string;
  /** One line under the name; the card reserves two lines for it so the prices line up */
  subtitle?: string;
  /** Amount shown while the switch is on its first period; a host-supplied string */
  monthly: string;
  /** Amount shown while the switch is on its second period; falls back to monthly */
  yearly?: string;
  /** What the amount is per, e.g. "bulan"; ignored when priceKind is "custom" */
  unit: string;
  /** "custom" drops the unit and shows the amount alone, for a quoted engagement */
  priceKind?: "amount" | "custom";
  /** Small line above the amount, e.g. "Mulai" */
  priceLabel?: string;
  /** One-line clarification under the amount, e.g. "Sekali per akun" */
  note?: string;
  /** Smaller caveat at the foot of the card, above the button */
  caveat?: string;
  /** Badge on the top edge */
  ribbon?: PlanRibbon;
  /** The plan the page recommends: its button takes the accent ground */
  recommended?: boolean;
  /** The included and excluded rows, in order */
  features: TierFeature[];
  /** The button at the foot of the card */
  cta: { label: string; href: string };
};

export type PricingTiersProps = {
  /** The cards, in order */
  plans: TierPlan[];
  /** Small label above the heading */
  eyebrow?: ReactNode;
  /** Section heading */
  title?: ReactNode;
  /** Supporting sentence under the heading */
  lead?: ReactNode;
  /** The line under the switch, explaining the cheapest tier */
  note?: ReactNode;
  /** A centred line under the grid */
  footnote?: ReactNode;
  /** Controlled period; pair it with onPeriodChange */
  period?: "monthly" | "yearly";
  /** Period shown first when period is not controlled */
  defaultPeriod?: "monthly" | "yearly";
  /** Called when the switch moves, whether or not period is controlled */
  onPeriodChange?: (period: "monthly" | "yearly") => void;
  /** The two switch labels, in order */
  periods?: [string, string];
  /** Text of the chip on the second period, e.g. "-16.7%" */
  discountLabel?: string;
  /** Draws the chip while the second period is active */
  discountBadge?: boolean;
  /** Button height: 44px, or 64px for a page whose buttons are the main action */
  ctaSize?: "md" | "lg";
  /** Paints the tinted band behind the grid */
  backdrop?: boolean;
  /** Called with the plan whose button was pressed */
  onSelect?: (plan: TierPlan, period: "monthly" | "yearly") => void;
  /** Extra class on the section */
  className?: string;
};

const DEFAULT_PERIODS: [string, string] = ["Monthly", "Yearly"];

/* A check for an included row, a dash for one that is not. Both are decorative: the row carries
 * the state in its data attribute and in a hidden phrase, so colour is never the only signal. */
function CheckGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8.5 6.4 12 13 4.5" />
    </svg>
  );
}

function DashGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 8h8" />
    </svg>
  );
}

function HelpGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.2" />
      <path d="M6.2 6.3a1.85 1.85 0 1 1 2.55 1.7c-.5.25-.8.62-.8 1.15v.3" />
      <path d="M8 11.7v.3" />
    </svg>
  );
}

export function PricingTiers({
  plans,
  eyebrow,
  title = "Plans that grow with your shop",
  lead = "Start free, then move up when the conversation volume does.",
  note,
  footnote,
  period,
  defaultPeriod = "monthly",
  onPeriodChange,
  periods = DEFAULT_PERIODS,
  discountLabel = "-16.7%",
  discountBadge = true,
  ctaSize = "md",
  backdrop = false,
  onSelect,
  className,
}: PricingTiersProps) {
  const baseId = useId();
  const [internalPeriod, setInternalPeriod] = useState<"monthly" | "yearly">(defaultPeriod);
  const [openHelp, setOpenHelp] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const mounted = useRef(false);

  const active = period ?? internalPeriod;
  const [firstLabel, secondLabel] = periods;

  /* The switch is the only thing that changes the prices, so it is the only thing announced. The
   * first effect run is the mount, and a mount is not a change. */
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setAnnouncement(`${active === "yearly" ? secondLabel : firstLabel}: plan prices updated.`);
  }, [active, firstLabel, secondLabel]);

  /* Escape closes the tooltip and leaves focus on the glyph that opened it. */
  useEffect(() => {
    if (openHelp === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenHelp(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openHelp]);

  const choose = (next: "monthly" | "yearly") => {
    if (period === undefined) setInternalPeriod(next);
    onPeriodChange?.(next);
  };

  return (
    <section
      className={["ui-ptr", className].filter(Boolean).join(" ")}
      data-cta={ctaSize}
      data-backdrop={backdrop ? "true" : undefined}
      aria-labelledby={`${baseId}-title`}
    >
      {/* React 19 hoists this into <head> once, no matter how many blocks render */}
      <style href="ui-pricing-tiers" precedence="default">
        {css}
      </style>

      <div className="ui-ptr__inner">
        <header className="ui-ptr__head">
          {eyebrow ? <p className="ui-ptr__eyebrow">{eyebrow}</p> : null}
          <h2 className="ui-ptr__title" id={`${baseId}-title`}>
            {title}
          </h2>
          {lead ? <p className="ui-ptr__lead">{lead}</p> : null}

          <div className="ui-ptr__switchrow">
            <div className="ui-ptr__switch" role="group" aria-label="Billing period">
              <button
                type="button"
                className="ui-ptr__period"
                aria-pressed={active === "monthly"}
                onClick={() => choose("monthly")}
              >
                {firstLabel}
              </button>
              <button
                type="button"
                className="ui-ptr__period"
                aria-pressed={active === "yearly"}
                onClick={() => choose("yearly")}
              >
                {secondLabel}
                {active === "yearly" && discountBadge ? (
                  <span className="ui-ptr__chip">{discountLabel}</span>
                ) : null}
              </button>
            </div>
            {note ? <p className="ui-ptr__note">{note}</p> : null}
          </div>

          <p className="ui-ptr__status" role="status" aria-live="polite">
            {announcement}
          </p>
        </header>

        <div className="ui-ptr__body">
          {backdrop ? <span className="ui-ptr__band" aria-hidden="true" /> : null}

          {/* The column count is explicit and comes from the plan count: a four-plan set must
           * never fall to three tracks and orphan the fourth card on a row of its own. */}
          <div
            className="ui-ptr__grid"
            style={{ "--ui-ptr-plans": plans.length } as CSSProperties}
          >
            {plans.map((plan, cardIndex) => {
              const amount = active === "yearly" ? plan.yearly ?? plan.monthly : plan.monthly;
              const kind = plan.priceKind ?? "amount";
              const unit = kind === "amount" && plan.unit.trim() !== "" ? plan.unit : null;
              return (
                <article
                  key={plan.id}
                  className="ui-ptr__card"
                  data-recommended={plan.recommended ? "true" : undefined}
                  data-ribbon={plan.ribbon?.shape === "tab" ? "tab" : undefined}
                  style={{ animationDelay: `${cardIndex * 90}ms` }}
                >
                  {plan.ribbon ? (
                    <span
                      className="ui-ptr__ribbon"
                      data-tone={plan.ribbon.tone}
                      data-shape={plan.ribbon.shape ?? "pill"}
                    >
                      <span
                        className="ui-ptr__ribbontext"
                        style={{ animationDelay: `${cardIndex * 90 + 240}ms` }}
                      >
                        {plan.ribbon.label}
                      </span>
                    </span>
                  ) : null}

                  <h3 className="ui-ptr__name">{plan.name}</h3>
                  {plan.subtitle ? <p className="ui-ptr__subtitle">{plan.subtitle}</p> : null}

                  <div className="ui-ptr__priceblock">
                    {plan.priceLabel ? <p className="ui-ptr__pricelabel">{plan.priceLabel}</p> : null}
                    <p className="ui-ptr__price">
                      <span key={active} className="ui-ptr__amount">
                        {amount}
                      </span>
                      {unit ? <span className="ui-ptr__unit">/ {unit}</span> : null}
                    </p>
                    <div className="ui-ptr__pricenote">
                      {plan.note ? <p className="ui-ptr__pricenotetext">{plan.note}</p> : null}
                    </div>
                  </div>

                  <ul className="ui-ptr__features">
                    {plan.features.map((feature, index) => {
                      const included = feature.included !== false;
                      const helpId = `${baseId}-tip-${cardIndex}-${index}`;
                      const open = openHelp === helpId;
                      return (
                        <li
                          key={`${plan.id}-${index}`}
                          className="ui-ptr__feature"
                          data-included={included ? "true" : "false"}
                        >
                          <span className="ui-ptr__mark" aria-hidden="true">
                            {included ? <CheckGlyph /> : <DashGlyph />}
                          </span>
                          <span className="ui-ptr__featuretext">
                            {feature.text}
                            {included ? null : <span className="ui-ptr__sr"> not included</span>}
                          </span>
                          {feature.help ? (
                            <>
                              <button
                                type="button"
                                className="ui-ptr__help"
                                aria-label={`About ${feature.text}`}
                                aria-describedby={open ? helpId : undefined}
                                onPointerEnter={() => setOpenHelp(helpId)}
                                onPointerLeave={() =>
                                  setOpenHelp((current) => (current === helpId ? null : current))
                                }
                                onFocus={() => setOpenHelp(helpId)}
                                onBlur={() =>
                                  setOpenHelp((current) => (current === helpId ? null : current))
                                }
                                onClick={() => setOpenHelp(helpId)}
                              >
                                <HelpGlyph />
                              </button>
                              {open ? (
                                <span className="ui-ptr__tip" id={helpId} role="tooltip">
                                  {feature.help}
                                </span>
                              ) : null}
                            </>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>

                  <div className="ui-ptr__foot">
                    {plan.caveat ? <p className="ui-ptr__caveat">{plan.caveat}</p> : null}
                    <a
                      className="ui-ptr__cta"
                      href={plan.cta.href}
                      data-tone={plan.recommended ? "accent" : "quiet"}
                      onClick={() => onSelect?.(plan, active)}
                    >
                      {plan.cta.label}
                    </a>
                  </div>
                </article>
              );
            })}
          </div>

          {footnote ? <p className="ui-ptr__footnote">{footnote}</p> : null}
        </div>
      </div>
    </section>
  );
}

const css = /* css */ `
.ui-ptr {
  /* Knobs. Override any of these on .ui-ptr to retheme the block in a host. */
  --ui-ptr-ink: var(--text, #1a1410);
  --ui-ptr-muted: var(--text-muted, #6f625a);
  --ui-ptr-feature: var(--text-muted, #6f625a);
  --ui-ptr-surface: var(--panel, #fffdfb);
  --ui-ptr-card: var(--panel, #fffdfb);
  --ui-ptr-line: var(--border, #e8e0d7);
  --ui-ptr-line-strong: #cdbfb1;
  --ui-ptr-edge: var(--border-soft, #1a14101a);
  --ui-ptr-wash: #7a4a1c0d;
  --ui-ptr-band: #7a4a1c08;
  --ui-ptr-accent: var(--accent, #c2410c);
  --ui-ptr-accent-soft: var(--accent-soft, #c2410c1a);
  --ui-ptr-accent-fg: var(--accent-fg, #fffdfb);
  --ui-ptr-accent-lift: var(--accent-hover, #9a3412);
  --ui-ptr-accent-line: #c2410c4d;
  --ui-ptr-neutral-ground: #eae1d8;
  --ui-ptr-neutral-ink: #1a1410;
  --ui-ptr-neutral-line: #d9cec2;
  --ui-ptr-tip: #26201a;
  --ui-ptr-tip-ink: #faf7f4;
  --ui-ptr-lift: 0 1px 2px #1a14100a, 0 18px 40px -28px #1a141026;
  --ui-ptr-focus: var(--accent, #c2410c);

  position: relative;
  box-sizing: border-box;
  width: 100%;
  /* The grid answers the box the block actually sits in, not the viewport: the demo lives in a
   * gallery preview narrower than the page. */
  container-name: ui-ptr;
  container-type: inline-size;
  /* Less air above the head than below the cards: the block is read after something else on the
   * page, and an even split left a dead band between the last element above it and the eyebrow. */
  padding: 40px 16px 56px;
  color: var(--ui-ptr-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-ptr *,
.ui-ptr *::before,
.ui-ptr *::after {
  box-sizing: border-box;
}
.ui-ptr p,
.ui-ptr h2,
.ui-ptr h3,
.ui-ptr ul,
.ui-ptr li {
  margin: 0;
  padding: 0;
}
.ui-ptr ul {
  list-style: none;
}
@media (min-width: 48rem) {
  .ui-ptr {
    padding: 52px 24px 72px;
  }
}
.ui-ptr__inner {
  max-width: 80rem;
  margin-inline: auto;
}

/* Head ------------------------------------------------------------------- */
.ui-ptr__head {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.ui-ptr__eyebrow {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ui-ptr-accent);
}
.ui-ptr__title {
  max-width: 24ch;
  margin-top: 10px;
  font-size: 1.9rem;
  font-weight: 600;
  line-height: 1.12;
  letter-spacing: -0.03em;
  text-wrap: balance;
  color: var(--ui-ptr-ink);
}
.ui-ptr__lead {
  max-width: 38rem;
  margin-top: 16px;
  font-size: 1rem;
  line-height: 1.7;
  color: var(--ui-ptr-muted);
  text-wrap: pretty;
}

/* The switch -------------------------------------------------------------- */
.ui-ptr__switchrow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-top: 28px;
}
.ui-ptr__switch {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 999px;
  background: var(--ui-ptr-wash);
  box-shadow: inset 0 0 0 1px var(--ui-ptr-line);
}
.ui-ptr__period {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  margin: 0;
  padding: 0 16px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--ui-ptr-muted);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: -0.005em;
  white-space: nowrap;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-ptr__period:hover {
  color: var(--ui-ptr-ink);
}
.ui-ptr__period[aria-pressed="true"] {
  background: var(--ui-ptr-surface);
  color: var(--ui-ptr-ink);
  box-shadow: 0 1px 2px #1a14100f, inset 0 0 0 1px var(--ui-ptr-edge);
}
.ui-ptr__period:focus-visible {
  outline: 2px solid var(--ui-ptr-focus);
  outline-offset: 2px;
}
.ui-ptr__chip {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--ui-ptr-accent-soft);
  color: var(--ui-ptr-accent);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}
.ui-ptr__note {
  max-width: 34rem;
  font-size: 12px;
  line-height: 1.6;
  color: var(--ui-ptr-muted);
  text-wrap: pretty;
}
.ui-ptr__status {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  white-space: nowrap;
  border: 0;
  clip-path: inset(50%);
}

/* Grid ------------------------------------------------------------------- */
.ui-ptr__body {
  position: relative;
  margin-top: 40px;
}
.ui-ptr__band {
  position: absolute;
  inset: -24px 0;
  z-index: 0;
  border-radius: var(--radius-panel, 20px);
  background: var(--ui-ptr-band);
  pointer-events: none;
}
.ui-ptr__grid {
  position: relative;
  z-index: 1;
  display: grid;
  /* One rule per step, never an automatic track count: an automatic count can land on three
   * tracks for a four-plan set and leave the fourth card alone on the next row. The wide step
   * uses the plan count itself. */
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
}
@container ui-ptr (min-width: 40rem) {
  .ui-ptr__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@container ui-ptr (min-width: 70rem) {
  .ui-ptr__grid {
    grid-template-columns: repeat(var(--ui-ptr-plans, 1), minmax(0, 1fr));
  }
}
.ui-ptr__footnote {
  position: relative;
  z-index: 1;
  max-width: 46rem;
  margin: 24px auto 0;
  font-size: 0.75rem;
  line-height: 1.6;
  text-align: center;
  color: var(--ui-ptr-muted);
  text-wrap: pretty;
}

/* Card ------------------------------------------------------------------- */
.ui-ptr__card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 24px;
  border-radius: var(--radius-card, 16px);
  background: var(--ui-ptr-card);
  box-shadow: inset 0 0 0 1px var(--ui-ptr-line), 0 1px 2px #1a141008;
  /* backwards, not both: the final keyframe must not keep owning the transform, or the hover
   * lift below would never win. */
  animation: ui-ptr-in var(--nm-dur-5, 620ms)
    var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) backwards;
  transition:
    transform var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-ptr__card[data-recommended="true"] {
  box-shadow: inset 0 0 0 1px var(--ui-ptr-accent-line), var(--ui-ptr-lift);
}
.ui-ptr__card[data-ribbon="tab"] {
  padding-top: 30px;
}
@media (hover: hover) {
  .ui-ptr__card:hover {
    transform: translateY(-3px);
    box-shadow: inset 0 0 0 1px var(--ui-ptr-line), var(--ui-ptr-lift);
  }
  .ui-ptr__card[data-recommended="true"]:hover {
    box-shadow: inset 0 0 0 1px var(--ui-ptr-accent-line), var(--ui-ptr-lift);
  }
}
@keyframes ui-ptr-in {
  from {
    opacity: 0;
    transform: translate3d(32px, 24px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

/* Ribbon ----------------------------------------------------------------- */
.ui-ptr__ribbon {
  position: absolute;
  top: -12px;
  left: 50%;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 12px;
  border-radius: 999px;
  transform: translateX(-50%);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  white-space: nowrap;
}
/* A tab is rectangular and straddles the top edge instead of floating above it. */
.ui-ptr__ribbon[data-shape="tab"] {
  top: 0;
  height: 22px;
  border-radius: 4px;
  transform: translate(-50%, -50%);
  font-size: 0.7rem;
}
.ui-ptr__ribbon[data-tone="neutral"] {
  background: var(--ui-ptr-neutral-ground);
  color: var(--ui-ptr-neutral-ink);
  box-shadow: inset 0 0 0 1px var(--ui-ptr-neutral-line);
}
.ui-ptr__ribbon[data-tone="accent"] {
  background: linear-gradient(180deg, var(--ui-ptr-accent), var(--ui-ptr-accent-lift));
  color: var(--ui-ptr-accent-fg);
  box-shadow: 0 1px 2px #1a14101f;
}
.ui-ptr__ribbontext {
  display: block;
  animation: ui-ptr-pop var(--nm-dur-3, 240ms)
    var(--nm-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) backwards;
}
@keyframes ui-ptr-pop {
  from {
    opacity: 0;
    transform: scale(0.76);
  }
}

/* Name and price --------------------------------------------------------- */
.ui-ptr__name {
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.02em;
  color: var(--ui-ptr-ink);
}
.ui-ptr__subtitle {
  min-height: 2.5rem;
  margin-top: 6px;
  font-size: 0.8rem;
  line-height: 1.25rem;
  color: var(--ui-ptr-muted);
  text-wrap: pretty;
}
.ui-ptr__priceblock {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--ui-ptr-line);
}
.ui-ptr__pricelabel {
  margin-bottom: 6px;
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.2;
  color: var(--ui-ptr-muted);
}
.ui-ptr__price {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  column-gap: 8px;
  row-gap: 2px;
}
.ui-ptr__amount {
  font-size: 1.85rem;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--ui-ptr-ink);
  font-variant-numeric: tabular-nums;
  animation: ui-ptr-swap var(--nm-dur-3, 240ms)
    var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) backwards;
}
@keyframes ui-ptr-swap {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
}
.ui-ptr__unit {
  padding-bottom: 3px;
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: var(--ui-ptr-muted);
  white-space: nowrap;
}
.ui-ptr__pricenote {
  min-height: 1.25rem;
  margin-top: 8px;
}
.ui-ptr__pricenotetext {
  font-size: 12px;
  line-height: 1.25rem;
  color: var(--ui-ptr-muted);
  text-wrap: pretty;
}

/* Feature rows ----------------------------------------------------------- */
.ui-ptr__features {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
}
.ui-ptr__feature {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
  font-size: 0.82rem;
  line-height: 1.25rem;
  color: var(--ui-ptr-feature);
}
.ui-ptr__mark {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 20px;
}
.ui-ptr__feature[data-included="true"] .ui-ptr__mark {
  color: var(--ui-ptr-accent);
}
.ui-ptr__feature[data-included="false"] .ui-ptr__mark {
  color: var(--ui-ptr-muted);
}
.ui-ptr__featuretext {
  flex: 1 1 auto;
  min-width: 0;
  text-wrap: pretty;
}
.ui-ptr__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  white-space: nowrap;
  border: 0;
  clip-path: inset(50%);
}

/* Help glyph and its tooltip --------------------------------------------- */
.ui-ptr__help {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 20px;
  margin: -1px 0 0;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: none;
  color: var(--ui-ptr-muted);
  cursor: help;
  -webkit-tap-highlight-color: transparent;
  transition: color var(--nm-dur-1, 90ms)
    var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-ptr__help:hover,
.ui-ptr__help[aria-describedby] {
  color: var(--ui-ptr-accent);
}
.ui-ptr__help:focus-visible {
  outline: 2px solid var(--ui-ptr-focus);
  outline-offset: 1px;
}
/* Anchored to the row, not to the glyph, so a 320px viewport cannot push it off the page. */
.ui-ptr__tip {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 6;
  width: max-content;
  max-width: min(15rem, calc(100vw - 5rem));
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--ui-ptr-tip);
  color: var(--ui-ptr-tip-ink);
  box-shadow: 0 10px 24px -14px #1a141059;
  font-size: 11.5px;
  font-weight: 400;
  line-height: 1.5;
  letter-spacing: -0.005em;
  animation: ui-ptr-tip-in var(--nm-dur-2, 160ms)
    var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) backwards;
}
@keyframes ui-ptr-tip-in {
  from {
    opacity: 0;
    transform: translateY(-3px);
  }
}

/* Foot and button -------------------------------------------------------- */
.ui-ptr__foot {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: auto;
  padding-top: 32px;
}
.ui-ptr__caveat {
  font-size: 0.7rem;
  line-height: 1.25rem;
  color: var(--ui-ptr-muted);
  text-wrap: pretty;
}
.ui-ptr__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 2.75rem;
  padding: 0 16px;
  border-radius: var(--radius-preview, 12px);
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: -0.005em;
  text-align: center;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  transition:
    transform var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-ptr__cta[data-tone="quiet"] {
  background: transparent;
  color: var(--ui-ptr-ink);
  box-shadow: inset 0 0 0 1px var(--ui-ptr-line-strong);
}
.ui-ptr__cta[data-tone="quiet"]:hover {
  background: var(--ui-ptr-wash);
  box-shadow: inset 0 0 0 1px var(--ui-ptr-ink);
}
.ui-ptr__cta[data-tone="accent"] {
  background: linear-gradient(180deg, var(--ui-ptr-accent), var(--ui-ptr-accent-lift));
  color: var(--ui-ptr-accent-fg);
  box-shadow: 0 1px 2px #1a14101f, 0 8px 18px -12px #c2410c73;
}
.ui-ptr__cta:active {
  transform: translateY(1px);
}
.ui-ptr__cta:focus-visible {
  outline: 2px solid var(--ui-ptr-focus);
  outline-offset: 2px;
}
.ui-ptr[data-cta="lg"] .ui-ptr__cta {
  min-height: 4rem;
  border-radius: 1.25rem;
  font-size: 1rem;
}

:where(.dark, [data-theme="dark"]) .ui-ptr {
  --ui-ptr-ink: var(--text, #f4ece4);
  --ui-ptr-muted: var(--text-muted, #a2958a);
  --ui-ptr-feature: var(--text-muted, #a2958a);
  --ui-ptr-surface: var(--panel, #1a1512);
  --ui-ptr-card: var(--card, #201a15);
  --ui-ptr-line: var(--border, #33291f);
  --ui-ptr-line-strong: #4a3d31;
  --ui-ptr-edge: var(--border-soft, #ffffff12);
  --ui-ptr-wash: #ffffff0d;
  --ui-ptr-band: #ffffff08;
  --ui-ptr-accent: var(--accent, #ff6b35);
  --ui-ptr-accent-soft: var(--accent-soft, #ff6b3524);
  --ui-ptr-accent-fg: var(--accent-fg, #1a0f08);
  --ui-ptr-accent-lift: var(--accent-hover, #ff8256);
  --ui-ptr-accent-line: #ff6b3559;
  --ui-ptr-neutral-ground: #ffffff14;
  --ui-ptr-neutral-ink: var(--text, #f4ece4);
  --ui-ptr-neutral-line: #ffffff1f;
  --ui-ptr-tip: var(--text, #f4ece4);
  --ui-ptr-tip-ink: #14100d;
  --ui-ptr-lift: 0 1px 2px #0000004d, 0 18px 40px -28px #000000a6;
  --ui-ptr-focus: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  .ui-ptr__card,
  .ui-ptr__ribbontext,
  .ui-ptr__amount,
  .ui-ptr__tip,
  .ui-ptr__period,
  .ui-ptr__help,
  .ui-ptr__cta {
    animation: none;
    animation-delay: 0ms;
    transition-duration: 1ms;
  }
  .ui-ptr__card:hover,
  .ui-ptr__cta:active {
    transform: none;
  }
}
`;
