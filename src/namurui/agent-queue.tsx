"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

/*
 * Agent Queue – the work waiting for your agents, and how fast it moves, in a single self-contained file.
 *
 * The board is absolute geometry, exactly as the original lays it out: a Queue column of chips, a Workers
 * column of slots, and two bins for what landed. A queued job is a chip; the moment it holds a worker it
 * becomes a bar on that worker's rail, growing with its progress, with a sweep and a glow at the head; a
 * job that finishes leaves as a ghost that flies into Done or Failed.
 *
 * Rates stall the board: while the queue is paused or rate limited every running bar carries `data-halted`,
 * which freezes its shimmer and prints "Paused" where the timer was.
 *
 * Underneath, a depth chart draws the backlog as a monotone cubic – control points a third of the way along
 * each segment, tangents averaged from the neighbouring slopes and flattened at every turn, so a spike
 * rises and falls without overshooting its data. Its scale is shared with the grid lines, the backpressure
 * rule, the "now" dot and the tick labels through `--ui-agqc-ymax`.
 *
 * The styles are injected below, so no extra files are needed.
 */

export type QueueJobKind = "llm" | "tool" | "agent" | "human";
export type QueueJobStatus = "queued" | "running" | "done" | "failed";

/** `live` runs, `limited` is a provider freeze with a countdown, `paused` is the reader's own stop. */
export type QueueState = "live" | "limited" | "paused";

export type QueueJob = {
  id: string;
  /** What the job is doing – "Draft reply – Acme VIP". */
  name: string;
  kind: QueueJobKind;
  status: QueueJobStatus;
  /** 0–1 while it runs. Drives the bar's `--p`. */
  progress?: number;
  /** Time spent in the queue, in ms – the chip's meta and the dialog's wait. */
  waited?: number;
  /** Time since it started, in ms – the bar's meta. */
  elapsed?: number;
  /** The worker row it runs on. Without one it takes the first free row. */
  workerId?: string;
  priority?: "high";
  /** How many times it has been tried – past the first, a retry badge appears. */
  attempts?: number;
  /** A brand mark for the job tile. Without one the queue's own glyph is used. */
  icon?: ReactNode;
  /** Why it failed – shown in the job's dialog. */
  error?: string;
  /** A failure that has just bounced back into the queue. */
  flash?: boolean;
};

export type QueueWorker = {
  id: string;
  name: string;
  icon?: ReactNode;
};

/** A stretch of the window in which the provider refused work, in ms ago; `from` is the older edge. */
export type QueueRateLimit = { from: number; to: number };

export type AgentQueueProps = {
  jobs: QueueJob[];
  workers: QueueWorker[];
  /** How many jobs may run at once. Defaults to the size of the worker pool. */
  concurrency?: number;
  minConcurrency?: number;
  maxConcurrency?: number;
  onConcurrencyChange?: (workers: number) => void;
  paused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  /** ms left on a provider rate limit. Set it and the board freezes until it runs out. */
  limitedFor?: number | null;
  /** Jobs finished per minute. */
  throughput?: number;
  /** 95th percentile wait, in ms. */
  waitP95?: number;
  /** How many jobs landed in each bin. */
  done?: number;
  failed?: number;
  /** Queue depth, oldest first. The newest sample is the dot at the right edge. */
  depth?: number[];
  /** How far back the chart looks, in ms. */
  window?: number;
  /** A depth that means trouble – the dashed rule, and the warning tone on Waiting. */
  backpressure?: number;
  rateLimits?: QueueRateLimit[];
  title?: string;
  name?: string;
  /** What the queue column says when nothing waits. */
  emptyLabel?: string;
  openJobId?: string | null;
  defaultOpenJobId?: string | null;
  onOpenJobChange?: (id: string | null, job: QueueJob | null) => void;
  /** Pull a waiting job to the front. */
  onPromote?: (job: QueueJob) => void;
  /** Drop a waiting job, or stop one that is running. */
  onCancel?: (job: QueueJob) => void;
  /** Send a job that already failed once back into the queue. */
  onRetry?: (job: QueueJob) => void;
  className?: string;
};

/* ------------------------------------------------------------------ geometry */

const PAD = 16; // board padding, each side
const GAP = 24; // between the three columns
const HEAD_TOP = 14;
const HEAD_H = 16;
const ROW_TOP = 40; // first slot, first chip
const ROW_H = 40;
const ROW_GAP = 6;
const CHIP_H = 28;
const CHIP_GAP = 4;
const BIN_W = 92;
const BIN_H = 85;
const BIN_GAP = 8;
const BIN_ROW_GAP = 10;
const NARROW_BIN_H = 40;
const FLOW_BOTTOM = 18;
const RAIL_TOP = 6;
const RAIL_H = 28;
const RAIL_RIGHT = 6;
const WHO_LEFT = 8;
const WHO_GAP = 8;
const WHO_SHARE = 0.36;
const QUEUE_SHARE = 0.26;
const QUEUE_MIN = 132;
const QUEUE_MAX = 240;
const NARROW_AT = 560;
const PLOT_H = 112;
const PLOT_GUTTER = 26;
const POP_W = 280;
const POP_EST_H = 196;
const GHOST = 10;
const FALLBACK_WIDTH = 756;

type Layout = {
  narrow: boolean;
  queueW: number;
  workersX: number;
  workersW: number;
  binsX: number;
  whoW: number;
  railLeft: number;
  railW: number;
  contentBottom: number;
  binRowY: number;
  narrowBinW: number;
  flowH: number;
  capacity: number;
  plotW: number;
};

/** Everything the sheet expects inline, derived from the measured width and the pool. */
function layoutFor(width: number, workerRows: number): Layout {
  const narrow = width < NARROW_AT;
  const queueW = Math.round(clamp(width * QUEUE_SHARE, QUEUE_MIN, QUEUE_MAX));
  const workersX = PAD + queueW + GAP;
  const workersW = narrow
    ? Math.max(160, width - PAD - workersX)
    : Math.max(180, width - PAD * 2 - queueW - BIN_W - GAP * 2);
  const slotsH = workerRows > 0 ? workerRows * ROW_H + (workerRows - 1) * ROW_GAP : 0;
  const contentBottom = ROW_TOP + slotsH;
  const whoW = Math.round(workersW * WHO_SHARE);
  const railLeft = WHO_LEFT + whoW + WHO_GAP;
  const stackH = Math.max(contentBottom, ROW_TOP + BIN_H * 2 + BIN_GAP);
  const narrowBinW = (workersW - BIN_GAP) / 2;
  const chartPad = narrow ? 12 : 16;

  return {
    narrow,
    queueW,
    workersX,
    workersW,
    binsX: workersX + workersW + GAP,
    whoW,
    railLeft,
    railW: Math.max(60, workersW - railLeft - RAIL_RIGHT),
    contentBottom,
    binRowY: contentBottom + BIN_ROW_GAP,
    narrowBinW,
    flowH: narrow
      ? contentBottom + BIN_ROW_GAP + NARROW_BIN_H + FLOW_BOTTOM
      : stackH + FLOW_BOTTOM,
    capacity: Math.max(1, Math.floor((contentBottom - ROW_TOP + CHIP_GAP) / (CHIP_H + CHIP_GAP))),
    plotW: Math.max(120, width - chartPad * 2 - PLOT_GUTTER),
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** An inline style plus the custom properties the sheet reads (`--p`, `--v`, `--h`, `--ui-agqc-ymax`). */
function withVars(base: CSSProperties, vars: Record<string, string | number>): CSSProperties {
  return Object.assign(base, vars) as CSSProperties;
}

function px(n: number): string {
  return `${Math.round(n * 100) / 100}px`;
}

/* ------------------------------------------------------------------ formatting */

const KIND_TEXT: Record<QueueJobKind, string> = {
  llm: "LLM call",
  tool: "Tool call",
  agent: "Agent call",
  human: "Human step",
};

const STATUS_TEXT: Record<QueueJobStatus, string> = {
  queued: "Waiting",
  running: "Running",
  done: "Done",
  failed: "Failed",
};

/** "0.8s", "13s", "1m 04s" – a job's timer. */
function secs(ms: number): string {
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.floor(ms / 60_000)}m ${String(Math.round((ms % 60_000) / 1000)).padStart(2, "0")}s`;
}

/** A bar is full once the job has landed, whatever progress it reached. */
function progressOf(job: QueueJob): number {
  if (job.status === "done" || job.status === "failed") return 1;
  return clamp(job.progress ?? 0, 0, 1);
}

/* ------------------------------------------------------------------ the curve */

type Pt = { x: number; y: number };

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Monotone cubic through the samples: control points a third of the way along each segment, tangents
 * averaged from the neighbouring slopes and flattened to zero at every turning point, so a spike never
 * overshoots its peak and never dips under its trough.
 */
function monotonePath(points: Pt[]): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M${round2(points[0].x)},${round2(points[0].y)}`;

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const h = points[i + 1].x - points[i].x;
    dx.push(h);
    slope.push(h === 0 ? 0 : (points[i + 1].y - points[i].y) / h);
  }

  const tangent = new Array<number>(n);
  tangent[0] = slope[0];
  tangent[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i += 1) {
    if (slope[i - 1] * slope[i] <= 0) {
      tangent[i] = 0;
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      tangent[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
    }
  }

  let d = `M${round2(points[0].x)},${round2(points[0].y)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const h = dx[i] / 3;
    d +=
      `C${round2(points[i].x + h)},${round2(points[i].y + tangent[i] * h)} ` +
      `${round2(points[i + 1].x - h)},${round2(points[i + 1].y - tangent[i + 1] * h)} ` +
      `${round2(points[i + 1].x)},${round2(points[i + 1].y)}`;
  }
  return d;
}

/* ------------------------------------------------------------------ component */

type Frame = { x: number; y: number; w: number; h: number; shape: "chip" | "bar" | "gone" };

export function AgentQueue({
  jobs,
  workers,
  concurrency,
  minConcurrency = 1,
  maxConcurrency = 8,
  onConcurrencyChange,
  paused = false,
  onPausedChange,
  limitedFor = null,
  throughput = 0,
  waitP95 = 0,
  done = 0,
  failed = 0,
  depth = [],
  window: windowMs = 96_000,
  backpressure = 12,
  rateLimits = [],
  title = "Queue",
  name,
  emptyLabel = "Nothing waiting",
  openJobId,
  defaultOpenJobId = null,
  onOpenJobChange,
  onPromote,
  onCancel,
  onRetry,
  className,
}: AgentQueueProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  const [innerOpen, setInnerOpen] = useState<string | null>(defaultOpenJobId);
  const [tabStop, setTabStop] = useState<string | null>(null);
  const jobNodes = useRef(new Map<string, HTMLButtonElement>());
  const gradientId = `ui-agqc-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth || FALLBACK_WIDTH);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const openId = openJobId === undefined ? innerOpen : openJobId;
  const limited = limitedFor !== null && limitedFor > 0;
  const state: QueueState = paused ? "paused" : limited ? "limited" : "live";
  const halted = paused || limited;

  const slots = concurrency ?? workers.length;
  const layout = layoutFor(width, workers.length);

  const running = jobs.filter((job) => job.status === "running");
  const queued = jobs.filter((job) => job.status === "queued");

  const visibleChips = queued.length > layout.capacity ? layout.capacity - 1 : queued.length;
  const overflow = queued.length - visibleChips;
  const chipsBottom = visibleChips > 0 ? ROW_TOP + visibleChips * (CHIP_H + CHIP_GAP) - CHIP_GAP : ROW_TOP;
  const wellTop = queued.length > 0 ? chipsBottom + ROW_GAP : ROW_TOP;
  const wellH = Math.max(0, layout.contentBottom - wellTop);

  /* One running job per slot: its own worker row when free, else the first free one within concurrency. */
  const slotOf = new Map<string, number>();
  const bySlot = new Map<number, QueueJob>();
  for (const job of running) {
    if (bySlot.size >= slots) break;
    const preferred = job.workerId ? workers.findIndex((w) => w.id === job.workerId) : -1;
    let index = preferred >= 0 && !bySlot.has(preferred) ? preferred : -1;
    if (index < 0) index = workers.findIndex((_, i) => !bySlot.has(i));
    if (index < 0) continue;
    slotOf.set(job.id, index);
    bySlot.set(index, job);
  }

  const frames = new Map<string, Frame>();
  for (const job of jobs) {
    if (job.status === "done" || job.status === "failed") {
      const binY = layout.narrow
        ? layout.binRowY
        : job.status === "failed"
          ? ROW_TOP + BIN_H + BIN_GAP
          : ROW_TOP;
      const binW = layout.narrow ? layout.narrowBinW : BIN_W;
      const binH = layout.narrow ? NARROW_BIN_H : BIN_H;
      const binX =
        layout.narrow && job.status === "failed"
          ? layout.workersX + layout.narrowBinW + BIN_GAP
          : layout.narrow
            ? layout.workersX
            : layout.binsX;
      frames.set(job.id, {
        x: binX + binW / 2 - GHOST / 2,
        y: binY + binH / 2 - GHOST / 2,
        w: GHOST,
        h: GHOST,
        shape: "gone",
      });
      continue;
    }
    const slot = slotOf.get(job.id);
    if (slot !== undefined) {
      frames.set(job.id, {
        x: layout.workersX + layout.railLeft,
        y: ROW_TOP + slot * (ROW_H + ROW_GAP) + RAIL_TOP,
        w: layout.railW,
        h: RAIL_H,
        shape: "bar",
      });
    }
  }

  /* Anything without a slot queues up behind the chips, so no job ever vanishes from the board. */
  let spill = visibleChips;
  for (const job of jobs) {
    if (frames.has(job.id)) continue;
    const chipRow = job.status === "queued" ? queued.findIndex((q) => q.id === job.id) : -1;
    if (job.status === "queued" && chipRow >= visibleChips) continue;
    const row = chipRow >= 0 ? chipRow : spill;
    spill += 1;
    frames.set(job.id, {
      x: PAD,
      y: ROW_TOP + row * (CHIP_H + CHIP_GAP),
      w: layout.queueW,
      h: CHIP_H,
      shape: "chip",
    });
  }

  const peak = depth.length ? Math.max(...depth) : 0;
  const average = depth.length ? depth.reduce((a, b) => a + b, 0) / depth.length : 0;
  const ymax = Math.max(4, Math.ceil((Math.max(peak, backpressure, 1) * 1.2) / 4) * 4);
  const lastDepth = depth.length ? depth[depth.length - 1] : 0;

  const points: Pt[] = depth.map((value, index) => ({
    x: depth.length > 1 ? (index / (depth.length - 1)) * layout.plotW : 0,
    y: clamp(value, 0, ymax),
  }));
  const line = monotonePath(points);
  const area = line ? `${line}L${round2(layout.plotW)},0L0,0Z` : "";

  const bands = rateLimits.map((limit) => {
    const edgeA = clamp(layout.plotW * (1 - limit.from / windowMs), 0, layout.plotW);
    const edgeB = clamp(layout.plotW * (1 - limit.to / windowMs), 0, layout.plotW);
    return { x: Math.min(edgeA, edgeB), width: Math.abs(edgeB - edgeA) };
  });

  const openJob = openId ? (jobs.find((job) => job.id === openId && job.status !== "done" && job.status !== "failed") ?? null) : null;
  const openFrame = openJob ? frames.get(openJob.id) : undefined;
  const popW = Math.min(POP_W, width - PAD * 2);

  const setOpen = (id: string | null) => {
    if (openJobId === undefined) setInnerOpen(id);
    onOpenJobChange?.(id, id ? (jobs.find((job) => job.id === id) ?? null) : null);
  };

  /* Roving tab stop: the first job still on the board, or wherever the keyboard went last. */
  const live = jobs.filter((job) => job.status !== "done" && job.status !== "failed" && frames.has(job.id));
  const activeStop = tabStop ?? live[0]?.id ?? null;

  const stepFocus = (fromId: string, step: number) => {
    const at = live.findIndex((job) => job.id === fromId);
    if (at < 0 || live.length === 0) return;
    const next = live[(at + step + live.length) % live.length];
    setTabStop(next.id);
    jobNodes.current.get(next.id)?.focus();
  };

  const onJobKey = (event: ReactKeyboardEvent<HTMLButtonElement>, id: string) => {
    if (event.key === "Escape") {
      setOpen(null);
      return;
    }
    const step =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    stepFocus(id, step);
  };

  const pillLabel =
    state === "paused"
      ? "Paused"
      : state === "limited"
        ? `Rate limited · ${Math.max(1, Math.round((limitedFor ?? 0) / 1000))}s`
        : "Live";

  return (
    <div
      ref={rootRef}
      className={["ui-agqc", className].filter(Boolean).join(" ")}
      data-state={state}
      style={withVars({}, { "--ui-agqc-ymax": ymax })}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-agent-queue" precedence="default">
        {css}
      </style>

      <header className="ui-agqc__head">
        <span className="ui-agqc__mark">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M18 18H6C5.05719 18 4.58579 18 4.29289 17.7071C4 17.4142 4 16.9428 4 16C4 15.0572 4 14.5858 4.29289 14.2929C4.58579 14 5.05719 14 6 14H18C18.9428 14 19.4142 14 19.7071 14.2929C20 14.5858 20 15.0572 20 16C20 16.9428 20 17.4142 19.7071 17.7071C19.4142 18 18.9428 18 18 18Z"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
            <path d="M4 10H20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            <path d="M4 6H20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          </svg>
        </span>
        <span className="ui-agqc__title">{title}</span>
        {name ? <span className="ui-agqc__name">{name}</span> : null}
        <span className="ui-agqc__pill" data-status={state}>
          <span className="ui-agqc__pulse" aria-hidden="true" />
          {pillLabel}
        </span>
        <span className="ui-agqc__tools">
          <button
            type="button"
            className="ui-agqc__btn"
            aria-pressed={paused}
            aria-label={paused ? "Resume the queue" : "Pause the queue"}
            onClick={() => onPausedChange?.(!paused)}
          >
            {paused ? ICON_PLAY : ICON_PAUSE}
            <span className="ui-agqc__btn-text">{paused ? "Resume" : "Pause"}</span>
          </button>
          <span className="ui-agqc__stepper" role="group" aria-label="Workers">
            <button
              type="button"
              aria-label="One worker less"
              disabled={slots <= minConcurrency}
              onClick={() => onConcurrencyChange?.(slots - 1)}
            >
              {ICON_MINUS}
            </button>
            <output className="ui-agqc__stepper-value" aria-live="polite" aria-label={`${slots} workers`}>
              {slots}
            </output>
            <button
              type="button"
              aria-label="One worker more"
              disabled={slots >= maxConcurrency}
              onClick={() => onConcurrencyChange?.(slots + 1)}
            >
              {ICON_PLUS}
            </button>
          </span>
        </span>
      </header>

      <div className="ui-agqc__card">
        <dl className="ui-agqc__stats">
          <div className="ui-agqc__stat" data-kind={queued.length > backpressure ? "warn" : undefined}>
            <dt>Waiting</dt>
            <dd>
              <span className="ui-agqc__num">{queued.length}</span>
            </dd>
          </div>
          <div className="ui-agqc__stat">
            <dt>Running</dt>
            <dd>
              <span className="ui-agqc__num">{running.length}</span>
              <span className="ui-agqc__of">/{slots}</span>
            </dd>
          </div>
          <div className="ui-agqc__stat">
            <dt>Throughput</dt>
            <dd>
              <span className="ui-agqc__num">{throughput}</span>
              <span className="ui-agqc__of">/min</span>
            </dd>
          </div>
          <div className="ui-agqc__stat">
            <dt>Wait p95</dt>
            <dd>
              <span className="ui-agqc__num">{secs(waitP95)}</span>
            </dd>
          </div>
        </dl>

        <div
          className="ui-agqc__flow"
          data-narrow={layout.narrow ? "" : undefined}
          style={{ height: px(layout.flowH) }}
        >
          <span
            className="ui-agqc__col-head"
            style={{
              translate: `${px(PAD)} ${px(HEAD_TOP)}`,
              width: px(layout.queueW),
              height: px(HEAD_H),
            }}
          >
            <span>Queue</span>
            <b>
              <span className="ui-agqc__num">{queued.length}</span>
            </b>
          </span>
          <span
            className="ui-agqc__col-head"
            style={{
              translate: `${px(layout.workersX)} ${px(HEAD_TOP)}`,
              width: px(layout.workersW),
              height: px(HEAD_H),
            }}
          >
            <span>Workers</span>
            <b>
              {bySlot.size}/{slots}
            </b>
          </span>

          <span
            className="ui-agqc__well"
            aria-hidden="true"
            data-empty={queued.length > 0 ? "" : undefined}
            style={{
              translate: `${px(PAD)} ${px(wellTop)}`,
              width: px(layout.queueW),
              height: px(wellH),
            }}
          />
          {queued.length === 0 ? (
            <span
              className="ui-agqc__empty"
              style={{
                translate: `${px(PAD)} ${px(wellTop)}`,
                width: px(layout.queueW),
                height: px(wellH),
              }}
            >
              {emptyLabel}
            </span>
          ) : null}

          {workers.map((worker, index) => {
            const job = bySlot.get(index);
            return (
              <div
                key={worker.id}
                className="ui-agqc__slot"
                data-busy={job ? "" : undefined}
                style={{
                  translate: `${px(layout.workersX)} ${px(ROW_TOP + index * (ROW_H + ROW_GAP))}`,
                  width: px(layout.workersW),
                  height: px(ROW_H),
                }}
              >
                <span className="ui-agqc__who" style={{ width: px(layout.whoW) }}>
                  <span className="ui-agqc__logo" data-logo="">
                    {worker.icon ?? ICON_SPARK}
                  </span>
                  <span className="ui-agqc__who-text">
                    <span className="ui-agqc__who-name">{worker.name}</span>
                  </span>
                </span>
                <span
                  className="ui-agqc__rail"
                  style={{
                    left: px(layout.railLeft),
                    top: px(RAIL_TOP),
                    width: px(layout.railW),
                    height: px(RAIL_H),
                  }}
                >
                  {job ? null : <span>Idle</span>}
                </span>
              </div>
            );
          })}

          <div
            className="ui-agqc__bin"
            data-kind="done"
            style={{
              translate: layout.narrow
                ? `${px(layout.workersX)} ${px(layout.binRowY)}`
                : `${px(layout.binsX)} ${px(ROW_TOP)}`,
              width: px(layout.narrow ? layout.narrowBinW : BIN_W),
              height: px(layout.narrow ? NARROW_BIN_H : BIN_H),
            }}
          >
            <span className="ui-agqc__bin-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 14L8.5 17.5L19 6.5"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.4"
                />
              </svg>
            </span>
            <span className="ui-agqc__bin-label">Done</span>
            <span className="ui-agqc__bin-count">
              <span className="ui-agqc__num">{done}</span>
            </span>
            <span className="ui-agqc__bin-hit" aria-hidden="true" />
          </div>

          <div
            className="ui-agqc__bin"
            data-kind="failed"
            style={{
              translate: layout.narrow
                ? `${px(layout.workersX + layout.narrowBinW + BIN_GAP)} ${px(layout.binRowY)}`
                : `${px(layout.binsX)} ${px(ROW_TOP + BIN_H + BIN_GAP)}`,
              width: px(layout.narrow ? layout.narrowBinW : BIN_W),
              height: px(layout.narrow ? NARROW_BIN_H : BIN_H),
            }}
          >
            <span className="ui-agqc__bin-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.4"
                />
              </svg>
            </span>
            <span className="ui-agqc__bin-label">Failed</span>
            <span className="ui-agqc__bin-count">
              <span className="ui-agqc__num">{failed}</span>
            </span>
            <span className="ui-agqc__bin-hit" aria-hidden="true" />
          </div>

          <div
            className="ui-agqc__jobs"
            role="group"
            aria-label={`Jobs: ${running.length} running, ${queued.length} waiting`}
          >
            {jobs.map((job) => {
              const frame = frames.get(job.id);
              if (!frame) return null;
              const isQueued = job.status === "queued";
              const isRunning = job.status === "running";
              const landed = job.status === "done" || job.status === "failed";
              const queuePosition = isQueued ? queued.findIndex((q) => q.id === job.id) : -1;
              const p = progressOf(job);
              const meta = isQueued
                ? secs(job.waited ?? 0)
                : isRunning
                  ? halted
                    ? "Paused"
                    : secs(job.elapsed ?? 0)
                  : STATUS_TEXT[job.status];
              const label = [
                job.name,
                KIND_TEXT[job.kind],
                isQueued
                  ? `waiting ${secs(job.waited ?? 0)}, position ${queuePosition + 1} of ${queued.length}`
                  : isRunning
                    ? halted
                      ? `paused at ${Math.round(p * 100)}%`
                      : `running ${secs(job.elapsed ?? 0)}, ${Math.round(p * 100)}%`
                    : null,
                job.priority === "high" ? "high priority" : null,
              ]
                .filter(Boolean)
                .join(", ");

              return (
                <button
                  key={job.id}
                  ref={(node) => {
                    if (node) jobNodes.current.set(job.id, node);
                    else jobNodes.current.delete(job.id);
                  }}
                  type="button"
                  className="ui-agqc__job"
                  data-shape={frame.shape}
                  data-kind={job.kind}
                  data-status={job.status}
                  data-priority={job.priority === "high" ? "high" : undefined}
                  data-flash={job.flash ? "" : undefined}
                  data-halted={isRunning && halted ? "" : undefined}
                  data-open={openId === job.id ? "" : undefined}
                  tabIndex={landed || job.id !== activeStop ? -1 : 0}
                  aria-label={label}
                  aria-haspopup="dialog"
                  aria-expanded={openId === job.id}
                  aria-hidden={landed ? true : undefined}
                  style={withVars(
                    {
                      translate: `${px(frame.x)} ${px(frame.y)}`,
                      width: px(frame.w),
                      height: px(frame.h),
                      animationDelay: "0ms",
                    },
                    { "--p": p },
                  )}
                  onClick={() => setOpen(openId === job.id ? null : job.id)}
                  onFocus={() => setTabStop(job.id)}
                  onKeyDown={(event) => onJobKey(event, job.id)}
                >
                  <span className="ui-agqc__fill" aria-hidden="true" />
                  <span className="ui-agqc__job-in" aria-hidden="true">
                    <span className="ui-agqc__job-icon" data-logo={job.icon ? "" : undefined}>
                      {job.icon ?? ICON_SPARK}
                    </span>
                    <span className="ui-agqc__job-name">{job.name}</span>
                    {job.priority === "high" ? (
                      <span className="ui-agqc__badge" data-kind="high" title="High priority">
                        {ICON_PRIORITY}
                      </span>
                    ) : null}
                    {job.attempts && job.attempts > 1 ? (
                      <span className="ui-agqc__badge" data-kind="retry" title={`${job.attempts} attempts`}>
                        {`×${job.attempts}`}
                      </span>
                    ) : null}
                    <span className="ui-agqc__job-meta">{meta}</span>
                  </span>
                </button>
              );
            })}

            {overflow > 0 ? (
              <span
                className="ui-agqc__more"
                style={{
                  translate: `${px(PAD)} ${px(ROW_TOP + visibleChips * (CHIP_H + CHIP_GAP))}`,
                  width: px(layout.queueW),
                  height: px(CHIP_H),
                }}
              >
                {`+${overflow}`}
              </span>
            ) : null}
          </div>

          {openJob && openFrame ? (
            <div
              className="ui-agqc__pop"
              data-pinned=""
              role="dialog"
              aria-label={openJob.name}
              style={{
                translate:
                  `${px(clamp(openFrame.x, PAD, Math.max(PAD, width - PAD - popW)))} ` +
                  `${px(clamp(openFrame.y + openFrame.h + 6, 0, Math.max(0, layout.flowH - POP_EST_H)))}`,
                width: px(popW),
              }}
            >
              <div className="ui-agqc__pop-head">
                <span className="ui-agqc__pop-icon" data-logo={openJob.icon ? "" : undefined}>
                  {openJob.icon ?? ICON_SPARK}
                </span>
                <span className="ui-agqc__pop-who">
                  <span className="ui-agqc__pop-name">{openJob.name}</span>
                  <span className="ui-agqc__pop-kind">
                    {KIND_TEXT[openJob.kind]}
                    {openJob.workerId
                      ? ` · ${workers.find((worker) => worker.id === openJob.workerId)?.name ?? openJob.workerId}`
                      : ""}
                  </span>
                </span>
                <span className="ui-agqc__pill" data-status={openJob.status}>
                  {STATUS_TEXT[openJob.status]}
                </span>
                <button
                  type="button"
                  className="ui-agqc__close"
                  aria-label="Close"
                  onClick={() => setOpen(null)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                </button>
              </div>

              <dl className="ui-agqc__pop-stats">
                <div>
                  <dt>Queued</dt>
                  <dd>{openJob.status === "queued" ? secs(openJob.waited ?? 0) : "—"}</dd>
                </div>
                <div>
                  <dt>Run</dt>
                  <dd>{openJob.status === "running" ? secs(openJob.elapsed ?? 0) : "—"}</dd>
                </div>
                <div>
                  <dt>Kind</dt>
                  <dd>{KIND_TEXT[openJob.kind]}</dd>
                </div>
                <div>
                  <dt>Progress</dt>
                  <dd>{`${Math.round(progressOf(openJob) * 100)}%`}</dd>
                </div>
              </dl>

              {openJob.error ? (
                <div className="ui-agqc__pop-error">
                  {ICON_ALERT}
                  <span>{openJob.error}</span>
                </div>
              ) : null}

              {openJob.status === "queued" || openJob.status === "running" ? (
                <div className="ui-agqc__pop-actions">
                  {openJob.status === "queued" && openJob.attempts && openJob.attempts > 1 && onRetry ? (
                    <button type="button" className="ui-agqc__btn" onClick={() => onRetry(openJob)}>
                      {ICON_RETRY}
                      <span className="ui-agqc__btn-text">Retry</span>
                    </button>
                  ) : null}
                  {openJob.status === "queued" && onPromote ? (
                    <button
                      type="button"
                      className="ui-agqc__btn"
                      onClick={() => {
                        onPromote(openJob);
                        setOpen(null);
                      }}
                    >
                      {ICON_PRIORITY}
                      <span className="ui-agqc__btn-text">Promote</span>
                    </button>
                  ) : null}
                  {onCancel ? (
                    <button
                      type="button"
                      className="ui-agqc__btn"
                      data-kind="danger"
                      onClick={() => {
                        onCancel(openJob);
                        setOpen(null);
                      }}
                    >
                      {ICON_X}
                      <span className="ui-agqc__btn-text">
                        {openJob.status === "running" ? "Stop" : "Cancel"}
                      </span>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="ui-agqc__chart">
          <div className="ui-agqc__chart-head">
            <span className="ui-agqc__chart-title">Queue depth</span>
          </div>
          <div
            className="ui-agqc__plot"
            role="img"
            aria-label={
              `Queue depth over the last ${Math.round(windowMs / 1000)}s: ` +
              `${queued.length} waiting now, peak ${peak}, average ${average.toFixed(1)}, ` +
              `backpressure line at ${backpressure}, rate limited ${rateLimits.length} times` +
              (failed > 0 ? `, ${failed} failed in all.` : ".")
            }
            style={{ height: px(PLOT_H) }}
          >
            <span className="ui-agqc__grid" data-zero="" aria-hidden="true" style={withVars({}, { "--v": 0 })}>
              <span>{0}</span>
            </span>
            <span className="ui-agqc__grid" aria-hidden="true" style={withVars({}, { "--v": ymax })}>
              <span>{ymax}</span>
            </span>

            <svg
              className="ui-agqc__svg"
              width={Math.round(layout.plotW)}
              height={PLOT_H}
              viewBox={`0 0 ${round2(layout.plotW)} ${PLOT_H}`}
              aria-hidden="true"
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0" className="ui-agqc__stop" data-at="top" />
                  <stop offset="1" className="ui-agqc__stop" data-at="bottom" />
                </linearGradient>
              </defs>
              {bands.map((band, index) => (
                <g className="ui-agqc__band" key={index}>
                  <rect x={round2(band.x)} y="0" width={round2(band.width)} height={PLOT_H} />
                </g>
              ))}
              <g className="ui-agqc__scaled" style={withVars({}, { "--h": PLOT_H })}>
                {area ? <path className="ui-agqc__area" d={area} fill={`url(#${gradientId})`} /> : null}
                {line ? <path className="ui-agqc__line" d={line} /> : null}
                <line
                  className="ui-agqc__bp"
                  x1="0"
                  x2={round2(layout.plotW)}
                  y1={backpressure}
                  y2={backpressure}
                />
              </g>
            </svg>

            <span className="ui-agqc__bp-label" aria-hidden="true" style={withVars({}, { "--v": backpressure })}>
              {backpressure}
            </span>
            <span className="ui-agqc__dot" aria-hidden="true" style={withVars({}, { "--v": lastDepth })} />
          </div>
          <div className="ui-agqc__axis" aria-hidden="true">
            <span>{`${Math.round(windowMs / 1000)}s ago`}</span>
            <span>now</span>
          </div>
        </div>
      </div>

      <div className="ui-agqc__sr" aria-live="polite">
        {paused
          ? "Queue paused."
          : limited
            ? `Rate limited for ${Math.max(1, Math.round((limitedFor ?? 0) / 1000))} more seconds.`
            : ""}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ icons */

const ICON_PAUSE = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 7C4 5.58579 4 4.87868 4.43934 4.43934C4.87868 4 5.58579 4 7 4C8.41421 4 9.12132 4 9.56066 4.43934C10 4.87868 10 5.58579 10 7V17C10 18.4142 10 19.1213 9.56066 19.5607C9.12132 20 8.41421 20 7 20C5.58579 20 4.87868 20 4.43934 19.5607C4 19.1213 4 18.4142 4 17V7Z"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <path
      d="M14 7C14 5.58579 14 4.87868 14.4393 4.43934C14.8787 4 15.5858 4 17 4C18.4142 4 19.1213 4 19.5607 4.43934C20 4.87868 20 5.58579 20 7V17C20 18.4142 20 19.1213 19.5607 19.5607C19.1213 20 18.4142 20 17 20C15.5858 20 14.8787 20 14.4393 19.5607C14 19.1213 14 18.4142 14 17V7Z"
      stroke="currentColor"
      strokeWidth="1.8"
    />
  </svg>
);

const ICON_PLAY = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M7 4.6C7 4.02 7.63 3.66 8.13 3.95L19.2 10.35C19.7 10.64 19.7 11.36 19.2 11.65L8.13 18.05C7.63 18.34 7 17.98 7 17.4V4.6Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
);

const ICON_MINUS = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M20 12L4 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

const ICON_PLUS = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 4V20M20 12H4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

const ICON_X = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.4"
    />
  </svg>
);

const ICON_SPARK = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M15 2L15.5387 4.39157C15.9957 6.42015 17.5798 8.00431 19.6084 8.46127L22 9L19.6084 9.53873C17.5798 9.99569 15.9957 11.5798 15.5387 13.6084L15 16L14.4613 13.6084C14.0043 11.5798 12.4202 9.99569 10.3916 9.53873L8 9L10.3916 8.46127C12.4201 8.00431 14.0043 6.42015 14.4613 4.39158L15 2Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="2"
    />
    <path
      d="M7 12L7.38481 13.7083C7.71121 15.1572 8.84275 16.2888 10.2917 16.6152L12 17L10.2917 17.3848C8.84275 17.7112 7.71121 18.8427 7.38481 20.2917L7 22L6.61519 20.2917C6.28879 18.8427 5.15725 17.7112 3.70827 17.3848L2 17L3.70827 16.6152C5.15725 16.2888 6.28879 15.1573 6.61519 13.7083L7 12Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

const ICON_PRIORITY = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 5.5V19" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.8" />
    <path
      d="M18 11C18 11 13.5811 5.00001 12 5C10.4188 4.99999 6 11 6 11"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.8"
    />
  </svg>
);

const ICON_RETRY = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M19.5 12A7.5 7.5 0 1 1 17.3 6.7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path
      d="M19.5 4.5V7.7H16.3"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
);

const ICON_ALERT = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 3.5L21.5 20H2.5L12 3.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    <path d="M12 10V14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="M12 17.2V17.3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </svg>
);

const css = /* css */ `
@property --ui-agqc-ymax{syntax: "<number>";inherits: true;initial-value: 10}
.ui-agqc{--ui-agqc-card: #fffdfb;--ui-agqc-strong: #0b0908;--ui-agqc-ink: rgba(11, 9, 8, 0.88);--ui-agqc-text: rgba(11, 9, 8, 0.61);--ui-agqc-muted: rgba(11, 9, 8, 0.45);--ui-agqc-faint: rgba(11, 9, 8, 0.27);--ui-agqc-line: rgba(11, 9, 8, 0.06);--ui-agqc-grid: rgba(11, 9, 8, 0.045);--ui-agqc-fill: rgba(11, 9, 8, 0.06);--ui-agqc-wash: rgba(11, 9, 8, 0.02);--ui-agqc-accent: rgba(217, 84, 31, 0.765);--ui-agqc-depth: rgba(255, 107, 53, 0.9);--ui-agqc-depth-fill: rgba(255, 107, 53, 0.14);--ui-agqc-depth-fade: rgba(255, 107, 53, 0);--ui-agqc-agent-bg: rgba(11, 9, 8, 0.045);--ui-agqc-agent-edge: rgba(11, 9, 8, 0.1);--ui-agqc-agent-ink: rgba(11, 9, 8, 0.61);--ui-agqc-agent-sq: rgba(11, 9, 8, 0.1);--ui-agqc-llm-bg: rgba(255, 107, 53, 0.1);--ui-agqc-llm-edge: rgba(255, 107, 53, 0.3);--ui-agqc-llm-ink: #ff6b35;--ui-agqc-llm-sq: rgba(255, 107, 53, 0.22);--ui-agqc-tool-bg: rgba(217, 84, 31, 0.085);--ui-agqc-tool-edge: rgba(217, 84, 31, 0.28);--ui-agqc-tool-ink: #a33f16;--ui-agqc-tool-sq: rgba(217, 84, 31, 0.2);--ui-agqc-human-bg: rgba(217, 84, 31, 0.08);--ui-agqc-human-edge: rgba(217, 84, 31, 0.26);--ui-agqc-human-ink: #d9541f;--ui-agqc-human-sq: rgba(217, 84, 31, 0.18);--ui-agqc-error-bg: #b3261e18;--ui-agqc-error-edge: rgba(179, 38, 30, 0.34);--ui-agqc-error-ink: #b3261eda;--ui-agqc-ok-bg: #1a7a4a19;--ui-agqc-ok-edge: rgba(26, 122, 74, 0.3);--ui-agqc-ok-fg: #1a7a4ae0;--ui-agqc-warn: #e8b05c;--ui-agqc-warn-bg: #d9953029;--ui-agqc-warn-soft: #d9953012;--ui-agqc-warn-edge: rgba(217, 149, 48, 0.36);--ui-agqc-warn-fg: #d9541f;--ui-agqc-brand-bg: #ff6b3519;--ui-agqc-brand-fg: #d9541ff2;--ui-agqc-focus: rgba(217, 84, 31, 0.35);--ui-agqc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-agqc-lift: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 1px 2px 0 rgba(11, 9, 8, 0.06), 0 2px 6px -3px rgba(11, 9, 8, 0.08);--ui-agqc-pop: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 12px 28px -10px rgba(11, 9, 8, 0.18), 0 1px 2px rgba(11, 9, 8, 0.05);--ui-agqc-ease: cubic-bezier(0.32, 0.72, 0.24, 1);position: relative;box-sizing: border-box;width: 100%;border-radius: 12px;background: var(--ui-agqc-card);box-shadow: var(--ui-agqc-shadow);container: ui-agqc / inline-size;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;font-weight: 400;line-height: 20px;color: var(--ui-agqc-text);text-align: left;-webkit-font-smoothing: antialiased}
.ui-agqc *, .ui-agqc *::before, .ui-agqc *::after{box-sizing: border-box}
:where(.ui-agqc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;text-align: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-agqc button:focus-visible{outline: 2px solid var(--ui-agqc-focus);outline-offset: 1px}
.ui-agqc :is(p, dl, dd){margin: 0}
.ui-agqc svg{display: block;flex: none}
.ui-agqc__num{font-variant-numeric: tabular-nums}
.ui-agqc__head{display: flex;align-items: center;gap: 8px;min-width: 0;min-height: 52px;padding: 12px 12px 12px 16px;border-bottom: 0.5px solid var(--ui-agqc-line)}
.ui-agqc__mark{display: grid;flex: none;place-items: center;width: 16px;color: var(--ui-agqc-accent)}
.ui-agqc__title{flex: none;font-weight: 500;color: var(--ui-agqc-strong)}
.ui-agqc__name{min-width: 0;overflow: hidden;color: var(--ui-agqc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-agqc__pill{display: inline-flex;flex: none;align-items: center;gap: 5px;height: 20px;padding: 0 7px;border-radius: 5px;background: var(--ui-agqc-fill);font-size: 12px;font-weight: 500;line-height: 16px;color: var(--ui-agqc-text);white-space: nowrap}
.ui-agqc__pill > svg{width: 11px;height: 11px}
.ui-agqc__pill:is([data-status="live"], [data-status="running"]){background: var(--ui-agqc-brand-bg);color: var(--ui-agqc-brand-fg)}
.ui-agqc__pill[data-status="limited"]{background: var(--ui-agqc-warn-bg);color: var(--ui-agqc-warn-fg)}
.ui-agqc__pill[data-status="done"]{background: var(--ui-agqc-ok-bg);color: var(--ui-agqc-ok-fg)}
.ui-agqc__pill[data-status="failed"]{background: var(--ui-agqc-error-bg);color: var(--ui-agqc-error-ink)}
.ui-agqc__pulse{width: 6px;height: 6px;border-radius: 50%;background: currentColor;animation: ui-agqc-pulse var(--nm-dur-6, 1100ms) ease-in-out infinite}
.ui-agqc__tools{display: flex;flex: none;align-items: center;gap: 8px;margin-left: auto}
.ui-agqc__btn{display: inline-flex;align-items: center;gap: 6px;height: 28px;padding: 0 10px 0 6px;border-radius: 6px;background: var(--ui-agqc-card);box-shadow: var(--ui-agqc-shadow);font-size: 13px;font-weight: 500;color: var(--ui-agqc-strong);white-space: nowrap;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agqc__btn > svg{width: 16px;height: 16px;color: rgba(11, 9, 8, 0.447)}
.ui-agqc__btn:hover{background: rgba(11, 9, 8, 0.02)}
.ui-agqc__btn[aria-pressed="true"]{color: var(--ui-agqc-brand-fg)}
.ui-agqc__btn[aria-pressed="true"] > svg{color: var(--ui-agqc-brand-fg)}
.ui-agqc__btn[data-kind="danger"], .ui-agqc__btn[data-kind="danger"] > svg{color: var(--ui-agqc-error-ink)}
.ui-agqc__stepper{display: inline-flex;align-items: center;height: 28px;padding: 0 2px 0 10px;border-radius: 6px;background: var(--ui-agqc-card);box-shadow: var(--ui-agqc-shadow)}
.ui-agqc__stepper button{display: grid;place-items: center;width: 24px;height: 24px;border-radius: 4px;color: rgba(11, 9, 8, 0.447);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agqc__stepper button:hover:not(:disabled){background: var(--ui-agqc-fill);color: var(--ui-agqc-ink)}
.ui-agqc__stepper button:disabled{opacity: 0.35;cursor: default}
.ui-agqc__stepper-value{min-width: 18px;font-weight: 500;color: var(--ui-agqc-strong);text-align: center;font-variant-numeric: tabular-nums}
.ui-agqc__card{position: relative}
.ui-agqc__stats{display: grid;grid-template-columns: repeat(4, minmax(0, 1fr));padding: 12px 0;border-bottom: 0.5px solid var(--ui-agqc-line)}
.ui-agqc__stat{display: grid;gap: 2px;min-width: 0;padding: 0 16px}
.ui-agqc__stat:first-child{padding-left: 22px}
.ui-agqc__stat:last-child{padding-right: 10px}
.ui-agqc__stat + .ui-agqc__stat{border-left: 0.5px solid var(--ui-agqc-line)}
.ui-agqc__stat dt{overflow: hidden;font-size: 10px;font-weight: 500;line-height: 16px;letter-spacing: 0.5px;text-transform: uppercase;color: var(--ui-agqc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-agqc__stat dd{overflow: hidden;font-size: 15px;font-weight: 500;line-height: 24px;color: var(--ui-agqc-ink);white-space: nowrap;font-variant-numeric: tabular-nums;transition: color 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agqc__of{margin-left: 1px;font-size: 13px;color: var(--ui-agqc-muted)}
.ui-agqc__stat[data-kind="warn"] dd{color: var(--ui-agqc-warn-fg)}
.ui-agqc__stat[data-kind="failed"] dd{color: var(--ui-agqc-error-ink)}
.ui-agqc__flow{position: relative;border-bottom: 0.5px solid var(--ui-agqc-line);transition: height var(--nm-dur-4, 380ms) var(--ui-agqc-ease)}
.ui-agqc__flow > *, .ui-agqc__jobs > *{position: absolute;top: 0;left: 0}
.ui-agqc__col-head{display: flex;align-items: center;gap: 6px;font-size: 10px;font-weight: 500;line-height: 16px;letter-spacing: 0.5px;text-transform: uppercase;color: var(--ui-agqc-muted);white-space: nowrap}
.ui-agqc__col-head > b{font-size: 12px;font-weight: 500;letter-spacing: 0;color: var(--ui-agqc-ink);font-variant-numeric: tabular-nums}
.ui-agqc__col-head > .ui-agqc__col-more{margin-left: auto;letter-spacing: 0.3px}
.ui-agqc__well{border-radius: 6px;background: var(--ui-agqc-wash);box-shadow: inset 0 0 0 0.5px var(--ui-agqc-line)}
.ui-agqc__empty{display: grid;place-items: center;color: var(--ui-agqc-faint);animation: ui-agqc-calm var(--nm-dur-3, 240ms) var(--ui-agqc-ease) both}
.ui-agqc__well{transition: opacity var(--nm-dur-3, 240ms) var(--ui-agqc-ease)}
.ui-agqc__well[data-empty]{opacity: 0}
@keyframes ui-agqc-calm{from{opacity: 0}
}
.ui-agqc__more{display: grid;place-items: center;border-radius: 3px;background: var(--ui-agqc-fill);font-size: 10px;font-weight: 500;line-height: 12px;color: var(--ui-agqc-text);font-variant-numeric: tabular-nums}
.ui-agqc__slot{border-radius: 8px;background: var(--ui-agqc-wash);box-shadow: inset 0 0 0 0.5px var(--ui-agqc-line);transition: translate var(--nm-dur-5, 620ms) var(--ui-agqc-ease), width var(--nm-dur-5, 620ms) var(--ui-agqc-ease), background-color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));animation: ui-agqc-slot var(--nm-dur-4, 380ms) var(--ui-agqc-ease) both}
.ui-agqc__who{position: absolute;top: 0;bottom: 0;left: 8px;display: flex;align-items: center;gap: 8px;min-width: 0}
.ui-agqc__logo{display: grid;flex: none;place-items: center;width: 24px;height: 24px;border-radius: 5px;background: var(--ui-agqc-card);box-shadow: var(--ui-agqc-shadow);font-size: 10px;font-weight: 500;color: var(--ui-agqc-text)}
.ui-agqc__logo > svg{width: 14px;height: 14px}
.ui-agqc__who-text{display: grid;min-width: 0}
.ui-agqc__who-name{overflow: hidden;font-weight: 500;line-height: 16px;color: var(--ui-agqc-strong);white-space: nowrap;text-overflow: ellipsis}
.ui-agqc__rail{position: absolute;display: flex;align-items: center;padding-left: 10px;border-radius: 6px;box-shadow: inset 0 0 0 0.5px var(--ui-agqc-line);background-image: repeating-linear-gradient(-45deg, transparent 0 6px, rgba(11, 9, 8, 0.022) 6px 6.5px);font-size: 12px;color: var(--ui-agqc-faint)}
.ui-agqc__bin{z-index: 1;padding: 12px;border-radius: 8px;background: var(--ui-agqc-wash);box-shadow: inset 0 0 0 0.5px var(--ui-agqc-line)}
.ui-agqc__bin-icon{position: absolute;top: 12px;left: 12px;display: grid;place-items: center;width: 20px;height: 20px;border-radius: 5px}
.ui-agqc__bin[data-kind="done"] .ui-agqc__bin-icon{background: var(--ui-agqc-ok-bg);color: var(--ui-agqc-ok-fg)}
.ui-agqc__bin[data-kind="failed"] .ui-agqc__bin-icon{background: var(--ui-agqc-error-bg);color: var(--ui-agqc-error-ink)}
.ui-agqc__bin-label{position: absolute;top: 14px;left: 40px;font-size: 10px;font-weight: 500;line-height: 16px;letter-spacing: 0.5px;text-transform: uppercase;color: var(--ui-agqc-muted)}
.ui-agqc__bin-count{position: absolute;left: 12px;bottom: 10px;font-size: 20px;font-weight: 500;line-height: 28px;letter-spacing: -0.2px;color: var(--ui-agqc-strong)}
.ui-agqc__bin[data-kind="failed"] .ui-agqc__bin-count{color: var(--ui-agqc-error-ink)}
.ui-agqc__bin-hit{position: absolute;top: 12px;left: 12px;width: 20px;height: 20px;border-radius: 5px;opacity: 0;pointer-events: none;animation: ui-agqc-hit var(--nm-dur-5, 620ms) ease-out 380ms}
.ui-agqc__bin[data-kind="done"] .ui-agqc__bin-hit{box-shadow: 0 0 0 1px var(--ui-agqc-ok-fg)}
.ui-agqc__bin[data-kind="failed"] .ui-agqc__bin-hit{box-shadow: 0 0 0 1px var(--ui-agqc-error-ink)}
.ui-agqc__flow[data-narrow] .ui-agqc__who-text{display: none}
.ui-agqc__flow[data-narrow] .ui-agqc__bin{display: flex;align-items: center;gap: 6px;padding: 0 10px}
.ui-agqc__flow[data-narrow] :is(.ui-agqc__bin-icon, .ui-agqc__bin-label, .ui-agqc__bin-count){position: static}
.ui-agqc__flow[data-narrow] .ui-agqc__bin-icon{flex: none}
.ui-agqc__flow[data-narrow] .ui-agqc__bin-count{order: 1;font-size: 15px;line-height: 24px}
.ui-agqc__flow[data-narrow] .ui-agqc__bin-label{order: 2;min-width: 0;overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-agqc__flow[data-narrow] .ui-agqc__bin-hit{top: 10px}
.ui-agqc [data-kind]{--k-bg: var(--ui-agqc-agent-bg);--k-edge: var(--ui-agqc-agent-edge);--k-ink: var(--ui-agqc-agent-ink);--k-sq: var(--ui-agqc-agent-sq)}
.ui-agqc [data-kind="llm"]{--k-bg: var(--ui-agqc-llm-bg);--k-edge: var(--ui-agqc-llm-edge);--k-ink: var(--ui-agqc-llm-ink);--k-sq: var(--ui-agqc-llm-sq)}
.ui-agqc [data-kind="tool"]{--k-bg: var(--ui-agqc-tool-bg);--k-edge: var(--ui-agqc-tool-edge);--k-ink: var(--ui-agqc-tool-ink);--k-sq: var(--ui-agqc-tool-sq)}
.ui-agqc [data-kind="human"]{--k-bg: var(--ui-agqc-human-bg);--k-edge: var(--ui-agqc-human-edge);--k-ink: var(--ui-agqc-human-ink);--k-sq: var(--ui-agqc-human-sq)}
.ui-agqc .ui-agqc__job:is([data-status="failed"], [data-flash]){--k-bg: var(--ui-agqc-error-bg);--k-edge: var(--ui-agqc-error-edge);--k-ink: var(--ui-agqc-error-ink);--k-sq: var(--ui-agqc-error-edge)}
.ui-agqc .ui-agqc__job[data-status="done"]{--k-bg: var(--ui-agqc-ok-bg);--k-edge: var(--ui-agqc-ok-edge);--k-ink: var(--ui-agqc-ok-fg);--k-sq: var(--ui-agqc-ok-edge)}
.ui-agqc__jobs{position: absolute;inset: 0;pointer-events: none}
.ui-agqc__job{z-index: 1;display: block;overflow: hidden;border-radius: 6px;background: var(--ui-agqc-card);box-shadow: var(--ui-agqc-lift);pointer-events: auto;transition: translate var(--nm-dur-5, 620ms) var(--ui-agqc-ease), width var(--nm-dur-5, 620ms) var(--ui-agqc-ease), height var(--nm-dur-5, 620ms) var(--ui-agqc-ease), border-radius var(--nm-dur-5, 620ms) var(--ui-agqc-ease), background-color var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));animation: ui-agqc-drop var(--nm-dur-5, 620ms) var(--ui-agqc-ease) backwards}
.ui-agqc__job:hover, .ui-agqc__job[data-open]{z-index: 2;box-shadow: 0 0 0 1px var(--k-edge), 0 2px 8px -2px rgba(11, 9, 8, 0.1)}
.ui-agqc__job:focus-visible{z-index: 2;outline: 2px solid var(--ui-agqc-focus);outline-offset: 1px}
.ui-agqc__job[data-flash]{background: var(--k-bg);box-shadow: 0 0 0 0.5px var(--k-edge);animation: ui-agqc-drop var(--nm-dur-5, 620ms) var(--ui-agqc-ease) backwards, ui-agqc-shake var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agqc__job[data-shape="square"]{border-radius: 3px;background: var(--k-sq);box-shadow: inset 0 0 0 0.5px var(--k-edge)}
.ui-agqc__job[data-shape="square"][data-priority="high"]{box-shadow: inset 0 0 0 1.5px var(--ui-agqc-warn)}
.ui-agqc__job[data-shape="square"]:hover{box-shadow: inset 0 0 0 1px var(--k-ink)}
.ui-agqc__job[data-shape="bar"]{box-shadow: var(--ui-agqc-shadow)}
.ui-agqc__job[data-shape="gone"]{z-index: 0;border-radius: 3px;background: var(--k-sq);box-shadow: none;opacity: 0;pointer-events: none;transition: translate var(--nm-dur-4, 380ms) var(--ui-agqc-ease), width var(--nm-dur-4, 380ms) var(--ui-agqc-ease), height var(--nm-dur-4, 380ms) var(--ui-agqc-ease), border-radius var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 220ms}
.ui-agqc__job-in{position: absolute;inset: 0;display: flex;align-items: center;gap: 6px;padding: 0 8px 0 6px;white-space: nowrap;opacity: 1;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 160ms}
.ui-agqc__job:is([data-shape="square"], [data-shape="gone"]) .ui-agqc__job-in{opacity: 0;transition: opacity var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agqc__job-icon{display: grid;flex: none;place-items: center;width: 18px;height: 18px;border-radius: 4px;background: var(--k-bg);color: var(--k-ink)}
.ui-agqc__job-icon[data-logo]{background: var(--ui-agqc-card);box-shadow: var(--ui-agqc-shadow)}
.ui-agqc__job-icon > svg{width: 11px;height: 11px}
.ui-agqc__job-name{flex: 1;min-width: 0;overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-agqc-ink);text-overflow: ellipsis}
.ui-agqc__badge{display: inline-flex;flex: none;align-items: center;gap: 2px;height: 16px;padding: 0 4px;border-radius: 4px;font-size: 10px;font-weight: 500;line-height: 16px;font-variant-numeric: tabular-nums}
.ui-agqc__badge[data-kind="high"]{width: 16px;padding: 0;justify-content: center;background: var(--ui-agqc-warn-bg);color: var(--ui-agqc-warn-fg)}
.ui-agqc__badge[data-kind="retry"]{background: var(--ui-agqc-error-bg);color: var(--ui-agqc-error-ink)}
.ui-agqc__job-meta{flex: none;font-size: 12px;line-height: 16px;color: var(--ui-agqc-muted);font-variant-numeric: tabular-nums}
.ui-agqc__job[data-status="running"] .ui-agqc__job-meta{color: var(--k-ink)}
.ui-agqc__job[data-flash] :is(.ui-agqc__job-name, .ui-agqc__job-meta){color: var(--ui-agqc-error-ink)}
.ui-agqc__fill{position: absolute;inset: 0;border-radius: inherit;background: var(--k-bg);box-shadow: inset 0 0 0 0.5px var(--k-edge);clip-path: inset(0 calc((1 - var(--p)) * 100%) 0 0 round 6px);opacity: 0;transition: clip-path var(--nm-dur-3, 240ms) linear, opacity var(--nm-dur-3, 240ms) var(--ui-agqc-ease), background-color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agqc__job[data-shape="bar"] .ui-agqc__fill{opacity: 1;animation: ui-agqc-grow var(--nm-dur-5, 620ms) var(--ui-agqc-ease) backwards}
.ui-agqc__job[data-shape="bar"] .ui-agqc__fill::before{transition: opacity var(--nm-dur-3, 240ms) var(--ui-agqc-ease);content: "";position: absolute;inset: 0;background: linear-gradient(90deg, transparent, var(--ui-agqc-card), transparent) -60px 0 / 60px 100% no-repeat;opacity: 0.7;animation: ui-agqc-sweep var(--nm-dur-6, 1100ms) linear infinite}
.ui-agqc__job[data-shape="bar"] .ui-agqc__fill::after{transition: opacity var(--nm-dur-3, 240ms) var(--ui-agqc-ease);content: "";position: absolute;top: 0;bottom: 0;left: calc(var(--p) * 100% - 28px);width: 28px;background: linear-gradient(90deg, transparent, var(--k-edge));animation: ui-agqc-glow 1100ms ease-in-out infinite alternate}
.ui-agqc__job[data-shape="gone"] .ui-agqc__fill{opacity: 0}
.ui-agqc__pop{z-index: 5;display: grid;gap: 10px;padding: 12px;border-radius: 10px;background: var(--ui-agqc-card);box-shadow: var(--ui-agqc-pop);pointer-events: none;transition: translate var(--nm-dur-5, 620ms) var(--ui-agqc-ease);animation: ui-agqc-open var(--nm-dur-2, 160ms) var(--ui-agqc-ease) both}
.ui-agqc__pop[data-pinned]{pointer-events: auto}
.ui-agqc__pop-head{display: flex;align-items: center;min-width: 0}
.ui-agqc__pop-icon{display: grid;flex: none;place-items: center;width: 28px;height: 28px;margin-right: 10px;border-radius: 6px;background: var(--k-bg);color: var(--k-ink)}
.ui-agqc__pop-icon[data-logo]{background: var(--ui-agqc-card);box-shadow: var(--ui-agqc-shadow)}
.ui-agqc__pop-icon > svg{width: 15px;height: 15px}
.ui-agqc__pop-who{display: grid;flex: 1;min-width: 0}
.ui-agqc__pop-name{overflow: hidden;font-weight: 500;line-height: 18px;color: var(--ui-agqc-strong);white-space: nowrap;text-overflow: ellipsis}
.ui-agqc__pop-kind{overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-agqc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-agqc__pop-head .ui-agqc__pill{height: 18px;margin-left: 8px;padding: 0 6px;border-radius: 4px;font-size: 11px}
.ui-agqc__close{display: grid;flex: none;place-items: center;width: 28px;height: 28px;margin: -2px -4px 0 4px;border-radius: 6px;color: var(--ui-agqc-muted);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agqc__close:hover{background: var(--ui-agqc-fill);color: var(--ui-agqc-ink)}
.ui-agqc__pop-stats{display: grid;grid-template-columns: repeat(2, minmax(0, 1fr));gap: 8px 12px;padding: 8px 10px;border-radius: 8px;background: rgba(11, 9, 8, 0.025);box-shadow: inset 0 0 0 0.5px var(--ui-agqc-line)}
.ui-agqc__pop-stats dt{font-size: 10px;font-weight: 500;line-height: 16px;letter-spacing: 0.5px;text-transform: uppercase;color: var(--ui-agqc-muted)}
.ui-agqc__pop-stats dd{overflow: hidden;font-weight: 500;line-height: 20px;color: var(--ui-agqc-ink);white-space: nowrap;text-overflow: ellipsis;font-variant-numeric: tabular-nums}
.ui-agqc__pop-error{display: flex;gap: 8px;padding: 8px 10px;border-radius: 8px;background: var(--ui-agqc-error-bg);font-size: 12px;line-height: 16px;color: var(--ui-agqc-error-ink)}
.ui-agqc__pop-error > svg{margin-top: 2px}
.ui-agqc__pop-actions{display: flex;gap: 8px}
.ui-agqc__pop-actions .ui-agqc__btn > svg{width: 12px;height: 12px}
.ui-agqc__chart{padding: 12px 16px 12px}
.ui-agqc__chart-head{display: flex;align-items: center;gap: 8px;margin-bottom: 10px;line-height: 16px;white-space: nowrap}
.ui-agqc__chart-title{font-size: 10px;font-weight: 500;letter-spacing: 0.5px;text-transform: uppercase;color: var(--ui-agqc-muted)}
.ui-agqc__plot{position: relative;margin-left: 26px}
.ui-agqc__grid{position: absolute;left: -6px;right: 0;bottom: calc(var(--v) / var(--ui-agqc-ymax) * 100%);height: 0.5px;background: var(--ui-agqc-line)}
.ui-agqc__grid[data-zero]{background: rgba(11, 9, 8, 0.1)}
.ui-agqc__grid > span{position: absolute;right: calc(100% + 8px);top: -8px;font-size: 12px;line-height: 16px;color: var(--ui-agqc-muted);font-variant-numeric: tabular-nums}
.ui-agqc__svg{position: absolute;inset: 0;overflow: hidden}
.ui-agqc__scaled{transform: translateY(calc(var(--h) * 1px)) scaleY(calc(-1 * var(--h) / var(--ui-agqc-ymax)))}
.ui-agqc__stop[data-at="top"]{stop-color: var(--ui-agqc-depth-fade)}
.ui-agqc__stop[data-at="bottom"]{stop-color: var(--ui-agqc-depth-fill)}
.ui-agqc__line{fill: none;stroke: var(--ui-agqc-depth);stroke-width: 1.25;stroke-linejoin: round;vector-effect: non-scaling-stroke}
.ui-agqc__bp{stroke: var(--ui-agqc-faint);stroke-width: 1;stroke-dasharray: 3 3;vector-effect: non-scaling-stroke}
.ui-agqc__band rect{fill: var(--ui-agqc-warn);opacity: 0.07}
.ui-agqc__bp-label{position: absolute;right: calc(100% + 8px);bottom: calc(var(--v) / var(--ui-agqc-ymax) * 100% - 8px);font-size: 12px;line-height: 16px;color: var(--ui-agqc-muted);font-variant-numeric: tabular-nums}
.ui-agqc__dot{position: absolute;right: -3px;bottom: calc(var(--v) / var(--ui-agqc-ymax) * 100% - 3px);width: 6px;height: 6px;border-radius: 50%;background: var(--ui-agqc-depth);box-shadow: 0 0 0 3px var(--ui-agqc-card)}
.ui-agqc[data-state="live"] .ui-agqc__dot::after, .ui-agqc[data-state="limited"] .ui-agqc__dot::after{content: "";position: absolute;inset: 0;border-radius: 50%;background: var(--ui-agqc-depth);animation: ui-agqc-ping var(--nm-dur-6, 1100ms) ease-out infinite}
.ui-agqc__axis{display: flex;justify-content: space-between;margin: 6px 0 0 26px;font-size: 12px;line-height: 16px;color: var(--ui-agqc-muted);font-variant-numeric: tabular-nums}
.ui-agqc__sr{position: absolute;width: 1px;height: 1px;margin: -1px;padding: 0;overflow: hidden;clip: rect(0 0 0 0);white-space: nowrap;border: 0}
@container ui-agqc (max-width: 560px){.ui-agqc__head{flex-wrap: wrap;row-gap: 10px;padding: 10px 12px}
.ui-agqc__name{display: none}
.ui-agqc__stats{grid-template-columns: repeat(2, minmax(0, 1fr));row-gap: 10px;padding: 10px 0}
.ui-agqc__stat{padding: 0 12px}
.ui-agqc__stat:nth-child(odd){padding-left: 16px}
.ui-agqc__stat:nth-child(3){border-left: 0}
.ui-agqc__chart{padding: 12px 12px 10px}
}
@container ui-agqc (max-width: 440px){.ui-agqc__tools{flex-basis: 100%;justify-content: space-between;margin-left: 0}
.ui-agqc__stat dt{letter-spacing: 0.2px}
}
.ui-agqc__job[data-halted] .ui-agqc__fill{opacity: 0.55}
.ui-agqc__job[data-halted] .ui-agqc__fill::before, .ui-agqc__job[data-halted] .ui-agqc__fill::after{opacity: 0;animation-play-state: paused}
.ui-agqc__job[data-halted] .ui-agqc__job-meta{color: var(--ui-agqc-muted)}
@keyframes ui-agqc-drop{from{opacity: 0;transform: translateY(-10px) scale(0.6)}
}
@keyframes ui-agqc-slot{from{opacity: 0;transform: translateX(-8px)}
}
@keyframes ui-agqc-grow{from{clip-path: inset(0 100% 0 0 round 6px)}
}
@keyframes ui-agqc-sweep{to{background-position: calc(100% + 60px) 0}
}
@keyframes ui-agqc-glow{from{filter: opacity(0.45)}
to{filter: opacity(1)}
}
@keyframes ui-agqc-pulse{50%{opacity: 0.35}
}
@keyframes ui-agqc-pop{from{opacity: 0;transform: scale(0.9)}
}
@keyframes ui-agqc-open{from{opacity: 0;transform: translateY(-4px) scale(0.97)}
}
@keyframes ui-agqc-hit{0%{opacity: 0.45;transform: scale(1)}
100%{opacity: 0;transform: scale(1.45)}
}
@keyframes ui-agqc-ping{0%{opacity: 0.5;transform: scale(1)}
100%{opacity: 0;transform: scale(2.8)}
}
@keyframes ui-agqc-flow{0%, 100%{opacity: 0.35}
40%{opacity: 1}
}
@keyframes ui-agqc-shake{20%{transform: translateX(-3px)}
40%{transform: translateX(3px)}
60%{transform: translateX(-2px)}
80%{transform: translateX(1px)}
}
@media (prefers-reduced-motion: reduce){.ui-agqc *, .ui-agqc *::before, .ui-agqc *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-agqc{--ui-agqc-card: #211b16;--ui-agqc-strong: #fffdfb;--ui-agqc-ink: rgba(255, 253, 251, 0.9);--ui-agqc-text: rgba(255, 253, 251, 0.62);--ui-agqc-muted: rgba(255, 253, 251, 0.45);--ui-agqc-faint: rgba(255, 253, 251, 0.28);--ui-agqc-line: rgba(255, 253, 251, 0.08);--ui-agqc-grid: rgba(255, 253, 251, 0.05);--ui-agqc-fill: rgba(255, 253, 251, 0.08);--ui-agqc-wash: rgba(255, 253, 251, 0.025);--ui-agqc-accent: #ff8a5c;--ui-agqc-depth: rgba(255, 178, 143, 0.95);--ui-agqc-depth-fill: rgba(255, 138, 92, 0.22);--ui-agqc-depth-fade: rgba(255, 138, 92, 0);--ui-agqc-agent-bg: rgba(255, 253, 251, 0.07);--ui-agqc-agent-edge: rgba(255, 253, 251, 0.14);--ui-agqc-agent-ink: rgba(255, 253, 251, 0.7);--ui-agqc-agent-sq: rgba(255, 253, 251, 0.14);--ui-agqc-llm-bg: rgba(255, 138, 92, 0.16);--ui-agqc-llm-edge: rgba(255, 138, 92, 0.38);--ui-agqc-llm-ink: #ff8a5c;--ui-agqc-llm-sq: rgba(255, 138, 92, 0.34);--ui-agqc-tool-bg: rgba(217, 84, 31, 0.13);--ui-agqc-tool-edge: rgba(217, 84, 31, 0.34);--ui-agqc-tool-ink: #ff6b35;--ui-agqc-tool-sq: rgba(217, 84, 31, 0.3);--ui-agqc-human-bg: rgba(255, 107, 53, 0.14);--ui-agqc-human-edge: rgba(255, 107, 53, 0.36);--ui-agqc-human-ink: #ff8a5c;--ui-agqc-human-sq: rgba(255, 107, 53, 0.3);--ui-agqc-error-bg: #e2544a2b;--ui-agqc-error-edge: rgba(226, 84, 74, 0.4);--ui-agqc-error-ink: #e2544a;--ui-agqc-ok-bg: #2f8d5c1f;--ui-agqc-ok-edge: rgba(47, 141, 92, 0.36);--ui-agqc-ok-fg: #2f8d5c;--ui-agqc-warn: #ff8a5c;--ui-agqc-warn-bg: #ff6b3525;--ui-agqc-warn-soft: #ff6b3512;--ui-agqc-warn-edge: rgba(255, 138, 92, 0.36);--ui-agqc-warn-fg: #ff8a5c;--ui-agqc-brand-bg: #ff6b353a;--ui-agqc-brand-fg: #ff8a5c;--ui-agqc-focus: rgba(255, 138, 92, 0.45);--ui-agqc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-agqc-lift: 0 0 0 0.5px rgba(255, 253, 251, 0.12), 0 1px 2px 0 rgba(11, 9, 8, 0.4), 0 2px 6px -3px rgba(11, 9, 8, 0.5);--ui-agqc-pop: 0 0 0 0.5px rgba(255, 253, 251, 0.12), 0 12px 28px -10px rgba(11, 9, 8, 0.6)}
:where(.dark, [data-theme="dark"]) .ui-agqc :is(.ui-agqc__btn, .ui-agqc__stepper button) > svg, :where(.dark, [data-theme="dark"]) .ui-agqc__stepper button{color: rgba(255, 253, 251, 0.55)}
:where(.dark, [data-theme="dark"]) .ui-agqc__btn:hover{background: rgba(255, 253, 251, 0.03)}
:where(.dark, [data-theme="dark"]) .ui-agqc__grid[data-zero]{background: rgba(255, 253, 251, 0.12)}
:where(.dark, [data-theme="dark"]) .ui-agqc__pop-stats{background: rgba(255, 253, 251, 0.03)}
:where(.dark, [data-theme="dark"]) .ui-agqc__rail{background-image: repeating-linear-gradient(-45deg, transparent 0 6px, rgba(255, 253, 251, 0.025) 6px 6.5px)}

`;
