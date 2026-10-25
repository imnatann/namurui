import { useState } from "react";
import { AgentTree, type AgentTreeNode, type AgentTreeStatus } from "../agent-tree";

/*
 * One launch on four agents plus the two jobs hanging off the coder: the orchestrator is live,
 * the planner has settled, the researcher needs a decision, the coder failed and its own two
 * jobs are queued and stopped. Selecting a card – with the pointer or with Enter/Space – names
 * the agent under the tree, because the tree itself only reports the click.
 */

const STATUS_LABEL: Record<AgentTreeStatus, string> = {
  queued: "Queued",
  running: "Running",
  waiting: "Needs you",
  done: "Done",
  failed: "Failed",
  stopped: "Stopped",
};

export default function Demo() {
  const [startedAt] = useState(Date.now);
  const [selected, setSelected] = useState<AgentTreeNode | null>(null);
  const tree: AgentTreeNode = {
    id: "orchestrator",
    name: "Orchestrator",
    model: "Opus 5.5",
    mark: "claude",
    status: "running",
    task: "Launch the new pricing page by Friday",
    cost: 0.13,
    started: startedAt - 13_000,
    tools: ["slack", "notion", "github"],
    children: [
      {
        id: "planner",
        name: "Planner",
        model: "Sonnet 5.5",
        mark: "claude",
        status: "done",
        task: "Break the launch into research, copy and shipping",
        cost: 0.02,
        started: startedAt - 12_000,
        ended: startedAt - 4_000,
        tools: ["notion"],
      },
      {
        id: "researcher",
        name: "Researcher",
        model: "Sonnet 5.5",
        mark: "claude",
        status: "waiting",
        task: "Compare the pricing of five competitors",
        ask: "Approve the five competitors before I price them",
        cost: 0.03,
        started: startedAt - 6_000,
        tools: ["notion", "slack"],
      },
      {
        id: "coder",
        name: "Coder",
        model: "GPT-6 Sol",
        mark: "openai",
        status: "failed",
        task: "Ship the pricing page behind a flag",
        error: "The tier table threw on `price` before the build finished.",
        cost: 0.04,
        started: startedAt - 5_000,
        ended: startedAt - 1_000,
        tools: ["github"],
        children: [
          {
            id: "deploy",
            name: "Deploy",
            mark: "gemini",
            status: "queued",
            task: "Push the preview to the staging flag",
            tools: ["github"],
          },
          {
            id: "tests",
            name: "Test run",
            status: "stopped",
            task: "Re-run the tier table suite",
            cost: 0.01,
            started: startedAt - 4_800,
            ended: startedAt - 1_500,
            tools: ["github"],
          },
        ],
      },
    ],
  };

  return (
    <div style={{ width: "100%", maxWidth: 760 }}>
      <AgentTree tree={tree} onSelect={(node) => setSelected(node)} />
      <p
        style={{
          margin: "14px 0 0",
          fontSize: 12,
          lineHeight: "18px",
          color: "var(--text-muted)",
        }}
      >
        {selected ? (
          <>
            Selected <b style={{ color: "var(--text)" }}>{selected.name}</b> · {selected.model ?? "no model"} ·{" "}
            {STATUS_LABEL[selected.status]}
          </>
        ) : (
          "Select an agent to inspect it – every card is a button."
        )}
      </p>
    </div>
  );
}
