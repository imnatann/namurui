import { useEffect, useRef, useState } from "react";
import { ToolCallCard, ToolCallGroup } from "../tool-call-card";

const searchIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
    <circle cx="10.5" cy="10.5" r="6.25" />
    <path d="m15.2 15.2 4.3 4.3" />
  </svg>
);

const globeIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
    <circle cx="12" cy="12" r="8.25" />
    <path d="M3.9 9.5h16.2M3.9 14.5h16.2M12 3.75c2.2 2.3 3.3 5.2 3.3 8.25S14.2 18 12 20.25C9.8 18 8.7 15 8.7 12S9.8 6.05 12 3.75Z" />
  </svg>
);

const sheetIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3.75h7.5L18.5 8.5V20.25H6z" />
    <path d="M13.5 3.75V8.5h5M9 12h6M9 15.5h6" />
  </svg>
);

type RetryState = "error" | "running" | "success";

export default function Demo() {
  const [startedAt] = useState(() => Date.now());
  const [retry, setRetry] = useState<RetryState>("error");
  const [retryStarted, setRetryStarted] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const runRetry = () => {
    setRetry("running");
    setRetryStarted(Date.now());
    timer.current = window.setTimeout(() => setRetry("success"), 2600);
  };

  const exportSummary =
    retry === "success"
      ? "Exported the pricing comparison"
      : retry === "running"
        ? "Exporting the comparison as CSV…"
        : "Export the comparison as CSV";

  return (
    <div style={{ width: "100%", maxWidth: 600 }}>
      <ToolCallGroup defaultOpen label="Used 3 tools">
        <ToolCallCard
          name="search_web"
          summary="Searched the web for “CRM pricing 2026”"
          status="success"
          icon={searchIcon}
          duration={842}
          defaultOpen
          maxCodeHeight={120}
          args={{ query: "CRM pricing 2026", limit: 5 }}
          result={{
            results: [
              { title: "Pricing that scales with seats", url: "https://fieldnote.example/pricing" },
              { title: "What teams actually pay in 2026", url: "https://ledgerline.example/report" },
            ],
          }}
        />

        <ToolCallCard
          name="fetch_page"
          summary="Reading 12 competitor pricing pages…"
          status="running"
          icon={globeIcon}
          startedAt={startedAt}
          defaultOpen
          maxCodeHeight={120}
          args={{ urls: 12, respectRobots: true }}
        />

        <ToolCallCard
          name="export_report"
          summary={exportSummary}
          status={retry === "success" ? "success" : retry === "running" ? "running" : "error"}
          icon={sheetIcon}
          startedAt={retry === "running" ? retryStarted : undefined}
          duration={retry === "success" ? 2600 : undefined}
          onRetry={runRetry}
          defaultOpen
          maxCodeHeight={120}
          args={{ format: "csv", includeSources: true }}
          result={retry === "success" ? { file: "pricing-2026.csv", rows: 38 } : undefined}
          error="Export service timed out after 30s (upstream 504)."
        />
      </ToolCallGroup>
    </div>
  );
}
