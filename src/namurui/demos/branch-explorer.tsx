import { useState } from "react";
import { BranchExplorer, type Branch } from "../branch-explorer";

/* One failing checkout test, four attempts at it. The retry attempt is adopted on arrival even
 * though the await fix is cheaper; promoting it slides it onto the main track and the old line
 * steps back to an alternative. Two compare toggles put any pair side by side. */

const BRANCHES: Branch[] = [
  {
    id: "retry",
    approach: "Retry the checkout spec twice",
    outcome: "Green for 40 runs, but the race is hidden rather than fixed, and the suite takes 6s longer.",
    status: "complete",
    cost: 1.84,
  },
  {
    id: "await-write",
    approach: "Await the cart write before asserting",
    outcome: "One missing await in the fixture. 40 runs green and the suite finishes 3.1s sooner.",
    status: "complete",
    cost: 0.62,
  },
  {
    id: "seed",
    approach: "Seed a fresh cart per test",
    outcome: "Three of five spec files converted. No failures so far, two files still on the shared cart.",
    status: "running",
    cost: 0.41,
  },
  {
    id: "timeout",
    approach: "Raise the global test timeout",
    outcome: "Stopped once the flake reappeared in a different spec. Left the timeout at its old value.",
    status: "abandoned",
    cost: 0.27,
  },
];

export default function Demo() {
  const [last, setLast] = useState("Nothing promoted yet. The retry attempt is adopted on arrival.");

  return (
    <div style={{ display: "grid", gap: 16, width: "100%", maxWidth: 660 }}>
      <BranchExplorer
        title="Checkout spec"
        root="Make the flaky checkout test pass without weakening what it asserts."
        branches={BRANCHES}
        onPromote={(branch) => setLast(`Promoted ${branch.approach} to the adopted line.`)}
      />
      <p style={{ margin: 0, fontSize: 12, lineHeight: "18px", color: "var(--text-muted, #6f625a)" }}>
        {last}
      </p>
    </div>
  );
}
