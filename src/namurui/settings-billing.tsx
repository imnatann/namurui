"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

/*
 * Settings & Billing – the workspace settings screen inside the app shell, in one file.
 *
 * Four tabs share the shell: General keeps every edit behind a save bar that only appears once
 * something changed, Members lists seats and pending invites, Billing holds the plan, usage
 * meters, payment method, plan comparison and invoice table, and API keys lets a key be created,
 * revealed and revoked. The tab strip follows the arrow keys and slides its pill to whichever tab
 * is open; the billing period is a segmented control that glides the same way. Usage is a meter
 * you can read by hovering a category or arrowing through the days. The styles are injected below,
 * so no extra files are needed.
 */

export type SettingsTab = "General" | "Members" | "Billing" | "API keys";

export type MemberRole = "Owner" | "Admin" | "Member" | "Viewer";

export type MemberStatus = "Active" | "Away" | "Invited";

export type BillingPeriod = "monthly" | "yearly";

export type SettingsMember = {
  /** Stable id used as the React key */
  id: string;
  /** Full name shown in the row */
  name: string;
  /** Address shown under the name */
  email: string;
  /** What this person may do in the workspace */
  role: MemberRole;
  /** Presence, shown as a pill */
  status: MemberStatus;
  /** Overrides the initials derived from the name */
  initials?: string;
  /** Avatar tint from the stylesheet palette */
  tone?: 0 | 1 | 2 | 3;
};

export type SettingsInvite = {
  /** Stable id used as the React key */
  id: string;
  /** Address the invite went to */
  email: string;
  /** Role they were invited with */
  role: MemberRole;
  /** Human date the invite went out */
  sent: string;
};

export type ApiKey = {
  /** Stable id used as the React key */
  id: string;
  /** Label the key is filed under */
  name: string;
  /** The secret itself; shown masked until revealed */
  secret: string;
  /** Scopes, already joined for display */
  scopes: string;
  /** Human creation date */
  created: string;
  /** Human last-use stamp */
  lastUsed: string;
};

export type Invoice = {
  /** Invoice number, e.g. INV-2026-0412 */
  id: string;
  /** Issue date */
  date: string;
  /** Amount as printed, e.g. $49.00 */
  amount: string;
  /** Payment state; drives the pill tone */
  status: "Paid" | "Due" | "Refunded";
};

export type UsageCategory = {
  /** Segment label in the legend */
  label: string;
  /** Credits consumed this period */
  credits: number;
};

export type UsageLimit = {
  /** Limit name, e.g. Seats */
  label: string;
  /** Amount consumed */
  value: number;
  /** Ceiling */
  max: number;
  /** Unit printed after the ceiling, e.g. GB */
  unit?: string;
  /** Overrides the state derived from the ratio */
  state?: "ok" | "warn" | "limit";
};

export type UsageSummary = {
  /** Plan the period belongs to */
  plan: string;
  /** Credits consumed */
  used: number;
  /** Credits included */
  total: number;
  /** ISO timestamp of the reset, used by <time> */
  resetsAt: string;
  /** Relative reset copy, e.g. "Resets in 19 days" */
  resetsLabel: string;
  /** Title shown on hover over the reset time */
  resetsTitle?: string;
  /** Breakdown of the credits, in legend order */
  categories: UsageCategory[];
  /** Credits per day, oldest first */
  daily: number[];
  /** Days still to come, drawn as stubs */
  futureDays?: number;
  /** Average shown above the sparkline */
  dailyAverage: number;
  /** Plan limits under the sparkline */
  limits: UsageLimit[];
  /** Footer call to action */
  action?: string;
  /** Overall meter state; derived from the ratio when omitted */
  state?: "ok" | "warn" | "limit";
};

export type PlanTier = {
  /** Stable id used as the React key */
  id: string;
  /** Plan name */
  name: string;
  /** Monthly price in dollars */
  price: number;
  /** One line about who it is for */
  blurb: string;
  /** Bullets under the price */
  features: string[];
  /** Marks the plan the workspace is on */
  current?: boolean;
};

export type PaymentDetails = {
  /** Network mark in the card tile, e.g. VISA */
  brand: string;
  /** Masked card number as printed */
  card: string;
  /** Expiry as printed */
  expires: string;
  /** Address invoices go to */
  email: string;
};

export type WorkspaceDraft = {
  /** Workspace name */
  name: string;
  /** URL slug */
  url: string;
  /** Default timezone for reports and resets */
  timezone: string;
  /** Default model for new agents */
  model: string;
  /** How long transcripts are kept */
  retention: string;
};

export type SettingsBillingScreenProps = {
  /** Tab shown first; Billing mirrors the reference capture */
  defaultTab?: SettingsTab;
  /** Controlled tab */
  tab?: SettingsTab;
  /** Called when a tab is chosen, by click or arrow key */
  onTabChange?: (tab: SettingsTab) => void;
  /** Workspace name in the header and on invites */
  workspace?: string;
  /** Workspaces offered in the switcher */
  workspaces?: string[];
  /** Called when another workspace is picked */
  onWorkspaceChange?: (workspace: string) => void;
  /** Sidebar menu; omit for the standard five entries */
  nav?: { label: string; icon?: ReactNode }[];
  /** Label of the menu item that is open */
  active?: string;
  /** Called with the label of a menu item or project */
  onNavigate?: (label: string) => void;
  /** Projects listed under the menu */
  projects?: string[];
  /** Account at the bottom of the sidebar */
  user?: { name: string; avatar?: string };
  /** Controlled sidebar collapse */
  collapsed?: boolean;
  /** Called when the sidebar is collapsed or restored */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Seats included in the plan */
  seatLimit?: number;
  /** Rows in the members list */
  members?: SettingsMember[];
  /** Invites that have not been accepted yet */
  invites?: SettingsInvite[];
  /** Rows in the API keys list */
  apiKeys?: ApiKey[];
  /** Rows in the invoice table */
  invoices?: Invoice[];
  /** Plan, meters, limits and the footer call to action */
  usage?: UsageSummary;
  /** Plans shown in the comparison */
  plans?: PlanTier[];
  /** Billing period shown first */
  defaultPeriod?: BillingPeriod;
  /** Payment method and invoice address */
  payment?: PaymentDetails;
  /** Date the current plan renews */
  renewsOn?: string;
  /** Called after the General form is saved */
  onSave?: (values: WorkspaceDraft) => void;
  /** Called when an invite is sent */
  onInvite?: (invite: { email: string; role: MemberRole }) => void;
  /** Called when a key is created */
  onCreateKey?: (name: string) => void;
  /** Called when a key is revoked */
  onRevokeKey?: (id: string) => void;
  /** Called with any billing action: change-plan, cancel-plan, switch-plan, upgrade, download */
  onAction?: (action: string, detail?: string) => void;
  /** Extra class on the root */
  className?: string;
};

/* ---------- Defaults ---------- */

const TABS: SettingsTab[] = ["General", "Members", "Billing", "API keys"];

const NAV: { label: string }[] = [
  { label: "New chat" },
  { label: "Chat" },
  { label: "Folders" },
  { label: "Integrations" },
  { label: "Analytics" },
  { label: "Settings" },
];

const PROJECTS = ["Q3 Campaign", "Brand assets", "Hiring", "Research"];

const WORKSPACES = ["Acme", "Northwind", "Fieldnotes"];

const MEMBERS: SettingsMember[] = [
  { id: "m1", name: "Alex Morgan", email: "alex@acme.com", role: "Owner", status: "Active", tone: 0 },
  { id: "m2", name: "Jordan Silva", email: "jordan@acme.com", role: "Admin", status: "Active", tone: 1 },
  { id: "m3", name: "Riley Kim", email: "riley@acme.com", role: "Member", status: "Active", tone: 2 },
  { id: "m4", name: "Priya Nair", email: "priya@acme.com", role: "Member", status: "Away", tone: 3 },
  { id: "m5", name: "Sam Okafor", email: "sam@acme.com", role: "Viewer", status: "Active", tone: 1 },
  { id: "m6", name: "Dana Weber", email: "dana@acme.com", role: "Member", status: "Away", tone: 2 },
];

const INVITES: SettingsInvite[] = [
  { id: "i1", email: "noah@acme.com", role: "Member", sent: "2 days ago" },
  { id: "i2", email: "lea@acme.com", role: "Viewer", sent: "6 days ago" },
];

const API_KEYS: ApiKey[] = [
  {
    id: "k1",
    name: "Production",
    secret: "sk_live_4f2a9c1d8e7b",
    scopes: "agents:write · files:read",
    created: "Mar 12, 2026",
    lastUsed: "4m ago",
  },
  {
    id: "k2",
    name: "Staging",
    secret: "sk_test_91cd44be02af",
    scopes: "agents:write",
    created: "Jun 3, 2026",
    lastUsed: "2h ago",
  },
  {
    id: "k3",
    name: "Analytics read-only",
    secret: "sk_live_77be51a03cc9",
    scopes: "usage:read",
    created: "Aug 19, 2026",
    lastUsed: "12d ago",
  },
];

const INVOICES: Invoice[] = [
  { id: "INV-2026-0412", date: "Oct 12, 2026", amount: "$49.00", status: "Due" },
  { id: "INV-2026-0371", date: "Sep 12, 2026", amount: "$49.00", status: "Paid" },
  { id: "INV-2026-0329", date: "Aug 12, 2026", amount: "$69.00", status: "Paid" },
  { id: "INV-2026-0288", date: "Jul 12, 2026", amount: "$49.00", status: "Paid" },
  { id: "INV-2026-0240", date: "Jun 12, 2026", amount: "$49.00", status: "Paid" },
];

const USAGE: UsageSummary = {
  plan: "Pro",
  used: 34000,
  total: 50000,
  resetsAt: "2026-11-11T17:00:00.000Z",
  resetsLabel: "Resets in 19\u00a0days",
  resetsTitle: "Resets on Nov 12",
  categories: [
    { label: "Chat", credits: 18400 },
    { label: "Agents", credits: 9200 },
    { label: "API", credits: 4100 },
    { label: "Images", credits: 2300 },
  ],
  daily: [2066, 3595, 3019, 3368, 3751, 2847, 4107, 3184, 4036, 4029],
  futureDays: 20,
  dailyAverage: 1481,
  limits: [
    { label: "Seats", value: 8, max: 10, state: "warn" },
    { label: "Storage", value: 42.6, max: 100, unit: "GB" },
  ],
  action: "Upgrade",
  state: "ok",
};

const PLANS: PlanTier[] = [
  {
    id: "starter",
    name: "Starter",
    price: 19,
    blurb: "For individuals trying things out",
    features: ["10,000 credits / month", "3 seats", "10 GB storage"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    blurb: "For small teams shipping every day",
    features: ["50,000 credits / month", "10 seats", "100 GB storage", "Agents and API access"],
    current: true,
  },
  {
    id: "team",
    name: "Team",
    price: 99,
    blurb: "For growing teams with more seats",
    features: ["150,000 credits / month", "25 seats", "1 TB storage", "SSO and audit log"],
  },
];

const PAYMENT: PaymentDetails = {
  brand: "VISA",
  card: "Visa •••• 4242",
  expires: "Expires 08/2028",
  email: "billing@acme.com",
};

const DRAFT: WorkspaceDraft = {
  name: "Acme",
  url: "acme",
  timezone: "Europe/Berlin",
  model: "Sonnet 4.5",
  retention: "12 months",
};

/* ---------- Helpers ---------- */

const count = new Intl.NumberFormat("en-US");

const quantity = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function percentOf(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0;
}

function limitState(value: number, max: number): "ok" | "warn" | "limit" {
  const ratio = percentOf(value, max);
  if (ratio >= 100) return "limit";
  if (ratio >= 75) return "warn";
  return "ok";
}

function meterState(ratio: number): "ok" | "warn" | "limit" {
  if (ratio >= 90) return "limit";
  if (ratio >= 75) return "warn";
  return "ok";
}

function maskSecret(secret: string): string {
  const head = secret.slice(0, secret.indexOf("_", 3) + 1);
  return `${head}••••••••${secret.slice(-4)}`;
}

function priceFor(tier: PlanTier, period: BillingPeriod): number {
  return period === "yearly" ? Math.round(tier.price * 0.8) : tier.price;
}

/* ---------- Shared bits ---------- */

type ButtonVariant = "primary" | "secondary" | "ghost";

function Button({
  label,
  variant = "secondary",
  icon,
  disabled,
  type = "button",
  danger,
  onClick,
}: {
  label: string;
  variant?: ButtonVariant;
  icon?: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      className={["ui-button", danger ? "ui-sb-danger" : null].filter(Boolean).join(" ")}
      data-variant={variant}
      data-size="sm"
      data-ready="true"
      disabled={disabled}
      onClick={onClick}
    >
      {icon ? (
        <span className="ui-button__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="ui-button__label" data-text={label}>
        {label}
      </span>
    </button>
  );
}

function SectionHead({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children?: ReactNode;
}) {
  return (
    <div className="ui-sb-section__head">
      <div>
        <h2 className="ui-sb-h2">{title}</h2>
        {note ? <p className="ui-sb-muted">{note}</p> : null}
      </div>
      {children}
    </div>
  );
}

/* ---------- Screen ---------- */

export function SettingsBillingScreen({
  defaultTab = "Billing",
  tab,
  onTabChange,
  workspace = "Acme",
  workspaces = WORKSPACES,
  onWorkspaceChange,
  nav = NAV,
  active = "Settings",
  onNavigate,
  projects = PROJECTS,
  user = { name: "Alex Morgan" },
  collapsed,
  onCollapsedChange,
  seatLimit = 10,
  members = MEMBERS,
  invites = INVITES,
  apiKeys = API_KEYS,
  invoices = INVOICES,
  usage = USAGE,
  plans = PLANS,
  defaultPeriod = "monthly",
  payment = PAYMENT,
  renewsOn = "Nov 12, 2026",
  onSave,
  onInvite,
  onCreateKey,
  onRevokeKey,
  onAction,
  className,
}: SettingsBillingScreenProps) {
  const [selfTab, setSelfTab] = useState<SettingsTab>(defaultTab);
  const currentTab = tab ?? selfTab;

  const [selfCollapsed, setSelfCollapsed] = useState(false);
  const isCollapsed = collapsed ?? selfCollapsed;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isDrawer, setIsDrawer] = useState(false);
  const [workspaceMenu, setWorkspaceMenu] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [newsOpen, setNewsOpen] = useState(true);

  const rootRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = useState({ x: 0, width: 0 });

  const selectTab = (next: SettingsTab) => {
    if (tab === undefined) setSelfTab(next);
    onTabChange?.(next);
  };

  const setCollapsed = (next: boolean) => {
    if (collapsed === undefined) setSelfCollapsed(next);
    onCollapsedChange?.(next);
  };

  /* The shell turns into a drawer once its container is narrow enough. */
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setIsDrawer(el.getBoundingClientRect().width <= 900);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* Slide the tab pill to the open tab, and keep it there when the strip resizes. */
  useLayoutEffect(() => {
    const strip = tabsRef.current;
    if (!strip) return;
    const place = () => {
      const index = TABS.indexOf(currentTab);
      const el = tabRefs.current[index];
      if (!el) return;
      setPill({ x: el.offsetLeft, width: el.offsetWidth });
    };
    place();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(place);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [currentTab]);

  useEffect(() => {
    if (!workspaceMenu && !userMenu) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".ui-as-anchor")) return;
      setWorkspaceMenu(false);
      setUserMenu(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [workspaceMenu, userMenu]);

  const onTabKeys = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const index = TABS.indexOf(currentTab);
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    if (next < 0) return;
    event.preventDefault();
    selectTab(TABS[next]);
    tabRefs.current[next]?.focus();
  };

  const navigate = (label: string) => {
    onNavigate?.(label);
    setDrawerOpen(false);
  };

  const rootClass = ["ui-as ui-as-app", className].filter(Boolean).join(" ");

  return (
    <div
      ref={rootRef}
      className={rootClass}
      data-drawer={drawerOpen && isDrawer ? "" : undefined}
      data-collapsed={isCollapsed && !isDrawer ? "" : undefined}
    >
      {/* React 19 hoists this into <head> once, no matter how many screens render */}
      <style href="ui-settings-billing" precedence="default">
        {css}
      </style>

      <button
        className="ui-as-icon-btn ui-as-side-open"
        type="button"
        aria-label="Open sidebar"
        tabIndex={isDrawer ? 0 : -1}
        onClick={() => setDrawerOpen(true)}
      >
        <PanelIcon />
      </button>

      <div className="ui-as-scrim" aria-hidden="true" onClick={() => setDrawerOpen(false)} />

      <aside className="ui-as-side">
        <header className="ui-as-side__head">
          <span className="ui-as-anchor">
            <button
              className="ui-as-side__workspace"
              type="button"
              aria-expanded={workspaceMenu}
              onClick={() => setWorkspaceMenu((open) => !open)}
            >
              <span className="ui-as-side__logo">{workspace.charAt(0).toUpperCase()}</span>
              {workspace}
              <ChevronDownIcon />
            </button>
            {workspaceMenu ? (
              <div className="ui-as-popover">
                <div className="ui-as-menu" role="menu" aria-label="Workspaces">
                  <span className="ui-as-menu__title">Workspaces</span>
                  <div className="ui-as-menu__list">
                    {workspaces.map((name) => (
                      <button
                        key={name}
                        type="button"
                        role="menuitemradio"
                        aria-checked={name === workspace}
                        className="ui-as-menu__item"
                        onClick={() => {
                          setWorkspaceMenu(false);
                          onWorkspaceChange?.(name);
                        }}
                      >
                        <span className="ui-as-menu__label">{name}</span>
                        {name === workspace ? <CheckIcon /> : null}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </span>
          <span className="ui-as-side__tools">
            <button className="ui-as-icon-btn" type="button" aria-label="Search">
              <SearchIcon />
            </button>
            <button
              className="ui-as-icon-btn"
              type="button"
              aria-label="Collapse sidebar"
              onClick={() => setCollapsed(!isCollapsed)}
            >
              <PanelIcon />
            </button>
          </span>
        </header>

        <nav className="ui-as-side__nav" aria-label="Main menu">
          <div className="ui-as-side__group">
            {nav.map((item) => (
              <button
                key={item.label}
                type="button"
                className="ui-as-side__item"
                aria-current={item.label === active ? "page" : undefined}
                onClick={() => navigate(item.label)}
              >
                {item.icon ?? <NavIcon label={item.label} />}
                {item.label}
              </button>
            ))}
          </div>
          <span className="ui-as-side__label">Projects</span>
          {projects.map((project) => (
            <button
              key={project}
              type="button"
              className="ui-as-side__item"
              aria-current={project === active ? "page" : undefined}
              onClick={() => navigate(project)}
            >
              <ProjectIcon />
              {project}
            </button>
          ))}
        </nav>

        <div className="ui-as-side__foot">
          {newsOpen ? (
            <div className="ui-as-news" data-count="2">
              <div className="ui-as-news__card ui-as-news__card--back" aria-hidden="true">
                <span className="ui-as-news__kicker">New in {workspace}</span>
                <CloseIcon />
              </div>
              <div className="ui-as-news__card">
                <div className="ui-as-news__top">
                  <span className="ui-as-news__kicker">New in {workspace}</span>
                  <button
                    type="button"
                    className="ui-as-news__close"
                    aria-label="Dismiss"
                    onClick={() => setNewsOpen(false)}
                  >
                    <CloseIcon />
                  </button>
                </div>
                <b className="ui-as-news__title">Shared folders</b>
                <button type="button" className="ui-as-news__more" onClick={() => navigate("Full changelog")}>
                  Full changelog
                  <ChevronRightIcon />
                </button>
              </div>
            </div>
          ) : null}

          <div className="ui-as-guide-slot" style={{ height: 70 }}>
            <div className="ui-as-guide" data-state="closed" style={{ height: 70 }}>
              <div className="ui-as-guide__inner">
                <button
                  type="button"
                  className="ui-as-steps ui-as-guide__content"
                  aria-expanded={false}
                  onClick={() => navigate("Getting started")}
                >
                  <span className="ui-as-steps__title">
                    Getting started
                    <ChevronRightIcon />
                  </span>
                  <span className="ui-as-steps__sub">
                    13% done ·
                    <span className="ui-as-steps__cheer">Great start!</span>
                  </span>
                  <span className="ui-as-steps__bar">
                    <i style={{ width: "13%" }} />
                  </span>
                </button>
              </div>
            </div>
          </div>

          <span className="ui-as-anchor ui-as-user-menu">
            <button
              type="button"
              className="ui-as-user"
              aria-expanded={userMenu}
              onClick={() => setUserMenu((open) => !open)}
            >
              {user.avatar ? (
                <img src={user.avatar} alt="" />
              ) : (
                <span className="ui-as-user__initials">{initialsOf(user.name)}</span>
              )}
              {user.name}
              <ChevronDownIcon />
            </button>
            {userMenu ? (
              <div className="ui-as-popover" data-side="top" data-align="end">
                <div className="ui-as-menu" role="menu" aria-label="Account">
                  <span className="ui-as-menu__title">{user.name}</span>
                  <div className="ui-as-menu__list">
                    <button
                      type="button"
                      role="menuitem"
                      className="ui-as-menu__item"
                      onClick={() => {
                        setUserMenu(false);
                        navigate("Account settings");
                      }}
                    >
                      Account settings
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="ui-as-menu__item"
                      onClick={() => {
                        setUserMenu(false);
                        selectTab("Billing");
                      }}
                    >
                      Billing
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="ui-as-menu__item"
                      data-danger=""
                      onClick={() => {
                        setUserMenu(false);
                        navigate("Sign out");
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </span>
        </div>
      </aside>

      <main className="ui-as-main">
        <div className="ui-sb">
          <h1 className="ui-as-page-title">Settings</h1>
          <p className="ui-as-page-sub">
            Manage your workspace, your team, your plan and access to the API.
          </p>

          <div className="ui-as-toolbar ui-sb__bar">
            <div className="ui-as-tabs" role="tablist" ref={tabsRef} onKeyDown={onTabKeys}>
              <span
                className="ui-as-tabs__pill"
                aria-hidden="true"
                style={{ transform: `translateX(${pill.x}px)`, width: pill.width }}
              />
              {TABS.map((item, index) => (
                <button
                  key={item}
                  ref={(el) => {
                    tabRefs.current[index] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={currentTab === item}
                  className="ui-as-tabs__tab"
                  onClick={() => selectTab(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="ui-sb__body">
            {currentTab === "General" ? (
              <GeneralPanel workspace={workspace} onSave={onSave} onAction={onAction} />
            ) : null}
            {currentTab === "Members" ? (
              <MembersPanel
                workspace={workspace}
                seatLimit={seatLimit}
                members={members}
                invites={invites}
                onInvite={onInvite}
                onAction={onAction}
              />
            ) : null}
            {currentTab === "Billing" ? (
              <BillingPanel
                usage={usage}
                plans={plans}
                invoices={invoices}
                payment={payment}
                renewsOn={renewsOn}
                defaultPeriod={defaultPeriod}
                onAction={onAction}
              />
            ) : null}
            {currentTab === "API keys" ? (
              <ApiKeysPanel
                workspace={workspace}
                apiKeys={apiKeys}
                onCreateKey={onCreateKey}
                onRevokeKey={onRevokeKey}
                onAction={onAction}
              />
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ---------- General ---------- */

function GeneralPanel({
  workspace,
  onSave,
  onAction,
}: {
  workspace: string;
  onSave?: (values: WorkspaceDraft) => void;
  onAction?: (action: string, detail?: string) => void;
}) {
  const uid = useId();
  const [form, setForm] = useState<WorkspaceDraft>({
    ...DRAFT,
    name: workspace,
    url: slugify(workspace),
  });
  const [saved, setSaved] = useState<WorkspaceDraft>(form);
  const [copied, setCopied] = useState(false);

  const dirty =
    form.name !== saved.name ||
    form.url !== saved.url ||
    form.timezone !== saved.timezone ||
    form.model !== saved.model ||
    form.retention !== saved.retention;

  const set = <K extends keyof WorkspaceDraft>(key: K, value: WorkspaceDraft[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = () => {
    setSaved(form);
    onSave?.(form);
  };

  const copyId = async () => {
    try {
      await navigator.clipboard?.writeText("ws_8f24c1d0a7");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <section className="ui-sb-section ui-sb-section--first">
        <SectionHead
          title="Workspace"
          note="Shown on invites, shared links and every agent handoff."
        />
        <div className="ui-sb-tray">
          <div className="ui-sb-card ui-sb-form">
            <div className="ui-sb-form__fields">
              <div className="ui-sb-field">
                <span className="ui-sb-field__label">
                  <b>Workspace logo</b>
                  <span>PNG or SVG, at least 256 × 256px.</span>
                </span>
                <div className="ui-sb-logo-row">
                  <span className="ui-sb-logo" aria-hidden="true">
                    {form.name.charAt(0).toUpperCase()}
                  </span>
                  <Button
                    label="Upload"
                    variant="secondary"
                    onClick={() => onAction?.("upload-logo")}
                  />
                  <Button
                    label="Remove"
                    variant="ghost"
                    onClick={() => onAction?.("remove-logo")}
                  />
                </div>
              </div>

              <div className="ui-sb-field">
                <label className="ui-sb-field__label" htmlFor={`${uid}-name`}>
                  <b>Workspace name</b>
                  <span>Appears in the sidebar and on every invite.</span>
                </label>
                <input
                  id={`${uid}-name`}
                  className="ui-sb-input"
                  value={form.name}
                  onChange={(event) => set("name", event.target.value)}
                  autoComplete="organization"
                />
              </div>

              <div className="ui-sb-field">
                <label className="ui-sb-field__label" htmlFor={`${uid}-url`}>
                  <b>Workspace URL</b>
                  <span>Old links keep working for 30 days.</span>
                </label>
                <input
                  id={`${uid}-url`}
                  className="ui-sb-input"
                  value={form.url}
                  onChange={(event) => set("url", slugify(event.target.value))}
                  autoComplete="off"
                />
              </div>

              <div className="ui-sb-field">
                <label className="ui-sb-field__label" htmlFor={`${uid}-zone`}>
                  <b>Timezone</b>
                  <span>Resets and reports use this clock.</span>
                </label>
                <select
                  id={`${uid}-zone`}
                  className="ui-sb-input"
                  value={form.timezone}
                  onChange={(event) => set("timezone", event.target.value)}
                >
                  <option value="Europe/Berlin">Europe/Berlin</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="America/Los_Angeles">America/Los_Angeles</option>
                  <option value="Asia/Tokyo">Asia/Tokyo</option>
                </select>
              </div>

              <div className="ui-sb-field">
                <span className="ui-sb-field__label">
                  <b>Workspace ID</b>
                  <span>Read-only – quote it when you contact support.</span>
                </span>
                <div className="ui-sb-inline">
                  <input
                    className="ui-sb-input"
                    value="ws_8f24c1d0a7"
                    readOnly
                    aria-label="Workspace ID"
                  />
                  <button
                    type="button"
                    className="ui-as-tool"
                    aria-label="Copy workspace ID"
                    title="Copy workspace ID"
                    onClick={copyId}
                  >
                    {copied ? <CheckIcon /> : <CopyIcon />}
                  </button>
                </div>
              </div>
            </div>

            {dirty ? (
              <div className="ui-sb-form__foot">
                <Button label="Discard" variant="ghost" onClick={() => setForm(saved)} />
                <Button label="Save changes" variant="primary" onClick={save} />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="ui-sb-section">
        <SectionHead title="Defaults" note="Every new agent starts here; each one can override it." />
        <div className="ui-sb-tray">
          <div className="ui-sb-card ui-sb-form">
            <div className="ui-sb-form__fields">
              <div className="ui-sb-field">
                <label className="ui-sb-field__label" htmlFor={`${uid}-model`}>
                  <b>Default model</b>
                  <span>Used until an agent picks something else.</span>
                </label>
                <select
                  id={`${uid}-model`}
                  className="ui-sb-input"
                  value={form.model}
                  onChange={(event) => set("model", event.target.value)}
                >
                  <option value="Sonnet 4.5">Sonnet 4.5</option>
                  <option value="Opus 4.1">Opus 4.1</option>
                  <option value="Haiku 4">Haiku 4</option>
                  <option value="GPT-5">GPT-5</option>
                </select>
              </div>

              <div className="ui-sb-field">
                <label className="ui-sb-field__label" htmlFor={`${uid}-retention`}>
                  <b>History retention</b>
                  <span>Transcripts are deleted after this window.</span>
                </label>
                <select
                  id={`${uid}-retention`}
                  className="ui-sb-input"
                  value={form.retention}
                  onChange={(event) => set("retention", event.target.value)}
                >
                  <option value="30 days">30 days</option>
                  <option value="6 months">6 months</option>
                  <option value="12 months">12 months</option>
                  <option value="Forever">Forever</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ui-sb-section">
        <SectionHead title="Danger zone" note="These actions affect everyone in the workspace." />
        <div className="ui-sb-tray">
          <div className="ui-sb-card ui-sb-list">
            <div className="ui-sb-row">
              <span className="ui-sb-row__text">
                <b>Delete workspace</b>
                <span>Removes every file, agent and transcript. This cannot be undone.</span>
              </span>
              <Button
                label="Delete workspace"
                variant="ghost"
                danger
                onClick={() => onAction?.("delete-workspace", form.name)}
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ---------- Members ---------- */

function MembersPanel({
  workspace,
  seatLimit,
  members,
  invites,
  onInvite,
  onAction,
}: {
  workspace: string;
  seatLimit: number;
  members: SettingsMember[];
  invites: SettingsInvite[];
  onInvite?: (invite: { email: string; role: MemberRole }) => void;
  onAction?: (action: string, detail?: string) => void;
}) {
  const [rows, setRows] = useState(members);
  const [pending, setPending] = useState(invites);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("Member");

  const send = () => {
    const address = email.trim();
    if (!address) return;
    setPending((current) => [
      ...current,
      { id: `i${current.length + 1}`, email: address, role, sent: "Just now" },
    ]);
    setEmail("");
    setOpen(false);
    onInvite?.({ email: address, role });
  };

  return (
    <>
      <section className="ui-sb-section ui-sb-section--first">
        <SectionHead
          title="Members"
          note={`${rows.length} of ${seatLimit} seats used · ${pending.length} invites pending`}
        >
          <span className="ui-as-anchor">
            <Button
              label="Invite member"
              variant="primary"
              onClick={() => setOpen((value) => !value)}
            />
            {open ? (
              <div className="ui-as-popover" data-align="end">
                <div className="ui-sb-card ui-sb-invite">
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      send();
                    }}
                  >
                    <b>Invite to {workspace}</b>
                    <span>They get an email with a link to join.</span>
                    <input
                      className="ui-sb-input"
                      type="email"
                      required
                      placeholder="name@company.com"
                      aria-label="Email address"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                    <select
                      className="ui-sb-input"
                      aria-label="Role"
                      value={role}
                      onChange={(event) => setRole(event.target.value as MemberRole)}
                    >
                      <option value="Admin">Admin</option>
                      <option value="Member">Member</option>
                      <option value="Viewer">Viewer</option>
                    </select>
                    <Button label="Send invite" variant="primary" type="submit" />
                  </form>
                </div>
              </div>
            ) : null}
          </span>
        </SectionHead>

        <div className="ui-sb-tray">
          <div className="ui-sb-tray__head">
            <span>Member</span>
            <span className="ui-sb-tray__end">Role</span>
          </div>
          <div className="ui-sb-card ui-sb-list">
            {rows.map((member) => (
              <div className="ui-sb-row" key={member.id}>
                <span
                  className="ui-sb-avatar"
                  data-tone={member.tone ? member.tone : undefined}
                  aria-hidden="true"
                >
                  {member.initials ?? initialsOf(member.name)}
                </span>
                <span className="ui-sb-row__text">
                  <b>{member.name}</b>
                  <span>{member.email}</span>
                </span>
                <span className="ui-sb-role">{member.role}</span>
                <span
                  className="ui-sb-pill"
                  data-tone={
                    member.status === "Active" ? "green" : member.status === "Invited" ? "amber" : undefined
                  }
                >
                  {member.status}
                </span>
                <button
                  type="button"
                  className="ui-as-tool ui-sb-danger"
                  aria-label={`Remove ${member.name}`}
                  title={`Remove ${member.name}`}
                  onClick={() => {
                    setRows((current) => current.filter((row) => row.id !== member.id));
                    onAction?.("remove-member", member.name);
                  }}
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ui-sb-section">
        <SectionHead title="Pending invites" note="They join as soon as they accept." />
        <div className="ui-sb-tray">
          <div className="ui-sb-card ui-sb-list">
            {pending.length === 0 ? (
              <div className="ui-sb-row">
                <span className="ui-sb-row__text">
                  <b>No invites waiting</b>
                  <span>Everyone you asked has already answered.</span>
                </span>
              </div>
            ) : (
              pending.map((invite) => (
                <div className="ui-sb-row" key={invite.id}>
                  <span className="ui-sb-row__spacer" aria-hidden="true" />
                  <span className="ui-sb-row__text">
                    <b>{invite.email}</b>
                    <span>Invited {invite.sent}</span>
                  </span>
                  <span className="ui-sb-role">{invite.role}</span>
                  <span className="ui-sb-pill" data-tone="amber">
                    Invited
                  </span>
                  <button
                    type="button"
                    className="ui-as-tool ui-sb-danger"
                    aria-label={`Cancel invite for ${invite.email}`}
                    title={`Cancel invite for ${invite.email}`}
                    onClick={() => {
                      setPending((current) => current.filter((row) => row.id !== invite.id));
                      onAction?.("cancel-invite", invite.email);
                    }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </>
  );
}

/* ---------- Billing ---------- */

function BillingPanel({
  usage,
  plans,
  invoices,
  payment,
  renewsOn,
  defaultPeriod,
  onAction,
}: {
  usage: UsageSummary;
  plans: PlanTier[];
  invoices: Invoice[];
  payment: PaymentDetails;
  renewsOn: string;
  defaultPeriod: BillingPeriod;
  onAction?: (action: string, detail?: string) => void;
}) {
  const [period, setPeriod] = useState<BillingPeriod>(defaultPeriod);
  const currentTier = plans.find((tier) => tier.current) ?? plans[0];

  return (
    <>
      <div className="ui-sb-overview">
        <div className="ui-sb-usage ui-as-rise" style={{ "--i": 0 } as CSSProperties}>
          <UsageMeter usage={usage} onAction={() => onAction?.("upgrade")} />
        </div>

        <div className="ui-sb-stack">
          <section className="ui-sb-card ui-sb-plan ui-as-rise" style={{ "--i": 1 } as CSSProperties}>
            <div className="ui-sb-plan__top">
              <span className="ui-sb-cap">Current plan</span>
              <span className="ui-sb-pill" data-tone="green">
                Active
              </span>
            </div>
            <strong className="ui-sb-plan__name">
              {currentTier.name}{" "}
              <span>· ${priceFor(currentTier, period)}/mo</span>
            </strong>
            <p className="ui-sb-muted">
              Renews on {renewsOn} · {period === "yearly" ? "billed yearly" : "billed monthly"}
            </p>
            <div className="ui-sb-actions">
              <Button
                label="Change plan"
                variant="primary"
                onClick={() => onAction?.("change-plan")}
              />
              <Button label="Cancel plan" variant="ghost" onClick={() => onAction?.("cancel-plan")} />
            </div>
          </section>

          <section className="ui-sb-card ui-sb-pay ui-as-rise" style={{ "--i": 2 } as CSSProperties}>
            <div className="ui-sb-pay__row">
              <span className="ui-sb-visa" aria-hidden="true">
                {payment.brand}
              </span>
              <span className="ui-sb-pay__text">
                <b>{payment.card}</b>
                <span>{payment.expires}</span>
              </span>
              <Button label="Update" icon={<CardIcon />} onClick={() => onAction?.("update-card")} />
            </div>
            <div className="ui-sb-pay__row">
              <span className="ui-sb-tile" aria-hidden="true">
                <MailIcon />
              </span>
              <span className="ui-sb-pay__text">
                <b>{payment.email}</b>
                <span>Invoices and receipts go here</span>
              </span>
              <Button label="Edit" onClick={() => onAction?.("edit-billing-email")} />
            </div>
          </section>
        </div>
      </div>

      <section className="ui-sb-section">
        <div className="ui-sb-section__head">
          <div>
            <h2 className="ui-sb-h2">Plans</h2>
            <p className="ui-sb-muted">Switch any time – we prorate the difference.</p>
          </div>
          <PeriodSwitch value={period} onChange={setPeriod} />
        </div>

        <div className="ui-sb-plans">
          {plans.map((tier, index) => {
            const current = tier.current === true;
            const label = current ? "Current plan" : `Switch to ${tier.name}`;
            return (
              <div
                key={tier.id}
                className="ui-sb-card ui-sb-tier ui-as-rise"
                data-current={current ? "true" : undefined}
                style={{ "--i": index } as CSSProperties}
              >
                <div className="ui-sb-tier__top">
                  <b>{tier.name}</b>
                  {current ? <span className="ui-sb-pill">Current</span> : null}
                </div>
                <div className="ui-sb-tier__price">
                  <strong key={priceFor(tier, period)}>${priceFor(tier, period)}</strong>
                  <span>/ month</span>
                </div>
                <p className="ui-sb-muted">{tier.blurb}</p>
                <ul className="ui-sb-tier__list">
                  {tier.features.map((feature) => (
                    <li key={feature}>
                      <CheckIcon />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  label={label}
                  variant={current ? "secondary" : "primary"}
                  disabled={current}
                  onClick={() => onAction?.("switch-plan", tier.name)}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="ui-sb-section">
        <div className="ui-sb-section__head">
          <h2 className="ui-sb-h2">Invoices</h2>
          <Button
            label="Download all"
            icon={<DownloadIcon />}
            onClick={() => onAction?.("download-invoices")}
          />
        </div>

        <div className="ui-sb-table-wrap">
          <table className="ui-sb-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice</th>
                <th className="ui-sb-num">Amount</th>
                <th>Status</th>
                <th aria-label="Download" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.date}</td>
                  <td className="ui-sb-mono">{invoice.id}</td>
                  <td className="ui-sb-num">{invoice.amount}</td>
                  <td>
                    <span
                      className="ui-sb-pill"
                      data-tone={
                        invoice.status === "Paid"
                          ? "green"
                          : invoice.status === "Due"
                            ? "amber"
                            : undefined
                      }
                    >
                      {invoice.status}
                    </span>
                  </td>
                  <td className="ui-sb-end">
                    <button
                      type="button"
                      className="ui-as-tool"
                      aria-label={`Download ${invoice.id}`}
                      title={`Download ${invoice.id}`}
                      onClick={() => onAction?.("download-invoice", invoice.id)}
                    >
                      <DownloadIcon size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/* ---------- Usage meter ---------- */

function UsageMeter({ usage, onAction }: { usage: UsageSummary; onAction?: () => void }) {
  const uid = useId();
  const titleId = `${uid}-title`;

  const innerRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLSpanElement>(null);
  const [cardHeight, setCardHeight] = useState<number>();
  const [actionWidth, setActionWidth] = useState<number>();

  const [activeSegment, setActiveSegment] = useState<number | null>(null);
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [live, setLive] = useState("");

  const percent = percentOf(usage.used, usage.total);
  const state = usage.state ?? meterState(percent);
  const remaining = Math.max(0, usage.total - usage.used);
  const maxDaily = Math.max(1, ...usage.daily);
  const futureDays = usage.futureDays ?? 0;
  const segment = activeSegment === null ? null : usage.categories[activeSegment];

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const measure = () => setCardHeight(el.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [usage]);

  useLayoutEffect(() => {
    const el = actionRef.current;
    if (!el) return;
    const measure = () => setActionWidth(el.offsetWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [usage.action]);

  const segmentLeft = (index: number): number => {
    const before = usage.categories
      .slice(0, index)
      .reduce((sum, item) => sum + item.credits, 0);
    const own = usage.categories[index]?.credits ?? 0;
    return percentOf(before + own / 2, usage.total);
  };

  const onBarKeys = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const total = usage.categories.length;
    if (total === 0) return;
    const base = activeSegment ?? 0;
    let next: number;
    if (event.key === "ArrowRight") next = (base + 1) % total;
    else if (event.key === "ArrowLeft") next = (base - 1 + total) % total;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = total - 1;
    else return;
    event.preventDefault();
    setActiveSegment(next);
    const category = usage.categories[next];
    setLive(
      `${category.label}: ${count.format(category.credits)} credits, ${Math.round(
        percentOf(category.credits, usage.used),
      )}% of usage`,
    );
  };

  const onSparkKeys = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const total = usage.daily.length;
    if (total === 0) return;
    const base = activeDay ?? total - 1;
    let next: number;
    if (event.key === "ArrowRight") next = Math.min(total - 1, base + 1);
    else if (event.key === "ArrowLeft") next = Math.max(0, base - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = total - 1;
    else return;
    event.preventDefault();
    setActiveDay(next);
    setLive(`Day ${next + 1}: ${count.format(usage.daily[next])} credits`);
  };

  return (
    <section className="ui-um" aria-labelledby={titleId} data-state={state}>
      <div className="ui-um__card" style={cardHeight ? { height: cardHeight } : undefined}>
        <div className="ui-um__inner" ref={innerRef}>
          <header className="ui-um__head">
            <div className="ui-um__heading">
              <h3 id={titleId} className="ui-um__title">
                Usage this period
              </h3>
              <p className="ui-um__sub">
                {usage.plan} plan<span className="ui-um__sep">·</span>
                <time dateTime={usage.resetsAt} title={usage.resetsTitle}>
                  {usage.resetsLabel}
                </time>
              </p>
            </div>
          </header>

          <div className="ui-um__figure">
            <p className="ui-um__amount">
              <span className="ui-um__big">{count.format(usage.used)}</span>
              <span className="ui-um__of">of {count.format(usage.total)}&nbsp;credits</span>
            </p>
            <span className="ui-um__pct" data-state={state}>
              {state === "ok" ? null : <span className="ui-um__dot" aria-hidden="true" />}
              {Math.round(percent)}%
            </span>
          </div>

          <div
            className="ui-um__bar"
            tabIndex={0}
            role="group"
            aria-label={`${count.format(usage.used)} of ${count.format(
              usage.total,
            )} credits used – arrow keys read each category`}
            data-active={activeSegment === null ? undefined : ""}
            onMouseLeave={() => setActiveSegment(null)}
            onBlur={() => setActiveSegment(null)}
            onKeyDown={onBarKeys}
          >
            <div
              className="ui-um__track"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={usage.total}
              aria-valuenow={usage.used}
              aria-valuetext={`${count.format(usage.used)} of ${count.format(usage.total)} credits`}
            >
              {usage.categories.map((category, index) => (
                <span
                  key={category.label}
                  className="ui-um__seg"
                  data-active={activeSegment === index ? "" : undefined}
                  style={
                    {
                      width: `${percentOf(category.credits, usage.total)}%`,
                      background: `var(--ui-um-c${index + 1})`,
                    } as CSSProperties
                  }
                  onMouseEnter={() => setActiveSegment(index)}
                />
              ))}
            </div>
            <div
              className="ui-um__tip"
              aria-live="polite"
              data-open={activeSegment === null ? undefined : ""}
              style={
                {
                  left: activeSegment === null ? "50%" : `${segmentLeft(activeSegment)}%`,
                  "--ui-um-tip-x": "-50%",
                } as CSSProperties
              }
            >
              {segment ? (
                <>
                  <span className="ui-um__tip-label">
                    <span
                      className="ui-um__swatch"
                      style={{ background: `var(--ui-um-c${(activeSegment ?? 0) + 1})` }}
                    />
                    {segment.label}
                  </span>
                  <span className="ui-um__tip-value">
                    {count.format(segment.credits)}{" "}
                    <span className="ui-um__muted">
                      · {Math.round(percentOf(segment.credits, usage.used))}%
                    </span>
                  </span>
                </>
              ) : null}
            </div>
          </div>

          <ul
            className="ui-um__legend"
            aria-label="By category"
            data-active={activeSegment === null ? undefined : ""}
            onMouseLeave={() => setActiveSegment(null)}
          >
            {usage.categories.map((category, index) => (
              <li className="ui-um__row" key={category.label}>
                <div
                  className="ui-um__item"
                  data-active={activeSegment === index ? "" : undefined}
                  onMouseEnter={() => setActiveSegment(index)}
                >
                  <span
                    className="ui-um__swatch"
                    style={{ background: `var(--ui-um-c${index + 1})` }}
                  />
                  <span className="ui-um__label">{category.label}</span>
                  <span className="ui-um__value">{count.format(category.credits)}</span>
                  <span className="ui-um__share">
                    {Math.round(percentOf(category.credits, usage.used))}%
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="ui-um__daily">
            <div className="ui-um__daily-head">
              <span>Per day</span>
              <span className="ui-um__daily-read">
                Avg <b>{count.format(usage.dailyAverage)}</b> / day
              </span>
            </div>
            <div
              className="ui-um__spark"
              tabIndex={0}
              role="img"
              aria-label={`Usage this period per day, ${count.format(
                usage.dailyAverage,
              )} credits on average – arrow keys read each day`}
              data-hover={activeDay === null ? undefined : ""}
              onMouseLeave={() => setActiveDay(null)}
              onBlur={() => setActiveDay(null)}
              onKeyDown={onSparkKeys}
            >
              {usage.daily.map((credits, index) => (
                <span
                  key={index}
                  className="ui-um__day"
                  data-active={activeDay === index ? "" : undefined}
                  style={{ "--i": index } as CSSProperties}
                  onMouseEnter={() => setActiveDay(index)}
                >
                  <span
                    style={{
                      height:
                        credits >= maxDaily ? "100%" : `${((credits / maxDaily) * 100).toFixed(4)}%`,
                    }}
                  />
                </span>
              ))}
              {Array.from({ length: futureDays }, (_, offset) => (
                <span
                  key={`future-${offset}`}
                  className="ui-um__day"
                  data-future="true"
                  style={{ "--i": usage.daily.length + offset } as CSSProperties}
                >
                  <span />
                </span>
              ))}
            </div>
          </div>

          <ul
            className="ui-um__limits"
            aria-label="Plan limits"
            style={{ "--n": usage.limits.length } as CSSProperties}
          >
            {usage.limits.map((limit) => {
              const tone = limit.state ?? limitState(limit.value, limit.max);
              const unit = limit.unit ? `\u00a0${limit.unit}` : "";
              return (
                <li className="ui-um__limit" key={limit.label} data-state={tone}>
                  <span className="ui-um__limit-label">
                    {limit.label}
                    {tone === "ok" ? null : (
                      <span
                        className="ui-um__dot"
                        aria-label={tone === "limit" ? "At the limit" : "Close to the limit"}
                      />
                    )}
                  </span>
                  <span className="ui-um__limit-value">
                    {quantity.format(limit.value)}
                    <span className="ui-um__muted">
                      of {quantity.format(limit.max)}
                      {unit}
                    </span>
                  </span>
                  <span
                    className="ui-um__thin"
                    role="meter"
                    aria-label={limit.label}
                    aria-valuemin={0}
                    aria-valuemax={limit.max}
                    aria-valuenow={limit.value}
                    aria-valuetext={`${quantity.format(limit.value)} of ${quantity.format(limit.max)}${unit}`}
                  >
                    <span style={{ width: `${percentOf(limit.value, limit.max)}%` }} />
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="ui-um__foot">
        <span className="ui-um__status">
          {state === "ok" ? null : <span className="ui-um__dot" aria-hidden="true" />}
          <span>{count.format(remaining)}&nbsp;credits left</span>
        </span>
        <button
          type="button"
          className="ui-um__action"
          style={actionWidth ? { width: actionWidth } : undefined}
          data-strong={state === "ok" ? undefined : ""}
          onClick={onAction}
        >
          <span className="ui-um__action-inner" ref={actionRef}>
            <span className="ui-um__action-text">{usage.action ?? "Upgrade"}</span>
          </span>
        </button>
      </div>
      <span className="ui-um__live" aria-live="polite">
        {live}
      </span>
    </section>
  );
}

/* ---------- Billing period ---------- */

function PeriodSwitch({
  value,
  onChange,
}: {
  value: BillingPeriod;
  onChange: (value: BillingPeriod) => void;
}) {
  const options: { id: BillingPeriod; label: string; badge?: string }[] = [
    { id: "monthly", label: "Monthly" },
    { id: "yearly", label: "Yearly", badge: "−20%" },
  ];

  const trackRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [widths, setWidths] = useState<number[]>([]);
  const [pill, setPill] = useState({ left: 0, right: 0 });

  useLayoutEffect(() => {
    const measured = optionRefs.current.map((el) =>
      el ? Math.round(el.getBoundingClientRect().width) : 0,
    );
    setWidths(measured);
  }, []);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const index = options.findIndex((option) => option.id === value);
    const el = optionRefs.current[index];
    if (!track || !el) return;
    const right = track.offsetWidth - el.offsetLeft - el.offsetWidth;
    setPill({ left: el.offsetLeft, right: right > 0 ? right : 0 });
  }, [value, widths]);

  const step = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const direction =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (direction === 0) return;
    event.preventDefault();
    const index = options.findIndex((option) => option.id === value);
    const nextIndex = (index + direction + options.length) % options.length;
    onChange(options[nextIndex].id);
    optionRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="ui-seg" data-size="sm" data-variant="tray" data-ready="">
      <div
        className="ui-seg__scroller"
        style={{ "--ui-seg-fade-l": "0px", "--ui-seg-fade-r": "0px" } as CSSProperties}
      >
        <div
          className="ui-seg__track"
          role="radiogroup"
          aria-label="Billing period"
          ref={trackRef}
          onKeyDown={step}
        >
          <span
            className="ui-seg__pill"
            aria-hidden="true"
            data-ready="1"
            style={{ opacity: 1, left: pill.left, right: pill.right }}
          />
          {options.map((option, index) => (
            <button
              key={option.id}
              ref={(el) => {
                optionRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={value === option.id}
              data-active={value === option.id ? "true" : undefined}
              tabIndex={value === option.id ? 0 : -1}
              className="ui-seg__opt"
              style={widths[index] ? { width: widths[index] } : undefined}
              onClick={() => onChange(option.id)}
            >
              <span className="ui-seg__content">
                <span className="ui-seg__label">
                  <span className="ui-seg__text">{option.label}</span>
                  <span className="ui-seg__text ui-seg__text-bold" aria-hidden="true">
                    {option.label}
                  </span>
                </span>
                {option.badge ? <span className="ui-seg__badge">{option.badge}</span> : null}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- API keys ---------- */

function ApiKeysPanel({
  workspace,
  apiKeys,
  onCreateKey,
  onRevokeKey,
  onAction,
}: {
  workspace: string;
  apiKeys: ApiKey[];
  onCreateKey?: (name: string) => void;
  onRevokeKey?: (id: string) => void;
  onAction?: (action: string, detail?: string) => void;
}) {
  const [keys, setKeys] = useState(apiKeys);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const create = () => {
    const label = name.trim() || "Untitled key";
    const suffix = Math.random().toString(16).slice(2, 10);
    const key: ApiKey = {
      id: `k${keys.length + 1}-${suffix.slice(0, 4)}`,
      name: label,
      secret: `sk_live_${suffix}`,
      scopes: "agents:write",
      created: "Today",
      lastUsed: "Never",
    };
    setKeys((current) => [key, ...current]);
    setRevealed((current) => [...current, key.id]);
    setName("");
    setOpen(false);
    onCreateKey?.(label);
  };

  const copy = async (key: ApiKey) => {
    try {
      await navigator.clipboard?.writeText(key.secret);
      setCopied(key.id);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };

  return (
    <section className="ui-sb-section ui-sb-section--first">
      <SectionHead
        title="API keys"
        note="Keys act as you. Revoke anything you don't recognise."
      >
        <span className="ui-as-anchor">
          <Button
            label="Create key"
            variant="primary"
            onClick={() => setOpen((value) => !value)}
          />
          {open ? (
            <div className="ui-as-popover" data-align="end">
              <div className="ui-sb-card ui-sb-invite">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    create();
                  }}
                >
                  <b>New key for {workspace}</b>
                  <span>It can write agents and read files.</span>
                  <input
                    className="ui-sb-input"
                    required
                    placeholder="Key name"
                    aria-label="Key name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                  <Button label="Create key" variant="primary" type="submit" />
                </form>
              </div>
            </div>
          ) : null}
        </span>
      </SectionHead>

      <div className="ui-sb-tray">
        <div className="ui-sb-tray__head">
          <span>Key</span>
          <span className="ui-sb-tray__end ui-sb-tray__end--key">Created</span>
        </div>
        <div className="ui-sb-card ui-sb-list">
          {keys.map((key) => {
            const visible = revealed.includes(key.id);
            return (
              <div className="ui-sb-row" key={key.id}>
                <span className="ui-sb-tile" aria-hidden="true">
                  <KeyIcon />
                </span>
                <span className="ui-sb-row__text">
                  <b>{key.name}</b>
                  <span>
                    {key.scopes} · used {key.lastUsed}
                  </span>
                </span>
                <span className="ui-sb-inline">
                  <code className="ui-sb-key">{visible ? key.secret : maskSecret(key.secret)}</code>
                  <button
                    type="button"
                    className="ui-as-tool"
                    aria-label={`${visible ? "Hide" : "Reveal"} ${key.name} key`}
                    title={`${visible ? "Hide" : "Reveal"} ${key.name} key`}
                    onClick={() =>
                      setRevealed((current) =>
                        current.includes(key.id)
                          ? current.filter((id) => id !== key.id)
                          : [...current, key.id],
                      )
                    }
                  >
                    {visible ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                  <button
                    type="button"
                    className="ui-as-tool"
                    aria-label={`Copy ${key.name} key`}
                    title={`Copy ${key.name} key`}
                    onClick={() => copy(key)}
                  >
                    {copied === key.id ? <CheckIcon /> : <CopyIcon />}
                  </button>
                </span>
                <span className="ui-sb-role">{key.created}</span>
                <button
                  type="button"
                  className="ui-as-tool ui-sb-danger"
                  aria-label={`Revoke ${key.name} key`}
                  title={`Revoke ${key.name} key`}
                  onClick={() => {
                    setKeys((current) => current.filter((row) => row.id !== key.id));
                    onRevokeKey?.(key.id);
                    onAction?.("revoke-key", key.name);
                  }}
                >
                  <TrashIcon />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------- Icons ---------- */

function NavIcon({ label }: { label: string }): ReactNode {
  switch (label) {
    case "New chat":
      return <NewChatIcon />;
    case "Chat":
      return <ChatIcon />;
    case "Folders":
      return <FolderIcon />;
    case "Integrations":
      return <IntegrationsIcon />;
    case "Analytics":
      return <AnalyticsIcon />;
    case "Settings":
      return <SettingsIcon />;
    default:
      return null;
  }
}

function PanelIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M2 12C2 8.31087 2 6.4663 2.81382 5.15877C3.1149 4.67502 3.48891 4.25427 3.91891 3.91554C5.08116 3 6.72077 3 10 3H14C17.2792 3 18.9188 3 20.0811 3.91554C20.5111 4.25427 20.8851 4.67502 21.1862 5.15877C22 6.4663 22 8.31087 22 12C22 15.6891 22 17.5337 21.1862 18.8412C20.8851 19.325 20.5111 19.7457 20.0811 20.0845C18.9188 21 17.2792 21 14 21H10C6.72077 21 5.08116 21 3.91891 20.0845C3.48891 19.7457 3.1149 19.325 2.81382 18.8412C2 17.5337 2 15.6891 2 12Z"
        stroke="currentColor"
        strokeWidth={1.9}
      />
      <path d="M9.5 3L9.5 21" stroke="currentColor" strokeLinejoin="round" strokeWidth={1.9} />
      <path
        d="M5 7H6M5 10H6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M17 17L21 21"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
      <path
        d="M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
    </svg>
  );
}

function NewChatIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M16.4249 4.60509L17.4149 3.6151C18.2351 2.79497 19.5648 2.79497 20.3849 3.6151C21.205 4.43524 21.205 5.76493 20.3849 6.58507L19.3949 7.57506M16.4249 4.60509L9.76558 11.2644C9.25807 11.772 8.89804 12.4078 8.72397 13.1041L8 16L10.8959 15.276C11.5922 15.102 12.228 14.7419 12.7356 14.2344L19.3949 7.57506M16.4249 4.60509L19.3949 7.57506"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
      <path
        d="M18.9999 13.5C18.9999 16.7875 18.9999 18.4312 18.092 19.5376C17.9258 19.7401 17.7401 19.9258 17.5375 20.092C16.4312 21 14.7874 21 11.4999 21H11C7.22876 21 5.34316 21 4.17159 19.8284C3.00003 18.6569 3 16.7712 3 13V12.5C3 9.21252 3 7.56879 3.90794 6.46244C4.07417 6.2599 4.2599 6.07417 4.46244 5.90794C5.56879 5 7.21252 5 10.5 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M21.5 12C21.5 17.2467 17.2467 21.5 12 21.5C10.3719 21.5 8.8394 21.0904 7.5 20.3687C5.63177 19.362 4.37462 20.2979 3.26592 20.4658C3.09774 20.4913 2.93024 20.4302 2.80997 20.31C2.62741 20.1274 2.59266 19.8451 2.6935 19.6074C3.12865 18.5818 3.5282 16.6382 2.98341 15C2.6698 14.057 2.5 13.0483 2.5 12C2.5 6.75329 6.75329 2.5 12 2.5C17.2467 2.5 21.5 6.75329 21.5 12Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
      <path
        d="M12.1257 12H12.0007M8.125 12H8M16.125 12H16M12.2507 12C12.2507 12.1381 12.1388 12.25 12.0007 12.25C11.8627 12.25 11.7507 12.1381 11.7507 12C11.7507 11.8619 11.8627 11.75 12.0007 11.75C12.1388 11.75 12.2507 11.8619 12.2507 12ZM8.25 12C8.25 12.1381 8.13807 12.25 8 12.25C7.86193 12.25 7.75 12.1381 7.75 12C7.75 11.8619 7.86193 11.75 8 11.75C8.13807 11.75 8.25 11.8619 8.25 12ZM16.25 12C16.25 12.1381 16.1381 12.25 16 12.25C15.8619 12.25 15.75 12.1381 15.75 12C15.75 11.8619 15.8619 11.75 16 11.75C16.1381 11.75 16.25 11.8619 16.25 12Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M8 7H16.75C18.8567 7 19.91 7 20.6667 7.50559C20.9943 7.72447 21.2755 8.00572 21.4944 8.33329C22 9.08996 22 10.1433 22 12.25C22 15.7612 22 17.5167 21.1573 18.7779C20.7926 19.3238 20.3238 19.7926 19.7779 20.1573C18.5167 21 16.7612 21 13.25 21H12C7.28595 21 4.92893 21 3.46447 19.5355C2 18.0711 2 15.714 2 11V7.94427C2 6.1278 2 5.21956 2.38032 4.53806C2.65142 4.05227 3.05227 3.65142 3.53806 3.38032C4.21956 3 5.1278 3 6.94427 3C8.10802 3 8.6899 3 9.19926 3.19101C10.3622 3.62712 10.8418 4.68358 11.3666 5.73313L12 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={1.9}
      />
    </svg>
  );
}

function IntegrationsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M10.5 8.75V6.75C10.5 5.10626 10.5 4.28439 10.046 3.73121C9.96291 3.62995 9.87005 3.53709 9.76879 3.45398C9.21561 3 8.39374 3 6.75 3C5.10626 3 4.28439 3 3.73121 3.45398C3.62995 3.53709 3.53709 3.62995 3.45398 3.73121C3 4.28439 3 5.10626 3 6.75V8.75C3 10.3937 3 11.2156 3.45398 11.7688C3.53709 11.8701 3.62995 11.9629 3.73121 12.046C4.28439 12.5 5.10626 12.5 6.75 12.5C8.39374 12.5 9.21561 12.5 9.76879 12.046C9.87005 11.9629 9.96291 11.8701 10.046 11.7688C10.5 11.2156 10.5 10.3937 10.5 8.75Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
      <path
        d="M7.75 15.5H5.75C5.05222 15.5 4.70333 15.5 4.41943 15.5861C3.78023 15.78 3.28002 16.2802 3.08612 16.9194C3 17.2033 3 17.5522 3 18.25C3 18.9478 3 19.2967 3.08612 19.5806C3.28002 20.2198 3.78023 20.72 4.41943 20.9139C4.70333 21 5.05222 21 5.75 21H7.75C8.44778 21 8.79667 21 9.08057 20.9139C9.71977 20.72 10.22 20.2198 10.4139 19.5806C10.5 19.2967 10.5 18.9478 10.5 18.25C10.5 17.5522 10.5 17.2033 10.4139 16.9194C10.22 16.2802 9.71977 15.78 9.08057 15.5861C8.79667 15.5 8.44778 15.5 7.75 15.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
      <path
        d="M21 17.25V15.25C21 13.6063 21 12.7844 20.546 12.2312C20.4629 12.1299 20.3701 12.0371 20.2688 11.954C19.7156 11.5 18.8937 11.5 17.25 11.5C15.6063 11.5 14.7844 11.5 14.2312 11.954C14.1299 12.0371 14.0371 12.1299 13.954 12.2312C13.5 12.7844 13.5 13.6063 13.5 15.25V17.25C13.5 18.8937 13.5 19.7156 13.954 20.2688C14.0371 20.3701 14.1299 20.4629 14.2312 20.546C14.7844 21 15.6063 21 17.25 21C18.8937 21 19.7156 21 20.2688 20.546C20.3701 20.4629 20.4629 20.3701 20.546 20.2688C21 19.7156 21 18.8937 21 17.25Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
      <path
        d="M18.25 3H16.25C15.5522 3 15.2033 3 14.9194 3.08612C14.2802 3.28002 13.78 3.78023 13.5861 4.41943C13.5 4.70333 13.5 5.05222 13.5 5.75C13.5 6.44778 13.5 6.79667 13.5861 7.08057C13.78 7.71977 14.2802 8.21998 14.9194 8.41388C15.2033 8.5 15.5522 8.5 16.25 8.5H18.25C18.9478 8.5 19.2967 8.5 19.5806 8.41388C20.2198 8.21998 20.72 7.71977 20.9139 7.08057C21 6.79667 21 6.44778 21 5.75C21 5.05222 21 4.70333 20.9139 4.41943C20.72 3.78023 20.2198 3.28002 19.5806 3.08612C19.2967 3 18.9478 3 18.25 3Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
    </svg>
  );
}

function AnalyticsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path d="M7 17L7 13" stroke="currentColor" strokeLinecap="round" strokeWidth={1.9} />
      <path d="M12 17L12 7" stroke="currentColor" strokeLinecap="round" strokeWidth={1.9} />
      <path d="M17 17L17 11" stroke="currentColor" strokeLinecap="round" strokeWidth={1.9} />
      <path
        d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M21.3175 7.14139L20.8239 6.28479C20.4506 5.63696 20.264 5.31305 19.9464 5.18388C19.6288 5.05472 19.2696 5.15664 18.5513 5.36048L17.3311 5.70418C16.8725 5.80994 16.3913 5.74994 15.9726 5.53479L15.6357 5.34042C15.2766 5.11043 15.0004 4.77133 14.8475 4.37274L14.5136 3.37536C14.294 2.71534 14.1842 2.38533 13.9228 2.19657C13.6615 2.00781 13.3143 2.00781 12.6199 2.00781H11.5051C10.8108 2.00781 10.4636 2.00781 10.2022 2.19657C9.94085 2.38533 9.83106 2.71534 9.61149 3.37536L9.27753 4.37274C9.12465 4.77133 8.84845 5.11043 8.48937 5.34042L8.15249 5.53479C7.73374 5.74994 7.25259 5.80994 6.79398 5.70418L5.57375 5.36048C4.85541 5.15664 4.49625 5.05472 4.17867 5.18388C3.86109 5.31305 3.67445 5.63696 3.30115 6.28479L2.80757 7.14139C2.45766 7.74864 2.2827 8.05227 2.31666 8.37549C2.35061 8.69871 2.58483 8.95918 3.05326 9.48012L4.0843 10.6328C4.3363 10.9518 4.51521 11.5078 4.51521 12.0077C4.51521 12.5078 4.33636 13.0636 4.08433 13.3827L3.05326 14.5354C2.58483 15.0564 2.35062 15.3168 2.31666 15.6401C2.2827 15.9633 2.45766 16.2669 2.80757 16.8741L3.30114 17.7307C3.67443 18.3785 3.86109 18.7025 4.17867 18.8316C4.49625 18.9608 4.85542 18.8589 5.57377 18.655L6.79394 18.3113C7.25263 18.2055 7.73387 18.2656 8.15267 18.4808L8.4895 18.6752C8.84851 18.9052 9.12464 19.2442 9.2775 19.6428L9.61149 20.6403C9.83106 21.3003 9.94085 21.6303 10.2022 21.8191C10.4636 22.0078 10.8108 22.0078 11.5051 22.0078H12.6199C13.3143 22.0078 13.6615 22.0078 13.9228 21.8191C14.1842 21.6303 14.294 21.3003 14.5136 20.6403L14.8476 19.6428C15.0004 19.2442 15.2765 18.9052 15.6356 18.6752L15.9724 18.4808C16.3912 18.2656 16.8724 18.2055 17.3311 18.3113L18.5513 18.655C19.2696 18.8589 19.6288 18.9608 19.9464 18.8316C20.264 18.7025 20.4506 18.3785 20.8239 17.7307L21.3175 16.8741C21.6674 16.2669 21.8423 15.9633 21.8084 15.6401C21.7744 15.3168 21.5402 15.0564 21.0718 14.5354L20.0407 13.3827C19.7887 13.0636 19.6098 12.5078 19.6098 12.0077C19.6098 11.5078 19.7888 10.9518 20.0407 10.6328L21.0718 9.48012C21.5402 8.95918 21.7744 8.69871 21.8084 8.37549C21.8423 8.05227 21.6674 7.74864 21.3175 7.14139Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={1.9}
      />
      <path
        d="M15.5195 12C15.5195 13.933 13.9525 15.5 12.0195 15.5C10.0865 15.5 8.51953 13.933 8.51953 12C8.51953 10.067 10.0865 8.5 12.0195 8.5C13.9525 8.5 15.5195 10.067 15.5195 12Z"
        stroke="currentColor"
        strokeWidth={1.9}
      />
    </svg>
  );
}

function ProjectIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M2.5 20V8.87695C2.5 7.58945 2.5 6.9457 2.78533 6.47048C2.9541 6.18939 3.18939 5.9541 3.47048 5.78533C3.9457 5.5 4.59449 5.5 5.89206 5.5C6.52339 5.5 6.83906 5.5 7.12612 5.58819C7.31759 5.64702 7.49914 5.73428 7.66469 5.84705C7.91289 6.01611 8.10859 6.26074 8.5 6.75C8.89141 7.23926 9.08711 7.48389 9.33531 7.65295C9.50086 7.76572 9.68241 7.85298 9.87388 7.91181C10.1609 8 10.4742 8 11.1008 8H15C16.4045 8 17.1067 8 17.6111 8.33706C17.8295 8.48298 18.017 8.67048 18.1629 8.88886C18.5 9.39331 18.5 10.0955 18.5 11.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
      <path
        d="M4.42028 14.0144L3.63368 16.0144C2.65618 18.4998 2.16743 19.7425 2.7524 20.6213C3.33737 21.5 4.65337 21.5 7.28537 21.5H15.1903C16.4249 21.5 17.0422 21.5 17.5295 21.1795C18.0169 20.859 18.2702 20.2865 18.7769 19.1415L19.6618 17.1415C20.7866 14.5992 21.349 13.3281 20.7679 12.4141C20.1868 11.5 18.8163 11.5 16.0752 11.5H8.07196C6.78232 11.5 6.1375 11.5 5.63811 11.8439C5.13872 12.1877 4.89924 12.7966 4.42028 14.0144Z"
        stroke="currentColor"
        strokeWidth={1.9}
      />
      <path
        d="M11.5 4.51456C12.4151 3.28409 13.6662 2.55594 15.5125 2.50161C16.1155 2.48386 16.7152 2.61395 17.2682 2.85544C18.5748 3.42601 19.4185 4.15644 20 5.5L21.5 3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M5 14L8.5 17.5L19 6.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M2 12C2 8.46252 2 6.69377 3.0528 5.5129C3.22119 5.32403 3.40678 5.14935 3.60746 4.99087C4.86213 4 6.74142 4 10.5 4H13.5C17.2586 4 19.1379 4 20.3925 4.99087C20.5932 5.14935 20.7788 5.32403 20.9472 5.5129C22 6.69377 22 8.46252 22 12C22 15.5375 22 17.3062 20.9472 18.4871C20.7788 18.676 20.5932 18.8506 20.3925 19.0091C19.1379 20 17.2586 20 13.5 20H10.5C6.74142 20 4.86213 20 3.60746 19.0091C3.40678 18.8506 3.22119 18.676 3.0528 18.4871C2 17.3062 2 15.5375 2 12Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
      <path
        d="M10 16H11.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
      <path
        d="M14.5 16L18 16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
      <path d="M2 9H22" stroke="currentColor" strokeLinejoin="round" strokeWidth={1.9} />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M2 6L8.91302 9.91697C11.4616 11.361 12.5384 11.361 15.087 9.91697L22 6"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
      <path
        d="M2.01577 13.4756C2.08114 16.5412 2.11383 18.0739 3.24496 19.2094C4.37608 20.3448 5.95033 20.3843 9.09883 20.4634C11.0393 20.5122 12.9607 20.5122 14.9012 20.4634C18.0497 20.3843 19.6239 20.3448 20.7551 19.2094C21.8862 18.0739 21.9189 16.5412 21.9842 13.4756C22.0053 12.4899 22.0053 11.5101 21.9842 10.5244C21.9189 7.45886 21.8862 5.92609 20.7551 4.79066C19.6239 3.65523 18.0497 3.61568 14.9012 3.53657C12.9607 3.48781 11.0393 3.48781 9.09882 3.53656C5.95033 3.61566 4.37608 3.65521 3.24495 4.79065C2.11382 5.92608 2.08114 7.45885 2.01576 10.5244C1.99474 11.5101 1.99475 12.4899 2.01577 13.4756Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
    </svg>
  );
}

function DownloadIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M16.9504 12.1817C17.1981 12.814 16.5076 13.5726 15.1267 15.0899C13.6702 16.6902 12.9201 17.4904 12 17.5C11.0799 17.4904 10.3298 16.6902 8.87331 15.0899C7.49239 13.5726 6.80193 12.814 7.04964 12.1817C7.05868 12.1586 7.06851 12.1359 7.0791 12.1135C7.34928 11.542 8.24477 11.5029 10 11.5002V4.99998C10 4.53501 10 4.30253 10.0511 4.11179C10.1898 3.59414 10.5941 3.1898 11.1118 3.05111C11.3025 3 11.535 3 12 3C12.4649 3 12.6974 3 12.8882 3.05111C13.4058 3.1898 13.8102 3.59414 13.9489 4.11179C14 4.30253 14 4.53501 14 4.99998V11.5002C15.7552 11.5029 16.6507 11.542 16.9209 12.1135C16.9315 12.1359 16.9413 12.1586 16.9504 12.1817Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
      <path
        d="M5.00006 21H19.0001"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true"
    >
      <rect
        x="9"
        y="9"
        width="11"
        height="11"
        rx="2.5"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
      <path
        d="M15 5.5C15 4.11929 13.8807 3 12.5 3H6.5C5.11929 3 4 4.11929 4 5.5V11.5C4 12.8807 5.11929 14 6.5 14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={1.9}
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M2.5 12C2.5 12 6 5.5 12 5.5C18 5.5 21.5 12 21.5 12C21.5 12 18 18.5 12 18.5C6 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
      <path
        d="M15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12Z"
        stroke="currentColor"
        strokeWidth={1.9}
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M2.5 12C2.5 12 6 5.5 12 5.5C18 5.5 21.5 12 21.5 12C21.5 12 18 18.5 12 18.5C6 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
      <path
        d="M15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12Z"
        stroke="currentColor"
        strokeWidth={1.9}
      />
      <path
        d="M4 4L20 20"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path d="M4 7H20" stroke="currentColor" strokeLinecap="round" strokeWidth={1.9} />
      <path
        d="M9.5 7V4.5H14.5V7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
      <path
        d="M6.5 7L7.4 19.2C7.45 19.95 8.07 20.5 8.82 20.5H15.18C15.93 20.5 16.55 19.95 16.6 19.2L17.5 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
      <path d="M10 11V16M14 11V16" stroke="currentColor" strokeLinecap="round" strokeWidth={1.9} />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M13.5 12C13.5 14.4853 11.4853 16.5 9 16.5C6.51472 16.5 4.5 14.4853 4.5 12C4.5 9.51472 6.51472 7.5 9 7.5C11.4853 7.5 13.5 9.51472 13.5 12Z"
        stroke="currentColor"
        strokeWidth={1.9}
      />
      <path
        d="M13.5 12H21M18 12V15.5M21 12V15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
    </svg>
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
/* ui-usage-meter — composed into this item */
.ui-um{--ui-um-tray: #eee6de;--ui-um-card: #fffdfb;--ui-um-line: #eae2d9;--ui-um-ink: #1c1713;--ui-um-text: #3d3226;--ui-um-muted: #857567;--ui-um-faint: #a5988d;--ui-um-well: #f4ece4;--ui-um-hover: #f4ece4;--ui-um-track: #eee6de;--ui-um-fill: #463a2c;--ui-um-spark: #d2c7bd;--ui-um-accent: #ff6b35;--ui-um-warn: #d99530;--ui-um-warn-text: #d9541f;--ui-um-c1: #ff6b35;--ui-um-c2: #ff8a5c;--ui-um-c3: #ffb28f;--ui-um-c4: #9c8f82;--ui-um-c5: #c8bdb2;--ui-um-focus: rgba(28, 23, 19, 0.22);--ui-um-tip-shadow: 0 8px 24px -6px rgba(11, 9, 8, 0.16), 0 2px 6px rgba(11, 9, 8, 0.06);--ui-um-ease: cubic-bezier(0.22, 1, 0.36, 1);box-sizing: border-box;container-type: inline-size;position: relative;display: grid;width: 100%;max-width: 460px;padding: 4px;border-radius: 20px;background: var(--ui-um-tray);font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 1.45;color: var(--ui-um-text);-webkit-font-smoothing: antialiased}
.ui-um *, .ui-um *::before, .ui-um *::after{box-sizing: border-box}
:where(.ui-um) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;cursor: pointer}
:where(.ui-um) :is(h3, p, ul){margin: 0;padding: 0}
:where(.ui-um) ul{list-style: none}
.ui-um :is(button, [tabindex="0"]):focus-visible{outline: 2px solid var(--ui-um-focus);outline-offset: 2px}
.ui-um b{font-weight: 500;color: var(--ui-um-ink)}
.ui-um__muted{color: var(--ui-um-muted)}
.ui-um__card{overflow: hidden;border-radius: 16px;background: var(--ui-um-card);box-shadow: 0 0 0 1px var(--ui-um-line), 0 1px 2px rgba(11, 9, 8, 0.04);transition: height var(--nm-dur-4, 380ms) var(--ui-um-ease)}
.ui-um__inner{display: flow-root;padding: 14px 16px 18px}
.ui-um__head{display: flex;align-items: flex-start;justify-content: space-between;gap: 12px}
.ui-um__heading{min-width: 0;padding-top: 2px}
.ui-um__title{overflow: hidden;font-size: 14px;font-weight: 600;line-height: 20px;color: var(--ui-um-ink);white-space: nowrap;text-overflow: ellipsis}
.ui-um__sub{font-size: 12.5px;color: var(--ui-um-muted);white-space: nowrap;overflow: hidden;text-overflow: ellipsis}
.ui-um__sep{margin: 0 6px;color: var(--ui-um-faint)}
.ui-um__switch{position: relative;display: grid;grid-auto-columns: auto;grid-auto-flow: column;flex: none;padding: 2px;border-radius: 10px;background: var(--ui-um-well);box-shadow: inset 0 0 0 1px var(--ui-um-line)}
.ui-um__pill{position: absolute;top: 0;left: 0;border-radius: 8px;background: var(--ui-um-card);box-shadow: 0 0 0 1px var(--ui-um-line), 0 1px 2px rgba(11, 9, 8, 0.06);opacity: 0;pointer-events: none;transition: transform var(--nm-dur-4, 380ms) var(--ui-um-ease), width var(--nm-dur-4, 380ms) var(--ui-um-ease), height var(--nm-dur-4, 380ms) var(--ui-um-ease), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-um__option{position: relative;z-index: 1;min-width: 0;height: 26px;padding: 0 9px;overflow: hidden;border-radius: 8px;font-size: 12px;font-weight: 500;color: var(--ui-um-muted);white-space: nowrap;text-overflow: ellipsis;transition: color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-um__option:hover, .ui-um__option[aria-checked="true"]{color: var(--ui-um-ink)}
.ui-um__figure{display: flex;align-items: baseline;justify-content: space-between;gap: 12px;margin-top: 18px}
.ui-um__amount{display: flex;flex-wrap: wrap;align-items: baseline;column-gap: 6px;min-width: 0}
.ui-um__big{font-size: 28px;font-weight: 600;line-height: 34px;letter-spacing: -0.02em;color: var(--ui-um-ink);font-variant-numeric: tabular-nums}
.ui-um__of{font-size: 13px;color: var(--ui-um-muted);font-variant-numeric: tabular-nums;white-space: nowrap}
.ui-um__pct{display: inline-flex;flex: none;align-items: center;gap: 6px;font-size: 13px;font-weight: 500;color: var(--ui-um-text);font-variant-numeric: tabular-nums;transition: color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-um__pct[data-state="warn"]{color: var(--ui-um-warn-text)}
.ui-um__pct[data-state="limit"]{color: var(--ui-um-ink)}
.ui-um__dot{display: inline-block;flex: none;width: 6px;height: 6px;border-radius: 50%;background: var(--ui-um-warn);animation: ui-um-pop var(--nm-dur-4, 380ms) cubic-bezier(0.34, 1.56, 0.64, 1) both}
.ui-um[data-state="limit"] .ui-um__pct .ui-um__dot, .ui-um[data-state="limit"] .ui-um__status .ui-um__dot, .ui-um__limit[data-state="limit"] .ui-um__dot{box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-um-warn) 22%, transparent)}
.ui-um__bar{position: relative;margin-top: 10px;padding: 4px 0;border-radius: 6px;cursor: default}
.ui-um__track{display: flex;height: 10px;overflow: hidden;border-radius: 5px;background: var(--ui-um-track)}
.ui-um__seg{position: relative;flex: none;height: 100%;overflow: hidden;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-um__seg::after{content: "";position: absolute;top: 0;right: 0;bottom: 0;width: 2px;background: var(--ui-um-card)}
.ui-um__bar[data-active] .ui-um__seg:not([data-active]){opacity: 0.28}
.ui-um__tip{position: absolute;bottom: calc(100% + 6px);z-index: 2;display: grid;gap: 1px;padding: 7px 10px 8px;border: 1px solid var(--ui-um-line);border-radius: 10px;background: var(--ui-um-card);box-shadow: var(--ui-um-tip-shadow);white-space: nowrap;pointer-events: none;opacity: 0;transform: translate(var(--ui-um-tip-x), 4px) scale(0.97);transition: left var(--nm-dur-3, 240ms) var(--ui-um-ease), transform var(--nm-dur-3, 240ms) var(--ui-um-ease), opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-um__tip[data-open]{opacity: 1;transform: translate(var(--ui-um-tip-x), 0)}
.ui-um__tip-label{display: flex;align-items: center;gap: 7px;font-size: 12px;color: var(--ui-um-muted)}
.ui-um__tip-value{font-size: 13px;font-weight: 500;color: var(--ui-um-ink);font-variant-numeric: tabular-nums}
.ui-um__tip-value .ui-um__muted{font-weight: 400}
.ui-um__legend{display: grid;margin-top: 10px}
.ui-um__row{display: grid;grid-template-rows: 1fr;animation: ui-um-grow 380ms var(--ui-um-ease) both;transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-um-ease) 80ms, opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-um__row[data-leaving]{grid-template-rows: 0fr;opacity: 0;pointer-events: none}
.ui-um__item{display: flex;align-items: center;gap: 10px;min-height: 0;height: 30px;margin: 0 -8px;padding: 0 8px;overflow: hidden;border-radius: 8px;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-um__row[data-leaving] .ui-um__item{background: none}
.ui-um__item[data-active]{background: var(--ui-um-hover)}
.ui-um__legend[data-active] .ui-um__item:not([data-active]){opacity: 0.45}
.ui-um__swatch{flex: none;width: 8px;height: 8px;border-radius: 2.5px}
.ui-um__label{flex: 1;min-width: 0;overflow: hidden;white-space: nowrap;text-overflow: ellipsis;color: var(--ui-um-text)}
.ui-um__value{color: var(--ui-um-ink);font-weight: 500;font-variant-numeric: tabular-nums}
.ui-um__share{width: 40px;text-align: right;color: var(--ui-um-muted);font-variant-numeric: tabular-nums}
.ui-um__daily{margin-top: 12px}
.ui-um__daily-head{display: flex;justify-content: space-between;gap: 12px;font-size: 12px;color: var(--ui-um-muted);white-space: nowrap}
.ui-um__daily-read{font-variant-numeric: tabular-nums;animation: ui-um-in var(--nm-dur-3, 240ms) var(--ui-um-ease) both}
.ui-um__spark{display: flex;align-items: stretch;gap: 2px;height: 34px;margin-top: 8px;border-radius: 4px;cursor: default}
.ui-um__spark[data-few]{gap: 5px}
.ui-um__day{display: flex;flex: 1 1 0;align-items: flex-end;min-width: 0}
.ui-um__day > span{width: 100%;border-radius: 2px;background: var(--ui-um-spark);transform-origin: bottom;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-um__spark[data-regrow] .ui-um__day > span{animation: ui-um-rise var(--nm-dur-5, 620ms) var(--ui-um-ease) both;animation-delay: calc(var(--i) * 18ms)}
.ui-um__day[data-future] > span{height: 2px;background: var(--ui-um-track)}
.ui-um__spark[data-hover] .ui-um__day:not([data-active]) > span{opacity: 0.6}
.ui-um__day[data-active] > span{background: var(--ui-um-accent)}
.ui-um__limits{display: grid;grid-template-columns: repeat(var(--n, 3), minmax(0, 1fr));gap: 12px 18px;margin-top: 16px;padding-top: 14px;border-top: 1px solid var(--ui-um-line)}
.ui-um__limit{display: grid;grid-template-columns: minmax(0, 1fr);align-content: start;min-width: 0}
.ui-um__limit-label{display: flex;align-items: center;gap: 6px;min-width: 0;overflow: hidden;font-size: 12px;color: var(--ui-um-muted);white-space: nowrap}
.ui-um__limit-value{overflow: hidden;color: var(--ui-um-ink);font-weight: 500;font-variant-numeric: tabular-nums;white-space: nowrap;text-overflow: ellipsis}
.ui-um__limit-value .ui-um__muted{font-weight: 400}
.ui-um__thin{position: relative;display: block;height: 4px;margin-top: 7px;overflow: hidden;border-radius: 2px;background: var(--ui-um-track)}
.ui-um__thin > span{position: absolute;top: 0;bottom: 0;left: 0;border-radius: inherit;background: var(--ui-um-fill)}
.ui-um__thin[data-unlimited]{background: repeating-linear-gradient(-45deg, var(--ui-um-track) 0 3px, transparent 3px 6px)}
.ui-um__foot{display: flex;align-items: center;justify-content: space-between;gap: 12px;min-height: 44px;padding: 6px 2px 2px 12px;font-size: 12.5px;color: var(--ui-um-muted)}
.ui-um__status{display: flex;align-items: center;gap: 7px;min-width: 0;overflow: hidden;white-space: nowrap;font-variant-numeric: tabular-nums;animation: ui-um-in var(--nm-dur-3, 240ms) var(--ui-um-ease) both}
.ui-um__status > :last-child{overflow: hidden;text-overflow: ellipsis}
.ui-um__action{display: inline-flex;flex: none;justify-content: center;height: 32px;overflow: hidden;border-radius: 14px;font-size: 13px;font-weight: 500;color: var(--ui-um-ink);background: var(--ui-um-card);box-shadow: 0 0 0 1px var(--ui-um-line), 0 1px 2px rgba(11, 9, 8, 0.04);transition: background-color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), width var(--nm-dur-4, 380ms) var(--ui-um-ease), transform var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-um__action:hover{background: var(--ui-um-hover)}
.ui-um__action:active{transform: scale(0.97)}
.ui-um__action[data-strong]{background: var(--ui-um-ink);color: var(--ui-um-card);box-shadow: 0 1px 2px rgba(11, 9, 8, 0.12), 0 6px 14px -6px rgba(11, 9, 8, 0.35);animation: ui-um-nudge var(--nm-dur-5, 620ms) cubic-bezier(0.34, 1.56, 0.64, 1)}
.ui-um__action[data-strong]:hover{background: var(--ui-um-ink);opacity: 0.88}
.ui-um__action-inner{display: inline-flex;align-items: center;flex: none;height: 100%;padding: 0 14px;white-space: nowrap}
.ui-um__action-text{animation: ui-um-in var(--nm-dur-3, 240ms) var(--ui-um-ease) both}
.ui-um__live{position: absolute;width: 1px;height: 1px;overflow: hidden;clip-path: inset(50%);white-space: nowrap}
@keyframes ui-um-in{from{opacity: 0;transform: translateY(3px);filter: blur(2px)}
to{opacity: 1;transform: none;filter: none}
}
@keyframes ui-um-grow{from{grid-template-rows: 0fr;opacity: 0}
to{grid-template-rows: 1fr;opacity: 1}
}
@keyframes ui-um-rise{from{transform: scaleY(0)}
to{transform: none}
}
@keyframes ui-um-pop{0%{transform: scale(0.3)}
60%{transform: scale(1.25)}
100%{transform: scale(1)}
}
@keyframes ui-um-nudge{0%{transform: scale(0.94)}
60%{transform: scale(1.04)}
100%{transform: scale(1)}
}
@container (max-width: 400px){.ui-um__inner{padding: 12px 14px 16px}
.ui-um__head{flex-direction: column;align-items: stretch;gap: 12px}
.ui-um__switch{grid-auto-columns: minmax(0, auto)}
.ui-um__option{padding: 0 6px}
.ui-um__big{font-size: 26px}
.ui-um__limits{grid-template-columns: minmax(0, 1fr);gap: 12px}
.ui-um__limit{grid-template-columns: minmax(0, 1fr) auto;column-gap: 12px}
.ui-um__limit-value{font-size: 12.5px}
.ui-um__thin{grid-column: 1 / -1;margin-top: 6px}
}
@container (max-width: 300px){.ui-um__of{font-size: 12px}
.ui-um__share{width: 34px}
}
@media (hover: none) and (pointer: coarse){.ui-um__option{height: 34px}
.ui-um__item{height: 36px}
.ui-um__action{height: 38px;border-radius: 13px}
.ui-um__foot{min-height: 50px}
.ui-um__bar{padding: 10px 0;margin-top: 4px}
}
@media (prefers-reduced-motion: reduce){.ui-um *, .ui-um *::before, .ui-um *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-um{--ui-um-tray: #181310;--ui-um-card: #1e1914;--ui-um-line: #2c241b;--ui-um-ink: #ebe3da;--ui-um-text: #baaea3;--ui-um-muted: #847467;--ui-um-faint: #554637;--ui-um-well: #181310;--ui-um-hover: #27201a;--ui-um-track: #2c241b;--ui-um-fill: #a79a8f;--ui-um-spark: #3b3024;--ui-um-accent: #ff8a5c;--ui-um-warn: #e8b05c;--ui-um-warn-text: #e8b05c;--ui-um-c1: #ff8a5c;--ui-um-c2: #ff6b35;--ui-um-c3: #d9541f;--ui-um-c4: #635345;--ui-um-c5: #43372a;--ui-um-focus: rgba(255, 253, 251, 0.3);--ui-um-tip-shadow: 0 8px 24px -6px rgba(11, 9, 8, 0.5), 0 2px 6px rgba(11, 9, 8, 0.35)}
:where(.dark, [data-theme="dark"]) .ui-um__pill{background: #2c241b;box-shadow: 0 0 0 1px rgba(255, 253, 251, 0.06)}
:where(.dark, [data-theme="dark"]) .ui-um__tip{background: #2b231b;border-color: rgba(255, 253, 251, 0.1)}
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
/* ui-segmented-control — composed into this item */
/* Animatable custom properties: the equal segment width and the soft edges glide too */
@property --ui-seg-min { syntax: "<length>"; inherits: true; initial-value: 0px; }
@property --ui-seg-fade-l { syntax: "<length>"; inherits: false; initial-value: 0px; }
@property --ui-seg-fade-r { syntax: "<length>"; inherits: false; initial-value: 0px; }
.ui-seg {
  --ui-seg-tray: #eee6de;
  --ui-seg-pill: #fffdfb;
  --ui-seg-line: #eae2d9;
  --ui-seg-ink: #1c1713;
  --ui-seg-text: #3d3226;
  --ui-seg-soft: #68584b;
  --ui-seg-muted: #857567;
  --ui-seg-count: rgba(11, 9, 8, 0.06);
  --ui-seg-accent: #ff6b35;
  --ui-seg-accent-soft: rgba(255, 107, 53, 0.1);
  --ui-seg-pill-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 1px 2px rgba(11, 9, 8, 0.08), 0 2px 8px -2px rgba(11, 9, 8, 0.06);
  --ui-seg-focus: rgba(28, 23, 19, 0.22);
  --ui-seg-ease: cubic-bezier(0.22, 1, 0.36, 1);
  /* Size: md */
  --ui-seg-h: 30px;
  --ui-seg-px: 12px;
  --ui-seg-fs: 13.5px;
  --ui-seg-r: 11px;
  --ui-seg-pad: 3px;
  --ui-seg-icon: 15px;
  --ui-seg-gap: 20px;
  box-sizing: border-box;
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  vertical-align: middle;
  border-radius: var(--ui-seg-r);
  background: var(--ui-seg-tray);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: var(--ui-seg-fs);
  line-height: 1;
  color: var(--ui-seg-soft);
  -webkit-font-smoothing: antialiased;
}
.ui-seg[data-size="sm"] { --ui-seg-h: 26px; --ui-seg-px: 10px; --ui-seg-fs: 12.5px; --ui-seg-r: 9px; --ui-seg-pad: 2px; --ui-seg-icon: 14px; --ui-seg-gap: 16px; }
.ui-seg[data-size="lg"] { --ui-seg-h: 36px; --ui-seg-px: 16px; --ui-seg-fs: 14px; --ui-seg-r: 13px; --ui-seg-pad: 4px; --ui-seg-icon: 16px; --ui-seg-gap: 24px; }
.ui-seg[data-full] { display: flex; width: 100%; }
.ui-seg[data-disabled] { opacity: 0.5; pointer-events: none; }
.ui-seg *, .ui-seg *::before, .ui-seg *::after { box-sizing: border-box; }
:where(.ui-seg) button { margin: 0; border: 0; background: none; font: inherit; color: inherit; cursor: pointer; }
:where(.ui-seg) svg { display: block; flex: none; }
/* Scrolls sideways only when it doesn't fit; the padding keeps focus rings from being cut off */
.ui-seg__scroller {
  position: relative;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding: var(--ui-seg-pad);
  border-radius: inherit;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  -webkit-mask-image: linear-gradient(to right, transparent, #0b0908 var(--ui-seg-fade-l), #0b0908 calc(100% - var(--ui-seg-fade-r)), transparent);
  mask-image: linear-gradient(to right, transparent, #0b0908 var(--ui-seg-fade-l), #0b0908 calc(100% - var(--ui-seg-fade-r)), transparent);
  transition: --ui-seg-fade-l var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), --ui-seg-fade-r var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-seg__scroller::-webkit-scrollbar { display: none; }
.ui-seg__track {
  position: relative;
  display: flex;
  width: max-content;
  min-width: 100%;
  /* Horizontal drags move the pill; vertical ones still scroll the page */
  touch-action: pan-y;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
/* When it scrolls, swipes scroll it instead of dragging the pill */
.ui-seg[data-overflow] .ui-seg__track { touch-action: pan-x pan-y; }
/* Equal segments, each as wide as the widest one needs */
.ui-seg[data-full] .ui-seg__track { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(var(--ui-seg-min), 1fr); }
.ui-seg[data-ready] .ui-seg__track { transition: --ui-seg-min var(--nm-dur-4, 380ms) var(--ui-seg-ease); }
/* An option */
.ui-seg__opt {
  position: relative;
  z-index: 1;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  height: var(--ui-seg-h);
  padding: 0 var(--ui-seg-px);
  overflow: clip;
  border-radius: calc(var(--ui-seg-r) - var(--ui-seg-pad));
  white-space: nowrap;
  transition: color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-seg[data-ready]:not([data-full]) .ui-seg__opt { transition: color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), width var(--nm-dur-4, 380ms) var(--ui-seg-ease); }
.ui-seg__opt[data-active] { color: var(--ui-seg-ink); }
.ui-seg__opt:disabled { opacity: 0.4; cursor: not-allowed; }
.ui-seg__opt:focus-visible { outline: 2px solid var(--ui-seg-focus); outline-offset: 0; }
@media (hover: hover) {
  .ui-seg__opt:not([data-active]):not(:disabled):hover { color: var(--ui-seg-text); }
}
.ui-seg__content { display: inline-flex; flex: none; align-items: center; gap: 6px; }
.ui-seg__icon { display: grid; place-items: center; width: var(--ui-seg-icon); height: var(--ui-seg-icon); }
.ui-seg__icon svg { width: 100%; height: 100%; }
/* Regular and semibold copies of the label crossfade */
.ui-seg__label { display: grid; justify-items: center; }
.ui-seg__text { grid-area: 1 / 1; font-weight: 500; transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)); }
.ui-seg__text-bold { font-weight: 600; opacity: 0; }
.ui-seg__opt[data-active] .ui-seg__text { opacity: 0; }
.ui-seg__opt[data-active] .ui-seg__text-bold { opacity: 1; }
.ui-seg__count {
  display: inline-grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--ui-seg-count);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--ui-seg-text);
  animation: ui-seg-in var(--nm-dur-3, 240ms) var(--ui-seg-ease) both;
}
.ui-seg[data-size="sm"] .ui-seg__count { min-width: 16px; height: 16px; padding: 0 4px; font-size: 10.5px; }
.ui-seg__badge {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 6px;
  background: var(--ui-seg-accent-soft);
  font-size: 11px;
  font-weight: 500;
  color: var(--ui-seg-accent);
}
/* The indicator: left and right edges glide separately – the one facing the target leads, so it stretches and settles */
.ui-seg__pill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 100%;
  z-index: 0;
  border-radius: calc(var(--ui-seg-r) - var(--ui-seg-pad));
  background: var(--ui-seg-pill);
  box-shadow: var(--ui-seg-pill-shadow);
  opacity: 0;
  pointer-events: none;
  transition: left 380ms var(--ui-seg-ease), right 380ms var(--ui-seg-ease), scale var(--nm-dur-2, 160ms) var(--ui-seg-ease), opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-seg__pill[data-dir="right"] { transition-duration: var(--nm-dur-4, 380ms), var(--nm-dur-3, 240ms), var(--nm-dur-2, 160ms), 160ms; }
.ui-seg__pill[data-dir="left"] { transition-duration: var(--nm-dur-3, 240ms), var(--nm-dur-4, 380ms), var(--nm-dur-2, 160ms), 160ms; }
/* Press feedback: the pill gives a little while held or dragged */
.ui-seg[data-pressed]:not([data-variant="underline"]) .ui-seg__pill { scale: 0.97; }
/* Underline variant: text tabs on a hairline */
.ui-seg[data-variant="underline"] { --ui-seg-px: 2px; border-radius: 0; background: none; box-shadow: inset 0 -1px 0 var(--ui-seg-line); }
.ui-seg[data-variant="underline"] .ui-seg__scroller { padding: 0; }
.ui-seg[data-variant="underline"]:not([data-full]) .ui-seg__track { gap: var(--ui-seg-gap); }
.ui-seg[data-variant="underline"][data-full] { --ui-seg-px: 10px; }
.ui-seg[data-variant="underline"] .ui-seg__opt { height: calc(var(--ui-seg-h) + 6px); border-radius: 6px; }
.ui-seg[data-variant="underline"] .ui-seg__opt:focus-visible { outline-offset: -2px; }
.ui-seg[data-variant="underline"] .ui-seg__pill { top: auto; height: 2px; border-radius: 2px 2px 0 0; background: var(--ui-seg-ink); box-shadow: none; }
@keyframes ui-seg-in { from { opacity: 0; transform: translateY(3px); filter: blur(2px); }
 to { opacity: 1; transform: none; filter: none; }
 }
/* Touch screens: every option at least 40px tall */
@media (hover: none) and (pointer: coarse) {
  .ui-seg[data-size] { --ui-seg-h: 40px; }
  .ui-seg[data-size="lg"] { --ui-seg-h: 44px; }
  .ui-seg[data-variant="underline"] .ui-seg__opt { height: var(--ui-seg-h); }
}
@media (prefers-reduced-motion: reduce) {
  .ui-seg *, .ui-seg *::before, .ui-seg *::after { animation: none !important; transition: none !important; }
}
/* Dark mode: follows a .dark class or data-theme="dark" on any ancestor, e.g. <html> */
:where(.dark, [data-theme="dark"]) .ui-seg {
  --ui-seg-tray: #181310;
  --ui-seg-pill: #29221b;
  --ui-seg-line: #2c241b;
  --ui-seg-ink: #ebe3da;
  --ui-seg-text: #baaea3;
  --ui-seg-soft: #847467;
  --ui-seg-muted: #847467;
  --ui-seg-count: rgba(255, 253, 251, 0.08);
  --ui-seg-accent: #ff8a5c;
  --ui-seg-accent-soft: rgba(255, 138, 92, 0.14);
  --ui-seg-pill-shadow: 0 0 0 1px rgba(255, 253, 251, 0.06), 0 1px 2px rgba(11, 9, 8, 0.4);
  --ui-seg-focus: rgba(255, 253, 251, 0.3);
}
.ui-sb{width: min(1040px, calc(100% - 64px));margin: 0 auto;padding: 40px 0 64px}
.ui-sb__bar{position: sticky;top: 0;z-index: 5;margin: 10px -16px 0;padding: 18px 16px 12px;background: var(--panel)}
.ui-sb__bar::after{content: "";position: absolute;left: 0;right: 0;top: 100%;height: 24px;background: linear-gradient(to bottom, var(--panel), transparent);pointer-events: none}
.ui-sb__body{margin-top: 14px}
.ui-sb-card{border-radius: 14px;background: var(--card);box-shadow: 0 0 0 1px var(--line), var(--shadow)}
.ui-sb-cap{font-size: 13px;color: var(--muted)}
.ui-sb-muted{margin: 0;font-size: 13px;line-height: 19px;color: var(--muted)}
.ui-sb-h2{margin: 0;font-size: 15px;line-height: 20px;font-weight: 500;color: var(--ink)}
.ui-sb-actions{display: flex;align-items: center;gap: 6px}
.ui-sb-pill{display: inline-flex;align-items: center;height: 20px;padding: 0 7px;border-radius: 999px;background: var(--chip);font-size: 11.5px;font-weight: 500;line-height: 1;color: var(--text);white-space: nowrap}
.ui-sb-pill[data-tone="green"]{background: #f4ece4;color: #1a7a4a}
.ui-sb-pill[data-tone="amber"]{background: #f1e9e1;color: #d9541f}
:where(.dark, [data-theme="dark"]) .ui-sb-pill[data-tone="green"]{background: rgba(47, 141, 92, 0.14);color: #4f9d6e}
:where(.dark, [data-theme="dark"]) .ui-sb-pill[data-tone="amber"]{background: rgba(217, 149, 48, 0.14);color: #e8b05c}
.ui-sb-overview{display: grid;gap: 16px}
.ui-sb-stack{display: grid;grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);gap: 16px;align-items: stretch}
.ui-sb-usage .ui-um{max-width: none}
@container ui-as-main (min-width: 901px){.ui-sb-usage .ui-um__inner{display: grid;grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);column-gap: 40px;padding: 16px 20px 18px}
.ui-sb-usage .ui-um__head{grid-column: 1;grid-row: 1}
.ui-sb-usage .ui-um__figure{grid-column: 1;grid-row: 2}
.ui-sb-usage .ui-um__bar{grid-column: 1;grid-row: 3}
.ui-sb-usage .ui-um__legend{grid-column: 1;grid-row: 4;grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);column-gap: 24px}
.ui-sb-usage .ui-um__daily{grid-column: 2;grid-row: 1 / span 3;align-self: end;margin-top: 0}
.ui-sb-usage .ui-um__daily .ui-um__spark{height: 64px}
.ui-sb-usage .ui-um__limits{grid-column: 2;grid-row: 4;align-self: start;margin-top: 10px}
}
.ui-sb-plan{display: grid;gap: 8px;padding: 16px 18px 18px}
.ui-sb-plan__top{display: flex;align-items: center;justify-content: space-between}
.ui-sb-plan__name{font-size: 22px;line-height: 28px;font-weight: 500;letter-spacing: -0.02em;color: var(--ink)}
.ui-sb-plan__name span{color: var(--muted);font-weight: 400}
.ui-sb-plan .ui-sb-actions{margin-top: 8px}
.ui-sb-pay{display: grid;padding: 4px 18px}
.ui-sb-pay__row{display: flex;align-items: center;gap: 12px;min-height: 64px}
.ui-sb-pay__row + .ui-sb-pay__row{border-top: 1px solid var(--line-soft)}
.ui-sb-pay__text{display: grid;flex: 1;gap: 2px;min-width: 0}
.ui-sb-pay__text b, .ui-sb-row__text b{display: flex;align-items: center;gap: 8px;overflow: hidden;font-size: 13.5px;line-height: 19px;font-weight: 500;color: var(--ink);white-space: nowrap;text-overflow: ellipsis}
.ui-sb-pay__text span, .ui-sb-row__text > span{overflow: hidden;font-size: 12.5px;line-height: 17px;color: var(--muted);white-space: nowrap;text-overflow: ellipsis}
.ui-sb-visa{display: grid;place-items: center;flex: none;width: 42px;height: 28px;border-radius: 6px;background: #a33f16;font-size: 11px;font-style: italic;font-weight: 800;letter-spacing: 0.02em;color: #fffdfb}
.ui-sb-tile{display: grid;place-items: center;flex: none;width: 32px;height: 32px;border-radius: 9px;background: var(--chip);color: var(--muted)}
.ui-sb-pay .ui-sb-tile{width: 42px;height: 28px;border-radius: 6px}
.ui-sb-inline{display: flex;flex: 1;align-items: center;gap: 6px;min-width: 0}
.ui-sb-inline .ui-sb-input{flex: 1;min-width: 0}
.ui-sb-input{height: 34px;padding: 0 10px;border: 0;border-radius: 9px;background: var(--card);box-shadow: 0 0 0 1px var(--line);font: inherit;font-size: 13px;color: var(--ink);outline: none;transition: box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-sb-input::placeholder{color: var(--placeholder)}
.ui-sb-input:focus{box-shadow: 0 0 0 1px var(--line-strong), 0 0 0 3px var(--hover)}
.ui-sb-section{margin-top: 40px;scroll-margin-top: 72px}
.ui-sb-section--first{margin-top: 10px}
.ui-sb-section__head{display: flex;align-items: flex-end;justify-content: space-between;gap: 16px;margin-bottom: 14px}
.ui-sb-section__head .ui-sb-muted{margin-top: 2px}
.ui-sb-plans{display: grid;grid-template-columns: repeat(3, minmax(0, 1fr));gap: 16px}
.ui-sb-tier{display: flex;flex-direction: column;gap: 10px;padding: 16px 18px 18px}
.ui-sb-tier[data-current]{box-shadow: 0 0 0 1px color-mix(in srgb, var(--ink) 22%, transparent), 0 0 0 5px color-mix(in srgb, var(--ink) 6%, transparent), var(--shadow)}
.ui-sb-tier__top{display: flex;align-items: center;justify-content: space-between;height: 20px}
.ui-sb-tier__top b{font-size: 14px;font-weight: 500;color: var(--ink)}
.ui-sb-tier__price{display: flex;align-items: baseline;gap: 6px}
.ui-sb-tier__price strong{font-size: 26px;line-height: 32px;font-weight: 500;letter-spacing: -0.02em;color: var(--ink);font-variant-numeric: tabular-nums;animation: ui-as-rise var(--nm-dur-4, 380ms) var(--ease) both}
.ui-sb-tier__price span{font-size: 12.5px;color: var(--muted)}
.ui-sb-tier__list{display: grid;gap: 7px;flex: 1;margin: 4px 0 6px;padding: 12px 0 0;border-top: 1px solid var(--line-soft);list-style: none}
.ui-sb-tier__list li{display: flex;align-items: center;gap: 8px;font-size: 13px;color: var(--text)}
.ui-sb-tier__list svg{color: var(--muted)}
.ui-sb-tier .ui-button{width: 100%}
.ui-sb-table-wrap{overflow-x: auto;padding: 0 4px 4px;border-radius: 18px;background: var(--tray)}
.ui-sb-table{width: 100%;border-collapse: separate;border-spacing: 0;font-size: 13px}
.ui-sb-table th{height: 38px;padding: 0 18px;font-size: 12px;font-weight: 500;color: var(--muted);text-align: left;white-space: nowrap}
.ui-sb-table td{height: 52px;padding: 0 18px;background: var(--card);color: var(--text);white-space: nowrap;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-sb-table tbody tr + tr td{border-top: 1px solid var(--line-soft)}
.ui-sb-table tbody tr:first-child td{border-top: 1px solid var(--line)}
.ui-sb-table tbody tr:last-child td{border-bottom: 1px solid var(--line)}
.ui-sb-table tbody td:first-child{border-left: 1px solid var(--line)}
.ui-sb-table tbody td:last-child{border-right: 1px solid var(--line)}
.ui-sb-table tbody tr:first-child td:first-child{border-top-left-radius: 14px}
.ui-sb-table tbody tr:first-child td:last-child{border-top-right-radius: 14px}
.ui-sb-table tbody tr:last-child td:first-child{border-bottom-left-radius: 14px}
.ui-sb-table tbody tr:last-child td:last-child{border-bottom-right-radius: 14px}
.ui-sb-table tbody tr:hover td{background: var(--subtle)}
.ui-sb-table .ui-sb-num{text-align: right;font-variant-numeric: tabular-nums}
.ui-sb-table td.ui-sb-num{color: var(--ink)}
.ui-sb-table .ui-sb-end{width: 1%;padding-right: 12px}
.ui-sb-mono{font-variant-numeric: tabular-nums;color: var(--muted) !important}
.ui-sb-tray{padding: 0 4px 4px;border-radius: 18px;background: var(--tray)}
.ui-sb-tray > .ui-sb-card{box-shadow: 0 0 0 1px var(--line)}
.ui-sb-tray__head{display: flex;align-items: center;justify-content: space-between;height: 38px;padding: 0 18px;font-size: 12px;font-weight: 500;color: var(--muted)}
.ui-sb-tray__end{padding-right: 44px}
.ui-sb-tray__end--key{padding-right: 258px}
.ui-sb-form{display: grid;padding: 4px}
.ui-sb-form__fields{padding: 4px 22px}
.ui-sb-field{display: grid;grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);gap: 24px;align-items: center;padding: 20px 0}
.ui-sb-field + .ui-sb-field{border-top: 1px solid var(--line-soft)}
.ui-sb-field__label{display: grid;gap: 3px}
.ui-sb-field__label b{font-size: 13.5px;font-weight: 500;color: var(--ink)}
.ui-sb-field__label span{font-size: 12.5px;line-height: 17px;color: var(--muted)}
.ui-sb-logo-row{display: flex;align-items: center;gap: 12px}
.ui-sb-logo{display: grid;place-items: center;width: 44px;height: 44px;border-radius: 12px;background: var(--ink);font-size: 18px;font-weight: 600;color: var(--on-ink)}
.ui-sb-form__foot{display: flex;justify-content: flex-end;gap: 6px;padding: 6px 2px 2px}
.ui-sb-list{display: grid;padding: 4px 8px}
.ui-sb-row{display: flex;align-items: center;gap: 12px;min-height: 60px;padding: 0 10px}
.ui-sb-row + .ui-sb-row{border-top: 1px solid var(--line-soft)}
.ui-sb-row__text{display: grid;flex: 1;gap: 2px;min-width: 0}
.ui-sb-row__spacer{width: 32px;flex: none}
.ui-sb-role{padding: 0 10px;font-size: 13px;color: var(--muted)}
.ui-sb-avatar{display: grid;place-items: center;flex: none;width: 32px;height: 32px;border-radius: 50%;background: #eef3ff;font-size: 12px;font-weight: 500;color: #3756d9}
.ui-sb-avatar[data-tone="1"]{background: #fdf2f8;color: #be185d}
.ui-sb-avatar[data-tone="2"]{background: #ecfdf3;color: #15803d}
.ui-sb-avatar[data-tone="3"]{background: #fff7e6;color: #b45309}
:where(.dark, [data-theme="dark"]) .ui-sb-avatar{background: rgba(109, 139, 255, 0.16);color: #a5b8ff}
:where(.dark, [data-theme="dark"]) .ui-sb-avatar[data-tone="1"]{background: rgba(236, 72, 153, 0.16);color: #f9a8d4}
:where(.dark, [data-theme="dark"]) .ui-sb-avatar[data-tone="2"]{background: rgba(34, 197, 94, 0.14);color: #86efac}
:where(.dark, [data-theme="dark"]) .ui-sb-avatar[data-tone="3"]{background: rgba(245, 158, 11, 0.14);color: #fcd34d}
.ui-sb-key{padding: 5px 9px;border-radius: 8px;background: var(--chip);font-family: ui-monospace, "SF Mono", Menlo, monospace;font-size: 12px;color: var(--text);white-space: nowrap}
.ui-sb-danger:hover{color: #b3261e}
.ui-sb-danger:hover svg{color: #b3261e}
.ui-sb-invite{width: 280px;padding: 14px}
.ui-sb-invite form{display: grid;gap: 6px}
.ui-sb-invite b{font-size: 13.5px;font-weight: 500;color: var(--ink)}
.ui-sb-invite span{font-size: 12.5px;color: var(--muted)}
.ui-sb-invite .ui-sb-input{margin: 6px 0 4px}
@container ui-as-main (max-width: 900px){.ui-sb-stack{grid-template-columns: minmax(0, 1fr)}
.ui-sb-plans{grid-template-columns: minmax(0, 1fr)}
}
@container ui-as-main (max-width: 640px){.ui-sb-field{grid-template-columns: minmax(0, 1fr);gap: 10px}
.ui-sb-key, .ui-sb-tray__end--key{display: none}
.ui-sb-section__head{flex-wrap: wrap;align-items: flex-start}
}
@container ui-as (max-width: 900px){.ui-sb{width: calc(100% - 48px)}
}
@container ui-as (max-width: 600px){.ui-sb{width: calc(100% - 32px);padding: 52px 0 48px}
.ui-sb__bar{margin: 6px -12px 0;padding: 14px 12px 10px;overflow-x: auto}
.ui-sb-pay{padding: 4px 14px}
.ui-sb-pay__row{flex-wrap: wrap;padding: 12px 0}
.ui-sb-form__fields{padding: 4px 16px}
.ui-sb-tray__end{display: none}
}

`;
