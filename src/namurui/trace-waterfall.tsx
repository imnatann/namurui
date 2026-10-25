"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

/*
 * Trace Waterfall – where the time and money of one agent run went, in a single self-contained
 * file. On the left a tree: the orchestrator, the sub-agents it spawned, the calls they made. On
 * the right the same spans in time: one bar per row on a shared axis, the axis stepping in round
 * units and the clock drawn as a thin line while the run is still going. Each bar carries its own
 * duration and cost, the slowest finished call wears a small tag, and a branch you fold turns
 * into marks on its parent's bar so you can still see where its calls sat. Pressing a row opens
 * its details under the row, with duration, cost, tokens, error and what went in and came out.
 * The styles are injected below, so no extra files are needed.
 */

export type TraceSpanKind = "agent" | "llm" | "tool";
export type TraceSpanStatus = "running" | "done" | "failed";

/** One step of the run – an agent, one of its model calls, or a tool it reached for. */
export type TraceSpan = {
  /** Stable id – folding and the open panel key on it */
  id: string;
  /** Row label – "Plan the launch" */
  name: string;
  kind: TraceSpanKind;
  /** Left out means "done"; a running span keeps its bar growing with the clock */
  status?: TraceSpanStatus;
  /** ms from the start of the run */
  start: number;
  /** ms from the start of the run – left out while it runs */
  end?: number;
  /** Muted words after the name – the model, or what the call touched */
  detail?: string;
  /** Tile glyph – a 24×24 SVG is sized to 12px by the sheet; defaults to the run's mark */
  icon?: ReactNode;
  /** The span's own cost – a parent adds up its children */
  cost?: number;
  /** The span's own tokens – a parent adds up its children */
  tokens?: number;
  /** What the call was given, shown in the details panel */
  input?: string;
  /** What it returned */
  output?: string;
  /** Why it failed – shown in the details panel and paints the row red */
  error?: string;
  children?: readonly TraceSpan[];
};

export type TraceWaterfallProps = {
  /** The whole run – the root span is the first row and everything hangs off it */
  root: TraceSpan;
  /** The clock in ms from the start of the run – fixed for a replay, left out to tick from `startedAt` */
  now?: number;
  /** Epoch ms when the run started – without `now` the component keeps its own clock while it runs */
  startedAt?: number;
  /** Ids of folded spans, controlled */
  collapsed?: readonly string[];
  /** Spans folded before the first paint – uncontrolled */
  defaultCollapsed?: readonly string[];
  /** A branch was folded or opened */
  onCollapsedChange?: (collapsed: string[]) => void;
  /** The span whose details are open, controlled */
  openId?: string | null;
  /** The details open before the first paint – uncontrolled */
  defaultOpenId?: string | null;
  /** A row was pressed, or the panel closed – `null` when nothing is open */
  onOpenChange?: (id: string | null, span?: TraceSpan) => void;
  /** Tags the slowest finished call – needs at least two of them to mean anything */
  markSlowest?: boolean;
  /** The shortest time the axis shows, in ms – the run outgrows it in round steps */
  minRange?: number;
  /** Heading in the bar */
  title?: string;
  /** What the run was asked to do, next to the title */
  task?: string;
  /** Money formatting for the values in the bars and the panel */
  formatCost?: (amount: number) => string;
  /** Extra class on the root */
  className?: string;
};

/** A span with everything its row needs, already resolved against the clock */
type Row = {
  span: TraceSpan;
  depth: number;
  parentId: string | null;
  hasChildren: boolean;
  folded: boolean;
  childCount: number;
  status: TraceSpanStatus;
  /** ms from the span's start to the end of its subtree, or to the clock */
  duration: number;
  cost: number;
  tokens: number;
};

type Totals = { start: number; end: number; cost: number; tokens: number };

/* A row that has just left the tree keeps its old place in the list while it shrinks away, so
   folding a branch closes a gap instead of shuffling everything below it. */
type Ghost = { key: string; row: Row; index: number; hidden: boolean };

const KIND_LABEL: Record<TraceSpanKind, string> = { agent: "Agent run", llm: "LLM call", tool: "Tool call" };
const STATUS_LABEL: Record<TraceSpanStatus, string> = { running: "Live", done: "Done", failed: "Failed" };
const STATUS_ARIA: Record<TraceSpanStatus, string> = { running: "Running", done: "Done", failed: "Failed" };

/** The axis is always five of these apart – 2s steps for a short run, 10s once it passes 34s */
const TICK_STEPS = [1000, 2000, 5000, 10000, 20000, 30000, 60000, 120000, 300000, 600000, 1800000, 3600000];

const statusOf = (span: TraceSpan): TraceSpanStatus => span.status ?? "done";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function formatTokens(count: number): string {
  if (count < 1000) return `${Math.round(count)}`;
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}k`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}

const dollars = (amount: number): string => {
  if (amount <= 0) return "$0.00";
  if (amount >= 0.01) return `$${amount.toFixed(2)}`;
  if (amount >= 0.001) return `$${amount.toFixed(3)}`;
  return `$${amount.toFixed(4)}`;
};

/** A span's own time, widened to its children and, while it runs, to the clock */
function collect(span: TraceSpan, at: number): Totals {
  let end = span.end ?? Math.max(span.start, at);
  let cost = span.cost ?? 0;
  let tokens = span.tokens ?? 0;
  for (const child of span.children ?? []) {
    const inner = collect(child, at);
    if (inner.end > end) end = inner.end;
    cost += inner.cost;
    tokens += inner.tokens;
  }
  return { start: span.start, end, cost, tokens };
}

function hasStatus(span: TraceSpan, wanted: TraceSpanStatus): boolean {
  if (statusOf(span) === wanted) return true;
  return (span.children ?? []).some((child) => hasStatus(child, wanted));
}

function buildRows(root: TraceSpan, foldedIds: readonly string[], at: number): Row[] {
  const rows: Row[] = [];
  const walk = (span: TraceSpan, depth: number, parentId: string | null) => {
    const children = span.children ?? [];
    const totals = collect(span, at);
    const folded = children.length > 0 && foldedIds.includes(span.id);
    rows.push({
      span,
      depth,
      parentId,
      hasChildren: children.length > 0,
      folded,
      childCount: children.length,
      status: statusOf(span),
      duration: Math.max(0, totals.end - span.start),
      cost: totals.cost,
      tokens: totals.tokens,
    });
    if (!folded) children.forEach((child) => walk(child, depth + 1, span.id));
  };
  walk(root, 0, null);
  return rows;
}

/** The slowest finished call anywhere in the run, folded or not */
function slowestCall(root: TraceSpan, at: number): string | null {
  const calls: Array<{ id: string; duration: number }> = [];
  const walk = (span: TraceSpan) => {
    if ((span.kind === "llm" || span.kind === "tool") && statusOf(span) === "done") {
      calls.push({ id: span.id, duration: Math.max(0, (span.end ?? at) - span.start) });
    }
    (span.children ?? []).forEach(walk);
  };
  walk(root);
  if (calls.length < 2) return null;
  return calls.reduce((slow, call) => (call.duration > slow.duration ? call : slow)).id;
}

function scaleFor(total: number, minRange: number): { step: number; range: number } {
  const wanted = Math.max(total, minRange) / 5;
  const step = TICK_STEPS.find((size) => size >= wanted) ?? TICK_STEPS[TICK_STEPS.length - 1];
  return { step, range: step * 5 };
}

const MarkClaude = () => (
  <svg viewBox="0 0 1200 1200" aria-hidden="true">
    <path fill="#D97757" d="M 233.959793 800.214905 L 468.644287 668.536987 L 472.590637 657.100647 L 468.644287 650.738403 L 457.208069 650.738403 L 417.986633 648.322144 L 283.892639 644.69812 L 167.597321 639.865845 L 54.926208 633.825623 L 26.577238 627.785339 L 3.3e-05 592.751709 L 2.73832 575.27533 L 26.577238 559.248352 L 60.724873 562.228149 L 136.187973 567.382629 L 249.422867 575.194763 L 331.570496 580.026978 L 453.261841 592.671082 L 472.590637 592.671082 L 475.328857 584.859009 L 468.724915 580.026978 L 463.570557 575.194763 L 346.389313 495.785217 L 219.543671 411.865906 L 153.100723 363.543762 L 117.181267 339.060425 L 99.060455 316.107361 L 91.248367 266.01355 L 123.865784 230.093994 L 167.677887 233.073853 L 178.872513 236.053772 L 223.248367 270.201477 L 318.040283 343.570496 L 441.825592 434.738342 L 459.946411 449.798706 L 467.194672 444.64447 L 468.080597 441.020203 L 459.946411 427.409485 L 392.617493 305.718323 L 320.778564 181.932983 L 288.80542 130.630859 L 280.348999 99.865845 C 277.369171 87.221436 275.194641 76.590698 275.194641 63.624268 L 312.322174 13.20813 L 332.8591 6.604126 L 382.389313 13.20813 L 403.248352 31.328979 L 434.013519 101.71814 L 483.865753 212.537048 L 561.181274 363.221497 L 583.812134 407.919434 L 595.892639 449.315491 L 600.40271 461.959839 L 608.214783 461.959839 L 608.214783 454.711609 L 614.577271 369.825623 L 626.335632 265.61084 L 637.771851 131.516846 L 641.718201 93.745117 L 660.402832 48.483276 L 697.530334 24.000122 L 726.52356 37.852417 L 750.362549 72 L 747.060486 94.067139 L 732.886047 186.201416 L 705.100708 330.52356 L 686.979919 427.167847 L 697.530334 427.167847 L 709.61084 415.087341 L 758.496704 350.174561 L 840.644348 247.490051 L 876.885925 206.738342 L 919.167847 161.71814 L 946.308838 140.29541 L 997.61084 140.29541 L 1035.38269 196.429626 L 1018.469849 254.416199 L 965.637634 321.422852 L 921.825562 378.201538 L 859.006714 462.765259 L 819.785278 530.41626 L 823.409424 535.812073 L 832.75177 534.92627 L 974.657776 504.724915 L 1051.328979 490.872559 L 1142.818848 475.167786 L 1184.214844 494.496582 L 1188.724854 514.147644 L 1172.456421 554.335693 L 1074.604126 578.496765 L 959.838989 601.449829 L 788.939636 641.879272 L 786.845764 643.409485 L 789.261841 646.389343 L 866.255127 653.637634 L 899.194702 655.409424 L 979.812134 655.409424 L 1129.932861 666.604187 L 1169.154419 692.537109 L 1192.671265 724.268677 L 1188.724854 748.429688 L 1128.322144 779.194641 L 1046.818848 759.865845 L 856.590759 714.604126 L 791.355774 698.335754 L 782.335693 698.335754 L 782.335693 703.731567 L 836.69812 756.885986 L 936.322205 846.845581 L 1061.073975 962.81897 L 1067.436279 991.490112 L 1051.409424 1014.120911 L 1034.496704 1011.704712 L 924.885986 929.234924 L 882.604126 892.107544 L 786.845764 811.48999 L 780.483276 811.48999 L 780.483276 819.946289 L 802.550415 852.241699 L 919.087341 1027.409424 L 925.127625 1081.127686 L 916.671204 1098.604126 L 886.469849 1109.154419 L 853.288696 1103.114136 L 785.073914 1007.355835 L 714.684631 899.516785 L 657.906067 802.872498 L 650.979858 806.81897 L 617.476624 1167.704834 L 601.771851 1186.147705 L 565.530212 1200 L 535.328857 1177.046997 L 519.302124 1139.919556 L 535.328857 1066.550537 L 554.657776 970.792053 L 570.362488 894.68457 L 584.536926 800.134277 L 592.993347 768.724976 L 592.429626 766.630859 L 585.503479 767.516968 L 514.22821 865.369263 L 405.825531 1011.865906 L 320.053711 1103.677979 L 299.516815 1111.812256 L 263.919525 1093.369263 L 267.221497 1060.429688 L 287.114136 1031.114136 L 405.825531 880.107361 L 477.422913 786.52356 L 523.651062 732.483276 L 523.328918 724.671265 L 520.590698 724.671265 L 205.288605 929.395935 L 149.154434 936.644409 L 124.993355 914.01355 L 127.973183 876.885986 L 139.409409 864.80542 L 234.201385 799.570435 L 233.879227 799.8927 Z" />
  </svg>
);

const ChevronIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

const SpinIcon = () => (
  <svg className="ui-twc__spin" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
    <path d="M12 3.5A8.5 8.5 0 0 1 20.5 12" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" />
  </svg>
);

const AlertIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 4.5 21 20H3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M12 10v4.2M12 17.2v.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </svg>
);

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="m7.5 7.5 9 9M16.5 7.5l-9 9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </svg>
);

const SparkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <path d="M7 1.2c.4 2.9 1.9 4.4 4.8 4.8-2.9.4-4.4 1.9-4.8 4.8C6.6 7.9 5.1 6.4 2.2 6 5.1 5.6 6.6 4.1 7 1.2Z" fill="currentColor" />
    <circle cx="11.6" cy="11.4" r="1.1" fill="currentColor" opacity="0.55" />
  </svg>
);

/* The tile: the span's own glyph, the model's mark, or – for a call nobody gave a face to – the
   flat swatch the sheet colours by kind. */
function RunIcon({ span }: { span: TraceSpan }) {
  if (span.icon) return <>{span.icon}</>;
  if (span.kind === "agent" || span.kind === "llm") return <MarkClaude />;
  return <span className="ui-twc__swatch" aria-hidden="true" />;
}

type TrackProps = {
  kind: TraceSpanKind;
  status: TraceSpanStatus;
  start: number;
  duration: number;
  range: number;
  amount: string;
  live: boolean;
  slow: boolean;
  delay: number;
  marks: Array<{ span: TraceSpan; duration: number }>;
};

/** One row's slice of the timeline: the bar, the marks of its folded calls, and the value tag. */
function Track({ kind, status, start, duration, range, amount, live, slow, delay, marks }: TrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLSpanElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [tagWidth, setTagWidth] = useState(0);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const tag = tagRef.current;
    if (!track || !tag) return;
    const measure = () => {
      setTrackWidth(track.clientWidth);
      setTagWidth(tag.offsetWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    observer.observe(tag);
    return () => observer.disconnect();
  }, []);

  /* The value sits after the bar until it would run off the track; then it moves inside a wide
     bar, and beside a narrow one. The sheet does the placing – this only picks the side. */
  const barWidth = trackWidth > 0 ? Math.max(3, (duration / range) * trackWidth) : 0;
  const afterEnd = trackWidth > 0 ? ((start + duration) / range) * trackWidth + 2 + tagWidth : 0;
  const side: "after" | "inside" | "before" =
    !trackWidth || !tagWidth || afterEnd <= trackWidth ? "after" : barWidth >= tagWidth + 12 ? "inside" : "before";

  return (
    <div className="ui-twc__track" ref={trackRef}>
      <span
        className="ui-twc__bar"
        data-bar=""
        data-kind={kind}
        data-status={status}
        style={{ "--s": start, "--d": duration, animationDelay: `${delay}ms` } as CSSProperties}
      />
      {marks.map((mark) => (
        <span
          key={mark.span.id}
          className="ui-twc__mark"
          data-kind={mark.span.kind}
          data-status={statusOf(mark.span)}
          aria-hidden="true"
          style={{ "--s": mark.span.start, "--d": mark.duration } as CSSProperties}
        />
      ))}
      <span className="ui-twc__tag" data-side={side} ref={tagRef} style={{ "--s": start, "--d": duration } as CSSProperties}>
        <span className="ui-twc__amount" data-live={live ? "" : undefined}>
          {amount}
        </span>
        {slow ? <span className="ui-twc__slow">Slowest</span> : null}
      </span>
    </div>
  );
}

export function TraceWaterfall({
  root,
  now,
  startedAt,
  collapsed,
  defaultCollapsed = [],
  onCollapsedChange,
  openId,
  defaultOpenId = null,
  onOpenChange,
  markSlowest = true,
  minRange = 10_000,
  title = "Trace",
  task = "",
  formatCost = dollars,
  className,
}: TraceWaterfallProps) {
  const [folded, setFolded] = useState<string[]>(() => [...defaultCollapsed]);
  const [opened, setOpened] = useState<string | null>(defaultOpenId);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [clock, setClock] = useState<number | null>(null);
  const [panel, setPanel] = useState<{ span: TraceSpan; closing: boolean } | null>(null);
  const [placement, setPlacement] = useState({ top: 0, left: 0, above: false });
  const [ghosts, setGhosts] = useState<Ghost[]>([]);

  const bodyRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const rowEls = useRef(new Map<string, HTMLDivElement>());
  const previousRows = useRef<Row[]>([]);
  const timers = useRef<number[]>([]);
  const ghostKey = useRef(0);

  const foldedIds = collapsed ?? folded;
  const open = openId !== undefined ? openId : opened;

  const setCollapsedIds = (next: string[]) => {
    if (collapsed === undefined) setFolded(next);
    onCollapsedChange?.(next);
  };

  const setOpen = (id: string | null, span?: TraceSpan) => {
    if (openId === undefined) setOpened(id);
    onOpenChange?.(id, span);
  };

  const running = useMemo(() => hasStatus(root, "running"), [root]);
  const failed = useMemo(() => hasStatus(root, "failed"), [root]);
  const status: TraceSpanStatus = running ? "running" : failed ? "failed" : "done";

  useEffect(() => {
    if (now !== undefined || startedAt === undefined || !running) return;
    let frame = 0;
    let last = 0;
    const tick = (stamp: number) => {
      /* Sixty-odd updates a second buys nothing a trace can show, and every one of them re-renders
         the whole tree. */
      if (stamp - last > 60) {
        last = stamp;
        setClock(Math.max(0, Date.now() - startedAt));
      }
      frame = requestAnimationFrame(tick);
    };
    setClock(Math.max(0, Date.now() - startedAt));
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [now, startedAt, running]);

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current = [];
    },
    [],
  );

  /* Without a clock a running span has to stop at its own start, so the run's end is the widest
     explicit end it has. Everything after this reads the same resolved `at`. */
  const stillEnd = useMemo(() => collect(root, 0).end, [root]);
  const at = now ?? (running && clock !== null ? clock : stillEnd);
  const total = useMemo(() => collect(root, at), [root, at]);
  const rows = useMemo(() => buildRows(root, foldedIds, at), [root, foldedIds, at]);
  const { step, range } = useMemo(() => scaleFor(Math.max(at, total.end), minRange), [at, total.end, minRange]);
  const slowestId = useMemo(() => (markSlowest ? slowestCall(root, at) : null), [markSlowest, root, at]);

  const counts = useMemo(() => {
    let llm = 0;
    let tool = 0;
    let errors = 0;
    const walk = (span: TraceSpan) => {
      if (span.kind === "llm") llm += 1;
      if (span.kind === "tool") tool += 1;
      if (statusOf(span) === "failed") errors += 1;
      (span.children ?? []).forEach(walk);
    };
    walk(root);
    return { llm, tool, errors };
  }, [root]);

  const ticks = useMemo(() => Array.from({ length: 5 }, (_, index) => index * step), [step]);

  /* Rows that leave the tree – a branch folded, a span collapsed away – shrink out instead of
     vanishing, so the list keeps its shape while the eye follows it. */
  useEffect(() => {
    const before = previousRows.current;
    previousRows.current = rows;
    const gone = before
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => !rows.some((next) => next.span.id === row.span.id));
    if (!gone.length) return;
    const stamp = ++ghostKey.current;
    setGhosts((list) => [
      ...list,
      ...gone.map(({ row, index }) => ({ key: `${row.span.id}:${stamp}`, row, index, hidden: false })),
    ]);
    timers.current.push(
      window.setTimeout(() => {
        setGhosts((list) => list.map((ghost) => (ghost.key.endsWith(`:${stamp}`) ? { ...ghost, hidden: true } : ghost)));
      }, 280),
    );
    timers.current.push(
      window.setTimeout(() => {
        setGhosts((list) => list.filter((ghost) => !ghost.key.endsWith(`:${stamp}`)));
      }, 460),
    );
  }, [rows]);

  const openSpan = open ? rows.find((row) => row.span.id === open)?.span : undefined;

  useLayoutEffect(() => {
    if (openSpan) {
      setPanel((current) => (current && current.span === openSpan && !current.closing ? current : { span: openSpan, closing: false }));
      return;
    }
    setPanel((current) => (current && !current.closing ? { ...current, closing: true } : current));
  }, [openSpan]);

  useEffect(() => {
    if (!panel?.closing) return;
    const timer = window.setTimeout(() => {
      setPanel((current) => (current && current.closing ? null : current));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [panel?.closing]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (popRef.current?.contains(target)) return;
      if (rowEls.current.get(open)?.contains(target)) return;
      setOpen(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  /* The panel hangs under its row, inside the body – flipping above it when there is no room
     under the row, and staying inside the card's edges. */
  useLayoutEffect(() => {
    if (!panel) return;
    const host = bodyRef.current;
    const row = rowEls.current.get(panel.span.id);
    const pop = popRef.current;
    if (!host || !row || !pop) return;
    const hostBox = host.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    const width = pop.offsetWidth;
    const height = pop.offsetHeight;
    const left = Math.max(8, Math.min(rowBox.left - hostBox.left + 24, Math.max(8, hostBox.width - width - 8)));
    let top = rowBox.bottom - hostBox.top + 2;
    let above = false;
    if (top + height > hostBox.height - 4) {
      const lifted = rowBox.top - hostBox.top - height - 2;
      if (lifted >= 0) {
        top = lifted;
        above = true;
      } else {
        top = Math.max(0, hostBox.height - height - 4);
      }
    }
    setPlacement((current) =>
      current.top === top && current.left === left && current.above === above ? current : { top, left, above },
    );
  }, [panel, rows.length, range]);

  const toggleFold = (row: Row) => {
    if (!row.hasChildren) return;
    const next = row.folded ? foldedIds.filter((id) => id !== row.span.id) : [...foldedIds, row.span.id];
    setCollapsedIds(next);
  };

  const toggleOpen = (row: Row) => {
    if (open === row.span.id) setOpen(null);
    else setOpen(row.span.id, row.span);
  };

  const focusRow = (index: number) => {
    const row = rows[Math.max(0, Math.min(rows.length - 1, index))];
    if (!row) return;
    setFocusId(row.span.id);
    rowEls.current.get(row.span.id)?.focus();
  };

  const onRowKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>, index: number, row: Row) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusRow(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusRow(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusRow(0);
        break;
      case "End":
        event.preventDefault();
        focusRow(rows.length - 1);
        break;
      case "ArrowRight":
        event.preventDefault();
        if (row.hasChildren && row.folded) toggleFold(row);
        else focusRow(index + 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        if (row.hasChildren && !row.folded) toggleFold(row);
        else if (row.parentId) focusRow(rows.findIndex((entry) => entry.span.id === row.parentId));
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        toggleOpen(row);
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(null);
        }
        break;
      default:
        break;
    }
  };

  const onRowClick = (event: ReactMouseEvent<HTMLDivElement>, row: Row) => {
    const target = event.target;
    if (row.hasChildren && target instanceof Element && target.closest(".ui-twc__chev")) {
      toggleFold(row);
      return;
    }
    toggleOpen(row);
  };

  const tabbableId = focusId && rows.some((row) => row.span.id === focusId) ? focusId : rows[0]?.span.id;

  /* Live rows in tree order, with the rows that are shrinking away slotted back into the places
     they held a moment ago. */
  const sequence: Array<{ row: Row; ghost?: Ghost }> = rows.map((row) => ({ row }));
  for (const ghost of ghosts) sequence.splice(Math.min(ghost.index, sequence.length), 0, { row: ghost.row, ghost });

  const renderRow = (row: Row, ghost?: { key: string; hidden: boolean }) => {
    const leaving = ghost ? (ghost.hidden ? "hidden" : "leaving") : undefined;
    const span = row.span;
    const cost = row.cost > 0 ? formatCost(row.cost) : "";
    const amount = `${formatDuration(row.duration)}${cost ? ` · ${cost}` : ""}`;
    const entering = row.depth === 0 ? 60 : 0;
    const isOpen = !ghost && open === span.id;
    const childMarkers = (span.children ?? []).map((child) => ({
      span: child,
      duration: Math.max(0, (child.end ?? Math.max(child.start, at)) - child.start),
    }));

    return (
      <div
        key={ghost ? ghost.key : span.id}
        ref={
          ghost
            ? undefined
            : (node) => {
                if (node) rowEls.current.set(span.id, node);
                else rowEls.current.delete(span.id);
              }
        }
        className="ui-twc__row"
        role={ghost ? undefined : "treeitem"}
        aria-hidden={ghost ? "true" : undefined}
        aria-level={ghost ? undefined : row.depth + 1}
        aria-selected={ghost ? undefined : isOpen}
        aria-label={ghost ? undefined : `${span.name}, ${KIND_LABEL[span.kind]}, ${STATUS_ARIA[row.status]}, ${amount}`}
        aria-expanded={ghost || !row.hasChildren ? undefined : !row.folded}
        tabIndex={ghost ? -1 : span.id === tabbableId ? 0 : -1}
        data-kind={span.kind}
        data-status={row.status}
        data-parent={row.hasChildren ? "" : undefined}
        data-folded={row.folded ? "" : undefined}
        data-open={isOpen ? "" : undefined}
        data-leaving={leaving ? "" : undefined}
        data-hidden={leaving === "hidden" ? "" : undefined}
        style={{ animationDelay: `${entering}ms` }}
        onClick={ghost ? undefined : (event) => onRowClick(event, row)}
        onKeyDown={ghost ? undefined : (event) => onRowKeyDown(event, rows.indexOf(row), row)}
        onFocus={ghost ? undefined : () => setFocusId(span.id)}
      >
        <div className="ui-twc__name">
          {row.depth > 0 ? (
            <span
              className="ui-twc__guides"
              aria-hidden="true"
              style={{ width: `calc(${row.depth} * var(--ui-twc-indent))` }}
            />
          ) : null}
          <span className="ui-twc__chev" data-leaf={row.hasChildren ? undefined : ""} aria-hidden="true">
            {row.hasChildren ? <ChevronIcon /> : null}
          </span>
          <span className="ui-twc__icon" data-logo="">
            <RunIcon span={span} />
          </span>
          <span className="ui-twc__label">
            <span className="ui-twc__title">{span.name}</span>
            {span.detail ? <span className="ui-twc__detail">{span.detail}</span> : null}
          </span>
          {row.folded && row.childCount > 0 ? <span className="ui-twc__more">+{row.childCount}</span> : null}
          {!row.hasChildren && row.status !== "done" ? (
            <span className="ui-twc__state" data-status={row.status}>
              {row.status === "failed" ? <AlertIcon /> : <SpinIcon />}
            </span>
          ) : null}
          <span className="ui-twc__meta">
            <span className="ui-twc__amount" data-live={row.status === "running" ? "" : undefined}>
              {formatDuration(row.duration)}
              {cost ? <span className="ui-twc__meta-cost"> · {cost}</span> : null}
            </span>
            {slowestId === span.id ? <span className="ui-twc__slow">Slowest</span> : null}
          </span>
        </div>
        <Track
          kind={span.kind}
          status={row.status}
          start={span.start}
          duration={row.duration}
          range={range}
          amount={amount}
          live={row.status === "running"}
          slow={slowestId === span.id}
          delay={entering + 60}
          marks={childMarkers}
        />
      </div>
    );
  };

  const panelTotals = panel ? collect(panel.span, at) : null;
  const panelStatus = panel ? statusOf(panel.span) : "done";
  const panelDuration = panel && panelTotals ? Math.max(0, panelTotals.end - panel.span.start) : 0;

  return (
    <div
      className={["ui-twc", className].filter(Boolean).join(" ")}
      data-live={running ? "" : undefined}
      style={{ "--ui-twc-at": at, "--ui-twc-range": range } as CSSProperties}
    >
      <style href="ui-trace-waterfall" precedence="default">
        {css}
      </style>

      <header className="ui-twc__bar-head">
        <span className="ui-twc__spark">
          <SparkIcon />
        </span>
        <span className="ui-twc__heading">{title}</span>
        <span className="ui-twc__task">{task}</span>
        <span className="ui-twc__pill" data-status={status} aria-live="polite">
          {status === "running" ? <span className="ui-twc__pulse" aria-hidden="true" /> : null}
          {STATUS_LABEL[status]}
        </span>
      </header>

      <div className="ui-twc__card">
        <dl className="ui-twc__stats">
          <div className="ui-twc__stat">
            <dt>Duration</dt>
            <dd>
              <span className="ui-twc__amount" data-live={running ? "" : undefined}>
                {formatDuration(Math.max(0, total.end - total.start))}
              </span>
            </dd>
          </div>
          <div className="ui-twc__stat">
            <dt>Cost</dt>
            <dd>
              <span className="ui-twc__amount" data-live={running ? "" : undefined}>
                {formatCost(total.cost)}
              </span>
            </dd>
          </div>
          <div className="ui-twc__stat">
            <dt>Tokens</dt>
            <dd>
              <span className="ui-twc__amount" data-live={running ? "" : undefined}>
                {formatTokens(total.tokens)}
              </span>
            </dd>
          </div>
          <div className="ui-twc__stat">
            <dt>LLM calls</dt>
            <dd>
              <span className="ui-twc__amount">{counts.llm}</span>
            </dd>
          </div>
          <div className="ui-twc__stat">
            <dt>Tool calls</dt>
            <dd>
              <span className="ui-twc__amount">{counts.tool}</span>
            </dd>
          </div>
          <div className="ui-twc__stat" data-kind={counts.errors > 0 ? "failed" : undefined}>
            <dt>Errors</dt>
            <dd>
              <span className="ui-twc__amount">{counts.errors}</span>
            </dd>
          </div>
        </dl>

        <div className="ui-twc__body" ref={bodyRef}>
          <div className="ui-twc__layer" aria-hidden="true">
            {ticks.map((tick) => (
              <span
                key={tick}
                className="ui-twc__tick"
                data-zero={tick === 0 ? "" : undefined}
                style={{ "--v": tick } as CSSProperties}
              >
                <span>{tick >= 60_000 ? `${Math.round(tick / 60_000)}m` : `${Math.round(tick / 1000)}s`}</span>
              </span>
            ))}
            {running ? <span className="ui-twc__now" /> : null}
          </div>

          <div className="ui-twc__axis" aria-hidden="true">
            <span>Span</span>
          </div>

          <div className="ui-twc__rows" role="tree" aria-label={title}>
            {sequence.map((entry) => renderRow(entry.row, entry.ghost))}
          </div>

          {panel ? (
            <div
              className="ui-twc__pop"
              ref={popRef}
              role="dialog"
              aria-label={`${panel.span.name} details`}
              data-side={placement.above ? "above" : undefined}
              data-closing={panel.closing ? "" : undefined}
              style={{ top: placement.top, left: placement.left }}
            >
              <div className="ui-twc__pop-head">
                <span className="ui-twc__icon" data-logo="">
                  <RunIcon span={panel.span} />
                </span>
                <span className="ui-twc__pop-who">
                  <span className="ui-twc__pop-name">{panel.span.name}</span>
                  <span className="ui-twc__pop-kind">
                    {KIND_LABEL[panel.span.kind]}
                    {panel.span.detail ? ` · ${panel.span.detail}` : ""}
                  </span>
                </span>
                <span className="ui-twc__pill" data-status={panelStatus}>
                  {panelStatus === "running" ? <span className="ui-twc__pulse" aria-hidden="true" /> : null}
                  {STATUS_LABEL[panelStatus]}
                </span>
                <button
                  type="button"
                  className="ui-twc__close"
                  aria-label="Close details"
                  onClick={() => setOpen(null)}
                >
                  <CloseIcon />
                </button>
              </div>

              <dl className="ui-twc__pop-stats">
                <div>
                  <dt>Duration</dt>
                  <dd>{formatDuration(panelDuration)}</dd>
                </div>
                <div>
                  <dt>Cost</dt>
                  <dd>{formatCost(panelTotals?.cost ?? 0)}</dd>
                </div>
                <div>
                  <dt>Tokens</dt>
                  <dd>{(panelTotals?.tokens ?? 0).toLocaleString("en-US")}</dd>
                </div>
              </dl>

              {panel.span.error ? (
                <div className="ui-twc__pop-error">
                  <AlertIcon />
                  <span>{panel.span.error}</span>
                </div>
              ) : null}

              {panel.span.input ? (
                <div className="ui-twc__pop-io">
                  <span>Input</span>
                  <p>{panel.span.input}</p>
                </div>
              ) : null}

              {panel.span.output ? (
                <div className="ui-twc__pop-io">
                  <span>Output</span>
                  <p>{panel.span.output}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const css = /* css */ `
.ui-twc{--ui-twc-card: #fffdfb;--ui-twc-strong: #0b0908;--ui-twc-ink: rgba(11, 9, 8, 0.88);--ui-twc-text: rgba(11, 9, 8, 0.61);--ui-twc-muted: rgba(11, 9, 8, 0.45);--ui-twc-faint: rgba(11, 9, 8, 0.27);--ui-twc-line: rgba(11, 9, 8, 0.06);--ui-twc-grid: rgba(11, 9, 8, 0.045);--ui-twc-guide: rgba(11, 9, 8, 0.08);--ui-twc-hover: rgba(11, 9, 8, 0.02);--ui-twc-selected: rgba(217, 84, 31, 0.05);--ui-twc-fill: rgba(11, 9, 8, 0.06);--ui-twc-wash: rgba(11, 9, 8, 0.025);--ui-twc-accent: rgba(217, 84, 31, 0.765);--ui-twc-now: rgba(217, 84, 31, 0.45);--ui-twc-agent-bg: rgba(11, 9, 8, 0.045);--ui-twc-agent-edge: rgba(11, 9, 8, 0.1);--ui-twc-agent-ink: rgba(11, 9, 8, 0.61);--ui-twc-agent-mark: rgba(11, 9, 8, 0.3);--ui-twc-llm-bg: rgba(255, 107, 53, 0.1);--ui-twc-llm-edge: rgba(255, 107, 53, 0.3);--ui-twc-llm-ink: #ff6b35;--ui-twc-llm-mark: rgba(255, 107, 53, 0.72);--ui-twc-tool-bg: rgba(217, 84, 31, 0.085);--ui-twc-tool-edge: rgba(217, 84, 31, 0.28);--ui-twc-tool-ink: #a33f16;--ui-twc-tool-mark: rgba(217, 84, 31, 0.62);--ui-twc-error-bg: #b3261e18;--ui-twc-error-edge: rgba(179, 38, 30, 0.34);--ui-twc-error-ink: #b3261eda;--ui-twc-error-mark: rgba(179, 38, 30, 0.62);--ui-twc-brand-bg: #ff6b3519;--ui-twc-brand-fg: #d9541ff2;--ui-twc-ok-bg: #1a7a4a19;--ui-twc-ok-fg: #1a7a4ae0;--ui-twc-slow-bg: #d9953029;--ui-twc-slow-fg: #d9541f;--ui-twc-focus: rgba(217, 84, 31, 0.35);--ui-twc-shine: rgba(11, 9, 8, 0.22);--ui-twc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-twc-pop: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 12px 28px -10px rgba(11, 9, 8, 0.18), 0 1px 2px rgba(11, 9, 8, 0.05);--ui-twc-row: 30px;--ui-twc-bar: 14px;--ui-twc-axis: 30px;--ui-twc-name: 232px;--ui-twc-pad: 10px;--ui-twc-gap: 14px;--ui-twc-end: 16px;--ui-twc-indent: 14px;--ui-twc-ease: cubic-bezier(0.32, 0.72, 0.24, 1);--ui-twc-range: 10000;position: relative;box-sizing: border-box;width: 100%;border-radius: 12px;background: var(--ui-twc-card);box-shadow: var(--ui-twc-shadow);container: ui-twc / inline-size;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;font-weight: 400;line-height: 20px;color: var(--ui-twc-text);text-align: left;-webkit-font-smoothing: antialiased}
.ui-twc *, .ui-twc *::before, .ui-twc *::after{box-sizing: border-box}
:where(.ui-twc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;text-align: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-twc button:focus-visible{outline: 2px solid var(--ui-twc-focus);outline-offset: 1px}
.ui-twc :is(p, dl, dd){margin: 0}
.ui-twc svg{display: block;flex: none}
.ui-twc__bar-head{display: flex;align-items: center;gap: 8px;min-width: 0;padding: 12px 14px 12px 16px;border-bottom: 0.5px solid var(--ui-twc-line)}
.ui-twc__spark{display: grid;flex: none;place-items: center;width: 16px;color: var(--ui-twc-accent)}
.ui-twc__heading{flex: none;font-weight: 500;color: var(--ui-twc-strong)}
.ui-twc__task{flex: 1;min-width: 0;overflow: hidden;color: var(--ui-twc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-twc__pill{display: inline-flex;flex: none;align-items: center;gap: 5px;height: 20px;padding: 0 7px;border-radius: 5px;background: var(--ui-twc-fill);font-size: 12px;font-weight: 500;line-height: 16px;color: var(--ui-twc-text);white-space: nowrap}
.ui-twc__pill[data-status="running"]{background: var(--ui-twc-brand-bg);color: var(--ui-twc-brand-fg)}
.ui-twc__pill[data-status="done"]{background: var(--ui-twc-ok-bg);color: var(--ui-twc-ok-fg)}
.ui-twc__pill[data-status="failed"]{background: var(--ui-twc-error-bg);color: var(--ui-twc-error-ink)}
.ui-twc__pulse{width: 6px;height: 6px;border-radius: 50%;background: currentColor;animation: ui-twc-pulse var(--nm-dur-6, 1100ms) ease-in-out infinite}
.ui-twc__stats{display: grid;grid-template-columns: repeat(6, minmax(0, 1fr));padding: 12px 0;border-bottom: 0.5px solid var(--ui-twc-line)}
.ui-twc__stat{display: grid;gap: 2px;min-width: 0;padding: 0 16px}
.ui-twc__stat:first-child{padding-left: 22px}
.ui-twc__stat:last-child{padding-right: 10px}
.ui-twc__stat + .ui-twc__stat{border-left: 0.5px solid var(--ui-twc-line)}
.ui-twc__stat dt{overflow: hidden;font-size: 10px;font-weight: 500;line-height: 16px;letter-spacing: 0.5px;text-transform: uppercase;color: var(--ui-twc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-twc__stat dd{overflow: hidden;font-size: 15px;font-weight: 500;line-height: 24px;color: var(--ui-twc-ink);white-space: nowrap;font-variant-numeric: tabular-nums}
.ui-twc__stat[data-kind="failed"] dd{color: var(--ui-twc-error-ink)}
.ui-twc__body{position: relative;padding-bottom: 18px}
.ui-twc__layer{position: absolute;top: 0;bottom: 0;left: calc(var(--ui-twc-pad) + var(--ui-twc-name) + var(--ui-twc-gap));right: var(--ui-twc-end);overflow: hidden;pointer-events: none}
.ui-twc__tick{position: absolute;top: 0;bottom: 0;left: calc(var(--v) * 100% / var(--ui-twc-range));width: 0.5px;background: var(--ui-twc-grid);animation: ui-twc-fade var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both;transition: opacity var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-twc__tick[data-zero]{width: 0.5px;background: rgba(11, 9, 8, 0.1)}
.ui-twc__tick[data-leaving]{opacity: 0}
.ui-twc__tick > span{position: absolute;top: 7px;left: 6px;font-size: 12px;line-height: 16px;color: var(--ui-twc-muted);white-space: nowrap;font-variant-numeric: tabular-nums}
.ui-twc__now{position: absolute;top: 0;bottom: 0;left: calc(var(--ui-twc-at) * 100% / var(--ui-twc-range));width: 1px;background: var(--ui-twc-now)}
.ui-twc__now::before{content: "";position: absolute;top: calc(var(--ui-twc-axis) - 2.5px);left: -2px;width: 5px;height: 5px;border-radius: 50%;background: var(--ui-twc-accent);box-shadow: 0 0 0 3px var(--ui-twc-card)}
.ui-twc__axis{display: flex;align-items: center;height: var(--ui-twc-axis);padding-left: calc(var(--ui-twc-pad) + 6px);border-bottom: 0.5px solid var(--ui-twc-line);font-size: 10px;font-weight: 500;line-height: 16px;letter-spacing: 0.5px;text-transform: uppercase;color: var(--ui-twc-muted)}
.ui-twc__rows{position: relative;padding-top: 4px}
.ui-twc__row{display: grid;grid-template-columns: var(--ui-twc-name) minmax(0, 1fr);column-gap: var(--ui-twc-gap);height: var(--ui-twc-row);padding: 0 var(--ui-twc-end) 0 var(--ui-twc-pad);overflow: hidden;outline: none;cursor: pointer;transition: height var(--nm-dur-4, 380ms) var(--ui-twc-ease), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));animation: ui-twc-row var(--nm-dur-4, 380ms) var(--ui-twc-ease) backwards}
.ui-twc__row:hover{background: var(--ui-twc-hover)}
.ui-twc__row[data-open]{background: var(--ui-twc-selected)}
.ui-twc__row:focus-visible{box-shadow: inset 0 0 0 2px var(--ui-twc-focus)}
.ui-twc__row:is([data-hidden], [data-leaving]){height: 0;opacity: 0;pointer-events: none}
.ui-twc__row[data-leaving]{animation: ui-twc-leave var(--nm-dur-3, 240ms) var(--ui-twc-ease) both}
.ui-twc__row[data-leaving][data-hidden]{animation: none}
.ui-twc__row[data-leaving] :is(.ui-twc__bar, .ui-twc__tag, .ui-twc__more, .ui-twc__slow){animation: none}
.ui-twc__name{display: flex;align-items: center;min-width: 0;height: var(--ui-twc-row)}
.ui-twc__guides{flex: none;align-self: stretch;background: repeating-linear-gradient(90deg, transparent 0 7.75px, var(--ui-twc-guide) 7.75px 8.25px, transparent 8.25px var(--ui-twc-indent))}
.ui-twc__chev{display: grid;flex: none;place-items: center;width: 16px;height: 20px;margin-right: 4px;border-radius: 4px;color: var(--ui-twc-muted);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-twc__chev:not([data-leaf]):hover{background: var(--ui-twc-fill);color: var(--ui-twc-ink)}
.ui-twc__chev > svg{transition: transform 240ms var(--ui-twc-ease)}
.ui-twc__row[data-folded] .ui-twc__chev > svg{transform: rotate(-90deg)}
.ui-twc__icon{display: grid;flex: none;place-items: center;width: 20px;height: 20px;margin-right: 8px;border-radius: 5px;background: var(--ui-twc-card);box-shadow: var(--ui-twc-shadow)}
.ui-twc__icon > svg{width: 12px;height: 12px}
.ui-twc__swatch{width: 8px;height: 8px;border-radius: 2px;background: var(--k-mark)}
.ui-twc__label{display: flex;align-items: baseline;gap: 6px;flex: 1;min-width: 0;overflow: hidden;white-space: nowrap}
.ui-twc__title{flex: none;max-width: 100%;overflow: hidden;color: var(--ui-twc-ink);text-overflow: ellipsis}
.ui-twc__row[data-parent] .ui-twc__title{font-weight: 500;color: var(--ui-twc-strong)}
.ui-twc__detail{min-width: 0;overflow: hidden;font-size: 12px;color: var(--ui-twc-muted);text-overflow: ellipsis}
.ui-twc__more{flex: none;height: 18px;margin-left: 6px;padding: 0 5px;border-radius: 4px;background: var(--ui-twc-fill);font-size: 11px;font-weight: 500;line-height: 18px;color: var(--ui-twc-text);font-variant-numeric: tabular-nums;animation: ui-twc-pop var(--nm-dur-3, 240ms) var(--ui-twc-ease) both}
.ui-twc__state{display: grid;flex: none;place-items: center;width: 16px;margin-left: 4px}
.ui-twc__state[data-status="running"]{color: var(--ui-twc-brand-fg)}
.ui-twc__state[data-status="failed"]{color: var(--ui-twc-error-ink)}
.ui-twc__spin{animation: ui-twc-spin var(--nm-dur-6, 1100ms) linear infinite}
.ui-twc__meta{display: none}
.ui-twc [data-kind]{--k-bg: var(--ui-twc-agent-bg);--k-edge: var(--ui-twc-agent-edge);--k-ink: var(--ui-twc-agent-ink);--k-mark: var(--ui-twc-agent-mark)}
.ui-twc [data-kind="llm"]{--k-bg: var(--ui-twc-llm-bg);--k-edge: var(--ui-twc-llm-edge);--k-ink: var(--ui-twc-llm-ink);--k-mark: var(--ui-twc-llm-mark)}
.ui-twc [data-kind="tool"]{--k-bg: var(--ui-twc-tool-bg);--k-edge: var(--ui-twc-tool-edge);--k-ink: var(--ui-twc-tool-ink);--k-mark: var(--ui-twc-tool-mark)}
.ui-twc [data-kind][data-status="failed"]{--k-bg: var(--ui-twc-error-bg);--k-edge: var(--ui-twc-error-edge);--k-ink: var(--ui-twc-error-ink);--k-mark: var(--ui-twc-error-mark)}
.ui-twc__track{position: relative;min-width: 0;height: var(--ui-twc-row);overflow: hidden}
.ui-twc__bar{position: absolute;top: calc(50% - var(--ui-twc-bar) / 2);left: calc(var(--s) * 100% / var(--ui-twc-range));width: max(3px, calc(var(--d) * 100% / var(--ui-twc-range)));height: var(--ui-twc-bar);overflow: hidden;border-radius: 4px;background: var(--k-bg);box-shadow: inset 0 0 0 0.5px var(--k-edge);transition: box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));animation: ui-twc-grow var(--nm-dur-5, 620ms) var(--ui-twc-ease) backwards}
.ui-twc__row:is(:hover, [data-open]) .ui-twc__bar{box-shadow: inset 0 0 0 1px var(--k-mark)}
.ui-twc__row[data-folded] .ui-twc__bar{opacity: 0.75}
.ui-twc__mark{position: absolute;top: calc(50% - 2.5px);left: calc(var(--s) * 100% / var(--ui-twc-range));width: max(2px, calc(var(--d) * 100% / var(--ui-twc-range)));height: 5px;border-radius: 1.5px;background: var(--k-mark);opacity: 0;transform: scaleY(0.2);transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-2, 160ms) var(--ui-twc-ease);pointer-events: none}
.ui-twc__row[data-folded] .ui-twc__mark{opacity: 0.9;transform: none;transition-delay: 140ms}
.ui-twc__bar[data-status="running"]::before{content: "";position: absolute;inset: 0;background: linear-gradient(90deg, transparent, var(--ui-twc-card), transparent) -60px 0 / 60px 100% no-repeat;opacity: 0.7;animation: ui-twc-sweep var(--nm-dur-6, 1100ms) linear infinite}
.ui-twc__bar[data-status="running"]::after{content: "";position: absolute;top: 0;right: 0;bottom: 0;width: min(28px, 100%);background: linear-gradient(90deg, transparent, var(--k-edge));animation: ui-twc-glow 1100ms ease-in-out infinite alternate}
.ui-twc__tag{position: absolute;top: calc(50% - 9px);display: flex;align-items: center;gap: 6px;height: 18px;padding: 0 4px;border-radius: 4px;background: var(--ui-twc-card);font-size: 12px;line-height: 16px;color: var(--ui-twc-text);white-space: nowrap;font-variant-numeric: tabular-nums;pointer-events: none}
.ui-twc__tag[data-side="after"]{left: calc((var(--s) + var(--d)) * 100% / var(--ui-twc-range) + 2px)}
.ui-twc__tag[data-side="inside"]{right: calc(100% - (var(--s) + var(--d)) * 100% / var(--ui-twc-range) + 2px);flex-direction: row-reverse;background: none;color: var(--k-ink)}
.ui-twc__tag[data-side="before"]{right: calc(100% - var(--s) * 100% / var(--ui-twc-range) + 2px);flex-direction: row-reverse}
.ui-twc__row[data-open] .ui-twc__tag{background: none}
.ui-twc__row[data-status="failed"] .ui-twc__tag{color: var(--ui-twc-error-ink)}
.ui-twc__slow{flex: none;height: 16px;padding: 0 5px;border-radius: 4px;background: var(--ui-twc-slow-bg);font-size: 10px;font-weight: 500;line-height: 16px;letter-spacing: 0.3px;text-transform: uppercase;color: var(--ui-twc-slow-fg);animation: ui-twc-pop var(--nm-dur-3, 240ms) var(--ui-twc-ease) both}
.ui-twc__amount[data-live]{background: linear-gradient(90deg, currentColor 0%, currentColor 38%, var(--ui-twc-shine) 50%, currentColor 62%, currentColor 100%) 0 0 / 300% 100%;-webkit-background-clip: text;background-clip: text;-webkit-text-fill-color: transparent;animation: ui-twc-shine 1100ms linear infinite}
.ui-twc__pop{position: absolute;top: 0;left: 0;z-index: 5;display: grid;gap: 10px;width: min(320px, calc(100% - 16px));padding: 12px;border-radius: 10px;background: var(--ui-twc-card);box-shadow: var(--ui-twc-pop);cursor: auto;transform-origin: 24px top;animation: ui-twc-open var(--nm-dur-3, 240ms) var(--ui-twc-ease) both}
.ui-twc__pop[data-side="above"]{transform-origin: 24px bottom}
.ui-twc__pop[data-closing]{animation: ui-twc-close 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) forwards;pointer-events: none}
.ui-twc__pop-head{display: flex;align-items: center;min-width: 0}
.ui-twc__pop-head .ui-twc__icon{width: 28px;height: 28px;margin-right: 10px;border-radius: 6px}
.ui-twc__pop-head .ui-twc__icon > svg{width: 15px;height: 15px}
.ui-twc__pop-who{display: grid;flex: 1;min-width: 0}
.ui-twc__pop-name{overflow: hidden;font-weight: 500;line-height: 18px;color: var(--ui-twc-strong);white-space: nowrap;text-overflow: ellipsis}
.ui-twc__pop-kind{overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-twc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-twc__pop-head .ui-twc__pill{height: 18px;margin-left: 8px;padding: 0 6px;font-size: 11px;border-radius: 4px}
.ui-twc__close{display: grid;flex: none;place-items: center;width: 28px;height: 28px;margin: -2px -4px 0 4px;border-radius: 6px;color: var(--ui-twc-muted);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-twc__close:hover{background: var(--ui-twc-fill);color: var(--ui-twc-ink)}
.ui-twc__pop-stats{display: grid;grid-template-columns: repeat(3, minmax(0, 1fr));gap: 8px;padding: 8px 10px;border-radius: 8px;background: var(--ui-twc-wash);box-shadow: inset 0 0 0 0.5px var(--ui-twc-line)}
.ui-twc__pop-stats dt{font-size: 10px;font-weight: 500;line-height: 16px;letter-spacing: 0.5px;text-transform: uppercase;color: var(--ui-twc-muted)}
.ui-twc__pop-stats dd{font-weight: 500;line-height: 20px;color: var(--ui-twc-ink);font-variant-numeric: tabular-nums}
.ui-twc__pop-error{display: flex;gap: 8px;padding: 8px 10px;border-radius: 8px;background: var(--ui-twc-error-bg);font-size: 12px;line-height: 16px;color: var(--ui-twc-error-ink)}
.ui-twc__pop-error > svg{margin-top: 2px}
.ui-twc__pop-io{display: grid;gap: 2px}
.ui-twc__pop-io > span{font-size: 10px;font-weight: 500;line-height: 16px;letter-spacing: 0.5px;text-transform: uppercase;color: var(--ui-twc-muted)}
.ui-twc__pop-io > p{display: -webkit-box;overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-twc-text);-webkit-line-clamp: 3;-webkit-box-orient: vertical}
@container ui-twc (max-width: 560px){.ui-twc__bar-head{padding: 10px 12px}
.ui-twc__stats{grid-template-columns: repeat(3, minmax(0, 1fr));row-gap: 10px;padding: 10px 0}
.ui-twc__stat{padding: 0 12px}
.ui-twc__stat:is(:first-child, :nth-child(4)){padding-left: 16px}
.ui-twc__stat:is(:nth-child(3), :last-child){padding-right: 8px}
.ui-twc__stat:nth-child(4){border-left: 0}
.ui-twc__body{--ui-twc-row: 46px;--ui-twc-bar: 10px;--ui-twc-end: 12px}
.ui-twc__layer{left: var(--ui-twc-pad);right: var(--ui-twc-end)}
.ui-twc__tick{bottom: auto;height: var(--ui-twc-axis)}
.ui-twc__now{bottom: auto;height: var(--ui-twc-axis)}
.ui-twc__axis > span{display: none}
.ui-twc__row{grid-template-columns: minmax(0, 1fr);grid-template-rows: 28px 12px;column-gap: 0}
.ui-twc__name{height: 28px}
.ui-twc__track{height: 12px}
.ui-twc__bar{border-radius: 3px}
.ui-twc__mark{top: calc(50% - 2px);height: 4px}
.ui-twc__tag{display: none}
.ui-twc__meta{display: flex;flex: none;align-items: center;gap: 6px;margin-left: 8px;font-size: 12px;line-height: 16px;color: var(--ui-twc-text);white-space: nowrap;font-variant-numeric: tabular-nums}
.ui-twc__row[data-status="failed"] .ui-twc__meta{color: var(--ui-twc-error-ink)}
.ui-twc__pop-stats{grid-template-columns: repeat(2, minmax(0, 1fr))}
}
@container ui-twc (max-width: 400px){.ui-twc__stat{padding-inline: 10px}
.ui-twc__stat:is(:first-child, :nth-child(4)){padding-left: 14px}
.ui-twc__stat dt{letter-spacing: 0.2px}
.ui-twc__meta-cost{display: none}
.ui-twc__meta .ui-twc__slow{width: 6px;height: 6px;padding: 0;border-radius: 50%;background: var(--ui-twc-slow-fg);font-size: 0}
}
@container ui-twc (max-width: 360px){.ui-twc__detail{display: none}
}
@keyframes ui-twc-row{from{height: 0;opacity: 0;transform: translateY(-4px)}
}
@keyframes ui-twc-leave{from{height: var(--ui-twc-row);opacity: 1}
to{height: 0;opacity: 0}
}
@keyframes ui-twc-grow{from{clip-path: inset(0 100% 0 0 round 4px)}
to{clip-path: inset(0 0 0 0 round 4px)}
}
@keyframes ui-twc-fade{from{opacity: 0}
}
@keyframes ui-twc-pop{from{opacity: 0;transform: scale(0.9)}
}
@keyframes ui-twc-open{from{opacity: 0;transform: translateY(-4px) scale(0.96)}
}
@keyframes ui-twc-close{to{opacity: 0;transform: translateY(-3px) scale(0.97)}
}
@keyframes ui-twc-sweep{to{background-position: calc(100% + 60px) 0}
}
@keyframes ui-twc-glow{from{opacity: 0.45}
to{opacity: 1}
}
@keyframes ui-twc-pulse{50%{opacity: 0.35}
}
@keyframes ui-twc-spin{to{transform: rotate(360deg)}
}
@keyframes ui-twc-shine{from{background-position: 100% 0}
to{background-position: 0 0}
}
@media (pointer: coarse){.ui-twc__chev{width: 24px;height: 28px;margin-left: -4px}
}
@media (prefers-reduced-motion: reduce){.ui-twc *, .ui-twc *::before, .ui-twc *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-twc{--ui-twc-card: #211b16;--ui-twc-strong: #fffdfb;--ui-twc-ink: rgba(255, 253, 251, 0.9);--ui-twc-text: rgba(255, 253, 251, 0.62);--ui-twc-muted: rgba(255, 253, 251, 0.45);--ui-twc-faint: rgba(255, 253, 251, 0.28);--ui-twc-line: rgba(255, 253, 251, 0.08);--ui-twc-grid: rgba(255, 253, 251, 0.05);--ui-twc-guide: rgba(255, 253, 251, 0.1);--ui-twc-hover: rgba(255, 253, 251, 0.025);--ui-twc-selected: rgba(255, 138, 92, 0.08);--ui-twc-fill: rgba(255, 253, 251, 0.08);--ui-twc-wash: rgba(255, 253, 251, 0.03);--ui-twc-accent: #ff8a5c;--ui-twc-now: rgba(255, 138, 92, 0.55);--ui-twc-agent-bg: rgba(255, 253, 251, 0.07);--ui-twc-agent-edge: rgba(255, 253, 251, 0.14);--ui-twc-agent-ink: rgba(255, 253, 251, 0.7);--ui-twc-agent-mark: rgba(255, 253, 251, 0.4);--ui-twc-llm-bg: rgba(255, 138, 92, 0.16);--ui-twc-llm-edge: rgba(255, 138, 92, 0.38);--ui-twc-llm-ink: #ff8a5c;--ui-twc-llm-mark: rgba(255, 138, 92, 0.8);--ui-twc-tool-bg: rgba(217, 84, 31, 0.13);--ui-twc-tool-edge: rgba(217, 84, 31, 0.34);--ui-twc-tool-ink: #ff6b35;--ui-twc-tool-mark: rgba(255, 107, 53, 0.75);--ui-twc-error-bg: #e2544a2b;--ui-twc-error-edge: rgba(226, 84, 74, 0.4);--ui-twc-error-ink: #e2544a;--ui-twc-error-mark: rgba(226, 84, 74, 0.75);--ui-twc-brand-bg: #ff6b353a;--ui-twc-brand-fg: #ff8a5c;--ui-twc-ok-bg: #2f8d5c1f;--ui-twc-ok-fg: #2f8d5c;--ui-twc-slow-bg: #ff6b3525;--ui-twc-slow-fg: #ff8a5c;--ui-twc-focus: rgba(255, 138, 92, 0.45);--ui-twc-shine: rgba(255, 253, 251, 0.35);--ui-twc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-twc-pop: 0 0 0 0.5px rgba(255, 253, 251, 0.12), 0 12px 28px -10px rgba(11, 9, 8, 0.6)}
:where(.dark, [data-theme="dark"]) .ui-twc__tick[data-zero]{background: rgba(255, 253, 251, 0.12)}

`;
