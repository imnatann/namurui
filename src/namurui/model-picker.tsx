"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/*
 * Model Picker – the model menu of a chat toolbar, in a single self-contained file.
 * The trigger shows the model you are on; the card lists the models in a tight column with three
 * five-segment meters beside each name. Point at a row and it lights: its speed, quality and cost
 * bars run up segment by segment while the rows you are not considering step back, and the tray at
 * the foot rolls the first-token time and the price to the row under the cursor – so what a model
 * costs is readable before you commit. Extended thinking unfolds an effort control below its switch,
 * and the trigger grows a small bulb flag when it is on. The roll of a changed name is a blur swap.
 * Arrow keys walk the rows, Enter takes one, Escape hands focus back to the trigger.
 */

/** How hard the model is asked to think – only shown while extended thinking is on. */
export type PickerEffort = "low" | "medium" | "high";

export type PickerModel = {
  /** Stable identity – this is what `value` holds */
  id: string;
  /** The name on the row and in the trigger */
  name: string;
  /** One short line under the name, e.g. "Everyday work" */
  description?: string;
  /** A mark on the tile – defaults to the name's initial, or a spark for a router */
  icon?: ReactNode;
  /** 1–5. Leave speed, quality and cost out for a router like Auto */
  speed?: number;
  quality?: number;
  cost?: number;
  /** Milliseconds to the first token */
  latencyMs?: number;
  /** Dollars per million tokens */
  pricePerM?: number;
};

export type ModelPickerProps = {
  /** The models to choose from – rows keep this order */
  models: PickerModel[];
  /** Id of the chosen model (controlled) */
  value?: string;
  /** Chosen model when uncontrolled */
  defaultValue?: string;
  /** Called with the picked model's id, and the model itself */
  onChange?: (id: string, model: PickerModel | undefined) => void;
  /** Extended thinking switch (controlled) */
  thinking?: boolean;
  /** Starting state of the thinking switch */
  defaultThinking?: boolean;
  /** Called when the thinking switch flips */
  onThinkingChange?: (on: boolean) => void;
  /** Web search switch (controlled) */
  webSearch?: boolean;
  /** Starting state of the web search switch */
  defaultWebSearch?: boolean;
  /** Called when the web search switch flips */
  onWebSearchChange?: (on: boolean) => void;
  /** Thinking effort (controlled) – the control only unfolds while thinking is on */
  effort?: PickerEffort;
  /** Starting effort */
  defaultEffort?: PickerEffort;
  /** Called with the new effort */
  onEffortChange?: (effort: PickerEffort) => void;
  /** Controlled open state of the menu */
  open?: boolean;
  /** Starts open when uncontrolled */
  defaultOpen?: boolean;
  /** Called when the menu opens or closes */
  onOpenChange?: (open: boolean) => void;
  /** Which edge of the trigger the card lines up with */
  align?: "start" | "end";
  /** Opens below or above the trigger – use top for a composer at the foot of the screen */
  side?: "bottom" | "top";
  /** Extra class on the root */
  className?: string;
};

const SEGMENTS = [0, 1, 2, 3, 4] as const;
const MAX_SCORE = SEGMENTS.length;

const TRAITS = [
  { key: "speed", label: "Speed" },
  { key: "quality", label: "Quality" },
  { key: "cost", label: "Cost" },
] as const;

const EFFORTS: { id: PickerEffort; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

/** How long an outgoing name stays behind while the new one blurs in. */
const SWAP_MS = 240;

/* A router has no meters, and the tile, the bars and the caption all branch on the same question. */
const hasTraits = (model: PickerModel) => TRAITS.some((trait) => model[trait.key] != null);

export function ModelPicker({
  models,
  value,
  defaultValue,
  onChange,
  thinking,
  defaultThinking = false,
  onThinkingChange,
  webSearch,
  defaultWebSearch = false,
  onWebSearchChange,
  effort,
  defaultEffort = "medium",
  onEffortChange,
  open,
  defaultOpen = false,
  onOpenChange,
  align = "start",
  side = "bottom",
  className,
}: ModelPickerProps) {
  const uid = useId();

  const [innerId, setInnerId] = useState(defaultValue ?? models[0]?.id ?? "");
  const chosenId = value ?? innerId;
  const chosen = models.find((model) => model.id === chosenId) ?? models[0];

  const [innerThinking, setInnerThinking] = useState(defaultThinking);
  const thinks = thinking ?? innerThinking;

  const [innerSearch, setInnerSearch] = useState(defaultWebSearch);
  const searches = webSearch ?? innerSearch;

  const [innerEffort, setInnerEffort] = useState<PickerEffort>(defaultEffort);
  const level = effort ?? innerEffort;

  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const isOpen = open ?? innerOpen;

  /* The row under the cursor: the pointer's row while pointing, the keyboard's row while walking,
   * and the chosen row when neither has moved. */
  const [cursor, setCursor] = useState<string | null>(null);
  const [pointing, setPointing] = useState(false);
  const activeId = cursor && models.some((model) => model.id === cursor) ? cursor : chosenId;
  const active = models.find((model) => model.id === activeId) ?? chosen;

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* The effort thumb is placed from the real button boxes, the way the original measured them. */
  const segRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [thumb, setThumb] = useState({ x: 0, w: 0 });

  /* The outside-pointer listener is armed once per open, so the callback it reaches comes from a
   * ref that the effect below keeps current. */
  const openChangeRef = useRef(onOpenChange);

  useEffect(() => {
    openChangeRef.current = onOpenChange;
  });

  const setOpen = (next: boolean) => {
    if (open === undefined) setInnerOpen(next);
    openChangeRef.current?.(next);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [isOpen, open]);

  /* The card is only focusable once it is visible, so the list takes focus a frame after opening. */
  useEffect(() => {
    if (!isOpen) return;
    const frame = window.setTimeout(() => listRef.current?.focus({ preventScroll: true }), 0);
    return () => window.clearTimeout(frame);
  }, [isOpen]);

  useLayoutEffect(() => {
    const index = EFFORTS.findIndex((item) => item.id === level);
    const button = segRefs.current[index];
    if (!button) return;
    const place = () => setThumb({ x: button.offsetLeft, w: button.offsetWidth });
    place();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(place);
    observer.observe(button);
    return () => observer.disconnect();
  }, [level, isOpen, thinks]);

  const pick = (id: string) => {
    if (value === undefined) setInnerId(id);
    onChange?.(id, models.find((model) => model.id === id));
    setOpen(false);
    setCursor(null);
    setPointing(false);
    triggerRef.current?.focus();
  };

  const walk = (delta: number) => {
    const index = models.findIndex((model) => model.id === activeId);
    const next = models[Math.min(models.length - 1, Math.max(0, index + delta))];
    if (next) setCursor(next.id);
  };

  const onRootKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || !isOpen) return;
    event.preventDefault();
    setOpen(false);
    setPointing(false);
    setCursor(null);
    triggerRef.current?.focus();
  };

  /* Enter and Space already click the button; only the arrows need help, and they also hand the
   * cursor to the list so the frame after opening walks from the chosen row. */
  const onTriggerKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    setOpen(true);
  };

  const onListKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setPointing(false);
      walk(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setPointing(false);
      const edge = models[event.key === "Home" ? 0 : models.length - 1];
      if (edge) setCursor(edge.id);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (activeId) pick(activeId);
    }
  };

  const chooseEffort = (next: PickerEffort) => {
    if (effort === undefined) setInnerEffort(next);
    onEffortChange?.(next);
  };

  const onEffortKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + EFFORTS.length) % EFFORTS.length;
    chooseEffort(EFFORTS[next].id);
    segRefs.current[next]?.focus();
  };

  const toggleThinking = () => {
    const next = !thinks;
    if (thinking === undefined) setInnerThinking(next);
    onThinkingChange?.(next);
  };

  const toggleSearch = () => {
    const next = !searches;
    if (webSearch === undefined) setInnerSearch(next);
    onWebSearchChange?.(next);
  };

  const latency = active?.latencyMs;
  const rate = active?.pricePerM;
  const seconds = latency == null ? null : (latency / 1000).toFixed(1);
  const price = rate == null ? null : Number.isInteger(rate) ? String(rate) : rate.toFixed(1);

  const caption =
    seconds !== null && price !== null ? (
      <>
        <span>
          ~<b>{seconds}s</b> first token
        </span>
        <span className="ui-mdpc__dot"> · </span>
        <span>
          <b>${price}</b> / M tokens
        </span>
      </>
    ) : (
      <span>{active?.description ?? "Varies"}</span>
    );

  const spoken =
    seconds !== null && price !== null
      ? `${active?.name}: about ${seconds}s to the first token, $${price} per million tokens`
      : `${active?.name ?? "Model"}: ${active?.description ?? "varies"}; timing and price vary per message`;

  return (
    <div
      ref={rootRef}
      className={["ui-mdpc", className].filter(Boolean).join(" ")}
      data-align={align}
      data-side={side}
      data-open={isOpen ? "" : undefined}
      onKeyDown={onRootKey}
    >
      {/* React 19 hoists this into <head> once, no matter how many pickers render */}
      <style href="ui-model-picker" precedence="default">
        {css}
      </style>

      <button
        ref={triggerRef}
        type="button"
        className="ui-mdpc__trigger"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={`${uid}-menu`}
        aria-label={`Model: ${chosen?.name ?? "none"}`}
        onClick={() => setOpen(!isOpen)}
        onKeyDown={onTriggerKey}
      >
        <span className="ui-mdpc__glyph" aria-hidden="true">
          {chosen
            ? (chosen.icon ??
              (hasTraits(chosen) ? chosen.name.trim().slice(0, 1).toUpperCase() : <SparkIcon />))
            : null}
        </span>
        <span className="ui-mdpc__name">
          <span className="ui-mdpc__swap">
            <Swap token={chosen?.id ?? ""}>{chosen?.name ?? "Model"}</Swap>
          </span>
        </span>
        <span className="ui-mdpc__flag" aria-hidden="true" data-on={thinks ? "" : undefined}>
          <span>
            <BulbIcon />
          </span>
        </span>
        <svg
          className="ui-mdpc__chevron"
          width="14"
          height="14"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="m3 4.5 3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div id={`${uid}-menu`} className="ui-mdpc__pop" role="dialog" aria-label="Model settings">
        <div className="ui-mdpc__card">
          <div className="ui-mdpc__head" aria-hidden="true">
            <span>Model</span>
            <span className="ui-mdpc__cols">
              {TRAITS.map((trait) => (
                <span key={trait.key}>{trait.label}</span>
              ))}
            </span>
          </div>

          <div
            ref={listRef}
            className="ui-mdpc__list"
            role="listbox"
            aria-label="Model"
            tabIndex={0}
            aria-activedescendant={activeId ? `${uid}-opt-${activeId}` : undefined}
            data-pointing={pointing ? "" : undefined}
            onKeyDown={onListKey}
            onPointerLeave={() => {
              setPointing(false);
              setCursor(null);
            }}
          >
            {models.map((model) => {
              const isActive = model.id === activeId;
              const head = model.description ? `${model.name}, ${model.description}` : model.name;
              const label = hasTraits(model)
                ? `${head}. Speed ${model.speed}, quality ${model.quality}, cost ${model.cost} of ${MAX_SCORE}`
                : head;
              return (
                <div
                  key={model.id}
                  id={`${uid}-opt-${model.id}`}
                  role="option"
                  aria-selected={model.id === chosenId}
                  aria-label={label}
                  className="ui-mdpc__option"
                  data-active={isActive ? "" : undefined}
                  data-lit={isActive ? "" : undefined}
                  onPointerEnter={() => {
                    setPointing(true);
                    setCursor(model.id);
                  }}
                  onClick={() => pick(model.id)}
                >
                  <span className="ui-mdpc__glyph" aria-hidden="true">
                    {model.icon ??
                      (hasTraits(model) ? model.name.trim().slice(0, 1).toUpperCase() : <SparkIcon />)}
                  </span>
                  <span className="ui-mdpc__text">
                    <span className="ui-mdpc__title">
                      <span className="ui-mdpc__title-name">{model.name}</span>
                      {model.id === chosenId && <CheckIcon />}
                    </span>
                    <span className="ui-mdpc__desc">{model.description}</span>
                  </span>
                  {hasTraits(model) ? (
                    <span className="ui-mdpc__bars" aria-hidden="true">
                      {TRAITS.map((trait, column) => {
                        const score = model[trait.key];
                        return (
                          <span
                            key={trait.key}
                            className="ui-mdpc__meter"
                            style={{ "--c": String(column) } as CSSProperties}
                          >
                            {SEGMENTS.map((step) => (
                              <span
                                key={step}
                                className="ui-mdpc__seg"
                                data-on={score != null && step < score ? "" : undefined}
                                style={{ "--s": String(step) } as CSSProperties}
                              />
                            ))}
                          </span>
                        );
                      })}
                    </span>
                  ) : (
                    <span className="ui-mdpc__varies" aria-hidden="true">
                      Varies
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="ui-mdpc__settings">
            <button
              type="button"
              role="switch"
              aria-checked={thinks}
              className="ui-mdpc__toggle"
              onClick={toggleThinking}
            >
              <span className="ui-mdpc__toggle-icon">
                <BulbIcon />
              </span>
              <span className="ui-mdpc__toggle-label">Extended thinking</span>
              <span className="ui-mdpc__switch" aria-hidden="true" />
            </button>

            <div className="ui-mdpc__fold" inert={!thinks} data-open={thinks ? "" : undefined}>
              <div className="ui-mdpc__clip">
                <div className="ui-mdpc__effort">
                  <span className="ui-mdpc__effort-label" id={`${uid}-effort`}>
                    Effort
                  </span>
                  <div
                    className="ui-mdpc__segmented"
                    role="radiogroup"
                    aria-labelledby={`${uid}-effort`}
                    style={{ "--x": `${thumb.x}px`, "--w": `${thumb.w}px` } as CSSProperties}
                  >
                    <span className="ui-mdpc__thumb" aria-hidden="true" />
                    {EFFORTS.map((item, index) => (
                      <button
                        key={item.id}
                        ref={(node) => {
                          segRefs.current[index] = node;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={level === item.id}
                        tabIndex={level === item.id ? 0 : -1}
                        data-effort={item.id}
                        className="ui-mdpc__seg-btn"
                        onClick={() => chooseEffort(item.id)}
                        onKeyDown={(event) => onEffortKey(event, index)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={searches}
              className="ui-mdpc__toggle"
              onClick={toggleSearch}
            >
              <span className="ui-mdpc__toggle-icon">
                <GlobeIcon />
              </span>
              <span className="ui-mdpc__toggle-label">Web search</span>
              <span className="ui-mdpc__switch" aria-hidden="true" />
            </button>
          </div>

          <div className="ui-mdpc__foot">
            <span className="ui-mdpc__caption" aria-hidden="true">
              <span className="ui-mdpc__swap">
                <Swap token={active?.id ?? ""}>{caption}</Swap>
              </span>
            </span>
            <span className="ui-mdpc__keys" aria-hidden="true">
              <kbd>↑↓</kbd>
              <kbd>↵</kbd>
            </span>
            <span className="ui-mdpc__sr" aria-live="polite">
              {spoken}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/*
 * The blur swap: a name that changes keeps the outgoing line for a moment under `data-out`
 * while the new one draws in over it. Both sit in the same grid cell, so nothing reflows.
 */
function Swap({ token, children }: { token: string; children: ReactNode }) {
  const [seen, setSeen] = useState<{ token: string; node: ReactNode }>({ token, node: children });
  const [leaving, setLeaving] = useState<{ token: string; node: ReactNode } | null>(null);

  if (seen.token !== token) {
    setLeaving(seen);
    setSeen({ token, node: children });
  }

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setLeaving(null), SWAP_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  return (
    <>
      {leaving ? (
        <span className="ui-mdpc__swap-item" data-out="" key={`out-${leaving.token}`}>
          {leaving.node}
        </span>
      ) : null}
      <span className="ui-mdpc__swap-item" key={`in-${token}`}>
        {children}
      </span>
    </>
  );
}

/* The bulb: trigger flag and the extended-thinking switch share it. */
function BulbIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M5.3 10.6h3.4M5.8 12.3h2.4M7 1.7a3.9 3.9 0 0 0-2.3 7c.4.3.6.7.6 1.1v.1h3.4v-.1c0-.4.2-.8.6-1.1A3.9 3.9 0 0 0 7 1.7Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* The globe on the web-search switch. */
function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M1.9 7h10.2M7 1.7c1.4 1.5 2 3.3 2 5.3s-.6 3.8-2 5.3c-1.4-1.5-2-3.3-2-5.3s.6-3.8 2-5.3Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* The tick on the chosen row. */
function CheckIcon() {
  return (
    <svg className="ui-mdpc__check" width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="m3.4 7.3 2.4 2.4 4.8-5.2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* A router has no meters, so its tile carries a spark instead of an initial. */
function SparkIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 1.5 7.1 4.9 10.5 6 7.1 7.1 6 10.5 4.9 7.1 1.5 6 4.9 4.9Z" fill="currentColor" />
    </svg>
  );
}

const css = /* css */ `
.ui-mdpc{--ui-mdpc-card: #fffdfb;--ui-mdpc-strong: #0b0908;--ui-mdpc-ink: rgba(11, 9, 8, 0.88);--ui-mdpc-text: rgba(11, 9, 8, 0.61);--ui-mdpc-muted: rgba(11, 9, 8, 0.45);--ui-mdpc-faint: rgba(11, 9, 8, 0.27);--ui-mdpc-icon: rgba(11, 9, 8, 0.447);--ui-mdpc-line: rgba(11, 9, 8, 0.06);--ui-mdpc-line-strong: rgba(11, 9, 8, 0.1);--ui-mdpc-fill: rgba(11, 9, 8, 0.06);--ui-mdpc-wash: rgba(11, 9, 8, 0.03);--ui-mdpc-bar: rgba(11, 9, 8, 0.2);--ui-mdpc-bar-off: rgba(11, 9, 8, 0.06);--ui-mdpc-switch: rgba(11, 9, 8, 0.1);--ui-mdpc-knob: #fffdfb;--ui-mdpc-accent: rgba(217, 84, 31, 0.765);--ui-mdpc-focus: rgba(217, 84, 31, 0.35);--ui-mdpc-shadow-tile: 0 0 0 0.5px rgba(11, 9, 8, 0.1), 0 1px 1px -1px rgba(11, 9, 8, 0.1);--ui-mdpc-shadow-pop: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 12px 28px -10px rgba(11, 9, 8, 0.16), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-mdpc-ease: cubic-bezier(0.32, 0.72, 0.24, 1);position: relative;display: inline-block;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;font-weight: 400;color: var(--ui-mdpc-ink);text-align: left;-webkit-font-smoothing: antialiased}
.ui-mdpc *, .ui-mdpc *::before, .ui-mdpc *::after{box-sizing: border-box}
:where(.ui-mdpc) button{appearance: none;margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;text-align: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-mdpc button:focus-visible{outline: 2px solid var(--ui-mdpc-focus);outline-offset: 1px}
.ui-mdpc svg{display: block;flex: none}
.ui-mdpc b{font-weight: 500;color: var(--ui-mdpc-ink)}
.ui-mdpc__sr{position: absolute;width: 1px;height: 1px;overflow: hidden;clip-path: inset(50%);white-space: nowrap}
.ui-mdpc__trigger{display: inline-flex;align-items: center;gap: 6px;max-width: 100%;height: 28px;padding: 0 6px 0 6px;border-radius: 6px;font-weight: 500;color: var(--ui-mdpc-text);white-space: nowrap;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-mdpc__trigger:hover, .ui-mdpc[data-open] .ui-mdpc__trigger{background: var(--ui-mdpc-wash);color: var(--ui-mdpc-ink)}
.ui-mdpc__trigger .ui-mdpc__glyph{width: 18px;height: 18px;border-radius: 5px;font-size: 10px}
.ui-mdpc__trigger .ui-mdpc__glyph > svg{width: 10px;height: 10px}
.ui-mdpc__name{display: grid;min-width: 0}
.ui-mdpc__chevron{margin-left: -2px;color: var(--ui-mdpc-icon);transition: transform var(--nm-dur-3, 240ms) var(--ui-mdpc-ease)}
.ui-mdpc[data-open] .ui-mdpc__chevron{transform: rotate(180deg)}
.ui-mdpc__flag{display: grid;grid-template-columns: 0fr;margin-left: -6px;opacity: 0;color: var(--ui-mdpc-accent);transition: grid-template-columns var(--nm-dur-4, 380ms) var(--ui-mdpc-ease), margin var(--nm-dur-4, 380ms) var(--ui-mdpc-ease), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-mdpc__flag > span{min-width: 0;overflow: hidden}
.ui-mdpc__flag[data-on]{grid-template-columns: 1fr;margin-left: -2px;opacity: 1;transition: grid-template-columns var(--nm-dur-4, 380ms) var(--ui-mdpc-ease), margin var(--nm-dur-4, 380ms) var(--ui-mdpc-ease), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 80ms}
.ui-mdpc__glyph{display: grid;flex: none;place-items: center;width: 20px;height: 20px;overflow: hidden;border-radius: 5px;background: var(--ui-mdpc-card);box-shadow: var(--ui-mdpc-shadow-tile);font-size: 10px;font-weight: 500;line-height: 1;color: var(--ui-mdpc-strong)}
.ui-mdpc__glyph > svg, .ui-mdpc__glyph > img{width: 12px;height: 12px}
.ui-mdpc__pop{position: absolute;z-index: 30;top: calc(100% + 6px);left: 0;width: min(320px, calc(100vw - 32px));container-type: inline-size;border-radius: 10px;background: var(--ui-mdpc-card);box-shadow: var(--ui-mdpc-shadow-pop);transform-origin: top left;opacity: 0;visibility: hidden;transform: translateY(-4px) scale(0.96);transition: opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-3, 240ms) var(--ui-mdpc-ease), visibility 0s linear 220ms}
.ui-mdpc[data-align="end"] .ui-mdpc__pop{left: auto;right: 0;transform-origin: top right}
.ui-mdpc[data-side="top"] .ui-mdpc__pop{top: auto;bottom: calc(100% + 6px);transform-origin: bottom left;transform: translateY(4px) scale(0.96)}
.ui-mdpc[data-side="top"][data-align="end"] .ui-mdpc__pop{transform-origin: bottom right}
.ui-mdpc[data-open] .ui-mdpc__pop{opacity: 1;visibility: visible;transform: none;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-4, 380ms) var(--ui-mdpc-ease), visibility 0s}
.ui-mdpc__card{padding: 4px}
.ui-mdpc__head{display: flex;align-items: center;justify-content: space-between;gap: 12px;height: 28px;padding: 4px 8px 0;font-size: 10px;font-weight: 500;line-height: 16px;letter-spacing: 0.5px;text-transform: uppercase;color: var(--ui-mdpc-muted)}
.ui-mdpc__cols{display: grid;grid-template-columns: repeat(3, 40px);gap: 8px}
.ui-mdpc__cols > span{display: flex;justify-content: center;white-space: nowrap}
.ui-mdpc__list{display: grid;gap: 0;border-radius: 6px;outline: none}
.ui-mdpc__option{display: flex;align-items: center;gap: 10px;min-height: 44px;padding: 6px 8px;border-radius: 6px;cursor: pointer;transition: background-color 90ms ease-out, opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-mdpc__list[data-pointing] .ui-mdpc__option[data-active]{background: var(--ui-mdpc-fill)}
.ui-mdpc__list:focus-visible{outline: none}
.ui-mdpc__list:focus-visible .ui-mdpc__option[data-active]{background: var(--ui-mdpc-fill);box-shadow: inset 0 0 0 1px var(--ui-mdpc-focus)}
.ui-mdpc__list[data-pointing] .ui-mdpc__option:not([data-active]){opacity: 0.55}
.ui-mdpc__text{display: grid;flex: 1;min-width: 0}
.ui-mdpc__title{display: flex;align-items: center;gap: 4px;min-width: 0;font-weight: 500;color: var(--ui-mdpc-strong)}
.ui-mdpc__title-name{min-width: 0;overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-mdpc__check{color: var(--ui-mdpc-accent);animation: ui-mdpc-pop var(--nm-dur-4, 380ms) var(--ui-mdpc-ease) both}
.ui-mdpc__desc{overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-mdpc-text);white-space: nowrap;text-overflow: ellipsis}
.ui-mdpc__bars{display: grid;flex: none;grid-template-columns: repeat(3, 40px);gap: 8px}
.ui-mdpc__meter{display: grid;grid-template-columns: repeat(5, 1fr);gap: 2px;height: 4px}
.ui-mdpc__seg{border-radius: 1px;background: var(--ui-mdpc-bar-off);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-3, 240ms) var(--ui-mdpc-ease)}
.ui-mdpc__seg[data-on]{background: var(--ui-mdpc-bar)}
.ui-mdpc__option[data-lit] .ui-mdpc__seg[data-on]{background: var(--ui-mdpc-accent);transition-delay: calc(var(--c) * 70ms + var(--s) * 45ms);animation: ui-mdpc-fill var(--nm-dur-4, 380ms) var(--ui-mdpc-ease) both;animation-delay: calc(var(--c) * 70ms + var(--s) * 45ms)}
.ui-mdpc__varies{flex: none;width: 136px;font-size: 12px;line-height: 16px;color: var(--ui-mdpc-muted);text-align: center}
.ui-mdpc__settings{margin: 4px -4px 0;padding: 4px 4px 0;border-top: 0.5px solid var(--ui-mdpc-line)}
.ui-mdpc__toggle{display: flex;align-items: center;gap: 10px;width: 100%;height: 32px;padding: 0 8px;border-radius: 6px;color: var(--ui-mdpc-ink);transition: background-color 90ms ease-out}
.ui-mdpc__toggle:hover{background: var(--ui-mdpc-fill)}
.ui-mdpc__toggle-icon{display: grid;flex: none;place-items: center;width: 20px;color: var(--ui-mdpc-icon);transition: color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-mdpc__toggle[aria-checked="true"] .ui-mdpc__toggle-icon{color: var(--ui-mdpc-ink)}
.ui-mdpc__toggle-label{flex: 1;min-width: 0;overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-mdpc__switch{position: relative;flex: none;width: 26px;height: 16px;border-radius: 5px;background: var(--ui-mdpc-switch);transition: background-color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-mdpc__switch::after{content: "";position: absolute;top: 2px;left: 2px;width: 12px;height: 12px;border-radius: 3.5px;background: var(--ui-mdpc-knob);box-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 2px rgba(11, 9, 8, 0.16);transition: transform var(--nm-dur-3, 240ms) var(--ui-mdpc-ease)}
.ui-mdpc__toggle[aria-checked="true"] .ui-mdpc__switch{background: var(--ui-mdpc-accent)}
.ui-mdpc__toggle[aria-checked="true"] .ui-mdpc__switch::after{transform: translateX(10px)}
.ui-mdpc__fold{display: grid;grid-template-rows: 0fr;opacity: 0;transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-mdpc-ease), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-mdpc__fold[data-open]{grid-template-rows: 1fr;opacity: 1;transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-mdpc-ease), opacity var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 100ms}
.ui-mdpc__clip{min-height: 0;overflow: hidden}
.ui-mdpc__effort{display: flex;align-items: center;gap: 10px;padding: 2px 8px 6px 38px}
.ui-mdpc__effort-label{flex: 1;min-width: 0;color: var(--ui-mdpc-text)}
.ui-mdpc__segmented{position: relative;display: flex;flex: none;gap: 4px}
.ui-mdpc__thumb{position: absolute;top: 0;bottom: 0;left: 0;width: var(--w, 0);border-radius: 5px;background: var(--ui-mdpc-fill);transform: translateX(var(--x, 0));transition: transform var(--nm-dur-3, 240ms) var(--ui-mdpc-ease), width var(--nm-dur-3, 240ms) var(--ui-mdpc-ease)}
.ui-mdpc__seg-btn{position: relative;height: 22px;padding: 0 7px;border-radius: 5px;box-shadow: inset 0 0 0 0.5px var(--ui-mdpc-line);font-size: 12px;font-weight: 500;line-height: 16px;color: var(--ui-mdpc-text);text-align: center !important;transition: color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-mdpc__seg-btn[aria-checked="true"]{color: var(--ui-mdpc-ink)}
.ui-mdpc__seg-btn[aria-checked="false"]:hover{background: var(--ui-mdpc-wash);color: var(--ui-mdpc-ink)}
.ui-mdpc__foot{display: flex;align-items: center;gap: 8px;height: 36px;padding: 0 8px 0 12px;border-top: 0.5px solid var(--ui-mdpc-line)}
.ui-mdpc__caption{flex: 1;min-width: 0;overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-mdpc-muted);white-space: nowrap;font-variant-numeric: tabular-nums}
.ui-mdpc__dot{color: var(--ui-mdpc-faint)}
.ui-mdpc__swap{display: grid;min-width: 0}
.ui-mdpc__swap-item{grid-area: 1 / 1;min-width: 0;overflow: hidden;text-overflow: ellipsis;white-space: nowrap;animation: ui-mdpc-swap-in var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-mdpc__swap-item[data-out]{animation: ui-mdpc-swap-out var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-mdpc__keys{display: flex;flex: none;gap: 2px}
.ui-mdpc__keys kbd{display: grid;place-items: center;min-width: 20px;height: 20px;padding: 0 5px;border-radius: 5px;box-shadow: inset 0 0 0 0.5px var(--ui-mdpc-line-strong);font-family: inherit;font-size: 11px;font-weight: 500;line-height: 16px;color: var(--ui-mdpc-muted)}
@keyframes ui-mdpc-swap-in{from{opacity: 0;filter: blur(2px)}
}
@keyframes ui-mdpc-swap-out{from{opacity: 1}
to{opacity: 0;filter: blur(2px)}
}
@keyframes ui-mdpc-pop{from{opacity: 0;transform: scale(0.6)}
}
@keyframes ui-mdpc-fill{0%{transform: scaleY(1)}
45%{transform: scaleY(1.6)}
100%{transform: scaleY(1)}
}
@container (max-width: 300px){.ui-mdpc__option .ui-mdpc__glyph{display: none}
.ui-mdpc__keys{display: none}
.ui-mdpc__effort{padding-left: 8px}
}
@media (pointer: coarse){.ui-mdpc__trigger{height: 34px}
.ui-mdpc__option{min-height: 52px}
.ui-mdpc__toggle{height: 40px}
.ui-mdpc__seg-btn{height: 30px;padding: 0 10px}
.ui-mdpc__keys{display: none}
}
@media (prefers-reduced-motion: reduce){.ui-mdpc *, .ui-mdpc *::before, .ui-mdpc *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-mdpc{--ui-mdpc-card: #211b16;--ui-mdpc-strong: #fffdfb;--ui-mdpc-ink: rgba(255, 253, 251, 0.9);--ui-mdpc-text: rgba(255, 253, 251, 0.62);--ui-mdpc-muted: rgba(255, 253, 251, 0.46);--ui-mdpc-faint: rgba(255, 253, 251, 0.3);--ui-mdpc-icon: rgba(255, 253, 251, 0.5);--ui-mdpc-line: rgba(255, 253, 251, 0.08);--ui-mdpc-line-strong: rgba(255, 253, 251, 0.12);--ui-mdpc-fill: rgba(255, 253, 251, 0.08);--ui-mdpc-wash: rgba(255, 253, 251, 0.04);--ui-mdpc-bar: rgba(255, 253, 251, 0.24);--ui-mdpc-bar-off: rgba(255, 253, 251, 0.08);--ui-mdpc-switch: rgba(255, 253, 251, 0.14);--ui-mdpc-knob: #fffdfb;--ui-mdpc-accent: #ff8a5c;--ui-mdpc-focus: rgba(255, 138, 92, 0.5);--ui-mdpc-shadow-tile: 0 0 0 0.5px rgba(255, 253, 251, 0.12), 0 1px 2px rgba(11, 9, 8, 0.4);--ui-mdpc-shadow-pop: 0 0 0 0.5px rgba(255, 253, 251, 0.12), 0 12px 28px -10px rgba(11, 9, 8, 0.6), 0 1px 2px 0 rgba(11, 9, 8, 0.4)}
:where(.dark, [data-theme="dark"]) .ui-mdpc__glyph{background: #2b231b}

`;
