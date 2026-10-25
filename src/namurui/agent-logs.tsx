"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

/*
 * Agent Logs: a structured log stream with level filters, search, and pinnable rows.
 * A line that arrives slides down from the top edge and the stream settles under it; changing a
 * filter cross-fades the stream instead of popping it; a line's detail unfolds on a
 * grid-template-rows transition, never a height one. A pinned line leaves the stream for a group
 * of its own, where it survives every filter, so the hidden count under the search field never
 * lies about how much of the run is out of view.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

/** One key/value pair the expanded row reveals */
export type LogField = {
  key: string;
  value: string;
};

export type LogRow = {
  id: string;
  /** Epoch milliseconds the line was emitted */
  at: number;
  level: LogLevel;
  /** The agent that emitted the line, e.g. `"deploy-bot"` */
  source: string;
  message: string;
  /** Structured detail for the expanded state; a row without it has no expander */
  detail?: LogField[];
};

export type AgentLogsProps = {
  /** The stream, in the order it should read. Newest first suits a console pane */
  rows: LogRow[];
  /** Heading in the top bar */
  title?: string;
  /** Controlled search text. Leave it out to let the field keep its own */
  query?: string;
  onQueryChange?: (query: string) => void;
  /** The run is live: the header dot breathes in ember. `false` pauses the dot, not the rows */
  streaming?: boolean;
  /** A row was pinned or unpinned; `pinned` is the state it moved to */
  onPinChange?: (id: string, pinned: boolean) => void;
  /** Rows to pin before the first render. Later changes are ignored: the user owns the pins */
  pinnedIds?: string[];
  className?: string;
};

const LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

const LEVEL_LABEL: Record<LogLevel, string> = {
  debug: "Debug",
  info: "Info",
  warn: "Warn",
  error: "Error",
};

export function AgentLogs({
  rows,
  title = "Agent logs",
  query,
  onQueryChange,
  streaming = true,
  onPinChange,
  pinnedIds,
  className,
}: AgentLogsProps) {
  const uid = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [innerQuery, setInnerQuery] = useState("");
  const [levels, setLevels] = useState<Record<LogLevel, boolean>>({
    debug: true,
    info: true,
    warn: true,
    error: true,
  });
  const [pinned, setPinned] = useState<ReadonlySet<string>>(() => new Set(pinnedIds ?? []));
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set<string>());
  const seen = useRef<Set<string> | null>(null);
  const timers = useRef<number[]>([]);

  const text = query ?? innerQuery;
  const needle = text.trim().toLowerCase();

  const setQuery = useCallback(
    (value: string) => {
      setInnerQuery(value);
      onQueryChange?.(value);
    },
    [onQueryChange],
  );

  const toggleLevel = useCallback((level: LogLevel) => {
    setLevels((prev) => ({ ...prev, [level]: !prev[level] }));
  }, []);

  const togglePin = useCallback(
    (id: string) => {
      const next = !pinned.has(id);
      setPinned((prev) => {
        const draft = new Set(prev);
        if (next) draft.add(id);
        else draft.delete(id);
        return draft;
      });
      onPinChange?.(id, next);
    },
    [pinned, onPinChange],
  );

  const toggleOpen = useCallback((id: string) => {
    setExpanded((prev) => {
      const draft = new Set(prev);
      if (draft.has(id)) draft.delete(id);
      else draft.add(id);
      return draft;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setLevels({ debug: true, info: true, warn: true, error: true });
    setQuery("");
  }, [setQuery]);

  /* The one predicate every count is derived from, so the list and the counts can never disagree. */
  const passes = useCallback(
    (row: LogRow) => {
      if (!levels[row.level]) return false;
      if (needle === "") return true;
      return row.message.toLowerCase().includes(needle) || row.source.toLowerCase().includes(needle);
    },
    [levels, needle],
  );

  const pinnedRows = useMemo(() => rows.filter((row) => pinned.has(row.id)), [rows, pinned]);
  const streamRows = useMemo(
    () => rows.filter((row) => !pinned.has(row.id) && passes(row)),
    [rows, pinned, passes],
  );
  const hiddenRows = useMemo(
    () => rows.filter((row) => !pinned.has(row.id) && !passes(row)),
    [rows, pinned, passes],
  );
  const levelCounts = useMemo(() => {
    const counts: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 };
    for (const row of rows) counts[row.level] += 1;
    return counts;
  }, [rows]);

  const offLevels = LEVELS.filter((level) => !levels[level]);
  const stranded = pinnedRows.filter((row) => !passes(row)).length;
  const shown = rows.length - hiddenRows.length;
  const filtered = needle !== "" || offLevels.length > 0;
  /* Remounting the stream on this key is what cross-fades a filter change. Pins are left out of it
     so pinning a row moves that row alone and never flashes the whole pane. */
  const filterKey = `${needle}|${offLevels.join("+")}`;
  const emptyNote =
    rows.length === 0
      ? "Lines land here as the agents emit them."
      : needle !== ""
        ? `No message or source holds “${text.trim()}”${offLevels.length > 0 ? ` at the ${offLevels.map((level) => LEVEL_LABEL[level].toLowerCase()).join(", ")} level` : ""}.`
        : `Every row sits at the ${offLevels.map((level) => LEVEL_LABEL[level].toLowerCase()).join(", ")} level.`;

  /* Arrivals: a line the caller has never handed us before is marked fresh for one animation, and
     the body gets a short settle so the rows below do not look like they were swapped in place. */
  useEffect(() => {
    const ids = rows.map((row) => row.id);
    const previous = seen.current;
    if (previous === null) {
      seen.current = new Set(ids);
      return;
    }
    const live = new Set(ids);
    const added = ids.filter((id) => !previous.has(id));
    const gone = [...previous].filter((id) => !live.has(id));
    seen.current = live;
    if (added.length === 0 && gone.length === 0) return;
    setFresh((prev) => {
      const draft = new Set(prev);
      for (const id of gone) draft.delete(id);
      for (const id of added) draft.add(id);
      return draft;
    });
    if (added.length === 0) return;
    const body = bodyRef.current;
    if (body === null) return;
    const motion = readMotion(body);
    for (const id of added) {
      timers.current.push(
        window.setTimeout(() => {
          setFresh((prev) => {
            if (!prev.has(id)) return prev;
            const draft = new Set(prev);
            draft.delete(id);
            return draft;
          });
        }, motion.enter + 80),
      );
    }
    /* Reduced motion has no entrance animation to end, so the flag is dropped by the timer alone. */
    if (motion.reduced) return;
    body.animate([{ transform: "translateY(-4px)" }, { transform: "translateY(0)" }], {
      duration: motion.settle,
      easing: motion.easeOut,
    });
  }, [rows]);

  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id);
      timers.current = [];
    },
    [],
  );

  const clearFresh = useCallback((id: string) => {
    setFresh((prev) => {
      if (!prev.has(id)) return prev;
      const draft = new Set(prev);
      draft.delete(id);
      return draft;
    });
  }, []);

  const nothing = pinnedRows.length === 0 && streamRows.length === 0;

  const line = (row: LogRow, isPinned: boolean) => (
    <Line
      key={row.id}
      row={row}
      open={expanded.has(row.id)}
      pinned={isPinned}
      stranded={isPinned && !passes(row)}
      fresh={fresh.has(row.id)}
      detailId={`${uid}-${row.id.replace(/\s+/g, "-")}`}
      onToggleOpen={toggleOpen}
      onTogglePin={togglePin}
      onEntered={clearFresh}
    />
  );

  return (
    <section
      className={["ui-aglg", className].filter(Boolean).join(" ")}
      data-state={streaming ? "live" : "paused"}
      aria-label={title}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-agent-logs" precedence="default">
        {css}
      </style>

      <header className="ui-aglg__bar">
        <span className="ui-aglg__headline">
          <span className="ui-aglg__pulse" aria-hidden="true" />
          <span className="ui-aglg__title">{title}</span>{" "}
          <span className="ui-aglg__state">{streaming ? "Streaming" : "Paused"}</span>
        </span>
        <div className="ui-aglg__tools">
          <div className="ui-aglg__levels" role="group" aria-label="Filter by level">
            {LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                className="ui-aglg__chip"
                data-level={level}
                aria-pressed={levels[level]}
                onClick={() => toggleLevel(level)}
              >
                <LevelMark level={level} />
                {LEVEL_LABEL[level]}{" "}
                <span className="ui-aglg__count">{levelCounts[level]}</span>
              </button>
            ))}
          </div>
          <div className="ui-aglg__search">
            <SearchIcon />
            <input
              type="search"
              className="ui-aglg__input"
              value={text}
              placeholder="Filter message or source"
              aria-label="Filter rows by message or source"
              onChange={(event) => setQuery(event.target.value)}
            />
            {text !== "" && (
              <button
                type="button"
                className="ui-aglg__cancel"
                aria-label="Clear the search text"
                onClick={() => setQuery("")}
              >
                <CrossIcon />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="ui-aglg__meta">
        <p className="ui-aglg__summary" role="status" aria-live="polite">
          {`${shown} of ${rows.length} rows`}{" "}
          <span className="ui-aglg__dot" aria-hidden="true" />{" "}
          <span data-quiet={hiddenRows.length === 0 || undefined}>
            {hiddenRows.length === 0
              ? "nothing hidden by the filter"
              : `${hiddenRows.length} hidden by the filter`}
          </span>
        </p>
        {filtered && (
          <button type="button" className="ui-aglg__reset" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      <div className="ui-aglg__body" ref={bodyRef}>
        {nothing ? (
          <div className="ui-aglg__empty">
            <NoMatchIcon />
            <p className="ui-aglg__empty-title">
              {rows.length === 0 ? "The stream is empty" : "No rows match"}
            </p>
            <p className="ui-aglg__empty-note">{emptyNote}</p>
            {filtered && (
              <button type="button" className="ui-aglg__reset" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="ui-aglg__stream" key={filterKey}>
            {pinnedRows.length > 0 && (
              <>
                <p className="ui-aglg__sep">
                  <PinIcon filled />
                  <span>Pinned</span>{" "}
                  <span className="ui-aglg__sep-note">
                    {stranded === 0
                      ? `${pinnedRows.length} held`
                      : `${stranded} of ${pinnedRows.length} outside the filter`}
                  </span>
                </p>
                <ul className="ui-aglg__list">
                  {pinnedRows.map((row) => line(row, true))}
                </ul>
              </>
            )}
            {streamRows.length > 0 && (
              <>
                {pinnedRows.length > 0 && (
                  <p className="ui-aglg__sep ui-aglg__sep--quiet">
                    <span>Filtered</span>{" "}
                    <span className="ui-aglg__sep-note">
                      {streamRows.length} {streamRows.length === 1 ? "row" : "rows"}
                    </span>
                  </p>
                )}
                <ul className="ui-aglg__list">{streamRows.map((row) => line(row, false))}</ul>
              </>
            )}
            {streamRows.length === 0 && (
              <p className="ui-aglg__none">
                No other rows match.
                <button type="button" className="ui-aglg__reset" onClick={clearFilters}>
                  Clear filters
                </button>
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- One line ---------- */

type LineProps = {
  row: LogRow;
  open: boolean;
  pinned: boolean;
  /** Pinned, and kept on screen by the pin alone: it does not pass the current filter */
  stranded: boolean;
  fresh: boolean;
  detailId: string;
  onToggleOpen: (id: string) => void;
  onTogglePin: (id: string) => void;
  onEntered: (id: string) => void;
};

function Line({
  row,
  open,
  pinned,
  stranded,
  fresh,
  detailId,
  onToggleOpen,
  onTogglePin,
  onEntered,
}: LineProps) {
  const clock = clockParts(row.at);
  const fields = row.detail ?? [];
  return (
    <li
      className="ui-aglg__row"
      data-level={row.level}
      data-pinned={pinned || undefined}
      data-stranded={stranded || undefined}
      data-open={open || undefined}
      data-fresh={fresh || undefined}
      onAnimationEnd={(event) => {
        if (event.animationName === "ui-aglg-line-in") onEntered(row.id);
      }}
    >
      <div className="ui-aglg__line">
        <button
          type="button"
          className="ui-aglg__pin"
          aria-pressed={pinned}
          aria-label={`${pinned ? "Unpin" : "Pin"} the ${row.source} line at ${clock.seconds}.${clock.millis}${stranded ? ", which sits outside the current filter" : ""}`}
          onClick={() => onTogglePin(row.id)}
        >
          <PinIcon filled={pinned} />
        </button>{" "}
        <time className="ui-aglg__time" dateTime={clock.iso}>
          {clock.seconds}
          <span className="ui-aglg__ms">.{clock.millis}</span>
        </time>{" "}
        <span className="ui-aglg__level">
          <LevelMark level={row.level} />
          {LEVEL_LABEL[row.level]}
        </span>{" "}
        <span className="ui-aglg__source">{row.source}</span>{" "}
        {fields.length > 0 ? (
          <button
            type="button"
            className="ui-aglg__toggle"
            aria-expanded={open}
            aria-controls={detailId}
            onClick={() => onToggleOpen(row.id)}
          >
            <span className="ui-aglg__message">{row.message}</span>
            <ChevronIcon />
          </button>
        ) : (
          <span className="ui-aglg__message ui-aglg__message--still">{row.message}</span>
        )}
      </div>
      {fields.length > 0 && (
        <div className="ui-aglg__fold" id={detailId} data-open={open || undefined}>
          <div className="ui-aglg__fold-clip">
            <dl className="ui-aglg__fields">
              {fields.map((field) => (
                <div className="ui-aglg__field" key={field.key}>
                  <dt className="ui-aglg__key">{field.key}</dt>
                  <dd className="ui-aglg__value">{field.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </li>
  );
}

/* ---------- Helpers ---------- */

/** `14:32:07.412`, split so the milliseconds can sit quieter than the seconds */
function clockParts(at: number) {
  const date = new Date(at);
  const pad = (value: number, width: number) => String(value).padStart(width, "0");
  return {
    seconds: `${pad(date.getHours(), 2)}:${pad(date.getMinutes(), 2)}:${pad(date.getSeconds(), 2)}`,
    millis: pad(date.getMilliseconds(), 3),
    iso: date.toISOString(),
  };
}

/**
 * Reads the host's motion tokens off a live element, so the settle and the entrance flag follow the
 * same scale the stylesheet does instead of a number this file guessed.
 */
function readMotion(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  const duration = (name: string, fallback: number) => {
    const value = Number.parseFloat(style.getPropertyValue(name));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  return {
    enter: duration("--nm-dur-4", 380),
    settle: duration("--nm-dur-3", 240),
    easeOut: style.getPropertyValue("--nm-ease-out").trim() || "cubic-bezier(0.22, 1, 0.36, 1)",
    reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

/* ---------- Icons ---------- */

function LevelMark({ level }: { level: LogLevel }) {
  if (level === "debug") {
    return (
      <svg className="ui-aglg__mark" viewBox="0 0 12 12" aria-hidden="true">
        <circle cx="6" cy="6" r="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  if (level === "info") {
    return (
      <svg className="ui-aglg__mark" viewBox="0 0 12 12" aria-hidden="true">
        <circle cx="6" cy="6" r="3.2" fill="currentColor" />
      </svg>
    );
  }
  if (level === "warn") {
    return (
      <svg className="ui-aglg__mark" viewBox="0 0 12 12" aria-hidden="true">
        <path
          d="M6 1.4 11 10.6H1Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path
          d="M6 4.6v2.3"
          stroke="var(--ui-aglg-on-mark, #fffdfb)"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        <circle cx="6" cy="8.7" r="0.7" fill="var(--ui-aglg-on-mark, #fffdfb)" />
      </svg>
    );
  }
  return (
    <svg className="ui-aglg__mark" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M4.1 1.3H7.9L10.7 4.1V7.9L7.9 10.7H4.1L1.3 7.9V4.1Z" fill="currentColor" />
      <path
        d="M4.6 4.6 7.4 7.4M7.4 4.6 4.6 7.4"
        stroke="var(--ui-aglg-on-mark, #fffdfb)"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="4.5" r="2.9" fill={filled ? "currentColor" : "none"} />
      <path d="M7 8.4v4.1" strokeWidth={filled ? 2 : 1.2} />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="7" cy="7" r="4.3" />
      <path d="m10.4 10.4 3.1 3.1" strokeLinecap="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="m4 4 6 6M10 4l-6 6" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="m4.4 2.6 3.2 3.4-3.2 3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* A lens with nothing in it: the filter ran and came back empty. */
function NoMatchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.4 15.4 4.6 4.6" strokeLinecap="round" />
      <path d="M3.6 17.4 17.4 3.6" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- Styles ---------- */

const css = /* css */ `
.ui-aglg {
  /* Knobs. A host that wants a different scale overrides them on .ui-aglg */
  --ui-aglg-panel: var(--panel, #1a1512);
  --ui-aglg-card: var(--card, #201a15);
  --ui-aglg-ink: var(--text, #f4ece4);
  --ui-aglg-muted: var(--text-muted, #a2958a);
  --ui-aglg-subtle: var(--text-subtle, #f4ece48c);
  --ui-aglg-line: var(--border, #33291f);
  --ui-aglg-line-soft: var(--border-soft, #ffffff12);
  --ui-aglg-fill: var(--hover-bg, #ffffff12);
  --ui-aglg-accent: var(--accent, #ff6b35);
  --ui-aglg-accent-soft: var(--accent-soft, #ff6b3524);
  --ui-aglg-debug: var(--text-subtle, #f4ece48c);
  --ui-aglg-info: var(--text-muted, #a2958a);
  --ui-aglg-warn: var(--warning, #d99530);
  --ui-aglg-danger: var(--danger, #e2544a);
  --ui-aglg-on-mark: var(--primary-fg, #14100d);
  --ui-aglg-shadow: var(--shadow-card, 0 1px 1.5px #3d1f0a0a, inset 0 -1px 0 #3d1f0a0f);
  --ui-aglg-thumb: #1a14101f;
  --ui-aglg-height: clamp(300px, 78vh, 560px);
  --ui-aglg-mono: var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace);
  box-sizing: border-box;
  container-type: inline-size;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  width: 100%;
  min-width: 0;
  /* A definite height, so the body scrolls instead of stretching the pane it was put in. */
  height: var(--ui-aglg-height);
  overflow: hidden;
  border-radius: var(--radius-panel, 20px);
  background: var(--ui-aglg-panel);
  box-shadow: inset 0 0 0 1px var(--ui-aglg-line), var(--ui-aglg-shadow);
  color: var(--ui-aglg-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
}

.ui-aglg *,
.ui-aglg *::before,
.ui-aglg *::after {
  box-sizing: border-box;
}

:where(.ui-aglg) button {
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: inherit;
  letter-spacing: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.ui-aglg button:focus-visible {
  outline: 2px solid var(--ui-aglg-accent);
  outline-offset: 2px;
}

.ui-aglg ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.ui-aglg svg {
  display: block;
  flex: none;
}

/* ---------- Top bar ---------- */

.ui-aglg__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
  padding: 12px 14px 10px;
}

.ui-aglg__headline {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

/* The one ember mark in the component: the run is alive. */
.ui-aglg__pulse {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ui-aglg-accent);
  animation: ui-aglg-breathe var(--nm-dur-6, 1100ms) var(--nm-ease-soft, cubic-bezier(0.4, 0, 0.2, 1)) infinite alternate;
}

.ui-aglg[data-state="paused"] .ui-aglg__pulse {
  background: var(--ui-aglg-subtle);
  animation: none;
}

.ui-aglg__title {
  min-width: 0;
  overflow: hidden;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ui-aglg-ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ui-aglg__state {
  flex: none;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--ui-aglg-muted);
}

.ui-aglg__tools {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
}

.ui-aglg__levels {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* A level is a glyph, a word and a count, so a pressed state is never colour alone. */
.ui-aglg__chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 9px;
  border-radius: var(--radius-pill, 999px);
  font-size: 12px;
  font-weight: 500;
  color: var(--ui-aglg-subtle);
  box-shadow: inset 0 0 0 1px var(--ui-aglg-line-soft);
  transition: color var(--nm-dur-2, 160ms) var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1)), background-color var(--nm-dur-2, 160ms) var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1)), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1));
}

.ui-aglg__chip:hover {
  background: var(--ui-aglg-fill);
}

.ui-aglg__chip[aria-pressed="true"] {
  color: var(--ui-aglg-ink);
  background: var(--ui-aglg-card);
  box-shadow: inset 0 0 0 1px var(--ui-aglg-line);
}

.ui-aglg__chip[aria-pressed="false"] .ui-aglg__mark {
  opacity: 0.45;
}

.ui-aglg__count {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--ui-aglg-subtle);
}

.ui-aglg__chip[aria-pressed="true"] .ui-aglg__count {
  color: var(--ui-aglg-muted);
}

.ui-aglg [data-level="debug"] {
  --ui-aglg-mark: var(--ui-aglg-debug);
  --ui-aglg-rail: 0.3;
}

.ui-aglg [data-level="info"] {
  --ui-aglg-mark: var(--ui-aglg-info);
  --ui-aglg-rail: 0.45;
}

.ui-aglg [data-level="warn"] {
  --ui-aglg-mark: var(--ui-aglg-warn);
  --ui-aglg-rail: 1;
}

.ui-aglg [data-level="error"] {
  --ui-aglg-mark: var(--ui-aglg-danger);
  --ui-aglg-rail: 1;
}

.ui-aglg__mark {
  flex: none;
  width: 12px;
  height: 12px;
  color: var(--ui-aglg-mark, var(--ui-aglg-muted));
}

.ui-aglg__search {
  display: flex;
  flex: 0 1 240px;
  align-items: center;
  gap: 6px;
  min-width: 152px;
  height: 30px;
  padding: 0 10px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-aglg-card);
  box-shadow: inset 0 0 0 1px var(--ui-aglg-line-soft);
  transition: box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1));
}

/* The ring is drawn on the wrapper so it follows the pill, not the input's own box. */
.ui-aglg__search:focus-within {
  box-shadow: inset 0 0 0 1px var(--ui-aglg-accent), 0 0 0 3px var(--ui-aglg-accent-soft);
}

.ui-aglg__search > svg {
  width: 14px;
  height: 14px;
  color: var(--ui-aglg-subtle);
}

.ui-aglg__input {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  height: 100%;
  font-size: 13px;
  color: var(--ui-aglg-ink);
}

.ui-aglg__input::placeholder {
  color: var(--ui-aglg-subtle);
}

/* The wrapper's :focus-within ring is this input's focus ring. */
.ui-aglg__input:focus-visible {
  outline: none;
}

.ui-aglg__input::-webkit-search-cancel-button {
  -webkit-appearance: none;
  appearance: none;
}

.ui-aglg__cancel {
  display: grid;
  place-items: center;
  flex: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  color: var(--ui-aglg-subtle);
  transition: color var(--nm-dur-1, 90ms) var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1)), background-color var(--nm-dur-1, 90ms) var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1));
}

.ui-aglg__cancel:hover {
  color: var(--ui-aglg-ink);
  background: var(--ui-aglg-fill);
}

.ui-aglg__cancel svg {
  width: 10px;
  height: 10px;
}

/* ---------- Counts ---------- */

.ui-aglg__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 10px;
  padding: 0 14px 10px;
}

.ui-aglg__summary {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--ui-aglg-muted);
}

.ui-aglg__dot {
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: var(--ui-aglg-subtle);
}

.ui-aglg__summary [data-quiet] {
  color: var(--ui-aglg-subtle);
}

/* Something is out of view: amber, and the sentence carries the number. */
.ui-aglg__summary > span:not([data-quiet]) {
  color: var(--ui-aglg-warn);
}

.ui-aglg__reset {
  flex: none;
  padding: 3px 9px;
  border-radius: var(--radius-pill, 999px);
  font-size: 12px;
  font-weight: 500;
  color: var(--ui-aglg-ink);
  box-shadow: inset 0 0 0 1px var(--ui-aglg-line);
  transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1));
}

.ui-aglg__reset:hover {
  background: var(--ui-aglg-fill);
}

/* ---------- Stream ---------- */

.ui-aglg__body {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  /* Room at the top so a row's focus ring is not clipped by the scroll box. */
  padding: 6px 8px 12px;
  scrollbar-width: thin;
  scrollbar-color: var(--ui-aglg-thumb) transparent;
}

.ui-aglg__body::-webkit-scrollbar {
  width: 8px;
}

.ui-aglg__body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: var(--ui-aglg-thumb);
}

.ui-aglg__body::-webkit-scrollbar-track {
  background: transparent;
}

/* Remounted on every filter change, which is the cross-fade. */
.ui-aglg__stream {
  display: grid;
  gap: 2px;
  animation: ui-aglg-swap var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both;
}

.ui-aglg__list {
  display: grid;
}

.ui-aglg__sep {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0 2px;
  padding: 0 8px 0 10px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ui-aglg-muted);
  animation: ui-aglg-sep-in var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both;
}

.ui-aglg__sep svg {
  width: 11px;
  height: 11px;
}

.ui-aglg__sep::after {
  content: "";
  flex: 1 1 auto;
  height: 1px;
  background: var(--ui-aglg-line-soft);
}

.ui-aglg__sep--quiet {
  margin-top: 10px;
}

.ui-aglg__sep-note {
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
  color: var(--ui-aglg-subtle);
}

.ui-aglg__none {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 14px 10px 18px;
  font-size: 12.5px;
  color: var(--ui-aglg-muted);
}

/* ---------- Rows ---------- */

.ui-aglg__row {
  position: relative;
}

.ui-aglg__row[data-fresh] {
  animation: ui-aglg-line-in var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both;
}

.ui-aglg__list > .ui-aglg__row + .ui-aglg__row .ui-aglg__line {
  box-shadow: inset 0 1px 0 var(--ui-aglg-line-soft);
}

.ui-aglg__line {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 8px;
  min-height: 32px;
  padding: 5px 8px 5px 10px;
  border-radius: 10px;
  transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1)), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1));
}

/* The level rail: a shape next to the level chip, at full strength for warn and error. */
.ui-aglg__line::before {
  content: "";
  position: absolute;
  top: 6px;
  bottom: 6px;
  left: 2px;
  width: 2px;
  border-radius: 2px;
  background: var(--ui-aglg-mark, var(--ui-aglg-line));
  opacity: var(--ui-aglg-rail, 0.45);
}

/* Kept on screen by a pin alone: the rail goes dashed, so the reason is visible, not just coloured. */
.ui-aglg__row[data-stranded] .ui-aglg__line::before {
  background: repeating-linear-gradient(180deg, var(--ui-aglg-mark, var(--ui-aglg-line)) 0 2px, transparent 2px 4px);
}

.ui-aglg__line:hover,
.ui-aglg__line:focus-within {
  background: var(--ui-aglg-fill);
}

.ui-aglg__row[data-pinned] .ui-aglg__line {
  background: var(--ui-aglg-card);
}

.ui-aglg__row[data-pinned] .ui-aglg__line:hover,
.ui-aglg__row[data-pinned] .ui-aglg__line:focus-within {
  background: var(--ui-aglg-card);
  box-shadow: inset 0 0 0 1px var(--ui-aglg-line);
}

.ui-aglg__pin {
  position: relative;
  display: grid;
  place-items: center;
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  color: var(--ui-aglg-subtle);
  transition: color var(--nm-dur-1, 90ms) var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1)), background-color var(--nm-dur-1, 90ms) var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1));
}

/* A 32px hit area around a 20px button. */
.ui-aglg__pin::after {
  content: "";
  position: absolute;
  inset: -6px;
}

.ui-aglg__pin svg {
  width: 13px;
  height: 13px;
}

.ui-aglg__pin:hover {
  color: var(--ui-aglg-ink);
  background: var(--ui-aglg-fill);
}

.ui-aglg__pin[aria-pressed="true"] {
  color: var(--ui-aglg-ink);
}

.ui-aglg__time {
  flex: none;
  width: 92px;
  font-family: var(--ui-aglg-mono);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  color: var(--ui-aglg-muted);
  white-space: nowrap;
}

.ui-aglg__ms {
  color: var(--ui-aglg-subtle);
}

.ui-aglg__level {
  display: inline-flex;
  align-items: center;
  flex: none;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--ui-aglg-muted);
}

.ui-aglg__row[data-level="warn"] .ui-aglg__level {
  color: var(--ui-aglg-warn);
}

.ui-aglg__row[data-level="error"] .ui-aglg__level {
  color: var(--ui-aglg-danger);
}

.ui-aglg__source {
  flex: none;
  max-width: 132px;
  overflow: hidden;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--ui-aglg-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ui-aglg__toggle,
.ui-aglg__message--still {
  flex: 1 1 180px;
  min-width: 0;
  margin: -3px -6px;
  padding: 3px 6px;
  border-radius: 6px;
  transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1));
}

.ui-aglg__toggle {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ui-aglg__toggle:hover {
  background: var(--ui-aglg-fill);
}

.ui-aglg__toggle > svg {
  width: 12px;
  height: 12px;
  color: var(--ui-aglg-subtle);
  transition: transform var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1));
}

.ui-aglg__row[data-open] .ui-aglg__toggle > svg {
  transform: rotate(90deg);
  color: var(--ui-aglg-muted);
}

.ui-aglg__message {
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  color: var(--ui-aglg-ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ui-aglg__row[data-open] .ui-aglg__message {
  overflow-wrap: anywhere;
  white-space: normal;
}

/* ---------- Detail ---------- */

.ui-aglg__fold {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: grid-template-rows var(--nm-dur-4, 380ms) var(--nm-ease-in, cubic-bezier(0.55, 0, 0.68, 0.19)), opacity var(--nm-dur-3, 240ms) var(--nm-ease-in, cubic-bezier(0.55, 0, 0.68, 0.19));
}

.ui-aglg__fold[data-open] {
  grid-template-rows: 1fr;
  opacity: 1;
  transition: grid-template-rows var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) var(--nm-stagger, 45ms);
}

.ui-aglg__fold-clip {
  min-height: 0;
  overflow: hidden;
}

.ui-aglg__fields {
  display: grid;
  gap: 4px;
  margin: 0 6px 8px 40px;
  padding: 8px 10px 9px;
  border-radius: var(--radius-preview, 12px);
  background: var(--ui-aglg-card);
  box-shadow: inset 0 0 0 1px var(--ui-aglg-line-soft);
}

.ui-aglg__field {
  display: grid;
  grid-template-columns: minmax(84px, max-content) minmax(0, 1fr);
  column-gap: 12px;
  align-items: baseline;
}

.ui-aglg__key {
  font-family: var(--ui-aglg-mono);
  font-size: 11.5px;
  color: var(--ui-aglg-muted);
}

.ui-aglg__value {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--ui-aglg-ink);
  overflow-wrap: anywhere;
}

/* ---------- Empty ---------- */

.ui-aglg__empty {
  display: grid;
  align-content: center;
  justify-items: center;
  min-height: 100%;
  gap: 6px;
  padding: 40px 24px;
  text-align: center;
}

.ui-aglg__empty > svg {
  width: 26px;
  height: 26px;
  margin-bottom: 2px;
  color: var(--ui-aglg-subtle);
}

.ui-aglg__empty-title {
  margin: 0;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--ui-aglg-ink);
}

.ui-aglg__empty-note {
  max-width: 36ch;
  margin: 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--ui-aglg-muted);
}

.ui-aglg__empty .ui-aglg__reset {
  margin-top: 8px;
}

/* ---------- Narrow ---------- */

@container (max-width: 560px) {
  .ui-aglg__bar {
    align-items: stretch;
    flex-direction: column;
  }

  .ui-aglg__tools {
    justify-content: flex-start;
  }

  .ui-aglg__search {
    flex-basis: 100%;
  }

  .ui-aglg__time {
    width: 86px;
  }

  .ui-aglg__source {
    max-width: 96px;
  }

  .ui-aglg__fields {
    margin-left: 12px;
  }

  .ui-aglg__field {
    grid-template-columns: minmax(0, 1fr);
    row-gap: 1px;
  }
}

:where(.dark, [data-theme="dark"]) .ui-aglg {
  --ui-aglg-on-mark: #14100d;
  --ui-aglg-thumb: #ffffff1f;
}

@media (prefers-reduced-motion: reduce) {
  .ui-aglg *,
  .ui-aglg *::before,
  .ui-aglg *::after {
    animation: none;
    transition-duration: 1ms;
  }

  .ui-aglg__pulse {
    opacity: 1;
    transform: none;
  }
}

@keyframes ui-aglg-line-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes ui-aglg-swap {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes ui-aglg-sep-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes ui-aglg-breathe {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0.55;
    transform: scale(1.6);
  }
}
`;