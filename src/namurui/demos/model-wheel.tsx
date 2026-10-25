import type { CSSProperties } from "react";
import { ModelWheel } from "../model-wheel";

export default function Demo() {
  return (
    <article style={{ display: "grid", gap: 14, width: "min(100%, 380px)" }}>
      <div style={{ display: "grid", gap: 5, textAlign: "center" }}>
        <p style={eyebrow}>Model routing</p>
        <h3 style={title}>Every model, one workspace</h3>
      </div>

      <ModelWheel hold={1800} />

      <p style={hint}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M12 4v16M7.5 8.5 12 4l4.5 4.5M7.5 15.5 12 20l4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Drag the drum to spin it — it snaps to the closest model
      </p>
    </article>
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
  fontSize: 20,
  fontWeight: 600,
  letterSpacing: "-0.025em",
  lineHeight: 1.25,
};

const hint: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  margin: 0,
  fontSize: 12,
  lineHeight: 1.4,
  opacity: 0.6,
};
