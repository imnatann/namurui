"use client";

import { Fragment, useMemo, useState } from "react";

/*
 * Invoice & Credit Note – an invoice and its credit note stacked like two sheets of paper.
 * The switch slides the chosen sheet forward while the other tucks behind, still showing its top edge,
 * and the buttons in the bar export the sheet on top or jump straight to the credit note. The credit
 * note repeats the seller's terms, then a tray of pickable lines: each row is a checkbox with its own
 * amount field, clamped to the line total, and the totals below add up net, tax and the amount that
 * will be applied to the invoice. Below 560px of its own width the parties stack, the rate and tax
 * columns fold away and the tray drops its line-total column. The styles are injected below, so no
 * extra files are needed.
 */

export type Doc = "invoice" | "credit";

export type InvoiceLine = {
  /** Stable id */
  id: string;
  /** What was sold */
  name: string;
  /** Quantity – fractional units are allowed */
  qty: number;
  /** Unit price */
  rate: number;
  /** Tax rate as a fraction, e.g. 0.2 for 20% */
  tax: number;
  /** Lines sharing a group are listed under that heading */
  group?: string;
};

export type InvoiceParty = {
  /** Company or person */
  name: string;
  /** Address lines under the name */
  lines: string[];
};

export type CreditLine = {
  /** Line the amount belongs to */
  id: string;
  /** Name shown on both sheets */
  name: string;
  /** Net amount credited for this line, clamped to its line total */
  amount: number;
};

export type InvoiceCreditProps = {
  /** From block on the invoice */
  seller?: InvoiceParty;
  /** To block on the invoice */
  buyer?: InvoiceParty;
  /** Invoice number, shown under the terms */
  invoiceNo?: string;
  /** Credit note number */
  creditNo?: string;
  /** Issue date of the invoice, reused as the date of the credit note */
  invoiceDate?: string;
  /** Payment due date */
  dueDate?: string;
  /** Service period both sheets cover */
  period?: string;
  /** Invoice lines – lines sharing a group are listed under that heading */
  lines?: InvoiceLine[];
  /** Currency symbol */
  currency?: string;
  /** Currency code shown after the amount applied to the invoice */
  currencyCode?: string;
  /** Where "Pay online" points */
  payHref?: string;
  /** Sheet shown first */
  defaultView?: Doc;
  /** Called whenever the visible sheet changes */
  onViewChange?: (view: Doc) => void;
  /** Called by the PDF button with the sheet it would export */
  onDownload?: (view: Doc) => void;
  /** Called when the credit note is issued, with the credited amount per line and the total incl. tax */
  onIssue?: (lines: CreditLine[], total: number) => void;
  /** Extra class on the root */
  className?: string;
};

const defaultSeller: InvoiceParty = {
  name: "Lumen Labs, Inc.",
  lines: ["48 Harbour Street", "Bristol", "BS1 4RN", "United Kingdom"],
};

const defaultBuyer: InvoiceParty = {
  name: "Northwind Logistics GmbH",
  lines: ["Speicherstraße 12", "Hamburg", "20457", "Germany"],
};

const defaultLines: InvoiceLine[] = [
  { id: "growth", name: "Growth plan", qty: 1, rate: 1250, tax: 0.2 },
  { id: "seats", name: "Extra seats", qty: 12, rate: 40, tax: 0.2 },
  { id: "api", name: "API calls (per 1k)", qty: 18420, rate: 0.42, tax: 0.2, group: "Metered usage" },
];

const round2 = (value: number) => Math.round(value * 100) / 100;

const two = (value: number) =>
  value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const money = (value: number, currency: string) =>
  `${value < 0 ? "-" : ""}${currency}${two(Math.abs(value))}`;

const netOf = (line: InvoiceLine) => round2(line.qty * line.rate);

export function InvoiceCredit({
  seller = defaultSeller,
  buyer = defaultBuyer,
  invoiceNo = "INV-2041",
  creditNo = "CN-0117",
  invoiceDate = "1 Oct 2026",
  dueDate = "31 Oct 2026",
  period = "1 Sep – 30 Sep 2026",
  lines = defaultLines,
  currency = "$",
  currencyCode = "USD",
  payHref = "#pay",
  defaultView = "invoice",
  onViewChange,
  onDownload,
  onIssue,
  className,
}: InvoiceCreditProps) {
  const [view, setView] = useState<Doc>(defaultView);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [edited, setEdited] = useState<Record<string, string>>({});

  const show = (next: Doc) => {
    setView(next);
    onViewChange?.(next);
  };

  const invoiceTotals = useMemo(() => {
    let net = 0;
    let tax = 0;
    for (const line of lines) {
      net += netOf(line);
      tax += netOf(line) * line.tax;
    }
    return { net: round2(net), tax: round2(tax), total: round2(net + tax) };
  }, [lines]);

  const credited = useMemo(() => {
    let net = 0;
    let tax = 0;
    const rows: CreditLine[] = [];
    for (const line of lines) {
      if (!(picked[line.id] ?? true)) continue;
      const raw = edited[line.id] ?? two(netOf(line));
      const parsed = Number.parseFloat(raw.replace(/[^0-9.]/g, ""));
      const value = Number.isFinite(parsed)
        ? Math.min(Math.max(parsed, 0), netOf(line))
        : 0;
      if (value <= 0) continue;
      rows.push({ id: line.id, name: line.name, amount: round2(value) });
      net += value;
      tax += value * line.tax;
    }
    return { net: round2(net), tax: round2(tax), total: round2(net + tax), rows };
  }, [edited, lines, picked]);

  const toggle = (line: InvoiceLine) => {
    setPicked((prev) => ({ ...prev, [line.id]: !(prev[line.id] ?? true) }));
  };

  const edit = (line: InvoiceLine, raw: string) => {
    setEdited((prev) => ({ ...prev, [line.id]: raw.replace(/[^0-9.,]/g, "") }));
  };

  const settle = (line: InvoiceLine) => {
    const raw = edited[line.id] ?? two(netOf(line));
    const parsed = Number.parseFloat(raw.replace(/[^0-9.]/g, ""));
    const value = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, 0), netOf(line))
      : 0;
    setEdited((prev) => ({ ...prev, [line.id]: two(value) }));
  };

  const issue = () => {
    if (credited.rows.length === 0) return;
    onIssue?.(credited.rows, credited.total);
  };

  return (
    <section
      className={["ui-iv", className].filter(Boolean).join(" ")}
      data-view={view}
    >
      <style href="ui-invoice-credit" precedence="default">
        {css}
      </style>

      <div className="ui-iv__bar">
        <div className="ui-iv__seg" role="tablist" aria-label="Document">
          <span className="ui-iv__seg-thumb" aria-hidden="true" />
          <button
            type="button"
            role="tab"
            aria-selected={view === "invoice"}
            onClick={() => show("invoice")}
          >
            Invoice
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "credit"}
            onClick={() => show("credit")}
          >
            Credit note
          </button>
        </div>

        <div className="ui-iv__actions">
          <button
            type="button"
            className="ui-iv__btn"
            onClick={() => onDownload?.(view)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" />
            </svg>
            PDF
          </button>
          <button type="button" className="ui-iv__btn" onClick={() => show("credit")}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 14 4.5 9.5 9 5M4.5 9.5h10a5 5 0 0 1 0 10H12" />
            </svg>
            Credit invoice
          </button>
        </div>
      </div>

      <div className="ui-iv__stack">
        <article
          className="ui-iv__sheet"
          data-doc="invoice"
          aria-hidden={view !== "invoice"}
          inert={view !== "invoice" ? true : undefined}
        >
          <header className="ui-iv__head">
            <div>
              <p className="ui-iv__big">{money(invoiceTotals.total, currency)}</p>
              <p className="ui-iv__due">
                Due {dueDate}
                <a href={payHref}>Pay online</a>
              </p>
            </div>
            <span className="ui-iv__brand">
              <span className="ui-iv__logo" aria-hidden="true" />
              {seller.name}
            </span>
          </header>

          <div className="ui-iv__parties">
            <div className="ui-iv__party">
              <p className="ui-iv__label">From</p>
              <p>{seller.name}</p>
              {seller.lines.map((entry, index) => (
                <p key={`${entry}-${index}`}>{entry}</p>
              ))}
            </div>
            <div className="ui-iv__party">
              <p className="ui-iv__label">To</p>
              <p>{buyer.name}</p>
              {buyer.lines.map((entry, index) => (
                <p key={`${entry}-${index}`}>{entry}</p>
              ))}
            </div>
          </div>

          <div className="ui-iv__terms">
            <p className="ui-iv__label">Terms</p>
            <dl>
              <div>
                <dt>Invoice no</dt>
                <dd>
                  <span className="ui-iv__ref">{invoiceNo}</span>
                </dd>
              </div>
              <div>
                <dt>Invoice date</dt>
                <dd>{invoiceDate}</dd>
              </div>
              <div>
                <dt>Due date</dt>
                <dd>{dueDate}</dd>
              </div>
              <div>
                <dt>Billing period</dt>
                <dd>{period}</dd>
              </div>
            </dl>
          </div>

          <table className="ui-iv__table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Qty</th>
                <th className="ui-iv__num">Rate</th>
                <th className="ui-iv__num">Tax</th>
                <th className="ui-iv__num">Price</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <Fragment key={line.id}>
                  {line.group && line.group !== lines[index - 1]?.group ? (
                    <tr className="ui-iv__group">
                      <td colSpan={5}>{line.group}</td>
                    </tr>
                  ) : null}
                  <tr data-indent={line.group ? "" : undefined}>
                    <td>{line.name}</td>
                    <td>{line.qty.toLocaleString("en-US")}</td>
                    <td className="ui-iv__num">{money(line.rate, currency)}</td>
                    <td className="ui-iv__num">{round2(line.tax * 100)}%</td>
                    <td className="ui-iv__num">{money(netOf(line), currency)}</td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>

          <div className="ui-iv__totals">
            <div>
              <span>Subtotal</span>
              <span>{money(invoiceTotals.net, currency)}</span>
            </div>
            <div>
              <span>Tax</span>
              <span>{money(invoiceTotals.tax, currency)}</span>
            </div>
            <div className="ui-iv__total">
              <span>Total</span>
              <b>{money(invoiceTotals.total, currency)}</b>
            </div>
          </div>
        </article>

        <article
          className="ui-iv__sheet"
          data-doc="credit"
          aria-hidden={view !== "credit"}
          inert={view !== "credit" ? true : undefined}
        >
          <header className="ui-iv__head">
            <div>
              <p className="ui-iv__big">Credit note</p>
              <p className="ui-iv__due">
                {money(credited.total, currency)} credited on {invoiceDate}
              </p>
            </div>
            <span className="ui-iv__brand">
              <span className="ui-iv__logo" aria-hidden="true" />
              {seller.name}
            </span>
          </header>

          <div className="ui-iv__terms">
            <p className="ui-iv__label">Terms</p>
            <dl>
              <div>
                <dt>Credit note no</dt>
                <dd>
                  <span className="ui-iv__ref">{creditNo}</span>
                </dd>
              </div>
              <div>
                <dt>Related invoice</dt>
                <dd>
                  <button
                    type="button"
                    className="ui-iv__ref"
                    onClick={() => show("invoice")}
                  >
                    {invoiceNo}
                  </button>
                </dd>
              </div>
              <div>
                <dt>Billing period</dt>
                <dd>{period}</dd>
              </div>
              <div>
                <dt>Date of issue</dt>
                <dd>{invoiceDate}</dd>
              </div>
            </dl>
          </div>

          <div className="ui-iv__tray">
            <p className="ui-iv__tray-title">Lines to credit</p>
            <div className="ui-iv__card">
              <div className="ui-iv__crow ui-iv__crow--head">
                <span />
                <span>Name</span>
                <span className="ui-iv__num">Total</span>
                <span className="ui-iv__num">Credit amount</span>
              </div>
              {lines.map((line) => {
                const on = picked[line.id] ?? true;
                return (
                  <div
                    key={line.id}
                    className="ui-iv__crow"
                    data-off={on ? undefined : ""}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      aria-label={`Credit ${line.name}`}
                      className="ui-iv__check"
                      onClick={() => toggle(line)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m6 12.5 4 4 8-9" />
                      </svg>
                    </button>
                    <span className="ui-iv__cname">{line.name}</span>
                    <span className="ui-iv__num">{money(netOf(line), currency)}</span>
                    <span className="ui-iv__num">
                      <label
                        className="ui-iv__amount"
                        data-disabled={on ? undefined : ""}
                      >
                        <span>{currency}</span>
                        <input
                          inputMode="decimal"
                          aria-label={`Credit amount for ${line.name}`}
                          value={edited[line.id] ?? two(netOf(line))}
                          readOnly={!on}
                          onChange={(event) => edit(line, event.target.value)}
                          onBlur={() => settle(line)}
                        />
                      </label>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="ui-iv__totals">
            <div>
              <span>Subtotal</span>
              <span>{money(credited.net, currency)}</span>
            </div>
            <div>
              <span>Tax</span>
              <span>{money(credited.tax, currency)}</span>
            </div>
            <div className="ui-iv__total">
              <span>Adjustment total</span>
              <b>{money(-credited.total, currency)}</b>
            </div>
            <div className="ui-iv__note">
              <span>Applied to invoice</span>
              <span>
                {money(-credited.total, currency)} {currencyCode}
              </span>
            </div>
          </div>

          <div className="ui-iv__issue">
            <button
              type="button"
              className="ui-iv__primary"
              disabled={credited.rows.length === 0}
              onClick={issue}
            >
              Issue credit note
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}

const css = /* css */ `
.ui-iv{--ui-iv-tray: #eee6de;--ui-iv-paper: #fffdfb;--ui-iv-card-line: #ded4ca;--ui-iv-line: #eae2d9;--ui-iv-inset: #f5efe8;--ui-iv-ink: #1c1713;--ui-iv-text: #3d3226;--ui-iv-muted: #857567;--ui-iv-accent: #ff6b35;--ui-iv-check: #ff6b35;--ui-iv-ok: #1a7a4a;--ui-iv-ok-bg: #ebe3db;--ui-iv-hover: #f4ece5;--ui-iv-btn-top: #342a20;--ui-iv-btn-bottom: #241e19;--ui-iv-btn-ring: #14100d;--ui-iv-btn-text: #fffdfb;--ui-iv-shadow: 0 1px 2px rgba(11, 9, 8, 0.06);--ui-iv-ease: cubic-bezier(0.65, 0, 0.25, 1);container-type: inline-size;width: 100%;max-width: 760px;padding: 6px;border-radius: 24px;background: var(--ui-iv-tray);font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;color: var(--ui-iv-ink);-webkit-font-smoothing: antialiased}
.ui-iv *, .ui-iv *::before, .ui-iv *::after{box-sizing: border-box}
.ui-iv button, .ui-iv input{font: inherit;color: inherit;margin: 0}
.ui-iv button{cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-iv :focus-visible{outline: 2px solid var(--ui-iv-accent);outline-offset: 2px}
.ui-iv svg{width: 15px;height: 15px;flex: none;fill: none;stroke: currentColor;stroke-width: 1.8;stroke-linecap: round;stroke-linejoin: round}
.ui-iv p{margin: 0}
.ui-iv__bar{display: flex;align-items: center;justify-content: space-between;gap: 10px;padding: 6px 4px 12px 6px}
.ui-iv__seg{position: relative;display: grid;grid-template-columns: 1fr 1fr;padding: 3px;border-radius: 10px;background: rgba(11, 9, 8, 0.05)}
.ui-iv__seg-thumb{position: absolute;top: 3px;left: 3px;width: calc(50% - 3px);height: calc(100% - 6px);border-radius: 7px;background: var(--ui-iv-paper);box-shadow: 0 1px 2px rgba(11, 9, 8, 0.08), 0 0 0 1px rgba(11, 9, 8, 0.04);transition: transform var(--nm-dur-4, 380ms) var(--ui-iv-ease)}
.ui-iv[data-view="credit"] .ui-iv__seg-thumb{transform: translateX(100%)}
.ui-iv__seg button{position: relative;height: 30px;padding: 0 16px;white-space: nowrap;border: 0;background: none;font-size: 13px;font-weight: 500;color: var(--ui-iv-muted);transition: color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-iv__seg button[aria-selected="true"]{color: var(--ui-iv-ink)}
.ui-iv__actions{display: flex;gap: 6px}
.ui-iv__btn{display: inline-flex;align-items: center;gap: 7px;height: 34px;padding: 0 12px;border: 0;border-radius: 10px;background: var(--ui-iv-paper);box-shadow: inset 0 0 0 1px var(--ui-iv-card-line), 0 1px 1px rgba(11, 9, 8, 0.03);font-size: 13px;font-weight: 500;white-space: nowrap;animation: ui-iv-fade 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-iv__btn:hover{background: var(--ui-iv-hover)}
.ui-iv__btn:active{transform: scale(0.98)}
.ui-iv__btn svg{color: var(--ui-iv-text)}
.ui-iv__stack{position: relative;display: grid;padding-top: 14px}
.ui-iv__sheet{grid-area: 1 / 1;min-width: 0;padding: 44px 48px 36px;border: 1px solid var(--ui-iv-card-line);border-radius: 20px;background: var(--ui-iv-paper);box-shadow: 0 -1px 2px rgba(11, 9, 8, 0.03);transition: transform 620ms var(--ui-iv-ease), opacity var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-iv__sheet[aria-hidden="true"]{z-index: 0;transform: translateY(-14px) scale(0.96);transform-origin: top center;pointer-events: none}
.ui-iv__sheet[aria-hidden="true"] > *{opacity: 0;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-iv__sheet:not([aria-hidden="true"]){z-index: 1;box-shadow: 0 -2px 10px rgba(11, 9, 8, 0.04)}
.ui-iv__sheet:not([aria-hidden="true"]) > *{opacity: 1;transition: opacity var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 200ms}
.ui-iv__head{display: flex;align-items: flex-start;justify-content: space-between;gap: 16px;margin-bottom: 40px}
.ui-iv__big{font-size: 40px;font-weight: 500;letter-spacing: -0.035em;line-height: 1.1;font-variant-numeric: tabular-nums}
.ui-iv__due{display: flex;align-items: center;gap: 28px;margin-top: 10px !important;font-size: 14px;color: var(--ui-iv-text)}
.ui-iv__due a{color: var(--ui-iv-accent);text-decoration: none}
.ui-iv__due a:hover{text-decoration: underline}
.ui-iv__badge{margin-left: -16px;padding: 2px 8px;border-radius: 8px;background: var(--ui-iv-ok-bg);font-size: 12px;font-weight: 500;color: var(--ui-iv-ok)}
.ui-iv__brand{display: inline-flex;align-items: center;gap: 9px;padding-top: 8px;font-size: 15px;color: var(--ui-iv-text);white-space: nowrap}
.ui-iv__logo{width: 24px;height: 24px;border-radius: 50%;background: conic-gradient(from 210deg, #2f6bff, #8fb0ff, #2f6bff);-webkit-mask: radial-gradient(circle, transparent 4px, #000 4.5px);mask: radial-gradient(circle, transparent 4px, #000 4.5px)}
.ui-iv__label{margin-bottom: 8px !important;font-size: 14px;font-weight: 500;color: var(--ui-iv-ink)}
.ui-iv__parties{display: grid;grid-template-columns: 1fr 1fr;gap: 24px;margin-bottom: 36px}
.ui-iv__party p:not(.ui-iv__label){font-size: 14px;line-height: 1.6;color: var(--ui-iv-text)}
.ui-iv__terms{margin-bottom: 36px}
.ui-iv__terms dl{display: grid;gap: 7px;margin: 0}
.ui-iv__terms dl > div{display: grid;grid-template-columns: 140px 1fr;font-size: 14px}
.ui-iv__terms dt{color: var(--ui-iv-muted)}
.ui-iv__terms dd{margin: 0;color: var(--ui-iv-text)}
.ui-iv__ref{padding: 0;border: 0;background: none;color: var(--ui-iv-accent) !important;font-variant-numeric: tabular-nums}
button.ui-iv__ref:hover{text-decoration: underline}
.ui-iv__table{width: 100%;border-collapse: collapse;font-size: 14px}
.ui-iv__table th{padding: 0 0 12px;border-bottom: 1px solid var(--ui-iv-line);text-align: left;font-weight: 500;color: var(--ui-iv-ink)}
.ui-iv__table td{padding: 14px 0;border-bottom: 1px solid var(--ui-iv-line);color: var(--ui-iv-text);font-variant-numeric: tabular-nums}
.ui-iv__table tr[data-indent] td:first-child{padding-left: 24px}
.ui-iv__group td{color: var(--ui-iv-ink)}
.ui-iv__num{text-align: right !important}
.ui-iv__totals{display: grid;gap: 12px;width: min(100%, 300px);margin: 22px 0 0 auto;font-size: 14px}
.ui-iv__totals > div{display: flex;justify-content: space-between;gap: 16px;color: var(--ui-iv-muted);font-variant-numeric: tabular-nums}
.ui-iv__totals > div span:last-child{color: var(--ui-iv-text)}
.ui-iv__total{margin-top: 4px;padding-top: 14px;border-top: 1px solid var(--ui-iv-text)}
.ui-iv__total span{font-weight: 500;color: var(--ui-iv-text) !important}
.ui-iv__total b{font-size: 16px;font-weight: 600;color: var(--ui-iv-ink)}
.ui-iv__note{margin-top: -4px}
.ui-iv__tray{padding: 0 6px 6px;border-radius: 18px;background: var(--ui-iv-inset);box-shadow: inset 0 0 0 1px var(--ui-iv-line)}
.ui-iv__tray-title{padding: 14px 12px 12px;font-size: 15px;font-weight: 500;color: var(--ui-iv-text)}
.ui-iv__card{padding: 4px 14px;border: 1px solid var(--ui-iv-card-line);border-radius: 14px;background: var(--ui-iv-paper);box-shadow: var(--ui-iv-shadow)}
.ui-iv__crow{display: grid;grid-template-columns: 22px minmax(0, 1fr) auto minmax(150px, 0.8fr);align-items: center;gap: 14px;min-height: 60px;border-bottom: 1px solid var(--ui-iv-line);font-size: 14.5px;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-iv__crow:last-child{border-bottom: 0}
.ui-iv__crow--head{min-height: 46px;font-size: 13.5px;color: var(--ui-iv-muted)}
.ui-iv__crow[data-off] .ui-iv__cname, .ui-iv__crow[data-off] > .ui-iv__num:nth-child(3){opacity: 0.45}
.ui-iv__crow > .ui-iv__num{font-variant-numeric: tabular-nums;color: var(--ui-iv-ink)}
.ui-iv__check{display: grid;place-items: center;width: 20px;height: 20px;padding: 0;border: 0;border-radius: 6px;background: var(--ui-iv-inset);box-shadow: inset 0 0 0 1px var(--ui-iv-card-line);color: #fffdfb !important;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-iv__check svg{width: 13px;height: 13px;stroke-width: 2.4;stroke-dasharray: 20;stroke-dashoffset: 20;transition: stroke-dashoffset var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-iv__check[aria-checked="true"]{background: var(--ui-iv-check);box-shadow: inset 0 0 0 1px var(--ui-iv-check)}
.ui-iv__check[aria-checked="true"] svg{stroke-dashoffset: 0}
.ui-iv__check:disabled{cursor: default}
.ui-iv__amount{display: flex;align-items: center;gap: 8px;width: 100%;max-width: 220px;margin-left: auto;height: 44px;padding: 0 14px;border-radius: 12px;background: var(--ui-iv-paper);box-shadow: inset 0 0 0 1px var(--ui-iv-card-line);transition: box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-iv__amount:focus-within{box-shadow: inset 0 0 0 1px var(--ui-iv-accent)}
.ui-iv__amount span{color: var(--ui-iv-muted)}
.ui-iv__amount input{flex: 1;min-width: 0;border: 0;background: none;outline: none;text-align: right;font-size: 14.5px;font-variant-numeric: tabular-nums;color: var(--ui-iv-ink)}
.ui-iv__amount[data-disabled]{opacity: 0.5}
.ui-iv__issue{display: flex;justify-content: flex-end;margin-top: 24px}
.ui-iv__primary{height: 38px;padding: 0 16px;border: 0;border-radius: 10px;background: linear-gradient(180deg, var(--ui-iv-btn-top), var(--ui-iv-btn-bottom));box-shadow: 0 0 0 1px var(--ui-iv-btn-ring), inset 0 1px 0 rgba(255, 253, 251, 0.12);font-size: 14px;font-weight: 500;color: var(--ui-iv-btn-text) !important;transition: filter 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-iv__primary:hover:not(:disabled){filter: brightness(1.12)}
.ui-iv__primary:active:not(:disabled){transform: scale(0.98)}
.ui-iv__primary:disabled{opacity: 0.4;cursor: default}
@keyframes ui-iv-fade{from{opacity: 0}
}
@container (max-width: 560px){.ui-iv__sheet{padding: 28px 20px 24px}
.ui-iv__big{font-size: 30px}
.ui-iv__head{flex-direction: column-reverse;margin-bottom: 28px}
.ui-iv__parties{grid-template-columns: 1fr}
.ui-iv__terms dl > div{grid-template-columns: 120px 1fr}
.ui-iv__table th:nth-child(4), .ui-iv__table td:nth-child(4), .ui-iv__table th:nth-child(3), .ui-iv__table td:nth-child(3){display: none}
.ui-iv__table th + th, .ui-iv__table td + td{padding-left: 12px}
.ui-iv__crow{grid-template-columns: 22px minmax(0, 1fr) minmax(110px, 0.9fr)}
.ui-iv__crow > :nth-child(3){display: none}
.ui-iv__actions .ui-iv__btn:first-child{display: none}
.ui-iv__seg button{padding: 0 11px}
.ui-iv__btn{padding: 0 10px}
}
@container (max-width: 400px){.ui-iv__sheet{padding: 24px 16px 20px}
.ui-iv__card{padding: 4px 10px}
.ui-iv__crow{gap: 10px}
.ui-iv__amount{gap: 4px;padding: 0 10px}
.ui-iv__terms dl > div{grid-template-columns: 112px 1fr}
}
@media (prefers-reduced-motion: reduce){.ui-iv__sheet, .ui-iv__sheet > *, .ui-iv__seg-thumb{transition: none !important}
}
.ui-iv input:not([type="checkbox"]):not([type="radio"]):focus-visible, .ui-iv textarea:focus-visible, .ui-iv [contenteditable]:focus-visible{outline: none}
:where(.dark, [data-theme="dark"]) .ui-iv{--ui-iv-tray: #1c1713;--ui-iv-paper: #27201a;--ui-iv-card-line: rgba(255, 253, 251, 0.08);--ui-iv-line: rgba(255, 253, 251, 0.07);--ui-iv-inset: #211b16;--ui-iv-ink: #ebe3da;--ui-iv-text: #b4a89d;--ui-iv-muted: #857567;--ui-iv-accent: #ff8a5c;--ui-iv-check: #ff8a5c;--ui-iv-ok: #4f9d6e;--ui-iv-ok-bg: rgba(79, 157, 110, 0.14);--ui-iv-hover: rgba(255, 253, 251, 0.05);--ui-iv-btn-top: #f4ece4;--ui-iv-btn-bottom: #dfd5cc;--ui-iv-btn-ring: rgba(11, 9, 8, 0.6);--ui-iv-btn-text: #191411;--ui-iv-shadow: 0 1px 2px rgba(11, 9, 8, 0.4)}
:where(.dark, [data-theme="dark"]) .ui-iv__seg{background: rgba(255, 253, 251, 0.06)}
:where(.dark, [data-theme="dark"]) .ui-iv__seg-thumb{background: #33291f}

`;
