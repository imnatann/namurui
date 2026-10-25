import { useState } from "react";
import { IntegrationsScreen, type IntegrationItem } from "../integrations";

export default function Demo() {
  const [last, setLast] = useState("Search, filter, connect an app, or ask for one");

  return (
    <div style={{ width: "100%", display: "grid", gap: 10, justifyItems: "center" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 1100,
          height: 700,
          overflow: "hidden",
          borderRadius: 18,
          border: "1px solid var(--border)",
          background: "var(--bg)",
          boxShadow: "0 1px 2px #0000000a, 0 12px 40px #0000000f",
        }}
      >
        <IntegrationsScreen
          onNavigate={setLast}
          onConnectionChange={(item: IntegrationItem, connected) =>
            setLast(connected ? `${item.name} connected` : `${item.name} disconnected`)
          }
          onRequest={(name) => setLast(`Requested ${name}`)}
        />
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }} role="status" aria-live="polite">
        {last}
      </p>
    </div>
  );
}
