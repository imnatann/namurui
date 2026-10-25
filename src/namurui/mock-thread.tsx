"use client";

import { type CSSProperties, type ReactNode } from "react";

/*
 * Mock Thread: the static chat stack a marketing page shows - incoming bubbles on the surface
 * with a square bottom-left corner, outgoing bubbles on the accent gradient carrying their time
 * and an AI tag, an optional typing row, a centred handoff note and a cited-source block.
 * Rows rise in reading order on the entry curve, the typing dots breathe on the ambient curve,
 * and nothing here is a composer: it is a picture of a conversation, not a surface to type into.
 * Styles are injected below, so no extra files are needed.
 */

export type ChatBubble = {
  /** Stable key for the bubble */
  id: string;
  /** Who spoke: `in` is the customer, `out` is the assistant */
  side: "in" | "out";
  /** The message body */
  text: string;
  /** Avatar initials for an incoming row; outgoing rows carry the `AI` tag instead and ignore it */
  initials?: string;
  /** Clock label under an outgoing bubble, e.g. `09:41` */
  time?: string;
  /** Marks an outgoing bubble as the assistant's, and prints the `AI` tag */
  agent?: boolean;
};

export type MockThreadProps = {
  /** Bubbles in reading order */
  messages: readonly ChatBubble[];
  /** Shows the three-dot reply row after the last bubble */
  typing?: boolean;
  /** Spoken label for the typing row */
  typingLabel?: string;
  /** A centred pill under the thread, e.g. the handoff note */
  note?: ReactNode;
  /** The catalogue entry an answer cited: a pill and a short quote */
  source?: { label: string; quote: string };
  /** Avatar content per side; an incoming row falls back to the bubble's `initials` */
  avatars?: { in?: ReactNode; out?: ReactNode };
  /** Extra class on the root */
  className?: string;
};

export function MockThread({
  messages,
  typing = false,
  typingLabel = "Reply in progress",
  note,
  source,
  avatars,
  className,
}: MockThreadProps) {
  /* The typing row wears the avatar of whoever spoke last on the incoming side, so the dots
   * look like a continuation of that person rather than a new participant. */
  const lastIn = messages.slice().reverse().find((bubble) => bubble.side === "in");
  const typingFace = avatars?.in ?? lastIn?.initials;

  return (
    <div className={["ui-mth", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-mock-thread" precedence="default">
        {css}
      </style>

      {messages.map((bubble, index) => {
        const out = bubble.side === "out";
        /* An outgoing row states the assistant once, on the `AI` tag in its bubble: the initials
         * avatar is incoming only, so a 24px circle never competes with that tag for the name. */
        const face = out ? avatars?.out : (avatars?.in ?? bubble.initials);
        return (
          <div
            key={bubble.id}
            className="ui-mth__row"
            data-side={bubble.side}
            style={{ "--ui-mth-i": index } as CSSProperties}
          >
            {face === undefined || face === null || face === "" ? null : (
              <span className="ui-mth__avatar" aria-hidden="true">
                {face}
              </span>
            )}
            <div className="ui-mth__bubble">
              <p className="ui-mth__text">{bubble.text}</p>
              {out && (bubble.time !== undefined || bubble.agent) ? (
                <p className="ui-mth__meta">
                  {bubble.time === undefined ? null : (
                    <span className="ui-mth__time">{bubble.time}</span>
                  )}
                  {bubble.agent ? <span className="ui-mth__tag">AI</span> : null}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}

      {typing ? (
        <div
          className="ui-mth__row"
          data-side="in"
          data-typing="true"
          style={{ "--ui-mth-i": 0 } as CSSProperties}
          role="status"
          aria-live="polite"
        >
          {typingFace === undefined || typingFace === null || typingFace === "" ? null : (
            <span className="ui-mth__avatar" aria-hidden="true">
              {typingFace}
            </span>
          )}
          <div className="ui-mth__bubble" data-typing="true" aria-hidden="true">
            <span className="ui-mth__dot" />
            <span className="ui-mth__dot" />
            <span className="ui-mth__dot" />
          </div>
          <span className="ui-mth__sr">{typingLabel}</span>
        </div>
      ) : null}

      {note === undefined || note === null || note === "" ? null : (
        <div className="ui-mth__note">
          <span className="ui-mth__note-dot" aria-hidden="true" />
          <span className="ui-mth__note-text">{note}</span>
        </div>
      )}

      {source === undefined ? null : (
        <div className="ui-mth__source">
          <span className="ui-mth__cite">{source.label}</span>
          <p className="ui-mth__quote">“{source.quote}”</p>
        </div>
      )}
    </div>
  );
}

const css = /* css */ `
.ui-mth {
  /* Knobs. Override any of these on .ui-mth to retheme the thread in a host. */
  --ui-mth-ink: var(--text, #1a1410);
  --ui-mth-muted: var(--text-muted, #6f625a);
  --ui-mth-panel: var(--panel, #fffdfb);
  --ui-mth-note-bg: #fffdfbe6;
  --ui-mth-line: var(--border, #e8e0d7);
  --ui-mth-lift: #3d1f0a14;
  --ui-mth-avatar: var(--muted-bg, #7a4a1c0a);
  --ui-mth-accent: var(--accent, #c2410c);
  --ui-mth-accent-deep: var(--accent-hover, #9a3412);
  --ui-mth-accent-ink: var(--accent-fg, #fffdfb);
  --ui-mth-accent-soft: var(--accent-soft, #c2410c1a);
  --ui-mth-accent-text: var(--accent-hover, #9a3412);
  --ui-mth-dur: var(--nm-dur-3, 240ms);
  --ui-mth-step: var(--nm-dur-1, 90ms);
  --ui-mth-loop: var(--nm-dur-6, 1100ms);
  --ui-mth-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-mth-ease-soft: var(--nm-ease-soft, cubic-bezier(0.4, 0, 0.2, 1));
  --ui-mth-lines: 2;

  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  position: relative;
  color: var(--ui-mth-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 20px;
  overflow-wrap: break-word;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-mth *,
.ui-mth *::before,
.ui-mth *::after {
  box-sizing: border-box;
}
.ui-mth p {
  margin: 0;
}

/* A row ------------------------------------------------------------------- */
/* Reading order is the stagger: the index travels in on --ui-mth-i, so a thread that arrives
 * together still reads top to bottom instead of landing as one block. */
.ui-mth__row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  min-width: 0;
  max-width: 90%;
  animation: ui-mth-row-in var(--ui-mth-dur) var(--ui-mth-ease-out) backwards;
  animation-delay: calc(var(--ui-mth-i, 0) * var(--ui-mth-step));
}
.ui-mth__row[data-side="out"] {
  flex-direction: row-reverse;
  max-width: 92%;
  margin-left: auto;
}
@keyframes ui-mth-row-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}

.ui-mth__avatar {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  overflow: hidden;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-mth-avatar);
  box-shadow: inset 0 0 0 1px var(--ui-mth-line);
  color: var(--ui-mth-muted);
  font-size: 9px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
/* The assistant's own avatar is tinted, so the two sides never read as one column. */
.ui-mth__row[data-side="out"] .ui-mth__avatar {
  background: var(--ui-mth-accent-soft);
  box-shadow: none;
  color: var(--ui-mth-accent-text);
}

/* A bubble ---------------------------------------------------------------- */
.ui-mth__bubble {
  min-width: 0;
  max-width: 100%;
  padding: 8px 12px;
  border-radius: var(--radius-card, 16px);
  background: var(--ui-mth-panel);
  box-shadow:
    inset 0 0 0 1px var(--ui-mth-line),
    0 1px 2px var(--ui-mth-lift);
}
.ui-mth__row[data-side="in"] .ui-mth__bubble {
  border-bottom-left-radius: 4px;
}
.ui-mth__row[data-side="out"] .ui-mth__bubble {
  border-bottom-right-radius: 4px;
  background-image: linear-gradient(135deg, var(--ui-mth-accent), var(--ui-mth-accent-deep));
  box-shadow: 0 6px 14px -10px var(--ui-mth-accent);
  color: var(--ui-mth-accent-ink);
}
.ui-mth__text {
  /* A marketing card holds a short answer: two lines by default, and a host that needs the whole
   * message sets a larger --ui-mth-lines on .ui-mth. */
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: var(--ui-mth-lines, 2);
  line-clamp: var(--ui-mth-lines, 2);
  font-size: 12px;
  line-height: 20px;
}

/* Time and the agent tag sit inside the outgoing bubble, right aligned. The tag is the word AI on
 * a hairline ring: the fact that the assistant answered is never carried by colour. */
.ui-mth__meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 3px;
  font-size: 10px;
  line-height: 14px;
}
.ui-mth__time {
  font-variant-numeric: tabular-nums;
}
.ui-mth__tag {
  display: inline-flex;
  align-items: center;
  height: 15px;
  padding: 0 5px;
  border-radius: var(--radius-pill, 999px);
  box-shadow: inset 0 0 0 1px currentColor;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.03em;
}

/* The typing row ---------------------------------------------------------- */
.ui-mth__row[data-typing="true"] {
  align-items: flex-end;
}
.ui-mth__bubble[data-typing="true"] {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 10px 12px;
}
.ui-mth__dot {
  width: 4px;
  height: 4px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-mth-muted);
  animation: ui-mth-dot var(--ui-mth-loop) var(--ui-mth-ease-soft) infinite;
}
.ui-mth__dot:nth-child(2) {
  animation-delay: var(--nm-dur-2, 160ms);
}
.ui-mth__dot:nth-child(3) {
  animation-delay: calc(var(--nm-dur-2, 160ms) * 2);
}
@keyframes ui-mth-dot {
  0%,
  60%,
  100% {
    opacity: 0.35;
    transform: translateY(0) scale(0.8);
  }
  30% {
    opacity: 1;
    transform: translateY(-1px) scale(1);
  }
}

/* The handoff note -------------------------------------------------------- */
.ui-mth__note {
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  height: 29px;
  padding: 0 12px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-mth-note-bg);
  box-shadow: inset 0 0 0 1px var(--ui-mth-line);
  color: var(--ui-mth-muted);
  font-size: 11px;
  line-height: 15px;
  animation: ui-mth-note-in var(--ui-mth-dur) var(--ui-mth-ease-out) backwards;
}
.ui-mth__note-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-mth-accent);
}
.ui-mth__note-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@keyframes ui-mth-note-in {
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.96);
  }
}

/* The cited source -------------------------------------------------------- */
.ui-mth__source {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  max-width: 92%;
  animation: ui-mth-note-in var(--ui-mth-dur) var(--ui-mth-ease-out) backwards;
}
.ui-mth__cite {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  height: 20px;
  padding: 0 8px;
  overflow: hidden;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-mth-accent-soft);
  color: var(--ui-mth-accent-text);
  font-size: 10px;
  font-weight: 600;
  line-height: 14px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-mth__quote {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: var(--ui-mth-lines, 2);
  line-clamp: var(--ui-mth-lines, 2);
  color: var(--ui-mth-muted);
  font-size: 12px;
  line-height: 20px;
}

/* The typing row reads its label, not its dots ---------------------------- */
.ui-mth__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  white-space: nowrap;
  border: 0;
  clip-path: inset(50%);
}

:where(.dark, [data-theme="dark"]) .ui-mth {
  --ui-mth-ink: var(--text, #f4ece4);
  --ui-mth-muted: var(--text-muted, #a2958a);
  --ui-mth-panel: var(--panel, #1a1512);
  --ui-mth-note-bg: #201a15e6;
  --ui-mth-line: var(--border, #33291f);
  --ui-mth-lift: #00000059;
  --ui-mth-avatar: var(--muted-bg, #ffffff0d);
  --ui-mth-accent: var(--accent, #ff6b35);
  --ui-mth-accent-deep: var(--accent-hover, #ff8256);
  --ui-mth-accent-ink: var(--accent-fg, #1a0f08);
  --ui-mth-accent-soft: var(--accent-soft, #ff6b3524);
  --ui-mth-accent-text: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  .ui-mth__row,
  .ui-mth__note,
  .ui-mth__source {
    animation: none;
    transition-duration: 1ms;
  }
  .ui-mth__dot {
    animation: none;
    opacity: 0.7;
  }
}
`;
