import { useState } from "react";
import { FileMention, type FileMentionFile } from "../file-mention";

/* The four shapes a `fileMention` message actually carries: a source file OMP read whole,
 * a binary it refused to decode, a log past the size ceiling, and a JSON file whose line
 * count the bridge never sent. */
const FILES: readonly FileMentionFile[] = [
  {
    path: "src/bridge/rpc.ts",
    lineCount: 412,
    byteSize: 18_240,
    preview: [
      "export type Frame =",
      '  | { id: number; method: "prompt"; params: PromptParams }',
      '  | { id: number; method: "cancel"; params: { runId: string } };',
      "",
      "export function encode(frame: Frame): string {",
      "  return `${JSON.stringify(frame)}\\n`;",
      "}",
      "",
      "export function decode(line: string): Frame | null {",
      "  const trimmed = line.trim();",
      "  if (trimmed === \"\") return null;",
      "  return JSON.parse(trimmed);",
      "}",
    ].join("\n"),
  },
  {
    path: "public/favicon.ico",
    byteSize: 15_486,
    skippedReason: "binary",
  },
  {
    path: "~/.omp/sessions/2026-10-24-0912/workspace/bridge.log",
    byteSize: 8_821_145,
    skippedReason: "tooLarge",
  },
  {
    path: "affectui/src/namurui/styles/tokens/generated/ember-tokens.json",
    byteSize: 3_187,
  },
];

const control = {
  height: 28,
  padding: "0 10px",
  border: 0,
  borderRadius: 8,
  background: "transparent",
  boxShadow: "inset 0 0 0 1px var(--border, #e8e0d7)",
  color: "var(--text-muted, #6f625a)",
  font: "inherit",
  fontSize: 12,
  cursor: "pointer",
};

export default function Demo() {
  const [files, setFiles] = useState<readonly FileMentionFile[]>(FILES);
  const [opened, setOpened] = useState<string | null>(null);

  return (
    <div style={{ display: "grid", gap: 12, width: "100%", maxWidth: 560 }}>
      <p
        style={{
          margin: 0,
          fontSize: 11,
          lineHeight: "16px",
          color: "var(--text-muted, #6f625a)",
        }}
      >
        Attached to the prompt · {files.length} of {FILES.length} files
      </p>

      <FileMention
        files={files}
        onOpen={(path) => setOpened(path)}
        onRemove={(path) => {
          setFiles((current) => current.filter((file) => file.path !== path));
          setOpened((current) => (current === path ? null : current));
        }}
      />

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          style={control}
          onClick={() => {
            setFiles(FILES);
            setOpened(null);
          }}
        >
          Restore the four files
        </button>
        <span
          role="status"
          aria-live="polite"
          style={{ minWidth: 0, fontSize: 12, color: "var(--text-muted, #6f625a)" }}
        >
          {opened ? `Opening ${opened}` : "No file opened yet"}
        </span>
      </div>
    </div>
  );
}
