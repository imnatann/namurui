import { useState } from "react";
import { SetupGuide, type SetupGroup } from "../setup-guide";

const GROUPS: SetupGroup[] = [
  {
    id: "workspace",
    title: "Set up your workspace",
    tasks: [
      { id: "name", label: "Choose a workspace name" },
      { id: "invite", label: "Invite your teammates to collaborate" },
      { id: "calendar", label: "Connect your calendar" },
    ],
  },
  {
    id: "billing",
    title: "Set up billing",
    tasks: [
      { id: "payment", label: "Add a payment method" },
      { id: "plan", label: "Choose a plan" },
    ],
  },
  {
    id: "verify",
    title: "Verify your account",
    tasks: [{ id: "email", label: "Confirm your email address", done: true }],
  },
];

const TOTAL = GROUPS.reduce((sum, group) => sum + group.tasks.length, 0);

export default function Demo() {
  const [done, setDone] = useState<string[]>(["email"]);
  const [closed, setClosed] = useState(false);
  const [note, setNote] = useState("Tick a task — the guide unlocks the next one");

  return (
    <div style={{ display: "grid", gap: 16, justifyItems: "center", width: "100%" }}>
      {closed ? (
        <button
          type="button"
          onClick={() => setClosed(false)}
          style={{
            appearance: "none",
            borderRadius: 8,
            padding: "7px 12px",
            border: "1px solid currentColor",
            background: "transparent",
            font: "500 13px/20px Inter, system-ui, sans-serif",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          Reopen setup guide
        </button>
      ) : (
        <SetupGuide
          groups={GROUPS}
          onEdit={() => setNote("Editing the guide — rename the steps or reorder them")}
          onClose={() => setClosed(true)}
          onToggle={(taskId, isDone, doneIds) => {
            setDone(doneIds);
            setNote(
              isDone
                ? `Finished “${labelFor(taskId)}” — the next step is unlocked`
                : `Reopened “${labelFor(taskId)}”`,
            );
          }}
        />
      )}
      <p style={{ margin: 0, font: "12px/18px Inter, system-ui, sans-serif", color: "inherit", opacity: 0.6 }}>
        {note} · {done.length} of {TOTAL} saved
      </p>
    </div>
  );
}

function labelFor(taskId: string): string {
  for (const group of GROUPS) {
    for (const task of group.tasks) {
      if (task.id === taskId) return task.label;
    }
  }
  return taskId;
}
