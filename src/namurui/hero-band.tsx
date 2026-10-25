"use client";

import type { CSSProperties, ReactNode } from "react";

/*
 * Hero Band: the opening band of a landing page – an optional launch pill, a headline that can
 * carry a mark inside its own sentence, a lead and a quieter sub-lead, then the call-to-action
 * row. Every slot rises and fades once on mount, in reading order, one stagger step apart; the
 * mark is measured in ems so it keeps its proportion when the headline is retuned. The band owns
 * the row and the button shapes, so a host drops two links in and gets a matched pair.
 * Styles are injected below, so no extra files are needed.
 */

export type HeroBandProps = {
  /** Announcement slot above the headline, e.g. an announcement pill */
  pill?: ReactNode;
  /** The headline sentence; wrapped in an `h1` unless `children` supplies the heading */
  title?: ReactNode;
  /** Paragraph under the headline, set at 1.125rem and capped at 36rem */
  lead?: ReactNode;
  /** Second, quieter paragraph, capped at 38rem */
  subLead?: ReactNode;
  /** The call-to-action row; the first child draws as the primary button, the rest as outlines */
  actions?: ReactNode;
  /** Inline mark set inside the headline sentence, drawn at 0.92em square */
  glyph?: ReactNode;
  /** A caller-owned heading block; replaces the built-in `h1` and keeps the enter stagger */
  children?: ReactNode;
  /** Extra class on the band; set the `--ui-hrb-*` knobs here to retheme it */
  className?: string;
};

/* A string headline gets its mark after the first word, the way a product mark reads inside a
 * sentence. A node headline is left whole; the caller places the mark and it is sized the same. */
function splitAfterFirstWord(title: ReactNode): [ReactNode, ReactNode] | null {
  if (typeof title !== "string") return null;
  const match = /^(\S+\s+)(\S[\s\S]*)$/.exec(title);
  if (!match) return null;
  return [match[1], match[2]];
}

export function HeroBand({
  pill,
  title,
  lead,
  subLead,
  actions,
  glyph,
  children,
  className,
}: HeroBandProps) {
  const hasTitle = title !== undefined && title !== null;
  const parts = hasTitle ? splitAfterFirstWord(title) : null;
  const mark = glyph ? (
    <span className="ui-hrb__glyph" aria-hidden="true">
      {glyph}
    </span>
  ) : null;

  /* Each slot takes the next stagger step, so the band reveals in reading order even when the
   * pill or the lead is left out. */
  let step = 0;
  const enter = () => ({ "--ui-hrb-i": step++ }) as CSSProperties;

  return (
    <section className={["ui-hrb", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many bands render */}
      <style href="ui-hero-band" precedence="default">
        {css}
      </style>

      {pill ? (
        <div className="ui-hrb__pill" data-enter style={enter()}>
          {pill}
        </div>
      ) : null}

      {children ? (
        <div className="ui-hrb__heading" data-enter style={enter()}>
          {children}
        </div>
      ) : hasTitle ? (
        <h1 className="ui-hrb__title" data-enter style={enter()}>
          {parts ? (
            <>
              {parts[0]}
              {mark}
              {parts[1]}
            </>
          ) : (
            <>
              {title}
              {mark}
            </>
          )}
        </h1>
      ) : null}

      {lead ? (
        <p className="ui-hrb__lead" data-enter style={enter()}>
          {lead}
        </p>
      ) : null}

      {subLead ? (
        <p className="ui-hrb__sub" data-enter style={enter()}>
          {subLead}
        </p>
      ) : null}

      {actions ? (
        <div className="ui-hrb__actions" data-enter style={enter()}>
          {actions}
        </div>
      ) : null}
    </section>
  );
}

const css = /* css */ `
.ui-hrb {
  /* Knobs. Override any of these on .ui-hrb to retheme the band in a host. */
  --ui-hrb-ink: var(--text, #1a1410);
  --ui-hrb-lead-ink: #1a1410d1;
  --ui-hrb-muted: var(--text-muted, #6f625a);
  --ui-hrb-line: var(--border, #e8e0d7);
  --ui-hrb-panel: var(--panel, #fffdfb);
  --ui-hrb-accent: var(--accent, #c2410c);
  --ui-hrb-accent-deep: var(--accent-hover, #9a3412);
  --ui-hrb-accent-ink: var(--accent-fg, #fffdfb);
  --ui-hrb-cta-shadow: 0 1px 2px #0b090814, 0 10px 24px -12px #c2410c66;
  --ui-hrb-cta-shadow-hover: 0 2px 4px #0b09081a, 0 16px 30px -12px #c2410c80;
  --ui-hrb-dur: var(--nm-dur-5, 620ms);
  --ui-hrb-ease: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-hrb-stagger: var(--nm-stagger, 70ms);
  --ui-hrb-rise: 14px;

  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 72rem;
  margin: 0 auto;
  padding: 28px 24px 24px;
  color: var(--ui-hrb-ink, #1a1410);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  text-align: center;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-hrb *,
.ui-hrb *::before,
.ui-hrb *::after {
  box-sizing: border-box;
}

/* One reveal per slot, in reading order, on the entry curve. Only transform and opacity move;
 * the delay comes from the slot's index, so an omitted pill closes the gap. */
.ui-hrb > [data-enter] {
  animation: ui-hrb-rise var(--ui-hrb-dur, 620ms) var(--ui-hrb-ease, cubic-bezier(0.22, 1, 0.36, 1)) both;
  animation-delay: calc(var(--ui-hrb-i, 0) * var(--ui-hrb-stagger, 70ms));
}
@keyframes ui-hrb-rise {
  from {
    opacity: 0;
    transform: translate3d(0, var(--ui-hrb-rise, 14px), 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

/* Announcement slot ------------------------------------------------------- */
.ui-hrb__pill {
  display: flex;
  flex: none;
  justify-content: center;
  max-width: 100%;
  margin-bottom: 18px;
}

/* Headline ---------------------------------------------------------------- */
.ui-hrb__title {
  max-width: 100%;
  margin: 0;
  color: var(--ui-hrb-ink, #1a1410);
  font-size: 2.45rem;
  font-weight: 600;
  line-height: 1.08;
  letter-spacing: -0.038em;
  text-wrap: balance;
}
/* The mark reads as part of the sentence: an em square nudged up, with 4px either side. */
.ui-hrb__glyph {
  position: relative;
  top: -0.1em;
  display: inline-block;
  width: 0.92em;
  height: 0.92em;
  margin: 0 4px;
  vertical-align: -0.12em;
}
.ui-hrb__glyph > * {
  display: block;
  width: 100%;
  height: 100%;
}
/* A mark the caller composes into a node headline gets the same treatment. */
.ui-hrb__title > svg,
.ui-hrb__title > img {
  display: inline-block;
  width: 0.92em;
  height: 0.92em;
  margin: 0 4px;
  vertical-align: -0.12em;
}

.ui-hrb__heading {
  max-width: 100%;
}
.ui-hrb__heading > :first-child {
  margin-top: 0;
}
.ui-hrb__heading > :last-child {
  margin-bottom: 0;
}

/* Paragraphs -------------------------------------------------------------- */
.ui-hrb__lead {
  max-width: 36rem;
  margin: 16px 0 0;
  color: var(--ui-hrb-lead-ink, #1a1410d1);
  font-size: 1.125rem;
  font-weight: 500;
  line-height: 1.55;
  text-wrap: pretty;
}
.ui-hrb__sub {
  max-width: 38rem;
  margin: 10px 0 0;
  color: var(--ui-hrb-muted, #6f625a);
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.6;
  text-wrap: pretty;
}
.ui-hrb__title + .ui-hrb__sub,
.ui-hrb__heading + .ui-hrb__sub {
  margin-top: 16px;
}

/* Calls to action --------------------------------------------------------- */
.ui-hrb__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  margin-top: 20px;
}
.ui-hrb__actions > * {
  display: inline-flex;
  flex: 0 1 auto;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  max-width: 100%;
  padding: 0 22px;
  border: 0;
  border-radius: 12px;
  background-color: transparent;
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.01em;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform var(--nm-dur-1, 90ms) var(--ui-hrb-ease, cubic-bezier(0.22, 1, 0.36, 1)),
    box-shadow var(--nm-dur-2, 160ms) var(--ui-hrb-ease, cubic-bezier(0.22, 1, 0.36, 1));
}
/* The first action is the primary: the band's one live thing. */
.ui-hrb__actions > :first-child {
  background-image: linear-gradient(135deg, var(--ui-hrb-accent, #c2410c), var(--ui-hrb-accent-deep, #9a3412));
  color: var(--ui-hrb-accent-ink, #fffdfb);
  box-shadow: var(--ui-hrb-cta-shadow, 0 1px 2px #0b090814, 0 10px 24px -12px #c2410c66);
}
.ui-hrb__actions > :not(:first-child) {
  background-color: var(--ui-hrb-panel, #fffdfb);
  color: var(--ui-hrb-ink, #1a1410);
  box-shadow: inset 0 0 0 1px var(--ui-hrb-line, #e8e0d7);
}
.ui-hrb__actions > :first-child:hover {
  transform: translate3d(0, -1px, 0);
  box-shadow: var(--ui-hrb-cta-shadow-hover, 0 2px 4px #0b09081a, 0 16px 30px -12px #c2410c80);
}
.ui-hrb__actions > :not(:first-child):hover {
  transform: translate3d(0, -1px, 0);
  box-shadow: inset 0 0 0 1px var(--ui-hrb-accent, #c2410c);
}
.ui-hrb__actions > :first-child:active,
.ui-hrb__actions > :not(:first-child):active {
  transform: translate3d(0, 0, 0);
}
.ui-hrb__actions > *:focus-visible {
  outline: 2px solid var(--ui-hrb-accent, #c2410c);
  outline-offset: 2px;
}

/* Narrow screens: the longest headline word is wider than the band's content box at 2.45rem,
 * so the headline steps down and keeps its own padding. The mark is in ems, so it follows. */
@media (max-width: 400px) {
  .ui-hrb__title {
    font-size: 2rem;
  }
}

@media (min-width: 1024px) {
  .ui-hrb {
    padding: 44px 36px 36px;
  }
}

:where(.dark, [data-theme="dark"]) .ui-hrb {
  --ui-hrb-ink: var(--text, #f4ece4);
  --ui-hrb-lead-ink: #f4ece4d1;
  --ui-hrb-muted: var(--text-muted, #a2958a);
  --ui-hrb-line: var(--border, #33291f);
  --ui-hrb-panel: var(--panel, #1a1512);
  --ui-hrb-accent: var(--accent, #ff6b35);
  --ui-hrb-accent-deep: var(--accent-hover, #ff8256);
  --ui-hrb-accent-ink: var(--accent-fg, #1a0f08);
  --ui-hrb-cta-shadow: 0 1px 2px #00000059, 0 10px 24px -12px #ff6b3540;
  --ui-hrb-cta-shadow-hover: 0 2px 4px #00000066, 0 16px 30px -12px #ff6b3559;
}

@media (prefers-reduced-motion: reduce) {
  .ui-hrb > [data-enter] {
    animation: none;
    opacity: 1;
    transform: none;
  }
  .ui-hrb__actions > *,
  .ui-hrb__actions > :first-child:hover,
  .ui-hrb__actions > :not(:first-child):hover,
  .ui-hrb__actions > :first-child:active,
  .ui-hrb__actions > :not(:first-child):active {
    transform: none;
    transition-duration: 1ms;
  }
}
`;
