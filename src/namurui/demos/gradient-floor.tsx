import { useState, type CSSProperties } from "react";
import { GradientFloor } from "../gradient-floor";

type Palette = {
  id: string;
  label: string;
  colors: [string, string, string];
};

/* Sunset is what the reference ships; the others keep the same ridge-to-floor shape */
const PALETTES: Palette[] = [
  { id: "sunset", label: "Sunset", colors: ["#FF7700", "#FF0055", "#0073FF"] },
  { id: "aurora", label: "Aurora", colors: ["#FFD166", "#27D6A5", "#2563EB"] },
  { id: "orchid", label: "Orchid", colors: ["#FF9BE0", "#A855F7", "#4338CA"] },
];

export default function Demo() {
  const [paletteId, setPaletteId] = useState(PALETTES[0].id);
  const [speed, setSpeed] = useState(2.5);
  const [still, setStill] = useState(false);

  const palette = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0];

  return (
    <section style={sheet}>
      <style>{demoCss}</style>

      {/* The glow anchors to the bottom edge, so the panel supplies the height */}
      <GradientFloor className="gradient-floor-demo__panel" colors={palette.colors} speed={still ? 0 : speed} />

      <div style={controls}>
        <div style={group} role="group" aria-label="Gradient palette">
          {PALETTES.map((option) => (
            <button
              key={option.id}
              type="button"
              className="dm-btn"
              aria-pressed={option.id === paletteId}
              onClick={() => setPaletteId(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label style={sliderLabel}>
          <span style={sliderName}>{still ? "Still" : `Loop ${speed.toFixed(1)}s`}</span>
          <input
            className="dm-range"
            type="range"
            min={1}
            max={6}
            step={0.5}
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          />
        </label>

        <button type="button" className="dm-btn" aria-pressed={still} onClick={() => setStill((value) => !value)}>
          {still ? "Still" : "Drifting"}
        </button>
      </div>

      <p style={note}>
        The colour crest travels the wide arc while the white highlight takes the tighter one, so the peaks cross
        instead of moving as one.
      </p>
    </section>
  );
}

const sheet: CSSProperties = { display: "grid", gap: 14, width: "100%" };

const controls: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 12,
};

const group: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8 };

const sliderLabel: CSSProperties = {
  display: "flex",
  flex: "1 1 200px",
  alignItems: "center",
  gap: 10,
  minWidth: 180,
  fontSize: 13,
};

const sliderName: CSSProperties = { flex: "none", minWidth: 68, opacity: 0.62 };

const note: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  opacity: 0.58,
};

const demoCss = /* css */ `
/* The reference page's own panel chrome: a 360px stage, rounded, hairline ring */
.gradient-floor-demo__panel {
  height: 360px;
  border-radius: 20px;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 11%, transparent), 0 1px 2px rgb(0 0 0 / 0.04);
}

.dm-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 13px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  background: color-mix(in srgb, currentColor 4%, transparent);
  color: inherit;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: background-color 140ms ease, transform 140ms cubic-bezier(0.22, 1, 0.36, 1);
}
.dm-btn:hover { background: color-mix(in srgb, currentColor 9%, transparent); }
.dm-btn:active { transform: scale(0.97); }
.dm-btn[aria-pressed="true"] {
  background: color-mix(in srgb, currentColor 12%, transparent);
  border-color: color-mix(in srgb, currentColor 32%, transparent);
}
.dm-btn:focus-visible { outline: 2px solid color-mix(in srgb, currentColor 45%, transparent); outline-offset: 2px; }

.dm-range {
  flex: 1;
  min-width: 0;
  margin: 0;
  accent-color: currentColor;
  cursor: pointer;
}
`;
