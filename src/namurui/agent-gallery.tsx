"use client";

import { Fragment, useState, type CSSProperties } from "react";

/*
 * Agent Gallery – a strip of slim gradient panels with one product screen open in the middle.
 * The strip is rendered three times over so a panel can always peek in from either side; only the
 * middle copy carries a screen. Picking a slim panel widens it into the middle while the open one
 * folds back to a sliver, both in one width transition, and the screen fades and lifts into place a
 * beat later. The arrows wrap around the list and the caption under the strip announces the agent.
 * The styles are injected below, so no extra files are needed.
 */

export type AgentGallerySpark = {
  /** Path `d` for the sparkline, drawn in the 78×20 box of its viewBox */
  path: string;
  /** The dot that closes the line, in that same space */
  end: { x: number; y: number };
};

export type AgentGalleryStat = {
  /** Small label above the number, e.g. "Runs" */
  label: string;
  /** The number itself, already formatted, e.g. "97%" */
  value: string;
  /** The line beside it */
  spark: AgentGallerySpark;
  /** Line and dot colour, e.g. "#22a06b" – the sheet never sets the spark colour */
  tone: string;
};

export type AgentGalleryFile = {
  /** File name on the card, e.g. "playbook.pdf" */
  name: string;
  /** Picks the chip colour; only these two are styled */
  kind: "pdf" | "csv";
};

export type AgentGalleryEntry =
  | {
      /** Someone dropped a rule or a note into the context */
      kind: "context";
      /** Initials in the round avatar */
      initials: string;
      /** Name in bold before the sentence */
      author: string;
      /** When it happened, e.g. "today" */
      when: string;
      /** The note itself, on the card under the line */
      note: string;
    }
  | {
      /** A document was generated from the context */
      kind: "summary";
      /** Initials in the round avatar */
      initials: string;
      /** Name in bold before the sentence */
      author: string;
      /** Underlined document name, e.g. "Weekly summary" */
      doc: string;
      /** When it happened, e.g. "1d ago" */
      when: string;
    }
  | {
      /** Files were attached */
      kind: "files";
      /** Initials in the round avatar */
      initials: string;
      /** Name in bold before the sentence */
      author: string;
      /** Attachments, each with its coloured chip */
      files: AgentGalleryFile[];
      /** When it happened, e.g. "2d ago" */
      when: string;
    }
  | {
      /** Two tools were connected to the agent */
      kind: "apps";
      /** Underlined tool names, e.g. ["Slack", "HubSpot"] */
      apps: string[];
      /** When it happened, e.g. "3d ago" */
      when: string;
    };

export type AgentGalleryPanel = {
  /** Stable id, used for React keys and by the caller to track the open panel */
  id: string;
  /** Label on the slim panel, in the screen bar and in the caption */
  name: string;
  /** The two colours the panel gradient is mixed from: a strong one and its wash */
  colors: { a: string; b: string };
  /** What starts the run, quoted under the agent name */
  trigger: string;
  /** Who owns the agent */
  owner: string;
  /** The four numbers with their sparklines, left to right */
  stats: AgentGalleryStat[];
  /** The context tab of the open screen */
  context: { placeholder: string; entries: AgentGalleryEntry[] };
  /** One line under the strip while this panel is open, after the name */
  caption: string;
  /** Age of the last sync in the top right; defaults to "3m ago" */
  updated?: string;
  /** Initials in the bar avatar and on the composer; defaults to "LH" */
  user?: string;
};

export type AgentGalleryProps = {
  /** Section heading; also the carousel's accessible name */
  heading?: string;
  /** Line under the heading */
  description?: string;
  /** The agents, left to right */
  panels?: AgentGalleryPanel[];
  /** Index of the open panel, when the caller owns the state */
  index?: number;
  /** Index of the open panel when uncontrolled – defaults to the first */
  defaultIndex?: number;
  /** Called with the index of the panel the visitor picked */
  onIndexChange?: (index: number) => void;
  /** Extra class on the root */
  className?: string;
};

/** Colours of the four sparklines; the sheet leaves them to the data. */
const TONES = {
  runs: "#22a06b",
  success: "#2f9bd6",
  saved: "#8b5cf6",
  escalated: "#ec4899",
} as const;

/* The four line shapes the reference draws, in the 78×20 spark box. */
const RISE: AgentGallerySpark = {
  path: "M0 12 L8 11 L16 10 L24 9 L32 8 L40 7 L48 6 L56 5 L64 4 L72 3",
  end: { x: 72, y: 3 },
};
const WOBBLE: AgentGallerySpark = {
  path: "M0 10 L8 6 L16 15 L24 11 L32 7 L40 3 L48 12 L56 8 L64 4 L72 13",
  end: { x: 72, y: 13 },
};
const DIP: AgentGallerySpark = {
  path: "M0 14 L8 3 L16 5 L24 7 L32 9 L40 11 L48 13 L56 15 L64 4 L72 6",
  end: { x: 72, y: 6 },
};
const ZIGZAG: AgentGallerySpark = {
  path: "M0 13 L8 7 L16 14 L24 8 L32 15 L40 9 L48 3 L56 10 L64 4 L72 11",
  end: { x: 72, y: 11 },
};

/** The four KPI cells, all on the same line shape. */
function stats(
  runs: string,
  success: string,
  saved: string,
  escalated: string,
  spark: AgentGallerySpark,
): AgentGalleryStat[] {
  return [
    { label: "Runs", value: runs, spark, tone: TONES.runs },
    { label: "Success", value: success, spark, tone: TONES.success },
    { label: "Time saved", value: saved, spark, tone: TONES.saved },
    { label: "Escalated", value: escalated, spark, tone: TONES.escalated },
  ];
}

/** The shared context feed: two of the notes change per agent, the rest is the same team history. */
function feed(first: string, second: string): AgentGalleryEntry[] {
  return [
    { kind: "context", initials: "JW", author: "Jonas Weber", when: "today", note: first },
    {
      kind: "summary",
      initials: "ML",
      author: "Mara Lindqvist",
      doc: "Weekly summary",
      when: "1d ago",
    },
    {
      kind: "files",
      initials: "ML",
      author: "Mara Lindqvist",
      files: [
        { name: "playbook.pdf", kind: "pdf" },
        { name: "accounts.csv", kind: "csv" },
      ],
      when: "2d ago",
    },
    { kind: "context", initials: "JW", author: "Jonas Weber", when: "2d ago", note: second },
    { kind: "apps", apps: ["Slack", "HubSpot"], when: "3d ago" },
  ];
}

/** The seven agents from the reference; pass `panels` to replace them. */
export const defaultGalleryPanels: AgentGalleryPanel[] = [
  {
    id: "support-triage",
    name: "Support triage",
    colors: { a: "#8b5cf6", b: "#e9d5ff" },
    trigger: "Ticket created",
    owner: "Lena Hart",
    stats: stats("41", "97%", "6.1h", "7", RISE),
    context: {
      placeholder: "Cannot close tickets",
      entries: feed(
        "Read the ticket and detect the product area.",
        "Set priority from customer plan and sentiment. Assign the team and post a summary in the thread.",
      ),
    },
    caption: "Sorts every new ticket before a person has to read it.",
  },
  {
    id: "lead-enrichment",
    name: "Lead enrichment",
    colors: { a: "#2f6bff", b: "#c7d7ff" },
    trigger: "Lead added",
    owner: "Lena Hart",
    stats: stats("64", "98%", "6.4h", "3", WOBBLE),
    context: {
      placeholder: "Cannot change lead owner",
      entries: feed(
        "Look up the company by email domain.",
        "Add size, industry and location to the record. Score the lead and notify the owner above 80.",
      ),
    },
    caption: "Fills in the blanks on every lead before the first call.",
  },
  {
    id: "meeting-recap",
    name: "Meeting recap",
    colors: { a: "#ec4899", b: "#fbcfe8" },
    trigger: "Call ended",
    owner: "Lena Hart",
    stats: stats("163", "95%", "8.3h", "1", RISE),
    context: {
      placeholder: "Cannot email external guests",
      entries: feed(
        "Pull the transcript from the recording.",
        "Write a short recap with decisions and owners. Create follow-up tasks and share the notes.",
      ),
    },
    caption: "Writes the recap and the follow-ups while the call is still fresh.",
  },
  {
    id: "churn-watch",
    name: "Churn watch",
    colors: { a: "#f97316", b: "#fed7aa" },
    trigger: "Usage drops 30%",
    owner: "Lena Hart",
    stats: stats("183", "97%", "3.3h", "7", DIP),
    context: {
      placeholder: "Cannot offer discounts",
      entries: feed(
        "Compare weekly usage against the last quarter.",
        "Check open tickets and recent NPS answers. Draft a check-in for the account manager.",
      ),
    },
    caption: "Spots accounts that go quiet and suggests a save play.",
  },
  {
    id: "onboarding-coach",
    name: "Onboarding coach",
    colors: { a: "#14b8a6", b: "#ccfbf1" },
    trigger: "Workspace created",
    owner: "Lena Hart",
    stats: stats("124", "98%", "4.4h", "4", RISE),
    context: {
      placeholder: "Cannot change billing",
      entries: feed(
        "Send a welcome note with the first three steps.",
        "Watch for steps that stay open for two days. Offer a short call when setup stalls.",
      ),
    },
    caption: "Walks each new workspace to its first useful result.",
  },
  {
    id: "content-review",
    name: "Content review",
    colors: { a: "#6366f1", b: "#e0e7ff" },
    trigger: "Draft submitted",
    owner: "Lena Hart",
    stats: stats("182", "94%", "5.2h", "5", ZIGZAG),
    context: {
      placeholder: "Cannot publish",
      entries: feed(
        "Check tone against the brand guide.",
        "Flag claims that need a source. Suggest fixes inline and tag the author.",
      ),
    },
    caption: "Reads drafts the way your best editor would, then hands back the fixes.",
  },
  {
    id: "release-notes",
    name: "Release notes",
    colors: { a: "#d946ef", b: "#f5d0fe" },
    trigger: "Release tagged",
    owner: "Lena Hart",
    stats: stats("127", "99%", "6.7h", "6", DIP),
    context: {
      placeholder: "Cannot post without review",
      entries: feed(
        "Collect merged pull requests since the last tag.",
        "Group them into features, fixes and changes. Draft notes in plain language for review.",
      ),
    },
    caption: "Turns merged work into notes people actually read.",
  },
];

export function AgentGallery({
  heading = "Agents that run your playbook",
  description = "Give each agent its steps, tools and limits – then let it work inside the tools your team already uses.",
  panels = defaultGalleryPanels,
  index,
  defaultIndex = 0,
  onIndexChange,
  className,
}: AgentGalleryProps) {
  const total = panels.length;
  const [picked, setPicked] = useState(defaultIndex);
  const claimed = index ?? picked;
  const active = total === 0 ? 0 : Math.min(Math.max(claimed, 0), total - 1);
  /* The open panel always sits in the middle copy of the strip, so a sliver of both neighbours
   * stays in view and the width transition never has to leave the mounted set. */
  const pos = total + active;
  const open = panels[active];

  const select = (next: number) => {
    if (total === 0) return;
    const wanted = ((next % total) + total) % total;
    if (wanted === active) return;
    if (index === undefined) setPicked(wanted);
    onIndexChange?.(wanted);
  };

  return (
    <section
      className={["ui-ag", className].filter(Boolean).join(" ")}
      aria-roledescription="carousel"
      aria-label={heading}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-agent-gallery" precedence="default">
        {css}
      </style>

      <header className="ui-ag__head">
        <h2>{heading}</h2>
        <p>{description}</p>
      </header>

      <div className="ui-ag__viewport">
        <div className="ui-ag__track" style={{ "--pos": pos } as CSSProperties}>
          {[panels, panels, panels].flat().map((panel, i) => {
            const isOpen = i === pos;
            const isMiddle = total > 0 && i >= total && i < total * 2;
            /* The open panel and the two slivers beside it keep their colour; everything further
             * out falls back to the washed-out gradient. */
            const far = Math.abs(i - pos) > 1;

            return (
              <div
                key={`${panel.id}-${i}`}
                className="ui-ag__panel"
                data-far={far ? "" : undefined}
                data-open={isOpen ? "" : undefined}
                aria-hidden={isMiddle ? undefined : "true"}
                style={{ "--a": panel.colors.a, "--b": panel.colors.b } as CSSProperties}
              >
                <span className="ui-ag__art" aria-hidden="true" />

                {isMiddle ? <AgentScreen panel={panel} open={isOpen} /> : null}

                {isOpen ? null : (
                  <button
                    type="button"
                    className="ui-ag__pick"
                    aria-label={`Show ${panel.name}`}
                    tabIndex={isMiddle ? undefined : -1}
                    onClick={() => select(i)}
                  >
                    <span className="ui-ag__label">{panel.name}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {open ? (
        <div className="ui-ag__foot">
          <p className="ui-ag__caption" aria-live="polite" key={open.id}>
            <b>{open.name}.</b> {open.caption}
          </p>
          <div className="ui-ag__arrows">
            <button type="button" aria-label="Previous agent" onClick={() => select(active - 1)}>
              <Icon d={PATHS.prev} />
            </button>
            <button type="button" aria-label="Next agent" onClick={() => select(active + 1)}>
              <Icon d={PATHS.next} />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** The product screen that sits inside a panel; hidden and inert until its panel opens. */
function AgentScreen({ panel, open }: { panel: AgentGalleryPanel; open: boolean }) {
  const user = panel.user ?? "LH";

  return (
    <div
      className="ui-ag__screen"
      aria-label={`${panel.name} workspace`}
      aria-hidden={open ? undefined : "true"}
      inert={open ? undefined : true}
    >
      <div className="ui-ag__bar">
        <span className="ui-ag__brand" aria-hidden="true" />
        <span className="ui-ag__switch">
          <span className="ui-ag__mark" aria-hidden="true" />
          {panel.name}
          <Icon d={PATHS.chevrons} />
        </span>
        <span className="ui-ag__new">+ New agent</span>
        <span className="ui-ag__avatar" aria-hidden="true">
          {user}
        </span>
      </div>

      <div className="ui-ag__page">
        <div className="ui-ag__hero">
          <span className="ui-ag__logo" aria-hidden="true" />
          <span className="ui-ag__sync">
            {panel.updated ?? "3m ago"}
            <Icon d={PATHS.refresh} />
          </span>
        </div>

        <h3>{panel.name}</h3>
        <p className="ui-ag__sub">
          Triggered by “{panel.trigger}” · Owner {panel.owner}
        </p>

        <div className="ui-ag__kpis">
          {panel.stats.map((stat) => (
            <div key={stat.label}>
              <span>{stat.label}</span>
              <b>{stat.value}</b>
              <svg className="ui-ag__spark" viewBox="-2 -2 78 20" aria-hidden="true">
                <path d={stat.spark.path} style={{ stroke: stat.tone }} />
                <circle
                  cx={stat.spark.end.x}
                  cy={stat.spark.end.y}
                  r={2.2}
                  style={{ fill: stat.tone }}
                />
              </svg>
            </div>
          ))}
        </div>

        <div className="ui-ag__tabs">
          <span>Runs</span>
          <span>Tools</span>
          <b>Context</b>
          <span>Settings</span>
        </div>

        <h4>Agent context</h4>
        <p className="ui-ag__hint">Goals, files and rules the agent uses on every run.</p>

        <div className="ui-ag__toolbar">
          <span className="ui-ag__search">
            <Icon d={PATHS.search} />
            Search context…
          </span>
          <span className="ui-ag__filter">
            <Icon d={PATHS.filter} />
            All
          </span>
        </div>

        <ol className="ui-ag__feed">
          <li className="ui-ag__compose">
            <span className="ui-ag__avatar" aria-hidden="true">
              {user}
            </span>
            <div className="ui-ag__box">
              <span>Add context, e.g. “{panel.context.placeholder}”</span>
              <span className="ui-ag__box-foot">
                <Icon d={PATHS.clip} />
                <b>Add context</b>
              </span>
            </div>
          </li>
          {panel.context.entries.map((entry, i) => (
            <FeedRow key={i} entry={entry} />
          ))}
        </ol>
      </div>
    </div>
  );
}

/** One row of the context feed; the dot and the sentence change with the entry kind. */
function FeedRow({ entry }: { entry: AgentGalleryEntry }) {
  if (entry.kind === "apps") {
    return (
      <li>
        <span className="ui-ag__dot ui-ag__dot--app">
          <Icon d={PATHS.plug} />
        </span>
        <p className="ui-ag__line">
          Connected{" "}
          {entry.apps.map((app, i) => (
            <Fragment key={app}>
              {i > 0 ? (i === entry.apps.length - 1 ? " and " : ", ") : null}
              <u>{app}</u>
            </Fragment>
          ))}
          {" · "}
          {entry.when}
        </p>
      </li>
    );
  }

  if (entry.kind === "summary") {
    return (
      <li>
        <span className="ui-ag__dot">
          <Icon d={PATHS.bars} />
        </span>
        <p className="ui-ag__line">
          <span className="ui-ag__avatar" aria-hidden="true">
            {entry.initials}
          </span>
          <b>{entry.author}</b>
          {" generated a "}
          <u>{entry.doc}</u>
          {" · "}
          {entry.when}
        </p>
      </li>
    );
  }

  if (entry.kind === "files") {
    return (
      <li>
        <span className="ui-ag__dot">
          <Icon d={PATHS.file} />
        </span>
        <p className="ui-ag__line">
          <span className="ui-ag__avatar" aria-hidden="true">
            {entry.initials}
          </span>
          <b>{entry.author}</b>
          {" added "}
          {entry.files.map((file, i) => (
            <Fragment key={file.name}>
              {i > 0 ? (i === entry.files.length - 1 ? " and " : ", ") : null}
              <u>{file.name}</u>
              <i className="ui-ag__ext" data-kind={file.kind} />
            </Fragment>
          ))}
          {" · "}
          {entry.when}
        </p>
      </li>
    );
  }

  return (
    <li>
      <span className="ui-ag__dot">
        <Icon d={PATHS.chat} />
      </span>
      <div>
        <p className="ui-ag__line">
          <span className="ui-ag__avatar" aria-hidden="true">
            {entry.initials}
          </span>
          <b>{entry.author}</b>
          {" added context · "}
          {entry.when}
        </p>
        <p className="ui-ag__card">{entry.note}</p>
      </div>
    </li>
  );
}

const PATHS = {
  chevrons: "m8 10 4-4 4 4M8 14l4 4 4-4",
  refresh:
    "M19 12a7 7 0 0 1-12.3 4.6M5 12a7 7 0 0 1 12.3-4.6M17.5 4v3.5H14M6.5 20v-3.5H10",
  search: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM20 20l-4.5-4.5",
  filter: "M5 7h14M8 12h8M11 17h2",
  clip: "m15.5 7.5-6.4 6.4a1.8 1.8 0 0 0 2.5 2.5l6.7-6.7a3.5 3.5 0 0 0-5-5l-6.9 6.9a5.2 5.2 0 0 0 7.4 7.4l6-6",
  chat: "M5 6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4 3v-3h-.5A.5.5 0 0 1 5 15.5Z",
  bars: "M6 18V11M10 18V7M14 18v-5M18 18V9",
  file: "M8 3.5h6l4 4v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1ZM14 3.5v4h4",
  plug: "M9 4v4M15 4v4M7 8h10v3a5 5 0 0 1-10 0V8ZM12 16v4",
  prev: "M19 12H5m0 0 6-6m-6 6 6 6",
  next: "M5 12h14m0 0-6-6m6 6-6 6",
} as const;

/** Line icon; the sheet gives every svg inside the gallery its size, stroke and caps. */
function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const css = /* css */ `
.ui-ag{--ui-ag-ink: #1c1713;--ui-ag-text: #3d3226;--ui-ag-muted: #857567;--ui-ag-base-top: #f4ece5;--ui-ag-base-bottom: #e9e1d8;--ui-ag-screen: #fffdfb;--ui-ag-page: #faf7f4;--ui-ag-screen-line: #eae2d9;--ui-ag-chip: #fffdfb;--ui-ag-chip-line: #ded4ca;--ui-ag-soft: #f4ece5;--ui-ag-btn: #fffdfb;--ui-ag-shine: rgba(255, 253, 251, 0.75);--ui-ag-ok: #1a7a4a;--ui-ag-ok-bg: #ebe3db;--ui-ag-height: 560px;--ui-ag-side: 104px;--ui-ag-gap: 14px;--ui-ag-open: min(70cqw, 1120px);--ui-ag-ease: cubic-bezier(0.65, 0, 0.25, 1);container-type: inline-size;overflow: hidden;padding: 8px 0 4px;font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;color: var(--ui-ag-ink);-webkit-font-smoothing: antialiased}
.ui-ag *, .ui-ag *::before, .ui-ag *::after{box-sizing: border-box}
.ui-ag button{font: inherit;color: inherit;margin: 0;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-ag button:focus-visible{outline: 2px solid #ff6b35;outline-offset: 3px}
.ui-ag__head{max-width: 620px;margin: 0 auto 36px;padding: 0 20px;text-align: center}
.ui-ag__head h2{margin: 0;font-size: 30px;font-weight: 600;letter-spacing: -0.025em;line-height: 1.15}
.ui-ag__head p{margin: 12px 0 0;font-size: 16px;line-height: 1.5;color: var(--ui-ag-muted)}
.ui-ag__viewport{overflow: hidden}
.ui-ag__track{display: flex;gap: var(--ui-ag-gap);width: max-content;height: var(--ui-ag-height);transform: translateX(calc(50cqw - var(--pos) * (var(--ui-ag-side) + var(--ui-ag-gap)) - var(--ui-ag-open) / 2));transition: transform 620ms var(--ui-ag-ease)}
.ui-ag__track[data-snap], .ui-ag__track[data-snap] *{transition: none !important;animation: none !important}
.ui-ag__panel{position: relative;flex: 0 0 var(--ui-ag-side);overflow: hidden;border-radius: 20px;transition: flex-basis 620ms var(--ui-ag-ease)}
.ui-ag__panel[data-open]{flex-basis: var(--ui-ag-open)}
.ui-ag__art{position: absolute;inset: 0;background: linear-gradient(118deg, transparent 38%, var(--ui-ag-shine) 47%, transparent 57%), radial-gradient(110% 80% at 0% 0%, color-mix(in srgb, var(--a) 70%, transparent) 0%, transparent 60%), radial-gradient(90% 70% at 100% 100%, var(--b) 0%, transparent 72%), radial-gradient(60% 50% at 30% 100%, color-mix(in srgb, var(--a) 28%, transparent) 0%, transparent 70%), linear-gradient(180deg, var(--ui-ag-base-top), var(--ui-ag-base-bottom));filter: saturate(0.35);transition: filter var(--nm-dur-5, 620ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-6, 1100ms) var(--ui-ag-ease)}
.ui-ag__panel:hover .ui-ag__art{filter: none}
.ui-ag__panel[data-open] .ui-ag__art{filter: none}
.ui-ag__panel[data-far] .ui-ag__art{filter: saturate(0.12)}
.ui-ag__pick{position: absolute;inset: 0;display: flex;align-items: flex-end;padding: 0 0 22px 16px;border: 0;background: none;animation: ui-ag-fade var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 200ms both}
.ui-ag__label{writing-mode: vertical-rl;transform: rotate(180deg);font-size: 17px;font-weight: 500;letter-spacing: -0.01em;white-space: nowrap;color: color-mix(in srgb, var(--a) 70%, var(--ui-ag-text));opacity: 0.85}
.ui-ag__panel[data-far] .ui-ag__label{color: var(--ui-ag-muted)}
.ui-ag__screen{position: absolute;top: 44px;left: 44px;width: max(640px, calc(100% - 88px));min-height: 620px;overflow: hidden;border-radius: 16px;background: var(--ui-ag-page);box-shadow: 0 0 0 1px var(--ui-ag-screen-line), 0 20px 50px -20px rgba(11, 9, 8, 0.18);font-size: 11.5px;color: var(--ui-ag-text);opacity: 0;transform: translate(28px, 14px) scale(0.98);transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-4, 380ms) var(--ui-ag-ease)}
.ui-ag__panel[data-open] .ui-ag__screen{opacity: 1;transform: none;transition: opacity var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 260ms, transform 620ms var(--ui-ag-ease) 220ms}
.ui-ag__screen svg{width: 13px;height: 13px;flex: none;fill: none;stroke: currentColor;stroke-width: 1.7;stroke-linecap: round;stroke-linejoin: round}
.ui-ag__screen u{text-decoration: underline;text-decoration-color: var(--ui-ag-chip-line);text-underline-offset: 3px;text-decoration-thickness: 1.5px;color: var(--ui-ag-ink)}
.ui-ag__bar{display: flex;align-items: center;gap: 12px;height: 48px;padding: 0 14px;background: var(--ui-ag-screen)}
.ui-ag__brand{width: 18px;height: 18px;border-radius: 5px;background: var(--ui-ag-ink)}
.ui-ag__switch{display: inline-flex;align-items: center;gap: 7px;height: 28px;padding: 0 8px 0 6px;border-radius: 8px;box-shadow: inset 0 0 0 1px var(--ui-ag-chip-line);font-size: 11.5px;font-weight: 500;color: var(--ui-ag-ink)}
.ui-ag__switch svg{width: 12px;height: 12px;color: var(--ui-ag-muted)}
.ui-ag__mark, .ui-ag__logo{border-radius: 5px;background: linear-gradient(135deg, var(--a), var(--b));box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35)}
.ui-ag__mark{width: 16px;height: 16px}
.ui-ag__new{margin-left: auto;padding: 5px 10px;border-radius: 8px;box-shadow: inset 0 0 0 1px var(--ui-ag-chip-line), 0 1px 1px rgba(11, 9, 8, 0.04);font-size: 11px;font-weight: 500;color: var(--ui-ag-ink)}
.ui-ag__avatar{display: inline-grid;place-items: center;width: 18px;height: 18px;flex: none;border-radius: 50%;background: var(--ui-ag-soft);box-shadow: inset 0 0 0 1px var(--ui-ag-chip-line);font-size: 7.5px;font-weight: 600;color: var(--ui-ag-text)}
.ui-ag__bar .ui-ag__avatar{width: 26px;height: 26px;font-size: 9px}
.ui-ag__page{padding: 16px max(28px, calc((100% - 560px) / 2)) 24px}
.ui-ag__hero{display: flex;align-items: flex-start;justify-content: space-between}
.ui-ag__logo{width: 30px;height: 30px;border-radius: 8px}
.ui-ag__sync{display: inline-flex;align-items: center;gap: 6px;font-size: 11px;color: var(--ui-ag-muted)}
.ui-ag__page h3{margin: 8px 0 2px;font-size: 15px;font-weight: 600;letter-spacing: -0.01em;color: var(--ui-ag-ink)}
.ui-ag__sub{margin: 0 0 12px;font-size: 11px;color: var(--ui-ag-muted)}
.ui-ag__kpis{display: grid;grid-template-columns: repeat(4, minmax(0, 1fr));margin-bottom: 12px}
.ui-ag__kpis > div{display: grid;grid-template-columns: minmax(0, 1fr) 54px;grid-template-areas: "label spark" "value spark";column-gap: 8px;padding: 0 12px;border-left: 1px solid var(--ui-ag-screen-line)}
.ui-ag__kpis > div:first-child{padding-left: 0;border-left: 0}
.ui-ag__kpis span{grid-area: label;font-size: 10.5px;color: var(--ui-ag-muted);white-space: nowrap}
.ui-ag__kpis b{grid-area: value;font-size: 15px;font-weight: 600;letter-spacing: -0.02em;color: var(--ui-ag-ink);font-variant-numeric: tabular-nums}
.ui-ag__screen .ui-ag__spark{grid-area: spark;align-self: end;width: 54px;height: 20px;margin-bottom: 2px;overflow: visible}
.ui-ag__spark path{fill: none;stroke-width: 1.6;stroke-linecap: round;stroke-linejoin: round}
.ui-ag__tabs{display: flex;gap: 16px;margin: 0 -400px 14px;padding: 0 400px;border-bottom: 1px solid var(--ui-ag-screen-line)}
.ui-ag__tabs > *{padding: 0 1px 8px;font-size: 11.5px;color: var(--ui-ag-muted)}
.ui-ag__tabs b{font-weight: 500;color: var(--ui-ag-ink);box-shadow: inset 0 -1.5px 0 var(--ui-ag-ink)}
.ui-ag__page h4{margin: 0;font-size: 13px;font-weight: 600;color: var(--ui-ag-ink)}
.ui-ag__hint{margin: 3px 0 12px;font-size: 11px;color: var(--ui-ag-muted)}
.ui-ag__toolbar{display: flex;gap: 6px;margin-bottom: 14px}
.ui-ag__search, .ui-ag__filter{display: flex;align-items: center;gap: 7px;height: 30px;padding: 0 10px;border-radius: 10px;background: var(--ui-ag-screen);box-shadow: inset 0 0 0 1px var(--ui-ag-chip-line);font-size: 11px;color: var(--ui-ag-muted)}
.ui-ag__search{flex: 1}
.ui-ag__filter{color: var(--ui-ag-ink)}
.ui-ag__feed{position: relative;display: grid;gap: 12px;margin: 0;padding: 0;list-style: none}
.ui-ag__feed::before{content: "";position: absolute;left: 12px;top: 24px;bottom: 8px;width: 1px;background: var(--ui-ag-screen-line)}
.ui-ag__feed li{position: relative;display: grid;grid-template-columns: 25px 1fr;gap: 10px;align-items: start}
.ui-ag__compose .ui-ag__avatar{width: 25px;height: 25px;font-size: 8.5px}
.ui-ag__box{display: grid;gap: 18px;padding: 10px 10px 8px 12px;border-radius: 12px;background: var(--ui-ag-screen);box-shadow: inset 0 0 0 1px var(--ui-ag-chip-line), 0 1px 2px rgba(11, 9, 8, 0.04);color: var(--ui-ag-muted)}
.ui-ag__box-foot{display: flex;align-items: center;justify-content: space-between}
.ui-ag__box-foot b{padding: 4px 9px;border-radius: 8px;background: var(--ui-ag-soft);font-size: 10.5px;font-weight: 500;color: var(--ui-ag-ink)}
.ui-ag__dot{display: grid;place-items: center;width: 25px;height: 25px;border-radius: 50%;background: var(--ui-ag-page);box-shadow: inset 0 0 0 1px var(--ui-ag-chip-line);color: var(--ui-ag-muted)}
.ui-ag__dot svg{width: 12px;height: 12px}
.ui-ag__dot--app{background: linear-gradient(135deg, var(--a), var(--b));box-shadow: none;color: #fffdfb}
.ui-ag__line{display: flex;flex-wrap: wrap;align-items: center;gap: 5px;margin: 5px 0 0;color: var(--ui-ag-muted)}
.ui-ag__line b{font-weight: 500;color: var(--ui-ag-ink)}
.ui-ag__ext{width: 9px;height: 11px;border-radius: 2px;background: #e2544a}
.ui-ag__ext[data-kind="csv"]{background: #2f8d5c}
.ui-ag__card{margin: 7px 0 0;padding: 9px 12px;border-radius: 10px;background: var(--ui-ag-screen);box-shadow: inset 0 0 0 1px var(--ui-ag-chip-line), 0 1px 2px rgba(11, 9, 8, 0.04);line-height: 1.5;color: var(--ui-ag-ink)}
.ui-ag__foot{display: flex;align-items: flex-start;justify-content: space-between;gap: 24px;width: var(--ui-ag-open);margin: 26px auto 0}
.ui-ag__caption{max-width: 520px;margin: 0;font-size: 19px;line-height: 1.45;letter-spacing: -0.01em;color: var(--ui-ag-muted);animation: ui-ag-fade var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-ag__caption b{font-weight: 500;color: var(--ui-ag-ink)}
.ui-ag__arrows{display: flex;flex: none;border-radius: 12px;background: var(--ui-ag-btn);box-shadow: 0 0 0 1px var(--ui-ag-chip-line), 0 1px 2px rgba(11, 9, 8, 0.05)}
.ui-ag__arrows button{display: grid;place-items: center;width: 42px;height: 38px;padding: 0;border: 0;background: none;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-ag__arrows button:first-child{border-radius: 12px 0 0 12px;box-shadow: 1px 0 0 var(--ui-ag-chip-line)}
.ui-ag__arrows button:last-child{border-radius: 0 12px 12px 0}
.ui-ag__arrows button:hover{background: var(--ui-ag-soft)}
.ui-ag__arrows svg{width: 17px;height: 17px;fill: none;stroke: currentColor;stroke-width: 1.8;stroke-linecap: round;stroke-linejoin: round}
@keyframes ui-ag-fade{from{opacity: 0}
}
@container (max-width: 760px){.ui-ag{--ui-ag-height: 400px;--ui-ag-side: 56px;--ui-ag-gap: 10px}
.ui-ag{--ui-ag-open: calc(100cqw - 2 * (var(--ui-ag-side) + var(--ui-ag-gap)) - 24px)}
.ui-ag__label{font-size: 14px}
.ui-ag__pick{padding: 0 0 16px 10px}
.ui-ag__screen{top: 40px;left: 22px}
.ui-ag__foot{width: calc(100cqw - 40px)}
.ui-ag__caption{font-size: 16px}
.ui-ag__head h2{font-size: 24px}
}
@media (prefers-reduced-motion: reduce){.ui-ag__track, .ui-ag__panel, .ui-ag__art{transition: none}
.ui-ag__caption, .ui-ag__pick{animation: none}
.ui-ag__screen, .ui-ag__panel[data-open] .ui-ag__screen{transition: none}
}
:where(.dark, [data-theme="dark"]) .ui-ag{--ui-ag-ink: #ebe3da;--ui-ag-text: #b4a89d;--ui-ag-muted: #857567;--ui-ag-base-top: #27201a;--ui-ag-base-bottom: #1f1915;--ui-ag-screen: #27201a;--ui-ag-page: #211b16;--ui-ag-screen-line: rgba(255, 253, 251, 0.08);--ui-ag-chip: #2b231b;--ui-ag-chip-line: rgba(255, 253, 251, 0.08);--ui-ag-soft: #2b231b;--ui-ag-btn: #27201a;--ui-ag-shine: rgba(255, 253, 251, 0.08);--ui-ag-ok: #4f9d6e;--ui-ag-ok-bg: rgba(79, 157, 110, 0.14)}

`;
