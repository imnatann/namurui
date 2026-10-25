"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";

/*
 * Memory Panel – what the assistant remembers about you, grouped and editable.
 * A master switch dims the list and unfolds a note; category chips filter, the search field
 * takes the chips' place, and every memory can be edited in place, paused or forgotten.
 * Forgetting folds the row away with a blur and puts Undo in the last row for a few seconds;
 * Undo unfolds the memory back at its old place. The last row is a polite live region that
 * narrates the counts, the forgotten memory and the editing hints.
 * The styles are injected below, so no extra files are needed.
 */

export type Memory = {
  id: string;
  /** The remembered sentence, e.g. "Prefers TypeScript examples" */
  text: string;
  /** The group it is listed under, e.g. "Preferences" */
  category: string;
  /** Shown as given, e.g. "From chat" */
  source?: string;
  /** Shown as given, e.g. "Oct 12" */
  date?: string;
  /** Kept, but not used until resumed */
  paused?: boolean;
};

export type MemoryPanelProps = {
  /** { id, text, category, source?, date?, paused? } – source and date are shown as given, e.g. "From chat" and "Oct 12" */
  memories: Memory[];
  /** Called with the full list after any change. With it the panel shows exactly the memories you pass; without it the changes live inside the panel */
  onChange?: (memories: Memory[]) => void;
  /** A memory was added with New memory */
  onAdd?: (memory: Memory) => void;
  /** The text of a memory was edited and saved */
  onEdit?: (id: string, text: string) => void;
  /** A memory was paused or resumed */
  onPause?: (id: string, paused: boolean) => void;
  /** A memory was forgotten – it can still come back with Undo */
  onForget?: (id: string) => void;
  /** A forgotten memory was brought back with Undo, at its old place */
  onUndo?: (memory: Memory) => void;
  /** The Use memory switch, controlled */
  enabled?: boolean;
  /** Start state of the switch when it is not controlled */
  defaultEnabled?: boolean;
  /** Called when the switch is flipped */
  onEnabledChange?: (enabled: boolean) => void;
  /** Order of the groups and the choices for new memories – defaults to the categories in the order they appear */
  categories?: string[];
  /** Heading of the panel */
  title?: string;
  /** Height of the list in px before it scrolls */
  maxHeight?: number;
  /** How long Undo stays in the last row after forgetting, in ms */
  undoFor?: number;
  /** Source given to memories added in the panel; their date is today */
  addedSource?: string;
  /** A button in the last row of the card – Undo takes its place for a moment after forgetting */
  action?: { label: string; onClick: () => void };
  /** Extra class on the root */
  className?: string;
};

type Counts = { total: number; paused: number };
type Flags = Record<string, boolean>;
type Forgotten = { memory: Memory; index: number; key: number };

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const autosize = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

/* Counts tween towards their next value, so the badge and the last row never jump. */
function useCountsTween(target: Counts, duration: number): Counts {
  const [shown, setShown] = useState<Counts>(target);
  const previous = useRef<Counts>(target);
  const key = JSON.stringify(target);

  useEffect(() => {
    const next = JSON.parse(key) as Counts;
    const from = { ...previous.current };
    if (reducedMotion() || Object.keys(next).every((field) => from[field as keyof Counts] === next[field as keyof Counts])) {
      previous.current = next;
      setShown(next);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 4;
      const values: Counts = { total: 0, paused: 0 };
      for (const field of Object.keys(next) as (keyof Counts)[]) {
        const base = from[field] ?? next[field];
        values[field] = base + (next[field] - base) * eased;
      }
      previous.current = values;
      setShown(values);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [key, duration]);

  return shown;
}

/* True while a horizontal strip (chips, categories) has more content off to the right. */
function useOverflow(ref: RefObject<HTMLDivElement | null>) {
  const [more, setMore] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setMore(node.scrollLeft + node.clientWidth < node.scrollWidth - 1);
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(node);
    const mutate = new MutationObserver(measure);
    mutate.observe(node, { childList: true, subtree: true, characterData: true });
    node.addEventListener("scroll", measure, { passive: true });
    return () => {
      resize.disconnect();
      mutate.disconnect();
      node.removeEventListener("scroll", measure);
    };
  }, [ref]);

  return more;
}

/* Swaps the last-row message, keeping the outgoing one for its fade-out. */
function Swap({ id, children }: { id: string; children: ReactNode }) {
  const latest = useRef<{ id: string; node: ReactNode }>({ id, node: children });
  const [shownId, setShownId] = useState(id);
  const [outgoing, setOutgoing] = useState<{ id: string; node: ReactNode } | null>(null);

  if (shownId !== id) {
    setShownId(id);
    setOutgoing(latest.current);
  }
  latest.current = { id, node: children };

  useEffect(() => {
    if (!outgoing) return;
    const timer = window.setTimeout(() => setOutgoing(null), 260);
    return () => window.clearTimeout(timer);
  }, [outgoing]);

  return (
    <span className="ui-mpc__swap">
      {outgoing && (
        <span key={`out-${outgoing.id}`} className="ui-mpc__swap-item" data-out="" aria-hidden="true">
          {outgoing.node}
        </span>
      )}
      <span key={id} className="ui-mpc__swap-item">
        {children}
      </span>
    </span>
  );
}

const editGlyph = (
  <svg viewBox="0 0 16 16" className="ui-mpc__glyph" aria-hidden="true">
    <path d="M9.8 3.7l2.5 2.5M3 13l.6-3 6.9-6.9a1.4 1.4 0 0 1 2 0l.4.4a1.4 1.4 0 0 1 0 2L6 12.4 3 13Z" fillRule="evenodd" />
  </svg>
);

const pauseGlyph = (
  <svg viewBox="0 0 16 16" className="ui-mpc__glyph" data-solid="true" aria-hidden="true">
    <path
      d="M4.5 3.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-9Zm4 0a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-9Z"
      fillRule="evenodd"
    />
  </svg>
);

const playGlyph = (
  <svg viewBox="0 0 16 16" className="ui-mpc__glyph" data-solid="true" aria-hidden="true">
    <path d="M4.5 3.4v9.2a.9.9 0 0 0 1.37.77l7.4-4.6a.9.9 0 0 0 0-1.54l-7.4-4.6a.9.9 0 0 0-1.37.77Z" fillRule="evenodd" />
  </svg>
);

const forgetGlyph = (
  <svg viewBox="0 0 16 16" className="ui-mpc__glyph" aria-hidden="true">
    <path
      d="M2.5 4.5h11M6.5 4.5V3.2a.7.7 0 0 1 .7-.7h1.6a.7.7 0 0 1 .7.7v1.3M4 4.5l.6 8a1.1 1.1 0 0 0 1.1 1h4.6a1.1 1.1 0 0 0 1.1-1l.6-8M6.8 7.2v3.6M9.2 7.2v3.6"
      fillRule="evenodd"
    />
  </svg>
);

const undoGlyph = (
  <svg viewBox="0 0 16 16" className="ui-mpc__glyph" aria-hidden="true">
    <path d="M5.5 3.5 3 6l2.5 2.5M3.2 6h6.3a3.5 3.5 0 0 1 0 7H7" fillRule="evenodd" />
  </svg>
);

const addGlyph = (
  <svg viewBox="0 0 16 16" className="ui-mpc__glyph" aria-hidden="true">
    <path d="M8 3.5v9M3.5 8h9" fillRule="evenodd" />
  </svg>
);

const searchGlyph = (
  <svg viewBox="0 0 16 16" className="ui-mpc__glyph" aria-hidden="true">
    <path d="M7.2 11.9a4.7 4.7 0 1 0 0-9.4 4.7 4.7 0 0 0 0 9.4ZM10.6 10.6l2.9 2.9" fillRule="evenodd" />
  </svg>
);

const closeGlyph = (
  <svg viewBox="0 0 16 16" className="ui-mpc__glyph" aria-hidden="true">
    <path d="m4.5 4.5 7 7m0-7-7 7" fillRule="evenodd" />
  </svg>
);

const infoGlyph = (
  <svg viewBox="0 0 16 16" className="ui-mpc__glyph" data-solid="true" aria-hidden="true">
    <path
      d="M8 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm0 5.4a.6.6 0 0 0-.6.6v3.6a.6.6 0 0 0 1.2 0V7.5a.6.6 0 0 0-.6-.6Zm0-2.3a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6Z"
      fillRule="evenodd"
    />
  </svg>
);

const arrowGlyph = (
  <svg viewBox="0 0 16 16" className="ui-mpc__glyph" aria-hidden="true">
    <path d="M3.5 8h9M9 4.5 12.5 8 9 11.5" fillRule="evenodd" />
  </svg>
);

export function MemoryPanel({
  memories,
  onChange,
  onAdd,
  onEdit,
  onPause,
  onForget,
  onUndo,
  enabled,
  defaultEnabled = true,
  onEnabledChange,
  categories,
  title = "Memory",
  maxHeight = 360,
  undoFor = 5000,
  addedSource = "You added",
  action,
  className,
}: MemoryPanelProps) {
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const catsRef = useRef<HTMLDivElement>(null);
  const chipsOverflow = useOverflow(chipsRef);
  const catsOverflow = useOverflow(catsRef);

  const [stored, setStored] = useState<Memory[]>(memories);
  const items = onChange ? memories : stored;
  const latestItems = useRef<Memory[]>(items);
  latestItems.current = items;

  const commit = (next: Memory[]) => {
    latestItems.current = next;
    if (!onChange) setStored(next);
    onChange?.(next);
  };

  const [innerEnabled, setInnerEnabled] = useState(defaultEnabled);
  const memoryOn = enabled ?? innerEnabled;
  const flipEnabled = (next: boolean) => {
    setInnerEnabled(next);
    onEnabledChange?.(next);
  };

  const [leaving, setLeaving] = useState<Flags>({});
  const [entering, setEntering] = useState<Flags>({});
  const [filter, setFilter] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [hotId, setHotId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [forgotten, setForgotten] = useState<Forgotten | null>(null);
  const scrollTarget = useRef<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /* Rows that just came back or were just added unfold on the next paint. */
  useEffect(() => {
    if (!Object.keys(entering).length) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setEntering({}));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [entering]);

  /* Bring a restored or added memory into view without moving the whole page. */
  useEffect(() => {
    if (Object.keys(entering).length || !scrollTarget.current) return;
    const id = scrollTarget.current;
    scrollTarget.current = null;
    const timer = window.setTimeout(() => {
      const list = listRef.current;
      const node = list?.querySelector<HTMLElement>(`[data-memory="${CSS.escape(id)}"]`);
      if (!list || !node) return;
      const top = node.offsetTop - list.offsetTop;
      if (top < list.scrollTop || top + node.offsetHeight > list.scrollTop + list.clientHeight) {
        list.scrollTo({ top: top - 8, behavior: reducedMotion() ? "auto" : "smooth" });
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [entering]);

  useEffect(() => {
    if (!forgotten) return;
    const timer = window.setTimeout(() => setForgotten(null), undoFor);
    return () => window.clearTimeout(timer);
  }, [forgotten, undoFor]);

  const groups = [...(categories ?? [])];
  for (const memory of items) if (!groups.includes(memory.category)) groups.push(memory.category);

  const present = items.filter((memory) => !leaving[memory.id]);
  const pausedCount = present.filter((memory) => memory.paused).length;
  const needle = query.trim().toLowerCase();

  const matches = (memory: Memory) =>
    (!filter || memory.category === filter) &&
    (!needle || memory.text.toLowerCase().includes(needle) || memory.category.toLowerCase().includes(needle));

  const isShown = (memory: Memory) => matches(memory) && !leaving[memory.id] && !entering[memory.id];

  const anyVisible = items.some((memory) => matches(memory) && !leaving[memory.id]);
  const hot = items.find((memory) => memory.id === hotId) ?? null;
  const shownCounts = useCountsTween({ total: present.length, paused: pausedCount }, 520);
  const count = Math.round(shownCounts.total ?? present.length);
  const shownPaused = Math.round(shownCounts.paused ?? pausedCount);

  const forget = async (memory: Memory) => {
    if (leaving[memory.id]) return;
    if (editId === memory.id) setEditId(null);
    setHotId(null);
    setLeaving((current) => ({ ...current, [memory.id]: true }));
    if (!reducedMotion()) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 320));
    }
    if (!mounted.current) return;
    const index = latestItems.current.findIndex((entry) => entry.id === memory.id);
    commit(latestItems.current.filter((entry) => entry.id !== memory.id));
    onForget?.(memory.id);
    setLeaving((current) => {
      const next = { ...current };
      delete next[memory.id];
      return next;
    });
    setForgotten({ memory, index, key: Date.now() });
  };

  const undo = () => {
    if (!forgotten) return;
    const { memory, index } = forgotten;
    const next = [...latestItems.current];
    next.splice(Math.max(0, Math.min(index, next.length)), 0, memory);
    setEntering((current) => ({ ...current, [memory.id]: true }));
    scrollTarget.current = memory.id;
    if (filter && filter !== memory.category) setFilter(null);
    commit(next);
    onUndo?.(memory);
    setForgotten(null);
  };

  const togglePause = (memory: Memory) => {
    commit(
      latestItems.current.map((entry) =>
        entry.id === memory.id ? { ...entry, paused: !entry.paused } : entry,
      ),
    );
    onPause?.(memory.id, !memory.paused);
  };

  const startEdit = (memory: Memory) => {
    setAdding(false);
    setDraft(memory.text);
    setEditId(memory.id);
  };

  const focusEditButton = (id: string) => {
    window.requestAnimationFrame(() =>
      rootRef.current
        ?.querySelector<HTMLButtonElement>(`[data-memory="${CSS.escape(id)}"] [data-act="edit"]`)
        ?.focus({ preventScroll: true }),
    );
  };

  const saveEdit = () => {
    const id = editId;
    const text = draft.trim().replace(/\s+/g, " ");
    setEditId(null);
    if (!id) return;
    const current = latestItems.current.find((entry) => entry.id === id);
    if (current && text && text !== current.text) {
      commit(latestItems.current.map((entry) => (entry.id === id ? { ...entry, text } : entry)));
      onEdit?.(id, text);
      focusEditButton(id);
    }
  };

  const cancelEdit = () => {
    const id = editId;
    setEditId(null);
    if (id) focusEditButton(id);
  };

  const chosenCategory = newCategory ?? filter ?? groups[0] ?? "General";

  const openNew = () => {
    setEditId(null);
    setNewText("");
    setNewCategory(filter ?? groups[0] ?? "General");
    setAdding(true);
  };

  const closeNew = () => {
    setAdding(false);
    window.requestAnimationFrame(() =>
      rootRef.current?.querySelector<HTMLButtonElement>(".ui-mpc__add")?.focus({ preventScroll: true }),
    );
  };

  const addMemory = () => {
    const text = newText.trim().replace(/\s+/g, " ");
    if (!text) return;
    const memory: Memory = {
      id: `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      text,
      category: chosenCategory,
      source: addedSource,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    };
    setEntering((current) => ({ ...current, [memory.id]: true }));
    scrollTarget.current = memory.id;
    if (filter && filter !== memory.category) setFilter(null);
    if (needle) setQuery("");
    commit([...latestItems.current, memory]);
    onAdd?.(memory);
    setNewText("");
    closeNew();
  };

  const closeSearch = () => {
    setSearching(false);
    setQuery("");
    window.requestAnimationFrame(() =>
      rootRef.current?.querySelector<HTMLButtonElement>(".ui-mpc__search-open")?.focus({ preventScroll: true }),
    );
  };

  const chips: (string | null)[] = [null, ...groups];

  const onChipsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const at = chips.indexOf(filter);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? chips.length - 1
          : (at + (event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1) + chips.length) % chips.length;
    setFilter(chips[next] ?? null);
    const radios = event.currentTarget.querySelectorAll<HTMLElement>("[role='radio']");
    radios[next]?.focus();
    radios[next]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  let caption: ReactNode = (
    <>
      <b>{count}</b> {count === 1 ? "memory" : "memories"}
      {(shownPaused > 0 || pausedCount > 0) && (
        <>
          {" · "}
          {shownPaused} paused
        </>
      )}
    </>
  );
  let captionKey = "rest";

  if (forgotten) {
    caption = (
      <span className="ui-mpc__forgot">
        <span className="ui-mpc__flat">Forgot “</span>
        <b className="ui-mpc__quote">{forgotten.memory.text}</b>
        <span className="ui-mpc__flat">”</span>
      </span>
    );
    captionKey = `forgot-${forgotten.key}`;
  } else if (editId) {
    caption = "Enter to save · Esc to cancel";
    captionKey = "editing";
  } else if (adding) {
    caption = "Pick a category · Enter to save";
    captionKey = "adding";
  } else if (hot) {
    caption = (
      <>
        <b>{hot.category}</b>
        {" · "}
        {memoryOn ? (hot.paused ? "paused, not used in answers" : "used in answers") : "memory is off"}
      </>
    );
    captionKey = `hot-${hot.id}-${Number(!!hot.paused)}-${Number(!!memoryOn)}`;
  } else if (!memoryOn) {
    caption = "Memory is off";
    captionKey = "off";
  }

  return (
    <div
      ref={rootRef}
      className={["ui-mpc", className].filter(Boolean).join(" ")}
      role="group"
      aria-labelledby={`${uid}-title`}
      data-off={memoryOn ? undefined : ""}
      style={{ "--ui-mpc-max": `${maxHeight}px` } as CSSProperties}
    >
      <style href="ui-memory-panel-clean" precedence="default">
        {css}
      </style>

      <div className="ui-mpc__card">
        <div className="ui-mpc__head">
          <span id={`${uid}-title`} className="ui-mpc__title">
            {title}
          </span>
          <span className="ui-mpc__count" aria-hidden="true">
            {count}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={memoryOn}
            aria-controls={`${uid}-note`}
            className="ui-mpc__switch"
            onClick={() => flipEnabled(!memoryOn)}
          >
            <span className="ui-mpc__switch-label">Use memory</span>
            <span className="ui-mpc__track" aria-hidden="true">
              <span className="ui-mpc__knob" />
            </span>
          </button>
        </div>

        <div id={`${uid}-note`} className="ui-mpc__fold" data-open={memoryOn ? undefined : ""} inert={memoryOn}>
          <div className="ui-mpc__clip">
            <p className="ui-mpc__note">
              {infoGlyph}
              <span>The assistant won&apos;t use or save memories in new chats. Nothing here is deleted.</span>
            </p>
          </div>
        </div>

        <div className="ui-mpc__filters" data-searching={searching ? "" : undefined}>
          <div
            ref={chipsRef}
            className="ui-mpc__chips"
            data-more={chipsOverflow ? "" : undefined}
            role="radiogroup"
            aria-label="Category"
            inert={searching}
            onKeyDown={onChipsKeyDown}
          >
            {chips.map((category) => {
              const total = present.filter((memory) => !category || memory.category === category).length;
              const checked = filter === category;
              return (
                <button
                  key={category ?? "#all"}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={checked ? 0 : -1}
                  className="ui-mpc__chip"
                  data-linked={category && hot?.category === category ? "" : undefined}
                  onClick={() => setFilter(category)}
                >
                  {category ?? "All"}
                  <span className="ui-mpc__chip-count">{total}</span>
                </button>
              );
            })}
          </div>

          <div className="ui-mpc__search" inert={!searching}>
            {searchGlyph}
            <input
              className="ui-mpc__input"
              type="text"
              value={query}
              placeholder="Search memories"
              aria-label="Search memories"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation();
                  closeSearch();
                }
              }}
              ref={(node) => {
                if (!node) return;
                if (searching && document.activeElement !== node && !node.dataset.focused) {
                  node.dataset.focused = "1";
                  node.focus({ preventScroll: true });
                }
                if (!searching) delete node.dataset.focused;
              }}
            />
            <button type="button" className="ui-mpc__icon" aria-label="Close search" onClick={closeSearch}>
              {closeGlyph}
            </button>
          </div>

          <button
            type="button"
            className="ui-mpc__icon ui-mpc__search-open"
            aria-label="Search memories"
            aria-expanded={searching}
            inert={searching}
            onClick={() => {
              setFilter(null);
              setSearching(true);
            }}
          >
            {searchGlyph}
          </button>
        </div>

        <div ref={listRef} className="ui-mpc__list" onPointerLeave={() => setHotId(null)}>
          {groups.map((category) => {
            const group = items.filter((memory) => memory.category === category);
            if (!group.length) return null;
            const open = group.some((memory) => matches(memory) && !leaving[memory.id]);
            return (
              <section
                key={category}
                className="ui-mpc__fold"
                data-open={open ? "" : undefined}
                inert={!open}
                aria-label={category}
              >
                <div className="ui-mpc__clip">
                  <h3 className="ui-mpc__group">{category}</h3>
                  <ul className="ui-mpc__items">
                    {group.map((memory) => {
                      const editing = editId === memory.id;
                      const open = isShown(memory);
                      return (
                        <li
                          key={memory.id}
                          className="ui-mpc__fold ui-mpc__fold--row"
                          data-open={open ? "" : undefined}
                          data-leaving={leaving[memory.id] ? "" : undefined}
                          inert={!open}
                        >
                          <div className="ui-mpc__clip">
                            <div
                              className="ui-mpc__item"
                              data-memory={memory.id}
                              data-paused={memory.paused ? "" : undefined}
                              data-hot={hotId === memory.id ? "" : undefined}
                              data-editing={editing ? "" : undefined}
                              onPointerEnter={(event) => {
                                if (event.pointerType === "mouse") setHotId(memory.id);
                              }}
                              onFocus={() => setHotId(memory.id)}
                              onBlur={(event: FocusEvent<HTMLDivElement>) => {
                                if (!event.currentTarget.contains(event.relatedTarget)) setHotId(null);
                              }}
                            >
                              {editing ? (
                                <textarea
                                  className="ui-mpc__edit"
                                  value={draft}
                                  rows={1}
                                  aria-label="Edit memory"
                                  ref={(node) => {
                                    autosize(node);
                                    if (node && !node.dataset.focused) {
                                      node.dataset.focused = "1";
                                      node.focus({ preventScroll: true });
                                      node.setSelectionRange(node.value.length, node.value.length);
                                    }
                                  }}
                                  onChange={(event) => {
                                    setDraft(event.target.value);
                                    autosize(event.target);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" && !event.shiftKey) {
                                      event.preventDefault();
                                      saveEdit();
                                    } else if (event.key === "Escape") {
                                      event.stopPropagation();
                                      cancelEdit();
                                    }
                                  }}
                                />
                              ) : (
                                <p className="ui-mpc__text">{memory.text}</p>
                              )}

                              <div className="ui-mpc__meta">
                                <span className="ui-mpc__source">
                                  {memory.source}
                                  {memory.source && memory.date && <span className="ui-mpc__dot"> · </span>}
                                  {memory.date}
                                </span>
                                <span
                                  className="ui-mpc__tag"
                                  data-on={memory.paused ? "" : undefined}
                                  aria-hidden={!memory.paused}
                                >
                                  Paused
                                </span>

                                {editing ? (
                                  <span className="ui-mpc__acts ui-mpc__acts--edit">
                                    <button type="button" className="ui-mpc__text-btn" onClick={cancelEdit}>
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      className="ui-mpc__text-btn ui-mpc__text-btn--main"
                                      onClick={saveEdit}
                                    >
                                      Save
                                    </button>
                                  </span>
                                ) : (
                                  <span className="ui-mpc__acts">
                                    <button
                                      type="button"
                                      className="ui-mpc__icon"
                                      data-act="edit"
                                      aria-label={`Edit “${memory.text}”`}
                                      title="Edit"
                                      onClick={() => startEdit(memory)}
                                    >
                                      {editGlyph}
                                    </button>
                                    <button
                                      type="button"
                                      className="ui-mpc__icon"
                                      data-act="pause"
                                      aria-label={`${memory.paused ? "Resume" : "Pause"} “${memory.text}”`}
                                      title={memory.paused ? "Resume" : "Pause"}
                                      onClick={() => togglePause(memory)}
                                    >
                                      <span key={memory.paused ? "play" : "pause"} className="ui-mpc__icon-swap">
                                        {memory.paused ? playGlyph : pauseGlyph}
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      className="ui-mpc__icon ui-mpc__icon--forget"
                                      data-act="forget"
                                      aria-label={`Forget “${memory.text}”`}
                                      title="Forget"
                                      onClick={() => void forget(memory)}
                                    >
                                      {forgetGlyph}
                                    </button>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            );
          })}

          <div className="ui-mpc__fold" data-open={anyVisible ? undefined : ""} inert={anyVisible}>
            <div className="ui-mpc__clip">
              <p className="ui-mpc__empty">
                {items.length === 0
                  ? "Nothing remembered yet"
                  : needle
                    ? `No memory mentions “${query.trim()}”`
                    : "No memories here"}
              </p>
            </div>
          </div>
        </div>

        <div className="ui-mpc__bottom">
          <div className="ui-mpc__fold" data-open={adding ? undefined : ""} inert={adding}>
            <div className="ui-mpc__clip">
              <button
                type="button"
                className="ui-mpc__add"
                aria-expanded={adding}
                aria-controls={`${uid}-new`}
                onClick={openNew}
              >
                {addGlyph}
                New memory
              </button>
            </div>
          </div>

          <div id={`${uid}-new`} className="ui-mpc__fold" data-open={adding ? "" : undefined} inert={!adding}>
            <div className="ui-mpc__clip">
              <div className="ui-mpc__new">
                <textarea
                  className="ui-mpc__edit ui-mpc__edit--new"
                  value={newText}
                  rows={1}
                  placeholder="Something the assistant should remember…"
                  aria-label="New memory"
                  ref={(node) => {
                    autosize(node);
                    if (node && adding && !node.dataset.focused) {
                      node.dataset.focused = "1";
                      node.focus({ preventScroll: true });
                    }
                    if (node && !adding) delete node.dataset.focused;
                  }}
                  onChange={(event) => {
                    setNewText(event.target.value);
                    autosize(event.target);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      addMemory();
                    } else if (event.key === "Escape") {
                      event.stopPropagation();
                      closeNew();
                    }
                  }}
                />
                <div className="ui-mpc__new-row">
                  <div
                    ref={catsRef}
                    className="ui-mpc__cats"
                    data-more={catsOverflow ? "" : undefined}
                    role="radiogroup"
                    aria-label="Category of the new memory"
                    onKeyDown={(event) => {
                      const options = groups.length ? groups : ["General"];
                      if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(event.key)) return;
                      event.preventDefault();
                      const at = options.indexOf(chosenCategory);
                      const next =
                        (at + (event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1) + options.length) %
                        options.length;
                      setNewCategory(options[next]);
                      event.currentTarget.querySelectorAll<HTMLElement>("[role='radio']")[next]?.focus();
                    }}
                  >
                    {(groups.length ? groups : ["General"]).map((category) => (
                      <button
                        key={category}
                        type="button"
                        role="radio"
                        aria-checked={chosenCategory === category}
                        tabIndex={chosenCategory === category ? 0 : -1}
                        className="ui-mpc__cat"
                        onClick={() => setNewCategory(category)}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                  <span className="ui-mpc__acts ui-mpc__acts--edit">
                    <button type="button" className="ui-mpc__text-btn" onClick={closeNew}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="ui-mpc__text-btn ui-mpc__text-btn--main"
                      disabled={!newText.trim()}
                      onClick={addMemory}
                    >
                      Save
                    </button>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="ui-mpc__foot">
          <span className="ui-mpc__caption" aria-live="polite">
            <Swap id={captionKey}>{caption}</Swap>
          </span>
          {forgotten ? (
            <button
              key={`undo-${forgotten.key}`}
              type="button"
              className="ui-mpc__action ui-mpc__action--undo"
              onClick={undo}
            >
              {undoGlyph}
              Undo
            </button>
          ) : action ? (
            <button key="action" type="button" className="ui-mpc__action" onClick={action.onClick}>
              {action.label}
              {arrowGlyph}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const css = /* css */ `
.ui-mpc{--ui-mpc-card: #fffdfb;--ui-mpc-ink: rgba(11, 9, 8, 0.88);--ui-mpc-strong: #0b0908;--ui-mpc-text: rgba(11, 9, 8, 0.61);--ui-mpc-muted: rgba(11, 9, 8, 0.45);--ui-mpc-faint: rgba(11, 9, 8, 0.27);--ui-mpc-icon: rgba(11, 9, 8, 0.447);--ui-mpc-line: rgba(11, 9, 8, 0.06);--ui-mpc-wash: rgba(11, 9, 8, 0.03);--ui-mpc-fill: rgba(11, 9, 8, 0.06);--ui-mpc-fill-strong: rgba(11, 9, 8, 0.1);--ui-mpc-accent: rgba(217, 84, 31, 0.765);--ui-mpc-focus: rgba(217, 84, 31, 0.35);--ui-mpc-red: #e2544a;--ui-mpc-red-soft: rgba(226, 84, 74, 0.08);--ui-mpc-amber: #9a6410;--ui-mpc-amber-soft: rgba(217, 149, 48, 0.12);--ui-mpc-solid: rgba(11, 9, 8, 0.88);--ui-mpc-on-solid: #fcf9f7;--ui-mpc-knob: #fffdfb;--ui-mpc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-mpc-ease: cubic-bezier(0.22, 1, 0.36, 1);box-sizing: border-box;width: 100%;max-width: 400px;min-width: 0;container-type: inline-size;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;font-weight: 400;color: var(--ui-mpc-ink);text-align: left;-webkit-font-smoothing: antialiased}
.ui-mpc *, .ui-mpc *::before, .ui-mpc *::after{box-sizing: border-box}
:where(.ui-mpc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;text-align: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
:where(.ui-mpc) :is(p, h3, ul){margin: 0;padding: 0;list-style: none;font: inherit}
.ui-mpc button:focus-visible{outline: 2px solid var(--ui-mpc-focus);outline-offset: 1px}
.ui-mpc :is(input, textarea):focus-visible{outline: none}
:where(.ui-mpc) svg{display: block;flex: none}
.ui-mpc b{font-weight: 500;color: var(--ui-mpc-ink)}
.ui-mpc__glyph{width: 16px;height: 16px;fill: none;stroke: currentColor;stroke-width: 1.1;stroke-linecap: round;stroke-linejoin: round}
.ui-mpc__glyph[data-solid]{fill: currentColor;stroke: none}
.ui-mpc__card{border-radius: 10px;background: var(--ui-mpc-card);box-shadow: var(--ui-mpc-shadow)}
.ui-mpc__fold{display: grid;grid-template-rows: 0fr;opacity: 0;transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-mpc-ease), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-mpc__fold[data-open]{grid-template-rows: 1fr;opacity: 1;transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-mpc-ease), opacity var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 80ms}
.ui-mpc__fold--row[data-leaving]{transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-mpc-ease), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), filter var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));filter: blur(2px)}
.ui-mpc__clip{min-height: 0;overflow: hidden}
.ui-mpc__head{display: flex;align-items: center;gap: 8px;padding: 12px 10px 0 16px}
.ui-mpc__title{min-width: 0;overflow: hidden;font-size: 15px;font-weight: 500;line-height: 24px;color: var(--ui-mpc-strong);white-space: nowrap;text-overflow: ellipsis}
.ui-mpc__count{flex: none;min-width: 20px;height: 18px;padding: 0 5px;border-radius: 5px;background: var(--ui-mpc-fill);font-size: 11px;font-weight: 500;line-height: 18px;text-align: center;color: var(--ui-mpc-text);font-variant-numeric: tabular-nums}
.ui-mpc__switch{display: inline-flex;flex: none;align-items: center;gap: 8px;height: 28px;margin-left: auto;padding: 0 6px 0 8px;border-radius: 6px;color: var(--ui-mpc-text);transition: background-color 90ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 90ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-mpc__switch:hover{background: var(--ui-mpc-wash);color: var(--ui-mpc-ink)}
.ui-mpc__track{position: relative;width: 26px;height: 16px;border-radius: 5px;background: var(--ui-mpc-fill-strong);transition: background-color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-mpc__knob{position: absolute;top: 2px;left: 2px;width: 12px;height: 12px;border-radius: 3.5px;background: var(--ui-mpc-knob);box-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 2px rgba(11, 9, 8, 0.16);transition: transform var(--nm-dur-3, 240ms) var(--ui-mpc-ease)}
.ui-mpc__switch[aria-checked="true"] .ui-mpc__track{background: var(--ui-mpc-accent)}
.ui-mpc__switch[aria-checked="true"] .ui-mpc__knob{transform: translateX(10px)}
.ui-mpc__note{display: flex;gap: 8px;margin: 10px 12px 0 16px !important;padding: 8px 10px;border-radius: 8px;background: var(--ui-mpc-wash);font-size: 12px !important;line-height: 16px !important;color: var(--ui-mpc-text)}
.ui-mpc__note .ui-mpc__glyph{color: var(--ui-mpc-icon)}
.ui-mpc__filters{position: relative;display: grid;grid-template-columns: minmax(0, 1fr) auto;align-items: center;gap: 8px;padding: 12px 10px 12px 16px;border-bottom: 0.5px solid var(--ui-mpc-line);transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-mpc__chips, .ui-mpc__search{grid-area: 1 / 1;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), filter var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-mpc__chips{display: flex;gap: 4px;min-width: 0;margin: -3px;padding: 3px;overflow-x: auto;scrollbar-width: none}
.ui-mpc__chips[data-more], .ui-mpc__cats[data-more]{-webkit-mask-image: linear-gradient(90deg, #0b0908 calc(100% - 24px), transparent);mask-image: linear-gradient(90deg, #0b0908 calc(100% - 24px), transparent)}
.ui-mpc__chips::-webkit-scrollbar{display: none}
.ui-mpc__chip{display: inline-flex;flex: none;align-items: center;gap: 6px;padding: 4px 10px;border-radius: 6px;box-shadow: inset 0 0 0 0.5px var(--ui-mpc-line);font-size: 13px;font-weight: 500;line-height: 20px;color: var(--ui-mpc-text);white-space: nowrap;transition: background-color 90ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 90ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-mpc__chip:hover{background: var(--ui-mpc-wash)}
.ui-mpc__chip[data-linked]{color: var(--ui-mpc-ink)}
.ui-mpc__chip[aria-checked="true"]{background: var(--ui-mpc-fill);color: var(--ui-mpc-ink)}
.ui-mpc__chip-count{font-size: 12px;font-weight: 400;color: var(--ui-mpc-muted);font-variant-numeric: tabular-nums}
.ui-mpc__chip[aria-checked="true"] .ui-mpc__chip-count{color: var(--ui-mpc-text)}
.ui-mpc__search{display: flex;align-items: center;gap: 6px;height: 28px;padding: 0 2px 0 8px;border-radius: 6px;box-shadow: inset 0 0 0 0.5px var(--ui-mpc-line);background: var(--ui-mpc-wash);color: var(--ui-mpc-icon);opacity: 0;visibility: hidden}
.ui-mpc__input{flex: 1;min-width: 0;height: 28px;margin: 0;padding: 0;border: 0;background: none;font: inherit;font-size: 13px;color: var(--ui-mpc-strong);caret-color: var(--ui-mpc-accent);outline: none}
.ui-mpc__input::placeholder{color: var(--ui-mpc-faint);opacity: 1}
.ui-mpc__search .ui-mpc__icon{width: 24px;height: 24px}
.ui-mpc__filters[data-searching] .ui-mpc__chips{opacity: 0;filter: blur(2px)}
.ui-mpc__filters[data-searching] .ui-mpc__search{grid-area: 1 / 1 / 2 / 3;opacity: 1;visibility: visible}
.ui-mpc__filters[data-searching] .ui-mpc__search-open{opacity: 0;visibility: hidden}
.ui-mpc__search-open{grid-area: 1 / 2;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color 90ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 90ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-mpc__list{max-height: var(--ui-mpc-max);padding: 2px 6px 6px;overflow-y: auto;overscroll-behavior: contain;scrollbar-width: thin;scrollbar-color: var(--ui-mpc-fill-strong) transparent;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-mpc[data-off] .ui-mpc__list, .ui-mpc[data-off] .ui-mpc__filters{opacity: 0.5}
.ui-mpc[data-off] .ui-mpc__list:hover, .ui-mpc[data-off] .ui-mpc__list:focus-within{opacity: 0.85}
.ui-mpc__group{padding: 12px 10px 4px;font-size: 10px !important;font-weight: 500 !important;line-height: 16px !important;letter-spacing: 0.5px;text-transform: uppercase;color: var(--ui-mpc-muted)}
.ui-mpc__item{padding: 8px 10px 7px;border-radius: 8px;transition: background-color 90ms ease-out, opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-mpc__item[data-hot], .ui-mpc__item[data-editing]{background: var(--ui-mpc-wash)}
.ui-mpc__text{color: var(--ui-mpc-ink);overflow-wrap: anywhere;transition: color 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-mpc__item[data-paused] .ui-mpc__text{color: var(--ui-mpc-muted)}
.ui-mpc__meta{display: flex;align-items: center;gap: 6px;min-height: 20px;margin-top: 2px;font-size: 12px;line-height: 16px;color: var(--ui-mpc-muted)}
.ui-mpc__source{min-width: 0;overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-mpc__dot{color: var(--ui-mpc-faint)}
.ui-mpc__tag{display: inline-flex;flex: none;align-items: center;height: 18px;padding: 0 6px;border-radius: 5px;background: var(--ui-mpc-amber-soft);font-size: 11px;font-weight: 500;line-height: 16px;color: var(--ui-mpc-amber);opacity: 0;transform: scale(0.9);transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-3, 240ms) var(--ui-mpc-ease)}
.ui-mpc__tag:not([data-on]){position: absolute;visibility: hidden}
.ui-mpc__tag[data-on]{opacity: 1;transform: none;animation: ui-mpc-in var(--nm-dur-3, 240ms) var(--ui-mpc-ease) both}
.ui-mpc__acts{display: inline-flex;flex: none;align-items: center;gap: 2px;margin: -4px -6px -4px auto;opacity: 0;transition: opacity var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-mpc__item:is([data-hot], :focus-within) .ui-mpc__acts, .ui-mpc__acts--edit{opacity: 1}
.ui-mpc__acts--edit{gap: 4px;margin-top: 4px;margin-right: -2px;margin-bottom: 0}
.ui-mpc__item[data-editing]{padding-bottom: 8px}
.ui-mpc__icon{display: grid;flex: none;place-items: center;width: 28px;height: 28px;border-radius: 6px;color: var(--ui-mpc-icon);transition: background-color 90ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 90ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-mpc__icon:hover{background: var(--ui-mpc-wash);color: var(--ui-mpc-ink)}
.ui-mpc__item .ui-mpc__icon:hover{background: var(--ui-mpc-fill)}
.ui-mpc__item .ui-mpc__icon--forget:hover{background: var(--ui-mpc-red-soft);color: var(--ui-mpc-red)}
.ui-mpc__icon-swap{display: grid;animation: ui-mpc-in var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-mpc__text-btn{display: inline-flex;flex: none;align-items: center;height: 28px;padding: 0 10px;border-radius: 6px;font-size: 13px;font-weight: 500;line-height: 20px;color: var(--ui-mpc-text);white-space: nowrap;transition: background-color 90ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 90ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-mpc__text-btn:hover{background: var(--ui-mpc-fill);color: var(--ui-mpc-ink)}
.ui-mpc__text-btn--main, .ui-mpc__text-btn--main:hover{background: var(--ui-mpc-solid);color: var(--ui-mpc-on-solid)}
.ui-mpc__text-btn--main:hover{opacity: 0.88}
.ui-mpc__text-btn:disabled{cursor: default;opacity: 0.3}
.ui-mpc__edit{display: block;width: 100%;min-height: 20px;margin: 0;padding: 0;border: 0;background: none;font: inherit;color: var(--ui-mpc-strong);caret-color: var(--ui-mpc-accent);resize: none;overflow: hidden;outline: none}
.ui-mpc__edit::placeholder{color: var(--ui-mpc-faint);opacity: 1}
.ui-mpc__empty{padding: 20px 8px 14px;font-size: 13px;text-align: center;color: var(--ui-mpc-muted)}
.ui-mpc__bottom{padding: 6px;border-top: 0.5px solid var(--ui-mpc-line)}
.ui-mpc__add{display: flex;align-items: center;gap: 8px;width: 100%;height: 32px;padding: 0 10px;border-radius: 6px;color: var(--ui-mpc-text);transition: background-color 90ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 90ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-mpc__add .ui-mpc__glyph{color: var(--ui-mpc-icon);transition: color 90ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-mpc__add:hover{background: var(--ui-mpc-wash);color: var(--ui-mpc-ink)}
.ui-mpc__add:hover .ui-mpc__glyph{color: var(--ui-mpc-ink)}
.ui-mpc__new{padding: 6px 4px 2px 10px}
.ui-mpc__new-row{display: flex;align-items: center;gap: 8px;margin-top: 10px}
.ui-mpc__cats{display: flex;flex: 1 1 auto;gap: 4px;min-width: 0;margin: -3px;padding: 3px;overflow-x: auto;scrollbar-width: none}
.ui-mpc__cats::-webkit-scrollbar{display: none}
.ui-mpc__cat{display: inline-flex;flex: none;align-items: center;padding: 4px 8px;border-radius: 6px;box-shadow: inset 0 0 0 0.5px var(--ui-mpc-line);font-size: 12px;font-weight: 500;line-height: 20px;color: var(--ui-mpc-text);white-space: nowrap;transition: background-color 90ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 90ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-mpc__cat:hover{background: var(--ui-mpc-wash)}
.ui-mpc__cat[aria-checked="true"]{background: var(--ui-mpc-fill);color: var(--ui-mpc-ink)}
.ui-mpc__new .ui-mpc__acts--edit{margin: 0}
.ui-mpc__foot{display: flex;align-items: center;gap: 8px;min-height: 44px;padding: 0 8px 0 16px;border-top: 0.5px solid var(--ui-mpc-line)}
.ui-mpc__caption{flex: 1;min-width: 0;overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-mpc-muted);white-space: nowrap;font-variant-numeric: tabular-nums}
.ui-mpc__swap{display: grid;min-width: 0}
.ui-mpc__swap-item{grid-area: 1 / 1;min-width: 0;overflow: hidden;text-overflow: ellipsis;animation: ui-mpc-swap-in var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-mpc__swap-item[data-out]{animation: ui-mpc-swap-out var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-mpc__forgot{display: flex;min-width: 0}
.ui-mpc__flat{flex: none;white-space: pre}
.ui-mpc__quote{min-width: 0;overflow: hidden;text-overflow: ellipsis}
.ui-mpc__action{display: inline-flex;flex: none;align-items: center;gap: 4px;height: 28px;padding: 0 6px 0 10px;border-radius: 6px;font-size: 13px;font-weight: 500;line-height: 20px;color: var(--ui-mpc-text);white-space: nowrap;animation: ui-mpc-swap-in var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both;transition: background-color 90ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 90ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-mpc__action .ui-mpc__glyph{color: var(--ui-mpc-icon);transition: transform var(--nm-dur-3, 240ms) var(--ui-mpc-ease), color 90ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-mpc__action:hover{background: var(--ui-mpc-wash);color: var(--ui-mpc-ink)}
.ui-mpc__action:not(.ui-mpc__action--undo):hover .ui-mpc__glyph{transform: translateX(2px);color: var(--ui-mpc-ink)}
.ui-mpc__action--undo{gap: 6px;padding: 0 10px 0 8px;background: var(--ui-mpc-card);box-shadow: var(--ui-mpc-shadow);color: var(--ui-mpc-strong)}
.ui-mpc__action--undo:hover{background: #faf7f4;color: var(--ui-mpc-strong)}
@keyframes ui-mpc-in{from{opacity: 0;transform: scale(0.9)}
}
@keyframes ui-mpc-swap-in{from{opacity: 0;filter: blur(2px)}
}
@keyframes ui-mpc-swap-out{from{opacity: 1}
to{opacity: 0;filter: blur(2px)}
}
@container (max-width: 360px){.ui-mpc__chip-count{display: none}
.ui-mpc__head{padding-left: 14px}
.ui-mpc__filters{padding-left: 14px}
.ui-mpc__foot{padding-left: 14px}
.ui-mpc__note{margin-left: 14px !important}
}
@container (max-width: 320px){.ui-mpc__switch-label{display: none}
.ui-mpc__switch{padding: 0 6px}
.ui-mpc__chip{padding: 4px 8px}
}
@media (pointer: coarse){.ui-mpc__acts{opacity: 1}
.ui-mpc__icon{width: 34px;height: 34px}
.ui-mpc__acts{margin-top: -7px;margin-bottom: -7px}
.ui-mpc__acts--edit{margin-top: 4px;margin-bottom: 0}
.ui-mpc__chip{padding: 6px 12px}
.ui-mpc__cat{padding: 5px 10px}
.ui-mpc__text-btn, .ui-mpc__action{height: 34px}
.ui-mpc__switch, .ui-mpc__add{height: 36px}
.ui-mpc__search, .ui-mpc__input{height: 34px}
.ui-mpc__foot{min-height: 52px}
}
@media (prefers-reduced-motion: reduce){.ui-mpc *, .ui-mpc *::before, .ui-mpc *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-mpc{--ui-mpc-card: #211b16;--ui-mpc-ink: rgba(255, 253, 251, 0.9);--ui-mpc-strong: #fffdfb;--ui-mpc-text: rgba(255, 253, 251, 0.62);--ui-mpc-muted: rgba(255, 253, 251, 0.46);--ui-mpc-faint: rgba(255, 253, 251, 0.3);--ui-mpc-icon: rgba(255, 253, 251, 0.5);--ui-mpc-line: rgba(255, 253, 251, 0.08);--ui-mpc-wash: rgba(255, 253, 251, 0.04);--ui-mpc-fill: rgba(255, 253, 251, 0.08);--ui-mpc-fill-strong: rgba(255, 253, 251, 0.14);--ui-mpc-accent: #ff8a5c;--ui-mpc-focus: rgba(255, 138, 92, 0.5);--ui-mpc-red: #f0938c;--ui-mpc-red-soft: rgba(226, 84, 74, 0.14);--ui-mpc-amber: #e8b05c;--ui-mpc-amber-soft: rgba(217, 149, 48, 0.14);--ui-mpc-solid: rgba(255, 253, 251, 0.9);--ui-mpc-on-solid: #211b16;--ui-mpc-knob: #fffdfb;--ui-mpc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4)}
:where(.dark, [data-theme="dark"]) .ui-mpc__action--undo:hover{background: #27201a}
:where(.dark, [data-theme="dark"]) .ui-mpc__switch[aria-checked="false"] .ui-mpc__knob{background: rgba(255, 253, 251, 0.55)}

`;
