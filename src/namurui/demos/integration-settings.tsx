import { useState } from "react";
import { IntegrationSettings, type IntegrationValues } from "../integration-settings";

const INITIAL: IntegrationValues = {
  enabled: true,
  apiKey: "",
  siteUrl: "lumen-studio.com",
  timeZone: "(GMT +01:00) Berlin",
};

export default function Demo() {
  const [value, setValue] = useState<IntegrationValues>(INITIAL);
  const [status, setStatus] = useState("The store is connected and in sync");

  return (
    <div style={{ display: "grid", gap: 12, width: "100%", maxWidth: 560 }}>
      <IntegrationSettings
        name="Shopify store"
        count={128}
        meta="Connected on March 4, 2026 at 09:12"
        value={value}
        onChange={setValue}
        onSave={async (next) => {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, 900);
          });
          setStatus(`Saved ${next.siteUrl} · ${next.timeZone} · sync ${next.enabled ? "on" : "paused"}`);
        }}
        onError={() => setStatus("The store did not answer — save again when it is back")}
      />
      <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>{status}</p>
    </div>
  );
}
