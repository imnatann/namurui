"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

/**
 * Agent Steering — the plan an agent is running, plus a field that steers it while it runs.
 *
 * A note typed into the field waits in the queue; when the agent starts the next step it picks
 * the queue up, so the note glides into that step and flashes the `ui-stc-land` highlight.
 * Ctrl/⌘ + Enter (or the queue chip's “Now”) interrupts instead: the note lands on the step that
 * is running this second, and the run is held for a human. The header shows the run clock, the
 * pause/resume control, and the spark that turns amber when held and green when finished.
 */

/** A note that has already been handed to a step. */
export type SteerLandedNote = {
  id: string;
  text: string;
  /** `"next"` was queued and picked up at the start of the step; `"now"` interrupted the run. */
  picked?: "next" | "now";
  /** Just landed — replays the 1400ms highlight. Clear it when the animation has played. */
  landed?: boolean;
};

export type SteerStepStatus = "done" | "active" | "pending";

export type SteerStep = {
  id: string;
  title: string;
  status: SteerStepStatus;
  /** How long the step took, e.g. `"1.4s"`. Pending steps leave it out. */
  time?: string;
  /** Notes the agent has taken in for this step, oldest first. */
  notes?: SteerLandedNote[];
};

/** A note waiting for the next step. */
export type SteerNote = {
  id: string;
  text: string;
};

export type SteerStatus = "running" | "paused" | "done";

export type AgentSteeringProps = {
  /** The plan, top to bottom. One step should be `"active"` while the run is going. */
  steps: SteerStep[];
  /** Notes waiting for the next step — they glide into the step that picks them up. */
  queue?: SteerNote[];
  /** Enter or the send button: queue `text` for the next step. */
  onSteer?: (text: string) => void;
  /**
   * Ctrl/⌘ + Enter, or a chip's “Now”: hand the note to the current step immediately.
   * `noteId` is the queued chip that was pulled in, when the interruption came from the queue.
   */
  onInterrupt?: (text: string, noteId?: string) => void;
  /** The chip's dismiss button. Omit it and the queue cannot be edited. */
  onRemove?: (noteId: string) => void;
  onPause?: () => void;
  onResume?: () => void;
  status?: SteerStatus;
  title?: string;
  agent?: string;
  /** Epoch ms the run started; the state pill counts from here while running. Defaults to mount. */
  startedAt?: number;
  /** Controlled draft. Leave it out to let the field keep its own text. */
  draft?: string;
  onDraftChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function AgentSteering({
  steps,
  queue = [],
  onSteer,
  onInterrupt,
  onRemove,
  onPause,
  onResume,
  status = "running",
  title = "Migrate users table",
  agent = "Opus 5.5",
  startedAt,
  draft,
  onDraftChange,
  placeholder = "Steer the agent…",
  className,
}: AgentSteeringProps) {
  const uid = useId();
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [mountedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [innerDraft, setInnerDraft] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const value = draft ?? innerDraft;
  const held = status === "done";
  const activeIndex = steps.findIndex((step) => step.status === "active");
  const position =
    steps.length === 0 ? 0 : (activeIndex >= 0 ? activeIndex : steps.length - 1) + 1;
  const seconds = Math.max(0, Math.floor((now - (startedAt ?? mountedAt)) / 1000));
  const minutes = Math.floor(seconds / 60);
  const elapsedText =
    minutes > 0 ? `${minutes}m ${String(seconds % 60).padStart(2, "0")}s` : `${seconds}s`;

  /* The clock only ticks while the run is going; a held run keeps the last reading. */
  useEffect(() => {
    if (status !== "running") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  /* The field is one row that grows with the note, up to four rows. */
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = "auto";
    area.style.height = `${Math.min(96, Math.max(20, area.scrollHeight))}px`;
  }, [value]);

  const steer = () => {
    const text = value.trim();
    if (!text || held || !onSteer) return;
    onSteer(text);
    setAnnouncement(`Queued “${text}” for the next step.`);
    if (draft === undefined) setInnerDraft("");
  };

  const interrupt = (text: string, noteId?: string) => {
    if (held || !onInterrupt) return;
    const note = text.trim();
    onInterrupt(note, noteId);
    setAnnouncement(note ? `Sent “${note}” to the running step now.` : "Interrupted the run.");
    if (noteId === undefined && draft === undefined) setInnerDraft("");
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    if (event.metaKey || event.ctrlKey) {
      if (!onInterrupt) return;
      event.preventDefault();
      interrupt(value);
      return;
    }
    if (event.shiftKey || !onSteer) return;
    event.preventDefault();
    steer();
  };

  const toggle = status === "running" ? onPause : onResume;
  const toggleLabel =
    status === "running"
      ? "Pause the run"
      : status === "paused"
        ? "Resume the run"
        : "Restart the run";
  const toggleTitle = status === "running" ? "Pause" : status === "paused" ? "Resume" : "Restart";

  return (
    <div
      className={["ui-stc", className].filter(Boolean).join(" ")}
      data-status={status}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-agent-steering" precedence="default">
        {css}
      </style>

      <div className="ui-stc__card">
        <header className="ui-stc__head">
          <span className="ui-stc__spark">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M7 1.2c.4 2.9 1.9 4.4 4.8 4.8-2.9.4-4.4 1.9-4.8 4.8C6.6 7.9 5.1 6.4 2.2 6 5.1 5.6 6.6 4.1 7 1.2Z"
                fill="currentColor"
              />
              <circle cx="11.6" cy="11.4" r="1.1" fill="currentColor" opacity="0.55" />
            </svg>
          </span>

          <div className="ui-stc__heading">
            <span className="ui-stc__title">{title}</span>
            <span className="ui-stc__sub">
              {agent}
              <span className="ui-stc__dot" aria-hidden="true">
                ·
              </span>
              Step {position} of {steps.length}
            </span>
          </div>

          <span className="ui-stc__state" data-status={status}>
            <span className="ui-stc__pulse" aria-hidden="true" />
            {status === "running" ? "Running" : status === "paused" ? "Paused" : "Done"} ·{" "}
            {elapsedText}
          </span>

          {toggle && (
            <button
              type="button"
              className="ui-stc__icon-btn"
              aria-label={toggleLabel}
              title={toggleTitle}
              onClick={toggle}
            >
              {status === "running" ? <PauseMark /> : <PlayMark />}
            </button>
          )}
        </header>

        <ol className="ui-stc__plan" aria-label="Plan">
          {steps.map((step) => (
            <li
              key={step.id}
              className="ui-stc__step"
              data-status={step.status}
              aria-current={step.status === "active" ? "step" : undefined}
            >
              <div className="ui-stc__step-row">
                <span className="ui-stc__step-icon" data-status={step.status} aria-hidden="true">
                  {step.status === "done" ? (
                    <DoneMark />
                  ) : step.status === "active" ? (
                    <ActiveMark />
                  ) : (
                    <PendingMark />
                  )}
                </span>
                <span className="ui-stc__step-title">{step.title}</span>
                <span className="ui-stc__step-time">{step.time}</span>
              </div>

              {step.notes?.map((note) => (
                <div
                  key={note.id}
                  className="ui-stc__note"
                  data-landed={note.landed ? "" : undefined}
                >
                  <NoteMark />
                  <span className="ui-stc__note-text">{note.text}</span>
                  <span className="ui-stc__note-tag">
                    <TagMark />
                    {note.picked === "now" ? "Now" : "Picked up"}
                  </span>
                </div>
              ))}
            </li>
          ))}
        </ol>

        {queue.length > 0 && (
          <div className="ui-stc__queue">
            <div className="ui-stc__label">
              Queued<span>{queue.length}</span>
            </div>
            <div className="ui-stc__queued">
              {queue.map((note) => (
                <div key={note.id} className="ui-stc__chip">
                  <span className="ui-stc__chip-text">{note.text}</span>
                  {onInterrupt && (
                    <button
                      type="button"
                      className="ui-stc__chip-btn"
                      aria-label={`Apply “${note.text}” now`}
                      onClick={() => interrupt(note.text, note.id)}
                    >
                      <NowMark />
                      Now
                    </button>
                  )}
                  {onRemove && (
                    <button
                      type="button"
                      className="ui-stc__chip-x"
                      aria-label={`Remove “${note.text}”`}
                      onClick={() => onRemove(note.id)}
                    >
                      <CloseMark />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="ui-stc__compose" data-disabled={held ? "" : undefined}>
          <div className="ui-stc__field">
            <textarea
              id={`${uid}-field`}
              ref={areaRef}
              rows={1}
              value={value}
              placeholder={placeholder}
              aria-label="Steer the agent"
              aria-describedby={`${uid}-hint`}
              style={{ height: 20 }}
              disabled={held}
              onChange={(event) => {
                setInnerDraft(event.target.value);
                onDraftChange?.(event.target.value);
              }}
              onKeyDown={onKeyDown}
            />
            <button
              type="button"
              className="ui-stc__send"
              aria-label="Queue for the next step"
              disabled={held || !onSteer || value.trim() === ""}
              onClick={steer}
            >
              <SendMark />
            </button>
          </div>
          <div className="ui-stc__hint" id={`${uid}-hint`}>
            <span>
              <kbd>↵</kbd> next step
            </span>
            <span>
              <kbd>Ctrl</kbd>
              <kbd>↵</kbd> interrupt now
            </span>
          </div>
        </div>
      </div>

      <span className="ui-stc__sr" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}

const PauseMark = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <rect x="4.2" y="3.4" width="2.6" height="9.2" rx="0.9" fill="currentColor" />
    <rect x="9.2" y="3.4" width="2.6" height="9.2" rx="0.9" fill="currentColor" />
  </svg>
);

const PlayMark = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M5.8 3.4 12.2 8l-6.4 4.6z" fill="currentColor" />
  </svg>
);

const DoneMark = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <circle cx="8" cy="8" r="6.5" fill="currentColor" />
    <path
      d="m5.4 8.2 1.8 1.8 3.4-3.7"
      fill="none"
      stroke="#fff"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ActiveMark = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <circle
      cx="8"
      cy="8"
      r="5.8"
      fill="none"
      stroke="currentColor"
      strokeOpacity="0.2"
      strokeWidth="1.6"
    />
    <path
      d="M8 2.2a5.8 5.8 0 0 1 5.8 5.8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const PendingMark = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <circle
      cx="8"
      cy="8"
      r="5.8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeDasharray="2 2.2"
    />
  </svg>
);

/** A note that came from the person watching: a corner arrow into the step. */
const NoteMark = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
    <path
      d="M3 1.6v4a1.9 1.9 0 0 0 1.9 1.9h4.3M7.4 5.6 9.2 7.5 7.4 9.4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TagMark = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
    <path
      d="M1.9 5.2 4 7.3 8.2 2.9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const NowMark = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
    <path d="M3.4 2.4 8.2 6l-4.8 3.6z" fill="currentColor" />
  </svg>
);

const CloseMark = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
    <path
      d="M3.2 3.2 8.8 8.8M8.8 3.2 3.2 8.8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
);

const SendMark = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path
      d="M8 12.6V3.6M4.2 7.2 8 3.4l3.8 3.8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const css = /* css */ `
.ui-stc{--ui-stc-card: #fffdfb;--ui-stc-strong: #0b0908;--ui-stc-ink: rgba(11, 9, 8, 0.88);--ui-stc-text: rgba(11, 9, 8, 0.61);--ui-stc-muted: rgba(11, 9, 8, 0.45);--ui-stc-faint: rgba(11, 9, 8, 0.27);--ui-stc-icon: rgba(11, 9, 8, 0.447);--ui-stc-line: rgba(11, 9, 8, 0.06);--ui-stc-rail: rgba(11, 9, 8, 0.15);--ui-stc-wash: rgba(11, 9, 8, 0.03);--ui-stc-fill: rgba(11, 9, 8, 0.06);--ui-stc-solid: rgba(11, 9, 8, 0.88);--ui-stc-on-solid: #fcf9f7;--ui-stc-accent: rgba(217, 84, 31, 0.765);--ui-stc-accent-bg: rgba(217, 84, 31, 0.06);--ui-stc-amber: #d99530;--ui-stc-green: #2f8d5c;--ui-stc-focus: rgba(217, 84, 31, 0.35);--ui-stc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-stc-ease: cubic-bezier(0.32, 0.72, 0.24, 1);position: relative;box-sizing: border-box;width: 100%;max-width: 460px;container-type: inline-size;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;font-weight: 400;line-height: 20px;color: var(--ui-stc-text);text-align: left;-webkit-font-smoothing: antialiased}
.ui-stc *, .ui-stc *::before, .ui-stc *::after{box-sizing: border-box}
:where(.ui-stc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;text-align: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-stc button:focus-visible{outline: 2px solid var(--ui-stc-focus);outline-offset: 1px}
.ui-stc ol, .ui-stc ul{margin: 0;padding: 0;list-style: none}
.ui-stc svg{display: block;flex: none}
.ui-stc__sr{position: absolute;width: 1px;height: 1px;overflow: hidden;clip-path: inset(50%);white-space: nowrap}
.ui-stc__card{overflow: hidden;border-radius: 10px;background: var(--ui-stc-card);box-shadow: var(--ui-stc-shadow)}
.ui-stc__head{display: flex;align-items: center;gap: 10px;min-width: 0;padding: 12px 12px 12px 14px}
.ui-stc__spark{display: grid;flex: none;place-items: center;width: 16px;color: var(--ui-stc-accent)}
.ui-stc[data-status="paused"] .ui-stc__spark{color: var(--ui-stc-amber)}
.ui-stc[data-status="done"] .ui-stc__spark{color: var(--ui-stc-green)}
.ui-stc__heading{display: grid;flex: 1;min-width: 0}
.ui-stc__title{overflow: hidden;font-weight: 500;color: var(--ui-stc-strong);white-space: nowrap;text-overflow: ellipsis}
.ui-stc__sub{overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-stc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-stc__dot{margin: 0 6px;color: var(--ui-stc-faint)}
.ui-stc__state{display: inline-flex;flex: none;align-items: center;gap: 7px;font-size: 12px;line-height: 16px;color: var(--ui-stc-text);white-space: nowrap;font-variant-numeric: tabular-nums}
.ui-stc__pulse{position: relative;width: 6px;height: 6px;border-radius: 50%;background: var(--ui-stc-accent)}
.ui-stc__pulse::after{content: "";position: absolute;inset: -3px;border-radius: 50%;background: var(--ui-stc-accent);opacity: 0;animation: ui-stc-pulse var(--nm-dur-6, 1100ms) ease-out infinite}
.ui-stc__state[data-status="paused"] .ui-stc__pulse{background: var(--ui-stc-amber)}
.ui-stc__state[data-status="done"] .ui-stc__pulse{background: var(--ui-stc-green)}
.ui-stc__state:not([data-status="running"]) .ui-stc__pulse::after{display: none}
.ui-stc__icon-btn{display: grid;flex: none;place-items: center;width: 28px;height: 28px;border-radius: 6px;background: var(--ui-stc-card);box-shadow: var(--ui-stc-shadow);color: var(--ui-stc-icon);transition: color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-stc__icon-btn:hover{color: var(--ui-stc-ink);background: var(--ui-stc-wash)}
.ui-stc__plan{display: grid;grid-template-columns: minmax(0, 1fr);padding: 10px 14px 12px !important;border-top: 0.5px solid var(--ui-stc-line)}
.ui-stc__step{position: relative;padding: 5px 0}
.ui-stc__step:not(:last-child)::after{content: "";position: absolute;top: 25px;bottom: -3px;left: 7.5px;width: 0.5px;background: var(--ui-stc-rail)}
.ui-stc__step-row{display: flex;align-items: center;gap: 10px;min-width: 0}
.ui-stc__step-icon{display: grid;flex: none;place-items: center;width: 16px;height: 16px;color: var(--ui-stc-faint)}
.ui-stc__step-icon[data-status="done"]{color: var(--ui-stc-accent);animation: ui-stc-pop var(--nm-dur-4, 380ms) var(--ui-stc-ease) both}
.ui-stc__step-icon[data-status="active"]{color: var(--ui-stc-accent)}
.ui-stc__step-icon[data-status="active"] svg{animation: ui-stc-spin var(--nm-dur-6, 1100ms) linear infinite}
.ui-stc__step-title{flex: 1;min-width: 0;overflow: hidden;color: var(--ui-stc-ink);white-space: nowrap;text-overflow: ellipsis;transition: color 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-stc__step[data-status="done"] .ui-stc__step-title{color: var(--ui-stc-text)}
.ui-stc__step[data-status="pending"] .ui-stc__step-title{color: var(--ui-stc-muted)}
.ui-stc[data-status="running"] .ui-stc__step[data-status="active"] .ui-stc__step-title{font-weight: 500;background: linear-gradient(90deg, var(--ui-stc-ink) 0%, var(--ui-stc-ink) 40%, var(--ui-stc-faint) 50%, var(--ui-stc-ink) 60%, var(--ui-stc-ink) 100%) 0 0 / 300% 100%;-webkit-background-clip: text;background-clip: text;color: transparent;animation: ui-stc-shimmer var(--nm-dur-6, 1100ms) linear infinite}
.ui-stc__step[data-status="active"] .ui-stc__step-title{font-weight: 500}
.ui-stc__step-time{flex: none;font-size: 12px;color: var(--ui-stc-faint);font-variant-numeric: tabular-nums}
.ui-stc__note{display: flex;align-items: flex-start;gap: 6px;margin: 4px 0 2px 26px;padding: 4px 8px 4px 6px;border-radius: 6px;background: var(--ui-stc-wash);box-shadow: inset 0 0 0 0.5px var(--ui-stc-line);font-size: 12px;line-height: 16px;color: var(--ui-stc-ink)}
.ui-stc__note > svg{margin-top: 2px;color: var(--ui-stc-muted)}
.ui-stc__note-text{flex: 1;min-width: 0}
.ui-stc__note-tag{display: inline-flex;flex: none;align-items: center;gap: 3px;color: var(--ui-stc-accent);font-weight: 500;white-space: nowrap}
.ui-stc__note[data-landed]{animation: ui-stc-land var(--nm-dur-6, 1100ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-stc__queue{padding: 10px 12px 2px 14px;border-top: 0.5px solid var(--ui-stc-line)}
.ui-stc__label{display: flex;align-items: center;gap: 6px;margin-bottom: 6px;font-size: 10px;font-weight: 500;line-height: 16px;letter-spacing: 0.5px;text-transform: uppercase;color: var(--ui-stc-muted)}
.ui-stc__label span{display: grid;place-items: center;min-width: 16px;height: 16px;padding: 0 4px;border-radius: 4px;background: var(--ui-stc-fill);color: var(--ui-stc-text);letter-spacing: 0;font-variant-numeric: tabular-nums}
.ui-stc__queued{display: grid;gap: 6px}
.ui-stc__chip{position: relative;display: flex;align-items: center;gap: 6px;min-height: 32px;padding: 4px 4px 4px 10px;border-radius: 8px;background: var(--ui-stc-card);box-shadow: var(--ui-stc-shadow);color: var(--ui-stc-ink)}
.ui-stc__chip::before{content: "";position: absolute;top: 8px;bottom: 8px;left: 0;width: 2px;border-radius: 0 2px 2px 0;background: var(--ui-stc-accent)}
.ui-stc__chip-text{flex: 1;min-width: 0;font-size: 12.5px;line-height: 18px}
.ui-stc__chip-btn{display: inline-flex;flex: none;align-items: center;gap: 4px;height: 24px;padding: 0 8px 0 6px;border-radius: 6px;font-size: 12px;font-weight: 500;color: var(--ui-stc-text);transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-stc__chip-btn:hover{background: var(--ui-stc-accent-bg);color: var(--ui-stc-accent)}
.ui-stc__chip-x{display: grid;flex: none;place-items: center;width: 24px;height: 24px;border-radius: 6px;color: var(--ui-stc-faint);transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-stc__chip-x:hover{background: var(--ui-stc-wash);color: var(--ui-stc-ink)}
.ui-stc__compose{padding: 10px 12px 10px 14px;border-top: 0.5px solid var(--ui-stc-line)}
.ui-stc__field{display: flex;align-items: flex-end;gap: 8px;min-height: 36px;padding: 4px 4px 4px 10px;border-radius: 8px;background: var(--ui-stc-wash);box-shadow: inset 0 0 0 0.5px var(--ui-stc-line);cursor: text;transition: box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-stc__field:focus-within{background: var(--ui-stc-card);box-shadow: inset 0 0 0 0.5px var(--ui-stc-rail), 0 0 0 3px var(--ui-stc-accent-bg)}
.ui-stc__field textarea{flex: 1;min-width: 0;height: 20px;margin: 4px 0;padding: 0;border: 0;outline: none;background: none;font: inherit;color: var(--ui-stc-strong);resize: none}
.ui-stc__field textarea::placeholder{color: var(--ui-stc-muted)}
.ui-stc__field textarea:focus-visible{outline: none}
.ui-stc__send{display: grid;flex: none;place-items: center;width: 28px;height: 28px;border-radius: 6px;background: var(--ui-stc-solid);color: var(--ui-stc-on-solid);transition: opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-stc__send:disabled{opacity: 0.18;cursor: default}
.ui-stc__send:not(:disabled):active{transform: scale(0.94)}
.ui-stc__hint{display: flex;flex-wrap: wrap;align-items: center;gap: 4px 14px;margin-top: 8px;font-size: 12px;line-height: 16px;color: var(--ui-stc-muted)}
.ui-stc__hint > span{display: inline-flex;align-items: center;gap: 3px;white-space: nowrap}
.ui-stc kbd{display: inline-grid;place-items: center;min-width: 16px;height: 16px;padding: 0 3px;border-radius: 4px;background: var(--ui-stc-card);box-shadow: var(--ui-stc-shadow);font: inherit;font-size: 10px;color: var(--ui-stc-text)}
.ui-stc__compose[data-disabled] .ui-stc__field{opacity: 0.6;cursor: default}
@keyframes ui-stc-spin{to{transform: rotate(360deg)}
}
@keyframes ui-stc-pop{from{opacity: 0;transform: scale(0.6)}
}
@keyframes ui-stc-pulse{from{opacity: 0.45;transform: scale(0.6)}
to{opacity: 0;transform: scale(1.8)}
}
@keyframes ui-stc-shimmer{from{background-position: 100% 0}
to{background-position: 0 0}
}
@keyframes ui-stc-land{0%, 30%{background-color: var(--ui-stc-accent-bg);box-shadow: inset 0 0 0 0.5px var(--ui-stc-focus)}
}
@container (max-width: 380px){.ui-stc__head{display: grid;grid-template-columns: auto minmax(0, 1fr) auto;column-gap: 10px;row-gap: 8px}
.ui-stc__spark{grid-row: 1;align-self: center}
.ui-stc__heading{grid-column: 2;grid-row: 1}
.ui-stc__state{grid-column: 2;grid-row: 2;justify-self: start}
.ui-stc__head > .ui-stc__icon-btn{grid-column: 3;grid-row: 1}
.ui-stc__head{padding-left: 12px}
.ui-stc__plan, .ui-stc__queue, .ui-stc__compose{padding-left: 12px;padding-right: 12px}
}
@media (pointer: coarse){.ui-stc__icon-btn, .ui-stc__send{width: 34px;height: 34px}
.ui-stc__chip-btn, .ui-stc__chip-x{height: 30px}
.ui-stc__chip-x{width: 30px}
}
@media (prefers-reduced-motion: reduce){.ui-stc *, .ui-stc *::before, .ui-stc *::after{animation: none !important;transition: none !important}
.ui-stc[data-status="running"] .ui-stc__step[data-status="active"] .ui-stc__step-title{background: none;color: var(--ui-stc-ink)}
}
:where(.dark, [data-theme="dark"]) .ui-stc{--ui-stc-card: #211b16;--ui-stc-strong: #fffdfb;--ui-stc-ink: rgba(255, 253, 251, 0.9);--ui-stc-text: rgba(255, 253, 251, 0.62);--ui-stc-muted: rgba(255, 253, 251, 0.45);--ui-stc-faint: rgba(255, 253, 251, 0.28);--ui-stc-icon: rgba(255, 253, 251, 0.5);--ui-stc-line: rgba(255, 253, 251, 0.08);--ui-stc-rail: rgba(255, 253, 251, 0.16);--ui-stc-wash: rgba(255, 253, 251, 0.04);--ui-stc-fill: rgba(255, 253, 251, 0.08);--ui-stc-solid: rgba(255, 253, 251, 0.92);--ui-stc-on-solid: #1a1512;--ui-stc-accent: #ff8a5c;--ui-stc-accent-bg: rgba(255, 138, 92, 0.12);--ui-stc-amber: #e8b05c;--ui-stc-green: #2f8d5c;--ui-stc-focus: rgba(255, 138, 92, 0.45);--ui-stc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4)}
:where(.dark, [data-theme="dark"]) .ui-stc__step-icon[data-status="done"] path{stroke: #211b16}

`;
