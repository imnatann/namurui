import { useEffect, useState } from "react";
import { AgentTerminal, type TerminalLine, type TerminalStatus } from "../agent-terminal";

const PACE = 220;

/* A board export that prints a warning, hits a permission error, recovers and finishes. */
const exportRun: TerminalLine[] = [
  { id: "x1", text: "loading workspace config namur.config.ts" },
  { id: "x2", text: "resolving 4 sources: postgres/ops, postgres/billing, s3/namur-assets, sheets/board-q3" },
  { id: "x3", severity: "warning", text: "s3/namur-assets is 41 MB over the 250 MB budget" },
  { id: "x4", text: "fetching metrics for the last 12 weeks" },
  { id: "x5", text: "writing dist/board/index.html  412 KB" },
  { id: "x6", text: "writing dist/board/styles.css  38 KB" },
  { id: "x7", severity: "error", text: "cannot write dist/board/metrics.json: EACCES permission denied" },
  { id: "x8", severity: "warning", text: "retrying metrics.json with the workspace token" },
  { id: "x9", text: "writing dist/board/metrics.json  1.2 MB" },
  { id: "x10", text: "copied 14 chart specs to dist/board/charts" },
  { id: "x11", severity: "warning", text: "3 chart specs still use a deprecated colour token" },
  { id: "x12", text: "done in 8.4s" },
];

/* A staging deploy that fails on its own build step; the terminal is handed the finished output. */
const deployRun: TerminalLine[] = [
  { id: "d1", text: "building image namur/api:staging" },
  { id: "d2", text: "step 7 of 11: npm run build:api" },
  { id: "d3", severity: "error", text: 'npm ERR! missing script: "build:api"' },
  { id: "d4", severity: "error", text: "image build failed: step 7 exited with code 1" },
  { id: "d5", severity: "warning", text: "staging still serves namur/api:9f21c, nothing to roll back" },
];

export default function Demo() {
  const [run, setRun] = useState(0);
  const [status, setStatus] = useState<TerminalStatus>("running");
  const [note, setNote] = useState("");

  /* The demo owns the call: it hands the terminal the whole stream and marks the call done once
     the last line has had time to arrive. */
  useEffect(() => {
    setStatus("running");
    setNote("");
    const done = window.setTimeout(() => setStatus("done"), exportRun.length * PACE + 420);
    return () => window.clearTimeout(done);
  }, [run]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <AgentTerminal
        key={run}
        title="Board export"
        command="npx namur export --board q3 --out dist/board"
        lines={exportRun}
        status={status}
        exitCode={0}
        pace={PACE}
        onStop={() => setStatus("stopped")}
        onClear={() => setNote("Scrollback cleared; the run keeps printing.")}
      />

      <AgentTerminal
        title="Staging deploy"
        command="npx namur deploy --env staging"
        lines={deployRun}
        status="failed"
        exitCode={1}
      />

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={() => setRun((count) => count + 1)}
          style={{
            height: 30,
            padding: "0 12px",
            border: 0,
            borderRadius: 8,
            background: "var(--primary, #1a1410)",
            color: "var(--primary-fg, #fffdfb)",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Replay the export
        </button>
        <span style={{ fontSize: 13, color: "var(--text-muted, #6f625a)" }}>
          {note || "Scroll the output up to raise the jump pill; Stop cuts the stream where it stands."}
        </span>
      </div>
    </div>
  );
}