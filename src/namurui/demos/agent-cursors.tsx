import { useEffect, useState } from "react";
import {
  AgentCursors,
  type Agent,
  type AgentCursorsView,
  type Block,
  type Comment,
  type Cursor,
  type DocTable,
} from "../agent-cursors";

const agents: Agent[] = [
  { id: "research", name: "Researcher", doing: "Checking the numbers", mark: "claude" },
  { id: "designer", name: "Designer", doing: "Waiting for the render", mark: "gemini" },
  { id: "coder", name: "Coder", doing: "Reading the config", mark: "codex" },
  { id: "writer", name: "Writer", doing: "Reading the brief", mark: "openai" },
];

const blocks: Block[] = [
  { id: "title", kind: "title", text: "Pulse 2.0 – launch brief" },
  {
    id: "why",
    kind: "paragraph",
    text: "Teams lose about 40% of their week to status updates. Pulse turns that work into a short daily brief, so nobody has to write one.",
  },
  { id: "hero", kind: "figure", width: 50, height: 88, float: "left" },
  {
    id: "beside",
    kind: "paragraph",
    text: "The hero is the brief itself: one calm screen a team lead reads on Monday morning. Short, current and written from the work, so the week starts without a status meeting.",
  },
  { id: "h-roll", kind: "heading", text: "Rollout" },
  {
    id: "code",
    kind: "code",
    text: 'const rollout = {\n  waitlist: "Nov 3",\n  everyone: "second week of November",\n};',
  },
  {
    id: "ship",
    kind: "paragraph",
    text: "Launch week: one short post, a demo video and an email to the waitlist.",
  },
  { id: "h-what", kind: "heading", text: "What ships" },
  {
    kind: "list",
    items: [
      { id: "i1", text: "Daily briefs for every project, written from the work itself" },
      { id: "i2", text: "Nudges when a task has been quiet for too long" },
    ],
  },
];

const table: DocTable = {
  columns: ["Block", "Owner", "Status"],
  rows: [
    { id: "r1", item: "Launch brief", owner: "Writer", status: "Drafting", tone: "amber" },
    { id: "r2", item: "Hero screen", owner: "Designer", status: "Rendering", tone: "blue" },
    { id: "r3", item: "Rollout dates", owner: "Researcher", status: "Verified", tone: "green" },
    { id: "r4", item: "Release config", owner: "Coder", status: "Reviewed", tone: "green" },
  ],
  addLabel: "Add block",
};

/* Where each pointer rests, in the sheet's own pixels – the first stop is where it starts */
const stops: Record<string, readonly { x: number; y: number }[]> = {
  research: [
    { x: 120.1, y: 119 },
    { x: 236.4, y: 119 },
    { x: 388.2, y: 119 },
    { x: 174.6, y: 119 },
  ],
  designer: [
    { x: 212.3, y: 220 },
    { x: 284.9, y: 236 },
    { x: 130.5, y: 254 },
    { x: 246.8, y: 228 },
  ],
  coder: [
    { x: 143.8, y: 372 },
    { x: 205.1, y: 392 },
    { x: 268.7, y: 372 },
    { x: 178.3, y: 412 },
  ],
  writer: [
    { x: 218.7, y: 78 },
    { x: 302.5, y: 78 },
    { x: 415.9, y: 78 },
    { x: 148.2, y: 78 },
  ],
};

const start: Cursor[] = [
  { agent: "research", x: 120.1, y: 119, height: 16, cost: 0.08 },
  { agent: "designer", x: 212.3, y: 220, height: 0, free: true, cost: 0.07 },
  { agent: "coder", x: 143.8, y: 372, height: 14, cost: 0.14, opacity: 0.787234 },
  { agent: "writer", x: 218.7, y: 78, height: 24 },
];

export default function Demo() {
  const [view, setView] = useState<AgentCursorsView>("doc");
  const [followed, setFollowed] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [live, setLive] = useState("");
  const [comments, setComments] = useState<Comment[]>([
    {
      id: "n0",
      agent: "coder",
      author: "Coder",
      time: "now",
      text: 'Should waitlist and everyone share one date format? I\'d use "Nov 3" everywhere.',
      x: 18,
      y: 332,
    },
  ]);

  /* The pointers walk along the lines they are reading, one stop every beat */
  useEffect(() => {
    const id = window.setInterval(() => setStep((value) => value + 1), 1400);
    return () => window.clearInterval(id);
  }, []);

  const cursors: Cursor[] = start.map((cursor) => {
    const path = stops[cursor.agent];
    const stop = path[step % path.length];
    return {
      ...cursor,
      x: stop.x,
      y: stop.y,
      typing: cursor.agent === "writer" && step % 2 === 1,
      press: cursor.agent === "designer" && step % 3 === 2,
      opacity: cursor.agent === "coder" ? (step % 4 === 0 ? 0.787234 : 1) : undefined,
    };
  });

  return (
    <div style={{ padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 700, margin: "0 auto" }}>
        <AgentCursors
          title="Product / Launches"
          agents={agents}
          cursors={cursors}
          blocks={blocks}
          comments={comments}
          table={table}
          view={view}
          onViewChange={setView}
          followed={followed}
          onFollow={(agent) => {
            setFollowed(agent);
            const name = agents.find((item) => item.id === agent)?.name;
            setLive(agent && name ? `Following ${name}` : "Following stopped");
          }}
          openComment={open}
          onCommentOpen={setOpen}
          onReplyChange={(comment, reply) =>
            setComments((list) =>
              list.map((item) => (item.id === comment ? { ...item, reply } : item)),
            )
          }
          onResolve={(comment) => {
            setComments((list) => list.filter((item) => item.id !== comment));
            setOpen(null);
            setLive("Comment resolved");
          }}
          live={live}
        />
      </div>
      <p style={{ maxWidth: 700, margin: "10px auto 0", fontSize: 12, color: "var(--text-muted)" }}>
        Four agents are in the brief · click a face to follow one, the pin to read the comment, and the
        tabs to see the same work as a table
      </p>
    </div>
  );
}
