"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/*
 * Gradient Text – a word cut out of a flowing gradient, in a single self-contained file.
 * Three soft radial blobs and a wide linear band sit behind the letters, clipped to the text,
 * and drift on a slow loop so the fill never visibly repeats.
 * The first time the word is at least 60 % on screen the colour wipes in from the left; until
 * the wipe lands, the plain inherited text colour shows through.
 * The word stays real, selectable text – the gradient copy sits on top and is hidden from
 * screen readers. Font, size, weight and tracking come from the parent, so it can sit inside
 * a heading, a label or a paragraph.
 */

/** Two to four stops, in the order the sheet uses them: base start, base end, blob one, blob two */
export type GradientPalette = readonly [string, string, ...string[]];

export type GradientTextProps = {
  /** The word to fill – plain text, because the gradient layer renders the same characters */
  children: string;
  /** Palette override; the sheet's own palette (and its dark-mode pair) applies when omitted */
  colors?: GradientPalette;
  /** Seconds per flow loop */
  speed?: number;
  /** Wipe the colour in from the left the first time the word is seen */
  sweep?: boolean;
  /** Share of the word that must be on screen before the wipe starts, 0–1 */
  threshold?: number;
  /** Extra class on the root span */
  className?: string;
};

type PaletteVars = {
  "--ui-gt-c1"?: string;
  "--ui-gt-c2"?: string;
  "--ui-gt-c3"?: string;
  "--ui-gt-c4"?: string;
};

/** The palette as custom properties – the sheet reads them, so no colour is ever written in JSX */
function paletteVars(colors?: GradientPalette): PaletteVars {
  if (!colors) return {};
  const [baseFrom, baseTo, blobOne = baseFrom, blobTwo = baseTo] = colors;
  return {
    "--ui-gt-c1": baseFrom,
    "--ui-gt-c2": baseTo,
    "--ui-gt-c3": blobOne,
    "--ui-gt-c4": blobTwo,
  };
}

export function GradientText({
  children,
  colors,
  speed = 8,
  sweep = true,
  threshold = 0.6,
  className,
}: GradientTextProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [revealed, setRevealed] = useState(!sweep);
  // The wipe is a first-sight event: once it has landed, later prop changes must not replay it
  const done = useRef(!sweep);

  // Wipe the colour in once, the first time the word comes into view
  useEffect(() => {
    if (!sweep) {
      done.current = true;
      setRevealed(true);
      return;
    }
    if (done.current) return;
    const el = ref.current;
    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!el || reduced || typeof IntersectionObserver === "undefined") {
      done.current = true;
      setRevealed(true);
      return;
    }

    setRevealed(false);
    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        // Two frames, so the clipped state is painted and the edge actually travels
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => {
            done.current = true;
            setRevealed(true);
          });
        });
      },
      { threshold: Math.min(Math.max(threshold, 0), 1) },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [sweep, threshold]);

  const style = {
    "--ui-gt-speed": `${Math.max(speed, 0.5)}s`,
    ...paletteVars(colors),
  } as CSSProperties;

  return (
    <span
      ref={ref}
      className={["ui-gt", className].filter(Boolean).join(" ")}
      style={style}
      data-state={revealed ? "in" : "idle"}
      data-sweep={sweep ? "" : undefined}
    >
      {/* React 19 hoists this into <head> once, no matter how many words render */}
      <style href="ui-gradient-text" precedence="default">
        {css}
      </style>

      <span className="ui-gt__base">{children}</span>
      <span className="ui-gt__fill" aria-hidden="true">
        {children}
      </span>
    </span>
  );
}

const css = /* css */ `
.ui-gt{--ui-gt-c1: #b3261e;--ui-gt-c2: #c2703a;--ui-gt-c3: #e2544a;--ui-gt-c4: #ff8a5c;--ui-gt-sweep: 1100ms;position: relative;display: inline-block;margin: 0;font: inherit;letter-spacing: inherit}
.ui-gt__base{color: inherit;transition: color 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-gt__fill{position: absolute;inset: 0;pointer-events: none;user-select: none;color: transparent;-webkit-text-fill-color: transparent;background-image: radial-gradient(closest-side, var(--ui-gt-c3), transparent), radial-gradient(closest-side, var(--ui-gt-c4), transparent), radial-gradient(closest-side, var(--ui-gt-c1), transparent), linear-gradient(100deg, var(--ui-gt-c1) 10%, var(--ui-gt-c2) 90%);background-size: 70% 170%, 80% 190%, 60% 160%, 100% 100%;background-repeat: no-repeat;background-position: -20% 30%, 120% 70%, 50% -40%, 0 0;-webkit-background-clip: text;background-clip: text;clip-path: inset(-0.25em -0.25em -0.25em -0.25em);animation: ui-gt-flow var(--ui-gt-speed) ease-in-out infinite}
.ui-gt[data-sweep][data-state="idle"] .ui-gt__fill{clip-path: inset(-0.25em 100% -0.25em -0.25em)}
.ui-gt[data-sweep] .ui-gt__fill{transition: clip-path var(--ui-gt-sweep) cubic-bezier(0.65, 0, 0.25, 1)}
.ui-gt[data-state="in"] .ui-gt__base{color: transparent}
.ui-gt[data-sweep][data-state="in"] .ui-gt__base{transition-delay: calc(var(--ui-gt-sweep) - 200ms)}
@keyframes ui-gt-flow{0%, 100%{background-position: -20% 30%, 120% 70%, 50% -40%, 0 0}
25%{background-position: 40% 110%, 60% -10%, 110% 60%, 0 0}
50%{background-position: 120% 40%, -20% 40%, 40% 140%, 0 0}
75%{background-position: 60% -30%, 30% 120%, -10% 30%, 0 0}
}
@media (prefers-reduced-motion: reduce){.ui-gt .ui-gt__fill, .ui-gt[data-sweep][data-state="idle"] .ui-gt__fill{animation: none;transition: none;clip-path: inset(-0.25em -0.25em -0.25em -0.25em)}
.ui-gt .ui-gt__base, .ui-gt[data-sweep] .ui-gt__base{color: transparent;transition: none}
}
:where(.dark, [data-theme="dark"]) .ui-gt{--ui-gt-c1: #e2544a;--ui-gt-c2: #ff8a5c;--ui-gt-c3: #f0938c;--ui-gt-c4: #ff8a5c}

`;
