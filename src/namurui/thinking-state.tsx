"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/*
 * Thinking State – a live record of what an assistant is doing, in a single self-contained file.
 * A pixel-grid mark breathes beside a shimmering label and a running clock while the trail grows
 * below: steps surface one by one, the newest one carrying the sweep, and a search step pops its
 * sources in as chips – a few on the line, the rest folded behind "+N more". When the run lands
 * the mark settles, the clock freezes and the label turns from "Thinking" to "Thought". The header
 * folds the whole trail away and opens it again.
 * The styles are injected below, so no extra files are needed.
 */

/** Brand mark in a source chip, traced from the site's own favicons. */
export type ThinkingFavicon = "slack" | "x" | "notion" | "wikipedia";

export type ThinkingSource = {
  /** Chip copy, e.g. "Slack – #team-offsite" */
  label: string;
  /** Opens in a new tab */
  href: string;
  /** Hover tip above the chip; the href's host and path when omitted */
  tip?: string;
  /** Brand mark the reference ships, drawn in the chip's 14px tile */
  favicon?: ThinkingFavicon;
  /** Any other site mark, drawn in the same tile; wins over `favicon` */
  icon?: ReactNode;
};

export type ThinkingStepKind = "search" | "step";

export type ThinkingStep = {
  /** "search" draws a globe and can carry sources; "step" draws a dot that becomes a check once the run lands */
  kind: ThinkingStepKind;
  /** Row copy while the step is running, e.g. "Searching" */
  label: string;
  /** Row copy once the step has run, e.g. "Searched"; the label itself when omitted */
  doneLabel?: string;
  /** Sources this step found; the first search step falls back to the panel's `sources` */
  sources?: ThinkingSource[];
};

export type ThinkingStateProps = {
  /** The trail, in the order the steps surface */
  steps: ThinkingStep[];
  /** Pages the run found, shown under the first search step */
  sources?: ThinkingSource[];
  /** Force the run to its end: the mark settles, every row lands and the clock freezes */
  done?: boolean;
  /** Seconds on the clock, called once when the run lands */
  onDone?: (seconds: number) => void;
  /** How long each step stays in the active slot before the next surfaces */
  stepMs?: number;
  /** Chips shown before the rest fold into "+N more" */
  sourceLimit?: number;
  /** Header copy while the run is live */
  label?: string;
  /** Header copy once the run lands */
  doneLabel?: string;
  /** Whether the trail starts unfolded */
  defaultOpen?: boolean;
  className?: string;
};

/** Seconds as the header writes them: "9s", "1m 12s". */
function clock(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

/** Default hover tip: host plus path, no scheme, no trailing slash. */
function hostOf(href: string): string {
  try {
    const url = new URL(href);
    return `${url.host}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return href;
  }
}

const pixelDelays = [0, 120, 240, 120, 240, 360, 240, 360, 480];
const chipBase = 120;
const chipStep = 160;

const globeMark = (
  <svg viewBox="0 0 24 24" className="ui-thinkc__globe">
    <path d="M22 12A10 10 0 1 0 12 22" />
    <path d="M20 5.7c-.93.07-2.13.43-2.96 1.5-1.5 1.94-3 2.1-4 1.46-1.5-.97-.24-2.54-2-3.4-1.15-.56-1.31-2.07-.67-3.26" />
    <path d="M2 11c.76.66 1.83 1.27 3.09 1.27 2.6 0 3.12.5 3.12 2.48s0 1.99.52 3.48c.34.97.46 1.94-.22 2.77" />
    <path d="m19.9 19.93 2.1 2.07m-.89-4.95a4.05 4.05 0 1 1-8.11 0 4.05 4.05 0 0 1 8.11 0Z" />
  </svg>
);

const tickMark = (
  <svg viewBox="0 0 16 16" className="ui-thinkc__check">
    <circle cx="8" cy="8" r="7" />
    <path d="m5 8.3 2.1 2.1 3.9-4.7" />
  </svg>
);

function SourceMark({ mark }: { mark: ThinkingFavicon }) {
  if (mark === "slack") {
    return (
      <svg viewBox="0 0 24 24">
        <rect width="24" height="24" fill="#fff" />
        <svg x="4" y="4" width="16" height="16" viewBox="0 0 2447.6 2452.5">
          <g clipRule="evenodd" fillRule="evenodd">
            <path
              d="m897.4 0c-135.3.1-244.8 109.9-244.7 245.2-.1 135.3 109.5 245.1 244.8 245.2h244.8v-245.1c.1-135.3-109.5-245.1-244.9-245.3.1 0 .1 0 0 0m0 654h-652.6c-135.3.1-244.9 109.9-244.8 245.2-.2 135.3 109.4 245.1 244.7 245.3h652.7c135.3-.1 244.9-109.9 244.8-245.2.1-135.4-109.5-245.2-244.8-245.3z"
              fill="#36c5f0"
            />
            <path
              d="m2447.6 899.2c.1-135.3-109.5-245.1-244.8-245.2-135.3.1-244.9 109.9-244.8 245.2v245.3h244.8c135.3-.1 244.9-109.9 244.8-245.3zm-652.7 0v-654c.1-135.2-109.4-245-244.7-245.2-135.3.1-244.9 109.9-244.8 245.2v654c-.2 135.3 109.4 245.1 244.7 245.3 135.3-.1 244.9-109.9 244.8-245.3z"
              fill="#2eb67d"
            />
            <path
              d="m1550.1 2452.5c135.3-.1 244.9-109.9 244.8-245.2.1-135.3-109.5-245.1-244.8-245.2h-244.8v245.2c-.1 135.2 109.5 245 244.8 245.2zm0-654.1h652.7c135.3-.1 244.9-109.9 244.8-245.2.2-135.3-109.4-245.1-244.7-245.3h-652.7c-135.3.1-244.9 109.9-244.8 245.2-.1 135.4 109.4 245.2 244.7 245.3z"
              fill="#ecb22e"
            />
            <path
              d="m0 1553.2c-.1 135.3 109.5 245.1 244.8 245.2 135.3-.1 244.9-109.9 244.8-245.2v-245.2h-244.8c-135.3.1-244.9 109.9-244.8 245.2zm652.7 0v654c-.2 135.3 109.4 245.1 244.7 245.3 135.3-.1 244.9-109.9 244.8-245.2v-653.9c.2-135.3-109.4-245.1-244.7-245.3-135.4 0-244.9 109.8-244.8 245.1 0 0 0 .1 0 0"
              fill="#e01e5a"
            />
          </g>
        </svg>
      </svg>
    );
  }

  if (mark === "x") {
    return (
      <svg viewBox="0 0 24 24">
        <rect width="24" height="24" fill="#000" />
        <svg x="5" y="5" width="14" height="14" viewBox="0 0 24 24">
          <path
            fill="#fff"
            d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"
          />
        </svg>
      </svg>
    );
  }

  if (mark === "notion") {
    return (
      <svg viewBox="0 0 24 24">
        <rect width="24" height="24" fill="#fff" />
        <svg x="3" y="3" width="18" height="18" viewBox="0 0 256 268">
          <path
            fill="#FFF"
            d="M16.092 11.538 164.09.608c18.179-1.56 22.85-.508 34.28 7.801l47.243 33.282C253.406 47.414 256 48.975 256 55.207v182.527c0 11.439-4.155 18.205-18.696 19.24L65.44 267.378c-10.913.517-16.11-1.043-21.825-8.327L8.826 213.814C2.586 205.487 0 199.254 0 191.97V29.726c0-9.352 4.155-17.153 16.092-18.188Z"
          />
          <path d="M164.09.608 16.092 11.538C4.155 12.573 0 20.374 0 29.726v162.245c0 7.284 2.585 13.516 8.826 21.843l34.789 45.237c5.715 7.284 10.912 8.844 21.825 8.327l171.864-10.404c14.532-1.035 18.696-7.801 18.696-19.24V55.207c0-5.911-2.336-7.614-9.21-12.66l-1.185-.856L198.37 8.409C186.94.1 182.27-.952 164.09.608ZM69.327 52.22c-14.033.945-17.216 1.159-25.186-5.323L23.876 30.778c-2.06-2.086-1.026-4.69 4.163-5.207l142.274-10.395c11.947-1.043 18.17 3.12 22.842 6.758l24.401 17.68c1.043.525 3.638 3.637.517 3.637L71.146 52.095l-1.819.125Zm-16.36 183.954V81.222c0-6.767 2.077-9.887 8.3-10.413L230.02 60.93c5.724-.517 8.31 3.12 8.31 9.879v153.917c0 6.767-1.044 12.49-10.387 13.008l-161.487 9.361c-9.343.517-13.489-2.594-13.489-10.921ZM212.377 89.53c1.034 4.681 0 9.362-4.681 9.897l-7.783 1.542v114.404c-6.758 3.637-12.981 5.715-18.18 5.715-8.308 0-10.386-2.604-16.609-10.396l-50.898-80.079v77.476l16.1 3.646s0 9.362-12.989 9.362l-35.814 2.077c-1.043-2.086 0-7.284 3.63-8.318l9.351-2.595V109.823l-12.98-1.052c-1.044-4.68 1.55-11.439 8.826-11.965l38.426-2.585 52.958 81.113v-71.76l-13.498-1.552c-1.043-5.733 3.111-9.896 8.3-10.404l35.84-2.087Z" />
        </svg>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24">
      <rect width="24" height="24" fill="#fff" />
      <svg x="3" y="3" width="18" height="18" viewBox="0 0 24 24">
        <path
          fill="#000"
          d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .119-.075.176-.225.176l-.564.031c-.485.029-.727.164-.727.436 0 .135.053.33.166.601 1.082 2.646 4.818 10.521 4.818 10.521l.136.046 2.411-4.81-.482-1.067-1.658-3.264s-.318-.654-.428-.872c-.728-1.443-.712-1.518-1.447-1.617-.207-.023-.313-.05-.313-.149v-.468l.06-.045h4.292l.113.037v.451c0 .105-.076.15-.227.15l-.308.047c-.792.061-.661.381-.136 1.422l1.582 3.252 1.758-3.504c.293-.64.233-.801.111-.947-.07-.084-.305-.22-.812-.24l-.201-.021c-.052 0-.098-.015-.145-.051-.045-.031-.067-.076-.067-.129v-.427l.061-.045c1.247-.008 4.043 0 4.043 0l.059.045v.436c0 .121-.059.178-.193.178-.646.03-.782.095-1.023.439-.12.186-.375.589-.646 1.039l-2.301 4.273-.065.135 2.792 5.712.17.048 4.396-10.438c.154-.422.129-.722-.064-.895-.197-.172-.346-.273-.857-.295l-.42-.016c-.061 0-.105-.014-.152-.045-.043-.029-.072-.075-.072-.119v-.436l.059-.045h4.961l.041.045v.437c0 .119-.074.18-.209.18-.648.03-1.127.18-1.443.421-.314.255-.557.616-.736 1.067 0 0-4.043 9.258-5.426 12.339-.525 1.007-1.053.917-1.503-.031-.571-1.171-1.773-3.786-2.646-5.71l.053-.036z"
        />
      </svg>
    </svg>
  );
}

export function ThinkingState({
  steps,
  sources = [],
  done,
  onDone,
  stepMs = 1200,
  sourceLimit = 4,
  label = "Thinking",
  doneLabel = "Thought",
  defaultOpen = true,
  className,
}: ThinkingStateProps) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const [openedMore, setOpenedMore] = useState<number | null>(null);
  const [reached, setReached] = useState(0);
  const [complete, setComplete] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const startedAt = useRef(0);
  const reported = useRef(false);

  const finished = done === true || complete;
  const stepCount = steps.length;

  /* Each step takes the active slot in turn; the run lands one beat after the last one. */
  useEffect(() => {
    startedAt.current = Date.now();
    setReached(0);
    setComplete(false);
    setElapsed(0);
    setOpenedMore(null);

    if (stepCount === 0) {
      setComplete(true);
      return;
    }

    const timers = Array.from({ length: stepCount }, (_, index) =>
      window.setTimeout(() => setReached(index + 1), 240 + index * stepMs),
    );
    timers.push(window.setTimeout(() => setComplete(true), 240 + stepCount * stepMs));

    return () => timers.forEach((timer) => window.clearTimeout(timer));
    /* A new run starts only when the trail's length or pace changes, so an inline
       `steps` array cannot restart the clock on every render. */
  }, [stepCount, stepMs]);

  /* The clock only runs while the run is live, and freezes on the second it landed. */
  useEffect(() => {
    if (finished) return;

    const tick = () => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [finished]);

  useEffect(() => {
    if (!finished) {
      reported.current = false;
      return;
    }
    if (reported.current) return;
    reported.current = true;
    onDone?.(elapsed);
  }, [finished, onDone, elapsed]);

  const visibleRows = finished ? stepCount : reached;
  const firstSearch = steps.findIndex((step) => step.kind === "search" && !step.sources?.length);

  return (
    <div className={["ui-thinkc", className].filter(Boolean).join(" ")} data-done={finished ? "true" : undefined}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-thinking-state-clean" precedence="default">
        {css}
      </style>

      <button
        type="button"
        className="ui-thinkc__head"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="ui-thinkc__mark" aria-hidden="true">
          {pixelDelays.map((delay, pixel) => (
            <i key={pixel} style={{ animationDelay: `${delay}ms` }} />
          ))}
        </span>
        <span className="ui-thinkc__title">
          <span className="ui-thinkc__shimmer" data-text={finished ? doneLabel : label}>
            {finished ? doneLabel : label}
          </span>
          <span className="ui-thinkc__time">{clock(elapsed)}</span>
        </span>
        <span className="ui-thinkc__chevron" aria-hidden="true">
          <svg viewBox="0 0 16 16">
            <path d="M4.5 6.25 8 9.75l3.5-3.5" />
          </svg>
        </span>
      </button>

      <div className="ui-thinkc__body" data-open={expanded ? "true" : "false"}>
        <div className="ui-thinkc__clip">
          <ol className="ui-thinkc__list" aria-live="polite">
            {steps.slice(0, visibleRows).map((step, index) => {
              const landed = finished || index < reached - 1;
              const active = !finished && index === reached - 1;
              const copy = landed ? (step.doneLabel ?? step.label) : step.label;
              const rowSources = step.sources?.length
                ? step.sources
                : index === firstSearch
                  ? sources
                  : [];
              const shown = openedMore === index ? rowSources.length : Math.min(sourceLimit, rowSources.length);
              const hidden = rowSources.length - shown;
              const kind = finished ? "done" : step.kind === "search" ? "search" : undefined;

              return (
                <li
                  className="ui-thinkc__item"
                  key={`${index}-${step.label}`}
                  data-kind={kind}
                  data-active={active ? "true" : undefined}
                >
                  <span className="ui-thinkc__node" aria-hidden="true">
                    {step.kind === "search" ? globeMark : finished ? tickMark : <span className="ui-thinkc__dot" />}
                  </span>
                  <div className="ui-thinkc__content">
                    <span
                      className={active ? "ui-thinkc__label ui-thinkc__shimmer" : "ui-thinkc__label"}
                      data-text={active ? copy : undefined}
                    >
                      {copy}
                    </span>

                    {rowSources.length > 0 ? (
                      <div className="ui-thinkc__sources">
                        {rowSources.slice(0, shown).map((source, sourceIndex) => {
                          const mark = source.icon ?? (source.favicon ? <SourceMark mark={source.favicon} /> : null);

                          return (
                            <a
                              className="ui-thinkc__source"
                              key={`${source.label}-${sourceIndex}`}
                              href={source.href}
                              target="_blank"
                              rel="noreferrer"
                              style={{ animationDelay: `${chipBase + sourceIndex * chipStep}ms` }}
                            >
                              {mark ? <span className="ui-thinkc__favicon">{mark}</span> : null}
                              <span className="ui-thinkc__source-label">{source.label}</span>
                              <span className="ui-thinkc__tip" aria-hidden="true">
                                {source.tip ?? hostOf(source.href)}
                              </span>
                            </a>
                          );
                        })}

                        {hidden > 0 || openedMore === index ? (
                          <button
                            type="button"
                            className="ui-thinkc__source ui-thinkc__more"
                            aria-expanded={openedMore === index}
                            style={{ animationDelay: `${chipBase + shown * chipStep}ms` }}
                            onClick={() => setOpenedMore((current) => (current === index ? null : index))}
                          >
                            {openedMore === index ? "Show less" : `+${hidden} more`}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

const css = /* css */ `
.ui-thinkc{--ui-tkc-card: #fffdfb;--ui-tkc-ink: rgba(11, 9, 8, 0.88);--ui-tkc-strong: #0b0908;--ui-tkc-text: rgba(11, 9, 8, 0.61);--ui-tkc-muted: rgba(11, 9, 8, 0.45);--ui-tkc-faint: rgba(11, 9, 8, 0.27);--ui-tkc-icon: rgba(11, 9, 8, 0.447);--ui-tkc-line: rgba(11, 9, 8, 0.06);--ui-tkc-rail: rgba(11, 9, 8, 0.08);--ui-tkc-fill: rgba(11, 9, 8, 0.06);--ui-tkc-wash: rgba(11, 9, 8, 0.03);--ui-tkc-wash-big: rgba(11, 9, 8, 0.015);--ui-tkc-accent: rgba(217, 84, 31, 0.765);--ui-tkc-shine: rgba(255, 253, 251, 0.82);--ui-tkc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-tkc-shadow-pop: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 12px 28px -10px rgba(11, 9, 8, 0.16), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-tkc-ring: 0 0 0 0.5px rgba(11, 9, 8, 0.1);--ui-tkc-focus: rgba(217, 84, 31, 0.35);--ui-tkc-ease: cubic-bezier(0.22, 1, 0.36, 1);position: relative;box-sizing: border-box;container-type: inline-size;width: 100%;max-width: 440px;border-radius: 10px;background: var(--ui-tkc-card);box-shadow: var(--ui-tkc-shadow);font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;font-weight: 400;color: var(--ui-tkc-ink);-webkit-font-smoothing: antialiased}
.ui-thinkc *, .ui-thinkc *::before, .ui-thinkc *::after{box-sizing: border-box}
:where(.ui-thinkc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;cursor: pointer}
:where(.ui-thinkc) svg{display: block;flex: none}
.ui-thinkc button:focus-visible, .ui-thinkc a:focus-visible{outline: 2px solid var(--ui-tkc-focus);outline-offset: 1px}
.ui-thinkc__head{display: flex;align-items: center;gap: 10px;width: 100%;height: 44px;padding: 0 12px 0 16px;border-radius: 10px;text-align: left;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), border-radius 0ms linear 360ms}
.ui-thinkc__head[aria-expanded="true"]{border-radius: 10px 10px 0 0;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-thinkc__head:hover{background: var(--ui-tkc-wash-big)}
.ui-thinkc__mark{display: grid;grid-template-columns: repeat(3, 3px);grid-auto-rows: 3px;gap: 1.5px;place-content: center;width: 16px;height: 16px}
.ui-thinkc__mark i{border-radius: 0.75px;background: var(--ui-tkc-accent);animation: ui-thinkc-pixel var(--nm-dur-6, 1100ms) ease-in-out infinite both}
.ui-thinkc[data-done] .ui-thinkc__mark i{animation: ui-thinkc-settle var(--nm-dur-4, 380ms) var(--ui-tkc-ease) both}
.ui-thinkc__title{display: inline-flex;flex: 1;min-width: 0;gap: 8px;font-weight: 500;white-space: nowrap;color: var(--ui-tkc-ink);animation: ui-thinkc-in var(--nm-dur-4, 380ms) var(--ui-tkc-ease) both}
.ui-thinkc__title .ui-thinkc__shimmer{color: var(--ui-tkc-muted)}
.ui-thinkc__time{font-weight: 400;font-variant-numeric: tabular-nums;color: var(--ui-tkc-faint)}
.ui-thinkc__chevron{display: grid;place-items: center;width: 28px;height: 28px;margin-right: -6px;border-radius: 6px;color: var(--ui-tkc-icon);transition: color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-thinkc__chevron svg{width: 16px;height: 16px;fill: none;stroke: currentColor;stroke-width: 1.1;stroke-linecap: round;stroke-linejoin: round;transform: rotate(-90deg);transition: transform var(--nm-dur-3, 240ms) var(--ui-tkc-ease)}
.ui-thinkc__head[aria-expanded="true"] .ui-thinkc__chevron svg{transform: none}
.ui-thinkc__head:hover .ui-thinkc__chevron{color: var(--ui-tkc-ink)}
.ui-thinkc__body{display: grid;grid-template-rows: 1fr;border-top: 0.5px solid var(--ui-tkc-line);transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-tkc-ease), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), border-color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-thinkc__body[data-open="false"]{grid-template-rows: 0fr;opacity: 0;border-top-color: transparent}
.ui-thinkc__clip{min-height: 0;overflow: visible}
.ui-thinkc__body[data-open="false"] .ui-thinkc__clip{overflow: hidden}
.ui-thinkc__list{margin: 0;padding: 14px 16px 4px;list-style: none}
.ui-thinkc__item{position: relative;display: grid;grid-template-columns: 16px minmax(0, 1fr);gap: 10px;padding-bottom: 12px;animation: ui-thinkc-in var(--nm-dur-5, 620ms) var(--ui-tkc-ease) both}
.ui-thinkc__item:not(:last-child)::before{content: "";position: absolute;left: 7.5px;top: 22px;bottom: 2px;width: 1px;background: var(--ui-tkc-rail);transform-origin: top;animation: ui-thinkc-line var(--nm-dur-5, 620ms) var(--ui-tkc-ease) both}
.ui-thinkc__node{display: grid;place-items: center;width: 16px;height: 20px}
.ui-thinkc__globe{width: 16px;height: 16px;fill: none;stroke: var(--ui-tkc-icon);stroke-width: 1.6;stroke-linecap: round;stroke-linejoin: round}
.ui-thinkc__dot{width: 5px;height: 5px;border-radius: 50%;background: var(--ui-tkc-faint);transition: background-color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), border-radius var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-thinkc__item[data-active] .ui-thinkc__dot{width: 6px;height: 6px;border-radius: 1.5px;background: var(--ui-tkc-accent);animation: ui-thinkc-pulse var(--nm-dur-6, 1100ms) ease-in-out infinite}
.ui-thinkc__check{width: 16px;height: 16px;animation: ui-thinkc-pop var(--nm-dur-4, 380ms) cubic-bezier(0.34, 1.56, 0.64, 1) both}
.ui-thinkc__check circle{fill: var(--ui-tkc-accent)}
.ui-thinkc__check path{fill: none;stroke: #fffdfb;stroke-width: 1.4;stroke-linecap: round;stroke-linejoin: round;stroke-dasharray: 9;stroke-dashoffset: 9;animation: ui-thinkc-draw var(--nm-dur-4, 380ms) var(--ui-tkc-ease) 180ms forwards}
.ui-thinkc__content{min-width: 0}
.ui-thinkc__label{position: relative;display: inline-block;max-width: 100%;color: var(--ui-tkc-text);transition: color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-thinkc__item[data-active] .ui-thinkc__label{color: var(--ui-tkc-muted)}
.ui-thinkc__item[data-kind="done"] .ui-thinkc__label{font-weight: 500;color: var(--ui-tkc-ink)}
.ui-thinkc__sources{display: flex;flex-wrap: wrap;gap: 6px;margin-top: 8px;padding: 1px 0 2px}
.ui-thinkc__source{display: inline-flex;align-items: center;gap: 6px;max-width: 100%;height: 26px;padding: 0 8px 0 6px;border-radius: 6px;background: var(--ui-tkc-card);box-shadow: var(--ui-tkc-shadow);font-size: 12px;line-height: 16px;color: var(--ui-tkc-ink);text-decoration: none;animation: ui-thinkc-chip var(--nm-dur-4, 380ms) var(--ui-tkc-ease) both}
a.ui-thinkc__source, .ui-thinkc__more{position: relative;cursor: pointer;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
a.ui-thinkc__source:hover{background: var(--ui-tkc-wash)}
.ui-thinkc .ui-thinkc__more{padding: 0 8px;background: none;box-shadow: inset 0 0 0 0.5px var(--ui-tkc-line);font-size: 12px;font-weight: 500;color: var(--ui-tkc-text)}
.ui-thinkc .ui-thinkc__more:hover{background: var(--ui-tkc-wash);color: var(--ui-tkc-ink)}
.ui-thinkc .ui-thinkc__more[aria-expanded="true"]{background: var(--ui-tkc-fill);color: var(--ui-tkc-ink)}
.ui-thinkc__tip{position: absolute;left: 50%;bottom: calc(100% + 6px);z-index: 2;padding: 4px 8px;border-radius: 6px;background: var(--ui-tkc-card);box-shadow: var(--ui-tkc-shadow-pop);color: var(--ui-tkc-text);font-size: 12px;line-height: 16px;white-space: nowrap;pointer-events: none;opacity: 0;transform: translate(-50%, 4px);transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-2, 160ms) var(--ui-tkc-ease)}
.ui-thinkc__source:hover .ui-thinkc__tip, .ui-thinkc__source:focus-visible .ui-thinkc__tip{opacity: 1;transform: translate(-50%, 0);transition-delay: 250ms}
.ui-thinkc__source[data-count]{padding: 0 8px;background: none;box-shadow: inset 0 0 0 0.5px var(--ui-tkc-line);color: var(--ui-tkc-text)}
.ui-thinkc__source-label{overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-thinkc__favicon{display: grid;place-items: center;flex: none;width: 14px;height: 14px;border-radius: 4px;overflow: hidden;box-shadow: var(--ui-tkc-ring)}
.ui-thinkc__favicon svg{width: 100%;height: 100%}
.ui-thinkc__shimmer{position: relative}
.ui-thinkc__shimmer::after{content: attr(data-text);content: attr(data-text) / "";position: absolute;inset: 0;white-space: nowrap;color: transparent;background: linear-gradient(90deg, transparent 38%, var(--ui-tkc-shine) 50%, transparent 62%) 100% 0 / 300% 100% no-repeat;-webkit-background-clip: text;background-clip: text;animation: ui-thinkc-sweep var(--nm-dur-6, 1100ms) linear infinite;pointer-events: none}
@keyframes ui-thinkc-in{from{opacity: 0;transform: translateY(6px);filter: blur(3px)}
to{opacity: 1;transform: none;filter: none}
}
@keyframes ui-thinkc-line{from{transform: scaleY(0)}
to{transform: scaleY(1)}
}
@keyframes ui-thinkc-chip{from{opacity: 0;transform: translateY(4px) scale(0.92)}
to{opacity: 1;transform: none}
}
@keyframes ui-thinkc-pulse{50%{transform: scale(0.7);opacity: 0.45}
}
@keyframes ui-thinkc-pixel{0%, 100%{opacity: 1}
50%{opacity: 0.2}
}
@keyframes ui-thinkc-settle{from{opacity: 0.2;transform: scale(0.6)}
to{opacity: 1;transform: none}
}
@keyframes ui-thinkc-pop{0%{transform: scale(0.5)}
60%{transform: scale(1.12)}
100%{transform: scale(1)}
}
@keyframes ui-thinkc-draw{to{stroke-dashoffset: 0}
}
@keyframes ui-thinkc-sweep{from{background-position: 100% 0}
to{background-position: 0% 0}
}
@container (max-width: 360px){.ui-thinkc__head{padding: 0 10px 0 14px}
.ui-thinkc__list{padding: 12px 14px 2px}
}
@media (pointer: coarse){.ui-thinkc__head{height: 52px}
.ui-thinkc__source{height: 32px}
}
@media (prefers-reduced-motion: reduce){.ui-thinkc *, .ui-thinkc *::before, .ui-thinkc *::after{animation-duration: 1ms !important;animation-delay: 0ms !important;animation-iteration-count: 1 !important;transition-duration: 1ms !important}
.ui-thinkc__shimmer::after{display: none}
.ui-thinkc__check path{stroke-dashoffset: 0}
}
:where(.dark, [data-theme="dark"]) .ui-thinkc{--ui-tkc-card: #211b16;--ui-tkc-ink: rgba(255, 253, 251, 0.9);--ui-tkc-strong: #fffdfb;--ui-tkc-text: rgba(255, 253, 251, 0.62);--ui-tkc-muted: rgba(255, 253, 251, 0.46);--ui-tkc-faint: rgba(255, 253, 251, 0.3);--ui-tkc-icon: rgba(255, 253, 251, 0.5);--ui-tkc-line: rgba(255, 253, 251, 0.08);--ui-tkc-rail: rgba(255, 253, 251, 0.1);--ui-tkc-fill: rgba(255, 253, 251, 0.08);--ui-tkc-wash: rgba(255, 253, 251, 0.04);--ui-tkc-wash-big: rgba(255, 253, 251, 0.025);--ui-tkc-accent: #ff8a5c;--ui-tkc-shine: #fffdfb;--ui-tkc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-tkc-shadow-pop: 0 0 0 0.5px rgba(255, 253, 251, 0.12), 0 12px 28px -10px rgba(11, 9, 8, 0.6);--ui-tkc-ring: 0 0 0 0.5px rgba(255, 253, 251, 0.14);--ui-tkc-focus: rgba(255, 138, 92, 0.5)}
:where(.dark, [data-theme="dark"]) .ui-thinkc__tip{background: #27201a}

`;
