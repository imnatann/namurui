import { useEffect, useState } from "react";
import { CompactionDivider } from "../compaction-divider";

/* Three compaction runs from the same long session: what the window held before and what
 * it holds after, so running the divider again has a real drop to report. */
const RUNS = [
  { before: 128_400, after: 24_100 },
  { before: 96_200, after: 18_400 },
  { before: 151_800, after: 31_200 },
];

const KEPT =
  "Folded the retry investigation into one note: the helper, the two timeouts, and the fix that finally held on the third run.";

const bubble = {
  margin: 0,
  fontSize: 12.5,
  lineHeight: "19px",
  color: "var(--text-muted, #6f625a)",
};

const control = {
  height: 30,
  padding: "0 12px",
  border: 0,
  borderRadius: 8,
  background: "transparent",
  boxShadow: "inset 0 0 0 1px var(--border, #e8e0d7)",
  color: "var(--text, #1a1410)",
  font: "inherit",
  fontSize: 12,
};

export default function Demo() {
  const [step, setStep] = useState(0);
  const [live, setLive] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const run = RUNS[step];

  /* The bridge's start and end frames are a real interval apart, so the first divider
   * walks from running to done on a timer instead of switching on the click. */
  useEffect(() => {
    if (!live) return;
    const id = window.setTimeout(() => setLive(false), 1600);
    return () => window.clearTimeout(id);
  }, [live, step]);

  /* A retry re-enters the running state and comes back failed, which is what the second
   * attempt actually did. */
  useEffect(() => {
    if (!retrying) return;
    const id = window.setTimeout(() => setRetrying(false), 1400);
    return () => window.clearTimeout(id);
  }, [retrying]);

  return (
    <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: 560 }}>
      <div
        style={{
          display: "grid",
          gap: 2,
          padding: "14px 16px 16px",
          borderRadius: 12,
          boxShadow: "inset 0 0 0 1px var(--border-soft, #1a14101a)",
        }}
      >
        <p style={bubble}>The suite is flaking on the retry test again. Can you find it?</p>

        <CompactionDivider
          reason="threshold"
          action="snapcompact"
          status={live ? "running" : "done"}
          tokensBefore={run.before}
          tokensAfter={run.after}
          shortSummary={live ? undefined : KEPT}
        />
        <p style={bubble}>Third run held. The retry helper was swallowing its own timeout.</p>

        <CompactionDivider
          reason="overflow"
          action="context-full"
          status="done"
          tokensBefore={151_800}
          tokensAfter={31_200}
          shortSummary="Dropped the twelve tool-call traces from the failing build and kept only their diffs."
        />
        <p style={bubble}>The window overflowed while the build log was still streaming.</p>

        <CompactionDivider
          reason="incomplete"
          action="handoff"
          status={retrying ? "running" : "failed"}
          error="The bridge closed while the summary was still streaming."
          onRetry={() => setRetrying(true)}
        />

        <p style={{ ...bubble, fontSize: 11.5, color: "var(--text-subtle, #1a141099)" }}>
          The run went idle before a second compaction was needed, so the protocol draws nothing.
        </p>
        <CompactionDivider reason="idle" action="shake" status="skipped" />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          style={{ ...control, opacity: live ? 0.5 : 1, cursor: live ? "default" : "pointer" }}
          disabled={live}
          onClick={() => {
            setStep((current) => (current + 1) % RUNS.length);
            setLive(true);
          }}
        >
          Run again
        </button>
        <span style={{ fontSize: 11.5, color: "var(--text-subtle, #1a141099)" }}>
          {live ? "Compacting — the divider lands on its own." : "Landed. Run again for the next window."}
        </span>
      </div>
    </div>
  );
}
