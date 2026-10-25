"use client";

import { useEffect, useState } from "react";

/*
 * Setup Guide – an onboarding checklist that walks you through the steps in order.
 * Groups of tasks stack inside a 320px card. Each group opens on its own: the chevron turns over,
 * the panel grows from 0fr to 1fr and the tasks fade down into place one beat later. Inside a group
 * only the first unfinished task is live; everything behind it waits as a dashed, disabled circle.
 * Ticking a task turns its ring into a filled check that pops in, and the label is struck through.
 * When the last task of a group is ticked the title is struck through and the group folds away,
 * handing the open slot to the next group that still has work. The bar above fills from the left
 * on a 700ms ease and the count reads out how far along the guide is.
 * The header can be minimised – the whole body folds to 0fr and the card shrinks to its header –
 * and closed. The styles are injected below, so no extra files are needed.
 */

/** How one task reads: finished, the next thing to do, or waiting its turn */
export type SetupTaskState = "done" | "current" | "locked";

export type SetupTask = {
  /** Stable id; also what `onToggle` reports */
  id: string;
  /** The step, written as an instruction ("Choose a workspace name") */
  label: string;
  /** Finished already – the guide opens with it ticked and struck through */
  done?: boolean;
};

export type SetupGroup = {
  /** Stable id; the panel id is derived from it */
  id: string;
  /** Group heading ("Set up billing") */
  title: string;
  /** Steps in the order they unlock */
  tasks: SetupTask[];
};

export type SetupGuideProps = {
  /** Groups in running order; the first unfinished group opens on mount */
  groups: SetupGroup[];
  /** Heading on the card */
  title?: string;
  /** A task was ticked or unticked, with every finished id after the change */
  onToggle?: (taskId: string, done: boolean, doneIds: string[]) => void;
  /** Shows an Edit action in the header */
  onEdit?: () => void;
  /** Shows a close button in the header */
  onClose?: () => void;
  /** Extra class on the card */
  className?: string;
};

export function SetupGuide({ groups, title = "Setup guide", onToggle, onEdit, onClose, className }: SetupGuideProps) {
  const [done, setDone] = useState<ReadonlySet<string>>(() => doneSet(groups));
  const [openId, setOpenId] = useState<string | null>(() => firstUnfinished(groups, doneSet(groups), 0));
  const [collapsed, setCollapsed] = useState(false);

  // Pick up flags that arrive already done, and forget ids that left the groups
  const signature = groups
    .map((group) => `${group.id}:${group.tasks.map((task) => `${task.id}${task.done ? "1" : "0"}`).join(",")}`)
    .join("|");
  useEffect(() => {
    setDone((previous) => {
      const next = new Set<string>();
      for (const group of groups) {
        for (const task of group.tasks) {
          if (task.done || previous.has(task.id)) next.add(task.id);
        }
      }
      return setsEqual(previous, next) ? previous : next;
    });
  }, [signature]);

  const tasks = groups.flatMap((group) => group.tasks);
  const total = tasks.length;
  const finished = tasks.filter((task) => done.has(task.id)).length;
  const ratio = total === 0 ? 1 : finished / total;
  const percent = Math.round(ratio * 100);
  const fill = Number(ratio.toFixed(6));
  const open = openId !== null && groups.some((group) => group.id === openId) ? openId : null;

  const toggleTask = (group: SetupGroup, task: SetupTask, index: number) => {
    const next = new Set(done);
    const nowDone = !next.has(task.id);
    if (nowDone) next.add(task.id);
    else next.delete(task.id);
    setDone(next);

    // A finished group strikes through, lets its check pop, then folds away and hands the open
    // slot to the next group with work left. 420ms matches the strike and the check in the sheet.
    if (group.tasks.every((entry) => next.has(entry.id))) {
      const nextOpen = firstUnfinished(groups, next, index + 1);
      window.setTimeout(() => {
        setOpenId((current) => (current === group.id ? nextOpen : current));
      }, 420);
    } else {
      setOpenId((current) => (current === null ? group.id : current));
    }

    onToggle?.(
      task.id,
      nowDone,
      groups.flatMap((entry) => entry.tasks.filter((item) => next.has(item.id)).map((item) => item.id)),
    );
  };

  return (
    <section className={["ui-sgc", className].filter(Boolean).join(" ")} aria-label={title}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-setup-guide" precedence="default">
        {css}
      </style>

      <header className="ui-sgc__head">
        <h3 className="ui-sgc__title">{title}</h3>
        <div className="ui-sgc__actions">
          <button type="button" className="ui-sgc__edit" onClick={onEdit}>
            Edit
          </button>
          <button
            type="button"
            className="ui-sgc__icon-btn"
            aria-label={collapsed ? "Expand setup guide" : "Minimize setup guide"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((value) => !value)}
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9.5 2.5v4h4M9.5 6.5l4.5-4.5M6.5 13.5v-4h-4M6.5 9.5 2 14" />
            </svg>
          </button>
          <button type="button" className="ui-sgc__icon-btn" aria-label="Close setup guide" onClick={onClose}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" aria-hidden="true">
              <path d="m4 4 8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      </header>

      <div className="ui-sgc__progress">
        <span
          className="ui-sgc__track"
          role="progressbar"
          aria-label="Setup guide progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <span className="ui-sgc__fill" style={{ transform: `scaleX(${fill})` }} />
        </span>
        <span className="ui-sgc__count" aria-hidden="true">
          {finished}/{total}
        </span>
      </div>

      <div className="ui-sgc__body" data-hidden={collapsed ? "" : undefined}>
        <div className="ui-sgc__groups">
          {groups.map((group, index) => {
            const isOpen = open === group.id;
            const allDone = group.tasks.length > 0 && group.tasks.every((task) => done.has(task.id));
            const panelId = `ui-sgc-${group.id}`;

            return (
              <div key={group.id} className="ui-sgc__group" data-open={isOpen ? "true" : undefined}>
                <button
                  type="button"
                  className="ui-sgc__group-head"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenId((current) => (current === group.id ? null : group.id))}
                >
                  <span className="ui-sgc__group-title" data-done={allDone ? "true" : undefined}>
                    {group.title}
                  </span>
                  <svg
                    className="ui-sgc__chevron"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
                  </svg>
                </button>
                <div className="ui-sgc__panel" id={panelId} inert={!isOpen}>
                  <ul className="ui-sgc__tasks">
                    {group.tasks.map((task) => {
                      const state: SetupTaskState = done.has(task.id)
                        ? "done"
                        : group.tasks.find((entry) => !done.has(entry.id))?.id === task.id
                          ? "current"
                          : "locked";

                      return (
                        <li key={task.id}>
                          <button
                            type="button"
                            className="ui-sgc__task"
                            data-state={state}
                            aria-pressed={state === "done"}
                            disabled={state === "locked"}
                            onClick={() => toggleTask(group, task, index)}
                          >
                            <TaskMark state={state} />
                            <span className="ui-sgc__task-label">{task.label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* icons */

function TaskMark({ state }: { state: SetupTaskState }) {
  if (state === "done") {
    return (
      <span className="ui-sgc__mark" aria-hidden="true">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path
            d="m5.2 8.2 1.9 1.9 3.7-3.9"
            fill="none"
            stroke="var(--ui-sgc-on-accent)"
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (state === "locked") {
    return (
      <span className="ui-sgc__mark" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.1} aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" strokeDasharray="2 2" />
        </svg>
      </span>
    );
  }

  return <span className="ui-sgc__mark" aria-hidden="true" />;
}

/* helpers */

function doneSet(groups: SetupGroup[]): Set<string> {
  const ids = new Set<string>();
  for (const group of groups) {
    for (const task of group.tasks) {
      if (task.done) ids.add(task.id);
    }
  }
  return ids;
}

/** First group, walking forward from `from` and wrapping, that still has an unfinished task */
function firstUnfinished(groups: SetupGroup[], done: ReadonlySet<string>, from: number): string | null {
  for (let step = 0; step < groups.length; step += 1) {
    const group = groups[(from + step) % groups.length];
    if (group.tasks.some((task) => !done.has(task.id))) return group.id;
  }
  return null;
}

function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

const css = /* css */ `
.ui-sgc{--ui-sgc-card: #fffdfb;--ui-sgc-strong: #0b0908;--ui-sgc-ink: rgba(11, 9, 8, 0.88);--ui-sgc-text: rgba(11, 9, 8, 0.61);--ui-sgc-muted: rgba(11, 9, 8, 0.45);--ui-sgc-faint: rgba(11, 9, 8, 0.27);--ui-sgc-icon: rgba(11, 9, 8, 0.447);--ui-sgc-line: rgba(11, 9, 8, 0.06);--ui-sgc-fill: rgba(11, 9, 8, 0.06);--ui-sgc-ring: rgba(11, 9, 8, 0.2);--ui-sgc-wash: rgba(11, 9, 8, 0.03);--ui-sgc-open: rgba(11, 9, 8, 0.025);--ui-sgc-accent: rgba(217, 84, 31, 0.765);--ui-sgc-on-accent: #fffdfb;--ui-sgc-focus: rgba(217, 84, 31, 0.35);--ui-sgc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-sgc-ease: cubic-bezier(0.22, 1, 0.36, 1);box-sizing: border-box;container-type: inline-size;width: 100%;max-width: 320px;border-radius: 10px;background: var(--ui-sgc-card);box-shadow: var(--ui-sgc-shadow);font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;font-weight: 400;line-height: 20px;color: var(--ui-sgc-ink);-webkit-font-smoothing: antialiased}
.ui-sgc *, .ui-sgc *::before, .ui-sgc *::after{box-sizing: border-box}
:where(.ui-sgc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;cursor: pointer}
:where(.ui-sgc) svg{display: block;flex: none}
.ui-sgc button:focus-visible{outline: 2px solid var(--ui-sgc-focus);outline-offset: 1px}
.ui-sgc__head{display: flex;align-items: center;justify-content: space-between;gap: 12px;padding: 12px 10px 0 16px}
.ui-sgc__title{overflow: hidden;min-width: 0;margin: 0;font-size: 15px;font-weight: 500;line-height: 24px;color: var(--ui-sgc-strong);white-space: nowrap;text-overflow: ellipsis}
.ui-sgc__actions{display: flex;flex: none;align-items: center;gap: 2px}
.ui-sgc__edit{height: 28px;padding: 0 8px;border-radius: 6px;font-size: 13px;font-weight: 500;line-height: 20px;color: var(--ui-sgc-text);transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-sgc__edit:hover{background: var(--ui-sgc-wash);color: var(--ui-sgc-ink)}
.ui-sgc__icon-btn{display: grid;place-items: center;width: 28px;height: 28px;border-radius: 6px;color: var(--ui-sgc-icon);transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-sgc__icon-btn:hover{background: var(--ui-sgc-wash);color: var(--ui-sgc-ink)}
.ui-sgc__icon-btn svg{width: 16px;height: 16px}
.ui-sgc__progress{display: flex;align-items: center;gap: 10px;padding: 8px 16px 12px}
.ui-sgc__track{display: block;flex: 1;height: 4px;overflow: hidden;border-radius: 2px;background: var(--ui-sgc-fill)}
.ui-sgc__fill{display: block;height: 100%;border-radius: inherit;background: var(--ui-sgc-accent);transform-origin: left center;transition: transform var(--nm-dur-5, 620ms) var(--ui-sgc-ease)}
.ui-sgc__count{flex: none;font-size: 12px;line-height: 16px;font-variant-numeric: tabular-nums;color: var(--ui-sgc-muted)}
.ui-sgc__body{display: grid;grid-template-rows: 1fr;transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-sgc-ease), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-sgc__body[data-hidden]{grid-template-rows: 0fr;opacity: 0}
.ui-sgc__groups{display: grid;gap: 2px;min-height: 0;overflow: hidden;padding: 0 4px;border-top: 0.5px solid var(--ui-sgc-line)}
.ui-sgc__groups::before, .ui-sgc__groups::after{content: "";display: block;height: 2px}
.ui-sgc__group{border-radius: 8px;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-sgc__group[data-open]{background: var(--ui-sgc-open)}
.ui-sgc__group-head{display: flex;align-items: center;justify-content: space-between;gap: 12px;width: 100%;padding: 8px 8px 8px 12px;border-radius: 8px;text-align: left;transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-sgc__group-head:hover{background: var(--ui-sgc-wash)}
.ui-sgc__group[data-open] .ui-sgc__group-head:hover{background: none}
.ui-sgc__group-title{position: relative;min-width: 0;font-size: 13px;font-weight: 500;line-height: 20px;color: var(--ui-sgc-strong);transition: color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-sgc__group-title[data-done]{color: var(--ui-sgc-muted)}
.ui-sgc__group-title::after{content: "";position: absolute;left: 0;right: 0;top: 52%;height: 1px;background: currentColor;transform: scaleX(0);transform-origin: left center;transition: transform var(--nm-dur-4, 380ms) var(--ui-sgc-ease)}
.ui-sgc__group-title[data-done]::after{transform: scaleX(1)}
.ui-sgc__chevron{width: 16px;height: 16px;color: var(--ui-sgc-icon);transition: transform var(--nm-dur-4, 380ms) var(--ui-sgc-ease)}
.ui-sgc__group[data-open] .ui-sgc__chevron{transform: rotate(180deg)}
.ui-sgc__panel{display: grid;grid-template-rows: 0fr;transition: grid-template-rows 380ms var(--ui-sgc-ease)}
.ui-sgc__group[data-open] .ui-sgc__panel{grid-template-rows: 1fr}
.ui-sgc__tasks{min-height: 0;overflow: hidden;margin: 0;padding: 0 4px;list-style: none}
.ui-sgc__tasks li:last-child{padding-bottom: 6px}
.ui-sgc__task{display: flex;align-items: flex-start;gap: 10px;width: 100%;padding: 6px 8px;border-radius: 6px;text-align: left;opacity: 0;transform: translateY(-4px);transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-4, 380ms) var(--ui-sgc-ease), color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-sgc__group[data-open] .ui-sgc__task{opacity: 1;transform: none;transition-delay: 80ms, 80ms, 0ms, 0ms}
.ui-sgc__task:not(:disabled):hover{background: var(--ui-sgc-wash)}
.ui-sgc__task[data-state="current"]{color: var(--ui-sgc-ink)}
.ui-sgc__task[data-state="locked"]{color: var(--ui-sgc-muted);cursor: default}
.ui-sgc__task[data-state="done"]{color: var(--ui-sgc-muted)}
.ui-sgc__mark{display: grid;place-items: center;flex: none;width: 16px;height: 16px;margin-top: 2px;border-radius: 50%;transition: box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-sgc__task[data-state="current"] .ui-sgc__mark{box-shadow: inset 0 0 0 1px var(--ui-sgc-ring)}
.ui-sgc__task[data-state="current"]:hover .ui-sgc__mark{box-shadow: inset 0 0 0 1px var(--ui-sgc-accent)}
.ui-sgc__task[data-state="locked"] .ui-sgc__mark{color: var(--ui-sgc-faint)}
.ui-sgc__task[data-state="done"] .ui-sgc__mark{color: var(--ui-sgc-accent)}
.ui-sgc__mark svg{width: 16px;height: 16px}
.ui-sgc__task[data-state="done"] .ui-sgc__mark svg{animation: ui-sgc-pop var(--nm-dur-4, 380ms) var(--ui-sgc-ease)}
.ui-sgc__task-label{min-width: 0;font-size: 13px;line-height: 20px;text-decoration-line: line-through;text-decoration-color: transparent;text-decoration-thickness: 1px;transition: text-decoration-color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-sgc__task[data-state="done"] .ui-sgc__task-label{text-decoration-color: currentColor}
@keyframes ui-sgc-pop{from{transform: scale(0.5);opacity: 0}
}
@container (max-width: 300px){.ui-sgc__head{padding-left: 12px}
.ui-sgc__progress{padding-inline: 12px}
.ui-sgc__group-head{padding-left: 10px}
}
@media (pointer: coarse){.ui-sgc__icon-btn{width: 36px;height: 36px}
.ui-sgc__edit{height: 36px}
.ui-sgc__group-head{padding-block: 12px}
.ui-sgc__task{padding-block: 9px}
}
@media (prefers-reduced-motion: reduce){.ui-sgc__fill, .ui-sgc__body, .ui-sgc__panel, .ui-sgc__task, .ui-sgc__chevron, .ui-sgc__group, .ui-sgc__group-title::after{transition: none}
.ui-sgc__mark svg{animation: none}
}
:where(.dark, [data-theme="dark"]) .ui-sgc{--ui-sgc-card: #211b16;--ui-sgc-strong: #fffdfb;--ui-sgc-ink: rgba(255, 253, 251, 0.9);--ui-sgc-text: rgba(255, 253, 251, 0.62);--ui-sgc-muted: rgba(255, 253, 251, 0.46);--ui-sgc-faint: rgba(255, 253, 251, 0.3);--ui-sgc-icon: rgba(255, 253, 251, 0.5);--ui-sgc-line: rgba(255, 253, 251, 0.08);--ui-sgc-fill: rgba(255, 253, 251, 0.08);--ui-sgc-ring: rgba(255, 253, 251, 0.26);--ui-sgc-wash: rgba(255, 253, 251, 0.04);--ui-sgc-open: rgba(255, 253, 251, 0.03);--ui-sgc-accent: #ff8a5c;--ui-sgc-on-accent: #fffdfb;--ui-sgc-focus: rgba(255, 138, 92, 0.5);--ui-sgc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4)}

`;
