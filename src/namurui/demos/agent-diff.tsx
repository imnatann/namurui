import { useState } from "react";
import { AgentDiff, type DiffHunk, type HunkDecision } from "../agent-diff";

const HUNKS: readonly DiffHunk[] = [
  {
    id: "attempts",
    header: "@@ -17,7 +17,8 @@ export async function runAgent(job: Job, tracer: Tracer) {",
    lines: [
      { kind: "context", oldLine: 17, newLine: 17, text: "  const trace = tracer.start(job.id);" },
      { kind: "context", oldLine: 18, newLine: 18, text: "  const started = Date.now();" },
      { kind: "remove", oldLine: 19, newLine: null, text: "  const maxAttempts = 3;", spans: [{ text: "  const maxAttempts = " }, { text: "3", changed: true }, { text: ";" }] },
      { kind: "add", oldLine: null, newLine: 19, text: "  const maxAttempts = job.retries ?? 5;", spans: [{ text: "  const maxAttempts = " }, { text: "job.retries ?? 5", changed: true }, { text: ";" }] },
      { kind: "add", oldLine: null, newLine: 20, text: "  const budgetMs = job.budgetMs ?? 30_000;" },
      { kind: "context", oldLine: 20, newLine: 21, text: "  let backoffMs = 250;" },
      { kind: "context", oldLine: 21, newLine: 22, text: "" },
      { kind: "context", oldLine: 22, newLine: 23, text: "  for (let attempt = 1; attempt <= maxAttempts; attempt++) {" },
      { kind: "remove", oldLine: 23, newLine: null, text: "    const result = await callTool(job.tool, job.input);", spans: [{ text: "    const result = await callTool(" }, { text: "job.tool, job.input", changed: true }, { text: ");" }] },
      { kind: "add", oldLine: null, newLine: 24, text: "    const result = await callTool(job.tool, job.input, { timeout: 8_000 });", spans: [{ text: "    const result = await callTool(" }, { text: "job.tool, job.input, { timeout: 8_000 }", changed: true }, { text: ");" }] },
    ],
  },
  {
    id: "backoff",
    header: "@@ -28,7 +29,9 @@ export async function runAgent(job: Job, tracer: Tracer) {",
    lines: [
      { kind: "context", oldLine: 28, newLine: 29, text: "" },
      { kind: "remove", oldLine: 29, newLine: null, text: '    trace.event("retry", { attempt, error: result.error });', spans: [{ text: '    trace.event("retry", { attempt, error: result.error' }, { text: " }", changed: true }, { text: ");" }] },
      { kind: "add", oldLine: null, newLine: 30, text: '    trace.event("retry", { attempt, error: result.error, backoffMs });', spans: [{ text: '    trace.event("retry", { attempt, error: result.error' }, { text: ", backoffMs }", changed: true }, { text: ");" }] },
      { kind: "remove", oldLine: 30, newLine: null, text: "    await sleep(backoffMs);", spans: [{ text: "    await sleep(" }, { text: "backoffMs", changed: true }, { text: ");" }] },
      { kind: "add", oldLine: null, newLine: 31, text: "    await sleep(backoffMs + Math.random() * 100);", spans: [{ text: "    await sleep(" }, { text: "backoffMs + Math.random() * 100", changed: true }, { text: ");" }] },
      { kind: "add", oldLine: null, newLine: 32, text: "    backoffMs = Math.min(backoffMs * 2, 4_000);" },
      { kind: "add", oldLine: null, newLine: 33, text: "    if (Date.now() - started > budgetMs) break;" },
      { kind: "context", oldLine: 31, newLine: 34, text: "  }" },
      { kind: "context", oldLine: 32, newLine: 35, text: "" },
      { kind: "remove", oldLine: 33, newLine: null, text: "  trace.end({ ms: Date.now() - started, failed: true });", spans: [{ text: "  trace.end({ ms: Date.now() - started, " }, { text: "failed: true", changed: true }, { text: " });" }] },
      { kind: "add", oldLine: null, newLine: 36, text: "  trace.end({ ms: Date.now() - started, attempts: maxAttempts, failed: true });", spans: [{ text: "  trace.end({ ms: Date.now() - started, " }, { text: "attempts: maxAttempts, failed: true", changed: true }, { text: " });" }] },
      { kind: "context", oldLine: 34, newLine: 37, text: "  return { ok: false, attempts: maxAttempts };" },
    ],
  },
  {
    id: "summarize",
    header: "@@ -38,4 +41,5 @@ export function summarize(result: RunResult): string {",
    lines: [
      { kind: "context", oldLine: 38, newLine: 41, text: "" },
      { kind: "context", oldLine: 39, newLine: 42, text: "export function summarize(result: RunResult): string {" },
      { kind: "remove", oldLine: 40, newLine: null, text: '  return result.ok ? "done" : "failed";', spans: [{ text: "  return " }, { text: 'result.ok ? "done" : "failed"', changed: true }, { text: ";" }] },
      { kind: "add", oldLine: null, newLine: 43, text: '  const state = result.ok ? "done" : "failed";' },
      { kind: "add", oldLine: null, newLine: 44, text: '  return state + " after " + result.attempts + " attempts";' },
      { kind: "context", oldLine: 41, newLine: 45, text: "}" },
    ],
  },
];

export default function Demo() {
  const [decisions, setDecisions] = useState<Record<string, HunkDecision>>({});
  const [round, setRound] = useState(0);
  const accepted = Object.values(decisions).filter((value) => value === "accepted").length;
  const decided = Object.values(decisions).filter((value) => value !== "pending").length;

  return (
    <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: 780 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 12.5, color: "var(--text-muted, #8a7c72)" }}>
          Run 41c · retry hardening · 3 hunks staged
        </span>
        <button
          type="button"
          onClick={() => {
            setDecisions({});
            setRound((value) => value + 1);
          }}
          style={{
            font: "inherit",
            fontSize: 12.5,
            fontWeight: 500,
            padding: "5px 11px",
            borderRadius: 999,
            border: 0,
            cursor: "pointer",
            color: "var(--text-muted, #6f625a)",
            background: "transparent",
            boxShadow: "inset 0 0 0 1px var(--border, #e8e0d7)",
          }}
        >
          Restart review
        </button>
      </div>

      <AgentDiff
        key={round}
        file="src/agent/run.ts"
        hunks={HUNKS}
        decisions={decisions}
        onDecide={(id, decision) => setDecisions((prev) => ({ ...prev, [id]: decision }))}
      />

      <p style={{ margin: 0, fontSize: 12.5, lineHeight: "18px", color: "var(--text-muted, #8a7c72)" }}>
        {decided === 0
          ? "The agent stopped before committing. Accept a hunk to write it to the working tree."
          : decided < HUNKS.length
            ? `${accepted} of ${HUNKS.length} hunks written. The rest are still staged for review.`
            : accepted === 0
              ? "Every hunk was rejected. The agent will re-plan against the unchanged file."
              : `All ${HUNKS.length} hunks reviewed. The agent can commit when you hand control back.`}
      </p>
    </div>
  );
}
