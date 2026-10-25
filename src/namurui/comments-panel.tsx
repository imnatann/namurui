"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

/*
 * Comments Panel – a review feed with filters, runnable /edit commands, resolve and a composer,
 * in a single self-contained file.
 * Tabs narrow the feed, the small menu changes its order, and comments that begin with /edit grow a
 * Run edit button that spins while the edit runs and then reports what happened. Resolve dims and
 * strikes the thread, a new comment fades in at the top, and the composer sends on Enter.
 * The feed window glides between heights as filters change.
 * The styles are injected below, so no extra files are needed.
 */

export type CommentAuthor = {
  name: string;
  /** Portrait URL – initials are drawn when left out */
  avatar?: string;
};

/** Which slice of the feed a tab shows */
export type CommentFilter = "all" | "questions" | "edits";

export type CommentSort = "newest" | "oldest";

export type PanelComment = {
  id: string;
  author: CommentAuthor;
  /** ISO string, Date or epoch milliseconds */
  createdAt: string | Date | number;
  /** Text starting with /edit becomes a runnable edit */
  text: string;
  resolved?: boolean;
};

export type CommentsPanelProps = {
  /** Every comment – the panel filters and orders them itself */
  comments: PanelComment[];
  /** Active tab – controlled when given */
  filter?: CommentFilter;
  /** Tab the panel starts on when `filter` is not controlled */
  defaultFilter?: CommentFilter;
  onFilterChange?: (filter: CommentFilter) => void;
  /** Feed order – controlled when given */
  sort?: CommentSort;
  /** Order the panel starts on when `sort` is not controlled */
  defaultSort?: CommentSort;
  onSortChange?: (sort: CommentSort) => void;
  /** Resolve or reopen a comment; the panel also updates its own copy */
  onResolve?: (comment: PanelComment, resolved: boolean) => void;
  /**
   * Runs an /edit comment. The button spins until the returned promise settles – return one when the
   * work is async. Without a handler the panel demonstrates the run itself.
   */
  onRunEdit?: (comment: PanelComment) => Promise<void> | void;
  /**
   * Called with the trimmed composer text. Supplying it hands the feed to you: add the comment to
   * `comments` yourself. Without it the panel appends the comment locally.
   */
  onSend?: (text: string) => void;
  /** Author shown next to the composer and on comments the panel adds itself */
  currentUser?: CommentAuthor;
  title?: string;
  /** Tallest the feed window grows before it scrolls, in px */
  maxHeight?: number;
  onClose?: () => void;
  className?: string;
};

type RunState = "running" | "done";

const FILTERS: { id: CommentFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "questions", label: "Questions" },
  { id: "edits", label: "Edits" },
];

const SORTS: { id: CommentSort; label: string }[] = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
];

const EMPTY_COPY: Record<CommentFilter, string> = {
  all: "No comments yet.",
  questions: "No questions yet.",
  edits: "No edits yet.",
};

function isEdit(comment: PanelComment) {
  return /^\/edit\b/i.test(comment.text.trim());
}

function stamp(value: string | Date | number) {
  return typeof value === "number" ? value : new Date(value).getTime();
}

function ago(at: number, now: number) {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function Avatar({ author }: { author: CommentAuthor }) {
  if (author.avatar) {
    return <img className="ui-cpc__avatar" alt="" width={20} height={20} loading="lazy" src={author.avatar} />;
  }
  const initials = author.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className="ui-cpc__avatar ui-cpc__avatar--initials" aria-hidden="true">
      {initials}
    </span>
  );
}

export function CommentsPanel({
  comments,
  filter,
  defaultFilter = "all",
  onFilterChange,
  sort,
  defaultSort = "newest",
  onSortChange,
  onResolve,
  onRunEdit,
  onSend,
  currentUser = { name: "You" },
  title = "Comments",
  maxHeight = 260,
  onClose,
  className,
}: CommentsPanelProps) {
  const [list, setList] = useState<PanelComment[]>(comments);
  const [innerFilter, setInnerFilter] = useState<CommentFilter>(defaultFilter);
  const [innerSort, setInnerSort] = useState<CommentSort>(defaultSort);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [runs, setRuns] = useState<Record<string, RunState>>({});
  const [feedHeight, setFeedHeight] = useState(maxHeight);
  const [smooth, setSmooth] = useState(false);
  const [now] = useState(() => Date.now());

  const activeFilter = filter ?? innerFilter;
  const activeSort = sort ?? innerSort;

  const sortRef = useRef<HTMLDivElement>(null);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listRef = useRef<HTMLUListElement>(null);
  const emptyRef = useRef<HTMLParagraphElement>(null);
  const timers = useRef<number[]>([]);
  const inFlight = useRef<Set<string>>(new Set());
  const active = useRef(true);

  useEffect(() => {
    setList(comments);
  }, [comments]);

  useEffect(() => {
    active.current = true;
    const pending = timers.current;
    return () => {
      active.current = false;
      pending.forEach((timer) => window.clearTimeout(timer));
      pending.length = 0;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      sortButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const editCount = list.filter(isEdit).length;

  const shown = list
    .filter((comment) => {
      if (activeFilter === "edits") return isEdit(comment);
      if (activeFilter === "questions") return !isEdit(comment);
      return true;
    })
    .slice()
    .sort((a, b) => {
      const gap = stamp(a.createdAt) - stamp(b.createdAt);
      return activeSort === "newest" ? -gap : gap;
    });

  const isEmpty = shown.length === 0;

  // The feed window takes the height of whatever is inside it, capped, so filters glide instead of jumping
  useLayoutEffect(() => {
    const inner = isEmpty ? emptyRef.current : listRef.current;
    if (!inner) return;
    const sync = () => setFeedHeight(Math.min(inner.offsetHeight, maxHeight));
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [isEmpty, maxHeight]);

  // The glide only starts once the first measurement is in, so the panel does not animate open
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSmooth(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const chooseFilter = (next: CommentFilter) => {
    if (filter === undefined) setInnerFilter(next);
    onFilterChange?.(next);
  };

  const chooseSort = (next: CommentSort) => {
    if (sort === undefined) setInnerSort(next);
    onSortChange?.(next);
    setMenuOpen(false);
  };

  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = FILTERS.length - 1;
    let target: number | null = null;
    if (event.key === "ArrowRight") target = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") target = index === 0 ? last : index - 1;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = last;
    if (target === null) return;
    event.preventDefault();
    chooseFilter(FILTERS[target].id);
    tabRefs.current[target]?.focus();
  };

  const setResolved = (comment: PanelComment, resolved: boolean) => {
    setList((current) =>
      current.map((entry) => (entry.id === comment.id ? { ...entry, resolved } : entry)),
    );
    onResolve?.(comment, resolved);
  };

  const undoRun = (id: string) => {
    setRuns((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const runEdit = async (comment: PanelComment) => {
    if (inFlight.current.has(comment.id)) return;
    inFlight.current.add(comment.id);
    setRuns((current) => ({ ...current, [comment.id]: "running" }));
    try {
      if (onRunEdit) {
        await onRunEdit(comment);
      } else {
        // No handler: show the work the button stands for rather than nothing at all
        await new Promise<void>((resolve) => {
          timers.current.push(window.setTimeout(resolve, 900));
        });
      }
      if (!active.current) return;
      setRuns((current) => ({ ...current, [comment.id]: "done" }));
    } catch {
      if (!active.current) return;
      undoRun(comment.id);
    } finally {
      inFlight.current.delete(comment.id);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    if (onSend) {
      onSend(text);
      return;
    }
    const comment: PanelComment = {
      id: `local-${Date.now()}`,
      author: currentUser,
      createdAt: new Date(),
      text,
    };
    setList((current) => [comment, ...current]);
  };

  return (
    <section
      className={["ui-cpc", className].filter(Boolean).join(" ")}
      aria-label={title}
      style={{ "--ui-cpc-max-height": `${maxHeight}px` } as CSSProperties}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-comments-panel" precedence="default">
        {css}
      </style>

      <header className="ui-cpc__head">
        <h3 className="ui-cpc__title">{title}</h3>
        <button type="button" className="ui-cpc__icon-btn" aria-label="Close comments" onClick={onClose}>
          <svg viewBox="0 0 16 16" className="ui-cpc__glyph" aria-hidden="true">
            <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
          </svg>
        </button>
      </header>

      <div className="ui-cpc__bar">
        <div className="ui-cpc__tabs" role="tablist" aria-label="Filter comments">
          {FILTERS.map((tab, index) => (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              aria-selected={activeFilter === tab.id}
              className="ui-cpc__tab"
              onClick={() => chooseFilter(tab.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              {tab.label}
              {tab.id === "edits" && <span className="ui-cpc__count">{editCount}</span>}
            </button>
          ))}
        </div>
        <div className="ui-cpc__sort" ref={sortRef}>
          <button
            ref={sortButtonRef}
            type="button"
            className="ui-cpc__icon-btn"
            aria-label="Sort comments"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg viewBox="0 0 16 16" className="ui-cpc__glyph" aria-hidden="true">
              <path d="M2.5 4.5h11M4.5 8h7M6.5 11.5h3" />
            </svg>
          </button>
          {menuOpen && (
            <div className="ui-cpc__menu" role="menu" aria-label="Sort comments">
              {SORTS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={activeSort === option.id}
                  className="ui-cpc__menu-item"
                  onClick={() => chooseSort(option.id)}
                >
                  {option.label}
                  {activeSort === option.id && (
                    <svg viewBox="0 0 16 16" className="ui-cpc__glyph ui-cpc__menu-check" aria-hidden="true">
                      <path d="M3.5 8.3l3 3 6-6.6" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="ui-cpc__morph" data-smooth={smooth ? "" : undefined} style={{ height: feedHeight }}>
        {isEmpty ? (
          <p className="ui-cpc__empty" ref={emptyRef}>
            {EMPTY_COPY[activeFilter]}
          </p>
        ) : (
          <ul className="ui-cpc__list" aria-live="polite" ref={listRef}>
            {shown.map((comment) => {
              const edit = isEdit(comment);
              const run = runs[comment.id];
              return (
                <li key={comment.id} className="ui-cpc__item" data-resolved={comment.resolved ? "" : undefined}>
                  <div className="ui-cpc__meta">
                    <Avatar author={comment.author} />
                    <span className="ui-cpc__name">{comment.author.name}</span>
                    <time className="ui-cpc__time" dateTime={new Date(stamp(comment.createdAt)).toISOString()}>
                      {ago(stamp(comment.createdAt), now)}
                    </time>
                    <button
                      type="button"
                      className="ui-cpc__resolve"
                      aria-pressed={comment.resolved ?? false}
                      aria-label="Resolve comment"
                      title={comment.resolved ? "Reopen" : "Resolve"}
                      onClick={() => setResolved(comment, !comment.resolved)}
                    >
                      <svg viewBox="0 0 16 16" className="ui-cpc__glyph" aria-hidden="true">
                        <path d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12ZM5.5 8.2l1.7 1.7 3.3-3.8" />
                      </svg>
                    </button>
                  </div>
                  <p className="ui-cpc__text">
                    {edit ? (
                      <>
                        <span className="ui-cpc__command">/Edit</span>
                        {` ${comment.text.trim().replace(/^\/edit\s*/i, "")}`}
                      </>
                    ) : (
                      comment.text
                    )}
                  </p>
                  {edit && (
                    <div className="ui-cpc__actions">
                      {run === "running" ? (
                        <button type="button" className="ui-cpc__btn" disabled>
                          <span className="ui-cpc__spinner" aria-hidden="true" />
                          <span className="ui-cpc__shimmer" data-text="Running">
                            Running
                          </span>
                        </button>
                      ) : run === "done" ? (
                        <>
                          <span className="ui-cpc__done">
                            <svg viewBox="0 0 16 16" className="ui-cpc__glyph" aria-hidden="true">
                              <path d="M3.5 8.3l3 3 6-6.6" />
                            </svg>
                            Edited
                          </span>
                          <button type="button" className="ui-cpc__link" onClick={() => undoRun(comment.id)}>
                            Undo
                          </button>
                        </>
                      ) : (
                        <button type="button" className="ui-cpc__btn" onClick={() => void runEdit(comment)}>
                          <svg viewBox="0 0 16 16" className="ui-cpc__glyph" data-solid="true" aria-hidden="true">
                            <path d="M5 3.6a.8.8 0 0 1 1.2-.7l6.3 3.9a1.4 1.4 0 0 1 0 2.4l-6.3 3.9a.8.8 0 0 1-1.2-.7V3.6Z" />
                          </svg>
                          Run edit
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form className="ui-cpc__composer" onSubmit={submit}>
        <Avatar author={currentUser} />
        <input
          className="ui-cpc__input"
          placeholder="Add a comment or /edit…"
          aria-label="Add a comment"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="ui-cpc__send" aria-label="Send comment" disabled={draft.trim().length === 0}>
          <svg viewBox="0 0 16 16" className="ui-cpc__glyph" aria-hidden="true">
            <path d="M8 12.5v-9M4 7.5l4-4 4 4" />
          </svg>
        </button>
      </form>
    </section>
  );
}

const css = /* css */ `
.ui-cpc{--ui-cpc-card: #fffdfb;--ui-cpc-ink: rgba(11, 9, 8, 0.88);--ui-cpc-strong: #0b0908;--ui-cpc-text: rgba(11, 9, 8, 0.61);--ui-cpc-muted: rgba(11, 9, 8, 0.45);--ui-cpc-faint: rgba(11, 9, 8, 0.27);--ui-cpc-icon: rgba(11, 9, 8, 0.447);--ui-cpc-line: rgba(11, 9, 8, 0.06);--ui-cpc-wash: rgba(11, 9, 8, 0.03);--ui-cpc-fill: rgba(11, 9, 8, 0.06);--ui-cpc-fill-strong: rgba(11, 9, 8, 0.1);--ui-cpc-accent: rgba(217, 84, 31, 0.765);--ui-cpc-focus: rgba(217, 84, 31, 0.35);--ui-cpc-ok: #2f8d5c;--ui-cpc-ok-soft: rgba(47, 141, 92, 0.08);--ui-cpc-solid: rgba(11, 9, 8, 0.88);--ui-cpc-on-solid: #fcf9f7;--ui-cpc-shine: rgba(255, 253, 251, 0.82);--ui-cpc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-cpc-shadow-pop: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 12px 28px -10px rgba(11, 9, 8, 0.16), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-cpc-ease: cubic-bezier(0.22, 1, 0.36, 1);position: relative;box-sizing: border-box;container-type: inline-size;display: flex;flex-direction: column;width: 100%;max-width: 400px;border-radius: 10px;background: var(--ui-cpc-card);box-shadow: var(--ui-cpc-shadow);font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;font-weight: 400;color: var(--ui-cpc-ink);-webkit-font-smoothing: antialiased}
.ui-cpc *, .ui-cpc *::before, .ui-cpc *::after{box-sizing: border-box}
:where(.ui-cpc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;cursor: pointer}
:where(.ui-cpc) svg{display: block;flex: none}
.ui-cpc button:focus-visible{outline: 2px solid var(--ui-cpc-focus);outline-offset: 1px}
.ui-cpc__glyph{width: 16px;height: 16px;fill: none;stroke: currentColor;stroke-width: 1.1;stroke-linecap: round;stroke-linejoin: round}
.ui-cpc__glyph[data-solid]{fill: currentColor;stroke: none}
.ui-cpc__head{display: flex;align-items: center;justify-content: space-between;gap: 12px;padding: 12px 12px 0 16px}
.ui-cpc__title{margin: 0;font-size: 15px;font-weight: 500;line-height: 24px;color: var(--ui-cpc-strong)}
.ui-cpc__icon-btn{display: grid;place-items: center;flex: none;width: 28px;height: 28px;border-radius: 6px;color: var(--ui-cpc-icon);transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cpc__icon-btn:hover, .ui-cpc__icon-btn[aria-expanded="true"]{background: var(--ui-cpc-wash);color: var(--ui-cpc-ink)}
.ui-cpc__bar{display: flex;align-items: center;justify-content: space-between;gap: 8px;padding: 10px 12px 12px 16px;border-bottom: 0.5px solid var(--ui-cpc-line)}
.ui-cpc__tabs{display: flex;gap: 8px;min-width: 0}
.ui-cpc__tab{display: inline-flex;align-items: center;gap: 6px;flex: none;padding: 4px 10px;border-radius: 6px;box-shadow: inset 0 0 0 0.5px var(--ui-cpc-line);font-size: 13px;font-weight: 500;line-height: 20px;color: var(--ui-cpc-text);white-space: nowrap;transition: background-color 90ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 90ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cpc__tab:hover{background: var(--ui-cpc-wash)}
.ui-cpc__tab[aria-selected="true"]{background: var(--ui-cpc-fill);color: var(--ui-cpc-ink)}
.ui-cpc__count{display: inline-grid;place-items: center;min-width: 16px;height: 16px;margin-right: -4px;padding: 0 4px;border-radius: 5px;background: var(--ui-cpc-fill);font-size: 11px;font-weight: 500;line-height: 16px;font-variant-numeric: tabular-nums;color: var(--ui-cpc-text);animation: ui-cpc-pop var(--nm-dur-3, 240ms) var(--ui-cpc-ease) both}
.ui-cpc__tab[aria-selected="true"] .ui-cpc__count{background: var(--ui-cpc-card);box-shadow: 0 0 0 0.5px var(--ui-cpc-line);color: var(--ui-cpc-ink)}
.ui-cpc__sort{position: relative;flex: none}
.ui-cpc__menu{position: absolute;top: calc(100% + 6px);right: 0;z-index: 5;display: grid;gap: 2px;min-width: 160px;padding: 4px;border-radius: 10px;background: var(--ui-cpc-card);box-shadow: var(--ui-cpc-shadow-pop);transform-origin: top right;animation: ui-cpc-drop var(--nm-dur-2, 160ms) var(--ui-cpc-ease)}
.ui-cpc__menu-item{display: flex;align-items: center;justify-content: space-between;gap: 12px;height: 28px;padding: 0 8px 0 10px;border-radius: 6px;font-size: 13px;line-height: 20px;text-align: left;color: var(--ui-cpc-ink);transition: background-color 90ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cpc__menu-item:hover{background: var(--ui-cpc-fill)}
.ui-cpc__menu-check{color: var(--ui-cpc-accent);stroke-width: 1.4}
.ui-cpc__list{max-height: var(--ui-cpc-max-height, 360px);margin: 0;padding: 0;overflow-y: auto;list-style: none;scrollbar-width: thin;scrollbar-color: var(--ui-cpc-fill-strong) transparent}
.ui-cpc__item{padding: 12px 16px 14px;border-top: 0.5px solid var(--ui-cpc-line);animation: ui-cpc-in var(--nm-dur-4, 380ms) var(--ui-cpc-ease) both;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cpc__item:first-child{border-top: 0}
.ui-cpc__item[data-resolved]{opacity: 0.5}
.ui-cpc__meta{display: flex;align-items: center;gap: 8px;min-width: 0}
.ui-cpc__avatar{flex: none;width: 20px;height: 20px;border-radius: 50%;object-fit: cover;box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.1)}
.ui-cpc__avatar--initials{display: grid;place-items: center;background: var(--ui-cpc-fill);font-size: 9px;font-weight: 500;line-height: 1;color: var(--ui-cpc-text)}
.ui-cpc__name{min-width: 0;overflow: hidden;font-size: 13px;font-weight: 500;line-height: 20px;white-space: nowrap;text-overflow: ellipsis;color: var(--ui-cpc-strong)}
.ui-cpc__time{flex: none;margin-left: auto;font-size: 12px;line-height: 16px;font-variant-numeric: tabular-nums;white-space: nowrap;color: var(--ui-cpc-faint)}
.ui-cpc__resolve{display: grid;place-items: center;flex: none;width: 24px;height: 24px;margin: -2px -4px -2px 0;border-radius: 6px;color: var(--ui-cpc-icon);opacity: 0;transition: opacity var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cpc__item:hover .ui-cpc__resolve, .ui-cpc__resolve:focus-visible, .ui-cpc__resolve[aria-pressed="true"]{opacity: 1}
.ui-cpc__resolve:hover{background: var(--ui-cpc-wash);color: var(--ui-cpc-ink)}
.ui-cpc__resolve[aria-pressed="true"]{background: var(--ui-cpc-ok-soft);color: var(--ui-cpc-ok)}
.ui-cpc__text{margin: 6px 0 0 28px;font-size: 13px;line-height: 20px;color: var(--ui-cpc-ink);overflow-wrap: anywhere}
.ui-cpc__item[data-resolved] .ui-cpc__text{text-decoration: line-through;text-decoration-color: var(--ui-cpc-faint)}
.ui-cpc__command{font-weight: 500;color: var(--ui-cpc-muted)}
.ui-cpc__actions{display: flex;align-items: center;gap: 10px;margin: 10px 0 0 28px}
.ui-cpc__btn{display: inline-flex;align-items: center;gap: 6px;height: 28px;padding: 0 10px 0 8px;border-radius: 6px;background: var(--ui-cpc-card);box-shadow: var(--ui-cpc-shadow);font-size: 13px;font-weight: 500;line-height: 20px;color: var(--ui-cpc-strong);transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cpc__btn .ui-cpc__glyph{color: var(--ui-cpc-icon)}
.ui-cpc__btn:hover:not(:disabled){background: #faf7f4}
.ui-cpc__btn:disabled{color: var(--ui-cpc-muted);cursor: progress}
.ui-cpc__spinner{flex: none;width: 12px;height: 12px;margin: 0 2px;border: 1.2px solid var(--ui-cpc-fill-strong);border-top-color: var(--ui-cpc-accent);border-radius: 50%;animation: ui-cpc-spin var(--nm-dur-5, 620ms) linear infinite}
.ui-cpc__shimmer{position: relative;display: inline-block}
.ui-cpc__shimmer::after{content: attr(data-text);content: attr(data-text) / "";position: absolute;inset: 0;white-space: nowrap;color: transparent;background: linear-gradient(90deg, transparent 38%, var(--ui-cpc-shine) 50%, transparent 62%) 100% 0 / 300% 100% no-repeat;-webkit-background-clip: text;background-clip: text;animation: ui-cpc-sweep var(--nm-dur-6, 1100ms) linear infinite;pointer-events: none}
.ui-cpc__done{display: inline-flex;align-items: center;gap: 6px;height: 28px;padding: 0 10px 0 8px;border-radius: 6px;background: var(--ui-cpc-ok-soft);font-size: 13px;font-weight: 500;line-height: 20px;color: var(--ui-cpc-ok);animation: ui-cpc-in var(--nm-dur-3, 240ms) var(--ui-cpc-ease)}
.ui-cpc__link{height: 28px;padding: 0 4px;border-radius: 6px;font-size: 13px;line-height: 20px;color: var(--ui-cpc-muted);transition: color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cpc__link:hover{background: var(--ui-cpc-wash);color: var(--ui-cpc-ink)}
.ui-cpc__empty{padding: 28px 16px;font-size: 13px;line-height: 20px;text-align: center;color: var(--ui-cpc-muted)}
.ui-cpc__composer{display: flex;align-items: center;gap: 8px;padding: 8px 8px 8px 16px;border-top: 0.5px solid var(--ui-cpc-line)}
.ui-cpc__input{flex: 1;min-width: 0;height: 28px;margin: 0;padding: 0;border: 0;outline: none;background: transparent;font: inherit;font-size: 13px;line-height: 20px;color: var(--ui-cpc-strong);caret-color: var(--ui-cpc-accent)}
.ui-cpc__input::placeholder{color: var(--ui-cpc-faint);opacity: 1}
.ui-cpc__send{display: grid;place-items: center;flex: none;width: 28px;height: 28px;border-radius: 6px;background: var(--ui-cpc-solid);color: var(--ui-cpc-on-solid);transition: opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cpc__send .ui-cpc__glyph{stroke-width: 1.5}
.ui-cpc__send:disabled{opacity: 0.3;cursor: default}
.ui-cpc__send:not(:disabled):active{transform: scale(0.94)}
@keyframes ui-cpc-in{from{opacity: 0;transform: translateY(3px)}
}
@keyframes ui-cpc-drop{from{opacity: 0;transform: translateY(-4px) scale(0.98)}
}
@keyframes ui-cpc-pop{from{opacity: 0;transform: scale(0.8)}
}
@keyframes ui-cpc-spin{to{transform: rotate(360deg)}
}
@keyframes ui-cpc-sweep{from{background-position: 100% 0}
to{background-position: 0% 0}
}
.ui-cpc__morph{overflow: hidden}
.ui-cpc__morph[data-smooth]{transition: height 380ms var(--ui-cpc-ease)}
@container (max-width: 360px){.ui-cpc__head{padding-left: 14px}
.ui-cpc__bar{padding-left: 14px;padding-right: 10px}
.ui-cpc__tabs{gap: 4px}
.ui-cpc__tab{padding: 4px 8px}
.ui-cpc__item{padding-left: 14px;padding-right: 14px}
.ui-cpc__composer{padding-left: 14px}
}
@container (max-width: 300px){.ui-cpc__text, .ui-cpc__actions{margin-left: 0}
}
@media (hover: none) and (pointer: coarse){.ui-cpc__icon-btn, .ui-cpc__send{width: 36px;height: 36px}
.ui-cpc__tab{padding: 6px 12px}
.ui-cpc__menu-item{height: 36px}
.ui-cpc__btn, .ui-cpc__done, .ui-cpc__link{height: 34px}
.ui-cpc__input{height: 36px}
.ui-cpc__resolve{width: 32px;height: 32px;margin: -6px -6px -6px 0;opacity: 1}
}
@media (prefers-reduced-motion: reduce){.ui-cpc *, .ui-cpc *::before, .ui-cpc *::after{animation: none !important;transition: none !important}
}
.ui-cpc input:not([type="checkbox"]):not([type="radio"]):focus-visible, .ui-cpc textarea:focus-visible, .ui-cpc [contenteditable]:focus-visible{outline: none}
:where(.dark, [data-theme="dark"]) .ui-cpc{--ui-cpc-card: #211b16;--ui-cpc-ink: rgba(255, 253, 251, 0.9);--ui-cpc-strong: #fffdfb;--ui-cpc-text: rgba(255, 253, 251, 0.62);--ui-cpc-muted: rgba(255, 253, 251, 0.46);--ui-cpc-faint: rgba(255, 253, 251, 0.3);--ui-cpc-icon: rgba(255, 253, 251, 0.5);--ui-cpc-line: rgba(255, 253, 251, 0.08);--ui-cpc-wash: rgba(255, 253, 251, 0.04);--ui-cpc-fill: rgba(255, 253, 251, 0.08);--ui-cpc-fill-strong: rgba(255, 253, 251, 0.14);--ui-cpc-accent: #ff8a5c;--ui-cpc-focus: rgba(255, 138, 92, 0.5);--ui-cpc-ok: #2f8d5c;--ui-cpc-ok-soft: rgba(47, 141, 92, 0.14);--ui-cpc-solid: rgba(255, 253, 251, 0.9);--ui-cpc-on-solid: #211b16;--ui-cpc-shine: #fffdfb;--ui-cpc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-cpc-shadow-pop: 0 0 0 0.5px rgba(255, 253, 251, 0.12), 0 12px 28px -10px rgba(11, 9, 8, 0.6)}
:where(.dark, [data-theme="dark"]) .ui-cpc__btn:hover:not(:disabled){background: #27201a}
:where(.dark, [data-theme="dark"]) .ui-cpc__menu{background: #27201a}
:where(.dark, [data-theme="dark"]) .ui-cpc__avatar{box-shadow: 0 0 0 0.5px rgba(255, 255, 255, 0.14)}

`;
