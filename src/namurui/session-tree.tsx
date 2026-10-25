"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/*
 * Session tree: an OMP session as the tree it actually is — every entry hanging off the entry
 * before it, one branch live and the rest kept for the record. Rows draw their own connectors from
 * the parent's rail, so a fork reads as a fork before any label does; expanding a subtree fades its
 * rows in from just above, the chevron turns on the same beat, and the leaf's marker breathes at the
 * ambient step because it is the one thing still alive. Styles are injected below, so no extra
 * files are needed.
 */

export type SessionEntryType =
  | "message"
  | "compaction"
  | "branch_summary"
  | "model_change"
  | "thinking_level_change"
  | "label"
  | "reset_boundary"
  | "custom";

export type SessionNode = {
  /** Stable entry id, as the bridge reports it */
  id: string;
  /** What kind of entry this is, which picks the glyph and the word */
  type: SessionEntryType;
  /** Bookmark text, when the entry carries one */
  label?: string;
  /** The entry's content, cut to one line by the row */
  preview: string;
  /** Entries that follow this one on this branch */
  children: readonly SessionNode[];
};

export type SessionTreeProps = {
  /** Root entries, each carrying its own children */
  nodes: readonly SessionNode[];
  /** Entry the session currently ends on; its row carries the ember accent */
  leafId?: string;
  /** Controlled selected entry id; leave it out and the tree owns the selection */
  selectedId?: string;
  /** An entry was chosen by click or by Enter */
  onSelect?: (node: SessionNode) => void;
  /** Start every entry that has children collapsed */
  defaultCollapsed?: boolean;
  /** Extra class on the root */
  className?: string;
};

const TYPE_WORD: Record<SessionEntryType, string> = {
  message: "message",
  compaction: "compaction",
  branch_summary: "branch",
  model_change: "model",
  thinking_level_change: "thinking",
  label: "bookmark",
  reset_boundary: "reset",
  custom: "custom",
};

/* One glyph per entry kind: a bubble, a squeeze, a fork, a swap, a gauge, a ribbon,
 * a return arrow, and a mark for anything the bridge adds later. */
const TYPE_GLYPH: Record<SessionEntryType, ReactNode> = {
  message: (
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.4 3.2h7.2a1.2 1.2 0 0 1 1.2 1.2v3.6a1.2 1.2 0 0 1-1.2 1.2H6.6L3.9 11.4V9.2h-.5a1.2 1.2 0 0 1-1.2-1.2V4.4a1.2 1.2 0 0 1 1.2-1.2z" />
    </svg>
  ),
  compaction: (
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.8 7h8.4" />
      <path d="M4.6 3 7 5.4 9.4 3" />
      <path d="M4.6 11 7 8.6 9.4 11" />
    </svg>
  ),
  branch_summary: (
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 12.2V8.4" />
      <path d="M7 8.4C7 6.2 5.6 5.4 4 5.4H3.2V3.4" />
      <path d="M7 8.4c0-2.2 1.4-3 3-3h.8V3.4" />
      <circle cx="3.2" cy="2.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="10.8" cy="2.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  model_change: (
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4.6h7.4" />
      <path d="M8.6 2.6 10.6 4.6 8.6 6.6" />
      <path d="M11 9.4H3.6" />
      <path d="M5.4 7.4 3.4 9.4 5.4 11.4" />
    </svg>
  ),
  thinking_level_change: (
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.4 10.4a4.8 4.8 0 0 1 9.2 0" />
      <path d="M7 9.6 9.4 5.6" />
      <circle cx="7" cy="10.4" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  label: (
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 2.4h6v9.2L7 9.4 4 11.6z" />
    </svg>
  ),
  reset_boundary: (
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.4 7.2a3.9 3.9 0 1 0 1.2-2.8" />
      <path d="M2.8 2.6v2.4h2.4" />
    </svg>
  ),
  custom: (
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 2.2 8.3 5.7 11.8 7 8.3 8.3 7 11.8 5.7 8.3 2.2 7 5.7 5.7z" />
    </svg>
  ),
};

const CHEVRON = (
  <svg
    viewBox="0 0 10 10"
    width="10"
    height="10"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2.4 4 5 6.6 7.6 4" />
  </svg>
);

const BOOKMARK_GLYPH = (
  <svg
    viewBox="0 0 10 10"
    width="8"
    height="8"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2.4 1.6h5.2v6.8L5 6.3 2.4 8.4z" />
  </svg>
);

const CURRENT_GLYPH = (
  <svg viewBox="0 0 10 10" width="8" height="8" fill="none" aria-hidden="true">
    <circle cx="5" cy="5" r="3.2" stroke="currentColor" strokeWidth="1.2" />
    <circle cx="5" cy="5" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

type Row = {
  node: SessionNode;
  depth: number;
  /** Whether the entry at each level, this one included, is the last of its siblings */
  last: readonly boolean[];
  hasChildren: boolean;
  collapsed: boolean;
  /** Entries hidden under a collapsed row */
  hidden: number;
  current: boolean;
  /** On the path from a root down to the leaf */
  onPath: boolean;
  /** Off the active branch, so the row recedes */
  off: boolean;
};

function countBelow(node: SessionNode): number {
  let total = 0;
  const walk = (list: readonly SessionNode[]) => {
    for (const child of list) {
      total += 1;
      walk(child.children);
    }
  };
  walk(node.children);
  return total;
}

function idsWithChildren(nodes: readonly SessionNode[]): string[] {
  const ids: string[] = [];
  const walk = (list: readonly SessionNode[]) => {
    for (const node of list) {
      if (node.children.length > 0) ids.push(node.id);
      walk(node.children);
    }
  };
  walk(nodes);
  return ids;
}

/* The ids from a root down to the leaf, so the leaf's ancestry can stay lit and
 * everything else can recede. A leaf id the bridge no longer holds yields no path,
 * and then nothing recedes — an unknown leaf is not evidence of a dead branch. */
function leafPath(nodes: readonly SessionNode[], leafId: string | undefined): string[] {
  if (!leafId) return [];
  const walk = (list: readonly SessionNode[], trail: string[]): string[] | null => {
    for (const node of list) {
      const next = [...trail, node.id];
      if (node.id === leafId) return next;
      const found = walk(node.children, next);
      if (found) return found;
    }
    return null;
  };
  return walk(nodes, []) ?? [];
}

function flatten(
  nodes: readonly SessionNode[],
  collapsed: ReadonlySet<string>,
  leafId: string | undefined,
  pathSet: ReadonlySet<string>,
): Row[] {
  const rows: Row[] = [];
  const walk = (list: readonly SessionNode[], depth: number, last: readonly boolean[]) => {
    list.forEach((node, index) => {
      const isLast = index === list.length - 1;
      const hasChildren = node.children.length > 0;
      const isCollapsed = hasChildren && collapsed.has(node.id);
      rows.push({
        node,
        depth,
        last: [...last, isLast],
        hasChildren,
        collapsed: isCollapsed,
        hidden: isCollapsed ? countBelow(node) : 0,
        current: leafId !== undefined && node.id === leafId,
        onPath: pathSet.has(node.id),
        off: pathSet.size > 0 && !pathSet.has(node.id),
      });
      if (hasChildren && !isCollapsed) walk(node.children, depth + 1, [...last, isLast]);
    });
  };
  walk(nodes, 0, []);
  return rows;
}

export function SessionTree({
  nodes,
  leafId,
  selectedId,
  onSelect,
  defaultCollapsed = false,
  className,
}: SessionTreeProps) {
  const [own, setOwn] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(defaultCollapsed ? idsWithChildren(nodes) : []),
  );
  const [activeId, setActiveId] = useState<string>(() => leafId ?? selectedId ?? nodes[0]?.id ?? "");
  const buttons = useRef(new Map<string, HTMLButtonElement>());

  const path = leafPath(nodes, leafId);
  const pathSet = new Set(path);
  const rows = flatten(nodes, collapsed, leafId, pathSet);
  const selected = selectedId !== undefined ? selectedId : own;

  /* One tab stop, and it must be a row that is on screen: if the caller's leaf is
   * hidden inside a collapsed subtree, the tab stop falls back to the selection. */
  const visible = rows.some((row) => row.node.id === activeId);
  const fallback =
    rows.find((row) => row.node.id === selected)?.node.id ??
    rows.find((row) => row.current)?.node.id ??
    rows[0]?.node.id ??
    "";
  const focusId = visible ? activeId : fallback;

  const select = (node: SessionNode) => {
    setActiveId(node.id);
    if (selectedId === undefined) setOwn(node.id);
    onSelect?.(node);
  };

  const toggle = (id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* Up and Down walk the rows as drawn, not the tree's shape, so a collapsed subtree
   * costs one keypress to pass. Right opens or steps into a branch, Left closes it or
   * climbs to the parent, and Enter is the row button's own click. */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (rows.length === 0) return;
    const index = rows.findIndex((row) => row.node.id === focusId);
    if (index < 0) return;
    const row = rows[index];

    const go = (target: number) => {
      const next = rows[Math.max(0, Math.min(rows.length - 1, target))];
      if (!next) return;
      setActiveId(next.node.id);
      buttons.current.get(next.node.id)?.focus();
    };

    if (event.key === "ArrowDown") {
      event.preventDefault();
      go(index + 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      go(index - 1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (!row.hasChildren) return;
      if (row.collapsed) toggle(row.node.id);
      else go(index + 1);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (row.hasChildren && !row.collapsed) {
        toggle(row.node.id);
        return;
      }
      for (let i = index - 1; i >= 0; i -= 1) {
        if (rows[i].depth === row.depth - 1) {
          go(i);
          return;
        }
      }
    }
  };

  return (
    <div
      className={["ui-str", className].filter(Boolean).join(" ")}
      role="tree"
      aria-label="Session tree"
      onKeyDown={onKeyDown}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-session-tree" precedence="default">
        {css}
      </style>

      {rows.map((row) => {
        const { node, depth } = row;
        return (
          <div
            key={node.id}
            className="ui-str__row"
            role="treeitem"
            aria-level={depth + 1}
            aria-selected={node.id === selected}
            aria-expanded={row.hasChildren ? !row.collapsed : undefined}
            data-current={row.current ? "true" : undefined}
            data-selected={node.id === selected ? "true" : undefined}
            data-off={row.off ? "true" : undefined}
            data-path={row.onPath ? "true" : undefined}
            data-collapsed={row.collapsed ? "true" : undefined}
          >
            {/* One column per ancestor, then the elbow into this row. A column's rail
                belongs to that ancestor's children, so it runs on only while the child we
                came through still has a sibling below it. */}
            <span className="ui-str__gutters" aria-hidden="true">
              {Array.from({ length: depth }, (_, level) =>
                level === depth - 1 ? (
                  <span
                    key={level}
                    className="ui-str__gutter"
                    data-kind="elbow"
                    data-last={row.last[depth] ? "true" : undefined}
                  />
                ) : (
                  <span
                    key={level}
                    className="ui-str__gutter"
                    data-kind={row.last[level + 1] ? "blank" : "rail"}
                  />
                ),
              )}
            </span>

            {row.hasChildren ? (
              <button
                type="button"
                className="ui-str__toggle"
                tabIndex={-1}
                aria-label={`${row.collapsed ? "Expand" : "Collapse"} ${
                  node.label ?? TYPE_WORD[node.type]
                }`}
                onClick={() => {
                  setActiveId(node.id);
                  toggle(node.id);
                }}
              >
                {CHEVRON}
              </button>
            ) : (
              <span className="ui-str__spacer" aria-hidden="true" />
            )}

            <button
              type="button"
              className="ui-str__node"
              tabIndex={node.id === focusId ? 0 : -1}
              aria-current={row.current ? "true" : undefined}
              ref={(element) => {
                if (element) buttons.current.set(node.id, element);
                else buttons.current.delete(node.id);
              }}
              onFocus={() => setActiveId(node.id)}
              onClick={() => select(node)}
            >
              <span className="ui-str__glyph" aria-hidden="true">
                {TYPE_GLYPH[node.type]}
              </span>
              <span className="ui-str__word">{TYPE_WORD[node.type]}</span>
              <span className="ui-str__preview" title={node.preview}>
                {node.preview}
              </span>

              {node.label ? (
                <span className="ui-str__chip" data-kind="label">
                  <span className="ui-str__chip-glyph" aria-hidden="true">
                    {BOOKMARK_GLYPH}
                  </span>
                  <span className="ui-str__chip-text">{node.label}</span>
                </span>
              ) : null}

              {row.collapsed ? (
                <>
                  <span className="ui-str__chip" data-kind="count" aria-hidden="true">
                    +{row.hidden}
                  </span>
                  <span className="ui-str__sr">
                    {row.hidden} {row.hidden === 1 ? "entry" : "entries"} hidden
                  </span>
                </>
              ) : null}

              {/* A collapsed ancestor still has to say that the live entry is under it,
                  otherwise collapsing would hide where the session ends. */}
              {row.collapsed && row.onPath && !row.current ? (
                <span className="ui-str__chip" data-kind="current">
                  <span className="ui-str__chip-glyph" aria-hidden="true">
                    {CURRENT_GLYPH}
                  </span>
                  <span className="ui-str__chip-text">current below</span>
                </span>
              ) : null}

              {row.current ? (
                <span className="ui-str__chip" data-kind="current">
                  <span className="ui-str__chip-glyph" aria-hidden="true">
                    {CURRENT_GLYPH}
                  </span>
                  <span className="ui-str__chip-text">current</span>
                </span>
              ) : null}
            </button>
          </div>
        );
      })}
    </div>
  );
}

const css = /* css */ `
.ui-str {
  /* Knobs. Override any of these on .ui-str to retheme the tree in a host; set
   * --ui-str-panel to transparent to drop the card and sit the tree in a sidebar. */
  --ui-str-ink: var(--text, #1a1410);
  --ui-str-muted: var(--text-muted, #6f625a);
  --ui-str-subtle: #7d6f65;
  --ui-str-panel: var(--panel, #fffdfb);
  --ui-str-line: var(--border, #e8e0d7);
  --ui-str-path: #1a141040;
  --ui-str-edge: var(--border-soft, #1a14101a);
  --ui-str-wash: #7a4a1c0a;
  --ui-str-hover: #7a4a1c0f;
  --ui-str-chip: #1a14100a;
  --ui-str-accent: var(--accent, #c2410c);
  --ui-str-accent-wash: #c2410c12;
  --ui-str-accent-line: #c2410c33;
  /* The accent clears 4.5:1 on the panel, but not on its own wash, where the backdrop
   * lifts toward the ink. The chip text takes this darker step; the glyph and rule keep
   * the accent so the marker still reads as one ember object. */
  --ui-str-chip-ink: #a8350a;
  --ui-str-focus: var(--accent, #c2410c);
  --ui-str-ease: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-str-ease-soft: var(--nm-ease-soft, cubic-bezier(0.4, 0, 0.2, 1));
  --ui-str-dur: var(--nm-dur-2, 160ms);
  --ui-str-dur-in: var(--nm-dur-3, 240ms);
  --ui-str-dur-pulse: var(--nm-dur-6, 1100ms);
  --ui-str-row: 28px;
  --ui-str-indent: 18px;

  box-sizing: border-box;
  min-width: 0;
  width: 100%;
  padding: 6px;
  background: var(--ui-str-panel);
  border-radius: var(--radius-card, 16px);
  box-shadow: inset 0 0 0 1px var(--ui-str-line);
  color: var(--ui-str-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 18px;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-str *,
.ui-str *::before,
.ui-str *::after {
  box-sizing: border-box;
}
:where(.ui-str) button {
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
:where(.ui-str) svg {
  display: block;
}

/* A row --------------------------------------------------------------- */
.ui-str__row {
  display: flex;
  align-items: stretch;
  min-height: var(--ui-str-row);
  animation: ui-str-in var(--ui-str-dur-in) var(--ui-str-ease) both;
}
@keyframes ui-str-in {
  from {
    opacity: 0;
    transform: translateY(-3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Connectors: one cell per level, so the rail under a parent and the stub into a
 * child are drawn by the child's own row and meet the row above it. */
.ui-str__gutters {
  display: flex;
  flex: none;
}
.ui-str__gutter {
  position: relative;
  flex: none;
  width: var(--ui-str-indent);
}
.ui-str__gutter::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(var(--ui-str-indent) / 2);
  width: 1px;
  background: var(--ui-str-line);
}
.ui-str__gutter[data-kind="blank"]::before {
  display: none;
}
/* The last child's rail stops at the stub instead of running past it */
.ui-str__gutter[data-last="true"]::before {
  bottom: 50%;
}
.ui-str__gutter[data-kind="elbow"]::after {
  content: "";
  position: absolute;
  top: calc(50% - 0.5px);
  left: calc(var(--ui-str-indent) / 2);
  right: 0;
  height: 1px;
  background: var(--ui-str-line);
}
/* Only the stub into a row on the path is tinted: the rail above it may still be feeding
 * a sibling the session never took, and tinting that would call the dead branch live. */
.ui-str__row[data-path="true"] .ui-str__gutter[data-kind="elbow"]::after {
  background: var(--ui-str-path);
}

/* Toggle -------------------------------------------------------------- */
.ui-str__toggle,
.ui-str__spacer {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  width: var(--ui-str-indent);
  color: var(--ui-str-subtle);
}
.ui-str__toggle svg {
  transition: transform var(--ui-str-dur) var(--ui-str-ease);
}
.ui-str__row[data-collapsed="true"] .ui-str__toggle svg {
  transform: rotate(-90deg);
}
.ui-str__toggle:hover {
  color: var(--ui-str-ink);
}
.ui-str__toggle:focus-visible {
  outline: 2px solid var(--ui-str-focus);
  outline-offset: -2px;
  border-radius: 6px;
}

/* Node ---------------------------------------------------------------- */
.ui-str__node {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 6px;
  min-width: 0;
  min-height: var(--ui-str-row);
  padding: 0 8px 0 2px;
  border-radius: 8px;
  overflow: hidden;
  white-space: nowrap;
  transition:
    background-color var(--ui-str-dur) var(--ui-str-ease),
    box-shadow var(--ui-str-dur) var(--ui-str-ease);
}
.ui-str__row:hover .ui-str__node {
  background: var(--ui-str-hover);
}
.ui-str__row[data-selected="true"] .ui-str__node {
  background: var(--ui-str-wash);
  box-shadow: inset 0 0 0 1px var(--ui-str-edge);
}
/* The live entry: the one thing on this surface allowed to carry the accent */
.ui-str__row[data-current="true"] .ui-str__node {
  background: var(--ui-str-accent-wash);
  box-shadow: inset 0 0 0 1px var(--ui-str-accent-line);
}
/* Off the active branch: no accent, no tinted stub, and every piece of text drops one
 * step on the ink scale. Opacity would dim the row harder, but it takes the 11px word
 * under AA with it, so the recede is done with colour and the row stays readable. */
.ui-str__row[data-off="true"] .ui-str__preview,
.ui-str__row[data-off="true"] .ui-str__word,
.ui-str__row[data-off="true"] .ui-str__glyph {
  color: var(--ui-str-subtle);
}
.ui-str__row[data-off="true"]:hover .ui-str__preview,
.ui-str__row[data-off="true"][data-selected="true"] .ui-str__preview {
  color: var(--ui-str-muted);
}
.ui-str__node:focus-visible {
  outline: 2px solid var(--ui-str-focus);
  outline-offset: -2px;
}

.ui-str__glyph {
  display: grid;
  flex: none;
  place-items: center;
  width: 14px;
  height: 14px;
  color: var(--ui-str-muted);
  transition: color var(--ui-str-dur) var(--ui-str-ease);
}
.ui-str__word {
  flex: none;
  color: var(--ui-str-muted);
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  transition: color var(--ui-str-dur) var(--ui-str-ease);
}
.ui-str__row[data-current="true"] .ui-str__glyph,
.ui-str__row[data-current="true"] .ui-str__word {
  color: var(--ui-str-accent);
}
.ui-str__preview {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--ui-str-ink);
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--ui-str-dur) var(--ui-str-ease);
}

/* Chips --------------------------------------------------------------- */
/* The count chip reads "+12" on screen; the sentence beside it is what a screen
 * reader gets, so the number is never a guess. */
.ui-str__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.ui-str__chip {
  display: inline-flex;
  flex: 0 1 auto;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 34%;
  height: 18px;
  padding: 0 6px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-str-chip);
  color: var(--ui-str-muted);
  font-size: 10.5px;
  line-height: 16px;
  white-space: nowrap;
}
.ui-str__chip-glyph {
  display: grid;
  flex: none;
  place-items: center;
}
.ui-str__chip-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ui-str__chip[data-kind="count"] {
  color: var(--ui-str-subtle);
  font-variant-numeric: tabular-nums;
}
.ui-str__chip[data-kind="current"] {
  background: var(--ui-str-accent-wash);
  color: var(--ui-str-chip-ink);
  font-weight: 500;
  box-shadow: inset 0 0 0 1px var(--ui-str-accent-line);
}
/* The leaf is the live thing, so its marker breathes at the ambient step: slow enough
 * to be a presence rather than a notification. */
.ui-str__chip[data-kind="current"] .ui-str__chip-glyph {
  animation: ui-str-breathe var(--ui-str-dur-pulse) var(--ui-str-ease-soft) infinite alternate;
}
@keyframes ui-str-breathe {
  from {
    opacity: 0.55;
  }
  to {
    opacity: 1;
  }
}

:where(.dark, [data-theme="dark"]) .ui-str {
  --ui-str-ink: var(--text, #f4ece4);
  --ui-str-muted: var(--text-muted, #a2958a);
  --ui-str-subtle: #f4ece48c;
  --ui-str-panel: var(--panel, #1a1512);
  --ui-str-line: var(--border, #33291f);
  --ui-str-path: #f4ece433;
  --ui-str-edge: var(--border-soft, #ffffff12);
  --ui-str-wash: #ffffff0a;
  --ui-str-hover: #ffffff0f;
  --ui-str-chip: #ffffff0d;
  --ui-str-accent: var(--accent, #ff6b35);
  --ui-str-accent-wash: #ff6b351a;
  --ui-str-accent-line: #ff6b3540;
  --ui-str-chip-ink: var(--accent, #ff6b35);
  --ui-str-focus: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  .ui-str__row {
    animation: none;
  }
  .ui-str__row,
  .ui-str__node,
  .ui-str__toggle svg,
  .ui-str__glyph,
  .ui-str__word,
  .ui-str__preview {
    transition-duration: 1ms;
  }
  .ui-str__chip[data-kind="current"] .ui-str__chip-glyph {
    animation: none;
    opacity: 1;
  }
}
`;
