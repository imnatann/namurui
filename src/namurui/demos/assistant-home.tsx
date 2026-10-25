import { useEffect, useRef, useState } from "react";
import {
  AssistantHomeScreen,
  type AssistantMessage,
  type AssistantSendOptions,
} from "../assistant-home";

const MODEL_NAMES: Record<string, string> = {
  auto: "Auto",
  fast: "Fast",
  reasoning: "Reasoning",
};

const REPLIES: { match: RegExp; text: string }[] = [
  {
    match: /deck|slide|presentation/,
    text: "Here is an outline: where the quarter landed, what moved it, and the three bets for next. Say the word and I will build the slides in Q3 Campaign.",
  },
  {
    match: /table|metrics|column|chart|signups/,
    text: "I put the numbers in a table with owner, date and channel, and charted signups by week. Want a variance column against the plan?",
  },
  {
    match: /image|hero|visual/,
    text: "Two directions: a soft gradient with the product in frame, or a studio still on paper. Which one should I take to final?",
  },
  {
    match: /research|competitor/,
    text: "Three competitors lead with \u201cteammate\u201d and two with \u201cworkspace\u201d. Nobody covers the handoff between agents well, which is the opening I would take.",
  },
  {
    match: /handbook|time off|knowledge|policy/,
    text: "Our handbook gives 25 days plus local holidays, and asks for two weeks of notice on anything longer than a week.",
  },
];

export default function Demo() {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [status, setStatus] = useState("Type a prompt, pick a suggestion, or open one of the tools");
  const turn = useRef(0);
  const generation = useRef(0);
  const pending = useRef<number[]>([]);

  // Replies in flight belong to the thread they were sent to
  useEffect(
    () => () => {
      pending.current.forEach((timer) => window.clearTimeout(timer));
      pending.current = [];
    },
    [],
  );

  const send = (text: string, options: AssistantSendOptions) => {
    turn.current += 1;
    const id = `user-${turn.current}`;
    const where = options.folder ? " in a folder" : "";
    setStatus(`Sent to ${MODEL_NAMES[options.model] ?? options.model}${where}`);

    setMessages((prev) => [...prev, { id, role: "user", text }]);

    const scope = generation.current;
    const reply = REPLIES.find((entry) => entry.match.test(text.toLowerCase()))?.text ?? null;
    if (!reply) return;

    const timer = window.setTimeout(() => {
      pending.current = pending.current.filter((entry) => entry !== timer);
      if (generation.current !== scope) return;
      turn.current += 1;
      setMessages((prev) => [
        ...prev,
        { id: `assistant-${turn.current}`, role: "assistant", text: reply },
      ]);
      setStatus("The assistant replied · press New chat to start over");
    }, 700);
    pending.current.push(timer);
  };

  return (
    <div style={{ width: "100%", display: "grid", gap: 10, justifyItems: "center" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 1100,
          height: 680,
          overflow: "hidden",
          borderRadius: 18,
          border: "1px solid var(--border)",
          background: "var(--bg)",
          boxShadow: "0 1px 2px #0000000a, 0 12px 40px #0000000f",
        }}
      >
        <AssistantHomeScreen
          workspace="Acme"
          user={{ name: "Alex Morgan" }}
          messages={messages}
          onSend={send}
          onModelChange={(id) => setStatus(`Model set to ${MODEL_NAMES[id] ?? id}`)}
          onNavigate={(label) => setStatus(`Opened ${label}`)}
          onNewChat={() => {
            generation.current += 1;
            pending.current.forEach((timer) => window.clearTimeout(timer));
            pending.current = [];
            setMessages([]);
            setStatus("New chat · the thread is cleared");
          }}
          onSearch={() => setStatus("Search opened")}
          onWorkspace={() => setStatus("Workspace switcher opened")}
          onAccount={() => setStatus("Account menu opened")}
          onInvite={() => setStatus("Invite people opened")}
          onOpenGuide={() => setStatus("Getting started opened")}
          onOpenChangelog={() => setStatus("Full changelog opened")}
          onDismissNews={() => setStatus("Changelog card dismissed")}
          onDictate={(listening) => setStatus(listening ? "Listening" : "Dictation stopped")}
        />
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }} role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
