"use client";

import { useId, useState, type ReactNode } from "react";

/*
 * Compaction Divider: the in-transcript mark for a context compaction, drawn as a rule with
 * a chip sitting on it so it separates turns rather than reading as a card. While the bridge
 * is compacting, a highlight sweeps along both halves of the rule at the ambient step, one
 * half handing the sweep to the other so it reads as a single pass under the chip. When the
 * end frame lands the chip reports the token drop and the method, and expands to the summary
 * the compaction kept. Styles are injected below, so no extra files are needed.
 */

export type CompactionReason = "threshold" | "overflow" | "idle" | "incomplete";

export type CompactionAction = "context-full" | "remote" | "handoff" | "shake" | "snapcompact";

export type CompactionStatus = "running" | "done" | "failed" | "skipped";

export type CompactionDividerProps = {
  /** Why the bridge compacted: the threshold was reached, the window overflowed, the run went idle, or a turn was left incomplete */
  reason: CompactionReason;
  /** How it compacted: which strategy produced the summary */
  action: CompactionAction;
  /** Where the compaction is; a skipped compaction draws nothing at all */
  status: CompactionStatus;
  /** Tokens the window held before the compaction */
  tokensBefore?: number;
  /** Tokens the window holds after the compaction */
  tokensAfter?: number;
  /** The summary the compaction kept, revealed when the chip is expanded */
  shortSummary?: string;
  /** Message from the failed end frame, shown under the rule */
  error?: string;
  /** Retry the compaction; the button is only drawn when this is given */
  onRetry?: () => void;
  /** Own the expanded state from outside; omit to let the divider hold it */
  expanded?: boolean;
  /** Called with the next expanded state, whether the divider or the caller holds it */
  onExpandedChange?: (expanded: boolean) => void;
  /** Extra class on the root */
  className?: string;
};

/* The method the end frame reported, in the words a reader can scan. The raw token
 * stays on the badge's title, because it is the protocol field. */
const METHOD_LABEL: Record<CompactionAction, string> = {
  "context-full": "context full",
  remote: "remote",
  handoff: "handoff",
  shake: "shake",
  snapcompact: "snapcompact",
};

/* One glyph per state: two arrows closing on each other while it runs, a tick when it
 * lands, a cross when it does not. */
const STATUS_GLYPH: Record<Exclude<CompactionStatus, "skipped">, ReactNode> = {
  running: (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 1.3v3.1" />
      <path d="M4.4 2.9 6 4.5l1.6-1.6" />
      <path d="M6 10.7V7.6" />
      <path d="M4.4 9.1 6 7.5l1.6 1.6" />
    </svg>
  ),
  done: (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.2 6.4 4.8 9 9.8 3.4" />
    </svg>
  ),
  failed: (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M3 3l6 6" />
      <path d="M9 3 3 9" />
    </svg>
  ),
};

const CHEVRON = (
  <svg
    viewBox="0 0 12 12"
    width="12"
    height="12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2.6 4.5 6 7.9l3.4-3.4" />
  </svg>
);

/* Token counts read at a glance: 128_400 is 128k, and a decimal only survives below
 * ten thousand, where dropping it would hide most of the figure. */
function tokens(value: number): string {
  const n = Math.max(0, Math.round(value));
  if (n < 1000) return String(n);
  const k = n / 1000;
  if (k < 10) return `${(Math.round(k * 10) / 10).toFixed(1).replace(/\.0$/, "")}k`;
  return `${Math.round(k)}k`;
}

export function CompactionDivider({
  reason,
  action,
  status,
  tokensBefore,
  tokensAfter,
  shortSummary,
  error,
  onRetry,
  expanded,
  onExpandedChange,
  className,
}: CompactionDividerProps) {
  const [openState, setOpenState] = useState(false);
  const panelId = useId();

  const canExpand = typeof shortSummary === "string" && shortSummary.length > 0;
  const open = canExpand && (expanded ?? openState);

  const toggle = () => {
    const next = !open;
    if (expanded === undefined) setOpenState(next);
    onExpandedChange?.(next);
  };

  /* A skipped compaction is the protocol saying nothing happened, so it draws nothing —
   * not an empty rule, not a zero-length row. */
  if (status === "skipped") return null;

  const before = tokensBefore === undefined ? undefined : Math.max(0, Math.round(tokensBefore));
  const after = tokensAfter === undefined ? undefined : Math.max(0, Math.round(tokensAfter));

  /* A compaction that left the window bigger saved nothing, and the read-out says so by
   * falling silent rather than by printing a negative percentage. */
  const saved =
    before !== undefined && after !== undefined && before > after
      ? Math.min(100, Math.round(((before - after) / before) * 100))
      : 0;

  let label: ReactNode;
  if (status === "running") {
    label = (
      <>
        Compacting
        <span className="ui-cpd__sep" aria-hidden="true">
          {" · "}
        </span>
        <span className="ui-cpd__sr">, </span>
        <span className="ui-cpd__reason">{reason}</span>
      </>
    );
  } else if (status === "done") {
    if (before !== undefined && after !== undefined) {
      label = (
        <>
          <span className="ui-cpd__num">{tokens(before)}</span>
          <span className="ui-cpd__arrow" aria-hidden="true">
            →
          </span>
          <span className="ui-cpd__sr">to </span>
          <span className="ui-cpd__num ui-cpd__num--after">{tokens(after)}</span>
        </>
      );
    } else if (after !== undefined) {
      label = <>now {tokens(after)}</>;
    } else {
      label = <>Compacted</>;
    }
  } else {
    label = <>Compaction failed</>;
  }

  const announcement =
    status === "running"
      ? `Compacting the context, ${reason}.`
      : status === "done"
        ? `Compaction done${before !== undefined && after !== undefined ? `, ${tokens(before)} to ${tokens(after)}` : ""}${saved > 0 ? `, ${saved} percent saved` : ""}, method ${METHOD_LABEL[action]}.`
        : `Compaction failed. ${error ?? "No reason was reported."}`;

  const chipBody = (
    <>
      <span className="ui-cpd__glyph" aria-hidden="true">
        {STATUS_GLYPH[status]}
      </span>
      <span className="ui-cpd__label">{label}</span>
      {status === "done" && saved > 0 ? (
        <span className="ui-cpd__saved">saved {saved}%</span>
      ) : null}
      {status === "done" ? (
        <span className="ui-cpd__method" title={`compaction action: ${action}`}>
          {METHOD_LABEL[action]}
        </span>
      ) : null}
      {canExpand ? (
        <span className="ui-cpd__chevron" aria-hidden="true">
          {CHEVRON}
        </span>
      ) : null}
    </>
  );

  return (
    <div
      className={["ui-cpd", className].filter(Boolean).join(" ")}
      data-status={status}
      data-expanded={open ? "true" : "false"}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-compaction-divider" precedence="default">
        {css}
      </style>

      <p className="ui-cpd__sr" role="status" aria-live="polite">
        {announcement}
      </p>

      <div className="ui-cpd__bar">
        <span className="ui-cpd__rule" data-side="lead" aria-hidden="true">
          {status === "running" ? <span className="ui-cpd__sweep" /> : null}
        </span>

        {canExpand ? (
          <button
            type="button"
            className="ui-cpd__chip"
            data-interactive="true"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={toggle}
          >
            {chipBody}
          </button>
        ) : (
          <span className="ui-cpd__chip">{chipBody}</span>
        )}

        <span className="ui-cpd__rule" data-side="trail" aria-hidden="true">
          {status === "running" ? <span className="ui-cpd__sweep" /> : null}
        </span>
      </div>

      {status === "failed" ? (
        <div className="ui-cpd__error">
          <span className="ui-cpd__error-glyph" aria-hidden="true">
            {STATUS_GLYPH.failed}
          </span>
          <p className="ui-cpd__error-text">{error ?? "The compaction stopped before it finished."}</p>
          {onRetry ? (
            <button type="button" className="ui-cpd__retry" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {canExpand && open ? (
        <p className="ui-cpd__summary" id={panelId}>
          {shortSummary}
        </p>
      ) : null}
    </div>
  );
}

const css = /* css */ `
.ui-cpd {
  /* Knobs. Override any of these on .ui-cpd to retheme the divider in a host. */
  --ui-cpd-ink: var(--text, #1a1410);
  --ui-cpd-muted: var(--text-muted, #6f625a);
  --ui-cpd-line: var(--border, #e8e0d7);
  --ui-cpd-wash: #7a4a1c0a;
  --ui-cpd-edge: var(--border-soft, #1a14101a);
  --ui-cpd-accent: var(--accent, #c2410c);
  --ui-cpd-ok: var(--success, #1a7a4a);
  --ui-cpd-danger: var(--danger, #b3261e);
  --ui-cpd-focus: var(--accent, #c2410c);
  --ui-cpd-dur: var(--nm-dur-2, 160ms);
  --ui-cpd-dur-in: var(--nm-dur-3, 240ms);
  --ui-cpd-dur-sweep: var(--nm-dur-6, 1100ms);
  --ui-cpd-ease: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-cpd-ease-both: var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1));
  --ui-cpd-ease-soft: var(--nm-ease-soft, cubic-bezier(0.4, 0, 0.2, 1));
  /* The tone carries the state; the word beside it says the same thing, so a status
   * is never colour alone. Running has no verdict yet, so it keeps the ink tone and
   * lets the sweep carry the accent. */
  --ui-cpd-tone: var(--ui-cpd-muted);

  box-sizing: border-box;
  display: grid;
  gap: 2px;
  width: 100%;
  color: var(--ui-cpd-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 18px;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-cpd *,
.ui-cpd *::before,
.ui-cpd *::after {
  box-sizing: border-box;
}
.ui-cpd p {
  margin: 0;
}
:where(.ui-cpd) button {
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
:where(.ui-cpd) svg {
  display: block;
}

.ui-cpd[data-status="running"] {
  --ui-cpd-tone: var(--ui-cpd-ink);
}
.ui-cpd[data-status="done"] {
  --ui-cpd-tone: var(--ui-cpd-ok);
}
.ui-cpd[data-status="failed"] {
  --ui-cpd-tone: var(--ui-cpd-danger);
}

/* The rule ---------------------------------------------------------------- */
.ui-cpd__bar {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 30px;
}
/* Three pixels of track around a one-pixel hairline: the hairline is the divider,
 * the extra height is the room the sweep needs to read as light travelling along it. */
.ui-cpd__rule {
  position: relative;
  flex: 1 1 0;
  min-width: 12px;
  height: 3px;
  overflow: hidden;
  border-radius: var(--radius-pill, 999px);
}
.ui-cpd__rule::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 1px;
  height: 1px;
  background: var(--ui-cpd-line);
}
.ui-cpd__sweep {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 42%;
  border-radius: var(--radius-pill, 999px);
  background: linear-gradient(90deg, transparent, var(--ui-cpd-accent), transparent);
  opacity: 0;
  transform: translateX(-100%);
  animation: ui-cpd-sweep var(--ui-cpd-dur-sweep) var(--ui-cpd-ease-soft) infinite;
}
/* The trail half starts mid-cycle, so the sweep appears to cross under the chip and
 * carry on rather than restarting on the far side. */
.ui-cpd__rule[data-side="trail"] .ui-cpd__sweep {
  animation-delay: calc(var(--ui-cpd-dur-sweep) * -0.5);
}
@keyframes ui-cpd-sweep {
  0% {
    transform: translateX(-100%);
    opacity: 0;
  }
  8% {
    opacity: 1;
  }
  42% {
    opacity: 1;
  }
  50% {
    transform: translateX(240%);
    opacity: 0;
  }
  100% {
    transform: translateX(240%);
    opacity: 0;
  }
}

/* The chip ---------------------------------------------------------------- */
.ui-cpd__chip {
  display: inline-flex;
  flex: 0 1 auto;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
  min-height: 26px;
  padding: 3px 9px;
  border-radius: var(--radius-pill, 999px);
  color: var(--ui-cpd-muted);
  font-size: 11.5px;
  line-height: 16px;
  white-space: nowrap;
  transition:
    background-color var(--ui-cpd-dur) var(--ui-cpd-ease),
    box-shadow var(--ui-cpd-dur) var(--ui-cpd-ease);
}
.ui-cpd__chip[data-interactive="true"]:hover {
  background: var(--ui-cpd-wash);
}
.ui-cpd__chip[data-interactive="true"]:focus-visible {
  outline: 2px solid var(--ui-cpd-focus);
  outline-offset: 2px;
}
.ui-cpd__glyph {
  display: grid;
  flex: none;
  place-items: center;
  width: 12px;
  height: 12px;
  color: var(--ui-cpd-tone);
  transition: color var(--ui-cpd-dur) var(--ui-cpd-ease);
}
.ui-cpd__label {
  display: block;
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--ui-cpd-ink);
  text-overflow: ellipsis;
}
.ui-cpd[data-status="failed"] .ui-cpd__label {
  color: var(--ui-cpd-danger);
}
.ui-cpd__sep,
.ui-cpd__reason {
  color: var(--ui-cpd-muted);
}
/* The figure the window left behind recedes; the figure it holds now is the point of
 * the row, so only that one carries the ink weight. */
.ui-cpd__num {
  color: var(--ui-cpd-muted);
  font-variant-numeric: tabular-nums;
}
.ui-cpd__num--after {
  color: var(--ui-cpd-ink);
  font-weight: 500;
}
.ui-cpd__arrow {
  margin: 0 4px;
  color: var(--ui-cpd-muted);
}
.ui-cpd__saved {
  flex: none;
  color: var(--ui-cpd-muted);
  font-variant-numeric: tabular-nums;
}
.ui-cpd__method {
  flex: none;
  padding: 0 6px;
  border-radius: 6px;
  background: var(--ui-cpd-wash);
  box-shadow: inset 0 0 0 1px var(--ui-cpd-edge);
  color: var(--ui-cpd-muted);
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  font-size: 10.5px;
  line-height: 15px;
}
.ui-cpd__chevron {
  display: grid;
  flex: none;
  place-items: center;
  width: 12px;
  height: 12px;
  color: var(--ui-cpd-muted);
  transform: rotate(0deg);
  transition: transform var(--ui-cpd-dur) var(--ui-cpd-ease-both);
}
.ui-cpd[data-expanded="true"] .ui-cpd__chevron {
  transform: rotate(180deg);
}

/* What the compaction left ------------------------------------------------ */
.ui-cpd__summary {
  width: 100%;
  max-width: 460px;
  margin: 0 auto;
  padding: 7px 10px;
  border-radius: var(--radius-preview, 12px);
  background: var(--ui-cpd-wash);
  color: var(--ui-cpd-muted);
  font-size: 11.5px;
  line-height: 17px;
  animation: ui-cpd-in var(--ui-cpd-dur-in) var(--ui-cpd-ease) both;
}
@keyframes ui-cpd-in {
  from {
    opacity: 0;
    transform: translateY(-2px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.ui-cpd__error {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  width: 100%;
  max-width: 460px;
  margin: 0 auto;
  padding: 0 2px;
}
.ui-cpd__error-glyph {
  display: grid;
  flex: none;
  place-items: center;
  width: 12px;
  height: 12px;
  margin-top: 3px;
  color: var(--ui-cpd-danger);
}
.ui-cpd__error-text {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--ui-cpd-danger);
  font-size: 11.5px;
  line-height: 17px;
}
.ui-cpd__retry {
  flex: none;
  height: 24px;
  padding: 0 9px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px var(--ui-cpd-edge);
  color: var(--ui-cpd-ink);
  font-size: 11.5px;
  line-height: 16px;
  transition:
    background-color var(--ui-cpd-dur) var(--ui-cpd-ease),
    transform var(--nm-dur-1, 90ms) var(--ui-cpd-ease);
}
.ui-cpd__retry:hover {
  background: var(--ui-cpd-wash);
}
.ui-cpd__retry:active {
  transform: translateY(0.5px);
}
.ui-cpd__retry:focus-visible {
  outline: 2px solid var(--ui-cpd-focus);
  outline-offset: 2px;
}

/* Read by a screen reader only: the announcement, and the words the glyphs stand in
 * for. */
.ui-cpd__sr {
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

:where(.dark, [data-theme="dark"]) .ui-cpd {
  --ui-cpd-ink: var(--text, #f4ece4);
  --ui-cpd-muted: var(--text-muted, #a2958a);
  --ui-cpd-line: var(--border, #33291f);
  --ui-cpd-wash: #ffffff0d;
  --ui-cpd-edge: var(--border-soft, #ffffff12);
  --ui-cpd-accent: var(--accent, #ff6b35);
  --ui-cpd-ok: var(--success, #4f9d6e);
  --ui-cpd-danger: var(--danger, #e2544a);
  --ui-cpd-focus: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  /* The sweep is the only thing that moves on its own; stopped, the rule says the same
   * thing with a dash pattern instead of a travelling highlight. */
  .ui-cpd__sweep {
    display: none;
  }
  .ui-cpd[data-status="running"] .ui-cpd__rule::before {
    background: repeating-linear-gradient(
      90deg,
      var(--ui-cpd-line) 0 4px,
      transparent 4px 8px
    );
  }
  .ui-cpd__chip,
  .ui-cpd__glyph,
  .ui-cpd__chevron,
  .ui-cpd__retry {
    transition-duration: 1ms;
  }
  .ui-cpd__summary {
    animation: none;
  }
}
`;
