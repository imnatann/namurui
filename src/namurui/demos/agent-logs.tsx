import { useEffect, useRef, useState } from "react";
import { AgentLogs, type LogRow } from "../agent-logs";

/* A line of the run the pane is watching, before it gets an id and a clock stamp. */
type Line = Omit<LogRow, "id" | "at">;

/* What the migration run has already emitted, newest first. */
const SEED: Line[] = [
  { level: "error", source: "deploy-bot", message: "Canary stopped: /healthz answered 504 on 3 of 3 pods", detail: [{ key: "route", value: "/healthz on payments" }, { key: "status", value: "504 gateway timeout" }, { key: "attempt", value: "3 of 5, backing off 8s" }] },
  { level: "warn", source: "planner", message: "Token budget crossed 80% of the plan ceiling", detail: [{ key: "used", value: "318.4k tokens" }, { key: "ceiling", value: "400k tokens" }, { key: "steps left", value: "3 of 7" }] },
  { level: "info", source: "retriever", message: "Fetched 48 policy documents for the refund question", detail: [{ key: "index", value: "policies-v7" }, { key: "documents", value: "48" }, { key: "took", value: "742ms (cache miss)" }] },
  { level: "info", source: "sandbox", message: "cargo test finished clean in the migration worktree", detail: [{ key: "exit code", value: "0" }, { key: "passed", value: "86 tests" }, { key: "took", value: "12.4s" }] },
  { level: "debug", source: "memory-index", message: "Embedded 128 notes across 2 batches", detail: [{ key: "model", value: "text-embed-4" }, { key: "dimensions", value: "1024" }, { key: "tokens", value: "41.2k" }] },
  { level: "warn", source: "sandbox", message: "Write outside the workspace was blocked and dropped", detail: [{ key: "path", value: "/etc/hosts" }, { key: "policy", value: "workspace-only" }, { key: "action", value: "dropped, not retried" }] },
  { level: "info", source: "planner", message: "Step 4 of 7 settled: run the migration dry run" },
  { level: "error", source: "memory-index", message: "Ingest halted: shard 3 did not answer within 5s", detail: [{ key: "shard", value: "shard-3" }, { key: "waited", value: "5.0s" }, { key: "retries", value: "2, then stopped" }] },
  { level: "debug", source: "planner", message: "Tool schemas refreshed for 6 tools" },
  { level: "info", source: "deploy-bot", message: "Canary held at 10% for 4 minutes with no error budget burn" },
  { level: "debug", source: "retriever", message: "Cache hit for the refund window question" },
  { level: "info", source: "sandbox", message: "Worktree synced with origin/main" },
];

/* Lines that keep arriving while the run is going. */
const ARRIVALS: Line[] = [
  { level: "debug", source: "memory-index", message: "Flushed 12 dirty vectors to the store" },
  { level: "info", source: "sandbox", message: "Installed 3 packages in the migration worktree", detail: [{ key: "registry", value: "npm" }, { key: "packages", value: "3" }, { key: "took", value: "6.1s" }] },
  { level: "warn", source: "retriever", message: "Index answer crossed its 900ms budget", detail: [{ key: "took", value: "942ms" }, { key: "budget", value: "900ms" }] },
  { level: "info", source: "planner", message: "Step 5 of 7 opened: verify the ledger entries" },
  { level: "debug", source: "planner", message: "Re-read run state from the ledger" },
  { level: "error", source: "deploy-bot", message: "Probe failed on payments-canary-4", detail: [{ key: "pod", value: "payments-canary-4" }, { key: "probe", value: "/healthz" }, { key: "status", value: "503 no ready endpoint" }] },
];

export default function Demo() {
  const [rows, setRows] = useState<LogRow[]>(() => {
    const now = Date.now();
    return SEED.map((line, index) => ({ ...line, id: `seed-${index}`, at: now - index * 2600 }));
  });
  const [streaming, setStreaming] = useState(true);
  const emitted = useRef(0);

  /* The timer drives data only; every pixel of the motion is CSS. It idles while the tab is hidden. */
  useEffect(() => {
    if (!streaming) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      const line = ARRIVALS[emitted.current % ARRIVALS.length];
      emitted.current += 1;
      setRows((prev) => [{ ...line, id: `live-${emitted.current}`, at: Date.now() }, ...prev].slice(0, 40));
    }, 2400);
    return () => window.clearInterval(id);
  }, [streaming]);

  return (
    <div style={{ display: "grid", gap: 16, width: "100%", maxWidth: 780 }}>
      <AgentLogs rows={rows} title="Migration run" streaming={streaming} pinnedIds={["seed-0"]} />
      <button
        type="button"
        onClick={() => setStreaming((value) => !value)}
        style={{
          justifySelf: "start",
          height: 32,
          padding: "0 14px",
          border: 0,
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 500,
          color: "var(--text, #f4ece4)",
          background: "var(--card, #201a15)",
          boxShadow: "inset 0 0 0 1px var(--border, #33291f)",
          cursor: "pointer",
        }}
      >
        {streaming ? "Hold the stream" : "Resume the stream"}
      </button>
    </div>
  );
}