"use client";

import { useEffect, useId, useRef, useState } from "react";

/*
 * Comparison Matrix: three products read against the same feature list, with the recommended
 * column standing a little taller than its neighbours. Each column header is a small card that
 * carries a title and one line of method; the raised one adds a badge, an accent ground and a ring,
 * and rises on the entry curve. Every value can carry a help glyph that opens a tip on hover, on
 * focus or on a tap, follows its glyph while the table scrolls, and closes on Escape. Below md the
 * feature-name column pins to the left edge so the three values can scroll under it. Styles are
 * injected below, so no extra files are needed.
 */

export type MatrixColumn = {
  /** Product name, read as the column heading */
  title: string;
  /** One short line under the title saying how the product answers */
  note?: string;
  /** Chip for a raised column; the raised column is never marked by colour alone */
  badge?: string;
};

export type MatrixRow = {
  /** Feature name, shown in small caps down the pinned left column */
  feature: string;
  /** One value per column, in the same order as `columns` */
  values: readonly {
    /** The value, kept short enough to read at a glance */
    text: string;
    /** Longer note behind the help glyph; omit for a value that needs no explanation */
    help?: string;
  }[];
};

export type ComparisonMatrixProps = {
  /** Columns left to right; the raised one is picked by `raisedIndex` */
  columns: readonly MatrixColumn[];
  /** Features top to bottom */
  rows: readonly MatrixRow[];
  /** Names the products under comparison; read by assistive tech, never drawn */
  caption: string;
  /** Zero-based column to raise; leave unset to keep all three level */
  raisedIndex?: number;
  /** Extra class on the root */
  className?: string;
};

type TipState = {
  /** Id of the glyph this tip belongs to, so only one is ever open */
  id: string;
  text: string;
  top: number;
  left: number;
  width: number;
  above: boolean;
};

/* A tip is measured against the glyph it belongs to, then held in place with `position: fixed`
 * so the scroll container cannot clip it. A short screen opens it upward instead. */
const TIP_WIDTH = 240;
const TIP_GAP = 8;
const TIP_FLOOR = 104;

export function ComparisonMatrix({
  columns,
  rows,
  caption,
  raisedIndex = -1,
  className,
}: ComparisonMatrixProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const anchor = useRef<HTMLElement | null>(null);
  const [tip, setTip] = useState<TipState | null>(null);

  const place = (element: HTMLElement, id: string, text: string) => {
    if (typeof window === "undefined") return;
    const rect = element.getBoundingClientRect();
    const width = Math.min(TIP_WIDTH, Math.max(168, window.innerWidth - 24));
    const left = Math.min(
      Math.max(12, rect.right - width),
      Math.max(12, window.innerWidth - width - 12),
    );
    const above = rect.bottom + TIP_FLOOR > window.innerHeight;
    const next: TipState = {
      id,
      text,
      top: above ? rect.top - TIP_GAP : rect.bottom + TIP_GAP,
      left,
      width,
      above,
    };
    /* A scroll frame that lands on the same pixel must not re-render the table. */
    setTip((current) => {
      if (
        current !== null &&
        current.id === next.id &&
        current.top === next.top &&
        current.left === next.left &&
        current.width === next.width &&
        current.above === next.above
      ) {
        return current;
      }
      return next;
    });
  };

  const open = (element: HTMLElement, id: string, text: string) => {
    anchor.current = element;
    place(element, id, text);
  };

  const close = () => {
    anchor.current = null;
    setTip(null);
  };

  /* The tip is fixed, so it has to be re-measured whenever the table moves under it. */
  useEffect(() => {
    if (tip === null) return;
    const id = tip.id;
    const text = tip.text;
    let frame = 0;
    const reposition = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const element = anchor.current;
        if (element !== null) place(element, id, text);
      });
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [tip]);

  return (
    <div className={["ui-cmx", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-comparison-matrix" precedence="default">
        {css}
      </style>

      <div className="ui-cmx__scroll" role="region" aria-label={caption} tabIndex={0}>
        <table className="ui-cmx__table">
          <caption className="ui-cmx__sr">{caption}</caption>

          <thead>
            <tr>
              <th scope="col" className="ui-cmx__corner">
                <span className="ui-cmx__sr">Feature</span>
              </th>
              {columns.map((column, index) => (
                <th
                  key={`${column.title}-${index}`}
                  scope="col"
                  className="ui-cmx__colhead"
                  data-raised={index === raisedIndex ? "true" : undefined}
                >
                  <span className="ui-cmx__card">
                    <span className="ui-cmx__coltitle">{column.title}</span>
                    {column.note ? <span className="ui-cmx__colnote">{column.note}</span> : null}
                    {index === raisedIndex && column.badge ? (
                      <span className="ui-cmx__badge">{column.badge}</span>
                    ) : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${row.feature}-${rowIndex}`} className="ui-cmx__row">
                <th scope="row" className="ui-cmx__feature">
                  {row.feature}
                </th>
                {columns.map((column, columnIndex) => {
                  const cell = row.values[columnIndex];
                  const help = cell?.help ?? "";
                  const tipId = `${uid}-tip-${rowIndex}-${columnIndex}`;
                  const isOpen = tip !== null && tip.id === tipId;
                  return (
                    <td
                      key={`${column.title}-${columnIndex}`}
                      className="ui-cmx__cell"
                      data-raised={columnIndex === raisedIndex ? "true" : undefined}
                      data-help={help !== "" ? "true" : undefined}
                    >
                      {cell ? cell.text : null}
                      {help !== "" ? (
                        <>
                          <button
                            type="button"
                            className="ui-cmx__help"
                            aria-label={`Help: ${row.feature} in ${column.title}`}
                            aria-expanded={isOpen}
                            aria-describedby={isOpen ? tipId : undefined}
                            onClick={(event) => {
                              if (isOpen) close();
                              else open(event.currentTarget, tipId, help);
                            }}
                            onMouseEnter={(event) => {
                              if (!isOpen) open(event.currentTarget, tipId, help);
                            }}
                            onMouseLeave={(event) => {
                              if (document.activeElement !== event.currentTarget) close();
                            }}
                            onFocus={(event) => open(event.currentTarget, tipId, help)}
                            onBlur={(event) => {
                              const next = event.relatedTarget;
                              if (next instanceof HTMLElement && next.dataset.cmxTip === "true") {
                                return;
                              }
                              close();
                            }}
                            onKeyDown={(event) => {
                              if (event.key !== "Escape") return;
                              event.stopPropagation();
                              close();
                            }}
                          >
                            <span aria-hidden="true">?</span>
                          </button>
                          {tip !== null && tip.id === tipId ? (
                            <span
                              className="ui-cmx__tip-wrap"
                              data-above={tip.above ? "true" : undefined}
                              style={{ top: tip.top, left: tip.left, width: tip.width }}
                            >
                              <span
                                className="ui-cmx__tip"
                                id={tipId}
                                role="tooltip"
                                tabIndex={0}
                                data-cmx-tip="true"
                                onBlur={(event) => {
                                  const next = event.relatedTarget;
                                  if (next instanceof HTMLElement && next.dataset.cmxTip === "true") {
                                    return;
                                  }
                                  close();
                                }}
                                onKeyDown={(event) => {
                                  if (event.key !== "Escape") return;
                                  event.stopPropagation();
                                  const button = anchor.current;
                                  close();
                                  button?.focus();
                                }}
                              >
                                {tip.text}
                              </span>
                            </span>
                          ) : null}
                        </>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const css = /* css */ `
.ui-cmx {
  /* Knobs. Override any of these on .ui-cmx to retheme the matrix in a host. */
  --ui-cmx-ground: var(--bg, #faf7f4);
  --ui-cmx-ink: var(--text, #1a1410);
  --ui-cmx-muted: var(--text-muted, #6f625a);
  --ui-cmx-label: color-mix(in srgb, var(--text, #1a1410) 74%, transparent);
  --ui-cmx-line: var(--border, #e8e0d7);
  --ui-cmx-edge: var(--border-soft, #1a14101a);
  /* Row rules are read against the ground, where --border (#e8e0d7 on #faf7f4) is a 1.06:1
   * whisper. This mix of the ink token reads as a hairline in both themes. */
  --ui-cmx-rule: color-mix(in srgb, var(--text, #1a1410) 14%, transparent);
  --ui-cmx-wash: #7a4a1c0a;
  /* The unraised header cards get a real surface step, so the raised one leads by accent, badge
   * and lift rather than by being the only column that reads as a card. */
  --ui-cmx-card: var(--panel-raised, #ffffff);
  --ui-cmx-card-stroke: var(--border-soft, #1a14101a);
  --ui-cmx-accent: var(--accent, #c2410c);
  --ui-cmx-accent-wash: #c2410c0f;
  --ui-cmx-accent-wash-strong: #c2410c1a;
  /* The raised column title sits on that strong wash: the base accent (#c2410c) reads 4.22:1 on
   * the composited #f4e5dd, under AA at 14.4px. This step measures 5.95:1 there. */
  --ui-cmx-coltitle-ink: var(--accent-hover, #9a3412);
  --ui-cmx-accent-ring: #c2410c59;
  --ui-cmx-accent-shadow: #c2410c33;
  --ui-cmx-badge-ink: #fff8f4;
  --ui-cmx-tip: #2a211a;
  --ui-cmx-tip-ink: #f8f1ea;
  --ui-cmx-focus: var(--accent, #c2410c);
  --ui-cmx-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-cmx-ease-both: var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1));
  --ui-cmx-dur-1: var(--nm-dur-1, 90ms);
  --ui-cmx-dur-2: var(--nm-dur-2, 160ms);
  --ui-cmx-dur-4: var(--nm-dur-4, 380ms);

  position: relative;
  box-sizing: border-box;
  width: 100%;
  /* A grid or flex parent sizes this by min-content, which the table's min-width would push past
   * the viewport. Zeroing it lets the scroll frame be the thing that overflows. */
  min-width: 0;
  background: var(--ui-cmx-ground, #faf7f4);
  border-radius: var(--radius-card, 16px);
  box-shadow: inset 0 0 0 1px var(--ui-cmx-line, #e8e0d7);
  color: var(--ui-cmx-ink, #1a1410);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  line-height: 20px;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-cmx *,
.ui-cmx *::before,
.ui-cmx *::after {
  box-sizing: border-box;
}
:where(.ui-cmx) button {
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
:where(.ui-cmx) svg {
  display: block;
}

/* Scroll frame ------------------------------------------------------------ */
.ui-cmx__scroll {
  overflow-x: auto;
  border-radius: inherit;
}
.ui-cmx__scroll:focus-visible {
  outline: 2px solid var(--ui-cmx-focus, #c2410c);
  outline-offset: -2px;
}

.ui-cmx__table {
  width: 100%;
  min-width: 52rem;
  border-collapse: separate;
  border-spacing: 3px 0;
  /* Fixed layout gives the three products the same width. With auto layout the longest cell set
   * the width, so the raised column ran 349px against a 213px neighbour and led by size as well
   * as by accent. The corner keeps its 13rem; the rest divides evenly. */
  table-layout: fixed;
}

/* Header ------------------------------------------------------------------ */
.ui-cmx__corner {
  width: 13rem;
  padding: 12px 14px 10px;
  text-align: left;
  vertical-align: bottom;
  font-weight: 500;
}
.ui-cmx__colhead {
  padding: 10px 0 0;
  vertical-align: bottom;
  text-align: left;
  font-weight: 500;
}
.ui-cmx__card {
  display: grid;
  gap: 3px;
  padding: 12px 14px 13px;
  border-radius: var(--radius-preview, 12px);
  background: var(--ui-cmx-card, #ffffff);
  box-shadow: inset 0 0 0 1px var(--ui-cmx-card-stroke, #1a14101a);
}
/* The raised card sits a step above its neighbours and lands on the shared curve. */
.ui-cmx__colhead[data-raised="true"] .ui-cmx__card {
  gap: 4px;
  padding-bottom: 14px;
  background: var(--ui-cmx-accent-wash-strong, #c2410c1a);
  box-shadow:
    inset 0 0 0 1px var(--ui-cmx-accent-ring, #c2410c59),
    0 10px 20px -14px var(--ui-cmx-accent-shadow, #c2410c33);
  animation: ui-cmx-rise var(--ui-cmx-dur-4, 380ms) var(--ui-cmx-ease-both, cubic-bezier(0.65, 0, 0.35, 1)) both;
}
.ui-cmx__coltitle {
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.015em;
  color: var(--ui-cmx-ink, #1a1410);
}
.ui-cmx__colhead[data-raised="true"] .ui-cmx__coltitle {
  color: var(--ui-cmx-coltitle-ink, #9a3412);
}
.ui-cmx__colnote {
  font-size: 0.72rem;
  line-height: 1.35;
  color: var(--ui-cmx-muted, #6f625a);
}
.ui-cmx__badge {
  justify-self: start;
  margin-top: 3px;
  padding: 2px 9px;
  border-radius: 999px;
  background: var(--ui-cmx-accent, #c2410c);
  color: var(--ui-cmx-badge-ink, #fff8f4);
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 18px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}

/* Rows -------------------------------------------------------------------- */
/* The feature column carries a wash so it reads as the row's heading rather than as stray small
 * caps floating in the same ground as the values. The empty corner stays on the ground: tinting it
 * would turn a dead corner into a filled block that competes with the raised column. */
.ui-cmx__feature {
  width: 13rem;
  padding: 15px 14px;
  text-align: left;
  vertical-align: middle;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 18px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ui-cmx-label, #6f625a);
  background:
    linear-gradient(var(--ui-cmx-wash, #7a4a1c0a), var(--ui-cmx-wash, #7a4a1c0a)),
    var(--ui-cmx-ground, #faf7f4);
  box-shadow: inset 0 -1px 0 var(--ui-cmx-rule, #1a141024);
}
.ui-cmx__cell {
  position: relative;
  padding: 15px 14px;
  vertical-align: middle;
  font-size: 0.82rem;
  line-height: 20px;
  color: var(--ui-cmx-ink, #1a1410);
  box-shadow: inset 0 -1px 0 var(--ui-cmx-rule, #1a141024);
}
/* The glyph is placed against the cell, not against the end of the text, so every row puts it in
 * the same spot and a two-line value cannot push it down the column. */
.ui-cmx__cell[data-help="true"] {
  padding-right: 46px;
}
.ui-cmx__cell[data-raised="true"] {
  background: var(--ui-cmx-accent-wash, #c2410c0f);
}
/* The last row closes on the card frame, so its rule would double the edge. */
.ui-cmx__row:last-child > .ui-cmx__feature,
.ui-cmx__row:last-child > .ui-cmx__cell {
  box-shadow: none;
}

/* Help glyph and tip ------------------------------------------------------ */
.ui-cmx__help {
  position: absolute;
  top: 50%;
  right: 14px;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: var(--ui-cmx-muted, #6f625a);
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--ui-cmx-edge, #1a14101a);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  transition:
    color var(--ui-cmx-dur-1, 90ms) var(--ui-cmx-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    background-color var(--ui-cmx-dur-2, 160ms) var(--ui-cmx-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    box-shadow var(--ui-cmx-dur-2, 160ms) var(--ui-cmx-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-cmx__help:hover {
  color: var(--ui-cmx-accent, #c2410c);
  background: var(--ui-cmx-accent-wash, #c2410c0f);
  box-shadow: inset 0 0 0 1px var(--ui-cmx-accent-ring, #c2410c59);
}
.ui-cmx__help:focus-visible {
  outline: 2px solid var(--ui-cmx-focus, #c2410c);
  outline-offset: 2px;
}
.ui-cmx__help[aria-expanded="true"] {
  color: var(--ui-cmx-accent, #c2410c);
  box-shadow: inset 0 0 0 1px var(--ui-cmx-accent-ring, #c2410c59);
}
.ui-cmx__tip-wrap {
  position: fixed;
  z-index: 60;
  transform: translateY(0);
  pointer-events: none;
}
.ui-cmx__tip-wrap[data-above="true"] {
  transform: translateY(-100%);
}
.ui-cmx__tip {
  display: block;
  padding: 8px 10px;
  border-radius: var(--radius-preview, 12px);
  background: var(--ui-cmx-tip, #2a211a);
  color: var(--ui-cmx-tip-ink, #f8f1ea);
  font-size: 0.72rem;
  line-height: 1.45;
  letter-spacing: 0;
  box-shadow:
    0 12px 28px -12px #00000059,
    inset 0 0 0 1px #ffffff14;
  pointer-events: auto;
  animation: ui-cmx-tip-in var(--ui-cmx-dur-2, 160ms) var(--ui-cmx-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both;
}
.ui-cmx__tip:focus-visible {
  outline: 2px solid var(--ui-cmx-focus, #c2410c);
  outline-offset: 2px;
}
.ui-cmx__tip-wrap[data-above="true"] .ui-cmx__tip {
  animation-name: ui-cmx-tip-in-up;
}

@keyframes ui-cmx-rise {
  from {
    opacity: 0;
    transform: translateY(7px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes ui-cmx-tip-in {
  from {
    opacity: 0;
    transform: translateY(-3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes ui-cmx-tip-in-up {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Pinned feature column --------------------------------------------------- */
/* Below md the three values scroll under the feature names, which stay on the section ground. */
@media (max-width: 767px) {
  .ui-cmx__corner,
  .ui-cmx__feature {
    position: sticky;
    left: 0;
    z-index: 2;
    width: 10.5rem;
    min-width: 10.5rem;
    max-width: 10.5rem;
  }
  .ui-cmx__corner {
    background: var(--ui-cmx-ground, #faf7f4);
    box-shadow: 3px 0 0 var(--ui-cmx-ground, #faf7f4), 4px 0 0 var(--ui-cmx-line, #e8e0d7);
  }
  .ui-cmx__feature {
    box-shadow:
      inset 0 -1px 0 var(--ui-cmx-rule, #1a141024),
      3px 0 0 var(--ui-cmx-ground, #faf7f4),
      4px 0 0 var(--ui-cmx-line, #e8e0d7);
  }
  /* The pinned column keeps its scroll edge on the closing row. */
  .ui-cmx__row:last-child > .ui-cmx__feature {
    box-shadow:
      3px 0 0 var(--ui-cmx-ground, #faf7f4),
      4px 0 0 var(--ui-cmx-line, #e8e0d7);
  }
}
/* On a phone the frame is about 230px wide, and a 168px pin left barely 60px of value showing.
 * The pin gives up width and tracking so a whole value still lands beside its feature. */
@media (max-width: 479px) {
  .ui-cmx__corner,
  .ui-cmx__feature {
    width: 6rem;
    min-width: 6rem;
    max-width: 6rem;
  }
  .ui-cmx__corner {
    padding: 10px 10px 8px;
  }
  .ui-cmx__feature {
    padding: 13px 10px;
    font-size: 0.7rem;
    letter-spacing: 0.07em;
  }
  .ui-cmx__cell {
    padding: 13px 10px;
  }
  .ui-cmx__cell[data-help="true"] {
    padding-right: 38px;
  }
  .ui-cmx__help {
    right: 9px;
    width: 22px;
    height: 22px;
    font-size: 11px;
  }
  /* At 52rem each value column was 310px, wider than the 230px frame, so no scroll position could
   * show one whole. Here a column is 131px plus its 3px gutter, exactly the 134px left beside the
   * pin, so the last column scrolls fully clear of it instead of ending 3px underneath. */
  .ui-cmx__table {
    table-layout: fixed;
    min-width: 31.3125rem;
  }
  .ui-cmx__colhead {
    width: 8.1875rem;
  }
  .ui-cmx__card {
    padding: 10px 10px 11px;
  }
  .ui-cmx__coltitle {
    font-size: 0.82rem;
  }
  /* The card leaves the pill 114px and it was 127px, so it hung over the frame. At zero tracking
   * with tight side padding it is 119px, so the pill spans the card and centres its label. */
  .ui-cmx__badge {
    justify-self: stretch;
    padding: 2px 2px;
    letter-spacing: 0;
    text-align: center;
  }
}

.ui-cmx__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

:where(.dark, [data-theme="dark"]) .ui-cmx {
  --ui-cmx-ground: var(--bg, #14100d);
  --ui-cmx-ink: var(--text, #f4ece4);
  --ui-cmx-muted: var(--text-muted, #a2958a);
  --ui-cmx-label: color-mix(in srgb, var(--text, #f4ece4) 74%, transparent);
  --ui-cmx-line: var(--border, #33291f);
  --ui-cmx-edge: var(--border-soft, #ffffff12);
  --ui-cmx-wash: #ffffff0d;
  --ui-cmx-card: var(--panel-raised, #231d18);
  --ui-cmx-card-stroke: var(--border-soft, #ffffff12);
  --ui-cmx-accent: var(--accent, #ff6b35);
  --ui-cmx-accent-wash: #ff6b350f;
  --ui-cmx-accent-wash-strong: #ff6b351a;
  /* Same title on the dark warm wash (#562b1b): the accent reads 4.22:1, this step 4.88:1. */
  --ui-cmx-coltitle-ink: var(--accent-hover, #ff8256);
  --ui-cmx-accent-ring: #ff6b3559;
  --ui-cmx-accent-shadow: #00000080;
  --ui-cmx-badge-ink: #1a1008;
  --ui-cmx-tip: #26201a;
  --ui-cmx-tip-ink: #f4ece4;
  --ui-cmx-focus: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  .ui-cmx__help {
    transition-duration: 1ms;
  }
  .ui-cmx__colhead[data-raised="true"] .ui-cmx__card,
  .ui-cmx__tip {
    animation: none;
  }
}
`;
