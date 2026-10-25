"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

/*
 * Ghost Text: the inline word completion OMP raises after predict_word, drawn at the caret
 * inside the real message field. The suffix fades in behind the caret from a measured mirror
 * of the field, so a wrapped line lands in exactly the right place; Tab commits it and the
 * caret follows the accepted word, Escape drops it without touching the typed text. Styles
 * are injected below, so no extra files are needed.
 */

export type GhostTextProps = {
  /** Current text; omit it and the component keeps its own */
  value?: string;
  /** Completion suffix drawn after the caret; empty hides the ghost */
  suggestion?: string;
  /** Whether the host is offering completions right now */
  visible?: boolean;
  /** Called with the accepted suffix when Tab takes it */
  onAccept?: (suffix: string) => void;
  /** Called when Escape drops the suggestion */
  onDismiss?: () => void;
  /** Called with the next text, typed or accepted */
  onChange?: (next: string) => void;
  /** Placeholder while the field is empty; also names the field for assistive tech */
  placeholder?: string;
  /** Wrap and grow with content; false renders a single-line input */
  multiline?: boolean;
  /** Extra class on the root */
  className?: string;
};

type Point = { x: number; y: number };

export function GhostText({
  value,
  suggestion = "",
  visible = true,
  onAccept,
  onDismiss,
  onChange,
  placeholder = "Ask the agent…",
  multiline = true,
  className,
}: GhostTextProps) {
  const [draft, setDraft] = useState("");
  const text = value === undefined ? draft : value;

  /* A suggestion is anchored to the text it was computed for. Any edit moves the text past
   * that anchor and the ghost goes with it, without waiting for the host to say so. */
  const [anchor, setAnchor] = useState(text);
  const [dismissed, setDismissed] = useState(false);
  const seenRef = useRef(suggestion);
  useLayoutEffect(() => {
    if (seenRef.current === suggestion) return;
    seenRef.current = suggestion;
    setAnchor(text);
    setDismissed(false);
  }, [suggestion, text]);

  const [caretAtEnd, setCaretAtEnd] = useState(text.length === 0);
  const [gutter, setGutter] = useState(0);
  const [caret, setCaret] = useState<Point>({ x: 0, y: 0 });
  const [announcement, setAnnouncement] = useState("");

  const fieldRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const committedRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const pendingCaret = useRef(false);
  const liveId = useId();

  const live = visible && !dismissed && suggestion.length > 0 && text === anchor;
  const show = live && caretAtEnd;

  /* React 19 calls a ref callback on every mount, so one ref can serve either element. */
  const setField = useCallback((node: HTMLTextAreaElement | HTMLInputElement | null) => {
    fieldRef.current = node;
  }, []);

  const commit = (next: string) => {
    if (value === undefined) setDraft(next);
    onChange?.(next);
  };

  const syncCaret = useCallback(() => {
    const el = fieldRef.current;
    if (!el) return;
    setCaretAtEnd(el.selectionStart === el.selectionEnd && el.selectionStart === el.value.length);
  }, []);

  /* The mirror scrolls with the field, so the ghost stays under the caret when the text
   * runs past the visible area. Written straight to the node: a scroll must not re-render. */
  const syncScroll = useCallback(() => {
    const el = fieldRef.current;
    const layer = layerRef.current;
    if (!el || !layer) return;
    layer.style.transform = `translate(${-el.scrollLeft}px, ${-el.scrollTop}px)`;
  }, []);

  /* Height follows the content up to the cap the stylesheet sets, and the measured
   * scrollbar width narrows the mirror so a wrapped line breaks where the field does. */
  useLayoutEffect(() => {
    const el = fieldRef.current;
    if (!el) return;

    const fit = () => {
      const styles = getComputedStyle(el);
      const edge =
        Number.parseFloat(styles.borderTopWidth) + Number.parseFloat(styles.borderBottomWidth);

      if (multiline) {
        el.style.height = "auto";
        const cap = Number.parseFloat(styles.maxHeight);
        const ceiling = Number.isFinite(cap) ? cap : Number.POSITIVE_INFINITY;
        const next = `${Math.min(el.scrollHeight + edge, ceiling)}px`;
        if (el.style.height !== next) el.style.height = next;
      }

      const across =
        Number.parseFloat(styles.borderLeftWidth) + Number.parseFloat(styles.borderRightWidth);
      setGutter(Math.max(0, el.offsetWidth - el.clientWidth - across));
    };

    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, multiline]);

  useLayoutEffect(() => {
    syncCaret();
  }, [text, show, syncCaret]);

  useLayoutEffect(() => {
    syncScroll();
  }, [text, show, syncScroll]);

  /* The suggestion is placed from the marker's own line box, not from a width guess: the
   * marker sits after the committed text in a hidden mirror, so a wrapped caret is exact.
   * Layout effect, so the ghost never paints a frame at the old caret. */
  useLayoutEffect(() => {
    if (!show) return;
    const layer = layerRef.current;
    const marker = markerRef.current;
    const committed = committedRef.current;
    if (!layer || !marker) return;

    const measure = () => {
      const base = layer.getBoundingClientRect();
      const box = marker.getBoundingClientRect();
      setCaret({
        x: box.left - base.left - layer.clientLeft,
        y: box.top - base.top - layer.clientTop,
      });
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(layer);
    observer.observe(marker);
    /* A webfont landing or the host resizing rewraps the mirror without resizing the
     * layer, so the in-flow committed text is what reports that. */
    if (committed) observer.observe(committed);
    return () => observer.disconnect();
  }, [show, text, suggestion, gutter, multiline]);

  /* One announcement per appearance: the suffix is read once, not on every keystroke that
   * shortens it, and the region empties when the ghost goes away. */
  useEffect(() => {
    if (!show) {
      setAnnouncement("");
      return;
    }
    setAnnouncement((current) =>
      current === "" ? `Suggestion: ${suggestion}. Tab accepts, Escape dismisses.` : current,
    );
  }, [show, suggestion]);

  useEffect(() => {
    if (!pendingCaret.current) return;
    pendingCaret.current = false;
    const el = fieldRef.current;
    if (!el) return;
    const end = el.value.length;
    el.focus();
    el.setSelectionRange(end, end);
    setCaretAtEnd(true);
  }, [text]);

  const accept = () => {
    if (!show) return;
    pendingCaret.current = true;
    commit(text + suggestion);
    setDismissed(true);
    onAccept?.(suggestion);
  };

  const dismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const plain = !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey;
    if (show && event.key === "Tab" && plain) {
      event.preventDefault();
      accept();
      return;
    }
    if (show && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    }
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    /* A host that ignores the accepted text leaves the flag set; a real keystroke is the
     * signal that the caret is the user's again. */
    pendingCaret.current = false;
    commit(event.target.value);
  };

  const field = multiline ? (
    <textarea
      ref={setField}
      className="ui-gtx__input"
      value={text}
      rows={1}
      wrap="soft"
      placeholder={placeholder}
      aria-label={placeholder}
      aria-autocomplete="inline"
      aria-describedby={show ? liveId : undefined}
      spellCheck={false}
      autoComplete="off"
      autoCapitalize="off"
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onSelect={syncCaret}
      onClick={syncCaret}
      onKeyUp={syncCaret}
      onScroll={syncScroll}
    />
  ) : (
    <input
      ref={setField}
      className="ui-gtx__input"
      type="text"
      value={text}
      placeholder={placeholder}
      aria-label={placeholder}
      aria-autocomplete="inline"
      aria-describedby={show ? liveId : undefined}
      spellCheck={false}
      autoComplete="off"
      autoCapitalize="off"
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onSelect={syncCaret}
      onClick={syncCaret}
      onKeyUp={syncCaret}
      onScroll={syncScroll}
    />
  );

  return (
    <div
      className={["ui-gtx", className].filter(Boolean).join(" ")}
      data-multiline={multiline ? "true" : "false"}
      data-suggesting={show ? "true" : "false"}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-ghost-text" precedence="default">
        {css}
      </style>

      <div className="ui-gtx__field">
        {show ? (
          <div className="ui-gtx__overlay" aria-hidden="true" style={{ right: gutter }}>
            <div className="ui-gtx__mirror" ref={layerRef}>
              <div className="ui-gtx__committed" ref={committedRef}>{text}</div>
              <div className="ui-gtx__sizer">
                {text}
                <span className="ui-gtx__marker" ref={markerRef} />
              </div>
              <span
                className="ui-gtx__hint"
                style={{ transform: `translate(${caret.x}px, ${caret.y}px)` }}
              >
                <span className="ui-gtx__hint-text">{suggestion}</span>
              </span>
            </div>
          </div>
        ) : null}

        {field}
      </div>

      <div className="ui-gtx__bar" aria-hidden="true">
        <span className="ui-gtx__source">predict_word</span>
        {show ? (
          <span className="ui-gtx__keys">
            <span className="ui-gtx__key">
              <kbd>Tab</kbd> accept
            </span>
            <span className="ui-gtx__key">
              <kbd>Esc</kbd> dismiss
            </span>
          </span>
        ) : (
          <span className="ui-gtx__idle">
            <span className="ui-gtx__dot" />
            idle
          </span>
        )}
      </div>

      <p className="ui-gtx__live" id={liveId} role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

const css = /* css */ `
.ui-gtx {
  /* Knobs. Override any of these on .ui-gtx to retheme the field in a host. */
  --ui-gtx-ink: var(--text, #1a1410);
  --ui-gtx-muted: var(--text-muted, #6f625a);
  --ui-gtx-panel: var(--panel, #fffdfb);
  --ui-gtx-line: var(--border, #e8e0d7);
  --ui-gtx-wash: #7a4a1c0a;
  --ui-gtx-ghost: #6f625a;
  --ui-gtx-accent: var(--accent, #c2410c);
  --ui-gtx-ring: #c2410c1f;
  --ui-gtx-select: #c2410c2e;
  --ui-gtx-pad-x: 12px;
  --ui-gtx-pad-y: 11px;
  --ui-gtx-radius: var(--radius-input, 12px);
  --ui-gtx-size: 14px;
  --ui-gtx-leading: 22px;
  --ui-gtx-cap: 168px;
  --ui-gtx-dur: var(--nm-dur-2, 160ms);
  --ui-gtx-dur-in: var(--nm-dur-3, 240ms);
  --ui-gtx-ease: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-gtx-font: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

  position: relative;
  box-sizing: border-box;
  display: block;
  width: 100%;
  color: var(--ui-gtx-ink);
  font-family: var(--ui-gtx-font);
  font-size: var(--ui-gtx-size);
  line-height: var(--ui-gtx-leading);
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
}
.ui-gtx *,
.ui-gtx *::before,
.ui-gtx *::after {
  box-sizing: border-box;
}
:where(.ui-gtx) p {
  margin: 0;
}
:where(.ui-gtx) kbd {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

/* The field --------------------------------------------------------------- */
.ui-gtx__field {
  position: relative;
  border-radius: var(--ui-gtx-radius);
  background: var(--ui-gtx-panel);
}
/* Transparent, so the ghost painted underneath reads through the same surface. */
.ui-gtx__input {
  position: relative;
  display: block;
  width: 100%;
  margin: 0;
  padding: var(--ui-gtx-pad-y) var(--ui-gtx-pad-x);
  border: 1px solid var(--ui-gtx-line);
  border-radius: var(--ui-gtx-radius);
  background: transparent;
  color: var(--ui-gtx-ink);
  font-family: inherit;
  font-size: var(--ui-gtx-size);
  line-height: var(--ui-gtx-leading);
  letter-spacing: -0.01em;
  caret-color: var(--ui-gtx-accent);
  resize: none;
  transition:
    border-color var(--ui-gtx-dur) var(--ui-gtx-ease),
    box-shadow var(--ui-gtx-dur) var(--ui-gtx-ease);
}
.ui-gtx[data-multiline="true"] .ui-gtx__input {
  max-height: var(--ui-gtx-cap);
  overflow-y: auto;
  overflow-x: hidden;
}
.ui-gtx[data-multiline="false"] .ui-gtx__input {
  overflow: hidden;
  white-space: pre;
}
.ui-gtx__input::placeholder {
  color: var(--ui-gtx-muted);
  opacity: 1;
}
/* An empty field with a suggestion shows the ghost, not the prompt. */
.ui-gtx[data-suggesting="true"] .ui-gtx__input::placeholder {
  color: transparent;
}
.ui-gtx__input::selection {
  background: var(--ui-gtx-select);
  color: var(--ui-gtx-ink);
}
.ui-gtx__input:focus {
  outline: none;
}
.ui-gtx__input:focus-visible {
  border-color: var(--ui-gtx-accent);
  box-shadow: 0 0 0 3px var(--ui-gtx-ring);
}

/* The ghost --------------------------------------------------------------- */
.ui-gtx__overlay {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: var(--ui-gtx-radius);
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
}
/* Font metrics only: the border and padding live on the committed text and the sizer,
 * so both start exactly where the field's text starts. */
.ui-gtx__mirror {
  position: absolute;
  inset: 0;
  font-family: inherit;
  font-size: var(--ui-gtx-size);
  line-height: var(--ui-gtx-leading);
  letter-spacing: -0.01em;
  will-change: transform;
}
.ui-gtx__committed {
  padding: var(--ui-gtx-pad-y) var(--ui-gtx-pad-x);
  border: 1px solid transparent;
  color: transparent;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: normal;
}
/* The sizer repeats the committed text only to be measured; it never paints. It carries
 * the field's border width and padding so its first glyph starts on the field's. */
.ui-gtx__sizer {
  position: absolute;
  inset: 0;
  padding: var(--ui-gtx-pad-y) var(--ui-gtx-pad-x);
  border: 1px solid transparent;
  visibility: hidden;
  pointer-events: none;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: normal;
}
.ui-gtx[data-multiline="false"] .ui-gtx__committed,
.ui-gtx[data-multiline="false"] .ui-gtx__sizer {
  white-space: pre;
}
/* Sits at the caret and takes the top of its line box, so the measured top needs no
 * font-metric correction. */
.ui-gtx__marker {
  display: inline-block;
  width: 0;
  height: 1px;
  vertical-align: top;
}
.ui-gtx__hint {
  position: absolute;
  top: 0;
  left: 0;
  color: var(--ui-gtx-ghost);
  white-space: pre;
  pointer-events: none;
}
.ui-gtx__hint-text {
  display: inline-block;
  animation: ui-gtx-in var(--ui-gtx-dur-in) var(--ui-gtx-ease) both;
}
@keyframes ui-gtx-in {
  from {
    opacity: 0;
    transform: translateY(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Affordance -------------------------------------------------------------- */
.ui-gtx__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 16px;
  margin-top: 7px;
  padding: 0 2px;
  color: var(--ui-gtx-muted);
  font-size: 10.5px;
  line-height: 16px;
}
.ui-gtx__source {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0;
}
.ui-gtx__keys,
.ui-gtx__key,
.ui-gtx__idle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.ui-gtx__keys {
  gap: 10px;
}
.ui-gtx__key kbd {
  display: inline-block;
  padding: 0 4px;
  border: 0;
  border-radius: 4px;
  background: var(--ui-gtx-wash);
  box-shadow: inset 0 0 0 1px var(--ui-gtx-line);
  color: var(--ui-gtx-ink);
  font-size: 10px;
  line-height: 15px;
  letter-spacing: 0;
}
.ui-gtx__dot {
  width: 4px;
  height: 4px;
  border-radius: 999px;
  box-shadow: inset 0 0 0 1px var(--ui-gtx-muted);
}

/* Announced, never painted. */
.ui-gtx__live {
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

:where(.dark, [data-theme="dark"]) .ui-gtx {
  --ui-gtx-ink: var(--text, #f4ece4);
  --ui-gtx-muted: var(--text-muted, #a2958a);
  --ui-gtx-panel: var(--panel, #1a1512);
  --ui-gtx-line: var(--border, #33291f);
  --ui-gtx-wash: #ffffff0d;
  --ui-gtx-ghost: var(--text-muted, #a2958a);
  --ui-gtx-accent: var(--accent, #ff6b35);
  --ui-gtx-ring: #ff6b3524;
  --ui-gtx-select: #ff6b3533;
}

@media (prefers-reduced-motion: reduce) {
  .ui-gtx__hint-text {
    animation: none;
  }
  .ui-gtx__input {
    transition-duration: 1ms;
  }
}
`;
