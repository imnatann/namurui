"use client";

import { useEffect, useId, useRef, useState } from "react";

/*
 * Reasoning Block: one historical thinking block from the transcript, folded to a header that
 * reports how long the model thought and how many tokens it spent. The body opens on a
 * grid-row transition rather than a guessed height; narration leads the body at full ink and
 * opens the block itself, because it is part of the answer. A redacted block keeps its lock,
 * says why, and drops its copy action. Styles are injected below, so no extra files are needed.
 */

export type ReasoningBlockProps = {
  /** The reasoning as it arrived; prose with its own line breaks, never markdown */
  text: string;
  /** Narration the model addressed to the user but returned as thinking, promoted to answer text */
  narration?: string;
  /** The provider shortened `text` before sending it, so the block says so */
  summary?: boolean;
  /** The provider withheld the reasoning; the body becomes a locked placeholder */
  redacted?: boolean;
  /** Milliseconds spent thinking, from the assistant message's `duration` */
  durationMs?: number;
  /** Tokens spent on the thinking block, shown beside the duration */
  tokens?: number;
  /** Start the block unfolded; a block carrying narration starts unfolded either way */
  defaultOpen?: boolean;
  /** Open state owned by the caller; omit to let the block keep its own */
  open?: boolean;
  /** Called with the next open state whenever the header is pressed */
  onOpenChange?: (open: boolean) => void;
  /** Called with the reasoning text when Copy is pressed, before the clipboard write */
  onCopy?: (text: string) => void;
  /** Extra class on the root */
  className?: string;
};

/* How long the copy label holds "Copied" before it returns to "Copy" */
const COPIED_MS = 1200;

/* Three lines of shrinking measure: a trace that was written down, not a brain. */
const traceMark = (
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
    <path d="M2.6 3.4h6.2" />
    <path d="M2.6 7h8.8" />
    <path d="M2.6 10.6h4.4" />
  </svg>
);

const lockMark = (
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
    <rect x="3.1" y="6.3" width="7.8" height="5.4" rx="1.5" />
    <path d="M4.9 6.3V4.7a2.1 2.1 0 0 1 4.2 0v1.6" />
  </svg>
);

const chevronMark = (
  <svg
    viewBox="0 0 14 14"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m3.5 5.4 3.5 3.4 3.5-3.4" />
  </svg>
);

const checkMark = (
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
    <path d="m2.2 6.3 2.5 2.4 5.1-5.4" />
  </svg>
);

/* Thinking time as the header writes it: "840ms", "3.2s", "12s", "1m 08s". */
function duration(ms: number): string {
  const value = Math.max(0, ms);
  if (value < 1000) return `${Math.round(value)}ms`;
  if (value < 10_000) return `${(value / 1000).toFixed(1)}s`;
  if (value < 60_000) return `${Math.round(value / 1000)}s`;
  const minutes = Math.floor(value / 60_000);
  const seconds = Math.round((value % 60_000) / 1000);
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function ReasoningBlock({
  text,
  narration,
  summary = false,
  redacted = false,
  durationMs,
  tokens,
  defaultOpen,
  open: openProp,
  onOpenChange,
  onCopy,
  className,
}: ReasoningBlockProps) {
  const foldId = useId();
  /* Narration is answer text the provider filed as thinking, so the block opens rather than
   * hiding part of the reply behind a disclosure the reader has no reason to press. */
  const [ownOpen, setOwnOpen] = useState(() => defaultOpen ?? narration !== undefined);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);

  const open = openProp ?? ownOpen;
  const body = redacted ? "" : text;

  useEffect(
    () => () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  const toggle = () => {
    const next = !open;
    if (openProp === undefined) setOwnOpen(next);
    onOpenChange?.(next);
  };

  const copy = () => {
    if (body.trim().length === 0) return;
    onCopy?.(body);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(body).catch(() => {});
    }
    setCopied(true);
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => {
      copyTimer.current = null;
      setCopied(false);
    }, COPIED_MS);
  };

  /* Duration first, then either the spend or the reason there is nothing to read. A redacted
   * block still reports how long the model took before the provider sealed it. */
  const meta: string[] = [];
  if (durationMs !== undefined && Number.isFinite(durationMs)) meta.push(duration(durationMs));
  if (redacted) meta.push("Withheld");
  else if (tokens !== undefined && Number.isFinite(tokens))
    meta.push(`${Math.max(0, Math.round(tokens)).toLocaleString("en-US")} tokens`);

  return (
    <div
      className={["ui-rsb", className].filter(Boolean).join(" ")}
      data-open={open ? "" : undefined}
      data-redacted={redacted ? "" : undefined}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-reasoning-block" precedence="default">
        {css}
      </style>

      <button
        type="button"
        className="ui-rsb__toggle"
        aria-expanded={open}
        aria-controls={foldId}
        onClick={toggle}
      >
        <span className="ui-rsb__glyph">{redacted ? lockMark : traceMark}</span>
        <span className="ui-rsb__label">Reasoning</span>
        {meta.length > 0 ? <span className="ui-rsb__meta">{meta.join(" · ")}</span> : null}
        <span className="ui-rsb__chevron">{chevronMark}</span>
      </button>

      <div className="ui-rsb__fold" id={foldId} inert={open ? undefined : true}>
        <div className="ui-rsb__clip">
          <div className="ui-rsb__body">
            {narration !== undefined ? (
              <div className="ui-rsb__narration">
                <span className="ui-rsb__tag" data-kind="answer">
                  Answer text
                </span>
                <p className="ui-rsb__narration-text">{narration}</p>
              </div>
            ) : null}

            {redacted ? (
              <div className="ui-rsb__locked">
                <span className="ui-rsb__locked-glyph">{lockMark}</span>
                <p className="ui-rsb__locked-title">The provider withheld this reasoning</p>
                <p className="ui-rsb__locked-note">
                  It arrived as a redacted thinking block, so there is nothing to read and
                  nothing to copy.
                </p>
              </div>
            ) : (
              <>
                {summary ? (
                  <div className="ui-rsb__summary">
                    <span className="ui-rsb__tag">Provider summary</span>
                    <p className="ui-rsb__note">
                      The provider shortened this reasoning before it reached the client.
                    </p>
                  </div>
                ) : null}
                <p className="ui-rsb__text">{text}</p>
                {body.trim().length > 0 ? (
                  <div className="ui-rsb__foot">
                    <button
                      type="button"
                      className="ui-rsb__copy"
                      data-copied={copied ? "" : undefined}
                      aria-label={copied ? "Reasoning copied" : "Copy reasoning"}
                      onClick={copy}
                    >
                      {copied ? <span className="ui-rsb__copy-glyph">{checkMark}</span> : null}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      <span className="ui-rsb__live" role="status" aria-live="polite">
        {copied ? "Reasoning copied to the clipboard" : ""}
      </span>
    </div>
  );
}

const css = /* css */ `
.ui-rsb {
  /* Knobs. Override any of these on .ui-rsb to retheme the block in a host. */
  --ui-rsb-ink: var(--text, #1a1410);
  --ui-rsb-muted: var(--text-muted, #6f625a);
  --ui-rsb-panel: var(--panel, #fffdfb);
  --ui-rsb-line: var(--border, #e8e0d7);
  --ui-rsb-edge: var(--border-soft, #1a14101a);
  --ui-rsb-wash: #7a4a1c0a;
  --ui-rsb-wash-strong: #7a4a1c12;
  --ui-rsb-ok: var(--success, #1a7a4a);
  --ui-rsb-warn: var(--warning, #9a6410);
  --ui-rsb-focus: var(--accent, #c2410c);
  --ui-rsb-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-rsb-ease-in: var(--nm-ease-in, cubic-bezier(0.55, 0, 0.68, 0.19));
  --ui-rsb-ease-both: var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1));
  --ui-rsb-dur: var(--nm-dur-2, 160ms);
  --ui-rsb-dur-fold: var(--nm-dur-4, 380ms);
  /* The trace sits under the header glyph; collapses at a narrow width */
  --ui-rsb-indent: 22px;

  position: relative;
  box-sizing: border-box;
  width: 100%;
  padding: 4px;
  background: var(--ui-rsb-panel);
  border-radius: var(--radius-card, 16px);
  box-shadow: inset 0 0 0 1px var(--ui-rsb-line);
  color: var(--ui-rsb-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 18px;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-rsb *,
.ui-rsb *::before,
.ui-rsb *::after {
  box-sizing: border-box;
}
.ui-rsb p {
  margin: 0;
}
:where(.ui-rsb) button {
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
:where(.ui-rsb) svg {
  display: block;
}

/* Header ------------------------------------------------------------------ */
.ui-rsb__toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 34px;
  padding: 7px 10px;
  border-radius: var(--radius-preview, 12px);
  color: var(--ui-rsb-ink);
  transition:
    background-color var(--ui-rsb-dur) var(--ui-rsb-ease-out),
    color var(--ui-rsb-dur) var(--ui-rsb-ease-out);
}
.ui-rsb__toggle:hover {
  background: var(--ui-rsb-wash);
}
.ui-rsb__toggle:focus-visible {
  outline: 2px solid var(--ui-rsb-focus);
  outline-offset: -1px;
}
.ui-rsb__glyph {
  display: grid;
  flex: none;
  place-items: center;
  width: 14px;
  height: 14px;
  color: var(--ui-rsb-muted);
  transition: color var(--ui-rsb-dur) var(--ui-rsb-ease-out);
}
.ui-rsb__toggle:hover .ui-rsb__glyph {
  color: var(--ui-rsb-ink);
}
/* The lock is the one thing in the block that carries a status, and the word "Withheld"
 * in the meta row says the same thing without relying on the tone. */
.ui-rsb[data-redacted] .ui-rsb__glyph,
.ui-rsb[data-redacted] .ui-rsb__toggle:hover .ui-rsb__glyph {
  color: var(--ui-rsb-warn);
}
.ui-rsb__label {
  flex: none;
  font-size: 12.5px;
  font-weight: 500;
  line-height: 18px;
  color: var(--ui-rsb-ink);
  white-space: nowrap;
}
.ui-rsb__meta {
  display: block;
  min-width: 0;
  margin-left: auto;
  overflow: hidden;
  color: var(--ui-rsb-muted);
  font-size: 11.5px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ui-rsb__chevron {
  display: grid;
  flex: none;
  place-items: center;
  width: 14px;
  height: 14px;
  color: var(--ui-rsb-muted);
  transform: rotate(0deg);
  transition:
    transform var(--ui-rsb-dur-fold) var(--ui-rsb-ease-both),
    color var(--ui-rsb-dur) var(--ui-rsb-ease-out);
}
.ui-rsb[data-open] .ui-rsb__chevron {
  transform: rotate(180deg);
}

/* Narration --------------------------------------------------------------- */
/* The provider filed it as thinking, but it is prose for the reader, so it sits first in the
 * body at full ink and the block opens itself rather than hiding part of the answer. */
.ui-rsb__narration {
  margin: 0 0 10px var(--ui-rsb-indent);
  padding: 10px 12px;
  border-radius: var(--radius-preview, 12px);
  background: var(--ui-rsb-wash-strong);
  box-shadow: inset 0 0 0 1px var(--ui-rsb-edge);
}
.ui-rsb__tag {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 7px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-rsb-panel);
  box-shadow: inset 0 0 0 1px var(--ui-rsb-line);
  color: var(--ui-rsb-muted);
  font-size: 10.5px;
  font-weight: 500;
  line-height: 16px;
  letter-spacing: 0.01em;
  white-space: nowrap;
}
.ui-rsb__tag[data-kind="answer"] {
  color: var(--ui-rsb-ink);
}
.ui-rsb__narration-text {
  margin-top: 7px;
  color: var(--ui-rsb-ink);
  font-size: 13px;
  line-height: 21px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* Fold -------------------------------------------------------------------- */
/* The row track carries the height, so the body needs no measured maximum. */
.ui-rsb__fold {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows var(--ui-rsb-dur-fold) var(--ui-rsb-ease-in),
    opacity var(--ui-rsb-dur-fold) var(--ui-rsb-ease-in);
}
.ui-rsb[data-open] .ui-rsb__fold {
  grid-template-rows: 1fr;
  opacity: 1;
  transition-timing-function: var(--ui-rsb-ease-out);
}
.ui-rsb__clip {
  min-height: 0;
  overflow: hidden;
}
.ui-rsb__body {
  padding: 2px 10px 10px;
}
.ui-rsb__text {
  padding-left: var(--ui-rsb-indent);
  color: var(--ui-rsb-muted);
  font-size: 13px;
  line-height: 21px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* Provider summary -------------------------------------------------------- */
.ui-rsb__summary {
  display: grid;
  gap: 5px;
  justify-items: start;
  padding: 2px 0 9px var(--ui-rsb-indent);
}
.ui-rsb__note {
  color: var(--ui-rsb-muted);
  font-size: 11.5px;
  line-height: 17px;
}

/* Redacted ---------------------------------------------------------------- */
.ui-rsb__locked {
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr);
  gap: 4px 10px;
  margin-left: var(--ui-rsb-indent);
  padding: 10px 12px;
  border-radius: var(--radius-preview, 12px);
  background: var(--ui-rsb-wash);
  box-shadow: inset 0 0 0 1px var(--ui-rsb-edge);
}
.ui-rsb__locked-glyph {
  display: grid;
  place-items: center;
  width: 14px;
  height: 14px;
  padding-top: 2px;
  color: var(--ui-rsb-warn);
}
.ui-rsb__locked-title {
  grid-column: 2;
  color: var(--ui-rsb-ink);
  font-size: 12.5px;
  font-weight: 500;
  line-height: 18px;
}
.ui-rsb__locked-note {
  grid-column: 2;
  color: var(--ui-rsb-muted);
  font-size: 11.5px;
  line-height: 17px;
}

/* Copy -------------------------------------------------------------------- */
.ui-rsb__foot {
  display: flex;
  justify-content: flex-end;
  padding: 8px 0 0 var(--ui-rsb-indent);
}
.ui-rsb__copy {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 9px;
  border-radius: var(--radius-pill, 999px);
  box-shadow: inset 0 0 0 1px var(--ui-rsb-edge);
  color: var(--ui-rsb-muted);
  font-size: 11.5px;
  font-weight: 500;
  line-height: 16px;
  transition:
    color var(--ui-rsb-dur) var(--ui-rsb-ease-out),
    background-color var(--ui-rsb-dur) var(--ui-rsb-ease-out),
    box-shadow var(--ui-rsb-dur) var(--ui-rsb-ease-out);
}
.ui-rsb__copy:hover {
  color: var(--ui-rsb-ink);
  background: var(--ui-rsb-wash);
}
.ui-rsb__copy:focus-visible {
  outline: 2px solid var(--ui-rsb-focus);
  outline-offset: 1px;
}
/* Success is a state, not the accent: the check and the word carry it too. */
.ui-rsb__copy[data-copied] {
  color: var(--ui-rsb-ok);
  background: var(--ui-rsb-wash);
}
.ui-rsb__copy-glyph {
  display: grid;
  place-items: center;
  width: 12px;
  height: 12px;
}

/* Live region ------------------------------------------------------------- */
.ui-rsb__live {
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

/* The trace indents under its glyph; at a narrow width the measure is worth more than the
 * alignment, so the indent collapses and the block uses the full width. */
@media (max-width: 420px) {
  .ui-rsb {
    --ui-rsb-indent: 0px;
  }
}

:where(.dark, [data-theme="dark"]) .ui-rsb {
  --ui-rsb-ink: var(--text, #f4ece4);
  --ui-rsb-muted: var(--text-muted, #a2958a);
  --ui-rsb-panel: var(--panel, #1a1512);
  --ui-rsb-line: var(--border, #33291f);
  --ui-rsb-edge: var(--border-soft, #ffffff12);
  --ui-rsb-wash: #ffffff0d;
  --ui-rsb-wash-strong: #ffffff12;
  --ui-rsb-ok: var(--success, #4f9d6e);
  --ui-rsb-warn: var(--warning, #d99530);
  --ui-rsb-focus: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  .ui-rsb__toggle,
  .ui-rsb__glyph,
  .ui-rsb__chevron,
  .ui-rsb__fold,
  .ui-rsb__copy {
    animation: none;
    transition-duration: 1ms;
  }
}
`;
