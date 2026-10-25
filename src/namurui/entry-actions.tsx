"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/*
 * Entry Actions: what can be done to one transcript entry — fork the session from it, branch
 * it, copy it, jump back to it. The row rests out of sight and fades up while the entry it was
 * mounted into is hovered, or when anything inside it takes focus; an open overflow menu holds
 * it up too. Copy flips to a check for 1.2 s, and a hidden sizer keeps the button as wide as
 * the longer word so the row never moves. Styles are injected below, so no extra files are needed.
 */

export type EntryActionsProps = {
  /** Fork the session from this entry; the action is disabled while a turn runs */
  onFork?: () => void;
  /** Start a named branch from this entry; disabled while a turn runs */
  onBranch?: () => void;
  /** Copy this entry's text; the row flashes Copied when the click lands */
  onCopy?: () => void;
  /** Scroll the transcript back to this entry */
  onJump?: () => void;
  /** Whether a fork is possible from this entry; defaults to true */
  canFork?: boolean;
  /** Whether a branch is possible from this entry; defaults to true */
  canBranch?: boolean;
  /** Whether the entry has copyable text; defaults to true */
  canCopy?: boolean;
  /** Whether the entry has somewhere to jump to; defaults to true */
  canJump?: boolean;
  /** The turn is still running, so `fork` and `branch` would answer `session_busy` */
  streaming?: boolean;
  /** Hold the copied confirmation on; omit to let the row run its own 1.2 s flash */
  copied?: boolean;
  /** Id of the entry, written to the clipboard by Copy entry id */
  entryId?: string;
  /** Extra class on the root */
  className?: string;
};

/* How long the copy confirmation stands before the row returns to Copy */
const FLASH_MS = 1200;

const FORK_GLYPH: ReactNode = (
  <svg
    viewBox="0 0 14 14"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M7 2.4v3.1" />
    <path d="M7 5.5 3.7 8.3v3.3" />
    <path d="M7 5.5 10.3 8.3v3.3" />
  </svg>
);

const BRANCH_GLYPH: ReactNode = (
  <svg
    viewBox="0 0 14 14"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="4" cy="2.9" r="1.1" />
    <path d="M4 4v3.2a2.8 2.8 0 0 0 2.8 2.8h2.4" />
    <path d="M7.9 8.3 10.1 10 7.9 11.7" />
  </svg>
);

const COPY_GLYPH: ReactNode = (
  <svg
    viewBox="0 0 14 14"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="4.7" y="4.7" width="6.6" height="6.6" rx="1.7" />
    <path d="M9.3 4.7V3.6a1.6 1.6 0 0 0-1.6-1.6H3.6A1.6 1.6 0 0 0 2 3.6v4.1a1.6 1.6 0 0 0 1.6 1.6h1.1" />
  </svg>
);

const CHECK_GLYPH: ReactNode = (
  <svg
    viewBox="0 0 14 14"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2.7 7.5 5.6 10.4 11.3 3.9" />
  </svg>
);

const MORE_GLYPH: ReactNode = (
  <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden="true">
    <circle cx="3" cy="7" r="1.05" fill="currentColor" />
    <circle cx="7" cy="7" r="1.05" fill="currentColor" />
    <circle cx="11" cy="7" r="1.05" fill="currentColor" />
  </svg>
);

const JUMP_GLYPH: ReactNode = (
  <svg
    viewBox="0 0 14 14"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M7 2.5v7.1" />
    <path d="M4.2 7 7 9.8 9.8 7" />
    <path d="M2.7 12h8.6" />
  </svg>
);

const HASH_GLYPH: ReactNode = (
  <svg
    viewBox="0 0 14 14"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M5.5 2.4 4.3 11.6" />
    <path d="M9.7 2.4 8.5 11.6" />
    <path d="M2.7 5.2h9" />
    <path d="M2.2 8.8h9" />
  </svg>
);

export function EntryActions({
  onFork,
  onBranch,
  onCopy,
  onJump,
  canFork = true,
  canBranch = true,
  canCopy = true,
  canJump = true,
  streaming = false,
  copied,
  entryId,
  className,
}: EntryActionsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const flashTimer = useRef<number | null>(null);
  const idTimer = useRef<number | null>(null);
  const id = useId();
  const menuId = `${id}-menu`;

  const [hostHover, setHostHover] = useState(false);
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const [idFlash, setIdFlash] = useState(false);

  /* The row cannot select the entry it sits under from CSS, so it listens on the element it
   * was mounted into: while the pointer is anywhere in that entry the row stays up. Focus
   * inside the row and an open menu reveal it on their own, so the keyboard path never
   * depends on hover. */
  useEffect(() => {
    const host = rootRef.current?.parentElement;
    if (!host) return;
    const enter = () => setHostHover(true);
    const leave = () => setHostHover(false);
    host.addEventListener("pointerenter", enter);
    host.addEventListener("pointerleave", leave);
    return () => {
      host.removeEventListener("pointerenter", enter);
      host.removeEventListener("pointerleave", leave);
    };
  }, []);

  /* Both confirmations are state changes on a timer, so the timer is the only thing that has
   * to be torn down. */
  useEffect(() => {
    return () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
      if (idTimer.current !== null) window.clearTimeout(idTimer.current);
    };
  }, []);

  /* An open menu closes on the next pointer down outside it, and takes focus to its first
   * item so the arrow keys have somewhere to start. */
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      if (moreRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const first = itemRefs.current.find((item) => item !== null);
    first?.focus();
  }, [open]);

  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = itemRefs.current.filter((item): item is HTMLButtonElement => item !== null);
    if (items.length === 0) return;
    const active = document.activeElement;
    const at = items.findIndex((item) => item === active);

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = at === -1 ? 0 : (at + step + items.length) % items.length;
      items[next].focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      items[event.key === "Home" ? 0 : items.length - 1].focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      moreRef.current?.focus();
    } else if (event.key === "Tab") {
      /* Closing unmounts the focused item, so hand focus back to the trigger first rather
       * than letting it fall to the document. */
      setOpen(false);
      moreRef.current?.focus();
    }
  };

  const forkBlocked = streaming || !canFork || !onFork;
  const branchBlocked = streaming || !canBranch || !onBranch;
  const copyBlocked = !canCopy || !onCopy;
  const jumpBlocked = !canJump || !onJump;
  const idBlocked = !entryId;

  /* The tooltip says why, in the same words the RPC uses. */
  const forkTip = streaming
    ? "Session busy: fork waits until this turn ends"
    : "Fork is unavailable for this entry";
  const branchTip = streaming
    ? "Session busy: branch waits until this turn ends"
    : "Branch is unavailable for this entry";

  const copyShown = copied ?? flash;

  const runCopy = () => {
    if (copyBlocked) return;
    onCopy?.();
    /* A caller that owns `copied` owns the clearing too, so the row only runs the flash
     * when the value is uncontrolled. */
    if (copied !== undefined) return;
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    setFlash(true);
    flashTimer.current = window.setTimeout(() => {
      setFlash(false);
      flashTimer.current = null;
    }, FLASH_MS);
  };

  const runJump = () => {
    if (jumpBlocked) return;
    setOpen(false);
    moreRef.current?.focus();
    onJump?.();
  };

  const runCopyId = () => {
    if (!entryId) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(entryId).catch(() => {});
    }
    if (idTimer.current !== null) window.clearTimeout(idTimer.current);
    setIdFlash(true);
    idTimer.current = window.setTimeout(() => {
      setIdFlash(false);
      idTimer.current = null;
    }, FLASH_MS);
  };

  const announcement = copyShown
    ? "Entry copied to the clipboard"
    : idFlash
      ? "Entry id copied"
      : "";

  return (
    <div
      ref={rootRef}
      className={["ui-eac", className].filter(Boolean).join(" ")}
      role="group"
      aria-label="Entry actions"
      data-revealed={hostHover ? "true" : undefined}
      data-open={open ? "true" : undefined}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-entry-actions" precedence="default">
        {css}
      </style>

      <button
        type="button"
        className="ui-eac__act"
        data-blocked={forkBlocked ? "true" : undefined}
        aria-label="Fork session from this entry"
        aria-disabled={forkBlocked ? true : undefined}
        aria-describedby={forkBlocked ? `${id}-fork-tip` : undefined}
        onClick={() => {
          if (!forkBlocked) onFork?.();
        }}
      >
        <span className="ui-eac__glyph" aria-hidden="true">
          {FORK_GLYPH}
        </span>
        <span className="ui-eac__label" aria-hidden="true">
          Fork
        </span>
        {forkBlocked ? (
          <span className="ui-eac__tip" id={`${id}-fork-tip`} role="tooltip">
            {forkTip}
          </span>
        ) : null}
      </button>

      <button
        type="button"
        className="ui-eac__act"
        data-blocked={branchBlocked ? "true" : undefined}
        aria-label="Branch from this entry"
        aria-disabled={branchBlocked ? true : undefined}
        aria-describedby={branchBlocked ? `${id}-branch-tip` : undefined}
        onClick={() => {
          if (!branchBlocked) onBranch?.();
        }}
      >
        <span className="ui-eac__glyph" aria-hidden="true">
          {BRANCH_GLYPH}
        </span>
        <span className="ui-eac__label" aria-hidden="true">
          Branch
        </span>
        {branchBlocked ? (
          <span className="ui-eac__tip" id={`${id}-branch-tip`} role="tooltip">
            {branchTip}
          </span>
        ) : null}
      </button>

      <button
        type="button"
        className="ui-eac__act"
        data-copied={copyShown ? "true" : undefined}
        data-blocked={copyBlocked ? "true" : undefined}
        aria-label={copyShown ? "Copied to the clipboard" : "Copy entry text"}
        aria-disabled={copyBlocked ? true : undefined}
        aria-describedby={copyBlocked ? `${id}-copy-tip` : undefined}
        onClick={runCopy}
      >
        <span className="ui-eac__glyph" aria-hidden="true">
          <span className="ui-eac__glyph-part" data-glyph="copy">
            {COPY_GLYPH}
          </span>
          <span className="ui-eac__glyph-part" data-glyph="check">
            {CHECK_GLYPH}
          </span>
        </span>
        <span className="ui-eac__label-stack" aria-hidden="true">
          <span className="ui-eac__label">{copyShown ? "Copied" : "Copy"}</span>
          {/* Holds the width of the longer word, so the swap never moves the row */}
          <span className="ui-eac__label ui-eac__label--sizer">Copied</span>
        </span>
        {copyBlocked ? (
          <span className="ui-eac__tip" id={`${id}-copy-tip`} role="tooltip">
            Nothing to copy in this entry
          </span>
        ) : null}
      </button>

      <span className="ui-eac__rule" aria-hidden="true" />

      <div className="ui-eac__more">
        <button
          ref={moreRef}
          type="button"
          className="ui-eac__act ui-eac__act--icon"
          aria-label="More entry actions"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="ui-eac__glyph" aria-hidden="true">
            {MORE_GLYPH}
          </span>
          <span className="ui-eac__tip" aria-hidden="true">
            More actions
          </span>
        </button>

        {open ? (
          <div
            ref={menuRef}
            id={menuId}
            className="ui-eac__menu"
            role="menu"
            aria-label="More entry actions"
            onKeyDown={onMenuKey}
          >
            <button
              ref={(node) => {
                itemRefs.current[0] = node;
              }}
              type="button"
              role="menuitem"
              className="ui-eac__item"
              aria-disabled={jumpBlocked ? true : undefined}
              title={jumpBlocked ? "This entry has no scroll target" : undefined}
              onClick={runJump}
            >
              <span className="ui-eac__item-glyph" aria-hidden="true">
                {JUMP_GLYPH}
              </span>
              <span className="ui-eac__item-label">Jump to entry</span>
              {jumpBlocked ? <span className="ui-eac__item-note">unavailable</span> : null}
            </button>

            <button
              ref={(node) => {
                itemRefs.current[1] = node;
              }}
              type="button"
              role="menuitem"
              className="ui-eac__item"
              aria-disabled={idBlocked ? true : undefined}
              title={idBlocked ? "This entry has no id to copy" : undefined}
              onClick={runCopyId}
            >
              <span className="ui-eac__item-glyph" aria-hidden="true">
                {idFlash ? CHECK_GLYPH : HASH_GLYPH}
              </span>
              <span className="ui-eac__item-label">
                {idFlash ? "Entry id copied" : "Copy entry id"}
              </span>
              {idBlocked ? <span className="ui-eac__item-note">no id</span> : null}
            </button>
          </div>
        ) : null}
      </div>

      <span className="ui-eac__sr" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}

const css = /* css */ `
.ui-eac {
  /* Knobs. Override any of these on .ui-eac to retheme the row in a host. */
  --ui-eac-ink: var(--text, #1a1410);
  --ui-eac-muted: var(--text-muted, #6f625a);
  --ui-eac-card: var(--panel, #fffdfb);
  --ui-eac-line: var(--border, #e8e0d7);
  --ui-eac-hover: #7a4a1c0f;
  --ui-eac-ok: var(--success, #1a7a4a);
  --ui-eac-focus: var(--accent, #c2410c);
  --ui-eac-tip-bg: #211a15f2;
  --ui-eac-tip-ink: #fffdfb;
  --ui-eac-pop: 0 10px 24px -12px #1a141040, 0 1px 2px #1a14101a;
  --ui-eac-ease: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-eac-ease-in: var(--nm-ease-in, cubic-bezier(0.55, 0, 0.68, 0.19));
  --ui-eac-spring: var(--nm-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  --ui-eac-dur-1: var(--nm-dur-1, 90ms);
  --ui-eac-dur-2: var(--nm-dur-2, 160ms);
  --ui-eac-dur-3: var(--nm-dur-3, 240ms);

  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
  width: 100%;
  min-height: 28px;
  color: var(--ui-eac-muted);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 11.5px;
  line-height: 16px;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
  /* Resting state: out of sight but still in the layout, so nothing moves when it appears.
   * Leaving uses the in-curve; the revealed state swaps in the out-curve. */
  opacity: 0;
  transform: translateY(3px);
  transition:
    opacity var(--ui-eac-dur-2) var(--ui-eac-ease-in),
    transform var(--ui-eac-dur-2) var(--ui-eac-ease-in);
}
.ui-eac *,
.ui-eac *::before,
.ui-eac *::after {
  box-sizing: border-box;
}
.ui-eac:is(:hover, :focus-within),
.ui-eac[data-revealed="true"],
.ui-eac[data-open="true"] {
  opacity: 1;
  transform: none;
  transition:
    opacity var(--ui-eac-dur-2) var(--ui-eac-ease),
    transform var(--ui-eac-dur-2) var(--ui-eac-ease);
}

/* One button --------------------------------------------------------------- */
.ui-eac__act {
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  height: 24px;
  margin: 0;
  padding: 0 7px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--ui-eac-muted);
  font: inherit;
  letter-spacing: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    color var(--ui-eac-dur-1) var(--ui-eac-ease),
    background-color var(--ui-eac-dur-1) var(--ui-eac-ease);
}
.ui-eac__act--icon {
  padding: 0 6px;
}
.ui-eac__act:is(:hover, [aria-expanded="true"]) {
  background: var(--ui-eac-hover);
  color: var(--ui-eac-ink);
}
.ui-eac__act:focus-visible {
  outline: 2px solid var(--ui-eac-focus);
  outline-offset: 1px;
}
.ui-eac__act[data-blocked="true"] {
  cursor: not-allowed;
}
.ui-eac__act[data-blocked="true"]:hover {
  background: none;
  color: var(--ui-eac-muted);
}
/* The confirmation is a word, a check and a tone together, never the tone alone. */
.ui-eac__act[data-copied="true"],
.ui-eac__act[data-copied="true"]:hover {
  color: var(--ui-eac-ok);
}
.ui-eac__act[data-blocked="true"] .ui-eac__glyph,
.ui-eac__act[data-blocked="true"] .ui-eac__label-stack {
  opacity: 0.45;
}

.ui-eac__glyph {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  width: 14px;
  height: 14px;
}
.ui-eac__glyph-part {
  display: grid;
  grid-area: 1 / 1;
  place-items: center;
}
.ui-eac__glyph-part svg {
  display: block;
}
.ui-eac__glyph-part[data-glyph="copy"] {
  transition: opacity var(--ui-eac-dur-1) var(--ui-eac-ease);
}
.ui-eac__glyph-part[data-glyph="check"] {
  opacity: 0;
  transform: scale(0.55);
  transition:
    opacity var(--ui-eac-dur-1) var(--ui-eac-ease),
    transform var(--ui-eac-dur-1) var(--ui-eac-ease);
}
.ui-eac__act[data-copied="true"] .ui-eac__glyph-part[data-glyph="copy"] {
  opacity: 0;
}
.ui-eac__act[data-copied="true"] .ui-eac__glyph-part[data-glyph="check"] {
  opacity: 1;
  transform: none;
  transition:
    opacity var(--ui-eac-dur-2) var(--ui-eac-ease),
    transform var(--ui-eac-dur-3) var(--ui-eac-spring);
}

/* Both labels share one grid cell, so the button is always as wide as the longer word. */
.ui-eac__label-stack {
  display: grid;
}
.ui-eac__label {
  grid-area: 1 / 1;
  white-space: nowrap;
}
.ui-eac__label--sizer {
  visibility: hidden;
}

.ui-eac__rule {
  flex: none;
  width: 1px;
  height: 12px;
  margin: 0 3px;
  background: var(--ui-eac-line);
}

/* Tooltip ------------------------------------------------------------------ */
.ui-eac__tip {
  position: absolute;
  bottom: calc(100% + 7px);
  left: 50%;
  z-index: 40;
  width: max-content;
  max-width: 220px;
  padding: 5px 8px;
  border-radius: 6px;
  background: var(--ui-eac-tip-bg);
  color: var(--ui-eac-tip-ink);
  font-size: 11px;
  font-weight: 400;
  line-height: 15px;
  letter-spacing: 0;
  text-align: left;
  white-space: normal;
  opacity: 0;
  visibility: hidden;
  transform: translate(-50%, 3px);
  pointer-events: none;
  transition:
    opacity var(--ui-eac-dur-2) var(--ui-eac-ease),
    transform var(--ui-eac-dur-2) var(--ui-eac-ease),
    visibility 0s linear var(--ui-eac-dur-2);
}
.ui-eac__act:is(:hover, :focus-visible) .ui-eac__tip {
  opacity: 1;
  visibility: visible;
  transform: translate(-50%, 0);
  transition:
    opacity var(--ui-eac-dur-2) var(--ui-eac-ease),
    transform var(--ui-eac-dur-2) var(--ui-eac-ease),
    visibility 0s;
}

/* Overflow ----------------------------------------------------------------- */
.ui-eac__more {
  position: relative;
  display: inline-flex;
  flex: none;
}
.ui-eac__menu {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  z-index: 40;
  display: grid;
  min-width: 188px;
  padding: 4px;
  border-radius: 10px;
  background: var(--ui-eac-card);
  box-shadow: inset 0 0 0 1px var(--ui-eac-line), var(--ui-eac-pop);
  transform-origin: 0 100%;
  animation: ui-eac-pop var(--ui-eac-dur-3) var(--ui-eac-spring) both;
}
@keyframes ui-eac-pop {
  from {
    opacity: 0;
    transform: translateY(5px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.ui-eac__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 28px;
  margin: 0;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--ui-eac-ink);
  font: inherit;
  font-size: 12px;
  letter-spacing: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background-color var(--ui-eac-dur-1) var(--ui-eac-ease);
}
.ui-eac__item:is(:hover, :focus-visible) {
  background: var(--ui-eac-hover);
}
.ui-eac__item:focus-visible {
  outline: 2px solid var(--ui-eac-focus);
  outline-offset: -2px;
}
.ui-eac__item[aria-disabled="true"] {
  color: var(--ui-eac-muted);
  cursor: not-allowed;
}
.ui-eac__item[aria-disabled="true"]:hover {
  background: none;
}
.ui-eac__item-glyph {
  display: grid;
  flex: none;
  place-items: center;
  width: 14px;
  height: 14px;
  color: var(--ui-eac-muted);
}
.ui-eac__item-label {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
}
.ui-eac__item-note {
  flex: none;
  color: var(--ui-eac-muted);
  font-size: 10.5px;
}

/* Live region -------------------------------------------------------------- */
.ui-eac__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

:where(.dark, [data-theme="dark"]) .ui-eac {
  --ui-eac-ink: var(--text, #f4ece4);
  --ui-eac-muted: var(--text-muted, #a2958a);
  --ui-eac-card: var(--panel, #201a15);
  --ui-eac-line: var(--border, #33291f);
  --ui-eac-hover: #ffffff0d;
  --ui-eac-ok: var(--success, #4f9d6e);
  --ui-eac-focus: var(--accent, #ff6b35);
  --ui-eac-tip-bg: #0d0a08f2;
  --ui-eac-tip-ink: #f4ece4;
  --ui-eac-pop: 0 12px 28px -14px #00000080, 0 1px 2px #0000004d;
}

@media (prefers-reduced-motion: reduce) {
  .ui-eac,
  .ui-eac__act,
  .ui-eac__glyph-part,
  .ui-eac__tip,
  .ui-eac__item {
    transition-duration: 1ms;
  }
  .ui-eac {
    transform: none;
  }
  .ui-eac__glyph-part[data-glyph="check"] {
    transform: none;
  }
  .ui-eac__tip {
    transform: translate(-50%, 0);
  }
  .ui-eac__menu {
    animation: none;
  }
}
`;
