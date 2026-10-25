import { useState } from "react";
import { GradientText, type GradientPalette } from "../gradient-text";

const PALETTES: { id: string; label: string; colors?: GradientPalette }[] = [
  // No colours: the sheet's own brand pair runs, including its dark-mode version
  { id: "brand", label: "Brand" },
  { id: "ember", label: "Ember", colors: ["#f97316", "#e11d48", "#fbbf24", "#fb7185"] },
  { id: "sea", label: "Sea", colors: ["#0891b2", "#4338ca", "#22d3ee", "#818cf8"] },
];

export default function Demo() {
  const [palette, setPalette] = useState("brand");
  const [speed, setSpeed] = useState(8);
  const [run, setRun] = useState(0);

  const active = PALETTES.find((entry) => entry.id === palette) ?? PALETTES[0];

  return (
    <section className="dm-gt">
      <style>{css}</style>

      <div className="dm-gt__stage">
        <p className="dm-gt__eyebrow">Brand voice</p>
        <h1 className="dm-gt__headline">
          Make it{" "}
          <GradientText key={run} colors={active.colors} speed={speed}>
            feel.
          </GradientText>
        </h1>
        <p className="dm-gt__lede">
          A gradient that never settles, clipped to the letters. It sweeps across the word the first
          time it is read — and the text underneath stays real, so it can still be selected and read
          aloud.
        </p>
      </div>

      <div className="dm-gt__controls">
        <div className="dm-gt__group" role="group" aria-label="Gradient palette">
          {PALETTES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="dm-gt__chip"
              aria-pressed={entry.id === active.id}
              onClick={() => setPalette(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <label className="dm-gt__speed">
          <span>Flow {speed}s</span>
          <input
            type="range"
            min={3}
            max={16}
            step={1}
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          />
        </label>

        <button type="button" className="dm-gt__replay" onClick={() => setRun((value) => value + 1)}>
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M4 12a8 8 0 1 1 2.6 5.9" strokeLinecap="round" />
            <path d="M4 17v-5h5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Replay sweep
        </button>
      </div>
    </section>
  );
}

const css = /* css */ `
.dm-gt {
  display: grid;
  gap: 26px;
  width: 100%;
  max-width: 620px;
  color: var(--text, #171717);
  font-family: var(--font-sans, "Inter", ui-sans-serif, system-ui, sans-serif);
  -webkit-font-smoothing: antialiased;
}
.dm-gt__stage { display: grid; gap: 12px; }
.dm-gt__eyebrow {
  margin: 0;
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted, #737373);
}
.dm-gt__headline {
  margin: 0;
  font-size: clamp(34px, 6vw, 56px);
  font-weight: 600;
  line-height: 1.08;
  letter-spacing: -0.035em;
}
.dm-gt__lede {
  margin: 0;
  max-width: 46ch;
  font-size: 14.5px;
  line-height: 1.6;
  color: var(--text-muted, #737373);
}
.dm-gt__controls {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.dm-gt__group { display: flex; gap: 6px; }
.dm-gt__chip,
.dm-gt__replay {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 13px;
  border-radius: var(--radius-pill, 999px);
  border: 1px solid var(--border, #e5e5e5);
  background: transparent;
  color: var(--text-muted, #737373);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: -0.005em;
  cursor: pointer;
  transition: color 140ms ease, background-color 140ms ease, border-color 140ms ease;
}
.dm-gt__chip:hover,
.dm-gt__replay:hover { background: var(--muted-bg, #0000000a); color: var(--text, #171717); }
.dm-gt__chip[aria-pressed="true"] {
  background: var(--text, #171717);
  border-color: var(--text, #171717);
  color: var(--card, #ffffff);
}
.dm-gt__chip:focus-visible,
.dm-gt__replay:focus-visible { outline: 2px solid var(--accent, #1d93d2); outline-offset: 2px; }
.dm-gt__speed {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-muted, #737373);
}
.dm-gt__speed span { min-width: 62px; font-variant-numeric: tabular-nums; }
.dm-gt__speed input { width: 132px; accent-color: var(--text, #171717); }
`;
