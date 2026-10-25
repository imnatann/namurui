"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

/*
 * Agent Lanes – every agent on one shared timeline, in a single self-contained file.
 * Each agent owns a lane and each task is a block placed on a time scale that ends at "now", so
 * running work keeps growing while finished work slides left with the window. A hand-off draws a
 * dashed curve from the block that ends to the task that picks it up, and the task that needs a
 * person opens its decision beside its lane. The window re-anchors on the minute and the whole
 * layer slides by the sub-minute remainder, so the right edge is always the present moment.
 * The styles are injected below, so no extra files are needed.
 */

/** A brand mark for an agent avatar or a tool chip – the marks ship inline */
export type LaneLogo =
  | "claude"
  | "openai"
  | "gemini"
  | "google"
  | "notion"
  | "slack"
  | "figma"
  | "github"
  | "linear"
  | "hubspot"
  | "stripe";

/** What an agent is doing right now – drives the chip and the header summary */
export type LaneAgentState = "running" | "idle" | "waiting";

export type LaneAgent = {
  /** Stable id – tasks point at it with their agentId */
  id: string;
  /** The lane label, e.g. "Researcher" */
  name: string;
  /** The model or runtime under the name, e.g. "Opus 5.5" */
  model?: string;
  /** The mark on the avatar tile; without one the first letter shows */
  logo?: LaneLogo;
  /** Pins the chip; without it the agent's own lanes decide (waiting, running, else idle) */
  state?: LaneAgentState;
  /** Overrides the chip word, e.g. "Blocked on CI" */
  stateLabel?: string;
};

export type LaneTaskStatus = "done" | "running" | "waiting" | "failed";

export type LaneTask = {
  /** Stable id – also what a hand-off points at */
  id: string;
  /** The lane this block sits on */
  agentId: string;
  /** What the block says, e.g. "Competitor pricing" */
  title: string;
  /** Done, running, waiting on a person, or failed */
  status: LaneTaskStatus;
  /** When it started, epoch ms */
  start: number;
  /** When it stopped; a running or waiting task has none and reaches "now" */
  end?: number;
  /** The id of the task that picks this up – drawn as a curve between the lanes */
  handoffTo?: string;
  /** What happened, one line each, listed in the task's popover */
  detail?: string[];
  /** The single decision a waiting task needs – a waiting task without one shows its details */
  ask?: string;
  /** Marks of the apps this task works in – three at most */
  tools?: LaneLogo[];
};

export type AgentLanesProps = {
  /** One lane per agent, top to bottom */
  agents: LaneAgent[];
  /** Every block on the timeline */
  tasks: LaneTask[];
  /** How much history the lanes show, in ms (default 30 minutes) */
  span?: number;
  /** A clock you own; without it the lanes follow the real one */
  now?: number;
  /** Approve what a waiting task asks for */
  onApprove?: (task: LaneTask) => void;
  /** Stop a waiting task as it stands */
  onReject?: (task: LaneTask) => void;
  /** Open a task in its full run view */
  onOpen?: (task: LaneTask) => void;
  /** Header label (default "Agents") */
  title?: string;
  /** Extra class on the root, merged after "ui-alc" */
  className?: string;
};

const MINUTE = 60_000;
/** Must match --ui-alc-row: the curve overlay is measured in the same steps */
const ROW = 48;
const AXIS_TICKS = 5;
/** .ui-alc__ask is a fixed 280px wide, so the popover clamps against it */
const ASK_WIDTH = 280;
/** .ui-alc__tip is at most 220px wide and centres itself on the block: half is the clamp */
const TIP_HALF = 110;

const STATUS_WORD: Record<LaneTaskStatus, string> = {
  done: "Done",
  running: "Running",
  waiting: "Needs you",
  failed: "Failed",
};

/** Six significant figures – the axis, the slide and every block share one scale */
const percent = (value: number) => `${Number(value.toPrecision(6))}%`;

const shortSpan = (ms: number) => {
  const total = Math.max(0, ms);
  if (total < MINUTE) return `${Math.max(1, Math.round(total / 1000))}s`;
  const minutes = Math.round(total / MINUTE);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};

export function AgentLanes({
  agents,
  tasks,
  span = 30 * MINUTE,
  now,
  onApprove,
  onReject,
  onOpen,
  title = "Agents",
  className,
}: AgentLanesProps) {
  const uid = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [clock, setClock] = useState(() => Date.now());
  const [trackWidth, setTrackWidth] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<Record<string, { from: LaneTaskStatus; to: LaneTaskStatus }>>({});

  const current = now ?? clock;
  const across = span > 0 ? span : MINUTE;
  // The axis ends on the minute; "now" runs past it and the layer slides back by that remainder
  const anchor = Math.floor(current / MINUTE) * MINUTE;
  const startedAt = anchor - across;
  const slide = ((current - anchor) / across) * 100;
  const position = (time: number) => ((time - startedAt) / across) * 100;

  useEffect(() => {
    if (now !== undefined) return;
    const id = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [now]);

  useEffect(() => {
    const element = trackRef.current;
    if (!element) return;
    setTrackWidth(element.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setTrackWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!openId) return;
    const popover = popRef.current;
    // The popover carries the decision, so it takes focus; Escape hands it back to the block
    popover?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (popover?.contains(target)) return;
      if (target.closest(".ui-alc__block")) return;
      setOpenId(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const id = openId;
      setOpenId(null);
      blockRefs.current[id]?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openId]);

  const rows = agents.length;
  const laneOf = (agentId: string) => agents.findIndex((agent) => agent.id === agentId);
  const entries = tasks.map((task) => {
    const claim = claimed[task.id];
    // A local decision only holds while the task still says what it said when it was made
    const status = claim && claim.from === task.status ? claim.to : task.status;
    return status === task.status ? { task, status } : { task: { ...task, status }, status };
  });
  const needs = entries.filter((entry) => entry.status === "waiting").length;

  // An agent's chip follows its own lanes unless the caller pins it with its own state
  const roster = agents.map((agent) => {
    const own = entries.filter((entry) => entry.task.agentId === agent.id);
    const state =
      agent.state ??
      (own.some((entry) => entry.status === "waiting")
        ? "waiting"
        : own.some((entry) => entry.status === "running")
          ? "running"
          : "idle");
    return { agent, state };
  });
  const running = roster.filter((entry) => entry.state === "running").length;

  /** A decision on a waiting task: hand it to the caller, else settle it here, then close */
  const decide = (task: LaneTask, status: LaneTaskStatus) => {
    const handler = status === "failed" ? onReject : onApprove;
    if (handler) handler(task);
    else {
      const from = tasks.find((item) => item.id === task.id)?.status ?? task.status;
      setClaimed((previous) => ({ ...previous, [task.id]: { from, to: status } }));
    }
    const id = openId;
    setOpenId(null);
    if (id) blockRefs.current[id]?.focus();
  };

  const tickStep = across / (AXIS_TICKS + 1);
  const ticks = Array.from({ length: AXIS_TICKS }, (_, index) => {
    const step = index + 1;
    return {
      left: (step / (AXIS_TICKS + 1)) * 100,
      label: `\u2212${shortSpan(across - step * tickStep)}`,
    };
  });

  const curvePaths = entries.reduce<{ key: string; d: string; live: boolean }[]>((paths, entry) => {
    const target = entry.task.handoffTo
      ? entries.find((candidate) => candidate.task.id === entry.task.handoffTo)
      : undefined;
    if (!target) return paths;
    const fromRow = laneOf(entry.task.agentId);
    const toRow = laneOf(target.task.agentId);
    if (fromRow < 0 || toRow < 0) return paths;
    const x1 = position(entry.task.end ?? current) * 10;
    const x2 = position(target.task.start) * 10;
    const y1 = fromRow * ROW + ROW / 2;
    const y2 = toRow * ROW + ROW / 2;
    const bend = Math.min(48, Math.max(12, Math.abs(x2 - x1) * 0.72));
    paths.push({
      key: `${entry.task.id}-${target.task.id}`,
      d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
      live: target.status === "running" || target.status === "waiting",
    });
    return paths;
  }, []);

  const openEntry = openId ? entries.find((entry) => entry.task.id === openId) : undefined;
  const openTask = openEntry?.task;
  const openAgent = openTask ? agents.find((agent) => agent.id === openTask.agentId) : undefined;
  const openRow = openTask ? laneOf(openTask.agentId) : -1;
  // The last two lanes open upwards so the popover stays inside the card
  const openUp = openRow >= rows - 2;
  // The layer slides under the clock, the popover does not: it sits where the block is drawn
  const openStart = openTask ? Math.max(0, position(openTask.start) - slide) : 0;
  const openEnd = openTask ? Math.max(openStart, position(openTask.end ?? current) - slide) : openStart;
  const askOpen = openEntry?.status === "waiting" && Boolean(openTask?.ask);
  const popCenter = ((openStart + openEnd) / 200) * trackWidth;
  const popStart = (openStart / 100) * trackWidth;
  const popLeft =
    trackWidth === 0
      ? percent(askOpen ? openStart : (openStart + openEnd) / 2)
      : askOpen
        ? Math.max(0, Math.min(popStart, trackWidth - ASK_WIDTH - 4))
        : Math.min(Math.max(popCenter, TIP_HALF), Math.max(trackWidth - TIP_HALF, TIP_HALF));
  const popTop = openRow < 0 ? 0 : openUp ? openRow * ROW - 2 : openRow * ROW + ROW;

  return (
    <div className={["ui-alc", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-agent-lanes" precedence="default">
        {css}
      </style>

      <div className="ui-alc__card">
        <header className="ui-alc__bar">
          <span className="ui-alc__spark">
            <SparkIcon />
          </span>
          <span className="ui-alc__title">{title}</span>
          <span className="ui-alc__summary">
            {running > 0 && <span data-kind="running">{running} running</span>}
            {needs > 0 && <span data-kind="needs">{needs} need you</span>}
          </span>
          <span className="ui-alc__window">Last {shortSpan(span)}</span>
        </header>

        <div className="ui-alc__body" style={{ "--rows": rows } as CSSProperties}>
          <ul className="ui-alc__agents">
            {roster.map(({ agent, state }) => {
              const shown = state !== "running";
              const word = agent.stateLabel ?? (state === "waiting" ? "Needs you" : "Idle");
              return (
                <li key={agent.id} className="ui-alc__agent">
                  <span className="ui-alc__avatar" data-logo={agent.logo ? "" : undefined}>
                    {agent.logo ? <Mark logo={agent.logo} /> : agent.name.slice(0, 1)}
                  </span>
                  <span className="ui-alc__who" data-state={state}>
                    <span className="ui-alc__name-line">
                      <span className="ui-alc__name">{agent.name}</span>
                      <span
                        className="ui-alc__state"
                        data-show={shown ? "" : undefined}
                        aria-hidden={shown ? "false" : "true"}
                      >
                        <span>{word}</span>
                      </span>
                    </span>
                    {agent.model && (
                      <span className="ui-alc__model">
                        <span className="ui-alc__model-name">{agent.model}</span>
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="ui-alc__track" ref={trackRef}>
            <div className="ui-alc__grid" aria-hidden="true">
              {ticks.map((tick) => (
                <span key={tick.left} className="ui-alc__tick" style={{ left: percent(tick.left) }}>
                  <span>{tick.label}</span>
                </span>
              ))}
            </div>

            <div className="ui-alc__clip">
              <div className="ui-alc__layer" style={{ transform: `translateX(-${percent(slide)})` }}>
                <svg
                  className="ui-alc__curves"
                  viewBox={`0 0 1000 ${rows * ROW}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {curvePaths.map((curve) => (
                    <path
                      key={curve.key}
                      d={curve.d}
                      data-live={curve.live ? "" : undefined}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </svg>

                {agents.map((agent, index) => (
                  <ul
                    key={agent.id}
                    className="ui-alc__lane"
                    aria-label={`${agent.name}'s tasks`}
                    style={{ top: index * ROW }}
                  >
                    {entries
                      .filter((entry) => entry.task.agentId === agent.id)
                      .map(({ task, status }) => {
                        const left = position(task.start);
                        const right = Math.max(left, position(task.end ?? current));
                        const elapsed = Math.max(0, (task.end ?? current) - task.start);
                        const took = status === "done" ? `took ${shortSpan(elapsed)}` : shortSpan(elapsed);
                        return (
                          <li
                            key={task.id}
                            className="ui-alc__slot"
                            data-status={status}
                            style={{ left: percent(left), width: percent(right - left) }}
                          >
                            <button
                              type="button"
                              data-task={task.id}
                              className="ui-alc__block"
                              data-status={status}
                              data-open={openId === task.id ? "" : undefined}
                              aria-expanded={openId === task.id}
                              aria-controls={`${uid}-${task.id}`}
                              aria-label={`${agent.name}: ${task.title} \u2013 ${STATUS_WORD[status]}, ${took}`}
                              ref={(element) => {
                                blockRefs.current[task.id] = element;
                              }}
                              onClick={() => setOpenId(openId === task.id ? null : task.id)}
                            >
                              {task.tools && task.tools.length > 0 && (
                                <span className="ui-alc__tools" aria-hidden="true">
                                  {task.tools.slice(0, 3).map((tool, index) => (
                                    <span key={`${task.id}-${index}`} className="ui-alc__tool">
                                      <Mark logo={tool} />
                                    </span>
                                  ))}
                                </span>
                              )}
                              <span className="ui-alc__label">{task.title}</span>
                            </button>
                            {status === "waiting" && (
                              <span className="ui-alc__flag" aria-hidden="true">
                                <FlagIcon />
                                Needs you
                              </span>
                            )}
                          </li>
                        );
                      })}
                  </ul>
                ))}
              </div>
            </div>

            <span className="ui-alc__now" aria-hidden="true">
              <span>now</span>
            </span>

            {openTask && openEntry && (
              <div
                ref={popRef}
                id={`${uid}-${openTask.id}`}
                className="ui-alc__pop"
                data-up={openUp ? "" : undefined}
                role="dialog"
                aria-label={`${openTask.title} ${askOpen ? "decision" : "details"}`}
                style={{ left: popLeft, top: popTop }}
              >
                {askOpen ? (
                  <div className="ui-alc__ask">
                    <div className="ui-alc__ask-title">{openTask.title}</div>
                    <div className="ui-alc__ask-text">{openTask.ask}</div>
                    <div className="ui-alc__ask-actions">
                      <button
                        type="button"
                        className="ui-alc__btn"
                        onClick={() => decide(openTask, "failed")}
                      >
                        Not now
                      </button>
                      <button
                        type="button"
                        className="ui-alc__btn ui-alc__btn--primary"
                        onClick={() => decide(openTask, "running")}
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="ui-alc__tip">
                    <div className="ui-alc__tip-head">
                      {openAgent?.name} · {shortSpan(Math.max(0, (openTask.end ?? current) - openTask.start))}
                    </div>
                    <div className="ui-alc__tip-title">{openTask.title}</div>
                    {openTask.detail && openTask.detail.length > 0 && (
                      <ul className="ui-alc__tip-list">
                        {openTask.detail.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    )}
                    {onOpen && (
                      <button type="button" className="ui-alc__tip-open" onClick={() => onOpen(openTask)}>
                        Open task
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <span className="ui-alc__sr" aria-live="polite">
        {needs === 0 ? "No task needs you" : needs === 1 ? "1 task need you" : `${needs} tasks need you`}
      </span>
    </div>
  );
}

function Mark({ logo }: { logo: LaneLogo }) {
  const gradientId = `gm${useId()}`;
  switch (logo) {
    case "claude":
      return <ClaudeMark />;
    case "openai":
      return <OpenAiMark />;
    case "gemini":
      return <GeminiMark gradientId={gradientId} />;
    case "google":
      return <GoogleMark />;
    case "notion":
      return <NotionMark />;
    case "slack":
      return <SlackMark />;
    case "figma":
      return <FigmaMark />;
    case "github":
      return <GitHubMark />;
    case "linear":
      return <LinearMark />;
    case "hubspot":
      return <HubSpotMark />;
    case "stripe":
      return <StripeMark />;
  }
  return null;
}

function SparkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M7 1.2c.4 2.9 1.9 4.4 4.8 4.8-2.9.4-4.4 1.9-4.8 4.8C6.6 7.9 5.1 6.4 2.2 6 5.1 5.6 6.6 4.1 7 1.2Z" fill="currentColor" />
      <circle cx="11.6" cy="11.4" r="1.1" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M6 1.8 10.8 10H1.2L6 1.8Z" fill="currentColor" />
    </svg>
  );
}

function ClaudeMark() {
  return (
    <svg viewBox="0 0 1200 1200" aria-hidden="true">
      <path fill="#D97757" d="M 233.959793 800.214905 L 468.644287 668.536987 L 472.590637 657.100647 L 468.644287 650.738403 L 457.208069 650.738403 L 417.986633 648.322144 L 283.892639 644.69812 L 167.597321 639.865845 L 54.926208 633.825623 L 26.577238 627.785339 L 3.3e-05 592.751709 L 2.73832 575.27533 L 26.577238 559.248352 L 60.724873 562.228149 L 136.187973 567.382629 L 249.422867 575.194763 L 331.570496 580.026978 L 453.261841 592.671082 L 472.590637 592.671082 L 475.328857 584.859009 L 468.724915 580.026978 L 463.570557 575.194763 L 346.389313 495.785217 L 219.543671 411.865906 L 153.100723 363.543762 L 117.181267 339.060425 L 99.060455 316.107361 L 91.248367 266.01355 L 123.865784 230.093994 L 167.677887 233.073853 L 178.872513 236.053772 L 223.248367 270.201477 L 318.040283 343.570496 L 441.825592 434.738342 L 459.946411 449.798706 L 467.194672 444.64447 L 468.080597 441.020203 L 459.946411 427.409485 L 392.617493 305.718323 L 320.778564 181.932983 L 288.80542 130.630859 L 280.348999 99.865845 C 277.369171 87.221436 275.194641 76.590698 275.194641 63.624268 L 312.322174 13.20813 L 332.8591 6.604126 L 382.389313 13.20813 L 403.248352 31.328979 L 434.013519 101.71814 L 483.865753 212.537048 L 561.181274 363.221497 L 583.812134 407.919434 L 595.892639 449.315491 L 600.40271 461.959839 L 608.214783 461.959839 L 608.214783 454.711609 L 614.577271 369.825623 L 626.335632 265.61084 L 637.771851 131.516846 L 641.718201 93.745117 L 660.402832 48.483276 L 697.530334 24.000122 L 726.52356 37.852417 L 750.362549 72 L 747.060486 94.067139 L 732.886047 186.201416 L 705.100708 330.52356 L 686.979919 427.167847 L 697.530334 427.167847 L 709.61084 415.087341 L 758.496704 350.174561 L 840.644348 247.490051 L 876.885925 206.738342 L 919.167847 161.71814 L 946.308838 140.29541 L 997.61084 140.29541 L 1035.38269 196.429626 L 1018.469849 254.416199 L 965.637634 321.422852 L 921.825562 378.201538 L 859.006714 462.765259 L 819.785278 530.41626 L 823.409424 535.812073 L 832.75177 534.92627 L 974.657776 504.724915 L 1051.328979 490.872559 L 1142.818848 475.167786 L 1184.214844 494.496582 L 1188.724854 514.147644 L 1172.456421 554.335693 L 1074.604126 578.496765 L 959.838989 601.449829 L 788.939636 641.879272 L 786.845764 643.409485 L 789.261841 646.389343 L 866.255127 653.637634 L 899.194702 655.409424 L 979.812134 655.409424 L 1129.932861 666.604187 L 1169.154419 692.537109 L 1192.671265 724.268677 L 1188.724854 748.429688 L 1128.322144 779.194641 L 1046.818848 759.865845 L 856.590759 714.604126 L 791.355774 698.335754 L 782.335693 698.335754 L 782.335693 703.731567 L 836.69812 756.885986 L 936.322205 846.845581 L 1061.073975 962.81897 L 1067.436279 991.490112 L 1051.409424 1014.120911 L 1034.496704 1011.704712 L 924.885986 929.234924 L 882.604126 892.107544 L 786.845764 811.48999 L 780.483276 811.48999 L 780.483276 819.946289 L 802.550415 852.241699 L 919.087341 1027.409424 L 925.127625 1081.127686 L 916.671204 1098.604126 L 886.469849 1109.154419 L 853.288696 1103.114136 L 785.073914 1007.355835 L 714.684631 899.516785 L 657.906067 802.872498 L 650.979858 806.81897 L 617.476624 1167.704834 L 601.771851 1186.147705 L 565.530212 1200 L 535.328857 1177.046997 L 519.302124 1139.919556 L 535.328857 1066.550537 L 554.657776 970.792053 L 570.362488 894.68457 L 584.536926 800.134277 L 592.993347 768.724976 L 592.429626 766.630859 L 585.503479 767.516968 L 514.22821 865.369263 L 405.825531 1011.865906 L 320.053711 1103.677979 L 299.516815 1111.812256 L 263.919525 1093.369263 L 267.221497 1060.429688 L 287.114136 1031.114136 L 405.825531 880.107361 L 477.422913 786.52356 L 523.651062 732.483276 L 523.328918 724.671265 L 520.590698 724.671265 L 205.288605 929.395935 L 149.154434 936.644409 L 124.993355 914.01355 L 127.973183 876.885986 L 139.409409 864.80542 L 234.201385 799.570435 L 233.879227 799.8927 Z" />
    </svg>
  );
}

function OpenAiMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ color: "var(--ui-alc-strong, var(--ui-al-ink, #000))" }}>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

function GeminiMark({ gradientId }: { gradientId: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1C7DFF" />
          <stop offset="0.52" stopColor="#1C69FF" />
          <stop offset="1" stopColor="#B04DFF" />
        </linearGradient>
      </defs>
      <path fill={`url(#${gradientId})`} d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.57-5.15 3.57-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.27v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.59 1.8l3.43-3.43A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.27 6.6l4 3.1C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  );
}

function NotionMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ color: "var(--ui-alc-strong, var(--ui-al-ink, #000))" }}>
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
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
    <svg viewBox="0 0 38 57" aria-hidden="true">
      <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0Z" fill="#1ABCFE" />
      <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0Z" fill="#0ACF83" />
      <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19Z" fill="#FF7262" />
      <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5Z" fill="#F24E1E" />
      <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5Z" fill="#A259FF" />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ color: "var(--ui-alc-strong, var(--ui-al-ink, #181717))" }}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function LinearMark() {
  return (
    <svg viewBox="0 0 24 24" fill="#5E6AD2" aria-hidden="true">
      <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />
    </svg>
  );
}

function HubSpotMark() {
  return (
    <svg viewBox="0 0 24 24" fill="#FF7A59" aria-hidden="true">
      <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z" />
    </svg>
  );
}

function StripeMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#635BFF" />
      <path fill="#fff" transform="translate(5 5) scale(0.5833)" d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />
    </svg>
  );
}

const css = /* css */ `
.ui-alc{--ui-alc-card: #fffdfb;--ui-alc-strong: #0b0908;--ui-alc-ink: rgba(11, 9, 8, 0.88);--ui-alc-text: rgba(11, 9, 8, 0.61);--ui-alc-muted: rgba(11, 9, 8, 0.45);--ui-alc-faint: rgba(11, 9, 8, 0.27);--ui-alc-line: rgba(11, 9, 8, 0.06);--ui-alc-rail: rgba(11, 9, 8, 0.15);--ui-alc-wash: rgba(11, 9, 8, 0.03);--ui-alc-fill: rgba(11, 9, 8, 0.06);--ui-alc-done: rgba(11, 9, 8, 0.05);--ui-alc-solid: rgba(11, 9, 8, 0.88);--ui-alc-on-solid: #fcf9f7;--ui-alc-run-bg: #ff6b3519;--ui-alc-run-fg: #d9541ff2;--ui-alc-run-edge: rgba(217, 84, 31, 0.5);--ui-alc-warn-bg: #d9953029;--ui-alc-warn-fg: #d9541f;--ui-alc-danger-bg: #b3261e18;--ui-alc-danger-fg: #b3261eda;--ui-alc-focus: rgba(217, 84, 31, 0.35);--ui-alc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-alc-pop: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 12px 28px -10px rgba(11, 9, 8, 0.18), 0 1px 2px rgba(11, 9, 8, 0.05);--ui-alc-row: 48px;position: relative;box-sizing: border-box;width: 100%;max-width: 760px;container-type: inline-size;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;font-weight: 400;line-height: 20px;color: var(--ui-alc-text);text-align: left;-webkit-font-smoothing: antialiased}
.ui-alc *, .ui-alc *::before, .ui-alc *::after{box-sizing: border-box}
:where(.ui-alc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;text-align: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-alc button:focus-visible{outline: 2px solid var(--ui-alc-focus);outline-offset: 1px}
.ui-alc ul{margin: 0;padding: 0;list-style: none}
.ui-alc svg{display: block;flex: none}
.ui-alc__sr{position: absolute;width: 1px;height: 1px;overflow: hidden;clip-path: inset(50%);white-space: nowrap}
.ui-alc__card{border-radius: 10px;background: var(--ui-alc-card);box-shadow: var(--ui-alc-shadow)}
.ui-alc__bar{display: flex;align-items: center;gap: 10px;min-width: 0;padding: 14px 16px;border-bottom: 0.5px solid var(--ui-alc-line)}
.ui-alc__spark{display: grid;flex: none;place-items: center;width: 16px;color: rgba(217, 84, 31, 0.765)}
.ui-alc__title{font-weight: 500;color: var(--ui-alc-strong);white-space: nowrap}
.ui-alc__summary{display: flex;flex: 1;gap: 12px;min-width: 0;overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-alc-muted);white-space: nowrap}
.ui-alc__summary span{display: inline-flex;align-items: center;gap: 6px}
.ui-alc__summary span::before{content: "";width: 6px;height: 6px;border-radius: 50%;background: var(--ui-alc-run-fg)}
.ui-alc__summary [data-kind="needs"]{color: var(--ui-alc-warn-fg)}
.ui-alc__summary [data-kind="needs"]::before{background: var(--ui-alc-warn-fg);animation: ui-alc-pulse var(--nm-dur-6, 1100ms) ease-in-out infinite}
.ui-alc__window{flex: none;padding: 2px 8px;border-radius: 6px;background: var(--ui-alc-fill);font-size: 12px;font-weight: 500;line-height: 16px;color: var(--ui-alc-text)}
.ui-alc__body{display: grid;grid-template-columns: 168px minmax(0, 1fr);padding: 26px 16px 12px 0}
.ui-alc__agents{display: grid;grid-auto-rows: var(--ui-alc-row)}
.ui-alc__agent{display: flex;align-items: center;gap: 10px;min-width: 0;padding: 0 12px 0 16px}
.ui-alc__avatar{display: grid;flex: none;place-items: center;width: 24px;height: 24px;overflow: hidden;border-radius: 6px;background: var(--ui-alc-fill);font-size: 10px;font-weight: 500;letter-spacing: 0.3px;color: var(--ui-alc-text)}
.ui-alc__avatar[data-logo]{background: var(--ui-alc-card);box-shadow: var(--ui-alc-shadow)}
.ui-alc__avatar > svg{width: 14px;height: 14px}
.ui-alc__who{display: grid;min-width: 0}
.ui-alc__name{overflow: hidden;font-weight: 500;color: var(--ui-alc-ink);white-space: nowrap;text-overflow: ellipsis}
.ui-alc__name-line{display: flex;align-items: center;min-width: 0}
.ui-alc__model{display: flex;align-items: center;min-width: 0;font-size: 12px;line-height: 16px;color: var(--ui-alc-muted);white-space: nowrap}
.ui-alc__model-name{min-width: 0;overflow: hidden;text-overflow: ellipsis}
.ui-alc__state{display: inline-grid;flex: none;grid-template-columns: 0fr;margin-left: 0;opacity: 0;transition: grid-template-columns var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), margin-left var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-alc__state[data-show]{grid-template-columns: 1fr;margin-left: 6px;opacity: 1;transition: grid-template-columns var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), margin-left var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 80ms}
.ui-alc__state > span{min-width: 0;overflow: hidden;padding: 0 5px;border-radius: 4px;background: var(--ui-alc-fill);font-size: 11px;font-weight: 500;line-height: 16px;color: var(--ui-alc-text);white-space: nowrap}
.ui-alc__who[data-state="waiting"] .ui-alc__state > span{background: var(--ui-alc-warn-bg);color: var(--ui-alc-warn-fg)}
.ui-alc__track{position: relative;height: calc(var(--rows) * var(--ui-alc-row))}
.ui-alc__track::before{content: "";position: absolute;inset: 0;background: repeating-linear-gradient(to bottom, transparent 0, transparent calc(var(--ui-alc-row) - 0.5px), var(--ui-alc-line) calc(var(--ui-alc-row) - 0.5px), var(--ui-alc-line) var(--ui-alc-row));pointer-events: none}
.ui-alc__grid{position: absolute;inset: 0;pointer-events: none}
.ui-alc__tick{position: absolute;top: 0;bottom: 0;width: 0;border-left: 0.5px dashed var(--ui-alc-line)}
.ui-alc__tick > span{position: absolute;bottom: 100%;left: 0;margin-bottom: 6px;font-size: 11px;line-height: 14px;color: var(--ui-alc-faint);white-space: nowrap;transform: translateX(-50%);font-variant-numeric: tabular-nums}
.ui-alc__clip{position: absolute;inset: 0;overflow: hidden;-webkit-mask-image: linear-gradient(to right, transparent 0, #0b0908 40px);mask-image: linear-gradient(to right, transparent 0, #0b0908 40px)}
.ui-alc__layer{position: absolute;inset: 0;will-change: transform}
.ui-alc__curves{position: absolute;inset: 0;width: 100%;height: 100%;overflow: visible;pointer-events: none}
.ui-alc__curves path{fill: none;stroke: var(--ui-alc-rail);stroke-width: 1;stroke-dasharray: 3 3}
.ui-alc__curves path[data-live]{stroke: var(--ui-alc-run-edge);animation: ui-alc-flow var(--nm-dur-6, 1100ms) linear infinite}
.ui-alc__lane{position: absolute;left: 0;right: 0;height: var(--ui-alc-row)}
.ui-alc__slot{position: absolute;top: 10px;bottom: 10px;min-width: 6px}
.ui-alc__slot:is([data-status="running"], [data-status="waiting"]), .ui-alc__slot:is([data-status="running"], [data-status="waiting"]) .ui-alc__block{min-width: 0}
.ui-alc__block{display: flex;align-items: center;width: 100%;height: 100%;min-width: 6px;padding: 0 8px;overflow: hidden;border-radius: 6px;background: var(--ui-alc-done);font-size: 12px;font-weight: 500;line-height: 16px;color: var(--ui-alc-text);white-space: nowrap;transition: background-color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-alc__label{min-width: 0;overflow: hidden;text-overflow: clip}
.ui-alc__tools{display: flex;flex: none;gap: 4px;margin-right: 6px}
.ui-alc__tool{display: grid;place-items: center;width: 12px;height: 12px}
.ui-alc__tool > svg{width: 12px;height: 12px}
.ui-alc__block:hover{background: var(--ui-alc-fill)}
.ui-alc__block[data-status="running"]{position: relative;background: var(--ui-alc-run-bg);color: var(--ui-alc-run-fg);box-shadow: inset -2px 0 0 var(--ui-alc-run-edge)}
.ui-alc__block[data-status="running"]::after{content: "";position: absolute;inset: 0;background: linear-gradient(90deg, transparent 0%, rgba(255, 253, 251, 0.55) 50%, transparent 100%) 0 0 / 50% 100% no-repeat;animation: ui-alc-shimmer var(--nm-dur-6, 1100ms) ease-in-out infinite}
.ui-alc__block[data-status="waiting"]{background: var(--ui-alc-warn-bg);color: var(--ui-alc-warn-fg)}
.ui-alc__block[data-status="failed"]{background: var(--ui-alc-danger-bg);color: var(--ui-alc-danger-fg)}
.ui-alc__block[data-open]{filter: brightness(0.97)}
.ui-alc__flag{position: absolute;top: 50%;right: 4px;display: inline-flex;align-items: center;gap: 4px;padding: 0 6px;border-radius: 4px;background: var(--ui-alc-card);box-shadow: var(--ui-alc-shadow);font-size: 11px;font-weight: 500;line-height: 18px;color: var(--ui-alc-warn-fg);white-space: nowrap;transform: translateY(-50%);pointer-events: none;animation: ui-alc-pulse var(--nm-dur-6, 1100ms) ease-in-out infinite}
.ui-alc__slot:has(.ui-alc__block[data-status="waiting"]){z-index: 2}
.ui-alc__pop{position: absolute;z-index: 5;animation: ui-alc-in var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-alc__pop[data-up]{transform: translateY(-100%);animation-name: ui-alc-in-up}
.ui-alc__ask{display: grid;gap: 2px;width: 280px;padding: 12px;border-radius: 10px;background: var(--ui-alc-card);box-shadow: var(--ui-alc-pop)}
.ui-alc__tip{display: grid;gap: 4px;width: max-content;max-width: 220px;padding: 8px 10px;border-radius: 8px;background: rgba(30, 24, 20, 0.92);-webkit-backdrop-filter: blur(8px);backdrop-filter: blur(8px);box-shadow: 0 8px 24px -8px rgba(11, 9, 8, 0.35);font-size: 12px;line-height: 16px;color: rgba(255, 253, 251, 0.86);translate: -50% 0}
.ui-alc__tip-head{font-size: 11px;color: rgba(255, 253, 251, 0.55);white-space: nowrap}
.ui-alc__tip-title{color: #fffdfb}
.ui-alc__tip-list{display: grid;gap: 2px}
.ui-alc__tip-list li{position: relative;padding-left: 10px}
.ui-alc__tip-list li::before{content: "";position: absolute;top: 7px;left: 1px;width: 3px;height: 3px;border-radius: 50%;background: rgba(255, 253, 251, 0.5)}
.ui-alc__tip-open{justify-self: start;margin-top: 2px;font-size: 12px;font-weight: 500;color: #fffdfb;text-decoration: underline;text-decoration-color: rgba(255, 253, 251, 0.35);text-underline-offset: 2px}
.ui-alc__ask-title{font-weight: 500;color: var(--ui-alc-strong)}
.ui-alc__ask-text{font-size: 12px;line-height: 16px;color: var(--ui-alc-text)}
.ui-alc__ask-actions{display: flex;justify-content: flex-end;gap: 6px;margin-top: 8px}
.ui-alc__btn{display: inline-flex;align-items: center;height: 28px;padding: 0 10px;border-radius: 6px;background: var(--ui-alc-card);box-shadow: var(--ui-alc-shadow);font-size: 13px;font-weight: 500;color: var(--ui-alc-strong)}
.ui-alc__btn:hover{background: var(--ui-alc-wash)}
.ui-alc__btn--primary{background: var(--ui-alc-solid);box-shadow: none;color: var(--ui-alc-on-solid)}
.ui-alc__btn--primary:hover{background: #362b21}
.ui-alc__now{position: absolute;top: -6px;right: 0;width: 0;pointer-events: none}
.ui-alc__now > span{position: absolute;bottom: 100%;right: 0;padding: 0 5px;border-radius: 4px;background: var(--ui-alc-run-bg);font-size: 10px;font-weight: 500;line-height: 14px;color: var(--ui-alc-run-fg)}
@keyframes ui-alc-pulse{50%{opacity: 0.55}
}
@keyframes ui-alc-shimmer{from{background-position: -100% 0}
to{background-position: 200% 0}
}
@keyframes ui-alc-flow{to{stroke-dashoffset: -6}
}
@keyframes ui-alc-in{from{opacity: 0;transform: translateY(-3px)}
}
@keyframes ui-alc-in-up{from{opacity: 0;transform: translateY(calc(-100% + 3px))}
to{transform: translateY(-100%)}
}
@container (max-width: 520px){.ui-alc__body{grid-template-columns: 48px minmax(0, 1fr)}
.ui-alc__who{display: none}
.ui-alc__summary [data-kind="running"]{display: none}
}
@media (prefers-reduced-motion: reduce){.ui-alc *, .ui-alc *::before, .ui-alc *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-alc{--ui-alc-card: #211b16;--ui-alc-strong: #fffdfb;--ui-alc-ink: rgba(255, 253, 251, 0.9);--ui-alc-text: rgba(255, 253, 251, 0.62);--ui-alc-muted: rgba(255, 253, 251, 0.45);--ui-alc-faint: rgba(255, 253, 251, 0.28);--ui-alc-line: rgba(255, 253, 251, 0.08);--ui-alc-rail: rgba(255, 253, 251, 0.2);--ui-alc-wash: rgba(255, 253, 251, 0.04);--ui-alc-fill: rgba(255, 253, 251, 0.08);--ui-alc-done: rgba(255, 253, 251, 0.06);--ui-alc-solid: rgba(255, 253, 251, 0.92);--ui-alc-on-solid: #1a1512;--ui-alc-run-bg: #ff6b353a;--ui-alc-run-fg: #ff8a5c;--ui-alc-run-edge: rgba(255, 138, 92, 0.6);--ui-alc-warn-bg: #ff6b3525;--ui-alc-warn-fg: #ff8a5c;--ui-alc-danger-bg: #e2544a2b;--ui-alc-danger-fg: #e2544a;--ui-alc-focus: rgba(255, 138, 92, 0.45);--ui-alc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-alc-pop: 0 0 0 0.5px rgba(255, 253, 251, 0.12), 0 12px 28px -10px rgba(11, 9, 8, 0.6)}
:where(.dark, [data-theme="dark"]) .ui-alc__btn--primary:hover{background: #cbbfb5}
:where(.dark, [data-theme="dark"]) .ui-alc__block[data-status="running"]::after{background-image: linear-gradient(90deg, transparent 0%, rgba(255, 253, 251, 0.12) 50%, transparent 100%)}
:where(.dark, [data-theme="dark"]) .ui-alc__tip{background: rgba(250, 247, 244, 0.94);box-shadow: 0 8px 24px -8px rgba(11, 9, 8, 0.6);color: rgba(11, 9, 8, 0.82)}
:where(.dark, [data-theme="dark"]) .ui-alc__tip-head{color: rgba(11, 9, 8, 0.5)}
:where(.dark, [data-theme="dark"]) .ui-alc__tip-title, :where(.dark, [data-theme="dark"]) .ui-alc__tip-open{color: #0b0908}
:where(.dark, [data-theme="dark"]) .ui-alc__tip-open{text-decoration-color: rgba(11, 9, 8, 0.3)}
:where(.dark, [data-theme="dark"]) .ui-alc__tip-list li::before{background: rgba(11, 9, 8, 0.4)}

`;
