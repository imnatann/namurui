import { useState } from "react";
import { EvalsScreen } from "../evals";

/*
 * The evals dashboard with the wiring a real page has: pick a version, re-run the suite or one
 * case, and accept or reject the prompt changes. The caption under the frame reports the last
 * thing the screen asked for.
 */

export default function Demo() {
  const [version, setVersion] = useState("v12");
  const [reviewed, setReviewed] = useState({ accepted: 0, rejected: 0 });
  const [note, setNote] = useState("v12 is current – 92% of 25 cases pass");

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          width: "100%",
          maxWidth: 1100,
          height: 780,
          margin: "0 auto",
          overflow: "hidden",
          border: "1px solid var(--border, #e5e5e5)",
          borderRadius: 16,
          background: "var(--card, #fff)",
        }}
      >
        <EvalsScreen
          version={version}
          onVersionChange={(next) => {
            setVersion(next);
            setNote(`Showing ${next} – the chart and the table stay on the last scored run`);
          }}
          onRun={(ids) => {
            setReviewed({ accepted: 0, rejected: 0 });
            setNote(`Re-running all ${ids.length} test cases against ${version}`);
          }}
          onCaseRun={(id) => setNote(`Re-running ${id} on its own`)}
          onSuggestionDecision={(_index, decision) => {
            const next = {
              accepted: reviewed.accepted + (decision === "accepted" ? 1 : 0),
              rejected: reviewed.rejected + (decision === "rejected" ? 1 : 0),
            };
            setReviewed(next);
            setNote(`Prompt review – ${next.accepted} accepted, ${next.rejected} rejected`);
          }}
          onNavigate={(label) => setNote(`Sidebar → ${label}`)}
        />
      </div>
      <p
        style={{
          maxWidth: 1100,
          margin: "12px auto 0",
          fontSize: 12,
          color: "var(--text-muted, #737373)",
        }}
      >
        {note}
      </p>
    </div>
  );
}
