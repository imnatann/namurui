"use client";

import { useEffect, useId, useRef, useState } from "react";

/*
 * Tool Registry – the catalogue of tools an agent may call, with signatures, risk and enablement.
 *
 * One schema is open at a time: the open row is the single ember mark on the surface, and its
 * parameter table unfolds through a 0fr → 1fr grid row rather than an animated height. Search
 * cross-fades the old grouping out while the filtered one fades in, and every enable toggle
 * springs its thumb across the track and ticks the namespace count.
 */

export type ToolRisk = "low" | "medium" | "high";

export type ToolParameter = {
  /** Parameter name as the agent sees it */
  name: string;
  /** Type expression, e.g. `"string"`, `"string[]"`, `"\"append\" | \"replace\""` */
  type: string;
  /** Required parameters are marked in the schema table */
  required?: boolean;
  /** One line on what the parameter accepts */
  description: string;
};

export type RegisteredTool = {
  /** Stable id used by `enabled` and `referenced` */
  id: string;
  /** Callable name, e.g. `"read_file"` */
  name: string;
  /** One line on what the tool does */
  purpose: string;
  /** Namespace the tool is published under, e.g. `"workspace"` */
  source: string;
  /** How much a wrong call can cost: a read, a mutation, or an irreversible act */
  risk: ToolRisk;
  /** Return type shown at the end of the signature */
  returns?: string;
  /** Parameters in call order. Omit for a tool that takes none */
  parameters?: ToolParameter[];
};

export type ToolRegistryProps = {
  /** The tools attached to this agent */
  tools: RegisteredTool[];
  /** Ids the current agent has already called or planned to call */
  referenced?: string[];
  /** Controlled set of enabled ids. Omit to let the registry own the set */
  enabled?: string[];
  /** Initial set when the registry owns it. Defaults to every tool enabled */
  defaultEnabled?: string[];
  /** Called with the complete next set after any toggle */
  onEnabledChange?: (enabled: string[]) => void;
  /** Registry heading */
  title?: string;
  /** One line under the heading, e.g. the agent and run */
  subtitle?: string;
  className?: string;
};

type ToolGroup = {
  source: string;
  tools: RegisteredTool[];
};

export function ToolRegistry({
  tools,
  referenced = [],
  enabled,
  defaultEnabled,
  onEnabledChange,
  title = "Tool registry",
  subtitle,
  className,
}: ToolRegistryProps) {
  const uid = useId();
  const ghostRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [ghostQuery, setGhostQuery] = useState<string | null>(null);
  const [fadeKey, setFadeKey] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [innerEnabled, setInnerEnabled] = useState<string[]>(
    () => defaultEnabled ?? tools.map((tool) => tool.id),
  );

  const enabledIds = enabled ?? innerEnabled;
  const enabledSet = new Set(enabledIds);
  const referencedSet = new Set(referenced);
  const total = tools.length;
  const enabledCount = tools.filter((tool) => enabledSet.has(tool.id)).length;
  const ratio = total === 0 ? 0 : enabledCount / total;
  const sourceCount = new Set(tools.map((tool) => tool.source)).size;

  const trimmedQuery = query.trim().toLowerCase();
  const visible = tools.filter((tool) => matchesQuery(tool, trimmedQuery));
  const groups = groupTools(visible);
  const ghostGroups =
    ghostQuery === null
      ? []
      : groupTools(tools.filter((tool) => matchesQuery(tool, ghostQuery.trim().toLowerCase())));
  const missing = tools.filter(
    (tool) => referencedSet.has(tool.id) && !enabledSet.has(tool.id),
  );

  /* The cross-fade is a real overlay, so reduced motion skips it entirely. */
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReduced(media.matches);
      if (media.matches) setGhostQuery(null);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  /* The outgoing grouping removes itself when its fade finishes. */
  useEffect(() => {
    if (ghostQuery === null) return;
    const node = ghostRef.current;
    if (!node) return;
    const clear = (event: AnimationEvent) => {
      if (event.target === node) setGhostQuery(null);
    };
    node.addEventListener("animationend", clear);
    return () => node.removeEventListener("animationend", clear);
  }, [ghostQuery, fadeKey]);

  const commitEnabled = (next: string[]) => {
    if (enabled === undefined) setInnerEnabled(next);
    onEnabledChange?.(next);
  };

  const toggleTool = (tool: RegisteredTool) => {
    const on = enabledSet.has(tool.id);
    const next = on
      ? enabledIds.filter((id) => id !== tool.id)
      : [...enabledIds, tool.id];
    commitEnabled(next);
    const count = tools.filter((item) => next.includes(item.id)).length;
    setAnnouncement(
      `${tool.name} ${on ? "disabled" : "enabled"}. ${count} of ${total} tools enabled.`,
    );
  };

  const enableMissing = () => {
    const next = Array.from(new Set([...enabledIds, ...missing.map((tool) => tool.id)]));
    commitEnabled(next);
    setAnnouncement(
      `${missing.length} referenced ${missing.length === 1 ? "tool" : "tools"} enabled.`,
    );
  };

  const changeQuery = (next: string) => {
    if (next === query) return;
    setGhostQuery(query);
    setFadeKey((key) => key + 1);
    setQuery(next);
    const trimmed = next.trim();
    if (trimmed === "") {
      setAnnouncement(`All ${total} tools shown`);
      return;
    }
    const count = tools.filter((tool) =>
      matchesQuery(tool, trimmed.toLowerCase()),
    ).length;
    setAnnouncement(
      count === 0
        ? `No tools match ${trimmed}`
        : `${count} ${count === 1 ? "tool" : "tools"} match ${trimmed}`,
    );
  };

  const clearSearch = () => {
    changeQuery("");
    inputRef.current?.focus();
  };

  const toggleOpen = (id: string) => {
    setOpenId((current) => (current === id ? null : id));
  };

  const renderTool = (tool: RegisteredTool, pass: "live" | "ghost") => {
    const open = openId === tool.id;
    const on = enabledSet.has(tool.id);
    const isReferenced = referencedSet.has(tool.id);
    const panelId = `${uid}-${pass}-${tool.id}`;
    const params = tool.parameters ?? [];
    const signature = `${tool.name}(${params
      .map((param) => `${param.name}${param.required ? "" : "?"}: ${param.type}`)
      .join(", ")})${tool.returns ? ` → ${tool.returns}` : ""}`;

    return (
      <li
        key={`${pass}-${tool.id}`}
        className="ui-tlr__tool"
        data-open={open ? "" : undefined}
      >
        <div className="ui-tlr__row">
          <button
            type="button"
            className="ui-tlr__toggle"
            aria-expanded={open}
            aria-controls={panelId}
            tabIndex={pass === "ghost" ? -1 : undefined}
            onClick={() => toggleOpen(tool.id)}
          >
            <span className="ui-tlr__chev" aria-hidden="true">
              <ChevronMark />
            </span>
            <span className="ui-tlr__main">
              <span className="ui-tlr__name">
                <span className="ui-tlr__name-text">{tool.name}</span>
                {isReferenced ? (
                  <span className="ui-tlr__ref" data-warn={on ? undefined : ""}>
                    <RefMark />
                    referenced
                  </span>
                ) : null}
              </span>
              <span className="ui-tlr__purpose">{tool.purpose}</span>
            </span>
            <span className="ui-tlr__risk" data-risk={tool.risk}>
              <RiskMark level={tool.risk} />
              <span>{RISK_LABEL[tool.risk]}</span>
            </span>
          </button>
          <button
            type="button"
            className="ui-tlr__switch"
            role="switch"
            aria-checked={on}
            aria-label={`${tool.name} tool`}
            tabIndex={pass === "ghost" ? -1 : undefined}
            onClick={() => toggleTool(tool)}
          >
            <span className="ui-tlr__switch-track">
              <span className="ui-tlr__switch-thumb" />
            </span>
          </button>
        </div>
        <div
          className="ui-tlr__schema"
          id={panelId}
          aria-hidden={open ? undefined : true}
        >
          <div className="ui-tlr__schema-clip">
            <div className="ui-tlr__schema-body">
              <code className="ui-tlr__sig">{signature}</code>
              {params.length === 0 ? (
                <p className="ui-tlr__noargs">Takes no parameters.</p>
              ) : (
                <div className="ui-tlr__params">
                  <div className="ui-tlr__phead" aria-hidden="true">
                    <span>Parameter</span>
                    <span>Type</span>
                    <span>Required</span>
                    <span>Notes</span>
                  </div>
                  {params.map((param) => (
                    <div className="ui-tlr__param" key={param.name}>
                      <code className="ui-tlr__pname">{param.name}</code>
                      <code className="ui-tlr__ptype">{param.type}</code>
                      <span
                        className="ui-tlr__pflag"
                        data-req={param.required ? "" : undefined}
                      >
                        <FlagMark filled={Boolean(param.required)} />
                        {param.required ? "required" : "optional"}
                      </span>
                      <span className="ui-tlr__pdesc">{param.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </li>
    );
  };

  const renderGroups = (list: ToolGroup[], pass: "live" | "ghost") =>
    list.map((group) => {
      const groupEnabled = group.tools.filter((tool) => enabledSet.has(tool.id)).length;
      const slug = group.source.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const headingId = `${uid}-${pass}-${slug}`;
      return (
        <section
          className="ui-tlr__group"
          key={`${pass}-${group.source}`}
          aria-labelledby={headingId}
        >
          <div className="ui-tlr__ghead">
            <h4 className="ui-tlr__gname" id={headingId}>
              <ScopeMark />
              <span>{group.source}</span>
            </h4>
            <span className="ui-tlr__gcount">
              <b key={groupEnabled} aria-hidden="true">
                {groupEnabled}
              </b>
              <span aria-hidden="true"> / {group.tools.length}</span>
              <span className="ui-tlr__sr">
                {groupEnabled} of {group.tools.length} enabled
              </span>
            </span>
          </div>
          <ul className="ui-tlr__tools">
            {group.tools.map((tool) => renderTool(tool, pass))}
          </ul>
        </section>
      );
    });

  return (
    <div className={["ui-tlr", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-tool-registry" precedence="default">
        {css}
      </style>

      <header className="ui-tlr__head">
        <div className="ui-tlr__ident">
          <span className="ui-tlr__eyebrow">
            <ScopeMark />
            {sourceCount} {sourceCount === 1 ? "namespace" : "namespaces"} · {total}{" "}
            {total === 1 ? "tool" : "tools"}
          </span>
          <h3 className="ui-tlr__title">{title}</h3>
          {subtitle ? <p className="ui-tlr__sub">{subtitle}</p> : null}
        </div>
        <div className="ui-tlr__tally">
          <span className="ui-tlr__tally-num" aria-hidden="true">
            <b key={enabledCount}>{enabledCount}</b>
            <span> / {total}</span>
          </span>
          <span className="ui-tlr__tally-label" aria-hidden="true">
            enabled
          </span>
          <span className="ui-tlr__meter" aria-hidden="true">
            <span style={{ transform: `scaleX(${ratio})` }} />
          </span>
          <span className="ui-tlr__sr">
            {enabledCount} of {total} tools enabled
          </span>
        </div>
      </header>

      <div className="ui-tlr__search">
        <SearchMark />
        <input
          className="ui-tlr__input"
          ref={inputRef}
          type="search"
          value={query}
          placeholder="Search tools, namespaces, parameters"
          aria-label="Search tools"
          onChange={(event) => changeQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query !== "") {
              event.preventDefault();
              clearSearch();
            }
          }}
        />
        {query ? (
          <button
            type="button"
            className="ui-tlr__clear"
            aria-label="Clear search"
            onClick={clearSearch}
          >
            <CloseMark />
          </button>
        ) : null}
      </div>

      {missing.length > 0 ? (
        <div className="ui-tlr__warn">
          <span className="ui-tlr__warn-icon" aria-hidden="true">
            <RefMark />
          </span>
          <span className="ui-tlr__warn-copy" role="status">
            <span className="ui-tlr__warn-title">
              {missing.length === 1
                ? "1 referenced tool is disabled"
                : `${missing.length} referenced tools are disabled`}
            </span>
            <span className="ui-tlr__warn-names">
              {missing.map((tool, index) => (
                <span key={tool.id}>
                  {index > 0 ? ", " : ""}
                  <code>{tool.name}</code>
                </span>
              ))}
            </span>
          </span>
          <button
            type="button"
            className="ui-tlr__warn-btn"
            onClick={enableMissing}
          >
            Enable {missing.length === 1 ? "it" : "all"}
          </button>
        </div>
      ) : null}

      <div className="ui-tlr__stage">
        {ghostQuery !== null && !reduced ? (
          <div
            key={fadeKey}
            ref={ghostRef}
            className="ui-tlr__ghost"
            aria-hidden="true"
            inert
          >
            {renderGroups(ghostGroups, "ghost")}
          </div>
        ) : null}
        <div className="ui-tlr__list" key={fadeKey}>
          {groups.length === 0 ? (
            <div className="ui-tlr__empty">
              <span className="ui-tlr__empty-mark" aria-hidden="true">
                {trimmedQuery === "" ? <ScopeMark /> : <NoMatchMark />}
              </span>
              <p className="ui-tlr__empty-title">
                {trimmedQuery === ""
                  ? "No tools are registered"
                  : `No tools match “${query.trim()}”`}
              </p>
              <p className="ui-tlr__empty-sub">
                {trimmedQuery === ""
                  ? "Attach a tool to this agent and it will appear here."
                  : "Try a tool name, a namespace, or a parameter."}
              </p>
              {trimmedQuery === "" ? null : (
                <button
                  type="button"
                  className="ui-tlr__empty-btn"
                  onClick={clearSearch}
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            renderGroups(groups, "live")
          )}
        </div>
      </div>

      <span className="ui-tlr__sr" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}

const RISK_LABEL: Record<ToolRisk, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

function matchesQuery(tool: RegisteredTool, query: string): boolean {
  if (query === "") return true;
  const haystack = `${tool.name} ${tool.purpose} ${tool.source} ${(tool.parameters ?? [])
    .map((param) => param.name)
    .join(" ")}`.toLowerCase();
  return haystack.includes(query);
}

function groupTools(tools: RegisteredTool[]): ToolGroup[] {
  const groups: ToolGroup[] = [];
  for (const tool of tools) {
    const group = groups.find((item) => item.source === tool.source);
    if (group) group.tools.push(tool);
    else groups.push({ source: tool.source, tools: [tool] });
  }
  return groups.sort((a, b) => a.source.localeCompare(b.source));
}

const ScopeMark = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
    <path
      d="M4.4 2.4H2.6v7.2h1.8M7.6 2.4h1.8v7.2H7.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronMark = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
    <path
      d="M4.4 2.6 7.8 6l-3.4 3.4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SearchMark = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <circle cx="6.2" cy="6.2" r="4" fill="none" stroke="currentColor" strokeWidth="1.3" />
    <path
      d="m9.3 9.3 2.6 2.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
  </svg>
);

const CloseMark = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
    <path
      d="M3.4 3.4 8.6 8.6M8.6 3.4 3.4 8.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
  </svg>
);

/* A reference leaving its box: the agent pointed at a tool that is not enabled. */
const RefMark = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
    <path
      d="M6.8 2.2h3v3M9.8 2.2 6.1 5.9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5.2 3.1H3.1v5.8h5.8V6.8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const NoMatchMark = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <circle cx="7.8" cy="7.8" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <path
      d="m11.6 11.6 3.4 3.4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
    <path
      d="M5.8 7.8h4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
);

/* Risk reads as a three-step gauge, so the level survives without colour. */
const RiskMark = ({ level }: { level: ToolRisk }) => {
  const filled = level === "low" ? 1 : level === "medium" ? 2 : 3;
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
      {[0, 1, 2].map((index) => {
        const height = 3.2 + index * 2.6;
        return (
          <rect
            key={index}
            x={1.2 + index * 3.2}
            y={9.6 - height}
            width="2.2"
            height={height}
            rx="0.8"
            fill="currentColor"
            opacity={index < filled ? 1 : 0.2}
          />
        );
      })}
    </svg>
  );
};

const FlagMark = ({ filled }: { filled: boolean }) => (
  <svg width="7" height="7" viewBox="0 0 8 8" aria-hidden="true">
    <circle
      cx="4"
      cy="4"
      r="2.6"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth="1.1"
    />
  </svg>
);

const css = /* css */ `
/* Knobs live on the root: override them on .ui-tlr { … } to retheme the registry. */
.ui-tlr{
  --ui-tlr-panel: var(--panel, #1a1512);
  --ui-tlr-card: var(--card, #201a15);
  --ui-tlr-raised: var(--preview, #26201a);
  --ui-tlr-ink: var(--text, #f4ece4);
  --ui-tlr-muted: var(--text-muted, #a2958a);
  --ui-tlr-subtle: var(--text-subtle, #f4ece48c);
  --ui-tlr-line: var(--border, #33291f);
  --ui-tlr-line-soft: var(--border-soft, #ffffff12);
  --ui-tlr-accent: var(--accent, #ff6b35);
  --ui-tlr-accent-soft: var(--accent-soft, #ff6b3524);
  --ui-tlr-on: var(--primary, #f4ece4);
  --ui-tlr-on-fg: var(--primary-fg, #14100d);
  --ui-tlr-success: var(--success, #4f9d6e);
  --ui-tlr-warning: var(--warning, #d99530);
  --ui-tlr-danger: var(--danger, #e2544a);
  --ui-tlr-warn-bg: #d9953014;
  --ui-tlr-warn-line: #d9953036;
  --ui-tlr-wash: var(--border-soft, #ffffff12);
  --ui-tlr-radius: var(--radius-panel, 20px);
  --ui-tlr-radius-inner: var(--radius-preview, 12px);
  --ui-tlr-shadow: 0 1px 0 #0000002e, 0 18px 44px -26px #000000b3;
  --ui-tlr-ease: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-tlr-ease-in: var(--nm-ease-in, cubic-bezier(0.55, 0, 0.68, 0.19));
  --ui-tlr-ease-both: var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1));
  --ui-tlr-spring: var(--nm-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  --ui-tlr-dur: var(--nm-dur-2, 160ms);
  position: relative;
  display: block;
  container-type: inline-size;
  overflow: hidden;
  border-radius: var(--ui-tlr-radius);
  background: var(--ui-tlr-panel);
  box-shadow: var(--ui-tlr-shadow), inset 0 0 0 1px var(--ui-tlr-line-soft);
  color: var(--ui-tlr-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  line-height: 20px;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
}
.ui-tlr *,
.ui-tlr *::before,
.ui-tlr *::after{box-sizing: border-box}
.ui-tlr h3,
.ui-tlr h4,
.ui-tlr p{margin: 0}
.ui-tlr ul{margin: 0;padding: 0;list-style: none}
.ui-tlr svg{display: block;flex: none}
.ui-tlr code{font-family: var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace)}
.ui-tlr button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;text-align: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-tlr button:focus-visible{outline: 2px solid var(--ui-tlr-accent);outline-offset: 2px}
.ui-tlr__sr{position: absolute;width: 1px;height: 1px;overflow: hidden;clip-path: inset(50%);white-space: nowrap}

/* Header */
.ui-tlr__head{display: flex;align-items: flex-start;justify-content: space-between;gap: 16px;padding: 16px 16px 12px 18px}
.ui-tlr__ident{display: grid;gap: 2px;min-width: 0}
.ui-tlr__eyebrow{display: inline-flex;align-items: center;gap: 6px;font-size: 10px;font-weight: 500;line-height: 14px;letter-spacing: 0.06em;text-transform: uppercase;color: var(--ui-tlr-subtle);white-space: nowrap}
.ui-tlr__title{font-size: 15px;font-weight: 600;line-height: 21px;letter-spacing: -0.015em;color: var(--ui-tlr-ink)}
.ui-tlr__sub{overflow: hidden;font-size: 11.5px;line-height: 16px;color: var(--ui-tlr-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-tlr__tally{display: grid;flex: none;justify-items: end;gap: 3px;padding-top: 2px}
.ui-tlr__tally-num{display: flex;align-items: baseline;font-variant-numeric: tabular-nums;line-height: 1}
.ui-tlr__tally-num b{display: inline-block;font-size: 16px;font-weight: 600;letter-spacing: -0.02em;color: var(--ui-tlr-ink);animation: ui-tlr-tick var(--nm-dur-3, 240ms) var(--ui-tlr-spring) both}
.ui-tlr__tally-num span{font-size: 11px;color: var(--ui-tlr-muted)}
.ui-tlr__tally-label{font-size: 9.5px;font-weight: 500;line-height: 13px;letter-spacing: 0.08em;text-transform: uppercase;color: var(--ui-tlr-subtle)}
.ui-tlr__meter{width: 72px;height: 3px;margin-top: 2px;overflow: hidden;border-radius: var(--radius-pill, 999px);background: var(--ui-tlr-line-soft)}
.ui-tlr__meter > span{display: block;height: 100%;border-radius: inherit;background: var(--ui-tlr-ink);transform-origin: left center;transition: transform var(--nm-dur-4, 380ms) var(--ui-tlr-ease-both)}

/* Search */
.ui-tlr__search{display: flex;align-items: center;gap: 8px;height: 36px;margin: 0 16px 12px 18px;padding: 0 8px 0 11px;border-radius: var(--ui-tlr-radius-inner);background: var(--ui-tlr-card);box-shadow: inset 0 0 0 1px var(--ui-tlr-line);color: var(--ui-tlr-muted);transition: background-color var(--ui-tlr-dur) var(--ui-tlr-ease),box-shadow var(--ui-tlr-dur) var(--ui-tlr-ease)}
.ui-tlr__search:focus-within{background: var(--ui-tlr-raised);box-shadow: inset 0 0 0 1px var(--ui-tlr-line),0 0 0 3px var(--ui-tlr-accent-soft)}
.ui-tlr__input{flex: 1;min-width: 0;height: 100%;padding: 0;border: 0;outline: none;background: none;font: inherit;font-size: 12.5px;color: var(--ui-tlr-ink)}
.ui-tlr__input::placeholder{color: var(--ui-tlr-subtle)}
.ui-tlr__input::-webkit-search-cancel-button{-webkit-appearance: none}
.ui-tlr__clear{display: grid;place-items: center;width: 22px;height: 22px;border-radius: 6px;color: var(--ui-tlr-muted);transition: background-color var(--ui-tlr-dur) var(--ui-tlr-ease),color var(--ui-tlr-dur) var(--ui-tlr-ease)}
.ui-tlr__clear:hover{background: var(--ui-tlr-wash);color: var(--ui-tlr-ink)}

/* Referenced but disabled */
.ui-tlr__warn{display: flex;flex-wrap: wrap;align-items: flex-start;gap: 9px;margin: 0 16px 12px 18px;padding: 9px 9px 9px 11px;border-radius: var(--ui-tlr-radius-inner);background: var(--ui-tlr-warn-bg);box-shadow: inset 0 0 0 1px var(--ui-tlr-warn-line)}
.ui-tlr__warn-icon{display: grid;place-items: center;width: 16px;height: 16px;margin-top: 1px;color: var(--ui-tlr-warning)}
.ui-tlr__warn-copy{display: grid;flex: 1;gap: 1px;min-width: 0;font-size: 11.5px;line-height: 16px}
.ui-tlr__warn-title{font-weight: 500;color: var(--ui-tlr-ink)}
.ui-tlr__warn-names{overflow: hidden;color: var(--ui-tlr-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-tlr__warn-names code{font-size: 11px;color: var(--ui-tlr-warning)}
.ui-tlr__warn-btn{flex: none;align-self: center;height: 26px;padding: 0 9px;border-radius: 8px;color: var(--ui-tlr-warning);font-size: 11px;font-weight: 500;box-shadow: inset 0 0 0 1px var(--ui-tlr-warn-line);transition: background-color var(--ui-tlr-dur) var(--ui-tlr-ease)}
.ui-tlr__warn-btn:hover{background: var(--ui-tlr-warn-bg)}

/* The stage holds the filtered list and the outgoing grouping that fades over it */
.ui-tlr__stage{position: relative}
.ui-tlr__list{animation: ui-tlr-swap var(--nm-dur-3, 240ms) var(--ui-tlr-ease) both}
.ui-tlr__ghost{position: absolute;top: 0;right: 0;left: 0;z-index: 1;background: var(--ui-tlr-panel);pointer-events: none;animation: ui-tlr-ghost var(--nm-dur-3, 240ms) var(--ui-tlr-ease-in) both}

/* Namespace groups */
.ui-tlr__group + .ui-tlr__group{box-shadow: inset 0 1px 0 var(--ui-tlr-line-soft)}
.ui-tlr__ghead{display: flex;align-items: center;justify-content: space-between;gap: 10px;padding: 12px 16px 6px 18px}
.ui-tlr__gname{display: inline-flex;align-items: center;gap: 6px;min-width: 0;font-family: var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace);font-size: 11px;font-weight: 500;line-height: 16px;letter-spacing: 0.01em;color: var(--ui-tlr-muted)}
.ui-tlr__gname > svg{color: var(--ui-tlr-subtle)}
.ui-tlr__gcount{display: inline-flex;align-items: baseline;font-size: 10.5px;line-height: 16px;color: var(--ui-tlr-subtle);font-variant-numeric: tabular-nums;white-space: nowrap}
.ui-tlr__gcount b{display: inline-block;font-size: 11px;font-weight: 500;color: var(--ui-tlr-muted);animation: ui-tlr-tick var(--nm-dur-3, 240ms) var(--ui-tlr-spring) both}

/* Rows */
.ui-tlr__tools{display: grid;gap: 2px;padding: 0 8px 8px}
.ui-tlr__tool{border-radius: 10px;transition: background-color var(--ui-tlr-dur) var(--ui-tlr-ease)}
.ui-tlr__tool:hover{background: var(--ui-tlr-wash)}
.ui-tlr__tool[data-open]{background: var(--ui-tlr-card);box-shadow: inset 2px 0 0 var(--ui-tlr-accent),inset 0 0 0 1px var(--ui-tlr-line-soft)}
.ui-tlr__row{display: grid;grid-template-columns: minmax(0, 1fr) auto;align-items: center;gap: 6px;padding: 4px 6px 4px 4px}
.ui-tlr__toggle{display: grid;grid-template-columns: 12px minmax(0, 1fr) auto;align-items: center;gap: 10px;width: 100%;min-height: 38px;padding: 2px 2px 2px 6px;border-radius: 8px}
.ui-tlr .ui-tlr__toggle:focus-visible{outline-offset: -2px}
.ui-tlr__chev{display: grid;place-items: center;color: var(--ui-tlr-subtle);transition: transform var(--nm-dur-3, 240ms) var(--ui-tlr-ease-both),color var(--ui-tlr-dur) var(--ui-tlr-ease)}
.ui-tlr__tool[data-open] .ui-tlr__chev{transform: rotate(90deg);color: var(--ui-tlr-accent)}
.ui-tlr__main{display: grid;gap: 1px;min-width: 0}
.ui-tlr__name{display: flex;align-items: center;gap: 8px;min-width: 0;font-family: var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace);font-size: 12.5px;font-weight: 500;line-height: 17px;color: var(--ui-tlr-ink)}
.ui-tlr__name-text{overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-tlr__purpose{overflow: hidden;font-size: 11.5px;line-height: 16px;color: var(--ui-tlr-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-tlr__ref{display: inline-flex;flex: none;align-items: center;gap: 3px;padding: 0 5px 0 4px;border-radius: var(--radius-pill, 999px);font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 9.5px;font-weight: 500;line-height: 15px;letter-spacing: 0.03em;text-transform: uppercase;color: var(--ui-tlr-muted);background: var(--ui-tlr-wash);box-shadow: inset 0 0 0 1px var(--ui-tlr-line-soft);white-space: nowrap}
.ui-tlr__ref[data-warn]{color: var(--ui-tlr-warning);background: var(--ui-tlr-warn-bg);box-shadow: inset 0 0 0 1px var(--ui-tlr-warn-line)}
.ui-tlr__risk{display: inline-flex;align-items: center;gap: 5px;font-size: 10px;font-weight: 500;line-height: 16px;letter-spacing: 0.05em;text-transform: uppercase;color: var(--ui-tlr-muted);white-space: nowrap}
.ui-tlr__risk[data-risk="low"]{color: var(--ui-tlr-success)}
.ui-tlr__risk[data-risk="medium"]{color: var(--ui-tlr-warning)}
.ui-tlr__risk[data-risk="high"]{color: var(--ui-tlr-danger)}

/* The switch is a button, so its state is announced rather than painted on a div */
.ui-tlr__switch{display: grid;place-items: center;width: 40px;height: 28px;border-radius: var(--radius-pill, 999px)}
.ui-tlr__switch-track{position: relative;width: 34px;height: 20px;border-radius: var(--radius-pill, 999px);background: var(--ui-tlr-line);box-shadow: inset 0 0 0 1px var(--ui-tlr-line-soft);transition: background-color var(--ui-tlr-dur) var(--ui-tlr-ease),box-shadow var(--ui-tlr-dur) var(--ui-tlr-ease)}
.ui-tlr__switch:hover .ui-tlr__switch-track{box-shadow: inset 0 0 0 1px var(--ui-tlr-muted)}
.ui-tlr__switch-thumb{position: absolute;top: 2px;left: 2px;width: 16px;height: 16px;border-radius: 50%;background: var(--ui-tlr-muted);transition: transform var(--nm-dur-3, 240ms) var(--ui-tlr-spring),background-color var(--ui-tlr-dur) var(--ui-tlr-ease)}
.ui-tlr__switch[aria-checked="true"] .ui-tlr__switch-track{background: var(--ui-tlr-on)}
.ui-tlr__switch[aria-checked="true"] .ui-tlr__switch-thumb{transform: translateX(14px);background: var(--ui-tlr-on-fg)}

/* Schema reveal: grid rows, never height */
.ui-tlr__schema{display: grid;grid-template-rows: 0fr;opacity: 0;transition: grid-template-rows var(--nm-dur-2, 160ms) var(--ui-tlr-ease-in),opacity var(--nm-dur-1, 90ms) var(--ui-tlr-ease-in)}
.ui-tlr__tool[data-open] .ui-tlr__schema{grid-template-rows: 1fr;opacity: 1;transition: grid-template-rows var(--nm-dur-3, 240ms) var(--ui-tlr-ease),opacity var(--nm-dur-2, 160ms) var(--ui-tlr-ease)}
.ui-tlr__schema-clip{overflow: hidden;min-height: 0}
.ui-tlr__schema-body{padding: 2px 12px 12px 32px}
.ui-tlr__sig{display: block;padding: 7px 9px;border-radius: 10px;background: var(--ui-tlr-panel);box-shadow: inset 0 0 0 1px var(--ui-tlr-line-soft);font-size: 11px;line-height: 17px;color: var(--ui-tlr-ink);overflow-wrap: anywhere}
.ui-tlr__params{display: grid;margin-top: 9px}
.ui-tlr__phead,
.ui-tlr__param{display: grid;grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.9fr) 84px minmax(0, 2.1fr);align-items: baseline;column-gap: 10px}
.ui-tlr__phead{padding: 0 0 5px;font-size: 9.5px;font-weight: 500;line-height: 14px;letter-spacing: 0.06em;text-transform: uppercase;color: var(--ui-tlr-subtle)}
.ui-tlr__param{padding: 7px 0;box-shadow: inset 0 1px 0 var(--ui-tlr-line-soft)}
.ui-tlr__pname{font-size: 11px;line-height: 16px;color: var(--ui-tlr-ink);overflow-wrap: anywhere}
.ui-tlr__ptype{justify-self: start;padding: 1px 5px;border-radius: 5px;background: var(--ui-tlr-wash);box-shadow: inset 0 0 0 1px var(--ui-tlr-line-soft);font-size: 10px;line-height: 14px;color: var(--ui-tlr-muted);white-space: nowrap}
.ui-tlr__pflag{display: inline-flex;align-items: center;gap: 4px;font-size: 10px;line-height: 15px;color: var(--ui-tlr-subtle);white-space: nowrap}
.ui-tlr__pflag[data-req]{color: var(--ui-tlr-ink)}
.ui-tlr__pdesc{font-size: 11px;line-height: 16px;color: var(--ui-tlr-muted)}
.ui-tlr__noargs{font-size: 11.5px;line-height: 16px;color: var(--ui-tlr-muted)}

/* Empty search */
.ui-tlr__empty{display: grid;justify-items: center;gap: 5px;padding: 28px 20px 32px;text-align: center}
.ui-tlr__empty-mark{display: grid;place-items: center;width: 38px;height: 38px;margin-bottom: 3px;border-radius: 12px;background: var(--ui-tlr-card);box-shadow: inset 0 0 0 1px var(--ui-tlr-line-soft);color: var(--ui-tlr-subtle)}
.ui-tlr__empty-title{font-size: 12.5px;font-weight: 500;line-height: 18px;color: var(--ui-tlr-ink)}
.ui-tlr__empty-sub{max-width: 34ch;font-size: 11.5px;line-height: 16px;color: var(--ui-tlr-muted)}
.ui-tlr__empty-btn{margin-top: 5px;height: 28px;padding: 0 11px;border-radius: 8px;background: var(--ui-tlr-card);box-shadow: inset 0 0 0 1px var(--ui-tlr-line);color: var(--ui-tlr-ink);font-size: 11.5px;font-weight: 500;transition: background-color var(--ui-tlr-dur) var(--ui-tlr-ease)}
.ui-tlr__empty-btn:hover{background: var(--ui-tlr-wash)}

@keyframes ui-tlr-tick{from{opacity: 0;transform: translateY(0.32em)}
to{opacity: 1;transform: translateY(0)}
}
@keyframes ui-tlr-swap{from{opacity: 0;transform: translateY(3px)}
to{opacity: 1;transform: none}
}
@keyframes ui-tlr-ghost{to{opacity: 0}
}

@container (max-width: 460px){
  .ui-tlr__head{padding: 14px 12px 10px 14px;gap: 10px}
  .ui-tlr__search{margin: 0 12px 10px 14px}
  .ui-tlr__warn{margin: 0 12px 10px 14px}
  .ui-tlr__ghead{padding: 10px 12px 6px 14px}
  .ui-tlr__tools{padding: 0 6px 6px}
  .ui-tlr__schema-body{padding: 2px 10px 10px 26px}
  .ui-tlr__risk > span{display: none}
  .ui-tlr__phead{display: none}
  .ui-tlr__param{grid-template-columns: auto minmax(0, 1fr);column-gap: 10px;row-gap: 2px}
  .ui-tlr__pname{grid-column: 1;grid-row: 1}
  .ui-tlr__ptype{grid-column: 2;grid-row: 1}
  .ui-tlr__pflag{grid-column: 1;grid-row: 2}
  .ui-tlr__pdesc{grid-column: 2;grid-row: 2}
}

@media (pointer: coarse){
  .ui-tlr__switch{width: 44px;height: 32px}
  .ui-tlr__switch-track{width: 38px;height: 22px}
  .ui-tlr__switch-thumb{width: 18px;height: 18px}
  .ui-tlr__switch[aria-checked="true"] .ui-tlr__switch-thumb{transform: translateX(16px)}
  .ui-tlr__clear{width: 28px;height: 28px}
  .ui-tlr__warn-btn{height: 30px}
  .ui-tlr__empty-btn{height: 32px}
}

@media (prefers-reduced-motion: reduce){
  .ui-tlr *,
  .ui-tlr *::before,
  .ui-tlr *::after{transition-duration: 1ms}
  .ui-tlr__list,
  .ui-tlr__gcount b,
  .ui-tlr__tally-num b{animation: none}
  .ui-tlr .ui-tlr__tool[data-open] .ui-tlr__schema,
  .ui-tlr .ui-tlr__meter > span{transition-duration: 1ms}
}

:where(.dark, [data-theme="dark"]) .ui-tlr{
  --ui-tlr-warn-bg: #d995301a;
  --ui-tlr-warn-line: #d995303d;
  --ui-tlr-shadow: 0 1px 0 #00000040, 0 22px 50px -26px #000000c4;
}
`;
