import { useState } from "react";
import { SessionTree, type SessionNode } from "../session-tree";

/* A real OMP session that forked: the compaction branch is where the session actually
 * ended up, the canvas attempt beside it was abandoned. The leaf sits two levels under the
 * branch point, so collapsing "rows render" has to keep saying where the session ends. */

const NODES: SessionNode[] = [
  {
    id: "e1",
    type: "message",
    preview: "Add a session tree to the client — the bridge already sends parentId",
    children: [
      {
        id: "e2",
        type: "message",
        preview: "Read the bridge: every entry carries id and parentId, one leafId closes the run",
        children: [
          {
            id: "e3",
            type: "model_change",
            preview: "openai/gpt-5.1 → anthropic/claude-opus-4.1 for the long context window",
            children: [
              {
                id: "e4",
                type: "thinking_level_change",
                preview: "thinking high, so the connector geometry gets worked out before it is drawn",
                children: [
                  {
                    id: "e5",
                    type: "message",
                    preview: "Wrote flatten(); rows render with rails from the parent's column",
                    children: [
                      {
                        id: "e6",
                        type: "compaction",
                        preview: "38 entries compacted into a 900-token summary; parentId kept",
                        children: [
                          {
                            id: "e7",
                            type: "label",
                            label: "checkpoint: rows render",
                            preview: "Bookmarked before the keyboard pass so the tree is easy to find",
                            children: [
                              {
                                id: "e8",
                                type: "message",
                                preview: "Arrow keys walk the rows and the leaf carries the marker",
                                children: [],
                              },
                            ],
                          },
                        ],
                      },
                      {
                        id: "e9",
                        type: "branch_summary",
                        preview: "Tried drawing the tree on a canvas instead of DOM rows",
                        children: [
                          {
                            id: "e10",
                            type: "message",
                            preview: "Canvas lost text selection, so nothing could be copied out",
                            children: [
                              {
                                id: "e11",
                                type: "message",
                                preview: "Abandoned the canvas; the DOM rows are the branch that shipped",
                                children: [],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

export default function Demo() {
  const [picked, setPicked] = useState<SessionNode | null>(null);

  return (
    <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: 720 }}>
      <SessionTree nodes={NODES} leafId="e8" onSelect={(node) => setPicked(node)} />
      <p
        role="status"
        aria-live="polite"
        style={{
          margin: 0,
          minHeight: 18,
          fontSize: 12,
          lineHeight: "18px",
          color: "var(--text-muted, #6f625a)",
        }}
      >
        {picked
          ? `Selected ${picked.id} · ${picked.type} · ${picked.preview}`
          : "Nothing selected. Up and Down walk the rows, Right expands, Left collapses, Enter selects."}
      </p>
      <p style={{ margin: 0, fontSize: 12, lineHeight: "18px", color: "var(--text-muted, #6f625a)" }}>
        Collapse “rows render” and the leaf stays marked on the row above it. The canvas subtree
        recedes because the session never went that way.
      </p>
    </div>
  );
}
