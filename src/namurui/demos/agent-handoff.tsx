import { useState } from "react";
import { AgentHandoff, type HandoffState } from "../agent-handoff";

const PAYLOAD = [
  { label: "Thread", value: "#launch-review" },
  { label: "Files", value: "6 diffs, 2 drafts" },
  { label: "Budget", value: "38k of 200k tokens" },
];

export default function Demo() {
  const [state, setState] = useState<HandoffState>("pending");

  return (
    <div style={{ display: "grid", gap: 14, width: "100%" }}>
      <AgentHandoff
        from={{ name: "Scout", role: "Research" }}
        to={{ name: "Atlas", role: "Release" }}
        reason="The launch thread is open on my side, but the deploy window belongs to you."
        payload={PAYLOAD}
        size="42 KB"
        stamp="2 min ago"
        state={state}
        onAccept={() => setState("accepted")}
        onDecline={() => setState("declined")}
        onReopen={() => setState("pending")}
      />

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          onClick={() => setState(state === "expired" ? "pending" : "expired")}
          style={{
            height: 28,
            padding: "0 10px",
            border: 0,
            borderRadius: 8,
            background: "transparent",
            boxShadow: "inset 0 0 0 1px var(--border, #e8e0d7)",
            color: "var(--text-muted, #6f625a)",
            font: "inherit",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          {state === "expired" ? "Back to pending" : "Preview a timed out decision"}
        </button>
        <span style={{ fontSize: 12, color: "var(--text-muted, #6f625a)" }}>
          {state === "pending" ? "Nobody has answered yet" : `Outcome: ${state}`}
        </span>
      </div>
    </div>
  );
}
