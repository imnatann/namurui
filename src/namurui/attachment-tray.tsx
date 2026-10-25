"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/*
 * Attachment Tray: the files the composer will send with the next prompt, one chip each.
 * A chip enters on the spring step when the bridge takes it, and leaves on the ease-in
 * half while its neighbours are pushed back to their old positions and released, so the
 * row slides into its new shape instead of snapping. The uploading chip carries a
 * determinate bar along its bottom edge — ember, the one live thing on the strip.
 * Styles are injected below, so no extra files are needed.
 */

export type AttachmentState = "uploading" | "ready" | "rejected";

export type AttachmentFile = {
  /** Stable id; the tray reports it back on remove, retry and open */
  id: string;
  /** File name as it appears on disk */
  name: string;
  /** Size in bytes, before the bridge encodes it */
  sizeBytes: number;
  /** MIME type the bridge will report to the model */
  mimeType: string;
  /** Fraction uploaded, 0..1; only meaningful while uploading */
  progress?: number;
  /** Where the file sits in the attach cycle */
  state: AttachmentState;
  /** Why the bridge refused it; shown on a second line under a rejected chip */
  reason?: string;
};

export type AttachmentTrayProps = {
  /** Files in composer order */
  files: readonly AttachmentFile[];
  /** Called with the file id once its exit has played */
  onRemove: (id: string) => void;
  /** Called to offer a rejected file to the bridge again */
  onRetry?: (id: string) => void;
  /** Called when a ready file is opened in the viewer */
  onOpen?: (id: string) => void;
  /** Chips shown before the remainder folds into a +N chip */
  maxVisible?: number;
  /** Extra class on the root */
  className?: string;
};

/* A sheet with a folded corner: any file the bridge will not render as an image */
const FILE_GLYPH: ReactNode = (
  <svg
    viewBox="0 0 14 14"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3.4 1.9h4.1l3.1 3.1v7.1H3.4z" />
    <path d="M7.5 1.9v3.1h3.1" />
  </svg>
);

/* The thumbnail block for an image: a frame with a horizon inside it */
const IMAGE_GLYPH: ReactNode = (
  <svg
    viewBox="0 0 14 14"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="1.9" y="2.6" width="10.2" height="8.8" rx="1.4" />
    <circle cx="5" cy="5.7" r="0.9" fill="currentColor" stroke="none" />
    <path d="M2.4 9.8 5.3 7l2.1 2.1 1.6-1.5 2.6 2.4" />
  </svg>
);

const CROSS: ReactNode = (
  <svg
    viewBox="0 0 10 10"
    width="10"
    height="10"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M2.2 2.2 7.8 7.8" />
    <path d="M7.8 2.2 2.2 7.8" />
  </svg>
);

const PLUS: ReactNode = (
  <svg
    viewBox="0 0 10 10"
    width="10"
    height="10"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M5 1.6v6.8" />
    <path d="M1.6 5h6.8" />
  </svg>
);

const MINUS: ReactNode = (
  <svg
    viewBox="0 0 10 10"
    width="10"
    height="10"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M1.6 5h6.8" />
  </svg>
);

const REJECT_FALLBACK = "could not be attached";

/* The exit runs on --nm-dur-3, so the removal lands as the transform settles */
const EXIT_MS = 240;

/* MIME subtypes that read badly on their own get the extension a person would say */
const KIND_WORD: Record<string, string> = {
  plain: "TXT",
  markdown: "MD",
  json: "JSON",
  zip: "ZIP",
  pdf: "PDF",
  png: "PNG",
  jpeg: "JPG",
  gif: "GIF",
  svg: "SVG",
  xml: "XML",
};

/* Two significant digits is all a chip can hold; the ceiling and the reason carry the
 * exact figure when it matters. */
function formatSize(bytes: number): string {
  const value = Math.max(0, bytes);
  if (value < 1024) return `${Math.round(value)} B`;
  let size = value / 1024;
  let unit = 0;
  const units = ["KB", "MB", "GB"];
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 ? Math.round(size) : (Math.round(size * 10) / 10).toFixed(1)} ${units[unit]}`;
}

function kindWord(mimeType: string): string {
  const subtype = mimeType.split("/")[1]?.split("+")[0] ?? "";
  return KIND_WORD[subtype] ?? subtype.toUpperCase().slice(0, 5);
}

export function AttachmentTray({
  files,
  onRemove,
  onRetry,
  onOpen,
  maxVisible = 4,
  className,
}: AttachmentTrayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const rectsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const timersRef = useRef<number[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [leaving, setLeaving] = useState<readonly string[]>([]);

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    },
    [],
  );

  /* Positions are read before a structural change and replayed after it: every chip
   * that survives is pushed back to where it was and released on the shared curve, so
   * the row slides into its new shape while the removed chip leaves under its own
   * transform. A progress tick moves no chips, so the snapshot survives it. The replay
   * runs before paint, so the row never flashes at its new positions first. */
  useLayoutEffect(() => {
    const before = rectsRef.current;
    if (before.size === 0) return;
    const root = rootRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-chip-id]"));
    const ids = items.map((el) => el.dataset.chipId ?? "");
    if (ids.length === before.size && ids.every((id) => before.has(id))) return;
    rectsRef.current = new Map();
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    /* The custom properties resolve to a var() chain, so the literal fallback from the
     * token scale is the value the browser will actually use here. */
    const duration = 240;
    const easing = "cubic-bezier(0.65, 0, 0.35, 1)";

    items.forEach((el) => {
      const previous = before.get(el.dataset.chipId ?? "");
      if (!previous) return;
      const next = el.getBoundingClientRect();
      const dx = previous.x - next.x;
      const dy = previous.y - next.y;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: "translate(0px, 0px)" },
        ],
        { duration, easing },
      );
    });
  }, [files, expanded]);

  const snapshot = () => {
    const root = rootRef.current;
    if (!root) return;
    const next = new Map<string, { x: number; y: number }>();
    root.querySelectorAll<HTMLElement>("[data-chip-id]").forEach((el) => {
      const id = el.dataset.chipId;
      if (!id) return;
      const rect = el.getBoundingClientRect();
      next.set(id, { x: rect.left, y: rect.top });
    });
    rectsRef.current = next;
  };

  const remove = (id: string) => {
    snapshot();
    setLeaving((current) => (current.includes(id) ? current : [...current, id]));
    const instant =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(
      () => {
        timersRef.current = timersRef.current.filter((entry) => entry !== timer);
        setLeaving((current) => current.filter((entry) => entry !== id));
        onRemove(id);
      },
      instant ? 0 : EXIT_MS,
    );
    timersRef.current.push(timer);
  };

  const toggle = () => {
    snapshot();
    setExpanded((current) => !current);
  };

  const limit = Math.max(1, Math.floor(maxVisible));
  const overflow = Math.max(0, files.length - limit);
  const shown = expanded ? files : files.slice(0, limit);
  const hidden = Math.max(0, files.length - shown.length);
  const uploading = files.filter((file) => file.state === "uploading").length;
  const rejected = files.filter((file) => file.state === "rejected").length;

  const live =
    files.length === 0
      ? "No attachments"
      : `${files.length} attachment${files.length === 1 ? "" : "s"}` +
        (uploading > 0 ? `, ${uploading} uploading` : "") +
        (rejected > 0 ? `, ${rejected} rejected` : "");

  return (
    <div ref={rootRef} className={["ui-atz", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-attachment-tray" precedence="default">
        {css}
      </style>

      <ul className="ui-atz__list" role="list" aria-label="Attachments">
        {shown.map((file) => {
          const percent = Math.round(
            Math.min(1, Math.max(0, file.progress ?? 0)) * 100,
          );
          const body = (
            <>
              <span
                className="ui-atz__thumb"
                data-image={file.mimeType.startsWith("image/") ? "true" : undefined}
                aria-hidden="true"
              >
                {file.mimeType.startsWith("image/") ? IMAGE_GLYPH : FILE_GLYPH}
              </span>
              <span className="ui-atz__text">
                <span className="ui-atz__name" title={file.name}>
                  {file.name}
                </span>
                {file.state === "rejected" ? (
                  <span className="ui-atz__reason" title={file.reason ?? REJECT_FALLBACK}>
                    {file.reason ?? REJECT_FALLBACK}
                  </span>
                ) : (
                  <span className="ui-atz__meta">
                    {file.state === "uploading"
                      ? `Uploading ${percent}% · ${formatSize(file.sizeBytes)}`
                      : `${formatSize(file.sizeBytes)} · ${kindWord(file.mimeType)}`}
                  </span>
                )}
              </span>
            </>
          );

          return (
            <li key={file.id} className="ui-atz__item" data-chip-id={file.id}>
              <div
                className="ui-atz__chip"
                data-state={file.state}
                data-leaving={leaving.includes(file.id) ? "true" : undefined}
              >
                {file.state === "ready" && onOpen ? (
                  <button
                    type="button"
                    className="ui-atz__open"
                    aria-label={`Open ${file.name}`}
                    onClick={() => onOpen(file.id)}
                  >
                    {body}
                  </button>
                ) : (
                  <span className="ui-atz__open">{body}</span>
                )}

                {file.state === "rejected" && onRetry ? (
                  <button
                    type="button"
                    className="ui-atz__retry"
                    aria-label={`Retry ${file.name}`}
                    onClick={() => onRetry(file.id)}
                  >
                    Retry
                  </button>
                ) : null}

                <button
                  type="button"
                  className="ui-atz__remove"
                  aria-label={`Remove ${file.name}`}
                  title={`Remove ${file.name}`}
                  onClick={() => remove(file.id)}
                >
                  {CROSS}
                </button>

                {file.state === "uploading" ? (
                  <span
                    className="ui-atz__bar"
                    role="progressbar"
                    aria-label={`Uploading ${file.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                    aria-valuetext={`${percent}% uploaded`}
                  >
                    <span
                      className="ui-atz__bar-fill"
                      style={{ transform: `scaleX(${percent / 100})` }}
                    />
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}

        {overflow > 0 ? (
          <li className="ui-atz__item" data-chip-id="__more">
            <button
              type="button"
              className="ui-atz__more"
              aria-expanded={expanded}
              aria-label={
                expanded
                  ? "Show fewer attachments"
                  : `Show ${hidden} more attachment${hidden === 1 ? "" : "s"}`
              }
              onClick={toggle}
            >
              <span className="ui-atz__more-glyph" aria-hidden="true">
                {expanded ? MINUS : PLUS}
              </span>
              <span className="ui-atz__more-label">
                {expanded ? "Fewer" : `+${hidden}`}
              </span>
            </button>
          </li>
        ) : null}
      </ul>

      {files.length === 0 ? (
        <p className="ui-atz__empty">
          Nothing attached. Images and files sent with the next prompt appear here.
        </p>
      ) : null}

      <p className="ui-atz__live" role="status" aria-live="polite">
        {live}
      </p>
    </div>
  );
}

const css = /* css */ `
.ui-atz {
  /* Knobs. Override any of these on .ui-atz to retheme the strip in a host. */
  --ui-atz-ink: var(--text, #1a1410);
  --ui-atz-muted: var(--text-muted, #6f625a);
  --ui-atz-subtle: var(--text-subtle, #8a7d73);
  --ui-atz-chip: var(--panel, #fffdfb);
  --ui-atz-line: var(--border, #e8e0d7);
  --ui-atz-edge: var(--border-soft, #1a14101a);
  --ui-atz-wash: #7a4a1c0a;
  --ui-atz-thumb: #7a4a1c10;
  --ui-atz-accent: var(--accent, #c2410c);
  --ui-atz-danger: var(--danger, #b3261e);
  --ui-atz-danger-edge: #b3261e2e;
  --ui-atz-focus: var(--accent, #c2410c);
  --ui-atz-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-atz-ease-in: var(--nm-ease-in, cubic-bezier(0.55, 0, 0.68, 0.19));
  --ui-atz-ease-both: var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1));
  --ui-atz-spring: var(--nm-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  --ui-atz-dur-1: var(--nm-dur-1, 90ms);
  --ui-atz-dur-2: var(--nm-dur-2, 160ms);
  --ui-atz-dur-3: var(--nm-dur-3, 240ms);
  --ui-atz-radius: 8px;

  box-sizing: border-box;
  width: 100%;
  color: var(--ui-atz-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 18px;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-atz *,
.ui-atz *::before,
.ui-atz *::after {
  box-sizing: border-box;
}
:where(.ui-atz) button {
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
:where(.ui-atz) svg {
  display: block;
}

/* The row ---------------------------------------------------------------- */
.ui-atz__list {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
/* Only the position the browser measured is animated here; width never moves. */
.ui-atz__item {
  min-width: 0;
  max-width: 100%;
}

.ui-atz__chip {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
  max-width: 100%;
  min-height: 36px;
  padding: 4px 4px 4px 5px;
  overflow: hidden;
  background: var(--ui-atz-chip);
  border-radius: var(--ui-atz-radius);
  box-shadow: inset 0 0 0 1px var(--ui-atz-line);
  /* The chip is new to the composer, so it arrives on the attach curve and settles. */
  animation: ui-atz-in var(--ui-atz-dur-3) var(--ui-atz-spring) backwards;
  transition:
    opacity var(--ui-atz-dur-3) var(--ui-atz-ease-out),
    transform var(--ui-atz-dur-3) var(--ui-atz-ease-out),
    box-shadow var(--ui-atz-dur-2) var(--ui-atz-ease-out);
}
@keyframes ui-atz-in {
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.92);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.ui-atz__chip[data-state="rejected"] {
  box-shadow: inset 0 0 0 1px var(--ui-atz-danger-edge);
}
/* Removal is its own half of the interaction: it leaves on the in-curve while the
 * survivors are repositioned, so the row never rewinds. */
.ui-atz__chip[data-leaving="true"] {
  opacity: 0;
  transform: translateY(6px) scale(0.94);
  pointer-events: none;
  transition:
    opacity var(--ui-atz-dur-3) var(--ui-atz-ease-in),
    transform var(--ui-atz-dur-3) var(--ui-atz-ease-in);
}

/* The body of a chip ----------------------------------------------------- */
.ui-atz__open {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding-right: 2px;
  border-radius: 6px;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: default;
}
:where(.ui-atz) button.ui-atz__open {
  cursor: pointer;
}
.ui-atz__thumb {
  display: grid;
  flex: none;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  color: var(--ui-atz-subtle);
  transition: opacity var(--ui-atz-dur-2) var(--ui-atz-ease-out);
}
.ui-atz__thumb[data-image="true"] {
  background: var(--ui-atz-thumb);
  box-shadow: inset 0 0 0 1px var(--ui-atz-edge);
  color: var(--ui-atz-muted);
}
.ui-atz__text {
  display: grid;
  gap: 1px;
  min-width: 0;
}
.ui-atz__name {
  max-width: 156px;
  overflow: hidden;
  color: var(--ui-atz-ink);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
  text-overflow: ellipsis;
  transition: opacity var(--ui-atz-dur-2) var(--ui-atz-ease-out);
}
.ui-atz__meta {
  max-width: 168px;
  overflow: hidden;
  color: var(--ui-atz-muted);
  font-size: 11px;
  line-height: 14px;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}
.ui-atz__reason {
  max-width: 190px;
  overflow: hidden;
  color: var(--ui-atz-danger);
  font-size: 11px;
  line-height: 14px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* An upload dims its name because the bar is saying the same thing more precisely */
.ui-atz__chip[data-state="uploading"] .ui-atz__name {
  opacity: 0.55;
}
.ui-atz__chip[data-state="rejected"] .ui-atz__thumb,
.ui-atz__chip[data-state="rejected"] .ui-atz__name {
  opacity: 0.5;
}

/* The progress bar along the bottom edge --------------------------------- */
.ui-atz__bar {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  overflow: hidden;
  background: var(--ui-atz-thumb);
}
.ui-atz__bar-fill {
  display: block;
  width: 100%;
  height: 100%;
  transform-origin: 0 50%;
  transform: scaleX(0);
  background: var(--ui-atz-accent);
  transition: transform var(--ui-atz-dur-2) var(--ui-atz-ease-both);
}

/* Controls --------------------------------------------------------------- */
.ui-atz__remove {
  display: grid;
  flex: none;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: var(--ui-atz-muted);
  transition:
    color var(--ui-atz-dur-1) var(--ui-atz-ease-out),
    background-color var(--ui-atz-dur-1) var(--ui-atz-ease-out),
    transform var(--ui-atz-dur-1) var(--ui-atz-ease-out);
}
.ui-atz__remove:hover {
  background: var(--ui-atz-wash);
  color: var(--ui-atz-ink);
}
.ui-atz__remove:active {
  transform: scale(0.9);
}
.ui-atz__retry {
  flex: none;
  height: 22px;
  margin-left: 2px;
  padding: 0 7px;
  border-radius: 6px;
  background: var(--ui-atz-wash);
  box-shadow: inset 0 0 0 1px var(--ui-atz-edge);
  color: var(--ui-atz-ink);
  font-size: 11px;
  font-weight: 500;
  line-height: 20px;
  transition:
    background-color var(--ui-atz-dur-1) var(--ui-atz-ease-out),
    box-shadow var(--ui-atz-dur-1) var(--ui-atz-ease-out);
}
.ui-atz__retry:hover {
  box-shadow: inset 0 0 0 1px var(--ui-atz-line);
}
.ui-atz__open:focus-visible,
.ui-atz__remove:focus-visible,
.ui-atz__retry:focus-visible {
  outline: 2px solid var(--ui-atz-focus);
  outline-offset: -2px;
}

/* Overflow --------------------------------------------------------------- */
.ui-atz__more {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 36px;
  padding: 0 11px;
  border-radius: var(--ui-atz-radius);
  background: var(--ui-atz-wash);
  box-shadow: inset 0 0 0 1px var(--ui-atz-edge);
  color: var(--ui-atz-muted);
  font-size: 11.5px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  transition:
    color var(--ui-atz-dur-2) var(--ui-atz-ease-out),
    background-color var(--ui-atz-dur-2) var(--ui-atz-ease-out),
    box-shadow var(--ui-atz-dur-2) var(--ui-atz-ease-out);
}
.ui-atz__more:hover {
  color: var(--ui-atz-ink);
  box-shadow: inset 0 0 0 1px var(--ui-atz-line);
}
.ui-atz__more:focus-visible {
  outline: 2px solid var(--ui-atz-focus);
  outline-offset: 2px;
}
.ui-atz__more-glyph {
  display: grid;
  place-items: center;
  width: 10px;
  height: 10px;
}

/* Rest ------------------------------------------------------------------- */
.ui-atz__empty {
  margin: 0;
  color: var(--ui-atz-muted);
  font-size: 11.5px;
  line-height: 16px;
}
.ui-atz__live {
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

:where(.dark, [data-theme="dark"]) .ui-atz {
  --ui-atz-ink: var(--text, #f4ece4);
  --ui-atz-muted: var(--text-muted, #a2958a);
  --ui-atz-subtle: var(--text-subtle, #f4ece48c);
  --ui-atz-chip: var(--panel, #1a1512);
  --ui-atz-line: var(--border, #33291f);
  --ui-atz-edge: var(--border-soft, #ffffff12);
  --ui-atz-wash: #ffffff0d;
  --ui-atz-thumb: #ffffff14;
  --ui-atz-accent: var(--accent, #ff6b35);
  --ui-atz-danger: var(--danger, #e2544a);
  --ui-atz-danger-edge: #e2544a40;
  --ui-atz-focus: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  .ui-atz__chip {
    animation: none;
  }
  .ui-atz__chip,
  .ui-atz__item,
  .ui-atz__bar-fill,
  .ui-atz__thumb,
  .ui-atz__name,
  .ui-atz__remove,
  .ui-atz__retry,
  .ui-atz__more {
    transition-duration: 1ms;
  }
  .ui-atz__chip[data-leaving="true"] {
    transform: none;
  }
}
`;
