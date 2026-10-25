import { useState } from "react";
import { SubagentSpawn, type Subagent } from "../subagent-spawn";

const seeded: readonly Subagent[] = [
  { id: "child-1", label: "Read the incident timeline", status: "queued" },
  { id: "child-2", label: "Draft the migration note", status: "running", duration: 700 },
  { id: "child-3", label: "Re-check the retry budget", status: "running", duration: 1800 },
  { id: "child-4", label: "Trace the slow checkout query", status: "running", duration: 3600, outcome: "fail" },
  { id: "child-5", label: "Summarise the failing test", status: "queued" },
];

export default function Demo() {
  const [log, setLog] = useState<string[]>(["Trace the slow checkout query is set to fail"]);

  return (
    <div style={{ display: "grid", gap: 16, width: "100%", maxWidth: 580 }}>
      <SubagentSpawn
        title="Northwind orchestrator"
        tasks={seeded}
        batch={3}
        onEvent={(child, event) => setLog((rows) => [`${event} ${child.label}`, ...rows].slice(0, 4))}
      />

      <div style={{ display: "grid", gap: 6 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#8f8f8f",
          }}
        >
          Events
        </span>
        {log.map((row, index) => (
          <span key={`${row}-${index}`} style={{ fontSize: 12.5, color: "#6f625a" }}>
            {row}
          </span>
        ))}
      </div>
    </div>
  );
}