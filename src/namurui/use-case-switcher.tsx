"use client";

import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

/*
 * Use Case Switcher: a column of copy on the left and a preview slot on the right, joined by a row
 * of chips. The chips are a tablist: one is selected, the rest are reachable with the arrow keys,
 * and choosing one cross-fades the headline and body beside it. The preview is rendered outside
 * that swap, so whatever a caller mounts there keeps its own state across a switch. Chips pop in
 * once on mount, staggered from the left, and the active one takes the accent ground with an inset
 * ring. Styles are injected below, so no extra files are needed.
 */

export type UseCase = {
  /** Stable key for the chip, and what `defaultId` matches against */
  id: string;
  /** Chip text, kept short enough to sit in one row of eight */
  label: string;
  /** The line the switch swaps in, one sentence */
  headline: string;
  /** Two or three sentences of concrete detail under the headline */
  body: string;
};

export type UseCaseSwitcherProps = {
  /** The flows on offer, in the order they appear */
  useCases: readonly UseCase[];
  /** Which flow starts selected; falls back to the first one */
  defaultId?: string;
  /** Called with the flow that was picked, as the panel swaps */
  onChange?: (useCase: UseCase) => void;
  /** The phone or mock that sits beside the copy; it is never re-mounted */
  preview?: ReactNode;
  /** Section heading, measured to about 22 characters a line */
  title: string;
  /** Small note under the heading, read at half ink */
  caption?: string;
  /** The action under the panel, usually one link or button */
  cta?: ReactNode;
  /** Extra class on the root */
  className?: string;
};

export function UseCaseSwitcher({
  useCases,
  defaultId,
  onChange,
  preview,
  title,
  caption,
  cta,
  className,
}: UseCaseSwitcherProps) {
  const uid = useId();
  const [pickedId, setPickedId] = useState<string | null>(defaultId ?? null);
  const [leaving, setLeaving] = useState<UseCase | null>(null);
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([]);

  /* A `defaultId` that no longer exists, or none at all, settles on the first flow */
  const foundIndex = useCases.findIndex((item) => item.id === pickedId);
  const active = foundIndex >= 0 ? useCases[foundIndex] : useCases.length > 0 ? useCases[0] : null;
  const activeIndex = active ? useCases.indexOf(active) : -1;
  const activeKey = active ? active.id : null;

  const choose = (item: UseCase, index: number, moveFocus: boolean) => {
    if (item.id !== activeKey) {
      /* The outgoing copy stays for one fade, stacked in the same cell as the incoming one */
      if (active) setLeaving(active);
      setPickedId(item.id);
      onChange?.(item);
    }
    if (moveFocus) chipRefs.current[index]?.focus();
  };

  const onChipKey = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = useCases.length - 1;
    let next = index;

    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;

    const target = useCases[next];
    if (!target) return;

    event.preventDefault();
    choose(target, next, true);
  };

  return (
    <div className={["ui-ucs", className].filter(Boolean).join(" ")}>
      <style href="ui-use-case-switcher" precedence="default">
        {css}
      </style>

      <div className="ui-ucs__grid">
        <div className="ui-ucs__copy">
          <h2 className="ui-ucs__title">{title}</h2>
          {caption ? <p className="ui-ucs__caption">{caption}</p> : null}

          <div className="ui-ucs__chips" role="tablist" aria-label="Use cases">
            {useCases.map((item, index) => {
              const selected = item.id === activeKey;
              return (
                <button
                  key={item.id}
                  ref={(node) => {
                    chipRefs.current[index] = node;
                  }}
                  type="button"
                  role="tab"
                  id={`${uid}-tab-${index}`}
                  aria-selected={selected}
                  aria-controls={`${uid}-panel`}
                  tabIndex={selected ? 0 : -1}
                  className="ui-ucs__chip"
                  data-state={selected ? "on" : "off"}
                  style={{ "--i": index } as CSSProperties}
                  onClick={() => choose(item, index, false)}
                  onKeyDown={(event) => onChipKey(event, index)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div
            className="ui-ucs__detail"
            id={`${uid}-panel`}
            role="tabpanel"
            aria-labelledby={activeIndex >= 0 ? `${uid}-tab-${activeIndex}` : undefined}
            tabIndex={0}
          >
            {leaving ? (
              <div
                key={leaving.id}
                className="ui-ucs__leaving"
                aria-hidden="true"
                onAnimationEnd={(event) => {
                  if (event.target === event.currentTarget) setLeaving(null);
                }}
              >
                <p className="ui-ucs__headline">{leaving.headline}</p>
                <p className="ui-ucs__body">{leaving.body}</p>
              </div>
            ) : null}
            {active ? (
              <div key={active.id} className="ui-ucs__swap">
                <p className="ui-ucs__headline">{active.headline}</p>
                <p className="ui-ucs__body">{active.body}</p>
              </div>
            ) : null}
          </div>

          {cta ? <div className="ui-ucs__cta">{cta}</div> : null}

          <p className="ui-ucs__sr" role="status" aria-live="polite">
            {active ? `${active.label}: ${active.headline}` : ""}
          </p>
        </div>

        {preview ? (
          <div className="ui-ucs__preview">
            <div className="ui-ucs__stage">{preview}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const css = /* css */ `
.ui-ucs {
  /* Knobs. Override any of these on .ui-ucs to retheme the block in a host. */
  --ui-ucs-ink: var(--text, #1a1410);
  --ui-ucs-muted: var(--text-muted, #6f625a);
  --ui-ucs-card: var(--card, #ffffff);
  --ui-ucs-edge: var(--border-soft, #1a14101a);
  --ui-ucs-hover: var(--hover-bg, #7a4a1c12);
  --ui-ucs-accent: var(--accent, #c2410c);
  --ui-ucs-accent-strong: var(--accent-hover, #9a3412);
  --ui-ucs-accent-fg: var(--accent-fg, #fffdfb);
  --ui-ucs-focus: var(--accent, #c2410c);
  --ui-ucs-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-ucs-ease-in: var(--nm-ease-in, cubic-bezier(0.55, 0, 0.68, 0.19));
  --ui-ucs-spring: var(--nm-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  --ui-ucs-dur-2: var(--nm-dur-2, 160ms);
  --ui-ucs-dur-3: var(--nm-dur-3, 240ms);
  --ui-ucs-stagger: var(--nm-stagger, 45ms);

  position: relative;
  box-sizing: border-box;
  width: 100%;
  color: var(--ui-ucs-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-ucs *,
.ui-ucs *::before,
.ui-ucs *::after {
  box-sizing: border-box;
}
.ui-ucs p {
  margin: 0;
}
:where(.ui-ucs) button {
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

/* Layout ------------------------------------------------------------------ */
.ui-ucs__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: 32px;
}
.ui-ucs__copy {
  min-width: 0;
}
/* The slot stretches to the copy's height, which is the row height, so a mock inside it can grow
 * with the copy instead of leaving a void under a short frame. It stays optional in the grid. */
.ui-ucs__preview {
  position: relative;
  width: 100%;
  max-width: 18.5rem;
  margin-inline: auto;
  align-self: stretch;
}

@media (min-width: 1024px) {
  .ui-ucs__grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
  /* The stage is taken out of flow, so the height of the mock never sets the row: the copy does,
   * and a mock that asks for height: 100% gets exactly the copy's height. */
  .ui-ucs__stage {
    position: absolute;
    inset: 0;
  }
}

/* Heading ----------------------------------------------------------------- */
.ui-ucs__title {
  max-width: 22ch;
  font-size: 1.9rem;
  font-weight: 600;
  line-height: 1.16;
  letter-spacing: -0.02em;
  text-wrap: balance;
}
.ui-ucs__caption {
  margin-top: 16px;
  font-size: 0.875rem;
  line-height: 1.5;
  opacity: 0.5;
}

/* Chips ------------------------------------------------------------------- */
.ui-ucs__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 24px;
}
.ui-ucs__chip {
  display: inline-flex;
  align-items: center;
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  background: var(--ui-ucs-card);
  box-shadow: inset 0 0 0 1px var(--ui-ucs-edge);
  color: var(--ui-ucs-muted);
  font-size: 0.82rem;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  opacity: 0;
  transform: translateY(6px) scale(0.96);
  animation: ui-ucs-pop var(--ui-ucs-dur-3) var(--ui-ucs-spring) both;
  animation-delay: calc(var(--i, 0) * var(--ui-ucs-stagger));
  transition:
    background-color var(--ui-ucs-dur-2) var(--ui-ucs-ease-out),
    color var(--ui-ucs-dur-2) var(--ui-ucs-ease-out),
    box-shadow var(--ui-ucs-dur-2) var(--ui-ucs-ease-out);
}
.ui-ucs__chip[data-state="off"]:hover {
  background: var(--ui-ucs-hover);
  color: var(--ui-ucs-ink);
}
.ui-ucs__chip[data-state="on"] {
  background: var(--ui-ucs-accent);
  box-shadow:
    inset 0 0 0 1px var(--ui-ucs-accent-strong),
    0 1px 2px #3d1f0a14;
  color: var(--ui-ucs-accent-fg);
}
.ui-ucs__chip[data-state="on"]:hover {
  background: var(--ui-ucs-accent-strong);
}
.ui-ucs__chip:focus-visible {
  outline: 2px solid var(--ui-ucs-focus);
  outline-offset: 2px;
}

/* Detail ------------------------------------------------------------------ */
.ui-ucs__detail {
  display: grid;
  max-width: 42rem;
  margin-top: 28px;
}
.ui-ucs__detail:focus-visible {
  outline: 2px solid var(--ui-ucs-focus);
  outline-offset: 6px;
}
/* Both layers share one cell. The outgoing copy leaves first and the incoming one starts as it
 * ends, so two blocks of text are never legible on top of each other mid-switch. */
.ui-ucs__swap,
.ui-ucs__leaving {
  grid-area: 1 / 1;
  align-self: start;
}
.ui-ucs__swap {
  animation: ui-ucs-swap var(--ui-ucs-dur-2) var(--ui-ucs-ease-out) var(--ui-ucs-dur-2) both;
}
.ui-ucs__leaving {
  pointer-events: none;
  animation: ui-ucs-leave var(--ui-ucs-dur-2) var(--ui-ucs-ease-in) both;
}
.ui-ucs__headline {
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: -0.01em;
}
.ui-ucs__body {
  margin-top: 10px;
  font-size: 1rem;
  line-height: 1.75;
  opacity: 0.62;
}

/* Action ------------------------------------------------------------------ */
.ui-ucs__cta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 32px;
}
.ui-ucs__sr {
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

@keyframes ui-ucs-pop {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes ui-ucs-swap {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes ui-ucs-leave {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-4px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ui-ucs__chip {
    opacity: 1;
    transform: none;
    animation: none;
    transition-duration: 1ms;
  }
  /* Kept as a 1ms animation rather than removed, so the leaving layer still reports its end */
  .ui-ucs__swap,
  .ui-ucs__leaving {
    animation-duration: 1ms;
    animation-delay: 0ms;
  }
}

:where(.dark, [data-theme="dark"]) .ui-ucs {
  --ui-ucs-ink: var(--text, #f4ece4);
  --ui-ucs-muted: var(--text-muted, #a2958a);
  --ui-ucs-card: var(--card, #201a15);
  --ui-ucs-edge: var(--border-soft, #ffffff12);
  --ui-ucs-hover: var(--hover-bg, #ffffff12);
  --ui-ucs-accent: var(--accent, #ff6b35);
  --ui-ucs-accent-strong: var(--accent-hover, #ff8256);
  --ui-ucs-accent-fg: var(--accent-fg, #1a0f08);
  --ui-ucs-focus: var(--accent, #ff6b35);
}
`;
