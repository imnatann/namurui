"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

/*
 * Guardrail editor: the ordered policy list an agent's outbound message is checked against,
 * with a tester that reports which rule fires on a sample.
 * Rules are read top to bottom and the first match wins, so the list ranks with real move-up
 * and move-down buttons. A row settles into its new place instead of jumping, the row the
 * tester fires on is the one thing carrying the ember accent, and the result text never
 * remounts, so it changes without flashing.
 */

/** What a firing rule does to the message. */
export type GuardrailAction = "block" | "warn" | "redact";

/** How a rule's raw pattern is read. */
export type GuardrailMatch = "contains" | "regex";

/** One policy rule. Position in the array is precedence: earlier is checked sooner. */
export type GuardrailRule = {
  /** Stable identity, so a row keeps its element while the order changes */
  id: string;
  /** The rule in plain language, read first */
  label: string;
  /** The raw pattern, shown under the description */
  pattern: string;
  /** `contains` is a case-insensitive substring, `regex` is a JavaScript expression */
  match?: GuardrailMatch;
  /** What happens when this rule is the first to match */
  action: GuardrailAction;
  /** A switched-off rule stays in the list and is skipped by the tester */
  enabled?: boolean;
};

/** What the tester found. */
export type GuardrailVerdict =
  | {
      state: "match";
      /** The rank printed beside the rule that fired */
      rank: number;
      ruleId: string;
      action: GuardrailAction;
      /** The exact text the pattern matched, as typed */
      matched: string;
      /** The outbound text when the action is `redact`, with the match masked */
      redacted?: string;
    }
  | {
      state: "clear";
      /** Rules that were evaluated */
      checked: number;
      /** Rules skipped because they are switched off */
      skipped: number;
    };

export type GuardrailEditorProps = {
  /** Heading over the rule list */
  title?: string;
  /** The rules in precedence order. Set this to own the list */
  rules?: GuardrailRule[];
  /** Starting rules when the caller does not own the list */
  defaultRules?: GuardrailRule[];
  /** Called with the whole next list on every move and toggle */
  onRulesChange?: (rules: GuardrailRule[]) => void;
  /** Sample text. Set this to own the field */
  sample?: string;
  /** Starting sample text when the caller does not own the field */
  defaultSample?: string;
  /** Called on every keystroke in the tester */
  onSampleChange?: (sample: string) => void;
  /** Called with the verdict each time the tester evaluates */
  onEvaluate?: (verdict: GuardrailVerdict) => void;
  /** Extra class on the root */
  className?: string;
};

/* ---------- reading a rule ---------- */

type RuleView = {
  id: string;
  label: string;
  pattern: string;
  match: GuardrailMatch;
  action: GuardrailAction;
  enabled: boolean;
  broken: boolean;
};

/** Fills in the optional fields, so every consumer reads one shape. */
function ruleView(rule: GuardrailRule): RuleView {
  const match = rule.match ?? "contains";
  // A pattern the engine refuses is a defect in the rule, not a match that never came.
  let broken = false;
  if (match === "regex") {
    try {
      new RegExp(rule.pattern, "i");
    } catch {
      broken = true;
    }
  }
  return {
    id: rule.id,
    label: rule.label,
    pattern: rule.pattern,
    match,
    action: rule.action,
    enabled: rule.enabled ?? true,
    broken,
  };
}

/** The substring `view` matches in `text`, or null. A pattern that will not compile never fires. */
function matchText(view: RuleView, text: string): string | null {
  if (view.match === "regex") {
    if (view.broken) return null;
    const hit = new RegExp(view.pattern, "i").exec(text);
    return hit ? hit[0] : null;
  }
  const needle = view.pattern.trim().toLowerCase();
  if (!needle) return null;
  const at = text.toLowerCase().indexOf(needle);
  return at === -1 ? null : text.slice(at, at + needle.length);
}

/** The first enabled rule whose pattern matches wins, exactly as the note above the list says. */
export function evaluateGuardrails(rules: GuardrailRule[], text: string): GuardrailVerdict {
  let checked = 0;
  let skipped = 0;
  for (let index = 0; index < rules.length; index += 1) {
    const view = ruleView(rules[index]);
    if (!view.enabled) {
      skipped += 1;
      continue;
    }
    checked += 1;
    const matched = matchText(view, text);
    if (matched === null) continue;
    // Every occurrence of the match is masked with one block per character, so the length reads.
    const redacted =
      view.action !== "redact"
        ? undefined
        : matched
          ? text.split(matched).join("\u2588".repeat(matched.length))
          : text;
    return {
      state: "match",
      rank: index + 1,
      ruleId: view.id,
      action: view.action,
      matched,
      redacted,
    };
  }
  return { state: "clear", checked, skipped };
}

/* ---------- motion ---------- */

/*
 * The reorder runs through the Web Animations API, which cannot read a custom property, so the
 * token's literal is repeated here: duration is --nm-dur-3 and the curve is --nm-ease-out.
 */
const FLIP_MS = 240; // --nm-dur-3
const FLIP_EASE = "cubic-bezier(0.22, 1, 0.36, 1)"; // --nm-ease-out

/* Layout effects warn during server rendering, where there is nothing to measure yet. */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/* ---------- labels ---------- */

const ACTION_LABEL: Record<GuardrailAction, string> = {
  block: "Block",
  warn: "Warn",
  redact: "Redact",
};

const ACTION_EFFECT: Record<GuardrailAction, string> = {
  block: "The send is stopped and the agent is told which rule caught it.",
  warn: "The send continues and the run is flagged for review.",
  redact: "The matched text is masked before the send leaves.",
};

/* ---------- icons ---------- */

/* Two rails on two posts: the barrier itself. */
const RAIL_ICON = (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2.2 6h11.6M2.2 10h11.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M5 3.4v9.2M11 3.4v9.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

const BLOCK_ICON = (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="5.3" stroke="currentColor" strokeWidth="1.3" />
    <path d="M4.6 11.4 11.4 4.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const WARN_ICON = (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 2.3 14.3 13H1.7L8 2.3Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M8 6.3v3.2M8 11.4h.02" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

/* A line of text with a bar pulled over its middle. */
const REDACT_ICON = (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2.4 4.2h4M7.6 4.2h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <rect x="3.8" y="6.6" width="8.4" height="2.8" rx="1" fill="currentColor" />
    <path d="M2.4 11.8h3.4M7 11.8h6.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

const PASS_ICON = (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M3.4 8.5 6.5 11.6 12.6 4.6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const UP_ICON = (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M8 12.6V4"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4.3 7.7 8 4l3.7 3.7"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const DOWN_ICON = (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M8 3.4V12"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4.3 8.3 8 12l3.7-3.7"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ACTION_ICON: Record<GuardrailAction, typeof BLOCK_ICON> = {
  block: BLOCK_ICON,
  warn: WARN_ICON,
  redact: REDACT_ICON,
};

/* ---------- component ---------- */

export function GuardrailEditor({
  title = "Guardrail rules",
  rules: rulesProp,
  defaultRules,
  onRulesChange,
  sample: sampleProp,
  defaultSample = "",
  onSampleChange,
  onEvaluate,
  className,
}: GuardrailEditorProps) {
  const testerId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef(new Map<string, HTMLLIElement>());
  const topsRef = useRef(new Map<string, number>());

  const [ownedRules, setOwnedRules] = useState<GuardrailRule[]>(() => defaultRules ?? []);
  const [ownedSample, setOwnedSample] = useState(defaultSample);
  const [pulseId, setPulseId] = useState<string | null>(null);

  const list = rulesProp ?? ownedRules;
  const text = sampleProp ?? ownedSample;
  const verdict = evaluateGuardrails(list, text);
  const firedId = verdict.state === "match" ? verdict.ruleId : null;

  let active = 0;
  let broken = 0;
  for (const rule of list) {
    const view = ruleView(rule);
    if (view.enabled) active += 1;
    if (view.broken) broken += 1;
  }

  /*
   * Reorder motion. Runs after every commit, because it only animates the rows whose committed
   * top moved since the last commit, which is exactly what a shuffle is.
   */
  useIsomorphicLayoutEffect(() => {
    const nodes = rowsRef.current;
    if (nodes.size === 0 || typeof window === "undefined") return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, number>();
    nodes.forEach((node, id) => {
      /*
       * offsetTop is the committed layout position. getBoundingClientRect would fold in a flip
       * that is still in flight and compound the next one.
       */
      const top = node.offsetTop;
      next.set(id, top);
      const before = topsRef.current.get(id);
      if (still || before === undefined || Math.abs(before - top) < 1) return;
      if (typeof node.getAnimations === "function") {
        node.getAnimations().forEach((animation) => animation.cancel());
      }
      node.animate(
        [{ transform: `translateY(${before - top}px)` }, { transform: "translateY(0px)" }],
        { duration: FLIP_MS, easing: FLIP_EASE }
      );
    });
    topsRef.current = next;
  });

  /*
   * A width change rewraps the labels, so the stored tops stop describing the rows. Re-baseline
   * them instead of flipping from a distance that belonged to the old width.
   */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      rowsRef.current.forEach((node, id) => topsRef.current.set(id, node.offsetTop));
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  /*
   * The emphasis pulse is an attribute, so it fires once per change of the firing rule and is
   * taken off again by the animation's own end event.
   */
  useEffect(() => {
    setPulseId(firedId);
  }, [firedId]);

  const evaluateRef = useRef(onEvaluate);
  useEffect(() => {
    evaluateRef.current = onEvaluate;
  }, [onEvaluate]);
  useEffect(() => {
    evaluateRef.current?.(evaluateGuardrails(list, text));
  }, [list, text]);

  const commit = (next: GuardrailRule[]) => {
    if (rulesProp === undefined) setOwnedRules(next);
    onRulesChange?.(next);
  };

  const move = (index: number, delta: -1 | 1) => {
    const to = index + delta;
    if (to < 0 || to >= list.length) return;
    const next = list.slice();
    const moved = next.splice(index, 1)[0];
    next.splice(to, 0, moved);
    commit(next);
  };

  const toggle = (index: number) => {
    commit(
      list.map((rule, at) => (at === index ? { ...rule, enabled: !(rule.enabled ?? true) } : rule))
    );
  };

  const setText = (next: string) => {
    if (sampleProp === undefined) setOwnedSample(next);
    onSampleChange?.(next);
  };

  return (
    <div
      ref={rootRef}
      className={["ui-gred", className].filter(Boolean).join(" ")}
      data-state={verdict.state}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-guardrail-editor" precedence="default">
        {css}
      </style>

      <header className="ui-gred__head">
        <span className="ui-gred__sigil" aria-hidden="true">
          {RAIL_ICON}
        </span>
        <h3 className="ui-gred__title">{title}</h3>
        <span className="ui-gred__tally">
          {active} of {list.length} active
        </span>
      </header>

      <p className="ui-gred__note">
        Checked top to bottom. The first rule that matches wins and the ones under it are never
        consulted. A rule that is switched off stays in place but is skipped.
      </p>

      {broken > 0 ? (
        <p className="ui-gred__flag">
          <span className="ui-gred__flag-icon" aria-hidden="true">
            {WARN_ICON}
          </span>
          {broken === 1
            ? "One pattern does not compile, so that rule can never fire."
            : `${broken} patterns do not compile, so those rules can never fire.`}
        </p>
      ) : null}

      {list.length === 0 ? (
        <p className="ui-gred__empty">
          <span className="ui-gred__verdict-icon" aria-hidden="true">
            {PASS_ICON}
          </span>
          No rules yet, so every message passes through unchanged.
        </p>
      ) : (
        <ol className="ui-gred__rules">
          {list.map((rule, index) => {
            const view = ruleView(rule);
            const firing = firedId === rule.id;
            return (
              <li
                key={rule.id}
                ref={(node) => {
                  if (node) rowsRef.current.set(rule.id, node);
                  else rowsRef.current.delete(rule.id);
                }}
                className="ui-gred__rule"
                data-enabled={view.enabled ? "true" : "false"}
                data-firing={firing ? "true" : "false"}
                data-pulse={pulseId === rule.id ? "true" : "false"}
                data-broken={view.broken ? "true" : "false"}
                onAnimationEnd={(event) => {
                  if (event.animationName !== "ui-gred-rise") return;
                  setPulseId((current) => (current === rule.id ? null : current));
                }}
              >
                <span className="ui-gred__rail" aria-hidden="true" />
                <span className="ui-gred__rank" aria-hidden="true">
                  {index + 1}
                </span>
                <div className="ui-gred__meta">
                  <span className="ui-gred__label">{rule.label}</span>
                  <span className="ui-gred__pattern">
                    <span className="ui-gred__mode">{view.match}</span>
                    <code className="ui-gred__code">{rule.pattern}</code>
                  </span>
                </div>
                <div className="ui-gred__side">
                  <span className="ui-gred__action" data-action={view.action}>
                    {ACTION_ICON[view.action]}
                    {ACTION_LABEL[view.action]}
                  </span>
                  <div className="ui-gred__moves">
                    <button
                      type="button"
                      className="ui-gred__move"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move rule ${index + 1}, ${rule.label}, up`}
                    >
                      {UP_ICON}
                    </button>
                    <button
                      type="button"
                      className="ui-gred__move"
                      onClick={() => move(index, 1)}
                      disabled={index === list.length - 1}
                      aria-label={`Move rule ${index + 1}, ${rule.label}, down`}
                    >
                      {DOWN_ICON}
                    </button>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={view.enabled}
                    className="ui-gred__switch"
                    onClick={() => toggle(index)}
                    aria-label={`Rule ${index + 1}, ${rule.label}`}
                  >
                    <span className="ui-gred__knob" aria-hidden="true" />
                    <span className="ui-gred__switch-word">{view.enabled ? "On" : "Off"}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <section className="ui-gred__tester" aria-labelledby={testerId}>
        <div className="ui-gred__tester-head">
          <h4 className="ui-gred__tester-title" id={testerId}>
            Tester
          </h4>
          <span className="ui-gred__tester-hint">
            {list.length - active} switched off
          </span>
        </div>

        <label className="ui-gred__field">
          <span className="ui-gred__field-label">Sample message</span>
          <input
            type="text"
            className="ui-gred__input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste what the agent would send"
            spellCheck={false}
            autoComplete="off"
          />
        </label>

        <div
          className="ui-gred__result"
          role="status"
          aria-live="polite"
          data-state={verdict.state}
          data-action={verdict.state === "match" ? verdict.action : undefined}
        >
          <p className="ui-gred__verdict">
            <span className="ui-gred__verdict-icon" aria-hidden="true">
              {verdict.state === "match" ? ACTION_ICON[verdict.action] : PASS_ICON}
            </span>
            <span className="ui-gred__verdict-text">
              {verdict.state === "match" ? (
                <>
                  <b>Rule {verdict.rank} fires.</b> {ACTION_EFFECT[verdict.action]}
                </>
              ) : (
                <>
                  <b>No rule matches.</b> The message passes through unchanged.
                </>
              )}
            </span>
          </p>
          <p className="ui-gred__evidence">
            <span className="ui-gred__evidence-key">Matched</span>
            <code className="ui-gred__code">
              {verdict.state === "match" && verdict.matched
                ? verdict.matched
                : "nothing in the sample"}
            </code>
          </p>
          <p className="ui-gred__evidence ui-gred__evidence--out">
            <span className="ui-gred__evidence-key">Outbound</span>
            <code className="ui-gred__code">
              {verdict.state === "match" && verdict.action === "block"
                ? `held back by rule ${verdict.rank}`
                : verdict.state === "match" && verdict.redacted !== undefined
                  ? verdict.redacted
                  : text || "nothing to send"}
            </code>
          </p>
        </div>
      </section>
    </div>
  );
}

/*
 * Every colour and timing is a knob on the root class, so a host retheme is one block:
 *   .ui-gred { --ui-gred-accent: #b45309; }
 * Each one prefers the document token and falls back to the literal, because this component
 * also has to render in a host that never loads tokens.css.
 */
const css = /* css */ `
.ui-gred{--ui-gred-ink:var(--text, #1a1410);--ui-gred-muted:var(--text-muted, #6f625a);--ui-gred-subtle:var(--text-subtle, #1a141066);--ui-gred-card:var(--card, #ffffff);--ui-gred-panel:var(--panel, #fffdfb);--ui-gred-sunk:var(--preview, #fdfaf7);--ui-gred-line:var(--border, #e8e0d7);--ui-gred-line-soft:var(--border-soft, #1a14101a);--ui-gred-wash:var(--hover-bg, #7a4a1c12);--ui-gred-accent:var(--accent, #c2410c);--ui-gred-accent-fg:var(--accent-fg, #fffdfb);--ui-gred-block:var(--danger, #b3261e);--ui-gred-warn:var(--warning, #9a6410);--ui-gred-on:var(--primary, #1a1410);--ui-gred-focus:var(--accent, #c2410c);--ui-gred-shadow:var(--shadow-card, 0 1px 1.5px #3d1f0a0a, inset 0 -1px 0 #3d1f0a0f);--ui-gred-ease:var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));--ui-gred-dur-1:var(--nm-dur-1, 90ms);--ui-gred-dur-2:var(--nm-dur-2, 160ms);--ui-gred-dur-3:var(--nm-dur-3, 240ms);position:relative;box-sizing:border-box;display:grid;gap:12px;width:100%;max-width:680px;padding:18px;container-type:inline-size;border-radius:var(--radius-card, 16px);background:var(--ui-gred-panel);box-shadow:inset 0 0 0 1px var(--ui-gred-line),var(--ui-gred-shadow);font-family:"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size:13px;font-weight:400;line-height:20px;color:var(--ui-gred-ink);letter-spacing:-0.01em;text-align:left;-webkit-font-smoothing:antialiased}
.ui-gred *,.ui-gred *::before,.ui-gred *::after{box-sizing:border-box}
.ui-gred h3,.ui-gred h4,.ui-gred p,.ui-gred ol,.ui-gred li{margin:0;padding:0}
.ui-gred ol{list-style:none}
.ui-gred svg{display:block;flex:none}
.ui-gred code{font-family:ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;font-size:11px}
.ui-gred button{font:inherit;color:inherit;background:none;border:0;margin:0;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.ui-gred :focus-visible{outline:2px solid var(--ui-gred-focus);outline-offset:2px}
.ui-gred__head{display:flex;align-items:center;gap:9px;min-width:0}
.ui-gred__sigil{display:grid;place-items:center;flex:none;width:26px;height:26px;border-radius:8px;background:var(--ui-gred-sunk);box-shadow:inset 0 0 0 1px var(--ui-gred-line);color:var(--ui-gred-muted)}
.ui-gred__sigil > svg{width:15px;height:15px}
.ui-gred__title{flex:1;min-width:0;font-size:13px;font-weight:600;color:var(--ui-gred-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ui-gred__tally{flex:none;font-size:11px;font-weight:500;color:var(--ui-gred-muted);font-variant-numeric:tabular-nums}
.ui-gred__note{font-size:12px;line-height:17px;color:var(--ui-gred-muted)}
.ui-gred__flag{display:flex;align-items:flex-start;gap:6px;font-size:12px;line-height:17px;color:var(--ui-gred-warn)}
.ui-gred__flag-icon{display:grid;place-items:center;flex:none;width:14px;height:14px;margin-top:2px}
.ui-gred__flag-icon > svg{width:14px;height:14px}
.ui-gred__empty{display:flex;align-items:center;gap:8px;padding:14px;border-radius:var(--radius-preview, 12px);background:var(--ui-gred-sunk);box-shadow:inset 0 0 0 1px var(--ui-gred-line-soft);font-size:12.5px;color:var(--ui-gred-muted)}
.ui-gred__rules{position:relative;display:grid;gap:6px}
.ui-gred__rules::before{content:"";position:absolute;left:18px;top:18px;bottom:18px;width:1px;background:var(--ui-gred-line);pointer-events:none}
.ui-gred__rule{position:relative;display:grid;grid-template-columns:20px minmax(0, 1fr) auto;align-items:center;gap:10px;padding:9px 10px 9px 8px;border-radius:var(--radius-preview, 12px);background:var(--ui-gred-card);box-shadow:inset 0 0 0 1px var(--ui-gred-line-soft);transition:box-shadow var(--ui-gred-dur-2) var(--ui-gred-ease),opacity var(--ui-gred-dur-2) var(--ui-gred-ease)}
.ui-gred__rule[data-enabled="false"]{opacity:0.52}
.ui-gred__rule[data-firing="true"]{box-shadow:inset 0 0 0 1px var(--ui-gred-accent)}
.ui-gred__rail{position:absolute;left:0;top:9px;bottom:9px;width:3px;border-radius:0 3px 3px 0;background:var(--ui-gred-accent);transform:scaleY(0);transition:transform var(--ui-gred-dur-3) var(--ui-gred-ease)}
.ui-gred__rule[data-firing="true"] .ui-gred__rail{transform:scaleY(1)}
.ui-gred__rule[data-pulse="true"] .ui-gred__rail{animation:ui-gred-rise var(--ui-gred-dur-3, 240ms) var(--ui-gred-ease, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-gred__rank{display:grid;place-items:center;width:20px;height:20px;border-radius:6px;background:var(--ui-gred-sunk);box-shadow:inset 0 0 0 1px var(--ui-gred-line-soft);font-size:11px;font-weight:600;color:var(--ui-gred-muted);font-variant-numeric:tabular-nums;transition:background-color var(--ui-gred-dur-2) var(--ui-gred-ease),color var(--ui-gred-dur-2) var(--ui-gred-ease),box-shadow var(--ui-gred-dur-2) var(--ui-gred-ease)}
.ui-gred__rule[data-firing="true"] .ui-gred__rank{background:var(--ui-gred-accent);box-shadow:inset 0 0 0 1px var(--ui-gred-accent);color:var(--ui-gred-accent-fg)}
.ui-gred__meta{display:grid;gap:2px;min-width:0}
.ui-gred__label{font-size:13px;font-weight:500;color:var(--ui-gred-ink);overflow-wrap:anywhere}
.ui-gred__pattern{display:flex;align-items:baseline;gap:6px;min-width:0;color:var(--ui-gred-muted)}
.ui-gred__mode{flex:none;padding:0 5px;border-radius:4px;background:var(--ui-gred-sunk);box-shadow:inset 0 0 0 1px var(--ui-gred-line-soft);font-size:9.5px;font-weight:600;line-height:15px;letter-spacing:0.03em;text-transform:uppercase;color:var(--ui-gred-muted)}
.ui-gred__code{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ui-gred-muted)}
.ui-gred__rule[data-broken="true"] .ui-gred__code{color:var(--ui-gred-block);text-decoration:underline wavy}
.ui-gred__side{display:flex;align-items:center;gap:6px;flex:none}
.ui-gred__action{display:inline-flex;align-items:center;gap:4px;height:20px;padding:0 6px;border-radius:6px;background:var(--ui-gred-sunk);box-shadow:inset 0 0 0 1px var(--ui-gred-line-soft);font-size:11px;font-weight:500;color:var(--ui-gred-muted);white-space:nowrap}
.ui-gred__action > svg{width:11px;height:11px}
.ui-gred__action[data-action="block"]{color:var(--ui-gred-block)}
.ui-gred__action[data-action="warn"]{color:var(--ui-gred-warn)}
.ui-gred__moves{display:flex;gap:1px}
.ui-gred__move{display:grid;place-items:center;width:22px;height:22px;border-radius:6px;color:var(--ui-gred-muted);transition:background-color var(--ui-gred-dur-1) var(--ui-gred-ease),color var(--ui-gred-dur-1) var(--ui-gred-ease),transform var(--ui-gred-dur-1) var(--ui-gred-ease)}
.ui-gred__move > svg{width:11px;height:11px}
.ui-gred__move:hover:not(:disabled){background:var(--ui-gred-wash);color:var(--ui-gred-ink)}
.ui-gred__move:active:not(:disabled){transform:scale(0.9)}
.ui-gred__move:disabled{color:var(--ui-gred-subtle);cursor:not-allowed}
.ui-gred__switch{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 7px 0 6px;border-radius:var(--radius-pill, 999px);background:var(--ui-gred-sunk);box-shadow:inset 0 0 0 1px var(--ui-gred-line-soft);font-size:9.5px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:var(--ui-gred-muted);transition:background-color var(--ui-gred-dur-2) var(--ui-gred-ease),color var(--ui-gred-dur-2) var(--ui-gred-ease),box-shadow var(--ui-gred-dur-2) var(--ui-gred-ease)}
.ui-gred__switch[aria-checked="true"]{color:var(--ui-gred-ink);box-shadow:inset 0 0 0 1px var(--ui-gred-line)}
.ui-gred__knob{position:relative;flex:none;width:16px;height:10px;border-radius:999px;background:var(--ui-gred-line);transition:background-color var(--ui-gred-dur-2) var(--ui-gred-ease)}
.ui-gred__knob::after{content:"";position:absolute;top:1px;left:1px;width:8px;height:8px;border-radius:50%;background:var(--ui-gred-muted);box-shadow:0 1px 1px rgba(0, 0, 0, 0.18);transform:translateX(0);transition:transform var(--ui-gred-dur-2) var(--ui-gred-ease),background-color var(--ui-gred-dur-2) var(--ui-gred-ease)}
.ui-gred__switch[aria-checked="true"] .ui-gred__knob{background:var(--ui-gred-on)}
.ui-gred__switch[aria-checked="true"] .ui-gred__knob::after{transform:translateX(6px);background:var(--ui-gred-card)}
.ui-gred__tester{display:grid;gap:8px;padding:12px;border-radius:var(--radius-preview, 12px);background:var(--ui-gred-sunk);box-shadow:inset 0 0 0 1px var(--ui-gred-line-soft)}
.ui-gred__tester-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.ui-gred__tester-title{font-size:10.5px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--ui-gred-muted)}
.ui-gred__tester-hint{font-size:11px;color:var(--ui-gred-subtle);font-variant-numeric:tabular-nums}
.ui-gred__field{display:grid;gap:4px}
.ui-gred__field-label{font-size:11px;color:var(--ui-gred-muted)}
.ui-gred__input{width:100%;height:32px;padding:0 10px;border:0;border-radius:8px;background:var(--ui-gred-card);box-shadow:inset 0 0 0 1px var(--ui-gred-line);font-family:inherit;font-size:12.5px;color:var(--ui-gred-ink);transition:box-shadow var(--ui-gred-dur-2) var(--ui-gred-ease)}
.ui-gred__input::placeholder{color:var(--ui-gred-subtle)}
.ui-gred__result{display:grid;gap:5px;min-height:62px}
.ui-gred__verdict{display:flex;align-items:flex-start;gap:8px;min-height:38px;font-size:12.5px;line-height:19px;color:var(--ui-gred-muted)}
.ui-gred__verdict-text{min-width:0}
.ui-gred__verdict-text b{font-weight:600;color:var(--ui-gred-ink)}
.ui-gred__verdict-icon{display:grid;place-items:center;flex:none;width:16px;height:16px;margin-top:2px;color:var(--ui-gred-muted);transition:color var(--ui-gred-dur-2) var(--ui-gred-ease)}
.ui-gred__verdict-icon > svg{width:16px;height:16px}
.ui-gred__result[data-state="clear"] .ui-gred__verdict-icon{color:var(--ui-gred-ink)}
.ui-gred__result[data-action="block"] .ui-gred__verdict-icon{color:var(--ui-gred-block)}
.ui-gred__result[data-action="warn"] .ui-gred__verdict-icon{color:var(--ui-gred-warn)}
.ui-gred__evidence{display:flex;align-items:baseline;gap:8px;min-width:0;font-size:12px;line-height:17px}
.ui-gred__evidence-key{flex:none;width:62px;font-size:10.5px;letter-spacing:0.03em;text-transform:uppercase;color:var(--ui-gred-subtle)}
.ui-gred__evidence .ui-gred__code{color:var(--ui-gred-ink)}
.ui-gred__result[data-action="block"] .ui-gred__evidence--out .ui-gred__code{color:var(--ui-gred-block)}
@keyframes ui-gred-rise{0%{opacity:0.12}
40%{opacity:1}
100%{opacity:1}
}
@container (max-width: 460px){.ui-gred__rule{grid-template-columns:20px minmax(0, 1fr)}
.ui-gred__side{grid-column:2;justify-content:flex-start;flex-wrap:wrap}
}
:where(.dark, [data-theme="dark"]) .ui-gred{--ui-gred-ink:var(--text, #f4ece4);--ui-gred-muted:var(--text-muted, #a2958a);--ui-gred-subtle:var(--text-subtle, #f4ece48c);--ui-gred-card:var(--card, #201a15);--ui-gred-panel:var(--panel, #1a1512);--ui-gred-sunk:var(--preview, #26201a);--ui-gred-line:var(--border, #33291f);--ui-gred-line-soft:var(--border-soft, #ffffff12);--ui-gred-wash:var(--hover-bg, #ffffff12);--ui-gred-accent:var(--accent, #ff6b35);--ui-gred-accent-fg:var(--accent-fg, #1a0f08);--ui-gred-block:var(--danger, #e2544a);--ui-gred-warn:var(--warning, #d99530);--ui-gred-on:var(--primary, #f4ece4);--ui-gred-focus:var(--accent, #ff6b35);--ui-gred-shadow:var(--shadow-card, 0 1px 1.5px #0000004d, inset 0 -1px 0 #ffffff0a)}
@media (prefers-reduced-motion: reduce){.ui-gred *,.ui-gred *::before,.ui-gred *::after{animation:none;transition-duration:1ms}
.ui-gred__rule[data-pulse="true"] .ui-gred__rail{animation:none}
}
`;