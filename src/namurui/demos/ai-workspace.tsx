import { AiWorkspace } from "../ai-workspace";

/*
 * The demo keeps the reference's own workspace: Brand Refresh in the breadcrumb, three
 * pinned assistants, four recents and the three starter chips. Only the answer is scripted –
 * the workspace types it into the transcript one tick at a time, like a real stream.
 */

const answers = [
  {
    match: ["interview", "notes", "summarize"],
    text: "Five interviews, one shift: everyone described the product by the outcome, never by the category.\n\n- Three of five could not name a competitor until prompted.\n- All five used the word “calm” for the current interface.\n- Two asked whether it works with the tools they already pay for.\n\nLead with the outcome and the calm, and name the integrations before the feature list.",
  },
  {
    match: ["tier", "compare"],
    text: "Across the three tiers the differences that actually decide a purchase are small.\n\n- Seats: 2, unlimited, unlimited.\n- Reporting: none, weekly digest, live dashboard.\n- Security: none, 2FA, SSO and audit history.\n\nEveryone who churned last year was on Starter and cited reporting. Moving the weekly digest down one tier removes the objection without touching price.",
  },
  {
    match: ["email", "announce"],
    text: "Subject: A simpler way to pay for what you use\n\nHi {{first_name}},\n\nToday we are moving to three plans, and the middle one now includes the reporting you have been asking for. Nothing changes for your current plan until your next renewal.\n\n- Starter – one workspace, two seats.\n- Growth – unlimited seats, usage reports, priority support.\n- Scale – everything in Growth plus SSO and audit history.\n\nIf the change lands badly for you, reply and we will move you back by hand.",
  },
];

const fallback =
  "I can work from the Brand Refresh material in this project. Tell me which part to open – the interview notes, the launch email or the pricing comparison – and I will start from there.";

export default function Demo() {
  return (
    <div style={{ width: "100%", maxWidth: 1100, margin: "0 auto" }}>
      <AiWorkspace
        respond={(prompt) => {
          const text = prompt.toLowerCase();
          const answer = answers.find((entry) => entry.match.some((word) => text.includes(word)));
          return answer?.text ?? fallback;
        }}
      />
    </div>
  );
}
