import { useState } from "react";
import { EmailDraft, type DraftTone } from "../email-draft";

const contacts = [
  { name: "Jonas Weber", email: "jonas@northwind.io" },
  { name: "Lena Hart", email: "lena@northwind.io" },
  { name: "Finance team", email: "billing@northwind.io" },
];

const tones: DraftTone[] = [
  {
    id: "friendly",
    label: "Friendly",
    body: (c) =>
      `Hi ${c.name.split(" ")[0]}, a heads-up that your Growth plan renews on October 9 for $8,900 a year. If you'd like to add seats or switch to monthly billing, the quote is below:`,
  },
  {
    id: "short",
    label: "Short",
    body: (c) =>
      `Hi ${c.name.split(" ")[0]}, your Growth plan renews on October 9 ($8,900/year). Quote for any changes:`,
  },
  {
    id: "formal",
    label: "Formal",
    body: (c) =>
      `Dear ${c.name}, this is a reminder that your Growth subscription renews on October 9 at $8,900 per year. Should you wish to adjust seats or billing, please review the attached quote:`,
  },
];

export default function Demo() {
  const [receipt, setReceipt] = useState<string | null>(null);

  return (
    <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: 520 }}>
      <EmailDraft
        reference="SUB-1182"
        account="Northwind Logistics"
        amount="$8,900"
        status="Renews in 5 days"
        agent="Renewal agent"
        contacts={contacts}
        attachment="Renewal-quote.pdf"
        tones={tones}
        link={{ label: "Review quote", href: "#quote-1182" }}
        onSend={(email) =>
          setReceipt(`Sent to ${email.to.name} · ${email.attachment ?? "no attachment"}`)
        }
        onDiscard={() => setReceipt("Draft discarded")}
      />

      <p role="status" style={{ margin: 0, fontSize: 12.5, color: "#8f8f8f" }}>
        {receipt ?? "Switch the recipient or the tone, edit a line, then send."}
      </p>
    </div>
  );
}
