import { useState } from "react";
import { DelegateBoard, type DelegateAgent, type DelegateTask } from "../delegate-board";

/* The pile the reference board shows, plus the work already running on two of the four agents. */
const TASKS: DelegateTask[] = [
  { id: "scan", title: "Competitor scan", minutes: 10, tools: ["slack"] },
  { id: "auth", title: "Refactor auth", minutes: 20, tools: ["github"] },
  { id: "sdk", title: "Upgrade Stripe SDK", minutes: 8, tools: ["stripe", "github"] },
  { id: "notes", title: "Write release notes", minutes: 12, tools: ["notion", "github"] },
  { id: "flaky", title: "Fix flaky checkout test", minutes: 20, tools: ["github"] },
  { id: "churn", title: "Summarize churn calls", minutes: 15, tools: ["slack", "notion"] },
  { id: "pricing", title: "Update pricing page", minutes: 10, tools: ["figma"] },
  { id: "crm", title: "Clean up CRM duplicates", minutes: 18, tools: ["salesforce"] },
];

/** Where every task sits before anyone touches the board: null is the pile. */
const SEATED: Record<string, string | null> = {
  scan: "research",
  auth: "coder",
  sdk: "coder",
  notes: null,
  flaky: null,
  churn: null,
  pricing: null,
  crm: null,
};

const ROSTER: Omit<DelegateAgent, "queue" | "busyUntil">[] = [
  { id: "research", name: "Researcher", model: "Opus 5.5", rate: 0.08, capacity: 90, logo: "claude" },
  { id: "writer", name: "Writer", model: "Sonnet 5.5", rate: 0.03, capacity: 60, logo: "claude" },
  { id: "coder", name: "Coder", model: "GPT-6 Sol", rate: 0.06, capacity: 120, logo: "openai" },
  { id: "ops", name: "Ops", model: "Gemini 3.8 Flash", rate: 0.01, capacity: 45, logo: "gemini" },
];

/** The job each agent was already running when the board opened. */
const RUNNING: Record<string, string> = { research: "scan", coder: "auth" };

export default function Demo() {
  const [seated, setSeated] = useState(SEATED);
  /* Two queues were already draining, so the job at the head of each has a fixed finish:
     Researcher's scan has six minutes left, Coder's auth fourteen with the SDK bump behind it.
     The deadline only stands while that job is still seated there – drag it off and the
     agent's queue starts from now instead. */
  const [deadlines] = useState<Record<string, number>>(() => {
    const start = Date.now();
    return { research: start + 6 * 60_000, coder: start + 14 * 60_000 };
  });

  const agents: DelegateAgent[] = ROSTER.map((agent) => {
    const running = RUNNING[agent.id];
    const holds = running !== undefined && seated[running] === agent.id;
    return {
      ...agent,
      queue: TASKS.filter((task) => seated[task.id] === agent.id),
      busyUntil: holds ? deadlines[agent.id] : undefined,
    };
  });

  return (
    <DelegateBoard
      agents={agents}
      tasks={TASKS.filter((task) => !seated[task.id])}
      defaultPickedId="notes"
      defaultTargetAgentId="writer"
      onAssign={(taskId, agentId) =>
        setSeated((current) => ({ ...current, [taskId]: agentId }))
      }
    />
  );
}
