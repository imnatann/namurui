import { useState } from "react";
import {
  TaskBoard,
  type BoardColumn,
  type BoardLabel,
  type BoardPerson,
  type BoardTask,
} from "../task-board";

/* Neutral silhouette portraits, so the demo needs no image files */
const portrait = (from: string, to: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="96" height="96" fill="url(#g)"/><circle cx="48" cy="37" r="15" fill="#fff" fill-opacity="0.9"/><path d="M16 96c0-17.7 14.3-32 32-32s32 14.3 32 32z" fill="#fff" fill-opacity="0.9"/></svg>`,
  )}`;

const COLUMNS: BoardColumn[] = [
  { id: "todo", label: "Todo", mark: "todo" },
  { id: "review", label: "In review", mark: "review" },
  { id: "next", label: "Up next", mark: "next" },
  { id: "progress", label: "In progress", mark: "progress" },
  { id: "done", label: "Done", mark: "done" },
];

const LABELS: BoardLabel[] = [
  { id: "website", name: "Website", color: "rgb(47, 107, 255)" },
  { id: "feature", name: "Feature", color: "rgb(169, 193, 255)" },
  { id: "billing", name: "Billing", color: "rgb(139, 92, 246)" },
  { id: "bug", name: "Bug", color: "rgb(236, 72, 153)" },
  { id: "mobile", name: "Mobile", color: "rgb(20, 184, 166)" },
];

const PEOPLE: BoardPerson[] = [
  { id: "mara", name: "Mara Lindqvist", avatar: portrait("#fda4af", "#e11d48") },
  { id: "theo", name: "Theo Brandt", avatar: portrait("#93c5fd", "#2563eb") },
  { id: "sofia", name: "Sofia Marin", avatar: portrait("#c4b5fd", "#7c3aed") },
  { id: "lena", name: "Lena Hart", avatar: portrait("#86efac", "#16a34a") },
  { id: "jonas", name: "Jonas Weber", avatar: portrait("#fcd34d", "#d97706") },
];

const SEED: BoardTask[] = [
  {
    id: "t214",
    key: "NW-214",
    title: "Add the launch banner to the marketing site",
    column: "todo",
    priority: 2,
    estimate: "M",
    labels: ["website", "feature"],
    assignee: "mara",
    created: "Oct 2",
  },
  {
    id: "t209",
    key: "NW-209",
    title: "Currency rounding in annual invoices",
    column: "todo",
    priority: 3,
    due: { label: "2d", tone: "soon" },
    labels: ["billing", "bug"],
    assignee: "theo",
    created: "Sep 28",
  },
  {
    id: "t197",
    key: "NW-197",
    title: "Follow up with the beta customers about pricing",
    column: "todo",
    priority: 1,
    subtasks: { done: 2, total: 4 },
    assignee: "sofia",
    created: "Sep 24",
  },
  {
    id: "t221",
    key: "NW-221",
    title: "Review the onboarding copy for the new plans",
    column: "review",
    priority: 2,
    due: { label: "1d", tone: "soon" },
    labels: ["website"],
    assignee: "lena",
    created: "Oct 2",
  },
  {
    id: "t205",
    key: "NW-205",
    title: "Add usage limits to the plan comparison table",
    column: "review",
    priority: 3,
    estimate: "L",
    labels: ["website", "feature"],
    assignee: "jonas",
    created: "Sep 27",
  },
  {
    id: "t188",
    key: "NW-188",
    title: "Push notification opt-in on iOS",
    column: "review",
    priority: 2,
    pullRequest: 412,
    labels: ["mobile"],
    assignee: "mara",
    created: "Sep 21",
  },
  {
    id: "t226",
    key: "NW-226",
    title: "Record the launch walkthrough video",
    column: "next",
    priority: 4,
    due: { label: "1d late", tone: "late" },
    labels: ["feature"],
    assignee: "sofia",
    created: "Oct 1",
  },
  {
    id: "t217",
    key: "NW-217",
    title: "Plan the press outreach for launch week",
    column: "next",
    priority: 2,
    estimate: "S",
    assignee: "lena",
    created: "Sep 30",
  },
  {
    id: "t199",
    key: "NW-199",
    title: "Summarize the beta feedback into one doc",
    column: "next",
    priority: 1,
    subtasks: { done: 1, total: 3 },
    assignee: "theo",
    created: "Sep 25",
  },
  {
    id: "t230",
    key: "NW-230",
    title: "Export guide for the help center",
    column: "progress",
    priority: 2,
    labels: ["website"],
    assignee: "jonas",
    created: "Sep 30",
  },
  {
    id: "t201",
    key: "NW-201",
    title: "Proration when teams add seats mid-month",
    column: "progress",
    priority: 3,
    due: { label: "4d" },
    labels: ["billing"],
    assignee: "theo",
    created: "Sep 23",
  },
  {
    id: "t176",
    key: "NW-176",
    title: "Offline mode for the task list",
    column: "progress",
    priority: 2,
    estimate: "XL",
    pullRequest: 398,
    labels: ["mobile", "feature"],
    assignee: "mara",
    created: "Sep 16",
  },
  {
    id: "t160",
    key: "NW-160",
    title: "Dark mode for the dashboard",
    column: "done",
    priority: 2,
    labels: ["website", "feature"],
    assignee: "lena",
    created: "Sep 12",
  },
  {
    id: "t171",
    key: "NW-171",
    title: "Fix crash when uploading large avatars",
    column: "done",
    priority: 3,
    labels: ["mobile", "bug"],
    assignee: "jonas",
    created: "Sep 15",
  },
];

export default function Demo() {
  const [tasks, setTasks] = useState<BoardTask[]>(SEED);

  return (
    <TaskBoard
      tasks={tasks}
      columns={COLUMNS}
      labels={LABELS}
      people={PEOPLE}
      onMove={(id, column, index) =>
        setTasks((current) => {
          const from = current.findIndex((task) => task.id === id);
          if (from < 0) return current;
          const next = current.slice();
          const [moved] = next.splice(from, 1);
          const updated = moved.column === column ? moved : { ...moved, column };
          const rest = next.filter((task) => task.column === column);
          const anchor = rest[index];
          const at = anchor
            ? next.findIndex((task) => task.id === anchor.id)
            : rest.length > 0
              ? next.findIndex((task) => task.id === rest[rest.length - 1].id) + 1
              : next.length;
          next.splice(at, 0, updated);
          return next;
        })
      }
      onUpdate={(id, patch) =>
        setTasks((current) =>
          current.map((task) => (task.id === id ? { ...task, ...patch } : task)),
        )
      }
      onCreate={(task) => setTasks((current) => [...current, task])}
      onDelete={(id) => setTasks((current) => current.filter((task) => task.id !== id))}
    />
  );
}
