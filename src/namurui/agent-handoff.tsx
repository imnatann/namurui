"use client";

import { useEffect, useRef, useState } from "react";

/*
 * Agent handoff - control passing from one agent to another, with the reason, the payload and a decision.
 * The two agent chips travel in from opposite edges and settle against the connector with a small
 * overshoot. Accepting fills the connector and runs a short pulse from source to target; declining walks
 * the payload chip back to the agent that keeps control. Every outcome is written out as a sentence, so
 * the decision never depends on a tint.
 */

/** What the agent is doing right now. */
export type HandoffAgentStatus = "active" | "idle" | "blocked";

export type HandoffAgent = {
  /** Name shown on the chip */
  name: string;
  /** What the agent is for, e.g. "Research" */
  role: string;
  /** Current activity. Defaults to whoever holds control: live for that agent, idle for the other */
  status?: HandoffAgentStatus;
};

/** One labelled line in the payload summary. */
export type HandoffPayloadItem = {
  /** What kind of context, e.g. "Thread" */
  label: string;
  /** The value that travels, e.g. "#launch-review" */
  value: string;
};

export type HandoffState = "pending" | "accepted" | "declined" | "expired";

export type AgentHandoffProps = {
  /** Agent giving up control */
  from: HandoffAgent;
  /** Agent taking over */
  to: HandoffAgent;
  /** Why control is moving, quoted under the connector */
  reason: string;
  /** What travels with the handoff, shown as label and value rows */
  payload?: HandoffPayloadItem[];
  /** Size of the payload, e.g. "42 KB". The item count is measured from `payload` */
  size?: string;
  /** When the request was raised, e.g. "2 min ago" */
  stamp?: string;
  /** Controlled state. Leave undefined to let the card resolve itself */
  state?: HandoffState;
  /** Initial state when uncontrolled */
  defaultState?: HandoffState;
  /** Called when control is accepted */
  onAccept?: () => void;
  /** Called when the handoff is declined */
  onDecline?: () => void;
  /** Called by Reopen or Send again after a decision */
  onReopen?: () => void;
  className?: string;
};

const STATUS_WORD: Record<HandoffAgentStatus, string> = {
  active: "live",
  idle: "idle",
  blocked: "blocked",
};

export function AgentHandoff({
  from,
  to,
  reason,
  payload = [],
  size,
  stamp = "just now",
  state,
  defaultState = "pending",
  onAccept,
  onDecline,
  onReopen,
  className,
}: AgentHandoffProps) {
  const [inner, setInner] = useState<HandoffState>(defaultState);
  const current = state ?? inner;
  const settled = current !== "pending";

  const rootRef = useRef<HTMLElement>(null);
  const linkRef = useRef<HTMLDivElement>(null);
  const packetRef = useRef<HTMLSpanElement>(null);

  /* The chip travels half the free length of the connector, and the pulse travels the whole of it.
   * Both are measured, so the motion holds from 320px to 1920px and after a resize. */
  useEffect(() => {
    const root = rootRef.current;
    const link = linkRef.current;
    const packet = packetRef.current;
    if (!root || !link || !packet) return;

    const measure = () => {
      const width = link.clientWidth;
      const travel = Math.max(0, Math.round((width - packet.offsetWidth) / 2) - 2);
      root.style.setProperty("--ui-aghf-run", `${travel}px`);
      root.style.setProperty("--ui-aghf-reach", `${Math.max(0, Math.round(width - 34))}px`);
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(link);
    observer.observe(packet);
    return () => observer.disconnect();
  }, []);

  const accept = () => {
    if (settled) return;
    onAccept?.();
    if (state === undefined) setInner("accepted");
  };

  const decline = () => {
    if (settled) return;
    onDecline?.();
    if (state === undefined) setInner("declined");
  };

  const reopen = () => {
    onReopen?.();
    if (state === undefined) setInner("pending");
  };

  const count = payload.length;
  const countLabel = `${count} ${count === 1 ? "item" : "items"}`;
  const sizeLabel = size ? `${countLabel} · ${size}` : countLabel;

  const status =
    current === "accepted"
      ? `Control transferred to ${to.name}`
      : current === "declined"
        ? `Declined. Control stays with ${from.name}`
        : current === "expired"
          ? `No answer in time. Control stays with ${from.name}`
          : `Waiting for ${to.name} to accept`;

  const tone = current === "accepted" ? "ok" : current === "expired" ? "warn" : "wait";

  const mark =
    current === "accepted" ? (
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <path d="M2.5 6.2 4.9 8.6 9.5 3.4" />
      </svg>
    ) : current === "declined" ? (
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <path d="M9.5 4.4H4" />
        <path d="M5.9 2.5 4 4.4l1.9 1.9" />
      </svg>
    ) : current === "expired" ? (
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <circle cx="6" cy="6" r="4.3" />
        <path d="M6 3.8V6l1.4.9" />
        <path d="M2.4 2.4 9.6 9.6" />
      </svg>
    ) : (
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <circle cx="6" cy="6" r="4.6" />
        <path d="M6 3.6V6l1.7 1" />
      </svg>
    );

  const chip = (agent: HandoffAgent, side: "from" | "to") => {
    /* Control is the subject: whoever holds it reads live, and the other reads idle, until the
     * caller supplies its own status. */
    const holds = side === "from" ? current !== "accepted" : current === "accepted";
    const activity = agent.status ?? (holds ? "active" : "idle");
    return (
      <div className="ui-aghf__agent" data-side={side} data-status={activity}>
        <span className="ui-aghf__mono" aria-hidden="true">
          {agent.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="ui-aghf__ident">
          <span className="ui-aghf__name">{agent.name}</span>
          <span className="ui-aghf__meta">
            <span className="ui-aghf__role">{agent.role}</span>
            <span className="ui-aghf__sep" aria-hidden="true">
              ·
            </span>
            <span className="ui-aghf__state">
              <span className="ui-aghf__dot" aria-hidden="true" />
              {STATUS_WORD[activity]}
            </span>
          </span>
        </span>
      </div>
    );
  };

  return (
    <article
      ref={rootRef}
      className={["ui-aghf", className].filter(Boolean).join(" ")}
      data-state={current}
      aria-label={`Handoff from ${from.name} to ${to.name}`}
    >
      {/* React 19 hoists this into <head> once, no matter how many handoffs render */}
      <style href="ui-agent-handoff" precedence="default">
        {css}
      </style>

      <header className="ui-aghf__head">
        <span className="ui-aghf__eyebrow">
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M1.6 6h8.2" />
            <path d="M6.9 3.1 9.8 6l-2.9 2.9" />
          </svg>
          <span>Handoff</span>
        </span>
        <span className="ui-aghf__stamp">{stamp}</span>
      </header>

      <div className="ui-aghf__rail">
        {chip(from, "from")}

        <div className="ui-aghf__link" ref={linkRef} aria-hidden="true">
          <span className="ui-aghf__track">
            <span className="ui-aghf__fill" />
          </span>
          <span className="ui-aghf__pulse" />
          <span className="ui-aghf__packet" ref={packetRef}>
            <svg viewBox="0 0 12 12">
              <rect x="2.2" y="1.6" width="7.6" height="5.6" rx="1.4" />
              <path d="M3.4 9.2h5.2" />
              <path d="M4.4 11h3.2" />
            </svg>
            <span className="ui-aghf__count">{count}</span>
          </span>
        </div>

        {chip(to, "to")}
      </div>

      <blockquote className="ui-aghf__reason">
        <p className="ui-aghf__quote">{reason}</p>
      </blockquote>

      <div className="ui-aghf__payload">
        <div className="ui-aghf__payload-head">
          <span className="ui-aghf__payload-label">Payload</span>
          <span className="ui-aghf__payload-size">{sizeLabel}</span>
        </div>
        {payload.length > 0 ? (
          <dl className="ui-aghf__rows">
            {payload.map((item, index) => (
              <div className="ui-aghf__row" key={`${item.label}-${index}`}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="ui-aghf__none">Only control travels. No context is attached.</p>
        )}
      </div>

      <div className="ui-aghf__foot">
        <p className="ui-aghf__status" role="status" aria-live="polite">
          <span className="ui-aghf__mark" data-tone={tone} aria-hidden="true">
            {mark}
          </span>
          <span className="ui-aghf__text">{status}</span>
        </p>

        <div className="ui-aghf__actions">
          {settled ? (
            <button type="button" className="ui-aghf__btn ui-aghf__btn--ghost" onClick={reopen}>
              {current === "expired" ? "Send again" : "Reopen handoff"}
            </button>
          ) : (
            <>
              <button type="button" className="ui-aghf__btn ui-aghf__btn--outline" onClick={decline}>
                Decline
              </button>
              <button type="button" className="ui-aghf__btn ui-aghf__btn--primary" onClick={accept}>
                Accept
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

const css = /* css */ `
.ui-aghf{
  /* Retheme a single handoff by overriding these on .ui-aghf. Every value falls back to a literal,
     so the card stays correct in a host that never loads the document tokens. */
  --ui-aghf-ink: var(--text, #1a1410);
  --ui-aghf-muted: var(--text-muted, #6f625a);
  --ui-aghf-faint: var(--text-subtle, #1a141066);
  --ui-aghf-card: var(--card, #fffdfb);
  --ui-aghf-wash: #7a4a1c0f;
  --ui-aghf-tile: #7a4a1c12;
  --ui-aghf-line: var(--border, #e8e0d7);
  --ui-aghf-line-soft: var(--border-soft, #1a14101a);
  --ui-aghf-ember: var(--accent, #c2410c);
  --ui-aghf-ember-soft: var(--accent-soft, #c2410c1a);
  --ui-aghf-spark: #ffd9c7;
  --ui-aghf-ok: var(--success, #1a7a4a);
  --ui-aghf-ok-soft: #1a7a4a14;
  --ui-aghf-warn: var(--warning, #9a6410);
  --ui-aghf-warn-soft: #9a641014;
  --ui-aghf-primary: var(--primary, #1a1410);
  --ui-aghf-primary-hover: #2f251d;
  --ui-aghf-primary-ink: var(--primary-fg, #fffdfb);
  --ui-aghf-focus: #c2410c66;
  --ui-aghf-shadow: var(--shadow-card, 0 1px 1.5px #3d1f0a0a);
  --ui-aghf-radius: var(--radius-card, 16px);
  --ui-aghf-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-aghf-ease-both: var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1));
  --ui-aghf-spring: var(--nm-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  --ui-aghf-ease-soft: var(--nm-ease-soft, cubic-bezier(0.4, 0, 0.2, 1));
  /* Measured by the component: half the chip's free travel, and the pulse's run. */
  --ui-aghf-run: 0px;
  --ui-aghf-reach: 0px;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 16px;
  border-radius: var(--ui-aghf-radius);
  background: var(--ui-aghf-card);
  box-shadow: inset 0 0 0 1px var(--ui-aghf-line), var(--ui-aghf-shadow);
  color: var(--ui-aghf-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  line-height: 20px;
  letter-spacing: -0.01em;
  text-align: left;
  -webkit-font-smoothing: antialiased;
  container-type: inline-size;
}
.ui-aghf *,.ui-aghf *::before,.ui-aghf *::after{box-sizing:border-box}
.ui-aghf__head{display:flex;align-items:center;gap:8px;min-width:0}
.ui-aghf__eyebrow{display:inline-flex;align-items:center;gap:6px;min-width:0;color:var(--ui-aghf-muted);font-size:10.5px;font-weight:600;line-height:14px;letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap}
.ui-aghf__eyebrow svg{flex:none;width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.ui-aghf__stamp{margin-left:auto;min-width:0;overflow:hidden;color:var(--ui-aghf-muted);font-size:11.5px;line-height:16px;font-variant-numeric:tabular-nums;white-space:nowrap;text-overflow:ellipsis}
.ui-aghf__rail{display:flex;align-items:center;min-width:0;margin-top:14px}
.ui-aghf__agent{position:relative;display:flex;flex:0 1 auto;align-items:center;gap:8px;min-width:0;padding:8px 10px 8px 8px;border-radius:12px;background-color:var(--ui-aghf-wash)}
.ui-aghf__agent[data-side="from"]{animation:ui-aghf-meet-from var(--nm-dur-5, 620ms) var(--ui-aghf-spring) both}
.ui-aghf__agent[data-side="to"]{animation:ui-aghf-meet-to var(--nm-dur-5, 620ms) var(--ui-aghf-spring) both}
.ui-aghf__agent::after{content:"";position:absolute;inset:0;border:1px solid var(--ui-aghf-line-soft);border-radius:inherit;pointer-events:none;transition:border-color var(--nm-dur-3, 240ms) var(--ui-aghf-ease-out)}
.ui-aghf[data-state="pending"] .ui-aghf__agent[data-side="to"]::after{border-style:dashed;border-color:var(--ui-aghf-line)}
.ui-aghf[data-state="accepted"] .ui-aghf__agent[data-side="to"]::after{border-color:var(--ui-aghf-ok)}
.ui-aghf[data-state="declined"] .ui-aghf__agent[data-side="from"]::after,.ui-aghf[data-state="expired"] .ui-aghf__agent[data-side="from"]::after{border-color:var(--ui-aghf-line)}
.ui-aghf__mono{display:grid;flex:none;place-items:center;width:26px;height:26px;border-radius:8px;background:var(--ui-aghf-tile);color:var(--ui-aghf-ink);font-size:11.5px;font-weight:600;line-height:1;letter-spacing:0}
.ui-aghf__ident{display:grid;min-width:44px;gap:1px}
.ui-aghf__name{overflow:hidden;color:var(--ui-aghf-ink);font-size:13px;font-weight:550;line-height:17px;white-space:nowrap;text-overflow:ellipsis;transition:color var(--nm-dur-2, 160ms) var(--ui-aghf-ease-out)}
.ui-aghf__meta{display:flex;align-items:center;gap:5px;min-width:0;color:var(--ui-aghf-muted);font-size:11.5px;line-height:15px;white-space:nowrap}
.ui-aghf__role{min-width:0;overflow:hidden;text-overflow:ellipsis}
.ui-aghf__sep{flex:none;color:var(--ui-aghf-faint)}
.ui-aghf__state{display:inline-flex;flex:none;align-items:center;gap:4px}
.ui-aghf__dot{flex:none;width:5px;height:5px;border-radius:50%;background:var(--ui-aghf-ok);box-shadow:0 0 0 2px var(--ui-aghf-ok-soft);transition:background-color var(--nm-dur-3, 240ms) var(--ui-aghf-ease-out), box-shadow var(--nm-dur-3, 240ms) var(--ui-aghf-ease-out)}
.ui-aghf__agent[data-status="idle"] .ui-aghf__dot{background:transparent;box-shadow:inset 0 0 0 1px var(--ui-aghf-muted)}
.ui-aghf__agent[data-status="blocked"] .ui-aghf__dot{border-radius:1.5px;background:var(--ui-aghf-warn);box-shadow:0 0 0 2px var(--ui-aghf-warn-soft)}
.ui-aghf[data-state="accepted"] .ui-aghf__agent[data-side="from"] .ui-aghf__name,.ui-aghf[data-state="declined"] .ui-aghf__agent[data-side="to"] .ui-aghf__name,.ui-aghf[data-state="expired"] .ui-aghf__agent[data-side="to"] .ui-aghf__name{color:var(--ui-aghf-muted)}
.ui-aghf__link{position:relative;display:flex;flex:1 1 44px;align-items:center;min-width:28px;height:30px;margin:0 2px}
.ui-aghf__track{position:absolute;left:0;right:0;top:50%;height:2px;margin-top:-1px;overflow:hidden;border-radius:1px;background:var(--ui-aghf-line)}
.ui-aghf[data-state="expired"] .ui-aghf__track{background:repeating-linear-gradient(90deg, var(--ui-aghf-line) 0 4px, transparent 4px 8px)}
.ui-aghf__fill{position:absolute;inset:0;border-radius:inherit;background:var(--ui-aghf-ember);transform:scaleX(0);transform-origin:left center;transition:transform var(--nm-dur-4, 380ms) var(--ui-aghf-ease-out)}
.ui-aghf[data-state="accepted"] .ui-aghf__fill{transform:scaleX(1)}
.ui-aghf__pulse{position:absolute;left:0;top:50%;width:34px;height:2px;margin-top:-1px;border-radius:1px;background:var(--ui-aghf-spark);box-shadow:0 0 10px 0 var(--ui-aghf-ember);opacity:0;pointer-events:none}
.ui-aghf[data-state="accepted"] .ui-aghf__pulse{animation:ui-aghf-pulse var(--nm-dur-4, 380ms) var(--ui-aghf-ease-soft) both}
.ui-aghf__packet{position:absolute;left:50%;top:50%;display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px 0 6px;border-radius:999px;background:var(--ui-aghf-card);box-shadow:inset 0 0 0 1px var(--ui-aghf-line);color:var(--ui-aghf-muted);font-size:11px;font-weight:550;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap;transform:translate(-50%, -50%);transition:transform var(--nm-dur-5, 620ms) var(--ui-aghf-ease-both), color var(--nm-dur-2, 160ms) var(--ui-aghf-ease-out), box-shadow var(--nm-dur-3, 240ms) var(--ui-aghf-ease-out)}
.ui-aghf__packet::after{content:"";position:absolute;inset:-3px;border-radius:inherit;box-shadow:0 0 0 1px var(--ui-aghf-ember-soft);opacity:0;pointer-events:none}
.ui-aghf[data-state="pending"] .ui-aghf__packet{color:var(--ui-aghf-ember);box-shadow:inset 0 0 0 1px var(--ui-aghf-ember-soft)}
.ui-aghf[data-state="pending"] .ui-aghf__packet::after{animation:ui-aghf-breathe var(--nm-dur-6, 1100ms) var(--ui-aghf-ease-soft) infinite alternate}
.ui-aghf[data-state="accepted"] .ui-aghf__packet{color:var(--ui-aghf-ok);box-shadow:inset 0 0 0 1px var(--ui-aghf-ok-soft);transform:translate(calc(-50% + var(--ui-aghf-run)), -50%);transition-timing-function:var(--ui-aghf-ease-out)}
.ui-aghf[data-state="declined"] .ui-aghf__packet,.ui-aghf[data-state="expired"] .ui-aghf__packet{transform:translate(calc(-50% - var(--ui-aghf-run)), -50%)}
.ui-aghf[data-state="expired"] .ui-aghf__packet{color:var(--ui-aghf-warn);box-shadow:inset 0 0 0 1px var(--ui-aghf-warn-soft)}
.ui-aghf__packet svg{flex:none;width:11px;height:11px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.ui-aghf__count{letter-spacing:0}
.ui-aghf__reason{margin:12px 0 0;padding:2px 0 2px 12px;box-shadow:inset 2px 0 0 var(--ui-aghf-line)}
.ui-aghf__quote{margin:0;color:var(--ui-aghf-ink);font-size:13px;line-height:19px}
.ui-aghf__quote::before{content:"“";color:var(--ui-aghf-faint)}
.ui-aghf__quote::after{content:"”";color:var(--ui-aghf-faint)}
.ui-aghf__payload{margin-top:12px;padding:10px 12px;border-radius:12px;background:var(--ui-aghf-wash);box-shadow:inset 0 0 0 1px var(--ui-aghf-line-soft)}
.ui-aghf__payload-head{display:flex;align-items:baseline;gap:8px;min-width:0}
.ui-aghf__payload-label{color:var(--ui-aghf-muted);font-size:10.5px;font-weight:600;line-height:15px;letter-spacing:0.06em;text-transform:uppercase}
.ui-aghf__payload-size{margin-left:auto;min-width:0;overflow:hidden;color:var(--ui-aghf-muted);font-size:11.5px;line-height:15px;font-variant-numeric:tabular-nums;white-space:nowrap;text-overflow:ellipsis}
.ui-aghf__rows{display:grid;gap:3px;margin:8px 0 0;padding:0}
.ui-aghf__row{display:grid;grid-template-columns:64px minmax(0, 1fr);align-items:baseline;gap:10px;min-width:0}
.ui-aghf__row dt{overflow:hidden;color:var(--ui-aghf-muted);font-size:12px;line-height:17px;white-space:nowrap;text-overflow:ellipsis}
.ui-aghf__row dd{min-width:0;margin:0;overflow:hidden;color:var(--ui-aghf-ink);font-family:var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace);font-size:11.5px;line-height:17px;letter-spacing:0;white-space:nowrap;text-overflow:ellipsis}
.ui-aghf__none{margin:7px 0 0;color:var(--ui-aghf-muted);font-size:12px;line-height:17px}
.ui-aghf__foot{display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px;margin-top:14px;padding-top:14px;box-shadow:inset 0 1px 0 var(--ui-aghf-line-soft)}
.ui-aghf__status{display:flex;flex:1 1 auto;align-items:center;gap:8px;min-width:0;margin:0;color:var(--ui-aghf-muted);font-size:12.5px;line-height:17px}
.ui-aghf__mark{display:grid;flex:none;place-items:center;width:18px;height:18px;border-radius:50%;background:var(--ui-aghf-wash);color:var(--ui-aghf-muted);transition:background-color var(--nm-dur-3, 240ms) var(--ui-aghf-ease-out), color var(--nm-dur-3, 240ms) var(--ui-aghf-ease-out)}
.ui-aghf__mark svg{width:11px;height:11px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.ui-aghf__mark[data-tone="ok"]{background:var(--ui-aghf-ok-soft);color:var(--ui-aghf-ok)}
.ui-aghf__mark[data-tone="warn"]{background:var(--ui-aghf-warn-soft);color:var(--ui-aghf-warn)}
.ui-aghf__text{min-width:0}
.ui-aghf__actions{display:flex;flex:0 0 auto;gap:6px;margin-left:auto}
.ui-aghf__btn{display:inline-flex;align-items:center;justify-content:center;height:32px;padding:0 12px;border:0;border-radius:9px;font:inherit;font-size:12.5px;font-weight:550;line-height:1;white-space:nowrap;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background-color var(--nm-dur-2, 160ms) var(--ui-aghf-ease-out), color var(--nm-dur-2, 160ms) var(--ui-aghf-ease-out), box-shadow var(--nm-dur-2, 160ms) var(--ui-aghf-ease-out), transform var(--nm-dur-1, 90ms) var(--ui-aghf-ease-out)}
.ui-aghf__btn:active{transform:scale(0.97)}
.ui-aghf__btn:focus-visible{outline:2px solid var(--ui-aghf-focus);outline-offset:2px}
.ui-aghf__btn--primary{background:var(--ui-aghf-primary);color:var(--ui-aghf-primary-ink)}
.ui-aghf__btn--primary:hover{background:var(--ui-aghf-primary-hover)}
.ui-aghf__btn--outline{background:transparent;color:var(--ui-aghf-ink);box-shadow:inset 0 0 0 1px var(--ui-aghf-line)}
.ui-aghf__btn--outline:hover{background:var(--ui-aghf-wash);box-shadow:inset 0 0 0 1px var(--ui-aghf-muted)}
.ui-aghf__btn--ghost{background:transparent;color:var(--ui-aghf-muted)}
.ui-aghf__btn--ghost:hover{background:var(--ui-aghf-wash);color:var(--ui-aghf-ink)}
@container (max-width: 380px){
  .ui-aghf__agent{gap:7px;padding:7px 8px 7px 7px}
  .ui-aghf__mono{width:24px;height:24px}
  .ui-aghf__actions{flex:1 1 100%;margin-left:0}
  .ui-aghf__actions .ui-aghf__btn{flex:1 1 0;min-width:0;padding:0 10px}
  .ui-aghf__row{grid-template-columns:56px minmax(0, 1fr);gap:8px}
}
@keyframes ui-aghf-meet-from{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:none}}
@keyframes ui-aghf-meet-to{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}
@keyframes ui-aghf-breathe{from{opacity:0}to{opacity:1}}
@keyframes ui-aghf-pulse{0%{opacity:0;transform:translateX(0) scaleX(0.5)}12%{opacity:1}78%{opacity:1}100%{opacity:0;transform:translateX(var(--ui-aghf-reach, 0px)) scaleX(1)}}
:where(.dark, [data-theme="dark"]) .ui-aghf{
  --ui-aghf-ink: var(--text, #f4ece4);
  --ui-aghf-muted: var(--text-muted, #a2958a);
  --ui-aghf-faint: var(--text-subtle, #f4ece48c);
  --ui-aghf-card: var(--card, #201a15);
  --ui-aghf-wash: #ffffff0d;
  --ui-aghf-tile: #ffffff12;
  --ui-aghf-line: var(--border, #33291f);
  --ui-aghf-line-soft: var(--border-soft, #ffffff12);
  --ui-aghf-ember: var(--accent, #ff6b35);
  --ui-aghf-ember-soft: var(--accent-soft, #ff6b3524);
  --ui-aghf-spark: #ffd0bb;
  --ui-aghf-ok: var(--success, #4f9d6e);
  --ui-aghf-ok-soft: #4f9d6e1f;
  --ui-aghf-warn: var(--warning, #d99530);
  --ui-aghf-warn-soft: #d995301f;
  --ui-aghf-primary: var(--primary, #f4ece4);
  --ui-aghf-primary-hover: #ffffff;
  --ui-aghf-primary-ink: var(--primary-fg, #14100d);
  --ui-aghf-focus: #ff6b3580;
  --ui-aghf-shadow: var(--shadow-card, 0 1px 1.5px #0000004d);
}
@media (prefers-reduced-motion: reduce){
  .ui-aghf,.ui-aghf *{animation:none;transition-duration:1ms}
  .ui-aghf__agent[data-side="from"],.ui-aghf__agent[data-side="to"]{animation:none}
  .ui-aghf[data-state="pending"] .ui-aghf__packet::after{animation:none;opacity:0}
  .ui-aghf[data-state="accepted"] .ui-aghf__pulse{animation:none;opacity:0}
  .ui-aghf[data-state="accepted"] .ui-aghf__fill{transform:scaleX(1)}
}
`;
