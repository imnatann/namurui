import type { CSSProperties } from "react";
import { LeadSourcing } from "../lead-sourcing";

const sources = [
  { name: "Gmail replies", detail: "312 threads this week", color: "#EA4335" },
  { name: "ChatGPT research", detail: "48 summaries", color: "#10A37F" },
  { name: "Grok signals", detail: "17 buying-intent posts", color: "#171717" },
];

export default function Demo() {
  return (
    <article style={{ display: "grid", gap: 16, width: "min(100%, 380px)" }}>
      <LeadSourcing />

      <div style={{ display: "grid", gap: 6 }}>
        <h3 style={title}>Every lead, one timeline</h3>
        <p style={body}>
          Replies, research notes and social signals are matched to the same person the moment they arrive.
        </p>
      </div>

      <ul style={{ display: "grid", gap: 9, margin: 0, padding: 0, listStyle: "none" }}>
        {sources.map((source) => (
          <li key={source.name} style={row}>
            <span style={{ ...dot, background: source.color }} aria-hidden="true" />
            <span style={{ fontWeight: 500 }}>{source.name}</span>
            <span style={{ marginLeft: "auto", opacity: 0.62 }}>{source.detail}</span>
          </li>
        ))}
      </ul>
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

const row: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  fontSize: 13,
  letterSpacing: "-0.01em",
  padding: "9px 12px",
  borderRadius: 10,
  background: "color-mix(in srgb, currentColor 4%, transparent)",
  boxShadow: "inset 0 0 0 1px color-mix(in srgb, currentColor 8%, transparent)",
};

const dot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  flex: "none",
  boxShadow: "0 0 0 3px color-mix(in srgb, currentColor 6%, transparent)",
};
