"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

/*
 * Agent Schedule – what wakes an agent: the cadences it recurs on and the events it listens for,
 * each with its last run, its next run and a switch of its own.
 * Every next-run value is derived from the trigger's own timestamps on each tick, so a cadence
 * that has come due rolls forward to its following occurrence instead of counting backwards.
 * Enabling a row drops its next-run line into place on the ease-out curve; Run now sweeps an
 * ember line along the row's bottom edge for one motion step. The styles are injected below, so
 * no extra files are needed.
 */

/** How a run ended. The glyph and the word differ as well, so the outcome never rests on tint. */
export type RunOutcome = "ok" | "failed";

/** The last time a trigger woke the agent. */
export type TriggerRun = {
  /** When it started, epoch ms */
  at: number;
  /** How it ended */
  status: RunOutcome;
  /** One line about it: what it did on success, what went wrong on failure */
  note?: string;
  /** How long it took, ms */
  durationMs?: number;
};

type TriggerBase = {
  /** Stable id, used for the switch state as well */
  id: string;
  /** What the trigger is called */
  name: string;
  /** The switch position. Read when the component owns the switches itself */
  enabled?: boolean;
  /** The last run, if it has ever run */
  lastRun?: TriggerRun;
  /** The next occurrence, epoch ms. Left out, the row has nothing to count down to */
  nextRunAt?: number;
  /** The gap between occurrences, ms. Once the clock passes `nextRunAt` the row rolls forward in
   * whole steps of this, so a tab that slept through a run still shows the truth */
  everyMs?: number;
  /** Why it cannot run now, for example a credential the console does not have. Disables Run now
   * and is shown next to the button that would have started it */
  blockedReason?: string;
};

/** A cadence the agent recurs on. */
export type ScheduleTrigger = TriggerBase & {
  kind: "schedule";
  /** The cadence in words, the line a person reads first */
  cadence: string;
  /** The raw expression, shown secondarily */
  expression: string;
  /** The zone the cadence is read in */
  timezone?: string;
};

/** Something the agent listens for. */
export type EventTrigger = TriggerBase & {
  kind: "event";
  /** Where the event comes from */
  source: string;
  /** The event name */
  event: string;
};

/** One wake rule: either a cadence or an event. */
export type AgentTrigger = ScheduleTrigger | EventTrigger;

export type AgentScheduleProps = {
  /** The wake rules, in the order they should read */
  triggers: readonly AgentTrigger[];
  /** Heading in the bar */
  title?: string;
  /** Who the rules belong to, next to the title */
  agent?: string;
  /** Ids of the triggers that are on. Controlled: left out, the component keeps them itself */
  enabled?: readonly string[];
  /** Which triggers start on when the component keeps them itself. Falls back to each trigger's
   * own `enabled` flag */
  defaultEnabled?: readonly string[];
  /** The trigger currently running. Controlled: left out, Run now owns the state */
  runningId?: string | null;
  /** A switch moved */
  onToggle?: (id: string, enabled: boolean) => void;
  /** Run now was pressed on a trigger that is on and not blocked */
  onRunNow?: (id: string) => void;
  /** Clock, epoch ms. Left out, the schedule ticks itself */
  now?: number;
  /** Extra class on the root */
  className?: string;
};

export function AgentSchedule({
  triggers,
  title = "Wake rules",
  agent,
  enabled,
  defaultEnabled,
  runningId,
  onToggle,
  onRunNow,
  now,
  className,
}: AgentScheduleProps) {
  const labelId = useId();
  const nameBase = useId();
  const whyBase = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const sweeps = useRef(new Map<string, HTMLSpanElement>());
  const sweepRef = useRef(0);
  const holdRef = useRef(0);
  const inViewRef = useRef(true);
  /* The switches as they were last seen, so a change is announced once and a first render is not. */
  const previousOn = useRef<ReadonlySet<string> | null>(null);

  const [ownEnabled, setOwnEnabled] = useState<ReadonlySet<string>>(
    () => new Set(enabled ?? defaultEnabled ?? triggers.filter((one) => one.enabled).map((one) => one.id)),
  );
  const [ownRunning, setOwnRunning] = useState<string | null>(null);
  const [tick, setTick] = useState(() => now ?? Date.now());
  const [awake, setAwake] = useState(true);
  const [note, setNote] = useState("");

  const clock = now ?? tick;
  const runningNow = runningId !== undefined ? runningId : ownRunning;
  const isOn = (id: string) => (enabled !== undefined ? enabled.includes(id) : ownEnabled.has(id));

  /* The schedule keeps its own clock, so a relative time is read from the wall clock rather than
     counted down. It stops while the tab is hidden and while the list is off screen, and the tick
     drives those labels only: no animation waits on it. */
  useEffect(() => {
    const host = rootRef.current;
    if (!host || typeof document === "undefined") return undefined;
    const sync = () => setAwake(!document.hidden && inViewRef.current);
    sync();
    document.addEventListener("visibilitychange", sync);
    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver((entries) => {
        inViewRef.current = entries[0]?.isIntersecting ?? true;
        sync();
      });
      observer.observe(host);
    }
    return () => {
      document.removeEventListener("visibilitychange", sync);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (now !== undefined || !awake) return undefined;
    setTick(Date.now());
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [now, awake]);

  useEffect(() => {
    return () => {
      window.cancelAnimationFrame(sweepRef.current);
      window.clearTimeout(holdRef.current);
    };
  }, []);

  /* A switch that moves is worth saying out loud. The countdown itself is not: a polite region
     that fires every second reads the whole list at the reader instead of reporting a change. */
  useEffect(() => {
    const next = new Set(enabled ?? ownEnabled);
    const before = previousOn.current;
    previousOn.current = next;
    if (before === null) return;
    const at = now ?? Date.now();
    const messages: string[] = [];
    for (const trigger of triggers) {
      const was = before.has(trigger.id);
      const is = next.has(trigger.id);
      if (was === is) continue;
      if (!is) {
        messages.push(`${trigger.name} paused.`);
        continue;
      }
      const due = nextOccurrence(trigger, at);
      messages.push(due === undefined ? `${trigger.name} on.` : `${trigger.name} on. Next run ${formatCountdown(due, at)}.`);
    }
    if (messages.length > 0) setNote(messages.join(" "));
  }, [enabled, ownEnabled, triggers, now]);

  const toggle = (trigger: AgentTrigger, next: boolean) => {
    if (enabled === undefined) {
      setOwnEnabled((before) => {
        const after = new Set(before);
        if (next) after.add(trigger.id);
        else after.delete(trigger.id);
        return after;
      });
    }
    onToggle?.(trigger.id, next);
  };

  const run = (trigger: AgentTrigger, allowed: boolean) => {
    if (!allowed) return;
    onRunNow?.(trigger.id);
    setNote(`Running ${trigger.name} now.`);
    /* A controlled parent owns the running state and the row it lights up; this is only the
       component's own copy of it. */
    const line = runningId === undefined ? sweeps.current.get(trigger.id) : undefined;
    if (!line) return;
    setOwnRunning(trigger.id);
    const host = rootRef.current;
    const span = host ? readMs(host, "--ui-agsc-run", 620) : 620;
    window.clearTimeout(holdRef.current);
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      /* No sweep to watch, so the row simply stays in its running state for the same beat. */
      holdRef.current = window.setTimeout(() => {
        setOwnRunning((current) => (current === trigger.id ? null : current));
      }, span);
      return;
    }
    window.cancelAnimationFrame(sweepRef.current);
    line.style.setProperty("--ui-agsc-p", "0");
    const started = performance.now();
    const step = (time: number) => {
      const done = Math.min(1, (time - started) / span);
      line.style.setProperty("--ui-agsc-p", String(done));
      if (done < 1) {
        sweepRef.current = window.requestAnimationFrame(step);
        return;
      }
      setOwnRunning((current) => (current === trigger.id ? null : current));
    };
    sweepRef.current = window.requestAnimationFrame(step);
  };

  const onCount = triggers.filter((one) => isOn(one.id)).length;
  const soonest = triggers.reduce<number | undefined>((next, trigger) => {
    if (!isOn(trigger.id)) return next;
    const due = nextOccurrence(trigger, clock);
    if (due === undefined) return next;
    return next === undefined || due < next ? due : next;
  }, undefined);

  return (
    <div ref={rootRef} className={["ui-agsc", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-agent-schedule" precedence="default">
        {css}
      </style>

      <div className="ui-agsc__head">
        <span className="ui-agsc__mark" aria-hidden="true">
          <WakeMark />
        </span>
        <span className="ui-agsc__title" id={labelId}>
          {title}
        </span>
        {agent ? <span className="ui-agsc__agent">{agent}</span> : null}
        {triggers.length > 0 ? (
          <span className="ui-agsc__sum">
            <span>
              <b>{onCount}</b> of {triggers.length} on
            </span>
            <span>
              {soonest === undefined ? (
                "Nothing scheduled"
              ) : (
                <>
                  Next wake <b>{formatCountdown(soonest, clock)}</b>
                </>
              )}
            </span>
          </span>
        ) : null}
      </div>

      {triggers.length === 0 ? (
        <p className="ui-agsc__empty">No wake rules yet. This agent only runs when it is asked to.</p>
      ) : (
        <ol className="ui-agsc__panel" aria-labelledby={labelId}>
          {triggers.map((trigger, index) => {
            const on = isOn(trigger.id);
            const running = runningNow === trigger.id;
            const horizon = on ? nextOccurrence(trigger, clock) : undefined;
            const last = trigger.lastRun;
            const outcome = last ? last.status : "never";
            const why = on ? trigger.blockedReason : "Paused. Turn it on to run now.";
            const allowed = on && !trigger.blockedReason && !running;
            const nameId = `${nameBase}-${index}`;
            const whyId = `${whyBase}-${index}`;

            return (
              <li
                key={trigger.id}
                className="ui-agsc__row"
                data-kind={trigger.kind}
                data-on={on ? "on" : "off"}
                data-running={running ? "" : undefined}
                style={{ "--i": index } as CSSProperties}
              >
                <span className="ui-agsc__kind" aria-hidden="true">
                  {trigger.kind === "schedule" ? <CadenceMark /> : <ArrivalMark />}
                </span>

                <div className="ui-agsc__body">
                  <span className="ui-agsc__line">
                    <span className="ui-agsc__name" id={nameId}>
                      {trigger.name}
                    </span>
                    <span className="ui-agsc__tag">{trigger.kind === "schedule" ? "Schedule" : "Event"}</span>
                  </span>

                  <span className="ui-agsc__spec">
                    {trigger.kind === "schedule" ? (
                      <>
                        <span className="ui-agsc__cadence">{trigger.cadence}</span>
                        <span className="ui-agsc__expr">
                          {trigger.expression}
                          {trigger.timezone ? ` · ${trigger.timezone}` : ""}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="ui-agsc__cadence">
                          On <code className="ui-agsc__code">{trigger.event}</code>
                        </span>
                        <span>from {trigger.source}</span>
                      </>
                    )}
                  </span>

                  {why ? (
                    <span className="ui-agsc__why" id={whyId}>
                      {on ? <BlockedMark /> : <HoldMark />}
                      <span className="ui-agsc__why-text">{why}</span>
                    </span>
                  ) : null}
                </div>

                <div className="ui-agsc__end">
                  <span className="ui-agsc__when">
                    <span className="ui-agsc__out" data-outcome={outcome}>
                      {outcome === "ok" ? <DoneMark /> : outcome === "failed" ? <BrokenMark /> : <IdleMark />}
                      <b>{outcome === "ok" ? "Ran" : outcome === "failed" ? "Failed" : "Never run"}</b>
                      {last ? <span className="ui-agsc__ago">{ago(last.at, clock)}</span> : null}
                    </span>
                    {last?.durationMs !== undefined ? <span>took {formatSpan(last.durationMs)}</span> : null}
                  </span>

                  {last?.note ? (
                    <span className="ui-agsc__detail" title={last.note}>
                      {last.note}
                    </span>
                  ) : null}

                  <span className="ui-agsc__slot">
                    <span className="ui-agsc__next">
                      <span>Next</span>
                      <b>
                        {horizon !== undefined
                          ? formatCountdown(horizon, clock)
                          : trigger.kind === "event"
                            ? "on event"
                            : "not scheduled"}
                      </b>
                      <span>
                        {horizon !== undefined
                          ? formatClock(horizon, clock)
                          : trigger.kind === "event"
                            ? "armed"
                            : ""}
                      </span>
                    </span>
                    <span className="ui-agsc__halt" aria-hidden="true">
                      <HoldMark />
                      <span>Paused</span>
                    </span>
                  </span>

                  <span className="ui-agsc__acts">
                    <button
                      type="button"
                      className="ui-agsc__run"
                      data-running={running ? "" : undefined}
                      aria-disabled={allowed ? undefined : true}
                      aria-busy={running || undefined}
                      aria-describedby={why ? whyId : undefined}
                      onClick={() => run(trigger, allowed)}
                    >
                      {running ? <TurnMark /> : <PlayMark />}
                      <span>{running ? "Running" : "Run now"}</span>
                    </button>

                    <button
                      type="button"
                      role="switch"
                      className="ui-agsc__switch"
                      aria-checked={on}
                      aria-labelledby={nameId}
                      onClick={() => toggle(trigger, !on)}
                    >
                      <span className="ui-agsc__track" aria-hidden="true">
                        <span className="ui-agsc__knob">{on ? <TickMark /> : null}</span>
                      </span>
                    </button>
                  </span>
                </div>

                <span
                  className="ui-agsc__sweep"
                  aria-hidden="true"
                  ref={(node) => {
                    if (node) sweeps.current.set(trigger.id, node);
                    else sweeps.current.delete(trigger.id);
                  }}
                />
              </li>
            );
          })}
        </ol>
      )}

      <p className="ui-agsc__sr" role="status" aria-live="polite">
        {note}
      </p>
    </div>
  );
}

/* ---------- Reading the clock ---------- */

/** The next time a trigger is due, worked out from its own timestamps.
 *  A cadence that has come due rolls forward in whole `everyMs` steps, so the answer stays right
 *  after a tab has been asleep, and it is never a value that has been counted down. */
export function nextOccurrence(trigger: AgentTrigger, clock: number): number | undefined {
  const base = trigger.nextRunAt;
  if (base === undefined) return undefined;
  const every = trigger.everyMs;
  if (!every || every <= 0 || clock <= base) return base;
  return base + Math.ceil((clock - base) / every) * every;
}

/** "in 4m 12s", "in 3h 41m", "in 6d 3h". Two units at most, so the line stays steady. */
function formatCountdown(target: number, clock: number): string {
  const left = target - clock;
  if (left <= 0) return "due now";
  const total = Math.ceil(left / 1000);
  if (total < 60) return `in ${total}s`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes < 60) return seconds > 0 ? `in ${minutes}m ${seconds}s` : `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest > 0 ? `in ${hours}h ${rest}m` : `in ${hours}h`;
  const days = Math.floor(hours / 24);
  const remain = hours % 24;
  return remain > 0 ? `in ${days}d ${remain}h` : `in ${days}d`;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The wall-clock time of a run, with the day only when it is not today. */
function formatClock(at: number, clock: number): string {
  const when = new Date(at);
  const hours = String(when.getHours()).padStart(2, "0");
  const minutes = String(when.getMinutes()).padStart(2, "0");
  const today = new Date(clock).toDateString() === when.toDateString();
  return today ? `${hours}:${minutes}` : `${DAY_NAMES[when.getDay()]} ${hours}:${minutes}`;
}

const ago = (at: number, clock: number) => {
  const seconds = Math.max(1, Math.round((clock - at) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const formatSpan = (ms: number) => (ms < 1000 ? `${Math.round(ms)}ms` : `${Math.round(ms / 100) / 10}s`);

/** A duration knob is read off the element so the sweep and the sheet cannot drift apart. */
function readMs(host: HTMLElement, name: string, fallback: number): number {
  const raw = getComputedStyle(host).getPropertyValue(name).trim();
  const value = raw.endsWith("ms")
    ? Number.parseFloat(raw)
    : raw.endsWith("s")
      ? Number.parseFloat(raw) * 1000
      : Number.NaN;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/* ---------- Marks ---------- */

const WakeMark = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="3.4" cy="8" r="1.6" fill="currentColor" />
    <path d="M6.4 4.9a4.4 4.4 0 0 1 0 6.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M9.6 2.6a8.2 8.2 0 0 1 0 10.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const CadenceMark = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M13.4 5.1A5.6 5.6 0 1 0 13.6 9.4"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
    <path d="M13.6 2.4v2.8h-2.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ArrivalMark = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2.2 8h6.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M7.4 5.4 10 8l-2.6 2.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12.8 3.4v9.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const DoneMark = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="5.7" stroke="currentColor" strokeWidth="1.3" />
    <path d="M5.5 8.2 7.2 9.9l3.4-3.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BrokenMark = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 2.3 14.6 13.4H1.4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M8 6.6v2.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <circle cx="8" cy="11.4" r="0.6" fill="currentColor" />
  </svg>
);

const IdleMark = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="5.7" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2.2 2.6" />
  </svg>
);

const HoldMark = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M6.3 4.6v6.8M9.7 4.6v6.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const BlockedMark = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="5.7" stroke="currentColor" strokeWidth="1.3" />
    <path d="M4.3 11.7 11.7 4.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const PlayMark = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M6.2 4.4 11.6 8l-5.4 3.6z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

const TurnMark = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 2.7a5.3 5.3 0 0 1 5.3 5.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M8 13.3A5.3 5.3 0 0 1 2.7 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const TickMark = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M5.4 8.2 7.1 9.9l3.5-3.9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const css = /* css */ `
.ui-agsc {
  /* Knobs. A consumer overrides any of these on .ui-agsc { ... }. Each one prefers the document
     token and falls back to the literal, so the schedule is also correct in a host that loads no
     token sheet at all. */
  --ui-agsc-ink: var(--text, #f4ece4);
  --ui-agsc-muted: var(--text-muted, #a2958a);
  --ui-agsc-subtle: var(--text-subtle, #f4ece48c);
  --ui-agsc-panel: var(--panel, #1a1512);
  --ui-agsc-card: var(--card, #201a15);
  --ui-agsc-raise: var(--preview, #26201a);
  --ui-agsc-wash: var(--hover-bg, #ffffff12);
  --ui-agsc-line: var(--border, #33291f);
  --ui-agsc-line-soft: var(--border-soft, #ffffff12);
  --ui-agsc-accent: var(--accent, #ff6b35);
  --ui-agsc-accent-soft: var(--accent-soft, #ff6b3524);
  --ui-agsc-accent-fg: var(--accent-fg, #1a0f08);
  --ui-agsc-ok: var(--success, #4f9d6e);
  --ui-agsc-danger: var(--danger, #e2544a);
  --ui-agsc-font: var(--font-sans, "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  --ui-agsc-mono: var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace);
  --ui-agsc-panel-radius: var(--radius-panel, 20px);
  --ui-agsc-radius: var(--radius-card, 16px);
  --ui-agsc-chip-radius: var(--radius-preview, 12px);
  --ui-agsc-pill: var(--radius-pill, 999px);
  --ui-agsc-shadow: var(--shadow-card, 0 1px 1.5px #0000004d, inset 0 -1px 0 #ffffff0a);
  --ui-agsc-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-agsc-ease-in: var(--nm-ease-in, cubic-bezier(0.55, 0, 0.68, 0.19));
  --ui-agsc-ease-soft: var(--nm-ease-soft, cubic-bezier(0.4, 0, 0.2, 1));
  --ui-agsc-spring: var(--nm-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  --ui-agsc-stagger: var(--nm-stagger, 45ms);
  --ui-agsc-tap: var(--nm-dur-1, 90ms);
  --ui-agsc-hover: var(--nm-dur-2, 160ms);
  --ui-agsc-enter: var(--nm-dur-3, 240ms);
  --ui-agsc-run: var(--nm-dur-5, 620ms);
  --ui-agsc-breathe: var(--nm-dur-6, 1100ms);

  container-type: inline-size;
  container-name: ui-agsc;
  position: relative;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  font-family: var(--ui-agsc-font);
  font-size: 13px;
  line-height: 20px;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
  color: var(--ui-agsc-ink);
  text-align: left;
}
.ui-agsc *,
.ui-agsc *::before,
.ui-agsc *::after {
  box-sizing: border-box;
}
:where(.ui-agsc) button {
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
.ui-agsc button:focus-visible {
  outline: 2px solid var(--ui-agsc-accent);
  outline-offset: 2px;
}
.ui-agsc ol {
  margin: 0;
  padding: 0;
  list-style: none;
}
.ui-agsc svg {
  display: block;
  flex: none;
}
.ui-agsc__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* ---------- Bar ---------- */

.ui-agsc__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  min-width: 0;
  margin-bottom: 12px;
}
.ui-agsc__mark {
  display: grid;
  flex: none;
  place-items: center;
  width: 16px;
  height: 16px;
  color: var(--ui-agsc-accent);
}
.ui-agsc__title {
  flex: none;
  font-weight: 500;
  color: var(--ui-agsc-ink);
}
.ui-agsc__agent {
  min-width: 0;
  overflow: hidden;
  color: var(--ui-agsc-muted);
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-agsc__sum {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-left: auto;
  font-size: 12px;
  line-height: 16px;
  color: var(--ui-agsc-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.ui-agsc__sum b {
  font-weight: 500;
  color: var(--ui-agsc-ink);
}

/* ---------- Rows ---------- */

.ui-agsc__panel {
  display: grid;
  gap: 2px;
  padding: 6px;
  border-radius: var(--ui-agsc-panel-radius);
  background: var(--ui-agsc-panel);
  box-shadow: var(--ui-agsc-shadow), inset 0 0 0 1px var(--ui-agsc-line-soft);
}
.ui-agsc__row {
  position: relative;
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  column-gap: 12px;
  align-items: start;
  padding: 10px 12px 11px;
  border-radius: var(--ui-agsc-radius);
  background: var(--ui-agsc-card);
  box-shadow: inset 0 0 0 1px var(--ui-agsc-line-soft);
  transition: background-color var(--ui-agsc-hover) var(--ui-agsc-ease-soft), box-shadow var(--ui-agsc-hover) var(--ui-agsc-ease-soft);
  animation: ui-agsc-in var(--ui-agsc-enter) var(--ui-agsc-ease-out) calc(var(--i, 0) * var(--ui-agsc-stagger)) backwards;
}
.ui-agsc__row[data-running] {
  background: var(--ui-agsc-raise);
  box-shadow: inset 0 0 0 1px var(--ui-agsc-accent-soft);
}
.ui-agsc__empty {
  margin: 0;
  padding: 18px 14px;
  border-radius: var(--ui-agsc-panel-radius);
  background: var(--ui-agsc-panel);
  box-shadow: var(--ui-agsc-shadow), inset 0 0 0 1px var(--ui-agsc-line-soft);
  color: var(--ui-agsc-muted);
}

/* The kind badge carries no colour of its own: the two kinds differ by the shape of the mark and
   the shape of its tile, so the difference survives a greyscale render. */
.ui-agsc__kind {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  background: var(--ui-agsc-raise);
  box-shadow: inset 0 0 0 1px var(--ui-agsc-line-soft);
  color: var(--ui-agsc-muted);
}
.ui-agsc__kind svg {
  width: 14px;
  height: 14px;
}
.ui-agsc__row[data-kind="event"] .ui-agsc__kind {
  border-radius: var(--ui-agsc-pill);
}

.ui-agsc__body {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.ui-agsc__line {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.ui-agsc__name {
  min-width: 0;
  overflow: hidden;
  font-weight: 500;
  color: var(--ui-agsc-ink);
  white-space: nowrap;
  text-overflow: ellipsis;
  transition: color var(--ui-agsc-hover) var(--ui-agsc-ease-soft);
}
.ui-agsc__row[data-on="off"] .ui-agsc__name {
  color: var(--ui-agsc-muted);
}
.ui-agsc__tag {
  flex: none;
  padding: 0 7px 1px;
  border-radius: var(--ui-agsc-pill);
  background: var(--ui-agsc-wash);
  color: var(--ui-agsc-muted);
  font-size: 11.5px;
  line-height: 16px;
  white-space: nowrap;
}
.ui-agsc__spec {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px 8px;
  min-width: 0;
  font-size: 12px;
  line-height: 16px;
  color: var(--ui-agsc-muted);
}
.ui-agsc__cadence {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-agsc__expr {
  flex: none;
  max-width: 100%;
  overflow: hidden;
  padding: 0 6px 1px;
  border-radius: var(--ui-agsc-chip-radius);
  background: var(--ui-agsc-raise);
  color: var(--ui-agsc-muted);
  font-family: var(--ui-agsc-mono);
  font-size: 11.5px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-agsc__code {
  color: var(--ui-agsc-ink);
  font-family: var(--ui-agsc-mono);
  font-size: 12px;
}
.ui-agsc__why {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--ui-agsc-muted);
  font-size: 11.5px;
  line-height: 16px;
}
.ui-agsc__why svg {
  width: 13px;
  height: 13px;
}
.ui-agsc__why-text {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ui-agsc__end {
  display: grid;
  justify-items: end;
  gap: 2px;
  min-width: 0;
}
.ui-agsc__when {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11.5px;
  line-height: 16px;
  color: var(--ui-agsc-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.ui-agsc__out {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.ui-agsc__out svg {
  width: 13px;
  height: 13px;
}
.ui-agsc__out b {
  font-weight: 500;
  color: var(--ui-agsc-ink);
}
.ui-agsc__out[data-outcome="ok"],
.ui-agsc__out[data-outcome="ok"] b {
  color: var(--ui-agsc-ok);
}
.ui-agsc__out[data-outcome="failed"],
.ui-agsc__out[data-outcome="failed"] b {
  color: var(--ui-agsc-danger);
}
.ui-agsc__ago {
  color: var(--ui-agsc-muted);
}
.ui-agsc__detail {
  max-width: 300px;
  overflow: hidden;
  color: var(--ui-agsc-muted);
  font-size: 11.5px;
  line-height: 16px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-agsc__slot {
  display: grid;
  justify-items: end;
  min-width: 0;
}
.ui-agsc__next {
  grid-area: 1 / 1;
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  color: var(--ui-agsc-muted);
  font-size: 11.5px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  opacity: 1;
  transform: none;
  transition: opacity var(--ui-agsc-enter) var(--ui-agsc-ease-out), transform var(--ui-agsc-enter) var(--ui-agsc-ease-out);
}
.ui-agsc__next b {
  font-weight: 500;
  color: var(--ui-agsc-ink);
}
.ui-agsc__halt {
  grid-area: 1 / 1;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--ui-agsc-muted);
  font-size: 11.5px;
  line-height: 16px;
  white-space: nowrap;
  opacity: 0;
  transform: translateY(3px);
  transition: opacity var(--ui-agsc-hover) var(--ui-agsc-ease-in), transform var(--ui-agsc-hover) var(--ui-agsc-ease-in);
}
.ui-agsc__halt svg {
  width: 13px;
  height: 13px;
}
.ui-agsc__row[data-on="off"] .ui-agsc__next {
  opacity: 0;
  transform: translateY(-3px);
  transition: opacity var(--ui-agsc-hover) var(--ui-agsc-ease-in), transform var(--ui-agsc-hover) var(--ui-agsc-ease-in);
}
.ui-agsc__row[data-on="off"] .ui-agsc__halt {
  opacity: 1;
  transform: none;
  transition: opacity var(--ui-agsc-enter) var(--ui-agsc-ease-out), transform var(--ui-agsc-enter) var(--ui-agsc-ease-out);
}

.ui-agsc__acts {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 3px;
}
.ui-agsc__run {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px 0 9px;
  border-radius: var(--ui-agsc-chip-radius);
  background: var(--ui-agsc-raise);
  box-shadow: inset 0 0 0 1px var(--ui-agsc-line-soft);
  color: var(--ui-agsc-ink);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  transition: background-color var(--ui-agsc-tap) var(--ui-agsc-ease-out), color var(--ui-agsc-tap) var(--ui-agsc-ease-out);
}
.ui-agsc__run svg {
  width: 12px;
  height: 12px;
}
.ui-agsc__run:not([aria-disabled="true"]):hover {
  background: var(--ui-agsc-wash);
}
.ui-agsc__run[aria-disabled="true"]:not([data-running]) {
  color: var(--ui-agsc-subtle);
  cursor: not-allowed;
}
.ui-agsc__run[data-running] {
  color: var(--ui-agsc-accent);
}
.ui-agsc__run[data-running] svg {
  animation: ui-agsc-turn var(--ui-agsc-breathe) linear infinite;
}
.ui-agsc__switch {
  display: grid;
  flex: none;
  place-items: center;
  width: 38px;
  height: 28px;
  border-radius: var(--ui-agsc-pill);
}
.ui-agsc__track {
  position: relative;
  width: 34px;
  height: 20px;
  border-radius: var(--ui-agsc-pill);
  background: var(--ui-agsc-raise);
  box-shadow: inset 0 0 0 1px var(--ui-agsc-line);
  transition: background-color var(--ui-agsc-hover) var(--ui-agsc-ease-out), box-shadow var(--ui-agsc-hover) var(--ui-agsc-ease-out);
}
.ui-agsc__knob {
  position: absolute;
  top: 2px;
  left: 2px;
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--ui-agsc-muted);
  color: var(--ui-agsc-accent-fg);
  transition: transform var(--ui-agsc-hover) var(--ui-agsc-spring), background-color var(--ui-agsc-hover) var(--ui-agsc-ease-out);
}
.ui-agsc__knob svg {
  width: 11px;
  height: 11px;
}
.ui-agsc__switch[aria-checked="true"] .ui-agsc__track {
  background: var(--ui-agsc-accent-soft);
  box-shadow: inset 0 0 0 1px var(--ui-agsc-accent);
}
.ui-agsc__switch[aria-checked="true"] .ui-agsc__knob {
  transform: translateX(14px);
  background: var(--ui-agsc-accent);
}

/* The run in flight draws on the row's own bottom edge, so the row never changes height. */
.ui-agsc__sweep {
  position: absolute;
  right: 14px;
  bottom: 5px;
  left: 14px;
  height: 2px;
  border-radius: 2px;
  background: var(--ui-agsc-accent);
  transform: scaleX(var(--ui-agsc-p, 0));
  transform-origin: left center;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--ui-agsc-hover) var(--ui-agsc-ease-in);
}
.ui-agsc__row[data-running] .ui-agsc__sweep {
  opacity: 1;
  box-shadow: 0 0 10px var(--ui-agsc-accent-soft);
  transition: opacity var(--ui-agsc-tap) var(--ui-agsc-ease-out);
}

@keyframes ui-agsc-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}
@keyframes ui-agsc-turn {
  to {
    transform: rotate(360deg);
  }
}

@container ui-agsc (max-width: 620px) {
  .ui-agsc__row {
    grid-template-columns: 24px minmax(0, 1fr);
    row-gap: 8px;
  }
  .ui-agsc__end {
    grid-column: 1 / -1;
    justify-items: start;
    padding-left: 36px;
  }
  .ui-agsc__slot {
    justify-items: start;
  }
  .ui-agsc__detail {
    max-width: 100%;
  }
}
@container ui-agsc (max-width: 460px) {
  .ui-agsc__sum {
    flex-basis: 100%;
    justify-content: space-between;
    margin-left: 0;
  }
  .ui-agsc__row {
    padding: 10px 11px 11px;
  }
  .ui-agsc__line {
    flex-wrap: wrap;
  }
}

:where(.dark, [data-theme="dark"]) .ui-agsc {
  --ui-agsc-ink: #f4ece4;
  --ui-agsc-muted: #a2958a;
  --ui-agsc-subtle: #f4ece48c;
  --ui-agsc-panel: #1a1512;
  --ui-agsc-card: #201a15;
  --ui-agsc-raise: #26201a;
  --ui-agsc-wash: #ffffff12;
  --ui-agsc-line: #33291f;
  --ui-agsc-line-soft: #ffffff12;
  --ui-agsc-accent: #ff6b35;
  --ui-agsc-accent-soft: #ff6b3524;
  --ui-agsc-accent-fg: #1a0f08;
  --ui-agsc-ok: #4f9d6e;
  --ui-agsc-danger: #e2544a;
}

@media (prefers-reduced-motion: reduce) {
  .ui-agsc *,
  .ui-agsc *::before,
  .ui-agsc *::after {
    animation: none;
    transition-duration: 1ms;
  }
  .ui-agsc__next,
  .ui-agsc__halt,
  .ui-agsc__run,
  .ui-agsc__knob,
  .ui-agsc__track,
  .ui-agsc__row[data-on="off"] .ui-agsc__next,
  .ui-agsc__row[data-on="off"] .ui-agsc__halt {
    transition-duration: 1ms;
  }
  .ui-agsc__row[data-running] .ui-agsc__run svg {
    animation: none;
  }
  /* The sweep is a moving line, so it goes; the row keeps its running ring and its word. */
  .ui-agsc__row[data-running] .ui-agsc__sweep {
    display: none;
  }
}
`;