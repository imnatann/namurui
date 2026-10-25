import { useState } from "react";
import { OnboardingScreen, type OnboardingValues } from "../onboarding";

export default function Demo() {
  const [status, setStatus] = useState(
    "Opened on step 2 · Slack connected, the checklist reads 1/4",
  );

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          width: "100%",
          maxWidth: 1440,
          margin: "0 auto",
          height: 900,
          borderRadius: 18,
          overflow: "hidden",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.08)",
          background: "var(--page)",
        }}
      >
        <OnboardingScreen
          defaultStep={2}
          workspace="Acme"
          user={{ name: "Alex Morgan" }}
          onNavigate={(label) => setStatus(`Opened ${label}`)}
          onComplete={(values: OnboardingValues) =>
            setStatus(
              `onComplete · ${values.workspace} at ${values.slug}.app · ${
                values.tools.length
              } tools · ${values.invites.length} invites · ${values.role} · ${
                values.template || "no template"
              } · ${values.agentName || "no agent"}`,
            )
          }
        />
      </div>
      <p
        style={{ maxWidth: 1440, margin: "12px auto 0", fontSize: 12, color: "var(--text-muted)" }}
        role="status"
        aria-live="polite"
      >
        {status}
      </p>
    </div>
  );
}
