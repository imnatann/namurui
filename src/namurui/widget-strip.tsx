"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/*
 * Widget Strip: the plain-text widgets an OMP extension pushes above or below the composer.
 * Each key keeps one compact strip, and the node is reused when the extension rewrites that
 * key's lines; a strip whose key leaves the list collapses its row track and fades before it
 * unmounts. Only a line's leading status word is read as severity, so the text itself is never
 * interpreted. Styles are injected below, so no extra files are needed.
 */

export type WidgetPlacement = "above" | "below";

export type WidgetLineStatus = "ok" | "warn" | "error" | "done" | "running";

export type WidgetEntry = {
  /** Widget key from the extension request; it doubles as the strip's title */
  key: string;
  /** Plain-text lines, exactly as sent — never ANSI. Absent means the extension cleared the
   * widget, so the strip leaves; an empty array is a widget that is present and blank */
  lines?: readonly string[];
  /** Where the host draws the strip relative to its composer */
  placement: WidgetPlacement;
};

export type WidgetStripProps = {
  /** Widgets pushed by extensions, in paint order */
  widgets?: readonly WidgetEntry[];
  /** A strip's dismiss control was pressed; the host drops the widget and the strip leaves */
  onDismiss?: (key: string) => void;
  /** Lines shown before the body folds; the rest sit behind "+N more" */
  maxLines?: number;
  /** Extra class on the root */
  className?: string;
};

/* The committed list, which lags the props by one commit so a removed key can still leave. */
type Entry = {
  key: string;
  lines: readonly string[];
  placement: WidgetPlacement;
  leaving: boolean;
};

const NO_WIDGETS: readonly WidgetEntry[] = [];

/* A status word is only ever the first token of a line, followed by a break of some kind, so
 * "okay" is not "ok" and a word in the middle of a sentence is never read as a verdict. */
const STATUS_PATTERN = /^(ok|warn|error|done|running)(?=$|[\s:,.;·—–-])/i;

/* One glyph per status: a shape that says the same thing as the word the extension wrote. */
const LINE_GLYPH: Record<WidgetLineStatus, ReactNode> = {
  ok: (
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
      <path d="M2.4 6.2 5 8.8 9.6 3.6" />
    </svg>
  ),
  done: (
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
      <circle cx="6" cy="6" r="4.5" />
      <path d="M3.9 6.1 5.4 7.6 8.2 4.5" />
    </svg>
  ),
  warn: (
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
      <path d="M6 1.9 10.7 10.1H1.3Z" />
      <path d="M6 4.8v2.3" />
      <circle cx="6" cy="8.6" r="0.55" fill="currentColor" stroke="none" />
    </svg>
  ),
  error: (
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
      <path d="M3.4 3.4 8.6 8.6" />
      <path d="M8.6 3.4 3.4 8.6" />
    </svg>
  ),
  running: (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 1.6a4.4 4.4 0 1 0 4.4 4.4" />
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
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2.6 4.4 6 7.8l3.4-3.4" />
  </svg>
);

const CROSS = (
  <svg
    viewBox="0 0 10 10"
    width="10"
    height="10"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M2.6 2.6 7.4 7.4" />
    <path d="M7.4 2.6 2.6 7.4" />
  </svg>
);

function statusOf(line: string): WidgetLineStatus | null {
  const word = STATUS_PATTERN.exec(line)?.[1]?.toLowerCase();
  switch (word) {
    case "ok":
    case "warn":
    case "error":
    case "done":
    case "running":
      return word;
    default:
      return null;
  }
}

function toEntry(widget: WidgetEntry): Entry {
  return {
    key: widget.key,
    lines: widget.lines ?? [],
    placement: widget.placement,
    leaving: false,
  };
}

/* A `setWidget` call without `widgetLines` clears that key, so it never reaches the list: the
 * key falls out of the incoming set and the strip leaves the way any removed widget does. */
const withLines = (widgets: readonly WidgetEntry[]) =>
  widgets.filter((widget) => widget.lines !== undefined);

function sameLines(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((line, index) => line === b[index]);
}

/* The list is rebuilt every time the props move, so this decides whether the rebuild is
 * worth a render: an unchanged widget must not touch the state that keys its node. */
function sameEntries(a: readonly Entry[], b: readonly Entry[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((entry, index) => {
    const other = b[index];
    return (
      entry.key === other.key &&
      entry.placement === other.placement &&
      entry.leaving === other.leaving &&
      sameLines(entry.lines, other.lines)
    );
  });
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

export function WidgetStrip({
  widgets = NO_WIDGETS,
  onDismiss,
  maxLines = 3,
  className,
}: WidgetStripProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<Entry[]>(() => withLines(widgets).map(toEntry));

  /* The props stay the truth. This list follows them one commit behind, so a key that has just
   * gone is still on screen long enough to collapse; a key that comes back is revived in its
   * old slot, keeping its node and its open fold. */
  useEffect(() => {
    setEntries((current) => {
      const incoming = new Map<string, WidgetEntry>();
      withLines(widgets).forEach((widget) => incoming.set(widget.key, widget));

      const next: Entry[] = [];
      current.forEach((entry) => {
        const live = incoming.get(entry.key);
        if (live) {
          incoming.delete(entry.key);
          next.push({
            key: entry.key,
            lines: live.lines ?? [],
            placement: live.placement,
            leaving: false,
          });
          return;
        }
        next.push(entry.leaving ? entry : { ...entry, leaving: true });
      });
      incoming.forEach((widget) => next.push(toEntry(widget)));

      return sameEntries(current, next) ? current : next;
    });
  }, [widgets]);

  /* The leaving set is keyed by the same key as the strip it belongs to, and the timeout only
   * drops state: the collapse and the fade are the stylesheet's, so the unmount lands after
   * them rather than in the middle. */
  useEffect(() => {
    if (!entries.some((entry) => entry.leaving)) return;
    const timer = window.setTimeout(
      () => setEntries((current) => current.filter((entry) => !entry.leaving)),
      readDuration(rootRef.current, "--ui-wds-dur-exit", 240) + 40,
    );
    return () => window.clearTimeout(timer);
  }, [entries]);

  const limit = Math.max(1, Math.floor(maxLines));

  return (
    <div
      className={["ui-wds", className].filter(Boolean).join(" ")}
      data-count={entries.length}
      ref={rootRef}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-widget-strip" precedence="default">
        {css}
      </style>

      {entries.length > 0 ? (
        <ul className="ui-wds__list" aria-label="Extension widgets">
          {entries.map((entry) => (
            <WidgetCard key={entry.key} entry={entry} maxLines={limit} onDismiss={onDismiss} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type WidgetCardProps = {
  entry: Entry;
  maxLines: number;
  onDismiss?: (key: string) => void;
};

function WidgetCard({ entry, maxLines, onDismiss }: WidgetCardProps) {
  const keyId = useId();
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const foldedCount = Math.max(0, entry.lines.length - maxLines);

  return (
    <li
      className="ui-wds__item"
      data-placement={entry.placement}
      data-state={entry.leaving ? "leaving" : "live"}
      data-widget-key={entry.key}
    >
      <div className="ui-wds__clip">
        <section
          className="ui-wds__strip"
          data-placement={entry.placement}
          role="group"
          aria-labelledby={keyId}
          aria-hidden={entry.leaving || undefined}
          inert={entry.leaving}
        >
          <div className="ui-wds__head">
            <p className="ui-wds__key" id={keyId} title={entry.key}>
              {entry.key}
            </p>
            {onDismiss ? (
              <button
                type="button"
                className="ui-wds__dismiss"
                aria-label={`Dismiss ${entry.key}`}
                title={`Dismiss ${entry.key}`}
                onClick={() => onDismiss(entry.key)}
              >
                {CROSS}
              </button>
            ) : null}
          </div>

          {/* Lines are keyed by position, not by text: a rewritten line keeps its row and
              changes in place, which is what a streaming extension update looks like. */}
          <ul className="ui-wds__lines" id={listId}>
            {entry.lines.map((line, index) => {
              const status = statusOf(line);
              const folded = foldedCount > 0 && !expanded && index >= maxLines;
              return (
                <li
                  key={index}
                  className="ui-wds__line"
                  data-status={status ?? "plain"}
                  data-folded={folded ? "true" : undefined}
                  aria-hidden={folded || undefined}
                  inert={folded}
                >
                  <span className="ui-wds__line-clip">
                    <span className="ui-wds__row">
                      <span className="ui-wds__glyph" aria-hidden="true">
                        {status ? LINE_GLYPH[status] : null}
                      </span>
                      <span className="ui-wds__text">{line}</span>
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>

          {foldedCount > 0 ? (
            <button
              type="button"
              className="ui-wds__more"
              aria-expanded={expanded}
              aria-controls={listId}
              onClick={() => setExpanded((open) => !open)}
            >
              <span className="ui-wds__more-glyph" aria-hidden="true">
                {CHEVRON}
              </span>
              {expanded ? "Show less" : `+${foldedCount} more`}
            </button>
          ) : null}

          <p className="ui-wds__sr" role="status" aria-live="polite">
            {`${entry.key}: ${entry.lines.length} ${entry.lines.length === 1 ? "line" : "lines"}`}
          </p>
        </section>
      </div>
    </li>
  );
}

const css = /* css */ `
.ui-wds {
  /* Knobs. Override any of these on .ui-wds to retheme the strips in a host. */
  --ui-wds-ink: var(--text, #1a1410);
  --ui-wds-muted: var(--text-muted, #6f625a);
  --ui-wds-panel: var(--panel, #fffdfb);
  --ui-wds-edge: var(--border, #e8e0d7);
  --ui-wds-wash: #7a4a1c0a;
  --ui-wds-ok: var(--success, #1a7a4a);
  --ui-wds-warn: var(--warning, #9a6410);
  --ui-wds-danger: var(--danger, #b3261e);
  --ui-wds-focus: var(--accent, #c2410c);
  --ui-wds-mono: var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace);
  --ui-wds-ease: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-wds-ease-in: var(--nm-ease-in, cubic-bezier(0.55, 0, 0.68, 0.19));
  --ui-wds-ease-soft: var(--nm-ease-soft, cubic-bezier(0.4, 0, 0.2, 1));
  --ui-wds-spring: var(--nm-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  --ui-wds-dur-hover: var(--nm-dur-2, 160ms);
  --ui-wds-dur-enter: var(--nm-dur-3, 240ms);
  --ui-wds-dur-exit: var(--nm-dur-3, 240ms);
  --ui-wds-dur-ambient: var(--nm-dur-6, 1100ms);
  --ui-wds-radius: var(--radius-preview, 12px);

  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  color: var(--ui-wds-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 18px;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-wds *,
.ui-wds *::before,
.ui-wds *::after {
  box-sizing: border-box;
}
:where(.ui-wds) :is(p, ul) {
  margin: 0;
  padding: 0;
}
:where(.ui-wds) button {
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
:where(.ui-wds) svg {
  display: block;
}

.ui-wds__list {
  display: grid;
  gap: 6px;
  min-width: 0;
  list-style: none;
}

/* A strip leaves by closing its row track, never by animating a height, so the strips under
 * it keep a real layout the whole way out. */
.ui-wds__item {
  display: grid;
  grid-template-rows: 1fr;
  min-width: 0;
  opacity: 1;
  transition:
    grid-template-rows var(--ui-wds-dur-enter) var(--ui-wds-ease),
    opacity var(--ui-wds-dur-enter) var(--ui-wds-ease);
}
.ui-wds__item[data-state="leaving"] {
  grid-template-rows: 0fr;
  opacity: 0;
  pointer-events: none;
  transition:
    grid-template-rows var(--ui-wds-dur-exit) var(--ui-wds-ease-in),
    opacity var(--ui-wds-dur-exit) var(--ui-wds-ease-in);
}
.ui-wds__clip {
  min-height: 0;
  overflow: hidden;
}

.ui-wds__strip {
  position: relative;
  min-width: 0;
  padding: 7px 9px 8px;
  border-radius: var(--ui-wds-radius);
  background: var(--ui-wds-panel);
  box-shadow: inset 0 0 0 1px var(--ui-wds-edge);
}
/* A widget attaches from the side it was placed on: the strip above the composer settles
 * down onto it, the one below settles up. */
.ui-wds__item[data-state="live"] .ui-wds__strip {
  animation: ui-wds-attach var(--ui-wds-dur-enter) var(--ui-wds-spring) both;
}
@keyframes ui-wds-attach {
  from {
    opacity: 0;
    transform: translateY(var(--ui-wds-enter-y, -3px)) scale(0.994);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.ui-wds__item[data-placement="above"] {
  --ui-wds-enter-y: -3px;
}
.ui-wds__item[data-placement="below"] {
  --ui-wds-enter-y: 3px;
}

/* Head -------------------------------------------------------------------- */
.ui-wds__head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 16px;
}
.ui-wds__key {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-family: var(--ui-wds-mono);
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  letter-spacing: 0;
  color: var(--ui-wds-muted);
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-wds__dismiss {
  display: grid;
  flex: none;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 6px;
  color: var(--ui-wds-muted);
  transition:
    color var(--ui-wds-dur-hover) var(--ui-wds-ease),
    background-color var(--ui-wds-dur-hover) var(--ui-wds-ease);
}
.ui-wds__dismiss:hover {
  background: var(--ui-wds-wash);
  color: var(--ui-wds-ink);
}
.ui-wds__dismiss:focus-visible {
  outline: 2px solid var(--ui-wds-focus);
  outline-offset: 1px;
}

/* Lines ------------------------------------------------------------------- */
.ui-wds__lines {
  display: grid;
  gap: 1px;
  margin-top: 3px;
  min-width: 0;
  list-style: none;
}
.ui-wds__line {
  --ui-wds-row-ink: var(--ui-wds-ink);
  display: grid;
  grid-template-rows: 1fr;
  min-width: 0;
  opacity: 1;
  transition:
    grid-template-rows var(--ui-wds-dur-enter) var(--ui-wds-ease),
    opacity var(--ui-wds-dur-hover) var(--ui-wds-ease);
}
.ui-wds__line[data-folded="true"] {
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows var(--ui-wds-dur-exit) var(--ui-wds-ease-in),
    opacity var(--ui-wds-dur-hover) var(--ui-wds-ease-in);
}
.ui-wds__line[data-status="ok"],
.ui-wds__line[data-status="done"] {
  --ui-wds-row-ink: var(--ui-wds-ok);
}
.ui-wds__line[data-status="warn"] {
  --ui-wds-row-ink: var(--ui-wds-warn);
}
.ui-wds__line[data-status="error"] {
  --ui-wds-row-ink: var(--ui-wds-danger);
}
/* Running is a state, not a verdict, so it stays out of the semantic trio and keeps the
 * muted tone: only the moving glyph says the line is still going. */
.ui-wds__line[data-status="running"] {
  --ui-wds-row-ink: var(--ui-wds-muted);
}
.ui-wds__line-clip {
  min-height: 0;
  overflow: hidden;
}
.ui-wds__row {
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr);
  column-gap: 7px;
  align-items: start;
  padding: 1px 0;
}
.ui-wds__glyph {
  display: grid;
  place-items: center;
  width: 12px;
  height: 12px;
  margin-top: 2.5px;
  color: var(--ui-wds-row-ink);
}
.ui-wds__line[data-status="running"] .ui-wds__glyph {
  animation: ui-wds-run var(--ui-wds-dur-ambient) var(--ui-wds-ease-soft) infinite alternate;
}
@keyframes ui-wds-run {
  from {
    opacity: 0.4;
  }
  to {
    opacity: 1;
  }
}
.ui-wds__text {
  min-width: 0;
  font-family: var(--ui-wds-mono);
  font-size: 11.5px;
  line-height: 17px;
  letter-spacing: 0;
  color: var(--ui-wds-row-ink);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  tab-size: 2;
  transition: color var(--ui-wds-dur-hover) var(--ui-wds-ease);
}

/* Fold -------------------------------------------------------------------- */
.ui-wds__more {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 3px;
  padding: 1px 0;
  border-radius: 4px;
  color: var(--ui-wds-muted);
  font-family: var(--ui-wds-mono);
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0;
  transition: color var(--ui-wds-dur-hover) var(--ui-wds-ease);
}
.ui-wds__more:hover {
  color: var(--ui-wds-ink);
}
.ui-wds__more:focus-visible {
  outline: 2px solid var(--ui-wds-focus);
  outline-offset: 2px;
}
.ui-wds__more-glyph {
  transition: transform var(--ui-wds-dur-hover) var(--ui-wds-ease);
}
.ui-wds__more[aria-expanded="true"] .ui-wds__more-glyph {
  transform: rotate(180deg);
}

.ui-wds__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

:where(.dark, [data-theme="dark"]) .ui-wds {
  --ui-wds-ink: var(--text, #f4ece4);
  --ui-wds-muted: var(--text-muted, #a2958a);
  --ui-wds-panel: var(--panel, #1a1512);
  --ui-wds-edge: var(--border, #33291f);
  --ui-wds-wash: #ffffff0d;
  --ui-wds-ok: var(--success, #4f9d6e);
  --ui-wds-warn: var(--warning, #d99530);
  --ui-wds-danger: var(--danger, #e2544a);
  --ui-wds-focus: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  .ui-wds {
    --ui-wds-dur-enter: 1ms;
    --ui-wds-dur-exit: 1ms;
  }
  .ui-wds__item,
  .ui-wds__line,
  .ui-wds__more,
  .ui-wds__more-glyph,
  .ui-wds__dismiss,
  .ui-wds__text {
    transition-duration: 1ms;
  }
  .ui-wds__item[data-state="live"] .ui-wds__strip {
    animation: none;
    opacity: 1;
    transform: none;
  }
  .ui-wds__line[data-status="running"] .ui-wds__glyph {
    animation: none;
    opacity: 1;
  }
}
`;
