import { AssistantMark, CommentThread, type ThreadMessage } from "../comment-thread";

const atlas = { name: "Atlas", avatar: <AssistantMark />, assistant: true };
const lena = { name: "Lena Hart" };
const jonas = { name: "Jonas Weber" };

const started = Date.now();

const messages: ThreadMessage[] = [
  {
    id: "c1",
    author: lena,
    createdAt: started - 42 * 60_000,
    text: "The enterprise tier copy reads like a spec sheet. Can the first line say who the tier is for, not what it includes?",
  },
  {
    id: "c2",
    author: atlas,
    createdAt: started - 38 * 60_000,
    text: "Done — the enterprise section now leads with the team it serves, then the controls.",
    status: "Updated 3 sections of the pricing page",
    details: [
      "Rewrote the enterprise intro around the support team",
      "Moved SSO and audit logs above the feature table",
      "Shortened the FAQ answer on changing seats",
    ],
  },
  {
    id: "c3",
    author: jonas,
    createdAt: started - 21 * 60_000,
    text: "@Atlas can you also add the migration note under the annual plan?",
  },
];

function wait(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

function reply(text: string): ThreadMessage | Promise<ThreadMessage> | void {
  if (!text.includes("@Atlas")) return;
  return wait(1400).then(() => ({
    id: `a-${Date.now()}`,
    author: atlas,
    createdAt: Date.now(),
    text: "Added it — the annual plan now carries a one-line migration note and links to the six-step checklist.",
    status: "Updated the annual plan section",
    details: [
      "Added the migration note above the comparison table",
      "Linked the six-step checklist",
      "Left the monthly plan unchanged",
    ],
  }));
}

export default function Demo() {
  return (
    <div style={{ display: "grid", gap: 12, width: "100%", maxWidth: 560 }}>
      <div style={{ display: "grid", gap: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#171717" }}>Pricing page · hero copy</span>
        <span style={{ fontSize: 12.5, color: "#8f8f8f" }}>
          Reply with @Atlas to ask for another change
        </span>
      </div>

      <CommentThread
        title="Pricing page"
        messages={messages}
        currentUser={lena}
        assistant={atlas}
        onReply={reply}
      />
    </div>
  );
}
