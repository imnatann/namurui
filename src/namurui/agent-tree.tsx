"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";

/*
 * Agent Tree – who started whom, in a single self-contained file.
 * An orchestrator and its sub-agents as one live tree: every card carries its status, the cost of
 * its whole branch and how long it has been running, and a branch folds into a single count. Cards
 * rise in behind the connector that links them, running amounts shimmer, and the agents that need
 * a decision gather into one chip in the bar with the questions behind it.
 * The styles are injected below, so no extra files are needed.
 */

export type AgentTreeStatus = "queued" | "running" | "waiting" | "done" | "failed" | "stopped";

/** Brand mark on the avatar tile – without one the agent's initials show */
export type AgentTreeMark = "claude" | "gemini" | "openai";

/** Logos drawn on the tiles before a task */
export type AgentTreeTool = "slack" | "notion" | "github" | "figma";

export type AgentTreeNode = {
  /** Stable id – folds, connectors and popovers key off it */
  id: string;
  /** Role on the card, e.g. "Researcher" */
  name: string;
  /** The model under the role, e.g. "Opus 5.5" */
  model?: string;
  /** What it was asked to do – the card clamps this to two lines */
  task: string;
  status: AgentTreeStatus;
  /** This agent's own spend, in dollars – the card adds its children on top */
  cost?: number;
  /** Epoch ms it started; without it the card shows no time */
  started?: number;
  /** Epoch ms it stopped; a running agent is timed up to now */
  ended?: number;
  /** Seconds on the card, fixed – overrides `started`/`ended` when the run is not live */
  elapsed?: number;
  /** Two letters on the avatar when the agent has no brand mark */
  avatar?: string;
  mark?: AgentTreeMark;
  /** Tools it works in, drawn as overlapping tiles before the task */
  tools?: readonly AgentTreeTool[];
  /** What a waiting agent needs you to settle */
  ask?: string;
  /** What went wrong, for a failed agent */
  error?: string;
  children?: readonly AgentTreeNode[];
};

export type AgentTreeAction = "approve" | "reject" | "retry" | "dismiss";

export type AgentTreeProps = {
  /** The whole tree – pass it again whenever the run changes */
  tree: AgentTreeNode;
  /** Heading of the bar, and the accessible name of the tree */
  title?: string;
  /** The clock for running times; without it the tree ticks every second while an agent runs */
  now?: number;
  /** Formats every amount, e.g. "$0.42" */
  formatCost?: (usd: number) => string;
  /** Ids of folded branches, controlled */
  collapsed?: readonly string[];
  /** Starting folded branches when uncontrolled */
  defaultCollapsed?: readonly string[];
  /** A branch was folded or opened */
  onCollapsedChange?: (collapsed: string[]) => void;
  /** An answer from the window behind "needs you" or "failed" */
  onResolve?: (node: AgentTreeNode, action: AgentTreeAction) => void;
  /** A click on a card – makes the cards clickable */
  onSelect?: (node: AgentTreeNode) => void;
  className?: string;
};

const STATUS_LABEL: Record<AgentTreeStatus, string> = {
  queued: "Queued",
  running: "Running",
  waiting: "Needs you",
  done: "Done",
  failed: "Failed",
  stopped: "Stopped",
};

/** Card width and the gutter a nested branch hangs in, both from the sheet */
const CARD = 216;
const RAIL = 16;
const BUS = 20;
const CORNER = 8;
const DOT_R = 3.25;

/** Below three cards in a row the branches stack – the reference gives way between 529 and 665 */
const WIDE_AT = 3 * CARD + 16;

type Box = { x: number; y: number; w: number; h: number };
type Wire = { key: string; d: string; muted: boolean };
type Dot = { key: string; cx: number; cy: number; muted: boolean };

function round(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Where an element sits inside the tree, ignoring the transform its entrance animation sets */
function boxIn(el: HTMLElement, root: HTMLElement): Box {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

function branchCost(node: AgentTreeNode): number {
  return (node.cost ?? 0) + (node.children ?? []).reduce((sum, child) => sum + branchCost(child), 0);
}

function formatSeconds(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}s`;
  return `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, "0")}s`;
}

function countStatus(node: AgentTreeNode, statuses: readonly AgentTreeStatus[]): number {
  const here = statuses.includes(node.status) ? 1 : 0;
  return here + (node.children ?? []).reduce((sum, child) => sum + countStatus(child, statuses), 0);
}

function withStatus(node: AgentTreeNode, status: AgentTreeStatus, out: AgentTreeNode[] = []): AgentTreeNode[] {
  if (node.status === status) out.push(node);
  (node.children ?? []).forEach((child) => withStatus(child, status, out));
  return out;
}

export function AgentTree({
  tree,
  title = "Agents",
  now,
  formatCost = (usd) => `$${usd.toFixed(2)}`,
  collapsed,
  defaultCollapsed,
  onCollapsedChange,
  onResolve,
  onSelect,
  className,
}: AgentTreeProps) {
  const [foldedInner, setFoldedInner] = useState<readonly string[]>(defaultCollapsed ?? []);
  const folded = collapsed ?? foldedInner;

  const [wide, setWide] = useState(true);
  const [open, setOpen] = useState<"waiting" | "failed" | null>(null);
  const [wires, setWires] = useState<readonly Wire[]>([]);
  const [dots, setDots] = useState<readonly Dot[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [fresh, setFresh] = useState<readonly string[]>([]);

  const [tick, setTick] = useState(() => Date.now());
  const clock = now ?? tick;

  const treeRef = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<string, HTMLDivElement>());
  const drawn = useRef(new Set<string>());
  const signature = useRef("");
  const measureRef = useRef<() => void>(() => {});

  const running = countStatus(tree, ["running"]);
  const waiting = countStatus(tree, ["waiting"]);
  const failed = countStatus(tree, ["failed"]);
  const agents = countStatus(tree, [
    "queued",
    "running",
    "waiting",
    "done",
    "failed",
    "stopped",
  ]);

  useEffect(() => {
    if (now !== undefined || running === 0) return;
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [now, running]);

  const depth = (() => {
    let deepest = 0;
    const visit = (node: AgentTreeNode, level: number) => {
      deepest = Math.max(deepest, level);
      (node.children ?? []).forEach((child) => visit(child, level + 1));
    };
    visit(tree, 0);
    return deepest;
  })();

  const kidsOf = (node: AgentTreeNode): readonly AgentTreeNode[] =>
    folded.includes(node.id) ? [] : node.children ?? [];

  const fold = (id: string) => {
    const next = folded.includes(id) ? folded.filter((other) => other !== id) : [...folded, id];
    if (collapsed === undefined) setFoldedInner(next);
    onCollapsedChange?.(next);
  };

  /* The connectors are drawn from where the cards actually land, so any width or fold is honest */
  measureRef.current = () => {
    const el = treeRef.current;
    if (!el) return;

    const available = el.clientWidth;
    const wantsWide = available >= WIDE_AT && (tree.children?.length ?? 0) <= 3;
    if (wantsWide !== wide) {
      setWide(wantsWide);
      return;
    }

    const nextWires: Wire[] = [];
    const nextDots: Dot[] = [];

    const visit = (node: AgentTreeNode, level: number) => {
      const kids = kidsOf(node);
      const card = cards.current.get(node.id);
      if (!card || kids.length === 0) return;

      const from = boxIn(card, el);
      const originX = wantsWide && level === 0 ? from.x + from.w / 2 : from.x + RAIL;
      const originY = from.y + from.h;
      const idle = node.status === "queued" || node.status === "stopped";
      nextDots.push({ key: node.id, cx: originX, cy: originY, muted: idle });

      for (const kid of kids) {
        const kidCard = cards.current.get(kid.id);
        if (!kidCard) continue;
        const to = boxIn(kidCard, el);
        let d: string;

        if (wantsWide && level === 0) {
          const targetX = to.x + to.w / 2;
          if (Math.abs(targetX - originX) < CORNER * 2) {
            d = `M${round(originX)} ${round(originY)}V${round(to.y)}`;
          } else {
            const bus = originY + BUS;
            const turn = targetX > originX ? targetX - CORNER : targetX + CORNER;
            d =
              `M${round(originX)} ${round(originY)}V${round(bus)}H${round(turn)}` +
              `Q${round(targetX)} ${round(bus)} ${round(targetX)} ${round(bus + CORNER)}` +
              `V${round(to.y)}`;
          }
        } else {
          const entry = Math.max(originY + CORNER, to.y + 20);
          d =
            `M${round(originX)} ${round(originY)}V${round(entry - CORNER)}` +
            `Q${round(originX)} ${round(entry)} ${round(originX + CORNER)} ${round(entry)}` +
            `H${round(to.x)}`;
        }

        nextWires.push({
          key: `${node.id}/${kid.id}`,
          d,
          muted: kid.status === "queued" || kid.status === "stopped",
        });
        visit(kid, level + 1);
      }
    };

    visit(tree, 0);

    const next = {
      w: Math.round(available),
      h: Math.round(el.scrollHeight),
    };
    const stamp = JSON.stringify([next, nextWires, nextDots]);
    if (stamp === signature.current) return;
    signature.current = stamp;

    setSize((was) => (was.w === next.w && was.h === next.h ? was : next));
    setWires(nextWires);
    setDots(nextDots);

    const added = nextWires.map((wire) => wire.key).filter((key) => !drawn.current.has(key));
    nextWires.forEach((wire) => drawn.current.add(wire.key));
    if (added.length > 0) setFresh(added);
  };

  useLayoutEffect(() => {
    measureRef.current();
  });

  useEffect(() => {
    const el = treeRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => measureRef.current());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (fresh.length === 0) return;
    const id = window.setTimeout(() => setFresh([]), 520);
    return () => window.clearTimeout(id);
  }, [fresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    const onDown = (event: globalThis.PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest(".ui-agtc__pop, .ui-agtc__sum-btn")) return;
      setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const answer = (node: AgentTreeNode, action: AgentTreeAction) => {
    onResolve?.(node, action);
    setOpen(null);
  };

  const card = (node: AgentTreeNode, level: number) => {
    const kids = node.children ?? [];
    const branch = branchCost(node);
    const time =
      node.elapsed !== undefined
        ? formatSeconds(node.elapsed)
        : node.started === undefined
          ? null
          : formatSeconds(((node.ended ?? clock) - node.started) / 1000);

    return (
      <div
        className="ui-agtc__node"
        data-status={node.status}
        data-depth={level}
        data-clickable={onSelect ? "" : undefined}
        style={{ animationDelay: `${level * 160}ms` }}
        ref={(el) => {
          if (el) cards.current.set(node.id, el);
          else cards.current.delete(node.id);
        }}
        role={onSelect ? "button" : undefined}
        tabIndex={onSelect ? 0 : undefined}
        aria-label={onSelect ? `Open ${node.name}` : undefined}
        onClick={
          onSelect
            ? (event: MouseEvent<HTMLDivElement>) => {
                event.stopPropagation();
                onSelect?.(node);
              }
            : undefined
        }
        onKeyDown={
          onSelect
            ? (event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onSelect?.(node);
              }
            : undefined
        }
      >
        <div className="ui-agtc__top">
          <span className="ui-agtc__avatar" data-logo={node.mark ? "" : undefined}>
            {node.mark ? MARKS[node.mark] : node.avatar ?? node.name.slice(0, 2).toUpperCase()}
          </span>
          <span className="ui-agtc__who">
            <span className="ui-agtc__name">{node.name}</span>
            {node.model ? <span className="ui-agtc__model">{node.model}</span> : null}
          </span>
          <span className="ui-agtc__status" data-status={node.status}>
            {node.status === "running" ? <Spinner /> : <StatusMark status={node.status} />}
            {STATUS_LABEL[node.status]}
          </span>
        </div>

        <p className="ui-agtc__task">
          {node.tools && node.tools.length > 0 ? (
            <span className="ui-agtc__tools" aria-hidden="true">
              {node.tools.map((tool) => (
                <span className="ui-agtc__tool" key={tool}>
                  {TOOLS[tool]}
                </span>
              ))}
            </span>
          ) : null}
          {node.task}
        </p>

        <div className="ui-agtc__meta">
          <span
            className="ui-agtc__cost"
            title={kids.length > 0 ? "This branch, with its sub-agents" : undefined}
          >
            <span className="ui-agtc__amount" data-live={node.status === "running" ? "" : undefined}>
              {formatCost(branch)}
            </span>
            {time ? <span className="ui-agtc__time"> · {time}</span> : null}
          </span>
          {kids.length > 0 ? (
            <button
              type="button"
              className="ui-agtc__fold"
              aria-expanded={!folded.includes(node.id)}
              aria-label={`${folded.includes(node.id) ? "Unfold" : "Fold"} the sub-agents of ${node.name}`}
              onClick={(event) => {
                event.stopPropagation();
                fold(node.id);
              }}
            >
              {kids.length}
              <Chevron />
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  const branchOf = (node: AgentTreeNode, level: number) => {
    const kids = kidsOf(node);
    return (
      <div
        className="ui-agtc__hang"
        role="treeitem"
        aria-label={`${node.name}: ${STATUS_LABEL[node.status]}`}
        aria-expanded={(node.children ?? []).length > 0 ? kids.length > 0 : undefined}
        key={node.id}
      >
        {card(node, level)}
        {kids.length > 0 ? (
          <div className={wide ? "ui-agtc__below" : "ui-agtc__level"} role="group">
            {kids.map((kid) => branchOf(kid, level + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  const roots = kidsOf(tree);
  const list = open ? withStatus(tree, open) : [];

  return (
    <div
      className={["ui-agtc", className].filter(Boolean).join(" ")}
      data-wide={wide ? "" : undefined}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-agent-tree" precedence="default">
        {css}
      </style>

      <header className="ui-agtc__bar">
        <span className="ui-agtc__spark">
          <Spark />
        </span>
        <span className="ui-agtc__title">{title}</span>
        <span className="ui-agtc__sum" aria-live="polite">
          <span>
            {agents} {agents === 1 ? "agent" : "agents"}
          </span>
          {running > 0 ? <span className="ui-agtc__sum-run">{running} running</span> : null}
          {waiting > 0 ? (
            onResolve ? (
              <button
                type="button"
                className="ui-agtc__sum-btn"
                data-kind="waiting"
                aria-expanded={open === "waiting"}
                aria-haspopup="dialog"
                onClick={() => setOpen(open === "waiting" ? null : "waiting")}
              >
                {waiting} {waiting === 1 ? "needs" : "need"} you
                <Chevron />
              </button>
            ) : (
              <span className="ui-agtc__sum-wait">
                {waiting} {waiting === 1 ? "needs" : "need"} you
              </span>
            )
          ) : null}
          {failed > 0 ? (
            onResolve ? (
              <button
                type="button"
                className="ui-agtc__sum-btn"
                data-kind="failed"
                aria-expanded={open === "failed"}
                aria-haspopup="dialog"
                onClick={() => setOpen(open === "failed" ? null : "failed")}
              >
                {failed} failed
                <Chevron />
              </button>
            ) : (
              <span className="ui-agtc__sum-fail">{failed} failed</span>
            )
          ) : null}
          <span className="ui-agtc__sum-cost">
            <span className="ui-agtc__amount" data-live={running > 0 ? "" : undefined}>
              {formatCost(branchCost(tree))}
            </span>
          </span>
        </span>

        {open ? (
          <div
            className="ui-agtc__pop"
            role="dialog"
            aria-label={open === "waiting" ? "Agents that need you" : "Agents that failed"}
          >
            {list.map((node) => (
              <div className="ui-agtc__pop-item" key={node.id}>
                <div className="ui-agtc__pop-head">
                  <span className="ui-agtc__status" data-status={node.status}>
                    <StatusMark status={node.status} />
                  </span>
                  <span className="ui-agtc__pop-name">{node.name}</span>
                  <span className="ui-agtc__pop-task">{node.task}</span>
                </div>
                <p className="ui-agtc__pop-text">{open === "waiting" ? node.ask : node.error}</p>
                {onResolve ? (
                  <div className="ui-agtc__pop-actions">
                    <button
                      type="button"
                      className="ui-agtc__btn"
                      onClick={() => answer(node, open === "waiting" ? "reject" : "dismiss")}
                    >
                      {open === "waiting" ? "Not yet" : "Dismiss"}
                    </button>
                    <button
                      type="button"
                      className="ui-agtc__btn ui-agtc__btn--primary"
                      onClick={() => answer(node, open === "waiting" ? "approve" : "retry")}
                    >
                      {open === "waiting" ? "Approve" : "Retry"}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </header>

      <div
        className="ui-agtc__tree"
        role="tree"
        aria-label={title}
        style={{ "--ui-agtc-depth": depth } as CSSProperties}
        ref={treeRef}
      >
        <svg
          className="ui-agtc__links"
          width={size.w}
          height={size.h}
          aria-hidden="true"
        >
          {wires.map((wire) => (
            <g
              key={wire.key}
              data-muted={wire.muted ? "" : undefined}
              data-fresh={fresh.includes(wire.key) ? "" : undefined}
            >
              <path
                d={wire.d}
                pathLength={1}
                className="ui-agtc__link"
                style={{ animationDelay: "0ms" }}
              />
            </g>
          ))}
        </svg>

        <div
          className="ui-agtc__root"
          role="treeitem"
          aria-label={`${tree.name}: ${STATUS_LABEL[tree.status]}`}
          aria-expanded={(tree.children ?? []).length > 0 ? roots.length > 0 : undefined}
        >
          {card(tree, 0)}
        </div>

        {roots.length > 0 ? (
          <div className="ui-agtc__level" role="group">
            {roots.map((node) => branchOf(node, 1))}
          </div>
        ) : null}

        <svg
          className="ui-agtc__links ui-agtc__dots"
          width={size.w}
          height={size.h}
          aria-hidden="true"
        >
          {dots.map((dot) => (
            <circle
              key={dot.key}
              cx={dot.cx}
              cy={dot.cy}
              r={DOT_R}
              className="ui-agtc__dot"
              data-muted={dot.muted ? "" : undefined}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

/* Status glyphs – the spinning ring of a running agent, and a mark for every settled state */

function Spinner() {
  return (
    <svg
      className="ui-agtc__spin"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path
        d="M12 3.5A8.5 8.5 0 0 1 20.5 12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.5"
      />
    </svg>
  );
}

function StatusMark({ status }: { status: AgentTreeStatus }) {
  if (status === "done") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5.5 12.6 9.9 17l8.6-9.6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
      </svg>
    );
  }
  if (status === "failed") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" />
      </svg>
    );
  }
  if (status === "stopped") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 7.5v9M15 7.5v9" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" />
      </svg>
    );
  }
  if (status === "waiting") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
        <path d="M12 7.6V12l3 2" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" strokeDasharray="2.6 3" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function Spark() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M7 1.2c.4 2.9 1.9 4.4 4.8 4.8-2.9.4-4.4 1.9-4.8 4.8C6.6 7.9 5.1 6.4 2.2 6 5.1 5.6 6.6 4.1 7 1.2Z"
        fill="currentColor"
      />
      <circle cx="11.6" cy="11.4" r="1.1" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

/* The marks – the orchestrator's own logo on its tile, and the apps an agent works in */

function ClaudeMark() {
  return (
    <svg viewBox="0 0 1200 1200" aria-hidden="true">
      <path
        fill="#D97757"
        d="M 233.959793 800.214905 L 468.644287 668.536987 L 472.590637 657.100647 L 468.644287 650.738403 L 457.208069 650.738403 L 417.986633 648.322144 L 283.892639 644.69812 L 167.597321 639.865845 L 54.926208 633.825623 L 26.577238 627.785339 L 3.3e-05 592.751709 L 2.73832 575.27533 L 26.577238 559.248352 L 60.724873 562.228149 L 136.187973 567.382629 L 249.422867 575.194763 L 331.570496 580.026978 L 453.261841 592.671082 L 472.590637 592.671082 L 475.328857 584.859009 L 468.724915 580.026978 L 463.570557 575.194763 L 346.389313 495.785217 L 219.543671 411.865906 L 153.100723 363.543762 L 117.181267 339.060425 L 99.060455 316.107361 L 91.248367 266.01355 L 123.865784 230.093994 L 167.677887 233.073853 L 178.872513 236.053772 L 223.248367 270.201477 L 318.040283 343.570496 L 441.825592 434.738342 L 459.946411 449.798706 L 467.194672 444.64447 L 468.080597 441.020203 L 459.946411 427.409485 L 392.617493 305.718323 L 320.778564 181.932983 L 288.80542 130.630859 L 280.348999 99.865845 C 277.369171 87.221436 275.194641 76.590698 275.194641 63.624268 L 312.322174 13.20813 L 332.8591 6.604126 L 382.389313 13.20813 L 403.248352 31.328979 L 434.013519 101.71814 L 483.865753 212.537048 L 561.181274 363.221497 L 583.812134 407.919434 L 595.892639 449.315491 L 600.40271 461.959839 L 608.214783 461.959839 L 608.214783 454.711609 L 614.577271 369.825623 L 626.335632 265.61084 L 637.771851 131.516846 L 641.718201 93.745117 L 660.402832 48.483276 L 697.530334 24.000122 L 726.52356 37.852417 L 750.362549 72 L 747.060486 94.067139 L 732.886047 186.201416 L 705.100708 330.52356 L 686.979919 427.167847 L 697.530334 427.167847 L 709.61084 415.087341 L 758.496704 350.174561 L 840.644348 247.490051 L 876.885925 206.738342 L 919.167847 161.71814 L 946.308838 140.29541 L 997.61084 140.29541 L 1035.38269 196.429626 L 1018.469849 254.416199 L 965.637634 321.422852 L 921.825562 378.201538 L 859.006714 462.765259 L 819.785278 530.41626 L 823.409424 535.812073 L 832.75177 534.92627 L 974.657776 504.724915 L 1051.328979 490.872559 L 1142.818848 475.167786 L 1184.214844 494.496582 L 1188.724854 514.147644 L 1172.456421 554.335693 L 1074.604126 578.496765 L 959.838989 601.449829 L 788.939636 641.879272 L 786.845764 643.409485 L 789.261841 646.389343 L 866.255127 653.637634 L 899.194702 655.409424 L 979.812134 655.409424 L 1129.932861 666.604187 L 1169.154419 692.537109 L 1192.671265 724.268677 L 1188.724854 748.429688 L 1128.322144 779.194641 L 1046.818848 759.865845 L 856.590759 714.604126 L 791.355774 698.335754 L 782.335693 698.335754 L 782.335693 703.731567 L 836.69812 756.885986 L 936.322205 846.845581 L 1061.073975 962.81897 L 1067.436279 991.490112 L 1051.409424 1014.120911 L 1034.496704 1011.704712 L 924.885986 929.234924 L 882.604126 892.107544 L 786.845764 811.48999 L 780.483276 811.48999 L 780.483276 819.946289 L 802.550415 852.241699 L 919.087341 1027.409424 L 925.127625 1081.127686 L 916.671204 1098.604126 L 886.469849 1109.154419 L 853.288696 1103.114136 L 785.073914 1007.355835 L 714.684631 899.516785 L 657.906067 802.872498 L 650.979858 806.81897 L 617.476624 1167.704834 L 601.771851 1186.147705 L 565.530212 1200 L 535.328857 1177.046997 L 519.302124 1139.919556 L 535.328857 1066.550537 L 554.657776 970.792053 L 570.362488 894.68457 L 584.536926 800.134277 L 592.993347 768.724976 L 592.429626 766.630859 L 585.503479 767.516968 L 514.22821 865.369263 L 405.825531 1011.865906 L 320.053711 1103.677979 L 299.516815 1111.812256 L 263.919525 1093.369263 L 267.221497 1060.429688 L 287.114136 1031.114136 L 405.825531 880.107361 L 477.422913 786.52356 L 523.651062 732.483276 L 523.328918 724.671265 L 520.590698 724.671265 L 205.288605 929.395935 L 149.154434 936.644409 L 124.993355 914.01355 L 127.973183 876.885986 L 139.409409 864.80542 L 234.201385 799.570435 L 233.879227 799.8927 Z"
      />
    </svg>
  );
}

function OpenAiMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ color: "var(--ui-agtc-strong, var(--ui-agt-ink, #000))" }}
    >
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

function GeminiMark() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={uid} x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1C7DFF" />
          <stop offset="0.52" stopColor="#1C69FF" />
          <stop offset="1" stopColor="#B04DFF" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${uid})`}
        d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"
      />
    </svg>
  );
}

function SlackMark() {
  return (
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
}

function NotionMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ color: "var(--ui-agtc-strong, var(--ui-agt-ink, #000))" }}
    >
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ color: "var(--ui-agtc-strong, var(--ui-agt-ink, #181717))" }}
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
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

const MARKS: Record<AgentTreeMark, ReactNode> = {
  claude: <ClaudeMark />,
  gemini: <GeminiMark />,
  openai: <OpenAiMark />,
};

const TOOLS: Record<AgentTreeTool, ReactNode> = {
  slack: <SlackMark />,
  notion: <NotionMark />,
  github: <GitHubMark />,
  figma: <FigmaMark />,
};

const css = /* css */ `
.ui-agtc{--ui-agtc-card: #fffdfb;--ui-agtc-strong: #0b0908;--ui-agtc-ink: rgba(11, 9, 8, 0.88);--ui-agtc-text: rgba(11, 9, 8, 0.61);--ui-agtc-muted: rgba(11, 9, 8, 0.45);--ui-agtc-faint: rgba(11, 9, 8, 0.27);--ui-agtc-line: rgba(11, 9, 8, 0.06);--ui-agtc-fill: rgba(11, 9, 8, 0.06);--ui-agtc-accent: rgba(217, 84, 31, 0.765);--ui-agtc-link: #ff8a5c;--ui-agtc-link-muted: rgba(11, 9, 8, 0.12);--ui-agtc-brand-bg: #ff6b3519;--ui-agtc-brand-fg: #d9541ff2;--ui-agtc-ok-bg: #1a7a4a19;--ui-agtc-ok-fg: #1a7a4ae0;--ui-agtc-warn-bg: #d9953029;--ui-agtc-warn-fg: #d9541f;--ui-agtc-danger-bg: #b3261e18;--ui-agtc-danger-fg: #b3261eda;--ui-agtc-focus: rgba(217, 84, 31, 0.35);--ui-agtc-solid: rgba(11, 9, 8, 0.88);--ui-agtc-on-solid: #fcf9f7;--ui-agtc-pop: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 12px 28px -10px rgba(11, 9, 8, 0.18), 0 1px 2px rgba(11, 9, 8, 0.05);--ui-agtc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-agtc-card-w: 216px;--ui-agtc-indent: 32px;--ui-agtc-shine: rgba(11, 9, 8, 0.22);--ui-agtc-ease: cubic-bezier(0.32, 0.72, 0.24, 1);position: relative;box-sizing: border-box;width: 100%;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;font-weight: 400;line-height: 20px;color: var(--ui-agtc-text);text-align: left;-webkit-font-smoothing: antialiased}
.ui-agtc *, .ui-agtc *::before, .ui-agtc *::after{box-sizing: border-box}
:where(.ui-agtc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;text-align: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-agtc button:focus-visible{outline: 2px solid var(--ui-agtc-focus);outline-offset: 1px}
.ui-agtc p{margin: 0}
.ui-agtc svg{display: block;flex: none}
.ui-agtc__bar{position: relative;z-index: 3;display: flex;align-items: center;gap: 8px;min-width: 0;margin-bottom: 16px}
.ui-agtc__spark{display: grid;flex: none;place-items: center;width: 16px;color: var(--ui-agtc-accent)}
.ui-agtc__title{flex: none;font-weight: 500;color: var(--ui-agtc-strong)}
.ui-agtc__sum{display: flex;flex-wrap: wrap;justify-content: flex-end;align-items: center;gap: 4px 10px;margin-left: auto;font-size: 12px;line-height: 16px;color: var(--ui-agtc-muted);font-variant-numeric: tabular-nums}
.ui-agtc__sum-run{color: var(--ui-agtc-brand-fg)}
.ui-agtc__sum-wait{color: var(--ui-agtc-warn-fg)}
.ui-agtc__sum-fail{color: var(--ui-agtc-danger-fg)}
.ui-agtc__sum-cost{min-width: 44px;color: var(--ui-agtc-ink);font-weight: 500;text-align: right}
.ui-agtc__sum-btn{display: inline-flex;align-items: center;gap: 2px;height: 22px;margin: -3px 0;padding: 0 4px 0 7px;border-radius: 5px;font-size: 12px;font-weight: 500;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agtc__sum-btn[data-kind="waiting"]{background: var(--ui-agtc-warn-bg);color: var(--ui-agtc-warn-fg)}
.ui-agtc__sum-btn[data-kind="failed"]{background: var(--ui-agtc-danger-bg);color: var(--ui-agtc-danger-fg)}
.ui-agtc__sum-btn:hover{filter: saturate(1.3) brightness(0.97)}
.ui-agtc__sum-btn > svg{transition: transform var(--nm-dur-3, 240ms) var(--ui-agtc-ease)}
.ui-agtc__sum-btn[aria-expanded="true"] > svg{transform: rotate(180deg)}
.ui-agtc__pop{position: absolute;top: calc(100% + 8px);right: 0;z-index: 5;display: grid;gap: 4px;width: 300px;max-width: 100%;padding: 6px;border-radius: 10px;background: var(--ui-agtc-card);box-shadow: var(--ui-agtc-pop);animation: ui-agtc-pop var(--nm-dur-2, 160ms) var(--ui-agtc-ease) both}
.ui-agtc__pop-item{display: grid;gap: 4px;padding: 8px 8px 8px;border-radius: 7px}
.ui-agtc__pop-item + .ui-agtc__pop-item{border-top: 0.5px solid var(--ui-agtc-line);border-radius: 0 0 7px 7px}
.ui-agtc__pop-head{display: flex;align-items: center;gap: 8px;min-width: 0}
.ui-agtc__pop-head .ui-agtc__status{width: 20px;padding: 0;justify-content: center}
.ui-agtc__pop-name{flex: none;font-weight: 500;color: var(--ui-agtc-strong)}
.ui-agtc__pop-task{min-width: 0;overflow: hidden;font-size: 12px;color: var(--ui-agtc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-agtc__pop-text{padding-left: 28px;font-size: 12px;line-height: 16px;color: var(--ui-agtc-text)}
.ui-agtc__pop-actions{display: flex;justify-content: flex-end;gap: 6px;margin-top: 4px}
.ui-agtc__btn{display: inline-flex;align-items: center;height: 28px;padding: 0 10px;border-radius: 6px;background: var(--ui-agtc-card);box-shadow: var(--ui-agtc-shadow);font-size: 13px;font-weight: 500;color: var(--ui-agtc-ink);transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agtc__btn:hover{background: var(--ui-agtc-fill)}
.ui-agtc__btn--primary{background: var(--ui-agtc-solid);box-shadow: none;color: var(--ui-agtc-on-solid)}
.ui-agtc__btn--primary:hover{background: var(--ui-agtc-solid);opacity: 0.88}
.ui-agtc__tree{position: relative;display: grid;justify-items: center}
.ui-agtc__links{position: absolute;top: 0;left: 0;overflow: visible;pointer-events: none}
.ui-agtc__link{fill: none;stroke: var(--ui-agtc-link);stroke-width: 1.5;stroke-linecap: round;transition: stroke 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agtc__links [data-muted] .ui-agtc__link{stroke: var(--ui-agtc-link-muted)}
.ui-agtc__links [data-fresh] .ui-agtc__link{stroke-dasharray: 1 1;stroke-dashoffset: 1;animation: ui-agtc-draw var(--nm-dur-4, 380ms) var(--ui-agtc-ease) both}
.ui-agtc__dots{z-index: 2}
.ui-agtc__dot{fill: var(--ui-agtc-card);stroke: var(--ui-agtc-link);stroke-width: 1.5;transition: stroke 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agtc__dot[data-muted]{stroke: var(--ui-agtc-link-muted)}
.ui-agtc__root{position: relative;z-index: 1}
.ui-agtc__level{position: relative;z-index: 1;display: flex;align-items: flex-start;justify-content: center;gap: 8px;width: 100%;margin-top: 40px}
.ui-agtc__level > .ui-agtc__hang{flex: none;width: calc(var(--ui-agtc-card-w) + var(--ui-agtc-indent))}
.ui-agtc[data-wide] .ui-agtc__root:has(+ .ui-agtc__level){margin-right: var(--ui-agtc-indent)}
.ui-agtc__hang{display: grid;align-content: start;gap: 12px}
.ui-agtc__below{display: grid;gap: 12px;padding-left: var(--ui-agtc-indent)}
.ui-agtc:not([data-wide]) .ui-agtc__tree{justify-items: stretch}
.ui-agtc:not([data-wide]) .ui-agtc__tree{container-type: inline-size}
.ui-agtc__node{width: var(--ui-agtc-card-w)}
.ui-agtc:not([data-wide]) .ui-agtc__node{width: calc(100cqw - var(--ui-agtc-depth, 0) * var(--ui-agtc-indent))}
.ui-agtc:not([data-wide]) .ui-agtc__level{display: grid;gap: 12px;margin-top: 12px;padding-left: var(--ui-agtc-indent)}
.ui-agtc:not([data-wide]) .ui-agtc__level{justify-content: stretch}
.ui-agtc:not([data-wide]) .ui-agtc__level > .ui-agtc__hang{width: auto}
.ui-agtc__node{position: relative;display: grid;gap: 6px;padding: 10px 10px 8px;border-radius: 8px;background: var(--ui-agtc-card);box-shadow: var(--ui-agtc-shadow);animation: ui-agtc-rise var(--nm-dur-4, 380ms) var(--ui-agtc-ease) both;transition: box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agtc__node[data-leaving]{animation: ui-agtc-leave var(--nm-dur-3, 240ms) var(--ui-agtc-ease) forwards;pointer-events: none}
.ui-agtc__links [data-leaving] .ui-agtc__link{stroke-dasharray: 1 1;stroke-dashoffset: 0;animation: ui-agtc-retract var(--nm-dur-3, 240ms) var(--ui-agtc-ease) forwards}
.ui-agtc__dot[data-leaving]{animation: ui-agtc-fade var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) forwards}
.ui-agtc__node[data-clickable]{cursor: pointer}
.ui-agtc__node:focus-visible{outline: 2px solid var(--ui-agtc-focus);outline-offset: 2px}
.ui-agtc__node[data-clickable]:hover{box-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.1), 0 2px 6px -2px rgba(11, 9, 8, 0.12)}
.ui-agtc__node[data-status="queued"], .ui-agtc__node[data-status="stopped"]{opacity: 0.6}
.ui-agtc__top{display: flex;align-items: center;gap: 8px;min-width: 0}
.ui-agtc__avatar{display: grid;flex: none;place-items: center;width: 22px;height: 22px;border-radius: 6px;background: var(--ui-agtc-card);box-shadow: var(--ui-agtc-shadow);font-size: 10px;font-weight: 500;color: var(--ui-agtc-text)}
.ui-agtc__avatar[data-logo] > svg{width: 13px;height: 13px}
.ui-agtc__who{display: grid;flex: 1;min-width: 0}
.ui-agtc__name{overflow: hidden;font-weight: 500;line-height: 16px;color: var(--ui-agtc-strong);white-space: nowrap;text-overflow: ellipsis}
.ui-agtc__tools{display: inline-flex;margin-right: 6px;vertical-align: top}
.ui-agtc__tool{display: grid;flex: none;place-items: center;width: 16px;height: 16px;border-radius: 4px;background: var(--ui-agtc-card);box-shadow: var(--ui-agtc-shadow)}
.ui-agtc__tool + .ui-agtc__tool{margin-left: -4px}
.ui-agtc__tool > svg{width: 10px;height: 10px}
.ui-agtc__model{overflow: hidden;font-size: 11px;line-height: 14px;color: var(--ui-agtc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-agtc__status{display: inline-flex;flex: none;align-self: start;align-items: center;gap: 4px;height: 18px;padding: 0 6px 0 4px;border-radius: 4px;background: var(--ui-agtc-fill);font-size: 11px;font-weight: 500;line-height: 16px;color: var(--ui-agtc-text);white-space: nowrap}
.ui-agtc__status[data-status="running"]{background: var(--ui-agtc-brand-bg);color: var(--ui-agtc-brand-fg)}
.ui-agtc__spin{animation: ui-agtc-spin var(--nm-dur-6, 1100ms) linear infinite}
.ui-agtc__status[data-status="waiting"]{background: var(--ui-agtc-warn-bg);color: var(--ui-agtc-warn-fg)}
.ui-agtc__status[data-status="done"]{background: var(--ui-agtc-ok-bg);color: var(--ui-agtc-ok-fg)}
.ui-agtc__status[data-status="failed"]{background: var(--ui-agtc-danger-bg);color: var(--ui-agtc-danger-fg)}
.ui-agtc__task{display: -webkit-box;overflow: hidden;margin: -2px -2px -3px !important;padding: 2px 2px 3px;font-size: 12px;line-height: 16px;color: var(--ui-agtc-text);-webkit-line-clamp: 2;-webkit-box-orient: vertical}
.ui-agtc__meta{display: flex;align-items: center;gap: 6px;min-height: 20px}
.ui-agtc__cost{flex: 1;min-width: 0;overflow: hidden;font-size: 11px;font-weight: 500;line-height: 16px;color: var(--ui-agtc-ink);white-space: nowrap;text-overflow: ellipsis;font-variant-numeric: tabular-nums}
.ui-agtc__amount[data-live]{background: linear-gradient(90deg, currentColor 0%, currentColor 38%, var(--ui-agtc-shine) 50%, currentColor 62%, currentColor 100%) 0 0 / 300% 100%;-webkit-background-clip: text;background-clip: text;-webkit-text-fill-color: transparent;animation: ui-agtc-shine 1100ms linear infinite}
.ui-agtc__time{font-weight: 400;color: var(--ui-agtc-muted)}
.ui-agtc__fold{display: inline-flex;flex: none;align-items: center;gap: 2px;height: 20px;padding: 0 4px 0 6px;border-radius: 5px;font-size: 11px;font-weight: 500;color: var(--ui-agtc-muted);font-variant-numeric: tabular-nums;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agtc__fold:hover{background: var(--ui-agtc-fill);color: var(--ui-agtc-ink)}
.ui-agtc__fold > svg{transition: transform var(--nm-dur-3, 240ms) var(--ui-agtc-ease)}
.ui-agtc__fold[aria-expanded="false"] > svg{transform: rotate(-90deg)}
@keyframes ui-agtc-shine{from{background-position: 100% 0}
to{background-position: 0 0}
}
@keyframes ui-agtc-draw{to{stroke-dashoffset: 0}
}
@keyframes ui-agtc-retract{to{stroke-dashoffset: 1}
}
@keyframes ui-agtc-leave{to{opacity: 0;transform: translateY(4px) scale(0.97)}
}
@keyframes ui-agtc-fade{to{opacity: 0}
}
@keyframes ui-agtc-rise{from{opacity: 0;transform: translateY(6px) scale(0.98)}
}
@keyframes ui-agtc-spin{to{transform: rotate(360deg)}
}
@keyframes ui-agtc-pop{from{opacity: 0;transform: translateY(-4px) scale(0.98)}
}
@media (pointer: coarse){.ui-agtc__fold{height: 32px;padding: 0 8px 0 10px}
}
@media (prefers-reduced-motion: reduce){.ui-agtc *, .ui-agtc *::before, .ui-agtc *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-agtc{--ui-agtc-shine: rgba(255, 253, 251, 0.35);--ui-agtc-card: #211b16;--ui-agtc-strong: #fffdfb;--ui-agtc-ink: rgba(255, 253, 251, 0.9);--ui-agtc-text: rgba(255, 253, 251, 0.62);--ui-agtc-muted: rgba(255, 253, 251, 0.45);--ui-agtc-faint: rgba(255, 253, 251, 0.28);--ui-agtc-line: rgba(255, 253, 251, 0.08);--ui-agtc-fill: rgba(255, 253, 251, 0.08);--ui-agtc-accent: #ff8a5c;--ui-agtc-link: #ff6b35;--ui-agtc-link-muted: rgba(255, 253, 251, 0.14);--ui-agtc-brand-bg: #ff6b353a;--ui-agtc-brand-fg: #ff8a5c;--ui-agtc-ok-bg: #2f8d5c1f;--ui-agtc-ok-fg: #2f8d5c;--ui-agtc-warn-bg: #ff6b3525;--ui-agtc-warn-fg: #ff8a5c;--ui-agtc-danger-bg: #e2544a2b;--ui-agtc-danger-fg: #e2544a;--ui-agtc-focus: rgba(255, 138, 92, 0.45);--ui-agtc-solid: rgba(255, 253, 251, 0.92);--ui-agtc-on-solid: #1a1512;--ui-agtc-pop: 0 0 0 0.5px rgba(255, 253, 251, 0.12), 0 12px 28px -10px rgba(11, 9, 8, 0.6);--ui-agtc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4)}

`;
