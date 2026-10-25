"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/*
 * Agent Terminal: the streamed output of one tool call, paced line by line.
 * The terminal reveals the lines it is handed at its own pace while the call is live, so a burst
 * of output arrives as a stream rather than a wall; each line rises and fades in, and a thin ember
 * caret blinks at the end of the last one until the call finishes. It holds the view at the bottom
 * while the reader has not moved, and when the reader scrolls up it stops following, counts what
 * arrived, and offers a pill back to the latest line. Warnings take a glyph and a tint, errors a
 * glyph, a tint and a left rule, so severity never rests on colour alone.
 * The styles are injected below, so no extra files are needed.
 */

/** How a line is marked: `info` is unmarked, `warning` takes a glyph and a tint, `error` a glyph, a tint and a left rule */
export type TerminalSeverity = "info" | "warning" | "error";

/** One line of tool output */
export type TerminalLine = {
  id: string;
  /** What the command printed, spacing preserved */
  text: string;
  /** Defaults to `info` */
  severity?: TerminalSeverity;
};

/** Where the call is: `running` streams, `done` and `failed` flush the rest, `stopped` cuts the output where it stood */
export type TerminalStatus = "running" | "done" | "failed" | "stopped";

export type AgentTerminalProps = {
  /** Heading on the chrome bar */
  title?: string;
  /** The command being run, shown in the bar. The leading `$` is added by the terminal */
  command?: string;
  /** Every line the call has produced. The terminal paces their arrival */
  lines?: readonly TerminalLine[];
  /** Where the call is – `running` streams, `stopped` freezes the output */
  status?: TerminalStatus;
  /** Process exit code, shown once the call is no longer running */
  exitCode?: number;
  /** Lines already on screen when the terminal mounts, revealed without the entrance animation */
  initialLines?: number;
  /** Milliseconds between two revealed lines */
  pace?: number;
  /** The clear control was pressed; the terminal also empties its own scrollback */
  onClear?: () => void;
  /** The stop control was pressed – only offered while the call is running */
  onStop?: () => void;
  /** Extra class on the root */
  className?: string;
};

/** At the bottom, within this many pixels, the reader counts as following the stream. */
const PIN_SLACK = 24;

/** Before paint, so a following terminal never flickers through its own scroll jump; plain on the server. */
const useLayoutIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function AgentTerminal({
  title = "Agent terminal",
  command,
  lines = [],
  status = "running",
  exitCode,
  initialLines = 0,
  pace = 220,
  onClear,
  onStop,
  className,
}: AgentTerminalProps) {
  const titleId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  /* Following is a ref as well as state: the scroll handler writes it, the layout effect reads it
     in the same frame, and state only exists to render the pill. */
  const pinnedRef = useRef(true);
  const shownRef = useRef(0);

  const live = status === "running";
  /* Lines on screen at mount: a call that is already over shows its whole output at once, and one
     that is still running starts empty unless the caller hands it a scrollback. */
  const [seed] = useState(() => (status === "running" ? Math.min(initialLines, lines.length) : lines.length));
  const [shown, setShown] = useState(seed);
  const [clearedThrough, setClearedThrough] = useState(0);
  const [pinned, setPinned] = useState(true);
  const [unseen, setUnseen] = useState(0);
  /* Bumped when the tab comes back, so the reveal can re-arm after pausing on a hidden page. */
  const [awake, setAwake] = useState(0);

  /* The stream: one line per pace, a plain timeout rather than an interval, paused on a hidden tab. */
  useEffect(() => {
    if (!live) {
      /* A finished call has printed everything it is going to print. A stopped one has not. */
      if (status === "done" || status === "failed") setShown(lines.length);
      return;
    }
    if (shown >= lines.length) return;
    if (typeof document !== "undefined" && document.hidden) {
      const wake = () => setAwake((count) => count + 1);
      document.addEventListener("visibilitychange", wake);
      return () => document.removeEventListener("visibilitychange", wake);
    }
    const timer = window.setTimeout(() => {
      setShown((count) => Math.min(count + 1, lines.length));
    }, Math.max(40, pace));
    return () => window.clearTimeout(timer);
  }, [live, status, shown, lines.length, pace, awake]);

  /* Follow the tail while the reader is at the bottom, and count what arrives while they are not. */
  useLayoutIso(() => {
    const body = bodyRef.current;
    const arrived = shown - shownRef.current;
    shownRef.current = shown;
    if (!body) return;
    if (pinnedRef.current) {
      body.scrollTop = body.scrollHeight;
      if (arrived > 0) setUnseen(0);
      return;
    }
    if (arrived > 0) setUnseen((count) => count + arrived);
  }, [shown, clearedThrough]);

  const onScroll = () => {
    const body = bodyRef.current;
    if (!body) return;
    const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight <= PIN_SLACK;
    pinnedRef.current = atBottom;
    setPinned(atBottom);
    if (atBottom) setUnseen(0);
  };

  const jump = () => {
    const body = bodyRef.current;
    if (!body) return;
    body.scrollTop = body.scrollHeight;
    pinnedRef.current = true;
    setPinned(true);
    setUnseen(0);
  };

  const clear = () => {
    const body = bodyRef.current;
    setClearedThrough(shown);
    setUnseen(0);
    pinnedRef.current = true;
    setPinned(true);
    if (body) body.scrollTop = 0;
    onClear?.();
  };

  /* A wrapped line is taller than the one it followed, so the tail has to be re-measured, not assumed. */
  useEffect(() => {
    const body = bodyRef.current;
    const stream = streamRef.current;
    if (!body || !stream || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) body.scrollTop = body.scrollHeight;
    });
    observer.observe(stream);
    observer.observe(body);
    return () => observer.disconnect();
  }, []);

  const visible = lines.slice(clearedThrough, shown);
  const pillUp = !pinned;
  const pillLabel = unseen > 0 ? `${unseen} new ${unseen === 1 ? "line" : "lines"}` : "Jump to latest";
  const cutShort = status === "stopped" && shown < lines.length;
  const empty = visible.length === 0;
  const emptyNote =
    clearedThrough > 0
      ? "Scrollback cleared"
      : lines.length === 0
        ? "The command printed nothing"
        : "Stopped before any output";

  return (
    <div className={["ui-agtm", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-agent-terminal" precedence="default">
        {css}
      </style>

      <div className="ui-agtm__bar">
        <span className="ui-agtm__title" id={titleId}>
          {title}
        </span>
        {command ? (
          <code className="ui-agtm__cmd">
            <span className="ui-agtm__prompt" aria-hidden="true">
              $
            </span>
            {command}
          </code>
        ) : null}

        <span className="ui-agtm__state" data-state={status} role="status">
          {live ? (
            <>
              {iconRunning}
              running
            </>
          ) : status === "done" ? (
            <>
              {iconDone}
              <b>exit {exitCode ?? 0}</b>
            </>
          ) : status === "failed" ? (
            <>
              {iconFailed}
              <b>exit {exitCode ?? 1}</b>
            </>
          ) : (
            <>
              {iconStopped}
              stopped
              {cutShort ? (
                <span className="ui-agtm__note">
                  {" "}
                  at line {shown} of {lines.length}
                </span>
              ) : null}
            </>
          )}
        </span>

        {live && onStop ? (
          <button type="button" className="ui-agtm__ctl" onClick={onStop}>
            {iconStop}
            <span className="ui-agtm__ctl-label">Stop</span>
          </button>
        ) : null}
        <button type="button" className="ui-agtm__ctl" onClick={clear} disabled={empty && !live}>
          {iconClear}
          <span className="ui-agtm__ctl-label">Clear</span>
        </button>
      </div>

      <div className="ui-agtm__stage">
        <div
          className="ui-agtm__body"
          ref={bodyRef}
          onScroll={onScroll}
          role="log"
          aria-live="polite"
          aria-labelledby={titleId}
          tabIndex={0}
        >
          <div className="ui-agtm__stream" ref={streamRef}>
            {visible.map((line, index) => {
              const severity = line.severity ?? "info";
              const absolute = clearedThrough + index;
              const last = index === visible.length - 1;
              return (
                <div
                  key={line.id}
                  className="ui-agtm__row"
                  data-severity={severity === "info" ? undefined : severity}
                  data-animate={absolute >= seed ? "" : undefined}
                >
                  <span className="ui-agtm__mark" aria-hidden="true">
                    {severity === "warning" ? "!" : severity === "error" ? "×" : ""}
                  </span>
                  <span className="ui-agtm__text">
                    {severity === "info" ? null : (
                      <span className="ui-agtm__sr">{severity === "warning" ? "Warning: " : "Error: "}</span>
                    )}
                    {line.text}
                    {live && last ? <span className="ui-agtm__caret" aria-hidden="true" /> : null}
                  </span>
                </div>
              );
            })}

            {empty && live ? (
              <div className="ui-agtm__row" data-empty="" data-animate="">
                <span className="ui-agtm__mark" aria-hidden="true" />
                <span className="ui-agtm__text">
                  Waiting for the command to print
                  <span className="ui-agtm__caret" aria-hidden="true" />
                </span>
              </div>
            ) : null}

            {empty && !live ? (
              <div className="ui-agtm__row" data-empty="">
                <span className="ui-agtm__mark" aria-hidden="true" />
                <span className="ui-agtm__text">{emptyNote}</span>
              </div>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          className="ui-agtm__jump"
          data-visible={pillUp ? "" : undefined}
          onClick={jump}
          aria-hidden={pillUp ? undefined : true}
          tabIndex={pillUp ? 0 : -1}
        >
          {iconJump}
          {pillLabel}
        </button>
      </div>
    </div>
  );
}

/* ---------- Glyphs ---------- */

/* One glyph per state, so a status reads as a shape before it reads as a colour. */
const iconRunning = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d="M3.4 2.4 9.2 6l-5.8 3.6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

const iconDone = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path
      d="M2.4 6.4 4.8 8.8 9.6 3.4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const iconFailed = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path
      d="M3.2 3.2 8.8 8.8M8.8 3.2 3.2 8.8"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const iconStopped = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <rect x="3" y="3" width="6" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);

const iconStop = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="4" y="4" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

const iconClear = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="1.6" y="2.8" width="12.8" height="10.4" rx="2.6" stroke="currentColor" strokeWidth="1.4" />
    <path d="M6 6.2 10 9.8M10 6.2 6 9.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const iconJump = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M8 3v10M3.6 8.6 8 13l4.4-4.4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const css = /* css */ `
/* A consumer retunes the terminal by overriding these on .ui-agtm, e.g.
   .ui-agtm { --ui-agtm-accent: #ff6b35; --ui-agtm-h: 420px; } */
.ui-agtm{--ui-agtm-ink: var(--text, #1a1410);--ui-agtm-muted: var(--text-muted, #6f625a);--ui-agtm-faint: var(--text-subtle, #1a141066);--ui-agtm-panel: var(--panel, #fffdfb);--ui-agtm-card: var(--card, #ffffff);--ui-agtm-line: var(--border-soft, #1a14101a);--ui-agtm-rule: var(--border, #e8e0d7);--ui-agtm-accent: var(--accent, #c2410c);--ui-agtm-warn: var(--warning, #9a6410);--ui-agtm-danger: var(--danger, #b3261e);--ui-agtm-ok: var(--success, #1a7a4a);--ui-agtm-fill: color-mix(in srgb, var(--ui-agtm-ink) 7%, transparent);--ui-agtm-warn-tint: color-mix(in srgb, var(--ui-agtm-warn) 12%, transparent);--ui-agtm-danger-tint: color-mix(in srgb, var(--ui-agtm-danger) 11%, transparent);--ui-agtm-focus: color-mix(in srgb, var(--ui-agtm-accent) 55%, transparent);--ui-agtm-pop: 0 2px 10px #3d1f0a1f;--ui-agtm-shadow: var(--shadow-card, 0 1px 1.5px #3d1f0a0a, inset 0 -1px 0 #3d1f0a0f);--ui-agtm-radius: var(--radius-card, 16px);--ui-agtm-h: 276px;--ui-agtm-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;--ui-agtm-mono: var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace);--ui-agtm-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));--ui-agtm-ease-in: var(--nm-ease-in, cubic-bezier(0.55, 0, 0.68, 0.19));--ui-agtm-spring: var(--nm-spring, cubic-bezier(0.34, 1.56, 0.64, 1));--ui-agtm-soft: var(--nm-ease-soft, cubic-bezier(0.4, 0, 0.2, 1));--ui-agtm-dur-1: var(--nm-dur-1, 90ms);--ui-agtm-dur-2: var(--nm-dur-2, 160ms);--ui-agtm-dur-3: var(--nm-dur-3, 240ms);--ui-agtm-dur-6: var(--nm-dur-6, 1100ms);container: agtm / inline-size;display: grid;min-width: 0;border-radius: var(--ui-agtm-radius);background: var(--ui-agtm-panel);box-shadow: var(--ui-agtm-shadow);font-family: var(--ui-agtm-sans);font-size: 13px;line-height: 20px;letter-spacing: -0.01em;color: var(--ui-agtm-ink);-webkit-font-smoothing: antialiased}
.ui-agtm *, .ui-agtm *::before, .ui-agtm *::after{box-sizing: border-box}
:where(.ui-agtm) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;text-align: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-agtm button:focus-visible{outline: 2px solid var(--ui-agtm-focus);outline-offset: 1px}
.ui-agtm svg{display: block;flex: none}
.ui-agtm__sr{position: absolute;width: 1px;height: 1px;padding: 0;overflow: hidden;clip-path: inset(50%);white-space: nowrap;border: 0}
.ui-agtm__bar{display: flex;flex-wrap: wrap;align-items: center;gap: 6px 8px;min-width: 0;padding: 9px 10px 9px 12px;box-shadow: inset 0 -1px 0 var(--ui-agtm-line)}
.ui-agtm__title{flex: none;font-weight: 500;color: var(--ui-agtm-ink)}
.ui-agtm__cmd{flex: 0 1 auto;min-width: 0;overflow: hidden;padding: 2px 8px 3px;border-radius: 7px;background: var(--ui-agtm-fill);font-family: var(--ui-agtm-mono);font-size: 12px;line-height: 16px;color: var(--ui-agtm-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-agtm__prompt{margin-right: 6px;color: var(--ui-agtm-faint)}
.ui-agtm__state{display: inline-flex;align-items: center;gap: 5px;margin-left: auto;font-size: 12px;line-height: 16px;color: var(--ui-agtm-muted);font-variant-numeric: tabular-nums;white-space: nowrap}
.ui-agtm__state b{font-weight: 500}
.ui-agtm__state[data-state="done"]{color: var(--ui-agtm-ok)}
.ui-agtm__state[data-state="failed"]{color: var(--ui-agtm-danger)}
.ui-agtm__note{color: var(--ui-agtm-faint)}
.ui-agtm__ctl{display: inline-flex;align-items: center;justify-content: center;gap: 6px;height: 26px;min-width: 26px;padding: 0 8px;border-radius: 8px;font-size: 12px;font-weight: 500;color: var(--ui-agtm-muted);transition: color var(--ui-agtm-dur-2) var(--ui-agtm-ease-out), background-color var(--ui-agtm-dur-2) var(--ui-agtm-ease-out), transform var(--ui-agtm-dur-1) var(--ui-agtm-ease-out)}
.ui-agtm__ctl:hover:not(:disabled){background: var(--ui-agtm-fill);color: var(--ui-agtm-ink)}
.ui-agtm__ctl:active:not(:disabled){transform: translateY(0.5px)}
.ui-agtm__ctl:disabled{opacity: 0.4;cursor: default}
.ui-agtm__stage{position: relative;min-width: 0}
.ui-agtm__body{max-height: var(--ui-agtm-h);min-height: 116px;overflow: auto;overscroll-behavior: contain;padding: 10px 12px 34px;scrollbar-width: thin;scrollbar-color: var(--ui-agtm-rule) transparent}
.ui-agtm__body:focus-visible{outline: 2px solid var(--ui-agtm-focus);outline-offset: -3px}
.ui-agtm__stream{display: grid;gap: 2px;min-width: 0}
.ui-agtm__row{position: relative;display: grid;grid-template-columns: 13px minmax(0, 1fr);column-gap: 8px;align-items: start;padding: 1px 6px 1px 8px;border-radius: 7px;font-family: var(--ui-agtm-mono);font-size: 12.5px;line-height: 1.55;color: var(--ui-agtm-ink)}
.ui-agtm__row[data-animate]{animation: ui-agtm-in var(--ui-agtm-dur-3) var(--ui-agtm-ease-out) both}
.ui-agtm__row[data-severity="warning"]{background: var(--ui-agtm-warn-tint)}
.ui-agtm__row[data-severity="error"]{background: var(--ui-agtm-danger-tint);box-shadow: inset 2px 0 0 var(--ui-agtm-danger)}
.ui-agtm__row[data-empty]{color: var(--ui-agtm-faint)}
.ui-agtm__mark{font-weight: 600;color: var(--ui-agtm-faint);text-align: center}
.ui-agtm__row[data-severity="warning"] .ui-agtm__mark{color: var(--ui-agtm-warn)}
.ui-agtm__row[data-severity="error"] .ui-agtm__mark{color: var(--ui-agtm-danger)}
.ui-agtm__text{min-width: 0;white-space: pre-wrap;overflow-wrap: anywhere;word-break: break-word;tab-size: 2}
.ui-agtm__caret{display: inline-block;width: 7px;height: 1em;margin-left: 3px;border-radius: 1px;background: var(--ui-agtm-accent);vertical-align: -0.12em;animation: ui-agtm-blink var(--ui-agtm-dur-6) var(--ui-agtm-soft) infinite}
.ui-agtm__jump{position: absolute;left: 50%;bottom: 10px;z-index: 2;display: inline-flex;align-items: center;gap: 6px;height: 28px;padding: 0 11px 0 9px;border-radius: var(--radius-pill, 999px);background: var(--ui-agtm-card);box-shadow: inset 0 0 0 1px var(--ui-agtm-line), var(--ui-agtm-pop);font-size: 12px;font-weight: 500;line-height: 16px;color: var(--ui-agtm-ink);white-space: nowrap;font-variant-numeric: tabular-nums;opacity: 0;transform: translate(-50%, 10px) scale(0.96);pointer-events: none;transition: opacity var(--ui-agtm-dur-2) var(--ui-agtm-ease-in), transform var(--ui-agtm-dur-2) var(--ui-agtm-ease-in)}
.ui-agtm__jump[data-visible]{opacity: 1;transform: translate(-50%, 0) scale(1);pointer-events: auto;transition: opacity var(--ui-agtm-dur-3) var(--ui-agtm-ease-out), transform var(--ui-agtm-dur-3) var(--ui-agtm-spring)}
.ui-agtm__jump:hover{background: var(--ui-agtm-panel)}
@keyframes ui-agtm-in{from{opacity: 0;transform: translateY(6px)}
}
@keyframes ui-agtm-blink{0%, 100%{opacity: 1}
50%{opacity: 0.22}
}
@container agtm (max-width: 480px){.ui-agtm__cmd{order: 3;flex-basis: 100%}
.ui-agtm__ctl-label{position: absolute;width: 1px;height: 1px;overflow: hidden;clip-path: inset(50%);white-space: nowrap}
.ui-agtm__ctl{padding: 0;width: 28px}
.ui-agtm__body{padding: 8px 8px 32px}
}
:where(.dark, [data-theme="dark"]) .ui-agtm{--ui-agtm-ink: var(--text, #f4ece4);--ui-agtm-muted: var(--text-muted, #a2958a);--ui-agtm-faint: var(--text-subtle, #f4ece48c);--ui-agtm-panel: var(--panel, #1a1512);--ui-agtm-card: var(--card, #201a15);--ui-agtm-line: var(--border-soft, #ffffff12);--ui-agtm-rule: var(--border, #33291f);--ui-agtm-accent: var(--accent, #ff6b35);--ui-agtm-warn: var(--warning, #d99530);--ui-agtm-danger: var(--danger, #e2544a);--ui-agtm-ok: var(--success, #4f9d6e);--ui-agtm-pop: 0 2px 10px #00000073;--ui-agtm-shadow: var(--shadow-card, 0 1px 1.5px #00000047, inset 0 -1px 0 #ffffff0d)}
@media (prefers-reduced-motion: reduce){.ui-agtm *, .ui-agtm *::before, .ui-agtm *::after{animation: none;transition-duration: 1ms}
}
`;