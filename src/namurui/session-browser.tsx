"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/*
 * Session browser: the sessions a bridge knows about, grouped by when they were last touched,
 * with search, inline rename and a delete that asks inside the row it would remove. Rows arrive
 * once on mount and settle into place with a short stagger; the ember rule on the left of the
 * open session draws itself in when the active row changes, and the row actions fade in under
 * the pointer or the focus ring rather than sitting on every row at rest. Styles are injected
 * below, so no extra files are needed.
 */

export type SessionRow = {
  /** Stable session id, shown in the row and searched alongside the title */
  id: string;
  /** Display name; null or blank renders as Untitled */
  title: string | null;
  /** Last activity, milliseconds since the epoch */
  mtimeMs: number;
  /** Transcript size in bytes */
  sizeBytes: number;
  /** Turns recorded in the session, when the bridge reports them */
  messageCount?: number;
  /** Spend so far in dollars, when the bridge reports it */
  cost?: number;
};

export type SessionBrowserProps = {
  /** Sessions in any order; rows are grouped and sorted by last activity */
  sessions: readonly SessionRow[];
  /** Id of the session currently open, marked with the ember rule */
  activeId?: string;
  /** Search text, controlled; falls back to internal state when undefined */
  query?: string;
  /** Called with the next search text, on every keystroke and on clear */
  onQueryChange?: (query: string) => void;
  /** Called with the session when a row is opened */
  onOpen: (session: SessionRow) => void;
  /** Shows a new-session action beside the search field */
  onNew?: () => void;
  /** Called with the new title when a rename commits */
  onRename?: (session: SessionRow, title: string) => void;
  /** Called when a delete is confirmed in the row */
  onDelete?: (session: SessionRow) => void;
  /** Called when export is chosen from the row actions */
  onExport?: (session: SessionRow) => void;
  /** Renders three skeleton rows instead of the list */
  loading?: boolean;
  /** Extra class on the root */
  className?: string;
};

const UNTITLED = "Untitled";

/* Three placeholder rows: a long title, a short one, and one that reads as a second line. */
const SKELETON: readonly { title: string; meta: string }[] = [
  { title: "64%", meta: "38%" },
  { title: "46%", meta: "29%" },
  { title: "72%", meta: "44%" },
];

const LENS: ReactNode = (
  <svg
    viewBox="0 0 14 14"
    width="13"
    height="13"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <circle cx="6.2" cy="6.2" r="3.9" />
    <path d="m9.2 9.2 2.6 2.6" />
  </svg>
);

const CROSS: ReactNode = (
  <svg
    viewBox="0 0 14 14"
    width="11"
    height="11"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M3.7 3.7 10.3 10.3" />
    <path d="M10.3 3.7 3.7 10.3" />
  </svg>
);

const PLUS: ReactNode = (
  <svg
    viewBox="0 0 14 14"
    width="11"
    height="11"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M7 2.9v8.2" />
    <path d="M2.9 7h8.2" />
  </svg>
);

const PENCIL: ReactNode = (
  <svg
    viewBox="0 0 14 14"
    width="13"
    height="13"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9.3 2.4 11.6 4.7 4.7 11.6 1.7 12.3 2.4 9.3z" />
    <path d="M8 3.7 10.3 6" />
  </svg>
);

const EXPORT: ReactNode = (
  <svg
    viewBox="0 0 14 14"
    width="13"
    height="13"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M7 2.2v6.2" />
    <path d="M4.6 6.2 7 8.6l2.4-2.4" />
    <path d="M2.6 10.3v1.2h8.8v-1.2" />
  </svg>
);

const TRASH: ReactNode = (
  <svg
    viewBox="0 0 14 14"
    width="13"
    height="13"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2.6 4.2h8.8" />
    <path d="M5.6 4.2V2.8h2.8v1.4" />
    <path d="M3.8 4.2l.5 7.2h5.4l.5-7.2" />
  </svg>
);

const TERMINAL: ReactNode = (
  <svg
    viewBox="0 0 20 20"
    width="17"
    height="17"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="2.4" y="4" width="15.2" height="12" rx="2.4" />
    <path d="M6 8.4 8.2 10.6 6 12.8" />
    <path d="M10.6 13h3.2" />
  </svg>
);

const NO_MATCH: ReactNode = (
  <svg
    viewBox="0 0 20 20"
    width="17"
    height="17"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="8.6" cy="8.6" r="5" />
    <path d="m12.4 12.4 4.2 4.2" />
    <path d="M6.7 8.6h3.8" />
  </svg>
);

/** The title a row is shown and searched under */
function titleOf(row: SessionRow): string {
  const trimmed = row.title?.trim();
  return trimmed ? trimmed : UNTITLED;
}

/* Sizes read at a glance: whole bytes below a kilobyte, one decimal below ten. */
function bytes(value: number): string {
  const n = Math.max(0, Math.round(value));
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return kb < 10 ? `${kb.toFixed(1).replace(/\.0$/, "")} KB` : `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return mb < 10 ? `${mb.toFixed(1).replace(/\.0$/, "")} MB` : `${Math.round(mb)} MB`;
}

/* Relative to the minute, then the hour, then the week, so a long-running list stays short. */
function ago(ms: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - ms) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function midnight(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/* Split a title at every occurrence of the query, so each hit can carry its own wash. */
function segments(text: string, query: string): { text: string; hit: boolean }[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [{ text, hit: false }];
  const hay = text.toLowerCase();
  const out: { text: string; hit: boolean }[] = [];
  let from = 0;
  let at = hay.indexOf(needle);
  while (at !== -1) {
    if (at > from) out.push({ text: text.slice(from, at), hit: false });
    out.push({ text: text.slice(at, at + needle.length), hit: true });
    from = at + needle.length;
    at = hay.indexOf(needle, from);
  }
  if (from < text.length) out.push({ text: text.slice(from), hit: false });
  return out;
}

export function SessionBrowser({
  sessions,
  activeId,
  query,
  onQueryChange,
  onOpen,
  onNew,
  onRename,
  onDelete,
  onExport,
  loading = false,
  className,
}: SessionBrowserProps) {
  const uid = useId();
  const [ownQuery, setOwnQuery] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  /* Renames land here first, so the row reads correctly even if the caller never re-sends it */
  const [renamed, setRenamed] = useState<Record<string, string>>({});

  const fieldRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const rowButtons = useRef(new Map<string, HTMLButtonElement>());
  const escaped = useRef(false);

  const text = query === undefined ? ownQuery : query;
  const editingId = editing === null ? null : editing.id;

  /* Relative times are data, not decoration: one tick a minute keeps the labels honest. */
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  /* Drop a local title once the caller sends the same one back, or once the session is gone. */
  useEffect(() => {
    setRenamed((current) => {
      const keys = Object.keys(current);
      if (keys.length === 0) return current;
      const next: Record<string, string> = {};
      let dropped = false;
      for (const key of keys) {
        const row = sessions.find((item) => item.id === key);
        if (!row || titleOf(row) === current[key]) {
          dropped = true;
          continue;
        }
        next[key] = current[key];
      }
      return dropped ? next : current;
    });
  }, [sessions]);

  /* The field takes focus with the whole title selected, so a rename starts from the name. */
  useEffect(() => {
    if (editingId === null) return;
    const field = editRef.current;
    if (!field) return;
    field.focus();
    field.select();
  }, [editingId]);

  /* Focus is restored through state so it lands after the row has re-rendered. */
  useEffect(() => {
    if (focusId === null) return;
    rowButtons.current.get(focusId)?.focus();
    setFocusId(null);
  }, [focusId, sessions]);

  /* A delete confirm takes focus on Keep: the safe answer is the one under the return key. */
  useEffect(() => {
    if (confirming === null) return;
    keepRef.current?.focus();
  }, [confirming]);

  const rows = useMemo(() => {
    const needle = text.trim().toLowerCase();
    const sorted = [...sessions].sort((a, b) => b.mtimeMs - a.mtimeMs);
    if (!needle) return sorted;
    return sorted.filter((row) => {
      const name = (renamed[row.id] ?? titleOf(row)).toLowerCase();
      return name.includes(needle) || row.id.toLowerCase().includes(needle);
    });
  }, [sessions, text, renamed]);

  /* Two sessions can share a name; the id is only read out when it is doing real work. */
  const shared = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of sessions) {
      const name = (renamed[row.id] ?? titleOf(row)).toLowerCase();
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const out = new Set<string>();
    counts.forEach((count, name) => {
      if (count > 1) out.add(name);
    });
    return out;
  }, [sessions, renamed]);

  const groups = useMemo(() => {
    const today = midnight(now);
    const yesterdayDate = new Date(today);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.getTime();
    const buckets: Record<"today" | "yesterday" | "earlier", SessionRow[]> = {
      today: [],
      yesterday: [],
      earlier: [],
    };
    for (const row of rows) {
      if (row.mtimeMs >= today) buckets.today.push(row);
      else if (row.mtimeMs >= yesterday) buckets.yesterday.push(row);
      else buckets.earlier.push(row);
    }
    return [
      { key: "today", label: "Today", rows: buckets.today },
      { key: "yesterday", label: "Yesterday", rows: buckets.yesterday },
      { key: "earlier", label: "Earlier", rows: buckets.earlier },
    ].filter((group) => group.rows.length > 0);
  }, [rows, now]);

  const writeQuery = (next: string) => {
    if (query === undefined) setOwnQuery(next);
    onQueryChange?.(next);
  };

  const startRename = (row: SessionRow) => {
    escaped.current = false;
    setConfirming(null);
    setEditing({ id: row.id, draft: renamed[row.id] ?? titleOf(row) });
  };

  const commitRename = () => {
    if (editing === null) return;
    const id = editing.id;
    const next = editing.draft.trim();
    const row = sessions.find((item) => item.id === id);
    setEditing(null);
    setFocusId(id);
    if (!row) return;
    const keeps = next !== "" && next !== titleOf(row);
    /* A rename back to the shipped title drops the local override rather than pinning it. */
    setRenamed((current) => {
      const copy = { ...current };
      if (keeps) copy[id] = next;
      else delete copy[id];
      return copy;
    });
    if (keeps) onRename?.(row, next);
  };

  const cancelRename = () => {
    if (editing === null) return;
    escaped.current = true;
    const id = editing.id;
    setEditing(null);
    setFocusId(id);
  };

  /* Escape unmounts the field, and the unmount can still raise a blur; that blur must not
   * commit the title the user just threw away. */
  const blurRename = () => {
    if (escaped.current) {
      escaped.current = false;
      return;
    }
    commitRename();
  };

  const askDelete = (row: SessionRow) => {
    setEditing(null);
    setConfirming(row.id);
  };

  const keepRow = () => {
    const id = confirming;
    setConfirming(null);
    if (id !== null) setFocusId(id);
  };

  const removeRow = (row: SessionRow) => {
    const index = rows.findIndex((item) => item.id === row.id);
    const neighbour = rows[index + 1]?.id ?? rows[index - 1]?.id ?? null;
    setConfirming(null);
    onDelete?.(row);
    if (neighbour !== null) setFocusId(neighbour);
  };

  /* Arrow keys walk the visible rows, F2 renames the row the key came from, and the open
   * button keeps its native Enter, so a keyboard user never has to leave the list. */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target;
    const from =
      target instanceof Element
        ? target.closest("[data-session]")?.getAttribute("data-session") ?? null
        : null;

    if (event.key === "Escape") {
      if (confirming !== null) {
        event.preventDefault();
        keepRow();
      }
      return;
    }

    if (event.key === "F2") {
      if (from === null || editing !== null) return;
      const row = rows.find((item) => item.id === from);
      if (!row) return;
      event.preventDefault();
      startRename(row);
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (editing !== null) return;
    const index = rows.findIndex((item) => item.id === from);
    const step = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = index === -1 ? 0 : Math.min(rows.length - 1, Math.max(0, index + step));
    const next = rows[nextIndex];
    if (!next) return;
    event.preventDefault();
    rowButtons.current.get(next.id)?.focus();
  };

  const state = loading
    ? "loading"
    : sessions.length === 0
      ? "empty"
      : rows.length === 0
        ? "nomatch"
        : "list";

  const announcement = loading
    ? "Loading sessions"
    : text.trim()
      ? `${rows.length} of ${sessions.length} sessions match`
      : `${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}`;

  const rowNode = (row: SessionRow, index: number) => {
    const title = renamed[row.id] ?? titleOf(row);
    const isActive = row.id === activeId;
    const draft = editing !== null && editing.id === row.id ? editing.draft : null;
    const isConfirming = confirming === row.id;
    const suffix = shared.has(title.toLowerCase()) ? `, ${row.id}` : "";

    const meta = [ago(row.mtimeMs, now), bytes(row.sizeBytes)];
    if (row.messageCount !== undefined) {
      meta.push(`${row.messageCount} ${row.messageCount === 1 ? "msg" : "msgs"}`);
    }
    if (row.cost !== undefined) meta.push(`$${row.cost.toFixed(2)}`);

    return (
      <li
        key={row.id}
        className="ui-sbr__row"
        data-session={row.id}
        data-active={isActive ? "true" : undefined}
        style={{ animationDelay: `calc(var(--ui-sbr-stagger) * ${Math.min(index, 6)})` }}
      >
        <div className="ui-sbr__card">
          {isConfirming ? (
            <div className="ui-sbr__confirm" role="group" aria-label={`Delete ${title}${suffix}`}>
              <span className="ui-sbr__question" role="alert">
                Delete this session?
              </span>
              <button
                type="button"
                className="ui-sbr__choice ui-sbr__choice--danger"
                onClick={() => removeRow(row)}
              >
                Delete
              </button>
              <button type="button" className="ui-sbr__choice" ref={keepRef} onClick={keepRow}>
                Keep
              </button>
            </div>
          ) : (
            <>
              {draft !== null ? (
                <div className="ui-sbr__body">
                  <input
                    ref={editRef}
                    className="ui-sbr__input"
                    value={draft}
                    aria-label={`Rename ${title}${suffix}`}
                    onChange={(event) => setEditing({ id: row.id, draft: event.target.value })}
                    onBlur={blurRename}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitRename();
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        cancelRename();
                      }
                    }}
                  />
                  <span className="ui-sbr__meta">{meta.join(" · ")}</span>
                </div>
              ) : (
                <button
                  type="button"
                  className="ui-sbr__open"
                  ref={(node) => {
                    if (node) rowButtons.current.set(row.id, node);
                    else rowButtons.current.delete(row.id);
                  }}
                  aria-current={isActive ? "true" : undefined}
                  aria-label={`Open ${title}${suffix}, ${meta.join(", ")}`}
                  onClick={() => onOpen(row)}
                >
                  <span className="ui-sbr__title">
                    {segments(title, text).map((part, index) =>
                      part.hit ? (
                        <mark className="ui-sbr__hit" key={index}>
                          {part.text}
                        </mark>
                      ) : (
                        <span key={index}>{part.text}</span>
                      ),
                    )}
                  </span>
                  <span className="ui-sbr__meta">
                    <span className="ui-sbr__when">{meta.join(" · ")}</span>
                    <span className="ui-sbr__id">{row.id}</span>
                  </span>
                </button>
              )}

              <div className="ui-sbr__actions">
                {onRename ? (
                  <button
                    type="button"
                    className="ui-sbr__action"
                    aria-label={`Rename ${title}${suffix}`}
                    title="Rename (F2)"
                    onClick={() => startRename(row)}
                  >
                    {PENCIL}
                  </button>
                ) : null}
                {onExport ? (
                  <button
                    type="button"
                    className="ui-sbr__action"
                    aria-label={`Export ${title}${suffix}`}
                    title="Export"
                    onClick={() => onExport(row)}
                  >
                    {EXPORT}
                  </button>
                ) : null}
                {onDelete ? (
                  <button
                    type="button"
                    className="ui-sbr__action ui-sbr__action--danger"
                    aria-label={`Delete ${title}${suffix}`}
                    title="Delete"
                    onClick={() => askDelete(row)}
                  >
                    {TRASH}
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </li>
    );
  };

  return (
    <section
      className={["ui-sbr", className].filter(Boolean).join(" ")}
      data-state={state}
      aria-label="Session browser"
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-session-browser" precedence="default">
        {css}
      </style>

      <div className="ui-sbr__bar">
        <div className="ui-sbr__search" role="search">
          <span className="ui-sbr__lens" aria-hidden="true">
            {LENS}
          </span>
          <input
            ref={fieldRef}
            className="ui-sbr__field"
            type="search"
            value={text}
            placeholder="Search sessions"
            aria-label="Search sessions by title or id"
            onChange={(event) => writeQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && text !== "") {
                event.stopPropagation();
                writeQuery("");
              }
              /* Down from the field drops into the list, so the whole browser is one
               * keyboard loop rather than two. */
              if (event.key === "ArrowDown" && rows.length > 0) {
                event.preventDefault();
                rowButtons.current.get(rows[0].id)?.focus();
              }
            }}
          />
          {text !== "" ? (
            <button
              type="button"
              className="ui-sbr__clear"
              aria-label="Clear search"
              onClick={() => {
                writeQuery("");
                fieldRef.current?.focus();
              }}
            >
              {CROSS}
            </button>
          ) : null}
        </div>

        {onNew ? (
          <button type="button" className="ui-sbr__new" onClick={onNew}>
            <span className="ui-sbr__new-glyph" aria-hidden="true">
              {PLUS}
            </span>
            New session
          </button>
        ) : null}
      </div>

      <p className="ui-sbr__live" role="status" aria-live="polite">
        {announcement}
      </p>

      {loading ? (
        <ul className="ui-sbr__list" aria-hidden="true">
          {SKELETON.map((shape, index) => (
            <li key={index} className="ui-sbr__row">
              <div className="ui-sbr__card">
                <div className="ui-sbr__skel">
                  <span
                    className="ui-sbr__skel-bar"
                    style={{
                      width: shape.title,
                      animationDelay: `calc(var(--ui-sbr-stagger) * ${index})`,
                    }}
                  />
                  <span
                    className="ui-sbr__skel-bar ui-sbr__skel-bar--meta"
                    style={{ width: shape.meta }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : state === "empty" ? (
        <div className="ui-sbr__state">
          <span className="ui-sbr__state-glyph" aria-hidden="true">
            {TERMINAL}
          </span>
          <p className="ui-sbr__state-title">No sessions yet</p>
          <p className="ui-sbr__state-text">
            Sessions you start are listed here, newest first.
          </p>
        </div>
      ) : state === "nomatch" ? (
        <div className="ui-sbr__state">
          <span className="ui-sbr__state-glyph" aria-hidden="true">
            {NO_MATCH}
          </span>
          <p className="ui-sbr__state-title">No sessions match “{text.trim()}”</p>
          <p className="ui-sbr__state-text">Titles and ids are searched. Try a shorter word.</p>
          <button
            type="button"
            className="ui-sbr__state-action"
            onClick={() => {
              writeQuery("");
              fieldRef.current?.focus();
            }}
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="ui-sbr__groups" onKeyDown={onKeyDown}>
          {groups.map((group) => (
            <section className="ui-sbr__group" key={group.key} aria-labelledby={`${uid}-${group.key}`}>
              <h3 className="ui-sbr__group-head" id={`${uid}-${group.key}`}>
                <span>{group.label}</span>
                <span className="ui-sbr__group-count">{group.rows.length}</span>
              </h3>
              <ul className="ui-sbr__list">{group.rows.map(rowNode)}</ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

const css = /* css */ `
.ui-sbr {
  /* Knobs. Override any of these on .ui-sbr to retheme the browser in a host. */
  --ui-sbr-ink: var(--text, #1a1410);
  --ui-sbr-muted: var(--text-muted, #6f625a);
  --ui-sbr-subtle: var(--text-subtle, #8a7d72);
  --ui-sbr-panel: var(--panel, #fffdfb);
  --ui-sbr-raised: var(--raised, #f3ece4);
  --ui-sbr-line: var(--border, #e8e0d7);
  --ui-sbr-edge: var(--border-soft, #1a14101a);
  --ui-sbr-wash: #7a4a1c0a;
  --ui-sbr-hover: #7a4a1c12;
  --ui-sbr-hit: #7a4a1c1a;
  --ui-sbr-hit-line: #7a4a1c33;
  --ui-sbr-skel: #1a14100f;
  --ui-sbr-accent: var(--accent, #c2410c);
  --ui-sbr-danger: var(--danger, #b3261e);
  --ui-sbr-danger-wash: #b3261e12;
  --ui-sbr-focus: var(--accent, #c2410c);
  --ui-sbr-ease: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-sbr-ease-soft: var(--nm-ease-soft, cubic-bezier(0.4, 0, 0.2, 1));
  --ui-sbr-dur-1: var(--nm-dur-1, 90ms);
  --ui-sbr-dur-2: var(--nm-dur-2, 160ms);
  --ui-sbr-dur-3: var(--nm-dur-3, 240ms);
  --ui-sbr-dur-pulse: var(--nm-dur-6, 1100ms);
  --ui-sbr-stagger: var(--nm-stagger, 45ms);

  box-sizing: border-box;
  display: grid;
  gap: 10px;
  width: 100%;
  padding: 12px;
  background: var(--ui-sbr-panel);
  border-radius: var(--radius-card, 16px);
  box-shadow: inset 0 0 0 1px var(--ui-sbr-line);
  color: var(--ui-sbr-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 18px;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
}
.ui-sbr *,
.ui-sbr *::before,
.ui-sbr *::after {
  box-sizing: border-box;
}
.ui-sbr p,
.ui-sbr h3,
.ui-sbr ul {
  margin: 0;
  padding: 0;
}
.ui-sbr ul {
  list-style: none;
}
:where(.ui-sbr) button {
  margin: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
:where(.ui-sbr) svg {
  display: block;
}

/* Search bar -------------------------------------------------------------- */
.ui-sbr__bar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.ui-sbr__search {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 7px;
  min-width: 0;
  height: 32px;
  padding: 0 4px 0 9px;
  border-radius: 10px;
  background: var(--ui-sbr-raised);
  box-shadow: inset 0 0 0 1px transparent;
  transition: box-shadow var(--ui-sbr-dur-2) var(--ui-sbr-ease);
}
.ui-sbr__search:hover {
  box-shadow: inset 0 0 0 1px var(--ui-sbr-edge);
}
.ui-sbr__lens {
  display: grid;
  flex: none;
  place-items: center;
  width: 13px;
  height: 13px;
  color: var(--ui-sbr-subtle);
}
.ui-sbr__field {
  flex: 1 1 auto;
  min-width: 0;
  height: 28px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--ui-sbr-ink);
  font: inherit;
  line-height: 28px;
  appearance: none;
}
.ui-sbr__field::placeholder {
  color: var(--ui-sbr-subtle);
}
.ui-sbr__field::-webkit-search-cancel-button {
  display: none;
}
.ui-sbr__field:focus-visible {
  outline: 2px solid var(--ui-sbr-focus);
  outline-offset: 1px;
  border-radius: 6px;
}
.ui-sbr__clear {
  display: grid;
  flex: none;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: var(--ui-sbr-muted);
  transition:
    color var(--ui-sbr-dur-1) var(--ui-sbr-ease),
    background-color var(--ui-sbr-dur-1) var(--ui-sbr-ease);
}
.ui-sbr__clear:hover {
  background: var(--ui-sbr-hover);
  color: var(--ui-sbr-ink);
}
.ui-sbr__clear:focus-visible {
  outline: 2px solid var(--ui-sbr-focus);
  outline-offset: -1px;
}
.ui-sbr__new {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 11px 0 9px;
  border-radius: 10px;
  background: var(--ui-sbr-raised);
  box-shadow: inset 0 0 0 1px var(--ui-sbr-edge);
  color: var(--ui-sbr-ink);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  transition:
    background-color var(--ui-sbr-dur-1) var(--ui-sbr-ease),
    transform var(--ui-sbr-dur-1) var(--ui-sbr-ease);
}
.ui-sbr__new:hover {
  background: var(--ui-sbr-hover);
}
.ui-sbr__new:active {
  transform: scale(0.97);
}
.ui-sbr__new:focus-visible {
  outline: 2px solid var(--ui-sbr-focus);
  outline-offset: 1px;
}
.ui-sbr__new-glyph {
  display: grid;
  place-items: center;
  width: 11px;
  height: 11px;
  color: var(--ui-sbr-muted);
}

/* Groups and rows --------------------------------------------------------- */
.ui-sbr__groups {
  display: grid;
  gap: 12px;
  min-width: 0;
}
.ui-sbr__group {
  display: grid;
  gap: 1px;
  min-width: 0;
}
.ui-sbr__group-head {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 0 4px 3px;
  color: var(--ui-sbr-muted);
  font-size: 10.5px;
  font-weight: 500;
  line-height: 16px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.ui-sbr__group-count {
  padding: 0 5px;
  border-radius: 999px;
  background: var(--ui-sbr-wash);
  color: var(--ui-sbr-subtle);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}
.ui-sbr__list {
  display: grid;
  gap: 1px;
  min-width: 0;
}
.ui-sbr__row {
  position: relative;
  min-width: 0;
  border-radius: 10px;
  /* A row that appears — first paint, or a wider search — rises the last 3px into place,
   * held back by its own step of the stagger so the list settles top to bottom. */
  animation: ui-sbr-row-in var(--ui-sbr-dur-3) var(--ui-sbr-ease) both;
}
@keyframes ui-sbr-row-in {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.ui-sbr__card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 7px 8px 7px 14px;
  border-radius: 10px;
  transition: background-color var(--ui-sbr-dur-2) var(--ui-sbr-ease);
}
/* The ember rule: one live row per surface, and it draws itself in when the open row moves. */
.ui-sbr__card::before {
  content: "";
  position: absolute;
  left: 4px;
  top: 9px;
  bottom: 9px;
  width: 2px;
  border-radius: 999px;
  background: var(--ui-sbr-accent);
  opacity: 0;
  transform: scaleY(0.35);
  transform-origin: center;
  transition:
    opacity var(--ui-sbr-dur-3) var(--ui-sbr-ease),
    transform var(--ui-sbr-dur-3) var(--ui-sbr-ease);
}
.ui-sbr__row[data-active="true"] .ui-sbr__card::before {
  opacity: 1;
  transform: none;
}
.ui-sbr__card:hover {
  background: var(--ui-sbr-wash);
}
.ui-sbr__row[data-active="true"] .ui-sbr__card {
  background: var(--ui-sbr-raised);
}

/* The title line is a fixed 20px box whether it holds text or the rename field, so
 * swapping one for the other never moves the row. */
.ui-sbr__open,
.ui-sbr__body {
  display: grid;
  gap: 1px;
  min-width: 0;
  width: 100%;
  padding: 0;
  border-radius: 6px;
}
.ui-sbr__open:focus-visible {
  outline: 2px solid var(--ui-sbr-focus);
  outline-offset: 2px;
}
.ui-sbr__title {
  display: block;
  height: 20px;
  overflow: hidden;
  color: var(--ui-sbr-ink);
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-sbr__hit {
  padding: 0;
  border-radius: 3px;
  background: var(--ui-sbr-hit);
  box-shadow: inset 0 -1px 0 var(--ui-sbr-hit-line);
  color: var(--ui-sbr-ink);
}
.ui-sbr__meta {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  color: var(--ui-sbr-muted);
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
}
.ui-sbr__when {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}
.ui-sbr__id {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--ui-sbr-subtle);
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
  font-size: 10px;
  letter-spacing: 0;
  text-overflow: ellipsis;
}
.ui-sbr__id::before {
  content: "·";
  margin-right: 6px;
  color: var(--ui-sbr-subtle);
}
/* The inset ring is the field's focus ring: it is always on while editing, and it costs
 * no width, so the text does not shift when the title becomes an input. */
.ui-sbr__input {
  display: block;
  width: calc(100% + 5px);
  height: 20px;
  margin: 0 0 0 -5px;
  padding: 0 5px;
  border: 0;
  border-radius: 5px;
  background: var(--ui-sbr-panel);
  box-shadow: inset 0 0 0 1.5px var(--ui-sbr-accent);
  color: var(--ui-sbr-ink);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  letter-spacing: -0.01em;
  outline: none;
}

/* Row actions ------------------------------------------------------------- */
.ui-sbr__actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 1px;
  opacity: 0;
  transform: translateX(2px);
  transition:
    opacity var(--ui-sbr-dur-2) var(--ui-sbr-ease),
    transform var(--ui-sbr-dur-2) var(--ui-sbr-ease);
}
.ui-sbr__card:hover .ui-sbr__actions,
.ui-sbr__card:focus-within .ui-sbr__actions {
  opacity: 1;
  transform: none;
}
/* Without a pointer there is no hover to reveal them, so they stay out. */
@media (hover: none) {
  .ui-sbr__actions {
    opacity: 1;
    transform: none;
  }
}
.ui-sbr__action {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 6px;
  color: var(--ui-sbr-muted);
  transition:
    color var(--ui-sbr-dur-1) var(--ui-sbr-ease),
    background-color var(--ui-sbr-dur-1) var(--ui-sbr-ease),
    transform var(--ui-sbr-dur-1) var(--ui-sbr-ease);
}
.ui-sbr__action:hover {
  background: var(--ui-sbr-hover);
  color: var(--ui-sbr-ink);
}
.ui-sbr__action:active {
  transform: scale(0.92);
}
.ui-sbr__action--danger:hover {
  background: var(--ui-sbr-danger-wash);
  color: var(--ui-sbr-danger);
}
.ui-sbr__action:focus-visible {
  outline: 2px solid var(--ui-sbr-focus);
  outline-offset: -1px;
}

/* Delete asks once, in the row it would remove, at the same height as a resting row. */
.ui-sbr__confirm {
  display: flex;
  grid-column: 1 / -1;
  align-items: center;
  gap: 6px;
  min-width: 0;
  min-height: 37px;
}
.ui-sbr__question {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--ui-sbr-ink);
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-sbr__choice {
  flex: none;
  height: 24px;
  padding: 0 10px;
  border-radius: 6px;
  box-shadow: inset 0 0 0 1px var(--ui-sbr-edge);
  color: var(--ui-sbr-ink);
  font-size: 11.5px;
  font-weight: 500;
  line-height: 22px;
  white-space: nowrap;
  transition:
    background-color var(--ui-sbr-dur-1) var(--ui-sbr-ease),
    transform var(--ui-sbr-dur-1) var(--ui-sbr-ease);
}
.ui-sbr__choice:hover {
  background: var(--ui-sbr-hover);
}
.ui-sbr__choice:active {
  transform: scale(0.96);
}
.ui-sbr__choice--danger {
  color: var(--ui-sbr-danger);
}
.ui-sbr__choice--danger:hover {
  background: var(--ui-sbr-danger-wash);
}
.ui-sbr__choice:focus-visible {
  outline: 2px solid var(--ui-sbr-focus);
  outline-offset: -1px;
}

/* Empty, no match, loading ------------------------------------------------ */
.ui-sbr__state {
  display: grid;
  justify-items: center;
  gap: 3px;
  padding: 24px 16px 26px;
  border-radius: var(--radius-preview, 12px);
  background: var(--ui-sbr-wash);
  text-align: center;
}
.ui-sbr__state-glyph {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  margin-bottom: 4px;
  border-radius: 9px;
  background: var(--ui-sbr-raised);
  color: var(--ui-sbr-muted);
}
.ui-sbr__state-title {
  color: var(--ui-sbr-ink);
  font-size: 12.5px;
  font-weight: 500;
  line-height: 18px;
  overflow-wrap: anywhere;
}
.ui-sbr__state-text {
  max-width: 264px;
  color: var(--ui-sbr-muted);
  font-size: 11.5px;
  line-height: 16px;
}
.ui-sbr__state-action {
  margin-top: 7px;
  height: 26px;
  padding: 0 11px;
  border-radius: 7px;
  background: var(--ui-sbr-raised);
  box-shadow: inset 0 0 0 1px var(--ui-sbr-edge);
  color: var(--ui-sbr-ink);
  font-size: 11.5px;
  font-weight: 500;
  transition: background-color var(--ui-sbr-dur-1) var(--ui-sbr-ease);
}
.ui-sbr__state-action:hover {
  background: var(--ui-sbr-hover);
}
.ui-sbr__state-action:focus-visible {
  outline: 2px solid var(--ui-sbr-focus);
  outline-offset: 1px;
}
.ui-sbr__skel {
  display: grid;
  align-content: center;
  gap: 7px;
  height: 37px;
  min-width: 0;
}
.ui-sbr__skel-bar {
  display: block;
  height: 11px;
  border-radius: 4px;
  background: var(--ui-sbr-skel);
  animation: ui-sbr-breathe var(--ui-sbr-dur-pulse) var(--ui-sbr-ease-soft) infinite alternate;
}
.ui-sbr__skel-bar--meta {
  height: 9px;
}
@keyframes ui-sbr-breathe {
  from {
    opacity: 0.4;
  }
  to {
    opacity: 1;
  }
}

/* The count line is read, not shown: the group headings already carry the visible counts. */
.ui-sbr__live {
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

:where(.dark, [data-theme="dark"]) .ui-sbr {
  --ui-sbr-ink: var(--text, #f4ece4);
  --ui-sbr-muted: var(--text-muted, #a2958a);
  --ui-sbr-subtle: var(--text-subtle, #f4ece48c);
  --ui-sbr-panel: var(--panel, #1a1512);
  --ui-sbr-raised: var(--raised, #26201a);
  --ui-sbr-line: var(--border, #33291f);
  --ui-sbr-edge: var(--border-soft, #ffffff12);
  --ui-sbr-wash: #ffffff0d;
  --ui-sbr-hover: #ffffff14;
  --ui-sbr-hit: #ffffff1f;
  --ui-sbr-hit-line: #ffffff40;
  --ui-sbr-skel: #ffffff12;
  --ui-sbr-accent: var(--accent, #ff6b35);
  --ui-sbr-danger: var(--danger, #e2544a);
  --ui-sbr-danger-wash: #e2544a24;
  --ui-sbr-focus: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  .ui-sbr__search,
  .ui-sbr__clear,
  .ui-sbr__new,
  .ui-sbr__card,
  .ui-sbr__card::before,
  .ui-sbr__actions,
  .ui-sbr__action,
  .ui-sbr__choice,
  .ui-sbr__state-action {
    transition-duration: 1ms;
  }
  .ui-sbr__card::before,
  .ui-sbr__actions {
    transform: none;
  }
  .ui-sbr__new:active,
  .ui-sbr__action:active,
  .ui-sbr__choice:active {
    transform: none;
  }
  .ui-sbr__skel-bar {
    animation: none;
    opacity: 0.7;
  }
  .ui-sbr__row {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
`;
