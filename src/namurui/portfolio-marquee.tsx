"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

/*
 * Portfolio Marquee: two bands of wide work previews that drift in opposite directions, the first
 * travelling left and the second right, so the block reads as a pair rather than one strip.
 * The loop is a CSS transform on the track with the list rendered twice, which is what keeps the
 * wrap gapless; hovering or focusing a band holds it still, and a band nobody can see stops. Under
 * prefers-reduced-motion the drift is removed and each band becomes a scroller the reader drags by
 * hand. Styles are injected below, so no extra files are needed.
 */

export type WorkItem = {
  /** Stable key; the list renders twice, so it is used as the base of two keys */
  id: string;
  /** Project name, shown in the title bar of the default cell */
  name: string;
  /** Small tag beside the name, e.g. "Landing page" */
  category?: string;
  /** The preview itself; plain markup, since the component never sizes an image for you */
  shot?: ReactNode;
};

export type PortfolioMarqueeProps = {
  /** Two counter-running bands, or one */
  rows?: 2 | 1;
  /** The work, rendered twice per band so the loop has no gap at the wrap */
  items: WorkItem[];
  /** Travel speed in pixels per second; the duration is measured from the track width */
  speed?: number;
  /** Holds a band still while the pointer or keyboard focus is inside it */
  pauseOnHover?: boolean;
  /** Replaces the default cell; the wrapper still owns the cell width and the gap */
  renderItem?: (item: WorkItem) => ReactNode;
  /** Extra class on the root, for a host that needs another gap or band height */
  className?: string;
};

/* One pointer drag at a time, so the state lives outside React and the move handler never renders */
type DragState = {
  row: HTMLDivElement;
  pointerId: number;
  x: number;
  left: number;
};

export function PortfolioMarquee({
  rows = 2,
  items,
  speed = 60,
  pauseOnHover = true,
  renderItem,
  className,
}: PortfolioMarqueeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const setRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const movedRef = useRef(false);
  const [dragRow, setDragRow] = useState<number | null>(null);
  const [reduced, setReduced] = useState(false);

  const rowCount = rows === 1 ? 1 : 2;
  const count = items.length;

  /* The duration follows the measured set width, so six wide cells and twelve narrow ones travel
   * at the same number of pixels per second. It is written as a custom property because the same
   * loop length has to drive both bands. */
  useEffect(() => {
    const root = rootRef.current;
    const set = setRef.current;
    if (!root || !set) return;
    const apply = (width: number) => {
      if (!(width > 0)) return;
      const seconds = Math.min(240, Math.max(4, width / Math.max(1, speed)));
      root.style.setProperty("--ui-pmq-dur", `${Math.round(seconds * 10) / 10}s`);
    };
    apply(set.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => apply(entry.contentRect.width));
    });
    observer.observe(set);
    return () => observer.disconnect();
  }, [speed]);

  /* A loop nobody can see is a loop burning frames. The attribute is written directly so a scroll
   * does not re-render the block; the CSS rule that reads it also covers the hover pause. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let onScreen = true;
    let awake = true;
    const sync = () => {
      if (onScreen && awake) root.removeAttribute("data-held");
      else root.setAttribute("data-held", "true");
    };
    const onVisibility = () => {
      awake = !document.hidden;
      sync();
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            onScreen = entry.isIntersecting;
          });
          sync();
        },
        { rootMargin: "240px" },
      );
      observer.observe(root);
    }
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      observer?.disconnect();
    };
  }, []);

  /* The scroller only exists under reduced motion, so the drag is armed there and nowhere else.
   * Touch drags are left to the browser, which already scrolls the row natively. */
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const onPointerDown = (index: number) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!reduced || event.pointerType === "touch") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const row = event.currentTarget;
    if (row.scrollWidth <= row.clientWidth + 1) return;
    dragRef.current = { row, pointerId: event.pointerId, x: event.clientX, left: row.scrollLeft };
    movedRef.current = false;
    row.setPointerCapture(event.pointerId);
    setDragRow(index);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    if (Math.abs(dx) > 2) movedRef.current = true;
    drag.row.scrollLeft = drag.left - dx;
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (drag.row.hasPointerCapture(event.pointerId)) {
      drag.row.releasePointerCapture(event.pointerId);
    }
    setDragRow(null);
  };

  /* A drag that ends over a link must not also activate it. */
  const onClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!movedRef.current) return;
    movedRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  /* Row two starts on a different item, so the two bands never show the same previews side by side */
  const rotate = (offset: number) => {
    if (count === 0) return [];
    return Array.from({ length: count }, (_, index) => items[(index + offset) % count]);
  };

  const renderCell = (item: WorkItem, copy: "lead" | "clone") => (
    <div className="ui-pmq__cell" key={`${item.id}-${copy}`}>
      {renderItem ? (
        renderItem(item)
      ) : (
        <article className="ui-pmq__card">
          <div className="ui-pmq__shot" data-empty={item.shot ? undefined : "true"}>
            {item.shot}
          </div>
          <div className="ui-pmq__bar">
            <span className="ui-pmq__name" title={item.name}>
              {item.name}
            </span>
            {item.category ? <span className="ui-pmq__tag">{item.category}</span> : null}
          </div>
        </article>
      )}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={["ui-pmq", className].filter(Boolean).join(" ")}
      data-rows={rowCount}
      data-pause={pauseOnHover ? "true" : "false"}
      role="group"
      aria-label="Selected work"
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-portfolio-marquee" precedence="default">
        {css}
      </style>

      {Array.from({ length: rowCount }, (_, index) => {
        const band = rotate(index === 0 ? 0 : Math.ceil(count / 2));
        /* Both bands hold the same work in another order, and both have to stay hit-testable so
         * each one pauses on its own; only the wrapped copy inside a band is inert. A band takes
         * focus so the drift can be held without a pointer, which is the pause a keyboard reader
         * needs. */
        return (
          <div
            className="ui-pmq__row"
            key={`band-${index}`}
            role="group"
            aria-label={index === 0 ? "Work, first row" : "Work, second row"}
            data-direction={index === 0 ? "forward" : "reverse"}
            data-dragging={dragRow === index ? "true" : undefined}
            tabIndex={reduced || pauseOnHover ? 0 : undefined}
            onPointerDown={onPointerDown(index)}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClickCapture={onClickCapture}
          >
            <div className="ui-pmq__track">
              <div className="ui-pmq__set" ref={index === 0 ? setRef : undefined}>
                {band.map((item) => renderCell(item, "lead"))}
              </div>
              <div className="ui-pmq__set" data-clone="true" aria-hidden="true" inert={true}>
                {band.map((item) => renderCell(item, "clone"))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const css = /* css */ `
.ui-pmq {
  /* Knobs. Override any of these on .ui-pmq to retheme the block in a host; the loop length is
   * measured from the track, so use the speed prop rather than this token to change the pace. */
  --ui-pmq-ink: var(--text, #1a1410);
  --ui-pmq-muted: var(--text-muted, #6f625a);
  --ui-pmq-panel: var(--panel, #ffffff);
  --ui-pmq-shot: var(--preview, #fdfaf7);
  --ui-pmq-line: var(--border, #e8e0d7);
  --ui-pmq-line-strong: color-mix(in srgb, var(--text, #1a1410) 24%, transparent);
  --ui-pmq-line-soft: var(--border-soft, #1a14101a);
  --ui-pmq-tag: var(--muted-bg, #7a4a1c0a);
  --ui-pmq-accent: var(--accent, #c2410c);
  --ui-pmq-accent-soft: var(--accent-soft, #c2410c1f);
  --ui-pmq-lift: #1a141029;
  --ui-pmq-focus: var(--accent, #c2410c);
  --ui-pmq-gap: 1.25rem;
  --ui-pmq-row-h: clamp(15rem, 22vw + 9rem, 17.5rem);
  --ui-pmq-edge: clamp(1.5rem, 5vw, 3.5rem);
  --ui-pmq-cell-w: 22rem;
  --ui-pmq-dur: 38s;
  --ui-pmq-dur-fast: var(--nm-dur-2, 160ms);
  --ui-pmq-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));

  display: flex;
  flex-direction: column;
  gap: var(--ui-pmq-gap, 1.25rem);
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  color: var(--ui-pmq-ink, #1a1410);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  line-height: 18px;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-pmq *,
.ui-pmq *::before,
.ui-pmq *::after {
  box-sizing: border-box;
}

/* A band ------------------------------------------------------------------ */
/* The row is the clip. It takes the width the host gives it, so a 2232px track never widens the
 * page at 320px, it just shows less of it. Both ends fade instead of slicing a card through its
 * name, which is what makes the missing edge read as "this continues" rather than as a cut. */
.ui-pmq__row {
  position: relative;
  overflow: hidden;
  height: var(--ui-pmq-row-h, 17.5rem);
  min-width: 0;
  outline-offset: -2px;
  /* The cell is capped against the band, not the viewport: a 320px page hands the band ~230px
   * inside the host's padding, and a 86vw card there is wider than the clip, so no card is ever
   * seen whole. */
  container-type: inline-size;
  -webkit-mask-image: linear-gradient(
    90deg,
    transparent 0,
    #000 var(--ui-pmq-edge, 2rem),
    #000 calc(100% - var(--ui-pmq-edge, 2rem)),
    transparent 100%
  );
  mask-image: linear-gradient(
    90deg,
    transparent 0,
    #000 var(--ui-pmq-edge, 2rem),
    #000 calc(100% - var(--ui-pmq-edge, 2rem)),
    transparent 100%
  );
}
.ui-pmq__row:focus-visible {
  outline: 2px solid var(--ui-pmq-focus, #c2410c);
}

.ui-pmq__track {
  display: flex;
  height: 100%;
  width: max-content;
  /* A loop must not pulse, so it runs linear rather than on an ease token; the pace is set by the
   * measured duration instead. */
  animation: ui-pmq-scroll var(--ui-pmq-dur, 38s) linear infinite;
  will-change: transform;
}
/* Row two travels the other way. It starts at the far end, which is the same picture, because the
 * list is rendered twice. */
.ui-pmq__row[data-direction="reverse"] .ui-pmq__track {
  animation-direction: reverse;
}

/* Pause is a play state, never a removed animation: resuming has to continue from where it stopped
 * rather than jump back to the start. */
.ui-pmq[data-pause="true"] .ui-pmq__row:hover .ui-pmq__track,
.ui-pmq[data-pause="true"] .ui-pmq__row:focus-within .ui-pmq__track,
.ui-pmq[data-held="true"] .ui-pmq__track {
  animation-play-state: paused;
}

@keyframes ui-pmq-scroll {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(-50%, 0, 0);
  }
}

.ui-pmq__set {
  display: flex;
  flex: none;
  align-items: stretch;
  height: 100%;
}

/* A cell ------------------------------------------------------------------ */
.ui-pmq__cell {
  flex: none;
  width: min(var(--ui-pmq-cell-w, 22rem), 88cqw);
  height: 100%;
  margin-right: var(--ui-pmq-gap, 1.25rem);
}

.ui-pmq__card {
  display: flex;
  flex-direction: column;
  height: 100%;
  margin: 0;
  overflow: hidden;
  border-radius: var(--radius-preview, 12px);
  background: var(--ui-pmq-panel, #ffffff);
  box-shadow: inset 0 0 0 1px var(--ui-pmq-line, #e8e0d7);
  transition:
    box-shadow var(--ui-pmq-dur-fast, 160ms) var(--ui-pmq-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    transform var(--ui-pmq-dur-fast, 160ms) var(--ui-pmq-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-pmq__card:hover {
  box-shadow:
    inset 0 0 0 1px var(--ui-pmq-line-strong, #1a14103d),
    0 14px 28px -20px var(--ui-pmq-lift, #1a141029);
}

.ui-pmq__shot {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  background: var(--ui-pmq-shot, #fdfaf7);
}
.ui-pmq__shot[data-empty="true"] {
  box-shadow: inset 0 0 0 1px var(--ui-pmq-line-soft, #1a14101a);
}

/* The title bar is the only place a project is named, so it holds the name and the tag on one
 * line and lets the name truncate before the tag does. */
.ui-pmq__bar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  padding: 10px 12px;
  box-shadow: inset 0 1px 0 var(--ui-pmq-line-soft, #1a14101a);
}
.ui-pmq__name {
  min-width: 0;
  overflow: hidden;
  color: var(--ui-pmq-ink, #1a1410);
  font-size: 12.5px;
  font-weight: 600;
  line-height: 18px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-pmq__tag {
  flex: none;
  padding: 2px 7px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-pmq-tag, #7a4a1c0a);
  box-shadow: inset 0 0 0 1px var(--ui-pmq-line-soft, #1a14101a);
  color: var(--ui-pmq-muted, #6f625a);
  font-size: 11px;
  font-weight: 600;
  line-height: 15px;
  letter-spacing: 0.01em;
  white-space: nowrap;
  transition:
    color var(--ui-pmq-dur-fast, 160ms) var(--ui-pmq-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    background-color var(--ui-pmq-dur-fast, 160ms)
      var(--ui-pmq-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
/* The one live thing on the block is the cell under the pointer, and the tag is where it shows. */
.ui-pmq__card:hover .ui-pmq__tag {
  background: var(--ui-pmq-accent-soft, #c2410c1f);
  color: var(--ui-pmq-accent, #c2410c);
}

:where(.dark, [data-theme="dark"]) .ui-pmq {
  --ui-pmq-ink: var(--text, #f4ece4);
  --ui-pmq-muted: var(--text-muted, #a2958a);
  --ui-pmq-panel: var(--panel, #1a1512);
  --ui-pmq-line: var(--border, #33291f);
  --ui-pmq-line-soft: var(--border-soft, #ffffff12);
  --ui-pmq-tag: var(--muted-bg, #ffffff0d);
  --ui-pmq-accent: var(--accent, #ff6b35);
  --ui-pmq-accent-soft: var(--accent-soft, #ff6b3524);
  --ui-pmq-lift: #00000066;
  --ui-pmq-focus: var(--accent, #ff6b35);
}

/* A band this narrow cannot hold a name and a tag on one line without cutting the name, and the
 * name is what identifies the card; the tag steps aside and the accent moves to the card edge so
 * the live cell is still the one that shows it. */
@container (max-width: 340px) {
  .ui-pmq__tag {
    display: none;
  }
  .ui-pmq__card:hover {
    box-shadow: inset 0 0 0 2px var(--ui-pmq-accent, #c2410c);
  }
}

/* Without motion the bands stop drifting and become rows the reader scrolls by hand. The duplicate
 * set is dropped there, because a scroller has no wrap to hide. */
@media (prefers-reduced-motion: reduce) {
  .ui-pmq__track {
    animation: none;
    transform: none;
    will-change: auto;
  }
  .ui-pmq__set[data-clone="true"] {
    display: none;
  }
  .ui-pmq__row {
    /* A scroller shows a card whole at its left edge, so the fade that reads as "more to come"
     * on a drifting band would only eat the card being read. */
    -webkit-mask-image: none;
    mask-image: none;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x proximity;
    scrollbar-width: thin;
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
    cursor: grab;
    user-select: none;
  }
  .ui-pmq__row[data-dragging="true"] {
    cursor: grabbing;
  }
  .ui-pmq__cell {
    scroll-snap-align: start;
  }
  .ui-pmq__card,
  .ui-pmq__tag {
    transition-duration: 1ms;
  }
}
`;
