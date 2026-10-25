import { useState } from "react";
import type { CSSProperties } from "react";
import { SlashPalette, type SlashCommand } from "../slash-palette";

/* What `available_commands_update` reports for a session with a skill pack, an MCP server and an
 * editor extension installed. The names are the ones OMP actually exposes. */
const COMMANDS: SlashCommand[] = [
  { name: "compact", description: "Fold the transcript into a summary and free the window", argumentHint: "[focus]", source: "builtin" },
  { name: "model", description: "Switch the model this session runs on", argumentHint: "<name>", source: "builtin" },
  { name: "session", description: "List, resume or rename saved sessions", argumentHint: "[id]", source: "builtin" },
  { name: "btw", description: "Ask a side question without leaving the turn", argumentHint: "<question>", source: "builtin" },
  { name: "goal", description: "Set the outcome this run is measured against", argumentHint: "<outcome>", source: "builtin" },
  { name: "memory", description: "Read or edit what the agent keeps between sessions", argumentHint: "[add|forget]", source: "builtin" },
  { name: "review", description: "Run the reviewer over the working tree diff", argumentHint: "[paths]", source: "skill" },
  { name: "export", description: "Write the transcript out as markdown or JSON", argumentHint: "<format>", source: "builtin" },
  { name: "resume", description: "Reopen a session and continue from its last turn", argumentHint: "[last]", source: "builtin" },
  { name: "cost", description: "Show what this session has spent so far", source: "builtin" },
  { name: "pr-review", description: "Open the pull request that matches this branch", argumentHint: "<number>", source: "mcp" },
  { name: "open-editor", description: "Jump to the file under discussion in VS Code", argumentHint: "[file]", source: "extension" },
];

export default function Demo() {
  const [draft, setDraft] = useState("/");
  const [open, setOpen] = useState(true);
  const [picked, setPicked] = useState<SlashCommand | null>(null);

  /* The palette stays open while the line is one command word, as a composer would behave: the
   * first space ends the name and hands the rest to the command as arguments. */
  const change = (value: string) => {
    setDraft(value);
    setOpen(value.startsWith("/") && !value.slice(1).includes(" "));
  };

  /* With the palette dismissed, Enter still runs whatever was typed by name */
  const submit = () => {
    const name = draft.replace(/^\s*\/+/, "").split(/\s+/)[0];
    const command = COMMANDS.find((item) => item.name === name);
    if (command) setPicked(command);
  };

  return (
    <div style={stage}>
      <form
        style={composer}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div style={bar}>
          <span style={caret} aria-hidden="true">
            ›
          </span>
          <input
            style={field}
            value={draft}
            onChange={(event) => change(event.target.value)}
            aria-label="Composer"
            placeholder="Type / for commands"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" style={send}>
            Send
          </button>
        </div>

        {open ? (
          <SlashPalette
            commands={COMMANDS}
            query={draft}
            maxVisible={5}
            onPick={(command) => {
              setPicked(command);
              setDraft(`/${command.name} `);
              setOpen(false);
            }}
            onClose={() => setOpen(false)}
          />
        ) : (
          <button type="button" style={reopen} onClick={() => setOpen(true)}>
            Reopen the palette
          </button>
        )}
      </form>

      <p style={readout} role="status" aria-live="polite">
        {picked ? (
          <>
            Picked <code style={code}>/{picked.name}</code> — {picked.description}
          </>
        ) : (
          "Nothing picked yet. ↑↓ moves, ↵ runs, ⇥ completes and closes, esc closes."
        )}
      </p>
    </div>
  );
}

const mono = 'var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace)';

const stage: CSSProperties = { display: "grid", gap: 12, width: "100%", maxWidth: 560, margin: "0 auto", padding: "20px 0 28px" };

/* The bar the palette hangs from: one panel, the field on top, the list directly beneath it */
const composer: CSSProperties = { display: "grid", gap: 6, padding: 8, borderRadius: 18, background: "var(--panel, #1a1512)", boxShadow: "inset 0 0 0 1px var(--border, #33291f)" };

const bar: CSSProperties = { display: "flex", alignItems: "center", gap: 8, minHeight: 40, padding: "0 4px 0 8px" };

const caret: CSSProperties = { flex: "none", fontFamily: mono, fontSize: 13, color: "var(--text-muted, #a2958a)" };

const field: CSSProperties = { flex: 1, minWidth: 0, height: 28, border: 0, background: "transparent", color: "var(--text, #f4ece4)", fontFamily: "inherit", fontSize: 13 };

const send: CSSProperties = { flex: "none", height: 28, padding: "0 12px", border: 0, borderRadius: 9, background: "var(--muted-bg, #ffffff0d)", boxShadow: "inset 0 0 0 1px var(--border-soft, #ffffff12)", color: "var(--text-muted, #a2958a)", font: "inherit", fontSize: 12, cursor: "pointer" };

const reopen: CSSProperties = { justifySelf: "start", height: 30, margin: "0 2px 2px", padding: "0 10px", border: 0, borderRadius: 8, background: "transparent", boxShadow: "inset 0 0 0 1px var(--border-soft, #ffffff12)", color: "var(--text-muted, #a2958a)", font: "inherit", fontSize: 12, cursor: "pointer" };

const readout: CSSProperties = { margin: 0, padding: "0 4px", fontSize: 12, lineHeight: "18px", color: "var(--text-muted, #a2958a)" };

const code: CSSProperties = { padding: "1px 5px", borderRadius: 5, background: "var(--muted-bg, #ffffff0d)", fontFamily: mono, fontSize: 11.5, color: "var(--text, #f4ece4)" };
