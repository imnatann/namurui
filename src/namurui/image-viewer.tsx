"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type TransitionEvent as ReactTransitionEvent,
} from "react";

/*
 * Image Viewer: a lightbox for the image blocks a run returns, whether they arrive as a
 * base64 data URI or a same-origin URL. The stage lifts from 0.96 as the scrim fades in, a
 * click takes the image to 2× where the frame can be dragged inside a clamped pan, and paging
 * stays on the arrow keys. Leaving fades only, so a close never rewinds the open. Styles are
 * injected below, so no extra files are needed.
 */

export type ImageViewerImage = {
  /** A same-origin URL or a `data:` URI */
  src: string;
  /** Alternative text, also read into the dialog's label */
  alt: string;
  /** Line shown under the stage */
  caption?: string;
};

export type ImageViewerProps = {
  /** Images to page through, in order */
  images: readonly ImageViewerImage[];
  /** Index to show; omit to let the viewer own it */
  index?: number;
  /** Whether the lightbox is showing; omit to let the viewer own it and open on mount */
  open?: boolean;
  /** Called with the new index after a page, an arrow key, Home or End */
  onIndexChange?: (index: number) => void;
  /** Called when Escape, a scrim click or the close button asks to dismiss */
  onClose?: () => void;
  /** Extra class on the root */
  className?: string;
};

/* The two stops a click moves between: fitted to the stage, and close enough to read a
 * glyph of the capture. */
const FIT = 1;
const CLOSE = 2;

/* Movement under this many pixels is still a click, not a drag. */
const SLOP = 3;

const ZERO = { x: 0, y: 0 };

const STEP_GLYPH: Record<"prev" | "next", ReactNode> = {
  prev: (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.8 3.6 5.4 8l4.4 4.4" />
    </svg>
  ),
  next: (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6.2 3.6 10.6 8l-4.4 4.4" />
    </svg>
  ),
};

const CLOSE_GLYPH = (
  <svg
    viewBox="0 0 16 16"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M4.2 4.2l7.6 7.6" />
    <path d="M11.8 4.2 4.2 11.8" />
  </svg>
);

const GET_GLYPH = (
  <svg
    viewBox="0 0 16 16"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M8 2.6v7.1" />
    <path d="M5.2 7 8 9.8 10.8 7" />
    <path d="M3.2 13h9.6" />
  </svg>
);

/* A data URI carries no name, so its subtype supplies the extension and the position the
 * stem; a URL keeps its own last segment. */
function downloadName(src: string, position: number): string {
  const data = /^data:image\/([a-z0-9.+-]+)/i.exec(src);
  if (data) {
    const subtype = data[1].toLowerCase().replace("+xml", "");
    return `image-${position + 1}.${subtype === "jpeg" ? "jpg" : subtype}`;
  }
  const tail = src.split(/[?#]/)[0].split("/").pop();
  return tail && tail.length > 0 ? tail : `image-${position + 1}`;
}

export function ImageViewer({
  images,
  index,
  open,
  onIndexChange,
  onClose,
  className,
}: ImageViewerProps) {
  const count = images.length;
  const ownedOpen = open === undefined;
  const ownedIndex = index === undefined;

  const [selfOpen, setSelfOpen] = useState(true);
  const [selfIndex, setSelfIndex] = useState(0);
  const showing = open ?? selfOpen;
  const asked = index ?? selfIndex;
  const current = count === 0 ? 0 : Math.min(Math.max(0, asked), count - 1);
  const image: ImageViewerImage | undefined = images[current];

  /* The lightbox outlives the prop by one exit fade, so a close reads as a fade rather than
   * a cut. `entered` holds the first frame at rest so the scale has somewhere to travel from. */
  const [present, setPresent] = useState(showing);
  const [entered, setEntered] = useState(false);

  const [zoom, setZoom] = useState(FIT);
  const [pan, setPan] = useState(ZERO);
  const [dragging, setDragging] = useState(false);
  /* The frame's own box and the stage that clips it. Both are read without their
   * transforms, so the pan limit stays exact at any aspect ratio. */
  const [box, setBox] = useState({ frameW: 0, frameH: 0, stageW: 0, stageH: 0 });
  const [reduced, setReduced] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ id: number; x: number; y: number; px: number; py: number } | null>(null);
  const movedRef = useRef(false);

  /* Reduced motion drops the zoom altogether: the image simply fits and the stage stays
   * put, which is the one state that needs no motion to be understood. */
  const scale = reduced ? FIT : zoom;
  const offset = scale === FIT ? ZERO : pan;
  const state = showing ? (entered ? "open" : "enter") : "leave";

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReduced(query.matches);
      if (query.matches) {
        setZoom(FIT);
        setPan(ZERO);
      }
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (showing) setPresent(true);
  }, [showing]);

  /* One frame at rest, then the stage is allowed to settle in */
  useEffect(() => {
    if (!present) {
      setEntered(false);
      return;
    }
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [present]);

  const close = useCallback(() => {
    if (ownedOpen) setSelfOpen(false);
    onClose?.();
  }, [ownedOpen, onClose]);

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return;
      const target = Math.min(Math.max(0, next), count - 1);
      if (!ownedIndex) setSelfIndex(target);
      if (target !== current) onIndexChange?.(target);
    },
    [count, current, ownedIndex, onIndexChange],
  );

  /* The keyboard reads the latest handlers through a ref, so paging never re-runs the trap
   * and never steals focus back to the close button. */
  const live = useRef({ close, goTo, current, count });
  useEffect(() => {
    live.current = { close, goTo, current, count };
  }, [close, goTo, current, count]);

  /* Focus enters on the close button, Tab cycles inside the dialog, and the trigger that
   * opened the viewer gets focus back the moment a close is asked for. */
  useEffect(() => {
    if (!present || !showing || typeof document === "undefined") return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const items = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'),
      ).filter((node) => node.getClientRects().length > 0);

    dialog.querySelector<HTMLElement>('[data-imv-close="true"]')?.focus();

    const onKey = (event: KeyboardEvent) => {
      const { close: shut, goTo: move, current: at, count: total } = live.current;

      if (event.key === "Escape") {
        event.preventDefault();
        shut();
        return;
      }
      if (total > 1) {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          move(at + 1);
          return;
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          move(at - 1);
          return;
        }
        if (event.key === "Home") {
          event.preventDefault();
          move(0);
          return;
        }
        if (event.key === "End") {
          event.preventDefault();
          move(total - 1);
          return;
        }
      }
      if (event.key !== "Tab") return;

      const focusable = items();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      const active = document.activeElement;
      const outside = active === null || !dialog.contains(active);
      if (event.shiftKey) {
        if (outside || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (outside || active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (returnTo && document.contains(returnTo)) returnTo.focus();
    };
  }, [present, showing]);

  /* The pan limit is what the frame overhangs the stage by, measured without transforms,
   * so at 2× the frame may travel exactly to the point where an edge would show and stops
   * there. Both boxes are observed: a narrow image on a wider stage still clamps right. */
  useEffect(() => {
    if (!present) return;
    const el = imgRef.current;
    const stage = stageRef.current;
    if (!el || !stage) return;
    const measure = () =>
      setBox({
        frameW: el.offsetWidth,
        frameH: el.offsetHeight,
        stageW: stage.clientWidth,
        stageH: stage.clientHeight,
      });
    measure();
    el.addEventListener("load", measure);
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      observer.observe(el);
      observer.observe(stage);
    }
    return () => {
      el.removeEventListener("load", measure);
      observer?.disconnect();
    };
  }, [present, current]);

  /* A new image starts fitted; a shrinking stage pulls the pan back inside its limit. */
  useEffect(() => {
    setZoom(FIT);
    setPan(ZERO);
  }, [current]);

  useEffect(() => {
    const limitX = Math.max(0, (box.frameW * scale - box.stageW) / 2);
    const limitY = Math.max(0, (box.frameH * scale - box.stageH) / 2);
    setPan((value) => {
      const x = Math.min(Math.max(value.x, -limitX), limitX);
      const y = Math.min(Math.max(value.y, -limitY), limitY);
      return x === value.x && y === value.y ? value : { x, y };
    });
  }, [box.frameW, box.frameH, box.stageW, box.stageH, scale]);

  const toggleZoom = () => {
    if (reduced) return;
    setZoom((value) => (value === FIT ? CLOSE : FIT));
    setPan(ZERO);
  };

  const onFrameClick = () => {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    toggleZoom();
  };

  const onFrameDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (scale === FIT || reduced) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    movedRef.current = false;
    dragRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      px: offset.x,
      py: offset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const onFrameMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) > SLOP || Math.abs(dy) > SLOP) movedRef.current = true;
    /* The frame travels only as far as its overhang allows, so a drag that keeps going
     * simply stops instead of rubber-banding an edge into view. */
    const limitX = Math.max(0, (box.frameW * scale - box.stageW) / 2);
    const limitY = Math.max(0, (box.frameH * scale - box.stageH) / 2);
    setPan({
      x: Math.min(Math.max(drag.px + dx, -limitX), limitX),
      y: Math.min(Math.max(drag.py + dy, -limitY), limitY),
    });
  };

  const onFrameUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  };

  const onFadeEnd = (event: ReactTransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== "opacity") return;
    if (!showing) setPresent(false);
  };

  if (!present || !image) return null;

  const hint = reduced
    ? count > 1
      ? "← → to page · Esc to close"
      : "Esc to close"
    : count > 1
      ? "Click the image for 2× · ← → to page · Esc to close"
      : "Click the image for 2× · Esc to close";

  return (
    <div
      className={["ui-imv", className].filter(Boolean).join(" ")}
      data-state={state}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      onTransitionEnd={onFadeEnd}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-image-viewer" precedence="default">
        {css}
      </style>

      <div
        className="ui-imv__dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={count > 1 ? `Image ${current + 1} of ${count}: ${image.alt}` : `Image: ${image.alt}`}
        inert={!showing}
      >
        <div className="ui-imv__bar">
          <div className="ui-imv__meta">
            <p className="ui-imv__count" role="status" aria-live="polite">
              <span className="ui-imv__count-now">{current + 1}</span>
              {" / "}
              <span className="ui-imv__count-of">{count}</span>
            </p>
            {scale === CLOSE ? (
              <span className="ui-imv__zoomtag">2×</span>
            ) : null}
          </div>

          <div className="ui-imv__tools">
            <a
              className="ui-imv__get"
              href={image.src}
              download={downloadName(image.src, current)}
              title={`Download ${downloadName(image.src, current)}`}
            >
              {GET_GLYPH}
              <span className="ui-imv__get-word">Download</span>
            </a>
            <button
              type="button"
              className="ui-imv__close"
              data-imv-close="true"
              aria-label="Close image viewer"
              onClick={close}
            >
              {CLOSE_GLYPH}
            </button>
          </div>
        </div>

        <div className="ui-imv__stage" ref={stageRef}>
          {count > 1 ? (
            <>
              <button
                type="button"
                className="ui-imv__step"
                data-side="prev"
                aria-label="Previous image"
                disabled={current === 0}
                onClick={() => goTo(current - 1)}
              >
                {STEP_GLYPH.prev}
              </button>
              <button
                type="button"
                className="ui-imv__step"
                data-side="next"
                aria-label="Next image"
                disabled={current === count - 1}
                onClick={() => goTo(current + 1)}
              >
                {STEP_GLYPH.next}
              </button>
            </>
          ) : null}

          <button
            type="button"
            className="ui-imv__frame"
            data-zoomed={scale === CLOSE ? "true" : undefined}
            data-dragging={dragging ? "true" : undefined}
            aria-label={
              reduced
                ? image.alt
                : scale === CLOSE
                  ? "Fit the image to the stage"
                  : "Zoom the image to 2×"
            }
            title={reduced ? "Zoom is off while motion is reduced" : undefined}
            disabled={reduced}
            onClick={onFrameClick}
            onPointerDown={onFrameDown}
            onPointerMove={onFrameMove}
            onPointerUp={onFrameUp}
            onPointerCancel={onFrameUp}
            style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})` }}
          >
            <img
              className="ui-imv__img"
              ref={imgRef}
              src={image.src}
              alt={image.alt}
              draggable={false}
            />
          </button>
        </div>

        <div className="ui-imv__foot">
          <p className="ui-imv__caption">{image.caption ?? image.alt}</p>
          <p className="ui-imv__hint">{hint}</p>
        </div>
      </div>
    </div>
  );
}

const css = /* css */ `
.ui-imv {
  /* Knobs. Override any of these on .ui-imv to retheme the lightbox in a host. */
  --ui-imv-ink: var(--text, #1a1410);
  --ui-imv-muted: var(--text-muted, #6f625a);
  --ui-imv-scrim: #faf7f4f2;
  --ui-imv-panel: var(--panel, #fffdfb);
  --ui-imv-plate: #1a14100a;
  --ui-imv-line: var(--border, #e8e0d7);
  --ui-imv-edge: var(--border-soft, #1a14101a);
  --ui-imv-wash: #7a4a1c0f;
  --ui-imv-accent: var(--accent, #c2410c);
  --ui-imv-focus: var(--accent, #c2410c);
  --ui-imv-shadow: #1a141033;
  --ui-imv-ease: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-imv-ease-in: var(--nm-ease-in, cubic-bezier(0.55, 0, 0.68, 0.19));
  --ui-imv-ease-both: var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1));
  --ui-imv-spring: var(--nm-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  --ui-imv-dur: var(--nm-dur-3, 240ms);
  --ui-imv-dur-stage: var(--nm-dur-4, 380ms);
  --ui-imv-dur-hover: var(--nm-dur-2, 160ms);

  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: clamp(12px, 3.5vh, 36px) clamp(12px, 3.5vw, 36px);
  background: var(--ui-imv-scrim);
  color: var(--ui-imv-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 18px;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
  overscroll-behavior: contain;
  opacity: 0;
  transition: opacity var(--ui-imv-dur) var(--ui-imv-ease);
}
.ui-imv *,
.ui-imv *::before,
.ui-imv *::after {
  box-sizing: border-box;
}
.ui-imv[data-state="open"] {
  opacity: 1;
}
/* Leaving fades only: the stage has already settled, so there is nothing to rewind. The
 * overlay stops taking clicks the instant a close is asked for, so even a stalled fade can
 * never leave the page underneath unreachable. */
.ui-imv[data-state="leave"] {
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--ui-imv-dur) var(--ui-imv-ease-in);
}
.ui-imv p {
  margin: 0;
}
:where(.ui-imv) button {
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
:where(.ui-imv) svg {
  display: block;
}

/* Shell -------------------------------------------------------------------- */
.ui-imv__dialog {
  position: relative;
  display: grid;
  gap: 10px;
  width: max-content;
  max-width: min(92vw, 1160px);
  min-width: min(340px, 86vw);
  transform: scale(0.96);
  opacity: 0;
  transition:
    transform var(--ui-imv-dur-stage) var(--ui-imv-ease),
    opacity var(--ui-imv-dur-stage) var(--ui-imv-ease);
}
.ui-imv[data-state="open"] .ui-imv__dialog {
  transform: none;
  opacity: 1;
}
.ui-imv[data-state="leave"] .ui-imv__dialog {
  transform: none;
  opacity: 0;
  transition: opacity var(--ui-imv-dur) var(--ui-imv-ease-in);
}

/* Bar ---------------------------------------------------------------------- */
.ui-imv__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 30px;
  padding: 0 2px;
}
.ui-imv__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.ui-imv__count {
  display: block;
  color: var(--ui-imv-muted);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.ui-imv__count-now {
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-imv-ink);
}
.ui-imv__zoomtag {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 7px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-imv-wash);
  box-shadow: inset 0 0 0 1px var(--ui-imv-edge);
  color: var(--ui-imv-accent);
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  animation: ui-imv-pop var(--ui-imv-dur) var(--ui-imv-spring);
}
@keyframes ui-imv-pop {
  from {
    transform: scale(0.86);
    opacity: 0;
  }
  to {
    transform: none;
    opacity: 1;
  }
}
.ui-imv__tools {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
}
.ui-imv__get,
.ui-imv__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-imv-wash);
  box-shadow: inset 0 0 0 1px var(--ui-imv-edge);
  color: var(--ui-imv-muted);
  font-size: 11.5px;
  line-height: 16px;
  text-decoration: none;
  transition:
    color var(--ui-imv-dur-hover) var(--ui-imv-ease),
    box-shadow var(--ui-imv-dur-hover) var(--ui-imv-ease);
}
.ui-imv__close {
  width: 28px;
  padding: 0;
}
.ui-imv__get:hover,
.ui-imv__close:hover {
  color: var(--ui-imv-ink);
  box-shadow: inset 0 0 0 1px var(--ui-imv-muted);
}
.ui-imv__get:focus-visible,
.ui-imv__close:focus-visible,
.ui-imv__step:focus-visible,
.ui-imv__frame:focus-visible {
  outline: 2px solid var(--ui-imv-focus);
  outline-offset: 2px;
}

/* Stage -------------------------------------------------------------------- */
.ui-imv__stage {
  position: relative;
  display: grid;
  place-items: center;
  justify-self: center;
  min-width: min(300px, 74vw);
  min-height: 200px;
  max-width: 100%;
  overflow: hidden;
  border-radius: var(--radius-card, 16px);
  background: var(--ui-imv-plate);
  box-shadow:
    inset 0 0 0 1px var(--ui-imv-edge),
    0 26px 64px -34px var(--ui-imv-shadow);
}
.ui-imv__frame {
  display: block;
  width: fit-content;
  max-width: 100%;
  border-radius: var(--radius-preview, 12px);
  cursor: zoom-in;
  transform-origin: 50% 50%;
  transition: transform var(--ui-imv-dur) var(--ui-imv-ease-both);
  will-change: transform;
}
.ui-imv__frame[data-zoomed="true"] {
  cursor: grab;
  touch-action: none;
}
.ui-imv__frame[data-dragging="true"] {
  cursor: grabbing;
  transition: none;
}
.ui-imv__frame:disabled {
  cursor: default;
}
.ui-imv__img {
  display: block;
  width: auto;
  height: auto;
  max-width: min(88vw, 1100px);
  max-height: min(66vh, 720px);
  border-radius: var(--radius-preview, 12px);
  user-select: none;
  -webkit-user-drag: none;
}
.ui-imv__step {
  position: absolute;
  top: 50%;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-imv-panel);
  box-shadow:
    inset 0 0 0 1px var(--ui-imv-line),
    0 8px 22px -12px var(--ui-imv-shadow);
  color: var(--ui-imv-ink);
  transform: translateY(-50%);
  transition:
    box-shadow var(--ui-imv-dur-hover) var(--ui-imv-ease),
    opacity var(--ui-imv-dur-hover) var(--ui-imv-ease);
}
.ui-imv__step[data-side="prev"] {
  left: 10px;
}
.ui-imv__step[data-side="next"] {
  right: 10px;
}
.ui-imv__step:hover:not(:disabled) {
  box-shadow:
    inset 0 0 0 1px var(--ui-imv-muted),
    0 8px 22px -12px var(--ui-imv-shadow);
}
.ui-imv__step:disabled {
  opacity: 0.28;
  cursor: default;
}

/* Foot --------------------------------------------------------------------- */
.ui-imv__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 18px;
  padding: 0 2px;
}
.ui-imv__caption {
  max-width: 62ch;
  color: var(--ui-imv-ink);
  font-size: 12.5px;
  line-height: 19px;
}
.ui-imv__hint {
  flex: none;
  color: var(--ui-imv-muted);
  font-size: 11px;
  line-height: 16px;
}

:where(.dark, [data-theme="dark"]) .ui-imv {
  --ui-imv-ink: var(--text, #f4ece4);
  --ui-imv-muted: var(--text-muted, #a2958a);
  --ui-imv-scrim: #0d0a08f2;
  --ui-imv-panel: var(--panel, #1a1512);
  --ui-imv-plate: #ffffff0a;
  --ui-imv-line: var(--border, #33291f);
  --ui-imv-edge: var(--border-soft, #ffffff14);
  --ui-imv-wash: #ffffff0d;
  --ui-imv-accent: var(--accent, #ff6b35);
  --ui-imv-focus: var(--accent, #ff6b35);
  --ui-imv-shadow: #0d0a08cc;
}

@media (prefers-reduced-motion: reduce) {
  .ui-imv,
  .ui-imv[data-state="leave"],
  .ui-imv .ui-imv__dialog,
  .ui-imv[data-state="leave"] .ui-imv__dialog,
  .ui-imv__frame,
  .ui-imv__step,
  .ui-imv__get,
  .ui-imv__close {
    transition-duration: 1ms;
  }
  .ui-imv__zoomtag {
    animation: none;
  }
  .ui-imv__dialog {
    transform: none;
  }
}
`;
