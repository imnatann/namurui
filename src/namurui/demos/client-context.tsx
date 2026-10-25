import { useState } from "react";
import { ClientContext, type CxClient, type CxFile } from "../client-context";

const northwind: CxClient = {
  id: "northwind",
  name: "Northwind Logistics",
  meta: "Northwind Logistics GmbH · EUR · Fiscal year ends Dec 31",
  mark: "N",
  color: "#1d4ed8",
  ink: "#ffffff",
  kpis: [
    {
      id: "mrr",
      label: "MRR",
      value: "€48.2k",
      trend: [41.2, 42.3, 41.7, 43.3, 43.9, 43.3, 45, 46.1, 46.6, 48.2],
      color: "#2f6bff",
    },
    {
      id: "cash",
      label: "Cash",
      value: "€612k",
      trend: [612, 597, 597, 568, 553, 568, 524, 509, 495, 480],
      color: "#0ea5e9",
    },
    {
      id: "margin",
      label: "Gross margin",
      value: "64.1%",
      trend: [61, 61.8, 61, 62.6, 61.8, 63.3, 62.6, 63.3, 64.1, 64.1],
      color: "#8b5cf6",
    },
    {
      id: "burn",
      label: "Net burn",
      value: "€36.0k",
      trend: [36, 35.4, 36.2, 34.6, 34, 33.4, 34, 32, 31.4, 30.8],
      color: "#ec4899",
    },
  ],
  reports: [
    {
      id: "pl",
      name: "Monthly P&L",
      meta: "Updated yesterday · finance · 12 pages",
      summary:
        "Revenue is up 6.4% on September, carried by the Danish routes. Fuel cost per kilometre fell for the third month running, so the gross margin holds at 64%.",
    },
    {
      id: "runway",
      name: "Cash runway",
      meta: "Updated 2 days ago · finance",
      summary:
        "At the current burn there are 17 months of runway. Collecting the two overdue invoices would add five weeks without new revenue.",
    },
    {
      id: "fleet",
      name: "Fleet cost report",
      meta: "Updated last week · operations",
      summary:
        "Nineteen vehicles are leased on the old contract. Moving the four oldest to the 2027 terms saves roughly €1.8k a month from January.",
    },
  ],
  timeline: [
    {
      id: "nw-1",
      kind: "note",
      when: "today",
      actor: { name: "Lena Hart" },
      parts: [
        { text: "CFO wants every figure in the " },
        { mention: "Monthly P&L" },
        { text: " in EUR, also for the Danish entity – no converted totals." },
      ],
    },
    {
      id: "nw-2",
      kind: "report",
      when: "1d ago",
      actor: { name: "Jonas Weber" },
      report: "Monthly P&L",
    },
    {
      id: "nw-3",
      kind: "files",
      when: "2d ago",
      actor: { name: "Jonas Weber" },
      files: [
        { name: "budget-2027.pdf", kind: "pdf" },
        { name: "fleet-costs-Q3.xlsx", kind: "xlsx" },
      ],
    },
    {
      id: "nw-4",
      kind: "note",
      when: "4d ago",
      actor: { name: "Lena Hart" },
      parts: [
        {
          text: "Renewal talks start in November. They'll ask for a lower rate if the Nordics pilot slips – keep the ",
        },
        { mention: "Cash runway" },
        { text: " current." },
      ],
    },
    { id: "nw-5", kind: "integration", when: "1w ago", app: "Stripe", brand: "stripe" },
  ],
  financials: [
    {
      id: "revenue",
      label: "Recurring revenue",
      meta: "Invoiced this month · all entities",
      value: "€48.2k",
      delta: "+6.4%",
      trend: "up",
      series: [41.2, 42.3, 41.7, 43.3, 43.9, 43.3, 45, 46.1, 46.6, 48.2],
      color: "#2f6bff",
      included: true,
    },
    {
      id: "cash",
      label: "Cash and equivalents",
      meta: "Across four accounts",
      value: "€612k",
      delta: "-1.8%",
      trend: "down",
      series: [612, 597, 597, 568, 553, 568, 524, 509, 495, 480],
      color: "#0ea5e9",
      included: true,
    },
    {
      id: "margin",
      label: "Gross margin",
      meta: "Rolling three months",
      value: "64.1%",
      delta: "+1.6 pts",
      trend: "up",
      series: [61, 61.8, 61, 62.6, 61.8, 63.3, 62.6, 63.3, 64.1, 64.1],
      color: "#8b5cf6",
      included: true,
    },
    {
      id: "burn",
      label: "Net burn",
      meta: "Trailing 30 days",
      value: "€36.0k",
      delta: "-4.2%",
      trend: "up",
      series: [36, 35.4, 36.2, 34.6, 34, 33.4, 34, 32, 31.4, 30.8],
      color: "#ec4899",
      included: false,
    },
  ],
  settings: [
    {
      id: "stripe",
      label: "Stripe is connected",
      meta: "Connected 1 March · read-only key",
      on: true,
      icon: "stripe",
    },
    {
      id: "sync",
      label: "Sync Stripe nightly",
      meta: "Invoices, subscriptions and payouts land before 06:00 CET",
      on: true,
      icon: "sync",
    },
    {
      id: "digest",
      label: "Weekly summary email",
      meta: "Every Monday, the open items and the numbers that moved",
      on: true,
      icon: "mail",
    },
    {
      id: "consolidate",
      label: "Roll up subsidiaries in EUR",
      meta: "Danish and Swedish entities convert at the month-end rate",
      on: false,
      icon: "report",
    },
  ],
};

const kestrel: CxClient = {
  id: "kestrel",
  name: "Kestrel Foods",
  meta: "Kestrel Foods ApS · DKK · Fiscal year ends Jun 30",
  mark: "K",
  color: "#0f766e",
  ink: "#ffffff",
  kpis: [
    {
      id: "mrr",
      label: "MRR",
      value: "DKK 291k",
      trend: [244, 251, 258, 254, 263, 271, 268, 279, 285, 291],
      color: "#0f766e",
    },
    {
      id: "cash",
      label: "Cash",
      value: "DKK 1.4M",
      trend: [1520, 1498, 1504, 1462, 1441, 1450, 1408, 1391, 1384, 1370],
      color: "#0ea5e9",
    },
    {
      id: "margin",
      label: "Gross margin",
      value: "38.4%",
      trend: [34.1, 34.8, 35.2, 35, 36.1, 36.4, 37.2, 37.1, 38, 38.4],
      color: "#8b5cf6",
    },
    {
      id: "burn",
      label: "Net burn",
      value: "DKK 94k",
      trend: [118, 114, 112, 108, 106, 101, 99, 97, 96, 94],
      color: "#ec4899",
    },
  ],
  reports: [
    {
      id: "basket",
      name: "Basket mix",
      meta: "Updated 3 days ago · category · 8 pages",
      summary:
        "Own-label lines now carry 22% of basket value. The chilled salads are the fastest grower, mostly at the expense of the deli counter.",
    },
    {
      id: "logistics",
      name: "Cold-chain cost",
      meta: "Updated last week · operations",
    },
  ],
  timeline: [
    {
      id: "kf-1",
      kind: "note",
      when: "yesterday",
      actor: { name: "Priya Raman" },
      parts: [
        { text: "Buyer asked for own-label pricing by the end of the month – start from the " },
        { mention: "Basket mix" },
        { text: " numbers, not the supplier list." },
      ],
    },
    {
      id: "kf-2",
      kind: "report",
      when: "3d ago",
      actor: { name: "Jonas Weber" },
      report: "Basket mix",
    },
    {
      id: "kf-3",
      kind: "files",
      when: "1w ago",
      actor: { name: "Priya Raman" },
      files: [{ name: "own-label-terms.pdf", kind: "pdf" }],
    },
  ],
  financials: [
    {
      id: "revenue",
      label: "Recurring revenue",
      meta: "Invoiced this month · DKK",
      value: "DKK 291k",
      delta: "+2.1%",
      trend: "up",
      series: [244, 251, 258, 254, 263, 271, 268, 279, 285, 291],
      color: "#0f766e",
      included: true,
    },
    {
      id: "margin",
      label: "Gross margin",
      meta: "Rolling three months",
      value: "38.4%",
      delta: "+0.4 pts",
      trend: "up",
      series: [34.1, 34.8, 35.2, 35, 36.1, 36.4, 37.2, 37.1, 38, 38.4],
      color: "#8b5cf6",
      included: true,
    },
    {
      id: "burn",
      label: "Net burn",
      meta: "Trailing 30 days",
      value: "DKK 94k",
      delta: "-2.1%",
      trend: "up",
      series: [118, 114, 112, 108, 106, 101, 99, 97, 96, 94],
      color: "#ec4899",
      included: false,
    },
  ],
  settings: [
    {
      id: "digest",
      label: "Weekly summary email",
      meta: "Every Monday, the open items and the numbers that moved",
      on: true,
      icon: "mail",
    },
  ],
};

export default function Demo() {
  const [clients, setClients] = useState<CxClient[]>([northwind, kestrel]);
  const [notes, setNotes] = useState<string[]>([]);

  return (
    <div style={{ width: "100%", maxWidth: 940, margin: "0 auto" }}>
      <ClientContext
        clients={clients}
        me={{ name: "Lena Hart" }}
        syncedAt="3m ago"
        onAddNote={(clientId, text, files: CxFile[]) =>
          setNotes((prev) => [
            `${clientId}: ${text || `${files.length} file(s)`}`.slice(0, 90),
            ...prev.slice(0, 2),
          ])
        }
        onOpenReport={(clientId, reportId) =>
          setNotes((prev) => [`Opened ${reportId} on ${clientId}`, ...prev.slice(0, 2)])
        }
        onCreateClient={(name) =>
          setClients((prev) => [
            ...prev,
            {
              id: `new-${prev.length + 1}`,
              name,
              meta: `${name} · EUR · Fiscal year ends Dec 31`,
              mark: name.trim().charAt(0).toUpperCase() || "N",
              color: "#6d28d9",
              ink: "#ffffff",
              kpis: [],
              timeline: [],
              reports: [],
              financials: [],
              settings: northwind.settings,
            },
          ])
        }
      />
      {notes.length > 0 ? (
        <p
          style={{
            margin: "10px 4px 0",
            fontSize: 12,
            opacity: 0.65,
          }}
        >
          {notes.join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
