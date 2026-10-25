"use client";

import { type ReactNode } from "react";

/*
 * Browser Frame: browser chrome around a page slot. A 32px bar carries three dots at the left,
 * a fixed-width address pill in the middle and a 40px spacer at the right that keeps the pill
 * centred; under it a 16 by 10 viewport clips whatever page it is given. The address is real
 * text, so it is read rather than described, it truncates instead of wrapping, and an omitted
 * `url` leaves a muted placeholder rather than an empty box. Styles are injected below, so no
 * extra files are needed.
 */

export type BrowserFrameProps = {
  /** Address shown in the bar; omit it and the pill keeps its shape with a muted placeholder */
  url?: string;
  /** Three dots at the left of the bar */
  trafficDots?: boolean;
  /** The page inside the viewport; clipped to the 16 by 10 box */
  children: ReactNode;
  /** Extra class on the root, for the page that places the frame */
  className?: string;
};

/* The pill never collapses to an empty box: an absent address keeps its own label */
const PLACEHOLDER = "no address";

export function BrowserFrame({ url, trafficDots = true, children, className }: BrowserFrameProps) {
  const address = typeof url === "string" ? url.trim() : "";
  const empty = address === "";

  return (
    <div className={["ui-bwf", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many frames render */}
      <style href="ui-browser-frame" precedence="default">
        {css}
      </style>

      <div className="ui-bwf__bar">
        <span className="ui-bwf__dots" aria-hidden="true">
          {trafficDots ? (
            <>
              <span className="ui-bwf__dot" />
              <span className="ui-bwf__dot" />
              <span className="ui-bwf__dot" />
            </>
          ) : null}
        </span>

        <span className="ui-bwf__address" data-empty={empty ? "true" : undefined}>
          <svg
            className="ui-bwf__lock"
            viewBox="0 0 10 12"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M2.9 5.2V3.5a2.1 2.1 0 0 1 4.2 0v1.7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <rect x="1.3" y="5.2" width="7.4" height="5.9" rx="1.7" fill="currentColor" />
          </svg>
          {/* Keyed on the address, so a changed address fades in once and a repeat does not */}
          <span className="ui-bwf__url" key={empty ? "empty" : address}>
            {empty ? PLACEHOLDER : address}
          </span>
        </span>

        <span className="ui-bwf__tail">
          {/* Balances the dots so the pill sits on the bar's centre, not on its free space */}
          <span className="ui-bwf__spacer" aria-hidden="true" />
        </span>
      </div>

      <div className="ui-bwf__viewport">{children}</div>
    </div>
  );
}

const css = /* css */ `
.ui-bwf {
  /* Knobs. Override any of these on .ui-bwf to retheme the frame in a host. */
  --ui-bwf-panel: var(--panel, #fffdfb);
  --ui-bwf-chrome: #f4ede5;
  --ui-bwf-ground: #fbf7f3;
  --ui-bwf-pill: #ffffff;
  --ui-bwf-line: var(--border, #e8e0d7);
  --ui-bwf-edge: var(--border-soft, #1a14101a);
  --ui-bwf-ink: var(--text, #1a1410);
  --ui-bwf-muted: var(--text-muted, #6f625a);
  --ui-bwf-dot: #c8b7a7;
  --ui-bwf-dot-soft: #ddcfc2;
  --ui-bwf-lift: #1a141014;
  --ui-bwf-radius: var(--radius-preview, 12px);
  --ui-bwf-dur-fast: var(--nm-dur-2, 160ms);
  --ui-bwf-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));

  position: relative;
  box-sizing: border-box;
  display: block;
  width: 100%;
  overflow: hidden;
  background: var(--ui-bwf-panel, #fffdfb);
  border-radius: var(--ui-bwf-radius, 12px);
  box-shadow:
    inset 0 0 0 1px var(--ui-bwf-line, #e8e0d7),
    0 18px 30px -26px var(--ui-bwf-lift, #1a141014);
  color: var(--ui-bwf-ink, #1a1410);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 18px;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-bwf *,
.ui-bwf *::before,
.ui-bwf *::after {
  box-sizing: border-box;
}
.ui-bwf p {
  margin: 0;
}

/* The bar ----------------------------------------------------------------- */
.ui-bwf__bar {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 32px;
  padding: 0 12px;
  background: var(--ui-bwf-chrome, #f4ede5);
  box-shadow: inset 0 -1px 0 var(--ui-bwf-line, #e8e0d7);
}
.ui-bwf__dots {
  display: flex;
  flex: 1 1 0;
  align-items: center;
  gap: 6px;
  min-width: 30px;
}
.ui-bwf__dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ui-bwf-dot, #c8b7a7);
}
.ui-bwf__dot:last-child {
  background: var(--ui-bwf-dot-soft, #ddcfc2);
}

/* The address ------------------------------------------------------------- */
.ui-bwf__address {
  display: flex;
  flex: 0 1 182px;
  align-items: center;
  gap: 5px;
  width: 182px;
  min-width: 0;
  height: 20px;
  padding: 0 8px;
  overflow: hidden;
  border-radius: 10px;
  background: var(--ui-bwf-pill, #ffffff);
  box-shadow: inset 0 0 0 1px var(--ui-bwf-edge, #1a14101a);
  white-space: nowrap;
}
.ui-bwf__lock {
  flex: none;
  width: 9px;
  height: 10px;
  color: var(--ui-bwf-muted, #6f625a);
  opacity: 0.72;
}
.ui-bwf__url {
  min-width: 0;
  overflow: hidden;
  color: var(--ui-bwf-ink, #1a1410);
  font-size: 11px;
  font-weight: 500;
  line-height: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
  animation: ui-bwf-addr-in var(--ui-bwf-dur-fast, 160ms) var(--ui-bwf-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) backwards;
}
/* No address: the same pill, a quieter line, never an empty box, and no lock to claim
   something is secured when nothing is loaded */
.ui-bwf__address[data-empty="true"] .ui-bwf__url {
  color: var(--ui-bwf-muted, #6f625a);
  font-weight: 400;
}
.ui-bwf__address[data-empty="true"] .ui-bwf__lock {
  display: none;
}
@keyframes ui-bwf-addr-in {
  from {
    opacity: 0;
  }
}

/* The balancing spacer ---------------------------------------------------- */
.ui-bwf__tail {
  display: flex;
  flex: 1 1 0;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
}
.ui-bwf__spacer {
  flex: none;
  width: 40px;
  max-width: 100%;
  height: 1px;
}

/* The viewport ------------------------------------------------------------ */
.ui-bwf__viewport {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  /* A query container, so a page inside can size its own type to the frame it got
   * instead of to the window */
  container-type: inline-size;
  container-name: ui-bwf-page;
  background: var(--ui-bwf-ground, #fbf7f3);
}

:where(.dark, [data-theme="dark"]) .ui-bwf {
  --ui-bwf-panel: var(--panel, #1a1512);
  --ui-bwf-chrome: #201a15;
  --ui-bwf-ground: #14100d;
  --ui-bwf-pill: #26201a;
  --ui-bwf-line: var(--border, #33291f);
  --ui-bwf-edge: var(--border-soft, #ffffff12);
  --ui-bwf-ink: var(--text, #f4ece4);
  --ui-bwf-muted: var(--text-muted, #a2958a);
  --ui-bwf-dot: #4a3b30;
  --ui-bwf-dot-soft: #5f4c3d;
  --ui-bwf-lift: #00000066;
}

@media (prefers-reduced-motion: reduce) {
  .ui-bwf__url {
    animation: none;
  }
}
`;
