"use client";

/*
 * Stock Card: the catalogue entry an answer cited, shown as a small window. The header names the
 * catalogue and its connection state, the product row carries the code, the name and the stock
 * line, and the foot holds the label of the answer that used it plus that answer in curly quotes,
 * clamped to two lines with the full text kept in the title attribute. When the citation is
 * omitted the foot is not rendered at all, so the card closes after the product row without a
 * gap. The foot fades in when a citation arrives, and the card itself settles in on mount; both
 * moves are removed under reduced motion. Styles are injected below, so no extra files are
 * needed. Override the --ui-stk-* variables on .ui-stk to retheme it.
 */

export type StockItem = {
  /** Short catalogue code carried by the thumbnail, e.g. `SUV` */
  code?: string;
  /** Product name, held to one line */
  name: string;
  /** Stock and location line under the name, e.g. `1 unit · gudang BSD` */
  meta: string;
};

/** The answer that cited the entry: the label of the source and the sentence it used. */
type StockCitation = {
  /** Pill label above the quote, e.g. `Dipakai di jawaban AI` */
  label: string;
  /** The cited sentence; shown in curly quotes, clamped to two lines */
  quote: string;
};

export type StockCardProps = {
  /** Window title in the header */
  title?: string;
  /** Connection badge label, drawn in the success tone */
  status?: string;
  /** The catalogue entry the answer cited */
  item: StockItem;
  /** The citing answer; omit it and the card ends after the product row */
  cite?: StockCitation;
  /** Extra class on the root */
  className?: string;
};

export function StockCard({
  title = "Katalog toko",
  status = "Terhubung",
  item,
  cite,
  className,
}: StockCardProps) {
  const badge = status.trim();

  return (
    <div className={["ui-stk", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many cards render */}
      <style href="ui-stock-card" precedence="default">
        {css}
      </style>

      <div className="ui-stk__head">
        <span className="ui-stk__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="ui-stk__title">{title}</span>
        {badge ? (
          <span className="ui-stk__badge" data-tone="success">
            {badge}
          </span>
        ) : null}
      </div>

      <div className="ui-stk__row">
        <span className="ui-stk__thumb" aria-hidden={item.code ? undefined : true}>
          {item.code ? <span className="ui-stk__code">{item.code}</span> : null}
        </span>
        <span className="ui-stk__body">
          <span className="ui-stk__name" title={item.name}>
            {item.name}
          </span>
          <span className="ui-stk__meta">{item.meta}</span>
        </span>
      </div>

      {cite ? (
        <div className="ui-stk__foot">
          <span className="ui-stk__pill">{cite.label}</span>
          <blockquote className="ui-stk__quote" title={cite.quote}>
            {"\u201c"}
            {cite.quote}
            {"\u201d"}
          </blockquote>
        </div>
      ) : null}
    </div>
  );
}

const css = /* css */ `
.ui-stk {
  --ui-stk-surface: #fffdfb;
  --ui-stk-ground: #faf7f4;
  --ui-stk-line: #e6dcd2;
  --ui-stk-ink: #1c1713;
  --ui-stk-muted: #68584b;
  --ui-stk-thumb: #f2e9e0;
  --ui-stk-thumb-line: rgba(11, 9, 8, 0.05);
  --ui-stk-accent: #c2410c;
  --ui-stk-accent-soft: rgba(194, 65, 12, 0.1);
  /* The accent clears AA on the surface, but not on its own 10% ember wash: #c2410c on
   * #f4e5dd measures 4.22. The darker step measures 5.95 on that wash. */
  --ui-stk-pill-ink: var(--accent-hover, #9a3412);
  --ui-stk-success: #1a7a4a;
  --ui-stk-success-soft: rgba(26, 122, 74, 0.12);
  /* The success tone sits under AA on its own 12% wash: #1a7a4a on #e4ede6 measures 4.47.
   * This darker step measures 6.32 on that wash. */
  --ui-stk-badge-ink: #156040;
  --ui-stk-dot: #ded4ca;
  --ui-stk-hover: #f7f1ea;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 21rem;
  min-width: 0;
  overflow: hidden;
  background: var(--ui-stk-surface);
  border: 1px solid var(--ui-stk-line);
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(11, 9, 8, 0.06), 0 8px 20px -14px rgba(11, 9, 8, 0.18);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: var(--ui-stk-ink);
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
  animation: ui-stk-in var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both;
}
.ui-stk *, .ui-stk *::before, .ui-stk *::after { box-sizing: border-box; }

.ui-stk__head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
  height: 36px;
  padding: 0 12px;
  border-bottom: 1px solid var(--ui-stk-line);
}
.ui-stk__dots { display: inline-flex; flex: none; gap: 4px; }
.ui-stk__dots i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ui-stk-dot);
}
.ui-stk__dots i:nth-child(3) { opacity: 0.55; }
.ui-stk__title {
  min-width: 0;
  overflow: hidden;
  font-size: 11px;
  font-weight: 600;
  line-height: 15px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-stk__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
  height: 18px;
  margin-left: auto;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--ui-stk-success-soft);
  color: var(--ui-stk-badge-ink);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0;
  white-space: nowrap;
}
.ui-stk__badge::before {
  content: "";
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.ui-stk__row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
  min-height: 72px;
  padding: 12px;
  transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-stk__row:hover { background: var(--ui-stk-hover); }
.ui-stk__thumb {
  display: grid;
  place-items: center;
  flex: none;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: var(--ui-stk-thumb);
  box-shadow: inset 0 0 0 1px var(--ui-stk-thumb-line);
  color: var(--ui-stk-muted);
}
.ui-stk__code {
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.ui-stk__body { display: flex; flex-direction: column; min-width: 0; }
.ui-stk__name {
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-stk__meta {
  overflow: hidden;
  margin-top: 2px;
  font-size: 11px;
  line-height: 15px;
  color: var(--ui-stk-muted);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ui-stk__foot {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px 9px;
  border-top: 1px solid var(--ui-stk-line);
  background: var(--ui-stk-ground);
  animation: ui-stk-foot-in var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both;
}
.ui-stk__pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  align-self: flex-start;
  height: 17px;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--ui-stk-accent-soft);
  color: var(--ui-stk-pill-ink);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}
.ui-stk__pill::before {
  content: "";
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
}
.ui-stk__quote {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  font-size: 12px;
  line-height: 20px;
  color: var(--ui-stk-muted);
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-clamp: 2;
}

@keyframes ui-stk-in {
  from { opacity: 0; transform: translateY(4px); }
}
@keyframes ui-stk-foot-in {
  from { opacity: 0; transform: translateY(2px); }
}

:where(.dark, [data-theme="dark"]) .ui-stk {
  --ui-stk-surface: #201a15;
  --ui-stk-ground: #1a1512;
  --ui-stk-line: rgba(255, 253, 251, 0.08);
  --ui-stk-ink: #f4ece4;
  --ui-stk-muted: #a2958a;
  --ui-stk-thumb: #26201a;
  --ui-stk-thumb-line: rgba(255, 253, 251, 0);
  --ui-stk-accent: #ff6b35;
  --ui-stk-accent-soft: rgba(255, 107, 53, 0.12);
  /* The pill's wash is #351f16 (12% ember over the foot ground). #ff6b35 measures 5.45 on it;
   * the lighter step carries it to 6.31. */
  --ui-stk-pill-ink: var(--accent-hover, #ff8256);
  --ui-stk-success: #4f9d6e;
  --ui-stk-success-soft: rgba(79, 157, 110, 0.16);
  /* #4f9d6e on the warm wash #282f23 measures 4.19, so the badge takes the lighter step,
   * which measures 5.73 on that wash. */
  --ui-stk-badge-ink: #63b884;
  --ui-stk-dot: rgba(255, 253, 251, 0.16);
  --ui-stk-hover: #241d17;
  box-shadow: 0 1px 2px rgba(11, 9, 8, 0.4), 0 10px 24px -16px rgba(11, 9, 8, 0.7);
}

@media (prefers-reduced-motion: reduce) {
  .ui-stk, .ui-stk__foot { animation: none; }
  .ui-stk__row { transition-duration: 1ms; }
}
`;
