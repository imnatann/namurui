"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";

/*
 * Agent Inbox – every background agent task in one calm board, in a single self-contained file.
 * Work is filed into three lanes by what it needs from you: waiting under "Needs you", active runs
 * under "Running", finished ones under "Done". A card is a disclosure: pressing the summary unfolds
 * its step timeline on a grid-template-rows transition, and the fold goes inert while it is shut, so
 * a keyboard never lands inside a collapsed card. Approval buttons live at the bottom of that
 * timeline and are chosen by the task's status – reject/approve while it waits, retry when it broke,
 * open once it runs or lands.
 * When a decision moves a card to another lane, the layout is diffed before paint and every card
 * that changed place is animated from its old box to its new one (FLIP), so a task glides to its
 * lane instead of teleporting. Board and list are the same DOM – the sheet collapses the lane grid.
 * The styles are injected below, so no extra files are needed.
 */

export type AgentInboxStatus = "waiting" | "running" | "done" | "failed";
export type AgentInboxView = "board" | "list";
export type AgentInboxLaneId = "needs" | "running" | "done";
export type AgentInboxActionKind = "approve" | "reject" | "retry" | "open";

/** One line of the run's timeline: what the agent did, and when. */
export type AgentInboxStep = {
  label: string;
  time: string;
};

/** One button under the timeline. `approve` and `retry` are the emphasised actions. */
export type AgentInboxAction = {
  kind: AgentInboxActionKind;
  label: string;
  primary?: boolean;
};

export type AgentInboxTask = {
  id: string;
  title: string;
  description: string;
  /** Which model ran it, shown above the timeline. */
  agent: string;
  status: AgentInboxStatus;
  /** Pin the task to a lane the status would not pick. */
  lane?: AgentInboxLaneId;
  /** Elapsed time while it waits or runs, total time once it lands – "6m 13s". */
  duration?: string;
  /** Sources the run read. */
  sources?: number;
  /** Tools the run called. */
  toolCalls?: number;
  steps: AgentInboxStep[];
  /** Defaults to the buttons the status implies. */
  actions?: AgentInboxAction[];
};

export type AgentInboxLane = {
  id: AgentInboxLaneId;
  label: string;
};

export type AgentInboxProps = {
  tasks: AgentInboxTask[];
  /** Controlled layout. */
  view?: AgentInboxView;
  defaultView?: AgentInboxView;
  onViewChange?: (view: AgentInboxView) => void;
  /** Controlled expanded card. `null` folds everything. */
  openId?: string | null;
  defaultOpenId?: string | null;
  onOpenChange?: (id: string | null) => void;
  onApprove?: (task: AgentInboxTask) => void;
  onReject?: (task: AgentInboxTask) => void;
  onRetry?: (task: AgentInboxTask) => void;
  /** The underlying run, pull request or document behind the card. */
  onOpen?: (task: AgentInboxTask) => void;
  /** Trail above the title. */
  crumb?: string;
  title?: string;
  /** Accessible name of the board/list switch. */
  layoutLabel?: string;
  lanes?: AgentInboxLane[];
  /** Copy for a lane with nothing in it. */
  emptyLabel?: string;
  className?: string;
};

const LANES: AgentInboxLane[] = [
  { id: "needs", label: "Needs you" },
  { id: "running", label: "Running" },
  { id: "done", label: "Done" },
];

const LANE_OF_STATUS: Record<AgentInboxStatus, AgentInboxLaneId> = {
  waiting: "needs",
  failed: "needs",
  running: "running",
  done: "done",
};

const DEFAULT_ACTIONS: Record<AgentInboxStatus, AgentInboxAction[]> = {
  waiting: [
    { kind: "reject", label: "Reject" },
    { kind: "approve", label: "Approve", primary: true },
  ],
  failed: [{ kind: "retry", label: "Retry", primary: true }],
  running: [{ kind: "open", label: "Open" }],
  done: [{ kind: "open", label: "Open" }],
};

const STATE_WORD: Record<AgentInboxStatus, string> = {
  waiting: "Waiting for you",
  running: "Running",
  done: "Done in",
  failed: "Failed",
};

const STATE_JOIN: Record<AgentInboxStatus, string> = {
  waiting: " · ",
  running: " · ",
  done: " ",
  failed: "",
};

const FLIP_MS = 320;

export function AgentInbox({
  tasks,
  view,
  defaultView = "board",
  onViewChange,
  openId,
  defaultOpenId = null,
  onOpenChange,
  onApprove,
  onReject,
  onRetry,
  onOpen,
  crumb = "Agents",
  title = "Agent inbox",
  layoutLabel = "Layout",
  lanes = LANES,
  emptyLabel = "Nothing here",
  className,
}: AgentInboxProps) {
  const uid = useId();
  const [ownView, setOwnView] = useState<AgentInboxView>(defaultView);
  const [ownOpen, setOwnOpen] = useState<string | null>(defaultOpenId);
  const mode = view ?? ownView;
  const expanded = openId === undefined ? ownOpen : openId;

  const host = useRef<HTMLDivElement>(null);
  const boxes = useRef<Record<string, { x: number; y: number }>>({});

  const pickView = (next: AgentInboxView) => {
    if (view === undefined) setOwnView(next);
    onViewChange?.(next);
  };

  const toggle = (id: string) => {
    const next = expanded === id ? null : id;
    if (openId === undefined) setOwnOpen(next);
    onOpenChange?.(next);
  };

  const run = (task: AgentInboxTask, kind: AgentInboxActionKind) => {
    const handler = { approve: onApprove, reject: onReject, retry: onRetry, open: onOpen }[kind];
    handler?.(task);
  };

  /* FLIP: measure every card after the DOM changed, animate the ones that moved from where they were. */
  useLayoutEffect(() => {
    const root = host.current;
    if (!root) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ease = getComputedStyle(root).getPropertyValue("--ui-aic-ease").trim() || "ease";
    const next: Record<string, { x: number; y: number }> = {};
    root.querySelectorAll<HTMLElement>("[data-id]").forEach((card) => {
      const id = card.dataset.id;
      if (!id) return;
      const box = card.getBoundingClientRect();
      next[id] = { x: box.left, y: box.top };
      const before = boxes.current[id];
      if (still || !before) return;
      const dx = before.x - box.left;
      const dy = before.y - box.top;
      if (dx === 0 && dy === 0) return;
      card.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0px, 0px)" }],
        { duration: FLIP_MS, easing: ease },
      );
    });
    boxes.current = next;
  }, [tasks, mode, lanes]);

  const grouped = lanes.map((lane) => ({
    lane,
    items: tasks.filter((task) => (task.lane ?? LANE_OF_STATUS[task.status]) === lane.id),
  }));

  const needs = grouped.find((group) => group.lane.id === "needs")?.items.length ?? 0;
  const running = grouped.find((group) => group.lane.id === "running")?.items.length ?? 0;
  const done = grouped.find((group) => group.lane.id === "done")?.items.length ?? 0;

  const summary =
    [needs > 0 ? `${needs} ${needs === 1 ? "needs" : "need"} you` : "", running > 0 ? `${running} running` : ""]
      .filter(Boolean)
      .join(", ") || `${done} done`;

  return (
    <div className={["ui-aic", className].filter(Boolean).join(" ")} data-view={mode}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-agent-inbox" precedence="default">
        {css}
      </style>

      <div className="ui-aic__bar">
        <span className="ui-aic__heading">
          <span className="ui-aic__crumb">{crumb}</span>
          <span className="ui-aic__slash" aria-hidden="true">
            /
          </span>
          <span>{title}</span>
        </span>
        <div className="ui-aic__views" role="radiogroup" aria-label={layoutLabel}>
          <button
            type="button"
            role="radio"
            aria-checked={mode === "board"}
            className="ui-aic__view"
            onClick={() => pickView("board")}
          >
            <BoardIcon />
            Board
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === "list"}
            className="ui-aic__view"
            onClick={() => pickView("list")}
          >
            <ListIcon />
            List
          </button>
        </div>
      </div>

      <div className="ui-aic__lanes" ref={host}>
        {grouped.map(({ lane, items }) => (
          <section key={lane.id} className="ui-aic__lane" aria-label={lane.label}>
            <header className="ui-aic__lane-head">
              <span className="ui-aic__lane-spark" aria-hidden="true">
                <SparkIcon />
              </span>
              <span className="ui-aic__lane-name">{lane.label}</span>
              <span className="ui-aic__count">{items.length}</span>
            </header>
            <ul className="ui-aic__cards">
              {items.length === 0 ? (
                <li className="ui-aic__empty">{emptyLabel}</li>
              ) : (
                items.map((task) => {
                  const foldId = `${uid}-${task.id}`;
                  const open = expanded === task.id;
                  const actions = task.actions ?? DEFAULT_ACTIONS[task.status];
                  return (
                    <li
                      key={task.id}
                      data-id={task.id}
                      className="ui-aic__card"
                      data-status={task.status}
                      data-open={open ? "" : undefined}
                    >
                      <button
                        type="button"
                        className="ui-aic__card-main"
                        aria-expanded={open}
                        aria-controls={foldId}
                        onClick={() => toggle(task.id)}
                      >
                        <span className="ui-aic__title-row">
                          <span className="ui-aic__spark">
                            <SparkIcon />
                          </span>
                          <span className="ui-aic__title">{task.title}</span>
                        </span>
                        <span className="ui-aic__desc">{task.description}</span>
                        <span className="ui-aic__foot">
                          <span className="ui-aic__state" data-status={task.status}>
                            <span className="ui-aic__state-icon" data-status={task.status} aria-hidden="true">
                              <StateIcon status={task.status} />
                            </span>
                            <span>
                              <span className="ui-aic__state-word">
                                {STATE_WORD[task.status]}
                                {task.duration ? STATE_JOIN[task.status] : null}
                              </span>
                              {task.status === "failed" ? null : task.duration}
                            </span>
                          </span>
                          <span className="ui-aic__meta">
                            <span title="Sources read">
                              <SourceIcon />
                              {task.sources ?? 0}
                            </span>
                            <span title="Tool calls">
                              <ToolIcon />
                              {task.toolCalls ?? 0}
                            </span>
                          </span>
                        </span>
                      </button>
                      <div
                        id={foldId}
                        className="ui-aic__fold"
                        data-open={open ? "" : undefined}
                        inert={open ? undefined : true}
                      >
                        <div className="ui-aic__clip">
                          <div className="ui-aic__more">
                            <div className="ui-aic__agent">{task.agent}</div>
                            <ol className="ui-aic__steps">
                              {task.steps.map((step, index) => (
                                <li
                                  key={`${step.time}-${step.label}`}
                                  data-last={index === task.steps.length - 1 ? "" : undefined}
                                >
                                  <span>{step.label}</span>
                                  <time>{step.time}</time>
                                </li>
                              ))}
                            </ol>
                            <div className="ui-aic__actions">
                              {actions.map((action) => (
                                <button
                                  key={`${action.kind}-${action.label}`}
                                  type="button"
                                  className={["ui-aic__btn", action.primary ? "ui-aic__btn--primary" : ""]
                                    .filter(Boolean)
                                    .join(" ")}
                                  onClick={() => run(task, action.kind)}
                                >
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        ))}
      </div>

      <span className="ui-aic__sr" aria-live="polite">
        {summary}
      </span>
    </div>
  );
}

/* icons */

const SparkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <path
      d="M7 1.2c.4 2.9 1.9 4.4 4.8 4.8-2.9.4-4.4 1.9-4.8 4.8C6.6 7.9 5.1 6.4 2.2 6 5.1 5.6 6.6 4.1 7 1.2Z"
      fill="currentColor"
    />
    <circle cx="11.6" cy="11.4" r="1.1" fill="currentColor" opacity="0.55" />
  </svg>
);

const BoardIcon = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
    <rect
      x="1.8"
      y="2.2"
      width="3.2"
      height="9.6"
      rx="1"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect
      x="8.9"
      y="2.2"
      width="3.2"
      height="6.4"
      rx="1"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ListIcon = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
    <path
      d="M2.2 3.6h9.6M2.2 7h9.6M2.2 10.4h9.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const StateIcon = ({ status }: { status: AgentInboxStatus }) => {
  if (status === "failed") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12">
        <circle cx="6" cy="6" r="4.8" fill="currentColor" />
        <path
          d="M6 3.6v2.8M6 8.3v.1"
          style={{ stroke: "var(--ui-aic-card)" }}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (status === "waiting") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12">
        <path d="M6 1.6 11 10.2H1L6 1.6Z" fill="currentColor" />
      </svg>
    );
  }
  if (status === "done") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12">
        <circle cx="6" cy="6" r="3.4" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12">
      <circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.6" />
      <path d="M6 1.4a4.6 4.6 0 0 1 4.6 4.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
};

const SourceIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
    <circle
      cx="5.2"
      cy="5.2"
      r="3.3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="m7.7 7.7 2.6 2.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ToolIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
    <path
      d="M7.6 1.6a2.6 2.6 0 0 0-2.4 3.5L1.7 8.6a1.1 1.1 0 0 0 1.6 1.6l3.5-3.5a2.6 2.6 0 0 0 3.5-2.4l-1.5 1.1-1.5-.4-.4-1.5 1.1-1.5c-.1 0-.3-.4-.4-.4Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const css = /* css */ `
.ui-aic{--ui-aic-lane: #f4ece4;--ui-aic-card: #fffdfb;--ui-aic-line: #e8e0d7;--ui-aic-ink: #211b16;--ui-aic-text: #4f4133;--ui-aic-muted: #88786a;--ui-aic-faint: #a79a8f;--ui-aic-blue: #ff6b35;--ui-aic-amber: #d99530;--ui-aic-green: #2f8d5c;--ui-aic-red: #e2544a;--ui-aic-focus: rgba(28, 23, 19, 0.22);--ui-aic-ease: cubic-bezier(0.32, 0.72, 0.24, 1);box-sizing: border-box;width: 100%;min-width: 0;container-type: inline-size;font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;color: var(--ui-aic-text);text-align: left;-webkit-font-smoothing: antialiased}
.ui-aic *, .ui-aic *::before, .ui-aic *::after{box-sizing: border-box}
:where(.ui-aic) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;text-align: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-aic button:focus-visible{outline: 2px solid var(--ui-aic-focus);outline-offset: 2px}
.ui-aic ul, .ui-aic ol{margin: 0;padding: 0;list-style: none}
.ui-aic svg{display: block;flex: none}
.ui-aic__sr{position: absolute;width: 1px;height: 1px;overflow: hidden;clip-path: inset(50%);white-space: nowrap}
.ui-aic__bar{display: flex;align-items: center;justify-content: space-between;gap: 12px;margin-bottom: 12px;padding: 0 2px}
.ui-aic__heading{display: flex;align-items: center;gap: 10px;min-width: 0;font-size: 14px;font-weight: 500;color: var(--ui-aic-ink);white-space: nowrap}
.ui-aic__crumb{color: var(--ui-aic-muted);font-weight: 400}
.ui-aic__slash{color: var(--ui-aic-faint)}
.ui-aic__views{display: flex;flex: none;gap: 2px;padding: 3px;border-radius: 10px;background: var(--ui-aic-lane)}
.ui-aic__view{display: inline-flex;align-items: center;gap: 6px;height: 26px;padding: 0 10px;border-radius: 7px;font-size: 12.5px;font-weight: 500;color: var(--ui-aic-muted);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-aic__view:hover{color: var(--ui-aic-ink)}
.ui-aic__view[aria-checked="true"]{background: var(--ui-aic-card);color: var(--ui-aic-ink);box-shadow: 0 1px 2px rgba(26, 21, 18, 0.08), 0 0 0 1px rgba(26, 21, 18, 0.04)}
.ui-aic__lanes{display: grid;grid-template-columns: repeat(3, minmax(0, 1fr));gap: 8px;align-items: start}
.ui-aic__lane{min-width: 0;padding: 4px 4px 4px;border-radius: 14px;background: var(--ui-aic-lane)}
.ui-aic__lane-head{display: grid;grid-template-columns: 20px 1fr 20px;align-items: center;height: 34px;padding: 0 8px 0 10px}
.ui-aic__lane-spark{color: var(--ui-aic-blue);opacity: 0.7}
.ui-aic__lane-name{overflow: hidden;font-size: 11px;font-weight: 500;letter-spacing: 0.08em;text-align: center;text-transform: uppercase;color: var(--ui-aic-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-aic__count{display: grid;place-items: center;min-width: 20px;height: 18px;padding: 0 5px;border-radius: 6px;background: rgba(26, 21, 18, 0.06);font-size: 11px;font-weight: 500;color: var(--ui-aic-text);font-variant-numeric: tabular-nums}
.ui-aic__cards{display: grid;gap: 6px}
.ui-aic__empty{padding: 18px 0 20px;font-size: 12.5px;text-align: center;color: var(--ui-aic-faint)}
.ui-aic__card{position: relative;border-radius: 10px;background: var(--ui-aic-card);box-shadow: 0 0 0 1px var(--ui-aic-line), 0 1px 2px rgba(26, 21, 18, 0.04);transition: box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-aic__card:hover, .ui-aic__card[data-open]{box-shadow: 0 0 0 1px #d3c8bd, 0 4px 14px -6px rgba(26, 21, 18, 0.12)}
.ui-aic__card-main{display: grid;gap: 6px;width: 100%;padding: 12px 14px 12px 12px;border-radius: 10px;container: aic-card / inline-size}
.ui-aic__title-row{display: flex;align-items: center;gap: 10px;min-width: 0}
.ui-aic__spark{display: grid;flex: none;place-items: center;width: 16px;color: var(--ui-aic-blue);transition: color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-aic__card[data-status="waiting"] .ui-aic__spark{color: var(--ui-aic-amber)}
.ui-aic__card[data-status="failed"] .ui-aic__spark{color: var(--ui-aic-red)}
.ui-aic__card[data-status="done"] .ui-aic__spark{color: var(--ui-aic-green)}
.ui-aic__title{min-width: 0;overflow: hidden;font-size: 14px;font-weight: 500;line-height: 20px;color: var(--ui-aic-ink);white-space: nowrap;text-overflow: ellipsis}
.ui-aic__desc{display: -webkit-box;padding-left: 26px;overflow: hidden;font-size: 13px;line-height: 19px;color: var(--ui-aic-text);-webkit-line-clamp: 2;-webkit-box-orient: vertical}
.ui-aic__foot{display: flex;align-items: center;justify-content: space-between;gap: 10px;min-width: 0;margin-top: 4px;padding-left: 26px}
.ui-aic__state{display: inline-flex;align-items: center;gap: 8px;min-width: 0;font-size: 12.5px;color: var(--ui-aic-text);white-space: nowrap;font-variant-numeric: tabular-nums}
.ui-aic__state > span:last-child{overflow: hidden;text-overflow: ellipsis}
.ui-aic__state-icon{display: grid;flex: none;place-items: center;width: 12px;height: 12px;color: var(--ui-aic-blue);animation: ui-aic-pop var(--nm-dur-4, 380ms) var(--ui-aic-ease) both}
.ui-aic__state-icon[data-status="running"] svg{animation: ui-aic-spin var(--nm-dur-6, 1100ms) linear infinite}
.ui-aic__state-icon[data-status="waiting"]{color: var(--ui-aic-amber)}
.ui-aic__state-icon[data-status="done"]{color: var(--ui-aic-green)}
.ui-aic__state-icon[data-status="failed"]{color: var(--ui-aic-red)}
.ui-aic__meta{display: inline-flex;flex: none;align-items: center;font-size: 12px;color: var(--ui-aic-muted);font-variant-numeric: tabular-nums}
.ui-aic__meta > span{display: inline-flex;align-items: center;gap: 5px;padding: 0 9px}
.ui-aic__meta > span + span{border-left: 1px solid var(--ui-aic-line)}
.ui-aic__meta > span:last-child{padding-right: 0}
.ui-aic__fold{display: grid;grid-template-rows: 0fr;opacity: 0;transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-aic-ease), opacity 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-aic__fold[data-open]{grid-template-rows: 1fr;opacity: 1;transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-aic-ease), opacity var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 100ms}
.ui-aic__clip{min-height: 0;overflow: hidden}
.ui-aic__more{margin: 0 14px 0 12px;padding: 10px 0 12px;border-top: 1px solid var(--ui-aic-line)}
.ui-aic__agent{font-size: 12px;color: var(--ui-aic-muted)}
.ui-aic__steps{position: relative;display: grid;gap: 5px;margin-top: 6px !important;padding-left: 12px !important}
.ui-aic__steps li{position: relative;display: flex;justify-content: space-between;gap: 10px;font-size: 12.5px;line-height: 18px;color: var(--ui-aic-text)}
.ui-aic__steps li::before{content: "";position: absolute;top: 7px;left: -12px;width: 4px;height: 4px;border-radius: 50%;background: var(--ui-aic-faint)}
.ui-aic__steps li:not(:last-child)::after{content: "";position: absolute;top: 15px;bottom: -8px;left: -10.5px;width: 1px;background: var(--ui-aic-line)}
.ui-aic__steps li[data-last]::before{background: var(--ui-aic-ink)}
.ui-aic__steps li > span{min-width: 0}
.ui-aic__steps time{flex: none;color: var(--ui-aic-muted)}
.ui-aic__actions{display: flex;justify-content: flex-end;gap: 6px;margin-top: 10px}
.ui-aic__actions:empty{display: none}
.ui-aic__btn{display: inline-flex;align-items: center;height: 28px;padding: 0 12px;border-radius: 8px;box-shadow: inset 0 0 0 1px var(--ui-aic-line);background: var(--ui-aic-card);font-size: 12.5px;font-weight: 500;color: var(--ui-aic-ink);transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-aic__btn:hover{background: var(--ui-aic-lane)}
.ui-aic__btn--primary{background: var(--ui-aic-ink);box-shadow: none;color: var(--ui-aic-card)}
.ui-aic__btn--primary:hover{background: #362b21}
.ui-aic[data-view="list"] .ui-aic__lanes{grid-template-columns: minmax(0, 1fr)}
.ui-aic[data-view="list"] .ui-aic__lane-head{grid-template-columns: 20px auto 1fr;gap: 4px}
.ui-aic[data-view="list"] .ui-aic__lane-name{text-align: left}
.ui-aic[data-view="list"] .ui-aic__count{justify-self: start}
.ui-aic__lanes{animation: ui-aic-in var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
@keyframes ui-aic-spin{to{transform: rotate(360deg)}
}
@keyframes ui-aic-pop{from{opacity: 0;transform: scale(0.6)}
}
@keyframes ui-aic-in{from{opacity: 0.4}
}
@container (max-width: 620px){.ui-aic__views{display: none}
.ui-aic .ui-aic__lanes{grid-template-columns: minmax(0, 1fr)}
.ui-aic .ui-aic__lane-head{grid-template-columns: 20px auto 1fr;gap: 4px}
.ui-aic .ui-aic__lane-name{text-align: left}
.ui-aic .ui-aic__count{justify-self: start}
}
@container aic-card (max-width: 300px){.ui-aic__desc, .ui-aic__foot{padding-left: 0}
.ui-aic__state:is([data-status="running"], [data-status="done"]) .ui-aic__state-word{display: none}
}
@container (max-width: 360px){.ui-aic__desc, .ui-aic__foot{padding-left: 0}
.ui-aic__title{white-space: normal}
}
@media (pointer: coarse){.ui-aic__view{height: 32px}
.ui-aic__btn{height: 36px;padding: 0 16px}
}
@media (prefers-reduced-motion: reduce){.ui-aic *, .ui-aic *::before, .ui-aic *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-aic{--ui-aic-lane: #1c1713;--ui-aic-card: #231d17;--ui-aic-line: #2e251d;--ui-aic-ink: #ebe3da;--ui-aic-text: #a99c91;--ui-aic-muted: #7f6f62;--ui-aic-faint: #554637;--ui-aic-blue: #ff8a5c;--ui-aic-amber: #e8b05c;--ui-aic-green: #2f8d5c;--ui-aic-red: #e2544a;--ui-aic-focus: rgba(255, 253, 251, 0.3)}
:where(.dark, [data-theme="dark"]) .ui-aic__card:hover, :where(.dark, [data-theme="dark"]) .ui-aic__card[data-open]{box-shadow: 0 0 0 1px #3b3024, 0 6px 18px -8px rgba(11, 9, 8, 0.6)}
:where(.dark, [data-theme="dark"]) .ui-aic__count{background: rgba(255, 253, 251, 0.07)}
:where(.dark, [data-theme="dark"]) .ui-aic__btn--primary:hover{background: #cbbfb5}
:where(.dark, [data-theme="dark"]) .ui-aic__state-icon[data-status="failed"] path{stroke: #231d17}

`;
