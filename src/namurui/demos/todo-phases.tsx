import { useState } from "react";
import { TodoPhases, type TodoItem, type TodoPhase } from "../todo-phases";

/* One pass at a real change: read the bridge, change the frame parser, verify. The parser phase
 * is under the agent's hands; the flag beside it waits on that test landing. */
const PLAN: TodoPhase[] = [
  {
    name: "Read the repo",
    items: [
      { text: "List the bridge routes", status: "done" },
      { text: "Trace the newline-JSON framing", status: "done" },
      { text: "Find where set_todos replaces the list", status: "done" },
    ],
  },
  {
    name: "Change the parser",
    items: [
      { text: "Split each frame on the first newline", status: "done" },
      {
        text: "Reject a frame with a partial trailing line",
        status: "active",
        detail: "src/bridge/frame.ts · 42–88, one new case in frame.test.ts",
      },
      { text: "Keep the old reader behind a flag", status: "blocked" },
    ],
  },
  {
    name: "Verify",
    items: [
      { text: "Replay the captured session", status: "pending" },
      { text: "Run the bridge integration suite", status: "pending" },
    ],
  },
];

const MAX_ATTEMPTS = 3;

const clone = (phases: readonly TodoPhase[]): TodoPhase[] =>
  phases.map((phase) => ({ name: phase.name, items: phase.items.map((item) => ({ ...item })) }));

const control = {
  height: 30,
  padding: "0 12px",
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
  const [phases, setPhases] = useState<TodoPhase[]>(() => clone(PLAN));
  const [attempt, setAttempt] = useState(1);

  /* The live step lands and the pointer moves to the next pending row; a blocked row is
   * stepped over, not run. A finished pass starts the next attempt from the plan. */
  const advance = () => {
    const next = clone(phases);
    const flat = next.flatMap((phase) => phase.items);
    const active = flat.find((item) => item.status === "active");

    if (active) active.status = "done";
    const waiting = flat.find((item) => item.status === "pending");

    if (waiting) {
      waiting.status = "active";
      setPhases(next);
      return;
    }
    if (active) {
      setPhases(clone(PLAN));
      setAttempt((current) => (current === MAX_ATTEMPTS ? 1 : current + 1));
    }
  };

  /* Clicking a row resolves it: a pending or live row is marked done, a done or blocked row
   * goes back to pending. */
  const toggle = (phaseName: string, item: TodoItem) => {
    setPhases((current) =>
      current.map((phase) =>
        phase.name !== phaseName
          ? phase
          : {
              ...phase,
              items: phase.items.map((row) =>
                row.text !== item.text
                  ? row
                  : {
                      ...row,
                      status:
                        row.status === "pending" || row.status === "active" ? "done" : "pending",
                    },
              ),
            },
      ),
    );
  };

  return (
    <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: 460, margin: "0 auto", padding: "24px 0 32px" }}>
      <TodoPhases phases={phases} attempt={attempt} maxAttempts={MAX_ATTEMPTS} onToggle={toggle} />

      <p style={{ margin: 0, fontSize: 12, lineHeight: "18px", color: "var(--text-muted, #6f625a)" }}>
        Attempt {attempt} of {MAX_ATTEMPTS}. Fold a phase from its header; the one holding the live
        step refuses and stays open. Click a row to resolve it.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" onClick={advance} style={control}>
          Advance the live step
        </button>
        <button
          type="button"
          onClick={() => {
            setPhases(clone(PLAN));
            setAttempt(1);
          }}
          style={control}
        >
          Reset the plan
        </button>
      </div>
    </div>
  );
}
