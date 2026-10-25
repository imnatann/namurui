import { useState } from "react";
import { InvoiceCredit, type CreditLine, type InvoiceLine } from "../invoice-credit";

const lines: InvoiceLine[] = [
  { id: "growth", name: "Growth plan", qty: 1, rate: 1250, tax: 0.2 },
  { id: "seats", name: "Extra seats", qty: 12, rate: 40, tax: 0.2 },
  { id: "api", name: "API calls (per 1k)", qty: 18420, rate: 0.42, tax: 0.2, group: "Metered usage" },
];

const money = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function Demo() {
  const [receipt, setReceipt] = useState<string | null>(null);

  return (
    <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: 760 }}>
      <InvoiceCredit
        seller={{
          name: "Lumen Labs, Inc.",
          lines: ["48 Harbour Street", "Bristol", "BS1 4RN", "United Kingdom"],
        }}
        buyer={{
          name: "Northwind Logistics GmbH",
          lines: ["Speicherstraße 12", "Hamburg", "20457", "Germany"],
        }}
        invoiceNo="INV-2041"
        creditNo="CN-0117"
        invoiceDate="1 Oct 2026"
        dueDate="31 Oct 2026"
        period="1 Sep – 30 Sep 2026"
        lines={lines}
        onIssue={(credited: CreditLine[], total: number) =>
          setReceipt(
            `CN-0117 issued for ${money(total)} — ${credited
              .map((line) => `${line.name} ${money(line.amount)}`)
              .join(", ")}`,
          )
        }
        onDownload={(doc) => setReceipt(doc === "invoice" ? "Preparing INV-2041.pdf" : "Preparing CN-0117.pdf")}
      />
      <p
        role="status"
        style={{
          margin: 0,
          padding: "10px 14px",
          borderRadius: 10,
          background: "var(--panel)",
          boxShadow: "inset 0 0 0 1px var(--border)",
          font: "400 12.5px/1.5 Inter, system-ui, sans-serif",
          color: "var(--text-muted)",
          minHeight: 40,
        }}
      >
        {receipt ?? "Switch to the credit note to pick lines and adjust what gets credited."}
      </p>
    </div>
  );
}
