"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

/*
 * Agent Sandbox – the workspace an agent worked in: a file tree beside the file it touched.
 * Arrow keys walk the tree, Right unfolds a folder and Left folds it, Enter opens a file, and the
 * selection is one slab that eases between rows rather than eighty rows fading on their own.
 * Reset asks first, because it throws the agent's work away: a wash crosses the preview pane,
 * then the tree is put back the way it was before the run.
 * The styles are injected below, so no extra files are needed.
 */

/** What this run did to a node. `untouched` is anything the agent never wrote to */
export type SandboxChange = "created" | "changed" | "deleted" | "untouched";

/** One file or folder in the sandbox */
export type SandboxNode = {
  /** Stable across a reset, so a selection can survive one – "src/parse.ts" */
  id: string;
  /** Leaf name, shown in the tree and as the last breadcrumb */
  name: string;
  kind: "file" | "folder";
  /** Defaults to `untouched` */
  change?: SandboxChange;
  /** Bytes on disk now – shown beside the name and summed into "written" */
  size?: number;
  /** What the preview pane shows, line breaks included */
  excerpt?: string;
  /** One line on what the agent did here */
  note?: string;
  /** Folders start unfolded with this */
  open?: boolean;
  children?: readonly SandboxNode[];
};

export type AgentSandboxProps = {
  /** Heading in the top bar */
  title?: string;
  /** The sandbox as the agent left it */
  nodes: readonly SandboxNode[];
  /** The same workspace as it stood before the run. Reset restores this, so it is not optional */
  baseline: readonly SandboxNode[];
  /** The row selected on the first paint – defaults to the first file */
  defaultSelectedId?: string;
  /** The selection moved */
  onSelect?: (node: SandboxNode) => void;
  /** Enter on a file */
  onOpen?: (node: SandboxNode) => void;
  /** The reset was confirmed and the tree restored */
  onReset?: () => void;
  className?: string;
};

type Phase = "idle" | "confirm" | "sweeping";

export function AgentSandbox({
  title = "Sandbox",
  nodes,
  baseline,
  defaultSelectedId,
  onSelect,
  onOpen,
  onReset,
  className,
}: AgentSandboxProps) {
  const labelId = useId();
  /* What the sandbox looked like when it was restored. Comparing content, not array identity,
     means a caller that rebuilds its tree every render still sees a reset take, while a caller
     that hands over a genuinely different run sees the reset stand down on its own. */
  const nodesSignature = useMemo(() => signatureOf(nodes), [nodes]);
  const [restoredFrom, setRestoredFrom] = useState<string | null>(null);
  const restored = restoredFrom !== null && restoredFrom === nodesSignature;

  const [phase, setPhase] = useState<Phase>("idle");
  const [narrow, setNarrow] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(openIds(nodes)));
  const [selectedId, setSelectedId] = useState(
    () => defaultSelectedId ?? firstFileId(nodes) ?? nodes[0]?.id ?? "",
  );
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [glide, setGlide] = useState({ y: 0, h: 30, ready: false });

  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const resetRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const refocused = useRef(false);
  /* The sweep is a timed sequence, so it reads the baseline from a ref: a caller that rebuilds its
     arrays every render must not restart the timers halfway through. */
  const baselineRef = useRef(baseline);

  useEffect(() => {
    baselineRef.current = baseline;
  }, [baseline]);

  const tree = restored ? baseline : nodes;

  const index = useMemo(() => indexOf(tree), [tree]);
  const rows = useMemo(() => visibleRows(tree, expanded), [tree, expanded]);
  const sum = useMemo(() => tally(tree), [tree]);
  const entry = index.get(selectedId);
  const selected = entry?.node;

  /* Pane split: measured, so the tree and the preview stack on a narrow frame instead of guessing
     a breakpoint off the viewport when the panel is mounted in a 320px card. */
  useEffect(() => {
    const element = rootRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((records) => {
      const width = records[0]?.contentRect.width ?? 0;
      setNarrow(width > 0 && width < 640);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /* The highlight slab reads the row's real box, in content coordinates, so it rides along with
     the scroller without a scroll listener and still lands right after a fold animates. */
  const measure = () => {
    const element = itemRefs.current.get(selectedId);
    if (!element) {
      setGlide((previous) => (previous.ready ? { ...previous, ready: false } : previous));
      return;
    }
    const row = element.firstElementChild;
    const height = row ? row.getBoundingClientRect().height : element.getBoundingClientRect().height;
    setGlide({ y: element.offsetTop, h: height, ready: true });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const frame = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, restored, narrow, tree, expanded]);

  /* The roving tabindex sits on the selected row, so a selection inside a folded folder would take
     the whole tree off the tab order. Unfolding its ancestors is the fix, not a second tab stop. */
  useEffect(() => {
    const target = index.get(selectedId);
    if (!target) return;
    if (!target.ancestors.some((node) => !expanded.has(node.id))) return;
    setExpanded((previous) => new Set([...previous, ...target.ancestors.map((node) => node.id)]));
  }, [index, selectedId, expanded]);

  /* Reset: the wash crosses the pane, the tree is swapped back at the crossover, and the panel
     settles. Both timers are cleared, and a still host skips the choreography instead of sitting
     in a sweeping state for a second. */
  useEffect(() => {
    if (phase !== "sweeping") return;
    const still =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const commit = window.setTimeout(
      () => {
        const target = baselineRef.current;
        const lookup = indexOf(target);
        const previous = index.get(selectedId);
        const ancestor = previous
          ? [...previous.ancestors].reverse().find((node) => lookup.has(node.id))
          : undefined;
        const next = lookup.has(selectedId)
          ? selectedId
          : ancestor?.id ?? firstFileId(target) ?? target[0]?.id ?? "";
        setRestoredFrom(nodesSignature);
        setOpenedId(null);
        setExpanded((previousSet) => new Set([...previousSet, ...openIds(target)]));
        setSelectedId(next);
        onReset?.();
        window.requestAnimationFrame(() => itemRefs.current.get(next)?.focus());
      },
      still ? 0 : SWEEP_HIT,
    );
    const settle = window.setTimeout(() => setPhase("idle"), still ? 80 : SWEEP_END);
    return () => {
      window.clearTimeout(commit);
      window.clearTimeout(settle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, nodesSignature]);

  /* Focus follows the confirmation: onto the button that discards work, and back to the reset
     button when the user keeps it. */
  useEffect(() => {
    if (phase === "confirm") {
      confirmRef.current?.focus();
      return;
    }
    if (phase === "idle" && refocused.current) {
      refocused.current = false;
      resetRef.current?.focus();
    }
  }, [phase]);

  const select = (id: string, focus = false) => {
    setSelectedId(id);
    if (focus) {
      const element = itemRefs.current.get(id);
      element?.focus();
      element?.scrollIntoView({ block: "nearest" });
    }
    const node = index.get(id)?.node;
    if (node) onSelect?.(node);
  };

  const reveal = (id: string) => {
    const target = index.get(id);
    setExpanded((previous) => {
      const next = new Set(previous);
      target?.ancestors.forEach((node) => next.add(node.id));
      return next;
    });
    select(id);
  };

  const toggle = (id: string, open: boolean) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
    if (!open && selectedId !== id) {
      const current = index.get(selectedId);
      if (current?.ancestors.some((node) => node.id === id)) setSelectedId(id);
    }
  };

  const openNode = (node: SandboxNode) => {
    if (node.kind === "folder" && (node.children?.length ?? 0) > 0) {
      toggle(node.id, !expanded.has(node.id));
      return;
    }
    if (node.kind === "file") {
      setOpenedId(node.id);
      onOpen?.(node);
    }
  };

  const onTreeKeyDown = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    if (phase === "sweeping") return;
    const at = rows.findIndex((row) => row.node.id === selectedId);
    if (at < 0) return;
    const row = rows[at];
    let move: string | null = null;
    switch (event.key) {
      case "ArrowDown":
        move = rows[Math.min(at + 1, rows.length - 1)]?.node.id ?? null;
        break;
      case "ArrowUp":
        move = rows[Math.max(at - 1, 0)]?.node.id ?? null;
        break;
      case "ArrowRight":
        if (row.hasKids && !row.open) toggle(row.node.id, true);
        else if (row.hasKids && row.open) move = rows[at + 1]?.node.id ?? null;
        break;
      case "ArrowLeft":
        if (row.hasKids && row.open) toggle(row.node.id, false);
        else if (row.parentId) move = row.parentId;
        break;
      case "Home":
        move = rows[0]?.node.id ?? null;
        break;
      case "End":
        move = rows[rows.length - 1]?.node.id ?? null;
        break;
      case "Enter":
        event.preventDefault();
        openNode(row.node);
        return;
      case " ":
        event.preventDefault();
        if (row.hasKids) toggle(row.node.id, !row.open);
        return;
      default:
        return;
    }
    event.preventDefault();
    if (move && move !== selectedId) select(move, true);
  };

  const state = phase === "sweeping" ? "resetting" : phase;

  const renderNode = (node: SandboxNode, depth: number) => {
    const kids = node.children ?? [];
    const hasKids = node.kind === "folder" && kids.length > 0;
    const open = hasKids && expanded.has(node.id);
    const selectedRow = node.id === selectedId;
    const change = node.change ?? "untouched";
    const rollup =
      hasKids && change === "untouched"
        ? descendants(node).filter(
            (child) => child.kind === "file" && (child.change ?? "untouched") !== "untouched",
          ).length
        : 0;

    return (
      <li
        key={node.id}
        role="treeitem"
        className="ui-agsb__item"
        aria-level={depth + 1}
        aria-selected={selectedRow}
        aria-expanded={hasKids ? open : undefined}
        data-open={open ? "" : undefined}
        tabIndex={selectedRow ? 0 : -1}
        style={{ "--ui-agsb-indent": `${depth * 14}px` } as CSSProperties}
        ref={(element) => {
          if (element) itemRefs.current.set(node.id, element);
          else itemRefs.current.delete(node.id);
        }}
      >
        <div className="ui-agsb__row" data-change={change} onClick={() => select(node.id, true)}>
          {hasKids ? (
            <button
              type="button"
              className="ui-agsb__twist"
              tabIndex={-1}
              aria-label={`${open ? "Fold" : "Unfold"} ${node.name}`}
              onClick={(event) => {
                event.stopPropagation();
                toggle(node.id, !open);
              }}
            >
              <GlyphChevron />
            </button>
          ) : (
            <span className="ui-agsb__twist-space" aria-hidden="true" />
          )}
          <span className="ui-agsb__kind" aria-hidden="true">
            {node.kind === "folder" ? <GlyphFolder /> : <GlyphFile />}
          </span>
          <span className="ui-agsb__name">{node.name}</span>
          {change !== "untouched" ? (
            <span className="ui-agsb__tag" data-change={change}>
              {markGlyph(change)}
              <span className="ui-agsb__tag-label">{MARK_LABEL[change]}</span>
            </span>
          ) : rollup > 0 ? (
            <span className="ui-agsb__tag" data-change="rollup">
              <GlyphRollup />
              <span className="ui-agsb__tag-label">
                {rollup} changed
              </span>
            </span>
          ) : null}
          {node.kind === "file" && typeof node.size === "number" ? (
            <span className="ui-agsb__size">{formatBytes(node.size)}</span>
          ) : null}
        </div>
        {hasKids ? (
          <div className="ui-agsb__fold" data-open={open ? "" : undefined}>
            <div className="ui-agsb__fold-clip">
              <ul className="ui-agsb__kids" role="group">
                {kids.map((child) => renderNode(child, depth + 1))}
              </ul>
            </div>
          </div>
        ) : null}
      </li>
    );
  };

  const previewBody = (node: SandboxNode) => {
    const change = node.change ?? "untouched";
    if (node.kind === "folder") {
      const files = descendants(node).filter((child) => child.kind === "file");
      const moved = files.filter((child) => (child.change ?? "untouched") !== "untouched");
      const written = moved.reduce(
        (total, child) => total + (child.change === "deleted" ? 0 : child.size ?? 0),
        0,
      );
      return (
        <>
          <div className="ui-agsb__head">
            <span className="ui-agsb__file">{node.name}</span>
            <span className="ui-agsb__meta">
              {files.length} {files.length === 1 ? "file" : "files"}
            </span>
          </div>
          {files.length === 0 ? (
            <p className="ui-agsb__note">This folder is empty.</p>
          ) : moved.length === 0 ? (
            <p className="ui-agsb__note">
              Untouched by this run. {files.length === 1 ? "Its one file is" : `All ${files.length} files are`}{" "}
              unchanged.
            </p>
          ) : (
            <>
              <p className="ui-agsb__note">
                {moved.length === 1 ? "1 file changed" : `${moved.length} files changed`} in here,{" "}
                {formatBytes(written)} written. Pick one to preview it.
              </p>
              <ul className="ui-agsb__roll">
                {moved.slice(0, 6).map((child) => {
                  const kind =
                    child.change === "created"
                      ? "created"
                      : child.change === "deleted"
                        ? "deleted"
                        : "changed";
                  return (
                    <li key={child.id}>
                      <button type="button" className="ui-agsb__chip" onClick={() => reveal(child.id)}>
                        {markGlyph(kind)}
                        <span className="ui-agsb__chip-name">{child.name}</span>
                      </button>
                    </li>
                  );
                })}
                {moved.length > 6 ? (
                  <li className="ui-agsb__roll-more">and {moved.length - 6} more</li>
                ) : null}
              </ul>
            </>
          )}
        </>
      );
    }
    return (
      <>
        <div className="ui-agsb__head">
          <span className="ui-agsb__file">{node.name}</span>
          {change !== "untouched" ? (
            <span className="ui-agsb__tag" data-change={change}>
              {markGlyph(change)}
              <span className="ui-agsb__tag-label">{MARK_LABEL[change]}</span>
            </span>
          ) : null}
          {openedId === node.id ? <span className="ui-agsb__open">Open</span> : null}
          {typeof node.size === "number" ? (
            <span className="ui-agsb__meta">{formatBytes(node.size)}</span>
          ) : null}
        </div>
        {node.note ? <p className="ui-agsb__note">{node.note}</p> : null}
        {change === "deleted" ? (
          <p className="ui-agsb__banner" data-tone="danger">
            <GlyphRemoved />
            <span>This file is off disk. Reset puts the last saved copy back.</span>
          </p>
        ) : null}
        {node.excerpt ? (
          <pre className="ui-agsb__code">{node.excerpt}</pre>
        ) : (
          <p className="ui-agsb__note">No excerpt was captured for this file.</p>
        )}
      </>
    );
  };

  const trail = selected ? [...(entry?.ancestors ?? []), selected] : [];

  return (
    <div
      ref={rootRef}
      className={["ui-agsb", className].filter(Boolean).join(" ")}
      data-state={state}
      role="group"
      aria-labelledby={labelId}
      aria-busy={phase === "sweeping" ? true : undefined}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-agent-sandbox" precedence="default">
        {css}
      </style>

      <header className="ui-agsb__bar">
        <span className="ui-agsb__mark" aria-hidden="true">
          <GlyphSandbox />
        </span>
        <span className="ui-agsb__title" id={labelId}>
          {title}
        </span>
        <span className="ui-agsb__iso" data-restored={restored ? "" : undefined}>
          {restored ? "restored" : "isolated"}
        </span>
        <p className="ui-agsb__sum" role="status" aria-live="polite">
          <span>
            <b>{sum.changed}</b> {sum.changed === 1 ? "file changed" : "files changed"}
          </span>
          {sum.removed > 0 ? (
            <span>
              <b>{sum.removed}</b> removed
            </span>
          ) : null}
          <span>
            <b>{formatBytes(sum.written)}</b> written
          </span>
        </p>
      </header>

      <div className="ui-agsb__grid" data-narrow={narrow ? "" : undefined}>
        <div className="ui-agsb__rail">
          <p className="ui-agsb__rail-head">
            Workspace
            <span className="ui-agsb__keys" aria-hidden="true">
              arrows to walk, Enter to open
            </span>
          </p>
          <div className="ui-agsb__scroll">
            <div className="ui-agsb__stack" onTransitionEnd={measure}>
              <span
                className="ui-agsb__glide"
                data-ready={glide.ready ? "" : undefined}
                aria-hidden="true"
                style={{ transform: `translate3d(0, ${glide.y}px, 0)`, height: `${glide.h}px` }}
              />
              <ul className="ui-agsb__list" role="tree" aria-label="Sandbox files" onKeyDown={onTreeKeyDown}>
                {tree.map((node) => renderNode(node, 0))}
              </ul>
            </div>
          </div>
        </div>

        <div className="ui-agsb__preview">
          <span className="ui-agsb__wash" aria-hidden="true" />
          <nav className="ui-agsb__crumbs" aria-label="Path in the sandbox">
            {trail.map((node, at) => {
              const last = at === trail.length - 1;
              return (
                <span className="ui-agsb__crumb-slot" key={node.id}>
                  {at > 0 ? (
                    <span className="ui-agsb__sep" aria-hidden="true">
                      /
                    </span>
                  ) : null}
                  {last ? (
                    <span className="ui-agsb__crumb" aria-current="location">
                      {node.name}
                    </span>
                  ) : (
                    <button type="button" className="ui-agsb__crumb" onClick={() => reveal(node.id)}>
                      {node.name}
                    </button>
                  )}
                </span>
              );
            })}
          </nav>
          <div className="ui-agsb__body">
            {restored ? (
              <p className="ui-agsb__banner" data-tone="success">
                <GlyphRestored />
                <span>Restored. This workspace is back to its starting state.</span>
              </p>
            ) : null}
            {selected ? (
              previewBody(selected)
            ) : (
              <p className="ui-agsb__note">Nothing is selected. Pick a file in the tree.</p>
            )}
          </div>
        </div>
      </div>

      <footer className="ui-agsb__foot">
        {phase === "confirm" ? (
          <div
            className="ui-agsb__confirm"
            role="group"
            aria-label="Confirm the sandbox reset"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                refocused.current = true;
                setPhase("idle");
              }
            }}
          >
            <span className="ui-agsb__ask">
              Discard {sum.changed} {sum.changed === 1 ? "change" : "changes"} and restore{" "}
              {sum.files} {sum.files === 1 ? "file" : "files"}?
            </span>
            <button
              type="button"
              className="ui-agsb__go"
              ref={confirmRef}
              onClick={() => setPhase("sweeping")}
            >
              Reset sandbox
            </button>
            <button
              type="button"
              className="ui-agsb__keep"
              onClick={() => {
                refocused.current = true;
                setPhase("idle");
              }}
            >
              Keep changes
            </button>
          </div>
        ) : phase === "sweeping" ? (
          <span className="ui-agsb__hint">Putting the workspace back</span>
        ) : sum.changed > 0 ? (
          <>
            <button type="button" className="ui-agsb__reset" ref={resetRef} onClick={() => setPhase("confirm")}>
              <GlyphRestore />
              Reset sandbox
            </button>
            <span className="ui-agsb__hint">Restores the whole workspace to its starting state</span>
          </>
        ) : (
          <span className="ui-agsb__hint">At its starting state. Nothing to put back.</span>
        )}
      </footer>
    </div>
  );
}

/* ---------- Glyphs ---------- */

function GlyphSandbox() {
  return (
    <svg viewBox="0 0 12 12" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.1 1.6H1.6v2.5M7.9 1.6h2.5v2.5M4.1 10.4H1.6V7.9M7.9 10.4h2.5V7.9" />
      <path d="M4.4 4.4h3.2v3.2H4.4z" />
    </svg>
  );
}

function GlyphChevron() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 2.5 8 6l-3.5 3.5" />
    </svg>
  );
}

function GlyphFolder() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.4 4.1c0-.9.7-1.6 1.6-1.6h1.4l1.1 1.3h3.5c.9 0 1.6.7 1.6 1.6v3.5c0 .9-.7 1.6-1.6 1.6H3c-.9 0-1.6-.7-1.6-1.6V4.1Z" />
    </svg>
  );
}

function GlyphFile() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.9 1.6h3.5l2.7 2.7v6.1H2.9z" />
      <path d="M6.4 1.6v2.7h2.7" />
    </svg>
  );
}

function GlyphAdded() {
  return (
    <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6.1 1.6H2.9a1.4 1.4 0 0 0-1.4 1.4v6a1.4 1.4 0 0 0 1.4 1.4h4.1a1.4 1.4 0 0 0 1.4-1.4V6.4" />
      <path d="M9.7 1.7v3.4M8 3.4h3.4" />
    </svg>
  );
}

function GlyphEdited() {
  return (
    <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 9.5l.4-2.1 6.6-6.6 1.7 1.7-6.6 6.6-2.1.4Z" />
      <path d="M8.6 1.7 10.3 3.4" />
    </svg>
  );
}

function GlyphRemoved() {
  return (
    <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6.1 1.6H2.9a1.4 1.4 0 0 0-1.4 1.4v6a1.4 1.4 0 0 0 1.4 1.4h4.1a1.4 1.4 0 0 0 1.4-1.4V6.4" />
      <path d="M8 3.4h3.4" />
    </svg>
  );
}

function GlyphRollup() {
  return (
    <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.2 2.2v2.4a1.8 1.8 0 0 0 1.8 1.8h3.2" />
      <path d="M5.6 4.6 7.4 6.4 5.6 8.2" />
    </svg>
  );
}

function GlyphRestore() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h11c3.3 0 6 2.7 6 6s-2.7 6-6 6H8" />
      <path d="M8 3 4 7l4 4" />
    </svg>
  );
}

function GlyphRestored() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.4 3.6h4.2M6.6 1.6 8.6 3.6 6.6 5.6" />
      <path d="M9.6 8.4H5.4M5.4 6.4 3.4 8.4 5.4 10.4" />
    </svg>
  );
}

function markGlyph(kind: Exclude<SandboxChange, "untouched">): ReactNode {
  if (kind === "created") return <GlyphAdded />;
  if (kind === "changed") return <GlyphEdited />;
  return <GlyphRemoved />;
}

/* ---------- Reads ---------- */

const MARK_LABEL: Record<Exclude<SandboxChange, "untouched">, string> = {
  created: "Added",
  changed: "Edited",
  deleted: "Removed",
};

const SWEEP_HIT = 320;
const SWEEP_END = 780;

type Row = {
  node: SandboxNode;
  /** The enclosing folder, so Left on a child steps up to it */
  parentId: string | null;
  hasKids: boolean;
  open: boolean;
};

type Entry = {
  node: SandboxNode;
  ancestors: readonly SandboxNode[];
};

/** The rows the arrow keys walk: everything outside a folded folder is skipped */
function visibleRows(nodes: readonly SandboxNode[], expanded: ReadonlySet<string>): Row[] {
  const rows: Row[] = [];
  const walk = (list: readonly SandboxNode[], parentId: string | null) => {
    for (const node of list) {
      const kids = node.children ?? [];
      const hasKids = node.kind === "folder" && kids.length > 0;
      const open = hasKids && expanded.has(node.id);
      rows.push({ node, parentId, hasKids, open });
      if (open) walk(kids, node.id);
    }
  };
  walk(nodes, null);
  return rows;
}

/** Every node keyed by id, folded or not, for the preview, the crumbs and the reset fallback */
function indexOf(nodes: readonly SandboxNode[]) {
  const map = new Map<string, Entry>();
  const walk = (list: readonly SandboxNode[], ancestors: readonly SandboxNode[]) => {
    for (const node of list) {
      map.set(node.id, { node, ancestors });
      if (node.children?.length) walk(node.children, [...ancestors, node]);
    }
  };
  walk(nodes, []);
  return map;
}

function openIds(nodes: readonly SandboxNode[]): string[] {
  const ids: string[] = [];
  const walk = (list: readonly SandboxNode[]) => {
    for (const node of list) {
      if (node.open && node.children?.length) ids.push(node.id);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return ids;
}

function descendants(node: SandboxNode): SandboxNode[] {
  const out: SandboxNode[] = [];
  const walk = (list: readonly SandboxNode[]) => {
    for (const child of list) {
      out.push(child);
      if (child.children?.length) walk(child.children);
    }
  };
  walk(node.children ?? []);
  return out;
}

function firstFileId(nodes: readonly SandboxNode[]): string | undefined {
  for (const node of nodes) {
    if (node.kind === "file") return node.id;
    const nested = firstFileId(node.children ?? []);
    if (nested) return nested;
  }
  return undefined;
}

function tally(nodes: readonly SandboxNode[]) {
  let files = 0;
  let changed = 0;
  let removed = 0;
  let written = 0;
  const walk = (list: readonly SandboxNode[]) => {
    for (const node of list) {
      if (node.kind === "file") {
        files += 1;
        const change = node.change ?? "untouched";
        if (change !== "untouched") changed += 1;
        if (change === "deleted") removed += 1;
        else if (change !== "untouched") written += node.size ?? 0;
      }
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return { files, changed, removed, written };
}

/** Every node's identity, change and size, flattened into one comparable string */
function signatureOf(nodes: readonly SandboxNode[]): string {
  return nodes
    .map((node) =>
      [
        node.id,
        node.kind,
        node.change ?? "untouched",
        node.size ?? 0,
        node.children ? signatureOf(node.children) : "",
      ].join(":"),
    )
    .join(",");
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ---------- Styles ---------- */

const css = /* css */ `
/* The component's knobs. Override them on .ui-agsb { … } – a host that loads only NamurUI gets
 * the literal fallbacks, a host that loads the token layer gets its themes. */
.ui-agsb{
  --ui-agsb-ink: var(--text, #1a1410);
  --ui-agsb-muted: var(--text-muted, #6f625a);
  --ui-agsb-subtle: var(--text-subtle, #1a141066);
  --ui-agsb-line: var(--border, #e8e0d7);
  --ui-agsb-line-soft: var(--border-soft, #1a14101a);
  --ui-agsb-panel: var(--panel, #fffdfb);
  --ui-agsb-card: var(--card, #ffffff);
  --ui-agsb-well: var(--bg, #faf7f4);
  --ui-agsb-wash: var(--hover-bg, #7a4a1c12);
  --ui-agsb-accent: var(--accent, #c2410c);
  --ui-agsb-accent-soft: var(--accent-soft, #c2410c1a);
  --ui-agsb-success: var(--success, #1a7a4a);
  --ui-agsb-warning: var(--warning, #9a6410);
  --ui-agsb-danger: var(--danger, #b3261e);
  --ui-agsb-on-danger: #fffdfb;
  --ui-agsb-shadow: var(--shadow-card, 0 1px 1.5px #3d1f0a0a, inset 0 -1px 0 #3d1f0a0f);
  --ui-agsb-row: 30px;
  --ui-agsb-mono: var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace);
  --ui-agsb-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-agsb-ease-in: var(--nm-ease-in, cubic-bezier(0.55, 0, 0.68, 0.19));
  --ui-agsb-ease-soft: var(--nm-ease-soft, cubic-bezier(0.4, 0, 0.2, 1));
  --ui-agsb-dur-1: var(--nm-dur-1, 90ms);
  --ui-agsb-dur-2: var(--nm-dur-2, 160ms);
  --ui-agsb-dur-3: var(--nm-dur-3, 240ms);
  --ui-agsb-dur-5: var(--nm-dur-5, 620ms);
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--radius-panel, 20px);
  background: var(--ui-agsb-panel);
  box-shadow: var(--ui-agsb-shadow), inset 0 0 0 1px var(--ui-agsb-line-soft);
  color: var(--ui-agsb-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  line-height: 1.45;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
  text-align: left;
}
.ui-agsb *, .ui-agsb *::before, .ui-agsb *::after{box-sizing:border-box}

/* Bar */
.ui-agsb__bar{display:flex;align-items:center;gap:9px;min-height:46px;padding:8px 14px;box-shadow:inset 0 -1px 0 var(--ui-agsb-line-soft)}
.ui-agsb__mark{display:grid;flex:none;place-items:center;width:24px;height:24px;border-radius:9px;background:var(--ui-agsb-wash);color:var(--ui-agsb-ink)}
.ui-agsb__title{font-size:13.5px;font-weight:600;white-space:nowrap}
.ui-agsb__iso{flex:none;padding:1px 8px 2px;border-radius:var(--radius-pill, 999px);background:var(--ui-agsb-wash);font-size:11px;font-weight:500;line-height:16px;color:var(--ui-agsb-muted)}
.ui-agsb__iso[data-restored]{color:var(--ui-agsb-success)}
.ui-agsb__sum{display:flex;flex:1;flex-wrap:wrap;gap:0 9px;justify-content:flex-end;margin:0;font-size:12px;line-height:18px;color:var(--ui-agsb-muted);font-variant-numeric:tabular-nums}
.ui-agsb__sum b{font-weight:600;color:var(--ui-agsb-ink)}

/* Panes */
.ui-agsb__grid{display:grid;flex:1;grid-template-columns:minmax(0, 1fr) minmax(0, 1.04fr);min-height:0}
.ui-agsb__grid[data-narrow]{grid-template-columns:minmax(0, 1fr)}
.ui-agsb__rail{display:flex;flex-direction:column;min-width:0;background:var(--ui-agsb-card);box-shadow:inset -1px 0 0 var(--ui-agsb-line-soft)}
.ui-agsb__grid[data-narrow] .ui-agsb__rail{box-shadow:inset 0 -1px 0 var(--ui-agsb-line-soft)}
.ui-agsb__rail-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:0;padding:10px 14px 6px;font-size:10.5px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:var(--ui-agsb-subtle)}
.ui-agsb__keys{font-size:10.5px;font-weight:400;letter-spacing:0;text-transform:none;color:var(--ui-agsb-subtle)}
.ui-agsb__scroll{flex:1;min-height:0;max-height:330px;overflow:auto;overscroll-behavior:contain}
.ui-agsb__grid[data-narrow] .ui-agsb__scroll{max-height:250px}

/* Tree */
.ui-agsb__stack{position:relative;padding:4px 6px 8px;transition:opacity var(--ui-agsb-dur-3) var(--ui-agsb-ease-out)}
.ui-agsb[data-state="resetting"] .ui-agsb__stack{opacity:0.55;pointer-events:none;transition:opacity var(--ui-agsb-dur-2) var(--ui-agsb-ease-in)}
.ui-agsb__glide{position:absolute;left:6px;right:6px;top:0;opacity:0;border-radius:9px;background:var(--ui-agsb-accent-soft);box-shadow:inset 0 0 0 1px var(--ui-agsb-accent-soft);pointer-events:none;transition:transform var(--ui-agsb-dur-3) var(--ui-agsb-ease-out), opacity var(--ui-agsb-dur-2) var(--ui-agsb-ease-out)}
.ui-agsb__glide[data-ready]{opacity:1}
.ui-agsb__glide::before{content:"";position:absolute;left:0;top:8px;bottom:8px;width:2px;border-radius:2px;background:var(--ui-agsb-accent)}
.ui-agsb__list, .ui-agsb__kids{margin:0;padding:0;list-style:none}
.ui-agsb__item{list-style:none}
.ui-agsb__item:focus{outline:none}
.ui-agsb__item:focus-visible > .ui-agsb__row{box-shadow:inset 0 0 0 2px var(--ui-agsb-accent)}
.ui-agsb__item[aria-selected="true"] > .ui-agsb__row .ui-agsb__name{font-weight:600}
/* The slab is absolutely positioned, so the row lifts above it. The item itself stays static on
   purpose: offsetTop has to resolve against the stack, or a nested row would measure from its
   parent item instead. */
.ui-agsb__row{position:relative;z-index:1;display:grid;grid-template-columns:14px 14px minmax(0, 1fr) auto auto;column-gap:6px;align-items:center;height:var(--ui-agsb-row);padding:0 10px 0 calc(3px + var(--ui-agsb-indent, 0px));border-radius:9px;cursor:default;transition:background-color var(--ui-agsb-dur-1) var(--ui-agsb-ease-out)}
.ui-agsb__row:hover{background:var(--ui-agsb-wash)}
.ui-agsb__twist{display:grid;place-items:center;width:14px;height:14px;padding:0;border:0;border-radius:5px;background:none;color:var(--ui-agsb-muted);cursor:pointer;transition:background-color var(--ui-agsb-dur-1) var(--ui-agsb-ease-out)}
.ui-agsb__twist svg{width:12px;height:12px;transition:transform var(--ui-agsb-dur-2) var(--ui-agsb-ease-out)}
.ui-agsb__item[data-open] > .ui-agsb__row .ui-agsb__twist svg{transform:rotate(90deg)}
.ui-agsb__twist:hover{background:var(--ui-agsb-wash);color:var(--ui-agsb-ink)}
.ui-agsb__twist:focus-visible{outline:none;box-shadow:inset 0 0 0 2px var(--ui-agsb-accent)}
.ui-agsb__twist-space{width:14px;height:14px}
.ui-agsb__kind{display:grid;place-items:center;color:var(--ui-agsb-muted)}
.ui-agsb__kind svg{width:12px;height:12px}
.ui-agsb__name{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-family:var(--ui-agsb-mono);font-size:12.5px}
.ui-agsb__row[data-change="deleted"] .ui-agsb__name{color:var(--ui-agsb-muted);text-decoration:line-through;text-decoration-color:var(--ui-agsb-subtle)}
.ui-agsb__tag{display:inline-flex;flex:none;align-items:center;gap:3px;font-size:11px;font-weight:500;line-height:16px;white-space:nowrap}
.ui-agsb__tag svg{flex:none}
.ui-agsb__tag[data-change="created"]{color:var(--ui-agsb-success)}
.ui-agsb__tag[data-change="changed"]{color:var(--ui-agsb-warning)}
.ui-agsb__tag[data-change="deleted"]{color:var(--ui-agsb-danger)}
.ui-agsb__tag[data-change="rollup"]{color:var(--ui-agsb-subtle)}
.ui-agsb__size{flex:none;font-size:11px;color:var(--ui-agsb-subtle);font-variant-numeric:tabular-nums}
.ui-agsb__grid[data-narrow] .ui-agsb__size{display:none}

/* A fold reveals its children by growing the row track, never by animating height. */
.ui-agsb__fold{display:grid;grid-template-rows:0fr;visibility:hidden;transition:grid-template-rows var(--ui-agsb-dur-3) var(--ui-agsb-ease-out), visibility 0s linear var(--ui-agsb-dur-3)}
.ui-agsb__fold[data-open]{grid-template-rows:1fr;visibility:visible;transition:grid-template-rows var(--ui-agsb-dur-3) var(--ui-agsb-ease-out), visibility 0s linear 0s}
.ui-agsb__fold-clip{min-height:0;overflow:hidden}

/* Preview */
.ui-agsb__preview{position:relative;display:flex;flex-direction:column;min-width:0;overflow:hidden;background:var(--ui-agsb-panel)}
.ui-agsb__wash{position:absolute;inset:0;z-index:3;opacity:0;pointer-events:none;background:linear-gradient(100deg, transparent 4%, var(--ui-agsb-accent-soft) 46%, transparent 92%)}
.ui-agsb[data-state="resetting"] .ui-agsb__wash{animation:ui-agsb-sweep var(--ui-agsb-dur-5) var(--ui-agsb-ease-out) both}
.ui-agsb__crumbs{display:flex;flex-wrap:wrap;align-items:center;gap:1px;padding:11px 12px 0;font-family:var(--ui-agsb-mono);font-size:11.5px;line-height:16px}
.ui-agsb__crumb-slot{display:inline-flex;align-items:center;gap:1px;min-width:0}
.ui-agsb__sep{color:var(--ui-agsb-subtle)}
.ui-agsb__crumb{max-width:100%;padding:2px 5px;border:0;border-radius:6px;background:none;font:inherit;color:var(--ui-agsb-muted);cursor:pointer;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;transition:background-color var(--ui-agsb-dur-1) var(--ui-agsb-ease-out), color var(--ui-agsb-dur-1) var(--ui-agsb-ease-out)}
.ui-agsb__crumb:hover{background:var(--ui-agsb-wash);color:var(--ui-agsb-ink)}
.ui-agsb__crumb:focus-visible{outline:none;box-shadow:inset 0 0 0 2px var(--ui-agsb-accent)}
.ui-agsb__crumb[aria-current="location"]{padding-left:2px;color:var(--ui-agsb-ink);font-weight:600;cursor:default}
.ui-agsb__body{display:flex;flex:1;flex-direction:column;gap:9px;min-height:0;max-height:330px;padding:10px 14px 16px;overflow:auto;transition:opacity var(--ui-agsb-dur-3) var(--ui-agsb-ease-out)}
.ui-agsb[data-state="resetting"] .ui-agsb__body{opacity:0.35;transition:opacity var(--ui-agsb-dur-2) var(--ui-agsb-ease-in)}
.ui-agsb__head{display:flex;flex-wrap:wrap;align-items:center;gap:8px;min-width:0}
.ui-agsb__file{min-width:0;font-family:var(--ui-agsb-mono);font-size:13.5px;font-weight:600;overflow-wrap:anywhere}
.ui-agsb__meta{font-size:11.5px;color:var(--ui-agsb-muted);font-variant-numeric:tabular-nums}
.ui-agsb__open{padding:1px 7px 2px;border-radius:var(--radius-pill, 999px);background:var(--ui-agsb-wash);font-size:11px;font-weight:500;color:var(--ui-agsb-ink)}
.ui-agsb__note{margin:0;font-size:12.5px;line-height:18px;color:var(--ui-agsb-muted)}
.ui-agsb__banner{display:flex;align-items:flex-start;gap:7px;margin:0;padding:8px 10px;border-radius:10px;background:var(--ui-agsb-wash);font-size:12px;line-height:17px;color:var(--ui-agsb-muted)}
.ui-agsb__banner svg{flex:none;margin-top:2px}
.ui-agsb__banner[data-tone="danger"]{color:var(--ui-agsb-danger)}
.ui-agsb__banner[data-tone="success"]{color:var(--ui-agsb-success)}
.ui-agsb__code{margin:0;padding:10px 12px;border-radius:var(--radius-preview, 12px);background:var(--ui-agsb-well);box-shadow:inset 0 0 0 1px var(--ui-agsb-line-soft);font-family:var(--ui-agsb-mono);font-size:11.5px;line-height:18px;color:var(--ui-agsb-ink);white-space:pre-wrap;overflow-wrap:anywhere}
.ui-agsb__roll{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;list-style:none}
.ui-agsb__roll-more{font-size:11.5px;line-height:24px;color:var(--ui-agsb-subtle)}
.ui-agsb__chip{display:inline-flex;align-items:center;gap:5px;max-width:100%;padding:4px 9px;border:0;border-radius:var(--radius-pill, 999px);background:var(--ui-agsb-well);box-shadow:inset 0 0 0 1px var(--ui-agsb-line-soft);font:inherit;font-size:11.5px;color:var(--ui-agsb-muted);cursor:pointer;transition:background-color var(--ui-agsb-dur-1) var(--ui-agsb-ease-out), color var(--ui-agsb-dur-1) var(--ui-agsb-ease-out)}
.ui-agsb__chip:hover{background:var(--ui-agsb-wash);color:var(--ui-agsb-ink)}
.ui-agsb__chip:focus-visible{outline:none;box-shadow:inset 0 0 0 2px var(--ui-agsb-accent)}
.ui-agsb__chip-name{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-family:var(--ui-agsb-mono)}

/* Foot */
.ui-agsb__foot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-height:52px;padding:9px 14px;box-shadow:inset 0 1px 0 var(--ui-agsb-line-soft)}
.ui-agsb__reset{display:inline-flex;flex:none;align-items:center;gap:7px;height:32px;padding:0 12px;border:0;border-radius:9px;background:var(--ui-agsb-card);box-shadow:inset 0 0 0 1px var(--ui-agsb-line);font:inherit;font-size:12.5px;font-weight:500;color:var(--ui-agsb-ink);cursor:pointer;transition:background-color var(--ui-agsb-dur-1) var(--ui-agsb-ease-out), transform var(--ui-agsb-dur-1) var(--ui-agsb-ease-out)}
.ui-agsb__reset svg{width:13px;height:13px;color:var(--ui-agsb-muted);transition:color var(--ui-agsb-dur-1) var(--ui-agsb-ease-out)}
.ui-agsb__reset:hover{background:var(--ui-agsb-wash)}
.ui-agsb__reset:hover svg{color:var(--ui-agsb-ink)}
.ui-agsb__reset:active{transform:scale(0.985)}
.ui-agsb__reset:focus-visible{outline:none;box-shadow:inset 0 0 0 2px var(--ui-agsb-accent)}
.ui-agsb__hint{font-size:11.5px;color:var(--ui-agsb-subtle)}
.ui-agsb__confirm{display:flex;flex:1;flex-wrap:wrap;align-items:center;gap:10px;animation:ui-agsb-ask var(--ui-agsb-dur-3) var(--ui-agsb-ease-out) both}
.ui-agsb__ask{flex:1;min-width:170px;font-size:12.5px;line-height:18px;color:var(--ui-agsb-ink)}
.ui-agsb__go{flex:none;height:32px;padding:0 12px;border:0;border-radius:9px;background:var(--ui-agsb-danger);font:inherit;font-size:12.5px;font-weight:600;color:var(--ui-agsb-on-danger);cursor:pointer;transition:transform var(--ui-agsb-dur-1) var(--ui-agsb-ease-out)}
.ui-agsb__go:active{transform:scale(0.985)}
.ui-agsb__go:focus-visible{outline:none;box-shadow:0 0 0 2px var(--ui-agsb-panel), 0 0 0 4px var(--ui-agsb-accent)}
.ui-agsb__keep{flex:none;height:32px;padding:0 12px;border:0;border-radius:9px;background:none;box-shadow:inset 0 0 0 1px var(--ui-agsb-line);font:inherit;font-size:12.5px;font-weight:500;color:var(--ui-agsb-ink);cursor:pointer;transition:background-color var(--ui-agsb-dur-1) var(--ui-agsb-ease-out)}
.ui-agsb__keep:hover{background:var(--ui-agsb-wash)}
.ui-agsb__keep:focus-visible{outline:none;box-shadow:inset 0 0 0 2px var(--ui-agsb-accent)}

@keyframes ui-agsb-sweep{
  from{opacity:0;transform:translate3d(-100%, 0, 0)}
  34%{opacity:1}
  to{opacity:0;transform:translate3d(100%, 0, 0)}
}
@keyframes ui-agsb-ask{
  from{opacity:0;transform:translate3d(0, 4px, 0)}
  to{opacity:1;transform:translate3d(0, 0, 0)}
}

:where(.dark, [data-theme="dark"]) .ui-agsb{
  --ui-agsb-ink: #f4ece4;
  --ui-agsb-muted: #a2958a;
  --ui-agsb-subtle: #f4ece48c;
  --ui-agsb-line: #33291f;
  --ui-agsb-line-soft: #ffffff12;
  --ui-agsb-panel: #1a1512;
  --ui-agsb-card: #201a15;
  --ui-agsb-well: #14100d;
  --ui-agsb-wash: #ffffff12;
  --ui-agsb-accent: #ff6b35;
  --ui-agsb-accent-soft: #ff6b3524;
  --ui-agsb-success: #4f9d6e;
  --ui-agsb-warning: #d99530;
  --ui-agsb-danger: #e2544a;
  --ui-agsb-on-danger: #1a0f08;
  --ui-agsb-shadow: 0 1px 1.5px #0000004d, inset 0 -1px 0 #ffffff0a;
}

@media (prefers-reduced-motion: reduce){
  .ui-agsb__glide,
  .ui-agsb__fold,
  .ui-agsb__twist svg,
  .ui-agsb__stack,
  .ui-agsb__body,
  .ui-agsb__row,
  .ui-agsb__crumb,
  .ui-agsb__chip,
  .ui-agsb__reset,
  .ui-agsb__reset svg,
  .ui-agsb__keep,
  .ui-agsb__go,
  .ui-agsb__confirm{transition-duration:1ms}
  .ui-agsb__confirm{animation:none}
  /* No transform may travel, so the sweep becomes a flash of the same wash. */
  .ui-agsb[data-state="resetting"] .ui-agsb__wash{animation:none;transition:opacity var(--ui-agsb-dur-1) linear;opacity:0.85}
}
`;