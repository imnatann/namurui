import { WritingAssistant } from "../writing-assistant";

const SUGGESTIONS = ["Polish my email", "Make it shorter", "Fix the tone", "Draft a reply"];

const REWRITES: { match: RegExp; reply: string }[] = [
  {
    match: /polish/i,
    reply:
      "Polished, keeping your voice: “Hi Priya — quick follow-up on the renewal. We can move the start date to the 12th, which gives your team the full week to sign. Let me know if that works.”",
  },
  {
    match: /short/i,
    reply:
      "Two sentences, same ask: “Hi Priya — following up on the renewal. We can move the start date to the 12th; does that still work for you?”",
  },
  {
    match: /tone/i,
    reply:
      "Firmer, still warm: “Hi Priya — I want to keep the renewal on track. The 12th is the latest date we can hold, so I’d appreciate a yes or a counter by Friday.”",
  },
  {
    match: /reply/i,
    reply:
      "Here’s a reply you can send as is: “Thanks for flagging this, Priya. The 12th works on our side — I’ll get the signed page back to you this afternoon and copy Dana on the handoff.”",
  },
];

export default function Demo() {
  return (
    <div style={{ display: "grid", width: "100%", maxWidth: 380, justifyItems: "stretch" }}>
      <WritingAssistant
        suggestions={SUGGESTIONS}
        placeholder="Ask anything…"
        onSend={async (message) => {
          const { promise, resolve } = Promise.withResolvers<void>();
          window.setTimeout(resolve, 520);
          await promise;
          const rewrite = REWRITES.find((entry) => entry.match.test(message));
          if (rewrite) return rewrite.reply;
          return `Here’s the tightened version: “${message
            .replace(/^(please\s+)?/i, "")
            .replace(/\s+/g, " ")
            .trim()}” — said in one breath, with the ask up front.`;
        }}
      />
    </div>
  );
}
