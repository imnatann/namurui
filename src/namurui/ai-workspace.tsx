"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

/*
 * AI Workspace – an assistant app in a single frame: a collapsible sidebar of chats and
 * pinned assistants, a bar that carries the project breadcrumb, and a body that swaps
 * between the welcome composer, a streaming conversation and the project library.
 *
 * Motion is the sheet's: the shell animates its grid track when the sidebar collapses,
 * views fade in, the assistant mark orbits while a reply is being written, and the
 * composer card swaps rows when apps connect or access is granted.
 */

export type WorkspaceChat = {
  id: string;
  title: string;
  /** Project the conversation belongs to */
  projectId?: string;
  /** Transcript to open the conversation with */
  messages?: WorkspaceMessage[];
};

export type WorkspaceProject = {
  id: string;
  name: string;
  description: string;
  /** Conversations inside the project, shown in the card footer */
  chats: number;
  /** Human copy for the last touch, e.g. "Updated 2 days ago" */
  updated: string;
  pinned?: boolean;
};

export type WorkspaceModel = {
  id: string;
  name: string;
  description: string;
  /** Square mark in the menu; a sparkle is used when it is left out */
  logo?: ReactNode;
};

export type WorkspaceMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export type AiWorkspaceProps = {
  /** Name in the sidebar footer and the welcome heading */
  userName?: string;
  /** Avatar image for the footer; initials are drawn when it is left out */
  userAvatar?: string;
  /** Letter on the workspace chip */
  workspace?: string;
  /** Pinned assistants in the sidebar */
  assistants?: string[];
  /** Project library */
  projects?: WorkspaceProject[];
  /** Recent conversations in the sidebar */
  chats?: WorkspaceChat[];
  /** Rows of the composer's model menu */
  models?: WorkspaceModel[];
  /** Chips under the welcome composer */
  starters?: string[];
  /** Small print under the composer */
  disclaimer?: string;
  /** Canned answer for a prompt – the default composes one from the workspace context */
  respond?: (prompt: string, model: WorkspaceModel) => string;
  /** Extra class on the root */
  className?: string;
};

type View = "home" | "chat" | "projects";
type ProjectSort = "recent" | "name";

/** A reply while it is still being written, one tick at a time */
type Stream = {
  id: string;
  full: string;
  shown: number;
  thinking: boolean;
};

const uid = () => Math.random().toString(36).slice(2, 9);

const DEFAULT_ASSISTANTS = ["Writing assistant", "Data analyst", "Knowledge base"];

const DEFAULT_STARTERS = [
  "Summarize my interview notes",
  "Draft the pricing announcement email",
  "Compare our pricing tiers",
];

const DEFAULT_DISCLAIMER = "AI can make mistakes – please double-check important answers.";

export const defaultWorkspaceProjects: WorkspaceProject[] = [
  {
    id: "brand-refresh",
    name: "Brand Refresh",
    description: "Positioning, voice and the launch narrative for the spring release.",
    chats: 6,
    updated: "Updated 2 days ago",
    pinned: true,
  },
  {
    id: "pricing-research",
    name: "Pricing Research",
    description: "Interview notes, tier comparisons and the objections that keep coming back.",
    chats: 4,
    updated: "Updated 5 days ago",
  },
  {
    id: "onboarding",
    name: "Onboarding",
    description: "First-run copy, activation emails and the checklist new workspaces see.",
    chats: 3,
    updated: "Updated last week",
  },
];

export const defaultWorkspaceChats: WorkspaceChat[] = [
  {
    id: "chat-interviews",
    title: "Summarize interview notes",
    projectId: "brand-refresh",
    messages: [
      {
        id: "chat-interviews-1",
        role: "user",
        text: "Summarize the five interviews and tell me what changed about the positioning.",
      },
      {
        id: "chat-interviews-2",
        role: "assistant",
        text: "Five interviews, one shift: people describe the product by the outcome, not the category.\n\n- Three of five could not name a competitor until prompted.\n- All five used the word “calm” for the current interface.\n- Two asked whether it works with the tools they already pay for.\n\nLead with the outcome and the calm, and name the integrations before the feature list.",
      },
    ],
  },
  { id: "chat-launch", title: "Draft launch email", projectId: "brand-refresh" },
  { id: "chat-onboarding", title: "Rewrite onboarding copy", projectId: "onboarding" },
  { id: "chat-sprint", title: "Plan sprint goals", projectId: "pricing-research" },
];

/** The canned answer the composer streams when no `respond` prop is given */
function cannedReply(prompt: string, modelName: string, projectName?: string) {
  const where = projectName ? `the ${projectName} project` : "this workspace";
  return [
    `Here is a first pass for ${where}.`,
    `You asked: “${prompt}”. I pulled the three things that matter – the decision you are trying to make, the people it touches, and the one number that would settle it.`,
    "My suggestion: open with the outcome in a single line, put the strongest evidence next, and keep the caveats at the end where they read as care rather than doubt.",
    `${modelName} wrote this from the context in ${where}. Tell me which paragraph to push further and I will rewrite just that part.`,
  ].join("\n\n");
}

export function AiWorkspace({
  userName = "Lena",
  userAvatar,
  workspace = "N",
  assistants = DEFAULT_ASSISTANTS,
  projects: projectsProp = defaultWorkspaceProjects,
  chats: chatsProp = defaultWorkspaceChats,
  models = defaultWorkspaceModels,
  starters = DEFAULT_STARTERS,
  disclaimer = DEFAULT_DISCLAIMER,
  respond,
  className,
}: AiWorkspaceProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [view, setView] = useState<View>("home");
  const [chatSearch, setChatSearch] = useState("");
  const [chats, setChats] = useState(chatsProp);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [stream, setStream] = useState<Stream | null>(null);
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState(projectsProp);
  const [projectSearch, setProjectSearch] = useState("");
  const [sort, setSort] = useState<ProjectSort>("recent");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [projectMenu, setProjectMenu] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState("");
  const [crumbOpen, setCrumbOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const messagesRef = useRef<HTMLDivElement | null>(null);
  const dialogFieldRef = useRef<HTMLInputElement | null>(null);

  const activeChat = chats.find((chat) => chat.id === activeChatId);
  const selectedProject =
    projects.find((project) => project.id === (activeChat?.projectId ?? projectId)) ?? projects[0];
  const activeModel = models.find((model) => model.id === modelId) ?? models[0];

  /* Recents are filtered as you type; an empty field keeps the order they arrived in. */
  const visibleChats = useMemo(() => {
    const needle = chatSearch.trim().toLowerCase();
    if (!needle) return chats;
    return chats.filter((chat) => chat.title.toLowerCase().includes(needle));
  }, [chats, chatSearch]);

  /* Projects sort by recency (the order they arrived in) or by name. */
  const visibleProjects = useMemo(() => {
    const needle = projectSearch.trim().toLowerCase();
    const found = needle
      ? projects.filter((project) =>
          `${project.name} ${project.description}`.toLowerCase().includes(needle),
        )
      : projects;
    return sort === "name" ? [...found].sort((a, b) => a.name.localeCompare(b.name)) : found;
  }, [projects, projectSearch, sort]);

  const chatTotal = projects.reduce((total, project) => total + project.chats, 0);
  const initials = userName.trim().charAt(0).toUpperCase() || "?";

  /* A reply thinks for a beat, then types itself out; the finished text joins the transcript. */
  useEffect(() => {
    if (!stream) return;
    if (stream.thinking) {
      const timer = window.setTimeout(() => {
        setStream((current) =>
          current && current.id === stream.id ? { ...current, thinking: false } : current,
        );
      }, 620);
      return () => window.clearTimeout(timer);
    }
    if (stream.shown >= stream.full.length) {
      setMessages((all) => [...all, { id: stream.id, role: "assistant", text: stream.full }]);
      setStream(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setStream((current) =>
        current && current.id === stream.id
          ? { ...current, shown: Math.min(current.full.length, current.shown + 3) }
          : current,
      );
    }, 22);
    return () => window.clearTimeout(timer);
  }, [stream]);

  /* The transcript follows the newest line, including while it streams. */
  useEffect(() => {
    const box = messagesRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages, stream?.shown, stream?.thinking, view]);

  /* One pointerdown closes every popover that the press landed outside of. */
  useEffect(() => {
    if (!crumbOpen && !moreOpen && !sortOpen && !projectMenu) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-popover], .ui-aw__sort, .ui-aw__card-menu")) return;
      setCrumbOpen(false);
      setMoreOpen(false);
      setSortOpen(false);
      setProjectMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setCrumbOpen(false);
      setMoreOpen(false);
      setSortOpen(false);
      setProjectMenu(null);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [crumbOpen, moreOpen, sortOpen, projectMenu]);

  /* The dialog takes focus on its field and closes on Escape. */
  useEffect(() => {
    if (!dialogOpen) return;
    dialogFieldRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialogOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dialogOpen]);

  const reply = (prompt: string) => {
    const model = activeModel;
    if (respond && model) return respond(prompt, model);
    return cannedReply(prompt, model?.name ?? "Auto", selectedProject?.name);
  };

  const send = (text: string) => {
    const prompt = text.trim();
    if (!prompt || stream) return;
    const chatId = activeChatId ?? uid();
    const title = prompt.length > 42 ? `${prompt.slice(0, 42).trimEnd()}…` : prompt;

    setDraft("");
    setView("chat");
    setActiveChatId(chatId);
    setMessages((all) => [...all, { id: uid(), role: "user", text: prompt }]);
    setStream({ id: uid(), full: reply(prompt), shown: 0, thinking: true });
    setChats((all) =>
      all.some((chat) => chat.id === chatId)
        ? all
        : [{ id: chatId, title, projectId: projectId ?? undefined }, ...all],
    );
    setAnnouncement("Message sent");
  };

  const startChat = (assistant?: string) => {
    setView("home");
    setActiveChatId(null);
    setMessages([]);
    setStream(null);
    setDraft("");
    setAnnouncement(assistant ? `${assistant} is ready` : "New chat");
  };

  const openChat = (chat: WorkspaceChat) => {
    setView("chat");
    setActiveChatId(chat.id);
    setMessages(chat.messages ?? []);
    setStream(null);
    setDraft("");
    setAnnouncement(`${chat.title} opened`);
  };

  const openProject = (project: WorkspaceProject) => {
    setProjectId(project.id);
    setActiveChatId(null);
    setMessages([]);
    setStream(null);
    setView("home");
    setProjectMenu(null);
    setAnnouncement(`${project.name} selected`);
  };

  const createProject = () => {
    const name = newProject.trim();
    if (!name) return;
    const project: WorkspaceProject = {
      id: uid(),
      name,
      description: "No description yet – add one from the project menu.",
      chats: 0,
      updated: "Created just now",
    };
    setProjects((all) => [project, ...all]);
    setProjectId(project.id);
    setNewProject("");
    setDialogOpen(false);
    setAnnouncement(`${name} created`);
  };

  const commitRename = () => {
    const name = renameDraft.trim();
    if (renamingId && name) {
      setProjects((all) =>
        all.map((project) => (project.id === renamingId ? { ...project, name } : project)),
      );
      setAnnouncement("Project renamed");
    }
    setRenamingId(null);
  };

  const togglePin = (id: string) => {
    setProjects((all) =>
      all.map((project) => (project.id === id ? { ...project, pinned: !project.pinned } : project)),
    );
    setProjectMenu(null);
  };

  const removeProject = (project: WorkspaceProject) => {
    setProjects((all) => all.filter((item) => item.id !== project.id));
    if (projectId === project.id) setProjectId(null);
    setProjectMenu(null);
    setAnnouncement(`${project.name} deleted`);
  };

  const copyText = (text: string, note: string) => {
    const clip = navigator.clipboard;
    if (!clip) {
      setAnnouncement("Copying is not available in this browser");
      return;
    }
    void clip
      .writeText(text)
      .then(() => setAnnouncement(note))
      .catch(() => setAnnouncement("Could not copy"));
  };

  const exportChat = () => {
    if (messages.length === 0) return;
    const body = messages
      .map((message) => `${message.role === "user" ? "**You**" : "**Assistant**"}\n\n${message.text}`)
      .join("\n\n");
    copyText(body, "Chat copied as Markdown");
    setMoreOpen(false);
  };

  const deleteChat = () => {
    if (activeChatId) setChats((all) => all.filter((chat) => chat.id !== activeChatId));
    setMessages([]);
    setStream(null);
    setActiveChatId(null);
    setMoreOpen(false);
    setView("home");
    setAnnouncement("Chat deleted");
  };

  const regenerate = () => {
    const lastUser = [...messages].reverse().find((message) => message.role === "user");
    if (!lastUser || stream) return;
    setMessages((all) => {
      const copy = [...all];
      while (copy.length > 0 && copy[copy.length - 1].role === "assistant") copy.pop();
      return copy;
    });
    setStream({ id: uid(), full: reply(lastUser.text), shown: 0, thinking: true });
  };

  const rendered: WorkspaceMessage[] = stream
    ? [...messages, { id: stream.id, role: "assistant", text: stream.full.slice(0, stream.shown) }]
    : messages;

  const chatTitle = view === "projects" ? "Projects" : (activeChat?.title ?? "New chat");

  const composer = (
    <WorkspaceComposer
      value={draft}
      onChange={setDraft}
      onSend={send}
      models={models}
      modelId={activeModel?.id ?? ""}
      onModelChange={(model) => setModelId(model.id)}
      notice={announcement}
      projectLabel={projectId ? (projects.find((p) => p.id === projectId)?.name ?? projectId) : "Select a project"}
      onSelectProject={() => {
        setView("projects");
        setProjectMenu(null);
      }}
    />
  );

  return (
    <div className={["ui-aw", className].filter(Boolean).join(" ")} data-collapsed={collapsed ? "" : undefined}>
      {/* React 19 hoists this into <head> once, no matter how many workspaces render */}
      <style href="ui-ai-workspace" precedence="default">
        {css}
      </style>

      <aside className="ui-aw__side" aria-label="Workspace" inert={collapsed}>
        <div className="ui-aw__side-head">
          <span className="ui-aw__ws">{workspace}</span>
          <button
            type="button"
            className="ui-aw__icon"
            aria-label="Collapse sidebar"
            onClick={() => setCollapsed(true)}
          >
            <ChevronLeftIcon />
          </button>
        </div>

        <label className="ui-aw__search">
          <SearchIcon />
          <input
            placeholder="Search chats…"
            aria-label="Search chats"
            type="search"
            value={chatSearch}
            onChange={(event) => setChatSearch(event.target.value)}
          />
        </label>

        <nav className="ui-aw__nav">
          <button
            type="button"
            className="ui-aw__item"
            aria-current={view === "home" ? "true" : undefined}
            onClick={() => startChat()}
          >
            <PlusIcon />
            New chat
          </button>
          <button
            type="button"
            className="ui-aw__item"
            aria-current={view === "projects" ? "true" : undefined}
            onClick={() => setView("projects")}
          >
            <FolderIcon />
            Projects
          </button>
        </nav>

        <p className="ui-aw__group">Pinned</p>
        <div className="ui-aw__nav">
          {assistants.map((assistant) => (
            <button
              key={assistant}
              type="button"
              className="ui-aw__item"
              onClick={() => startChat(assistant)}
            >
              <PinIcon />
              <span className="ui-aw__ellipsis">{assistant}</span>
            </button>
          ))}
        </div>

        <p className="ui-aw__group">Recents</p>
        <div className="ui-aw__nav ui-aw__recents">
          {visibleChats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              className="ui-aw__item ui-aw__item--plain"
              aria-current={view === "chat" && activeChatId === chat.id ? "true" : undefined}
              onClick={() => openChat(chat)}
            >
              <span className="ui-aw__ellipsis">{chat.title}</span>
            </button>
          ))}
          {visibleChats.length === 0 ? <p className="ui-aw__none">No chats found</p> : null}
        </div>

        <div className="ui-aw__user">
          {userAvatar ? (
            <img alt="" width={24} height={24} src={userAvatar} />
          ) : (
            <span className="ui-aw__user-dot" aria-hidden="true">
              {initials}
            </span>
          )}
          <span>{userName}</span>
          <button
            type="button"
            className="ui-aw__icon"
            aria-label="Settings"
            onClick={() => setAnnouncement("Workspace settings")}
          >
            <SettingsIcon />
          </button>
        </div>
      </aside>

      <main className="ui-aw__main">
        <header className="ui-aw__bar">
          {collapsed ? (
            <button
              type="button"
              className="ui-aw__icon"
              aria-label="Expand sidebar"
              onClick={() => setCollapsed(false)}
            >
              <ChevronRightIcon />
            </button>
          ) : null}

          <div className="ui-aw__crumbs" data-popover="true">
            <button
              type="button"
              className="ui-aw__crumb-btn"
              aria-haspopup="menu"
              aria-expanded={crumbOpen}
              onClick={() => {
                setCrumbOpen((open) => !open);
                setMoreOpen(false);
                setSortOpen(false);
                setProjectMenu(null);
              }}
            >
              <span className="ui-aw__muted">{selectedProject?.name ?? "Workspace"}</span>
              <span className="ui-aw__slash">/</span>
              <span className="ui-aw__ellipsis">{chatTitle}</span>
              <ChevronDownIcon />
            </button>

            {crumbOpen ? (
              <div className="ui-aw__menu" role="menu" aria-label="Project">
                <p className="ui-aw__menu-title">Project</p>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={projectId === null}
                  className="ui-aw__menu-item"
                  onClick={() => {
                    setProjectId(null);
                    setCrumbOpen(false);
                  }}
                >
                  No project
                  {projectId === null ? <CheckIcon /> : null}
                </button>
                {projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={projectId === project.id}
                    className="ui-aw__menu-item"
                    onClick={() => {
                      setProjectId(project.id);
                      setCrumbOpen(false);
                      setAnnouncement(`${project.name} attached to this chat`);
                    }}
                  >
                    <FolderIcon size={14} />
                    {project.name}
                    {projectId === project.id ? <CheckIcon /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="ui-aw__more" data-popover="true">
            <button
              type="button"
              className="ui-aw__icon"
              aria-label="More"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              onClick={() => {
                setMoreOpen((open) => !open);
                setCrumbOpen(false);
                setSortOpen(false);
                setProjectMenu(null);
              }}
            >
              <DotsIcon />
            </button>

            {moreOpen ? (
              <div className="ui-aw__menu ui-aw__menu--right" role="menu" aria-label="Chat actions">
                <p className="ui-aw__menu-title">Chat</p>
                <button
                  type="button"
                  role="menuitem"
                  className="ui-aw__menu-item"
                  onClick={() => {
                    copyText(`${window.location.origin}/?chat=${activeChatId ?? "new"}`, "Chat link copied");
                    setMoreOpen(false);
                  }}
                >
                  <LinkIcon />
                  Copy link
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="ui-aw__menu-item"
                  disabled={messages.length === 0}
                  onClick={exportChat}
                >
                  <DownloadIcon />
                  Export chat
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="ui-aw__menu-item ui-aw__danger"
                  disabled={activeChatId === null}
                  onClick={deleteChat}
                >
                  <TrashIcon />
                  Delete chat
                </button>
              </div>
            ) : null}
          </div>
        </header>

        {view === "home" ? (
          <section className="ui-aw__welcome">
            <h2 className="ui-aw__hello">Hello {userName}</h2>
            <p className="ui-aw__sub">What can I help you with today?</p>
            <div className="ui-aw__composer">{composer}</div>
            <div className="ui-aw__starters">
              {starters.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  className="ui-aw__starter"
                  onClick={() => send(starter)}
                >
                  {starter}
                </button>
              ))}
            </div>
            <p className="ui-aw__disclaimer">{disclaimer}</p>
          </section>
        ) : view === "chat" ? (
          <div className="ui-aw__chat">
            <div className="ui-aw__messages" ref={messagesRef}>
              {rendered.map((message) => {
                const busy = stream !== null && stream.id === message.id;
                if (message.role === "user") {
                  return (
                    <div key={message.id} className="ui-aw__msg ui-aw__msg--user">
                      <p>{message.text}</p>
                    </div>
                  );
                }
                return (
                  <div key={message.id} className="ui-aw__msg ui-aw__msg--ai">
                    <span
                      className={["ui-aw__mark", busy ? "ui-aw__mark--busy" : ""].filter(Boolean).join(" ")}
                      aria-hidden="true"
                    />
                    <div className="ui-aw__ai-body">
                      {busy && stream?.thinking ? (
                        <p className="ui-aw__thinking">Thinking…</p>
                      ) : (
                        <p>{message.text}</p>
                      )}
                      {!busy && stream === null ? (
                        <div className="ui-aw__actions">
                          <button
                            type="button"
                            className="ui-aw__icon"
                            aria-label="Copy answer"
                            onClick={() => copyText(message.text, "Answer copied")}
                          >
                            <CopyIcon />
                          </button>
                          <button
                            type="button"
                            className="ui-aw__icon"
                            aria-label="Regenerate answer"
                            onClick={regenerate}
                          >
                            <RefreshIcon />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {rendered.length === 0 ? (
                <p className="ui-aw__none ui-aw__none--center">
                  Nothing here yet – ask anything below.
                </p>
              ) : null}
            </div>
            <div className="ui-aw__composer ui-aw__composer--dock">
              {composer}
              <p className="ui-aw__disclaimer">{disclaimer}</p>
            </div>
          </div>
        ) : (
          <section className="ui-aw__projects">
            <div className="ui-aw__projects-head">
              <span className="ui-aw__tile" aria-hidden="true">
                <FolderIcon size={20} />
              </span>
              <div>
                <h2 className="ui-aw__title">Projects</h2>
                <p className="ui-aw__sub ui-aw__sub--left">
                  {visibleProjects.length} projects · {chatTotal} chats
                </p>
              </div>
              <button type="button" className="ui-aw__primary" onClick={() => setDialogOpen(true)}>
                <PlusIcon size={14} />
                New project
              </button>
            </div>

            <label className="ui-aw__search ui-aw__search--wide">
              <SearchIcon />
              <input
                placeholder="Search projects…"
                aria-label="Search projects"
                type="search"
                value={projectSearch}
                onChange={(event) => setProjectSearch(event.target.value)}
              />
            </label>

            <div className="ui-aw__list-head">
              <span>All projects</span>
              <div className="ui-aw__sort">
                <button
                  type="button"
                  className="ui-aw__sort-btn"
                  aria-haspopup="menu"
                  aria-expanded={sortOpen}
                  onClick={() => {
                    setSortOpen((open) => !open);
                    setCrumbOpen(false);
                    setMoreOpen(false);
                    setProjectMenu(null);
                  }}
                >
                  Sort: <strong>{sort === "recent" ? "Recent" : "Name"}</strong>
                  <ChevronDownIcon size={12} />
                </button>
                {sortOpen ? (
                  <div className="ui-aw__menu ui-aw__menu--right" role="menu" aria-label="Sort projects">
                    <p className="ui-aw__menu-title">Sort by</p>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={sort === "recent"}
                      className="ui-aw__menu-item"
                      onClick={() => {
                        setSort("recent");
                        setSortOpen(false);
                      }}
                    >
                      Recent
                      {sort === "recent" ? <CheckIcon /> : null}
                    </button>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={sort === "name"}
                      className="ui-aw__menu-item"
                      onClick={() => {
                        setSort("name");
                        setSortOpen(false);
                      }}
                    >
                      Name A–Z
                      {sort === "name" ? <CheckIcon /> : null}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            {visibleProjects.length === 0 ? (
              <p className="ui-aw__none ui-aw__none--center">
                No projects match “{projectSearch}”.
              </p>
            ) : (
              <ul className="ui-aw__grid">
                {visibleProjects.map((project) => (
                  <li key={project.id} className="ui-aw__project">
                    <div
                      className="ui-aw__project-card"
                      onClick={() => {
                        if (renamingId === project.id) return;
                        openProject(project);
                      }}
                    >
                      <div className="ui-aw__project-top">
                        <FolderIcon />
                        {renamingId === project.id ? (
                          <input
                            className="ui-aw__rename"
                            aria-label="Project name"
                            value={renameDraft}
                            autoFocus
                            onChange={(event) => setRenameDraft(event.target.value)}
                            onBlur={commitRename}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") commitRename();
                              if (event.key === "Escape") setRenamingId(null);
                            }}
                          />
                        ) : (
                          <>
                            <span className="ui-aw__project-name">{project.name}</span>
                            {project.pinned ? (
                              <span className="ui-aw__pinned" title="Pinned">
                                <PinIcon size={14} />
                              </span>
                            ) : null}
                          </>
                        )}
                        <div
                          className="ui-aw__card-menu"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="ui-aw__icon ui-aw__dots"
                            aria-label={`Options for ${project.name}`}
                            aria-haspopup="menu"
                            aria-expanded={projectMenu === project.id}
                            onClick={() => {
                              setProjectMenu((open) => (open === project.id ? null : project.id));
                              setCrumbOpen(false);
                              setMoreOpen(false);
                              setSortOpen(false);
                            }}
                          >
                            <DotsIcon />
                          </button>
                          {projectMenu === project.id ? (
                            <div
                              className="ui-aw__menu ui-aw__menu--right"
                              role="menu"
                              aria-label={`${project.name} options`}
                            >
                              <button
                                type="button"
                                role="menuitem"
                                className="ui-aw__menu-item"
                                onClick={() => openProject(project)}
                              >
                                <FolderIcon size={14} />
                                Open project
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className="ui-aw__menu-item"
                                onClick={() => {
                                  setRenameDraft(project.name);
                                  setRenamingId(project.id);
                                  setProjectMenu(null);
                                }}
                              >
                                <PencilIcon />
                                Rename
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className="ui-aw__menu-item"
                                onClick={() => togglePin(project.id)}
                              >
                                <PinIcon size={14} />
                                {project.pinned ? "Unpin" : "Pin to top"}
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className="ui-aw__menu-item ui-aw__danger"
                                onClick={() => removeProject(project)}
                              >
                                <TrashIcon />
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {renamingId === project.id ? null : (
                        <p className="ui-aw__project-desc">{project.description}</p>
                      )}
                    </div>
                    <p className="ui-aw__project-foot">
                      {project.chats} {project.chats === 1 ? "chat" : "chats"} · {project.updated}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <div
          className="ui-aw__backdrop"
          aria-hidden="true"
          data-open={dialogOpen ? "true" : undefined}
          onClick={() => setDialogOpen(false)}
        />
        <div
          className="ui-aw__dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ui-aw-create"
          data-open={dialogOpen ? "true" : undefined}
          inert={!dialogOpen}
        >
          <div className="ui-aw__dialog-card">
            <h3 id="ui-aw-create" className="ui-aw__dialog-title">
              Create project
            </h3>
            <input
              ref={dialogFieldRef}
              className="ui-aw__field"
              placeholder="Project name"
              aria-label="Project name"
              value={newProject}
              onChange={(event) => setNewProject(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") createProject();
              }}
            />
          </div>
          <div className="ui-aw__dialog-foot">
            <button
              type="button"
              className="ui-aw__btn"
              onClick={() => {
                setNewProject("");
                setDialogOpen(false);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ui-aw__primary"
              disabled={newProject.trim().length === 0}
              onClick={createProject}
            >
              Create
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ---------- Composer ---------- */

type ComposerPhase = "idle" | "loading" | "done";

type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string) => void;
  models: WorkspaceModel[];
  modelId: string;
  onModelChange: (model: WorkspaceModel) => void;
  /** Copy of the project row once apps are connected */
  projectLabel: string;
  onSelectProject: () => void;
  /** Workspace status, read by the composer's live region */
  notice?: string;
};

type Placement = {
  top: number;
  left: number;
  up: boolean;
  fromTop: string;
  fromLeft: string;
  fromBottom: string;
  radius: string;
};

const IDLE_PLACEMENT: Placement = {
  top: 0,
  left: 0,
  up: true,
  fromTop: "0px",
  fromLeft: "0px",
  fromBottom: "0px",
  radius: "0px",
};

const MENU_GAP = 6;
const MENU_WIDTH = 300;
const LINE_UNIT = 106.424;
const LOAD = 650;
const TRACE_BARS = 16;
const WAVE = [3, 7, 12, 5, 9, 14, 6, 10, 4, 8, 13, 5, 11, 7, 15, 6];

function WorkspaceComposer({
  value,
  onChange,
  onSend,
  models,
  modelId,
  onModelChange,
  projectLabel,
  onSelectProject,
  notice,
}: ComposerProps) {
  const hostRef = useRef<HTMLElement | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const optionId = useId();

  const [grow, setGrow] = useState(0);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [placement, setPlacement] = useState(IDLE_PLACEMENT);
  const [placing, setPlacing] = useState(false);
  const [fill, setFill] = useState({ y: 4, height: 36, opacity: 0 });
  const [glide, setGlide] = useState(false);
  const [morph, setMorph] = useState(0);
  const [apps, setApps] = useState<ComposerPhase>("idle");
  const [approval, setApproval] = useState<ComposerPhase>("idle");
  const [recording, setRecording] = useState(false);
  const [tick, setTick] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  const selected = models.find((model) => model.id === modelId) ?? models[0];
  const selectedIndex = Math.max(
    0,
    models.findIndex((model) => model.id === selected?.id),
  );
  const canSend = value.trim().length > 0;

  /* The field grows a line at a time; the sheet animates the card to the new height. */
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    const previous = field.style.height;
    field.style.height = "auto";
    const measured = field.scrollHeight;
    field.style.height = previous;
    const lineHeight = Number.parseFloat(window.getComputedStyle(field).lineHeight) || 1;
    const lines = Math.max(1, Math.round(measured / lineHeight));
    const next = Math.min(4, lines - 1) * LINE_UNIT;
    setGrow((current) => (current === next ? current : next));
  }, [value]);

  /* The menu is measured before it becomes visible, then its clip-path may animate. */
  const placeMenu = useCallback(() => {
    const host = hostRef.current;
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    const panel = panelRef.current;
    if (!host || !trigger || !menu || !panel) return;

    const hostBox = host.getBoundingClientRect();
    const triggerBox = trigger.getBoundingClientRect();
    const width = Math.min(menu.offsetWidth || MENU_WIDTH, hostBox.width);
    const height = panel.offsetHeight;
    const roomAbove = triggerBox.top - hostBox.top;
    const up = roomAbove >= height + MENU_GAP;
    const top = up
      ? triggerBox.top - hostBox.top - height - MENU_GAP
      : triggerBox.bottom - hostBox.top + MENU_GAP;
    const left = Math.max(0, Math.min(triggerBox.right - hostBox.left - width, hostBox.width - width));
    const corner = "calc(100% - 10px)";

    setPlacement({
      top,
      left,
      up,
      fromTop: up ? corner : "0px",
      fromLeft: corner,
      fromBottom: up ? "0px" : corner,
      radius: "8px",
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    setPlacing(true);
    placeMenu();
    const frame = window.requestAnimationFrame(() => {
      setPlacing(false);
      setGlide(true);
      panelRef.current?.focus({ preventScroll: true });
    });
    const onResize = () => placeMenu();
    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [open, placeMenu]);

  /* The gray fill glides to whichever row is active. */
  useLayoutEffect(() => {
    if (!open) {
      setGlide(false);
      setFill((current) => (current.opacity === 0 ? current : { ...current, opacity: 0 }));
      return;
    }
    const row = optionRefs.current[active];
    setFill({
      y: row ? row.offsetTop : 4,
      height: row ? row.offsetHeight : 36,
      opacity: 1,
    });
  }, [open, active]);

  /* A press anywhere else closes the menu. */
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && menuRef.current && !menuRef.current.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  /* The trigger's face plays its entrance once per pick. */
  useEffect(() => {
    if (morph === 0) return;
    const timer = window.setTimeout(() => setMorph(0), 520);
    return () => window.clearTimeout(timer);
  }, [morph]);

  /* The trace walks its bars while the mic is open. */
  useEffect(() => {
    if (!recording) {
      setTick(0);
      return;
    }
    const timer = window.setInterval(() => setTick((current) => current + 1), 110);
    return () => window.clearInterval(timer);
  }, [recording]);

  /* Running themselves, both chips hold "loading" for the two waves the sheet draws. */
  useEffect(() => {
    if (approval !== "loading") return;
    const timer = window.setTimeout(() => setApproval("done"), LOAD * 2);
    return () => window.clearTimeout(timer);
  }, [approval]);

  useEffect(() => {
    if (apps !== "loading") return;
    const timer = window.setTimeout(() => setApps("done"), LOAD * 2);
    return () => window.clearTimeout(timer);
  }, [apps]);

  const choose = (model: WorkspaceModel) => {
    onModelChange(model);
    setActive(models.indexOf(model));
    setMorph((current) => current + 1);
    setOpen(false);
    setAnnouncement(`${model.name} selected`);
    triggerRef.current?.focus({ preventScroll: true });
  };

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + models.length) % Math.max(1, models.length));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(Math.max(0, models.length - 1));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const model = models[active];
      if (model) choose(model);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  const submit = () => {
    const message = value.trim();
    if (!message) return;
    onSend(message);
    fieldRef.current?.focus({ preventScroll: true });
  };

  const bodyStyle = { "--ui-cc-grow": grow } as CSSProperties;
  const menuStyle = {
    top: placement.top,
    left: placement.left,
    "--from-top": placement.fromTop,
    "--from-left": placement.fromLeft,
    "--from-bottom": placement.fromBottom,
    "--from-radius": placement.radius,
  } as CSSProperties;

  return (
    <div className="ui-chat-composer">
      <section
        ref={hostRef}
        className="ui-chat-composer__body"
        data-apps={apps}
        data-approval={approval}
        data-recording={recording ? "true" : "false"}
        aria-label="Message composer"
        style={bodyStyle}
      >
        <div className="ui-chat-composer__tray">
          <button
            type="button"
            className="ui-chat-composer__row ui-chat-composer__project"
            inert={apps !== "done"}
            aria-hidden={apps !== "done"}
            onClick={onSelectProject}
          >
            <span className="ui-chat-composer__icon ui-chat-composer__icon--folder">
              <ProjectFolderMark />
            </span>
            <span className="ui-chat-composer__label">{projectLabel}</span>
          </button>

          <button
            type="button"
            className="ui-chat-composer__row ui-chat-composer__connect"
            aria-busy={apps === "loading"}
            onClick={() => {
              if (apps !== "idle") return;
              setApps("loading");
              setAnnouncement("Connecting your apps");
            }}
          >
            <span className="ui-chat-composer__logos" aria-hidden="true">
              <span className="ui-chat-composer__logo ui-chat-composer__logo--gmail">
                <GmailMark />
              </span>
              <span className="ui-chat-composer__logo ui-chat-composer__logo--slack">
                <SlackMark />
              </span>
              <span className="ui-chat-composer__logo ui-chat-composer__logo--clickup">
                <ClickUpMark />
              </span>
            </span>
            <span className="ui-chat-composer__label ui-chat-composer__shimmer" data-text="Connect apps">
              Connect apps
            </span>
          </button>
        </div>

        <div className="ui-chat-composer__card">
          <textarea
            ref={fieldRef}
            className="ui-chat-composer__message"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="How can I help you today?"
            aria-label="Message"
            spellCheck={false}
          />
          <div className="ui-chat-composer__draft" aria-hidden="true">
            <span className="ui-chat-composer__heard" />
          </div>

          <div className="ui-chat-composer__toolbar">
            <button
              type="button"
              className="ui-chat-composer__icon-btn"
              aria-label="Add attachment"
              onClick={() => setAnnouncement("Attaching a file")}
            >
              <span className="ui-chat-composer__icon">
                <AttachIcon />
              </span>
            </button>
            <button
              type="button"
              className="ui-chat-composer__approval"
              aria-busy={approval === "loading"}
              aria-disabled={approval === "done"}
              onClick={() => {
                if (approval !== "idle") return;
                setApproval("loading");
                setAnnouncement("Requesting unrestricted access");
              }}
            >
              <span className="ui-chat-composer__wash" aria-hidden="true" />
              <span className="ui-chat-composer__icon" aria-hidden="true">
                <HandIcon />
                <ShieldIcon />
              </span>
              <span className="ui-chat-composer__approval-text">
                <span
                  className="ui-chat-composer__request ui-chat-composer__shimmer"
                  data-text="Request approval"
                  aria-hidden={approval === "done"}
                >
                  Request approval
                </span>
                <span className="ui-chat-composer__granted" aria-hidden={approval !== "done"}>
                  Unrestricted access
                </span>
              </span>
            </button>
          </div>

          <div className="ui-chat-composer__toolbar ui-chat-composer__toolbar--end">
            <button
              ref={triggerRef}
              type="button"
              className="ui-chat-composer__model"
              aria-haspopup="listbox"
              aria-expanded={open}
              onClick={() => {
                if (open) {
                  setOpen(false);
                  return;
                }
                setActive(selectedIndex);
                setGlide(false);
                setOpen(true);
              }}
            >
              <span
                key={morph}
                className="ui-chat-composer__model-face"
                data-morph={morph > 0 ? "" : undefined}
              >
                {selected?.logo ? (
                  <span className="ui-chat-composer__model-logo" aria-hidden="true">
                    {selected.logo}
                  </span>
                ) : null}
                <span className="ui-chat-composer__label">{selected?.name ?? "Auto"}</span>
              </span>
              <span
                className="ui-chat-composer__icon ui-chat-composer__icon--chevron"
                aria-hidden="true"
              >
                <ModelChevronIcon />
              </span>
            </button>

            <button
              type="button"
              className="ui-chat-composer__icon-btn"
              aria-label="Voice input"
              onClick={() => {
                setRecording(true);
                setAnnouncement("Listening for your message");
              }}
            >
              <span className="ui-chat-composer__icon">
                <MicIcon />
              </span>
            </button>

            <button
              type="button"
              className="ui-chat-composer__send"
              aria-label="Send message"
              disabled={!canSend}
              onClick={submit}
            >
              <SendIcon />
            </button>
          </div>

          <div
            className="ui-chat-composer__toolbar ui-chat-composer__toolbar--end ui-chat-composer__toolbar--voice"
            inert={!recording}
          >
            <span className="ui-chat-composer__trace" aria-hidden="true">
              {Array.from({ length: TRACE_BARS }, (_, index) => (
                <span
                  key={index}
                  style={{
                    height: recording
                      ? `calc(${2 + WAVE[(index * 3 + tick) % WAVE.length]} * var(--u))`
                      : "calc(8 * var(--u))",
                  }}
                />
              ))}
            </span>
            <button
              type="button"
              className="ui-chat-composer__square"
              aria-label="Discard recording"
              onClick={() => {
                setRecording(false);
                setAnnouncement("Recording discarded");
              }}
            >
              <DiscardIcon />
            </button>
            <button
              type="button"
              className="ui-chat-composer__square"
              aria-label="Use recording"
              onClick={() => {
                setRecording(false);
                setAnnouncement("Recording kept");
              }}
            >
              <CheckMark />
            </button>
          </div>
        </div>

        <div
          ref={menuRef}
          className="ui-chat-composer__menu"
          data-open={open ? "true" : "false"}
          data-placing={placing ? "true" : "false"}
          data-up={placement.up ? "true" : "false"}
          inert={!open}
          style={menuStyle}
        >
          <div
            ref={panelRef}
            className="ui-chat-composer__menu-panel"
            role="listbox"
            tabIndex={-1}
            aria-label="Select a model"
            aria-activedescendant={models.length ? `${optionId}-${active}` : undefined}
            onKeyDown={onMenuKeyDown}
          >
            <span
              className="ui-chat-composer__menu-fill"
              aria-hidden="true"
              data-glide={glide ? "true" : "false"}
              style={{
                transform: `translateY(${fill.y}px)`,
                height: fill.height,
                opacity: fill.opacity,
              }}
            />
            {models.map((model, index) => (
              <div
                key={model.id}
                id={`${optionId}-${index}`}
                role="option"
                aria-selected={model.id === selected?.id}
                className="ui-chat-composer__option"
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(model)}
              >
                <span className="ui-chat-composer__option-logo" aria-hidden="true">
                  {model.logo ?? <SparkleMark />}
                </span>
                <span className="ui-chat-composer__option-text">
                  <span className="ui-chat-composer__option-name">{model.name}</span>
                  <span className="ui-chat-composer__option-desc">{model.description}</span>
                </span>
                <span className="ui-chat-composer__option-check" aria-hidden="true">
                  <CheckMark />
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <p className="ui-chat-composer__sr-only" aria-live="polite">
        {[notice, announcement].filter(Boolean).join(". ")}
      </p>
    </div>
  );
}

/* ---------- Icons ---------- */

type IconProps = { size?: number };

const ChevronLeftIcon = ({ size = 16 }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ChevronRightIcon = ({ size = 16 }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const ChevronDownIcon = ({ size = 14 }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const SearchIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width={15}
    height={15}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" />
    <path d="m20 20-4-4" />
  </svg>
);

const PlusIcon = ({ size = 16 }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);

const FolderIcon = ({ size = 16 }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  </svg>
);

const PinIcon = ({ size = 15 }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 17v5" />
    <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1Z" />
  </svg>
);

const SettingsIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width={16}
    height={16}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
  </svg>
);

const DotsIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width={16}
    height={16}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
    <path d="M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
    <path d="M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
  </svg>
);

const CheckIcon = ({ size = 14 }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 14L8.5 17.5L19 6.5" />
  </svg>
);

const CopyIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width={14}
    height={14}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h8" />
  </svg>
);

const RefreshIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width={14}
    height={14}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 12a8 8 0 1 1-2.34-5.66" />
    <path d="M20 4v5h-5" />
  </svg>
);

const PencilIcon = ({ size = 14 }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4Z" />
    <path d="m14.5 5.5 4 4" />
  </svg>
);

const TrashIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width={14}
    height={14}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 7h16" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
  </svg>
);

const DownloadIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width={14}
    height={14}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 4v11" />
    <path d="m7 11 5 5 5-5" />
    <path d="M5 20h14" />
  </svg>
);

const LinkIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width={14}
    height={14}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1.5 1.5" />
    <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1.5-1.5" />
  </svg>
);

/* Composer marks – paths lifted from the reference composer */

const AttachIcon = () => (
  <svg viewBox="0 0 68.155 68.155" fill="none" aria-hidden="true">
    <path
      d="M34.0812 11.3588V56.7954M56.7995 34.0771H11.3629"
      stroke="currentColor"
      strokeWidth={4.25969}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const HandIcon = () => (
  <svg viewBox="0 0 68.155 68.155" fill="none" className="ui-chat-composer__hand" aria-hidden="true">
    <path
      d="M52.5305 32.6557V24.8463C52.5305 22.1016 54.7555 19.8766 57.5001 19.8766C60.2448 19.8766 62.4698 22.1016 62.4698 24.8463V42.027C62.4698 53.3194 53.3154 62.4735 42.0233 62.4735H34.2388M22.7127 39.7552L15.94 31.8537C14.8314 30.5602 13.2129 29.8159 11.5094 29.8159H11.1235C8.11379 29.8159 5.67395 32.2558 5.67395 35.2655C5.67395 36.3412 5.99241 37.393 6.58919 38.2881L16.4118 53.0221C20.3482 58.9269 26.9753 62.4735 34.0719 62.4735"
      stroke="currentColor"
      strokeWidth={4.25969}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M52.534 24.1378V16.3284C52.534 13.5837 50.3091 11.3588 47.5644 11.3588C44.8197 11.3588 42.5948 13.5837 42.5948 16.3284V29.8174"
      stroke="currentColor"
      strokeWidth={4.25969}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M42.5958 29.8198V10.6513C42.5958 7.90661 40.3708 5.68163 37.6262 5.68163C34.8815 5.68163 32.6565 7.90661 32.6565 10.6513V28.4"
      stroke="currentColor"
      strokeWidth={4.25969}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M32.6576 28.3975V16.3284C32.6576 13.5837 30.4326 11.3588 27.6879 11.3588C24.9433 11.3588 22.7183 13.5837 22.7183 16.3284V39.7567"
      stroke="currentColor"
      strokeWidth={4.25969}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 66.543 66.543" fill="none" className="ui-chat-composer__shield" aria-hidden="true">
    <path
      d="M33.2482 22.1795V33.27"
      stroke="#F44900"
      strokeWidth={4.15894}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M33.5966 43.67H33.2501M33.9432 43.67C33.9432 44.0529 33.633 44.3631 33.2501 44.3631C32.8672 44.3631 32.5569 44.0529 32.5569 43.67C32.5569 43.2871 32.8672 42.9768 33.2501 42.9768C33.633 42.9768 33.9432 43.2871 33.9432 43.67Z"
      stroke="#F44900"
      strokeWidth={4.15894}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M58.202 31.0087V22.9595C58.202 18.4124 58.202 16.1389 57.0816 14.6555C55.9612 13.1722 53.4278 12.452 48.3612 11.0118C44.8995 10.0278 41.848 8.84228 39.41 7.76002C36.0859 6.28445 34.4237 5.54666 33.2484 5.54666C32.0728 5.54666 30.4109 6.28445 27.0868 7.76002C24.6487 8.84228 21.5973 10.0278 18.1357 11.0118C13.069 12.452 10.5356 13.1722 9.4152 14.6555C8.29475 16.1389 8.29475 18.4124 8.29475 22.9595V31.0087C8.29475 46.605 22.3319 55.9626 29.3498 59.6666C31.0331 60.5549 31.8748 60.9991 33.2484 60.9991C34.622 60.9991 35.4635 60.5549 37.1467 59.6666C44.1648 55.9626 58.202 46.605 58.202 31.0087Z"
      stroke="#F44900"
      strokeWidth={4.15894}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ModelChevronIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const MicIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M7 6.5C7 4.01472 9.01472 2 11.5 2C13.9853 2 16 4.01472 16 6.5V11.5C16 13.9853 13.9853 16 11.5 16C9.01472 16 7 13.9853 7 11.5V6.5Z"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M11.5 19H11.0828C7.57267 19 4.57706 16.4623 4 13M11.5 19H11.9172C15.4273 19 18.4229 16.4623 19 13M11.5 19V22"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 5.5V19"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M18 11C18 11 13.5811 5.00001 12 5C10.4188 4.99999 6 11 6 11"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const DiscardIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    color="#737373"
    aria-hidden="true"
  >
    <path d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085" />
  </svg>
);

const CheckMark = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 14L8.5 17.5L19 6.5" />
  </svg>
);

const SparkleMark = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M15 2L15.5387 4.39157C15.9957 6.42015 17.5798 8.00431 19.6084 8.46127L22 9L19.6084 9.53873C17.5798 9.99569 15.9957 11.5798 15.5387 13.6084L15 16L14.4613 13.6084C14.0043 11.5798 12.4202 9.99569 10.3916 9.53873L8 9L10.3916 8.46127C12.4201 8.00431 14.0043 6.42015 14.4613 4.39158L15 2Z" />
    <path d="M7 12L7.38481 13.7083C7.71121 15.1572 8.84275 16.2888 10.2917 16.6152L12 17L10.2917 17.3848C8.84275 17.7112 7.71121 18.8427 7.38481 20.2917L7 22L6.61519 20.2917C6.28879 18.8427 5.15725 17.7112 3.70827 17.3848L2 17L3.70827 16.6152C5.15725 16.2888 6.28879 15.1573 6.61519 13.7083L7 12Z" />
  </svg>
);

const ProjectFolderMark = () => (
  <svg viewBox="0 0 67 67" fill="none" aria-hidden="true">
    <path
      d="M11.1704 15.3527V30.7069H55.837V23.7277C55.837 19.8732 52.7123 16.7485 48.8578 16.7485H33.5037L29.5778 10.8598C28.5423 9.30649 26.799 8.37352 24.9322 8.37352H18.1495C14.295 8.37352 11.1704 11.4982 11.1704 15.3527Z"
      fill="#00A1FF"
    />
    <path
      d="M33.5037 16.7485L29.5778 10.8598C28.5423 9.30649 26.799 8.37352 24.9322 8.37352H18.1495C14.295 8.37352 11.1704 11.4982 11.1704 15.3527V30.7068H55.837V23.7277C55.837 19.8732 52.7123 16.7485 48.8578 16.7485H33.5037ZM33.5037 16.7485H23.7328"
      stroke="#00A1FF"
      strokeWidth={4.1875}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      opacity="0.4"
      d="M6.59197 42.3758C5.54336 37.1185 5.01906 34.4899 6.50878 32.7085C6.6081 32.5899 6.71315 32.4751 6.82359 32.3646C8.47975 30.71 11.4107 30.71 17.2725 30.71H49.7312C55.5931 30.71 58.5238 30.71 60.1801 32.3646C60.2904 32.4751 60.3957 32.5899 60.495 32.7085C61.9847 34.4899 61.4604 37.1185 60.4118 42.3758C58.9041 49.9348 58.15 53.7144 55.3073 56.0363C55.1133 56.1945 54.9134 56.3467 54.7076 56.4921C51.6932 58.6266 47.4792 58.6266 39.0506 58.6266H27.9531C19.5246 58.6266 15.3104 58.6266 12.296 56.4921C12.0904 56.3467 11.8904 56.1945 11.6965 56.0363C8.85353 53.7144 8.09969 49.9348 6.59197 42.3758Z"
      fill="#929292"
    />
    <path
      d="M6.59197 42.3758C5.54336 37.1185 5.01906 34.4899 6.50878 32.7085C6.6081 32.5899 6.71315 32.4751 6.82359 32.3646C8.47975 30.71 11.4107 30.71 17.2725 30.71H49.7312C55.5931 30.71 58.5238 30.71 60.1801 32.3646C60.2904 32.4751 60.3957 32.5899 60.495 32.7085C61.9847 34.4899 61.4604 37.1185 60.4118 42.3758C58.9041 49.9348 58.15 53.7144 55.3073 56.0363C55.1133 56.1945 54.9134 56.3467 54.7076 56.4921C51.6932 58.6266 47.4792 58.6266 39.0506 58.6266H27.9531C19.5246 58.6266 15.3104 58.6266 12.296 56.4921C12.0904 56.3467 11.8904 56.1945 11.6965 56.0363C8.85353 53.7144 8.09969 49.9348 6.59197 42.3758Z"
      fill="#3CC7FF"
      stroke="#3CC7FF"
      strokeWidth={4.1875}
    />
  </svg>
);

const GmailMark = () => (
  <svg viewBox="0 0 56.4108 44.8722" fill="none" aria-hidden="true">
    <path
      d="M44.2255 5.76727H56.4051V41.0239C56.4051 43.148 54.683 44.8701 52.5589 44.8701H46.1486C45.8961 44.8701 45.646 44.8204 45.4127 44.7237C45.1794 44.6271 44.9674 44.4854 44.7888 44.3069C44.6102 44.1283 44.4686 43.9163 44.3719 43.683C44.2753 43.4497 44.2255 43.1996 44.2255 42.947V5.76727Z"
      fill="url(#ui-cc_r_4_-0)"
    />
    <path
      d="M12.1796 5.76727H0V41.0239C0 43.148 1.72213 44.8701 3.84618 44.8701H10.2565C10.509 44.8701 10.7591 44.8204 10.9924 44.7237C11.2257 44.6271 11.4377 44.4854 11.6163 44.3069C11.7949 44.1283 11.9365 43.9163 12.0332 43.683C12.1298 43.4497 12.1796 43.1996 12.1796 42.947V5.76727Z"
      fill="#FC413D"
    />
    <path
      d="M10.0085 1.42778C7.43377 -0.736342 3.5924 -0.403647 1.42828 2.17105C-0.735843 4.74543 -0.403148 8.58681 2.17155 10.7512L26.5557 31.2479C27.0178 31.6362 27.602 31.8492 28.2056 31.8492C28.8091 31.8492 29.3934 31.6362 29.8554 31.2479L54.2396 10.7509C56.814 8.58681 57.1467 4.74543 54.9825 2.17073C52.8184 -0.403648 48.977 -0.736342 46.4027 1.42778L28.2054 16.724L10.0085 1.42778Z"
      fill="url(#ui-cc_r_4_-1)"
    />
    <defs>
      <linearGradient
        id="ui-cc_r_4_-0"
        x1="50.3153"
        y1="5.76727"
        x2="50.3153"
        y2="44.8701"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#60D673" />
        <stop offset="0.17" stopColor="#42C868" />
        <stop offset="0.39" stopColor="#0EBC5F" />
        <stop offset="0.62" stopColor="#00A9BB" />
        <stop offset="0.86" stopColor="#3C90FF" />
        <stop offset="1" stopColor="#3186FF" />
      </linearGradient>
      <linearGradient
        id="ui-cc_r_4_-1"
        x1="6.04194e-05"
        y1="6.45153"
        x2="56.4107"
        y2="6.45153"
        gradientUnits="userSpaceOnUse"
      >
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

const SlackMark = () => (
  <svg viewBox="0 0 49.883 49.877" fill="none" aria-hidden="true">
    <g transform="translate(0 0)">
      <path
        d="M18.3549 10.4784C15.4713 10.4784 13.1157 8.12279 13.1157 5.2392C13.1157 2.35561 15.4713 0 18.3549 0C21.2385 0 23.5941 2.35561 23.5941 5.2392V10.4784H18.3549Z"
        fill="#36C5F0"
      />
      <path
        d="M18.3575 13.12C21.2411 13.12 23.5967 15.4756 23.5967 18.3592C23.5967 21.2428 21.2411 23.5984 18.3575 23.5984H5.2392C2.35561 23.5984 0 21.2428 0 18.3592C0 15.4756 2.35561 13.12 5.2392 13.12H18.3575Z"
        fill="#36C5F0"
      />
    </g>
    <g transform="translate(26.28 0)">
      <path
        d="M13.1244 18.3592C13.1244 15.4756 15.48 13.12 18.3636 13.12C21.2472 13.12 23.6028 15.4756 23.6028 18.3592C23.6028 21.2428 21.2472 23.5984 18.3636 23.5984H13.1244V18.3592Z"
        fill="#2EB67D"
      />
      <path
        d="M10.4785 18.3575C10.4785 21.2411 8.12286 23.5967 5.23927 23.5967C2.35568 23.5967 7.4362e-05 21.2411 7.4362e-05 18.3575V5.2392C7.4362e-05 2.35561 2.35568 0 5.23927 0C8.12286 0 10.4785 2.35561 10.4785 5.2392V18.3575Z"
        fill="#2EB67D"
      />
    </g>
    <g transform="translate(0 26.28)">
      <path
        d="M10.4784 5.2392C10.4784 8.12279 8.12279 10.4784 5.2392 10.4784C2.35561 10.4784 0 8.12279 0 5.2392C0 2.35561 2.35561 0 5.2392 0H10.4784V5.2392Z"
        fill="#E01E5A"
      />
      <path
        d="M13.1157 5.2392C13.1157 2.35561 15.4713 0 18.3549 0C21.2385 0 23.5941 2.35561 23.5941 5.2392V18.3575C23.5941 21.2411 21.2385 23.5967 18.3549 23.5967C15.4713 23.5967 13.1157 21.2411 13.1157 18.3575V5.2392Z"
        fill="#E01E5A"
      />
    </g>
    <g transform="translate(26.28 26.28)">
      <path
        d="M5.23927 13.1157C8.12286 13.1157 10.4785 15.4713 10.4785 18.3549C10.4785 21.2385 8.12286 23.5941 5.23927 23.5941C2.35568 23.5941 7.4362e-05 21.2385 7.4362e-05 18.3549V13.1157H5.23927Z"
        fill="#ECB22E"
      />
      <path
        d="M5.23927 10.4784C2.35568 10.4784 7.4362e-05 8.12279 7.4362e-05 5.2392C7.4362e-05 2.35561 2.35568 0 5.23927 0H18.3576C21.2412 0 23.5968 2.35561 23.5968 5.2392C23.5968 8.12279 21.2412 10.4784 18.3576 10.4784H5.23927Z"
        fill="#ECB22E"
      />
    </g>
  </svg>
);

const ClickUpMark = () => (
  <svg viewBox="0 0 49.7096 59.6884" fill="none" aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M0 45.9002L9.1618 38.8247C14.0602 45.1745 19.2307 48.1679 24.9455 48.1679C30.6603 48.1679 35.7401 45.2652 40.3663 38.9154L49.7096 45.8094C42.997 54.8805 34.6516 59.6882 24.9455 59.6882C15.3301 59.6882 6.89403 54.8805 0 45.9002Z"
      fill="url(#ui-cc_r_5_-0)"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M24.9535 15.3301L8.62558 29.3903L1.09657 20.5914L25.0442 0L48.8105 20.5914L41.1908 29.2996L24.9535 15.3301Z"
      fill="url(#ui-cc_r_5_-1)"
    />
    <defs>
      <linearGradient id="ui-cc_r_5_-0" x1="0" y1="49.2666" x2="49.75" y2="49.2666" gradientUnits="userSpaceOnUse">
        <stop stopColor="#8930FD" />
        <stop offset="1" stopColor="#49CCF9" />
      </linearGradient>
      <linearGradient
        id="ui-cc_r_5_-1"
        x1="1.09231"
        y1="14.6901"
        x2="48.7603"
        y2="14.6901"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#FF02F0" />
        <stop offset="1" stopColor="#FFC800" />
      </linearGradient>
    </defs>
  </svg>
);

const ClaudeMark = () => (
  <svg viewBox="0 0 1200 1200" aria-hidden="true">
    <path
      fill="#D97757"
      d="M 233.959793 800.214905 L 468.644287 668.536987 L 472.590637 657.100647 L 468.644287 650.738403 L 457.208069 650.738403 L 417.986633 648.322144 L 283.892639 644.69812 L 167.597321 639.865845 L 54.926208 633.825623 L 26.577238 627.785339 L 3.3e-05 592.751709 L 2.73832 575.27533 L 26.577238 559.248352 L 60.724873 562.228149 L 136.187973 567.382629 L 249.422867 575.194763 L 331.570496 580.026978 L 453.261841 592.671082 L 472.590637 592.671082 L 475.328857 584.859009 L 468.724915 580.026978 L 463.570557 575.194763 L 346.389313 495.785217 L 219.543671 411.865906 L 153.100723 363.543762 L 117.181267 339.060425 L 99.060455 316.107361 L 91.248367 266.01355 L 123.865784 230.093994 L 167.677887 233.073853 L 178.872513 236.053772 L 223.248367 270.201477 L 318.040283 343.570496 L 441.825592 434.738342 L 459.946411 449.798706 L 467.194672 444.64447 L 468.080597 441.020203 L 459.946411 427.409485 L 392.617493 305.718323 L 320.778564 181.932983 L 288.80542 130.630859 L 280.348999 99.865845 C 277.369171 87.221436 275.194641 76.590698 275.194641 63.624268 L 312.322174 13.20813 L 332.8591 6.604126 L 382.389313 13.20813 L 403.248352 31.328979 L 434.013519 101.71814 L 483.865753 212.537048 L 561.181274 363.221497 L 583.812134 407.919434 L 595.892639 449.315491 L 600.40271 461.959839 L 608.214783 461.959839 L 608.214783 454.711609 L 614.577271 369.825623 L 626.335632 265.61084 L 637.771851 131.516846 L 641.718201 93.745117 L 660.402832 48.483276 L 697.530334 24.000122 L 726.52356 37.852417 L 750.362549 72 L 747.060486 94.067139 L 732.886047 186.201416 L 705.100708 330.52356 L 686.979919 427.167847 L 697.530334 427.167847 L 709.61084 415.087341 L 758.496704 350.174561 L 840.644348 247.490051 L 876.885925 206.738342 L 919.167847 161.71814 L 946.308838 140.29541 L 997.61084 140.29541 L 1035.38269 196.429626 L 1018.469849 254.416199 L 965.637634 321.422852 L 921.825562 378.201538 L 859.006714 462.765259 L 819.785278 530.41626 L 823.409424 535.812073 L 832.75177 534.92627 L 974.657776 504.724915 L 1051.328979 490.872559 L 1142.818848 475.167786 L 1184.214844 494.496582 L 1188.724854 514.147644 L 1172.456421 554.335693 L 1074.604126 578.496765 L 959.838989 601.449829 L 788.939636 641.879272 L 786.845764 643.409485 L 789.261841 646.389343 L 866.255127 653.637634 L 899.194702 655.409424 L 979.812134 655.409424 L 1129.932861 666.604187 L 1169.154419 692.537109 L 1192.671265 724.268677 L 1188.724854 748.429688 L 1128.322144 779.194641 L 1046.818848 759.865845 L 856.590759 714.604126 L 791.355774 698.335754 L 782.335693 698.335754 L 782.335693 703.731567 L 836.69812 756.885986 L 936.322205 846.845581 L 1061.073975 962.81897 L 1067.436279 991.490112 L 1051.409424 1014.120911 L 1034.496704 1011.704712 L 924.885986 929.234924 L 882.604126 892.107544 L 786.845764 811.48999 L 780.483276 811.48999 L 780.483276 819.946289 L 802.550415 852.241699 L 919.087341 1027.409424 L 925.127625 1081.127686 L 916.671204 1098.604126 L 886.469849 1109.154419 L 853.288696 1103.114136 L 785.073914 1007.355835 L 714.684631 899.516785 L 657.906067 802.872498 L 650.979858 806.81897 L 617.476624 1167.704834 L 601.771851 1186.147705 L 565.530212 1200 L 535.328857 1177.046997 L 519.302124 1139.919556 L 535.328857 1066.550537 L 554.657776 970.792053 L 570.362488 894.68457 L 584.536926 800.134277 L 592.993347 768.724976 L 592.429626 766.630859 L 585.503479 767.516968 L 514.22821 865.369263 L 405.825531 1011.865906 L 320.053711 1103.677979 L 299.516815 1111.812256 L 263.919525 1093.369263 L 267.221497 1060.429688 L 287.114136 1031.114136 L 405.825531 880.107361 L 477.422913 786.52356 L 523.651062 732.483276 L 523.328918 724.671265 L 520.590698 724.671265 L 205.288605 929.395935 L 149.154434 936.644409 L 124.993355 914.01355 L 127.973183 876.885986 L 139.409409 864.80542 L 234.201385 799.570435 L 233.879227 799.8927 Z"
    />
  </svg>
);

const OpenAiMark = () => (
  <svg viewBox="0 0 68.614 68.002" aria-hidden="true">
    <path
      fill="currentColor"
      d="M26.3166 24.7525V18.2923C26.3166 17.7482 26.5208 17.3401 26.9966 17.0684L39.9853 9.5882C41.7533 8.56821 43.8615 8.09244 46.0372 8.09244C54.1973 8.09244 59.3658 14.4167 59.3658 21.1486C59.3658 21.6245 59.3658 22.1686 59.2976 22.7127L45.8331 14.8243C45.0172 14.3486 44.2009 14.3486 43.385 14.8243L26.3166 24.7525ZM56.6454 49.9134V34.4766C56.6454 33.5244 56.2371 32.8444 55.4213 32.3685L38.3529 22.4403L43.9291 19.244C44.405 18.9723 44.8131 18.9723 45.289 19.244L58.2776 26.7242C62.018 28.9005 64.5338 33.5244 64.5338 38.0122C64.5338 43.1802 61.4739 47.9406 56.6454 49.9128V49.9134ZM22.3045 36.3131L16.7284 33.0492C16.2526 32.7775 16.0484 32.3692 16.0484 31.8251V16.8649C16.0484 9.58891 21.6245 4.08038 29.1729 4.08038C32.0293 4.08038 34.6809 5.03262 36.9255 6.7326L23.5292 14.485C22.7134 14.9608 22.3052 15.6408 22.3052 16.5932V36.3137L22.3045 36.3131ZM34.307 43.2491L26.3166 38.7611V29.2412L34.307 24.7532L42.2968 29.2412V38.7611L34.307 43.2491ZM39.4411 63.9219C36.5848 63.9219 33.9333 62.9697 31.6886 61.2699L45.0848 53.5173C45.9007 53.0415 46.3089 52.3615 46.3089 51.4091V31.6886L51.9533 34.9525C52.4291 35.2242 52.6333 35.6324 52.6333 36.1766V51.1369C52.6333 58.4128 46.9889 63.9214 39.4411 63.9214V63.9219ZM23.3245 48.7576L10.3358 41.2775C6.59541 39.1011 4.07967 34.4773 4.07967 29.9894C4.07967 24.7532 7.2078 20.0612 12.0356 18.0889V33.5933C12.0356 34.5455 12.4439 35.2255 13.2597 35.7014L30.2605 45.5613L24.6844 48.7576C24.2086 49.0293 23.8003 49.0293 23.3245 48.7576ZM22.5769 59.9099C14.8926 59.9099 9.24834 54.1297 9.24834 46.9895C9.24834 46.4454 9.31651 45.9013 9.38411 45.3572L22.7804 53.1097C23.5962 53.5856 24.4127 53.5856 25.2284 53.1097L42.2968 43.2498V49.71C42.2968 50.2541 42.0927 50.6622 41.6168 50.9339L28.6283 58.4141C26.8601 59.4341 24.752 59.9099 22.5762 59.9099H22.5769ZM39.4411 68.0017C47.6694 68.0017 54.5372 62.1538 56.1019 54.4013C63.718 52.4291 68.6141 45.2889 68.6141 38.0129C68.6141 33.2526 66.5743 28.6288 62.9021 25.2966C63.2421 23.8685 63.4462 22.4403 63.4462 21.0129C63.4462 11.2887 55.5578 4.01207 46.4454 4.01207C44.6098 4.01207 42.8416 4.28375 41.0735 4.89614C38.0129 1.90392 33.7968 0 29.1729 0C20.9447 0 14.0769 5.84782 12.5122 13.6003C4.89614 15.5725 0 22.7127 0 29.9887C0 34.749 2.03983 39.3728 5.71204 42.705C5.37205 44.1331 5.16797 45.5613 5.16797 46.9889C5.16797 56.713 13.0563 63.9895 22.1686 63.9895C24.0044 63.9895 25.7725 63.7179 27.5407 63.1055C30.6005 66.0977 34.8166 68.0017 39.4411 68.0017Z"
    />
  </svg>
);

export const defaultWorkspaceModels: WorkspaceModel[] = [
  {
    id: "auto",
    name: "Auto",
    description: "Picks the best model for each task",
  },
  {
    id: "claude",
    name: "Claude",
    description: "Thoughtful writing and code",
    logo: <ClaudeMark />,
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    description: "Quick answers for everyday tasks",
    logo: <OpenAiMark />,
  },
];

const css = /* css */ `
/* ui-chat-composer — composed into this item */
.ui-chat-composer{--ui-cc-tray: #eee6de;--ui-cc-card: #fffdfb;--ui-cc-line: #ded4ca;--ui-cc-ink: #1c1713;--ui-cc-ink-muted: #68584b;--ui-cc-ink-hover: #3d3226;--ui-cc-ink-faint: #96887a;--ui-cc-placeholder: #b4a89d;--ui-cc-ink-shine: rgba(255, 253, 251, 0.82);--ui-cc-alert: #b3261e;--ui-cc-alert-wash: rgba(179, 38, 30, 0.1);--ui-cc-on-ink: #fffdfb;--ui-cc-menu-fill: #f4ece5;--ui-cc-square-hover: #faf7f4;--ui-cc-shadow: rgba(11, 9, 8, 0.06);--ui-cc-focus: rgba(28, 23, 19, 0.22);--ui-cc-hover-filter: brightness(0.6);--ui-cc-load: 650ms;--ui-cc-swap: 620ms;--ui-cc-ease-swap: cubic-bezier(0.72, 0, 0.1, 1);--ui-cc-ease-out: cubic-bezier(0.22, 1, 0.36, 1);--ui-cc-ease-pop: cubic-bezier(0.34, 1.5, 0.64, 1);container-type: inline-size;position: relative;width: 100%;max-width: 680px}
.ui-chat-composer__body{--u: min(calc(100cqw / var(--ui-cc-span, 1900)), 0.27px);--ui-cc-frame: 20;--ui-cc-inset: calc(var(--ui-cc-frame) * var(--u));--ui-cc-card-h: calc(453.576 + var(--ui-cc-grow, 0));position: relative;height: calc((var(--ui-cc-card-h) + 169 + 2 * var(--ui-cc-frame)) * var(--u));transition: height var(--ui-cc-swap) var(--ui-cc-ease-swap);font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-weight: 400;font-synthesis: none;color: var(--ui-cc-ink-muted);-webkit-font-smoothing: antialiased;-moz-osx-font-smoothing: grayscale;-webkit-tap-highlight-color: transparent}
.ui-chat-composer__body button{appearance: none;margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;letter-spacing: inherit;text-align: left;cursor: pointer}
.ui-chat-composer__body svg{display: block;max-width: none}
.ui-chat-composer__tray{position: absolute;inset: 0;background: var(--ui-cc-tray);border-radius: calc(92.758 * var(--u))}
.ui-chat-composer__row{position: absolute;left: calc(84 * var(--u) + var(--ui-cc-inset));display: flex;align-items: center;white-space: nowrap}
.ui-chat-composer__project{top: calc(50.4 * var(--u) + var(--ui-cc-inset) / 2);left: calc(78.5 * var(--u) + var(--ui-cc-inset));height: calc(67 * var(--u));gap: calc(26.752 * var(--u))}
.ui-chat-composer__connect{top: calc((var(--ui-cc-card-h) + 50.4) * var(--u) + var(--ui-cc-inset) * 1.5);transition: top var(--ui-cc-swap) var(--ui-cc-ease-swap);height: calc(68.155 * var(--u));gap: calc(27.213 * var(--u));border-radius: calc(24 * var(--u))}
.ui-chat-composer__label{position: relative;display: block;font-size: calc(60.453 * var(--u));line-height: calc(60.453 * var(--u));letter-spacing: calc(-0.5634 * var(--u));transition: color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-chat-composer__project .ui-chat-composer__label{font-size: calc(59.428 * var(--u));line-height: calc(59.428 * var(--u));letter-spacing: calc(-0.5539 * var(--u))}
.ui-chat-composer__icon{position: relative;flex: none;width: calc(68.155 * var(--u));height: calc(68.155 * var(--u))}
.ui-chat-composer__icon--folder{width: calc(67 * var(--u));height: calc(67 * var(--u))}
.ui-chat-composer__icon--chevron{width: calc(52 * var(--u));height: calc(52 * var(--u))}
.ui-chat-composer__icon > svg, .ui-chat-composer__logo > svg{position: absolute;inset: 0;width: 100%;height: 100%}
.ui-chat-composer__icon > svg{color: var(--ui-cc-ink-muted)}
.ui-chat-composer__logos{display: flex;align-items: center;gap: calc(27.213 * var(--u));height: calc(59.688 * var(--u))}
.ui-chat-composer__logo{position: relative;flex: none}
.ui-chat-composer__logo--gmail{width: calc(56.411 * var(--u));height: calc(44.872 * var(--u))}
.ui-chat-composer__logo--slack{width: calc(49.883 * var(--u));height: calc(49.877 * var(--u))}
.ui-chat-composer__logo--clickup{width: calc(49.71 * var(--u));height: calc(59.688 * var(--u))}
.ui-chat-composer__card{position: absolute;left: var(--ui-cc-inset);top: var(--ui-cc-inset);box-sizing: border-box;width: calc(100% - 2 * var(--ui-cc-inset));height: calc(var(--ui-cc-card-h) * var(--u));background: var(--ui-cc-card);border: calc(4 * var(--u)) solid var(--ui-cc-line);border-radius: calc(66 * var(--u));box-shadow: 0 calc(3.092 * var(--u)) calc(6.184 * var(--u)) var(--ui-cc-shadow);overflow: clip;cursor: text;transition: transform var(--ui-cc-swap) var(--ui-cc-ease-swap), height var(--ui-cc-swap) var(--ui-cc-ease-swap)}
.ui-chat-composer__message{position: absolute;left: calc(66 * var(--u));right: calc(69 * var(--u));top: calc(83.2 * var(--u));box-sizing: border-box;height: calc((106.424 + var(--ui-cc-grow, 0)) * var(--u));transition: height var(--ui-cc-swap) var(--ui-cc-ease-swap);margin: 0;padding: 0;border: 0;outline: 0;background: transparent;resize: none;overflow-y: auto;scrollbar-width: none;font: inherit;font-size: calc(73.396 * var(--u));line-height: calc(106.424 * var(--u));letter-spacing: calc(-1.4679 * var(--u));color: var(--ui-cc-ink);caret-color: var(--ui-cc-ink)}
.ui-chat-composer__message:focus-visible{outline: none}
.ui-chat-composer__message::-webkit-scrollbar{display: none}
.ui-chat-composer__message::placeholder{color: var(--ui-cc-placeholder);opacity: 1}
.ui-chat-composer__toolbar{position: absolute;left: calc(95.2 * var(--u));top: calc((282.476 + var(--ui-cc-grow, 0)) * var(--u));height: calc(68.155 * var(--u));display: flex;align-items: center;gap: calc(46.678 * var(--u));transform-origin: 0 50%;transition: transform var(--ui-cc-swap) var(--ui-cc-ease-swap), top var(--ui-cc-swap) var(--ui-cc-ease-swap)}
.ui-chat-composer__toolbar--end{left: auto;right: calc(73 * var(--u));gap: calc(40 * var(--u));transform-origin: 100% 50%}
.ui-chat-composer__icon-btn, .ui-chat-composer__model{display: flex;align-items: center;border-radius: calc(24 * var(--u))}
.ui-chat-composer__model{gap: calc(10 * var(--u));white-space: nowrap}
.ui-chat-composer__icon-btn svg, .ui-chat-composer__model svg{transition: filter 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-chat-composer__send{position: relative;flex: none;display: grid;place-items: center;width: calc(112 * var(--u));height: calc(112 * var(--u));border-radius: 50%;background: var(--ui-cc-ink) !important;transition: opacity var(--nm-dur-2, 160ms) ease-out, transform var(--nm-dur-2, 160ms) var(--ui-cc-ease-out)}
.ui-chat-composer__send svg{width: calc(60 * var(--u));height: calc(60 * var(--u))}
.ui-chat-composer__send:disabled{opacity: 0.18;cursor: default}
.ui-chat-composer__send:not(:disabled):active{transform: scale(0.94)}
.ui-chat-composer__approval{position: relative;display: flex;align-items: center;gap: calc(21.783 * var(--u));border-radius: calc(33.156 * var(--u));white-space: nowrap;transition: padding var(--nm-dur-4, 380ms) var(--ui-cc-ease-out)}
.ui-chat-composer__wash{position: absolute;inset: 0;border-radius: inherit;background: var(--ui-cc-alert-wash);opacity: 0;transition: opacity var(--nm-dur-2, 160ms) ease-out}
.ui-chat-composer__approval .ui-chat-composer__icon > svg{transition: opacity var(--nm-dur-2, 160ms) ease-out, transform var(--nm-dur-4, 380ms) var(--ui-cc-ease-out), filter 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-chat-composer__hand{transform-origin: 50% 90%}
.ui-chat-composer__shield{opacity: 0;transform: scale(0.4)}
.ui-chat-composer__approval-text{position: relative;display: grid}
.ui-chat-composer__approval-text > span{grid-area: 1 / 1;font-size: calc(60.453 * var(--u));line-height: calc(60.453 * var(--u));letter-spacing: calc(-0.5634 * var(--u))}
.ui-chat-composer__request{transition: color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-2, 160ms) ease-out, filter var(--nm-dur-2, 160ms) ease-out}
.ui-chat-composer__granted{color: var(--ui-cc-alert);opacity: 0;filter: blur(8px);transition: opacity var(--nm-dur-2, 160ms) ease-out, filter var(--nm-dur-2, 160ms) ease-out}
.ui-chat-composer__shimmer{position: relative}
.ui-chat-composer__shimmer::after{content: attr(data-text);content: attr(data-text) / "";position: absolute;inset: 0;white-space: nowrap;color: transparent;background: linear-gradient(90deg, transparent 38%, var(--ui-cc-ink-shine) 50%, transparent 62%) 100% 0 / 300% 100% no-repeat;-webkit-background-clip: text;background-clip: text;opacity: 0;pointer-events: none}
.ui-chat-composer__body button:focus-visible{outline: 2px solid var(--ui-cc-focus);outline-offset: 3px}
.ui-chat-composer__body[data-apps="idle"] .ui-chat-composer__connect:hover .ui-chat-composer__label, .ui-chat-composer__body[data-approval="idle"] .ui-chat-composer__approval:hover .ui-chat-composer__request, .ui-chat-composer__body[data-apps="done"] .ui-chat-composer__project:hover .ui-chat-composer__label, .ui-chat-composer__model:hover .ui-chat-composer__label{color: var(--ui-cc-ink-hover)}
.ui-chat-composer__body[data-approval="idle"] .ui-chat-composer__approval:hover .ui-chat-composer__hand, .ui-chat-composer__icon-btn:hover svg, .ui-chat-composer__model:hover svg{filter: var(--ui-cc-hover-filter)}
.ui-chat-composer__body[data-apps="loading"] .ui-chat-composer__connect .ui-chat-composer__shimmer::after, .ui-chat-composer__body[data-approval="loading"] .ui-chat-composer__request::after{opacity: 1;animation: ui-chat-composer-sweep var(--ui-cc-load) linear 2 both}
.ui-chat-composer__body[data-apps="loading"] .ui-chat-composer__logo{animation: ui-chat-composer-hop var(--ui-cc-load) cubic-bezier(0.45, 0, 0.55, 1) 2}
.ui-chat-composer__body[data-apps="loading"] .ui-chat-composer__logo--slack{animation-delay: 90ms}
.ui-chat-composer__body[data-apps="loading"] .ui-chat-composer__logo--clickup{animation-delay: 180ms}
.ui-chat-composer__body[data-approval="loading"] .ui-chat-composer__hand{animation: ui-chat-composer-wave var(--ui-cc-load) ease-in-out 2}
@keyframes ui-chat-composer-sweep{from{background-position: 100% 0}
to{background-position: 0% 0}
}
@keyframes ui-chat-composer-hop{0%, 70%, 100%{transform: translateY(0)}
32%{transform: translateY(calc(-13 * var(--u)))}
}
@keyframes ui-chat-composer-wave{0%, 76%, 100%{transform: rotate(0deg)}
18%{transform: rotate(16deg)}
38%{transform: rotate(-10deg)}
58%{transform: rotate(7deg)}
}
.ui-chat-composer__connect{transition: opacity calc(var(--ui-cc-swap) * 0.55) ease-out calc(var(--ui-cc-swap) * 0.38), transform calc(var(--ui-cc-swap) * 0.75) var(--ui-cc-ease-out) calc(var(--ui-cc-swap) * 0.33)}
.ui-chat-composer__project{opacity: 0;transform: translateY(calc(-18 * var(--u)));transition: opacity calc(var(--ui-cc-swap) * 0.23) ease-out, transform calc(var(--ui-cc-swap) * 0.55) var(--ui-cc-ease-swap)}
.ui-chat-composer__body[data-apps="done"] .ui-chat-composer__connect{opacity: 0;transform: translateY(calc(18 * var(--u)));pointer-events: none;transition: opacity calc(var(--ui-cc-swap) / 3) ease-out, transform calc(var(--ui-cc-swap) * 2 / 3) var(--ui-cc-ease-swap)}
.ui-chat-composer__body[data-apps="done"] .ui-chat-composer__project{opacity: 1;transform: none;transition: opacity calc(var(--ui-cc-swap) / 2) ease-out calc(var(--ui-cc-swap) * 0.15), transform calc(var(--ui-cc-swap) * 0.8) var(--ui-cc-ease-out) calc(var(--ui-cc-swap) * 0.14)}
.ui-chat-composer__body[data-apps="done"] .ui-chat-composer__card{transform: translateY(calc(169 * var(--u)))}
.ui-chat-composer__body[data-approval="done"] .ui-chat-composer__approval{padding: calc(22.104 * var(--u));cursor: default}
.ui-chat-composer__body[data-approval="done"] .ui-chat-composer__wash{opacity: 1;transition: opacity var(--nm-dur-3, 240ms) ease-out}
.ui-chat-composer__body[data-approval="done"] .ui-chat-composer__hand{opacity: 0;transform: scale(0.4) rotate(-14deg)}
.ui-chat-composer__body[data-approval="done"] .ui-chat-composer__shield{opacity: 1;transform: none;transition: opacity var(--nm-dur-3, 240ms) ease-out 90ms, transform var(--nm-dur-5, 620ms) var(--ui-cc-ease-pop) 90ms}
.ui-chat-composer__body[data-approval="done"] .ui-chat-composer__request{opacity: 0;filter: blur(8px)}
.ui-chat-composer__body[data-approval="done"] .ui-chat-composer__granted{opacity: 1;filter: blur(0);transition: opacity var(--nm-dur-4, 380ms) ease-out 90ms, filter var(--nm-dur-4, 380ms) ease-out 90ms}
.ui-chat-composer__sr-only{position: absolute;width: 1px;height: 1px;margin: -1px;padding: 0;overflow: hidden;clip: rect(0 0 0 0);white-space: nowrap;border: 0}
@media (prefers-reduced-motion: reduce){.ui-chat-composer *, .ui-chat-composer *::after{transition-duration: 1ms !important;transition-delay: 0ms !important}
.ui-chat-composer__logo, .ui-chat-composer__hand{animation: none !important}
}
.ui-chat-composer__icon-btn, .ui-chat-composer__model{transition: transform 160ms var(--ui-cc-ease-out)}
.ui-chat-composer__body[data-apps="done"] .ui-chat-composer__project:active, .ui-chat-composer__icon-btn:active, .ui-chat-composer__model:active{transform: scale(0.96)}
.ui-chat-composer__model{overflow: clip}
.ui-chat-composer__model-face{display: inline-flex;align-items: center}
.ui-chat-composer__model-face[data-morph]{animation: ui-chat-composer-model-in var(--nm-dur-4, 380ms) cubic-bezier(0.25, 1, 0.5, 1) both}
.ui-chat-composer__model-face[data-morph] .ui-chat-composer__model-logo{animation: ui-chat-composer-logo-in var(--nm-dur-5, 620ms) cubic-bezier(0.25, 1, 0.5, 1) both}
@keyframes ui-chat-composer-model-in{from{opacity: 0;filter: blur(3px);transform: translateY(30%)}
}
@keyframes ui-chat-composer-logo-in{from{opacity: 0;transform: scale(0.6) rotate(-12deg)}
}
.ui-chat-composer__model-logo{display: grid;place-items: center;width: calc(50 * var(--u));height: calc(50 * var(--u));margin-right: calc(6 * var(--u));color: var(--ui-cc-ink)}
.ui-chat-composer__model-logo svg, .ui-chat-composer__option-logo svg{width: 100%;height: 100%}
.ui-chat-composer__model[aria-expanded="true"] .ui-chat-composer__label{color: var(--ui-cc-ink-hover)}
.ui-chat-composer__model[aria-expanded="true"] .ui-chat-composer__icon--chevron svg{transform: rotate(180deg)}
.ui-chat-composer__icon--chevron svg{transition: transform var(--nm-dur-3, 240ms) var(--ui-cc-ease-out), filter 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-chat-composer__menu{--morph: 420ms cubic-bezier(0.32, 0.72, 0, 1);position: absolute;z-index: 5;width: calc(1100 * var(--u));filter: drop-shadow(0 calc(24 * var(--u)) calc(48 * var(--u)) rgba(11, 9, 8, 0.08)) drop-shadow(0 calc(4 * var(--u)) calc(10 * var(--u)) rgba(11, 9, 8, 0.05));transition: visibility 0s linear 0s}
.ui-chat-composer__menu[data-open="false"]{visibility: hidden;pointer-events: none;transition: visibility 0s linear 300ms}
.ui-chat-composer__menu-panel{position: relative;box-sizing: border-box;padding: calc(20 * var(--u));display: flex;flex-direction: column;background: var(--ui-cc-card);border: calc(4 * var(--u)) solid var(--ui-cc-line);border-radius: calc(92.758 * var(--u));outline: none;font-family: inherit;clip-path: inset(0 0 0 0 round calc(92.758 * var(--u)));transition: clip-path var(--morph)}
.ui-chat-composer__menu[data-placing="true"] .ui-chat-composer__menu-panel{transition: none !important}
.ui-chat-composer__menu[data-open="false"] .ui-chat-composer__menu-panel{clip-path: inset(var(--from-top) 0 var(--from-bottom) var(--from-left) round var(--from-radius));transition: clip-path var(--nm-dur-3, 240ms) cubic-bezier(0.4, 0, 0.2, 1)}
.ui-chat-composer__menu-panel > *{transition: opacity var(--nm-dur-3, 240ms) ease-out 110ms, transform 380ms var(--ui-cc-ease-out) 60ms}
.ui-chat-composer__menu[data-open="false"] .ui-chat-composer__menu-panel > *{opacity: 0;transition: opacity var(--nm-dur-1, 90ms) ease-in}
.ui-chat-composer__menu[data-open="false"] .ui-chat-composer__option{transform: translateY(calc(12 * var(--u)))}
.ui-chat-composer__menu[data-open="false"][data-up="false"] .ui-chat-composer__option{transform: translateY(calc(-12 * var(--u)))}
.ui-chat-composer__menu-panel:focus-visible{outline: none}
.ui-chat-composer__menu-fill{position: absolute;left: calc(20 * var(--u));right: calc(20 * var(--u));top: 0;border-radius: calc(68.758 * var(--u));background: var(--ui-cc-menu-fill);pointer-events: none;transition: transform var(--nm-dur-2, 160ms) cubic-bezier(0.25, 1, 0.3, 1), height var(--nm-dur-2, 160ms) cubic-bezier(0.25, 1, 0.3, 1), opacity 160ms ease-out}
.ui-chat-composer__menu-fill[data-glide="false"]{transition: opacity 160ms ease-out}
.ui-chat-composer__option{position: relative;display: flex;align-items: center;gap: calc(34 * var(--u));padding: calc(32 * var(--u)) calc(48 * var(--u));border-radius: calc(68.758 * var(--u));cursor: pointer}
.ui-chat-composer__option-logo{display: grid;place-items: center;flex: none;width: calc(64 * var(--u));height: calc(64 * var(--u));color: var(--ui-cc-ink)}
.ui-chat-composer__option-text{display: flex;flex-direction: column;gap: calc(8 * var(--u));min-width: 0;flex: 1}
.ui-chat-composer__option-name{font-size: calc(58 * var(--u));line-height: 1.2;font-weight: 500;letter-spacing: calc(-0.5 * var(--u));color: var(--ui-cc-ink)}
.ui-chat-composer__option-desc{font-size: calc(44 * var(--u));line-height: 1.25;color: var(--ui-cc-ink-muted);white-space: nowrap;overflow: hidden;text-overflow: ellipsis}
.ui-chat-composer__option-check{flex: none;width: calc(56 * var(--u));height: calc(56 * var(--u));color: var(--ui-cc-ink);opacity: 0;transform: scale(0.6);transition: opacity 160ms ease-out, transform var(--nm-dur-3, 240ms) var(--ui-cc-ease-pop)}
.ui-chat-composer__option-check svg{width: 100%;height: 100%}
.ui-chat-composer__option[aria-selected="true"] .ui-chat-composer__option-check{opacity: 1;transform: none}
.ui-chat-composer__send svg{color: var(--ui-cc-on-ink)}
.ui-chat-composer__toolbar--end{transition: opacity var(--nm-dur-3, 240ms) ease-out, transform var(--nm-dur-4, 380ms) var(--ui-cc-ease-out)}
.ui-chat-composer__draft{position: absolute;left: calc(66 * var(--u));right: calc(69 * var(--u));top: calc(83.2 * var(--u));height: calc((106.424 + var(--ui-cc-grow, 0)) * var(--u));overflow: hidden;white-space: pre-wrap;overflow-wrap: break-word;font-size: calc(73.396 * var(--u));line-height: calc(106.424 * var(--u));letter-spacing: calc(-1.4679 * var(--u));color: var(--ui-cc-ink);pointer-events: none;visibility: hidden}
.ui-chat-composer__heard{color: var(--ui-cc-ink-faint)}
.ui-chat-composer__body[data-recording="true"] .ui-chat-composer__draft{visibility: visible}
.ui-chat-composer__body[data-recording="true"] .ui-chat-composer__message{color: transparent;caret-color: transparent}
.ui-chat-composer__body[data-recording="true"] .ui-chat-composer__message::placeholder{color: transparent}
.ui-chat-composer__trace{display: flex;align-items: center;gap: calc(14 * var(--u));height: calc(68 * var(--u));margin-right: calc(10 * var(--u))}
.ui-chat-composer__trace > span{flex: none;width: calc(8 * var(--u));border-radius: 999px;background: var(--ui-cc-ink-hover);transition: height var(--nm-dur-1, 90ms) ease-out}
.ui-chat-composer__square{flex: none;display: grid !important;place-items: center;box-sizing: border-box;width: calc(112 * var(--u));height: calc(112 * var(--u));border: calc(4 * var(--u)) solid var(--ui-cc-line) !important;border-radius: calc(32 * var(--u)) !important;background: var(--ui-cc-card) !important;box-shadow: 0 calc(3.092 * var(--u)) calc(6.184 * var(--u)) var(--ui-cc-shadow);color: var(--ui-cc-ink) !important;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 160ms var(--ui-cc-ease-out)}
.ui-chat-composer__square:hover{background: var(--ui-cc-square-hover) !important}
.ui-chat-composer__square:active{transform: scale(0.95)}
.ui-chat-composer__square svg{width: calc(56 * var(--u));height: calc(56 * var(--u));color: var(--ui-cc-ink)}
.ui-chat-composer__toolbar--voice{gap: calc(24 * var(--u));opacity: 0;transform: translateY(calc(16 * var(--u)));pointer-events: none}
.ui-chat-composer__body[data-recording="true"] .ui-chat-composer__toolbar--end:not(.ui-chat-composer__toolbar--voice){opacity: 0;transform: translateY(calc(-16 * var(--u)));pointer-events: none}
.ui-chat-composer__body[data-recording="true"] .ui-chat-composer__toolbar--voice{opacity: 1;transform: none;pointer-events: auto}
@media (prefers-reduced-motion: reduce){.ui-chat-composer__model-face[data-morph], .ui-chat-composer__model-face[data-morph] .ui-chat-composer__model-logo{animation: none}
}
.ui-chat-composer input:not([type="checkbox"]):not([type="radio"]):focus-visible, .ui-chat-composer textarea:focus-visible, .ui-chat-composer [contenteditable]:focus-visible{outline: none}
:where(.dark, [data-theme="dark"]) .ui-chat-composer{--ui-cc-tray: #1c1713;--ui-cc-card: #28211a;--ui-cc-line: rgba(255, 253, 251, 0.08);--ui-cc-ink: #ebe3da;--ui-cc-ink-muted: #857567;--ui-cc-ink-hover: #b4a89d;--ui-cc-ink-faint: #625244;--ui-cc-placeholder: #564738;--ui-cc-ink-shine: rgba(255, 253, 251, 0.95);--ui-cc-alert: #e2544a;--ui-cc-alert-wash: rgba(179, 38, 30, 0.16);--ui-cc-on-ink: #191411;--ui-cc-menu-fill: #33291f;--ui-cc-square-hover: #30271d;--ui-cc-shadow: rgba(11, 9, 8, 0.4);--ui-cc-focus: rgba(255, 253, 251, 0.3);--ui-cc-hover-filter: brightness(1.5)}
:where(.dark, [data-theme="dark"]) .ui-chat-composer__menu{filter: drop-shadow(0 calc(24 * var(--u)) calc(48 * var(--u)) rgba(11, 9, 8, 0.45)) drop-shadow(0 calc(4 * var(--u)) calc(10 * var(--u)) rgba(11, 9, 8, 0.35))}
.ui-aw{--ui-aw-side: #f4ece5;--ui-aw-card: #fffdfb;--ui-aw-line: #eae2d9;--ui-aw-ink: #1c1713;--ui-aw-text: #3d3226;--ui-aw-muted: #857567;--ui-aw-accent: #ff6b35;--ui-aw-ease: cubic-bezier(0.22, 1, 0.36, 1);position: relative;box-sizing: border-box;display: grid;grid-template-columns: 240px minmax(0, 1fr);width: 100%;height: 640px;padding: 8px 8px 8px 0;overflow: hidden;container-type: inline-size;background: var(--ui-aw-side);border-radius: 20px;box-shadow: 0 0 0 1px #e3dad1;font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;color: var(--ui-aw-ink);-webkit-font-smoothing: antialiased;transition: grid-template-columns 380ms var(--ui-aw-ease), padding 380ms var(--ui-aw-ease)}
.ui-aw[data-collapsed]{grid-template-columns: 0px minmax(0, 1fr);padding-left: 8px}
.ui-aw *, .ui-aw *::before, .ui-aw *::after{box-sizing: border-box}
.ui-aw button{margin: 0;font: inherit;color: inherit;cursor: pointer}
.ui-aw button:focus-visible, .ui-aw input:focus-visible{outline: 2px solid var(--ui-aw-accent);outline-offset: 2px}
.ui-aw__ellipsis{overflow: hidden;white-space: nowrap;text-overflow: ellipsis;min-width: 0}
.ui-aw__muted{color: var(--ui-aw-muted)}
.ui-aw__side{display: flex;flex-direction: column;min-width: 0;padding: 6px 8px 4px;overflow: hidden;transition: opacity 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-aw[data-collapsed] .ui-aw__side{opacity: 0}
.ui-aw__side-head{display: flex;align-items: center;justify-content: space-between;height: 40px;padding: 0 2px 0 6px}
.ui-aw__ws{display: grid;place-items: center;width: 28px;height: 28px;border-radius: 8px;background: linear-gradient(#342a20, #241e19);box-shadow: 0 0 0 1px #14100d, inset 0 1px 0 rgba(255, 253, 251, 0.14);font-size: 13px;font-weight: 600;color: #fffdfb}
.ui-aw__icon{display: grid;place-items: center;flex: none;width: 28px;height: 28px;padding: 0;border: 0;border-radius: 8px;background: transparent;color: var(--ui-aw-muted) !important;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-aw__icon:hover{background: rgba(11, 9, 8, 0.05);color: var(--ui-aw-ink) !important}
.ui-aw__search{display: flex;align-items: center;gap: 8px;height: 34px;margin: 6px 0 8px;padding: 0 10px;border-radius: 10px;background: #e8e0d8;color: var(--ui-aw-muted);transition: box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-aw__search:focus-within{background: #fffdfb;box-shadow: 0 0 0 1px var(--ui-aw-accent), 0 0 0 3px rgba(255, 107, 53, 0.12)}
.ui-aw__search input{flex: 1;min-width: 0;border: 0;outline: none;background: transparent;font: inherit;font-size: 13.5px;color: var(--ui-aw-ink)}
.ui-aw__search input:focus-visible{outline: none}
.ui-aw__search input::-webkit-search-cancel-button{display: none}
.ui-aw__nav{display: grid;gap: 1px}
.ui-aw__item{display: flex;align-items: center;gap: 10px;height: 32px;padding: 0 10px;border: 0;border-radius: 9px;background: transparent;font-size: 13.5px !important;text-align: left;color: var(--ui-aw-text) !important;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-aw__item svg{flex: none;color: var(--ui-aw-muted)}
.ui-aw__item:hover{background: rgba(11, 9, 8, 0.04);color: var(--ui-aw-ink) !important}
.ui-aw__item[aria-current]{background: #e5ddd3;color: var(--ui-aw-ink) !important;font-weight: 500}
.ui-aw__item--plain{padding-left: 10px}
.ui-aw__group{margin: 16px 10px 4px;font-size: 12px;color: var(--ui-aw-muted)}
.ui-aw__recents{overflow-y: auto;min-height: 0;flex: 1;align-content: start;scrollbar-width: none}
.ui-aw__none{margin: 4px 10px;font-size: 12.5px;color: var(--ui-aw-muted)}
.ui-aw__none--center{text-align: center;margin-top: 24px}
.ui-aw__user{display: flex;align-items: center;gap: 10px;height: 44px;padding: 0 2px 0 8px;font-size: 13.5px}
.ui-aw__user img, .ui-aw__user-dot{width: 24px;height: 24px;border-radius: 50%;object-fit: cover}
.ui-aw__user-dot{display: grid;place-items: center;background: #f6f0e9;font-size: 11px;font-weight: 600;color: var(--ui-aw-accent)}
.ui-aw__user span:not(.ui-aw__user-dot){flex: 1}
.ui-aw__main{position: relative;display: flex;flex-direction: column;min-width: 0;min-height: 0;overflow: hidden;background: var(--ui-aw-card);border: 1px solid #ded4ca;border-radius: 16px;box-shadow: 0 1px 2px rgba(11, 9, 8, 0.05)}
.ui-aw__bar{display: flex;align-items: center;gap: 8px;height: 48px;padding: 0 10px 0 12px;border-bottom: 1px solid var(--ui-aw-line)}
.ui-aw__crumbs, .ui-aw__more, .ui-aw__sort, .ui-aw__card-menu{position: relative}
.ui-aw__crumbs{min-width: 0}
.ui-aw__crumb-btn{display: flex;align-items: center;gap: 6px;max-width: 100%;height: 30px;padding: 0 8px;border: 0;border-radius: 8px;background: transparent;font-size: 14px !important;font-weight: 500}
.ui-aw__crumb-btn:hover{background: #f4ece5}
.ui-aw__crumb-btn svg{flex: none;color: var(--ui-aw-muted)}
.ui-aw__slash{color: #b4a89d;font-weight: 400}
.ui-aw__crumb-btn > .ui-aw__muted{min-width: 0;overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-aw__more{margin-left: auto}
.ui-aw__menu{position: absolute;top: calc(100% + 6px);left: 0;z-index: 20;display: grid;gap: 2px;min-width: 190px;padding: 5px;border-radius: 12px;background: #fffdfb;box-shadow: 0 0 0 1px #ded4ca, 0 12px 30px -8px rgba(11, 9, 8, 0.2);animation: ui-aw-drop var(--nm-dur-2, 160ms) var(--ui-aw-ease)}
.ui-aw__menu--right{left: auto;right: 0}
.ui-aw__menu-title{margin: 2px 8px 4px;font-size: 11.5px;color: var(--ui-aw-muted)}
.ui-aw__menu-item{display: flex;align-items: center;gap: 8px;min-height: 32px;padding: 0 10px;border: 0;border-radius: 8px;background: transparent;font-size: 13px !important;text-align: left;white-space: nowrap}
.ui-aw__menu-item:hover:not(:disabled){background: #f4ece5}
.ui-aw__menu-item:disabled{opacity: 0.4;cursor: default}
.ui-aw__menu-item svg:last-child:not(:first-child){margin-left: auto;color: var(--ui-aw-accent)}
.ui-aw__menu-item[aria-checked="true"]{color: var(--ui-aw-accent) !important;font-weight: 500}
.ui-aw__danger{color: #e2544a !important}
.ui-aw__welcome{display: flex;flex: 1;flex-direction: column;align-items: center;justify-content: center;padding: 24px;animation: ui-aw-in var(--nm-dur-4, 380ms) var(--ui-aw-ease)}
.ui-aw__hello{margin: 0;font-size: 28px;font-weight: 600;letter-spacing: -0.02em}
.ui-aw__sub{margin: 6px 0 0;font-size: 15px;color: var(--ui-aw-muted);text-align: center}
.ui-aw__sub--left{text-align: left;font-size: 14px}
.ui-aw__composer{width: min(640px, 100%);margin-top: 26px}
.ui-aw__composer .ui-chat-composer{--ui-cc-span: 3100;max-width: none}
.ui-aw__starters{display: flex;flex-wrap: wrap;justify-content: center;gap: 6px;max-width: 640px;margin-top: 14px}
.ui-aw__starter{height: 30px;padding: 0 12px;border: 0;border-radius: 999px;background: #fffdfb;box-shadow: 0 0 0 1px #e3dad1;font-size: 12.5px !important;color: var(--ui-aw-text) !important;max-width: 100%;overflow: hidden;white-space: nowrap;text-overflow: ellipsis;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-aw__starter:hover{background: #f7f1eb;box-shadow: 0 0 0 1px #d0c4ba}
.ui-aw__disclaimer{margin: 14px 0 0;font-size: 11.5px;text-align: center;color: #96887a}
.ui-aw__chat{display: flex;flex: 1;flex-direction: column;min-height: 0;animation: ui-aw-in var(--nm-dur-4, 380ms) var(--ui-aw-ease)}
.ui-aw__messages{display: grid;align-content: start;gap: 22px;flex: 1;min-height: 0;padding: 28px max(24px, calc((100% - 620px) / 2)) 16px;overflow-y: auto;scrollbar-width: thin}
.ui-aw__msg{animation: ui-aw-in var(--nm-dur-4, 380ms) var(--ui-aw-ease) both}
.ui-aw__msg p{margin: 0;white-space: pre-wrap;font-size: 14.5px;line-height: 23px}
.ui-aw__msg--user{justify-self: end;max-width: 78%;padding: 10px 14px;border-radius: 16px 16px 4px 16px;background: #f2eae2}
.ui-aw__msg--ai{display: flex;gap: 12px;color: var(--ui-aw-text)}
.ui-aw__mark{flex: none;width: 16px;height: 16px;margin-top: 3.5px;border-radius: 50%;background: radial-gradient(circle at 30% 26%, rgba(255, 253, 251, 0.85) 0, rgba(255, 253, 251, 0) 42%), linear-gradient(140deg, #ff8a5c 0%, #ff6b35 48%, #ff6b35 100%);background-size: 100% 100%, 200% 200%;background-position: 0 0, 0% 0%;box-shadow: inset 0 0 0 1px rgba(255, 253, 251, 0.25), 0 1px 3px rgba(255, 107, 53, 0.35)}
.ui-aw__mark--busy{animation: ui-aw-orb var(--nm-dur-6, 1100ms) ease-in-out infinite}
.ui-aw__ai-body{min-width: 0}
.ui-aw__thinking{background: linear-gradient(90deg, #96887a 0%, #96887a 35%, rgba(255, 253, 251, 0.9) 50%, #96887a 65%, #96887a 100%);background-size: 300% 100%;-webkit-background-clip: text;background-clip: text;-webkit-text-fill-color: transparent;animation: ui-aw-shine var(--nm-dur-6, 1100ms) linear infinite}
.ui-aw__actions{display: flex;gap: 2px;margin: 6px 0 0 -6px;opacity: 0.8}
.ui-aw__composer--dock{align-self: center;margin: 0;padding: 4px 0 14px}
.ui-aw__composer--dock .ui-aw__disclaimer{margin-top: 8px}
.ui-aw__projects{flex: 1;min-height: 0;padding: 28px max(24px, calc((100% - 640px) / 2)) 24px;overflow-y: auto;animation: ui-aw-in var(--nm-dur-4, 380ms) var(--ui-aw-ease);scrollbar-width: thin}
.ui-aw__projects-head{display: grid;grid-template-columns: auto 1fr auto;align-items: center;gap: 14px}
.ui-aw__tile{display: grid;place-items: center;width: 44px;height: 44px;border-radius: 12px;background: #fffdfb;box-shadow: 0 0 0 1px #ded4ca, 0 1px 2px rgba(11, 9, 8, 0.04)}
.ui-aw__title{margin: 0;font-size: 22px;font-weight: 600;letter-spacing: -0.02em}
.ui-aw__primary{display: inline-flex;align-items: center;gap: 7px;height: 34px;padding: 0 14px;border: 0;border-radius: 10px;background: linear-gradient(#342a20, #241e19);box-shadow: 0 0 0 1px #14100d, 0 2px 4px rgba(11, 9, 8, 0.1), inset 0 1px 0 rgba(255, 253, 251, 0.12);font-size: 13px !important;font-weight: 500;white-space: nowrap;color: #fffdfb !important}
.ui-aw__primary:hover:not(:disabled){background: linear-gradient(#3b3025, #28211a)}
.ui-aw__primary:disabled{opacity: 0.45;cursor: default}
.ui-aw__search--wide{margin: 22px 0 16px;height: 38px;background: #f4ece5}
.ui-aw__list-head{display: flex;align-items: center;justify-content: space-between;margin-bottom: 10px;font-size: 13.5px;font-weight: 500}
.ui-aw__sort-btn{display: inline-flex;align-items: center;gap: 4px;height: 28px;padding: 0 6px;border: 0;border-radius: 8px;background: transparent;font-size: 13px !important;color: var(--ui-aw-muted) !important}
.ui-aw__sort-btn strong{font-weight: 500;color: var(--ui-aw-ink)}
.ui-aw__sort-btn:hover{background: #f4ece5}
.ui-aw__grid{display: grid;grid-template-columns: repeat(2, minmax(0, 1fr));gap: 12px;margin: 0;padding: 0;list-style: none}
.ui-aw__project{border-radius: 16px;background: var(--ui-aw-side);animation: ui-aw-in var(--nm-dur-4, 380ms) var(--ui-aw-ease) both}
.ui-aw__project-card{padding: 14px 14px 14px 16px;border-radius: 16px;background: #fffdfb;box-shadow: 0 0 0 1px #ded4ca, 0 1px 2px rgba(11, 9, 8, 0.04)}
.ui-aw__project-top{display: flex;align-items: center;gap: 10px;min-height: 28px}
.ui-aw__project-top > svg{flex: none;color: var(--ui-aw-text)}
.ui-aw__project-name{flex: 1;min-width: 0;overflow: hidden;font-size: 14.5px;font-weight: 500;white-space: nowrap;text-overflow: ellipsis}
.ui-aw__pinned{display: grid;color: var(--ui-aw-accent)}
.ui-aw__dots{opacity: 0}
.ui-aw__project:hover .ui-aw__dots, .ui-aw__dots[aria-expanded="true"], .ui-aw__dots:focus-visible{opacity: 1}
.ui-aw__rename{flex: 1;min-width: 0;height: 28px;padding: 0 8px;border: 0;border-radius: 7px;outline: none;background: #f4ece5;box-shadow: 0 0 0 1px var(--ui-aw-accent);font: inherit;font-size: 14px}
.ui-aw__project-desc{margin: 4px 0 0 26px;font-size: 13px;line-height: 19px;color: var(--ui-aw-muted)}
.ui-aw__project-foot{margin: 0;padding: 9px 16px 10px;font-size: 12px;color: var(--ui-aw-muted)}
.ui-aw__backdrop{position: absolute;inset: 0;z-index: 30;background: rgba(28, 23, 19, 0.12);opacity: 0;pointer-events: none;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-aw__backdrop[data-open]{opacity: 1;pointer-events: auto}
.ui-aw__dialog{position: absolute;top: 50%;left: 50%;z-index: 31;width: min(380px, calc(100% - 32px));border-radius: 20px;background: var(--ui-aw-side);box-shadow: 0 0 0 1px #ded4ca, 0 24px 60px -16px rgba(11, 9, 8, 0.3);opacity: 0;pointer-events: none;transform: translate(-50%, -46%) scale(0.98);transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-4, 380ms) var(--ui-aw-ease)}
.ui-aw__dialog[data-open]{opacity: 1;pointer-events: auto;transform: translate(-50%, -50%)}
.ui-aw__dialog-card{padding: 18px;border-radius: 20px;background: #fffdfb;box-shadow: 0 0 0 1px #ded4ca}
.ui-aw__dialog-title{margin: 0 0 14px;font-size: 16px;font-weight: 600}
.ui-aw__field{width: 100%;height: 40px;padding: 0 12px;border: 0;border-radius: 11px;outline: none;background: #fffdfb;box-shadow: 0 0 0 1px #d8cdc4;font: inherit;font-size: 14px}
.ui-aw__field:focus{box-shadow: 0 0 0 1px var(--ui-aw-accent), 0 0 0 4px rgba(255, 107, 53, 0.12)}
.ui-aw__dialog-foot{display: flex;justify-content: flex-end;gap: 6px;padding: 10px}
.ui-aw__btn{height: 34px;padding: 0 14px;border: 0;border-radius: 10px;background: #fffdfb;box-shadow: 0 0 0 1px #ded4ca;font-size: 13px !important;font-weight: 500}
.ui-aw__btn:hover{background: #f7f1eb}
@container (max-width: 720px){.ui-aw{grid-template-columns: 0px minmax(0, 1fr);padding-left: 8px}
.ui-aw:not([data-collapsed]) .ui-aw__side{position: absolute;inset: 8px auto 8px 8px;z-index: 25;width: 240px;border-radius: 14px;background: var(--ui-aw-side);box-shadow: 0 0 0 1px #ded4ca, 0 16px 40px -12px rgba(11, 9, 8, 0.25)}
.ui-aw__grid{grid-template-columns: minmax(0, 1fr)}
.ui-aw__projects-head{grid-template-columns: auto 1fr}
.ui-aw__projects-head .ui-aw__primary{grid-column: 1 / -1;justify-self: start}
}
@container (max-width: 560px){.ui-aw__composer .ui-chat-composer{--ui-cc-span: 1500}
.ui-aw__welcome{padding: 24px 16px}
}
@keyframes ui-aw-in{from{opacity: 0;transform: translateY(4px)}
}
@keyframes ui-aw-drop{from{opacity: 0;transform: translateY(-4px) scale(0.98)}
}
@keyframes ui-aw-orb{0%, 100%{background-position: 0 0, 0% 0%;transform: scale(1)}
50%{background-position: 0 0, 100% 100%;transform: scale(0.82)}
}
@keyframes ui-aw-shine{from{background-position: 100% 0}
to{background-position: 0% 0}
}
@media (prefers-reduced-motion: reduce){.ui-aw, .ui-aw__side, .ui-aw__dialog, .ui-aw__backdrop{transition: none}
.ui-aw__welcome, .ui-aw__chat, .ui-aw__projects, .ui-aw__msg, .ui-aw__project, .ui-aw__menu, .ui-aw__mark--busy, .ui-aw__thinking{animation: none}
}
.ui-aw input:not([type="checkbox"]):not([type="radio"]):focus-visible, .ui-aw textarea:focus-visible, .ui-aw [contenteditable]:focus-visible{outline: none}
:where(.dark, [data-theme="dark"]) .ui-aw{--ui-aw-side: #1c1713;--ui-aw-card: #27201a;--ui-aw-line: rgba(255, 253, 251, 0.08);--ui-aw-ink: #ebe3da;--ui-aw-text: #b4a89d;--ui-aw-muted: #857567;box-shadow: 0 0 0 1px rgba(255, 253, 251, 0.08)}
:where(.dark, [data-theme="dark"]) .ui-aw__ws, :where(.dark, [data-theme="dark"]) .ui-aw__primary{background: linear-gradient(#f4ece4, #dfd5cc);box-shadow: 0 0 0 1px rgba(11, 9, 8, 0.6), inset 0 1px 0 #fffdfb;color: #191411 !important}
:where(.dark, [data-theme="dark"]) .ui-aw__primary{box-shadow: 0 0 0 1px rgba(11, 9, 8, 0.6), 0 2px 4px rgba(11, 9, 8, 0.35), inset 0 1px 0 #fffdfb}
:where(.dark, [data-theme="dark"]) .ui-aw__primary:hover:not(:disabled){background: linear-gradient(#fffdfb, #ebe3db)}
:where(.dark, [data-theme="dark"]) .ui-aw__icon:hover, :where(.dark, [data-theme="dark"]) .ui-aw__item:hover{background: rgba(255, 253, 251, 0.06)}
:where(.dark, [data-theme="dark"]) .ui-aw__search{background: #27201a}
:where(.dark, [data-theme="dark"]) .ui-aw__search--wide{background: #2b231b}
:where(.dark, [data-theme="dark"]) .ui-aw__search:focus-within{background: #2b231b;box-shadow: 0 0 0 1px var(--ui-aw-accent), 0 0 0 3px rgba(255, 107, 53, 0.24)}
:where(.dark, [data-theme="dark"]) .ui-aw__item[aria-current]{background: #2b231b}
:where(.dark, [data-theme="dark"]) .ui-aw__user-dot{background: rgba(255, 107, 53, 0.16);color: #ff8a5c}
:where(.dark, [data-theme="dark"]) .ui-aw__main{border-color: rgba(255, 253, 251, 0.08);box-shadow: 0 1px 2px rgba(11, 9, 8, 0.4)}
:where(.dark, [data-theme="dark"]) .ui-aw__crumb-btn:hover, :where(.dark, [data-theme="dark"]) .ui-aw__sort-btn:hover{background: rgba(255, 253, 251, 0.06)}
:where(.dark, [data-theme="dark"]) .ui-aw__slash{color: #625244}
:where(.dark, [data-theme="dark"]) .ui-aw__menu{background: #2b231b;box-shadow: 0 0 0 1px rgba(255, 253, 251, 0.1), 0 12px 30px -8px rgba(11, 9, 8, 0.5)}
:where(.dark, [data-theme="dark"]) .ui-aw__menu-item:hover:not(:disabled){background: rgba(255, 253, 251, 0.06)}
:where(.dark, [data-theme="dark"]) .ui-aw__menu-item svg:last-child:not(:first-child), :where(.dark, [data-theme="dark"]) .ui-aw__menu-item[aria-checked="true"], :where(.dark, [data-theme="dark"]) .ui-aw__pinned{color: #ff8a5c !important}
:where(.dark, [data-theme="dark"]) .ui-aw__danger{color: #e2544a !important}
:where(.dark, [data-theme="dark"]) .ui-aw__starter{background: #27201a;box-shadow: 0 0 0 1px rgba(255, 253, 251, 0.1)}
:where(.dark, [data-theme="dark"]) .ui-aw__starter:hover{background: #2b231b;box-shadow: 0 0 0 1px rgba(255, 253, 251, 0.16)}
:where(.dark, [data-theme="dark"]) .ui-aw__disclaimer{color: #625244}
:where(.dark, [data-theme="dark"]) .ui-aw__msg--user{background: #2b231b}
:where(.dark, [data-theme="dark"]) .ui-aw__thinking{background-image: linear-gradient(90deg, #625244 0%, #625244 35%, #ebe3da 50%, #625244 65%, #625244 100%)}
:where(.dark, [data-theme="dark"]) .ui-aw__tile, :where(.dark, [data-theme="dark"]) .ui-aw__project-card{background: #27201a;box-shadow: 0 0 0 1px rgba(255, 253, 251, 0.08), 0 1px 2px rgba(11, 9, 8, 0.4)}
:where(.dark, [data-theme="dark"]) .ui-aw__rename{background: #2b231b;color: var(--ui-aw-ink)}
:where(.dark, [data-theme="dark"]) .ui-aw__backdrop{background: rgba(11, 9, 8, 0.45)}
:where(.dark, [data-theme="dark"]) .ui-aw__dialog{box-shadow: 0 0 0 1px rgba(255, 253, 251, 0.08), 0 24px 60px -16px rgba(11, 9, 8, 0.6)}
:where(.dark, [data-theme="dark"]) .ui-aw__dialog-card{background: #27201a;box-shadow: 0 0 0 1px rgba(255, 253, 251, 0.08)}
:where(.dark, [data-theme="dark"]) .ui-aw__field{background: #2b231b;box-shadow: 0 0 0 1px rgba(255, 253, 251, 0.1);color: var(--ui-aw-ink)}
:where(.dark, [data-theme="dark"]) .ui-aw__field::placeholder{color: #857567}
:where(.dark, [data-theme="dark"]) .ui-aw__field:focus{box-shadow: 0 0 0 1px var(--ui-aw-accent), 0 0 0 4px rgba(255, 107, 53, 0.24)}
:where(.dark, [data-theme="dark"]) .ui-aw__btn{background: #2b231b;box-shadow: 0 0 0 1px rgba(255, 253, 251, 0.1)}
:where(.dark, [data-theme="dark"]) .ui-aw__btn:hover{background: #33291f}
@container (max-width: 720px){:where(.dark, [data-theme="dark"]) .ui-aw:not([data-collapsed]) .ui-aw__side{box-shadow: 0 0 0 1px rgba(255, 253, 251, 0.08), 0 16px 40px -12px rgba(11, 9, 8, 0.6)}
}

`;
