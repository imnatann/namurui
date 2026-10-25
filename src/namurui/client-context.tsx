"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/*
 * Client Context – one client's workspace: the account header, the numbers that matter, and a shared
 * timeline of everything the team knows about the account.
 *
 * The switcher lists every client and creates a new one; the segmented tabs glide their thumb across
 * Context, Reports, Financials and Settings. The composer turns "@Report name" into a real mention as
 * you type, keeps the attached files as chips on the same entry, and saves on ⌘/Ctrl + Enter. New
 * entries drop in at the top of the timeline with the fresh animation. KPIs rise one after another and
 * their sparklines draw themselves; the sync chip spins while it re-syncs. Below 680px of the block's
 * own width the KPIs wrap into two rows, the toolbar stacks and the timeline meta moves under the line.
 * The styles are injected below, so no extra files are needed.
 */

/** Attachment kinds; the icon's tab colour follows the kind */
export type CxFileKind = "pdf" | "xlsx" | "csv" | "doc";

export type CxFile = {
  /** File name as it is shown in the timeline and on the chip */
  name: string;
  /** Drives the icon's tab colour and its aria-label */
  kind: CxFileKind;
};

export type CxKpi = {
  /** Stable id; the pressed state is keyed on it */
  id: string;
  /** Label above the value, e.g. "MRR" */
  label: string;
  /** The figure exactly as it should read, e.g. "€48.2k" */
  value: string;
  /** Raw series, oldest first; the line is normalised to the sparkline box */
  trend: number[];
  /** Line colour; the stylesheet accent is used when omitted */
  color?: string;
};

export type CxReport = {
  /** Stable id */
  id: string;
  /** Report name – also what an "@" mention inserts */
  name: string;
  /** The line under the name in the list, e.g. "Updated yesterday · finance" */
  meta: string;
  /** The paragraph shown when the report is open */
  summary?: string;
  /** Opens on first render */
  open?: boolean;
};

/** A note body is text and report mentions, in order */
export type CxNotePart = { text: string } | { mention: string };

type CxEntryBase = {
  /** Stable id */
  id: string;
  /** Already-written time, e.g. "today" or "2d ago" */
  when: string;
  /** Added in this session – it animates in and can be removed */
  fresh?: boolean;
};

/** A person shown as an avatar and a name; without an avatar the initials show */
export type CxActor = { name: string; avatar?: string };

type CxActorEntry = CxEntryBase & { actor: CxActor };

export type CxNoteEntry = CxActorEntry & {
  kind: "note";
  /** Text runs and mentions, rendered in order */
  parts: CxNotePart[];
};

export type CxReportEntry = CxActorEntry & {
  kind: "report";
  /** Name of the generated report */
  report: string;
};

export type CxFilesEntry = CxActorEntry & {
  kind: "files";
  files: CxFile[];
};

export type CxIntegrationEntry = CxEntryBase & {
  kind: "integration";
  /** Connected app, e.g. "Stripe" */
  app: string;
  /** Draws the app's mark instead of a line icon */
  brand?: "stripe";
};

export type CxEntry = CxNoteEntry | CxReportEntry | CxFilesEntry | CxIntegrationEntry;

export type CxFinancialLine = {
  /** Stable id; the switch state is keyed on it */
  id: string;
  /** Row label, e.g. "Recurring revenue" */
  label: string;
  /** The muted line under the label */
  meta: string;
  /** Figure on the right */
  value: string;
  /** Signed change, e.g. "+2.4%" */
  delta: string;
  /** Which way the change reads */
  trend: "up" | "down";
  /** Series for the row's sparkline */
  series: number[];
  /** Dot colour; the stylesheet accent is used when omitted */
  color?: string;
  /** Included in the monthly pack on first render */
  included?: boolean;
};

/** The small line icon used by a settings row */
export type CxSettingIcon = "sync" | "mail" | "report" | "note";

export type CxSettingRow = {
  /** Stable id; the switch state is keyed on it */
  id: string;
  /** Row label */
  label: string;
  /** The muted line under the label */
  meta: string;
  /** On when the block first renders */
  on?: boolean;
  /** Line icon in the leading tile, or the app's own mark */
  icon?: CxSettingIcon | "stripe";
};

export type CxClient = {
  /** Stable id */
  id: string;
  /** Account name in the header and the switcher */
  name: string;
  /** The muted line under the name, e.g. "Northwind Logistics GmbH · EUR · Fiscal year ends Dec 31" */
  meta: string;
  /** One or two characters in the badge */
  mark: string;
  /** Badge fill; the stylesheet accent shows when omitted */
  color?: string;
  /** Badge text colour */
  ink?: string;
  /** The four figures above the card */
  kpis?: CxKpi[];
  /** The context feed; `timeline` on the block overrides it */
  timeline?: CxEntry[];
  /** Reports a note can mention and the Reports tab lists */
  reports?: CxReport[];
  /** Rows of the Financials tab */
  financials?: CxFinancialLine[];
  /** Rows of the Settings tab */
  settings?: CxSettingRow[];
};

export type ClientContextProps = {
  /** Every client in the switcher; the first one is open */
  clients?: CxClient[];
  /** Author of the notes written here; without an avatar the initials show */
  me?: CxActor;
  /** Timeline of the open client, when it is not stored on the client */
  timeline?: CxEntry[];
  /** The sync stamp in the header, e.g. "3m ago" */
  syncedAt?: string;
  /** Called after a note is added; the entries are already in the feed */
  onAddNote?: (clientId: string, text: string, files: CxFile[]) => void;
  /** Called when a client is created from the switcher */
  onCreateClient?: (name: string) => void;
  /** Called when a report is opened from a mention or its own action */
  onOpenReport?: (clientId: string, reportId: string) => void;
  /** Extra class on the root */
  className?: string;
};

type TabId = "context" | "reports" | "financials" | "settings";

type FilterId = "all" | "note" | "report" | "files" | "integration";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "context", label: "Context" },
  { id: "reports", label: "Reports" },
  { id: "financials", label: "Financials" },
  { id: "settings", label: "Settings" },
];

const filterOptions: Array<{ id: FilterId; label: string }> = [
  { id: "all", label: "All" },
  { id: "note", label: "Notes" },
  { id: "report", label: "Reports" },
  { id: "files", label: "Files" },
  { id: "integration", label: "Integrations" },
];

/* ---- icons ---------------------------------------------------------------------------------- */

const ICON = {
  sync: "M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5",
  switchClient: "m8 9 4-4 4 4M8 15l4 4 4-4",
  filter: "M4 6h16M7 12h10M10 18h4",
  attach:
    "m20 11.5-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4L15 7",
  mention:
    "M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5ZM14 3.5V8h4",
  note: "M5 5h14v10H9l-4 4V5Z",
  report: "M5 19V11M12 19V5M19 19v-6",
  files: "m12 4 8 4-8 4-8-4 8-4ZM4 12l8 4 8-4M4 16l8 4 8-4",
  chevron: "m6 9 6 6 6-6",
  check: "m5 12 5 5 9-9",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6 6 18",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
} as const;

const rowIcons: Record<CxSettingIcon, string> = {
  sync: ICON.sync,
  mail: ICON.mail,
  report: ICON.report,
  note: ICON.note,
};

const fileTab: Record<CxFileKind, string> = {
  pdf: "#e5484d",
  xlsx: "#1f9d55",
  csv: "#1f9d55",
  doc: "var(--ui-cx-accent)",
};

function CxIcon({ d }: { d: string }) {
  return (
    <svg className="ui-cx__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="ui-cx__icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function StripeMark() {
  return (
    <svg className="ui-cx__stripe" viewBox="0 0 24 24" aria-label="Stripe">
      <rect width="24" height="24" rx="6" fill="#635BFF" />
      <path
        fill="#fff"
        transform="translate(5 5) scale(0.5833)"
        d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z"
      />
    </svg>
  );
}

function FileIcon({ kind }: { kind: CxFileKind }) {
  return (
    <svg className="ui-cx__file-icon" viewBox="0 0 16 18" aria-label={kind.toUpperCase()}>
      <path
        d="M3 1.5h6.5l4 4v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z"
        fill="var(--ui-cx-card)"
        stroke="var(--ui-cx-line-strong)"
      />
      <path d="M9.5 1.5v3a1 1 0 0 0 1 1h3" fill="none" stroke="var(--ui-cx-line-strong)" />
      <rect x="0.5" y="9.5" width="10" height="5" rx="1.5" fill={fileTab[kind]} />
    </svg>
  );
}

function Avatar({ person, size }: { person: CxActor; size: number }) {
  const box: CSSProperties = { width: size, height: size };
  if (person.avatar) {
    return (
      <img
        className="ui-cx__avatar"
        alt=""
        width={size}
        height={size}
        src={person.avatar}
        style={box}
      />
    );
  }
  return (
    <span
      className="ui-cx__avatar ui-cx__avatar--initial"
      style={{ ...box, fontSize: Math.round(size * 0.42) }}
      aria-hidden="true"
    >
      {person.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join("")
        .toUpperCase()}
    </span>
  );
}

/* ---- helpers -------------------------------------------------------------------------------- */

/** The series normalised into the 64 × 24 box the sheet gives the sparkline. */
function sparkline(series: number[]): { line: string; dot: number } {
  const values = series.length > 1 ? series : [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = 2 + (index * 60) / (values.length - 1);
    const y = 21 - ((value - min) / span) * 18;
    return [x, y] as const;
  });
  const line = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  return { line, dot: Math.round(points[points.length - 1][1]) };
}

/** "@Monthly P&L and @Cash runway" → text runs and mentions, in the order they were typed. */
function splitMentions(text: string, names: string[]): CxNotePart[] {
  /* Longest first, so "@Monthly P&L" wins over a report called "Monthly" */
  const ordered = [...names].sort((a, b) => b.length - a.length);
  const parts: CxNotePart[] = [];
  let rest = text;
  for (let guard = 0; rest && guard < 40; guard += 1) {
    /* The earliest mention in what is left, longest name winning a tie */
    let next: { name: string; at: number } | null = null;
    for (const name of ordered) {
      const at = rest.indexOf(`@${name}`);
      if (at < 0) continue;
      if (!next || at < next.at) next = { name, at };
    }
    if (!next) break;
    if (next.at > 0) parts.push({ text: rest.slice(0, next.at) });
    parts.push({ mention: next.name });
    rest = rest.slice(next.at + next.name.length + 1);
  }
  if (rest) parts.push({ text: rest });
  return parts;
}

/** Everything an entry mentions, for the search field. */
function entryText(entry: CxEntry): string {
  switch (entry.kind) {
    case "note":
      return [
        entry.actor.name,
        ...entry.parts.map((part) => ("mention" in part ? part.mention : part.text)),
      ].join(" ");
    case "report":
      return `${entry.actor.name} ${entry.report}`;
    case "files":
      return [entry.actor.name, ...entry.files.map((file) => file.name)].join(" ");
    case "integration":
      return entry.app;
  }
}

function highlight(text: string, query: string): ReactNode {
  const needle = query.trim().toLowerCase();
  if (!needle) return text;
  const at = text.toLowerCase().indexOf(needle);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + needle.length)}</mark>
      {text.slice(at + needle.length)}
    </>
  );
}

function fileKind(name: string): CxFileKind {
  const extension = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  if (extension === "pdf") return "pdf";
  if (extension === "csv") return "csv";
  if (extension === "xlsx" || extension === "xls" || extension === "numbers") return "xlsx";
  return "doc";
}

/* ---- the timeline row ----------------------------------------------------------------------- */

function TimelineItem({
  entry,
  query,
  onOpenReport,
  onRemove,
}: {
  entry: CxEntry;
  query: string;
  onOpenReport: (name: string) => void;
  onRemove?: () => void;
}) {
  const nodeIcon =
    entry.kind === "note"
      ? ICON.note
      : entry.kind === "report"
        ? ICON.report
        : entry.kind === "files"
          ? ICON.files
          : null;

  return (
    <li className="ui-cx__item" data-fresh={entry.fresh ? "" : undefined}>
      <span className="ui-cx__node" data-kind={entry.kind}>
        {entry.kind === "integration" && entry.brand === "stripe" ? (
          <StripeMark />
        ) : nodeIcon ? (
          <CxIcon d={nodeIcon} />
        ) : null}
      </span>
      <div className="ui-cx__body">
        <div className="ui-cx__line">
          {entry.kind === "integration" ? null : <Avatar person={entry.actor} size={20} />}
          {entry.kind === "note" ? (
            <span>
              <strong>{entry.actor.name}</strong> added context
            </span>
          ) : entry.kind === "report" ? (
            <span>
              <strong>{entry.actor.name}</strong> generated{" "}
              <button
                type="button"
                className="ui-cx__ref"
                onClick={() => onOpenReport(entry.report)}
              >
                {highlight(entry.report, query)}
              </button>
            </span>
          ) : entry.kind === "files" ? (
            <span>
              <strong>{entry.actor.name}</strong> added{" "}
              {entry.files.map((file, index) => (
                <span className="ui-cx__file" key={`${file.name}-${index}`}>
                  {index === 0 ? null : index === entry.files.length - 1 ? " and " : ", "}
                  <FileIcon kind={file.kind} />
                  <span className="ui-cx__ref">{highlight(file.name, query)}</span>
                </span>
              ))}
            </span>
          ) : (
            <span>
              Connected <strong>{entry.app}</strong>
            </span>
          )}
          <span className="ui-cx__when">{entry.when}</span>
          {onRemove ? (
            <button type="button" className="ui-cx__remove" aria-label="Remove this entry" onClick={onRemove}>
              <CxIcon d={ICON.close} />
            </button>
          ) : null}
        </div>
        {entry.kind === "note" ? (
          <div className="ui-cx__note">
            {entry.parts.map((part, index) =>
              "mention" in part ? (
                <button
                  type="button"
                  className="ui-cx__mention"
                  key={`mention-${index}`}
                  onClick={() => onOpenReport(part.mention)}
                >
                  <CxIcon d={ICON.mention} />
                  {part.mention}
                </button>
              ) : (
                <span key={`text-${index}`}>{highlight(part.text, query)}</span>
              ),
            )}
          </div>
        ) : null}
      </div>
    </li>
  );
}

/* ---- defaults ------------------------------------------------------------------------------- */

const defaultKpis: CxKpi[] = [
  {
    id: "mrr",
    label: "MRR",
    value: "€48.2k",
    trend: [41.2, 42.3, 41.7, 43.3, 43.9, 43.3, 45, 46.1, 46.6, 48.2],
    color: "#2f6bff",
  },
  {
    id: "cash",
    label: "Cash",
    value: "€612k",
    trend: [612, 597, 597, 568, 553, 568, 524, 509, 495, 480],
    color: "#0ea5e9",
  },
  {
    id: "margin",
    label: "Gross margin",
    value: "64.1%",
    trend: [61, 61.8, 61, 62.6, 61.8, 63.3, 62.6, 63.3, 64.1, 64.1],
    color: "#8b5cf6",
  },
  {
    id: "burn",
    label: "Net burn",
    value: "€36.0k",
    trend: [36, 35.4, 36.2, 34.6, 34, 33.4, 34, 32, 31.4, 30.8],
    color: "#ec4899",
  },
];

const defaultReports: CxReport[] = [
  {
    id: "pl",
    name: "Monthly P&L",
    meta: "Updated yesterday · finance · 12 pages",
    summary:
      "Revenue is up 6.4% on September, carried by the Danish routes. Fuel cost per kilometre fell for the third month in a row, so the gross margin holds at 64%.",
  },
  {
    id: "runway",
    name: "Cash runway",
    meta: "Updated 2 days ago · finance",
    summary:
      "At the current burn the company has 17 months of runway. Collecting the two overdue invoices would add five weeks without new revenue.",
  },
  {
    id: "fleet",
    name: "Fleet cost report",
    meta: "Updated last week · operations",
    summary:
      "Nineteen vehicles are leased on the old contract. Moving the four oldest to the 2027 terms saves roughly €1.8k a month from January.",
  },
];

const defaultTimeline: CxEntry[] = [
  {
    id: "ctx-1",
    kind: "note",
    when: "today",
    actor: { name: "Lena Hart" },
    parts: [
      { text: "CFO wants every figure in the " },
      { mention: "Monthly P&L" },
      { text: " in EUR, also for the Danish entity – no converted totals." },
    ],
  },
  {
    id: "ctx-2",
    kind: "report",
    when: "1d ago",
    actor: { name: "Jonas Weber" },
    report: "Monthly P&L",
  },
  {
    id: "ctx-3",
    kind: "files",
    when: "2d ago",
    actor: { name: "Jonas Weber" },
    files: [
      { name: "budget-2027.pdf", kind: "pdf" },
      { name: "fleet-costs-Q3.xlsx", kind: "xlsx" },
    ],
  },
  {
    id: "ctx-4",
    kind: "note",
    when: "4d ago",
    actor: { name: "Lena Hart" },
    parts: [
      {
        text: "Renewal talks start in November. They'll ask for a lower rate if the Nordics pilot slips – keep the ",
      },
      { mention: "Cash runway" },
      { text: " current." },
    ],
  },
  { id: "ctx-5", kind: "integration", when: "1w ago", app: "Stripe", brand: "stripe" },
];

const defaultFinancials: CxFinancialLine[] = [
  {
    id: "revenue",
    label: "Recurring revenue",
    meta: "Invoiced this month · all entities",
    value: "€48.2k",
    delta: "+6.4%",
    trend: "up",
    series: [41.2, 42.3, 41.7, 43.3, 43.9, 43.3, 45, 46.1, 46.6, 48.2],
    color: "#2f6bff",
    included: true,
  },
  {
    id: "cash",
    label: "Cash and equivalents",
    meta: "Across four accounts",
    value: "€612k",
    delta: "-1.8%",
    trend: "down",
    series: [612, 597, 597, 568, 553, 568, 524, 509, 495, 480],
    color: "#0ea5e9",
    included: true,
  },
  {
    id: "margin",
    label: "Gross margin",
    meta: "Rolling three months",
    value: "64.1%",
    delta: "+1.6 pts",
    trend: "up",
    series: [61, 61.8, 61, 62.6, 61.8, 63.3, 62.6, 63.3, 64.1, 64.1],
    color: "#8b5cf6",
    included: true,
  },
  {
    id: "burn",
    label: "Net burn",
    meta: "Trailing 30 days",
    value: "€36.0k",
    delta: "-4.2%",
    trend: "up",
    series: [36, 35.4, 36.2, 34.6, 34, 33.4, 34, 32, 31.4, 30.8],
    color: "#ec4899",
    included: false,
  },
];

const defaultSettings: CxSettingRow[] = [
  {
    id: "stripe",
    label: "Stripe is connected",
    meta: "Connected 1 March · read-only key",
    on: true,
    icon: "stripe",
  },
  {
    id: "sync",
    label: "Sync Stripe nightly",
    meta: "Invoices, subscriptions and payouts land before 06:00 CET",
    on: true,
    icon: "sync",
  },
  {
    id: "digest",
    label: "Weekly summary email",
    meta: "Every Monday, the open items and the numbers that moved",
    on: true,
    icon: "mail",
  },
  {
    id: "consolidate",
    label: "Roll up subsidiaries in EUR",
    meta: "Danish and Swedish entities convert at the month-end rate",
    on: false,
    icon: "report",
  },
];

const seedClients: CxClient[] = [
  {
    id: "northwind",
    name: "Northwind Logistics",
    meta: "Northwind Logistics GmbH · EUR · Fiscal year ends Dec 31",
    mark: "N",
    color: "#1d4ed8",
    ink: "#ffffff",
    kpis: defaultKpis,
    timeline: defaultTimeline,
    reports: defaultReports,
    financials: defaultFinancials,
    settings: defaultSettings,
  },
];

/* ---- the block ------------------------------------------------------------------------------ */

export function ClientContext({
  clients = seedClients,
  me = { name: "Lena Hart" },
  timeline,
  syncedAt = "3m ago",
  onAddNote,
  onCreateClient,
  onOpenReport,
  className,
}: ClientContextProps) {
  const rawId = useId();
  const base = `ui-cx${rawId.replace(/[^A-Za-z0-9]/g, "_")}`;
  const panelId = `${base}-panel`;
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [tab, setTab] = useState<TabId>("context");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [menu, setMenu] = useState<"client" | "filter" | null>(null);
  const [newClient, setNewClient] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [attached, setAttached] = useState<CxFile[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [stamp, setStamp] = useState(syncedAt);
  const [pressedKpis, setPressedKpis] = useState<string[]>([]);
  const [added, setAdded] = useState<Record<string, CxEntry[]>>({});
  const [openReports, setOpenReports] = useState<Record<string, boolean>>({});
  const [finOn, setFinOn] = useState<Record<string, boolean>>({});
  const [settingsOn, setSettingsOn] = useState<Record<string, boolean>>({});

  const client = clients.find((item) => item.id === clientId) ?? clients[0];
  const activeId = client?.id ?? "";
  const reports = client?.reports ?? [];
  const kpis = client?.kpis ?? [];
  const financials = client?.financials ?? [];
  const settings = client?.settings ?? defaultSettings;

  /* A closed menu closes on any press outside a popover, and on Escape below. */
  useEffect(() => {
    if (!menu) return;
    const close = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".ui-cx__pop")) return;
      setMenu(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);

  useEffect(() => {
    if (!syncing) return;
    const timer = window.setTimeout(() => {
      setSyncing(false);
      setStamp("just now");
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [syncing]);

  const baseEntries = useMemo(
    () => [...(added[activeId] ?? []), ...(timeline ?? client?.timeline ?? [])],
    [added, activeId, timeline, client],
  );

  const counts = useMemo(() => {
    const of = (kind: CxEntry["kind"]) => baseEntries.filter((entry) => entry.kind === kind).length;
    return {
      all: baseEntries.length,
      note: of("note"),
      report: of("report"),
      files: of("files"),
      integration: of("integration"),
    } satisfies Record<FilterId, number>;
  }, [baseEntries]);

  const entries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return baseEntries.filter((entry) => {
      if (filter !== "all" && entry.kind !== filter) return false;
      if (!needle) return true;
      return entryText(entry).toLowerCase().includes(needle);
    });
  }, [baseEntries, filter, query]);

  const filterLabel = filterOptions.find((option) => option.id === filter)?.label ?? "All";
  const tabIndex = tabs.findIndex((item) => item.id === tab);

  /* The trailing "@…" the composer is currently naming, if any */
  const mentionQuery = useMemo(() => {
    const match = /(?:^|\s)@([^@\n]*)$/.exec(draft);
    return match ? match[1] : null;
  }, [draft]);

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const needle = mentionQuery.trim().toLowerCase();
    return reports
      .filter((report) => {
        const name = report.name.toLowerCase();
        if (name === needle) return false;
        return needle === "" || name.startsWith(needle) || name.includes(needle);
      })
      .slice(0, 4);
  }, [mentionQuery, reports]);

  const openReport = (name: string) => {
    const hit = reports.find((report) => report.name.toLowerCase() === name.toLowerCase());
    if (!hit) return;
    setTab("reports");
    setOpenReports((prev) => ({ ...prev, [hit.id]: true }));
    onOpenReport?.(activeId, hit.id);
  };

  const pickMention = (name: string) => {
    setDraft((prev) => {
      const match = /(?:^|\s)@([^@\n]*)$/.exec(prev);
      if (!match) return `${prev}@${name} `;
      const start = match.index + (match[0].startsWith("@") ? 0 : 1);
      return `${prev.slice(0, start)}@${name} `;
    });
    composerRef.current?.focus();
  };

  const attach = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const next = Array.from(list).map((file) => ({ name: file.name, kind: fileKind(file.name) }));
    setAttached((prev) => [...prev, ...next]);
  };

  const submitNote = () => {
    const text = draft.trim();
    const files = attached;
    if (!text && files.length === 0) return;
    const moment = Date.now();
    const actor = { name: me.name, avatar: me.avatar };
    const made: CxEntry[] = [];
    if (text) {
      made.push({
        id: `local-note-${moment}`,
        kind: "note",
        when: "now",
        actor,
        fresh: true,
        parts: splitMentions(text, reports.map((report) => report.name)),
      });
    }
    if (files.length > 0) {
      made.push({
        id: `local-files-${moment}`,
        kind: "files",
        when: "now",
        actor,
        fresh: true,
        files,
      });
    }
    setAdded((prev) => ({ ...prev, [activeId]: [...made, ...(prev[activeId] ?? [])] }));
    setDraft("");
    setAttached([]);
    onAddNote?.(activeId, text, files);
  };

  const onComposerKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      submitNote();
    }
  };

  const createClient = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = (newClient ?? "").trim();
    if (!name) return;
    onCreateClient?.(name);
    setNewClient(null);
    setMenu(null);
  };

  return (
    <section
      className={["ui-cx", className].filter(Boolean).join(" ")}
      onKeyDown={(event) => {
        if (event.key === "Escape") setMenu(null);
      }}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-client-context" precedence="default">
        {css}
      </style>

      <header className="ui-cx__head">
        <div className="ui-cx__who">
          <span
            className="ui-cx__mark"
            aria-hidden="true"
            style={{
              width: 36,
              height: 36,
              background: client?.color ?? "var(--ui-cx-accent)",
              color: client?.ink ?? "var(--ui-cx-btn-text)",
              fontSize: 18,
            }}
          >
            {client?.mark ?? "?"}
          </span>
          <div className="ui-cx__who-text">
            <h2 className="ui-cx__name">{client?.name ?? "No client selected"}</h2>
            <p className="ui-cx__meta">{client?.meta}</p>
          </div>
        </div>
        <div className="ui-cx__actions">
          <button
            type="button"
            className="ui-cx__chip-btn ui-cx__sync"
            aria-label="Sync now"
            onClick={() => setSyncing(true)}
          >
            <span
              className="ui-cx__sync-dot"
              data-state={syncing ? "syncing" : stamp}
              aria-hidden="true"
            />
            <span>{syncing ? "Syncing…" : `Synced ${stamp}`}</span>
            <span className="ui-cx__spin" data-spinning={syncing ? "" : undefined}>
              <CxIcon d={ICON.sync} />
            </span>
          </button>
          <div className="ui-cx__pop" data-cx-menu="">
            <button
              type="button"
              className="ui-cx__chip-btn"
              aria-haspopup="listbox"
              aria-expanded={menu === "client"}
              onClick={() => {
                setMenu(menu === "client" ? null : "client");
                setNewClient(null);
              }}
            >
              Switch client
              <CxIcon d={ICON.switchClient} />
            </button>
            {menu === "client" ? (
              <div className="ui-cx__menu ui-cx__menu--end" role="listbox" aria-label="Clients">
                {clients.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={option.id === activeId}
                    className="ui-cx__menu-item"
                    onClick={() => {
                      setClientId(option.id);
                      setMenu(null);
                    }}
                  >
                    <span className="ui-cx__menu-check">
                      {option.id === activeId ? <CxIcon d={ICON.check} /> : null}
                    </span>
                    <span className="ui-cx__menu-label">{option.name}</span>
                    <span className="ui-cx__menu-count">
                      {(option.timeline ?? []).length + (added[option.id] ?? []).length}
                    </span>
                  </button>
                ))}
                <div className="ui-cx__menu-sep" />
                {newClient === null ? (
                  <button
                    type="button"
                    className="ui-cx__menu-item"
                    onClick={() => setNewClient("")}
                  >
                    <span className="ui-cx__menu-plus">
                      <CxIcon d={ICON.plus} />
                    </span>
                    <span className="ui-cx__menu-label">New client</span>
                  </button>
                ) : (
                  <form className="ui-cx__create" onSubmit={createClient}>
                    <input
                      autoFocus
                      value={newClient}
                      placeholder="Client name"
                      aria-label="Client name"
                      onChange={(event) => setNewClient(event.target.value)}
                    />
                    <button type="submit" className="ui-cx__primary" disabled={!newClient.trim()}>
                      Add
                    </button>
                  </form>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="ui-cx__kpis">
        {kpis.map((kpi, index) => {
          const spark = sparkline(kpi.trend);
          const stroke = kpi.color ?? "var(--ui-cx-accent)";
          return (
            <button
              key={kpi.id}
              type="button"
              className="ui-cx__kpi"
              aria-pressed={pressedKpis.includes(kpi.id)}
              onClick={() =>
                setPressedKpis((prev) =>
                  prev.includes(kpi.id)
                    ? prev.filter((item) => item !== kpi.id)
                    : [...prev, kpi.id],
                )
              }
            >
              <span className="ui-cx__kpi-label">{kpi.label}</span>
              <span className="ui-cx__kpi-row">
                <span className="ui-cx__kpi-value">{kpi.value}</span>
                <svg className="ui-cx__spark" viewBox="0 0 64 24" aria-hidden="true">
                  <path
                    d={spark.line}
                    pathLength={1}
                    stroke={stroke}
                    style={{ animationDelay: `${index * 90}ms` }}
                  />
                  <circle
                    cx={62}
                    cy={spark.dot}
                    r={2.4}
                    fill={stroke}
                    style={{ animationDelay: `${520 + index * 90}ms` }}
                  />
                </svg>
              </span>
            </button>
          );
        })}
      </div>

      <div className="ui-cx__card">
        <div className="ui-cx__toolbar">
          <div
            className="ui-cx__seg"
            role="tablist"
            aria-label="Client sections"
            style={{ "--i": Math.max(tabIndex, 0) } as CSSProperties}
          >
            <span className="ui-cx__seg-thumb" aria-hidden="true" />
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`${base}-tab-${item.id}`}
                aria-controls={panelId}
                aria-selected={tab === item.id}
                onClick={() => {
                  setTab(item.id);
                  setMenu(null);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="ui-cx__tools">
            <label className="ui-cx__search">
              <SearchIcon />
              <input
                placeholder="Search"
                aria-label="Search context"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  /* The feed is what the field filters */
                  if (event.target.value) setTab("context");
                }}
              />
              {query ? (
                <button
                  type="button"
                  className="ui-cx__clear"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                >
                  <CxIcon d={ICON.close} />
                </button>
              ) : null}
            </label>
            <div className="ui-cx__pop" data-cx-menu="">
              <button
                type="button"
                className="ui-cx__chip-btn"
                aria-haspopup="listbox"
                aria-expanded={menu === "filter"}
                data-active={filter !== "all" ? "" : undefined}
                onClick={() => setMenu(menu === "filter" ? null : "filter")}
              >
                <CxIcon d={ICON.filter} />
                {filterLabel}
              </button>
              {menu === "filter" ? (
                <div
                  className="ui-cx__menu ui-cx__menu--end"
                  role="listbox"
                  aria-label="Filter context"
                >
                  {filterOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="option"
                      aria-selected={filter === option.id}
                      className="ui-cx__menu-item"
                      onClick={() => {
                        setFilter(option.id);
                        setMenu(null);
                      }}
                    >
                      <span className="ui-cx__menu-check">
                        {filter === option.id ? <CxIcon d={ICON.check} /> : null}
                      </span>
                      <span className="ui-cx__menu-label">{option.label}</span>
                      <span className="ui-cx__menu-count">{counts[option.id]}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className="ui-cx__panel"
          id={panelId}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${tab}`}
        >
          {tab === "context" ? (
            <>
              <div className="ui-cx__compose">
                <Avatar person={me} size={28} />
                <div className="ui-cx__composer">
                  <textarea
                    ref={composerRef}
                    rows={2}
                    placeholder="Add a goal, request or decision – type @ to mention a report"
                    aria-label="New context"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={onComposerKey}
                  />
                  {attached.length > 0 ? (
                    <div className="ui-cx__attached">
                      {attached.map((file, index) => (
                        <span className="ui-cx__file-chip" key={`${file.name}-${index}`}>
                          <FileIcon kind={file.kind} />
                          <span>{file.name}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${file.name}`}
                            onClick={() =>
                              setAttached((prev) => prev.filter((_, at) => at !== index))
                            }
                          >
                            <CxIcon d={ICON.close} />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {suggestions.length > 0 ? (
                    <div className="ui-cx__suggest">
                      {suggestions.map((report) => (
                        <button
                          key={report.id}
                          type="button"
                          className="ui-cx__menu-item"
                          onClick={() => pickMention(report.name)}
                        >
                          <CxIcon d={ICON.mention} />
                          <span className="ui-cx__menu-label">{report.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="ui-cx__composer-bar">
                    <button
                      type="button"
                      className="ui-cx__icon-btn"
                      aria-label="Attach a file"
                      onClick={() => fileRef.current?.click()}
                    >
                      <CxIcon d={ICON.attach} />
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      multiple
                      hidden
                      onChange={(event) => {
                        attach(event.target.files);
                        event.target.value = "";
                      }}
                    />
                    <span className="ui-cx__hint" aria-hidden="true">
                      <kbd>⌘</kbd>
                      <kbd>Enter</kbd>
                    </span>
                    <button
                      type="button"
                      className="ui-cx__primary"
                      disabled={!draft.trim() && attached.length === 0}
                      onClick={submitNote}
                    >
                      Add context
                    </button>
                  </div>
                </div>
              </div>

              {entries.length > 0 ? (
                <ol className="ui-cx__timeline">
                  {entries.map((entry) => (
                    <TimelineItem
                      key={entry.id}
                      entry={entry}
                      query={query}
                      onOpenReport={openReport}
                      onRemove={
                        entry.fresh
                          ? () =>
                              setAdded((prev) => ({
                                ...prev,
                                [activeId]: (prev[activeId] ?? []).filter(
                                  (item) => item.id !== entry.id,
                                ),
                              }))
                          : undefined
                      }
                    />
                  ))}
                </ol>
              ) : (
                <div className="ui-cx__empty">
                  {query.trim() || filter !== "all" ? (
                    <>
                      {query.trim()
                        ? `Nothing ${filter === "all" ? "on this client" : `in ${filterLabel.toLowerCase()}`} matches “${query.trim()}”. `
                        : `There are no ${filterLabel.toLowerCase()} on this client. `}
                      <button
                        type="button"
                        onClick={() => {
                          setQuery("");
                          setFilter("all");
                        }}
                      >
                        Clear the filter
                      </button>
                    </>
                  ) : (
                    <>
                      Nothing on this client yet.{" "}
                      <button type="button" onClick={() => composerRef.current?.focus()}>
                        Write the first note
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          ) : tab === "reports" ? (
            reports.length > 0 ? (
              <ul className="ui-cx__list">
                {reports.map((report) => {
                  const open = openReports[report.id] ?? report.open ?? false;
                  return (
                    <li
                      key={report.id}
                      className="ui-cx__report"
                      data-open={open ? "" : undefined}
                    >
                      <button
                        type="button"
                        className="ui-cx__report-head"
                        aria-expanded={open}
                        onClick={() =>
                          setOpenReports((prev) => ({ ...prev, [report.id]: !open }))
                        }
                      >
                        <span className="ui-cx__row-icon">
                          <CxIcon d={ICON.report} />
                        </span>
                        <span className="ui-cx__row-main">
                          <strong>{report.name}</strong>
                          <span>{report.meta}</span>
                        </span>
                        <span className="ui-cx__chevron">
                          <CxIcon d={ICON.chevron} />
                        </span>
                      </button>
                      <div className="ui-cx__report-body">
                        <div>
                          {report.summary ? <p>{report.summary}</p> : null}
                          <div className="ui-cx__report-actions">
                            <button
                              type="button"
                              className="ui-cx__chip-btn"
                              onClick={() => onOpenReport?.(activeId, report.id)}
                            >
                              Open report
                            </button>
                            <button
                              type="button"
                              className="ui-cx__chip-btn"
                              onClick={() => pickMention(report.name)}
                            >
                              Mention in a note
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="ui-cx__empty ui-cx__empty--flush">
                No reports for this client yet.
              </div>
            )
          ) : tab === "financials" ? (
            financials.length > 0 ? (
              <ul className="ui-cx__list">
                {financials.map((line) => {
                  const on = finOn[line.id] ?? line.included ?? false;
                  const spark = sparkline(line.series);
                  const stroke = line.color ?? "var(--ui-cx-accent)";
                  return (
                    <li key={line.id} className="ui-cx__fin" data-active={on ? "" : undefined}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => setFinOn((prev) => ({ ...prev, [line.id]: !on }))}
                      >
                        <span className="ui-cx__fin-dot" style={{ background: stroke }} />
                        <span className="ui-cx__row-main">
                          <strong>{line.label}</strong>
                          <span>{line.meta}</span>
                        </span>
                        <svg className="ui-cx__spark" viewBox="0 0 64 24" aria-hidden="true">
                          <path d={spark.line} pathLength={1} stroke={stroke} />
                          <circle cx={62} cy={spark.dot} r={2.4} fill={stroke} />
                        </svg>
                        <span className="ui-cx__fin-value">
                          <strong>{line.value}</strong>
                          <span data-trend={line.trend}>{line.delta}</span>
                        </span>
                        <span className="ui-cx__toggle" aria-checked={on} aria-hidden="true">
                          <span />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="ui-cx__empty ui-cx__empty--flush">
                No figures are tracked for this client yet.
              </div>
            )
          ) : (
            <ul className="ui-cx__list">
              {settings.map((row) => {
                const on = settingsOn[row.id] ?? row.on ?? false;
                return (
                  <li key={row.id} className="ui-cx__row">
                    {row.icon === "stripe" ? (
                      <span className="ui-cx__app">
                        <StripeMark />
                      </span>
                    ) : (
                      <span className="ui-cx__row-icon">
                        <CxIcon d={rowIcons[row.icon ?? "report"]} />
                      </span>
                    )}
                    <span className="ui-cx__row-main">
                      <strong>{row.label}</strong>
                      <span>{row.meta}</span>
                    </span>
                    <button
                      type="button"
                      className="ui-cx__toggle"
                      role="switch"
                      aria-checked={on}
                      aria-label={row.label}
                      onClick={() => setSettingsOn((prev) => ({ ...prev, [row.id]: !on }))}
                    >
                      <span />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

const css = /* css */ `
.ui-cx{--ui-cx-tray: #eee6de;--ui-cx-card: #fffdfb;--ui-cx-card-line: #ded4ca;--ui-cx-line: #eae2d9;--ui-cx-line-strong: #d0c4ba;--ui-cx-inset: #f5efe8;--ui-cx-ink: #1c1713;--ui-cx-text: #3d3226;--ui-cx-muted: #857567;--ui-cx-accent: #ff6b35;--ui-cx-good: #1a7a4a;--ui-cx-bad: #b3261e;--ui-cx-mark: rgba(255, 107, 53, 0.16);--ui-cx-hover: rgba(11, 9, 8, 0.04);--ui-cx-track: rgba(11, 9, 8, 0.05);--ui-cx-thumb: #fffdfb;--ui-cx-btn-top: #342a20;--ui-cx-btn-bottom: #241e19;--ui-cx-btn-ring: #14100d;--ui-cx-btn-text: #fffdfb;--ui-cx-shadow: 0 1px 2px rgba(11, 9, 8, 0.06);--ui-cx-pop: 0 0 0 1px rgba(11, 9, 8, 0.06), 0 12px 32px rgba(11, 9, 8, 0.1);--ui-cx-ease: cubic-bezier(0.65, 0, 0.25, 1);--ui-cx-out: cubic-bezier(0.22, 1, 0.36, 1);--ui-cx-spring: cubic-bezier(0.34, 1.3, 0.64, 1);container-type: inline-size;width: 100%;max-width: 900px;padding: 0 6px 6px;border-radius: 24px;background: var(--ui-cx-tray);font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;color: var(--ui-cx-ink);-webkit-font-smoothing: antialiased}
.ui-cx *, .ui-cx *::before, .ui-cx *::after{box-sizing: border-box}
.ui-cx :where(button){margin: 0;font: inherit;color: inherit}
.ui-cx :where(p, h2, h3, ol, ul){margin: 0}
.ui-cx :where(ol, ul){padding: 0;list-style: none}
.ui-cx mark{border-radius: 3px;background: var(--ui-cx-mark);color: inherit}
.ui-cx__icon{width: 15px;height: 15px;flex: none;fill: none;stroke: currentColor;stroke-width: 1.7;stroke-linecap: round;stroke-linejoin: round}
.ui-cx__head{display: flex;align-items: center;justify-content: space-between;gap: 16px;padding: 16px 10px 14px 12px}
.ui-cx__who{display: flex;align-items: center;gap: 12px;min-width: 0;animation: ui-cx-in var(--nm-dur-4, 380ms) var(--ui-cx-out)}
.ui-cx__who-text{display: grid;gap: 2px;min-width: 0}
.ui-cx__name{font-size: 15px;font-weight: 600;letter-spacing: -0.01em}
.ui-cx__meta{font-size: 12.5px;color: var(--ui-cx-muted);white-space: nowrap;overflow: hidden;text-overflow: ellipsis}
.ui-cx__mark{display: grid;place-items: center;flex: none;border-radius: 30%;font-weight: 650;line-height: 1;box-shadow: inset 0 0 0 1px rgba(11, 9, 8, 0.08)}
.ui-cx__actions{display: flex;align-items: center;gap: 8px;flex: none}
.ui-cx__chip-btn{display: inline-flex;align-items: center;gap: 7px;height: 34px;padding: 0 12px;border: 0;border-radius: 10px;background: var(--ui-cx-card);box-shadow: 0 0 0 1px var(--ui-cx-card-line), var(--ui-cx-shadow);font-size: 12.5px;font-weight: 500;white-space: nowrap;cursor: pointer;transition: background 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cx__chip-btn:hover:not(:disabled){background: var(--ui-cx-inset)}
.ui-cx__chip-btn:active:not(:disabled){transform: scale(0.97)}
.ui-cx__chip-btn:disabled{opacity: 0.6;cursor: default}
.ui-cx__chip-btn[data-active]{box-shadow: 0 0 0 1px var(--ui-cx-accent), var(--ui-cx-shadow);color: var(--ui-cx-accent)}
.ui-cx__chip-btn > .ui-cx__icon:last-child:not(:first-child){color: var(--ui-cx-muted)}
.ui-cx__sync{gap: 8px;color: var(--ui-cx-text)}
.ui-cx__sync-dot{width: 7px;height: 7px;border-radius: 50%;background: #2f8d5c;box-shadow: 0 0 0 3px rgba(47, 141, 92, 0.16);transition: background var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cx__sync-dot[data-state="syncing"]{background: #d99530;box-shadow: 0 0 0 3px rgba(217, 149, 48, 0.18)}
.ui-cx__spin{display: grid;color: var(--ui-cx-muted)}
.ui-cx__spin[data-spinning] .ui-cx__icon{animation: ui-cx-spin var(--nm-dur-6, 1100ms) linear infinite}
@keyframes ui-cx-spin{to{transform: rotate(360deg)}
}
.ui-cx__pop{position: relative}
.ui-cx__menu{position: absolute;left: 0;top: calc(100% + 6px);z-index: 5;min-width: 230px;padding: 5px;border-radius: 14px;background: var(--ui-cx-card);box-shadow: var(--ui-cx-pop);transform-origin: top left;animation: ui-cx-pop var(--nm-dur-2, 160ms) var(--ui-cx-out)}
.ui-cx__menu--end{left: auto;right: 0;transform-origin: top right}
@keyframes ui-cx-pop{from{opacity: 0;transform: translateY(-4px) scale(0.97)}
}
.ui-cx__menu-item{display: flex;align-items: center;gap: 10px;width: 100%;height: 36px;padding: 0 10px 0 8px;border: 0;border-radius: 9px;background: transparent;text-align: left;cursor: pointer}
.ui-cx__menu-item:hover, .ui-cx__menu-item[aria-selected="true"]{background: var(--ui-cx-hover)}
.ui-cx__menu-label{flex: 1;min-width: 0;white-space: nowrap;overflow: hidden;text-overflow: ellipsis}
.ui-cx__menu-item > .ui-cx__icon{color: var(--ui-cx-muted)}
.ui-cx__menu-count{color: var(--ui-cx-muted);font-variant-numeric: tabular-nums}
.ui-cx__menu-check{display: grid;width: 15px;color: var(--ui-cx-accent)}
.ui-cx__menu-sep{height: 1px;margin: 5px 4px;background: var(--ui-cx-line)}
.ui-cx__menu-plus{display: grid;place-items: center;width: 20px;height: 20px;border-radius: 6px;background: var(--ui-cx-inset);box-shadow: inset 0 0 0 1px var(--ui-cx-line);color: var(--ui-cx-text)}
.ui-cx__menu-plus .ui-cx__icon{width: 12px;height: 12px}
.ui-cx__create{display: flex;gap: 6px;padding: 3px}
.ui-cx__create input{flex: 1;min-width: 0;height: 32px;padding: 0 10px;border: 0;border-radius: 8px;outline: none;background: var(--ui-cx-inset);box-shadow: inset 0 0 0 1px var(--ui-cx-line);color: var(--ui-cx-ink);font: inherit}
.ui-cx__create input:focus{box-shadow: inset 0 0 0 1px var(--ui-cx-muted)}
.ui-cx__kpis{display: grid;grid-template-columns: repeat(4, minmax(0, 1fr));gap: 6px;margin-bottom: 6px}
.ui-cx__kpi{display: grid;gap: 10px;min-width: 0;padding: 14px 16px;border: 0;border-radius: 16px;background: var(--ui-cx-card);box-shadow: 0 0 0 1px var(--ui-cx-card-line), var(--ui-cx-shadow);text-align: left;cursor: pointer;transition: box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));animation: ui-cx-in var(--nm-dur-4, 380ms) var(--ui-cx-out) both}
.ui-cx__kpi:nth-child(2){animation-delay: 40ms}
.ui-cx__kpi:nth-child(3){animation-delay: 80ms}
.ui-cx__kpi:nth-child(4){animation-delay: 120ms}
.ui-cx__kpi:hover{box-shadow: 0 0 0 1px var(--ui-cx-line-strong), var(--ui-cx-shadow)}
.ui-cx__kpi:active{transform: scale(0.98)}
.ui-cx__kpi[aria-pressed="true"]{box-shadow: 0 0 0 1.5px var(--ui-cx-accent), var(--ui-cx-shadow)}
.ui-cx__kpi-label{font-size: 12.5px;color: var(--ui-cx-text)}
.ui-cx__kpi-row{display: flex;align-items: flex-end;justify-content: space-between;gap: 8px}
.ui-cx__kpi-value{font-size: 20px;font-weight: 600;letter-spacing: -0.02em;line-height: 1.1;font-variant-numeric: tabular-nums;white-space: nowrap}
.ui-cx__spark{flex: none;width: 56px;height: 22px;overflow: visible}
.ui-cx__spark[data-wide]{width: 84px}
.ui-cx__spark path{fill: none;stroke-width: 1.6;stroke-linecap: round;stroke-linejoin: round;vector-effect: non-scaling-stroke;stroke-dasharray: 1;stroke-dashoffset: 1;animation: ui-cx-draw var(--nm-dur-5, 620ms) var(--ui-cx-out) forwards}
.ui-cx__spark circle{opacity: 0;animation: ui-cx-fade 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) forwards}
@keyframes ui-cx-draw{to{stroke-dashoffset: 0}
}
@keyframes ui-cx-fade{to{opacity: 1}
}
@keyframes ui-cx-in{from{opacity: 0;transform: translateY(6px)}
}
.ui-cx__card{border-radius: 20px;background: var(--ui-cx-card);box-shadow: 0 0 0 1px var(--ui-cx-card-line), var(--ui-cx-shadow)}
.ui-cx__toolbar{display: flex;align-items: center;justify-content: space-between;gap: 12px;padding: 12px 14px;border-bottom: 1px solid var(--ui-cx-line)}
.ui-cx__seg{position: relative;display: grid;grid-template-columns: repeat(4, 84px);padding: 3px;border-radius: 10px;background: var(--ui-cx-track)}
.ui-cx__seg-thumb{position: absolute;top: 3px;left: 3px;width: 84px;height: calc(100% - 6px);border-radius: 7px;background: var(--ui-cx-thumb);box-shadow: 0 1px 2px rgba(11, 9, 8, 0.08), 0 0 0 1px rgba(11, 9, 8, 0.04);transform: translateX(calc(var(--i, 0) * 100%));transition: transform var(--nm-dur-4, 380ms) var(--ui-cx-spring)}
.ui-cx__seg button{position: relative;height: 28px;padding: 0;border: 0;border-radius: 7px;background: none;font-size: 12.5px;font-weight: 500;color: var(--ui-cx-muted) !important;cursor: pointer;transition: color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cx__seg button[aria-selected="true"]{color: var(--ui-cx-ink) !important}
.ui-cx__tools{display: flex;align-items: center;gap: 8px}
.ui-cx__search{display: flex;align-items: center;gap: 8px;width: 220px;height: 34px;padding: 0 8px 0 11px;border-radius: 10px;background: var(--ui-cx-inset);box-shadow: inset 0 0 0 1px var(--ui-cx-line);color: var(--ui-cx-muted);transition: box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cx__search:focus-within{background: var(--ui-cx-card);box-shadow: inset 0 0 0 1px var(--ui-cx-muted)}
.ui-cx__search input{flex: 1;min-width: 0;height: 100%;border: 0;outline: none;background: transparent;color: var(--ui-cx-ink);font: inherit}
.ui-cx__search input::placeholder{color: var(--ui-cx-muted)}
.ui-cx__clear{display: grid;place-items: center;width: 20px;height: 20px;padding: 0;border: 0;border-radius: 6px;background: transparent;color: var(--ui-cx-muted);cursor: pointer}
.ui-cx__clear:hover{background: var(--ui-cx-hover);color: var(--ui-cx-ink)}
.ui-cx__clear .ui-cx__icon{width: 12px;height: 12px}
.ui-cx__panel{padding: 22px 24px 26px;animation: ui-cx-in var(--nm-dur-3, 240ms) var(--ui-cx-out)}
.ui-cx__compose{display: grid;grid-template-columns: 28px minmax(0, 1fr);gap: 14px;align-items: start}
.ui-cx__compose > .ui-cx__avatar{margin-top: 6px}
.ui-cx__composer{position: relative;border-radius: 14px;background: var(--ui-cx-card);box-shadow: 0 0 0 1px var(--ui-cx-card-line), var(--ui-cx-shadow);transition: box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cx__composer:focus-within{box-shadow: 0 0 0 1px var(--ui-cx-muted), var(--ui-cx-shadow)}
.ui-cx__composer textarea{display: block;width: 100%;min-height: 62px;max-height: 180px;padding: 12px 14px 4px;border: 0;outline: none;resize: none;background: transparent;color: var(--ui-cx-ink);font: inherit;line-height: 1.55;field-sizing: content}
.ui-cx__composer textarea::placeholder{color: var(--ui-cx-muted)}
.ui-cx__suggest{position: absolute;left: 10px;top: calc(100% - 40px);z-index: 4;min-width: 220px;padding: 5px;border-radius: 12px;background: var(--ui-cx-card);box-shadow: var(--ui-cx-pop);animation: ui-cx-pop 160ms var(--ui-cx-out)}
.ui-cx__attached{display: flex;flex-wrap: wrap;gap: 6px;padding: 6px 14px 2px}
.ui-cx__file-chip{display: inline-flex;align-items: center;gap: 6px;height: 28px;padding: 0 4px 0 8px;border-radius: 8px;background: var(--ui-cx-inset);box-shadow: inset 0 0 0 1px var(--ui-cx-line);color: var(--ui-cx-text);font-size: 12px;animation: ui-cx-pop var(--nm-dur-2, 160ms) var(--ui-cx-out)}
.ui-cx__file-chip button{display: grid;place-items: center;width: 20px;height: 20px;padding: 0;border: 0;border-radius: 6px;background: transparent;color: var(--ui-cx-muted);cursor: pointer}
.ui-cx__file-chip button:hover{background: var(--ui-cx-hover);color: var(--ui-cx-ink)}
.ui-cx__file-chip .ui-cx__icon{width: 12px;height: 12px}
.ui-cx__file-chip .ui-cx__file-icon{margin: 0}
.ui-cx__composer-bar{display: flex;align-items: center;gap: 8px;padding: 8px 10px 10px}
.ui-cx__icon-btn{display: grid;place-items: center;width: 30px;height: 30px;padding: 0;border: 0;border-radius: 8px;background: transparent;color: var(--ui-cx-muted);cursor: pointer;transition: background 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cx__icon-btn:hover:not(:disabled){background: var(--ui-cx-hover);color: var(--ui-cx-ink)}
.ui-cx__icon-btn:disabled{opacity: 0.4;cursor: default}
.ui-cx__hint{display: inline-flex;gap: 3px;margin-left: auto}
.ui-cx__hint kbd{display: grid;place-items: center;min-width: 20px;height: 20px;padding: 0 5px;border-radius: 5px;background: var(--ui-cx-inset);box-shadow: inset 0 0 0 1px var(--ui-cx-line);color: var(--ui-cx-muted);font-family: inherit;font-size: 11px;font-weight: 500}
.ui-cx__primary{height: 32px;padding: 0 14px;border: 0;border-radius: 9px;background: linear-gradient(var(--ui-cx-btn-top), var(--ui-cx-btn-bottom));box-shadow: 0 0 0 1px var(--ui-cx-btn-ring), inset 0 1px 0 rgba(255, 253, 251, 0.14);color: var(--ui-cx-btn-text) !important;font-size: 12.5px;font-weight: 500;white-space: nowrap;cursor: pointer;transition: opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cx__primary:active:not(:disabled){transform: scale(0.97)}
.ui-cx__primary:disabled{opacity: 0.35;cursor: default}
.ui-cx__timeline{position: relative;margin-top: 28px}
.ui-cx__timeline::before{content: "";position: absolute;left: 13.5px;top: 14px;bottom: 14px;width: 1px;background: var(--ui-cx-line)}
.ui-cx__item{position: relative;display: grid;grid-template-columns: 28px minmax(0, 1fr);gap: 14px;padding-bottom: 26px}
.ui-cx__item:last-child{padding-bottom: 0}
.ui-cx__item[data-fresh]{animation: ui-cx-new var(--nm-dur-5, 620ms) var(--ui-cx-out)}
@keyframes ui-cx-new{from{opacity: 0;transform: translateY(-8px)}
}
.ui-cx__node{position: relative;z-index: 1;display: grid;place-items: center;width: 28px;height: 28px;border-radius: 50%;background: var(--ui-cx-card);box-shadow: 0 0 0 1px var(--ui-cx-line-strong), 0 0 0 5px var(--ui-cx-card);color: var(--ui-cx-muted)}
.ui-cx__node .ui-cx__icon{width: 13px;height: 13px}
.ui-cx__node[data-kind="integration"]{background: transparent;box-shadow: 0 0 0 5px var(--ui-cx-card)}
.ui-cx__stripe{display: block;width: 26px;height: 26px}
.ui-cx__body{min-width: 0;padding-top: 4px}
.ui-cx__line{display: flex;align-items: flex-start;gap: 8px;min-height: 20px;color: var(--ui-cx-text);line-height: 20px}
.ui-cx__line > .ui-cx__avatar{margin-top: 0}
.ui-cx__line > span:not(.ui-cx__when){flex: 0 1 auto;min-width: 0}
.ui-cx__line strong{color: var(--ui-cx-ink);font-weight: 500}
.ui-cx__when{flex: none;color: var(--ui-cx-muted);white-space: nowrap}
.ui-cx__when::before{content: "·";margin-right: 8px}
.ui-cx__ref{display: inline;padding: 0;border: 0;background: none;color: var(--ui-cx-ink);font-weight: 500;text-decoration: underline;text-decoration-color: var(--ui-cx-line-strong);text-underline-offset: 3px;transition: text-decoration-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
button.ui-cx__ref{cursor: pointer}
button.ui-cx__ref:hover{text-decoration-color: currentColor}
.ui-cx__file{white-space: nowrap}
.ui-cx__file-icon{display: inline-block;width: 12px;height: 14px;margin: 0 4px 0 2px;vertical-align: -2px}
.ui-cx__remove{display: grid;place-items: center;flex: none;width: 22px;height: 22px;margin: -1px 0 0 auto;padding: 0;border: 0;border-radius: 6px;background: transparent;color: var(--ui-cx-muted);opacity: 0;cursor: pointer;transition: opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cx__item:hover .ui-cx__remove, .ui-cx__remove:focus-visible{opacity: 1}
.ui-cx__remove:hover{background: var(--ui-cx-hover);color: var(--ui-cx-bad)}
.ui-cx__remove .ui-cx__icon{width: 13px;height: 13px}
.ui-cx__note{margin-top: 10px;padding: 12px 14px;border-radius: 12px;background: var(--ui-cx-inset);box-shadow: inset 0 0 0 1px var(--ui-cx-line);color: var(--ui-cx-text);line-height: 1.6}
.ui-cx__mention{display: inline-flex;align-items: center;gap: 4px;margin: 0 1px;padding: 0 6px 0 5px;border: 0;border-radius: 6px;background: color-mix(in srgb, var(--ui-cx-accent) 10%, transparent);color: var(--ui-cx-accent) !important;font-weight: 500;line-height: 20px;vertical-align: -1px;white-space: nowrap;cursor: pointer;transition: background 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cx__mention:hover{background: color-mix(in srgb, var(--ui-cx-accent) 16%, transparent)}
.ui-cx__mention .ui-cx__icon{width: 12px;height: 12px}
.ui-cx__avatar{display: block;flex: none;border-radius: 50%;object-fit: cover}
.ui-cx__avatar--initial{display: grid;place-items: center;background: var(--ui-cx-inset);color: var(--ui-cx-text);font-weight: 600}
.ui-cx__empty{margin-top: 28px;padding: 22px;border-radius: 14px;background: var(--ui-cx-inset);color: var(--ui-cx-muted);text-align: center}
.ui-cx__empty--flush{margin-top: 0}
.ui-cx__empty button{padding: 0;border: 0;background: none;color: var(--ui-cx-ink);font-weight: 500;text-decoration: underline;text-underline-offset: 3px;cursor: pointer}
.ui-cx__list{overflow: hidden;border-radius: 14px;box-shadow: 0 0 0 1px var(--ui-cx-line)}
.ui-cx__list > li + li{border-top: 1px solid var(--ui-cx-line)}
.ui-cx__row{display: flex;align-items: center;gap: 14px;min-height: 66px;padding: 12px 16px}
.ui-cx__row-main{display: grid;gap: 3px;flex: 1;min-width: 0;text-align: left}
.ui-cx__row-main strong{font-weight: 500;color: var(--ui-cx-ink)}
.ui-cx__row-main span{color: var(--ui-cx-muted);font-size: 12.5px}
.ui-cx__row-icon{display: grid;place-items: center;flex: none;width: 32px;height: 32px;border-radius: 9px;background: var(--ui-cx-inset);box-shadow: inset 0 0 0 1px var(--ui-cx-line);color: var(--ui-cx-muted)}
.ui-cx__app{display: grid;flex: none}
.ui-cx__app .ui-cx__stripe{width: 32px;height: 32px}
.ui-cx__report-head{display: flex;align-items: center;gap: 14px;width: 100%;min-height: 66px;padding: 12px 16px;border: 0;background: transparent;cursor: pointer;transition: background 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cx__report-head:hover{background: var(--ui-cx-hover)}
.ui-cx__chevron{display: grid;color: var(--ui-cx-muted);transition: transform var(--nm-dur-3, 240ms) var(--ui-cx-ease)}
.ui-cx__report[data-open] .ui-cx__chevron{transform: rotate(180deg)}
.ui-cx__report-body{display: grid;grid-template-rows: 0fr;transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-cx-ease)}
.ui-cx__report[data-open] .ui-cx__report-body{grid-template-rows: 1fr}
.ui-cx__report-body > div{overflow: hidden;padding: 0 16px 0 62px}
.ui-cx__report-body p{color: var(--ui-cx-text);line-height: 1.6}
.ui-cx__report-actions{display: flex;flex-wrap: wrap;gap: 8px;padding: 14px 0 18px}
.ui-cx__fin button{display: flex;align-items: center;gap: 14px;width: 100%;min-height: 66px;padding: 12px 16px;border: 0;background: transparent;cursor: pointer;transition: background var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cx__fin button:hover{background: var(--ui-cx-hover)}
.ui-cx__fin[data-active] button{background: color-mix(in srgb, var(--ui-cx-accent) 6%, transparent)}
.ui-cx__fin-dot{flex: none;width: 8px;height: 8px;border-radius: 50%}
.ui-cx__fin-value{display: grid;justify-items: end;gap: 3px;min-width: 84px}
.ui-cx__fin-value strong{font-size: 14px;font-weight: 600;font-variant-numeric: tabular-nums}
.ui-cx__fin-value span{font-size: 12px;font-weight: 500;font-variant-numeric: tabular-nums}
.ui-cx__fin-value [data-trend="up"]{color: var(--ui-cx-good)}
.ui-cx__fin-value [data-trend="down"]{color: var(--ui-cx-bad)}
.ui-cx__toggle{position: relative;flex: none;width: 36px;height: 22px;padding: 0;border: 0;border-radius: 999px;background: var(--ui-cx-line-strong);cursor: pointer;transition: background var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cx__toggle span{position: absolute;left: 2px;top: 2px;width: 18px;height: 18px;border-radius: 50%;background: #fffdfb;box-shadow: 0 1px 2px rgba(11, 9, 8, 0.2);transition: transform var(--nm-dur-3, 240ms) var(--ui-cx-spring)}
.ui-cx__toggle[aria-checked="true"]{background: var(--ui-cx-accent)}
.ui-cx__toggle[aria-checked="true"] span{transform: translateX(14px)}
.ui-cx button:focus-visible, .ui-cx textarea:focus-visible, .ui-cx input:focus-visible{outline: 2px solid var(--ui-cx-accent);outline-offset: 2px}
@container (max-width: 680px){.ui-cx__head{flex-wrap: wrap}
.ui-cx__actions{width: 100%}
.ui-cx__actions > .ui-cx__pop{margin-left: auto}
.ui-cx__kpis{grid-template-columns: repeat(2, minmax(0, 1fr))}
.ui-cx__toolbar{flex-direction: column;align-items: stretch}
.ui-cx__seg{grid-template-columns: repeat(4, minmax(0, 1fr))}
.ui-cx__seg-thumb{width: calc((100% - 6px) / 4)}
.ui-cx__tools{width: 100%}
.ui-cx__search{flex: 1;width: auto}
.ui-cx__panel{padding: 18px 16px 20px}
.ui-cx__hint{display: none}
.ui-cx__composer-bar .ui-cx__primary{margin-left: auto}
.ui-cx__fin .ui-cx__spark{display: none}
.ui-cx__report-body > div{padding-left: 16px}
.ui-cx__line{flex-wrap: wrap;row-gap: 2px}
.ui-cx__line > span:not(.ui-cx__when){flex: 1 1 calc(100% - 28px)}
.ui-cx__when{order: 3;margin-left: 28px}
.ui-cx__when::before{content: none}
.ui-cx__file{white-space: normal}
}
@media (prefers-reduced-motion: reduce){.ui-cx *, .ui-cx *::before, .ui-cx *::after{animation-duration: 1ms !important;transition-duration: 1ms !important}
}
.ui-cx input:not([type="checkbox"]):not([type="radio"]):focus-visible, .ui-cx textarea:focus-visible, .ui-cx [contenteditable]:focus-visible{outline: none}
:where(.dark, [data-theme="dark"]) .ui-cx{--ui-cx-tray: #1c1713;--ui-cx-card: #27201a;--ui-cx-card-line: rgba(255, 253, 251, 0.08);--ui-cx-line: rgba(255, 253, 251, 0.07);--ui-cx-line-strong: rgba(255, 253, 251, 0.14);--ui-cx-inset: #211b16;--ui-cx-ink: #ebe3da;--ui-cx-text: #b4a89d;--ui-cx-muted: #857567;--ui-cx-accent: #ff8a5c;--ui-cx-good: #4f9d6e;--ui-cx-bad: #e2544a;--ui-cx-mark: rgba(255, 138, 92, 0.28);--ui-cx-hover: rgba(255, 253, 251, 0.05);--ui-cx-track: rgba(255, 253, 251, 0.06);--ui-cx-thumb: #33291f;--ui-cx-btn-top: #f4ece4;--ui-cx-btn-bottom: #dfd5cc;--ui-cx-btn-ring: rgba(11, 9, 8, 0.6);--ui-cx-btn-text: #191411;--ui-cx-shadow: 0 1px 2px rgba(11, 9, 8, 0.4);--ui-cx-pop: 0 0 0 1px rgba(255, 253, 251, 0.06), 0 16px 40px rgba(11, 9, 8, 0.5)}
:where(.dark, [data-theme="dark"]) .ui-cx__toggle span{background: #ebe3da}
:where(.dark, [data-theme="dark"]) .ui-cx__mark{box-shadow: inset 0 0 0 1px rgba(255, 253, 251, 0.1)}

`;
