"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";

/*
 * Agent Permissions: the matrix where a person rules on every tool an agent asked for.
 * A row is one tool: its name, how risky it is, what it would touch and the reason it wants the
 * right. The ruling is three real radio seats and the swell springs between them, so the decision
 * is something you can see move. A denied row recedes under a hatch while its detail settles, its
 * name is struck through and its mark is slashed, so the state reads without the colour.
 * Scope decides how long the ruling holds, and the summary counters roll to their totals.
 * The styles are injected below, so no extra files are needed.
 */

/** How much the tool could cost if it went wrong. */
export type PermissionRisk = "low" | "medium" | "high";

/** The ruling on one tool. */
export type PermissionDecision = "allow" | "ask" | "deny";

/** How long a ruling holds. */
export type PermissionScope = "once" | "session" | "always";

/** One tool asking for a right. */
export type PermissionTool = {
  /** Stable id, reported back by onChange */
  id: string;
  /** The name the runner shows, e.g. "stripe.refunds" */
  name: string;
  /** Why the agent is asking, in one line */
  reason: string;
  /** low, medium or high */
  risk: PermissionRisk;
  /** What it would touch: a scope, a host, a path */
  access?: string;
  /** A workspace policy already fixed this tool, so the person cannot move it */
  locked?: boolean;
  /** A mark drawn before the name, on currentColor */
  icon?: ReactNode;
};

/** How the rulings are spread across the tools. */
export type PermissionSummary = { allow: number; ask: number; deny: number };

export type AgentPermissionsProps = {
  /** The tools asking for a right, in the order they should be ruled on */
  tools: PermissionTool[];
  /** Controlled rulings, keyed by tool id */
  value?: Record<string, PermissionDecision>;
  /** Starting rulings for the uncontrolled case */
  defaultValue?: Record<string, PermissionDecision>;
  /** Fires with the tool id and its new ruling */
  onChange?: (id: string, decision: PermissionDecision) => void;
  /** Controlled scope */
  scope?: PermissionScope;
  /** Starting scope, defaults to "session" */
  defaultScope?: PermissionScope;
  /** Fires when the scope changes */
  onScopeChange?: (scope: PermissionScope) => void;
  /** Fires when the rulings are handed to the runner */
  onApply?: (rulings: Record<string, PermissionDecision>, scope: PermissionScope) => void;
  /** Heading over the matrix */
  title?: string;
  /** Who is asking, shown under the heading */
  subject?: string;
  className?: string;
};

export function AgentPermissions({
  tools,
  value,
  defaultValue,
  onChange,
  scope: scopeProp,
  defaultScope = "session",
  onScopeChange,
  onApply,
  title = "Tool permissions",
  subject,
  className,
}: AgentPermissionsProps) {
  const titleId = useId();
  const scopeLabelId = useId();
  const hintId = useId();
  const root = useRef<HTMLDivElement>(null);
  const scopeSeats = useRef<Array<HTMLButtonElement | null>>([]);
  const [innerDecisions, setInnerDecisions] = useState<Record<string, PermissionDecision>>(
    () => defaultValue ?? {},
  );
  const [innerScope, setInnerScope] = useState<PermissionScope>(defaultScope);
  const [applied, setApplied] = useState<{ sig: string; at: number } | null>(null);

  const chosen = value !== undefined ? value : innerDecisions;
  const scope = scopeProp !== undefined ? scopeProp : innerScope;
  const onScreen = useOnScreen(root);

  /* A locked tool is answered by policy, not by the person, so it reads as denied whatever the
     caller's map says. Everything else starts at "ask": silence is never consent. */
  const rulings: Record<string, PermissionDecision> = { ...chosen };
  for (const tool of tools) {
    rulings[tool.id] = tool.locked ? "deny" : chosen[tool.id] ?? "ask";
  }

  const counts = summarizePermissions(tools, rulings);
  const shown = useRolledCounts(counts, onScreen, root);
  const sig = tools.map((tool) => rulings[tool.id]).join("") + "|" + scope;
  const settled = applied !== null && applied.sig === sig;
  const resting = settled || tools.length === 0;

  const status =
    tools.length === 0
      ? "Nothing to apply"
      : applied === null
        ? "Not applied yet"
        : settled
          ? `Applied ${SCOPE_APPLIED[scope]} at ${clock(applied.at)}`
          : `Changed since ${clock(applied.at)}`;

  const settle = (id: string, decision: PermissionDecision) => {
    const tool = tools.find((item) => item.id === id);
    if (!tool || tool.locked || rulings[id] === decision) return;
    if (value === undefined) setInnerDecisions({ ...chosen, [id]: decision });
    onChange?.(id, decision);
  };

  const pickScope = (next: PermissionScope) => {
    if (next === scope) return;
    if (scopeProp === undefined) setInnerScope(next);
    onScopeChange?.(next);
  };

  const onScopeKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = stepIndex(event.key, SCOPE_ORDER.length, SCOPE_ORDER.indexOf(scope));
    if (next < 0) return;
    const item = SCOPE_ORDER[next];
    if (item === undefined) return;
    event.preventDefault();
    pickScope(item);
    scopeSeats.current[next]?.focus();
  };

  const commit = () => {
    setApplied({ sig, at: Date.now() });
    onApply?.(rulings, scope);
  };

  return (
    <div
      ref={root}
      className={["ui-agpm", className].filter(Boolean).join(" ")}
      role="group"
      aria-labelledby={titleId}
    >
      {/* React 19 hoists this into <head> once, no matter how many matrices render */}
      <style href="ui-agent-permissions" precedence="default">
        {css}
      </style>

      <div className="ui-agpm__bar">
        <div className="ui-agpm__titles">
          <span className="ui-agpm__title" id={titleId}>
            {title}
          </span>
          <p className="ui-agpm__subject">
            {subject ? (
              <>
                Requested by <b>{subject}</b>
              </>
            ) : (
              "Tool request"
            )}
            {` · ${tools.length} ${tools.length === 1 ? "tool" : "tools"}`}
          </p>
        </div>

        {/* The numbers roll, so the reader hears one settled tally instead of every frame */}
        <p className="ui-agpm__tally" aria-hidden="true">
          <span className="ui-agpm__count" data-decision="allow">
            <CheckGlyph />
            <b>{shown.allow}</b>
            allowed
          </span>
          <span className="ui-agpm__count" data-decision="ask">
            <PauseGlyph />
            <b>{shown.ask}</b>
            will ask
          </span>
          <span className="ui-agpm__count" data-decision="deny">
            <DenyGlyph />
            <b>{shown.deny}</b>
            denied
          </span>
        </p>
        <span className="ui-agpm__sr" role="status" aria-live="polite">
          {`${counts.allow} allowed, ${counts.ask} will ask, ${counts.deny} denied`}
        </span>
      </div>

      {tools.length > 0 ? (
        <ul className="ui-agpm__list">
          {tools.map((tool) => {
            const state = rulings[tool.id];
            const caution = tool.risk === "high" && state === "allow";
            return (
              <li
                key={tool.id}
                className="ui-agpm__row"
                data-decision={state}
                data-risk={tool.risk}
                data-locked={tool.locked ? "" : undefined}
                data-caution={caution ? "" : undefined}
              >
                <span className="ui-agpm__mark" aria-hidden="true">
                  {tool.icon ?? <ToolGlyph />}
                </span>

                <div className="ui-agpm__main">
                  <div className="ui-agpm__head">
                    <span className="ui-agpm__name">{tool.name}</span>
                    <span className="ui-agpm__risk" data-risk={tool.risk}>
                      <RiskMeter level={RISK_LEVEL[tool.risk]} />
                      {RISK_LABEL[tool.risk]}
                    </span>
                    {tool.locked ? (
                      <span className="ui-agpm__lock">
                        <LockGlyph />
                        Workspace policy
                      </span>
                    ) : null}
                  </div>
                  <p className="ui-agpm__reason">{tool.reason}</p>
                  {tool.access ? <p className="ui-agpm__access">{tool.access}</p> : null}
                </div>

                {caution ? (
                  <span className="ui-agpm__flag">
                    <CautionGlyph />
                    No prompt
                  </span>
                ) : null}

                <StateControl
                  tool={tool}
                  value={state}
                  onPick={(decision) => settle(tool.id, decision)}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="ui-agpm__empty">
          <span className="ui-agpm__empty-mark" aria-hidden="true">
            <ShieldGlyph />
          </span>
          <p className="ui-agpm__empty-title">No tools requested yet</p>
          <p className="ui-agpm__empty-note">
            Nothing is running with an open right. When the agent asks for one, it arrives here for a
            ruling.
          </p>
        </div>
      )}

      <div className="ui-agpm__foot">
        <div className="ui-agpm__scopewrap">
          <span className="ui-agpm__scope-label" id={scopeLabelId}>
            Remember this decision
          </span>
          <div
            className="ui-agpm__scopes"
            role="radiogroup"
            aria-labelledby={scopeLabelId}
            aria-describedby={hintId}
            data-scope={scope}
            onKeyDown={onScopeKey}
          >
            <span className="ui-agpm__scope-swell" aria-hidden="true" />
            {SCOPE_ORDER.map((item, index) => (
              <button
                key={item}
                type="button"
                role="radio"
                className="ui-agpm__scope"
                aria-checked={item === scope}
                data-scope={item}
                tabIndex={item === scope ? 0 : -1}
                ref={(el) => {
                  scopeSeats.current[index] = el;
                }}
                onClick={() => pickScope(item)}
              >
                {SCOPE_LABEL[item]}
              </button>
            ))}
          </div>
          <p className="ui-agpm__hint" id={hintId} aria-live="polite">
            {SCOPE_HINT[scope]}
          </p>
        </div>

        <div className="ui-agpm__submit">
          <span className="ui-agpm__status" role="status" aria-live="polite">
            {status}
          </span>
          <button
            type="button"
            className="ui-agpm__apply"
            data-resting={resting ? "" : undefined}
            disabled={resting}
            onClick={commit}
          >
            {settled ? <CheckGlyph /> : <SendGlyph />}
            {settled ? "Applied" : "Apply decisions"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Counts the rulings across the tools, in the order the summary reads them. */
export function summarizePermissions(
  tools: readonly PermissionTool[],
  rulings: Record<string, PermissionDecision>,
): PermissionSummary {
  const summary: PermissionSummary = { allow: 0, ask: 0, deny: 0 };
  for (const tool of tools) {
    const decision = tool.locked ? "deny" : rulings[tool.id] ?? "ask";
    summary[decision] += 1;
  }
  return summary;
}

/* ---------- The three seats ---------- */

type StateControlProps = {
  tool: PermissionTool;
  value: PermissionDecision;
  onPick: (decision: PermissionDecision) => void;
};

/* One radio group per row: the seats are real buttons with roving focus, so Tab steps from row to
   row and the arrow keys move and rule within a row, the way a radio group is expected to behave. */
function StateControl({ tool, value, onPick }: StateControlProps) {
  const seats = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (tool.locked) return;
    const next = stepIndex(event.key, DECISION_ORDER.length, DECISION_ORDER.indexOf(value));
    if (next < 0) return;
    const decision = DECISION_ORDER[next];
    if (decision === undefined) return;
    event.preventDefault();
    onPick(decision);
    seats.current[next]?.focus();
  };

  return (
    <div
      className="ui-agpm__control"
      role="radiogroup"
      aria-label={`Permission for ${tool.name}`}
      data-decision={value}
      data-locked={tool.locked ? "" : undefined}
      onKeyDown={onKeyDown}
    >
      <span className="ui-agpm__swell" aria-hidden="true" />
      {/* Policy seats stay in the tab order so the row can still be found and read, but nothing
          happens on click or arrow: aria-disabled says so without hiding the tool. */}
      {DECISION_ORDER.map((decision, index) => (
        <button
          key={decision}
          type="button"
          role="radio"
          className="ui-agpm__opt"
          data-decision={decision}
          aria-checked={value === decision}
          aria-disabled={tool.locked || undefined}
          tabIndex={value === decision ? 0 : -1}
          ref={(el) => {
            seats.current[index] = el;
          }}
          onClick={() => onPick(decision)}
        >
          {DECISION_GLYPH[decision]}
          {DECISION_LABEL[decision]}
        </button>
      ))}
    </div>
  );
}

/* ---------- Behaviour helpers ---------- */

/** Arrow, Home and End land on a seat index; anything else is -1. */
function stepIndex(key: string, length: number, at: number): number {
  if (key === "ArrowRight" || key === "ArrowDown") return at >= length - 1 ? 0 : at + 1;
  if (key === "ArrowLeft" || key === "ArrowUp") return at <= 0 ? length - 1 : at - 1;
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  return -1;
}

/* The roll is a surface change rather than a control twitch, so it takes --nm-dur-4's 380ms. */
const ROLL_MS = 380;

/** Reads a duration token off the element, so the JS roll keeps step with motion.css. */
function tokenMs(el: HTMLElement | null, name: string, fallback: number): number {
  if (!el || typeof window === "undefined") return fallback;
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return fallback;
  if (raw.endsWith("ms")) return value;
  if (raw.endsWith("s")) return value * 1000;
  return fallback;
}

/** Rolls the three counters to their new totals, on a rAF loop that is cleared on unmount. */
function useRolledCounts(
  target: PermissionSummary,
  onScreen: boolean,
  host: RefObject<HTMLDivElement | null>,
): PermissionSummary {
  const [shown, setShown] = useState<PermissionSummary>(target);
  const live = useRef<PermissionSummary>(target);
  const origin = useRef<PermissionSummary>(target);
  const goal = useRef<PermissionSummary>(target);
  const frame = useRef(0);
  goal.current = target;

  useEffect(() => {
    const same =
      live.current.allow === target.allow &&
      live.current.ask === target.ask &&
      live.current.deny === target.deny;
    if (same) return;

    /* Off screen, or asked for less motion, the true value is the only useful one. */
    const calm =
      typeof window === "undefined" ||
      !onScreen ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (calm) {
      live.current = target;
      setShown(target);
      return;
    }

    origin.current = live.current;
    const began = performance.now();
    const duration = tokenMs(host.current, "--nm-dur-4", ROLL_MS);
    cancelAnimationFrame(frame.current);
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / duration);
      const k = 1 - Math.pow(1 - t, 3);
      const next: PermissionSummary = {
        allow: Math.round(origin.current.allow + (goal.current.allow - origin.current.allow) * k),
        ask: Math.round(origin.current.ask + (goal.current.ask - origin.current.ask) * k),
        deny: Math.round(origin.current.deny + (goal.current.deny - origin.current.deny) * k),
      };
      live.current = next;
      setShown(next);
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [target.allow, target.ask, target.deny, onScreen, host]);

  /* A tab that was in the background while the count moved lands on the true value, not mid-roll. */
  useEffect(() => {
    const snap = () => {
      if (!document.hidden) return;
      cancelAnimationFrame(frame.current);
      live.current = goal.current;
      setShown(goal.current);
    };
    document.addEventListener("visibilitychange", snap);
    return () => document.removeEventListener("visibilitychange", snap);
  }, []);

  return shown;
}

/** True while the matrix is anywhere near the viewport, so nothing animates unseen. */
function useOnScreen(ref: RefObject<HTMLDivElement | null>): boolean {
  const [onScreen, setOnScreen] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setOnScreen(entry.isIntersecting);
      },
      { rootMargin: "80px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  return onScreen;
}

const clock = (at: number) =>
  new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/* ---------- Words ---------- */

const RISK_LABEL: Record<PermissionRisk, string> = { low: "Low", medium: "Medium", high: "High" };
const RISK_LEVEL: Record<PermissionRisk, number> = { low: 1, medium: 2, high: 3 };
const DECISION_LABEL: Record<PermissionDecision, string> = {
  allow: "Allow",
  ask: "Ask",
  deny: "Deny",
};
const DECISION_ORDER: PermissionDecision[] = ["allow", "ask", "deny"];
const SCOPE_LABEL: Record<PermissionScope, string> = {
  once: "Once",
  session: "This session",
  always: "Always",
};
const SCOPE_ORDER: PermissionScope[] = ["once", "session", "always"];
const SCOPE_APPLIED: Record<PermissionScope, string> = {
  once: "once",
  session: "for this session",
  always: "always",
};
const SCOPE_HINT: Record<PermissionScope, string> = {
  once: "The next call asks again.",
  session: "Holds until this session ends.",
  always: "Holds for every future run of this agent.",
};

/* ---------- Marks ---------- */

function CheckGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.4 8.5 6.4 11.4 12.6 4.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PauseGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="5" y="3.6" width="2.1" height="8.8" rx="1" fill="currentColor" />
      <rect x="8.9" y="3.6" width="2.1" height="8.8" rx="1" fill="currentColor" />
    </svg>
  );
}

function DenyGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4.4 11.6 11.6 4.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function LockGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3.4" y="7" width="9.2" height="6.4" rx="1.8" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.6 7V5.6a2.4 2.4 0 0 1 4.8 0V7" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function CautionGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6.9 2.7 1.7 11.7a1.3 1.3 0 0 0 1.1 1.9h10.4a1.3 1.3 0 0 0 1.1-1.9L9.1 2.7a1.3 1.3 0 0 0-2.2 0Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M8 6.1v3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="11.3" r="0.85" fill="currentColor" />
    </svg>
  );
}

function SendGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.6 8h9.6M8.6 4.4 12.2 8l-3.6 3.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.8 13.3 3.8v4.4c0 2.9-2.2 5.1-5.3 6.2-3.1-1.1-5.3-3.3-5.3-6.2V3.8Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M6 7.9h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ToolGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.2" y="3.2" width="11.6" height="9.6" rx="2.4" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M5.4 6.6 7.2 8.4 5.4 10.2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8.6 10.2h2.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

const DECISION_GLYPH: Record<PermissionDecision, ReactNode> = {
  allow: <CheckGlyph />,
  ask: <PauseGlyph />,
  deny: <DenyGlyph />,
};

/** Three bars, one per risk step, so the level is a count and not only a colour. */
function RiskMeter({ level }: { level: number }) {
  return (
    <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1.3" y="8.2" width="2.6" height="4.4" rx="1" fill="currentColor" opacity={level >= 1 ? 1 : 0.3} />
      <rect x="5.7" y="5.4" width="2.6" height="7.2" rx="1" fill="currentColor" opacity={level >= 2 ? 1 : 0.3} />
      <rect x="10.1" y="2.4" width="2.6" height="10.2" rx="1" fill="currentColor" opacity={level >= 3 ? 1 : 0.3} />
    </svg>
  );
}

const css = /* css */ `
/* The component's knobs. A host that loads tokens.css gets the Ember palette from the document;
   without it these literals keep the matrix correct on its own. Override them on .ui-agpm. */
.ui-agpm {
  --ui-agpm-ink: var(--text, #f4ece4);
  --ui-agpm-muted: var(--text-muted, #a2958a);
  --ui-agpm-faint: var(--text-subtle, #f4ece48c);
  --ui-agpm-line: var(--border, #33291f);
  --ui-agpm-line-soft: var(--border-soft, #ffffff12);
  --ui-agpm-panel: var(--card, #201a15);
  --ui-agpm-sunk: var(--panel, #1a1512);
  --ui-agpm-raised: var(--preview, #26201a);
  --ui-agpm-track: var(--muted-bg, #ffffff0d);
  --ui-agpm-accent: var(--accent, #ff6b35);
  --ui-agpm-accent-hover: var(--accent-hover, #ff8256);
  --ui-agpm-accent-ink: var(--accent-fg, #1a0f08);
  --ui-agpm-allow: var(--success, #4f9d6e);
  --ui-agpm-ask: var(--warning, #d99530);
  --ui-agpm-deny: var(--danger, #e2544a);
  --ui-agpm-focus: var(--accent, #ff6b35);
  --ui-agpm-deny-wash: #e2544a1f;
  --ui-agpm-deny-hatch: #e2544a33;
  --ui-agpm-deny-line: #e2544a4d;
  --ui-agpm-shadow: 0 1px 2px #00000059, inset 0 -1px 0 #ffffff0a;
  --ui-agpm-pop: 0 2px 6px -2px #00000066;
  --ui-agpm-seat: 72px;
  --ui-agpm-scope-seat: 92px;
  /* Motion is the NamurUI scale, with the literal inline so a host that never loads motion.css
     still gets the same settling. */
  --ui-agpm-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-agpm-ease-both: var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1));
  --ui-agpm-spring: var(--nm-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  box-sizing: border-box;
  display: grid;
  gap: 14px;
  width: 100%;
  min-width: 0;
  padding: 14px;
  border-radius: var(--radius-panel, 20px);
  background: var(--ui-agpm-panel);
  box-shadow: inset 0 0 0 1px var(--ui-agpm-line-soft), var(--ui-agpm-shadow);
  font-family: var(--font-sans, "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  font-size: 13.5px;
  line-height: 1.45;
  color: var(--ui-agpm-ink);
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
  container-type: inline-size;
  container-name: ui-agpm;
}
.ui-agpm *, .ui-agpm *::before, .ui-agpm *::after { box-sizing: border-box; }
:where(.ui-agpm) button { margin: 0; border: 0; background: none; font: inherit; color: inherit; letter-spacing: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
:where(.ui-agpm) p { margin: 0; }
:where(.ui-agpm) svg { display: block; flex: none; }

.ui-agpm__sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }

/* ---------- Header ---------- */
.ui-agpm__bar { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px 18px; min-width: 0; }
.ui-agpm__titles { display: grid; flex: 1 1 auto; gap: 2px; min-width: 0; }
.ui-agpm__title { font-size: 14px; font-weight: 500; color: var(--ui-agpm-ink); }
.ui-agpm__subject { font-size: 12.5px; color: var(--ui-agpm-muted); }
.ui-agpm__subject b { font-weight: 500; color: var(--ui-agpm-ink); }
.ui-agpm__tally { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; margin-left: auto; font-size: 12px; font-variant-numeric: tabular-nums; color: var(--ui-agpm-muted); white-space: nowrap; }
.ui-agpm__count { display: inline-flex; align-items: center; gap: 5px; }
.ui-agpm__count svg { width: 13px; height: 13px; }
.ui-agpm__count b { font-size: 13px; font-weight: 600; color: var(--ui-agpm-ink); }
.ui-agpm__count[data-decision="allow"] svg { color: var(--ui-agpm-allow); }
.ui-agpm__count[data-decision="ask"] svg { color: var(--ui-agpm-ask); }
.ui-agpm__count[data-decision="deny"] svg { color: var(--ui-agpm-deny); }

/* ---------- Rows ---------- */
.ui-agpm__list { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.ui-agpm__row {
  position: relative;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto auto;
  align-items: center;
  column-gap: 12px;
  padding: 10px 12px 10px 10px;
  border-radius: var(--radius-preview, 12px);
  background-color: var(--ui-agpm-sunk);
  box-shadow: inset 0 0 0 1px var(--ui-agpm-line-soft);
  transition: background-color var(--nm-dur-2, 160ms) var(--ui-agpm-ease-out),
    box-shadow var(--nm-dur-2, 160ms) var(--ui-agpm-ease-out);
}
/* Everything that makes a denied row recede rides in here and fades as one: the hatch is a
   texture rather than a colour, so the state survives a monochrome screen. */
.ui-agpm__row::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  background-color: var(--ui-agpm-deny-wash);
  background-image: repeating-linear-gradient(135deg, transparent 0 5px, var(--ui-agpm-deny-hatch) 5px 6px);
  box-shadow: inset 0 0 0 1px var(--ui-agpm-deny-line);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--nm-dur-3, 240ms) var(--ui-agpm-ease-both);
}
.ui-agpm__row[data-decision="deny"]::before { opacity: 1; }
.ui-agpm__row > * { position: relative; z-index: 1; }
.ui-agpm__row[data-caution] { box-shadow: inset 0 0 0 1px var(--ui-agpm-line); }
.ui-agpm__mark { grid-column: 1; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: var(--ui-agpm-raised); box-shadow: inset 0 0 0 1px var(--ui-agpm-line-soft); color: var(--ui-agpm-muted); transition: color var(--nm-dur-3, 240ms) var(--ui-agpm-ease-both), background-color var(--nm-dur-3, 240ms) var(--ui-agpm-ease-both), box-shadow var(--nm-dur-3, 240ms) var(--ui-agpm-ease-both); }
.ui-agpm__mark svg { width: 15px; height: 15px; }
.ui-agpm__mark::after {
  content: "";
  position: absolute;
  top: 48%;
  left: 13%;
  width: 74%;
  height: 2px;
  border-radius: 2px;
  background: var(--ui-agpm-deny);
  transform: scaleX(0) rotate(-45deg);
  transform-origin: left center;
  transition: transform var(--nm-dur-3, 240ms) var(--ui-agpm-ease-both);
}
.ui-agpm__row[data-decision="deny"] .ui-agpm__mark { color: var(--ui-agpm-faint); background: var(--ui-agpm-deny-wash); box-shadow: inset 0 0 0 1px var(--ui-agpm-deny-line); }
.ui-agpm__row[data-decision="deny"] .ui-agpm__mark::after { transform: scaleX(1) rotate(-45deg); }

.ui-agpm__main { grid-column: 2; display: grid; gap: 2px; min-width: 0; }
.ui-agpm__head { display: flex; flex-wrap: wrap; align-items: center; gap: 3px 8px; min-width: 0; }
.ui-agpm__name { font-weight: 500; color: var(--ui-agpm-ink); transition: color var(--nm-dur-3, 240ms) var(--ui-agpm-ease-both); }
.ui-agpm__row[data-decision="deny"] .ui-agpm__name { color: var(--ui-agpm-muted); text-decoration: line-through; text-decoration-thickness: 1px; }
.ui-agpm__risk { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; line-height: 1; color: var(--ui-agpm-muted); white-space: nowrap; }
.ui-agpm__risk svg { width: 12px; height: 12px; }
.ui-agpm__risk[data-risk="high"] { font-weight: 500; color: var(--ui-agpm-ink); }
.ui-agpm__risk[data-risk="low"] svg { color: var(--ui-agpm-muted); }
.ui-agpm__risk[data-risk="medium"] svg { color: var(--ui-agpm-ask); }
.ui-agpm__risk[data-risk="high"] svg { color: var(--ui-agpm-deny); }
.ui-agpm__lock { display: inline-flex; align-items: center; gap: 5px; height: 18px; padding: 0 7px; border-radius: var(--radius-pill, 999px); background: var(--ui-agpm-line-soft); font-size: 11px; line-height: 1; color: var(--ui-agpm-muted); white-space: nowrap; }
.ui-agpm__lock svg { width: 11px; height: 11px; }
.ui-agpm__reason { font-size: 12.5px; color: var(--ui-agpm-muted); }
.ui-agpm__access { font-family: var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace); font-size: 11.5px; color: var(--ui-agpm-muted); }
/* Colour and opacity only: the detail dims and drops a hair as the ruling settles on deny. */
.ui-agpm__reason, .ui-agpm__access {
  transition: opacity var(--nm-dur-3, 240ms) var(--ui-agpm-ease-both),
    transform var(--nm-dur-3, 240ms) var(--ui-agpm-ease-both);
}
.ui-agpm__row[data-decision="deny"] .ui-agpm__reason,
.ui-agpm__row[data-decision="deny"] .ui-agpm__access { opacity: 0.9; transform: translateY(2px); }

.ui-agpm__flag { grid-column: 3; justify-self: end; display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 8px; border-radius: var(--radius-pill, 999px); background: var(--ui-agpm-line-soft); font-size: 11.5px; line-height: 1; color: var(--ui-agpm-muted); white-space: nowrap; }
.ui-agpm__flag svg { width: 12px; height: 12px; color: var(--ui-agpm-ask); }

/* ---------- The three seats ---------- */
.ui-agpm__control {
  grid-column: 4;
  justify-self: end;
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  width: calc(var(--ui-agpm-seat) * 3 + 8px);
  padding: 4px;
  overflow: clip;
  border-radius: var(--radius-pill, 999px);
  background-color: var(--ui-agpm-track);
  box-shadow: inset 0 0 0 1px var(--ui-agpm-line);
}
.ui-agpm__control[data-locked] { box-shadow: inset 0 0 0 1px var(--ui-agpm-line-soft); }
.ui-agpm__swell {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 4px;
  width: calc((100% - 8px) / 3);
  border-radius: calc(var(--radius-pill, 999px) - 4px);
  background-color: var(--ui-agpm-raised);
  box-shadow: inset 0 0 0 1px var(--ui-agpm-line), var(--ui-agpm-pop);
  pointer-events: none;
  transition: transform var(--nm-dur-3, 240ms) var(--ui-agpm-spring);
}
.ui-agpm__control[data-decision="ask"] .ui-agpm__swell { transform: translateX(100%); }
.ui-agpm__control[data-decision="deny"] .ui-agpm__swell { transform: translateX(200%); }
.ui-agpm__opt { position: relative; z-index: 1; display: inline-flex; align-items: center; justify-content: center; gap: 5px; height: 26px; padding: 0 8px; border-radius: calc(var(--radius-pill, 999px) - 4px); font-size: 12px; font-weight: 500; color: var(--ui-agpm-muted); white-space: nowrap; transition: color var(--nm-dur-2, 160ms) var(--ui-agpm-ease-out); }
.ui-agpm__opt svg { width: 13px; height: 13px; }
.ui-agpm__opt[aria-checked="true"] { color: var(--ui-agpm-ink); }
.ui-agpm__opt[aria-checked="true"][data-decision="allow"] svg { color: var(--ui-agpm-allow); }
.ui-agpm__opt[aria-checked="true"][data-decision="ask"] svg { color: var(--ui-agpm-ask); }
.ui-agpm__opt[aria-checked="true"][data-decision="deny"] svg { color: var(--ui-agpm-deny); }
.ui-agpm__opt:focus-visible { outline: 2px solid var(--ui-agpm-focus); outline-offset: 1px; }
.ui-agpm__control[data-locked] .ui-agpm__opt { cursor: default; }
@media (hover: hover) {
  .ui-agpm__control:not([data-locked]) .ui-agpm__opt:not([aria-checked="true"]):hover { color: var(--ui-agpm-ink); }
}

/* ---------- Nothing requested ---------- */
.ui-agpm__empty { display: grid; justify-items: center; gap: 6px; padding: 26px 16px; border-radius: var(--radius-preview, 12px); background-color: var(--ui-agpm-sunk); box-shadow: inset 0 0 0 1px var(--ui-agpm-line-soft); text-align: center; }
.ui-agpm__empty-mark { color: var(--ui-agpm-muted); }
.ui-agpm__empty-mark svg { width: 20px; height: 20px; }
.ui-agpm__empty-title { font-size: 13px; font-weight: 500; color: var(--ui-agpm-ink); }
.ui-agpm__empty-note { max-width: 40ch; font-size: 12.5px; color: var(--ui-agpm-muted); }

/* ---------- How long it holds, and the hand-off ---------- */
.ui-agpm__foot { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px 18px; }
.ui-agpm__scopewrap { display: grid; gap: 6px; min-width: 0; }
.ui-agpm__scope-label { font-size: 11.5px; font-weight: 500; color: var(--ui-agpm-muted); }
.ui-agpm__scopes {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  width: calc(var(--ui-agpm-scope-seat) * 3 + 8px);
  padding: 4px;
  overflow: clip;
  border-radius: var(--radius-pill, 999px);
  background-color: var(--ui-agpm-track);
  box-shadow: inset 0 0 0 1px var(--ui-agpm-line);
}
.ui-agpm__scope-swell {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 4px;
  width: calc((100% - 8px) / 3);
  border-radius: calc(var(--radius-pill, 999px) - 4px);
  background-color: var(--ui-agpm-raised);
  box-shadow: inset 0 0 0 1px var(--ui-agpm-line), var(--ui-agpm-pop);
  pointer-events: none;
  transition: transform var(--nm-dur-3, 240ms) var(--ui-agpm-spring);
}
.ui-agpm__scopes[data-scope="session"] .ui-agpm__scope-swell { transform: translateX(100%); }
.ui-agpm__scopes[data-scope="always"] .ui-agpm__scope-swell { transform: translateX(200%); }
.ui-agpm__scope { position: relative; z-index: 1; padding: 0 10px; height: 26px; border-radius: calc(var(--radius-pill, 999px) - 4px); font-size: 12px; font-weight: 500; color: var(--ui-agpm-muted); white-space: nowrap; transition: color var(--nm-dur-2, 160ms) var(--ui-agpm-ease-out); }
.ui-agpm__scope[aria-checked="true"] { color: var(--ui-agpm-ink); }
.ui-agpm__scope:focus-visible { outline: 2px solid var(--ui-agpm-focus); outline-offset: 1px; }
@media (hover: hover) {
  .ui-agpm__scope:not([aria-checked="true"]):hover { color: var(--ui-agpm-ink); }
}
.ui-agpm__hint { font-size: 11.5px; color: var(--ui-agpm-muted); }
.ui-agpm__submit { display: flex; align-items: center; gap: 10px; margin-left: auto; }
.ui-agpm__status { font-size: 11.5px; color: var(--ui-agpm-muted); }
.ui-agpm__apply { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 14px; border-radius: var(--radius-pill, 999px); background-color: var(--ui-agpm-accent); color: var(--ui-agpm-accent-ink); font-size: 12.5px; font-weight: 600; white-space: nowrap; transition: background-color var(--nm-dur-2, 160ms) var(--ui-agpm-ease-out), color var(--nm-dur-2, 160ms) var(--ui-agpm-ease-out), transform var(--nm-dur-1, 90ms) var(--ui-agpm-ease-out); }
.ui-agpm__apply svg { width: 14px; height: 14px; }
.ui-agpm__apply[data-resting] { background-color: var(--ui-agpm-track); color: var(--ui-agpm-muted); box-shadow: inset 0 0 0 1px var(--ui-agpm-line); cursor: default; }
@media (hover: hover) {
  .ui-agpm__apply:not([data-resting]):hover { background-color: var(--ui-agpm-accent-hover); }
}
.ui-agpm__apply:not([data-resting]):active { transform: scale(0.97); }
.ui-agpm__apply:focus-visible { outline: 2px solid var(--ui-agpm-focus); outline-offset: 2px; }

/* ---------- Narrow: the control takes its own line, full width ---------- */
@container ui-agpm (max-width: 620px) {
  .ui-agpm__tally { margin-left: 0; }
  .ui-agpm__row { grid-template-columns: 30px minmax(0, 1fr); row-gap: 10px; }
  .ui-agpm__flag { grid-column: 2; justify-self: start; }
  .ui-agpm__control { grid-column: 1 / -1; justify-self: stretch; width: 100%; }
  .ui-agpm__scopes { width: 100%; }
  .ui-agpm__submit { margin-left: 0; justify-content: space-between; width: 100%; }
}

/* Touch: the seats grow to a finger, and the tray holds a row of them. */
@media (hover: none) and (pointer: coarse) {
  .ui-agpm { --ui-agpm-seat: 84px; --ui-agpm-scope-seat: 96px; }
  .ui-agpm__opt, .ui-agpm__scope { height: 40px; }
}

@media (prefers-reduced-motion: reduce) {
  .ui-agpm *, .ui-agpm *::before, .ui-agpm *::after {
    animation: none !important;
    transition-duration: 1ms !important;
  }
  /* The seats change places without travelling, and the denied detail keeps its dimming but
     drops the 2px shift, which is the only part of it that moves. */
  .ui-agpm__opt, .ui-agpm__scope { transition-property: color; }
  .ui-agpm__row[data-decision="deny"] .ui-agpm__reason,
  .ui-agpm__row[data-decision="deny"] .ui-agpm__access { transform: none; }
}

/* Dark mode. The token-bearing knobs above already follow the host's own switch; these are the
   values the matrix owns, tuned against the dark surface. */
:where(.dark, [data-theme="dark"]) .ui-agpm {
  --ui-agpm-deny-wash: #e2544a26;
  --ui-agpm-deny-hatch: #e2544a3d;
  --ui-agpm-deny-line: #e2544a59;
  --ui-agpm-shadow: 0 1px 2px #00000073, inset 0 -1px 0 #ffffff0a;
  --ui-agpm-pop: 0 2px 6px -2px #00000073;
}
`;