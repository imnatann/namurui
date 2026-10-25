"use client";

import { useId, type ReactNode } from "react";

/*
 * CTA Band: the closing band of a marketing page, a heading, a lead and an action row on a warm
 * ground, with a watermark mark sunk behind the content at the bottom. The mark is decoration and
 * nothing else: it is hidden from assistive tech, it never takes a pointer, and the content carries
 * its own stacking order so a tall mark can never reach a button. The band clips its own overflow
 * and caps the mark to a share of its own box, so decoration can never outgrow the band, and the
 * action row stacks full width on a phone. Content rises once on mount while the mark fades in
 * behind it; the styles are injected below, so no extra files are needed.
 */

export type CtaBandProps = {
  /** The closing line, set as the band heading */
  title: string;
  /** One or two sentences under the heading, held to 28rem so the line stays readable */
  lead?: ReactNode;
  /**
   * The buttons of the action row. Direct `<a>` and `<button>` children are styled as band
   * buttons, the ember primary by default; mark the secondary with `data-tone="quiet"`
   */
  actions?: ReactNode;
  /** A decorative mark drawn behind the content, anchored to the bottom edge; it is never announced and never clickable */
  watermark?: ReactNode;
  className?: string;
};

export function CtaBand({ title, lead, actions, watermark, className }: CtaBandProps) {
  const headingId = useId();

  return (
    <section
      className={["ui-ctb", className].filter(Boolean).join(" ")}
      aria-labelledby={headingId}
    >
      <style href="ui-cta-band" precedence="default">
        {css}
      </style>

      {/* Decoration only: out of the accessibility tree and out of the hit-test path */}
      {watermark ? (
        <div className="ui-ctb__mark" aria-hidden="true">
          {watermark}
        </div>
      ) : null}

      <div className="ui-ctb__content">
        <h2 className="ui-ctb__title" id={headingId}>
          {title}
        </h2>
        {lead ? <p className="ui-ctb__lead">{lead}</p> : null}
        {actions ? <div className="ui-ctb__actions">{actions}</div> : null}
      </div>
    </section>
  );
}

const css = /* css */ `
.ui-ctb {
  /* Knobs. Override any of these on .ui-ctb to retheme the band in a host. */
  --ui-ctb-ink: var(--text, #1a1410);
  --ui-ctb-muted: var(--text-muted, #6f625a);
  --ui-ctb-ground: var(--panel, #fffdfb);
  --ui-ctb-line: var(--border, #e8e0d7);
  --ui-ctb-heat: #c2410c14;
  --ui-ctb-mark: var(--accent, #c2410c);
  --ui-ctb-cta: var(--accent, #c2410c);
  --ui-ctb-cta-hover: #9a330a;
  --ui-ctb-cta-shadow: #c2410c59;
  --ui-ctb-on-cta: #fffdfb;
  --ui-ctb-quiet-ink: var(--text, #1a1410);
  --ui-ctb-quiet-line: var(--border, #e8e0d7);
  --ui-ctb-quiet-hover: #7a4a1c0a;
  --ui-ctb-focus: var(--accent, #c2410c);
  --ui-ctb-radius: var(--radius-panel, 20px);
  --ui-ctb-dur-press: var(--nm-dur-1, 90ms);
  --ui-ctb-dur-fast: var(--nm-dur-2, 160ms);
  --ui-ctb-dur: var(--nm-dur-4, 380ms);
  --ui-ctb-dur-mark: var(--nm-dur-5, 620ms);
  --ui-ctb-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));

  position: relative;
  isolation: isolate;
  box-sizing: border-box;
  width: 100%;
  padding: 64px 24px;
  overflow: hidden;
  background:
    radial-gradient(120% 100% at 50% 100%, var(--ui-ctb-heat) 0%, transparent 62%),
    var(--ui-ctb-ground);
  border-radius: var(--ui-ctb-radius);
  box-shadow:
    inset 0 0 0 1px var(--ui-ctb-line),
    inset 0 1px 0 #ffffffb3;
  color: var(--ui-ctb-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  text-align: center;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-ctb *,
.ui-ctb *::before,
.ui-ctb *::after {
  box-sizing: border-box;
}
.ui-ctb h2,
.ui-ctb p {
  margin: 0;
}

/* The mark: decoration behind everything, clipped by the band, bottom-anchored ------------ */
.ui-ctb__mark {
  position: absolute;
  left: 50%;
  bottom: 0;
  z-index: 0;
  /* Capped on both axes as a share of the band, so the mark can never outgrow the band it
     decorates: half the width, two thirds of the height, whichever binds first. */
  width: min(50%, 544px);
  max-height: 66%;
  aspect-ratio: 544 / 497;
  color: var(--ui-ctb-mark);
  opacity: 0.06;
  pointer-events: none;
  transform: translateX(-50%);
  animation: ui-ctb-mark-in var(--ui-ctb-dur-mark) var(--ui-ctb-ease-out) backwards;
  user-select: none;
}
.ui-ctb__mark > * {
  display: block;
  width: 100%;
  height: 100%;
}
.ui-ctb__mark svg {
  overflow: visible;
}
@keyframes ui-ctb-mark-in {
  from {
    opacity: 0;
  }
}

/* The content: capped at 48rem, and above the mark by an explicit stacking order ----------- */
.ui-ctb__content {
  position: relative;
  z-index: 1;
  max-width: 48rem;
  margin: 0 auto;
  animation: ui-ctb-rise var(--ui-ctb-dur) var(--ui-ctb-ease-out) backwards;
}
@keyframes ui-ctb-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}
.ui-ctb__title {
  font-size: clamp(1.55rem, 3.6vw, 1.9rem);
  font-weight: 600;
  line-height: 1.12;
  letter-spacing: -0.03em;
  color: var(--ui-ctb-ink);
  text-wrap: balance;
}
.ui-ctb__lead {
  max-width: 28rem;
  margin: 1rem auto 0;
  font-size: 1rem;
  line-height: 1.7;
  color: var(--ui-ctb-muted);
}

/* The action row: host buttons, styled here so a band reads the same on every page --------- */
.ui-ctb__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 2rem;
}
.ui-ctb__actions > a,
.ui-ctb__actions > button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  margin: 0;
  padding: 0 22px;
  border: 0;
  border-radius: var(--radius-control, 12px);
  background: var(--ui-ctb-cta);
  box-shadow:
    inset 0 1px 0 #ffffff2e,
    0 10px 22px -14px var(--ui-ctb-cta-shadow);
  color: var(--ui-ctb-on-cta);
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.2;
  text-decoration: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color var(--ui-ctb-dur-fast) var(--ui-ctb-ease-out),
    transform var(--ui-ctb-dur-press) var(--ui-ctb-ease-out);
}
.ui-ctb__actions > a:hover,
.ui-ctb__actions > button:hover {
  background: var(--ui-ctb-cta-hover);
}
.ui-ctb__actions > a:active,
.ui-ctb__actions > button:active {
  transform: translateY(1px);
}
.ui-ctb__actions > a:focus-visible,
.ui-ctb__actions > button:focus-visible {
  outline: 2px solid var(--ui-ctb-focus);
  outline-offset: 2px;
}
.ui-ctb__actions > [data-tone="quiet"] {
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--ui-ctb-quiet-line);
  color: var(--ui-ctb-quiet-ink);
}
.ui-ctb__actions > [data-tone="quiet"]:hover {
  background: var(--ui-ctb-quiet-hover);
}

@media (min-width: 768px) {
  .ui-ctb {
    padding: 96px 40px;
  }
}
/* A phone has no room for two side by side: each button takes the full row */
@media (max-width: 639px) {
  .ui-ctb {
    padding: 64px 20px;
  }
  .ui-ctb__actions {
    flex-direction: column;
    align-items: stretch;
  }
  .ui-ctb__actions > a,
  .ui-ctb__actions > button {
    width: 100%;
  }
}

:where(.dark, [data-theme="dark"]) .ui-ctb {
  --ui-ctb-ink: var(--text, #f4ece4);
  --ui-ctb-muted: var(--text-muted, #a2958a);
  --ui-ctb-ground: var(--panel, #1a1512);
  --ui-ctb-line: var(--border, #33291f);
  --ui-ctb-heat: #ff6b3514;
  --ui-ctb-mark: var(--accent, #ff6b35);
  --ui-ctb-cta: var(--accent, #ff6b35);
  --ui-ctb-cta-hover: #ff855a;
  --ui-ctb-cta-shadow: #ff6b354d;
  --ui-ctb-on-cta: #14100d;
  --ui-ctb-quiet-ink: var(--text, #f4ece4);
  --ui-ctb-quiet-line: var(--border, #33291f);
  --ui-ctb-quiet-hover: #ffffff0d;
  --ui-ctb-focus: var(--accent, #ff6b35);
  box-shadow:
    inset 0 0 0 1px var(--ui-ctb-line),
    inset 0 1px 0 #ffffff0f;
}

@media (prefers-reduced-motion: reduce) {
  .ui-ctb__mark,
  .ui-ctb__content {
    animation: none;
  }
  .ui-ctb__actions > a,
  .ui-ctb__actions > button {
    transition-duration: 1ms;
  }
  .ui-ctb__actions > a:active,
  .ui-ctb__actions > button:active {
    transform: none;
  }
}
`;
