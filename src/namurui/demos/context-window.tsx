import { useState } from "react";
import { ContextWindow, type ContextPart } from "../context-window";

const LIMIT = 200_000;

/* The session the demo opens with: a long conversation, three files pinned to it. */
const session = (conversation: number): ContextPart[] => [
  { id: "system", label: "System prompt", tokens: 4200 },
  { id: "tools", label: "Tools", tokens: 12_800 },
  {
    id: "files",
    label: "Files",
    items: [
      { id: "schema", label: "schema.prisma", tokens: 9400 },
      { id: "billing", label: "billing.ts", tokens: 21_300 },
      { id: "notes", label: "meeting-notes.md", tokens: 15_400 },
    ],
  },
  { id: "conversation", label: "Conversation", tokens: conversation, compactable: true },
  { id: "memory", label: "Memory", tokens: 3900 },
];

export default function Demo() {
  const [parts, setParts] = useState<ContextPart[]>(() => session(108_600));

  return (
    <ContextWindow
      limit={LIMIT}
      parts={parts}
      onRemove={(part, item) =>
        setParts((current) =>
          current.map((entry) =>
            entry.id === part.id
              ? { ...entry, items: (entry.items ?? []).filter((file) => file.id !== item.id) }
              : entry,
          ),
        )
      }
      onCompact={(part) => {
        /* Summarising the history takes a moment; the cells keep waving until it lands. */
        return new Promise<void>((resolve) => {
          window.setTimeout(() => {
            setParts((current) =>
              current.map((entry) =>
                entry.id === part.id ? { ...entry, tokens: 24_000 } : entry,
              ),
            );
            resolve();
          }, 900);
        });
      }}
      action={{ label: "New chat", onClick: () => setParts(session(1200)) }}
    />
  );
}
