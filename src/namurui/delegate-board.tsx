"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

/*
 * Delegate Board – hand work to your agents by dropping it on them, in a single self-contained file.
 * A task lifts off the pile as a tilted ghost that follows the pointer; the agent underneath lights
 * up and previews the exact second it would be free if it took the job ("+12m until 02:50") along
 * with what that costs at its per-minute rate. A drop that would push an agent past its capacity is
 * refused out loud instead of silently queued.
 * Dragging is built on pointer events rather than HTML5 drag-and-drop, so a finger, a pen and a
 * mouse all work and the ghost can be drawn as real markup. The same job can be done without a
 * pointer: Enter picks a task, the arrow keys walk the roster, Enter again hands it over, and the
 * number keys jump straight to the agent that carries that badge. Auto drains the pile by itself,
 * one task at a time, always to whoever will be free first.
 * Dragged chips travel the other way: dropping one on the pile puts it back.
 * The styles are injected below, so no extra files are needed.
 */

/** The brand marks the board can draw – task tools and agent avatars share the set. */
export type DelegateBrand =
  | "claude"
  | "openai"
  | "gemini"
  | "stripe"
  | "notion"
  | "slack"
  | "figma"
  | "github"
  | "salesforce";

/** One piece of work waiting for an agent. */
export type DelegateTask = {
  id: string;
  title: string;
  /** Minutes of agent time the task takes. Drives the estimate, the preview and the price. */
  minutes: number;
  /** Tools it will touch, drawn as small marks beside the estimate. */
  tools?: DelegateBrand[];
};

/** One agent that can take work. */
export type DelegateAgent = {
  id: string;
  /** Shown beside its number badge. */
  name: string;
  /** Model that runs the work, e.g. "Opus 5.5". */
  model: string;
  /** Dollars per minute of work; the queue total and the preview price are built from it. */
  rate: number;
  /** Minutes of queued work it will accept. A drop past this is refused. */
  capacity: number;
  /**
   * Epoch ms at which the task it runs right now finishes – the head of the queue. The rest of
   * the queue is added on top. Omit it and the whole queue is scheduled from the current time.
   */
  busyUntil?: number;
  /** Work handed over, oldest first. The first item is the one running. */
  queue?: DelegateTask[];
  /** Avatar mark; falls back to initials when it is missing. */
  logo?: DelegateBrand;
  /** Two characters for the avatar when there is no logo. Defaults to the name's initials. */
  initials?: string;
};

export type DelegateBoardProps = {
  agents: DelegateAgent[];
  /** Work still in the pile. Everything else lives in an agent's queue. */
  tasks: DelegateTask[];
  /** Called on every hand-off. `null` puts the task back in the pile. */
  onAssign: (taskId: string, agentId: string | null) => void;
  /** Controlled Auto switch. */
  auto?: boolean;
  defaultAuto?: boolean;
  onAutoChange?: (auto: boolean) => void;
  /** Task shown as picked on first render – what a click or Enter would have selected. */
  defaultPickedId?: string | null;
  /** Agent shown as the drop target on first render, so a preview is visible without input. */
  defaultTargetAgentId?: string | null;
  /** Clock to render against, in epoch ms. Defaults to the real one, ticking every 15s. */
  now?: number;
  title?: string;
  hint?: string;
  /** Heading over the pile. */
  pileLabel?: string;
  /** Heading over the roster. */
  agentsLabel?: string;
  autoLabel?: string;
  /** Copy shown when nothing is left to hand over. */
  emptyLabel?: string;
  /** Screen-reader instructions attached to every task. */
  howTo?: string;
  className?: string;
};

type DragView = {
  taskId: string;
  /** Ghost offset inside the board, in px. */
  x: number;
  y: number;
  width: number;
  target: string | null;
  overPile: boolean;
};

type Gesture = {
  taskId: string;
  pointerId: number;
  startX: number;
  startY: number;
  grabX: number;
  grabY: number;
  width: number;
  moved: boolean;
};

const DEFAULT_HOW =
  "Drag onto an agent, or press Enter, choose with the arrow keys and press Enter again. Number keys hand it over at once.";

/** Distance a pointer must travel before a press becomes a drag. */
const SLOP = 4;

/** How long Auto waits between two hand-offs, so the pile visibly drains. */
const AUTO_DELAY = 900;

/** Chips shown before the queue folds the rest into "+N". */
const MAX_CHIPS = 3;

const MINUTE = 60_000;

const clockOf = (at: number) => {
  const when = new Date(at);
  return `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`;
};

/** When everything the agent holds is done – the clock behind "Busy until". */
const queueEnd = (agent: DelegateAgent, at: number) => {
  const queue = agent.queue ?? [];
  const deadline = agent.busyUntil;
  /* A deadline means the first item is already running, so only the rest add to it. */
  if (deadline !== undefined && deadline > at) {
    return queue.slice(1).reduce((end, task) => end + task.minutes * MINUTE, deadline);
  }
  return queue.reduce((end, task) => end + task.minutes * MINUTE, at);
};

const initialsOf = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

export function DelegateBoard({
  agents,
  tasks,
  onAssign,
  auto,
  defaultAuto = false,
  onAutoChange,
  defaultPickedId = null,
  defaultTargetAgentId = null,
  now,
  title = "Delegate",
  hint = "Drag a task onto an agent",
  pileLabel = "Unassigned",
  agentsLabel = "Agents",
  autoLabel = "Auto",
  emptyLabel = "Nothing left to hand over",
  howTo = DEFAULT_HOW,
  className,
}: DelegateBoardProps) {
  const uid = useId();
  const pileId = `${uid}-pile`;
  const rosterId = `${uid}-agents`;
  const howId = `${uid}-how`;

  const [ownAuto, setOwnAuto] = useState(defaultAuto);
  const isAuto = auto ?? ownAuto;
  const [picked, setPicked] = useState<string | null>(defaultPickedId);
  const [target, setTarget] = useState<string | null>(defaultTargetAgentId);
  const [drag, setDrag] = useState<DragView | null>(null);
  const [said, setSaid] = useState("");
  const [ticked, setTicked] = useState(() => Date.now());
  const at = now ?? ticked;

  const root = useRef<HTMLDivElement>(null);
  const pile = useRef<HTMLElement>(null);
  const agentNodes = useRef(new Map<string, HTMLElement>());
  const gesture = useRef<Gesture | null>(null);
  const dragView = useRef<DragView | null>(null);
  const droppedAt = useRef(0);
  const attempted = useRef(new Set<string>());

  /* A real clock only matters while nobody hands one in. */
  useEffect(() => {
    if (now !== undefined) return;
    const id = window.setInterval(() => setTicked(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [now]);

  const track = (id: string, node: HTMLElement | null) => {
    if (node) agentNodes.current.set(id, node);
    else agentNodes.current.delete(id);
  };

  const put = (next: DragView | null) => {
    dragView.current = next;
    setDrag(next);
  };

  const findTask = (id: string): DelegateTask | undefined => {
    const waiting = tasks.find((task) => task.id === id);
    if (waiting) return waiting;
    for (const agent of agents) {
      const found = (agent.queue ?? []).find((task) => task.id === id);
      if (found) return found;
    }
    return undefined;
  };

  const fits = (agent: DelegateAgent, task: DelegateTask) =>
    (queueEnd(agent, at) - at) / MINUTE + task.minutes <= agent.capacity;

  const chooseAgent = (task: DelegateTask): DelegateAgent | null => {
    let best: DelegateAgent | null = null;
    let bestEnd = Number.POSITIVE_INFINITY;
    for (const agent of agents) {
      if (!fits(agent, task)) continue;
      const end = queueEnd(agent, at);
      if (end < bestEnd || (end === bestEnd && (best === null || agent.rate < best.rate))) {
        best = agent;
        bestEnd = end;
      }
    }
    return best;
  };

  const hand = (taskId: string, agentId: string | null) => {
    const task = findTask(taskId);
    const agent = agentId === null ? null : (agents.find((item) => item.id === agentId) ?? null);
    if (agentId !== null && agent === null) return;
    /* Already queued there – a drop inside its own lane changes nothing. */
    if (agent && (agent.queue ?? []).some((item) => item.id === taskId)) {
      setPicked(null);
      setTarget(null);
      return;
    }
    /* Dropped back where it already sits – same story. */
    if (!agent && tasks.some((item) => item.id === taskId)) {
      setPicked(null);
      setTarget(null);
      return;
    }
    if (agent && task && !fits(agent, task)) {
      setSaid(`${agent.name} is at capacity. ${task.title} stays where it is.`);
      return;
    }
    setPicked(null);
    setTarget(null);
    if (task && agent) setSaid(`${task.title} to ${agent.name}`);
    else if (task) setSaid(`${task.title} back in the pile`);
    onAssign(taskId, agentId);
  };

  const hitAgent = (x: number, y: number): string | null => {
    for (const [id, node] of agentNodes.current) {
      const box = node.getBoundingClientRect();
      if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) return id;
    }
    return null;
  };

  const hitPile = (x: number, y: number) => {
    const box = pile.current?.getBoundingClientRect();
    if (!box) return false;
    return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  };

  /* The drag lives on window listeners: the ghost is pointer-events:none, so the element under
   * the pointer is never the one receiving the move and capture alone would not do. */
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const held = gesture.current;
      if (!held || event.pointerId !== held.pointerId) return;
      if (!held.moved) {
        if (Math.abs(event.clientX - held.startX) < SLOP && Math.abs(event.clientY - held.startY) < SLOP) {
          return;
        }
        held.moved = true;
      }
      const board = root.current?.getBoundingClientRect();
      const agentId = hitAgent(event.clientX, event.clientY);
      put({
        taskId: held.taskId,
        x: event.clientX - (board?.left ?? 0) - held.grabX,
        y: event.clientY - (board?.top ?? 0) - held.grabY,
        width: held.width,
        target: agentId,
        overPile: agentId === null && hitPile(event.clientX, event.clientY),
      });
      setTarget(agentId);
    };

    const up = (event: PointerEvent) => {
      const held = gesture.current;
      if (!held || event.pointerId !== held.pointerId) return;
      gesture.current = null;
      const landed = dragView.current;
      put(null);
      if (!held.moved) return; /* a press that never moved is a pick, not a drop */
      droppedAt.current = Date.now();
      if (landed?.target) hand(held.taskId, landed.target);
      else if (landed?.overPile) hand(held.taskId, null);
    };

    const cancel = () => {
      gesture.current = null;
      put(null);
    };

    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      gesture.current = null;
      put(null);
      setPicked(null);
      setTarget(null);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", escape);
    };
  });

  /* Auto: the pile drains one task at a time, each to whoever is free first. The ids already
   * attempted are remembered, so a parent that never moves the task cannot loop the same drop. */
  useEffect(() => {
    if (!isAuto) return;
    const next = tasks.find((task) => !attempted.current.has(task.id));
    if (!next || gesture.current) return;
    const agent = chooseAgent(next);
    if (!agent) return;
    const id = window.setTimeout(() => {
      attempted.current.add(next.id);
      setPicked((current) => (current === next.id ? null : current));
      setSaid(`${next.title} to ${agent.name}`);
      onAssign(next.id, agent.id);
    }, AUTO_DELAY);
    return () => window.clearTimeout(id);
  });

  /* Switching Auto back on gives every task another chance. */
  useEffect(() => {
    if (!isAuto) attempted.current.clear();
  }, [isAuto]);

  const startGrab = (event: ReactPointerEvent<HTMLButtonElement>, taskId: string) => {
    if (event.button !== 0) return;
    const box = event.currentTarget.getBoundingClientRect();
    gesture.current = {
      taskId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      grabX: event.clientX - box.left,
      grabY: event.clientY - box.top,
      width: box.width,
      moved: false,
    };
    setPicked(taskId);
  };

  const toggle = () => {
    const next = !isAuto;
    if (auto === undefined) setOwnAuto(next);
    onAutoChange?.(next);
  };

  const activeId = drag?.taskId ?? picked;
  const activeTask = activeId ? findTask(activeId) : undefined;

  const onTaskKey = (event: ReactKeyboardEvent<HTMLButtonElement>, taskId: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (picked !== taskId) {
        setPicked(taskId);
        if (!target) setTarget(agents[0]?.id ?? null);
        return;
      }
      const destination =
        target ?? (isAuto && activeTask ? (chooseAgent(activeTask)?.id ?? null) : null);
      if (destination) hand(taskId, destination);
      return;
    }
    if (
      event.key !== "ArrowDown" &&
      event.key !== "ArrowRight" &&
      event.key !== "ArrowUp" &&
      event.key !== "ArrowLeft"
    ) {
      return;
    }
    if (picked !== taskId) return;
    event.preventDefault();
    const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
    const index = agents.findIndex((agent) => agent.id === target);
    const next =
      index === -1
        ? step === 1
          ? 0
          : agents.length - 1
        : (index + step + agents.length) % agents.length;
    setTarget(agents[next]?.id ?? null);
  };

  const onBoardKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!picked || !/^[1-9]$/.test(event.key)) return;
    const agent = agents[Number(event.key) - 1];
    if (!agent) return;
    event.preventDefault();
    hand(picked, agent.id);
  };

  const onAgentClick = (event: ReactMouseEvent<HTMLLIElement>, agentId: string) => {
    if (Date.now() - droppedAt.current < 300) return;
    if ((event.target as HTMLElement).closest(".ui-dbc__chip")) return;
    if (!picked) return;
    hand(picked, agentId);
  };

  /* Money still to spend: the time left on every queue at that agent's rate. */
  const spend = agents.reduce(
    (total, agent) => total + ((queueEnd(agent, at) - at) / MINUTE) * agent.rate,
    0,
  );

  return (
    <div
      ref={root}
      className={["ui-dbc", className].filter(Boolean).join(" ")}
      data-dragging={drag ? "" : undefined}
      onKeyDown={onBoardKey}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-delegate-board" precedence="default">
        {css}
      </style>

      <div className="ui-dbc__card">
        <header className="ui-dbc__bar">
          <span className="ui-dbc__spark">
            <SparkIcon />
          </span>
          <span className="ui-dbc__title">{title}</span>
          <span className="ui-dbc__hint">{hint}</span>
          <button
            type="button"
            role="switch"
            aria-checked={isAuto}
            className="ui-dbc__auto"
            onClick={toggle}
          >
            <span className="ui-dbc__auto-label">{autoLabel}</span>
            <span className="ui-dbc__switch" aria-hidden="true">
              <span />
            </span>
          </button>
        </header>

        <div className="ui-dbc__body">
          <section
            ref={pile}
            className="ui-dbc__pile"
            data-pile=""
            aria-labelledby={pileId}
            data-over={drag?.overPile ? "" : undefined}
          >
            <h4 className="ui-dbc__head" id={pileId}>
              {pileLabel}{" "}
              <span className="ui-dbc__count">{tasks.length}</span>
            </h4>
            <ul className="ui-dbc__tasks">
              {tasks.map((task) => (
                <li className="ui-dbc__task-slot" key={task.id}>
                  <button
                    type="button"
                    className="ui-dbc__task"
                    data-task-id={task.id}
                    aria-describedby={howId}
                    data-picked={picked === task.id ? "" : undefined}
                    data-dragging={drag?.taskId === task.id ? "" : undefined}
                    onPointerDown={(event) => startGrab(event, task.id)}
                    onKeyDown={(event) => onTaskKey(event, task.id)}
                  >
                    <TaskBody task={task} />
                  </button>
                </li>
              ))}
            </ul>
            {tasks.length === 0 ? <div className="ui-dbc__empty">{emptyLabel}</div> : null}
          </section>

          <section className="ui-dbc__agents" aria-labelledby={rosterId}>
            <h4 className="ui-dbc__head" id={rosterId}>
              {agentsLabel}
              <span className="ui-dbc__spend">{`$${spend.toFixed(2)} in queues`}</span>
            </h4>
            <ul className="ui-dbc__roster">
              {agents.map((agent, index) => {
                const end = queueEnd(agent, at);
                const busy = end > at;
                const queued = agent.queue ?? [];
                const running = busy && queued.length > 0;
                const showing = queued.slice(0, MAX_CHIPS);
                const folded = queued.slice(MAX_CHIPS);
                const previewing =
                  activeTask !== undefined &&
                  target === agent.id &&
                  !queued.some((task) => task.id === activeTask.id);
                const tagKind = previewing ? "preview" : busy ? "busy" : "free";
                return (
                  <li
                    className="ui-dbc__agent"
                    key={agent.id}
                    data-agent={agent.id}
                    data-target={previewing ? "" : undefined}
                    ref={(node) => track(agent.id, node)}
                    onClick={(event) => onAgentClick(event, agent.id)}
                  >
                    <span
                      className="ui-dbc__avatar"
                      data-logo={agent.logo ? "" : undefined}
                    >
                      {agent.logo ? <BrandMark brand={agent.logo} /> : (agent.initials ?? initialsOf(agent.name))}
                    </span>
                    <span className="ui-dbc__who">
                      <span className="ui-dbc__name-line">
                        <span className="ui-dbc__name">{agent.name}</span>
                        <span className="ui-dbc__key" aria-hidden="true">
                          {index + 1}
                        </span>
                      </span>
                      <span className="ui-dbc__model">
                        {agent.model}
                        <span className="ui-dbc__rate">{`$${agent.rate.toFixed(2)}/min`}</span>
                      </span>
                    </span>
                    <span className="ui-dbc__load">
                      {previewing && activeTask ? (
                        <span className="ui-dbc__price">{`+$${(agent.rate * activeTask.minutes).toFixed(2)}`}</span>
                      ) : null}
                      <span className="ui-dbc__tag" data-kind={tagKind}>
                        {previewing && activeTask
                          ? `+${activeTask.minutes}m until ${clockOf(end + activeTask.minutes * MINUTE)}`
                          : busy
                            ? `Busy until ${clockOf(end)}`
                            : "Free"}
                      </span>
                    </span>
                    <ul className="ui-dbc__queue" aria-label={`${agent.name}'s queue`}>
                      {showing.map((task, slot) => (
                        <li className="ui-dbc__chip-slot" key={task.id}>
                          <button
                            type="button"
                            className="ui-dbc__chip"
                            data-chip-id={task.id}
                            data-running={running && slot === 0 ? "" : undefined}
                            data-dragging={drag?.taskId === task.id ? "" : undefined}
                            title={`${task.title} · ~${task.minutes} min`}
                            onPointerDown={(event) => startGrab(event, task.id)}
                          >
                            {running && slot === 0 ? (
                              <SpinnerIcon />
                            ) : task.tools?.length ? (
                              <span className="ui-dbc__tools" aria-hidden="true">
                                {task.tools.map((tool) => (
                                  <span className="ui-dbc__tool" key={tool}>
                                    <BrandMark brand={tool} />
                                  </span>
                                ))}
                              </span>
                            ) : null}
                            <span className="ui-dbc__chip-title">{task.title}</span>
                          </button>
                        </li>
                      ))}
                      {folded.length ? (
                        <li className="ui-dbc__chip-slot ui-dbc__more">
                          <button type="button" className="ui-dbc__chip ui-dbc__chip--more">
                            {`+${folded.length}`}
                          </button>
                          <div className="ui-dbc__tip">
                            <ul className="ui-dbc__tip-list">
                              {folded.map((task) => (
                                <li key={task.id}>
                                  {task.title}
                                  <span className="ui-dbc__tip-min">{`~${task.minutes} min`}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </li>
                      ) : null}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>

      <span className="ui-dbc__sr" id={howId}>
        {howTo}
      </span>
      <span className="ui-dbc__sr" aria-live="polite">
        {said}
      </span>

      {drag && activeTask ? (
        <div
          className="ui-dbc__ghost"
          style={{ left: drag.x, top: drag.y, width: drag.width }}
        >
          <TaskBody task={activeTask} />
        </div>
      ) : null}
    </div>
  );
}

/** The inside of a task card – the same in the pile, under the pointer and in the ghost. */
function TaskBody({ task }: { task: DelegateTask }) {
  return (
    <>
      <span className="ui-dbc__grip">
        <GripIcon />
      </span>
      <span className="ui-dbc__task-main">
        <span className="ui-dbc__task-title">{task.title}</span>
        <span className="ui-dbc__task-meta">
          {task.tools?.length ? (
            <span className="ui-dbc__tools" aria-hidden="true">
              {task.tools.map((tool) => (
                <span className="ui-dbc__tool" key={tool}>
                  <BrandMark brand={tool} />
                </span>
              ))}
            </span>
          ) : null}
          {`~${task.minutes} min`}
        </span>
      </span>
    </>
  );
}

/** One brand mark at the size the sheet gives it. */
function BrandMark({ brand }: { brand: DelegateBrand }) {
  switch (brand) {
    case "claude":
      return <ClaudeIcon />;
    case "openai":
      return <OpenAiIcon />;
    case "gemini":
      return <GeminiIcon />;
    case "stripe":
      return <StripeIcon />;
    case "notion":
      return <NotionIcon />;
    case "slack":
      return <SlackIcon />;
    case "figma":
      return <FigmaIcon />;
    case "github":
      return <GithubIcon />;
    case "salesforce":
      return <SalesforceIcon />;
  }
}

const SparkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <path
      d="M7 1.2c.4 2.9 1.9 4.4 4.8 4.8-2.9.4-4.4 1.9-4.8 4.8C6.6 7.9 5.1 6.4 2.2 6 5.1 5.6 6.6 4.1 7 1.2Z"
      fill="currentColor"
    />
    <circle cx="11.6" cy="11.4" r="1.1" fill="currentColor" opacity="0.55" />
  </svg>
);

const GripIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
    <circle cx="4.3" cy="3" r="0.95" fill="currentColor" />
    <circle cx="7.7" cy="3" r="0.95" fill="currentColor" />
    <circle cx="4.3" cy="6" r="0.95" fill="currentColor" />
    <circle cx="7.7" cy="6" r="0.95" fill="currentColor" />
    <circle cx="4.3" cy="9" r="0.95" fill="currentColor" />
    <circle cx="7.7" cy="9" r="0.95" fill="currentColor" />
  </svg>
);

const SpinnerIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="ui-dbc__spin">
    <circle
      cx="6"
      cy="6"
      r="4.6"
      fill="none"
      stroke="currentColor"
      strokeOpacity="0.25"
      strokeWidth="1.6"
    />
    <path
      d="M6 1.4a4.6 4.6 0 0 1 4.6 4.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const NotionIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    style={{ color: "var(--ui-dbc-strong, var(--ui-db-ink, #000))" }}
  >
    <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
  </svg>
);

const GithubIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    style={{ color: "var(--ui-dbc-strong, var(--ui-db-ink, #181717))" }}
  >
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

const SlackIcon = () => (
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

const FigmaIcon = () => (
  <svg viewBox="0 0 38 57" aria-hidden="true">
    <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0Z" fill="#1ABCFE" />
    <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0Z" fill="#0ACF83" />
    <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19Z" fill="#FF7262" />
    <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5Z" fill="#F24E1E" />
    <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5Z" fill="#A259FF" />
  </svg>
);

const SalesforceIcon = () => (
  <svg viewBox="0 0 24 24" fill="#FF7A59" aria-hidden="true">
    <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z" />
  </svg>
);

const StripeIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect width="24" height="24" rx="6" fill="#635BFF" />
    <path
      fill="#fff"
      transform="translate(5 5) scale(0.5833)"
      d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z"
    />
  </svg>
);

const ClaudeIcon = () => (
  <svg viewBox="0 0 1200 1200" aria-hidden="true">
    <path
      fill="#D97757"
      d="M 233.959793 800.214905 L 468.644287 668.536987 L 472.590637 657.100647 L 468.644287 650.738403 L 457.208069 650.738403 L 417.986633 648.322144 L 283.892639 644.69812 L 167.597321 639.865845 L 54.926208 633.825623 L 26.577238 627.785339 L 3.3e-05 592.751709 L 2.73832 575.27533 L 26.577238 559.248352 L 60.724873 562.228149 L 136.187973 567.382629 L 249.422867 575.194763 L 331.570496 580.026978 L 453.261841 592.671082 L 472.590637 592.671082 L 475.328857 584.859009 L 468.724915 580.026978 L 463.570557 575.194763 L 346.389313 495.785217 L 219.543671 411.865906 L 153.100723 363.543762 L 117.181267 339.060425 L 99.060455 316.107361 L 91.248367 266.01355 L 123.865784 230.093994 L 167.677887 233.073853 L 178.872513 236.053772 L 223.248367 270.201477 L 318.040283 343.570496 L 441.825592 434.738342 L 459.946411 449.798706 L 467.194672 444.64447 L 468.080597 441.020203 L 459.946411 427.409485 L 392.617493 305.718323 L 320.778564 181.932983 L 288.80542 130.630859 L 280.348999 99.865845 C 277.369171 87.221436 275.194641 76.590698 275.194641 63.624268 L 312.322174 13.20813 L 332.8591 6.604126 L 382.389313 13.20813 L 403.248352 31.328979 L 434.013519 101.71814 L 483.865753 212.537048 L 561.181274 363.221497 L 583.812134 407.919434 L 595.892639 449.315491 L 600.40271 461.959839 L 608.214783 461.959839 L 608.214783 454.711609 L 614.577271 369.825623 L 626.335632 265.61084 L 637.771851 131.516846 L 641.718201 93.745117 L 660.402832 48.483276 L 697.530334 24.000122 L 726.52356 37.852417 L 750.362549 72 L 747.060486 94.067139 L 732.886047 186.201416 L 705.100708 330.52356 L 686.979919 427.167847 L 697.530334 427.167847 L 709.61084 415.087341 L 758.496704 350.174561 L 840.644348 247.490051 L 876.885925 206.738342 L 919.167847 161.71814 L 946.308838 140.29541 L 997.61084 140.29541 L 1035.38269 196.429626 L 1018.469849 254.416199 L 965.637634 321.422852 L 921.825562 378.201538 L 859.006714 462.765259 L 819.785278 530.41626 L 823.409424 535.812073 L 832.75177 534.92627 L 974.657776 504.724915 L 1051.328979 490.872559 L 1142.818848 475.167786 L 1184.214844 494.496582 L 1188.724854 514.147644 L 1172.456421 554.335693 L 1074.604126 578.496765 L 959.838989 601.449829 L 788.939636 641.879272 L 786.845764 643.409485 L 789.261841 646.389343 L 866.255127 653.637634 L 899.194702 655.409424 L 979.812134 655.409424 L 1129.932861 666.604187 L 1169.154419 692.537109 L 1192.671265 724.268677 L 1188.724854 748.429688 L 1128.322144 779.194641 L 1046.818848 759.865845 L 856.590759 714.604126 L 791.355774 698.335754 L 782.335693 698.335754 L 782.335693 703.731567 L 836.69812 756.885986 L 936.322205 846.845581 L 1061.073975 962.81897 L 1067.436279 991.490112 L 1051.409424 1014.120911 L 1034.496704 1011.704712 L 924.885986 929.234924 L 882.604126 892.107544 L 786.845764 811.48999 L 780.483276 811.48999 L 780.483276 819.946289 L 802.550415 852.241699 L 919.087341 1027.409424 L 925.127625 1081.127686 L 916.671204 1098.604126 L 886.469849 1109.154419 L 853.288696 1103.114136 L 785.073914 1007.355835 L 714.684631 899.516785 L 657.906067 802.872498 L 650.979858 806.81897 L 617.476624 1167.704834 L 601.771851 1186.147705 L 565.530212 1200 L 535.328857 1177.046997 L 519.302124 1139.919556 L 535.328857 1066.550537 L 554.657776 970.792053 L 570.362488 894.68457 L 584.536926 800.134277 L 592.993347 768.724976 L 592.429626 766.630859 L 585.503479 767.516968 L 514.22821 865.369263 L 405.825531 1011.865906 L 320.053711 1103.677979 L 299.516815 1111.812256 L 263.919525 1093.369263 L 267.221497 1060.429688 L 287.114136 1031.114136 L 405.825531 880.107361 L 477.422913 786.52356 L 523.651062 732.483276 L 523.328918 724.671265 L 520.590698 724.671265 L 205.288605 929.395935 L 149.154434 936.644409 L 124.993355 914.01355 L 127.973183 876.885986 L 139.409409 864.80542 L 234.201385 799.570435 L 233.879227 799.8927 Z"
    />
  </svg>
);

const OpenAiIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    style={{ color: "var(--ui-dbc-strong, var(--ui-db-ink, #000))" }}
  >
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
  </svg>
);

const GeminiIcon = () => {
  const uid = useId();
  const fill = `gm_${uid.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={fill} x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1C7DFF" />
          <stop offset="0.52" stopColor="#1C69FF" />
          <stop offset="1" stopColor="#B04DFF" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${fill})`}
        d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"
      />
    </svg>
  );
};

const css = /* css */ `
.ui-dbc{--ui-dbc-card: #fffdfb;--ui-dbc-strong: #0b0908;--ui-dbc-ink: rgba(11, 9, 8, 0.88);--ui-dbc-text: rgba(11, 9, 8, 0.61);--ui-dbc-muted: rgba(11, 9, 8, 0.45);--ui-dbc-faint: rgba(11, 9, 8, 0.27);--ui-dbc-line: rgba(11, 9, 8, 0.06);--ui-dbc-wash: rgba(11, 9, 8, 0.03);--ui-dbc-lane: rgba(11, 9, 8, 0.035);--ui-dbc-switch-off: rgba(11, 9, 8, 0.12);--ui-dbc-fill: rgba(11, 9, 8, 0.06);--ui-dbc-accent: rgba(217, 84, 31, 0.765);--ui-dbc-brand-bg: #ff6b3519;--ui-dbc-brand-fg: #d9541ff2;--ui-dbc-warn-bg: #d9953029;--ui-dbc-warn-fg: #d9541f;--ui-dbc-ok-bg: #1a7a4a19;--ui-dbc-ok-fg: #1a7a4ade;--ui-dbc-focus: rgba(217, 84, 31, 0.35);--ui-dbc-target-bg: rgba(255, 107, 53, 0.045);--ui-dbc-target-edge: rgba(217, 84, 31, 0.3);--ui-dbc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-dbc-lift: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 16px 32px -12px rgba(11, 9, 8, 0.25), 0 2px 6px rgba(11, 9, 8, 0.06);--ui-dbc-ease: cubic-bezier(0.32, 0.72, 0.24, 1);position: relative;box-sizing: border-box;width: 100%;max-width: 720px;container-type: inline-size;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;font-weight: 400;line-height: 20px;color: var(--ui-dbc-text);text-align: left;-webkit-font-smoothing: antialiased}
.ui-dbc[data-dragging]{cursor: grabbing;user-select: none;-webkit-user-select: none}
.ui-dbc *, .ui-dbc *::before, .ui-dbc *::after{box-sizing: border-box}
:where(.ui-dbc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;text-align: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-dbc button:focus-visible{outline: 2px solid var(--ui-dbc-focus);outline-offset: 1px}
.ui-dbc ul{margin: 0;padding: 0;list-style: none}
.ui-dbc h4{margin: 0}
.ui-dbc svg{display: block;flex: none}
.ui-dbc__sr{position: absolute;width: 1px;height: 1px;overflow: hidden;clip-path: inset(50%);white-space: nowrap}
.ui-dbc__card{border-radius: 10px;background: var(--ui-dbc-card);box-shadow: var(--ui-dbc-shadow)}
.ui-dbc__bar{display: flex;align-items: center;gap: 10px;min-width: 0;padding: 12px 12px 12px 16px;border-bottom: 0.5px solid var(--ui-dbc-line)}
.ui-dbc__spark{display: grid;flex: none;place-items: center;width: 16px;color: var(--ui-dbc-accent)}
.ui-dbc__title{font-weight: 500;color: var(--ui-dbc-strong);white-space: nowrap}
.ui-dbc__hint{flex: 1;min-width: 0;overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-dbc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-dbc__auto{display: inline-flex;flex: none;align-items: center;gap: 8px;height: 28px;padding: 0 2px 0 6px;border-radius: 6px}
.ui-dbc__auto-label{font-size: 12px;font-weight: 500;color: var(--ui-dbc-strong);transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dbc__auto[aria-checked="false"] .ui-dbc__auto-label{opacity: 0.45}
.ui-dbc__switch{position: relative;width: 28px;height: 16px;border-radius: 999px;background: var(--ui-dbc-switch-off);transition: background-color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dbc__switch > span{position: absolute;top: 2px;left: 2px;width: 12px;height: 12px;border-radius: 50%;background: #fffdfb;box-shadow: 0 1px 2px rgba(11, 9, 8, 0.18), 0 0 0 0.5px rgba(11, 9, 8, 0.04);transition: transform 240ms var(--ui-dbc-ease)}
.ui-dbc__auto[aria-checked="true"] .ui-dbc__switch{background: var(--ui-dbc-accent)}
.ui-dbc__auto[aria-checked="true"] .ui-dbc__switch > span{transform: translateX(12px)}
.ui-dbc__body{display: grid;grid-template-columns: 236px minmax(0, 1fr)}
.ui-dbc__head{display: flex;align-items: center;gap: 6px;margin: 0 4px 8px !important;font-size: 12px;font-weight: 400;line-height: 16px;color: var(--ui-dbc-muted)}
.ui-dbc__count{display: grid;place-items: center;min-width: 16px;height: 16px;padding: 0 4px;border-radius: 4px;background: var(--ui-dbc-card);box-shadow: var(--ui-dbc-shadow);font-size: 10px;font-weight: 500;color: var(--ui-dbc-text);font-variant-numeric: tabular-nums}
.ui-dbc__pile{margin: 12px 0 12px 12px;padding: 10px 6px 6px;border-radius: 10px;background: var(--ui-dbc-lane);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dbc__pile .ui-dbc__head{margin-left: 6px !important}
.ui-dbc__pile[data-over]{box-shadow: inset 0 0 0 1px var(--ui-dbc-line)}
.ui-dbc__tasks{display: grid;gap: 4px}
.ui-dbc__task, .ui-dbc__ghost{display: flex;align-items: flex-start;gap: 8px;width: 100%;padding: 8px 10px 8px 6px;border-radius: 8px;background: var(--ui-dbc-card);box-shadow: var(--ui-dbc-shadow);cursor: grab;touch-action: none;transition: opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dbc__task:hover{box-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.1), 0 2px 6px -2px rgba(11, 9, 8, 0.12)}
.ui-dbc__task[data-dragging], .ui-dbc__chip[data-dragging]{opacity: 0.35}
.ui-dbc__task[data-picked]{background: var(--ui-dbc-target-bg);box-shadow: inset 0 0 0 0.5px var(--ui-dbc-target-edge), var(--ui-dbc-shadow)}
.ui-dbc__grip{display: grid;flex: none;place-items: center;width: 12px;height: 20px;color: var(--ui-dbc-faint)}
.ui-dbc__task-main{display: grid;gap: 2px;min-width: 0}
.ui-dbc__task-title{overflow: hidden;font-weight: 500;color: var(--ui-dbc-ink);white-space: nowrap;text-overflow: ellipsis}
.ui-dbc__task-meta{display: flex;align-items: center;gap: 6px;font-size: 12px;line-height: 16px;color: var(--ui-dbc-muted);font-variant-numeric: tabular-nums}
.ui-dbc__tools{display: flex;gap: 4px}
.ui-dbc__tool, .ui-dbc__tool > svg{display: grid;width: 12px;height: 12px}
.ui-dbc__empty{display: grid;place-items: center;min-height: 52px;padding: 8px 10px;font-size: 12px;line-height: 16px;color: var(--ui-dbc-muted);text-align: center}
.ui-dbc__ghost{position: absolute;z-index: 1000;box-shadow: var(--ui-dbc-lift);cursor: grabbing;pointer-events: none;transform: rotate(1.5deg) scale(1.02)}
.ui-dbc__agents{padding: 14px 12px 12px}
.ui-dbc__roster{display: grid;gap: 4px}
.ui-dbc__agent{display: grid;grid-template-columns: 28px minmax(0, 1fr) auto;grid-template-areas: "avatar who load" "avatar queue queue";column-gap: 10px;row-gap: 6px;padding: 8px 8px 8px 8px;border-radius: 8px;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dbc[data-dragging] .ui-dbc__agent{box-shadow: inset 0 0 0 0.5px var(--ui-dbc-line)}
.ui-dbc__agent[data-target]{background: var(--ui-dbc-target-bg)}
.ui-dbc__avatar{grid-area: avatar;display: grid;place-items: center;width: 28px;height: 28px;border-radius: 7px;background: var(--ui-dbc-fill);font-size: 10px;font-weight: 500;color: var(--ui-dbc-text)}
.ui-dbc__avatar[data-logo]{background: var(--ui-dbc-card);box-shadow: var(--ui-dbc-shadow)}
.ui-dbc__avatar > svg{width: 15px;height: 15px}
.ui-dbc__who{grid-area: who;display: grid;min-width: 0}
.ui-dbc__name-line{display: flex;align-items: center;gap: 6px;min-width: 0}
.ui-dbc__name{overflow: hidden;font-weight: 500;color: var(--ui-dbc-ink);white-space: nowrap;text-overflow: ellipsis}
.ui-dbc__key{display: none;place-items: center;min-width: 16px;height: 16px;padding: 0 4px;border-radius: 4px;background: var(--ui-dbc-card);box-shadow: var(--ui-dbc-shadow);font-size: 10px;font-weight: 500;color: var(--ui-dbc-muted)}
.ui-dbc:focus-within .ui-dbc__key{display: grid}
.ui-dbc__model{overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-dbc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-dbc__load{grid-area: load;align-self: start;display: flex;align-items: center;gap: 8px}
.ui-dbc__spend{margin-left: auto;font-variant-numeric: tabular-nums;animation: ui-dbc-in var(--nm-dur-3, 240ms) var(--ui-dbc-ease) both}
.ui-dbc__rate{margin-left: 6px;color: var(--ui-dbc-faint);font-variant-numeric: tabular-nums}
.ui-dbc__price{font-size: 11px;font-weight: 500;line-height: 16px;color: var(--ui-dbc-brand-fg);white-space: nowrap;font-variant-numeric: tabular-nums;animation: ui-dbc-in var(--nm-dur-3, 240ms) var(--ui-dbc-ease) both}
.ui-dbc__tag{display: inline-flex;align-items: center;height: 20px;padding: 0 7px;border-radius: 5px;font-size: 11px;font-weight: 500;line-height: 16px;white-space: nowrap;font-variant-numeric: tabular-nums;animation: ui-dbc-in var(--nm-dur-3, 240ms) var(--ui-dbc-ease) both}
.ui-dbc__tag[data-kind="free"]{background: var(--ui-dbc-ok-bg);color: var(--ui-dbc-ok-fg)}
.ui-dbc__tag[data-kind="busy"]{background: var(--ui-dbc-fill);color: var(--ui-dbc-text)}
.ui-dbc__tag[data-kind="preview"]{background: var(--ui-dbc-card);box-shadow: var(--ui-dbc-shadow);color: var(--ui-dbc-brand-fg)}
.ui-dbc__queue{grid-area: queue;display: flex;flex-wrap: wrap;gap: 4px;min-width: 0}
.ui-dbc__queue:empty{display: none}
.ui-dbc__chip-slot{min-width: 0;max-width: 100%}
.ui-dbc__chip{display: flex;align-items: center;gap: 5px;max-width: 100%;height: 24px;padding: 0 8px 0 6px;border-radius: 6px;background: var(--ui-dbc-card);box-shadow: var(--ui-dbc-shadow);font-size: 12px;line-height: 16px;color: var(--ui-dbc-text);cursor: grab;touch-action: none}
.ui-dbc__chip[data-running]{background: var(--ui-dbc-brand-bg);box-shadow: none;color: var(--ui-dbc-brand-fg);font-weight: 500}
.ui-dbc__chip-title{min-width: 0;max-width: 150px;overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-dbc__more{position: relative}
.ui-dbc__chip--more{padding: 0 8px;font-weight: 500;color: var(--ui-dbc-text);cursor: default}
.ui-dbc__tip{position: absolute;bottom: calc(100% + 6px);left: 50%;z-index: 10;display: grid;width: max-content;max-width: none;padding: 8px 10px;border-radius: 8px;background: rgba(30, 24, 20, 0.92);-webkit-backdrop-filter: blur(8px);backdrop-filter: blur(8px);box-shadow: 0 8px 24px -8px rgba(11, 9, 8, 0.35);font-size: 12px;line-height: 16px;color: rgba(255, 253, 251, 0.86);text-align: left;opacity: 0;visibility: hidden;transform: translate(-50%, 3px);transition: opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), visibility 0s linear 160ms;pointer-events: none}
.ui-dbc__more:hover .ui-dbc__tip, .ui-dbc__more:focus-within .ui-dbc__tip{opacity: 1;visibility: visible;transform: translate(-50%, 0);transition: opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), visibility 0s}
.ui-dbc__tip-list{display: grid;gap: 2px}
.ui-dbc__tip-list li{display: flex;align-items: center;gap: 6px;white-space: nowrap}
.ui-dbc__tip{--ui-dbc-strong: #fffdfb;--ui-db-ink: #fffdfb}
.ui-dbc__tip-min{color: rgba(255, 253, 251, 0.5)}
.ui-dbc__spin{animation: ui-dbc-spin var(--nm-dur-6, 1100ms) linear infinite}
@keyframes ui-dbc-spin{to{transform: rotate(360deg)}
}
@keyframes ui-dbc-in{from{opacity: 0;transform: translateY(2px)}
}
@container (max-width: 560px){.ui-dbc__body{grid-template-columns: minmax(0, 1fr)}
.ui-dbc__pile{margin: 12px 12px 0}
.ui-dbc__hint{display: none}
}
@media (pointer: coarse){.ui-dbc__auto{height: 34px}
.ui-dbc__chip{height: 30px}
}
@media (prefers-reduced-motion: reduce){.ui-dbc *, .ui-dbc *::before, .ui-dbc *::after{animation: none !important;transition: none !important}
.ui-dbc__ghost{transform: none}
}
:where(.dark, [data-theme="dark"]) .ui-dbc{--ui-dbc-card: #211b16;--ui-dbc-strong: #fffdfb;--ui-dbc-ink: rgba(255, 253, 251, 0.9);--ui-dbc-text: rgba(255, 253, 251, 0.62);--ui-dbc-muted: rgba(255, 253, 251, 0.45);--ui-dbc-faint: rgba(255, 253, 251, 0.28);--ui-dbc-line: rgba(255, 253, 251, 0.08);--ui-dbc-wash: rgba(255, 253, 251, 0.04);--ui-dbc-lane: rgba(255, 253, 251, 0.035);--ui-dbc-switch-off: rgba(255, 253, 251, 0.16);--ui-dbc-fill: rgba(255, 253, 251, 0.08);--ui-dbc-accent: #ff8a5c;--ui-dbc-brand-bg: #ff6b353a;--ui-dbc-brand-fg: #ff8a5c;--ui-dbc-warn-bg: #ff6b3525;--ui-dbc-warn-fg: #ff8a5c;--ui-dbc-ok-bg: #4f9d6e1e;--ui-dbc-ok-fg: #4f9d6ed4;--ui-dbc-focus: rgba(255, 138, 92, 0.45);--ui-dbc-target-bg: rgba(255, 138, 92, 0.08);--ui-dbc-target-edge: rgba(255, 138, 92, 0.35);--ui-dbc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-dbc-lift: 0 0 0 0.5px rgba(255, 253, 251, 0.14), 0 16px 32px -12px rgba(11, 9, 8, 0.7)}
:where(.dark, [data-theme="dark"]) .ui-dbc__tip{background: rgba(250, 247, 244, 0.94);box-shadow: 0 8px 24px -8px rgba(11, 9, 8, 0.6);color: rgba(11, 9, 8, 0.82)}
:where(.dark, [data-theme="dark"]) .ui-dbc__tip{--ui-dbc-strong: rgba(11, 9, 8, 0.88);--ui-db-ink: rgba(11, 9, 8, 0.88)}
:where(.dark, [data-theme="dark"]) .ui-dbc__tip-min{color: rgba(11, 9, 8, 0.5)}
:where(.dark, [data-theme="dark"])
`;
