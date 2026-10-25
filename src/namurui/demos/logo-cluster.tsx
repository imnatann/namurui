import type { CSSProperties } from "react";
import { LogoCluster } from "../logo-cluster";

export default function Demo() {
  return (
    <article style={{ display: "grid", gap: 4, width: "min(100%, 400px)", justifyItems: "center" }}>
      <LogoCluster />

      <div style={{ display: "grid", gap: 7, justifyItems: "center", textAlign: "center", marginTop: -8 }}>
        <h3 style={title}>Connects with everything</h3>
        <p style={body}>Your calendar, docs and issue tracker are already in the room.</p>
        <p style={hint}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M8 4.5v11M5 8l3-3.5L11 8M16 19.5v-11M13 16l3 3.5L19 16" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Hover a logo to lift it
        </p>
      </div>
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
  maxWidth: "34ch",
  fontSize: 14,
  lineHeight: 1.55,
  opacity: 0.62,
};

const hint: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  margin: 0,
  fontSize: 12,
  letterSpacing: "-0.005em",
  opacity: 0.6,
};
