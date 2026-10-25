import { useState } from "react";
import { ThinkingState, type ThinkingSource, type ThinkingStep } from "../thinking-state";

const steps: ThinkingStep[] = [
  { kind: "search", label: "Searching", doneLabel: "Searched" },
  { kind: "step", label: "Reading 7 sources about the trip" },
  { kind: "step", label: "Comparing flights and hotels" },
  { kind: "step", label: "Checking dates against the team calendar", doneLabel: "Checked dates against the team calendar" },
];

const sources: ThinkingSource[] = [
  {
    label: "Slack – #team-offsite",
    href: "https://slack.com",
    favicon: "slack",
  },
  {
    label: "X – @lisbonguide",
    href: "https://x.com",
    favicon: "x",
  },
  {
    label: "Notion – Offsite plan",
    href: "https://www.notion.so",
    favicon: "notion",
  },
  {
    label: "Wikipedia – Lisbon",
    href: "https://en.wikipedia.org/wiki/Lisbon",
    favicon: "wikipedia",
  },
  {
    label: "Google Docs – Day-by-day draft",
    href: "https://docs.google.com/document/d/offsite-draft",
    tip: "docs.google.com",
  },
  {
    label: "Reddit – r/lisbon, three days",
    href: "https://www.reddit.com/r/lisbon/comments/three-days",
    tip: "www.reddit.com",
  },
  {
    label: "TAP – LIS fare calendar",
    href: "https://www.flytap.com/en-us/lisbon",
    tip: "www.flytap.com",
  },
];

export default function Demo() {
  const [run, setRun] = useState(0);
  const [landed, setLanded] = useState<string>("");

  return (
    <div style={{ display: "grid", width: "100%", maxWidth: 460, gap: 12, justifyItems: "stretch" }}>
      <ThinkingState
        key={run}
        steps={steps}
        sources={sources}
        stepMs={1200}
        onDone={(seconds) => setLanded(`Landed after ${seconds}s · ${sources.length} sources`)}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "0 2px" }}>
        <p
          role="status"
          style={{
            margin: 0,
            font: "400 12px/18px Inter, system-ui, sans-serif",
            color: "inherit",
            opacity: 0.55,
            minHeight: 18,
          }}
        >
          {landed}
        </p>

        <button
          type="button"
          onClick={() => {
            setLanded("");
            setRun((count) => count + 1);
          }}
          style={{
            flex: "none",
            height: 30,
            padding: "0 12px",
            border: 0,
            borderRadius: 8,
            background: "transparent",
            boxShadow: "inset 0 0 0 1px currentColor",
            color: "inherit",
            font: "inherit",
            fontSize: 12,
            opacity: 0.6,
            cursor: "pointer",
          }}
        >
          Run it again
        </button>
      </div>
    </div>
  );
}
