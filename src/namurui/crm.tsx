"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

/*
 * Company CRM – the sales pipeline screen, in a single self-contained file.
 *
 * It sits inside the app shell: records and pipelines in the sidebar, a strip of open views as
 * tabs, and the companies card. Views close from the All views menu or with Alt-click on their
 * tab, and New view opens another; a view can list its rows in the table or group them by stage
 * as a pipeline board with a count and a total per column.
 * Double-click a cell to edit it in place – Enter saves and steps down, Escape cancels, blur
 * saves. A stage cell opens a picker instead. Headers sort ascending, descending, then unsorted;
 * the checkboxes select rows and the footer turns into a bulk bar; Add row appends a blank entry.
 * Undo and redo, including Ctrl Z and Ctrl Shift Z, walk the edit history.
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type CrmTagTone = "blue" | "violet" | "pink" | "green" | "amber" | "gray";

export type CrmColumnType = "title" | "tag" | "link" | "number" | "text";

export type CrmCellValue = string | number | ReactNode | undefined;

export type CrmColumn = {
  /** Row key this column reads and writes */
  key: string;
  /** Header label */
  label: string;
  /** How the cell is drawn and edited */
  type: CrmColumnType;
  /** Line glyph in the header – defaults to the glyph for `type` */
  icon?: ReactNode;
  /** Column width as a px number or any CSS length, e.g. "14%" */
  width?: number | string;
  /** Choices offered by a tag column's picker – defaults to the values already present */
  options?: string[];
};

export type CrmRow = {
  id: string;
  /** Brand mark drawn in front of the title */
  logo?: ReactNode;
} & Record<string, CrmCellValue>;

export type CrmView = {
  id: string;
  /** Tab label, and the card heading while the view is open */
  label: string;
  /** Brand tile in the tab: the tile colour and the mark drawn on it */
  logo?: { background: string; mark: ReactNode };
  /** "board" groups the rows by stage instead of listing them; defaults to "table" */
  layout?: "table" | "board";
  /** Only the rows this keeps are shown */
  filter?: (row: CrmRow) => boolean;
};

export type CrmNavItem = {
  /** Text shown in the sidebar and passed to onNavigate */
  label: string;
  /** Line glyph in front of the label */
  icon: ReactNode;
  /** Trailing tally, as on Companies */
  count?: number;
};

export type CrmPipeline = {
  /** Text shown in the sidebar and passed to onNavigate */
  label: string;
  /** Line glyph in front of the label */
  icon: ReactNode;
};

export type CrmGuide = {
  /** Title of the progress card */
  title: string;
  /** Completion, 0–100, drawn as text and as the bar */
  percent: number;
  /** Encouraging tail after the percentage */
  cheer?: string;
};

export type CrmNews = {
  /** Small accent line above the title */
  kicker: string;
  /** Headline of the changelog card */
  title: string;
  /** Label of the link at the bottom */
  more?: string;
};

export type CrmScreenProps = {
  /** Extra class on the root */
  className?: string;
  /** Workspace name; its first letter becomes the logo */
  workspace?: string;
  /** Account at the bottom of the sidebar */
  user?: { name: string; avatar?: string };
  /** Records listed above the pipelines; the item matching `active` is highlighted */
  nav?: CrmNavItem[];
  /** Label of the highlighted sidebar item */
  active?: string;
  /** Pipelines listed under the sidebar label */
  pipelines?: CrmPipeline[];
  /** Other workspaces offered by the switcher */
  workspaces?: string[];
  /** Folder in the breadcrumb */
  folder?: string;
  /** View name in the breadcrumb */
  viewLabel?: string;
  /** Called with the label of a sidebar item, workspace or account action */
  onNavigate?: (label: string) => void;
  /** Views open as tabs; defaults to the four saved views */
  views?: CrmView[];
  /** Id of the view open first */
  defaultView?: string;
  /** Called when another tab is picked */
  onSelectView?: (id: string) => void;
  /** Called by the New view button instead of opening a local view */
  onNewView?: () => void;
  /** Called by the menus' close action instead of closing a local view */
  onCloseView?: (id: string) => void;
  /** Table columns; defaults to the company list */
  columns?: CrmColumn[];
  /** Rows of the table */
  rows?: CrmRow[];
  /** Tag colour per tag text; unknown tags fall back to gray */
  tagTones?: Record<string, CrmTagTone>;
  /** Card heading; defaults to the open view's label */
  title?: string;
  /** Line under the table; defaults to a hint or the selection count */
  summary?: string;
  /** Replaces the built-in columns glyph in the card header */
  icon?: ReactNode;
  /** false keeps selection and sorting, but turns off editing and Add row */
  editable?: boolean;
  onRowsChange?: (rows: CrmRow[]) => void;
  /** Column a board view groups by; defaults to the stage column */
  boardGroupBy?: string;
  /** Order of the board columns */
  boardOrder?: string[];
  /** Progress card at the bottom of the sidebar; null hides it */
  guide?: CrmGuide | null;
  /** Changelog card at the bottom of the sidebar; null hides it */
  news?: CrmNews | null;
  /** Called when the progress card is clicked – expanding the guide is the owner's job */
  onOpenGuide?: () => void;
  /** Called by the changelog card's link */
  onOpenNews?: () => void;
  /** Called with the next favourite state */
  onToggleStar?: (starred: boolean) => void;
};

type Cell = { r: number; c: number };

type SortState = { key: string; dir: "asc" | "desc" };

type PickerAt = Cell & { top: number; left: number; width: number };

type MenuKind = "workspace" | "user" | "views" | "all";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const HISTORY_LIMIT = 60;
const ROW_HEIGHT = 44;
const EMPTY_HEIGHT = 68.5;
const GUIDE_HEIGHT = 70;
const DEFAULT_SUMMARY = "Double-click a cell to edit";

const cellText = (value: CrmCellValue): string =>
  value === undefined || value === null ? "" : String(value);

/** One cell changed, the rest of the row kept as it was. */
const patchRow = (list: CrmRow[], id: string, key: string, value: CrmCellValue): CrmRow[] =>
  list.map((row) => {
    if (row.id !== id) return row;
    const next: CrmRow = { ...row };
    next[key] = value;
    return next;
  });

/* ------------------------------------------------------------------ */
/* Defaults                                                            */
/* ------------------------------------------------------------------ */

const DEFAULT_TAG_TONES: Record<string, CrmTagTone> = {
  Negotiation: "amber",
  Proposal: "violet",
  Won: "green",
  Qualified: "blue",
  New: "gray",
  Lost: "pink",
  Productivity: "gray",
  Planning: "blue",
  Design: "pink",
  Payments: "violet",
  "E-commerce": "amber",
  "Developer Tools": "gray",
  CRM: "blue",
};

const STAGE_OPTIONS = ["New", "Qualified", "Proposal", "Negotiation", "Won", "Lost"];

const DEFAULT_COLUMNS: CrmColumn[] = [
  { key: "company", label: "Company", type: "title", width: "16%", icon: <TitleColumnIcon /> },
  { key: "category", label: "Category", type: "tag", width: "14%", icon: <TagColumnIcon /> },
  { key: "domain", label: "Domain", type: "link", width: "14%", icon: <LinkColumnIcon /> },
  { key: "owner", label: "Owner", type: "text", width: "12%", icon: <OwnerColumnIcon /> },
  { key: "value", label: "Value", type: "number", width: "12%", icon: <ValueColumnIcon /> },
  {
    key: "stage",
    label: "Stage",
    type: "tag",
    width: "12%",
    icon: <StageColumnIcon />,
    options: STAGE_OPTIONS,
  },
  { key: "lastContact", label: "Last contact", type: "text", icon: <DateColumnIcon /> },
];

const DEFAULT_ROWS: CrmRow[] = [
  {
    id: "notion",
    logo: <NotionLogo />,
    company: "Notion",
    category: "Productivity",
    domain: "notion.so",
    owner: "Mara Klein",
    value: 48000,
    stage: "Negotiation",
    lastContact: "Today",
  },
  {
    id: "linear",
    logo: <LinearLogo />,
    company: "Linear",
    category: "Planning",
    domain: "linear.app",
    owner: "Jonas Weber",
    value: 12500,
    stage: "Proposal",
    lastContact: "Yesterday",
  },
  {
    id: "figma",
    logo: <FigmaLogo />,
    company: "Figma",
    category: "Design",
    domain: "figma.com",
    owner: "Mara Klein",
    value: 86000,
    stage: "Won",
    lastContact: "Mar 6",
  },
  {
    id: "stripe",
    logo: <StripeLogo />,
    company: "Stripe",
    category: "Payments",
    domain: "stripe.com",
    owner: "Lea Braun",
    value: 124000,
    stage: "Qualified",
    lastContact: "Mar 5",
  },
  {
    id: "shopify",
    logo: <ShopifyLogo />,
    company: "Shopify",
    category: "E-commerce",
    domain: "shopify.com",
    owner: "Jonas Weber",
    value: 9800,
    stage: "New",
    lastContact: "Mar 4",
  },
  {
    id: "vercel",
    logo: <VercelLogo />,
    company: "Vercel",
    category: "Developer Tools",
    domain: "vercel.com",
    owner: "Lea Braun",
    value: 62000,
    stage: "Proposal",
    lastContact: "Mar 3",
  },
  {
    id: "airtable",
    logo: <AirtableLogo />,
    company: "Airtable",
    category: "Productivity",
    domain: "airtable.com",
    owner: "Mara Klein",
    value: 37500,
    stage: "Qualified",
    lastContact: "Mar 1",
  },
  {
    id: "hubspot",
    logo: <HubSpotLogo />,
    company: "HubSpot",
    category: "CRM",
    domain: "hubspot.com",
    owner: "Tom Fischer",
    value: 21000,
    stage: "New",
    lastContact: "Feb 27",
  },
  {
    id: "clickup",
    logo: <ClickUpLogo />,
    company: "ClickUp",
    category: "Planning",
    domain: "clickup.com",
    owner: "Tom Fischer",
    value: 6400,
    stage: "Lost",
    lastContact: "Feb 25",
  },
  {
    id: "webflow",
    logo: <WebflowLogo />,
    company: "Webflow",
    category: "Design",
    domain: "webflow.com",
    owner: "Lea Braun",
    value: 18900,
    stage: "Negotiation",
    lastContact: "Feb 24",
  },
];

const DEFAULT_VIEWS: CrmView[] = [
  {
    id: "company-crm",
    label: "Company CRM",
    logo: { background: "rgb(255, 122, 89)", mark: <HubSpotMark /> },
  },
  {
    id: "team-strategy",
    label: "Team strategy",
    logo: { background: "rgb(94, 106, 210)", mark: <LinearMark /> },
    layout: "board",
  },
  {
    id: "pixel-integration",
    label: "Pixel integration",
    logo: { background: "rgb(30, 30, 30)", mark: <FigmaMark /> },
    filter: (row) => cellText(row.category) === "Developer Tools",
  },
  {
    id: "sales-docs",
    label: "Sales docs",
    logo: { background: "rgb(23, 23, 23)", mark: <NotionMark /> },
    filter: (row) => cellText(row.stage) === "Won",
  },
];

const DEFAULT_NAV: CrmNavItem[] = [
  { label: "Home", icon: <HomeIcon /> },
  { label: "Companies", icon: <BuildingIcon />, count: 284 },
  { label: "Contacts", icon: <PeopleIcon /> },
  { label: "Deals", icon: <DollarIcon /> },
  { label: "Reports", icon: <ReportIcon /> },
];

const DEFAULT_PIPELINES: CrmPipeline[] = [
  { label: "New business", icon: <TargetIcon /> },
  { label: "Renewals", icon: <RefreshIcon /> },
  { label: "Partnerships", icon: <PeopleIcon /> },
];

const DEFAULT_WORKSPACES = ["Acme", "Northwind", "Fieldnotes"];

const DEFAULT_GUIDE: CrmGuide = { title: "Getting started", percent: 13, cheer: "Great start!" };

const DEFAULT_NEWS: CrmNews = {
  kicker: "New in Acme",
  title: "Shared folders",
  more: "Full changelog",
};

const BOARD_ORDER = ["New", "Qualified", "Proposal", "Negotiation", "Won"];

const BOARD_DOT_TONES: CrmTagTone[] = ["blue", "violet", "amber", "green"];

const COLUMN_ICONS: Record<CrmColumnType, ReactNode> = {
  title: <TitleColumnIcon />,
  tag: <TagColumnIcon />,
  link: <LinkColumnIcon />,
  number: <ValueColumnIcon />,
  text: <OwnerColumnIcon />,
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function CrmScreen({
  className,
  workspace = "Acme",
  user = { name: "Alex Morgan" },
  nav = DEFAULT_NAV,
  active = "Companies",
  pipelines = DEFAULT_PIPELINES,
  workspaces = DEFAULT_WORKSPACES,
  folder = "Sales",
  viewLabel = "Head of Sales",
  onNavigate,
  views,
  defaultView,
  onSelectView,
  onNewView,
  onCloseView,
  columns = DEFAULT_COLUMNS,
  rows,
  tagTones = DEFAULT_TAG_TONES,
  title,
  summary,
  icon,
  editable = true,
  onRowsChange,
  boardGroupBy = "stage",
  boardOrder = BOARD_ORDER,
  guide = DEFAULT_GUIDE,
  news = DEFAULT_NEWS,
  onOpenGuide,
  onOpenNews,
  onToggleStar,
}: CrmScreenProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const pickerTrigger = useRef<HTMLElement | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const anchorEl = useRef<HTMLElement | null>(null);
  const skipBlur = useRef(false);
  const nextViewId = useRef(1);
  const nextRowId = useRef(1);

  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] = useState(workspace);
  const [ownViews, setOwnViews] = useState<CrmView[] | null>(null);
  const [ownActive, setOwnActive] = useState<string | null>(null);
  const [ownRows, setOwnRows] = useState<CrmRow[] | null>(null);
  const [openMenu, setOpenMenu] = useState<MenuKind | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [sortState, setSortState] = useState<SortState | null>(null);
  const [activeCell, setActiveCell] = useState<Cell | null>(null);
  const [editing, setEditing] = useState<Cell | null>(null);
  const [draft, setDraft] = useState("");
  const [picker, setPicker] = useState<PickerAt | null>(null);
  const [past, setPast] = useState<CrmRow[][]>([]);
  const [future, setFuture] = useState<CrmRow[][]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [starred, setStarred] = useState(false);
  const [newsCount, setNewsCount] = useState(2);

  const viewList = ownViews ?? views ?? DEFAULT_VIEWS;
  const fallbackView = viewList[0] ?? DEFAULT_VIEWS[0];
  const activeView = viewList.find((view) => view.id === (ownActive ?? defaultView)) ?? fallbackView;
  const data = ownRows ?? rows ?? DEFAULT_ROWS;
  useEffect(() => setCurrentWorkspace(workspace), [workspace]);

  // The shell stacks at 900px: the sidebar becomes a drawer and the tabs scroll sideways
  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setNarrow(width > 0 && width < 900);
      if (width >= 900) setDrawer(false);
    });
    observer.observe(node);
    setNarrow(node.getBoundingClientRect().width < 900);
    return () => observer.disconnect();
  }, []);

  // One listener pair closes the open menu and the stage picker
  useEffect(() => {
    if (!openMenu && !picker) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (openMenu) {
        if (popRef.current?.contains(target) || anchorEl.current?.contains(target)) return;
        setOpenMenu(null);
      }
      if (picker) {
        if (pickerRef.current?.contains(target) || pickerTrigger.current?.contains(target)) return;
        setPicker(null);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [openMenu, picker]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenMenu(null);
      setDrawer(false);
      setPicker(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(null), 2400);
    return () => window.clearTimeout(timer);
  }, [note]);

  /* ---------- rows ---------- */

  const applyRows = (next: CrmRow[]) => {
    if (!rows) setOwnRows(next);
    onRowsChange?.(next);
  };

  const commitRows = (next: CrmRow[], message: string) => {
    setPast((current) => [...current.slice(-(HISTORY_LIMIT - 1)), data.map((row) => ({ ...row }))]);
    setFuture([]);
    applyRows(next);
    setNote(message);
  };

  const undo = () => {
    const snapshot = past[past.length - 1];
    if (!snapshot) return;
    setPast(past.slice(0, -1));
    setFuture([...future, data.map((row) => ({ ...row }))]);
    applyRows(snapshot);
    setNote("Undo.");
  };

  const redo = () => {
    const snapshot = future[future.length - 1];
    if (!snapshot) return;
    setFuture(future.slice(0, -1));
    setPast([...past, data.map((row) => ({ ...row }))]);
    applyRows(snapshot);
    setNote("Redo.");
  };

  const filtered = activeView.filter ? data.filter(activeView.filter) : data;

  const visibleRows = sortState
    ? [...filtered].sort((a, b) => {
        const column = columns.find((entry) => entry.key === sortState.key);
        const factor = sortState.dir === "asc" ? 1 : -1;
        if (column?.type === "number") {
          const left = Number(cellText(a[sortState.key]).replace(/[^\d.-]/g, ""));
          const right = Number(cellText(b[sortState.key]).replace(/[^\d.-]/g, ""));
          if (!Number.isNaN(left) && !Number.isNaN(right) && left !== right) return (left - right) * factor;
        }
        return cellText(a[sortState.key]).localeCompare(cellText(b[sortState.key]), "en", { numeric: true }) * factor;
      })
    : filtered;

  const titleColumn = columns.find((column) => column.type === "title") ?? columns[0];
  const titleKey = titleColumn?.key ?? "company";
  const valueColumn = columns.find((column) => column.type === "number");
  const valueKey = valueColumn?.key ?? columns[1]?.key ?? "value";
  const metaKeys = columns.filter((column) => column.type === "text").map((column) => column.key);

  const rowIds = visibleRows.map((row) => row.id);
  const allChecked = rowIds.length > 0 && rowIds.every((id) => selected.includes(id));
  const someChecked = rowIds.some((id) => selected.includes(id));
  const checkState: "true" | "false" | "mixed" = allChecked ? "true" : someChecked ? "mixed" : "false";

  /* ---------- views ---------- */

  const selectView = (id: string) => {
    setOwnActive(id);
    setSelected([]);
    setActiveCell(null);
    setEditing(null);
    setPicker(null);
    setOpenMenu(null);
    onSelectView?.(id);
  };

  const addView = () => {
    if (onNewView) {
      onNewView();
      setOpenMenu(null);
      return;
    }
    const id = `view-${nextViewId.current}`;
    nextViewId.current += 1;
    const opened: CrmView = { id, label: `Untitled view ${viewList.length + 1}` };
    setOwnViews([...viewList, opened]);
    selectView(id);
  };

  const closeView = (id: string) => {
    onCloseView?.(id);
    setOpenMenu(null);
    if (viewList.length <= 1) return;
    const remaining = viewList.filter((view) => view.id !== id);
    setOwnViews(remaining);
    if (activeView.id === id) {
      setOwnActive(remaining[0].id);
      onSelectView?.(remaining[0].id);
    }
  };

  const toggleMenu = (kind: MenuKind, element: HTMLElement) => {
    anchorEl.current = element;
    setOpenMenu((current) => (current === kind ? null : kind));
  };

  /* ---------- selection ---------- */

  const toggleRow = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  };

  const toggleAll = () => {
    setSelected((current) => {
      const others = current.filter((id) => !rowIds.includes(id));
      return allChecked ? others : [...others, ...rowIds];
    });
  };

  const deleteSelected = () => {
    if (!editable || selected.length === 0) return;
    const count = selected.length;
    commitRows(
      data.filter((row) => !selected.includes(row.id)),
      `Deleted ${count} row${count === 1 ? "" : "s"}.`,
    );
    setSelected([]);
    setActiveCell(null);
  };

  /* ---------- editing ---------- */

  const startEdit = (r: number, c: number, column: CrmColumn, target?: HTMLElement) => {
    if (!editable || column.type === "link") return;
    skipBlur.current = false;
    const row = visibleRows[r];
    if (!row) return;
    setActiveCell({ r, c });
    if (column.type === "tag") {
      const element =
        target ?? scrollRef.current?.querySelector<HTMLElement>(`td[data-cell="${r}-${c}"]`);
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const frame = rootRef.current?.getBoundingClientRect();
      const width = Math.max(rect.width, 132);
      const left = rect.left - (frame?.left ?? 0);
      pickerTrigger.current = element;
      setPicker({
        r,
        c,
        top: rect.bottom + 4 - (frame?.top ?? 0),
        left: Math.max(8, Math.min(left, (frame?.width ?? window.innerWidth) - width - 8)),
        width,
      });
      return;
    }
    setPicker(null);
    setDraft(cellText(row[column.key]));
    setEditing({ r, c });
  };

  const commitEdit = (move: "none" | "down" | "right" = "none") => {
    if (!editing) return;
    const at = editing;
    const row = visibleRows[at.r];
    const column = columns[at.c];
    setEditing(null);
    if (!row || !column) return;
    const before = cellText(row[column.key]);
    let nextValue: CrmCellValue = draft.trim();
    if (column.type === "number") {
      const parsed = Number(draft.replace(/[^\d.-]/g, ""));
      nextValue = draft.trim() !== "" && Number.isFinite(parsed) ? parsed : before;
    }
    if (cellText(nextValue) !== before) {
      commitRows(
        patchRow(data, row.id, column.key, nextValue),
        `${column.label} updated.`,
      );
    }
    if (move === "down") setActiveCell({ r: Math.min(at.r + 1, visibleRows.length - 1), c: at.c });
    if (move === "right") setActiveCell({ r: at.r, c: Math.min(at.c + 1, columns.length - 1) });
  };

  const chooseTag = (row: CrmRow, column: CrmColumn, option: string) => {
    setPicker(null);
    setEditing(null);
    scrollRef.current?.focus();
    if (cellText(row[column.key]) === option) return;
    commitRows(
      patchRow(data, row.id, column.key, option),
      `${column.label} set to ${option}.`,
    );
  };

  const addRow = () => {
    if (!editable) return;
    const id = `new-${nextRowId.current}`;
    nextRowId.current += 1;
    const blank: CrmRow = { id };
    columns.forEach((column) => {
      blank[column.key] = "";
    });
    commitRows([...data, blank], "Row added.");
  };

  const cycleSort = (key: string) => {
    setSortState((current) => {
      if (!current || current.key !== key) return { key, dir: "asc" };
      if (current.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  const onEditorKey = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      skipBlur.current = true;
      commitEdit("down");
    } else if (event.key === "Tab") {
      event.preventDefault();
      skipBlur.current = true;
      commitEdit("right");
    } else if (event.key === "Escape") {
      event.preventDefault();
      skipBlur.current = true;
      setEditing(null);
      setPicker(null);
    }
  };

  const onEditorBlur = () => {
    if (skipBlur.current) {
      skipBlur.current = false;
      return;
    }
    commitEdit();
  };

  const onGridKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (editing || picker) return;
    const meta = event.metaKey || event.ctrlKey;
    if (meta && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    const at = activeCell ?? { r: 0, c: 0 };
    const lastRow = Math.max(0, visibleRows.length - 1);
    const lastColumn = Math.max(0, columns.length - 1);
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveCell({ r: Math.min(at.r + 1, lastRow), c: at.c });
        return;
      case "ArrowUp":
        event.preventDefault();
        setActiveCell({ r: Math.max(at.r - 1, 0), c: at.c });
        return;
      case "ArrowRight":
        event.preventDefault();
        setActiveCell({ r: at.r, c: Math.min(at.c + 1, lastColumn) });
        return;
      case "ArrowLeft":
        event.preventDefault();
        setActiveCell({ r: at.r, c: Math.max(at.c - 1, 0) });
        return;
      case "Home":
        event.preventDefault();
        setActiveCell({ r: at.r, c: 0 });
        return;
      case "End":
        event.preventDefault();
        setActiveCell({ r: at.r, c: lastColumn });
        return;
      case "Enter": {
        event.preventDefault();
        const column = columns[at.c];
        if (column) startEdit(at.r, at.c, column);
        return;
      }
      case "Escape":
        setActiveCell(null);
        setPicker(null);
        return;
      default:
        break;
    }
    if (event.key.length === 1 && !meta && !event.altKey) {
      const column = columns[at.c];
      if (!column || !editable || column.type === "link") return;
      event.preventDefault();
      setActiveCell(at);
      setDraft(event.key);
      setEditing(at);
    }
  };

  /* ---------- derived board ---------- */

  const boardGroups = (() => {
    const present = Array.from(
      new Set(visibleRows.map((row) => cellText(row[boardGroupBy])).filter(Boolean)),
    );
    const labels = [
      ...boardOrder.filter((label) => present.includes(label)),
      ...present.filter((label) => !boardOrder.includes(label)),
    ];
    return labels.map((label) => {
      const grouped = visibleRows.filter((row) => cellText(row[boardGroupBy]) === label);
      const sum = grouped.reduce((total, row) => {
        const raw = cellText(row[valueKey]).replace(/[^\d.-]/g, "");
        const parsed = Number(raw);
        return total + (Number.isNaN(parsed) ? 0 : parsed);
      }, 0);
      return { label, tone: tagTones[label] ?? "gray", rows: grouped, sum };
    });
  })();

  const cardTitle = title ?? activeView.label;
  const morphHeight =
    visibleRows.length === 0 ? ROW_HEIGHT + EMPTY_HEIGHT : ROW_HEIGHT * (visibleRows.length + 1);
  const footNote = summary ?? note ?? DEFAULT_SUMMARY;
  const layout = activeView.layout ?? "table";
  const userInitials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  const renderCell = (row: CrmRow, rowIndex: number, column: CrmColumn, colIndex: number) => {
    const value = row[column.key];
    const text =
      column.type === "number" && typeof value === "number"
        ? value.toLocaleString("en-US")
        : cellText(value);
    const open = editing?.r === rowIndex && editing?.c === colIndex;
    const isPicker = picker?.r === rowIndex && picker?.c === colIndex;
    const options =
      column.options ??
      Array.from(new Set(data.map((entry) => cellText(entry[column.key])).filter(Boolean)));

    if (open) {
      return (
        <input
          className="ui-dt__input"
          value={draft}
          aria-label={column.label}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onEditorKey}
          onBlur={onEditorBlur}
          onClick={(event) => event.stopPropagation()}
        />
      );
    }

    if (column.type === "title") {
      return (
        <span className="ui-dt__name">
          {row.logo ? (
            <span className="ui-dt__logo">
              <span className="ui-as-crm__logo">{row.logo}</span>
            </span>
          ) : (
            <span className="ui-dt__logo ui-dt__logo--empty" />
          )}
          <span className="ui-dt__name-text" data-empty={text ? undefined : ""}>
            {text || "Untitled"}
          </span>
        </span>
      );
    }

    if (column.type === "link") {
      return (
        <a
          className="ui-dt__link"
          href={/^https?:\/\//i.test(text) ? text : `https://${text}`}
          target="_blank"
          rel="noreferrer"
          tabIndex={-1}
        >
          {text}
        </a>
      );
    }

    if (column.type === "tag") {
      if (!text) return null;
      return (
        <>
          <span className="ui-dt__tag" data-tone={tagTones[text] ?? "gray"}>
            {text}
          </span>
          {isPicker && picker ? (
            <div
              className="ui-dt__picker"
              role="listbox"
              aria-label={`${column.label} options`}
              ref={pickerRef}
              style={{ top: picker.top, left: picker.left, width: picker.width }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setPicker(null);
                  scrollRef.current?.focus();
                  return;
                }
                if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                event.preventDefault();
                const buttons = Array.from(
                  event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
                );
                const from = buttons.indexOf(document.activeElement as HTMLButtonElement);
                const step = event.key === "ArrowDown" ? 1 : -1;
                buttons[(from + step + buttons.length) % buttons.length]?.focus();
              }}
            >
              {(options.length > 0 ? options : [text]).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={option === text}
                  className="ui-dt__option"
                  autoFocus={option === text}
                  onClick={(event) => {
                    event.stopPropagation();
                    chooseTag(row, column, option);
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : null}
        </>
      );
    }

    return <span className="ui-dt__text">{text}</span>;
  };

  const viewsMenuFor = (kind: "views" | "all") =>
    openMenu === kind ? (
      <div className="ui-as-popover" data-align="end" ref={popRef}>
        <div className="ui-as-menu" role="menu" aria-label="Open views">
          <span className="ui-as-menu__title">Views</span>
          <div className="ui-as-menu__list">
            {viewList.map((view) => (
              <button
                key={view.id}
                type="button"
                role="menuitemradio"
                aria-checked={view.id === activeView.id}
                className="ui-as-menu__item"
                onClick={() => selectView(view.id)}
              >
                {view.logo ? (
                  <span className="ui-as-crm__tab-logo" style={{ background: view.logo.background }}>
                    {view.logo.mark}
                  </span>
                ) : null}
                {view.label}
              </button>
            ))}
          </div>
          <div className="ui-as-menu__list">
            <button
              type="button"
              role="menuitem"
              className="ui-as-menu__item"
              data-danger
              onClick={() => closeView(activeView.id)}
            >
              Close {activeView.label}
            </button>
          </div>
        </div>
      </div>
    ) : null;

  const workspaceMenu =
    openMenu === "workspace" ? (
      <div className="ui-as-popover" ref={popRef}>
        <div className="ui-as-menu" role="menu" aria-label="Switch workspace">
          <span className="ui-as-menu__title">Workspaces</span>
          <div className="ui-as-menu__list">
            {workspaces.map((name) => (
              <button
                key={name}
                type="button"
                role="menuitemradio"
                aria-checked={name === currentWorkspace}
                className="ui-as-menu__item"
                onClick={() => {
                  setCurrentWorkspace(name);
                  setOpenMenu(null);
                  onNavigate?.(name);
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>
    ) : null;

  const userMenu =
    openMenu === "user" ? (
      <div className="ui-as-popover" data-side="top" data-align="end" ref={popRef}>
        <div className="ui-as-menu" role="menu" aria-label="Account">
          <span className="ui-as-menu__title">{user.name}</span>
          <div className="ui-as-menu__list">
            <button
              type="button"
              role="menuitem"
              className="ui-as-menu__item"
              onClick={() => {
                setOpenMenu(null);
                onNavigate?.("Account settings");
              }}
            >
              Account settings
            </button>
            <button
              type="button"
              role="menuitem"
              className="ui-as-menu__item"
              data-danger
              onClick={() => {
                setOpenMenu(null);
                onNavigate?.("Sign out");
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    ) : null;

  const tableCard = (
    <section className="ui-dt" aria-label={cardTitle}>
      <header className="ui-dt__head">
        <span className="ui-dt__title-icon">{icon ?? <ColumnsIcon />}</span>
        <h3 className="ui-dt__title">{cardTitle}</h3>
        <div className="ui-dt__tools">
          <button
            type="button"
            className="ui-dt__tool"
            aria-label="Undo (Ctrl Z)"
            title="Undo · Ctrl Z"
            disabled={past.length === 0}
            onClick={undo}
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            className="ui-dt__tool"
            aria-label="Redo (Ctrl Shift Z)"
            title="Redo · Ctrl ⇧ Z"
            disabled={future.length === 0}
            onClick={redo}
          >
            <RedoIcon />
          </button>
        </div>
      </header>

      <div className="ui-dt__card">
        <div className="ui-dt__morph" data-smooth="" style={{ height: Math.ceil(morphHeight) }}>
          <div
            className="ui-dt__scroll"
            role="grid"
            aria-label={cardTitle}
            aria-rowcount={visibleRows.length + 1}
            aria-multiselectable
            tabIndex={0}
            ref={scrollRef}
            onKeyDown={onGridKey}
          >
            <table className="ui-dt__table" role="presentation">
              <colgroup>
                <col style={{ width: 44 }} />
                {columns.map((column) => (
                  <col key={column.key} style={column.width ? { width: column.width } : undefined} />
                ))}
              </colgroup>
              <thead>
                <tr role="row">
                  <th className="ui-dt__select" role="columnheader">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checkState}
                      aria-label="Select all rows"
                      className="ui-dt__check"
                      onClick={toggleAll}
                    >
                      <CheckIcon />
                    </button>
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      role="columnheader"
                      aria-sort={
                        sortState?.key === column.key
                          ? sortState.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      data-type={column.type}
                    >
                      <button type="button" className="ui-dt__th" onClick={() => cycleSort(column.key)}>
                        <span className="ui-dt__col-icon">{column.icon ?? COLUMN_ICONS[column.type]}</span>
                        <span className="ui-dt__th-label">{column.label}</span>
                        <span
                          className="ui-dt__sort"
                          aria-hidden="true"
                          data-dir={sortState?.key === column.key ? sortState.dir : undefined}
                        >
                          <SortIcon />
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr role="row">
                    <td role="gridcell" colSpan={columns.length + 1}>
                      <p className="ui-dt__empty">No companies in this view.</p>
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row, rowIndex) => {
                    const isSelected = selected.includes(row.id);
                    return (
                      <tr key={row.id} role="row" data-selected={isSelected ? "" : undefined}>
                        <td className="ui-dt__select" role="gridcell">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={isSelected}
                            aria-label={`Select ${cellText(row[titleKey]) || "row"}`}
                            className="ui-dt__check"
                            onClick={() => toggleRow(row.id)}
                          >
                            <CheckIcon />
                          </button>
                        </td>
                        {columns.map((column, colIndex) => {
                          const isActive = activeCell?.r === rowIndex && activeCell?.c === colIndex;
                          const isEditing = editing?.r === rowIndex && editing?.c === colIndex;
                          return (
                            <td
                              key={column.key}
                              role="gridcell"
                              data-cell={`${rowIndex}-${colIndex}`}
                              data-type={column.type}
                              aria-selected={isSelected}
                              data-active={isActive ? "" : undefined}
                              data-editing={isEditing ? "" : undefined}
                              onClick={() => setActiveCell({ r: rowIndex, c: colIndex })}
                              onDoubleClick={(event) =>
                                startEdit(rowIndex, colIndex, column, event.currentTarget)
                              }
                            >
                              {renderCell(row, rowIndex, column, colIndex)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <footer className="ui-dt__foot">
        {selected.length > 0 ? (
          <div className="ui-dt__bulk">
            <span>{selected.length} selected</span>
            <button type="button" className="ui-dt__add ui-dt__add--danger" onClick={deleteSelected}>
              Delete
            </button>
            <button type="button" className="ui-dt__add" onClick={() => setSelected([])}>
              Clear
            </button>
          </div>
        ) : (
          <button type="button" className="ui-dt__add" onClick={addRow} disabled={!editable}>
            <PlusIcon />
            Add row
          </button>
        )}
        <span className="ui-dt__summary" aria-live="polite">
          {footNote}
        </span>
      </footer>
    </section>
  );

  const boardCard = (
    <div className="ui-as-board">
      {boardGroups.map((group) => (
        <div key={group.label} className="ui-as-board__col">
          <header>
            <span
              className="ui-as-board__dot"
              data-tone={BOARD_DOT_TONES.includes(group.tone) ? group.tone : undefined}
            />
            {group.label}
            <span className="ui-as-board__count">{group.rows.length}</span>
            <span className="ui-as-board__sum">{group.sum.toLocaleString("en-US")}</span>
          </header>
          {group.rows.map((row) => (
            <div key={row.id} className="ui-as-board__card">
              <span className="ui-as-board__name">
                {row.logo ? <span className="ui-as-board__logo">{row.logo}</span> : null}
                {cellText(row[titleKey])}
              </span>
              <b>
                {typeof row[valueKey] === "number"
                  ? (row[valueKey] as number).toLocaleString("en-US")
                  : cellText(row[valueKey])}
              </b>
              <span className="ui-as-board__meta">
                {metaKeys
                  .slice(0, 2)
                  .map((key) => cellText(row[key]))
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={["ui-as ui-as-app", className].filter(Boolean).join(" ")}
      data-collapsed={collapsed || undefined}
      data-drawer={drawer || undefined}
    >
      {/* React 19 hoists this into <head> once, no matter how many screens render */}
      <style href="ui-screen-crm" precedence="default">
        {css}
      </style>

      <button
        className="ui-as-icon-btn ui-as-side-open"
        type="button"
        aria-label="Open sidebar"
        tabIndex={-1}
        onClick={() => (narrow ? setDrawer(true) : setCollapsed(false))}
      >
        <PanelIcon />
      </button>
      <div className="ui-as-scrim" aria-hidden="true" onClick={() => setDrawer(false)} />

      <aside className="ui-as-side">
        <header className="ui-as-side__head">
          <span className="ui-as-anchor">
            <button
              className="ui-as-side__workspace"
              type="button"
              aria-expanded={openMenu === "workspace"}
              onClick={(event) => toggleMenu("workspace", event.currentTarget)}
            >
              <span className="ui-as-side__logo">{currentWorkspace.trim().charAt(0).toUpperCase() || "A"}</span>
              {currentWorkspace}
              <ChevronDown />
            </button>
            {workspaceMenu}
          </span>
          <span className="ui-as-side__tools">
            <button
              className="ui-as-icon-btn"
              type="button"
              aria-label="Search"
              onClick={() => onNavigate?.("Search")}
            >
              <SearchIcon />
            </button>
            <button
              className="ui-as-icon-btn"
              type="button"
              aria-label="Collapse sidebar"
              onClick={() => {
                if (narrow) setDrawer(false);
                else setCollapsed(true);
              }}
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
                onClick={() => {
                  onNavigate?.(item.label);
                  setDrawer(false);
                }}
              >
                {item.icon}
                {item.label}
                {item.count === undefined ? null : <span className="ui-as-side__count">{item.count}</span>}
              </button>
            ))}
          </div>
          <div className="ui-as-side__group">
            <span className="ui-as-side__label">Pipelines</span>
            {pipelines.map((pipeline) => (
              <button
                key={pipeline.label}
                type="button"
                className="ui-as-side__item"
                onClick={() => {
                  onNavigate?.(pipeline.label);
                  setDrawer(false);
                }}
              >
                {pipeline.icon}
                {pipeline.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="ui-as-side__foot">
          {news && newsCount > 0 ? (
            <div className="ui-as-news" data-count={newsCount}>
              <div className="ui-as-news__card ui-as-news__card--back" aria-hidden="true">
                <span className="ui-as-news__kicker">{news.kicker}</span>
                <CloseIcon />
              </div>
              <div className="ui-as-news__card">
                <div className="ui-as-news__top">
                  <span className="ui-as-news__kicker">{news.kicker}</span>
                  <button
                    type="button"
                    className="ui-as-news__close"
                    aria-label="Dismiss"
                    onClick={() => setNewsCount((count) => Math.max(0, count - 1))}
                  >
                    <CloseIcon />
                  </button>
                </div>
                <b className="ui-as-news__title">{news.title}</b>
                <button type="button" className="ui-as-news__more" onClick={() => onOpenNews?.()}>
                  {news.more ?? "Full changelog"}
                  <ChevronRight />
                </button>
              </div>
            </div>
          ) : null}

          {guide ? (
            <div className="ui-as-guide-slot" style={{ height: GUIDE_HEIGHT }}>
              <div className="ui-as-guide" data-state="closed" style={{ height: GUIDE_HEIGHT }}>
                <div className="ui-as-guide__inner">
                  <button
                    type="button"
                    className="ui-as-steps ui-as-guide__content"
                    aria-expanded="false"
                    onClick={() => onOpenGuide?.()}
                  >
                    <span className="ui-as-steps__title">
                      {guide.title}
                      <ChevronRight />
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
          ) : null}

          <span className="ui-as-anchor ui-as-user-menu">
            <button
              type="button"
              className="ui-as-user"
              aria-expanded={openMenu === "user"}
              onClick={(event) => toggleMenu("user", event.currentTarget)}
            >
              <span className="ui-as-user__initials">{userInitials}</span>
              {user.name}
              <ChevronDown />
            </button>
            {userMenu}
          </span>
        </div>
      </aside>

      <main className="ui-as-main">
        <div className="ui-as-crm">
          <header className="ui-as-crm__top">
            <span className="ui-as-crm__path">
              <FolderIcon />
              <span>{folder}</span>
              <i>/</i>
              <span className="ui-as-anchor">
                <button
                  type="button"
                  className="ui-as-crm__view"
                  aria-expanded={openMenu === "views"}
                  onClick={(event) => toggleMenu("views", event.currentTarget)}
                >
                  {viewLabel}
                  <ChevronDown />
                </button>
                {viewsMenuFor("views")}
              </span>
            </span>
            <button
              type="button"
              className="ui-as-icon-btn ui-as-crm__star"
              aria-label="Add to favorites"
              aria-pressed={starred}
              onClick={() => {
                const next = !starred;
                setStarred(next);
                onToggleStar?.(next);
              }}
            >
              <StarIcon />
            </button>
          </header>

          <nav className="ui-as-crm__tabs" aria-label="Open views">
            <button type="button" className="ui-as-icon-btn" aria-label="New view" onClick={addView}>
              <FilePlusIcon />
            </button>
            <span className="ui-as-anchor">
              <button
                type="button"
                className="ui-as-icon-btn"
                aria-label="All views"
                aria-expanded={openMenu === "all"}
                onClick={(event) => toggleMenu("all", event.currentTarget)}
              >
                <GridIcon />
              </button>
              {viewsMenuFor("all")}
            </span>
            <span className="ui-as-crm__sep" />
            {viewList.map((view) => (
              <button
                key={view.id}
                type="button"
                className="ui-as-crm__tab"
                aria-current={view.id === activeView.id ? "page" : undefined}
                onClick={(event) => {
                  if (event.altKey || event.metaKey) closeView(view.id);
                  else selectView(view.id);
                }}
              >
                {view.logo ? (
                  <span className="ui-as-crm__tab-logo" style={{ background: view.logo.background }}>
                    {view.logo.mark}
                  </span>
                ) : null}
                {view.label}
              </button>
            ))}
          </nav>

          <div className="ui-as-crm__table">{layout === "board" ? boardCard : tableCard}</div>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Icons and helpers                                                   */
/* ------------------------------------------------------------------ */

function PanelIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M2 12C2 8.31087 2 6.4663 2.81382 5.15877C3.1149 4.67502 3.48891 4.25427 3.91891 3.91554C5.08116 3 6.72077 3 10 3H14C17.2792 3 18.9188 3 20.0811 3.91554C20.5111 4.25427 20.8851 4.67502 21.1862 5.15877C22 6.4663 22 8.31087 22 12C22 15.6891 22 17.5337 21.1862 18.8412C20.8851 19.325 20.5111 19.7457 20.0811 20.0845C18.9188 21 17.2792 21 14 21H10C6.72077 21 5.08116 21 3.91891 20.0845C3.48891 19.7457 3.1149 19.325 2.81382 18.8412C2 17.5337 2 15.6891 2 12Z" stroke="currentColor" strokeWidth="1.9" />
      <path d="M9.5 3L9.5 21" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M5 7H6M5 10H6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" color="currentColor" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M17 17L21 21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M3 11.9896V14.5C3 17.7998 3 19.4497 4.02513 20.4749C5.05025 21.5 6.70017 21.5 10 21.5H14C17.2998 21.5 18.9497 21.5 19.9749 20.4749C21 19.4497 21 17.7998 21 14.5V11.9896C21 10.3083 21 9.46773 20.6441 8.74005C20.2882 8.01237 19.6247 7.49628 18.2976 6.46411L16.2976 4.90855C14.2331 3.30285 13.2009 2.5 12 2.5C10.7991 2.5 9.76689 3.30285 7.70242 4.90855L5.70241 6.46411C4.37533 7.49628 3.71179 8.01237 3.3559 8.74005C3 9.46773 3 10.3083 3 11.9896Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M16 10L18.1494 10.6448C19.5226 11.0568 20.2092 11.2628 20.6046 11.7942C21 12.3256 21 13.0425 21 14.4761V22" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M8 9L11 9M8 13L11 13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M12 22V19C12 18.0572 12 17.5858 11.7071 17.2929C11.4142 17 10.9428 17 10 17H9C8.05719 17 7.58579 17 7.29289 17.2929C7 17.5858 7 18.0572 7 19V22" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M2 22L22 22" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M3 22V6.71724C3 4.20649 3 2.95111 3.79118 2.32824C4.58237 1.70537 5.74742 2.04355 8.07752 2.7199L13.0775 4.17122C14.4836 4.57937 15.1867 4.78344 15.5933 5.33965C16 5.89587 16 6.65344 16 8.16857V22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M16 21C15.7668 18.0685 13.3422 15.7477 10.3085 15.5521L9.49999 15.5C9.21121 15.5076 8.94209 15.5178 8.68816 15.5298C5.68124 15.6723 3.23089 18.0974 3 21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M12.75 9.75C12.75 11.5449 11.2949 13 9.5 13C7.70508 13 6.25 11.5449 6.25 9.75C6.25 7.95507 7.70508 6.5 9.5 6.5C11.2949 6.5 12.75 7.95507 12.75 9.75Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M21 17.501C20.7709 14.6314 18.4541 12.2748 15.5 11.9961" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M15.9877 9C16.8965 8.42434 17.5001 7.40788 17.5001 6.25C17.5001 4.45507 16.0496 3 14.2602 3C13.3811 3 12.5838 3.35121 12.0001 3.92139" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function DollarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M17.9583 8.38889C17.9583 6.24111 15.2907 4.5 12 4.5C8.7093 4.5 6.04167 6.24111 6.04167 8.38889C6.04167 10.5367 7.66667 11.7222 12 11.7222C16.3333 11.7222 18.5 12.8333 18.5 15.6111C18.5 18.3889 15.5899 19.5 12 19.5C8.41015 19.5 5.5 17.7589 5.5 15.6111" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M12.5 2.5V4.21M12.5 21.5V19.79" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M7 17L7 13" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M12 17L12 7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M17 17L17 11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M17 12C17 14.7614 14.7614 17 12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M14 2.20004C13.3538 2.06886 12.6849 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 11.3151 21.9311 10.6462 21.8 10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M12.0303 11.9625L16.5832 7.4096M19.7404 4.34462L19.1872 2.35748C19.0853 2.03011 18.6914 1.89965 18.4259 2.11662C16.9898 3.29018 15.4254 4.87091 16.703 7.36419C19.2771 8.56455 20.7466 6.94584 21.8733 5.5853C22.0975 5.3146 21.9623 4.90767 21.6247 4.81005L19.7404 4.34462Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M20.0092 2V5.13219C20.0092 5.42605 19.6418 5.55908 19.4537 5.33333C17.6226 3.2875 14.9617 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" color="currentColor" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" color="currentColor" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M8 7H16.75C18.8567 7 19.91 7 20.6667 7.50559C20.9943 7.72447 21.2755 8.00572 21.4944 8.33329C22 9.08996 22 10.1433 22 12.25C22 15.7612 22 17.5167 21.1573 18.7779C20.7926 19.3238 20.3238 19.7926 19.7779 20.1573C18.5167 21 16.7612 21 13.25 21H12C7.28595 21 4.92893 21 3.46447 19.5355C2 18.0711 2 15.714 2 11V7.94427C2 6.1278 2 5.21956 2.38032 4.53806C2.65142 4.05227 3.05227 3.65142 3.53806 3.38032C4.21956 3 5.1278 3 6.94427 3C8.10802 3 8.6899 3 9.19926 3.19101C10.3622 3.62712 10.8418 4.68358 11.3666 5.73313L12 7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M13.7276 3.44418L15.4874 6.99288C15.7274 7.48687 16.3673 7.9607 16.9073 8.05143L20.0969 8.58575C22.1367 8.92853 22.6167 10.4206 21.1468 11.8925L18.6671 14.3927C18.2471 14.8161 18.0172 15.6327 18.1471 16.2175L18.8571 19.3125C19.417 21.7623 18.1271 22.71 15.9774 21.4296L12.9877 19.6452C12.4478 19.3226 11.5579 19.3226 11.0079 19.6452L8.01827 21.4296C5.8785 22.71 4.57865 21.7522 5.13859 19.3125L5.84851 16.2175C5.97849 15.6327 5.74852 14.8161 5.32856 14.3927L2.84884 11.8925C1.389 10.4206 1.85895 8.92853 3.89872 8.58575L7.08837 8.05143C7.61831 7.9607 8.25824 7.48687 8.49821 6.99288L10.258 3.44418C11.2179 1.51861 12.7777 1.51861 13.7276 3.44418Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function FilePlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M4 12.0005L4 14.5446C4 17.7896 4 19.4122 4.88607 20.5111C5.06508 20.7331 5.26731 20.9354 5.48933 21.1144C6.58831 22.0005 8.21082 22.0005 11.4558 22.0005C12.1614 22.0005 12.5141 22.0005 12.8372 21.8865C12.9044 21.8627 12.9702 21.8355 13.0345 21.8047C13.3436 21.6569 13.593 21.4075 14.0919 20.9086L18.8284 16.172C19.4065 15.594 19.6955 15.3049 19.8478 14.9374C20 14.5699 20 14.1611 20 13.3436V10.0005C20 6.22922 20 4.34361 18.8284 3.17203C17.7693 2.11287 16.1265 2.01125 13.0345 2.0015M13 21.5005V21.0005C13 18.172 13 16.7578 13.8787 15.8791C14.7574 15.0005 16.1716 15.0005 19 15.0005H19.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M12 5.99954H4M8 1.99954V9.99954" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M3.88884 9.66294C4.39329 10 5.09552 10 6.49998 10C7.90445 10 8.60668 10 9.11113 9.66294C9.32951 9.51702 9.51701 9.32952 9.66292 9.11114C9.99998 8.60669 9.99998 7.90446 9.99998 6.5C9.99998 5.09554 9.99998 4.39331 9.66292 3.88886C9.51701 3.67048 9.32951 3.48298 9.11113 3.33706C8.60668 3 7.90445 3 6.49998 3C5.09552 3 4.39329 3 3.88884 3.33706C3.67046 3.48298 3.48296 3.67048 3.33705 3.88886C2.99998 4.39331 2.99998 5.09554 2.99998 6.5C2.99998 7.90446 2.99998 8.60669 3.33705 9.11114C3.48296 9.32952 3.67046 9.51702 3.88884 9.66294Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M14.8888 9.66294C15.3933 10 16.0955 10 17.5 10C18.9044 10 19.6067 10 20.1111 9.66294C20.3295 9.51702 20.517 9.32952 20.6629 9.11114C21 8.60669 21 7.90446 21 6.5C21 5.09554 21 4.39331 20.6629 3.88886C20.517 3.67048 20.3295 3.48298 20.1111 3.33706C19.6067 3 18.9044 3 17.5 3C16.0955 3 15.3933 3 14.8888 3.33706C14.6705 3.48298 14.483 3.67048 14.337 3.88886C14 4.39331 14 5.09554 14 6.5C14 7.90446 14 8.60669 14.337 9.11114C14.483 9.32952 14.6705 9.51702 14.8888 9.66294Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M3.88884 20.6629C4.39329 21 5.09552 21 6.49998 21C7.90445 21 8.60668 21 9.11113 20.6629C9.32951 20.517 9.51701 20.3295 9.66292 20.1111C9.99998 19.6067 9.99998 18.9045 9.99998 17.5C9.99998 16.0955 9.99998 15.3933 9.66292 14.8889C9.51701 14.6705 9.32951 14.483 9.11113 14.3371C8.60668 14 7.90445 14 6.49998 14C5.09552 14 4.39329 14 3.88884 14.3371C3.67046 14.483 3.48296 14.6705 3.33705 14.8889C2.99998 15.3933 2.99998 16.0955 2.99998 17.5C2.99998 18.9045 2.99998 19.6067 3.33705 20.1111C3.48296 20.3295 3.67046 20.517 3.88884 20.6629Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M14.8888 20.6629C15.3933 21 16.0955 21 17.5 21C18.9044 21 19.6067 21 20.1111 20.6629C20.3295 20.517 20.517 20.3295 20.6629 20.1111C21 19.6067 21 18.9045 21 17.5C21 16.0955 21 15.3933 20.6629 14.8889C20.517 14.6705 20.3295 14.483 20.1111 14.3371C19.6067 14 18.9044 14 17.5 14C16.0955 14 15.3933 14 14.8888 14.3371C14.6705 14.483 14.483 14.6705 14.337 14.8889C14 15.3933 14 16.0955 14 17.5C14 18.9045 14 19.6067 14.337 20.1111C14.483 20.3295 14.6705 20.517 14.8888 20.6629Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function HubSpotMark() {
  return (
    <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
      <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z" />
    </svg>
  );
}

function LinearMark() {
  return (
    <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
      <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />
    </svg>
  );
}

function FigmaMark() {
  return (
    <svg viewBox="0 0 38 57" aria-hidden="true">
      <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0Z" fill="#1ABCFE" />
      <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0Z" fill="#0ACF83" />
      <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19Z" fill="#FF7262" />
      <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5Z" fill="#F24E1E" />
      <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5Z" fill="#A259FF" />
    </svg>
  );
}

function NotionMark() {
  return (
    <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
    </svg>
  );
}

function ColumnsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M20 10C20 10 22.375 11.8222 21.375 14.6667C20.375 17.5111 21.375 19.4074 22 20M20 10H4M20 10V4M4 10C4 10 1.625 11.8222 2.625 14.6667C3.625 17.5111 2.625 19.4074 2 20M4 10V4M22 4H20.75H20M2 4H3.25H4M4 4H20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M11 7H13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5.5 3.5 2.5 6.5l3 3M2.5 6.5h7a4 4 0 0 1 0 8H7" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m10.5 3.5 3 3-3 3M13.5 6.5h-7a4 4 0 0 0 0 8H9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="m4.25 8.25 2.5 2.5 5-5.5" />
    </svg>
  );
}

function TitleColumnIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M3 3H21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M3 9H11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M3 15H21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M3 21H11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2.5v7M3.5 7l2.5 2.5L8.5 7" />
    </svg>
  );
}

function TagColumnIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <circle cx="1.5" cy="1.5" r="1.5" transform="matrix(1 0 0 -1 16 8.00024)" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M2.77423 11.1439C1.77108 12.2643 1.7495 13.9546 2.67016 15.1437C4.49711 17.5033 6.49674 19.5029 8.85633 21.3298C10.0454 22.2505 11.7357 22.2289 12.8561 21.2258C15.8979 18.5022 18.6835 15.6559 21.3719 12.5279C21.6377 12.2187 21.8039 11.8397 21.8412 11.4336C22.0062 9.63798 22.3452 4.46467 20.9403 3.05974C19.5353 1.65481 14.362 1.99377 12.5664 2.15876C12.1603 2.19608 11.7813 2.36233 11.472 2.62811C8.34412 5.31646 5.49781 8.10211 2.77423 11.1439Z" stroke="currentColor" strokeWidth="1.9" />
      <path d="M7.00002 14.0002L10 17.0002" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function LinkColumnIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M9.14339 10.691L9.35031 10.4841C11.329 8.50532 14.5372 8.50532 16.5159 10.4841C18.4947 12.4628 18.4947 15.671 16.5159 17.6497L13.6497 20.5159C11.671 22.4947 8.46279 22.4947 6.48405 20.5159C4.50532 18.5372 4.50532 15.329 6.48405 13.3503L6.9484 12.886" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M17.0516 11.114L17.5159 10.6497C19.4947 8.67095 19.4947 5.46279 17.5159 3.48405C15.5372 1.50532 12.329 1.50532 10.3503 3.48405L7.48405 6.35031C5.50532 8.32904 5.50532 11.5372 7.48405 13.5159C9.46279 15.4947 12.671 15.4947 14.6497 13.5159L14.8566 13.309" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </svg>
  );
}

function OwnerColumnIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M20 21.0001C19.713 17.269 16.7289 14.3151 12.995 14.0662L12 13.9999C11.6446 14.0096 11.3134 14.0225 11.0008 14.0378C7.3 14.2192 4.28417 17.3057 4 21.0001" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <circle cx="12" cy="6.99988" r="4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function ValueColumnIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M17.9583 8.38889C17.9583 6.24111 15.2907 4.5 12 4.5C8.7093 4.5 6.04167 6.24111 6.04167 8.38889C6.04167 10.5367 7.66667 11.7222 12 11.7222C16.3333 11.7222 18.5 12.8333 18.5 15.6111C18.5 18.3889 15.5899 19.5 12 19.5C8.41015 19.5 5.5 17.7589 5.5 15.6111" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M12.5 2.5V4.21M12.5 21.5V19.79" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function StageColumnIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M12 21C15.7497 21 17.6246 21 18.9389 20.0451C19.3634 19.7367 19.7367 19.3634 20.0451 18.9389C21 17.6246 21 15.7497 21 12C21 8.25027 21 6.3754 20.0451 5.06107C19.7367 4.6366 19.3634 4.26331 18.9389 3.95491C17.6246 3 15.7497 3 12 3C8.25027 3 6.3754 3 5.06107 3.95491C4.6366 4.26331 4.26331 4.6366 3.95491 5.06107C3 6.3754 3 8.25027 3 12C3 15.7497 3 17.6246 3.95491 18.9389C4.26331 19.3634 4.6366 19.7367 5.06107 20.0451C6.3754 21 8.25027 21 12 21Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M12 7V11M17 7V17M7 7V14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function DateColumnIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M16 2V6M8 2V6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M13 4H11C7.22876 4 5.34315 4 4.17157 5.17157C3 6.34315 3 8.22876 3 12V14C3 17.7712 3 19.6569 4.17157 20.8284C5.34315 22 7.22876 22 11 22H13C16.7712 22 18.6569 22 19.8284 20.8284C21 19.6569 21 17.7712 21 14V12C21 8.22876 21 6.34315 19.8284 5.17157C18.6569 4 16.7712 4 13 4Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M3 10H21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M12.1258 14H12.0008M12.1258 18H12.0008M7.625 14H7.5M7.625 18H7.5M16.625 14H16.5M12.2508 14C12.2508 14.1381 12.1389 14.25 12.0008 14.25C11.8628 14.25 11.7508 14.1381 11.7508 14C11.7508 13.8619 11.8628 13.75 12.0008 13.75C12.1389 13.75 12.2508 13.8619 12.2508 14ZM12.2508 18C12.2508 18.1381 12.1389 18.25 12.0008 18.25C11.8628 18.25 11.7508 18.1381 11.7508 18C11.7508 17.8619 11.8628 17.75 12.0008 17.75C12.1389 17.75 12.2508 17.8619 12.2508 18ZM7.75 14C7.75 14.1381 7.63807 14.25 7.5 14.25C7.36193 14.25 7.25 14.1381 7.25 14C7.25 13.8619 7.36193 13.75 7.5 13.75C7.63807 13.75 7.75 13.8619 7.75 14ZM7.75 18C7.75 18.1381 7.63807 18.25 7.5 18.25C7.36193 18.25 7.25 18.1381 7.25 18C7.25 17.8619 7.36193 17.75 7.5 17.75C7.63807 17.75 7.75 17.8619 7.75 18ZM16.75 14C16.75 14.1381 16.6381 14.25 16.5 14.25C16.3619 14.25 16.25 14.1381 16.25 14C16.25 13.8619 16.3619 13.75 16.5 13.75C16.6381 13.75 16.75 13.8619 16.75 14Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function NotionLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="#171717" aria-hidden="true">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
    </svg>
  );
}

function LinearLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="#5E6AD2" aria-hidden="true">
      <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />
    </svg>
  );
}

function FigmaLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="#F24E1E" aria-hidden="true">
      <path d="M15.852 8.981h-4.588V0h4.588c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.491-4.49 4.491zM12.735 7.51h3.117c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-3.117V7.51zm0 1.471H8.148c-2.476 0-4.49-2.014-4.49-4.49S5.672 0 8.148 0h4.588v8.981zm-4.587-7.51c-1.665 0-3.019 1.355-3.019 3.019s1.354 3.02 3.019 3.02h3.117V1.471H8.148zm4.587 15.019H8.148c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h4.588v8.98zM8.148 8.981c-1.665 0-3.019 1.355-3.019 3.019s1.355 3.019 3.019 3.019h3.117V8.981H8.148zM8.172 24c-2.489 0-4.515-2.014-4.515-4.49s2.014-4.49 4.49-4.49h4.588v4.441c0 2.503-2.047 4.539-4.563 4.539zm-.024-7.51a3.023 3.023 0 0 0-3.019 3.019c0 1.665 1.365 3.019 3.044 3.019 1.705 0 3.093-1.376 3.093-3.068v-2.97H8.148zm7.704 0h-.098c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h.098c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.49-4.49 4.49zm-.097-7.509c-1.665 0-3.019 1.355-3.019 3.019s1.355 3.019 3.019 3.019h.098c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-.098z" />
    </svg>
  );
}

function StripeLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="#635BFF" aria-hidden="true">
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />
    </svg>
  );
}

function ShopifyLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="#7AB55C" aria-hidden="true">
      <path d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.045-.037-.075-.057-.121-.074l-.914 21.104h.023zM11.71 11.305s-.81-.424-1.774-.424c-1.447 0-1.504.906-1.504 1.141 0 1.232 3.24 1.715 3.24 4.629 0 2.295-1.44 3.76-3.406 3.76-2.354 0-3.54-1.465-3.54-1.465l.646-2.086s1.245 1.066 2.28 1.066c.675 0 .975-.545.975-.932 0-1.619-2.654-1.694-2.654-4.359-.034-2.237 1.571-4.416 4.827-4.416 1.257 0 1.875.361 1.875.361l-.945 2.715-.02.01zM11.17.83c.136 0 .271.038.405.135-.984.465-2.064 1.639-2.508 3.992-.656.213-1.293.405-1.889.578C7.697 3.75 8.951.84 11.17.84V.83zm1.235 2.949v.135c-.754.232-1.583.484-2.394.736.466-1.777 1.333-2.645 2.085-2.971.193.501.309 1.176.309 2.1zm.539-2.234c.694.074 1.141.867 1.429 1.755-.349.114-.735.231-1.158.366v-.252c0-.752-.096-1.371-.271-1.871v.002zm2.992 1.289c-.02 0-.06.021-.078.021s-.289.075-.714.21c-.423-1.233-1.176-2.37-2.508-2.37h-.115C12.135.209 11.669 0 11.265 0 8.159 0 6.675 3.877 6.21 5.846c-1.194.365-2.063.636-2.16.674-.675.213-.694.232-.772.87-.075.462-1.83 14.063-1.83 14.063L15.009 24l.927-21.166z" />
    </svg>
  );
}

function VercelLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="#171717" aria-hidden="true">
      <path d="m12 1.608 12 20.784H0Z" />
    </svg>
  );
}

function AirtableLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="#18BFFF" aria-hidden="true">
      <path d="M11.992 1.966c-.434 0-.87.086-1.28.257L1.779 5.917c-.503.208-.49.908.012 1.116l8.982 3.558a3.266 3.266 0 0 0 2.454 0l8.982-3.558c.503-.196.503-.908.012-1.116l-8.957-3.694a3.255 3.255 0 0 0-1.272-.257zM23.4 8.056a.589.589 0 0 0-.222.045l-10.012 3.877a.612.612 0 0 0-.38.564v8.896a.6.6 0 0 0 .821.552L23.62 18.1a.583.583 0 0 0 .38-.551V8.653a.6.6 0 0 0-.6-.596zM.676 8.095a.644.644 0 0 0-.48.19C.086 8.396 0 8.53 0 8.69v8.355c0 .442.515.737.908.54l6.27-3.006.307-.147 2.969-1.436c.466-.22.43-.908-.061-1.092L.883 8.138a.57.57 0 0 0-.207-.044z" />
    </svg>
  );
}

function HubSpotLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="#FF7A59" aria-hidden="true">
      <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z" />
    </svg>
  );
}

function ClickUpLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="#7B68EE" aria-hidden="true">
      <path d="M2 18.439l3.69-2.828c1.961 2.56 4.044 3.739 6.363 3.739 2.307 0 4.33-1.166 6.203-3.704L22 18.405C19.298 22.065 15.941 24 12.053 24 8.178 24 4.788 22.078 2 18.439zM12.04 6.15l-6.568 5.66-3.036-3.52L12.055 0l9.543 8.296-3.05 3.509z" />
    </svg>
  );
}

function WebflowLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="#146EF5" aria-hidden="true">
      <path d="m24 4.515-7.658 14.97H9.149l3.205-6.204h-.144C9.566 16.713 5.621 18.973 0 19.485v-6.118s3.596-.213 5.71-2.435H0V4.515h6.417v5.278l.144-.001 2.622-5.277h4.854v5.244h.144l2.72-5.244H24Z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M8 3v10M3 8h10" />
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
/* ui-data-table — composed into this item */
.ui-dt{--ui-dt-card: #fffdfb;--ui-dt-line: #eae2d9;--ui-dt-grid: #eee6de;--ui-dt-ink: #1c1713;--ui-dt-text: #3d3226;--ui-dt-muted: #857567;--ui-dt-faint: #a5988d;--ui-dt-hover: #faf7f4;--ui-dt-selected: #faf7f4;--ui-dt-accent: #ff6b35;--ui-dt-range: rgba(255, 107, 53, 0.07);--ui-dt-tray: #eee6de;--ui-dt-accent-ink: #ff6b35;--ui-dt-border: #ded4ca;--ui-dt-col-active: #fdfaf8;--ui-dt-th-hover: #f5efe8;--ui-dt-active-blur: #ffb28f;--ui-dt-edit: #fffdfb;--ui-dt-pop: #fffdfb;--ui-dt-pop-ring: #ded4ca;--ui-dt-option-hover: #f4ece5;--ui-dt-check-bg: #fffdfb;--ui-dt-check-border: #c6bab0;--ui-dt-check-border-hover: #96887a;--ui-dt-check-mark: #fffdfb;--ui-dt-underline: #c6bab0;--ui-dt-wash: rgba(11, 9, 8, 0.05);--ui-dt-wash-soft: rgba(11, 9, 8, 0.04);--ui-dt-danger: #e2544a;--ui-dt-danger-hover: #b3261e;--ui-dt-danger-wash: rgba(226, 84, 74, 0.08);--ui-dt-card-shadow: 0 1px 2px rgba(11, 9, 8, 0.06);--ui-dt-pop-shadow: 0 10px 28px -8px rgba(11, 9, 8, 0.18);box-sizing: border-box;width: 100%;min-width: 0;background: var(--ui-dt-tray);padding: 6px;border-radius: 22px;font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;color: var(--ui-dt-ink);-webkit-font-smoothing: antialiased}
.ui-dt *, .ui-dt *::before, .ui-dt *::after{box-sizing: border-box}
.ui-dt button{margin: 0;font: inherit;color: inherit;cursor: pointer}
.ui-dt__head{display: flex;align-items: center;gap: 10px;padding: 9px 10px 8px 18px;min-height: 46px}
.ui-dt__title{margin: 0;font-size: 15px;font-weight: 500;line-height: 22px;letter-spacing: -0.01em}
.ui-dt__title-icon{display: grid}
.ui-dt__title-icon svg{width: 18px;height: 18px}
.ui-dt__tools{display: flex;gap: 2px;margin-left: auto}
.ui-dt__tool{display: grid;place-items: center;width: 28px;height: 28px;padding: 0;border: 0;border-radius: 8px;background: transparent;color: var(--ui-dt-text) !important;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dt__tool:hover:not(:disabled){background: var(--ui-dt-wash)}
.ui-dt__tool:disabled{opacity: 0.35;cursor: default}
.ui-dt__tool:focus-visible{outline: 2px solid var(--ui-dt-accent);outline-offset: 1px}
.ui-dt__card{overflow: hidden;background: var(--ui-dt-card);border: 1px solid var(--ui-dt-border);border-radius: 16px;box-shadow: var(--ui-dt-card-shadow)}
.ui-dt__scroll{overflow-x: auto;scrollbar-width: thin;outline: none}
.ui-dt__scroll[data-dragging]{cursor: cell;user-select: none}
.ui-dt__table{width: 100%;min-width: 640px;border-collapse: collapse;table-layout: fixed;font-size: 14px;line-height: 20px}
.ui-dt__table th, .ui-dt__table td{position: relative;height: 44px;padding: 0 14px;border-top: 1px solid var(--ui-dt-grid);border-left: 1px solid var(--ui-dt-grid);text-align: left;vertical-align: middle;white-space: nowrap;overflow: hidden;text-overflow: ellipsis}
.ui-dt__table th:first-child, .ui-dt__table td:first-child{border-left: 0}
.ui-dt__table th{padding: 0 6px;font-weight: 450;color: var(--ui-dt-muted);border-top: 0;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dt__table th[data-col-active]{background: var(--ui-dt-col-active)}
.ui-dt__th{display: flex;align-items: center;gap: 8px;width: 100%;height: 32px;padding: 0 8px;border: 0;border-radius: 8px;background: transparent;color: inherit !important;text-align: left;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dt__th:hover{background: var(--ui-dt-th-hover);color: var(--ui-dt-text) !important}
.ui-dt__th:focus-visible{outline: 2px solid var(--ui-dt-accent);outline-offset: -2px}
.ui-dt__th-label{overflow: hidden;text-overflow: ellipsis}
.ui-dt__col-icon{display: grid;color: var(--ui-dt-faint)}
.ui-dt__sort{display: grid;margin-left: auto;color: var(--ui-dt-faint);opacity: 0;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-3, 240ms) cubic-bezier(0.22, 1, 0.36, 1)}
.ui-dt__th:hover .ui-dt__sort{opacity: 1}
.ui-dt__sort[data-dir]{opacity: 1;color: var(--ui-dt-accent-ink)}
.ui-dt__sort[data-dir="asc"]{transform: rotate(180deg)}
.ui-dt__table .ui-dt__select{padding: 0;text-align: center}
.ui-dt__select .ui-dt__check{margin: 0 auto}
.ui-dt__table tbody tr{transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dt__table tbody tr:hover{background: var(--ui-dt-hover)}
.ui-dt__table tbody tr[data-selected]{background: var(--ui-dt-selected)}
.ui-dt__table td[data-cell]{cursor: cell}
.ui-dt__table td[data-in-range]{background: var(--ui-dt-range)}
.ui-dt__table td[data-active]::after{content: "";position: absolute;inset: 0;border: 2px solid var(--ui-dt-accent);border-radius: 3px;pointer-events: none}
.ui-dt__scroll:not(:focus-within) td[data-active]::after{border-color: var(--ui-dt-active-blur)}
.ui-dt__table td[data-editing]{padding: 0;overflow: visible;background: var(--ui-dt-edit)}
.ui-dt__input{width: 100%;height: 100%;padding: 0 14px;border: 0;outline: none;background: transparent;font: inherit;color: var(--ui-dt-ink)}
.ui-dt__table td[data-type="number"] .ui-dt__input{font-variant-numeric: tabular-nums}
.ui-dt__picker-anchor{display: block}
.ui-dt__picker{position: fixed;z-index: 50;display: grid;gap: 2px;padding: 4px;border-radius: 12px;background: var(--ui-dt-pop);box-shadow: 0 0 0 1px var(--ui-dt-pop-ring), var(--ui-dt-pop-shadow);animation: ui-dt-drop var(--nm-dur-2, 160ms) cubic-bezier(0.22, 1, 0.36, 1)}
.ui-dt__option{height: 30px;padding: 0 10px;border: 0;border-radius: 8px;background: transparent;font-size: 13px !important;text-align: left;color: var(--ui-dt-text) !important}
.ui-dt__option:hover, .ui-dt__option:focus-visible{background: var(--ui-dt-option-hover);outline: none}
.ui-dt__option[aria-selected="true"]{color: var(--ui-dt-accent-ink) !important;font-weight: 500}
.ui-dt__name{display: flex;align-items: center;gap: 10px;min-width: 0}
.ui-dt__name-text{overflow: hidden;text-overflow: ellipsis;color: var(--ui-dt-ink)}
.ui-dt__name-text[data-empty]{color: var(--ui-dt-faint)}
.ui-dt__logo{display: grid;place-items: center;flex: none;width: 18px;height: 18px}
.ui-dt__logo svg{width: 100%;height: 100%}
.ui-dt__logo--empty{border-radius: 5px;background: var(--ui-dt-grid)}
.ui-dt__check{display: grid;place-items: center;flex: none;width: 16px;height: 16px;padding: 0;border: 1px solid var(--ui-dt-check-border);border-radius: 5px;background: var(--ui-dt-check-bg);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), border-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dt__check:hover{border-color: var(--ui-dt-check-border-hover)}
.ui-dt__check:focus-visible{outline: 2px solid var(--ui-dt-accent);outline-offset: 2px}
.ui-dt__check svg{width: 12px;height: 12px;fill: none;stroke: var(--ui-dt-check-mark);stroke-width: 1.8;stroke-linecap: round;stroke-linejoin: round;opacity: 0;transform: scale(0.6);transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-3, 240ms) cubic-bezier(0.34, 1.56, 0.64, 1)}
.ui-dt__check[aria-checked="true"], .ui-dt__check[aria-checked="mixed"]{background: var(--ui-dt-ink);border-color: var(--ui-dt-ink)}
.ui-dt__check[aria-checked="true"] svg, .ui-dt__check[aria-checked="mixed"] svg{opacity: 1;transform: none}
.ui-dt__tag{display: inline-block;max-width: 100%;padding: 2px 9px;border-radius: 7px;font-size: 13px;font-weight: 450;line-height: 20px;overflow: hidden;text-overflow: ellipsis;vertical-align: middle}
.ui-dt__tag[data-tone="blue"]{background: #f6f0e9;color: #ff6b35;box-shadow: inset 0 0 0 1px #dce6ff}
.ui-dt__tag[data-tone="violet"]{background: #f7f2ec;color: #ff8a5c;box-shadow: inset 0 0 0 1px #e7dfff}
.ui-dt__tag[data-tone="pink"]{background: #f7f2ec;color: #b3261e;box-shadow: inset 0 0 0 1px #ede5dc}
.ui-dt__tag[data-tone="green"]{background: #f2eae2;color: #1a7a4a;box-shadow: inset 0 0 0 1px #dbd1c7}
.ui-dt__tag[data-tone="amber"]{background: #f2eae2;color: #d9541f;box-shadow: inset 0 0 0 1px #f2d19a}
.ui-dt__tag[data-tone="gray"]{background: #f4ece5;color: #4a3d2f;box-shadow: inset 0 0 0 1px #e8e0d8}
.ui-dt__link{color: var(--ui-dt-text);text-decoration: underline;text-decoration-color: var(--ui-dt-underline);text-underline-offset: 3px;transition: text-decoration-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dt__link:hover{color: var(--ui-dt-ink);text-decoration-color: currentColor}
.ui-dt__text{color: var(--ui-dt-text);font-variant-numeric: tabular-nums}
.ui-dt__empty{margin: 0;padding: 24px;font-size: 14px;text-align: center;color: var(--ui-dt-muted)}
.ui-dt__foot{display: flex;align-items: center;justify-content: space-between;gap: 12px;min-height: 44px;padding: 6px 16px 7px 8px}
.ui-dt__bulk{display: flex;align-items: center;gap: 4px;padding-left: 10px;font-size: 14px;font-weight: 500}
.ui-dt__bulk > span{margin-right: 6px}
.ui-dt__add{display: inline-flex;align-items: center;gap: 8px;height: 30px;padding: 0 10px;border: 0;border-radius: 8px;background: none;font-size: 14px;color: var(--ui-dt-muted) !important;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dt__add:hover{background: var(--ui-dt-wash-soft);color: var(--ui-dt-ink) !important}
.ui-dt__add--danger{color: var(--ui-dt-danger) !important}
.ui-dt__add--danger:hover{background: var(--ui-dt-danger-wash);color: var(--ui-dt-danger-hover) !important}
.ui-dt__add:focus-visible{outline: 2px solid var(--ui-dt-accent);outline-offset: 2px}
.ui-dt__summary{overflow: hidden;font-size: 13px;font-variant-numeric: tabular-nums;white-space: nowrap;text-overflow: ellipsis;color: var(--ui-dt-muted)}
@keyframes ui-dt-drop{from{opacity: 0;transform: translateY(-4px) scale(0.98)}
}
@media (prefers-reduced-motion: reduce){.ui-dt__table tbody tr, .ui-dt__check, .ui-dt__check svg, .ui-dt__sort{transition: none}
.ui-dt__picker{animation: none}
}
.ui-dt__morph{overflow: hidden}
.ui-dt__morph[data-smooth]{transition: height 380ms cubic-bezier(0.22, 1, 0.36, 1)}
@media (prefers-reduced-motion: reduce){.ui-dt__morph[data-smooth]{transition: none}
}
.ui-dt input:not([type="checkbox"]):not([type="radio"]):focus-visible, .ui-dt textarea:focus-visible, .ui-dt [contenteditable]:focus-visible{outline: none}
:where(.dark, [data-theme="dark"]) .ui-dt{--ui-dt-card: #27201a;--ui-dt-line: rgba(255, 253, 251, 0.08);--ui-dt-grid: rgba(255, 253, 251, 0.07);--ui-dt-ink: #ebe3da;--ui-dt-text: #b4a89d;--ui-dt-muted: #857567;--ui-dt-faint: #625244;--ui-dt-hover: rgba(255, 253, 251, 0.03);--ui-dt-selected: rgba(255, 107, 53, 0.12);--ui-dt-range: rgba(255, 107, 53, 0.16);--ui-dt-tray: #1c1713;--ui-dt-accent-ink: #ff8a5c;--ui-dt-border: rgba(255, 253, 251, 0.08);--ui-dt-col-active: rgba(255, 107, 53, 0.08);--ui-dt-th-hover: rgba(255, 253, 251, 0.06);--ui-dt-active-blur: rgba(255, 138, 92, 0.55);--ui-dt-edit: #2b231b;--ui-dt-pop: #2b231b;--ui-dt-pop-ring: rgba(255, 253, 251, 0.1);--ui-dt-option-hover: #33291f;--ui-dt-check-bg: #2b231b;--ui-dt-check-border: rgba(255, 253, 251, 0.2);--ui-dt-check-border-hover: rgba(255, 253, 251, 0.36);--ui-dt-check-mark: #191411;--ui-dt-underline: rgba(255, 253, 251, 0.22);--ui-dt-wash: rgba(255, 253, 251, 0.06);--ui-dt-wash-soft: rgba(255, 253, 251, 0.06);--ui-dt-danger: #e2544a;--ui-dt-danger-hover: #f0938c;--ui-dt-danger-wash: rgba(226, 84, 74, 0.14);--ui-dt-card-shadow: 0 1px 2px rgba(11, 9, 8, 0.4);--ui-dt-pop-shadow: 0 12px 30px -8px rgba(11, 9, 8, 0.55)}
:where(.dark, [data-theme="dark"]) .ui-dt__tag[data-tone="blue"]{background: rgba(255, 107, 53, 0.16);color: #ff8a5c;box-shadow: inset 0 0 0 1px rgba(255, 107, 53, 0.28)}
:where(.dark, [data-theme="dark"]) .ui-dt__tag[data-tone="violet"]{background: rgba(255, 138, 92, 0.18);color: #ff8a5c;box-shadow: inset 0 0 0 1px rgba(255, 138, 92, 0.3)}
:where(.dark, [data-theme="dark"]) .ui-dt__tag[data-tone="pink"]{background: rgba(226, 84, 74, 0.16);color: #e2544a;box-shadow: inset 0 0 0 1px rgba(226, 84, 74, 0.28)}
:where(.dark, [data-theme="dark"]) .ui-dt__tag[data-tone="green"]{background: rgba(47, 141, 92, 0.14);color: #4f9d6e;box-shadow: inset 0 0 0 1px rgba(47, 141, 92, 0.26)}
:where(.dark, [data-theme="dark"]) .ui-dt__tag[data-tone="amber"]{background: rgba(217, 149, 48, 0.14);color: #e8b05c;box-shadow: inset 0 0 0 1px rgba(217, 149, 48, 0.26)}
:where(.dark, [data-theme="dark"]) .ui-dt__tag[data-tone="gray"]{background: #2b231b;color: #b4a89d;box-shadow: inset 0 0 0 1px rgba(255, 253, 251, 0.08)}
.ui-as-crm{display: flex;flex-direction: column;height: 100%;min-height: 0;padding: 0 0 12px}
.ui-as-crm__top{display: flex;flex: none;align-items: center;gap: 6px;height: 52px;padding: 0 16px 0 20px}
.ui-as-crm__path{display: flex;align-items: center;gap: 8px;font-size: 13.5px;color: var(--muted)}
.ui-as-crm__path i{font-style: normal;color: var(--faint)}
.ui-as-crm__view{display: inline-flex;align-items: center;gap: 4px;height: 26px;margin-left: -6px;padding: 0 6px;border-radius: 7px;font-weight: 500;color: var(--ink);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-crm__view:hover{background: var(--hover)}
.ui-as-crm__star{width: 26px;height: 26px}
.ui-as-crm__star[aria-pressed="true"]{color: #d99530}
.ui-as-crm__star[aria-pressed="true"] path{fill: currentColor}
.ui-as-crm__tabs{display: flex;flex: none;align-items: center;gap: 4px;padding: 0 14px 12px}
.ui-as-crm__sep{width: 1px;height: 18px;margin: 0 6px;background: var(--line)}
.ui-as-crm__tab{display: inline-flex;align-items: center;gap: 8px;height: 32px;padding: 0 12px 0 10px;border-radius: 9px;font-size: 13.5px;color: var(--muted);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-crm__tab:hover{color: var(--ink);background: var(--hover)}
.ui-as-crm__tab[aria-current="page"]{background: var(--chip);color: var(--ink);font-weight: 500}
.ui-as-crm__table{flex: 1;min-height: 0;margin: 0 12px;overflow: auto;border-radius: 14px;background: var(--card);box-shadow: 0 0 0 1px var(--line), var(--shadow)}
.ui-as .ui-as-crm__table .ui-dt{--ui-dt-card-shadow: none;padding: 0;border-radius: 0;background: transparent}
.ui-as-crm__table .ui-dt__head{padding: 14px 18px 12px}
.ui-as-crm__table .ui-dt__card{border: 0;border-top: 1px solid var(--line);border-bottom: 1px solid var(--line);border-radius: 0}
.ui-as-crm__table > *{animation: ui-as-rise 380ms var(--ease) both}
.ui-as-board{display: grid;grid-template-columns: repeat(5, minmax(0, 1fr));gap: 12px;padding: 16px}
.ui-as-board__col{display: flex;flex-direction: column;gap: 8px;min-width: 0;padding: 10px;border-radius: 12px;background: var(--chip)}
.ui-as-board__col header{display: flex;align-items: center;gap: 7px;padding: 2px 4px 4px;font-size: 13px;font-weight: 500;color: var(--ink)}
.ui-as-board__dot{width: 7px;height: 7px;border-radius: 50%;background: #96887a}
.ui-as-board__dot[data-tone="blue"]{background: #ff6b35}
.ui-as-board__dot[data-tone="violet"]{background: #ff8a5c}
.ui-as-board__dot[data-tone="amber"]{background: #d99530}
.ui-as-board__dot[data-tone="green"]{background: #2f8d5c}
.ui-as-board__count{font-weight: 400;color: var(--faint)}
.ui-as-board__sum{margin-left: auto;font-size: 12px;font-weight: 400;color: var(--muted);font-variant-numeric: tabular-nums}
.ui-as-board__card{display: grid;gap: 4px;padding: 10px 12px;border-radius: 10px;background: var(--card);box-shadow: 0 0 0 1px var(--line), var(--shadow);transition: box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-2, 160ms) var(--ease)}
.ui-as-board__card:hover{transform: translateY(-1px);box-shadow: 0 0 0 1px var(--line-strong), 0 4px 12px rgba(11, 9, 8, 0.06)}
.ui-as-board__name{display: flex;align-items: center;gap: 8px;font-size: 13.5px;font-weight: 500;color: var(--ink)}
.ui-as-board__logo{display: block;width: 20px;height: 20px}
.ui-as-board__card b{font-size: 14px;font-weight: 500;color: var(--ink);font-variant-numeric: tabular-nums}
.ui-as-board__meta{font-size: 12px;color: var(--muted)}
.ui-as-pixel{padding: 28px 28px 32px}
.ui-as-pixel p{max-width: 640px}
.ui-as-pixel h2{margin: 0;font-size: 16px;font-weight: 500;color: var(--ink)}
.ui-as-pixel p{margin: 6px 0 0;font-size: 13.5px;line-height: 20px;color: var(--muted)}
.ui-as-pixel__code{position: relative;margin-top: 18px;border-radius: 12px;background: var(--subtle);box-shadow: inset 0 0 0 1px var(--line)}
.ui-as-pixel__code pre{margin: 0;padding: 16px 18px;overflow-x: auto;font-family: ui-monospace, "SF Mono", Menlo, monospace;font-size: 12.5px;line-height: 20px;color: var(--ink)}
.ui-as-pixel__code .ui-as-tool{position: absolute;top: 10px;right: 10px;background: var(--card)}
.ui-as-pixel__status{display: flex;align-items: center;gap: 12px;margin-top: 14px;padding: 12px 14px;border-radius: 12px;box-shadow: inset 0 0 0 1px var(--line);font-size: 13px;color: var(--muted)}
.ui-as-pixel__status > span:nth-child(2){display: grid;flex: 1;gap: 1px}
.ui-as-pixel__status b{font-weight: 500;color: var(--ink)}
.ui-as-pixel__light{width: 9px;height: 9px;border-radius: 50%;background: #d99530;box-shadow: 0 0 0 4px rgba(217, 149, 48, 0.15)}
.ui-as-pixel__status[data-state="busy"] .ui-as-pixel__light{animation: ui-as-blink var(--nm-dur-5, 620ms) ease-in-out infinite alternate}
.ui-as-pixel__status[data-state="ok"] .ui-as-pixel__light{background: #2f8d5c;box-shadow: 0 0 0 4px rgba(47, 141, 92, 0.15)}
@keyframes ui-as-blink{to{opacity: 0.3}
}
.ui-as-crm-docs{display: flex;flex-wrap: wrap;gap: 12px;padding: 18px}
.ui-as-crm__logo{display: grid;place-items: center;width: 100%;height: 100%;border-radius: 5px;background: #ffffff;box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08)}
.ui-as-crm__logo svg{width: 64%;height: 64%}
.ui-as-crm__tab-logo{display: grid;flex: none;place-items: center;width: 18px;height: 18px;border-radius: 5px}
.ui-as-crm__tab-logo svg{width: 11px;height: 11px}
.ui-as-crm__top{transition: padding-left var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-app[data-collapsed] .ui-as-crm__top{padding-left: 52px}
@container ui-as (max-width: 900px){.ui-as-crm__top{padding-left: 52px}
.ui-as-crm__tabs{position: relative;overflow-x: auto;scrollbar-width: none}
.ui-as-crm__tabs::-webkit-scrollbar{display: none}
.ui-as-crm__tabs > *{flex: none}
.ui-as-crm__table .ui-dt__table{min-width: 880px}
.ui-as-board{grid-template-columns: repeat(5, 232px);width: max-content}
}
@container ui-as (max-width: 600px){.ui-as-crm{padding-bottom: 6px}
.ui-as-crm__top{padding-right: 8px}
.ui-as-crm__tabs{padding: 0 8px 10px}
.ui-as-crm__table{margin: 0 6px;border-radius: 12px}
.ui-as-crm__table .ui-dt__head{padding: 12px 14px 10px}
.ui-as-board{grid-template-columns: repeat(5, 216px);padding: 12px}
.ui-as-pixel{padding: 20px 16px 24px}
.ui-as-pixel__code pre{padding-top: 52px}
.ui-as-pixel__status{flex-wrap: wrap}
.ui-as-pixel__status > span:nth-child(2){flex-basis: calc(100% - 30px)}
.ui-as-crm-docs{padding: 14px}
}

`;
