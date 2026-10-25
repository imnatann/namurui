import { useState } from "react";
import { AgentRunScreen, type RunApproval } from "../agent-run";

export default function Demo() {
  const [note, setNote] = useState("The run is working through the plan – it stops at the send.");

  const decide = (verb: string, approval: RunApproval) =>
    setNote(`${verb} “${approval.title}” · risk ${approval.risk}`);

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          width: "100%",
          maxWidth: 1280,
          height: 800,
          margin: "0 auto",
          overflow: "hidden",
          border: "1px solid var(--border, #e5e5e5)",
          borderRadius: 18,
          background: "var(--card, #fff)",
        }}
      >
        <AgentRunScreen
          title="Prepare the Q3 board update"
          agent="Board prep"
          triggeredBy="Alex Morgan"
          cost="$0.14"
          onApprove={(approval) => decide("Approved", approval)}
          onDeny={(approval) => decide("Denied", approval)}
          onStop={() => setNote("Stop run pressed · the plan kept its place")}
          onDone={() => setNote("Run finished · the memo is in Deliverables")}
        />
      </div>
      <p
        style={{
          maxWidth: 1280,
          margin: "12px auto 0",
          fontSize: 12,
          lineHeight: 1.5,
          color: "var(--text-muted, #737373)",
        }}
      >
        The plan ticks on its own, tool calls open with their arguments and results, and the run halts at
        the high-risk send for approval · approve or deny it in the side panel · open a suggestion in the
        draft and press Y or N
        {` · ${note}`}
      </p>
    </div>
  );
}
