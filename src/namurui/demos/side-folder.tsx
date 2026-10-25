import type { CSSProperties } from "react";
import { SideFolder } from "../side-folder";

export default function Demo() {
  return (
    <article style={{ display: "grid", gap: 12, width: "min(100%, 420px)" }}>
      <SideFolder />

      <div style={{ display: "grid", gap: 7 }}>
        <h3 style={title}>Files that stay in reach</h3>
        <p style={body}>
          Contracts, briefs and research sit in one folder — the pocket opens as soon as you reach for them.
        </p>
      </div>

      <p style={hint}>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M9 18.5V5.5M5 9l4-4 4 4M15 5.5v13M11 15l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Hover the folder — the pocket swings open and the documents slide out
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
