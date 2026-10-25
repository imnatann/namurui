"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

/*
 * Autonomy Dial – how much an agent may do on its own, in a single self-contained file.
 * Three stops (Always ask · If risky · Full auto) in a segmented track, and the agent's real
 * actions listed under "Runs on its own" and "Asks you first". Changing the stop or a lock
 * moves the affected rows between the two groups, each one gliding from where it was; the
 * group counts roll in the direction the number moved. A lock pins an action to "always asks"
 * whatever the dial says.
 * The styles are injected below, so no extra files are needed.
 */

export type AutonomyLevel = 0 | 1 | 2;
export type ActionRisk = "safe" | "risky" | "destructive";

export type AgentAction = {
  /** Stable id – used by `locked` and to keep a row's identity while it glides */
  id: string;
  /** The real action, e.g. "Send emails" */
  label: string;
  /** Safe actions run at "If risky"; risky and destructive ones wait for you */
  risk: ActionRisk;
  /** Optional second line – the tool or scope, e.g. "Drive · Notion"; hides on narrow cards */
  detail?: string;
  /** Brand mark for the 16px tile – drawn SVGs keep their own fills */
  icon?: ReactNode;
};

export type AutonomyDialProps = {
  /** The agent's actions, in the order you want them listed */
  actions: AgentAction[];
  /** Controlled stop: 0 Always ask, 1 If risky, 2 Full auto */
  level?: AutonomyLevel;
  /** Starting stop when uncontrolled */
  defaultLevel?: AutonomyLevel;
  /** Called when a stop is chosen, by click or arrow key */
  onLevelChange?: (level: AutonomyLevel) => void;
  /** Controlled ids of actions that always ask, whatever the stop */
  locked?: string[];
  /** Starting locks when uncontrolled */
  defaultLocked?: string[];
  /** Called with the next lock set when a lock is toggled */
  onLockChange?: (locked: string[]) => void;
  /** Heading, e.g. the agent's name */
  title?: string;
  /** Line under the heading */
  subtitle?: string;
  className?: string;
};

const LEVELS: { value: AutonomyLevel; label: string; hint: string }[] = [
  { value: 0, label: "Always ask", hint: "Every action waits for your approval" },
  { value: 1, label: "If risky", hint: "Safe actions run, risky ones wait for you" },
  { value: 2, label: "Full auto", hint: "Everything runs on its own, except what you lock" },
];

const EASE = "cubic-bezier(0.32, 0.72, 0.24, 1)";
const GLIDE = 420;

/**
 * The rule behind the dial, exported so the agent's runtime uses exactly what the settings show.
 * A lock always asks; "Always ask" asks for everything; "If risky" runs only safe actions;
 * "Full auto" runs everything that is not locked.
 */
export function asksFirst(action: AgentAction, level: AutonomyLevel, locked: string[]): boolean {
  if (locked.includes(action.id)) return true;
  if (level === 0) return true;
  if (level === 1) return action.risk !== "safe";
  return false;
}

export function AutonomyDial({
  actions,
  level: levelProp,
  defaultLevel = 1,
  onLevelChange,
  locked: lockedProp,
  defaultLocked = [],
  onLockChange,
  title = "Agent permissions",
  subtitle = "What it may do without asking you",
  className,
}: AutonomyDialProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [innerLevel, setInnerLevel] = useState<AutonomyLevel>(defaultLevel);
  const [innerLocked, setInnerLocked] = useState<string[]>(defaultLocked);
  const level = levelProp ?? innerLevel;
  const locked = lockedProp ?? innerLocked;

  const stops = useRef<(HTMLButtonElement | null)[]>([]);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const positions = useRef(new Map<string, { top: number; left: number }>());
  const signature = useRef(`${level}:${locked.join(",")}`);

  const own = actions.filter((action) => !asksFirst(action, level, locked));
  const asking = actions.filter((action) => asksFirst(action, level, locked));

  const pick = (next: AutonomyLevel, focus = false) => {
    if (next !== level) {
      if (levelProp === undefined) setInnerLevel(next);
      onLevelChange?.(next);
    }
    if (focus) stops.current[next]?.focus();
  };

  const toggleLock = (id: string) => {
    const next = locked.includes(id) ? locked.filter((entry) => entry !== id) : [...locked, id];
    if (lockedProp === undefined) setInnerLocked(next);
    onLockChange?.(next);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    let next: AutonomyLevel | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(2, level + 1) as AutonomyLevel;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, level - 1) as AutonomyLevel;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = 2;
    if (next === null) return;
    event.preventDefault();
    pick(next, true);
  };

  const registerRow = (id: string) => (el: HTMLLIElement | null) => {
    if (el) rows.current.set(id, el);
    else if (!rows.current.get(id)?.isConnected) rows.current.delete(id);
  };

  // FLIP: after a stop or lock change, every row that changed place glides from where it was
  useLayoutEffect(() => {
    const key = `${level}:${locked.join(",")}`;
    const changed = key !== signature.current;
    const measured = new Map<string, { top: number; left: number }>();

    for (const [id, el] of rows.current) {
      if (el.isConnected) measured.set(id, { top: el.offsetTop, left: el.offsetLeft });
    }

    if (changed && typeof window !== "undefined") {
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const movers: { el: HTMLLIElement; dx: number; dy: number; top: number }[] = [];

      if (!still) {
        for (const [id, el] of rows.current) {
          const from = positions.current.get(id);
          const to = measured.get(id);
          if (!from || !to) continue;
          const dx = from.left - to.left;
          const dy = from.top - to.top;
          if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
          movers.push({ el, dx, dy, top: to.top });
        }
      }

      // Top to bottom, so the list settles in reading order rather than declaration order
      movers.sort((a, b) => a.top - b.top);
      for (const [index, mover] of movers.entries()) {
        mover.el.animate(
          [
            { transform: `translate(${mover.dx}px, ${mover.dy}px)` },
            { transform: "translate(0, 0)" },
          ],
          { duration: GLIDE, delay: index * 28, easing: EASE },
        );
      }
    }

    positions.current = measured;
    signature.current = key;
  });

  return (
    <div className={["ui-adc", className].filter(Boolean).join(" ")} data-level={level}>
      {/* React 19 hoists this into <head> once, no matter how many dials render */}
      <style href="ui-autonomy-dial" precedence="default">
        {css}
      </style>

      <div className="ui-adc__card">
        <header className="ui-adc__head">
          <span className="ui-adc__spark">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M7 1.2c.4 2.9 1.9 4.4 4.8 4.8-2.9.4-4.4 1.9-4.8 4.8C6.6 7.9 5.1 6.4 2.2 6 5.1 5.6 6.6 4.1 7 1.2Z"
                fill="currentColor"
              />
              <circle cx="11.6" cy="11.4" r="1.1" fill="currentColor" opacity="0.55" />
            </svg>
          </span>
          <span className="ui-adc__heading">
            <span className="ui-adc__title">{title}</span>
            <span className="ui-adc__sub">{subtitle}</span>
          </span>
        </header>

        <div className="ui-adc__levels">
          <div
            className="ui-adc__segmented"
            role="radiogroup"
            aria-label="Autonomy"
            aria-describedby={`${uid}-hint`}
            onKeyDown={onKeyDown}
          >
            {LEVELS.map((stop) => (
              <button
                key={stop.value}
                ref={(el) => {
                  stops.current[stop.value] = el;
                }}
                type="button"
                role="radio"
                aria-checked={stop.value === level}
                tabIndex={stop.value === level ? 0 : -1}
                data-level={stop.value}
                className="ui-adc__level"
                onClick={() => pick(stop.value)}
              >
                {stop.label}
              </button>
            ))}
          </div>
          <span className="ui-adc__sr" id={`${uid}-hint`}>
            {LEVELS[level].hint}
          </span>
        </div>

        <div className="ui-adc__groups">
          <Group
            id={`${uid}-own`}
            title="Runs on its own"
            empty="Nothing runs on its own"
            asking={false}
            actions={own}
            locked={locked}
            onToggleLock={toggleLock}
            registerRow={registerRow}
          />
          <Group
            id={`${uid}-ask`}
            title="Asks you first"
            empty="Nothing waits for you"
            asking
            actions={asking}
            locked={locked}
            onToggleLock={toggleLock}
            registerRow={registerRow}
          />
        </div>
      </div>

      <span className="ui-adc__sr" aria-live="polite">
        {`${LEVELS[level].label}: ${own.length} on its own, ${asking.length} ask first`}
      </span>
    </div>
  );
}

function Group({
  id,
  title,
  empty,
  asking,
  actions,
  locked,
  onToggleLock,
  registerRow,
}: {
  id: string;
  title: string;
  empty: string;
  asking: boolean;
  actions: AgentAction[];
  locked: string[];
  onToggleLock: (id: string) => void;
  registerRow: (id: string) => (el: HTMLLIElement | null) => void;
}) {
  return (
    <section className="ui-adc__group" aria-labelledby={id}>
      <h4 className="ui-adc__group-head" id={id}>
        {title}
        <span className="ui-adc__count">
          <RollingCount value={actions.length} />
        </span>
      </h4>
      {actions.length === 0 ? (
        <div className="ui-adc__empty">{empty}</div>
      ) : (
        <ul className="ui-adc__list">
          {actions.map((action) => {
            const isLocked = locked.includes(action.id);
            return (
              <li
                key={action.id}
                ref={registerRow(action.id)}
                className="ui-adc__row"
                data-asks={asking ? "" : undefined}
              >
                <span className="ui-adc__icon">{action.icon}</span>
                <span className="ui-adc__name">
                  <span className="ui-adc__line">
                    <span className="ui-adc__label">{action.label}</span>
                    {action.risk !== "safe" && (
                      <span className="ui-adc__risk" data-risk={action.risk}>
                        {action.risk === "destructive" ? <DestructiveIcon /> : <RiskyIcon />}
                        {action.risk === "destructive" ? "Destructive" : "Risky"}
                      </span>
                    )}
                  </span>
                  {action.detail && <span className="ui-adc__detail">{action.detail}</span>}
                </span>
                <button
                  type="button"
                  className="ui-adc__pin"
                  aria-pressed={isLocked}
                  aria-label={
                    isLocked
                      ? `${action.label}: always asks – unlock`
                      : `Always ask before: ${action.label}`
                  }
                  title={
                    isLocked ? "Always asks – click to follow the dial again" : "Always ask, whatever the dial says"
                  }
                  onClick={() => onToggleLock(action.id)}
                >
                  {isLocked ? <LockClosedIcon /> : <LockOpenIcon />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* Counts roll in the direction the number moved; a fresh node restarts the CSS animation. */
function RollingCount({ value }: { value: number }) {
  const [shown, setShown] = useState<{ value: number; dir?: "up" | "down"; run: number }>({
    value,
    run: 0,
  });

  if (value !== shown.value) {
    setShown({ value, dir: value > shown.value ? "up" : "down", run: shown.run + 1 });
  }

  return (
    <span key={shown.run} className="ui-adc__roll" data-dir={shown.dir}>
      {value}
    </span>
  );
}

/* ---------- Icons ---------- */

const RiskyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M13.9248 21H10.0752C5.44476 21 3.12955 21 2.27636 19.4939C1.42317 17.9879 2.60736 15.9914 4.97574 11.9985L6.90057 8.75333C9.17559 4.91778 10.3131 3 12 3C13.6869 3 14.8244 4.91777 17.0994 8.75332L19.0243 11.9985C21.3926 15.9914 22.5768 17.9879 21.7236 19.4939C20.8704 21 18.5552 21 13.9248 21Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
    <path d="M12 9V13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    <path
      d="M12.125 16.75H12M12.25 16.75C12.25 16.8881 12.1381 17 12 17C11.8619 17 11.75 16.8881 11.75 16.75C11.75 16.6119 11.8619 16.5 12 16.5C12.1381 16.5 12.25 16.6119 12.25 16.75Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

const DestructiveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M5.92089 5.92089C8.15836 3.68342 9.2771 2.56468 10.5857 2.19562C11.5105 1.93479 12.4895 1.93479 13.4143 2.19562C14.7229 2.56468 15.8416 3.68342 18.0791 5.92089C20.3166 8.15836 21.4353 9.2771 21.8044 10.5857C22.0652 11.5105 22.0652 12.4895 21.8044 13.4143C21.4353 14.7229 20.3166 15.8416 18.0791 18.0791C15.8416 20.3166 14.7229 21.4353 13.4143 21.8044C12.4895 22.0652 11.5105 22.0652 10.5857 21.8044C9.2771 21.4353 8.15836 20.3166 5.92089 18.0791C3.68342 15.8416 2.56468 14.7229 2.19562 13.4143C1.93479 12.4895 1.93479 11.5105 2.19562 10.5857C2.56468 9.2771 3.68342 8.15836 5.92089 5.92089Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
    <path d="M12 8V12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    <path
      d="M12.125 15.75H12M12.25 15.75C12.25 15.8881 12.1381 16 12 16C11.8619 16 11.75 15.8881 11.75 15.75C11.75 15.6119 11.8619 15.5 12 15.5C12.1381 15.5 12.25 15.6119 12.25 15.75Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

const LockOpenIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 14.5V17.5M13 14.5C13 15.0523 12.5523 15.5 12 15.5C11.4477 15.5 11 15.0523 11 14.5C11 13.9477 11.4477 13.5 12 13.5C12.5523 13.5 13 13.9477 13 14.5Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
    <path
      d="M7.5 9V6.5C7.5 4.01472 9.51472 2 12 2C13.9593 2 15.8664 3.25221 16.5 5"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
    <path
      d="M4.26781 18.8447C4.49269 20.515 5.87613 21.8235 7.55966 21.9009C8.97627 21.966 10.4153 22 12 22C13.5847 22 15.0237 21.966 16.4403 21.9009C18.1239 21.8235 19.5073 20.515 19.7322 18.8447C19.879 17.7547 20 16.6376 20 15.5C20 14.3624 19.879 13.2453 19.7322 12.1553C19.5073 10.485 18.1239 9.17649 16.4403 9.09909C15.0237 9.03397 13.5847 9 12 9C10.4153 9 8.97627 9.03397 7.55966 9.09909C5.87613 9.17649 4.49269 10.485 4.26781 12.1553C4.12104 13.2453 4 14.3624 4 15.5C4 16.6376 4.12104 17.7547 4.26781 18.8447Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

const LockClosedIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 14.5V17.5M13 14.5C13 15.0523 12.5523 15.5 12 15.5C11.4477 15.5 11 15.0523 11 14.5C11 13.9477 11.4477 13.5 12 13.5C12.5523 13.5 13 13.9477 13 14.5Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
    <path
      d="M16.5 9V6.5C16.5 4.01472 14.4853 2 12 2C9.51471 2 7.49999 4.01472 7.49999 6.5V9"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
    <path
      d="M4.2678 18.8447C4.49268 20.515 5.87612 21.8235 7.55965 21.9009C8.97627 21.966 10.4153 22 12 22C13.5847 22 15.0237 21.966 16.4403 21.9009C18.1239 21.8235 19.5073 20.515 19.7322 18.8447C19.8789 17.7547 20 16.6376 20 15.5C20 14.3624 19.8789 13.2453 19.7322 12.1553C19.5073 10.485 18.1239 9.17649 16.4403 9.09909C15.0237 9.03397 13.5847 9 12 9C10.4153 9 8.97627 9.03397 7.55965 9.09909C5.87612 9.17649 4.49268 10.485 4.2678 12.1553C4.12104 13.2453 3.99999 14.3624 3.99999 15.5C3.99999 16.6376 4.12104 17.7547 4.2678 18.8447Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

const css = /* css */ `
.ui-adc{--ui-adc-card: #fffdfb;--ui-adc-strong: #0b0908;--ui-adc-ink: rgba(11, 9, 8, 0.88);--ui-adc-text: rgba(11, 9, 8, 0.61);--ui-adc-muted: rgba(11, 9, 8, 0.45);--ui-adc-faint: rgba(11, 9, 8, 0.27);--ui-adc-icon: rgba(11, 9, 8, 0.447);--ui-adc-line: rgba(11, 9, 8, 0.06);--ui-adc-wash: rgba(11, 9, 8, 0.03);--ui-adc-fill: rgba(11, 9, 8, 0.06);--ui-adc-accent: rgba(217, 84, 31, 0.765);--ui-adc-brand-bg: #ff6b3519;--ui-adc-brand-fg: #d9541ff2;--ui-adc-warn-bg: #d9953029;--ui-adc-warn-fg: #d9541f;--ui-adc-danger-bg: #b3261e18;--ui-adc-danger-fg: #b3261eda;--ui-adc-amber: #d9541f;--ui-adc-red: #b3261eda;--ui-adc-focus: rgba(217, 84, 31, 0.35);--ui-adc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-adc-ease: cubic-bezier(0.32, 0.72, 0.24, 1);position: relative;box-sizing: border-box;width: 100%;max-width: 400px;container-type: inline-size;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;font-weight: 400;line-height: 20px;color: var(--ui-adc-text);text-align: left;-webkit-font-smoothing: antialiased}
.ui-adc *, .ui-adc *::before, .ui-adc *::after{box-sizing: border-box}
:where(.ui-adc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;text-align: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-adc button:focus-visible{outline: 2px solid var(--ui-adc-focus);outline-offset: 1px}
.ui-adc ul{margin: 0;padding: 0;list-style: none}
.ui-adc h4{margin: 0}
.ui-adc svg{display: block;flex: none}
.ui-adc__sr{position: absolute;width: 1px;height: 1px;overflow: hidden;clip-path: inset(50%);white-space: nowrap}
.ui-adc__card{overflow: hidden;border-radius: 10px;background: var(--ui-adc-card);box-shadow: var(--ui-adc-shadow)}
.ui-adc__head{display: flex;align-items: center;gap: 10px;padding: 16px 16px 0}
.ui-adc__spark{display: grid;flex: none;place-items: center;width: 16px;color: var(--ui-adc-accent)}
.ui-adc__heading{display: grid;min-width: 0}
.ui-adc__title{overflow: hidden;font-weight: 500;color: var(--ui-adc-strong);white-space: nowrap;text-overflow: ellipsis}
.ui-adc__sub{overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-adc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-adc__levels{padding: 16px 16px 18px}
.ui-adc__segmented{position: relative;display: flex;gap: 8px}
.ui-adc__level{position: relative;flex: 1;padding: 3px 8px;border-radius: 6px;background: var(--ui-adc-fill);font-size: 12px;font-weight: 500;line-height: 18px;color: var(--ui-adc-text);text-align: center !important;white-space: nowrap;transition: color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-adc__level[aria-checked="true"]{background: var(--ui-adc-card);box-shadow: var(--ui-adc-shadow);color: var(--ui-adc-strong)}
.ui-adc__level[aria-checked="false"]:hover{background: rgba(11, 9, 8, 0.08);color: var(--ui-adc-ink)}
.ui-adc__groups{display: grid;gap: 14px;padding: 14px 10px 12px;border-top: 0.5px solid var(--ui-adc-line)}
.ui-adc__group-head{display: flex;align-items: center;gap: 6px;margin: 0 6px 4px !important;font-size: 12px;font-weight: 400;line-height: 16px;color: var(--ui-adc-muted)}
.ui-adc__count{display: grid;place-items: center;min-width: 16px;height: 16px;padding: 0 4px;overflow: hidden;border-radius: 4px;background: var(--ui-adc-card);box-shadow: var(--ui-adc-shadow);font-size: 10px;font-weight: 500;line-height: 16px;color: var(--ui-adc-text);font-variant-numeric: tabular-nums}
.ui-adc__roll{display: block}
.ui-adc__roll[data-dir="up"]{animation: ui-adc-roll-up var(--nm-dur-4, 380ms) var(--ui-adc-ease) both}
.ui-adc__roll[data-dir="down"]{animation: ui-adc-roll-down var(--nm-dur-4, 380ms) var(--ui-adc-ease) both}
.ui-adc__list{display: grid}
.ui-adc__row{position: relative;display: flex;align-items: center;gap: 12px;min-height: 30px;padding: 0 4px 0 6px;border-radius: 6px;background: var(--ui-adc-card);transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-adc__row:hover{background: var(--ui-adc-wash)}
.ui-adc__icon{display: grid;flex: none;place-items: center;width: 16px;height: 16px;color: var(--ui-adc-icon)}
.ui-adc__icon > svg{width: 16px;height: 16px}
.ui-adc__name{display: grid;flex: 1;min-width: 0}
.ui-adc__label{overflow: hidden;color: var(--ui-adc-ink);white-space: nowrap;text-overflow: ellipsis}
.ui-adc__detail{overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-adc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-adc__line{display: flex;align-items: center;gap: 8px;min-width: 0}
.ui-adc__risk{display: inline-flex;flex: none;align-items: center;gap: 3px;height: 18px;padding: 0 6px 0 4px;border-radius: 4px;background: var(--ui-adc-warn-bg);font-size: 11px;font-weight: 500;line-height: 16px;color: var(--ui-adc-warn-fg)}
.ui-adc__risk > svg{width: 12px;height: 12px}
.ui-adc__risk[data-risk="destructive"]{background: var(--ui-adc-danger-bg);color: var(--ui-adc-danger-fg)}
.ui-adc__pin{display: grid;flex: none;place-items: center;width: 28px;height: 28px;border-radius: 6px;color: var(--ui-adc-faint);opacity: 0;transition: opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-adc__row:hover .ui-adc__pin, .ui-adc__pin:focus-visible, .ui-adc__pin[aria-pressed="true"]{opacity: 1}
.ui-adc__pin:hover{background: var(--ui-adc-fill);color: var(--ui-adc-ink)}
.ui-adc__pin[aria-pressed="true"]{color: var(--ui-adc-icon)}
.ui-adc__empty{display: flex;align-items: center;justify-content: center;min-height: 30px;margin: 2px 0;padding: 6px 10px;border-radius: 6px;background: var(--ui-adc-wash);font-size: 12px;line-height: 16px;color: var(--ui-adc-muted);text-align: center}
@keyframes ui-adc-roll-up{from{opacity: 0;transform: translateY(70%)}
}
@keyframes ui-adc-roll-down{from{opacity: 0;transform: translateY(-70%)}
}
@container (max-width: 340px){.ui-adc__detail{display: none}
.ui-adc__segmented{gap: 4px}
.ui-adc__level{padding: 4px 6px;font-size: 12px}
}
@media (hover: none){.ui-adc__pin{opacity: 1}
}
@media (pointer: coarse){.ui-adc__level{padding: 8px 10px}
.ui-adc__pin{width: 34px;height: 34px}
.ui-adc__row{min-height: 44px}
}
@media (prefers-reduced-motion: reduce){.ui-adc *, .ui-adc *::before, .ui-adc *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-adc__level[aria-checked="false"]:hover{background: rgba(255, 253, 251, 0.11)}
:where(.dark, [data-theme="dark"]) .ui-adc{--ui-adc-card: #211b16;--ui-adc-strong: #fffdfb;--ui-adc-ink: rgba(255, 253, 251, 0.9);--ui-adc-text: rgba(255, 253, 251, 0.62);--ui-adc-muted: rgba(255, 253, 251, 0.45);--ui-adc-faint: rgba(255, 253, 251, 0.28);--ui-adc-icon: rgba(255, 253, 251, 0.5);--ui-adc-line: rgba(255, 253, 251, 0.08);--ui-adc-wash: rgba(255, 253, 251, 0.04);--ui-adc-fill: rgba(255, 253, 251, 0.08);--ui-adc-accent: #ff8a5c;--ui-adc-brand-bg: #ff6b353a;--ui-adc-brand-fg: #ff8a5c;--ui-adc-warn-bg: #ff6b3525;--ui-adc-warn-fg: #ff8a5c;--ui-adc-danger-bg: #e2544a2b;--ui-adc-danger-fg: #e2544a;--ui-adc-amber: #ff8a5c;--ui-adc-red: #e2544a;--ui-adc-focus: rgba(255, 138, 92, 0.45);--ui-adc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4)}

`;
