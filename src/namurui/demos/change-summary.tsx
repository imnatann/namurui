import { useState } from "react";
import { ChangeSummary, type MetricChange } from "../change-summary";

const recaps: Record<"week" | "month", MetricChange[]> = {
  week: [
    { label: "Active users", change: "Up 6.1% to 18,240", tone: "good" },
    { label: "Gross churn", change: "Down to 2.1% from 2.6%", tone: "good", direction: "down" },
    { label: "Support tickets", change: "Up 14% to 312", tone: "bad", direction: "up" },
    { label: "Trial conversion", change: "Up 1.4 pts to 8.9%", tone: "good" },
    { label: "Net revenue retention", change: "Unchanged at 114%", tone: "neutral" },
  ],
  month: [
    { label: "Active users", change: "Up 18% to 18,240", tone: "good" },
    { label: "Gross churn", change: "Down to 2.1% from 3.0%", tone: "good", direction: "down" },
    { label: "Support tickets", change: "Up 31% to 1,204", tone: "bad", direction: "up" },
    { label: "Trial conversion", change: "Up 2.2 pts to 8.9%", tone: "good" },
    { label: "Net revenue retention", change: "Down to 114% from 118%", tone: "bad", direction: "down" },
  ],
};

export default function Demo() {
  const [range, setRange] = useState<"week" | "month">("week");

  return (
    <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: 520 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 12.5, color: "#8f8f8f" }}>Growth recap · updated 09:41</span>
        <div
          role="group"
          aria-label="Recap period"
          style={{ display: "flex", gap: 3, padding: 3, borderRadius: 9, background: "#f2f2f2" }}
        >
          {(["week", "month"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              aria-pressed={range === key}
              style={{
                font: "inherit",
                fontSize: 12.5,
                fontWeight: 500,
                padding: "5px 10px",
                borderRadius: 7,
                border: 0,
                cursor: "pointer",
                color: range === key ? "#171717" : "#737373",
                background: range === key ? "#ffffff" : "transparent",
                boxShadow: range === key ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {key === "week" ? "This week" : "This month"}
            </button>
          ))}
        </div>
      </div>

      <ChangeSummary
        period={range === "week" ? "Oct 14 – 20" : "October 2026"}
        changes={recaps[range]}
      />

      <p role="status" style={{ margin: 0, fontSize: 12.5, color: "#8f8f8f" }}>
        {range === "week"
          ? "Churn improved for a third week; ticket volume is the one to watch."
          : "October closes ahead of plan on users and conversion."}
      </p>
    </div>
  );
}
