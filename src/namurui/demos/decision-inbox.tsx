import { useState } from "react";
import { DecisionInbox, type InboxDecision } from "../decision-inbox";

const queue: InboxDecision[] = [
  {
    id: "renewal",
    title: "Renew Figma for the design team?",
    detail: "12 seats · $1,800 per year · renews in 5 days",
    primary: "Renew",
    secondary: "Change seats",
  },
  {
    id: "contract",
    title: "Send the revised contract to Northwind?",
    detail: "Legal approved the redlines this morning",
    primary: "Send it",
    secondary: "Review first",
  },
  {
    id: "domain",
    title: "Keep namurui.dev registered for another year?",
    detail: "$19 per year · 3 services point at it",
    primary: "Keep it",
    secondary: "Let it lapse",
    collapsed: true,
  },
  {
    id: "seat",
    title: "Approve the analytics upgrade for the growth team?",
    detail: "6 seats · $420 per month · starts November 1",
    primary: "Approve",
    secondary: "Not now",
    collapsed: true,
  },
];

export default function Demo() {
  const [log, setLog] = useState<string[]>([]);

  return (
    <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: 520 }}>
      <DecisionInbox
        decisions={queue}
        onDecide={(decision, answer) =>
          setLog((rows) => [
            `${decision.title.replace(/\?$/, "")} → ${answer === "primary" ? decision.primary : decision.secondary}`,
            ...rows,
          ].slice(0, 3))
        }
      />

      <div aria-live="polite" style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#a3a3a3" }}>
          Your answers
        </span>
        {log.length === 0 ? (
          <span style={{ fontSize: 12.5, color: "#8f8f8f" }}>Nothing answered yet — pick a button above.</span>
        ) : (
          log.map((row) => (
            <span key={row} style={{ fontSize: 12.5, color: "#525252" }}>
              {row}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
