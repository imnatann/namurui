import { useState } from "react";
import { ProgressTracker, type ProgressStep } from "../progress-tracker";

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const steps: ProgressStep[] = [
  {
    id: "workspace",
    label: "Create your workspace",
    done: true,
    icon: icon("M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"),
  },
  {
    id: "source",
    label: "Connect your first data source",
    done: true,
    icon: icon("M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"),
  },
  {
    id: "invite",
    label: "Invite two teammates",
    icon: icon("M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-3.3 3.1-6 7-6 1.4 0 2.7.3 3.8.9M18 14v6M15 17h6"),
  },
  {
    id: "alerts",
    label: "Set up a weekly digest",
    icon: icon("M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6M10 20a2.2 2.2 0 0 0 4 0"),
  },
  {
    id: "publish",
    label: "Publish your first report",
    icon: icon("M12 20V5M6 11l6-6 6 6"),
  },
];

export default function Demo() {
  const [saved, setSaved] = useState("Ticks are saved to your profile as you go.");

  return (
    <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: 380 }}>
      <ProgressTracker
        title="Getting started with Northwind"
        steps={steps}
        onChange={(next) => {
          const done = next.filter((step) => step.done).length;
          setSaved(done === next.length ? `All ${next.length} steps done — nice.` : `Saved · ${done} of ${next.length} done`);
        }}
      />

      <p role="status" style={{ margin: 0, fontSize: 12.5, color: "#8f8f8f" }}>
        {saved}
      </p>
    </div>
  );
}
