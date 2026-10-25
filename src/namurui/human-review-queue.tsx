"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";

/*
 * Human Review Queue: the requests an agent will not decide alone, worked one at a time.
 * The card in front carries the proposal, the reason and the evidence it offers, all of it open;
 * the bar files Approve, Reject or Edit then approve, and the same keys do the same work on the
 * keyboard until the edit field has focus, where typing takes the keys back. A decision slides
 * the card off in the direction of the verdict while the next one rises in behind it, the rail
 * marker slides to the new position instead of jumping, and an emptied queue hands over to a
 * tally that arrives with a spring. Styles are injected below, so no extra files are needed.
 */

/** One piece of evidence behind a request. Shown open, never behind a disclosure. */
export type ReviewEvidence = {
  /** Where it came from, e.g. "Support thread, 09:12" */
  source: string;
  /** The line the agent took from it */
  quote: string;
};

/** One request waiting for a person. */
export type ReviewItem = {
  /** Stable id, used as the key and handed back with the decision */
  id: string;
  /** What the agent wants to do, one line, in the agent's own words */
  action: string;
  /** Why it wants to */
  rationale: string;
  /** The evidence it offers. Render them all: this is a decision surface */
  evidence: readonly ReviewEvidence[];
  /** Where the request came from, e.g. "Plan step 3" */
  from?: string;
  /** What the action lands on, e.g. "Order 4471" */
  subject?: string;
  /** The agent's own proposal, pre-filled into the edit field */
  proposal?: string;
  /** What changes if the request is approved */
  impact?: string;
  /** The agent's stated confidence, 0 to 1 */
  confidence?: number;
};

/** How a request left the queue. */
export type ReviewKind = "approve" | "reject" | "edit";

export type ReviewDecision = {
  /** The request that was decided */
  id: string;
  kind: ReviewKind;
  /** The wording that replaced the agent's proposal, on an edit only */
  value?: string;
  /** When it was filed, epoch ms */
  at: number;
};

export type HumanReviewQueueProps = {
  /** The requests waiting for a person, in the order they should be worked */
  items: readonly ReviewItem[];
  /** Heading in the bar */
  title?: string;
  /** Who queued them, shown next to the title */
  agent?: string;
  /** One request filed, with the verdict and the edited wording if there was one */
  onDecide?: (decision: ReviewDecision) => void;
  /** The queue was reopened after coming up empty */
  onReopen?: () => void;
  /** Extra class on the root */
  className?: string;
};

/** What the queue is doing right now. Drives the root's `data-state`. */
type QueuePhase = "empty" | "reviewing" | "editing" | "decided";

const KIND_LABEL: Record<ReviewKind, string> = {
  approve: "Approved",
  reject: "Rejected",
  edit: "Approved as edited",
};

export function HumanReviewQueue({
  items,
  title = "Human review",
  agent,
  onDecide,
  onReopen,
  className,
}: HumanReviewQueueProps) {
  const baseId = useId();
  const labelId = `${baseId}-title`;
  const fieldId = `${baseId}-field`;
  const hintId = `${baseId}-hint`;

  const [decisions, setDecisions] = useState<readonly ReviewDecision[]>([]);
  const [cursorId, setCursorId] = useState<string | null>(() => items[0]?.id ?? null);
  const [mode, setMode] = useState<"review" | "edit">("review");
  const [draft, setDraft] = useState("");
  /* The card that is sliding off, and where it is going. Cleared by the timer in the effect. */
  const [exit, setExit] = useState<{ id: string; kind: ReviewKind } | null>(null);
  /* Where the live marker sits on the rail, in px, measured rather than derived from the index. */
  const [mark, setMark] = useState<{ x: number; w: number } | null>(null);
  const [reduced, setReduced] = useState(false);

  const rootRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  const decidedIds = new Set(decisions.map((decision) => decision.id));
  const remaining = items.filter((item) => !decidedIds.has(item.id));
  const current = remaining.find((item) => item.id === cursorId) ?? remaining[0] ?? null;
  const byId = new Map(items.map((item) => [item.id, item]));
  const last = decisions[decisions.length - 1];
  const position = current ? items.findIndex((item) => item.id === current.id) + 1 : items.length;
  const phase: QueuePhase =
    items.length === 0 ? "empty" : current === null ? "decided" : mode === "edit" ? "editing" : "reviewing";
  const exitItem = exit ? byId.get(exit.id) ?? null : null;

  const tally = { approve: 0, reject: 0, edit: 0 };
  const kindById: Record<string, ReviewKind> = {};
  for (const decision of decisions) {
    tally[decision.kind] += 1;
    kindById[decision.id] = decision.kind;
  }

  /* The next request still waiting, walking forward from the one just decided and wrapping. */
  const advance = (from: string, taken: Set<string>): string | null => {
    const start = items.findIndex((item) => item.id === from);
    if (start < 0) return null;
    for (let step = 1; step <= items.length; step += 1) {
      const candidate = items[(start + step) % items.length];
      if (candidate && !taken.has(candidate.id)) return candidate.id;
    }
    return null;
  };

  const decide = (kind: ReviewKind, value?: string) => {
    if (!current) return;
    const taken = new Set(decidedIds);
    taken.add(current.id);
    const next = advance(current.id, taken);
    const decision: ReviewDecision = { id: current.id, kind, value, at: Date.now() };

    setDecisions((previous) => [...previous, decision]);
    setCursorId(next);
    setMode("review");
    setDraft("");
    /* A card slides off only when another is coming up behind it. The last decision hands the
       frame straight to the summary, which has its own entrance. */
    if (!reduced && next !== null) setExit({ id: current.id, kind });
    onDecide?.(decision);
  };

  const move = (step: number) => {
    if (!current || remaining.length < 2) return;
    const index = remaining.findIndex((item) => item.id === current.id);
    const next = remaining[(index + step + remaining.length) % remaining.length];
    if (next) setCursorId(next.id);
  };

  const startEdit = () => {
    if (!current) return;
    /* Pressed again while the field is already open: keep the wording, just return the caret. */
    if (mode === "edit") {
      fieldRef.current?.focus();
      return;
    }
    setDraft(current.proposal ?? current.action);
    setMode("edit");
  };

  const cancelEdit = () => {
    setMode("review");
    setDraft("");
  };

  const reopen = () => {
    setDecisions([]);
    setCursorId(items[0]?.id ?? null);
    setMode("review");
    setDraft("");
    setExit(null);
    onReopen?.();
  };

  /* The keys are read through a ref, so the listener is bound once and never churns. */
  const keyRef = useRef<(event: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    keyRef.current = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      const typing =
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLInputElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (event.key === "Escape") {
        if (mode === "edit") {
          event.preventDefault();
          cancelEdit();
        }
        return;
      }
      /* The field owns the keyboard while it is open: a, r, e and the arrows are just letters
         and caret moves there. */
      if (typing || mode === "edit" || !current) return;

      const active = document.activeElement;
      /* Another queue owns the keys while focus sits inside it; anything else, including a plain
         button elsewhere on the page, leaves them to this one. */
      const owner = active instanceof Element ? active.closest(".ui-hrq") : null;
      if (owner && owner !== rootRef.current) return;

      const key = event.key.toLowerCase();
      if (key === "a") {
        event.preventDefault();
        decide("approve");
      } else if (key === "r") {
        event.preventDefault();
        decide("reject");
      } else if (key === "e") {
        event.preventDefault();
        startEdit();
      } else if (key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        move(1);
      } else if (key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        move(-1);
      }
    };
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => keyRef.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  /* The slide-out is a transition; this timer is the commit that takes the old card out of the
     tree. It reads the same token the stylesheet animates on, so the two cannot drift. */
  useEffect(() => {
    if (!exit) return;
    const hold = readDuration("--nm-dur-3", 240) + 120;
    const timer = window.setTimeout(() => setExit(null), hold);
    return () => window.clearTimeout(timer);
  }, [exit]);

  useEffect(() => {
    const initial = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(initial.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    initial.addEventListener("change", onChange);
    return () => initial.removeEventListener("change", onChange);
  }, []);

  /* The field takes focus the moment it opens, caret at the end of the agent's proposal. */
  useEffect(() => {
    if (mode !== "edit") return;
    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, [mode, current?.id]);

  /* Width is measured, not assumed: the marker is positioned from the live tick's own box, so it
     lands on the right tick at any width and re-measures when the rail is resized. */
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const index = current ? items.findIndex((item) => item.id === current.id) : -1;
      const tick = index >= 0 ? rail.children[index] : undefined;
      if (!(tick instanceof HTMLElement)) {
        setMark(null);
        return;
      }
      const railBox = rail.getBoundingClientRect();
      const tickBox = tick.getBoundingClientRect();
      setMark({ x: tickBox.left - railBox.left, w: tickBox.width });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [items, current?.id, decisions]);

  const editedValue = last?.kind === "edit" ? last.value : undefined;
  const edited = editedValue !== undefined && editedValue !== (last ? byId.get(last.id)?.proposal ?? "" : "");
  const draftIsProposal = Boolean(current) && draft.trim() === (current?.proposal ?? current?.action ?? "").trim();

  const spoken =
    phase === "empty"
      ? "Nothing is waiting for review."
      : [
          last ? `${KIND_LABEL[last.kind]}: ${byId.get(last.id)?.action ?? ""}.` : "",
          current
            ? `Item ${position} of ${items.length}, ${remaining.length} still waiting.`
            : `Queue clear, ${decisions.length} decided.`,
        ]
          .filter(Boolean)
          .join(" ");

  return (
    <section
      ref={rootRef}
      className={["ui-hrq", className].filter(Boolean).join(" ")}
      data-state={phase}
      aria-labelledby={labelId}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-human-review-queue" precedence="default">
        {css}
      </style>

      <p className="ui-hrq__sr" role="status" aria-live="polite">
        {spoken}
      </p>

      <header className="ui-hrq__head">
        <span className="ui-hrq__mark" aria-hidden="true">
          <QueueGlyph />
        </span>
        <span className="ui-hrq__title" id={labelId}>
          {title}
        </span>
        {agent ? (
          <span className="ui-hrq__agent">
            queued by <b>{agent}</b>
          </span>
        ) : null}
        <span className="ui-hrq__chip">
          {phase === "empty"
            ? "nothing queued"
            : phase === "decided"
              ? "all clear"
              : `${remaining.length} waiting`}
        </span>
      </header>

      {items.length > 0 ? (
        <div className="ui-hrq__progress">
          <div className="ui-hrq__row">
            <p className="ui-hrq__position">
              {current ? (
                <>
                  Item <b>{position}</b> of <b>{items.length}</b>
                </>
              ) : (
                <>
                  All <b>{items.length}</b> decided
                </>
              )}
            </p>
            <p className="ui-hrq__counts">
              <span className="ui-hrq__count" data-kind="approve" data-zero={tally.approve === 0 ? "true" : undefined}>
                <span className="ui-hrq__countGlyph" aria-hidden="true">
                  <CheckGlyph />
                </span>
                <b>{tally.approve}</b> approved
              </span>
              <span className="ui-hrq__count" data-kind="reject" data-zero={tally.reject === 0 ? "true" : undefined}>
                <span className="ui-hrq__countGlyph" aria-hidden="true">
                  <CrossGlyph />
                </span>
                <b>{tally.reject}</b> rejected
              </span>
              <span className="ui-hrq__count" data-kind="edit" data-zero={tally.edit === 0 ? "true" : undefined}>
                <span className="ui-hrq__countGlyph" aria-hidden="true">
                  <PencilGlyph />
                </span>
                <b>{tally.edit}</b> edited
              </span>
            </p>
          </div>

          <div className="ui-hrq__rail" ref={railRef} aria-hidden="true">
            {items.map((item) => (
              <span className="ui-hrq__tick" key={item.id} data-kind={kindById[item.id]} />
            ))}
            {current && mark ? (
              <span
                className="ui-hrq__marker"
                style={
                  { "--ui-hrq-x": `${mark.x}px`, "--ui-hrq-w": `${mark.w}px` } as CSSProperties
                }
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {phase === "empty" ? (
        <div className="ui-hrq__empty">
          <span className="ui-hrq__emptyArt" aria-hidden="true">
            <TrayGlyph />
          </span>
          <p className="ui-hrq__emptyTitle">Nothing is waiting for review</p>
          <p className="ui-hrq__emptyText">
            When an agent wants to do something it should not decide on its own, the request lands here
            with its evidence attached.
          </p>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="ui-hrq__stage">
          {exitItem ? (
            <div className="ui-hrq__ghost" data-kind={exit?.kind} aria-hidden="true">
              <ItemSheet item={exitItem} />
            </div>
          ) : null}

          {current ? (
            <ItemSheet item={current} live>
              {mode === "edit" ? (
                <div className="ui-hrq__edit">
                  <label className="ui-hrq__editLabel" htmlFor={fieldId}>
                    Your wording replaces the agent's
                  </label>
                  <textarea
                    id={fieldId}
                    ref={fieldRef}
                    className="ui-hrq__field"
                    value={draft}
                    rows={2}
                    spellCheck={false}
                    aria-describedby={hintId}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  <p className="ui-hrq__hint" id={hintId}>
                    {draft.trim() === ""
                      ? "Empty wording cannot be filed. Write the instruction, or cancel."
                      : draftIsProposal
                        ? "Unchanged from the proposal: this still files as an edit."
                        : "Filed as an edit, with the change recorded against the agent's proposal."}
                  </p>
                  <div className="ui-hrq__editActions">
                    <button
                      type="button"
                      className="ui-hrq__btn"
                      data-kind="approve"
                      disabled={draft.trim() === ""}
                      onClick={() => decide("edit", draft.trim())}
                    >
                      <CheckGlyph />
                      Approve as edited
                    </button>
                    <button type="button" className="ui-hrq__btn" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </ItemSheet>
          ) : null}
        </div>
      ) : null}

      {current ? (
        <div className="ui-hrq__bar">
          <button type="button" className="ui-hrq__btn" data-kind="approve" onClick={() => decide("approve")}>
            <CheckGlyph />
            Approve
            <kbd className="ui-hrq__btnKey">a</kbd>
          </button>
          <button type="button" className="ui-hrq__btn" data-kind="reject" onClick={() => decide("reject")}>
            <CrossGlyph />
            Reject
            <kbd className="ui-hrq__btnKey">r</kbd>
          </button>
          <button
            type="button"
            className="ui-hrq__btn"
            data-kind="edit"
            aria-expanded={mode === "edit"}
            aria-controls={mode === "edit" ? fieldId : undefined}
            onClick={startEdit}
          >
            <PencilGlyph />
            Edit then approve
            <kbd className="ui-hrq__btnKey">e</kbd>
          </button>
        </div>
      ) : null}

      {items.length > 0 ? (
        <p className="ui-hrq__keys" data-paused={mode === "edit" ? "true" : undefined}>
          <span className="ui-hrq__keysLabel">Keys</span>
          <span className="ui-hrq__key">
            <kbd>a</kbd> approve
          </span>
          <span className="ui-hrq__key">
            <kbd>r</kbd> reject
          </span>
          <span className="ui-hrq__key">
            <kbd>e</kbd> edit
          </span>
          <span className="ui-hrq__key">
            <kbd>j</kbd>
            <kbd>k</kbd> move
          </span>
          <span className="ui-hrq__key">
            <kbd>esc</kbd> close
          </span>
          {mode === "edit" ? (
            <span className="ui-hrq__keysNote">paused while the field has focus</span>
          ) : null}
        </p>
      ) : null}

      {current && last ? (
        <p className="ui-hrq__last" data-kind={last.kind} key={`${last.id}-${last.kind}`}>
          <span className="ui-hrq__lastGlyph" aria-hidden="true">
            <KindGlyph kind={last.kind} />
          </span>
          <span className="ui-hrq__lastKind">{KIND_LABEL[last.kind]}</span>
          <span className="ui-hrq__lastWhat">{byId.get(last.id)?.action ?? last.id}</span>
          {last.kind === "edit" ? (
            <span className="ui-hrq__lastNote">{edited ? "wording changed" : "proposal kept"}</span>
          ) : null}
        </p>
      ) : null}

      {phase === "decided" ? (
        <div className="ui-hrq__summary">
          <div className="ui-hrq__summaryHead">
            <span className="ui-hrq__summaryGlyph" aria-hidden="true">
              <ClearedGlyph />
            </span>
            <span className="ui-hrq__summaryTitle">Queue clear</span>
          </div>
          <p className="ui-hrq__summaryText">
            {items.length === 1 ? "One request was decided" : `All ${items.length} requests were decided`}. Nothing
            is waiting for a person.
          </p>

          <div className="ui-hrq__tally">
            <span className="ui-hrq__tallyCell" data-kind="approve" data-zero={tally.approve === 0 ? "true" : undefined}>
              <span className="ui-hrq__tallyGlyph" aria-hidden="true">
                <CheckGlyph />
              </span>
              <b>{tally.approve}</b>
              <span className="ui-hrq__tallyLabel">approved</span>
            </span>
            <span className="ui-hrq__tallyCell" data-kind="reject" data-zero={tally.reject === 0 ? "true" : undefined}>
              <span className="ui-hrq__tallyGlyph" aria-hidden="true">
                <CrossGlyph />
              </span>
              <b>{tally.reject}</b>
              <span className="ui-hrq__tallyLabel">rejected</span>
            </span>
            <span className="ui-hrq__tallyCell" data-kind="edit" data-zero={tally.edit === 0 ? "true" : undefined}>
              <span className="ui-hrq__tallyGlyph" aria-hidden="true">
                <PencilGlyph />
              </span>
              <b>{tally.edit}</b>
              <span className="ui-hrq__tallyLabel">edited</span>
            </span>
          </div>

          <ol className="ui-hrq__log">
            {decisions.map((decision, index) => {
              const item = byId.get(decision.id);
              const reworded = decision.kind === "edit" && decision.value !== (item?.proposal ?? "");
              return (
                <li className="ui-hrq__logRow" key={`${decision.id}-${index}`} data-kind={decision.kind}>
                  <span className="ui-hrq__logGlyph" aria-hidden="true">
                    <KindGlyph kind={decision.kind} />
                  </span>
                  <span className="ui-hrq__logWhat">{item?.action ?? decision.id}</span>
                  <span className="ui-hrq__logKind">
                    {KIND_LABEL[decision.kind]}
                    {decision.kind === "edit" ? (reworded ? " · reworded" : " · as proposed") : ""}
                  </span>
                </li>
              );
            })}
          </ol>

          <button type="button" className="ui-hrq__reopen" onClick={reopen}>
            <ReopenGlyph />
            Reopen the queue
          </button>
        </div>
      ) : null}
    </section>
  );
}

/* ---------- The card ---------- */

/** One request as it is read: proposal, reason, evidence, impact, all of it open. */
function ItemSheet({ item, live, children }: { item: ReviewItem; live?: boolean; children?: ReactNode }) {
  return (
    <div className="ui-hrq__sheet" data-live={live ? "true" : undefined}>
      <div className="ui-hrq__eyebrow">
        {item.from ? <span className="ui-hrq__from">{item.from}</span> : null}
        {item.from && item.subject ? (
          <span className="ui-hrq__dot" aria-hidden="true">
            ·
          </span>
        ) : null}
        {item.subject ? <span className="ui-hrq__subject">{item.subject}</span> : null}
        {item.confidence !== undefined ? <Confidence value={item.confidence} /> : null}
      </div>

      <p className="ui-hrq__action">{item.action}</p>

      <p className="ui-hrq__why">
        <span className="ui-hrq__label">Why</span>
        {item.rationale}
      </p>

      <div className="ui-hrq__evidence">
        <span className="ui-hrq__label">Evidence</span>
        <ul className="ui-hrq__evList">
          {item.evidence.map((entry, index) => (
            <li className="ui-hrq__ev" key={`${item.id}-${index}`}>
              <span className="ui-hrq__evSrc">{entry.source}</span>
              <span className="ui-hrq__evQuote">{entry.quote}</span>
            </li>
          ))}
        </ul>
      </div>

      {item.impact ? (
        <p className="ui-hrq__impact">
          <span className="ui-hrq__label">If approved</span>
          {item.impact}
        </p>
      ) : null}

      {children}
    </div>
  );
}

function Confidence({ value }: { value: number }) {
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <span className="ui-hrq__conf">
      <span className="ui-hrq__confTrack" aria-hidden="true">
        <span className="ui-hrq__confFill" style={{ transform: `scaleX(${clamped.toFixed(3)})` }} />
      </span>
      <span className="ui-hrq__confValue">{Math.round(clamped * 100)}% confident</span>
    </span>
  );
}

/** Reads a duration token in milliseconds, so the JS timing matches the stylesheet's. */
function readDuration(name: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return raw.endsWith("ms") ? value : value * 1000;
}

/* ---------- Icons ---------- */

const KindGlyph = ({ kind }: { kind: ReviewKind }) =>
  kind === "approve" ? <CheckGlyph /> : kind === "reject" ? <CrossGlyph /> : <PencilGlyph />;

const QueueGlyph = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <rect x="2" y="2.4" width="12" height="3.8" rx="1.5" />
    <rect x="2" y="7.8" width="12" height="3.8" rx="1.5" />
    <path d="M5 13.9h6" strokeLinecap="round" />
  </svg>
);

const TrayGlyph = () => (
  <svg
    viewBox="0 0 22 22"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3.4 9.4h3.9l1.5 2.3h4.4l1.5-2.3h3.9" />
    <path d="M3.4 9.4V17a1.6 1.6 0 0 0 1.6 1.6h12a1.6 1.6 0 0 0 1.6-1.6V9.4" />
  </svg>
);

const ClearedGlyph = () => (
  <svg
    viewBox="0 0 22 22"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3.4" y="3.4" width="15.2" height="15.2" rx="4.2" />
    <path d="M7.4 11.4 10 14l4.8-5.4" strokeWidth="1.6" />
  </svg>
);

const CheckGlyph = () => (
  <svg
    viewBox="0 0 12 12"
    width="11"
    height="11"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2.4 6.3l2.3 2.3 4.9-5" />
  </svg>
);

const CrossGlyph = () => (
  <svg
    viewBox="0 0 12 12"
    width="10"
    height="10"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M2.8 2.8l6.4 6.4M9.2 2.8l-6.4 6.4" />
  </svg>
);

const PencilGlyph = () => (
  <svg
    viewBox="0 0 12 12"
    width="11"
    height="11"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2.3 9.7l.4-2.1 4.7-4.7 1.7 1.7-4.7 4.7z" />
    <path d="M7.4 2.9l1.7 1.7" />
  </svg>
);

const ReopenGlyph = () => (
  <svg
    viewBox="0 0 14 14"
    width="13"
    height="13"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M11.6 7a4.6 4.6 0 1 1-1.4-3.3" />
    <path d="M11.9 1.8v2.9H9" />
  </svg>
);

/* ---------- Styles ---------- */

const css = /* css */ `
.ui-hrq {
  /* Knobs. Override any of these on .ui-hrq to retheme the queue in a host. */
  --ui-hrq-ink: var(--text, #1a1410);
  --ui-hrq-muted: var(--text-muted, #6f625a);
  --ui-hrq-faint: var(--text-subtle, #1a141066);
  --ui-hrq-panel: var(--panel, #fffdfb);
  --ui-hrq-card: var(--card, #ffffff);
  --ui-hrq-well: var(--preview, #fdfaf7);
  --ui-hrq-line: var(--border, #e8e0d7);
  --ui-hrq-line-soft: var(--border-soft, #1a14101a);
  --ui-hrq-strong: var(--primary, #1a1410);
  --ui-hrq-on-strong: var(--primary-fg, #fffdfb);
  --ui-hrq-live: var(--accent, #c2410c);
  --ui-hrq-live-soft: var(--accent-soft, #c2410c1a);
  --ui-hrq-ok: var(--success, #1a7a4a);
  --ui-hrq-ok-on: #fffdfb;
  --ui-hrq-no: var(--danger, #b3261e);
  --ui-hrq-no-soft: #b3261e10;
  --ui-hrq-shadow: var(--shadow-card, 0 1px 1.5px #3d1f0a0a, inset 0 -1px 0 #3d1f0a0f);
  --ui-hrq-pop: var(--shadow-pop, 0 4px 42px #3d1f0a12, 0 2px 12px #3d1f0a0a);
  --ui-hrq-mono: var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace);
  --ui-hrq-ease: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-hrq-ease-in: var(--nm-ease-in, cubic-bezier(0.55, 0, 0.68, 0.19));
  --ui-hrq-ease-both: var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1));
  --ui-hrq-spring: var(--nm-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  --ui-hrq-tap: var(--nm-dur-1, 90ms);
  --ui-hrq-fast: var(--nm-dur-2, 160ms);
  --ui-hrq-move: var(--nm-dur-3, 240ms);
  --ui-hrq-enter: var(--nm-dur-4, 380ms);
  --ui-hrq-radius: var(--radius-panel, 20px);
  --ui-hrq-card-radius: var(--radius-card, 16px);
  --ui-hrq-well-radius: var(--radius-preview, 12px);

  position: relative;
  display: grid;
  gap: 12px;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 14px;
  border-radius: var(--ui-hrq-radius);
  background: var(--ui-hrq-panel);
  box-shadow: inset 0 0 0 1px var(--ui-hrq-line-soft);
  color: var(--ui-hrq-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  line-height: 20px;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
  container: ui-hrq / inline-size;
}
.ui-hrq *, .ui-hrq *::before, .ui-hrq *::after { box-sizing: border-box; }

:where(.ui-hrq) button { margin: 0; font: inherit; color: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.ui-hrq textarea { margin: 0; font: inherit; color: inherit; }
.ui-hrq button:focus-visible,
.ui-hrq textarea:focus-visible { outline: 2px solid var(--ui-hrq-live); outline-offset: 2px; }
.ui-hrq button:disabled { cursor: not-allowed; opacity: 0.5; }

/* Header ---------------------------------------------------------------- */

.ui-hrq__head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; min-width: 0; }

.ui-hrq__mark {
  display: grid;
  flex: none;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  background: var(--ui-hrq-well);
  box-shadow: inset 0 0 0 1px var(--ui-hrq-line-soft);
  color: var(--ui-hrq-muted);
}

.ui-hrq__title { font-size: 13px; font-weight: 600; line-height: 20px; }

.ui-hrq__agent {
  min-width: 0;
  overflow: hidden;
  color: var(--ui-hrq-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ui-hrq__agent b { font-family: var(--ui-hrq-mono); font-weight: 500; letter-spacing: 0; }

.ui-hrq__chip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  margin-left: auto;
  padding: 0 9px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-hrq-well);
  box-shadow: inset 0 0 0 1px var(--ui-hrq-line-soft);
  color: var(--ui-hrq-muted);
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.ui-hrq[data-state="reviewing"] .ui-hrq__chip,
.ui-hrq[data-state="editing"] .ui-hrq__chip { color: var(--ui-hrq-ink); }

/* Position, counts, rail ------------------------------------------------- */

.ui-hrq__progress { display: grid; gap: 7px; }

.ui-hrq__row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 14px;
  min-width: 0;
}

.ui-hrq__position {
  margin: 0;
  color: var(--ui-hrq-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.ui-hrq__position b { font-weight: 600; color: var(--ui-hrq-ink); }

.ui-hrq__counts {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  margin: 0;
  color: var(--ui-hrq-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.ui-hrq__count { display: inline-flex; align-items: center; gap: 5px; }
.ui-hrq__count b { font-weight: 600; color: var(--ui-hrq-ink); }
.ui-hrq__countGlyph { display: inline-flex; }
.ui-hrq__count[data-kind="approve"] .ui-hrq__countGlyph { color: var(--ui-hrq-ok); }
.ui-hrq__count[data-kind="reject"] .ui-hrq__countGlyph { color: var(--ui-hrq-no); }
.ui-hrq__count[data-kind="edit"] .ui-hrq__countGlyph { color: var(--ui-hrq-ink); }
.ui-hrq__count[data-zero] {
  color: var(--ui-hrq-faint);
}
.ui-hrq__count[data-zero] b { color: var(--ui-hrq-muted); }
.ui-hrq__count[data-zero] .ui-hrq__countGlyph { color: var(--ui-hrq-faint); }

.ui-hrq__rail { position: relative; display: flex; align-items: flex-end; gap: 4px; height: 10px; }

.ui-hrq__tick {
  flex: 1 1 0;
  min-width: 0;
  height: 4px;
  border-radius: 2px;
  background: var(--ui-hrq-line-soft);
  box-shadow: inset 0 0 0 1px var(--ui-hrq-line);
  transform-origin: center bottom;
  transition:
    background-color var(--ui-hrq-move) var(--ui-hrq-ease-both),
    box-shadow var(--ui-hrq-move) var(--ui-hrq-ease-both),
    transform var(--ui-hrq-move) var(--ui-hrq-ease-both);
}
.ui-hrq__tick[data-kind] { transform: scaleY(1.6); }
.ui-hrq__tick[data-kind="approve"] { background: var(--ui-hrq-ok); box-shadow: inset 0 0 0 1px var(--ui-hrq-ok); }
.ui-hrq__tick[data-kind="reject"] { background: var(--ui-hrq-no); box-shadow: inset 0 0 0 1px var(--ui-hrq-no); }
.ui-hrq__tick[data-kind="edit"] { background: var(--ui-hrq-ink); box-shadow: inset 0 0 0 1px var(--ui-hrq-ink); }

/* The one ember mark on the surface: the request currently in front of a person. */
.ui-hrq__marker {
  position: absolute;
  bottom: -3px;
  left: 0;
  width: var(--ui-hrq-w, 0px);
  height: 2px;
  border-radius: 2px;
  background: var(--ui-hrq-live);
  transform: translateX(var(--ui-hrq-x, 0px));
  transition: transform var(--ui-hrq-move) var(--ui-hrq-ease-both);
}

/* The card -------------------------------------------------------------- */

.ui-hrq__stage { position: relative; }

.ui-hrq__sheet {
  position: relative;
  display: grid;
  gap: 9px;
  padding: 13px 15px 14px 17px;
  border-radius: var(--ui-hrq-card-radius);
  background: var(--ui-hrq-card);
  box-shadow: inset 0 0 0 1px var(--ui-hrq-line), var(--ui-hrq-shadow);
  animation: ui-hrq-rise var(--ui-hrq-move) var(--ui-hrq-ease) var(--ui-hrq-tap) both;
}

.ui-hrq__sheet[data-live]::before {
  content: "";
  position: absolute;
  top: 12px;
  bottom: 12px;
  left: 0;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--ui-hrq-live);
  transform-origin: top center;
  animation: ui-hrq-edge var(--ui-hrq-enter) var(--ui-hrq-ease) both;
}

.ui-hrq__ghost {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  z-index: 2;
  pointer-events: none;
  animation-duration: var(--ui-hrq-move);
  animation-timing-function: var(--ui-hrq-ease-in);
  animation-fill-mode: both;
}
.ui-hrq__ghost[data-kind="approve"] { animation-name: ui-hrq-out-right; }
.ui-hrq__ghost[data-kind="reject"] { animation-name: ui-hrq-out-left; }
.ui-hrq__ghost[data-kind="edit"] { animation-name: ui-hrq-out-up; }
.ui-hrq__ghost .ui-hrq__sheet { animation: none; }

.ui-hrq__eyebrow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 7px;
  min-width: 0;
  color: var(--ui-hrq-muted);
  font-size: 11.5px;
  line-height: 16px;
}
.ui-hrq__from { white-space: nowrap; font-weight: 500; letter-spacing: 0.02em; }
.ui-hrq__dot { color: var(--ui-hrq-faint); }
.ui-hrq__subject {
  min-width: 0;
  overflow: hidden;
  color: var(--ui-hrq-ink);
  font-family: var(--ui-hrq-mono);
  font-size: 11.5px;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ui-hrq__conf { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; white-space: nowrap; }
.ui-hrq__confTrack {
  position: relative;
  display: block;
  width: 42px;
  height: 3px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--ui-hrq-line-soft);
  box-shadow: inset 0 0 0 1px var(--ui-hrq-line);
}
.ui-hrq__confFill {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 2px;
  background: var(--ui-hrq-muted);
  transform-origin: left center;
}
.ui-hrq__confValue { font-size: 11.5px; font-variant-numeric: tabular-nums; }

.ui-hrq__action {
  margin: 0;
  font-size: 14.5px;
  font-weight: 600;
  line-height: 21px;
  letter-spacing: -0.015em;
}

.ui-hrq__label {
  display: block;
  margin-bottom: 3px;
  color: var(--ui-hrq-faint);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.07em;
  line-height: 14px;
  text-transform: uppercase;
}

.ui-hrq__why { margin: 0; color: var(--ui-hrq-muted); font-size: 12.5px; line-height: 19px; }

.ui-hrq__evidence { min-width: 0; }
.ui-hrq__evList { display: grid; gap: 5px; margin: 0; padding: 0; list-style: none; }
.ui-hrq__ev {
  display: grid;
  gap: 2px;
  padding: 7px 10px;
  border-radius: var(--ui-hrq-well-radius);
  background: var(--ui-hrq-well);
  box-shadow: inset 0 0 0 1px var(--ui-hrq-line-soft);
}
.ui-hrq__evSrc { color: var(--ui-hrq-muted); font-size: 11px; line-height: 15px; }
.ui-hrq__evQuote { color: var(--ui-hrq-ink); font-size: 12.5px; line-height: 18px; }

.ui-hrq__impact {
  display: grid;
  margin: 0;
  color: var(--ui-hrq-muted);
  font-size: 12.5px;
  line-height: 19px;
}

/* Edit ------------------------------------------------------------------ */

.ui-hrq__edit {
  display: grid;
  gap: 7px;
  margin-top: 2px;
  padding: 11px;
  border-radius: var(--ui-hrq-well-radius);
  background: var(--ui-hrq-live-soft);
  animation: ui-hrq-pop var(--ui-hrq-move) var(--ui-hrq-spring) both;
}
.ui-hrq__editLabel { color: var(--ui-hrq-muted); font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
.ui-hrq__field {
  box-sizing: border-box;
  width: 100%;
  min-height: 56px;
  max-height: 160px;
  padding: 9px 10px;
  resize: vertical;
  border: 0;
  border-radius: 9px;
  background: var(--ui-hrq-card);
  box-shadow: inset 0 0 0 1px var(--ui-hrq-line);
  font-size: 13px;
  line-height: 19px;
}
.ui-hrq__hint { margin: 0; color: var(--ui-hrq-muted); font-size: 11.5px; line-height: 16px; }
.ui-hrq__editActions { display: flex; flex-wrap: wrap; gap: 8px; }

/* Decision bar ---------------------------------------------------------- */

.ui-hrq__bar { display: flex; flex-wrap: wrap; gap: 8px; }

.ui-hrq__btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: 10px;
  background: var(--ui-hrq-card);
  box-shadow: inset 0 0 0 1px var(--ui-hrq-line);
  font-size: 13px;
  font-weight: 500;
  transition:
    background-color var(--ui-hrq-fast) var(--ui-hrq-ease),
    box-shadow var(--ui-hrq-fast) var(--ui-hrq-ease),
    transform var(--ui-hrq-tap) var(--ui-hrq-ease);
}
.ui-hrq__btn svg { display: block; flex: none; }
.ui-hrq__btn:hover { background: var(--ui-hrq-well); }
.ui-hrq__btn:active { transform: translateY(1px); }
.ui-hrq__btn[data-kind="approve"] {
  background: var(--ui-hrq-ok);
  box-shadow: inset 0 0 0 1px var(--ui-hrq-ok), var(--ui-hrq-shadow);
  color: var(--ui-hrq-ok-on);
}
.ui-hrq__btn[data-kind="approve"]:hover { box-shadow: inset 0 0 0 1px var(--ui-hrq-ok), inset 0 0 0 100px #00000014; }
.ui-hrq__btn[data-kind="reject"] { color: var(--ui-hrq-no); box-shadow: inset 0 0 0 1px var(--ui-hrq-no); }
.ui-hrq__btn[data-kind="reject"]:hover { background: var(--ui-hrq-no-soft); }
.ui-hrq__btn[data-kind="edit"][aria-expanded="true"] { background: var(--ui-hrq-well); box-shadow: inset 0 0 0 1px var(--ui-hrq-ink); }

.ui-hrq__btnKey {
  display: inline-grid;
  place-items: center;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 5px;
  background: var(--ui-hrq-well);
  box-shadow: inset 0 0 0 1px var(--ui-hrq-line-soft);
  color: var(--ui-hrq-muted);
  font-family: var(--ui-hrq-mono);
  font-size: 10px;
  letter-spacing: 0;
}
.ui-hrq__btn[data-kind="approve"] .ui-hrq__btnKey {
  background: transparent;
  box-shadow: inset 0 0 0 1px currentColor;
  color: inherit;
  opacity: 0.85;
}

/* Declared keys --------------------------------------------------------- */

.ui-hrq__keys {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  margin: 0;
  padding: 0 2px;
  color: var(--ui-hrq-muted);
  font-size: 11.5px;
  line-height: 16px;
  transition: opacity var(--ui-hrq-fast) var(--ui-hrq-ease);
}
.ui-hrq__keys[data-paused] { opacity: 0.45; }
.ui-hrq__keysLabel { font-size: 10px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--ui-hrq-faint); }
.ui-hrq__key { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.ui-hrq__key kbd {
  display: inline-grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 5px;
  background: var(--ui-hrq-well);
  box-shadow: inset 0 0 0 1px var(--ui-hrq-line), inset 0 -1px 0 var(--ui-hrq-line);
  color: var(--ui-hrq-ink);
  font-family: var(--ui-hrq-mono);
  font-size: 10.5px;
  letter-spacing: 0;
}
.ui-hrq__keysNote { color: var(--ui-hrq-faint); font-style: italic; }

/* Last decision --------------------------------------------------------- */

.ui-hrq__last {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  margin: 0;
  padding: 0 2px;
  color: var(--ui-hrq-muted);
  font-size: 11.5px;
  line-height: 16px;
  animation: ui-hrq-fade var(--ui-hrq-move) var(--ui-hrq-ease) both;
}
.ui-hrq__lastGlyph { display: inline-flex; }
.ui-hrq__last[data-kind="approve"] .ui-hrq__lastGlyph { color: var(--ui-hrq-ok); }
.ui-hrq__last[data-kind="reject"] .ui-hrq__lastGlyph { color: var(--ui-hrq-no); }
.ui-hrq__last[data-kind="edit"] .ui-hrq__lastGlyph { color: var(--ui-hrq-ink); }
.ui-hrq__lastKind { font-weight: 600; color: var(--ui-hrq-ink); }
.ui-hrq__lastWhat { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ui-hrq__lastNote { color: var(--ui-hrq-faint); }

/* Decided summary ------------------------------------------------------- */

.ui-hrq__summary {
  display: grid;
  gap: 11px;
  padding: 15px 16px 16px;
  border-radius: var(--ui-hrq-card-radius);
  background: var(--ui-hrq-card);
  box-shadow: inset 0 0 0 1px var(--ui-hrq-line), var(--ui-hrq-pop);
  animation: ui-hrq-summary var(--ui-hrq-enter) var(--ui-hrq-spring) both;
}
.ui-hrq__summaryHead { display: flex; align-items: center; gap: 9px; }
.ui-hrq__summaryGlyph { display: grid; place-items: center; width: 26px; height: 26px; color: var(--ui-hrq-ok); }
.ui-hrq__summaryTitle { font-size: 14.5px; font-weight: 600; letter-spacing: -0.015em; }
.ui-hrq__summaryText { margin: 0; color: var(--ui-hrq-muted); font-size: 12.5px; line-height: 19px; }

.ui-hrq__tally { display: flex; flex-wrap: wrap; gap: 8px; }
.ui-hrq__tallyCell {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 7px 10px;
  border-radius: 10px;
  background: var(--ui-hrq-well);
  box-shadow: inset 0 0 0 1px var(--ui-hrq-line-soft);
  color: var(--ui-hrq-muted);
  font-size: 12px;
}
.ui-hrq__tallyCell b { font-size: 15px; font-weight: 600; color: var(--ui-hrq-ink); font-variant-numeric: tabular-nums; }
.ui-hrq__tallyGlyph { display: inline-flex; align-self: center; }
.ui-hrq__tallyLabel { font-size: 11.5px; }
.ui-hrq__tallyCell[data-kind="approve"] .ui-hrq__tallyGlyph { color: var(--ui-hrq-ok); }
.ui-hrq__tallyCell[data-kind="reject"] .ui-hrq__tallyGlyph { color: var(--ui-hrq-no); }
.ui-hrq__tallyCell[data-kind="edit"] .ui-hrq__tallyGlyph { color: var(--ui-hrq-ink); }
.ui-hrq__tallyCell[data-zero] { opacity: 0.6; }

.ui-hrq__log {
  display: grid;
  gap: 1px;
  max-height: 174px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  list-style: none;
}
.ui-hrq__logRow {
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  padding: 6px 3px;
}
.ui-hrq__logRow + .ui-hrq__logRow { box-shadow: inset 0 1px 0 var(--ui-hrq-line-soft); }
.ui-hrq__logGlyph { display: inline-flex; }
.ui-hrq__logRow[data-kind="approve"] .ui-hrq__logGlyph { color: var(--ui-hrq-ok); }
.ui-hrq__logRow[data-kind="reject"] .ui-hrq__logGlyph { color: var(--ui-hrq-no); }
.ui-hrq__logRow[data-kind="edit"] .ui-hrq__logGlyph { color: var(--ui-hrq-ink); }
.ui-hrq__logWhat {
  min-width: 0;
  overflow: hidden;
  font-size: 12.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ui-hrq__logKind { color: var(--ui-hrq-muted); font-size: 11.5px; white-space: nowrap; }

.ui-hrq__reopen {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  padding: 0 13px;
  border: 0;
  border-radius: 10px;
  background: var(--ui-hrq-strong);
  color: var(--ui-hrq-on-strong);
  font-size: 13px;
  font-weight: 500;
  transition:
    background-color var(--ui-hrq-fast) var(--ui-hrq-ease),
    transform var(--ui-hrq-tap) var(--ui-hrq-ease);
}
.ui-hrq__reopen svg { display: block; flex: none; }
.ui-hrq__reopen:hover { transform: translateY(-1px); }
.ui-hrq__reopen:active { transform: translateY(1px); }

/* Empty ----------------------------------------------------------------- */

.ui-hrq__empty {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 26px 18px 28px;
  border-radius: var(--ui-hrq-card-radius);
  background: var(--ui-hrq-card);
  box-shadow: inset 0 0 0 1px var(--ui-hrq-line-soft);
  text-align: center;
  animation: ui-hrq-fade var(--ui-hrq-enter) var(--ui-hrq-ease) both;
}
.ui-hrq__emptyArt {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 13px;
  background: var(--ui-hrq-well);
  box-shadow: inset 0 0 0 1px var(--ui-hrq-line-soft);
  color: var(--ui-hrq-faint);
}
.ui-hrq__emptyTitle { margin: 0; font-size: 13.5px; font-weight: 600; }
.ui-hrq__emptyText { max-width: 40ch; margin: 0; color: var(--ui-hrq-muted); font-size: 12.5px; line-height: 18px; }

.ui-hrq__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

/* Narrow: the shortcuts move under the buttons and the counts keep their own line. */

@container ui-hrq (max-width: 430px) {
  .ui-hrq__btn { flex: 1 1 auto; justify-content: center; }
  .ui-hrq__btnKey { display: none; }
  .ui-hrq__conf { margin-left: 0; }
  .ui-hrq__counts { gap: 4px 10px; }
  .ui-hrq__logKind { display: none; }
  .ui-hrq__logRow { grid-template-columns: 14px minmax(0, 1fr); }
}

@keyframes ui-hrq-rise {
  from { opacity: 0; transform: translateY(10px) scale(0.985); }
}
@keyframes ui-hrq-edge {
  from { transform: scaleY(0.25); }
}
@keyframes ui-hrq-out-right {
  to { opacity: 0; transform: translateX(16%) rotate(1.2deg); }
}
@keyframes ui-hrq-out-left {
  to { opacity: 0; transform: translateX(-16%) rotate(-1.2deg); }
}
@keyframes ui-hrq-out-up {
  to { opacity: 0; transform: translateY(-16%) scale(0.97); }
}
@keyframes ui-hrq-pop {
  from { opacity: 0; transform: scale(0.97); }
}
@keyframes ui-hrq-summary {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
}
@keyframes ui-hrq-fade {
  from { opacity: 0; }
}

:where(.dark, [data-theme="dark"]) .ui-hrq {
  --ui-hrq-ink: var(--text, #f4ece4);
  --ui-hrq-muted: var(--text-muted, #a2958a);
  --ui-hrq-faint: var(--text-subtle, #f4ece48c);
  --ui-hrq-panel: var(--panel, #1a1512);
  --ui-hrq-card: var(--card, #201a15);
  --ui-hrq-well: var(--preview, #26201a);
  --ui-hrq-line: var(--border, #33291f);
  --ui-hrq-line-soft: var(--border-soft, #ffffff12);
  --ui-hrq-strong: var(--primary, #f4ece4);
  --ui-hrq-on-strong: var(--primary-fg, #14100d);
  --ui-hrq-live: var(--accent, #ff6b35);
  --ui-hrq-live-soft: var(--accent-soft, #ff6b3524);
  --ui-hrq-ok: var(--success, #4f9d6e);
  --ui-hrq-ok-on: #14100d;
  --ui-hrq-no: var(--danger, #e2544a);
  --ui-hrq-no-soft: #e2544a1a;
  --ui-hrq-shadow: var(--shadow-card, 0 1px 1.5px #0000004d, inset 0 -1px 0 #ffffff0a);
  --ui-hrq-pop: var(--shadow-pop, 0 4px 42px #00000066, 0 0 0 1px #ffffff14);
}

@media (prefers-reduced-motion: reduce) {
  .ui-hrq *, .ui-hrq *::before, .ui-hrq *::after { animation: none; transition-duration: 1ms; }
  .ui-hrq__ghost { display: none; }
}
`;