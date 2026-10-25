import { useEffect, useRef, useState } from "react";
import { WidgetStrip, type WidgetEntry } from "../widget-strip";

/* Three revisions of one extension's widget, as a `setWidget` call would rewrite them. The key
 * never changes, so the strip keeps its node and only its rows swap. */
const GIT: readonly (readonly string[])[] = [
  ["ok    on branch main", "      working tree clean", "ok    2 commits ahead of origin"],
  [
    "warn  on branch feat/widget-strip",
    "      3 files modified, 1 untracked",
    "ok    stash empty",
    "running  rebasing onto origin/main",
  ],
  [
    "ok    on branch feat/widget-strip",
    "      working tree clean",
    "done  1 commit ahead of origin",
    "ok    stash empty",
  ],
];

const TESTS = [
  "running  vitest — 148 passed, 2 skipped",
  "ok       eslint clean in 1.4s",
  "error    tsc: 2 errors in src/bridge/rpc.ts",
  "warn     3 snapshots older than 30 days",
  "done     build 412 kB in 3.1s",
];

const control = {
  height: 28,
  padding: "0 10px",
  border: 0,
  borderRadius: 8,
  background: "transparent",
  boxShadow: "inset 0 0 0 1px var(--border, #e8e0d7)",
  color: "var(--text-muted, #6f625a)",
  font: "inherit",
  fontSize: 12,
  cursor: "pointer",
};

const muted = { margin: 0, fontSize: 12, lineHeight: "18px", color: "var(--text-muted, #6f625a)" };

export default function Demo() {
  const [rev, setRev] = useState(0);
  const [testsOn, setTestsOn] = useState(true);
  const [dismissed, setDismissed] = useState<readonly string[]>([]);
  const [reused, setReused] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);
  const lastNode = useRef<Element | null>(null);

  /* The proof that a rewrite does not remount: the strip's own DOM node is looked up after
   * every revision and compared with the one the revision before it left behind. */
  useEffect(() => {
    const node = hostRef.current?.querySelector('[data-widget-key="omp.git"]') ?? null;
    if (node !== null && node === lastNode.current) setReused((count) => count + 1);
    lastNode.current = node;
  }, [rev]);

  const above: WidgetEntry[] = dismissed.includes("omp.git")
    ? []
    : [{ key: "omp.git", lines: GIT[rev % GIT.length], placement: "above" }];
  const below: WidgetEntry[] =
    testsOn && !dismissed.includes("omp.tests")
      ? [{ key: "omp.tests", lines: TESTS, placement: "below" }]
      : [];

  return (
    <div
      ref={hostRef}
      style={{ display: "grid", gap: 12, width: "100%", maxWidth: 460, margin: "0 auto", padding: "24px 0 32px" }}
    >
      <WidgetStrip widgets={above} onDismiss={(key) => setDismissed((current) => [...current, key])} />

      {/* A stand-in composer, so the two placements have something to sit against. */}
      <div
        aria-hidden="true"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          alignItems: "center",
          gap: 8,
          padding: "10px 10px 10px 14px",
          borderRadius: 16,
          background: "var(--panel, #fffdfb)",
          boxShadow: "inset 0 0 0 1px var(--border, #e8e0d7)",
        }}
      >
        <span style={{ ...muted, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
          Ask OMP to fix the failing bridge test…
        </span>
        <span style={{ ...muted, height: 28, padding: "0 12px", borderRadius: 8, background: "var(--muted-bg, #7a4a1c0a)" }}>
          Send
        </span>
      </div>

      <WidgetStrip widgets={below} onDismiss={(key) => setDismissed((current) => [...current, key])} />

      <p style={muted}>
        Revision {(rev % GIT.length) + 1} of {GIT.length}: rewritten {rev} times, node reused{" "}
        {reused} times.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" style={control} onClick={() => setRev((current) => current + 1)}>
          Rewrite git lines
        </button>
        <button type="button" style={control} onClick={() => setTestsOn((on) => !on)}>
          {testsOn ? "Remove omp.tests" : "Bring omp.tests back"}
        </button>
        <button
          type="button"
          style={dismissed.length > 0 ? control : { ...control, opacity: 0.45, cursor: "default" }}
          disabled={dismissed.length === 0}
          onClick={() => setDismissed([])}
        >
          Restore dismissed
        </button>
      </div>
    </div>
  );
}
