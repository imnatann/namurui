import { useState } from "react";
import { AnalyticsScreen } from "../analytics";

export default function Demo() {
  const [period, setPeriod] = useState("Last 7 days");
  const [lastRoute, setLastRoute] = useState<string | null>(null);

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          width: "100%",
          maxWidth: 1100,
          height: 800,
          margin: "0 auto",
          overflow: "hidden",
          border: "1px solid var(--border, #e5e5e5)",
          borderRadius: 16,
          background: "var(--card, #fff)",
        }}
      >
        <AnalyticsScreen
          workspace="Acme"
          user={{ name: "Alex Morgan" }}
          period={period}
          onPeriodChange={setPeriod}
          onNavigate={setLastRoute}
        />
      </div>
      <p
        style={{
          maxWidth: 1100,
          margin: "12px auto 0",
          fontSize: 12,
          color: "var(--text-muted, #737373)",
        }}
      >
        Hover or tab into a chart and the arrow keys walk the days{lastRoute ? ` · last action: ${lastRoute}` : ""}
      </p>
    </div>
  );
}
