import { useState, type CSSProperties } from "react";
import { AgentReplay, type ReplayStep } from "../agent-replay";

/* The chain above is the component's own default: a billing agent working one failed renewal. The
   demo owns the step and the trail, so the readout underneath is the two handlers firing live. */

/** The default chain holds six steps, so the last one sits here. */
const LAST = 5;

/* The failure path: a publish that 503s, and the retry its idempotency key makes safe. */
const retried: ReplayStep[] = [
  {
    id: "push",
    label: "Push the price change to production",
    input: { label: "Plan", body: "Three price rows, reviewed and ready to publish.", meta: "plan_2291" },
    output: {
      label: "Deploy failed",
      body: "api.publish returned 503 after 30 seconds. Nothing was written, so the old prices are still live.",
      tone: "bad",
      meta: "deploy.publish, 30s timeout",
    },
    decision: {
      choice: "Stop and check the service before retrying",
      rationale:
        "A 503 that writes nothing is safe to replay, but three blind retries would leave six copies of the plan queued.",
    },
    branches: [
      { id: "retry", label: "Retry straight away", note: "The queue would take three copies", taken: false },
      { id: "check", label: "Check the service first", note: "Tells a transient 503 from a real outage", taken: true },
    ],
    tool: "deploy.publish",
  },
  {
    id: "again",
    label: "Retry with the idempotency key",
    input: { label: "Key", body: "idem_4412, taken from the failed attempt unchanged." },
    output: { label: "Published", body: "Three price rows written and live at 09:14.", meta: "deploy.publish" },
    decision: {
      choice: "Report the publish and close the plan",
      rationale:
        "The service is back and the key makes a duplicate impossible, so the rows match the reviewed plan row for row.",
    },
    tool: "deploy.publish",
  },
];

export default function Demo() {
  const [index, setIndex] = useState(0);
  const [visited, setVisited] = useState<readonly number[]>([0]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <AgentReplay
        title="Refund the failed renewal"
        agent="sana.billing"
        index={index}
        onIndexChange={setIndex}
        visited={visited}
        onVisitedChange={setVisited}
      />

      <div style={{ display: "grid", gap: 8 }}>
        <p style={note}>
          The caller owns the step and the trail here. Stepping and the rail both drive those
          handlers, and this line is what they wrote: {visited.length} of 6 steps seen, reading step{" "}
          {index + 1}. Forgetting the trail keeps only the step on screen, because the step you are
          looking at has been seen.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" style={chip} onClick={() => setIndex(0)}>
            Back to the first step
          </button>
          <button
            type="button"
            style={chip}
            onClick={() => {
              setIndex(LAST);
              setVisited((seen) => (seen.includes(LAST) ? seen : [...seen, LAST]));
            }}
          >
            Jump to the last step
          </button>
          <button type="button" style={chip} onClick={() => setVisited([])}>
            Forget the trail
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <p style={note}>
          Uncontrolled this time, on a chain where a step failed: the rail rings that step, the
          summary counts it, and the output says what the failure left behind.
        </p>
        <AgentReplay title="Publish the new price rows" agent="sana.pricing" steps={retried} />
      </div>
    </div>
  );
}

const note: CSSProperties = {
  margin: 0,
  maxWidth: "64ch",
  fontSize: 12,
  lineHeight: 1.55,
  color: "var(--text-muted, #a2958a)",
};

const chip: CSSProperties = {
  height: 28,
  padding: "0 11px",
  border: 0,
  borderRadius: "var(--radius-pill, 999px)",
  background: "var(--preview, #26201a)",
  boxShadow: "inset 0 0 0 1px var(--border-soft, #ffffff12)",
  color: "var(--text, #f4ece4)",
  font: "inherit",
  fontSize: 12,
  cursor: "pointer",
};