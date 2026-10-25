"use client";

import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";

/*
 * Agent Ledger – everything an agent changed, newest first, each row a before → after and a way
 * back. Pointing at a row's Undo previews the consequence before the click: the change itself
 * lights up, the changes built on it are marked "Also undone", and the ones that build on it but
 * can't be taken back are marked "Can't undo". Undoing strikes each row in the chain a beat after
 * the one before it, greys its mark and leaves the row in place, so the history stays readable.
 * Rows never change height – the time, the Undo button and the flags share a single slot.
 * The styles are injected below, so no extra files are needed.
 */

/** One thing the agent changed, and what it would cost to take back. */
export type LedgerRow = {
  id: string;
  /** What happened – "Merged PR #482" */
  action: string;
  /** What it happened to – "Pricing page v2" */
  target?: string;
  /** Where it happened – "GitHub" – shown after the time */
  system?: string;
  /** Before → after, e.g. ["pricing-v2", "main"] */
  change?: readonly [string, string];
  /** A single line instead of a change – "20% off the first year · ends in 7 days" */
  detail?: string;
  /** When it happened, epoch ms */
  at: number;
  /** `false` for changes that can't be taken back: no Undo, and "Can't undo" when they build on one */
  reversible?: boolean;
  /** Ids of the changes this one builds on – undoing one of those undoes this too, if it can */
  dependsOn?: readonly string[];
  /** Brand mark for the tile – a 24×24 SVG is sized to 14px by the sheet */
  icon?: ReactNode;
};

export type AgentLedgerProps = {
  /** The changes, any order – newest is shown first */
  rows: readonly LedgerRow[];
  /** Heading in the bar */
  title?: string;
  /** Who made the changes, next to the title */
  agent?: string;
  /** Ids of the changes already undone – controlled */
  undone?: readonly string[];
  /** Rows undone before the first paint – uncontrolled */
  defaultUndone?: readonly string[];
  /** The row whose Undo is being pointed at – controlled preview */
  previewId?: string | null;
  /** Preview before a pointer lands – uncontrolled */
  defaultPreviewId?: string | null;
  /** The preview moved – `null` when the pointer left */
  onPreviewChange?: (id: string | null) => void;
  /** The row to undo and every reversible change built on it, in the order they cascade */
  onUndo?: (ids: string[]) => void;
  /** Clock for "27s ago", epoch ms – left out, the ledger ticks itself */
  now?: number;
  /** Extra class on the root */
  className?: string;
};

export function AgentLedger({
  rows,
  title = "Ledger",
  agent,
  undone,
  defaultUndone,
  previewId,
  defaultPreviewId = null,
  onPreviewChange,
  onUndo,
  now,
  className,
}: AgentLedgerProps) {
  const labelId = useId();
  /* Rows that were there on the first paint skip the entrance animation; the ones that arrive
     later open a row-height gap and fade in, so a new change never shoves the list. */
  const [initialIds] = useState(() => new Set(rows.map((row) => row.id)));
  const [ownUndone, setOwnUndone] = useState<readonly string[]>(() => defaultUndone ?? []);
  const [ownPreview, setOwnPreview] = useState<string | null>(defaultPreviewId);
  const [tick, setTick] = useState(() => now ?? Date.now());

  useEffect(() => {
    if (now !== undefined) return;
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [now]);

  const clock = now ?? tick;
  const list = [...rows].sort((a, b) => b.at - a.at);
  const undoneIds = undone ?? ownUndone;
  const undoneSet = new Set(undoneIds);
  const pointed = previewId !== undefined ? previewId : ownPreview;
  const handler = pointed ? list.find((row) => row.id === pointed) : undefined;
  const chain =
    handler && handler.reversible !== false && !undoneSet.has(handler.id)
      ? chainOf(list, handler.id, undoneSet)
      : null;
  const depths = undoneDepths(list, undoneSet);

  const point = (id: string | null) => {
    if (previewId === undefined) setOwnPreview(id);
    onPreviewChange?.(id);
  };

  const undo = (ids: string[]) => {
    if (undone === undefined) {
      setOwnUndone((previous) => [...previous, ...ids.filter((id) => !previous.includes(id))]);
    }
    point(null);
    onUndo?.(ids);
  };

  return (
    <div className={["ui-ald", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-agent-ledger" precedence="default">
        {css}
      </style>

      <header className="ui-ald__bar">
        <span className="ui-ald__mark">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="2" y="1.8" width="12" height="12.4" rx="2.6" stroke="currentColor" strokeWidth="1.3" />
            <path
              d="M5 5.4h6M5 8h6M5 10.6h3.6"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="ui-ald__title" id={labelId}>
          {title}
        </span>
        {agent ? <span className="ui-ald__agent">{agent}</span> : null}
        <span className="ui-ald__sum">
          <span>
            <b>{list.length}</b> {list.length === 1 ? "change" : "changes"}
          </span>
          {undoneSet.size > 0 ? (
            <span className="ui-ald__sum-undone">
              <b>{list.filter((row) => undoneSet.has(row.id)).length}</b> undone
            </span>
          ) : null}
        </span>
      </header>

      <ol className="ui-ald__panel" aria-labelledby={labelId}>
        {list.map((row) => {
          const isUndone = undoneSet.has(row.id);
          const canUndo = row.reversible !== false && !isUndone;
          const kind = chain
            ? chain.also.has(row.id)
              ? "also"
              : chain.kept.has(row.id)
                ? "kept"
                : undefined
            : undefined;
          const isPointed = Boolean(chain) && chain?.root === row.id;
          const order = chain && kind ? (chain.order.get(row.id) ?? 0) : isUndone ? (depths.get(row.id) ?? 0) : 0;
          const label = row.target ? `${row.action} ${row.target}` : row.action;

          return (
            <li
              key={row.id}
              className="ui-ald__row"
              data-initial={initialIds.has(row.id) ? "" : undefined}
              data-undone={isUndone ? "" : undefined}
              data-preview={isPointed ? "" : undefined}
              data-chain={kind}
              style={{ "--o": order } as CSSProperties}
            >
              <span className="ui-ald__icon" aria-hidden="true">
                {row.icon ?? (row.system ?? row.action).slice(0, 1)}
              </span>

              <div className="ui-ald__main">
                <span className="ui-ald__what">
                  <span className="ui-ald__action">{row.action}</span>
                  {row.target ? <span className="ui-ald__target">{row.target}</span> : null}
                  <span className="ui-ald__strike" aria-hidden="true" />
                </span>
                {row.change ? (
                  <span className="ui-ald__change">
                    <span className="ui-ald__before">{row.change[0]}</span>
                    <span className="ui-ald__arrow" aria-label="to">
                      →
                    </span>
                    <span className="ui-ald__after">{row.change[1]}</span>
                  </span>
                ) : row.detail ? (
                  <span className="ui-ald__change">
                    <span className="ui-ald__detail">{row.detail}</span>
                  </span>
                ) : null}
              </div>

              <div className="ui-ald__end">
                {kind ? (
                  <span className="ui-ald__flag" data-kind={kind}>
                    {kind === "also" ? "Also undone" : "Can't undo"}
                  </span>
                ) : (
                  <span className="ui-ald__time" data-hide={canUndo ? "" : undefined}>
                    {ago(row.at, clock)}
                    {row.system ? <span className="ui-ald__sys"> · {row.system}</span> : null}
                  </span>
                )}

                {canUndo && !kind ? (
                  <button
                    type="button"
                    className="ui-ald__act"
                    aria-label={`Undo: ${label}`}
                    onClick={() => undo(chainOf(list, row.id, undoneSet).ids)}
                    onPointerEnter={() => point(row.id)}
                    onPointerLeave={() => point(null)}
                    onFocus={() => point(row.id)}
                    onBlur={() => point(null)}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M4 7H15C18.3137 7 21 9.68629 21 13C21 16.3137 18.3137 19 15 19H8"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      />
                      <path
                        d="M8 3L4 7L8 11"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      />
                    </svg>
                    <span className="ui-ald__act-label">Undo</span>
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---------- The chain a change drags with it ---------- */

type Chain = {
  root: string;
  /** The reversible changes built on the root – undone with it */
  also: Set<string>;
  /** The ones that build on it and can't be taken back – they stay, flagged */
  kept: Set<string>;
  /** Root first, then the reversible dependents in the order the strike reaches them */
  ids: string[];
  /** Distance from the root, so the strike cascades a beat apart */
  order: Map<string, number>;
};

function chainOf(rows: readonly LedgerRow[], root: string, undone: Set<string>): Chain {
  const also = new Set<string>();
  const kept = new Set<string>();
  const order = new Map<string, number>([[root, 0]]);
  const ids = [root];
  const queue = [root];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    const step = (order.get(current) ?? 0) + 1;
    for (const row of rows) {
      if (row.id === root || undone.has(row.id)) continue;
      if (also.has(row.id) || kept.has(row.id)) continue;
      if (!(row.dependsOn ?? []).includes(current)) continue;
      order.set(row.id, step);
      if (row.reversible === false) {
        /* What builds on a change that can't be taken back stays too, so the walk stops here. */
        kept.add(row.id);
      } else {
        also.add(row.id);
        ids.push(row.id);
        queue.push(row.id);
      }
    }
  }

  return { root, also, kept, ids, order };
}

/** How far each undone row sits from the undone change it builds on, for its strike delay. */
function undoneDepths(rows: readonly LedgerRow[], undone: Set<string>): Map<string, number> {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const depth = new Map<string, number>();

  const walk = (id: string, seen: Set<string>): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    if (seen.has(id)) return 0;
    seen.add(id);
    let value = 0;
    for (const parent of byId.get(id)?.dependsOn ?? []) {
      if (undone.has(parent)) value = Math.max(value, walk(parent, seen) + 1);
    }
    depth.set(id, value);
    return value;
  };

  for (const id of undone) if (byId.has(id)) walk(id, new Set());
  return depth;
}

/* ---------- Clock ---------- */

const ago = (at: number, now: number) => {
  const seconds = Math.max(1, Math.round((now - at) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const css = /* css */ `
.ui-ald{--ui-alc-panel: #fffdfb;--ui-alc-card: #fffdfb;--ui-alc-strong: #0b0908;--ui-alc-ink: rgba(11, 9, 8, 0.88);--ui-alc-text: rgba(11, 9, 8, 0.61);--ui-alc-muted: rgba(11, 9, 8, 0.45);--ui-alc-faint: rgba(11, 9, 8, 0.27);--ui-alc-line: rgba(11, 9, 8, 0.06);--ui-alc-fill: rgba(11, 9, 8, 0.06);--ui-alc-accent: rgba(217, 84, 31, 0.765);--ui-alc-focus: rgba(217, 84, 31, 0.35);--ui-alc-undo-bg: rgba(217, 84, 31, 0.06);--ui-alc-also-bg: rgba(217, 84, 31, 0.045);--ui-alc-also-fg: #d9541f;--ui-alc-kept-bg: #d9953014;--ui-alc-kept-fg: #d9541f;--ui-alc-ok-fg: #1a7a4ae0;--ui-alc-strike: rgba(11, 9, 8, 0.45);--ui-alc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-alc-ease: cubic-bezier(0.32, 0.72, 0.24, 1);--ui-alc-row: 56px;position: relative;box-sizing: border-box;width: 100%;min-width: 0;container: ui-ald / inline-size;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;font-weight: 400;line-height: 20px;color: var(--ui-alc-text);text-align: left;-webkit-font-smoothing: antialiased}
.ui-ald *, .ui-ald *::before, .ui-ald *::after{box-sizing: border-box}
:where(.ui-ald) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;text-align: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-ald button:focus-visible{outline: 2px solid var(--ui-alc-focus);outline-offset: 1px}
.ui-ald svg{display: block;flex: none}
.ui-ald__bar{display: flex;flex-wrap: wrap;align-items: center;gap: 4px 8px;min-width: 0;margin-bottom: 16px}
.ui-ald__mark{display: grid;flex: none;place-items: center;width: 16px;color: var(--ui-alc-accent)}
.ui-ald__title{flex: none;font-weight: 500;color: var(--ui-alc-strong)}
.ui-ald__agent{min-width: 0;overflow: hidden;color: var(--ui-alc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-ald__sum{display: flex;align-items: center;gap: 14px;margin-left: auto;font-size: 12px;line-height: 16px;color: var(--ui-alc-muted);font-variant-numeric: tabular-nums;white-space: nowrap}
.ui-ald__sum b{font-weight: 500;color: var(--ui-alc-ink)}
.ui-ald__sum-undone{animation: ui-ald-fade 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-ald__panel{display: grid;margin: 0;padding: 4px;overflow: hidden;border-radius: 10px;background: var(--ui-alc-panel);box-shadow: var(--ui-alc-shadow);list-style: none}
.ui-ald__row{position: relative;display: grid;grid-template-columns: 28px minmax(0, 1fr) auto;align-items: center;column-gap: 12px;height: var(--ui-alc-row);padding: 9px 12px 9px 10px;border-radius: 7px;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));animation: ui-ald-grow var(--nm-dur-5, 620ms) var(--ui-alc-ease) backwards}
.ui-ald__row > *{animation: ui-ald-in var(--nm-dur-4, 380ms) var(--ui-alc-ease) 140ms backwards}
.ui-ald__row[data-initial], .ui-ald__row[data-initial] > *{animation: none}
.ui-ald__row + .ui-ald__row::before{content: "";position: absolute;top: -0.25px;right: 12px;left: 50px;height: 0.5px;background: var(--ui-alc-line)}
.ui-ald__row:hover{background: rgba(11, 9, 8, 0.015)}
.ui-ald__row[data-preview]{background: var(--ui-alc-undo-bg)}
.ui-ald__row[data-chain="also"]{background: var(--ui-alc-also-bg)}
.ui-ald__row[data-chain="kept"]{background: var(--ui-alc-kept-bg)}
.ui-ald__row:is([data-preview], [data-chain]) + .ui-ald__row::before, .ui-ald__row:is([data-preview], [data-chain])::before{opacity: 0}
.ui-ald__icon{display: grid;place-items: center;width: 28px;height: 28px;border-radius: 7px;background: var(--ui-alc-card);box-shadow: var(--ui-alc-shadow);font-size: 12px;font-weight: 500;color: var(--ui-alc-text);transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), filter var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-ald__icon > svg{width: 14px;height: 14px}
.ui-ald__main{position: relative;display: grid;min-width: 0}
.ui-ald__what{position: relative;display: flex;align-items: baseline;gap: 6px;justify-self: start;min-width: 0;max-width: 100%;white-space: nowrap}
.ui-ald__action{flex: none;font-weight: 500;color: var(--ui-alc-ink);transition: color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-ald__target{min-width: 0;overflow: hidden;color: var(--ui-alc-text);text-overflow: ellipsis;transition: color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-ald__change{display: flex;align-items: baseline;gap: 6px;min-width: 0;overflow: hidden;font-size: 12px;line-height: 17px;color: var(--ui-alc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-ald__before{flex: none;text-decoration: line-through;text-decoration-color: var(--ui-alc-faint)}
.ui-ald__arrow{flex: none;color: var(--ui-alc-faint)}
.ui-ald__detail{min-width: 0;overflow: hidden;text-overflow: ellipsis}
.ui-ald__after{min-width: 0;overflow: hidden;color: var(--ui-alc-text);text-overflow: ellipsis}
.ui-ald__strike{position: absolute;top: 50%;left: -2px;width: calc(100% + 4px);height: 1px;border-radius: 1px;background: var(--ui-alc-strike);transform: scaleX(0);transform-origin: left;pointer-events: none;transition: transform 380ms var(--ui-alc-ease) calc(var(--o, 0) * 110ms)}
.ui-ald__row[data-undone] .ui-ald__strike{transform: scaleX(1)}
.ui-ald__row[data-undone] :is(.ui-ald__action, .ui-ald__target, .ui-ald__after){color: var(--ui-alc-muted);transition-delay: calc(var(--o, 0) * 110ms)}
.ui-ald__row[data-undone] .ui-ald__icon{opacity: 0.5;filter: grayscale(1);transition-delay: calc(var(--o, 0) * 110ms)}
.ui-ald__end{position: relative;display: grid;justify-items: end;align-items: center;min-width: 108px;height: 24px}
.ui-ald__time{grid-area: 1 / 1;pointer-events: none;font-size: 12px;line-height: 16px;color: var(--ui-alc-muted);white-space: nowrap;font-variant-numeric: tabular-nums;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-ald__row[data-undone] .ui-ald__time{color: var(--ui-alc-faint)}
.ui-ald__act{position: relative;z-index: 1;grid-area: 1 / 1;display: inline-flex;align-items: center;gap: 5px;height: 24px;margin-right: -6px;padding: 0 7px;border-radius: 6px;font-size: 12px;font-weight: 500;color: var(--ui-alc-ink);white-space: nowrap;opacity: 0;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-ald__row:is(:hover, :focus-within) .ui-ald__time[data-hide]{opacity: 0}
.ui-ald__row:is(:hover, :focus-within, [data-preview]) .ui-ald__act{opacity: 1}
.ui-ald__row[data-preview] .ui-ald__time[data-hide]{opacity: 0}
.ui-ald__row[data-preview] .ui-ald__act{background: rgba(217, 84, 31, 0.09);color: var(--ui-alc-also-fg)}
.ui-ald__act:hover{background: var(--ui-alc-fill)}
.ui-ald__flag{grid-area: 1 / 1;display: inline-flex;align-items: center;gap: 4px;height: 20px;padding: 0 7px;border-radius: 5px;font-size: 11.5px;font-weight: 500;line-height: 20px;white-space: nowrap;animation: ui-ald-fade 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-ald__flag[data-kind="also"]{background: rgba(217, 84, 31, 0.09);color: var(--ui-alc-also-fg)}
.ui-ald__flag[data-kind="kept"]{background: #d9953026;color: var(--ui-alc-kept-fg)}
@container ui-ald (max-width: 480px){.ui-ald__sum{flex-basis: 100%;justify-content: space-between;margin-left: 0}
.ui-ald__row{column-gap: 10px;padding: 9px 8px 9px 8px}
.ui-ald__row + .ui-ald__row::before{left: 46px;right: 8px}
.ui-ald__end{min-width: 64px}
.ui-ald__sys{display: none}
.ui-ald__act{width: 28px;justify-content: center;padding: 0}
.ui-ald__act-label{position: absolute;width: 1px;height: 1px;overflow: hidden;clip-path: inset(50%);white-space: nowrap}
}
@media (hover: none){.ui-ald__act{opacity: 1}
.ui-ald__time[data-hide]{opacity: 0}
}
@keyframes ui-ald-grow{from{height: 0;padding-top: 0;padding-bottom: 0}
}
@keyframes ui-ald-in{from{opacity: 0;transform: translateY(-4px)}
}
@keyframes ui-ald-fade{from{opacity: 0}
}
@media (prefers-reduced-motion: reduce){.ui-ald *, .ui-ald *::before, .ui-ald *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-ald{--ui-alc-panel: #211b16;--ui-alc-card: #27201a;--ui-alc-strong: #fffdfb;--ui-alc-ink: rgba(255, 253, 251, 0.9);--ui-alc-text: rgba(255, 253, 251, 0.62);--ui-alc-muted: rgba(255, 253, 251, 0.45);--ui-alc-faint: rgba(255, 253, 251, 0.28);--ui-alc-line: rgba(255, 253, 251, 0.08);--ui-alc-fill: rgba(255, 253, 251, 0.08);--ui-alc-accent: #ff8a5c;--ui-alc-focus: rgba(255, 138, 92, 0.45);--ui-alc-undo-bg: rgba(255, 138, 92, 0.1);--ui-alc-also-bg: rgba(255, 138, 92, 0.07);--ui-alc-also-fg: #ff8a5c;--ui-alc-kept-bg: rgba(232, 176, 92, 0.09);--ui-alc-kept-fg: #e8b05c;--ui-alc-ok-fg: #2f8d5c;--ui-alc-strike: rgba(255, 253, 251, 0.5);--ui-alc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4)}

`;
