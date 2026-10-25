"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

/*
 * Agent Run – one autonomous run, in a single self-contained file.
 * The plan ticks through its steps on its own while the activity feed grows: each step opens a
 * group of tool calls with their arguments and results, the finished ones folding shut, and a
 * loader pill carries the step that is working. The fourth step is a high-risk send, so the run
 * halts there and asks; approving resumes it, denying or Stop run ends it. The side panel holds
 * the run's numbers and the memo the agent drafted as an inline word diff – nine suggestions,
 * each accepted or rejected on its own, with Y and N on the keyboard.
 */

export type RunRisk = "low" | "medium" | "high";

export type RunToolCall = {
  /** Tool name, e.g. "stripe.query" */
  name: string;
  /** One line on what the call did */
  summary: string;
  /** How long the call takes, in milliseconds */
  ms: number;
  /** Request payload, shown when the call is open */
  args?: unknown;
  /** Response payload; absent while the call is still running */
  result?: unknown;
};

export type RunApproval = {
  /** What the run is about to do */
  title: string;
  /** Why it needs a person */
  description: string;
  /** How much it matters; the panel always spells the word out */
  risk: RunRisk;
  /** Concrete facts to check before saying yes */
  facts: { label: string; value: string }[];
};

export type RunStep = {
  /** Stable id – timers and announcements follow this, not the index */
  id: string;
  /** Row title */
  name: string;
  /** Second line under the title */
  detail?: string;
  /** Tool named on the plan row */
  tool?: string;
  /** Calls made during the step, in order */
  calls: RunToolCall[];
  /** Gate before the step runs; the run waits here for a person */
  approval?: RunApproval;
};

export type RunChange = {
  /** Stable id */
  id: string;
  /** Text the agent removed, spaces included */
  from?: string;
  /** Text the agent inserted, spaces included */
  to?: string;
};

export type RunDraft = {
  /** Label above the card, e.g. the document and section */
  label: string;
  /** The document in order: plain text runs and suggestions */
  segments: (string | RunChange)[];
};

export type AgentRunProps = {
  /** Run title, shown in the header and on the plan */
  title?: string;
  /** Agent that owns the run */
  agent?: string;
  /** Who started it */
  triggeredBy?: string;
  /** Plan steps, in order */
  steps?: RunStep[];
  /** The draft the run wrote, with its suggestions */
  draft?: RunDraft;
  /** Price of the run, shown in Details */
  cost?: string;
  /** Called with the approval that is waiting, when it is granted */
  onApprove?: (approval: RunApproval) => void;
  /** Called when the waiting approval is denied; the run stops there */
  onDeny?: (approval: RunApproval) => void;
  /** Called when Stop run is pressed */
  onStop?: () => void;
  /** Called once, when the run works through every step on its own */
  onDone?: () => void;
  /** Extra class on the root */
  className?: string;
};

type Phase = "running" | "waiting" | "done" | "stopped";

type ChangeState = "pending" | "accepted" | "rejected";

/** A breath between two steps, so the plan reads as a sequence rather than one block. */
const BEAT_MS = 320;
const TICK_MS = 100;

const DEFAULT_STEPS: RunStep[] = [
  {
    id: "revenue",
    name: "Pull Q3 revenue and churn",
    detail: "From Stripe, July to September",
    tool: "stripe.query",
    calls: [
      {
        name: "stripe.query",
        summary: "Revenue by month, Q3",
        ms: 700,
        args: { metric: "revenue", from: "2026-07-01", to: "2026-09-30", group_by: "month" },
        result: { total: 4310000, months: [1380000, 1420000, 1510000], growth: 0.21 },
      },
      {
        name: "stripe.query",
        summary: "Customer churn, Q3",
        ms: 1200,
        args: { metric: "churn_rate", period: "quarter" },
        result: { churn_rate: 0.018, customers: 412, lost: 7 },
      },
    ],
  },
  {
    id: "memo",
    name: "Read last quarter's board memo",
    detail: "Keeps the structure the board knows",
    tool: "search",
    calls: [
      {
        name: "search",
        summary: "Board memo, Q2",
        ms: 800,
        args: { query: "board memo Q2", space: "Board prep" },
        result: { matches: 1, doc: "Board memo – Q2", pages: 2 },
      },
      {
        name: "search",
        summary: "Board deck outline, Q2",
        ms: 1500,
        args: { query: "board deck outline", space: "Board prep" },
        result: { matches: 3, doc: "Q2 board deck", slides: 14 },
      },
    ],
  },
  {
    id: "draft",
    name: "Update the memo draft",
    detail: "Revenue, churn and the Q4 outlook",
    tool: "docs.write",
    calls: [
      {
        name: "docs.write",
        summary: "Open the memo template",
        ms: 400,
        args: { doc: "Board memo – Q3", block: "revenue" },
        result: { blocks: 4, words: 96 },
      },
      {
        name: "docs.write",
        summary: "Rewrite the revenue paragraph",
        ms: 900,
        args: { doc: "Board memo – Q3", mode: "rewrite", voice: "plain" },
        result: { edits: 9, accepted: 0 },
      },
    ],
  },
  {
    id: "send",
    name: "Send the draft to Maya",
    detail: "Needs your approval first",
    tool: "gmail.send",
    calls: [
      {
        name: "gmail.send",
        summary: "Board memo – Q3 → Maya Chen",
        ms: 600,
        args: { to: "maya@acme.com", subject: "Board memo – Q3", attach: "Board memo – Q3" },
        result: { message_id: "1a2b9c", thread: "Q3 board" },
      },
    ],
    approval: {
      title: "Send the draft to Maya Chen",
      description: "The agent will email the finished memo from your account.",
      risk: "high",
      facts: [
        { label: "To", value: "maya@acme.com" },
        { label: "Subject", value: "Board memo – Q3" },
        { label: "Leaves your account", value: "Yes" },
      ],
    },
  },
  {
    id: "review",
    name: "Book a review with Maya",
    detail: "30 minutes before the board meeting",
    tool: "calendar.create",
    calls: [
      {
        name: "calendar.create",
        summary: "Board review · 30 min",
        ms: 700,
        args: { with: "maya@acme.com", length: 30, before: "board meeting" },
        result: { event: "Board review", start: "2026-10-27T08:30" },
      },
    ],
  },
];

const DEFAULT_DRAFT: RunDraft = {
  label: "Board memo – Q3 · Revenue",
  segments: [
    "Revenue grew ",
    { id: "s1", from: "18", to: "21" },
    "% in Q3 to $4.",
    { id: "s2", from: "2M", to: "3M" },
    ", ",
    { id: "s3", from: "mostly " },
    "driven by ",
    { id: "s4", to: "six " },
    "new enterprise customers. Churn ",
    { id: "s5", from: "stayed flat at 2.", to: "fell to " },
    "1",
    { id: "s6", to: ".8" },
    "%, and ",
    { id: "s7", from: "we expect " },
    "the pipeline ",
    { id: "s8", from: "to carry into", to: "supports raising the" },
    " Q4 ",
    { id: "s9", from: "without changes to the plan", to: "target by 5%" },
    ".",
  ],
};

type ScheduledCall = { call: RunToolCall; start: number; end: number };
type ScheduledStep = { step: RunStep; start: number; end: number; calls: ScheduledCall[] };

/** The whole run as one flat clock: each step and call gets a start and an end. */
function schedule(steps: RunStep[]): ScheduledStep[] {
  let at = 0;
  return steps.map((step) => {
    const start = at;
    const calls = step.calls.map((call) => {
      const callStart = at;
      at += call.ms;
      return { call, start: callStart, end: at };
    });
    const end = at;
    at += BEAT_MS;
    return { step, start, end, calls };
  });
}

/** "700ms" under a second, "1.2s" above it. */
function shortMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

/** Plan rows always speak in tenths of a second. */
function planMs(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
}

function clockOf(date: Date): string {
  const hours = date.getHours();
  const hour = ((hours + 11) % 12) + 1;
  return `${hour}:${String(date.getMinutes()).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}

function stampOf(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** "Suggestion 4 of 9: add “six”. Press Y to accept, N to reject" */
function changeLabel(change: RunChange, index: number, count: number): string {
  const verb = change.from && change.to ? "replace" : change.to ? "add" : "remove";
  const quotedFrom = `\u201c${(change.from ?? "").trim()}\u201d`;
  const quotedTo = `\u201c${(change.to ?? "").trim()}\u201d`;
  const body =
    verb === "replace"
      ? `${verb} ${quotedFrom} with ${quotedTo}`
      : verb === "add"
        ? `${verb} ${quotedTo}`
        : `${verb} ${quotedFrom}`;
  return `Suggestion ${index + 1} of ${count}: ${body}. Press Y to accept, N to reject`;
}

/** JSON as spans the tool-call sheet colours, with the punctuation left as plain text. */
function jsonTokens(value: unknown): ReactNode[] {
  const text = JSON.stringify(value, null, 2);
  if (typeof text !== "string") return [];
  const out: ReactNode[] = [];
  const token = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;
  let last = 0;
  let index = 0;
  let match = token.exec(text);
  while (match) {
    if (match.index > last) out.push(text.slice(last, match.index));
    if (match[1]) {
      if (match[2]) {
        out.push(
          <span key={index++} className="ui-tc__t-key">
            {match[1]}
          </span>,
        );
        out.push(":");
      } else {
        out.push(
          <span key={index++} className="ui-tc__t-str">
            {match[1]}
          </span>,
        );
      }
    } else if (match[3]) {
      out.push(
        <span key={index++} className="ui-tc__t-num">
          {match[3]}
        </span>,
      );
    } else if (match[4]) {
      out.push(
        <span key={index++} className="ui-tc__t-lit">
          {match[4]}
        </span>,
      );
    }
    last = token.lastIndex;
    match = token.exec(text);
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const PHASE_LABEL: Record<Phase, string> = {
  running: "Running",
  waiting: "Needs approval",
  done: "Done",
  stopped: "Stopped",
};

export function AgentRunScreen({
  title = "Prepare the Q3 board update",
  agent = "Board prep",
  triggeredBy = "Alex Morgan",
  steps = DEFAULT_STEPS,
  draft = DEFAULT_DRAFT,
  cost = "$0.14",
  onApprove,
  onDeny,
  onStop,
  onDone,
  className,
}: AgentRunProps) {
  const base = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const approveRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef(onDone);
  const firedRef = useRef(false);

  const [narrow, setNarrow] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [newsVisible, setNewsVisible] = useState(true);

  const [startedAt] = useState(() => new Date());
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<Phase>("running");
  const [answers, setAnswers] = useState<Record<string, "approved" | "denied">>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [openCalls, setOpenCalls] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [reviewFocus, setReviewFocus] = useState(false);

  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  const plan = useMemo(() => schedule(steps), [steps]);
  const totalMs = plan.length ? plan[plan.length - 1].end : 0;
  const totalCalls = useMemo(() => steps.reduce((sum, step) => sum + step.calls.length, 0), [steps]);

  const changes = useMemo(
    () => draft.segments.filter((segment): segment is RunChange => typeof segment !== "string"),
    [draft],
  );
  const [changeStates, setChangeStates] = useState<Record<string, ChangeState>>(() => {
    const initial: Record<string, ChangeState> = {};
    for (const change of changes) initial[change.id] = "pending";
    return initial;
  });
  const [activeChange, setActiveChange] = useState<string | null>(null);
  const [popPos, setPopPos] = useState<{ left: number; top: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const changeRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  /* The shell's own width decides whether the sidebar folds to a rail or slides over the page. */
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setNarrow(width <= 900);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* One clock for the whole run; it stops whenever the run is not running. */
  useEffect(() => {
    if (phase !== "running") return;
    const timer = window.setInterval(() => {
      setElapsed((value) => Math.min(value + TICK_MS, totalMs));
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [phase, totalMs]);

  /* An unanswered approval stops the clock on the step that needs it. */
  useEffect(() => {
    if (phase !== "running") return;
    const gate = plan.find(
      (entry) => entry.step.approval && !answers[entry.step.id] && elapsed >= entry.start,
    );
    if (!gate) return;
    setElapsed(gate.start);
    setPhase("waiting");
  }, [elapsed, phase, plan, answers]);

  useEffect(() => {
    if (phase !== "running" || elapsed < totalMs) return;
    setPhase("done");
    if (firedRef.current) return;
    firedRef.current = true;
    doneRef.current?.();
  }, [elapsed, phase, totalMs]);

  useEffect(() => {
    if (!reviewFocus || !panelOpen) return;
    approveRef.current?.focus();
    setReviewFocus(false);
  }, [reviewFocus, panelOpen]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const gate = useMemo(
    () =>
      plan.find((entry) => entry.step.approval && !answers[entry.step.id] && elapsed >= entry.start) ??
      null,
    [plan, answers, elapsed],
  );

  const answeredGate = useMemo(() => {
    for (const entry of plan) {
      if (!entry.step.approval) continue;
      const answer = answers[entry.step.id];
      if (answer && elapsed >= entry.start) return { entry, answer };
    }
    return null;
  }, [plan, answers, elapsed]);

  const finishedSteps = plan.filter((entry) => elapsed >= entry.end).length;
  const waitingIndex = gate ? plan.indexOf(gate) : -1;

  const stopRun = () => {
    if (phase === "done" || phase === "stopped") return;
    setPhase("stopped");
    onStop?.();
  };

  const restartRun = () => {
    setElapsed(0);
    setAnswers({});
    setPhase("running");
    setOpenCalls({});
    setOpenGroups({});
    setChangeStates(() => {
      const initial: Record<string, ChangeState> = {};
      for (const change of changes) initial[change.id] = "pending";
      return initial;
    });
    setActiveChange(null);
    setAnnouncement("");
    firedRef.current = false;
  };

  const approve = () => {
    if (!gate || !gate.step.approval) return;
    const id = gate.step.id;
    setAnswers((all) => {
      const next = { ...all };
      next[id] = "approved";
      return next;
    });
    setPhase("running");
    onApprove?.(gate.step.approval);
  };

  const deny = () => {
    if (!gate || !gate.step.approval) return;
    const id = gate.step.id;
    setAnswers((all) => {
      const next = { ...all };
      next[id] = "denied";
      return next;
    });
    setPhase("stopped");
    onDeny?.(gate.step.approval);
  };

  const reviewApproval = () => {
    setPanelOpen(true);
    setReviewFocus(true);
  };

  const pendingChangeIds = changes
    .filter((change) => changeStates[change.id] === "pending")
    .map((change) => change.id);
  const draftDone = pendingChangeIds.length === 0;

  const resolveChange = (id: string, state: ChangeState) => {
    setChangeStates((all) => {
      if (all[id] !== "pending") return all;
      const next = { ...all };
      next[id] = state;
      return next;
    });
    setActiveChange((current) => (current === id ? null : current));
    const index = changes.findIndex((change) => change.id === id);
    if (index !== -1) {
      setAnnouncement(`Suggestion ${index + 1} ${state === "accepted" ? "accepted" : "rejected"}.`);
    }
  };

  const resolveAll = (state: ChangeState) => {
    setChangeStates((all) => {
      const next: Record<string, ChangeState> = { ...all };
      for (const change of changes) if (next[change.id] === "pending") next[change.id] = state;
      return next;
    });
    setActiveChange(null);
    setAnnouncement(state === "accepted" ? "All suggestions accepted." : "All suggestions rejected.");
  };

  const undoChanges = () => {
    setChangeStates(() => {
      const initial: Record<string, ChangeState> = {};
      for (const change of changes) initial[change.id] = "pending";
      return initial;
    });
    setActiveChange(null);
    setAnnouncement("All suggestions are back to pending.");
  };

  const moveChange = (direction: 1 | -1) => {
    if (pendingChangeIds.length === 0) return;
    const current = activeChange ? pendingChangeIds.indexOf(activeChange) : -1;
    const nextIndex =
      current === -1
        ? direction === 1
          ? 0
          : pendingChangeIds.length - 1
        : (current + direction + pendingChangeIds.length) % pendingChangeIds.length;
    const id = pendingChangeIds[nextIndex];
    setActiveChange(id);
    const node = changeRefs.current[id];
    node?.scrollIntoView({ block: "center" });
    node?.focus({ preventScroll: true });
  };

  const onChangeKey = (event: ReactKeyboardEvent<HTMLSpanElement>, id: string) => {
    const key = event.key;
    if (key === "y" || key === "Y") {
      event.preventDefault();
      resolveChange(id, "accepted");
    } else if (key === "n" || key === "N") {
      event.preventDefault();
      resolveChange(id, "rejected");
    } else if (key === "ArrowRight") {
      event.preventDefault();
      moveChange(1);
    } else if (key === "ArrowLeft") {
      event.preventDefault();
      moveChange(-1);
    } else if (key === "Enter" || key === " ") {
      event.preventDefault();
      setActiveChange(id);
    }
  };

  /* The review popover follows the suggestion it belongs to, clamped inside the card. */
  useLayoutEffect(() => {
    if (!activeChange) {
      setPopPos(null);
      return;
    }
    const target = changeRefs.current[activeChange];
    const card = cardRef.current;
    const pop = popRef.current;
    if (!target || !card || !pop) return;
    const box = target.getBoundingClientRect();
    const frame = card.getBoundingClientRect();
    const width = pop.offsetWidth;
    const height = pop.offsetHeight;
    const left = Math.min(
      Math.max(8, box.left - frame.left + box.width / 2 - width / 2),
      Math.max(8, frame.width - width - 8),
    );
    setPopPos({ left, top: Math.max(4, box.top - frame.top - height - 6) });
  }, [activeChange, changeStates]);

  const copyText = async (key: string, text: string) => {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
    } catch {
      setCopied(null);
    }
  };

  const popOpen = activeChange !== null && changeStates[activeChange] === "pending";

  const openSide = () => {
    if (narrow) setDrawer(true);
    else setCollapsed(false);
  };

  const foldSide = () => {
    if (narrow) setDrawer(false);
    else setCollapsed(true);
  };

  const actionLabel = phase === "done" || phase === "stopped" ? "Run again" : "Stop run";
  const action = phase === "done" || phase === "stopped" ? restartRun : stopRun;

  const footLabel =
    phase === "waiting"
      ? `Waiting for approval · ${waitingIndex + 1} of ${steps.length}`
      : phase === "done"
        ? `Done · ${steps.length} of ${steps.length}`
        : phase === "stopped"
          ? `Stopped · ${finishedSteps} of ${steps.length}`
          : `Running · ${Math.min(finishedSteps + 1, steps.length)} of ${steps.length}`;

  const planStatus =
    phase === "waiting"
      ? "Waiting for approval"
      : phase === "done"
        ? "Plan complete"
        : phase === "stopped"
          ? "Run stopped"
          : "Running plan";

  const approvalForPanel = gate?.step.approval ?? answeredGate?.entry.step.approval ?? null;
  const approvalAnswer = answeredGate?.answer ?? null;
  const approvalEntry = approvalForPanel
    ? plan.find((entry) => entry.step.approval === approvalForPanel)
    : undefined;

  return (
    <div
      ref={rootRef}
      className={["ui-as ui-as-app", className].filter(Boolean).join(" ")}
      data-collapsed={!narrow && collapsed ? "true" : undefined}
      data-drawer={narrow && drawer ? "true" : undefined}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-agent-run" precedence="default">
        {css}
      </style>

      <button
        type="button"
        className="ui-as-icon-btn ui-as-side-open"
        aria-label="Open sidebar"
        tabIndex={-1}
        onClick={openSide}
      >
        <IconSidebar />
      </button>
      <div className="ui-as-scrim" aria-hidden="true" onClick={() => setDrawer(false)} />

      <aside className="ui-as-side">
        <header className="ui-as-side__head">
          <span className="ui-as-anchor">
            <button type="button" className="ui-as-side__workspace" aria-expanded="false">
              <span className="ui-as-side__logo">A</span>Acme
              <IconChevronDown />
            </button>
          </span>
          <span className="ui-as-side__tools">
            <button type="button" className="ui-as-icon-btn" aria-label="Search">
              <IconSearch />
            </button>
            <button
              type="button"
              className="ui-as-icon-btn"
              aria-label="Collapse sidebar"
              onClick={foldSide}
            >
              <IconSidebar />
            </button>
          </span>
        </header>

        <nav className="ui-as-side__nav" aria-label="Main menu">
          <div className="ui-as-side__group">
            <button type="button" className="ui-as-side__item">
              <IconHome />
              Home
            </button>
            <button type="button" className="ui-as-side__item">
              <IconChat />
              Chat
            </button>
            <button type="button" className="ui-as-side__item" aria-current="page">
              <IconRuns size={16} />
              Runs
              <span className="ui-as-side__count">3</span>
            </button>
            <button type="button" className="ui-as-side__item">
              <IconAnalytics />
              Analytics
            </button>
            <button type="button" className="ui-as-side__item">
              <IconDeliverables />
              Deliverables
            </button>
          </div>
          <div className="ui-as-side__group">
            <span className="ui-as-side__label">Agents</span>
            <button type="button" className="ui-as-side__item">
              <IconBoardPrep />
              Board prep
            </button>
            <button type="button" className="ui-as-side__item">
              <IconCurrency size={16} />
              Revenue ops
            </button>
            <button type="button" className="ui-as-side__item">
              <IconMail />
              Inbox triage
            </button>
            <button type="button" className="ui-as-side__item">
              <IconWorkflow />
              Workflows
            </button>
          </div>
        </nav>

        <div className="ui-as-side__foot">
          <div className="ui-as-news" data-count={newsVisible ? "2" : "1"}>
            {newsVisible && (
              <div className="ui-as-news__card ui-as-news__card--back" aria-hidden="true">
                <span className="ui-as-news__kicker">New in Acme</span>
                <IconClose />
              </div>
            )}
            <div className="ui-as-news__card">
              <div className="ui-as-news__top">
                <span className="ui-as-news__kicker">New in Acme</span>
                <button
                  type="button"
                  className="ui-as-news__close"
                  aria-label="Dismiss"
                  onClick={() => setNewsVisible(false)}
                >
                  <IconClose />
                </button>
              </div>
              <b className="ui-as-news__title">Shared folders</b>
              <button type="button" className="ui-as-news__more">
                Full changelog
                <IconChevronRight />
              </button>
            </div>
          </div>

          <div className="ui-as-guide-slot" style={{ height: "70px" }}>
            <div className="ui-as-guide" data-state="closed" style={{ height: "70px" }}>
              <div className="ui-as-guide__inner">
                <button type="button" className="ui-as-steps ui-as-guide__content" aria-expanded="false">
                  <span className="ui-as-steps__title">
                    Getting started
                    <IconChevronRight />
                  </span>
                  <span className="ui-as-steps__sub">
                    {"13% done · "}
                    <span className="ui-as-steps__cheer">Great start!</span>
                  </span>
                  <span className="ui-as-steps__bar">
                    <i style={{ width: "13%" }} />
                  </span>
                </button>
              </div>
            </div>
          </div>

          <span className="ui-as-anchor ui-as-user-menu">
            <button type="button" className="ui-as-user" aria-expanded="false">
              <span className="ui-as-user__initials">AM</span>Alex Morgan
              <IconChevronDown />
            </button>
          </span>
        </div>
      </aside>

      <main className="ui-as-main">
        <div className="ui-ar" data-panel={panelOpen ? "true" : undefined}>
          <section className="ui-ar__main">
            <header className="ui-ar__bar">
              <span className="ui-ar__crumbs">
                <IconRuns size={15} />
                {"Runs "}
                <i>/</i>
                {" "}
                <b>{title}</b>
                <span className="ui-ar__pill" data-phase={phase}>
                  <span aria-hidden="true" />
                  {PHASE_LABEL[phase]}
                </span>
              </span>
              <span className="ui-ar__tools">
                <span className="ui-ar__time">
                  <IconClock />
                  {`Started ${clockOf(startedAt)} · ${stampOf(elapsed)}`}
                </span>
                <button
                  type="button"
                  className="ui-button"
                  data-variant="secondary"
                  data-size="sm"
                  data-ready="true"
                  onClick={action}
                >
                  <span className="ui-button__icon" aria-hidden="true">
                    {phase === "done" || phase === "stopped" ? (
                      <IconRuns size={14} />
                    ) : (
                      <IconStop />
                    )}
                  </span>
                  <span className="ui-button__label" data-text={actionLabel}>
                    {actionLabel}
                  </span>
                </button>
                <span className="ui-as-anchor">
                  <button
                    type="button"
                    className="ui-as-icon-btn"
                    aria-label="Run options"
                    aria-expanded="false"
                  >
                    <IconDots />
                  </button>
                </span>
                <button
                  type="button"
                  className="ui-as-icon-btn"
                  aria-label={panelOpen ? "Hide side panel" : "Show side panel"}
                  aria-pressed={panelOpen ? "true" : "false"}
                  onClick={() => setPanelOpen((open) => !open)}
                >
                  <IconPanel />
                </button>
              </span>
            </header>

            <div className="ui-ar__scroll">
              <div className="ui-ar__column">
                <div className="ui-pl" data-status={phase}>
                  <div className="ui-pl__card">
                    <div className="ui-pl__head">
                      <div className="ui-pl__meta">
                        <span className="ui-pl__state">
                          <span className="ui-pl__state-icon" aria-hidden="true">
                            <IconPlanState />
                          </span>
                          <span className="ui-pl__state-label">{`Plan · ${steps.length} steps`}</span>
                        </span>
                      </div>
                      <h3 className="ui-pl__title">{title}</h3>
                    </div>
                    <p id={`${base}-hint`} className="ui-pl__sr">
                      Press Enter to rename, Alt plus arrow keys to move, Delete to remove.
                    </p>
                    <ol className="ui-pl__list" aria-label={`Plan: ${title}`}>
                      {plan.map((entry, index) => {
                        const started = elapsed >= entry.start;
                        const finished = elapsed >= entry.end;
                        const isActive = started && !finished;
                        const isWaitingStep = gate !== null && gate.step.id === entry.step.id;
                        const isLast = index === plan.length - 1;
                        const spoken =
                          finished
                            ? "Done"
                            : isWaitingStep && phase === "waiting"
                              ? "Waiting for approval"
                              : isActive
                                ? phase === "stopped"
                                  ? "Stopped before this step"
                                  : "In progress"
                                : "Pending";
                        return (
                          <li
                            key={entry.step.id}
                            className="ui-pl__step"
                            data-step={finished ? "done" : isActive ? "active" : "pending"}
                            aria-current={isActive && phase !== "stopped" ? "step" : undefined}
                          >
                            <span className="ui-pl__marker" aria-hidden="true">
                              {finished ? (
                                <svg className="ui-pl__mark" viewBox="0 0 16 16">
                                  <path d="M3.5 8.4 6.6 11.3 12.5 4.9" />
                                </svg>
                              ) : isActive && phase === "running" ? (
                                <Spinner className="ui-pl__spinner" />
                              ) : (
                                <span className="ui-pl__num">{index + 1}</span>
                              )}
                            </span>
                            <div className="ui-pl__main">
                              <span className="ui-pl__name">{entry.step.name}</span>
                              <span className="ui-pl__sub">
                                {entry.step.detail ? (
                                  <span className="ui-pl__detail">{entry.step.detail}</span>
                                ) : null}
                                {entry.step.tool ? (
                                  <code className="ui-pl__tool">{entry.step.tool}</code>
                                ) : null}
                              </span>
                              <span className="ui-pl__sr">{`, ${spoken}`}</span>
                            </div>
                            <span className="ui-pl__aside">
                              {isActive && phase === "running" ? (
                                <span className="ui-pl__time" aria-hidden="true">
                                  {planMs(elapsed - entry.start)}
                                </span>
                              ) : finished ? (
                                <span className="ui-pl__time" aria-hidden="true">
                                  {planMs(
                                    entry.calls.reduce((sum, call) => sum + call.call.ms, 0),
                                  )}
                                </span>
                              ) : null}
                            </span>
                            {isLast ? null : <span className="ui-pl__rail" aria-hidden="true" />}
                          </li>
                        );
                      })}
                    </ol>
                    <div className="ui-pl__tail" inert>
                      <div className="ui-pl__tail-inner">
                        <label className="ui-pl__add">
                          <span className="ui-pl__add-icon" aria-hidden="true">
                            <svg viewBox="0 0 16 16">
                              <path d="M8 4.5v7M4.5 8h7" />
                            </svg>
                          </span>
                          <input
                            placeholder="Add step"
                            aria-label="Add a step at the end"
                            enterKeyHint="done"
                            defaultValue=""
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="ui-pl__foot" data-phase={phase}>
                    <span className="ui-pl__status">
                      <span className="ui-pl__status-icon" aria-hidden="true">
                        {phase === "running" ? (
                          <Spinner className="ui-pl__spinner" />
                        ) : phase === "waiting" ? (
                          <svg viewBox="0 0 16 16">
                            <path d="M8 2.75v6.5M8 12.5v.5" />
                          </svg>
                        ) : phase === "done" ? (
                          <svg viewBox="0 0 16 16">
                            <path d="M3.5 8.4 6.6 11.3 12.5 4.9" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 16 16">
                            <rect x="5.25" y="5.25" width="5.5" height="5.5" rx="1" />
                          </svg>
                        )}
                      </span>
                      <span className="ui-pl__status-label">{footLabel}</span>
                    </span>
                    <span className="ui-pl__elapsed" aria-hidden="true">
                      {`${Math.round(elapsed / 1000)}s`}
                    </span>
                  </div>
                  <p className="ui-pl__sr" role="status" aria-live="polite">
                    {planStatus}
                  </p>
                </div>

                <div className="ui-ar__feed">
                  <span className="ui-ar__label">Activity</span>
                  {plan.map((entry, index) => {
                    if (elapsed < entry.start) return null;
                    const finished = elapsed >= entry.end;
                    const isActive = !finished;
                    const isGate = gate !== null && gate.step.id === entry.step.id;
                    const answer = answers[entry.step.id];
                    /* An approval gate holds the step's calls until someone answers it. */
                    const held = entry.step.approval !== undefined && !answer;
                    const visibleCalls = held
                      ? []
                      : entry.calls.filter((call) => elapsed >= call.start);
                    if (visibleCalls.length === 0 && !entry.step.approval) return null;
                    const groupKey = entry.step.id;
                    const groupOpen = openGroups[groupKey] ?? isActive;
                    const hasRunningCall = entry.calls.some(
                      (call) => elapsed >= call.start && elapsed < call.end,
                    );
                    const spent = finished
                      ? entry.end - entry.start
                      : Math.max(0, elapsed - entry.start);
                    const groupLabel = hasRunningCall
                      ? "Using tools…"
                      : `Used ${entry.calls.length} ${entry.calls.length === 1 ? "tool" : "tools"}`;
                    const listId = `${base}-${groupKey}-list`;
                    return (
                      <div key={groupKey} className="ui-ar__entry ui-as-rise">
                        <span className="ui-ar__entry-head">
                          <span className="ui-ar__num">{index + 1}</span>
                          {entry.step.name}
                        </span>

                        {visibleCalls.length > 0 && (
                          <div
                            className="ui-tc-group"
                            data-open={groupOpen ? "true" : undefined}
                            data-running={hasRunningCall ? "true" : undefined}
                          >
                            <span className="ui-tc-sr" role="status" aria-live="polite">
                              {hasRunningCall
                                ? "Using tools…"
                                : `${entry.calls.length} ${entry.calls.length === 1 ? "tool" : "tools"} finished`}
                            </span>
                            <button
                              type="button"
                              className="ui-tc-group__head"
                              aria-expanded={groupOpen}
                              aria-controls={listId}
                              onClick={() =>
                                setOpenGroups((all) => ({ ...all, [groupKey]: !groupOpen }))
                              }
                            >
                              <span className="ui-tc-group__stack" aria-hidden="true">
                                {visibleCalls.map((call, callIndex) => (
                                  <span key={`${groupKey}-icon-${callIndex}`} className="ui-tc__icon">
                                    {toolIcon(call.call.name)}
                                  </span>
                                ))}
                              </span>
                              <span className="ui-tc-group__title">
                                <span
                                  className={[
                                    "ui-tc-group__label",
                                    hasRunningCall ? "ui-tc__shine" : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                  data-text={groupLabel}
                                >
                                  {groupLabel}
                                </span>
                                <span className="ui-tc-group__time">{`· ${planMs(spent)}`}</span>
                              </span>
                              <svg className="ui-tc__chevron" viewBox="0 0 16 16" aria-hidden="true">
                                <path d="M4.5 6.25 8 9.75l3.5-3.5" />
                              </svg>
                            </button>
                            <div className="ui-tc__body" id={listId} inert={!groupOpen}>
                              <div className="ui-tc__clip">
                                <div className="ui-tc-group__list">
                                  {visibleCalls.map((call, callIndex) => {
                                    const key = `${groupKey}-${callIndex}`;
                                    const callDone = elapsed >= call.end;
                                    const bodyId = `${base}-${key}-body`;
                                    const callOpen = openCalls[key] ?? false;
                                    const argsKey = `${key}-args`;
                                    const resultKey = `${key}-result`;
                                    return (
                                      <div
                                        key={key}
                                        className="ui-tc"
                                        data-status={callDone ? "success" : "running"}
                                        data-open={callOpen ? "true" : undefined}
                                      >
                                        <span className="ui-tc-sr" role="status" aria-live="polite">
                                          {`${call.call.name} ${callDone ? "finished" : "running"}`}
                                        </span>
                                        <button
                                          type="button"
                                          className="ui-tc__head"
                                          aria-expanded={callOpen}
                                          aria-controls={bodyId}
                                          onClick={() =>
                                            setOpenCalls((all) => ({ ...all, [key]: !callOpen }))
                                          }
                                        >
                                          <span className="ui-tc__icon" aria-hidden="true">
                                            {toolIcon(call.call.name)}
                                          </span>
                                          <span className="ui-tc__main">
                                            <code className="ui-tc__name">{call.call.name}</code>
                                            <span
                                              className="ui-tc__summary"
                                              title={call.call.summary}
                                            >
                                              {call.call.summary}
                                            </span>
                                          </span>
                                          <span className="ui-tc__status">
                                            {callDone ? (
                                              <svg
                                                className="ui-tc__ok"
                                                viewBox="0 0 16 16"
                                                aria-hidden="true"
                                              >
                                                <path
                                                  d="M3.5 8.4 6.6 11.3 12.5 4.9"
                                                  pathLength={1}
                                                />
                                              </svg>
                                            ) : (
                                              <svg
                                                className="ui-tc__spinner"
                                                viewBox="0 0 16 16"
                                                aria-hidden="true"
                                              >
                                                <circle cx="8" cy="8" r="5.75" />
                                                <path d="M8 2.25a5.75 5.75 0 0 1 5.75 5.75" />
                                              </svg>
                                            )}
                                            <span className="ui-tc__time">
                                              {callDone
                                                ? shortMs(call.call.ms)
                                                : `${((elapsed - call.start) / 1000).toFixed(1)}s`}
                                            </span>
                                          </span>
                                          <svg
                                            className="ui-tc__chevron"
                                            viewBox="0 0 16 16"
                                            aria-hidden="true"
                                          >
                                            <path d="M4.5 6.25 8 9.75l3.5-3.5" />
                                          </svg>
                                        </button>
                                        <div className="ui-tc__body" id={bodyId} inert={!callOpen}>
                                          <div className="ui-tc__clip">
                                            <div className="ui-tc__sections">
                                              <div className="ui-tc__section">
                                                <div className="ui-tc__section-head">
                                                  <span className="ui-tc__label">Arguments</span>
                                                  {call.call.args === undefined ? null : (
                                                    <button
                                                      type="button"
                                                      className="ui-tc__copy"
                                                      aria-label="Copy arguments"
                                                      title="Copy arguments"
                                                      data-copied={
                                                        copied === argsKey ? "true" : undefined
                                                      }
                                                      onClick={() =>
                                                        void copyText(
                                                          argsKey,
                                                          JSON.stringify(call.call.args, null, 2),
                                                        )
                                                      }
                                                    >
                                                      <IconCopy />
                                                    </button>
                                                  )}
                                                </div>
                                                <pre className="ui-tc__code">
                                                  <code>{jsonTokens(call.call.args)}</code>
                                                </pre>
                                              </div>
                                              <div className="ui-tc__section">
                                                <div className="ui-tc__section-head">
                                                  <span className="ui-tc__label">Result</span>
                                                  {callDone && call.call.result !== undefined ? (
                                                    <button
                                                      type="button"
                                                      className="ui-tc__copy"
                                                      aria-label="Copy result"
                                                      title="Copy result"
                                                      data-copied={
                                                        copied === resultKey ? "true" : undefined
                                                      }
                                                      onClick={() =>
                                                        void copyText(
                                                          resultKey,
                                                          JSON.stringify(call.call.result, null, 2),
                                                        )
                                                      }
                                                    >
                                                      <IconCopy />
                                                    </button>
                                                  ) : null}
                                                </div>
                                                {callDone ? (
                                                  <pre className="ui-tc__code">
                                                    <code>{jsonTokens(call.call.result)}</code>
                                                  </pre>
                                                ) : (
                                                  <p className="ui-tc__pending">
                                                    Waiting for result…
                                                  </p>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {entry.step.approval && (isGate || answer) ? (
                          <div
                            className="ui-ar__note"
                            data-state={answer === "approved" ? "approved" : answer ? undefined : "pending"}
                          >
                            <IconShield />
                            {answer === "approved"
                              ? "Approved — the run goes on"
                              : answer === "denied"
                                ? "Denied — the run stopped before sending"
                                : `High risk · waits for your approval before it sends`}
                            {phase === "waiting" ? (
                              <button type="button" onClick={reviewApproval}>
                                Review
                              </button>
                            ) : null}
                          </div>
                        ) : null}

                        {isActive && phase === "running" ? (
                          <ThinkingLoader className="ui-ar__loader" label={entry.step.name} />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <div className="ui-ar__scrim" aria-hidden="true" onClick={() => setPanelOpen(false)} />

          {panelOpen && (
            <aside className="ui-ar__panel" aria-label="Run details">
              <header className="ui-ar__bar">
                <span className="ui-ar__crumbs">
                  <b>Needs your input</b>
                  {phase === "waiting" ? <span className="ui-ar__count">1</span> : null}
                </span>
              </header>
              <div
                className="ui-ar__panel-body"
                onScroll={() => {
                  if (popOpen) setActiveChange(null);
                }}
              >
                <section className="ui-ar__section">
                  {approvalForPanel ? (
                    <>
                      <span className="ui-ar__label">{approvalForPanel.title}</span>
                      <dl className="ui-ar__details">
                        <div>
                          <dt>
                            <IconShield size={14} />
                            Risk
                          </dt>
                          <dd>{`${approvalForPanel.risk[0].toUpperCase()}${approvalForPanel.risk.slice(1)}`}</dd>
                        </div>
                        <div>
                          <dt>
                            <IconWorkflow size={14} />
                            Tool
                          </dt>
                          <dd>{approvalEntry?.step.tool ?? approvalEntry?.step.calls[0]?.name}</dd>
                        </div>
                        {approvalForPanel.facts.map((fact) => (
                          <div key={fact.label}>
                            <dt>{fact.label}</dt>
                            <dd>{fact.value}</dd>
                          </div>
                        ))}
                      </dl>
                      <div
                        className="ui-ar__note"
                        data-state={approvalAnswer === "approved" ? "approved" : approvalAnswer ? undefined : "pending"}
                      >
                        <IconShield />
                        {approvalAnswer === "approved"
                          ? "Approved — sending now"
                          : approvalAnswer === "denied"
                            ? "Denied — nothing was sent"
                            : approvalForPanel.description}
                        {approvalAnswer || !gate || phase !== "waiting" ? null : (
                          <>
                            <button type="button" ref={approveRef} onClick={approve}>
                              Approve
                            </button>
                            <button type="button" onClick={deny}>
                              Deny
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="ui-ar__quiet">
                      <span>
                        <IconAgent size={16} />
                      </span>
                      <b>Nothing needs you yet</b>
                      <p>The agent asks here before it sends or books anything.</p>
                    </div>
                  )}
                </section>

                <section className="ui-ar__section">
                  <span className="ui-ar__label">Draft</span>
                  <div className="ui-df" data-done={draftDone ? "true" : undefined}>
                    <div className="ui-df__label">
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M8 1.75c.3 2.9 1.35 3.95 4.25 4.25-2.9.3-3.95 1.35-4.25 4.25C7.7 7.35 6.65 6.3 3.75 6 6.65 5.7 7.7 4.65 8 1.75Z" />
                        <path d="M12.5 10.25c.15 1.25.6 1.7 1.75 1.75-1.15.15-1.6.6-1.75 1.75-.15-1.15-.6-1.6-1.75-1.75 1.15-.05 1.6-.5 1.75-1.75Z" />
                      </svg>
                      <span>{draft.label}</span>
                    </div>
                    <div className="ui-df__card" ref={cardRef}>
                      <div className="ui-df__head">
                        <div className="ui-df__bar">
                          <div
                            className="ui-df__layer"
                            data-show={draftDone ? undefined : "true"}
                            inert={draftDone}
                            aria-hidden={draftDone ? "true" : undefined}
                          >
                            <span className="ui-df__count">
                              <span className="ui-df__num">{pendingChangeIds.length}</span>
                              <span className="ui-df__word">
                                {pendingChangeIds.length === 1 ? "suggestion" : "suggestions"}
                              </span>
                            </span>
                            <span className="ui-df__actions">
                              <span className="ui-df__nav">
                                <button
                                  type="button"
                                  className="ui-df__icon"
                                  aria-label="Previous suggestion"
                                  onClick={() => moveChange(-1)}
                                >
                                  <svg viewBox="0 0 16 16" aria-hidden="true">
                                    <path d="M10 12.5 5.5 8 10 3.5" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="ui-df__icon"
                                  aria-label="Next suggestion"
                                  onClick={() => moveChange(1)}
                                >
                                  <svg viewBox="0 0 16 16" aria-hidden="true">
                                    <path d="M6 3.5 10.5 8 6 12.5" />
                                  </svg>
                                </button>
                              </span>
                              <button
                                type="button"
                                className="ui-df__btn"
                                onClick={() => resolveAll("rejected")}
                              >
                                Reject all
                              </button>
                              <button
                                type="button"
                                className="ui-df__btn ui-df__btn--primary"
                                onClick={() => resolveAll("accepted")}
                              >
                                Accept all
                              </button>
                            </span>
                          </div>
                          <div
                            className="ui-df__layer"
                            data-show={draftDone ? "true" : undefined}
                            inert={!draftDone}
                            aria-hidden={draftDone ? undefined : "true"}
                          >
                            <span className="ui-df__count ui-df__count--done">
                              <svg className="ui-df__ok" viewBox="0 0 16 16" aria-hidden="true">
                                <path d="M3.75 8.4 6.6 11.1 12.25 5" pathLength={1} />
                              </svg>
                              All changes reviewed
                            </span>
                            <button
                              type="button"
                              className="ui-df__btn"
                              disabled={!draftDone}
                              onClick={undoChanges}
                            >
                              <svg viewBox="0 0 16 16" aria-hidden="true">
                                <path d="M5.5 4 2.75 6.75 5.5 9.5" />
                                <path d="M3 6.75h6.5a3.75 3.75 0 0 1 0 7.5H7.5" />
                              </svg>
                              Undo
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="ui-df__body">
                        <p className="ui-df__text">
                          {draft.segments.map((segment, index) => {
                            if (typeof segment === "string") {
                              return <span key={`text-${index}`}>{segment}</span>;
                            }
                            const state = changeStates[segment.id] ?? "pending";
                            const position = changes.findIndex((change) => change.id === segment.id);
                            const active = activeChange === segment.id;
                            return (
                              <span
                                key={segment.id}
                                ref={(node) => {
                                  changeRefs.current[segment.id] = node;
                                }}
                                className="ui-df__chg"
                                data-state={state}
                                data-active={active ? "" : undefined}
                                tabIndex={state === "pending" ? 0 : undefined}
                                role={state === "pending" ? "button" : undefined}
                                aria-label={
                                  state === "pending"
                                    ? changeLabel(segment, position, changes.length)
                                    : undefined
                                }
                                onClick={() => {
                                  if (state !== "pending") return;
                                  setActiveChange((current) =>
                                    current === segment.id ? null : segment.id,
                                  );
                                }}
                                onKeyDown={(event) => onChangeKey(event, segment.id)}
                              >
                                {segment.from ? (
                                  <del className="ui-df__del">{segment.from}</del>
                                ) : null}
                                {segment.to ? <ins className="ui-df__ins">{segment.to}</ins> : null}
                              </span>
                            );
                          })}
                        </p>
                      </div>
                      <div
                        className="ui-df__pop"
                        ref={popRef}
                        role="group"
                        aria-label="Review suggestion"
                        aria-hidden={popOpen ? undefined : "true"}
                        data-open={popOpen ? "true" : undefined}
                        style={popPos ?? undefined}
                      >
                        <button
                          type="button"
                          tabIndex={-1}
                          className="ui-df__pbtn"
                          aria-label="Accept suggestion"
                          onClick={() => {
                            if (activeChange) resolveChange(activeChange, "accepted");
                          }}
                        >
                          <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M3.75 8.4 6.6 11.1 12.25 5" />
                          </svg>
                          Accept
                          <kbd>Y</kbd>
                        </button>
                        <span className="ui-df__sep" aria-hidden="true" />
                        <button
                          type="button"
                          tabIndex={-1}
                          className="ui-df__pbtn"
                          aria-label="Reject suggestion"
                          onClick={() => {
                            if (activeChange) resolveChange(activeChange, "rejected");
                          }}
                        >
                          <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
                          </svg>
                          Reject
                          <kbd>N</kbd>
                        </button>
                      </div>
                    </div>
                    <span className="ui-df__sr" role="status" aria-live="polite">
                      {announcement}
                    </span>
                  </div>
                </section>

                <section className="ui-ar__section">
                  <span className="ui-ar__label">Details</span>
                  <dl className="ui-ar__details">
                    <div>
                      <dt>
                        <IconAgent size={14} />
                        Agent
                      </dt>
                      <dd>{agent}</dd>
                    </div>
                    <div>
                      <dt>
                        <IconUser />
                        Triggered by
                      </dt>
                      <dd>{triggeredBy}</dd>
                    </div>
                    <div>
                      <dt>
                        <IconWorkflow size={14} />
                        Tool calls
                      </dt>
                      <dd>{totalCalls}</dd>
                    </div>
                    <div>
                      <dt>
                        <IconDatabase />
                        Cost
                      </dt>
                      <dd>{cost}</dd>
                    </div>
                  </dl>
                </section>
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}

function ThinkingLoader({ label, className }: { label: string; className?: string }) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const node = labelRef.current;
    if (node) setWidth(node.offsetWidth);
  }, [label]);

  return (
    <span
      className={["ui-tl", className].filter(Boolean).join(" ")}
      data-size="sm"
      data-variant="pill"
      role="status"
      aria-live="polite"
    >
      <span className="ui-tl__icon" aria-hidden="true">
        <Spinner className="ui-tl__spinner" />
        <svg className="ui-tl__check" viewBox="0 0 16 16">
          <path d="M3.5 8.4 6.6 11.3 12.5 4.9" pathLength={1} />
        </svg>
      </span>
      <span className="ui-tl__text" style={{ width }}>
        <span ref={labelRef} className="ui-tl__label ui-tl__shine" data-text={label}>
          {label}
        </span>
      </span>
    </span>
  );
}

/** The eight-ray spinner the plan and the loader share. */
function Spinner({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
        <line
          key={index}
          x1="8"
          y1="1.75"
          x2="8"
          y2="4.75"
          transform={`rotate(${index * 45} 8 8)`}
          style={{ animationDelay: `${-800 + index * 100}ms` }}
        />
      ))}
    </svg>
  );
}

function toolIcon(name: string): ReactNode {
  if (name === "stripe.query") return <IconCurrency size={14} />;
  if (name === "search") return <IconSearch size={14} />;
  if (name === "gmail.send") return <IconMail size={14} />;
  if (name === "calendar.create") return <IconCalendar />;
  return <IconDoc />;
}

/** One 24-grid glyph, drawn the way every icon in the shell is drawn. */
function Glyph({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth="1.9"
      stroke="currentColor"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function IconSidebar() {
  return (
    <Glyph size={16}>
      <path
        d="M2 12C2 8.31087 2 6.4663 2.81382 5.15877C3.1149 4.67502 3.48891 4.25427 3.91891 3.91554C5.08116 3 6.72077 3 10 3H14C17.2792 3 18.9188 3 20.0811 3.91554C20.5111 4.25427 20.8851 4.67502 21.1862 5.15877C22 6.4663 22 8.31087 22 12C22 15.6891 22 17.5337 21.1862 18.8412C20.8851 19.325 20.5111 19.7457 20.0811 20.0845C18.9188 21 17.2792 21 14 21H10C6.72077 21 5.08116 21 3.91891 20.0845C3.48891 19.7457 3.1149 19.325 2.81382 18.8412C2 17.5337 2 15.6891 2 12Z"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path d="M9.5 3L9.5 21" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path
        d="M5 7H6M5 10H6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </Glyph>
  );
}

function IconPanel() {
  return (
    <Glyph size={16}>
      <path
        d="M2 12C2 8.3109 2 6.46633 2.81382 5.1588C3.1149 4.67505 3.48891 4.2543 3.91891 3.91557C5.08116 3.00003 6.72077 3.00003 10 3.00003H14C17.2792 3.00003 18.9188 3.00003 20.0811 3.91557C20.5111 4.2543 20.8851 4.67505 21.1862 5.1588C22 6.46633 22 8.3109 22 12C22 15.6892 22 17.5337 21.1862 18.8413C20.8851 19.325 20.5111 19.7458 20.0811 20.0845C18.9188 21 17.2792 21 14 21H10C6.72077 21 5.08116 21 3.91891 20.0845C3.48891 19.7458 3.1149 19.325 2.81382 18.8413C2 17.5337 2 15.6892 2 12Z"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="M14.5 3.00003L14.5 21"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M18 7.00006H19M18 10.0001H19"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </Glyph>
  );
}

function IconSearch({ size = 16 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path
        d="M17 17L21 21"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </Glyph>
  );
}

function IconChevronDown() {
  return (
    <Glyph size={13}>
      <path
        d="M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </Glyph>
  );
}

function IconChevronRight() {
  return (
    <Glyph size={13}>
      <path
        d="M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </Glyph>
  );
}

function IconClose() {
  return (
    <Glyph size={13}>
      <path
        d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </Glyph>
  );
}

function IconRuns({ size = 16 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M15.9453 12.3948C15.7686 13.0215 14.9333 13.4644 13.2629 14.3502C11.648 15.2064 10.8406 15.6346 10.1899 15.4625C9.9209 15.3913 9.6758 15.2562 9.47812 15.0701C9 14.6198 9 13.7465 9 12C9 10.2535 9 9.38018 9.47812 8.92995C9.6758 8.74381 9.9209 8.60868 10.1899 8.53753C10.8406 8.36544 11.648 8.79357 13.2629 9.64983C14.9333 10.5356 15.7686 10.9785 15.9453 11.6052C16.0182 11.8639 16.0182 12.1361 15.9453 12.3948Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </Glyph>
  );
}

function IconClock() {
  return (
    <Glyph size={14}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M12 8V12L14 14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </Glyph>
  );
}

function IconStop() {
  return (
    <Glyph size={14}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M9.38886 15.1629C9.89331 15.5 10.5955 15.5 12 15.5C13.4045 15.5 14.1067 15.5 14.6111 15.1629C14.8295 15.017 15.017 14.8295 15.1629 14.6111C15.5 14.1067 15.5 13.4045 15.5 12C15.5 10.5955 15.5 9.89331 15.1629 9.38886C15.017 9.17048 14.8295 8.98298 14.6111 8.83706C14.1067 8.5 13.4045 8.5 12 8.5C10.5955 8.5 9.89331 8.5 9.38886 8.83706C9.17048 8.98298 8.98298 9.17048 8.83706 9.38886C8.5 9.89331 8.5 10.5955 8.5 12C8.5 13.4045 8.5 14.1067 8.83706 14.6111C8.98298 14.8295 9.17048 15.017 9.38886 15.1629Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </Glyph>
  );
}

function IconDots() {
  return (
    <Glyph size={15}>
      <path
        d="M6.00449 12.5V12M18.0045 12.5V12M12.0045 12.5V12M7.00449 12.5C7.00449 11.9477 6.55677 11.5 6.00449 11.5C5.4522 11.5 5.00449 11.9477 5.00449 12.5C5.00449 13.0523 5.4522 13.5 6.00449 13.5C6.55677 13.5 7.00449 13.0523 7.00449 12.5ZM19.0045 12.5C19.0045 11.9477 18.5568 11.5 18.0045 11.5C17.4522 11.5 17.0045 11.9477 17.0045 12.5C17.0045 13.0523 17.4522 13.5 18.0045 13.5C18.5568 13.5 19.0045 13.0523 19.0045 12.5ZM13.0045 12.5C13.0045 11.9477 12.5568 11.5 12.0045 11.5C11.4522 11.5 11.0045 11.9477 11.0045 12.5C11.0045 13.0523 11.4522 13.5 12.0045 13.5C12.5568 13.5 13.0045 13.0523 13.0045 12.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </Glyph>
  );
}

function IconHome() {
  return (
    <Glyph size={16}>
      <path
        d="M3 11.9896V14.5C3 17.7998 3 19.4497 4.02513 20.4749C5.05025 21.5 6.70017 21.5 10 21.5H14C17.2998 21.5 18.9497 21.5 19.9749 20.4749C21 19.4497 21 17.7998 21 14.5V11.9896C21 10.3083 21 9.46773 20.6441 8.74005C20.2882 8.01237 19.6247 7.49628 18.2976 6.46411L16.2976 4.90855C14.2331 3.30285 13.2009 2.5 12 2.5C10.7991 2.5 9.76689 3.30285 7.70242 4.90855L5.70241 6.46411C4.37533 7.49628 3.71179 8.01237 3.3559 8.74005C3 9.46773 3 10.3083 3 11.9896Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </Glyph>
  );
}

function IconChat() {
  return (
    <Glyph size={16}>
      <path
        d="M21.5 12C21.5 17.2467 17.2467 21.5 12 21.5C10.3719 21.5 8.8394 21.0904 7.5 20.3687C5.63177 19.362 4.37462 20.2979 3.26592 20.4658C3.09774 20.4913 2.93024 20.4302 2.80997 20.31C2.62741 20.1274 2.59266 19.8451 2.6935 19.6074C3.12865 18.5818 3.5282 16.6382 2.98341 15C2.6698 14.057 2.5 13.0483 2.5 12C2.5 6.75329 6.75329 2.5 12 2.5C17.2467 2.5 21.5 6.75329 21.5 12Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M12.1257 12H12.0007M8.125 12H8M16.125 12H16M12.2507 12C12.2507 12.1381 12.1388 12.25 12.0007 12.25C11.8627 12.25 11.7507 12.1381 11.7507 12C11.7507 11.8619 11.8627 11.75 12.0007 11.75C12.1388 11.75 12.2507 11.8619 12.2507 12ZM8.25 12C8.25 12.1381 8.13807 12.25 8 12.25C7.86193 12.25 7.75 12.1381 7.75 12C7.75 11.8619 7.86193 11.75 8 11.75C8.13807 11.75 8.25 11.8619 8.25 12ZM16.25 12C16.25 12.1381 16.1381 12.25 16 12.25C15.8619 12.25 15.75 12.1381 15.75 12C15.75 11.8619 15.8619 11.75 16 11.75C16.1381 11.75 16.25 11.8619 16.25 12Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </Glyph>
  );
}

function IconAnalytics() {
  return (
    <Glyph size={16}>
      <path d="M7 17L7 13" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M12 17L12 7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M17 17L17 11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path
        d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </Glyph>
  );
}

function IconDeliverables() {
  return (
    <Glyph size={16}>
      <path
        d="M8 7H16.75C18.8567 7 19.91 7 20.6667 7.50559C20.9943 7.72447 21.2755 8.00572 21.4944 8.33329C22 9.08996 22 10.1433 22 12.25C22 15.7612 22 17.5167 21.1573 18.7779C20.7926 19.3238 20.3238 19.7926 19.7779 20.1573C18.5167 21 16.7612 21 13.25 21H12C7.28595 21 4.92893 21 3.46447 19.5355C2 18.0711 2 15.714 2 11V7.94427C2 6.1278 2 5.21956 2.38032 4.53806C2.65142 4.05227 3.05227 3.65142 3.53806 3.38032C4.21956 3 5.1278 3 6.94427 3C8.10802 3 8.6899 3 9.19926 3.19101C10.3622 3.62712 10.8418 4.68358 11.3666 5.73313L12 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
    </Glyph>
  );
}

function IconBoardPrep() {
  return (
    <Glyph size={16}>
      <path
        d="M12 18V22"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M10 18L5 22"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M14 18L19 22"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M2.5 12C2.5 14.8284 2.5 16.2426 3.37868 17.1213C4.25736 18 5.67157 18 8.5 18H15.5C18.3284 18 19.7426 18 20.6213 17.1213C21.5 16.2426 21.5 14.8284 21.5 12V8C21.5 5.17157 21.5 3.75736 20.6213 2.87868C19.7426 2 18.3284 2 15.5 2H8.5C5.67157 2 4.25736 2 3.37868 2.87868C2.5 3.75736 2.5 5.17157 2.5 8V12Z"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="M8 13V10M12 13V7M16 13V11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
    </Glyph>
  );
}

function IconCurrency({ size = 16 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path
        d="M17.9583 8.38889C17.9583 6.24111 15.2907 4.5 12 4.5C8.7093 4.5 6.04167 6.24111 6.04167 8.38889C6.04167 10.5367 7.66667 11.7222 12 11.7222C16.3333 11.7222 18.5 12.8333 18.5 15.6111C18.5 18.3889 15.5899 19.5 12 19.5C8.41015 19.5 5.5 17.7589 5.5 15.6111"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      <path
        d="M12.5 2.5V4.21M12.5 21.5V19.79"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </Glyph>
  );
}

function IconMail({ size = 16 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path
        d="M2 6L8.91302 9.91697C11.4616 11.361 12.5384 11.361 15.087 9.91697L22 6"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M2.01577 13.4756C2.08114 16.5412 2.11383 18.0739 3.24496 19.2094C4.37608 20.3448 5.95033 20.3843 9.09883 20.4634C11.0393 20.5122 12.9607 20.5122 14.9012 20.4634C18.0497 20.3843 19.6239 20.3448 20.7551 19.2094C21.8862 18.0739 21.9189 16.5412 21.9842 13.4756C22.0053 12.4899 22.0053 11.5101 21.9842 10.5244C21.9189 7.45886 21.8862 5.92609 20.7551 4.79066C19.6239 3.65523 18.0497 3.61568 14.9012 3.53657C12.9607 3.48781 11.0393 3.48781 9.09882 3.53656C5.95033 3.61566 4.37608 3.65521 3.24495 4.79065C2.11382 5.92608 2.08114 7.45885 2.01576 10.5244C1.99474 11.5101 1.99475 12.4899 2.01577 13.4756Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </Glyph>
  );
}

function IconWorkflow({ size = 16 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path
        d="M3 4C3 2.34533 3.34533 2 5 2H9C10.6547 2 11 2.34533 11 4C11 5.65467 10.6547 6 9 6H5C3.34533 6 3 5.65467 3 4Z"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="M13 13C13 11.3453 13.3453 11 15 11H19C20.6547 11 21 11.3453 21 13C21 14.6547 20.6547 15 19 15H15C13.3453 15 13 14.6547 13 13Z"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="M4 20C4 18.3453 4.34533 18 6 18H10C11.6547 18 12 18.3453 12 20C12 21.6547 11.6547 22 10 22H6C4.34533 22 4 21.6547 4 20Z"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="M17 11C17 10.5353 17 10.303 16.9616 10.1098C16.8038 9.31644 16.1836 8.69624 15.3902 8.53843C15.197 8.5 14.9647 8.5 14.5 8.5H9.5C9.03534 8.5 8.80302 8.5 8.60982 8.46157C7.81644 8.30376 7.19624 7.68356 7.03843 6.89018C7 6.69698 7 6.46466 7 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M17 15V16C17 17.8856 17 18.8284 16.4142 19.4142C15.8284 20 14.8856 20 13 20H12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </Glyph>
  );
}

function IconAgent({ size = 16 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path
        d="M7 4.5C5.34315 4.5 4 5.84315 4 7.5C4 8.06866 4.15822 8.60037 4.43304 9.0535C3.04727 9.31855 2 10.537 2 12C2 13.463 3.04727 14.6814 4.43304 14.9465M7 4.5C7 3.11929 8.11929 2 9.5 2C10.8807 2 12 3.11929 12 4.5V19.5C12 20.8807 10.8807 22 9.5 22C8.11929 22 7 20.8807 7 19.5C5.34315 19.5 4 18.1569 4 16.5C4 15.9313 4.15822 15.3996 4.43304 14.9465M7 4.5C7 5.31791 7.39278 6.04408 8 6.50018M4.43304 14.9465C4.78948 14.3588 5.34207 13.9032 6 13.6707"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M17 19.4999C18.6569 19.4999 20 18.1567 20 16.4999C20 15.9312 19.8418 15.3995 19.567 14.9464C20.9527 14.6813 22 13.4629 22 11.9999C22 10.5369 20.9527 9.31843 19.567 9.05338M17 19.4999C17 20.8806 15.8807 21.9999 14.5 21.9999C13.1193 21.9999 12 20.8806 12 19.4999L12 4.49988C12 3.11917 13.1193 1.99988 14.5 1.99988C15.8807 1.99988 17 3.11917 17 4.49988C18.6569 4.49988 20 5.84302 20 7.49988C20 8.06854 19.8418 8.60024 19.567 9.05338M17 19.4999C17 18.682 16.6072 17.9558 16 17.4997M19.567 9.05338C19.2105 9.64109 18.6579 10.0966 18 10.3292"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </Glyph>
  );
}

function IconUser() {
  return (
    <Glyph size={14}>
      <path
        d="M18.4995 20.5C18.2663 17.5685 15.8417 15.2477 12.808 15.0521L11.9995 15C11.7107 15.0076 11.4416 15.0178 11.1877 15.0298C8.18075 15.1723 5.7304 17.5974 5.49951 20.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M15.2495 9.25C15.2495 11.0449 13.7944 12.5 11.9995 12.5C10.2046 12.5 8.74952 11.0449 8.74952 9.25C8.74952 7.45507 10.2046 6 11.9995 6C13.7944 6 15.2495 7.45507 15.2495 9.25Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M5.50249 8.5C5.17908 7.99485 4.99158 7.39432 4.99158 6.75C4.99158 4.95507 6.44665 3.5 8.24157 3.5C8.68752 3.5 9.1125 3.58982 9.49939 3.75235"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M18.4963 8.5C18.8197 7.99485 19.0072 7.39432 19.0072 6.75C19.0072 4.95507 17.5521 3.5 15.7572 3.5C15.3113 3.5 14.8863 3.58982 14.4994 3.75235"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M22.0007 17.9996C21.8208 15.7374 19.9995 13.5 17.9995 13"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M1.99927 17.9996C2.17923 15.7374 4.00049 13.5 6.00049 13"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </Glyph>
  );
}

function IconDatabase() {
  return (
    <Glyph size={14}>
      <ellipse cx="15.5" cy="11" rx="6.5" ry="2" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M22 15.5C22 16.6046 19.0899 17.5 15.5 17.5C11.9101 17.5 9 16.6046 9 15.5"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="M22 11V19.8C22 21.015 19.0899 22 15.5 22C11.9101 22 9 21.015 9 19.8V11"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <ellipse cx="8.5" cy="4" rx="6.5" ry="2" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M6 11C4.10819 10.7698 2.36991 10.1745 2 9M6 16C4.10819 15.7698 2.36991 15.1745 2 14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      <path
        d="M6 21C4.10819 20.7698 2.36991 20.1745 2 19L2 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      <path d="M15 6V4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </Glyph>
  );
}

function IconShield({ size = 14 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path
        d="M12 2.75 4.75 5.6v5.15c0 4.35 3 7.6 7.25 9.25 4.25-1.65 7.25-4.9 7.25-9.25V5.6L12 2.75Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M9.25 11.9 11.3 13.9 15 10.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </Glyph>
  );
}

function IconDoc() {
  return (
    <Glyph size={14}>
      <path
        d="M6 3.5h7.5L18.5 8.5v12h-12.5z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M13.5 3.5v5h5"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </Glyph>
  );
}

function IconCalendar() {
  return (
    <Glyph size={14}>
      <path
        d="M3.5 9.75C3.5 6.9994 3.5 5.6241 4.35455 4.76955C5.2091 3.915 6.5844 3.915 9.335 3.915H14.665C17.4156 3.915 18.7909 3.915 19.6455 4.76955C20.5 5.6241 20.5 6.9994 20.5 9.75V14.665C20.5 17.4156 20.5 18.7909 19.6455 19.6455C18.7909 20.5 17.4156 20.5 14.665 20.5H9.335C6.5844 20.5 5.2091 20.5 4.35455 19.6455C3.5 18.7909 3.5 17.4156 3.5 14.665V9.75Z"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path d="M3.5 9.5h17" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M8.5 3v3.5M15.5 3v3.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
    </Glyph>
  );
}

function IconCopy() {
  return (
    <>
      <svg className="ui-tc__copy-icon" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="5.25" y="5.25" width="8" height="8" rx="2" />
        <path d="M10.75 5.25v-1a1.5 1.5 0 0 0-1.5-1.5h-4.5a2 2 0 0 0-2 2v4.5a1.5 1.5 0 0 0 1.5 1.5h1" />
      </svg>
      <svg className="ui-tc__copy-done" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3.5 8.4 6.6 11.3 12.5 4.9" pathLength={1} />
      </svg>
    </>
  );
}

function IconPlanState() {
  return (
    <svg viewBox="0 0 16 16">
      <path d="M6.5 4.5h7M6.5 8h7M6.5 11.5h7" />
      <circle cx="3.25" cy="4.5" r=".6" />
      <circle cx="3.25" cy="8" r=".6" />
      <circle cx="3.25" cy="11.5" r=".6" />
    </svg>
  );
}

const css = /* css */ `
/* ui-app-shell — composed into this item */
.ui-as{--tray: #f3ebe3;--card: #fffdfb;--page: #f8f3ee;--panel: #fffdfb;--radius-panel: 18px;--frame-gap: 8px;--line: #e8e0d8;--line-soft: #eee6de;--ink: #1c1713;--text: #3d3226;--muted: #68584b;--faint: #96887a;--placeholder: #96887a;--chip: #f4ece5;--chip-hover: #ece4db;--hover: rgba(11, 9, 8, 0.035);--accent: #ff8a5c;--button: #28211a;--button-hover: #33291f;--accent-soft: #f6f0e9;--shadow: 0 1px 2px rgba(11, 9, 8, 0.05);--line-strong: #d2c7bd;--subtle: #faf7f4;--disabled: #d0c4ba;--on-ink: #fffdfb;--ink-hover: #382e23;--select: rgba(11, 9, 8, 0.055);--toggle-off: #d8cdc4;--switch-on: #1c1713;--logo-bg: #fffdfb;--ease: cubic-bezier(0.22, 1, 0.36, 1);--font: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif}
.ui-as .ui-pl{font-size: 13.5px;line-height: 19px}
.ui-as .ui-pl__title{font-size: 14px;line-height: 20px}
.ui-as .ui-df__text{font-size: 13.5px;line-height: 1.6}
.ui-as .ui-df__body{padding: 14px 16px 16px}
.ui-as .ui-ap__title{font-size: 13.5px}
.ui-as .ui-ap__btn{height: 30px}
.ui-as .ui-tc{font-size: 13px}
.ui-as .ui-tc__head{min-height: 40px;padding-top: 6px;padding-bottom: 6px}
.ui-as .ui-ap__foot .ui-ap__actions{flex: 0 0 auto;margin-left: auto}
.ui-as .ui-ap__actions .ui-ap__btn{flex: none;padding: 0 12px;border-radius: 10px}
.ui-as .ui-ap__actions .ui-ap__btn--quiet{background: var(--card);box-shadow: inset 0 0 0 1px var(--line)}
.ui-as .ui-ap__actions .ui-ap__btn--quiet:hover{background: var(--subtle)}
.ui-as .ui-df__head .ui-df__btn, .ui-as .ui-df__head .ui-df__icon{border-radius: 10px}
.ui-as .ui-ap__actions .ui-ap__btn--primary, .ui-as .ui-df__head .ui-df__btn--primary{background: var(--button)}
.ui-as .ui-um__action{border-radius: 10px}
.ui-as .ui-ap{--ui-ap-tray: var(--tray);--ui-ap-hover: #e8e0d8}
.ui-as .ui-pl{--ui-pl-tray: var(--tray);--ui-pl-quiet-hover: #e8e0d8;--ui-pl-marker: var(--chip)}
.ui-as .ui-df{--ui-df-tray: var(--tray)}
.ui-as .ui-um{--ui-um-tray: var(--tray)}
.ui-as .ui-cb{--ui-cb-tray: var(--tray)}
:where(.dark, [data-theme="dark"]) .ui-as .ui-ap{--ui-ap-tray: #181310;--ui-ap-hover: #26201a}
:where(.dark, [data-theme="dark"]) .ui-as .ui-pl{--ui-pl-tray: #181310;--ui-pl-quiet-hover: #26201a;--ui-pl-marker: #29221b}
:where(.dark, [data-theme="dark"]) .ui-as :is(.ui-df, .ui-um, .ui-cb){--ui-df-tray: #181310;--ui-um-tray: #181310;--ui-cb-tray: #181310}
:where(.dark, [data-theme="dark"]) .ui-as{--tray: #221c17;--card: #201a15;--page: #16110e;--panel: #1a1512;--line: #2b231b;--line-soft: #26201a;--ink: #f4ece4;--text: #c8bdb2;--muted: #988a7d;--faint: #6a5a4e;--placeholder: #6a5a4e;--chip: #27201a;--chip-hover: #2e251c;--hover: rgba(255, 253, 251, 0.05);--accent: #ff8a5c;--button: #f4ece4;--button-hover: #fffdfb;--accent-soft: rgba(255, 138, 92, 0.14);--shadow: 0 1px 2px rgba(11, 9, 8, 0.4);--line-strong: #3a3024;--subtle: #1e1814;--disabled: #3a3024;--on-ink: #181310;--ink-hover: #c8bdb2;--select: rgba(255, 253, 251, 0.08);--toggle-off: #3a3024;--switch-on: #ff8a5c;--logo-bg: #2c241b;color-scheme: dark}
.ui-as, .ui-as *, .ui-as *::before, .ui-as *::after{box-sizing: border-box}
.ui-as{font-family: var(--font);font-size: 13px;color: var(--text);-webkit-font-smoothing: antialiased;-moz-osx-font-smoothing: grayscale}
:where(.ui-as) button{appearance: none;margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;cursor: pointer}
:where(.ui-as) svg{display: block;flex: none}
.ui-as :focus-visible{outline: 2px solid var(--accent);outline-offset: 2px}
.ui-as textarea:focus-visible, .ui-as input:focus-visible{outline: none}
.ui-as-app .ui-button[data-variant="primary"]{border-color: transparent;background: var(--button);color: var(--on-ink);box-shadow: inset 0 1px 0.5px rgba(255, 253, 251, 0.16), inset 0 -1px 0.5px rgba(28, 23, 19, 0.1), 0 1px 2px rgba(28, 23, 19, 0.1)}
.ui-as-app .ui-button[data-variant="primary"]:hover:not(:disabled){background: var(--button-hover)}
.ui-as-app{container: ui-as / inline-size;position: relative;display: grid;grid-template-columns: 248px minmax(0, 1fr);height: 100%;min-height: 560px;background: var(--page);transition: grid-template-columns var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-app[data-collapsed]{grid-template-columns: 0 minmax(0, 1fr)}
.ui-as-app[data-collapsed] .ui-as-main{margin-left: var(--frame-gap)}
.ui-as-side{display: flex;flex-direction: column;width: 248px;min-height: 0;padding: 10px 8px 8px 10px;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), translate var(--nm-dur-4, 380ms) var(--ease), visibility 0s}
.ui-as-app[data-collapsed] .ui-as-side{visibility: hidden;opacity: 0;translate: -16px 0;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), translate var(--nm-dur-4, 380ms) var(--ease), visibility 0s 420ms}
.ui-as-side-open{position: fixed;z-index: 20;top: calc(var(--frame-gap) + 9px);left: calc(var(--frame-gap) + 9px);visibility: hidden;opacity: 0;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), visibility 0s 200ms}
.ui-as-app[data-collapsed] .ui-as-side-open{visibility: visible;opacity: 1;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 160ms, visibility 0s}
.ui-as-side__head{display: flex;align-items: center;justify-content: space-between;height: 28px}
.ui-as-side__workspace{display: flex;align-items: center;gap: 6px;height: 30px;padding: 0 6px;border-radius: 8px;font-size: 14px;font-weight: 600;color: var(--ink)}
.ui-as-side__workspace svg{color: var(--faint)}
.ui-as-side__workspace:hover{background: var(--hover)}
.ui-as-user-menu{display: flex}
.ui-as-user-menu > .ui-as-user{flex: 1}
.ui-as-user-menu .ui-as-menu{width: 100%}
.ui-as-side__logo{display: grid;place-items: center;width: 18px;height: 18px;margin-right: 1px;border-radius: 5px;background: var(--logo-bg);box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.08), 0 1px 1px rgba(0, 0, 0, 0.12)}
.ui-as-side__logo svg{width: 11px;height: auto}
.ui-as-side__tools{display: flex;gap: 2px}
.ui-as-icon-btn{display: grid;place-items: center;width: 28px;height: 28px;border-radius: 8px;color: var(--muted);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-icon-btn:hover{background: var(--hover);color: var(--ink)}
.ui-as-side__nav{display: flex;flex-direction: column;margin-top: 16px}
.ui-as-side__group{display: flex;flex-direction: column}
.ui-as-side__group + .ui-as-side__group{margin-top: 10px}
.ui-as-side__group + .ui-as-side__group > .ui-as-side__label:first-child{margin-top: 6px}
.ui-as-side__count{margin-left: auto;font-size: 12px;color: var(--faint);font-variant-numeric: tabular-nums}
.ui-as-side__empty{padding: 4px 6px;font-size: 13px;color: var(--faint)}
.ui-as-side__item{display: flex;align-items: center;gap: 8px;width: 100%;height: 30px;padding: 0 6px;border-radius: 8px;font-size: 13.5px;color: var(--text);text-align: left;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-side__item svg{color: var(--muted)}
.ui-as-side__item:hover{background: var(--hover);color: var(--ink)}
.ui-as-side__item[aria-current="page"]{background: var(--select);color: var(--ink);font-weight: 500}
.ui-as-side__item[aria-current="page"] svg{color: var(--ink)}
a.ui-as-side__item{text-decoration: none;cursor: pointer}
.ui-as-side__label{margin: 16px 0 4px;padding: 0 6px;font-size: 12.5px;line-height: 16px;color: var(--faint)}
.ui-as-side__foot{display: flex;flex-direction: column;gap: 8px;margin-top: auto}
.ui-as-news{position: relative;padding-top: 30px}
.ui-as-news__card{position: relative;z-index: 1;padding: 10px 10px 0;border-radius: 12px;background: var(--card);box-shadow: 0 0 0 1px var(--line), 0 2px 6px rgba(11, 9, 8, 0.04)}
.ui-as-news__card--back{position: absolute;z-index: 0;top: 0;left: 10px;right: 10px;height: 48px;display: flex;align-items: flex-start;justify-content: space-between;padding: 9px 9px 0;background: var(--card);color: var(--faint)}
.ui-as-news[data-count="1"]{padding-top: 0}
.ui-as-news[data-count="1"] .ui-as-news__card--back{display: none}
.ui-as-news__top{display: flex;align-items: center;justify-content: space-between}
.ui-as-news__kicker{font-size: 11.5px;line-height: 15px;font-weight: 500;color: var(--accent)}
.ui-as-news__close{display: grid;place-items: center;width: 18px;height: 18px;margin: -2px -2px 0 0;border-radius: 6px;color: var(--faint)}
.ui-as-news__close:hover{background: var(--hover);color: var(--ink)}
.ui-as-news__title{display: block;margin-top: 4px;font-size: 13.5px;line-height: 18px;font-weight: 600;color: var(--ink)}
.ui-as-news__more{display: flex;align-items: center;justify-content: space-between;width: calc(100% + 20px);height: 34px;margin: 10px -10px 0;padding: 0 10px;border-top: 1px solid var(--line-soft);border-radius: 0 0 12px 12px;font-size: 12.5px;color: var(--muted)}
.ui-as-news__more:hover{background: var(--subtle);color: var(--ink)}
.ui-as-guide-slot{position: relative;flex: none}
.ui-as-guide{position: absolute;z-index: 6;right: 0;bottom: 0;left: 0;overflow: hidden;border-radius: 12px;background: var(--card);box-shadow: 0 0 0 1px var(--line), 0 2px 6px rgba(11, 9, 8, 0.04);transition: height var(--nm-dur-4, 380ms) var(--ease), border-radius var(--nm-dur-4, 380ms) var(--ease), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-guide:not([data-open]):hover{box-shadow: 0 0 0 1px var(--line-strong), 0 2px 6px rgba(11, 9, 8, 0.05)}
.ui-as-guide[data-open]{border-radius: 14px;box-shadow: 0 0 0 1px var(--line), 0 8px 24px -10px rgba(11, 9, 8, 0.14)}
.ui-as-guide__content{animation: ui-as-guide-in var(--nm-dur-4, 380ms) var(--ease) both}
.ui-as-guide[data-state="closing"] .ui-as-guide__content{animation: ui-as-guide-out var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-as-guide[data-state="closing"]{border-radius: 12px;box-shadow: 0 0 0 1px var(--line), 0 2px 6px rgba(11, 9, 8, 0.04)}
@keyframes ui-as-guide-out{to{opacity: 0}
}
@keyframes ui-as-guide-in{from{opacity: 0;transform: translateY(6px)}
to{opacity: 1;transform: none}
}
.ui-as-steps{display: grid;gap: 3px;width: 100%;padding: 10px 10px 9px;text-align: left}
.ui-as-guide .ui-sg__icon-btn[aria-expanded]{display: none}
.ui-as-guide .ui-sg{zoom: 0.86;max-width: none;padding: 12px 4px 4px;border: 0;border-radius: 0;background: transparent;box-shadow: none}
.ui-as-steps__title{display: flex;align-items: center;justify-content: space-between;font-size: 13.5px;line-height: 18px;font-weight: 600;color: var(--ink)}
.ui-as-steps__title svg{color: var(--faint)}
.ui-as-steps__sub{font-size: 12.5px;line-height: 17px;color: var(--muted)}
.ui-as-steps__cheer{color: var(--accent)}
.ui-as-steps__bar{height: 4px;margin-top: 6px;overflow: hidden;border-radius: 2px;background: var(--tray)}
.ui-as-steps__bar i{display: block;min-width: 6px;height: 100%;border-radius: inherit;background: var(--accent);transition: width var(--nm-dur-5, 620ms) var(--ease)}
.ui-as-user{display: flex;align-items: center;gap: 7px;height: 34px;padding: 0 6px;border-radius: 8px;font-size: 13.5px;font-weight: 500;color: var(--ink)}
.ui-as-user img{width: 21px;height: 21px;border-radius: 50%;object-fit: cover;box-shadow: 0 0 0 1px rgba(11, 9, 8, 0.06)}
.ui-as-user svg{margin-left: auto;color: var(--faint)}
.ui-as-user:hover{background: var(--hover)}
.ui-as-main{container: ui-as-main / inline-size;position: relative;min-width: 0;margin: var(--frame-gap) var(--frame-gap) var(--frame-gap) 0;overflow-y: auto;overscroll-behavior: none;transition: margin-left var(--nm-dur-4, 380ms) var(--ease);border: 1px solid var(--line);border-radius: var(--radius-panel);background: var(--panel)}
.ui-as-page{padding: 46px 32px 56px}
.ui-as-page-title{margin: 0;font-size: 22px;line-height: 28px;font-weight: 600;letter-spacing: -0.02em;color: var(--ink)}
.ui-as-page-sub{margin: 6px 0 0;font-size: 13.5px;line-height: 20px;color: var(--muted)}
.ui-as-page-sub a{color: var(--text);text-decoration: underline;text-decoration-color: var(--line-strong);text-underline-offset: 3px}
.ui-as-page-sub a:hover{color: var(--ink);text-decoration-color: currentColor}
.ui-as-section-head{margin-top: 38px}
.ui-as-section-head[data-inline]{display: flex;align-items: center;justify-content: space-between;gap: 16px}
.ui-as-section-head[data-inline] .ui-as-toolbar{margin-top: 0}
.ui-as-section-head__title{margin: 0;font-size: 16px;line-height: 22px;font-weight: 600;letter-spacing: -0.01em;color: var(--ink)}
.ui-as-toolbar{display: flex;align-items: center;justify-content: space-between;gap: 16px;margin-top: 16px}
.ui-as-toolbar__left, .ui-as-toolbar__right{display: flex;align-items: center;gap: 6px}
.ui-as-tabs{position: relative;display: flex;gap: 2px}
.ui-as-tabs__pill{position: absolute;top: 0;left: 0;height: 32px;border-radius: 9px;background: var(--chip);transition: transform var(--nm-dur-4, 380ms) var(--ease), width var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-tabs__tab{position: relative;height: 32px;padding: 0 10px;border-radius: 9px;font-size: 13.5px;color: var(--muted);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-tabs__tab:hover{color: var(--ink)}
.ui-as-tabs__tab[aria-selected="true"]{color: var(--ink)}
.ui-as-tool{display: flex;align-items: center;justify-content: center;gap: 6px;min-width: 32px;height: 32px;border-radius: 9px;background: var(--card);box-shadow: 0 0 0 1px var(--line), var(--shadow);color: var(--text);transition: box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-tool svg{color: var(--muted)}
.ui-as-tool:hover{box-shadow: 0 0 0 1px var(--line-strong), var(--shadow);color: var(--ink)}
.ui-as-tool--label{padding: 0 10px;font-size: 13px}
.ui-as-view{position: relative;display: flex;gap: 2px;height: 32px;padding: 2px;border-radius: 9px;background: var(--chip)}
.ui-as-view__btn{display: grid;place-items: center;width: 30px;border-radius: 7px;color: var(--faint)}
.ui-as-view__btn:hover{color: var(--ink)}
.ui-as-view__btn{position: relative;transition: color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-view__btn[aria-checked="true"]{color: var(--ink)}
.ui-as-view__pill{position: absolute;top: 2px;bottom: 2px;left: 2px;width: 30px;border-radius: 7px;background: var(--card);box-shadow: 0 0 0 1px var(--line), var(--shadow);transition: transform var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-view[data-view="list"] .ui-as-view__pill{transform: translateX(32px)}
.ui-as-search{display: flex;align-items: center;gap: 7px;height: 32px;padding: 0 10px;border-radius: 9px;background: var(--card);box-shadow: 0 0 0 1px var(--line), var(--shadow);color: var(--faint);cursor: text;transition: box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-search:focus-within{box-shadow: 0 0 0 1px var(--line-strong), 0 0 0 3px rgba(11, 9, 8, 0.04)}
.ui-as-search input{flex: 1;min-width: 0;padding: 0;border: 0;background: transparent;font: inherit;font-size: 13px;color: var(--ink)}
.ui-as-search input::placeholder{color: var(--placeholder)}
.ui-as-search__clear{display: grid;flex: none;place-items: center;width: 18px;height: 18px;border-radius: 50%;background: var(--chip);color: var(--muted);animation: ui-as-pop var(--nm-dur-3, 240ms) var(--ease)}
.ui-as-search__clear:hover{color: var(--ink)}
.ui-as-sort svg{transition: transform var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-sort[data-dir="desc"] svg{transform: rotate(180deg)}
.ui-as-tool[data-active]{box-shadow: 0 0 0 1px var(--line-strong), var(--shadow);color: var(--ink)}
.ui-as-tool__count{display: grid;place-items: center;min-width: 18px;height: 18px;padding: 0 5px;border-radius: 999px;background: var(--ink);font-size: 11px;font-weight: 600;color: var(--on-ink);animation: ui-as-pop var(--nm-dur-3, 240ms) var(--ease)}
.ui-as-anchor{position: relative;display: inline-flex}
.ui-as-popover{position: absolute;z-index: 30;top: calc(100% + 6px);left: 0;transform-origin: top left;animation: ui-as-popover var(--nm-dur-3, 240ms) var(--ease)}
.ui-as-popover[data-align="end"]{right: 0;left: auto;transform-origin: top right}
.ui-as-popover[data-side="top"]{top: auto;bottom: calc(100% + 6px);transform-origin: bottom left;animation-name: ui-as-popover-up}
.ui-as-popover[data-side="top"][data-align="end"]{transform-origin: bottom right}
.ui-as-popover[data-side="right"]{top: auto;bottom: 0;left: calc(100% + 12px);transform-origin: bottom left}
@keyframes ui-as-popover-up{from{opacity: 0;transform: scale(0.96) translateY(4px)}
to{opacity: 1;transform: none}
}
.ui-as-popover--filter .ui-fm{zoom: 0.9;width: 340px}
.ui-as-menu{min-width: 168px;padding: 4px;border-radius: 12px;background: var(--card);box-shadow: 0 0 0 1px var(--line), 0 12px 32px -8px rgba(11, 9, 8, 0.16)}
.ui-as-menu__title{display: block;padding: 6px 10px 4px;font-size: 12px;font-weight: 500;color: var(--faint)}
.ui-as-menu__list{display: grid;gap: 1px}
.ui-as-menu__item{display: flex;align-items: center;gap: 9px;width: 100%;min-height: 32px;padding: 0 10px;border-radius: 8px;font-size: 13px;color: var(--text);text-align: left;white-space: nowrap;transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-menu__item[data-rich]{min-height: 44px;padding: 6px 10px}
.ui-as-menu__item > svg{flex: none;color: var(--muted)}
.ui-as-menu__item > svg:last-child:not(:first-child){margin-left: auto;color: var(--ink)}
.ui-as-menu__label{display: grid;flex: 1;gap: 1px;min-width: 0}
.ui-as-menu__label small{font-size: 12px;line-height: 16px;color: var(--faint)}
.ui-as-menu__item:hover{background: var(--hover);color: var(--ink)}
.ui-as-menu__item[aria-checked="true"]{color: var(--ink);font-weight: 500}
.ui-as-menu__item[aria-checked="true"] small{font-weight: 400}
.ui-as-menu__item[data-danger]{color: #b3261e}
.ui-as-menu__item[data-danger] > svg{color: #b3261e}
.ui-as-toast{position: absolute;z-index: 40;left: 50%;bottom: 20px;display: flex;align-items: center;gap: 8px;height: 36px;padding: 0 14px 0 12px;border-radius: 999px;background: var(--ink);font-size: 13px;color: var(--on-ink);box-shadow: 0 10px 24px -8px rgba(11, 9, 8, 0.35);translate: -50% 0;animation: ui-as-toast var(--nm-dur-6, 1100ms) var(--ease) both}
.ui-as-rise{animation: ui-as-rise var(--nm-dur-4, 380ms) var(--ease) both;animation-delay: calc(var(--i, 0) * 35ms)}
@keyframes ui-as-rise{from{opacity: 0;transform: translateY(8px)}
to{opacity: 1;transform: none}
}
@keyframes ui-as-pop{from{opacity: 0;transform: scale(0.6)}
to{opacity: 1;transform: none}
}
@keyframes ui-as-popover{from{opacity: 0;transform: scale(0.96) translateY(-4px)}
to{opacity: 1;transform: none}
}
@keyframes ui-as-toast{0%{opacity: 0;transform: translateY(12px) scale(0.96)}
12%, 85%{opacity: 1;transform: none}
100%{opacity: 0;transform: translateY(6px)}
}
@media (prefers-reduced-motion: reduce){.ui-as *, .ui-as *::before, .ui-as *::after{animation-duration: 1ms !important;transition-duration: 1ms !important}
}
.ui-as-search input::-webkit-search-cancel-button{display: none}
.ui-as-empty{display: flex;flex-direction: column;align-items: center;margin-top: 16px;padding: 48px 24px 52px;border: 1px dashed var(--line-strong);border-radius: 14px;text-align: center}
.ui-as-empty[data-tall]{padding: 48px 24px 48px}
.ui-as-empty__icon{display: grid;place-items: center;width: 42px;height: 42px;border-radius: 11px;background: var(--chip);color: var(--muted)}
.ui-as-empty__title{margin-top: 16px;font-size: 14px;line-height: 20px;font-weight: 500;color: var(--ink)}
.ui-as-empty__text{max-width: 430px;margin: 6px 0 0;font-size: 13px;line-height: 19px;color: var(--muted);text-wrap: balance}
.ui-as-empty > .ui-button{margin-top: 18px}
.ui-as-folder-card__icon, .ui-as-folder-head__icon{position: relative;flex: none;width: 30px;height: 25px}
.ui-as-folder-card__icon .ui-fd, .ui-as-folder-head__icon .ui-fd{position: absolute;top: 50%;left: 50%;width: 75px;translate: -50% -50%}
:is(.ui-as-folder-card, .ui-as-folder-head):hover .ui-fd-icon{transform: translate(-50%, -48%) scale(1.03)}
:is(.ui-as-folder-card, .ui-as-folder-head):hover .ui-fd-doc--left{transform: translate(32px, 70px) rotate(9deg)}
:is(.ui-as-folder-card, .ui-as-folder-head):hover .ui-fd-doc--right{transform: translate(286px, 76px) rotate(5deg)}
:is(.ui-as-folder-card, .ui-as-folder-head):hover .ui-fd-doc--middle{transform: translate(166px, 52px) rotate(-7deg)}
:is(.ui-as-folder-card, .ui-as-folder-head):hover .ui-fd-front{top: 24.8%;border-radius: 3cqw 3cqw 6.333cqw 6.333cqw;transform: translateZ(2.33cqw) rotateX(-9deg)}
.ui-as-meta{display: inline-flex;align-items: center;gap: 4px;font-size: 12.5px;line-height: 17px;color: var(--muted)}
.ui-as-meta svg{color: var(--faint)}
.ui-as-template{display: grid;width: 239px;text-align: left}
.ui-as-template__preview{display: block;height: 158px;padding: 7px;border-radius: 14px;background: var(--card);box-shadow: 0 0 0 1px var(--line), var(--shadow);transition: box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-template:hover .ui-as-template__preview{box-shadow: 0 0 0 1px var(--line-strong), 0 2px 8px rgba(11, 9, 8, 0.05)}
.ui-as-template__name{margin-top: 10px;font-size: 13.5px;line-height: 18px;font-weight: 500;color: var(--ink)}
.ui-as-template .ui-as-meta{margin-top: 2px}
.ui-as-doc{--doc-back: #ff8a5c;--doc-glass-1: rgba(255, 138, 92, 0.72);--doc-glass-2: rgba(255, 107, 53, 0.78);--doc-shade: 60, 130, 180;--doc-paper: #f0e8df;display: flex;align-items: center;justify-content: center;height: 100%;border-radius: 10px;background: var(--card)}
.ui-as-doc[data-color="rose"]{--doc-back: #e2544a;--doc-glass-1: rgba(240, 147, 140, 0.74);--doc-glass-2: rgba(226, 84, 74, 0.8);--doc-shade: 190, 60, 88;--doc-paper: #f2eae2}
.ui-as-doc[data-color="emerald"]{--doc-back: #2f8d5c;--doc-glass-1: rgba(79, 157, 110, 0.74);--doc-glass-2: rgba(47, 141, 92, 0.8);--doc-shade: 40, 140, 96;--doc-paper: #f1e9e0}
.ui-as-doc__art{position: relative;display: block;width: 72px;height: 92px}
.ui-as-doc__back{position: absolute;inset: 0;border-radius: 11px;background: var(--doc-back);box-shadow: inset 0 1px 0 rgba(255, 253, 251, 0.45), 0 10px 18px -8px rgba(var(--doc-shade), 0.45);transform: translate(10px, -4px) rotate(8deg);transition: transform var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-doc__page{position: absolute;inset: 0;display: flex;flex-direction: column;gap: 5px;padding: 13px 11px;border-radius: 11px;background: linear-gradient(180deg, var(--doc-page, #fff) 0%, var(--doc-paper) 100%);box-shadow: 0 0 0 1px var(--doc-edge, rgba(0, 0, 0, 0.1)), 0 3px 5px rgba(var(--doc-shade), 0.16);transform: rotate(-3deg);transition: transform var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-doc__title{display: block;width: 58%;height: 5px;margin-bottom: 3px;border-radius: 3px;background: var(--doc-ink-strong, rgba(0, 0, 0, 0.2))}
.ui-as-doc__line{display: block;height: 4px;border-radius: 2px;background: var(--doc-ink, rgba(0, 0, 0, 0.1))}
.ui-as-doc__image{display: block;height: 26px;margin-bottom: 2px;border-radius: 5px;background: linear-gradient(160deg, var(--doc-glass-1), var(--doc-glass-2));opacity: 0.55}
.ui-as-sheet{display: grid;grid-template-columns: repeat(3, 1fr);gap: 2px}
.ui-as-sheet i{height: 8px;border-radius: 2px;background: var(--doc-cell, rgba(0, 0, 0, 0.07))}
.ui-as-sheet i:nth-child(-n + 3){background: rgba(var(--doc-shade), 0.35)}
.ui-as-doc__type{position: absolute;right: -12px;bottom: 10px;z-index: 2;padding: 3px 6px;border-radius: 5px;background: linear-gradient(180deg, rgba(11, 9, 8, 0) 55%, rgba(var(--doc-shade), 0.25) 100%), linear-gradient(180deg, var(--doc-glass-1), var(--doc-glass-2));box-shadow: inset 0 0 0 1px rgba(255, 253, 251, 0.35), inset 0 1px 0 rgba(255, 253, 251, 0.6), 0 6px 12px -4px rgba(var(--doc-shade), 0.45);-webkit-backdrop-filter: blur(4px) saturate(1.15);backdrop-filter: blur(4px) saturate(1.15);font-size: 10px;line-height: 13px;font-weight: 600;color: #fffdfb;text-shadow: 0 1px 2px rgba(var(--doc-shade), 0.45);transition: transform var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-template:hover .ui-as-doc__back{transform: translate(14px, -7px) rotate(12deg)}
.ui-as-template:hover .ui-as-doc__page{transform: translateY(-4px) rotate(-5deg)}
.ui-as-template:hover .ui-as-doc__type{transform: translate(2px, -2px)}
.ui-as-side__logo{font-size: 10.5px;font-weight: 600;color: var(--ink)}
.ui-as-user__initials{display: grid;place-items: center;width: 21px;height: 21px;border-radius: 50%;background: var(--accent-soft);font-size: 9.5px;font-weight: 600;color: var(--accent)}
:where(.dark, [data-theme="dark"]) .ui-as-doc{--doc-page: #342a20;--doc-edge: rgba(255, 253, 251, 0.1);--doc-ink: rgba(255, 253, 251, 0.14);--doc-ink-strong: rgba(255, 253, 251, 0.3);--doc-cell: rgba(255, 253, 251, 0.08)}
:where(.dark, [data-theme="dark"]) .ui-as-doc{--doc-paper: #2f261d}
:where(.dark, [data-theme="dark"]) .ui-as-doc[data-color="rose"]{--doc-paper: #2f261d}
:where(.dark, [data-theme="dark"]) .ui-as-doc[data-color="emerald"]{--doc-paper: #2c241c}
.ui-as-scrim{display: none}
@container ui-as (max-width: 900px){.ui-as-app > .ui-as-main{grid-row: 1;grid-column: 1 / -1;margin-left: var(--frame-gap)}
.ui-as-app > .ui-as-side{position: absolute;z-index: 50;top: 0;bottom: 0;left: 0;width: min(264px, calc(100% - 56px));padding: 10px 10px 10px 12px;border-radius: 0 18px 18px 0;background: var(--page);box-shadow: 0 0 0 1px var(--line), 0 24px 48px -12px rgba(11, 9, 8, 0.28)}
.ui-as-app:not([data-drawer]) > .ui-as-side{visibility: hidden;translate: calc(-100% - 24px) 0;transition: translate 380ms var(--ease), visibility 0s 380ms}
.ui-as-app[data-drawer] > .ui-as-side{visibility: visible;opacity: 1;translate: 0 0;transition: translate var(--nm-dur-4, 380ms) var(--ease), visibility 0s}
.ui-as-app > .ui-as-scrim{display: block;position: absolute;z-index: 45;inset: 0;background: rgba(11, 9, 8, 0.28);visibility: hidden;opacity: 0;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), visibility 0s 300ms}
.ui-as-app[data-drawer] > .ui-as-scrim{visibility: visible;opacity: 1;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), visibility 0s}
:where(.dark, [data-theme="dark"]) .ui-as-app > .ui-as-scrim{background: rgba(11, 9, 8, 0.55)}
.ui-as-app:not([data-drawer]) > .ui-as-side-open{visibility: visible;opacity: 1;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 160ms, visibility 0s}
.ui-as-app > .ui-as-side-open{left: calc(var(--frame-gap) + 9px);background: var(--panel)}
.ui-as-app > .ui-as-side-open:hover{background: var(--chip)}
.ui-as-page{padding: 46px 24px 48px}
.ui-as-main .ui-as-file-grid{display: grid;grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))}
.ui-as-main .ui-as-file-grid .ui-as-template{width: 100%}
.ui-as-main .ui-as-file-grid .ui-as-template__name{overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-as-main .ui-as-file-grid .ui-as-meta{display: block;overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-as-main .ui-as-file-grid .ui-as-meta svg{display: inline-block;vertical-align: -2px}
.ui-as-toolbar{flex-wrap: wrap;row-gap: 10px}
.ui-as-toolbar__right{flex-wrap: wrap}
.ui-as-section-head[data-inline]{flex-wrap: wrap;row-gap: 12px}
}
@container ui-as (max-width: 600px){.ui-as-app > *{--frame-gap: 6px}
.ui-as-app > .ui-as-main{border-radius: 16px}
.ui-as-page{padding: 52px 16px 40px}
.ui-as-page-title{font-size: 20px;line-height: 26px}
.ui-as-section-head{margin-top: 32px}
.ui-as-toolbar__left, .ui-as-toolbar__right{width: 100%}
.ui-as-toolbar__right .ui-as-search{order: 9;flex: 1 1 100%;width: auto !important}
.ui-as-toolbar__right > .ui-button:last-child{margin-left: auto}
.ui-as-tabs{max-width: 100%;overflow-x: auto;scrollbar-width: none}
.ui-as-tabs__tab{flex: none}
.ui-as-empty{padding: 36px 18px 40px}
.ui-as-popover--filter .ui-fm{width: 300px}
.ui-as-main .ui-as-file-grid{grid-template-columns: repeat(2, minmax(0, 1fr));gap: 16px 10px}
.ui-as-main .ui-as-file-grid .ui-as-template__preview{height: 128px}
}
/* ui-button — composed into this item */
/* Colors and motion as variables – override them on .ui-button (see Theming in the docs) */
.ui-button {
  --ui-btn-ink: #1c1713;
  --ui-btn-on-ink: #faf7f4;
  --ui-btn-dark-top: #342a20;
  --ui-btn-dark-bottom: #241e19;
  --ui-btn-dark-hover-top: #3c3125;
  --ui-btn-dark-hover-bottom: #2b231b;
  --ui-btn-edge-top: #473a2d;
  --ui-btn-edge-mid: #352a20;
  --ui-btn-edge-bottom: #1e1814;
  --ui-btn-ring: #14100d;
  --ui-btn-dark-shadow: rgba(11, 9, 8, 0.1);
  --ui-btn-surface: #fffdfb;
  --ui-btn-surface-hover: #faf7f4;
  --ui-btn-surface-shadow: rgba(11, 9, 8, 0.06);
  --ui-btn-line: #ded4ca;
  --ui-btn-muted: #68584b;
  --ui-btn-hover: #3d3226;
  --ui-btn-fill: #eee6de;
  --ui-btn-shine: rgba(255, 253, 251, 0.82);
  --ui-btn-shine-on-ink: rgba(255, 253, 251, 0.95);
  --ui-btn-danger: #b3261e;
  --ui-btn-danger-bg: #f1e9e1;
  --ui-btn-focus: rgba(28, 23, 19, 0.22);
  --ui-btn-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --ui-btn-load: 650ms;
  --h: 40px;
  --px: 16px;
  --gap: 8px;
  --fs: 14px;
  --icon: 18px;
  --radius: 12px;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--gap);
  height: var(--h);
  padding: 0 var(--px);
  margin: 0;
  border: 1px solid transparent;
  border-radius: var(--radius);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: var(--fs);
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.01em;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  -webkit-font-smoothing: antialiased;
  transition:
    background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    border-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    transform 160ms var(--ui-btn-ease),
    opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-button[data-size="sm"] {
  --h: 32px;
  --px: 12px;
  --gap: 6px;
  --fs: 13px;
  --icon: 16px;
  --radius: 10px;
}
.ui-button[data-size="lg"] {
  --h: 48px;
  --px: 20px;
  --gap: 10px;
  --fs: 15px;
  --icon: 20px;
  --radius: 14px;
}
.ui-button[data-icon-only] {
  width: var(--h);
  padding: 0;
}
/* primary: like the send button */
/* primary: a dark gradient with a light edge running down the border and a 1px ring */
.ui-button[data-variant="primary"] {
  background:
    linear-gradient(var(--ui-btn-dark-top), var(--ui-btn-dark-bottom)) padding-box,
    linear-gradient(var(--ui-btn-edge-top), var(--ui-btn-edge-mid), var(--ui-btn-edge-bottom)) border-box;
  color: var(--ui-btn-on-ink);
  box-shadow:
    0 0 0 1px var(--ui-btn-ring),
    0 2px 4px var(--ui-btn-dark-shadow);
}
.ui-button[data-variant="primary"]:hover:not(:disabled) {
  background:
    linear-gradient(var(--ui-btn-dark-hover-top), var(--ui-btn-dark-hover-bottom)) padding-box,
    linear-gradient(var(--ui-btn-edge-top), var(--ui-btn-edge-mid), var(--ui-btn-edge-bottom)) border-box;
}
/* secondary: white with the card outline */
.ui-button[data-variant="secondary"] {
  background: var(--ui-btn-surface);
  border-color: var(--ui-btn-line);
  color: var(--ui-btn-ink);
  box-shadow: 0 1px 2px var(--ui-btn-surface-shadow);
}
.ui-button[data-variant="secondary"]:hover:not(:disabled) {
  background: var(--ui-btn-surface-hover);
}
/* ghost: a muted label, the gray layer appears on hover */
.ui-button[data-variant="ghost"] {
  background: transparent;
  color: var(--ui-btn-muted);
}
.ui-button[data-variant="ghost"]:hover:not(:disabled) {
  background: var(--ui-btn-fill);
  color: var(--ui-btn-hover);
}
/* destructive: red label on a light red fill */
.ui-button[data-variant="destructive"] {
  background: var(--ui-btn-danger-bg);
  color: var(--ui-btn-danger);
}
.ui-button[data-variant="destructive"]:hover:not(:disabled) {
  background: color-mix(in srgb, var(--ui-btn-danger-bg) 88%, var(--ui-btn-danger));
}
.ui-button[data-variant="destructive"] .ui-button__label::after {
  --ui-btn-shine: rgba(255, 253, 251, 0.82);
}
.ui-button:active:not(:disabled):not([data-loading]) {
  transform: scale(0.97);
}
.ui-button:focus-visible {
  outline: 2px solid var(--ui-btn-focus);
  outline-offset: 2px;
}
.ui-button:disabled {
  opacity: 0.4;
  cursor: default;
}
.ui-button[data-loading] {
  cursor: default;
}
.ui-button__icon {
  display: grid;
  place-items: center;
  flex: none;
  width: var(--icon);
  height: var(--icon);
}
.ui-button__icon > svg {
  width: 100%;
  height: 100%;
}
/* Morph: the button clips while its width glides; changed parts blur in */
.ui-button {
  overflow: clip;
}
.ui-button[data-ready] .ui-button__label {
  animation: ui-button-label-in var(--nm-dur-4, 380ms) cubic-bezier(0.25, 1, 0.5, 1) both;
}
.ui-button[data-ready] .ui-button__icon {
  animation: ui-button-icon-in var(--nm-dur-5, 620ms) cubic-bezier(0.25, 1, 0.5, 1) both;
}
/* Loading: a band sweeps across a copy of the label, like "Request approval" in the Chat Composer */
.ui-button__label {
  position: relative;
}
.ui-button__label::after {
  content: attr(data-text);
  content: attr(data-text) / "";
  position: absolute;
  inset: 0;
  white-space: nowrap;
  color: transparent;
  background: linear-gradient(90deg, transparent 38%, var(--ui-btn-shine) 50%, transparent 62%) 100% 0 / 300% 100%
    no-repeat;
  -webkit-background-clip: text;
  background-clip: text;
  opacity: 0;
  pointer-events: none;
}
.ui-button[data-variant="primary"] .ui-button__label::after {
  --ui-btn-shine: var(--ui-btn-shine-on-ink);
}
.ui-button[data-loading] .ui-button__label {
  color: color-mix(in srgb, currentColor 55%, transparent);
}
.ui-button[data-loading] .ui-button__label::after {
  opacity: 1;
  animation: ui-button-sweep calc(var(--ui-btn-load) * 1.6) linear infinite;
}
.ui-button__spinner {
  animation: ui-button-spin var(--nm-dur-6, 1100ms) linear infinite;
}
@keyframes ui-button-label-in {
  from {
    opacity: 0;
    filter: blur(3px);
    transform: translateY(25%);
  }
}
@keyframes ui-button-icon-in {
  from {
    opacity: 0;
    filter: blur(2px);
    transform: scale(0.7);
  }
}
@keyframes ui-button-spin {
  to {
    transform: rotate(1turn);
  }
}
@keyframes ui-button-sweep {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: 0% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ui-button[data-ready] .ui-button__label,
  .ui-button[data-ready] .ui-button__icon {
    animation: none;
  }
  .ui-button {
    transition-duration: 1ms;
  }
  .ui-button[data-loading] .ui-button__label::after {
    animation: none;
    opacity: 0;
  }
}
/* Dark mode: follows a .dark class or data-theme="dark" on any ancestor, e.g. <html> */
:where(.dark, [data-theme="dark"]) .ui-button {
  /* primary inverts: a light gradient with dark text */
  --ui-btn-on-ink: #191411;
  --ui-btn-dark-top: #f4ece4;
  --ui-btn-dark-bottom: #dfd5cc;
  --ui-btn-dark-hover-top: #fffdfb;
  --ui-btn-dark-hover-bottom: #ebe3db;
  --ui-btn-edge-top: #fffdfb;
  --ui-btn-edge-mid: #ebe3db;
  --ui-btn-edge-bottom: #c8bdb2;
  --ui-btn-ring: rgba(11, 9, 8, 0.6);
  --ui-btn-dark-shadow: rgba(11, 9, 8, 0.4);
  --ui-btn-shine-on-ink: rgba(255, 253, 251, 0.9);
  --ui-btn-ink: #ebe3da;
  --ui-btn-surface: #27201a;
  --ui-btn-surface-hover: #2b231b;
  --ui-btn-surface-shadow: rgba(11, 9, 8, 0.4);
  --ui-btn-line: rgba(255, 253, 251, 0.1);
  --ui-btn-muted: #857567;
  --ui-btn-hover: #ebe3da;
  --ui-btn-fill: rgba(255, 253, 251, 0.06);
  --ui-btn-shine: rgba(235, 227, 218, 0.95);
  --ui-btn-danger: #e2544a;
  --ui-btn-danger-bg: rgba(226, 84, 74, 0.16);
  --ui-btn-focus: rgba(235, 227, 218, 0.3);
}
/* ui-agent-plan — composed into this item */
.ui-pl{--ui-pl-tray: #eee6de;--ui-pl-card: #fffdfb;--ui-pl-ink: #1c1713;--ui-pl-text: #5f4f41;--ui-pl-muted: #807063;--ui-pl-faint: #a89b90;--ui-pl-line: #eae2d9;--ui-pl-raise: #fffdfb;--ui-pl-hover: #f5efe8;--ui-pl-quiet-hover: #ddd3c9;--ui-pl-press: rgba(28, 23, 19, 0.05);--ui-pl-chip: #f2eae2;--ui-pl-chip-text: #4d3f31;--ui-pl-marker: #eee6de;--ui-pl-rail: #b6aa9f;--ui-pl-on-ink: #fffdfb;--ui-pl-red: #b3261e;--ui-pl-red-bg: #f7f1eb;--ui-pl-red-ring: rgba(179, 38, 30, 0.32);--ui-pl-ring: rgba(28, 23, 19, 0.22);--ui-pl-lift: 0 1px 2px rgba(11, 9, 8, 0.06), 0 12px 28px -10px rgba(11, 9, 8, 0.2);--ui-pl-ease: cubic-bezier(0.22, 1, 0.36, 1);--ui-pl-inset: 30px;container-type: inline-size;position: relative;box-sizing: border-box;display: grid;width: 100%;max-width: 460px;padding: 4px;border-radius: 20px;background: var(--ui-pl-tray);color: var(--ui-pl-text);font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 14px;line-height: 20px;letter-spacing: -0.006em;text-align: left;-webkit-font-smoothing: antialiased}
.ui-pl__card{position: relative;border-radius: 16px;background: var(--ui-pl-card);box-shadow: 0 0 0 1px var(--ui-pl-line), 0 1px 2px rgba(11, 9, 8, 0.04)}
.ui-pl:not([data-status="draft"]){--ui-pl-inset: 14px}
.ui-pl[data-dragging]{cursor: grabbing;user-select: none;-webkit-user-select: none}
.ui-pl *, .ui-pl *::before, .ui-pl *::after{box-sizing: border-box}
.ui-pl svg{display: block;width: 100%;height: 100%;overflow: visible}
:where(.ui-pl) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;letter-spacing: inherit;color: inherit;cursor: pointer}
.ui-pl__sr{position: absolute;width: 1px;height: 1px;margin: -1px;padding: 0;overflow: hidden;clip: rect(0 0 0 0);white-space: nowrap;border: 0}
.ui-pl__head{display: grid;gap: 4px;padding: 16px 18px 8px}
.ui-pl__meta{display: flex;align-items: center;gap: 10px;min-height: 18px;font-size: 12.5px;line-height: 18px;color: var(--ui-pl-muted)}
.ui-pl__state{display: inline-flex;align-items: center;gap: 7px;min-width: 0}
.ui-pl__state-label{overflow: hidden;text-overflow: ellipsis;white-space: nowrap;font-variant-numeric: tabular-nums}
.ui-pl__state-icon, .ui-pl__status-icon{flex: none;width: 13px;height: 13px;fill: none;stroke: currentColor;stroke-width: 1.5;stroke-linecap: round;stroke-linejoin: round}
.ui-pl__state-icon circle[r=".6"]{fill: currentColor}
.ui-pl__estimate{display: inline-flex;align-items: center;gap: 5px;margin-left: auto;white-space: nowrap;font-variant-numeric: tabular-nums}
.ui-pl__estimate svg{width: 13px;height: 13px;fill: none;stroke: currentColor;stroke-width: 1.4;stroke-linecap: round;stroke-linejoin: round}
.ui-pl__title{margin: 0;color: var(--ui-pl-ink);font-size: 15px;font-weight: 600;line-height: 22px;letter-spacing: -0.012em;text-wrap: balance}
.ui-pl__list{position: relative;margin: 0;padding: 2px 6px 6px;list-style: none}
.ui-pl__step{position: relative;display: grid;grid-template-columns: 22px minmax(0, 1fr) auto;column-gap: 12px;align-items: start;padding: 10px 10px 10px var(--ui-pl-inset);border-radius: 10px;outline: none;transition: transform var(--nm-dur-4, 380ms) var(--ui-pl-ease), padding var(--nm-dur-4, 380ms) var(--ui-pl-ease), height var(--nm-dur-3, 240ms) var(--ui-pl-ease), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-pl[data-status="draft"] .ui-pl__step:hover{background: var(--ui-pl-hover)}
.ui-pl__step:focus-visible{outline: 2px solid var(--ui-pl-ring);outline-offset: 0}
.ui-pl__step[data-dragging]{z-index: 2;background: var(--ui-pl-raise) !important;box-shadow: inset 0 0 0 1px var(--ui-pl-line), var(--ui-pl-lift);transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-pl__step[data-removing]{height: 0 !important;padding-top: 0;padding-bottom: 0;overflow: hidden;opacity: 0;pointer-events: none}
.ui-pl__step[data-enter]{animation: ui-pl-enter 380ms var(--ui-pl-ease) both}
.ui-pl__grip{position: absolute;top: 10px;left: 6px;display: grid;place-items: center;width: 18px;height: 22px;margin-top: -1px;border-radius: 5px;color: var(--ui-pl-faint);fill: currentColor;cursor: grab;touch-action: none;opacity: 0;transition: opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-pl__grip svg{width: 14px;height: 14px}
.ui-pl__step:hover .ui-pl__grip, .ui-pl__step:focus-visible .ui-pl__grip, .ui-pl__step[data-dragging] .ui-pl__grip{opacity: 1}
.ui-pl__grip:hover, .ui-pl__step[data-dragging] .ui-pl__grip{color: var(--ui-pl-text);background: var(--ui-pl-press)}
.ui-pl__step[data-dragging] .ui-pl__grip{cursor: grabbing}
.ui-pl__marker{position: relative;z-index: 1;display: grid;place-items: center;justify-self: center;width: 20px;height: 20px;border-radius: 999px;background: var(--ui-pl-card);box-shadow: inset 0 0 0 1px var(--ui-pl-line);color: var(--ui-pl-muted);font-size: 11px;font-weight: 500;line-height: 1;font-variant-numeric: tabular-nums;transition: background-color var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-pl__marker > *{grid-area: 1 / 1;animation: ui-pl-pop var(--nm-dur-4, 380ms) var(--ui-pl-ease) both}
.ui-pl__num{animation: none !important}
.ui-pl__marker .ui-pl__spinner{width: 13px;height: 13px}
.ui-pl__mark{width: 11px !important;height: 11px !important;fill: none;stroke: currentColor;stroke-width: 1.9;stroke-linecap: round;stroke-linejoin: round}
.ui-pl__step[data-step="active"] .ui-pl__marker{box-shadow: none;color: var(--ui-pl-ink)}
.ui-pl__step[data-step="done"] .ui-pl__marker{background: var(--ui-pl-marker);box-shadow: none;color: var(--ui-pl-ink)}
.ui-pl__step[data-step="failed"] .ui-pl__marker{background: var(--ui-pl-red-bg);box-shadow: inset 0 0 0 1px var(--ui-pl-red-ring);color: var(--ui-pl-red)}
.ui-pl__step[data-step="skipped"] .ui-pl__marker{box-shadow: none;outline: 1px dashed var(--ui-pl-faint);outline-offset: -1px}
.ui-pl__draw{stroke-dasharray: 1;stroke-dashoffset: 1;animation: ui-pl-draw var(--nm-dur-4, 380ms) var(--ui-pl-ease) 80ms forwards}
.ui-pl__spinner line{stroke: currentColor;stroke-width: 1.7;stroke-linecap: round;opacity: 0.18;animation: ui-pl-ray var(--nm-dur-5, 620ms) linear infinite}
.ui-pl__main{display: grid;gap: 2px;min-width: 0}
.ui-pl__name{color: var(--ui-pl-ink);font-weight: 500;overflow-wrap: anywhere;transition: color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-pl[data-status="draft"] .ui-pl__name{cursor: text}
.ui-pl__step[data-step="pending"] .ui-pl__name{color: var(--ui-pl-text)}
.ui-pl__step[data-step="skipped"] .ui-pl__name{color: var(--ui-pl-muted);text-decoration: line-through;text-decoration-color: var(--ui-pl-faint)}
.ui-pl__sub{display: flex;flex-wrap: wrap;align-items: center;gap: 3px 8px;min-width: 0;color: var(--ui-pl-muted);font-size: 12.5px;line-height: 18px}
.ui-pl__detail{min-width: 0;overflow-wrap: anywhere}
.ui-pl__tool{padding: 1px 6px;border-radius: 6px;background: var(--ui-pl-chip);color: var(--ui-pl-chip-text);font-family: ui-monospace, "SF Mono", Menlo, monospace;font-size: 11px;line-height: 16px;letter-spacing: 0;white-space: nowrap}
.ui-pl__edit{width: calc(100% + 14px);height: 26px;margin: -3px -7px;padding: 0 6px;border: 0;border-radius: 7px;background: var(--ui-pl-raise);box-shadow: inset 0 0 0 1px var(--ui-pl-line), 0 0 0 3px var(--ui-pl-press);color: var(--ui-pl-ink);font: inherit;font-weight: 500;letter-spacing: inherit;outline: none}
.ui-pl__fail{display: grid;justify-items: start;gap: 8px;margin-top: 4px;animation: ui-pl-fade var(--nm-dur-4, 380ms) var(--ui-pl-ease) both}
.ui-pl__error{color: var(--ui-pl-red);font-size: 12.5px;line-height: 18px;overflow-wrap: anywhere}
.ui-pl__retry{display: inline-flex;align-items: center;gap: 6px;height: 28px;padding: 0 10px 0 9px;border-radius: 8px;background: var(--ui-pl-raise);box-shadow: inset 0 0 0 1px var(--ui-pl-line), 0 1px 2px rgba(11, 9, 8, 0.04);color: var(--ui-pl-ink);font-size: 12.5px;font-weight: 500;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 160ms var(--ui-pl-ease)}
.ui-pl__retry svg{width: 13px;height: 13px;fill: none;stroke: currentColor;stroke-width: 1.6;stroke-linecap: round;stroke-linejoin: round}
.ui-pl__retry:hover{background: var(--ui-pl-hover)}
.ui-pl__retry:active{transform: scale(0.97)}
.ui-pl__aside{display: flex;align-items: center;min-height: 20px;color: var(--ui-pl-muted);font-size: 12.5px;font-variant-numeric: tabular-nums;white-space: nowrap}
.ui-pl__time{animation: ui-pl-fade var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-pl__step[data-step="active"] .ui-pl__time{color: var(--ui-pl-ink)}
.ui-pl__remove{display: grid;place-items: center;width: 24px;height: 24px;margin: -2px -4px 0 0;border-radius: 7px;color: var(--ui-pl-faint);fill: none;stroke: currentColor;stroke-width: 1.6;stroke-linecap: round;opacity: 0;transition: opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-pl__remove svg{width: 14px;height: 14px}
.ui-pl__step:hover .ui-pl__remove, .ui-pl__step:focus-visible .ui-pl__remove, .ui-pl__remove:focus-visible{opacity: 1}
.ui-pl__remove:hover{color: var(--ui-pl-ink);background: var(--ui-pl-press)}
.ui-pl__remove:focus-visible, .ui-pl__retry:focus-visible, .ui-pl__btn:focus-visible{outline: 2px solid var(--ui-pl-ring);outline-offset: 1px}
.ui-pl__rail{position: absolute;top: 35px;bottom: -5px;left: calc(var(--ui-pl-inset) + 10.5px);width: 1px;overflow: hidden;background: var(--ui-pl-line);opacity: 0;pointer-events: none;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-pl:not([data-status="draft"]) .ui-pl__rail{opacity: 1;transition-delay: 240ms}
.ui-pl__rail::after{content: "";position: absolute;inset: 0;background: var(--ui-pl-rail);transform: scaleY(0);transform-origin: top;transition: transform var(--nm-dur-5, 620ms) var(--ui-pl-ease)}
.ui-pl__step[data-step="done"] .ui-pl__rail::after, .ui-pl__step[data-step="skipped"] .ui-pl__rail::after{transform: scaleY(1)}
.ui-pl__tail{display: grid;grid-template-rows: 1fr;transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-pl-ease), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-pl:not([data-status="draft"]) .ui-pl__tail{grid-template-rows: 0fr;opacity: 0}
.ui-pl__tail-inner{min-height: 0;overflow: hidden}
.ui-pl__add{display: grid;grid-template-columns: 22px minmax(0, 1fr);column-gap: 12px;align-items: center;margin: 0 6px 8px;padding: 7px 10px 7px var(--ui-pl-inset);border-radius: 10px;cursor: text;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-pl__add:hover, .ui-pl__add:focus-within{background: var(--ui-pl-hover)}
.ui-pl__add-icon{display: grid;place-items: center;width: 22px;height: 22px;border-radius: 999px;outline: 1px dashed var(--ui-pl-faint);outline-offset: -1px;color: var(--ui-pl-muted);fill: none;stroke: currentColor;stroke-width: 1.6;stroke-linecap: round}
.ui-pl__add-icon svg{width: 12px;height: 12px}
.ui-pl__add input{width: 100%;min-width: 0;height: 22px;padding: 0;border: 0;background: none;color: var(--ui-pl-ink);font: inherit;letter-spacing: inherit;outline: none}
.ui-pl__add input::placeholder{color: var(--ui-pl-muted);opacity: 1}
.ui-pl__foot{display: flex;align-items: center;gap: 12px;min-height: 46px;padding: 0 6px 0 12px;font-size: 12.5px;color: var(--ui-pl-muted);animation: ui-pl-fade var(--nm-dur-4, 380ms) var(--ui-pl-ease) both}
.ui-pl__hint{min-width: 0;overflow: hidden;color: var(--ui-pl-muted);font-size: 12px;text-overflow: ellipsis;white-space: nowrap}
.ui-pl__actions{display: flex;flex: none;gap: 8px;margin-left: auto}
.ui-pl__btn{display: inline-flex;align-items: center;gap: 6px;height: 32px;padding: 0 13px;border-radius: 9px;font-size: 13px;font-weight: 500;white-space: nowrap;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 160ms var(--ui-pl-ease)}
.ui-pl__btn:active{transform: scale(0.97)}
.ui-pl__btn--primary{padding-right: 11px;background: var(--ui-pl-ink);color: var(--ui-pl-on-ink);box-shadow: 0 1px 2px rgba(11, 9, 8, 0.12)}
.ui-pl__btn--primary:hover{opacity: 0.88}
.ui-pl__btn--primary:disabled{opacity: 0.4;cursor: default;transform: none}
.ui-pl__btn--primary svg{width: 12px;height: 12px;fill: currentColor}
.ui-pl__btn--quiet{padding: 0 11px;color: var(--ui-pl-text)}
.ui-pl__btn--quiet:hover{background: var(--ui-pl-quiet-hover);color: var(--ui-pl-ink)}
.ui-pl__btn--quiet svg{width: 13px;height: 13px;fill: none;stroke: currentColor;stroke-width: 1.6;stroke-linecap: round;stroke-linejoin: round}
.ui-pl__status{display: inline-flex;align-items: center;gap: 8px;min-width: 0;color: var(--ui-pl-ink)}
.ui-pl__foot[data-phase="failed"] .ui-pl__status{color: var(--ui-pl-red)}
.ui-pl__status-label{overflow: hidden;text-overflow: ellipsis;white-space: nowrap;font-variant-numeric: tabular-nums}
.ui-pl__elapsed{margin-left: auto;padding-right: 6px;font-variant-numeric: tabular-nums;white-space: nowrap}
@media (hover: none){.ui-pl__grip, .ui-pl__remove{opacity: 1}
}
@container (max-width: 400px){.ui-pl__hint{display: none}
}
@container (max-width: 340px){.ui-pl__head{padding: 14px 14px 8px}
.ui-pl__list{padding-inline: 4px}
.ui-pl__step, .ui-pl__add{column-gap: 10px;padding-right: 8px}
.ui-pl__add{margin-inline: 4px}
.ui-pl__foot{padding-left: 10px}
.ui-pl__btn{padding: 0 11px}
}
@keyframes ui-pl-fade{from{opacity: 0;transform: translateY(3px)}
to{opacity: 1;transform: none}
}
@keyframes ui-pl-enter{from{opacity: 0;transform: translateY(6px)}
to{opacity: 1;transform: none}
}
@keyframes ui-pl-pop{from{opacity: 0;transform: scale(0.5)}
to{opacity: 1;transform: none}
}
@keyframes ui-pl-draw{to{stroke-dashoffset: 0}
}
@keyframes ui-pl-ray{0%{opacity: 1}
100%{opacity: 0.18}
}
@media (prefers-reduced-motion: reduce){.ui-pl *, .ui-pl *::before, .ui-pl *::after{animation-duration: 1ms !important;animation-delay: 0ms !important;animation-iteration-count: 1 !important;transition-duration: 1ms !important;transition-delay: 0ms !important}
.ui-pl__spinner line{opacity: 0.6}
.ui-pl__draw{stroke-dashoffset: 0}
}
:where(.dark, [data-theme="dark"]) .ui-pl{--ui-pl-tray: #181310;--ui-pl-card: #1e1914;--ui-pl-ink: #ebe3da;--ui-pl-text: #958678;--ui-pl-muted: #847467;--ui-pl-faint: #554637;--ui-pl-line: #2c241b;--ui-pl-raise: #231d18;--ui-pl-hover: #231d18;--ui-pl-quiet-hover: #26201a;--ui-pl-press: rgba(255, 253, 251, 0.07);--ui-pl-chip: #27201a;--ui-pl-chip-text: #a4978c;--ui-pl-marker: #29221b;--ui-pl-rail: #473a2d;--ui-pl-on-ink: #1e1914;--ui-pl-red: #e2544a;--ui-pl-red-bg: rgba(226, 84, 74, 0.08);--ui-pl-red-ring: rgba(226, 84, 74, 0.4);--ui-pl-ring: rgba(235, 227, 218, 0.3);--ui-pl-lift: 0 1px 2px rgba(11, 9, 8, 0.4), 0 14px 32px -10px rgba(11, 9, 8, 0.7)}
/* ui-thinking-loader — composed into this item */
.ui-tl {
  --ui-tl-ink: #1c1713;
  --ui-tl-text: #5f4f41;
  --ui-tl-ray: #1c1713;
  --ui-tl-bg: #fffdfb;
  --ui-tl-line: #e1d8cf;
  --ui-tl-shine: rgba(255, 253, 251, 0.82);
  --ui-tl-done: #1c1713;
  --ui-tl-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --ui-tl-h: 34px;
  --ui-tl-font: 14px;
  --ui-tl-icon: 15px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  height: var(--ui-tl-h);
  padding: 0 15px 0 12px;
  border-radius: 999px;
  background: var(--ui-tl-bg);
  box-shadow: inset 0 0 0 1px var(--ui-tl-line), 0 1px 2px rgba(11, 9, 8, 0.04);
  color: var(--ui-tl-text);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: var(--ui-tl-font);
  font-weight: 450;
  line-height: 1;
  letter-spacing: -0.006em;
  vertical-align: middle;
  -webkit-font-smoothing: antialiased;
}
.ui-tl[data-size="sm"] {
  --ui-tl-h: 28px;
  --ui-tl-font: 13px;
  --ui-tl-icon: 13px;
  gap: 7px;
  padding: 0 12px 0 10px;
}
.ui-tl[data-variant="plain"] {
  padding: 0;
  background: none;
  box-shadow: none;
}
/* Spinner and check share one square and swap with a little scale */
.ui-tl__icon {
  position: relative;
  flex: none;
  width: var(--ui-tl-icon);
  height: var(--ui-tl-icon);
}
.ui-tl__icon svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  transition: opacity 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-4, 380ms) var(--ui-tl-ease);
}
.ui-tl__spinner line {
  stroke: var(--ui-tl-ray);
  stroke-width: 1.6;
  stroke-linecap: round;
  opacity: 0.18;
  animation: ui-tl-ray var(--nm-dur-5, 620ms) linear infinite;
}
.ui-tl__check {
  opacity: 0;
  transform: scale(0.6);
  fill: none;
  stroke: var(--ui-tl-done);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.ui-tl__check path {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
}
.ui-tl[data-done] .ui-tl__spinner {
  opacity: 0;
  transform: scale(0.6) rotate(-45deg);
}
.ui-tl[data-done] .ui-tl__check {
  opacity: 1;
  transform: none;
}
.ui-tl[data-done] .ui-tl__check path {
  animation: ui-tl-draw var(--nm-dur-4, 380ms) var(--ui-tl-ease) 120ms forwards;
}
/* The text box glides to the width of the incoming label; labels roll through it */
.ui-tl__text {
  position: relative;
  display: block;
  height: 1.3em;
  overflow: hidden;
  transition: width var(--nm-dur-4, 380ms) var(--ui-tl-ease);
}
.ui-tl__label {
  position: absolute;
  top: 0;
  left: 0;
  line-height: 1.3em;
  white-space: nowrap;
}
.ui-tl[data-done] .ui-tl__label {
  color: var(--ui-tl-ink);
}
.ui-tl__label--in {
  animation: ui-tl-in var(--nm-dur-4, 380ms) var(--ui-tl-ease) both;
}
.ui-tl__label--out {
  animation: ui-tl-out var(--nm-dur-4, 380ms) var(--ui-tl-ease) both;
}
/* A soft light sweeping over the label while it works */
.ui-tl__shine::after {
  content: attr(data-text);
  content: attr(data-text) / "";
  position: absolute;
  inset: 0;
  white-space: nowrap;
  color: transparent;
  background: linear-gradient(90deg, transparent 38%, var(--ui-tl-shine) 50%, transparent 62%) 100% 0 / 300% 100% no-repeat;
  -webkit-background-clip: text;
  background-clip: text;
  animation: ui-tl-sweep var(--nm-dur-6, 1100ms) linear infinite;
  pointer-events: none;
}
@keyframes ui-tl-ray {
  0% { opacity: 1; }
  100% { opacity: 0.18; }
}
@keyframes ui-tl-in {
  from { opacity: 0; transform: translateY(70%); filter: blur(3px); }
  to { opacity: 1; transform: none; filter: none; }
}
@keyframes ui-tl-out {
  from { opacity: 1; transform: none; filter: none; }
  to { opacity: 0; transform: translateY(-70%); filter: blur(3px); }
}
@keyframes ui-tl-draw {
  to { stroke-dashoffset: 0; }
}
@keyframes ui-tl-sweep {
  from { background-position: 100% 0; }
  to { background-position: 0% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .ui-tl *,
  .ui-tl *::after {
    animation-duration: 1ms !important;
    animation-delay: 0ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
  }
  .ui-tl__spinner line { opacity: 0.6; }
  .ui-tl__shine::after { display: none; }
  .ui-tl__check path { stroke-dashoffset: 0; }
}
/* Dark mode: follows a .dark class or data-theme="dark" on any ancestor, e.g. <html> */
:where(.dark, [data-theme="dark"]) .ui-tl {
  --ui-tl-ink: #ebe3da;
  --ui-tl-text: #857567;
  --ui-tl-ray: #ebe3da;
  --ui-tl-bg: #1c1713;
  --ui-tl-line: rgba(255, 253, 251, 0.1);
  --ui-tl-shine: rgba(255, 253, 251, 0.95);
  --ui-tl-done: #ebe3da;
}
/* ui-inline-diff — composed into this item */
.ui-df{--ui-df-ink: #1c1713;--ui-df-text: #4a3d2f;--ui-df-muted: #807063;--ui-df-tray: #eee6de;--ui-df-line: #eae2d9;--ui-df-bg: #fffdfb;--ui-df-soft: #f4ece5;--ui-df-add: rgba(47, 141, 92, 0.1);--ui-df-add-strong: rgba(47, 141, 92, 0.18);--ui-df-add-ink: #1a7a4a;--ui-df-del: rgba(179, 38, 30, 0.08);--ui-df-del-strong: rgba(179, 38, 30, 0.15);--ui-df-del-ink: #b3261e;--ui-df-strike: rgba(179, 38, 30, 0.55);--ui-df-ok: #1a7a4a;--ui-df-pop: #1c1713;--ui-df-pop-ink: #fffdfb;--ui-df-pop-soft: rgba(255, 253, 251, 0.14);--ui-df-pop-kbd: rgba(255, 253, 251, 0.55);--ui-df-primary: #1c1713;--ui-df-primary-ink: #fffdfb;--ui-df-focus: rgba(28, 23, 19, 0.35);--ui-df-shadow: 0 1px 2px rgba(11, 9, 8, 0.04);--ui-df-ease: cubic-bezier(0.22, 1, 0.36, 1);position: relative;box-sizing: border-box;display: grid;width: 100%;min-width: 0;padding: 4px;border-radius: 20px;background: var(--ui-df-tray);color: var(--ui-df-text);font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;-webkit-font-smoothing: antialiased;text-align: left}
.ui-df *, .ui-df *::before, .ui-df *::after{box-sizing: border-box}
.ui-df__label{display: flex;align-items: center;gap: 6px;min-width: 0;padding: 6px 8px 4px;color: var(--ui-df-muted);font-size: 12.5px;line-height: 1.3;letter-spacing: -0.003em}
.ui-df__label span{overflow: hidden;text-overflow: ellipsis;white-space: nowrap}
.ui-df__label svg{flex: none;width: 13px;height: 13px;fill: currentColor}
.ui-df__card{position: relative;min-width: 0;border-radius: 16px;background: var(--ui-df-bg);box-shadow: 0 0 0 1px var(--ui-df-line), var(--ui-df-shadow)}
.ui-df__head{padding: 10px 10px 10px 16px;border-bottom: 1px solid var(--ui-df-line)}
.ui-df__bar{display: grid}
.ui-df__layer{grid-area: 1 / 1;display: flex;flex-wrap: wrap;align-items: center;justify-content: space-between;gap: 8px;min-width: 0;opacity: 0;visibility: hidden;transform: translateY(4px);filter: blur(2px);transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-4, 380ms) var(--ui-df-ease), filter var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), visibility 0s 420ms}
.ui-df__layer[data-show]{opacity: 1;visibility: visible;transform: none;filter: none;transition: opacity var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 80ms, transform var(--nm-dur-4, 380ms) var(--ui-df-ease) 80ms, filter var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 80ms, visibility 0s}
.ui-df__card{container: ui-df-card / inline-size}
@container ui-df-card (max-width: 400px){.ui-df__word{position: absolute;width: 1px;height: 1px;overflow: hidden;clip: rect(0 0 0 0);white-space: nowrap}
}
.ui-df__count{display: inline-flex;align-items: center;gap: 7px;color: var(--ui-df-ink);font-size: 13px;font-weight: 500;line-height: 1;letter-spacing: -0.006em;white-space: nowrap}
.ui-df__num{display: inline-grid;place-items: center;min-width: 20px;height: 20px;padding: 0 6px;border-radius: 999px;background: var(--ui-df-add);color: var(--ui-df-add-ink);font-size: 11.5px;font-weight: 600;font-variant-numeric: tabular-nums}
.ui-df__ok{width: 16px;height: 16px;fill: none;stroke: var(--ui-df-ok);stroke-width: 1.8;stroke-linecap: round;stroke-linejoin: round;stroke-dasharray: 1;stroke-dashoffset: 1}
.ui-df[data-done] .ui-df__ok{animation: ui-df-draw var(--nm-dur-4, 380ms) var(--ui-df-ease) 220ms forwards}
.ui-df__actions{display: inline-flex;align-items: center;gap: 6px;margin-left: auto}
.ui-df__nav{display: inline-flex;gap: 2px;margin-right: 2px}
.ui-df__btn, .ui-df__icon{appearance: none;display: inline-flex;align-items: center;justify-content: center;gap: 6px;height: 30px;margin: 0;border: 0;border-radius: 8px;background: transparent;color: var(--ui-df-ink);font: inherit;font-size: 13px;font-weight: 500;line-height: 1;letter-spacing: -0.006em;white-space: nowrap;cursor: pointer;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 160ms var(--ui-df-ease);-webkit-tap-highlight-color: transparent}
.ui-df__btn{padding: 0 11px;box-shadow: inset 0 0 0 1px var(--ui-df-line)}
.ui-df__icon{width: 28px;color: var(--ui-df-muted)}
.ui-df__btn svg, .ui-df__icon svg{width: 14px;height: 14px;fill: none;stroke: currentColor;stroke-width: 1.6;stroke-linecap: round;stroke-linejoin: round}
.ui-df__btn:hover:not(:disabled){background: var(--ui-df-soft)}
.ui-df__icon:hover:not(:disabled){background: var(--ui-df-soft);color: var(--ui-df-ink)}
.ui-df__btn--primary{background: var(--ui-df-primary);color: var(--ui-df-primary-ink);box-shadow: none}
.ui-df__btn--primary:hover:not(:disabled){background: var(--ui-df-primary);opacity: 0.88}
.ui-df__btn:active:not(:disabled), .ui-df__icon:active:not(:disabled){transform: scale(0.97)}
.ui-df__btn:disabled, .ui-df__icon:disabled{opacity: 0.4;cursor: default}
.ui-df__btn:focus-visible, .ui-df__icon:focus-visible{outline: 2px solid var(--ui-df-focus);outline-offset: 2px}
.ui-df__body{padding: 16px 18px 18px}
.ui-df__text{margin: 0;color: var(--ui-df-text);font-size: 15px;line-height: 1.65;letter-spacing: -0.006em;white-space: pre-line;overflow-wrap: anywhere}
.ui-df__chg{border-radius: 4px;cursor: pointer;scroll-margin: 64px 0 24px}
.ui-df__chg:not([data-state="pending"]){cursor: auto}
.ui-df__chg:focus{outline: none}
.ui-df__chg:focus-visible{outline: 2px solid var(--ui-df-focus);outline-offset: 2px}
.ui-df__del, .ui-df__ins{padding: 1px 2px;border-radius: 4px;-webkit-box-decoration-break: clone;box-decoration-break: clone;font-size: 1em;transition: background-color var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), text-decoration-color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), font-size var(--nm-dur-4, 380ms) var(--ui-df-ease), padding var(--nm-dur-4, 380ms) var(--ui-df-ease), margin var(--nm-dur-4, 380ms) var(--ui-df-ease), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-df__del{background: var(--ui-df-del);color: var(--ui-df-del-ink);text-decoration: line-through;text-decoration-color: var(--ui-df-strike);text-decoration-thickness: 1.2px}
.ui-df__ins{background: var(--ui-df-add);color: var(--ui-df-add-ink);text-decoration: none}
.ui-df__del + .ui-df__ins{margin-left: 3px}
.ui-df__chg[data-active] .ui-df__del{background: var(--ui-df-del-strong)}
.ui-df__chg[data-active] .ui-df__ins{background: var(--ui-df-add-strong)}
.ui-df__chg[data-state="accepted"] .ui-df__del, .ui-df__chg[data-state="rejected"] .ui-df__ins{font-size: 0;padding: 0;margin: 0;opacity: 0}
.ui-df__chg[data-state="accepted"] .ui-df__ins, .ui-df__chg[data-state="rejected"] .ui-df__del{padding: 0;margin: 0;background: transparent;color: inherit;text-decoration-color: transparent}
.ui-df__pop{position: absolute;top: 0;left: 0;z-index: 2;display: flex;align-items: center;gap: 2px;padding: 3px;border-radius: 10px;background: var(--ui-df-pop);color: var(--ui-df-pop-ink);box-shadow: 0 6px 20px -6px rgba(11, 9, 8, 0.35), 0 1px 2px rgba(11, 9, 8, 0.2);opacity: 0;visibility: hidden;transform: translateY(4px) scale(0.96);transform-origin: 50% 100%;pointer-events: none;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-3, 240ms) var(--ui-df-ease), left var(--nm-dur-4, 380ms) var(--ui-df-ease), top var(--nm-dur-4, 380ms) var(--ui-df-ease), visibility 0s 260ms}
.ui-df__pop[data-open]{opacity: 1;visibility: visible;transform: none;pointer-events: auto;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-3, 240ms) var(--ui-df-ease), left var(--nm-dur-4, 380ms) var(--ui-df-ease), top var(--nm-dur-4, 380ms) var(--ui-df-ease), visibility 0s}
.ui-df__pop[data-snap]{transition-property: opacity, transform, visibility}
.ui-df__pbtn{appearance: none;display: inline-flex;align-items: center;gap: 6px;height: 28px;margin: 0;padding: 0 8px 0 7px;border: 0;border-radius: 7px;background: transparent;color: inherit;font: inherit;font-size: 12.5px;font-weight: 500;line-height: 1;white-space: nowrap;cursor: pointer;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-df__pbtn:hover{background: var(--ui-df-pop-soft)}
.ui-df__pbtn svg{width: 14px;height: 14px;fill: none;stroke: currentColor;stroke-width: 1.8;stroke-linecap: round;stroke-linejoin: round}
.ui-df__pbtn kbd{display: inline-grid;place-items: center;min-width: 17px;height: 17px;padding: 0 4px;border-radius: 4px;background: var(--ui-df-pop-soft);color: var(--ui-df-pop-kbd);font: inherit;font-size: 10.5px;font-weight: 500}
.ui-df__sep{width: 1px;height: 16px;background: var(--ui-df-pop-soft)}
.ui-df__sr{position: absolute;width: 1px;height: 1px;margin: -1px;padding: 0;overflow: hidden;clip: rect(0 0 0 0);white-space: nowrap;border: 0}
@keyframes ui-df-draw{to{stroke-dashoffset: 0}
}
@media (max-width: 400px){.ui-df__nav{display: none}
.ui-df__head{padding-left: 14px}
.ui-df__label{padding-left: 6px}
.ui-df__body{padding: 14px 14px 16px}
}
@media (hover: none) and (pointer: coarse){.ui-df__pbtn kbd{display: none}
.ui-df__pbtn{height: 34px;padding: 0 11px 0 9px}
}
@media (prefers-reduced-motion: reduce){.ui-df *, .ui-df *::before, .ui-df *::after{animation-duration: 1ms !important;animation-delay: 0ms !important;transition-duration: 1ms !important;transition-delay: 0ms !important}
.ui-df__layer{filter: none;transform: none}
}
:where(.dark, [data-theme="dark"]) .ui-df{--ui-df-ink: #ebe3da;--ui-df-text: #a6998e;--ui-df-muted: #847467;--ui-df-tray: #181310;--ui-df-line: #2c241b;--ui-df-bg: #1e1914;--ui-df-soft: #27201a;--ui-df-add: rgba(47, 141, 92, 0.13);--ui-df-add-strong: rgba(47, 141, 92, 0.22);--ui-df-add-ink: #4f9d6e;--ui-df-del: rgba(226, 84, 74, 0.12);--ui-df-del-strong: rgba(226, 84, 74, 0.2);--ui-df-del-ink: #f0938c;--ui-df-strike: rgba(240, 147, 140, 0.6);--ui-df-ok: #4f9d6e;--ui-df-pop: #f4ece4;--ui-df-pop-ink: #1c1713;--ui-df-pop-soft: rgba(11, 9, 8, 0.08);--ui-df-pop-kbd: rgba(11, 9, 8, 0.5);--ui-df-primary: #ebe3da;--ui-df-primary-ink: #1e1914;--ui-df-focus: rgba(255, 253, 251, 0.35);--ui-df-shadow: 0 1px 2px rgba(11, 9, 8, 0.3)}
/* ui-tool-call — composed into this item */
.ui-tc,
.ui-tc-group {
  --ui-tc-ink: #1c1713;
  --ui-tc-text: #5f4f41;
  --ui-tc-muted: #807063;
  --ui-tc-bg: #fffdfb;
  --ui-tc-line: #e1d8cf;
  --ui-tc-hover: #faf7f4;
  --ui-tc-tile: #f4ece5;
  --ui-tc-code: #faf7f4;
  --ui-tc-ring: #fffdfb;
  --ui-tc-red: #b3261e;
  --ui-tc-red-bg: rgba(179, 38, 30, 0.06);
  --ui-tc-red-line: rgba(179, 38, 30, 0.16);
  --ui-tc-key: #1c1713;
  --ui-tc-str: #1a7a4a;
  --ui-tc-num: #d9541f;
  --ui-tc-lit: #c2703a;
  --ui-tc-shine: rgba(255, 253, 251, 0.82);
  --ui-tc-focus: rgba(28, 23, 19, 0.22);
  --ui-tc-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --ui-tc-mono: ui-monospace, "SF Mono", Menlo, monospace;
  box-sizing: border-box;
  min-width: 0;
  color: var(--ui-tc-text);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 13.5px;
  line-height: 1.4;
  letter-spacing: -0.006em;
  -webkit-font-smoothing: antialiased;
}
.ui-tc *,
.ui-tc-group * { box-sizing: border-box; }
.ui-tc {
  position: relative;
  border-radius: 12px;
  background: var(--ui-tc-bg);
  box-shadow: inset 0 0 0 1px var(--ui-tc-line), 0 1px 2px rgba(11, 9, 8, 0.04);
}
.ui-tc-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
/* Header: icon, name + summary, status, chevron – everything truncates before it overflows */
.ui-tc__head {
  all: unset;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  padding: 8px 10px 8px 9px;
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-tc[data-open] .ui-tc__head { border-radius: 12px 12px 0 0; }
.ui-tc__head:focus-visible,
.ui-tc-group__head:focus-visible,
.ui-tc__copy:focus-visible,
.ui-tc__more:focus-visible,
.ui-tc__retry:focus-visible {
  outline: 2px solid var(--ui-tc-focus);
  outline-offset: 2px;
}
@media (hover: hover) {
  .ui-tc__head:hover { background: var(--ui-tc-hover); }
  .ui-tc-group__head:hover { background: var(--ui-tc-hover); color: var(--ui-tc-ink); }
  .ui-tc__copy:hover { background: var(--ui-tc-hover); color: var(--ui-tc-ink); }
  .ui-tc__more:hover { color: var(--ui-tc-ink); }
  .ui-tc__retry:hover { background: var(--ui-tc-hover); }
}
.ui-tc__icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: var(--ui-tc-tile);
  box-shadow: inset 0 0 0 1px var(--ui-tc-line);
  color: var(--ui-tc-ink);
}
.ui-tc__icon > svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
.ui-tc__main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.ui-tc__name {
  flex: 0 1 auto;
  max-width: 55%;
  overflow: hidden;
  color: var(--ui-tc-ink);
  font-family: var(--ui-tc-mono);
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ui-tc__summary {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  color: var(--ui-tc-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ui-tc__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
  color: var(--ui-tc-muted);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  animation: ui-tc-in var(--nm-dur-4, 380ms) var(--ui-tc-ease) both;
}
.ui-tc[data-status="error"] .ui-tc__status { color: var(--ui-tc-red); }
.ui-tc__status > svg { width: 14px; height: 14px; flex: none; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.ui-tc__spinner circle { stroke: currentColor; stroke-width: 1.6; opacity: 0.22; }
.ui-tc__spinner path { stroke: var(--ui-tc-ink); stroke-width: 1.6; }
.ui-tc__spinner { animation: ui-tc-spin var(--nm-dur-5, 620ms) linear infinite; }
.ui-tc__ok { stroke: var(--ui-tc-ink); stroke-width: 1.8; }
.ui-tc__ok path { stroke-dasharray: 1; stroke-dashoffset: 1; animation: ui-tc-draw var(--nm-dur-4, 380ms) var(--ui-tc-ease) 80ms forwards; }
.ui-tc__err { stroke: var(--ui-tc-red); stroke-width: 1.5; }
.ui-tc__chevron {
  flex: none;
  width: 14px;
  height: 14px;
  fill: none;
  stroke: var(--ui-tc-muted);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform var(--nm-dur-4, 380ms) var(--ui-tc-ease);
}
.ui-tc[data-open] > .ui-tc__head .ui-tc__chevron,
.ui-tc-group[data-open] > .ui-tc-group__head .ui-tc__chevron { transform: rotate(180deg); }
/* Body: grows from 0fr to 1fr, so the height animates without measuring */
.ui-tc__body {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: grid-template-rows 380ms var(--ui-tc-ease), opacity 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-tc[data-open] > .ui-tc__body,
.ui-tc-group[data-open] > .ui-tc__body {
  grid-template-rows: 1fr;
  opacity: 1;
}
.ui-tc__clip { min-height: 0; overflow: hidden; }
.ui-tc__sections {
  display: grid;
  gap: 12px;
  padding: 12px;
  border-top: 1px solid var(--ui-tc-line);
}
.ui-tc__section { display: grid; gap: 6px; min-width: 0; }
.ui-tc__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 24px;
}
.ui-tc__label { color: var(--ui-tc-muted); font-size: 12px; font-weight: 500; }
.ui-tc__pending { margin: 0; color: var(--ui-tc-muted); font-size: 12.5px; }
.ui-tc__copy {
  all: unset;
  position: relative;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  color: var(--ui-tc-muted);
  cursor: pointer;
  transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-tc__copy svg {
  position: absolute;
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-4, 380ms) var(--ui-tc-ease), filter var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-tc__copy-done { opacity: 0; transform: scale(0.6); filter: blur(2px); stroke-width: 1.7; }
.ui-tc__copy[data-copied] { color: var(--ui-tc-ink); }
.ui-tc__copy[data-copied] .ui-tc__copy-icon { opacity: 0; transform: scale(0.6); filter: blur(2px); }
.ui-tc__copy[data-copied] .ui-tc__copy-done { opacity: 1; transform: none; filter: none; }
/* Code: wraps instead of scrolling sideways; capped blocks fade out at the bottom */
.ui-tc__code {
  position: relative;
  margin: 0;
  padding: 10px 12px;
  overflow: hidden;
  border-radius: 8px;
  background: var(--ui-tc-code);
  box-shadow: inset 0 0 0 1px var(--ui-tc-line);
  color: var(--ui-tc-muted);
  font-family: var(--ui-tc-mono);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  tab-size: 2;
  transition: max-height var(--nm-dur-4, 380ms) var(--ui-tc-ease);
}
.ui-tc__code code { display: block; font: inherit; }
.ui-tc__code::after {
  content: "";
  position: absolute;
  left: 1px;
  right: 1px;
  bottom: 1px;
  height: 56px;
  border-radius: 0 0 7px 7px;
  background: linear-gradient(to bottom, transparent, var(--ui-tc-code));
  opacity: 0;
  transition: opacity 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  pointer-events: none;
}
.ui-tc__code[data-capped]::after { opacity: 1; }
.ui-tc__t-key { color: var(--ui-tc-key); }
.ui-tc__t-str { color: var(--ui-tc-str); }
.ui-tc__t-num { color: var(--ui-tc-num); }
.ui-tc__t-lit { color: var(--ui-tc-lit); }
.ui-tc__more {
  all: unset;
  justify-self: start;
  padding: 2px 4px;
  margin-left: -4px;
  border-radius: 5px;
  color: var(--ui-tc-text);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
/* Error: the message and an optional retry */
.ui-tc__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 9px 10px 9px 11px;
  border-radius: 8px;
  background: var(--ui-tc-red-bg);
  box-shadow: inset 0 0 0 1px var(--ui-tc-red-line);
}
.ui-tc__error > .ui-tc__err { flex: none; width: 14px; height: 14px; margin-top: 2px; fill: none; stroke-linecap: round; }
.ui-tc__error-text {
  flex: 1;
  min-width: 0;
  margin: 0;
  color: var(--ui-tc-red);
  font-size: 13px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.ui-tc__retry {
  all: unset;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: none;
  height: 26px;
  margin: -3px 0;
  padding: 0 10px 0 8px;
  border-radius: 7px;
  background: var(--ui-tc-bg);
  box-shadow: inset 0 0 0 1px var(--ui-tc-line), 0 1px 2px rgba(11, 9, 8, 0.04);
  color: var(--ui-tc-ink);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-tc__retry svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.ui-tc__retry:active svg { transform: rotate(-60deg); transition: transform var(--nm-dur-2, 160ms) var(--ui-tc-ease); }
/* Group: one quiet line with the tool icons stacked, the cards below */
.ui-tc-group { display: grid; }
.ui-tc-group__head {
  all: unset;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 9px;
  justify-self: start;
  max-width: 100%;
  min-height: 36px;
  padding: 4px 10px 4px 5px;
  border-radius: 10px;
  color: var(--ui-tc-text);
  cursor: pointer;
  transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-tc-group__stack { display: flex; flex: none; }
.ui-tc-group__stack .ui-tc__icon {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  box-shadow: inset 0 0 0 1px var(--ui-tc-line), 0 0 0 2px var(--ui-tc-ring);
  animation: ui-tc-pop var(--nm-dur-4, 380ms) var(--ui-tc-ease) both;
}
.ui-tc-group__stack .ui-tc__icon + .ui-tc__icon { margin-left: -5px; }
.ui-tc-group__stack .ui-tc__icon > svg { width: 13px; height: 13px; }
.ui-tc-group__title {
  display: flex;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
  white-space: nowrap;
  animation: ui-tc-in var(--nm-dur-4, 380ms) var(--ui-tc-ease) both;
}
.ui-tc-group__label {
  position: relative;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: inherit;
  font-weight: 500;
}
.ui-tc-group__failed { flex: none; color: var(--ui-tc-red); }
.ui-tc-group__time { flex: none; color: var(--ui-tc-muted); font-variant-numeric: tabular-nums; }
.ui-tc-group__list { display: grid; gap: 8px; padding-top: 8px; }
/* A soft light sweeping over "Using tools…" */
.ui-tc__shine::after {
  content: attr(data-text);
  content: attr(data-text) / "";
  position: absolute;
  inset: 0;
  white-space: nowrap;
  color: transparent;
  background: linear-gradient(90deg, transparent 38%, var(--ui-tc-shine) 50%, transparent 62%) 100% 0 / 300% 100% no-repeat;
  -webkit-background-clip: text;
  background-clip: text;
  animation: ui-tc-sweep var(--nm-dur-6, 1100ms) linear infinite;
  pointer-events: none;
}
@keyframes ui-tc-in {
  from { opacity: 0; transform: translateY(3px); filter: blur(2px); }
  to { opacity: 1; transform: none; filter: none; }
}
@keyframes ui-tc-pop {
  from { opacity: 0; transform: scale(0.6); }
  to { opacity: 1; transform: none; }
}
@keyframes ui-tc-spin { to { transform: rotate(360deg); }
 }
@keyframes ui-tc-draw { to { stroke-dashoffset: 0; }
 }
@keyframes ui-tc-sweep {
  from { background-position: 100% 0; }
  to { background-position: 0% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .ui-tc *,
  .ui-tc-group *,
  .ui-tc *::after,
  .ui-tc-group *::after {
    animation-duration: 1ms !important;
    animation-delay: 0ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
  }
  .ui-tc__shine::after { display: none; }
  .ui-tc__ok path { stroke-dashoffset: 0; }
}
/* Dark mode: follows a .dark class or data-theme="dark" on any ancestor, e.g. <html> */
:where(.dark, [data-theme="dark"]) .ui-tc,
:where(.dark, [data-theme="dark"]) .ui-tc-group {
  --ui-tc-ink: #ebe3da;
  --ui-tc-text: #958678;
  --ui-tc-muted: #716156;
  --ui-tc-bg: #1c1713;
  --ui-tc-line: rgba(255, 253, 251, 0.1);
  --ui-tc-hover: rgba(255, 253, 251, 0.035);
  --ui-tc-tile: #221c17;
  --ui-tc-code: #221c17;
  --ui-tc-ring: #1c1713;
  --ui-tc-red: #e2544a;
  --ui-tc-red-bg: rgba(226, 84, 74, 0.08);
  --ui-tc-red-line: rgba(226, 84, 74, 0.2);
  --ui-tc-key: #ebe3da;
  --ui-tc-str: #4f9d6e;
  --ui-tc-num: #e8b05c;
  --ui-tc-lit: #ff8a5c;
  --ui-tc-shine: rgba(255, 253, 251, 0.95);
  --ui-tc-focus: rgba(255, 253, 251, 0.3);
}
:where(.dark, [data-theme="dark"]) .ui-tc { box-shadow: inset 0 0 0 1px var(--ui-tc-line); }
.ui-ar{display: flex;height: 100%;min-height: 0}
.ui-ar__main{display: flex;flex: 1;flex-direction: column;min-width: 0}
.ui-ar__bar{display: flex;flex: none;align-items: center;justify-content: space-between;gap: 12px;height: 52px;padding: 0 12px 0 20px;border-bottom: 1px solid var(--line-soft);color: var(--muted)}
.ui-ar__crumbs{display: flex;align-items: center;gap: 8px;min-width: 0;font-size: 13.5px;white-space: nowrap}
.ui-ar__crumbs i{font-style: normal;color: var(--faint)}
.ui-ar__crumbs b{overflow: hidden;font-weight: 500;color: var(--ink);text-overflow: ellipsis}
.ui-ar__tools{display: flex;flex: none;align-items: center;gap: 6px}
.ui-ar__tools .ui-as-icon-btn[aria-pressed="true"]{background: var(--chip);color: var(--ink)}
.ui-ar__time{display: flex;align-items: center;gap: 6px;margin-right: 6px;font-size: 13px;color: var(--muted);font-variant-numeric: tabular-nums}
.ui-ar__pill{display: inline-flex;flex: none;align-items: center;gap: 6px;height: 22px;margin-left: 4px;padding: 0 9px 0 8px;border-radius: 999px;background: var(--accent-soft);font-size: 12px;font-weight: 500;color: var(--accent)}
.ui-ar__pill span{width: 6px;height: 6px;border-radius: 50%;background: currentColor}
.ui-ar__pill[data-phase="running"] span{animation: ui-ar-breathe var(--nm-dur-6, 1100ms) ease-in-out infinite}
.ui-ar__pill[data-phase="waiting"]{background: rgba(217, 149, 48, 0.1);color: #d9541f}
.ui-ar__pill[data-phase="waiting"] span{animation: ui-ar-breathe var(--nm-dur-6, 1100ms) ease-in-out infinite}
.ui-ar__pill[data-phase="done"]{background: rgba(47, 141, 92, 0.1);color: #1a7a4a}
.ui-ar__pill[data-phase="stopped"]{background: var(--chip);color: var(--muted)}
@keyframes ui-ar-breathe{50%{opacity: 0.35}
}
.ui-ar__scroll{flex: 1;min-height: 0;overflow-y: auto;padding: 32px 32px 40px}
.ui-ar__column{display: flex;flex-direction: column;gap: 28px;max-width: 680px;margin: 0 auto}
.ui-ar__column .ui-pl{max-width: none}
.ui-ar__label{display: block;padding-bottom: 12px;font-size: 12.5px;font-weight: 500;line-height: 16px;color: var(--faint)}
.ui-ar__feed{display: flex;flex-direction: column}
.ui-ar__feed > .ui-ar__label{padding-bottom: 14px}
.ui-ar__entry{position: relative;display: flex;flex-direction: column;gap: 10px;padding: 0 0 20px 34px}
.ui-ar__entry::before{content: "";position: absolute;top: 26px;bottom: 4px;left: 11px;width: 1px;background: var(--line)}
.ui-ar__entry-head{display: flex;align-items: center;min-height: 22px;font-size: 13.5px;font-weight: 500;color: var(--ink)}
.ui-ar__num{position: absolute;top: 0;left: 0;display: grid;place-items: center;width: 23px;height: 23px;border-radius: 50%;box-shadow: inset 0 0 0 1px var(--line);font-size: 11.5px;font-weight: 500;color: var(--muted);font-variant-numeric: tabular-nums;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-ar__num[data-done]{background: var(--chip);box-shadow: none;color: var(--ink)}
.ui-ar__note{display: flex;align-items: center;gap: 7px;font-size: 13px;color: var(--muted)}
.ui-ar__note[data-state="pending"]{color: #d9541f}
.ui-ar__note[data-state="approved"]{color: #1a7a4a}
.ui-ar__note button{margin-left: 4px;font-weight: 500;color: var(--ink);text-decoration: underline;text-underline-offset: 2px}
.ui-ar__loader{align-self: flex-start;margin-left: 34px}
.ui-ar__panel{display: flex;flex: none;flex-direction: column;width: 360px;min-height: 0;border-left: 1px solid var(--line-soft)}
.ui-ar__panel-body{flex: 1;min-height: 0;overflow-y: auto}
.ui-ar__section{display: flex;flex-direction: column;padding: 20px}
.ui-ar__section + .ui-ar__section{border-top: 1px solid var(--line-soft)}
.ui-ar__section > .ui-ap + .ui-ap{margin-top: 12px}
.ui-ar__count{display: grid;place-items: center;min-width: 18px;height: 18px;padding: 0 5px;border-radius: 999px;background: #d99530;font-size: 11px;font-weight: 600;color: #fffdfb;animation: ui-as-pop var(--nm-dur-4, 380ms) var(--ease) both}
.ui-ar__quiet{display: flex;flex-direction: column;align-items: center;gap: 4px;padding: 14px 12px 16px;border-radius: 14px;background: var(--subtle);box-shadow: inset 0 0 0 1px var(--line-soft);text-align: center}
.ui-ar__quiet > span{display: grid;place-items: center;width: 34px;height: 34px;margin-bottom: 6px;border-radius: 10px;background: var(--chip);color: var(--muted)}
.ui-ar__quiet b{font-size: 13.5px;font-weight: 500;color: var(--ink)}
.ui-ar__quiet p{max-width: 240px;margin: 0;font-size: 12.5px;line-height: 18px;color: var(--muted)}
.ui-ar__details{display: grid;gap: 12px;margin: 0}
.ui-ar__details div{display: flex;align-items: center;justify-content: space-between;font-size: 13px}
.ui-ar__details dt{display: flex;align-items: center;gap: 8px;color: var(--muted)}
.ui-ar__details dd{margin: 0;font-weight: 500;color: var(--ink);font-variant-numeric: tabular-nums}
:where(.dark, [data-theme="dark"]) .ui-ar__pill[data-phase="waiting"], :where(.dark, [data-theme="dark"]) .ui-ar__note[data-state="pending"]{color: #e8b05c}
:where(.dark, [data-theme="dark"]) .ui-ar__pill[data-phase="waiting"]{background: rgba(232, 176, 92, 0.12)}
:where(.dark, [data-theme="dark"]) .ui-ar__pill[data-phase="done"], :where(.dark, [data-theme="dark"]) .ui-ar__note[data-state="approved"]{color: #4f9d6e}
:where(.dark, [data-theme="dark"]) .ui-ar__pill[data-phase="done"]{background: rgba(79, 157, 110, 0.12)}
.ui-ar__main > .ui-ar__bar{transition: padding-left var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-app[data-collapsed] .ui-ar__main > .ui-ar__bar{padding-left: 52px}
.ui-ar__scrim{display: none}
@container ui-as-main (max-width: 1000px){.ui-ar__time{display: none}
.ui-ar__panel{position: absolute;z-index: 12;top: 0;right: 0;bottom: 0;width: min(360px, calc(100% - 32px));border-left: 0;border-radius: 0 var(--radius-panel) var(--radius-panel) 0;background: var(--panel);box-shadow: -1px 0 0 var(--line), -20px 0 40px -16px rgba(11, 9, 8, 0.2);animation: ui-ar-panel-in var(--nm-dur-4, 380ms) var(--ease) both}
.ui-ar__scrim{display: block;position: absolute;z-index: 11;inset: 0;border-radius: inherit;background: rgba(11, 9, 8, 0.18);animation: ui-ar-fade var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
}
@keyframes ui-ar-panel-in{from{transform: translateX(40px);opacity: 0}
to{transform: none;opacity: 1}
}
@keyframes ui-ar-fade{from{opacity: 0}
}
@container ui-as (max-width: 900px){.ui-ar__main > .ui-ar__bar{padding-left: 52px}
}
@container ui-as (max-width: 600px){.ui-ar__main .ui-ar__crumbs > svg, .ui-ar__main .ui-ar__crumbs > i{display: none}
.ui-ar__main .ui-ar__crumbs{font-size: 0}
.ui-ar__main .ui-ar__crumbs > b{font-size: 13.5px}
.ui-ar__bar{padding-right: 8px}
.ui-ar__panel .ui-ar__bar{padding-left: 20px}
.ui-ar__scroll{padding: 20px 16px 24px}
.ui-ar__panel{width: 100%;border-radius: var(--radius-panel)}
.ui-ar__section{padding: 16px}
}

`;
