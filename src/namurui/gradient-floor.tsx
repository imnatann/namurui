"use client";

import { useId, type CSSProperties, type ReactNode } from "react";

/*
 * Gradient Floor – a blurred colour gradient glowing up from the bottom edge, in a single
 * self-contained file.
 * Two SVG crests hang below the box, both wider than it: a saturated one whose ridge runs
 * from orange through pink into blue, and a white one blended over it with plus-lighter as
 * the specular line. Each crest is scaled 4× and blurred, then drifts and breathes on a 2.5s
 * beat – the colour crest on the wider arc, the light on the tighter one – so their peaks
 * slide against each other and the floor never lands on quite the same shape twice. Reduced
 * motion freezes both, and a speed of 0 holds the shape deliberately. The styles are injected
 * below, so no extra files are needed.
 */

/** The crest's stops, from the ridge of the shape down towards the floor. */
export type GradientFloorColors = [string, string, string];

export type GradientFloorProps = {
  /** Content that sits above the glow; the root needs a height, usually on `className` */
  children?: ReactNode;
  /** The crest's three stops – defaults to the reference's orange, pink and blue */
  colors?: GradientFloorColors;
  /** Seconds per drift loop; 0 holds the shape still */
  speed?: number;
  /** Extra class on the root, e.g. for height or rounded corners */
  className?: string;
};

/** The three stops the reference ships: the ridge, the shoulder and the deep end. */
const DEFAULT_COLORS: GradientFloorColors = ["#FF7700", "#FF0055", "#0073FF"];

/** The sheet's own loop length. Any other speed is written inline over it. */
const DEFAULT_SPEED = 2.5;

export function GradientFloor({
  children,
  colors = DEFAULT_COLORS,
  speed = DEFAULT_SPEED,
  className,
}: GradientFloorProps) {
  // The reference names its gradient after React's id, so a second floor can never collide with the first
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const fillId = `ui-gf${uid}-fill`;
  const still = speed <= 0;

  const style = {
    "--ui-gf-c1": colors[0],
    "--ui-gf-c2": colors[1],
    "--ui-gf-c3": colors[2],
  } as CSSProperties;

  /* The sheet owns the layer boxes; only the loop length is ours to override, and the default needs no trace */
  const bleedStyle: CSSProperties | undefined =
    still || speed === DEFAULT_SPEED ? undefined : { animationDuration: `${speed}s` };

  return (
    <div
      className={["ui-gf", className].filter(Boolean).join(" ")}
      style={style}
      data-paused={still ? "" : undefined}
    >
      {/* React 19 hoists this into <head> once, no matter how many floors render */}
      <style href="ui-gradient-floor" precedence="default">
        {css}
      </style>

      <div className="ui-gf-layer ui-gf-layer--color" aria-hidden="true">
        <div className="ui-gf-bleed" style={bleedStyle}>
          <svg viewBox="0 0 3447.1 1514.1" preserveAspectRatio="none">
            <defs>
              <linearGradient
                id={fillId}
                x1="1723.8"
                y1="423.3"
                x2="1723.8"
                y2="894.3"
                gradientUnits="userSpaceOnUse"
              >
                <stop style={{ stopColor: "var(--ui-gf-c1)" }} />
                <stop offset="0.302885" style={{ stopColor: "var(--ui-gf-c2)" }} />
                <stop offset="0.673077" style={{ stopColor: "var(--ui-gf-c3)" }} />
              </linearGradient>
            </defs>
            <path
              d="M926.8 496.6C926.8 496.6 302.1 267.4 291.3 261.4V1222.8H3155.8V256.1L2493.8 607.3H2189.3V607.3L1898.8 505.8H1510.8V505.8L1230.8 496.6H926.8V496.6Z"
              fill={`url(#${fillId})`}
            />
          </svg>
        </div>
      </div>

      <div className="ui-gf-layer ui-gf-layer--light" aria-hidden="true">
        <div className="ui-gf-bleed" style={bleedStyle}>
          <svg viewBox="0 0 2904.96 1275.97" preserveAspectRatio="none">
            <path
              d="M781.039 418.5C781.039 418.5 254.588 225.3 245.486 220.3V1030.49H2659.48V215.8L2101.59 511.8H1844.98V511.8L1600.17 426.2H1273.19V426.2L1037.23 418.5H781.039V418.5Z"
              fill="#fff"
              fillOpacity={0.8}
            />
          </svg>
        </div>
      </div>

      {children ? <div className="ui-gf-content">{children}</div> : null}
    </div>
  );
}

const css = /* css */ `
.ui-gf{position: relative;container-type: inline-size;overflow: hidden;isolation: isolate;background: var(--ui-gf-bg, #fafafa)}
.ui-gf-layer{position: absolute;pointer-events: none}
.ui-gf-layer--color{left: calc(-290 * 100cqw / 2200);bottom: calc(-484.5 * 100cqw / 2200);width: calc(2864.5 * 100cqw / 2200);height: calc(931.5 * 100cqw / 2200)}
.ui-gf-layer--light{left: calc(-65 * 100cqw / 2200);bottom: calc(-507 * 100cqw / 2200);width: calc(2414 * 100cqw / 2200);height: calc(785 * 100cqw / 2200);mix-blend-mode: plus-lighter}
.ui-gf-bleed{position: absolute;inset: -31.27% -10.17%;transform-origin: 50% 70%;will-change: transform}
.ui-gf-bleed svg{position: absolute;top: 0;left: 0;display: block;width: 25%;height: 25%;overflow: visible;transform: scale(4);transform-origin: 0 0;will-change: transform}
.ui-gf-layer--color svg{filter: blur(calc(calc(145.65 * 100cqw / 2200) / 4))}
.ui-gf-layer--light svg{filter: blur(calc(calc(122.74 * 100cqw / 2200) / 4))}
.ui-gf-layer--color .ui-gf-bleed{animation: ui-gf-drift-color var(--nm-dur-6, 1100ms) ease-in-out infinite}
.ui-gf-layer--light .ui-gf-bleed{animation: ui-gf-drift-light var(--nm-dur-6, 1100ms) ease-in-out infinite}
@keyframes ui-gf-drift-color{0%, 100%{transform: translate(0, 0) scale(1, 1)}
33%{transform: translate(calc(-120 * 100cqw / 2200), calc(-20 * 100cqw / 2200)) scale(1.05, 1.08)}
66%{transform: translate(calc(100 * 100cqw / 2200), calc(12 * 100cqw / 2200)) scale(0.98, 0.96)}
}
@keyframes ui-gf-drift-light{0%, 100%{transform: translate(0, 0) scale(1, 1)}
33%{transform: translate(calc(-100 * 100cqw / 2200), calc(-10 * 100cqw / 2200)) scale(1.03, 1)}
66%{transform: translate(calc(85 * 100cqw / 2200), calc(10 * 100cqw / 2200)) scale(0.98, 0.94)}
}
.ui-gf[data-paused] .ui-gf-bleed{animation-play-state: paused}
.ui-gf-content{position: relative;z-index: 1;height: 100%}
:where(.dark, [data-theme="dark"]) .ui-gf{--ui-gf-bg: #181310}
@media (prefers-reduced-motion: reduce){.ui-gf-bleed{animation: none}
}

`;
