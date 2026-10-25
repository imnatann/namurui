"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

/*
 * FAQ Accordion: questions that fold open to their answer, one at a time by default.
 * Each header is a real button that owns the panel below it, and the panel opens to a height
 * measured from its own content, so a long answer and a short one both settle without a jump.
 * The plus in the corner turns a quarter turn into a cross while the panel moves; the height is
 * re-measured whenever the answer reflows, so a narrow window never clips a line.
 * Styles are injected below, so no extra files are needed.
 */

export type FaqEntry = {
  /** The question, in the reader's own wording */
  question: string;
  /** The answer; a paragraph, several, or a short list */
  answer: ReactNode;
};

export type FaqAccordionProps = {
  /** Questions in reading order; the index is the identity */
  items: readonly FaqEntry[];
  /** Keep at most one panel open; turning it on closes all but the last opened */
  single?: boolean;
  /** Index of the panel that starts open; omit for a fully folded list */
  defaultOpen?: number;
  /** Extra class on the root */
  className?: string;
};

export function FaqAccordion({
  items,
  single = true,
  defaultOpen,
  className,
}: FaqAccordionProps) {
  /* `useId` can carry punctuation, which an id and an `aria-controls` both dislike */
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [open, setOpen] = useState<number[]>(() => {
    if (typeof defaultOpen !== "number" || !Number.isInteger(defaultOpen)) return [];
    return defaultOpen >= 0 && defaultOpen < items.length ? [defaultOpen] : [];
  });
  /* Transitions are armed one frame after mount, so a panel that starts open is already at its
   * measured height on the first paint instead of unfolding on load. */
  const [armed, setArmed] = useState(false);

  const triggers = useRef<Array<HTMLButtonElement | null>>([]);
  const panels = useRef<Array<HTMLDivElement | null>>([]);
  const answers = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  /* Every panel is measured, open or not: a folded panel still lays its answer out at the full
   * width, so the height is ready before the reader asks for it. The measured height is written
   * into a custom property that the sheet reads as `max-height`, and the observer keeps it true
   * when the answer re-wraps at another width or after a web font lands. */
  useLayoutEffect(() => {
    const nodes = answers.current;

    const measure = (index: number) => {
      const node = nodes[index];
      const panel = panels.current[index];
      if (!node || !panel) return;
      /* `scrollHeight` rounds to whole pixels and a 14.4px line at 1.6 is 163.2, so rounding
       * down shaved the last descender; the rect keeps the fraction and ceil never clips. */
      const height = Math.ceil(node.getBoundingClientRect().height);
      panel.style.setProperty("--ui-faq-h", `${height}px`);
    };

    nodes.forEach((node, index) => {
      if (node) measure(index);
    });

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const index = nodes.findIndex((node) => node === entry.target);
        if (index >= 0) measure(index);
      }
    });

    for (const node of nodes) {
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [items.length]);

  /* `single` is derived rather than enforced in an effect: flipping the prop with two panels
   * open folds the older one in the same paint, with no frame where both are visible. */
  const shown = single ? open.slice(-1) : open;
  const isOpen = (index: number) => shown.includes(index);

  const toggle = (index: number) => {
    setOpen((current) => {
      const visible = single ? current.slice(-1) : current;
      if (visible.includes(index)) {
        return single ? [] : current.filter((value) => value !== index);
      }
      return single ? [index] : [...current, index];
    });
  };

  /* The arrows and the two ends walk between the headers and focus follows, so a reader can
   * cross the whole list without tabbing out; every header stays in the tab order as well. */
  const move = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = items.length - 1;
    let next: number;
    switch (event.key) {
      case "ArrowDown":
        next = index === last ? 0 : index + 1;
        break;
      case "ArrowUp":
        next = index === 0 ? last : index - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    triggers.current[next]?.focus();
  };

  return (
    <div
      className={["ui-faq", className].filter(Boolean).join(" ")}
      data-single={single ? "true" : "false"}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-faq-accordion" precedence="default">
        {css}
      </style>
      {items.map((entry, index) => {
        const openNow = isOpen(index);
        const questionId = `faq-${uid}-q-${index}`;
        const answerId = `faq-${uid}-a-${index}`;
        return (
          <div className="ui-faq__item" data-open={openNow ? "true" : "false"} key={index}>
            <h3 className="ui-faq__heading">
              <button
                type="button"
                id={questionId}
                className="ui-faq__trigger"
                aria-expanded={openNow}
                aria-controls={answerId}
                onClick={() => toggle(index)}
                onKeyDown={(event) => move(event, index)}
                ref={(node) => {
                  triggers.current[index] = node;
                }}
              >
                <span className="ui-faq__question">{entry.question}</span>
                <span className="ui-faq__mark" aria-hidden="true">
                  <svg
                    viewBox="0 0 12 12"
                    width="12"
                    height="12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  >
                    <path d="M6 1.4v9.2" />
                    <path d="M1.4 6h9.2" />
                  </svg>
                </span>
              </button>
            </h3>
            <div
              className="ui-faq__panel"
              id={answerId}
              role="region"
              aria-labelledby={questionId}
              data-open={openNow ? "true" : "false"}
              data-armed={armed ? "true" : undefined}
              inert={openNow ? undefined : true}
              ref={(node) => {
                panels.current[index] = node;
              }}
            >
              <div
                className="ui-faq__answer"
                ref={(node) => {
                  answers.current[index] = node;
                }}
              >
                {entry.answer}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const css = /* css */ `
.ui-faq {
  /* Knobs. Override any of these on .ui-faq to retheme the list in a host. */
  --ui-faq-ink: var(--text, #1a1410);
  --ui-faq-muted: var(--text-muted, #6f625a);
  --ui-faq-panel: var(--panel, #fffdfb);
  /* A hairline at --border alone measures 1.27:1 on the card, too faint to carry nine rows;
   * one tenth of the text colour folded in brings it to 1.57:1 without inventing a hue. */
  --ui-faq-line: color-mix(in srgb, var(--text, #1a1410) 10%, var(--border, #e8e0d7));
  --ui-faq-edge: var(--border-soft, #1a14101a);
  --ui-faq-hover: var(--hover-bg, #7a4a1c12);
  --ui-faq-wash: color-mix(in srgb, var(--accent, #c2410c) 9%, transparent);
  --ui-faq-ring: color-mix(in srgb, var(--accent, #c2410c) 28%, transparent);
  --ui-faq-accent: var(--accent, #c2410c);
  --ui-faq-focus: var(--accent, #c2410c);
  --ui-faq-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-faq-ease-both: var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1));
  --ui-faq-dur-2: var(--nm-dur-2, 160ms);
  --ui-faq-dur-4: var(--nm-dur-4, 380ms);

  position: relative;
  box-sizing: border-box;
  width: 100%;
  overflow: hidden;
  background: var(--ui-faq-panel, #fffdfb);
  border-radius: var(--radius-card, 16px);
  box-shadow: inset 0 0 0 1px var(--ui-faq-line, #e8e0d7);
  color: var(--ui-faq-ink, #1a1410);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 0.95rem;
  line-height: 1.5rem;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-faq *,
.ui-faq *::before,
.ui-faq *::after {
  box-sizing: border-box;
}
.ui-faq p {
  margin: 0;
}
:where(.ui-faq) button {
  margin: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
:where(.ui-faq) svg {
  display: block;
}

/* Rows -------------------------------------------------------------------- */
.ui-faq__item {
  position: relative;
}
.ui-faq__item + .ui-faq__item {
  box-shadow: inset 0 1px 0 var(--ui-faq-line, #e8e0d7);
}
.ui-faq__heading {
  margin: 0;
  font: inherit;
}
.ui-faq__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  min-height: 70px;
  padding: 14px 20px;
  color: var(--ui-faq-ink, #1a1410);
  text-align: left;
  transition: background-color var(--ui-faq-dur-2, 160ms) var(--ui-faq-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-faq__trigger:hover {
  background: var(--ui-faq-hover, #7a4a1c0a);
}
.ui-faq__trigger:focus-visible {
  outline: 2px solid var(--ui-faq-focus, #c2410c);
  outline-offset: -3px;
}
.ui-faq__question {
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.5rem;
  letter-spacing: -0.012em;
  overflow-wrap: anywhere;
}

/* The plus is one glyph turned a quarter turn; the box around it stays square. */
.ui-faq__mark {
  display: grid;
  flex: none;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: var(--ui-faq-muted, #6f625a);
  box-shadow: inset 0 0 0 1px var(--ui-faq-edge, #1a14101a);
  transition:
    color var(--ui-faq-dur-2, 160ms) var(--ui-faq-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    background-color var(--ui-faq-dur-2, 160ms) var(--ui-faq-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    box-shadow var(--ui-faq-dur-2, 160ms) var(--ui-faq-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-faq__trigger:hover .ui-faq__mark {
  color: var(--ui-faq-ink, #1a1410);
}
.ui-faq__item[data-open="true"] .ui-faq__mark {
  color: var(--ui-faq-accent, #c2410c);
  background: var(--ui-faq-wash, #c2410c17);
  box-shadow: inset 0 0 0 1px var(--ui-faq-ring, #c2410c47);
}
.ui-faq__mark svg {
  transition: transform var(--ui-faq-dur-4, 380ms) var(--ui-faq-ease-both, cubic-bezier(0.65, 0, 0.35, 1));
}
.ui-faq__item[data-open="true"] .ui-faq__mark svg {
  transform: rotate(45deg);
}

/* Panel ------------------------------------------------------------------- */
.ui-faq__panel {
  max-height: 0;
  overflow: hidden;
}
.ui-faq__panel[data-armed="true"] {
  transition: max-height var(--ui-faq-dur-4, 380ms) var(--ui-faq-ease-both, cubic-bezier(0.65, 0, 0.35, 1));
}
.ui-faq__panel[data-open="true"] {
  max-height: var(--ui-faq-h, 0px);
}
.ui-faq__answer {
  padding: 0 20px 22px;
  color: var(--ui-faq-muted, #6f625a);
  /* 1.6 on 14.4px: at the old 28px leading a three line answer read as three loose lines
   * rather than one block, which is what made it thin in the dark theme. */
  font-size: 0.9rem;
  line-height: 1.6;
}
.ui-faq__answer > * {
  /* A 66ch measure: at this size a full-width line in a 768 card ran to about ninety
   * characters, which the eye loses on the return. */
  max-width: 66ch;
}
.ui-faq__answer > :first-child {
  margin-top: 0;
}
.ui-faq__answer > :last-child {
  margin-bottom: 0;
}
.ui-faq__answer p + p {
  margin-top: 10px;
}
.ui-faq__answer ul,
.ui-faq__answer ol {
  margin: 8px 0 0;
  padding-left: 18px;
}
/* A closing paragraph after a list had no gap at all and sat against the last bullet. */
.ui-faq__answer ul + p,
.ui-faq__answer ol + p {
  margin-top: 10px;
}
.ui-faq__answer li + li {
  margin-top: 4px;
}
.ui-faq__answer a {
  color: var(--ui-faq-accent, #c2410c);
  text-underline-offset: 3px;
}

@media (max-width: 420px) {
  /* At 320px the card is about 230 wide; 20px a side took a fifth of the line, so the
   * questions wrapped to three lines beside the plus. */
  .ui-faq__trigger {
    gap: 12px;
    min-height: 60px;
    padding: 12px 14px;
  }
  .ui-faq__answer {
    padding: 0 14px 18px;
  }
}

:where(.dark, [data-theme="dark"]) .ui-faq {
  --ui-faq-ink: var(--text, #f4ece4);
  --ui-faq-muted: var(--text-muted, #a2958a);
  --ui-faq-panel: var(--panel, #1a1512);
  --ui-faq-line: color-mix(in srgb, var(--text, #f4ece4) 10%, var(--border, #33291f));
  --ui-faq-edge: var(--border-soft, #ffffff12);
  --ui-faq-wash: color-mix(in srgb, var(--accent, #ff6b35) 14%, transparent);
  --ui-faq-ring: color-mix(in srgb, var(--accent, #ff6b35) 34%, transparent);
  --ui-faq-accent: var(--accent, #ff6b35);
  --ui-faq-focus: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  .ui-faq__trigger,
  .ui-faq__mark,
  .ui-faq__mark svg,
  .ui-faq__panel[data-armed="true"] {
    transition-duration: 1ms;
  }
}
`;
