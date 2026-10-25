import type { CSSProperties } from "react";
import { TabOverload } from "../tab-overload";

export default function Demo() {
  return (
    <article style={{ display: "grid", gap: 12, width: "min(100%, 440px)" }}>
      <TabOverload />

      <div style={{ display: "grid", gap: 7 }}>
        <h3 style={title}>Eleven tabs, one task</h3>
        <p style={body}>
          Research, pricing and three half-written briefs — the work is spread across windows nobody can find again.
        </p>
      </div>

      <p style={hint}>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M6 3.5h9.5L20 8v12.5H6z" strokeLinejoin="round" />
          <path d="M9.5 10h7M9.5 13.5h7M9.5 17h4" strokeLinecap="round" />
        </svg>
        Hover a window behind the front one to bring it forward
      </p>
    </article>
  );
}

const title: CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 600,
  letterSpacing: "-0.025em",
  lineHeight: 1.25,
};

const body: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.55,
  opacity: 0.62,
};

const hint: CSSProperties = {
  display: "inline-flex",
  alignItems: "flex-start",
  gap: 7,
  margin: 0,
  fontSize: 12,
  lineHeight: 1.45,
  opacity: 0.6,
};
