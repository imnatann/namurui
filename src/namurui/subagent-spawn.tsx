"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

/*
 * Subagent Spawn – one parent agent fanning out children, in a single self-contained file.
 * A press of Spawn sends out a wave of children that springs from the parent, staggered by place in
 * the wave and capped so even a wide fan-out has landed inside 600ms. A child that finishes shrinks
 * up into the tally above the grid; a child that fails takes one attention pulse, keeps its ring and
 * stays reachable from the failed count instead of vanishing. Running children carry an ember fill,
 * and cancelling one freezes it in place as a struck-through cancelled chip.
 */

export type SubagentStatus = "queued" | "running" | "done" | "failed" | "cancelled";

/** What a child is headed for – set "fail" to pin a failure where you need to show one */
export type SubagentOutcome = "ok" | "fail";

export type Subagent = {
  /** Stable id – the chip, its motion and its tally entry all key off it */
  id: string;
  /** Short task label on the chip */
  label: string;
  status: SubagentStatus;
  /** Milliseconds it has run – shown once it is finished */
  duration?: number;
  /** Set to "fail" to make it settle as a failure */
  outcome?: SubagentOutcome;
};

export type SubagentEvent = "spawned" | "done" | "failed" | "cancelled";

export type SubagentSpawnProps = {
  /** Parent agent name in the header */
  title?: string;
  /** The children that already exist when the parent mounts */
  tasks?: readonly Subagent[];
  /** How many children one press of Spawn adds */
  batch?: number;
  /** Longest a child may run before it settles, in ms */
  slowest?: number;
  /** Called when a child is spawned, settles or is cancelled */
  onEvent?: (child: Subagent, event: SubagentEvent) => void;
  className?: string;
};

/* ------------------------------------------------------------------ internals */

type Row = {
  id: string;
  label: string;
  status: SubagentStatus;
  /** Place in the wave it arrived in – drives its entrance delay */
  wave: number;
  /** ms a queued child waits before it starts */
  wait: number;
  /** ms it runs once it has started */
  planned: number;
  /** ms it has run so far */
  elapsed: number;
  /** ms it ran, once it has finished */
  duration: number | null;
  /** it fails when it settles */
  fails: boolean;
  /** ms left before a settled child leaves the grid for the tally */
  exit: number;
  /** it has left the grid and now lives in the tally */
  folded: boolean;
};

type WaveStyle = CSSProperties & { "--ui-sasp-index": string };

const TASK_POOL = [
  "Read the incident timeline",
  "Draft the migration note",
  "Re-check the retry budget",
  "Summarise the failing test",
  "Trace the slow query",
  "Collect the deploy diff",
  "Compare the two prompts",
  "Audit the token spend",
  "Check the rate limit",
  "Rebuild the stale index",
] as const;

const DEFAULT_TASKS: readonly Subagent[] = [
  { id: "child-1", label: "Read the incident timeline", status: "queued" },
  { id: "child-2", label: "Draft the migration note", status: "queued" },
  { id: "child-3", label: "Re-check the retry budget", status: "queued" },
];

/** The fan-out stops here, so a held-down control cannot grow the panel without bound */
const MAX_CHILDREN = 48;
/** How often the loop is allowed to touch React state */
const TICK_MS = 100;
/** How long a settled chip is given to play its exit before it leaves the grid */
const EXIT_MS = 420;

const hash = (value: string) => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  /* Finalizer: ids in a wave differ by one character, so the raw FNV-1a value
   * clusters and every child would end up with the same run time. */
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
};

/** A child's run time comes from its id, so a fan-out is the same on every reload */
const plannedFor = (id: string, slowest: number) => Math.min(slowest, 1500 + (hash(id) % 2800));

const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

const toPublic = (row: Row): Subagent => {
  const child: Subagent = { id: row.id, label: row.label, status: row.status };
  if (row.duration !== null) child.duration = row.duration;
  if (row.fails) child.outcome = "fail";
  return child;
};

const countByStatus = (rows: readonly Row[]) => {
  const counts: Record<SubagentStatus, number> = {
    queued: 0,
    running: 0,
    done: 0,
    failed: 0,
    cancelled: 0,
  };
  for (const row of rows) counts[row.status] += 1;
  return counts;
};

const summarize = (rows: readonly Row[]) => {
  const counts = countByStatus(rows);
  const parts: string[] = [];
  if (counts.running > 0) parts.push(`${counts.running} running`);
  if (counts.queued > 0) parts.push(`${counts.queued} queued`);
  if (counts.done > 0) parts.push(`${counts.done} done`);
  if (counts.failed > 0) parts.push(`${counts.failed} failed`);
  if (counts.cancelled > 0) parts.push(`${counts.cancelled} cancelled`);
  return parts.length > 0 ? parts.join(", ") : "nothing active";
};

const seedRows = (tasks: readonly Subagent[], slowest: number): Row[] =>
  tasks.map((task, index) => {
    const planned = plannedFor(task.id, slowest);
    const elapsed = task.duration ?? 0;
    return {
      id: task.id,
      label: task.label,
      status: task.status,
      wave: index,
      wait: task.status === "queued" ? 180 + index * 110 : 0,
      planned: Math.max(planned, elapsed + 600),
      elapsed,
      duration: task.duration ?? null,
      fails: task.outcome === "fail",
      exit: 0,
      folded: task.status === "done" || task.status === "failed",
    };
  });

const buildWave = (
  count: number,
  sequence: number,
  taken: ReadonlySet<string>,
  slowest: number,
): { rows: Row[]; next: number } => {
  const rows: Row[] = [];
  let n = sequence;
  while (rows.length < count) {
    n += 1;
    const id = `child-${n}`;
    if (taken.has(id)) continue;
    rows.push({
      id,
      label: TASK_POOL[n % TASK_POOL.length],
      status: "queued",
      wave: rows.length,
      wait: 160 + rows.length * 90,
      planned: plannedFor(id, slowest),
      elapsed: 0,
      duration: null,
      fails: n % 5 === 4,
      exit: 0,
      folded: false,
    });
  }
  return { rows, next: n };
};

/** One step of the clock: queued children start, running children advance or settle, settled ones leave */
const advance = (rows: Row[], dt: number): Row[] => {
  let changed = false;
  const next = rows.map((row): Row => {
    if (row.status === "queued") {
      changed = true;
      const wait = row.wait - dt;
      if (wait > 0) return { ...row, wait };
      return { ...row, status: "running", wait: 0, elapsed: -wait };
    }
    if (row.status === "running") {
      changed = true;
      const elapsed = row.elapsed + dt;
      if (elapsed >= row.planned) {
        return {
          ...row,
          elapsed: row.planned,
          duration: row.planned,
          status: row.fails ? "failed" : "done",
          exit: EXIT_MS,
        };
      }
      return { ...row, elapsed };
    }
    if (row.exit > 0) {
      changed = true;
      const exit = row.exit - dt;
      if (exit <= 0) return { ...row, exit: 0, folded: true };
      return { ...row, exit };
    }
    return row;
  });
  return changed ? next : rows;
};

/* ------------------------------------------------------------------- glyphs */

function FanMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="15"
      height="15"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <circle cx="2.8" cy="8" r="1.7" />
      <circle cx="13.2" cy="3.6" r="1.6" />
      <circle cx="13.2" cy="12.4" r="1.6" />
      <path d="M4.5 8h2.7" />
      <path d="m7.2 8 4.4-3.6" />
      <path d="m7.2 8 4.4 3.6" />
    </svg>
  );
}

function StopMark() {
  return (
    <svg
      viewBox="0 0 12 12"
      width="11"
      height="11"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="2.3" y="2.3" width="7.4" height="7.4" rx="1.7" />
    </svg>
  );
}

function Glyph({ status }: { status: SubagentStatus }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {status === "queued" ? <circle cx="6" cy="6" r="4.1" strokeDasharray="1.6 2.4" /> : null}
      {status === "running" ? <circle cx="6" cy="6" r="2.3" fill="currentColor" stroke="none" /> : null}
      {status === "done" ? <path d="M2.3 6.4 4.8 9 9.7 3.2" /> : null}
      {status === "failed" ? <path d="M3.2 3.2 8.8 8.8M8.8 3.2 3.2 8.8" /> : null}
      {status === "cancelled" ? <path d="M2.6 6h6.8" /> : null}
    </svg>
  );
}

/* ---------------------------------------------------------------- component */

export function SubagentSpawn({
  title = "Orchestrator",
  tasks = DEFAULT_TASKS,
  batch = 3,
  slowest = 6000,
  onEvent,
  className,
}: SubagentSpawnProps) {
  const [rows, setRows] = useState<Row[]>(() => seedRows(tasks, slowest));
  const [reveal, setReveal] = useState<SubagentStatus | null>(null);
  const [note, setNote] = useState("");

  const sequenceRef = useRef(rows.length);
  const onEventRef = useRef(onEvent);
  const statusRef = useRef(new Map<string, SubagentStatus>());
  const foldedRef = useRef(new Set<string>());
  const revealId = useId();

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  /* The clock lives on requestAnimationFrame: it drives data, it is cancelled on
   * unmount, and it steps aside while the tab is hidden so nothing settles unseen. */
  useEffect(() => {
    let frame = 0;
    let last = 0;
    let banked = 0;

    const step = (now: number) => {
      frame = requestAnimationFrame(step);
      if (document.hidden) {
        last = 0;
        return;
      }
      if (last === 0) {
        last = now;
        return;
      }
      banked += now - last;
      last = now;
      if (banked < TICK_MS) return;
      const dt = banked;
      banked = 0;
      setRows((prev) => advance(prev, dt));
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  /* Transitions are reported here rather than inside the updater, so a child can only
   * be announced once no matter how many times React runs the effect. */
  useEffect(() => {
    const statuses = statusRef.current;
    const notes: string[] = [];

    for (const row of rows) {
      if (row.folded && row.status === "failed" && !foldedRef.current.has(row.id)) {
        foldedRef.current.add(row.id);
        setReveal("failed");
      }
      const before = statuses.get(row.id);
      if (before === row.status) continue;
      statuses.set(row.id, row.status);
      if (before === undefined) continue;
      const seconds = formatSeconds(row.duration ?? row.planned);
      if (row.status === "done") {
        notes.push(`${row.label} finished in ${seconds}.`);
        onEventRef.current?.(toPublic(row), "done");
      } else if (row.status === "failed") {
        notes.push(`${row.label} failed after ${seconds}.`);
        onEventRef.current?.(toPublic(row), "failed");
      } else if (row.status === "cancelled") {
        notes.push(`${row.label} cancelled.`);
        onEventRef.current?.(toPublic(row), "cancelled");
      }
    }

    if (notes.length > 0) setNote(`${notes.join(" ")} ${summarize(rows)}.`);
  }, [rows]);

  const counts = countByStatus(rows);
  const live = counts.running > 0 || counts.queued > 0;
  const room = MAX_CHILDREN - rows.length;
  const cells = rows.filter((row) => !row.folded);
  const folded = reveal === null ? [] : rows.filter((row) => row.folded && row.status === reveal);

  const spawn = () => {
    const count = Math.min(Math.max(batch, 1), room);
    if (count <= 0) return;
    const taken = new Set(rows.map((row) => row.id));
    const wave = buildWave(count, sequenceRef.current, taken, slowest);
    sequenceRef.current = wave.next;
    setRows((prev) => [...prev, ...wave.rows]);
    setNote(`Spawned ${count} ${count === 1 ? "child" : "children"}. ${summarize([...rows, ...wave.rows])}.`);
    for (const row of wave.rows) onEventRef.current?.(toPublic(row), "spawned");
  };

  const cancel = (id: string) => {
    setRows((prev) =>
      prev.map((row): Row => {
        if (row.id !== id || (row.status !== "running" && row.status !== "queued")) return row;
        return {
          ...row,
          status: "cancelled",
          wait: 0,
          exit: 0,
          folded: false,
          duration: row.status === "running" ? row.elapsed : row.duration,
        };
      }),
    );
  };

  return (
    <div className={["ui-sasp", className].filter(Boolean).join(" ")} data-state={live ? "live" : "idle"}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-subagent-spawn" precedence="default">
        {css}
      </style>

      <div className="ui-sasp__parent">
        <span className="ui-sasp__badge">
          <FanMark />
        </span>
        <span className="ui-sasp__name">{title}</span>
        <span className="ui-sasp__count">{rows.length} spawned</span>
        {live ? <span className="ui-sasp__liveDot" aria-hidden="true" /> : null}
        <button type="button" className="ui-sasp__action" onClick={spawn} disabled={room <= 0}>
          <FanMark />
          Spawn {batch}
        </button>
        {room <= 0 ? <span className="ui-sasp__cap">limit {MAX_CHILDREN}</span> : null}
      </div>

      <div className="ui-sasp__tally">
        {TALLY_ORDER.map((status) => {
          const count = counts[status];
          const on = reveal === status;
          const reachable = (status === "done" || status === "failed") && count > 0;
          const body = (
            <>
              <Glyph status={status} />
              <span className="ui-sasp__segCount" key={count}>
                {count}
              </span>
              <span>{status}</span>
            </>
          );
          if (!reachable) {
            return (
              <span key={status} className="ui-sasp__seg" data-kind={status} data-empty={count === 0}>
                {body}
              </span>
            );
          }
          return (
            <button
              key={status}
              type="button"
              className="ui-sasp__seg"
              data-kind={status}
              data-on={on}
              aria-expanded={on}
              aria-controls={revealId}
              onClick={() => setReveal(on ? null : status)}
            >
              {body}
            </button>
          );
        })}
      </div>

      <div
        className="ui-sasp__reveal"
        id={revealId}
        data-open={reveal !== null && folded.length > 0 ? "true" : "false"}
      >
        <div className="ui-sasp__revealClip">
          <ul
            className="ui-sasp__revealList"
            aria-label={reveal === null ? undefined : `${folded.length} ${reveal} children`}
          >
            {folded.map((row) => (
              <li key={row.id} className="ui-sasp__revealItem" data-kind={row.status}>
                <Glyph status={row.status} />
                <span className="ui-sasp__revealLabel">{row.label}</span>
                <span className="ui-sasp__revealTime">{formatSeconds(row.duration ?? row.planned)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ul className="ui-sasp__grid">
        {cells.map((row) => {
          const entry: WaveStyle = { "--ui-sasp-index": String(row.wave) };
          const progress =
            row.planned <= 0 ? 1 : Math.max(0, Math.min(1, row.elapsed / row.planned));
          return (
            <li key={row.id} className="ui-sasp__cell" data-state={row.status} style={entry}>
              <div className="ui-sasp__chip" data-state={row.status}>
                <span className="ui-sasp__glyph">
                  <Glyph status={row.status} />
                </span>
                <span className="ui-sasp__label">{row.label}</span>
                <span className="ui-sasp__meta">
                  <span className="ui-sasp__status">{row.status}</span>
                  {row.duration !== null ? (
                    <span className="ui-sasp__time">{formatSeconds(row.duration)}</span>
                  ) : null}
                </span>
                {row.status === "running" ? (
                  <span className="ui-sasp__track" aria-hidden="true">
                    <span className="ui-sasp__fill" style={{ transform: `scaleX(${progress})` }} />
                  </span>
                ) : null}
                {row.status === "running" || row.status === "queued" ? (
                  <button
                    type="button"
                    className="ui-sasp__cancel"
                    onClick={() => cancel(row.id)}
                    aria-label={`Cancel ${row.label}`}
                  >
                    <StopMark />
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
        {cells.length === 0 ? (
          <li className="ui-sasp__empty">
            {rows.length === 0 ? "No children yet." : "Every child has folded into the tally above."}
          </li>
        ) : null}
      </ul>

      <span className="ui-sasp__liveRegion" role="status" aria-live="polite">
        {note}
      </span>
    </div>
  );
}

const TALLY_ORDER: readonly SubagentStatus[] = ["running", "queued", "done", "failed", "cancelled"];

const css = /* css */ `
.ui-sasp {
  /* Knobs. Override any of these on .ui-sasp { … } to retheme the fan-out; the literal
   * after each comma is what keeps the component correct in a host without the tokens. */
  --ui-sasp-ink: var(--text, #f4ece4);
  --ui-sasp-ink-muted: var(--text-muted, #a2958a);
  --ui-sasp-ink-subtle: var(--text-subtle, #f4ece48c);
  --ui-sasp-surface: var(--card, #201a15);
  --ui-sasp-chip: var(--preview, #26201a);
  --ui-sasp-line: var(--border, #33291f);
  --ui-sasp-line-soft: var(--border-soft, #ffffff12);
  --ui-sasp-accent: var(--accent, #ff6b35);
  --ui-sasp-accent-hover: var(--accent-hover, #ff8256);
  --ui-sasp-accent-soft: var(--accent-soft, #ff6b3524);
  --ui-sasp-accent-ink: var(--accent-fg, #1a0f08);
  --ui-sasp-success: var(--success, #4f9d6e);
  --ui-sasp-danger: var(--danger, #e2544a);
  --ui-sasp-focus: var(--accent, #ff6b35);
  --ui-sasp-halo: #e2544a2e;
  --ui-sasp-radius: var(--radius-card, 16px);
  --ui-sasp-radius-sm: var(--radius-preview, 12px);
  --ui-sasp-shadow: var(--shadow-card, 0 1px 1.5px #0000004d, inset 0 -1px 0 #ffffff0a);

  /* Motion. Every duration and curve is a token, with the token's literal as the floor. */
  --ui-sasp-enter: var(--nm-dur-3, 240ms);
  --ui-sasp-fold: var(--nm-dur-3, 240ms);
  --ui-sasp-alert: var(--nm-dur-4, 380ms);
  --ui-sasp-stagger: var(--nm-stagger, 45ms);
  --ui-sasp-stagger-cap: 270ms;
  --ui-sasp-step: var(--nm-dur-1, 90ms);
  --ui-sasp-settle: var(--nm-dur-2, 160ms);
  --ui-sasp-ambient: var(--nm-dur-6, 1100ms);
  --ui-sasp-spring: var(--nm-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  --ui-sasp-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-sasp-ease-soft: var(--nm-ease-soft, cubic-bezier(0.4, 0, 0.2, 1));

  position: relative;
  display: block;
  padding: 14px;
  border-radius: var(--ui-sasp-radius);
  background: var(--ui-sasp-surface);
  box-shadow: var(--ui-sasp-shadow), inset 0 0 0 1px var(--ui-sasp-line-soft);
  color: var(--ui-sasp-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}

.ui-sasp svg {
  display: block;
  flex: none;
}

.ui-sasp button:focus-visible {
  outline: 2px solid var(--ui-sasp-focus);
  outline-offset: 2px;
}

/* ---- the parent node ---- */

.ui-sasp__parent {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin-bottom: 10px;
}

.ui-sasp__badge {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 9px;
  color: var(--ui-sasp-ink-muted);
  background: var(--ui-sasp-line-soft);
  box-shadow: inset 0 0 0 1px var(--ui-sasp-line-soft);
}

.ui-sasp[data-state="live"] .ui-sasp__badge {
  color: var(--ui-sasp-accent);
}

.ui-sasp__name {
  font-size: 13.5px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ui-sasp__count {
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  color: var(--ui-sasp-ink-muted);
  white-space: nowrap;
}

.ui-sasp__liveDot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ui-sasp-accent);
  animation: ui-sasp-live var(--ui-sasp-ambient) var(--ui-sasp-ease-soft) infinite;
}

.ui-sasp__action {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  margin-left: auto;
  padding: 0 12px;
  border: 0;
  border-radius: var(--radius-pill, 999px);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ui-sasp-accent-ink);
  background: var(--ui-sasp-accent);
  cursor: pointer;
  transition: transform var(--ui-sasp-step) var(--ui-sasp-ease-out);
}

.ui-sasp__action:hover {
  background: var(--ui-sasp-accent-hover);
  transform: translateY(-1px);
}

.ui-sasp__action:active {
  transform: translateY(0) scale(0.97);
}

.ui-sasp__action:disabled {
  cursor: not-allowed;
  color: var(--ui-sasp-ink-muted);
  background: var(--ui-sasp-line-soft);
  transform: none;
}

.ui-sasp__cap {
  font-size: 11px;
  color: var(--ui-sasp-ink-subtle);
  white-space: nowrap;
}

/* ---- the tally children collapse into ---- */

.ui-sasp__tally {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
}

.ui-sasp__seg {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--radius-pill, 999px);
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--ui-sasp-line-soft);
  font: inherit;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--ui-sasp-ink-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.ui-sasp__seg[data-empty="true"] {
  opacity: 0.45;
}

.ui-sasp__seg[data-kind="running"] {
  color: var(--ui-sasp-accent);
}

.ui-sasp__seg[data-kind="done"] {
  color: var(--ui-sasp-success);
}

.ui-sasp__seg[data-kind="failed"] {
  color: var(--ui-sasp-danger);
}

button.ui-sasp__seg {
  cursor: pointer;
  transition: transform var(--ui-sasp-step) var(--ui-sasp-ease-out);
}

button.ui-sasp__seg:hover {
  transform: translateY(-1px);
  box-shadow: inset 0 0 0 1px currentColor;
}

button.ui-sasp__seg[data-on="true"] {
  box-shadow: inset 0 0 0 1px currentColor;
}

.ui-sasp__segCount {
  font-weight: 700;
  animation: ui-sasp-tick var(--ui-sasp-settle) var(--ui-sasp-spring) both;
}

/* ---- what the tally holds ---- */

.ui-sasp__reveal {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: grid-template-rows var(--ui-sasp-settle) var(--ui-sasp-ease-out),
    opacity var(--ui-sasp-settle) var(--ui-sasp-ease-out);
}

.ui-sasp__reveal[data-open="true"] {
  grid-template-rows: 1fr;
  opacity: 1;
}

.ui-sasp__revealClip {
  overflow: hidden;
  min-height: 0;
  padding: 6px 0 10px;
}

.ui-sasp__revealList {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ui-sasp__revealItem {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 9px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-sasp-line-soft);
  font-size: 11.5px;
  color: var(--ui-sasp-ink-muted);
  font-variant-numeric: tabular-nums;
  min-width: 0;
}

.ui-sasp__revealItem[data-kind="failed"] {
  color: var(--ui-sasp-danger);
  box-shadow: inset 0 0 0 1px var(--ui-sasp-halo);
}

.ui-sasp__revealItem[data-kind="done"] {
  color: var(--ui-sasp-success);
}

.ui-sasp__revealLabel {
  max-width: 22ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ui-sasp__revealTime {
  color: var(--ui-sasp-ink-subtle);
}

/* ---- the fan-out ---- */

.ui-sasp__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ui-sasp__empty {
  grid-column: 1 / -1;
  font-size: 12px;
  color: var(--ui-sasp-ink-subtle);
}

.ui-sasp__cell {
  --ui-sasp-index: 0;
  min-width: 0;
  animation: ui-sasp-in var(--ui-sasp-enter) var(--ui-sasp-spring) both;
  animation-delay: min(calc(var(--ui-sasp-index) * var(--ui-sasp-stagger)), var(--ui-sasp-stagger-cap));
}

.ui-sasp__cell[data-state="done"],
.ui-sasp__cell[data-state="failed"] {
  animation: ui-sasp-fold var(--ui-sasp-fold) var(--ui-sasp-ease-out) both;
  animation-delay: 0ms;
}

.ui-sasp__chip {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-areas:
    "glyph label cancel"
    "glyph meta cancel";
  align-items: center;
  column-gap: 8px;
  row-gap: 2px;
  min-width: 0;
  padding: 9px 10px;
  border-radius: var(--ui-sasp-radius-sm);
  background: var(--ui-sasp-chip);
  box-shadow: inset 0 0 0 1px var(--ui-sasp-line-soft);
}

.ui-sasp__chip[data-state="running"] {
  grid-template-areas:
    "glyph label cancel"
    "glyph meta cancel"
    "track track track";
}

.ui-sasp__chip[data-state="failed"] {
  box-shadow: inset 0 0 0 1px var(--ui-sasp-danger), 0 0 0 3px var(--ui-sasp-halo);
  animation: ui-sasp-alert var(--ui-sasp-alert) var(--ui-sasp-ease-soft) 1;
}

.ui-sasp__chip[data-state="queued"] {
  background: transparent;
}

.ui-sasp__chip[data-state="cancelled"] {
  opacity: 0.62;
}

.ui-sasp__glyph {
  grid-area: glyph;
  align-self: start;
  padding-top: 1px;
  color: var(--ui-sasp-ink-subtle);
}

.ui-sasp__chip[data-state="running"] .ui-sasp__glyph {
  color: var(--ui-sasp-accent);
}

.ui-sasp__chip[data-state="done"] .ui-sasp__glyph {
  color: var(--ui-sasp-success);
}

.ui-sasp__chip[data-state="failed"] .ui-sasp__glyph {
  color: var(--ui-sasp-danger);
}

.ui-sasp__label {
  grid-area: label;
  min-width: 0;
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.ui-sasp__chip[data-state="cancelled"] .ui-sasp__label {
  text-decoration: line-through;
}

.ui-sasp__meta {
  grid-area: meta;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.ui-sasp__status {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ui-sasp-ink-muted);
}

.ui-sasp__chip[data-state="running"] .ui-sasp__status {
  color: var(--ui-sasp-accent);
}

.ui-sasp__chip[data-state="done"] .ui-sasp__status {
  color: var(--ui-sasp-success);
}

.ui-sasp__chip[data-state="failed"] .ui-sasp__status {
  color: var(--ui-sasp-danger);
}

.ui-sasp__time {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--ui-sasp-ink-subtle);
}

.ui-sasp__track {
  grid-area: track;
  position: relative;
  height: 3px;
  margin-top: 6px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-sasp-line-soft);
  overflow: hidden;
}

.ui-sasp__fill {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--ui-sasp-accent);
  transform-origin: left center;
  transform: scaleX(0);
  transition: transform var(--ui-sasp-settle) linear;
}

.ui-sasp__cancel {
  grid-area: cancel;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--ui-sasp-ink-muted);
  cursor: pointer;
  transition: transform var(--ui-sasp-step) var(--ui-sasp-ease-out);
}

.ui-sasp__cancel:hover {
  color: var(--ui-sasp-danger);
  background: var(--ui-sasp-line-soft);
}

.ui-sasp__cancel:active {
  transform: scale(0.92);
}

/* ---- the live region ---- */

.ui-sasp__liveRegion {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  white-space: nowrap;
  clip-path: inset(50%);
}

/* ---- keyframes ---- */

@keyframes ui-sasp-in {
  from {
    opacity: 0;
    transform: translate(-18px, -14px) scale(0.82);
  }
  to {
    opacity: 1;
    transform: translate(0, 0) scale(1);
  }
}

@keyframes ui-sasp-fold {
  from {
    opacity: 1;
    transform: translate(0, 0) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(-16px, -20px) scale(0.66);
  }
}

@keyframes ui-sasp-alert {
  0% {
    transform: scale(1);
  }
  34% {
    transform: scale(1.045);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes ui-sasp-tick {
  from {
    opacity: 0;
    transform: translateY(5px) scale(0.86);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes ui-sasp-live {
  0%,
  100% {
    opacity: 0.4;
    transform: scale(0.84);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}

/* Dark theme. Only the knobs change; every rule above is theme-blind. */
:where(.dark, [data-theme="dark"]) .ui-sasp {
  --ui-sasp-ink: var(--text, #f4ece4);
  --ui-sasp-ink-muted: var(--text-muted, #a2958a);
  --ui-sasp-ink-subtle: var(--text-subtle, #f4ece48c);
  --ui-sasp-surface: var(--card, #201a15);
  --ui-sasp-chip: var(--preview, #26201a);
  --ui-sasp-line: var(--border, #33291f);
  --ui-sasp-line-soft: var(--border-soft, #ffffff12);
  --ui-sasp-accent: var(--accent, #ff6b35);
  --ui-sasp-accent-hover: var(--accent-hover, #ff8256);
  --ui-sasp-accent-soft: var(--accent-soft, #ff6b3524);
  --ui-sasp-accent-ink: var(--accent-fg, #1a0f08);
  --ui-sasp-success: var(--success, #4f9d6e);
  --ui-sasp-danger: var(--danger, #e2544a);
  --ui-sasp-focus: var(--accent, #ff6b35);
  --ui-sasp-halo: #e2544a2e;
  --ui-sasp-shadow: var(--shadow-card, 0 1px 1.5px #0000004d, inset 0 -1px 0 #ffffff0a);
}

@media (prefers-reduced-motion: reduce) {
  .ui-sasp__cell,
  .ui-sasp__chip,
  .ui-sasp__segCount,
  .ui-sasp__liveDot {
    animation: none;
  }

  /* A settled chip is already gone in the model, so it should not hold a slot open */
  .ui-sasp__cell[data-state="done"],
  .ui-sasp__cell[data-state="failed"] {
    display: none;
  }

  .ui-sasp__cell,
  .ui-sasp__fill,
  .ui-sasp__reveal,
  .ui-sasp__action,
  .ui-sasp__cancel {
    transition-duration: 1ms;
  }

  .ui-sasp__cancel:active,
  .ui-sasp__action:hover,
  .ui-sasp__action:active,
  button.ui-sasp__seg:hover {
    transform: none;
  }
}
`;