"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

/*
 * Todo Phases: the agent's plan as phase groups, each with its own count and progress bar.
 * A phase folds from its header, except when it holds the live step – that one refuses, because
 * hiding the step the agent is on defeats the panel. Folding is a display swap with the rows
 * fading back in, so nothing animates height; the live ring breathes at the ambient step while
 * everything else settles on the standard curve. Styles are injected below, so no extra files
 * are needed.
 */

export type TodoStatus = "pending" | "active" | "done" | "blocked";

export type TodoItem = {
  /** The step, in the agent's own wording */
  text: string;
  /** Where the step stands; the glyph and the word beside it both say it */
  status: TodoStatus;
  /** What the step touches, read under the active step only */
  detail?: string;
};

export type TodoPhase = {
  /** Phase name, and the key that remembers whether it is folded */
  name: string;
  /** Steps in this phase, in plan order */
  items: readonly TodoItem[];
};

export type TodoPhasesProps = {
  /** Phases exactly as the agent sent them; set_todos replaces the list wholesale */
  phases: readonly TodoPhase[];
  /** Reminder frame's attempt counter; the header appears only when this is set */
  attempt?: number;
  /** Ceiling the attempt counter runs against */
  maxAttempts?: number;
  /** Called with the phase name and the row that was activated; omit for a read-only list */
  onToggle?: (phase: string, item: TodoItem) => void;
  /** Extra class on the root */
  className?: string;
};

const STATUS_WORD: Record<TodoStatus, string> = {
  pending: "Pending",
  active: "Active",
  done: "Done",
  blocked: "Blocked",
};

/* One glyph per status, each readable without its colour: a hollow circle, a filled
 * ring, a check, and a bar. */
const STATUS_GLYPH: Record<TodoStatus, ReactNode> = {
  pending: (
    <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  active: (
    <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="3.4" stroke="currentColor" strokeWidth="3" />
    </svg>
  ),
  done: (
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.4 7.3 5.9 9.7 10.6 4.4" />
    </svg>
  ),
  blocked: (
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M3.2 7h7.6" />
    </svg>
  ),
};

/* The reminder frame restates the plan; the arrow is the same one the agent is taking. */
const REMINDER_GLYPH: ReactNode = (
  <svg
    viewBox="0 0 14 14"
    width="12"
    height="12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 7a5 5 0 1 1-1.6-3.7" />
    <path d="M12.2 2.4v3.2H9" />
  </svg>
);

export function TodoPhases({ phases, attempt, maxAttempts, onToggle, className }: TodoPhasesProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const [nudge, setNudge] = useState<{ name: string; tick: number } | null>(null);
  const [note, setNote] = useState("");

  /* set_todos replaces the list wholesale, so a phase can turn live while it is folded. The
   * open state is derived below and stays open in that same paint; this clears the stale memory
   * so the next fold starts from the truth. */
  useEffect(() => {
    setFolded((prev) => {
      let next: Record<string, boolean> | null = null;
      for (const phase of phases) {
        if (!prev[phase.name]) continue;
        if (phase.items.some((item) => item.status === "active")) {
          if (next === null) next = { ...prev };
          next[phase.name] = false;
        }
      }
      return next ?? prev;
    });
  }, [phases]);

  const total = phases.reduce((sum, phase) => sum + phase.items.length, 0);
  /* Overall progress is done items over all items, never a mean of the phase percentages:
   * a two-step phase must not weigh the same as a nine-step one. */
  const done = phases.reduce(
    (sum, phase) => sum + phase.items.filter((item) => item.status === "done").length,
    0,
  );

  const fold = (phase: TodoPhase, live: boolean, open: boolean) => {
    if (live) {
      setNudge((current) => ({
        name: phase.name,
        tick: (current !== null && current.name === phase.name ? current.tick : 0) + 1,
      }));
      setNote(`${phase.name} holds the live step, so it stays open.`);
      return;
    }
    setFolded((prev) => ({ ...prev, [phase.name]: open }));
    setNote(`${phase.name} ${open ? "folded" : "opened"}.`);
  };

  return (
    <div className={["ui-tdp", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-todo-phases" precedence="default">
        {css}
      </style>

      {attempt !== undefined ? (
        <p className="ui-tdp__reminder">
          <span className="ui-tdp__reminder-glyph">{REMINDER_GLYPH}</span>
          <span>
            Attempt <span className="ui-tdp__num">{attempt}</span>
            {maxAttempts !== undefined ? (
              <>
                {" of "}
                <span className="ui-tdp__num">{maxAttempts}</span>
              </>
            ) : null}
          </span>
        </p>
      ) : null}

      {total === 0 ? (
        <p className="ui-tdp__empty">No todos yet. The agent has not written a plan.</p>
      ) : (
        <>
          <header className="ui-tdp__head">
            <p className="ui-tdp__label">Todos</p>
            <p className="ui-tdp__overall">
              <span className="ui-tdp__num">{done}</span> / {total} done
            </p>
          </header>

          <div
            className="ui-tdp__meter"
            role="progressbar"
            aria-label="Todos complete"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
            aria-valuetext={`${done} of ${total} items done`}
          >
            <span className="ui-tdp__meter-fill" style={{ transform: `scaleX(${done / total})` }} />
          </div>

          <ol className="ui-tdp__phases">
            {phases.map((phase, index) => {
              const count = phase.items.length;
              const phaseDone = phase.items.filter((item) => item.status === "done").length;
              const live = phase.items.some((item) => item.status === "active");
              const open = live || !folded[phase.name];
              const panelId = `ui-tdp-panel-${uid}-${index}`;
              const tick = nudge !== null && nudge.name === phase.name ? nudge.tick : 0;

              return (
                <li
                  className="ui-tdp__phase"
                  data-open={open ? "true" : "false"}
                  key={`${phase.name}-${index}`}
                >
                  <button
                    type="button"
                    className="ui-tdp__toggle"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => fold(phase, live, open)}
                  >
                    <span
                      className="ui-tdp__caret"
                      key={tick === 0 ? "rest" : `n${tick}`}
                      data-nudge={tick > 0 ? "true" : undefined}
                      aria-hidden="true"
                    >
                      <svg
                        viewBox="0 0 14 14"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3.5 5.4 7 8.9l3.5-3.5" />
                      </svg>
                    </span>
                    <span className="ui-tdp__name">{phase.name}</span>
                    <span className="ui-tdp__count" aria-hidden="true">
                      {phaseDone} / {count}
                    </span>
                    <span className="ui-tdp__sr">
                      {phaseDone} of {count} done
                    </span>
                  </button>

                  <span className="ui-tdp__phase-bar" aria-hidden="true">
                    <span
                      className="ui-tdp__phase-fill"
                      style={{ transform: `scaleX(${count === 0 ? 0 : phaseDone / count})` }}
                    />
                  </span>

                  <div className="ui-tdp__panel" id={panelId}>
                    <ul className="ui-tdp__items">
                      {phase.items.map((item, row) => {
                        const body = (
                          <>
                            <span className="ui-tdp__glyph">{STATUS_GLYPH[item.status]}</span>
                            <span className="ui-tdp__body">
                              <span className="ui-tdp__text">{item.text}</span>
                              {item.status === "active" && item.detail ? (
                                <span className="ui-tdp__detail">{item.detail}</span>
                              ) : null}
                            </span>
                            <span className="ui-tdp__word">{STATUS_WORD[item.status]}</span>
                          </>
                        );

                        return (
                          <li
                            className="ui-tdp__item"
                            data-status={item.status}
                            key={`${item.text}-${row}`}
                            style={{ animationDelay: `calc(var(--ui-tdp-stagger) * ${row})` }}
                          >
                            {onToggle === undefined ? (
                              <div className="ui-tdp__row">{body}</div>
                            ) : (
                              <button
                                type="button"
                                className="ui-tdp__row"
                                aria-pressed={item.status === "done"}
                                onClick={() => onToggle(phase.name, item)}
                              >
                                {body}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <p className="ui-tdp__sr" role="status" aria-live="polite">
        {note}
      </p>
    </div>
  );
}

const css = /* css */ `
.ui-tdp {
  /* Knobs. Override any of these on .ui-tdp to retheme the panel in a host. */
  --ui-tdp-ink: var(--text, #1a1410);
  --ui-tdp-muted: var(--text-muted, #6f625a);
  --ui-tdp-panel: var(--panel, #fffdfb);
  --ui-tdp-line: var(--border, #e8e0d7);
  --ui-tdp-edge: var(--border-soft, #1a14101a);
  --ui-tdp-track: #7a4a1c0f;
  --ui-tdp-wash: #7a4a1c0a;
  --ui-tdp-hover: #7a4a1c12;
  --ui-tdp-accent: var(--accent, #c2410c);
  --ui-tdp-ok: var(--success, #1a7a4a);
  --ui-tdp-warn: var(--warning, #9a6410);
  --ui-tdp-focus: var(--accent, #c2410c);
  --ui-tdp-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-tdp-ease-both: var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1));
  --ui-tdp-ease-soft: var(--nm-ease-soft, cubic-bezier(0.4, 0, 0.2, 1));
  --ui-tdp-dur-2: var(--nm-dur-2, 160ms);
  --ui-tdp-dur-3: var(--nm-dur-3, 240ms);
  --ui-tdp-dur-4: var(--nm-dur-4, 380ms);
  --ui-tdp-dur-6: var(--nm-dur-6, 1100ms);
  --ui-tdp-stagger: var(--nm-stagger, 45ms);

  position: relative;
  box-sizing: border-box;
  display: grid;
  gap: 12px;
  width: 100%;
  padding: 16px 18px 18px;
  background: var(--ui-tdp-panel);
  border-radius: var(--radius-card, 16px);
  box-shadow: inset 0 0 0 1px var(--ui-tdp-line);
  color: var(--ui-tdp-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 18px;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-tdp *,
.ui-tdp *::before,
.ui-tdp *::after {
  box-sizing: border-box;
}
.ui-tdp p {
  margin: 0;
}
:where(.ui-tdp) button {
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
:where(.ui-tdp) svg {
  display: block;
}
.ui-tdp__num {
  color: var(--ui-tdp-ink);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

/* Reminder ---------------------------------------------------------------- */
.ui-tdp__reminder {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 10px;
  border-radius: var(--radius-preview, 12px);
  background: var(--ui-tdp-wash);
  color: var(--ui-tdp-muted);
  font-size: 11.5px;
  line-height: 16px;
}
.ui-tdp__reminder-glyph {
  display: grid;
  flex: none;
  place-items: center;
  width: 12px;
  height: 12px;
}

/* Overall ----------------------------------------------------------------- */
.ui-tdp__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  min-height: 18px;
}
.ui-tdp__label {
  font-size: 12px;
  font-weight: 500;
  color: var(--ui-tdp-ink);
}
.ui-tdp__overall {
  color: var(--ui-tdp-muted);
  font-size: 11.5px;
  line-height: 16px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.ui-tdp__meter {
  position: relative;
  height: 4px;
  overflow: hidden;
  background: var(--ui-tdp-track);
  border-radius: var(--radius-pill, 999px);
  box-shadow: inset 0 0 0 1px var(--ui-tdp-edge);
}
/* The fill is a full-width bar scaled from the left, so a count change never animates width. */
.ui-tdp__meter-fill {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--ui-tdp-ok);
  transform-origin: 0 50%;
  transform: scaleX(0);
  transition: transform var(--ui-tdp-dur-4) var(--ui-tdp-ease-both);
}

/* Phases ------------------------------------------------------------------ */
.ui-tdp__phases {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}
.ui-tdp__phase {
  display: grid;
  gap: 5px;
  padding: 6px 0 8px;
}
.ui-tdp__phase + .ui-tdp__phase {
  padding-top: 10px;
  box-shadow: inset 0 1px 0 var(--ui-tdp-edge);
}
.ui-tdp__toggle {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  min-height: 28px;
  padding: 0 8px 0 2px;
  border-radius: 8px;
  color: var(--ui-tdp-ink);
  transition: background-color var(--ui-tdp-dur-2) var(--ui-tdp-ease-out);
}
.ui-tdp__toggle:hover {
  background: var(--ui-tdp-hover);
}
.ui-tdp__toggle:focus-visible {
  outline: 2px solid var(--ui-tdp-focus);
  outline-offset: 1px;
}
.ui-tdp__caret {
  display: grid;
  flex: none;
  place-items: center;
  width: 14px;
  height: 14px;
  color: var(--ui-tdp-muted);
  transform: rotate(0deg);
  transition: transform var(--ui-tdp-dur-2) var(--ui-tdp-ease-both);
}
.ui-tdp__phase[data-open="false"] .ui-tdp__caret {
  transform: rotate(-90deg);
}
/* A phase holding the live step does not fold; the caret takes one short refusal instead. */
.ui-tdp__caret[data-nudge="true"] {
  animation: ui-tdp-nudge var(--ui-tdp-dur-3) var(--ui-tdp-ease-both);
}
@keyframes ui-tdp-nudge {
  0% {
    transform: rotate(0deg);
  }
  35% {
    transform: rotate(-14deg);
  }
  70% {
    transform: rotate(5deg);
  }
  100% {
    transform: rotate(0deg);
  }
}
.ui-tdp__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 12.5px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-tdp__count {
  flex: none;
  color: var(--ui-tdp-muted);
  font-size: 11.5px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
}
.ui-tdp__phase-bar {
  position: relative;
  display: block;
  height: 3px;
  margin: 0 8px 0 23px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-tdp-track);
}
.ui-tdp__phase-fill {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--ui-tdp-ok);
  transform-origin: 0 50%;
  transform: scaleX(0);
  transition: transform var(--ui-tdp-dur-4) var(--ui-tdp-ease-both);
}

/* Rows -------------------------------------------------------------------- */
.ui-tdp__panel {
  display: grid;
}
.ui-tdp__phase[data-open="false"] .ui-tdp__panel {
  display: none;
}
.ui-tdp__items {
  display: grid;
  gap: 1px;
  margin: 0;
  padding: 3px 0 0 23px;
  list-style: none;
}
/* The rows fade in whenever the panel is open, which is also what a fold looks like on the way
 * back: no height is animated, only opacity and a three-pixel lift. */
.ui-tdp__phase[data-open="true"] .ui-tdp__item {
  animation: ui-tdp-in var(--ui-tdp-dur-3) var(--ui-tdp-ease-out) both;
}
@keyframes ui-tdp-in {
  from {
    opacity: 0;
    transform: translateY(-3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.ui-tdp__row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 5px 8px 5px 6px;
  border-radius: 8px;
  transition: background-color var(--ui-tdp-dur-2) var(--ui-tdp-ease-out);
}
.ui-tdp button.ui-tdp__row:hover {
  background: var(--ui-tdp-hover);
}
.ui-tdp button.ui-tdp__row:focus-visible {
  outline: 2px solid var(--ui-tdp-focus);
  outline-offset: 1px;
}
.ui-tdp__glyph {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  width: 14px;
  height: 14px;
  margin-top: 2px;
  color: var(--ui-tdp-muted);
}
.ui-tdp__item[data-status="active"] .ui-tdp__glyph {
  color: var(--ui-tdp-accent);
}
.ui-tdp__item[data-status="done"] .ui-tdp__glyph {
  color: var(--ui-tdp-ok);
}
.ui-tdp__item[data-status="blocked"] .ui-tdp__glyph {
  color: var(--ui-tdp-warn);
}
/* The one ember mark on the panel: a halo around the step that is live right now. */
.ui-tdp__item[data-status="active"] .ui-tdp__glyph::after {
  content: "";
  position: absolute;
  inset: -3px;
  border-radius: 999px;
  box-shadow: inset 0 0 0 1px var(--ui-tdp-accent);
  opacity: 0.35;
  pointer-events: none;
  animation: ui-tdp-live var(--ui-tdp-dur-6) var(--ui-tdp-ease-soft) infinite alternate;
}
@keyframes ui-tdp-live {
  from {
    opacity: 0.18;
  }
  to {
    opacity: 0.5;
  }
}
.ui-tdp__body {
  display: grid;
  flex: 1;
  gap: 1px;
  min-width: 0;
}
.ui-tdp__text {
  font-size: 12.5px;
  line-height: 18px;
  color: var(--ui-tdp-ink);
  overflow-wrap: anywhere;
}
.ui-tdp__item[data-status="pending"] .ui-tdp__text,
.ui-tdp__item[data-status="done"] .ui-tdp__text {
  color: var(--ui-tdp-muted);
}
.ui-tdp__detail {
  font-size: 11.5px;
  line-height: 17px;
  color: var(--ui-tdp-muted);
  overflow-wrap: anywhere;
}
.ui-tdp__word {
  flex: none;
  padding-top: 2px;
  color: var(--ui-tdp-muted);
  font-size: 10.5px;
  font-weight: 500;
  line-height: 16px;
  letter-spacing: 0.01em;
}
.ui-tdp__item[data-status="active"] .ui-tdp__word {
  color: var(--ui-tdp-accent);
}
.ui-tdp__item[data-status="done"] .ui-tdp__word {
  color: var(--ui-tdp-ok);
}
.ui-tdp__item[data-status="blocked"] .ui-tdp__word {
  color: var(--ui-tdp-warn);
}

/* Edges ------------------------------------------------------------------- */
.ui-tdp__empty {
  color: var(--ui-tdp-muted);
  font-size: 12px;
  line-height: 18px;
}
.ui-tdp__sr {
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

:where(.dark, [data-theme="dark"]) .ui-tdp {
  --ui-tdp-ink: var(--text, #f4ece4);
  --ui-tdp-muted: var(--text-muted, #a2958a);
  --ui-tdp-panel: var(--panel, #1a1512);
  --ui-tdp-line: var(--border, #33291f);
  --ui-tdp-edge: var(--border-soft, #ffffff12);
  --ui-tdp-track: #ffffff12;
  --ui-tdp-wash: #ffffff0d;
  --ui-tdp-hover: #ffffff0a;
  --ui-tdp-accent: var(--accent, #ff6b35);
  --ui-tdp-ok: var(--success, #4f9d6e);
  --ui-tdp-warn: var(--warning, #d99530);
  --ui-tdp-focus: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  .ui-tdp__toggle,
  .ui-tdp__caret,
  .ui-tdp__row,
  .ui-tdp__meter-fill,
  .ui-tdp__phase-fill {
    transition-duration: 1ms;
  }
  .ui-tdp__phase[data-open="true"] .ui-tdp__item {
    animation: none;
    opacity: 1;
    transform: none;
  }
  .ui-tdp__caret[data-nudge="true"] {
    animation: none;
  }
  .ui-tdp__item[data-status="active"] .ui-tdp__glyph::after {
    animation: none;
    opacity: 0.35;
  }
}
`;
