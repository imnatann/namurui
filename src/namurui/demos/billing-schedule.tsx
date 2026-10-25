import { useState } from "react";
import { BillingSchedule, type ScheduleValue } from "../billing-schedule";

export default function Demo() {
  const [schedule, setSchedule] = useState<ScheduleValue | null>(null);

  const summary = schedule
    ? `${schedule.phase} · ${schedule.lines.length} ${schedule.lines.length === 1 ? "line" : "lines"} · starts ${schedule.start}`
    : "Set the phase, add products and the totals follow.";

  return (
    <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: 560 }}>
      <BillingSchedule
        defaultPhase="Build-out phase"
        defaultStart="2026-01-01"
        defaultLines={[
          { id: "seed-1", kind: "product", name: "Set-up fee", repeat: "once", price: 4999, timing: "advance" },
        ]}
        onChange={setSchedule}
      />
      <p
        role="status"
        style={{
          margin: 0,
          padding: "10px 14px",
          borderRadius: 10,
          background: "var(--panel)",
          boxShadow: "inset 0 0 0 1px var(--border)",
          font: "400 12.5px/1.5 Inter, system-ui, sans-serif",
          color: "var(--text-muted)",
          minHeight: 40,
        }}
      >
        {summary}
      </p>
    </div>
  );
}
