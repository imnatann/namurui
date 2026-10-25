import { useState } from "react";
import { Kbd, TipsPanel, type Tip } from "../tips-panel";

const tips: Tip[] = [
  {
    id: "search",
    title: "Jump anywhere",
    description: (
      <>
        Press <Kbd>⌘K</Kbd> to search projects, invoices and people from one box.
      </>
    ),
    action: "Try it",
    doneLabel: "Shortcut learned",
    primary: true,
  },
  {
    id: "views",
    title: "Save a view",
    description: "Filter the table once, then save it as a view your team can open.",
    action: "Save a view",
    doneLabel: "View saved",
  },
  {
    id: "digest",
    title: "Weekly digest",
    description: "A Monday summary of revenue, churn and open issues in your inbox.",
    action: "Subscribe",
    doneLabel: "Subscribed",
  },
  {
    id: "invite",
    title: "Invite a teammate",
    description: "Editors can comment on reports without changing the underlying numbers.",
    action: "Send invite",
    doneLabel: "Invite sent",
  },
];

export default function Demo() {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: 620 }}>
      {open ? (
        <TipsPanel title="Get more out of your workspace" tips={tips} onClose={() => setOpen(false)} />
      ) : (
        <div
          style={{
            display: "grid",
            gap: 10,
            padding: 22,
            borderRadius: 14,
            background: "var(--muted-bg, #fafafa)",
            boxShadow: "inset 0 0 0 1px var(--border, #ececec)",
            justifyItems: "start",
          }}
        >
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--text, #171717)" }}>Tips dismissed</p>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted, #737373)" }}>
            You can bring the panel back whenever you want a refresher.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              appearance: "none",
              border: 0,
              cursor: "pointer",
              marginTop: 2,
              padding: "8px 13px",
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--text, #171717)",
              background: "var(--card, #ffffff)",
              boxShadow: "inset 0 0 0 1px var(--border, #e0e0e0)",
              fontFamily: "inherit",
            }}
          >
            Show tips again
          </button>
        </div>
      )}
    </div>
  );
}
