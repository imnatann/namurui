import { useState } from "react";
import { AgentLanes, type LaneAgent, type LaneTask } from "../agent-lanes";

const MINUTE = 60_000;

const agents: LaneAgent[] = [
  { id: "researcher", name: "Researcher", model: "Opus 5.5", logo: "claude" },
  { id: "writer", name: "Writer", model: "Sonnet 5.5", logo: "claude" },
  { id: "reviewer", name: "Reviewer", model: "GPT-6 Sol", logo: "openai" },
  { id: "ops", name: "Ops", model: "Gemini 3.8 Flash", logo: "gemini" },
];

/* Task times sit on the minute grid the lanes are anchored to, so the blocks land on the same
 * percentages the reference has; the sheet slides by the sub-minute remainder to reach "now". */
const seedLanes = (): LaneTask[] => {
  const anchor = Math.floor(Date.now() / MINUTE) * MINUTE;
  return [
    {
      id: "r1",
      agentId: "researcher",
      title: "Competitor pricing",
      status: "done",
      start: anchor - 27 * MINUTE,
      end: anchor - 16 * MINUTE,
      handoffTo: "w1",
      tools: ["google", "notion"],
      detail: ["Read nine pricing pages", "Two moved Pro to annual-only this quarter"],
    },
    {
      id: "r2",
      agentId: "researcher",
      title: "Customer interviews",
      status: "running",
      start: anchor - 9 * MINUTE,
      tools: ["notion", "slack"],
      detail: ["Seven of twelve calls transcribed", "Two buyers asked for seat-based pricing"],
    },
    {
      id: "w1",
      agentId: "writer",
      title: "Draft pricing page",
      status: "running",
      start: anchor - 15 * MINUTE,
      tools: ["figma", "notion"],
      detail: ["Hero and plan table drafted", "Waiting on the churn figures from Researcher"],
    },
    {
      id: "v1",
      agentId: "reviewer",
      title: "PR #482 billing",
      status: "done",
      start: anchor - 29 * MINUTE,
      end: anchor - 19 * MINUTE,
      tools: ["github", "linear"],
      detail: ["Left four comments on the proration path", "Approved after the retry fix"],
    },
    {
      id: "o1",
      agentId: "ops",
      title: "Sync CRM",
      status: "failed",
      start: anchor - 27 * MINUTE,
      end: anchor - 20.5 * MINUTE,
      tools: ["hubspot"],
      detail: ["HubSpot returned 429 six times in a row", "Backoff gave up at the fourth retry"],
    },
    {
      id: "o2",
      agentId: "ops",
      title: "Rotate API keys",
      status: "waiting",
      start: anchor - 12 * MINUTE,
      tools: ["stripe", "github"],
      ask: "Rotate the Stripe and GitHub keys together? Billing webhooks fail for about a minute while they roll.",
      detail: ["New keys generated in both vaults", "Old keys stay live until the swap completes"],
    },
  ];
};

export default function Demo() {
  const [tasks, setTasks] = useState<LaneTask[]>(seedLanes);

  return (
    <AgentLanes
      agents={agents}
      tasks={tasks}
      onApprove={(task) =>
        setTasks((lanes) =>
          lanes.map((lane) =>
            lane.id === task.id
              ? { ...lane, status: "running" as const, end: undefined, ask: undefined }
              : lane,
          ),
        )
      }
      onReject={(task) =>
        setTasks((lanes) =>
          lanes.map((lane) =>
            lane.id === task.id ? { ...lane, status: "failed" as const, end: Date.now(), ask: undefined } : lane,
          ),
        )
      }
    />
  );
}
