import { useState, type CSSProperties } from "react";
import { IntegrationGrid } from "../integration-grid";

export default function Demo() {
  const [columns, setColumns] = useState<5 | 7 | 9>(9);

  return (
    <section style={{ display: "grid", gap: 18, width: "min(100%, 820px)", justifyItems: "center" }}>
      <style>{demoCss}</style>

      <header style={{ display: "grid", gap: 7, justifyItems: "center", textAlign: "center" }}>
        <p style={eyebrow}>Integrations</p>
        <h2 style={title}>Plays well with your stack</h2>
        <p style={lede}>Connect the tools your team already relies on — no glue code, no CSV exports.</p>
      </header>

      <IntegrationGrid columns={columns} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }} role="group" aria-label="Grid density">
        {([9, 7, 5] as const).map((n) => (
          <button key={n} type="button" className="dm-btn" aria-pressed={columns === n} onClick={() => setColumns(n)}>
            {n} across
          </button>
        ))}
      </div>
    </section>
  );
}

const eyebrow: CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  opacity: 0.6,
};

const title: CSSProperties = {
  margin: 0,
  fontSize: "clamp(24px, 3.4vw, 34px)",
  fontWeight: 600,
  letterSpacing: "-0.03em",
  lineHeight: 1.15,
};

const lede: CSSProperties = {
  margin: 0,
  maxWidth: "54ch",
  fontSize: 15,
  lineHeight: 1.55,
  opacity: 0.64,
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
