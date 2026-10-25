import { useState } from "react";
import { ReviewCenter, type CenterReviewItem, type ReviewResult } from "../review-center";

const MINUTE = 60_000;
const start = Date.now();

/* The reference queue: eight waiting items, high risk first and oldest first inside a risk. */
const SEED: CenterReviewItem[] = [
  {
    id: "merge-511",
    title: "Merge #511 – retries for webhook delivery",
    agent: "Coder",
    model: "GPT-6 Sol",
    logo: "openai",
    type: "Code change",
    risk: "high",
    confidence: 0.41,
    createdAt: start - 28 * MINUTE,
    why: "Deliveries time out under load – I added retries with backoff. Tests pass.",
    files: [
      {
        path: "src/webhooks/deliver.ts",
        added: 3,
        removed: 2,
        lines: [
          {
            kind: "ctx",
            n: 38,
            src: [{ tok: "kw", text: "const" }, " endpoint = ", { tok: "kw", text: "await" }, " ", { tok: "fn", text: "getEndpoint" }, "(event.accountId);"],
          },
          {
            kind: "del",
            n: 39,
            src: [
              {
                flag: "if (!endpoint) return;",
                note: "Removed the null check – paused accounts have no endpoint, so this now throws for them.",
                source: "accounts.paused · 214 rows",
              },
            ],
          },
          { kind: "add", n: 39, src: [{ tok: "com", text: "// endpoint is always set for active accounts" }] },
          {
            kind: "ctx",
            n: 40,
            src: [
              { tok: "kw", text: "const" },
              " body = ",
              { tok: "kw", text: "JSON" },
              ".",
              { tok: "fn", text: "stringify" },
              "(event.payload);",
            ],
          },
          {
            kind: "del",
            n: 41,
            src: [{ tok: "kw", text: "for" }, " (", { tok: "kw", text: "let" }, " i = 0; i < 3; i++) {"],
          },
          {
            kind: "add",
            n: 41,
            src: [
              { tok: "kw", text: "for" },
              " (",
              { tok: "kw", text: "let" },
              " i = 0;",
              { flag: "i < 10", note: "Ten tries is 30× the old load on Stripe. Staging never got past four." },
              "; i++) {",
            ],
          },
          {
            kind: "ctx",
            n: 42,
            src: [
              { tok: "kw", text: "const" },
              " res = ",
              { tok: "kw", text: "await" },
              " ",
              { tok: "fn", text: "post" },
              "(endpoint.url, body);",
            ],
          },
          {
            kind: "add",
            n: 43,
            src: [{ tok: "kw", text: "await" }, " ", { tok: "fn", text: "sleep" }, "(250 * 2 ** i);"],
          },
        ],
      },
      { path: "src/webhooks/deliver.test.ts", added: 14, removed: 0 },
      { path: "src/queue/config.ts", added: 1, removed: 1 },
    ],
    sources: [
      { label: "PR #511", mark: "github" },
      { label: "CI run 1204", mark: "github" },
    ],
  },
  {
    id: "redline-7-2",
    title: "Redline §7.2 Limitation of liability",
    agent: "Legal agent",
    model: "Opus 5.5",
    type: "Contract clause",
    risk: "high",
    confidence: 0.58,
    createdAt: start - 18 * MINUTE,
    why: "Northwind asked for unlimited liability. The playbook caps it at 12 months of fees, so I kept the cap and added the carve-outs they usually accept.",
    body: {
      label: "Redlined clause",
      text: [
        "Each party's total liability under this Agreement is limited to the fees paid in the ",
        {
          flag: "12 months",
          note: "The playbook says 12 months for deals above $200k and 6 months below. This deal is $240k.",
          source: "Legal playbook · §3.1",
        },
        " before the claim, except for breaches of confidentiality, ",
        {
          flag: "gross negligence",
          note: "Northwind's paper says wilful misconduct. Ours has only gross negligence, so this is the gap.",
          source: "Northwind MSA v3 · §11",
        },
        " and indemnity obligations.",
      ],
    },
    sources: [
      { label: "Northwind MSA v3", mark: "notion" },
      { label: "Legal playbook", mark: "notion" },
      { label: "Deal · $240k" },
    ],
  },
  {
    id: "split-name",
    title: "Split customers.name into first and last name",
    agent: "Migration agent",
    model: "Opus 5.5",
    type: "Migration",
    risk: "medium",
    confidence: 0.64,
    createdAt: start - 14 * MINUTE,
    why: "The new billing provider needs both halves. One dry run on staging moved 38,204 rows with no mismatches.",
    steps: [
      {
        title: "Add the two columns",
        tool: "postgres",
        detail: ["Nullable, no default, so the deploy does not lock the table."],
      },
      {
        title: "Backfill from name",
        tool: "postgres",
        detail: [
          "Splits on the last space. ",
          {
            flag: "38,204 rows",
            note: "412 rows have a single word, and 7 use a comma instead of a space. Those keep the whole string as the first name.",
            source: "customers · 38,204 rows",
          },
        ],
      },
      {
        title: "Drop name",
        tool: "postgres",
        detail: ["Blocked until the API is on the new fields. Scheduled for Thursday."],
      },
    ],
  },
  {
    id: "rotate-stripe-keys",
    title: "Rotate the Stripe API keys",
    agent: "Ops agent",
    model: "Sonnet 5.5",
    type: "Plan",
    risk: "medium",
    confidence: 0.72,
    createdAt: start - 11 * MINUTE,
    why: "The old key was pasted in #eng-general in March. I checked every service that reads STRIPE_SECRET and none of them cache the client.",
    steps: [
      { title: "Create the replacement key", tool: "stripe", detail: ["Restricted to the four scopes we call."] },
      { title: "Write it to both clusters", tool: "vault", detail: ["Staging first, then production 30 minutes later."] },
      {
        title: "Roll the webhook workers",
        tool: "kubectl",
        detail: [
          "Rolling restart, one pod at a time. ",
          {
            flag: "zero downtime",
            note: "Two workers hold a long-lived client for up to 60s. The old key stays valid for 24h after the swap.",
            source: "queue workers · 12 pods",
          },
        ],
      },
      { title: "Revoke the old key", tool: "stripe", detail: ["Next day, after the dashboards are flat."] },
    ],
  },
  {
    id: "refund-4821",
    title: "Refund order #4821 for Maya Chen",
    agent: "Support agent",
    model: "Sonnet 5.5",
    type: "Refund",
    risk: "medium",
    confidence: 0.62,
    createdAt: start - 9 * MINUTE,
    why: "Her blender arrived cracked. Damaged items are covered inside 30 days, and she wrote in on day 6.",
    fields: [
      { label: "Order", value: ["#4821"] },
      { label: "Amount", value: ["$184.00"] },
      { label: "Paid with", value: ["Visa ···· 4242"] },
    ],
    body: {
      label: "Reply to Maya",
      text: [
        "Hi Maya,\n\nI'm sorry the blender arrived cracked. I've refunded the full $184.00 to your card, which usually lands within 3–5 working days.\n\nYou can keep the damaged one – no need to ship it back.",
      ],
    },
    sources: [{ label: "Refund policy", mark: "notion" }],
  },
  {
    id: "tag-billing",
    title: "Tag 14 tickets as Billing",
    agent: "Triage agent",
    model: "Gemini 3.8 Flash",
    type: "Triage",
    risk: "low",
    confidence: 0.97,
    createdAt: start - 6 * MINUTE,
    why: "Every one of them mentions an invoice, a charge or a receipt, and none already carry Billing.",
    steps: [
      { title: "Add the Billing tag", tool: "zendesk", detail: ["14 tickets, ids listed in the note."] },
      { title: "Leave the owner alone", tool: "zendesk", detail: ["Assignment stays with the current agent."] },
    ],
  },
  {
    id: "bump-stripe-js",
    title: "Bump @stripe/stripe-js to 4.2.1",
    agent: "Coder",
    model: "GPT-6 Sol",
    logo: "openai",
    type: "Code change",
    risk: "low",
    confidence: 0.95,
    createdAt: start - 4 * MINUTE,
    why: "Patch release, no API change. The lockfile moved one package and the checkout tests still pass.",
    files: [
      {
        path: "package.json",
        added: 1,
        removed: 1,
        lines: [
          { kind: "ctx", n: 24, src: ['    "@stripe/stripe-js": "4.1.0",'] },
          { kind: "add", n: 24, src: ['    "@stripe/stripe-js": "4.2.1",'] },
        ],
      },
    ],
    sources: [{ label: "PR #518", mark: "github" }],
  },
  {
    id: "release-notes",
    title: "Post release notes to #announcements",
    agent: "Release agent",
    model: "GPT-6 Sol",
    logo: "openai",
    type: "Slack message",
    risk: "low",
    confidence: 0.91,
    createdAt: start - 2 * MINUTE,
    why: "Drafted from the changelog since Tuesday's tag. Two entries are internal and I left them out.",
    body: {
      label: "Message",
      text: [
        "Shipped today:\n\n• Review Center – approve, edit, reject or skip what your agents propose.\n• Faster webhook delivery, with retries and backoff.\n• Stripe SDK 4.2.1.\n\nFull notes in the changelog.",
      ],
    },
    sources: [{ label: "#announcements", mark: "notion" }],
  },
];

export default function Demo() {
  const [items, setItems] = useState(SEED);
  const [reviewed, setReviewed] = useState(24);

  return (
    <ReviewCenter
      items={items}
      reviewed={reviewed}
      onDecide={(item: CenterReviewItem, result: ReviewResult) => {
        setItems((waiting) => waiting.filter((entry) => entry.id !== item.id));
        if (result.decision !== "skipped") setReviewed((count) => count + 1);
      }}
      onUndo={(item: CenterReviewItem) => {
        setItems((waiting) => (waiting.some((entry) => entry.id === item.id) ? waiting : [...waiting, item]));
        setReviewed((count) => Math.max(0, count - 1));
      }}
    />
  );
}
