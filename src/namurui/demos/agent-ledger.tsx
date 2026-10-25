import { useState } from "react";
import { AgentLedger, type LedgerRow } from "../agent-ledger";

/* The marks the launch agent worked through. Monochrome brands take the ledger's ink, so they
   invert with the theme; Stripe keeps its brand square, as it does on the site. */
const ink = { color: "var(--ui-alc-strong, var(--ui-al-ink, #181717))" } as const;

function MarkNotion() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={ink}>
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
    </svg>
  );
}

function MarkStripe() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#635BFF" />
      <path
        d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z"
        fill="#fff"
        transform="translate(3.4 3.4) scale(.7)"
      />
    </svg>
  );
}

function MarkVercel() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={ink}>
      <path d="M12 3.4 22 20.6H2z" />
    </svg>
  );
}

function MarkGitHub() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={ink}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

/* The launch the agent ran, newest first. The coupon and the FAQ rewrite were built on the new
   price, and the deploy went out on top of the FAQ – so pointing at the price's Undo drags all
   of it, while the deploy can only be flagged: it is already out in the world. */
const launch = (started: number): LedgerRow[] => [
  {
    id: "faq",
    action: "Updated page",
    target: "Pricing FAQ",
    system: "Notion",
    at: started - 18_000,
    change: ["3 answers", "3 answers rewritten"],
    dependsOn: ["price"],
    icon: <MarkNotion />,
  },
  {
    id: "coupon",
    action: "Created coupon",
    target: "LAUNCH20",
    system: "Stripe",
    at: started - 42_000,
    detail: "20% off the first year · ends in 7 days",
    dependsOn: ["price"],
    icon: <MarkStripe />,
  },
  {
    id: "price",
    action: "Changed price",
    target: "Pro plan",
    system: "Stripe",
    at: started - 62_000,
    change: ["$29 / month", "$34 / month"],
    icon: <MarkStripe />,
  },
  {
    id: "deploy",
    action: "Deployed",
    target: "namurui.com",
    system: "Vercel",
    at: started - 74_000,
    change: ["#481", "#483 in production"],
    dependsOn: ["faq"],
    /* A deploy is out in the world – the ledger says so rather than offering a lie. */
    reversible: false,
    icon: <MarkVercel />,
  },
  {
    id: "merge",
    action: "Merged PR #482",
    target: "Pricing page v2",
    system: "GitHub",
    at: started - 126_000,
    change: ["pricing-v2", "main"],
    icon: <MarkGitHub />,
  },
];

let serial = 0;

export default function Demo() {
  const [startedAt] = useState(() => Date.now());
  const [rows, setRows] = useState<LedgerRow[]>(() => launch(startedAt));
  const [undone, setUndone] = useState<string[]>([]);

  /* Undoing files a receipt of its own, so the ledger keeps growing after a revert – the rows
     that went come back struck through, and a new line records that the agent put them back. */
  const revert = (ids: string[]) => {
    const labels = ids
      .map((id) => rows.find((row) => row.id === id))
      .filter((row): row is LedgerRow => Boolean(row))
      .map((row) => (row.target ? `${row.action} ${row.target}` : row.action));

    setUndone((list) => [...list, ...ids.filter((id) => !list.includes(id))]);

    serial += 1;
    setRows((list) => [
      ...list,
      {
        id: `revert-${serial}`,
        action: ids.length === 1 ? "Reverted" : `Reverted ${ids.length} changes`,
        target: labels[0],
        system: "Ledger",
        at: Date.now(),
        detail: labels.length > 1 ? labels.slice(1).join(" · ") : undefined,
        reversible: false,
      },
    ]);
  };

  return <AgentLedger rows={rows} agent="Launch agent" undone={undone} onUndo={revert} />;
}
