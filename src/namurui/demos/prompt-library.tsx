import { useState } from "react";
import { PromptLibrary, type PromptTemplate } from "../prompt-library";

/* The four templates the reference library ships with. Only the tone starts filled, so the
 * library opens at 1 of 4 and the first three blanks invite a click. */
const TEMPLATES: PromptTemplate[] = [
  {
    id: "meeting",
    title: "Summarize a meeting",
    category: "Notes",
    tone: "blue",
    body: "Summarize the meeting notes below for {audience}. Keep it to {length}, list every decision and name who owns each one.",
    variables: {
      audience: { description: "Who reads the summary", default: "the product team" },
      length: { description: "How long it should run", default: "120 words" },
    },
  },
  {
    id: "release",
    title: "Write release notes",
    category: "Product",
    tone: "violet",
    body: "Write release notes for {product} {version} for {audience}. Keep the tone {tone} and group the changes into New, Improved and Fixed.",
    variables: {
      product: { description: "Name of the product" },
      version: { description: "Version number, e.g. 2.4" },
      audience: { description: "Who reads the notes" },
      tone: { description: "How it should sound", default: "friendly" },
    },
  },
  {
    id: "error",
    title: "Explain an error",
    category: "Debug",
    tone: "amber",
    body: "Explain this {language} error in plain words, then give the smallest change that fixes it: {error}.",
    variables: {
      language: { description: "Language or framework", default: "TypeScript" },
      error: { description: "Paste the message or stack trace" },
    },
  },
  {
    id: "outreach",
    title: "Draft a cold email",
    category: "Sales",
    tone: "green",
    body: "Write a {length} cold email to {person} at {company}. Open with {hook} and close with one easy question.",
    variables: {
      length: { description: "How long the email should be", default: "three-sentence" },
      person: { description: "Who you are writing to", default: "Maya" },
      company: { description: "Their company" },
      hook: { description: "The specific thing you noticed" },
    },
  },
];

export default function Demo() {
  const [id, setId] = useState("release");
  const [last, setLast] = useState<string | null>(null);

  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "center", width: "100%" }}>
      <PromptLibrary
        templates={TEMPLATES}
        value={id}
        onSelect={setId}
        onUse={(prompt) => setLast(prompt)}
        onCopy={(prompt) => setLast(prompt)}
      />

      {last ? (
        <p
          style={{
            margin: 0,
            maxWidth: 520,
            font: "12.5px/1.5 Inter, ui-sans-serif, system-ui, sans-serif",
            color: "var(--text-muted)",
            textAlign: "center",
          }}
        >
          Last prompt · {last.length} characters
        </p>
      ) : null}
    </div>
  );
}
