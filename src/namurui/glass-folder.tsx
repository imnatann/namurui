"use client";

import { useId } from "react";

/*
 * Glass Folder – a glassy blue folder with three documents behind a frosted pocket, in a single
 * self-contained file. Three SVG layers stacked in a 3D perspective: the blue back with a
 * highlight rim, the sheets on their own layer, and the frosted pocket as a blurred glass panel.
 * Everything is CSS: the pocket tips forward with rotateX while each sheet slides up and turns
 * on its own, so the documents fan out of the opening. It scales with its container width.
 */

export type GlassFolderProps = {
  /** Accessible description of the illustration */
  label?: string;
  className?: string;
};

/** The folder outline, with the tab folded up on the left */
const FOLDER =
  "M38 0H176Q196 0 204 14L218 30Q224 38 246 38H562Q600 38 600 76V462Q600 500 562 500H38Q0 500 0 462V38Q0 0 38 0Z";

/** The ruled lines on each sheet: y and width on the 280 × 350 page */
const LINES: { y: number; width: number }[] = [
  { y: 87, width: 78 },
  { y: 115, width: 180 },
  { y: 143, width: 140 },
  { y: 171, width: 175 },
  { y: 199, width: 126 },
  { y: 227, width: 168 },
  { y: 255, width: 110 },
];

/** The three sheets, back to front */
const SHEETS = ["left", "right", "middle"] as const;

export function GlassFolder({
  label = "Blue folder holding three documents behind a frosted front pocket",
  className,
}: GlassFolderProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `ui-fd${uid}-${name}`;

  return (
    <div className={["ui-fd", className].filter(Boolean).join(" ")} role="img" aria-label={label}>
      {/* React 19 hoists this into <head> once, no matter how many folders render */}
      <style href="ui-glass-folder" precedence="default">
        {css}
      </style>

      <div className="ui-fd-icon" aria-hidden="true">
        {/* Back of the folder, plus a bright rim traced by the highlight filter */}
        <svg className="ui-fd-layer ui-fd-back" viewBox="0 0 600 500">
          <defs>
            <filter id={id("hl")} x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur" />
              <feOffset in="blur" dy="3" result="offset" />
              <feComposite in="blur" in2="offset" operator="arithmetic" k2="1" k3="-1" result="diff" />
              <feFlood floodColor="#fff" floodOpacity="0.65" />
              <feComposite in2="diff" operator="in" result="light" />
              <feComposite in="light" in2="SourceAlpha" operator="in" />
            </filter>
          </defs>
          <path className="ui-fd-back-fill" d={FOLDER} fill="#5bb7ea" />
          <path d={FOLDER} fill="#000" filter={`url(#${id("hl")})`} />
        </svg>

        {/* The sheets, each one placed and turned by its own modifier class */}
        <svg className="ui-fd-layer" viewBox="0 0 600 500">
          <defs>
            <linearGradient id={id("paper")} x1="0" y1="0" x2="0" y2="1">
              <stop className="ui-fd-paper-top" offset="0%" stopColor="#fff" />
              <stop className="ui-fd-paper-bottom" offset="100%" stopColor="#eaf2f8" />
            </linearGradient>
            <symbol id={id("doc")} overflow="visible">
              <rect
                className="ui-fd-paper"
                x="0.6"
                y="0.6"
                width="278.8"
                height="348.8"
                rx="19.4"
                fill={`url(#${id("paper")})`}
                stroke="rgba(0,0,0,0.12)"
                strokeWidth="1.2"
              />
              {LINES.map((line) => (
                <rect
                  key={line.y}
                  className="ui-fd-line"
                  x="30"
                  y={line.y}
                  width={line.width}
                  height="9"
                  rx="4.5"
                  fill="rgba(0,0,0,0.12)"
                />
              ))}
            </symbol>
          </defs>
          {SHEETS.map((sheet) => (
            <use key={sheet} className={`ui-fd-doc ui-fd-doc--${sheet}`} href={`#${id("doc")}`} />
          ))}
        </svg>

        {/* Frosted pocket: tips forward on hover, so the sheets peek out of the opening */}
        <div className="ui-fd-front" />
      </div>
    </div>
  );
}

/* ---------- Styles ---------- */

const css = /* css */ `
.ui-fd{--ui-fd-ease: cubic-bezier(0.2, 0.85, 0.25, 1);position: relative;width: 100%;aspect-ratio: 3 / 2;overflow: hidden;container-type: inline-size;font-family: "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif}
.ui-fd-icon{position: absolute;left: 50%;top: 50%;width: 40%;aspect-ratio: 6 / 5;container-type: inline-size;perspective: 220cqw;perspective-origin: 50% 60%;transform: translate(-50%, -48%);transition: transform var(--nm-dur-5, 620ms) var(--ui-fd-ease)}
.ui-fd-icon:hover{transform: translate(-50%, -48%) scale(1.03)}
.ui-fd-layer{position: absolute;inset: 0;width: 100%;height: 100%;overflow: visible}
.ui-fd-back{filter: drop-shadow(0 4cqw 4.6cqw rgba(255, 107, 53, 0.28)) drop-shadow(0 1.3cqw 2cqw rgba(255, 107, 53, 0.16)) drop-shadow(0 0.3cqw 0.7cqw rgba(255, 107, 53, 0.1))}
.ui-fd-doc{transform-box: fill-box;transform-origin: center;filter: drop-shadow(0 3px 4px rgba(163, 63, 22, 0.18));transition: transform var(--nm-dur-5, 620ms) var(--ui-fd-ease)}
.ui-fd-doc--left{transform: translate(40px, 80px) rotate(6deg)}
.ui-fd-doc--right{transform: translate(280px, 80px) rotate(6deg)}
.ui-fd-doc--middle{transform: translate(160px, 66px) rotate(-4deg)}
.ui-fd-icon:hover .ui-fd-doc--left{transform: translate(32px, 70px) rotate(9deg)}
.ui-fd-icon:hover .ui-fd-doc--right{transform: translate(286px, 76px) rotate(5deg)}
.ui-fd-icon:hover .ui-fd-doc--middle{transform: translate(166px, 52px) rotate(-7deg)}
.ui-fd-front{position: absolute;inset: 21.6% 0 0;border-radius: 6.333cqw;background: linear-gradient(180deg, rgba(163, 63, 22, 0) 74%, rgba(163, 63, 22, 0.28) 100%), linear-gradient(180deg, rgba(255, 138, 92, 0.45) 0%, rgba(255, 107, 53, 0.45) 100%);box-shadow: inset 0 0 0 0.67cqw rgba(255, 253, 251, 0.3), inset 0 0.25cqw 0 rgba(255, 253, 251, 0.55);-webkit-backdrop-filter: blur(3.3cqw) saturate(1.1);backdrop-filter: blur(3.3cqw) saturate(1.1);transform-origin: 50% 100%;transition: top var(--nm-dur-5, 620ms) var(--ui-fd-ease), border-radius var(--nm-dur-5, 620ms) var(--ui-fd-ease), transform var(--nm-dur-5, 620ms) var(--ui-fd-ease)}
.ui-fd-icon:hover .ui-fd-front{top: 24.8%;border-radius: 3cqw 3cqw 6.333cqw 6.333cqw;transform: translateZ(2.33cqw) rotateX(-9deg)}
:where(.dark, [data-theme="dark"]) .ui-fd-back-fill{fill: #ff6b35}
:where(.dark, [data-theme="dark"]) .ui-fd-paper-top{stop-color: #372d22}
:where(.dark, [data-theme="dark"]) .ui-fd-paper-bottom{stop-color: #2a231b}
:where(.dark, [data-theme="dark"]) .ui-fd-paper{stroke: rgba(255, 253, 251, 0.1)}
:where(.dark, [data-theme="dark"]) .ui-fd-line{fill: rgba(255, 253, 251, 0.16)}
:where(.dark, [data-theme="dark"]) .ui-fd-back{filter: drop-shadow(0 4cqw 4.6cqw rgba(11, 9, 8, 0.45)) drop-shadow(0 1.3cqw 2cqw rgba(11, 9, 8, 0.3))}
:where(.dark, [data-theme="dark"]) .ui-fd-doc{filter: drop-shadow(0 3px 4px rgba(11, 9, 8, 0.45))}
:where(.dark, [data-theme="dark"]) .ui-fd-front{background: linear-gradient(180deg, rgba(163, 63, 22, 0) 70%, rgba(163, 63, 22, 0.4) 100%), linear-gradient(180deg, rgba(255, 138, 92, 0.42) 0%, rgba(255, 107, 53, 0.5) 100%);box-shadow: inset 0 0 0 0.67cqw rgba(255, 253, 251, 0.14), inset 0 0.25cqw 0 rgba(255, 253, 251, 0.3)}
@media (prefers-reduced-motion: reduce){.ui-fd-icon, .ui-fd-doc, .ui-fd-front{transition: none}
}

`;
