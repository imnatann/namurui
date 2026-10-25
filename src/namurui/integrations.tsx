"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";

/*
 * Integrations Screen – the app directory of the Acme workspace, inside the app shell.
 * The sidebar is the shell's own: workspace switcher, menu, projects, announcement, guide and
 * account, with the drawer and collapse states the sheet defines. The page keeps its toolbar
 * pinned to the top of the scroll container; once the list moves, the bar loses its top padding
 * and closes up. Tabs filter by connection state, the field filters as you type, and the pill
 * under the tabs is measured from the active tab. Each row connects in two steps – the button
 * spins while the handshake is pending, then settles on the check – and the Request button opens
 * the small form popover the sheet styles. Opening a section's "and N more" chip reveals the
 * apps that only exist as marks in the reference.
 */

export type IntegrationFilter = "all" | "connected" | "available";

/** What the connect button is showing: the plus, the spinner, or the check. */
export type IntegrationState = "off" | "connecting" | "on";

/** A brand mark, plus the colour the original paints behind the solid ones. */
export type IntegrationMark = {
  /** Inline SVG lifted from the reference; the sheet draws it at 17px inside the tile */
  logo: ReactNode;
  /** Brand colour painted behind the mark, with the ring dropped, as the reference sets it */
  tile?: CSSProperties;
};

/** One app in the directory. */
export type IntegrationItem = IntegrationMark & {
  /** Stable id; keys the pending and connected maps */
  id: string;
  /** Row title */
  name: string;
  /** Line under the name; the sheet truncates it with an ellipsis */
  description: string;
  /** Shows the verified-partner shield after the name */
  official?: boolean;
  /** Starts out connected */
  connected?: boolean;
};

/** The stacked-logos chip under a grid. */
export type IntegrationMore = {
  /** Copy next to the marks, e.g. "Stripe, Zapier and 2 more" */
  label: string;
  /** Up to three miniature marks */
  marks: IntegrationMark[];
  /** Apps the chip opens up; without them the chip only reports what exists */
  items?: IntegrationItem[];
};

export type IntegrationSection = {
  /** Stable id; used as the React key and for the expanded map */
  id: string;
  /** Group heading */
  title: string;
  items: IntegrationItem[];
  /** Optional "and N more" chip under the grid */
  more?: IntegrationMore;
};

/** The announcement card at the foot of the sidebar. */
export type IntegrationNews = {
  /** Small accent line above the title */
  kicker: string;
  /** Headline of the announcement */
  title: string;
  /** Footer action under the card */
  action: string;
  /** Called when the footer action is clicked */
  onAction?: () => void;
};

/** The progress card under the announcement. */
export type IntegrationGuide = {
  /** Title of the card */
  title: string;
  /** How far along the setup is, in percent */
  percent: number;
  /** Accent-coloured encouragement next to the percentage */
  cheer?: string;
  /** Called when the card is clicked */
  onOpen?: () => void;
};

export type IntegrationsScreenProps = {
  /** Sections and their apps; defaults to the reference directory */
  sections?: IntegrationSection[];
  /** Page heading */
  title?: string;
  /** Line under the heading */
  subtitle?: string;
  /** Placeholder and accessible name of the filter field */
  searchPlaceholder?: string;
  /** Show a count inside each tab; the reference screen ships without them */
  showCounts?: boolean;
  /** How long the simulated handshake spins before the app reports connected */
  connectDelayMs?: number;
  /** Workspace name in the sidebar; its first letter becomes the logo */
  workspace?: string;
  /** Project entries under the Projects label */
  projects?: string[];
  /** Account at the bottom of the sidebar */
  user?: { name: string; initials?: string };
  /** Announcement card; pass null to take it out of the foot of the sidebar */
  news?: IntegrationNews | null;
  /** Progress card; pass null to take it out of the foot of the sidebar */
  guide?: IntegrationGuide | null;
  /** Called with the label of a sidebar item, project or account action */
  onNavigate?: (label: string) => void;
  /** Called when a handshake finishes, or when a connected app is disconnected */
  onConnectionChange?: (item: IntegrationItem, connected: boolean) => void;
  /** Called with the trimmed tool name when the request form is submitted */
  onRequest?: (name: string) => void;
  /** Extra class on the root */
  className?: string;
};

export function IntegrationsScreen({
  sections = DEFAULT_SECTIONS,
  title = "Integrations",
  subtitle = "Connect the tools your team already uses and work with them right in the chat.",
  searchPlaceholder = "Search integrations",
  showCounts = false,
  connectDelayMs = 900,
  workspace = "Acme",
  projects = DEFAULT_PROJECTS,
  user = DEFAULT_USER,
  news = DEFAULT_NEWS,
  guide = DEFAULT_GUIDE,
  onNavigate,
  onConnectionChange,
  onRequest,
  className,
}: IntegrationsScreenProps) {
  const [filter, setFilter] = useState<IntegrationFilter>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [connected, setConnected] = useState<Record<string, boolean>>(() => seedConnections(sections));
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [compact, setCompact] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menu, setMenu] = useState<"workspace" | "user" | null>(null);
  const [newsOpen, setNewsOpen] = useState(true);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [requestSent, setRequestSent] = useState<string | null>(null);
  const [pill, setPill] = useState({ left: 0, width: 36 });

  const tabsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<HTMLSpanElement>(null);
  const requestInputRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLSpanElement>(null);
  const userRef = useRef<HTMLSpanElement>(null);
  const handshakes = useRef(new Map<string, number>());

  // The pill is a measuring device: it sits under whichever tab is selected, so it has to be
  // re-read whenever the label widths change.
  useEffect(() => {
    const list = tabsRef.current;
    if (!list) return;
    const measure = () => {
      const active = list.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!active) return;
      const left = active.offsetLeft;
      const width = active.offsetWidth;
      setPill((current) => (current.left === left && current.width === width ? current : { left, width }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [filter, showCounts, sections]);

  // A pending handshake owns a timer; unmounting mid-handshake must not leave it running.
  useEffect(
    () => () => {
      handshakes.current.forEach((timer) => window.clearTimeout(timer));
      handshakes.current.clear();
    },
    [],
  );

  // Any click that lands outside the open popover closes it, as does Escape.
  useEffect(() => {
    if (!requestOpen && menu === null) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (requestOpen && !requestRef.current?.contains(target)) setRequestOpen(false);
      if (menu === "workspace" && !workspaceRef.current?.contains(target)) setMenu(null);
      if (menu === "user" && !userRef.current?.contains(target)) setMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setRequestOpen(false);
      setMenu(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [requestOpen, menu]);

  useEffect(() => {
    if (requestOpen && !requestSent) requestInputRef.current?.focus();
  }, [requestOpen, requestSent]);

  const isConnected = (item: IntegrationItem) => Boolean(connected[item.id]);

  const toggleConnection = (item: IntegrationItem) => {
    // The ref catches a second click in the same tick, before the pending state has rendered.
    if (pending[item.id] || handshakes.current.has(item.id)) return;
    if (connected[item.id]) {
      setConnected((current) => ({ ...current, [item.id]: false }));
      onConnectionChange?.(item, false);
      return;
    }
    setPending((current) => ({ ...current, [item.id]: true }));
    const timer = window.setTimeout(() => {
      handshakes.current.delete(item.id);
      setPending((current) => ({ ...current, [item.id]: false }));
      setConnected((current) => ({ ...current, [item.id]: true }));
      onConnectionChange?.(item, true);
    }, connectDelayMs);
    handshakes.current.set(item.id, timer);
  };

  const openRequest = () => {
    setMenu(null);
    setRequestSent(null);
    setRequestOpen(true);
  };

  const submitRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = requestName.trim();
    if (!name) return;
    onRequest?.(name);
    setRequestName("");
    setRequestSent(name);
  };

  const openSide = () => {
    if (collapsed) setCollapsed(false);
    else setDrawerOpen(true);
  };

  const needle = query.trim().toLowerCase();
  const matches = (item: IntegrationItem) =>
    !needle || item.name.toLowerCase().includes(needle) || item.description.toLowerCase().includes(needle);

  const allItems = sections.flatMap((section) =>
    section.more?.items ? [...section.items, ...section.more.items] : section.items,
  );
  const counts: Record<IntegrationFilter, number> = {
    all: allItems.filter(matches).length,
    connected: allItems.filter((item) => matches(item) && isConnected(item)).length,
    available: allItems.filter((item) => matches(item) && !isConnected(item)).length,
  };

  const visibleSections = sections
    .map((section) => {
      const everything = section.more?.items ? [...section.items, ...section.more.items] : section.items;
      const pool = needle || expanded[section.id] ? everything : section.items;
      const items = pool.filter(
        (item) =>
          matches(item) &&
          (filter === "all" || (filter === "connected" ? isConnected(item) : !isConnected(item))),
      );
      return { section, items, open: Boolean(expanded[section.id]) };
    })
    .filter((entry) => entry.items.length > 0);

  const none = visibleSections.length === 0;
  const emptyTitle = needle
    ? `No integrations match “${query.trim()}”`
    : filter === "connected"
      ? "Nothing connected yet"
      : "Everything is connected";
  const emptyText = needle
    ? "Try a different word, or request the tool your team needs and we will look at it."
    : filter === "connected"
      ? "Connect a tool above and it will show up here, next to the ones you already use."
      : "Every app in the directory is connected. Open a row to disconnect one.";

  return (
    <div
      className={["ui-as ui-as-app", className].filter(Boolean).join(" ")}
      data-collapsed={collapsed || undefined}
      data-drawer={drawerOpen || undefined}
    >
      {/* React 19 hoists this into <head> once, no matter how many screens render */}
      <style href="ui-integrations" precedence="default">
        {css}
      </style>

      <button
        className="ui-as-icon-btn ui-as-side-open"
        type="button"
        aria-label="Open sidebar"
        tabIndex={-1}
        onClick={openSide}
      >
        <PanelIcon size={16} />
      </button>

      <div className="ui-as-scrim" aria-hidden="true" onClick={() => setDrawerOpen(false)} />

      <aside className="ui-as-side">
        <header className="ui-as-side__head">
          <span className="ui-as-anchor" ref={workspaceRef}>
            <button
              className="ui-as-side__workspace"
              type="button"
              aria-expanded={menu === "workspace"}
              onClick={() => setMenu(menu === "workspace" ? null : "workspace")}
            >
              <span className="ui-as-side__logo">{workspace.charAt(0).toUpperCase()}</span>
              {workspace}
              <ChevronDownIcon />
            </button>

            {menu === "workspace" && (
              <div className="ui-as-popover">
                <div className="ui-as-menu" role="menu" aria-label="Workspace">
                  <span className="ui-as-menu__title">{workspace}</span>
                  <div className="ui-as-menu__list">
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked="true"
                      className="ui-as-menu__item"
                      onClick={() => setMenu(null)}
                    >
                      <span className="ui-as-menu__label">{workspace} workspace</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="ui-as-menu__item"
                      onClick={() => {
                        setMenu(null);
                        onNavigate?.("Workspace settings");
                      }}
                    >
                      <span className="ui-as-menu__label">Workspace settings</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="ui-as-menu__item"
                      onClick={() => {
                        setMenu(null);
                        onNavigate?.("Members");
                      }}
                    >
                      <span className="ui-as-menu__label">Members</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </span>

          <span className="ui-as-side__tools">
            <button
              className="ui-as-icon-btn"
              type="button"
              aria-label="Search"
              onClick={() => {
                setDrawerOpen(false);
                searchRef.current?.focus();
              }}
            >
              <SearchIcon size={16} />
            </button>
            <button
              className="ui-as-icon-btn"
              type="button"
              aria-label="Collapse sidebar"
              onClick={() => setCollapsed(true)}
            >
              <PanelIcon size={16} />
            </button>
          </span>
        </header>

        <nav className="ui-as-side__nav" aria-label="Main menu">
          <div className="ui-as-side__group">
            <button type="button" className="ui-as-side__item" onClick={() => onNavigate?.("New chat")}>
              <PencilIcon />
              New chat
            </button>
            <button type="button" className="ui-as-side__item" onClick={() => onNavigate?.("Folders")}>
              <FoldersIcon />
              Folders
            </button>
            <button
              type="button"
              className="ui-as-side__item"
              aria-current="page"
              onClick={() => onNavigate?.("Integrations")}
            >
              <GridIcon />
              Integrations
            </button>
          </div>

          <span className="ui-as-side__label">Projects</span>
          {projects.map((project) => (
            <button
              key={project}
              type="button"
              className="ui-as-side__item"
              onClick={() => onNavigate?.(project)}
            >
              <ProjectIcon />
              {project}
            </button>
          ))}
        </nav>

        <div className="ui-as-side__foot">
          {news && newsOpen && (
            <div className="ui-as-news" data-count="2">
              <div className="ui-as-news__card ui-as-news__card--back" aria-hidden="true">
                <span className="ui-as-news__kicker">{news.kicker}</span>
                <CloseIcon size={13} />
              </div>
              <div className="ui-as-news__card">
                <div className="ui-as-news__top">
                  <span className="ui-as-news__kicker">{news.kicker}</span>
                  <button
                    type="button"
                    className="ui-as-news__close"
                    aria-label="Dismiss"
                    onClick={() => setNewsOpen(false)}
                  >
                    <CloseIcon size={13} />
                  </button>
                </div>
                <b className="ui-as-news__title">{news.title}</b>
                <button type="button" className="ui-as-news__more" onClick={news.onAction}>
                  {news.action}
                  <ChevronRightIcon size={13} />
                </button>
              </div>
            </div>
          )}

          {guide && (
            <div className="ui-as-guide-slot" style={{ height: GUIDE_HEIGHT }}>
              <div className="ui-as-guide" data-state="closed" style={{ height: GUIDE_HEIGHT }}>
                <div className="ui-as-guide__inner">
                  <button
                    type="button"
                    className="ui-as-steps ui-as-guide__content"
                    aria-expanded={false}
                    onClick={guide.onOpen}
                  >
                    <span className="ui-as-steps__title">
                      {guide.title}
                      <ChevronRightIcon size={13} />
                    </span>
                    <span className="ui-as-steps__sub">
                      {guide.percent}% done ·{" "}
                      {guide.cheer ? <span className="ui-as-steps__cheer">{guide.cheer}</span> : null}
                    </span>
                    <span className="ui-as-steps__bar">
                      <i style={{ width: `${guide.percent}%` }} />
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <span className="ui-as-anchor ui-as-user-menu" ref={userRef}>
            <button
              type="button"
              className="ui-as-user"
              aria-expanded={menu === "user"}
              onClick={() => setMenu(menu === "user" ? null : "user")}
            >
              <span className="ui-as-user__initials">{initialsOf(user)}</span>
              {user.name}
              <ChevronDownIcon />
            </button>

            {menu === "user" && (
              <div className="ui-as-popover" data-side="top">
                <div className="ui-as-menu" role="menu" aria-label="Account">
                  <span className="ui-as-menu__title">{user.name}</span>
                  <div className="ui-as-menu__list">
                    <button
                      type="button"
                      role="menuitem"
                      className="ui-as-menu__item"
                      onClick={() => {
                        setMenu(null);
                        onNavigate?.("Profile");
                      }}
                    >
                      <span className="ui-as-menu__label">Profile</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="ui-as-menu__item"
                      onClick={() => {
                        setMenu(null);
                        onNavigate?.("Settings");
                      }}
                    >
                      <span className="ui-as-menu__label">Settings</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="ui-as-menu__item"
                      data-danger="true"
                      onClick={() => {
                        setMenu(null);
                        onNavigate?.("Sign out");
                      }}
                    >
                      <span className="ui-as-menu__label">Sign out</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </span>
        </div>
      </aside>

      <main
        className="ui-as-main"
        onScroll={(event) => setCompact(event.currentTarget.scrollTop > SCROLL_THRESHOLD)}
      >
        <div className="ui-as-integrations">
          <h1 className="ui-as-page-title">{title}</h1>
          <p className="ui-as-page-sub">{subtitle}</p>

          <div
            className="ui-as-toolbar ui-as-integrations__bar"
            style={compact ? { paddingTop: BAR_COMPACT_PADDING } : undefined}
          >
            <div className="ui-as-tabs" role="tablist" ref={tabsRef}>
              <span
                className="ui-as-tabs__pill"
                aria-hidden="true"
                style={{ transform: `translateX(${pill.left}px)`, width: pill.width }}
              />
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === tab.id}
                  className="ui-as-tabs__tab"
                  onClick={() => setFilter(tab.id)}
                >
                  {tab.label}
                  {showCounts ? <span className="ui-as-tool__count">{counts[tab.id]}</span> : null}
                </button>
              ))}
            </div>

            <div className="ui-as-toolbar__right">
              <label className="ui-as-search" style={{ width: SEARCH_WIDTH }}>
                <SearchIcon size={15} />
                <input
                  ref={searchRef}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query ? (
                  <button
                    type="button"
                    className="ui-as-search__clear"
                    aria-label="Clear search"
                    onClick={() => {
                      setQuery("");
                      searchRef.current?.focus();
                    }}
                  >
                    <CloseIcon size={12} />
                  </button>
                ) : null}
              </label>

              <span className="ui-as-anchor" ref={requestRef}>
                <button
                  type="button"
                  className="ui-button"
                  data-variant="primary"
                  data-size="sm"
                  data-ready="true"
                  aria-expanded={requestOpen || undefined}
                  onClick={() => (requestOpen ? setRequestOpen(false) : openRequest())}
                >
                  <span className="ui-button__icon" aria-hidden="true">
                    <PlusIcon />
                  </span>
                  <span className="ui-button__label" data-text="Request">
                    Request
                  </span>
                </button>

                {requestOpen && (
                  <div className="ui-as-popover" data-align="end">
                    <div className="ui-as-request">
                      {requestSent ? (
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            setRequestOpen(false);
                            setRequestSent(null);
                          }}
                        >
                          <b>Request sent</b>
                          <span>We will mail you the moment {requestSent} is ready to connect.</span>
                          <button
                            type="submit"
                            className="ui-button"
                            data-variant="primary"
                            data-size="sm"
                            data-ready="true"
                          >
                            <span className="ui-button__label" data-text="Done">
                              Done
                            </span>
                          </button>
                        </form>
                      ) : (
                        <form onSubmit={submitRequest}>
                          <b>Request an integration</b>
                          <span>Tell us which tool your team needs and we will take a look.</span>
                          <input
                            ref={requestInputRef}
                            placeholder="Tool or service name"
                            aria-label="Tool or service name"
                            type="text"
                            value={requestName}
                            onChange={(event) => setRequestName(event.target.value)}
                          />
                          <button
                            type="submit"
                            className="ui-button"
                            data-variant="primary"
                            data-size="sm"
                            data-ready="true"
                          >
                            <span className="ui-button__label" data-text="Send request">
                              Send request
                            </span>
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                )}
              </span>
            </div>
          </div>

          <div>
            {visibleSections.map(({ section, items, open }, index) => (
              <section
                key={section.id}
                className="ui-as-int-section ui-as-rise"
                style={{ "--i": index } as CSSProperties}
              >
                <h2 className="ui-as-int-section__title">{section.title}</h2>
                <div className="ui-as-int-grid">
                  {items.map((item) => (
                    <IntegrationRow
                      key={item.id}
                      item={item}
                      state={pending[item.id] ? "connecting" : isConnected(item) ? "on" : "off"}
                      onToggle={toggleConnection}
                    />
                  ))}
                </div>

                {section.more && !needle && (
                  <button
                    type="button"
                    className="ui-as-int-more"
                    aria-expanded={open}
                    onClick={() =>
                      setExpanded((current) => ({ ...current, [section.id]: !current[section.id] }))
                    }
                  >
                    <span className="ui-as-int-more__logos" aria-hidden="true">
                      {section.more.marks.map((mark, markIndex) => (
                        <span className="ui-as-int-logo" style={mark.tile} key={markIndex}>
                          {mark.logo}
                        </span>
                      ))}
                    </span>
                    {open ? SHOW_FEWER : section.more.label}
                    <ChevronRightIcon size={14} />
                  </button>
                )}
              </section>
            ))}

            {none && (
              <div className="ui-as-int-empty">
                <div className="ui-as-empty">
                  <span className="ui-as-empty__icon">
                    <SearchIcon size={18} />
                  </span>
                  <span className="ui-as-empty__title">{emptyTitle}</span>
                  <p className="ui-as-empty__text">{emptyText}</p>
                  <button
                    type="button"
                    className="ui-button"
                    data-variant="primary"
                    data-size="sm"
                    data-ready="true"
                    onClick={() => {
                      if (query.trim()) setRequestName(query.trim());
                      openRequest();
                    }}
                  >
                    <span className="ui-button__icon" aria-hidden="true">
                      <PlusIcon />
                    </span>
                    <span className="ui-button__label" data-text="Request an integration">
                      Request an integration
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/** One directory row: mark, name with the optional verified shield, blurb, and the connect button. */
function IntegrationRow({
  item,
  state,
  onToggle,
}: {
  item: IntegrationItem;
  state: IntegrationState;
  onToggle: (item: IntegrationItem) => void;
}) {
  const label =
    state === "on" ? `Disconnect ${item.name}` : state === "connecting" ? `Connecting ${item.name}` : `Connect ${item.name}`;
  const title =
    state === "on" ? "Connected – click to disconnect" : state === "connecting" ? "Connecting…" : "Connect";

  return (
    <div className="ui-as-int-row">
      <span className="ui-as-int-logo" style={item.tile}>
        {item.logo}
      </span>
      <span className="ui-as-int-row__text">
        <span className="ui-as-int-row__name">
          {item.name}
          {item.official ? (
            <span className="ui-as-int-row__badge" title="Official">
              <VerifiedIcon />
            </span>
          ) : null}
        </span>
        <span className="ui-as-int-row__desc">{item.description}</span>
      </span>
      <button
        type="button"
        className="ui-as-int-add"
        data-state={state === "on" ? "on" : "off"}
        aria-label={label}
        title={title}
        aria-busy={state === "connecting" || undefined}
        onClick={() => onToggle(item)}
      >
        {state === "connecting" ? <span className="ui-as-spinner" /> : state === "on" ? <CheckIcon /> : <PlusIcon />}
      </button>
    </div>
  );
}

/** The sidebar glyph used by the drawer opener, the collapse toggle and the mobile close. */
function PanelIcon({ size = 16 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M2 12C2 8.31087 2 6.4663 2.81382 5.15877C3.1149 4.67502 3.48891 4.25427 3.91891 3.91554C5.08116 3 6.72077 3 10 3H14C17.2792 3 18.9188 3 20.0811 3.91554C20.5111 4.25427 20.8851 4.67502 21.1862 5.15877C22 6.4663 22 8.31087 22 12C22 15.6891 22 17.5337 21.1862 18.8412C20.8851 19.325 20.5111 19.7457 20.0811 20.0845C18.9188 21 17.2792 21 14 21H10C6.72077 21 5.08116 21 3.91891 20.0845C3.48891 19.7457 3.1149 19.325 2.81382 18.8412C2 17.5337 2 15.6891 2 12Z" stroke="currentColor" strokeWidth="1.9" />
      <path d="M9.5 3L9.5 21" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M5 7H6M5 10H6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

/** Magnifier, drawn at 16 in the sidebar and 15 in the toolbar. */
function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M17 17L21 21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

/** Disclosure arrow under the workspace and account buttons. */
function ChevronDownIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

/** Row arrow: changelog, guide, and the more chip. */
function ChevronRightIcon({ size = 13 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

/** Dismiss glyph for the announcement card and the search clear. */
function CloseIcon({ size = 13 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

/** New chat. */
function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M16.4249 4.60509L17.4149 3.6151C18.2351 2.79497 19.5648 2.79497 20.3849 3.6151C21.205 4.43524 21.205 5.76493 20.3849 6.58507L19.3949 7.57506M16.4249 4.60509L9.76558 11.2644C9.25807 11.772 8.89804 12.4078 8.72397 13.1041L8 16L10.8959 15.276C11.5922 15.102 12.228 14.7419 12.7356 14.2344L19.3949 7.57506M16.4249 4.60509L19.3949 7.57506" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M18.9999 13.5C18.9999 16.7875 18.9999 18.4312 18.092 19.5376C17.9258 19.7401 17.7401 19.9258 17.5375 20.092C16.4312 21 14.7874 21 11.4999 21H11C7.22876 21 5.34316 21 4.17159 19.8284C3.00003 18.6569 3 16.7712 3 13V12.5C3 9.21252 3 7.56879 3.90794 6.46244C4.07417 6.2599 4.2599 6.07417 4.46244 5.90794C5.56879 5 7.21252 5 10.5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

/** Folders entry in the primary menu. */
function FoldersIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M8 7H16.75C18.8567 7 19.91 7 20.6667 7.50559C20.9943 7.72447 21.2755 8.00572 21.4944 8.33329C22 9.08996 22 10.1433 22 12.25C22 15.7612 22 17.5167 21.1573 18.7779C20.7926 19.3238 20.3238 19.7926 19.7779 20.1573C18.5167 21 16.7612 21 13.25 21H12C7.28595 21 4.92893 21 3.46447 19.5355C2 18.0711 2 15.714 2 11V7.94427C2 6.1278 2 5.21956 2.38032 4.53806C2.65142 4.05227 3.05227 3.65142 3.53806 3.38032C4.21956 3 5.1278 3 6.94427 3C8.10802 3 8.6899 3 9.19926 3.19101C10.3622 3.62712 10.8418 4.68358 11.3666 5.73313L12 7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </svg>
  );
}

/** Integrations entry, marked current in the reference. */
function GridIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M10.5 8.75V6.75C10.5 5.10626 10.5 4.28439 10.046 3.73121C9.96291 3.62995 9.87005 3.53709 9.76879 3.45398C9.21561 3 8.39374 3 6.75 3C5.10626 3 4.28439 3 3.73121 3.45398C3.62995 3.53709 3.53709 3.62995 3.45398 3.73121C3 4.28439 3 5.10626 3 6.75V8.75C3 10.3937 3 11.2156 3.45398 11.7688C3.53709 11.8701 3.62995 11.9629 3.73121 12.046C4.28439 12.5 5.10626 12.5 6.75 12.5C8.39374 12.5 9.21561 12.5 9.76879 12.046C9.87005 11.9629 9.96291 11.8701 10.046 11.7688C10.5 11.2156 10.5 10.3937 10.5 8.75Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M7.75 15.5H5.75C5.05222 15.5 4.70333 15.5 4.41943 15.5861C3.78023 15.78 3.28002 16.2802 3.08612 16.9194C3 17.2033 3 17.5522 3 18.25C3 18.9478 3 19.2967 3.08612 19.5806C3.28002 20.2198 3.78023 20.72 4.41943 20.9139C4.70333 21 5.05222 21 5.75 21H7.75C8.44778 21 8.79667 21 9.08057 20.9139C9.71977 20.72 10.22 20.2198 10.4139 19.5806C10.5 19.2967 10.5 18.9478 10.5 18.25C10.5 17.5522 10.5 17.2033 10.4139 16.9194C10.22 16.2802 9.71977 15.78 9.08057 15.5861C8.79667 15.5 8.44778 15.5 7.75 15.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M21 17.25V15.25C21 13.6063 21 12.7844 20.546 12.2312C20.4629 12.1299 20.3701 12.0371 20.2688 11.954C19.7156 11.5 18.8937 11.5 17.25 11.5C15.6063 11.5 14.7844 11.5 14.2312 11.954C14.1299 12.0371 14.0371 12.1299 13.954 12.2312C13.5 12.7844 13.5 13.6063 13.5 15.25V17.25C13.5 18.8937 13.5 19.7156 13.954 20.2688C14.0371 20.3701 14.1299 20.4629 14.2312 20.546C14.7844 21 15.6063 21 17.25 21C18.8937 21 19.7156 21 20.2688 20.546C20.3701 20.4629 20.4629 20.3701 20.546 20.2688C21 19.7156 21 18.8937 21 17.25Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M18.25 3H16.25C15.5522 3 15.2033 3 14.9194 3.08612C14.2802 3.28002 13.78 3.78023 13.5861 4.41943C13.5 4.70333 13.5 5.05222 13.5 5.75C13.5 6.44778 13.5 6.79667 13.5861 7.08057C13.78 7.71977 14.2802 8.21998 14.9194 8.41388C15.2033 8.5 15.5522 8.5 16.25 8.5H18.25C18.9478 8.5 19.2967 8.5 19.5806 8.41388C20.2198 8.21998 20.72 7.71977 20.9139 7.08057C21 6.79667 21 6.44778 21 5.75C21 5.05222 21 4.70333 20.9139 4.41943C20.72 3.78023 20.2198 3.28002 19.5806 3.08612C19.2967 3 18.9478 3 18.25 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

/** Project entry under the Projects label. */
function ProjectIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M2.5 20V8.87695C2.5 7.58945 2.5 6.9457 2.78533 6.47048C2.9541 6.18939 3.18939 5.9541 3.47048 5.78533C3.9457 5.5 4.59449 5.5 5.89206 5.5C6.52339 5.5 6.83906 5.5 7.12612 5.58819C7.31759 5.64702 7.49914 5.73428 7.66469 5.84705C7.91289 6.01611 8.10859 6.26074 8.5 6.75C8.89141 7.23926 9.08711 7.48389 9.33531 7.65295C9.50086 7.76572 9.68241 7.85298 9.87388 7.91181C10.1609 8 10.4742 8 11.1008 8H15C16.4045 8 17.1067 8 17.6111 8.33706C17.8295 8.48298 18.017 8.67048 18.1629 8.88886C18.5 9.39331 18.5 10.0955 18.5 11.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M4.42028 14.0144L3.63368 16.0144C2.65618 18.4998 2.16743 19.7425 2.7524 20.6213C3.33737 21.5 4.65337 21.5 7.28537 21.5H15.1903C16.4249 21.5 17.0422 21.5 17.5295 21.1795C18.0169 20.859 18.2702 20.2865 18.7769 19.1415L19.6618 17.1415C20.7866 14.5992 21.349 13.3281 20.7679 12.4141C20.1868 11.5 18.8163 11.5 16.0752 11.5H8.07196C6.78232 11.5 6.1375 11.5 5.63811 11.8439C5.13872 12.1877 4.89924 12.7966 4.42028 14.0144Z" stroke="currentColor" strokeWidth="1.9" />
      <path d="M11.5 4.51456C12.4151 3.28409 13.6662 2.55594 15.5125 2.50161C16.1155 2.48386 16.7152 2.61395 17.2682 2.85544C18.5748 3.42601 19.4185 4.15644 20 5.5L21.5 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M12 4V20M20 12H4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M5 14L8.5 17.5L19 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

/** Verified-partner shield after a first-party integration name. */
function VerifiedIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M18.9905 19H19M18.9905 19C18.3678 19.6175 17.2393 19.4637 16.4479 19.4637C15.4765 19.4637 15.0087 19.6537 14.3154 20.347C13.7251 20.9374 12.9337 22 12 22C11.0663 22 10.2749 20.9374 9.68457 20.347C8.99128 19.6537 8.52349 19.4637 7.55206 19.4637C6.76068 19.4637 5.63218 19.6175 5.00949 19C4.38181 18.3776 4.53628 17.2444 4.53628 16.4479C4.53628 15.4414 4.31616 14.9786 3.59938 14.2618C2.53314 13.1956 2.00002 12.6624 2 12C2.00001 11.3375 2.53312 10.8044 3.59935 9.73817C4.2392 9.09832 4.53628 8.46428 4.53628 7.55206C4.53628 6.76065 4.38249 5.63214 5 5.00944C5.62243 4.38178 6.7556 4.53626 7.55208 4.53626C8.46427 4.53626 9.09832 4.2392 9.73815 3.59937C10.8044 2.53312 11.3375 2 12 2C12.6625 2 13.1956 2.53312 14.2618 3.59937C14.9015 4.23907 15.5355 4.53626 16.4479 4.53626C17.2393 4.53626 18.3679 4.38247 18.9906 5C19.6182 5.62243 19.4637 6.75559 19.4637 7.55206C19.4637 8.55858 19.6839 9.02137 20.4006 9.73817C21.4669 10.8044 22 11.3375 22 12C22 12.6624 21.4669 13.1956 20.4006 14.2618C19.6838 14.9786 19.4637 15.4414 19.4637 16.4479C19.4637 17.2444 19.6182 18.3776 18.9905 19Z" stroke="currentColor" strokeWidth="1.9" />
      <path d="M9 12.8929C9 12.8929 10.2 13.5447 10.8 14.5C10.8 14.5 12.6 10.75 15 9.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}


/* ------------------------------------------------------------------ icons end */

/** Initials for the account chip: first letters of the first two words of the name. */
function initialsOf(user: { name: string; initials?: string }) {
  if (user.initials) return user.initials;
  return user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/** Connection flags the directory starts with, read off each item. */
function seedConnections(sections: IntegrationSection[]) {
  const seeded: Record<string, boolean> = {};
  for (const section of sections) {
    const items = section.more?.items ? [...section.items, ...section.more.items] : section.items;
    for (const item of items) if (item.connected) seeded[item.id] = true;
  }
  return seeded;
}

const TABS: ReadonlyArray<{ id: IntegrationFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "connected", label: "Connected" },
  { id: "available", label: "Available" },
];

/** Every brand mark the directory ships with. */
type MarkKey =
  | "slack"
  | "notion"
  | "linear"
  | "figma"
  | "github"
  | "hubspot"
  | "drive"
  | "calendar"
  | "analytics"
  | "zoom"
  | "discord"
  | "intercom"
  | "calendly"
  | "typeform"
  | "dropbox"
  | "stripe"
  | "zapier"
  | "airtable"
  | "mixpanel"
  | "make"
  | "unlisted";

/*
 * The marks themselves. A tile's background is the brand's own colour — a value of the logo, not
 * a theme token — so it rides on the item as data and is applied inline exactly where the
 * reference applies it. Everything else (radius, size, ring, hover) comes from the sheet.
 */
const MARKS: Record<MarkKey, IntegrationMark> = {
  /** Slack – four rounded bars in the brand colours. */
  slack: {
    logo: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#E01E5A" d="M5.04 15.17a2.53 2.53 0 0 1-2.52 2.52A2.53 2.53 0 0 1 0 15.17a2.53 2.53 0 0 1 2.52-2.53h2.52zm1.27 0a2.53 2.53 0 0 1 2.53-2.53 2.53 2.53 0 0 1 2.52 2.53v6.31A2.53 2.53 0 0 1 8.84 24a2.53 2.53 0 0 1-2.53-2.52z" />
        <path fill="#36C5F0" d="M8.84 5.04a2.53 2.53 0 0 1-2.53-2.52A2.53 2.53 0 0 1 8.84 0a2.53 2.53 0 0 1 2.52 2.52v2.52zm0 1.27a2.53 2.53 0 0 1 2.52 2.53 2.53 2.53 0 0 1-2.52 2.52H2.52A2.53 2.53 0 0 1 0 8.84a2.53 2.53 0 0 1 2.52-2.53z" />
        <path fill="#2EB67D" d="M18.96 8.84a2.53 2.53 0 0 1 2.52-2.53A2.53 2.53 0 0 1 24 8.84a2.53 2.53 0 0 1-2.52 2.52h-2.52zm-1.27 0a2.53 2.53 0 0 1-2.53 2.52 2.53 2.53 0 0 1-2.52-2.52V2.52A2.53 2.53 0 0 1 15.16 0a2.53 2.53 0 0 1 2.53 2.52z" />
        <path fill="#ECB22E" d="M15.16 18.96a2.53 2.53 0 0 1 2.53 2.52A2.53 2.53 0 0 1 15.16 24a2.53 2.53 0 0 1-2.52-2.52v-2.52zm0-1.27a2.53 2.53 0 0 1-2.52-2.53 2.53 2.53 0 0 1 2.52-2.52h6.32A2.53 2.53 0 0 1 24 15.16a2.53 2.53 0 0 1-2.52 2.53z" />
      </svg>
    ),
  },
  /** Notion – the flat page mark, drawn in the current ink. */
  notion: {
    logo: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
      </svg>
    ),
  },
  /** Linear – the ring at low opacity on its brand blue. */
  linear: {
    logo: (
      <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
        <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />
      </svg>
    ),
    tile: {
      background: "rgb(94, 106, 210)",
      boxShadow: "none",
    },
  },
  /** Figma – the five-shape mark, taller than the tile is wide. */
  figma: {
    logo: (
      <svg viewBox="0 0 38 57" aria-hidden="true">
        <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0Z" fill="#1ABCFE" />
        <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0Z" fill="#0ACF83" />
        <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19Z" fill="#FF7262" />
        <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5Z" fill="#F24E1E" />
        <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5Z" fill="#A259FF" />
      </svg>
    ),
  },
  /** GitHub – the octocat silhouette on near-black. */
  github: {
    logo: (
      <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
    ),
    tile: {
      background: "rgb(23, 23, 23)",
      boxShadow: "none",
    },
  },
  /** HubSpot – the sprocket, drawn flush in HubSpot orange. */
  hubspot: {
    logo: (
      <svg viewBox="0 0 24 24" fill="#FF7A59" aria-hidden="true">
        <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z" />
      </svg>
    ),
  },
  /** Google Drive – the triangle in Drive green. */
  drive: {
    logo: (
      <svg viewBox="0 0 24 24" fill="#1FA463" aria-hidden="true">
        <path d="M12.01 1.485c-2.082 0-3.754.02-3.743.047.01.02 1.708 3.001 3.774 6.62l3.76 6.574h3.76c2.081 0 3.753-.02 3.742-.047-.005-.02-1.708-3.001-3.775-6.62l-3.76-6.574zm-4.76 1.73a789.828 789.861 0 0 0-3.63 6.319L0 15.868l1.89 3.298 1.885 3.297 3.62-6.335 3.618-6.33-1.88-3.287C8.1 4.704 7.255 3.22 7.25 3.214zm2.259 12.653-.203.348c-.114.198-.96 1.672-1.88 3.287a423.93 423.948 0 0 1-1.698 2.97c-.01.026 3.24.042 7.222.042h7.244l1.796-3.157c.992-1.734 1.85-3.23 1.906-3.323l.104-.167h-7.249z" />
      </svg>
    ),
  },
  /** Google Calendar – the calendar sheet, framed in Calendar blue. */
  calendar: {
    logo: (
      <svg viewBox="0 0 24 24" fill="#4285F4" aria-hidden="true">
        <path d="M18.316 5.684H24v12.632h-5.684V5.684zM5.684 24h12.632v-5.684H5.684V24zM18.316 5.684V0H1.895A1.894 1.894 0 0 0 0 1.895v16.421h5.684V5.684h12.632zm-7.207 6.25v-.065c.272-.144.5-.349.687-.617s.279-.595.279-.982c0-.379-.099-.72-.3-1.025a2.05 2.05 0 0 0-.832-.714 2.703 2.703 0 0 0-1.197-.257c-.6 0-1.094.156-1.481.467-.386.311-.65.671-.793 1.078l1.085.452c.086-.249.224-.461.413-.633.189-.172.445-.257.767-.257.33 0 .602.088.816.264a.86.86 0 0 1 .322.703c0 .33-.12.589-.36.778-.24.19-.535.284-.886.284h-.567v1.085h.633c.407 0 .748.109 1.02.327.272.218.407.499.407.843 0 .336-.129.614-.387.832s-.565.327-.924.327c-.351 0-.651-.103-.897-.311-.248-.208-.422-.502-.521-.881l-1.096.452c.178.616.505 1.082.977 1.401.472.319.984.478 1.538.477a2.84 2.84 0 0 0 1.293-.291c.382-.193.684-.458.902-.794.218-.336.327-.72.327-1.149 0-.429-.115-.797-.344-1.105a2.067 2.067 0 0 0-.881-.689zm2.093-1.931l.602.913L15 10.045v5.744h1.187V8.446h-.827l-2.158 1.557zM22.105 0h-3.289v5.184H24V1.895A1.894 1.894 0 0 0 22.105 0zm-3.289 23.5l4.684-4.684h-4.684V23.5zM0 22.105C0 23.152.848 24 1.895 24h3.289v-5.184H0v3.289z" />
      </svg>
    ),
  },
  /** Google Analytics – the rising bars in Analytics orange. */
  analytics: {
    logo: (
      <svg viewBox="0 0 24 24" fill="#E37400" aria-hidden="true">
        <path d="M22.84 2.9982v17.9987c.0086 1.6473-1.3197 2.9897-2.967 2.9984a2.9808 2.9808 0 01-.3677-.0208c-1.528-.226-2.6477-1.5558-2.6105-3.1V3.1204c-.0369-1.5458 1.0856-2.8762 2.6157-3.1 1.6361-.1915 3.1178.9796 3.3093 2.6158.014.1201.0208.241.0202.3619zM4.1326 18.0548c-1.6417 0-2.9726 1.331-2.9726 2.9726C1.16 22.6691 2.4909 24 4.1326 24s2.9726-1.3309 2.9726-2.9726-1.331-2.9726-2.9726-2.9726zm7.8728-9.0098c-.0171 0-.0342 0-.0513.0003-1.6495.0904-2.9293 1.474-2.891 3.1256v7.9846c0 2.167.9535 3.4825 2.3505 3.763 1.6118.3266 3.1832-.7152 3.5098-2.327.04-.1974.06-.3983.0593-.5998v-8.9585c.003-1.6474-1.33-2.9852-2.9773-2.9882z" />
      </svg>
    ),
  },
  /** Zoom – the wordmark glyph on Zoom blue. */
  zoom: {
    logo: (
      <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
        <path d="M5.033 14.649H.743a.74.74 0 0 1-.686-.458.74.74 0 0 1 .16-.808L3.19 10.41H1.06A1.06 1.06 0 0 1 0 9.35h3.957c.301 0 .57.18.686.458a.74.74 0 0 1-.161.808L1.51 13.59h2.464c.585 0 1.06.475 1.06 1.06zM24 11.338c0-1.14-.927-2.066-2.066-2.066-.61 0-1.158.265-1.537.686a2.061 2.061 0 0 0-1.536-.686c-1.14 0-2.066.926-2.066 2.066v3.311a1.06 1.06 0 0 0 1.06-1.06v-2.251a1.004 1.004 0 0 1 2.013 0v2.251c0 .586.474 1.06 1.06 1.06v-3.311a1.004 1.004 0 0 1 2.012 0v2.251c0 .586.475 1.06 1.06 1.06zM16.265 12a2.728 2.728 0 1 1-5.457 0 2.728 2.728 0 0 1 5.457 0zm-1.06 0a1.669 1.669 0 1 0-3.338 0 1.669 1.669 0 0 0 3.338 0zm-4.82 0a2.728 2.728 0 1 1-5.458 0 2.728 2.728 0 0 1 5.457 0zm-1.06 0a1.669 1.669 0 1 0-3.338 0 1.669 1.669 0 0 0 3.338 0z" />
      </svg>
    ),
    tile: {
      background: "rgb(11, 92, 255)",
      boxShadow: "none",
    },
  },
  /** Discord – the controller face on Blurple. */
  discord: {
    logo: (
      <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
      </svg>
    ),
    tile: {
      background: "rgb(88, 101, 242)",
      boxShadow: "none",
    },
  },
  /** Intercom – the speech square on Intercom blue. */
  intercom: {
    logo: (
      <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
        <path d="M21 0H3C1.343 0 0 1.343 0 3v18c0 1.658 1.343 3 3 3h18c1.658 0 3-1.342 3-3V3c0-1.657-1.342-3-3-3zm-5.801 4.399c0-.44.36-.8.802-.8.44 0 .8.36.8.8v10.688c0 .442-.36.801-.8.801-.443 0-.802-.359-.802-.801V4.399zM11.2 3.994c0-.44.357-.799.8-.799s.8.359.8.799v11.602c0 .44-.357.8-.8.8s-.8-.36-.8-.8V3.994zm-4 .405c0-.44.359-.8.799-.8.443 0 .802.36.802.8v10.688c0 .442-.36.801-.802.801-.44 0-.799-.359-.799-.801V4.399zM3.199 6c0-.442.36-.8.802-.8.44 0 .799.358.799.8v7.195c0 .441-.359.8-.799.8-.443 0-.802-.36-.802-.8V6zM20.52 18.202c-.123.105-3.086 2.593-8.52 2.593-5.433 0-8.397-2.486-8.521-2.593-.335-.288-.375-.792-.086-1.128.285-.334.79-.375 1.125-.09.047.041 2.693 2.211 7.481 2.211 4.848 0 7.456-2.186 7.479-2.207.334-.289.839-.25 1.128.086.289.336.25.84-.086 1.128zm.281-5.007c0 .441-.36.8-.801.8-.441 0-.801-.36-.801-.8V6c0-.442.361-.8.801-.8.441 0 .801.357.801.8v7.195z" />
      </svg>
    ),
    tile: {
      background: "rgb(31, 141, 237)",
      boxShadow: "none",
    },
  },
  /** Calendly – the calendar ring on Calendly blue. */
  calendly: {
    logo: (
      <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
        <path d="M19.655 14.262c.281 0 .557.023.828.064 0 .005-.005.01-.005.014-.105.267-.234.534-.381.786l-1.219 2.106c-1.112 1.936-3.177 3.127-5.411 3.127h-2.432c-2.23 0-4.294-1.191-5.412-3.127l-1.218-2.106a6.251 6.251 0 0 1 0-6.252l1.218-2.106C6.736 4.832 8.8 3.641 11.035 3.641h2.432c2.23 0 4.294 1.191 5.411 3.127l1.219 2.106c.147.252.271.519.381.786 0 .004.005.009.005.014-.267.041-.543.064-.828.064-1.816 0-2.501-.607-3.291-1.306-.764-.676-1.711-1.517-3.44-1.517h-1.029c-1.251 0-2.387.455-3.2 1.278-.796.805-1.233 1.904-1.233 3.099v1.411c0 1.196.437 2.295 1.233 3.099.813.823 1.949 1.278 3.2 1.278h1.034c1.729 0 2.676-.841 3.439-1.517.791-.703 1.471-1.306 3.287-1.301Zm.005-3.237c.399 0 .794-.036 1.179-.11-.002-.004-.002-.01-.002-.014-.073-.414-.193-.823-.349-1.218.731-.12 1.407-.396 1.986-.819 0-.004-.005-.013-.005-.018-.331-1.085-.832-2.101-1.489-3.03-.649-.915-1.435-1.719-2.331-2.395-1.867-1.398-4.088-2.138-6.428-2.138-1.448 0-2.855.28-4.175.841-1.273.543-2.423 1.315-3.407 2.299S2.878 6.552 2.341 7.83c-.557 1.324-.842 2.726-.842 4.175 0 1.448.281 2.855.842 4.174.542 1.274 1.314 2.423 2.298 3.407s2.129 1.761 3.407 2.299c1.324.556 2.727.841 4.175.841 2.34 0 4.561-.74 6.428-2.137a10.815 10.815 0 0 0 2.331-2.396c.652-.929 1.158-1.949 1.489-3.03 0-.004.005-.014.005-.018-.579-.423-1.255-.699-1.986-.819.161-.395.276-.804.349-1.218.005-.009.005-.014.005-.023.869.166 1.692.506 2.404 1.035.685.505.552 1.075.446 1.416C22.184 20.437 17.619 24 12.221 24c-6.625 0-12-5.375-12-12s5.37-12 12-12c5.398 0 9.963 3.563 11.471 8.464.106.341.239.915-.446 1.421-.717.529-1.535.873-2.404 1.034.128.716.128 1.45 0 2.166-.387-.074-.782-.11-1.182-.11-4.184 0-3.968 2.823-6.736 2.823h-1.029c-1.899 0-3.15-1.357-3.15-3.095v-1.411c0-1.738 1.251-3.094 3.15-3.094h1.034c2.768 0 2.552 2.823 6.731 2.827Z" />
      </svg>
    ),
    tile: {
      background: "rgb(0, 107, 255)",
      boxShadow: "none",
    },
  },
  /** Typeform – the sloping key on charcoal. */
  typeform: {
    logo: (
      <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
        <path d="M15.502 13.035c-.5 0-.756-.411-.756-.917 0-.505.252-.894.756-.894.513 0 .756.407.756.894-.004.515-.261.917-.756.917Zm-4.888-1.81c.292 0 .414.17.414.317 0 .357-.365.514-1.126.536 0-.442.253-.854.712-.854Zm-3.241 1.81c-.473 0-.67-.384-.67-.917 0-.527.202-.894.67-.894.477 0 .702.38.702.894 0 .537-.234.917-.702.917Zm-3.997-2.334h-.738l1.224 2.808c-.234.519-.36.648-.522.648-.171 0-.333-.138-.45-.259l-.324.43c.22.232.522.366.832.366.387 0 .685-.224.856-.626l1.413-3.371h-.725l-.738 2.012-.828-2.008Zm19.553.523c.36 0 .432.246.432.823v1.516H24v-1.914c0-.689-.473-.988-.91-.988-.386 0-.742.241-.94.688a.901.901 0 0 0-.891-.688c-.365 0-.73.232-.927.666v-.626h-.64v2.857h.64v-1.22c0-.617.324-1.114.765-1.114.36 0 .427.246.427.823v1.516h.64l-.005-1.225c0-.617.329-1.114.77-1.114Zm-5.1-.523h-.324v2.857h.639v-1.095c0-.693.306-1.163.76-1.163.118 0 .217.005.325.05l.099-.676c-.081-.009-.153-.018-.225-.018-.45 0-.774.309-.964.707V10.7h-.31Zm-2.327-.045c-.846 0-1.418.644-1.418 1.458 0 .845.58 1.475 1.418 1.475.85 0 1.431-.648 1.431-1.475-.004-.818-.594-1.458-1.431-1.458Zm-4.852 2.38c-.333 0-.581-.17-.685-.515.847-.036 1.675-.242 1.675-.988 0-.43-.423-.872-1.03-.872-.82 0-1.374.666-1.374 1.457 0 .828.545 1.476 1.36 1.476.567 0 .927-.228 1.21-.559l-.31-.42c-.329.335-.531.42-.846.42Zm-3.151-2.38c-.324 0-.648.188-.774.483v-.438h-.64v3.98h.64v-1.422c.135.205.445.34.72.34.85 0 1.3-.631 1.3-1.48-.004-.841-.445-1.463-1.246-1.463Zm-4.483-1.1H0v.622h1.18v3.38h.67v-3.38h1.166v-.622Zm9.502 1.145h-.383v.572h.383v2.285h.639v-2.285h.621v-.572h-.621v-.447c0-.286.117-.385.382-.385.1 0 .19.027.311.068l.144-.537c-.117-.067-.351-.094-.504-.094-.612 0-.972.367-.972 1.002v.393Z" />
      </svg>
    ),
    tile: {
      background: "rgb(38, 38, 39)",
      boxShadow: "none",
    },
  },
  /** Dropbox – the open box in Dropbox blue. */
  dropbox: {
    logo: (
      <svg viewBox="0 0 24 24" fill="#0061FF" aria-hidden="true">
        <path d="M6 1.807L0 5.629l6 3.822 6.001-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6.001-3.822L6 9.452l-6 3.822zM18 9.452l-6 3.822 6 3.822 6-3.822-6-3.822zM6 18.371l6.001 3.822 6-3.822-6-3.822L6 18.371z" />
      </svg>
    ),
  },
  /** Stripe – shown in the Popular chip, revealed when the chip is opened. */
  stripe: {
    logo: (
      <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
        <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />
      </svg>
    ),
    tile: {
      background: "rgb(99, 91, 255)",
      boxShadow: "none",
    },
  },
  /** Zapier – the asterisk on orange. */
  zapier: {
    logo: (
      <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
        <path d="M4.157 0A4.151 4.151 0 0 0 0 4.161v15.678A4.151 4.151 0 0 0 4.157 24h15.682A4.152 4.152 0 0 0 24 19.839V4.161A4.152 4.152 0 0 0 19.839 0H4.157Zm10.61 8.761h.03a.577.577 0 0 1 .23.038.585.585 0 0 1 .201.124.63.63 0 0 1 .162.431.612.612 0 0 1-.162.435.58.58 0 0 1-.201.128.58.58 0 0 1-.23.042.529.529 0 0 1-.235-.042.585.585 0 0 1-.332-.328.559.559 0 0 1-.038-.235.613.613 0 0 1 .17-.431.59.59 0 0 1 .405-.162Zm2.853 1.572c.03.004.061.004.095.004.325-.011.646.064.937.219.238.144.431.355.552.609.128.279.189.582.185.888v.193a2 2 0 0 1 0 .219h-2.498c.003.227.075.45.204.642a.78.78 0 0 0 .646.265.714.714 0 0 0 .484-.136.642.642 0 0 0 .23-.318l.915.257a1.398 1.398 0 0 1-.28.537c-.14.159-.321.284-.521.355a2.234 2.234 0 0 1-.836.136 1.923 1.923 0 0 1-1.001-.245 1.618 1.618 0 0 1-.665-.703 2.221 2.221 0 0 1-.227-1.036 1.95 1.95 0 0 1 .48-1.398 1.9 1.9 0 0 1 1.3-.488Zm-9.607.023c.162.004.325.026.48.079.207.065.4.174.563.314.26.302.393.692.366 1.088v2.276H8.53l-.109-.711h-.065c-.064.163-.155.31-.272.439a1.122 1.122 0 0 1-.374.264 1.023 1.023 0 0 1-.453.083 1.334 1.334 0 0 1-.866-.264.965.965 0 0 1-.329-.801.993.993 0 0 1 .076-.431 1.02 1.02 0 0 1 .242-.363 1.478 1.478 0 0 1 1.043-.303h.952v-.181a.696.696 0 0 0-.136-.454.553.553 0 0 0-.438-.154.695.695 0 0 0-.378.086.48.48 0 0 0-.193.254l-.99-.144a1.26 1.26 0 0 1 .257-.563c.14-.174.321-.302.533-.378.261-.091.54-.136.82-.129.053-.003.106-.007.163-.007Zm4.384.007c.174 0 .347.038.506.114.182.083.34.211.458.374.257.423.377.911.351 1.406a2.53 2.53 0 0 1-.355 1.448 1.148 1.148 0 0 1-1.009.517c-.204 0-.401-.045-.582-.136a1.052 1.052 0 0 1-.48-.457 1.298 1.298 0 0 1-.114-.234h-.045l.004 1.784h-1.059v-4.713h.904l.117.805h.057c.068-.208.177-.401.328-.56a1.129 1.129 0 0 1 .843-.344h.076v-.004Zm7.559.084h.903l.113.805h.053a1.37 1.37 0 0 1 .235-.484.813.813 0 0 1 .313-.242.82.82 0 0 1 .39-.076h.234v1.051h-.401a.662.662 0 0 0-.313.008.623.623 0 0 0-.272.155.663.663 0 0 0-.174.26.683.683 0 0 0-.027.314v1.875h-1.054v-3.666Zm-17.515.003h3.262v.896L3.73 13.104l.034.113h1.973l.042.9H2.4v-.9l1.931-1.754-.045-.117H2.441v-.896Zm11.815 0h1.055v3.659h-1.055V10.45Zm3.443.684.019.016a.69.69 0 0 0-.351.045.756.756 0 0 0-.287.204c-.11.155-.174.336-.189.522h1.545c-.034-.526-.257-.787-.74-.787h.003Zm-5.718.163c-.026 0-.057 0-.083.004a.78.78 0 0 0-.31.053.746.746 0 0 0-.257.189 1.016 1.016 0 0 0-.204.695v.064c-.015.257.057.507.204.711a.634.634 0 0 0 .253.196.638.638 0 0 0 .314.061.644.644 0 0 0 .578-.265c.14-.223.204-.48.189-.74a1.216 1.216 0 0 0-.181-.711.677.677 0 0 0-.503-.257Zm-4.509 1.266a.464.464 0 0 0-.268.102.373.373 0 0 0-.114.276c0 .053.008.106.027.155a.375.375 0 0 0 .087.132.576.576 0 0 0 .397.11v.004a.863.863 0 0 0 .563-.182.573.573 0 0 0 .211-.457v-.14h-.903Z" />
      </svg>
    ),
    tile: {
      background: "rgb(255, 79, 0)",
      boxShadow: "none",
    },
  },
  /** Airtable – the cube in Airtable teal. */
  airtable: {
    logo: (
      <svg viewBox="0 0 24 24" fill="#18BFFF" aria-hidden="true">
        <path d="M11.992 1.966c-.434 0-.87.086-1.28.257L1.779 5.917c-.503.208-.49.908.012 1.116l8.982 3.558a3.266 3.266 0 0 0 2.454 0l8.982-3.558c.503-.196.503-.908.012-1.116l-8.957-3.694a3.255 3.255 0 0 0-1.272-.257zM23.4 8.056a.589.589 0 0 0-.222.045l-10.012 3.877a.612.612 0 0 0-.38.564v8.896a.6.6 0 0 0 .821.552L23.62 18.1a.583.583 0 0 0 .38-.551V8.653a.6.6 0 0 0-.6-.596zM.676 8.095a.644.644 0 0 0-.48.19C.086 8.396 0 8.53 0 8.69v8.355c0 .442.515.737.908.54l6.27-3.006.307-.147 2.969-1.436c.466-.22.43-.908-.061-1.092L.883 8.138a.57.57 0 0 0-.207-.044z" />
      </svg>
    ),
  },
  /** Mixpanel – the arrow-and-dot mark on violet. */
  mixpanel: {
    logo: (
      <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
        <path d="M6.967 9.996h3.053c-.763-.477-1.048-1.145-1.431-2.384L7.443 3.366C6.919 1.458 6.49.551 4.39.551H.004v1.145h.621c1.286 0 1.431.477 1.814 1.908L3.44 7.326c.524 1.814 1.337 2.67 3.53 2.67h-.003Zm7.06 0h3.053c2.194 0 2.956-.86 3.484-2.67l1.001-3.722c.382-1.431.57-1.908 1.814-1.908H24V.551h-4.34c-2.146 0-2.576.86-3.053 2.815l-1.145 4.246c-.384 1.286-.673 1.907-1.435 2.384Zm-4.007 4.008h4.007V9.996H10.02v4.008ZM0 23.449h4.39c2.1 0 2.529-.907 3.053-2.815l1.146-4.246c.383-1.239.668-1.907 1.431-2.384H6.967c-2.194 0-3.007.86-3.531 2.67l-1.001 3.722c-.383 1.431-.524 1.907-1.814 1.907H0v1.146Zm19.65 0h4.343v-1.146h-.622c-1.239 0-1.431-.476-1.814-1.907l-1.001-3.722c-.524-1.814-1.286-2.67-3.483-2.67h-3.046c.762.477 1.041 1.098 1.424 2.384l1.145 4.246c.477 1.955.907 2.815 3.054 2.815Z" />
      </svg>
    ),
    tile: {
      background: "rgb(120, 86, 255)",
      boxShadow: "none",
    },
  },
  /** Make – the three-bar mark on deep purple. */
  make: {
    logo: (
      <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
        <path d="M13.38 3.498c-.27 0-.511.19-.566.465L9.85 18.986a.578.578 0 0 0 .453.678l4.095.826a.58.58 0 0 0 .682-.455l2.963-15.021a.578.578 0 0 0-.453-.678l-4.096-.826a.589.589 0 0 0-.113-.012zm-5.876.098a.576.576 0 0 0-.516.318L.062 17.697a.575.575 0 0 0 .256.774l3.733 1.877a.578.578 0 0 0 .775-.258l6.926-13.781a.577.577 0 0 0-.256-.776L7.762 3.658a.571.571 0 0 0-.258-.062zm11.74.115a.576.576 0 0 0-.576.576v15.426c0 .318.258.578.576.578h4.178a.58.58 0 0 0 .578-.578V4.287a.578.578 0 0 0-.578-.576Z" />
      </svg>
    ),
    tile: {
      background: "rgb(109, 0, 204)",
      boxShadow: "none",
    },
  },
  /** Third mark in the Communication chip: the reference shows it without a name. */
  unlisted: {
    logo: (
      <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
        <path d="M2.363 7.904v.849a3.95 3.95 0 0 1 3.65 2.425c.198.476.3.987.299 1.502h.791c0-1.04.416-2.037 1.157-2.772a3.962 3.962 0 0 1 2.792-1.149V7.91a3.959 3.959 0 0 1-3.65-2.425 3.893 3.893 0 0 1-.299-1.502h-.791c0 1.04-.416 2.037-1.157 2.772a3.96 3.96 0 0 1-2.792 1.149M13.105 2.51H6.312V0h6.793c4.772 0 8.532 3.735 8.532 8.314 0 4.58-3.76 8.314-8.532 8.314H9.156V24H6.312v-9.882h6.793c3.319 0 5.688-2.352 5.688-5.804 0-3.451-2.37-5.804-5.688-5.804" />
      </svg>
    ),
    tile: {
      background: "rgb(253, 221, 53)",
      boxShadow: "none",
    },
  },
};

/*
 * The directory as the reference renders it: fifteen rows, a connected Slack, and two chips that
 * name the apps they hide. The reference caps a chip at three marks while its label counts every
 * hidden app; here the hidden rows are the apps the reference actually ships a mark for.
 */
const DEFAULT_SECTIONS: IntegrationSection[] = [
  {
    id: "popular",
    title: "Popular",
    items: [
      {
        id: "slack",
        name: "Slack",
        description: "Get alerts in your channels and act on them without leaving the conversation.",
        official: true,
        connected: true,
        ...MARKS.slack,
      },
      {
        id: "notion",
        name: "Notion",
        description: "Turn records into pages and keep project docs in sync both ways.",
        official: true,
        ...MARKS.notion,
      },
      {
        id: "linear",
        name: "Linear",
        description: "Create issues from customer feedback and track them to release.",
        official: true,
        ...MARKS.linear,
      },
      {
        id: "figma",
        name: "Figma",
        description: "Preview designs inline and link frames to the work they belong to.",
        official: true,
        ...MARKS.figma,
      },
      {
        id: "github",
        name: "GitHub",
        description: "Link pull requests and see deploy status next to every task.",
        official: true,
        ...MARKS.github,
      },
      {
        id: "hubspot",
        name: "HubSpot",
        description: "Keep contacts, companies and deals matched across both tools.",
        official: true,
        ...MARKS.hubspot,
      },
    ],
    more: {
      label: "Stripe, Zapier and 2 more",
      marks: [MARKS.stripe, MARKS.zapier, MARKS.airtable],
      items: [
        {
          id: "stripe",
          name: "Stripe",
          description: "See payments and invoices next to the customer they belong to.",
          ...MARKS.stripe,
        },
        {
          id: "zapier",
          name: "Zapier",
          description: "Trigger actions across thousands of apps without writing code.",
          ...MARKS.zapier,
        },
        {
          id: "airtable",
          name: "Airtable",
          description: "Keep records in sync with the base your team already runs on.",
          ...MARKS.airtable,
        },
      ],
    },
  },
  {
    id: "google",
    title: "Google",
    items: [
      {
        id: "drive",
        name: "Google Drive",
        description: "Pick files from Drive and preview them without downloading.",
        ...MARKS.drive,
      },
      {
        id: "calendar",
        name: "Google Calendar",
        description: "See upcoming meetings with every contact in one timeline.",
        ...MARKS.calendar,
      },
      {
        id: "analytics",
        name: "Google Analytics",
        description: "Attribute signups to the campaigns and pages that brought them.",
        ...MARKS.analytics,
      },
    ],
  },
  {
    id: "communication",
    title: "Communication",
    items: [
      {
        id: "zoom",
        name: "Zoom",
        description: "Start meetings from any record and save the recording link.",
        ...MARKS.zoom,
      },
      {
        id: "discord",
        name: "Discord",
        description: "Post updates to community channels when something ships.",
        ...MARKS.discord,
      },
      {
        id: "intercom",
        name: "Intercom",
        description: "See conversations next to the customer and reply from one place.",
        ...MARKS.intercom,
      },
      {
        id: "calendly",
        name: "Calendly",
        description: "Log booked meetings and the answers people gave when booking.",
        ...MARKS.calendly,
      },
      {
        id: "typeform",
        name: "Typeform",
        description: "Create records from form answers the moment they come in.",
        ...MARKS.typeform,
      },
      {
        id: "dropbox",
        name: "Dropbox",
        description: "Attach files from Dropbox and keep shared folders linked.",
        ...MARKS.dropbox,
      },
    ],
    more: {
      label: "Mixpanel, Make and 1 more",
      marks: [MARKS.mixpanel, MARKS.make, MARKS.unlisted],
      items: [
        {
          id: "mixpanel",
          name: "Mixpanel",
          description: "See which features customers use before they churn.",
          ...MARKS.mixpanel,
        },
        {
          id: "make",
          name: "Make",
          description: "Automate hand-offs between tools with visual scenarios.",
          ...MARKS.make,
        },
      ],
    },
  },
];

const DEFAULT_PROJECTS = ["Q3 Campaign", "Brand assets", "Hiring", "Research"];

const DEFAULT_USER = { name: "Alex Morgan", initials: "AM" };

const DEFAULT_NEWS: IntegrationNews = {
  kicker: "New in Acme",
  title: "Shared folders",
  action: "Full changelog",
};

const DEFAULT_GUIDE: IntegrationGuide = {
  title: "Getting started",
  percent: 13,
  cheer: "Great start!",
};

/** Width the reference gives the filter field inside the toolbar. */
const SEARCH_WIDTH = 254;

/** Pitch of the guide card at the foot of the sidebar. */
const GUIDE_HEIGHT = 70;

/** The bar keeps its full padding until the list has actually moved. */
const SCROLL_THRESHOLD = 8;
const BAR_COMPACT_PADDING = 14;

/** Copy the chip takes once its extra rows are on screen. */
const SHOW_FEWER = "Show fewer";

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
.ui-as-integrations{width: min(957px, calc(100% - 64px));margin: 0 auto;padding: 40px 0 64px}
.ui-as-integrations__bar{position: sticky;top: 0;z-index: 5;margin: 14px -16px 0;padding: 26px 16px 12px;background: var(--panel)}
.ui-as-integrations__bar::after{content: "";position: absolute;left: 0;right: 0;top: 100%;height: 32px;background: linear-gradient(to bottom, var(--panel), transparent);pointer-events: none}
.ui-as-int-section{margin-top: 38px}
.ui-as-int-section + .ui-as-int-section{margin-top: 46px}
.ui-as-int-section__title{margin: 0;font-size: 15px;line-height: 20px;font-weight: 500;color: var(--ink)}
.ui-as-int-grid{display: grid;grid-template-columns: repeat(2, minmax(0, 1fr));column-gap: 32px;margin-top: 12px}
.ui-as-int-row{display: flex;align-items: center;gap: 12px;height: 58px;margin: 0 -8px;padding: 0 8px;border-radius: 12px;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-int-row:hover{background: var(--subtle)}
.ui-as-int-logo{display: grid;place-items: center;flex: none;width: 30px;height: 30px;border-radius: 8px;background: var(--card);box-shadow: 0 0 0 1px var(--line), var(--shadow)}
.ui-as-int-logo svg{width: 17px;height: 17px}
.ui-as-int-row__text{display: grid;gap: 2px;flex: 1;min-width: 0}
.ui-as-int-row__name{display: flex;align-items: center;gap: 5px;font-size: 14px;line-height: 19px;font-weight: 500;color: var(--ink)}
.ui-as-int-row__badge{display: grid;color: var(--faint)}
.ui-as-int-row__desc{overflow: hidden;font-size: 13px;line-height: 18px;color: var(--muted);white-space: nowrap;text-overflow: ellipsis}
.ui-as-int-add{display: grid;place-items: center;flex: none;width: 28px;height: 28px;border-radius: 8px;background: var(--card);box-shadow: 0 0 0 1px var(--line), var(--shadow);color: var(--text);transition: box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-int-add:hover{box-shadow: 0 0 0 1px var(--line-strong), var(--shadow);color: var(--ink)}
.ui-as-int-add svg{animation: ui-as-pop var(--nm-dur-3, 240ms) var(--ease)}
.ui-as-int-add[data-state="on"]{background: var(--ink);box-shadow: none;color: var(--on-ink)}
.ui-as-int-add[data-state="on"]:hover{background: var(--ink-hover);color: var(--on-ink)}
.ui-as-spinner{width: 14px;height: 14px;border: 2px solid var(--line);border-top-color: var(--ink);border-radius: 50%;animation: ui-as-spin var(--nm-dur-5, 620ms) linear infinite}
@keyframes ui-as-spin{to{transform: rotate(360deg)}
}
.ui-as-int-empty{margin-top: 24px}
.ui-as-request{width: 260px;padding: 14px}
.ui-as-request form{display: grid;gap: 6px}
.ui-as-request b{font-size: 13.5px;font-weight: 500;color: var(--ink)}
.ui-as-request span{font-size: 12.5px;color: var(--muted)}
.ui-as-request input{height: 34px;margin: 6px 0 4px;padding: 0 10px;border: 0;border-radius: 9px;background: var(--card);box-shadow: 0 0 0 1px var(--line);font: inherit;font-size: 13px;color: var(--ink);outline: none}
.ui-as-request input:focus{box-shadow: 0 0 0 1px var(--line-strong), 0 0 0 3px rgba(11, 9, 8, 0.04)}
.ui-as-int-more{display: inline-flex;align-items: center;gap: 10px;margin-top: 8px;padding: 4px 8px 4px 4px;border-radius: 10px;font-size: 13.5px;color: var(--text);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-int-more:hover{background: var(--chip)}
.ui-as-int-more > svg{color: var(--faint)}
.ui-as-int-more__logos{display: flex;padding: 3px;border-radius: 9px;background: var(--card);box-shadow: 0 0 0 1px var(--line), var(--shadow)}
.ui-as-int-more__logos .ui-as-int-logo{width: 20px;height: 20px;border-radius: 6px;box-shadow: 0 0 0 1px var(--line)}
.ui-as-int-more__logos .ui-as-int-logo + .ui-as-int-logo{margin-left: 3px}
.ui-as-int-more__logos .ui-as-int-logo svg{width: 12px;height: 12px}
@container ui-as-main (max-width: 760px){.ui-as-int-grid{grid-template-columns: minmax(0, 1fr)}
}
@container ui-as (max-width: 900px){.ui-as-integrations{width: calc(100% - 48px)}
}
@container ui-as (max-width: 600px){.ui-as-integrations{width: calc(100% - 32px);padding: 52px 0 48px}
.ui-as-integrations__bar{margin: 8px -12px 0;padding: 18px 12px 10px}
.ui-as-int-section{margin-top: 30px}
.ui-as-int-section + .ui-as-int-section{margin-top: 36px}
.ui-as-int-more{flex-wrap: wrap;text-align: left}
.ui-as-integrations__bar .ui-as-toolbar__right{display: contents}
.ui-as-integrations__bar .ui-as-anchor{margin-left: auto}
}

`;
