import { useState } from "react";
import { SessionBrowser, type SessionRow } from "../session-browser";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const now = Date.now();

const START: SessionRow[] = [
  {
    id: "s-9f21",
    title: "Refactor bridge RPC framing",
    mtimeMs: now - 4 * MINUTE,
    sizeBytes: 214_880,
    messageCount: 84,
    cost: 1.42,
  },
  {
    id: "s-8c04",
    title: "Add session browser to the webview",
    mtimeMs: now - 47 * MINUTE,
    sizeBytes: 96_512,
    messageCount: 39,
    cost: 0.61,
  },
  {
    id: "s-7b93",
    title: "Fix SSE reconnect backoff",
    mtimeMs: now - 3 * HOUR,
    sizeBytes: 41_216,
    messageCount: 17,
  },
  {
    id: "s-6a17",
    title: "Refactor bridge RPC framing",
    mtimeMs: now - 2 * 24 * HOUR,
    sizeBytes: 388_096,
    messageCount: 151,
    cost: 3.08,
  },
  {
    id: "s-5e58",
    title: "Investigate flaky compaction test",
    mtimeMs: now - 22 * HOUR,
    sizeBytes: 22_016,
    messageCount: 9,
  },
  {
    id: "s-4d2c",
    title: null,
    mtimeMs: now - 3 * 24 * HOUR,
    sizeBytes: 8_192,
  },
  {
    id: "s-3a71",
    title: "Type the tool-call stream",
    mtimeMs: now - 6 * 24 * HOUR,
    sizeBytes: 132_608,
    messageCount: 62,
    cost: 2.14,
  },
];

export default function Demo() {
  const [sessions, setSessions] = useState<SessionRow[]>(START);
  const [activeId, setActiveId] = useState<string | undefined>("s-8c04");
  const [opened, setOpened] = useState("No session opened yet.");

  const title = (row: SessionRow) => row.title?.trim() || "Untitled";

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
      <SessionBrowser
        sessions={sessions}
        activeId={activeId}
        onOpen={(row) => {
          setActiveId(row.id);
          setOpened(`Opened “${title(row)}” · ${row.id}`);
        }}
        onNew={() => {
          const row: SessionRow = {
            id: `s-${Math.random().toString(16).slice(2, 6)}`,
            title: null,
            mtimeMs: Date.now(),
            sizeBytes: 0,
            messageCount: 0,
          };
          setSessions((list) => [row, ...list]);
          setActiveId(row.id);
          setOpened(`Started “Untitled” · ${row.id}`);
        }}
        onRename={(row, next) => {
          setSessions((list) =>
            list.map((item) => (item.id === row.id ? { ...item, title: next } : item)),
          );
          setOpened(`Renamed ${row.id} to “${next}”`);
        }}
        onDelete={(row) => {
          setSessions((list) => list.filter((item) => item.id !== row.id));
          setOpened(`Deleted “${title(row)}” · ${row.id}`);
        }}
        onExport={(row) => setOpened(`Exported “${title(row)}” as JSONL`)}
      />
      <p
        role="status"
        aria-live="polite"
        style={{
          margin: 0,
          fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
          fontSize: 11.5,
          lineHeight: "16px",
          opacity: 0.72,
        }}
      >
        {opened}
      </p>
    </div>
  );
}
