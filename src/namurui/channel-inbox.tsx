"use client";

import { useId, type CSSProperties, type ReactNode } from "react";

/*
 * Channel Inbox: a compact titled window that lists three conversations from different channels,
 * each row carrying a channel mark, an unread dot and a status chip. Rows arrive on the stagger
 * token and lift on hover with an inset ring and a shadow, so nothing beside them moves.
 * The styles are injected below, so no extra files are needed.
 */

export type PreviewConversation = {
  /** Stable key for the row */
  id: string;
  /** Customer name as the list shows it */
  name: string;
  /** Two letters for the avatar disc */
  initials: string;
  /** Channel the conversation arrived on; the mark is drawn from this */
  channel: "whatsapp" | "instagram" | "telegram" | "web";
  /** Last message, clipped to one line */
  preview: string;
  /** Status word; the chip always carries this text */
  status: string;
  /** Chip tone: accent for a new conversation, info for one the AI answered */
  statusTone: "accent" | "info" | "neutral";
  /** Shows the accent dot beside the name and announces it to a screen reader */
  unread?: boolean;
};

export type ChannelInboxProps = {
  /** Window title; the list is labelled by it */
  title?: string;
  /** Right side of the header; defaults to the open count */
  meta?: ReactNode;
  /** Conversations, in display order */
  items: readonly PreviewConversation[];
  /** Extra class on the root */
  className?: string;
};

const CHANNEL_NAME: Record<PreviewConversation["channel"], string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  telegram: "Telegram",
  web: "Web",
};

/* The four channel marks, drawn here so the item never depends on an icon package or an
 * external file. Each sits inside a 16-unit viewBox with a 2-unit margin, which leaves the
 * stroke clear of the 14px badge that holds it. */
const CHANNEL_MARK: Record<PreviewConversation["channel"], ReactNode> = {
  whatsapp: (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="7.7" r="5.2" />
      <path d="M4.35 11.35 3.4 13.6l2.3-.8" />
      <path d="M6.1 5.6c.2-.3.5-.3.7 0l.5.8c.1.2.1.4-.1.6l-.3.3c.3.8.9 1.4 1.7 1.7l.3-.3c.2-.2.4-.2.6-.1l.8.5c.3.2.3.5 0 .7-.5.3-1.1.4-1.7.2A4.3 4.3 0 0 1 5.9 7.3c-.2-.6-.1-1.2.2-1.7Z" />
    </svg>
  ),
  instagram: (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.7" y="2.7" width="10.6" height="10.6" rx="3.4" />
      <circle cx="8" cy="8" r="2.4" />
      <circle cx="11.2" cy="4.9" r="0.85" fill="currentColor" stroke="none" />
    </svg>
  ),
  telegram: (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13.4 3.2 2.9 7.4c-.4.2-.4.7 0 .9l2.6 1 1 2.9c.1.4.6.5.9.2l1.5-1.5 2.3 1.6c.4.3.9.1 1-.4l1.4-8.2c.1-.5-.4-.9-.8-.7Z" />
      <path d="m5.7 9.4 7.2-5.7" />
    </svg>
  ),
  web: (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="5.3" />
      <path d="M2.8 8h10.4" />
      <path d="M8 2.7c1.5 1.5 2.3 3.3 2.3 5.3S9.5 11.8 8 13.3C6.5 11.8 5.7 10 5.7 8S6.5 4.2 8 2.7Z" />
    </svg>
  ),
};

export function ChannelInbox({ title = "Inbox", meta, items, className }: ChannelInboxProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const titleId = `${uid}-title`;

  return (
    <div className={["ui-cin", className].filter(Boolean).join(" ")}>
      <style href="ui-channel-inbox" precedence="default">
        {css}
      </style>

      <div className="ui-cin__bar">
        <span className="ui-cin__lights" aria-hidden="true">
          <span className="ui-cin__light" />
          <span className="ui-cin__light" />
          <span className="ui-cin__light" />
        </span>
        <span className="ui-cin__title" id={titleId}>
          {title}
        </span>
        <span className="ui-cin__meta">{meta ?? `${items.length} terbuka`}</span>
      </div>

      <ul className="ui-cin__list" aria-labelledby={titleId}>
        {items.map((item, index) => (
          <li
            key={item.id}
            className="ui-cin__row"
            style={{ "--ui-cin-i": index } as CSSProperties}
          >
            <span className="ui-cin__avatar" aria-hidden="true">
              <span className="ui-cin__initials">{item.initials}</span>
              <span className="ui-cin__mark">{CHANNEL_MARK[item.channel]}</span>
            </span>

            <span className="ui-cin__body">
              <span className="ui-cin__head">
                <span className="ui-cin__sr">{CHANNEL_NAME[item.channel]}</span>
                <span className="ui-cin__name">{item.name}</span>
                {item.unread ? (
                  <>
                    <span className="ui-cin__unread" aria-hidden="true" />
                    <span className="ui-cin__sr">Belum dibaca</span>
                  </>
                ) : null}
              </span>
              <span className="ui-cin__preview">{item.preview}</span>
              <span className="ui-cin__chip" data-tone={item.statusTone}>
                {item.status}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const css = /* css */ `
.ui-cin {
  /* Knobs. Override any of these on .ui-cin to retheme the window in a host. */
  --ui-cin-panel: var(--panel, #fffdfb);
  --ui-cin-ink: var(--text, #1a1410);
  --ui-cin-muted: var(--text-muted, #6f625a);
  --ui-cin-line: var(--border, #e8e0d7);
  --ui-cin-edge: var(--border-soft, #1a14101a);
  --ui-cin-wash: #7a4a1c12;
  --ui-cin-hover: #7a4a1c10;
  --ui-cin-ring: #1a141024;
  --ui-cin-shadow: #1a141040;
  --ui-cin-dot: #c9beb2;
  --ui-cin-accent: var(--accent, #c2410c);
  --ui-cin-accent-ink: var(--accent, #c2410c);
  --ui-cin-accent-wash: #c2410c14;
  --ui-cin-accent-halo: #c2410c1f;
  /* Info is emphasis, not a status hue: a conversation the AI answered lifts onto the
   * raised ground behind a hairline ring, so it reads louder than neutral without
   * borrowing a colour the palette already reports as a state. Ember keeps exactly
   * three semantic colours on purpose, and ember itself stays reserved for the one new
   * conversation; the chip's own word carries the meaning, never the colour alone.
   * Measured: info text 18.24:1 (#1a1410 on #ffffff); neutral text 5.29:1
   * (#6f625a on #7a4a1c0f over #fffdfb). */
  --ui-cin-info-ground: var(--raised, #ffffff);
  --ui-cin-neutral-wash: #7a4a1c0f;
  --ui-cin-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-cin-dur-2: var(--nm-dur-2, 160ms);
  --ui-cin-dur-3: var(--nm-dur-3, 240ms);
  --ui-cin-stagger: var(--nm-stagger, 45ms);

  position: relative;
  box-sizing: border-box;
  width: 100%;
  max-width: 360px;
  background: var(--ui-cin-panel);
  border-radius: var(--radius-preview, 12px);
  box-shadow: inset 0 0 0 1px var(--ui-cin-line);
  color: var(--ui-cin-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 18px;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-cin *,
.ui-cin *::before,
.ui-cin *::after {
  box-sizing: border-box;
}
.ui-cin ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
.ui-cin svg {
  display: block;
}

/* Header ------------------------------------------------------------------ */
.ui-cin__bar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 12px;
  box-shadow: inset 0 -1px 0 var(--ui-cin-line);
}
.ui-cin__lights {
  display: inline-flex;
  flex: none;
  gap: 4px;
}
.ui-cin__light {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--ui-cin-dot);
}
.ui-cin__light:nth-child(3) {
  opacity: 0.45;
}
.ui-cin__title {
  margin-left: 2px;
  overflow: hidden;
  color: var(--ui-cin-ink);
  font-size: 11px;
  font-weight: 600;
  line-height: 14px;
  letter-spacing: 0;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-cin__meta {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 55%;
  margin-left: auto;
  overflow: hidden;
  color: var(--ui-cin-muted);
  font-size: 10.5px;
  line-height: 14px;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}

/* Rows -------------------------------------------------------------------- */
.ui-cin__row {
  position: relative;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: center;
  column-gap: 9px;
  height: 74px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--ui-cin-line);
  background: transparent;
  transition:
    transform var(--ui-cin-dur-2) var(--ui-cin-ease-out),
    box-shadow var(--ui-cin-dur-2) var(--ui-cin-ease-out),
    background-color var(--ui-cin-dur-2) var(--ui-cin-ease-out);
  /* A backwards fill holds the entry frame through the stagger delay and releases the row
   * once it lands, so the hover lift is not pinned by a finished animation. */
  animation: ui-cin-in var(--ui-cin-dur-3) var(--ui-cin-ease-out) calc(var(--ui-cin-i, 0) * var(--ui-cin-stagger)) backwards;
}
.ui-cin__row:last-child {
  border-bottom: 0;
  border-radius: 0 0 11px 11px;
}
/* The lift is a transform and the ring is an inset shadow, so the row never changes the
 * height of the list while it is under the pointer. */
.ui-cin__row:hover {
  z-index: 1;
  background: var(--ui-cin-hover);
  transform: translateY(-1px);
  box-shadow:
    inset 0 0 0 1px var(--ui-cin-ring),
    0 8px 18px -12px var(--ui-cin-shadow);
}
@keyframes ui-cin-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Avatar and channel mark ------------------------------------------------- */
.ui-cin__avatar {
  position: relative;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: var(--ui-cin-wash);
  box-shadow: inset 0 0 0 1px var(--ui-cin-edge);
  color: var(--ui-cin-ink);
}
.ui-cin__initials {
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  /* Keeps the second letter clear of the channel badge that sits over the lower right. */
  transform: translate(-1px, -1px);
}
/* Pinned to the lower right corner; the badge is 16px so the 14px mark inside it keeps its
 * drawn size and its strokes stay legible, while the ring still reads as a stamp on the disc. */
.ui-cin__mark {
  position: absolute;
  right: -4px;
  bottom: -3px;
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: var(--ui-cin-panel);
  box-shadow: inset 0 0 0 1px var(--ui-cin-line);
  color: var(--ui-cin-muted);
}
.ui-cin__mark svg {
  width: 14px;
  height: 14px;
}

/* Text -------------------------------------------------------------------- */
.ui-cin__body {
  display: grid;
  gap: 2px;
  align-content: center;
  min-width: 0;
}
.ui-cin__head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.ui-cin__name {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--ui-cin-ink);
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-cin__unread {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--ui-cin-accent);
  box-shadow: 0 0 0 3px var(--ui-cin-accent-halo);
}
.ui-cin__preview {
  overflow: hidden;
  color: var(--ui-cin-muted);
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-cin__chip {
  justify-self: start;
  padding: 2px 7px;
  border-radius: 6px;
  font-size: 10.5px;
  font-weight: 600;
  line-height: 15px;
  letter-spacing: 0.01em;
  white-space: nowrap;
}
.ui-cin__chip[data-tone="accent"] {
  background: var(--ui-cin-accent-wash);
  color: var(--ui-cin-accent-ink, #c2410c);
}
.ui-cin__chip[data-tone="info"] {
  background: var(--ui-cin-info-ground);
  box-shadow: inset 0 0 0 1px var(--ui-cin-line);
  color: var(--ui-cin-ink);
}
.ui-cin__chip[data-tone="neutral"] {
  background: var(--ui-cin-neutral-wash);
  color: var(--ui-cin-muted);
}

/* Edges ------------------------------------------------------------------- */
.ui-cin__sr {
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

:where(.dark, [data-theme="dark"]) .ui-cin {
  /* The preview backdrop is a --preview to --card gradient, so a flat --preview fill sinks
   * the window below its own page; six percent of ink lifts it clear of the whole ramp. */
  --ui-cin-panel: color-mix(in srgb, var(--preview, #26201a) 94%, var(--text, #f4ece4));
  --ui-cin-ink: var(--text, #f4ece4);
  /* The lifted ground costs the muted token half a stop, so a little ink goes back in:
   * 82% muted over 18% ink clears 4.5:1 for the preview line and the neutral chip. */
  --ui-cin-muted: color-mix(in srgb, var(--text-muted, #a2958a) 82%, var(--text, #f4ece4));
  /* --border is tuned to sit on --panel; on this lifted surface it fades, so the hairline
   * takes a fifth of the ink and reads as a real edge. */
  --ui-cin-line: color-mix(in srgb, var(--border, #33291f) 80%, var(--text, #f4ece4));
  --ui-cin-edge: var(--border-soft, #ffffff12);
  --ui-cin-wash: #ffffff0d;
  --ui-cin-hover: #ffffff0a;
  --ui-cin-ring: #ffffff26;
  --ui-cin-shadow: #00000059;
  --ui-cin-dot: #4a3f36;
  --ui-cin-accent: var(--accent, #ff6b35);
  /* Ember on its own wash loses 0.5 of contrast on the lifted ground; the hover step of the
   * same token carries the label back over 4.5:1 while the dot keeps the base ember. */
  --ui-cin-accent-ink: var(--accent-hover, #ff8256);
  --ui-cin-accent-wash: #ff6b3524;
  --ui-cin-accent-halo: #ff6b352e;
  /* Same quiet emphasis on the dark ground, a step above the lifted panel rather than the
   * older --raised that now sits below it: info label 10.1:1 (#f4ece4 on #3c3630);
   * neutral label 4.7:1, accent label 4.6:1. */
  --ui-cin-info-ground: color-mix(in srgb, var(--text, #f4ece4) 5%, var(--ui-cin-panel, #322c26));
  --ui-cin-neutral-wash: #ffffff10;
}

@media (prefers-reduced-motion: reduce) {
  .ui-cin__row {
    animation: none;
    opacity: 1;
    transform: none;
    transition-duration: 1ms;
  }
  .ui-cin__row:hover {
    transform: none;
  }
}
`;
