"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
} from "react";

/*
 * Project Card – a two-line project summary that unfolds on hover.
 *
 * The head keeps the ring, the name and the status, so the card is useful while shut. The ring is
 * segmented, one arc per subtask, the first arcs filled as work lands; hovering a row thickens its
 * arc. Under the fold sit the status picker, the subtask rows and a foot line with what is left.
 * Hovering a person previews their slice – everyone else dims – and clicking pins that filter.
 * The head button locks the card open, and Escape backs out one layer at a time.
 * The styles are injected below, so no extra files are needed.
 */

export type ProjectTone = "red" | "amber" | "green" | "blue" | "violet" | "gray";

export type ProjectStatus = {
  id: string;
  label: string;
  /** Picks the tag colours the CSS declares for each tone */
  tone: ProjectTone;
};

export type ProjectPerson = {
  id: string;
  name: string;
  /** Hue 0–360 for the avatar tint */
  hue: number;
  /** One or two characters instead of the first letter of the name */
  initial?: string;
};

export type ProjectSubtask = {
  id: string;
  label: string;
  done?: boolean;
  /** Must match a person's id – that links the row, its arc and the filter */
  assignee?: string;
};

export type Project = {
  name: string;
  /** A project status id, e.g. one of `statuses` */
  status?: string;
  /** Already-formatted due date, e.g. "Oct 24" */
  due?: string;
};

export type ProjectCardProps = {
  project: Project;
  /** One row and one ring arc each */
  subtasks?: readonly ProjectSubtask[];
  /** The people the filter and the row avatars draw from */
  people?: readonly ProjectPerson[];
  /** The picker's options; defaults to To do / In progress / In review / Done */
  statuses?: readonly ProjectStatus[];
  /** Called when a status is picked; the card is controlled when this is passed */
  onStatusChange?: (status: string) => void;
  /** Called when a row or its arc is toggled; controlled when this is passed */
  onSubtaskToggle?: (id: string, done: boolean) => void;
  /** The foot action, "Open" unless renamed */
  onOpen?: () => void;
  actionLabel?: string;
  /** Pin the card open on mount; it still unfolds on hover when false */
  defaultOpen?: boolean;
  /** Controlled open state – wins over hover and the head button */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

const DEFAULT_STATUSES: readonly ProjectStatus[] = [
  { id: "todo", label: "To do", tone: "violet" },
  { id: "progress", label: "In progress", tone: "amber" },
  { id: "review", label: "In review", tone: "blue" },
  { id: "done", label: "Done", tone: "green" },
];

const FALLBACK_STATUS: ProjectStatus = { id: "progress", label: "In progress", tone: "amber" };

/** Ring geometry, as the original drew it in a 32 × 32 box. */
const RING_RADIUS = 12.5;
const RING_CENTER = 16;
/** Degrees of empty space left between neighbouring arcs. */
const RING_GAP = 19.8;

const pointOnRing = (deg: number): [number, number] => {
  const rad = (deg * Math.PI) / 180;
  return [RING_CENTER + RING_RADIUS * Math.cos(rad), RING_CENTER + RING_RADIUS * Math.sin(rad)];
};

/** One arc per subtask, starting at the top and running clockwise with a gap between each. */
const segmentPath = (index: number, count: number): string => {
  const slot = 360 / count;
  const sweep = slot - RING_GAP;
  const from = -90 + index * slot + RING_GAP / 2;
  const [x1, y1] = pointOnRing(from);
  const [x2, y2] = pointOnRing(from + sweep);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${RING_RADIUS} ${RING_RADIUS} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

const hueStyle = (hue: number): CSSProperties => ({ "--ui-pcc-hue": hue }) as CSSProperties;

const initialOf = (person: ProjectPerson): string =>
  person.initial ?? (person.name.trim().slice(0, 1) || "?");

export function ProjectCard({
  project,
  subtasks = [],
  people = [],
  statuses = DEFAULT_STATUSES,
  onStatusChange,
  onSubtaskToggle,
  onOpen,
  actionLabel = "Open",
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  className,
}: ProjectCardProps) {
  const uid = useId();
  const root = useRef<HTMLDivElement>(null);
  const statusButton = useRef<HTMLButtonElement>(null);
  const bodyId = `${uid}-body`;
  const statusId = `${uid}-status`;

  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(defaultOpen);
  /** A deliberate close wins over the hover that is still in progress. */
  const [closedHere, setClosedHere] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [hoverPerson, setHoverPerson] = useState<string | null>(null);
  const [pressedPerson, setPressedPerson] = useState<string | null>(null);
  const [hoverTask, setHoverTask] = useState<string | null>(null);

  const [ownStatus, setOwnStatus] = useState<string | undefined>(project.status);
  const [ownDone, setOwnDone] = useState<Record<string, boolean>>({});

  const statusValue = onStatusChange ? project.status : ownStatus;
  const activeStatus =
    statuses.find((entry) => entry.id === statusValue) ?? statuses[0] ?? FALLBACK_STATUS;

  const isDone = (task: ProjectSubtask): boolean =>
    (onSubtaskToggle ? task.done : ownDone[task.id] ?? task.done) ?? false;

  const doneCount = subtasks.filter(isDone).length;
  const left = subtasks.length - doneCount;
  const filterId = hoverPerson ?? pressedPerson;

  const open = openProp ?? (pinned || ((hovering || focused) && !closedHere));

  const toggleOpen = (): void => {
    if (openProp !== undefined) {
      onOpenChange?.(!openProp);
      return;
    }
    if (open) {
      setPinned(false);
      setClosedHere(true);
    } else {
      setPinned(true);
      setClosedHere(false);
    }
  };

  const changeStatus = (id: string): void => {
    if (onStatusChange) onStatusChange(id);
    else setOwnStatus(id);
  };

  const pickStatus = (id: string): void => {
    changeStatus(id);
    setStatusOpen(false);
    statusButton.current?.focus();
  };

  const toggleTask = (task: ProjectSubtask): void => {
    const next = !isDone(task);
    if (onSubtaskToggle) onSubtaskToggle(task.id, next);
    else setOwnDone((previous) => ({ ...previous, [task.id]: next }));
  };

  const togglePerson = (id: string): void => {
    setPressedPerson((previous) => (previous === id ? null : id));
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setFocused(false);
    setClosedHere(false);
    setStatusOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== "Escape") return;
    if (statusOpen) {
      setStatusOpen(false);
      statusButton.current?.focus();
    } else if (pinned) {
      setPinned(false);
    }
  };

  /** Arrow keys walk the radios without closing the tray, the way a radiogroup should. */
  const onStatusKeys = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0 || statuses.length === 0) return;
    event.preventDefault();
    const current = statuses.findIndex((entry) => entry.id === activeStatus.id);
    const next = statuses[(current + step + statuses.length) % statuses.length];
    if (next) changeStatus(next.id);
  };

  useEffect(() => {
    if (!statusOpen) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (!root.current?.contains(event.target as Node)) setStatusOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [statusOpen]);

  const summary = `${project.name}: ${doneCount} of ${subtasks.length} done, ${activeStatus.label}${
    project.due ? `, due ${project.due}` : ""
  }`;

  return (
    <div
      ref={root}
      className={["ui-pcc", className].filter(Boolean).join(" ")}
      data-open={open ? "" : undefined}
      onPointerEnter={() => {
        setHovering(true);
        setClosedHere(false);
      }}
      onPointerLeave={() => {
        setHovering(false);
        setClosedHere(false);
        setHoverPerson(null);
        setHoverTask(null);
      }}
      onFocus={() => setFocused(true)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-project-card" precedence="default">
        {css}
      </style>

      <div className="ui-pcc__card">
        <div className="ui-pcc__head">
          <button
            type="button"
            className="ui-pcc__toggle"
            aria-expanded={open}
            aria-controls={bodyId}
            aria-label={summary}
            onClick={toggleOpen}
          />

          <span className="ui-pcc__progress" data-live={open ? "" : undefined}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              {subtasks.map((task, index) => (
                <path
                  key={task.id}
                  className="ui-pcc__seg"
                  d={segmentPath(index, subtasks.length)}
                  data-done={isDone(task) ? "" : undefined}
                  data-hot={hoverTask === task.id ? "" : undefined}
                  data-dim={filterId !== null && task.assignee !== filterId ? "" : undefined}
                  onPointerEnter={() => setHoverTask(task.id)}
                  onPointerLeave={() => setHoverTask(null)}
                  onClick={() => toggleTask(task)}
                />
              ))}
            </svg>
            <span key={doneCount} className="ui-pcc__num">
              {doneCount}
            </span>
          </span>

          <span className="ui-pcc__titles">
            <span className="ui-pcc__name">{project.name}</span>
            <span className="ui-pcc__sub">
              <button
                ref={statusButton}
                type="button"
                className="ui-pcc__status"
                data-tone={activeStatus.tone}
                aria-expanded={statusOpen}
                aria-controls={statusId}
                tabIndex={0}
                onClick={() => setStatusOpen((previous) => !previous)}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <circle
                    cx="6"
                    cy="6"
                    r="4.25"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path d="M6 3.4a2.6 2.6 0 0 1 0 5.2V3.4Z" fill="currentColor" />
                </svg>
                {activeStatus.label}
              </button>

              {project.due ? (
                <span className="ui-pcc__due">
                  <span className="ui-pcc__due-word">Due </span>
                  {project.due}
                </span>
              ) : null}
            </span>
          </span>

          <span className="ui-pcc__people">
            {people.map((person) => (
              <button
                key={person.id}
                type="button"
                className="ui-pcc__member"
                aria-label={`Only ${person.name}'s subtasks`}
                aria-pressed={pressedPerson === person.id}
                tabIndex={0}
                data-on={filterId === person.id ? "" : undefined}
                data-off={filterId !== null && filterId !== person.id ? "" : undefined}
                onClick={() => togglePerson(person.id)}
                onPointerEnter={() => setHoverPerson(person.id)}
                onPointerLeave={() => setHoverPerson(null)}
              >
                <span className="ui-pcc__avatar" style={hueStyle(person.hue)}>
                  {initialOf(person)}
                </span>
              </button>
            ))}
          </span>
        </div>

        <div id={bodyId} className="ui-pcc__fold" inert={open ? undefined : true}>
          <div className="ui-pcc__body">
            <div
              id={statusId}
              className="ui-pcc__fold ui-pcc__fold--status"
              data-open={statusOpen ? "" : undefined}
              inert={statusOpen ? undefined : true}
            >
              <div className="ui-pcc__clip">
                <div
                  className="ui-pcc__options"
                  role="radiogroup"
                  aria-label="Status"
                  onKeyDown={onStatusKeys}
                >
                  {statuses.map((status) => (
                    <button
                      key={status.id}
                      type="button"
                      role="radio"
                      aria-checked={status.id === activeStatus.id}
                      className="ui-pcc__option"
                      data-tone={status.tone}
                      onClick={() => pickStatus(status.id)}
                    >
                      <span className="ui-pcc__dot" aria-hidden="true" />
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <ul className="ui-pcc__tasks">
              {subtasks.map((task) => {
                const person = task.assignee
                  ? people.find((entry) => entry.id === task.assignee)
                  : undefined;
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      className="ui-pcc__task"
                      role="checkbox"
                      aria-checked={isDone(task)}
                      data-hot={hoverTask === task.id ? "" : undefined}
                      data-dim={filterId !== null && task.assignee !== filterId ? "" : undefined}
                      onClick={() => toggleTask(task)}
                      onPointerEnter={() => setHoverTask(task.id)}
                      onPointerLeave={() => setHoverTask(null)}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <circle className="ui-pcc__ring" cx="8" cy="8" r="6.3" />
                        <circle className="ui-pcc__disc" cx="8" cy="8" r="7" />
                        <path className="ui-pcc__tick" d="m5.2 8.2 1.9 1.9 3.7-4" />
                      </svg>
                      <span className="ui-pcc__label">{task.label}</span>
                      {person ? (
                        <span className="ui-pcc__avatar" style={hueStyle(person.hue)}>
                          {initialOf(person)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="ui-pcc__fold" inert={open ? undefined : true}>
          <div className="ui-pcc__clip">
            <div className="ui-pcc__foot">
              <span className="ui-pcc__caption" aria-live="polite">
                <span key={left}>{left === 0 ? "All done" : `${left} left`}</span>
              </span>
              <button type="button" className="ui-pcc__action" onClick={onOpen}>
                {actionLabel}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path
                    d="M2.5 6h7M6.5 3l3 3-3 3"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const css = /* css */ `
.ui-pcc{--ui-pcc-card: #fffdfb;--ui-pcc-ink: rgba(11, 9, 8, 0.88);--ui-pcc-strong: #0b0908;--ui-pcc-text: rgba(11, 9, 8, 0.61);--ui-pcc-muted: rgba(11, 9, 8, 0.45);--ui-pcc-faint: rgba(11, 9, 8, 0.27);--ui-pcc-icon: rgba(11, 9, 8, 0.447);--ui-pcc-line: rgba(11, 9, 8, 0.06);--ui-pcc-fill: rgba(11, 9, 8, 0.06);--ui-pcc-wash: rgba(11, 9, 8, 0.03);--ui-pcc-ring: rgba(11, 9, 8, 0.08);--ui-pcc-ring-hot: rgba(11, 9, 8, 0.2);--ui-pcc-accent: rgba(217, 84, 31, 0.765);--ui-pcc-primary: rgba(11, 9, 8, 0.88);--ui-pcc-on-primary: #fcf9f7;--ui-pcc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-pcc-focus: rgba(217, 84, 31, 0.35);--ui-pcc-ease: cubic-bezier(0.22, 1, 0.36, 1);--ui-pcc-time: 520ms;box-sizing: border-box;width: 100%;max-width: 320px;container-type: inline-size;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;font-weight: 400;color: var(--ui-pcc-ink);text-align: left;-webkit-font-smoothing: antialiased}
.ui-pcc *, .ui-pcc *::before, .ui-pcc *::after{box-sizing: border-box}
:where(.ui-pcc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;text-align: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-pcc button:focus-visible{outline: 2px solid var(--ui-pcc-focus);outline-offset: 1px}
:where(.ui-pcc) svg{display: block;flex: none}
.ui-pcc b{font-weight: 500;color: var(--ui-pcc-ink)}
.ui-pcc [data-tone="red"]{--ui-pcc-tag: #b3261e;--ui-pcc-tag-bg: rgba(226, 84, 74, 0.08)}
.ui-pcc [data-tone="amber"]{--ui-pcc-tag: #9a6410;--ui-pcc-tag-bg: rgba(217, 149, 48, 0.1)}
.ui-pcc [data-tone="green"]{--ui-pcc-tag: #2f8d5c;--ui-pcc-tag-bg: rgba(47, 141, 92, 0.08)}
.ui-pcc [data-tone="blue"]{--ui-pcc-tag: rgba(217, 84, 31, 0.9);--ui-pcc-tag-bg: rgba(217, 84, 31, 0.06)}
.ui-pcc [data-tone="violet"]{--ui-pcc-tag: #ff6b35;--ui-pcc-tag-bg: rgba(255, 107, 53, 0.08)}
.ui-pcc [data-tone="gray"]{--ui-pcc-tag: rgba(11, 9, 8, 0.61);--ui-pcc-tag-bg: rgba(11, 9, 8, 0.05)}
.ui-pcc__card{border-radius: 10px;background: var(--ui-pcc-card);box-shadow: var(--ui-pcc-shadow)}
.ui-pcc__fold{display: grid;grid-template-rows: 0fr;opacity: 0;transition: grid-template-rows var(--ui-pcc-time) var(--ui-pcc-ease), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-pcc__fold > *{min-height: 0;overflow: hidden}
.ui-pcc[data-open] > .ui-pcc__card > .ui-pcc__fold, .ui-pcc__fold--status[data-open]{grid-template-rows: 1fr;opacity: 1;transition: grid-template-rows var(--ui-pcc-time) var(--ui-pcc-ease), opacity 380ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 120ms}
.ui-pcc__head{position: relative;display: flex;align-items: center;gap: 10px;padding: 12px}
.ui-pcc__toggle{position: absolute;inset: 0;border-radius: 10px}
.ui-pcc__head > :not(.ui-pcc__toggle){position: relative;pointer-events: none}
.ui-pcc[data-open] :is(.ui-pcc__status, .ui-pcc__member), .ui-pcc__progress[data-live] .ui-pcc__seg{pointer-events: auto}
.ui-pcc__progress{display: grid;flex: none;place-items: center;width: 32px;height: 32px}
.ui-pcc__progress > *{grid-area: 1 / 1}
.ui-pcc__seg{fill: none;stroke: var(--ui-pcc-ring);stroke-width: 3;stroke-linecap: round;cursor: pointer;transition: stroke var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), stroke-width 240ms var(--ui-pcc-ease), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-pcc__seg[data-done]{stroke: var(--ui-pcc-accent)}
.ui-pcc__seg[data-hot]{stroke-width: 4.25;stroke: var(--ui-pcc-ring-hot)}
.ui-pcc__seg[data-done][data-hot]{stroke: var(--ui-pcc-accent)}
.ui-pcc__seg[data-dim]{opacity: 0.3}
.ui-pcc__num{font-size: 12px;font-weight: 500;line-height: 1;color: var(--ui-pcc-strong);font-variant-numeric: tabular-nums;pointer-events: none;animation: ui-pcc-num var(--nm-dur-4, 380ms) var(--ui-pcc-ease) both}
.ui-pcc__titles{display: grid;grid-template-columns: minmax(0, 1fr);flex: 1;min-width: 0}
.ui-pcc__name{overflow: hidden;font-size: 13px;line-height: 20px;font-weight: 500;color: var(--ui-pcc-strong);white-space: nowrap;text-overflow: ellipsis}
.ui-pcc__sub{display: flex;align-items: center;gap: 6px;min-width: 0;height: 20px;overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-pcc-muted);white-space: nowrap}
.ui-pcc__status{display: inline-flex;flex: none;align-items: center;gap: 5px;height: 20px;padding: 0 6px 0 5px;border-radius: 5px;background: var(--ui-pcc-tag-bg);font-size: 12px;line-height: 16px;font-weight: 500;color: var(--ui-pcc-tag);transition: box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-pcc[data-open] .ui-pcc__status:hover, .ui-pcc__status[aria-expanded="true"]{box-shadow: inset 0 0 0 0.5px color-mix(in srgb, var(--ui-pcc-tag) 35%, transparent)}
.ui-pcc__due{min-width: 0;overflow: hidden;text-overflow: ellipsis;font-variant-numeric: tabular-nums}
.ui-pcc__people{display: flex;flex: none}
.ui-pcc__member{position: relative;border-radius: 50%;transition: transform 240ms var(--ui-pcc-ease), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-pcc__member + .ui-pcc__member{margin-left: -5px}
.ui-pcc__member[data-on]{z-index: 1;transform: scale(1.1)}
.ui-pcc__member[data-off]{opacity: 0.4}
.ui-pcc__member[aria-pressed="true"] .ui-pcc__avatar{box-shadow: 0 0 0 1.5px var(--ui-pcc-card), 0 0 0 2.5px var(--ui-pcc-accent)}
.ui-pcc__avatar{display: grid;flex: none;place-items: center;width: 20px;height: 20px;overflow: hidden;border-radius: 50%;background: hsl(var(--ui-pcc-hue) 60% 92%);box-shadow: 0 0 0 1.5px var(--ui-pcc-card);font-size: 9px;font-weight: 500;line-height: 1;color: hsl(var(--ui-pcc-hue) 40% 36%);transition: box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-pcc__avatar img{width: 100%;height: 100%;object-fit: cover}
.ui-pcc__body{padding: 0 12px}
.ui-pcc__options{display: flex;gap: 4px;margin: -2px -12px 0;padding: 3px 12px 12px;overflow-x: auto;scrollbar-width: none}
.ui-pcc__options::-webkit-scrollbar{display: none}
.ui-pcc__option{display: inline-flex;flex: none;align-items: center;gap: 5px;height: 24px;padding: 2px 7px 2px 6px;border-radius: 6px;box-shadow: inset 0 0 0 0.5px var(--ui-pcc-line);font-size: 12px;line-height: 16px;font-weight: 500;color: var(--ui-pcc-text);white-space: nowrap;transition: background-color var(--nm-dur-1, 90ms) ease-out, color var(--nm-dur-1, 90ms) ease-out}
.ui-pcc__option svg{color: var(--ui-pcc-tag)}
.ui-pcc__dot{flex: none;width: 6px;height: 6px;border-radius: 1.5px;background: var(--ui-pcc-tag)}
.ui-pcc__option:hover{background: var(--ui-pcc-wash);color: var(--ui-pcc-ink)}
.ui-pcc__option[aria-checked="true"]{background: var(--ui-pcc-fill);color: var(--ui-pcc-ink)}
.ui-pcc__tasks{margin: 0;padding: 6px 0;border-top: 0.5px solid var(--ui-pcc-line);list-style: none}
.ui-pcc__task{display: flex;align-items: center;gap: 10px;width: calc(100% + 12px);height: 32px;margin: 0 -6px;padding: 0 6px;border-radius: 6px;color: var(--ui-pcc-ink);transition: background-color 90ms ease-out, color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-pcc__task[data-hot]{background: var(--ui-pcc-wash)}
.ui-pcc__task[data-dim]{opacity: 0.35}
.ui-pcc__label{flex: 1;min-width: 0;overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-pcc__task .ui-pcc__avatar{width: 18px;height: 18px;font-size: 8px;opacity: 0;transform: translateX(4px);transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 240ms var(--ui-pcc-ease)}
.ui-pcc__task:is([data-hot], :focus-visible) .ui-pcc__avatar{opacity: 1;transform: none}
.ui-pcc__ring{fill: none;stroke: var(--ui-pcc-faint);stroke-width: 1.1;transition: stroke 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-pcc__task[data-hot] .ui-pcc__ring{stroke: var(--ui-pcc-icon)}
.ui-pcc__disc{fill: var(--ui-pcc-accent);transform-origin: 8px 8px;transform: scale(0);transition: transform var(--nm-dur-4, 380ms) var(--ui-pcc-ease)}
.ui-pcc__tick{fill: none;stroke: #fffdfb;stroke-width: 1.5;stroke-linecap: round;stroke-linejoin: round;stroke-dasharray: 9;stroke-dashoffset: 9;transition: stroke-dashoffset var(--nm-dur-3, 240ms) var(--ui-pcc-ease) 80ms}
.ui-pcc__task[aria-checked="true"] .ui-pcc__disc{transform: scale(1)}
.ui-pcc__task[aria-checked="true"] .ui-pcc__tick{stroke-dashoffset: 0}
.ui-pcc__task[aria-checked="true"]{color: var(--ui-pcc-muted)}
.ui-pcc__foot{display: flex;align-items: center;gap: 8px;height: 44px;padding: 0 8px 0 12px;border-top: 0.5px solid var(--ui-pcc-line)}
.ui-pcc__caption{flex: 1;min-width: 0;overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-pcc-muted);white-space: nowrap;text-overflow: ellipsis;font-variant-numeric: tabular-nums}
.ui-pcc__caption > span{display: inline-block;animation: ui-pcc-in var(--nm-dur-3, 240ms) var(--ui-pcc-ease) both}
.ui-pcc__action{display: inline-flex;align-items: center;gap: 4px;flex: none;height: 28px;padding: 0 7px 0 10px;border-radius: 6px;background: var(--ui-pcc-primary);font-size: 13px;line-height: 20px;font-weight: 500;color: var(--ui-pcc-on-primary);white-space: nowrap;transition: opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-pcc__action:hover{opacity: 0.9}
.ui-pcc__action svg{transition: transform var(--nm-dur-3, 240ms) var(--ui-pcc-ease)}
.ui-pcc__action:hover svg{transform: translateX(2px)}
@keyframes ui-pcc-in{from{opacity: 0;transform: translateY(3px)}
}
@keyframes ui-pcc-num{from{opacity: 0;transform: scale(0.8)}
}
@container (max-width: 290px){.ui-pcc__due-word{display: none}
.ui-pcc__member + .ui-pcc__member{margin-left: -8px}
.ui-pcc__head{gap: 8px;padding: 10px}
.ui-pcc__body{padding: 0 10px}
.ui-pcc__sub{gap: 4px}
.ui-pcc__status{padding: 0 5px 0 4px}
.ui-pcc__options{margin: -2px -10px 0;padding: 3px 10px 10px}
.ui-pcc__option{padding: 2px 6px}
.ui-pcc__dot{display: none}
.ui-pcc__foot{padding: 0 8px 0 10px}
}
@media (pointer: coarse){.ui-pcc__task{height: 38px}
.ui-pcc__task .ui-pcc__avatar{opacity: 1;transform: none}
.ui-pcc__option{height: 32px;padding: 0 7px 0 6px}
.ui-pcc__foot{height: 52px}
.ui-pcc__action{height: 34px}
}
@media (prefers-reduced-motion: reduce){.ui-pcc *, .ui-pcc *::before, .ui-pcc *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-pcc{--ui-pcc-card: #211b16;--ui-pcc-ink: rgba(255, 253, 251, 0.9);--ui-pcc-strong: #fffdfb;--ui-pcc-text: rgba(255, 253, 251, 0.62);--ui-pcc-muted: rgba(255, 253, 251, 0.46);--ui-pcc-faint: rgba(255, 253, 251, 0.3);--ui-pcc-icon: rgba(255, 253, 251, 0.5);--ui-pcc-line: rgba(255, 253, 251, 0.08);--ui-pcc-fill: rgba(255, 253, 251, 0.08);--ui-pcc-wash: rgba(255, 253, 251, 0.04);--ui-pcc-ring: rgba(255, 253, 251, 0.1);--ui-pcc-ring-hot: rgba(255, 253, 251, 0.26);--ui-pcc-accent: #ff8a5c;--ui-pcc-primary: rgba(255, 253, 251, 0.9);--ui-pcc-on-primary: #211b16;--ui-pcc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-pcc-focus: rgba(255, 138, 92, 0.5)}
:where(.dark, [data-theme="dark"]) .ui-pcc__avatar{background: hsl(var(--ui-pcc-hue) 26% 26%);color: hsl(var(--ui-pcc-hue) 60% 82%)}
:where(.dark, [data-theme="dark"]) .ui-pcc [data-tone="red"]{--ui-pcc-tag: #f0938c;--ui-pcc-tag-bg: rgba(226, 84, 74, 0.14)}
:where(.dark, [data-theme="dark"]) .ui-pcc [data-tone="amber"]{--ui-pcc-tag: #e8b05c;--ui-pcc-tag-bg: rgba(217, 149, 48, 0.14)}
:where(.dark, [data-theme="dark"]) .ui-pcc [data-tone="green"]{--ui-pcc-tag: #4f9d6e;--ui-pcc-tag-bg: rgba(47, 141, 92, 0.14)}
:where(.dark, [data-theme="dark"]) .ui-pcc [data-tone="blue"]{--ui-pcc-tag: #ffb28f;--ui-pcc-tag-bg: rgba(255, 138, 92, 0.14)}
:where(.dark, [data-theme="dark"]) .ui-pcc [data-tone="violet"]{--ui-pcc-tag: #ffb28f;--ui-pcc-tag-bg: rgba(255, 107, 53, 0.18)}
:where(.dark, [data-theme="dark"]) .ui-pcc [data-tone="gray"]{--ui-pcc-tag: rgba(255, 253, 251, 0.62);--ui-pcc-tag-bg: rgba(255, 253, 251, 0.08)}

`;
