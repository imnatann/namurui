import { useState } from "react";
import { NotificationStack, type Notice } from "../notification-stack";

export default function Demo() {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [note, setNote] = useState("Three notices — close the front one to see the next.");
  const [round, setRound] = useState(0);

  const notices: Notice[] = [
    {
      id: "maintenance",
      badge: "Notice",
      title: "Scheduled maintenance",
      text: "We'll be offline on Sunday from 02:00 to 03:00 UTC while the pipeline database is upgraded.",
      action: { label: "View status", onClick: () => setNote("Opened the status page") },
      pattern: "grid",
    },
    {
      id: "export",
      badge: "Ready",
      title: "Your export is ready",
      text: "Q4 pipeline, 128 deals with owners and next steps, is waiting as a CSV.",
      action: { label: "Download CSV", onClick: () => setNote("Downloaded Q4-pipeline.csv · 128 rows") },
      pattern: "rays",
    },
    {
      id: "teammate",
      badge: "Team",
      title: "Priya Shah joined the workspace",
      text: "She accepted your invite and can now edit deals in the pipeline.",
      action: { label: "Review access", onClick: () => setNote("Opened access settings for Priya Shah") },
      pattern: "orbit",
    },
  ];

  return (
    <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: 400 }}>
      <NotificationStack
        key={round}
        notices={notices}
        onDismiss={(notice) => {
          setDismissed((rows) => [...rows, notice.title]);
          setNote(`Dismissed “${notice.title}”`);
        }}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span role="status" style={{ fontSize: 12.5, color: "#8f8f8f" }}>
          {note}
          {dismissed.length > 0 && ` · ${dismissed.length} of ${notices.length} closed`}
        </span>
        <button
          type="button"
          onClick={() => {
            setDismissed([]);
            setNote("Three notices — close the front one to see the next.");
            setRound((n) => n + 1);
          }}
          style={{
            font: "inherit",
            fontSize: 12.5,
            padding: "6px 11px",
            borderRadius: 8,
            border: 0,
            background: "#f2f2f2",
            color: "#404040",
            cursor: "pointer",
          }}
        >
          Reset notices
        </button>
      </div>
    </div>
  );
}
