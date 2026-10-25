import { useState } from "react";
import { MemoryPanel, type Memory } from "../memory-panel";

const seed: Memory[] = [
  {
    id: "ts",
    text: "Prefers TypeScript examples over plain JavaScript",
    category: "Preferences",
    source: "From chat",
    date: "Oct 12",
  },
  {
    id: "short",
    text: "Likes short answers first, details only when asked",
    category: "Preferences",
    source: "You added",
    date: "Oct 2",
    paused: true,
  },
  {
    id: "inter",
    text: "Designs with Inter and a 4px spacing grid",
    category: "Preferences",
    source: "From Figma",
    date: "Oct 7",
  },
  {
    id: "role",
    text: "Product designer and front-end developer at a small studio",
    category: "Work",
    source: "From chat",
    date: "Sep 28",
  },
  {
    id: "stack",
    text: "Ships with React, Vite and Tailwind; deploys on Vercel",
    category: "Work",
    source: "From chat",
    date: "Oct 3",
  },
  {
    id: "notes",
    text: "Sends release notes to clients every Friday",
    category: "Work",
    source: "From chat",
    date: "Oct 9",
  },
  {
    id: "fintech",
    text: "Redesigning the onboarding flow for a fintech client, due Oct 24",
    category: "Projects",
    source: "From chat",
    date: "Oct 11",
  },
  {
    id: "tokens",
    text: "Keeps design tokens in one tokens.json shared with the code",
    category: "Projects",
    source: "From chat",
    date: "Oct 5",
  },
];

export default function Demo() {
  const [memories, setMemories] = useState<Memory[]>(seed);
  const [log, setLog] = useState("What the assistant learned about Wren — hover a row for its actions.");

  return (
    <div style={{ display: "grid", gap: 10, width: "100%", maxWidth: 400 }}>
      <MemoryPanel
        memories={memories}
        onChange={setMemories}
        maxHeight={330}
        onEdit={(id, text) => setLog(`Saved “${text}”`)}
        onPause={(id, paused) => {
          const memory = memories.find((entry) => entry.id === id);
          setLog(`${paused ? "Paused" : "Resumed"} “${memory?.text ?? id}” — ${paused ? "kept, not used in answers" : "used in answers again"}`);
        }}
        onForget={(id) => {
          const memory = memories.find((entry) => entry.id === id);
          setLog(`Forgot “${memory?.text ?? id}” — Undo puts it back where it was`);
        }}
        onUndo={(memory) => setLog(`Restored “${memory.text}” to ${memory.category}`)}
        onAdd={(memory) => setLog(`Added “${memory.text}” to ${memory.category}`)}
      />
      <p style={{ margin: 0, fontSize: 12, lineHeight: "16px", color: "#6b6b6b" }}>{log}</p>
    </div>
  );
}
