import { useState } from "react";
import { TextReveal } from "../text-reveal";

const headline = "Good design arrives one word at a time.";

export default function Demo() {
  const [run, setRun] = useState(0);
  const [by, setBy] = useState<"word" | "char">("word");

  return (
    <section style={{ display: "grid", gap: 26, width: "min(100%, 820px)", justifyItems: "center" }}>
      <style>{demoCss}</style>

      <div key={run} className="dm-reveal" style={{ display: "grid", gap: 14, justifyItems: "center", textAlign: "center" }}>
        <div style={{ fontSize: "clamp(30px, 5.4vw, 54px)", fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1.06 }}>
          <TextReveal as="h1" text={headline} by={by} stagger={by === "char" ? 18 : 60} duration={760} />
        </div>
        <div style={{ maxWidth: "44ch", fontSize: 15, lineHeight: 1.6, opacity: 0.68 }}>
          <TextReveal text="Each piece rises out of a soft blur, one after another, the moment the headline comes into view." delay={380} stagger={22} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }} role="group" aria-label="Reveal controls">
        <button type="button" className="dm-btn" onClick={() => setRun((r) => r + 1)}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M4 12a8 8 0 1 1 2.6 5.9" strokeLinecap="round" />
            <path d="M4 17v-5h5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Replay
        </button>
        <button
          type="button"
          className="dm-btn"
          aria-pressed={by === "char"}
          onClick={() => {
            setBy((b) => (b === "word" ? "char" : "word"));
            setRun((r) => r + 1);
          }}
        >
          Letter by letter
        </button>
      </div>
    </section>
  );
}

const demoCss = /* css */ `
.dm-reveal h1,
.dm-reveal p {
  margin: 0;
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
  letter-spacing: inherit;
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
.dm-btn:focus-visible { outline: 2px solid #6b8cff; outline-offset: 2px; }
`;
