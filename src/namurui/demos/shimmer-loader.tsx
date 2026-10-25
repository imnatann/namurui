import { useState, type CSSProperties } from "react";
import { ShimmerText, Skeleton } from "../shimmer-loader";

const steps = ["Thinking…", "Reading 14 sources…", "Writing the summary…"];

export default function Demo() {
  const [run, setRun] = useState(0);
  const [step, setStep] = useState(0);

  return (
    <section style={{ display: "grid", gap: 18, width: "min(100%, 720px)" }}>
      <style>{demoCss}</style>

      <div key={run} aria-busy="true" style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Skeleton circle width={46} />
          <div style={{ display: "grid", gap: 8, flex: 1, minWidth: 0 }}>
            <Skeleton width="44%" height={12} />
            <Skeleton width="26%" height={9} />
          </div>
          <Skeleton width={72} height={28} radius={999} />
        </div>

        <div style={{ display: "grid", gap: 9 }}>
          <Skeleton width="96%" height={10} />
          <Skeleton width="91%" height={10} />
          <Skeleton width="72%" height={10} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <Skeleton height={58} radius={10} />
          <Skeleton height={58} radius={10} />
          <Skeleton height={58} radius={10} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Skeleton width={112} height={30} radius={9} />
          <Skeleton width={88} height={30} radius={9} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span role="status" aria-live="polite" style={{ fontSize: 15, fontWeight: 500, letterSpacing: "-0.015em" }}>
          <ShimmerText duration={2.4}>{steps[step]}</ShimmerText>
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" className="dm-btn" onClick={() => setRun((r) => r + 1)}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M4 12a8 8 0 1 1 2.6 5.9" strokeLinecap="round" />
            <path d="M4 17v-5h5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Replay sweep
        </button>
        <button type="button" className="dm-btn" onClick={() => setStep((s) => (s + 1) % steps.length)}>
          Next step
        </button>
      </div>

      <p style={note}>Every block shares one sweep pinned to the viewport, so the highlight crosses the card as a single band.</p>
    </section>
  );
}

const card: CSSProperties = {
  display: "grid",
  gap: 18,
  padding: 22,
  borderRadius: 16,
  background: "color-mix(in srgb, currentColor 3.5%, transparent)",
  boxShadow: "inset 0 0 0 1px color-mix(in srgb, currentColor 10%, transparent)",
};

const note: CSSProperties = {
  margin: 0,
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
.dm-btn:focus-visible { outline: 2px solid #6b8cff; outline-offset: 2px; }
`;
