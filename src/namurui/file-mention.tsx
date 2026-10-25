"use client";

import { useId, useState, type ReactNode } from "react";

/*
 * File Mention: the files a prompt carried into the run, drawn as a wrapping row of cards.
 * The body of a card opens the file and its chevron reveals the first lines; each card keeps
 * its own disclosure, so opening one leaves its neighbours shut. A file OMP refused keeps its
 * card, loses its preview, and says why in place of the size line. Styles are injected below,
 * so no extra files are needed.
 */

export type FileMentionReason = "tooLarge" | "binary";

export type FileMentionFile = {
  /** Path as OMP recorded it, absolute or relative to the session root */
  path: string;
  /** Lines in the file; omit when OMP never counted them */
  lineCount?: number;
  /** Size on disk in bytes */
  byteSize?: number;
  /** Why OMP left the content out; a skipped file has no preview control */
  skippedReason?: FileMentionReason;
  /** The first lines of the file, exactly as they should be previewed */
  preview?: string;
};

export type FileMentionProps = {
  /** Files carried by the message, in the order they were mentioned */
  files: readonly FileMentionFile[];
  /** Called with the path when a card body is pressed; omit to leave bodies inert */
  onOpen?: (path: string) => void;
  /** Called with the path when a card's remove control is pressed; omit to hide it */
  onRemove?: (path: string) => void;
  /** Extra class on the root */
  className?: string;
};

/* Lines a preview shows before it offers the rest */
const PREVIEW_LINES = 6;

/* The reason is a word, never a colour on its own: a card that was skipped says what
 * happened in the line where its size would have been. */
const REASON_WORD: Record<FileMentionReason, string> = {
  tooLarge: "Too large to include",
  binary: "Binary file",
};

const REASON_GLYPH: Record<FileMentionReason, ReactNode> = {
  tooLarge: (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6.6 5.4V9a.6.6 0 0 1-.6.6H2.4A.6.6 0 0 1 1.8 9V5.4a.6.6 0 0 1 .6-.6h3.6" />
      <path d="M7.4 1.8h2.8v2.8M10 2 7 5" />
    </svg>
  ),
  binary: (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4.6 2.4 3.8 9.6M8.2 2.4l-.8 7.2M2.3 4.7h7.4M2.1 7.9h7.4" />
    </svg>
  ),
};

const FILE_GLYPH = (
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
    <path d="M3.4 1.7h4.8l2.5 2.5v7.9a.3.3 0 0 1-.3.3H3.4a.3.3 0 0 1-.3-.3V2a.3.3 0 0 1 .3-.3Z" />
    <path d="M8.1 1.8v2.5h2.5" />
  </svg>
);

const CHEVRON_GLYPH = (
  <svg
    className="ui-fmn__chevron"
    viewBox="0 0 12 12"
    width="12"
    height="12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 4.6 6 7.6l3-3" />
  </svg>
);

const REMOVE_GLYPH = (
  <svg
    viewBox="0 0 12 12"
    width="12"
    height="12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M3.4 3.4l5.2 5.2M8.6 3.4 3.4 8.6" />
  </svg>
);

/* A kilobyte is 1024 bytes here, because that is what the file on disk was measured in */
function size(value: number): string {
  const n = Math.max(0, Math.round(value));
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let amount = n / 1024;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  const shown = amount < 10 ? Math.round(amount * 10) / 10 : Math.round(amount);
  return `${shown.toLocaleString("en-US")} ${units[unit]}`;
}

function linesOf(text: string): string[] {
  if (text === "") return [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/* The directory is split into a head that shrinks and a tail that never does, so a long
 * path loses its middle and keeps the folder next to the file. */
function splitPath(path: string): { head: string; tail: string; name: string } {
  const trimmed = path.replace(/[\\/]+$/, "") || path;
  const cut = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  if (cut < 0) return { head: "", tail: "", name: trimmed };
  const name = trimmed.slice(cut + 1);
  const dir = cut === 0 ? "/" : trimmed.slice(0, cut);
  const lastCut = Math.max(dir.lastIndexOf("/"), dir.lastIndexOf("\\"));
  if (lastCut <= 0) return { head: "", tail: dir, name };
  return { head: dir.slice(0, lastCut), tail: dir.slice(lastCut), name };
}

type MentionCardProps = {
  file: FileMentionFile;
  onOpen?: (path: string) => void;
  onRemove?: (path: string) => void;
};

function MentionCard({ file, onOpen, onRemove }: MentionCardProps) {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const panelId = useId();

  const { head, tail, name } = splitPath(file.path);
  const skipped = file.skippedReason;
  const all = skipped === undefined && file.preview !== undefined ? linesOf(file.preview) : [];
  const capped = all.length > PREVIEW_LINES;
  const shown = full ? all : all.slice(0, PREVIEW_LINES);

  const parts: string[] = [];
  if (file.lineCount !== undefined) {
    parts.push(
      `${Math.max(0, Math.round(file.lineCount)).toLocaleString("en-US")} ${
        file.lineCount === 1 ? "line" : "lines"
      }`,
    );
  }
  if (file.byteSize !== undefined) parts.push(size(file.byteSize));
  const meta = parts.length > 0 ? parts.join(" · ") : "Size not recorded";

  const body = (
    <>
      <span className="ui-fmn__glyph" aria-hidden="true">
        {FILE_GLYPH}
      </span>
      <span className="ui-fmn__text">
        {head || tail ? (
          <span className="ui-fmn__dir">
            {head ? <span className="ui-fmn__dir-head">{head}</span> : null}
            <span className="ui-fmn__dir-tail">{tail}</span>
          </span>
        ) : null}
        <span className="ui-fmn__name" title={file.path}>
          {name}
        </span>
        {skipped ? (
          <span className="ui-fmn__reason" data-reason={skipped}>
            <span className="ui-fmn__reason-glyph" aria-hidden="true">
              {REASON_GLYPH[skipped]}
            </span>
            <span className="ui-fmn__reason-word">{REASON_WORD[skipped]}</span>
          </span>
        ) : (
          <span className="ui-fmn__meta">{meta}</span>
        )}
      </span>
    </>
  );

  return (
    <li
      className="ui-fmn__card"
      data-state={skipped ? "skipped" : "ready"}
      data-open={open ? "true" : undefined}
    >
      <div className="ui-fmn__head">
        {onOpen ? (
          <button type="button" className="ui-fmn__body" onClick={() => onOpen(file.path)}>
            {body}
          </button>
        ) : (
          <div className="ui-fmn__body" data-inert="true">
            {body}
          </div>
        )}

        {all.length > 0 ? (
          <button
            type="button"
            className="ui-fmn__toggle"
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            aria-label={`${open ? "Hide" : "Show"} preview of ${name}`}
            onClick={() => {
              setOpen((current) => !current);
              setFull(false);
            }}
          >
            {CHEVRON_GLYPH}
          </button>
        ) : null}

        {onRemove ? (
          <button
            type="button"
            className="ui-fmn__remove"
            aria-label={`Remove ${name} from the message`}
            onClick={() => onRemove(file.path)}
          >
            {REMOVE_GLYPH}
          </button>
        ) : null}
      </div>

      {open && all.length > 0 ? (
        <div className="ui-fmn__panel" id={panelId}>
          <pre className="ui-fmn__code">{shown.join("\n")}</pre>
          {capped || (file.lineCount !== undefined && file.lineCount > all.length) ? (
            <div className="ui-fmn__foot">
              {capped ? (
                <button
                  type="button"
                  className="ui-fmn__more"
                  onClick={() => setFull((current) => !current)}
                >
                  {full ? "Show fewer lines" : `Show all ${all.length.toLocaleString("en-US")} lines`}
                </button>
              ) : null}
              {file.lineCount !== undefined && file.lineCount > all.length ? (
                <span className="ui-fmn__held">
                  First {all.length.toLocaleString("en-US")} of{" "}
                  {file.lineCount.toLocaleString("en-US")} lines
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function FileMention({ files, onOpen, onRemove, className }: FileMentionProps) {
  return (
    <div className={["ui-fmn", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-file-mention" precedence="default">
        {css}
      </style>
      <ul className="ui-fmn__row" aria-label="Files mentioned in this message">
        {files.map((file, index) => (
          <MentionCard key={`${index}:${file.path}`} file={file} onOpen={onOpen} onRemove={onRemove} />
        ))}
      </ul>
    </div>
  );
}

const css = /* css */ `
.ui-fmn {
  /* Knobs. Override any of these on .ui-fmn to retheme the row in a host. */
  --ui-fmn-ink: var(--text, #1a1410);
  --ui-fmn-muted: var(--text-muted, #6f625a);
  --ui-fmn-card: var(--panel, #fffdfb);
  --ui-fmn-well: var(--panel-raised, #faf7f4);
  --ui-fmn-line: var(--border, #e8e0d7);
  --ui-fmn-edge: var(--border-soft, #1a14101a);
  --ui-fmn-wash: #7a4a1c0a;
  --ui-fmn-warn: var(--warning, #9a6410);
  --ui-fmn-danger: var(--danger, #b3261e);
  --ui-fmn-focus: var(--accent, #c2410c);
  --ui-fmn-dur-1: var(--nm-dur-1, 90ms);
  --ui-fmn-dur-2: var(--nm-dur-2, 160ms);
  --ui-fmn-dur-3: var(--nm-dur-3, 240ms);
  --ui-fmn-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-fmn-ease-in: var(--nm-ease-in, cubic-bezier(0.55, 0, 0.68, 0.19));

  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  color: var(--ui-fmn-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 17px;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-fmn__row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}
.ui-fmn *,
.ui-fmn *::before,
.ui-fmn *::after {
  box-sizing: border-box;
}
:where(.ui-fmn) button {
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
:where(.ui-fmn) svg {
  display: block;
}

/* The card ---------------------------------------------------------------- */
.ui-fmn__card {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  flex: 1 1 232px;
  min-width: 0;
  max-width: 100%;
  border-radius: var(--radius-preview, 12px);
  background: var(--ui-fmn-card);
  box-shadow: inset 0 0 0 1px var(--ui-fmn-line);
  transition:
    background-color var(--ui-fmn-dur-2) var(--ui-fmn-ease-out),
    box-shadow var(--ui-fmn-dur-2) var(--ui-fmn-ease-out),
    transform var(--ui-fmn-dur-1) var(--ui-fmn-ease-out);
}
@media (hover: hover) {
  .ui-fmn__card:hover {
    transform: translateY(-1px);
    box-shadow: inset 0 0 0 1px var(--ui-fmn-edge);
  }
}
.ui-fmn__head {
  display: flex;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
  padding: 8px 6px 8px 10px;
}

/* The body is the file: pressing it hands the path to the host's editor. */
.ui-fmn__body {
  display: flex;
  flex: 1 1 auto;
  align-items: flex-start;
  gap: 9px;
  min-width: 0;
  padding: 0;
  border-radius: 8px;
  color: inherit;
  text-align: left;
}
.ui-fmn__body[data-inert="true"] {
  cursor: default;
}
.ui-fmn__body:focus-visible {
  outline: 2px solid var(--ui-fmn-focus);
  outline-offset: 3px;
}
.ui-fmn__glyph {
  display: grid;
  flex: none;
  place-items: center;
  width: 16px;
  height: 16px;
  margin-top: 1px;
  color: var(--ui-fmn-muted);
  transition: color var(--ui-fmn-dur-2) var(--ui-fmn-ease-out);
}
@media (hover: hover) {
  .ui-fmn__card:hover .ui-fmn__glyph {
    color: var(--ui-fmn-ink);
  }
}
.ui-fmn__text {
  display: grid;
  flex: 1 1 auto;
  gap: 1px;
  min-width: 0;
}

/* The head shrinks and takes the ellipsis while the tail never does, so a long path
 * loses its middle and keeps the folder standing next to the name. */
.ui-fmn__dir {
  display: flex;
  align-items: baseline;
  min-width: 0;
  overflow: hidden;
  color: var(--ui-fmn-muted);
  font-size: 10.5px;
  line-height: 14px;
  white-space: nowrap;
}
.ui-fmn__dir-head {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ui-fmn__dir-tail {
  flex: 0 0 auto;
  max-width: 62%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ui-fmn__name {
  display: block;
  overflow: hidden;
  color: var(--ui-fmn-ink);
  font-size: 12.5px;
  font-weight: 500;
  line-height: 17px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-fmn__meta {
  display: block;
  overflow: hidden;
  color: var(--ui-fmn-muted);
  font-size: 11px;
  line-height: 15px;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}
.ui-fmn__reason {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
  color: var(--ui-fmn-muted);
  font-size: 11px;
  line-height: 15px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-fmn__reason-glyph {
  display: grid;
  flex: none;
  place-items: center;
  width: 12px;
  height: 12px;
}
.ui-fmn__reason-word {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ui-fmn__reason[data-reason="tooLarge"] .ui-fmn__reason-glyph {
  color: var(--ui-fmn-warn);
}
.ui-fmn__reason[data-reason="binary"] .ui-fmn__reason-glyph {
  color: var(--ui-fmn-muted);
}

/* A refused file loses its surface and its ink weight, and keeps its reason at full
 * strength so the card dims without the explanation dimming with it. */
.ui-fmn__card[data-state="skipped"] {
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--ui-fmn-edge);
}
.ui-fmn__card[data-state="skipped"] .ui-fmn__name {
  color: var(--ui-fmn-muted);
  font-weight: 400;
}
.ui-fmn__card[data-state="skipped"] .ui-fmn__glyph {
  opacity: 0.7;
}

/* Controls ---------------------------------------------------------------- */
.ui-fmn__toggle,
.ui-fmn__remove {
  display: grid;
  flex: none;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: var(--ui-fmn-muted);
  transition:
    color var(--ui-fmn-dur-2) var(--ui-fmn-ease-out),
    background-color var(--ui-fmn-dur-2) var(--ui-fmn-ease-out),
    opacity var(--ui-fmn-dur-2) var(--ui-fmn-ease-out);
}
.ui-fmn__toggle:hover {
  color: var(--ui-fmn-ink);
  background: var(--ui-fmn-wash);
}
/* The chevron leans out of the way with the leaving curve and settles back with the
 * entering one, so closing is not a rewind of opening. */
.ui-fmn__chevron {
  transition: transform var(--ui-fmn-dur-3) var(--ui-fmn-ease-in);
}
.ui-fmn__card[data-open="true"] .ui-fmn__chevron {
  transform: rotate(180deg);
  transition-timing-function: var(--ui-fmn-ease-out);
}
.ui-fmn__remove {
  opacity: 0;
}
.ui-fmn__card:hover .ui-fmn__remove,
.ui-fmn__card:focus-within .ui-fmn__remove {
  opacity: 1;
}
@media (hover: none) {
  .ui-fmn__remove {
    opacity: 1;
  }
}
.ui-fmn__remove:hover {
  color: var(--ui-fmn-danger);
  background: var(--ui-fmn-wash);
}
.ui-fmn__toggle:focus-visible,
.ui-fmn__remove:focus-visible,
.ui-fmn__more:focus-visible {
  outline: 2px solid var(--ui-fmn-focus);
  outline-offset: 1px;
}

/* The preview ------------------------------------------------------------- */
.ui-fmn__panel {
  display: grid;
  gap: 6px;
  padding: 0 10px 10px;
  animation: ui-fmn-unfold var(--ui-fmn-dur-3) var(--ui-fmn-ease-out) both;
}
@keyframes ui-fmn-unfold {
  from {
    opacity: 0;
    transform: translateY(-3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.ui-fmn__code {
  margin: 0;
  padding: 8px 10px;
  overflow: hidden;
  border-radius: 8px;
  background: var(--ui-fmn-well);
  box-shadow: inset 0 0 0 1px var(--ui-fmn-edge);
  color: var(--ui-fmn-ink);
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 11px;
  line-height: 16px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  tab-size: 2;
}
.ui-fmn__more {
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  box-shadow: inset 0 0 0 1px var(--ui-fmn-edge);
  color: var(--ui-fmn-muted);
  font-size: 11px;
  font-weight: 500;
  line-height: 20px;
  transition:
    color var(--ui-fmn-dur-2) var(--ui-fmn-ease-out),
    box-shadow var(--ui-fmn-dur-2) var(--ui-fmn-ease-out);
}
.ui-fmn__more:hover {
  color: var(--ui-fmn-ink);
  box-shadow: inset 0 0 0 1px var(--ui-fmn-line);
}
.ui-fmn__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 8px;
  min-width: 0;
}
.ui-fmn__held {
  min-width: 0;
  color: var(--ui-fmn-muted);
  font-size: 10.5px;
  line-height: 15px;
  font-variant-numeric: tabular-nums;
}

:where(.dark, [data-theme="dark"]) .ui-fmn {
  --ui-fmn-ink: var(--text, #f4ece4);
  --ui-fmn-muted: var(--text-muted, #a2958a);
  --ui-fmn-card: var(--panel, #1a1512);
  --ui-fmn-well: var(--panel-raised, #201a15);
  --ui-fmn-line: var(--border, #33291f);
  --ui-fmn-edge: var(--border-soft, #ffffff12);
  --ui-fmn-wash: #ffffff0d;
  --ui-fmn-warn: var(--warning, #d99530);
  --ui-fmn-danger: var(--danger, #e2544a);
  --ui-fmn-focus: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  .ui-fmn__card,
  .ui-fmn__glyph,
  .ui-fmn__toggle,
  .ui-fmn__remove,
  .ui-fmn__chevron,
  .ui-fmn__more {
    transition-duration: 1ms;
  }
  .ui-fmn__card:hover {
    transform: none;
  }
  .ui-fmn__panel {
    animation: none;
  }
}
`;
