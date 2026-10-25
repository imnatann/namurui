import { useState } from "react";
import { IntegrationPicker, type IntegrationService } from "../integration-picker";

export default function Demo() {
  const [log, setLog] = useState<string[]>([]);
  const note = (line: string) => setLog((prev) => [line, ...prev].slice(0, 3));

  return (
    <div style={{ display: "grid", gap: 16, width: "100%", maxWidth: 660 }}>
      <IntegrationPicker
        defaultValue="linear"
        onChange={(id) => note(`picked ${id}`)}
        onConnect={(service: IntegrationService) => note(`Connected ${service.name}`)}
        onDisconnect={(service: IntegrationService) => note(`Disconnected ${service.name}`)}
        onExplore={(service) => note(`Opening the ${service.name} integration page`)}
        onBack={() => note("Back to the command menu")}
      />
      <div
        style={{
          display: "grid",
          gap: 4,
          padding: "12px 14px",
          borderRadius: 12,
          background: "var(--panel)",
          boxShadow: "inset 0 0 0 1px var(--border)",
          fontSize: 12.5,
          color: "var(--text-muted)",
          minHeight: 46,
        }}
      >
        <span style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          events
        </span>
        {log.length === 0 ? (
          <span>Nothing yet – pick a service, then connect or disconnect it.</span>
        ) : (
          log.map((entry, index) => <span key={index}>{entry}</span>)
        )}
      </div>
    </div>
  );
}
