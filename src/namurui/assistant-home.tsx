"use client";

import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

/*
 * Assistant Home – the start page of an AI assistant, in a single self-contained file.
 * A greeting over a composer that carries its own tools (files, plugins, model, dictation) and a
 * tray for the working folder and connected apps, with suggestion chips underneath. Sending
 * fades the greeting out and turns the section into a thread with the composer pinned at the
 * bottom. The app shell around it folds to a rail, becomes a drawer under 900px of width, and
 * holds the changelog card, the getting-started guide and the account.
 * The styles are injected below, so no extra files are needed.
 */

export type AssistantNavItem = {
  /** Menu label; also passed to onNavigate */
  label: string;
  /** 16px glyph drawn before the label */
  icon?: ReactNode;
};

export type AssistantSuggestion = {
  /** Stable id used as the React key */
  id: string;
  /** Chip text */
  label: string;
  /** Text dropped into the composer when the chip is clicked */
  prompt: string;
  /** 15px glyph drawn before the label */
  icon?: ReactNode;
};

export type AssistantApp = {
  /** Stable id, passed back in AssistantSendOptions.apps while connected */
  id: string;
  /** Name in the Connect apps menu */
  name: string;
  /** 13px brand mark shown in the tray */
  icon?: ReactNode;
};

export type AssistantModel = {
  /** Stable id, passed to onModelChange and in AssistantSendOptions.model */
  id: string;
  /** Name shown on the model button and in the menu */
  label: string;
  /** One-line explanation under the name in the menu */
  detail?: string;
};

export type AssistantPlugin = {
  /** Stable id, passed in AssistantSendOptions.plugins while enabled */
  id: string;
  /** Name in the Plugins menu */
  name: string;
};

export type AssistantFolder = {
  /** Stable id, passed in AssistantSendOptions.folder */
  id: string;
  /** Name shown on the tray link once picked */
  name: string;
};

export type AssistantMessage = {
  /** Stable id used as the React key */
  id: string;
  /** Who wrote it */
  role: "user" | "assistant";
  /** Plain text */
  text: string;
};

export type AssistantSendOptions = {
  /** Id of the selected model */
  model: string;
  /** Id of the folder the turn runs in, or null for none */
  folder: string | null;
  /** Ids of the connected apps that are on */
  apps: string[];
  /** Ids of the enabled plugins */
  plugins: string[];
};

export type AssistantHomeScreenProps = {
  /** Headline above the composer */
  greeting?: string;
  /** Placeholder in the prompt field */
  placeholder?: string;
  /** Workspace name; its first letter becomes the logo */
  workspace?: string;
  /** Account at the bottom of the sidebar; without an avatar it shows initials */
  user?: { name: string; avatar?: string };
  /** Sidebar menu items */
  nav?: AssistantNavItem[];
  /** Label of the menu item or project that is open */
  active?: string;
  /** Project list under the menu */
  projects?: string[];
  /** Chips under the composer, four on the first row and the rest on the second */
  suggestions?: AssistantSuggestion[];
  /** Models offered by the model menu */
  models?: AssistantModel[];
  /** Connected apps; their marks sit next to Connect apps */
  apps?: AssistantApp[];
  /** Plugins offered by the Plugins menu */
  plugins?: AssistantPlugin[];
  /** Folders offered by the Work in a folder menu */
  folders?: AssistantFolder[];
  /** Changelog card above the guide */
  news?: { kicker: string; title: string; more: string };
  /** Progress card above the account */
  guide?: { title: string; percent: number; cheer: string };
  /** Selected model id; the component keeps its own state when omitted */
  model?: string;
  /** Prompt text; the component keeps its own state when omitted */
  value?: string;
  /** Initial prompt text in uncontrolled mode */
  defaultValue?: string;
  /** Thread turns; when given the parent owns them and should append in onSend */
  messages?: AssistantMessage[];
  /** Called with the prompt and the composer settings when a turn is sent */
  onSend?: (text: string, options: AssistantSendOptions) => void;
  /** Called on every edit of the prompt */
  onChange?: (text: string) => void;
  /** Called when another model is picked */
  onModelChange?: (id: string) => void;
  /** Called with a menu item or project label */
  onNavigate?: (label: string) => void;
  /** Called when New chat is chosen, after the thread has been cleared */
  onNewChat?: () => void;
  /** Called when the search button is pressed */
  onSearch?: () => void;
  /** Called when the workspace button is pressed */
  onWorkspace?: () => void;
  /** Called when the account button is pressed */
  onAccount?: () => void;
  /** Called when Invite people is pressed */
  onInvite?: () => void;
  /** Called when the getting-started card is pressed */
  onOpenGuide?: () => void;
  /** Called when Full changelog is pressed */
  onOpenChangelog?: () => void;
  /** Called when the changelog card is dismissed */
  onDismissNews?: () => void;
  /** Called when dictation starts or stops; the mic pulses while it listens */
  onDictate?: (listening: boolean) => void;
  /** Extra class on the root */
  className?: string;
};

/* ---------- Default content ---------- */

const DEFAULT_NAV: AssistantNavItem[] = [
  { label: "New chat", icon: <ComposeIcon /> },
  { label: "Folders", icon: <FolderIcon /> },
  { label: "Integrations", icon: <IntegrationsIcon /> },
];

const DEFAULT_PROJECTS = ["Q3 Campaign", "Brand assets", "Hiring", "Research"];

const DEFAULT_SUGGESTIONS: AssistantSuggestion[] = [
  {
    id: "knowledge",
    label: "Company knowledge",
    prompt: "What does our handbook say about taking time off?",
    icon: <KnowledgeIcon />,
  },
  {
    id: "document",
    label: "Create document",
    prompt: "Draft a one-page brief for the Q3 campaign.",
    icon: <DocumentIcon />,
  },
  {
    id: "presentation",
    label: "Create presentation",
    prompt: "Build a five-slide deck on the Q3 campaign results.",
    icon: <PresentationIcon />,
  },
  {
    id: "table",
    label: "Create table",
    prompt: "Turn the campaign metrics into a table with owners and dates.",
    icon: <TableIcon />,
  },
  {
    id: "image",
    label: "Generate image",
    prompt: "Generate a hero image for the Q3 campaign landing page.",
    icon: <ImageIcon />,
  },
  {
    id: "research",
    label: "Deep research",
    prompt: "Research how competitors position AI assistants for teams.",
    icon: <ResearchIcon />,
  },
  {
    id: "chart",
    label: "Visualize data",
    prompt: "Chart signups by week for the last quarter.",
    icon: <ChartIcon />,
  },
];

const DEFAULT_MODELS: AssistantModel[] = [
  { id: "auto", label: "Auto", detail: "Picks the right model for the task" },
  { id: "fast", label: "Fast", detail: "Quick answers for everyday work" },
  { id: "reasoning", label: "Reasoning", detail: "Slower, for multi-step problems" },
];

const DEFAULT_APPS: AssistantApp[] = [
  { id: "gmail", name: "Gmail", icon: <GmailMark /> },
  { id: "slack", name: "Slack", icon: <SlackMark /> },
  { id: "figma", name: "Figma", icon: <FigmaMark /> },
];

const DEFAULT_PLUGINS: AssistantPlugin[] = [
  { id: "web", name: "Web search" },
  { id: "drive", name: "Company drive" },
  { id: "code", name: "Code interpreter" },
];

const DEFAULT_FOLDERS: AssistantFolder[] = [
  { id: "q3", name: "Q3 Campaign" },
  { id: "brand", name: "Brand assets" },
  { id: "hiring", name: "Hiring" },
  { id: "research", name: "Research" },
];

const DEFAULT_NEWS = { kicker: "New in Acme", title: "Shared folders", more: "Full changelog" };

const DEFAULT_GUIDE = { title: "Getting started", percent: 13, cheer: "Great start!" };

type MenuId = "model" | "plugins" | "folder" | "apps";
type Phase = "start" | "leaving" | "chat";

/* ---------- Component ---------- */

export function AssistantHomeScreen({
  greeting = "Good morning! What's next on your list?",
  placeholder = "Help me brainstorm ideas for...",
  workspace = "Acme",
  user = { name: "Alex Morgan" },
  nav = DEFAULT_NAV,
  active = "New chat",
  projects = DEFAULT_PROJECTS,
  suggestions = DEFAULT_SUGGESTIONS,
  models = DEFAULT_MODELS,
  apps = DEFAULT_APPS,
  plugins = DEFAULT_PLUGINS,
  folders = DEFAULT_FOLDERS,
  news = DEFAULT_NEWS,
  guide = DEFAULT_GUIDE,
  model,
  value,
  defaultValue = "",
  messages,
  onSend,
  onChange,
  onModelChange,
  onNavigate,
  onNewChat,
  onSearch,
  onWorkspace,
  onAccount,
  onInvite,
  onOpenGuide,
  onOpenChangelog,
  onDismissNews,
  onDictate,
  className,
}: AssistantHomeScreenProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuAnchorRef = useRef<HTMLElement | null>(null);
  const nextId = useRef(0);

  const [collapsed, setCollapsed] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState<MenuId | null>(null);
  const [draftState, setDraftState] = useState(defaultValue);
  const [fieldHeight, setFieldHeight] = useState(20);
  const [localMessages, setLocalMessages] = useState<AssistantMessage[]>([]);
  const [phase, setPhase] = useState<Phase>(messages && messages.length ? "chat" : "start");
  const [modelState, setModelState] = useState(model ?? models[0]?.id ?? "");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [appIds, setAppIds] = useState(() => apps.map((app) => app.id));
  const [pluginIds, setPluginIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<{ id: number; name: string }[]>([]);
  const [listening, setListening] = useState(false);
  const [newsHidden, setNewsHidden] = useState(false);

  const draft = value ?? draftState;
  const thread = messages ?? localMessages;
  const selectedId = model ?? modelState;
  const selectedModel = models.find((option) => option.id === selectedId) ?? models[0];
  const selectedFolder = folders.find((item) => item.id === folderId) ?? null;
  const rail = collapsed && !narrow;
  const openVisible = rail || (narrow && !drawer);
  const canSend = draft.trim().length > 0;

  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  // The sidebar is a drawer below 900px of shell width; measured, not assumed
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setNarrow(width < 900);
    });
    observer.observe(el);
    setNarrow(el.getBoundingClientRect().width < 900);
    return () => observer.disconnect();
  }, []);

  // Escape closes the drawer
  useEffect(() => {
    if (!drawer) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawer(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawer]);

  // A menu closes on a press outside its anchor or on Escape
  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (event: PointerEvent) => {
      const anchor = menuAnchorRef.current;
      if (anchor && event.target instanceof Node && anchor.contains(event.target)) return;
      setMenu(null);
      menuAnchorRef.current = null;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenu(null);
      menuAnchorRef.current = null;
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menu]);

  // Sending fades the greeting and chips out for their 180ms transition, then shows the thread
  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = window.setTimeout(() => setPhase("chat"), 180);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // The field grows with its content, one 20px line at a time
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = "20px";
    setFieldHeight(Math.min(el.scrollHeight, 160));
  }, [draft]);

  const setDraft = (next: string) => {
    if (value === undefined) setDraftState(next);
    onChange?.(next);
  };

  const toggleMenu = (id: MenuId, event: ReactMouseEvent<HTMLElement>) => {
    if (menu === id) {
      setMenu(null);
      menuAnchorRef.current = null;
      return;
    }
    menuAnchorRef.current = event.currentTarget.parentElement;
    setMenu(id);
  };

  const closeMenu = () => {
    setMenu(null);
    menuAnchorRef.current = null;
  };

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    if (messages === undefined) {
      const turn = { id: `turn-${nextId.current}`, role: "user" as const, text };
      nextId.current += 1;
      setLocalMessages((prev) => [...prev, turn]);
    }
    onSend?.(text, {
      model: selectedId,
      folder: folderId,
      apps: apps.filter((app) => appIds.includes(app.id)).map((app) => app.id),
      plugins: pluginIds,
    });
    setDraft("");
    setAttachments([]);
    if (phase === "start") setPhase("leaving");
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    send();
  };

  const go = (label: string) => {
    onNavigate?.(label);
    if (label === "New chat") {
      setLocalMessages([]);
      setDraft("");
      setAttachments([]);
      setPhase("start");
      onNewChat?.();
    }
    if (narrow) setDrawer(false);
  };

  const pickModel = (id: string) => {
    setModelState(id);
    onModelChange?.(id);
    closeMenu();
  };

  const toggleApp = (id: string) => {
    setAppIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const togglePlugin = (id: string) => {
    setPluginIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const addFiles = (list: FileList | null) => {
    if (!list || !list.length) return;
    const added = Array.from(list).map((file) => {
      const entry = { id: nextId.current, name: file.name };
      nextId.current += 1;
      return entry;
    });
    setAttachments((prev) => [...prev, ...added]);
  };

  const toggleDictation = () => {
    const next = !listening;
    setListening(next);
    onDictate?.(next);
  };

  return (
    <div
      ref={rootRef}
      className={["ui-as ui-as-app", className].filter(Boolean).join(" ")}
      data-collapsed={rail || undefined}
      data-drawer={(narrow && drawer) || undefined}
    >
      {/* React 19 hoists this into <head> once, no matter how many assistants render */}
      <style href="ui-screen-assistant-home" precedence="default">
        {css}
      </style>

      <button
        className="ui-as-icon-btn ui-as-side-open"
        type="button"
        aria-label="Open sidebar"
        tabIndex={openVisible ? undefined : -1}
        onClick={() => {
          if (narrow) setDrawer(true);
          else setCollapsed(false);
        }}
      >
        <PanelIcon />
      </button>
      <div
        className="ui-as-scrim"
        aria-hidden="true"
        onClick={() => {
          if (narrow) setDrawer(false);
        }}
      />
      <aside className="ui-as-side">
        <header className="ui-as-side__head">
          <span className="ui-as-anchor">
            <button
              className="ui-as-side__workspace"
              type="button"
              aria-expanded="false"
              onClick={() => onWorkspace?.()}
            >
              <span className="ui-as-side__logo">{workspace.slice(0, 1)}</span>
              {workspace}
              <ChevronDownIcon />
            </button>
          </span>
          <span className="ui-as-side__tools">
            <button className="ui-as-icon-btn" type="button" aria-label="Search" onClick={() => onSearch?.()}>
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
                onClick={() => go(item.label)}
              >
                {item.icon}
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
              onClick={() => go(project)}
            >
              <ProjectIcon />
              {project}
            </button>
          ))}
        </nav>
        <div className="ui-as-side__foot">
          {newsHidden ? null : (
            <div className="ui-as-news" data-count="2">
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
                    onClick={() => {
                      setNewsHidden(true);
                      onDismissNews?.();
                    }}
                  >
                    <CloseIcon />
                  </button>
                </div>
                <b className="ui-as-news__title">{news.title}</b>
                <button type="button" className="ui-as-news__more" onClick={() => onOpenChangelog?.()}>
                  {news.more}
                  <ChevronRightIcon />
                </button>
              </div>
            </div>
          )}
          <div className="ui-as-guide-slot" style={{ height: 70 }}>
            <div className="ui-as-guide" data-state="closed" style={{ height: 70 }}>
              <div className="ui-as-guide__inner">
                <button
                  type="button"
                  className="ui-as-steps ui-as-guide__content"
                  aria-expanded="false"
                  onClick={() => onOpenGuide?.()}
                >
                  <span className="ui-as-steps__title">
                    {guide.title}
                    <ChevronRightIcon />
                  </span>
                  <span className="ui-as-steps__sub">
                    {`${guide.percent}% done · `}
                    <span className="ui-as-steps__cheer">{guide.cheer}</span>
                  </span>
                  <span className="ui-as-steps__bar">
                    <i style={{ width: `${guide.percent}%` }} />
                  </span>
                </button>
              </div>
            </div>
          </div>
          <span className="ui-as-anchor ui-as-user-menu">
            <button type="button" className="ui-as-user" aria-expanded="false" onClick={() => onAccount?.()}>
              {user.avatar ? (
                <img src={user.avatar} alt="" />
              ) : (
                <span className="ui-as-user__initials">{initials}</span>
              )}
              {user.name}
              <ChevronDownIcon />
            </button>
          </span>
        </div>
      </aside>
      <main className="ui-as-main">
        <button type="button" className="ui-as-invite" onClick={() => onInvite?.()}>
          <InviteIcon />
          Invite people
        </button>
        <section className="ui-as-start" data-phase={phase}>
          {phase === "chat" ? null : <h1 className="ui-as-start__title">{greeting}</h1>}
          {phase === "chat" ? (
            <div className="ui-as-start__thread">
              <div className="ui-as-start__column">
                {thread.map((turn) => (
                  <div key={turn.id}>{turn.text}</div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="ui-as-start__composer">
            <form className="ui-as-composer" onSubmit={submit}>
              <div className="ui-as-composer__card">
                {attachments.length ? (
                  <div className="ui-as-attachments">
                    {attachments.map((file) => (
                      <span className="ui-as-attachment" key={file.id}>
                        <DocumentIcon />
                        {file.name}
                        <button
                          type="button"
                          aria-label={`Remove ${file.name}`}
                          onClick={() =>
                            setAttachments((prev) => prev.filter((item) => item.id !== file.id))
                          }
                        >
                          <CloseIcon />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <textarea
                  ref={fieldRef}
                  className="ui-as-composer__field"
                  rows={1}
                  placeholder={placeholder}
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
                  <button
                    type="button"
                    className="ui-as-icon-btn"
                    aria-label="Add file"
                    onClick={() => fileRef.current?.click()}
                  >
                    <PlusIcon />
                  </button>
                  <input
                    ref={fileRef}
                    multiple
                    hidden
                    type="file"
                    onChange={(event) => {
                      addFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                  <span className="ui-as-anchor">
                    <button
                      type="button"
                      className="ui-as-ghost"
                      aria-expanded={menu === "plugins"}
                      data-active={pluginIds.length ? "" : undefined}
                      onClick={(event) => toggleMenu("plugins", event)}
                    >
                      <PlugIcon />
                      Plugins
                    </button>
                    {menu === "plugins" ? (
                      <div className="ui-as-popover" data-side="top">
                        <div className="ui-as-menu" role="menu" aria-label="Plugins">
                          <span className="ui-as-menu__title">Plugins</span>
                          <div className="ui-as-menu__list">
                            {plugins.map((plugin) => (
                              <MenuChoice
                                key={plugin.id}
                                label={plugin.name}
                                role="menuitemcheckbox"
                                checked={pluginIds.includes(plugin.id)}
                                onSelect={() => togglePlugin(plugin.id)}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </span>
                  <span className="ui-as-composer__end">
                    <span className="ui-as-anchor">
                      <button
                        type="button"
                        className="ui-as-ghost ui-as-ghost--model"
                        aria-expanded={menu === "model"}
                        aria-haspopup="menu"
                        onClick={(event) => toggleMenu("model", event)}
                      >
                        <SparkleIcon />
                        {selectedModel?.label ?? "Auto"}
                        <ChevronDownSmallIcon />
                      </button>
                      {menu === "model" ? (
                        <div className="ui-as-popover" data-side="top" data-align="end">
                          <div className="ui-as-menu" role="menu" aria-label="Model">
                            <span className="ui-as-menu__title">Model</span>
                            <div className="ui-as-menu__list">
                              {models.map((option) => (
                                <MenuChoice
                                  key={option.id}
                                  label={option.label}
                                  detail={option.detail}
                                  checked={option.id === selectedId}
                                  onSelect={() => pickModel(option.id)}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="ui-as-icon-btn ui-as-mic"
                      aria-label="Dictate"
                      aria-pressed={listening}
                      onClick={toggleDictation}
                    >
                      <MicIcon />
                    </button>
                    <button type="submit" className="ui-as-send" aria-label="Send" disabled={!canSend}>
                      <ArrowUpIcon />
                    </button>
                  </span>
                </div>
              </div>
              <div className="ui-as-composer__tray">
                <span className="ui-as-anchor">
                  <button
                    type="button"
                    className="ui-as-tray-link"
                    aria-expanded={menu === "folder"}
                    onClick={(event) => toggleMenu("folder", event)}
                  >
                    <span className="ui-as-tray-link__folder">
                      <GlassFolder />
                    </span>
                    {selectedFolder ? selectedFolder.name : "Work in a folder"}
                  </button>
                  {menu === "folder" ? (
                    <div className="ui-as-popover" data-side="top">
                      <div className="ui-as-menu" role="menu" aria-label="Folder">
                        <span className="ui-as-menu__title">Work in a folder</span>
                        <div className="ui-as-menu__list">
                          <MenuChoice
                            label="No folder"
                            checked={folderId === null}
                            onSelect={() => {
                              setFolderId(null);
                              closeMenu();
                            }}
                          />
                          {folders.map((folder) => (
                            <MenuChoice
                              key={folder.id}
                              label={folder.name}
                              checked={folder.id === folderId}
                              onSelect={() => {
                                setFolderId(folder.id);
                                closeMenu();
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </span>
                <span className="ui-as-anchor">
                  <button
                    type="button"
                    className="ui-as-tray-link ui-as-tray-link--apps"
                    aria-expanded={menu === "apps"}
                    onClick={(event) => toggleMenu("apps", event)}
                  >
                    Connect apps
                    <span className="ui-as-apps" aria-hidden="true">
                      {apps
                        .filter((app) => appIds.includes(app.id))
                        .map((app) => (
                          <Fragment key={app.id}>{app.icon}</Fragment>
                        ))}
                    </span>
                  </button>
                  {menu === "apps" ? (
                    <div className="ui-as-popover" data-side="top" data-align="end">
                      <div className="ui-as-menu" role="menu" aria-label="Connected apps">
                        <span className="ui-as-menu__title">Connected apps</span>
                        <div className="ui-as-menu__list">
                          {apps.map((app) => (
                            <MenuChoice
                              key={app.id}
                              label={app.name}
                              role="menuitemcheckbox"
                              checked={appIds.includes(app.id)}
                              onSelect={() => toggleApp(app.id)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </span>
              </div>
            </form>
          </div>
          {phase === "chat" ? null : (
            <div className="ui-as-chips">
              <div className="ui-as-chips__row">
                {suggestions.slice(0, 4).map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    className="ui-as-chip"
                    onClick={() => {
                      setDraft(suggestion.prompt);
                      fieldRef.current?.focus();
                    }}
                  >
                    {suggestion.icon}
                    {suggestion.label}
                  </button>
                ))}
              </div>
              <div className="ui-as-chips__row">
                {suggestions.slice(4).map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    className="ui-as-chip"
                    onClick={() => {
                      setDraft(suggestion.prompt);
                      fieldRef.current?.focus();
                    }}
                  >
                    {suggestion.icon}
                    {suggestion.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

/* ---------- Menus and the tray folder ---------- */

function MenuChoice({
  label,
  detail,
  checked,
  role = "menuitemradio",
  onSelect,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  role?: "menuitemradio" | "menuitemcheckbox";
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="ui-as-menu__item"
      role={role}
      aria-checked={checked}
      data-rich={detail ? "" : undefined}
      onClick={onSelect}
    >
      <span className="ui-as-menu__label">
        {label}
        {detail ? <small>{detail}</small> : null}
      </span>
    </button>
  );
}

/** The folder outline, with the tab folded up on the left */
const FOLDER =
  "M38 0H176Q196 0 204 14L218 30Q224 38 246 38H562Q600 38 600 76V462Q600 500 562 500H38Q0 500 0 462V38Q0 0 38 0Z";

/** The ruled lines on each sheet: y and width on the 280 x 350 page */
const LINES: { y: number; width: number }[] = [
  { y: 87, width: 78 },
  { y: 115, width: 180 },
  { y: 143, width: 140 },
  { y: 171, width: 175 },
  { y: 199, width: 126 },
  { y: 227, width: 168 },
  { y: 255, width: 110 },
];

/** The library's glass folder at icon size; the tray link opens it on hover */
function GlassFolder() {
  const prefix = `ui-fd_${useId().replace(/[^a-zA-Z0-9_-]/g, "")}_-`;

  return (
    <div className="ui-fd" role="img" aria-label="">
      <div className="ui-fd-icon" aria-hidden="true">
        <svg className="ui-fd-layer ui-fd-back" viewBox="0 0 600 500">
          <defs>
            <filter id={`${prefix}hl`} x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur" />
              <feOffset in="blur" dy="3" result="offset" />
              <feComposite in="blur" in2="offset" operator="arithmetic" k2="1" k3="-1" result="diff" />
              <feFlood floodColor="#fff" floodOpacity="0.65" />
              <feComposite in2="diff" operator="in" result="light" />
              <feComposite in="light" in2="SourceAlpha" operator="in" />
            </filter>
          </defs>
          <path className="ui-fd-back-fill" d={FOLDER} fill="#5bb7ea" />
          <path d={FOLDER} fill="#000" filter={`url(#${prefix}hl)`} />
        </svg>
        <svg className="ui-fd-layer" viewBox="0 0 600 500">
          <defs>
            <linearGradient id={`${prefix}paper`} x1="0" y1="0" x2="0" y2="1">
              <stop className="ui-fd-paper-top" offset="0%" stopColor="#fff" />
              <stop className="ui-fd-paper-bottom" offset="100%" stopColor="#eaf2f8" />
            </linearGradient>
            <symbol id={`${prefix}doc`} overflow="visible">
              <rect
                className="ui-fd-paper"
                x="0.6"
                y="0.6"
                width="278.8"
                height="348.8"
                rx="19.4"
                fill={`url(#${prefix}paper)`}
                stroke="rgba(0,0,0,0.12)"
                strokeWidth="1.2"
              />
              {LINES.map((line) => (
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
          <use className="ui-fd-doc ui-fd-doc--left" href={`#${prefix}doc`} />
          <use className="ui-fd-doc ui-fd-doc--right" href={`#${prefix}doc`} />
          <use className="ui-fd-doc ui-fd-doc--middle" href={`#${prefix}doc`} />
        </svg>
        <div className="ui-fd-front" />
      </div>
    </div>
  );
}

/* ---------- Icons ---------- */

function PanelIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M2 12C2 8.31087 2 6.4663 2.81382 5.15877C3.1149 4.67502 3.48891 4.25427 3.91891 3.91554C5.08116 3 6.72077 3 10 3H14C17.2792 3 18.9188 3 20.0811 3.91554C20.5111 4.25427 20.8851 4.67502 21.1862 5.15877C22 6.4663 22 8.31087 22 12C22 15.6891 22 17.5337 21.1862 18.8412C20.8851 19.325 20.5111 19.7457 20.0811 20.0845C18.9188 21 17.2792 21 14 21H10C6.72077 21 5.08116 21 3.91891 20.0845C3.48891 19.7457 3.1149 19.325 2.81382 18.8412C2 17.5337 2 15.6891 2 12Z" stroke="currentColor" strokeWidth="1.9" />
      <path d="M9.5 3L9.5 21" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M5 7H6M5 10H6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M17 17L21 21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function ComposeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M16.4249 4.60509L17.4149 3.6151C18.2351 2.79497 19.5648 2.79497 20.3849 3.6151C21.205 4.43524 21.205 5.76493 20.3849 6.58507L19.3949 7.57506M16.4249 4.60509L9.76558 11.2644C9.25807 11.772 8.89804 12.4078 8.72397 13.1041L8 16L10.8959 15.276C11.5922 15.102 12.228 14.7419 12.7356 14.2344L19.3949 7.57506M16.4249 4.60509L19.3949 7.57506" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M18.9999 13.5C18.9999 16.7875 18.9999 18.4312 18.092 19.5376C17.9258 19.7401 17.7401 19.9258 17.5375 20.092C16.4312 21 14.7874 21 11.4999 21H11C7.22876 21 5.34316 21 4.17159 19.8284C3.00003 18.6569 3 16.7712 3 13V12.5C3 9.21252 3 7.56879 3.90794 6.46244C4.07417 6.2599 4.2599 6.07417 4.46244 5.90794C5.56879 5 7.21252 5 10.5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M8 7H16.75C18.8567 7 19.91 7 20.6667 7.50559C20.9943 7.72447 21.2755 8.00572 21.4944 8.33329C22 9.08996 22 10.1433 22 12.25C22 15.7612 22 17.5167 21.1573 18.7779C20.7926 19.3238 20.3238 19.7926 19.7779 20.1573C18.5167 21 16.7612 21 13.25 21H12C7.28595 21 4.92893 21 3.46447 19.5355C2 18.0711 2 15.714 2 11V7.94427C2 6.1278 2 5.21956 2.38032 4.53806C2.65142 4.05227 3.05227 3.65142 3.53806 3.38032C4.21956 3 5.1278 3 6.94427 3C8.10802 3 8.6899 3 9.19926 3.19101C10.3622 3.62712 10.8418 4.68358 11.3666 5.73313L12 7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </svg>
  );
}

function IntegrationsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M10.5 8.75V6.75C10.5 5.10626 10.5 4.28439 10.046 3.73121C9.96291 3.62995 9.87005 3.53709 9.76879 3.45398C9.21561 3 8.39374 3 6.75 3C5.10626 3 4.28439 3 3.73121 3.45398C3.62995 3.53709 3.53709 3.62995 3.45398 3.73121C3 4.28439 3 5.10626 3 6.75V8.75C3 10.3937 3 11.2156 3.45398 11.7688C3.53709 11.8701 3.62995 11.9629 3.73121 12.046C4.28439 12.5 5.10626 12.5 6.75 12.5C8.39374 12.5 9.21561 12.5 9.76879 12.046C9.87005 11.9629 9.96291 11.8701 10.046 11.7688C10.5 11.2156 10.5 10.3937 10.5 8.75Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M7.75 15.5H5.75C5.05222 15.5 4.70333 15.5 4.41943 15.5861C3.78023 15.78 3.28002 16.2802 3.08612 16.9194C3 17.2033 3 17.5522 3 18.25C3 18.9478 3 19.2967 3.08612 19.5806C3.28002 20.2198 3.78023 20.72 4.41943 20.9139C4.70333 21 5.05222 21 5.75 21H7.75C8.44778 21 8.79667 21 9.08057 20.9139C9.71977 20.72 10.22 20.2198 10.4139 19.5806C10.5 19.2967 10.5 18.9478 10.5 18.25C10.5 17.5522 10.5 17.2033 10.4139 16.9194C10.22 16.2802 9.71977 15.78 9.08057 15.5861C8.79667 15.5 8.44778 15.5 7.75 15.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M21 17.25V15.25C21 13.6063 21 12.7844 20.546 12.2312C20.4629 12.1299 20.3701 12.0371 20.2688 11.954C19.7156 11.5 18.8937 11.5 17.25 11.5C15.6063 11.5 14.7844 11.5 14.2312 11.954C14.1299 12.0371 14.0371 12.1299 13.954 12.2312C13.5 12.7844 13.5 13.6063 13.5 15.25V17.25C13.5 18.8937 13.5 19.7156 13.954 20.2688C14.0371 20.3701 14.1299 20.4629 14.2312 20.546C14.7844 21 15.6063 21 17.25 21C18.8937 21 19.7156 21 20.2688 20.546C20.3701 20.4629 20.4629 20.3701 20.546 20.2688C21 19.7156 21 18.8937 21 17.25Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M18.25 3H16.25C15.5522 3 15.2033 3 14.9194 3.08612C14.2802 3.28002 13.78 3.78023 13.5861 4.41943C13.5 4.70333 13.5 5.05222 13.5 5.75C13.5 6.44778 13.5 6.79667 13.5861 7.08057C13.78 7.71977 14.2802 8.21998 14.9194 8.41388C15.2033 8.5 15.5522 8.5 16.25 8.5H18.25C18.9478 8.5 19.2967 8.5 19.5806 8.41388C20.2198 8.21998 20.72 7.71977 20.9139 7.08057C21 6.79667 21 6.44778 21 5.75C21 5.05222 21 4.70333 20.9139 4.41943C20.72 3.78023 20.2198 3.28002 19.5806 3.08612C19.2967 3 18.9478 3 18.25 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function ProjectIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M2.5 20V8.87695C2.5 7.58945 2.5 6.9457 2.78533 6.47048C2.9541 6.18939 3.18939 5.9541 3.47048 5.78533C3.9457 5.5 4.59449 5.5 5.89206 5.5C6.52339 5.5 6.83906 5.5 7.12612 5.58819C7.31759 5.64702 7.49914 5.73428 7.66469 5.84705C7.91289 6.01611 8.10859 6.26074 8.5 6.75C8.89141 7.23926 9.08711 7.48389 9.33531 7.65295C9.50086 7.76572 9.68241 7.85298 9.87388 7.91181C10.1609 8 10.4742 8 11.1008 8H15C16.4045 8 17.1067 8 17.6111 8.33706C17.8295 8.48298 18.017 8.67048 18.1629 8.88886C18.5 9.39331 18.5 10.0955 18.5 11.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M4.42028 14.0144L3.63368 16.0144C2.65618 18.4998 2.16743 19.7425 2.7524 20.6213C3.33737 21.5 4.65337 21.5 7.28537 21.5H15.1903C16.4249 21.5 17.0422 21.5 17.5295 21.1795C18.0169 20.859 18.2702 20.2865 18.7769 19.1415L19.6618 17.1415C20.7866 14.5992 21.349 13.3281 20.7679 12.4141C20.1868 11.5 18.8163 11.5 16.0752 11.5H8.07196C6.78232 11.5 6.1375 11.5 5.63811 11.8439C5.13872 12.1877 4.89924 12.7966 4.42028 14.0144Z" stroke="currentColor" strokeWidth="1.9" />
      <path d="M11.5 4.51456C12.4151 3.28409 13.6662 2.55594 15.5125 2.50161C16.1155 2.48386 16.7152 2.61395 17.2682 2.85544C18.5748 3.42601 19.4185 4.15644 20 5.5L21.5 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function InviteIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M3 20.5002C3.28417 16.8058 6.3 13.7193 10.0008 13.5379C10.3134 13.5226 10.6446 13.5097 11 13.5L11.995 13.5663C12.6939 13.6129 13.3665 13.7543 14 13.9777" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M18 15.5V21.5M21 18.5L15 18.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <circle cx="11" cy="6.5" r="4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
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

function PlugIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M15.5 2V6M8.5 6V2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M6.00446 7.61331C5.93719 6.74273 6.63957 6 7.53014 6H16.4699C17.3604 6 18.0628 6.74273 17.9955 7.61331L17.8117 9.99197C17.6796 11.7019 17.1011 13.3498 16.132 14.7773L15.5312 15.6622C14.9638 16.4979 14.0077 17 12.9838 17H11.0162C9.99228 17 9.03617 16.4979 8.46881 15.6622L7.86803 14.7773C6.89885 13.3498 6.32041 11.7019 6.18827 9.99197L6.00446 7.61331Z" stroke="currentColor" strokeWidth="1.9" />
      <path d="M12 17V22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M11 9H13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M13.427 8.08396C12.8007 5.84272 12.3226 4 11.0004 4C9.67824 4 9.19964 5.84274 8.5731 8.08399C8.31853 8.99465 8.19125 9.44998 7.82042 9.82077C7.4496 10.1916 6.99434 10.3188 6.08381 10.5732C3.84273 11.1995 2 11.6775 2 13C2 14.3225 3.84273 14.8005 6.08381 15.4268C6.99434 15.6812 7.4496 15.8084 7.82042 16.1792C8.19125 16.55 8.31853 17.0054 8.5731 17.916C9.19964 20.1573 9.67824 22 11.0004 22C12.3226 22 12.8007 20.1573 13.427 17.916C13.6815 17.0054 13.8087 16.5501 14.1795 16.1793C14.5504 15.8085 15.0056 15.6812 15.9162 15.4268C18.1573 14.8005 20 14.3225 20 13C20 11.6775 18.1573 11.1995 15.9162 10.5732C15.0056 10.3188 14.5504 10.1915 14.1795 9.8207C13.8087 9.44986 13.6815 8.99456 13.427 8.08396Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M19.5 2.9375V4.5M19.5 4.5V6.0625M19.5 4.5H18.25M19.5 4.5H20.75M22 4.5L21.548 4.34934C20.8497 4.11658 20.5006 4.00019 20.2502 3.74981C19.9998 3.49942 19.8834 3.15027 19.6507 2.45198L19.5 2L19.3493 2.45198C19.1166 3.15027 19.0002 3.49942 18.7498 3.74981C18.4994 4.00019 18.1503 4.11658 17.452 4.34934L17 4.5L17.452 4.65066C18.1503 4.88342 18.4994 4.99981 18.7498 5.25019C19.0002 5.50058 19.1166 5.84973 19.3493 6.54802L19.5 7L19.6507 6.54802C19.8834 5.84973 19.9998 5.50058 20.2502 5.25019C20.5006 4.99981 20.8497 4.88342 21.548 4.65066L22 4.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function ChevronDownSmallIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M7 6.5C7 4.01472 9.01472 2 11.5 2C13.9853 2 16 4.01472 16 6.5V11.5C16 13.9853 13.9853 16 11.5 16C9.01472 16 7 13.9853 7 11.5V6.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M11.5 19H11.0828C7.57267 19 4.57706 16.4623 4 13M11.5 19H11.9172C15.4273 19 18.4229 16.4623 19 13M11.5 19V22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M12 5.5V19" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M18 11C18 11 13.5811 5.00001 12 5C10.4188 4.99999 6 11 6 11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function KnowledgeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M3 12C3 7.75736 3 5.63604 4.31802 4.31802C5.63604 3 7.75736 3 12 3C16.2426 3 18.364 3 19.682 4.31802C21 5.63604 21 7.75736 21 12C21 16.2426 21 18.364 19.682 19.682C18.364 21 16.2426 21 12 21C7.75736 21 5.63604 21 4.31802 19.682C3 18.364 3 16.2426 3 12Z" stroke="currentColor" strokeWidth="1.9" />
      <path d="M3 12H21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M11 7.5L17 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M7.125 7.5H7M7.25 7.5C7.25 7.63807 7.13807 7.75 7 7.75C6.86193 7.75 6.75 7.63807 6.75 7.5C6.75 7.36193 6.86193 7.25 7 7.25C7.13807 7.25 7.25 7.36193 7.25 7.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M11 16.5L17 16.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M7.125 16.5H7M7.25 16.5C7.25 16.6381 7.13807 16.75 7 16.75C6.86193 16.75 6.75 16.6381 6.75 16.5C6.75 16.3619 6.86193 16.25 7 16.25C7.13807 16.25 7.25 16.3619 7.25 16.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M8 7L16 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M8 11L12 11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M13 21.5V21C13 18.1716 13 16.7574 13.8787 15.8787C14.7574 15 16.1716 15 19 15H19.5M20 13.3431V10C20 6.22876 20 4.34315 18.8284 3.17157C17.6569 2 15.7712 2 12 2C8.22877 2 6.34315 2 5.17157 3.17157C4 4.34314 4 6.22876 4 10L4 14.5442C4 17.7892 4 19.4117 4.88607 20.5107C5.06508 20.7327 5.26731 20.9349 5.48933 21.1139C6.58831 22 8.21082 22 11.4558 22C12.1614 22 12.5141 22 12.8372 21.886C12.9044 21.8623 12.9702 21.835 13.0345 21.8043C13.3436 21.6564 13.593 21.407 14.0919 20.9081L18.8284 16.1716C19.4065 15.5935 19.6955 15.3045 19.8478 14.9369C20 14.5694 20 14.1606 20 13.3431Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function PresentationIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M12 18V22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M10 18L5 22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M14 18L19 22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M2.5 12C2.5 14.8284 2.5 16.2426 3.37868 17.1213C4.25736 18 5.67157 18 8.5 18H15.5C18.3284 18 19.7426 18 20.6213 17.1213C21.5 16.2426 21.5 14.8284 21.5 12V8C21.5 5.17157 21.5 3.75736 20.6213 2.87868C19.7426 2 18.3284 2 15.5 2H8.5C5.67157 2 4.25736 2 3.37868 2.87868C2.5 3.75736 2.5 5.17157 2.5 8V12Z" stroke="currentColor" strokeWidth="1.9" />
      <path d="M8 13V10M12 13V7M16 13V11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M20 10C20 10 22.375 11.8222 21.375 14.6667C20.375 17.5111 21.375 19.4074 22 20M20 10H4M20 10V4M4 10C4 10 1.625 11.8222 2.625 14.6667C3.625 17.5111 2.625 19.4074 2 20M4 10V4M22 4H20.75H20M2 4H3.25H4M4 4H20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M11 7H13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="1.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z" stroke="currentColor" strokeWidth="1.9" />
      <path d="M5 21C9.37246 15.775 14.2741 8.88406 21.4975 13.5424" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  );
}

function ResearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M16.1995 2.62118C17.0064 2.153 17.4099 1.91892 17.8053 2.02539C18.2007 2.13186 18.4336 2.53732 18.8995 3.34823L20.3819 5.92852C20.8478 6.73943 21.0807 7.14489 20.9747 7.54225C20.8688 7.93961 20.4653 8.1737 19.6584 8.64188L16.235 10.6282C15.4281 11.0964 15.0247 11.3305 14.6293 11.224C14.2339 11.1175 14.0009 10.7121 13.5351 9.90115L12.0527 7.32085C11.5868 6.50994 11.3539 6.10449 11.4598 5.70713C11.5658 5.30977 11.9692 5.07568 12.7761 4.6075L16.1995 2.62118Z" stroke="currentColor" strokeWidth="1.9" />
      <path d="M11.5585 6.46075L14.0292 10.7613L10.6058 12.7476C9.79886 13.2157 9.39541 13.4498 9.00001 13.3434C8.60461 13.2369 8.37167 12.8314 7.9058 12.0205L7.41168 11.1604C6.94581 10.3495 6.71288 9.94406 6.81882 9.5467C6.92477 9.14934 7.32822 8.91525 8.13513 8.44707L11.5585 6.46075Z" stroke="currentColor" strokeWidth="1.9" />
      <path d="M6.91755 10.3003L8.39993 12.8806L5.40444 14.6186C5.00566 14.85 4.80627 14.9657 4.61138 14.9915C4.35152 15.0259 4.08871 14.9551 3.88077 14.7948C3.72482 14.6745 3.6097 14.4741 3.37947 14.0734C3.14923 13.6726 3.03412 13.4722 3.00846 13.2764C2.97425 13.0152 3.04467 12.7511 3.20422 12.5421C3.32389 12.3854 3.52328 12.2697 3.92206 12.0384L6.91755 10.3003Z" stroke="currentColor" strokeWidth="1.9" />
      <path d="M7.5 22L12 12L16.5 22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
      <path d="M8 9V17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M13 5V17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M18 13V17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M3 3V13C3 16.7712 3 18.6569 4.17157 19.8284C5.34315 21 7.22876 21 11 21H21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function GmailMark() {
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

function SlackMark() {
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

function FigmaMark() {
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

/* ---------- Styles ---------- */

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
.ui-as-invite{position: absolute;top: 8px;right: 8px;display: flex;align-items: center;gap: 6px;height: 28px;padding: 0 8px;border-radius: 8px;font-size: 12.5px;color: var(--text)}
.ui-as-invite svg{color: var(--muted)}
.ui-as-invite:hover{background: var(--hover);color: var(--ink)}
.ui-as-start{display: flex;flex-direction: column;align-items: center;justify-content: center;width: min(672px, calc(100% - 48px));min-height: 100%;margin: 0 auto;padding: 64px 0}
.ui-as-start__title{margin: 0;font-size: 28px;line-height: 34px;font-weight: 500;letter-spacing: -0.025em;color: var(--ink);text-align: center;text-wrap: balance}
.ui-as-start__composer{width: 100%;margin-top: 30px}
.ui-as-start__title, .ui-as-chips{transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-start[data-phase="leaving"] .ui-as-start__title{opacity: 0;transform: translateY(-8px)}
.ui-as-start[data-phase="leaving"] .ui-as-chips{opacity: 0;transform: translateY(8px)}
.ui-as-start[data-phase="chat"]{width: 100%;height: 100%;min-height: 0;padding: 0;justify-content: flex-end}
.ui-as-start__thread{flex: 1;width: 100%;min-height: 0;overflow-y: auto;padding: 64px 32px 24px}
.ui-as-start__column{display: flex;flex-direction: column;gap: 22px;max-width: 672px;margin: 0 auto}
.ui-as-start[data-phase="chat"] .ui-as-start__composer{flex: none;width: min(672px, calc(100% - 64px));margin: 0 0 24px}
.ui-as-chips{display: grid;gap: 7px;margin-top: 18px}
.ui-as-chips__row{display: flex;flex-wrap: wrap;justify-content: center;gap: 8px}
.ui-as-chip{display: flex;align-items: center;gap: 7px;height: 32px;padding: 0 12px 0 11px;border-radius: 16px;background: var(--chip);font-size: 12px;color: var(--text);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-chip svg{color: var(--text)}
.ui-as-chip:hover{background: var(--chip-hover);color: var(--ink)}
@container ui-as (max-width: 600px){.ui-as-start{width: calc(100% - 24px);padding: 56px 0 40px}
.ui-as-start__title{font-size: 23px;line-height: 29px}
.ui-as-start__composer{margin-top: 22px}
.ui-as-chips{margin-top: 14px}
.ui-as-chips__row{gap: 6px}
.ui-as-start__thread{padding: 56px 16px 16px}
.ui-as-start[data-phase="chat"] .ui-as-start__composer{width: calc(100% - 16px);margin-bottom: 8px}
}

`;
