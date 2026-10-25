import { useState } from "react";
import { CrmScreen } from "../crm";

export default function Demo() {
  const [note, setNote] = useState("");

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          width: "100%",
          maxWidth: 1100,
          margin: "0 auto",
          height: 720,
          borderRadius: 18,
          overflow: "hidden",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.08)",
          background: "var(--card)",
        }}
      >
        <CrmScreen
          workspace="Acme"
          user={{ name: "Alex Morgan" }}
          onNavigate={(label) => setNote(`Navigated to ${label}`)}
          onSelectView={(id) => setNote(`Opened view ${id}`)}
          onCloseView={(id) => setNote(`Closed view ${id}`)}
          onRowsChange={(rows) => setNote(`${rows.length} companies · saved`)}
          onToggleStar={(starred) => setNote(starred ? "Pinned to favourites" : "Removed from favourites")}
          onOpenGuide={() => setNote("Getting started opened")}
          onOpenNews={() => setNote("Opening the changelog")}
        />
      </div>
      <p style={{ maxWidth: 1100, margin: "12px auto 0", fontSize: 12, color: "var(--text-muted)" }}>
        Double-click a Value or Last contact cell to edit it, use a Stage cell to change the stage, and tick
        rows for the bulk bar. New view adds a tab and Alt-click closes one; Team strategy groups the same
        companies by stage with a count and a total per column.
        {note ? ` · ${note}` : ""}
      </p>
    </div>
  );
}
