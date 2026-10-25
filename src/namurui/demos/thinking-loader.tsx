import { useState } from "react";
import { ThinkingLoader } from "../thinking-loader";

export default function Demo() {
  const [done, setDone] = useState(false);
  const [runs, setRuns] = useState(0);

  return (
    <div style={{ display: "grid", gap: 20, width: "100%", maxWidth: 480 }}>
      <div
        style={{
          display: "grid",
          gap: 12,
          padding: 16,
          borderRadius: 14,
          background: "var(--card, #ffffff)",
          boxShadow: "inset 0 0 0 1px var(--border, #ececec)",
        }}
      >
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--text-subtle, #8f8f8f)" }}>Assistant</p>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <ThinkingLoader
            key={runs}
            phases={["Thinking", "Searching the web", "Reading 4 sources", "Writing response"]}
            interval={1500}
            done={done}
            doneLabel={(seconds) => `Thought for ${seconds}s · 4 sources`}
          />
        </div>

        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--text-muted, #737373)" }}>
          {done
            ? "Answer ready — the loader settled on a check and the time it took."
            : "The label rolls through what the model is doing; the pill glides to fit each phase."}
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          onClick={() => {
            if (done) {
              setDone(false);
              setRuns((n) => n + 1);
            } else {
              setDone(true);
            }
          }}
          style={{
            appearance: "none",
            border: 0,
            cursor: "pointer",
            padding: "9px 14px",
            borderRadius: 9,
            fontSize: 13,
            fontWeight: 600,
            color: done ? "var(--text, #404040)" : "var(--primary-fg, #ffffff)",
            background: done ? "var(--muted-bg, #f0f0f0)" : "var(--primary, #171717)",
            fontFamily: "inherit",
          }}
        >
          {done ? "Run it again" : "Finish thinking"}
        </button>

        <span role="status" aria-live="polite" style={{ fontSize: 12.5, color: "var(--text-subtle, #8f8f8f)" }}>
          {done ? "Done" : "Working"}
        </span>
      </div>
    </div>
  );
}
