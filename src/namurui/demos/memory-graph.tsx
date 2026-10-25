import { useState } from "react";
import { MemoryGraph, type MemoryLink, type MemoryNode } from "../memory-graph";

/* A support agent that has been working with one account for a few weeks. */
const nodes: MemoryNode[] = [
  { id: "dana", label: "Dana Whitfield", kind: "entity", confidence: 0.98, learnedAt: "Sep 30",
    note: "Leads the platform team at Loomly. Wrote in through support, not the docs." },
  { id: "loomly", label: "Loomly", kind: "entity", confidence: 0.96, learnedAt: "Sep 30",
    note: "Video tool, about 40 engineers, one production region." },
  { id: "migration", label: "Billing off Stripe v2", kind: "task", confidence: 0.91, learnedAt: "Oct 18",
    note: "Moves invoices and webhooks onto the current API. Started Oct 18." },
  { id: "freeze", label: "Freeze starts Nov 3", kind: "fact", confidence: 0.88, learnedAt: "Oct 21",
    note: "No billing deploys after Nov 3. Anything unfinished waits until Nov 17." },
  { id: "stack", label: "Node 20, Postgres 16", kind: "fact", learnedAt: "Oct 2",
    note: "Read from the build log in the first ticket, not stated by the user." },
  { id: "short", label: "Short answers first", kind: "preference", confidence: 0.74, learnedAt: "Oct 6",
    note: "Asked twice for the summary before the steps. Details on request only." },
  { id: "diffs", label: "Wants diffs before merges", kind: "preference", confidence: 0.83, learnedAt: "Oct 9",
    note: "Reviewed every patch by hand, including the one-line ones." },
  { id: "linear", label: "Linear, project BIL", kind: "entity", confidence: 0.79, learnedAt: "Oct 12",
    note: "The migration is tracked in Linear, not in the support thread." },
  { id: "standup", label: "Standup at 09:30 CET", kind: "preference",
    note: "Never confirmed. Inferred from when replies usually arrive." },
];

const links: MemoryLink[] = [
  { from: "dana", to: "loomly", relation: "leads platform at" },
  { from: "dana", to: "migration", relation: "owns" },
  { from: "dana", to: "short", relation: "prefers" },
  { from: "dana", to: "diffs", relation: "prefers" },
  { from: "dana", to: "standup", relation: "available" },
  { from: "loomly", to: "stack", relation: "runs" },
  { from: "loomly", to: "linear", relation: "tracks work in" },
  { from: "migration", to: "freeze", relation: "blocked by" },
  { from: "migration", to: "linear", relation: "tracked in" },
  { from: "migration", to: "stack", relation: "runs on" },
  { from: "freeze", to: "linear", relation: "announced in" },
];

export default function Demo() {
  const [selectedId, setSelectedId] = useState<string | null>("migration");
  const [log, setLog] = useState(
    "The migration is selected, so its neighbours stay lit and everything else recedes.",
  );

  return (
    <div style={{ display: "grid", gap: 10, width: "100%", maxWidth: 760 }}>
      <MemoryGraph
        nodes={nodes}
        links={links}
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id);
          const node = nodes.find((entry) => entry.id === id);
          setLog(
            node
              ? `${node.label}: ${node.kind}, ${
                  node.confidence === undefined
                    ? "never scored"
                    : `${Math.round(node.confidence * 100)}% confident`
                }, learned ${node.learnedAt ?? "at an unknown time"}.`
              : "Selection cleared, so every node is back at full strength.",
          );
        }}
      />
      <p style={{ margin: 0, fontSize: 12, lineHeight: "16px", color: "var(--text-muted, #6f625a)" }}>
        {log}
      </p>
    </div>
  );
}
