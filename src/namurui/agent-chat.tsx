"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/*
 * Agent Chat — the conversation screen of an orchestrating agent.
 *
 * The shell is the app frame: the workspace and menu in a collapsible sidebar with the
 * changelog card, the getting-started steps and the account; the conversation in a bordered
 * panel beside it. Inside the panel sit the three things that belong together — the thread,
 * the agents the orchestrator has put to work, and the brief it keeps open while it asks the
 * one question it cannot answer alone.
 *
 * Motion is the sheet's: the sidebar folds through the shell's grid track and becomes a
 * drawer under 900px of shell width, the brief panel rises when its tab changes, and the
 * thread follows a message the moment it is sent. The geometry the original set inline — the
 * getting-started card, its progress track, the composer's field height, the palette and
 * format previews — stays inline, with the same values.
 */

/** A glyph the sidebar menu can draw. */
export type NavGlyph =
  | "home"
  | "chat"
  | "analytics"
  | "plan"
  | "deliverables"
  | "slack"
  | "campaign"
  | "creatives"
  | "briefs"
  | "workflows";

/** A glyph a working agent's chip can draw. */
export type AgentGlyph = "campaign" | "brand" | "pipeline" | "audience" | "direction";

/** A mark a brief channel row can draw. */
export type ChannelGlyph = "instagram" | "tiktok" | "facebook";

/** A glyph a brief detail row can draw. */
export type DetailGlyph = "launch" | "budget" | "markets";

/** The brief's three sections. */
export type BriefTab = "Brief" | "Assets" | "Activity";

/** One row of the sidebar menu. */
export type ChatNavItem = {
  /** Text on the row, and the label handed to `onNavigate` */
  label: string;
  /** Glyph drawn before the label */
  glyph: NavGlyph;
  /** Marks the page that is open */
  current?: boolean;
};

/** A block of sidebar rows; `label` draws the small heading above them. */
export type ChatNavGroup = {
  label?: string;
  items: ChatNavItem[];
};

/** An agent the orchestrator has running. */
export type ChatAgent = {
  /** Shown on the chip */
  name: string;
  glyph: AgentGlyph;
  /** The agent currently in the foreground */
  active?: boolean;
};

/** One selling angle in the brief, with how strongly the product data supports it. */
export type ChatAngle = {
  name: string;
  /** The line under the angle */
  note: string;
  /** How many of the three signal bars are lit */
  signal: 1 | 2 | 3;
  /** Chosen when the screen first renders */
  selected?: boolean;
};

/** A channel the campaign runs on. */
export type ChatChannel = {
  name: string;
  note: string;
  glyph: ChannelGlyph;
  /** Switch state when the screen first renders */
  enabled: boolean;
};

/** The brief the agent keeps beside the thread. */
export type ChatBrief = {
  /** Title in the brief's own breadcrumb */
  name: string;
  product: { name: string; meta: string; chip?: string };
  angles: ChatAngle[];
  audience: string[];
  channels: ChatChannel[];
  /** Swatch label and the product's own colour */
  palette: { name: string; color: string }[];
  /** Ad format label and the aspect ratio drawn in its preview box */
  formats: { name: string; ratio: string }[];
  details: { label: string; value: string; glyph: DetailGlyph }[];
  /** Pills beside the primary action, e.g. "6 ads", "~2 min" */
  tags: string[];
  /** Label on the primary action */
  generateLabel?: string;
};

/** The orchestrator's turn, and the agents it has running. */
export type ChatTurn = {
  /** Breadcrumb after "Chat" */
  title: string;
  /** The message the user sent, shown as their bubble */
  question: string;
  /** Name beside the avatar */
  who: string;
  /** First line, above the worked-for row */
  intro: string;
  /** The row that opens the tool calls behind the answer */
  worked: string;
  /** Body paragraphs after the worked row */
  paragraphs: string[];
  /** Label above the agent chips */
  agentsLabel: string;
  agents: ChatAgent[];
};

export type AgentChatScreenProps = {
  /** Extra class on the root */
  className?: string;
  /** Workspace name; its first letter is the logo tile */
  workspace?: string;
  /** Menu rows, in groups */
  nav?: ChatNavGroup[];
  /** Conversations under the menu; an empty list shows the empty line */
  chats?: string[];
  /** The "what's new" card above the account; the kicker defaults to `New in <workspace>` */
  news?: { title: string; more: string; kicker?: string; count?: number };
  /** Getting-started card in the sidebar foot */
  guide?: { title: string; percent: number; cheer: string; height?: number };
  /** Account at the bottom; two initials are derived from the name when omitted */
  user?: { name: string; initials?: string };
  /** The orchestrator's turn */
  turn?: ChatTurn;
  /** The composer's route line */
  route?: { name: string; hint: string };
  /** The brief beside the thread */
  brief?: ChatBrief;
  /** Rows for the Activity tab */
  activity?: { text: string; note: string }[];
  /** The Assets tab line shown before anything is generated */
  assetsNote?: string;
  /** Selling angle selected on the first render; defaults to the brief's `selected` angle */
  initialAngle?: string;
  /** Whether the brief starts open */
  defaultBriefOpen?: boolean;
  /** Called with the message text when the composer is submitted */
  onSend?: (text: string) => void;
  /** Called when another selling angle is chosen */
  onAngleChange?: (name: string) => void;
  /** Called when a channel switch is flipped */
  onChannelChange?: (name: string, on: boolean) => void;
  /** Called when the brief's primary action is pressed */
  onGenerate?: () => void;
  /** Called with a sidebar label */
  onNavigate?: (label: string) => void;
};

/* ---------- Defaults: the reference's own content ---------- */

const DEFAULT_NAV: ChatNavGroup[] = [
  {
    items: [
      { label: "Home", glyph: "home" },
      { label: "Chat", glyph: "chat", current: true },
      { label: "Analytics", glyph: "analytics" },
      { label: "Plan", glyph: "plan" },
      { label: "Deliverables", glyph: "deliverables" },
      { label: "On Slack", glyph: "slack" },
    ],
  },
  {
    label: "Tools",
    items: [
      { label: "Campaign", glyph: "campaign" },
      { label: "Creatives", glyph: "creatives" },
      { label: "Briefs", glyph: "briefs" },
      { label: "Workflows", glyph: "workflows" },
    ],
  },
];

const DEFAULT_TURN: ChatTurn = {
  title: "Generate on-brand creative",
  question: "Desire-driven",
  who: "Orchestrator",
  intro: "I'll pull your bestseller first, then line up the creative generation.",
  worked: "Worked for 3m 38s",
  paragraphs: [
    "Your bestseller is the Linen Overshirt (the only product synced so far – Shopify is still importing, so treat that ranking as provisional).",
    "Before I brief and generate the ads, I need one thing I can't infer, because it drives the whole copy structure: how should we sell this shirt?",
  ],
  agentsLabel: "Agents working",
  agents: [
    { name: "Campaign manager", glyph: "campaign", active: true },
    { name: "Brand research", glyph: "brand" },
    { name: "Creative pipeline", glyph: "pipeline" },
    { name: "Audience research", glyph: "audience" },
    { name: "Creative direction", glyph: "direction" },
  ],
};

const DEFAULT_BRIEF: ChatBrief = {
  name: "Summer launch",
  product: { name: "Linen Overshirt", meta: "$89 · 412 sold this month", chip: "Bestseller" },
  angles: [
    { name: "Desire-driven", note: "The first warm evening", signal: 3, selected: true },
    { name: "Problem–solution", note: "Heat, itchy fabrics", signal: 2 },
    { name: "Social proof", note: "412 sold, top reviews", signal: 1 },
  ],
  audience: ["Women 25–34", "Urban", "Warm climates", "Linen & natural fabrics"],
  channels: [
    { name: "Instagram", note: "Feed and Stories", glyph: "instagram", enabled: true },
    { name: "TikTok", note: "Story format only", glyph: "tiktok", enabled: true },
    { name: "Facebook", note: "Feed and Banner", glyph: "facebook", enabled: false },
  ],
  palette: [
    { name: "Sand", color: "rgb(227, 211, 184)" },
    { name: "Olive", color: "rgb(124, 132, 88)" },
    { name: "Off-white", color: "rgb(244, 241, 234)" },
    { name: "Ink", color: "rgb(31, 35, 40)" },
  ],
  formats: [
    { name: "Feed", ratio: "1 / 1" },
    { name: "Story", ratio: "9 / 16" },
    { name: "Banner", ratio: "16 / 9" },
  ],
  details: [
    { label: "Launch", value: "Mon, Jun 2", glyph: "launch" },
    { label: "Budget", value: "$2,400 / week", glyph: "budget" },
    { label: "Markets", value: "US, UK, AU", glyph: "markets" },
  ],
  tags: ["6 ads", "~2 min"],
  generateLabel: "Generate ads",
};

const DEFAULT_ACTIVITY = [
  { text: "Orchestrator read the product catalog", note: "Worked 3m 38s · 2m ago" },
  { text: "Brand research opened the spring lookbook", note: "Running · just now" },
  { text: "Campaign manager is waiting on the selling angle", note: "Queued" },
];

const BRIEF_TABS: BriefTab[] = ["Brief", "Assets", "Activity"];

const NAV_GLYPH: Record<NavGlyph, ReactNode> = {
  home: <IconHome />,
  chat: <IconChat />,
  analytics: <IconAnalytics />,
  plan: <IconPlan />,
  deliverables: <IconDeliverables />,
  slack: <IconSlack />,
  campaign: <IconCampaign />,
  creatives: <IconCreatives />,
  briefs: <IconBriefs />,
  workflows: <IconWorkflows />,
};

const AGENT_GLYPH: Record<AgentGlyph, ReactNode> = {
  campaign: <IconAgentCampaign />,
  brand: <IconAgentBrand />,
  pipeline: <IconAgentPipeline />,
  audience: <IconAgentAudience />,
  direction: <IconAgentDirection />,
};

const CHANNEL_GLYPH: Record<ChannelGlyph, ReactNode> = {
  instagram: <IconInstagram />,
  tiktok: <IconTikTok />,
  facebook: <IconFacebook />,
};

const DETAIL_GLYPH: Record<DetailGlyph, ReactNode> = {
  launch: <IconLaunch />,
  budget: <IconBudget />,
  markets: <IconMarkets />,
};

/* ---------- The screen ---------- */

export function AgentChatScreen({
  className,
  workspace = "Acme",
  nav = DEFAULT_NAV,
  chats = [],
  news = { title: "Shared folders", more: "Full changelog", count: 2 },
  guide = { title: "Getting started", percent: 13, cheer: "Great start!" },
  user = { name: "Alex Morgan" },
  turn = DEFAULT_TURN,
  route = { name: "Orchestrator", hint: "Routes each request" },
  brief = DEFAULT_BRIEF,
  activity = DEFAULT_ACTIVITY,
  assetsNote = "Ads you generate land here, one card per channel and format.",
  initialAngle,
  defaultBriefOpen = true,
  onSend,
  onAngleChange,
  onChannelChange,
  onGenerate,
  onNavigate,
}: AgentChatScreenProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [collapsed, setCollapsed] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [newsOpen, setNewsOpen] = useState(true);
  const [briefOpen, setBriefOpen] = useState(defaultBriefOpen);
  const [tab, setTab] = useState<BriefTab>("Brief");
  const [angle, setAngle] = useState(
    () => initialAngle ?? brief.angles.find((option) => option.selected)?.name ?? brief.angles[0]?.name ?? "",
  );
  const [switchState, setSwitchState] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState("");
  const [fieldHeight, setFieldHeight] = useState(20);
  const [sent, setSent] = useState<{ id: number; text: string }[]>([]);
  const folderUid = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  // The shell measures itself: under 900px the sidebar is a drawer, not a column
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = (width: number) => setNarrow(width < 900);
    if (typeof ResizeObserver === "undefined") {
      measure(el.getBoundingClientRect().width);
      return;
    }
    const observer = new ResizeObserver((entries) => {
      measure(entries[0]?.contentRect.width ?? el.getBoundingClientRect().width);
    });
    observer.observe(el);
    measure(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!narrow) setDrawer(false);
  }, [narrow]);

  // Escape closes the drawer, the way a click on the scrim does
  useEffect(() => {
    if (!drawer) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setDrawer(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawer]);

  // The field grows with the draft, from the reference's 20px line up to a readable ceiling
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = "auto";
    setFieldHeight(Math.min(el.scrollHeight || 20, 160));
  }, [draft]);

  // Follow a message the moment it is sent, never the first paint
  useEffect(() => {
    const el = threadRef.current;
    if (!el || sent.length === 0) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [sent.length]);

  const openSidebar = () => {
    if (narrow) setDrawer(true);
    else setCollapsed(false);
  };

  const go = (label: string) => {
    onNavigate?.(label);
    if (narrow) setDrawer(false);
  };

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setSent((all) => [...all, { id: Date.now(), text }]);
    setDraft("");
    onSend?.(text);
  };

  const initials =
    user.initials ??
    user.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");

  const guideHeight = guide.height ?? 70;
  const generateLabel = brief.generateLabel ?? "Generate ads";
  const kicker = news.kicker ?? `New in ${workspace}`;

  return (
    <div
      ref={rootRef}
      className={["ui-as", "ui-as-app", className].filter(Boolean).join(" ")}
      data-collapsed={collapsed ? "true" : undefined}
      data-drawer={drawer ? "true" : undefined}
    >
      {/* React 19 hoists this into <head> once, no matter how many screens render */}
      <style href="ui-screen-agent-chat" precedence="default">
        {css}
      </style>

      <button
        className="ui-as-icon-btn ui-as-side-open"
        type="button"
        aria-label="Open sidebar"
        tabIndex={collapsed || narrow ? undefined : -1}
        onClick={openSidebar}
      >
        <IconPanel />
      </button>

      <div className="ui-as-scrim" aria-hidden="true" onClick={() => setDrawer(false)} />

      <aside className="ui-as-side" inert={narrow && !drawer ? true : undefined}>
        <header className="ui-as-side__head">
          <span className="ui-as-anchor">
            <button className="ui-as-side__workspace" type="button" aria-expanded="false" onClick={() => go(workspace)}>
              <span className="ui-as-side__logo">{workspace.charAt(0).toUpperCase()}</span>
              {workspace}
              <IconChevronDown />
            </button>
          </span>
          <span className="ui-as-side__tools">
            <button className="ui-as-icon-btn" type="button" aria-label="Search" onClick={() => go("Search")}>
              <IconSearch />
            </button>
            <button
              className="ui-as-icon-btn"
              type="button"
              aria-label={narrow ? "Close sidebar" : "Collapse sidebar"}
              onClick={() => {
                if (narrow) setDrawer(false);
                else setCollapsed(true);
              }}
            >
              <IconPanel />
            </button>
          </span>
        </header>

        <nav className="ui-as-side__nav" aria-label="Main menu">
          {nav.map((group, index) => (
            <div className="ui-as-side__group" key={group.label ?? `nav-${index}`}>
              {group.label ? <span className="ui-as-side__label">{group.label}</span> : null}
              {group.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="ui-as-side__item"
                  aria-current={item.current ? "page" : undefined}
                  onClick={() => go(item.label)}
                >
                  {NAV_GLYPH[item.glyph]}
                  {item.label}
                </button>
              ))}
            </div>
          ))}
          <div className="ui-as-side__group">
            <span className="ui-as-side__label">Chats</span>
            {chats.length > 0 ? (
              chats.map((chat) => (
                <button key={chat} type="button" className="ui-as-side__item" onClick={() => go(chat)}>
                  <IconChat />
                  {chat}
                </button>
              ))
            ) : (
              <span className="ui-as-side__empty">No chats yet</span>
            )}
          </div>
        </nav>

        <div className="ui-as-side__foot">
          {newsOpen ? (
            <div className="ui-as-news" data-count={news.count ?? 1}>
              <div className="ui-as-news__card ui-as-news__card--back" aria-hidden="true">
                <span className="ui-as-news__kicker">{kicker}</span>
                <IconClose />
              </div>
              <div className="ui-as-news__card">
                <div className="ui-as-news__top">
                  <span className="ui-as-news__kicker">{kicker}</span>
                  <button type="button" className="ui-as-news__close" aria-label="Dismiss" onClick={() => setNewsOpen(false)}>
                    <IconClose />
                  </button>
                </div>
                <b className="ui-as-news__title">{news.title}</b>
                <button type="button" className="ui-as-news__more" onClick={() => go(news.more)}>
                  {news.more}
                  <IconChevronRight />
                </button>
              </div>
            </div>
          ) : null}

          <div className="ui-as-guide-slot" style={{ height: guideHeight }}>
            <div className="ui-as-guide" data-state="closed" style={{ height: guideHeight }}>
              <div className="ui-as-guide__inner">
                <button
                  type="button"
                  className="ui-as-steps ui-as-guide__content"
                  aria-expanded="false"
                  onClick={() => go(guide.title)}
                >
                  <span className="ui-as-steps__title">
                    {guide.title}
                    <IconChevronRight />
                  </span>
                  <span className="ui-as-steps__sub">
                    {guide.percent}% done · <span className="ui-as-steps__cheer">{guide.cheer}</span>
                  </span>
                  <span className="ui-as-steps__bar">
                    <i style={{ width: `${guide.percent}%` }} />
                  </span>
                </button>
              </div>
            </div>
          </div>

          <span className="ui-as-anchor ui-as-user-menu">
            <button type="button" className="ui-as-user" aria-expanded="false" onClick={() => go("Account")}>
              <span className="ui-as-user__initials">{initials}</span>
              {user.name}
              <IconChevronDown />
            </button>
          </span>
        </div>
      </aside>

      <main className="ui-as-main">
        <div className="ui-as-chat" data-brief={briefOpen ? "true" : undefined}>
          <section className="ui-as-chat__main">
            <header className="ui-as-chat__bar">
              <span className="ui-as-chat__crumbs">
                <IconChatBreadcrumb />
                Chat <i>/</i> <b>{turn.title}</b>
                <span className="ui-as-anchor">
                  <button type="button" className="ui-as-icon-btn" aria-label="Chat options" aria-expanded="false">
                    <IconMore />
                  </button>
                </span>
              </span>
              <span className="ui-as-chat__tools">
                <button type="button" className="ui-as-icon-btn" aria-label="Tasks" onClick={() => go("Tasks")}>
                  <IconBriefs />
                </button>
                <button
                  type="button"
                  className="ui-as-icon-btn"
                  aria-label={briefOpen ? "Hide brief" : "Show brief"}
                  aria-pressed={briefOpen}
                  onClick={() => setBriefOpen((open) => !open)}
                >
                  <IconPanelRight />
                </button>
              </span>
            </header>

            <div className="ui-as-chat__thread" ref={threadRef}>
              <div className="ui-as-chat__column">
                <p className="ui-as-chat__user">{turn.question}</p>
                <div className="ui-as-chat__answer">
                  <span className="ui-as-chat__who">
                    <span className="ui-as-chat__avatar">
                      <IconOrchestrator />
                    </span>
                    {turn.who}
                  </span>
                  <p>{turn.intro}</p>
                  <span className="ui-as-chat__worked">
                    <IconChevronRight />
                    {turn.worked}
                  </span>
                  {turn.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  <span className="ui-as-chat__label">{turn.agentsLabel}</span>
                  <div className="ui-as-chat__agents">
                    {turn.agents.map((agent) => (
                      <span key={agent.name} className="ui-as-chat__agent" data-active={agent.active ? "true" : undefined}>
                        {AGENT_GLYPH[agent.glyph]}
                        {agent.name}
                      </span>
                    ))}
                  </div>
                </div>
                {sent.map((message) => (
                  <p className="ui-as-chat__user" key={message.id}>
                    {message.text}
                  </p>
                ))}
              </div>
            </div>

            <div className="ui-as-chat__composer">
              <span className="ui-as-chat__route">
                <span className="ui-as-chat__avatar">
                  <IconOrchestrator />
                </span>
                <b>{route.name}</b> {route.hint}
              </span>
              <form
                className="ui-as-composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  send();
                }}
              >
                <div className="ui-as-composer__card">
                  <textarea
                    ref={fieldRef}
                    className="ui-as-composer__field"
                    rows={1}
                    placeholder="Ask anything or @ to add context"
                    aria-label="Message"
                    style={{ height: fieldHeight }}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" || event.shiftKey) return;
                      event.preventDefault();
                      send();
                    }}
                  />
                  <div className="ui-as-composer__bar">
                    <button type="button" className="ui-as-icon-btn" aria-label="Add file" onClick={() => fileRef.current?.click()}>
                      <IconPlus />
                    </button>
                    <input ref={fileRef} multiple hidden type="file" />
                    <span className="ui-as-anchor">
                      <button type="button" className="ui-as-ghost" aria-expanded="false">
                        <IconPlugins />
                        Plugins
                      </button>
                    </span>
                    <span className="ui-as-composer__end">
                      <span className="ui-as-anchor">
                        <button type="button" className="ui-as-ghost ui-as-ghost--model" aria-expanded="false" aria-haspopup="menu">
                          <IconSparkle />
                          Auto
                          <IconChevronDownSmall />
                        </button>
                      </span>
                      <button type="button" className="ui-as-icon-btn ui-as-mic" aria-label="Dictate" aria-pressed="false">
                        <IconMic />
                      </button>
                      <button type="submit" className="ui-as-send" aria-label="Send" disabled={draft.trim().length === 0}>
                        <IconSend />
                      </button>
                    </span>
                  </div>
                </div>

                <div className="ui-as-composer__tray">
                  <span className="ui-as-anchor">
                    <button type="button" className="ui-as-tray-link" aria-expanded="false">
                      <span className="ui-as-tray-link__folder">
                        <div className="ui-fd" role="img" aria-label="">
                          <FolderMark uid={folderUid} />
                        </div>
                      </span>
                      Work in a folder
                    </button>
                  </span>
                  <span className="ui-as-anchor">
                    <button type="button" className="ui-as-tray-link ui-as-tray-link--apps" aria-expanded="false">
                      Connect apps
                      <span className="ui-as-apps" aria-hidden="true">
                        <IconGmail />
                        <IconSlackBrand />
                        <IconFigma />
                      </span>
                    </button>
                  </span>
                </div>
              </form>
            </div>
          </section>

          {briefOpen ? (
            <div className="ui-as-chat__scrim" aria-hidden="true" onClick={() => setBriefOpen(false)} />
          ) : null}

          {briefOpen ? (
            <aside className="ui-as-brief" aria-label="Brief">
              <header className="ui-as-chat__bar">
                <span className="ui-as-chat__crumbs">
                  Brief <i>/</i> <b>{brief.name}</b>
                </span>
                <button type="button" className="ui-as-icon-btn" aria-label="Close brief" onClick={() => setBriefOpen(false)}>
                  <IconCloseLarge />
                </button>
              </header>

              <div className="ui-as-brief__body">
                <div className="ui-as-brief__seg" role="tablist" aria-label="Brief sections">
                  {BRIEF_TABS.map((name) => (
                    <button key={name} type="button" role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>
                      {name}
                    </button>
                  ))}
                </div>

                <div className="ui-as-brief__panel" key={tab}>
                  {tab === "Brief" ? (
                    <>
                      <div className="ui-as-brief__product">
                        <span className="ui-as-brief__thumb">
                          <IconShirt />
                        </span>
                        <span className="ui-as-brief__pinfo">
                          <b>{brief.product.name}</b>
                          <span>{brief.product.meta}</span>
                        </span>
                        {brief.product.chip ? <span className="ui-as-brief__chip">{brief.product.chip}</span> : null}
                      </div>

                      <section className="ui-as-brief__section">
                        <span className="ui-as-brief__label">Selling angle</span>
                        {brief.angles.map((option) => (
                          <button
                            key={option.name}
                            type="button"
                            role="radio"
                            aria-checked={angle === option.name}
                            className="ui-as-brief__option"
                            onClick={() => {
                              if (option.name === angle) return;
                              setAngle(option.name);
                              onAngleChange?.(option.name);
                            }}
                          >
                            <span className="ui-as-brief__radio" aria-hidden="true" />
                            <span className="ui-as-brief__name">
                              {option.name}
                              <small>{option.note}</small>
                            </span>
                            <span className="ui-as-brief__signal" aria-label={`Signal ${option.signal} of 3`}>
                              {[0, 1, 2].map((bar) => (
                                <i key={bar} data-on={bar < option.signal ? "true" : undefined} />
                              ))}
                            </span>
                          </button>
                        ))}
                      </section>

                      <section className="ui-as-brief__section">
                        <span className="ui-as-brief__label">Audience</span>
                        <div className="ui-as-brief__pills">
                          {brief.audience.map((item) => (
                            <span key={item}>{item}</span>
                          ))}
                        </div>
                      </section>

                      <section className="ui-as-brief__section">
                        <span className="ui-as-brief__label">Channels</span>
                        {brief.channels.map((channel) => {
                          const on = switchState[channel.name] ?? channel.enabled;
                          return (
                            <label className="ui-as-brief__channel" key={channel.name}>
                              {CHANNEL_GLYPH[channel.glyph]}
                              <span className="ui-as-brief__name">
                                {channel.name}
                                <small>{channel.note}</small>
                              </span>
                              <input
                                className="ui-as-switch"
                                type="checkbox"
                                checked={on}
                                onChange={() => {
                                  setSwitchState((all) => ({ ...all, [channel.name]: !on }));
                                  onChannelChange?.(channel.name, !on);
                                }}
                              />
                            </label>
                          );
                        })}
                      </section>

                      <section className="ui-as-brief__section ui-as-brief__section--split">
                        <div>
                          <span className="ui-as-brief__label">Palette</span>
                          <div className="ui-as-brief__swatches">
                            {brief.palette.map((swatch) => (
                              <span key={swatch.name}>
                                <i style={{ background: swatch.color }} />
                                {swatch.name}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="ui-as-brief__label">Formats</span>
                          <div className="ui-as-brief__formats">
                            {brief.formats.map((format) => (
                              <span key={format.name}>
                                <i style={{ aspectRatio: format.ratio }} />
                                {format.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      </section>

                      <section className="ui-as-brief__section">
                        <span className="ui-as-brief__label">Details</span>
                        <dl className="ui-as-brief__details">
                          {brief.details.map((detail) => (
                            <div key={detail.label}>
                              <dt>
                                {DETAIL_GLYPH[detail.glyph]}
                                {detail.label}
                              </dt>
                              <dd>{detail.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </section>

                      <div className="ui-as-brief__go">
                        <span className="ui-as-brief__tags">
                          {brief.tags.map((tag) => (
                            <span key={tag}>{tag}</span>
                          ))}
                        </span>
                        <button
                          type="button"
                          className="ui-button"
                          data-variant="primary"
                          data-size="sm"
                          data-ready="true"
                          onClick={() => onGenerate?.()}
                        >
                          <span className="ui-button__label" data-text={generateLabel}>
                            {generateLabel}
                          </span>
                        </button>
                      </div>
                    </>
                  ) : null}

                  {tab === "Assets" ? (
                    <div className="ui-as-brief__assets">
                      <div className="ui-as-brief__empty">
                        <span>
                          <IconCreatives />
                        </span>
                        <b>No ads yet</b>
                        <p>{assetsNote}</p>
                        <button
                          type="button"
                          className="ui-button"
                          data-variant="primary"
                          data-size="sm"
                          data-ready="true"
                          onClick={() => onGenerate?.()}
                        >
                          <span className="ui-button__label" data-text={generateLabel}>
                            {generateLabel}
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {tab === "Activity" ? (
                    <ul className="ui-as-activity">
                      {activity.map((entry) => (
                        <li key={entry.text}>
                          <span className="ui-as-activity__icon">
                            <IconOrchestrator />
                          </span>
                          <span className="ui-as-activity__text">
                            {entry.text}
                            <small>{entry.note}</small>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </aside>
          ) : null}
        </div>
      </main>
    </div>
  );
}

/* ---------- Icons: paths lifted verbatim from the reference DOM ---------- */

function IconPanel() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M2 12C2 8.31087 2 6.4663 2.81382 5.15877C3.1149 4.67502 3.48891 4.25427 3.91891 3.91554C5.08116 3 6.72077 3 10 3H14C17.2792 3 18.9188 3 20.0811 3.91554C20.5111 4.25427 20.8851 4.67502 21.1862 5.15877C22 6.4663 22 8.31087 22 12C22 15.6891 22 17.5337 21.1862 18.8412C20.8851 19.325 20.5111 19.7457 20.0811 20.0845C18.9188 21 17.2792 21 14 21H10C6.72077 21 5.08116 21 3.91891 20.0845C3.48891 19.7457 3.1149 19.325 2.81382 18.8412C2 17.5337 2 15.6891 2 12Z" stroke="currentColor" strokeWidth="1.9" />
      <path d="M9.5 3L9.5 21" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M5 7H6M5 10H6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M17 17L21 21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconHome() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M3 11.9896V14.5C3 17.7998 3 19.4497 4.02513 20.4749C5.05025 21.5 6.70017 21.5 10 21.5H14C17.2998 21.5 18.9497 21.5 19.9749 20.4749C21 19.4497 21 17.7998 21 14.5V11.9896C21 10.3083 21 9.46773 20.6441 8.74005C20.2882 8.01237 19.6247 7.49628 18.2976 6.46411L16.2976 4.90855C14.2331 3.30285 13.2009 2.5 12 2.5C10.7991 2.5 9.76689 3.30285 7.70242 4.90855L5.70241 6.46411C4.37533 7.49628 3.71179 8.01237 3.3559 8.74005C3 9.46773 3 10.3083 3 11.9896Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M21.5 12C21.5 17.2467 17.2467 21.5 12 21.5C10.3719 21.5 8.8394 21.0904 7.5 20.3687C5.63177 19.362 4.37462 20.2979 3.26592 20.4658C3.09774 20.4913 2.93024 20.4302 2.80997 20.31C2.62741 20.1274 2.59266 19.8451 2.6935 19.6074C3.12865 18.5818 3.5282 16.6382 2.98341 15C2.6698 14.057 2.5 13.0483 2.5 12C2.5 6.75329 6.75329 2.5 12 2.5C17.2467 2.5 21.5 6.75329 21.5 12Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M12.1257 12H12.0007M8.125 12H8M16.125 12H16M12.2507 12C12.2507 12.1381 12.1388 12.25 12.0007 12.25C11.8627 12.25 11.7507 12.1381 11.7507 12C11.7507 11.8619 11.8627 11.75 12.0007 11.75C12.1388 11.75 12.2507 11.8619 12.2507 12ZM8.25 12C8.25 12.1381 8.13807 12.25 8 12.25C7.86193 12.25 7.75 12.1381 7.75 12C7.75 11.8619 7.86193 11.75 8 11.75C8.13807 11.75 8.25 11.8619 8.25 12ZM16.25 12C16.25 12.1381 16.1381 12.25 16 12.25C15.8619 12.25 15.75 12.1381 15.75 12C15.75 11.8619 15.8619 11.75 16 11.75C16.1381 11.75 16.25 11.8619 16.25 12Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconAnalytics() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M7 17L7 13" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M12 17L12 7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M17 17L17 11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconPlan() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M14.4961 2.00027H9.49609C8.66767 2.00027 7.99609 2.67184 7.99609 3.50027C7.99609 4.32869 8.66767 5.00027 9.49609 5.00027H14.4961C15.3245 5.00027 15.9961 4.32869 15.9961 3.50027C15.9961 2.67184 15.3245 2.00027 14.4961 2.00027Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M15.9961 3.50027C17.5496 3.54708 18.4761 3.72034 19.1174 4.36163C19.9961 5.24031 19.9961 6.6545 19.9961 9.4829L19.9961 15.9997C19.9961 18.8282 19.9961 20.2424 19.1174 21.1211C18.2387 21.9997 16.8245 21.9997 13.9961 21.9997L9.99609 21.9997C7.16767 21.9997 5.75346 21.9997 4.87478 21.1211C3.9961 20.2424 3.9961 18.8282 3.99609 15.9998L3.99611 9.48295C3.9961 6.65452 3.9961 5.2403 4.87478 4.36162C5.51606 3.72033 6.44261 3.54708 7.99599 3.50027" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M7.49609 11.0003L8.49609 12.0003L10.4961 9.50027" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M13.5 17.0003H16.5M13.5 11.0003H16.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M8.625 17.0003H8.5M8.75 17.0003C8.75 17.1383 8.63807 17.2503 8.5 17.2503C8.36193 17.2503 8.25 17.1383 8.25 17.0003C8.25 16.8622 8.36193 16.7503 8.5 16.7503C8.63807 16.7503 8.75 16.8622 8.75 17.0003Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconDeliverables() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M8 7H16.75C18.8567 7 19.91 7 20.6667 7.50559C20.9943 7.72447 21.2755 8.00572 21.4944 8.33329C22 9.08996 22 10.1433 22 12.25C22 15.7612 22 17.5167 21.1573 18.7779C20.7926 19.3238 20.3238 19.7926 19.7779 20.1573C18.5167 21 16.7612 21 13.25 21H12C7.28595 21 4.92893 21 3.46447 19.5355C2 18.0711 2 15.714 2 11V7.94427C2 6.1278 2 5.21956 2.38032 4.53806C2.65142 4.05227 3.05227 3.65142 3.53806 3.38032C4.21956 3 5.1278 3 6.94427 3C8.10802 3 8.6899 3 9.19926 3.19101C10.3622 3.62712 10.8418 4.68358 11.3666 5.73313L12 7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconSlack() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M13 9.25V3.75C13 2.7835 13.7835 2 14.75 2C15.7165 2 16.5 2.7835 16.5 3.75V9.25C16.5 10.2165 15.7165 11 14.75 11C13.7835 11 13 10.2165 13 9.25Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M7.5 20.25V14.75C7.5 13.7835 8.2835 13 9.25 13C10.2165 13 11 13.7835 11 14.75V20.25C11 21.2165 10.2165 22 9.25 22C8.2835 22 7.5 21.2165 7.5 20.25Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M14.75 13L20.25 13C21.2165 13 22 13.7835 22 14.75C22 15.7165 21.2165 16.5 20.25 16.5L14.75 16.5C13.7835 16.5 13 15.7165 13 14.75C13 13.7835 13.7835 13 14.75 13Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M3.75 7.5L9.25 7.5C10.2165 7.5 11 8.2835 11 9.25C11 10.2165 10.2165 11 9.25 11L3.75 11C2.7835 11 2 10.2165 2 9.25C2 8.2835 2.7835 7.5 3.75 7.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M7 3.75C7 4.7165 7.7835 5.5 8.75 5.5H10.5V3.75C10.5 2.7835 9.7165 2 8.75 2C7.7835 2 7 2.7835 7 3.75Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M17 20.25C17 19.2835 16.2165 18.5 15.25 18.5H13.5V20.25C13.5 21.2165 14.2835 22 15.25 22C16.2165 22 17 21.2165 17 20.25Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M20.25 7C19.2835 7 18.5 7.7835 18.5 8.75L18.5 10.5H20.25C21.2165 10.5 22 9.7165 22 8.75C22 7.7835 21.2165 7 20.25 7Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M3.75 17C4.7165 17 5.5 16.2165 5.5 15.25V13.5L3.75 13.5C2.7835 13.5 2 14.2835 2 15.25C2 16.2165 2.7835 17 3.75 17Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconCampaign() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M9 14V6H6C5.07003 6 4.60504 6 4.22354 6.10222C3.18827 6.37962 2.37962 7.18827 2.10222 8.22354C2 8.60504 2 9.07003 2 10C2 10.93 2 11.395 2.10222 11.7765C2.37962 12.8117 3.18827 13.6204 4.22354 13.8978C4.60504 14 5.07003 14 6 14H9Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M9 14L9.96466 18.8233C9.98816 18.9408 10 19.0604 10 19.1802V19.3411C10 20.2573 9.25728 21 8.34109 21C7.55885 21 6.8829 20.4536 6.719 19.6887L5.5 14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M10 6H9V14H10C11.2982 14 12.5614 14.4211 13.6 15.2L15.747 16.8103C15.9112 16.9334 16.111 17 16.3162 17C16.7246 17 17.0909 16.7404 17.2088 16.3495C17.5537 15.2067 18 13.2728 18 10C18 6.72718 17.5537 4.79327 17.2088 3.65054C17.0909 3.25961 16.7246 3 16.3162 3C16.111 3 15.9112 3.06658 15.747 3.18974L13.6 4.8C12.5614 5.57893 11.2982 6 10 6Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M21 9.99996H22M20.5 6.00109L21.5 5.40637M20.5 14L21.5 14.6481" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconCreatives() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="1.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z" stroke="currentColor" strokeWidth="1.9" />
      <path d="M5 21C9.37246 15.775 14.2741 8.88406 21.4975 13.5424" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  );
}

function IconBriefs() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M11 6L21 6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M11 12L21 12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M11 18L21 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M3 7.39286C3 7.39286 4 8.04466 4.5 9C4.5 9 6 5.25 8 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M3 18.3929C3 18.3929 4 19.0447 4.5 20C4.5 20 6 16.25 8 15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconWorkflows() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M3 4C3 2.34533 3.34533 2 5 2H9C10.6547 2 11 2.34533 11 4C11 5.65467 10.6547 6 9 6H5C3.34533 6 3 5.65467 3 4Z" stroke="currentColor" strokeWidth="1.9" />
      <path d="M13 13C13 11.3453 13.3453 11 15 11H19C20.6547 11 21 11.3453 21 13C21 14.6547 20.6547 15 19 15H15C13.3453 15 13 14.6547 13 13Z" stroke="currentColor" strokeWidth="1.9" />
      <path d="M4 20C4 18.3453 4.34533 18 6 18H10C11.6547 18 12 18.3453 12 20C12 21.6547 11.6547 22 10 22H6C4.34533 22 4 21.6547 4 20Z" stroke="currentColor" strokeWidth="1.9" />
      <path d="M17 11C17 10.5353 17 10.303 16.9616 10.1098C16.8038 9.31644 16.1836 8.69624 15.3902 8.53843C15.197 8.5 14.9647 8.5 14.5 8.5H9.5C9.03534 8.5 8.80302 8.5 8.60982 8.46157C7.81644 8.30376 7.19624 7.68356 7.03843 6.89018C7 6.69698 7 6.46466 7 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M17 15V16C17 17.8856 17 18.8284 16.4142 19.4142C15.8284 20 14.8856 20 13 20H12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconChatBreadcrumb() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M21.5 12C21.5 17.2467 17.2467 21.5 12 21.5C10.3719 21.5 8.8394 21.0904 7.5 20.3687C5.63177 19.362 4.37462 20.2979 3.26592 20.4658C3.09774 20.4913 2.93024 20.4302 2.80997 20.31C2.62741 20.1274 2.59266 19.8451 2.6935 19.6074C3.12865 18.5818 3.5282 16.6382 2.98341 15C2.6698 14.057 2.5 13.0483 2.5 12C2.5 6.75329 6.75329 2.5 12 2.5C17.2467 2.5 21.5 6.75329 21.5 12Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M12.1257 12H12.0007M8.125 12H8M16.125 12H16M12.2507 12C12.2507 12.1381 12.1388 12.25 12.0007 12.25C11.8627 12.25 11.7507 12.1381 11.7507 12C11.7507 11.8619 11.8627 11.75 12.0007 11.75C12.1388 11.75 12.2507 11.8619 12.2507 12ZM8.25 12C8.25 12.1381 8.13807 12.25 8 12.25C7.86193 12.25 7.75 12.1381 7.75 12C7.75 11.8619 7.86193 11.75 8 11.75C8.13807 11.75 8.25 11.8619 8.25 12ZM16.25 12C16.25 12.1381 16.1381 12.25 16 12.25C15.8619 12.25 15.75 12.1381 15.75 12C15.75 11.8619 15.8619 11.75 16 11.75C16.1381 11.75 16.25 11.8619 16.25 12Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconMore() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M6.00449 12.5V12M18.0045 12.5V12M12.0045 12.5V12M7.00449 12.5C7.00449 11.9477 6.55677 11.5 6.00449 11.5C5.4522 11.5 5.00449 11.9477 5.00449 12.5C5.00449 13.0523 5.4522 13.5 6.00449 13.5C6.55677 13.5 7.00449 13.0523 7.00449 12.5ZM19.0045 12.5C19.0045 11.9477 18.5568 11.5 18.0045 11.5C17.4522 11.5 17.0045 11.9477 17.0045 12.5C17.0045 13.0523 17.4522 13.5 18.0045 13.5C18.5568 13.5 19.0045 13.0523 19.0045 12.5ZM13.0045 12.5C13.0045 11.9477 12.5568 11.5 12.0045 11.5C11.4522 11.5 11.0045 11.9477 11.0045 12.5C11.0045 13.0523 11.4522 13.5 12.0045 13.5C12.5568 13.5 13.0045 13.0523 13.0045 12.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconPanelRight() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M2 12C2 8.3109 2 6.46633 2.81382 5.1588C3.1149 4.67505 3.48891 4.2543 3.91891 3.91557C5.08116 3.00003 6.72077 3.00003 10 3.00003H14C17.2792 3.00003 18.9188 3.00003 20.0811 3.91557C20.5111 4.2543 20.8851 4.67505 21.1862 5.1588C22 6.46633 22 8.3109 22 12C22 15.6892 22 17.5337 21.1862 18.8413C20.8851 19.325 20.5111 19.7458 20.0811 20.0845C18.9188 21 17.2792 21 14 21H10C6.72077 21 5.08116 21 3.91891 20.0845C3.48891 19.7458 3.1149 19.325 2.81382 18.8413C2 17.5337 2 15.6892 2 12Z" stroke="currentColor" strokeWidth="1.9" />
      <path d="M14.5 3.00003L14.5 21" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M18 7.00006H19M18 10.0001H19" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconOrchestrator() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M7 4.5C5.34315 4.5 4 5.84315 4 7.5C4 8.06866 4.15822 8.60037 4.43304 9.0535C3.04727 9.31855 2 10.537 2 12C2 13.463 3.04727 14.6814 4.43304 14.9465M7 4.5C7 3.11929 8.11929 2 9.5 2C10.8807 2 12 3.11929 12 4.5V19.5C12 20.8807 10.8807 22 9.5 22C8.11929 22 7 20.8807 7 19.5C5.34315 19.5 4 18.1569 4 16.5C4 15.9313 4.15822 15.3996 4.43304 14.9465M7 4.5C7 5.31791 7.39278 6.04408 8 6.50018M4.43304 14.9465C4.78948 14.3588 5.34207 13.9032 6 13.6707" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M17 19.4999C18.6569 19.4999 20 18.1567 20 16.4999C20 15.9312 19.8418 15.3995 19.567 14.9464C20.9527 14.6813 22 13.4629 22 11.9999C22 10.5369 20.9527 9.31843 19.567 9.05338M17 19.4999C17 20.8806 15.8807 21.9999 14.5 21.9999C13.1193 21.9999 12 20.8806 12 19.4999L12 4.49988C12 3.11917 13.1193 1.99988 14.5 1.99988C15.8807 1.99988 17 3.11917 17 4.49988C18.6569 4.49988 20 5.84302 20 7.49988C20 8.06854 19.8418 8.60024 19.567 9.05338M17 19.4999C17 18.682 16.6072 17.9558 16 17.4997M19.567 9.05338C19.2105 9.64109 18.6579 10.0966 18 10.3292" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconAgentCampaign() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M9 14V6H6C5.07003 6 4.60504 6 4.22354 6.10222C3.18827 6.37962 2.37962 7.18827 2.10222 8.22354C2 8.60504 2 9.07003 2 10C2 10.93 2 11.395 2.10222 11.7765C2.37962 12.8117 3.18827 13.6204 4.22354 13.8978C4.60504 14 5.07003 14 6 14H9Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M9 14L9.96466 18.8233C9.98816 18.9408 10 19.0604 10 19.1802V19.3411C10 20.2573 9.25728 21 8.34109 21C7.55885 21 6.8829 20.4536 6.719 19.6887L5.5 14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M10 6H9V14H10C11.2982 14 12.5614 14.4211 13.6 15.2L15.747 16.8103C15.9112 16.9334 16.111 17 16.3162 17C16.7246 17 17.0909 16.7404 17.2088 16.3495C17.5537 15.2067 18 13.2728 18 10C18 6.72718 17.5537 4.79327 17.2088 3.65054C17.0909 3.25961 16.7246 3 16.3162 3C16.111 3 15.9112 3.06658 15.747 3.18974L13.6 4.8C12.5614 5.57893 11.2982 6 10 6Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M21 9.99996H22M20.5 6.00109L21.5 5.40637M20.5 14L21.5 14.6481" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconAgentBrand() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M17 12C17 14.7614 14.7614 17 12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M14 2.20004C13.3538 2.06886 12.6849 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 11.3151 21.9311 10.6462 21.8 10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M12.0303 11.9625L16.5832 7.4096M19.7404 4.34462L19.1872 2.35748C19.0853 2.03011 18.6914 1.89965 18.4259 2.11662C16.9898 3.29018 15.4254 4.87091 16.703 7.36419C19.2771 8.56455 20.7466 6.94584 21.8733 5.5853C22.0975 5.3146 21.9623 4.90767 21.6247 4.81005L19.7404 4.34462Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconAgentPipeline() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C12.8417 22 14 22.1163 14 21C14 20.391 13.6832 19.9212 13.3686 19.4544C12.9082 18.7715 12.4523 18.0953 13 17C13.6667 15.6667 14.7778 15.6667 16.4815 15.6667C17.3334 15.6667 18.3334 15.6667 19.5 15.5C21.601 15.1999 22 13.9084 22 12Z" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="9.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="16.5" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.9" />
      <path d="M7.125 15H7M7.25 15C7.25 15.1381 7.13807 15.25 7 15.25C6.86193 15.25 6.75 15.1381 6.75 15C6.75 14.8619 6.86193 14.75 7 14.75C7.13807 14.75 7.25 14.8619 7.25 15Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconAgentAudience() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M18.4995 20.5C18.2663 17.5685 15.8417 15.2477 12.808 15.0521L11.9995 15C11.7107 15.0076 11.4416 15.0178 11.1877 15.0298C8.18075 15.1723 5.7304 17.5974 5.49951 20.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M15.2495 9.25C15.2495 11.0449 13.7944 12.5 11.9995 12.5C10.2046 12.5 8.74952 11.0449 8.74952 9.25C8.74952 7.45507 10.2046 6 11.9995 6C13.7944 6 15.2495 7.45507 15.2495 9.25Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M5.50249 8.5C5.17908 7.99485 4.99158 7.39432 4.99158 6.75C4.99158 4.95507 6.44665 3.5 8.24157 3.5C8.68752 3.5 9.1125 3.58982 9.49939 3.75235" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M18.4963 8.5C18.8197 7.99485 19.0072 7.39432 19.0072 6.75C19.0072 4.95507 17.5521 3.5 15.7572 3.5C15.3113 3.5 14.8863 3.58982 14.4994 3.75235" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M22.0007 17.9996C21.8208 15.7374 19.9995 13.5 17.9995 13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M1.99927 17.9996C2.17923 15.7374 4.00049 13.5 6.00049 13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconAgentDirection() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M7 4.5C5.34315 4.5 4 5.84315 4 7.5C4 8.06866 4.15822 8.60037 4.43304 9.0535C3.04727 9.31855 2 10.537 2 12C2 13.463 3.04727 14.6814 4.43304 14.9465M7 4.5C7 3.11929 8.11929 2 9.5 2C10.8807 2 12 3.11929 12 4.5V19.5C12 20.8807 10.8807 22 9.5 22C8.11929 22 7 20.8807 7 19.5C5.34315 19.5 4 18.1569 4 16.5C4 15.9313 4.15822 15.3996 4.43304 14.9465M7 4.5C7 5.31791 7.39278 6.04408 8 6.50018M4.43304 14.9465C4.78948 14.3588 5.34207 13.9032 6 13.6707" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M17 19.4999C18.6569 19.4999 20 18.1567 20 16.4999C20 15.9312 19.8418 15.3995 19.567 14.9464C20.9527 14.6813 22 13.4629 22 11.9999C22 10.5369 20.9527 9.31843 19.567 9.05338M17 19.4999C17 20.8806 15.8807 21.9999 14.5 21.9999C13.1193 21.9999 12 20.8806 12 19.4999L12 4.49988C12 3.11917 13.1193 1.99988 14.5 1.99988C15.8807 1.99988 17 3.11917 17 4.49988C18.6569 4.49988 20 5.84302 20 7.49988C20 8.06854 19.8418 8.60024 19.567 9.05338M17 19.4999C17 18.682 16.6072 17.9558 16 17.4997M19.567 9.05338C19.2105 9.64109 18.6579 10.0966 18 10.3292" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M12 4V20M20 12H4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconPlugins() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M15.5 2V6M8.5 6V2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M6.00446 7.61331C5.93719 6.74273 6.63957 6 7.53014 6H16.4699C17.3604 6 18.0628 6.74273 17.9955 7.61331L17.8117 9.99197C17.6796 11.7019 17.1011 13.3498 16.132 14.7773L15.5312 15.6622C14.9638 16.4979 14.0077 17 12.9838 17H11.0162C9.99228 17 9.03617 16.4979 8.46881 15.6622L7.86803 14.7773C6.89885 13.3498 6.32041 11.7019 6.18827 9.99197L6.00446 7.61331Z" stroke="currentColor" strokeWidth="1.9" />
      <path d="M12 17V22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M11 9H13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M13.427 8.08396C12.8007 5.84272 12.3226 4 11.0004 4C9.67824 4 9.19964 5.84274 8.5731 8.08399C8.31853 8.99465 8.19125 9.44998 7.82042 9.82077C7.4496 10.1916 6.99434 10.3188 6.08381 10.5732C3.84273 11.1995 2 11.6775 2 13C2 14.3225 3.84273 14.8005 6.08381 15.4268C6.99434 15.6812 7.4496 15.8084 7.82042 16.1792C8.19125 16.55 8.31853 17.0054 8.5731 17.916C9.19964 20.1573 9.67824 22 11.0004 22C12.3226 22 12.8007 20.1573 13.427 17.916C13.6815 17.0054 13.8087 16.5501 14.1795 16.1793C14.5504 15.8085 15.0056 15.6812 15.9162 15.4268C18.1573 14.8005 20 14.3225 20 13C20 11.6775 18.1573 11.1995 15.9162 10.5732C15.0056 10.3188 14.5504 10.1915 14.1795 9.8207C13.8087 9.44986 13.6815 8.99456 13.427 8.08396Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M19.5 2.9375V4.5M19.5 4.5V6.0625M19.5 4.5H18.25M19.5 4.5H20.75M22 4.5L21.548 4.34934C20.8497 4.11658 20.5006 4.00019 20.2502 3.74981C19.9998 3.49942 19.8834 3.15027 19.6507 2.45198L19.5 2L19.3493 2.45198C19.1166 3.15027 19.0002 3.49942 18.7498 3.74981C18.4994 4.00019 18.1503 4.11658 17.452 4.34934L17 4.5L17.452 4.65066C18.1503 4.88342 18.4994 4.99981 18.7498 5.25019C19.0002 5.50058 19.1166 5.84973 19.3493 6.54802L19.5 7L19.6507 6.54802C19.8834 5.84973 19.9998 5.50058 20.2502 5.25019C20.5006 4.99981 20.8497 4.88342 21.548 4.65066L22 4.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconChevronDownSmall() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconMic() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M7 6.5C7 4.01472 9.01472 2 11.5 2C13.9853 2 16 4.01472 16 6.5V11.5C16 13.9853 13.9853 16 11.5 16C9.01472 16 7 13.9853 7 11.5V6.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M11.5 19H11.0828C7.57267 19 4.57706 16.4623 4 13M11.5 19H11.9172C15.4273 19 18.4229 16.4623 19 13M11.5 19V22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M12 5.5V19" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M18 11C18 11 13.5811 5.00001 12 5C10.4188 4.99999 6 11 6 11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconGmail() {
  return (
    <svg viewBox="0 0 56.4108 44.8722" fill="none" aria-hidden="true">
      <path d="M44.2255 5.76727H56.4051V41.0239C56.4051 43.148 54.683 44.8701 52.5589 44.8701H46.1486C45.8961 44.8701 45.646 44.8204 45.4127 44.7237C45.1794 44.6271 44.9674 44.4854 44.7888 44.3069C44.6102 44.1283 44.4686 43.9163 44.3719 43.683C44.2753 43.4497 44.2255 43.1996 44.2255 42.947V5.76727Z" fill="url(#lg_r_2_-0)" />
      <path d="M12.1796 5.76727H0V41.0239C0 43.148 1.72213 44.8701 3.84618 44.8701H10.2565C10.509 44.8701 10.7591 44.8204 10.9924 44.7237C11.2257 44.6271 11.4377 44.4854 11.6163 44.3069C11.7949 44.1283 11.9365 43.9163 12.0332 43.683C12.1298 43.4497 12.1796 43.1996 12.1796 42.947V5.76727Z" fill="#FC413D" />
      <path d="M10.0085 1.42778C7.43377 -0.736342 3.5924 -0.403647 1.42828 2.17105C-0.735843 4.74543 -0.403148 8.58681 2.17155 10.7512L26.5557 31.2479C27.0178 31.6362 27.602 31.8492 28.2056 31.8492C28.8091 31.8492 29.3934 31.6362 29.8554 31.2479L54.2396 10.7509C56.814 8.58681 57.1467 4.74543 54.9825 2.17073C52.8184 -0.403648 48.977 -0.736342 46.4027 1.42778L28.2054 16.724L10.0085 1.42778Z" fill="url(#lg_r_2_-1)" />
      <defs>
        <linearGradient id="lg_r_2_-0" x1="50.3153" y1="5.76727" x2="50.3153" y2="44.8701" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60D673" />
          <stop offset="0.17" stopColor="#42C868" />
          <stop offset="0.39" stopColor="#0EBC5F" />
          <stop offset="0.62" stopColor="#00A9BB" />
          <stop offset="0.86" stopColor="#3C90FF" />
          <stop offset="1" stopColor="#3186FF" />
        </linearGradient>
        <linearGradient id="lg_r_2_-1" x1="6.04194e-05" y1="6.45153" x2="56.4107" y2="6.45153" gradientUnits="userSpaceOnUse">
          <stop offset="0.08" stopColor="#FF63A0" />
          <stop offset="0.3" stopColor="#FC413D" />
          <stop offset="0.5" stopColor="#FC413D" />
          <stop offset="0.65" stopColor="#FC413D" />
          <stop offset="0.72" stopColor="#FC5C30" />
          <stop offset="0.86" stopColor="#FEB10C" />
          <stop offset="0.91" stopColor="#FEC700" />
          <stop offset="0.96" stopColor="#FFDB0F" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function IconSlackBrand() {
  return (
    <svg viewBox="0 0 49.883 49.877" fill="none" aria-hidden="true">
      <g transform="translate(0 0)">
        <path d="M18.3549 10.4784C15.4713 10.4784 13.1157 8.12279 13.1157 5.2392C13.1157 2.35561 15.4713 0 18.3549 0C21.2385 0 23.5941 2.35561 23.5941 5.2392V10.4784H18.3549Z" fill="#36C5F0" />
        <path d="M18.3575 13.12C21.2411 13.12 23.5967 15.4756 23.5967 18.3592C23.5967 21.2428 21.2411 23.5984 18.3575 23.5984H5.2392C2.35561 23.5984 0 21.2428 0 18.3592C0 15.4756 2.35561 13.12 5.2392 13.12H18.3575Z" fill="#36C5F0" />
      </g>
      <g transform="translate(26.28 0)">
        <path d="M13.1244 18.3592C13.1244 15.4756 15.48 13.12 18.3636 13.12C21.2472 13.12 23.6028 15.4756 23.6028 18.3592C23.6028 21.2428 21.2472 23.5984 18.3636 23.5984H13.1244V18.3592Z" fill="#2EB67D" />
        <path d="M10.4785 18.3575C10.4785 21.2411 8.12286 23.5967 5.23927 23.5967C2.35568 23.5967 7.4362e-05 21.2411 7.4362e-05 18.3575V5.2392C7.4362e-05 2.35561 2.35568 0 5.23927 0C8.12286 0 10.4785 2.35561 10.4785 5.2392V18.3575Z" fill="#2EB67D" />
      </g>
      <g transform="translate(0 26.28)">
        <path d="M10.4784 5.2392C10.4784 8.12279 8.12279 10.4784 5.2392 10.4784C2.35561 10.4784 0 8.12279 0 5.2392C0 2.35561 2.35561 0 5.2392 0H10.4784V5.2392Z" fill="#E01E5A" />
        <path d="M13.1157 5.2392C13.1157 2.35561 15.4713 0 18.3549 0C21.2385 0 23.5941 2.35561 23.5941 5.2392V18.3575C23.5941 21.2411 21.2385 23.5967 18.3549 23.5967C15.4713 23.5967 13.1157 21.2411 13.1157 18.3575V5.2392Z" fill="#E01E5A" />
      </g>
      <g transform="translate(26.28 26.28)">
        <path d="M5.23927 13.1157C8.12286 13.1157 10.4785 15.4713 10.4785 18.3549C10.4785 21.2385 8.12286 23.5941 5.23927 23.5941C2.35568 23.5941 7.4362e-05 21.2385 7.4362e-05 18.3549V13.1157H5.23927Z" fill="#ECB22E" />
        <path d="M5.23927 10.4784C2.35568 10.4784 7.4362e-05 8.12279 7.4362e-05 5.2392C7.4362e-05 2.35561 2.35568 0 5.23927 0H18.3576C21.2412 0 23.5968 2.35561 23.5968 5.2392C23.5968 8.12279 21.2412 10.4784 18.3576 10.4784H5.23927Z" fill="#ECB22E" />
      </g>
    </svg>
  );
}

function IconFigma() {
  return (
    <svg viewBox="0 0 49.7096 59.6884" fill="none" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M0 45.9002L9.1618 38.8247C14.0602 45.1745 19.2307 48.1679 24.9455 48.1679C30.6603 48.1679 35.7401 45.2652 40.3663 38.9154L49.7096 45.8094C42.997 54.8805 34.6516 59.6882 24.9455 59.6882C15.3301 59.6882 6.89403 54.8805 0 45.9002Z" fill="url(#lg_r_3_-0)" />
      <path fillRule="evenodd" clipRule="evenodd" d="M24.9535 15.3301L8.62558 29.3903L1.09657 20.5914L25.0442 0L48.8105 20.5914L41.1908 29.2996L24.9535 15.3301Z" fill="url(#lg_r_3_-1)" />
      <defs>
        <linearGradient id="lg_r_3_-0" x1="0" y1="49.2666" x2="49.75" y2="49.2666" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8930FD" />
          <stop offset="1" stopColor="#49CCF9" />
        </linearGradient>
        <linearGradient id="lg_r_3_-1" x1="1.09231" y1="14.6901" x2="48.7603" y2="14.6901" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF02F0" />
          <stop offset="1" stopColor="#FFC800" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function IconCloseLarge() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconShirt() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M5.99756 12V17.6841C5.99756 19.4952 5.99756 20.4008 6.58285 20.9635C7.24789 21.6028 9.6154 21.9785 11.9925 21.9991C14.3085 22.0192 16.6337 21.7022 17.4021 20.9635C17.9874 20.4008 17.9874 19.4952 17.9874 17.6841V12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M5.72228 14.022C4.8566 13.7083 3.22971 13.4394 2.49588 12.7032C1.48592 11.69 2.13864 10.3201 3.37707 7.73891C3.93449 6.5771 5.00094 5.72243 6.24362 5.38452C6.41238 5.33863 6.55884 5.23314 6.65592 5.08755L7.93933 3.08867C7.97639 3.03309 8.02343 2.98533 8.08061 2.95084C8.65909 2.60195 10.0921 1.99998 11.9925 1.99998C13.8929 1.99998 15.2321 2.60195 15.8105 2.95084C15.8677 2.98533 15.9148 3.03309 15.9518 3.08867L17.2721 5.0687C17.3692 5.21429 17.5156 5.31978 17.6844 5.36567C18.9271 5.70358 19.9451 6.45012 20.5026 7.61193C21.8937 10.1413 22.5105 11.6707 21.5005 12.6839C20.7667 13.4201 19.1174 13.7116 18.2517 14.0253" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M6.50098 5.49998L10.7345 8.79261C11.3409 9.26419 11.644 9.49998 12.001 9.49998C12.358 9.49998 12.6611 9.26419 13.2675 8.79261L17.501 5.49998" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M9.50098 2.99998L11.001 8.99998M14.501 2.99998L13.001 8.99998" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconInstagram() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M3 12C3 7.75736 3 5.63604 4.31802 4.31802C5.63604 3 7.75736 3 12 3C16.2426 3 18.364 3 19.682 4.31802C21 5.63604 21 7.75736 21 12C21 16.2426 21 18.364 19.682 19.682C18.364 21 16.2426 21 12 21C7.75736 21 5.63604 21 4.31802 19.682C3 18.364 3 16.2426 3 12Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M16 12C16 14.2091 14.2091 16 12 16C9.79086 16 8 14.2091 8 12C8 9.79086 9.79086 8 12 8C14.2091 8 16 9.79086 16 12Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M17.3748 6.75024H17.2498M17.4998 6.75024C17.4998 6.88832 17.3878 7.00024 17.2498 7.00024C17.1117 7.00024 16.9998 6.88832 16.9998 6.75024C16.9998 6.61217 17.1117 6.50024 17.2498 6.50024C17.3878 6.50024 17.4998 6.61217 17.4998 6.75024Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconTikTok() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M10.5359 11.0075C9.71585 10.8916 7.84666 11.0834 6.93011 12.7782C6.01355 14.4729 6.9373 16.2368 7.51374 16.9069C8.08298 17.5338 9.89226 18.721 11.8114 17.5619C12.2871 17.2746 12.8797 17.0603 13.552 14.8153L13.4738 5.98145C13.3441 6.95419 14.4186 9.23575 17.478 9.5057" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconFacebook() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M16.9265 8.02637H13.9816C12.9378 8.02637 12.0894 8.86847 12.0817 9.91229L11.9964 21.4268M10.082 14.0017H14.8847" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconLaunch() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M16 2V6M8 2V6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M13 4H11C7.22876 4 5.34315 4 4.17157 5.17157C3 6.34315 3 8.22876 3 12V14C3 17.7712 3 19.6569 4.17157 20.8284C5.34315 22 7.22876 22 11 22H13C16.7712 22 18.6569 22 19.8284 20.8284C21 19.6569 21 17.7712 21 14V12C21 8.22876 21 6.34315 19.8284 5.17157C18.6569 4 16.7712 4 13 4Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M3 10H21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M12.1258 14H12.0008M12.1258 18H12.0008M7.625 14H7.5M7.625 18H7.5M16.625 14H16.5M12.2508 14C12.2508 14.1381 12.1389 14.25 12.0008 14.25C11.8628 14.25 11.7508 14.1381 11.7508 14C11.7508 13.8619 11.8628 13.75 12.0008 13.75C12.1389 13.75 12.2508 13.8619 12.2508 14ZM12.2508 18C12.2508 18.1381 12.1389 18.25 12.0008 18.25C11.8628 18.25 11.7508 18.1381 11.7508 18C11.7508 17.8619 11.8628 17.75 12.0008 17.75C12.1389 17.75 12.2508 17.8619 12.2508 18ZM7.75 14C7.75 14.1381 7.63807 14.25 7.5 14.25C7.36193 14.25 7.25 14.1381 7.25 14C7.25 13.8619 7.36193 13.75 7.5 13.75C7.63807 13.75 7.75 13.8619 7.75 14ZM7.75 18C7.75 18.1381 7.63807 18.25 7.5 18.25C7.36193 18.25 7.25 18.1381 7.25 18C7.25 17.8619 7.36193 17.75 7.5 17.75C7.63807 17.75 7.75 17.8619 7.75 18ZM16.75 14C16.75 14.1381 16.6381 14.25 16.5 14.25C16.3619 14.25 16.25 14.1381 16.25 14C16.25 13.8619 16.3619 13.75 16.5 13.75C16.6381 13.75 16.75 13.8619 16.75 14Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconBudget() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M17.9583 8.38889C17.9583 6.24111 15.2907 4.5 12 4.5C8.7093 4.5 6.04167 6.24111 6.04167 8.38889C6.04167 10.5367 7.66667 11.7222 12 11.7222C16.3333 11.7222 18.5 12.8333 18.5 15.6111C18.5 18.3889 15.5899 19.5 12 19.5C8.41015 19.5 5.5 17.7589 5.5 15.6111" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M12.5 2.5V4.21M12.5 21.5V19.79" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function IconMarkets() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M13.6177 21.367C13.1841 21.773 12.6044 22 12.0011 22C11.3978 22 10.8182 21.773 10.3845 21.367C6.41302 17.626 1.09076 13.4469 3.68627 7.37966C5.08963 4.09916 8.45834 2 12.0011 2C15.5439 2 18.9126 4.09916 20.316 7.37966C22.9082 13.4393 17.599 17.6389 13.6177 21.367Z" stroke="currentColor" strokeWidth="1.9" />
      <path d="M15.5 11C15.5 12.933 13.933 14.5 12 14.5C10.067 14.5 8.5 12.933 8.5 11C8.5 9.067 10.067 7.5 12 7.5C13.933 7.5 15.5 9.067 15.5 11Z" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  );
}

function FolderMark({ uid }: { uid: string }) {
  return (
    <div className="ui-fd-icon" aria-hidden="true">
      <svg className="ui-fd-layer ui-fd-back" viewBox="0 0 600 500">
        <defs>
          <filter id={`ui-fd${uid}-hl`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur" />
            <feOffset in="blur" dy="3" result="offset" />
            <feComposite in="blur" in2="offset" operator="arithmetic" k2="1" k3="-1" result="diff" />
            <feFlood floodColor="#fff" floodOpacity="0.65" />
            <feComposite in2="diff" operator="in" result="light" />
            <feComposite in="light" in2="SourceAlpha" operator="in" />
          </filter>
        </defs>
        <path className="ui-fd-back-fill" d="M38 0H176Q196 0 204 14L218 30Q224 38 246 38H562Q600 38 600 76V462Q600 500 562 500H38Q0 500 0 462V38Q0 0 38 0Z" fill="#5bb7ea" />
        <path d="M38 0H176Q196 0 204 14L218 30Q224 38 246 38H562Q600 38 600 76V462Q600 500 562 500H38Q0 500 0 462V38Q0 0 38 0Z" fill="#000" filter={`url(#ui-fd${uid}-hl)`} />
      </svg>
      <svg className="ui-fd-layer" viewBox="0 0 600 500">
        <defs>
          <linearGradient id={`ui-fd${uid}-paper`} x1="0" y1="0" x2="0" y2="1">
            <stop className="ui-fd-paper-top" offset="0%" stopColor="#fff" />
            <stop className="ui-fd-paper-bottom" offset="100%" stopColor="#eaf2f8" />
          </linearGradient>
          <symbol id={`ui-fd${uid}-doc`} overflow="visible">
            <rect className="ui-fd-paper" x="0.6" y="0.6" width="278.8" height="348.8" rx="19.4" fill={`url(#ui-fd${uid}-paper)`} stroke="rgba(0,0,0,0.12)" strokeWidth="1.2" />
            <rect className="ui-fd-line" x="30" y="87" width="78" height="9" rx="4.5" fill="rgba(0,0,0,0.12)" />
            <rect className="ui-fd-line" x="30" y="115" width="180" height="9" rx="4.5" fill="rgba(0,0,0,0.12)" />
            <rect className="ui-fd-line" x="30" y="143" width="140" height="9" rx="4.5" fill="rgba(0,0,0,0.12)" />
            <rect className="ui-fd-line" x="30" y="171" width="175" height="9" rx="4.5" fill="rgba(0,0,0,0.12)" />
            <rect className="ui-fd-line" x="30" y="199" width="126" height="9" rx="4.5" fill="rgba(0,0,0,0.12)" />
            <rect className="ui-fd-line" x="30" y="227" width="168" height="9" rx="4.5" fill="rgba(0,0,0,0.12)" />
            <rect className="ui-fd-line" x="30" y="255" width="110" height="9" rx="4.5" fill="rgba(0,0,0,0.12)" />
          </symbol>
        </defs>
        <use className="ui-fd-doc ui-fd-doc--left" href={`#ui-fd${uid}-doc`} />
        <use className="ui-fd-doc ui-fd-doc--right" href={`#ui-fd${uid}-doc`} />
        <use className="ui-fd-doc ui-fd-doc--middle" href={`#ui-fd${uid}-doc`} />
      </svg>
      <div className="ui-fd-front" />
    </div>
  );
}

const css = /* css */ `
/* ui-app-shell — composed into this item */
.ui-as{--tray: #f3ebe3;--card: #fffdfb;--page: #f8f3ee;--panel: #fffdfb;--radius-panel: 18px;--frame-gap: 8px;--line: #e8e0d8;--line-soft: #eee6de;--ink: #1c1713;--text: #3d3226;--muted: #68584b;--faint: #96887a;--placeholder: #96887a;--chip: #f4ece5;--chip-hover: #ece4db;--hover: rgba(11, 9, 8, 0.035);--accent: #ff8a5c;--button: #28211a;--button-hover: #33291f;--accent-soft: #f6f0e9;--shadow: 0 1px 2px rgba(11, 9, 8, 0.05);--line-strong: #d2c7bd;--subtle: #faf7f4;--disabled: #d0c4ba;--on-ink: #fffdfb;--ink-hover: #382e23;--select: rgba(11, 9, 8, 0.055);--toggle-off: #d8cdc4;--switch-on: #1c1713;--logo-bg: #fffdfb;--ease: cubic-bezier(0.22, 1, 0.36, 1);--font: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif}
.ui-as .ui-pl{font-size: 13.5px;line-height: 19px}
.ui-as .ui-pl__title{font-size: 14px;line-height: 20px}
.ui-as .ui-df__text{font-size: 13.5px;line-height: 1.6}
.ui-as .ui-df__body{padding: 14px 16px 16px}
.ui-as .ui-ap__title{font-size: 13.5px}
.ui-as .ui-ap__btn{height: 30px}
.ui-as .ui-tc{font-size: 13px}
.ui-as .ui-tc__head{min-height: 40px;padding-top: 6px;padding-bottom: 6px}
.ui-as .ui-ap__foot .ui-ap__actions{flex: 0 0 auto;margin-left: auto}
.ui-as .ui-ap__actions .ui-ap__btn{flex: none;padding: 0 12px;border-radius: 10px}
.ui-as .ui-ap__actions .ui-ap__btn--quiet{background: var(--card);box-shadow: inset 0 0 0 1px var(--line)}
.ui-as .ui-ap__actions .ui-ap__btn--quiet:hover{background: var(--subtle)}
.ui-as .ui-df__head .ui-df__btn, .ui-as .ui-df__head .ui-df__icon{border-radius: 10px}
.ui-as .ui-ap__actions .ui-ap__btn--primary, .ui-as .ui-df__head .ui-df__btn--primary{background: var(--button)}
.ui-as .ui-um__action{border-radius: 10px}
.ui-as .ui-ap{--ui-ap-tray: var(--tray);--ui-ap-hover: #e8e0d8}
.ui-as .ui-pl{--ui-pl-tray: var(--tray);--ui-pl-quiet-hover: #e8e0d8;--ui-pl-marker: var(--chip)}
.ui-as .ui-df{--ui-df-tray: var(--tray)}
.ui-as .ui-um{--ui-um-tray: var(--tray)}
.ui-as .ui-cb{--ui-cb-tray: var(--tray)}
:where(.dark, [data-theme="dark"]) .ui-as .ui-ap{--ui-ap-tray: #181310;--ui-ap-hover: #26201a}
:where(.dark, [data-theme="dark"]) .ui-as .ui-pl{--ui-pl-tray: #181310;--ui-pl-quiet-hover: #26201a;--ui-pl-marker: #29221b}
:where(.dark, [data-theme="dark"]) .ui-as :is(.ui-df, .ui-um, .ui-cb){--ui-df-tray: #181310;--ui-um-tray: #181310;--ui-cb-tray: #181310}
:where(.dark, [data-theme="dark"]) .ui-as{--tray: #221c17;--card: #201a15;--page: #16110e;--panel: #1a1512;--line: #2b231b;--line-soft: #26201a;--ink: #f4ece4;--text: #c8bdb2;--muted: #988a7d;--faint: #6a5a4e;--placeholder: #6a5a4e;--chip: #27201a;--chip-hover: #2e251c;--hover: rgba(255, 253, 251, 0.05);--accent: #ff8a5c;--button: #f4ece4;--button-hover: #fffdfb;--accent-soft: rgba(255, 138, 92, 0.14);--shadow: 0 1px 2px rgba(11, 9, 8, 0.4);--line-strong: #3a3024;--subtle: #1e1814;--disabled: #3a3024;--on-ink: #181310;--ink-hover: #c8bdb2;--select: rgba(255, 253, 251, 0.08);--toggle-off: #3a3024;--switch-on: #ff8a5c;--logo-bg: #2c241b;color-scheme: dark}
.ui-as, .ui-as *, .ui-as *::before, .ui-as *::after{box-sizing: border-box}
.ui-as{font-family: var(--font);font-size: 13px;color: var(--text);-webkit-font-smoothing: antialiased;-moz-osx-font-smoothing: grayscale}
:where(.ui-as) button{appearance: none;margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;cursor: pointer}
:where(.ui-as) svg{display: block;flex: none}
.ui-as :focus-visible{outline: 2px solid var(--accent);outline-offset: 2px}
.ui-as textarea:focus-visible, .ui-as input:focus-visible{outline: none}
.ui-as-app .ui-button[data-variant="primary"]{border-color: transparent;background: var(--button);color: var(--on-ink);box-shadow: inset 0 1px 0.5px rgba(255, 253, 251, 0.16), inset 0 -1px 0.5px rgba(28, 23, 19, 0.1), 0 1px 2px rgba(28, 23, 19, 0.1)}
.ui-as-app .ui-button[data-variant="primary"]:hover:not(:disabled){background: var(--button-hover)}
.ui-as-app{container: ui-as / inline-size;position: relative;display: grid;grid-template-columns: 248px minmax(0, 1fr);height: 100%;min-height: 560px;background: var(--page);transition: grid-template-columns var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-app[data-collapsed]{grid-template-columns: 0 minmax(0, 1fr)}
.ui-as-app[data-collapsed] .ui-as-main{margin-left: var(--frame-gap)}
.ui-as-side{display: flex;flex-direction: column;width: 248px;min-height: 0;padding: 10px 8px 8px 10px;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), translate var(--nm-dur-4, 380ms) var(--ease), visibility 0s}
.ui-as-app[data-collapsed] .ui-as-side{visibility: hidden;opacity: 0;translate: -16px 0;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), translate var(--nm-dur-4, 380ms) var(--ease), visibility 0s 420ms}
.ui-as-side-open{position: fixed;z-index: 20;top: calc(var(--frame-gap) + 9px);left: calc(var(--frame-gap) + 9px);visibility: hidden;opacity: 0;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), visibility 0s 200ms}
.ui-as-app[data-collapsed] .ui-as-side-open{visibility: visible;opacity: 1;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 160ms, visibility 0s}
.ui-as-side__head{display: flex;align-items: center;justify-content: space-between;height: 28px}
.ui-as-side__workspace{display: flex;align-items: center;gap: 6px;height: 30px;padding: 0 6px;border-radius: 8px;font-size: 14px;font-weight: 600;color: var(--ink)}
.ui-as-side__workspace svg{color: var(--faint)}
.ui-as-side__workspace:hover{background: var(--hover)}
.ui-as-user-menu{display: flex}
.ui-as-user-menu > .ui-as-user{flex: 1}
.ui-as-user-menu .ui-as-menu{width: 100%}
.ui-as-side__logo{display: grid;place-items: center;width: 18px;height: 18px;margin-right: 1px;border-radius: 5px;background: var(--logo-bg);box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.08), 0 1px 1px rgba(0, 0, 0, 0.12)}
.ui-as-side__logo svg{width: 11px;height: auto}
.ui-as-side__tools{display: flex;gap: 2px}
.ui-as-icon-btn{display: grid;place-items: center;width: 28px;height: 28px;border-radius: 8px;color: var(--muted);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-icon-btn:hover{background: var(--hover);color: var(--ink)}
.ui-as-side__nav{display: flex;flex-direction: column;margin-top: 16px}
.ui-as-side__group{display: flex;flex-direction: column}
.ui-as-side__group + .ui-as-side__group{margin-top: 10px}
.ui-as-side__group + .ui-as-side__group > .ui-as-side__label:first-child{margin-top: 6px}
.ui-as-side__count{margin-left: auto;font-size: 12px;color: var(--faint);font-variant-numeric: tabular-nums}
.ui-as-side__empty{padding: 4px 6px;font-size: 13px;color: var(--faint)}
.ui-as-side__item{display: flex;align-items: center;gap: 8px;width: 100%;height: 30px;padding: 0 6px;border-radius: 8px;font-size: 13.5px;color: var(--text);text-align: left;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-side__item svg{color: var(--muted)}
.ui-as-side__item:hover{background: var(--hover);color: var(--ink)}
.ui-as-side__item[aria-current="page"]{background: var(--select);color: var(--ink);font-weight: 500}
.ui-as-side__item[aria-current="page"] svg{color: var(--ink)}
a.ui-as-side__item{text-decoration: none;cursor: pointer}
.ui-as-side__label{margin: 16px 0 4px;padding: 0 6px;font-size: 12.5px;line-height: 16px;color: var(--faint)}
.ui-as-side__foot{display: flex;flex-direction: column;gap: 8px;margin-top: auto}
.ui-as-news{position: relative;padding-top: 30px}
.ui-as-news__card{position: relative;z-index: 1;padding: 10px 10px 0;border-radius: 12px;background: var(--card);box-shadow: 0 0 0 1px var(--line), 0 2px 6px rgba(11, 9, 8, 0.04)}
.ui-as-news__card--back{position: absolute;z-index: 0;top: 0;left: 10px;right: 10px;height: 48px;display: flex;align-items: flex-start;justify-content: space-between;padding: 9px 9px 0;background: var(--card);color: var(--faint)}
.ui-as-news[data-count="1"]{padding-top: 0}
.ui-as-news[data-count="1"] .ui-as-news__card--back{display: none}
.ui-as-news__top{display: flex;align-items: center;justify-content: space-between}
.ui-as-news__kicker{font-size: 11.5px;line-height: 15px;font-weight: 500;color: var(--accent)}
.ui-as-news__close{display: grid;place-items: center;width: 18px;height: 18px;margin: -2px -2px 0 0;border-radius: 6px;color: var(--faint)}
.ui-as-news__close:hover{background: var(--hover);color: var(--ink)}
.ui-as-news__title{display: block;margin-top: 4px;font-size: 13.5px;line-height: 18px;font-weight: 600;color: var(--ink)}
.ui-as-news__more{display: flex;align-items: center;justify-content: space-between;width: calc(100% + 20px);height: 34px;margin: 10px -10px 0;padding: 0 10px;border-top: 1px solid var(--line-soft);border-radius: 0 0 12px 12px;font-size: 12.5px;color: var(--muted)}
.ui-as-news__more:hover{background: var(--subtle);color: var(--ink)}
.ui-as-guide-slot{position: relative;flex: none}
.ui-as-guide{position: absolute;z-index: 6;right: 0;bottom: 0;left: 0;overflow: hidden;border-radius: 12px;background: var(--card);box-shadow: 0 0 0 1px var(--line), 0 2px 6px rgba(11, 9, 8, 0.04);transition: height var(--nm-dur-4, 380ms) var(--ease), border-radius var(--nm-dur-4, 380ms) var(--ease), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-guide:not([data-open]):hover{box-shadow: 0 0 0 1px var(--line-strong), 0 2px 6px rgba(11, 9, 8, 0.05)}
.ui-as-guide[data-open]{border-radius: 14px;box-shadow: 0 0 0 1px var(--line), 0 8px 24px -10px rgba(11, 9, 8, 0.14)}
.ui-as-guide__content{animation: ui-as-guide-in var(--nm-dur-4, 380ms) var(--ease) both}
.ui-as-guide[data-state="closing"] .ui-as-guide__content{animation: ui-as-guide-out var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-as-guide[data-state="closing"]{border-radius: 12px;box-shadow: 0 0 0 1px var(--line), 0 2px 6px rgba(11, 9, 8, 0.04)}
@keyframes ui-as-guide-out{to{opacity: 0}
}
@keyframes ui-as-guide-in{from{opacity: 0;transform: translateY(6px)}
to{opacity: 1;transform: none}
}
.ui-as-steps{display: grid;gap: 3px;width: 100%;padding: 10px 10px 9px;text-align: left}
.ui-as-guide .ui-sg__icon-btn[aria-expanded]{display: none}
.ui-as-guide .ui-sg{zoom: 0.86;max-width: none;padding: 12px 4px 4px;border: 0;border-radius: 0;background: transparent;box-shadow: none}
.ui-as-steps__title{display: flex;align-items: center;justify-content: space-between;font-size: 13.5px;line-height: 18px;font-weight: 600;color: var(--ink)}
.ui-as-steps__title svg{color: var(--faint)}
.ui-as-steps__sub{font-size: 12.5px;line-height: 17px;color: var(--muted)}
.ui-as-steps__cheer{color: var(--accent)}
.ui-as-steps__bar{height: 4px;margin-top: 6px;overflow: hidden;border-radius: 2px;background: var(--tray)}
.ui-as-steps__bar i{display: block;min-width: 6px;height: 100%;border-radius: inherit;background: var(--accent);transition: width var(--nm-dur-5, 620ms) var(--ease)}
.ui-as-user{display: flex;align-items: center;gap: 7px;height: 34px;padding: 0 6px;border-radius: 8px;font-size: 13.5px;font-weight: 500;color: var(--ink)}
.ui-as-user img{width: 21px;height: 21px;border-radius: 50%;object-fit: cover;box-shadow: 0 0 0 1px rgba(11, 9, 8, 0.06)}
.ui-as-user svg{margin-left: auto;color: var(--faint)}
.ui-as-user:hover{background: var(--hover)}
.ui-as-main{container: ui-as-main / inline-size;position: relative;min-width: 0;margin: var(--frame-gap) var(--frame-gap) var(--frame-gap) 0;overflow-y: auto;overscroll-behavior: none;transition: margin-left var(--nm-dur-4, 380ms) var(--ease);border: 1px solid var(--line);border-radius: var(--radius-panel);background: var(--panel)}
.ui-as-page{padding: 46px 32px 56px}
.ui-as-page-title{margin: 0;font-size: 22px;line-height: 28px;font-weight: 600;letter-spacing: -0.02em;color: var(--ink)}
.ui-as-page-sub{margin: 6px 0 0;font-size: 13.5px;line-height: 20px;color: var(--muted)}
.ui-as-page-sub a{color: var(--text);text-decoration: underline;text-decoration-color: var(--line-strong);text-underline-offset: 3px}
.ui-as-page-sub a:hover{color: var(--ink);text-decoration-color: currentColor}
.ui-as-section-head{margin-top: 38px}
.ui-as-section-head[data-inline]{display: flex;align-items: center;justify-content: space-between;gap: 16px}
.ui-as-section-head[data-inline] .ui-as-toolbar{margin-top: 0}
.ui-as-section-head__title{margin: 0;font-size: 16px;line-height: 22px;font-weight: 600;letter-spacing: -0.01em;color: var(--ink)}
.ui-as-toolbar{display: flex;align-items: center;justify-content: space-between;gap: 16px;margin-top: 16px}
.ui-as-toolbar__left, .ui-as-toolbar__right{display: flex;align-items: center;gap: 6px}
.ui-as-tabs{position: relative;display: flex;gap: 2px}
.ui-as-tabs__pill{position: absolute;top: 0;left: 0;height: 32px;border-radius: 9px;background: var(--chip);transition: transform var(--nm-dur-4, 380ms) var(--ease), width var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-tabs__tab{position: relative;height: 32px;padding: 0 10px;border-radius: 9px;font-size: 13.5px;color: var(--muted);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-tabs__tab:hover{color: var(--ink)}
.ui-as-tabs__tab[aria-selected="true"]{color: var(--ink)}
.ui-as-tool{display: flex;align-items: center;justify-content: center;gap: 6px;min-width: 32px;height: 32px;border-radius: 9px;background: var(--card);box-shadow: 0 0 0 1px var(--line), var(--shadow);color: var(--text);transition: box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-tool svg{color: var(--muted)}
.ui-as-tool:hover{box-shadow: 0 0 0 1px var(--line-strong), var(--shadow);color: var(--ink)}
.ui-as-tool--label{padding: 0 10px;font-size: 13px}
.ui-as-view{position: relative;display: flex;gap: 2px;height: 32px;padding: 2px;border-radius: 9px;background: var(--chip)}
.ui-as-view__btn{display: grid;place-items: center;width: 30px;border-radius: 7px;color: var(--faint)}
.ui-as-view__btn:hover{color: var(--ink)}
.ui-as-view__btn{position: relative;transition: color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-view__btn[aria-checked="true"]{color: var(--ink)}
.ui-as-view__pill{position: absolute;top: 2px;bottom: 2px;left: 2px;width: 30px;border-radius: 7px;background: var(--card);box-shadow: 0 0 0 1px var(--line), var(--shadow);transition: transform var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-view[data-view="list"] .ui-as-view__pill{transform: translateX(32px)}
.ui-as-search{display: flex;align-items: center;gap: 7px;height: 32px;padding: 0 10px;border-radius: 9px;background: var(--card);box-shadow: 0 0 0 1px var(--line), var(--shadow);color: var(--faint);cursor: text;transition: box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-search:focus-within{box-shadow: 0 0 0 1px var(--line-strong), 0 0 0 3px rgba(11, 9, 8, 0.04)}
.ui-as-search input{flex: 1;min-width: 0;padding: 0;border: 0;background: transparent;font: inherit;font-size: 13px;color: var(--ink)}
.ui-as-search input::placeholder{color: var(--placeholder)}
.ui-as-search__clear{display: grid;flex: none;place-items: center;width: 18px;height: 18px;border-radius: 50%;background: var(--chip);color: var(--muted);animation: ui-as-pop var(--nm-dur-3, 240ms) var(--ease)}
.ui-as-search__clear:hover{color: var(--ink)}
.ui-as-sort svg{transition: transform var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-sort[data-dir="desc"] svg{transform: rotate(180deg)}
.ui-as-tool[data-active]{box-shadow: 0 0 0 1px var(--line-strong), var(--shadow);color: var(--ink)}
.ui-as-tool__count{display: grid;place-items: center;min-width: 18px;height: 18px;padding: 0 5px;border-radius: 999px;background: var(--ink);font-size: 11px;font-weight: 600;color: var(--on-ink);animation: ui-as-pop var(--nm-dur-3, 240ms) var(--ease)}
.ui-as-anchor{position: relative;display: inline-flex}
.ui-as-popover{position: absolute;z-index: 30;top: calc(100% + 6px);left: 0;transform-origin: top left;animation: ui-as-popover var(--nm-dur-3, 240ms) var(--ease)}
.ui-as-popover[data-align="end"]{right: 0;left: auto;transform-origin: top right}
.ui-as-popover[data-side="top"]{top: auto;bottom: calc(100% + 6px);transform-origin: bottom left;animation-name: ui-as-popover-up}
.ui-as-popover[data-side="top"][data-align="end"]{transform-origin: bottom right}
.ui-as-popover[data-side="right"]{top: auto;bottom: 0;left: calc(100% + 12px);transform-origin: bottom left}
@keyframes ui-as-popover-up{from{opacity: 0;transform: scale(0.96) translateY(4px)}
to{opacity: 1;transform: none}
}
.ui-as-popover--filter .ui-fm{zoom: 0.9;width: 340px}
.ui-as-menu{min-width: 168px;padding: 4px;border-radius: 12px;background: var(--card);box-shadow: 0 0 0 1px var(--line), 0 12px 32px -8px rgba(11, 9, 8, 0.16)}
.ui-as-menu__title{display: block;padding: 6px 10px 4px;font-size: 12px;font-weight: 500;color: var(--faint)}
.ui-as-menu__list{display: grid;gap: 1px}
.ui-as-menu__item{display: flex;align-items: center;gap: 9px;width: 100%;min-height: 32px;padding: 0 10px;border-radius: 8px;font-size: 13px;color: var(--text);text-align: left;white-space: nowrap;transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-menu__item[data-rich]{min-height: 44px;padding: 6px 10px}
.ui-as-menu__item > svg{flex: none;color: var(--muted)}
.ui-as-menu__item > svg:last-child:not(:first-child){margin-left: auto;color: var(--ink)}
.ui-as-menu__label{display: grid;flex: 1;gap: 1px;min-width: 0}
.ui-as-menu__label small{font-size: 12px;line-height: 16px;color: var(--faint)}
.ui-as-menu__item:hover{background: var(--hover);color: var(--ink)}
.ui-as-menu__item[aria-checked="true"]{color: var(--ink);font-weight: 500}
.ui-as-menu__item[aria-checked="true"] small{font-weight: 400}
.ui-as-menu__item[data-danger]{color: #b3261e}
.ui-as-menu__item[data-danger] > svg{color: #b3261e}
.ui-as-toast{position: absolute;z-index: 40;left: 50%;bottom: 20px;display: flex;align-items: center;gap: 8px;height: 36px;padding: 0 14px 0 12px;border-radius: 999px;background: var(--ink);font-size: 13px;color: var(--on-ink);box-shadow: 0 10px 24px -8px rgba(11, 9, 8, 0.35);translate: -50% 0;animation: ui-as-toast var(--nm-dur-6, 1100ms) var(--ease) both}
.ui-as-rise{animation: ui-as-rise var(--nm-dur-4, 380ms) var(--ease) both;animation-delay: calc(var(--i, 0) * 35ms)}
@keyframes ui-as-rise{from{opacity: 0;transform: translateY(8px)}
to{opacity: 1;transform: none}
}
@keyframes ui-as-pop{from{opacity: 0;transform: scale(0.6)}
to{opacity: 1;transform: none}
}
@keyframes ui-as-popover{from{opacity: 0;transform: scale(0.96) translateY(-4px)}
to{opacity: 1;transform: none}
}
@keyframes ui-as-toast{0%{opacity: 0;transform: translateY(12px) scale(0.96)}
12%, 85%{opacity: 1;transform: none}
100%{opacity: 0;transform: translateY(6px)}
}
@media (prefers-reduced-motion: reduce){.ui-as *, .ui-as *::before, .ui-as *::after{animation-duration: 1ms !important;transition-duration: 1ms !important}
}
.ui-as-search input::-webkit-search-cancel-button{display: none}
.ui-as-empty{display: flex;flex-direction: column;align-items: center;margin-top: 16px;padding: 48px 24px 52px;border: 1px dashed var(--line-strong);border-radius: 14px;text-align: center}
.ui-as-empty[data-tall]{padding: 48px 24px 48px}
.ui-as-empty__icon{display: grid;place-items: center;width: 42px;height: 42px;border-radius: 11px;background: var(--chip);color: var(--muted)}
.ui-as-empty__title{margin-top: 16px;font-size: 14px;line-height: 20px;font-weight: 500;color: var(--ink)}
.ui-as-empty__text{max-width: 430px;margin: 6px 0 0;font-size: 13px;line-height: 19px;color: var(--muted);text-wrap: balance}
.ui-as-empty > .ui-button{margin-top: 18px}
.ui-as-folder-card__icon, .ui-as-folder-head__icon{position: relative;flex: none;width: 30px;height: 25px}
.ui-as-folder-card__icon .ui-fd, .ui-as-folder-head__icon .ui-fd{position: absolute;top: 50%;left: 50%;width: 75px;translate: -50% -50%}
:is(.ui-as-folder-card, .ui-as-folder-head):hover .ui-fd-icon{transform: translate(-50%, -48%) scale(1.03)}
:is(.ui-as-folder-card, .ui-as-folder-head):hover .ui-fd-doc--left{transform: translate(32px, 70px) rotate(9deg)}
:is(.ui-as-folder-card, .ui-as-folder-head):hover .ui-fd-doc--right{transform: translate(286px, 76px) rotate(5deg)}
:is(.ui-as-folder-card, .ui-as-folder-head):hover .ui-fd-doc--middle{transform: translate(166px, 52px) rotate(-7deg)}
:is(.ui-as-folder-card, .ui-as-folder-head):hover .ui-fd-front{top: 24.8%;border-radius: 3cqw 3cqw 6.333cqw 6.333cqw;transform: translateZ(2.33cqw) rotateX(-9deg)}
.ui-as-meta{display: inline-flex;align-items: center;gap: 4px;font-size: 12.5px;line-height: 17px;color: var(--muted)}
.ui-as-meta svg{color: var(--faint)}
.ui-as-template{display: grid;width: 239px;text-align: left}
.ui-as-template__preview{display: block;height: 158px;padding: 7px;border-radius: 14px;background: var(--card);box-shadow: 0 0 0 1px var(--line), var(--shadow);transition: box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-template:hover .ui-as-template__preview{box-shadow: 0 0 0 1px var(--line-strong), 0 2px 8px rgba(11, 9, 8, 0.05)}
.ui-as-template__name{margin-top: 10px;font-size: 13.5px;line-height: 18px;font-weight: 500;color: var(--ink)}
.ui-as-template .ui-as-meta{margin-top: 2px}
.ui-as-doc{--doc-back: #ff8a5c;--doc-glass-1: rgba(255, 138, 92, 0.72);--doc-glass-2: rgba(255, 107, 53, 0.78);--doc-shade: 60, 130, 180;--doc-paper: #f0e8df;display: flex;align-items: center;justify-content: center;height: 100%;border-radius: 10px;background: var(--card)}
.ui-as-doc[data-color="rose"]{--doc-back: #e2544a;--doc-glass-1: rgba(240, 147, 140, 0.74);--doc-glass-2: rgba(226, 84, 74, 0.8);--doc-shade: 190, 60, 88;--doc-paper: #f2eae2}
.ui-as-doc[data-color="emerald"]{--doc-back: #2f8d5c;--doc-glass-1: rgba(79, 157, 110, 0.74);--doc-glass-2: rgba(47, 141, 92, 0.8);--doc-shade: 40, 140, 96;--doc-paper: #f1e9e0}
.ui-as-doc__art{position: relative;display: block;width: 72px;height: 92px}
.ui-as-doc__back{position: absolute;inset: 0;border-radius: 11px;background: var(--doc-back);box-shadow: inset 0 1px 0 rgba(255, 253, 251, 0.45), 0 10px 18px -8px rgba(var(--doc-shade), 0.45);transform: translate(10px, -4px) rotate(8deg);transition: transform var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-doc__page{position: absolute;inset: 0;display: flex;flex-direction: column;gap: 5px;padding: 13px 11px;border-radius: 11px;background: linear-gradient(180deg, var(--doc-page, #fff) 0%, var(--doc-paper) 100%);box-shadow: 0 0 0 1px var(--doc-edge, rgba(0, 0, 0, 0.1)), 0 3px 5px rgba(var(--doc-shade), 0.16);transform: rotate(-3deg);transition: transform var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-doc__title{display: block;width: 58%;height: 5px;margin-bottom: 3px;border-radius: 3px;background: var(--doc-ink-strong, rgba(0, 0, 0, 0.2))}
.ui-as-doc__line{display: block;height: 4px;border-radius: 2px;background: var(--doc-ink, rgba(0, 0, 0, 0.1))}
.ui-as-doc__image{display: block;height: 26px;margin-bottom: 2px;border-radius: 5px;background: linear-gradient(160deg, var(--doc-glass-1), var(--doc-glass-2));opacity: 0.55}
.ui-as-sheet{display: grid;grid-template-columns: repeat(3, 1fr);gap: 2px}
.ui-as-sheet i{height: 8px;border-radius: 2px;background: var(--doc-cell, rgba(0, 0, 0, 0.07))}
.ui-as-sheet i:nth-child(-n + 3){background: rgba(var(--doc-shade), 0.35)}
.ui-as-doc__type{position: absolute;right: -12px;bottom: 10px;z-index: 2;padding: 3px 6px;border-radius: 5px;background: linear-gradient(180deg, rgba(11, 9, 8, 0) 55%, rgba(var(--doc-shade), 0.25) 100%), linear-gradient(180deg, var(--doc-glass-1), var(--doc-glass-2));box-shadow: inset 0 0 0 1px rgba(255, 253, 251, 0.35), inset 0 1px 0 rgba(255, 253, 251, 0.6), 0 6px 12px -4px rgba(var(--doc-shade), 0.45);-webkit-backdrop-filter: blur(4px) saturate(1.15);backdrop-filter: blur(4px) saturate(1.15);font-size: 10px;line-height: 13px;font-weight: 600;color: #fffdfb;text-shadow: 0 1px 2px rgba(var(--doc-shade), 0.45);transition: transform var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-template:hover .ui-as-doc__back{transform: translate(14px, -7px) rotate(12deg)}
.ui-as-template:hover .ui-as-doc__page{transform: translateY(-4px) rotate(-5deg)}
.ui-as-template:hover .ui-as-doc__type{transform: translate(2px, -2px)}
.ui-as-side__logo{font-size: 10.5px;font-weight: 600;color: var(--ink)}
.ui-as-user__initials{display: grid;place-items: center;width: 21px;height: 21px;border-radius: 50%;background: var(--accent-soft);font-size: 9.5px;font-weight: 600;color: var(--accent)}
:where(.dark, [data-theme="dark"]) .ui-as-doc{--doc-page: #342a20;--doc-edge: rgba(255, 253, 251, 0.1);--doc-ink: rgba(255, 253, 251, 0.14);--doc-ink-strong: rgba(255, 253, 251, 0.3);--doc-cell: rgba(255, 253, 251, 0.08)}
:where(.dark, [data-theme="dark"]) .ui-as-doc{--doc-paper: #2f261d}
:where(.dark, [data-theme="dark"]) .ui-as-doc[data-color="rose"]{--doc-paper: #2f261d}
:where(.dark, [data-theme="dark"]) .ui-as-doc[data-color="emerald"]{--doc-paper: #2c241c}
.ui-as-scrim{display: none}
@container ui-as (max-width: 900px){.ui-as-app > .ui-as-main{grid-row: 1;grid-column: 1 / -1;margin-left: var(--frame-gap)}
.ui-as-app > .ui-as-side{position: absolute;z-index: 50;top: 0;bottom: 0;left: 0;width: min(264px, calc(100% - 56px));padding: 10px 10px 10px 12px;border-radius: 0 18px 18px 0;background: var(--page);box-shadow: 0 0 0 1px var(--line), 0 24px 48px -12px rgba(11, 9, 8, 0.28)}
.ui-as-app:not([data-drawer]) > .ui-as-side{visibility: hidden;translate: calc(-100% - 24px) 0;transition: translate 380ms var(--ease), visibility 0s 380ms}
.ui-as-app[data-drawer] > .ui-as-side{visibility: visible;opacity: 1;translate: 0 0;transition: translate var(--nm-dur-4, 380ms) var(--ease), visibility 0s}
.ui-as-app > .ui-as-scrim{display: block;position: absolute;z-index: 45;inset: 0;background: rgba(11, 9, 8, 0.28);visibility: hidden;opacity: 0;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), visibility 0s 300ms}
.ui-as-app[data-drawer] > .ui-as-scrim{visibility: visible;opacity: 1;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), visibility 0s}
:where(.dark, [data-theme="dark"]) .ui-as-app > .ui-as-scrim{background: rgba(11, 9, 8, 0.55)}
.ui-as-app:not([data-drawer]) > .ui-as-side-open{visibility: visible;opacity: 1;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 160ms, visibility 0s}
.ui-as-app > .ui-as-side-open{left: calc(var(--frame-gap) + 9px);background: var(--panel)}
.ui-as-app > .ui-as-side-open:hover{background: var(--chip)}
.ui-as-page{padding: 46px 24px 48px}
.ui-as-main .ui-as-file-grid{display: grid;grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))}
.ui-as-main .ui-as-file-grid .ui-as-template{width: 100%}
.ui-as-main .ui-as-file-grid .ui-as-template__name{overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-as-main .ui-as-file-grid .ui-as-meta{display: block;overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-as-main .ui-as-file-grid .ui-as-meta svg{display: inline-block;vertical-align: -2px}
.ui-as-toolbar{flex-wrap: wrap;row-gap: 10px}
.ui-as-toolbar__right{flex-wrap: wrap}
.ui-as-section-head[data-inline]{flex-wrap: wrap;row-gap: 12px}
}
@container ui-as (max-width: 600px){.ui-as-app > *{--frame-gap: 6px}
.ui-as-app > .ui-as-main{border-radius: 16px}
.ui-as-page{padding: 52px 16px 40px}
.ui-as-page-title{font-size: 20px;line-height: 26px}
.ui-as-section-head{margin-top: 32px}
.ui-as-toolbar__left, .ui-as-toolbar__right{width: 100%}
.ui-as-toolbar__right .ui-as-search{order: 9;flex: 1 1 100%;width: auto !important}
.ui-as-toolbar__right > .ui-button:last-child{margin-left: auto}
.ui-as-tabs{max-width: 100%;overflow-x: auto;scrollbar-width: none}
.ui-as-tabs__tab{flex: none}
.ui-as-empty{padding: 36px 18px 40px}
.ui-as-popover--filter .ui-fm{width: 300px}
.ui-as-main .ui-as-file-grid{grid-template-columns: repeat(2, minmax(0, 1fr));gap: 16px 10px}
.ui-as-main .ui-as-file-grid .ui-as-template__preview{height: 128px}
}
/* ui-screen-chat — composed into this item */
/* Chat thread shared by Assistant Home and Agent Chat */
.ui-as-chat__user {
  align-self: flex-end;
  max-width: 80%;
  margin: 0;
  padding: 9px 14px;
  border-radius: 16px;
  background: var(--chip);
  font-size: 14px;
  line-height: 1.5;
  color: var(--ink);
  animation: ui-as-msg-in var(--nm-dur-4, 380ms) var(--ease) both;
}
.ui-as-msg {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--ink);
  animation: ui-as-msg-in var(--nm-dur-4, 380ms) var(--ease) 160ms both;
}
.ui-as-msg__who { display: flex; align-items: center; gap: 8px; font-weight: 500; }
.ui-as-msg__avatar { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--chip); color: var(--ink); }
.ui-as-msg__thinking.ui-think { zoom: 0.92; width: 100%; max-width: 440px; }
.ui-as-msg__p { margin: 0; animation: ui-as-msg-fade var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both; }
@keyframes ui-as-msg-in { from { opacity: 0; transform: translateY(12px); }
 to { opacity: 1; transform: none; }
 }
@keyframes ui-as-msg-fade { from { opacity: 0; }
 to { opacity: 1; }
 }
/* ui-screen-composer — composed into this item */
/* Composer: white card in the gray tray, folder and apps in the tray below */
.ui-as-composer {
  width: 100%;
  padding: 4px;
  border-radius: 18px;
  background: var(--tray);
}
.ui-as-composer__card {
  padding: 14px 10px 8px 14px;
  border-radius: 14px;
  background: var(--card);
  box-shadow: 0 0 0 1px var(--line), var(--shadow);
}
.ui-as-composer__field {
  display: block;
  width: 100%;
  min-height: 20px;
  margin: 0;
  padding: 0;
  border: 0;
  resize: none;
  background: transparent;
  font: inherit;
  font-size: 14px;
  line-height: 20px;
  color: var(--ink);
}
.ui-as-composer__field::placeholder { color: var(--placeholder); }
.ui-as-composer__bar {
  display: flex;
  align-items: center;
  gap: 2px;
  margin: 19px 0 0 -6px;
}
.ui-as-composer__end { display: flex; align-items: center; gap: 4px; margin-left: auto; }
.ui-as-ghost[data-active] { color: var(--ink); }
.ui-as-ghost[data-active] svg { color: var(--accent); }
.ui-as-ghost--model > svg:last-child { margin-left: -2px; color: var(--faint); }
.ui-as .ui-as-menu { min-width: 248px; }
.ui-as-composer__tray .ui-as-anchor { display: flex; }
/* Dictation: the mic turns red and pulses while it listens */
.ui-as-mic[aria-pressed="true"] { background: rgba(179, 38, 30, 0.1); color: #b3261e; animation: ui-as-listen var(--nm-dur-6, 1100ms) ease-in-out infinite; }
@keyframes ui-as-listen { 50% { box-shadow: 0 0 0 4px rgba(179, 38, 30, 0.12); }
 }
.ui-as-attachments { display: flex; flex-wrap: wrap; gap: 6px; margin: -4px 0 10px; }
.ui-as-attachment {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 4px 0 9px;
  border-radius: 8px;
  background: var(--chip);
  font-size: 12.5px;
  color: var(--ink);
  animation: ui-as-pop 240ms var(--ease);
}
.ui-as-attachment > svg { color: var(--muted); }
.ui-as-attachment button { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 6px; color: var(--muted); }
.ui-as-attachment button:hover { background: var(--hover); color: var(--ink); }
.ui-as-ghost {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 8px;
  border-radius: 8px;
  font-size: 12.5px;
  color: var(--text);
  transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-as-ghost svg { color: var(--muted); }
.ui-as-ghost:hover { background: var(--hover); }
.ui-as-ghost--model { font-weight: 500; color: var(--ink); }
.ui-as-send {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  margin-left: 2px;
  border-radius: 50%;
  background: var(--ink);
  color: var(--on-ink);
  transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 160ms var(--ease);
}
.ui-as-send:disabled { background: var(--disabled); cursor: default; }
.ui-as-send:not(:disabled):active { transform: scale(0.94); }
.ui-as-composer__tray {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 37px;
  padding: 0 8px 0 6px;
}
.ui-as-tray-link {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 26px;
  padding: 0 6px;
  border-radius: 8px;
  font-size: 11.5px;
  color: var(--text);
}
.ui-as-tray-link:hover { background: var(--hover); }
/* Glass Folder from the library at icon size; hovering the link opens it like hovering the folder itself */
.ui-as-tray-link__folder { position: relative; flex: none; width: 16px; height: 14px; }
.ui-as-tray-link__folder .ui-fd { position: absolute; top: 50%; left: 50%; width: 40px; translate: -50% -50%; }
.ui-as-tray-link:hover .ui-fd-icon { transform: translate(-50%, -48%) scale(1.03); }
.ui-as-tray-link:hover .ui-fd-doc--left { transform: translate(32px, 70px) rotate(9deg); }
.ui-as-tray-link:hover .ui-fd-doc--right { transform: translate(286px, 76px) rotate(5deg); }
.ui-as-tray-link:hover .ui-fd-doc--middle { transform: translate(166px, 52px) rotate(-7deg); }
.ui-as-tray-link:hover .ui-fd-front {
  top: 24.8%;
  border-radius: 3cqw 3cqw 6.333cqw 6.333cqw;
  transform: translateZ(2.33cqw) rotateX(-9deg);
}
.ui-as-tray-link--apps { gap: 10px; color: var(--muted); }
.ui-as-apps { display: flex; align-items: center; gap: 6px; }
.ui-as-apps svg { width: 13px; height: 13px; }
/* ui-glass-folder — composed into this item */
.ui-fd{--ui-fd-ease: cubic-bezier(0.2, 0.85, 0.25, 1);position: relative;width: 100%;aspect-ratio: 3 / 2;overflow: hidden;container-type: inline-size;font-family: "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif}
.ui-fd-icon{position: absolute;left: 50%;top: 50%;width: 40%;aspect-ratio: 6 / 5;container-type: inline-size;perspective: 220cqw;perspective-origin: 50% 60%;transform: translate(-50%, -48%);transition: transform var(--nm-dur-5, 620ms) var(--ui-fd-ease)}
.ui-fd-icon:hover{transform: translate(-50%, -48%) scale(1.03)}
.ui-fd-layer{position: absolute;inset: 0;width: 100%;height: 100%;overflow: visible}
.ui-fd-back{filter: drop-shadow(0 4cqw 4.6cqw rgba(255, 107, 53, 0.28)) drop-shadow(0 1.3cqw 2cqw rgba(255, 107, 53, 0.16)) drop-shadow(0 0.3cqw 0.7cqw rgba(255, 107, 53, 0.1))}
.ui-fd-doc{transform-box: fill-box;transform-origin: center;filter: drop-shadow(0 3px 4px rgba(163, 63, 22, 0.18));transition: transform var(--nm-dur-5, 620ms) var(--ui-fd-ease)}
.ui-fd-doc--left{transform: translate(40px, 80px) rotate(6deg)}
.ui-fd-doc--right{transform: translate(280px, 80px) rotate(6deg)}
.ui-fd-doc--middle{transform: translate(160px, 66px) rotate(-4deg)}
.ui-fd-icon:hover .ui-fd-doc--left{transform: translate(32px, 70px) rotate(9deg)}
.ui-fd-icon:hover .ui-fd-doc--right{transform: translate(286px, 76px) rotate(5deg)}
.ui-fd-icon:hover .ui-fd-doc--middle{transform: translate(166px, 52px) rotate(-7deg)}
.ui-fd-front{position: absolute;inset: 21.6% 0 0;border-radius: 6.333cqw;background: linear-gradient(180deg, rgba(163, 63, 22, 0) 74%, rgba(163, 63, 22, 0.28) 100%), linear-gradient(180deg, rgba(255, 138, 92, 0.45) 0%, rgba(255, 107, 53, 0.45) 100%);box-shadow: inset 0 0 0 0.67cqw rgba(255, 253, 251, 0.3), inset 0 0.25cqw 0 rgba(255, 253, 251, 0.55);-webkit-backdrop-filter: blur(3.3cqw) saturate(1.1);backdrop-filter: blur(3.3cqw) saturate(1.1);transform-origin: 50% 100%;transition: top var(--nm-dur-5, 620ms) var(--ui-fd-ease), border-radius var(--nm-dur-5, 620ms) var(--ui-fd-ease), transform var(--nm-dur-5, 620ms) var(--ui-fd-ease)}
.ui-fd-icon:hover .ui-fd-front{top: 24.8%;border-radius: 3cqw 3cqw 6.333cqw 6.333cqw;transform: translateZ(2.33cqw) rotateX(-9deg)}
:where(.dark, [data-theme="dark"]) .ui-fd-back-fill{fill: #ff6b35}
:where(.dark, [data-theme="dark"]) .ui-fd-paper-top{stop-color: #372d22}
:where(.dark, [data-theme="dark"]) .ui-fd-paper-bottom{stop-color: #2a231b}
:where(.dark, [data-theme="dark"]) .ui-fd-paper{stroke: rgba(255, 253, 251, 0.1)}
:where(.dark, [data-theme="dark"]) .ui-fd-line{fill: rgba(255, 253, 251, 0.16)}
:where(.dark, [data-theme="dark"]) .ui-fd-back{filter: drop-shadow(0 4cqw 4.6cqw rgba(11, 9, 8, 0.45)) drop-shadow(0 1.3cqw 2cqw rgba(11, 9, 8, 0.3))}
:where(.dark, [data-theme="dark"]) .ui-fd-doc{filter: drop-shadow(0 3px 4px rgba(11, 9, 8, 0.45))}
:where(.dark, [data-theme="dark"]) .ui-fd-front{background: linear-gradient(180deg, rgba(163, 63, 22, 0) 70%, rgba(163, 63, 22, 0.4) 100%), linear-gradient(180deg, rgba(255, 138, 92, 0.42) 0%, rgba(255, 107, 53, 0.5) 100%);box-shadow: inset 0 0 0 0.67cqw rgba(255, 253, 251, 0.14), inset 0 0.25cqw 0 rgba(255, 253, 251, 0.3)}
@media (prefers-reduced-motion: reduce){.ui-fd-icon, .ui-fd-doc, .ui-fd-front{transition: none}
}
/* ui-button — composed into this item */
/* Colors and motion as variables – override them on .ui-button (see Theming in the docs) */
.ui-button {
  --ui-btn-ink: #1c1713;
  --ui-btn-on-ink: #faf7f4;
  --ui-btn-dark-top: #342a20;
  --ui-btn-dark-bottom: #241e19;
  --ui-btn-dark-hover-top: #3c3125;
  --ui-btn-dark-hover-bottom: #2b231b;
  --ui-btn-edge-top: #473a2d;
  --ui-btn-edge-mid: #352a20;
  --ui-btn-edge-bottom: #1e1814;
  --ui-btn-ring: #14100d;
  --ui-btn-dark-shadow: rgba(11, 9, 8, 0.1);
  --ui-btn-surface: #fffdfb;
  --ui-btn-surface-hover: #faf7f4;
  --ui-btn-surface-shadow: rgba(11, 9, 8, 0.06);
  --ui-btn-line: #ded4ca;
  --ui-btn-muted: #68584b;
  --ui-btn-hover: #3d3226;
  --ui-btn-fill: #eee6de;
  --ui-btn-shine: rgba(255, 253, 251, 0.82);
  --ui-btn-shine-on-ink: rgba(255, 253, 251, 0.95);
  --ui-btn-danger: #b3261e;
  --ui-btn-danger-bg: #f1e9e1;
  --ui-btn-focus: rgba(28, 23, 19, 0.22);
  --ui-btn-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --ui-btn-load: 650ms;
  --h: 40px;
  --px: 16px;
  --gap: 8px;
  --fs: 14px;
  --icon: 18px;
  --radius: 12px;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--gap);
  height: var(--h);
  padding: 0 var(--px);
  margin: 0;
  border: 1px solid transparent;
  border-radius: var(--radius);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: var(--fs);
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.01em;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  -webkit-font-smoothing: antialiased;
  transition:
    background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    border-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    transform 160ms var(--ui-btn-ease),
    opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-button[data-size="sm"] {
  --h: 32px;
  --px: 12px;
  --gap: 6px;
  --fs: 13px;
  --icon: 16px;
  --radius: 10px;
}
.ui-button[data-size="lg"] {
  --h: 48px;
  --px: 20px;
  --gap: 10px;
  --fs: 15px;
  --icon: 20px;
  --radius: 14px;
}
.ui-button[data-icon-only] {
  width: var(--h);
  padding: 0;
}
/* primary: like the send button */
/* primary: a dark gradient with a light edge running down the border and a 1px ring */
.ui-button[data-variant="primary"] {
  background:
    linear-gradient(var(--ui-btn-dark-top), var(--ui-btn-dark-bottom)) padding-box,
    linear-gradient(var(--ui-btn-edge-top), var(--ui-btn-edge-mid), var(--ui-btn-edge-bottom)) border-box;
  color: var(--ui-btn-on-ink);
  box-shadow:
    0 0 0 1px var(--ui-btn-ring),
    0 2px 4px var(--ui-btn-dark-shadow);
}
.ui-button[data-variant="primary"]:hover:not(:disabled) {
  background:
    linear-gradient(var(--ui-btn-dark-hover-top), var(--ui-btn-dark-hover-bottom)) padding-box,
    linear-gradient(var(--ui-btn-edge-top), var(--ui-btn-edge-mid), var(--ui-btn-edge-bottom)) border-box;
}
/* secondary: white with the card outline */
.ui-button[data-variant="secondary"] {
  background: var(--ui-btn-surface);
  border-color: var(--ui-btn-line);
  color: var(--ui-btn-ink);
  box-shadow: 0 1px 2px var(--ui-btn-surface-shadow);
}
.ui-button[data-variant="secondary"]:hover:not(:disabled) {
  background: var(--ui-btn-surface-hover);
}
/* ghost: a muted label, the gray layer appears on hover */
.ui-button[data-variant="ghost"] {
  background: transparent;
  color: var(--ui-btn-muted);
}
.ui-button[data-variant="ghost"]:hover:not(:disabled) {
  background: var(--ui-btn-fill);
  color: var(--ui-btn-hover);
}
/* destructive: red label on a light red fill */
.ui-button[data-variant="destructive"] {
  background: var(--ui-btn-danger-bg);
  color: var(--ui-btn-danger);
}
.ui-button[data-variant="destructive"]:hover:not(:disabled) {
  background: color-mix(in srgb, var(--ui-btn-danger-bg) 88%, var(--ui-btn-danger));
}
.ui-button[data-variant="destructive"] .ui-button__label::after {
  --ui-btn-shine: rgba(255, 253, 251, 0.82);
}
.ui-button:active:not(:disabled):not([data-loading]) {
  transform: scale(0.97);
}
.ui-button:focus-visible {
  outline: 2px solid var(--ui-btn-focus);
  outline-offset: 2px;
}
.ui-button:disabled {
  opacity: 0.4;
  cursor: default;
}
.ui-button[data-loading] {
  cursor: default;
}
.ui-button__icon {
  display: grid;
  place-items: center;
  flex: none;
  width: var(--icon);
  height: var(--icon);
}
.ui-button__icon > svg {
  width: 100%;
  height: 100%;
}
/* Morph: the button clips while its width glides; changed parts blur in */
.ui-button {
  overflow: clip;
}
.ui-button[data-ready] .ui-button__label {
  animation: ui-button-label-in var(--nm-dur-4, 380ms) cubic-bezier(0.25, 1, 0.5, 1) both;
}
.ui-button[data-ready] .ui-button__icon {
  animation: ui-button-icon-in var(--nm-dur-5, 620ms) cubic-bezier(0.25, 1, 0.5, 1) both;
}
/* Loading: a band sweeps across a copy of the label, like "Request approval" in the Chat Composer */
.ui-button__label {
  position: relative;
}
.ui-button__label::after {
  content: attr(data-text);
  content: attr(data-text) / "";
  position: absolute;
  inset: 0;
  white-space: nowrap;
  color: transparent;
  background: linear-gradient(90deg, transparent 38%, var(--ui-btn-shine) 50%, transparent 62%) 100% 0 / 300% 100%
    no-repeat;
  -webkit-background-clip: text;
  background-clip: text;
  opacity: 0;
  pointer-events: none;
}
.ui-button[data-variant="primary"] .ui-button__label::after {
  --ui-btn-shine: var(--ui-btn-shine-on-ink);
}
.ui-button[data-loading] .ui-button__label {
  color: color-mix(in srgb, currentColor 55%, transparent);
}
.ui-button[data-loading] .ui-button__label::after {
  opacity: 1;
  animation: ui-button-sweep calc(var(--ui-btn-load) * 1.6) linear infinite;
}
.ui-button__spinner {
  animation: ui-button-spin var(--nm-dur-6, 1100ms) linear infinite;
}
@keyframes ui-button-label-in {
  from {
    opacity: 0;
    filter: blur(3px);
    transform: translateY(25%);
  }
}
@keyframes ui-button-icon-in {
  from {
    opacity: 0;
    filter: blur(2px);
    transform: scale(0.7);
  }
}
@keyframes ui-button-spin {
  to {
    transform: rotate(1turn);
  }
}
@keyframes ui-button-sweep {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: 0% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ui-button[data-ready] .ui-button__label,
  .ui-button[data-ready] .ui-button__icon {
    animation: none;
  }
  .ui-button {
    transition-duration: 1ms;
  }
  .ui-button[data-loading] .ui-button__label::after {
    animation: none;
    opacity: 0;
  }
}
/* Dark mode: follows a .dark class or data-theme="dark" on any ancestor, e.g. <html> */
:where(.dark, [data-theme="dark"]) .ui-button {
  /* primary inverts: a light gradient with dark text */
  --ui-btn-on-ink: #191411;
  --ui-btn-dark-top: #f4ece4;
  --ui-btn-dark-bottom: #dfd5cc;
  --ui-btn-dark-hover-top: #fffdfb;
  --ui-btn-dark-hover-bottom: #ebe3db;
  --ui-btn-edge-top: #fffdfb;
  --ui-btn-edge-mid: #ebe3db;
  --ui-btn-edge-bottom: #c8bdb2;
  --ui-btn-ring: rgba(11, 9, 8, 0.6);
  --ui-btn-dark-shadow: rgba(11, 9, 8, 0.4);
  --ui-btn-shine-on-ink: rgba(255, 253, 251, 0.9);
  --ui-btn-ink: #ebe3da;
  --ui-btn-surface: #27201a;
  --ui-btn-surface-hover: #2b231b;
  --ui-btn-surface-shadow: rgba(11, 9, 8, 0.4);
  --ui-btn-line: rgba(255, 253, 251, 0.1);
  --ui-btn-muted: #857567;
  --ui-btn-hover: #ebe3da;
  --ui-btn-fill: rgba(255, 253, 251, 0.06);
  --ui-btn-shine: rgba(235, 227, 218, 0.95);
  --ui-btn-danger: #e2544a;
  --ui-btn-danger-bg: rgba(226, 84, 74, 0.16);
  --ui-btn-focus: rgba(235, 227, 218, 0.3);
}
.ui-as-chat{display: flex;height: 100%;min-height: 0}
.ui-as-chat__main{display: flex;flex: 1;flex-direction: column;min-width: 0}
.ui-as-chat__bar{display: flex;flex: none;align-items: center;justify-content: space-between;height: 52px;padding: 0 12px 0 20px;border-bottom: 1px solid var(--line-soft);color: var(--muted)}
.ui-as-chat__crumbs{display: flex;align-items: center;gap: 8px;font-size: 13.5px}
.ui-as-chat__crumbs i{font-style: normal;color: var(--faint)}
.ui-as-chat__crumbs b{font-weight: 500;color: var(--ink)}
.ui-as-chat__crumbs .ui-as-icon-btn{width: 24px;height: 24px;margin-left: -2px}
.ui-as-chat__tools{display: flex;gap: 2px}
.ui-as-chat__tools .ui-as-icon-btn[aria-pressed="true"]{background: var(--chip);color: var(--ink)}
.ui-as-chat__thread{flex: 1;min-height: 0;overflow-y: auto;padding: 40px 32px 16px}
.ui-as-chat__column{display: flex;flex-direction: column;gap: 22px;max-width: 680px;margin: 0 auto}
.ui-as-chat__user{align-self: flex-end;margin: 0;padding: 8px 14px;border-radius: 14px;background: var(--chip);font-size: 14px;color: var(--ink)}
.ui-as-chat__answer{display: flex;flex-direction: column;align-items: flex-start;gap: 14px;font-size: 14px;line-height: 1.6;color: var(--ink)}
.ui-as-chat__answer p{margin: 0}
.ui-as-chat__who, .ui-as-chat__route{display: flex;align-items: center;gap: 8px;font-weight: 500}
.ui-as-chat__avatar{display: grid;place-items: center;width: 22px;height: 22px;border-radius: 50%;background: var(--chip);color: var(--ink)}
.ui-as-chat__worked{display: flex;align-items: center;gap: 6px;font-size: 13px;color: var(--muted)}
.ui-as-chat__label{padding-top: 4px;font-size: 12.5px;color: var(--muted)}
.ui-as-chat__agents{display: flex;flex-wrap: wrap;gap: 6px;margin-top: -6px}
.ui-as-chat__agent{display: inline-flex;align-items: center;gap: 7px;height: 30px;padding: 0 12px 0 10px;border-radius: 999px;box-shadow: inset 0 0 0 1px var(--line);font-size: 13px;color: var(--text)}
.ui-as-chat__agent svg{color: var(--muted)}
.ui-as-chat__agent[data-active]{background: var(--chip);box-shadow: none;color: var(--ink)}
.ui-as-chat__agent[data-active] svg{color: var(--ink)}
.ui-as-chat__composer{display: flex;flex-direction: column;gap: 8px;width: 100%;max-width: 744px;margin: 0 auto;padding: 8px 32px 24px}
.ui-as-chat__route{font-size: 13px;font-weight: 400;color: var(--muted)}
.ui-as-chat__route b{font-weight: 500;color: var(--ink)}
.ui-as-brief{display: flex;flex: none;flex-direction: column;width: 400px;border-left: 1px solid var(--line-soft)}
.ui-as-brief__body{display: flex;flex: 1;flex-direction: column;min-height: 0;overflow-y: auto}
.ui-as-brief__seg{display: flex;gap: 2px;margin: 20px 20px 0;padding: 3px;border-radius: 10px;background: var(--chip)}
.ui-as-brief__seg button{flex: 1;height: 28px;border-radius: 7px;font-size: 13px;font-weight: 500;color: var(--muted);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-brief__seg button:hover{color: var(--ink)}
.ui-as-brief__seg button[aria-selected="true"]{background: var(--card);box-shadow: 0 0 0 1px var(--line), var(--shadow);color: var(--ink)}
.ui-as-brief__product{display: flex;align-items: center;gap: 12px;margin: 18px 20px 6px}
.ui-as-brief__thumb{display: grid;flex: none;place-items: center;width: 40px;height: 40px;border-radius: 10px;background: #ddd3c9;color: #d99530}
.ui-as-brief__pinfo{display: flex;flex: 1;flex-direction: column;min-width: 0;font-size: 12.5px;line-height: 17px;color: var(--muted)}
.ui-as-brief__pinfo b{font-size: 14px;font-weight: 500;line-height: 20px;color: var(--ink)}
.ui-as-brief__chip{padding: 2px 8px;border-radius: 999px;background: rgba(47, 141, 92, 0.1);font-size: 12px;font-weight: 500;color: #1a7a4a}
.ui-as-brief__section{display: flex;flex-direction: column;padding: 18px 20px;border-top: 1px solid var(--line-soft)}
.ui-as-brief__product + .ui-as-brief__section{margin-top: 14px}
.ui-as-brief__section--split{flex-direction: row;justify-content: space-between;gap: 16px}
.ui-as-brief__label{padding-bottom: 12px;font-size: 12.5px;font-weight: 500;line-height: 16px;color: var(--faint)}
.ui-as-brief__option{display: flex;align-items: center;gap: 10px;min-height: 46px;margin: 0 -10px;padding: 0 10px;border-radius: 10px;color: var(--muted);text-align: left;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-brief__option:hover{background: var(--hover);color: var(--ink)}
.ui-as-brief__option[aria-checked="true"]{background: var(--chip);color: var(--ink)}
.ui-as-brief__radio{flex: none;width: 14px;height: 14px;border-radius: 50%;box-shadow: inset 0 0 0 1.5px var(--line-strong);transition: box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-brief__option[aria-checked="true"] .ui-as-brief__radio{box-shadow: inset 0 0 0 4px var(--ink)}
.ui-as-brief__name{display: flex;flex: 1;flex-direction: column;min-width: 0;font-size: 13.5px;font-weight: 500;line-height: 18px;color: var(--ink)}
.ui-as-brief__option .ui-as-brief__name{color: inherit}
.ui-as-brief__name small{font-size: 12.5px;font-weight: 400;line-height: 17px;color: var(--faint)}
.ui-as-brief__signal{display: flex;align-items: flex-end;gap: 2px;height: 11px}
.ui-as-brief__signal i{width: 3px;border-radius: 1px;background: #ccc1b6}
.ui-as-brief__signal i:nth-child(1){height: 5px}
.ui-as-brief__signal i:nth-child(2){height: 8px}
.ui-as-brief__signal i:nth-child(3){height: 11px}
.ui-as-brief__signal i[data-on]{background: #2f8d5c}
.ui-as-brief__pills{display: flex;flex-wrap: wrap;gap: 8px}
.ui-as-brief__pills span{padding: 4px 10px;border-radius: 999px;box-shadow: inset 0 0 0 1px var(--line);font-size: 12.5px;color: var(--text)}
.ui-as-brief__channel{display: flex;align-items: center;gap: 12px;min-height: 44px;cursor: pointer}
.ui-as-brief__channel > svg{color: var(--muted)}
.ui-as-switch{appearance: none;position: relative;flex: none;width: 30px;height: 18px;margin: 0;border-radius: 999px;background: var(--toggle-off);cursor: pointer;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-switch::after{content: "";position: absolute;top: 2px;left: 2px;width: 14px;height: 14px;border-radius: 50%;background: #fffdfb;box-shadow: 0 1px 2px rgba(11, 9, 8, 0.2);transition: translate var(--nm-dur-3, 240ms) var(--ease)}
.ui-as-switch:checked{background: var(--switch-on)}
.ui-as-switch:checked::after{translate: 12px 0}
.ui-as-switch:focus-visible{outline: 2px solid var(--accent);outline-offset: 2px}
.ui-as-brief__swatches, .ui-as-brief__formats{display: flex;gap: 14px;font-size: 12px;line-height: 16px;color: var(--muted)}
.ui-as-brief__swatches span, .ui-as-brief__formats span{display: flex;flex-direction: column;align-items: center;gap: 6px}
.ui-as-brief__swatches i{width: 22px;height: 22px;border-radius: 50%;box-shadow: inset 0 0 0 1px rgba(11, 9, 8, 0.08)}
.ui-as-brief__formats span{justify-content: flex-end;height: 44px}
.ui-as-brief__formats i{height: 24px;max-width: 36px;border: 1.5px solid var(--faint);border-radius: 4px}
.ui-as-brief__formats span:nth-child(3) i{width: 36px;height: auto}
.ui-as-brief__details{display: grid;gap: 12px;margin: 0}
.ui-as-brief__details div{display: flex;align-items: center;justify-content: space-between;font-size: 13px}
.ui-as-brief__details dt{display: flex;align-items: center;gap: 8px;color: var(--muted)}
.ui-as-brief__details dd{margin: 0;font-weight: 500;color: var(--ink);font-variant-numeric: tabular-nums}
.ui-as-brief__panel{display: flex;flex: 1 0 auto;flex-direction: column;animation: ui-as-rise 380ms var(--ease) both}
.ui-as-brief__assets{padding: 16px}
.ui-as-ads{display: grid;grid-template-columns: repeat(2, minmax(0, 1fr));gap: 12px}
.ui-as-ad{margin: 0}
.ui-as-ad__art{display: flex;flex-direction: column;justify-content: space-between;padding: 12px;border-radius: 12px;background: var(--ad, #f4ece5);box-shadow: inset 0 0 0 1px rgba(11, 9, 8, 0.06);color: var(--ad-ink, #1c1713)}
:where(.dark, [data-theme="dark"]) .ui-as-ad__art{--ad: #2e251c;--ad-ink: #f4ece4}
.ui-as-ad__art b{font-size: 15px;font-weight: 600;line-height: 1.2;letter-spacing: -0.01em}
.ui-as-ad figcaption{display: flex;justify-content: space-between;margin-top: 6px;font-size: 12.5px;font-weight: 500;color: var(--ink)}
.ui-as-ad figcaption span{font-weight: 400;color: var(--muted)}
.ui-as-brief__empty{display: flex;flex: 1;flex-direction: column;align-items: center;justify-content: center;gap: 6px;text-align: center}
.ui-as-brief__empty > span{display: grid;place-items: center;width: 42px;height: 42px;margin-bottom: 8px;border-radius: 12px;background: var(--chip);color: var(--muted)}
.ui-as-brief__empty b{font-size: 14px;font-weight: 500;color: var(--ink)}
.ui-as-brief__empty p{max-width: 240px;margin: 0 0 10px;font-size: 13px;line-height: 19px;color: var(--muted)}
.ui-as-activity{margin: 0;padding: 16px;list-style: none}
.ui-as-activity li{position: relative;display: flex;gap: 12px;padding-bottom: 18px}
.ui-as-activity li:not(:last-child)::before{content: "";position: absolute;top: 28px;bottom: 2px;left: 13px;width: 1px;background: var(--line)}
.ui-as-activity__icon{display: grid;flex: none;place-items: center;width: 27px;height: 27px;border-radius: 50%;box-shadow: inset 0 0 0 1px var(--line);color: var(--muted)}
.ui-as-activity__text{display: flex;flex-direction: column;padding-top: 3px;font-size: 13.5px;line-height: 19px;color: var(--ink)}
.ui-as-activity__text small{font-size: 12.5px;color: var(--faint)}
.ui-as-brief__go{display: flex;align-items: center;justify-content: space-between;margin-top: auto;padding: 16px 20px 20px;border-top: 1px solid var(--line-soft);position: sticky;bottom: 0;z-index: 1;background: var(--panel)}
.ui-as-brief__tags{display: flex;gap: 4px}
.ui-as-brief__tags span{padding: 3px 9px;border-radius: 999px;box-shadow: inset 0 0 0 1px var(--line);font-size: 12.5px;font-weight: 500;color: var(--text)}
:where(.dark, [data-theme="dark"]) .ui-as-brief__thumb{background: #31281e;color: #e8b05c}
:where(.dark, [data-theme="dark"]) .ui-as-brief__signal i:not([data-on]){background: #3a3024}
.ui-as-chat__main > .ui-as-chat__bar{transition: padding-left var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-app[data-collapsed] .ui-as-chat__main > .ui-as-chat__bar{padding-left: 52px}
.ui-as-chat__scrim{display: none}
@container ui-as-main (max-width: 900px){.ui-as-brief{position: absolute;z-index: 12;top: 0;right: 0;bottom: 0;width: min(400px, calc(100% - 32px));border-left: 0;border-radius: 0 var(--radius-panel) var(--radius-panel) 0;background: var(--panel);box-shadow: -1px 0 0 var(--line), -20px 0 40px -16px rgba(11, 9, 8, 0.2);animation: ui-as-brief-in var(--nm-dur-4, 380ms) var(--ease) both}
.ui-as-chat__scrim{display: block;position: absolute;z-index: 11;inset: 0;border-radius: inherit;background: rgba(11, 9, 8, 0.18);animation: ui-as-brief-fade var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
}
@keyframes ui-as-brief-in{from{transform: translateX(40px);opacity: 0}
to{transform: none;opacity: 1}
}
@keyframes ui-as-brief-fade{from{opacity: 0}
}
@container ui-as (max-width: 900px){.ui-as-chat__main > .ui-as-chat__bar{padding-left: 52px}
}
@container ui-as (max-width: 600px){.ui-as-chat__main .ui-as-chat__crumbs{min-width: 0}
.ui-as-chat__main .ui-as-chat__crumbs > svg, .ui-as-chat__main .ui-as-chat__crumbs > i{display: none}
.ui-as-chat__main .ui-as-chat__crumbs{font-size: 0}
.ui-as-chat__main .ui-as-chat__crumbs > b{overflow: hidden;font-size: 13.5px;white-space: nowrap;text-overflow: ellipsis}
.ui-as-chat__bar{padding-right: 8px}
.ui-as-brief .ui-as-chat__bar{padding-left: 52px}
.ui-as-chat__thread{padding: 24px 16px 12px}
.ui-as-chat__composer{padding: 6px 8px 8px}
.ui-as-chat__route{padding-left: 6px}
.ui-as-brief{width: 100%;border-radius: var(--radius-panel)}
.ui-as-brief__seg{margin: 16px 16px 0}
.ui-as-brief__product{margin: 16px 16px 6px}
.ui-as-brief__section{padding: 16px}
.ui-as-brief__section--split{flex-wrap: wrap}
.ui-as-brief__go{padding: 14px 16px 16px}
}

`;
