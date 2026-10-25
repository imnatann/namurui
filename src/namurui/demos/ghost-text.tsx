import { useState } from "react";
import { GhostText } from "../ghost-text";

/* A local vocabulary, so the demo's completion never leaves the page. */
const WORDS = [
  "checkpoint",
  "compaction",
  "keybinding",
  "prediction",
  "sandbox",
  "streaming",
  "terminal",
  "transcript",
  "workspace",
];

const PATHS = [
  "src/namurui/ghost-text.tsx",
  "src/namurui/demos/ghost-text.tsx",
  "src/gallery/registry.ts",
  "docs/protocol.md",
];

/* The last word of the text, completed from the list; nothing before four letters. */
function completeWord(text: string): string {
  const tail = /([A-Za-z]{4,})$/.exec(text);
  if (!tail) return "";
  const typed = tail[1].toLowerCase();
  const hit = WORDS.find((word) => word.startsWith(typed) && word.length > typed.length);
  return hit ? hit.slice(typed.length) : "";
}

function completePath(text: string): string {
  if (text.length < 4) return "";
  const hit = PATHS.find((path) => path.startsWith(text) && path.length > text.length);
  return hit ? hit.slice(text.length) : "";
}

const note = {
  margin: 0,
  color: "var(--text-muted, #6f625a)",
  fontSize: 12,
  lineHeight: "18px",
};

export default function Demo() {
  const [message, setMessage] = useState("");
  const [word, setWord] = useState("");
  const [accepted, setAccepted] = useState("");

  const [target, setTarget] = useState("src/namurui/");
  const [path, setPath] = useState("");

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 620 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <GhostText
          value={message}
          suggestion={word}
          placeholder="Ask the agent to…"
          onChange={(next) => {
            setMessage(next);
            setWord(completeWord(next));
            setAccepted("");
          }}
          onAccept={(suffix) => {
            setWord("");
            setAccepted(suffix);
          }}
          onDismiss={() => setWord("")}
        />
        <p style={note}>
          {accepted
            ? `Tab took “${accepted}” and the caret is after it.`
            : "Type four letters of a word — prediction, terminal, workspace — and Tab takes the rest."}
        </p>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <GhostText
          value={target}
          suggestion={path}
          multiline={false}
          placeholder="src/…"
          onChange={(next) => {
            setTarget(next);
            setPath(completePath(next));
          }}
          onAccept={() => setPath("")}
          onDismiss={() => setPath("")}
        />
        <p style={note}>Single line: the same mirror, no wrapping, Tab takes the path.</p>
      </div>
    </div>
  );
}
