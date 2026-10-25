"use client";

import { useEffect, useRef, useState } from "react";

/*
 * Agent Diff: the code an agent produced, hunk by hunk, reviewed and applied in place.
 * Hunks rise into view in file order; Accept springs a hunk to its applied state and tweens
 * the header counters to the new totals; Reject collapses the hunk out of the body. The changed
 * words inside a rewritten line carry their own mark, so a reviewer sees what moved rather than
 * only that a line moved. Styles are injected below, so no extra files are needed.
 */

export type DiffLineKind = "context" | "add" | "remove";

export type DiffSpan = {
  /** A run of characters inside one line */
  text: string;
  /** True when this run is the part that actually moved */
  changed?: boolean;
};

export type DiffLine = {
  kind: DiffLineKind;
  /** Line number before the edit, null for an addition */
  oldLine: number | null;
  /** Line number after the edit, null for a removal */
  newLine: number | null;
  /** The line as plain text, used when no spans are given */
  text: string;
  /** Splits the line so the changed words can carry their own mark */
  spans?: readonly DiffSpan[];
};

export type DiffHunk = {
  /** Stable id, used as the key and handed back to onDecide */
  id: string;
  /** The @@ header, exactly as git writes it */
  header: string;
  lines: readonly DiffLine[];
};

export type HunkDecision = "pending" | "accepted" | "rejected";

type DiffStatus = "empty" | "pending" | "partial" | "applied" | "discarded";

const STATUS_LABEL: Record<DiffStatus, string> = {
  empty: "No changes",
  pending: "Pending",
  partial: "Partially applied",
  applied: "Applied",
  discarded: "Discarded",
};

export type AgentDiffProps = {
  /** Path of the file the agent edited */
  file?: string;
  /** The hunks, in file order */
  hunks?: readonly DiffHunk[];
  /** Decisions keyed by hunk id; omit to let the component own them */
  decisions?: Readonly<Record<string, HunkDecision>>;
  /** One hunk accepted or rejected */
  onDecide?: (id: string, decision: "accepted" | "rejected") => void;
  className?: string;
};

export function AgentDiff({
  file = "src/agent/retry.ts",
  hunks = DEFAULT_HUNKS,
  decisions,
  onDecide,
  className,
}: AgentDiffProps) {
  const [owned, setOwned] = useState<Record<string, HunkDecision>>({});
  const [dismissed, setDismissed] = useState<readonly string[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [narrow, setNarrow] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const focusFrom = useRef<number | null>(null);

  const state = decisions ?? owned;
  const decisionOf = (id: string): HunkDecision => state[id] ?? "pending";

  let appliedAdded = 0;
  let appliedRemoved = 0;
  let totalAdded = 0;
  let totalRemoved = 0;
  let pendingLines = 0;
  let acceptedCount = 0;
  let rejectedCount = 0;
  let pendingCount = 0;

  for (const hunk of hunks) {
    const decision = decisionOf(hunk.id);
    const counts = countLines(hunk.lines);
    totalAdded += counts.added;
    totalRemoved += counts.removed;
    if (decision === "accepted") {
      acceptedCount += 1;
      appliedAdded += counts.added;
      appliedRemoved += counts.removed;
    } else if (decision === "rejected") {
      rejectedCount += 1;
    } else {
      pendingCount += 1;
      pendingLines += counts.added + counts.removed;
    }
  }

  const total = hunks.length;
  const status: DiffStatus =
    total === 0
      ? "empty"
      : acceptedCount === total
        ? "applied"
        : pendingCount > 0
          ? acceptedCount > 0
            ? "partial"
            : "pending"
          : acceptedCount > 0
            ? "partial"
            : "discarded";

  /* A hunk leaves the body once its collapse has played, and comes back if it is reinstated. */
  const visible = hunks.filter(
    (hunk) => !(dismissed.includes(hunk.id) && decisionOf(hunk.id) === "rejected"),
  );

  /* Width is measured, not assumed: below 430px the old-side gutter is dropped. */
  useEffect(() => {
    const element = rootRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const measure = () => setNarrow(element.getBoundingClientRect().width < 430);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /* A rejected hunk collapses, then leaves the body. The timer is the commit, and it is
     cleaned up if the hunk is reinstated before it fires. */
  const rejectingKey = hunks
    .filter((hunk) => decisionOf(hunk.id) === "rejected" && !dismissed.includes(hunk.id))
    .map((hunk) => hunk.id)
    .join("|");

  useEffect(() => {
    if (!rejectingKey) return;
    const ids = rejectingKey.split("|");
    const timer = window.setTimeout(() => {
      setDismissed((prev) => [...prev, ...ids.filter((id) => !prev.includes(id))]);
    }, readDuration(rootRef.current, "--ui-agdf-dur-slow", 240) + readDuration(document.documentElement, "--nm-dur-1", 90));
    return () => window.clearTimeout(timer);
  }, [rejectingKey]);

  /* A hunk taken back to pending must be able to leave the body again on a later rejection. */
  useEffect(() => {
    setDismissed((prev) => {
      const next = prev.filter((id) => state[id] === "rejected");
      return next.length === prev.length ? prev : next;
    });
  }, [state]);

  const decide = (hunk: DiffHunk, index: number, next: "accepted" | "rejected") => {
    if (!decisions) setOwned((prev) => ({ ...prev, [hunk.id]: next }));
    onDecide?.(hunk.id, next);
    focusFrom.current = index;
    const remaining = hunks.filter((item) => item.id !== hunk.id && decisionOf(item.id) === "pending").length;
    setAnnouncement(
      `Hunk ${index + 1} ${next}. ${
        remaining === 0 ? "All hunks reviewed." : `${remaining} of ${total} hunks still pending.`
      }`,
    );
  };

  /* The decided hunk's buttons unmount, which would drop focus to the document. Hand it to the
     next hunk still waiting, so a reviewer can keep deciding from the keyboard. */
  useEffect(() => {
    const index = focusFrom.current;
    if (index === null) return;
    focusFrom.current = null;
    const root = rootRef.current;
    if (!root) return;
    const buttons = Array.from(
      root.querySelectorAll<HTMLButtonElement>('.ui-agdf__action[data-kind="accept"]'),
    );
    const target =
      buttons.find((button) => Number(button.dataset.index) > index) ?? buttons[buttons.length - 1];
    target?.focus();
  }, [state]);

  return (
    <section
      ref={rootRef}
      className={["ui-agdf", className].filter(Boolean).join(" ")}
      data-narrow={narrow ? "true" : "false"}
      aria-label={`Diff for ${file}`}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-agent-diff" precedence="default">
        {css}
      </style>

      <header className="ui-agdf__head">
        <span className="ui-agdf__file">
          <FileGlyph />
          <code className="ui-agdf__path" title={file}>
            {file}
          </code>
        </span>

        <span className="ui-agdf__meta">
          <span
            className="ui-agdf__counts"
            role="group"
            aria-label={`${appliedAdded} of ${totalAdded} added lines and ${appliedRemoved} of ${totalRemoved} removed lines applied`}
          >
            <span className="ui-agdf__count" data-kind="add">
              <span aria-hidden="true">+</span>
              <span className="ui-agdf__countNum">
                <CountValue value={appliedAdded} />
              </span>
              <span className="ui-agdf__countTotal" aria-hidden="true">
                /{totalAdded}
              </span>
            </span>
            <span className="ui-agdf__count" data-kind="remove">
              <span aria-hidden="true">−</span>
              <span className="ui-agdf__countNum">
                <CountValue value={appliedRemoved} />
              </span>
              <span className="ui-agdf__countTotal" aria-hidden="true">
                /{totalRemoved}
              </span>
            </span>
            <span className="ui-agdf__countLabel" aria-hidden="true">
              lines applied
            </span>
          </span>

          {total > 0 && (
            <span className="ui-agdf__note">
              {acceptedCount} of {total} hunks
              {rejectedCount > 0 && ` · ${rejectedCount} rejected`}
              {pendingLines > 0 && ` · ${pendingLines} lines to review`}
            </span>
          )}

          <span className="ui-agdf__status" data-status={status}>
            <span className="ui-agdf__statusGlyph" key={status} aria-hidden="true">
              <StatusGlyph status={status} />
            </span>
            {STATUS_LABEL[status]}
          </span>
        </span>
      </header>

      <div className="ui-agdf__hunks">
        {visible.map((hunk) => {
          const index = hunks.indexOf(hunk);
          const decision = decisionOf(hunk.id);
          const counts = countLines(hunk.lines);
          return (
            <article
              key={hunk.id}
              className="ui-agdf__hunk"
              data-state={decision}
              aria-label={`Hunk ${index + 1} of ${total}`}
            >
              <div
                className="ui-agdf__hunkInner"
                style={{ animationDelay: `calc(var(--ui-agdf-stagger, 45ms) * ${Math.min(index, 12)})` }}
              >
                <header key={decision} className="ui-agdf__hunkHead">
                  <code className="ui-agdf__range" title={hunk.header}>
                    {hunk.header}
                  </code>

                  <span className="ui-agdf__hunkCounts">
                    <span data-kind="add">
                      +{counts.added}
                      <span className="ui-agdf__hunkCountWord"> added</span>
                    </span>
                    <span data-kind="remove">
                      −{counts.removed}
                      <span className="ui-agdf__hunkCountWord"> removed</span>
                    </span>
                  </span>

                  {decision === "pending" ? (
                    <span className="ui-agdf__actions">
                      <button
                        type="button"
                        className="ui-agdf__action"
                        data-kind="accept"
                        data-index={index}
                        onClick={() => decide(hunk, index, "accepted")}
                        aria-label={`Accept hunk ${index + 1} of ${total} in ${file}`}
                      >
                        <CheckGlyph />
                        Accept
                      </button>
                      <button
                        type="button"
                        className="ui-agdf__action"
                        data-kind="reject"
                        onClick={() => decide(hunk, index, "rejected")}
                        aria-label={`Reject hunk ${index + 1} of ${total} in ${file}`}
                      >
                        <CrossGlyph />
                        Reject
                      </button>
                    </span>
                  ) : (
                    <span className="ui-agdf__applied" data-state={decision}>
                      {decision === "accepted" ? <CheckGlyph /> : <CrossGlyph />}
                      {decision === "accepted" ? "Applied" : "Rejected"}
                    </span>
                  )}
                </header>

                <div className="ui-agdf__body">
                  {hunk.lines.map((line, lineIndex) => (
                    <div key={`${hunk.id}-${lineIndex}`} className="ui-agdf__line" data-kind={line.kind}>
                      <span className="ui-agdf__old" aria-hidden="true">
                        {line.oldLine ?? ""}
                      </span>
                      <span className="ui-agdf__new" aria-hidden="true">
                        {line.newLine ?? ""}
                      </span>
                      <span className="ui-agdf__glyph" aria-hidden="true">
                        {line.kind === "add" ? "+" : line.kind === "remove" ? "−" : " "}
                      </span>
                      <span className="ui-agdf__code">
                        {line.kind !== "context" && (
                          <span className="ui-agdf__sr">{line.kind === "add" ? "Added: " : "Removed: "}</span>
                        )}
                        {line.spans
                          ? line.spans.map((span, spanIndex) =>
                              span.changed ? (
                                <span key={spanIndex} className="ui-agdf__word" data-changed="true">
                                  {span.text}
                                </span>
                              ) : (
                                <span key={spanIndex}>{span.text}</span>
                              ),
                            )
                          : line.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          );
        })}

        {visible.length === 0 && (
          <p className="ui-agdf__empty">
            {total === 0
              ? "This diff has no hunks."
              : "Every hunk was rejected. The file is unchanged."}
          </p>
        )}
      </div>

      <p className="ui-agdf__sr" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </section>
  );
}

/* ---------- Helpers ---------- */

function countLines(lines: readonly DiffLine[]) {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.kind === "add") added += 1;
    else if (line.kind === "remove") removed += 1;
  }
  return { added, removed };
}

/** Reads a duration token in milliseconds, so the JS timing matches the stylesheet's. */
function readDuration(element: Element | null, name: string, fallback: number): number {
  if (typeof window === "undefined" || !element) return fallback;
  const raw = getComputedStyle(element).getPropertyValue(name).trim();
  if (!raw) return fallback;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return raw.endsWith("ms") ? value : value * 1000;
}

/**
 * Tweens a counter to its next value. rAF does not fire while the document is hidden, so the
 * loop is already paused there; on return the elapsed time carries it straight to the target.
 */
function useTween(value: number): number {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const from = shownRef.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || from === value) {
      shownRef.current = value;
      setShown(value);
      return;
    }

    const duration = readDuration(document.documentElement, "--nm-dur-4", 380);
    const start = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const next = Math.round(from + (value - from) * (1 - (1 - t) ** 3));
      shownRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return shown;
}

/* The tween lives in its own component so a counting header re-renders two numbers, not the diff. */
function CountValue({ value }: { value: number }) {
  return <>{useTween(value)}</>;
}

/* ---------- Icons ---------- */

const FileGlyph = () => (
  <svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.2 1.6h5L11 4.4v8H3.2z" />
    <path d="M8 1.7v2.9h2.8" />
  </svg>
);

const CheckGlyph = () => (
  <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2.4 6.3l2.3 2.3 4.9-5" />
  </svg>
);

const CrossGlyph = () => (
  <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    <path d="M3.2 3.2l5.6 5.6M8.8 3.2l-5.6 5.6" />
  </svg>
);

function StatusGlyph({ status }: { status: DiffStatus }) {
  return (
    <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {status === "empty" && <circle cx="6" cy="6" r="3.9" strokeDasharray="1.2 1.9" />}
      {status === "pending" && <circle cx="6" cy="6" r="3.9" strokeDasharray="2.1 2.1" />}
      {status === "partial" && (
        <>
          <circle cx="6" cy="6" r="3.9" />
          <path d="M6 2.1a3.9 3.9 0 0 1 0 7.8z" fill="currentColor" stroke="none" />
        </>
      )}
      {status === "applied" && (
        <>
          <circle cx="6" cy="6" r="3.9" />
          <path d="M4 6.1l1.4 1.4 2.7-2.8" />
        </>
      )}
      {status === "discarded" && (
        <>
          <circle cx="6" cy="6" r="3.9" />
          <path d="M4.6 4.6l2.8 2.8M7.4 4.6L4.6 7.4" />
        </>
      )}
    </svg>
  );
}

/* ---------- Default content ---------- */

const DEFAULT_HUNKS: readonly DiffHunk[] = [
  {
    id: "cap",
    header: "@@ -4,5 +4,6 @@ export function backoff(attempt: number): number {",
    lines: [
      { kind: "context", oldLine: 4, newLine: 4, text: "  const base = 250;" },
      {
        kind: "remove",
        oldLine: 5,
        newLine: null,
        text: "  const cap = 4_000;",
        spans: [
          { text: "  const cap = " },
          { text: "4_000", changed: true },
          { text: ";" },
        ],
      },
      {
        kind: "add",
        oldLine: null,
        newLine: 5,
        text: "  const cap = 8_000;",
        spans: [
          { text: "  const cap = " },
          { text: "8_000", changed: true },
          { text: ";" },
        ],
      },
      { kind: "add", oldLine: null, newLine: 6, text: "  const jitter = Math.random() * 100;" },
      { kind: "context", oldLine: 6, newLine: 7, text: "" },
      {
        kind: "remove",
        oldLine: 7,
        newLine: null,
        text: "  return Math.min(base * 2 ** attempt, cap);",
        spans: [
          { text: "  return Math.min(base * 2 ** attempt" },
          { text: ", cap", changed: true },
          { text: ");" },
        ],
      },
      {
        kind: "add",
        oldLine: null,
        newLine: 8,
        text: "  return Math.min(base * 2 ** attempt + jitter, cap);",
        spans: [
          { text: "  return Math.min(base * 2 ** attempt" },
          { text: " + jitter, cap", changed: true },
          { text: ");" },
        ],
      },
      { kind: "context", oldLine: 8, newLine: 9, text: "}" },
    ],
  },
  {
    id: "reset",
    header: "@@ -12,3 +13,3 @@ export function reset(): void {",
    lines: [
      { kind: "context", oldLine: 12, newLine: 13, text: "  attempts = 0;" },
      {
        kind: "remove",
        oldLine: 13,
        newLine: null,
        text: "  lastError = null;",
        spans: [
          { text: "  lastError = " },
          { text: "null", changed: true },
          { text: ";" },
        ],
      },
      {
        kind: "add",
        oldLine: null,
        newLine: 14,
        text: "  lastError = undefined;",
        spans: [
          { text: "  lastError = " },
          { text: "undefined", changed: true },
          { text: ";" },
        ],
      },
      { kind: "context", oldLine: 14, newLine: 15, text: "}" },
    ],
  },
];

/* ---------- Styles ---------- */

const css = /* css */ `
.ui-agdf {
  /* Knobs. Override any of these on .ui-agdf to retheme the diff in a host. */
  --ui-agdf-ink: var(--text, #1a1410);
  --ui-agdf-muted: var(--text-muted, #6f625a);
  --ui-agdf-panel: var(--panel, #fffdfb);
  --ui-agdf-head: var(--preview, #fdfaf7);
  --ui-agdf-card: var(--card, #ffffff);
  --ui-agdf-line: var(--border, #e8e0d7);
  --ui-agdf-line-soft: var(--border-soft, #1a14101a);
  --ui-agdf-accent: var(--accent, #c2410c);
  --ui-agdf-add: var(--success, #1a7a4a);
  --ui-agdf-add-soft: #1a7a4a14;
  --ui-agdf-add-mark: #1a7a4a2e;
  --ui-agdf-del: var(--danger, #b3261e);
  --ui-agdf-del-soft: #b3261e12;
  --ui-agdf-del-mark: #b3261e2e;
  --ui-agdf-warn: var(--warning, #9a6410);
  --ui-agdf-mono: var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace);
  --ui-agdf-ease: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-agdf-ease-in: var(--nm-ease-in, cubic-bezier(0.55, 0, 0.68, 0.19));
  --ui-agdf-spring: var(--nm-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  --ui-agdf-dur: var(--nm-dur-2, 160ms);
  --ui-agdf-dur-slow: var(--nm-dur-3, 240ms);
  --ui-agdf-dur-surface: var(--nm-dur-4, 380ms);
  --ui-agdf-stagger: var(--nm-stagger, 45ms);

  box-sizing: border-box;
  position: relative;
  width: 100%;
  overflow: hidden;
  background: var(--ui-agdf-panel);
  border-radius: var(--radius-card, 16px);
  box-shadow: inset 0 0 0 1px var(--ui-agdf-line);
  color: var(--ui-agdf-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-agdf *, .ui-agdf *::before, .ui-agdf *::after { box-sizing: border-box; }

/* Header ---------------------------------------------------------------- */

.ui-agdf__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 9px 14px;
  padding: 12px 14px 11px;
  box-shadow: inset 0 -1px 0 var(--ui-agdf-line-soft);
}

.ui-agdf__file {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1 1 auto;
  color: var(--ui-agdf-muted);
}
.ui-agdf__path {
  min-width: 0;
  overflow: hidden;
  color: var(--ui-agdf-ink);
  font-family: var(--ui-agdf-mono);
  font-size: 12.5px;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ui-agdf__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
}

.ui-agdf__counts {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  font-family: var(--ui-agdf-mono);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
}
.ui-agdf__count {
  display: inline-flex;
  align-items: baseline;
  gap: 1px;
  font-weight: 600;
}
.ui-agdf__count[data-kind="add"] { color: var(--ui-agdf-add); }
.ui-agdf__count[data-kind="remove"] { color: var(--ui-agdf-del); }
.ui-agdf__countNum { display: inline-block; min-width: 1.9ch; text-align: left; }
.ui-agdf__countTotal { color: var(--ui-agdf-muted); font-weight: 500; }
.ui-agdf__countLabel {
  color: var(--ui-agdf-muted);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 11px;
  letter-spacing: -0.01em;
}

.ui-agdf__note {
  color: var(--ui-agdf-muted);
  font-size: 11.5px;
  line-height: 16px;
}

.ui-agdf__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 9px 0 8px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-agdf-card);
  box-shadow: inset 0 0 0 1px var(--ui-agdf-line-soft);
  color: var(--ui-agdf-muted);
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}
.ui-agdf__status[data-status="empty"] { color: var(--ui-agdf-muted); }
.ui-agdf__status[data-status="pending"] { color: var(--ui-agdf-accent); }
.ui-agdf__status[data-status="partial"] { color: var(--ui-agdf-warn); }
.ui-agdf__status[data-status="applied"] { color: var(--ui-agdf-add); }
.ui-agdf__status[data-status="discarded"] { color: var(--ui-agdf-del); }

.ui-agdf__statusGlyph {
  display: inline-flex;
  animation: ui-agdf-pop var(--ui-agdf-dur-slow) var(--ui-agdf-spring) both;
}

/* Hunks ----------------------------------------------------------------- */

.ui-agdf__hunks {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 8px 8px;
}

.ui-agdf__hunk {
  display: grid;
  grid-template-rows: 1fr;
  transition:
    grid-template-rows var(--ui-agdf-dur-slow) var(--ui-agdf-ease-in),
    opacity var(--ui-agdf-dur-slow) var(--ui-agdf-ease-in);
}
.ui-agdf__hunk[data-state="rejected"] {
  grid-template-rows: 0fr;
  opacity: 0;
}

.ui-agdf__hunkInner {
  min-height: 0;
  overflow: hidden;
  border-radius: var(--radius-preview, 12px);
  background: var(--ui-agdf-card);
  box-shadow: inset 0 0 0 1px var(--ui-agdf-line-soft);
  animation: ui-agdf-rise var(--ui-agdf-dur-surface) var(--ui-agdf-ease) both;
}
.ui-agdf__hunk[data-state="accepted"] .ui-agdf__hunkInner {
  box-shadow: inset 3px 0 0 var(--ui-agdf-add);
}
/* The head is keyed by decision, so accepting remounts it and this settle runs once. */
.ui-agdf__hunk[data-state="accepted"] .ui-agdf__hunkHead {
  animation: ui-agdf-settle var(--ui-agdf-dur-surface) var(--ui-agdf-spring) both;
}

.ui-agdf__hunkHead {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 7px 10px 7px 12px;
  background: var(--ui-agdf-head);
  box-shadow: inset 0 -1px 0 var(--ui-agdf-line-soft);
}

.ui-agdf__range {
  flex: 1 1 220px;
  min-width: 0;
  overflow: hidden;
  color: var(--ui-agdf-muted);
  font-family: var(--ui-agdf-mono);
  font-size: 11.5px;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ui-agdf__hunkCounts {
  display: inline-flex;
  gap: 7px;
  font-family: var(--ui-agdf-mono);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
}
.ui-agdf__hunkCounts [data-kind="add"] { color: var(--ui-agdf-add); }
.ui-agdf__hunkCounts [data-kind="remove"] { color: var(--ui-agdf-del); }
.ui-agdf__hunkCountWord {
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 10.5px;
  letter-spacing: -0.01em;
  opacity: 0.85;
}

.ui-agdf__actions {
  display: inline-flex;
  gap: 6px;
  margin-left: auto;
}

.ui-agdf__action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--radius-pill, 999px);
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--ui-agdf-line);
  color: var(--ui-agdf-muted);
  font: inherit;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  transition:
    color var(--ui-agdf-dur) var(--ui-agdf-ease),
    background-color var(--ui-agdf-dur) var(--ui-agdf-ease),
    box-shadow var(--ui-agdf-dur) var(--ui-agdf-ease),
    transform var(--ui-agdf-dur) var(--ui-agdf-ease);
}
.ui-agdf__action:hover {
  background: var(--ui-agdf-card);
  color: var(--ui-agdf-ink);
}
.ui-agdf__action:active { transform: translateY(1px); }
.ui-agdf__action[data-kind="accept"]:hover {
  color: var(--ui-agdf-add);
  box-shadow: inset 0 0 0 1px var(--ui-agdf-add);
}
.ui-agdf__action[data-kind="reject"]:hover {
  color: var(--ui-agdf-del);
  box-shadow: inset 0 0 0 1px var(--ui-agdf-del);
}
.ui-agdf__action:focus-visible {
  outline: 2px solid var(--ui-agdf-accent);
  outline-offset: 2px;
}

.ui-agdf__applied {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  height: 24px;
  padding: 0 9px 0 8px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-agdf-add-soft);
  color: var(--ui-agdf-add);
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1;
  animation: ui-agdf-pop var(--ui-agdf-dur-surface) var(--ui-agdf-spring) both;
}
.ui-agdf__applied[data-state="rejected"] {
  background: var(--ui-agdf-del-soft);
  color: var(--ui-agdf-del);
}

/* Diff body ------------------------------------------------------------- */

.ui-agdf__body {
  overflow-x: auto;
  padding: 4px 0;
}

.ui-agdf__line {
  display: flex;
  align-items: baseline;
  width: max-content;
  min-width: 100%;
  min-height: 20px;
  font-family: var(--ui-agdf-mono);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
  line-height: 20px;
}
.ui-agdf__line[data-kind="add"] {
  background: var(--ui-agdf-add-soft);
  box-shadow: inset 2px 0 0 var(--ui-agdf-add);
}
.ui-agdf__line[data-kind="remove"] {
  background: var(--ui-agdf-del-soft);
  box-shadow: inset 2px 0 0 var(--ui-agdf-del);
}

.ui-agdf__old,
.ui-agdf__new {
  flex: 0 0 auto;
  width: 4.4ch;
  color: var(--ui-agdf-muted);
  text-align: right;
  user-select: none;
}
.ui-agdf__old { padding-right: 6px; }
.ui-agdf__new {
  padding-right: 8px;
  margin-right: 2px;
  box-shadow: inset -1px 0 0 var(--ui-agdf-line-soft);
}

.ui-agdf__glyph {
  flex: 0 0 auto;
  width: 2ch;
  color: var(--ui-agdf-muted);
  text-align: center;
  user-select: none;
}
.ui-agdf__line[data-kind="add"] .ui-agdf__glyph { color: var(--ui-agdf-add); }
.ui-agdf__line[data-kind="remove"] .ui-agdf__glyph { color: var(--ui-agdf-del); }

.ui-agdf__code {
  flex: 0 0 auto;
  padding: 0 16px 0 2px;
  white-space: pre;
}

.ui-agdf__word[data-changed="true"] {
  border-radius: 3px;
  background: var(--ui-agdf-add-mark);
  box-shadow: inset 0 -1px 0 var(--ui-agdf-add);
}
.ui-agdf__line[data-kind="remove"] .ui-agdf__word[data-changed="true"] {
  background: var(--ui-agdf-del-mark);
  box-shadow: inset 0 -1px 0 var(--ui-agdf-del);
}

.ui-agdf__empty {
  margin: 0;
  padding: 20px 16px 22px;
  color: var(--ui-agdf-muted);
  font-size: 12.5px;
  line-height: 18px;
  text-align: center;
}

.ui-agdf__sr {
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

/* Narrow: the old-side gutter is the first thing a reviewer can live without. */

.ui-agdf[data-narrow="true"] .ui-agdf__old { display: none; }
.ui-agdf[data-narrow="true"] .ui-agdf__hunkHead { padding: 7px 9px 7px 10px; }
.ui-agdf[data-narrow="true"] .ui-agdf__range { flex-basis: 100%; }

@keyframes ui-agdf-rise {
  from { opacity: 0; transform: translateY(7px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes ui-agdf-pop {
  from { opacity: 0; transform: scale(0.76); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes ui-agdf-settle {
  from { opacity: 0.55; transform: translateY(-3px); }
  to { opacity: 1; transform: translateY(0); }
}

:where(.dark, [data-theme="dark"]) .ui-agdf {
  --ui-agdf-ink: var(--text, #f4ece4);
  --ui-agdf-muted: var(--text-muted, #a2958a);
  --ui-agdf-panel: var(--panel, #1a1512);
  --ui-agdf-head: var(--preview, #26201a);
  --ui-agdf-card: var(--card, #201a15);
  --ui-agdf-line: var(--border, #33291f);
  --ui-agdf-line-soft: var(--border-soft, #ffffff12);
  --ui-agdf-accent: var(--accent, #ff6b35);
  --ui-agdf-add: var(--success, #4f9d6e);
  --ui-agdf-add-soft: #4f9d6e26;
  --ui-agdf-add-mark: #4f9d6e33;
  --ui-agdf-del: var(--danger, #e2544a);
  --ui-agdf-del-soft: #e2544a1f;
  --ui-agdf-del-mark: #e2544a33;
  --ui-agdf-warn: var(--warning, #d99530);
}

@media (prefers-reduced-motion: reduce) {
  .ui-agdf__hunkInner,
  .ui-agdf__applied,
  .ui-agdf__statusGlyph,
  .ui-agdf__hunkHead {
    animation: none;
  }
  .ui-agdf__hunk { transition-duration: 1ms; }
  .ui-agdf__action { transition-duration: 1ms; }
  .ui-agdf__action:active { transform: none; }
}
`;
