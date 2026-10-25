"use client";

import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/*
 * Parallel Attempts – one task, tried several ways at once.
 *
 * Every attempt is a row that races: a lane fills across its track while the line under the model
 * name says what it is reading or running, and the percentage at the end counts up with it. A row
 * that lands turns green and swaps its percentage for a score – the lane settles at that score, so
 * the rows can be read against each other at a glance. The highest score is tagged Best and picked
 * on its own; the attempts it beat fade back, coming forward again when you point at them. A failed
 * attempt freezes its lane red and says why. Pointing at a finished row slides "Use" over its cost:
 * pressing it takes that attempt instead of the marked one, and the green wash moves with it.
 */

export type AttemptStatus = "running" | "done" | "failed";

export type Attempt = {
  id: string;
  /** The model's name, in ink – e.g. "Opus 5.5" */
  name: string;
  /** What this attempt tries, after the dot – e.g. "Add a retry with backoff" */
  approach: string;
  status: AttemptStatus;
  /** 0 to 1 – how far the lane has filled; a done row uses its score instead */
  progress?: number;
  /** 0 to 100 once it lands – sets the lane and the number at the end, and the highest wins */
  score?: number;
  /** The line under the name: what it reads or runs, or why it gave up */
  line?: string;
  /** What it has cost so far, in whole currency units */
  cost?: number;
  /** The model's mark for the 28px tile; a monogram is drawn when this is left out */
  icon?: ReactNode;
};

export type ParallelAttemptsProps = {
  /** One per attempt, in the order the rows should race */
  attempts: Attempt[];
  /** What all of them try to do, after the title – e.g. "Fix the flaky checkout test" */
  task?: string;
  /** Heading of the bar; defaults to "Best of <how many>" */
  title?: string;
  /** Controlled pick – leave it out and the best finished attempt is picked on its own */
  picked?: string | null;
  /** Another attempt was taken with "Use" */
  onPick?: (attempt: Attempt) => void;
  /** Formats every cost, per attempt and in the header total */
  formatCost?: (amount: number) => string;
  className?: string;
};

export function ParallelAttempts({
  attempts,
  task,
  title = `Best of ${attempts.length}`,
  picked,
  onPick,
  formatCost = (amount) => `$${amount.toFixed(2)}`,
  className,
}: ParallelAttemptsProps) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const [manual, setManual] = useState<string | null>(null);
  const radioRefs = useRef(new Map<string, HTMLButtonElement>());

  /** Only a landed attempt can be taken. */
  const usable = attempts.filter((attempt) => attempt.status === "done");

  const best = usable.reduce<Attempt | null>(
    (leader, attempt) =>
      attempt.score == null ? leader : !leader || attempt.score > (leader.score ?? 0) ? attempt : leader,
    null,
  );

  const pickedId = picked !== undefined ? picked : (manual ?? best?.id ?? null);
  const focusId = pickedId !== null && usable.some((attempt) => attempt.id === pickedId)
    ? pickedId
    : usable[0]?.id;

  const choose = (attempt: Attempt) => {
    setManual(attempt.id);
    onPick?.(attempt);
  };

  /** Radios answer to the arrows; taking another attempt is the selection. */
  const move = (event: KeyboardEvent<HTMLButtonElement>, attempt: Attempt) => {
    const step =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? -1
          : 0;
    if (step === 0 || usable.length === 0) return;
    event.preventDefault();
    const next = usable[(usable.indexOf(attempt) + step + usable.length) % usable.length];
    if (!next) return;
    choose(next);
    radioRefs.current.get(next.id)?.focus();
  };

  const finished = attempts.filter((attempt) => attempt.status === "done").length;
  const spent = attempts.reduce((total, attempt) => total + (attempt.cost ?? 0), 0);
  const hasCost = attempts.some((attempt) => attempt.cost != null);

  return (
    <div className={["ui-pac", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many panels render */}
      <style href="ui-parallel-attempts" precedence="default">
        {css}
      </style>

      <header className="ui-pac__bar">
        <span className="ui-pac__mark">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="1.5" y="2.5" width="9" height="2.4" rx="1.2" fill="currentColor" />
            <rect x="1.5" y="6.8" width="12" height="2.4" rx="1.2" fill="currentColor" opacity="0.55" />
            <rect x="1.5" y="11.1" width="6" height="2.4" rx="1.2" fill="currentColor" opacity="0.3" />
          </svg>
        </span>
        <span className="ui-pac__title" id={titleId}>
          {title}
        </span>
        {task && <span className="ui-pac__task">{task}</span>}
        <span className="ui-pac__sum">
          <span>
            <b>{finished}</b> of {attempts.length} done
          </span>
          {hasCost && (
            <span>
              <b>{formatCost(spent)}</b>
            </span>
          )}
        </span>
      </header>

      <div className="ui-pac__panel" role="radiogroup" aria-labelledby={titleId}>
        {attempts.map((attempt, index) => {
          const isPickable = attempt.status === "done";
          const isPicked = isPickable && attempt.id === pickedId;
          const isBest = best?.id === attempt.id;
          const isQuiet = pickedId !== null && !isPicked && attempt.status !== "running";
          const progress = Math.min(1, Math.max(0, attempt.progress ?? 0));
          const lane =
            attempt.status === "done"
              ? attempt.score != null
                ? Math.min(1, Math.max(0, attempt.score / 100))
                : progress
              : attempt.status === "failed"
                ? Math.min(1, Math.max(0, attempt.progress ?? 1))
                : progress;

          return (
            <div
              key={attempt.id}
              className="ui-pac__row"
              data-status={attempt.status}
              data-best={isBest ? "" : undefined}
              data-picked={isPicked ? "" : undefined}
              data-quiet={isQuiet ? "" : undefined}
              style={{ "--i": index, "--p": lane } as CSSProperties}
            >
              <span className="ui-pac__icon" aria-hidden="true">
                {attempt.icon ?? attempt.name.trim().charAt(0).toUpperCase()}
              </span>

              <div className="ui-pac__who">
                <span className="ui-pac__name">
                  {attempt.name}
                  <span className="ui-pac__approach">{attempt.approach}</span>
                </span>
                <span className="ui-pac__line" key={attempt.line ?? ""}>
                  {attempt.line}
                </span>
              </div>

              <div className="ui-pac__lane" aria-hidden="true">
                <span className="ui-pac__fill" />
              </div>

              <div className="ui-pac__end">
                {attempt.status === "done" ? (
                  <span className="ui-pac__score" key={`${attempt.status}:${attempt.score ?? ""}`}>
                    {Math.round(attempt.score ?? progress * 100)}
                    {isBest && <span className="ui-pac__best">Best</span>}
                  </span>
                ) : attempt.status === "failed" ? (
                  <span className="ui-pac__score" key={`${attempt.status}:${attempt.score ?? ""}`}>
                    <span className="ui-pac__failed">Failed</span>
                  </span>
                ) : (
                  <span className="ui-pac__score" key={`${attempt.status}:${attempt.score ?? ""}`}>
                    <span className="ui-pac__pct">{Math.round(progress * 100)}%</span>
                  </span>
                )}

                <span className="ui-pac__meta-slot">
                  {attempt.cost != null && (
                    <span className="ui-pac__meta" data-hide={isPickable ? "" : undefined}>
                      {formatCost(attempt.cost)}
                    </span>
                  )}
                  {isPickable && (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isPicked}
                      aria-label={
                        isPicked
                          ? `${attempt.name} is in use`
                          : `Use the ${attempt.name} attempt – ${attempt.approach}`
                      }
                      className="ui-pac__use"
                      data-on={isPicked ? "" : undefined}
                      tabIndex={attempt.id === focusId ? 0 : -1}
                      ref={(node) => {
                        if (node) radioRefs.current.set(attempt.id, node);
                        else radioRefs.current.delete(attempt.id);
                      }}
                      onClick={() => choose(attempt)}
                      onKeyDown={(event) => move(event, attempt)}
                    >
                      {isPicked ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path
                              d="M5 12.5l4.5 4.5L19 7"
                              stroke="currentColor"
                              strokeWidth="2.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          In use
                        </>
                      ) : (
                        "Use"
                      )}
                    </button>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const css = /* css */ `
.ui-pac{--ui-pac-panel: #fffdfb;--ui-pac-card: #fffdfb;--ui-pac-strong: #0b0908;--ui-pac-ink: rgba(11, 9, 8, 0.88);--ui-pac-text: rgba(11, 9, 8, 0.61);--ui-pac-muted: rgba(11, 9, 8, 0.45);--ui-pac-faint: rgba(11, 9, 8, 0.27);--ui-pac-line: rgba(11, 9, 8, 0.06);--ui-pac-fill: rgba(11, 9, 8, 0.06);--ui-pac-track: rgba(11, 9, 8, 0.035);--ui-pac-accent: rgba(217, 84, 31, 0.765);--ui-pac-focus: rgba(217, 84, 31, 0.35);--ui-pac-running-bg: rgba(217, 84, 31, 0.12);--ui-pac-running-edge: rgba(217, 84, 31, 0.34);--ui-pac-running-ink: #d9541f;--ui-pac-done-bg: rgba(26, 122, 74, 0.14);--ui-pac-done-edge: rgba(26, 122, 74, 0.32);--ui-pac-done-ink: #1a7a4ae0;--ui-pac-failed-bg: #b3261e20;--ui-pac-failed-edge: rgba(179, 38, 30, 0.36);--ui-pac-failed-ink: #b3261eda;--ui-pac-best-bg: rgba(26, 122, 74, 0.24);--ui-pac-best-edge: rgba(26, 122, 74, 0.48);--ui-pac-shine: rgba(255, 253, 251, 0.85);--ui-pac-wash: rgba(26, 122, 74, 0.035);--ui-pac-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-pac-ease: cubic-bezier(0.32, 0.72, 0.24, 1);position: relative;box-sizing: border-box;width: 100%;min-width: 0;container: ui-pac / inline-size;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;font-weight: 400;line-height: 20px;color: var(--ui-pac-text);text-align: left;-webkit-font-smoothing: antialiased}
.ui-pac *, .ui-pac *::before, .ui-pac *::after{box-sizing: border-box}
:where(.ui-pac) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;text-align: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-pac button:focus-visible{outline: 2px solid var(--ui-pac-focus);outline-offset: 1px}
.ui-pac svg{display: block;flex: none}
.ui-pac__bar{display: flex;flex-wrap: wrap;align-items: center;gap: 4px 8px;min-width: 0;margin-bottom: 16px}
.ui-pac__mark{display: grid;flex: none;place-items: center;width: 16px;color: var(--ui-pac-accent)}
.ui-pac__title{flex: none;font-weight: 500;color: var(--ui-pac-strong)}
.ui-pac__task{min-width: 0;overflow: hidden;color: var(--ui-pac-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-pac__sum{display: flex;align-items: center;gap: 14px;margin-left: auto;font-size: 12px;line-height: 16px;color: var(--ui-pac-muted);font-variant-numeric: tabular-nums;white-space: nowrap}
.ui-pac__sum b{font-weight: 500;color: var(--ui-pac-ink)}
.ui-pac__panel{display: grid;gap: 8px}
.ui-pac__row{position: relative;display: grid;grid-template-columns: 28px minmax(0, 1fr) minmax(120px, 36%) 96px;align-items: center;column-gap: 14px;padding: 12px 16px 12px 12px;border-radius: 10px;background: var(--ui-pac-panel);box-shadow: var(--ui-pac-shadow);transition: opacity var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color var(--nm-dur-5, 620ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));animation: ui-pac-in var(--nm-dur-4, 380ms) var(--ui-pac-ease) calc(var(--i, 0) * 70ms) backwards}
.ui-pac__row > .ui-pac__lane{margin-left: 6px}
.ui-pac__icon{display: grid;place-items: center;width: 28px;height: 28px;border-radius: 7px;background: var(--ui-pac-card);box-shadow: var(--ui-pac-shadow);font-size: 12px;font-weight: 500;color: var(--ui-pac-text)}
.ui-pac__icon > svg{width: 14px;height: 14px}
.ui-pac__row[data-picked]{background: linear-gradient(var(--ui-pac-wash), var(--ui-pac-wash)), var(--ui-pac-panel);box-shadow: var(--ui-pac-shadow), 0 0 0 0.5px var(--ui-pac-done-edge)}
.ui-pac__row[data-quiet]{opacity: 0.5}
.ui-pac__row[data-quiet]:hover, .ui-pac__row[data-quiet]:focus-within{opacity: 1}
.ui-pac__who{display: grid;min-width: 0}
.ui-pac__name{display: flex;align-items: baseline;gap: 6px;min-width: 0;font-weight: 500;line-height: 20px;color: var(--ui-pac-ink);white-space: nowrap}
.ui-pac__model{flex: none;font-weight: 400;color: var(--ui-pac-muted)}
.ui-pac__approach{min-width: 0;overflow: hidden;font-weight: 400;color: var(--ui-pac-muted);text-overflow: ellipsis}
.ui-pac__approach::before{content: "·";margin-right: 6px;color: var(--ui-pac-faint)}
.ui-pac__line{overflow: hidden;font-size: 12px;line-height: 18px;color: var(--ui-pac-text);white-space: nowrap;text-overflow: ellipsis;animation: ui-pac-fade var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-pac__row[data-status="running"] .ui-pac__line{color: var(--k-ink)}
.ui-pac__row[data-status="failed"] .ui-pac__line{color: var(--ui-pac-failed-ink)}
.ui-pac__lane{position: relative;height: 8px;border-radius: 4px;background: var(--ui-pac-track)}
.ui-pac__fill{position: absolute;inset: 0 auto 0 0;width: calc(var(--p) * 100%);border-radius: 4px;background: var(--k-bg);box-shadow: inset 0 0 0 0.5px var(--k-edge);overflow: hidden;transition: width var(--nm-dur-5, 620ms) var(--ui-pac-ease), background-color var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-pac__row[data-status="running"] .ui-pac__fill::before{content: "";position: absolute;inset: 0 auto 0 0;width: 60px;background: linear-gradient(90deg, transparent, var(--ui-pac-shine), transparent);opacity: 0.8;animation: ui-pac-sweep var(--nm-dur-6, 1100ms) linear infinite}
.ui-pac__row[data-status="running"] .ui-pac__fill::after{content: "";position: absolute;top: 0;right: 0;bottom: 0;width: 24px;background: linear-gradient(90deg, transparent, var(--k-edge));animation: ui-pac-glow 1100ms ease-in-out infinite alternate}
.ui-pac__row[data-best] .ui-pac__fill{background: var(--ui-pac-best-bg);box-shadow: inset 0 0 0 0.5px var(--ui-pac-best-edge)}
.ui-pac__end{display: grid;justify-items: end;min-width: 0;text-align: right}
.ui-pac__score{display: inline-flex;align-items: center;gap: 6px;font-size: 13px;font-weight: 500;line-height: 20px;color: var(--ui-pac-ink);font-variant-numeric: tabular-nums;animation: ui-pac-fade var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-pac__pct{font-weight: 400;color: var(--ui-pac-muted)}
.ui-pac__failed{color: var(--ui-pac-failed-ink)}
.ui-pac__best{height: 18px;padding: 0 6px;border-radius: 4px;background: var(--ui-pac-done-bg);font-size: 11px;font-weight: 500;line-height: 18px;color: var(--ui-pac-done-ink);animation: ui-pac-pop var(--nm-dur-4, 380ms) var(--ui-pac-ease) both}
.ui-pac__meta-slot{position: relative;display: grid;justify-items: end;height: 18px}
.ui-pac__meta{font-size: 12px;line-height: 18px;color: var(--ui-pac-muted);font-variant-numeric: tabular-nums;white-space: nowrap;transition: opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-pac__use{position: absolute;top: -3px;right: -6px;display: inline-flex;align-items: center;gap: 4px;height: 24px;padding: 0 6px;border-radius: 6px;font-size: 12px;font-weight: 500;color: var(--ui-pac-text);white-space: nowrap;opacity: 0;transition: opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-pac__row:hover .ui-pac__meta[data-hide], .ui-pac__row:focus-within .ui-pac__meta[data-hide], .ui-pac__row[data-picked] .ui-pac__meta[data-hide]{opacity: 0}
.ui-pac__row:hover .ui-pac__use, .ui-pac__use:focus-visible, .ui-pac__use[data-on]{opacity: 1}
.ui-pac__use:hover{background: var(--ui-pac-fill);color: var(--ui-pac-ink)}
.ui-pac__use[data-on]{color: var(--ui-pac-done-ink);cursor: default}
.ui-pac__use[data-on]:hover{background: none}
.ui-pac [data-status="running"]{--k-bg: var(--ui-pac-running-bg);--k-edge: var(--ui-pac-running-edge);--k-ink: var(--ui-pac-running-ink)}
.ui-pac [data-status="done"]{--k-bg: var(--ui-pac-done-bg);--k-edge: var(--ui-pac-done-edge);--k-ink: var(--ui-pac-done-ink)}
.ui-pac [data-status="failed"]{--k-bg: var(--ui-pac-failed-bg);--k-edge: var(--ui-pac-failed-edge);--k-ink: var(--ui-pac-failed-ink)}
.ui-pac__row[data-best]{--k-bg: var(--ui-pac-best-bg);--k-edge: var(--ui-pac-best-edge)}
@container ui-pac (max-width: 560px){.ui-pac__sum{flex-basis: 100%;justify-content: space-between;margin-left: 0}
.ui-pac__row{grid-template-columns: 28px minmax(0, 1fr) 84px;grid-template-areas: "icon who end" "lane lane lane";row-gap: 12px;column-gap: 12px;padding: 12px 14px 14px 12px}
.ui-pac__icon{grid-area: icon}
.ui-pac__who{grid-area: who}
.ui-pac__end{grid-area: end}
.ui-pac__row > .ui-pac__lane{grid-area: lane;margin-left: 0}
.ui-pac__approach{display: none}
.ui-pac__line{display: -webkit-box;min-height: 36px;white-space: normal;-webkit-box-orient: vertical;-webkit-line-clamp: 2}
}
@keyframes ui-pac-in{from{opacity: 0;transform: translateY(4px)}
}
@keyframes ui-pac-fade{from{opacity: 0}
}
@keyframes ui-pac-pop{0%{opacity: 0;transform: scale(0.8)}
60%{opacity: 1;transform: scale(1.06)}
100%{transform: scale(1)}
}
@keyframes ui-pac-sweep{from{transform: translateX(-60px)}
to{transform: translateX(900px)}
}
@keyframes ui-pac-glow{from{opacity: 0.45}
to{opacity: 1}
}
@media (hover: none){.ui-pac__use{opacity: 1}
.ui-pac__meta[data-hide]{opacity: 0}
}
@media (prefers-reduced-motion: reduce){.ui-pac *, .ui-pac *::before, .ui-pac *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-pac{--ui-pac-panel: #211b16;--ui-pac-card: #27201a;--ui-pac-strong: #fffdfb;--ui-pac-ink: rgba(255, 253, 251, 0.9);--ui-pac-text: rgba(255, 253, 251, 0.62);--ui-pac-muted: rgba(255, 253, 251, 0.45);--ui-pac-faint: rgba(255, 253, 251, 0.28);--ui-pac-line: rgba(255, 253, 251, 0.08);--ui-pac-fill: rgba(255, 253, 251, 0.08);--ui-pac-track: rgba(255, 253, 251, 0.05);--ui-pac-accent: #ff8a5c;--ui-pac-focus: rgba(255, 138, 92, 0.45);--ui-pac-running-bg: rgba(255, 107, 53, 0.24);--ui-pac-running-edge: rgba(255, 138, 92, 0.5);--ui-pac-running-ink: #ff8a5c;--ui-pac-done-bg: rgba(47, 141, 92, 0.2);--ui-pac-done-edge: rgba(47, 141, 92, 0.4);--ui-pac-done-ink: #2f8d5c;--ui-pac-failed-bg: rgba(226, 84, 74, 0.22);--ui-pac-failed-edge: rgba(226, 84, 74, 0.48);--ui-pac-failed-ink: #e2544a;--ui-pac-best-bg: rgba(47, 141, 92, 0.32);--ui-pac-best-edge: rgba(47, 141, 92, 0.6);--ui-pac-shine: rgba(255, 253, 251, 0.3);--ui-pac-wash: rgba(47, 141, 92, 0.06);--ui-pac-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4)}

`;
