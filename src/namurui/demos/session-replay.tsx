import { useState, type CSSProperties } from "react";
import { SessionReplay, type SessionEvent, type SessionSpan } from "../session-replay";

/* Run 4f21: the agent rotated the Stripe keys and put the pricing page out. The type check at
   00:41.8 failed because a call site read the key before the rotation resolved, and the reviewer
   marked that stretch of the run, which is what a span is for. */
const recorded: SessionEvent[] = [
  { id: "s1", at: 1800, kind: "message", summary: "Rotate the checkout keys, then redeploy the pricing page.", actor: "operator" },
  { id: "s2", at: 6400, kind: "decision", summary: "Rotate first, deploy once: a single cutover window.", actor: "planner" },
  { id: "s3", at: 12100, kind: "tool", summary: "read_file billing/keys.ts", actor: "planner" },
  { id: "s4", at: 18900, kind: "tool", summary: "grep STRIPE_SECRET across 214 files", actor: "planner" },
  { id: "s5", at: 27300, kind: "message", summary: "Two call sites still read the old key directly.", actor: "planner" },
  { id: "s6", at: 33000, kind: "tool", summary: "patch billing/webhook.ts and billing/keys.ts", actor: "coder" },
  { id: "s7", at: 41800, kind: "error", summary: "Type check failed: STRIPE_SECRET is read before the rotation resolves.", actor: "typecheck" },
  { id: "s8", at: 48500, kind: "decision", summary: "Hold the deploy and fix the read order first.", actor: "planner" },
  { id: "s9", at: 57400, kind: "tool", summary: "patch billing/keys.ts to await the rotation", actor: "coder" },
  { id: "s10", at: 66000, kind: "tool", summary: "run pnpm typecheck, 0 errors in 8.4s", actor: "typecheck" },
  { id: "s11", at: 74600, kind: "message", summary: "The webhook path is clean now.", actor: "reviewer" },
  { id: "s12", at: 82400, kind: "decision", summary: "Approved to deploy at 1x.", actor: "operator" },
  { id: "s13", at: 96000, kind: "tool", summary: "deploy pricing-page v42, live in 41s", actor: "deploy" },
  { id: "s14", at: 108000, kind: "message", summary: "Run closed. Fourteen steps, one rollback avoided.", actor: "operator" },
];

const marked: SessionSpan = { start: 33000, end: 57400 };

const chip: CSSProperties = {
  font: "inherit",
  padding: "6px 11px",
  borderRadius: 999,
  border: "1px solid var(--border, #33291f)",
  background: "transparent",
  color: "var(--text, #f4ece4)",
  cursor: "pointer",
};

export default function Demo() {
  const [events, setEvents] = useState<SessionEvent[]>(recorded);
  const [span, setSpan] = useState<SessionSpan | null>(marked);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <SessionReplay
        title="Deploy pricing page, run 4f21"
        events={events}
        selection={span}
        onSelectionChange={setSpan}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 12 }}>
        <button
          type="button"
          style={chip}
          onClick={() => {
            setEvents(recorded);
            setSpan(marked);
          }}
        >
          Replay the run
        </button>
        <button
          type="button"
          style={chip}
          onClick={() => {
            setEvents([]);
            setSpan(null);
          }}
        >
          Open a session with no events
        </button>
        <span style={{ color: "var(--text-muted, #a2958a)" }}>
          {events.length
            ? `${events.length} steps, 01:56.6 of recording`
            : "Nothing recorded, so there is nothing to scrub"}
        </span>
      </div>
    </div>
  );
}