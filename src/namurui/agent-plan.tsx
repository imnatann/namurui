"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

/*
 * Agent Plan – an agent's step-by-step proposal, reviewed before it runs, in a single
 * self-contained file. In review every row can be renamed in place, dragged to reorder,
 * removed or added to, and the shortcuts under the title are wired to the list. Once the plan
 * starts the rows are read-only: the number in its hairline ring becomes a ray spinner, then a
 * check that draws itself on the accent fill, the aside reports how long the step took, and the
 * rail below each marker fills segment by segment. A failed step keeps its error and offers
 * "Retry from here" while the tray under the card turns into the run's status – "Running · 2 of
 * 5" with the elapsed clock, then "Done in 14s". Moves are diffed before paint and animated
 * from the old box to the new one (FLIP), also for keyboard moves and order changes from props.
 * The styles are injected below, so no extra files are needed.
 */

/** How one step is doing while the plan runs. */
export type PlanStepStatus = "pending" | "active" | "done" | "failed" | "skipped";

/** One row of the plan. Keep the id stable – timers, reorder animations and announcements follow it. */
export type PlanStep = {
  id: string;
  title: string;
  /** Second line under the title: what the step actually touches. */
  detail?: string;
  /** Monospace chip on the second line, e.g. "stripe.query". */
  tool?: string;
  status?: PlanStepStatus;
  /** Milliseconds. Leave out to have it measured from the moment it turned active. */
  duration?: number;
  /** Shown in red under the step when it fails. */
  error?: string;
};

/** Review and edit, executing, or finished. Editing is only possible in "draft". */
export type AgentPlanStatus = "draft" | "running" | "done";

export type AgentPlanProps = {
  /** Controlled steps – pair with onChange. */
  steps?: PlanStep[];
  /** Initial steps when uncontrolled – edits stay inside the component. */
  defaultSteps?: PlanStep[];
  /** Review, executing or finished. */
  status?: AgentPlanStatus;
  /** Every edit during review: rename, remove, reorder, add. */
  onChange?: (steps: PlanStep[]) => void;
  /** "Run plan" pressed – receives the steps in their final order. Also renders "Run again" once done. */
  onRun?: (steps: PlanStep[]) => void;
  /** Renders a Cancel button beside Run plan in review. */
  onCancel?: () => void;
  /** Renders "Retry from here" under a failed step. */
  onRetry?: (stepId: string) => void;
  /** The goal of the plan, used as the heading and the list's label. */
  title?: string;
  /** Estimated run time shown in review, e.g. "~2 min". */
  estimate?: string;
  /** Extra class on the root. */
  className?: string;
};

const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const FLIP_MS = 320;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/** "1.3s" under a minute, "2m 5s" above it – the aside never grows a third digit of noise. */
const formatStepTime = (ms: number) => {
  const seconds = Math.max(ms, 0) / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
};

const formatElapsed = (ms: number) => {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

const STATUS_WORD: Record<PlanStepStatus, string> = {
  pending: "Pending",
  active: "Running",
  done: "Done",
  failed: "Failed",
  skipped: "Skipped",
};

export function AgentPlan({
  steps,
  defaultSteps = [],
  status = "draft",
  onChange,
  onRun,
  onCancel,
  onRetry,
  title,
  estimate,
  className,
}: AgentPlanProps) {
  const uid = useId();
  const helpId = `ui-plc-help-${uid.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const [ownSteps, setOwnSteps] = useState<PlanStep[]>(defaultSteps);
  const list = steps ?? ownSteps;
  const editable = status === "draft";

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [adding, setAdding] = useState("");
  const [dragging, setDragging] = useState<{ id: string; dy: number } | null>(null);
  const [removing, setRemoving] = useState<{ id: string; height: number; collapsed: boolean } | null>(null);
  const [enteredId, setEnteredId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const listEl = useRef<HTMLOListElement>(null);
  const items = useRef<Record<string, HTMLLIElement | null>>({});
  const boxes = useRef<Record<string, number>>({});
  const startedAt = useRef<Record<string, number>>({});
  const endedAt = useRef<Record<string, number>>({});
  const announced = useRef<Record<string, PlanStepStatus>>({});
  const runStart = useRef<number | null>(null);
  const runEnd = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const addInput = useRef<HTMLInputElement>(null);
  const dragState = useRef<{ id: string; startY: number } | null>(null);
  const editingRef = useRef<string | null>(null);
  const titleRef = useRef("");
  const skipFlip = useRef(false);
  const listRef = useRef(list);
  listRef.current = list;

  const commit = (next: PlanStep[]) => {
    if (steps === undefined) setOwnSteps(next);
    onChange?.(next);
  };

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  /* ---------- clocks: a step is measured from the moment it turned active ---------- */

  useEffect(() => {
    let landed = false;
    for (const step of list) {
      const state = step.status ?? "pending";
      if (state === "active" && startedAt.current[step.id] === undefined) {
        startedAt.current[step.id] = Date.now();
      }
      if (state === "done" || state === "failed" || state === "skipped") {
        if (startedAt.current[step.id] !== undefined && endedAt.current[step.id] === undefined) {
          endedAt.current[step.id] = Date.now();
          landed = true;
        }
      }
      if (state === "pending") {
        delete startedAt.current[step.id];
        delete endedAt.current[step.id];
      }
    }
    /* A landing time lives in a ref, so the row that just finished needs one extra paint to show it. */
    if (landed) setNow(Date.now());
  }, [list]);

  useEffect(() => {
    if (status !== "running") return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (status === "running") {
      if (runStart.current === null || runEnd.current !== null) runStart.current = Date.now();
      runEnd.current = null;
      setNow(Date.now());
    } else if (status === "done") {
      if (runEnd.current === null) runEnd.current = Date.now();
      setNow(Date.now());
    } else {
      runStart.current = null;
      runEnd.current = null;
    }
  }, [status]);

  /* ---------- the run is announced step by step ---------- */

  useEffect(() => {
    if (status === "draft") {
      announced.current = {};
      return;
    }
    for (const step of list) {
      const state = step.status ?? "pending";
      if (announced.current[step.id] === state) continue;
      announced.current[step.id] = state;
      if (state === "active") setAnnouncement(`Running: ${step.title}`);
      else if (state === "done") setAnnouncement(`Done: ${step.title}`);
      else if (state === "failed") {
        setAnnouncement(`Failed: ${step.title}${step.error ? ` – ${step.error}` : ""}`);
      }
    }
  }, [list, status]);

  /* ---------- FLIP: everything glides to its new place ---------- */

  useLayoutEffect(() => {
    const root = listEl.current;
    if (!root) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next: Record<string, number> = {};
    for (const step of list) {
      const el = items.current[step.id];
      if (el) next[step.id] = el.getBoundingClientRect().top;
    }
    /* A removed row already collapsed in flow; the ones under it slid up there, not here. */
    if (skipFlip.current) {
      skipFlip.current = false;
      boxes.current = next;
      return;
    }
    for (const [id, top] of Object.entries(next)) {
      const before = boxes.current[id];
      if (still || before === undefined || dragging?.id === id) continue;
      const dy = before - top;
      if (Math.abs(dy) < 1) continue;
      items.current[id]?.animate(
        [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0px)" }],
        { duration: FLIP_MS, easing: EASE },
      );
    }
    boxes.current = next;
  }, [list, dragging?.id]);

  /* ---------- editing ---------- */

  const startRename = (step: PlanStep) => {
    if (!editable) return;
    editingRef.current = step.id;
    titleRef.current = step.title;
    setDraftTitle(step.title);
    setEditingId(step.id);
  };

  const finishRename = (save: boolean) => {
    const id = editingRef.current;
    if (!id) return;
    editingRef.current = null;
    setEditingId(null);
    const value = titleRef.current.trim();
    const step = list.find((item) => item.id === id);
    if (save && step && value && value !== step.title) {
      commit(list.map((item) => (item.id === id ? { ...item, title: value } : item)));
      setAnnouncement(`Renamed to "${value}"`);
    }
  };

  const remove = (step: PlanStep) => {
    if (!editable) return;
    const height = items.current[step.id]?.offsetHeight ?? 0;
    setRemoving({ id: step.id, height, collapsed: false });
    /* One frame at the measured height, then the collapse attribute so the height can transition to 0. */
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        setRemoving((current) =>
          current && current.id === step.id ? { ...current, collapsed: true } : current,
        ),
      ),
    );
    const timer = window.setTimeout(() => {
      const current = listRef.current;
      const index = current.findIndex((item) => item.id === step.id);
      const next = current.filter((item) => item.id !== step.id);
      skipFlip.current = true;
      commit(next);
      setRemoving(null);
      setAnnouncement(`Removed "${step.title}". ${next.length} steps left`);
      const neighbour = next[index] ?? next[index - 1];
      if (neighbour) items.current[neighbour.id]?.focus();
    }, 340);
    timers.current.push(timer);
  };

  const move = (id: string, direction: -1 | 1) => {
    const index = list.findIndex((step) => step.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= list.length) return;
    const next = [...list];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    commit(next);
    setAnnouncement(`Moved "${item.title}" to position ${target + 1} of ${next.length}`);
    requestAnimationFrame(() => items.current[id]?.focus());
  };

  const add = () => {
    const value = adding.trim();
    if (!editable || !value) return;
    const step: PlanStep = {
      id: `step-${Date.now().toString(36)}-${list.length}`,
      title: value,
      status: "pending",
    };
    commit([...list, step]);
    setAdding("");
    setAnnouncement(`Added "${value}" to position ${list.length + 1}`);
    setEnteredId(step.id);
    const timer = window.setTimeout(() => setEnteredId(null), 420);
    timers.current.push(timer);
    addInput.current?.focus();
  };

  /* ---------- pointer drag ---------- */

  const startDrag = (event: ReactPointerEvent<HTMLSpanElement>, step: PlanStep) => {
    if (!editable) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = { id: step.id, startY: event.clientY };
    setDragging({ id: step.id, dy: 0 });
  };

  const dragMove = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const state = dragState.current;
    if (!state) return;
    setDragging({ id: state.id, dy: event.clientY - state.startY });

    const index = list.findIndex((step) => step.id === state.id);
    if (index < 0) return;
    let target = index;
    const below = list[index + 1];
    const above = list[index - 1];
    if (below) {
      const rect = items.current[below.id]?.getBoundingClientRect();
      if (rect && event.clientY > rect.top + rect.height / 2) target = index + 1;
    }
    if (target === index && above) {
      const rect = items.current[above.id]?.getBoundingClientRect();
      if (rect && event.clientY < rect.top + rect.height / 2) target = index - 1;
    }
    if (target === index) return;

    const next = [...list];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    commit(next);
    dragState.current = { id: state.id, startY: event.clientY };
    setDragging({ id: state.id, dy: 0 });
    setAnnouncement(`Moved "${moved.title}" to position ${target + 1} of ${next.length}`);
  };

  const endDrag = () => {
    if (!dragState.current) return;
    dragState.current = null;
    setDragging(null);
  };

  /* ---------- keyboard on a step ---------- */

  const onStepKeyDown = (event: ReactKeyboardEvent<HTMLLIElement>, step: PlanStep, index: number) => {
    const fromChild = event.target !== event.currentTarget;
    if (!fromChild && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      if (event.altKey) {
        if (editable) move(step.id, event.key === "ArrowUp" ? -1 : 1);
        return;
      }
      const neighbour = list[index + (event.key === "ArrowUp" ? -1 : 1)];
      if (neighbour) items.current[neighbour.id]?.focus();
      return;
    }
    if (!editable || fromChild) return;
    if (event.key === "Enter") {
      event.preventDefault();
      startRename(step);
    } else if (event.key === "Delete") {
      event.preventDefault();
      remove(step);
    } else if (event.key === "Escape") {
      finishRename(false);
    }
  };

  /* ---------- derived run state ---------- */

  const doneCount = list.filter((step) => step.status === "done").length;
  const activeIndex = list.findIndex((step) => step.status === "active");
  const current = activeIndex >= 0 ? activeIndex + 1 : Math.min(doneCount + 1, Math.max(list.length, 1));
  const failed = list.some((step) => step.status === "failed");
  const phase = editable ? "draft" : failed ? "failed" : status;
  const measured = list.reduce((sum, step) => sum + (step.duration ?? 0), 0);
  const elapsed = runStart.current !== null ? Math.max((runEnd.current ?? now) - runStart.current, 0) : measured;
  const runLabel = `Running · ${current} of ${list.length}`;

  const timeOf = (step: PlanStep): number | undefined => {
    const state = step.status ?? "pending";
    if (state === "pending" || state === "skipped") return undefined;
    if (step.duration !== undefined) return step.duration;
    const started = startedAt.current[step.id];
    if (started === undefined) return undefined;
    if (state === "active") return Math.max(now - started, 0);
    const ended = endedAt.current[step.id];
    return ended === undefined ? undefined : Math.max(ended - started, 0);
  };

  return (
    <div
      className={["ui-plc", className].filter(Boolean).join(" ")}
      data-status={status}
      data-dragging={dragging ? "true" : undefined}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-agent-plan" precedence="default">
        {css}
      </style>

      <div className="ui-plc__card">
        <div className="ui-plc__head">
          <div className="ui-plc__meta">
            <span className="ui-plc__state">
              <span className="ui-plc__state-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16">
                  <path d="M6.5 4.5h7M6.5 8h7M6.5 11.5h7" />
                  <circle cx="3.25" cy="4.5" r=".6" />
                  <circle cx="3.25" cy="8" r=".6" />
                  <circle cx="3.25" cy="11.5" r=".6" />
                </svg>
              </span>
              <span className="ui-plc__state-label">
                Plan · {list.length} {list.length === 1 ? "step" : "steps"}
              </span>
            </span>
            {editable && estimate ? (
              <span className="ui-plc__estimate">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 5v3.2l2 1.3" />
                </svg>
                <span>
                  <span className="ui-plc__sr">Estimated time </span>
                  {estimate}
                </span>
              </span>
            ) : null}
          </div>
          <h3 className="ui-plc__title">{title ?? "Plan"}</h3>
        </div>

        {editable ? (
          <p id={helpId} className="ui-plc__sr">
            Press Enter to rename, Alt plus arrow keys to move, Delete to remove.
          </p>
        ) : null}

        <ol className="ui-plc__list" ref={listEl} aria-label={title ? `Plan: ${title}` : "Plan"}>
          {list.map((step, index) => {
            const state = step.status ?? "pending";
            const time = timeOf(step);
            const isDrag = dragging?.id === step.id;
            return (
              <li
                key={step.id}
                ref={(el) => {
                  items.current[step.id] = el;
                }}
                className="ui-plc__step"
                tabIndex={editable ? 0 : -1}
                aria-describedby={editable ? helpId : undefined}
                aria-current={state === "active" ? "step" : undefined}
                data-step={editable ? undefined : state}
                data-dragging={isDrag || undefined}
                data-removing={(removing?.id === step.id && removing.collapsed) || undefined}
                data-enter={enteredId === step.id || undefined}
                style={
                  dragging && isDrag
                    ? { transform: `translateY(${dragging.dy}px)` }
                    : removing?.id === step.id
                      ? { height: `${removing.height}px` }
                      : undefined
                }
                onKeyDown={(event) => onStepKeyDown(event, step, index)}
              >
                {editable ? (
                  <span
                    className="ui-plc__grip"
                    aria-hidden="true"
                    title="Drag to reorder"
                    onPointerDown={(event) => startDrag(event, step)}
                    onPointerMove={dragMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onLostPointerCapture={endDrag}
                  >
                    <svg viewBox="0 0 16 16">
                      <circle cx="6" cy="4" r="1.1" />
                      <circle cx="10" cy="4" r="1.1" />
                      <circle cx="6" cy="8" r="1.1" />
                      <circle cx="10" cy="8" r="1.1" />
                      <circle cx="6" cy="12" r="1.1" />
                      <circle cx="10" cy="12" r="1.1" />
                    </svg>
                  </span>
                ) : null}

                <span className="ui-plc__marker" aria-hidden="true">
                  {state === "active" ? (
                    <SpinnerIcon />
                  ) : state === "done" ? (
                    <CheckIcon />
                  ) : state === "failed" ? (
                    <CrossIcon />
                  ) : (
                    <span className="ui-plc__num">{index + 1}</span>
                  )}
                </span>

                <div className="ui-plc__main">
                  {editingId === step.id ? (
                    <input
                      className="ui-plc__edit"
                      value={draftTitle}
                      autoFocus
                      aria-label={`Rename step ${index + 1}`}
                      onChange={(event) => {
                        titleRef.current = event.target.value;
                        setDraftTitle(event.target.value);
                      }}
                      onFocus={(event) => event.currentTarget.select()}
                      onBlur={() => finishRename(true)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          finishRename(true);
                        } else if (event.key === "Escape") {
                          event.preventDefault();
                          finishRename(false);
                        }
                      }}
                    />
                  ) : (
                    <span className="ui-plc__name" onDoubleClick={() => startRename(step)}>
                      {step.title}
                    </span>
                  )}
                  {step.detail || step.tool ? (
                    <span className="ui-plc__sub">
                      {step.detail ? <span className="ui-plc__detail">{step.detail}</span> : null}
                      {step.tool ? <code className="ui-plc__tool">{step.tool}</code> : null}
                    </span>
                  ) : null}
                  {!editable && state !== "pending" ? (
                    <span className="ui-plc__sr">{STATUS_WORD[state]}</span>
                  ) : null}
                  {!editable && state === "failed" && (step.error || onRetry) ? (
                    <div className="ui-plc__fail">
                      {step.error ? <span className="ui-plc__error">{step.error}</span> : null}
                      {onRetry ? (
                        <button type="button" className="ui-plc__retry" onClick={() => onRetry(step.id)}>
                          <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M3.4 8a4.6 4.6 0 1 0 1.5-3.4" />
                            <path d="M3.2 3.3v2.5h2.5" />
                          </svg>
                          Retry from here
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <span className="ui-plc__aside">
                  {editable ? (
                    <button
                      type="button"
                      className="ui-plc__remove"
                      aria-label={`Remove step ${index + 1}: ${step.title}`}
                      onClick={() => remove(step)}
                    >
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
                      </svg>
                    </button>
                  ) : time !== undefined ? (
                    <span className="ui-plc__time">{formatStepTime(time)}</span>
                  ) : null}
                </span>

                {index < list.length - 1 ? <span className="ui-plc__rail" aria-hidden="true" /> : null}
              </li>
            );
          })}
        </ol>

        <div className="ui-plc__tail" inert={!editable || undefined}>
          <div className="ui-plc__tail-inner">
            <label className="ui-plc__add">
              <span className="ui-plc__add-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16">
                  <path d="M8 4.5v7M4.5 8h7" />
                </svg>
              </span>
              <input
                ref={addInput}
                value={adding}
                placeholder="Add step"
                aria-label="Add a step at the end"
                enterKeyHint="done"
                onChange={(event) => setAdding(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    add();
                  }
                }}
              />
            </label>
          </div>
        </div>

        <div className="ui-plc__foot" data-phase={phase}>
          {editable ? (
            <>
              <span className="ui-plc__hint" aria-hidden="true">
                Drag to reorder · double-click to rename
              </span>
              <span className="ui-plc__actions">
                {onCancel ? (
                  <button type="button" className="ui-plc__btn ui-plc__btn--secondary" onClick={onCancel}>
                    Cancel
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ui-plc__btn ui-plc__btn--primary ui-plc__run"
                  disabled={list.length === 0}
                  onClick={() => onRun?.(list)}
                >
                  Run plan
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M5.5 3.8v8.4L12 8z" />
                  </svg>
                </button>
              </span>
            </>
          ) : status === "running" && !failed ? (
            <>
              <span className="ui-plc__status">
                <span className="ui-plc__status-icon" aria-hidden="true">
                  <SpinnerIcon />
                </span>
                <span className="ui-plc__status-label ui-plc__shimmer" data-text={runLabel}>
                  {runLabel}
                </span>
              </span>
              <span className="ui-plc__elapsed">{formatElapsed(elapsed)}</span>
            </>
          ) : status === "done" && !failed ? (
            <>
              <span className="ui-plc__status">
                <span className="ui-plc__status-icon" aria-hidden="true">
                  <BadgeIcon />
                </span>
                <span className="ui-plc__status-label">Done in {formatElapsed(elapsed)}</span>
              </span>
              <span className="ui-plc__actions">
                <button
                  type="button"
                  className="ui-plc__btn ui-plc__btn--secondary ui-plc__again"
                  onClick={() => onRun?.(list)}
                >
                  Run again
                </button>
              </span>
            </>
          ) : (
            <>
              <span className="ui-plc__status">
                <span className="ui-plc__status-icon" aria-hidden="true">
                  <BadgeIcon failed />
                </span>
                <span className="ui-plc__status-label">
                  Failed · {current} of {list.length}
                </span>
              </span>
              <span className="ui-plc__elapsed">{formatElapsed(elapsed)}</span>
            </>
          )}
        </div>
      </div>

      <p className="ui-plc__sr" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

/* ---------- icons ---------- */

const SpinnerIcon = () => (
  <svg className="ui-plc__spinner" viewBox="0 0 16 16" aria-hidden="true">
    {RAY_ANGLES.map((angle, index) => (
      <line
        key={angle}
        x1="8"
        y1="2.4"
        x2="8"
        y2="5.6"
        transform={`rotate(${angle} 8 8)`}
        style={{ animationDelay: `${index * 100}ms` }}
      />
    ))}
  </svg>
);

const CheckIcon = () => (
  <svg className="ui-plc__mark" viewBox="0 0 16 16" aria-hidden="true">
    <path className="ui-plc__draw" pathLength={1} d="M4.2 8.3l2.6 2.6 5-5.6" />
  </svg>
);

const CrossIcon = () => (
  <svg className="ui-plc__mark" viewBox="0 0 16 16" aria-hidden="true">
    <path className="ui-plc__draw" pathLength={1} d="M5.4 5.4l5.2 5.2M10.6 5.4l-5.2 5.2" />
  </svg>
);

const BadgeIcon = ({ failed }: { failed?: boolean }) => (
  <svg className="ui-plc__badge" viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="7" />
    <path
      className="ui-plc__draw"
      pathLength={1}
      d={failed ? "M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" : "M4.8 8.2l2.4 2.4 4.2-5"}
    />
  </svg>
);

const css = /* css */ `
.ui-plc{--ui-plc-card: #fffdfb;--ui-plc-ink: rgba(11, 9, 8, 0.88);--ui-plc-strong: #0b0908;--ui-plc-text: rgba(11, 9, 8, 0.61);--ui-plc-muted: rgba(11, 9, 8, 0.45);--ui-plc-faint: rgba(11, 9, 8, 0.27);--ui-plc-icon: rgba(11, 9, 8, 0.447);--ui-plc-line: rgba(11, 9, 8, 0.06);--ui-plc-ring: rgba(11, 9, 8, 0.1);--ui-plc-rail: rgba(11, 9, 8, 0.08);--ui-plc-fill: rgba(11, 9, 8, 0.06);--ui-plc-wash: rgba(11, 9, 8, 0.03);--ui-plc-chip: rgba(11, 9, 8, 0.045);--ui-plc-accent: rgba(217, 84, 31, 0.765);--ui-plc-on-accent: #fffdfb;--ui-plc-red: #e2544a;--ui-plc-red-bg: rgba(226, 84, 74, 0.08);--ui-plc-primary: rgba(11, 9, 8, 0.88);--ui-plc-primary-hover: rgba(11, 9, 8, 0.78);--ui-plc-on-primary: #fcf9f7;--ui-plc-raise-hover: #faf7f4;--ui-plc-shine: rgba(255, 253, 251, 0.82);--ui-plc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-plc-shadow-pop: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 12px 28px -10px rgba(11, 9, 8, 0.16), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-plc-focus: rgba(217, 84, 31, 0.35);--ui-plc-edit-glow: rgba(217, 84, 31, 0.1);--ui-plc-ease: cubic-bezier(0.22, 1, 0.36, 1);--ui-plc-inset: 30px;container-type: inline-size;position: relative;box-sizing: border-box;display: grid;width: 100%;max-width: 440px;color: var(--ui-plc-ink);font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;font-weight: 400;line-height: 20px;text-align: left;-webkit-font-smoothing: antialiased}
.ui-plc__card{position: relative;border-radius: 10px;background: var(--ui-plc-card);box-shadow: var(--ui-plc-shadow)}
.ui-plc:not([data-status="draft"]){--ui-plc-inset: 10px}
.ui-plc[data-dragging]{cursor: grabbing;user-select: none;-webkit-user-select: none}
.ui-plc *, .ui-plc *::before, .ui-plc *::after{box-sizing: border-box}
.ui-plc svg{display: block;width: 100%;height: 100%;overflow: visible}
:where(.ui-plc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;letter-spacing: inherit;color: inherit;cursor: pointer}
.ui-plc__sr{position: absolute;width: 1px;height: 1px;margin: -1px;padding: 0;overflow: hidden;clip: rect(0 0 0 0);white-space: nowrap;border: 0}
.ui-plc__head{display: grid;gap: 4px;padding: 16px 16px 10px}
.ui-plc__meta{display: flex;align-items: center;gap: 10px;min-height: 16px;font-size: 12px;line-height: 16px;color: var(--ui-plc-muted)}
.ui-plc__state{display: inline-flex;align-items: center;gap: 6px;min-width: 0}
.ui-plc__state-label{overflow: hidden;text-overflow: ellipsis;white-space: nowrap;font-variant-numeric: tabular-nums}
.ui-plc__state-icon{flex: none;width: 16px;height: 16px;color: var(--ui-plc-icon);fill: none;stroke: currentColor;stroke-width: 1.1;stroke-linecap: round;stroke-linejoin: round}
.ui-plc__state-icon circle[r=".6"]{fill: currentColor}
.ui-plc__estimate{display: inline-flex;align-items: center;gap: 6px;margin-left: auto;white-space: nowrap;font-variant-numeric: tabular-nums}
.ui-plc__estimate svg{width: 16px;height: 16px;color: var(--ui-plc-icon);fill: none;stroke: currentColor;stroke-width: 1.1;stroke-linecap: round;stroke-linejoin: round}
.ui-plc__title{margin: 0;color: var(--ui-plc-strong);font-size: 15px;font-weight: 500;line-height: 24px;text-wrap: balance}
.ui-plc__list{position: relative;margin: 0;padding: 0 6px 6px;list-style: none}
.ui-plc__step{position: relative;display: grid;grid-template-columns: 20px minmax(0, 1fr) auto;column-gap: 10px;align-items: start;padding: 8px 10px 8px var(--ui-plc-inset);border-radius: 6px;outline: none;transition: transform var(--nm-dur-4, 380ms) var(--ui-plc-ease), padding var(--nm-dur-4, 380ms) var(--ui-plc-ease), height var(--nm-dur-3, 240ms) var(--ui-plc-ease), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-plc[data-status="draft"] .ui-plc__step:hover{background: var(--ui-plc-wash)}
.ui-plc__step:focus-visible{outline: 2px solid var(--ui-plc-focus);outline-offset: 0}
.ui-plc__step[data-dragging]{z-index: 2;background: var(--ui-plc-card) !important;box-shadow: var(--ui-plc-shadow-pop);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-plc__step[data-removing]{height: 0 !important;padding-top: 0;padding-bottom: 0;overflow: hidden;opacity: 0;pointer-events: none}
.ui-plc__step[data-enter]{animation: ui-plc-enter 380ms var(--ui-plc-ease) both}
.ui-plc__grip{position: absolute;top: 8px;left: 6px;display: grid;place-items: center;width: 18px;height: 20px;border-radius: 5px;color: var(--ui-plc-faint);fill: currentColor;cursor: grab;touch-action: none;opacity: 0;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-plc__grip svg{width: 16px;height: 16px}
.ui-plc__step:hover .ui-plc__grip, .ui-plc__step:focus-visible .ui-plc__grip, .ui-plc__step[data-dragging] .ui-plc__grip{opacity: 1}
.ui-plc__grip:hover, .ui-plc__step[data-dragging] .ui-plc__grip{color: var(--ui-plc-icon);background: var(--ui-plc-fill)}
.ui-plc__step[data-dragging] .ui-plc__grip{cursor: grabbing}
.ui-plc__marker{position: relative;z-index: 1;display: grid;place-items: center;width: 20px;height: 20px;border-radius: 50%;background: var(--ui-plc-card);box-shadow: inset 0 0 0 0.5px var(--ui-plc-ring), 0 1px 1px -1px rgba(11, 9, 8, 0.1);color: var(--ui-plc-muted);font-size: 11px;font-weight: 500;line-height: 1;font-variant-numeric: tabular-nums;transition: background-color var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-plc__marker > *{grid-area: 1 / 1;animation: ui-plc-pop var(--nm-dur-4, 380ms) var(--ui-plc-ease) both}
.ui-plc__num{animation: none !important}
.ui-plc__marker .ui-plc__spinner{width: 14px;height: 14px}
.ui-plc__mark{width: 12px !important;height: 12px !important;fill: none;stroke: currentColor;stroke-width: 1.6;stroke-linecap: round;stroke-linejoin: round}
.ui-plc__step[data-step="active"] .ui-plc__marker{box-shadow: none;color: var(--ui-plc-accent)}
.ui-plc__step[data-step="done"] .ui-plc__marker{background: var(--ui-plc-accent);box-shadow: none;color: var(--ui-plc-on-accent)}
.ui-plc__step[data-step="failed"] .ui-plc__marker{background: var(--ui-plc-red-bg);box-shadow: none;color: var(--ui-plc-red)}
.ui-plc__step[data-step="skipped"] .ui-plc__marker{box-shadow: none;outline: 1px dashed var(--ui-plc-faint);outline-offset: -1px}
.ui-plc__draw{stroke-dasharray: 1;stroke-dashoffset: 1;animation: ui-plc-draw var(--nm-dur-4, 380ms) var(--ui-plc-ease) 80ms forwards}
.ui-plc__spinner line{stroke: currentColor;stroke-width: 1.4;stroke-linecap: round;opacity: 0.18;animation: ui-plc-ray var(--nm-dur-5, 620ms) linear infinite}
.ui-plc__main{display: grid;gap: 2px;min-width: 0}
.ui-plc__name{color: var(--ui-plc-ink);font-weight: 500;overflow-wrap: anywhere;transition: color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-plc[data-status="draft"] .ui-plc__name{cursor: text}
.ui-plc__step[data-step="pending"] .ui-plc__name{color: var(--ui-plc-text)}
.ui-plc__step[data-step="skipped"] .ui-plc__name{color: var(--ui-plc-muted);text-decoration: line-through;text-decoration-color: var(--ui-plc-faint)}
.ui-plc__sub{display: flex;flex-wrap: wrap;align-items: center;gap: 4px 8px;min-width: 0;color: var(--ui-plc-muted);font-size: 12px;line-height: 16px}
.ui-plc__detail{min-width: 0;overflow-wrap: anywhere}
.ui-plc__tool{padding: 0 5px;border-radius: 5px;background: var(--ui-plc-chip);color: var(--ui-plc-text);font-family: ui-monospace, "SF Mono", Menlo, monospace;font-size: 11px;line-height: 16px;letter-spacing: 0;white-space: nowrap}
.ui-plc__edit{width: calc(100% + 14px);height: 28px;margin: -4px -7px;padding: 0 6px;border: 0;border-radius: 6px;background: var(--ui-plc-card);box-shadow: 0 0 0 0.5px var(--ui-plc-focus), 0 0 0 3px var(--ui-plc-edit-glow);color: var(--ui-plc-ink);font: inherit;font-weight: 500;letter-spacing: inherit;outline: none}
.ui-plc__fail{display: grid;justify-items: start;gap: 8px;margin-top: 4px;animation: ui-plc-fade var(--nm-dur-4, 380ms) var(--ui-plc-ease) both}
.ui-plc__error{color: var(--ui-plc-red);font-size: 12px;line-height: 16px;overflow-wrap: anywhere}
.ui-plc__retry, .ui-plc__btn{display: inline-flex;align-items: center;gap: 6px;height: 28px;padding: 0 10px;border-radius: 6px;font-size: 13px;font-weight: 500;white-space: nowrap;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 160ms var(--ui-plc-ease)}
.ui-plc__retry, .ui-plc__btn--secondary{background: var(--ui-plc-card);box-shadow: var(--ui-plc-shadow);color: var(--ui-plc-strong)}
.ui-plc__retry, .ui-plc__again{padding: 0 10px 0 8px}
.ui-plc__retry svg, .ui-plc__btn--secondary svg{width: 16px;height: 16px;color: var(--ui-plc-icon);fill: none;stroke: currentColor;stroke-width: 1.1;stroke-linecap: round;stroke-linejoin: round}
.ui-plc__retry:hover, .ui-plc__btn--secondary:hover{background: var(--ui-plc-raise-hover)}
.ui-plc__retry:active, .ui-plc__btn:active{transform: scale(0.97)}
.ui-plc__aside{display: flex;align-items: center;min-height: 20px;color: var(--ui-plc-muted);font-size: 12px;font-variant-numeric: tabular-nums;white-space: nowrap}
.ui-plc__time{animation: ui-plc-fade var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-plc__step[data-step="active"] .ui-plc__time{color: var(--ui-plc-ink)}
.ui-plc__remove{display: grid;place-items: center;width: 28px;height: 28px;margin: -4px -6px -4px 0;border-radius: 6px;color: var(--ui-plc-icon);fill: none;stroke: currentColor;stroke-width: 1.1;stroke-linecap: round;opacity: 0;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-plc__remove svg{width: 16px;height: 16px}
.ui-plc__step:hover .ui-plc__remove, .ui-plc__step:focus-visible .ui-plc__remove, .ui-plc__remove:focus-visible{opacity: 1}
.ui-plc__remove:hover{color: var(--ui-plc-ink);background: var(--ui-plc-wash)}
.ui-plc__remove:focus-visible, .ui-plc__retry:focus-visible, .ui-plc__btn:focus-visible{outline: 2px solid var(--ui-plc-focus);outline-offset: 1px}
.ui-plc__rail{position: absolute;top: 31px;bottom: -5px;left: calc(var(--ui-plc-inset) + 9.5px);width: 1px;overflow: hidden;background: var(--ui-plc-rail);opacity: 0;pointer-events: none;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-plc:not([data-status="draft"]) .ui-plc__rail{opacity: 1;transition-delay: 240ms}
.ui-plc__rail::after{content: "";position: absolute;inset: 0;background: var(--ui-plc-accent);transform: scaleY(0);transform-origin: top;transition: transform var(--nm-dur-5, 620ms) var(--ui-plc-ease)}
.ui-plc__step[data-step="done"] .ui-plc__rail::after, .ui-plc__step[data-step="skipped"] .ui-plc__rail::after{transform: scaleY(1)}
.ui-plc__tail{display: grid;grid-template-rows: 1fr;transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-plc-ease), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-plc:not([data-status="draft"]) .ui-plc__tail{grid-template-rows: 0fr;opacity: 0}
.ui-plc__tail-inner{min-height: 0;overflow: hidden}
.ui-plc__add{display: grid;grid-template-columns: 20px minmax(0, 1fr);column-gap: 10px;align-items: center;margin: -4px 6px 8px;padding: 6px 10px 6px var(--ui-plc-inset);border-radius: 6px;cursor: text;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-plc__add:hover, .ui-plc__add:focus-within{background: var(--ui-plc-wash)}
.ui-plc__add-icon{display: grid;place-items: center;width: 20px;height: 20px;color: var(--ui-plc-icon);fill: none;stroke: currentColor;stroke-width: 1.1;stroke-linecap: round}
.ui-plc__add-icon svg{width: 16px;height: 16px}
.ui-plc__add input{width: 100%;min-width: 0;height: 20px;padding: 0;border: 0;background: none;color: var(--ui-plc-ink);font: inherit;letter-spacing: inherit;outline: none}
.ui-plc__add input::placeholder{color: var(--ui-plc-faint);opacity: 1}
.ui-plc__foot{display: flex;align-items: center;gap: 12px;min-height: 48px;padding: 0 10px 0 16px;border-top: 0.5px solid var(--ui-plc-line);color: var(--ui-plc-muted);font-size: 12px;line-height: 16px}
.ui-plc__foot > *{animation: ui-plc-fade var(--nm-dur-4, 380ms) var(--ui-plc-ease) both}
.ui-plc__hint{min-width: 0;overflow: hidden;text-overflow: ellipsis;white-space: nowrap}
.ui-plc__actions{display: flex;flex: none;gap: 8px;margin-left: auto}
.ui-plc__btn--primary{padding: 0 8px 0 10px;background: var(--ui-plc-primary);color: var(--ui-plc-on-primary)}
.ui-plc__btn--primary:hover{background: var(--ui-plc-primary-hover)}
.ui-plc__btn--primary:disabled{opacity: 0.4;cursor: default;transform: none}
.ui-plc__btn--primary svg{width: 16px;height: 16px;fill: currentColor}
.ui-plc__status{display: inline-flex;align-items: center;gap: 8px;min-width: 0;color: var(--ui-plc-ink);font-size: 13px;line-height: 20px}
.ui-plc__status-icon{flex: none;width: 16px;height: 16px;color: var(--ui-plc-accent)}
.ui-plc__status-icon .ui-plc__spinner{width: 14px;height: 14px;margin: 1px}
.ui-plc__badge circle{fill: currentColor}
.ui-plc__badge path{fill: none;stroke: var(--ui-plc-on-accent);stroke-width: 1.4;stroke-linecap: round;stroke-linejoin: round}
.ui-plc__foot[data-phase="failed"] .ui-plc__status-icon{color: var(--ui-plc-red-bg)}
.ui-plc__foot[data-phase="failed"] .ui-plc__badge path{stroke: var(--ui-plc-red);stroke-width: 1.6}
.ui-plc__foot[data-phase="failed"] .ui-plc__status{color: var(--ui-plc-red)}
.ui-plc__status-label{position: relative;overflow: hidden;text-overflow: ellipsis;white-space: nowrap;font-variant-numeric: tabular-nums}
.ui-plc__foot[data-phase="done"] .ui-plc__status-label{font-weight: 500}
.ui-plc__shimmer{color: var(--ui-plc-muted)}
.ui-plc__shimmer::after{content: attr(data-text);content: attr(data-text) / "";position: absolute;inset: 0;white-space: nowrap;color: transparent;background: linear-gradient(90deg, transparent 38%, var(--ui-plc-shine) 50%, transparent 62%) 100% 0 / 300% 100% no-repeat;-webkit-background-clip: text;background-clip: text;animation: ui-plc-sweep var(--nm-dur-6, 1100ms) linear infinite;pointer-events: none}
.ui-plc__elapsed{margin-left: auto;padding-right: 6px;color: var(--ui-plc-faint);font-variant-numeric: tabular-nums;white-space: nowrap}
@media (hover: none){.ui-plc__grip, .ui-plc__remove{opacity: 1}
}
@media (pointer: coarse){.ui-plc__foot{min-height: 56px}
.ui-plc__btn, .ui-plc__retry{height: 36px}
.ui-plc__remove{width: 36px;height: 36px;margin: -8px -10px -8px 0}
.ui-plc__grip::after{content: "";position: absolute;inset: -8px -6px}
}
@container (max-width: 400px){.ui-plc__hint{display: none}
}
@container (max-width: 340px){.ui-plc__head{padding: 14px 14px 10px}
.ui-plc__list{padding-inline: 4px}
.ui-plc__step, .ui-plc__add{column-gap: 8px;padding-right: 8px}
.ui-plc__add{margin-inline: 4px}
.ui-plc__foot{padding-left: 14px}
}
@keyframes ui-plc-fade{from{opacity: 0;transform: translateY(3px)}
to{opacity: 1;transform: none}
}
@keyframes ui-plc-enter{from{opacity: 0;transform: translateY(6px)}
to{opacity: 1;transform: none}
}
@keyframes ui-plc-pop{from{opacity: 0;transform: scale(0.5)}
to{opacity: 1;transform: none}
}
@keyframes ui-plc-draw{to{stroke-dashoffset: 0}
}
@keyframes ui-plc-ray{0%{opacity: 1}
100%{opacity: 0.18}
}
@keyframes ui-plc-sweep{from{background-position: 100% 0}
to{background-position: 0% 0}
}
@media (prefers-reduced-motion: reduce){.ui-plc *, .ui-plc *::before, .ui-plc *::after{animation-duration: 1ms !important;animation-delay: 0ms !important;animation-iteration-count: 1 !important;transition-duration: 1ms !important;transition-delay: 0ms !important}
.ui-plc__spinner line{opacity: 0.6}
.ui-plc__draw{stroke-dashoffset: 0}
.ui-plc__shimmer::after{display: none}
}
:where(.dark, [data-theme="dark"]) .ui-plc{--ui-plc-card: #211b16;--ui-plc-ink: rgba(255, 253, 251, 0.9);--ui-plc-strong: #fffdfb;--ui-plc-text: rgba(255, 253, 251, 0.62);--ui-plc-muted: rgba(255, 253, 251, 0.46);--ui-plc-faint: rgba(255, 253, 251, 0.3);--ui-plc-icon: rgba(255, 253, 251, 0.5);--ui-plc-line: rgba(255, 253, 251, 0.08);--ui-plc-ring: rgba(255, 253, 251, 0.14);--ui-plc-rail: rgba(255, 253, 251, 0.1);--ui-plc-fill: rgba(255, 253, 251, 0.08);--ui-plc-wash: rgba(255, 253, 251, 0.04);--ui-plc-chip: rgba(255, 253, 251, 0.07);--ui-plc-accent: #ff8a5c;--ui-plc-red: #e2544a;--ui-plc-red-bg: rgba(226, 84, 74, 0.14);--ui-plc-primary: rgba(255, 253, 251, 0.9);--ui-plc-primary-hover: rgba(255, 253, 251, 0.8);--ui-plc-on-primary: #211b16;--ui-plc-raise-hover: #27201a;--ui-plc-shine: #fffdfb;--ui-plc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-plc-shadow-pop: 0 0 0 0.5px rgba(255, 253, 251, 0.12), 0 12px 28px -10px rgba(11, 9, 8, 0.6);--ui-plc-focus: rgba(255, 138, 92, 0.5);--ui-plc-edit-glow: rgba(255, 138, 92, 0.14)}
:where(.dark, [data-theme="dark"]) .ui-plc__marker{box-shadow: inset 0 0 0 0.5px var(--ui-plc-ring)}

`;
