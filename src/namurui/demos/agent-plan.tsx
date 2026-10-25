import { useEffect, useRef, useState } from "react";
import { AgentPlan, type PlanStep } from "../agent-plan";

const PLAN: PlanStep[] = [
  {
    id: "pull",
    title: "Pull Q3 revenue and ARR",
    detail: "Monthly revenue, ARR and net retention",
    tool: "stripe.query",
  },
  {
    id: "launches",
    title: "Summarize product launches",
    detail: "Shipped projects and adoption",
    tool: "linear.search",
  },
  {
    id: "slides",
    title: "Build the KPI slides",
    detail: "Six charts in the board template",
    tool: "slides.create",
  },
  {
    id: "memo",
    title: "Draft the board memo",
    detail: "One page, wins, risks and asks",
    tool: "docs.write",
  },
  {
    id: "send",
    title: "Send the draft to Maya for review",
    tool: "gmail.draft",
  },
];

/** What the fake agent takes per step, in milliseconds. */
const DURATIONS: Record<string, number> = {
  pull: 1300,
  launches: 800,
  slides: 2400,
  memo: 1900,
  send: 700,
};

const reset = (list: PlanStep[]): PlanStep[] =>
  list.map((step) => ({ ...step, status: undefined, error: undefined, duration: undefined }));

export default function Demo() {
  const [steps, setSteps] = useState<PlanStep[]>(PLAN);
  const [status, setStatus] = useState<"draft" | "running" | "done">("draft");
  const brokeOnce = useRef(false);

  /* A stand-in for the agent stream: turn the next step active, then land it after its duration.
     The memo fails the first time so the retry affordance is part of the demo. */
  useEffect(() => {
    if (status !== "running") return;
    if (steps.some((step) => step.status === "failed")) return;

    const active = steps.find((step) => step.status === "active");
    if (!active) {
      const next = steps.find((step) => step.status === undefined || step.status === "pending");
      if (!next) {
        setStatus("done");
        return;
      }
      setSteps((list) => list.map((step) => (step.id === next.id ? { ...step, status: "active" } : step)));
      return;
    }

    const duration = DURATIONS[active.id] ?? 1200;
    const timer = window.setTimeout(() => {
      const shouldFail = active.id === "memo" && !brokeOnce.current;
      if (shouldFail) brokeOnce.current = true;
      setSteps((list) =>
        list.map((step) =>
          step.id === active.id
            ? shouldFail
              ? { ...step, status: "failed", duration, error: "slides.create timed out after 20s" }
              : { ...step, status: "done", duration }
            : step,
        ),
      );
    }, duration);
    return () => window.clearTimeout(timer);
  }, [status, steps]);

  return (
    <AgentPlan
      title="Prepare the Q3 board update"
      estimate="~2 min"
      steps={steps}
      status={status}
      onChange={setSteps}
      onRun={(final) => {
        setSteps(reset(final));
        setStatus("running");
      }}
      onCancel={() => {
        setSteps(reset);
        setStatus("draft");
      }}
      onRetry={(id) => {
        const index = steps.findIndex((step) => step.id === id);
        if (index < 0) return;
        setSteps(
          steps.map((step, at) =>
            at < index ? step : { ...step, status: undefined, error: undefined, duration: undefined },
          ),
        );
        setStatus("running");
      }}
    />
  );
}
