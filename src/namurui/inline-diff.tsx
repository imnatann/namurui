"use client";

import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from "react";

/*
 * Inline Diff – AI edits to prose, accepted or rejected one run of words at a time, in a single
 * self-contained file. Removed words are struck out and tinted red, added words tinted green, and
 * each run is a span you can accept with Y or reject with N. A measured popover follows the run
 * you are on, the footer counts what is left, and the last decision flips it to "All changes
 * reviewed" with an undo. The styles are injected below, so no extra files are needed.
 */

export type DiffSegment =
  | { type: "equal"; text: string }
  | {
      type: "change";
      /** Words the suggestion takes out – "" for a pure insertion */
      remove: string;
      /** Words it puts in their place – "" for a pure deletion */
      insert: string;
    };

/** A change without the discriminant, what the callbacks hand back */
export type DiffChange = { remove: string; insert: string };

export type DiffDecision = "accepted" | "rejected";

export type InlineDiffHandle = {
  /** Highlights a change and opens its popover; null closes both */
  highlight: (index: number | null) => void;
  /** Accepts one change, addressed by its index in the segments */
  accept: (index: number) => void;
  /** Rejects one change, addressed by its index in the segments */
  reject: (index: number) => void;
  acceptAll: () => void;
  rejectAll: () => void;
  /** Puts the last decision back up for review */
  undo: () => void;
  /** Puts every decision back up for review */
  reset: () => void;
};

export type InlineDiffProps = {
  /** The prose as it is now */
  original?: string;
  /** The prose the AI suggests – diffed word by word against original */
  revised?: string;
  /** Pre-computed segments, when the diff is not prose-to-prose */
  changes?: readonly DiffSegment[];
  /** The suggestion line above the prose, e.g. "Suggested by AI · Make it shorter" */
  label?: string;
  /** One change accepted: index in the segments, and the words involved */
  onAccept?: (index: number, change: DiffChange) => void;
  /** One change rejected: index in the segments, and the words involved */
  onReject?: (index: number, change: DiffChange) => void;
  /** Fired on every decision and undo with the prose so far – pending changes keep the original words */
  onChange?: (text: string) => void;
  /** Fired when the last pending change is decided */
  onDone?: (text: string) => void;
  ref?: Ref<InlineDiffHandle>;
  className?: string;
};

/* ---------- Diffing ---------- */

/** A word run or single punctuation mark, carrying the whitespace that trails it */
const TOKEN = /\s+|[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*\s*|[^\s\p{L}\p{N}]\s*/gu;

/**
 * Word-level diff. Adjacent removals and insertions become one change, so a rewritten phrase is
 * a single suggestion; a replacement hands its shared trailing space back to the text around it.
 */
export function diffWords(original: string, revised: string): DiffSegment[] {
  const a = original.match(TOKEN) ?? [];
  const b = revised.match(TOKEN) ?? [];
  const n = a.length;
  const m = b.length;
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const segments: DiffSegment[] = [];
  let equal = "";
  let remove = "";
  let insert = "";

  const flushEqual = () => {
    if (!equal) return;
    segments.push({ type: "equal", text: equal });
    equal = "";
  };

  const flushChange = () => {
    if (!remove && !insert) return;
    let gap = "";
    if (remove && insert) {
      const tail = /\s+$/.exec(remove)?.[0] ?? "";
      const head = /\s+$/.exec(insert)?.[0] ?? "";
      if (tail && head) {
        gap = tail;
        remove = remove.slice(0, -tail.length);
        insert = insert.slice(0, -head.length);
      }
    }
    segments.push({ type: "change", remove, insert });
    remove = "";
    insert = "";
    equal = gap;
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      flushChange();
      equal += a[i];
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      flushEqual();
      remove += a[i];
      i++;
    } else {
      flushEqual();
      insert += b[j];
      j++;
    }
  }
  while (i < n) {
    flushEqual();
    remove += a[i];
    i++;
  }
  while (j < m) {
    flushEqual();
    insert += b[j];
    j++;
  }
  flushChange();
  flushEqual();
  return segments;
}

/** The prose as it stands after the decisions taken so far */
function assemble(segments: readonly DiffSegment[], decisions: Map<number, DiffDecision>): string {
  let text = "";
  segments.forEach((segment, index) => {
    if (segment.type === "equal") {
      text += segment.text;
      return;
    }
    text += decisions.get(index) === "accepted" ? segment.insert : segment.remove;
  });
  return text;
}

/** “available”, and a long run is clipped so the label stays readable */
function quote(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > 42 ? `“${trimmed.slice(0, 39)}…”` : `“${trimmed}”`;
}

/* ---------- Component ---------- */

export function InlineDiff({
  original = "",
  revised = "",
  changes,
  label = "Suggested by AI",
  onAccept,
  onReject,
  onChange,
  onDone,
  ref,
  className,
}: InlineDiffProps) {
  const segments = useMemo<readonly DiffSegment[]>(
    () => changes ?? diffWords(original, revised),
    [changes, original, revised],
  );
  const changeIndices = useMemo(
    () => segments.flatMap((segment, index) => (segment.type === "change" ? [index] : [])),
    [segments],
  );

  const [decisions, setDecisions] = useState<Map<number, DiffDecision>>(() => new Map());
  const [order, setOrder] = useState<number[]>([]);
  const [active, setActive] = useState<number | null>(() => changeIndices[0] ?? null);
  const [announce, setAnnounce] = useState("");
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [snap, setSnap] = useState(false);

  const decisionsRef = useRef(decisions);
  const orderRef = useRef(order);
  const cardRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const nodes = useRef(new Map<number, HTMLSpanElement>());
  const focusNext = useRef<number | "undo" | null>(null);

  const pending = changeIndices.filter((index) => !decisions.has(index));
  const done = pending.length === 0;
  /* The popover belongs to a run still waiting for a decision; a decided one is settled prose. */
  const activeIndex =
    active !== null && segments[active]?.type === "change" && !decisions.has(active) ? active : null;

  /* A new diff is a new review: the old decisions no longer describe these words. */
  const signature = useMemo(
    () =>
      segments
        .map((segment) => (segment.type === "equal" ? `=${segment.text}` : `-${segment.remove}+${segment.insert}`))
        .join("\u0000"),
    [segments],
  );
  const reviewed = useRef(signature);
  useEffect(() => {
    if (reviewed.current === signature) return;
    reviewed.current = signature;
    decisionsRef.current = new Map();
    orderRef.current = [];
    setDecisions(new Map());
    setOrder([]);
    setActive(changeIndices[0] ?? null);
    setAnnounce("");
  }, [signature, changeIndices]);

  const commit = (next: Map<number, DiffDecision>, stack: number[]) => {
    decisionsRef.current = next;
    orderRef.current = stack;
    setDecisions(next);
    setOrder(stack);
  };

  const reveal = (index: number) => {
    const node = nodes.current.get(index);
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (rect.top >= 0 && rect.bottom <= window.innerHeight) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  };

  const decide = (index: number, decision: DiffDecision) => {
    if (decisionsRef.current.has(index)) return;
    const segment = segments[index];
    if (!segment || segment.type !== "change") return;

    const next = new Map(decisionsRef.current);
    next.set(index, decision);
    commit(next, [...orderRef.current, index]);
    setSnap(false);

    const text = assemble(segments, next);
    onChange?.(text);
    if (decision === "accepted") onAccept?.(index, { remove: segment.remove, insert: segment.insert });
    else onReject?.(index, { remove: segment.remove, insert: segment.insert });

    const left = changeIndices.filter((entry) => !next.has(entry));
    const position = changeIndices.indexOf(index) + 1;
    setAnnounce(
      `${decision === "accepted" ? "Accepted" : "Rejected"} suggestion ${position} of ${changeIndices.length}. ` +
        (left.length === 0 ? "All changes reviewed." : `${left.length} left.`),
    );

    const target = left.find((entry) => entry > index) ?? left[0] ?? null;
    setActive(target);
    focusNext.current = target ?? "undo";
    if (left.length === 0) onDone?.(text);
  };

  const decideAll = (decision: DiffDecision) => {
    const next = new Map(decisionsRef.current);
    const stack = [...orderRef.current];
    for (const index of changeIndices) {
      if (next.has(index)) continue;
      const segment = segments[index];
      if (!segment || segment.type !== "change") continue;
      next.set(index, decision);
      stack.push(index);
      if (decision === "accepted") onAccept?.(index, { remove: segment.remove, insert: segment.insert });
      else onReject?.(index, { remove: segment.remove, insert: segment.insert });
    }
    if (next.size === decisionsRef.current.size) return;
    commit(next, stack);
    setSnap(false);
    setActive(null);

    const text = assemble(segments, next);
    onChange?.(text);
    onDone?.(text);
    setAnnounce(
      decision === "accepted"
        ? `All ${changeIndices.length} suggestions accepted.`
        : `All ${changeIndices.length} suggestions rejected.`,
    );
    focusNext.current = "undo";
  };

  const undo = () => {
    const stack = [...orderRef.current];
    const last = stack.pop();
    if (last === undefined) return;
    const next = new Map(decisionsRef.current);
    next.delete(last);
    commit(next, stack);
    setSnap(false);

    onChange?.(assemble(segments, next));
    setAnnounce("Undone. One suggestion is back for review.");
    setActive(last);
    focusNext.current = last;
  };

  const reset = () => {
    commit(new Map(), []);
    setAnnounce("All suggestions are back for review.");
    setActive(changeIndices[0] ?? null);
    focusNext.current = changeIndices[0] ?? null;
  };

  useImperativeHandle(ref, () => ({
    highlight: (index) => setActive(index),
    accept: (index) => decide(index, "accepted"),
    reject: (index) => decide(index, "rejected"),
    acceptAll: () => decideAll("accepted"),
    rejectAll: () => decideAll("rejected"),
    undo,
    reset,
  }));

  /* Focus follows the review, so Y and N keep working without reaching for the mouse. */
  useEffect(() => {
    const target = focusNext.current;
    if (target === null) return;
    focusNext.current = null;
    if (target === "undo") {
      undoRef.current?.focus({ preventScroll: true });
      return;
    }
    nodes.current.get(target)?.focus({ preventScroll: true });
    reveal(target);
  }, [decisions]); // eslint-disable-line react-hooks/exhaustive-deps

  /* The popover is measured against the run it belongs to, inside the card. */
  useLayoutEffect(() => {
    if (activeIndex === null) return;
    const card = cardRef.current;
    const tip = popRef.current;
    const node = nodes.current.get(activeIndex);
    if (!card || !tip || !node) return;

    const place = () => {
      const cardBox = card.getBoundingClientRect();
      const box = node.getBoundingClientRect();
      const width = tip.offsetWidth;
      const height = tip.offsetHeight;
      const inset = 8;
      const gap = 7;
      const centre = box.left - cardBox.left + box.width / 2;
      const x = Math.min(Math.max(centre - width / 2, inset), Math.max(inset, cardBox.width - width - inset));
      const above = box.top - cardBox.top - height - gap;
      const y = above >= inset ? above : box.bottom - cardBox.top + gap;
      setPos((current) =>
        Math.abs(current.x - x) < 0.5 && Math.abs(current.y - y) < 0.5 ? current : { x, y },
      );
    };

    place();
    const onResize = () => {
      setSnap(true);
      place();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [activeIndex, decisions, segments]);

  useEffect(() => {
    if (!snap) return;
    const frame = requestAnimationFrame(() => setSnap(false));
    return () => cancelAnimationFrame(frame);
  }, [snap]);

  const step = (direction: 1 | -1) => {
    if (pending.length === 0) return;
    const position = activeIndex === null ? -1 : pending.indexOf(activeIndex);
    const next =
      position < 0
        ? direction === 1
          ? pending[0]
          : pending[pending.length - 1]
        : pending[(position + direction + pending.length) % pending.length];
    setActive(next);
    reveal(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
    /* The footer buttons are their own actions; the popover's are the keyboard path. */
    const onFooter = target?.closest?.(".ui-dfc__btn, .ui-dfc__icon") != null;

    if (event.key === "Escape") {
      setActive(null);
      return;
    }
    if (!onFooter && activeIndex !== null) {
      if (event.key === "y" || event.key === "Y") {
        event.preventDefault();
        decide(activeIndex, "accepted");
        return;
      }
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        decide(activeIndex, "rejected");
        return;
      }
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      step(event.key === "ArrowRight" ? 1 : -1);
    }
  };

  const describe = (index: number) => {
    const segment = segments[index];
    if (!segment || segment.type !== "change") return undefined;
    const position = changeIndices.indexOf(index) + 1;
    const body = segment.remove && segment.insert
      ? `replace ${quote(segment.remove)} with ${quote(segment.insert)}`
      : segment.insert
        ? `add ${quote(segment.insert)}`
        : `remove ${quote(segment.remove)}`;
    return `Suggestion ${position} of ${changeIndices.length}: ${body}. Press Y to accept, N to reject`;
  };

  const open = activeIndex !== null;

  return (
    <div className={["ui-dfc", className].filter(Boolean).join(" ")} data-done={done || undefined}>
      {/* React 19 hoists this into <head> once, no matter how many diffs render */}
      <style href="ui-inline-diff" precedence="default">
        {css}
      </style>

      <div className="ui-dfc__card" ref={cardRef} onKeyDown={onKeyDown}>
        <div className="ui-dfc__body">
          <div className="ui-dfc__label">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 1.75c.3 2.9 1.35 3.95 4.25 4.25-2.9.3-3.95 1.35-4.25 4.25C7.7 7.35 6.65 6.3 3.75 6 6.65 5.7 7.7 4.65 8 1.75Z" />
              <path d="M12.5 10.25c.15 1.25.6 1.7 1.75 1.75-1.15.15-1.6.6-1.75 1.75-.15-1.15-.6-1.6-1.75-1.75 1.15-.05 1.6-.5 1.75-1.75Z" />
            </svg>
            <span>{label}</span>
          </div>

          <p className="ui-dfc__text">
            {segments.map((segment, index) => {
              if (segment.type === "equal") return <span key={index}>{segment.text}</span>;

              const state: DiffDecision | "pending" = decisions.get(index) ?? "pending";
              const isActive = activeIndex === index;

              return (
                <span
                  key={index}
                  ref={(node) => {
                    if (node) nodes.current.set(index, node);
                    else nodes.current.delete(index);
                  }}
                  className="ui-dfc__chg"
                  data-state={state}
                  data-active={isActive || undefined}
                  tabIndex={state === "pending" ? 0 : undefined}
                  role={state === "pending" ? "button" : undefined}
                  aria-label={state === "pending" ? describe(index) : undefined}
                  onFocus={() => state === "pending" && setActive(index)}
                  onPointerEnter={() => state === "pending" && setActive(index)}
                  onClick={() => state === "pending" && setActive(index)}
                  onKeyDown={(event) => {
                    if (state !== "pending") return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setActive(index);
                    }
                  }}
                >
                  {segment.remove ? <del className="ui-dfc__del">{segment.remove}</del> : null}
                  {segment.insert ? <ins className="ui-dfc__ins">{segment.insert}</ins> : null}
                </span>
              );
            })}
          </p>
        </div>

        <div className="ui-dfc__foot">
          <div className="ui-dfc__bar">
            <div
              className="ui-dfc__layer"
              data-show={done ? undefined : true}
              inert={done}
              aria-hidden={done ? true : undefined}
            >
              <span className="ui-dfc__count">
                <span className="ui-dfc__num">{pending.length}</span>
                <span className="ui-dfc__word">{pending.length === 1 ? "suggestion" : "suggestions"}</span>
              </span>
              <span className="ui-dfc__actions">
                <span className="ui-dfc__nav">
                  <button
                    type="button"
                    className="ui-dfc__icon"
                    aria-label="Previous suggestion"
                    onClick={() => step(-1)}
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M10 12.5 5.5 8 10 3.5" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="ui-dfc__icon"
                    aria-label="Next suggestion"
                    onClick={() => step(1)}
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M6 3.5 10.5 8 6 12.5" />
                    </svg>
                  </button>
                </span>
                <button type="button" className="ui-dfc__btn" onClick={() => decideAll("rejected")}>
                  Reject all
                </button>
                <button
                  type="button"
                  className="ui-dfc__btn ui-dfc__btn--primary"
                  onClick={() => decideAll("accepted")}
                >
                  Accept all
                </button>
              </span>
            </div>

            <div
              className="ui-dfc__layer"
              data-show={done || undefined}
              inert={!done}
              aria-hidden={done ? undefined : true}
            >
              <span className="ui-dfc__count ui-dfc__count--done">
                <svg className="ui-dfc__ok" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M3.75 8.4 6.6 11.1 12.25 5" pathLength={1} />
                </svg>
                All changes reviewed
              </span>
              <button
                type="button"
                ref={undoRef}
                className="ui-dfc__btn"
                disabled={order.length === 0}
                onClick={undo}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M5.5 4 2.75 6.75 5.5 9.5" />
                  <path d="M3 6.75h6.5a3.75 3.75 0 0 1 0 7.5H7.5" />
                </svg>
                Undo
              </button>
            </div>
          </div>
        </div>

        <div
          className="ui-dfc__pop"
          ref={popRef}
          role="group"
          aria-label="Review suggestion"
          data-open={open || undefined}
          data-snap={snap || undefined}
          aria-hidden={open ? undefined : true}
          style={{ left: pos.x, top: pos.y }}
        >
          <button
            type="button"
            tabIndex={-1}
            className="ui-dfc__pbtn ui-dfc__pbtn--primary"
            aria-label="Accept suggestion"
            onClick={() => activeIndex !== null && decide(activeIndex, "accepted")}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.75 8.4 6.6 11.1 12.25 5" />
            </svg>
            Accept
            <kbd>Y</kbd>
          </button>
          <button
            type="button"
            tabIndex={-1}
            className="ui-dfc__pbtn"
            aria-label="Reject suggestion"
            onClick={() => activeIndex !== null && decide(activeIndex, "rejected")}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
            </svg>
            Reject
            <kbd>N</kbd>
          </button>
        </div>
      </div>

      <span className="ui-dfc__sr" role="status" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}

/* ---------- Styles ---------- */

const css = /* css */ `
.ui-dfc{--ui-dfc-card: #fffdfb;--ui-dfc-ink: rgba(11, 9, 8, 0.88);--ui-dfc-strong: #0b0908;--ui-dfc-text: rgba(11, 9, 8, 0.61);--ui-dfc-muted: rgba(11, 9, 8, 0.45);--ui-dfc-faint: rgba(11, 9, 8, 0.27);--ui-dfc-icon: rgba(11, 9, 8, 0.447);--ui-dfc-line: rgba(11, 9, 8, 0.06);--ui-dfc-fill: rgba(11, 9, 8, 0.06);--ui-dfc-wash: rgba(11, 9, 8, 0.03);--ui-dfc-accent: rgba(217, 84, 31, 0.765);--ui-dfc-add: rgba(47, 141, 92, 0.1);--ui-dfc-add-strong: rgba(47, 141, 92, 0.16);--ui-dfc-del: rgba(226, 84, 74, 0.08);--ui-dfc-del-strong: rgba(226, 84, 74, 0.14);--ui-dfc-del-ink: rgba(11, 9, 8, 0.45);--ui-dfc-strike: rgba(226, 84, 74, 0.6);--ui-dfc-ok: #2f8d5c;--ui-dfc-primary: rgba(11, 9, 8, 0.88);--ui-dfc-primary-ink: #fcf9f7;--ui-dfc-primary-kbd: rgba(255, 253, 251, 0.16);--ui-dfc-primary-kbd-ink: rgba(255, 253, 251, 0.66);--ui-dfc-secondary-hover: #faf7f4;--ui-dfc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-dfc-shadow-pop: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 12px 28px -10px rgba(11, 9, 8, 0.16), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-dfc-focus: rgba(217, 84, 31, 0.35);--ui-dfc-ease: cubic-bezier(0.22, 1, 0.36, 1);position: relative;box-sizing: border-box;display: grid;width: 100%;min-width: 0;color: var(--ui-dfc-ink);font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;font-weight: 400;-webkit-font-smoothing: antialiased;text-align: left}
.ui-dfc *, .ui-dfc *::before, .ui-dfc *::after{box-sizing: border-box}
:where(.ui-dfc) button{appearance: none;margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
:where(.ui-dfc) svg{display: block;flex: none}
.ui-dfc__card{position: relative;min-width: 0;border-radius: 10px;background: var(--ui-dfc-card);box-shadow: var(--ui-dfc-shadow);container: ui-dfc-card / inline-size}
.ui-dfc__label{display: flex;align-items: center;gap: 6px;min-width: 0;margin: 0 0 8px;color: var(--ui-dfc-text);font-size: 12px;line-height: 16px}
.ui-dfc__label span{overflow: hidden;text-overflow: ellipsis;white-space: nowrap}
.ui-dfc__label svg{width: 16px;height: 16px;fill: var(--ui-dfc-accent)}
.ui-dfc__body{padding: 16px 16px 18px}
.ui-dfc__text{margin: 0;color: var(--ui-dfc-ink);font-size: 13px;line-height: 22px;white-space: pre-line;overflow-wrap: anywhere}
.ui-dfc__chg{border-radius: 4px;cursor: pointer;scroll-margin: 64px 0 72px}
.ui-dfc__chg:not([data-state="pending"]){cursor: auto}
.ui-dfc__chg:focus{outline: none}
.ui-dfc__chg:focus-visible{outline: 2px solid var(--ui-dfc-focus);outline-offset: 1px}
.ui-dfc__del, .ui-dfc__ins{padding: 1px 2px;border-radius: 4px;-webkit-box-decoration-break: clone;box-decoration-break: clone;font-size: 1em;transition: background-color var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), text-decoration-color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), font-size var(--nm-dur-4, 380ms) var(--ui-dfc-ease), padding var(--nm-dur-4, 380ms) var(--ui-dfc-ease), margin var(--nm-dur-4, 380ms) var(--ui-dfc-ease), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dfc__del{background: var(--ui-dfc-del);color: var(--ui-dfc-del-ink);text-decoration: line-through;text-decoration-color: var(--ui-dfc-strike);text-decoration-thickness: 1px}
.ui-dfc__ins{background: var(--ui-dfc-add);color: var(--ui-dfc-ink);text-decoration: none}
.ui-dfc__del + .ui-dfc__ins{margin-left: 3px}
.ui-dfc__chg[data-active] .ui-dfc__del{background: var(--ui-dfc-del-strong)}
.ui-dfc__chg[data-active] .ui-dfc__ins{background: var(--ui-dfc-add-strong)}
.ui-dfc__chg[data-state="accepted"] .ui-dfc__del, .ui-dfc__chg[data-state="rejected"] .ui-dfc__ins{font-size: 0;padding: 0;margin: 0;opacity: 0}
.ui-dfc__chg[data-state="accepted"] .ui-dfc__ins, .ui-dfc__chg[data-state="rejected"] .ui-dfc__del{padding: 0;margin: 0;background: transparent;color: inherit;text-decoration-color: transparent}
.ui-dfc__foot{display: grid;align-items: center;min-height: 44px;padding: 8px 8px 8px 16px;border-top: 0.5px solid var(--ui-dfc-line)}
.ui-dfc__bar{display: grid}
.ui-dfc__layer{grid-area: 1 / 1;display: flex;flex-wrap: wrap;align-items: center;justify-content: space-between;gap: 8px;min-width: 0;opacity: 0;visibility: hidden;transform: translateY(4px);filter: blur(2px);transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-4, 380ms) var(--ui-dfc-ease), filter var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), visibility 0s 420ms}
.ui-dfc__layer[data-show]{opacity: 1;visibility: visible;transform: none;filter: none;transition: opacity var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 80ms, transform var(--nm-dur-4, 380ms) var(--ui-dfc-ease) 80ms, filter var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 80ms, visibility 0s}
@container ui-dfc-card (max-width: 400px){.ui-dfc__word{position: absolute;width: 1px;height: 1px;overflow: hidden;clip: rect(0 0 0 0);white-space: nowrap}
}
.ui-dfc__count{display: inline-flex;align-items: center;gap: 8px;color: var(--ui-dfc-text);font-size: 13px;line-height: 20px;white-space: nowrap}
.ui-dfc__count--done{gap: 6px;color: var(--ui-dfc-ink);font-weight: 500}
.ui-dfc__num{display: inline-grid;place-items: center;min-width: 20px;height: 20px;padding: 0 6px;border-radius: 5px;background: var(--ui-dfc-fill);color: var(--ui-dfc-ink);font-size: 12px;font-weight: 500;font-variant-numeric: tabular-nums}
.ui-dfc__ok{width: 16px;height: 16px;fill: none;stroke: var(--ui-dfc-ok);stroke-width: 1.5;stroke-linecap: round;stroke-linejoin: round;stroke-dasharray: 1;stroke-dashoffset: 1}
.ui-dfc[data-done] .ui-dfc__ok{animation: ui-dfc-draw var(--nm-dur-4, 380ms) var(--ui-dfc-ease) 220ms forwards}
.ui-dfc__actions{display: inline-flex;align-items: center;gap: 8px;margin-left: auto}
.ui-dfc__nav{display: inline-flex;gap: 2px}
.ui-dfc__btn, .ui-dfc__icon{display: inline-flex;align-items: center;justify-content: center;gap: 6px;height: 28px;border-radius: 6px;font-size: 13px;font-weight: 500;line-height: 20px;white-space: nowrap;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 160ms var(--ui-dfc-ease)}
.ui-dfc__btn{padding: 0 10px;background: var(--ui-dfc-card);box-shadow: var(--ui-dfc-shadow);color: var(--ui-dfc-strong)}
.ui-dfc__btn:has(svg){padding: 0 10px 0 8px}
.ui-dfc__icon{width: 28px;color: var(--ui-dfc-icon)}
.ui-dfc__btn svg, .ui-dfc__icon svg, .ui-dfc__pbtn svg{width: 16px;height: 16px;fill: none;stroke: currentColor;stroke-width: 1.1;stroke-linecap: round;stroke-linejoin: round}
.ui-dfc__btn svg{color: var(--ui-dfc-icon)}
.ui-dfc__btn:hover:not(:disabled){background: var(--ui-dfc-secondary-hover)}
.ui-dfc__icon:hover:not(:disabled){background: var(--ui-dfc-wash);color: var(--ui-dfc-ink)}
.ui-dfc__btn--primary{background: var(--ui-dfc-primary);color: var(--ui-dfc-primary-ink);box-shadow: none}
.ui-dfc__btn--primary:hover:not(:disabled){background: var(--ui-dfc-primary);opacity: 0.9}
.ui-dfc__btn:active:not(:disabled), .ui-dfc__icon:active:not(:disabled){transform: scale(0.97)}
.ui-dfc__btn:disabled, .ui-dfc__icon:disabled{opacity: 0.4;cursor: default}
.ui-dfc__btn:focus-visible, .ui-dfc__icon:focus-visible{outline: 2px solid var(--ui-dfc-focus);outline-offset: 1px}
.ui-dfc__pop{position: absolute;top: 0;left: 0;z-index: 2;display: flex;align-items: center;gap: 4px;padding: 4px;border-radius: 10px;background: var(--ui-dfc-card);box-shadow: var(--ui-dfc-shadow-pop);opacity: 0;visibility: hidden;transform: translateY(4px) scale(0.96);transform-origin: 50% 100%;pointer-events: none;transition: opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 240ms var(--ui-dfc-ease), left 90ms ease-out, top 90ms ease-out, visibility 0s 240ms}
.ui-dfc__pop[data-open]{opacity: 1;visibility: visible;transform: none;pointer-events: auto;transition: opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-3, 240ms) var(--ui-dfc-ease), left 90ms ease-out, top 90ms ease-out, visibility 0s}
.ui-dfc__pop[data-snap]{transition-property: opacity, transform, visibility}
.ui-dfc__pbtn{display: inline-flex;align-items: center;gap: 6px;height: 28px;padding: 0 6px 0 8px;border-radius: 6px;background: var(--ui-dfc-card);box-shadow: var(--ui-dfc-shadow);color: var(--ui-dfc-strong);font-size: 13px;font-weight: 500;line-height: 20px;white-space: nowrap;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dfc__pbtn svg{color: var(--ui-dfc-icon)}
.ui-dfc__pbtn:hover{background: var(--ui-dfc-secondary-hover)}
.ui-dfc__pbtn--primary{background: var(--ui-dfc-primary);box-shadow: none;color: var(--ui-dfc-primary-ink)}
.ui-dfc__pbtn--primary svg{color: currentColor}
.ui-dfc__pbtn--primary:hover{background: var(--ui-dfc-primary);opacity: 0.9}
.ui-dfc__pbtn kbd{display: inline-grid;place-items: center;min-width: 16px;height: 16px;padding: 0 4px;border-radius: 4px;background: var(--ui-dfc-fill);color: var(--ui-dfc-muted);font: inherit;font-size: 10px;font-weight: 500;line-height: 16px}
.ui-dfc__pbtn--primary kbd{background: var(--ui-dfc-primary-kbd);color: var(--ui-dfc-primary-kbd-ink)}
.ui-dfc__sr{position: absolute;width: 1px;height: 1px;margin: -1px;padding: 0;overflow: hidden;clip: rect(0 0 0 0);white-space: nowrap;border: 0}
@keyframes ui-dfc-draw{to{stroke-dashoffset: 0}
}
@container ui-dfc-card (max-width: 360px){.ui-dfc__nav{display: none}
.ui-dfc__body{padding: 14px 14px 16px}
.ui-dfc__foot{padding-left: 14px}
}
@media (hover: none) and (pointer: coarse){.ui-dfc__pbtn kbd{display: none}
.ui-dfc__pbtn{height: 34px;padding: 0 12px 0 10px}
.ui-dfc__btn{height: 34px}
.ui-dfc__icon{width: 34px;height: 34px}
.ui-dfc__foot{min-height: 52px}
}
@media (prefers-reduced-motion: reduce){.ui-dfc *, .ui-dfc *::before, .ui-dfc *::after{animation-duration: 1ms !important;animation-delay: 0ms !important;transition-duration: 1ms !important;transition-delay: 0ms !important}
.ui-dfc__layer{filter: none;transform: none}
}
:where(.dark, [data-theme="dark"]) .ui-dfc{--ui-dfc-card: #211b16;--ui-dfc-ink: rgba(255, 253, 251, 0.9);--ui-dfc-strong: #fffdfb;--ui-dfc-text: rgba(255, 253, 251, 0.62);--ui-dfc-muted: rgba(255, 253, 251, 0.46);--ui-dfc-faint: rgba(255, 253, 251, 0.3);--ui-dfc-icon: rgba(255, 253, 251, 0.5);--ui-dfc-line: rgba(255, 253, 251, 0.08);--ui-dfc-fill: rgba(255, 253, 251, 0.08);--ui-dfc-wash: rgba(255, 253, 251, 0.04);--ui-dfc-accent: #ff8a5c;--ui-dfc-add: rgba(47, 141, 92, 0.14);--ui-dfc-add-strong: rgba(47, 141, 92, 0.22);--ui-dfc-del: rgba(226, 84, 74, 0.14);--ui-dfc-del-strong: rgba(226, 84, 74, 0.22);--ui-dfc-del-ink: rgba(255, 253, 251, 0.46);--ui-dfc-strike: rgba(226, 84, 74, 0.7);--ui-dfc-ok: #2f8d5c;--ui-dfc-primary: rgba(255, 253, 251, 0.9);--ui-dfc-primary-ink: #211b16;--ui-dfc-primary-kbd: rgba(11, 9, 8, 0.08);--ui-dfc-primary-kbd-ink: rgba(33, 27, 22, 0.6);--ui-dfc-secondary-hover: #27201a;--ui-dfc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-dfc-shadow-pop: 0 0 0 0.5px rgba(255, 253, 251, 0.12), 0 12px 28px -10px rgba(11, 9, 8, 0.6);--ui-dfc-focus: rgba(255, 138, 92, 0.5)}
:where(.dark, [data-theme="dark"]) .ui-dfc__pop{--ui-dfc-card: #27201a;--ui-dfc-secondary-hover: #2b231b}

`;
