"use client";

import { useEffect, useId, useRef, useState } from "react";

/*
 * CS Inbox: the full customer-service product shot. A 320px pane holds the search, two filter
 * rows and the conversation list, beside the open thread with its takeover bar. The filter rows
 * really narrow the list and the count, a row really raises, and Takeover really moves the thread
 * from the AI to a person: the mark, the bar and the AI tags on outgoing bubbles all change with
 * it. Styles are injected below, so no extra files are needed.
 */

/* The thread bubble, declared here on purpose: this component imports no other component's
 * shape, so a host can pass its own model without a cross import. */
type ChatBubble = {
  id: string;
  side: "in" | "out";
  text: string;
  time?: string;
  agent?: boolean;
};

export type InboxConversation = {
  /** Stable id, echoed by `onSelect` and `onTakeover` */
  id: string;
  /** Customer name shown in the row and the thread head */
  name: string;
  /** Avatar initials, one to three characters */
  initials: string;
  /** Channel the conversation arrived on */
  channel: "whatsapp" | "instagram" | "telegram" | "web";
  /** Last message, one line in the row */
  preview: string;
  /** Status chip text, for example "AI membalas" or "Menunggu pembayaran" */
  status: string;
  /** Chip tone; status is never carried by colour alone */
  statusTone: "neutral" | "accent" | "success" | "warning" | "danger";
  /** Shows an unread dot until the pane action marks everything read */
  unread?: boolean;
  /** Relative time in the row, for example "09.41" */
  at?: string;
  /** Thread messages, oldest first */
  messages: ChatBubble[];
  /** Filter bucket of the first row; `open` when omitted */
  state?: "open" | "done";
  /** Who answers now; `ai` when omitted, `human` starts already taken over */
  owner?: "ai" | "human";
  /** Handle under the name in the thread head */
  handle?: string;
};

export type CsInboxProps = {
  /** Conversations in list order */
  conversations: InboxConversation[];
  /** Row open on first paint; the first visible row is used when omitted */
  defaultSelectedId?: string;
  /** Fires with the conversation id when a row is picked */
  onSelect?: (id: string) => void;
  /** Fires with the conversation id when the thread is taken over */
  onTakeover?: (id: string) => void;
  /** Extra class on the root */
  className?: string;
};

const CHANNEL_LABEL: Record<InboxConversation["channel"], string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  telegram: "Telegram",
  web: "Web",
};

export function CsInbox({
  conversations,
  defaultSelectedId,
  onSelect,
  onTakeover,
  className,
}: CsInboxProps) {
  const searchId = useId();
  const log = useRef<HTMLDivElement>(null);
  const barState = useRef<HTMLSpanElement>(null);

  const [query, setQuery] = useState("");
  const [box, setBox] = useState<"open" | "done">("open");
  const [who, setWho] = useState<"all" | "ai" | "human">("all");
  const [selectedId, setSelectedId] = useState(defaultSelectedId);
  const [taken, setTaken] = useState<Record<string, boolean>>({});
  const [readAll, setReadAll] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  /* A conversation taken over in this session answers as a person from then on. The flag is kept
   * by id, so switching rows and coming back keeps the handover. */
  const ownerOf = (item: InboxConversation): "ai" | "human" =>
    taken[item.id] || item.owner === "human" ? "human" : "ai";

  const needle = query.trim().toLowerCase();
  const visible = conversations.filter((item) => {
    if ((item.state ?? "open") !== box) return false;
    if (who !== "all" && ownerOf(item) !== who) return false;
    if (!needle) return true;
    return (
      item.name.toLowerCase().includes(needle) || item.preview.toLowerCase().includes(needle)
    );
  });

  /* The open thread is not tied to the filter: taking over while the AI filter is on must not
   * throw the reader into a different conversation. A row that was filtered out keeps its thread. */
  const active = conversations.find((item) => item.id === selectedId) ?? visible[0] ?? null;
  const human = active !== null && ownerOf(active) === "human";

  /* The thread opens at its last message, the way a live inbox does. */
  useEffect(() => {
    const node = log.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [active?.id, human]);

  const pick = (id: string) => {
    setSelectedId(id);
    onSelect?.(id);
  };

  const takeover = () => {
    if (!active || human) return;
    const { id, name } = active;
    setTaken((current) => ({ ...current, [id]: true }));
    setAnnouncement(
      `${name} diambil alih. AI berhenti membalas dan balasan Anda terkirim langsung.`,
    );
    onTakeover?.(id);
    /* The button that was pressed is gone on the next paint, so focus moves to the state line
     * instead of falling back to the document. */
    requestAnimationFrame(() => barState.current?.focus());
  };

  const count =
    visible.length === conversations.length
      ? `${conversations.length} percakapan`
      : `${visible.length} dari ${conversations.length} percakapan`;

  return (
    <div className={["ui-csi", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-cs-inbox" precedence="default">
        {css}
      </style>

      <div className="ui-csi__frame">
        <aside className="ui-csi__pane" aria-label="Daftar percakapan">
          <div className="ui-csi__pane-head">
            <div className="ui-csi__pane-title">
              <span className="ui-csi__pane-name">Semua Inbox</span>
              <button
                type="button"
                className="ui-csi__act"
                aria-pressed={readAll}
                aria-label="Tandai semua sudah dibaca"
                title="Tandai semua sudah dibaca"
                onClick={() => setReadAll((current) => !current)}
              >
                <CheckGlyph />
              </button>
            </div>

            <label className="ui-csi__sr" htmlFor={searchId}>
              Cari percakapan
            </label>
            <div className="ui-csi__search">
              <span className="ui-csi__search-icon" aria-hidden="true">
                <SearchGlyph />
              </span>
              <input
                id={searchId}
                type="search"
                className="ui-csi__input"
                value={query}
                placeholder="Cari nama atau pesan"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            <div className="ui-csi__segments">
              <div className="ui-csi__seg" role="group" aria-label="Status percakapan">
                <button
                  type="button"
                  aria-pressed={box === "open"}
                  onClick={() => setBox("open")}
                >
                  Terbuka
                </button>
                <button
                  type="button"
                  aria-pressed={box === "done"}
                  onClick={() => setBox("done")}
                >
                  Selesai
                </button>
              </div>
              <div className="ui-csi__seg" role="group" aria-label="Penangan percakapan">
                <button
                  type="button"
                  aria-pressed={who === "all"}
                  onClick={() => setWho("all")}
                >
                  Semua
                </button>
                <button type="button" aria-pressed={who === "ai"} onClick={() => setWho("ai")}>
                  AI
                </button>
                <button
                  type="button"
                  aria-pressed={who === "human"}
                  onClick={() => setWho("human")}
                >
                  Manusia
                </button>
              </div>
            </div>
          </div>

          <div className="ui-csi__count" role="status" aria-live="polite">
            {count}
          </div>

          <ul className="ui-csi__list">
            {visible.length === 0 ? (
              <li className="ui-csi__empty">Tidak ada percakapan yang cocok.</li>
            ) : (
              visible.map((item) => {
                const current = item.id === active?.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="ui-csi__row"
                      data-active={current ? "true" : undefined}
                      aria-current={current ? "true" : undefined}
                      onClick={() => pick(item.id)}
                    >
                      <span className="ui-csi__avatar" aria-hidden="true">
                        {item.initials}
                        <span className="ui-csi__mark" data-channel={item.channel}>
                          <ChannelGlyph channel={item.channel} size={10} />
                        </span>
                      </span>
                      <span className="ui-csi__row-main">
                        <span className="ui-csi__row-top">
                          <span className="ui-csi__row-name">{item.name}</span>
                          {item.at ? <span className="ui-csi__row-time">{item.at}</span> : null}
                        </span>
                        <span className="ui-csi__row-preview">{item.preview}</span>
                        <span className="ui-csi__row-foot">
                          <span className="ui-csi__chip" data-tone={item.statusTone}>
                            {item.status}
                          </span>
                          {item.unread && !readAll ? (
                            <>
                              <span className="ui-csi__dot" aria-hidden="true" />
                              <span className="ui-csi__sr">Belum dibaca</span>
                            </>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        <section
          className="ui-csi__thread"
          aria-label={active ? `Percakapan dengan ${active.name}` : "Percakapan"}
        >
          {active ? (
            <>
              <header className="ui-csi__head">
                <span className="ui-csi__avatar" aria-hidden="true">
                  {active.initials}
                </span>
                <div className="ui-csi__ident">
                  <span className="ui-csi__name-row">
                    <span className="ui-csi__name">{active.name}</span>
                    <span className="ui-csi__chan" data-channel={active.channel}>
                      <ChannelGlyph channel={active.channel} size={11} />
                      {CHANNEL_LABEL[active.channel]}
                    </span>
                  </span>
                  {active.handle ? (
                    <span className="ui-csi__handle">{active.handle}</span>
                  ) : null}
                </div>
                <div className="ui-csi__head-actions">
                  <span className="ui-csi__mode" data-mode={human ? "human" : "ai"}>
                    {human ? <PersonGlyph /> : <SparkGlyph />}
                    {human ? "Ditangani Anda" : "AI Aktif"}
                  </span>
                  {human ? null : (
                    <button
                      type="button"
                      className="ui-csi__takeover ui-csi__takeover--head"
                      onClick={takeover}
                    >
                      Takeover
                    </button>
                  )}
                </div>
              </header>

              <div
                ref={log}
                className="ui-csi__log"
                role="log"
                aria-live="polite"
                aria-relevant="additions text"
                aria-label={`Pesan dengan ${active.name}`}
              >
                {active.messages.length === 0 ? (
                  <p className="ui-csi__void-line">Belum ada pesan.</p>
                ) : (
                  active.messages.map((message) => {
                    const outgoing = message.side === "out";
                    return (
                      <div key={message.id} className="ui-csi__msg" data-side={message.side}>
                        {outgoing ? null : (
                          <span className="ui-csi__msg-avatar" aria-hidden="true">
                            {active.initials}
                          </span>
                        )}
                        <div className="ui-csi__msg-body">
                          <div className="ui-csi__bubble">{message.text}</div>
                          <div className="ui-csi__msg-foot">
                            {message.time ? <time>{message.time}</time> : null}
                            {outgoing && message.agent && !human ? (
                              <span className="ui-csi__ai">AI</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <footer className="ui-csi__bar" data-mode={human ? "human" : "ai"}>
                <p className="ui-csi__bar-title">
                  {human
                    ? "Anda menangani percakapan ini"
                    : "AI sedang menangani percakapan ini"}
                </p>
                <p className="ui-csi__bar-sub">
                  {human
                    ? "Balasan Anda terkirim langsung ke pelanggan."
                    : "Ambil alih untuk membalas secara langsung."}
                </p>
                {human ? (
                  <span ref={barState} className="ui-csi__bar-state" tabIndex={-1}>
                    <PersonGlyph />
                    AI dihentikan
                  </span>
                ) : (
                  <button
                    type="button"
                    className="ui-csi__takeover ui-csi__takeover--bar"
                    onClick={takeover}
                  >
                    Takeover
                  </button>
                )}
              </footer>
            </>
          ) : (
            <div className="ui-csi__void">
              <p className="ui-csi__void-title">Pilih percakapan</p>
              <p className="ui-csi__void-sub">Percakapan yang Anda buka muncul di sini.</p>
            </div>
          )}
        </section>
      </div>

      <p className="ui-csi__sr" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

/* Channel marks and small glyphs, drawn here so the component carries no icon dependency. */

function ChannelGlyph({
  channel,
  size = 10,
}: {
  channel: InboxConversation["channel"];
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {channel === "whatsapp" ? (
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.3 7.3a5.1 5.1 0 0 1 5.1-5.1h1.2a5.1 5.1 0 0 1 5.1 5.1 5.1 5.1 0 0 1-5.1 5.1H7.3l-3 2.2v-2.7a5.1 5.1 0 0 1-2-4.6Z" />
          <path d="M6.1 5.8c.1.7.4 1.3.9 1.8.5.5 1.1.8 1.8.9l.5-.8.9.4-.1.8c0 .3-.3.5-.6.5A3.3 3.3 0 0 1 6.2 6c0-.3.2-.5.5-.6l.8-.1.4.9-.8.5" />
        </g>
      ) : null}

      {channel === "instagram" ? (
        <g fill="none" stroke="currentColor" strokeWidth="1.3">
          <rect x="2.7" y="2.7" width="10.6" height="10.6" rx="3.2" />
          <circle cx="8" cy="8" r="2.4" />
          <circle cx="11.4" cy="4.7" r="0.8" fill="currentColor" stroke="none" />
        </g>
      ) : null}

      {channel === "telegram" ? (
        <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round">
          <path d="M13.4 3.1 2.9 7.3c-.5.2-.5.9 0 1.1l2.5.8 1 3c.1.4.6.5.9.2l1.4-1.3 2.5 1.8c.3.2.8.1.9-.3l1.7-8.6c.1-.5-.4-.9-.9-.7Z" />
          <path d="m5.4 9.2 7-5" strokeLinecap="round" />
        </g>
      ) : null}

      {channel === "web" ? (
        <g fill="none" stroke="currentColor" strokeWidth="1.2">
          <circle cx="8" cy="8" r="5.3" />
          <ellipse cx="8" cy="8" rx="2.2" ry="5.3" />
          <path d="M2.9 8h10.2" />
        </g>
      ) : null}
    </svg>
  );
}

function SearchGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <circle cx="7" cy="7" r="3.6" />
        <path d="m9.8 9.8 2.6 2.6" />
      </g>
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="m3.4 8.3 3 3 6.2-6.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparkGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M8 1.4c.4 3.2 2 4.8 5.2 5.2-3.2.4-4.8 2-5.2 5.2-.4-3.2-2-4.8-5.2-5.2 3.2-.4 4.8-2 5.2-5.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PersonGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
        <circle cx="8" cy="5.4" r="2.4" />
        <path d="M3.5 13.1c.4-2.4 2.2-3.7 4.5-3.7s4.1 1.3 4.5 3.7" />
      </g>
    </svg>
  );
}

const css = /* css */ `
.ui-csi {
  /* Knobs. Override any of these on .ui-csi to retheme the inbox in a host. */
  --ui-csi-ink: var(--text, #1a1410);
  --ui-csi-muted: var(--text-muted, #6f625a);
  --ui-csi-subtle: var(--text-subtle, #1a141099);
  --ui-csi-panel: var(--panel, #fffdfb);
  --ui-csi-card: var(--card, #ffffff);
  /* The incoming bubble sits on the log surface. On the light sheet the card is already the
   * lighter step; on dark it is not (card #201a15 is darker than preview #26201a), so the dark
   * block lifts the bubble instead of letting it read as a hole. */
  --ui-csi-bubble-in: var(--card, #ffffff);
  --ui-csi-preview: var(--preview, #fdfaf7);
  --ui-csi-wash: var(--muted-bg, #7a4a1c0a);
  --ui-csi-hover: var(--hover-bg, #7a4a1c12);
  --ui-csi-line: var(--border, #e8e0d7);
  --ui-csi-edge: var(--border-soft, #1a14101a);
  --ui-csi-accent: var(--accent, #c2410c);
  --ui-csi-accent-ink: var(--accent-fg, #fffdfb);
  --ui-csi-accent-soft: var(--accent-soft, #c2410c1a);
  --ui-csi-accent-hover: var(--accent-hover, #9a3412);
  /* The accent chip's ink sits on its own 10% ember wash, and on the selected row that wash
   * stacks over the row's accent-soft ground, so the darkest backdrop is #f3d9ce. The base
   * accent reads 4.4:1 on #f9eae3 and 3.9:1 on #f3d9ce, under AA at chip size. This step
   * measures 6.23:1 on #f9eae3 and 5.7:1 on #f3d9ce. */
  --ui-csi-chip-ink: var(--accent-hover, #9a3412);
  --ui-csi-success: var(--success, #1a7a4a);
  --ui-csi-warning: var(--warning, #9a6410);
  --ui-csi-danger: var(--danger, #b3261e);
  --ui-csi-dur-1: var(--nm-dur-1, 90ms);
  --ui-csi-dur-2: var(--nm-dur-2, 160ms);
  --ui-csi-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));

  position: relative;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  border-radius: var(--radius-panel, 20px);
  background: var(--ui-csi-panel);
  box-shadow:
    inset 0 0 0 1px var(--ui-csi-line),
    0 1px 2px #3d1f0a0a,
    0 28px 64px -32px #3d1f0a2e;
  color: var(--ui-csi-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  line-height: 20px;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
}
.ui-csi *,
.ui-csi *::before,
.ui-csi *::after {
  box-sizing: border-box;
}
.ui-csi p {
  margin: 0;
}

/* The frame. Only the list and the message log scroll inside it. The 687px cap is the pane head
 * and count strip (165px) plus exactly six 87px rows, so the shot ends between rows instead of
 * slicing a chip in half; a shorter viewport still clips, which is what a scroll list does. */
.ui-csi__frame {
  display: flex;
  height: min(72dvh, 687px);
  min-height: 28rem;
  overflow: hidden;
}

/* Left pane --------------------------------------------------------------- */
.ui-csi__pane {
  display: flex;
  flex: 0 0 320px;
  flex-direction: column;
  width: 320px;
  min-width: 0;
  min-height: 0;
  border-right: 1px solid var(--ui-csi-line);
  background: var(--ui-csi-panel);
}
.ui-csi__pane-head {
  flex: none;
  padding: 10px 10px 8px;
}
.ui-csi__pane-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 18px;
}
.ui-csi__pane-name {
  overflow: hidden;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-csi__act {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  margin: -4px -4px -4px 0;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: none;
  color: var(--ui-csi-muted);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color var(--ui-csi-dur-1) var(--ui-csi-ease-out),
    color var(--ui-csi-dur-1) var(--ui-csi-ease-out);
}
.ui-csi__act:hover {
  background: var(--ui-csi-hover);
  color: var(--ui-csi-ink);
}
.ui-csi__act[aria-pressed="true"] {
  background: var(--ui-csi-accent-soft);
  color: var(--ui-csi-accent);
}
.ui-csi__act:focus-visible {
  outline: 2px solid var(--ui-csi-accent);
  outline-offset: 1px;
}

.ui-csi__search {
  position: relative;
  margin-top: 6px;
}
.ui-csi__search-icon {
  position: absolute;
  top: 50%;
  left: 9px;
  display: flex;
  color: var(--ui-csi-muted);
  transform: translateY(-50%);
  pointer-events: none;
}
.ui-csi__input {
  width: 100%;
  height: 32px;
  margin: 0;
  padding: 0 10px 0 28px;
  border: 0;
  border-radius: var(--radius-preview, 12px);
  background: var(--ui-csi-wash);
  color: var(--ui-csi-ink);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  -webkit-appearance: none;
  appearance: none;
  transition:
    background-color var(--ui-csi-dur-2) var(--ui-csi-ease-out),
    box-shadow var(--ui-csi-dur-2) var(--ui-csi-ease-out);
}
.ui-csi__input::placeholder {
  color: var(--ui-csi-subtle);
}
.ui-csi__input:focus-visible {
  outline: none;
  background: var(--ui-csi-card);
  box-shadow: inset 0 0 0 1px var(--ui-csi-accent);
}
.ui-csi__input::-webkit-search-cancel-button {
  -webkit-appearance: none;
  appearance: none;
}

.ui-csi__segments {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}
.ui-csi__seg {
  display: flex;
  gap: 2px;
  min-width: 0;
  padding: 2px;
  border-radius: var(--radius-control, 8px);
  background: var(--ui-csi-wash);
}
.ui-csi__seg button {
  flex: 1 1 0;
  min-width: 0;
  height: 22px;
  padding: 0 6px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--ui-csi-muted);
  font: inherit;
  font-size: 11px;
  font-weight: 500;
  line-height: 22px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color var(--ui-csi-dur-2) var(--ui-csi-ease-out),
    color var(--ui-csi-dur-2) var(--ui-csi-ease-out),
    box-shadow var(--ui-csi-dur-2) var(--ui-csi-ease-out);
}
.ui-csi__seg button:hover {
  color: var(--ui-csi-ink);
}
.ui-csi__seg button[aria-pressed="true"] {
  background: var(--ui-csi-card);
  color: var(--ui-csi-ink);
  font-weight: 600;
  box-shadow:
    0 1px 2px #3d1f0a14,
    inset 0 0 0 1px var(--ui-csi-edge);
}
.ui-csi__seg button:focus-visible {
  outline: 2px solid var(--ui-csi-accent);
  outline-offset: -2px;
}

.ui-csi__count {
  flex: none;
  padding: 5px 14px;
  border-bottom: 1px solid var(--ui-csi-line);
  color: var(--ui-csi-muted);
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}

.ui-csi__list {
  flex: 1 1 auto;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  list-style: none;
  scrollbar-width: thin;
}
.ui-csi__list > li {
  margin: 0;
}
.ui-csi__row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  min-height: 87px;
  margin: 0;
  padding: 10px 12px;
  border: 0;
  border-bottom: 1px solid var(--ui-csi-line);
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px transparent;
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color var(--ui-csi-dur-2) var(--ui-csi-ease-out),
    box-shadow var(--ui-csi-dur-2) var(--ui-csi-ease-out);
}
.ui-csi__row:hover {
  background: var(--ui-csi-hover);
}
.ui-csi__row[data-active="true"] {
  background: var(--ui-csi-accent-soft);
  box-shadow: inset 0 0 0 1.5px var(--ui-csi-accent);
}
.ui-csi__row:focus-visible {
  outline: 2px solid var(--ui-csi-accent);
  outline-offset: -2px;
}

.ui-csi__avatar {
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--ui-csi-wash);
  color: var(--ui-csi-ink);
  box-shadow: inset 0 0 0 1px var(--ui-csi-edge);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.01em;
}
.ui-csi__mark {
  position: absolute;
  right: -3px;
  bottom: -3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--ui-csi-panel);
  color: var(--ui-csi-muted);
  box-shadow:
    0 0 0 1.5px var(--ui-csi-panel),
    inset 0 0 0 1px var(--ui-csi-edge);
}

.ui-csi__row-main {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.ui-csi__row-top {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.ui-csi__row-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 17px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-csi__row-time {
  flex: none;
  color: var(--ui-csi-muted);
  font-size: 11px;
  line-height: 15px;
  font-variant-numeric: tabular-nums;
}
.ui-csi__row-preview {
  overflow: hidden;
  color: var(--ui-csi-muted);
  font-size: 11.5px;
  line-height: 16px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-csi__row-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin-top: 3px;
}
.ui-csi__chip {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  height: 18px;
  padding: 0 6px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-csi-wash);
  color: var(--ui-csi-muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ui-csi__chip[data-tone="accent"] {
  background: var(--ui-csi-accent-soft);
  color: var(--ui-csi-chip-ink);
}
/* The neutral chip's wash stacks over the selected row's ember wash, which lands the pair at
 * 4.35:1 in dark. The row's own ink clears it, and the chip is still distinct by its pill. */
.ui-csi__row[data-active="true"] .ui-csi__chip[data-tone="neutral"] {
  color: var(--ui-csi-ink);
}
.ui-csi__chip[data-tone="success"] {
  background: color-mix(in srgb, var(--ui-csi-success) 12%, transparent);
  color: var(--ui-csi-success);
}
.ui-csi__chip[data-tone="warning"] {
  background: color-mix(in srgb, var(--ui-csi-warning) 14%, transparent);
  color: var(--ui-csi-warning);
}
.ui-csi__chip[data-tone="danger"] {
  background: color-mix(in srgb, var(--ui-csi-danger) 12%, transparent);
  color: var(--ui-csi-danger);
}
.ui-csi__dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ui-csi-accent);
}
.ui-csi__empty {
  padding: 22px 14px;
  color: var(--ui-csi-muted);
  font-size: 12px;
  line-height: 18px;
  text-align: center;
}

/* Thread ------------------------------------------------------------------ */
.ui-csi__thread {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--ui-csi-panel);
}
.ui-csi__head {
  display: flex;
  flex: none;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--ui-csi-line);
}
.ui-csi__ident {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.ui-csi__name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.ui-csi__name {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  line-height: 19px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-csi__chan {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
  height: 18px;
  padding: 0 7px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-csi-wash);
  color: var(--ui-csi-muted);
  font-size: 10.5px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
}
.ui-csi__handle {
  overflow: hidden;
  color: var(--ui-csi-muted);
  font-size: 11px;
  line-height: 15px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-csi__head-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 10px;
}
.ui-csi__mode {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--ui-csi-muted);
  font-size: 11.5px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
}
.ui-csi__mode[data-mode="ai"] {
  color: var(--ui-csi-accent);
}

.ui-csi__takeover {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  min-height: 44px;
  margin: 0;
  padding: 0 14px;
  border: 0;
  border-radius: var(--radius-preview, 12px);
  background: linear-gradient(135deg, var(--ui-csi-accent), var(--ui-csi-accent-hover));
  color: var(--ui-csi-accent-ink);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  box-shadow:
    inset 0 1px 0 #ffffff2e,
    0 6px 14px -8px #3d1f0a66;
  transition:
    transform var(--ui-csi-dur-1) var(--ui-csi-ease-out),
    box-shadow var(--ui-csi-dur-2) var(--ui-csi-ease-out);
}
.ui-csi__takeover:hover {
  box-shadow:
    inset 0 1px 0 #ffffff2e,
    0 10px 20px -10px #3d1f0a80;
}
.ui-csi__takeover:active {
  transform: translateY(1px);
}
.ui-csi__takeover:focus-visible {
  outline: 2px solid var(--ui-csi-accent);
  outline-offset: 2px;
}

.ui-csi__log {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  padding: 14px 14px 18px;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--ui-csi-preview);
  scrollbar-width: thin;
}
/* A thread sits on its newest message: the zero-width first item eats the free space, so a short
 * thread rests at the bottom while a long one still starts at the top and scrolls normally. An
 * auto margin on the messages themselves would clip the oldest one out of reach in Chrome. */
.ui-csi__log::before {
  content: "";
  flex: none;
  margin-top: auto;
}
.ui-csi__msg {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  max-width: 85%;
}
.ui-csi__msg[data-side="out"] {
  flex-direction: row-reverse;
  margin-left: auto;
}
.ui-csi__msg-avatar {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--ui-csi-wash);
  color: var(--ui-csi-ink);
  box-shadow: inset 0 0 0 1px var(--ui-csi-edge);
  font-size: 9.5px;
  font-weight: 600;
  line-height: 1;
}
.ui-csi__msg-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.ui-csi__msg[data-side="out"] .ui-csi__msg-body {
  align-items: flex-end;
}
.ui-csi__bubble {
  padding: 9px 13px;
  border-radius: 16px 16px 16px 4px;
  background: var(--ui-csi-bubble-in);
  color: var(--ui-csi-ink);
  box-shadow:
    inset 0 0 0 1px var(--ui-csi-edge),
    0 1px 2px #3d1f0a0a;
  font-size: 14px;
  line-height: 1.6;
  letter-spacing: -0.005em;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.ui-csi__msg[data-side="out"] .ui-csi__bubble {
  border-radius: 16px 16px 4px 16px;
  background: linear-gradient(135deg, var(--ui-csi-accent), var(--ui-csi-accent-hover));
  color: var(--ui-csi-accent-ink);
  box-shadow: 0 1px 2px #3d1f0a14;
}
.ui-csi__msg-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 2px;
  color: var(--ui-csi-muted);
  font-size: 11px;
  line-height: 14px;
  font-variant-numeric: tabular-nums;
}
.ui-csi__ai {
  display: inline-flex;
  align-items: center;
  height: 17px;
  padding: 0 5px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-csi-wash);
  color: var(--ui-csi-muted);
  box-shadow: inset 0 0 0 1px var(--ui-csi-edge);
  font-size: 11px;
  font-weight: 600;
  line-height: 17px;
  letter-spacing: 0.02em;
}

/* The bar is a strip inside the frame, not a second panel: the copy holds the left column and the
 * single control sits in a fixed right column, so the ember never becomes a full-bleed slab. */
.ui-csi__bar {
  display: grid;
  flex: none;
  grid-template-areas:
    "title action"
    "sub action";
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 14px;
  row-gap: 1px;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--ui-csi-line);
  background: var(--ui-csi-panel);
}
.ui-csi__bar-title {
  grid-area: title;
  font-size: 12px;
  font-weight: 600;
  line-height: 17px;
}
.ui-csi__bar-sub {
  grid-area: sub;
  color: var(--ui-csi-muted);
  font-size: 11px;
  line-height: 16px;
}
.ui-csi__takeover--bar {
  grid-area: action;
  width: auto;
  min-width: 132px;
  margin: 0;
}
/* The head already carries the mode line, so its takeover is a compact duplicate of the bar's
 * control and must not stretch the 56px header to 60px. It is the quieter of the two: the bar
 * holds the single ember primary, this one reads as its secondary shortcut in the header. */
.ui-csi__takeover--head {
  height: 32px;
  min-height: 32px;
  padding: 0 12px;
  border-radius: var(--radius-control, 8px);
  background: var(--ui-csi-card);
  color: var(--ui-csi-ink);
  font-size: 11.5px;
  box-shadow: inset 0 0 0 1px var(--ui-csi-line);
}
.ui-csi__takeover--head:hover {
  background: var(--ui-csi-hover);
  box-shadow: inset 0 0 0 1px var(--ui-csi-muted);
}
.ui-csi__bar-state {
  display: flex;
  grid-area: action;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 14px;
  border-radius: var(--radius-preview, 12px);
  background: var(--ui-csi-wash);
  color: var(--ui-csi-muted);
  box-shadow: inset 0 0 0 1px var(--ui-csi-edge);
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
}
.ui-csi__bar-state:focus-visible {
  outline: 2px solid var(--ui-csi-accent);
  outline-offset: 2px;
}

.ui-csi__void {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 24px;
  text-align: center;
}
.ui-csi__void-title {
  font-size: 13px;
  font-weight: 600;
}
.ui-csi__void-sub {
  color: var(--ui-csi-muted);
  font-size: 11.5px;
  line-height: 17px;
}
.ui-csi__void-line {
  padding: 12px 0;
  color: var(--ui-csi-muted);
  font-size: 12px;
}

.ui-csi__sr {
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

:where(.dark, [data-theme="dark"]) .ui-csi {
  --ui-csi-ink: var(--text, #f4ece4);
  --ui-csi-muted: var(--text-muted, #a2958a);
  --ui-csi-subtle: var(--text-subtle, #f4ece48c);
  --ui-csi-panel: var(--panel, #1a1512);
  --ui-csi-card: var(--card, #201a15);
  /* 11% of the ink into the card lifts the bubble to #37312b, clearly above the #26201a log. */
  --ui-csi-bubble-in: color-mix(in srgb, var(--text, #f4ece4) 11%, var(--card, #201a15));
  --ui-csi-preview: var(--preview, #26201a);
  --ui-csi-wash: var(--muted-bg, #ffffff0d);
  --ui-csi-hover: var(--hover-bg, #ffffff12);
  --ui-csi-line: var(--border, #33291f);
  --ui-csi-edge: var(--border-soft, #ffffff12);
  --ui-csi-accent: var(--accent, #ff6b35);
  --ui-csi-accent-ink: var(--accent-fg, #1a0f08);
  --ui-csi-accent-soft: var(--accent-soft, #ff6b3524);
  --ui-csi-accent-hover: var(--accent-hover, #ff8256);
  /* Same chip on the dark warm wash (#562b1b): the accent reads 4.22:1, this step 4.88:1. */
  --ui-csi-chip-ink: var(--accent-hover, #ff8256);
  --ui-csi-success: var(--success, #4f9d6e);
  --ui-csi-warning: var(--warning, #d99530);
  --ui-csi-danger: var(--danger, #e87068);
  box-shadow:
    inset 0 0 0 1px var(--ui-csi-line),
    0 28px 64px -32px #00000080;
}

/* Below md the two panes stack and the whole shot keeps the 50rem cap, so it stays a preview on
 * a phone instead of a full screen. The list keeps its own scroll in the shorter pane; 21.75rem
 * is the head strip (94px), the count bar (25px) and exactly three 75px rows, so the third chip
 * is never sliced by the pane edge. The rest leaves the log enough height to hold the customer's
 * last message above the agent's two replies. */
@media (max-width: 767px) {
  .ui-csi__frame {
    flex-direction: column;
    height: 50rem;
    min-height: 0;
    max-height: 50rem;
  }
  .ui-csi__pane {
    flex: 0 0 21.5rem;
    width: 100%;
    height: 21.5rem;
    border-right: 0;
    border-bottom: 1px solid var(--ui-csi-line);
  }
  .ui-csi__pane-head {
    padding: 8px 10px 6px;
  }
  .ui-csi__search {
    display: none;
  }
  /* The two filter groups wrap as whole units instead of squeezing their labels to "M...". */
  .ui-csi__segments {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
  }
  .ui-csi__seg {
    flex: 1 1 auto;
    min-width: max-content;
  }
  .ui-csi__seg button {
    padding: 0 4px;
    font-size: 10px;
  }
  .ui-csi__count {
    padding: 4px 12px;
  }
  .ui-csi__row {
    min-height: 64px;
    padding: 8px 10px;
    gap: 8px;
  }
  .ui-csi__head {
    display: grid;
    grid-template-areas:
      "ident"
      "actions";
    grid-template-columns: minmax(0, 1fr);
    align-items: center;
    min-height: 52px;
    padding: 7px 10px;
    gap: 3px;
    /* Stacked, the head sits directly under the selected row and would otherwise repeat that
     * row's avatar and name block. It drops the avatar and becomes a plain header band. */
    background: var(--ui-csi-preview);
  }
  .ui-csi__head > .ui-csi__avatar {
    display: none;
  }
  .ui-csi__ident {
    grid-area: ident;
  }
  /* "Ditangani Anda" is wider than the name's share of a 210px band, so the mode line takes its
   * own right-aligned row instead of truncating the customer to "Jessica T...". */
  .ui-csi__head-actions {
    grid-area: actions;
    justify-self: end;
  }
  /* The channel chip drops under the name rather than eating it down to one letter. */
  .ui-csi__name-row {
    flex-wrap: wrap;
    row-gap: 1px;
  }
  .ui-csi__handle {
    display: none;
  }
  .ui-csi__takeover--head {
    display: none;
  }
  .ui-csi__mode {
    font-size: 10.5px;
  }
  .ui-csi__log {
    padding: 12px 10px 14px;
    gap: 12px;
  }
  .ui-csi__bubble {
    font-size: 13.5px;
  }
  /* 85% on a 210px log leaves under 160px of text per line, which breaks a price across four
   * lines; 88% still keeps a visible gap between the two sides on a narrow phone. */
  .ui-csi__msg {
    max-width: 88%;
  }
  .ui-csi__bar {
    grid-template-areas:
      "title"
      "sub"
      "action";
    grid-template-columns: minmax(0, 1fr);
    row-gap: 4px;
    padding: 10px 10px calc(10px + env(safe-area-inset-bottom, 0px));
  }
  .ui-csi__takeover--bar {
    width: 100%;
    min-width: 0;
  }
  .ui-csi__bar-sub {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ui-csi__act,
  .ui-csi__input,
  .ui-csi__seg button,
  .ui-csi__row,
  .ui-csi__takeover {
    transition-duration: 1ms;
  }
  .ui-csi__takeover:active {
    transform: none;
  }
}
`;
