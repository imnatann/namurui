"use client";

import type { ReactNode } from "react";

/*
 * Highlight Band: one line lifted out of the prose around it and set on a solid ground, square
 * cornered, hugging its own text so the colour ends where the sentence ends.
 * The band is an inline-block with a capped measure, so a long line folds onto a second row of
 * the same ground at 320px instead of clipping or pushing the page sideways; an optional caption
 * sits above it in the muted ink, and the ground comes from the semantic set with the ink picked
 * per tone to stay above the AA floor. Styles are injected below, so no extra files are needed.
 */

export type HighlightBandProps = {
  /** The line the band carries; it wraps onto a second row rather than clipping */
  children: ReactNode;
  /** Ground the band is painted with; each tone ships an ink checked against it */
  tone?: "accent" | "success" | "warning";
  /** Small caption above the band, in the muted ink; omit it and the band stands alone */
  label?: string;
  /** Centred in the host column, or flush to its left edge */
  align?: "center" | "left";
  /** Extra class on the root */
  className?: string;
};

export function HighlightBand({
  children,
  tone = "accent",
  label,
  align = "center",
  className,
}: HighlightBandProps) {
  return (
    <div
      className={["ui-hlb", className].filter(Boolean).join(" ")}
      data-tone={tone}
      data-align={align}
    >
      {/* React 19 hoists this into <head> once, no matter how many bands render */}
      <style href="ui-highlight-band" precedence="default">
        {css}
      </style>
      {label ? <p className="ui-hlb__label">{label}</p> : null}
      <p className="ui-hlb__band">{children}</p>
    </div>
  );
}

const css = /* css */ `
.ui-hlb {
  /* Knobs. Override any of these on .ui-hlb to retheme the band in a host. */
  --ui-hlb-accent: var(--accent, #c2410c);
  --ui-hlb-success: var(--success, #1a7a4a);
  --ui-hlb-warning: var(--warning, #9a6410);
  --ui-hlb-ink: var(--text, #1a1410);
  --ui-hlb-muted: var(--text-muted, #6f625a);
  --ui-hlb-on-tone: #faf7f4;
  --ui-hlb-gap: 0.4rem;

  display: block;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  color: var(--ui-hlb-ink, #1a1410);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
  text-align: center;
}
.ui-hlb *,
.ui-hlb *::before,
.ui-hlb *::after {
  box-sizing: border-box;
}

.ui-hlb[data-align="left"] {
  text-align: left;
}

/* A caption, not a heading: small, uppercase and letterspaced, so the band below it keeps the
 * only display weight on screen. Never under 11px, because the words carry meaning. */
.ui-hlb__label {
  display: block;
  margin: 0 0 var(--ui-hlb-gap, 0.4rem);
  color: var(--ui-hlb-muted, #6f625a);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  overflow-wrap: break-word;
}

/* The band hugs its text but never grows past the column, so a long line folds inside the
 * ground and a narrow host stays free of horizontal overflow. Corners stay square on purpose:
 * every other Ember surface is a soft card, and the one hard-edged object on a page reads as a
 * marker stroke rather than another card. Padding is even on all four sides so the caps sit in
 * the middle of the ground instead of touching its edges. */
.ui-hlb__band {
  display: inline-block;
  max-width: 100%;
  margin: 0;
  padding: 0.45rem 0.9rem;
  border-radius: 0;
  color: var(--ui-hlb-on-tone, #faf7f4);
  background: var(--ui-hlb-ground, #c2410c);
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: -0.02em;
  text-wrap: pretty;
  overflow-wrap: break-word;
}

.ui-hlb[data-tone="accent"] .ui-hlb__band {
  --ui-hlb-ground: var(--ui-hlb-accent, #c2410c);
}
.ui-hlb[data-tone="success"] .ui-hlb__band {
  --ui-hlb-ground: var(--ui-hlb-success, #1a7a4a);
}
.ui-hlb[data-tone="warning"] .ui-hlb__band {
  --ui-hlb-ground: var(--ui-hlb-warning, #9a6410);
}

:where(.dark, [data-theme="dark"]) .ui-hlb {
  --ui-hlb-accent: var(--accent, #ff6b35);
  --ui-hlb-success: var(--success, #4f9d6e);
  --ui-hlb-warning: var(--warning, #d99530);
  --ui-hlb-ink: var(--text, #f4ece4);
  --ui-hlb-muted: var(--text-muted, #a2958a);
  /* Ember is bright in the dark theme, so the ink flips rather than lightening the ground */
  --ui-hlb-on-tone: #14100d;
}
`;
