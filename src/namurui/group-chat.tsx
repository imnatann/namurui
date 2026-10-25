"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/*
 * Group Chat – one shared thread where several agents and one human talk, in a single
 * self-contained file.
 *
 * Every speaker carries a glyph and a name, so four of them stay apart without a colour code:
 * the palette has one accent and it is spent on the live moment, not on identity. Consecutive
 * messages from the same speaker fold into a run with the speaker's glyph and role printed once,
 * any message can be answered, and the answer carries a quoted reference that scrolls back to
 * the line it quotes. The composer addresses one participant at a time through an @ list, and
 * the roster beside the thread shows who is present and whose chip is currently lifted because
 * they are composing.
 *
 * A new message rises and fades in on --nm-ease-out, and the thread follows it only when the
 * reader was already at the bottom, so scrolling up stops the auto-scroll the way a chat should.
 * The composer's reply reference slides in above it, and a composing participant's chip breathes
 * upward on --nm-ease-soft. The styles are injected below, so no extra files are needed.
 */

/** The glyph a participant is drawn with; it carries their identity, not their colour. */
export type GroupChatGlyph = "steps" | "sweep" | "blocks" | "person";

/** Whether a participant is an agent or the person driving the thread. */
export type GroupChatKind = "agent" | "human";

/** Who is around: present, away, or writing right now. */
export type GroupChatPresence = "present" | "away";

/** One speaker in the thread. */
export type GroupChatParticipant = {
  id: string;
  /** The name printed once above each run */
  name: string;
  /** One line of role under the name in the roster, e.g. "Sources" */
  role: string;
  kind: GroupChatKind;
  glyph: GroupChatGlyph;
  /** Left out, the participant counts as present */
  presence?: GroupChatPresence;
  /** Lifts this participant's chip in the roster as an ambient loop */
  composing?: boolean;
};

/** One message in the thread. */
export type GroupChatMessage = {
  id: string;
  /** The id of the participant who wrote it */
  author: string;
  text: string;
  /** Timestamp on the run's head, e.g. "14:05" */
  time: string;
  /** The id of the message this one answers – drawn as a quoted reference */
  replyTo?: string;
};

export type GroupChatProps = {
  /** Every speaker, in roster order, the human among them */
  participants: GroupChatParticipant[];
  /** The starting thread; messages the human sends are appended to it. Pass a new array to feed
   * the thread from outside */
  messages: GroupChatMessage[];
  /** The participant whose drafts come from the composer, marked "You" */
  selfId?: string;
  /** The draft (controlled); left out, the composer holds it */
  draft?: string;
  /** Called with the whole draft on every keystroke */
  onDraftChange?: (draft: string) => void;
  /** Called with the message the human sent, after it lands in the thread */
  onSend?: (message: GroupChatMessage) => void;
  /** Heading over the thread */
  title?: string;
  /** Heading over the roster */
  rosterTitle?: string;
  /** Placeholder in the composer */
  placeholder?: string;
  className?: string;
};

export function GroupChat({
  participants,
  messages,
  selfId = "you",
  draft,
  onDraftChange,
  onSend,
  title = "Planning thread",
  rosterTitle = "In this thread",
  placeholder = "Message the thread",
  className,
}: GroupChatProps) {
  const base = useId();
  const [thread, setThread] = useState(messages);
  const source = useRef(messages);
  const [innerDraft, setInnerDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [addressedTo, setAddressedTo] = useState<string | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [notice, setNotice] = useState("Thread open");

  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const pinned = useRef(true);
  const counted = useRef(messages.length);
  const uid = useRef(0);
  const flashTimer = useRef<number | null>(null);

  const draftValue = draft ?? innerDraft;
  const setDraftValue = (next: string) => {
    if (draft === undefined) setInnerDraft(next);
    onDraftChange?.(next);
  };

  const people = useMemo(() => {
    const table: Record<string, GroupChatParticipant> = {};
    for (const person of participants) table[person.id] = person;
    return table;
  }, [participants]);
  const order = useMemo(() => {
    const table: Record<string, number> = {};
    participants.forEach((person, index) => {
      table[person.id] = index;
    });
    return table;
  }, [participants]);
  const byMessage = useMemo(() => {
    const table: Record<string, GroupChatMessage> = {};
    for (const message of thread) table[message.id] = message;
    return table;
  }, [thread]);

  /* Runs of consecutive messages by one speaker: the speaker is printed once per run. */
  const runs = useMemo(() => {
    const out: { author: string; start: number; items: GroupChatMessage[] }[] = [];
    let at = 0;
    for (const message of thread) {
      const last = out[out.length - 1];
      if (last && last.author === message.author) last.items.push(message);
      else out.push({ author: message.author, start: at, items: [message] });
      at += 1;
    }
    return out;
  }, [thread]);

  /* @-mentions are drawn from the names the thread actually has, so no name is highlighted by luck. */
  const mention = useMemo(() => {
    const names = participants
      .filter((p) => p.id !== selfId)
      .map((p) => p.name)
      .sort((a, b) => b.length - a.length)
      .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return names.length > 0 ? new RegExp(`@(?:${names.join("|")})`, "g") : null;
  }, [participants, selfId]);

  /* A caller handing in a fresh array owns the thread; the same array means the composer appends. */
  useEffect(() => {
    if (source.current === messages) return;
    source.current = messages;
    setThread(messages);
  }, [messages]);

  /* Whether the reader is at the bottom is measured, never assumed – it decides the auto-scroll. */
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const read = () => {
      pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 56;
    };
    read();
    el.addEventListener("scroll", read, { passive: true });
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", read);
      observer.disconnect();
    };
  }, []);

  /* The open thread starts at its newest line. */
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
    pinned.current = true;
  }, []);

  /* A message that arrives follows the reader down only if the reader never left the bottom. */
  useEffect(() => {
    if (thread.length <= counted.current) {
      counted.current = thread.length;
      return;
    }
    counted.current = thread.length;
    const el = scroller.current;
    if (!el || !pinned.current) return;
    const still =
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: still ? "auto" : "smooth" });
  }, [thread.length]);

  useEffect(
    () => () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    },
    [],
  );

  const jumpTo = (id: string) => {
    const el = scroller.current;
    if (!el) return;
    const target = el.querySelector<HTMLElement>(`[data-mid="${id.replace(/["\\]/g, "")}"]`);
    if (!target) return;
    const still =
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
    setFlash(id);
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 1200);
  };

  const startReply = (message: GroupChatMessage) => {
    setReplyTo(message.id);
    setNotice(`Replying to ${people[message.author]?.name ?? "the thread"}`);
    field.current?.focus();
  };

  const skipReply = () => {
    setReplyTo(null);
    setNotice("Reply skipped");
    field.current?.focus();
  };

  const pickMention = (id: string) => {
    setAddressedTo(id);
    setMentionOpen(false);
    setNotice(`Addressed to ${people[id]?.name ?? "a participant"}`);
    field.current?.focus();
  };

  const send = () => {
    const body = draftValue.trim();
    if (!body) return;
    const answered = replyTo ? byMessage[replyTo] : undefined;
    const answeredBy = answered ? people[answered.author] : undefined;
    const addressed = addressedTo ? people[addressedTo] : undefined;
    uid.current += 1;
    const now = new Date();
    const message: GroupChatMessage = {
      id: `sent-${uid.current}`,
      author: selfId,
      text: addressed ? `@${addressed.name} ${body}` : body,
      time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      replyTo: answered ? answered.id : undefined,
    };
    setThread((all) => [...all, message]);
    onSend?.(message);
    setDraftValue("");
    setReplyTo(null);
    setAddressedTo(null);
    setMentionOpen(false);
    setNotice(
      answeredBy
        ? `Sent a reply to ${answeredBy.name}`
        : addressed
          ? `Sent, addressed to ${addressed.name}`
          : "Sent to the thread",
    );
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    send();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      if (mentionOpen) {
        setMentionOpen(false);
        return;
      }
      if (replyTo) {
        skipReply();
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  const body = (text: string): ReactNode => {
    if (!mention) return text;
    const nodes: ReactNode[] = [];
    let at = 0;
    for (const hit of text.matchAll(mention)) {
      const index = hit.index ?? 0;
      if (index > at) nodes.push(text.slice(at, index));
      nodes.push(
        <mark key={`${index}-${hit[0]}`} className="ui-grpc__ping">
          {hit[0]}
        </mark>,
      );
      at = index + hit[0].length;
    }
    if (at < text.length) nodes.push(text.slice(at));
    return nodes.length > 0 ? nodes : text;
  };

  const quoting = replyTo ? byMessage[replyTo] : undefined;
  const quotingBy = quoting ? people[quoting.author] : undefined;
  const addressed = addressedTo ? people[addressedTo] : undefined;
  const mode = replyTo ? "replying" : addressedTo ? "addressing" : "idle";

  return (
    <div className={["ui-grpc", className].filter(Boolean).join(" ")} data-state={mode}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-group-chat" precedence="default">
        {css}
      </style>

      <div className="ui-grpc__frame">
        <section className="ui-grpc__thread" aria-labelledby={`${base}-thread`}>
          <header className="ui-grpc__head">
            <h3 className="ui-grpc__title" id={`${base}-thread`}>
              {title}
            </h3>
            <span className="ui-grpc__count">
              {participants.length} participants · {thread.length} messages
            </span>
          </header>

          <div className="ui-grpc__scroll" ref={scroller}>
            {thread.length === 0 ? (
              <p className="ui-grpc__empty">Nothing said yet. Open with the thing you need.</p>
            ) : (
              <ol className="ui-grpc__list">
                {runs.map((run) => {
                  const speaker = people[run.author];
                  const tint = ((order[run.author] ?? 0) % 3) + 1;
                  const head = run.items[run.items.length - 1];
                  return (
                    <li
                      key={`${run.author}-${run.items[0].id}`}
                      className="ui-grpc__run"
                      data-tint={String(tint)}
                      data-kind={speaker?.kind ?? "agent"}
                    >
                      <div className="ui-grpc__speaker">
                        <span className="ui-grpc__avatar" aria-hidden="true">
                          <Glyph name={speaker?.glyph ?? "steps"} />
                        </span>
                        <span className="ui-grpc__from">{speaker?.name ?? run.author}</span>
                        {run.author === selfId && <span className="ui-grpc__you">You</span>}
                        <span className="ui-grpc__role">{speaker?.role}</span>
                        <span className="ui-grpc__time">{head.time}</span>
                      </div>

                      {run.items.map((message, index) => {
                        const quoted = message.replyTo ? byMessage[message.replyTo] : undefined;
                        const quotedBy = quoted ? people[quoted.author] : undefined;
                        const step = run.start + index;
                        return (
                          <article
                            key={message.id}
                            className="ui-grpc__msg"
                            data-mid={message.id}
                            data-self={message.author === selfId ? "true" : undefined}
                            data-armed={replyTo === message.id ? "true" : undefined}
                            data-flash={flash === message.id ? "true" : undefined}
                            style={
                              step < 6
                                ? { animationDelay: `calc(var(--nm-stagger, 45ms) * ${step})` }
                                : undefined
                            }
                          >
                            {quoted && quotedBy && (
                              <button
                                type="button"
                                className="ui-grpc__cite"
                                onClick={() => jumpTo(quoted.id)}
                                aria-label={`Show the message from ${quotedBy.name} this answers`}
                              >
                                <span className="ui-grpc__cite-head">
                                  <Glyph name={quotedBy.glyph} />
                                  <span className="ui-grpc__cite-name">{quotedBy.name}</span>
                                </span>
                                <span className="ui-grpc__cite-text">{excerpt(quoted.text)}</span>
                              </button>
                            )}
                            <p className="ui-grpc__text">{body(message.text)}</p>
                            <span className="ui-grpc__acts">
                              <button
                                type="button"
                                className="ui-grpc__reply-btn"
                                onClick={() => startReply(message)}
                                aria-label={`Reply to ${speaker?.name ?? "this message"}`}
                              >
                                <Glyph name="reply" />
                                Reply
                              </button>
                            </span>
                          </article>
                        );
                      })}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </section>

        <aside className="ui-grpc__roster" aria-labelledby={`${base}-roster`}>
          <h4 className="ui-grpc__roster-title" id={`${base}-roster`}>
            {rosterTitle}
          </h4>
          <ul className="ui-grpc__people">
            {participants.map((person, index) => {
              const writing =
                person.composing === true || (person.id === selfId && draftValue.trim().length > 0);
              const state = writing
                ? "composing"
                : person.presence === "away"
                  ? "away"
                  : "present";
              return (
                <li
                  key={person.id}
                  className="ui-grpc__person"
                  data-tint={String((index % 3) + 1)}
                  data-kind={person.kind}
                  data-state={state}
                  data-composing={writing ? "true" : undefined}
                >
                  <span className="ui-grpc__avatar" aria-hidden="true">
                    <Glyph name={person.glyph} />
                  </span>
                  <span className="ui-grpc__who">
                    <span className="ui-grpc__name">{person.name}</span>
                    {person.id === selfId && <span className="ui-grpc__you">You</span>}
                  </span>
                  <span className="ui-grpc__role">{person.role}</span>
                  <span className="ui-grpc__state">
                    <Glyph name={writing ? "typing" : person.presence === "away" ? "ring" : "dot"} />
                    <span className="ui-grpc__state-label">{state}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="ui-grpc__dock">
          {quoting && quotingBy && (
            <div className="ui-grpc__quoting">
              <span className="ui-grpc__quoting-head">
                <Glyph name={quotingBy.glyph} />
                Replying to {quotingBy.name}
              </span>
              <span className="ui-grpc__quoting-text">{excerpt(quoting.text)}</span>
              <button
                type="button"
                className="ui-grpc__drop"
                onClick={skipReply}
                aria-label="Skip this reply"
              >
                <Glyph name="close" />
              </button>
            </div>
          )}

          <form className="ui-grpc__composer" onSubmit={submit}>
            <div className="ui-grpc__lead">
              <label className="ui-grpc__sr" htmlFor={`${base}-field`}>
                {placeholder}
              </label>
              {addressed && (
                <span className="ui-grpc__addressed">
                  <Glyph name={addressed.glyph} />
                  <span className="ui-grpc__addressed-label">To {addressed.name}</span>
                  <button
                    type="button"
                    className="ui-grpc__drop ui-grpc__drop--tight"
                    onClick={() => setAddressedTo(null)}
                    aria-label={`Stop addressing ${addressed.name}`}
                  >
                    <Glyph name="close" />
                  </button>
                </span>
              )}
              <textarea
                className="ui-grpc__field"
                id={`${base}-field`}
                ref={field}
                rows={2}
                value={draftValue}
                placeholder={placeholder}
                onChange={(event) => setDraftValue(event.target.value)}
                onKeyDown={onKeyDown}
              />
            </div>

            <div className="ui-grpc__tools">
              <button
                type="button"
                className="ui-grpc__icon-btn"
                aria-expanded={mentionOpen}
                aria-haspopup="listbox"
                aria-label="Address one participant"
                onClick={() => setMentionOpen((open) => !open)}
              >
                <Glyph name="mention" />
              </button>
              <button
                type="submit"
                className="ui-grpc__send"
                data-ready={draftValue.trim().length > 0 ? "true" : undefined}
                disabled={draftValue.trim().length === 0}
                aria-label="Send to the thread"
              >
                <Glyph name="send" />
              </button>
            </div>

            {mentionOpen && (
              <div className="ui-grpc__mentions">
                <p className="ui-grpc__mentions-title" id={`${base}-address`}>
                  Address
                </p>
                <div className="ui-grpc__options" role="listbox" aria-labelledby={`${base}-address`}>
                  {participants
                    .filter((person) => person.id !== selfId)
                    .map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        role="option"
                        aria-selected={addressedTo === person.id}
                        className="ui-grpc__option"
                        onClick={() => pickMention(person.id)}
                      >
                        <span className="ui-grpc__avatar" aria-hidden="true">
                          <Glyph name={person.glyph} />
                        </span>
                        <span className="ui-grpc__option-text">
                          <span className="ui-grpc__name">{person.name}</span>
                          <span className="ui-grpc__role">{person.role}</span>
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      <p className="ui-grpc__sr" role="status" aria-live="polite">
        {notice}
      </p>
    </div>
  );
}

/* ---------- Glyphs ---------- */

type Icon =
  | GroupChatGlyph
  | "reply"
  | "close"
  | "send"
  | "mention"
  | "dot"
  | "ring"
  | "typing";

function Glyph({ name }: { name: Icon }) {
  return (
    <svg
      className="ui-grpc__glyph"
      viewBox="0 0 14 14"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {glyphs[name]}
    </svg>
  );
}

const glyphs: Record<Icon, ReactNode> = {
  /* A plan: three steps descending a spine */
  steps: <path d="M2.1 3.4h3.6M2.1 3.4v3.4h4.4M6.5 6.8v3.6h4.5" />,
  /* Reading: a scan frame with a sweep through it */
  sweep: (
    <>
      <path d="M2 4.5V2h2.6M12 4.5V2H9.4M2 9.5V12h2.6M12 9.5V12H9.4" />
      <path d="M4.4 9.7 9.6 4.3" />
    </>
  ),
  /* Building: two blocks, one set across the other */
  blocks: (
    <>
      <rect x="1.7" y="1.9" width="5.8" height="5.8" rx="1.4" />
      <rect x="6.5" y="6.3" width="5.8" height="5.8" rx="1.4" />
    </>
  ),
  /* The human: head and shoulders */
  person: (
    <>
      <circle cx="7" cy="4.7" r="2.5" />
      <path d="M2.5 12.1c0-2.4 2-4.1 4.5-4.1s4.5 1.7 4.5 4.1" />
    </>
  ),
  reply: (
    <>
      <path d="M3.4 5.6h6.1a2.3 2.3 0 0 1 2.3 2.3v1.7" />
      <path d="M5.8 3.2 3.4 5.6l2.4 2.4" />
    </>
  ),
  close: <path d="M4.3 4.3 9.7 9.7M9.7 4.3 4.3 9.7" />,
  send: (
    <>
      <path d="M7 11.8V2.6" />
      <path d="M3.5 6.1 7 2.6l3.5 3.5" />
    </>
  ),
  mention: (
    <>
      <circle cx="6.6" cy="7" r="2.5" />
      <path d="M9.1 7v1.2a1.7 1.7 0 0 0 3.4 0V7A5.9 5.9 0 1 0 9.9 11.9" />
    </>
  ),
  dot: <circle cx="7" cy="7" r="3" fill="currentColor" stroke="none" />,
  ring: (
    <>
      <circle cx="7" cy="7" r="3.2" />
      <path d="M3.6 7h6.8" />
    </>
  ),
  typing: <path d="M3 11V8.6M7 11V6.4M11 11V4.2" />,
};

const excerpt = (text: string) => {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > 92 ? `${line.slice(0, 91)}…` : line;
};

/* ---------- Styles ---------- */

const css = /* css */ `
/* Every knob below can be overridden by a consumer on .ui-grpc; each falls back to the NamurUI
 * token when the host provides one and to a literal Ember value when it does not. */
.ui-grpc {
  --ui-grpc-ink: var(--text, #1a1410);
  --ui-grpc-muted: var(--text-muted, #6f625a);
  --ui-grpc-subtle: var(--text-subtle, #1a141066);
  --ui-grpc-card: var(--card, #ffffff);
  --ui-grpc-panel: var(--panel, #fffdfb);
  --ui-grpc-well: var(--preview, #fdfaf7);
  --ui-grpc-line: var(--border, #e8e0d7);
  --ui-grpc-line-soft: var(--border-soft, #1a14101a);
  --ui-grpc-accent: var(--accent, #c2410c);
  --ui-grpc-accent-hover: var(--accent-hover, #9a3412);
  --ui-grpc-accent-soft: var(--accent-soft, #c2410c1a);
  --ui-grpc-on-accent: var(--accent-fg, #fffdfb);
  --ui-grpc-pop: var(--shadow-pop, 0 10px 30px rgba(26, 20, 16, 0.14), 0 2px 8px rgba(26, 20, 16, 0.08));
  --ui-grpc-tint-1: #efe6dc;
  --ui-grpc-tint-2: #e6dccf;
  --ui-grpc-tint-3: #dcd1c2;
  --ui-grpc-radius: var(--radius-card, 16px);
  --ui-grpc-radius-chip: var(--radius-preview, 12px);
  --ui-grpc-pill: var(--radius-pill, 999px);
  --ui-grpc-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-grpc-ease-soft: var(--nm-ease-soft, cubic-bezier(0.4, 0, 0.2, 1));
  --ui-grpc-dur-1: var(--nm-dur-1, 90ms);
  --ui-grpc-dur-2: var(--nm-dur-2, 160ms);
  --ui-grpc-dur-3: var(--nm-dur-3, 240ms);
  --ui-grpc-dur-6: var(--nm-dur-6, 1100ms);

  position: relative;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  container-type: inline-size;
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  line-height: 20px;
  letter-spacing: -0.01em;
  color: var(--ui-grpc-ink);
  text-align: left;
  -webkit-font-smoothing: antialiased;
}
.ui-grpc *,
.ui-grpc *::before,
.ui-grpc *::after { box-sizing: border-box; }
.ui-grpc p,
.ui-grpc h3,
.ui-grpc h4,
.ui-grpc ul,
.ui-grpc li { margin: 0; padding: 0; }
.ui-grpc ul { list-style: none; }
.ui-grpc button,
.ui-grpc textarea { font: inherit; color: inherit; letter-spacing: inherit; }
.ui-grpc button { border: 0; background: none; cursor: pointer; }
.ui-grpc svg { display: block; }
.ui-grpc button:focus-visible { outline: 2px solid var(--ui-grpc-accent); outline-offset: 2px; }
.ui-grpc textarea:focus-visible { outline: 2px solid var(--ui-grpc-accent); outline-offset: -3px; border-radius: 10px; }

.ui-grpc__glyph { width: 14px; height: 14px; flex: none; }

.ui-grpc__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* ---------- Frame ---------- */

.ui-grpc__frame {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 202px;
  grid-template-areas: "thread roster" "dock dock";
  gap: 12px;
}

/* ---------- Thread ---------- */

.ui-grpc__thread {
  grid-area: thread;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: clamp(248px, 42vh, 392px);
  overflow: hidden;
  border-radius: var(--ui-grpc-radius);
  background: var(--ui-grpc-well);
  box-shadow: inset 0 0 0 1px var(--ui-grpc-line);
}
.ui-grpc__head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 9px 13px 10px;
  box-shadow: inset 0 -1px 0 var(--ui-grpc-line-soft);
}
.ui-grpc__title { font-size: 12.5px; font-weight: 600; }
.ui-grpc__count { font-size: 11.5px; color: var(--ui-grpc-muted); }
.ui-grpc__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  padding: 12px 12px 14px;
}
.ui-grpc__empty { padding: 8px 2px; font-size: 12.5px; color: var(--ui-grpc-muted); }
.ui-grpc__list { display: grid; gap: 15px; }
.ui-grpc__run { display: grid; gap: 5px; }

.ui-grpc__speaker { display: flex; align-items: center; gap: 7px; min-width: 0; }
.ui-grpc__from { font-size: 12.5px; font-weight: 600; }
.ui-grpc__role { font-size: 11.5px; color: var(--ui-grpc-muted); }
.ui-grpc__time {
  margin-left: auto;
  font-size: 11px;
  color: var(--ui-grpc-subtle);
  font-variant-numeric: tabular-nums;
}
.ui-grpc__you {
  padding: 0 5px;
  border-radius: var(--ui-grpc-pill);
  background: var(--ui-grpc-tint-2);
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ui-grpc-muted);
}

/* Identity is the glyph and the neutral tint, never a hue: the palette has one accent. */
.ui-grpc__avatar {
  display: grid;
  place-items: center;
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  background: var(--ui-grpc-tint-1);
  color: var(--ui-grpc-ink);
  box-shadow: inset 0 0 0 1px var(--ui-grpc-line-soft);
}
.ui-grpc [data-tint="2"] .ui-grpc__avatar { background: var(--ui-grpc-tint-2); }
.ui-grpc [data-tint="3"] .ui-grpc__avatar { background: var(--ui-grpc-tint-3); }
/* The human's identity is drawn as shape, not as the one ember accent: pill avatar, double ring, "You". */
.ui-grpc [data-kind="human"] .ui-grpc__avatar {
  border-radius: var(--ui-grpc-pill);
  box-shadow: inset 0 0 0 1px var(--ui-grpc-line-soft), 0 0 0 2px var(--ui-grpc-tint-3);
}

/* ---------- Messages ---------- */

.ui-grpc__msg {
  position: relative;
  margin-left: 29px;
  padding: 7px 10px;
  border-radius: 10px;
  background: var(--ui-grpc-card);
  box-shadow: inset 0 0 0 1px var(--ui-grpc-line-soft);
  overflow-wrap: anywhere;
  animation: ui-grpc-rise var(--ui-grpc-dur-3) var(--ui-grpc-ease-out) both;
}
.ui-grpc__msg[data-self="true"] {
  box-shadow: inset 2px 0 0 0 var(--ui-grpc-tint-3), inset 0 0 0 1px var(--ui-grpc-line-soft);
}
.ui-grpc__msg::after {
  content: "";
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px var(--ui-grpc-accent);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--ui-grpc-dur-3) var(--ui-grpc-ease-out);
}
.ui-grpc__msg[data-flash="true"]::after { opacity: 1; }
.ui-grpc__text { font-size: 13px; }
.ui-grpc__ping {
  padding: 0 3px;
  border-radius: 5px;
  background: var(--ui-grpc-accent-soft);
  color: var(--ui-grpc-ink);
  font-weight: 500;
}

.ui-grpc__cite {
  display: block;
  width: 100%;
  margin: 0 0 6px;
  padding: 6px 9px;
  border-radius: 8px;
  text-align: left;
  color: var(--ui-grpc-muted);
  background: var(--ui-grpc-well);
  box-shadow: inset 2px 0 0 0 var(--ui-grpc-tint-3), inset 0 0 0 1px var(--ui-grpc-line-soft);
  transition: background-color var(--ui-grpc-dur-2) var(--ui-grpc-ease-out),
    color var(--ui-grpc-dur-2) var(--ui-grpc-ease-out);
}
.ui-grpc__cite:hover { background: var(--ui-grpc-tint-1); color: var(--ui-grpc-ink); }
.ui-grpc__cite-head { display: flex; align-items: center; gap: 6px; font-size: 11px; }
.ui-grpc__cite-name { font-weight: 600; }
.ui-grpc__cite-text { display: block; overflow: hidden; font-size: 12px; white-space: nowrap; text-overflow: ellipsis; }

.ui-grpc__acts {
  position: absolute;
  top: -11px;
  right: 6px;
  opacity: 0;
  transition: opacity var(--ui-grpc-dur-2) var(--ui-grpc-ease-out);
}
.ui-grpc__msg:hover .ui-grpc__acts,
.ui-grpc__msg:focus-within .ui-grpc__acts,
.ui-grpc__msg[data-armed="true"] .ui-grpc__acts { opacity: 1; }
.ui-grpc__reply-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding: 0 8px;
  border-radius: var(--ui-grpc-pill);
  background: var(--ui-grpc-card);
  box-shadow: inset 0 0 0 1px var(--ui-grpc-line);
  font-size: 11px;
  color: var(--ui-grpc-muted);
  transition: color var(--ui-grpc-dur-1) var(--ui-grpc-ease-out);
}
.ui-grpc__reply-btn:hover { color: var(--ui-grpc-ink); }
.ui-grpc__reply-btn .ui-grpc__glyph { width: 11px; height: 11px; }

/* ---------- Roster ---------- */

.ui-grpc__roster {
  grid-area: roster;
  display: grid;
  align-content: start;
  gap: 4px;
  min-width: 0;
  padding: 10px;
  border-radius: var(--ui-grpc-radius);
  background: var(--ui-grpc-panel);
  box-shadow: inset 0 0 0 1px var(--ui-grpc-line);
}
.ui-grpc__roster-title {
  margin: 0 0 3px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--ui-grpc-muted);
}
.ui-grpc__people { display: grid; gap: 2px; }
.ui-grpc__person {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 2px 8px;
  padding: 6px 7px;
  border-radius: 10px;
  transition: transform var(--ui-grpc-dur-3) var(--ui-grpc-ease-soft),
    background-color var(--ui-grpc-dur-3) var(--ui-grpc-ease-soft);
}
.ui-grpc__person .ui-grpc__avatar { grid-row: 1 / span 2; }
.ui-grpc__person .ui-grpc__state { grid-row: 1 / span 2; }
.ui-grpc__who { display: flex; align-items: center; gap: 5px; min-width: 0; }
.ui-grpc__name { overflow: hidden; font-size: 12.5px; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; }
.ui-grpc__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  color: var(--ui-grpc-muted);
}
.ui-grpc__person[data-state="composing"] { background: var(--ui-grpc-well); }
.ui-grpc__person[data-state="composing"] .ui-grpc__state { color: var(--ui-grpc-ink); }
/* The composing chip breathes upward on the ambient curve; nothing else on the panel moves. */
.ui-grpc__person[data-composing="true"] {
  animation: ui-grpc-lift var(--ui-grpc-dur-6) var(--ui-grpc-ease-soft) infinite alternate;
}
.ui-grpc__state .ui-grpc__glyph { width: 11px; height: 11px; }
.ui-grpc__state-label { font-size: 9px; letter-spacing: 0.05em; }

/* ---------- Dock ---------- */

.ui-grpc__dock { grid-area: dock; display: grid; gap: 8px; min-width: 0; }

.ui-grpc__quoting {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 7px 9px 7px 11px;
  border-radius: var(--ui-grpc-radius-chip);
  background: var(--ui-grpc-well);
  box-shadow: inset 2px 0 0 0 var(--ui-grpc-accent), inset 0 0 0 1px var(--ui-grpc-line);
  animation: ui-grpc-slide var(--ui-grpc-dur-3) var(--ui-grpc-ease-out) both;
}
.ui-grpc__quoting-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 11px;
  color: var(--ui-grpc-muted);
  white-space: nowrap;
}
.ui-grpc__quoting-text { overflow: hidden; font-size: 12.5px; white-space: nowrap; text-overflow: ellipsis; }
.ui-grpc__drop {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: var(--ui-grpc-pill);
  color: var(--ui-grpc-muted);
  transition: background-color var(--ui-grpc-dur-1) var(--ui-grpc-ease-out),
    color var(--ui-grpc-dur-1) var(--ui-grpc-ease-out);
}
.ui-grpc__drop:hover { background: var(--ui-grpc-tint-1); color: var(--ui-grpc-ink); }
.ui-grpc__drop--tight { width: 18px; height: 18px; }
.ui-grpc__drop .ui-grpc__glyph { width: 11px; height: 11px; }

.ui-grpc__composer {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 8px;
  padding: 8px;
  border-radius: var(--ui-grpc-radius);
  background: var(--ui-grpc-panel);
  box-shadow: inset 0 0 0 1px var(--ui-grpc-line), inset 3px 0 0 0 transparent;
  transition: box-shadow var(--ui-grpc-dur-2) var(--ui-grpc-ease-out);
}
/* An armed composer – answering or addressing – carries the ember rail on its edge. */
.ui-grpc[data-state="replying"] .ui-grpc__composer,
.ui-grpc[data-state="addressing"] .ui-grpc__composer {
  box-shadow: inset 0 0 0 1px var(--ui-grpc-line), inset 3px 0 0 0 var(--ui-grpc-accent);
}
.ui-grpc__lead { display: grid; gap: 6px; min-width: 0; }
.ui-grpc__addressed {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  justify-self: start;
  height: 24px;
  padding: 0 3px 0 8px;
  border-radius: var(--ui-grpc-pill);
  background: var(--ui-grpc-accent-soft);
  font-size: 11.5px;
}
.ui-grpc__addressed .ui-grpc__glyph { width: 12px; height: 12px; }
.ui-grpc__addressed-label { font-weight: 600; }
.ui-grpc__field {
  display: block;
  width: 100%;
  min-height: 42px;
  max-height: 108px;
  padding: 7px 8px;
  border: 0;
  border-radius: 10px;
  background: var(--ui-grpc-well);
  box-shadow: inset 0 0 0 1px var(--ui-grpc-line-soft);
  resize: none;
}
.ui-grpc__field::placeholder { color: var(--ui-grpc-subtle); }
.ui-grpc__tools { display: flex; align-items: center; gap: 6px; }
.ui-grpc__icon-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  color: var(--ui-grpc-muted);
  background: var(--ui-grpc-well);
  box-shadow: inset 0 0 0 1px var(--ui-grpc-line-soft);
  transition: color var(--ui-grpc-dur-1) var(--ui-grpc-ease-out),
    background-color var(--ui-grpc-dur-1) var(--ui-grpc-ease-out),
    transform var(--ui-grpc-dur-1) var(--ui-grpc-ease-out);
}
.ui-grpc__icon-btn:hover { color: var(--ui-grpc-ink); }
.ui-grpc__icon-btn:active { transform: translateY(1px); }
.ui-grpc__icon-btn[aria-expanded="true"] { background: var(--ui-grpc-accent-soft); color: var(--ui-grpc-ink); }
.ui-grpc__send {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  color: var(--ui-grpc-subtle);
  background: var(--ui-grpc-well);
  box-shadow: inset 0 0 0 1px var(--ui-grpc-line-soft);
  transition: color var(--ui-grpc-dur-2) var(--ui-grpc-ease-out),
    background-color var(--ui-grpc-dur-2) var(--ui-grpc-ease-out),
    transform var(--ui-grpc-dur-2) var(--ui-grpc-ease-out);
}
.ui-grpc__send:disabled { cursor: default; }
/* The ember accent lights the one thing that can happen right now. */
.ui-grpc__send[data-ready="true"] { background: var(--ui-grpc-accent); color: var(--ui-grpc-on-accent); }
.ui-grpc__send[data-ready="true"]:hover { background: var(--ui-grpc-accent-hover); }
.ui-grpc__send[data-ready="true"]:active { transform: translateY(1px); }

.ui-grpc__mentions {
  position: absolute;
  left: 8px;
  bottom: calc(100% + 6px);
  z-index: 3;
  width: min(226px, 100%);
  padding: 5px;
  border-radius: var(--ui-grpc-radius-chip);
  background: var(--ui-grpc-card);
  box-shadow: inset 0 0 0 1px var(--ui-grpc-line), var(--ui-grpc-pop);
  animation: ui-grpc-slide var(--ui-grpc-dur-3) var(--ui-grpc-ease-out) both;
}
.ui-grpc__mentions-title {
  margin: 3px 7px 5px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--ui-grpc-muted);
}
.ui-grpc__options { display: grid; gap: 2px; }
.ui-grpc__option {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 7px;
  border-radius: 8px;
  text-align: left;
  transition: background-color var(--ui-grpc-dur-1) var(--ui-grpc-ease-out);
}
.ui-grpc__option:hover { background: var(--ui-grpc-well); }
.ui-grpc__option[aria-selected="true"] { background: var(--ui-grpc-accent-soft); }
.ui-grpc__option-text { display: grid; gap: 0; min-width: 0; }
.ui-grpc__option-text .ui-grpc__role { font-size: 11px; }

@keyframes ui-grpc-rise {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes ui-grpc-slide {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes ui-grpc-lift {
  from { transform: translateY(0); }
  to { transform: translateY(-2px); }
}

/* The roster drops under the thread on a narrow host and its chips go two up. */
@container (max-width: 560px) {
  .ui-grpc__frame {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: "roster" "thread" "dock";
  }
  .ui-grpc__people { grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); }
  .ui-grpc__thread { height: clamp(224px, 52vh, 340px); }
  .ui-grpc__quoting { grid-template-columns: minmax(0, 1fr) auto; }
  .ui-grpc__quoting-text { display: none; }
}

:where(.dark, [data-theme="dark"]) .ui-grpc {
  --ui-grpc-ink: var(--text, #f4ece4);
  --ui-grpc-muted: var(--text-muted, #a2958a);
  --ui-grpc-subtle: var(--text-subtle, #f4ece48c);
  --ui-grpc-card: var(--card, #201a15);
  --ui-grpc-panel: var(--panel, #1a1512);
  --ui-grpc-well: var(--preview, #1a1512);
  --ui-grpc-line: var(--border, #33291f);
  --ui-grpc-line-soft: var(--border-soft, #f4ece41f);
  --ui-grpc-accent: var(--accent, #ff6b35);
  --ui-grpc-accent-hover: var(--accent-hover, #ff8355);
  --ui-grpc-accent-soft: var(--accent-soft, #ff6b352e);
  --ui-grpc-on-accent: var(--accent-fg, #1a1410);
  --ui-grpc-pop: var(--shadow-pop, 0 14px 40px rgba(0, 0, 0, 0.5), 0 2px 10px rgba(0, 0, 0, 0.35));
  --ui-grpc-tint-1: #2a221a;
  --ui-grpc-tint-2: #332a20;
  --ui-grpc-tint-3: #3d3226;
}

@media (prefers-reduced-motion: reduce) {
  .ui-grpc__msg,
  .ui-grpc__quoting,
  .ui-grpc__mentions,
  .ui-grpc__person[data-composing="true"] { animation: none; }
  .ui-grpc *,
  .ui-grpc *::before,
  .ui-grpc *::after { transition-duration: 1ms; }
}
`;