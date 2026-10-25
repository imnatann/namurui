"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

/*
 * Phone Mock: a device frame, not content. The bezel, the notch and the rounded screen belong to
 * the frame; the status bar, the in-app bar and the composer are chrome that never move, and the
 * screen body between them is the only scroller, so a long thread scrolls under a fixed bar and
 * over a fixed field. Bubbles settle in on the entry curve, and a thread that ends on an outgoing
 * message carries its delivered receipt. Styles are injected below, so no extra files are needed.
 */

export type PhoneThreadMessage = {
  /** Stable id for the row */
  id: string;
  /** Which side of the thread the bubble sits on */
  side: "in" | "out";
  /** Message body, plain text; line breaks are kept */
  text: string;
  /** Time read in the bubble footer, e.g. `09:34` */
  at?: string;
};

export type PhoneMockProps = {
  /** Status bar clock; defaults to the measured `9:41` */
  statusTime?: string;
  /** The in-app bar above the thread */
  appBar?: {
    /** Conversation or business name, 13px semibold */
    title: string;
    /** Second line under the title, 10px muted */
    subtitle?: string;
    /** Initials for the round avatar; a person glyph stands in when absent */
    avatar?: string;
    /** Draw the back chevron; defaults to true */
    back?: boolean;
    /** Optional pill on the right, e.g. `AI` */
    tag?: string;
  };
  /** Composer field at the foot of the screen; `false` removes it */
  composer?:
    | {
        /** Placeholder in the field */
        placeholder?: string;
        /** Accessible name for the field */
        label?: string;
        /** Controlled draft; omit to let the frame own it */
        value?: string;
        /** Draft change, fired on every keystroke */
        onChange?: (value: string) => void;
        /** Send the trimmed draft; without it the send glyph is decorative */
        onSend?: (value: string) => void;
        /** Dim and lock the field */
        disabled?: boolean;
      }
    | false;
  /** Bubbles in the scrolling body, oldest first */
  messages?: readonly PhoneThreadMessage[];
  /** Extra content above the bubbles, inside the scroll area (a day divider, a note) */
  children?: ReactNode;
  /** Extra class on the frame */
  className?: string;
};

/* Stable defaults, so an omitted prop does not read as a new payload on every render */
const NO_MESSAGES: readonly PhoneThreadMessage[] = [];
const DEFAULT_APP_BAR = { title: "Chat" };

/* Two ticks: the receipt every outgoing bubble carries, and the delivered line under the last one */
const TICKS = (
  <svg
    className="ui-phm__ticks"
    viewBox="0 0 14 10"
    width="13"
    height="9"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M1 5.2 3.4 7.6 7.8 3.2" />
    <path d="M5.4 5.2 7.8 7.6 12.2 3.2" />
  </svg>
);

export function PhoneMock({
  statusTime = "9:41",
  appBar = DEFAULT_APP_BAR,
  composer = {},
  messages = NO_MESSAGES,
  children,
  className,
}: PhoneMockProps) {
  const body = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");

  const options = composer === false ? null : composer;
  const controlled = options?.value !== undefined;
  const text = controlled ? options?.value ?? "" : draft;
  const canSend = typeof options?.onSend === "function";

  const count = messages.length;

  /* A thread opens at its newest line. The body owns the scroll, so this never moves the page.
   * Keyed on the count, so a host re-render with the same thread leaves the reader where they are. */
  useEffect(() => {
    const node = body.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [count]);

  const change = (next: string) => {
    if (!options) return;
    options.onChange?.(next);
    if (!controlled) setDraft(next);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const send = options?.onSend;
    if (!send) return;
    const clean = text.trim();
    if (clean === "") return;
    send(clean);
    if (!controlled) setDraft("");
  };

  const last = messages.length - 1;

  return (
    <div className={["ui-phm", className].filter(Boolean).join(" ")}>
      <style href="ui-phone-mock" precedence="default">
        {css}
      </style>

      <span className="ui-phm__notch" aria-hidden="true" />

      <div className="ui-phm__screen">
        <div className="ui-phm__status">
          <span className="ui-phm__clock">{statusTime}</span>
          <span className="ui-phm__glyphs" aria-hidden="true">
            <svg viewBox="0 0 16 11" width="15" height="11" fill="none">
              <rect x="0" y="7" width="2.4" height="4" rx="0.8" fill="currentColor" />
              <rect x="4" y="5" width="2.4" height="6" rx="0.8" fill="currentColor" />
              <rect x="8" y="2.6" width="2.4" height="8.4" rx="0.8" fill="currentColor" />
              <rect x="12" y="0" width="2.4" height="11" rx="0.8" fill="currentColor" />
            </svg>
            <svg viewBox="0 0 20 10" width="19" height="10" fill="none">
              <rect
                x="0.5"
                y="0.5"
                width="16"
                height="9"
                rx="2.2"
                stroke="currentColor"
                opacity="0.45"
              />
              <rect x="2" y="2" width="10" height="6" rx="1.2" fill="currentColor" />
              <rect
                x="17.5"
                y="3.4"
                width="1.6"
                height="3.2"
                rx="0.8"
                fill="currentColor"
                opacity="0.45"
              />
            </svg>
          </span>
        </div>

        <div className="ui-phm__bar">
          {appBar.back !== false ? (
            <button type="button" className="ui-phm__back" aria-label="Back">
              <svg
                viewBox="0 0 16 16"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9.8 3.6 5.4 8l4.4 4.4" />
              </svg>
            </button>
          ) : null}

          <span className="ui-phm__avatar" aria-hidden="true">
            {appBar.avatar ?? (
              <svg
                viewBox="0 0 16 16"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              >
                <circle cx="8" cy="5.6" r="2.6" />
                <path d="M2.9 13.4c.7-2.4 2.7-3.8 5.1-3.8s4.4 1.4 5.1 3.8" />
              </svg>
            )}
          </span>

          <div className="ui-phm__id">
            <p className="ui-phm__title">{appBar.title}</p>
            {appBar.subtitle ? <p className="ui-phm__subtitle">{appBar.subtitle}</p> : null}
          </div>

          {appBar.tag ? <span className="ui-phm__tag">{appBar.tag}</span> : null}
        </div>

        <div className="ui-phm__body" ref={body} tabIndex={0} role="group" aria-label="Conversation">
          <div className="ui-phm__thread">
            {children}

            {messages.map((message, index) => (
              <div className="ui-phm__row" data-side={message.side} key={message.id}>
                <div className="ui-phm__bubble">
                  <p className="ui-phm__text">{message.text}</p>
                  {message.at || message.side === "out" ? (
                    <span className="ui-phm__meta">
                      {message.at ? <span>{message.at}</span> : null}
                      {message.side === "out" ? TICKS : null}
                    </span>
                  ) : null}
                </div>

                {index === last && message.side === "out" ? (
                  <span className="ui-phm__receipt">
                    {TICKS}
                    Delivered
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {options ? (
          <form className="ui-phm__composer" onSubmit={submit}>
            <span className="ui-phm__clip" aria-hidden="true">
              <svg
                viewBox="0 0 20 20"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M13.5 5.8 7.4 11.9a2.2 2.2 0 0 0 3.1 3.1l5.1-5.1a3.8 3.8 0 0 0-5.4-5.4L4.6 10.1a5.4 5.4 0 0 0 7.6 7.6" />
              </svg>
            </span>

            <input
              className="ui-phm__field"
              type="text"
              value={text}
              placeholder={options.placeholder ?? "Write a reply"}
              aria-label={options.label ?? "Reply"}
              onChange={(event) => change(event.target.value)}
              readOnly={controlled && !options.onChange}
              disabled={options.disabled}
              autoComplete="off"
              enterKeyHint="send"
            />

            {canSend ? (
              <button
                type="submit"
                className="ui-phm__send"
                aria-label="Send"
                disabled={options.disabled || text.trim() === ""}
              >
                <svg
                  viewBox="0 0 16 16"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M8 12.5V3.8M4.4 7.4 8 3.8l3.6 3.6" />
                </svg>
              </button>
            ) : (
              <span className="ui-phm__send" data-static="true" aria-hidden="true">
                <svg
                  viewBox="0 0 16 16"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 12.5V3.8M4.4 7.4 8 3.8l3.6 3.6" />
                </svg>
              </span>
            )}
          </form>
        ) : null}
      </div>
    </div>
  );
}

const css = /* css */ `
.ui-phm {
  /* Knobs. Override any of these on .ui-phm to retheme the frame in a host. */
  --ui-phm-frame: #14100d;
  --ui-phm-screen: var(--bg, #faf7f4);
  --ui-phm-ink: var(--text, #1a1410);
  --ui-phm-muted: var(--text-muted, #6f625a);
  --ui-phm-line: var(--border, #e8e0d7);
  --ui-phm-panel: var(--panel, #fffdfb);
  --ui-phm-accent: var(--accent, #c2410c);
  --ui-phm-bubble-ink: #fffdfb;
  --ui-phm-hover: #1a14100f;
  --ui-phm-scroll: #1a141026;
  --ui-phm-focus: var(--accent, #c2410c);
  --ui-phm-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-phm-dur-1: var(--nm-dur-1, 90ms);
  --ui-phm-dur-2: var(--nm-dur-2, 160ms);
  --ui-phm-dur-3: var(--nm-dur-3, 240ms);

  position: relative;
  isolation: isolate;
  box-sizing: border-box;
  display: flex;
  /* The only cap in the frame: the width also answers to the height cap, so a short or narrow
   * container scales the device down instead of clipping it. */
  width: min(18.5rem, 100%, calc(min(33rem, 68dvh) * 296 / 471));
  /* A grid or flex host sizes its track to this frame's min-content, and the content here
   * (bar, thread, composer) is wider than a 320px preview's column. Zeroing the minimum lets
   * the width cap above win, so the device scales down instead of pushing past the preview. */
  min-width: 0;
  max-height: min(33rem, 68dvh);
  aspect-ratio: 296 / 471;
  padding: 9px;
  background: var(--ui-phm-frame, #14100d);
  border-radius: 38px;
  box-shadow:
    inset 0 0 0 1px #ffffff1f,
    0 22px 44px -24px #14100d66,
    0 2px 6px -2px #14100d33;
  color: var(--ui-phm-ink, #1a1410);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 17px;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
}
.ui-phm *,
.ui-phm *::before,
.ui-phm *::after {
  box-sizing: border-box;
}
.ui-phm p {
  margin: 0;
}
:where(.ui-phm) button {
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
:where(.ui-phm) input {
  margin: 0;
  font: inherit;
}
:where(.ui-phm) svg {
  display: block;
}

/* Frame ------------------------------------------------------------------- */
.ui-phm__notch {
  position: absolute;
  z-index: 2;
  top: 11px;
  left: 50%;
  width: 98px;
  max-width: 46%;
  height: 25px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: var(--ui-phm-frame, #14100d);
  box-shadow: inset 0 0 0 1px #ffffff12;
  pointer-events: none;
}
.ui-phm__screen {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-radius: 28px;
  background: var(--ui-phm-screen, #faf7f4);
  box-shadow: inset 0 0 0 1px #14100d14;
}

/* Status bar -------------------------------------------------------------- */
.ui-phm__status {
  display: flex;
  flex: none;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
  padding: 0 20px 7px;
  color: var(--ui-phm-ink, #1a1410);
}
.ui-phm__clock {
  font-size: 11.5px;
  font-weight: 600;
  line-height: 14px;
  font-variant-numeric: tabular-nums;
}
.ui-phm__glyphs {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0.82;
}

/* In-app bar -------------------------------------------------------------- */
.ui-phm__bar {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: 2px 12px 8px;
}
.ui-phm__back {
  display: grid;
  flex: none;
  place-items: center;
  width: 32px;
  height: 32px;
  margin-left: -8px;
  border-radius: 999px;
  color: var(--ui-phm-ink, #1a1410);
  transition: background-color var(--ui-phm-dur-2, 160ms) var(--ui-phm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-phm__back:hover {
  background: var(--ui-phm-hover, #1a14100f);
}
.ui-phm__back:focus-visible {
  outline: 2px solid var(--ui-phm-focus, #c2410c);
  outline-offset: 1px;
}
.ui-phm__avatar {
  display: grid;
  flex: none;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: var(--ui-phm-panel, #fffdfb);
  box-shadow: inset 0 0 0 1px var(--ui-phm-line, #e8e0d7);
  color: var(--ui-phm-ink, #1a1410);
  font-size: 10.5px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.02em;
}
.ui-phm__id {
  display: grid;
  flex: 1;
  gap: 1px;
  min-width: 0;
}
.ui-phm__title {
  overflow: hidden;
  color: var(--ui-phm-ink, #1a1410);
  font-size: 13px;
  font-weight: 600;
  line-height: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ui-phm__subtitle {
  overflow: hidden;
  color: var(--ui-phm-muted, #6f625a);
  font-size: 10px;
  line-height: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ui-phm__tag {
  flex: none;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--ui-phm-accent, #c2410c);
  color: var(--ui-phm-bubble-ink, #fffdfb);
  font-size: 9px;
  font-weight: 600;
  line-height: 13px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* Screen body: the only scroller ------------------------------------------ */
.ui-phm__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: 6px 12px 12px;
  overflow-y: auto;
  overscroll-behavior: contain;
  /* A device screen shows no scrollbar; a thin bar inside a 296px frame reads as browser
   * chrome and eats the bubble measure. The cut bubble at the top edge is the affordance.
   * The colour stays declared for a host that opts the bar back in. */
  scrollbar-width: none;
  scrollbar-color: var(--ui-phm-scroll, #1a141026) transparent;
}
.ui-phm__body:focus-visible {
  outline: 2px solid var(--ui-phm-focus, #c2410c);
  outline-offset: -2px;
  border-radius: 10px;
}
.ui-phm__thread {
  display: grid;
  gap: 10px;
  margin-top: auto;
}

/* Bubbles ----------------------------------------------------------------- */
.ui-phm__row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-width: 88%;
}
.ui-phm__row[data-side="in"] {
  align-items: flex-start;
  margin-right: auto;
}
.ui-phm__row[data-side="out"] {
  align-items: flex-end;
  margin-left: auto;
}
.ui-phm__bubble {
  max-width: 100%;
  padding: 6px 9px 5px;
  border-radius: 16px;
  font-size: 12px;
  line-height: 17px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  animation: ui-phm-in var(--ui-phm-dur-3, 240ms) var(--ui-phm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both;
}
.ui-phm__row[data-side="in"] .ui-phm__bubble {
  border-bottom-left-radius: 6px;
  background: var(--ui-phm-panel, #fffdfb);
  box-shadow: inset 0 0 0 1px var(--ui-phm-line, #e8e0d7);
  color: var(--ui-phm-ink, #1a1410);
}
.ui-phm__row[data-side="out"] .ui-phm__bubble {
  border-bottom-right-radius: 6px;
  background-color: var(--ui-phm-accent, #c2410c);
  /* Darken downward only. A white sheen at the top lifted the light theme's accent to
   * #c85425, where the cream ink fell to 4.36:1; this keeps the ink above 5:1 in both. */
  background-image: linear-gradient(180deg, #00000000, #0000001a);
  box-shadow: inset 0 0 0 1px #00000012;
  color: var(--ui-phm-bubble-ink, #fffdfb);
}
.ui-phm__text {
  text-wrap: pretty;
}
.ui-phm__meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
  margin-top: 2px;
  font-size: 10px;
  line-height: 13px;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}
.ui-phm__row[data-side="in"] .ui-phm__meta {
  color: var(--ui-phm-muted, #6f625a);
}
.ui-phm__row[data-side="out"] .ui-phm__meta {
  color: var(--ui-phm-bubble-ink, #fffdfb);
}
.ui-phm__ticks {
  flex: none;
}
.ui-phm__receipt {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding-right: 2px;
  color: var(--ui-phm-muted, #6f625a);
  font-size: 10px;
  line-height: 13px;
  letter-spacing: 0.01em;
}
@keyframes ui-phm-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Composer ---------------------------------------------------------------- */
.ui-phm__composer {
  display: flex;
  flex: none;
  align-items: center;
  gap: 7px;
  padding: 8px 10px 10px;
  background: var(--ui-phm-screen, #faf7f4);
  box-shadow: inset 0 1px 0 var(--ui-phm-line, #e8e0d7);
}
.ui-phm__clip {
  display: grid;
  flex: none;
  place-items: center;
  width: 20px;
  height: 20px;
  color: var(--ui-phm-muted, #6f625a);
}
.ui-phm__field {
  flex: 1;
  min-width: 0;
  padding: 6px 12px;
  border: 0;
  border-radius: 999px;
  background: var(--ui-phm-panel, #fffdfb);
  box-shadow: inset 0 0 0 1px var(--ui-phm-line, #e8e0d7);
  color: var(--ui-phm-ink, #1a1410);
  font-size: 11.5px;
  line-height: 18px;
  letter-spacing: -0.01em;
  transition: box-shadow var(--ui-phm-dur-2, 160ms) var(--ui-phm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-phm__field::placeholder {
  color: var(--ui-phm-muted, #6f625a);
  opacity: 1;
}
.ui-phm__field:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 1.5px var(--ui-phm-accent, #c2410c);
}
.ui-phm__field:disabled {
  opacity: 0.6;
}
.ui-phm__send {
  display: grid;
  flex: none;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 999px;
  background: var(--ui-phm-accent, #c2410c);
  color: var(--ui-phm-bubble-ink, #fffdfb);
  transition:
    transform var(--ui-phm-dur-1, 90ms) var(--ui-phm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    opacity var(--ui-phm-dur-2, 160ms) var(--ui-phm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-phm__send:hover {
  transform: translateY(-1px);
}
.ui-phm__send:active {
  transform: scale(0.94);
}
.ui-phm__send:focus-visible {
  outline: 2px solid var(--ui-phm-focus, #c2410c);
  outline-offset: 2px;
}
.ui-phm__send:disabled {
  opacity: 0.45;
  transform: none;
}
.ui-phm__send[data-static="true"] {
  background: transparent;
  color: var(--ui-phm-accent, #c2410c);
  opacity: 0.75;
}

:where(.dark, [data-theme="dark"]) .ui-phm {
  --ui-phm-frame: #0d0a08;
  --ui-phm-screen: var(--bg, #14100d);
  --ui-phm-ink: var(--text, #f4ece4);
  --ui-phm-muted: var(--text-muted, #a2958a);
  --ui-phm-line: var(--border, #33291f);
  --ui-phm-panel: var(--panel, #1a1512);
  --ui-phm-accent: var(--accent, #ff6b35);
  --ui-phm-bubble-ink: #14100d;
  --ui-phm-hover: #ffffff0f;
  --ui-phm-scroll: #f4ece433;
  --ui-phm-focus: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  .ui-phm__back,
  .ui-phm__field,
  .ui-phm__send {
    transition-duration: 1ms;
  }
  .ui-phm__bubble {
    animation: none;
    opacity: 1;
    transform: none;
  }
  .ui-phm__send:hover,
  .ui-phm__send:active {
    transform: none;
  }
}
`;
