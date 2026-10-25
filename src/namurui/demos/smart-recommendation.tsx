import { useState } from "react";
import { SmartRecommendation, type Recommendation } from "../smart-recommendation";

const options: Recommendation[] = [
  {
    id: "incremental",
    label: "Incremental sync",
    reason: (
      <>
        Only <strong style={{ fontWeight: 600 }}>4% of rows</strong> changed since the last run — 38s instead of
        6 minutes, and no table rebuilds.
      </>
    ),
    signal: 3,
  },
  {
    id: "full",
    label: "Full refresh",
    reason: "Rebuilds every table from scratch. Reliable, but the warehouse is read-only for ~6 minutes.",
    signal: 1,
  },
  {
    id: "manual",
    label: "Manual sync",
    reason: "Nothing runs on a schedule. Useful while you are still validating the schema by hand.",
    signal: 0,
  },
];

export default function Demo() {
  const [applied, setApplied] = useState<string | null>(null);

  return (
    <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: 520 }}>
      <SmartRecommendation
        title="Sync mode for the orders table"
        options={options}
        onAccept={(option) => setApplied(option.label)}
        onUndo={(option) => setApplied(`Reverted ${option.label.toLowerCase()}`)}
      />

      <p
        role="status"
        aria-live="polite"
        style={{ margin: 0, fontSize: 12.5, color: "var(--text-subtle, #8f8f8f)", minHeight: 18 }}
      >
        {applied ? `Saved: ${applied}` : "Fold the card, switch to an alternative, or accept the suggestion."}
      </p>
    </div>
  );
}
