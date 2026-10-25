"use client";

import { useId, type ReactNode } from "react";

/*
 * Chat Window: a titled frame that owns chrome and a slot, never the content. The header carries
 * three traffic dots, the title, and a right cluster that takes a count or a status badge; the
 * body is whatever the host puts in it, so the frame has no height of its own and grows with its
 * children. A status label changes by remounting the badge, which fades in on the entry curve,
 * and the live region around it reports the new label. Styles are injected below, so no extra
 * files are needed.
 */

export type ChatWindowProps = {
  /** Title in the header bar; it also names the frame for assistive technology */
  title: string;
  /** Draw the three traffic dots before the title */
  trafficDots?: boolean;
  /** Right-aligned node in the header, such as an open-count */
  meta?: ReactNode;
  /** Status badge in the header; the label is always visible, so the tone is never the only signal */
  status?: {
    /** Short word that carries the meaning: "Terhubung", "Menunggu" */
    label: string;
    /** Colour family; the label above still states the status on its own */
    tone: "neutral" | "accent" | "success" | "warning" | "danger";
  };
  /** Body content; the frame sets no height and lets this decide it */
  children?: ReactNode;
  className?: string;
};

export function ChatWindow({
  title,
  trafficDots = true,
  meta,
  status,
  children,
  className,
}: ChatWindowProps) {
  const titleId = useId();

  return (
    <div
      className={["ui-cwn", className].filter(Boolean).join(" ")}
      role="group"
      aria-labelledby={titleId}
    >
      <style href="ui-chat-window" precedence="default">
        {css}
      </style>

      <div className="ui-cwn__bar">
        {trafficDots ? (
          <span className="ui-cwn__dots" aria-hidden="true">
            <span className="ui-cwn__dot" />
            <span className="ui-cwn__dot" />
            <span className="ui-cwn__dot" />
          </span>
        ) : null}

        <span className="ui-cwn__title" id={titleId}>
          {title}
        </span>

        <span className="ui-cwn__right">
          {meta != null ? <span className="ui-cwn__meta">{meta}</span> : null}
          <span className="ui-cwn__slot" role="status" aria-live="polite">
            {status ? (
              <span
                key={status.label}
                className="ui-cwn__badge"
                data-tone={status.tone}
              >
                <span className="ui-cwn__badge-dot" aria-hidden="true" />
                <span className="ui-cwn__badge-label">{status.label}</span>
              </span>
            ) : null}
          </span>
        </span>
      </div>

      <div className="ui-cwn__body">{children}</div>
    </div>
  );
}

const css = /* css */ `
.ui-cwn {
  /* Knobs. Override any of these on .ui-cwn to retheme the frame in a host. */
  --ui-cwn-ink: var(--text, #1a1410);
  --ui-cwn-muted: var(--text-muted, #6f625a);
  --ui-cwn-panel: var(--panel, #fffdfb);
  --ui-cwn-bar: #7a4a1c08;
  --ui-cwn-line: var(--border, #e8e0d7);
  /* A one-pixel top highlight is what makes the frame read as raised rather than sunk. */
  --ui-cwn-sheen: #ffffff;
  --ui-cwn-lift: #1a14101f;
  --ui-cwn-dot: #1a141040;
  --ui-cwn-dot-soft: #1a14101f;
  --ui-cwn-neutral: var(--text-muted, #6f625a);
  --ui-cwn-accent: var(--accent, #c2410c);
  --ui-cwn-ok: var(--success, #1a7a4a);
  --ui-cwn-warn: var(--warning, #9a6410);
  --ui-cwn-danger: var(--danger, #b3261e);
  --ui-cwn-width: 360px;
  --ui-cwn-dot-size: 6px;
  --ui-cwn-dur: var(--nm-dur-3, 240ms);
  --ui-cwn-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));

  box-sizing: border-box;
  width: 100%;
  max-width: var(--ui-cwn-width);
  overflow: hidden;
  background: var(--ui-cwn-panel);
  border-radius: var(--radius-preview, 12px);
  box-shadow:
    inset 0 0 0 1px var(--ui-cwn-line),
    0 14px 26px -20px var(--ui-cwn-lift);
  color: var(--ui-cwn-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 18px;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-cwn *,
.ui-cwn *::before,
.ui-cwn *::after {
  box-sizing: border-box;
}
.ui-cwn p {
  margin: 0;
}

/* Header ------------------------------------------------------------------ */
.ui-cwn__bar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 12px;
  background: var(--ui-cwn-bar);
  box-shadow:
    inset 0 1px 0 var(--ui-cwn-sheen),
    inset 0 -1px 0 var(--ui-cwn-line);
}
.ui-cwn__dots {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
}
.ui-cwn__dot {
  width: var(--ui-cwn-dot-size);
  height: var(--ui-cwn-dot-size);
  border-radius: 50%;
  background: var(--ui-cwn-dot);
}
/* The third dot sits back, so the cluster reads as chrome rather than as three statuses */
.ui-cwn__dot:nth-child(3) {
  background: var(--ui-cwn-dot-soft);
}
.ui-cwn__title {
  min-width: 0;
  overflow: hidden;
  color: var(--ui-cwn-ink);
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-cwn__right {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  max-width: 62%;
  margin-left: auto;
}
.ui-cwn__meta {
  min-width: 0;
  overflow: hidden;
  color: var(--ui-cwn-muted);
  font-size: 11px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-cwn__slot {
  display: inline-flex;
  flex: 0 1 auto;
  align-items: center;
  min-width: 0;
}

/* The status badge. The tone picks the colour; the text always states the status. */
.ui-cwn__badge {
  --ui-cwn-badge-tone: var(--ui-cwn-neutral);

  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  min-width: 0;
  height: 20px;
  padding: 0 8px;
  border-radius: var(--radius-pill, 999px);
  background: color-mix(in srgb, var(--ui-cwn-badge-tone) 14%, transparent);
  /* The tone is pulled toward the ink so the 11px label clears 4.5:1 on its own wash;
   * the word states the status, so the tone only has to support it. */
  color: color-mix(
    in srgb,
    var(--ui-cwn-badge-tone) var(--ui-cwn-badge-mix, 78%),
    var(--ui-cwn-ink)
  );
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  letter-spacing: 0;
  white-space: nowrap;
  transform-origin: 100% 50%;
  animation: ui-cwn-badge-in var(--ui-cwn-dur) var(--ui-cwn-ease-out) backwards;
}
.ui-cwn__badge-dot {
  flex: none;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
}
.ui-cwn__badge-label {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-cwn__badge[data-tone="neutral"] {
  --ui-cwn-badge-tone: var(--ui-cwn-neutral);
}
.ui-cwn__badge[data-tone="accent"] {
  --ui-cwn-badge-tone: var(--ui-cwn-accent);
}
.ui-cwn__badge[data-tone="success"] {
  --ui-cwn-badge-tone: var(--ui-cwn-ok);
}
.ui-cwn__badge[data-tone="warning"] {
  --ui-cwn-badge-tone: var(--ui-cwn-warn);
}
.ui-cwn__badge[data-tone="danger"] {
  --ui-cwn-badge-tone: var(--ui-cwn-danger);
}
@keyframes ui-cwn-badge-in {
  from {
    opacity: 0;
    transform: translateX(5px) scale(0.9);
  }
}

/* Body: the frame never sets a height here, the children decide it ----------------- */
.ui-cwn__body {
  min-width: 0;
  color: var(--ui-cwn-ink);
  font-size: 12px;
  line-height: 18px;
}

:where(.dark, [data-theme="dark"]) .ui-cwn {
  --ui-cwn-ink: var(--text, #f4ece4);
  --ui-cwn-muted: var(--text-muted, #a2958a);
  /* The preview backdrop is itself a --preview to --card gradient, so a flat --preview
   * fill disappears into it; six percent of ink lifts the frame clear of the whole ramp. */
  --ui-cwn-panel: color-mix(in srgb, var(--preview, #26201a) 94%, var(--text, #f4ece4));
  --ui-cwn-bar: #ffffff0a;
  /* --border is tuned to sit on --panel; on this lifted surface it vanishes, so the
   * hairline takes a fifth of the ink and reads as a real edge. */
  --ui-cwn-line: color-mix(in srgb, var(--border, #33291f) 80%, var(--text, #f4ece4));
  --ui-cwn-sheen: #ffffff12;
  --ui-cwn-lift: #00000073;
  --ui-cwn-dot: #ffffff33;
  --ui-cwn-dot-soft: #ffffff1a;
  --ui-cwn-neutral: var(--text-muted, #a2958a);
  --ui-cwn-badge-mix: 65%;
  --ui-cwn-accent: var(--accent, #ff6b35);
  --ui-cwn-ok: var(--success, #4f9d6e);
  --ui-cwn-warn: var(--warning, #d99530);
  --ui-cwn-danger: var(--danger, #e87068);
}

@media (prefers-reduced-motion: reduce) {
  .ui-cwn__badge {
    animation: none;
    transition-duration: 1ms;
  }
}
`;
