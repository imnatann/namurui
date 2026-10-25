"use client";

import { useEffect, useState, type ReactNode } from "react";

/*
 * Connection Banner: the transport-health line for the local bridge, reported from
 * bridge_status and from a dropped SSE stream. It enters in the page flow by opening its
 * own height and settling down from above, so it pushes the transcript instead of covering
 * it; the glyph carries the state at a glance and the word beside it says the same thing,
 * so status is never colour alone. A reconnect counts down on a one-second data clock that
 * stops at zero and waits for the parent to report the next state. Styles are injected
 * below, so no extra files are needed.
 */

export type ConnectionState = "starting" | "ready" | "reconnecting" | "exited" | "error";

export type ConnectionBannerProps = {
  /** Transport state reported by the bridge */
  state: ConnectionState;
  /** Detail from bridge_status, shown under the state word */
  message?: string;
  /** Exit or error code reported alongside the state */
  code?: number | string;
  /** Seconds until the next automatic reconnect attempt */
  retryInSeconds?: number;
  /** True when the client joined a stream that only carries live messages */
  historyGap?: boolean;
  /** Called when the user asks for a fresh bridge process */
  onRestart?: () => void;
  /** Called when the user skips the remaining backoff */
  onRetryNow?: () => void;
  /** Called when the user refetches the transcript after a gap */
  onReload?: () => void;
  /** Extra class on the root */
  className?: string;
};

const STATE_WORD: Record<ConnectionState, string> = {
  starting: "Starting bridge",
  ready: "Bridge ready",
  reconnecting: "Reconnecting",
  exited: "Bridge exited",
  error: "Bridge error",
};

/* One glyph per state: a dot that is filling, an arc that is turning, a process that
 * stopped, and a fault that needs attention. */
const STATE_GLYPH: Record<ConnectionState, ReactNode> = {
  starting: <span className="ui-cnb__dot" />,
  ready: null,
  reconnecting: (
    <svg
      className="ui-cnb__spin"
      viewBox="0 0 14 14"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M7 1.6a5.4 5.4 0 1 1-5.4 5.4" />
    </svg>
  ),
  exited: (
    <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="1.5" fill="currentColor" />
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
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 2.3 12.3 11.3H1.7z" />
      <path d="M7 5.7v2.5" />
      <circle cx="7" cy="9.8" r="0.55" fill="currentColor" stroke="none" />
    </svg>
  ),
};

/* A break in a line: the stream carried on without the messages that came before it. */
const GAP_GLYPH: ReactNode = (
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
    <path d="M1.5 7h4" />
    <path d="M8.5 7h4" />
    <path d="M6.2 5.3 7 7l-.8 1.7" />
  </svg>
);

/* Read once, on a state change: the seconds tick outside the live region, so the
 * countdown is not announced every second. */
function announce(state: ConnectionState, code?: number | string): string {
  if (state === "ready") return "Bridge connected";
  if (state === "starting") return "Starting the bridge";
  if (state === "reconnecting") return "Bridge connection lost, reconnecting automatically";
  const tail = code === undefined ? "" : `, ${state === "exited" ? "exit code" : "code"} ${code}`;
  return state === "exited" ? `Bridge exited${tail}` : `Bridge error${tail}`;
}

export function ConnectionBanner({
  state,
  message,
  code,
  retryInSeconds,
  historyGap = false,
  onRestart,
  onRetryNow,
  onReload,
  className,
}: ConnectionBannerProps) {
  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState(() =>
    retryInSeconds === undefined ? 0 : Math.max(0, Math.round(retryInSeconds)),
  );

  /* One frame closed, then the slot opens: the height comes from the grid row and the
   * banner lifts the last few pixels, so nothing on the page jumps. A ready state closes
   * it again, so the next failure slides in the same way. */
  useEffect(() => {
    if (state === "ready") {
      setOpen(false);
      return;
    }
    const frame = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(frame);
  }, [state]);

  /* The backoff clock. It is data, not decoration: it is anchored to the moment the
   * attempt was reported, stops at zero, and is cleared on unmount or a state change. */
  useEffect(() => {
    if (state !== "reconnecting" || retryInSeconds === undefined) return;
    const total = Math.max(0, Math.round(retryInSeconds));
    setRemaining(total);
    if (total === 0) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const left = Math.max(0, total - Math.floor((Date.now() - startedAt) / 1000));
      setRemaining(left);
      if (left === 0) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state, retryInSeconds]);

  /* Ready is the quiet state: the banner leaves the flow entirely and only the hidden
   * live region stays, so the recovery is still announced. The gap note can show on its
   * own, because a live-only stream can be healthy and still be missing messages. */
  const reconnecting = state === "reconnecting";
  const counting = reconnecting && retryInSeconds !== undefined;
  const stoppable = state === "exited" || state === "error";

  return (
    <div className={["ui-cnb", className].filter(Boolean).join(" ")} data-state={state}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-connection-banner" precedence="default">
        {css}
      </style>

      <p className="ui-cnb__sr" role="status" aria-live="polite">
        {announce(state, code)}
        {historyGap ? ". Some messages may be missing; reload the transcript." : ""}
      </p>

      {state === "ready" ? null : (
        <div className="ui-cnb__slot" data-open={open ? "true" : undefined}>
          <div className="ui-cnb__banner">
            <span className="ui-cnb__glyph" aria-hidden="true">
              {STATE_GLYPH[state]}
            </span>

            <div className="ui-cnb__body">
              <p className="ui-cnb__line">
                <span className="ui-cnb__word">{STATE_WORD[state]}</span>
                {counting ? (
                  <span className="ui-cnb__count">Retrying in {remaining}s</span>
                ) : null}
                {code !== undefined ? (
                  <span
                    className="ui-cnb__code"
                    title={`${state === "exited" ? "exit code" : "error code"} ${code}`}
                  >
                    {state === "exited" ? "exit" : "code"} {code}
                  </span>
                ) : null}
              </p>
              {message ? <p className="ui-cnb__message">{message}</p> : null}
            </div>

            <div className="ui-cnb__actions">
              {reconnecting && onRetryNow ? (
                <button type="button" className="ui-cnb__btn" onClick={onRetryNow}>
                  Retry now
                </button>
              ) : null}
              {stoppable && onRestart ? (
                <button type="button" className="ui-cnb__btn" onClick={onRestart}>
                  Restart
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {historyGap ? (
        <p className="ui-cnb__gap">
          <span className="ui-cnb__gap-glyph" aria-hidden="true">
            {GAP_GLYPH}
          </span>
          <span className="ui-cnb__gap-text">Some messages may be missing</span>
          {onReload ? (
            <button type="button" className="ui-cnb__link" onClick={onReload}>
              Reload
            </button>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

const css = /* css */ `
.ui-cnb {
  /* Knobs. Override any of these on .ui-cnb to retheme the banner in a host. */
  --ui-cnb-ink: var(--text, #1a1410);
  --ui-cnb-muted: var(--text-muted, #6f625a);
  --ui-cnb-panel: var(--panel, #fffdfb);
  --ui-cnb-line: var(--border, #e8e0d7);
  --ui-cnb-edge: var(--border-soft, #1a14101a);
  --ui-cnb-wash: #7a4a1c0a;
  --ui-cnb-tint-quiet: #7a4a1c08;
  --ui-cnb-tint-warn: #9a64100f;
  --ui-cnb-tint-danger: #b3261e0f;
  --ui-cnb-warn: var(--warning, #9a6410);
  --ui-cnb-danger: var(--danger, #b3261e);
  --ui-cnb-focus: var(--accent, #c2410c);
  /* The tone carries the state; the glyph and the word say the same thing, so a
   * status is never colour alone. Starting keeps the muted tone: no verdict yet. */
  --ui-cnb-tone: var(--ui-cnb-muted);
  --ui-cnb-tint: var(--ui-cnb-tint-quiet);
  --ui-cnb-ease: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-cnb-ease-soft: var(--nm-ease-soft, cubic-bezier(0.4, 0, 0.2, 1));
  --ui-cnb-dur: var(--nm-dur-2, 160ms);
  --ui-cnb-dur-enter: var(--nm-dur-4, 380ms);
  --ui-cnb-dur-ambient: var(--nm-dur-6, 1100ms);

  position: relative;
  box-sizing: border-box;
  display: grid;
  gap: 8px;
  width: 100%;
  color: var(--ui-cnb-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 18px;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
}
.ui-cnb *,
.ui-cnb *::before,
.ui-cnb *::after {
  box-sizing: border-box;
}
.ui-cnb p {
  margin: 0;
}
:where(.ui-cnb) button {
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
:where(.ui-cnb) svg {
  display: block;
}

.ui-cnb[data-state="reconnecting"] {
  --ui-cnb-tone: var(--ui-cnb-warn);
  --ui-cnb-tint: var(--ui-cnb-tint-warn);
}
.ui-cnb[data-state="exited"],
.ui-cnb[data-state="error"] {
  --ui-cnb-tone: var(--ui-cnb-danger);
  --ui-cnb-tint: var(--ui-cnb-tint-danger);
}

/* Entry ---------------------------------------------------------------------
 * The slot is the height: a grid row from 0fr to 1fr, never a measured height, so the
 * banner opens to whatever its message needs at 320px or 1920px. */
.ui-cnb__slot {
  display: grid;
  grid-template-rows: 0fr;
  overflow: hidden;
  opacity: 0;
  transition:
    grid-template-rows var(--ui-cnb-dur-enter) var(--ui-cnb-ease),
    opacity var(--ui-cnb-dur-enter) var(--ui-cnb-ease);
}
.ui-cnb__slot[data-open="true"] {
  grid-template-rows: 1fr;
  opacity: 1;
}
.ui-cnb__banner {
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 0;
  overflow: hidden;
  padding: 9px 11px;
  background-color: var(--ui-cnb-panel);
  background-image: linear-gradient(var(--ui-cnb-tint), var(--ui-cnb-tint));
  border-radius: var(--radius-preview, 12px);
  box-shadow:
    inset 0 0 0 1px var(--ui-cnb-line),
    inset 2px 0 0 0 var(--ui-cnb-tone);
  transform: translateY(-6px);
  transition: transform var(--ui-cnb-dur-enter) var(--ui-cnb-ease);
}
.ui-cnb__slot[data-open="true"] .ui-cnb__banner {
  transform: none;
}

/* Glyphs -------------------------------------------------------------------- */
.ui-cnb__glyph {
  display: grid;
  place-items: center;
  width: 14px;
  height: 14px;
  color: var(--ui-cnb-tone);
}
.ui-cnb__dot {
  position: relative;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}
/* A ring leaving the dot: slow enough to read as waiting, not as a spinner. */
.ui-cnb__dot::after {
  content: "";
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px currentColor;
  opacity: 0;
  animation: ui-cnb-pulse var(--ui-cnb-dur-ambient) var(--ui-cnb-ease-soft) infinite;
}
@keyframes ui-cnb-pulse {
  from {
    opacity: 0.5;
    transform: scale(0.7);
  }
  to {
    opacity: 0;
    transform: scale(1.2);
  }
}
.ui-cnb__spin {
  transform-origin: 50% 50%;
  animation: ui-cnb-spin var(--ui-cnb-dur-ambient) linear infinite;
}
@keyframes ui-cnb-spin {
  to {
    transform: rotate(360deg);
  }
}

/* Copy ---------------------------------------------------------------------- */
.ui-cnb__body {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.ui-cnb__line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  min-width: 0;
}
.ui-cnb__word {
  font-size: 12.5px;
  font-weight: 500;
  line-height: 18px;
  color: var(--ui-cnb-ink);
}
.ui-cnb__count {
  color: var(--ui-cnb-muted);
  font-size: 11.5px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}
.ui-cnb__code {
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--ui-cnb-wash);
  box-shadow: inset 0 0 0 1px var(--ui-cnb-edge);
  color: var(--ui-cnb-tone);
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 10.5px;
  line-height: 16px;
  white-space: nowrap;
}
.ui-cnb__message {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--ui-cnb-muted);
  font-size: 11.5px;
  line-height: 17px;
}

/* Actions ------------------------------------------------------------------- */
.ui-cnb__actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
}
.ui-cnb__btn {
  height: 26px;
  padding: 0 10px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px var(--ui-cnb-line);
  color: var(--ui-cnb-ink);
  font-size: 11.5px;
  font-weight: 500;
  line-height: 24px;
  white-space: nowrap;
  transition:
    background-color var(--ui-cnb-dur) var(--ui-cnb-ease),
    box-shadow var(--ui-cnb-dur) var(--ui-cnb-ease);
}
.ui-cnb__btn:hover {
  background: var(--ui-cnb-wash);
  box-shadow: inset 0 0 0 1px var(--ui-cnb-tone);
}
.ui-cnb__btn:active {
  transform: translateY(0.5px);
}
.ui-cnb__btn:focus-visible {
  outline: 2px solid var(--ui-cnb-focus);
  outline-offset: 1px;
}

/* The gap note --------------------------------------------------------------
 * The SSE stream carries live frames only, so a reconnect leaves a hole the client has
 * to refetch. The note is quiet on purpose: the stream is working, the transcript is not
 * complete. */
.ui-cnb__gap {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 6px;
  padding: 0 2px;
  color: var(--ui-cnb-muted);
  font-size: 11.5px;
  line-height: 17px;
}
.ui-cnb__gap-glyph {
  display: grid;
  flex: none;
  place-items: center;
  width: 14px;
  height: 14px;
}
.ui-cnb__gap-text {
  min-width: 0;
}
.ui-cnb__link {
  border-radius: 4px;
  color: var(--ui-cnb-ink);
  font-size: 11.5px;
  font-weight: 500;
  text-decoration: underline;
  text-decoration-color: var(--ui-cnb-edge);
  text-underline-offset: 2px;
  transition: text-decoration-color var(--ui-cnb-dur) var(--ui-cnb-ease);
}
.ui-cnb__link:hover {
  text-decoration-color: currentColor;
}
.ui-cnb__link:focus-visible {
  outline: 2px solid var(--ui-cnb-focus);
  outline-offset: 2px;
}

.ui-cnb__sr {
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

:where(.dark, [data-theme="dark"]) .ui-cnb {
  --ui-cnb-ink: var(--text, #f4ece4);
  --ui-cnb-muted: var(--text-muted, #a2958a);
  --ui-cnb-panel: var(--panel, #1a1512);
  --ui-cnb-line: var(--border, #33291f);
  --ui-cnb-edge: var(--border-soft, #ffffff12);
  --ui-cnb-wash: #ffffff0d;
  --ui-cnb-tint-quiet: #ffffff08;
  --ui-cnb-tint-warn: #d9953014;
  --ui-cnb-tint-danger: #e2544a14;
  --ui-cnb-warn: var(--warning, #d99530);
  --ui-cnb-danger: var(--danger, #e2544a);
  --ui-cnb-focus: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  /* No slide, and the slot is open whether or not the entry frame has run: the glyph
   * and the word carry the state on their own. */
  .ui-cnb__slot {
    grid-template-rows: 1fr;
    opacity: 1;
  }
  .ui-cnb__slot,
  .ui-cnb__banner,
  .ui-cnb__btn,
  .ui-cnb__link {
    transition-duration: 1ms;
  }
  .ui-cnb__banner {
    transform: none;
  }
  .ui-cnb__dot::after,
  .ui-cnb__spin {
    animation: none;
  }
  .ui-cnb__dot::after {
    opacity: 0;
  }
}
`;
