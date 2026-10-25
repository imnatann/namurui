"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

/*
 * Writing Assistant – a chat card for a writing companion that you can actually use.
 *
 * Three blurred blobs – pink, violet, blue – drift behind the lower half of the card while the
 * welcome view offers a few suggestion chips. Sending (a chip, the field, or dictation) hands the
 * card over to the conversation: the glow dims, the header grows a new-chat button, and the reply
 * streams in a word at a time under a shimmering "Writing" while it is being composed.
 *
 * The mic is a real toggle. Where the browser exposes SpeechRecognition or webkitSpeechRecognition
 * the transcript is written into the field as it is heard, and the sentence is sent when the take
 * ends; where it does not, the button plays a short typed sample take instead, so the state is
 * still visible. The styles are injected below, so no extra files are needed.
 */

/** One line of the conversation */
export type WritingMessage = {
  /** Who wrote it: your line is a filled bubble on the right, the assistant’s is plain text on the left */
  role: "user" | "assistant";
  /** The words. Line breaks are preserved */
  text: string;
};

export type WritingAssistantProps = {
  /** Assistant name beside the gradient mark */
  name?: string;
  /** Line under the name */
  tagline?: string;
  /** Headline on the welcome view */
  greeting?: string;
  /** Chips under the greeting – each one sends itself as a message */
  suggestions?: string[];
  /** Placeholder in the prompt field */
  placeholder?: string;
  /** Conversation the card opens with; an empty list shows the welcome view */
  initialMessages?: WritingMessage[];
  /**
   * Called with the sent message. Return (or resolve to) the reply to stream back; return nothing
   * to use the built-in sample writer.
   */
  onSend?: (message: string) => string | void | Promise<string | void>;
  /** "auto" asks the browser for a speech service, "simulate" always types a sample take */
  speech?: "auto" | "simulate";
  /** The sample take typed into the field when no speech service is available */
  dictation?: string;
  /** Extra class on the root */
  className?: string;
};

type Bubble = { key: number; role: "user" | "assistant"; text: string };

type SpeechResultList = ArrayLike<{ 0: { transcript: string } }>;

/** The Web Speech API has no stable DOM typings, so only the surface we touch is described here */
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type RecognitionCtor = new () => Recognition;

type SpeechHost = {
  SpeechRecognition?: RecognitionCtor;
  webkitSpeechRecognition?: RecognitionCtor;
};

const SAMPLE_SUGGESTIONS = ["Polish my email", "Make it shorter", "Fix the tone", "Draft a reply"];
const SAMPLE_DICTATION = "Make the opening warmer and cut it to two sentences.";
const WRITING = "Writing";
const WORD_MS = 42;
const TAKE_MS = 90;
const FIELD_MIN = 28;
const FIELD_MAX = 88;

const sampleReply = (message: string): string => {
  const trimmed = message.trim();
  if (/shorter|concise|cut|trim/i.test(trimmed)) {
    return "Half the words, same ask: “Hi Priya — following up on the renewal. We can move the start date to the 12th; let me know if that works.”";
  }
  if (/tone|warmer|friendly|polite/i.test(trimmed)) {
    return "Warmer, without the apology: “Hi Priya, hope the week’s going well. We can shift the renewal to the 12th — does that still work on your side?”";
  }
  if (/reply|response|answer/i.test(trimmed)) {
    return "A reply you can send as is: “Thanks for the nudge — the 12th works for us. I’ll get the signed page back to you this afternoon.”";
  }
  if (/grammar|typo|fix/i.test(trimmed)) {
    return "Cleaned up the grammar and evened out the tense: “Hi Priya, I wanted to follow up on the renewal. As discussed, we can move the start date to the 12th.”";
  }
  return "Tightened it up: “Hi Priya, following up on the renewal — we can move the start date to the 12th. Let me know if that works.” Nothing else changed.";
};

export function WritingAssistant({
  name = "Quill",
  tagline = "Your writing companion.",
  greeting = "What should we write?",
  suggestions = SAMPLE_SUGGESTIONS,
  placeholder = "Ask anything…",
  initialMessages = [],
  onSend,
  speech = "auto",
  dictation = SAMPLE_DICTATION,
  className,
}: WritingAssistantProps) {
  const [messages, setMessages] = useState<Bubble[]>(() =>
    initialMessages.map((message, index) => ({ key: index, role: message.role, text: message.text })),
  );
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [waiting, setWaiting] = useState<number | null>(null);
  const [streaming, setStreaming] = useState<number | null>(null);
  const [fieldHeight, setFieldHeight] = useState(28);

  const field = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const takeTimer = useRef(0);
  const endTimer = useRef(0);
  const recognition = useRef<Recognition | null>(null);
  const heard = useRef("");
  const run = useRef(0);
  const nextKey = useRef(initialMessages.length);
  const busyRef = useRef(false);

  const gradientId = `ui-wac-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const chat = messages.length > 0;
  const busy = waiting !== null || streaming !== null;

  useLayoutEffect(() => {
    const node = field.current;
    if (!node) return;
    const previous = node.style.height;
    node.style.height = "auto";
    const next = Math.max(FIELD_MIN, Math.min(node.scrollHeight, FIELD_MAX));
    node.style.height = previous;
    setFieldHeight((current) => (current === next ? current : next));
  }, [draft]);

  useEffect(() => {
    const node = log.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      window.clearTimeout(takeTimer.current);
      window.clearTimeout(endTimer.current);
      recognition.current?.abort();
      recognition.current = null;
    },
    [],
  );

  const stream = (text: string, key: number) => {
    const words = text.split(" ");
    let index = 1;
    let last = 0;
    cancelAnimationFrame(frame.current);
    setStreaming(key);
    setMessages((list) => list.map((message) => (message.key === key ? { ...message, text: words[0] ?? "" } : message)));
    const tick = (now: number) => {
      if (!last || now - last >= WORD_MS) {
        last = now;
        index = Math.min(words.length, index + 1);
        const partial = words.slice(0, index).join(" ");
        setMessages((list) =>
          list.map((message) => (message.key === key ? { ...message, text: partial } : message)),
        );
      }
      if (index < words.length) frame.current = requestAnimationFrame(tick);
      else {
        setStreaming(null);
        busyRef.current = false;
        setMessages((list) => list.map((message) => (message.key === key ? { ...message, text } : message)));
      }
    };
    frame.current = requestAnimationFrame(tick);
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busyRef.current) return;
    busyRef.current = true;
    const token = run.current;
    const userKey = nextKey.current;
    const replyKey = nextKey.current + 1;
    nextKey.current += 2;
    setMessages((list) => [
      ...list,
      { key: userKey, role: "user", text },
      { key: replyKey, role: "assistant", text: "" },
    ]);
    setDraft("");
    setWaiting(replyKey);
    let answer: string;
    try {
      const result = onSend ? await onSend(text) : undefined;
      if (typeof result === "string" && result.trim()) answer = result.trim();
      else answer = sampleReply(text);
    } catch {
      answer = "I couldn’t reach the writing service just now. Try again in a moment.";
    }
    if (token !== run.current) return;
    setWaiting(null);
    stream(answer, replyKey);
  };

  const take = () => {
    const prefix = draft.trim() ? `${draft.trimEnd()} ` : "";
    const words = dictation.split(" ");
    let index = 0;
    const step = () => {
      index += 1;
      setDraft(`${prefix}${words.slice(0, index).join(" ")}`);
      if (index < words.length) {
        takeTimer.current = window.setTimeout(step, TAKE_MS);
        return;
      }
      endTimer.current = window.setTimeout(() => {
        setListening(false);
        void send(`${prefix}${words.join(" ")}`);
      }, 420);
    };
    takeTimer.current = window.setTimeout(step, TAKE_MS);
  };

  const listen = (Ctor: RecognitionCtor): boolean => {
    try {
      const engine = new Ctor();
      const prefix = draft.trim() ? `${draft.trimEnd()} ` : "";
      engine.lang = document.documentElement.lang || "en-US";
      engine.interimResults = true;
      engine.continuous = false;
      engine.onresult = (event) => {
        let transcript = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          transcript += event.results[index][0].transcript;
        }
        heard.current = `${prefix}${transcript}`;
        setDraft(heard.current);
      };
      engine.onerror = () => {
        heard.current = "";
        recognition.current = null;
        setListening(false);
      };
      engine.onend = () => {
        const sentence = heard.current.trim();
        heard.current = "";
        recognition.current = null;
        setListening(false);
        if (sentence) {
          void send(sentence);
        }
      };
      recognition.current = engine;
      engine.start();
      return true;
    } catch {
      recognition.current = null;
      return false;
    }
  };

  const toggleMic = () => {
    if (listening) {
      if (recognition.current) {
        recognition.current.stop();
        return;
      }
      window.clearTimeout(takeTimer.current);
      window.clearTimeout(endTimer.current);
      setListening(false);
      return;
    }
    setListening(true);
    const host =
      speech === "simulate" || typeof window === "undefined" ? undefined : (window as unknown as SpeechHost);
    // SpeechRecognition and webkitSpeechRecognition are both optional – without either, the
    // sample take is typed into the field so the listening state is still real
    const Ctor = host?.SpeechRecognition ?? host?.webkitSpeechRecognition;
    if (Ctor && listen(Ctor)) return;
    take();
  };

  const reset = () => {
    run.current += 1;
    cancelAnimationFrame(frame.current);
    window.clearTimeout(takeTimer.current);
    window.clearTimeout(endTimer.current);
    recognition.current?.abort();
    recognition.current = null;
    heard.current = "";
    busyRef.current = false;
    setMessages([]);
    setDraft("");
    setWaiting(null);
    setStreaming(null);
    setListening(false);
    field.current?.focus();
  };

  return (
    <div className={["ui-wac", className].filter(Boolean).join(" ")} data-chat={chat ? "" : undefined}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-writing-assistant" precedence="default">
        {css}
      </style>

      <header className="ui-wac__head">
        <div className="ui-wac__id">
          <h3 className="ui-wac__name">
            <svg className="ui-wac__mark" viewBox="0 0 16 16" aria-hidden="true">
              <defs>
                <linearGradient id={gradientId} x1="2" y1="2" x2="14" y2="14" gradientUnits="userSpaceOnUse">
                  <stop stopColor="var(--ui-wac-pink)" />
                  <stop offset="0.5" stopColor="var(--ui-wac-violet)" />
                  <stop offset="1" stopColor="var(--ui-wac-blue)" />
                </linearGradient>
              </defs>
              <path
                fill={`url(#${gradientId})`}
                d="M8 1.5c.3 2.9 1.6 4.2 4.5 4.5-2.9.3-4.2 1.6-4.5 4.5-.3-2.9-1.6-4.2-4.5-4.5 2.9-.3 4.2-1.6 4.5-4.5Z"
              />
              <path
                fill={`url(#${gradientId})`}
                d="M12.25 10c.13 1.3.7 1.87 2 2-1.3.13-1.87.7-2 2-.13-1.3-.7-1.87-2-2 1.3-.13 1.87-.7 2-2Z"
              />
            </svg>
            {name}
          </h3>
          <p className="ui-wac__tagline">{tagline}</p>
        </div>
        <button type="button" className="ui-wac__new" aria-label="New chat" tabIndex={-1} onClick={reset}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </header>

      <div className="ui-wac__body">
        <div className="ui-wac__glow" aria-hidden="true">
          <span className="ui-wac__blob ui-wac__blob--pink" />
          <span className="ui-wac__blob ui-wac__blob--violet" />
          <span className="ui-wac__blob ui-wac__blob--blue" />
        </div>

        <div className="ui-wac__content">
          {chat ? (
            <div className="ui-wac__messages" ref={log} role="log" aria-live="polite">
              {messages.map((message) => {
                const composing = message.key === waiting;
                const writing = message.key === streaming;
                const cut = writing ? message.text.lastIndexOf(" ") + 1 : 0;
                return (
                  <p
                    key={message.key}
                    className={["ui-wac__msg", `ui-wac__msg--${message.role}`, composing ? "ui-wac__typing" : ""]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {composing ? (
                      <span className="ui-wac__shimmer" data-text={WRITING}>
                        {WRITING}
                      </span>
                    ) : writing ? (
                      <>
                        {message.text.slice(0, cut)}
                        <span className="ui-wac__shimmer" data-text={message.text.slice(cut)}>
                          {message.text.slice(cut)}
                        </span>
                      </>
                    ) : (
                      message.text
                    )}
                  </p>
                );
              })}
            </div>
          ) : (
            <div className="ui-wac__welcome">
              <p className="ui-wac__greeting">{greeting}</p>
              <div className="ui-wac__chips">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="ui-wac__chip"
                    onClick={() => void send(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <form
          className="ui-wac__row"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <div className="ui-wac__field" data-listening={listening ? "" : undefined}>
            <textarea
              ref={field}
              rows={1}
              placeholder={placeholder}
              aria-label="Message"
              value={draft}
              style={{ height: fieldHeight }}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send(draft);
                }
              }}
            />
          </div>
          <button
            type="button"
            className="ui-wac__mic"
            aria-pressed={listening}
            aria-label="Dictate"
            data-listening={listening ? "" : undefined}
            onClick={toggleMic}
          >
            <span className="ui-wac__pulse" aria-hidden="true" />
            {listening ? (
              <span className="ui-wac__wave" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3ZM6 11.5a6 6 0 0 0 12 0M12 17.5v3" />
              </svg>
            )}
          </button>
          {draft.trim() ? (
            <button type="submit" className="ui-wac__send" aria-label="Send" disabled={busy}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 19V5M6 11l6-6 6 6" />
              </svg>
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
}

const css = /* css */ `
.ui-wac{--ui-wac-card: #fffdfb;--ui-wac-strong: #0b0908;--ui-wac-ink: rgba(11, 9, 8, 0.88);--ui-wac-text: rgba(11, 9, 8, 0.61);--ui-wac-muted: rgba(11, 9, 8, 0.45);--ui-wac-faint: rgba(11, 9, 8, 0.27);--ui-wac-icon: rgba(11, 9, 8, 0.447);--ui-wac-line: rgba(11, 9, 8, 0.06);--ui-wac-fill: rgba(11, 9, 8, 0.06);--ui-wac-wash: rgba(11, 9, 8, 0.03);--ui-wac-solid: rgba(11, 9, 8, 0.88);--ui-wac-on-solid: #fcf9f7;--ui-wac-accent: rgba(217, 84, 31, 0.765);--ui-wac-accent-wash: rgba(217, 84, 31, 0.08);--ui-wac-accent-ring: rgba(217, 84, 31, 0.22);--ui-wac-shine: rgba(255, 253, 251, 0.82);--ui-wac-pink: #e2544a;--ui-wac-violet: #ff8a5c;--ui-wac-blue: #ff6b35;--ui-wac-glow: 0.13;--ui-wac-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-wac-focus: rgba(217, 84, 31, 0.35);--ui-wac-ease: cubic-bezier(0.22, 1, 0.36, 1);position: relative;box-sizing: border-box;container-type: inline-size;display: flex;flex-direction: column;width: 100%;max-width: 380px;overflow: hidden;border-radius: 10px;background: var(--ui-wac-card);box-shadow: var(--ui-wac-shadow);font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;font-weight: 400;color: var(--ui-wac-ink);-webkit-font-smoothing: antialiased;-webkit-tap-highlight-color: transparent}
.ui-wac *, .ui-wac *::before, .ui-wac *::after{box-sizing: border-box}
:where(.ui-wac) button{appearance: none;margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
:where(.ui-wac) svg{display: block;flex: none}
.ui-wac button:focus-visible{outline: 2px solid var(--ui-wac-focus);outline-offset: 1px}
.ui-wac__head{display: flex;align-items: center;justify-content: space-between;gap: 12px;padding: 12px 12px 12px 16px;border-bottom: 0.5px solid var(--ui-wac-line)}
.ui-wac__id{min-width: 0}
.ui-wac__name{display: flex;align-items: center;gap: 6px;margin: 0;font-size: 13px;font-weight: 500;line-height: 20px;color: var(--ui-wac-strong)}
.ui-wac__mark{width: 16px;height: 16px}
.ui-wac__tagline{margin: 0;overflow: hidden;font-size: 12px;line-height: 16px;white-space: nowrap;text-overflow: ellipsis;color: var(--ui-wac-text)}
.ui-wac__new{display: grid;place-items: center;flex: none;width: 28px;height: 28px;border-radius: 6px;color: var(--ui-wac-icon);opacity: 0;transform: scale(0.8);pointer-events: none;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-4, 380ms) var(--ui-wac-ease), background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-wac[data-chat] .ui-wac__new{opacity: 1;transform: none;pointer-events: auto}
.ui-wac__new:hover{background: var(--ui-wac-wash);color: var(--ui-wac-ink)}
.ui-wac__new svg{width: 16px;height: 16px;fill: none;stroke: currentColor;stroke-width: 1.6;stroke-linecap: round}
.ui-wac__body{position: relative;display: flex;flex-direction: column;height: 340px;overflow: hidden}
.ui-wac__content{position: relative;flex: 1;min-height: 0;display: flex;flex-direction: column;justify-content: flex-end;overflow: hidden}
.ui-wac__glow{position: absolute;inset: 0;pointer-events: none;opacity: 1;transition: opacity var(--nm-dur-5, 620ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-wac[data-chat] .ui-wac__glow{opacity: 0.4}
.ui-wac__blob{position: absolute;border-radius: 50%;filter: blur(36px);opacity: var(--ui-wac-glow);animation: ui-wac-drift-a var(--nm-dur-6, 1100ms) ease-in-out infinite alternate}
.ui-wac__blob--pink{left: -18%;top: 54%;width: 58%;height: 40%;background: var(--ui-wac-pink)}
.ui-wac__blob--violet{right: -16%;top: 46%;width: 54%;height: 42%;background: var(--ui-wac-violet);animation-name: ui-wac-drift-b;animation-duration: var(--nm-dur-6, 1100ms)}
.ui-wac__blob--blue{left: 22%;bottom: -22%;width: 62%;height: 40%;background: var(--ui-wac-blue);animation-name: ui-wac-drift-c;animation-duration: var(--nm-dur-6, 1100ms)}
.ui-wac__welcome{position: relative;display: grid;gap: 12px;padding: 16px;animation: ui-wac-in 380ms var(--ui-wac-ease) both}
.ui-wac__greeting{margin: 0;font-size: 15px;font-weight: 500;line-height: 24px;color: var(--ui-wac-strong)}
.ui-wac__chips{display: flex;flex-wrap: wrap;gap: 6px}
.ui-wac__chip{padding: 4px 10px;border-radius: 6px;background: color-mix(in srgb, var(--ui-wac-card) 70%, transparent);box-shadow: inset 0 0 0 0.5px var(--ui-wac-line);font-size: 13px;font-weight: 500;line-height: 20px;white-space: nowrap;color: var(--ui-wac-text);transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 160ms var(--ui-wac-ease)}
.ui-wac__chip:hover{background: linear-gradient(var(--ui-wac-wash), var(--ui-wac-wash)), color-mix(in srgb, var(--ui-wac-card) 70%, transparent);color: var(--ui-wac-ink)}
.ui-wac__chip:active{transform: scale(0.97)}
.ui-wac__messages{position: relative;display: flex;flex-direction: column;gap: 12px;min-height: 0;padding: 16px 16px 14px;overflow-y: auto;scrollbar-width: none;-webkit-mask-image: linear-gradient(transparent, #0b0908 16px, #0b0908 calc(100% - 12px), transparent);mask-image: linear-gradient(transparent, #0b0908 16px, #0b0908 calc(100% - 12px), transparent)}
.ui-wac__messages::-webkit-scrollbar{display: none}
.ui-wac__msg{max-width: 86%;margin: 0;font-size: 13px;line-height: 20px;white-space: pre-wrap;overflow-wrap: break-word;color: var(--ui-wac-ink);animation: ui-wac-in var(--nm-dur-4, 380ms) var(--ui-wac-ease) both}
.ui-wac__msg--user{align-self: flex-end;padding: 6px 10px;border-radius: 10px;background: var(--ui-wac-fill)}
.ui-wac__msg--assistant{align-self: flex-start;max-width: 94%}
.ui-wac__typing{color: var(--ui-wac-muted)}
.ui-wac__shimmer{position: relative;display: inline-block}
.ui-wac__shimmer::after{content: attr(data-text);content: attr(data-text) / "";position: absolute;inset: 0;white-space: nowrap;color: transparent;background: linear-gradient(90deg, transparent 38%, var(--ui-wac-shine) 50%, transparent 62%) 100% 0 / 300% 100% no-repeat;-webkit-background-clip: text;background-clip: text;animation: ui-wac-sweep var(--nm-dur-6, 1100ms) linear infinite;pointer-events: none}
.ui-wac__row{position: relative;flex: none;display: flex;align-items: flex-end;gap: 4px;margin: 0;padding: 6px 10px 10px 16px}
.ui-wac__field{flex: 1;min-width: 0;display: flex;margin-right: 4px}
.ui-wac__field textarea{display: block;flex: 1;min-width: 0;height: 28px;margin: 0;padding: 4px 0;border: 0;background: none;outline: none;resize: none;font: inherit;font-size: 13px;line-height: 20px;color: var(--ui-wac-strong);caret-color: var(--ui-wac-accent);overflow-y: auto;scrollbar-width: none;-webkit-mask-image: linear-gradient(transparent, #0b0908 4px);mask-image: linear-gradient(transparent, #0b0908 4px)}
.ui-wac__field textarea::-webkit-scrollbar{display: none}
.ui-wac__field textarea::placeholder{color: var(--ui-wac-faint);opacity: 1}
.ui-wac__field[data-listening] textarea{color: var(--ui-wac-text)}
.ui-wac__send{display: grid;place-items: center;flex: none;width: 28px;height: 28px;border-radius: 6px;background: var(--ui-wac-solid) !important;color: var(--ui-wac-on-solid);transition: transform 160ms var(--ui-wac-ease), opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));animation: ui-wac-pop var(--nm-dur-3, 240ms) var(--ui-wac-ease) both}
.ui-wac__send:disabled{opacity: 0.4;cursor: default}
.ui-wac__send:not(:disabled):active{transform: scale(0.94)}
.ui-wac__send svg{width: 16px;height: 16px;fill: none;stroke: currentColor;stroke-width: 1.8;stroke-linecap: round;stroke-linejoin: round}
.ui-wac__mic{position: relative;display: grid;place-items: center;flex: none;width: 28px;height: 28px;border-radius: 6px;color: var(--ui-wac-icon);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 160ms var(--ui-wac-ease)}
.ui-wac__mic:not(:disabled):hover{background: var(--ui-wac-wash);color: var(--ui-wac-ink)}
.ui-wac__mic:not(:disabled):active{transform: scale(0.94)}
.ui-wac__mic:disabled{opacity: 0.5;cursor: default}
.ui-wac__mic svg{position: relative;width: 16px;height: 16px;fill: none;stroke: currentColor;stroke-width: 1.6;stroke-linecap: round;stroke-linejoin: round}
.ui-wac__mic[data-listening], .ui-wac__mic[data-listening]:hover{background: var(--ui-wac-accent-wash);color: var(--ui-wac-accent)}
.ui-wac__pulse{position: absolute;inset: 0;border-radius: 6px;opacity: 0}
.ui-wac__mic[data-listening] .ui-wac__pulse{opacity: 1;animation: ui-wac-ring var(--nm-dur-6, 1100ms) ease-out infinite}
.ui-wac__wave{position: relative;display: flex;align-items: center;gap: 2px;height: 12px}
.ui-wac__wave i{width: 2px;height: 100%;border-radius: 1px;background: currentColor;transform: scaleY(0.35);animation: ui-wac-wave 1.1s ease-in-out infinite}
.ui-wac__wave i:nth-child(2){animation-delay: -0.35s}
.ui-wac__wave i:nth-child(3){animation-delay: -0.7s}
@keyframes ui-wac-in{from{opacity: 0;transform: translateY(6px)}
}
@keyframes ui-wac-pop{from{opacity: 0;transform: scale(0.6)}
}
@keyframes ui-wac-sweep{from{background-position: 100% 0}
to{background-position: 0% 0}
}
@keyframes ui-wac-ring{0%{box-shadow: 0 0 0 0 var(--ui-wac-accent-ring)}
100%{box-shadow: 0 0 0 7px transparent}
}
@keyframes ui-wac-wave{0%, 100%{transform: scaleY(0.35)}
50%{transform: scaleY(1)}
}
@keyframes ui-wac-drift-a{0%{transform: translate(0, 0) scale(1)}
50%{transform: translate(55%, -22%) scale(1.25)}
100%{transform: translate(20%, 14%) scale(0.85)}
}
@keyframes ui-wac-drift-b{0%{transform: translate(0, 0) scale(1)}
50%{transform: translate(-55%, 24%) scale(0.85)}
100%{transform: translate(-22%, -16%) scale(1.25)}
}
@keyframes ui-wac-drift-c{0%{transform: translate(0, 0) scale(1)}
50%{transform: translate(-45%, -26%) scale(1.2)}
100%{transform: translate(30%, -10%) scale(0.88)}
}
@container (max-width: 330px){.ui-wac__head{padding-left: 12px}
.ui-wac__welcome, .ui-wac__messages{padding-left: 12px;padding-right: 12px}
.ui-wac__row{padding-left: 12px}
}
@media (pointer: coarse){.ui-wac__new, .ui-wac__mic, .ui-wac__send{width: 34px;height: 34px}
.ui-wac__chip{padding: 7px 12px}
.ui-wac__field textarea{padding: 7px 0}
}
@media (prefers-reduced-motion: reduce){.ui-wac__blob, .ui-wac__welcome, .ui-wac__msg, .ui-wac__send, .ui-wac__mic[data-listening] .ui-wac__pulse, .ui-wac__wave i, .ui-wac__shimmer::after{animation: none}
.ui-wac__wave i{transform: scaleY(0.7)}
}
.ui-wac input:not([type="checkbox"]):not([type="radio"]):focus-visible, .ui-wac textarea:focus-visible, .ui-wac [contenteditable]:focus-visible{outline: none}
:where(.dark, [data-theme="dark"]) .ui-wac{--ui-wac-card: #211b16;--ui-wac-strong: #fffdfb;--ui-wac-ink: rgba(255, 253, 251, 0.9);--ui-wac-text: rgba(255, 253, 251, 0.62);--ui-wac-muted: rgba(255, 253, 251, 0.46);--ui-wac-faint: rgba(255, 253, 251, 0.3);--ui-wac-icon: rgba(255, 253, 251, 0.5);--ui-wac-line: rgba(255, 253, 251, 0.08);--ui-wac-fill: rgba(255, 253, 251, 0.08);--ui-wac-wash: rgba(255, 253, 251, 0.04);--ui-wac-solid: rgba(255, 253, 251, 0.92);--ui-wac-on-solid: #1c1713;--ui-wac-accent: #ff8a5c;--ui-wac-accent-wash: rgba(255, 138, 92, 0.14);--ui-wac-accent-ring: rgba(255, 138, 92, 0.3);--ui-wac-shine: #fffdfb;--ui-wac-pink: #e2544a;--ui-wac-violet: #ff8a5c;--ui-wac-blue: #ff8a5c;--ui-wac-glow: 0.14;--ui-wac-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-wac-focus: rgba(255, 138, 92, 0.5)}

`;
