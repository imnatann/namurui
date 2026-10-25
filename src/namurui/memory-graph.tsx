"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";

/*
 * Memory Graph: what an agent remembers, drawn as typed nodes and labelled relations.
 * Positions are computed from the data alone, in rings around the busiest entity, so the same
 * memories always draw the same picture. Choosing a node recedes everything it does not touch,
 * writes the relation names onto its edges and opens an inspector in the rail. Arrow keys walk
 * the nodes, so the graph is usable without a pointer.
 * The styles are injected below, so no extra files are needed.
 */

export type MemoryNodeKind = "fact" | "preference" | "entity" | "task";

export type MemoryNode = {
  /** Stable id, also the tie breaker in the layout */
  id: string;
  /** What the agent remembers, e.g. "Wants short answers first" */
  label: string;
  /** Shapes the glyph and the legend, and the inspector's type line */
  kind: MemoryNodeKind;
  /** 0 to 1, shown as a percentage; omit it when the memory was never scored */
  confidence?: number;
  /** Shown as given, e.g. "Oct 12" or "2 days ago" */
  learnedAt?: string;
  /** One or two sentences for the inspector */
  note?: string;
};

export type MemoryLink = {
  /** Id of the node the relation starts at */
  from: string;
  /** Id of the node the relation points at */
  to: string;
  /** The relation, read from `from` to `to`, e.g. "works at" */
  relation: string;
};

export type MemoryGraphProps = {
  /** The remembered entities */
  nodes: MemoryNode[];
  /** Relations between them; links to unknown ids are ignored */
  links?: MemoryLink[];
  /** Selected node id, controlled; `null` means nothing is selected */
  selectedId?: string | null;
  /** Called with the chosen id, or `null` when the selection is cleared */
  onSelect?: (id: string | null) => void;
  /** Heading of the card */
  title?: string;
  /** Extra class on the root */
  className?: string;
};

const KIND_ORDER: MemoryNodeKind[] = ["fact", "preference", "entity", "task"];

const kindLabel: Record<MemoryNodeKind, string> = {
  fact: "Fact",
  preference: "Preference",
  entity: "Entity",
  task: "Task",
};

const EMPTY_LINKS: MemoryLink[] = [];

/* ---------- geometry ---------- */

type Point = { x: number; y: number };

type Placed = { node: MemoryNode; x: number; y: number };

type RawEdge = { key: string; from: string; to: string; relation: string };

type EdgeView = RawEdge & { d: string; mx: number; my: number };

type LinkView = { key: string; other: string; relation: string; outgoing: boolean };

type Graph = {
  points: Placed[];
  edges: EdgeView[];
  byId: Map<string, Placed>;
  linksByNode: Map<string, LinkView[]>;
  kindCounts: Map<MemoryNodeKind, number>;
};

/** Stage proportions: x is divided by this so a radius reads as a circle in a wide card */
const ASPECT = 1.25;

/** The chord aimed for between two neighbours at the same depth, in stage heights */
const SPACING = 0.21;

/** The smallest radial gap between one depth and the next */
const RADIAL_STEP = 0.14;

/** How far the outermost depth may reach from the centre */
const MAX_RADIUS = 0.4;

/** The gap the root keeps from its immediate children, whatever the fan-out */
const ROOT_CLEARANCE = 0.18;

/**
 * Places every node on a radial tree: the busiest entity at the centre, its neighbours on a
 * ring around it, their neighbours on the next ring inside their parent's share of the circle.
 * Nothing here is random or iterative, and nothing is measured, so the same nodes and links
 * produce the same coordinates on every render and every mount.
 */
function layout(nodes: MemoryNode[], links: MemoryLink[]): Graph {
  const ordered = [...nodes]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .filter((node, index, list) => index === 0 || list[index - 1].id !== node.id);

  const kindCounts = new Map<MemoryNodeKind, number>();
  for (const node of ordered) kindCounts.set(node.kind, (kindCounts.get(node.kind) ?? 0) + 1);

  const known = new Map<string, MemoryNode>();
  for (const node of ordered) known.set(node.id, node);

  const neighbours = new Map<string, Set<string>>();
  for (const node of ordered) neighbours.set(node.id, new Set());

  const rawEdges: RawEdge[] = [];
  const seenEdge = new Set<string>();
  for (const link of links) {
    if (link.from === link.to || !known.has(link.from) || !known.has(link.to)) continue;
    const key = `${link.from}|${link.to}|${link.relation}`;
    if (seenEdge.has(key)) continue;
    seenEdge.add(key);
    neighbours.get(link.from)?.add(link.to);
    neighbours.get(link.to)?.add(link.from);
    rawEdges.push({ key, from: link.from, to: link.to, relation: link.relation });
  }

  /* The centre is the busiest entity; a tie goes to the lower id, because `ordered` is sorted. */
  let rootId: string | undefined;
  let bestDegree = -1;
  for (const node of ordered) {
    const degree = neighbours.get(node.id)?.size ?? 0;
    if (degree > bestDegree) {
      bestDegree = degree;
      rootId = node.id;
    }
  }

  const positions = new Map<string, Point>();
  const children = new Map<string, string[]>();
  for (const node of ordered) children.set(node.id, []);

  if (rootId !== undefined) {
    /* Breadth first, visiting neighbours in id order, so the tree is a function of the data. */
    const order: string[] = [rootId];
    const visited = new Set<string>([rootId]);
    for (let head = 0; head < order.length; head += 1) {
      const id = order[head];
      for (const next of [...(neighbours.get(id) ?? [])].sort()) {
        if (visited.has(next)) continue;
        visited.add(next);
        children.get(id)?.push(next);
        order.push(next);
      }
    }

    /* Leaves, counted from the bottom of the queue up: the share of the circle a branch earns. */
    const leaves = new Map<string, number>();
    for (let index = order.length - 1; index >= 0; index -= 1) {
      const id = order[index];
      const kids = children.get(id) ?? [];
      let total = 0;
      for (const kid of kids) total += leaves.get(kid) ?? 1;
      leaves.set(id, Math.max(total, 1));
    }

    /* Pass one: each node's depth and the wedge of the circle it owns. No positions yet. */
    const depthOf = new Map<string, number>([[rootId, 0]]);
    const widest = [0];
    const wedges: { id: string; share: number }[] = [{ id: rootId, share: Math.PI * 2 }];
    while (wedges.length > 0) {
      const { id, share } = wedges.pop() as { id: string; share: number };
      const kids = children.get(id) ?? [];
      if (kids.length === 0) continue;
      const total = leaves.get(id) ?? 1;
      for (const kid of kids) {
        const kidShare = (share * (leaves.get(kid) ?? 1)) / total;
        const depth = (depthOf.get(id) ?? 0) + 1;
        depthOf.set(kid, depth);
        widest[depth] = Math.max(widest[depth] ?? 0, kidShare);
        wedges.push({ id: kid, share: kidShare });
      }
    }

    /* Radii follow the widest wedge at each depth, so a crowded ring is pushed out. */
    const radii = [0];
    for (let depth = 1; depth < widest.length; depth += 1) {
      const share = Math.min(Math.PI, Math.max(widest[depth] ?? 0, 0.2));
      const needed = SPACING / (2 * Math.sin(share / 2));
      radii[depth] = Math.min(
        MAX_RADIUS,
        Math.max(radii[depth - 1] + RADIAL_STEP, depth === 1 ? Math.max(needed, ROOT_CLEARANCE) : needed),
      );
    }

    /* Pass two: angles. A child sits at the centre of its wedge, unless it is an only child, in
     * which case it steps to one side so a chain zigzags instead of stacking on one spoke. */
    positions.set(rootId, { x: 0.5, y: 0.5 });
    const spokes: { id: string; start: number; share: number }[] = [
      { id: rootId, start: -Math.PI / 2, share: Math.PI * 2 },
    ];
    while (spokes.length > 0) {
      const { id, start, share } = spokes.pop() as { id: string; start: number; share: number };
      const kids = children.get(id) ?? [];
      if (kids.length === 0) continue;
      const total = leaves.get(id) ?? 1;
      let cursor = start;
      for (const kid of kids) {
        const kidShare = (share * (leaves.get(kid) ?? 1)) / total;
        const depth = depthOf.get(kid) ?? 1;
        const radius = radii[Math.min(depth, radii.length - 1)];
        const angle =
          kids.length === 1
            ? cursor + kidShare * (depth % 2 === 0 ? 0.18 : 0.82)
            : cursor + kidShare / 2;
        positions.set(kid, {
          x: 0.5 + (radius * Math.cos(angle)) / ASPECT,
          y: 0.5 + radius * Math.sin(angle),
        });
        spokes.push({ id: kid, start: cursor, share: kidShare });
        cursor += kidShare;
      }
    }
  }

  /* Entities with no relations at all still have to be somewhere: the outer ring, in id order. */
  const orphans = ordered.map((node) => node.id).filter((id) => !positions.has(id));
  orphans.forEach((id, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(orphans.length, 1);
    positions.set(id, {
      x: 0.5 + (MAX_RADIUS * Math.cos(angle)) / ASPECT,
      y: 0.5 + MAX_RADIUS * Math.sin(angle),
    });
  });

  const points: Placed[] = [];
  if (rootId !== undefined) {
    const node = known.get(rootId);
    const point = positions.get(rootId);
    if (node && point) points.push({ node, x: point.x, y: point.y });
  }
  for (const node of ordered) {
    if (node.id === rootId) continue;
    const point = positions.get(node.id);
    if (point) points.push({ node, x: point.x, y: point.y });
  }

  const byId = new Map<string, Placed>();
  for (const point of points) byId.set(point.node.id, point);

  const edges: EdgeView[] = [];
  const linksByNode = new Map<string, LinkView[]>();
  for (const edge of rawEdges) {
    const a = byId.get(edge.from);
    const b = byId.get(edge.to);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const cx = (a.x + b.x) / 2 - dy * 0.14;
    const cy = (a.y + b.y) / 2 + dx * 0.14;
    edges.push({
      key: edge.key,
      from: edge.from,
      to: edge.to,
      relation: edge.relation,
      d: `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`,
      mx: a.x * 0.25 + cx * 0.5 + b.x * 0.25,
      my: a.y * 0.25 + cy * 0.5 + b.y * 0.25,
    });

    const forward = linksByNode.get(edge.from);
    const forwardRow: LinkView = { key: edge.key, other: edge.to, relation: edge.relation, outgoing: true };
    if (forward) forward.push(forwardRow);
    else linksByNode.set(edge.from, [forwardRow]);

    const back = linksByNode.get(edge.to);
    const backRow: LinkView = { key: edge.key, other: edge.from, relation: edge.relation, outgoing: false };
    if (back) back.push(backRow);
    else linksByNode.set(edge.to, [backRow]);
  }

  for (const rows of linksByNode.values()) {
    rows.sort((a, b) => {
      if (a.relation !== b.relation) return a.relation < b.relation ? -1 : 1;
      return a.other < b.other ? -1 : 1;
    });
  }

  return { points, edges, byId, linksByNode, kindCounts };
}

/* ---------- keyboard ---------- */

type Direction = "left" | "right" | "up" | "down";

const DIRECTION_BY_KEY: Record<string, Direction | undefined> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

/**
 * The nearest node in a direction, measured in stage proportions so a wide card does not make
 * sideways moves feel further than vertical ones.
 */
function nextInDirection(from: Placed, direction: Direction, points: Placed[]): Placed | undefined {
  const ax = direction === "left" ? -1 : direction === "right" ? 1 : 0;
  const ay = direction === "up" ? -1 : direction === "down" ? 1 : 0;
  let best: Placed | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const point of points) {
    if (point.node.id === from.node.id) continue;
    /* Both axes in stage heights, so a sideways step is judged by real distance, not by fraction. */
    const dx = (point.x - from.x) * ASPECT;
    const dy = point.y - from.y;
    const along = dx * ax + dy * ay;
    if (along <= 0.012) continue;
    const across = Math.abs(dx * ay - dy * ax);
    const score = along + across * 2.4;
    if (score < bestScore) {
      bestScore = score;
      best = point;
    }
  }
  return best;
}

/* ---------- component ---------- */

export function MemoryGraph({
  nodes,
  links = EMPTY_LINKS,
  selectedId,
  onSelect,
  title = "Memory graph",
  className,
}: MemoryGraphProps) {
  const graph = useMemo(() => layout(nodes, links), [nodes, links]);
  const [picked, setPicked] = useState<string | null>(null);
  const [hiddenKinds, setHiddenKinds] = useState<MemoryNodeKind[]>([]);
  const [roving, setRoving] = useState<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement | null>());

  const controlled = selectedId !== undefined;
  const activeId = controlled ? selectedId : picked;
  const selected = activeId ? graph.byId.get(activeId) : undefined;
  const selectedNode = selected?.node;

  const near = useMemo(() => {
    const ids = new Set<string>();
    if (!selectedNode) return ids;
    ids.add(selectedNode.id);
    for (const link of graph.linksByNode.get(selectedNode.id) ?? []) ids.add(link.other);
    return ids;
  }, [graph, selectedNode]);

  const rows = selectedNode ? graph.linksByNode.get(selectedNode.id) ?? [] : [];
  /* A kind switched off in the legend is dimmed to a hint, so it leaves the keyboard ring too.
   * If every kind is off the ring falls back to all of them, so the graph never traps the tab. */
  const walkable = graph.points.filter((point) => !hiddenKinds.includes(point.node.kind));
  const ring = walkable.length > 0 ? walkable : graph.points;
  const ringIds = new Set(ring.map((point) => point.node.id));
  const focusId =
    (roving && ringIds.has(roving) ? roving : null) ??
    (selectedNode && ringIds.has(selectedNode.id) ? selectedNode.id : null) ??
    ring[0]?.node.id;
  const confidence =
    selectedNode?.confidence === undefined
      ? undefined
      : Math.min(1, Math.max(0, selectedNode.confidence));

  const choose = (id: string | null) => {
    if (!controlled) setPicked(id);
    onSelect?.(id);
  };

  const moveFocus = (target: Placed | undefined) => {
    if (!target) return;
    setRoving(target.node.id);
    buttons.current.get(target.node.id)?.focus();
  };

  const handleNodeKey = (event: KeyboardEvent<HTMLButtonElement>, point: Placed) => {
    if (event.key === "Escape") {
      if (selectedNode) {
        choose(null);
        event.preventDefault();
      }
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      moveFocus(event.key === "Home" ? ring[0] : ring[ring.length - 1]);
      return;
    }
    const direction = DIRECTION_BY_KEY[event.key];
    if (!direction) return;
    event.preventDefault();
    moveFocus(nextInDirection(point, direction, ring));
  };

  const toggleKind = (kind: MemoryNodeKind) => {
    setHiddenKinds((current) =>
      current.includes(kind) ? current.filter((entry) => entry !== kind) : [...current, kind],
    );
  };

  const status = selectedNode
    ? [
        selectedNode.label,
        kindLabel[selectedNode.kind],
        `${rows.length} ${rows.length === 1 ? "link" : "links"}`,
        confidence === undefined ? "Not scored" : `${Math.round(confidence * 100)} percent confidence`,
        selectedNode.learnedAt ? `Learned ${selectedNode.learnedAt}` : "No learn date recorded",
      ].join(". ") + "."
    : graph.points.length === 0
      ? "No memories recorded yet."
      : `${graph.points.length} memories, ${graph.edges.length} relations. Arrow keys walk the graph, Enter opens a node.`;

  return (
    <div
      className={["ui-mmgr", className].filter(Boolean).join(" ")}
      data-state={selectedNode ? "selected" : "idle"}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-memory-graph" precedence="default">
        {css}
      </style>

      <div className="ui-mmgr__head">
        <span className="ui-mmgr__mark" aria-hidden="true">
          <GraphIcon />
        </span>
        <h3 className="ui-mmgr__title">{title}</h3>
        <span className="ui-mmgr__count">
          {graph.points.length} {graph.points.length === 1 ? "memory" : "memories"} · {graph.edges.length}{" "}
          {graph.edges.length === 1 ? "relation" : "relations"}
        </span>
      </div>

      <div className="ui-mmgr__body">
        <div
          className="ui-mmgr__stage"
          role="group"
          aria-label="Memory nodes"
        >
          <svg
            className="ui-mmgr__edges"
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            {graph.edges.map((edge) => {
              const touching =
                selectedNode !== undefined && (edge.from === selectedNode.id || edge.to === selectedNode.id);
              const off =
                !hiddenKinds.includes(graph.byId.get(edge.from)?.node.kind ?? "fact") ||
                !hiddenKinds.includes(graph.byId.get(edge.to)?.node.kind ?? "fact");
              return (
                <path
                  key={edge.key}
                  className="ui-mmgr__edge"
                  d={edge.d}
                  data-near={touching ? "true" : undefined}
                  data-far={selectedNode && !touching ? "true" : undefined}
                  data-off={off ? "true" : undefined}
                />
              );
            })}
          </svg>

          {selectedNode
            ? graph.edges
                .filter((edge) => edge.from === selectedNode.id || edge.to === selectedNode.id)
                .map((edge) => (
                  <span
                    key={edge.key}
                    className="ui-mmgr__rel"
                    style={{ left: `${edge.mx * 100}%`, top: `${edge.my * 100}%` }}
                  >
                    {edge.relation}
                  </span>
                ))
            : null}

          <div className="ui-mmgr__nodes">
            {graph.points.map((point, index) => {
              const node = point.node;
              const isSelected = selectedNode?.id === node.id;
              const isNear = near.has(node.id);
              return (
                <button
                  key={node.id}
                  type="button"
                  ref={(element) => {
                    if (element) buttons.current.set(node.id, element);
                    else buttons.current.delete(node.id);
                  }}
                  className="ui-mmgr__node"
                  style={{
                    left: `${point.x * 100}%`,
                    top: `${point.y * 100}%`,
                    animationDelay: `calc(${Math.min(index, 10)} * var(--ui-mmgr-stagger))`,
                  }}
                  data-selected={isSelected ? "true" : undefined}
                  data-near={selectedNode && isNear ? "true" : undefined}
                  data-far={selectedNode && !isNear ? "true" : undefined}
                  data-off={hiddenKinds.includes(node.kind) ? "true" : undefined}
                  tabIndex={node.id === focusId ? 0 : -1}
                  aria-current={isSelected ? "true" : undefined}
                  aria-label={`${node.label}, ${kindLabel[node.kind].toLowerCase()}`}
                  onClick={() => {
                    setRoving(node.id);
                    choose(node.id);
                  }}
                  onKeyDown={(event) => handleNodeKey(event, point)}
                >
                  <span className="ui-mmgr__disc" aria-hidden="true">
                    <KindGlyph kind={node.kind} />
                  </span>
                  <span className="ui-mmgr__label">{node.label}</span>
                </button>
              );
            })}
          </div>

          {graph.points.length === 0 ? (
            <p className="ui-mmgr__empty">No memories recorded yet.</p>
          ) : null}
        </div>

        <aside className="ui-mmgr__rail">
          {selectedNode ? (
            <div className="ui-mmgr__detail">
              <div className="ui-mmgr__detail-head">
                <span className="ui-mmgr__detail-glyph" aria-hidden="true">
                  <KindGlyph kind={selectedNode.kind} />
                </span>
                <div className="ui-mmgr__detail-who">
                  <h4 className="ui-mmgr__detail-name">{selectedNode.label}</h4>
                  <p className="ui-mmgr__detail-kind">{kindLabel[selectedNode.kind]}</p>
                </div>
                <button
                  type="button"
                  className="ui-mmgr__close"
                  onClick={() => choose(null)}
                  aria-label="Clear selection"
                >
                  <CloseIcon />
                </button>
              </div>

              {selectedNode.note ? <p className="ui-mmgr__note">{selectedNode.note}</p> : null}

              <dl className="ui-mmgr__facts">
                <div className="ui-mmgr__fact">
                  <dt>Confidence</dt>
                  <dd>
                    {confidence === undefined ? (
                      <span className="ui-mmgr__plain">Not scored</span>
                    ) : (
                      <>
                        <span className="ui-mmgr__meter" aria-hidden="true">
                          <span
                            className="ui-mmgr__meter-fill"
                            style={{ transform: `scaleX(${confidence})` }}
                          />
                        </span>
                        <span className="ui-mmgr__meter-value">
                          {Math.round(confidence * 100)}%
                        </span>
                      </>
                    )}
                  </dd>
                </div>
                <div className="ui-mmgr__fact">
                  <dt>Learned</dt>
                  <dd>
                    {selectedNode.learnedAt ?? <span className="ui-mmgr__plain">No date recorded</span>}
                  </dd>
                </div>
              </dl>

              <div className="ui-mmgr__links-block">
                <h5 className="ui-mmgr__sub">
                  Links <span className="ui-mmgr__sub-count">{rows.length}</span>
                </h5>
                {rows.length === 0 ? (
                  <p className="ui-mmgr__plain">Nothing is linked to this memory yet.</p>
                ) : (
                  <ul className="ui-mmgr__links">
                    {rows.map((row) => {
                      const other = graph.byId.get(row.other);
                      if (!other) return null;
                      return (
                        <li key={row.key}>
                          <button
                            type="button"
                            className="ui-mmgr__link"
                            aria-label={`${row.relation}: ${other.node.label}, ${kindLabel[
                              other.node.kind
                            ].toLowerCase()}`}
                            onClick={() => {
                              setRoving(other.node.id);
                              choose(other.node.id);
                            }}
                          >
                            <span className="ui-mmgr__link-dir" aria-hidden="true">
                              {row.outgoing ? <ArrowRightIcon /> : <ArrowLeftIcon />}
                            </span>
                            <span className="ui-mmgr__link-body">
                              <span className="ui-mmgr__link-rel">{row.relation}</span>
                              <span className="ui-mmgr__link-name">{other.node.label}</span>
                            </span>
                            <span className="ui-mmgr__link-kind" aria-hidden="true">
                              <KindGlyph kind={other.node.kind} />
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div className="ui-mmgr__hint">
              <p className="ui-mmgr__hint-title">
                {graph.points.length === 0 ? "Nothing remembered yet" : "Nothing selected"}
              </p>
              <p className="ui-mmgr__hint-body">
                {graph.points.length === 0
                  ? "Add a memory and it will appear here as a node."
                  : "Choose a node to read what the agent remembers about it and what it touches."}
              </p>
            </div>
          )}

          <div className="ui-mmgr__legend" role="group" aria-label="Show node types">
            {KIND_ORDER.map((kind) => {
              const count = graph.kindCounts.get(kind) ?? 0;
              return (
                <button
                  key={kind}
                  type="button"
                  className="ui-mmgr__chip"
                  aria-pressed={!hiddenKinds.includes(kind)}
                  disabled={count === 0}
                  onClick={() => toggleKind(kind)}
                >
                  <span className="ui-mmgr__chip-glyph" aria-hidden="true">
                    <KindGlyph kind={kind} />
                  </span>
                  <span className="ui-mmgr__chip-label">{kindLabel[kind]}</span>
                  <span className="ui-mmgr__chip-count">{count}</span>
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      <p className="ui-mmgr__status" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}

/* ---------- icons ---------- */

const GraphIcon = () => (
  <svg
    viewBox="0 0 16 16"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M4.6 10.4 11.4 5.6M5.4 11.5l5.6 1.1" />
    <circle cx="3.6" cy="11" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12.2" cy="4.8" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12.2" cy="12.8" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

const KindGlyph = ({ kind }: { kind: MemoryNodeKind }) => {
  if (kind === "fact") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
        <rect x="3.1" y="2.6" width="9.8" height="10.8" rx="1.7" />
        <path d="M5.6 6.2h4.8M5.6 9h3.2" />
      </svg>
    );
  }
  if (kind === "preference") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
        <path d="M2.4 5.2h11.2M2.4 10.8h11.2" />
        <circle cx="6" cy="5.2" r="1.7" fill="currentColor" stroke="none" />
        <circle cx="10.4" cy="10.8" r="1.7" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (kind === "entity") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 2.3 13 5.2v5.6L8 13.7 3 10.8V5.2z" />
        <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.8" y="2.8" width="10.4" height="10.4" rx="2.2" />
      <path d="m5.5 8.1 1.8 1.8 3.4-3.8" />
    </svg>
  );
};

const CloseIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
    <path d="m4.4 4.4 7.2 7.2M11.6 4.4l-7.2 7.2" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 8h9M8.6 4.4 12.2 8l-3.6 3.6" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M13 8H4M7.4 4.4 3.8 8l3.6 3.6" />
  </svg>
);

/* ---------- styles ---------- */

const css = /* css */ `
/* Every knob is declared here with a literal fallback, so the card keeps its palette in a host
 * that never loads the token sheet. A consumer overrides them on .ui-mmgr { ... }. */
.ui-mmgr{
  --ui-mmgr-ink: var(--text, #1a1410);
  --ui-mmgr-muted: var(--text-muted, #6f625a);
  --ui-mmgr-subtle: var(--text-subtle, #1a141066);
  --ui-mmgr-surface: var(--panel, #fffdfb);
  --ui-mmgr-card: var(--card, #ffffff);
  --ui-mmgr-line: var(--border, #e8e0d7);
  --ui-mmgr-line-soft: var(--border-soft, #1a14101a);
  --ui-mmgr-accent: var(--accent, #c2410c);
  --ui-mmgr-accent-soft: var(--accent-soft, #c2410c1a);
  --ui-mmgr-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-mmgr-dur-2: var(--nm-dur-2, 160ms);
  --ui-mmgr-dur-3: var(--nm-dur-3, 240ms);
  --ui-mmgr-dur-4: var(--nm-dur-4, 380ms);
  --ui-mmgr-stagger: var(--nm-stagger, 45ms);
  --ui-mmgr-rail: 228px;
  position: relative;
  display: grid;
  gap: 12px;
  padding: 14px;
  border-radius: var(--radius-panel, 20px);
  background: var(--ui-mmgr-surface);
  box-shadow: inset 0 0 0 1px var(--ui-mmgr-line-soft);
  color: var(--ui-mmgr-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  line-height: 18px;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
  container-type: inline-size;
}
.ui-mmgr *,
.ui-mmgr *::before,
.ui-mmgr *::after{box-sizing: border-box}
.ui-mmgr h3,.ui-mmgr h4,.ui-mmgr h5,.ui-mmgr p,.ui-mmgr ul,.ui-mmgr dl,.ui-mmgr dd,.ui-mmgr dt{margin: 0;padding: 0}
.ui-mmgr ul{list-style: none}
.ui-mmgr svg{display: block;flex: none}
.ui-mmgr button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;text-align: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-mmgr button:focus-visible{outline: 2px solid var(--ui-mmgr-accent);outline-offset: 2px}

.ui-mmgr__head{display: flex;align-items: center;gap: 8px;min-width: 0}
.ui-mmgr__mark{display: grid;place-items: center;width: 16px;color: var(--ui-mmgr-accent)}
.ui-mmgr__title{flex: none;font-size: 13px;font-weight: 600;line-height: 18px;color: var(--ui-mmgr-ink)}
.ui-mmgr__count{margin-left: auto;font-size: 11px;line-height: 16px;color: var(--ui-mmgr-muted);font-variant-numeric: tabular-nums;white-space: nowrap}

.ui-mmgr__body{display: grid;grid-template-columns: minmax(0, 1fr) var(--ui-mmgr-rail);gap: 12px;align-items: stretch}

.ui-mmgr__stage{
  position: relative;
  min-width: 0;
  min-height: 280px;
  aspect-ratio: 1.25;
  overflow: hidden;
  border-radius: var(--radius-card, 12px);
  background:
    radial-gradient(circle at 1px 1px, var(--ui-mmgr-line-soft) 1px, transparent 0) 0 0 / 18px 18px,
    var(--ui-mmgr-card);
  box-shadow: inset 0 0 0 1px var(--ui-mmgr-line-soft);
}
.ui-mmgr__edges{position: absolute;inset: 0;width: 100%;height: 100%;pointer-events: none}
.ui-mmgr__edge{
  fill: none;
  stroke: var(--ui-mmgr-line);
  stroke-width: 1.5;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
  opacity: 1;
  animation: ui-mmgr-fade var(--ui-mmgr-dur-4) var(--ui-mmgr-ease-out) backwards;
  transition: opacity var(--ui-mmgr-dur-3) var(--ui-mmgr-ease-out), stroke var(--ui-mmgr-dur-3) var(--ui-mmgr-ease-out);
}
.ui-mmgr[data-state="selected"] .ui-mmgr__edge[data-far]{opacity: 0.14}
.ui-mmgr[data-state="selected"] .ui-mmgr__edge[data-off]{opacity: 0.06}
/* The selection and its neighbourhood win over a kind switched off in the legend. */
.ui-mmgr[data-state="selected"] .ui-mmgr__edge[data-near]{stroke: var(--ui-mmgr-muted);opacity: 1}
.ui-mmgr__rel{
  position: absolute;
  max-width: 128px;
  overflow: hidden;
  padding: 1px 6px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-mmgr-card);
  box-shadow: inset 0 0 0 1px var(--ui-mmgr-line-soft);
  color: var(--ui-mmgr-muted);
  font-size: 10px;
  line-height: 14px;
  letter-spacing: 0;
  white-space: nowrap;
  text-overflow: ellipsis;
  transform: translate(-50%, -50%);
  pointer-events: none;
  animation: ui-mmgr-fade var(--ui-mmgr-dur-3) var(--ui-mmgr-ease-out) backwards;
}

.ui-mmgr__nodes{position: absolute;inset: 0}
.ui-mmgr__node{
  position: absolute;
  display: grid;
  justify-items: center;
  gap: 4px;
  width: 78px;
  border-radius: 12px;
  text-align: center;
  transform: translate(-50%, -50%);
  animation: ui-mmgr-node-in var(--ui-mmgr-dur-3) var(--ui-mmgr-ease-out) backwards;
  transition: opacity var(--ui-mmgr-dur-3) var(--ui-mmgr-ease-out);
}
.ui-mmgr__node[data-off]{opacity: 0.2}
.ui-mmgr[data-state="selected"] .ui-mmgr__node[data-far]{opacity: 0.26}
.ui-mmgr[data-state="selected"] .ui-mmgr__node[data-off]{opacity: 0.12}
.ui-mmgr[data-state="selected"] .ui-mmgr__node[data-selected]{opacity: 1}
.ui-mmgr__disc{
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--ui-mmgr-card);
  color: var(--ui-mmgr-muted);
  box-shadow: inset 0 0 0 1px var(--ui-mmgr-line), 0 1px 2px #1a14100f;
  transition:
    transform var(--ui-mmgr-dur-3) var(--ui-mmgr-ease-out),
    box-shadow var(--ui-mmgr-dur-2) var(--ui-mmgr-ease-out),
    color var(--ui-mmgr-dur-2) var(--ui-mmgr-ease-out);
}
.ui-mmgr__disc > svg{width: 15px;height: 15px}
.ui-mmgr__node:hover .ui-mmgr__disc{color: var(--ui-mmgr-ink);transform: scale(1.06)}
.ui-mmgr__node[data-near] .ui-mmgr__disc{color: var(--ui-mmgr-ink);box-shadow: inset 0 0 0 1px var(--ui-mmgr-line), 0 2px 8px #1a141014}
.ui-mmgr__node[data-selected] .ui-mmgr__disc{
  color: var(--ui-mmgr-ink);
  transform: scale(1.08);
  box-shadow: inset 0 0 0 1.5px var(--ui-mmgr-accent), 0 0 0 5px var(--ui-mmgr-accent-soft);
}
.ui-mmgr__label{
  max-width: 78px;
  overflow: hidden;
  color: var(--ui-mmgr-muted);
  font-size: 11px;
  line-height: 14px;
  letter-spacing: 0;
  white-space: nowrap;
  text-overflow: ellipsis;
  transition: color var(--ui-mmgr-dur-2) var(--ui-mmgr-ease-out);
}
.ui-mmgr__node[data-near] .ui-mmgr__label{color: var(--ui-mmgr-ink)}
.ui-mmgr__node[data-selected] .ui-mmgr__label{font-weight: 500;color: var(--ui-mmgr-ink)}
.ui-mmgr__empty{
  position: absolute;
  top: 50%;
  left: 50%;
  max-width: 200px;
  transform: translate(-50%, -50%);
  color: var(--ui-mmgr-muted);
  font-size: 12px;
  line-height: 17px;
  text-align: center;
}

.ui-mmgr__rail{display: grid;align-content: start;gap: 12px;min-width: 0;padding-left: 12px;box-shadow: inset 1px 0 0 var(--ui-mmgr-line-soft)}
.ui-mmgr__detail{display: grid;gap: 10px;min-width: 0;animation: ui-mmgr-slide var(--ui-mmgr-dur-4) var(--ui-mmgr-ease-out) both}
.ui-mmgr__detail-head{display: grid;grid-template-columns: auto minmax(0, 1fr) auto;align-items: center;gap: 8px}
.ui-mmgr__detail-glyph{
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--ui-mmgr-card);
  color: var(--ui-mmgr-ink);
  box-shadow: inset 0 0 0 1px var(--ui-mmgr-accent);
}
.ui-mmgr__detail-glyph > svg{width: 14px;height: 14px}
.ui-mmgr__detail-who{display: grid;min-width: 0}
.ui-mmgr__detail-name{overflow: hidden;color: var(--ui-mmgr-ink);font-size: 13px;font-weight: 600;line-height: 17px;white-space: nowrap;text-overflow: ellipsis}
.ui-mmgr__detail-kind{color: var(--ui-mmgr-muted);font-size: 11px;line-height: 15px;letter-spacing: 0}
.ui-mmgr__close{
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: var(--ui-mmgr-muted);
  transition: background-color var(--ui-mmgr-dur-2) var(--ui-mmgr-ease-out), color var(--ui-mmgr-dur-2) var(--ui-mmgr-ease-out);
}
.ui-mmgr__close:hover{background: var(--ui-mmgr-line-soft);color: var(--ui-mmgr-ink)}
.ui-mmgr__close > svg{width: 13px;height: 13px}
.ui-mmgr__note{color: var(--ui-mmgr-muted);font-size: 12px;line-height: 17px;letter-spacing: 0}
.ui-mmgr__facts{display: grid;gap: 6px}
.ui-mmgr__fact{display: grid;grid-template-columns: auto minmax(0, 1fr);align-items: center;gap: 8px;font-size: 11px;line-height: 16px;letter-spacing: 0}
.ui-mmgr__fact dt{color: var(--ui-mmgr-muted)}
.ui-mmgr__fact dd{display: flex;align-items: center;gap: 6px;justify-self: end;color: var(--ui-mmgr-ink);font-variant-numeric: tabular-nums}
.ui-mmgr__plain{color: var(--ui-mmgr-muted);font-size: 11px;line-height: 16px;letter-spacing: 0}
.ui-mmgr__meter{display: block;width: 62px;height: 4px;overflow: hidden;border-radius: var(--radius-pill, 999px);background: var(--ui-mmgr-line-soft)}
.ui-mmgr__meter-fill{
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: var(--ui-mmgr-accent);
  transform-origin: left center;
  transition: transform var(--ui-mmgr-dur-3) var(--ui-mmgr-ease-out);
}
.ui-mmgr__meter-value{color: var(--ui-mmgr-ink);font-size: 11px}
.ui-mmgr__links-block{display: grid;gap: 4px;min-width: 0}
.ui-mmgr__sub{display: flex;align-items: baseline;gap: 6px;color: var(--ui-mmgr-ink);font-size: 11px;font-weight: 600;line-height: 16px;letter-spacing: 0}
.ui-mmgr__sub-count{color: var(--ui-mmgr-muted);font-weight: 500;font-variant-numeric: tabular-nums}
.ui-mmgr__links{display: grid;gap: 2px;min-width: 0}
.ui-mmgr__link{
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  width: calc(100% + 12px);
  margin: 0 -6px;
  padding: 4px 6px;
  border-radius: 6px;
  transition: background-color var(--ui-mmgr-dur-2) var(--ui-mmgr-ease-out);
}
.ui-mmgr__link:hover{background: var(--ui-mmgr-line-soft)}
.ui-mmgr__link-dir{color: var(--ui-mmgr-subtle)}
.ui-mmgr__link-dir > svg{width: 12px;height: 12px}
.ui-mmgr__link-body{display: grid;min-width: 0}
.ui-mmgr__link-rel{overflow: hidden;color: var(--ui-mmgr-muted);font-size: 10px;line-height: 13px;letter-spacing: 0;white-space: nowrap;text-overflow: ellipsis}
.ui-mmgr__link-name{overflow: hidden;color: var(--ui-mmgr-ink);font-size: 12px;line-height: 16px;white-space: nowrap;text-overflow: ellipsis}
.ui-mmgr__link-kind{color: var(--ui-mmgr-muted)}
.ui-mmgr__link-kind > svg{width: 12px;height: 12px}

.ui-mmgr__hint{display: grid;gap: 4px}
.ui-mmgr__hint-title{color: var(--ui-mmgr-ink);font-size: 12px;font-weight: 500;line-height: 16px}
.ui-mmgr__hint-body{color: var(--ui-mmgr-muted);font-size: 11px;line-height: 16px;letter-spacing: 0}

.ui-mmgr__legend{display: flex;flex-wrap: wrap;gap: 4px;padding-top: 10px;box-shadow: inset 0 1px 0 var(--ui-mmgr-line-soft)}
.ui-mmgr__chip{
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 8px 0 6px;
  border-radius: var(--radius-pill, 999px);
  color: var(--ui-mmgr-muted);
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0;
  box-shadow: inset 0 0 0 1px var(--ui-mmgr-line-soft);
  transition:
    color var(--ui-mmgr-dur-2) var(--ui-mmgr-ease-out),
    background-color var(--ui-mmgr-dur-2) var(--ui-mmgr-ease-out),
    box-shadow var(--ui-mmgr-dur-2) var(--ui-mmgr-ease-out);
}
.ui-mmgr__chip:hover{color: var(--ui-mmgr-ink);box-shadow: inset 0 0 0 1px var(--ui-mmgr-line)}
.ui-mmgr__chip[aria-pressed="true"]{background: var(--ui-mmgr-card);color: var(--ui-mmgr-ink);box-shadow: inset 0 0 0 1px var(--ui-mmgr-line)}
.ui-mmgr__chip[aria-pressed="false"] .ui-mmgr__chip-label{text-decoration: line-through}
.ui-mmgr__chip[aria-pressed="false"]{color: var(--ui-mmgr-muted);background: none;box-shadow: inset 0 0 0 1px transparent}
.ui-mmgr__chip:disabled{opacity: 0.4;cursor: default}
.ui-mmgr__chip-glyph{display: grid;place-items: center;color: currentColor}
.ui-mmgr__chip-glyph > svg{width: 12px;height: 12px}
.ui-mmgr__chip-count{color: var(--ui-mmgr-muted);font-variant-numeric: tabular-nums}

.ui-mmgr__status{min-height: 16px;color: var(--ui-mmgr-muted);font-size: 11px;line-height: 16px;letter-spacing: 0}

@container (max-width: 620px){
  .ui-mmgr__body{grid-template-columns: minmax(0, 1fr)}
  .ui-mmgr__rail{padding-left: 0;padding-top: 12px;box-shadow: inset 0 1px 0 var(--ui-mmgr-line-soft)}
  .ui-mmgr__detail{animation-name: ui-mmgr-rise}
}
@container (max-width: 470px){
  .ui-mmgr__node{width: 68px}
  .ui-mmgr__label{max-width: 68px;font-size: 10px;line-height: 13px}
  .ui-mmgr__disc{width: 30px;height: 30px}
  .ui-mmgr__disc > svg{width: 13px;height: 13px}
  .ui-mmgr__rel{max-width: 96px;font-size: 9px}
}

@keyframes ui-mmgr-node-in{
  from{opacity: 0;transform: translate(-50%, -50%) scale(0.82)}
  to{opacity: 1;transform: translate(-50%, -50%) scale(1)}
}
@keyframes ui-mmgr-fade{
  from{opacity: 0}
  to{opacity: 1}
}
@keyframes ui-mmgr-slide{
  from{opacity: 0;transform: translateX(12px)}
  to{opacity: 1;transform: none}
}
@keyframes ui-mmgr-rise{
  from{opacity: 0;transform: translateY(10px)}
  to{opacity: 1;transform: none}
}

:where(.dark, [data-theme="dark"]) .ui-mmgr{
  --ui-mmgr-ink: var(--text, #f4ece4);
  --ui-mmgr-muted: var(--text-muted, #a2958a);
  --ui-mmgr-subtle: var(--text-subtle, #f4ece48c);
  --ui-mmgr-surface: var(--panel, #1a1512);
  --ui-mmgr-card: var(--card, #201a15);
  --ui-mmgr-line: var(--border, #33291f);
  --ui-mmgr-line-soft: var(--border-soft, #ffffff14);
  --ui-mmgr-accent: var(--accent, #ff6b35);
  --ui-mmgr-accent-soft: var(--accent-soft, #ff6b3524);
}

@media (prefers-reduced-motion: reduce){
  .ui-mmgr,
  .ui-mmgr *,
  .ui-mmgr *::before,
  .ui-mmgr *::after{animation: none;transition-duration: 1ms;transition-delay: 0ms}
  .ui-mmgr__node{transform: translate(-50%, -50%)}
  .ui-mmgr__rel{transform: translate(-50%, -50%)}
  .ui-mmgr__detail{transform: none}
  .ui-mmgr__edge[data-near]{opacity: 1}
}
`;
