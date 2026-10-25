"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/*
 * Goal Tracker: the objective a run is holding itself to, what it has spent against that
 * goal's budget, and how long it has been going. The clock counts from the banked seconds
 * while the goal is active, one second per second, and holds when the goal is paused or the
 * tab is hidden; pausing, dropping and editing all resolve in place, so the card never
 * leaves the surface it belongs to. A completed or dropped goal folds to a single receipt
 * line. The styles are injected below, so no extra files are needed.
 */

export type GoalStatus = "active" | "paused" | "completed" | "dropped";

export type GoalTrackerProps = {
  /** What the goal is trying to reach, as the run stated it */
  objective: string;
  /** Where the goal stands; leave it out and the card owns the state itself */
  status?: GoalStatus;
  /** Tokens spent on the goal so far */
  tokensUsed?: number;
  /** Token ceiling for the goal; omit for a goal with no ceiling */
  tokenBudget?: number;
  /** Run time banked before this render, in seconds */
  timeUsedSeconds?: number;
  /** Called when a running goal should stop counting */
  onPause?: () => void;
  /** Called when a paused goal should run again, or a dropped one should be restored */
  onResume?: () => void;
  /** Called once the user confirms the drop; dropping discards the run's direction */
  onDrop?: () => void;
  /** Called with the committed objective text */
  onEditObjective?: (objective: string) => void;
  /** Extra class on the root */
  className?: string;
};

const STATUS_WORD: Record<GoalStatus, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Reached",
  dropped: "Dropped",
};

/* Announced once per transition, so the clock itself never talks over the reader */
const STATUS_NOTE: Record<GoalStatus, string> = {
  active: "Goal running",
  paused: "Goal paused",
  completed: "Goal reached",
  dropped: "Goal dropped",
};

/* One glyph per state: a live dot, a hold, a tick, a cross. The word beside it says the
 * same thing, so a status never rests on colour alone. */
const STATUS_GLYPH: Record<GoalStatus, ReactNode> = {
  active: (
    <svg viewBox="0 0 12 12" width="12" height="12" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="2.4" fill="currentColor" stroke="none" />
    </svg>
  ),
  paused: (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4.3 3.4v5.2" />
      <path d="M7.7 3.4v5.2" />
    </svg>
  ),
  completed: (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.6 6.4 4.9 8.7 9.4 3.6" />
    </svg>
  ),
  dropped: (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M3.4 3.4 8.6 8.6" />
      <path d="M8.6 3.4 3.4 8.6" />
    </svg>
  ),
};

const CLOCK_GLYPH = (
  <svg
    viewBox="0 0 12 12"
    width="12"
    height="12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <circle cx="6" cy="6" r="4.2" />
    <path d="M6 3.6V6l1.7 1.1" />
  </svg>
);

const exact = (value: number) => Math.max(0, Math.round(value)).toLocaleString("en-US");

/* Thousands separate below ten thousand; from there the figure goes compact, so a spend
 * read-out stays a glance rather than a count. */
function compact(value: number): string {
  const n = Math.max(0, Math.round(value));
  if (n < 10_000) return exact(n);
  const one = (part: number) => (Math.round(part * 10) / 10).toFixed(1).replace(/\.0$/, "");
  if (n < 1_000_000) return `${n >= 100_000 ? exact(Math.round(n / 1000)) : one(n / 1000)}k`;
  return `${one(n / 1_000_000)}M`;
}

/* Above an hour the seconds are noise, so the figure drops them; below it they are the
 * only sign the clock is still moving. */
function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes}m ${String(total % 60).padStart(2, "0")}s`;
}

export function GoalTracker({
  objective,
  status,
  tokensUsed = 0,
  tokenBudget,
  timeUsedSeconds = 0,
  onPause,
  onResume,
  onDrop,
  onEditObjective,
  className,
}: GoalTrackerProps) {
  const [ownStatus, setOwnStatus] = useState<GoalStatus>("active");
  const live = status ?? ownStatus;
  const running = live === "active";
  const folded = live === "completed" || live === "dropped";

  /* The caller owns the objective once it passes onEditObjective; without it the card
   * keeps the committed text itself. */
  const [edited, setEdited] = useState<string | null>(null);
  const text = edited ?? objective;

  const [elapsed, setElapsed] = useState(() => Math.max(0, Math.floor(timeUsedSeconds)));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [announced, setAnnounced] = useState("");

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLButtonElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const focusRef = useRef<"drop" | "undo" | "edit">("drop");
  const [focusRequest, setFocusRequest] = useState(0);
  const spoken = useRef<GoalStatus>(live);

  /* A fresh objective from the caller wins over the local commit */
  useEffect(() => {
    setEdited(null);
  }, [objective]);

  /* A fresh banked figure restarts the count from the caller's number */
  useEffect(() => {
    setElapsed(Math.max(0, Math.floor(timeUsedSeconds)));
  }, [timeUsedSeconds]);

  /* One second of visible time at a time. The anchor absorbs interval drift, and the tab
   * going hidden banks what has already run and then tears the interval down, so nothing
   * ticks in a background tab and nothing is invented while it is away. */
  useEffect(() => {
    if (!running || typeof window === "undefined") return;

    let id = 0;
    let mark = 0;

    const fold = () => {
      if (!mark) return;
      const whole = Math.floor((Date.now() - mark) / 1000);
      if (whole <= 0) return;
      mark += whole * 1000;
      setElapsed((value) => value + whole);
    };

    const start = () => {
      if (id) return;
      mark = Date.now();
      id = window.setInterval(fold, 500);
    };

    const stop = () => {
      fold();
      mark = 0;
      if (id) window.clearInterval(id);
      id = 0;
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (id) window.clearInterval(id);
    };
  }, [running]);

  /* Only a transition is spoken; the mount state and every re-render stay quiet, and the
   * per-second clock never reaches the reader */
  useEffect(() => {
    if (spoken.current === live) return;
    spoken.current = live;
    setAnnounced(STATUS_NOTE[live]);
  }, [live]);

  useEffect(() => {
    if (!editing) return;
    const field = editorRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, [editing]);

  useEffect(() => {
    if (!confirming) return;
    keepRef.current?.focus();
  }, [confirming]);

  /* Focus lands somewhere real after the row it was on is gone */
  useEffect(() => {
    if (focusRequest === 0) return;
    const target =
      focusRef.current === "undo" ? undoRef : focusRef.current === "edit" ? editRef : dropRef;
    target.current?.focus();
  }, [focusRequest]);

  useEffect(() => {
    if (folded) setConfirming(false);
  }, [folded]);

  const pause = () => {
    onPause?.();
    setOwnStatus("paused");
  };

  const resume = () => {
    onResume?.();
    setOwnStatus("active");
  };

  const closeConfirm = () => {
    setConfirming(false);
    focusRef.current = "drop";
    setFocusRequest((count) => count + 1);
  };

  const confirmDrop = () => {
    onDrop?.();
    setOwnStatus("dropped");
    setConfirming(false);
    focusRef.current = "undo";
    setFocusRequest((count) => count + 1);
  };

  const startEdit = () => {
    setDraft(text);
    setEditing(true);
  };

  const closeEditor = () => {
    setEditing(false);
    focusRef.current = "edit";
    setFocusRequest((count) => count + 1);
  };

  const commitEdit = () => {
    const next = draft.trim();
    closeEditor();
    if (!next || next === text) return;
    setEdited(next);
    onEditObjective?.(next);
  };

  const used = Math.max(0, Math.round(tokensUsed));
  const budget = tokenBudget !== undefined && tokenBudget > 0 ? Math.round(tokenBudget) : undefined;
  const over = budget !== undefined && used > budget;
  const overBy = budget === undefined ? 0 : Math.max(0, used - budget);
  const fill = budget === undefined ? 0 : Math.min(1, used / budget);
  /* Past the budget the bar normalises to what was spent, so the overflow is a share of
   * the bar rather than a sliver past its end. */
  const limitAt = over && budget !== undefined ? budget / Math.max(used, 1) : 1;

  return (
    <div className={["ui-glt", className].filter(Boolean).join(" ")} data-status={live}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-goal-tracker" precedence="default">
        {css}
      </style>

      {folded ? (
        <div className="ui-glt__receipt">
          <span className="ui-glt__status">
            <span className="ui-glt__pulse" aria-hidden="true">
              {STATUS_GLYPH[live]}
            </span>
            {STATUS_WORD[live]}
          </span>
          <p
            className="ui-glt__receipt-text"
            data-struck={live === "dropped" ? "true" : undefined}
            title={text}
          >
            {text}
          </p>
          <span className="ui-glt__receipt-meta">
            {clock(elapsed)} · {compact(used)} tokens
          </span>
          {live === "dropped" ? (
            <button
              ref={undoRef}
              type="button"
              className="ui-glt__btn"
              data-tone="quiet"
              onClick={resume}
            >
              Undo
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="ui-glt__head">
            <span className="ui-glt__status">
              <span className="ui-glt__pulse" aria-hidden="true">
                {STATUS_GLYPH[live]}
              </span>
              {STATUS_WORD[live]}
            </span>
            <span className="ui-glt__clock" role="timer" aria-label={`${clock(elapsed)} of run time`}>
              {CLOCK_GLYPH}
              <time dateTime={`PT${elapsed}S`}>{clock(elapsed)}</time>
            </span>
          </div>

          {editing ? (
            <div className="ui-glt__editor">
              <textarea
                ref={editorRef}
                className="ui-glt__input"
                rows={3}
                value={draft}
                aria-label="Goal objective"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    commitEdit();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    closeEditor();
                  }
                }}
              />
              <div className="ui-glt__editor-foot">
                <button type="button" className="ui-glt__btn" data-tone="solid" onClick={commitEdit}>
                  Save
                </button>
                <button
                  type="button"
                  className="ui-glt__btn"
                  data-tone="quiet"
                  onClick={closeEditor}
                >
                  Cancel
                </button>
                <span className="ui-glt__hint">Enter saves, Shift+Enter breaks, Escape cancels</span>
              </div>
            </div>
          ) : (
            <p className="ui-glt__objective">{text}</p>
          )}

          <div className="ui-glt__meter">
            <p className="ui-glt__figure">
              <span className="ui-glt__tokens">
                <b>{compact(used)}</b> tokens
              </span>
              {budget !== undefined ? <span className="ui-glt__of">of {compact(budget)}</span> : null}
              {over ? (
                <span
                  className="ui-glt__over"
                  title={`${exact(overBy)} tokens past the ${exact(budget ?? 0)} budget`}
                >
                  <svg viewBox="0 0 10 10" width="10" height="10" fill="none" aria-hidden="true">
                    <path d="M5 1.7 9 8.3H1z" fill="currentColor" stroke="none" />
                  </svg>
                  over budget
                </span>
              ) : null}
            </p>

            {budget !== undefined ? (
              <div
                className="ui-glt__track"
                role="meter"
                aria-label="Tokens against the goal budget"
                aria-valuemin={0}
                aria-valuemax={budget}
                aria-valuenow={Math.min(used, budget)}
                aria-valuetext={`${exact(used)} of ${exact(budget)} tokens${
                  over ? `, ${exact(overBy)} over budget` : ""
                }`}
              >
                <span className="ui-glt__fill" style={{ transform: `scaleX(${fill})` }} />
                {over ? (
                  <span
                    className="ui-glt__spill"
                    style={{
                      transform: `translateX(${limitAt * 100}%) scaleX(${1 - limitAt})`,
                    }}
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          {editing ? null : (
            <div className="ui-glt__foot">
              {confirming ? (
                <div
                  className="ui-glt__confirm"
                  role="group"
                  aria-label="Confirm dropping this goal"
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      closeConfirm();
                    }
                  }}
                >
                  <span className="ui-glt__confirm-text">Drop this goal?</span>
                  <button
                    type="button"
                    className="ui-glt__btn"
                    data-tone="danger"
                    onClick={confirmDrop}
                  >
                    Drop
                  </button>
                  <button
                    ref={keepRef}
                    type="button"
                    className="ui-glt__btn"
                    data-tone="quiet"
                    onClick={closeConfirm}
                  >
                    Keep
                  </button>
                </div>
              ) : (
                <>
                  <button ref={editRef} type="button" className="ui-glt__btn" onClick={startEdit}>
                    Edit
                  </button>
                  {running ? (
                    <button type="button" className="ui-glt__btn" onClick={pause}>
                      Pause
                    </button>
                  ) : (
                    <button type="button" className="ui-glt__btn" data-tone="solid" onClick={resume}>
                      Resume
                    </button>
                  )}
                  <button
                    ref={dropRef}
                    type="button"
                    className="ui-glt__btn"
                    data-tone="quiet"
                    onClick={() => setConfirming(true)}
                  >
                    Drop
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}

      <p className="ui-glt__live" role="status" aria-live="polite">
        {announced}
      </p>
    </div>
  );
}

const css = /* css */ `
.ui-glt {
  /* Knobs. Override any of these on .ui-glt to retheme the card in a host. */
  --ui-glt-ink: var(--text, #1a1410);
  --ui-glt-muted: var(--text-muted, #6f625a);
  --ui-glt-panel: var(--panel, #fffdfb);
  --ui-glt-line: var(--border, #e8e0d7);
  --ui-glt-edge: var(--border-soft, #1a14101a);
  --ui-glt-wash: #7a4a1c0a;
  --ui-glt-track: #7a4a1c0f;
  --ui-glt-fill: #8a4b1f;
  --ui-glt-ok: var(--success, #1a7a4a);
  --ui-glt-warn: var(--warning, #9a6410);
  --ui-glt-danger: var(--danger, #b3261e);
  --ui-glt-accent: var(--accent, #c2410c);
  --ui-glt-focus: var(--accent, #c2410c);
  --ui-glt-ease: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-glt-ease-soft: var(--nm-ease-soft, cubic-bezier(0.4, 0, 0.2, 1));
  --ui-glt-dur-1: var(--nm-dur-1, 90ms);
  --ui-glt-dur-2: var(--nm-dur-2, 160ms);
  --ui-glt-dur-3: var(--nm-dur-3, 240ms);
  --ui-glt-dur-5: var(--nm-dur-5, 620ms);
  --ui-glt-dur-6: var(--nm-dur-6, 1100ms);
  /* The tone carries the state word's colour; the word itself carries the meaning, so a
   * status is never colour alone. */
  --ui-glt-tone: var(--ui-glt-muted);

  position: relative;
  box-sizing: border-box;
  display: grid;
  gap: 10px;
  width: 100%;
  padding: 14px 16px;
  background: var(--ui-glt-panel);
  border-radius: var(--radius-card, 16px);
  box-shadow: inset 0 0 0 1px var(--ui-glt-line);
  color: var(--ui-glt-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 18px;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-glt *,
.ui-glt *::before,
.ui-glt *::after {
  box-sizing: border-box;
}
.ui-glt p {
  margin: 0;
}
:where(.ui-glt) button {
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
:where(.ui-glt) svg {
  display: block;
}

/* The ember accent marks the live state only; a verdict uses the semantic trio. */
.ui-glt[data-status="active"] {
  --ui-glt-tone: var(--ui-glt-accent);
}
.ui-glt[data-status="paused"] {
  --ui-glt-tone: var(--ui-glt-muted);
}
.ui-glt[data-status="completed"] {
  --ui-glt-tone: var(--ui-glt-ok);
}
.ui-glt[data-status="dropped"] {
  --ui-glt-tone: var(--ui-glt-danger);
}

/* Head -------------------------------------------------------------------- */
.ui-glt__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 20px;
}
.ui-glt__status {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  height: 20px;
  padding: 0 8px 0 6px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-glt-wash);
  color: var(--ui-glt-tone);
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
  transition: color var(--ui-glt-dur-3) var(--ui-glt-ease);
}
.ui-glt__pulse {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  width: 12px;
  height: 12px;
}
/* A slow halo, one scale step and a fade, so "alive" is legible at rest without a glow
 * that competes with the data. */
.ui-glt__pulse::after {
  content: "";
  position: absolute;
  inset: 2px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0;
  pointer-events: none;
}
.ui-glt[data-status="active"] .ui-glt__pulse::after {
  animation: ui-glt-pulse var(--ui-glt-dur-6) var(--ui-glt-ease-soft) infinite;
}
@keyframes ui-glt-pulse {
  from {
    transform: scale(1);
    opacity: 0.36;
  }
  to {
    transform: scale(2);
    opacity: 0;
  }
}
.ui-glt__clock {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  color: var(--ui-glt-muted);
  font-size: 11.5px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* Objective --------------------------------------------------------------- */
.ui-glt__objective {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  line-height: 21px;
  letter-spacing: -0.012em;
  color: var(--ui-glt-ink);
  overflow-wrap: anywhere;
}

/* Editor ------------------------------------------------------------------ */
.ui-glt__editor {
  display: grid;
  gap: 6px;
}
.ui-glt__input {
  box-sizing: border-box;
  width: 100%;
  min-height: 62px;
  padding: 7px 9px;
  border: 0;
  border-radius: var(--radius-preview, 12px);
  background: var(--ui-glt-wash);
  box-shadow: inset 0 0 0 1px var(--ui-glt-edge);
  color: var(--ui-glt-ink);
  font-family: inherit;
  font-size: 13px;
  line-height: 20px;
  letter-spacing: -0.01em;
  resize: none;
}
.ui-glt__input:focus-visible {
  outline: 2px solid var(--ui-glt-focus);
  outline-offset: 1px;
}
.ui-glt__editor-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.ui-glt__hint {
  margin-left: auto;
  color: var(--ui-glt-muted);
  font-size: 10.5px;
  line-height: 15px;
}

/* Spend ------------------------------------------------------------------- */
.ui-glt__meter {
  display: grid;
  gap: 6px;
}
.ui-glt__figure {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  font-size: 11.5px;
  line-height: 16px;
  color: var(--ui-glt-muted);
}
.ui-glt__tokens b {
  font-weight: 500;
  color: var(--ui-glt-ink);
  font-variant-numeric: tabular-nums;
}
.ui-glt__of {
  color: var(--ui-glt-muted);
  font-variant-numeric: tabular-nums;
}
.ui-glt__over {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  color: var(--ui-glt-warn);
  font-weight: 500;
  white-space: nowrap;
}
.ui-glt__track {
  position: relative;
  height: 6px;
  overflow: hidden;
  background: var(--ui-glt-track);
  border-radius: var(--radius-pill, 999px);
  box-shadow: inset 0 0 0 1px var(--ui-glt-edge);
}
/* Both parts are full-width and moved by transform, so the bar grows without a single
 * width transition. */
.ui-glt__fill,
.ui-glt__spill {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-pill, 999px);
  transform-origin: 0 50%;
  transition: transform var(--ui-glt-dur-5) var(--ui-glt-ease);
}
.ui-glt__fill {
  background: var(--ui-glt-fill);
}
/* Hatching keeps the overflow legible over the fill underneath it, and the warning ink
 * keeps it distinct from the ember that marks the live state. */
.ui-glt__spill {
  background: repeating-linear-gradient(
    115deg,
    var(--ui-glt-warn) 0 2px,
    transparent 2px 5px
  );
  opacity: 0.9;
}

/* Actions ----------------------------------------------------------------- */
.ui-glt__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.ui-glt__btn {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 26px;
  padding: 0 10px;
  border-radius: 8px;
  background: var(--ui-glt-wash);
  color: var(--ui-glt-ink);
  font-size: 11.5px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
  transition:
    background-color var(--ui-glt-dur-2) var(--ui-glt-ease),
    color var(--ui-glt-dur-2) var(--ui-glt-ease),
    box-shadow var(--ui-glt-dur-2) var(--ui-glt-ease),
    opacity var(--ui-glt-dur-2) var(--ui-glt-ease),
    transform var(--ui-glt-dur-1) var(--ui-glt-ease);
}
.ui-glt__btn:hover {
  background: var(--ui-glt-track);
}
.ui-glt__btn:active {
  transform: scale(0.97);
}
.ui-glt__btn:focus-visible {
  outline: 2px solid var(--ui-glt-focus);
  outline-offset: 1px;
}
.ui-glt__btn[data-tone="quiet"] {
  background: transparent;
  color: var(--ui-glt-muted);
}
.ui-glt__btn[data-tone="quiet"]:hover {
  background: var(--ui-glt-wash);
  color: var(--ui-glt-ink);
}
.ui-glt__btn[data-tone="solid"] {
  background: var(--ui-glt-ink);
  color: var(--ui-glt-panel);
}
.ui-glt__btn[data-tone="solid"]:hover {
  background: var(--ui-glt-ink);
  color: var(--ui-glt-panel);
  opacity: 0.88;
}
.ui-glt__btn[data-tone="solid"]:active {
  opacity: 1;
}
.ui-glt__btn[data-tone="danger"] {
  background: var(--ui-glt-wash);
  color: var(--ui-glt-danger);
  box-shadow: inset 0 0 0 1px var(--ui-glt-danger);
}
.ui-glt__btn[data-tone="danger"]:hover {
  background: var(--ui-glt-track);
}

/* Drop confirmation ------------------------------------------------------- */
.ui-glt__confirm {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  border-radius: var(--radius-preview, 12px);
  background: var(--ui-glt-wash);
  box-shadow: inset 0 0 0 1px var(--ui-glt-edge);
  animation: ui-glt-in var(--ui-glt-dur-3) var(--ui-glt-ease) both;
}
.ui-glt__confirm-text {
  margin-right: auto;
  color: var(--ui-glt-ink);
  font-size: 11.5px;
  font-weight: 500;
}
@keyframes ui-glt-in {
  from {
    opacity: 0;
    transform: translateY(-2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Receipt ----------------------------------------------------------------- */
.ui-glt__receipt {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  min-height: 20px;
}
.ui-glt__receipt-text {
  flex: 1 1 150px;
  min-width: 0;
  overflow: hidden;
  color: var(--ui-glt-ink);
  font-size: 12.5px;
  line-height: 18px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-glt__receipt-text[data-struck="true"] {
  color: var(--ui-glt-muted);
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}
.ui-glt__receipt-meta {
  flex: none;
  color: var(--ui-glt-muted);
  font-size: 11.5px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* The clock changes every second, so only the transitions are spoken */
.ui-glt__live {
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

:where(.dark, [data-theme="dark"]) .ui-glt {
  --ui-glt-ink: var(--text, #f4ece4);
  --ui-glt-muted: var(--text-muted, #a2958a);
  --ui-glt-panel: var(--panel, #1a1512);
  --ui-glt-line: var(--border, #33291f);
  --ui-glt-edge: var(--border-soft, #ffffff12);
  --ui-glt-wash: #ffffff0d;
  --ui-glt-track: #ffffff12;
  --ui-glt-fill: #c2703a;
  --ui-glt-ok: var(--success, #4f9d6e);
  --ui-glt-warn: var(--warning, #d99530);
  --ui-glt-danger: var(--danger, #e2544a);
  --ui-glt-accent: var(--accent, #ff6b35);
  --ui-glt-focus: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  .ui-glt,
  .ui-glt *,
  .ui-glt *::before,
  .ui-glt *::after {
    animation: none;
    transition-duration: 1ms;
  }
  .ui-glt__confirm {
    opacity: 1;
    transform: none;
  }
  .ui-glt[data-status="active"] .ui-glt__pulse::after {
    opacity: 0;
  }
}
`;
