import { useState } from "react";
import { SettingsBillingScreen } from "../settings-billing";

export default function Demo() {
  const [status, setStatus] = useState(
    "Billing is open · arrow through the tabs, hover a usage segment, or switch the period",
  );

  return (
    <div style={{ width: "100%", display: "grid", gap: 10, justifyItems: "center" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 1100,
          height: 780,
          overflow: "hidden",
          borderRadius: 18,
          border: "1px solid var(--border)",
          background: "var(--bg)",
          boxShadow: "0 1px 2px #0000000a, 0 12px 40px #0000000f",
        }}
      >
        <SettingsBillingScreen
          defaultTab="Billing"
          workspace="Acme"
          user={{ name: "Alex Morgan" }}
          onNavigate={(label) => setStatus(`Sidebar → ${label}`)}
          onSave={(values) => setStatus(`Saved ${values.name} · ${values.timezone}`)}
          onInvite={(invite) => setStatus(`Invited ${invite.email} as ${invite.role}`)}
          onCreateKey={(name) => setStatus(`Created the ${name} key`)}
          onRevokeKey={(id) => setStatus(`Revoked key ${id}`)}
          onAction={(action, detail) =>
            setStatus(detail ? `${action}: ${detail}` : `${action} requested`)
          }
        />
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }} role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
