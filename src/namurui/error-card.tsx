"use client";

import { useState } from "react";

/*
 * Error Card: a failed turn in the transcript — the provider's message as the headline, the
 * provider that answered beneath it, and a retry only when another attempt could land
 * differently. The card settles in from above on the enter step; dismissing folds it to a
 * one-line receipt that Undo restores, so the failure stays in the record without holding the
 * page. The card never takes the ember accent: the accent marks the live thing, and a failure
 * is not alive. The styles are injected below, so no extra files are needed.
 */

export type ErrorCardProps = {
  /** Which step failed, e.g. "Turn failed" */
  title?: string;
  /** The provider's own words, rendered as the headline */
  message: string;
  /** Provider that answered, shown in the metadata line */
  provider?: string;
  /** Model the request named, shown in the metadata line */
  model?: string;
  /** HTTP status of the failure, rendered as a number and never inferred from the message */
  httpStatus?: number;
  /** Whether another attempt could land; Retry appears only when true */
  retryable?: boolean;
  /** Attempt already spent, from auto_retry_start */
  attempt?: number;
  /** Ceiling the bridge will stop at, from auto_retry_start */
  maxAttempts?: number;
  /** A retry is in flight; the label becomes a spinner and the button is disabled */
  retrying?: boolean;
  /** Fold the card to its receipt from outside; omit to let the card own the fold */
  dismissed?: boolean;
  /** Retry handler, called by Retry or Retry now */
  onRetry?: () => void;
  /** Called with the fold state the card asks for: true on Dismiss, false on Undo */
  onDismiss?: (dismissed: boolean) => void;
  /** Whether this is the newest failure; only the newest one takes role="alert" */
  isLatest?: boolean;
  /** Extra class on the root */
  className?: string;
};

const FAILED_GLYPH = (
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
    <path d="M7 1.9 12.4 11.6H1.6L7 1.9Z" />
    <path d="M7 5.4v2.6" />
    <circle cx="7" cy="9.9" r="0.6" fill="currentColor" stroke="none" />
  </svg>
);

/* A struck-through ring: this request cannot be made to work by sending it again. */
const BLOCKED_GLYPH = (
  <svg
    viewBox="0 0 14 14"
    width="13"
    height="13"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <circle cx="7" cy="7" r="5" />
    <path d="M3.5 10.5 10.5 3.5" />
  </svg>
);

/* The scheduled retry already sits on the bridge's clock. */
const CLOCK_GLYPH = (
  <svg
    viewBox="0 0 12 12"
    width="12"
    height="12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <circle cx="6" cy="6" r="4.3" />
    <path d="M6 3.7V6l1.6 1" />
  </svg>
);

export function ErrorCard({
  title = "Turn failed",
  message,
  provider,
  model,
  httpStatus,
  retryable = false,
  attempt,
  maxAttempts,
  retrying = false,
  dismissed,
  onRetry,
  onDismiss,
  isLatest = true,
  className,
}: ErrorCardProps) {
  const [ownFolded, setOwnFolded] = useState(false);
  const folded = dismissed ?? ownFolded;

  const fold = (next: boolean) => {
    if (dismissed === undefined) setOwnFolded(next);
    onDismiss?.(next);
  };

  /* Only the parts that exist reach the line, so a bare error never leaves a dangling dot. */
  const meta: string[] = [];
  if (provider) meta.push(provider);
  if (model) meta.push(model);
  if (httpStatus !== undefined && Number.isFinite(httpStatus)) meta.push(`HTTP ${httpStatus}`);

  const attempts =
    attempt === undefined
      ? ""
      : maxAttempts === undefined
        ? `Attempt ${attempt}`
        : `Attempt ${attempt} of ${maxAttempts}`;

  const alertRole = isLatest && !folded ? "alert" : undefined;

  return (
    <div
      className={["ui-erc", className].filter(Boolean).join(" ")}
      data-state={folded ? "dismissed" : "open"}
      role={alertRole}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-error-card" precedence="default">
        {css}
      </style>

      {folded ? (
        <div className="ui-erc__receipt">
          <span className="ui-erc__glyph ui-erc__glyph--folded" aria-hidden="true">
            {FAILED_GLYPH}
          </span>
          <span className="ui-erc__receipt-label">{title}</span>
          <span className="ui-erc__receipt-text" title={message}>
            {message}
          </span>
          <button type="button" className="ui-erc__undo" onClick={() => fold(false)}>
            Undo
          </button>
        </div>
      ) : (
        <>
          <header className="ui-erc__head">
            <span className="ui-erc__glyph" aria-hidden="true">
              {FAILED_GLYPH}
            </span>
            <span className="ui-erc__kicker">{title}</span>
          </header>

          <p className="ui-erc__message">{message}</p>

          {meta.length > 0 ? <p className="ui-erc__meta">{meta.join(" · ")}</p> : null}

          {retryable ? null : (
            <p className="ui-erc__why">
              <span className="ui-erc__why-glyph" aria-hidden="true">
                {BLOCKED_GLYPH}
              </span>
              Retrying will fail the same way — the request itself was rejected.
            </p>
          )}

          {attempts ? (
            <p className="ui-erc__schedule">
              <span className="ui-erc__attempt">{attempts}</span>
              <span className="ui-erc__note">
                <span className="ui-erc__note-glyph" aria-hidden="true">
                  {CLOCK_GLYPH}
                </span>
                {retryable
                  ? "A retry is already scheduled."
                  : "No further attempt is scheduled."}
              </span>
            </p>
          ) : null}

          <div className="ui-erc__actions">
            {retryable ? (
              <button
                type="button"
                className="ui-erc__retry"
                disabled={retrying}
                aria-busy={retrying || undefined}
                onClick={() => onRetry?.()}
              >
                {retrying ? (
                  <>
                    <span className="ui-erc__spinner" aria-hidden="true" />
                    {/* Read out while it spins, and shown as a word once motion is off */}
                    <span className="ui-erc__busy">Retrying</span>
                  </>
                ) : (
                  <span className="ui-erc__retry-label">
                    {attempt === undefined ? "Retry" : "Retry now"}
                  </span>
                )}
              </button>
            ) : null}
            <button type="button" className="ui-erc__dismiss" onClick={() => fold(true)}>
              Dismiss
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const css = /* css */ `
.ui-erc {
  /* Knobs. Override any of these on .ui-erc to retheme the card in a host. */
  --ui-erc-ink: var(--text, #1a1410);
  --ui-erc-muted: var(--text-muted, #6f625a);
  --ui-erc-panel: var(--panel, #fffdfb);
  --ui-erc-line: var(--border, #e8e0d7);
  --ui-erc-edge: var(--border-soft, #1a14101a);
  --ui-erc-wash: #7a4a1c0a;
  --ui-erc-danger: var(--danger, #b3261e);
  --ui-erc-danger-wash: #b3261e10;
  --ui-erc-danger-soft: #b3261e80;
  --ui-erc-action-bg: var(--text, #1a1410);
  --ui-erc-action-ink: var(--panel, #fffdfb);
  --ui-erc-focus: var(--text, #1a1410);
  --ui-erc-spin-track: #fffdfb4d;
  --ui-erc-spin-head: #fffdfb;
  --ui-erc-ease: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-erc-ease-soft: var(--nm-ease-soft, cubic-bezier(0.4, 0, 0.2, 1));
  --ui-erc-dur-1: var(--nm-dur-1, 90ms);
  --ui-erc-dur-2: var(--nm-dur-2, 160ms);
  --ui-erc-dur-3: var(--nm-dur-3, 240ms);
  --ui-erc-dur-spin: var(--nm-dur-5, 620ms);

  box-sizing: border-box;
  position: relative;
  display: grid;
  gap: 8px;
  width: 100%;
  padding: 13px 16px 13px 19px;
  background: var(--ui-erc-panel);
  border-radius: var(--radius-card, 16px);
  /* The danger rule sits on the leading edge, inside the border, so the card never
   * changes size when it folds. */
  box-shadow:
    inset 3px 0 0 0 var(--ui-erc-danger),
    inset 0 0 0 1px var(--ui-erc-line);
  color: var(--ui-erc-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 18px;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
  animation: ui-erc-enter var(--ui-erc-dur-3) var(--ui-erc-ease) both;
}
.ui-erc *,
.ui-erc *::before,
.ui-erc *::after {
  box-sizing: border-box;
}
.ui-erc p {
  margin: 0;
}
:where(.ui-erc) button {
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
:where(.ui-erc) svg {
  display: block;
}

.ui-erc[data-state="dismissed"] {
  gap: 0;
  padding: 9px 12px 9px 15px;
  box-shadow:
    inset 2px 0 0 0 var(--ui-erc-danger-soft),
    inset 0 0 0 1px var(--ui-erc-line);
}

/* Header ------------------------------------------------------------------ */
.ui-erc__head {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 16px;
}
.ui-erc__glyph {
  display: grid;
  flex: none;
  place-items: center;
  width: 14px;
  height: 14px;
  color: var(--ui-erc-danger);
}
.ui-erc__kicker {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 11.5px;
  font-weight: 500;
  line-height: 16px;
  color: var(--ui-erc-muted);
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* Copy -------------------------------------------------------------------- */
.ui-erc__message {
  font-size: 13.5px;
  font-weight: 500;
  line-height: 20px;
  color: var(--ui-erc-ink);
  overflow-wrap: anywhere;
}
.ui-erc__meta {
  font-size: 11.5px;
  line-height: 16px;
  color: var(--ui-erc-muted);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.ui-erc__why {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 7px 10px;
  border-radius: var(--radius-preview, 12px);
  background: var(--ui-erc-danger-wash);
  font-size: 11.5px;
  line-height: 16px;
  color: var(--ui-erc-muted);
}
.ui-erc__why-glyph {
  display: grid;
  flex: none;
  place-items: center;
  width: 13px;
  height: 13px;
  margin-top: 1.5px;
  color: var(--ui-erc-danger);
}

/* Scheduled retry --------------------------------------------------------- */
.ui-erc__schedule {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}
.ui-erc__attempt {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-erc-wash);
  box-shadow: inset 0 0 0 1px var(--ui-erc-edge);
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  color: var(--ui-erc-ink);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.ui-erc__note {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  font-size: 11.5px;
  line-height: 16px;
  color: var(--ui-erc-muted);
}
.ui-erc__note-glyph {
  display: grid;
  flex: none;
  place-items: center;
  width: 12px;
  height: 12px;
  color: var(--ui-erc-muted);
}

/* Actions ----------------------------------------------------------------- */
.ui-erc__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}
.ui-erc__retry {
  display: inline-flex;
  position: relative;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 82px;
  height: 28px;
  padding: 0 12px;
  border-radius: var(--radius-control, 8px);
  background: var(--ui-erc-action-bg);
  color: var(--ui-erc-action-ink);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
  transition:
    opacity var(--ui-erc-dur-2) var(--ui-erc-ease),
    transform var(--ui-erc-dur-1) var(--ui-erc-ease);
}
.ui-erc__retry:hover:not(:disabled) {
  opacity: 0.88;
}
.ui-erc__retry:active:not(:disabled) {
  transform: scale(0.98);
}
.ui-erc__retry:disabled {
  cursor: default;
  opacity: 0.78;
}
.ui-erc__spinner {
  display: block;
  width: 12px;
  height: 12px;
  border: 1.5px solid var(--ui-erc-spin-track);
  border-top-color: var(--ui-erc-spin-head);
  border-radius: 50%;
  animation: ui-erc-spin var(--ui-erc-dur-spin) var(--ui-erc-ease-soft) infinite;
}
@keyframes ui-erc-spin {
  to {
    transform: rotate(360deg);
  }
}
.ui-erc__dismiss {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  border-radius: var(--radius-control, 8px);
  color: var(--ui-erc-muted);
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
  transition:
    color var(--ui-erc-dur-2) var(--ui-erc-ease),
    background-color var(--ui-erc-dur-2) var(--ui-erc-ease);
}
.ui-erc__dismiss:hover {
  background: var(--ui-erc-wash);
  color: var(--ui-erc-ink);
}
.ui-erc__retry:focus-visible,
.ui-erc__dismiss:focus-visible,
.ui-erc__undo:focus-visible {
  outline: 2px solid var(--ui-erc-focus);
  outline-offset: 2px;
}
.ui-erc__busy {
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

/* Receipt ----------------------------------------------------------------- */
.ui-erc__receipt {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  animation: ui-erc-fold var(--ui-erc-dur-3) var(--ui-erc-ease) both;
}
.ui-erc__glyph--folded {
  color: var(--ui-erc-danger-soft);
}
.ui-erc__receipt-label {
  flex: none;
  font-size: 11.5px;
  font-weight: 500;
  line-height: 16px;
  color: var(--ui-erc-muted);
  white-space: nowrap;
}
.ui-erc__receipt-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 11.5px;
  line-height: 16px;
  color: var(--ui-erc-muted);
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-erc__undo {
  flex: none;
  height: 24px;
  padding: 0 9px;
  border-radius: 7px;
  box-shadow: inset 0 0 0 1px var(--ui-erc-edge);
  color: var(--ui-erc-ink);
  font-size: 11.5px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
  transition: background-color var(--ui-erc-dur-2) var(--ui-erc-ease);
}
.ui-erc__undo:hover {
  background: var(--ui-erc-wash);
}

@keyframes ui-erc-enter {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}
@keyframes ui-erc-fold {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
}

:where(.dark, [data-theme="dark"]) .ui-erc {
  --ui-erc-ink: var(--text, #f4ece4);
  --ui-erc-muted: var(--text-muted, #a2958a);
  --ui-erc-panel: var(--panel, #1a1512);
  --ui-erc-line: var(--border, #33291f);
  --ui-erc-edge: var(--border-soft, #ffffff12);
  --ui-erc-wash: #ffffff0d;
  --ui-erc-danger: var(--danger, #e2544a);
  --ui-erc-danger-wash: #e2544a14;
  --ui-erc-danger-soft: #e2544a80;
  --ui-erc-action-bg: var(--text, #f4ece4);
  --ui-erc-action-ink: var(--panel, #1a1512);
  --ui-erc-focus: var(--text, #f4ece4);
  --ui-erc-spin-track: #1a15124d;
  --ui-erc-spin-head: #1a1512;
}

@media (prefers-reduced-motion: reduce) {
  .ui-erc,
  .ui-erc__receipt {
    animation: none;
  }
  /* A ring that cannot turn is a worse signal than a word, so the label takes over */
  .ui-erc__spinner {
    display: none;
  }
  .ui-erc__busy {
    position: static;
    width: auto;
    height: auto;
    margin: 0;
    overflow: visible;
    clip-path: none;
  }
  .ui-erc__retry,
  .ui-erc__dismiss,
  .ui-erc__undo {
    transition-duration: 1ms;
  }
  .ui-erc__retry:active:not(:disabled) {
    transform: none;
  }
}
`;
