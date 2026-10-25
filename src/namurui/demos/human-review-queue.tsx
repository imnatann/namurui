import { useState } from "react";
import { HumanReviewQueue, type ReviewItem, type ReviewKind } from "../human-review-queue";

const QUEUE: readonly ReviewItem[] = [
  {
    id: "refund-4471",
    action: "Refund €148.00 on order 4471",
    rationale: "The crate arrived split and the customer filed a damage note before the return window closed.",
    from: "Plan step 3",
    subject: "Order 4471",
    impact: "Takes €148.00 out of April revenue and closes the support ticket.",
    confidence: 0.93,
    proposal: "Refund €148.00 to order 4471 and close the support ticket.",
    evidence: [
      { source: "Support thread, 09:12", quote: '"The base is cracked right through. I can send photos."' },
      { source: "Courier scan, 14 Jun", quote: '"Delivered. Left at the side gate, no signature."' },
    ],
  },
  {
    id: "merge-482",
    action: "Merge refund-guard into main",
    rationale: "The guard has been green on the branch for nine runs and the refund path is its only caller.",
    from: "Plan step 5",
    subject: "Pull request 482",
    impact: "Ships with the next release tag.",
    confidence: 0.86,
    proposal: "Squash merge refund-guard into main once the checks pass.",
    evidence: [
      { source: "Checks, run 1183", quote: "9 passed, 0 failed, 41s" },
      { source: "Diff", quote: "+38 -6 across 3 files, no new dependency" },
    ],
  },
  {
    id: "renewal-northwind",
    action: "Send the renewal note to Northwind",
    rationale: "Northwind asked for the 2026 terms by Friday and legal cleared the redlines this morning.",
    subject: "Contract 2026-11",
    impact: "Starts the 14 day acceptance clock.",
    confidence: 0.71,
    proposal: "Send contract 2026-11 to legal@northwind.example with the redline attached.",
    evidence: [{ source: "Legal, this morning", quote: '"Redlines accepted. Send it when you are ready."' }],
  },
  {
    id: "drafts-6",
    action: "Delete 6 stale campaign drafts",
    rationale: "Six drafts have not been touched since February and the send quota is shared with the live runs.",
    from: "Plan step 8",
    subject: "Campaign drafts",
    impact: "Frees 1,400 sends of the shared quota. Deleted drafts stop being recoverable after 30 days.",
    confidence: 0.64,
    proposal: "Archive the 6 February drafts and free their quota.",
    evidence: [{ source: "Draft list", quote: "6 drafts, last edited 14 Feb" }],
  },
];

const VERDICT: Record<ReviewKind, string> = { approve: "Approved", reject: "Rejected", edit: "Edited" };

const CHIP_ON = {
  minHeight: 32, padding: "0 12px", border: 0, borderRadius: 9, fontSize: 12.5, cursor: "pointer",
  background: "var(--card, #201a15)",
  boxShadow: "inset 0 0 0 1px var(--text, #f4ece4)",
  color: "var(--text, #f4ece4)",
};

const CHIP_OFF = { ...CHIP_ON, boxShadow: "inset 0 0 0 1px var(--border, #33291f)", color: "var(--text-muted, #a2958a)" };

const NOTE = { fontSize: 12.5, color: "var(--text-muted, #a2958a)" };

export default function Demo() {
  const [view, setView] = useState<{ mode: "queued" | "none"; round: number }>({ mode: "queued", round: 0 });
  const [filed, setFiled] = useState<readonly string[]>([]);

  const show = (mode: "queued" | "none") => setView((current) => ({ mode, round: current.round + 1 }));

  return (
    <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: 640 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" style={view.mode === "queued" ? CHIP_ON : CHIP_OFF} onClick={() => show("queued")}>
          Four requests waiting
        </button>
        <button type="button" style={view.mode === "none" ? CHIP_ON : CHIP_OFF} onClick={() => show("none")}>
          Nothing queued yet
        </button>
      </div>

      <HumanReviewQueue
        key={`${view.mode}-${view.round}`}
        items={view.mode === "none" ? [] : QUEUE}
        agent="atlas"
        onDecide={(decision) => {
          const action = QUEUE.find((item) => item.id === decision.id)?.action ?? decision.id;
          const wording = decision.value && decision.value.length > 44 ? `${decision.value.slice(0, 44)}...` : decision.value;
          setFiled((rows) => [`${VERDICT[decision.kind]} · ${action}${wording ? ` as "${wording}"` : ""}`, ...rows].slice(0, 3));
        }}
      />

      <div aria-live="polite" style={{ display: "grid", gap: 4 }}>
        {filed.length === 0 ? (
          <span style={NOTE}>Nothing filed yet. Approve, reject or edit the request above, or press a, r, e.</span>
        ) : (
          filed.map((row) => (
            <span key={row} style={NOTE}>
              {row}
            </span>
          ))
        )}
      </div>
    </div>
  );
}