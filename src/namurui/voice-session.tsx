"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/*
 * Voice Session: the live voice turn as the bridge reports it — one phase, the two audio
 * levels the protocol sends at most every 100 ms, and the transcript as it lands. Each
 * level is read straight from its prop into a scaleX transform, so the meters follow the
 * microphone instead of a waveform this component would have to invent, and the number
 * beside each one says the same thing in words. New transcript lines rise into place and
 * the list holds its bottom edge. Styles are injected below, so no extra files are needed.
 */

export type LivePhase = "connecting" | "listening" | "working" | "speaking" | "muted" | "error";

export type VoiceRole = "user" | "assistant";

export type VoiceCaption = {
  /** Who is speaking — `live_transcript.role` */
  role: VoiceRole;
  /** Turn the line belongs to, so a line keeps its identity while its text grows */
  turn: number;
  /** The words transcribed so far */
  text: string;
  /** True once the bridge has closed the line */
  final: boolean;
};

export type VoiceSessionProps = {
  /** What the session is doing — `live_phase`. Omit it and the component holds the phase
   * itself, which is enough for a caller that only needs the mute toggle. */
  phase?: LivePhase;
  /** Input RMS from 0 to 1 — `live_levels.input` */
  inputLevel?: number;
  /** Output RMS from 0 to 1 — `live_levels.output` */
  outputLevel?: number;
  /** Transcript lines in arrival order — `live_transcript` */
  captions?: readonly VoiceCaption[];
  /** Sends `live_mute`; omit it and the mute control is not rendered */
  onMute?: () => void;
  /** Sends `live_stop`; omit it and the stop control is not rendered */
  onStop?: () => void;
  /** Message from `live_end` when the session ended on an error */
  error?: string;
  /** Extra class on the root */
  className?: string;
};

const PHASE_WORD: Record<LivePhase, string> = {
  connecting: "Connecting",
  listening: "Listening",
  working: "Working",
  speaking: "Speaking",
  muted: "Muted",
  error: "Error",
};

const ROLE_WORD: Record<VoiceRole, string> = {
  user: "You",
  assistant: "OMP",
};

/* One glyph per phase, so the state reads as a shape before it reads as a word. */
const PHASE_GLYPH: Record<LivePhase, ReactNode> = {
  connecting: (
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4.6" strokeDasharray="2 2.6" />
    </svg>
  ),
  listening: (
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 2.3a1.9 1.9 0 0 1 1.9 1.9v2.6a1.9 1.9 0 0 1-3.8 0V4.2A1.9 1.9 0 0 1 7 2.3Z" />
      <path d="M4.1 6.7a2.9 2.9 0 0 0 5.8 0" />
      <path d="M7 9.6v2" />
    </svg>
  ),
  working: (
    <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden="true">
      <circle cx="3" cy="7" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="7" cy="7" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="11" cy="7" r="0.95" fill="currentColor" stroke="none" />
    </svg>
  ),
  speaking: (
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="3.2" cy="7" r="1.25" fill="currentColor" stroke="none" />
      <path d="M6.1 4.6a3.3 3.3 0 0 1 0 4.8" />
      <path d="M8.6 2.9a5.9 5.9 0 0 1 0 8.2" />
    </svg>
  ),
  muted: (
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 2.3a1.9 1.9 0 0 1 1.9 1.9v2.6a1.9 1.9 0 0 1-3.8 0V4.2A1.9 1.9 0 0 1 7 2.3Z" />
      <path d="M4.1 6.7a2.9 2.9 0 0 0 5.8 0" />
      <path d="M7 9.6v2" />
      <path d="M2.4 2.4 11.6 11.6" />
    </svg>
  ),
  error: (
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4.6" />
      <path d="M7 4.4v3.2" />
      <circle cx="7" cy="9.8" r="0.62" fill="currentColor" stroke="none" />
    </svg>
  ),
};

const STOP_GLYPH = (
  <svg viewBox="0 0 12 12" width="12" height="12" fill="none" aria-hidden="true">
    <rect x="3.1" y="3.1" width="5.8" height="5.8" rx="1.4" fill="currentColor" />
  </svg>
);

const WARN_GLYPH = (
  <svg
    viewBox="0 0 12 12"
    width="12"
    height="12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 1.9 11 10.4H1z" />
    <path d="M6 4.9v2.3" />
    <circle cx="6" cy="8.9" r="0.55" fill="currentColor" stroke="none" />
  </svg>
);

/* One channel of the bridge's level report. The fill is a full-width element scaled from
 * the left, so the bar tracks 100 ms frames without a width transition anywhere. A level
 * that arrives outside 0..1, or not at all, reads as silence rather than breaking the bar. */
function Meter({ label, level }: { label: string; level: number }) {
  const value = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
  const pct = Math.round(value * 100);
  return (
    <div className="ui-vss__meter">
      <div className="ui-vss__meter-head">
        <span className="ui-vss__label">{label}</span>
        <span className="ui-vss__pct">{pct}%</span>
      </div>
      <div
        className="ui-vss__track"
        role="meter"
        aria-label={`${label} level`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${pct} percent`}
      >
        <span className="ui-vss__ticks" aria-hidden="true" />
        <span className="ui-vss__fill" style={{ transform: `scaleX(${value})` }} />
      </div>
    </div>
  );
}

export function VoiceSession({
  phase: phaseProp,
  inputLevel = 0,
  outputLevel = 0,
  captions = [],
  onMute,
  onStop,
  error,
  className,
}: VoiceSessionProps) {
  const [ownPhase, setOwnPhase] = useState<LivePhase>("listening");
  const phase = phaseProp ?? ownPhase;
  const listRef = useRef<HTMLOListElement>(null);
  const pinnedRef = useRef(true);

  const live = phase === "listening" || phase === "speaking";
  const errorText =
    error ?? (phase === "error" ? "The session ended without a reason from the bridge." : undefined);

  /* The last line still open is the one being spoken. Everything before it is settled. */
  let liveIndex = -1;
  for (let index = captions.length - 1; index >= 0; index -= 1) {
    if (!captions[index].final) {
      liveIndex = index;
      break;
    }
  }

  const last = captions[captions.length - 1];
  const tail = last ? `${last.text.length}:${last.final ? 1 : 0}` : "0:0";

  /* The list holds its bottom edge, but only while the reader is already there: scrolling
   * up to re-read an earlier turn must not be undone by the next word. */
  useEffect(() => {
    const el = listRef.current;
    if (!el || !pinnedRef.current) return;
    const frame = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [captions.length, tail]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };

  const handleMute = () => {
    if (phaseProp === undefined) {
      setOwnPhase((current) => (current === "muted" ? "listening" : "muted"));
    }
    onMute?.();
  };

  const idle = phase === "connecting" || phase === "error";

  return (
    <div
      className={["ui-vss", className].filter(Boolean).join(" ")}
      data-state={phase}
      role="group"
      aria-label="Voice session"
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-voice-session" precedence="default">
        {css}
      </style>

      <header className="ui-vss__head">
        <p className="ui-vss__state" role="status" aria-live="polite">
          <span className="ui-vss__glyph" aria-hidden="true">
            {PHASE_GLYPH[phase]}
          </span>
          <span className="ui-vss__word">{PHASE_WORD[phase]}</span>
          {live ? <span className="ui-vss__live" aria-hidden="true" /> : null}
        </p>

        {onMute || onStop ? (
          <div className="ui-vss__actions">
            {onMute ? (
              <button
                type="button"
                className="ui-vss__btn"
                disabled={idle}
                onClick={handleMute}
              >
                {phase === "muted" ? "Unmute" : "Mute"}
              </button>
            ) : null}
            {onStop ? (
              <button
                type="button"
                className="ui-vss__btn"
                disabled={phase === "error"}
                onClick={onStop}
              >
                <span className="ui-vss__btn-glyph" aria-hidden="true">
                  {STOP_GLYPH}
                </span>
                Stop
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="ui-vss__meters" role="group" aria-label="Voice levels">
        <Meter label="Input" level={inputLevel} />
        <Meter label="Output" level={outputLevel} />
      </div>

      {errorText ? (
        <p className="ui-vss__error" role="alert">
          <span className="ui-vss__error-glyph" aria-hidden="true">
            {WARN_GLYPH}
          </span>
          {errorText}
        </p>
      ) : null}

      <ol
        className="ui-vss__list"
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label="Transcript"
        onScroll={handleScroll}
      >
        {captions.map((line, index) => (
          <li
            key={`${line.role}-${line.turn}`}
            className="ui-vss__line"
            data-role={line.role}
            data-live={index === liveIndex ? "true" : undefined}
          >
            <span className="ui-vss__speaker">{ROLE_WORD[line.role]}</span>
            <p className="ui-vss__text">
              {line.text}
              {index === liveIndex ? <span className="ui-vss__sr"> in progress</span> : null}
            </p>
          </li>
        ))}
      </ol>

      {captions.length === 0 ? (
        <p className="ui-vss__empty">Nothing transcribed yet.</p>
      ) : null}
    </div>
  );
}

const css = /* css */ `
.ui-vss {
  /* Knobs. Override any of these on .ui-vss to retheme the session in a host. */
  --ui-vss-ink: var(--text, #1a1410);
  --ui-vss-muted: var(--text-muted, #6f625a);
  --ui-vss-panel: var(--panel, #fffdfb);
  --ui-vss-line: var(--border, #e8e0d7);
  --ui-vss-edge: var(--border-soft, #1a14101a);
  --ui-vss-wash: #7a4a1c0a;
  --ui-vss-track: #7a4a1c14;
  --ui-vss-tick: #7a4a1c1f;
  --ui-vss-fill: #8a4b1f;
  --ui-vss-accent: var(--accent, #c2410c);
  --ui-vss-danger: var(--danger, #b3261e);
  --ui-vss-focus: var(--accent, #c2410c);
  --ui-vss-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-vss-ease-both: var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1));
  --ui-vss-ease-soft: var(--nm-ease-soft, cubic-bezier(0.4, 0, 0.2, 1));
  --ui-vss-dur-level: var(--nm-dur-1, 90ms);
  --ui-vss-dur: var(--nm-dur-2, 160ms);
  --ui-vss-dur-enter: var(--nm-dur-3, 240ms);
  --ui-vss-dur-amb: var(--nm-dur-6, 1100ms);
  /* The tone is the phase's own colour. Only the two phases that are actually live get
   * the ember accent, so exactly one thing on the surface reads as alive. */
  --ui-vss-tone: var(--ui-vss-muted);

  box-sizing: border-box;
  display: grid;
  gap: 12px;
  width: 100%;
  padding: 16px 18px 18px;
  background: var(--ui-vss-panel);
  border-radius: var(--radius-card, 16px);
  box-shadow: inset 0 0 0 1px var(--ui-vss-line);
  color: var(--ui-vss-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 18px;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-vss *,
.ui-vss *::before,
.ui-vss *::after {
  box-sizing: border-box;
}
.ui-vss p {
  margin: 0;
}
:where(.ui-vss) button {
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
:where(.ui-vss) svg {
  display: block;
}
.ui-vss__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.ui-vss[data-state="listening"],
.ui-vss[data-state="speaking"] {
  --ui-vss-tone: var(--ui-vss-accent);
}
.ui-vss[data-state="working"] {
  --ui-vss-tone: var(--ui-vss-ink);
}
.ui-vss[data-state="error"] {
  --ui-vss-tone: var(--ui-vss-danger);
}

/* Header ------------------------------------------------------------------ */
.ui-vss__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 10px;
  min-height: 26px;
}
.ui-vss__state {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 9px 0 8px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-vss-wash);
  color: var(--ui-vss-tone);
  font-size: 11.5px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
  transition: color var(--ui-vss-dur) var(--ui-vss-ease-both);
}
.ui-vss__glyph {
  display: grid;
  place-items: center;
  width: 14px;
  height: 14px;
}
/* The breathing dot is ambience: it says the channel is open without drawing the eye. */
.ui-vss__live {
  width: 5px;
  height: 5px;
  border-radius: var(--radius-pill, 999px);
  background: currentColor;
  animation: ui-vss-breathe var(--ui-vss-dur-amb) var(--ui-vss-ease-soft) infinite alternate;
}
@keyframes ui-vss-breathe {
  from {
    opacity: 0.28;
  }
  to {
    opacity: 1;
  }
}
.ui-vss__actions {
  display: inline-flex;
  flex: none;
  gap: 6px;
  margin-left: auto;
}
.ui-vss__btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 10px;
  border-radius: 8px;
  color: var(--ui-vss-muted);
  font-size: 11.5px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
  box-shadow: inset 0 0 0 1px var(--ui-vss-edge);
  transition:
    color var(--ui-vss-dur) var(--ui-vss-ease-both),
    background-color var(--ui-vss-dur) var(--ui-vss-ease-both),
    transform var(--ui-vss-dur-level) var(--ui-vss-ease-out);
}
.ui-vss__btn:hover {
  background: var(--ui-vss-wash);
  color: var(--ui-vss-ink);
}
.ui-vss__btn:active {
  transform: translateY(0.5px);
}
.ui-vss__btn:focus-visible {
  outline: 2px solid var(--ui-vss-focus);
  outline-offset: 1px;
}
.ui-vss__btn:disabled {
  opacity: 0.42;
  cursor: default;
}
.ui-vss__btn:disabled:hover {
  background: none;
  color: var(--ui-vss-muted);
}
.ui-vss__btn-glyph {
  display: grid;
  place-items: center;
  width: 12px;
  height: 12px;
  color: var(--ui-vss-muted);
}
.ui-vss__btn:hover .ui-vss__btn-glyph {
  color: var(--ui-vss-ink);
}

/* Levels ------------------------------------------------------------------ */
.ui-vss__meters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px 16px;
}
.ui-vss__meter {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.ui-vss__meter-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.ui-vss__label {
  font-size: 10.5px;
  font-weight: 500;
  line-height: 14px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ui-vss-muted);
}
.ui-vss__pct {
  font-size: 11px;
  line-height: 14px;
  color: var(--ui-vss-ink);
  font-variant-numeric: tabular-nums;
}
.ui-vss__track {
  position: relative;
  height: 8px;
  overflow: hidden;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-vss-track);
  box-shadow: inset 0 0 0 1px var(--ui-vss-edge);
}
.ui-vss__ticks {
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    to right,
    var(--ui-vss-tick) 0 1px,
    transparent 1px 20%
  );
  pointer-events: none;
}
/* Full width, scaled from the left: the bar follows the level without a width
 * transition on any frame. */
.ui-vss__fill {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-vss-fill);
  transform-origin: 0 50%;
  transition: transform var(--ui-vss-dur-level) var(--ui-vss-ease-both);
}

/* Transcript -------------------------------------------------------------- */
.ui-vss__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 216px;
  min-height: 0;
  margin: 0;
  padding: 10px 2px 2px;
  overflow-y: auto;
  list-style: none;
  box-shadow: inset 0 1px 0 var(--ui-vss-line);
  scrollbar-width: thin;
  scrollbar-color: var(--ui-vss-line) transparent;
}
.ui-vss__line {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  animation: ui-vss-rise var(--ui-vss-dur-enter) var(--ui-vss-ease-out) both;
}
@keyframes ui-vss-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.ui-vss__speaker {
  padding-top: 2px;
  font-size: 10.5px;
  font-weight: 500;
  line-height: 14px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ui-vss-muted);
  white-space: nowrap;
}
.ui-vss__line[data-role="assistant"] .ui-vss__speaker {
  color: var(--ui-vss-ink);
}
.ui-vss__text {
  min-width: 0;
  font-size: 12.5px;
  line-height: 19px;
  color: var(--ui-vss-ink);
  overflow-wrap: anywhere;
}
/* The line still being spoken is the only translucent one; the caret says the same
 * thing without relying on that alone. */
.ui-vss__line[data-live="true"] .ui-vss__text {
  opacity: 0.6;
}
.ui-vss__line[data-live="true"] .ui-vss__text::after {
  content: "";
  display: inline-block;
  width: 2px;
  height: 12px;
  margin-left: 3px;
  vertical-align: -1px;
  background: currentColor;
  animation: ui-vss-caret var(--ui-vss-dur-amb) var(--ui-vss-ease-soft) infinite alternate;
}
@keyframes ui-vss-caret {
  from {
    opacity: 0.18;
  }
  to {
    opacity: 0.7;
  }
}
.ui-vss__empty {
  padding: 2px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ui-vss-muted);
}

/* Error ------------------------------------------------------------------- */
.ui-vss__error {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 8px 10px;
  border-radius: var(--radius-preview, 12px);
  background: var(--ui-vss-wash);
  box-shadow: inset 2px 0 0 0 var(--ui-vss-danger);
  color: var(--ui-vss-danger);
  font-size: 11.5px;
  line-height: 17px;
}
.ui-vss__error-glyph {
  display: grid;
  flex: none;
  place-items: center;
  width: 12px;
  height: 12px;
  margin-top: 2px;
}

:where(.dark, [data-theme="dark"]) .ui-vss {
  --ui-vss-ink: var(--text, #f4ece4);
  --ui-vss-muted: var(--text-muted, #a2958a);
  --ui-vss-panel: var(--panel, #1a1512);
  --ui-vss-line: var(--border, #33291f);
  --ui-vss-edge: var(--border-soft, #ffffff12);
  --ui-vss-wash: #ffffff0d;
  --ui-vss-track: #ffffff12;
  --ui-vss-tick: #ffffff1f;
  --ui-vss-fill: #c2703a;
  --ui-vss-accent: var(--accent, #ff6b35);
  --ui-vss-danger: var(--danger, #e2544a);
  --ui-vss-focus: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  .ui-vss__line {
    animation: none;
  }
  .ui-vss__live,
  .ui-vss__line[data-live="true"] .ui-vss__text::after {
    animation: none;
    opacity: 0.6;
  }
  .ui-vss__fill,
  .ui-vss__btn,
  .ui-vss__state {
    transition-duration: 1ms;
  }
}
`;
