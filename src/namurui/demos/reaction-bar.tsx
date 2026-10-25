import { useState } from "react";
import { ReactionBar, type ReactionKey } from "../reaction-bar";

const messages: Record<ReactionKey, [string, string]> = {
  like: ["Liked", "Like removed"],
  comment: ["Comment added", "Comment removed"],
  repost: ["Reposted", "Repost removed"],
  share: ["Shared", "Share undone"],
};

export default function Demo() {
  const [last, setLast] = useState<string | null>(null);

  return (
    <div style={{ display: "grid", gap: 18, width: "100%", maxWidth: 540 }}>
      <article
        style={{
          display: "grid",
          gap: 12,
          padding: "18px 20px 16px",
          borderRadius: 16,
          background: "var(--card, #ffffff)",
          boxShadow: "inset 0 0 0 1px var(--border, #ececec), 0 1px 2px rgba(0, 0, 0, 0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            aria-hidden="true"
            style={{
              display: "grid",
              placeItems: "center",
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "var(--accent-soft, #eef2ff)",
              color: "var(--accent, #4c5bd4)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            ML
          </span>
          <span style={{ display: "grid", gap: 1 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text, #171717)" }}>Mara Lindqvist</span>
            <span style={{ fontSize: 12.5, color: "var(--text-subtle, #8f8f8f)" }}>@mara · 2h</span>
          </span>
        </div>

        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: "var(--text-muted, #404040)" }}>
          Spent the morning deleting a design-system abstraction nobody asked for. The best
          component is the one the team never has to learn.
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 12, overflowX: "auto", paddingBottom: 2 }}>
          <ReactionBar
            reactions={{
              like: { count: 1284 },
              comment: { count: 96 },
              repost: { count: 42 },
              share: { count: 18 },
            }}
            onReact={(key, state) =>
              setLast(`${messages[key][state.active ? 0 : 1]} · ${state.count.toLocaleString("en-US")}`)
            }
          />
        </div>
      </article>

      <p
        role="status"
        aria-live="polite"
        style={{ margin: 0, fontSize: 12.5, color: "var(--text-subtle, #8f8f8f)", minHeight: 18 }}
      >
        {last ?? "Tap like, comment, repost or share — counts roll and icons pop."}
      </p>
    </div>
  );
}
