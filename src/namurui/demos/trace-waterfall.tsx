import { useEffect, useMemo, useState } from "react";
import { TraceWaterfall, type TraceSpan } from "../trace-waterfall";

/*
 * A launch agent takes one request and runs for thirty-four seconds: it plans in a single model
 * call, hands the research and the copy to two sub-agents, and has the coder ship the page. The
 * trace is replayed faster than it happened, so the bars can be watched growing, the clock
 * walking down the axis and the folded branches collapsing into marks on their parent.
 */

const RUN = 34_000;

/* Monochrome glyphs for the places the run reached. Brand squares would need their own colours,
   which are the sheet's to own, so every tool keeps the row's ink and one clear silhouette. */
const Magnifier = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="10.6" cy="10.6" r="5.4" stroke="currentColor" strokeWidth="1.8" />
    <path d="m14.7 14.7 4.3 4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const Database = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <ellipse cx="12" cy="6.2" rx="6.4" ry="2.6" stroke="currentColor" strokeWidth="1.8" />
    <path d="M5.6 6.2v11.6c0 1.44 2.86 2.6 6.4 2.6s6.4-1.16 6.4-2.6V6.2" stroke="currentColor" strokeWidth="1.8" />
    <path d="M5.6 12c0 1.44 2.86 2.6 6.4 2.6s6.4-1.16 6.4-2.6" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

const Globe = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.8" />
    <path d="M3.8 12h16.4M12 3.8c2.2 2.4 3.3 5.2 3.3 8.2s-1.1 5.8-3.3 8.2c-2.2-2.4-3.3-5.2-3.3-8.2s1.1-5.8 3.3-8.2Z" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const NoteBox = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3.6" y="3.6" width="16.8" height="16.8" rx="3" stroke="currentColor" strokeWidth="1.7" />
    <path d="M8.8 16V8.4L15.6 16V8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Layers = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="m12 3.8 7.4 4-7.4 4-7.4-4 7.4-4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="m4.6 12.4 7.4 4 7.4-4M4.6 16.6l7.4 4 7.4-4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

const Branch = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="8" cy="6.4" r="2.3" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="8" cy="17.6" r="2.3" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="16.4" cy="10.4" r="2.3" stroke="currentColor" strokeWidth="1.7" />
    <path d="M8 8.7v6.6M10.3 6.4h2.6a3.5 3.5 0 0 1 3.5 3.5v0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const CodeGlyph = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="m9 7.6-4.2 4.4L9 16.4M15 7.6l4.2 4.4-4.2 4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* The run itself. Every number here adds up to what the bar in the header shows: 34s, $0.37,
   82.3k tokens, four model calls and eight tool calls. The tree is the component's own shape:
   children hang off the span that spawned them, `end` is left out while a span still runs, and
   one tool reports a failure instead of a result. */
const script: TraceSpan[] = [
  {
    id: "orchestrator",
    name: "Orchestrator",
    kind: "agent",
    start: 0,
    end: RUN,
    detail: "Opus 5.5",
    input: "Launch the new pricing page by Friday. Use last quarter's churn data and keep the brand voice.",
    children: [
      {
        id: "plan",
        name: "Plan the launch",
        kind: "llm",
        start: 900,
        end: 7_800,
        detail: "Opus 5.5",
        cost: 0.12,
        tokens: 4_900,
        input: "Break the launch into research, copy and shipping work. Name an owner for each.",
        output: "1. Pull competitor pricing (research). 2. Write the page in the current voice (writer). 3. Ship behind a flag (coder).",
      },
      {
        id: "research",
        name: "Researcher",
        kind: "agent",
        start: 10_200,
        end: 33_800,
        detail: "Sonnet 5.5",
        children: [
          {
            id: "search-linear",
            name: "web_search",
            kind: "tool",
            start: 11_200,
            end: 16_600,
            detail: "Linear pricing",
            cost: 0.005,
            tokens: 3_100,
            icon: <Magnifier />,
            input: "linear.app/pricing",
            output: "Three tiers: Free, Basic at $8 per seat, Business at $14 per seat, billed yearly.",
          },
          {
            id: "search-notion",
            name: "web_search",
            kind: "tool",
            start: 11_400,
            end: 18_600,
            detail: "Notion pricing",
            cost: 0.005,
            tokens: 2_900,
            icon: <Magnifier />,
            input: "notion.so/pricing",
            output: "Free for personal use, Plus at $10 per member, Business at $15, Enterprise on request.",
          },
          {
            id: "usage",
            name: "Query plan usage",
            kind: "tool",
            start: 11_500,
            end: 15_000,
            detail: "Postgres",
            tokens: 1_400,
            icon: <Database />,
            input: "select plan, count(*) from workspaces group by 1",
            output: "Free 41,204 · Basic 8,912 · Business 3,077 · Enterprise 118.",
          },
          {
            id: "reviews",
            name: "Read G2 reviews",
            kind: "tool",
            start: 14_600,
            end: 27_600,
            detail: "120 pages",
            cost: 0.02,
            tokens: 6_800,
            icon: <Globe />,
            input: "g2.com/products/namurui/reviews — 120 pages of text",
            output: "Reviewers ask for yearly billing and a clearer difference between Basic and Business.",
          },
          {
            id: "pricing-docs",
            name: "Read pricing docs",
            kind: "tool",
            status: "failed",
            start: 20_400,
            end: 22_600,
            detail: "linear.app/docs",
            icon: <Globe />,
            input: "linear.app/docs/pricing",
            error: "403 – the docs sit behind a login, so the call was dropped.",
          },
          {
            id: "summarize",
            name: "Summarize findings",
            kind: "llm",
            start: 19_800,
            end: 26_400,
            detail: "Opus 5.5",
            cost: 0.01,
            tokens: 3_200,
            input: "Here are three competitor pages and 120 review pages. What does the pricing page have to answer?",
            output: "Seat-based pricing is table stakes; the difference has to be the yearly discount and the migration path.",
          },
        ],
      },
      {
        id: "writer",
        name: "Writer",
        kind: "agent",
        start: 12_800,
        end: 33_000,
        detail: "Sonnet 5.5",
        children: [
          {
            id: "voice",
            name: "Read brand voice",
            kind: "tool",
            start: 13_200,
            end: 16_800,
            detail: "Notion",
            tokens: 1_600,
            icon: <NoteBox />,
            input: "brand/voice.md",
            output: "Short sentences, no adjectives stacked more than two deep, name the reader's job.",
          },
          {
            id: "frames",
            name: "Read pricing frames",
            kind: "tool",
            start: 13_200,
            end: 18_300,
            detail: "Figma",
            tokens: 1_700,
            icon: <Layers />,
            input: "Pricing page · desktop and mobile frames",
            output: "Four tiers, a monthly/yearly switch above the table, and a comparison list under it.",
          },
          {
            id: "draft",
            name: "Draft plan copy",
            kind: "llm",
            start: 16_200,
            end: 32_200,
            detail: "Sonnet 5.5",
            cost: 0.07,
            tokens: 26_000,
            input: "Write the page against the research summary and the brand voice.",
            output: "Headline, three tier blurbs, the yearly note, and eight comparison rows.",
          },
        ],
      },
      {
        id: "coder",
        name: "Coder",
        kind: "agent",
        start: 14_500,
        end: 33_500,
        detail: "GPT-6 Sol",
        icon: <CodeGlyph />,
        children: [
          {
            id: "branch",
            name: "Create branch",
            kind: "tool",
            start: 15_200,
            end: 17_300,
            detail: "GitHub",
            tokens: 700,
            icon: <Branch />,
            input: "main → pricing-page-v2",
            output: "Branch created, 1 commit ahead of main.",
          },
          {
            id: "write-page",
            name: "Write pricing page",
            kind: "llm",
            start: 17_000,
            end: 33_400,
            detail: "GPT-6 Sol",
            cost: 0.14,
            tokens: 30_000,
            icon: <CodeGlyph />,
            input: "The drafted copy, the frames, and the current components.",
            output: "src/pages/pricing.tsx, the tier table and its tests.",
          },
        ],
      },
    ],
  },
];

function build(elapsed: number): TraceSpan {
  const spanFor = (span: TraceSpan): TraceSpan => {
    const end = span.end;
    const done = end !== undefined && elapsed >= end;
    /* A call is billed as it streams, so a running span shows what it has spent so far and lands
       on its full price when it finishes – which is also when the header totals become exact. */
    const share = done
      ? 1
      : Math.min(1, Math.max(0, (elapsed - span.start) / Math.max(1, (end ?? RUN) - span.start)));
    return {
      ...span,
      status: done ? span.status ?? "done" : "running",
      end: done ? end : undefined,
      cost: span.cost === undefined ? undefined : span.cost * share,
      tokens: span.tokens === undefined ? undefined : Math.round(span.tokens * share),
      children: span.children?.filter((child) => child.start <= elapsed).map(spanFor),
    };
  };
  return spanFor(script[0]);
}

export default function Demo() {
  const [elapsed, setElapsed] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<string[]>([]);

  /* The run is replayed at roughly six times its own speed, then held for a beat and started
     over so the growth can be watched again without touching anything. */
  useEffect(() => {
    const speed = RUN / 5_200;
    let frame = 0;
    let origin = 0;
    const tick = (stamp: number) => {
      if (!origin) origin = stamp;
      const played = (stamp - origin) * speed;
      if (played <= RUN) {
        setElapsed(Math.round(played / 100) * 100);
      } else if (played > RUN + 2_600 * speed) {
        origin = stamp;
        setElapsed(0);
        setOpenId(null);
      } else {
        setElapsed(RUN);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const root = useMemo(() => build(elapsed), [elapsed]);

  return (
    <TraceWaterfall
      root={root}
      now={elapsed}
      task="Launch the new pricing page by Friday"
      openId={openId}
      onOpenChange={(id) => setOpenId(id)}
      collapsed={collapsed}
      onCollapsedChange={(ids) => setCollapsed(ids)}
    />
  );
}
