"use client";

import {
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

/*
 * Toaster – toasts you can raise from anywhere, in a single self-contained file.
 *
 * <Toaster /> is the provider. It renders the host app as children, owns the stack and the
 * timers, and stays a fragment itself: the fixed shell lives on the stack element only, so a
 * host page never gets pinned to a viewport corner. toast() and useToast() push into a
 * module-level store, so no context has to be threaded through the app.
 *
 * The newest toast lands in front; older cards tuck in behind by 10px at 0.95 scale and fan
 * out into a full stack on hover or focus, which also freezes their timers. A promise toast
 * morphs in place — the ring spins, then collapses into a drawn check or cross while the copy
 * crossfades. A card can be swiped away; a short swipe springs back.
 */

export type ToastKind = "default" | "success" | "error" | "info" | "loading";

export type ToastPosition = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";

export type ToastActionEvent = { preventDefault: () => void };

export type ToastAction = {
  label: ReactNode;
  /** Runs the action and closes the toast unless the handler calls preventDefault() */
  onClick: (event: ToastActionEvent) => void;
};

export type ToastOptions = {
  /** Pass the id of a live toast to morph it in place instead of stacking a new one */
  id?: string;
  description?: ReactNode;
  action?: ToastAction;
  /** Time on screen in ms – Infinity keeps the toast open until it is dismissed */
  duration?: number;
  /** Replaces the status glyph with your own node, sized to 16 × 16 */
  icon?: ReactNode;
  onDismiss?: (id: string) => void;
};

/** A line of copy, or a title and a description */
export type ToastMessage = ReactNode | { title?: ReactNode; description?: ReactNode };

export type PromiseMessages<T> = {
  loading: ToastMessage;
  success: ToastMessage | ((value: T) => ToastMessage);
  error: ToastMessage | ((error: unknown) => ToastMessage);
};

export type ToastApi = {
  (title: ReactNode, options?: ToastOptions): string;
  success: (title: ReactNode, options?: ToastOptions) => string;
  error: (title: ReactNode, options?: ToastOptions) => string;
  info: (title: ReactNode, options?: ToastOptions) => string;
  loading: (title: ReactNode, options?: ToastOptions) => string;
  /** Shows the loading message, then morphs the same toast into success or error */
  promise: <T,>(
    input: Promise<T> | (() => Promise<T>),
    messages: PromiseMessages<T>,
    options?: ToastOptions,
  ) => Promise<T>;
  /** One id closes that toast, no id closes the whole stack */
  dismiss: (id?: string) => void;
};

export type ToasterProps = {
  /** Corner or edge the stack sits in; cards enter and leave through that edge */
  position?: ToastPosition;
  /** Anchors the stack to the nearest positioned ancestor instead of the viewport */
  inline?: boolean;
  /** Default time on screen in ms – a toast can override it */
  duration?: number;
  /** Cards kept at once; older ones drop off the back */
  visibleToasts?: number;
  /** Keeps the stack fanned out instead of waiting for hover or focus */
  expand?: boolean;
  /** Distance from the edges in px – leave it out to use the stylesheet's 24px, or 20px inline */
  offset?: number;
  /** Space between cards when the stack is fanned out, in px */
  gap?: number;
  /** Key or code that moves focus to the newest toast – null turns it off */
  hotkey?: string | null;
  /** Small dismiss button that appears on hover and focus, always visible on touch */
  closeButton?: boolean;
  /** Name of the region for screen readers; the hotkey is appended */
  label?: string;
  /** Extra class on the stack element */
  className?: string;
  /** The host app – rendered untouched, never wrapped in the fixed shell */
  children?: ReactNode;
};

/* ── Store ─────────────────────────────────────────────────────────────── */

type ToastRecord = {
  id: string;
  kind: ToastKind;
  title: ReactNode;
  description?: ReactNode;
  action?: ToastAction;
  icon?: ReactNode;
  duration: number;
  /** Bumped on every in-place update, so the copy and the timer can replay their animations */
  version: number;
  closing: boolean;
  /** The copy this toast showed before its last update, for the crossfade */
  previous?: { title: ReactNode; description?: ReactNode };
  onDismiss?: (id: string) => void;
};

/** Inline custom properties – React allows them at runtime, the CSSProperties type does not */
type Vars = CSSProperties & { [key: `--${string}`]: string | number };

const DEFAULT_DURATION = 9000;
/** How far each card behind the front one peeks out while the stack is folded */
const PEEK = 10;

const records: ToastRecord[] = [];
const listeners = new Set<() => void>();
let snapshot: ToastRecord[] = [];
const EMPTY: ToastRecord[] = [];
let sequence = 0;

type TimerEntry = { handle: number; deadline: number; remaining: number };
const timers = new Map<string, TimerEntry>();
let paused = false;
let config = { visibleToasts: 3, duration: DEFAULT_DURATION };

function emit() {
  snapshot = records.slice();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const readSnapshot = () => snapshot;
const readServerSnapshot = () => EMPTY;

function findRecord(id: string) {
  return records.find((record) => record.id === id);
}

function clearTimer(id: string) {
  const entry = timers.get(id);
  if (!entry) return;
  if (entry.handle) window.clearTimeout(entry.handle);
  timers.delete(id);
}

/** Starts, pauses or resumes the countdown of every toast, so only the front few run */
function syncTimers() {
  if (typeof window === "undefined") return;
  const live = records
    .filter((record) => !record.closing)
    .slice(-Math.max(1, config.visibleToasts))
    .map((record) => record.id);
  records.forEach((record) => {
    const entry = timers.get(record.id);
    const running = !paused && !record.closing && live.includes(record.id) && Number.isFinite(record.duration);
    if (running) {
      if (entry?.handle) return;
      const next = entry ?? { handle: 0, deadline: 0, remaining: record.duration };
      timers.set(record.id, next);
      next.deadline = performance.now() + next.remaining;
      next.handle = window.setTimeout(() => {
        next.handle = 0;
        timers.delete(record.id);
        dismissRecord(record.id);
      }, next.remaining);
      return;
    }
    if (entry?.handle) {
      window.clearTimeout(entry.handle);
      entry.remaining = Math.max(0, entry.remaining - (performance.now() - entry.deadline));
      entry.handle = 0;
    }
  });
  timers.forEach((entry, id) => {
    if (!records.some((record) => record.id === id)) {
      if (entry.handle) window.clearTimeout(entry.handle);
      timers.delete(id);
    }
  });
}

function setPaused(next: boolean) {
  if (paused === next) return;
  paused = next;
  syncTimers();
}

/** Records kept beyond the visible window, so fanning out never resurrects a stale queue */
const RETAINED = 20;

function dismiss(id?: string) {
  if (id === undefined) {
    records.forEach((record) => dismissRecord(record.id));
    return;
  }
  dismissRecord(id);
}

function dismissRecord(id: string) {
  const record = findRecord(id);
  if (!record || record.closing) return;
  record.closing = true;
  clearTimer(id);
  emit();
  // Long enough for the 380ms height and transform transitions to land
  window.setTimeout(() => {
    // A toast pushed back in with the same id during the exit stays put
    const index = records.findIndex((entry) => entry.id === id && entry.closing);
    if (index < 0) return;
    const [removed] = records.splice(index, 1);
    removed.onDismiss?.(id);
    emit();
    syncTimers();
  }, 400);
}

function push(kind: ToastKind, title: ReactNode, options: ToastOptions = {}): string {
  const id = options.id ?? `toast-${++sequence}`;
  const duration = options.duration ?? config.duration;
  const existing = findRecord(id);
  if (existing) {
    existing.previous = { title: existing.title, description: existing.description };
    existing.kind = kind;
    existing.title = title;
    existing.description = options.description;
    existing.action = options.action;
    existing.icon = options.icon;
    existing.duration = duration;
    existing.onDismiss = options.onDismiss ?? existing.onDismiss;
    existing.closing = false;
    existing.version += 1;
    clearTimer(id);
    if (Number.isFinite(duration)) timers.set(id, { handle: 0, deadline: 0, remaining: duration });
    emit();
    syncTimers();
    return id;
  }
  records.push({
    id,
    kind,
    title,
    description: options.description,
    action: options.action,
    icon: options.icon,
    duration,
    version: 0,
    closing: false,
    onDismiss: options.onDismiss,
  });
  if (Number.isFinite(duration)) timers.set(id, { handle: 0, deadline: 0, remaining: duration });
  while (records.length > config.visibleToasts + RETAINED) {
    const [dropped] = records.splice(0, 1);
    clearTimer(dropped.id);
    dropped.onDismiss?.(dropped.id);
  }
  emit();
  syncTimers();
  return id;
}

type MessageObject = { title?: ReactNode; description?: ReactNode };

const isMessageObject = (value: unknown): value is MessageObject =>
  typeof value === "object" &&
  value !== null &&
  !isValidElement(value) &&
  !Array.isArray(value) &&
  ("title" in value || "description" in value);

function readMessage(message: ToastMessage): { title: ReactNode; description?: ReactNode } {
  if (isMessageObject(message)) return { title: message.title ?? "", description: message.description };
  return { title: message };
}

export const toast: ToastApi = Object.assign(
  (title: ReactNode, options?: ToastOptions) => push("default", title, options),
  {
    success: (title: ReactNode, options?: ToastOptions) => push("success", title, options),
    error: (title: ReactNode, options?: ToastOptions) => push("error", title, options),
    info: (title: ReactNode, options?: ToastOptions) => push("info", title, options),
    loading: (title: ReactNode, options?: ToastOptions) => push("loading", title, { duration: Infinity, ...options }),
    dismiss: (id?: string) => dismiss(id),
    promise: <T,>(
      input: Promise<T> | (() => Promise<T>),
      messages: PromiseMessages<T>,
      options?: ToastOptions,
    ): Promise<T> => {
      const id = options?.id ?? `toast-${++sequence}`;
      const loading = readMessage(messages.loading);
      push("loading", loading.title, { ...options, id, description: loading.description, duration: Infinity });
      const run = typeof input === "function" ? input() : input;
      run.then(
        (value) => {
          const message = readMessage(typeof messages.success === "function" ? messages.success(value) : messages.success);
          push("success", message.title, {
            ...options,
            id,
            description: message.description,
            duration: options?.duration ?? config.duration,
          });
        },
        (error: unknown) => {
          const message = readMessage(typeof messages.error === "function" ? messages.error(error) : messages.error);
          push("error", message.title, {
            ...options,
            id,
            description: message.description,
            duration: options?.duration ?? config.duration,
          });
        },
      );
      return run;
    },
  },
);

/** The same store from anywhere in the tree – the provider only has to exist once */
export function useToast(): { toast: ToastApi; dismiss: (id?: string) => void } {
  return { toast, dismiss: toast.dismiss };
}

/* ── Icons ─────────────────────────────────────────────────────────────── */

/** One glyph for every state: a faint ring, a spinning arc, a check, a cross, an info dot */
const StatusGlyph = () => (
  <svg viewBox="0 0 24 24" className="ui-tsc__status" aria-hidden="true">
    <g className="ui-tsc__spin">
      <circle className="ui-tsc__ring" cx="12" cy="12" r="9.25" pathLength={1} />
    </g>
    <path className="ui-tsc__mark ui-tsc__check" d="M8.3 12.4l2.5 2.5 4.9-5.3" pathLength={1} />
    <path className="ui-tsc__mark ui-tsc__x1" d="M9.5 9.5l5 5" pathLength={1} />
    <path className="ui-tsc__mark ui-tsc__x2" d="M14.5 9.5l-5 5" pathLength={1} />
    <path className="ui-tsc__info" d="M12 11.2v4.6M12 8.2h.01" />
  </svg>
);

const CloseGlyph = () => (
  <svg viewBox="0 0 24 24" className="ui-tsc__glyph" aria-hidden="true">
    <path d="M7.5 7.5l9 9M16.5 7.5l-9 9" />
  </svg>
);

/* ── Item ──────────────────────────────────────────────────────────────── */

type SwipePoint = { x: number; y: number };

/** Screen-pixel translation for a drag: away from the anchored edge is 1:1, the other way rubber-bands */
function dampedTowards(direction: 1 | -1, dyScreen: number) {
  const away = -direction * dyScreen;
  return away > 0 ? dyScreen : dyScreen * 0.35;
}

type ToastItemProps = {
  record: ToastRecord;
  /** 0 is the front card, the restored stack position */
  rank: number;
  total: number;
  /** Signed px offset from the front slot, direction already applied */
  offset: number;
  scale: number;
  /** Older card tucked behind, copy hidden until the stack fans out */
  behind: boolean;
  direction: 1 | -1;
  timerRunning: boolean;
  closeButton: boolean;
  onMeasure: (id: string, height: number) => void;
  onDismiss: (id: string) => void;
  register: (id: string, node: HTMLLIElement | null) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLLIElement>, id: string) => void;
};

function ToastItem({
  record,
  rank,
  total,
  offset,
  scale,
  behind,
  direction,
  timerRunning,
  closeButton,
  onMeasure,
  onDismiss,
  register,
  onKeyDown,
}: ToastItemProps) {
  const content = useRef<HTMLDivElement>(null);
  const swipe = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; pointer: number; moved: boolean } | null>(null);
  const [height, setHeight] = useState(0);
  const [dragOffset, setDragOffset] = useState<SwipePoint | null>(null);
  const [flung, setFlung] = useState(false);
  const [entered, setEntered] = useState(false);

  /* Two frames, so the browser paints the off-edge position before the transform animates in */
  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);

  useEffect(() => {
    const node = content.current;
    if (!node) return;
    const report = () => onMeasure(record.id, node.offsetHeight);
    const observer = new ResizeObserver(report);
    observer.observe(node);
    report();
    return () => observer.disconnect();
  }, [record.id, record.version, onMeasure]);

  /* A toast pushed back in under the same id keeps its slot, so a thrown card starts over */
  useEffect(() => {
    if (record.closing) return;
    setFlung(false);
    setDragOffset(null);
  }, [record.closing]);

  const icon = record.icon;

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("button, a, input, textarea")) return;
    drag.current = { x: event.clientX, y: event.clientY, pointer: event.pointerId, moved: false };
    swipe.current?.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    const x = event.clientX - start.x;
    const y = event.clientY - start.y;
    if (!start.moved && Math.abs(x) < 5 && Math.abs(y) < 5) return;
    start.moved = true;
    setDragOffset({ x, y: dampedTowards(direction, y) });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    drag.current = null;
    if (!start) return;
    if (swipe.current?.hasPointerCapture(start.pointer)) swipe.current.releasePointerCapture(start.pointer);
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const width = swipe.current?.offsetWidth ?? 320;
    // Away from the anchored edge, in screen pixels: a top stack is thrown up, a bottom one down
    const away = -direction * dy;
    if (!start.moved || !(Math.abs(dx) > width * 0.3 || away > 56)) {
      // Too short to count – the card springs back on its own 460ms curve
      setDragOffset(null);
      return;
    }
    setDragOffset({ x: dx + Math.sign(dx || 1) * 80, y: dy });
    setFlung(true);
    onDismiss(record.id);
  };

  /* Off the edge before the first settled frame, and again on the way out – unless the card was
   * thrown, in which case the swipe layer carries it away and the row only collapses. */
  const offEdge = !entered || (record.closing && !flung);
  const transformY = offEdge ? `${-direction * 100}%` : `${offset}px`;
  const opacity = offEdge ? 0 : 1;

  const swipeStyle: Vars = {
    transform: dragOffset ? `translate(${dragOffset.x}px, ${dragOffset.y}px)` : undefined,
    opacity: flung ? 0 : undefined,
    // No easing while the finger is down, so the card tracks the pointer exactly
    transition: dragOffset && !flung ? "none" : undefined,
  };

  return (
    <li
      className="ui-tsc__toast"
      ref={(node) => register(record.id, node)}
      data-toast-id={record.id}
      data-type={record.kind}
      data-behind={behind ? "true" : undefined}
      data-removing={record.closing ? "true" : undefined}
      data-swiping={dragOffset ? "true" : undefined}
      tabIndex={0}
      style={{
        transform: `translateY(${transformY}) scale(${scale})`,
        opacity,
        zIndex: total - rank,
        height: record.closing ? 0 : height || undefined,
      }}
      onKeyDown={(event) => onKeyDown(event, record.id)}
    >
      <div
        className="ui-tsc__swipe"
        ref={swipe}
        style={swipeStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="ui-tsc__card">
          <div className="ui-tsc__content" data-action={record.action ? "" : undefined}>
            <span className="ui-tsc__icon" data-type={icon ? "custom" : record.kind}>
              {icon ?? <StatusGlyph />}
            </span>
            <div className="ui-tsc__text">
              {record.previous ? (
                /* The copy this toast is leaving behind, blurred out over the new one */
                <div className="ui-tsc__ghost" key={`ghost-${record.version}`} aria-hidden="true">
                  <div className="ui-tsc__title">{record.previous.title}</div>
                  {record.previous.description ? (
                    <div className="ui-tsc__desc">{record.previous.description}</div>
                  ) : null}
                </div>
              ) : null}
              <div className="ui-tsc__copy" key={record.version} data-changed={record.version > 0 ? "" : undefined}>
                <div className="ui-tsc__title">{record.title}</div>
                {record.description ? <div className="ui-tsc__desc">{record.description}</div> : null}
              </div>
            </div>
            {record.action ? (
              <button
                type="button"
                className="ui-tsc__action"
                onClick={(event) => {
                  let prevented = false;
                  record.action?.onClick({ preventDefault: () => (prevented = true) });
                  if (!prevented) onDismiss(record.id);
                  event.stopPropagation();
                }}
              >
                {record.action.label}
              </button>
            ) : null}
          </div>
          {Number.isFinite(record.duration) ? (
            <span
              className="ui-tsc__timer"
              aria-hidden="true"
              key={`timer-${record.version}`}
              style={{ animationDuration: `${record.duration}ms`, animationPlayState: timerRunning ? "running" : "paused" }}
            />
          ) : null}
        </div>
        {closeButton ? (
          <button
            type="button"
            className="ui-tsc__close"
            aria-label="Dismiss notification"
            onClick={(event) => {
              event.stopPropagation();
              onDismiss(record.id);
            }}
          >
            <CloseGlyph />
          </button>
        ) : null}
      </div>
    </li>
  );
}

/* ── Toaster ───────────────────────────────────────────────────────────── */

export function Toaster({
  position = "bottom-right",
  inline = false,
  duration = DEFAULT_DURATION,
  visibleToasts = 3,
  expand = false,
  offset,
  gap = 8,
  hotkey = "F8",
  closeButton = true,
  label = "Notifications",
  className,
  children,
}: ToasterProps) {
  const all = useSyncExternalStore(subscribe, readSnapshot, readServerSnapshot);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const nodes = useRef(new Map<string, HTMLLIElement>());
  const returnFocus = useRef<HTMLElement | null>(null);
  const [announcement, setAnnouncement] = useState<{ text: string; error: boolean; key: number } | null>(null);
  const seen = useRef(new Set<string>());

  const open = expand || hovered || focused;
  const [vertical, horizontal] = position.split("-");
  const direction: 1 | -1 = vertical === "top" ? 1 : -1;

  /** Newest first, so the front card is the first list item, as the reference renders it */
  const stack = all.slice(-Math.max(1, visibleToasts)).reverse();
  const height = (record: ToastRecord) => heights[record.id] ?? 64;
  const visible = stack.filter((record) => !record.closing);

  const listHeight = open
    ? stack.reduce((total, record, index) => total + height(record) + (index > 0 ? gap : 0), 0)
    : visible.length > 0
      ? height(visible[0]) + PEEK * (visible.length - 1)
      : 0;

  useEffect(() => {
    config = { visibleToasts, duration };
    syncTimers();
  }, [visibleToasts, duration]);

  useEffect(() => {
    setPaused(open);
  }, [open]);

  useEffect(() => () => setPaused(false), []);

  const newest = all.filter((record) => !record.closing).slice(-1)[0];
  useEffect(() => {
    if (!newest) return;
    const stamp = `${newest.id}:${newest.version}`;
    if (seen.current.has(stamp)) return;
    seen.current.add(stamp);
    const text = [
      typeof newest.title === "string" ? newest.title : "",
      typeof newest.description === "string" ? newest.description : "",
    ].join("");
    setAnnouncement({ text, error: newest.kind === "error", key: newest.version + all.length });
  }, [newest, all.length]);

  const measure = useCallback((id: string, next: number) => {
    setHeights((previous) => (Math.abs((previous[id] ?? 0) - next) < 0.5 ? previous : { ...previous, [id]: next }));
  }, []);

  const register = useCallback((id: string, node: HTMLLIElement | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  }, []);

  const focusNewest = () => {
    const target = newest ? nodes.current.get(newest.id) : undefined;
    if (!target) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    target.focus();
  };

  useEffect(() => {
    if (!hotkey || typeof window === "undefined") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== hotkey && event.code !== hotkey) return;
      const target = event.target;
      if (target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      event.preventDefault();
      focusNewest();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey, newest?.id]);

  /** Escape closes the focused card and hands focus to its neighbour, then back to the page */
  const onKeyDown = (event: ReactKeyboardEvent<HTMLLIElement>, id: string) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    const order = stack.map((record) => record.id);
    const index = order.indexOf(id);
    const neighbour = order[index + 1] ?? order[index - 1];
    dismiss(id);
    const node = neighbour && neighbour !== id ? nodes.current.get(neighbour) : null;
    if (node) node.focus();
    else {
      returnFocus.current?.focus();
      returnFocus.current = null;
    }
  };

  const rootStyle: Vars | undefined = offset === undefined ? undefined : { "--ui-tsc-offset": `${offset}px` };

  /** Screen-position of a card: folded to a 10px peek, or laid out below the one in front of it */
  const slotOffset = (rank: number) =>
    direction *
    (open ? stack.slice(0, rank).reduce((total, record) => total + height(record) + gap, 0) : rank * PEEK);

  return (
    <>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-toaster-clean" precedence="default">
        {css}
      </style>
      {children}
      <section
        className={["ui-tsc", className].filter(Boolean).join(" ")}
        data-y={vertical}
        data-x={horizontal}
        data-inline={inline ? "true" : undefined}
        data-empty={stack.length === 0 ? "true" : undefined}
        aria-label={hotkey ? `${label} (${hotkey})` : label}
        tabIndex={-1}
        style={rootStyle}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (!(next instanceof Node) || !event.currentTarget.contains(next)) setFocused(false);
        }}
      >
        <ol className="ui-tsc__list" style={{ height: `${listHeight}px` }}>
          {stack.map((record, rank) => (
            <ToastItem
              key={record.id}
              record={record}
              rank={rank}
              total={stack.length}
              offset={slotOffset(rank)}
              scale={open ? 1 : Math.max(0.8, 1 - rank * 0.05)}
              behind={!open && rank > 0}
              direction={direction}
              timerRunning={!open}
              closeButton={closeButton}
              onMeasure={measure}
              onDismiss={dismiss}
              register={register}
              onKeyDown={onKeyDown}
            />
          ))}
        </ol>
        <div className="ui-tsc__sr" role="status" aria-live="polite">
          {announcement && !announcement.error ? <span key={announcement.key}>{announcement.text}</span> : null}
        </div>
        <div className="ui-tsc__sr" role="alert">
          {announcement && announcement.error ? <span key={announcement.key}>{announcement.text}</span> : null}
        </div>
      </section>
    </>
  );
}

const css = /* css */ `
.ui-tsc{--ui-tsc-card: #fffdfb;--ui-tsc-strong: #0b0908;--ui-tsc-ink: rgba(11, 9, 8, 0.88);--ui-tsc-text: rgba(11, 9, 8, 0.61);--ui-tsc-icon: rgba(11, 9, 8, 0.447);--ui-tsc-faint: rgba(11, 9, 8, 0.27);--ui-tsc-hairline: rgba(11, 9, 8, 0.1);--ui-tsc-success: #2f8d5c;--ui-tsc-danger: #e2544a;--ui-tsc-accent: rgba(217, 84, 31, 0.765);--ui-tsc-focus: rgba(217, 84, 31, 0.35);--ui-tsc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-tsc-shadow-hover: 0 0 0 0.5px rgba(11, 9, 8, 0.1), 0 1px 1px -1px rgba(11, 9, 8, 0.12), 0 1px 3px 0 rgba(11, 9, 8, 0.07);--ui-tsc-shadow-float: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05), 0 10px 24px -10px rgba(11, 9, 8, 0.14);--ui-tsc-ease: cubic-bezier(0.22, 1, 0.36, 1);--ui-tsc-width: 356px;--ui-tsc-offset: 24px;position: fixed;z-index: 9999;box-sizing: border-box;container-type: inline-size;width: var(--ui-tsc-width);max-width: calc(100% - 2 * var(--ui-tsc-offset));margin: 0;padding: 0;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;font-weight: 400;line-height: 20px;color: var(--ui-tsc-text);text-align: left;-webkit-font-smoothing: antialiased;outline: none}
.ui-tsc[data-inline]{position: absolute;z-index: 20;--ui-tsc-offset: 20px}
.ui-tsc[data-empty]{pointer-events: none}
.ui-tsc *, .ui-tsc *::before, .ui-tsc *::after{box-sizing: border-box}
:where(.ui-tsc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
:where(.ui-tsc) svg{display: block;flex: none}
.ui-tsc button:focus-visible{outline: 2px solid var(--ui-tsc-focus);outline-offset: 1px}
.ui-tsc[data-y="bottom"]{bottom: var(--ui-tsc-offset)}
.ui-tsc[data-y="top"]{top: var(--ui-tsc-offset)}
.ui-tsc[data-x="right"]{right: var(--ui-tsc-offset)}
.ui-tsc[data-x="left"]{left: var(--ui-tsc-offset)}
.ui-tsc[data-x="center"]{left: 50%;transform: translateX(-50%)}
.ui-tsc:not([data-inline])[data-y="bottom"]{bottom: max(var(--ui-tsc-offset), env(safe-area-inset-bottom))}
.ui-tsc__list{position: relative;margin: 0;padding: 0;list-style: none}
.ui-tsc__toast{position: absolute;left: 0;right: 0;outline: none;touch-action: none;-webkit-user-select: none;user-select: none;transition: transform var(--nm-dur-4, 380ms) var(--ui-tsc-ease), opacity var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), height 380ms var(--ui-tsc-ease)}
.ui-tsc[data-y="bottom"] .ui-tsc__toast{bottom: 0;transform-origin: 50% 0}
.ui-tsc[data-y="top"] .ui-tsc__toast{top: 0;transform-origin: 50% 100%}
.ui-tsc__toast[data-removing]{pointer-events: none;transition: transform 380ms var(--ui-tsc-ease), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), height 380ms var(--ui-tsc-ease)}
.ui-tsc__swipe{position: relative;height: 100%;transition: transform var(--nm-dur-4, 380ms) cubic-bezier(0.34, 1.3, 0.64, 1), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-tsc__toast[data-swiping]{cursor: grabbing}
.ui-tsc__card{position: relative;height: 100%;overflow: hidden;border-radius: 10px;background: var(--ui-tsc-card);box-shadow: var(--ui-tsc-shadow-float)}
.ui-tsc__toast:focus-visible .ui-tsc__card{outline: 2px solid var(--ui-tsc-focus);outline-offset: 2px}
.ui-tsc__content{display: flex;align-items: flex-start;gap: 8px;padding: 12px 14px 12px 12px;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-tsc__content[data-action]{padding-right: 12px}
.ui-tsc__toast[data-behind] .ui-tsc__content, .ui-tsc__toast[data-behind] .ui-tsc__timer{opacity: 0}
.ui-tsc__text{position: relative;flex: 1;min-width: 0}
.ui-tsc__title{font-weight: 500;line-height: 20px;color: var(--ui-tsc-strong);overflow-wrap: anywhere}
.ui-tsc__desc{font-size: 13px;line-height: 20px;color: var(--ui-tsc-text);overflow-wrap: anywhere}
.ui-tsc__copy[data-changed]{animation: ui-tsc-text-in var(--nm-dur-3, 240ms) var(--ui-tsc-ease) both}
.ui-tsc__ghost{position: absolute;top: 0;left: 0;right: 0;pointer-events: none;animation: ui-tsc-text-out var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-tsc__icon{display: grid;place-items: center;flex: none;width: 16px;height: 20px;color: var(--ui-tsc-icon);transition: color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-tsc__icon[data-type="success"]{color: var(--ui-tsc-success)}
.ui-tsc__icon[data-type="error"]{color: var(--ui-tsc-danger)}
.ui-tsc__icon[data-type="info"]{color: var(--ui-tsc-accent)}
.ui-tsc__icon[data-type="custom"] > *{width: 16px;height: 16px}
.ui-tsc__status{width: 16px;height: 16px;overflow: visible;fill: none;stroke: currentColor;stroke-width: 1.8;stroke-linecap: round;stroke-linejoin: round}
.ui-tsc__icon[data-type="success"] .ui-tsc__status, .ui-tsc__icon[data-type="error"] .ui-tsc__status{animation: ui-tsc-pop var(--nm-dur-4, 380ms) cubic-bezier(0.34, 1.56, 0.64, 1) both}
.ui-tsc__spin{transform-box: fill-box;transform-origin: center;animation: ui-tsc-spin var(--nm-dur-5, 620ms) linear infinite;animation-play-state: paused}
.ui-tsc__icon[data-type="loading"] .ui-tsc__spin{animation-play-state: running}
.ui-tsc__ring{stroke-dasharray: 1 0;stroke-opacity: 0.24;transition: stroke-dasharray var(--nm-dur-5, 620ms) var(--ui-tsc-ease), stroke-opacity var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-tsc__icon[data-type="loading"] .ui-tsc__ring{stroke-dasharray: 0.28 0.72;stroke-opacity: 1}
.ui-tsc__mark{stroke-dasharray: 1;stroke-dashoffset: 1;opacity: 0}
.ui-tsc__info{opacity: 0;transition: opacity 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-tsc__icon[data-type="success"] .ui-tsc__check, .ui-tsc__icon[data-type="error"] .ui-tsc__x1, .ui-tsc__icon[data-type="error"] .ui-tsc__x2{opacity: 1;stroke-dashoffset: 0;animation: ui-tsc-draw var(--nm-dur-4, 380ms) var(--ui-tsc-ease) 160ms both}
.ui-tsc__icon[data-type="error"] .ui-tsc__x2{animation-delay: 260ms}
.ui-tsc__icon[data-type="info"] .ui-tsc__info{opacity: 1}
.ui-tsc__action{flex: none;align-self: center;height: 28px;margin: -4px 0;padding: 0 10px;border-radius: 6px;font-size: 13px;font-weight: 500;line-height: 20px;white-space: nowrap;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 160ms var(--ui-tsc-ease)}
:where(.ui-tsc) .ui-tsc__action{background: var(--ui-tsc-card);box-shadow: var(--ui-tsc-shadow);color: var(--ui-tsc-strong)}
.ui-tsc__action:hover{box-shadow: var(--ui-tsc-shadow-hover)}
.ui-tsc__action:active{transform: scale(0.97)}
.ui-tsc__close{position: absolute;top: -7px;left: -7px;z-index: 1;display: grid;place-items: center;width: 20px;height: 20px;border-radius: 50%;opacity: 0;transform: scale(0.8);transition: opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-2, 160ms) var(--ui-tsc-ease), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
:where(.ui-tsc) .ui-tsc__close{background: var(--ui-tsc-card);box-shadow: var(--ui-tsc-shadow);color: var(--ui-tsc-icon)}
.ui-tsc__close::before{content: "";position: absolute;inset: -6px}
.ui-tsc__close:hover{color: var(--ui-tsc-ink);box-shadow: var(--ui-tsc-shadow-hover)}
.ui-tsc__toast:not([data-behind]):hover .ui-tsc__close, .ui-tsc__toast:not([data-behind]):focus-within .ui-tsc__close{opacity: 1;transform: none}
.ui-tsc__glyph{width: 10px;height: 10px;fill: none;stroke: currentColor;stroke-width: 2.2;stroke-linecap: round}
.ui-tsc__timer{position: absolute;left: 12px;right: 12px;bottom: 0;height: 1px;background: var(--ui-tsc-hairline);transform-origin: left;animation-name: ui-tsc-timer;animation-timing-function: linear;animation-fill-mode: both;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-tsc__sr{position: absolute;width: 1px;height: 1px;overflow: hidden;clip-path: inset(50%);white-space: nowrap}
@keyframes ui-tsc-spin{to{transform: rotate(360deg)}
}
@keyframes ui-tsc-draw{from{stroke-dashoffset: 1}
to{stroke-dashoffset: 0}
}
@keyframes ui-tsc-pop{0%{transform: scale(0.82)}
55%{transform: scale(1.08)}
100%{transform: scale(1)}
}
@keyframes ui-tsc-timer{from{transform: scaleX(1)}
to{transform: scaleX(0)}
}
@keyframes ui-tsc-text-in{from{opacity: 0;transform: translateY(4px);filter: blur(3px)}
to{opacity: 1;transform: none;filter: none}
}
@keyframes ui-tsc-text-out{from{opacity: 1}
to{opacity: 0;transform: translateY(-4px);filter: blur(3px)}
}
@container (max-width: 300px){.ui-tsc__content{padding: 10px 12px 10px 10px}
}
@media (max-width: 600px){.ui-tsc, .ui-tsc[data-x]{left: 12px;right: 12px;width: auto;max-width: none;transform: none}
.ui-tsc[data-y="bottom"]{bottom: 12px}
.ui-tsc:not([data-inline])[data-y="bottom"]{bottom: max(12px, env(safe-area-inset-bottom))}
.ui-tsc[data-y="top"]{top: 12px}
}
@media (hover: none) and (pointer: coarse){.ui-tsc__toast:not([data-behind]) .ui-tsc__close{opacity: 1;transform: none}
.ui-tsc__close{width: 24px;height: 24px;top: -8px;left: -8px}
.ui-tsc__close::before{inset: -8px}
.ui-tsc__action{height: 36px;margin: -8px -2px -8px 0;padding: 0 14px}
}
@media (prefers-reduced-motion: reduce){.ui-tsc *:not(.ui-tsc__spin):not(.ui-tsc__timer), .ui-tsc *::before, .ui-tsc *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-tsc{--ui-tsc-card: #211b16;--ui-tsc-strong: #fffdfb;--ui-tsc-ink: rgba(255, 253, 251, 0.9);--ui-tsc-text: rgba(255, 253, 251, 0.62);--ui-tsc-icon: rgba(255, 253, 251, 0.46);--ui-tsc-faint: rgba(255, 253, 251, 0.3);--ui-tsc-hairline: rgba(255, 253, 251, 0.14);--ui-tsc-success: #2f8d5c;--ui-tsc-danger: #e2544a;--ui-tsc-accent: #ff8a5c;--ui-tsc-focus: rgba(255, 138, 92, 0.5);--ui-tsc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-tsc-shadow-hover: 0 0 0 0.5px rgba(255, 253, 251, 0.16), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-tsc-shadow-float: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4), 0 12px 28px -10px rgba(11, 9, 8, 0.6)}
:where(.dark, [data-theme="dark"]) .ui-tsc .ui-tsc__action{background: rgba(255, 253, 251, 0.06)}
:where(.dark, [data-theme="dark"]) .ui-tsc .ui-tsc__close{background: #2b231b}

`;
