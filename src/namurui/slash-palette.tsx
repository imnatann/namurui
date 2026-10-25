"use client";

import { useEffect, useId, useRef, useState } from "react";

/*
 * Slash Palette: the command list a composer opens when a line starts with "/", fed by the
 * bridge's available_commands_update. Typing narrows the list on name and description, the
 * arrows walk it, Enter runs the row, Tab completes and closes, and Escape dismisses; the picked
 * row carries the ember rule and a raised surface, and the row under the pointer takes selection.
 * The list scrolls past maxVisible instead of growing, and the selected row is kept in view. Keys
 * are read from the palette and from the field of the form it sits in, so a mounted palette never
 * takes Tab from the rest of the page. Styles are injected below, so no extra files are needed.
 */

export type SlashCommandSource = "builtin" | "skill" | "extension" | "mcp";

export type SlashCommand = {
  /** Command name as the bridge reports it, without the leading slash */
  name: string;
  /** One line saying what the command does – it is searched as well as shown */
  description: string;
  /** Argument shape after the name, e.g. "<turns>" */
  argumentHint?: string;
  /** Where the command came from: builtin, skill, extension or mcp */
  source: SlashCommandSource;
};

export type SlashPaletteProps = {
  /** Commands exactly as available_commands_update reported them */
  commands: readonly SlashCommand[];
  /** Text typed after the slash, owned by the composer field; a leading "/" is ignored */
  query?: string;
  /** Called with the command the user picked */
  onPick?: (command: SlashCommand) => void;
  /** Called when Escape, Tab or a click dismisses the palette */
  onClose?: () => void;
  /** Rows shown before the list scrolls; the panel never grows past this */
  maxVisible?: number;
  /** Extra class on the root */
  className?: string;
};

/* Height of one row before it has been measured, so the first frame does not flash the whole
 * list. Every later cap uses the measured height. */
const ROW_FALLBACK = 52;

/* The list's own breathing room at each end, added to the cap so a whole row is never clipped */
const LIST_PAD = 4;

const NO_MATCH_GLYPH = (
  <svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
    <circle cx="7" cy="7" r="4.9" />
    <path d="M3.6 10.4 10.4 3.6" />
  </svg>
);

export function SlashPalette({
  commands,
  query = "",
  onPick,
  onClose,
  maxVisible = 8,
  className,
}: SlashPaletteProps) {
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [measuredRow, setMeasuredRow] = useState(0);

  /* The field owns the text; the palette only reads it. A leading slash is punctuation, not
   * part of what the command list is matched against. */
  const raw = query.replace(/^\s*\/+/, "").trim();
  const term = raw.toLowerCase();
  const matches: readonly SlashCommand[] = term
    ? commands.filter(
        (command) =>
          command.name.toLowerCase().includes(term) ||
          command.description.toLowerCase().includes(term),
      )
    : commands;

  const visible = Math.max(1, Math.floor(maxVisible));
  const rowH = measuredRow || ROW_FALLBACK;

  /* The stored index survives filtering; when the list shrinks under it, it clamps to the new
   * last row rather than pointing past the end. */
  useEffect(() => {
    setActive((current) => Math.min(current, Math.max(0, matches.length - 1)));
  }, [matches.length]);

  const cursor = Math.min(active, Math.max(0, matches.length - 1));

  /* Rows are measured, not assumed: a host font size or a zoom level changes their height, and
   * the cap has to follow it or maxVisible would show a fraction of a row. */
  useEffect(() => {
    const first = rowRefs.current[0];
    if (!first || !first.isConnected) return;
    const measure = () => setMeasuredRow(first.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(first);
    return () => observer.disconnect();
  }, [matches.length]);

  /* Keep the selected row inside the scroll port, without scrolling the page around it */
  useEffect(() => {
    const body = bodyRef.current;
    const row = rowRefs.current[cursor];
    if (!body || !row) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < body.scrollTop) body.scrollTop = top;
    else if (bottom > body.scrollTop + body.clientHeight) {
      body.scrollTop = bottom - body.clientHeight;
    }
  }, [cursor, matches.length]);

  const pick = (command: SlashCommand, close: boolean) => {
    onPick?.(command);
    if (close) onClose?.();
  };

  /* The five keys belong to the palette while it is mounted, because in a composer the caret
   * stays in the field behind it and never lands on the list. */
  const onKey = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (matches.length === 0) return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => {
        const from = Math.min(current, matches.length - 1);
        return (from + step + matches.length) % matches.length;
      });
      return;
    }

    if (event.key === "Enter") {
      const command = matches[cursor];
      if (!command) return;
      event.preventDefault();
      pick(command, false);
      return;
    }

    if (event.key === "Tab" && !event.shiftKey) {
      const command = matches[cursor];
      if (!command) return;
      pick(command, true);
      /* Without a close callback there is nothing to dismiss, so focus is left free to move */
      if (onClose) event.preventDefault();
      return;
    }

    if (event.key === "Escape" && onClose) {
      event.preventDefault();
      onClose();
    }
  };

  /* The listener is attached once and reads the latest handler, so typing does not rebind it */
  const keyHandler = useRef(onKey);
  useEffect(() => {
    keyHandler.current = onKey;
  });

  /* In a composer the caret stays in the field behind the palette, so the keys cannot be read
   * from the list alone. The field of the form this palette belongs to is its owner; anything
   * outside that form keeps its own Tab and Enter. */
  useEffect(() => {
    const onDocumentKey = (event: KeyboardEvent) => {
      const root = rootRef.current;
      const target = event.target;
      if (!root || !(target instanceof Node)) return;
      if (root.contains(target)) {
        keyHandler.current(event);
        return;
      }
      const field =
        target instanceof Element
          ? target.closest("input, textarea, [contenteditable='true']")
          : null;
      const form = field ? field.closest("form") : null;
      if (form && form.contains(root)) keyHandler.current(event);
    };
    document.addEventListener("keydown", onDocumentKey);
    return () => document.removeEventListener("keydown", onDocumentKey);
  }, []);

  return (
    <div className={["ui-slp", className].filter(Boolean).join(" ")} ref={rootRef}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-slash-palette" precedence="default">
        {css}
      </style>

      <div
        className="ui-slp__body"
        ref={bodyRef}
        style={{ maxHeight: `${rowH * visible + LIST_PAD * 2}px` }}
      >
        {matches.length > 0 ? (
          <div
            className="ui-slp__list"
            role="listbox"
            aria-label="Slash commands"
            aria-activedescendant={`${uid}-${cursor}`}
            tabIndex={0}
          >
            {matches.map((command, index) => (
              <button
                key={command.name}
                id={`${uid}-${index}`}
                type="button"
                role="option"
                aria-selected={index === cursor}
                data-active={index === cursor ? "true" : undefined}
                className="ui-slp__row"
                ref={(node) => {
                  rowRefs.current[index] = node;
                }}
                onPointerEnter={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(command, true)}
              >
                <span className="ui-slp__rule" aria-hidden="true" />
                <span className="ui-slp__lead">
                  <span className="ui-slp__name">
                    <span className="ui-slp__slash" aria-hidden="true">
                      /
                    </span>
                    {command.name}
                  </span>
                  {command.argumentHint ? (
                    <span className="ui-slp__arg">{command.argumentHint}</span>
                  ) : null}
                </span>
                <span className="ui-slp__desc">
                  <span className="ui-slp__text">{command.description}</span>
                  <span className="ui-slp__badge" data-source={command.source}>
                    <span className="ui-slp__mark" aria-hidden="true" />
                    {command.source}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="ui-slp__none">
            <span className="ui-slp__none-glyph" aria-hidden="true">
              {NO_MATCH_GLYPH}
            </span>
            <span>
              {commands.length === 0 ? (
                "No commands are available yet"
              ) : (
                <>
                  No command matches <code>/{raw}</code>
                </>
              )}
            </span>
          </p>
        )}
      </div>

      <footer className="ui-slp__foot">
        <span className="ui-slp__count" role="status" aria-live="polite">
          <b>{matches.length}</b> of {commands.length} commands
        </span>
        <span className="ui-slp__keys" aria-hidden="true">
          <kbd>↑</kbd>
          <kbd>↓</kbd> move <kbd>↵</kbd> run <kbd>⇥</kbd> complete <kbd>esc</kbd> close
        </span>
      </footer>
    </div>
  );
}

const css = /* css */ `
/* The component's knobs. A host that loads tokens.css gets the Ember palette from the document;
   without it these literals keep the palette correct on its own. Override them on .ui-slp. */
.ui-slp {
  --ui-slp-ink: var(--text, #1a1410);
  --ui-slp-muted: var(--text-muted, #6f625a);
  --ui-slp-subtle: var(--text-subtle, #1a141099);
  --ui-slp-panel: var(--card, #ffffff);
  --ui-slp-raised: var(--hover-bg, #7a4a1c12);
  --ui-slp-wash: var(--muted-bg, #7a4a1c0a);
  --ui-slp-line: var(--border-soft, #1a14101a);
  --ui-slp-edge: var(--border, #e8e0d7);
  --ui-slp-accent: var(--accent, #c2410c);
  --ui-slp-focus: var(--accent, #c2410c);
  --ui-slp-shadow: 0 18px 40px -24px #3d1f0a3d, 0 2px 8px -4px #3d1f0a24;
  --ui-slp-mono: var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace);
  /* Motion is the NamurUI scale, with the literal inline so a host that never loads motion.css
     still gets the same settling. */
  --ui-slp-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-slp-spring: var(--nm-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  --ui-slp-dur-2: var(--nm-dur-2, 160ms);
  --ui-slp-dur-3: var(--nm-dur-3, 240ms);

  box-sizing: border-box;
  display: grid;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  border-radius: var(--radius-card, 16px);
  background: var(--ui-slp-panel);
  box-shadow: inset 0 0 0 1px var(--ui-slp-line), var(--ui-slp-shadow);
  color: var(--ui-slp-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  line-height: 18px;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
  container-type: inline-size;
  container-name: ui-slp;
  /* The panel is attached to the composer, so it lands on the spring step and settles */
  animation: ui-slp-attach var(--ui-slp-dur-3) var(--ui-slp-spring) both;
}
.ui-slp *,
.ui-slp *::before,
.ui-slp *::after {
  box-sizing: border-box;
}
.ui-slp p {
  margin: 0;
}
:where(.ui-slp) button {
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  letter-spacing: inherit;
  text-align: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
:where(.ui-slp) svg {
  display: block;
}

@keyframes ui-slp-attach {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* The scroll port --------------------------------------------------------- */
.ui-slp__body {
  position: relative;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--ui-slp-edge) transparent;
}
.ui-slp__list {
  padding: ${LIST_PAD}px;
}
.ui-slp__list:focus-visible {
  outline: 2px solid var(--ui-slp-focus);
  outline-offset: -2px;
}

/* One row: the ember rule, then the name line and the description line ------- */
.ui-slp__row {
  position: relative;
  display: grid;
  gap: 1px;
  width: 100%;
  padding: 7px 12px 8px 15px;
  border-radius: var(--radius-preview, 12px);
  color: var(--ui-slp-muted);
  transition: background-color var(--ui-slp-dur-2) var(--ui-slp-ease-out);
}
.ui-slp__row:hover {
  background: var(--ui-slp-wash);
}
.ui-slp__row[data-active="true"] {
  background: var(--ui-slp-raised);
  box-shadow: inset 0 0 0 1px var(--ui-slp-edge);
}
.ui-slp__row:focus-visible {
  outline: 2px solid var(--ui-slp-focus);
  outline-offset: -2px;
}
/* A hairline between rows, drawn inside the row so a state change never moves anything */
.ui-slp__row::after {
  content: "";
  position: absolute;
  right: 12px;
  bottom: 0;
  left: 15px;
  height: 1px;
  background: var(--ui-slp-line);
}
.ui-slp__row:last-child::after {
  content: none;
}

/* The ember rule is the one live mark on the surface, so it exists only on the picked row */
.ui-slp__rule {
  position: absolute;
  top: 7px;
  bottom: 7px;
  left: 4px;
  width: 2px;
  border-radius: 2px;
  background: var(--ui-slp-accent);
  opacity: 0;
  transform: scaleY(0.4);
  transform-origin: 50% 50%;
  transition:
    opacity var(--ui-slp-dur-2) var(--ui-slp-ease-out),
    transform var(--ui-slp-dur-2) var(--ui-slp-spring);
}
.ui-slp__row[data-active="true"] .ui-slp__rule {
  opacity: 1;
  transform: scaleY(1);
}

.ui-slp__lead {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.ui-slp__name {
  min-width: 0;
  overflow: hidden;
  font-family: var(--ui-slp-mono);
  font-size: 12.5px;
  font-weight: 500;
  line-height: 18px;
  letter-spacing: 0;
  color: var(--ui-slp-ink);
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-slp__slash {
  margin-right: 1px;
  color: var(--ui-slp-subtle);
}
.ui-slp__arg {
  margin-left: auto;
  padding-left: 8px;
  font-family: var(--ui-slp-mono);
  font-size: 11px;
  line-height: 18px;
  letter-spacing: 0;
  color: var(--ui-slp-subtle);
  white-space: nowrap;
}
.ui-slp__desc {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.ui-slp__text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 11.5px;
  line-height: 16px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* The badge names the source and gives it a mark of its own shape, so the word is never the only
   thing telling a skill from an extension */
.ui-slp__badge {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
  height: 16px;
  padding: 0 6px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-slp-wash);
  color: var(--ui-slp-muted);
  font-size: 10px;
  line-height: 16px;
  letter-spacing: 0.01em;
  white-space: nowrap;
}
.ui-slp__mark {
  width: 4px;
  height: 4px;
  border-radius: 1px;
  background: currentColor;
}
.ui-slp__badge[data-source="skill"] .ui-slp__mark {
  border-radius: 50%;
}
.ui-slp__badge[data-source="extension"] .ui-slp__mark {
  width: 4px;
  height: 4px;
  border-radius: 0;
  transform: rotate(45deg);
}
.ui-slp__badge[data-source="mcp"] .ui-slp__mark {
  width: 6px;
  height: 2px;
  border-radius: 1px;
}

/* No match --------------------------------------------------------------- */
.ui-slp__none {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 15px 16px;
  color: var(--ui-slp-muted);
  font-size: 12.5px;
  line-height: 18px;
}
.ui-slp__none-glyph {
  flex: none;
  color: var(--ui-slp-subtle);
}
.ui-slp__none code {
  padding: 1px 5px;
  border-radius: 5px;
  background: var(--ui-slp-wash);
  font-family: var(--ui-slp-mono);
  font-size: 12px;
  letter-spacing: 0;
  color: var(--ui-slp-ink);
}

/* Footer ----------------------------------------------------------------- */
.ui-slp__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 12px 8px 15px;
  box-shadow: inset 0 1px 0 var(--ui-slp-line);
  color: var(--ui-slp-subtle);
  font-size: 11px;
  line-height: 16px;
}
.ui-slp__count {
  flex: none;
  color: var(--ui-slp-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.ui-slp__count b {
  font-weight: 500;
  color: var(--ui-slp-ink);
}
.ui-slp__keys {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-slp__keys kbd {
  display: inline-flex;
  flex: none;
  align-items: center;
  height: 16px;
  padding: 0 4px;
  border-radius: 4px;
  background: var(--ui-slp-wash);
  box-shadow: inset 0 0 0 1px var(--ui-slp-line);
  font-family: var(--ui-slp-mono);
  font-size: 10px;
  line-height: 16px;
  letter-spacing: 0;
  color: var(--ui-slp-muted);
}

/* A narrow composer keeps the count and drops the key legend */
@container ui-slp (max-width: 360px) {
  .ui-slp__keys {
    display: none;
  }
}

:where(.dark, [data-theme="dark"]) .ui-slp {
  --ui-slp-ink: var(--text, #f4ece4);
  --ui-slp-muted: var(--text-muted, #a2958a);
  --ui-slp-subtle: var(--text-subtle, #f4ece48c);
  --ui-slp-panel: var(--card, #201a15);
  --ui-slp-raised: var(--preview, #26201a);
  --ui-slp-wash: var(--muted-bg, #ffffff0d);
  --ui-slp-line: var(--border-soft, #ffffff12);
  --ui-slp-edge: var(--border, #33291f);
  --ui-slp-accent: var(--accent, #ff6b35);
  --ui-slp-focus: var(--accent, #ff6b35);
  --ui-slp-shadow: 0 22px 44px -22px #000000b3, 0 2px 10px -4px #00000073;
}

@media (prefers-reduced-motion: reduce) {
  .ui-slp {
    animation: none;
  }
  .ui-slp__row,
  .ui-slp__rule {
    transition-duration: 1ms;
  }
}
`;
