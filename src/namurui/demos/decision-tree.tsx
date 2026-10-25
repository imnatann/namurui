import { useState } from "react";
import { DecisionTree, type Decision, type DecisionChoice } from "../decision-tree";

/*
 * The reference demo: an incident agent with three decisions queued. The first is the checkout
 * burn – roll back, hotfix or kill the flag – and each branch carries what it costs. One
 * consequence is flagged because the agent is not sure about it.
 */

const decisions: Decision[] = [
  {
    id: "checkout-burn",
    question: "Checkout errors jumped to 18% after deploy #482 – what should I do?",
    context: "2,140 errors in 12 minutes · about $3.2k in orders an hour at risk.",
    agent: "Incident agent",
    model: "Opus 5.5",
    risk: "high",
    branches: [
      {
        label: "Roll back to #481",
        pick: true,
        ask: {
          question: "Tell customers about it?",
          options: [
            {
              label: "Post on the status page",
              pick: true,
              icon: "intercom",
              effects: ["Public · updates every 15 min"],
              apps: ["intercom", "slack"],
            },
            {
              label: "Only tell the team",
              icon: "slack",
              effects: ["#incidents only · nothing public"],
              apps: ["slack"],
            },
          ],
        },
      },
      {
        label: "Ship a hotfix",
        icon: "github",
        ask: {
          question: "Wait for the test run?",
          options: [
            {
              label: "Ship right away",
              effects: [
                [
                  "Skips ",
                  {
                    text: "1,284 tests",
                    note: "The suite being skipped is the checkout one – the exact area that just broke.",
                    source: "Runbook · deploys",
                  },
                ],
              ],
              apps: ["github", "alert"],
            },
            {
              label: "After the tests",
              effects: ["14 min · errors keep coming"],
              apps: ["github"],
            },
          ],
        },
      },
      {
        label: "Turn the flag off",
        icon: "flag",
        effects: ["New checkout off for 30%", "The old one takes over"],
        apps: ["flag", "telemetry"],
      },
    ],
  },
  {
    id: "duplicate-charges",
    question: "Three customers were charged twice during the rollback – what now?",
    context: "$147 taken twice · all three wrote in within the hour.",
    agent: "Billing agent",
    model: "Sonnet 5.5",
    risk: "medium",
    branches: [
      {
        label: "Refund the second charge",
        pick: true,
        ask: {
          question: "Say anything to them?",
          options: [
            {
              label: "Send a short apology",
              pick: true,
              icon: "intercom",
              effects: ["Names the outage · no ETA promised"],
              apps: ["intercom"],
            },
            {
              label: "Refund silently",
              effects: ["Money lands in 3–5 days"],
              apps: ["intercom"],
            },
          ],
        },
      },
      {
        label: "Credit the accounts instead",
        effects: ["$147 as credit · stays with you", "No card fees, no bank delay"],
        apps: ["flag"],
      },
    ],
  },
  {
    id: "incident-thread",
    question: "Support wants the incident thread quoted in a tweet – publish it?",
    context: "The thread names two customers and one internal host.",
    agent: "Comms agent",
    model: "Opus 5.5",
    risk: "medium",
    branches: [
      {
        label: "Publish a redacted version",
        pick: true,
        effects: [
          "Names and the host come out",
          ["Keeps ", { text: "the timeline", note: "The timestamps alone show how long checkout was down." }],
        ],
        apps: ["slack"],
      },
      {
        label: "Publish nothing",
        effects: ["Status page stays the only source"],
        apps: ["intercom"],
      },
      {
        label: "Send it to legal first",
        effects: ["Takes 1–2 days"],
      },
    ],
  },
];

export default function Demo() {
  const [status, setStatus] = useState(
    "Nothing chosen yet – press 1, or tab to the flagged consequence for the agent's note.",
  );

  const choose = (decision: Decision, choice: DecisionChoice) => {
    setStatus(
      choice.other
        ? `“${choice.other}” → the agent holds the deploy and waits for you`
        : `${decision.agent}: ${choice.sub ? `${choice.label} → ${choice.sub.label}` : choice.label}`,
    );
    if (choice.other) return "Reading your instruction – holding the deploy until you say go.";
    if (choice.branch?.label.startsWith("Roll back")) {
      return "Reverted #482 · checkout recovering, status page live.";
    }
    if (decision.id === "duplicate-charges") return "Refunds issued · three replies sent.";
    return "On it – the agent is carrying the branch out.";
  };

  return (
    <div style={{ display: "grid", gap: 12, width: "100%", maxWidth: 756 }}>
      <DecisionTree decisions={decisions} onChoose={choose} />
      <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>{status}</p>
    </div>
  );
}
