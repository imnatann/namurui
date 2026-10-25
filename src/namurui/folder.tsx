"use client";

import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";

/*
 * Folder Screen – one folder inside the app shell, in a single self-contained file.
 * A breadcrumb and a back link sit above the header, where the glass folder, the folder name
 * and Share / Upload live. The files are paper previews – a document, a PDF or a sheet, each
 * tinted by data-color – rising in on a 35 ms stagger. The sidebar carries the workspace, the
 * menu, the projects, the news card, the collapsed checklist and the account; an empty folder
 * swaps the grid for the dashed empty state. Files are data and every control is a real button.
 */

/** Badge on a file preview; also picks the layout drawn on the page */
export type FolderFileExt = "DOC" | "PDF" | "XLS";

/** Tint of the paper stack behind the sheet */
export type FolderFileColor = "blue" | "rose" | "emerald";

export type FolderFile = {
  /** Stable key for the card */
  id: string;
  /** Name printed under the preview */
  name: string;
  /** Document, PDF or sheet */
  ext: FolderFileExt;
  /** Tint of the stack behind the sheet */
  color: FolderFileColor;
  /** When the file changed, e.g. "2 hours ago" */
  time: string;
  /** Replaces the whole "Document · 2 hours ago" line when given */
  meta?: string;
};

/** The card at the bottom of the sidebar, stacked two high */
export type FolderNews = {
  /** Small accent line at the top */
  kicker: string;
  /** Headline */
  title: string;
  /** Footer link */
  more: string;
  /** Stacked cards; 2 tucks the back card in above */
  count?: number;
};

/** The collapsed onboarding checklist above the account */
export type FolderGuide = {
  /** Checklist title */
  title: string;
  /** Completion, 0–100 */
  percent: number;
  /** Accent note after the percentage */
  cheer: string;
  /** Height of the collapsed card in px */
  height?: number;
};

export type FolderScreenProps = {
  /** Folder that is open; also the last breadcrumb */
  folder?: string;
  /** Crumb labels above it, each a button */
  trail?: string[];
  /** Label of the back link that leaves the folder */
  backLabel?: string;
  /** Files in the folder, in display order */
  files?: FolderFile[];
  /** Copy for the state shown when the folder is empty */
  empty?: { title: string; text: string };
  /** Workspace name; its first letter becomes the logo tile */
  workspace?: string;
  /** Project list under the menu */
  projects?: string[];
  /** Label marked current in the sidebar; falls back to the folder */
  active?: string;
  /** Account at the bottom of the sidebar */
  user?: { name: string; initials: string };
  /** "New in …" card, or null to leave it out */
  news?: FolderNews | null;
  /** Onboarding checklist, or null to leave it out */
  guide?: FolderGuide | null;
  /** Folds the sidebar to the icon rail; the screen keeps its own state when omitted */
  collapsed?: boolean;
  /** Called with the sidebar's new folded state */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Extra class on the root */
  className?: string;
  /** Called with the label of a crumb, menu item or project */
  onNavigate?: (label: string) => void;
  /** Called when the back link is used */
  onBack?: () => void;
  /** Called with the file whose card was picked */
  onOpenFile?: (file: FolderFile) => void;
  /** Called when Share is picked */
  onShare?: () => void;
  /** Called when the overflow button is picked */
  onMore?: () => void;
  /** Called with the files picked in the hidden input */
  onUpload?: (files: File[]) => void;
  /** Called when the news card is dismissed */
  onDismissNews?: () => void;
  /** Called when the checklist is opened */
  onOpenGuide?: () => void;
  /** Called when the account is picked */
  onAccount?: () => void;
  /** Called when the workspace switcher is picked */
  onWorkspace?: () => void;
  /** Called when the sidebar search button is picked */
  onSearch?: () => void;
};

const DEFAULT_FILES: FolderFile[] = [
  { id: "campaign-brief", name: "Campaign-Brief", ext: "DOC", color: "blue", time: "2 hours ago" },
  { id: "launch-plan", name: "Launch-Plan", ext: "PDF", color: "rose", time: "Yesterday" },
  { id: "media-budget", name: "Media-Budget", ext: "XLS", color: "emerald", time: "Yesterday" },
  { id: "ad-copy", name: "Ad-Copy", ext: "DOC", color: "blue", time: "3 days ago" },
  { id: "results-q2", name: "Results-Q2", ext: "XLS", color: "emerald", time: "Last week" },
];

const DEFAULT_PROJECTS = ["Q3 Campaign", "Brand assets", "Hiring", "Research"];

const DEFAULT_USER = { name: "Alex Morgan", initials: "AM" };

const DEFAULT_NEWS: FolderNews = {
  kicker: "New in Acme",
  title: "Shared folders",
  more: "Full changelog",
  count: 2,
};

const DEFAULT_GUIDE: FolderGuide = {
  title: "Getting started",
  percent: 13,
  cheer: "Great start!",
};

const DEFAULT_EMPTY = {
  title: "No files yet",
  text: "Drop a brief, a plan or a budget here — everything in this folder is shared with the campaign team.",
};

/** What each type is called under the file name */
const KIND: Record<FolderFileExt, string> = {
  DOC: "Document",
  PDF: "PDF",
  XLS: "Spreadsheet",
};

/** Ruled-line widths on a written page; the sheet is drawn as a grid instead */
const LINES: Record<"DOC" | "PDF", number[]> = {
  DOC: [100, 86, 94, 70, 88],
  PDF: [100, 82, 92],
};

const SHEET_CELLS = 18;

export function FolderScreen({
  folder = "Q3 Campaign",
  trail = ["Files"],
  backLabel = "Files",
  files = DEFAULT_FILES,
  empty = DEFAULT_EMPTY,
  workspace = "Acme",
  projects = DEFAULT_PROJECTS,
  active,
  user = DEFAULT_USER,
  news = DEFAULT_NEWS,
  guide = DEFAULT_GUIDE,
  collapsed,
  onCollapsedChange,
  className,
  onNavigate,
  onBack,
  onOpenFile,
  onShare,
  onMore,
  onUpload,
  onDismissNews,
  onOpenGuide,
  onAccount,
  onWorkspace,
  onSearch,
}: FolderScreenProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [ownCollapsed, setOwnCollapsed] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const current = active ?? folder;
  const guideHeight = guide ? (guide.height ?? 70) : 0;

  /* Measured, not assumed: under 900px of sheet width the sidebar becomes a drawer */
  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      setNarrow((entries[0]?.contentRect.width ?? 0) < 900);
    });
    observer.observe(node);
    setNarrow(node.getBoundingClientRect().width < 900);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!narrow) setDrawerOpen(false);
  }, [narrow]);

  /* Escape closes the drawer, the way it closes any overlay in the app */
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  const isCollapsed = (collapsed ?? ownCollapsed) && !narrow;

  const foldSide = (next: boolean) => {
    if (collapsed === undefined) setOwnCollapsed(next);
    onCollapsedChange?.(next);
  };

  const openSide = () => {
    if (narrow) {
      setDrawerOpen(true);
      return;
    }
    foldSide(false);
  };

  const closeSide = () => {
    if (narrow) {
      setDrawerOpen(false);
      return;
    }
    foldSide(true);
  };

  const go = (label: string) => {
    onNavigate?.(label);
    if (narrow) setDrawerOpen(false);
  };

  const handlePicked = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.currentTarget.files ?? []);
    if (picked.length > 0) onUpload?.(picked);
    /* Clearing the value lets the same file be picked twice in a row */
    event.currentTarget.value = "";
  };

  return (
    <div
      ref={rootRef}
      className={["ui-as ui-as-app", className].filter(Boolean).join(" ")}
      data-collapsed={isCollapsed || undefined}
      data-drawer={drawerOpen || undefined}
    >
      {/* React 19 hoists this into <head> once, no matter how many screens render */}
      <style href="ui-screen-folder" precedence="default">
        {css}
      </style>

      <button
        className="ui-as-icon-btn ui-as-side-open"
        type="button"
        aria-label="Open sidebar"
        tabIndex={isCollapsed || narrow ? 0 : -1}
        onClick={openSide}
      >
        <Glyph name="panel" />
      </button>
      <div className="ui-as-scrim" aria-hidden="true" onClick={() => setDrawerOpen(false)} />

      <aside className="ui-as-side" inert={isCollapsed || (narrow && !drawerOpen) ? true : undefined}>
        <header className="ui-as-side__head">
          <span className="ui-as-anchor">
            <button className="ui-as-side__workspace" type="button" aria-expanded="false" onClick={onWorkspace}>
              <span className="ui-as-side__logo">{workspace.slice(0, 1).toUpperCase()}</span>
              {workspace}
              <Glyph name="chevron-down" size={13} />
            </button>
          </span>
          <span className="ui-as-side__tools">
            <button className="ui-as-icon-btn" type="button" aria-label="Search" onClick={onSearch}>
              <Glyph name="search" />
            </button>
            <button
              className="ui-as-icon-btn"
              type="button"
              aria-label="Collapse sidebar"
              onClick={closeSide}
            >
              <Glyph name="panel" />
            </button>
          </span>
        </header>

        <nav className="ui-as-side__nav" aria-label="Main menu">
          <div className="ui-as-side__group">
            <button type="button" className="ui-as-side__item" onClick={() => go("New chat")}>
              <Glyph name="chat" />
              New chat
            </button>
            <button type="button" className="ui-as-side__item" onClick={() => go("Folders")}>
              <Glyph name="folders" />
              Folders
            </button>
            <button type="button" className="ui-as-side__item" onClick={() => go("Integrations")}>
              <Glyph name="integrations" />
              Integrations
            </button>
          </div>
          <span className="ui-as-side__label">Projects</span>
          {projects.map((project) => (
            <button
              key={project}
              type="button"
              className="ui-as-side__item"
              aria-current={project === current ? "page" : undefined}
              onClick={() => go(project)}
            >
              <Glyph name="project" />
              {project}
            </button>
          ))}
        </nav>

        <div className="ui-as-side__foot">
          {news ? (
            <div className="ui-as-news" data-count={news.count ?? 2}>
              <div className="ui-as-news__card ui-as-news__card--back" aria-hidden="true">
                <span className="ui-as-news__kicker">{news.kicker}</span>
                <Glyph name="close" size={13} />
              </div>
              <div className="ui-as-news__card">
                <div className="ui-as-news__top">
                  <span className="ui-as-news__kicker">{news.kicker}</span>
                  <button type="button" className="ui-as-news__close" aria-label="Dismiss" onClick={onDismissNews}>
                    <Glyph name="close" size={13} />
                  </button>
                </div>
                <b className="ui-as-news__title">{news.title}</b>
                <button type="button" className="ui-as-news__more" onClick={() => go(news.more)}>
                  {news.more}
                  <Glyph name="chevron-right" size={13} />
                </button>
              </div>
            </div>
          ) : null}

          {guide ? (
            <div className="ui-as-guide-slot" style={{ height: guideHeight }}>
              <div className="ui-as-guide" data-state="closed" style={{ height: guideHeight }}>
                <div className="ui-as-guide__inner">
                  <button
                    type="button"
                    className="ui-as-steps ui-as-guide__content"
                    aria-expanded="false"
                    onClick={onOpenGuide}
                  >
                    <span className="ui-as-steps__title">
                      {guide.title}
                      <Glyph name="chevron-right" size={13} />
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
          ) : null}

          <span className="ui-as-anchor ui-as-user-menu">
            <button type="button" className="ui-as-user" aria-expanded="false" onClick={onAccount}>
              <span className="ui-as-user__initials">{user.initials}</span>
              {user.name}
              <Glyph name="chevron-down" size={13} />
            </button>
          </span>
        </div>
      </aside>

      <main className="ui-as-main">
        <nav className="ui-as-crumbs" aria-label="Breadcrumb">
          {trail.map((label) => (
            <Fragment key={label}>
              <button type="button" onClick={() => go(label)}>
                {label}
              </button>
              <i>/</i>
            </Fragment>
          ))}
          <span aria-current="page">{folder}</span>
        </nav>

        <div className="ui-as-page ui-as-page--folder">
          <button
            type="button"
            className="ui-as-back"
            onClick={() => {
              onBack?.();
              if (narrow) setDrawerOpen(false);
            }}
          >
            <Glyph name="back" size={14} />
            {backLabel}
          </button>

          <header className="ui-as-folder-head">
            <span className="ui-as-folder-head__icon">
              <FolderArt />
            </span>
            <h1 className="ui-as-page-title">{folder}</h1>
            <span className="ui-as-folder-head__actions">
              <span className="ui-as-anchor">
                <button
                  type="button"
                  className="ui-button"
                  data-variant="ghost"
                  data-size="sm"
                  data-icon-only="true"
                  aria-label="More"
                  data-ready="true"
                  onClick={onMore}
                >
                  <span className="ui-button__icon" aria-hidden="true">
                    <Glyph name="more" />
                  </span>
                </button>
              </span>
              <button
                type="button"
                className="ui-button"
                data-variant="secondary"
                data-size="sm"
                data-ready="true"
                onClick={onShare}
              >
                <span className="ui-button__icon" aria-hidden="true">
                  <Glyph name="share" size={15} />
                </span>
                <span className="ui-button__label" data-text="Share">
                  Share
                </span>
              </button>
              <button
                type="button"
                className="ui-button"
                data-variant="primary"
                data-size="sm"
                data-ready="true"
                onClick={() => fileInput.current?.click()}
              >
                <span className="ui-button__icon" aria-hidden="true">
                  <Glyph name="upload" size={15} />
                </span>
                <span className="ui-button__label" data-text="Upload files">
                  Upload files
                </span>
              </button>
              <input multiple hidden type="file" ref={fileInput} onChange={handlePicked} />
            </span>
          </header>

          {files.length > 0 ? (
            <div className="ui-as-folder-files ui-as-file-grid">
              {files.map((file, index) => (
                <div key={file.id} className="ui-as-rise" style={{ "--i": index } as CSSProperties}>
                  <button type="button" className="ui-as-template" onClick={() => onOpenFile?.(file)}>
                    <span className="ui-as-template__preview">
                      <FileArt file={file} />
                    </span>
                    <b className="ui-as-template__name">{file.name}</b>
                    <span className="ui-as-meta">{file.meta ?? `${KIND[file.ext]} · ${file.time}`}</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="ui-as-empty">
              <span className="ui-as-empty__icon">
                <Glyph name="folders" size={20} />
              </span>
              <b className="ui-as-empty__title">{empty.title}</b>
              <p className="ui-as-empty__text">{empty.text}</p>
              <button
                type="button"
                className="ui-button"
                data-variant="primary"
                data-size="sm"
                data-ready="true"
                onClick={() => fileInput.current?.click()}
              >
                <span className="ui-button__icon" aria-hidden="true">
                  <Glyph name="upload" size={15} />
                </span>
                <span className="ui-button__label" data-text="Upload files">
                  Upload files
                </span>
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ---------- Paper preview ---------- */

function FileArt({ file }: { file: FolderFile }) {
  return (
    <span className="ui-as-doc" data-color={file.color} aria-hidden="true">
      <span className="ui-as-doc__art">
        <span className="ui-as-doc__back" />
        <span className="ui-as-doc__page" data-type={file.ext}>
          {file.ext === "XLS" ? (
            <span className="ui-as-sheet">
              {Array.from({ length: SHEET_CELLS }, (_, cell) => (
                <i key={cell} />
              ))}
            </span>
          ) : (
            <>
              {file.ext === "PDF" ? (
                <span className="ui-as-doc__image" />
              ) : (
                <i className="ui-as-doc__title" />
              )}
              {LINES[file.ext].map((width) => (
                <i key={width} className="ui-as-doc__line" style={{ width: `${width}%` }} />
              ))}
            </>
          )}
        </span>
        <span className="ui-as-doc__type">{file.ext}</span>
      </span>
    </span>
  );
}

/* ---------- Glass folder ---------- */

function FolderArt() {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `ui-fd${uid}-${name}`;

  return (
    <div className="ui-fd" role="img" aria-label="">
      <div className="ui-fd-icon" aria-hidden="true">
        {/* Back of the folder, plus a bright rim traced by the highlight filter */}
        <svg className="ui-fd-layer ui-fd-back" viewBox="0 0 600 500">
          <defs>
            <filter id={id("hl")} x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur" />
              <feOffset in="blur" dy="3" result="offset" />
              <feComposite in="blur" in2="offset" operator="arithmetic" k2="1" k3="-1" result="diff" />
              <feFlood floodColor="#fff" floodOpacity="0.65" />
              <feComposite in2="diff" operator="in" result="light" />
              <feComposite in="light" in2="SourceAlpha" operator="in" />
            </filter>
          </defs>
          <path className="ui-fd-back-fill" d={FOLDER} fill="#5bb7ea" />
          <path d={FOLDER} fill="#000" filter={`url(#${id("hl")})`} />
        </svg>

        {/* The sheets, each one placed and turned by its own modifier class */}
        <svg className="ui-fd-layer" viewBox="0 0 600 500">
          <defs>
            <linearGradient id={id("paper")} x1="0" y1="0" x2="0" y2="1">
              <stop className="ui-fd-paper-top" offset="0%" stopColor="#fff" />
              <stop className="ui-fd-paper-bottom" offset="100%" stopColor="#eaf2f8" />
            </linearGradient>
            <symbol id={id("doc")} overflow="visible">
              <rect
                className="ui-fd-paper"
                x="0.6"
                y="0.6"
                width="278.8"
                height="348.8"
                rx="19.4"
                fill={`url(#${id("paper")})`}
                stroke="rgba(0,0,0,0.12)"
                strokeWidth="1.2"
              />
              {PAPER_LINES.map((line) => (
                <rect
                  key={line.y}
                  className="ui-fd-line"
                  x="30"
                  y={line.y}
                  width={line.width}
                  height="9"
                  rx="4.5"
                  fill="rgba(0,0,0,0.12)"
                />
              ))}
            </symbol>
          </defs>
          <use className="ui-fd-doc ui-fd-doc--left" href={`#${id("doc")}`} />
          <use className="ui-fd-doc ui-fd-doc--right" href={`#${id("doc")}`} />
          <use className="ui-fd-doc ui-fd-doc--middle" href={`#${id("doc")}`} />
        </svg>

        {/* Frosted pocket: tips forward on hover, so the sheets peek out of the opening */}
        <div className="ui-fd-front" />
      </div>
    </div>
  );
}

/* ---------- Icons ---------- */

/** One vocabulary for the screen's line icons, so the SVG wrapper attrs can never drift */
type GlyphName =
  | "panel"
  | "chevron-down"
  | "chevron-right"
  | "search"
  | "close"
  | "chat"
  | "folders"
  | "integrations"
  | "project"
  | "back"
  | "more"
  | "share"
  | "upload";

const PANEL =
  "M2 12C2 8.31087 2 6.4663 2.81382 5.15877C3.1149 4.67502 3.48891 4.25427 3.91891 3.91554C5.08116 3 6.72077 3 10 3H14C17.2792 3 18.9188 3 20.0811 3.91554C20.5111 4.25427 20.8851 4.67502 21.1862 5.15877C22 6.4663 22 8.31087 22 12C22 15.6891 22 17.5337 21.1862 18.8412C20.8851 19.325 20.5111 19.7457 20.0811 20.0845C18.9188 21 17.2792 21 14 21H10C6.72077 21 5.08116 21 3.91891 20.0845C3.48891 19.7457 3.1149 19.325 2.81382 18.8412C2 17.5337 2 15.6891 2 12Z";

const CHEVRON_DOWN = "M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9";
const CHEVRON_RIGHT = "M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18";

const CHAT =
  "M16.4249 4.60509L17.4149 3.6151C18.2351 2.79497 19.5648 2.79497 20.3849 3.6151C21.205 4.43524 21.205 5.76493 20.3849 6.58507L19.3949 7.57506M16.4249 4.60509L9.76558 11.2644C9.25807 11.772 8.89804 12.4078 8.72397 13.1041L8 16L10.8959 15.276C11.5922 15.102 12.228 14.7419 12.7356 14.2344L19.3949 7.57506M16.4249 4.60509L19.3949 7.57506";

const CHAT_FRAME =
  "M18.9999 13.5C18.9999 16.7875 18.9999 18.4312 18.092 19.5376C17.9258 19.7401 17.7401 19.9258 17.5375 20.092C16.4312 21 14.7874 21 11.4999 21H11C7.22876 21 5.34316 21 4.17159 19.8284C3.00003 18.6569 3 16.7712 3 13V12.5C3 9.21252 3 7.56879 3.90794 6.46244C4.07417 6.2599 4.2599 6.07417 4.46244 5.90794C5.56879 5 7.21252 5 10.5 5";

const FOLDERS =
  "M8 7H16.75C18.8567 7 19.91 7 20.6667 7.50559C20.9943 7.72447 21.2755 8.00572 21.4944 8.33329C22 9.08996 22 10.1433 22 12.25C22 15.7612 22 17.5167 21.1573 18.7779C20.7926 19.3238 20.3238 19.7926 19.7779 20.1573C18.5167 21 16.7612 21 13.25 21H12C7.28595 21 4.92893 21 3.46447 19.5355C2 18.0711 2 15.714 2 11V7.94427C2 6.1278 2 5.21956 2.38032 4.53806C2.65142 4.05227 3.05227 3.65142 3.53806 3.38032C4.21956 3 5.1278 3 6.94427 3C8.10802 3 8.6899 3 9.19926 3.19101C10.3622 3.62712 10.8418 4.68358 11.3666 5.73313L12 7";

const INTEGRATIONS = [
  "M10.5 8.75V6.75C10.5 5.10626 10.5 4.28439 10.046 3.73121C9.96291 3.62995 9.87005 3.53709 9.76879 3.45398C9.21561 3 8.39374 3 6.75 3C5.10626 3 4.28439 3 3.73121 3.45398C3.62995 3.53709 3.53709 3.62995 3.45398 3.73121C3 4.28439 3 5.10626 3 6.75V8.75C3 10.3937 3 11.2156 3.45398 11.7688C3.53709 11.8701 3.62995 11.9629 3.73121 12.046C4.28439 12.5 5.10626 12.5 6.75 12.5C8.39374 12.5 9.21561 12.5 9.76879 12.046C9.87005 11.9629 9.96291 11.8701 10.046 11.7688C10.5 11.2156 10.5 10.3937 10.5 8.75Z",
  "M7.75 15.5H5.75C5.05222 15.5 4.70333 15.5 4.41943 15.5861C3.78023 15.78 3.28002 16.2802 3.08612 16.9194C3 17.2033 3 17.5522 3 18.25C3 18.9478 3 19.2967 3.08612 19.5806C3.28002 20.2198 3.78023 20.72 4.41943 20.9139C4.70333 21 5.05222 21 5.75 21H7.75C8.44778 21 8.79667 21 9.08057 20.9139C9.71977 20.72 10.22 20.2198 10.4139 19.5806C10.5 19.2967 10.5 18.9478 10.5 18.25C10.5 17.5522 10.5 17.2033 10.4139 16.9194C10.22 16.2802 9.71977 15.78 9.08057 15.5861C8.79667 15.5 8.44778 15.5 7.75 15.5Z",
  "M21 17.25V15.25C21 13.6063 21 12.7844 20.546 12.2312C20.4629 12.1299 20.3701 12.0371 20.2688 11.954C19.7156 11.5 18.8937 11.5 17.25 11.5C15.6063 11.5 14.7844 11.5 14.2312 11.954C14.1299 12.0371 14.0371 12.1299 13.954 12.2312C13.5 12.7844 13.5 13.6063 13.5 15.25V17.25C13.5 18.8937 13.5 19.7156 13.954 20.2688C14.0371 20.3701 14.1299 20.4629 14.2312 20.546C14.7844 21 15.6063 21 17.25 21C18.8937 21 19.7156 21 20.2688 20.546C20.3701 20.4629 20.4629 20.3701 20.546 20.2688C21 19.7156 21 18.8937 21 17.25Z",
  "M18.25 3H16.25C15.5522 3 15.2033 3 14.9194 3.08612C14.2802 3.28002 13.78 3.78023 13.5861 4.41943C13.5 4.70333 13.5 5.05222 13.5 5.75C13.5 6.44778 13.5 6.79667 13.5861 7.08057C13.78 7.71977 14.2802 8.21998 14.9194 8.41388C15.2033 8.5 15.5522 8.5 16.25 8.5H18.25C18.9478 8.5 19.2967 8.5 19.5806 8.41388C20.2198 8.21998 20.72 7.71977 20.9139 7.08057C21 6.79667 21 6.44778 21 5.75C21 5.05222 21 4.70333 20.9139 4.41943C20.72 3.78023 20.2198 3.28002 19.5806 3.08612C19.2967 3 18.9478 3 18.25 3Z",
];

const PROJECT_TOP =
  "M2.5 20V8.87695C2.5 7.58945 2.5 6.9457 2.78533 6.47048C2.9541 6.18939 3.18939 5.9541 3.47048 5.78533C3.9457 5.5 4.59449 5.5 5.89206 5.5C6.52339 5.5 6.83906 5.5 7.12612 5.58819C7.31759 5.64702 7.49914 5.73428 7.66469 5.84705C7.91289 6.01611 8.10859 6.26074 8.5 6.75C8.89141 7.23926 9.08711 7.48389 9.33531 7.65295C9.50086 7.76572 9.68241 7.85298 9.87388 7.91181C10.1609 8 10.4742 8 11.1008 8H15C16.4045 8 17.1067 8 17.6111 8.33706C17.8295 8.48298 18.017 8.67048 18.1629 8.88886C18.5 9.39331 18.5 10.0955 18.5 11.5";

const PROJECT_FRONT =
  "M4.42028 14.0144L3.63368 16.0144C2.65618 18.4998 2.16743 19.7425 2.7524 20.6213C3.33737 21.5 4.65337 21.5 7.28537 21.5H15.1903C16.4249 21.5 17.0422 21.5 17.5295 21.1795C18.0169 20.859 18.2702 20.2865 18.7769 19.1415L19.6618 17.1415C20.7866 14.5992 21.349 13.3281 20.7679 12.4141C20.1868 11.5 18.8163 11.5 16.0752 11.5H8.07196C6.78232 11.5 6.1375 11.5 5.63811 11.8439C5.13872 12.1877 4.89924 12.7966 4.42028 14.0144Z";

const PROJECT_BADGE =
  "M11.5 4.51456C12.4151 3.28409 13.6662 2.55594 15.5125 2.50161C16.1155 2.48386 16.7152 2.61395 17.2682 2.85544C18.5748 3.42601 19.4185 4.15644 20 5.5L21.5 3";

const MORE =
  "M6.00449 12.5V12M18.0045 12.5V12M12.0045 12.5V12M7.00449 12.5C7.00449 11.9477 6.55677 11.5 6.00449 11.5C5.4522 11.5 5.00449 11.9477 5.00449 12.5C5.00449 13.0523 5.4522 13.5 6.00449 13.5C6.55677 13.5 7.00449 13.0523 7.00449 12.5ZM19.0045 12.5C19.0045 11.9477 18.5568 11.5 18.0045 11.5C17.4522 11.5 17.0045 11.9477 17.0045 12.5C17.0045 13.0523 17.4522 13.5 18.0045 13.5C18.5568 13.5 19.0045 13.0523 19.0045 12.5ZM13.0045 12.5C13.0045 11.9477 12.5568 11.5 12.0045 11.5C11.4522 11.5 11.0045 11.9477 11.0045 12.5C11.0045 13.0523 11.4522 13.5 12.0045 13.5C12.5568 13.5 13.0045 13.0523 13.0045 12.5Z";

const UPLOAD_TRAY =
  "M5.25 21H18.75C18.9822 21 19.0983 21 19.196 20.9904C20.1456 20.8968 20.8968 20.1456 20.9904 19.196C21 19.0983 21 18.9822 21 18.75C21 18.5178 21 18.4017 20.9904 18.304C20.8968 17.3544 20.1456 16.6032 19.196 16.5096C19.0983 16.5 18.9822 16.5 18.75 16.5H17.0607C16.8324 16.5 16.7182 16.5 16.6087 16.5121C16.2317 16.5538 15.8742 16.7018 15.5781 16.939C15.4921 17.0079 15.4114 17.0886 15.25 17.25C15.0886 17.4114 15.0079 17.4921 14.9219 17.561C14.6258 17.7982 14.2683 17.9462 13.8913 17.9879C13.7818 18 13.6676 18 13.4393 18H10.5607C10.3324 18 10.2182 18 10.1087 17.9879C9.73165 17.9462 9.37423 17.7982 9.07814 17.561C8.99213 17.4921 8.91142 17.4114 8.75 17.25C8.58858 17.0886 8.50787 17.0079 8.42186 16.939C8.12577 16.7018 7.76835 16.5538 7.3913 16.5121C7.28177 16.5 7.16763 16.5 6.93934 16.5H5.25C5.01783 16.5 4.90175 16.5 4.80397 16.5096C3.85441 16.6032 3.10315 17.3544 3.00963 18.304C3 18.4017 3 18.5178 3 18.75C3 18.9822 3 19.0983 3.00963 19.196C3.10315 20.1456 3.85441 20.8968 4.80397 20.9904C4.90175 21 5.01783 21 5.25 21Z";

const UPLOAD_ARROW =
  "M16.5 7.49996C16.5 7.49996 13.1858 3.00001 12 3C10.8141 2.99999 7.5 7.5 7.5 7.5M12 4V15";

const GLYPHS: Record<GlyphName, ReactNode> = {
  panel: (
    <>
      <path d={PANEL} stroke="currentColor" strokeWidth="1.9" />
      <path d="M9.5 3L9.5 21" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M5 7H6M5 10H6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </>
  ),
  "chevron-down": (
    <path d={CHEVRON_DOWN} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
  ),
  "chevron-right": (
    <path d={CHEVRON_RIGHT} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
  ),
  search: (
    <>
      <path d="M17 17L21 21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path
        d="M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </>
  ),
  close: (
    <path
      d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    />
  ),
  chat: (
    <>
      <path d={CHAT} stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d={CHAT_FRAME} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </>
  ),
  folders: <path d={FOLDERS} stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />,
  integrations: (
    <>
      {INTEGRATIONS.map((d) => (
        <path key={d} d={d} stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      ))}
    </>
  ),
  project: (
    <>
      <path d={PROJECT_TOP} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d={PROJECT_FRONT} stroke="currentColor" strokeWidth="1.9" />
      <path d={PROJECT_BADGE} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </>
  ),
  back: (
    <>
      <path d="M5.5 12.002H19" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path
        d="M10.9999 18.002C10.9999 18.002 4.99998 13.583 4.99997 12.0019C4.99996 10.4208 11 6.00195 11 6.00195"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </>
  ),
  more: <path d={MORE} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />,
  share: (
    <>
      <path
        d="M18.5 7C18.5 9.20914 16.7091 11 14.5 11C12.2909 11 10.5 9.20914 10.5 7C10.5 4.79086 12.2909 3 14.5 3C16.7091 3 18.5 4.79086 18.5 7Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M8 11C6.34315 11 5 9.65685 5 8C5 6.34315 6.34315 5 8 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M14.5 14C9.8125 14 7 16.5 7 19C7 20.1046 7.83947 21 8.875 21H20.125C21.1605 21 22 20.1046 22 19C22 16.5 19.1875 14 14.5 14Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M4 19.9992H3.5C2.67157 19.9992 2 19.2317 2 18.2849C2 16.673 3.27307 15.0612 5.5 14.3613"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </>
  ),
  upload: (
    <>
      <path d={UPLOAD_TRAY} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d={UPLOAD_ARROW} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </>
  ),
};

function Glyph({ name, size = 16 }: { name: GlyphName; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth="1.9"
      stroke="currentColor"
      aria-hidden="true"
    >
      {GLYPHS[name]}
    </svg>
  );
}

/* ---------- Geometry ---------- */

/** The folder outline, with the tab folded up on the left */
const FOLDER =
  "M38 0H176Q196 0 204 14L218 30Q224 38 246 38H562Q600 38 600 76V462Q600 500 562 500H38Q0 500 0 462V38Q0 0 38 0Z";

/** The ruled lines on each sheet: y and width on the 280 × 350 page */
const PAPER_LINES: { y: number; width: number }[] = [
  { y: 87, width: 78 },
  { y: 115, width: 180 },
  { y: 143, width: 140 },
  { y: 171, width: 175 },
  { y: 199, width: 126 },
  { y: 227, width: 168 },
  { y: 255, width: 110 },
];

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
.ui-as-crumbs{display: flex;align-items: center;gap: 8px;height: 44px;padding: 0 16px;font-size: 13.5px;color: var(--muted)}
.ui-as-app[data-collapsed] .ui-as-crumbs{padding-left: 50px}
.ui-as-crumbs{transition: padding-left var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-crumbs button{color: inherit;text-decoration: none}
.ui-as-crumbs button:hover{color: var(--ink)}
.ui-as-crumbs i{font-style: normal;color: var(--faint)}
.ui-as-crumbs [aria-current]{font-weight: 500;color: var(--ink)}
.ui-as-page.ui-as-page--folder{padding-top: 12px}
.ui-as-back{display: inline-flex;align-items: center;gap: 6px;font-size: 13.5px;color: var(--muted);text-decoration: none}
.ui-as-back:hover{color: var(--ink)}
.ui-as-folder-head{display: flex;align-items: center;gap: 12px;margin-top: 22px}
.ui-as-folder-head__actions{display: flex;align-items: center;gap: 8px;margin-left: auto}
.ui-as-page--folder .ui-as-empty{margin-top: 20px;padding: 48px 24px 56px}
.ui-as-folder-files{display: flex;flex-wrap: wrap;gap: 12px;margin-top: 20px}
@container ui-as (max-width: 900px){.ui-as-crumbs{padding-left: 50px}
.ui-as-page.ui-as-page--folder{padding-top: 8px}
.ui-as-folder-head{flex-wrap: wrap;row-gap: 14px}
}
@container ui-as (max-width: 600px){.ui-as-crumbs{padding-right: 12px}
.ui-as-crumbs [aria-current]{overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-as-folder-head{margin-top: 18px}
.ui-as-folder-head__actions{width: 100%;margin-left: 0}
.ui-as-folder-head__actions > .ui-as-anchor{order: 3;margin-left: auto}
.ui-as-page--folder .ui-as-empty{padding: 36px 18px 40px}
}

`;
