import { useState } from "react";
import { CitedAnswer, type CitedSentence, type CitedSource } from "../cited-answer";

const sources: CitedSource[] = [
  {
    id: "caching",
    name: "Tokenwise",
    glyph: "T",
    tone: "gray",
    title: "Prompt caching, explained: what gets stored and for how long",
    domain: "tokenwise.dev",
    href: "https://tokenwise.dev/blog/prompt-caching",
    date: "Sep 18, 2026",
    quote:
      "A cache hit reads the processed prefix instead of recomputing it, so the same system prompt and tool definitions cost a fraction of their first price. Cached reads are billed at 25% of the standard input rate.",
    marks: ["reads the processed prefix instead of recomputing it", "25% of the standard input rate"],
  },
  {
    id: "prompts",
    name: "Latency Notes",
    glyph: "L",
    tone: "green",
    title: "Designing cache-friendly prompts",
    domain: "latencynotes.io",
    href: "https://latencynotes.io/cache-friendly-prompts",
    date: "Aug 2, 2026",
    quote:
      "Keep the stable part – system prompt, tool definitions, long documents – at the very start, and put anything that changes per request after it. A single changed character early on invalidates everything behind it.",
    marks: ["at the very start", "anything that changes per request", "invalidates"],
  },
  {
    id: "semantic",
    name: "Inference Weekly",
    glyph: "I",
    tone: "green",
    title: "Semantic caching for LLM apps in production",
    domain: "inferenceweekly.com",
    href: "https://inferenceweekly.com/semantic-caching",
    date: "Jul 14, 2026",
    quote:
      "Close matches return a stored answer in about 40 ms, and in one deployment that covered close to a third of FAQ-style traffic. Stream the remaining requests so people see the first words while the answer is still being written.",
    marks: ["about 40 ms", "a third of FAQ-style traffic", "first words"],
  },
];

const sentences: CitedSentence[] = [
  {
    text: "The biggest win is prompt caching: the provider reuses the processed start of your prompt, so a long system prompt isn't recomputed on every call.",
    cites: ["caching"],
  },
  {
    text: "On prompts over 10K tokens that can cut time to first token by up to 80%.",
    cites: ["caching"],
  },
  {
    text: "It only works while that start stays identical, so put the system prompt, tools and long documents first and anything that changes per request last.",
    cites: ["prompts", "caching"],
  },
  {
    text: "For repeated questions, add a semantic cache in front of the model: close matches get a stored answer in about 40 ms,",
    cites: ["semantic"],
    newParagraph: true,
  },
  {
    text: "which covered nearly a third of FAQ-style traffic in one production setup.",
    cites: ["semantic"],
  },
  {
    text: "Stream the rest, so people see the first words while the answer is still being written.",
  },
];

export default function Demo() {
  const [open, setOpen] = useState<string | null>("prompts");
  const [note, setNote] = useState("");

  return (
    <div style={{ display: "grid", width: "100%", maxWidth: 460, justifyItems: "stretch", gap: 12 }}>
      <CitedAnswer
        sentences={sentences}
        sources={sources}
        pagesRead={12}
        openSource={open}
        onOpenSourceChange={(id) => {
          setOpen(id);
          setNote("");
        }}
        onCopyQuote={(source) => setNote(`Quote from ${source.name} copied`)}
        action={{ label: "Follow up", onClick: () => setNote("Follow-up composer opened") }}
      />
      <p
        role="status"
        style={{
          margin: 0,
          font: "400 12px/18px Inter, system-ui, sans-serif",
          color: "inherit",
          opacity: 0.55,
          minHeight: 18,
        }}
      >
        {note}
      </p>
    </div>
  );
}
