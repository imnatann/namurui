import { useState } from "react";
import { FilesScreen } from "../files";

/*
 * The reference demo: the Acme workspace with the four folders, the four file templates and the
 * getting-started card. Everything is live – the tabs, both searches, the sort and view switches,
 * Create folder and Add template mutate the lists, and each action reports itself below the frame.
 */

export default function Demo() {
  const [status, setStatus] = useState("Folders · 4 folders and 4 templates in Acme");

  return (
    <div style={{ width: "100%", padding: 24, display: "grid", gap: 12, justifyItems: "center" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 1100,
          height: 820,
          overflow: "hidden",
          borderRadius: 18,
          border: "1px solid var(--border)",
          background: "var(--bg)",
          boxShadow: "0 1px 2px #0000000a, 0 12px 40px #0000000f",
        }}
      >
        <FilesScreen
          workspace="Acme"
          user={{ name: "Alex Morgan" }}
          onNavigate={(label) => setStatus(`Opened ${label}`)}
          onOpenFolder={(folder) => setStatus(`Opening ${folder.name} · ${folder.files} files`)}
          onOpenTemplate={(template) => setStatus(`Opening ${template.name} template`)}
          onCreateFolder={(folder) => setStatus(`${folder.name} created — rename it from the card`)}
          onAddTemplate={(template) => setStatus(`${template.name} added to the templates`)}
          onOpenGuide={() => setStatus("Getting started · 13% done")}
          onWorkspaceChange={(name) => setStatus(`Switched to the ${name} workspace`)}
          onCreateWorkspace={() => setStatus("Creating a workspace")}
          onAccountAction={(action) => setStatus(`Account · ${action}`)}
          onBrowseChanges={() => setStatus("Opening the changelog")}
        />
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }} role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
