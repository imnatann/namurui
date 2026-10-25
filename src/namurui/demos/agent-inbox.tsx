import { useState } from "react";
import {
  AgentInbox,
  type AgentInboxStatus,
  type AgentInboxTask,
} from "../agent-inbox";

const START: AgentInboxTask[] = [
  {
    id: "migrate",
    title: "Migrate users table",
    description: "Split users into accounts and profiles on Postgres 17. The dry run on staging passed.",
    agent: "Opus 5.5",
    status: "waiting",
    duration: "6m 13s",
    sources: 9,
    toolCalls: 14,
    steps: [
      { label: "Read schema and 14 migrations", time: "6m ago" },
      { label: "Wrote migration 0042_split_users", time: "4m ago" },
      { label: "Dry run on staging – no errors", time: "2m ago" },
      { label: "Wants to run it on production", time: "1m ago" },
    ],
  },
  {
    id: "crm",
    title: "Clean up CRM contacts",
    description: "Matched 1,312 likely duplicates, then the merge hit the API rate limit.",
    agent: "Haiku 5.5",
    status: "failed",
    sources: 2,
    toolCalls: 6,
    steps: [
      { label: "Loaded 18,240 contacts", time: "9m ago" },
      { label: "Matched 1,312 likely duplicates", time: "8m ago" },
      { label: "Merge stopped – API rate limit (429)", time: "7m ago" },
    ],
  },
  {
    id: "review",
    title: "Review PR #482",
    description: "Billing webhooks: reading the diff and the test run, writing comments.",
    agent: "Sonnet 5.5",
    status: "running",
    duration: "3m 41s",
    sources: 12,
    toolCalls: 21,
    steps: [
      { label: "Read 12 changed files", time: "2m ago" },
      { label: "Ran the test suite – 214 passed", time: "1m ago" },
      { label: "Writing review comments", time: "now" },
    ],
  },
  {
    id: "notes",
    title: "Release notes v2.4",
    description: "Grouping 23 merged pull requests into features and fixes.",
    agent: "Sonnet 5.5",
    status: "running",
    duration: "1m 19s",
    sources: 23,
    toolCalls: 5,
    steps: [
      { label: "Collected 23 merged pull requests", time: "1m ago" },
      { label: "Drafting the highlights", time: "now" },
    ],
  },
  {
    id: "digest",
    title: "Weekly metrics digest",
    description: "Pulled numbers from three dashboards and posted the summary to #metrics.",
    agent: "Haiku 5.5",
    status: "done",
    duration: "4m 12s",
    sources: 3,
    toolCalls: 8,
    steps: [
      { label: "Pulled numbers from 3 dashboards", time: "22m ago" },
      { label: "Posted to #metrics", time: "18m ago" },
    ],
  },
];

export default function Demo() {
  const [tasks, setTasks] = useState<AgentInboxTask[]>(START);
  const [openId, setOpenId] = useState<string | null>("migrate");

  /* Decisions settle into the next lane and leave their mark on the timeline, so the card you
     just acted on tells you what happened after it moves. */
  const settle = (task: AgentInboxTask, status: AgentInboxStatus, step: string, duration: string) =>
    setTasks((list) =>
      list.map((t) =>
        t.id === task.id
          ? { ...t, status, duration, steps: [...t.steps, { label: step, time: "now" }] }
          : t,
      ),
    );

  return (
    <AgentInbox
      tasks={tasks}
      openId={openId}
      onOpenChange={setOpenId}
      onApprove={(task) =>
        settle(task, "running", "Approved – running 0042_split_users on production", "0s")
      }
      onReject={(task) => settle(task, "done", "Rejected – nothing ran", "0s")}
      onRetry={(task) => settle(task, "running", "Retry queued at the front of the queue", "0s")}
      onOpen={(task) => setOpenId(task.id)}
    />
  );
}
