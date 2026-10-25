import { useState, type CSSProperties } from "react";
import { GridBackground, type GridDirection } from "../grid-background";

const directions: { value: GridDirection; label: string }[] = [
  { value: "diagonal", label: "Diagonal" },
  { value: "up", label: "Up" },
  { value: "right", label: "Right" },
];

export default function Demo() {
  const [run, setRun] = useState(0);
  const [direction, setDirection] = useState<GridDirection>("diagonal");

  return (
    <section style={{ display: "grid", gap: 14, width: "100%" }}>
      <style>{demoCss}</style>

      <div style={{ borderRadius: 20, overflow: "hidden", boxShadow: "inset 0 0 0 1px color-mix(in srgb, currentColor 12%, transparent)" }}>
        <GridBackground key={`${run}-${direction}`} size={44} speed={3.2} direction={direction} fade={68}>
          <div style={{ display: "grid", placeItems: "center", minHeight: 460, padding: "60px 24px", textAlign: "center" }}>
            <div style={{ display: "grid", gap: 14, justifyItems: "center", maxWidth: 470 }}>
              <span style={eyebrow}>Infrastructure</span>
              <h1 style={title}>Build on a steady grid</h1>
              <p style={lede}>
                Every deploy is measured, traced and rolled back in one place — so the surface stays calm while the work
                moves.
              </p>
              <div style={{ display: "flex", gap: 26, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
                <Stat value="99.98%" label="Uptime" />
                <Stat value="42 ms" label="p50 latency" />
                <Stat value="18" label="Regions" />
              </div>
            </div>
          </div>
        </GridBackground>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }} role="group" aria-label="Grid controls">
        <button type="button" className="dm-btn" onClick={() => setRun((r) => r + 1)}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M4 12a8 8 0 1 1 2.6 5.9" strokeLinecap="round" />
            <path d="M4 17v-5h5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Replay reveal
        </button>
        {directions.map((d) => (
          <button
            key={d.value}
            type="button"
            className="dm-btn"
            aria-pressed={direction === d.value}
            onClick={() => setDirection(d.value)}
          >
            {d.label}
          </button>
        ))}
      </div>

      <p style={note}>The lines drift one cell per loop and dissolve toward the edges; the reveal grows from the centre.</p>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.03em" }}>{value}</span>
      <span style={{ fontSize: 12, opacity: 0.62 }}>{label}</span>
    </div>
  );
}

const eyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  opacity: 0.6,
};

const title: CSSProperties = {
  margin: 0,
  fontSize: "clamp(30px, 5vw, 50px)",
  fontWeight: 600,
  letterSpacing: "-0.035em",
  lineHeight: 1.06,
};

const lede: CSSProperties = {
  margin: 0,
  maxWidth: "46ch",
  fontSize: 15,
  lineHeight: 1.6,
  opacity: 0.62,
};

const note: CSSProperties = {
  margin: 0,
  textAlign: "center",
  fontSize: 12,
  lineHeight: 1.5,
  opacity: 0.58,
};

const demoCss = /* css */ `
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
.dm-btn:focus-visible { outline: 2px solid #6b8cff; outline-offset: 2px; }
`;
