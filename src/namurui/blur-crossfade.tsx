"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/*
 * Blur Crossfade – swaps its content in place without moving the page, in a single self-contained file.
 * The copy on its way out blurs, fades and grows a little while the arriving one sharpens in from 98 %.
 * The box glides from the size it had to the size the new copy needs, read from the pane itself with a
 * ResizeObserver, so a font that lands late or a line that wraps still settles cleanly. It clips only
 * while the swap runs, which leaves shadows and focus rings alone the rest of the time.
 * Only the current copy is exposed: the leaving one is aria-hidden and inert.
 */

export type BlurCrossfadeProps = {
  /** Key of the content on screen – changing it starts the swap */
  id: string | number;
  /** The content for the current id */
  children: ReactNode;
  /** Length of the swap, and of the size glide, in ms */
  duration?: number;
  /** Blur in px at the far end of each fade */
  blur?: number;
  /** Which sides glide to the new size: "both" follows the width too, "none" leaves the box put */
  morph?: "height" | "both" | "none";
  /** Root element – "span" inside a button or any other inline content */
  as?: "div" | "span";
  /** Extra class on the box */
  className?: string;
};

export function BlurCrossfade({
  id,
  children,
  duration = 420,
  blur = 10,
  morph = "height",
  as = "div",
  className,
}: BlurCrossfadeProps) {
  /* What is on screen, and a counter that moves with it – the counter keys the entering layer, so
   * two swaps in a row can never reuse a node and skip the animation. */
  const [shown, setShown] = useState({ id, seq: 0 });
  /* The copy on its way out, or null while the box is at rest */
  const [leaving, setLeaving] = useState<{ seq: number; children: ReactNode } | null>(null);

  /* The children of the last commit. Read at the exact render where the id changes, this is still
   * the copy the reader can see – which is the one that has to fade out, not the new one. */
  const painted = useRef<ReactNode>(children);
  useEffect(() => {
    painted.current = children;
  });

  /* Swapping is a render-time fact, not an effect: the outgoing copy has to arrive in the same
   * commit as the incoming one, or the box shows the new content for a frame before it fades. */
  if (shown.id !== id) {
    setLeaving({ seq: shown.seq, children: painted.current });
    setShown({ id, seq: shown.seq + 1 });
  }

  const swapping = leaving !== null;
  const ms = Math.max(duration, 0);

  const box = useRef<HTMLElement | null>(null);
  const pane = useRef<HTMLSpanElement | null>(null);
  /* The size the box last settled on – the next glide starts from there */
  const size = useRef({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const b = box.current;
    const p = pane.current;
    if (!b || !p) return;

    if (!swapping || morph === "none") {
      // At rest the box is as big as its content; nothing is pinned and nothing transitions
      b.style.height = "";
      b.style.width = "";
      b.style.transition = "";
      size.current = { w: p.offsetWidth, h: p.offsetHeight };
    } else {
      // The pane is in flow and the leaving layer is absolute, so this is the size of what arrives
      const next = { w: p.offsetWidth, h: p.offsetHeight };
      // Mid-swap the box already carries a pinned size – carry on from where it visually stands,
      // otherwise start from the size it last settled on (StrictMode re-runs land here too)
      const from = b.style.height ? { w: b.offsetWidth, h: b.offsetHeight } : size.current;

      // Stand on the old size and let the browser take it before arming the glide
      b.style.transition = "none";
      b.style.height = `${from.h || next.h}px`;
      if (morph === "both") b.style.width = `${from.w || next.w}px`;
      void b.offsetHeight;

      // Reduced motion drops both layer animations in the sheet, so the size has to stop gliding too
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        b.style.transition = "";
      } else {
        b.style.transition =
          morph === "both"
            ? `height ${ms}ms var(--ui-bx-ease), width ${ms}ms var(--ui-bx-ease)`
            : `height ${ms}ms var(--ui-bx-ease)`;
      }

      b.style.height = `${next.h}px`;
      if (morph === "both") b.style.width = `${next.w}px`;
    }

    // Whatever changes the pane while the swap runs – a decoded image, a late font – the box follows
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      size.current = { w: p.offsetWidth, h: p.offsetHeight };
      if (!swapping || morph === "none") return;
      b.style.height = `${p.offsetHeight}px`;
      if (morph === "both") b.style.width = `${p.offsetWidth}px`;
    });
    observer.observe(p);
    return () => observer.disconnect();
  }, [shown.seq, swapping, morph, ms]);

  // End of the swap: the sheet is done with both layers. The timer is the floor, never the ceiling.
  useEffect(() => {
    if (!leaving) return;
    const hold = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
    const timer = window.setTimeout(() => setLeaving(null), hold + 40);
    return () => window.clearTimeout(timer);
  }, [leaving, ms]);

  const Tag = as;
  const style = {
    "--ui-bx-duration": `${ms}ms`,
    "--ui-bx-blur": `${Math.max(blur, 0)}px`,
  } as CSSProperties;
  const variant = morph === "both" ? "ui-bx--both" : morph === "none" ? "ui-bx--none" : "ui-bx--height";

  return (
    <Tag
      ref={box as never}
      className={["ui-bx", variant, className].filter(Boolean).join(" ")}
      style={style}
      data-busy={swapping ? "" : undefined}
    >
      {/* React 19 hoists this into <head> once, no matter how many boxes render */}
      <style href="ui-blur-crossfade" precedence="default">
        {css}
      </style>

      {leaving && (
        <span
          key={`out-${leaving.seq}`}
          className="ui-bx__layer ui-bx__layer--out"
          aria-hidden="true"
          inert
        >
          {leaving.children}
        </span>
      )}

      <span
        key={`in-${shown.seq}`}
        ref={pane}
        className={swapping ? "ui-bx__layer ui-bx__layer--in" : "ui-bx__layer"}
      >
        {children}
      </span>
    </Tag>
  );
}

const css = /* css */ `
.ui-bx{--ui-bx-duration: 420ms;--ui-bx-blur: 10px;--ui-bx-ease: cubic-bezier(0.22, 1, 0.36, 1);position: relative;display: block}
.ui-bx--both{display: inline-block;vertical-align: top}
.ui-bx[data-busy]{overflow: hidden}
.ui-bx__layer{display: block}
.ui-bx--both > .ui-bx__layer{width: max-content}
.ui-bx__layer--out{position: absolute;top: 0;left: 0;pointer-events: none}
.ui-bx--height > .ui-bx__layer--out, .ui-bx--none > .ui-bx__layer--out{right: 0}
.ui-bx--both > .ui-bx__layer--out{left: 50%;translate: -50% 0}
.ui-bx--both > .ui-bx__layer--in{margin-left: 50%;translate: -50% 0}
.ui-bx__layer--in{animation: ui-bx-in var(--ui-bx-duration) var(--ui-bx-ease) both}
.ui-bx__layer--out{animation: ui-bx-out calc(var(--ui-bx-duration) * 0.8) ease-in both}
@keyframes ui-bx-in{from{opacity: 0;filter: blur(var(--ui-bx-blur));transform: scale(0.98)}
to{opacity: 1;filter: blur(0);transform: scale(1)}
}
@keyframes ui-bx-out{from{opacity: 1;filter: blur(0);transform: scale(1)}
to{opacity: 0;filter: blur(var(--ui-bx-blur));transform: scale(1.02)}
}
@media (prefers-reduced-motion: reduce){.ui-bx__layer--in, .ui-bx__layer--out{animation: none}
.ui-bx__layer--out{display: none}
}
:where(.dark, [data-theme="dark"]) .ui-bx{color: inherit}

`;
