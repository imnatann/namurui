import type { ReactNode } from "react";
import { BreakdownChart, type BreakdownRecord, type Dimension, type Measure } from "../breakdown-chart";

/* The status glyphs the chart draws on the axis, in the tooltip and in the table rows. */

const iconProps = {
  viewBox: "0 0 16 16",
  width: 16,
  height: 16,
  fill: "none",
  strokeWidth: 1.1,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const statusIcons: Record<string, ReactNode> = {
  Backlog: (
    <svg {...iconProps} stroke="#bdbdbd">
      <path d="M2.5 9.5 4 3.5h8l1.5 6M2.5 9.5v3h11v-3M2.5 9.5H6l.8 1.5h2.4l.8-1.5h3.5" />
    </svg>
  ),
  Todo: (
    <svg {...iconProps} stroke="#8c8c8c">
      <rect x="3" y="3" width="10" height="10" rx="2.5" />
    </svg>
  ),
  "In progress": (
    <svg {...iconProps} stroke="#80b0f1">
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3l2 1.5" />
    </svg>
  ),
  "In review": (
    <svg {...iconProps} stroke="#5b5bd6">
      <path d="M1.8 8S4 3.8 8 3.8 14.2 8 14.2 8 12 12.2 8 12.2 1.8 8 1.8 8Z" />
      <circle cx="8" cy="8" r="1.8" />
    </svg>
  ),
  Done: (
    <svg {...iconProps} stroke="#3c85e9">
      <rect x="2.5" y="2.5" width="11" height="11" rx="3" fill="#3c85e9" stroke="none" />
      <path d="m5.5 8.2 1.8 1.8 3.3-3.6" stroke="#fff" strokeWidth="1.3" />
    </svg>
  ),
  Canceled: (
    <svg {...iconProps} stroke="#d4d4d4">
      <circle cx="8" cy="8" r="5.5" />
      <path d="m4.2 11.8 7.6-7.6" />
    </svg>
  ),
};

const STATUSES = ["Backlog", "Todo", "In progress", "In review", "Done", "Canceled"];
const PRIORITIES = ["Urgent", "High", "Medium", "Low", "None"];
const TEAMS = ["Platform", "Editor", "Mobile", "Growth"];

const dimensions: Dimension[] = [
  { key: "status", label: "Status", values: STATUSES, icons: statusIcons },
  {
    key: "priority",
    label: "Priority",
    values: PRIORITIES,
    colors: {
      Urgent: "#e5484d",
      High: "#e8a20c",
      Medium: "#3c85e9",
      Low: "#b3cff6",
      None: "#dcdcdc",
    },
  },
  { key: "team", label: "Team", values: TEAMS },
];

const measures: Measure[] = [
  { key: "count", label: "Task count", unit: "tasks" },
  { key: "points", label: "Story points", unit: "points", field: "points" },
];

/* Tasks per status, in priority order – the same tally the extracted table shows. */
const TALLY: Array<[status: string, priorities: number[]]> = [
  ["Backlog", [3, 6, 6, 8, 3]],
  ["Todo", [1, 7, 12, 11, 5]],
  ["In progress", [1, 9, 12, 7, 5]],
  ["In review", [0, 1, 6, 4, 2]],
  ["Done", [7, 14, 23, 25, 27]],
  ["Canceled", [0, 1, 3, 1, 2]],
];

const records: BreakdownRecord[] = TALLY.flatMap(([status, priorities]) =>
  priorities.flatMap((count, priority) =>
    Array.from({ length: count }, (_unused, task) => ({
      id: `${status}-${PRIORITIES[priority]}-${task}`,
      status,
      priority: PRIORITIES[priority],
      team: TEAMS[(priority + task) % TEAMS.length],
      points: 1 + ((priority + task) % 5),
    })),
  ),
);

export default function Demo() {
  return (
    <div style={{ width: "100%", maxWidth: 560 }}>
      <BreakdownChart
        title="Sprint 24"
        records={records}
        dimensions={dimensions}
        measures={measures}
        defaultMeasure="count"
        defaultSlice="status"
        defaultSegment="priority"
      />
    </div>
  );
}
