import { useState, type CSSProperties } from "react";
import { HighlightBand } from "../highlight-band";

/* Contrast, measured on the ground each tone paints and the ink it sets on it, normal text at
 * 4.5:1 is the floor:
 *   light  accent  ink #faf7f4 on ground #c2410c = 4.85:1
 *          success ink #faf7f4 on ground #1a7a4a = 5.01:1
 *          warning ink #faf7f4 on ground #9a6410 = 4.68:1
 *   dark   accent  ink #14100d on ground #ff6b35 = 6.67:1
 *          success ink #14100d on ground #4f9d6e = 5.75:1
 *          warning ink #14100d on ground #d99530 = 7.47:1
 * Every pair clears AA, and the dark theme flips the ink instead of darkening the ground,
 * because Ember is the brighter colour on charcoal.
 */

type Align = "center" | "left";
type Tone = "accent" | "success" | "warning";

/* One band is live at a time. Three solid grounds stacked on one page read as three statuses,
 * and a page only ever has one status worth shouting about, so the tone control swaps the
 * ground and the sentence together instead of parking all three on screen. */
const TONES = [
  {
    tone: "accent",
    control: "Accent",
    caption: "Included in every plan",
    line: "Chatrigo Micro Included",
  },
  {
    tone: "success",
    control: "Success",
    caption: "Delivery",
    line: "Live in three working days",
  },
  {
    tone: "warning",
    control: "Warning",
    caption: "Fair use",
    line: "10,000 conversations a month",
  },
] as const;

export default function Demo() {
  const [align, setAlign] = useState<Align>("center");
  const [tone, setTone] = useState<Tone>("accent");
  const [run, setRun] = useState(0);

  const active = TONES.find((item) => item.tone === tone) ?? TONES[0];

  return (
    <div className="hlb-demo">
      <style href="ui-demo-highlight-band" precedence="default">
        {css}
      </style>

      <div className="hlb-demo__bar">
        <span className="hlb-demo__hint">
          One line on a solid ground, square corners, 240ms on the entry curve
        </span>
        <div className="hlb-demo__actions">
          <div className="hlb-demo__group" role="group" aria-label="Alignment">
            <button
              type="button"
              className="hlb-demo__pill"
              aria-pressed={align === "center"}
              onClick={() => setAlign("center")}
            >
              Centred
            </button>
            <button
              type="button"
              className="hlb-demo__pill"
              aria-pressed={align === "left"}
              onClick={() => setAlign("left")}
            >
              Left
            </button>
          </div>
          <div className="hlb-demo__group" role="group" aria-label="Tone">
            {TONES.map((item) => (
              <button
                key={item.tone}
                type="button"
                className="hlb-demo__pill"
                aria-pressed={tone === item.tone}
                onClick={() => setTone(item.tone)}
              >
                {item.control}
              </button>
            ))}
          </div>
          <div className="hlb-demo__group">
            <button type="button" className="hlb-demo__pill" onClick={() => setRun((n) => n + 1)}>
              Replay
            </button>
          </div>
        </div>
      </div>

      {/* The key remounts the stage, so the entry replays on a toggle instead of on a reload */}
      <div className="hlb-demo__stage" key={`${run}-${align}-${tone}`}>
        <p className="hlb-demo__prose">
          Every workspace answers on WhatsApp, Instagram, Telegram and the web. The assistant, the
          shared inbox and the product catalogue ship in the same install, so the first month does
          not need a second tool bolted onto it.
        </p>

        <div className="hlb-demo__enter" style={{ "--hlb-demo-step": 0 } as CSSProperties}>
          <HighlightBand align={align} tone={tone} label={active.caption}>
            {active.line}
          </HighlightBand>
        </div>

        <p className="hlb-demo__prose">
          Above the line the page explains the work; below it sit the plans and the fine print. The
          band carries the one sentence that belongs to neither.
        </p>
      </div>
    </div>
  );
}

const css = /* css */ `
.hlb-demo {
  --hlb-demo-panel: var(--panel, #fffdfb);
  --hlb-demo-line: var(--border, #e8e0d7);
  --hlb-demo-chip: var(--card, #ffffff);

  display: grid;
  gap: 10px;
  width: 100%;
  color: var(--text, #1a1410);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.hlb-demo *,
.hlb-demo *::before,
.hlb-demo *::after {
  box-sizing: border-box;
}
.hlb-demo__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 2px;
}
.hlb-demo__hint {
  color: var(--text-muted, #6f625a);
  font-size: 11px;
  line-height: 1.4;
  letter-spacing: 0.01em;
}
.hlb-demo__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}
.hlb-demo__group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.hlb-demo__pill {
  flex: none;
  height: 26px;
  margin: 0;
  padding: 0 10px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--hlb-demo-line, #e8e0d7);
  color: var(--text-muted, #6f625a);
  font: inherit;
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition:
    background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.hlb-demo__pill:hover {
  background: var(--muted-bg, #7a4a1c0a);
  color: var(--text, #1a1410);
}
/* Selection in the chrome is ink, not ember: the band on the stage is the one live ember thing
 * on this screen, and two filled ember pills would compete with it. */
.hlb-demo__pill[aria-pressed="true"] {
  background: var(--hlb-demo-chip, #ffffff);
  box-shadow: inset 0 0 0 1px var(--text, #1a1410);
  color: var(--text, #1a1410);
}
.hlb-demo__pill:focus-visible {
  outline: 2px solid var(--accent, #c2410c);
  outline-offset: 2px;
}

.hlb-demo__stage {
  display: grid;
  gap: 22px;
  width: 100%;
  max-width: 620px;
  margin-inline: auto;
  padding: 26px 20px;
  border-radius: 16px;
  background: var(--hlb-demo-panel, #fffdfb);
  box-shadow: inset 0 0 0 1px var(--hlb-demo-line, #e8e0d7);
}
.hlb-demo__prose {
  margin: 0;
  color: var(--text-muted, #6f625a);
  font-size: 13px;
  line-height: 1.65;
  letter-spacing: 0;
  text-wrap: pretty;
  overflow-wrap: break-word;
}

/* The entrance lives here, not in the component: each row rises on the entry curve, one stagger
 * step behind the row above it, so a host can drop the band in without inheriting a timer. */
.hlb-demo__enter {
  animation: hlb-demo-rise var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both;
  animation-delay: calc(var(--hlb-demo-step, 0) * var(--nm-stagger, 45ms));
}
@keyframes hlb-demo-rise {
  from {
    opacity: 0;
    transform: translateY(0.45rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

:where(.dark, [data-theme="dark"]) .hlb-demo {
  --hlb-demo-panel: var(--panel, #1a1512);
  --hlb-demo-line: var(--border, #3a2f26);
  --hlb-demo-chip: var(--card, #201a15);
}

@media (prefers-reduced-motion: reduce) {
  .hlb-demo__enter {
    animation: none;
    transform: none;
  }
  .hlb-demo__pill {
    transition-duration: 1ms;
  }
}
`;
