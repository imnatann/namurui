"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

/*
 * Branch Explorer - the parallel attempts an agent made from one shared root.
 *
 * The root sits at the top of a spine and every branch draws its own elbow off it, so the shape of
 * the work is legible before any label is. One branch sits on the main track and is marked Adopted;
 * promoting another slides it onto that track while the old line steps off it. Each branch carries
 * its status as a glyph and a word, its spend, and what it produced, and any two can be put side by
 * side to see where their approaches and their costs part.
 */

export type BranchStatus = "running" | "complete" | "abandoned";

export type Branch = {
  /** Stable id, used for adoption and comparison */
  id: string;
  /** The approach this branch took, e.g. "Retry with backoff" */
  approach: string;
  /** What it produced, or why it stopped */
  outcome: string;
  /** Where it stands right now */
  status: BranchStatus;
  /** Spend so far, in whole currency units */
  cost: number;
};

export type BranchExplorerProps = {
  /** The shared starting point every branch grew from */
  root: string;
  /** The branches, in the order they left the root */
  branches: Branch[];
  /** Heading above the tree */
  title?: string;
  /** Controlled adopted branch id; leave it out and the component owns the choice */
  adopted?: string;
  /** An alternative was promoted to the adopted line */
  onPromote?: (branch: Branch) => void;
  /** Formats every cost, per branch, in the header total, and in the delta */
  formatCost?: (amount: number) => string;
  className?: string;
};

const STATUS_TEXT: Record<BranchStatus, string> = {
  running: "Running",
  complete: "Complete",
  abandoned: "Abandoned",
};

const STATUS_WORD: Record<BranchStatus, string> = {
  running: "still running",
  complete: "complete",
  abandoned: "abandoned",
};

type RowY = { id: string; y: number };

function sameRows(a: RowY[], b: RowY[]) {
  return (
    a.length === b.length &&
    a.every((row, index) => row.id === b[index]?.id && Math.abs(row.y - (b[index]?.y ?? 0)) < 0.5)
  );
}

function StatusMark({ status }: { status: BranchStatus }) {
  if (status === "running") {
    return (
      <svg className="ui-brxp__spin" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <circle
          cx="5"
          cy="5"
          r="3.6"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeDasharray="15 7"
        />
      </svg>
    );
  }
  if (status === "complete") {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path
          d="M1.6 5.2l2.3 2.3L8.5 2.6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ForkMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 14V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M8 9c0-2.2-1.5-3.2-3.3-3.2H3.6V3.4M8 9c0-2.2 1.5-3.2 3.3-3.2h1.1V3.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="3.6" cy="2.6" r="1.4" fill="currentColor" />
      <circle cx="12.4" cy="2.6" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function BranchExplorer({
  root,
  branches,
  title = "Branch explorer",
  adopted,
  onPromote,
  formatCost = (amount) => `$${amount.toFixed(2)}`,
  className,
}: BranchExplorerProps) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const railRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const [rows, setRows] = useState<RowY[]>([]);
  const [own, setOwn] = useState<string | null>(null);
  const [compared, setCompared] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  const fallback = branches.find((branch) => branch.status === "complete")?.id ?? branches[0]?.id ?? null;
  const wanted = adopted !== undefined ? adopted : (own ?? fallback);
  const adoptedId = branches.some((branch) => branch.id === wanted) ? wanted : fallback;
  const adoptedBranch = branches.find((branch) => branch.id === adoptedId) ?? null;
  const byId = new Map(branches.map((branch) => [branch.id, branch]));
  const total = branches.reduce((sum, branch) => sum + branch.cost, 0);

  const idKey = branches.map((branch) => branch.id).join("|");

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const measure = () => {
      const base = rail.getBoundingClientRect().top;
      const next: RowY[] = [];
      cardRefs.current.forEach((element, id) => {
        const rect = element.getBoundingClientRect();
        next.push({ id, y: rect.top - base + rect.height / 2 });
      });
      next.sort((a, b) => a.y - b.y);
      setRows((previous) => (sameRows(previous, next) ? previous : next));
    };

    measure();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    cardRefs.current.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [idKey]);

  const promote = (branch: Branch) => {
    if (adopted === undefined) setOwn(branch.id);
    setNotice(
      adoptedBranch && adoptedBranch.id !== branch.id
        ? `${branch.approach} is now the adopted line. ${adoptedBranch.approach} is an alternative.`
        : `${branch.approach} is the adopted line.`,
    );
    onPromote?.(branch);
  };

  const toggleCompare = (branch: Branch) => {
    const next = compared.includes(branch.id)
      ? compared.filter((id) => id !== branch.id)
      : [...compared, branch.id].slice(-2);
    setCompared(next);
    const [first, second] = next;
    const firstName = first ? (byId.get(first)?.approach ?? "the first branch") : "";
    const secondName = second ? (byId.get(second)?.approach ?? "the second branch") : "";
    setNotice(
      first && second
        ? `Comparing ${firstName} with ${secondName}.`
        : first
          ? `Select one more branch to compare with ${firstName}.`
          : "Comparison cleared.",
    );
  };

  const clearCompare = () => {
    setCompared([]);
    setNotice("Comparison cleared.");
  };

  const pair = compared
    .map((id) => byId.get(id))
    .filter((branch): branch is Branch => branch !== undefined);
  const [left, right] = pair;
  const compare = left && right ? { left, right } : null;

  let delta = "";
  if (compare) {
    const difference = Math.abs(compare.left.cost - compare.right.cost);
    const cheaper = compare.left.cost <= compare.right.cost ? compare.left : compare.right;
    const dearer = cheaper.id === compare.left.id ? compare.right : compare.left;
    const costLine =
      difference < 0.005
        ? `${compare.left.approach} and ${compare.right.approach} cost the same.`
        : `${dearer.approach} costs ${formatCost(difference)} more than ${cheaper.approach}.`;
    const statusLine =
      compare.left.status === compare.right.status
        ? ""
        : `${compare.left.approach} is ${STATUS_WORD[compare.left.status]} while ${compare.right.approach} is ${STATUS_WORD[compare.right.status]}.`;
    delta = statusLine ? `${costLine} ${statusLine}` : costLine;
  }

  const spineEnd = rows.reduce((max, row) => Math.max(max, row.y), 0);
  const adoptedRow = rows.find((row) => row.id === adoptedId);
  const flagY = adoptedRow ? adoptedRow.y - 11 : null;

  return (
    <section className={["ui-brxp", className].filter(Boolean).join(" ")} aria-labelledby={titleId}>
      {/* React 19 hoists this into <head> once, no matter how many trees render */}
      <style href="ui-branch-explorer" precedence="default">
        {css}
      </style>

      <header className="ui-brxp__bar">
        <span className="ui-brxp__mark">
          <ForkMark />
        </span>
        <h2 className="ui-brxp__title" id={titleId}>
          {title}
        </h2>
        <span className="ui-brxp__meta">
          {branches.length} {branches.length === 1 ? "branch" : "branches"} · {formatCost(total)} spent
        </span>
      </header>

      <div className="ui-brxp__root">
        <span className="ui-brxp__rootmark" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="2.5" y="2.5" width="13" height="13" rx="4.5" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="9" cy="9" r="2.6" fill="currentColor" />
          </svg>
        </span>
        <div className="ui-brxp__rootbody">
          <span className="ui-brxp__rootlabel">Common root</span>
          <p className="ui-brxp__roottask">{root}</p>
        </div>
      </div>

      {branches.length > 0 && (
        <svg className="ui-brxp__stem" width="46" height="24" viewBox="0 0 46 24" aria-hidden="true">
          <path className="ui-brxp__stemline" d="M23 0V24" pathLength={100} />
        </svg>
      )}

      <div className="ui-brxp__rail" ref={railRef}>
        <svg className="ui-brxp__wires" aria-hidden="true">
          {spineEnd > 0 && <path className="ui-brxp__spine" d={`M23 0V${spineEnd}`} pathLength={100} />}
          {rows.map((row, index) => {
            const branch = byId.get(row.id);
            if (!branch) return null;
            const start = Math.max(0, row.y - 26);
            return (
              <g key={row.id}>
                <path
                  className="ui-brxp__wire"
                  data-adopted={branch.id === adoptedId ? "" : undefined}
                  data-cut={branch.status === "abandoned" ? "" : undefined}
                  d={`M23 ${start} Q23 ${row.y} 34 ${row.y} H58`}
                  pathLength={100}
                  style={{ "--i": index } as CSSProperties}
                />
                {branch.status === "abandoned" ? (
                  <path
                    className="ui-brxp__cut"
                    d={`M49 ${row.y - 3.8} L56.6 ${row.y + 3.8} M56.6 ${row.y - 3.8} L49 ${row.y + 3.8}`}
                    style={{ "--i": index } as CSSProperties}
                  />
                ) : (
                  <circle
                    className="ui-brxp__node"
                    data-adopted={branch.id === adoptedId ? "" : undefined}
                    cx="53"
                    cy={row.y}
                    r="2.4"
                    style={{ "--i": index } as CSSProperties}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {flagY !== null && (
          <span className="ui-brxp__flag" aria-hidden="true" style={{ transform: `translateY(${flagY}px)` }}>
            <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
              <path
                d="M1.8 5.2l2.2 2.2L8.4 2.6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}

        <div className="ui-brxp__branches" role="list" aria-label="Branches">
          {branches.map((branch, index) => {
            const isAdopted = branch.id === adoptedId;
            const isCompared = compared.includes(branch.id);
            return (
              <article
                key={branch.id}
                role="listitem"
                className="ui-brxp__branch"
                data-status={branch.status}
                data-adopted={isAdopted ? "" : undefined}
                data-compared={isCompared ? "" : undefined}
                style={{ "--i": index } as CSSProperties}
                ref={(node) => {
                  if (node) cardRefs.current.set(branch.id, node);
                  else cardRefs.current.delete(branch.id);
                }}
              >
                <div className="ui-brxp__head">
                  <span className="ui-brxp__status" data-status={branch.status}>
                    <StatusMark status={branch.status} />
                    {STATUS_TEXT[branch.status]}
                  </span>
                  <span className="ui-brxp__cost">
                    <span className="ui-brxp__cost-label">cost</span>
                    <b>{formatCost(branch.cost)}</b>
                  </span>
                </div>

                <h3 className="ui-brxp__approach">{branch.approach}</h3>
                <p className="ui-brxp__outcome">{branch.outcome}</p>

                <div className="ui-brxp__foot">
                  {isAdopted ? (
                    <span className="ui-brxp__adopted">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <path
                          d="M1.8 5.2l2.2 2.2L8.4 2.6"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Adopted
                    </span>
                  ) : branch.status !== "abandoned" ? (
                    <button
                      type="button"
                      className="ui-brxp__promote"
                      onClick={() => promote(branch)}
                      aria-label={`Promote ${branch.approach} to the adopted line`}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path
                          d="M6 10.5V3.6M3.4 6.2L6 3.6l2.6 2.6M2.4 1.6h7.2"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Promote
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="ui-brxp__compare-toggle"
                    aria-pressed={isCompared}
                    aria-label={`Compare ${branch.approach}`}
                    onClick={() => toggleCompare(branch)}
                  >
                    {isCompared && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <path
                          d="M1.8 5.2l2.2 2.2L8.4 2.6"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                    Compare
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {branches.length === 0 && <p className="ui-brxp__empty">No branch has left this root yet.</p>}
      </div>

      {compare && (
        <section className="ui-brxp__compare" aria-label="Branch comparison">
          <div className="ui-brxp__compare-head">
            <span className="ui-brxp__compare-title">Side by side</span>
            <button type="button" className="ui-brxp__clear" onClick={clearCompare} aria-label="Clear comparison">
              Clear
            </button>
          </div>

          <div className="ui-brxp__compare-grid">
            <span className="ui-brxp__compare-label">Approach</span>
            <span className="ui-brxp__compare-name">{compare.left.approach}</span>
            <span className="ui-brxp__compare-name">{compare.right.approach}</span>

            <span className="ui-brxp__compare-label">Status</span>
            {[compare.left, compare.right].map((branch) => (
              <span key={branch.id} className="ui-brxp__status" data-status={branch.status}>
                <StatusMark status={branch.status} />
                {STATUS_TEXT[branch.status]}
              </span>
            ))}

            <span className="ui-brxp__compare-label">Cost</span>
            {[compare.left, compare.right].map((branch) => (
              <span key={branch.id} className="ui-brxp__compare-cost">
                <b>{formatCost(branch.cost)}</b>
                <span className="ui-brxp__cost-bar" aria-hidden="true">
                  <span
                    style={{
                      transform: `scaleX(${branch.cost / Math.max(compare.left.cost, compare.right.cost, 0.01)})`,
                    }}
                  />
                </span>
              </span>
            ))}

            <span className="ui-brxp__compare-label">Outcome</span>
            <span className="ui-brxp__compare-outcome">{compare.left.outcome}</span>
            <span className="ui-brxp__compare-outcome">{compare.right.outcome}</span>
          </div>

          <p className="ui-brxp__delta">{delta}</p>
        </section>
      )}

      <span className="ui-brxp__sr" role="status" aria-live="polite">
        {notice}
      </span>
    </section>
  );
}

const css = /* css */ `
/* Every colour and timing is a knob on the root: override them on .ui-brxp. */
.ui-brxp{
  --ui-brxp-bg: var(--bg, #faf7f4);
  --ui-brxp-panel: var(--panel, #fffdfb);
  --ui-brxp-card: var(--card, #ffffff);
  --ui-brxp-ink: var(--text, #1a1410);
  --ui-brxp-muted: var(--text-muted, #6f625a);
  --ui-brxp-line: var(--border, #e8e0d7);
  --ui-brxp-line-soft: var(--border-soft, #1a14101a);
  --ui-brxp-accent: var(--accent, #c2410c);
  --ui-brxp-accent-soft: var(--accent-soft, #c2410c1a);
  --ui-brxp-accent-fg: var(--accent-fg, #fffdfb);
  --ui-brxp-ok: var(--success, #1a7a4a);
  --ui-brxp-warn: var(--warning, #9a6410);
  --ui-brxp-shadow: var(--shadow-card, 0 1px 1.5px #3d1f0a0a, inset 0 -1px 0 #3d1f0a0f);
  --ui-brxp-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --ui-brxp-mono: var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace);
  --ui-brxp-radius: var(--radius-card, 16px);
  --ui-brxp-radius-sm: var(--radius-preview, 12px);
  --ui-brxp-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-brxp-ease-in: var(--nm-ease-in, cubic-bezier(0.55, 0, 0.68, 0.19));
  --ui-brxp-spring: var(--nm-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  --ui-brxp-dur-1: var(--nm-dur-1, 90ms);
  --ui-brxp-dur-2: var(--nm-dur-2, 160ms);
  --ui-brxp-dur-3: var(--nm-dur-3, 240ms);
  --ui-brxp-dur-4: var(--nm-dur-4, 380ms);
  --ui-brxp-dur-5: var(--nm-dur-5, 620ms);
  --ui-brxp-dur-6: var(--nm-dur-6, 1100ms);
  container: brxp / inline-size;
  color: var(--ui-brxp-ink);
  font-family: var(--ui-brxp-sans);
  font-size: 13px;
  line-height: 20px;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
}
.ui-brxp, .ui-brxp *, .ui-brxp *::before, .ui-brxp *::after{box-sizing: border-box}
:where(.ui-brxp) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;text-align: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-brxp button:focus-visible{outline: 2px solid var(--ui-brxp-accent);outline-offset: 2px}
.ui-brxp svg{display: block;flex: none}
.ui-brxp h2, .ui-brxp h3, .ui-brxp p{margin: 0}

/* Header */
.ui-brxp__bar{display: flex;flex-wrap: wrap;align-items: center;gap: 4px 8px;margin-bottom: 14px}
.ui-brxp__mark{display: grid;place-items: center;width: 16px;color: var(--ui-brxp-muted)}
.ui-brxp__title{font-size: 14px;font-weight: 500;line-height: 20px;color: var(--ui-brxp-ink)}
.ui-brxp__meta{margin-left: auto;font-size: 12px;line-height: 18px;color: var(--ui-brxp-muted);font-variant-numeric: tabular-nums;white-space: nowrap}

/* Root */
.ui-brxp__root{display: grid;grid-template-columns: 46px minmax(0, 1fr);align-items: center;gap: 0 12px;padding: 11px 14px 11px 0;border-radius: var(--ui-brxp-radius);background: var(--ui-brxp-panel);box-shadow: inset 0 0 0 1px var(--ui-brxp-line-soft), var(--ui-brxp-shadow)}
.ui-brxp__rootmark{display: grid;place-items: center;align-self: stretch;color: var(--ui-brxp-muted)}
.ui-brxp__rootbody{display: grid;gap: 1px;min-width: 0}
.ui-brxp__rootlabel{font-size: 11px;line-height: 16px;color: var(--ui-brxp-muted)}
.ui-brxp__roottask{font-size: 14px;font-weight: 500;line-height: 20px;color: var(--ui-brxp-ink);overflow-wrap: anywhere}
.ui-brxp__stem{display: block;width: 46px;height: 24px;color: var(--ui-brxp-line)}
.ui-brxp__stemline{fill: none;stroke: currentColor;stroke-width: 1.5;stroke-linecap: round}

/* The tree */
.ui-brxp__rail{position: relative;padding: 0 12px 0 58px}
.ui-brxp__branches{display: grid;gap: 10px}
.ui-brxp__wires{position: absolute;inset: 0;width: 100%;height: 100%;overflow: visible;pointer-events: none}
.ui-brxp__spine, .ui-brxp__wire{fill: none;stroke: var(--ui-brxp-line);stroke-width: 1.5;stroke-linecap: round;transition: stroke var(--ui-brxp-dur-3) var(--ui-brxp-ease-out)}
.ui-brxp__spine, .ui-brxp__wire{stroke-dasharray: 100;stroke-dashoffset: 100;animation: ui-brxp-draw var(--ui-brxp-dur-5) var(--ui-brxp-ease-out) forwards}
.ui-brxp__stemline{stroke-dasharray: 100;stroke-dashoffset: 100;animation: ui-brxp-draw var(--ui-brxp-dur-5) var(--ui-brxp-ease-out) forwards}
.ui-brxp__wire{animation-delay: calc(var(--i, 0) * var(--nm-stagger, 45ms) + var(--ui-brxp-dur-1))}
.ui-brxp__wire[data-adopted]{stroke: var(--ui-brxp-accent)}
.ui-brxp__wire[data-cut]{stroke: var(--ui-brxp-muted)}
.ui-brxp__node{fill: var(--ui-brxp-line);opacity: 0;animation: ui-brxp-fade var(--ui-brxp-dur-3) var(--ui-brxp-ease-out) forwards;animation-delay: calc(var(--i, 0) * var(--nm-stagger, 45ms) + var(--ui-brxp-dur-5))}
.ui-brxp__node[data-adopted]{fill: var(--ui-brxp-accent)}
.ui-brxp__cut{fill: none;stroke: var(--ui-brxp-muted);stroke-width: 1.6;stroke-linecap: round;opacity: 0;animation: ui-brxp-fade var(--ui-brxp-dur-3) var(--ui-brxp-ease-out) forwards;animation-delay: calc(var(--i, 0) * var(--nm-stagger, 45ms) + var(--ui-brxp-dur-5))}

/* The adopted marker rides the spine */
.ui-brxp__flag{position: absolute;top: 0;left: 12px;z-index: 2;display: grid;place-items: center;width: 22px;height: 22px;border-radius: 50%;background: var(--ui-brxp-accent);color: var(--ui-brxp-accent-fg);box-shadow: 0 1px 3px #00000026;transition: transform var(--ui-brxp-dur-4) var(--ui-brxp-spring);animation: ui-brxp-fade var(--ui-brxp-dur-3) var(--ui-brxp-ease-out) both}

/* A branch */
.ui-brxp__branch{position: relative;display: grid;gap: 5px;padding: 12px 14px 12px 16px;border-radius: var(--ui-brxp-radius-sm);background: var(--ui-brxp-panel);box-shadow: inset 0 0 0 1px var(--ui-brxp-line-soft), var(--ui-brxp-shadow);transform: translateX(12px);transition: transform var(--ui-brxp-dur-4) var(--ui-brxp-ease-in), background-color var(--ui-brxp-dur-3) var(--ui-brxp-ease-out), box-shadow var(--ui-brxp-dur-3) var(--ui-brxp-ease-out);animation: ui-brxp-card var(--ui-brxp-dur-3) var(--ui-brxp-ease-out) both;animation-delay: calc(var(--i, 0) * var(--nm-stagger, 45ms) + var(--ui-brxp-dur-4))}
.ui-brxp__branch::before{content: "";position: absolute;top: 9px;bottom: 9px;left: 0;width: 3px;border-radius: 0 3px 3px 0;background: var(--ui-brxp-accent);opacity: 0;transform: scaleY(0.4);transform-origin: 50% 0;transition: opacity var(--ui-brxp-dur-3) var(--ui-brxp-ease-out), transform var(--ui-brxp-dur-4) var(--ui-brxp-ease-out)}
.ui-brxp__branch[data-status="abandoned"]{background: var(--ui-brxp-panel);box-shadow: inset 0 0 0 1px var(--ui-brxp-line)}
.ui-brxp__branch[data-status="abandoned"]::after{content: "";position: absolute;inset: -1px;border: 1px dashed var(--ui-brxp-line);border-radius: var(--ui-brxp-radius-sm);pointer-events: none}
.ui-brxp__branch[data-compared]{outline: 1px solid var(--ui-brxp-line);outline-offset: 2px}
.ui-brxp__branch[data-adopted]{transform: translateX(0);background: var(--ui-brxp-card);box-shadow: inset 0 0 0 1px var(--ui-brxp-accent), var(--ui-brxp-shadow);transition: transform var(--ui-brxp-dur-4) var(--ui-brxp-ease-out), background-color var(--ui-brxp-dur-3) var(--ui-brxp-ease-out), box-shadow var(--ui-brxp-dur-3) var(--ui-brxp-ease-out)}
.ui-brxp__branch[data-adopted]::before{opacity: 1;transform: scaleY(1)}

.ui-brxp__head{display: flex;align-items: center;gap: 8px;min-width: 0}
.ui-brxp__status{display: inline-flex;align-items: center;gap: 5px;height: 22px;padding: 0 8px 0 7px;border-radius: 999px;box-shadow: inset 0 0 0 1px var(--ui-brxp-line-soft);font-size: 11px;font-weight: 500;line-height: 22px;letter-spacing: 0;white-space: nowrap;color: var(--ui-brxp-muted)}
.ui-brxp__status[data-status="running"]{color: var(--ui-brxp-warn)}
.ui-brxp__status[data-status="complete"]{color: var(--ui-brxp-ok)}
.ui-brxp__spin{transform-origin: center;transform-box: fill-box;animation: ui-brxp-turn var(--ui-brxp-dur-6) linear infinite}
.ui-brxp__cost{display: inline-flex;align-items: baseline;gap: 5px;margin-left: auto;font-family: var(--ui-brxp-mono);font-size: 12px;line-height: 18px;letter-spacing: 0;color: var(--ui-brxp-muted);font-variant-numeric: tabular-nums;white-space: nowrap}
.ui-brxp__cost-label{font-size: 11px}
.ui-brxp__cost b{font-weight: 500;color: var(--ui-brxp-ink)}
.ui-brxp__approach{font-size: 14px;font-weight: 500;line-height: 20px;color: var(--ui-brxp-ink);overflow-wrap: anywhere}
.ui-brxp__outcome{font-size: 12px;line-height: 18px;color: var(--ui-brxp-muted);overflow-wrap: anywhere}

.ui-brxp__foot{display: flex;flex-wrap: wrap;align-items: center;gap: 8px;margin-top: 3px}
.ui-brxp__adopted{display: inline-flex;align-items: center;gap: 5px;height: 24px;padding: 0 8px;border-radius: 7px;background: var(--ui-brxp-accent);color: var(--ui-brxp-accent-fg);font-size: 11px;font-weight: 600;line-height: 24px;animation: ui-brxp-pop var(--ui-brxp-dur-4) var(--ui-brxp-spring) both}
.ui-brxp__promote{display: inline-flex;align-items: center;gap: 5px;height: 26px;padding: 0 9px 0 7px;border-radius: 8px;background: var(--ui-brxp-panel);box-shadow: inset 0 0 0 1px var(--ui-brxp-line);font-size: 12px;font-weight: 500;line-height: 24px;color: var(--ui-brxp-ink);transition: background-color var(--ui-brxp-dur-2) var(--ui-brxp-ease-out), color var(--ui-brxp-dur-2) var(--ui-brxp-ease-out), box-shadow var(--ui-brxp-dur-2) var(--ui-brxp-ease-out)}
.ui-brxp__promote:hover{background: var(--ui-brxp-accent-soft);box-shadow: inset 0 0 0 1px var(--ui-brxp-accent)}
.ui-brxp__compare-toggle{display: inline-flex;align-items: center;gap: 5px;height: 26px;padding: 0 9px 0 7px;margin-left: auto;border-radius: 8px;font-size: 12px;font-weight: 500;line-height: 24px;color: var(--ui-brxp-muted);box-shadow: inset 0 0 0 1px var(--ui-brxp-line-soft);transition: background-color var(--ui-brxp-dur-2) var(--ui-brxp-ease-out), color var(--ui-brxp-dur-2) var(--ui-brxp-ease-out), box-shadow var(--ui-brxp-dur-2) var(--ui-brxp-ease-out)}
.ui-brxp__compare-toggle:hover{color: var(--ui-brxp-ink);box-shadow: inset 0 0 0 1px var(--ui-brxp-line)}
.ui-brxp__compare-toggle[aria-pressed="true"]{background: var(--ui-brxp-ink);color: var(--ui-brxp-bg);box-shadow: none}
.ui-brxp__empty{margin-top: 10px;font-size: 12px;line-height: 18px;color: var(--ui-brxp-muted)}

/* Side by side */
.ui-brxp__compare{margin-top: 12px;padding: 12px 14px;border-radius: var(--ui-brxp-radius);background: var(--ui-brxp-panel);box-shadow: inset 0 0 0 1px var(--ui-brxp-line), var(--ui-brxp-shadow);animation: ui-brxp-rise var(--ui-brxp-dur-4) var(--ui-brxp-ease-out) both}
.ui-brxp__compare-head{display: flex;align-items: center;justify-content: space-between;gap: 12px;margin-bottom: 10px}
.ui-brxp__compare-title{font-size: 12px;font-weight: 500;line-height: 18px;color: var(--ui-brxp-ink)}
.ui-brxp__clear{height: 22px;padding: 0 6px;border-radius: 6px;font-size: 11px;font-weight: 500;line-height: 22px;color: var(--ui-brxp-muted);transition: background-color var(--ui-brxp-dur-2) var(--ui-brxp-ease-out), color var(--ui-brxp-dur-2) var(--ui-brxp-ease-out)}
.ui-brxp__clear:hover{background: var(--ui-brxp-line-soft);color: var(--ui-brxp-ink)}
.ui-brxp__compare-grid{display: grid;grid-template-columns: 54px minmax(0, 1fr) minmax(0, 1fr);gap: 8px 12px;align-items: start}
.ui-brxp__compare-label{padding-top: 2px;font-size: 11px;line-height: 18px;color: var(--ui-brxp-muted)}
.ui-brxp__compare-name{font-size: 12px;font-weight: 500;line-height: 18px;color: var(--ui-brxp-ink);overflow-wrap: anywhere}
.ui-brxp__compare-grid .ui-brxp__status{justify-self: start}
.ui-brxp__compare-cost{display: grid;gap: 5px;min-width: 0}
.ui-brxp__compare-cost b{font-family: var(--ui-brxp-mono);font-size: 12px;font-weight: 500;line-height: 18px;letter-spacing: 0;color: var(--ui-brxp-ink);font-variant-numeric: tabular-nums}
.ui-brxp__cost-bar{display: block;height: 4px;border-radius: 2px;background: var(--ui-brxp-line-soft);overflow: hidden}
.ui-brxp__cost-bar > span{display: block;height: 100%;border-radius: 2px;background: var(--ui-brxp-muted);transform-origin: left center;transition: transform var(--ui-brxp-dur-4) var(--ui-brxp-ease-out)}
.ui-brxp__compare-outcome{font-size: 12px;line-height: 18px;color: var(--ui-brxp-muted);overflow-wrap: anywhere}
.ui-brxp__delta{margin-top: 10px;font-size: 12px;line-height: 18px;color: var(--ui-brxp-ink)}

.ui-brxp__sr{position: absolute;width: 1px;height: 1px;margin: -1px;padding: 0;overflow: hidden;clip-path: inset(50%);white-space: nowrap;border: 0}

@container brxp (max-width: 420px){
  .ui-brxp__meta{flex-basis: 100%;margin-left: 24px}
  .ui-brxp__compare-grid{grid-template-columns: 42px minmax(0, 1fr) minmax(0, 1fr);gap: 8px 10px}
}

@keyframes ui-brxp-draw{to{stroke-dashoffset: 0}}
@keyframes ui-brxp-fade{from{opacity: 0}to{opacity: 1}}
@keyframes ui-brxp-card{from{opacity: 0}}
@keyframes ui-brxp-turn{to{transform: rotate(360deg)}}
@keyframes ui-brxp-rise{from{opacity: 0;transform: translateY(5px)}}
@keyframes ui-brxp-pop{0%{opacity: 0;transform: scale(0.86)}60%{opacity: 1;transform: scale(1.04)}100%{transform: scale(1)}}

@media (prefers-reduced-motion: reduce){
  .ui-brxp{--ui-brxp-dur-1: 1ms;--ui-brxp-dur-2: 1ms;--ui-brxp-dur-3: 1ms;--ui-brxp-dur-4: 1ms;--ui-brxp-dur-5: 1ms;--ui-brxp-dur-6: 1ms}
  .ui-brxp, .ui-brxp *, .ui-brxp *::before, .ui-brxp *::after{animation: none;transition-duration: 1ms}
  .ui-brxp__stemline, .ui-brxp__spine, .ui-brxp__wire{stroke-dashoffset: 0}
  .ui-brxp__node, .ui-brxp__cut{opacity: 1}
}

:where(.dark, [data-theme="dark"]) .ui-brxp{
  --ui-brxp-bg: #14100d;
  --ui-brxp-panel: #1a1512;
  --ui-brxp-card: #201a15;
  --ui-brxp-ink: #f4ece4;
  --ui-brxp-muted: #a2958a;
  --ui-brxp-line: #33291f;
  --ui-brxp-line-soft: #ffffff12;
  --ui-brxp-accent: #ff6b35;
  --ui-brxp-accent-soft: #ff6b3524;
  --ui-brxp-accent-fg: #1a0f08;
  --ui-brxp-ok: #4f9d6e;
  --ui-brxp-warn: #d99530;
  --ui-brxp-shadow: var(--shadow-card, 0 1px 1.5px #0000004d, inset 0 -1px 0 #ffffff0a);
}
`;
