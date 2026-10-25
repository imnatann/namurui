import { useState } from "react";
import { SegmentedControl } from "../segmented-control";

const sections = [
  {
    value: "overview",
    heading: "Overview",
    body: "7,412 sessions this week · 3.2% conversion · median response 184ms.",
  },
  {
    value: "analytics",
    heading: "Analytics",
    body: "Activation is up 12% after the new empty states shipped on Tuesday.",
  },
  {
    value: "reports",
    heading: "Reports",
    body: "Two reports are scheduled: Weekly growth (Mon 08:00) and Churn review (Fri 16:00).",
  },
  {
    value: "notifications",
    heading: "Notifications",
    body: "4 unread: a failed export, two mentions, and a billing receipt.",
  },
] as const;

type Section = (typeof sections)[number]["value"];

export default function Demo() {
  const [section, setSection] = useState<Section>("overview");
  const [range, setRange] = useState("30d");

  return (
    <div style={{ display: "grid", gap: 18, width: "100%", maxWidth: 560 }}>
      <div style={{ display: "grid", gap: 14 }}>
        <SegmentedControl<Section>
          aria-label="Dashboard section"
          kind="tabs"
          value={section}
          onChange={setSection}
          options={sections.map((s) => ({
            value: s.value,
            label: s.heading === "Notifications" ? "Alerts" : s.heading,
            controls: `demo-panel-${s.value}`,
            count: s.value === "notifications" ? 4 : undefined,
            badge: s.value === "reports" ? "New" : undefined,
          }))}
        />

        {sections.map((s) => (
          <div
            key={s.value}
            id={`demo-panel-${s.value}`}
            role="tabpanel"
            aria-label={s.heading}
            hidden={section !== s.value}
            style={{
              display: section === s.value ? "grid" : "none",
              gap: 6,
              padding: "16px 18px",
              borderRadius: 12,
              background: "var(--muted-bg, #fafafa)",
              boxShadow: "inset 0 0 0 1px var(--border, #ececec)",
            }}
          >
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--text, #171717)" }}>{s.heading}</p>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--text-muted, #737373)" }}>{s.body}</p>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 12.5, color: "var(--text-subtle, #8f8f8f)" }}>Trailing {range}</span>
        <SegmentedControl
          aria-label="Date range"
          variant="underline"
          size="sm"
          value={range}
          onChange={setRange}
          options={[
            { value: "7d", label: "7 days" },
            { value: "30d", label: "30 days" },
            { value: "90d", label: "90 days" },
            { value: "all", label: "All time" },
          ]}
        />
      </div>
    </div>
  );
}
