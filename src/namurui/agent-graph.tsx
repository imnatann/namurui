"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/*
 * Agent Graph – agents and the tools they call as a living network.
 * The lead sits in the middle, the other agents on an inner ellipse ring, tools and the user on
 * an outer one. Links are orthogonal with 8px rounded corners; every call sends a gradient streak
 * along its link and the answer comes back the other way. Working agents breathe, agents that
 * need you get a turning amber arc and a shimmer, and failed ones turn red.
 * The styles are injected below, so no extra files are needed.
 */

export type GraphNodeKind = "agent" | "tool" | "user";
export type GraphNodeStatus = "idle" | "working" | "waiting" | "error" | "done";

export type GraphNode = {
  /** Stable id – this is what keeps a node in place between renders */
  id: string;
  /** Label under the node, e.g. "Researcher" */
  name: string;
  /** Where the node sits: agents on the inner ring, tools and you on the outer one */
  kind: GraphNodeKind;
  /** A shorter label for narrow containers, e.g. "Search" */
  short?: string;
  /** A logo or mark; defaults to the initials, or a person for the user */
  icon?: ReactNode;
  /** The model or what a tool is – the second line under an agent's name */
  detail?: string;
  /** What it is doing right now – shown in its card */
  doing?: string;
  status?: GraphNodeStatus;
  /** What it has cost so far; the bar sums every node */
  cost?: number;
  /** The agent in the middle – defaults to the first agent */
  lead?: boolean;
};

export type GraphCallStatus = "pending" | "ok" | "error";

export type GraphCall = {
  /** Must stay the same while its status goes from pending to ok or error */
  id: string;
  /** Node the call leaves from */
  from: string;
  /** Node it is sent to */
  to: string;
  /** When it started, in ms since the epoch */
  at: number;
  status?: GraphCallStatus;
  /** One line describing what was asked for */
  label?: string;
  /** How long the answer took */
  ms?: number;
};

export type AgentGraphProps = {
  /** Every agent, tool and user; ids keep nodes in place and new ids grow in */
  nodes: GraphNode[];
  /** Recent calls, newest last – a new id sends a streak from → to */
  calls?: GraphCall[];
  /** Links that are always there, even before their first call */
  edges?: [string, string][];
  /** The clock for calls per minute and link heat; without it the graph ticks every second */
  now?: number;
  /** How far back (ms) calls count towards a link's weight */
  heatWindow?: number;
  /** A node was clicked – null when its card closes */
  onSelect?: (node: GraphNode | null) => void;
  /** Fixed height of the stage in px; by default it follows the width */
  height?: number;
  /** Formats every cost */
  formatCost?: (amount: number) => string;
  /** Heading of the bar */
  title?: string;
  /** Extra class on the root */
  className?: string;
};

/* ---------- geometry ---------- */

type Slot = { x: number; y: number; size: number };

type Pt = { x: number; y: number };

/** A route is a polyline with one rounded corner, plus arcs sampled into points. */
type Route = { d: string; points: Pt[]; length: number };

const CORNER = 8;

const sizeFor = (kind: GraphNodeKind, narrow: boolean) =>
  kind === "agent" ? (narrow ? 34 : 46) : narrow ? 28 : 34;

/**
 * One elbow between two node centres. The corner sits near the target, which is what makes the
 * lines read as spokes rather than diagonals.
 */
function elbow(from: Pt, to: Pt, verticalFirst: boolean): Route {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  // Purely collinear links are drawn straight – an elbow would just bulge.
  if (Math.abs(dx) < 0.5 || Math.abs(dy) < 0.5) {
    const points = [from, to];
    return {
      d: `M${from.x.toFixed(2)} ${from.y.toFixed(2)}L${to.x.toFixed(2)} ${to.y.toFixed(2)}`,
      points,
      length: Math.hypot(dx, dy),
    };
  }

  const ax = Math.sign(dx);
  const ay = Math.sign(dy);
  const points: Pt[] = [from];

  let d = `M${from.x.toFixed(2)} ${from.y.toFixed(2)}`;

  if (verticalFirst) {
    const corner: Pt = { x: from.x, y: to.y - ay * CORNER };
    const land: Pt = { x: from.x + ax * CORNER, y: to.y };
    points.push(corner);
    points.push(land);
    points.push(to);
    d += `L${corner.x.toFixed(2)} ${corner.y.toFixed(2)}`;
    d += `Q${from.x.toFixed(2)} ${to.y.toFixed(2)} ${land.x.toFixed(2)} ${land.y.toFixed(2)}`;
    d += `L${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
  } else {
    const corner: Pt = { x: to.x - ax * CORNER, y: from.y };
    const land: Pt = { x: to.x, y: from.y + ay * CORNER };
    points.push(corner);
    points.push(land);
    points.push(to);
    d += `L${corner.x.toFixed(2)} ${corner.y.toFixed(2)}`;
    d += `Q${to.x.toFixed(2)} ${from.y.toFixed(2)} ${land.x.toFixed(2)} ${land.y.toFixed(2)}`;
    d += `L${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
  }

  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return { d, points, length };
}

/** Walks a route so a pulse can sit at a fraction of it. */
function pointAt(route: Route, distance: number): Pt {
  let left = Math.max(0, Math.min(route.length, distance));
  for (let i = 1; i < route.points.length; i += 1) {
    const a = route.points[i - 1];
    const b = route.points[i];
    const segment = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= segment || i === route.points.length - 1) {
      const t = segment === 0 ? 0 : left / segment;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    left -= segment;
  }
  return route.points[route.points.length - 1];
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

/* ---------- pulses ---------- */

type Pulse = {
  key: string;
  route: Route;
  kind: "call" | "res" | "err" | "ask" | "askres";
  /** ms it started, on the animation clock */
  start: number;
  duration: number;
  reverse: boolean;
};

const STREAK = 26;

/* ---------- component ---------- */

export function AgentGraph({
  nodes,
  calls = [],
  edges = [],
  now,
  heatWindow = 20000,
  onSelect,
  height,
  formatCost = (amount) => `$${amount.toFixed(2)}`,
  title = "Agent graph",
  className,
}: AgentGraphProps) {
  const uid = useId().replace(/[:]/g, "");
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  const [width, setWidth] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const [openId, setOpenId] = useState<string | null>(null);
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [phase, setPhase] = useState(0);
  /* Which side each label sits on, resolved once per layout by measuring the rendered text.
   * Radii alone cannot promise this: a two-line agent label is twice as tall as a tool's. */
  const [labelSide, setLabelSide] = useState<Record<string, boolean>>({});

  const narrow = width > 0 && width < 520;

  /* Width drives the whole layout, so it is measured, never assumed. */
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* `now` is controlled, otherwise the graph keeps its own clock. */
  useEffect(() => {
    if (now !== undefined) return;
    const id = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [now]);
  const time = now ?? clock;

  /* One rAF loop drives every streak; it stops when the tab is hidden. */
  useEffect(() => {
    if (pulses.length === 0) return;
    let frame = 0;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      setPhase(performance.now());
      frame = requestAnimationFrame(tick);
    };
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else if (!frame) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pulses.length]);

  const { lead, inner, outer, byId } = useMemo(() => {
    const agents = nodes.filter((n) => n.kind === "agent");
    const leadNode = agents.find((n) => n.lead) ?? agents[0];
    const rest = nodes.filter((n) => n.id !== leadNode?.id);
    return {
      lead: leadNode,
      inner: rest.filter((n) => n.kind === "agent"),
      outer: rest.filter((n) => n.kind !== "agent"),
      byId: Object.fromEntries(nodes.map((n) => [n.id, n])) as Record<string, GraphNode>,
    };
  }, [nodes]);

  const graphHeight = useMemo(() => {
    if (height) return height;
    if (!width) return 320;
    if (narrow) return Math.round(Math.min(672, Math.max(420, width * 1.5)));
    return Math.round(Math.min(520, Math.max(360, width * 0.6)) + 32);
  }, [height, width, narrow]);

  /* ---------- links, heat ---------- */

  const links = useMemo(() => {
    const seen: Record<string, { key: string; a: string; b: string }> = {};
    const out: { key: string; a: string; b: string }[] = [];
    const add = (a: string, b: string) => {
      if (!a || !b || a === b) return;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seen[key]) return;
      seen[key] = { key, a, b };
      out.push({ key, a, b });
    };
    for (const [a, b] of edges) add(a, b);
    for (const call of calls) add(call.from, call.to);
    return out;
  }, [edges, calls]);

  const heat = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const call of calls) {
      if (time - call.at > heatWindow) continue;
      const key = call.from < call.to ? `${call.from}|${call.to}` : `${call.to}|${call.from}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [calls, time, heatWindow]);

  const perMinute = useMemo(() => {
    const cutoff = time - 60000;
    return calls.filter((call) => call.at >= cutoff).length;
  }, [calls, time]);

  const totalCost = useMemo(
    () => nodes.reduce((sum, node) => sum + (node.cost ?? 0), 0),
    [nodes],
  );

  /* ---------- layout ---------- */

  const slots = useMemo(() => {
    const out: Record<string, Slot> = {};
    if (!width || !graphHeight) return out;

    const cx = width / 2;
    const cy = graphHeight / 2;
    const leadSize = sizeFor("agent", narrow) + (narrow ? 8 : 10);
    const innerSize = sizeFor("agent", narrow);
    const outerSize = sizeFor("tool", narrow);

    if (lead) out[lead.id] = { x: cx, y: cy, size: leadSize };

    /* Ring geometry is derived from what actually has to fit, not from a fraction of the box:
     *
     *   an agent's label hangs 5px under its disc and is up to three 15px lines tall
     *   the lead's disc is half a lead wide
     *
     * so the closest an agent's centre may come to the lead's centre is that sum plus a gap.
     * The ring's semi-axes are √2 larger than that 45° offset, which is what makes four agents
     * land on a ring rather than collapsing towards the middle. */
    const labelHeight = narrow ? 15 : 30;
    const labelOffset = 5;
    const ringGap = narrow ? 8 : 12;
    const centreClearance = leadSize / 2 + labelOffset + labelHeight + ringGap;
    const axisFloor = centreClearance * Math.SQRT2;

    const aInner = Math.max(width * 0.17, axisFloor);
    const bInner = Math.max(graphHeight * 0.2, Math.min(axisFloor, graphHeight * 0.42));

    const step = (Math.PI * 2) / Math.max(inner.length, 1);
    inner.forEach((node, index) => {
      const angle = -Math.PI / 4 + index * step;
      out[node.id] = {
        x: cx + Math.cos(angle) * aInner,
        y: cy + Math.sin(angle) * bInner,
        size: innerSize,
      };
    });

    /* Outer ring: each node leans towards the agents it talks to, then the ring is spread
     * evenly so labels never collide. Its semi-axes start beyond the inner ring's nodes. */
    const neighbours = (id: string) => {
      const ids: string[] = [];
      const push = (other: string) => {
        if (other !== id && out[other] && !ids.includes(other)) ids.push(other);
      };
      for (const link of links) {
        if (link.a === id) push(link.b);
        if (link.b === id) push(link.a);
      }
      return ids;
    };

    const placed = outer.map((node) => {
      const near = neighbours(node.id);
      let ax = 0;
      let ay = 0;
      for (const id of near) {
        const slot = out[id];
        const dx = slot.x - cx;
        const dy = slot.y - cy;
        const d = Math.hypot(dx, dy) || 1;
        ax += dx / d;
        ay += dy / d;
      }
      return { node, angle: ax || ay ? Math.atan2(ay, ax) : -Math.PI / 2 };
    });

    placed.sort((a, b) => a.angle - b.angle);
    const gap = Math.min((Math.PI * 2) / Math.max(placed.length, 1), narrow ? 0.76 : 0.58);
    for (let i = 1; i < placed.length; i += 1) {
      if (placed[i].angle - placed[i - 1].angle < gap) placed[i].angle = placed[i - 1].angle + gap;
    }
    const last = placed[placed.length - 1];
    const drift = last ? last.angle - (placed[0].angle + Math.PI * 2 - gap) : 0;
    if (drift > 0) for (const entry of placed) entry.angle -= drift / 2;

    /* One ring further out than the inner one, so an inner label never lands on a tool.
     * The ring is then clamped so a label under the lowest node stays inside the stage and a
     * wide tool name on the widest node does not clip: a label is centred, so it needs half its
     * own width on each side, and its full height below the disc. */
    const ringStep = (innerSize + outerSize) / 2 + (narrow ? 10 : 16);
    const pad = outerSize / 2 + 6;
    const labelBelow = 5 + (narrow ? 15 : 16);
    const widestLabel = outer.reduce(
      (widest, node) =>
        Math.max(widest, ((narrow && node.short) || node.name).length * (narrow ? 5.6 : 6.4)),
      0,
    );
    const sideRoom = widestLabel / 2 + 4;
    const aOuter = Math.min(
      Math.max(pad, width / 2 - pad - sideRoom),
      Math.max(width * 0.36, aInner + ringStep),
    );
    const bOuter = Math.min(
      Math.max(pad, graphHeight / 2 - pad - labelBelow),
      Math.max(graphHeight * 0.42, bInner + ringStep),
    );
    for (const { node, angle } of placed) {
      out[node.id] = {
        x: Math.max(pad, Math.min(width - pad, cx + Math.cos(angle) * aOuter)),
        y: Math.max(pad, Math.min(graphHeight - pad, cy + Math.sin(angle) * bOuter)),
        size: outerSize,
      };
    }

    return out;
  }, [width, graphHeight, lead, inner, outer, links, narrow]);

  /* ---------- routes ---------- */

  /* Links leaving the lead always stub out vertically first, which is what makes them read as
   * spokes; everything else takes the dominant axis. Parallel links are nudged apart. */
  const routes = useMemo(() => {
    const out: Record<string, Route & { from: string; to: string }> = {};
    for (const link of links) {
      const a = slots[link.a];
      const b = slots[link.b];
      if (!a || !b) continue;
      const verticalFirst = lead && (link.a === lead.id || link.b === lead.id)
        ? true
        : Math.abs(b.y - a.y) >= Math.abs(b.x - a.x);
      out[link.key] = { ...elbow(a, b, verticalFirst), from: link.a, to: link.b };
    }
    return out;
  }, [links, slots, lead]);

  /* ---------- new calls become pulses ---------- */

  const seenCalls = useRef<Record<string, GraphCallStatus | undefined>>({});
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      // The first render only records history: old calls must not replay.
      for (const call of calls) seenCalls.current[call.id] = call.status;
      mounted.current = true;
      return;
    }
    const started = performance.now();
    const fresh: Pulse[] = [];
    for (const call of calls) {
      const before = seenCalls.current[call.id];
      const key = call.from < call.to ? `${call.from}|${call.to}` : `${call.to}|${call.from}`;
      const route = routes[key];
      if (!route) continue;
      if (before === undefined) {
        // A call that is already old when it first appears only counts towards heat.
        if (Date.now() - call.at < 4000) {
          fresh.push({ key: `${call.id}:out`, route, kind: call.status === "error" ? "ask" : "call", start: started, duration: 900, reverse: false });
        }
      } else if (before === "pending" && call.status && call.status !== "pending") {
        fresh.push({
          key: `${call.id}:back`,
          route,
          kind: call.status === "ok" ? "res" : "err",
          start: started,
          duration: 820,
          reverse: true,
        });
      }
      seenCalls.current[call.id] = call.status;
    }
    if (fresh.length) {
      setPulses((current) => [...current.slice(-14), ...fresh]);
      const lifetime = 2400;
      const id = window.setTimeout(() => {
        setPulses((current) => current.filter((pulse) => !fresh.some((freshPulse) => freshPulse.key === pulse.key)));
      }, lifetime);
      return () => window.clearTimeout(id);
    }
  }, [calls, routes]);

  /* Resolve label sides against what is actually on screen. A label may sit below its disc
   * unless that box would land on another disc or another label; then it flips above. Two
   * passes settle the common case, and the result is kept per layout so it does not flicker. */
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || !width) return;
    const frame = requestAnimationFrame(() => {
      const discs = [...el.querySelectorAll<HTMLElement>(".ui-aggc__disc")].map((disc) => ({
        box: disc.getBoundingClientRect(),
        id: disc.closest<HTMLElement>(".ui-aggc__node")?.dataset.nodeId ?? "",
      }));
      const overlaps = (a: DOMRect, b: DOMRect, pad = 2) =>
        a.left < b.right + pad && a.right > b.left - pad && a.top < b.bottom + pad && a.bottom > b.top - pad;

      const next: Record<string, boolean> = {};
      const labels: { id: string; box: DOMRect }[] = [];
      for (const label of el.querySelectorAll<HTMLElement>(".ui-aggc__label")) {
        const node = label.closest<HTMLElement>(".ui-aggc__node");
        const id = node?.dataset.nodeId;
        if (!id) continue;
        const box = label.getBoundingClientRect();
        const bad = discs.some((disc) => disc.id !== id && overlaps(box, disc.box))
          || labels.some((other) => overlaps(box, other.box));
        next[id] = bad;
        labels.push({ id, box });
      }
      setLabelSide((current) => {
        const same = Object.keys(next).length === Object.keys(current).length
          && Object.keys(next).every((key) => current[key] === next[key]);
        return same ? current : next;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [width, graphHeight, slots, width === 0]);

  const elapsed = phase || performance.now();

  /* ---------- derived view ---------- */

  const alerts = nodes.filter((n) => n.status === "waiting" || n.status === "error");
  const nearIds = useMemo(() => {
    if (!openId) return [] as string[];
    const ids = [openId];
    for (const link of links) {
      if (link.a === openId) ids.push(link.b);
      if (link.b === openId) ids.push(link.a);
    }
    return ids;
  }, [openId, links]);

  const callsIn = (id: string) =>
    calls.filter((call) => call.at >= time - 60000 && (call.from === id || call.to === id)).length;

  const openNode = openId ? byId[openId] : undefined;
  const openSlot = openId ? slots[openId] : undefined;
  const openCalls = useMemo(
    () => (openId ? calls.filter((call) => call.from === openId || call.to === openId).slice(-4).reverse() : []),
    [calls, openId],
  );

  const close = () => {
    setOpenId(null);
    onSelect?.(null);
  };

  useEffect(() => {
    if (!openId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  const labelFor = (node: GraphNode) => (narrow && node.short ? node.short : node.name);

  return (
    <section
      ref={root}
      className={["ui-aggc", className].filter(Boolean).join(" ")}
      data-narrow={narrow || undefined}
      data-focus={openId || undefined}
    >
      {/* React 19 hoists this into <head> once, no matter how many graphs render */}
      <style href="ui-agent-graph" precedence="default">
        {css}
      </style>

      <header className="ui-aggc__bar">
        <span className="ui-aggc__mark" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 8.4 3.2 4M8 8.4l5-4.2M8 8.4l4.4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
            <circle cx="8" cy="8.4" r="2.4" fill="currentColor" />
            <circle cx="3.2" cy="4" r="1.6" fill="currentColor" />
            <circle cx="13" cy="4.2" r="1.6" fill="currentColor" />
            <circle cx="12.4" cy="12.4" r="1.6" fill="currentColor" />
          </svg>
        </span>
        <span className="ui-aggc__title">{title}</span>
        <span className="ui-aggc__sum">
          <span>
            <b>{nodes.filter((n) => n.kind === "agent").length}</b> agents
          </span>
          <span>
            <b>{nodes.filter((n) => n.kind === "tool").length}</b> tools
          </span>
          <span>
            <b>{perMinute}</b> calls/min
          </span>
          <span className="ui-aggc__sum-cost">{formatCost(totalCost)}</span>
        </span>
        {alerts.length > 0 && (
          <span className="ui-aggc__alerts">
            {alerts.slice(0, 2).map((node) => (
              <button
                key={node.id}
                type="button"
                className="ui-aggc__chip"
                data-kind={node.status === "waiting" ? "waiting" : "error"}
                onClick={() => {
                  setOpenId(node.id);
                  onSelect?.(node);
                }}
              >
                {node.status === "waiting" ? <ClockIcon /> : <AlertIcon />}
                {node.status === "waiting" ? `Needs you · ${labelFor(node)}` : `Failed · ${labelFor(node)}`}
              </button>
            ))}
          </span>
        )}
      </header>

      <div className="ui-aggc__panel">
        <div
          ref={stage}
          className="ui-aggc__stage"
          style={{ height: graphHeight }}
          role="group"
          aria-label={`${title}: ${nodes.filter((n) => n.kind === "agent").length} agents and ${nodes.filter((n) => n.kind === "tool").length} tools`}
        >
          <svg className="ui-aggc__svg" width={width || undefined} height={graphHeight} aria-hidden="true">
            <defs>
              {(["call", "res", "ask", "err"] as const).map((kind) => (
                <linearGradient key={kind} id={`${uid}-${kind}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0" className="ui-aggc__stop" data-kind={kind} />
                  <stop offset="50%" stopColor="currentColor" stopOpacity="1" className="ui-aggc__stop" data-kind={kind} />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" className="ui-aggc__stop" data-kind={kind} />
                </linearGradient>
              ))}
            </defs>

            <g className="ui-aggc__edges">
              {links.map((link) => {
                const route = routes[link.key];
                if (!route) return null;
                const near = nearIds.includes(link.a) && nearIds.includes(link.b);
                const count = heat[link.key] ?? 0;
                const asking = nodes.find((n) => n.id === link.a)?.status === "waiting";
                return (
                  <path
                    key={link.key}
                    className="ui-aggc__edge"
                    d={route.d}
                    pathLength={1}
                    data-near={near || undefined}
                    data-ask={asking || undefined}
                    strokeWidth={count > 0 ? Math.min(4, 1.5 + count * 0.3) : undefined}
                    style={{ animationDelay: `${Math.min(24, links.indexOf(link) * 14)}ms` }}
                  />
                );
              })}
            </g>

            <g className="ui-aggc__streaks">
              {pulses.map((pulse) => {
                const t = Math.min(1, Math.max(0, (elapsed - pulse.start) / pulse.duration));
                const head = pulse.reverse ? (1 - t) * pulse.route.length : t * pulse.route.length;
                const tail = pulse.reverse
                  ? Math.min(pulse.route.length, head + STREAK)
                  : Math.max(0, head - STREAK);
                const a = pointAt(pulse.route, tail);
                const b = pointAt(pulse.route, head);
                const opacity = Math.sin(Math.PI * t);
                return (
                  <g key={pulse.key} opacity={opacity}>
                    <line
                      className="ui-aggc__streak-glow"
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={`url(#${uid}-${pulse.kind === "res" ? "res" : pulse.kind === "err" ? "err" : pulse.kind === "ask" ? "ask" : "call"})`}
                    />
                    <line
                      className="ui-aggc__streak"
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={`url(#${uid}-${pulse.kind === "res" ? "res" : pulse.kind === "err" ? "err" : pulse.kind === "ask" ? "ask" : "call"})`}
                    />
                  </g>
                );
              })}
            </g>
          </svg>

          <div className="ui-aggc__nodes">
            {nodes.map((node, index) => {
              const slot = slots[node.id];
              if (!slot) return null;
              const size = slot.size;
              const open = openId === node.id;
              const above = labelSide[node.id] ?? slot.y > graphHeight - 120;
              return (
                <div
                  key={node.id}
                  className="ui-aggc__node"
                  data-node-id={node.id}
                  data-kind={node.kind}
                  data-lead={node.id === lead?.id || undefined}
                  data-status={node.status}
                  data-open={open || undefined}
                  data-dim={openId && !nearIds.includes(node.id) ? true : undefined}
                  style={
                    {
                      "--d": `${size}px`,
                      zIndex: node.id === lead?.id ? 2 : open ? 4 : 1,
                      transform: `translate3d(${slot.x.toFixed(1)}px, ${slot.y.toFixed(1)}px, 0)`,
                    } as CSSProperties
                  }
                >
                  <div className="ui-aggc__body" style={{ animationDelay: `${Math.min(200, index * 26)}ms` }}>
                    <span className="ui-aggc__ring" aria-hidden="true" />
                    <button
                      type="button"
                      className="ui-aggc__disc"
                      aria-haspopup="dialog"
                      aria-expanded={open}
                      aria-label={`${node.name}, ${node.kind}${node.status ? `, ${node.status}` : ""}${node.doing ? `: ${node.doing}` : ""}. ${callsIn(node.id)} calls in the last minute`}
                      onClick={() => {
                        if (open) {
                          close();
                          return;
                        }
                        setOpenId(node.id);
                        onSelect?.(node);
                      }}
                    >
                      {node.icon ?? (
                        node.kind === "user" ? <PersonIcon /> : <span className="ui-aggc__initials">{initialsOf(node.name)}</span>
                      )}
                    </button>
                    <span className="ui-aggc__stroke" aria-hidden="true" />
                    {(node.status === "waiting" || node.status === "error") && (
                      <span className="ui-aggc__badge" data-status={node.status} aria-hidden="true">
                        {node.status === "waiting" ? <ClockIcon /> : <AlertIcon />}
                      </span>
                    )}
                    <span className="ui-aggc__label" data-above={above || undefined}>
                      <span className="ui-aggc__name">{labelFor(node)}</span>
                      {node.kind === "agent" && node.detail && !narrow && (
                        <span className="ui-aggc__line">{node.detail}</span>
                      )}
                      {(node.status === "waiting" || node.status === "error") && (
                        <span className="ui-aggc__line" data-status={node.status}>
                          {node.status === "waiting" ? "Needs you" : "Failed"}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {openNode && openSlot && (
            <div
              className="ui-aggc__card"
              role="dialog"
              aria-label={`${openNode.name} details`}
              style={{
                left: Math.max(8, Math.min(width - 268, openSlot.x + openSlot.size / 2 + 14)),
                top: Math.max(8, Math.min(graphHeight - 210, openSlot.y - 40)),
              }}
            >
              <div className="ui-aggc__card-head">
                <span className="ui-aggc__card-icon" data-kind={openNode.kind} aria-hidden="true">
                  {openNode.icon ?? (openNode.kind === "user" ? <PersonIcon /> : initialsOf(openNode.name))}
                </span>
                <span className="ui-aggc__card-who">
                  <span className="ui-aggc__card-name">{openNode.name}</span>
                  <span className="ui-aggc__card-detail">
                    {openNode.detail ?? (openNode.kind === "user" ? "You" : openNode.kind)}
                  </span>
                </span>
                {openNode.status && (
                  <span className="ui-aggc__pill" data-status={openNode.status}>
                    {openNode.status === "working" ? "Working" : openNode.status === "waiting" ? "Needs you" : openNode.status === "error" ? "Failed" : openNode.status === "done" ? "Done" : "Idle"}
                  </span>
                )}
                <button type="button" className="ui-aggc__close" onClick={close} aria-label="Close">
                  <CloseIcon />
                </button>
              </div>

              {openNode.doing && <p className="ui-aggc__doing">{openNode.doing}</p>}

              {openCalls.length > 0 && (
                <ul className="ui-aggc__calls">
                  {openCalls.map((call) => {
                    const outgoing = call.from === openNode.id;
                    const other = byId[outgoing ? call.to : call.from];
                    return (
                      <li key={call.id} className="ui-aggc__call" data-status={call.status ?? "pending"}>
                        <span className="ui-aggc__call-dir" aria-hidden="true">
                          {outgoing ? <ArrowRightIcon /> : <ArrowLeftIcon />}
                        </span>
                        <span className="ui-aggc__call-icon" aria-hidden="true">
                          {other?.icon ?? initialsOf(other?.name ?? "?")}
                        </span>
                        <span className="ui-aggc__call-text">
                          <span className="ui-aggc__call-who">{other?.name ?? "Unknown"}</span>
                          {call.label ? ` · ${call.label}` : ""}
                        </span>
                        <span className="ui-aggc__call-end">
                          {call.status === "pending"
                            ? "live"
                            : call.ms !== undefined
                              ? call.ms >= 1000
                                ? `${(call.ms / 1000).toFixed(1)}s`
                                : `${call.ms}ms`
                              : call.status === "error"
                                ? "failed"
                                : "ok"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="ui-aggc__card-foot">
                <span>{openNode.kind === "user" ? "You" : openNode.kind === "tool" ? "Tool" : "Agent"}</span>
                {openNode.cost !== undefined && <span className="ui-aggc__card-cost">{formatCost(openNode.cost)}</span>}
              </div>
            </div>
          )}
        </div>

        <div className="ui-aggc__legend" aria-hidden="true">
          {(
            [
              ["Call", "call"],
              ["Answer", "res"],
              ["Needs you", "ask"],
              ["Failed", "err"],
            ] as const
          ).map(([label, kind]) => (
            <span key={kind}>
              <svg width="22" height="8" viewBox="0 0 22 8" fill="none">
                <defs>
                  <linearGradient id={`${uid}-legend-${kind}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" className="ui-aggc__legend-stop" data-kind={kind} stopOpacity="0" />
                    <stop offset="50%" className="ui-aggc__legend-stop" data-kind={kind} stopOpacity="1" />
                    <stop offset="100%" className="ui-aggc__legend-stop" data-kind={kind} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <line x1="0" y1="4" x2="22" y2="4" className="ui-aggc__legend-streak" stroke={`url(#${uid}-legend-${kind})`} />
              </svg>
              {label}
            </span>
          ))}
        </div>

        <p className="ui-aggc__sr" role="status" aria-live="polite">
          {nodes
            .map((node) => {
              const count = calls.filter(
                (call) => call.at >= time - 60000 && (call.from === node.id || call.to === node.id),
              ).length;
              const cost = node.cost !== undefined ? `, ${formatCost(node.cost)}` : "";
              return `${node.name}, ${node.kind}, ${node.status ?? "idle"}, ${count} calls in the last minute${cost}`;
            })
            .join(". ")}
        </p>
      </div>
    </section>
  );
}

/* ---------- icons ---------- */

const ClockIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.6V8l2.2 1.5" />
  </svg>
);

const AlertIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    <path d="M8 3.4v5.2" />
    <circle cx="8" cy="11.8" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

const PersonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="8.5" r="3.4" />
    <path d="M5.4 19.2a6.9 6.9 0 0 1 13.2 0" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    <path d="m4.6 4.6 6.8 6.8M11.4 4.6l-6.8 6.8" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 8h9M8.6 4.4 12.2 8l-3.6 3.6" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M13 8H4M7.4 4.4 3.8 8l3.6 3.6" />
  </svg>
);

/* ---------- Styles ---------- */

const css = /* css */ `
@property --ui-aggc-state{syntax: "<color>";inherits: true;initial-value: transparent}
@property --ui-aggc-state-bg{syntax: "<color>";inherits: true;initial-value: transparent}
.ui-aggc{--ui-aggc-panel: #fffdfb;--ui-aggc-card: #fffdfb;--ui-aggc-strong: #0b0908;--ui-aggc-ink: rgba(11, 9, 8, 0.88);--ui-aggc-text: rgba(11, 9, 8, 0.61);--ui-aggc-muted: rgba(11, 9, 8, 0.45);--ui-aggc-faint: rgba(11, 9, 8, 0.27);--ui-aggc-line: rgba(11, 9, 8, 0.06);--ui-aggc-fill: rgba(11, 9, 8, 0.06);--ui-aggc-link: rgba(11, 9, 8, 0.07);--ui-aggc-pulse: rgba(217, 84, 31, 0.8);--ui-aggc-glow: rgba(255, 138, 92, 0.16);--ui-aggc-breath: rgba(217, 84, 31, 0.12);--ui-aggc-breath-out: rgba(217, 84, 31, 0.02);--ui-aggc-user-bg: rgba(11, 9, 8, 0.88);--ui-aggc-user-fg: #fcf9f7;--ui-aggc-brand-bg: #ff6b3519;--ui-aggc-brand-fg: #d9541ff2;--ui-aggc-ok: #2f8d5c;--ui-aggc-ok-bg: #1a7a4a19;--ui-aggc-ok-fg: #1a7a4ae0;--ui-aggc-warn: #e8b05c;--ui-aggc-warn-bg: #d9953029;--ui-aggc-warn-fg: #d9541f;--ui-aggc-danger: #e2544a;--ui-aggc-danger-bg: #b3261e18;--ui-aggc-shine: rgba(255, 253, 251, 0.75);--ui-aggc-danger-fg: #b3261eda;--ui-aggc-focus: rgba(217, 84, 31, 0.35);--ui-aggc-pop: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 12px 28px -10px rgba(11, 9, 8, 0.18), 0 1px 2px rgba(11, 9, 8, 0.05);--ui-aggc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-aggc-lift: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 1px 2px 0 rgba(11, 9, 8, 0.06), 0 4px 12px -4px rgba(11, 9, 8, 0.12);--ui-aggc-ease: cubic-bezier(0.32, 0.72, 0.24, 1);position: relative;box-sizing: border-box;width: 100%;min-width: 0;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;font-weight: 400;line-height: 20px;color: var(--ui-aggc-text);text-align: left;-webkit-font-smoothing: antialiased}
.ui-aggc *, .ui-aggc *::before, .ui-aggc *::after{box-sizing: border-box}
:where(.ui-aggc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;text-align: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-aggc button:focus-visible{outline: 2px solid var(--ui-aggc-focus);outline-offset: 1px}
.ui-aggc p, .ui-aggc ul{margin: 0;padding: 0}
.ui-aggc svg{display: block;flex: none;overflow: visible}
.ui-aggc__bar{display: flex;flex-wrap: wrap;align-items: center;gap: 4px 8px;min-width: 0;margin-bottom: 16px}
.ui-aggc__mark{display: grid;flex: none;place-items: center;width: 16px;color: var(--ui-aggc-pulse)}
.ui-aggc__title{flex: none;font-weight: 500;color: var(--ui-aggc-strong)}
.ui-aggc__sum{display: flex;flex-wrap: wrap;justify-content: flex-end;align-items: center;gap: 2px 12px;margin-left: auto;font-size: 12px;line-height: 16px;color: var(--ui-aggc-muted);font-variant-numeric: tabular-nums;white-space: nowrap}
.ui-aggc__sum b{font-weight: 500;color: var(--ui-aggc-ink)}
.ui-aggc__sum-cost{min-width: 40px;font-weight: 500;color: var(--ui-aggc-ink);text-align: right}
.ui-aggc[data-narrow] .ui-aggc__bar{row-gap: 6px}
.ui-aggc[data-narrow] .ui-aggc__title{line-height: 22px}
.ui-aggc[data-narrow] .ui-aggc__sum{flex-basis: 100%;justify-content: space-between;gap: 2px 8px;margin-left: 0}
.ui-aggc__panel{position: relative;overflow: hidden;border-radius: 10px;background: var(--ui-aggc-panel);box-shadow: var(--ui-aggc-shadow)}
.ui-aggc__stage{position: relative;width: 100%;min-height: 200px;container-type: inline-size}
.ui-aggc__svg{position: absolute;inset: 0;pointer-events: none}
.ui-aggc__halo{animation: ui-aggc-fade-in var(--nm-dur-6, 1100ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-aggc__edge{fill: none;stroke: var(--ui-aggc-link);stroke-width: 1.5;stroke-linecap: round;opacity: 1;stroke-dasharray: 1 1;stroke-dashoffset: 0;animation: ui-aggc-draw var(--nm-dur-5, 620ms) var(--ui-aggc-ease) backwards;transition: opacity var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), stroke var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-aggc__edge[data-ask]{stroke: var(--ui-aggc-warn);opacity: 0.9}
.ui-aggc__edge[data-error]{stroke: var(--ui-aggc-danger);opacity: 1;transition-duration: var(--nm-dur-1, 90ms), var(--nm-dur-1, 90ms)}
.ui-aggc__edge[data-leaving]{stroke-dashoffset: 0;animation: ui-aggc-retract var(--nm-dur-4, 380ms) var(--ui-aggc-ease) forwards}
.ui-aggc[data-focus] .ui-aggc__edge:not([data-near]){opacity: 0.1}
.ui-aggc[data-focus] .ui-aggc__edge[data-near]{opacity: 1}
.ui-aggc[data-focus] .ui-aggc__pulse{opacity: 0.25}
.ui-aggc__streak{fill: none;stroke-width: 2;stroke-linecap: round}
.ui-aggc__streak-glow{fill: none;stroke-width: 4;stroke-linecap: round;opacity: 0.2}
.ui-aggc__stop{stop-color: var(--ui-aggc-pulse)}
.ui-aggc__pulse[data-kind="res"] .ui-aggc__stop{stop-color: var(--ui-aggc-ok)}
.ui-aggc__pulse:is([data-kind="ask"], [data-kind="askres"]) .ui-aggc__stop{stop-color: var(--ui-aggc-warn)}
.ui-aggc__pulse[data-kind="err"] .ui-aggc__stop{stop-color: var(--ui-aggc-danger)}
.ui-aggc__ripple{fill: none;stroke: var(--ui-aggc-pulse);stroke-width: 1}
.ui-aggc__ripple:is([data-kind="ask"], [data-kind="askres"]){stroke: var(--ui-aggc-warn)}
.ui-aggc__ripple[data-kind="err"]{stroke: var(--ui-aggc-danger);stroke-width: 1.5}
.ui-aggc__ripple[data-kind="res"]{stroke: var(--ui-aggc-ok)}
.ui-aggc__nodes{position: absolute;inset: 0;pointer-events: none}
.ui-aggc__node{position: absolute;top: 0;left: 0;width: 0;height: 0;transition: opacity var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));will-change: transform}
.ui-aggc[data-focus] .ui-aggc__node[data-dim]{opacity: 0.3}
.ui-aggc__body{position: absolute;top: 0;left: 0;transform-origin: 0 0;animation: ui-aggc-pop var(--nm-dur-5, 620ms) var(--ui-aggc-ease) both}
.ui-aggc__node[data-leaving] .ui-aggc__body{animation: ui-aggc-out var(--nm-dur-4, 380ms) var(--ui-aggc-ease) forwards}
.ui-aggc__disc{position: absolute;top: calc(var(--d) / -2);left: calc(var(--d) / -2);display: grid;place-items: center;width: var(--d);height: var(--d);border-radius: 50%;background: var(--ui-aggc-card);box-shadow: inset 0 0 0 999px var(--ui-aggc-state-bg), var(--ui-aggc-shadow);color: var(--ui-aggc-text);pointer-events: auto;transition: width var(--nm-dur-3, 240ms) var(--ui-aggc-ease), height var(--nm-dur-3, 240ms) var(--ui-aggc-ease), top var(--nm-dur-3, 240ms) var(--ui-aggc-ease), left var(--nm-dur-3, 240ms) var(--ui-aggc-ease), box-shadow 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 240ms var(--ui-aggc-ease)}
.ui-aggc__disc::before{content: "";position: absolute;inset: -6px;border-radius: 50%}
.ui-aggc__disc:hover, .ui-aggc__node[data-open] .ui-aggc__disc{transform: scale(1.06)}
.ui-aggc__disc > svg{width: 46%;height: 46%}
.ui-aggc__initials{font-size: 11px;font-weight: 500;color: var(--ui-aggc-text)}
.ui-aggc__node[data-kind="agent"] .ui-aggc__disc{box-shadow: inset 0 0 0 999px var(--ui-aggc-state-bg), var(--ui-aggc-lift)}
.ui-aggc__node[data-kind="agent"] .ui-aggc__disc > svg{width: 44%;height: 44%}
.ui-aggc__node[data-kind="user"] .ui-aggc__disc{background: var(--ui-aggc-user-bg);color: var(--ui-aggc-user-fg);box-shadow: 0 1px 2px rgba(11, 9, 8, 0.16)}
.ui-aggc__node[data-kind="user"] .ui-aggc__disc > svg{width: 42%;height: 42%}
.ui-aggc__ring{position: absolute;top: calc(var(--d) / -2);left: calc(var(--d) / -2);width: var(--d);height: var(--d);border-radius: 50%;opacity: 0;transition: opacity var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-aggc__node[data-status="working"] .ui-aggc__ring{opacity: 1;animation: ui-aggc-breathe var(--nm-dur-6, 1100ms) ease-in-out infinite}
.ui-aggc__node{--ui-aggc-state: transparent;--ui-aggc-state-bg: transparent;transition: opacity var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), --ui-aggc-state var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), --ui-aggc-state-bg var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-aggc__node[data-status="waiting"]{--ui-aggc-state: var(--ui-aggc-warn);--ui-aggc-state-bg: var(--ui-aggc-warn-bg)}
.ui-aggc__node[data-status="error"]{--ui-aggc-state: var(--ui-aggc-danger);--ui-aggc-state-bg: var(--ui-aggc-danger-bg)}
.ui-aggc__stroke{position: absolute;top: calc(var(--d) / -2);left: calc(var(--d) / -2);width: var(--d);height: var(--d);border-radius: 50%;background: conic-gradient(from 0deg, transparent 0deg, transparent 40deg, var(--ui-aggc-state) 360deg);-webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 1.25px), #0b0908 calc(100% - 0.75px));mask: radial-gradient(farthest-side, transparent calc(100% - 1.25px), #0b0908 calc(100% - 0.75px));pointer-events: none;animation: ui-aggc-spin var(--nm-dur-6, 1100ms) linear infinite;transition: width var(--nm-dur-3, 240ms) var(--ui-aggc-ease), height var(--nm-dur-3, 240ms) var(--ui-aggc-ease), top var(--nm-dur-3, 240ms) var(--ui-aggc-ease), left var(--nm-dur-3, 240ms) var(--ui-aggc-ease)}
.ui-aggc__node:is([data-status="waiting"], [data-status="error"]) .ui-aggc__disc::after{content: "";position: absolute;inset: 0;border-radius: 50%;background: linear-gradient(110deg, transparent 30%, var(--ui-aggc-shine) 50%, transparent 70%) 130% 0 / 250% 100% no-repeat;pointer-events: none;animation: ui-aggc-shimmer var(--nm-dur-6, 1100ms) ease-in-out infinite}
.ui-aggc__badge{position: absolute;top: calc(var(--d) * -0.36 - 8px);left: calc(var(--d) * 0.36 - 6px);display: grid;place-items: center;width: 14px;height: 14px;border-radius: 50%;box-shadow: 0 0 0 2px var(--ui-aggc-panel);color: #fffdfb;pointer-events: none;animation: ui-aggc-pop var(--nm-dur-4, 380ms) var(--ui-aggc-ease) both}
.ui-aggc__badge > svg{width: 10px;height: 10px}
.ui-aggc__badge[data-status="waiting"]{background: var(--ui-aggc-warn)}
.ui-aggc__badge[data-status="error"]{background: var(--ui-aggc-danger)}
.ui-aggc__badge[data-status="done"]{background: color-mix(in srgb, var(--ui-aggc-ok) 18%, var(--ui-aggc-panel));color: var(--ui-aggc-ok)}
.ui-aggc__label{position: absolute;top: calc(var(--d) / 2 + 5px);left: 0;display: grid;justify-items: center;padding: 0 5px;border-radius: 5px;background: var(--ui-aggc-panel);box-shadow: 0 0 6px 2px var(--ui-aggc-panel);transform: translateX(-50%);white-space: nowrap;pointer-events: none}
.ui-aggc__label[data-above]{top: auto;bottom: calc(var(--d) / 2 + 5px)}
.ui-aggc__node[data-kind="agent"] .ui-aggc__label{top: calc(var(--d) / 2 + 6px)}
.ui-aggc__node[data-kind="agent"] .ui-aggc__label[data-above]{top: auto;bottom: calc(var(--d) / 2 + 6px)}
.ui-aggc__name{font-size: 12px;line-height: 16px;color: var(--ui-aggc-text)}
.ui-aggc__node[data-kind="agent"] .ui-aggc__name{font-weight: 500;color: var(--ui-aggc-strong)}
.ui-aggc__line{font-size: 11px;line-height: 14px;color: var(--ui-aggc-muted)}
.ui-aggc__line[data-status="waiting"]{font-weight: 500;color: var(--ui-aggc-warn-fg)}
.ui-aggc__line[data-status="error"]{font-weight: 500;color: var(--ui-aggc-danger-fg)}
.ui-aggc[data-narrow] .ui-aggc__name{font-size: 11px;line-height: 14px}
.ui-aggc[data-narrow] .ui-aggc__ring{--ui-aggc-b1: 4px;--ui-aggc-b2: 9px}
.ui-aggc[data-narrow] .ui-aggc__label{padding: 0 4px}
.ui-aggc__alerts{display: flex;flex-wrap: wrap;gap: 6px;min-width: 0}
.ui-aggc__chip{display: inline-flex;align-items: center;gap: 4px;height: 22px;margin: -2px 0;padding: 0 7px 0 5px;border-radius: 5px;font-size: 12px;font-weight: 500;white-space: nowrap;animation: ui-aggc-rise var(--nm-dur-4, 380ms) var(--ui-aggc-ease) both;transition: filter 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-aggc__chip > svg{width: 13px;height: 13px}
.ui-aggc__chip[data-kind="waiting"]{background: var(--ui-aggc-warn-bg);color: var(--ui-aggc-warn-fg)}
.ui-aggc__chip[data-kind="error"]{background: var(--ui-aggc-danger-bg);color: var(--ui-aggc-danger-fg)}
.ui-aggc__chip:hover{filter: saturate(1.3) brightness(0.97)}
.ui-aggc__card{position: absolute;z-index: 5;display: grid;gap: 10px;width: 260px;padding: 10px;border-radius: 10px;background: var(--ui-aggc-card);box-shadow: var(--ui-aggc-pop);animation: ui-aggc-rise var(--nm-dur-3, 240ms) var(--ui-aggc-ease) both}
.ui-aggc[data-narrow] .ui-aggc__card{right: 8px;bottom: 8px;left: 8px;width: auto}
.ui-aggc__card-head{display: flex;align-items: center;gap: 8px;min-width: 0}
.ui-aggc__card-icon{display: grid;flex: none;place-items: center;width: 28px;height: 28px;border-radius: 50%;background: var(--ui-aggc-card);box-shadow: var(--ui-aggc-shadow);font-size: 10px;font-weight: 500;color: var(--ui-aggc-text)}
.ui-aggc__card-icon > svg{width: 14px;height: 14px}
.ui-aggc__card-icon[data-kind="user"]{background: var(--ui-aggc-user-bg);color: var(--ui-aggc-user-fg);box-shadow: none}
.ui-aggc__card-who{display: grid;flex: 1;min-width: 0}
.ui-aggc__card-name{overflow: hidden;font-weight: 500;line-height: 16px;color: var(--ui-aggc-strong);white-space: nowrap;text-overflow: ellipsis}
.ui-aggc__card-detail{overflow: hidden;font-size: 11px;line-height: 14px;color: var(--ui-aggc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-aggc__pill{flex: none;height: 18px;padding: 0 6px;border-radius: 4px;background: var(--ui-aggc-fill);font-size: 11px;font-weight: 500;line-height: 18px;color: var(--ui-aggc-text);white-space: nowrap}
.ui-aggc__pill[data-status="working"]{background: var(--ui-aggc-brand-bg);color: var(--ui-aggc-brand-fg)}
.ui-aggc__pill[data-status="waiting"]{background: var(--ui-aggc-warn-bg);color: var(--ui-aggc-warn-fg)}
.ui-aggc__pill[data-status="error"]{background: var(--ui-aggc-danger-bg);color: var(--ui-aggc-danger-fg)}
.ui-aggc__pill[data-status="done"]{background: var(--ui-aggc-ok-bg);color: var(--ui-aggc-ok-fg)}
.ui-aggc__close{display: grid;flex: none;place-items: center;width: 24px;height: 24px;margin: -3px -3px -3px -2px;border-radius: 6px;color: var(--ui-aggc-muted);transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-aggc__close:hover{background: var(--ui-aggc-fill);color: var(--ui-aggc-ink)}
.ui-aggc__doing{font-size: 12px;line-height: 16px;color: var(--ui-aggc-text)}
.ui-aggc__calls{display: grid;border-top: 0.5px solid var(--ui-aggc-line);border-bottom: 0.5px solid var(--ui-aggc-line);list-style: none}
.ui-aggc__call{display: flex;align-items: center;gap: 6px;min-width: 0;height: 28px;font-size: 12px;line-height: 16px;animation: ui-aggc-rise var(--nm-dur-3, 240ms) var(--ui-aggc-ease) both}
.ui-aggc__call + .ui-aggc__call{border-top: 0.5px solid var(--ui-aggc-line)}
.ui-aggc__call-dir{display: grid;flex: none;place-items: center;color: var(--ui-aggc-faint)}
.ui-aggc__call-icon{display: grid;flex: none;place-items: center;width: 16px;height: 16px;font-size: 7.5px;font-weight: 500;color: var(--ui-aggc-text)}
.ui-aggc__call-icon > svg{width: 13px;height: 13px}
.ui-aggc__call-text{flex: 1;min-width: 0;overflow: hidden;white-space: nowrap;text-overflow: ellipsis;color: var(--ui-aggc-muted)}
.ui-aggc__call-who{font-weight: 500;color: var(--ui-aggc-ink)}
.ui-aggc__call-end{flex: none;font-size: 11px;color: var(--ui-aggc-muted);font-variant-numeric: tabular-nums}
.ui-aggc__call[data-status="pending"] .ui-aggc__call-end{color: var(--ui-aggc-brand-fg)}
.ui-aggc__call[data-status="error"] .ui-aggc__call-end{font-weight: 500;color: var(--ui-aggc-danger-fg)}
.ui-aggc__spin{animation: ui-aggc-spin var(--nm-dur-6, 1100ms) linear infinite}
.ui-aggc__card-foot{display: flex;align-items: center;gap: 8px;font-size: 12px;line-height: 16px;color: var(--ui-aggc-muted);font-variant-numeric: tabular-nums}
.ui-aggc__card-cost{font-weight: 500;color: var(--ui-aggc-ink)}
.ui-aggc__legend{display: flex;flex-wrap: wrap;justify-content: center;gap: 4px 14px;padding: 0 10px 10px;font-size: 11px;line-height: 16px;color: var(--ui-aggc-muted)}
.ui-aggc__legend > span{display: inline-flex;align-items: center;gap: 6px}
.ui-aggc__legend-streak{fill: none;stroke-width: 2;stroke-linecap: round}
.ui-aggc__legend-stop{stop-color: var(--ui-aggc-pulse)}
.ui-aggc__legend-stop[data-kind="answer"]{stop-color: var(--ui-aggc-ok)}
.ui-aggc__legend-stop[data-kind="ask"]{stop-color: var(--ui-aggc-warn)}
.ui-aggc__legend-stop[data-kind="error"]{stop-color: var(--ui-aggc-danger)}
.ui-aggc__sr{position: absolute;width: 1px;height: 1px;margin: -1px;padding: 0;overflow: hidden;clip: rect(0 0 0 0);white-space: nowrap;border: 0}
@property --ui-aggc-turn{syntax: "<angle>";inherits: false;initial-value: 0deg}
.ui-aggc .ui-aggc__node{--ui-aggc-r: calc(var(--d) * 0.27)}
.ui-aggc :is(.ui-aggc__disc, .ui-aggc__ring, .ui-aggc__disc::after){border-radius: var(--ui-aggc-r)}
.ui-aggc .ui-aggc__disc::before{border-radius: calc(var(--ui-aggc-r) + 6px)}
.ui-aggc .ui-aggc__badge{top: calc(var(--d) / -2 - 6px);left: calc(var(--d) / 2 - 9px)}
.ui-aggc .ui-aggc__card-icon{border-radius: 8px}
.ui-aggc .ui-aggc__stroke{box-sizing: border-box;padding: 1px;border-radius: var(--ui-aggc-r);background: conic-gradient(from var(--ui-aggc-turn), transparent 0deg, transparent 40deg, var(--ui-aggc-state) 360deg);-webkit-mask: linear-gradient(#0b0908 0 0) content-box, linear-gradient(#0b0908 0 0);-webkit-mask-composite: xor;mask: linear-gradient(#0b0908 0 0) content-box exclude, linear-gradient(#0b0908 0 0);animation: ui-aggc-turn var(--nm-dur-6, 1100ms) linear infinite}
@keyframes ui-aggc-turn{to{--ui-aggc-turn: 360deg}
}
@keyframes ui-aggc-draw{from{stroke-dashoffset: 1}
}
@keyframes ui-aggc-retract{from{stroke-dashoffset: 0}
to{stroke-dashoffset: 1;opacity: 0}
}
@keyframes ui-aggc-pop{from{opacity: 0;transform: scale(0.4)}
}
@keyframes ui-aggc-out{to{opacity: 0;transform: scale(0.5)}
}
@keyframes ui-aggc-rise{from{opacity: 0;transform: translateY(4px) scale(0.98)}
}
@keyframes ui-aggc-fade-in{from{opacity: 0}
}
@keyframes ui-aggc-breathe{0%, 100%{box-shadow: 0 0 0 var(--ui-aggc-b1, 5px) var(--ui-aggc-breath)}
50%{box-shadow: 0 0 0 var(--ui-aggc-b2, 11px) var(--ui-aggc-breath-out)}
}
@keyframes ui-aggc-shimmer{0%{background-position: 130% 0}
55%, 100%{background-position: -30% 0}
}
@keyframes ui-aggc-spin{to{transform: rotate(360deg)}
}
@media (prefers-reduced-motion: reduce){.ui-aggc *, .ui-aggc *::before, .ui-aggc *::after{animation: none !important;transition: none !important}
.ui-aggc__edge{stroke-dasharray: none}
}
:where(.dark, [data-theme="dark"]) .ui-aggc{--ui-aggc-panel: #211b16;--ui-aggc-card: #27201a;--ui-aggc-strong: #fffdfb;--ui-aggc-ink: rgba(255, 253, 251, 0.9);--ui-aggc-text: rgba(255, 253, 251, 0.62);--ui-aggc-muted: rgba(255, 253, 251, 0.45);--ui-aggc-faint: rgba(255, 253, 251, 0.28);--ui-aggc-line: rgba(255, 253, 251, 0.08);--ui-aggc-fill: rgba(255, 253, 251, 0.08);--ui-aggc-link: rgba(255, 253, 251, 0.08);--ui-aggc-pulse: #ff8a5c;--ui-aggc-glow: rgba(255, 107, 53, 0.14);--ui-aggc-breath: rgba(255, 138, 92, 0.16);--ui-aggc-breath-out: rgba(255, 138, 92, 0.03);--ui-aggc-user-bg: rgba(255, 253, 251, 0.92);--ui-aggc-user-fg: #1a1512;--ui-aggc-brand-bg: #ff6b353a;--ui-aggc-brand-fg: #ff8a5c;--ui-aggc-ok: #2f8d5c;--ui-aggc-ok-bg: #2f8d5c1f;--ui-aggc-ok-fg: #2f8d5c;--ui-aggc-warn: #ff8a5c;--ui-aggc-warn-bg: #ff6b3525;--ui-aggc-warn-fg: #ff8a5c;--ui-aggc-danger: #e2544a;--ui-aggc-danger-bg: #e2544a2b;--ui-aggc-shine: rgba(255, 253, 251, 0.16);--ui-aggc-danger-fg: #e2544a;--ui-aggc-focus: rgba(255, 138, 92, 0.45);--ui-aggc-pop: 0 0 0 0.5px rgba(255, 253, 251, 0.12), 0 12px 28px -10px rgba(11, 9, 8, 0.6);--ui-aggc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-aggc-lift: 0 0 0 0.5px rgba(255, 253, 251, 0.14), 0 1px 2px 0 rgba(11, 9, 8, 0.4), 0 4px 12px -4px rgba(11, 9, 8, 0.5)}

`;
