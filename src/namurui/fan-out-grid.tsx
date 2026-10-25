"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/*
 * Fan-out Grid – one job, many workers: every task is a cell.
 *
 * Cells arrive in a quick wave. A running cell carries a shine that sweeps across it, each one
 * out of step with its neighbours; a retrying cell breathes amber while it waits to go again;
 * done and failed cells pop the instant they land. The grid is a single tab stop – the arrow
 * keys walk from cell to cell, the details window opens under whichever one you are on, and
 * Enter keeps it open while you move away. The footer counts the states and filters the grid
 * down to one of them; when anything has failed it offers a retry for the whole set.
 */

export type FanoutStatus = "queued" | "running" | "retrying" | "done" | "failed";

export type FanoutTask = {
  id: string;
  /** Short name – the details heading and what the live region reads out */
  label: string;
  status: FanoutStatus;
  /** Which worker took it, e.g. "w-07" */
  worker?: string;
  /** Start and end in milliseconds from the start of the job */
  start?: number;
  end?: number;
  /** What it cost, in whole currency units */
  cost?: number;
  /** 1 for a first run; 2 and up show in the details */
  attempts?: number;
  /** What it produced, shown once it is done */
  result?: string;
  /** Why it gave up, shown once it has failed */
  error?: string;
};

export type FanoutGridProps = {
  tasks: FanoutTask[];
  /** What the whole job does, beside the title – e.g. "Enrich 240 leads" */
  job?: string;
  /** How many workers run at once; the time left is worked out from it */
  workers?: number;
  /** The clock, in milliseconds from the start of the job */
  now?: number;
  /** Gets the ids of every failed task once "Retry failed" is pressed */
  onRetry?: (ids: string[]) => void;
  /** A cell was reached (hover, arrow keys, click) – null when it is let go */
  onSelect?: (task: FanoutTask | null) => void;
  /** Formats every cost, in the header and in the details */
  formatCost?: (amount: number) => string;
  /** Heading of the bar */
  title?: string;
  /** A mark before the title, e.g. the agent's logo */
  icon?: ReactNode;
  className?: string;
};

/** The footer counts the states worth watching; queued is the bulk and stays out of it. */
const ORDER: FanoutStatus[] = ["done", "running", "retrying", "failed"];

/** Pill labels – a status, not a count. */
const LABELS: Record<FanoutStatus, string> = {
  queued: "Queued",
  running: "Running",
  retrying: "Retrying",
  done: "Done",
  failed: "Failed",
};

/** How long a single task took: "820ms", "2.4s", "1m 06s". */
function timing(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "–";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
}

/** How much is left of the whole job: "14s", "1m 20s". */
function clock(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 1) return "under a second";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

/** The line the live region reads for the cell under the cursor. */
function describe(task: FanoutTask, formatCost: (amount: number) => string): string {
  const parts = [`${task.label}.`, `${LABELS[task.status]}.`];
  if (task.worker) parts.push(`${task.worker}.`);
  if (task.attempts !== undefined && task.attempts > 1) parts.push(`Attempt ${task.attempts}.`);
  if (task.cost !== undefined) parts.push(`${formatCost(task.cost)}.`);
  if (task.error) parts.push(task.error);
  else if (task.result) parts.push(task.result);
  return parts.join(" ");
}

export function FanoutGrid({
  tasks,
  job,
  workers,
  now = 0,
  onRetry,
  onSelect,
  formatCost = (amount: number) => `$${amount.toFixed(2)}`,
  title = "Fan-out",
  icon,
  className,
}: FanoutGridProps) {
  const [filter, setFilter] = useState<FanoutStatus | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);
  const [tip, setTip] = useState({ left: 0, top: 0, origin: 0, below: false });
  const [resize, setResize] = useState(0);

  const gridRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const counts: Record<FanoutStatus, number> = {
    queued: 0,
    running: 0,
    retrying: 0,
    done: 0,
    failed: 0,
  };
  for (const task of tasks) counts[task.status] += 1;

  const finished = counts.done + counts.failed;
  const left = tasks.length - finished;
  const spent = tasks.reduce((sum, task) => sum + (task.cost ?? 0), 0);

  // Average length of a finished task, so the time left follows what the workers actually do.
  const settled = tasks.filter(
    (task) => task.status === "done" && task.start !== undefined && task.end !== undefined,
  );
  const mean = settled.length
    ? settled.reduce((sum, task) => sum + Math.max(0, (task.end as number) - (task.start as number)), 0) /
      settled.length
    : 0;
  const concurrency = Math.max(1, workers ?? counts.running);
  const eta = left > 0 && mean > 0 ? (left / concurrency) * mean : null;

  const activeTask = active !== null ? (tasks[active] ?? null) : null;

  /* The live region carries the count while nothing is picked and the cell's details once
   * one is – one region, so a screen reader hears one thing at a time. */
  const progress = `${finished} of ${tasks.length} done.`;
  const spoken = activeTask ? describe(activeTask, formatCost) : progress;
  const [said, setSaid] = useState({ text: progress, step: 0 });

  useEffect(() => {
    setSaid((prev) => (prev.text === spoken ? prev : { text: spoken, step: prev.step + 1 }));
  }, [spoken]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const observer = new ResizeObserver(() => setResize((value) => value + 1));
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  // The details window sits over the panel, anchored to the cell it belongs to.
  useLayoutEffect(() => {
    const grid = gridRef.current;
    const panel = panelRef.current;
    const card = tipRef.current;
    if (active === null || !grid || !panel || !card) return;
    const cell = grid.children[active] as HTMLElement;
    if (!cell) return;

    const panelBox = panel.getBoundingClientRect();
    const cellBox = cell.getBoundingClientRect();
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    const centre = cellBox.left - panelBox.left + cellBox.width / 2;
    const run = panelBox.width - width - 8;
    const nextLeft = Math.min(Math.max(centre - width / 2, 8), Math.max(8, run));
    const top = cellBox.top - panelBox.top;
    // Near the top edge the window has nowhere to go but below the cell.
    const below = top < height + 12;
    const nextTop = below ? cellBox.bottom - panelBox.top + 8 : top - height - 8;

    setTip((prev) =>
      prev.left === nextLeft && prev.top === nextTop && prev.origin === centre - nextLeft && prev.below === below
        ? prev
        : { left: nextLeft, top: nextTop, origin: centre - nextLeft, below },
    );
  }, [active, tasks, resize]);

  const choose = (index: number | null, pin: boolean) => {
    const task = index !== null ? (tasks[index] ?? null) : null;
    setActive(task ? index : null);
    setPinned(pin && task !== null);
    onSelect?.(task);
  };

  const columns = () => {
    const grid = gridRef.current;
    if (!grid) return 1;
    const template = getComputedStyle(grid).gridTemplateColumns;
    return Math.max(1, template ? template.split(" ").filter(Boolean).length : 1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = columns();
    const moves = ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End"];

    if (event.key === "Escape") {
      if (active === null) return;
      event.preventDefault();
      choose(null, false);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      if (active === null) return;
      event.preventDefault();
      if (pinned) choose(null, false);
      else choose(active, true);
      return;
    }
    if (!moves.includes(event.key)) return;
    event.preventDefault();
    if (active === null) {
      choose(event.key === "End" ? tasks.length - 1 : 0, false);
      return;
    }
    const last = tasks.length - 1;
    let next = active;
    if (event.key === "ArrowRight") next = Math.min(last, active + 1);
    else if (event.key === "ArrowLeft") next = Math.max(0, active - 1);
    else if (event.key === "ArrowDown") next = Math.min(last, active + step);
    else if (event.key === "ArrowUp") next = Math.max(0, active - step);
    else if (event.key === "Home") next = 0;
    else next = last;
    if (next !== active) choose(next, pinned);
  };

  const failedIds = tasks.filter((task) => task.status === "failed").map((task) => task.id);
  const timeText = left === 0 ? "done" : eta === null ? "estimating…" : `~${clock(eta)} left`;

  return (
    <div className={["ui-fogc", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many grids render */}
      <style href="ui-fan-out-grid" precedence="default">
        {css}
      </style>

      <header className="ui-fogc__bar">
        <span className="ui-fogc__mark">{icon ?? <Mark />}</span>
        <span className="ui-fogc__title">{title}</span>
        {job && <span className="ui-fogc__job">{job}</span>}
        <span className="ui-fogc__sum">
          <span>
            <b>{finished}</b> / {tasks.length}
          </span>
          <span>
            <b>{formatCost(spent)}</b>
          </span>
          <span className="ui-fogc__time" data-done={left === 0 ? "" : undefined}>
            {timeText}
          </span>
        </span>
      </header>

      <div
        className="ui-fogc__panel"
        ref={panelRef}
        onPointerLeave={() => {
          if (!pinned) choose(null, false);
        }}
      >
        <div
          className="ui-fogc__grid"
          ref={gridRef}
          role="group"
          aria-label={`${tasks.length} tasks – arrow keys move, Enter keeps the details`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (active === null && tasks.length > 0) choose(0, false);
          }}
          onBlur={() => {
            setPinned(false);
            choose(null, false);
          }}
        >
          {tasks.map((task, index) => (
            <span
              key={task.id}
              className="ui-fogc__cell"
              data-status={task.status}
              data-on={index === active ? "" : undefined}
              data-pinned={index === active && pinned ? "" : undefined}
              data-dim={filter !== null && task.status !== filter ? "" : undefined}
              style={{ "--i": index } as CSSProperties}
              onPointerEnter={() => {
                if (!pinned) choose(index, false);
              }}
              onClick={() => {
                gridRef.current?.focus();
                if (pinned && index === active) choose(null, false);
                else choose(index, true);
              }}
            />
          ))}
        </div>

        <div className="ui-fogc__foot">
          <div className="ui-fogc__legend" role="group" aria-label="Show only">
            {ORDER.map((status) => (
              <button
                key={status}
                type="button"
                className="ui-fogc__key"
                data-status={status}
                aria-pressed={filter === status}
                data-zero={counts[status] === 0 ? "" : undefined}
                data-off={filter !== null && filter !== status ? "" : undefined}
                onClick={() => setFilter((current) => (current === status ? null : status))}
              >
                <span className="ui-fogc__swatch" aria-hidden="true" />
                <span className="ui-fogc__n">{counts[status]}</span> {status}
              </button>
            ))}
          </div>

          {failedIds.length > 0 && onRetry && (
            <button type="button" className="ui-fogc__retry" onClick={() => onRetry(failedIds)}>
              <RetryIcon />
              Retry failed
            </button>
          )}
        </div>

        {activeTask && (
          <div
            className="ui-fogc__tip"
            ref={tipRef}
            data-side={tip.below ? "below" : undefined}
            style={{ left: tip.left, top: tip.top, "--x": `${tip.origin}px` } as CSSProperties}
            aria-hidden="true"
          >
            <div className="ui-fogc__tip-head">
              <span className="ui-fogc__tip-label">{activeTask.label}</span>
              <span className="ui-fogc__pill" data-status={activeTask.status}>
                {LABELS[activeTask.status]}
              </span>
            </div>
            <span className="ui-fogc__tip-meta">
              {[
                activeTask.worker,
                activeTask.status !== "queued" && activeTask.start !== undefined
                  ? timing(Math.max(0, (activeTask.end ?? now) - activeTask.start))
                  : null,
                activeTask.attempts !== undefined && activeTask.attempts > 1
                  ? `attempt ${activeTask.attempts}`
                  : null,
                activeTask.cost !== undefined ? formatCost(activeTask.cost) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {activeTask.error && <span className="ui-fogc__tip-error">{activeTask.error}</span>}
            {!activeTask.error && activeTask.result && (
              <span className="ui-fogc__tip-result">{activeTask.result}</span>
            )}
          </div>
        )}
      </div>

      <div className="ui-fogc__sr" aria-live="polite" aria-atomic="true" data-step={said.step}>
        {said.text}
      </div>
    </div>
  );
}

/* ---------- Marks ---------- */

/** One source fanning out into three sinks. */
function Mark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="3" cy="8" r="1.9" fill="currentColor" />
      <rect x="10.2" y="1.6" width="3.6" height="3.6" rx="1" fill="currentColor" opacity="0.9" />
      <rect x="10.2" y="6.2" width="3.6" height="3.6" rx="1" fill="currentColor" opacity="0.6" />
      <rect x="10.2" y="10.8" width="3.6" height="3.6" rx="1" fill="currentColor" opacity="0.3" />
      <path
        d="M4.9 8H7c.6 0 .9-.3 1-.9l.4-2.4c.1-.6.4-.9 1-.9h.6M4.9 8h5.1M4.9 8H7c.6 0 .9.3 1 .9l.4 2.4c.1.6.4.9 1 .9h.6"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** An arrow coming back around on itself. */
function RetryIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M13 8a5 5 0 1 1-1.6-3.6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M13.3 2.6v2.8H10.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---------- Styles ---------- */

const css = /* css */ `
.ui-fogc{--ui-fogc-panel: #fffdfb;--ui-fogc-card: #fffdfb;--ui-fogc-strong: #0b0908;--ui-fogc-ink: rgba(11, 9, 8, 0.88);--ui-fogc-text: rgba(11, 9, 8, 0.61);--ui-fogc-muted: rgba(11, 9, 8, 0.45);--ui-fogc-faint: rgba(11, 9, 8, 0.27);--ui-fogc-line: rgba(11, 9, 8, 0.06);--ui-fogc-fill: rgba(11, 9, 8, 0.06);--ui-fogc-accent: rgba(217, 84, 31, 0.765);--ui-fogc-focus: rgba(217, 84, 31, 0.35);--ui-fogc-queued-bg: rgba(11, 9, 8, 0.035);--ui-fogc-queued-edge: rgba(11, 9, 8, 0.07);--ui-fogc-running-bg: rgba(217, 84, 31, 0.12);--ui-fogc-running-edge: rgba(217, 84, 31, 0.36);--ui-fogc-running-ink: #d9541f;--ui-fogc-retrying-bg: #d9953030;--ui-fogc-retrying-edge: rgba(217, 149, 48, 0.45);--ui-fogc-retrying-ink: #d9541f;--ui-fogc-done-bg: rgba(26, 122, 74, 0.2);--ui-fogc-done-edge: rgba(26, 122, 74, 0.38);--ui-fogc-done-ink: #1a7a4ae0;--ui-fogc-failed-bg: #b3261e2e;--ui-fogc-failed-edge: rgba(179, 38, 30, 0.48);--ui-fogc-failed-ink: #b3261eda;--ui-fogc-shine: rgba(255, 253, 251, 0.85);--ui-fogc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-fogc-pop: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 12px 28px -10px rgba(11, 9, 8, 0.18), 0 1px 2px rgba(11, 9, 8, 0.05);--ui-fogc-cell: 12px;--ui-fogc-gap: 4px;--ui-fogc-ease: cubic-bezier(0.32, 0.72, 0.24, 1);position: relative;box-sizing: border-box;width: 100%;min-width: 0;container: ui-fogc / inline-size;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;font-weight: 400;line-height: 20px;color: var(--ui-fogc-text);text-align: left;-webkit-font-smoothing: antialiased}
.ui-fogc *, .ui-fogc *::before, .ui-fogc *::after{box-sizing: border-box}
:where(.ui-fogc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;text-align: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-fogc button:focus-visible{outline: 2px solid var(--ui-fogc-focus);outline-offset: 1px}
.ui-fogc svg{display: block;flex: none}
.ui-fogc__sr{position: absolute;width: 1px;height: 1px;overflow: hidden;clip-path: inset(50%);white-space: nowrap}
.ui-fogc__n{font-variant-numeric: tabular-nums}
.ui-fogc__bar{display: flex;flex-wrap: wrap;align-items: center;gap: 4px 8px;min-width: 0;margin-bottom: 16px}
.ui-fogc__mark{display: grid;flex: none;place-items: center;width: 16px;color: var(--ui-fogc-accent)}
.ui-fogc__mark > svg{width: 16px;height: 16px}
.ui-fogc__title{flex: none;font-weight: 500;color: var(--ui-fogc-strong)}
.ui-fogc__job{min-width: 0;overflow: hidden;color: var(--ui-fogc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-fogc__sum{display: flex;flex-wrap: wrap;align-items: center;gap: 2px 14px;margin-left: auto;font-size: 12px;line-height: 16px;color: var(--ui-fogc-muted);font-variant-numeric: tabular-nums;white-space: nowrap}
.ui-fogc__sum b{font-weight: 500;color: var(--ui-fogc-ink)}
.ui-fogc__time[data-done]{color: var(--ui-fogc-done-ink)}
.ui-fogc__panel{position: relative;display: grid;gap: 14px;padding: 16px 16px 14px;border-radius: 10px;background: var(--ui-fogc-panel);box-shadow: var(--ui-fogc-shadow)}
.ui-fogc__foot{display: flex;flex-wrap: wrap;align-items: center;gap: 4px 12px;min-width: 0}
.ui-fogc__legend{display: flex;flex-wrap: wrap;gap: 0 2px;margin: -3px -6px}
.ui-fogc__key{display: inline-flex;align-items: center;gap: 6px;height: 24px;padding: 0 6px;border-radius: 6px;font-size: 12px;line-height: 16px;color: var(--ui-fogc-muted);transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-fogc__key:hover, .ui-fogc__key[aria-pressed="true"]{background: var(--ui-fogc-fill);color: var(--ui-fogc-ink)}
.ui-fogc__key[data-zero]{display: none}
.ui-fogc__key[data-off]{opacity: 0.45}
.ui-fogc__key .ui-fogc__n{color: var(--ui-fogc-ink)}
.ui-fogc__swatch{width: 8px;height: 8px;border-radius: 2.5px;background: var(--k-bg);box-shadow: inset 0 0 0 0.5px var(--k-edge)}
.ui-fogc__retry{display: inline-flex;align-items: center;gap: 5px;height: 24px;margin: -3px -6px -3px auto;padding: 0 6px;border-radius: 6px;font-size: 12px;font-weight: 500;color: var(--ui-fogc-failed-ink);animation: ui-fogc-in var(--nm-dur-3, 240ms) var(--ui-fogc-ease) both;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-fogc__retry:hover{background: var(--ui-fogc-failed-bg)}
.ui-fogc__retry > svg{width: 13px;height: 13px}
.ui-fogc [data-status="queued"]{--k-bg: var(--ui-fogc-queued-bg);--k-edge: var(--ui-fogc-queued-edge);--k-ink: var(--ui-fogc-muted)}
.ui-fogc [data-status="running"]{--k-bg: var(--ui-fogc-running-bg);--k-edge: var(--ui-fogc-running-edge);--k-ink: var(--ui-fogc-running-ink)}
.ui-fogc [data-status="retrying"]{--k-bg: var(--ui-fogc-retrying-bg);--k-edge: var(--ui-fogc-retrying-edge);--k-ink: var(--ui-fogc-retrying-ink)}
.ui-fogc [data-status="done"]{--k-bg: var(--ui-fogc-done-bg);--k-edge: var(--ui-fogc-done-edge);--k-ink: var(--ui-fogc-done-ink)}
.ui-fogc [data-status="failed"]{--k-bg: var(--ui-fogc-failed-bg);--k-edge: var(--ui-fogc-failed-edge);--k-ink: var(--ui-fogc-failed-ink)}
.ui-fogc__grid{display: grid;grid-template-columns: repeat(auto-fill, var(--ui-fogc-cell));gap: var(--ui-fogc-gap);justify-content: space-between;padding: 2px;margin: -2px;border-radius: 6px;outline: none}
.ui-fogc__grid:focus-visible{box-shadow: 0 0 0 2px var(--ui-fogc-focus)}
.ui-fogc__cell{position: relative;width: var(--ui-fogc-cell);height: var(--ui-fogc-cell);border-radius: 3px;background: var(--k-bg);box-shadow: inset 0 0 0 0.5px var(--k-edge);overflow: hidden;cursor: pointer;transition: background-color var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));animation: ui-fogc-cell-in var(--nm-dur-4, 380ms) var(--ui-fogc-ease) calc(var(--i, 0) * 2ms) backwards}
.ui-fogc__cell[data-status="running"]::before{content: "";position: absolute;inset: 0;background: linear-gradient(110deg, transparent 25%, var(--ui-fogc-shine) 50%, transparent 75%) 0 0 / 300% 100%;opacity: 0.75;animation: ui-fogc-cell-sweep var(--nm-dur-6, 1100ms) linear calc(var(--i, 0) * -97ms) infinite}
.ui-fogc__cell[data-status="retrying"]{animation: ui-fogc-breathe 1100ms ease-in-out infinite alternate}
.ui-fogc__cell:is([data-status="done"], [data-status="failed"]){animation: ui-fogc-pop var(--nm-dur-4, 380ms) var(--ui-fogc-ease)}
.ui-fogc__cell:hover, .ui-fogc__cell[data-on]{box-shadow: inset 0 0 0 1px var(--k-ink);transform: scale(1.3);z-index: 1}
.ui-fogc__cell[data-pinned]{box-shadow: inset 0 0 0 1px var(--k-ink), 0 0 0 2px var(--ui-fogc-focus)}
.ui-fogc__cell[data-dim]{opacity: 0.18}
.ui-fogc__tip{position: absolute;top: 0;left: 0;z-index: 5;display: grid;gap: 3px;width: max-content;max-width: min(280px, calc(100% - 16px));padding: 9px 12px 10px;border-radius: 10px;background: var(--ui-fogc-card);box-shadow: var(--ui-fogc-pop);pointer-events: none;transform-origin: var(--x, 50%) bottom;animation: ui-fogc-tip 160ms var(--ui-fogc-ease) both}
.ui-fogc__tip[data-side="below"]{transform-origin: var(--x, 50%) top}
.ui-fogc__tip-head{display: flex;align-items: center;gap: 8px;min-width: 0}
.ui-fogc__tip-label{min-width: 0;overflow: hidden;font-weight: 500;color: var(--ui-fogc-ink);white-space: nowrap;text-overflow: ellipsis}
.ui-fogc__pill{flex: none;height: 18px;margin-left: auto;padding: 0 6px;border-radius: 4px;background: var(--k-bg);font-size: 11px;font-weight: 500;line-height: 18px;color: var(--k-ink)}
.ui-fogc__tip-meta{font-size: 12px;line-height: 16px;color: var(--ui-fogc-muted);font-variant-numeric: tabular-nums}
.ui-fogc__tip-result{font-size: 12.5px;line-height: 18px;color: var(--ui-fogc-text)}
.ui-fogc__tip-error{font-size: 12.5px;line-height: 18px;color: var(--ui-fogc-failed-ink)}
@container ui-fogc (max-width: 520px){.ui-fogc__panel{--ui-fogc-cell: 10px;--ui-fogc-gap: 3px;padding: 12px}
.ui-fogc__sum{flex-basis: 100%;justify-content: space-between;margin-left: 0}
.ui-fogc__foot{flex-wrap: nowrap;align-items: center}
.ui-fogc__legend{display: grid;grid-template-columns: repeat(2, max-content)}
.ui-fogc__key[data-zero]{display: inline-flex;opacity: 0.45}
.ui-fogc__retry{flex: none;margin-left: auto}
}
@keyframes ui-fogc-cell-in{from{opacity: 0;transform: scale(0.6)}
}
@keyframes ui-fogc-pop{0%{transform: scale(0.7)}
55%{transform: scale(1.18)}
100%{transform: scale(1)}
}
@keyframes ui-fogc-cell-sweep{from{background-position: 100% 0}
to{background-position: -50% 0}
}
@keyframes ui-fogc-breathe{from{opacity: 0.55}
to{opacity: 1}
}
@keyframes ui-fogc-tip{from{opacity: 0;transform: translateY(3px) scale(0.97)}
}
@keyframes ui-fogc-in{from{opacity: 0;transform: translateY(2px)}
}
@media (prefers-reduced-motion: reduce){.ui-fogc *, .ui-fogc *::before, .ui-fogc *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-fogc{--ui-fogc-panel: #211b16;--ui-fogc-card: #27201a;--ui-fogc-strong: #fffdfb;--ui-fogc-ink: rgba(255, 253, 251, 0.9);--ui-fogc-text: rgba(255, 253, 251, 0.62);--ui-fogc-muted: rgba(255, 253, 251, 0.45);--ui-fogc-faint: rgba(255, 253, 251, 0.28);--ui-fogc-line: rgba(255, 253, 251, 0.08);--ui-fogc-fill: rgba(255, 253, 251, 0.08);--ui-fogc-accent: #ff8a5c;--ui-fogc-focus: rgba(255, 138, 92, 0.45);--ui-fogc-queued-bg: rgba(255, 253, 251, 0.05);--ui-fogc-queued-edge: rgba(255, 253, 251, 0.09);--ui-fogc-running-bg: rgba(255, 107, 53, 0.24);--ui-fogc-running-edge: rgba(255, 138, 92, 0.5);--ui-fogc-running-ink: #ff8a5c;--ui-fogc-retrying-bg: rgba(232, 176, 92, 0.24);--ui-fogc-retrying-edge: rgba(232, 176, 92, 0.5);--ui-fogc-retrying-ink: #e8b05c;--ui-fogc-done-bg: rgba(47, 141, 92, 0.22);--ui-fogc-done-edge: rgba(47, 141, 92, 0.42);--ui-fogc-done-ink: #2f8d5c;--ui-fogc-failed-bg: rgba(226, 84, 74, 0.24);--ui-fogc-failed-edge: rgba(226, 84, 74, 0.5);--ui-fogc-failed-ink: #e2544a;--ui-fogc-shine: rgba(255, 253, 251, 0.3);--ui-fogc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-fogc-pop: 0 0 0 0.5px rgba(255, 253, 251, 0.12), 0 12px 28px -10px rgba(11, 9, 8, 0.6)}

`;
