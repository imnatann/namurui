"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/*
 * Review Center – a focused workspace for what agents want to do, in a single self-contained file.
 * The queue sits on the left, sorted by risk and then by how long each item has waited; the right
 * side shows one item at a time with the spans the agent was unsure about marked in place. Hovering
 * or focusing a mark opens the agent's note under it, and F walks them.
 * A approves, E edits the proposal in place, R asks for a reason, S skips. The item stamps and
 * closes while the next rises in, J and K walk the queue, Z takes the last decision back, and the
 * shortcuts arm themselves as soon as the reviewer touches the component – Tab is never trapped.
 * The styles are injected below, so no extra files are needed.
 */

export type ReviewRisk = "high" | "medium" | "low";

export type CenterDecision = "approved" | "rejected" | "skipped";

/** Which way the queue is ordered – the reference sorts by risk, oldest first inside a risk */
export type ReviewSort = "risk" | "oldest" | "given";

export type ReviewFilter = "all" | "high" | "unsure";

export type CodeToken = "kw" | "str" | "fn" | "type" | "com";

/** A piece of copy or code – a flagged piece is a span the agent was unsure about */
export type ReviewPiece =
  | string
  | { tok: CodeToken; text: string }
  | { flag: string; note: string; source?: string };

export type ReviewLine =
  | { kind: "hunk"; text: string }
  | { kind: "ctx" | "add" | "del"; n: number; src: ReviewPiece[] };

export type ReviewFile = {
  /** Path as git prints it, e.g. "src/webhooks/deliver.ts" */
  path: string;
  /** Lines added, shown in green after the path */
  added?: number;
  /** Lines removed, shown in red after the path */
  removed?: number;
  /** The unified diff for this file – ctx, add and del lines with their gutter numbers */
  lines?: ReviewLine[];
};

export type ReviewField = {
  /** The label above the value, e.g. "Amount" */
  label: string;
  /** The value – flags allowed */
  value: ReviewPiece[];
};

export type ReviewStep = {
  /** What the step does, e.g. "Add the two columns" */
  title: string;
  /** The tool or system it runs against, e.g. "postgres" */
  tool?: string;
  /** The detail under the title – flags allowed */
  detail?: ReviewPiece[];
};

export type ReviewBody = {
  /** The label above the proposal, e.g. "Reply to Maya" */
  label?: string;
  /** Code bodies are set in a monospace editor */
  format?: "text" | "code";
  /** The text being proposed – flags allowed */
  text: ReviewPiece[];
};

export type ReviewSource = {
  /** What the chip says, e.g. "PR #511" */
  label: string;
  /** Where it goes; without one the chip is static */
  href?: string;
  /** The mark before the label */
  mark?: "github" | "notion";
};

export type CenterReviewItem = {
  /** Stable id – the queue and the decisions key on it */
  id: string;
  /** What the agent wants to do, e.g. "Merge #511 – retries for webhook delivery" */
  title: string;
  /** Who is asking, e.g. "Coder" */
  agent: string;
  /** The model under the agent, e.g. "GPT-6 Sol" */
  model?: string;
  /** The mark on the avatar – default "claude" */
  logo?: "claude" | "openai";
  /** Short noun for the kind of work, e.g. "Code change" */
  type: string;
  /** Drives the tint of the risk chip and the order of the queue */
  risk: ReviewRisk;
  /** 0–1 – below the center's lowConfidence the item counts as Unsure */
  confidence: number;
  /** When the item started waiting, epoch ms */
  createdAt: number;
  /** The agent's one-line reasoning, shown after "Why" */
  why?: string;
  /** Counted facts about the proposal */
  fields?: ReviewField[];
  /** An ordered plan instead of a proposal */
  steps?: ReviewStep[];
  /** The text the agent wrote – a reply, a clause, a note */
  body?: ReviewBody;
  /** A code change, file by file */
  files?: ReviewFile[];
  /** Where the proposal comes from, shown in the footer */
  sources?: ReviewSource[];
};

export type ReviewResult = {
  decision: CenterDecision;
  /** Only when rejected with a quick reason */
  reason?: string;
  /** Only when the proposal text was edited before approving */
  text?: string;
  /** Only the fields that were edited */
  fields?: Record<string, string>;
};

export type ReviewCenterProps = {
  /** Everything waiting – decided items take themselves out */
  items: CenterReviewItem[];
  /** A decision was made: approved, rejected (with an optional reason) or skipped */
  onDecide?: (item: CenterReviewItem, result: ReviewResult) => void;
  /** The last decision was taken back */
  onUndo?: (item: CenterReviewItem, result: ReviewResult) => void;
  /** How many were reviewed before this session, e.g. earlier today */
  reviewed?: number;
  /** The total in the header – defaults to reviewed + items.length */
  total?: number;
  /** Heading of the bar */
  title?: string;
  /** How long an item may wait before it turns – ms */
  sla?: number;
  /** The clock (epoch ms) – defaults to the real one, ticking every 10s */
  now?: number;
  /** Below this an item counts as Unsure */
  lowConfidence?: number;
  /** The quick reasons offered on R, picked with 1–4 */
  reasons?: string[];
  /** High risk first then oldest, oldest first, or as passed */
  sort?: ReviewSort;
  /** The queue's filter, controlled */
  filter?: ReviewFilter;
  /** Starting filter when uncontrolled */
  defaultFilter?: ReviewFilter;
  /** The filter changed */
  onFilterChange?: (filter: ReviewFilter) => void;
  /** Open the first agent note when the center appears – default true */
  peek?: boolean;
  /** Extra class on the root */
  className?: string;
};

type DetailEnter = "first" | "decide" | "down" | "up" | "fade";

type Mode = "view" | "reason" | "edit";

type Draft = { text: string; fields: Record<string, string> };

/** What the tooltip needs to know about a flagged span */
type FlagInfo = { text: string; note: string; source?: string };

type TipPlacement = { item: string; index: number; side: "below" | "above"; top: number; left: number; x: number };

const RISK_LABEL: Record<ReviewRisk, string> = { high: "High risk", medium: "Medium risk", low: "Low risk" };

const RISK_RANK: Record<ReviewRisk, number> = { high: 0, medium: 1, low: 2 };

const FILTERS: { id: ReviewFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "high", label: "High risk" },
  { id: "unsure", label: "Unsure" },
];

/** The reasons "Rejected · Too risky" in the reference comes from */
const DEFAULT_REASONS = ["Too risky", "Wrong info", "Off tone", "Not allowed"];

const pieceText = (piece: ReviewPiece): string =>
  typeof piece === "string" ? piece : "tok" in piece ? piece.text : piece.flag;

const waited = (ms: number): string => {
  if (ms < 60_000) return "now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

/** The runs of `next` that are not in `prev`, word by word – what the editor shows as inserted */
function insertedSegments(prev: string, next: string): { text: string; ins: boolean }[] {
  if (prev === next) return next.length === 0 ? [] : [{ text: next, ins: false }];
  const before = prev.split(/(\s+)/);
  const after = next.split(/(\s+)/);
  const rows = before.length;
  const cols = after.length;
  const table: number[][] = Array.from({ length: rows + 1 }, () => new Array<number>(cols + 1).fill(0));
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      table[i][j] = before[i] === after[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const kept = new Array<boolean>(cols).fill(false);
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (before[i] === after[j]) {
      kept[j] = true;
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }

  const ranges: [number, number][] = [];
  let run: [number, number] | null = null;
  for (let k = 0; k < cols; k += 1) {
    if (kept[k]) {
      if (run) ranges.push(run);
      run = null;
      continue;
    }
    if (after[k].trim() === "") continue;
    if (run) run[1] = k + 1;
    else run = [k, k + 1];
  }
  if (run) ranges.push(run);

  if (ranges.length === 0) return [{ text: next, ins: false }];
  const offsets: number[] = [];
  let at = 0;
  for (const chunk of after) {
    offsets.push(at);
    at += chunk.length;
  }
  const segments: { text: string; ins: boolean }[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    const from = offsets[start];
    const to = offsets[end - 1] + after[end - 1].length;
    if (from > cursor) segments.push({ text: next.slice(cursor, from), ins: false });
    segments.push({ text: next.slice(from, to), ins: true });
    cursor = to;
  }
  if (cursor < next.length) segments.push({ text: next.slice(cursor), ins: false });
  return segments;
}

export function ReviewCenter({
  items,
  onDecide,
  onUndo,
  reviewed = 0,
  total,
  title = "Review center",
  sla = 1_800_000,
  now,
  lowConfidence = 0.7,
  reasons = DEFAULT_REASONS,
  sort = "risk",
  filter,
  defaultFilter = "all",
  onFilterChange,
  peek = true,
  className,
}: ReviewCenterProps) {
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const flagEls = useRef(new Map<number, HTMLElement>());
  /** Shortcuts stay cold until the reviewer touches the component – Tab always leaves it */
  const armed = useRef(false);
  const committing = useRef(false);
  const peeked = useRef(false);
  const leavingTimer = useRef<number | undefined>(undefined);
  const initialIds = useRef<string[] | null>(null);

  const [clock, setClock] = useState(() => Date.now());
  const [innerFilter, setInnerFilter] = useState<ReviewFilter>(defaultFilter);
  const [decisions, setDecisions] = useState<Record<string, CenterDecision>>({});
  const [leaving, setLeaving] = useState<{ id: string; decision: CenterDecision } | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [enter, setEnter] = useState<DetailEnter>("first");
  const [ghost, setGhost] = useState<CenterReviewItem | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [activeFlag, setActiveFlag] = useState<number | null>(null);
  const [tip, setTip] = useState<TipPlacement | null>(null);
  const [last, setLast] = useState<{ item: CenterReviewItem; result: ReviewResult } | null>(null);
  const [reentered, setReentered] = useState<Set<string>>(() => new Set());
  const [live, setLive] = useState("");
  const [pressed, setPressed] = useState<string | null>(null);

  if (initialIds.current === null) initialIds.current = items.map((item) => item.id);

  useEffect(() => {
    if (now !== undefined) return;
    const tick = window.setInterval(() => {
      if (!document.hidden) setClock(Date.now());
    }, 10_000);
    return () => window.clearInterval(tick);
  }, [now]);

  useEffect(() => {
    const disarm = (event: PointerEvent) => {
      const root = rootRef.current;
      if (root && !root.contains(event.target as Node)) armed.current = false;
    };
    document.addEventListener("pointerdown", disarm, true);
    return () => document.removeEventListener("pointerdown", disarm, true);
  }, []);

  useEffect(() => () => {
    if (leavingTimer.current) window.clearTimeout(leavingTimer.current);
  }, []);

  useEffect(() => {
    if (!last) return;
    const timer = window.setTimeout(() => setLast(null), 6_000);
    return () => window.clearTimeout(timer);
  }, [last]);

  const at = now ?? clock;
  const activeFilter = filter ?? innerFilter;

  const waiting = items.filter((item) => !decisions[item.id]);
  const counts = {
    all: waiting.length,
    high: waiting.filter((item) => item.risk === "high").length,
    unsure: waiting.filter((item) => item.confidence < lowConfidence).length,
  };

  const queue = waiting
    .filter((item) =>
      activeFilter === "high" ? item.risk === "high" : activeFilter === "unsure" ? item.confidence < lowConfidence : true,
    )
    .slice()
    .sort((a, b) => {
      if (sort === "given") return 0;
      if (sort === "oldest") return a.createdAt - b.createdAt;
      return RISK_RANK[a.risk] - RISK_RANK[b.risk] || a.createdAt - b.createdAt;
    });

  const current = queue.find((item) => item.id === currentId) ?? queue.find((item) => item.id !== leaving?.id) ?? null;
  /** Only the decided items the parent still lists – a parent that drops them owns the count */
  const reviewedCount = reviewed + items.filter((item) => decisions[item.id]).length;
  const totalCount = total ?? reviewed + items.length;
  const pct = totalCount === 0 ? 100 : Math.min(100, Math.max(0, Math.round((reviewedCount / totalCount) * 100)));
  const oldest = waiting.reduce<number | null>(
    (soonest, item) => (soonest === null ? item.createdAt : Math.min(soonest, item.createdAt)),
    null,
  );
  const oldestFor = oldest === null ? 0 : Math.max(0, at - oldest);

  const slaOf = (createdAt: number): "near" | "over" | undefined => {
    const ratio = Math.max(0, at - createdAt) / sla;
    if (ratio >= 1) return "over";
    if (ratio >= 0.75) return "near";
    return undefined;
  };

  const closeTip = () => {
    setActiveFlag(null);
    setTip(null);
  };

  const resetMode = () => {
    setMode("view");
    setDraft(null);
    closeTip();
  };

  const nextAfter = (id: string): CenterReviewItem | null => {
    const index = queue.findIndex((item) => item.id === id);
    const rest = queue.filter((item) => item.id !== id);
    if (rest.length === 0) return null;
    return rest[Math.min(Math.max(index, 0), rest.length - 1)];
  };

  const decide = (decision: CenterDecision, reason?: string, edits?: { text?: string; fields?: Record<string, string> }) => {
    const item = current;
    if (!item || committing.current) return;
    committing.current = true;
    armed.current = true;

    const result: ReviewResult = { decision };
    if (reason) result.reason = reason;
    if (edits?.text !== undefined) result.text = edits.text;
    if (edits?.fields) result.fields = edits.fields;

    const next = nextAfter(item.id);
    const left = Math.max(0, queue.length - 1);

    setLeaving({ id: item.id, decision });
    setGhost(item);
    setCurrentId(next ? next.id : null);
    setEnter("decide");
    resetMode();
    setPressed(null);
    setLive(
      decision === "approved"
        ? `Approved “${item.title}”. ${left} left.`
        : decision === "rejected"
          ? `Rejected “${item.title}”${reason ? `: ${reason}` : ""}. ${left} left.`
          : `Skipped “${item.title}”. ${left} left.`,
    );

    if (leavingTimer.current) window.clearTimeout(leavingTimer.current);
    /* the row holds the stamp for 180ms, then closes for 300ms – then the queue lets it go */
    leavingTimer.current = window.setTimeout(() => {
      committing.current = false;
      setDecisions((taken) => ({ ...taken, [item.id]: decision }));
      setLeaving(null);
      setGhost(null);
      if (decision !== "skipped") setLast({ item, result });
      if (document.activeElement === document.body) {
        const row = rootRef.current?.querySelector<HTMLElement>(".ui-rvcc__row[aria-current='true']");
        row?.focus();
      }
      onDecide?.(item, result);
    }, 500);
  };

  const approve = () => {
    if (!current || draft) return;
    decide("approved");
  };

  const skip = () => {
    if (!current) return;
    decide("skipped");
  };

  const askReason = () => {
    if (!current) return;
    setMode("reason");
    closeTip();
  };

  const startEdit = () => {
    const item = current;
    if (!item || mode === "edit") return;
    if (!item.body && !item.fields?.length) return;
    const fields = Object.fromEntries(
      (item.fields ?? []).map((field): [string, string] => [field.label, field.value.map(pieceText).join("")]),
    );
    setDraft({ text: item.body ? item.body.text.map(pieceText).join("") : "", fields });
    setMode("edit");
    closeTip();
  };

  const save = () => {
    const item = current;
    if (!item || !draft) return;
    const originalText = item.body ? item.body.text.map(pieceText).join("") : "";
    const originalFields = Object.fromEntries(
      (item.fields ?? []).map((field): [string, string] => [field.label, field.value.map(pieceText).join("")]),
    );
    const edits: { text?: string; fields?: Record<string, string> } = {};
    if (item.body && draft.text !== originalText) edits.text = draft.text;
    const changed = Object.entries(draft.fields).filter(([label, value]) => originalFields[label] !== value);
    if (changed.length > 0) edits.fields = Object.fromEntries(changed);
    decide("approved", undefined, edits);
  };

  const undo = () => {
    if (!last) return;
    const { item, result } = last;
    setDecisions((taken) => {
      const restored = { ...taken };
      delete restored[item.id];
      return restored;
    });
    setReentered((gone) => {
      const next = new Set(gone);
      next.add(item.id);
      return next;
    });
    setCurrentId(item.id);
    setEnter("down");
    setLast(null);
    setLive(`Took back “${item.title}”.`);
    onUndo?.(item, result);
  };

  const select = (item: CenterReviewItem) => {
    if (item.id === current?.id) return;
    const from = queue.findIndex((entry) => entry.id === current?.id);
    const to = queue.findIndex((entry) => entry.id === item.id);
    setEnter(to > from ? "down" : "up");
    setCurrentId(item.id);
    resetMode();
  };

  const move = (delta: number) => {
    if (queue.length === 0) return;
    const index = current ? queue.findIndex((item) => item.id === current.id) : 0;
    const target = queue[Math.min(queue.length - 1, Math.max(0, (index < 0 ? 0 : index) + delta))];
    if (!target) return;
    setEnter(delta > 0 ? "down" : "up");
    setCurrentId(target.id);
    resetMode();
    setLive(`${target.title}. ${target.type}, ${RISK_LABEL[target.risk].toLowerCase()}.`);
    const rows = rootRef.current?.querySelectorAll<HTMLElement>(".ui-rvcc__row");
    rows?.[queue.indexOf(target)]?.focus();
  };

  const cycleFlag = () => {
    const marks = flagEls.current;
    if (marks.size === 0) return;
    const indexes = [...marks.keys()].sort((a, b) => a - b);
    const at2 = activeFlag === null ? -1 : indexes.indexOf(activeFlag);
    const next = indexes[(at2 + 1) % indexes.length];
    setActiveFlag(next);
    marks.get(next)?.focus();
  };

  const changeFilter = (next: ReviewFilter) => {
    if (filter === undefined) setInnerFilter(next);
    onFilterChange?.(next);
    resetMode();
    setEnter("fade");
  };

  /* The latest handlers, so the one document listener always acts on this render */
  const handlers = useRef({
    approve,
    askReason,
    cancel: resetMode,
    closeTip,
    cycleFlag,
    decide,
    move,
    save,
    skip,
    startEdit,
    undo,
    activeFlag,
    mode,
  });
  handlers.current = {
    approve,
    askReason,
    cancel: resetMode,
    closeTip,
    cycleFlag,
    decide,
    move,
    save,
    skip,
    startEdit,
    undo,
    activeFlag,
    mode,
  };

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (!armed.current) return;
      const state = handlers.current;
      const target = document.activeElement;
      const typing =
        target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const key = event.key;
      const lower = key.toLowerCase();
      const mod = event.metaKey || event.ctrlKey;

      if (key === "Escape") {
        if (state.mode !== "view") {
          event.preventDefault();
          state.cancel();
        } else if (state.activeFlag !== null) {
          event.preventDefault();
          state.closeTip();
        }
        return;
      }
      if (mod) {
        if (key === "Enter" && state.mode === "edit") {
          event.preventDefault();
          state.save();
        } else if (lower === "z") {
          event.preventDefault();
          state.undo();
        }
        return;
      }
      if (event.altKey) return;
      if (typing) return;

      if (state.mode === "reason") {
        const picked = Number(key);
        if (picked >= 1 && picked <= Math.min(4, reasons.length)) {
          event.preventDefault();
          state.decide("rejected", reasons[picked - 1]);
        }
        return;
      }
      if (state.mode === "edit") return;

      switch (lower) {
        case "a":
          event.preventDefault();
          state.approve();
          break;
        case "e":
          event.preventDefault();
          state.startEdit();
          break;
        case "r":
          event.preventDefault();
          state.askReason();
          break;
        case "s":
          event.preventDefault();
          state.skip();
          break;
        case "j":
          event.preventDefault();
          state.move(1);
          break;
        case "k":
          event.preventDefault();
          state.move(-1);
          break;
        case "f":
          event.preventDefault();
          state.cycleFlag();
          break;
        case "z":
          event.preventDefault();
          state.undo();
          break;
        default:
          break;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [reasons]);

  /* ---------- flags ---------- */

  const flagInfo: FlagInfo[] = [];

  const markEl = (piece: { flag: string; note: string; source?: string }, key: string, flags: FlagInfo[], interactive: boolean): ReactNode => {
    const index = flags.length;
    flags.push({ text: piece.flag, note: piece.note, source: piece.source });
    const on = interactive && activeFlag === index;
    return (
      <mark
        key={key}
        className="ui-rvcc__flag"
        tabIndex={interactive ? 0 : undefined}
        aria-label={`${piece.flag} – the agent is unsure`}
        data-on={on ? "" : undefined}
        aria-describedby={on ? `${uid}-tip` : undefined}
        ref={
          interactive
            ? (element) => {
                if (element) flagEls.current.set(index, element);
                else flagEls.current.delete(index);
              }
            : undefined
        }
        onMouseEnter={interactive ? () => setActiveFlag(index) : undefined}
        onMouseLeave={interactive ? () => setActiveFlag((open) => (open === index ? null : open)) : undefined}
        onFocus={interactive ? () => setActiveFlag(index) : undefined}
        onBlur={interactive ? () => setActiveFlag((open) => (open === index ? null : open)) : undefined}
        onClick={interactive ? () => setActiveFlag((open) => (open === index ? null : index)) : undefined}
      >
        {piece.flag}
      </mark>
    );
  };

  const pieceEl = (piece: ReviewPiece, key: string, flags: FlagInfo[], interactive: boolean): ReactNode => {
    if (typeof piece === "string") return piece;
    if ("tok" in piece) return <span key={key} data-tok={piece.tok}>{piece.text}</span>;
    return markEl(piece, key, flags, interactive);
  };

  const renderPieces = (pieces: ReviewPiece[], flags: FlagInfo[], where: string, interactive: boolean): ReactNode[] =>
    pieces.map((piece, index) => pieceEl(piece, `${where}-${index}`, flags, interactive));

  /** A diff line's source: runs of plain code in a span, flagged spans as marks beside them */
  const renderSrc = (pieces: ReviewPiece[], flags: FlagInfo[], where: string, interactive: boolean): ReactNode[] => {
    const out: ReactNode[] = [];
    let run: ReactNode[] = [];
    let runKey = 0;
    let flagged = false;
    const flush = (force: boolean) => {
      if (run.length === 0 && !force) return;
      out.push(<span key={`${where}-run${runKey}`}>{run}</span>);
      runKey += 1;
      run = [];
    };
    pieces.forEach((piece, index) => {
      if (typeof piece === "string" || "tok" in piece) {
        run.push(pieceEl(piece, `${where}-${index}`, flags, interactive));
        return;
      }
      flush(!flagged);
      flagged = true;
      out.push(pieceEl(piece, `${where}-${index}`, flags, interactive));
    });
    flush(!flagged);
    return out;
  };

  const renderDetail = (item: CenterReviewItem, flags: FlagInfo[], interactive: boolean): ReactNode => {
    const editing = interactive && mode === "edit" && draft !== null;
    const blocks: ReactNode[] = [];

    if (item.fields?.length) {
      blocks.push(
        <dl className="ui-rvcc__fields" key="fields">
          {item.fields.map((field, index) => (
            <div key={field.label}>
              <dt>{field.label}</dt>
              <dd>
                {editing && draft ? (
                  <input
                    className="ui-rvcc__input"
                    aria-label={field.label}
                    value={draft.fields[field.label] ?? ""}
                    onChange={(event) => setDraft({ ...draft, fields: { ...draft.fields, [field.label]: event.target.value } })}
                  />
                ) : (
                  renderPieces(field.value, flags, `${item.id}-f${index}`, interactive)
                )}
              </dd>
            </div>
          ))}
        </dl>,
      );
    }

    if (item.steps?.length) {
      blocks.push(
        <ol className="ui-rvcc__steps" key="steps">
          {item.steps.map((step, index) => (
            <li
              className="ui-rvcc__step"
              key={step.title}
              data-flagged={step.detail?.some((piece) => typeof piece !== "string" && !("tok" in piece)) ? "" : undefined}
            >
              <span className="ui-rvcc__step-n" aria-hidden="true">
                {index + 1}
              </span>
              <span className="ui-rvcc__step-main">
                <span className="ui-rvcc__step-title">{step.title}</span>
                {step.tool ? <span className="ui-rvcc__step-tool">{step.tool}</span> : null}
                {step.detail ? (
                  <span className="ui-rvcc__step-detail">{renderPieces(step.detail, flags, `${item.id}-s${index}`, interactive)}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>,
      );
    }

    if (item.body) {
      const body = item.body;
      blocks.push(
        <div className="ui-rvcc__body" key="body" data-format={body.format === "code" ? "code" : undefined}>
          {body.label ? <span className="ui-rvcc__body-label">{body.label}</span> : null}
          {editing && draft ? (
            <div className="ui-rvcc__editor">
              <div className="ui-rvcc__mirror" aria-hidden="true">
                {insertedSegments(body.text.map(pieceText).join(""), draft.text).map((segment, index) =>
                  segment.ins ? (
                    <span className="ui-rvcc__ins" key={index}>
                      {segment.text}
                    </span>
                  ) : (
                    segment.text
                  ),
                )}
              </div>
              <textarea
                rows={2}
                spellCheck={false}
                aria-label={body.label ?? "Proposal"}
                value={draft.text}
                onChange={(event) => setDraft({ ...draft, text: event.target.value })}
              />
            </div>
          ) : (
            <p className="ui-rvcc__text">{renderPieces(body.text, flags, `${item.id}-b`, interactive)}</p>
          )}
        </div>,
      );
    }

    if (item.files?.length) {
      blocks.push(
        <div className="ui-rvcc__code" key="code">
          {item.files.map((file) => {
            const cut = file.path.lastIndexOf("/");
            const dir = cut < 0 ? "" : file.path.slice(0, cut + 1);
            const base = file.path.slice(cut + 1);
            return (
              <div className="ui-rvcc__file" key={file.path}>
                <div className="ui-rvcc__file-head">
                  <span className="ui-rvcc__path">
                    <span className="ui-rvcc__dir">{dir}</span>
                    {base}
                  </span>
                  {file.added !== undefined ? <span className="ui-rvcc__count-add">+{file.added}</span> : null}
                  {file.removed !== undefined ? <span className="ui-rvcc__count-del">−{file.removed}</span> : null}
                </div>
                {file.lines?.length ? (
                  <div className="ui-rvcc__diff">
                    {file.lines.map((line, index) =>
                      line.kind === "hunk" ? (
                        <span className="ui-rvcc__hunk" key={`h${index}`}>
                          {line.text}
                        </span>
                      ) : (
                        <span className="ui-rvcc__line" data-diff={line.kind} key={`l${index}`}>
                          <span className="ui-rvcc__ln">
                            {line.kind === "ctx" ? null : (
                              <span className="ui-rvcc__sign">{line.kind === "add" ? "+" : "−"}</span>
                            )}
                            {line.n}
                          </span>
                          <span className="ui-rvcc__src">
                            {renderSrc(line.src, flags, `${item.id}-${file.path}-${index}`, interactive)}
                          </span>
                        </span>
                      ),
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>,
      );
    }

    const risk = RISK_LABEL[item.risk];

    return (
      <>
        <div className="ui-rvcc__who">
          <span className="ui-rvcc__avatar" data-logo="" aria-hidden="true">
            {item.logo === "openai" ? <OpenAiMark /> : <ClaudeMark />}
          </span>
          <div className="ui-rvcc__meta">
            <span className="ui-rvcc__name">
              <span className="ui-rvcc__agent">{item.agent}</span>
              <span className="ui-rvcc__risk" data-risk={item.risk}>
                {risk}
              </span>
            </span>
            {item.model ? <span className="ui-rvcc__model">{item.model}</span> : null}
          </div>
        </div>

        <div className="ui-rvcc__ask">
          <h3 className="ui-rvcc__title">{item.title}</h3>
        </div>

        {item.why ? (
          <p className="ui-rvcc__why">
            <b>Why</b> {item.why}
          </p>
        ) : null}

        {blocks.length > 0 ? (
          <section className="ui-rvcc__proposal" aria-label={`Proposal: ${item.type}`}>
            {blocks}
          </section>
        ) : null}

        {item.sources?.length ? (
          <div className="ui-rvcc__foot">
            <ul className="ui-rvcc__sources" aria-label="Sources">
              {item.sources.map((source) => {
                const content = (
                  <>
                    {source.mark ? (
                      <span className="ui-rvcc__source-icon">
                        {source.mark === "github" ? <GitHubMark /> : <NotionMark />}
                      </span>
                    ) : null}
                    {source.label}
                  </>
                );
                return (
                  <li key={source.label}>
                    {source.href ? (
                      <a className="ui-rvcc__source" href={source.href} target="_blank" rel="noreferrer">
                        {content}
                      </a>
                    ) : (
                      <span className="ui-rvcc__source">{content}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </>
    );
  };

  const detail = current ? renderDetail(current, flagInfo, true) : null;
  const tipIndex = activeFlag !== null && activeFlag < flagInfo.length ? activeFlag : null;
  const tipFlag = tipIndex === null || !current || tip?.item !== current.id ? null : flagInfo[tipIndex];

  useEffect(() => {
    setActiveFlag(null);
    if (!peek || peeked.current || flagInfo.length === 0) return;
    peeked.current = true;
    setActiveFlag(0);
  }, [current?.id, peek, flagInfo.length]);

  useLayoutEffect(() => {
    if (activeFlag === null) {
      setTip(null);
      return;
    }
    const mark = flagEls.current.get(activeFlag);
    const stage = stageRef.current;
    const owner = current?.id;
    if (!mark || !stage || !owner) return;
    const place = () => {
      const box = mark.getBoundingClientRect();
      const frame = stage.getBoundingClientRect();
      const width = Math.min(300, frame.width - 20);
      const centre = box.left + box.width / 2 - frame.left;
      const left = Math.max(10, Math.min(centre - width / 2, frame.width - width - 10));
      setTip({ item: owner, index: activeFlag, side: "below", top: box.bottom - frame.top + 7, left, x: centre - left });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [activeFlag, current?.id, flagInfo.length]);

  useLayoutEffect(() => {
    if (!tip || tip.side !== "below") return;
    const box = tipRef.current;
    const stage = stageRef.current;
    const mark = flagEls.current.get(tip.index);
    if (!box || !stage || !mark) return;
    if (tip.top + box.offsetHeight <= stage.clientHeight - 8) return;
    const frame = stage.getBoundingClientRect();
    const anchor = mark.getBoundingClientRect();
    setTip({ ...tip, side: "above", top: anchor.top - frame.top - box.offsetHeight - 7 });
  }, [tip]);

  const rowEnter = (id: string): { kind: "first" | "new" | "in"; delay: number } => {
    if (reentered.has(id)) return { kind: "in", delay: 0 };
    const index = initialIds.current ? initialIds.current.indexOf(id) : -1;
    if (index >= 0) return { kind: "first", delay: Math.min(80 + index * 50, 420) };
    return { kind: "new", delay: 0 };
  };

  const press = (id: string) => ({
    onPointerDown: () => setPressed(id),
    onPointerUp: () => setPressed(null),
    onPointerLeave: () => setPressed((held) => (held === id ? null : held)),
  });

  const editable = current ? Boolean(current.body || current.fields?.length) : false;
  const undoLabel = last
    ? last.result.decision === "approved"
      ? "Approved"
      : `Rejected${last.result.reason ? ` · ${last.result.reason}` : ""}`
    : "";
  const emptyTitle = items.length === 0 ? "Nothing waiting" : counts.all === 0 ? "Queue cleared" : "Nothing here";
  const emptyBody =
    items.length === 0
      ? "New proposals land here as your agents finish."
      : counts.all === 0
        ? "Every item is reviewed. Take a decision back above if you changed your mind."
        : "No waiting item matches this filter.";

  return (
    <div
      ref={rootRef}
      className={["ui-rvcc", className].filter(Boolean).join(" ")}
      tabIndex={-1}
      onPointerDownCapture={() => {
        armed.current = true;
      }}
      onFocusCapture={() => {
        armed.current = true;
      }}
    >
      {/* React 19 hoists this into <head> once, no matter how many centers render */}
      <style href="ui-review-center" precedence="default">
        {css}
      </style>

      <header className="ui-rvcc__head">
        <span className="ui-rvcc__mark">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M18.9905 19H19M18.9905 19C18.3678 19.6175 17.2393 19.4637 16.4479 19.4637C15.4765 19.4637 15.0087 19.6537 14.3154 20.347C13.7251 20.9374 12.9337 22 12 22C11.0663 22 10.2749 20.9374 9.68457 20.347C8.99128 19.6537 8.52349 19.4637 7.55206 19.4637C6.76068 19.4637 5.63218 19.6175 5.00949 19C4.38181 18.3776 4.53628 17.2444 4.53628 16.4479C4.53628 15.4414 4.31616 14.9786 3.59938 14.2618C2.53314 13.1956 2.00002 12.6624 2 12C2.00001 11.3375 2.53312 10.8044 3.59935 9.73817C4.2392 9.09832 4.53628 8.46428 4.53628 7.55206C4.53628 6.76065 4.38249 5.63214 5 5.00944C5.62243 4.38178 6.7556 4.53626 7.55208 4.53626C8.46427 4.53626 9.09832 4.2392 9.73815 3.59937C10.8044 2.53312 11.3375 2 12 2C12.6625 2 13.1956 2.53312 14.2618 3.59937C14.9015 4.23907 15.5355 4.53626 16.4479 4.53626C17.2393 4.53626 18.3679 4.38247 18.9906 5C19.6182 5.62243 19.4637 6.75559 19.4637 7.55206C19.4637 8.55858 19.6839 9.02137 20.4006 9.73817C21.4669 10.8044 22 11.3375 22 12C22 12.6624 21.4669 13.1956 20.4006 14.2618C19.6838 14.9786 19.4637 15.4414 19.4637 16.4479C19.4637 17.2444 19.6182 18.3776 18.9905 19Z"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M9 12.8929C9 12.8929 10.2 13.5447 10.8 14.5C10.8 14.5 12.6 10.75 15 9.5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.6"
            />
          </svg>
        </span>

        <span className="ui-rvcc__heading">{title}</span>

        <span className="ui-rvcc__progress">
          <span className="ui-rvcc__track" data-live="" aria-hidden="true">
            <span className="ui-rvcc__fill" style={{ width: `${pct}%` }} />
          </span>
          <span className="ui-rvcc__count">
            <b key={reviewedCount}>{reviewedCount}</b> of {totalCount} reviewed
          </span>
        </span>

        {oldest !== null ? (
          <span className="ui-rvcc__oldest">
            oldest <b data-sla={slaOf(oldest)}>{waited(oldestFor)}</b>
          </span>
        ) : null}

        {last ? (
          <span className="ui-rvcc__undo" data-decision={last.result.decision}>
            <span className="ui-rvcc__undo-text">
              {last.result.decision === "approved" ? <CheckIcon /> : <CrossIcon />}
              {undoLabel}
            </span>
            <button
              type="button"
              className="ui-rvcc__undo-btn"
              aria-keyshortcuts="Z"
              data-pressed={pressed === "undo" ? "" : undefined}
              {...press("undo")}
              onClick={undo}
            >
              <UndoIcon />
              Undo
              <kbd className="ui-rvcc__kbd">Z</kbd>
            </button>
          </span>
        ) : null}
      </header>

      <div className="ui-rvcc__card">
        <div className="ui-rvcc__queue">
          <div className="ui-rvcc__queue-head">
            <div className="ui-rvcc__filters" role="group" aria-label="Filter the queue">
              {FILTERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="ui-rvcc__filter"
                  aria-pressed={activeFilter === option.id}
                  onClick={() => changeFilter(option.id)}
                >
                  {option.label}
                  <span className="ui-rvcc__filter-count">{counts[option.id]}</span>
                </button>
              ))}
            </div>
          </div>

          <ul className="ui-rvcc__list" aria-label="Queue">
            {queue.map((item) => {
              const chosen = leaving?.id === item.id ? leaving.decision : null;
              const active = current?.id === item.id;
              const schedule = rowEnter(item.id);
              const delay = chosen ? 0 : schedule.delay;
              return (
                <li
                  key={item.id}
                  className="ui-rvcc__item"
                  data-enter={chosen ? undefined : schedule.kind}
                  data-leaving={chosen ? "" : undefined}
                  data-decision={chosen ?? undefined}
                  style={{ "--d": `${delay}ms` } as CSSProperties}
                >
                  <button
                    type="button"
                    className="ui-rvcc__row"
                    data-risk={item.risk}
                    aria-current={active ? "true" : undefined}
                    aria-label={`${item.title}. ${item.type}, ${item.risk} risk, ${Math.round(
                      item.confidence * 100,
                    )}% confidence, waiting ${waited(Math.max(0, at - item.createdAt))}`}
                    tabIndex={active ? 0 : -1}
                    onClick={() => select(item)}
                  >
                    <span className="ui-rvcc__avatar" data-logo="" aria-hidden="true">
                      {item.logo === "openai" ? <OpenAiMark /> : <ClaudeMark />}
                    </span>
                    <span className="ui-rvcc__row-main">
                      <span className="ui-rvcc__row-top">
                        <span className="ui-rvcc__row-title">{item.title}</span>
                        <span className="ui-rvcc__wait" data-sla={slaOf(item.createdAt)}>
                          {waited(Math.max(0, at - item.createdAt))}
                        </span>
                        {chosen === "skipped" ? (
                          <span className="ui-rvcc__skipped">Skipped</span>
                        ) : chosen ? (
                          <span className="ui-rvcc__row-done" data-decision={chosen}>
                            {chosen === "approved" ? <CheckIcon /> : <CrossIcon />}
                          </span>
                        ) : null}
                      </span>
                      <span className="ui-rvcc__row-meta">
                        <span className="ui-rvcc__tag">{item.type}</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {queue.length === 0 ? <li className="ui-rvcc__none">No items in this filter</li> : null}
          </ul>
        </div>

        <div className="ui-rvcc__main">
          <div className="ui-rvcc__stage" ref={stageRef}>
            {ghost ? (
              <div className="ui-rvcc__detail" data-ghost="" aria-hidden="true" style={{ "--d": "0ms" } as CSSProperties}>
                {renderDetail(ghost, [], false)}
              </div>
            ) : null}

            {current ? (
              <div
                key={current.id}
                className="ui-rvcc__detail"
                data-enter={enter}
                style={{ "--d": "0ms" } as CSSProperties}
              >
                {detail}
              </div>
            ) : null}

            {!current ? (
              <div
                className="ui-rvcc__empty"
                data-after={last ? "" : undefined}
                style={{ "--d": "0ms" } as CSSProperties}
              >
                <span className="ui-rvcc__empty-mark">
                  <CheckIcon />
                </span>
                <b>{emptyTitle}</b>
                <span>{emptyBody}</span>
              </div>
            ) : null}

            {tipFlag && tipIndex !== null && tip ? (
              <div
                ref={tipRef}
                id={`${uid}-tip`}
                role="tooltip"
                className="ui-rvcc__tip"
                data-side={tip.side}
                style={{ top: tip.top, left: tip.left, "--x": `${Math.round(tip.x * 100) / 100}px` } as CSSProperties}
              >
                <span className="ui-rvcc__tip-head">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M13.9248 21H10.0752C5.44476 21 3.12955 21 2.27636 19.4939C1.42317 17.9879 2.60736 15.9914 4.97574 11.9985L6.90057 8.75333C9.17559 4.91778 10.3131 3 12 3C13.6869 3 14.8244 4.91777 17.0994 8.75332L19.0243 11.9985C21.3926 15.9914 22.5768 17.9879 21.7236 19.4939C20.8704 21 18.5552 21 13.9248 21Z"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                    <path d="M12 9V13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    <path d="M12 16.8V17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
                  </svg>
                  Agent's note
                </span>
                <p>{tipFlag.note}</p>
                {tipFlag.source ? <span className="ui-rvcc__tip-source">{tipFlag.source}</span> : null}
              </div>
            ) : null}
          </div>

          <div className="ui-rvcc__actions" data-mode={current ? mode : "view"}>
            {current && mode === "reason" ? (
              <div className="ui-rvcc__btns" role="group" aria-label="Why are you rejecting this?">
                <span className="ui-rvcc__why-label">Reject because</span>
                {reasons.slice(0, 4).map((reason, index) => (
                  <button
                    key={reason}
                    type="button"
                    className="ui-rvcc__reason"
                    aria-keyshortcuts={String(index + 1)}
                    data-pressed={pressed === `reason-${reason}` ? "" : undefined}
                    {...press(`reason-${reason}`)}
                    onClick={() => decide("rejected", reason)}
                  >
                    {reason}
                    <kbd className="ui-rvcc__kbd">{index + 1}</kbd>
                  </button>
                ))}
                <button type="button" className="ui-rvcc__cancel" onClick={resetMode}>
                  Cancel
                </button>
              </div>
            ) : current && mode === "edit" ? (
              <div className="ui-rvcc__btns">
                <button
                  type="button"
                  className="ui-rvcc__btn"
                  data-primary=""
                  data-tone="approved"
                  aria-keyshortcuts="Control+Enter Meta+Enter"
                  onClick={save}
                >
                  <CheckIcon />
                  <span>Approve with edits</span>
                </button>
                <button type="button" className="ui-rvcc__cancel" onClick={resetMode}>
                  Cancel
                </button>
              </div>
            ) : (
              <div className="ui-rvcc__btns">
                <button
                  type="button"
                  className="ui-rvcc__btn"
                  data-primary=""
                  data-tone="approved"
                  aria-keyshortcuts="A"
                  disabled={!current}
                  data-pressed={pressed === "approve" ? "" : undefined}
                  {...press("approve")}
                  onClick={approve}
                >
                  <CheckIcon />
                  <span>Approve</span>
                  <kbd className="ui-rvcc__kbd">A</kbd>
                </button>
                <button
                  type="button"
                  className="ui-rvcc__btn"
                  aria-keyshortcuts="E"
                  disabled={!editable}
                  data-pressed={pressed === "edit" ? "" : undefined}
                  {...press("edit")}
                  onClick={startEdit}
                >
                  <EditIcon />
                  <span>Edit</span>
                  <kbd className="ui-rvcc__kbd">E</kbd>
                </button>
                <button
                  type="button"
                  className="ui-rvcc__btn"
                  data-danger=""
                  data-tone="rejected"
                  aria-keyshortcuts="R"
                  disabled={!current}
                  data-pressed={pressed === "reject" ? "" : undefined}
                  {...press("reject")}
                  onClick={askReason}
                >
                  <CrossIcon />
                  <span>Reject</span>
                  <kbd className="ui-rvcc__kbd">R</kbd>
                </button>
                <button
                  type="button"
                  className="ui-rvcc__btn"
                  aria-keyshortcuts="S"
                  disabled={!current}
                  data-pressed={pressed === "skip" ? "" : undefined}
                  {...press("skip")}
                  onClick={skip}
                >
                  <SkipIcon />
                  <span>Skip</span>
                  <kbd className="ui-rvcc__kbd">S</kbd>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="ui-rvcc__sr" aria-live="polite" aria-atomic="true">
        {live}
      </div>
    </div>
  );
}

/* ---------- marks ---------- */

function ClaudeMark() {
  return (
    <svg viewBox="0 0 1200 1200" aria-hidden="true">
      <path
        fill="#D97757"
        d="M 233.959793 800.214905 L 468.644287 668.536987 L 472.590637 657.100647 L 468.644287 650.738403 L 457.208069 650.738403 L 417.986633 648.322144 L 283.892639 644.69812 L 167.597321 639.865845 L 54.926208 633.825623 L 26.577238 627.785339 L 3.3e-05 592.751709 L 2.73832 575.27533 L 26.577238 559.248352 L 60.724873 562.228149 L 136.187973 567.382629 L 249.422867 575.194763 L 331.570496 580.026978 L 453.261841 592.671082 L 472.590637 592.671082 L 475.328857 584.859009 L 468.724915 580.026978 L 463.570557 575.194763 L 346.389313 495.785217 L 219.543671 411.865906 L 153.100723 363.543762 L 117.181267 339.060425 L 99.060455 316.107361 L 91.248367 266.01355 L 123.865784 230.093994 L 167.677887 233.073853 L 178.872513 236.053772 L 223.248367 270.201477 L 318.040283 343.570496 L 441.825592 434.738342 L 459.946411 449.798706 L 467.194672 444.64447 L 468.080597 441.020203 L 459.946411 427.409485 L 392.617493 305.718323 L 320.778564 181.932983 L 288.80542 130.630859 L 280.348999 99.865845 C 277.369171 87.221436 275.194641 76.590698 275.194641 63.624268 L 312.322174 13.20813 L 332.8591 6.604126 L 382.389313 13.20813 L 403.248352 31.328979 L 434.013519 101.71814 L 483.865753 212.537048 L 561.181274 363.221497 L 583.812134 407.919434 L 595.892639 449.315491 L 600.40271 461.959839 L 608.214783 461.959839 L 608.214783 454.711609 L 614.577271 369.825623 L 626.335632 265.61084 L 637.771851 131.516846 L 641.718201 93.745117 L 660.402832 48.483276 L 697.530334 24.000122 L 726.52356 37.852417 L 750.362549 72 L 747.060486 94.067139 L 732.886047 186.201416 L 705.100708 330.52356 L 686.979919 427.167847 L 697.530334 427.167847 L 709.61084 415.087341 L 758.496704 350.174561 L 840.644348 247.490051 L 876.885925 206.738342 L 919.167847 161.71814 L 946.308838 140.29541 L 997.61084 140.29541 L 1035.38269 196.429626 L 1018.469849 254.416199 L 965.637634 321.422852 L 921.825562 378.201538 L 859.006714 462.765259 L 819.785278 530.41626 L 823.409424 535.812073 L 832.75177 534.92627 L 974.657776 504.724915 L 1051.328979 490.872559 L 1142.818848 475.167786 L 1184.214844 494.496582 L 1188.724854 514.147644 L 1172.456421 554.335693 L 1074.604126 578.496765 L 959.838989 601.449829 L 788.939636 641.879272 L 786.845764 643.409485 L 789.261841 646.389343 L 866.255127 653.637634 L 899.194702 655.409424 L 979.812134 655.409424 L 1129.932861 666.604187 L 1169.154419 692.537109 L 1192.671265 724.268677 L 1188.724854 748.429688 L 1128.322144 779.194641 L 1046.818848 759.865845 L 856.590759 714.604126 L 791.355774 698.335754 L 782.335693 698.335754 L 782.335693 703.731567 L 836.69812 756.885986 L 936.322205 846.845581 L 1061.073975 962.81897 L 1067.436279 991.490112 L 1051.409424 1014.120911 L 1034.496704 1011.704712 L 924.885986 929.234924 L 882.604126 892.107544 L 786.845764 811.48999 L 780.483276 811.48999 L 780.483276 819.946289 L 802.550415 852.241699 L 919.087341 1027.409424 L 925.127625 1081.127686 L 916.671204 1098.604126 L 886.469849 1109.154419 L 853.288696 1103.114136 L 785.073914 1007.355835 L 714.684631 899.516785 L 657.906067 802.872498 L 650.979858 806.81897 L 617.476624 1167.704834 L 601.771851 1186.147705 L 565.530212 1200 L 535.328857 1177.046997 L 519.302124 1139.919556 L 535.328857 1066.550537 L 554.657776 970.792053 L 570.362488 894.68457 L 584.536926 800.134277 L 592.993347 768.724976 L 592.429626 766.630859 L 585.503479 767.516968 L 514.22821 865.369263 L 405.825531 1011.865906 L 320.053711 1103.677979 L 299.516815 1111.812256 L 263.919525 1093.369263 L 267.221497 1060.429688 L 287.114136 1031.114136 L 405.825531 880.107361 L 477.422913 786.52356 L 523.651062 732.483276 L 523.328918 724.671265 L 520.590698 724.671265 L 205.288605 929.395935 L 149.154434 936.644409 L 124.993355 914.01355 L 127.973183 876.885986 L 139.409409 864.80542 L 234.201385 799.570435 L 233.879227 799.8927 Z"
      />
    </svg>
  );
}

function OpenAiMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ color: "var(--ui-rvcc-strong, var(--ui-rvc-ink, #000))" }}
    >
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ color: "var(--ui-rvcc-strong, var(--ui-rvc-ink, #181717))" }}
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function NotionMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ color: "var(--ui-rvcc-strong, var(--ui-rvc-ink, #000))" }}
    >
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
    </svg>
  );
}

/* ---------- icons ---------- */

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 14L8.5 17.5L19 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function SkipIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16.4249 4.60509L17.4149 3.6151C18.2351 2.79497 19.5648 2.79497 20.3849 3.6151C21.205 4.43524 21.205 5.76493 20.3849 6.58507L19.3949 7.57506M16.4249 4.60509L9.76558 11.2644C9.25807 11.772 8.89804 12.4078 8.72397 13.1041L8 16L10.8959 15.276C11.5922 15.102 12.228 14.7419 12.7356 14.2344L19.3949 7.57506M16.4249 4.60509L19.3949 7.57506"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M18.9999 13.5C18.9999 16.7875 18.9999 18.4312 18.092 19.5376C17.9258 19.7401 17.7401 19.9258 17.5375 20.092C16.4312 21 14.7874 21 11.4999 21H11C7.22876 21 5.34316 21 4.17159 19.8284C3.00003 18.6569 3 16.7712 3 13V12.5C3 9.21252 3 7.56879 3.90794 6.46244C4.07417 6.2599 4.2599 6.07417 4.46244 5.90794C5.56879 5 7.21252 5 10.5 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M3 3v5h5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

const css = /* css */ `
.ui-rvcc{--ui-rvcc-card: #fffdfb;--ui-rvcc-strong: #0b0908;--ui-rvcc-ink: rgba(11, 9, 8, 0.88);--ui-rvcc-text: rgba(11, 9, 8, 0.61);--ui-rvcc-muted: rgba(11, 9, 8, 0.45);--ui-rvcc-faint: rgba(11, 9, 8, 0.27);--ui-rvcc-line: rgba(11, 9, 8, 0.06);--ui-rvcc-queue-bg: rgba(11, 9, 8, 0.015);--ui-rvcc-line-strong: rgba(11, 9, 8, 0.12);--ui-rvcc-code-ink: rgba(11, 9, 8, 0.88);--ui-rvcc-code-num: rgba(11, 9, 8, 0.45);--ui-rvcc-diff-add: rgba(26, 122, 74, 0.06);--ui-rvcc-diff-del: rgba(179, 38, 30, 0.05);--ui-rvcc-diff-add-fg: #2f8d5c;--ui-rvcc-diff-del-fg: #b3261e;--ui-rvcc-tok-kw: color(display-p3 0.843 0.298 0.507);--ui-rvcc-tok-str: color(display-p3 0.38 0.647 0.378);--ui-rvcc-tok-type: color(display-p3 0.247 0.556 0.969);--ui-rvcc-tok-fn: color(display-p3 0.587 0.29 0.667);--ui-rvcc-ring-soft: rgba(217, 84, 31, 0.1);--ui-rvcc-hover: rgba(11, 9, 8, 0.025);--ui-rvcc-fill: rgba(11, 9, 8, 0.06);--ui-rvcc-wash: rgba(11, 9, 8, 0.025);--ui-rvcc-accent: rgba(217, 84, 31, 0.765);--ui-rvcc-new: rgba(217, 84, 31, 0.07);--ui-rvcc-primary: rgba(11, 9, 8, 0.88);--ui-rvcc-primary-fg: #fcf9f7;--ui-rvcc-bar-bg: rgba(217, 84, 31, 0.1);--ui-rvcc-bar-edge: rgba(217, 84, 31, 0.32);--ui-rvcc-bar-mark: rgba(217, 84, 31, 0.7);--ui-rvcc-track: rgba(11, 9, 8, 0.05);--ui-rvcc-high-bg: #b3261e18;--ui-rvcc-high-edge: rgba(179, 38, 30, 0.34);--ui-rvcc-high-fg: #b3261eda;--ui-rvcc-mid-bg: #d9953024;--ui-rvcc-mid-edge: rgba(217, 149, 48, 0.4);--ui-rvcc-mid-fg: #d9541f;--ui-rvcc-low-bg: #1a7a4a19;--ui-rvcc-low-edge: rgba(26, 122, 74, 0.3);--ui-rvcc-low-fg: #1a7a4ae0;--ui-rvcc-flag-bg: rgba(217, 149, 48, 0.16);--ui-rvcc-flag-edge: rgba(217, 149, 48, 0.55);--ui-rvcc-flag-hot: rgba(217, 149, 48, 0.28);--ui-rvcc-flag-ink: #9a6410;--ui-rvcc-ins-bg: rgba(26, 122, 74, 0.13);--ui-rvcc-ins-ink: #1a7a4a;--ui-rvcc-add-bg: rgba(26, 122, 74, 0.06);--ui-rvcc-del-bg: rgba(179, 38, 30, 0.05);--ui-rvcc-focus: rgba(217, 84, 31, 0.35);--ui-rvcc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-rvcc-raised: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 1px 1px -1px rgba(11, 9, 8, 0.12), 0 2px 4px 0 rgba(11, 9, 8, 0.05);--ui-rvcc-pop: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 12px 28px -10px rgba(11, 9, 8, 0.18), 0 1px 2px rgba(11, 9, 8, 0.05);--ui-rvcc-height: 552px;--ui-rvcc-queue: 296px;--ui-rvcc-row: 56px;--ui-rvcc-ease: cubic-bezier(0.32, 0.72, 0.24, 1);--ui-rvcc-ease-in: cubic-bezier(0.55, 0, 0.75, 0.3);position: relative;box-sizing: border-box;width: 100%;border-radius: 12px;background: var(--ui-rvcc-card);box-shadow: var(--ui-rvcc-shadow);outline: none;container: ui-rvcc / inline-size;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;font-weight: 400;line-height: 20px;color: var(--ui-rvcc-text);text-align: left;-webkit-font-smoothing: antialiased}
.ui-rvcc *, .ui-rvcc *::before, .ui-rvcc *::after{box-sizing: border-box}
:where(.ui-rvcc) :is(button, input, textarea){margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;letter-spacing: inherit;text-align: inherit;-webkit-tap-highlight-color: transparent}
:where(.ui-rvcc) button{cursor: pointer}
:where(.ui-rvcc) button:disabled{cursor: default}
.ui-rvcc :is(button, a, mark, input, textarea):focus-visible{outline: 2px solid var(--ui-rvcc-focus);outline-offset: 1px}
:where(.ui-rvcc) :is(p, dl, dd, h3, ul, ol){margin: 0;padding: 0}
.ui-rvcc svg{display: block;flex: none}
.ui-rvcc__kbd{display: inline-grid;place-items: center;min-width: 16px;height: 16px;padding: 0 4px;border-radius: 4px;background: var(--ui-rvcc-fill);font-family: inherit;font-size: 10px;font-weight: 500;line-height: 1;color: var(--ui-rvcc-muted);letter-spacing: 0}
.ui-rvcc__sr{position: absolute;width: 1px;height: 1px;overflow: hidden;clip-path: inset(50%);white-space: nowrap}
.ui-rvcc__head{position: relative;display: flex;flex-wrap: wrap;align-items: center;gap: 8px 12px;min-width: 0;min-height: 48px;padding: 10px 12px 10px 16px;border-bottom: 0.5px solid var(--ui-rvcc-line)}
.ui-rvcc__mark{display: grid;flex: none;place-items: center;width: 16px;margin-right: -4px;color: var(--ui-rvcc-accent)}
.ui-rvcc__heading{flex: none;font-weight: 500;color: var(--ui-rvcc-strong)}
.ui-rvcc__progress{display: flex;flex: none;align-items: center;gap: 8px;font-size: 12px;line-height: 16px;color: var(--ui-rvcc-muted);white-space: nowrap}
.ui-rvcc__count{font-variant-numeric: tabular-nums}
.ui-rvcc__count b{display: inline-block;font-weight: 500;color: var(--ui-rvcc-ink);animation: ui-rvcc-tick var(--nm-dur-4, 380ms) var(--ui-rvcc-ease) both}
.ui-rvcc__track{position: relative;width: 80px;height: 6px;overflow: hidden;border-radius: 3px;background: var(--ui-rvcc-track)}
.ui-rvcc__fill{position: absolute;inset: 0 auto 0 0;overflow: hidden;border-radius: 3px;background: var(--ui-rvcc-bar-bg);box-shadow: inset 0 0 0 0.5px var(--ui-rvcc-bar-edge);transition: width var(--nm-dur-5, 620ms) var(--ui-rvcc-ease)}
.ui-rvcc__track[data-live] .ui-rvcc__fill::before{content: "";position: absolute;inset: 0;background: linear-gradient(90deg, transparent, var(--ui-rvcc-card), transparent) -40px 0 / 40px 100% no-repeat;opacity: 0.7;animation: ui-rvcc-sweep var(--nm-dur-6, 1100ms) linear infinite}
.ui-rvcc__fill::after{content: "";position: absolute;top: 0;right: 0;bottom: 0;width: min(18px, 100%);background: linear-gradient(90deg, transparent, var(--ui-rvcc-bar-mark));opacity: 0.55;animation: ui-rvcc-glow 1100ms ease-in-out infinite alternate}
.ui-rvcc__oldest{flex: none;margin-left: -4px;font-size: 12px;line-height: 16px;color: var(--ui-rvcc-muted);white-space: nowrap}
.ui-rvcc__oldest::before{content: "·";margin-right: 8px;color: var(--ui-rvcc-faint)}
.ui-rvcc__oldest b{font-weight: 500;color: var(--ui-rvcc-text);font-variant-numeric: tabular-nums}
.ui-rvcc__oldest b[data-sla="near"]{color: var(--ui-rvcc-mid-fg)}
.ui-rvcc__oldest b[data-sla="over"]{color: var(--ui-rvcc-high-fg)}
.ui-rvcc__filters{display: flex;flex: 1;gap: 4px;min-width: 0}
.ui-rvcc__filter{display: inline-flex;align-items: center;gap: 5px;padding: 4px 10px;border-radius: 6px;font-size: 12px;font-weight: 500;line-height: 16px;color: var(--ui-rvcc-muted);white-space: nowrap;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-rvcc__filter:hover{color: var(--ui-rvcc-ink)}
.ui-rvcc__filter[aria-pressed="true"]{background: var(--ui-rvcc-card);box-shadow: var(--ui-rvcc-shadow);color: var(--ui-rvcc-ink)}
.ui-rvcc__filter-count{font-size: 11.5px;color: var(--ui-rvcc-faint);font-variant-numeric: tabular-nums}
.ui-rvcc__filter[aria-pressed="true"] .ui-rvcc__filter-count{color: var(--ui-rvcc-muted)}
.ui-rvcc__card{position: relative;display: grid;grid-template-columns: var(--ui-rvcc-queue) minmax(0, 1fr);height: var(--ui-rvcc-height);overflow: hidden;border-radius: 0 0 12px 12px}
.ui-rvcc__queue{display: flex;flex-direction: column;min-width: 0;min-height: 0;border-right: 0.5px solid var(--ui-rvcc-line);background: var(--ui-rvcc-queue-bg)}
.ui-rvcc__queue-head{display: flex;flex: none;align-items: center;padding: 8px;background: var(--ui-rvcc-card);border-bottom: 0.5px solid var(--ui-rvcc-line)}
.ui-rvcc__list{position: relative;flex: 1;min-height: 0;padding: 8px;overflow: hidden auto;overscroll-behavior: contain;list-style: none;scrollbar-width: thin}
.ui-rvcc__item{height: calc(var(--ui-rvcc-row) + 2px);padding: 1px 0;overflow: hidden}
.ui-rvcc__item[data-enter="first"]{animation: ui-rvcc-row-in var(--nm-dur-4, 380ms) var(--ui-rvcc-ease) var(--d) backwards}
.ui-rvcc__item:is([data-enter="new"], [data-enter="in"]){animation: ui-rvcc-open var(--nm-dur-5, 620ms) var(--ui-rvcc-ease) var(--d) backwards}
.ui-rvcc__item[data-enter="new"] .ui-rvcc__row{animation: ui-rvcc-arrive var(--nm-dur-6, 1100ms) ease-out backwards}
.ui-rvcc__item[data-leaving]{pointer-events: none;animation: ui-rvcc-close var(--nm-dur-3, 240ms) var(--ui-rvcc-ease) var(--d) forwards}
.ui-rvcc__item[data-leaving][data-decision]{animation-delay: calc(var(--d) + 180ms)}
.ui-rvcc__row{position: relative;display: grid;grid-template-columns: 24px minmax(0, 1fr);align-items: center;column-gap: 10px;width: 100%;height: var(--ui-rvcc-row);padding: 0 10px;border-radius: 8px;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-rvcc__row:hover{background: var(--ui-rvcc-hover)}
.ui-rvcc__row[aria-current]{background: var(--ui-rvcc-card);box-shadow: var(--ui-rvcc-shadow)}
.ui-rvcc__row:focus-visible{outline-offset: -2px}
.ui-rvcc__avatar{display: grid;flex: none;place-items: center;width: 24px;height: 24px;border-radius: 6px;background: var(--ui-rvcc-card);box-shadow: var(--ui-rvcc-shadow);font-size: 11px;font-weight: 500;color: var(--ui-rvcc-text)}
.ui-rvcc__avatar > svg{width: 13px;height: 13px}
.ui-rvcc__row-main{display: grid;gap: 2px;min-width: 0;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-rvcc__row-top{display: flex;align-items: center;gap: 8px;min-width: 0}
.ui-rvcc__row-title{flex: 1;min-width: 0;overflow: hidden;font-size: 13px;font-weight: 500;line-height: 18px;color: var(--ui-rvcc-ink);white-space: nowrap;text-overflow: ellipsis}
.ui-rvcc__wait{flex: none;font-size: 12px;line-height: 16px;color: var(--ui-rvcc-faint);font-variant-numeric: tabular-nums}
.ui-rvcc__wait[data-sla="near"]{color: var(--ui-rvcc-mid-fg)}
.ui-rvcc__wait[data-sla="over"]{color: var(--ui-rvcc-high-fg)}
.ui-rvcc__row-meta{display: flex;align-items: center;gap: 5px;min-width: 0;font-size: 12px;line-height: 16px;color: var(--ui-rvcc-muted);white-space: nowrap}
.ui-rvcc__tag{min-width: 0;overflow: hidden;text-overflow: ellipsis}
.ui-rvcc [data-risk="high"]{--k-bg: var(--ui-rvcc-high-bg);--k-edge: var(--ui-rvcc-high-edge);--k-fg: var(--ui-rvcc-high-fg)}
.ui-rvcc [data-risk="medium"]{--k-bg: var(--ui-rvcc-mid-bg);--k-edge: var(--ui-rvcc-mid-edge);--k-fg: var(--ui-rvcc-mid-fg)}
.ui-rvcc [data-risk="low"]{--k-bg: var(--ui-rvcc-low-bg);--k-edge: var(--ui-rvcc-low-edge);--k-fg: var(--ui-rvcc-low-fg)}
.ui-rvcc__skipped{flex: none;color: var(--ui-rvcc-faint)}
.ui-rvcc__item[data-decision] .ui-rvcc__row-main{opacity: 0.5;transition-delay: var(--d)}
.ui-rvcc__row-done{display: grid;flex: none;place-items: center;width: 16px;height: 16px;border-radius: 4px;background: var(--k-bg);color: var(--k-fg);animation: ui-rvcc-fade 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) var(--d) backwards}
.ui-rvcc__row-done > svg{width: 12px;height: 12px}
:is(.ui-rvcc__row-done, .ui-rvcc__undo, .ui-rvcc__btn)[data-decision="approved"], .ui-rvcc__btn[data-tone="approved"]{--k-bg: var(--ui-rvcc-low-bg);--k-edge: var(--ui-rvcc-low-edge);--k-fg: var(--ui-rvcc-low-fg)}
:is(.ui-rvcc__row-done, .ui-rvcc__undo, .ui-rvcc__btn)[data-decision="rejected"], .ui-rvcc__btn[data-tone="rejected"]{--k-bg: var(--ui-rvcc-high-bg);--k-edge: var(--ui-rvcc-high-edge);--k-fg: var(--ui-rvcc-high-fg)}
.ui-rvcc__none{display: grid;place-items: center;height: 120px;font-size: 12px;color: var(--ui-rvcc-faint);list-style: none;animation: ui-rvcc-fade var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 300ms backwards}
.ui-rvcc__main{position: relative;display: flex;flex-direction: column;min-width: 0;min-height: 0}
.ui-rvcc__stage{position: relative;flex: 1;min-height: 0;overflow: hidden auto;overscroll-behavior: contain;scrollbar-width: thin;transition: height var(--nm-dur-4, 380ms) var(--ui-rvcc-ease)}
.ui-rvcc__detail{position: relative;display: grid;gap: 16px;padding: 22px 24px 24px;background: var(--ui-rvcc-card)}
.ui-rvcc__detail[data-enter="first"] > *{animation: ui-rvcc-in var(--nm-dur-4, 380ms) var(--ui-rvcc-ease) calc(120ms + var(--i, 0) * 40ms) backwards}
.ui-rvcc__detail[data-enter="decide"]{animation: ui-rvcc-in var(--nm-dur-4, 380ms) var(--ui-rvcc-ease) calc(var(--d) + 90ms) backwards}
.ui-rvcc__detail[data-enter="down"]{animation: ui-rvcc-in var(--nm-dur-3, 240ms) var(--ui-rvcc-ease) backwards}
.ui-rvcc__detail[data-enter="up"]{animation: ui-rvcc-in-up var(--nm-dur-3, 240ms) var(--ui-rvcc-ease) backwards}
.ui-rvcc__detail[data-enter="fade"]{animation: ui-rvcc-fade 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) backwards}
.ui-rvcc__detail[data-ghost]{position: absolute;inset: 0 0 auto;z-index: 2;min-height: 100%;pointer-events: none;animation: ui-rvcc-away 240ms var(--ui-rvcc-ease) var(--d) forwards}
.ui-rvcc__who{display: flex;align-items: center;gap: 10px;min-width: 0}
.ui-rvcc__who .ui-rvcc__avatar{width: 32px;height: 32px;border-radius: 8px}
.ui-rvcc__who .ui-rvcc__avatar > svg{width: 16px;height: 16px}
.ui-rvcc__meta{display: grid;flex: 1;gap: 0;min-width: 0}
.ui-rvcc__name{display: flex;align-items: center;gap: 8px;min-width: 0}
.ui-rvcc__agent{min-width: 0;overflow: hidden;font-size: 13px;font-weight: 500;line-height: 20px;color: var(--ui-rvcc-strong);white-space: nowrap;text-overflow: ellipsis}
.ui-rvcc__model{overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-rvcc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-rvcc__risk{display: inline-flex;flex: none;align-items: center;height: 20px;padding: 0 7px;border-radius: 5px;background: var(--k-bg);font-size: 12px;font-weight: 500;line-height: 16px;color: var(--k-fg);white-space: nowrap}
.ui-rvcc__ask{display: grid;gap: 4px}
.ui-rvcc__title{font-size: 15px;font-weight: 500;line-height: 24px;color: var(--ui-rvcc-strong);text-wrap: balance}
.ui-rvcc__why{margin-top: -6px;font-size: 13px;line-height: 20px;color: var(--ui-rvcc-muted);text-wrap: pretty}
.ui-rvcc__why b{font-weight: 500;color: var(--ui-rvcc-text)}
.ui-rvcc__proposal{display: grid;gap: 16px;min-width: 0;padding-top: 2px}
.ui-rvcc__fields{display: flex;flex-wrap: wrap;gap: 12px 36px}
.ui-rvcc__fields > div{display: grid;gap: 1px;min-width: 0;max-width: 100%}
.ui-rvcc__fields dt{font-size: 12px;line-height: 16px;color: var(--ui-rvcc-muted)}
.ui-rvcc__fields dd{min-width: 0;overflow: hidden;font-size: 13px;font-weight: 500;line-height: 22px;color: var(--ui-rvcc-ink);white-space: nowrap;text-overflow: ellipsis;font-variant-numeric: tabular-nums}
.ui-rvcc__body{display: grid;gap: 6px;min-width: 0}
.ui-rvcc__body-label{font-size: 12px;line-height: 16px;color: var(--ui-rvcc-muted)}
.ui-rvcc__text{padding-left: 14px;box-shadow: inset 0.5px 0 0 var(--ui-rvcc-line-strong);font-size: 13px;line-height: 22px;color: var(--ui-rvcc-ink);white-space: pre-wrap;overflow-wrap: anywhere;text-wrap: pretty}
.ui-rvcc__code{overflow: hidden;border-radius: 10px;background: var(--ui-rvcc-card);box-shadow: var(--ui-rvcc-shadow)}
.ui-rvcc__file + .ui-rvcc__file{border-top: 0.5px solid var(--ui-rvcc-line)}
.ui-rvcc__file-head{display: flex;align-items: center;gap: 8px;min-width: 0;height: 36px;padding: 0 12px 0 15.6px;font-size: 13px;line-height: 20px}
.ui-rvcc__path{flex: 1;min-width: 0;overflow: hidden;color: var(--ui-rvcc-ink);white-space: nowrap;text-overflow: ellipsis}
.ui-rvcc__dir{color: var(--ui-rvcc-muted)}
:is(.ui-rvcc__count-add, .ui-rvcc__count-del){flex: none;font-size: 12px;font-variant-numeric: tabular-nums}
.ui-rvcc__count-add{color: var(--ui-rvcc-diff-add-fg)}
.ui-rvcc__count-del{color: var(--ui-rvcc-diff-del-fg)}
.ui-rvcc__diff{padding: 8px 0 2px;overflow-x: auto;border-top: 0.5px solid var(--ui-rvcc-line);font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;font-size: 13px;font-weight: 400;line-height: 20px;letter-spacing: normal;white-space: pre;scrollbar-width: thin}
.ui-rvcc__line{display: flex;min-width: max-content;color: var(--ui-rvcc-code-ink)}
.ui-rvcc__line[data-diff="add"]{background: var(--ui-rvcc-diff-add)}
.ui-rvcc__line[data-diff="del"]{background: var(--ui-rvcc-diff-del)}
.ui-rvcc__ln{position: relative;flex: none;min-width: calc(2ch + 23.4px);padding: 0 7.8px 0 15.6px;color: var(--ui-rvcc-code-num);text-align: right;font-variant-numeric: tabular-nums;user-select: none}
.ui-rvcc__sign{position: absolute;left: 4px;font-size: 11px}
.ui-rvcc__line[data-diff="add"] .ui-rvcc__sign{color: var(--ui-rvcc-diff-add-fg)}
.ui-rvcc__line[data-diff="del"] .ui-rvcc__sign{color: var(--ui-rvcc-diff-del-fg)}
.ui-rvcc__src{padding: 0 7.8px}
.ui-rvcc__hunk{display: block;padding: 0 7.8px 0 calc(2ch + 31.2px);color: var(--ui-rvcc-code-num)}
.ui-rvcc [data-tok="kw"]{color: var(--ui-rvcc-tok-kw)}
.ui-rvcc [data-tok="str"]{color: var(--ui-rvcc-tok-str)}
.ui-rvcc [data-tok="fn"]{color: var(--ui-rvcc-tok-fn)}
.ui-rvcc [data-tok="type"]{color: var(--ui-rvcc-tok-type)}
.ui-rvcc [data-tok="com"]{color: var(--ui-rvcc-code-num)}
.ui-rvcc__line .ui-rvcc__flag{padding: 1px 1px;margin: 0}
.ui-rvcc__line .ui-rvcc__flag [data-tok]{color: inherit}
.ui-rvcc__steps{display: grid;gap: 12px;list-style: none}
.ui-rvcc__step{display: grid;grid-template-columns: 22px minmax(0, 1fr);column-gap: 12px}
.ui-rvcc__step-n{display: grid;place-items: center;width: 22px;height: 22px;border-radius: 50%;box-shadow: inset 0 0 0 0.5px var(--ui-rvcc-line-strong);font-size: 11.5px;font-weight: 500;color: var(--ui-rvcc-muted);font-variant-numeric: tabular-nums}
.ui-rvcc__step[data-flagged] .ui-rvcc__step-n{background: var(--ui-rvcc-flag-bg);box-shadow: inset 0 0 0 0.5px var(--ui-rvcc-flag-edge);color: var(--ui-rvcc-flag-ink)}
.ui-rvcc__step-main{display: flex;flex-wrap: wrap;align-items: baseline;gap: 2px 10px;min-width: 0;padding-top: 1px}
.ui-rvcc__step-title{font-size: 13px;line-height: 20px;color: var(--ui-rvcc-ink)}
.ui-rvcc__step-tool{display: inline-flex;align-items: center;gap: 5px;font-size: 12px;line-height: 20px;color: var(--ui-rvcc-muted);white-space: nowrap}
.ui-rvcc__step-detail{width: 100%;font-size: 12.5px;line-height: 19px;color: var(--ui-rvcc-muted)}
.ui-rvcc__flag{padding: 1px 2px;margin: 0 -1px;border-radius: 3px;background: var(--ui-rvcc-flag-bg);box-shadow: inset 0 -1px 0 var(--ui-rvcc-flag-edge);color: var(--ui-rvcc-flag-ink);cursor: help;-webkit-box-decoration-break: clone;box-decoration-break: clone;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-rvcc__flag:is(:hover, [data-on]){background: var(--ui-rvcc-flag-hot);box-shadow: inset 0 0 0 0.5px var(--ui-rvcc-flag-edge)}
.ui-rvcc__ins{padding: 1px 2px;margin: 0 -1px;border-radius: 3px;background: var(--ui-rvcc-ins-bg);color: var(--ui-rvcc-ins-ink);text-decoration: none;-webkit-box-decoration-break: clone;box-decoration-break: clone}
.ui-rvcc__editor{display: grid;margin: -6px -8px;border-radius: 8px;box-shadow: inset 0 0 0 1px var(--ui-rvcc-accent), 0 0 0 3px var(--ui-rvcc-ring-soft)}
.ui-rvcc__editor > *{grid-area: 1 / 1;padding: 6px 8px;font-size: 13px;line-height: 22px;white-space: pre-wrap;overflow-wrap: anywhere}
.ui-rvcc__body[data-format="code"] .ui-rvcc__editor > *{font-family: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;font-size: 12px;line-height: 20px;letter-spacing: 0}
.ui-rvcc__mirror{color: transparent}
.ui-rvcc__mirror .ui-rvcc__ins{padding: 0;margin: 0;color: transparent;box-shadow: 0 0 0 2px var(--ui-rvcc-ins-bg)}
.ui-rvcc__editor textarea{width: 100%;height: 100%;overflow: hidden;resize: none;color: var(--ui-rvcc-ink);caret-color: var(--ui-rvcc-accent);outline: none}
.ui-rvcc__editor textarea:focus-visible{outline: none}
.ui-rvcc__input{width: 100%;min-width: 120px;height: 24px;margin: 0 -6px;padding: 0 6px;border-radius: 5px;background: var(--ui-rvcc-wash);box-shadow: inset 0 0 0 1px var(--ui-rvcc-line);font-weight: 500;color: var(--ui-rvcc-ink);outline: none}
.ui-rvcc__input:focus{box-shadow: inset 0 0 0 1px var(--ui-rvcc-accent)}
.ui-rvcc__foot{display: flex;flex-wrap: wrap;align-items: center;justify-content: space-between;gap: 10px 16px}
.ui-rvcc__sources{display: flex;flex-wrap: wrap;gap: 4px 14px;min-width: 0;list-style: none}
.ui-rvcc__source{display: inline-flex;align-items: center;gap: 6px;font-size: 12px;line-height: 20px;color: var(--ui-rvcc-muted);white-space: nowrap;text-decoration: none;transition: color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
a.ui-rvcc__source:hover{color: var(--ui-rvcc-ink)}
.ui-rvcc__source-icon{display: grid;place-items: center;width: 14px;height: 14px;color: var(--ui-rvcc-muted)}
.ui-rvcc__source-icon > svg{width: 12px;height: 12px}
.ui-rvcc__empty{display: grid;place-content: center;justify-items: center;gap: 2px;min-height: 100%;padding: 48px 24px;text-align: center;animation: ui-rvcc-in var(--nm-dur-4, 380ms) var(--ui-rvcc-ease) 120ms backwards}
.ui-rvcc__empty[data-after]{animation-delay: calc(var(--d) + 120ms)}
.ui-rvcc__empty-mark{display: grid;place-items: center;width: 40px;height: 40px;margin-bottom: 10px;border-radius: 10px;background: var(--ui-rvcc-card);color: var(--ui-rvcc-low-fg);box-shadow: var(--ui-rvcc-shadow), 0 0 0 4px var(--ui-rvcc-low-bg)}
.ui-rvcc__empty b{font-size: 15px;font-weight: 500;line-height: 24px;color: var(--ui-rvcc-strong)}
.ui-rvcc__empty > span:last-child{max-width: 280px;font-size: 13px;line-height: 20px;color: var(--ui-rvcc-muted);text-wrap: balance}
.ui-rvcc__tip{position: absolute;top: 0;left: 0;z-index: 6;display: grid;gap: 2px;width: min(300px, calc(100% - 20px));padding: 10px 12px;border-radius: 10px;background: var(--ui-rvcc-card);box-shadow: var(--ui-rvcc-pop);pointer-events: none;transform-origin: var(--x, 50%) bottom;animation: ui-rvcc-tip var(--nm-dur-2, 160ms) var(--ui-rvcc-ease) both}
.ui-rvcc__tip[data-side="below"]{transform-origin: var(--x, 50%) top}
.ui-rvcc__tip-head{display: inline-flex;align-items: center;gap: 6px;font-size: 10px;font-weight: 500;line-height: 16px;letter-spacing: 0.5px;text-transform: uppercase;color: var(--ui-rvcc-mid-fg)}
.ui-rvcc__tip-head > svg{width: 12px;height: 12px}
.ui-rvcc__tip p{font-size: 13px;line-height: 20px;color: var(--ui-rvcc-ink);text-wrap: pretty}
.ui-rvcc__tip-source{justify-self: start;margin-top: 4px;padding: 0 6px;border-radius: 5px;background: var(--ui-rvcc-fill);font-size: 12px;line-height: 20px;color: var(--ui-rvcc-text)}
.ui-rvcc__actions{position: relative;display: flex;flex: none;align-items: center;gap: 12px;min-height: 52px;padding: 12px 16px;border-top: 0.5px solid var(--ui-rvcc-line);background: var(--ui-rvcc-card)}
.ui-rvcc__btns{display: flex;flex-wrap: wrap;align-items: center;gap: 8px;min-width: 0;animation: ui-rvcc-swap var(--nm-dur-3, 240ms) var(--ui-rvcc-ease) both}
.ui-rvcc__btn{display: inline-flex;align-items: center;gap: 6px;height: 28px;padding: 0 6px 0 6px;border-radius: 6px;background: var(--ui-rvcc-card);box-shadow: var(--ui-rvcc-shadow);font-size: 13px;font-weight: 500;color: var(--ui-rvcc-strong);white-space: nowrap;transition: transform var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-rvcc__btn > svg{color: rgba(11, 9, 8, 0.447)}
.ui-rvcc__btn > span{margin-right: 2px}
.ui-rvcc__btn:hover:not(:disabled){box-shadow: var(--ui-rvcc-raised)}
.ui-rvcc__btn[data-primary]{background: var(--ui-rvcc-primary);box-shadow: 0 1px 2px rgba(11, 9, 8, 0.16);color: var(--ui-rvcc-primary-fg)}
.ui-rvcc__btn[data-primary] > svg{color: inherit}
.ui-rvcc__btn[data-primary] .ui-rvcc__kbd{background: rgba(255, 253, 251, 0.16);color: rgba(255, 253, 251, 0.72)}
.ui-rvcc__btn[data-primary]:hover:not(:disabled){background: #0b0908}
.ui-rvcc__btn:disabled{opacity: 0.45}
:is(.ui-rvcc__btn, .ui-rvcc__reason, .ui-rvcc__undo-btn)[data-pressed]{transform: scale(0.97)}
.ui-rvcc__btn[data-pressed]{background: var(--k-bg, var(--ui-rvcc-wash));box-shadow: inset 0 0 0 0.5px var(--k-edge, var(--ui-rvcc-line));color: var(--k-fg, var(--ui-rvcc-strong))}
.ui-rvcc__btn[data-pressed] > svg{color: inherit}
.ui-rvcc__why-label{margin-right: 2px;font-size: 13px;font-weight: 500;color: var(--ui-rvcc-strong)}
.ui-rvcc__reason{display: inline-flex;align-items: center;gap: 6px;height: 28px;padding: 0 10px 0 6px;border-radius: 6px;background: var(--ui-rvcc-card);box-shadow: var(--ui-rvcc-shadow);font-size: 13px;font-weight: 500;color: var(--ui-rvcc-strong);white-space: nowrap;transition: transform var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-rvcc__reason:hover{box-shadow: inset 0 0 0 0.5px var(--ui-rvcc-high-edge), 0 1px 2px rgba(11, 9, 8, 0.05)}
.ui-rvcc__reason[data-pressed]{background: var(--ui-rvcc-high-bg);box-shadow: inset 0 0 0 0.5px var(--ui-rvcc-high-edge);color: var(--ui-rvcc-high-fg)}
.ui-rvcc__cancel{height: 28px;padding: 0 8px;border-radius: 6px;font-size: 12px;color: var(--ui-rvcc-muted)}
.ui-rvcc__cancel:hover{color: var(--ui-rvcc-ink)}
.ui-rvcc__undo{display: flex;flex: 0 1 auto;align-items: center;gap: 2px;min-width: 0;height: 28px;margin-left: auto;padding: 0 0 0 4px;border-radius: 6px;background: var(--ui-rvcc-card);animation: ui-rvcc-chip-in var(--nm-dur-4, 380ms) var(--ui-rvcc-ease) both, ui-rvcc-chip-out var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 5700ms forwards}
.ui-rvcc__undo-text{display: inline-flex;align-items: center;gap: 5px;min-width: 0;overflow: hidden;font-size: 12px;color: var(--ui-rvcc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-rvcc__undo-text > svg{width: 14px;height: 14px;color: var(--k-fg)}
.ui-rvcc__undo-btn{display: inline-flex;flex: none;align-items: center;gap: 5px;height: 24px;margin-left: 4px;padding: 0 4px 0 6px;border-radius: 5px;font-size: 12px;font-weight: 500;color: var(--ui-rvcc-strong);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-rvcc__undo-btn:hover{background: var(--ui-rvcc-card);box-shadow: var(--ui-rvcc-shadow)}
.ui-rvcc__undo-btn > svg{color: rgba(11, 9, 8, 0.447)}
@container ui-rvcc (max-width: 820px){.ui-rvcc__card{--ui-rvcc-queue: 268px}
.ui-rvcc__detail{padding: 18px 20px 20px}
}
@container ui-rvcc (max-width: 740px){.ui-rvcc__btn .ui-rvcc__kbd{display: none}
.ui-rvcc__btn{padding-right: 10px}
.ui-rvcc__filter-count{font-size: 11.5px;color: var(--ui-rvcc-faint);font-variant-numeric: tabular-nums}
}
@container ui-rvcc (max-width: 639px){.ui-rvcc__head{padding: 10px 10px 10px 14px}
.ui-rvcc__oldest{margin-left: auto;padding-right: 4px}
.ui-rvcc__oldest::before{content: none}
.ui-rvcc__progress{order: 5;width: 100%;padding-right: 4px}
.ui-rvcc__progress .ui-rvcc__track{flex: 1}
.ui-rvcc__filter-count{font-size: 11.5px;color: var(--ui-rvcc-faint);font-variant-numeric: tabular-nums}
.ui-rvcc__undo{position: absolute;top: auto;right: 10px;bottom: 8px;z-index: 2;max-width: calc(100% - 20px)}
.ui-rvcc__card{display: flex;flex-direction: column;height: auto}
.ui-rvcc__queue{border-right: 0;border-bottom: 0.5px solid var(--ui-rvcc-line)}
.ui-rvcc__list{flex: none;height: calc(3 * (var(--ui-rvcc-row) + 2px) + 16px)}
.ui-rvcc__stage{flex: none;overflow: hidden}
.ui-rvcc__detail{gap: 14px;padding: 16px 14px 18px}
.ui-rvcc__actions{flex-wrap: wrap;padding: 10px 12px 12px}
.ui-rvcc__btns{flex: 1;flex-wrap: nowrap}
.ui-rvcc__btns > .ui-rvcc__btn{flex: 1;justify-content: center;padding: 0 8px}
.ui-rvcc__btns[role="group"]{flex-wrap: wrap}
.ui-rvcc__reason{flex: 1 1 40%;justify-content: center}
.ui-rvcc__why-label{width: 100%}
.ui-rvcc__empty{min-height: 220px;padding: 36px 20px}
}
@container ui-rvcc (max-width: 420px){.ui-rvcc__btn > svg{display: none}
.ui-rvcc__filter{gap: 4px}
.ui-rvcc__undo-btn .ui-rvcc__kbd{display: none}
.ui-rvcc__sources{width: 100%}
}
@container ui-rvcc (max-width: 360px){.ui-rvcc__filter-count{font-size: 11.5px;color: var(--ui-rvcc-faint);font-variant-numeric: tabular-nums}
}
@keyframes ui-rvcc-row-in{from{opacity: 0;transform: translateY(6px)}
}
@keyframes ui-rvcc-open{from{height: 0;padding: 0;opacity: 0}
}
@keyframes ui-rvcc-close{from{height: calc(var(--ui-rvcc-row) + 2px)}
to{height: 0;padding: 0;opacity: 0}
}
@keyframes ui-rvcc-arrive{0%, 40%{background: var(--ui-rvcc-new)}
}
@keyframes ui-rvcc-fade{from{opacity: 0}
}
@keyframes ui-rvcc-in{from{opacity: 0;transform: translateY(8px)}
}
@keyframes ui-rvcc-in-up{from{opacity: 0;transform: translateY(-8px)}
}
@keyframes ui-rvcc-away{to{opacity: 0;transform: translateY(-6px)}
}
@keyframes ui-rvcc-tip{from{opacity: 0;transform: translateY(4px) scale(0.96)}
}
@keyframes ui-rvcc-swap{from{opacity: 0;transform: translateY(6px)}
}
@keyframes ui-rvcc-chip-in{from{opacity: 0;transform: translateX(8px)}
}
@keyframes ui-rvcc-chip-out{to{opacity: 0;transform: translateX(6px)}
}
@keyframes ui-rvcc-tick{from{opacity: 0;transform: translateY(-6px)}
}
@keyframes ui-rvcc-sweep{to{background-position: calc(100% + 40px) 0}
}
@keyframes ui-rvcc-glow{from{opacity: 0.25}
to{opacity: 0.7}
}
@media (pointer: coarse){.ui-rvcc .ui-rvcc__kbd{display: none}
.ui-rvcc__btn{padding-right: 10px}
}
@media (prefers-reduced-motion: reduce){.ui-rvcc *, .ui-rvcc *::before, .ui-rvcc *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-rvcc{--ui-rvcc-card: #211b16;--ui-rvcc-strong: #fffdfb;--ui-rvcc-ink: rgba(255, 253, 251, 0.9);--ui-rvcc-text: rgba(255, 253, 251, 0.62);--ui-rvcc-muted: rgba(255, 253, 251, 0.45);--ui-rvcc-faint: rgba(255, 253, 251, 0.28);--ui-rvcc-line: rgba(255, 253, 251, 0.08);--ui-rvcc-queue-bg: rgba(255, 253, 251, 0.015);--ui-rvcc-line-strong: rgba(255, 253, 251, 0.16);--ui-rvcc-code-ink: rgba(255, 253, 251, 0.88);--ui-rvcc-code-num: rgba(255, 253, 251, 0.42);--ui-rvcc-diff-add: rgba(47, 141, 92, 0.07);--ui-rvcc-diff-del: rgba(226, 84, 74, 0.07);--ui-rvcc-diff-add-fg: #4f9d6e;--ui-rvcc-diff-del-fg: #e2544a;--ui-rvcc-tok-kw: color(display-p3 0.98 0.52 0.68);--ui-rvcc-tok-str: color(display-p3 0.56 0.82 0.54);--ui-rvcc-tok-type: color(display-p3 0.48 0.7 1);--ui-rvcc-tok-fn: color(display-p3 0.78 0.56 0.88);--ui-rvcc-ring-soft: rgba(255, 138, 92, 0.16);--ui-rvcc-hover: rgba(255, 253, 251, 0.03);--ui-rvcc-fill: rgba(255, 253, 251, 0.08);--ui-rvcc-wash: rgba(255, 253, 251, 0.03);--ui-rvcc-accent: #ff8a5c;--ui-rvcc-new: rgba(255, 138, 92, 0.1);--ui-rvcc-primary: rgba(255, 253, 251, 0.92);--ui-rvcc-primary-fg: #181310;--ui-rvcc-bar-bg: rgba(255, 138, 92, 0.16);--ui-rvcc-bar-edge: rgba(255, 138, 92, 0.42);--ui-rvcc-bar-mark: rgba(255, 138, 92, 0.85);--ui-rvcc-track: rgba(255, 253, 251, 0.07);--ui-rvcc-high-bg: #e2544a2b;--ui-rvcc-high-edge: rgba(226, 84, 74, 0.4);--ui-rvcc-high-fg: #e2544a;--ui-rvcc-mid-bg: #ff6b3525;--ui-rvcc-mid-edge: rgba(255, 107, 53, 0.42);--ui-rvcc-mid-fg: #ff8a5c;--ui-rvcc-low-bg: #2f8d5c1f;--ui-rvcc-low-edge: rgba(47, 141, 92, 0.36);--ui-rvcc-low-fg: #2f8d5c;--ui-rvcc-flag-bg: rgba(232, 176, 92, 0.16);--ui-rvcc-flag-edge: rgba(232, 176, 92, 0.55);--ui-rvcc-flag-hot: rgba(232, 176, 92, 0.28);--ui-rvcc-flag-ink: #f2d19a;--ui-rvcc-ins-bg: rgba(47, 141, 92, 0.18);--ui-rvcc-ins-ink: #4f9d6e;--ui-rvcc-add-bg: rgba(47, 141, 92, 0.07);--ui-rvcc-del-bg: rgba(226, 84, 74, 0.08);--ui-rvcc-focus: rgba(255, 138, 92, 0.45);--ui-rvcc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-rvcc-raised: 0 0 0 0.5px rgba(255, 253, 251, 0.16), 0 1px 3px 0 rgba(11, 9, 8, 0.5);--ui-rvcc-pop: 0 0 0 0.5px rgba(255, 253, 251, 0.12), 0 12px 28px -10px rgba(11, 9, 8, 0.6)}
:where(.dark, [data-theme="dark"]) .ui-rvcc__row[aria-current]{background: rgba(255, 253, 251, 0.06)}
:where(.dark, [data-theme="dark"]) :is(.ui-rvcc__btn, .ui-rvcc__undo-btn, :where(.dark, [data-theme="dark"]) .ui-rvcc__btn[data-primary] > svg{color: inherit}
:where(.dark, [data-theme="dark"]) .ui-rvcc__btn[data-primary] .ui-rvcc__kbd{background: rgba(11, 9, 8, 0.1);color: rgba(11, 9, 8, 0.55)}
:where(.dark, [data-theme="dark"]) .ui-rvcc__btn[data-primary]:hover:not(:disabled){background: #fffdfb}
:where(.dark, [data-theme="dark"]) .ui-rvcc__btn:is(:not([data-primary])), :where(.dark, [data-theme="dark"]) :is(.ui-rvcc__reason){background: #29221b}

`;
