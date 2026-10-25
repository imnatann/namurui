"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

/*
 * Session Replay – a scrubber over a recorded agent session.
 *
 * Every step the agent took sits on the track where it happened, shaped and sized by its kind, so
 * the shape of a run is readable before anything is read in detail. The playhead is dragged,
 * clicked or stepped with the arrow keys, and the step under it is shown in a card that cross-fades
 * when a different step arrives. Play runs on requestAnimationFrame, so the playhead travels
 * continuously instead of jumping, and a range can be marked to hand a piece of the session to
 * someone else. The styles are injected below, so no extra files are needed.
 */

export type SessionEventKind = "message" | "tool" | "decision" | "error";

/** One recorded step of the session */
export type SessionEvent = {
  id: string;
  /** Milliseconds from the start of the recording */
  at: number;
  kind: SessionEventKind;
  /** One line describing what happened */
  summary: string;
  /** Who did it: an agent, a tool, the operator */
  actor?: string;
};

/** A pointer gesture on the track: a scrub, or a range being dragged out from an anchor */
type TrackDrag = { mode: "seek" } | { mode: "span"; anchor: number };

/** A marked range of the recording, in milliseconds from the start */
export type SessionSpan = { start: number; end: number };

export type SessionReplayProps = {
  /** Heading over the transport */
  title?: string;
  /** The recorded session, in any order; positions come from each event's `at` */
  events?: readonly SessionEvent[];
  /** Length of the recording in ms; defaults to the last event plus a tail */
  duration?: number;
  /** Playhead position in ms. Omit to let the component hold it */
  value?: number;
  onValueChange?: (at: number) => void;
  /** Whether the clock is running. Omit to let the component hold it */
  playing?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  /** Marked range. Omit to let the component hold it */
  selection?: SessionSpan | null;
  onSelectionChange?: (span: SessionSpan | null) => void;
  /** Speed the clock starts at */
  initialSpeed?: number;
  className?: string;
};

const NO_EVENTS: readonly SessionEvent[] = [];

const SPEEDS: number[] = [0.5, 1, 2, 4];

const KIND_LABEL: Record<SessionEventKind, string> = {
  message: "Message",
  tool: "Tool call",
  decision: "Decision",
  error: "Error",
};

/** Axis steps, so five labels land on a range a reviewer can read without counting */
const AXIS_STEPS = [500, 1000, 2000, 5000, 10_000, 15_000, 30_000, 60_000, 120_000, 300_000, 600_000, 1_800_000];

/** A span narrower than this is a stray click, not a marked range */
const MIN_SPAN = 300;

const HOLD_MS = 2000;

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** `04:12.4`, growing an hours field only when the recording is long enough to need one */
function formatTime(ms: number, tenths: boolean): string {
  const safe = Math.max(0, ms);
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor(safe / 60_000) % 60;
  const seconds = Math.floor(safe / 1000) % 60;
  const mm = minutes < 10 ? `0${minutes}` : `${minutes}`;
  const ss = seconds < 10 ? `0${seconds}` : `${seconds}`;
  const base = hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
  return tenths ? `${base}.${Math.floor((safe % 1000) / 100)}` : base;
}

function axisMarks(total: number): number[] {
  const target = total / 5;
  const step = AXIS_STEPS.find((candidate) => candidate >= target) ?? AXIS_STEPS[AXIS_STEPS.length - 1];
  const marks: number[] = [];
  for (let at = 0; at <= total; at += step) marks.push(at);
  return marks;
}

const IconBubble = () => (
  <svg viewBox="0 0 16 16" width="11" height="11" fill="none" aria-hidden="true">
    <path
      d="M3 4.2h10v6.4H7.1L4.4 12.9V10.6H3z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.3"
    />
  </svg>
);

const IconCall = () => (
  <svg viewBox="0 0 16 16" width="11" height="11" fill="none" aria-hidden="true">
    <path
      d="M6.2 3.4 3.4 8l2.8 4.6M9.8 3.4 12.6 8l-2.8 4.6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.3"
    />
    <circle cx="8" cy="8" r="1.5" fill="currentColor" />
  </svg>
);

const IconFork = () => (
  <svg viewBox="0 0 16 16" width="11" height="11" fill="none" aria-hidden="true">
    <path
      d="M8 12.8V9.4M8 9.4C8 6.6 4.6 7 4.6 3.4M8 9.4c0-2.8 3.4-2.4 3.4-6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.3"
    />
  </svg>
);

const IconAlert = () => (
  <svg viewBox="0 0 16 16" width="11" height="11" fill="none" aria-hidden="true">
    <path d="M8 2.8 14 13.2H2z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.3" />
    <path d="M8 6.6v3.2M8 11.9h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
  </svg>
);

const IconStart = () => (
  <svg viewBox="0 0 16 16" width="11" height="11" fill="none" aria-hidden="true">
    <path d="M2.6 8h4.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3" />
    <circle cx="11" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);

const IconPlay = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
    <path
      d="M5.4 3.4 13 8l-7.6 4.6z"
      fill="currentColor"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.2"
    />
  </svg>
);

const IconPause = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
    <rect x="4.8" y="3.6" width="2.4" height="8.8" rx="1.1" fill="currentColor" />
    <rect x="8.8" y="3.6" width="2.4" height="8.8" rx="1.1" fill="currentColor" />
  </svg>
);

const IconPrevious = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
    <path
      d="M11.8 3.6 5.6 8l6.2 4.4z"
      fill="currentColor"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.2"
    />
    <rect x="3.2" y="3.6" width="1.8" height="8.8" rx="0.9" fill="currentColor" />
  </svg>
);

const IconNext = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
    <path d="M4.2 3.6 10.4 8l-6.2 4.4z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.2" />
    <rect x="11" y="3.6" width="1.8" height="8.8" rx="0.9" fill="currentColor" />
  </svg>
);

/* A ruler with a piece missing: the session has a length, but nothing was written on it. */
const IconEmpty = () => (
  <svg viewBox="0 0 32 18" width="34" height="19" fill="none" aria-hidden="true">
    <path d="M2 12h8M13.5 12h5M23 12h7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    <path
      d="M5 12V8.5M9 12v-3M16.5 12V6M25 12v-4.5M29 12V9.5"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.5"
    />
  </svg>
);

function KindGlyph({ kind }: { kind: SessionEventKind | "start" }) {
  if (kind === "message") return <IconBubble />;
  if (kind === "tool") return <IconCall />;
  if (kind === "decision") return <IconFork />;
  if (kind === "error") return <IconAlert />;
  return <IconStart />;
}

/** What the card shows: the step under the playhead, or the wait before the first one. */
type CardView = {
  id: string;
  kind: SessionEventKind | "start";
  offset: number;
  summary: string;
  actor?: string;
};

function CardBody({ view }: { view: CardView }) {
  return (
    <>
      <div className="ui-ssrp__card-top">
        <span className="ui-ssrp__kind" data-kind={view.kind}>
          <KindGlyph kind={view.kind} />
          {view.kind === "start" ? "Before the first step" : KIND_LABEL[view.kind]}
        </span>
        {view.actor ? <span className="ui-ssrp__actor">{view.actor}</span> : null}
        <span className="ui-ssrp__card-offset">{`+${formatTime(view.offset, true)}`}</span>
      </div>
      <p className="ui-ssrp__card-summary">{view.summary}</p>
    </>
  );
}

export function SessionReplay({
  title = "Session replay",
  events,
  duration,
  value,
  onValueChange,
  playing,
  onPlayingChange,
  selection,
  onSelectionChange,
  initialSpeed = 1,
  className,
}: SessionReplayProps) {
  const sorted = useMemo(() => [...(events ?? NO_EVENTS)].sort((a, b) => a.at - b.at), [events]);
  const empty = sorted.length === 0;
  const lastAt = empty ? 0 : sorted[sorted.length - 1].at;
  const total = empty ? 0 : Math.max(1000, duration ?? lastAt + Math.max(4000, Math.round(lastAt * 0.08)));
  const stepMs = clamp(Math.round(total / 240), 250, 5000);

  const [announce, setAnnounce] = useState("");
  const [innerAt, setInnerAt] = useState(0);
  const [innerPlaying, setInnerPlaying] = useState(false);
  const [innerSpan, setInnerSpan] = useState<SessionSpan | null>(null);
  const [speed, setSpeed] = useState(SPEEDS.includes(initialSpeed) ? initialSpeed : 1);
  const [laneWidth, setLaneWidth] = useState(0);
  const [leaving, setLeaving] = useState<CardView | null>(null);

  const shown = clamp(value === undefined ? innerAt : value, 0, total);
  const span = selection === undefined ? innerSpan : selection;
  const isPlaying = playing ?? innerPlaying;

  const laneRef = useRef<HTMLDivElement>(null);
  const atRef = useRef(shown);
  const speedRef = useRef(speed);
  const spanRef = useRef<SessionSpan | null>(span);
  const dragRef = useRef<TrackDrag | null>(null);
  const handleRef = useRef<"start" | "end" | null>(null);
  const valueRef = useRef(value);
  const changeRef = useRef(onValueChange);

  const write = useCallback(
    (next: number) => {
      const at = clamp(next, 0, total);
      atRef.current = at;
      if (valueRef.current === undefined) setInnerAt(at);
      changeRef.current?.(at);
      return at;
    },
    [total],
  );

  const writeSpan = useCallback(
    (next: SessionSpan | null) => {
      spanRef.current = next;
      if (selection === undefined) setInnerSpan(next);
      onSelectionChange?.(next);
    },
    [onSelectionChange, selection],
  );

  const setPlaying = useCallback(
    (next: boolean) => {
      if (playing === undefined) setInnerPlaying(next);
      onPlayingChange?.(next);
    },
    [onPlayingChange, playing],
  );

  const writeRef = useRef(write);
  const setPlayingRef = useRef(setPlaying);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    changeRef.current = onValueChange;
  }, [onValueChange]);

  useEffect(() => {
    writeRef.current = write;
    setPlayingRef.current = setPlaying;
  }, [setPlaying, write]);

  useEffect(() => {
    atRef.current = shown;
  }, [shown]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    spanRef.current = span;
  }, [span]);

  /* The lane owns the x scale, so its width is measured rather than assumed. */
  useEffect(() => {
    const lane = laneRef.current;
    if (!lane || typeof ResizeObserver === "undefined") return;
    const measure = () => setLaneWidth(lane.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(lane);
    return () => observer.disconnect();
  }, [empty]);

  /* Playback. One rAF loop advances the clock by the real elapsed time, cancels itself when the
     session runs out, and stops when the tab is hidden. */
  useEffect(() => {
    if (!isPlaying || total <= 0) return;
    let frame = 0;
    let previous = 0;
    const step = (now: number) => {
      if (!previous) previous = now;
      const elapsed = (now - previous) * speedRef.current;
      previous = now;
      const next = Math.min(total, atRef.current + elapsed);
      writeRef.current(next);
      if (next >= total) {
        setPlayingRef.current(false);
        setAnnounce(`End of the recording at ${formatTime(total, true)}`);
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
        return;
      }
      if (!frame) {
        previous = 0;
        frame = requestAnimationFrame(step);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isPlaying, total]);

  const eventUnder = useCallback(
    (at: number): SessionEvent | null => {
      let found: SessionEvent | null = null;
      for (const event of sorted) {
        if (event.at <= at && (!found || event.at >= found.at)) found = event;
      }
      return found;
    },
    [sorted],
  );

  const seekNote = useCallback(
    (at: number) => {
      const event = eventUnder(at);
      return event
        ? `Seeked to ${formatTime(at, true)}, ${KIND_LABEL[event.kind].toLowerCase()}`
        : `Seeked to ${formatTime(at, true)}`;
    },
    [eventUnder],
  );

  const seek = useCallback(
    (next: number, note?: string) => {
      write(next);
      if (note) setAnnounce(note);
    },
    [write],
  );

  const go = useCallback(
    (next: number) => {
      const at = clamp(next, 0, total);
      seek(at, seekNote(at));
    },
    [seek, seekNote, total],
  );

  const countInSpan = useCallback(
    (marked: SessionSpan) => {
      const found = sorted.filter((event) => event.at >= marked.start && event.at <= marked.end).length;
      return `${found} event${found === 1 ? "" : "s"} in the span`;
    },
    [sorted],
  );

  const togglePlay = useCallback(() => {
    if (total <= 0) return;
    if (isPlaying) {
      setPlaying(false);
      setAnnounce(`Paused at ${formatTime(atRef.current, true)}`);
      return;
    }
    if (atRef.current >= total - 1) write(0);
    setPlaying(true);
    setAnnounce(`Playing at ${speedRef.current}x from ${formatTime(atRef.current, true)}`);
  }, [isPlaying, setPlaying, total, write]);

  const chooseSpeed = (next: number) => {
    speedRef.current = next;
    setSpeed(next);
    setAnnounce(isPlaying ? `Playing at ${next}x` : `Playback speed ${next}x`);
  };

  /* Transport steps land on a step, which is what a reviewer is actually looking for. */
  const stepEvent = (direction: 1 | -1) => {
    if (empty) return;
    const from = atRef.current;
    if (direction === 1) {
      const next = sorted.find((event) => event.at > from + 1);
      if (!next) {
        seek(total, `End of the recording at ${formatTime(total, true)}`);
        return;
      }
      seek(next.at, `Next step, ${KIND_LABEL[next.kind].toLowerCase()} at ${formatTime(next.at, true)}`);
      return;
    }
    let previous: SessionEvent | null = null;
    for (const event of sorted) {
      if (event.at < from - 1) previous = event;
    }
    if (!previous) {
      seek(0, "Back to the start of the recording");
      return;
    }
    seek(previous.at, `Previous step, ${KIND_LABEL[previous.kind].toLowerCase()} at ${formatTime(previous.at, true)}`);
  };

  const markSpan = (edge: "start" | "end") => {
    const here = atRef.current;
    const marked = spanRef.current;
    let next: SessionSpan;
    if (edge === "start") {
      const start = Math.min(here, Math.max(0, total - MIN_SPAN));
      next = { start, end: marked && marked.end > here ? marked.end : Math.min(total, start + HOLD_MS) };
    } else {
      const start = marked && marked.start < here ? marked.start : Math.max(0, here - HOLD_MS);
      next = { start, end: Math.max(here, Math.min(total, start + MIN_SPAN)) };
    }
    writeSpan(next);
    setAnnounce(
      edge === "start"
        ? `Span starts at ${formatTime(next.start, true)}. Press the right bracket to set the end.`
        : `Span ends at ${formatTime(next.end, true)}, ${countInSpan(next)}`,
    );
  };

  const cells = total > 0 ? total : 1;
  const percent = (at: number) => clamp((at / cells) * 100, 0, 100);
  const marks = useMemo(() => axisMarks(total), [total]);
  const current = eventUnder(shown);
  const spanCount = span ? sorted.filter((event) => event.at >= span.start && event.at <= span.end).length : 0;

  const view: CardView = current
    ? { id: current.id, kind: current.kind, offset: current.at, summary: current.summary, actor: current.actor }
    : {
        id: "start",
        kind: "start",
        offset: shown,
        summary: empty
          ? "This session holds no events."
          : `Nothing recorded yet. The first step is a ${KIND_LABEL[sorted[0].kind].toLowerCase()} at +${formatTime(sorted[0].at, true)}.`,
      };

  /* The card cross-fades: the step that leaves keeps its place while it fades out under the new one. */
  const lastView = useRef<CardView | null>(null);
  useEffect(() => {
    const previous = lastView.current;
    if (previous && previous.id !== view.id) setLeaving(previous);
    lastView.current = view;
  }, [view]);

  const timeAt = useCallback(
    (clientX: number) => {
      const lane = laneRef.current;
      if (!lane || total <= 0) return 0;
      const rect = lane.getBoundingClientRect();
      if (!rect.width) return 0;
      return clamp(((clientX - rect.left) / rect.width) * total, 0, total);
    },
    [total],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (total <= 0) return;
    const at = timeAt(event.clientX);
    event.currentTarget.setPointerCapture(event.pointerId);
    /* Steps and span handles keep their own pointerdown, so anything that reaches here is the
       scrub surface: it takes focus, which is where the arrow keys then act. */
    laneRef.current?.focus({ preventScroll: true });
    if (event.shiftKey) {
      dragRef.current = { mode: "span", anchor: at };
      writeSpan({ start: at, end: at });
      setAnnounce(`Span starts at ${formatTime(at, true)}. Drag to set the end.`);
      return;
    }
    dragRef.current = { mode: "seek" };
    write(at);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const at = timeAt(event.clientX);
    if (drag.mode === "seek") {
      write(at);
      return;
    }
    writeSpan({ start: Math.min(drag.anchor, at), end: Math.max(drag.anchor, at) });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (drag.mode === "seek") {
      setAnnounce(seekNote(atRef.current));
      return;
    }
    const marked = spanRef.current;
    if (!marked || marked.end - marked.start < MIN_SPAN) {
      writeSpan(null);
      setAnnounce("Span cleared. Shift-drag to mark a range.");
      return;
    }
    setAnnounce(`Span marked, ${formatTime(marked.start, true)} to ${formatTime(marked.end, true)}, ${countInSpan(marked)}`);
  };

  const onHandleDown = (edge: "start" | "end") => (event: ReactPointerEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    if (!spanRef.current || total <= 0) return;
    handleRef.current = edge;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onHandleMove = (edge: "start" | "end") => (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (handleRef.current !== edge) return;
    const marked = spanRef.current;
    if (!marked) return;
    const at = timeAt(event.clientX);
    writeSpan(
      edge === "start"
        ? { start: clamp(at, 0, marked.end - MIN_SPAN), end: marked.end }
        : { start: marked.start, end: clamp(at, marked.start + MIN_SPAN, total) },
    );
  };

  const onHandleUp = (edge: "start" | "end") => (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (handleRef.current !== edge) return;
    handleRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const marked = spanRef.current;
    if (marked) {
      setAnnounce(`Span ${edge === "start" ? "starts" : "ends"} at ${formatTime(edge === "start" ? marked.start : marked.end, true)}`);
    }
  };

  const onHandleKey = (edge: "start" | "end") => (event: ReactKeyboardEvent<HTMLSpanElement>) => {
    const marked = spanRef.current;
    if (!marked || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    const delta = (event.key === "ArrowRight" ? 1 : -1) * stepMs * (event.shiftKey ? 5 : 1);
    const next: SessionSpan =
      edge === "start"
        ? { start: clamp(marked.start + delta, 0, marked.end - MIN_SPAN), end: marked.end }
        : { start: marked.start, end: clamp(marked.end + delta, marked.start + MIN_SPAN, total) };
    writeSpan(next);
    setAnnounce(`Span ${edge === "start" ? "start" : "end"} at ${formatTime(edge === "start" ? next.start : next.end, true)}`);
  };

  const onLaneKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (total <= 0) return;
    const key = event.key;
    if (key === " " || key === "k") {
      event.preventDefault();
      togglePlay();
      return;
    }
    if (key === "ArrowLeft" || key === "ArrowRight") {
      event.preventDefault();
      const delta = (key === "ArrowRight" ? 1 : -1) * stepMs * (event.shiftKey ? 5 : 1);
      go(atRef.current + delta);
      return;
    }
    if (key === "PageUp" || key === "PageDown") {
      event.preventDefault();
      go(atRef.current + (key === "PageUp" ? 1 : -1) * (total / 10));
      return;
    }
    if (key === "Home") {
      event.preventDefault();
      go(0);
      return;
    }
    if (key === "End") {
      event.preventDefault();
      go(total);
      return;
    }
    if (key === "[") {
      event.preventDefault();
      markSpan("start");
      return;
    }
    if (key === "]") {
      event.preventDefault();
      markSpan("end");
      return;
    }
    if (key === "Escape" && spanRef.current) {
      event.preventDefault();
      writeSpan(null);
      setAnnounce("Span cleared");
    }
  };

  const playheadX = (percent(shown) / 100) * laneWidth;
  /* The time chip rides the playhead but stays inside the lane, so it is clamped once the lane
     has been measured; before that it simply sits under the playhead. */
  const chipX = laneWidth > 0 ? clamp(playheadX, 30, Math.max(30, laneWidth - 30)) : playheadX;

  return (
    <div
      className={["ui-ssrp", className].filter(Boolean).join(" ")}
      data-state={empty ? "empty" : isPlaying ? "playing" : "paused"}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-session-replay" precedence="default">
        {css}
      </style>

      <div className="ui-ssrp__head">
        <h3 className="ui-ssrp__title">{title}</h3>
        {/* The clock repeats the slider's own value text, so it stays out of the reading order */}
        <div className="ui-ssrp__clock" aria-hidden="true">
          <span className="ui-ssrp__now">{formatTime(shown, true)}</span>
          <span className="ui-ssrp__slash">/</span>
          <span className="ui-ssrp__total">{formatTime(total, true)}</span>
        </div>
      </div>

      {empty ? (
        <div className="ui-ssrp__empty">
          <IconEmpty />
          <p className="ui-ssrp__empty-title">This session recorded nothing</p>
          <p className="ui-ssrp__empty-note">
            Steps land here as the agent takes them. Until then there is no timeline to scrub.
          </p>
        </div>
      ) : (
        <div
          className="ui-ssrp__track"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div
            ref={laneRef}
            className="ui-ssrp__lane"
            role="slider"
            tabIndex={0}
            aria-label="Playhead position in the recorded session"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={Math.round(shown)}
            aria-valuetext={formatTime(shown, true)}
            onKeyDown={onLaneKeyDown}
          >
            {marks.map((mark, index) => (
              <span
                key={`grid-${mark}`}
                className="ui-ssrp__gridline"
                aria-hidden="true"
                style={{
                  left: `${percent(mark)}%`,
                  transform: index === 0 ? "none" : index === marks.length - 1 ? "translateX(-1px)" : "translateX(-0.5px)",
                }}
              />
            ))}
            {span ? (
              <span
                className="ui-ssrp__span"
                aria-hidden="true"
                style={{ left: `${percent(span.start)}%`, width: `${percent(span.end) - percent(span.start)}%` }}
              />
            ) : null}
            <span className="ui-ssrp__rail" aria-hidden="true" />
            <span className="ui-ssrp__axis" aria-hidden="true">
              {marks.map((mark, index) => (
                <span
                  key={`label-${mark}`}
                  className="ui-ssrp__axis-label"
                  style={{
                    left: `${percent(mark)}%`,
                    transform: index === 0 ? "none" : index === marks.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
                  }}
                >
                  {formatTime(mark, false)}
                </span>
              ))}
            </span>
          </div>

          <div className="ui-ssrp__marks">
            {sorted.map((event) => (
              <button
                key={event.id}
                type="button"
                className="ui-ssrp__tick"
                data-kind={event.kind}
                data-past={event.at <= shown ? "true" : "false"}
                style={{ left: `${percent(event.at)}%` }}
                title={`${KIND_LABEL[event.kind]} at +${formatTime(event.at, true)}`}
                aria-label={`${KIND_LABEL[event.kind]} at +${formatTime(event.at, true)}: ${event.summary}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => seek(event.at, `Seeked to ${formatTime(event.at, true)}, ${KIND_LABEL[event.kind].toLowerCase()}: ${event.summary}`)}
              >
                <span className="ui-ssrp__tick-body">
                  <span className="ui-ssrp__glyph">
                    <KindGlyph kind={event.kind} />
                  </span>
                  <span className="ui-ssrp__stem" />
                </span>
              </button>
            ))}
          </div>

          <div className="ui-ssrp__top">
            {span ? (
              <>
                <span
                  className="ui-ssrp__handle"
                  role="slider"
                  tabIndex={0}
                  aria-label="Span start"
                  aria-valuemin={0}
                  aria-valuemax={total}
                  aria-valuenow={Math.round(span.start)}
                  aria-valuetext={formatTime(span.start, true)}
                  style={{ left: `${percent(span.start)}%` }}
                  onPointerDown={onHandleDown("start")}
                  onPointerMove={onHandleMove("start")}
                  onPointerUp={onHandleUp("start")}
                  onPointerCancel={onHandleUp("start")}
                  onKeyDown={onHandleKey("start")}
                />
                <span
                  className="ui-ssrp__handle"
                  role="slider"
                  tabIndex={0}
                  aria-label="Span end"
                  aria-valuemin={0}
                  aria-valuemax={total}
                  aria-valuenow={Math.round(span.end)}
                  aria-valuetext={formatTime(span.end, true)}
                  style={{ left: `${percent(span.end)}%` }}
                  onPointerDown={onHandleDown("end")}
                  onPointerMove={onHandleMove("end")}
                  onPointerUp={onHandleUp("end")}
                  onPointerCancel={onHandleUp("end")}
                  onKeyDown={onHandleKey("end")}
                />
              </>
            ) : null}
            <span className="ui-ssrp__playhead" aria-hidden="true" style={{ transform: `translateX(${playheadX}px)` }}>
              <span className="ui-ssrp__chip" style={{ transform: `translateX(calc(-50% + ${chipX - playheadX}px))` }}>
                {formatTime(shown, true)}
              </span>
              <span className="ui-ssrp__playhead-line" />
              <span className="ui-ssrp__playhead-dot" />
            </span>
          </div>
        </div>
      )}

      <div className="ui-ssrp__transport">
        <button
          type="button"
          className="ui-ssrp__btn"
          onClick={() => stepEvent(-1)}
          disabled={empty}
          aria-label="Previous step"
        >
          <IconPrevious />
        </button>
        <button
          type="button"
          className="ui-ssrp__btn ui-ssrp__btn--play"
          onClick={togglePlay}
          disabled={empty}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <IconPause /> : <IconPlay />}
        </button>
        <button type="button" className="ui-ssrp__btn" onClick={() => stepEvent(1)} disabled={empty} aria-label="Next step">
          <IconNext />
        </button>

        <div className="ui-ssrp__speeds" role="group" aria-label="Playback speed">
          {SPEEDS.map((option) => (
            <button
              key={option}
              type="button"
              className="ui-ssrp__speed"
              aria-pressed={speed === option}
              onClick={() => chooseSpeed(option)}
            >
              {`${option}x`}
            </button>
          ))}
        </div>

        <span className="ui-ssrp__spanbar">
          {span ? (
            <>
              <span className="ui-ssrp__span-range">
                {`${formatTime(span.start, true)} to ${formatTime(span.end, true)}`}
              </span>
              <span className="ui-ssrp__span-count">{`${spanCount} event${spanCount === 1 ? "" : "s"}`}</span>
              <button
                type="button"
                className="ui-ssrp__clear"
                onClick={() => {
                  writeSpan(null);
                  setAnnounce("Span cleared");
                }}
              >
                Clear span
              </button>
            </>
          ) : (
            <span className="ui-ssrp__hint">Space plays and pauses. Shift-drag, or [ and ], marks a range</span>
          )}
        </span>
      </div>

      <div className="ui-ssrp__stack">
        {leaving ? (
          <div
            key={`out-${leaving.id}`}
            className="ui-ssrp__card"
            data-kind={leaving.kind}
            data-exiting="true"
            aria-hidden="true"
            onAnimationEnd={(event) => {
              if (event.animationName === "ui-ssrp-card-out") setLeaving(null);
            }}
          >
            <CardBody view={leaving} />
          </div>
        ) : null}
        <div key={`in-${view.id}`} className="ui-ssrp__card" data-kind={view.kind}>
          <CardBody view={view} />
        </div>
      </div>

      <span className="ui-ssrp__sr" role="status" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}

const css = /* css */ `
/* Session Replay – a scrubber over a recorded agent session.
 * The knobs below live on .ui-ssrp, and a consumer overrides them there:
 *   .ui-ssrp { --ui-ssrp-accent: #ff6b35; }
 * Every token is read with its literal fallback, so the sheet is correct in a host
 * that never loads the NamurUI token layer. */
.ui-ssrp {
  --ui-ssrp-ground: var(--card, #201a15);
  --ui-ssrp-panel: var(--panel, #1a1512);
  --ui-ssrp-ink: var(--text, #f4ece4);
  --ui-ssrp-muted: var(--text-muted, #a2958a);
  --ui-ssrp-subtle: var(--text-subtle, #f4ece48c);
  --ui-ssrp-line: var(--border, #33291f);
  --ui-ssrp-line-soft: var(--border-soft, #ffffff12);
  --ui-ssrp-accent: var(--accent, #ff6b35);
  --ui-ssrp-accent-soft: var(--accent-soft, #ff6b3524);
  --ui-ssrp-accent-fg: var(--accent-fg, #1a0f08);
  --ui-ssrp-danger: var(--danger, #e2544a);
  --ui-ssrp-hover: #ffffff12;
  --ui-ssrp-wash: rgba(244, 236, 228, 0.06);
  --ui-ssrp-shadow: var(--shadow-card, 0 1px 1.5px #3d1f0a0a);
  --ui-ssrp-radius: var(--radius-card, 16px);
  --ui-ssrp-pill: var(--radius-pill, 999px);
  --ui-ssrp-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --ui-ssrp-mono: var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace);
  --ui-ssrp-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-ssrp-ease-in: var(--nm-ease-in, cubic-bezier(0.55, 0, 0.68, 0.19));
  --ui-ssrp-ease-soft: var(--nm-ease-soft, cubic-bezier(0.4, 0, 0.2, 1));
  --ui-ssrp-dur-1: var(--nm-dur-1, 90ms);
  --ui-ssrp-dur-2: var(--nm-dur-2, 160ms);
  --ui-ssrp-dur-3: var(--nm-dur-3, 240ms);
  --ui-ssrp-dur-6: var(--nm-dur-6, 1100ms);
  /* How far a step's stem rises off the rail: kind is legible by height before it is clicked. */
  --ui-ssrp-stem-message: 9px;
  --ui-ssrp-stem-tool: 15px;
  --ui-ssrp-stem-decision: 21px;
  --ui-ssrp-stem-error: 27px;

  position: relative;
  display: grid;
  gap: 14px;
  padding: 16px 18px 14px;
  border-radius: var(--ui-ssrp-radius);
  background: var(--ui-ssrp-ground);
  box-shadow:
    inset 0 0 0 1px var(--ui-ssrp-line),
    var(--ui-ssrp-shadow);
  color: var(--ui-ssrp-ink);
  font-family: var(--ui-ssrp-sans);
  font-size: 14px;
  line-height: 1.4;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
}

.ui-ssrp__head {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.ui-ssrp__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.ui-ssrp__clock {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-left: auto;
  font-family: var(--ui-ssrp-mono);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.ui-ssrp__now {
  color: var(--ui-ssrp-ink);
}
.ui-ssrp__slash {
  color: var(--ui-ssrp-subtle);
}
.ui-ssrp__total {
  color: var(--ui-ssrp-muted);
}

/* The track is the pointer surface; the lane inside it carries the x scale, the marks layer
   carries the step buttons, and the top layer holds the span handles and the playhead. All three
   share one grid cell, so they stay in step at any width without measuring each other. */
.ui-ssrp__track {
  position: relative;
  display: grid;
  padding: 0 14px;
  touch-action: none;
  user-select: none;
  cursor: ew-resize;
}
.ui-ssrp__lane,
.ui-ssrp__marks,
.ui-ssrp__top {
  grid-area: 1 / 1;
  position: relative;
}
/* The top layer holds the span handles and the playhead: it must not swallow the step buttons
   underneath, so only the handles take pointer events. */
.ui-ssrp__top {
  pointer-events: none;
}
.ui-ssrp__lane {
  height: 116px;
}
.ui-ssrp__lane:focus-visible {
  outline: 2px solid var(--ui-ssrp-accent);
  outline-offset: 4px;
  border-radius: 8px;
}

.ui-ssrp__gridline {
  position: absolute;
  top: 30px;
  bottom: 22px;
  width: 1px;
  background: var(--ui-ssrp-line-soft);
}
.ui-ssrp__rail {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 26px;
  height: 1px;
  background: var(--ui-ssrp-line);
}
.ui-ssrp__axis {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 2px;
  height: 12px;
}
.ui-ssrp__axis-label {
  position: absolute;
  font-family: var(--ui-ssrp-mono);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ssrp-muted);
  white-space: nowrap;
}

/* The marked range: a neutral wash, because the ember accent belongs to the playhead alone. */
.ui-ssrp__span {
  position: absolute;
  top: 28px;
  bottom: 20px;
  border-radius: 6px;
  background: var(--ui-ssrp-wash);
  box-shadow: inset 0 0 0 1px var(--ui-ssrp-line-soft);
  pointer-events: none;
  animation: ui-ssrp-span-in var(--ui-ssrp-dur-3) var(--ui-ssrp-ease-out) both;
}
.ui-ssrp__handle {
  position: absolute;
  top: 20px;
  bottom: 14px;
  width: 16px;
  margin-left: -8px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  cursor: ew-resize;
  touch-action: none;
  pointer-events: auto;
}
.ui-ssrp__handle::before {
  content: "";
  width: 4px;
  height: 100%;
  max-height: 46px;
  border-radius: 2px;
  background: var(--ui-ssrp-muted);
  transition:
    background-color var(--ui-ssrp-dur-2) var(--ui-ssrp-ease-out),
    transform var(--ui-ssrp-dur-2) var(--ui-ssrp-ease-out);
}
.ui-ssrp__handle:hover::before,
.ui-ssrp__handle:focus-visible::before {
  background: var(--ui-ssrp-ink);
  transform: scaleY(1.06);
}
.ui-ssrp__handle:focus-visible {
  outline: 2px solid var(--ui-ssrp-accent);
  outline-offset: 2px;
}

/* Steps. Kind is carried twice: by the glyph and by how far the stem rises off the rail. */
.ui-ssrp__tick {
  position: absolute;
  bottom: 26px;
  width: 22px;
  margin-left: -11px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ui-ssrp-muted);
  cursor: pointer;
}
.ui-ssrp__tick[data-kind="error"] {
  color: var(--ui-ssrp-danger);
}
.ui-ssrp__tick-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  opacity: 0.45;
  transform: translateY(3px);
  transition:
    opacity var(--ui-ssrp-dur-3) var(--ui-ssrp-ease-out),
    transform var(--ui-ssrp-dur-3) var(--ui-ssrp-ease-out);
}
.ui-ssrp__tick[data-past="true"] .ui-ssrp__tick-body,
.ui-ssrp__tick:hover .ui-ssrp__tick-body,
.ui-ssrp__tick:focus-visible .ui-ssrp__tick-body {
  opacity: 1;
  transform: none;
}
.ui-ssrp__tick:focus-visible {
  outline: 2px solid var(--ui-ssrp-ink);
  outline-offset: 2px;
  border-radius: 8px;
}
.ui-ssrp__glyph {
  display: grid;
  place-items: center;
  margin-bottom: 4px;
}
.ui-ssrp__stem {
  width: 1.5px;
  height: 12px;
  border-radius: 1px;
  background: currentColor;
}
.ui-ssrp__tick[data-kind="message"] .ui-ssrp__stem {
  height: var(--ui-ssrp-stem-message, 9px);
}
.ui-ssrp__tick[data-kind="tool"] .ui-ssrp__stem {
  height: var(--ui-ssrp-stem-tool, 15px);
}
.ui-ssrp__tick[data-kind="decision"] .ui-ssrp__stem {
  height: var(--ui-ssrp-stem-decision, 21px);
}
.ui-ssrp__tick[data-kind="error"] .ui-ssrp__stem {
  height: var(--ui-ssrp-stem-error, 27px);
}

/* The playhead: the one live thing on the sheet, so it is the only ember. */
.ui-ssrp__playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 0;
  pointer-events: none;
}
.ui-ssrp__playhead-line {
  position: absolute;
  top: 30px;
  bottom: 26px;
  left: -1px;
  width: 2px;
  border-radius: 1px;
  background: var(--ui-ssrp-accent);
  opacity: 0.72;
}
.ui-ssrp__playhead-dot {
  position: absolute;
  bottom: 22px;
  left: -4.5px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--ui-ssrp-accent);
  box-shadow: 0 0 0 4px var(--ui-ssrp-accent-soft);
}
.ui-ssrp__chip {
  position: absolute;
  top: 0;
  left: 0;
  padding: 3px 8px;
  border-radius: var(--ui-ssrp-pill);
  background: var(--ui-ssrp-accent);
  color: var(--ui-ssrp-accent-fg);
  font-family: var(--ui-ssrp-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.ui-ssrp[data-state="playing"] .ui-ssrp__playhead-dot {
  animation: ui-ssrp-beat var(--ui-ssrp-dur-6) var(--ui-ssrp-ease-soft) infinite;
}

/* Transport */
.ui-ssrp__transport {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.ui-ssrp__btn {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--ui-ssrp-ink);
  box-shadow: inset 0 0 0 1px var(--ui-ssrp-line);
  cursor: pointer;
  transition:
    background-color var(--ui-ssrp-dur-2) var(--ui-ssrp-ease-out),
    transform var(--ui-ssrp-dur-1) var(--ui-ssrp-ease-out);
}
.ui-ssrp__btn:hover {
  background: var(--ui-ssrp-hover);
}
.ui-ssrp__btn:active {
  transform: scale(0.94);
}
.ui-ssrp__btn:focus-visible {
  outline: 2px solid var(--ui-ssrp-ink);
  outline-offset: 2px;
}
.ui-ssrp__btn[disabled] {
  opacity: 0.4;
  cursor: default;
}
.ui-ssrp__btn--play {
  width: 34px;
  height: 34px;
  background: var(--ui-ssrp-ink);
  color: var(--ui-ssrp-ground);
  box-shadow: none;
}
.ui-ssrp__speeds {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: var(--ui-ssrp-pill);
  box-shadow: inset 0 0 0 1px var(--ui-ssrp-line-soft);
}
.ui-ssrp__speed {
  padding: 3px 8px;
  border: 0;
  border-radius: var(--ui-ssrp-pill);
  background: transparent;
  color: var(--ui-ssrp-muted);
  font: inherit;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition:
    background-color var(--ui-ssrp-dur-2) var(--ui-ssrp-ease-out),
    color var(--ui-ssrp-dur-2) var(--ui-ssrp-ease-out);
}
.ui-ssrp__speed:hover {
  color: var(--ui-ssrp-ink);
}
.ui-ssrp__speed[aria-pressed="true"] {
  background: var(--ui-ssrp-ink);
  color: var(--ui-ssrp-ground);
}
.ui-ssrp__speed:focus-visible {
  outline: 2px solid var(--ui-ssrp-ink);
  outline-offset: 1px;
}
.ui-ssrp__spanbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  min-width: 0;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ssrp-muted);
}
.ui-ssrp__span-range,
.ui-ssrp__span-count {
  white-space: nowrap;
}
.ui-ssrp__span-count {
  color: var(--ui-ssrp-ink);
}
.ui-ssrp__hint {
  font-size: 11.5px;
  line-height: 1.35;
}
.ui-ssrp__clear {
  padding: 3px 9px;
  border: 0;
  border-radius: var(--ui-ssrp-pill);
  background: transparent;
  color: var(--ui-ssrp-muted);
  font: inherit;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px var(--ui-ssrp-line-soft);
  transition:
    background-color var(--ui-ssrp-dur-2) var(--ui-ssrp-ease-out),
    color var(--ui-ssrp-dur-2) var(--ui-ssrp-ease-out);
}
.ui-ssrp__clear:hover {
  background: var(--ui-ssrp-hover);
  color: var(--ui-ssrp-ink);
}
.ui-ssrp__clear:focus-visible {
  outline: 2px solid var(--ui-ssrp-ink);
  outline-offset: 2px;
}

/* The step under the playhead. Both layers share one cell, so the swap never shifts the sheet. */
.ui-ssrp__stack {
  display: grid;
}
.ui-ssrp__card {
  grid-area: 1 / 1;
  display: grid;
  gap: 6px;
  padding: 11px 13px;
  border-radius: 12px;
  background: var(--ui-ssrp-panel);
  box-shadow: inset 0 0 0 1px var(--ui-ssrp-line-soft);
}
.ui-ssrp__card:not([data-exiting="true"]) {
  animation: ui-ssrp-card-in var(--ui-ssrp-dur-3) var(--ui-ssrp-ease-out) both;
}
.ui-ssrp__card[data-exiting="true"] {
  animation: ui-ssrp-card-out var(--ui-ssrp-dur-2) var(--ui-ssrp-ease-in) both;
  pointer-events: none;
}
.ui-ssrp__card-top {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}
.ui-ssrp__kind {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ui-ssrp-ink);
  font-weight: 500;
}
.ui-ssrp__kind[data-kind="error"] {
  color: var(--ui-ssrp-danger);
}
.ui-ssrp__kind[data-kind="start"] {
  color: var(--ui-ssrp-muted);
}
.ui-ssrp__actor {
  color: var(--ui-ssrp-muted);
}
.ui-ssrp__card-offset {
  margin-left: auto;
  font-family: var(--ui-ssrp-mono);
  font-variant-numeric: tabular-nums;
  color: var(--ui-ssrp-muted);
}
.ui-ssrp__card-summary {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.45;
}
.ui-ssrp__card[data-kind="start"] .ui-ssrp__card-summary {
  color: var(--ui-ssrp-muted);
}

/* Empty session: the frame stays, the track does not. */
.ui-ssrp__empty {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 26px 18px 30px;
  border-radius: 12px;
  background: var(--ui-ssrp-panel);
  box-shadow: inset 0 0 0 1px var(--ui-ssrp-line-soft);
  text-align: center;
}
.ui-ssrp__empty svg {
  color: var(--ui-ssrp-subtle);
}
.ui-ssrp__empty-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
}
.ui-ssrp__empty-note {
  margin: 0;
  max-width: 36ch;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--ui-ssrp-muted);
}

.ui-ssrp__sr {
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

/* The playhead breathes while the clock runs: ambience, so it never draws attention. */
@keyframes ui-ssrp-beat {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.62; }
}
@keyframes ui-ssrp-card-in {
  from { opacity: 0; transform: translateY(6px); }
}
@keyframes ui-ssrp-card-out {
  to { opacity: 0; transform: translateY(-6px); }
}
@keyframes ui-ssrp-span-in {
  from { opacity: 0; transform: scaleX(0.98); }
}
@keyframes ui-ssrp-fade-in {
  from { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .ui-ssrp *,
  .ui-ssrp *::before,
  .ui-ssrp *::after {
    animation: none;
    transition-duration: 1ms;
    transition-delay: 0ms;
  }
  /* Opacity still carries meaning, so the card keeps a fade and loses only its movement. */
  .ui-ssrp__card:not([data-exiting="true"]) {
    animation: ui-ssrp-fade-in var(--ui-ssrp-dur-1) linear both;
  }
  .ui-ssrp__card[data-exiting="true"] {
    display: none;
  }
  .ui-ssrp[data-state] .ui-ssrp__playhead-dot {
    animation: none;
  }
  .ui-ssrp .ui-ssrp__tick-body {
    transform: none;
  }
}

/* Dark mode: follows a .dark class or data-theme="dark" on any ancestor, e.g. <html>.
   Only the washes and the lift change – the inks already arrive through the tokens. */
:where(.dark, [data-theme="dark"]) .ui-ssrp {
  --ui-ssrp-hover: #ffffff14;
  --ui-ssrp-wash: rgba(244, 236, 228, 0.08);
  --ui-ssrp-shadow: 0 1px 2px #00000059, 0 10px 26px #00000033;
}
`;