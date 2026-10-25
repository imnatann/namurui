"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

/*
 * Status Strip: the one row a host writes session status into — a chip per slot, the key in muted
 * small caps and the value in body ink, with anything past the visible count folded into a single
 * button that lists every slot. A cleared slot shrinks toward its left edge and fades before it
 * leaves the row, a filled slot fades in on the entry curve, and a slot whose value changed only
 * swaps its ink. The strip reports how many slots moved instead of reading every value again, and
 * with nothing left it takes no height. Styles are injected below, so no extra files are needed.
 */

export type StatusSlot = {
  /** Slot key, as the bridge names it — `model`, `branch`, `context` */
  key: string;
  /** Slot value; absent or empty clears the slot */
  text?: string;
};

export type StatusStripProps = {
  /** Slots in bridge order; a slot with no text is clearing */
  slots?: readonly StatusSlot[];
  /** Chips held in the row before the rest fold into a count */
  maxVisible?: number;
  /** Extra class on the root */
  className?: string;
};

/* A stable empty array, so an omitted `slots` does not read as a new payload on every render */
const NO_SLOTS: readonly StatusSlot[] = [];

type SlotItem = {
  key: string;
  text: string;
  phase: "in" | "out";
};

/* `setStatus` clears a slot by sending it without text, and a blank value is the same as none */
const hasText = (text: string | undefined): text is string =>
  typeof text === "string" && text.trim() !== "";

/* The row holds what is on screen, not what the payload holds: a slot that lost its text stays
 * for one more frame as an outgoing chip, and a slot dropped from the payload does the same, so
 * nothing ever leaves between two paints without its fade. */
function reconcile(items: readonly SlotItem[], slots: readonly StatusSlot[]): SlotItem[] {
  const live = new Map<string, string>();
  slots.forEach((slot) => {
    if (hasText(slot.text)) live.set(slot.key, slot.text);
  });

  const next: SlotItem[] = [];
  const placed = new Set<string>();
  slots.forEach((slot) => {
    if (placed.has(slot.key)) return;
    placed.add(slot.key);
    const text = live.get(slot.key);
    if (text !== undefined) {
      next.push({ key: slot.key, text, phase: "in" });
      return;
    }
    const before = items.find((item) => item.key === slot.key);
    if (before) next.push({ key: before.key, text: before.text, phase: "out" });
  });
  items.forEach((item) => {
    if (placed.has(item.key)) return;
    placed.add(item.key);
    next.push({ key: item.key, text: item.text, phase: "out" });
  });
  return next;
}

export function StatusStrip({ slots = NO_SLOTS, maxVisible = 5, className }: StatusStripProps) {
  const popId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const rows = useRef<Array<HTMLButtonElement | null>>([]);
  const seen = useRef<Map<string, string> | null>(null);
  const exits = useRef(new Map<string, number>());

  const [state, setState] = useState<{ source: readonly StatusSlot[]; items: SlotItem[] }>(() => ({
    source: slots,
    items: reconcile([], slots),
  }));
  const [pop, setPop] = useState<"closed" | "open" | "closing">("closed");
  const [announcement, setAnnouncement] = useState({ text: "", seq: 0 });

  /* Adjusted during render rather than in an effect: the chip that clears has to still be in the
   * list on the frame its text goes away, or the fade has nothing to start from. */
  const items = state.source === slots ? state.items : reconcile(state.items, slots);
  if (state.source !== slots) setState({ source: slots, items });

  const max = Number.isFinite(maxVisible) ? Math.max(0, Math.floor(maxVisible)) : 5;
  const shown = items.slice(0, max);
  const live = items.reduce((count, item) => count + (item.phase === "in" ? 1 : 0), 0);
  const shownLive = shown.reduce((count, item) => count + (item.phase === "in" ? 1 : 0), 0);
  const overflow = Math.max(0, live - shownLive);
  const empty = items.length === 0;

  const listed: StatusSlot[] = [];
  const listedKeys = new Set<string>();
  slots.forEach((slot) => {
    if (listedKeys.has(slot.key)) return;
    listedKeys.add(slot.key);
    listed.push(slot);
  });

  /* One pointerdown outside the strip, or Escape, closes the fold-out list. Escape hands focus
   * back to the button that opened it, so a keyboard never lands on nothing. */
  useEffect(() => {
    if (pop === "closed") return;
    const onDown = (event: PointerEvent) => {
      if (root.current && event.target instanceof Node && !root.current.contains(event.target)) {
        setPop("closing");
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setPop("closing");
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pop]);

  /* The first row takes focus, so the list is reachable without hunting for it. The index list is
   * dropped when the list closes, so a stale button is never focused after a reopen. */
  useEffect(() => {
    if (pop !== "open") {
      rows.current = [];
      return;
    }
    rows.current[0]?.focus();
  }, [pop]);

  /* A list with nothing left to fold has no reason to stay open. */
  useEffect(() => {
    if (overflow === 0 && pop !== "closed") setPop("closed");
  }, [overflow, pop]);

  /* The strip is the live region, so it reports the size of the change. Re-reading every value on
   * each push would bury the one thing that moved. */
  useEffect(() => {
    const next = new Map<string, string>();
    let withText = 0;
    slots.forEach((slot) => {
      const text = hasText(slot.text) ? slot.text : "";
      next.set(slot.key, text);
      if (text !== "") withText += 1;
    });
    const before = seen.current;
    seen.current = next;
    if (before === null) return;

    let changed = 0;
    next.forEach((text, key) => {
      if (before.get(key) !== text) changed += 1;
    });
    before.forEach((_, key) => {
      if (!next.has(key)) changed += 1;
    });
    if (changed === 0) return;

    const text =
      withText === 0
        ? "All status slots cleared"
        : `${changed} status slot${changed === 1 ? "" : "s"} updated`;
    setAnnouncement((current) => ({ text, seq: current.seq + 1 }));
  }, [slots]);

  /* A chip leaves on its own transition end; retiring it there, rather than in an effect keyed on
   * the payload, is what lets the fade finish before the row closes. */
  const retire = (key: string) => {
    const timer = exits.current.get(key);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      exits.current.delete(key);
    }
    setState((current) => ({
      source: current.source,
      items: current.items.filter((item) => !(item.key === key && item.phase === "out")),
    }));
  };

  /* A strip that is hidden mid-fade never fires a transition end, and a chip left behind would
   * hold its space invisibly. Each leaving chip gets its own timer as a floor under the fade. */
  useEffect(() => {
    const leaving = items.filter((item) => item.phase === "out").map((item) => item.key);
    leaving.forEach((key) => {
      if (exits.current.has(key)) return;
      exits.current.set(
        key,
        window.setTimeout(() => {
          exits.current.delete(key);
          setState((current) => ({
            source: current.source,
            items: current.items.filter((item) => !(item.key === key && item.phase === "out")),
          }));
        }, 420),
      );
    });
    const keep = new Set(leaving);
    Array.from(exits.current.keys()).forEach((key) => {
      if (keep.has(key)) return;
      window.clearTimeout(exits.current.get(key));
      exits.current.delete(key);
    });
  }, [items]);

  /* The timers outlive the strip only if they are not cleared on the way out. */
  useEffect(() => {
    const timers = exits.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const onPopKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") return;
    if (event.key === "Tab") {
      setPop("closing");
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const list = rows.current.filter((row): row is HTMLButtonElement => row !== null);
    if (list.length === 0) return;
    const current = list.findIndex((row) => row === document.activeElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    list[(current + step + list.length) % list.length]?.focus();
  };

  /* A repeated count is still a change, and an identical string is not announced twice, so the
   * report carries an alternating invisible marker to make each one distinct. */
  const announce = announcement.seq % 2 === 1 ? `${announcement.text}\u200B` : announcement.text;

  return (
    <div
      ref={root}
      className={["ui-sst", className].filter(Boolean).join(" ")}
      data-empty={empty ? "true" : undefined}
      role="status"
      aria-live="polite"
      aria-atomic="false"
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-status-strip" precedence="default">
        {css}
      </style>

      {/* The visible surface opts out of announcement: the hidden line below is what the live
       * region reads, so a push never re-reads five values to report one. */}
      <div className="ui-sst__surface" aria-live="off">
        <div className="ui-sst__row">
          {shown.map((item) => (
            <span
              key={item.key}
              className="ui-sst__chip"
              data-state={item.phase}
              title={`${item.key}: ${item.text}`}
              onTransitionEnd={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.propertyName !== "opacity") return;
                if (item.phase !== "out") return;
                retire(item.key);
              }}
            >
              <span className="ui-sst__key">{item.key}</span>
              <span className="ui-sst__value" title={item.text}>
                {item.text}
              </span>
            </span>
          ))}

          {overflow > 0 ? (
            <button
              type="button"
              ref={trigger}
              className="ui-sst__more"
              aria-expanded={pop === "open"}
              aria-controls={pop === "closed" ? undefined : popId}
              onClick={() => setPop((current) => (current === "open" ? "closing" : "open"))}
            >
              <span aria-hidden="true">+{overflow}</span>
              <span aria-hidden="true">more</span>
            </button>
          ) : null}
        </div>

        {overflow > 0 && pop !== "closed" ? (
          <div
            id={popId}
            className="ui-sst__pop"
            data-state={pop}
            role="group"
            aria-label="Every status slot"
            onKeyDown={onPopKeyDown}
            onTransitionEnd={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.propertyName !== "opacity") return;
              if (pop === "closing") setPop("closed");
            }}
          >
            {listed.map((slot, index) => (
              <button
                key={slot.key}
                type="button"
                ref={(node) => {
                  rows.current[index] = node;
                }}
                className="ui-sst__pop-row"
                data-empty={hasText(slot.text) ? undefined : "true"}
                title={hasText(slot.text) ? `${slot.key}: ${slot.text}` : `${slot.key}: no value`}
                onClick={() => {
                  setPop("closing");
                  trigger.current?.focus();
                }}
              >
                <span className="ui-sst__pop-key">{slot.key}</span>
                <span
                  className="ui-sst__pop-value"
                  title={hasText(slot.text) ? slot.text : undefined}
                >
                  {hasText(slot.text) ? slot.text : "—"}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <p className="ui-sst__announce">{announce}</p>
    </div>
  );
}

const css = /* css */ `
.ui-sst {
  /* Knobs. Override any of these on .ui-sst to retheme the strip in a host. */
  --ui-sst-ink: var(--text, #1a1410);
  --ui-sst-key: var(--text-muted, #6f625a);
  --ui-sst-panel: var(--panel, #fffdfb);
  --ui-sst-wash: #7a4a1c0a;
  --ui-sst-line: var(--border, #e8e0d7);
  --ui-sst-edge: var(--border-soft, #1a14101a);
  --ui-sst-lift: #1a141026;
  --ui-sst-focus: var(--accent, #c2410c);
  --ui-sst-dur: var(--nm-dur-3, 240ms);
  --ui-sst-dur-fast: var(--nm-dur-2, 160ms);
  --ui-sst-dur-pop: var(--nm-dur-4, 380ms);
  --ui-sst-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-sst-ease-in: var(--nm-ease-in, cubic-bezier(0.55, 0, 0.68, 0.19));
  --ui-sst-spring: var(--nm-spring, cubic-bezier(0.34, 1.56, 0.64, 1));

  position: relative;
  box-sizing: border-box;
  width: 100%;
  min-height: 32px;
  padding: 5px 8px;
  background: var(--ui-sst-wash);
  border-radius: var(--radius-preview, 12px);
  box-shadow: inset 0 0 0 1px var(--ui-sst-edge);
  color: var(--ui-sst-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 18px;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-sst *,
.ui-sst *::before,
.ui-sst *::after {
  box-sizing: border-box;
}
.ui-sst p {
  margin: 0;
}

/* Every slot cleared: the strip takes no height and holds nothing focusable, so a host can leave
 * it mounted in a chrome row without reserving the space for it. */
.ui-sst[data-empty="true"] {
  height: 0;
  min-height: 0;
  padding-top: 0;
  padding-bottom: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  box-shadow: none;
}

.ui-sst__surface {
  min-width: 0;
}
.ui-sst__row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  min-height: 22px;
}

/* A chip ------------------------------------------------------------------ */
.ui-sst__chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  max-width: 190px;
  height: 22px;
  padding: 0 8px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-sst-panel);
  box-shadow: inset 0 0 0 1px var(--ui-sst-line);
  white-space: nowrap;
  transform-origin: 0 50%;
  animation: ui-sst-chip-in var(--ui-sst-dur) var(--ui-sst-ease-out) backwards;
  transition:
    opacity var(--ui-sst-dur) var(--ui-sst-ease-out),
    transform var(--ui-sst-dur) var(--ui-sst-ease-out);
}
/* A cleared slot shrinks toward its own left edge and fades; it leaves the row on the fade's
 * transition end, so the row closes in one reflow instead of a width transition on every frame. */
.ui-sst__chip[data-state="out"] {
  opacity: 0;
  transform: translateY(-3px) scaleX(0.86);
  pointer-events: none;
  transition:
    opacity var(--ui-sst-dur) var(--ui-sst-ease-in),
    transform var(--ui-sst-dur) var(--ui-sst-ease-in);
}
@keyframes ui-sst-chip-in {
  from {
    opacity: 0;
    transform: translateY(3px) scale(0.96);
  }
}
.ui-sst__key {
  flex: none;
  overflow: hidden;
  color: var(--ui-sst-key);
  font-size: 9.5px;
  font-weight: 600;
  line-height: 14px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  text-overflow: ellipsis;
}
.ui-sst__value {
  min-width: 0;
  overflow: hidden;
  color: var(--ui-sst-ink);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
}

/* The fold-out trigger ---------------------------------------------------- */
.ui-sst__more {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
  height: 22px;
  margin: 0;
  padding: 0 8px;
  border: 0;
  border-radius: var(--radius-pill, 999px);
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--ui-sst-line);
  color: var(--ui-sst-key);
  font: inherit;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    color var(--ui-sst-dur-fast) var(--ui-sst-ease-out),
    background-color var(--ui-sst-dur-fast) var(--ui-sst-ease-out);
}
.ui-sst__more:hover,
.ui-sst__more[aria-expanded="true"] {
  background: var(--ui-sst-panel);
  color: var(--ui-sst-ink);
}
.ui-sst__more:focus-visible {
  outline: 2px solid var(--ui-sst-focus);
  outline-offset: 1px;
}

/* Every slot, folded out -------------------------------------------------- */
.ui-sst__pop {
  position: absolute;
  top: calc(100% + 6px);
  right: 6px;
  z-index: 40;
  display: grid;
  gap: 1px;
  width: max-content;
  min-width: 208px;
  max-width: min(320px, calc(100vw - 32px));
  max-height: 264px;
  overflow-y: auto;
  padding: 5px;
  background: var(--ui-sst-panel);
  border-radius: var(--radius-preview, 12px);
  box-shadow:
    inset 0 0 0 1px var(--ui-sst-line),
    0 18px 34px -20px var(--ui-sst-lift);
  transform-origin: 100% 0;
  animation: ui-sst-pop-in var(--ui-sst-dur-pop) var(--ui-sst-spring) backwards;
  transition:
    opacity var(--ui-sst-dur-fast) var(--ui-sst-ease-out),
    transform var(--ui-sst-dur-fast) var(--ui-sst-ease-out);
}
.ui-sst__pop[data-state="closing"] {
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
  pointer-events: none;
  transition:
    opacity var(--ui-sst-dur-fast) var(--ui-sst-ease-in),
    transform var(--ui-sst-dur-fast) var(--ui-sst-ease-in);
}
@keyframes ui-sst-pop-in {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.96);
  }
}
.ui-sst__pop-row {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  align-items: baseline;
  gap: 12px;
  width: 100%;
  margin: 0;
  padding: 6px 8px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--ui-sst-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background-color var(--ui-sst-dur-fast) var(--ui-sst-ease-out);
}
.ui-sst__pop-row:hover {
  background: var(--ui-sst-wash);
}
.ui-sst__pop-row:focus-visible {
  outline: 2px solid var(--ui-sst-focus);
  outline-offset: -2px;
}
.ui-sst__pop-key {
  overflow: hidden;
  color: var(--ui-sst-key);
  font-size: 9.5px;
  font-weight: 600;
  line-height: 16px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-sst__pop-value {
  min-width: 0;
  overflow: hidden;
  color: var(--ui-sst-ink);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-sst__pop-row[data-empty="true"] .ui-sst__pop-value {
  color: var(--ui-sst-key);
}

/* The live region reads this line, not the row ---------------------------- */
.ui-sst__announce {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  white-space: nowrap;
  border: 0;
  clip-path: inset(50%);
}

:where(.dark, [data-theme="dark"]) .ui-sst {
  --ui-sst-ink: var(--text, #f4ece4);
  --ui-sst-key: var(--text-muted, #a2958a);
  --ui-sst-panel: var(--panel, #1a1512);
  --ui-sst-wash: #ffffff0d;
  --ui-sst-line: var(--border, #33291f);
  --ui-sst-edge: var(--border-soft, #ffffff12);
  --ui-sst-lift: #00000066;
  --ui-sst-focus: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  .ui-sst__chip,
  .ui-sst__more,
  .ui-sst__pop,
  .ui-sst__pop-row {
    animation: none;
    transition-duration: 1ms;
  }
  .ui-sst__chip[data-state="out"],
  .ui-sst__pop[data-state="closing"] {
    transform: none;
  }
}
`;
