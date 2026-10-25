"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

/*
 * Agent Replay: a step-through debugger over one agent's reasoning chain.
 * The rail is causal rather than chronological: one numbered node per step, the traversed spine
 * drawn in with stroke-dashoffset as each step is first seen, and a single ember tick that springs
 * to the step on screen. Stepping settles the detail in from the direction you travelled, and the
 * header slides in on that same axis, so forward and back never look alike.
 * The styles are injected below, so no extra files are needed.
 */

/** One block of text a step was given or produced */
export type ReplayPayload = {
  /** Short name for the block, e.g. "Ticket" */
  label: string;
  /** The text itself */
  body: string;
  /** A source, id or duration to sit under the text */
  meta?: string;
  /** How the block reads: plain text, a code block, or a failure */
  tone?: "plain" | "code" | "bad";
};

/** An option a step weighed before choosing */
export type ReplayBranch = {
  /** Stable id for the option */
  id: string;
  /** The option, in a few words */
  label: string;
  /** Why it was, or was not, the one taken */
  note: string;
  /** Whether this is the option the step took */
  taken?: boolean;
};

/** What a step chose, and the reason it gives */
export type ReplayDecision = {
  /** The option it took */
  choice: string;
  /** Why that one, in the step's own terms */
  rationale: string;
};

/** One step of one agent's reasoning */
export type ReplayStep = {
  /** Stable id for the step */
  id: string;
  /** What the step was doing, in a few words */
  label: string;
  /** What it was given */
  input: ReplayPayload;
  /** What it produced */
  output: ReplayPayload;
  /** What it chose, and why */
  decision: ReplayDecision;
  /** The alternatives it weighed, with the taken one marked */
  branches?: readonly ReplayBranch[];
  /** The tool it called, when the step called one */
  tool?: string;
};

export type AgentReplayProps = {
  /** The chain, in the order the agent reasoned it */
  steps?: readonly ReplayStep[];
  /** What the chain was chasing */
  title?: string;
  /** Which agent ran it */
  agent?: string;
  /** The step on screen, when the caller owns it */
  index?: number;
  /** The step to open on when the caller does not own it */
  defaultIndex?: number;
  /** Called with the step index every time the debugger moves */
  onIndexChange?: (index: number) => void;
  /** The steps already seen, when the caller owns the trail */
  visited?: readonly number[];
  /** Called with every step seen so far whenever the trail grows */
  onVisitedChange?: (visited: readonly number[]) => void;
  className?: string;
};

/* A chain to stand in when the caller passes none: a billing agent working a failed renewal. */
const defaultChain: readonly ReplayStep[] = [
  {
    id: "read",
    label: "Read the ticket and the account",
    input: {
      label: "Ticket",
      body: "Order 4412 failed three times this week. The last error was card_declined: expired_card.",
      meta: "Help desk, 4 minutes ago",
    },
    output: {
      label: "Account snapshot",
      body: "Scale plan, 14 months old, three failed charges in six days, all on the same card.",
      meta: "crm.account_lookup",
    },
    decision: {
      choice: "Treat this as a billing fault, not a usage problem",
      rationale:
        "Every decline names the same expired card, and the account sits nowhere near its quota. A usage fault would come back as a rate limit or a quota error instead.",
    },
    tool: "crm.account_lookup",
  },
  {
    id: "recall",
    label: "Search closed tickets for the same code",
    input: {
      label: "Query",
      body: 'error_code:expired_card AND plan:scale, closed in the last 90 days',
      meta: "12.4k tickets indexed",
    },
    output: {
      label: "12 matches",
      body: "9 were closed after the customer updated the card. 3 were refunded, and 2 of those declined again within the week.",
      meta: "search.tickets",
    },
    decision: {
      choice: "Ask for a card update before promising money back",
      rationale:
        "The card update is what ended 9 of the 12 tickets. A refund on an expired card only moves the failure to the next renewal.",
    },
    branches: [
      {
        id: "refund",
        label: "Refund the three declined charges",
        note: "$240 out of the account, and the card is still expired",
        taken: false,
      },
      {
        id: "card",
        label: "Walk the customer through the card update",
        note: "Matches the nine tickets that closed cleanly",
        taken: true,
      },
      {
        id: "escalate",
        label: "Escalate to the billing desk",
        note: "Right for a dispute, wrong for an expired card",
        taken: false,
      },
    ],
    tool: "search.tickets",
  },
  {
    id: "policy",
    label: "Check what may be promised in writing",
    input: { label: "Policy query", body: "Refund eligibility after a declined renewal, Scale plan" },
    output: {
      label: "Policy 4.2",
      body: "A declined renewal may be refunded when the decline is ours. A card that expired is the customer's to fix, and the plan stays open for 14 days either way.",
      meta: "policy.lookup, 209ms",
    },
    decision: {
      choice: "Promised the 14 day grace period, not a refund",
      rationale:
        "Policy 4.2 keeps the plan running while the card is fixed, so nothing is lost by waiting for the customer's reply.",
    },
    branches: [
      {
        id: "quote",
        label: "Quote the policy clause back to the customer",
        note: "Reads as a rule being enforced rather than a fix offered",
        taken: false,
      },
      {
        id: "grace",
        label: "State the grace period as the reassurance",
        note: "It is the part of 4.2 the customer actually needs",
        taken: true,
      },
    ],
    tool: "policy.lookup",
  },
  {
    id: "draft",
    label: "Draft the reply",
    input: {
      label: "Brief",
      body: "Warm, short, no policy language, one action for the customer.",
      meta: "Tone held from the last 40 replies",
    },
    output: {
      label: "Draft 8814",
      body: "Hi Maya, your card ending 4412 expired, so the last three renewals were declined. Here is the two minute fix. Your plan stays on until 9 November either way.",
      tone: "code",
      meta: "support.draft",
    },
    decision: {
      choice: "Lead with the fix, keep the grace period for the second line",
      rationale:
        "The customer came in angry about a charge that never went through, so the fix is the answer and the grace period is the reassurance.",
    },
  },
  {
    id: "send",
    label: "Send the reply",
    input: { label: "Draft", body: "draft_8814, read back against the policy text before sending" },
    output: {
      label: "Sent",
      body: "Delivered to maya@northwind.co at 14:12. Thread left open with a three day follow up.",
      meta: "support.reply",
    },
    decision: {
      choice: "Send now and hold the refund question open",
      rationale:
        "The customer can answer the card question today. Promising a refund before the reply would commit money against policy 4.2.",
    },
    branches: [
      {
        id: "close",
        label: "Send and close the thread",
        note: "Nothing would catch a second decline",
        taken: false,
      },
      {
        id: "hold",
        label: "Send and hold the thread for three days",
        note: "The follow up watches the next decline",
        taken: true,
      },
    ],
    tool: "support.reply",
  },
  {
    id: "watch",
    label: "Watch the next renewal",
    input: { label: "Watch", body: "Order 4412, next renewal on 26 October, reopen on a decline." },
    output: {
      label: "Watch set",
      body: "A second decline reopens the thread and routes it to the billing desk.",
      meta: "billing.watch",
    },
    decision: {
      choice: "Hand it to a human if the card is still expired on the 26th",
      rationale:
        "A decline after the fix is a card problem this agent cannot settle, and a second refund promise would sit outside policy 4.2.",
    },
    tool: "billing.watch",
  },
];

export function AgentReplay({
  steps = defaultChain,
  title = "Untitled chain",
  agent,
  index,
  defaultIndex = 0,
  onIndexChange,
  visited,
  onVisitedChange,
  className,
}: AgentReplayProps) {
  const base = useId();
  const count = steps.length;
  const last = Math.max(count - 1, 0);

  const [ownIndex, setOwnIndex] = useState(defaultIndex);
  const asked = index === undefined ? ownIndex : index;
  const current = Math.min(Math.max(asked, 0), last);

  const [ownSeen, setOwnSeen] = useState<ReadonlySet<number>>(
    () => new Set([Math.min(Math.max(defaultIndex, 0), last)]),
  );
  const seen = visited ? new Set(visited) : ownSeen;

  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [anchor, setAnchor] = useState(current);
  if (anchor !== current) {
    /* Adjust during render, not in an effect, so the keyed detail never mounts under the previous
       direction: React discards this pass and re-renders before the DOM is touched. */
    setAnchor(current);
    setDir(current > anchor ? "fwd" : "back");
  }

  const wrapRef = useRef<HTMLDivElement>(null);
  const numRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const wantFocus = useRef(false);

  const [rail, setRail] = useState<RailGeometry>(EMPTY_RAIL);
  const [armed, setArmed] = useState(false);

  /* The trail the walk leaves. It only ever grows, and the step on screen is always on it. */
  useEffect(() => {
    if (count === 0) return;
    if (visited) {
      if (visited.includes(current)) return;
      onVisitedChange?.(Array.from(new Set([...visited, current])).sort((a, b) => a - b));
      return;
    }
    setOwnSeen((prev) => (prev.has(current) ? prev : new Set(prev).add(current)));
  }, [current, count, visited, onVisitedChange]);

  /* The spine is measured rather than assumed: node centres come from the DOM, so the rail can be
     any height, any type size, and it stays aligned at 320px and at 1920px. */
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const box = wrap.getBoundingClientRect();
      const nodes: RailNode[] = [];
      for (const el of numRefs.current) {
        if (!el) continue;
        const r = el.getBoundingClientRect();
        nodes.push({
          x: r.left - box.left + wrap.scrollLeft + r.width / 2,
          y: r.top - box.top + wrap.scrollTop + r.height / 2,
        });
      }
      const next: RailGeometry = { w: wrap.scrollWidth, h: wrap.scrollHeight, nodes };
      setRail((prev) => (sameRail(prev, next) ? prev : next));
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(read);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(wrap);
    for (const el of numRefs.current) if (el) observer.observe(el);
    schedule();
    return () => {
      observer.disconnect();
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [count]);

  /* The tick springs on every step, but not on the first paint: nothing should fly in from zero. */
  useEffect(() => {
    if (armed || count === 0 || rail.nodes.length !== count) return;
    const frame = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(frame);
  }, [armed, count, rail.nodes.length]);

  /* A long chain scrolls inside its rail, so the step on screen is brought back into view. */
  useEffect(() => {
    const wrap = wrapRef.current;
    const node = rail.nodes[Math.min(current, rail.nodes.length - 1)];
    if (!wrap || !node) return;
    if (wrap.scrollHeight <= wrap.clientHeight) return;
    const top = Math.min(Math.max(node.y - wrap.clientHeight / 2, 0), wrap.scrollHeight - wrap.clientHeight);
    const still =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    wrap.scrollTo({ top, behavior: still ? "auto" : "smooth" });
  }, [current, rail]);

  useEffect(() => {
    if (!wantFocus.current) return;
    wantFocus.current = false;
    tabRefs.current[current]?.focus();
  }, [current]);

  const go = (next: number) => {
    const target = Math.min(Math.max(next, 0), last);
    if (target === current) return;
    if (index === undefined) setOwnIndex(target);
    onIndexChange?.(target);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    let next = current;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = current + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = current - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    const target = Math.min(Math.max(next, 0), last);
    /* Arrow keys move the selection itself, so the focus has to travel with them. */
    if (event.currentTarget.ownerDocument.activeElement?.getAttribute("role") === "tab") {
      wantFocus.current = target !== current;
    }
    go(target);
  };

  const branches = count > 0 ? steps[current].branches ?? [] : [];
  const alternatives = steps.reduce((total, step) => total + (step.branches?.length ?? 0), 0);
  const toolCalls = steps.filter((step) => step.tool).length;
  const failures = steps.filter((step) => step.output.tone === "bad").length;

  const marker = rail.nodes[Math.min(current, rail.nodes.length - 1)];

  return (
    <div
      className={["ui-agrp", className].filter(Boolean).join(" ")}
      data-dir={dir}
      data-state={count === 0 ? "empty" : "ready"}
      data-armed={armed ? "" : undefined}
      onKeyDown={onKeyDown}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-agent-replay" precedence="default">
        {css}
      </style>

      <header className="ui-agrp__head">
        <span className="ui-agrp__kicker">
          <ChainGlyph />
          Reasoning chain
        </span>
        <div className="ui-agrp__top">
          <h3 className="ui-agrp__title">{title}</h3>
          {agent ? <span className="ui-agrp__agent">{agent}</span> : null}
        </div>
        <ul className="ui-agrp__summary">
          <li className="ui-agrp__stat">
            <ListGlyph />
            <span>
              <b>{count}</b> {unit(count, "step")}
            </span>
          </li>
          <li className="ui-agrp__stat">
            <ForkGlyph />
            <span>
              <b>{alternatives}</b> {unit(alternatives, "alternative")} weighed
            </span>
          </li>
          <li className="ui-agrp__stat">
            <ToolGlyph />
            <span>
              <b>{toolCalls}</b> {unit(toolCalls, "tool call")}
            </span>
          </li>
          {failures > 0 ? (
            <li className="ui-agrp__stat" data-kind="failed">
              <FailedGlyph />
              <span>
                <b>{failures}</b> {unit(failures, "step")} failed
              </span>
            </li>
          ) : null}
        </ul>
      </header>

      {count === 0 ? (
        <div className="ui-agrp__empty">
          <span className="ui-agrp__empty-mark" aria-hidden="true">
            <ChainGlyph />
          </span>
          <p className="ui-agrp__empty-text">
            This run recorded no steps, so there is nothing to step through. The chain records from
            the agent's first stated decision onward.
          </p>
        </div>
      ) : (
        <>
          <div className="ui-agrp__grid">
            <div className="ui-agrp__railwrap" ref={wrapRef}>
              {rail.nodes.length > 1 ? (
                <svg
                  className="ui-agrp__track"
                  viewBox={`0 0 ${rail.w} ${rail.h}`}
                  style={{ width: rail.w, height: rail.h }}
                  fill="none"
                  aria-hidden="true"
                >
                  <polyline
                    className="ui-agrp__spine"
                    points={rail.nodes.map((node) => `${node.x},${node.y}`).join(" ")}
                  />
                  {rail.nodes.slice(0, -1).map((node, i) => {
                    const next = rail.nodes[i + 1];
                    const length = Math.hypot(next.x - node.x, next.y - node.y);
                    return (
                      <line
                        key={i}
                        className="ui-agrp__trail"
                        x1={node.x}
                        y1={node.y}
                        x2={next.x}
                        y2={next.y}
                        strokeDasharray={length}
                        strokeDashoffset={seen.has(i) && seen.has(i + 1) ? 0 : length}
                      />
                    );
                  })}
                </svg>
              ) : null}

              {marker ? (
                <span
                  className="ui-agrp__marker"
                  style={{ transform: `translate3d(0, ${marker.y - MARK / 2}px, 0)` }}
                  aria-hidden="true"
                />
              ) : null}

              <div
                className="ui-agrp__rail"
                role="tablist"
                aria-orientation="vertical"
                aria-label={`Reasoning steps: ${title}`}
              >
                {steps.map((step, i) => {
                  const isCurrent = i === current;
                  const options = step.branches?.length ?? 0;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      role="tab"
                      id={`${base}-tab-${i}`}
                      className="ui-agrp__step"
                      aria-selected={isCurrent}
                      aria-controls={`${base}-panel`}
                      aria-label={stepName(step, i, options)}
                      tabIndex={isCurrent ? 0 : -1}
                      data-current={isCurrent ? "" : undefined}
                      data-seen={seen.has(i) ? "" : undefined}
                      data-failed={step.output.tone === "bad" ? "" : undefined}
                      ref={(el) => {
                        tabRefs.current[i] = el;
                      }}
                      onClick={() => go(i)}
                    >
                      <span
                        className="ui-agrp__num"
                        aria-hidden="true"
                        ref={(el) => {
                          numRefs.current[i] = el;
                        }}
                      >
                        {i + 1}
                      </span>
                      <span className="ui-agrp__step-label">{step.label}</span>
                      <span className="ui-agrp__marks" aria-hidden="true">
                        {step.output.tone === "bad" ? <FailedGlyph /> : null}
                        {options > 0 ? <ForkGlyph /> : null}
                        {step.tool ? <ToolGlyph /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className="ui-agrp__panel"
              role="tabpanel"
              id={`${base}-panel`}
              aria-labelledby={`${base}-tab-${current}`}
              tabIndex={0}
            >
              <div className="ui-agrp__detail" key={steps[current].id}>
                <header className="ui-agrp__stephead">
                  <span className="ui-agrp__steppos">
                    Step <b>{current + 1}</b> of {count}
                  </span>
                  <div className="ui-agrp__flags">
                    {steps[current].tool ? (
                      <span className="ui-agrp__flag" data-kind="tool">
                        <ToolGlyph />
                        {steps[current].tool}
                      </span>
                    ) : (
                      <span className="ui-agrp__flag" data-kind="none">
                        No tool call
                      </span>
                    )}
                    {branches.length > 0 ? (
                      <span className="ui-agrp__flag" data-kind="branch">
                        <ForkGlyph />
                        {branches.length} {unit(branches.length, "alternative")}
                      </span>
                    ) : null}
                    {steps[current].output.tone === "bad" ? (
                      <span className="ui-agrp__flag" data-kind="failed">
                        <FailedGlyph />
                        Failed
                      </span>
                    ) : null}
                  </div>
                  <h4 className="ui-agrp__steplabel">{steps[current].label}</h4>
                </header>

                <div className="ui-agrp__regions">
                  <section className="ui-agrp__region" data-region="input" aria-label="Input">
                    <div className="ui-agrp__region-head">
                      <h5>Input</h5>
                      <span className="ui-agrp__payload-label">{steps[current].input.label}</span>
                    </div>
                    <p className="ui-agrp__body" data-tone={steps[current].input.tone ?? "plain"}>
                      {steps[current].input.body}
                    </p>
                    {steps[current].input.meta ? (
                      <p className="ui-agrp__meta">{steps[current].input.meta}</p>
                    ) : null}
                  </section>

                  <section className="ui-agrp__region" data-region="output" aria-label="Output">
                    <div className="ui-agrp__region-head">
                      <h5>Output</h5>
                      <span className="ui-agrp__payload-label">{steps[current].output.label}</span>
                    </div>
                    <p className="ui-agrp__body" data-tone={steps[current].output.tone ?? "plain"}>
                      {steps[current].output.body}
                    </p>
                    {steps[current].output.meta ? (
                      <p className="ui-agrp__meta">{steps[current].output.meta}</p>
                    ) : null}
                  </section>

                  <section className="ui-agrp__region" data-region="decision" aria-label="Decision">
                    <div className="ui-agrp__region-head">
                      <h5>Decision</h5>
                      <span className="ui-agrp__payload-label">
                        {branches.length > 0
                          ? `${branches.length} ${unit(branches.length, "alternative")} weighed`
                          : "No alternative seen"}
                      </span>
                    </div>
                    <p className="ui-agrp__choice">{steps[current].decision.choice}</p>
                    <p className="ui-agrp__why">{steps[current].decision.rationale}</p>

                    {branches.length > 0 ? (
                      <div className="ui-agrp__branches">
                        <h6 className="ui-agrp__sub">
                          Weighed {branches.length} {unit(branches.length, "alternative")}
                        </h6>
                        <ul className="ui-agrp__branch-list">
                          {branches.map((branch) => (
                            <li
                              key={branch.id}
                              className="ui-agrp__branch"
                              data-taken={branch.taken ? "" : undefined}
                            >
                              <span className="ui-agrp__branch-mark" aria-hidden="true">
                                {branch.taken ? <TakenGlyph /> : <SetAsideGlyph />}
                              </span>
                              <span className="ui-agrp__branch-label">{branch.label}</span>
                              <span className="ui-agrp__branch-state">
                                {branch.taken ? "Taken" : "Set aside"}
                              </span>
                              <span className="ui-agrp__branch-note">{branch.note}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </section>
                </div>
              </div>
            </div>
          </div>

          <div className="ui-agrp__controls">
            <button
              type="button"
              className="ui-agrp__nav"
              onClick={() => go(current - 1)}
              disabled={current === 0}
            >
              <PrevGlyph />
              Previous
            </button>
            <button
              type="button"
              className="ui-agrp__nav"
              onClick={() => go(current + 1)}
              disabled={current >= last}
            >
              Next
              <NextGlyph />
            </button>
            <span className="ui-agrp__pos">
              Step <b>{current + 1}</b> of {count}
            </span>
            <span className="ui-agrp__keys">
              <kbd aria-hidden="true">
                <PrevGlyph />
              </kbd>
              <kbd aria-hidden="true">
                <NextGlyph />
              </kbd>
              Arrow keys step
            </span>
          </div>

          <span className="ui-agrp__live" role="status" aria-live="polite">
            Step {current + 1} of {count}: {steps[current].label}
          </span>
        </>
      )}
    </div>
  );
}

/* ---------- Reading the rail ---------- */

type RailNode = { x: number; y: number };
type RailGeometry = { w: number; h: number; nodes: RailNode[] };

const EMPTY_RAIL: RailGeometry = { w: 0, h: 0, nodes: [] };

/** The marker is this tall, so its centre lands on a node centre. `--ui-agrp-marker-len` matches. */
const MARK = 26;

const sameRail = (a: RailGeometry, b: RailGeometry) => {
  if (a.w !== b.w || a.h !== b.h || a.nodes.length !== b.nodes.length) return false;
  return a.nodes.every((node, i) => {
    const other = b.nodes[i];
    return Math.abs(node.x - other.x) < 0.5 && Math.abs(node.y - other.y) < 0.5;
  });
};

const unit = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

/** What a rail tab reads out, since a narrow rail shows only the number. */
const stepName = (step: ReplayStep, i: number, options: number) => {
  const parts = [`Step ${i + 1}: ${step.label}`];
  if (options > 0) parts.push(`${options} ${unit(options, "alternative")} weighed`);
  if (step.tool) parts.push(`called ${step.tool}`);
  if (step.output.tone === "bad") parts.push("failed");
  return parts.join(", ");
};

/* ---------- Glyphs ---------- */

function ChainGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4.6v2.4M4 9.6v2.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="4" cy="3" r="1.5" fill="currentColor" />
      <circle cx="4" cy="8" r="1.5" fill="currentColor" />
      <circle cx="4" cy="13" r="1.5" fill="currentColor" />
      <path d="M7 3h6M7 8h4.4M7 13h5.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ListGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 4h8M6 8h8M6 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="3" cy="4" r="1.1" fill="currentColor" />
      <circle cx="3" cy="8" r="1.1" fill="currentColor" />
      <circle cx="3" cy="12" r="1.1" fill="currentColor" />
    </svg>
  );
}

function ForkGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 8h3.4M6.4 8l4.2-3.8M6.4 8l4.2 3.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="11.9" cy="3.6" r="1.9" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="11.9" cy="12.4" r="1.9" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ToolGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.6 5.2 6.7 8l-3.1 2.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8.6 11.6h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function FailedGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2.6 14.2 13.4H1.8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 6.8v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11.6" r="0.9" fill="currentColor" />
    </svg>
  );
}

function TakenGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.4 8.2 7.3 10.1l3.4-3.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SetAsideGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle
        cx="8"
        cy="8"
        r="6.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="1.6 2.4"
      />
      <path d="M5.7 8h4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PrevGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10 3.4 5.4 8l4.6 4.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NextGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6 3.4 10.6 8 6 12.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const css = /* css */ `
.ui-agrp {
  /* Knobs. Override them on \`.ui-agrp { … }\` to reskin the replay. Each one prefers the document
     token when the host provides it and falls back to the Ember value when it does not, so the
     component is correct in a host that loads nothing but this file. */
  --ui-agrp-surface: var(--panel, #1a1512);
  --ui-agrp-card: var(--card, #201a15);
  --ui-agrp-raised: var(--preview, #26201a);
  --ui-agrp-ink: var(--text, #f4ece4);
  --ui-agrp-muted: var(--text-muted, #a2958a);
  --ui-agrp-subtle: var(--text-subtle, #f4ece48c);
  --ui-agrp-line: var(--border, #33291f);
  --ui-agrp-line-soft: var(--border-soft, #ffffff12);
  --ui-agrp-card-stroke: var(--card-stroke, #ffffff0d);
  --ui-agrp-quiet: var(--muted-bg, #ffffff0d);
  --ui-agrp-wash: var(--hover-bg, #ffffff12);
  --ui-agrp-accent: var(--accent, #ff6b35);
  --ui-agrp-accent-soft: var(--accent-soft, #ff6b3524);
  --ui-agrp-accent-fg: var(--accent-fg, #1a0f08);
  --ui-agrp-danger: var(--danger, #e87068);
  --ui-agrp-shadow: var(--shadow-card, 0 1px 1.5px #0000004d, inset 0 -1px 0 #ffffff0a);
  --ui-agrp-panel-r: var(--radius-panel, 20px);
  --ui-agrp-card-r: var(--radius-card, 16px);
  --ui-agrp-chip-r: var(--radius-pill, 999px);
  --ui-agrp-sans: var(--font-sans, "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  --ui-agrp-mono: var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace);
  /* Motion is the token scale with the literal inline, so the chain still moves in a host that
     never loads motion.css. */
  --ui-agrp-dur-1: var(--nm-dur-1, 90ms);
  --ui-agrp-dur-2: var(--nm-dur-2, 160ms);
  --ui-agrp-dur-3: var(--nm-dur-3, 240ms);
  --ui-agrp-dur-4: var(--nm-dur-4, 380ms);
  --ui-agrp-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-agrp-ease-both: var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1));
  --ui-agrp-spring: var(--nm-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  /* The spine and the traversed path are drawn from the ink, never the accent: ember marks the one
     live step on screen and nothing else. */
  --ui-agrp-track: color-mix(in srgb, var(--ui-agrp-ink) 14%, transparent);
  --ui-agrp-trail: color-mix(in srgb, var(--ui-agrp-ink) 46%, transparent);
  --ui-agrp-hair: color-mix(in srgb, var(--ui-agrp-ink) 20%, transparent);
  --ui-agrp-marker-len: 26px;

  position: relative;
  container-type: inline-size;
  display: grid;
  gap: 14px;
  padding: 18px;
  border-radius: var(--ui-agrp-panel-r);
  background: var(--ui-agrp-surface);
  box-shadow: var(--ui-agrp-shadow), inset 0 0 0 1px var(--ui-agrp-line-soft);
  color: var(--ui-agrp-ink);
  font-family: var(--ui-agrp-sans);
  font-size: 13px;
  line-height: 1.5;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
}
.ui-agrp *,
.ui-agrp *::before,
.ui-agrp *::after {
  box-sizing: border-box;
}
:where(.ui-agrp) button {
  appearance: none;
  margin: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.ui-agrp svg {
  display: block;
  flex: none;
}
.ui-agrp__step:focus-visible {
  outline: 2px solid var(--ui-agrp-accent);
  outline-offset: -1px;
}
.ui-agrp__nav:focus-visible,
.ui-agrp__panel:focus-visible {
  outline: 2px solid var(--ui-agrp-accent);
  outline-offset: 2px;
}

/* ---------- Variants ----------
 * The root carries three hooks, so a consumer can target them from outside the component:
 * \`data-dir\` (the direction of the last step), \`data-armed\` (the tick may spring from here on) and
 * \`data-state\` (empty or ready). The first two also drive the motion below. */

/* ---------- Head ---------- */

.ui-agrp__head {
  display: grid;
  gap: 7px;
}
.ui-agrp__kicker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ui-agrp-muted);
}
.ui-agrp__kicker svg {
  width: 13px;
  height: 13px;
}
.ui-agrp__top {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 3px 10px;
}
.ui-agrp__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--ui-agrp-ink);
}
.ui-agrp__agent {
  font-family: var(--ui-agrp-mono);
  font-size: 11px;
  color: var(--ui-agrp-muted);
}
.ui-agrp__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.ui-agrp__stat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 8px;
  border-radius: var(--ui-agrp-chip-r);
  background: var(--ui-agrp-quiet);
  box-shadow: inset 0 0 0 1px var(--ui-agrp-line-soft);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  color: var(--ui-agrp-muted);
}
.ui-agrp__stat svg {
  width: 12px;
  height: 12px;
  color: var(--ui-agrp-subtle);
}
.ui-agrp__stat b {
  font-weight: 600;
  color: var(--ui-agrp-ink);
}
.ui-agrp__stat[data-kind="failed"],
.ui-agrp__stat[data-kind="failed"] b {
  color: var(--ui-agrp-danger);
}
.ui-agrp__stat[data-kind="failed"] svg {
  color: var(--ui-agrp-danger);
}

/* ---------- Rail and panel ---------- */

.ui-agrp__grid {
  display: grid;
  grid-template-columns: minmax(180px, 0.68fr) minmax(0, 1.6fr);
  gap: 12px;
  align-items: start;
}
.ui-agrp__railwrap {
  position: relative;
  padding: 4px 0;
}
.ui-agrp__track {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}
.ui-agrp__spine {
  fill: none;
  stroke: var(--ui-agrp-track);
  stroke-width: 1.25;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.ui-agrp__trail {
  stroke: var(--ui-agrp-trail);
  stroke-width: 2.25;
  stroke-linecap: round;
  transition: stroke-dashoffset var(--ui-agrp-dur-4) var(--ui-agrp-ease-out);
}
.ui-agrp__marker {
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: var(--ui-agrp-marker-len);
  border-radius: var(--ui-agrp-chip-r);
  background: var(--ui-agrp-accent);
  box-shadow: 2px 0 12px 0 var(--ui-agrp-accent-soft);
}
.ui-agrp[data-armed] .ui-agrp__marker {
  transition: transform var(--ui-agrp-dur-4) var(--ui-agrp-spring);
}
.ui-agrp__rail {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 3px;
}
.ui-agrp__step {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 3px 9px;
  width: 100%;
  padding: 6px 9px 6px 7px;
  border-radius: var(--ui-agrp-card-r);
  text-align: left;
  transition: background-color var(--ui-agrp-dur-2) var(--ui-agrp-ease-both);
}
.ui-agrp__step:hover,
.ui-agrp__step[data-current] {
  background: var(--ui-agrp-quiet);
}
.ui-agrp__num {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--ui-agrp-subtle);
  box-shadow: inset 0 0 0 1px var(--ui-agrp-line);
  transition:
    background-color var(--ui-agrp-dur-2) var(--ui-agrp-ease-both),
    color var(--ui-agrp-dur-2) var(--ui-agrp-ease-both),
    box-shadow var(--ui-agrp-dur-2) var(--ui-agrp-ease-both);
}
.ui-agrp__step[data-seen] .ui-agrp__num {
  background: var(--ui-agrp-raised);
  box-shadow: inset 0 0 0 1px var(--ui-agrp-hair);
  color: var(--ui-agrp-ink);
}
.ui-agrp__step[data-failed] .ui-agrp__num {
  box-shadow: inset 0 0 0 1.5px var(--ui-agrp-danger);
}
.ui-agrp__step[data-current] .ui-agrp__num {
  background: var(--ui-agrp-accent);
  box-shadow: 0 0 0 3px var(--ui-agrp-accent-soft);
  color: var(--ui-agrp-accent-fg);
}
.ui-agrp__step[data-current][data-failed] .ui-agrp__num {
  box-shadow:
    0 0 0 3px var(--ui-agrp-accent-soft),
    inset 0 0 0 1.5px var(--ui-agrp-danger);
}
.ui-agrp__step-label {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 12.5px;
  color: var(--ui-agrp-subtle);
  transition: color var(--ui-agrp-dur-2) var(--ui-agrp-ease-both);
}
.ui-agrp__step[data-seen] .ui-agrp__step-label {
  color: var(--ui-agrp-muted);
}
.ui-agrp__step[data-current] .ui-agrp__step-label {
  font-weight: 500;
  color: var(--ui-agrp-ink);
}
.ui-agrp__marks {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--ui-agrp-subtle);
}
.ui-agrp__marks svg {
  width: 12px;
  height: 12px;
}
.ui-agrp__step[data-seen] .ui-agrp__marks {
  color: var(--ui-agrp-muted);
}
.ui-agrp__step[data-failed] .ui-agrp__marks {
  color: var(--ui-agrp-danger);
}

.ui-agrp__panel {
  overflow: hidden;
  border-radius: var(--ui-agrp-card-r);
  background: var(--ui-agrp-card);
  box-shadow: var(--ui-agrp-shadow), inset 0 0 0 1px var(--ui-agrp-card-stroke);
}
.ui-agrp__detail {
  display: grid;
  gap: 12px;
  padding: 14px;
  animation: ui-agrp-settle-fwd var(--ui-agrp-dur-4) var(--ui-agrp-ease-out) both;
}
.ui-agrp[data-dir="back"] .ui-agrp__detail {
  animation-name: ui-agrp-settle-back;
}
.ui-agrp__stephead {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 4px 10px;
  animation: ui-agrp-head-fwd var(--ui-agrp-dur-3) var(--ui-agrp-ease-out) both;
}
.ui-agrp[data-dir="back"] .ui-agrp__stephead {
  animation-name: ui-agrp-head-back;
}
.ui-agrp__steppos {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--ui-agrp-muted);
}
.ui-agrp__steppos b {
  font-weight: 600;
  color: var(--ui-agrp-ink);
}
.ui-agrp__flags {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}
.ui-agrp__flag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px 3px 7px;
  border-radius: var(--ui-agrp-chip-r);
  background: var(--ui-agrp-quiet);
  box-shadow: inset 0 0 0 1px var(--ui-agrp-line-soft);
  font-family: var(--ui-agrp-mono);
  font-size: 10.5px;
  color: var(--ui-agrp-muted);
}
.ui-agrp__flag svg {
  width: 11px;
  height: 11px;
  color: var(--ui-agrp-subtle);
}
.ui-agrp__flag[data-kind="none"] {
  font-family: var(--ui-agrp-sans);
  color: var(--ui-agrp-subtle);
}
.ui-agrp__flag[data-kind="failed"] {
  color: var(--ui-agrp-danger);
}
.ui-agrp__flag[data-kind="failed"] svg {
  color: var(--ui-agrp-danger);
}
.ui-agrp__steplabel {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--ui-agrp-ink);
  text-wrap: balance;
}

/* ---------- Input, output, decision ---------- */

.ui-agrp__regions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}
.ui-agrp__region {
  display: grid;
  align-content: start;
  gap: 7px;
  min-height: 92px;
  padding: 11px;
  border-radius: var(--ui-agrp-card-r);
  background: var(--ui-agrp-raised);
  box-shadow: inset 0 0 0 1px var(--ui-agrp-line-soft);
}
.ui-agrp__region[data-region="decision"] {
  grid-column: 1 / -1;
  min-height: 0;
  background: var(--ui-agrp-card);
  box-shadow: inset 0 0 0 1px var(--ui-agrp-line), inset 3px 0 0 0 var(--ui-agrp-hair);
}
.ui-agrp__region-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.ui-agrp__region-head h5 {
  flex: none;
  margin: 0;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ui-agrp-muted);
}
.ui-agrp__payload-label {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-family: var(--ui-agrp-mono);
  font-size: 11px;
  color: var(--ui-agrp-subtle);
}
.ui-agrp__body {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--ui-agrp-ink);
  overflow-wrap: anywhere;
}
.ui-agrp__body[data-tone="code"] {
  padding: 8px 9px;
  border-radius: 8px;
  background: var(--ui-agrp-quiet);
  font-family: var(--ui-agrp-mono);
  font-size: 11.5px;
  white-space: pre-wrap;
}
.ui-agrp__body[data-tone="bad"] {
  color: var(--ui-agrp-danger);
}
.ui-agrp__meta {
  margin: 0;
  font-family: var(--ui-agrp-mono);
  font-size: 10.5px;
  color: var(--ui-agrp-subtle);
  overflow-wrap: anywhere;
}
.ui-agrp__choice {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.45;
  color: var(--ui-agrp-ink);
  text-wrap: balance;
}
.ui-agrp__why {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--ui-agrp-muted);
  overflow-wrap: anywhere;
}

/* ---------- The alternatives a step weighed ---------- */

.ui-agrp__branches {
  display: grid;
  gap: 6px;
  padding-top: 3px;
}
.ui-agrp__sub {
  margin: 0;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ui-agrp-muted);
}
.ui-agrp__branch-list {
  display: grid;
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.ui-agrp__branch {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto;
  align-items: center;
  gap: 2px 8px;
  padding: 7px 9px;
  border-radius: var(--ui-agrp-card-r);
  background: var(--ui-agrp-raised);
  box-shadow: inset 0 0 0 1px var(--ui-agrp-line-soft);
}
.ui-agrp__branch[data-taken] {
  background: var(--ui-agrp-quiet);
  box-shadow: inset 0 0 0 1px var(--ui-agrp-hair);
}
.ui-agrp__branch-mark {
  grid-row: span 2;
  display: grid;
  place-items: center;
  align-self: center;
  color: var(--ui-agrp-subtle);
}
.ui-agrp__branch[data-taken] .ui-agrp__branch-mark {
  color: var(--ui-agrp-ink);
}
.ui-agrp__branch-mark svg {
  width: 15px;
  height: 15px;
}
.ui-agrp__branch-label {
  font-size: 12.5px;
  color: var(--ui-agrp-muted);
}
.ui-agrp__branch[data-taken] .ui-agrp__branch-label {
  font-weight: 500;
  color: var(--ui-agrp-ink);
}
.ui-agrp__branch-state {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  color: var(--ui-agrp-subtle);
}
.ui-agrp__branch[data-taken] .ui-agrp__branch-state {
  color: var(--ui-agrp-ink);
}
.ui-agrp__branch-note {
  grid-column: 2 / -1;
  font-size: 11.5px;
  line-height: 1.45;
  color: var(--ui-agrp-subtle);
}
.ui-agrp__branch[data-taken] .ui-agrp__branch-note {
  color: var(--ui-agrp-muted);
}

/* ---------- Controls ---------- */

.ui-agrp__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
}
.ui-agrp__nav {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 11px;
  border-radius: var(--ui-agrp-chip-r);
  background: var(--ui-agrp-raised);
  box-shadow: inset 0 0 0 1px var(--ui-agrp-line-soft);
  font-size: 12px;
  color: var(--ui-agrp-ink);
  transition:
    background-color var(--ui-agrp-dur-1) var(--ui-agrp-ease-out),
    transform var(--ui-agrp-dur-1) var(--ui-agrp-ease-out),
    opacity var(--ui-agrp-dur-2) var(--ui-agrp-ease-out);
}
.ui-agrp__nav:hover:not(:disabled) {
  background: var(--ui-agrp-wash);
}
.ui-agrp__nav:active:not(:disabled) {
  transform: translate3d(0, 1px, 0);
}
.ui-agrp__nav:disabled {
  opacity: 0.4;
  cursor: default;
}
.ui-agrp__nav svg {
  width: 13px;
  height: 13px;
  color: var(--ui-agrp-muted);
}
.ui-agrp__pos {
  margin-left: auto;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--ui-agrp-muted);
}
.ui-agrp__pos b {
  font-weight: 600;
  color: var(--ui-agrp-ink);
}
.ui-agrp__keys {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: var(--ui-agrp-subtle);
}
.ui-agrp__keys kbd {
  display: grid;
  place-items: center;
  width: 19px;
  height: 19px;
  border-radius: 6px;
  background: var(--ui-agrp-quiet);
  box-shadow: inset 0 0 0 1px var(--ui-agrp-line-soft);
  color: var(--ui-agrp-muted);
}
.ui-agrp__keys svg {
  width: 11px;
  height: 11px;
}

/* ---------- Nothing to step through ---------- */

.ui-agrp__empty {
  display: grid;
  justify-items: start;
  gap: 9px;
  padding: 22px 18px;
  border-radius: var(--ui-agrp-card-r);
  background: var(--ui-agrp-card);
  box-shadow: inset 0 0 0 1px var(--ui-agrp-line-soft);
}
.ui-agrp__empty-mark {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--ui-agrp-quiet);
  color: var(--ui-agrp-muted);
}
.ui-agrp__empty-mark svg {
  width: 15px;
  height: 15px;
}
.ui-agrp__empty-text {
  max-width: 46ch;
  margin: 0;
  font-size: 12.5px;
  color: var(--ui-agrp-muted);
}

.ui-agrp__live {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  white-space: nowrap;
  clip-path: inset(50%);
}

/* ---------- Direction of travel ---------- */

@keyframes ui-agrp-settle-fwd {
  from {
    opacity: 0;
    translate: 0 14px;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}
@keyframes ui-agrp-settle-back {
  from {
    opacity: 0;
    translate: 0 -14px;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}
@keyframes ui-agrp-head-fwd {
  from {
    opacity: 0;
    translate: 10px 0;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}
@keyframes ui-agrp-head-back {
  from {
    opacity: 0;
    translate: -10px 0;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}

/* ---------- Narrow containers ---------- */

@container (max-width: 620px) {
  .ui-agrp__grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .ui-agrp__railwrap {
    max-height: 34vh;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }
  .ui-agrp__step-label {
    white-space: normal;
  }
  .ui-agrp__regions {
    grid-template-columns: minmax(0, 1fr);
  }
  .ui-agrp__pos {
    order: 3;
    margin-left: 0;
  }
}

/* ---------- Dark ----------
 * The base already carries the Ember dark palette, because dark is the identity's default. This
 * block pins it: a host that supplies light tokens but puts \`.dark\` on an ancestor still gets dark
 * chrome here, because these declarations no longer read the host's layer. */
:where(.dark, [data-theme="dark"]) .ui-agrp {
  --ui-agrp-surface: #1a1512;
  --ui-agrp-card: #201a15;
  --ui-agrp-raised: #26201a;
  --ui-agrp-ink: #f4ece4;
  --ui-agrp-muted: #a2958a;
  --ui-agrp-subtle: #f4ece48c;
  --ui-agrp-line: #33291f;
  --ui-agrp-line-soft: #ffffff12;
  --ui-agrp-card-stroke: #ffffff0d;
  --ui-agrp-quiet: #ffffff0d;
  --ui-agrp-wash: #ffffff12;
  --ui-agrp-accent: #ff6b35;
  --ui-agrp-accent-soft: #ff6b3524;
  --ui-agrp-accent-fg: #1a0f08;
  --ui-agrp-danger: var(--danger, #e87068);
  --ui-agrp-shadow: 0 1px 1.5px #0000004d, inset 0 -1px 0 #ffffff0a;
  color-scheme: dark;
}

/* ---------- Reduced motion ----------
 * Nothing travels: the detail, the header and the trail arrive at their end state at once, and the
 * tick is simply already there. Colour still changes, because it carries meaning on its own. */
@media (prefers-reduced-motion: reduce) {
  .ui-agrp *,
  .ui-agrp *::before,
  .ui-agrp *::after {
    animation: none;
    transition-duration: 1ms;
  }
  /* The marker's armed transition and the backward animation names both out-specify the block
     above, so each is cancelled by name. */
  .ui-agrp[data-armed] .ui-agrp__marker {
    transition: none;
  }
  .ui-agrp__detail,
  .ui-agrp__stephead,
  .ui-agrp[data-dir="back"] .ui-agrp__detail,
  .ui-agrp[data-dir="back"] .ui-agrp__stephead {
    animation: none;
  }
}
`;