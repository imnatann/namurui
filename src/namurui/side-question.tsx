"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/*
 * Side Question: the asides a reader asks with /btw while a turn keeps running. The newest
 * aside sits at the head of the stack, expanded and streaming, while older ones fold to a
 * single line and open on a click. A new card settles in on the spring step, and the caret
 * on a running answer breathes at the ambient step, slow enough to read as waiting rather
 * than as work. Styles are injected below, so no extra files are needed.
 */

export type SideQuestionStatus = "running" | "complete" | "cancelled" | "error" | "interrupted";

export type SideQuestionRecord = {
  /** Stable id from the btw_record frame */
  id: string;
  /** The question the reader asked */
  question: string;
  /** Answer so far; btw_delta appends to this */
  answer: string;
  /** Lifecycle state carried by the latest btw_record */
  status: SideQuestionStatus;
  /** Questions offered under a finished aside */
  followUps?: readonly string[];
};

export type SideQuestionProps = {
  /** Asides in the stack, newest first; the first one is always expanded */
  records?: readonly SideQuestionRecord[];
  /** Called with the trimmed question on submit, on a follow-up, and on "Ask again" */
  onAsk?: (question: string) => void;
  /** Called with the record id when the reader stops a running aside */
  onCancel?: (id: string) => void;
  /** Controlled draft; omit to let the component own the field */
  draft?: string;
  /** Fires on every draft change, including the clear after submit */
  onDraftChange?: (draft: string) => void;
  /** Extra class on the root */
  className?: string;
};

const STATUS_WORD: Record<SideQuestionStatus, string> = {
  running: "Running",
  complete: "Complete",
  cancelled: "Cancelled",
  error: "Error",
  interrupted: "Interrupted",
};

/* Spoken by the live region. The visible word is a label; this is a sentence. */
const STATUS_SAY: Record<SideQuestionStatus, string> = {
  running: "Side question is running",
  complete: "Side question finished",
  cancelled: "Side question cancelled",
  error: "Side question failed",
  interrupted: "Side question was interrupted",
};

/* One glyph per state: a live dot with a ring, a tick, a stop, a cross, a broken line. */
const STATUS_GLYPH: Record<SideQuestionStatus, ReactNode> = {
  running: (
    <svg viewBox="0 0 12 12" width="12" height="12" fill="none" aria-hidden="true">
      <circle
        className="ui-sdq__ring"
        cx="6"
        cy="6"
        r="2.8"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <circle cx="6" cy="6" r="1.55" fill="currentColor" />
    </svg>
  ),
  complete: (
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
      <path d="M2.3 6.3 4.8 8.7 9.7 3.4" />
    </svg>
  ),
  cancelled: (
    <svg viewBox="0 0 12 12" width="12" height="12" fill="none" aria-hidden="true">
      <rect x="3.1" y="3.1" width="5.8" height="5.8" rx="1.2" fill="currentColor" />
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
      <path d="M3.2 3.2 8.8 8.8" />
      <path d="M8.8 3.2 3.2 8.8" />
    </svg>
  ),
  interrupted: (
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
      <path d="M1.5 6h3.1" />
      <path d="M7.4 6h3.1" />
    </svg>
  ),
};

const STOP_GLYPH = (
  <svg viewBox="0 0 12 12" width="11" height="11" fill="none" aria-hidden="true">
    <rect x="3.4" y="3.4" width="5.2" height="5.2" rx="1" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);

const AGAIN_GLYPH = (
  <svg
    viewBox="0 0 12 12"
    width="11"
    height="11"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9.6 5.2A4 4 0 1 0 9.3 8" />
    <path d="M9.8 2.2v3h-3" />
  </svg>
);

/* How close to the head of the stack still counts as following it */
const PIN_SLACK = 4;

/* A layout effect on the client, a passive one during a server render */
const useLayoutIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function SideQuestion({
  records = [],
  onAsk,
  onCancel,
  draft,
  onDraftChange,
  className,
}: SideQuestionProps) {
  const baseId = useId();
  const stackRef = useRef<HTMLUListElement>(null);
  const pinnedRef = useRef(true);
  const metricsRef = useRef<{ height: number; id: string | undefined }>({
    height: 0,
    id: undefined,
  });
  const [ownDraft, setOwnDraft] = useState("");
  const [openIds, setOpenIds] = useState<readonly string[]>([]);
  const [announcement, setAnnouncement] = useState("");

  const text = draft === undefined ? ownDraft : draft;
  const newest = records[0];
  const newestId = newest?.id;
  const newestStatus = newest?.status;

  /* The newest card is the head of the stack, so following it means staying at the top. A
   * reader who has scrolled down keeps their place: the stack opts out of scroll anchoring,
   * and the height a new card added is put back under their cursor instead. */
  useLayoutIso(() => {
    const stack = stackRef.current;
    if (!stack) return;
    const previous = metricsRef.current;
    if (newestId !== undefined && newestId !== previous.id) {
      if (pinnedRef.current) {
        stack.scrollTop = 0;
      } else {
        const grew = stack.scrollHeight - previous.height;
        if (grew > 0) stack.scrollTop += grew;
      }
    }
    metricsRef.current = { height: stack.scrollHeight, id: newestId };
  });

  useEffect(() => {
    if (newestStatus === undefined) {
      setAnnouncement("");
      return;
    }
    setAnnouncement(STATUS_SAY[newestStatus]);
  }, [newestId, newestStatus]);

  const onScroll = () => {
    const stack = stackRef.current;
    if (!stack) return;
    pinnedRef.current = stack.scrollTop <= PIN_SLACK;
  };

  const writeDraft = (next: string) => {
    if (draft === undefined) setOwnDraft(next);
    onDraftChange?.(next);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = text.trim();
    if (!question) return;
    onAsk?.(question);
    writeDraft("");
  };

  const toggle = (id: string) => {
    setOpenIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  /* Arrow keys walk the heads of the stack, which is where a reader moves between asides.
   * The newest head is not a control — it is always open — but it still takes focus. */
  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    const edge = event.key === "Home" || event.key === "End";
    if (step === 0 && !edge) return;
    const stack = stackRef.current;
    if (!stack) return;
    const heads = Array.from(stack.querySelectorAll<HTMLElement>("[data-head]"));
    const index = heads.indexOf(event.currentTarget);
    if (index < 0) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? heads.length - 1
          : (index + step + heads.length) % heads.length;
    heads[next]?.focus();
  };

  const fieldId = `${baseId}-field`;

  return (
    <div className={["ui-sdq", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-side-question" precedence="default">
        {css}
      </style>

      <p className="ui-sdq__live" role="status" aria-live="polite">
        {announcement}
      </p>

      <ul
        className="ui-sdq__stack"
        ref={stackRef}
        tabIndex={0}
        aria-label="Side questions"
        onScroll={onScroll}
      >
        {records.length === 0 ? (
          <li className="ui-sdq__empty">
            Nothing asked aside yet. The running turn is untouched.
          </li>
        ) : null}

        {records.map((record, index) => {
          const isNewest = index === 0;
          const open = isNewest || openIds.includes(record.id);
          const bodyId = `${baseId}-${record.id}`;
          const answer =
            record.answer ||
            (record.status === "running"
              ? "Waiting for the first token"
              : record.status === "error"
                ? "No message came back."
                : "");
          const canAgain = record.status === "cancelled" || record.status === "error";
          const followUps = record.followUps;
          const head = (
            <>
              <span className="ui-sdq__q" title={record.question}>
                {record.question}
              </span>
              <span
                className="ui-sdq__status"
                title={
                  record.status === "interrupted"
                    ? "The run ended before this finished"
                    : undefined
                }
              >
                <span
                  className="ui-sdq__glyph"
                  data-live={record.status === "running" ? "true" : undefined}
                  aria-hidden="true"
                >
                  {STATUS_GLYPH[record.status]}
                </span>
                {STATUS_WORD[record.status]}
              </span>
            </>
          );

          return (
            <li
              key={record.id}
              className="ui-sdq__card"
              data-status={record.status}
              data-newest={isNewest ? "true" : undefined}
              data-open={open ? "true" : undefined}
            >
              {isNewest ? (
                <div className="ui-sdq__head" data-head="true" tabIndex={-1}>
                  {head}
                </div>
              ) : (
                <button
                  type="button"
                  className="ui-sdq__head"
                  data-head="true"
                  aria-expanded={open}
                  aria-controls={open ? bodyId : undefined}
                  onClick={() => toggle(record.id)}
                  onKeyDown={moveFocus}
                >
                  {head}
                </button>
              )}

              {open ? (
                <div className="ui-sdq__body" id={bodyId}>
                  {answer ? (
                    <p
                      className="ui-sdq__answer"
                      data-tone={record.status === "error" ? "error" : undefined}
                    >
                      {record.answer ? (
                        record.answer
                      ) : (
                        <span className="ui-sdq__wait">{answer}</span>
                      )}
                      {record.status === "running" ? (
                        <span className="ui-sdq__caret" aria-hidden="true" />
                      ) : null}
                    </p>
                  ) : null}

                  {record.status === "interrupted" ? (
                    <p className="ui-sdq__note">
                      <span className="ui-sdq__note-glyph" aria-hidden="true">
                        {STATUS_GLYPH.interrupted}
                      </span>
                      The run ended before this finished
                    </p>
                  ) : null}

                  {record.status !== "running" && followUps && followUps.length > 0 && onAsk ? (
                    <div className="ui-sdq__follow" role="group" aria-label="Follow-up questions">
                      {followUps.map((followUp) => (
                        <button
                          key={followUp}
                          type="button"
                          className="ui-sdq__chip"
                          onClick={() => onAsk?.(followUp)}
                        >
                          {followUp}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {record.status === "running" && onCancel ? (
                    <div className="ui-sdq__actions">
                      <button
                        type="button"
                        className="ui-sdq__act"
                        onClick={() => onCancel?.(record.id)}
                      >
                        <span className="ui-sdq__act-glyph" aria-hidden="true">
                          {STOP_GLYPH}
                        </span>
                        Cancel
                      </button>
                    </div>
                  ) : null}

                  {canAgain && onAsk ? (
                    <div className="ui-sdq__actions">
                      <button
                        type="button"
                        className="ui-sdq__act"
                        onClick={() => onAsk?.(record.question)}
                      >
                        <span className="ui-sdq__act-glyph" aria-hidden="true">
                          {AGAIN_GLYPH}
                        </span>
                        Ask again
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <form className="ui-sdq__ask" onSubmit={submit}>
        <label className="ui-sdq__live" htmlFor={fieldId}>
          Ask a side question
        </label>
        <input
          id={fieldId}
          className="ui-sdq__field"
          value={text}
          onChange={(event) => writeDraft(event.target.value)}
          placeholder="Ask a side question — the turn keeps going"
          autoComplete="off"
        />
        <button type="submit" className="ui-sdq__send" disabled={text.trim().length === 0}>
          Ask
        </button>
      </form>
    </div>
  );
}

const css = /* css */ `
.ui-sdq {
  /* Knobs. Override any of these on .ui-sdq to retheme the aside stack in a host. */
  --ui-sdq-ink: var(--text, #1a1410);
  --ui-sdq-muted: var(--text-muted, #6f625a);
  --ui-sdq-panel: var(--panel, #fffdfb);
  --ui-sdq-card: var(--card, #ffffff);
  --ui-sdq-field: var(--panel, #fffdfb);
  --ui-sdq-line: var(--border, #e8e0d7);
  --ui-sdq-edge: var(--border-soft, #1a14101a);
  --ui-sdq-wash: var(--muted-bg, #7a4a1c0a);
  --ui-sdq-accent: var(--accent, #c2410c);
  --ui-sdq-ok: var(--success, #1a7a4a);
  --ui-sdq-warn: var(--warning, #9a6410);
  --ui-sdq-danger: var(--danger, #b3261e);
  --ui-sdq-focus: var(--accent, #c2410c);
  --ui-sdq-ease: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-sdq-ease-soft: var(--nm-ease-soft, cubic-bezier(0.4, 0, 0.2, 1));
  --ui-sdq-spring: var(--nm-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  --ui-sdq-dur: var(--nm-dur-2, 160ms);
  --ui-sdq-dur-card: var(--nm-dur-3, 240ms);
  --ui-sdq-dur-caret: var(--nm-dur-6, 1100ms);
  --ui-sdq-max: 340px;
  /* The tone carries the state; the word and glyph beside it say the same thing, so a
   * status is never colour alone. */
  --ui-sdq-tone: var(--ui-sdq-muted);

  position: relative;
  box-sizing: border-box;
  display: grid;
  gap: 10px;
  width: 100%;
  padding: 12px;
  background: var(--ui-sdq-panel);
  border-radius: var(--radius-card, 16px);
  box-shadow: inset 0 0 0 1px var(--ui-sdq-line);
  color: var(--ui-sdq-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12.5px;
  line-height: 19px;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
}
.ui-sdq *,
.ui-sdq *::before,
.ui-sdq *::after {
  box-sizing: border-box;
}
.ui-sdq p {
  margin: 0;
}
:where(.ui-sdq) button {
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
:where(.ui-sdq) svg {
  display: block;
}

/* One tone per state. The finished states use the semantic trio and cancelled stays muted.
 * Running is the live aside, so it takes the ember accent — but only at the head of the
 * stack, because one surface carries exactly one live marker. */
.ui-sdq__card[data-status="running"] {
  --ui-sdq-tone: var(--ui-sdq-muted);
}
.ui-sdq__card[data-status="running"][data-newest="true"] {
  --ui-sdq-tone: var(--ui-sdq-accent);
}
.ui-sdq__card[data-status="complete"] {
  --ui-sdq-tone: var(--ui-sdq-ok);
}
.ui-sdq__card[data-status="cancelled"] {
  --ui-sdq-tone: var(--ui-sdq-muted);
}
.ui-sdq__card[data-status="error"] {
  --ui-sdq-tone: var(--ui-sdq-danger);
}
.ui-sdq__card[data-status="interrupted"] {
  --ui-sdq-tone: var(--ui-sdq-warn);
}

/* Stack ------------------------------------------------------------------- */
.ui-sdq__stack {
  display: grid;
  gap: 6px;
  max-height: var(--ui-sdq-max, 340px);
  margin: 0;
  padding: 4px;
  overflow-y: auto;
  overscroll-behavior: contain;
  /* Anchoring is off because this stack prepends: the follow rule decides where the reader
   * lands, and the browser must not move them first. */
  overflow-anchor: none;
  scrollbar-width: thin;
  scrollbar-color: var(--ui-sdq-line) transparent;
  list-style: none;
  border-radius: var(--radius-preview, 12px);
}
.ui-sdq__stack:focus-visible {
  outline: 2px solid var(--ui-sdq-focus);
  outline-offset: 2px;
}
.ui-sdq__empty {
  padding: 16px 10px;
  color: var(--ui-sdq-muted);
  font-size: 12px;
  line-height: 18px;
  text-align: center;
}

/* Cards ------------------------------------------------------------------- */
.ui-sdq__card {
  position: relative;
  overflow: hidden;
  background: var(--ui-sdq-card);
  border-radius: var(--radius-preview, 12px);
  box-shadow: inset 0 0 0 1px var(--ui-sdq-edge);
  animation: ui-sdq-card-in var(--ui-sdq-dur-card) var(--ui-sdq-ease);
}
/* The live card carries the tone as a rail, so it reads as the head of the stack
 * without a second border. */
.ui-sdq__card[data-newest="true"] {
  box-shadow:
    inset 2px 0 0 0 var(--ui-sdq-tone),
    inset 0 0 0 1px var(--ui-sdq-line);
  animation-name: ui-sdq-card-pop;
  animation-timing-function: var(--ui-sdq-spring);
}
@keyframes ui-sdq-card-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes ui-sdq-card-pop {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.ui-sdq__head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  text-align: left;
}
.ui-sdq__card[data-newest="true"] .ui-sdq__head {
  padding: 10px 12px 6px;
}
button.ui-sdq__head {
  transition: background-color var(--ui-sdq-dur) var(--ui-sdq-ease);
}
button.ui-sdq__head:hover {
  background: var(--ui-sdq-wash);
}
button.ui-sdq__head:focus-visible {
  outline: 2px solid var(--ui-sdq-focus);
  outline-offset: -2px;
  border-radius: 10px;
}
.ui-sdq__q {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--ui-sdq-ink);
  font-size: 12.5px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-sdq__card[data-open="true"] .ui-sdq__q {
  white-space: normal;
  overflow-wrap: anywhere;
}
.ui-sdq__status {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
  height: 18px;
  padding: 0 6px 0 5px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-sdq-wash);
  color: var(--ui-sdq-tone);
  font-size: 10.5px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
  transition: color var(--ui-sdq-dur) var(--ui-sdq-ease);
}
.ui-sdq__glyph {
  display: grid;
  flex: none;
  place-items: center;
  width: 12px;
  height: 12px;
}
/* The ring on a running glyph is ambient: it widens and fades, never demands a look. */
.ui-sdq__glyph[data-live="true"] .ui-sdq__ring {
  transform-box: fill-box;
  transform-origin: center;
  animation: ui-sdq-ring var(--ui-sdq-dur-caret) var(--ui-sdq-ease-soft) infinite;
}
@keyframes ui-sdq-ring {
  0% {
    transform: scale(0.62);
    opacity: 0.75;
  }
  70%,
  100% {
    transform: scale(1.55);
    opacity: 0;
  }
}

/* Body -------------------------------------------------------------------- */
.ui-sdq__body {
  display: grid;
  gap: 8px;
  padding: 0 12px 12px;
  animation: ui-sdq-body-in var(--ui-sdq-dur-card) var(--ui-sdq-ease);
}
@keyframes ui-sdq-body-in {
  from {
    opacity: 0;
    transform: translateY(-3px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.ui-sdq__answer {
  color: var(--ui-sdq-ink);
  font-size: 12.5px;
  line-height: 19px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.ui-sdq__answer[data-tone="error"] {
  padding-left: 8px;
  box-shadow: inset 2px 0 0 var(--ui-sdq-danger);
}
.ui-sdq__card[data-status="cancelled"] .ui-sdq__answer {
  opacity: 0.55;
  transition: opacity var(--ui-sdq-dur) var(--ui-sdq-ease);
}
.ui-sdq__card[data-status="cancelled"] .ui-sdq__q {
  color: var(--ui-sdq-muted);
}
.ui-sdq__wait {
  color: var(--ui-sdq-muted);
}
.ui-sdq__caret {
  display: inline-block;
  width: 2px;
  height: 13px;
  margin-left: 2px;
  vertical-align: -2px;
  border-radius: 1px;
  background: var(--ui-sdq-tone);
  animation: ui-sdq-caret var(--ui-sdq-dur-caret) var(--ui-sdq-ease-soft) infinite alternate;
}
@keyframes ui-sdq-caret {
  from {
    opacity: 1;
  }
  to {
    opacity: 0.18;
  }
}

/* The one status a reader would misread as a failure gets a sentence, not just a word. */
.ui-sdq__note {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--ui-sdq-wash);
  color: var(--ui-sdq-warn);
  font-size: 11.5px;
  line-height: 16px;
}
.ui-sdq__note-glyph {
  display: grid;
  flex: none;
  place-items: center;
  width: 12px;
  height: 12px;
  margin-top: 2px;
}

.ui-sdq__follow {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.ui-sdq__chip {
  max-width: 100%;
  padding: 4px 8px;
  border-radius: 8px;
  background: var(--ui-sdq-wash);
  color: var(--ui-sdq-muted);
  font-size: 11.5px;
  line-height: 16px;
  text-align: left;
  overflow-wrap: anywhere;
  transition:
    color var(--ui-sdq-dur) var(--ui-sdq-ease),
    background-color var(--ui-sdq-dur) var(--ui-sdq-ease);
}
.ui-sdq__chip:hover {
  color: var(--ui-sdq-ink);
  background: var(--ui-sdq-line);
}
.ui-sdq__chip:focus-visible {
  outline: 2px solid var(--ui-sdq-focus);
  outline-offset: 1px;
}

.ui-sdq__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ui-sdq__act {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 9px;
  border-radius: 7px;
  box-shadow: inset 0 0 0 1px var(--ui-sdq-line);
  color: var(--ui-sdq-muted);
  font-size: 11.5px;
  font-weight: 500;
  line-height: 16px;
  transition:
    color var(--ui-sdq-dur) var(--ui-sdq-ease),
    background-color var(--ui-sdq-dur) var(--ui-sdq-ease);
}
.ui-sdq__act:hover {
  background: var(--ui-sdq-wash);
  color: var(--ui-sdq-ink);
}
.ui-sdq__act:focus-visible {
  outline: 2px solid var(--ui-sdq-focus);
  outline-offset: 1px;
}
.ui-sdq__act-glyph {
  display: grid;
  place-items: center;
  width: 11px;
  height: 11px;
}

/* Ask field --------------------------------------------------------------- */
.ui-sdq__ask {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ui-sdq__field {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: var(--ui-sdq-field);
  box-shadow: inset 0 0 0 1px var(--ui-sdq-line);
  color: var(--ui-sdq-ink);
  font: inherit;
  font-size: 12.5px;
}
.ui-sdq__field::placeholder {
  color: var(--ui-sdq-muted);
}
.ui-sdq__field:focus {
  outline: 2px solid var(--ui-sdq-focus);
  outline-offset: 1px;
}
.ui-sdq__send {
  flex: none;
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  background: var(--ui-sdq-wash);
  box-shadow: inset 0 0 0 1px var(--ui-sdq-line);
  color: var(--ui-sdq-ink);
  font-size: 12px;
  font-weight: 500;
  transition:
    opacity var(--ui-sdq-dur) var(--ui-sdq-ease),
    background-color var(--ui-sdq-dur) var(--ui-sdq-ease);
}
.ui-sdq__send:disabled {
  opacity: 0.4;
  cursor: default;
}
.ui-sdq__send:not(:disabled):hover {
  background: var(--ui-sdq-line);
}
.ui-sdq__send:focus-visible {
  outline: 2px solid var(--ui-sdq-focus);
  outline-offset: 1px;
}

/* Spoken only: the stack announces the head card's state, not every token. */
.ui-sdq__live {
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

:where(.dark, [data-theme="dark"]) .ui-sdq {
  --ui-sdq-ink: var(--text, #f4ece4);
  --ui-sdq-muted: var(--text-muted, #a2958a);
  --ui-sdq-panel: var(--panel, #1a1512);
  --ui-sdq-card: var(--card, #201a15);
  --ui-sdq-field: var(--preview, #26201a);
  --ui-sdq-line: var(--border, #33291f);
  --ui-sdq-edge: var(--border-soft, #ffffff12);
  --ui-sdq-wash: var(--muted-bg, #ffffff0d);
  --ui-sdq-accent: var(--accent, #ff6b35);
  --ui-sdq-ok: var(--success, #4f9d6e);
  --ui-sdq-warn: var(--warning, #d99530);
  --ui-sdq-danger: var(--danger, #e2544a);
  --ui-sdq-focus: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  .ui-sdq__card,
  .ui-sdq__body,
  .ui-sdq__caret,
  .ui-sdq__glyph[data-live="true"] .ui-sdq__ring,
  .ui-sdq__status,
  .ui-sdq__answer,
  .ui-sdq__chip,
  .ui-sdq__act,
  .ui-sdq__field,
  .ui-sdq__send,
  button.ui-sdq__head {
    animation: none;
    transition-duration: 1ms;
  }
  .ui-sdq__caret {
    opacity: 1;
  }
  .ui-sdq__glyph[data-live="true"] .ui-sdq__ring {
    opacity: 0.45;
    transform: none;
  }
}
`;
