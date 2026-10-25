import { useState } from "react";
import { GoalTracker, type GoalStatus } from "../goal-tracker";

const BUDGET = 150_000;

/* The goal a long refactor run is holding itself to: it has been going for two hours and
 * change, and it is close enough to its ceiling that one more turn goes over. */
const OBJECTIVE =
  "Move the bridge to newline-JSON RPC and keep the TUI responsive under 500 ms per turn.";

const STATUSES: { value: GoalStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Reached" },
  { value: "dropped", label: "Dropped" },
];

const control = {
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
};

export default function Demo() {
  const [status, setStatus] = useState<GoalStatus>("active");
  const [objective, setObjective] = useState(OBJECTIVE);
  const [tokens, setTokens] = useState(142_600);
  const [note, setNote] = useState("The clock is counting; it holds when the tab is hidden.");

  return (
    <div
      style={{
        display: "grid",
        gap: 14,
        width: "100%",
        maxWidth: 480,
        margin: "0 auto",
        padding: "24px 0 32px",
      }}
    >
      <GoalTracker
        objective={objective}
        status={status}
        tokensUsed={tokens}
        tokenBudget={BUDGET}
        timeUsedSeconds={8_040}
        onPause={() => {
          setStatus("paused");
          setNote("Paused. The clock stopped where it was.");
        }}
        onResume={() => {
          setStatus("active");
          setNote("Running again from the seconds already banked.");
        }}
        onDrop={() => {
          setStatus("dropped");
          setNote("Dropped. The receipt keeps the objective, struck through.");
        }}
        onEditObjective={(next) => {
          setObjective(next);
          setNote("Objective committed and sent to the goal command.");
        }}
      />

      <p style={{ margin: 0, fontSize: 12, lineHeight: "18px", color: "var(--text-muted, #6f625a)" }}>
        {note}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }} role="group" aria-label="Goal status">
        {STATUSES.map((entry) => (
          <button
            key={entry.value}
            type="button"
            aria-pressed={status === entry.value}
            onClick={() => {
              setStatus(entry.value);
              setNote(`Showing the ${entry.label.toLowerCase()} layout.`);
            }}
            style={
              status === entry.value
                ? { ...control, boxShadow: "inset 0 0 0 1px var(--accent, #c2410c)", color: "var(--text, #1a1410)" }
                : control
            }
          >
            {entry.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            const next = tokens > BUDGET ? 142_600 : tokens + 8_000;
            setTokens(next);
            setNote(
              next > BUDGET
                ? "Another turn landed: the spend is now past the ceiling."
                : "Back under the ceiling; the overflow hatch is gone.",
            );
          }}
          style={control}
        >
          {tokens > BUDGET ? "Back under budget" : "Spend 8k tokens"}
        </button>
      </div>
    </div>
  );
}
