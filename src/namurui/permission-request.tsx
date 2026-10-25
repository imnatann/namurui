"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/**
 * Permission Request — an agent asks for one specific right.
 *
 * The card answers three questions before it asks for an answer: who is asking (avatar,
 * name and the tool they will use), why they need it (a short quoted reason), and exactly
 * what will happen (a counted list of the files, recipients or deploys the grant covers).
 * The grant itself is scoped — just once, for an hour, or always — and the primary button
 * names the choice currently selected. Enter allows, Esc denies.
 *
 * Once answered the card folds into a single row: a verdict mark, "Allowed for 1 hour ·
 * push to main", the time left and the hour it runs out, a Revoke button, and a thin bar
 * along the bottom that drains as the grant expires. The result replaces the ask in the
 * same card, so the decision stays where the question was.
 */

/** `safe` carries no tag; `risky` is the amber one; `destructive` also reddens the primary. */
export type RequestRisk = "safe" | "risky" | "destructive";

/** How long the right is granted for. */
export type RequestScope = "once" | "timed" | "always";

/** One line of "what will happen". */
export type PermissionPreviewRow = {
  /** Stable key; falls back to the label. */
  id?: string;
  label: string;
  /** Added/removed line counts, printed as `+12 −4` in the grant and deny colours. */
  diff?: { added?: number; removed?: number };
  /** Right-hand text for rows that are not a diff. */
  meta?: string;
  /** Leading 16px mark. Defaults to a file. */
  icon?: ReactNode;
};

/** The preview block under the reason. */
export type PermissionPreview = {
  /** Heading above the rows. Defaults to "What will happen". */
  title?: string;
  rows: PermissionPreviewRow[];
  /** Rows shown before the "N more" button. Defaults to 3. */
  limit?: number;
};

export type PermissionAgent = {
  name: string;
  /** 16px mark in the avatar. Falls back to the first letter of the name. */
  mark?: ReactNode;
};

/** Everything the card needs to ask. */
export type PermissionRequestSpec = {
  agent: PermissionAgent;
  /** What it wants, read after "wants to". */
  action: string;
  /** Where it applies — the muted line under the title. */
  target: string;
  /** The tool's mark, shown before the target. */
  tool?: ReactNode;
  risk?: RequestRisk;
  /** The agent's own words on why it needs this. */
  reason?: string;
  preview?: PermissionPreview;
  /** Which durations to offer. Defaults to all three. */
  scopes?: RequestScope[];
  /** Length of the timed grant in minutes. Defaults to 60. */
  duration?: number;
};

/** What came back from Allow. */
export type PermissionGrant = {
  scope: RequestScope;
  /** Epoch ms the grant was given. */
  at: number;
  /** Epoch ms a timed grant runs out. */
  until?: number;
};

/** `null` while it waits, then one of the two answers. */
export type RequestDecision =
  | { state: "allowed"; scope: RequestScope; at: number; until?: number }
  | { state: "denied"; at: number };

export type PermissionRequestProps = {
  /** The specific right being asked for. */
  request: PermissionRequestSpec;
  /** Controlled answer. Leave undefined to let the card answer itself. */
  decision?: RequestDecision | null;
  /** Starting answer when uncontrolled. */
  defaultDecision?: RequestDecision | null;
  /** Called with the chosen scope when the request is allowed. */
  onAllow: (grant: PermissionGrant) => void;
  /** Called on Deny or Esc. */
  onDeny?: (reason: "user" | "timeout") => void;
  /** Called on Revoke; the card returns to asking. */
  onRevoke: () => void;
  /** Called once when a timed grant runs out. */
  onExpire?: () => void;
  /** Clock for the time left. Leave undefined to tick every second. */
  now?: number;
  /** Extra class on the root. */
  className?: string;
};

const RISK_LABEL: Record<Exclude<RequestRisk, "safe">, string> = {
  risky: "Risky",
  destructive: "Destructive",
};

const FALLBACK_SCOPES: RequestScope[] = ["once", "timed", "always"];

/** "1 hour", "6 hours", "30 min". */
function durationText(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

/** "33 min left" — what the folded row says under the verdict. */
function minutesLeftText(ms: number): string {
  const minutes = Math.max(0, Math.ceil(ms / 60_000));
  return `${minutes} min left`;
}

/** "03:39 AM" — the wall clock a timed grant runs out. */
function clockText(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function PermissionRequest({
  request,
  decision: decisionProp,
  defaultDecision = null,
  onAllow,
  onDeny,
  onRevoke,
  onExpire,
  now,
  className,
}: PermissionRequestProps) {
  const uid = useId();
  const [innerDecision, setInnerDecision] = useState<RequestDecision | null>(defaultDecision);
  /* Revoke goes back to asking, so start on the scope the current grant used. */
  const seed = decisionProp !== undefined ? decisionProp : defaultDecision;
  const seedScope = seed?.state === "allowed" ? seed.scope : null;
  const [scope, setScope] = useState<RequestScope>(seedScope ?? FALLBACK_SCOPES[0]);
  const [expanded, setExpanded] = useState(false);
  const [clock, setClock] = useState(() => Date.now());

  const decision = decisionProp !== undefined ? decisionProp : innerDecision;

  const allowRef = useRef<HTMLButtonElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const expiredRef = useRef(false);

  const minutes = request.duration ?? 60;
  const offered = (request.scopes ?? FALLBACK_SCOPES).filter(
    (value, index, all) => all.indexOf(value) === index,
  );
  const choices = offered.length > 0 ? offered : [FALLBACK_SCOPES[0]];
  const active = choices.includes(scope) ? scope : choices[0];

  /* A timed grant is the only one with a clock, and the only one with a drain bar. */
  const granted = decision !== null && decision.state === "allowed" ? decision : null;
  const grantedUntil = granted?.until;
  const timed =
    granted !== null && granted.scope === "timed" && grantedUntil !== undefined
      ? { at: granted.at, until: grantedUntil }
      : null;
  const total = timed ? Math.max(0, timed.until - timed.at) : 0;
  const left = timed ? Math.max(0, timed.until - (now ?? clock)) : 0;
  const fraction = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  /* Prefer the grant's own span, so a restored 24-hour grant is not labelled with the default hour. */
  const grantMinutes = timed && total > 0 ? Math.max(1, Math.round(total / 60_000)) : minutes;

  const state: "pending" | "allowed" | "denied" | "expired" =
    decision === null ? "pending" : decision.state === "denied" ? "denied" : left <= 0 ? "expired" : "allowed";

  const running = state === "allowed" && timed !== null && now === undefined;

  /* Tick only while a timed grant is still counting down, and never on a hidden tab. */
  useEffect(() => {
    if (!running) return;
    setClock(Date.now());
    const id = window.setInterval(() => {
      if (!document.hidden) setClock(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (state !== "expired") {
      expiredRef.current = false;
      return;
    }
    if (expiredRef.current) return;
    expiredRef.current = true;
    onExpire?.();
  }, [state, onExpire]);

  /* Answering swaps the whole card for the row, so focus has to follow it. Doing it on
   * the resolved/unresolved edge keeps a parent that re-creates the decision object from
   * yanking focus back on every render. */
  const resolved = decision !== null;
  const wasResolved = useRef(resolved);
  useEffect(() => {
    if (wasResolved.current === resolved) return;
    wasResolved.current = resolved;
    if (resolved) resultRef.current?.focus({ preventScroll: true });
    else allowRef.current?.focus({ preventScroll: true });
  }, [resolved]);

  const allow = () => {
    if (decision !== null) return;
    const at = Date.now();
    const grant: PermissionGrant =
      active === "timed" ? { scope: active, at, until: at + minutes * 60_000 } : { scope: active, at };
    if (decisionProp === undefined) setInnerDecision({ state: "allowed", ...grant });
    onAllow(grant);
  };

  const deny = () => {
    if (decision !== null) return;
    if (decisionProp === undefined) setInnerDecision({ state: "denied", at: Date.now() });
    onDeny?.("user");
  };

  const revoke = () => {
    if (decisionProp === undefined) setInnerDecision(null);
    setExpanded(false);
    onRevoke();
  };

  const moveScope = (button: HTMLButtonElement, step: number) => {
    const next = choices[(choices.indexOf(active) + step + choices.length) % choices.length];
    setScope(next);
    const group = button.parentElement;
    group?.querySelectorAll<HTMLButtonElement>("[role='radio']")[choices.indexOf(next)]?.focus();
  };

  const onScopeKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    event.preventDefault();
    moveScope(event.currentTarget, event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (decision !== null) return;
    if (event.key === "Escape") {
      event.preventDefault();
      deny();
      return;
    }
    if (event.key !== "Enter") return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, input, select, textarea, kbd")) return;
    event.preventDefault();
    allow();
  };

  const titleId = `${uid}-title`;
  const whyId = `${uid}-why`;
  const whatId = `${uid}-what`;

  const rows = request.preview?.rows ?? [];
  const limit = request.preview?.limit ?? 3;
  const shown = expanded ? rows : rows.slice(0, limit);
  const hidden = rows.length - shown.length;
  const previewTitle = request.preview?.title ?? "What will happen";
  const risk = request.risk ?? "risky";
  const badge = risk === "safe" ? null : RISK_LABEL[risk];
  const initial = request.agent.name.trim().charAt(0).toUpperCase();

  const allowLabel = active === "timed" ? `Allow for ${durationText(minutes)}` : active === "always" ? "Always allow" : "Allow once";

  const head =
    decision === null
      ? ""
      : decision.state === "denied"
        ? "Denied"
        : state === "expired"
          ? "Expired"
          : decision.scope === "timed"
            ? `Allowed for ${durationText(grantMinutes)}`
            : decision.scope === "always"
              ? "Allowed always"
              : "Allowed once";

  const note =
    decision === null
      ? ""
      : decision.state === "denied"
        ? "No access was granted"
        : state === "expired"
          ? "The grant ran out"
          : decision.scope === "timed" && timed
            ? `${minutesLeftText(left)} · until ${clockText(timed.until)}`
            : decision.scope === "always"
              ? "No expiry · revoke any time"
              : "Ends when the action completes";

  return (
    <div
      className={["ui-prc", className].filter(Boolean).join(" ")}
      data-risk={risk}
      data-state={state}
      onKeyDown={onKeyDown}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-permission-request" precedence="default">
        {css}
      </style>

      <div
        className="ui-prc__card"
        role={decision === null ? "dialog" : undefined}
        aria-labelledby={decision === null ? titleId : undefined}
        aria-describedby={decision === null && request.reason ? whyId : undefined}
      >
        {decision === null ? (
          <div className="ui-prc__ask">
            <div className="ui-prc__body">
              <header className="ui-prc__head">
                <span className="ui-prc__avatar" data-logo={request.agent.mark ? "" : undefined}>
                  {request.agent.mark ?? initial}
                </span>
                <span className="ui-prc__heading">
                  <span className="ui-prc__title" id={titleId}>
                    <b>{request.agent.name}</b> wants to <b>{request.action}</b>
                  </span>
                  <span className="ui-prc__sub">
                    {request.tool ? (
                      <span className="ui-prc__tool">
                        {request.tool}
                      </span>
                    ) : null}
                    {request.target}
                  </span>
                </span>
                {badge ? (
                  <span className="ui-prc__risk" data-risk={risk}>
                    {RISK_ICON}
                    {badge}
                  </span>
                ) : null}
              </header>

              {request.reason ? (
                <p className="ui-prc__why" id={whyId}>
                  {request.reason}
                </p>
              ) : null}

              {rows.length > 0 ? (
                <section className="ui-prc__preview" aria-labelledby={whatId}>
                  <h4 className="ui-prc__label" id={whatId}>
                    {previewTitle}
                    <span className="ui-prc__count">{rows.length}</span>
                  </h4>
                  <ul className="ui-prc__list">
                    {shown.map((row, index) => (
                      <li
                        className="ui-prc__item"
                        key={row.id ?? row.label}
                        style={{ animationDelay: `${index * 40}ms` }}
                      >
                        <span className="ui-prc__item-icon">
                          {row.icon ?? FILE_ICON}
                        </span>
                        <span className="ui-prc__item-label">{row.label}</span>
                        {row.diff ? (
                          <span className="ui-prc__item-meta">
                            <span style={{ color: "var(--ui-prc-ok-fg, var(--ui-pr-ok-fg))" }}>
                              +{row.diff.added ?? 0}
                            </span>{" "}
                            <span style={{ color: "var(--ui-prc-danger-fg, var(--ui-pr-danger-fg))" }}>
                              −{row.diff.removed ?? 0}
                            </span>
                          </span>
                        ) : row.meta ? (
                          <span className="ui-prc__item-meta">{row.meta}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  {hidden > 0 ? (
                    <button type="button" className="ui-prc__more" onClick={() => setExpanded(true)}>
                      {hidden} more
                    </button>
                  ) : null}
                </section>
              ) : null}
            </div>

            <div className="ui-prc__answer">
              {choices.length > 1 ? (
                <div className="ui-prc__scopes" role="radiogroup" aria-label="How long">
                  {choices.map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      role="radio"
                      aria-checked={active === choice}
                      className="ui-prc__scope"
                      data-scope={choice}
                      tabIndex={active === choice ? 0 : -1}
                      onClick={() => setScope(choice)}
                      onKeyDown={onScopeKey}
                    >
                      {choice === "once" ? "Just once" : choice === "timed" ? durationText(minutes) : "Always"}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="ui-prc__buttons">
                <button type="button" className="ui-prc__btn" onClick={deny}>
                  Deny
                  <kbd className="ui-prc__kbd">Esc</kbd>
                </button>
                <button
                  ref={allowRef}
                  type="button"
                  className="ui-prc__btn ui-prc__btn--primary"
                  onClick={allow}
                >
                  <span key={active} className="ui-prc__btn-label">
                    {allowLabel}
                  </span>
                  <kbd className="ui-prc__kbd">↵</kbd>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            ref={resultRef}
            className="ui-prc__result"
            data-kind={state}
            tabIndex={-1}
            aria-live="polite"
          >
            <span className="ui-prc__result-icon" aria-hidden="true">
              {state === "expired" ? EXPIRED_ICON : state === "denied" ? DENIED_ICON : ALLOWED_ICON}
            </span>
            <span className="ui-prc__result-text">
              <span className="ui-prc__result-head">
                {head}
                <span className="ui-prc__result-action"> · {request.action}</span>
              </span>
              <span className="ui-prc__result-note">{note}</span>
            </span>
            {decision.state === "allowed" ? (
              <button type="button" className="ui-prc__ghost" onClick={revoke}>
                Revoke
              </button>
            ) : null}
            {timed ? (
              <div className="ui-prc__drain" aria-hidden="true">
                <span style={{ transform: `scaleX(${fraction})` }} />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- icons ---------- */

const RISK_ICON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M13.9248 21H10.0752C5.44476 21 3.12955 21 2.27636 19.4939C1.42317 17.9879 2.60736 15.9914 4.97574 11.9985L6.90057 8.75333C9.17559 4.91778 10.3131 3 12 3C13.6869 3 14.8244 4.91777 17.0994 8.75332L19.0243 11.9985C21.3926 15.9914 22.5768 17.9879 21.7236 19.4939C20.8704 21 18.5552 21 13.9248 21Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
    <path d="M12 9V13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    <path
      d="M12.125 16.75H12M12.25 16.75C12.25 16.8881 12.1381 17 12 17C11.8619 17 11.75 16.8881 11.75 16.75C11.75 16.6119 11.8619 16.5 12 16.5C12.1381 16.5 12.25 16.6119 12.25 16.75Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

const FILE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 12.0001V8.00008C4 5.17166 4 3.75744 4.87868 2.87876C5.75736 2.00008 7.17157 2.00008 10 2.00008H14C16.8284 2.00008 18.2426 2.00008 19.1213 2.87876C20 3.75744 20 5.17166 20 8.00008V16.0001C20 18.8285 20 20.2427 19.1213 21.1214C18.2426 22.0001 16.8284 22.0001 14 22.0001H10C7.17157 22.0001 5.75736 22.0001 4.87868 21.1214C4 20.2427 4 18.8285 4 16.0001V12.0001Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path d="M8 7H16M8 12H16M8 17H12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
  </svg>
);

const ALLOWED_ICON = (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.4" />
    <path
      d="M5.3 8.3 7.2 10.2 10.8 6"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const DENIED_ICON = (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.4" />
    <path d="M5.8 5.8 10.2 10.2M10.2 5.8 5.8 10.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const EXPIRED_ICON = (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.4" />
    <path d="M8 4.8V8.2L10.2 9.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const css = /* css */ `
.ui-prc{--ui-prc-card: #fffdfb;--ui-prc-strong: #0b0908;--ui-prc-ink: rgba(11, 9, 8, 0.88);--ui-prc-text: rgba(11, 9, 8, 0.61);--ui-prc-muted: rgba(11, 9, 8, 0.45);--ui-prc-faint: rgba(11, 9, 8, 0.27);--ui-prc-icon: rgba(11, 9, 8, 0.447);--ui-prc-line: rgba(11, 9, 8, 0.06);--ui-prc-wash: rgba(11, 9, 8, 0.03);--ui-prc-fill: rgba(11, 9, 8, 0.06);--ui-prc-accent: rgba(217, 84, 31, 0.765);--ui-prc-ok-bg: #1a7a4a19;--ui-prc-ok-fg: #1a7a4ae0;--ui-prc-warn-bg: #d9953029;--ui-prc-warn-fg: #d9541f;--ui-prc-danger-bg: #b3261e18;--ui-prc-danger-fg: #b3261eda;--ui-prc-primary: #1c1713;--ui-prc-on-primary: #fffdfb;--ui-prc-focus: rgba(217, 84, 31, 0.35);--ui-prc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-prc-ease: cubic-bezier(0.32, 0.72, 0.24, 1);position: relative;box-sizing: border-box;width: 100%;max-width: 400px;container-type: inline-size;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;font-weight: 400;line-height: 20px;color: var(--ui-prc-text);text-align: left;-webkit-font-smoothing: antialiased}
.ui-prc *, .ui-prc *::before, .ui-prc *::after{box-sizing: border-box}
:where(.ui-prc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;text-align: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-prc button:focus-visible{outline: 2px solid var(--ui-prc-focus);outline-offset: 1px}
.ui-prc ul{margin: 0;padding: 0;list-style: none}
.ui-prc h4, .ui-prc p{margin: 0}
.ui-prc svg{display: block;flex: none}
.ui-prc__card{overflow: hidden;border-radius: 10px;background: var(--ui-prc-card);box-shadow: var(--ui-prc-shadow)}
.ui-prc__card:focus-within{outline: none}
.ui-prc__ask{animation: ui-prc-in var(--nm-dur-3, 240ms) var(--ui-prc-ease) both}
.ui-prc__head{display: flex;align-items: center;gap: 10px;padding: 14px 14px 0 16px}
.ui-prc__avatar{display: grid;flex: none;place-items: center;width: 28px;height: 28px;border-radius: 7px;background: var(--ui-prc-card);box-shadow: var(--ui-prc-shadow);font-size: 11px;font-weight: 500;color: var(--ui-prc-text)}
.ui-prc__avatar[data-logo] > svg{width: 16px;height: 16px}
.ui-prc__heading{display: grid;flex: 1;min-width: 0}
.ui-prc__title{color: var(--ui-prc-text)}
.ui-prc__title b{font-weight: 500;color: var(--ui-prc-strong)}
.ui-prc__sub{display: flex;align-items: center;gap: 5px;min-width: 0;overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-prc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-prc__tool{display: grid;flex: none;place-items: center;width: 12px;height: 12px}
.ui-prc__tool > svg{width: 12px;height: 12px}
.ui-prc__risk{display: inline-flex;flex: none;align-self: start;align-items: center;gap: 3px;height: 18px;margin-top: 1px;padding: 0 6px 0 4px;border-radius: 4px;background: var(--ui-prc-warn-bg);font-size: 11px;font-weight: 500;line-height: 16px;color: var(--ui-prc-warn-fg)}
.ui-prc__risk[data-risk="destructive"]{background: var(--ui-prc-danger-bg);color: var(--ui-prc-danger-fg)}
.ui-prc__why{margin: 12px 16px 0 54px !important;padding-left: 10px;border-left: 2px solid var(--ui-prc-fill);font-size: 12px;line-height: 18px;color: var(--ui-prc-text)}
.ui-prc__preview{margin-top: 14px;padding: 12px 10px 4px;border-top: 0.5px solid var(--ui-prc-line)}
.ui-prc__label{display: flex;align-items: center;gap: 6px;margin: 0 6px 4px !important;font-size: 12px;font-weight: 400;line-height: 16px;color: var(--ui-prc-muted)}
.ui-prc__count{display: grid;place-items: center;min-width: 16px;height: 16px;padding: 0 4px;border-radius: 4px;background: var(--ui-prc-card);box-shadow: var(--ui-prc-shadow);font-size: 10px;font-weight: 500;line-height: 16px;color: var(--ui-prc-text);font-variant-numeric: tabular-nums}
.ui-prc__list{display: grid}
.ui-prc__item{display: flex;align-items: center;gap: 10px;min-height: 30px;padding: 0 6px;border-radius: 6px;animation: ui-prc-in var(--nm-dur-3, 240ms) var(--ui-prc-ease) both}
.ui-prc__item-icon{display: grid;flex: none;place-items: center;width: 16px;height: 16px;color: var(--ui-prc-icon)}
.ui-prc__item-icon > svg{width: 16px;height: 16px}
.ui-prc__item-label{flex: 1;min-width: 0;overflow: hidden;color: var(--ui-prc-ink);white-space: nowrap;text-overflow: ellipsis}
.ui-prc__item-meta{flex: none;font-size: 12px;color: var(--ui-prc-muted);white-space: nowrap;font-variant-numeric: tabular-nums}
.ui-prc__more{margin: 0 0 4px 32px;padding: 2px 0;font-size: 12px;line-height: 16px;color: var(--ui-prc-muted);transition: color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-prc__more:hover{color: var(--ui-prc-ink)}
.ui-prc__answer{display: grid;gap: 12px;padding: 12px 16px 16px;border-top: 0.5px solid var(--ui-prc-line)}
.ui-prc__body:not(:has(.ui-prc__preview)){padding-bottom: 14px}
.ui-prc__scopes{display: flex;gap: 8px}
.ui-prc__scope{flex: 1;padding: 3px 8px;border-radius: 6px;background: var(--ui-prc-fill);font-size: 12px;font-weight: 500;line-height: 18px;color: var(--ui-prc-text);text-align: center !important;white-space: nowrap;transition: color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-prc__scope[aria-checked="true"]{background: var(--ui-prc-card);box-shadow: var(--ui-prc-shadow);color: var(--ui-prc-strong)}
.ui-prc__scope[aria-checked="false"]:hover{background: rgba(11, 9, 8, 0.08);color: var(--ui-prc-ink)}
.ui-prc__hint{margin-top: -6px;font-size: 11px;line-height: 16px;color: var(--ui-prc-muted)}
.ui-prc__buttons{display: flex;justify-content: flex-end;gap: 8px}
.ui-prc__btn{display: inline-flex;align-items: center;justify-content: center;gap: 8px;height: 28px;padding: 0 8px 0 12px;border-radius: 6px;background: var(--ui-prc-card);box-shadow: var(--ui-prc-shadow);font-size: 13px;font-weight: 500;color: var(--ui-prc-ink);white-space: nowrap;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-prc__btn:hover{background: var(--ui-prc-wash)}
.ui-prc__btn:active{transform: scale(0.98)}
.ui-prc__btn--primary{background: var(--ui-prc-primary);box-shadow: none;color: var(--ui-prc-on-primary)}
.ui-prc__btn--primary:hover{background: var(--ui-prc-primary);opacity: 0.88}
.ui-prc[data-risk="destructive"] .ui-prc__btn--primary{background: var(--ui-prc-danger-fg)}
.ui-prc__btn-label{animation: ui-prc-swap var(--nm-dur-3, 240ms) var(--ui-prc-ease) both}
.ui-prc__kbd{display: grid;place-items: center;min-width: 18px;height: 18px;padding: 0 4px;border-radius: 4px;background: var(--ui-prc-fill);font-family: inherit;font-size: 10px;font-weight: 500;line-height: 16px;color: var(--ui-prc-muted)}
.ui-prc__btn--primary .ui-prc__kbd{background: rgba(255, 253, 251, 0.16);color: rgba(255, 253, 251, 0.72)}
.ui-prc__result{position: relative;display: flex;align-items: center;gap: 10px;min-height: 56px;padding: 10px 10px 10px 16px;animation: ui-prc-in var(--nm-dur-3, 240ms) var(--ui-prc-ease) both}
.ui-prc__result-icon{display: grid;flex: none;place-items: center;width: 16px;height: 16px;animation: ui-prc-pop var(--nm-dur-4, 380ms) var(--ui-prc-ease) both}
.ui-prc__result[data-kind="allowed"] .ui-prc__result-icon{color: var(--ui-prc-ok-fg)}
.ui-prc__result[data-kind="denied"] .ui-prc__result-icon{color: var(--ui-prc-danger-fg)}
.ui-prc__result[data-kind="expired"] .ui-prc__result-icon{color: var(--ui-prc-muted)}
.ui-prc__result-text{display: grid;flex: 1;min-width: 0}
.ui-prc__result-head{overflow: hidden;font-weight: 500;color: var(--ui-prc-strong);white-space: nowrap;text-overflow: ellipsis}
.ui-prc__result-action{font-weight: 400;color: var(--ui-prc-muted)}
.ui-prc__result-note{overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-prc-muted);white-space: nowrap;text-overflow: ellipsis;font-variant-numeric: tabular-nums}
.ui-prc__ghost{flex: none;height: 28px;padding: 0 10px;border-radius: 6px;font-size: 12px;font-weight: 500;color: var(--ui-prc-text);transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-prc__ghost:hover{background: var(--ui-prc-fill);color: var(--ui-prc-ink)}
.ui-prc__drain{position: absolute;right: 0;bottom: 0;left: 0;height: 2px;background: var(--ui-prc-wash)}
.ui-prc__drain > span{display: block;height: 100%;background: var(--ui-prc-ok-fg);opacity: 0.7;transform-origin: left;transition: transform var(--nm-dur-6, 1100ms) linear}
@keyframes ui-prc-in{from{opacity: 0;transform: translateY(3px)}
}
@keyframes ui-prc-swap{from{opacity: 0;transform: translateY(2px)}
}
@keyframes ui-prc-pop{0%{opacity: 0;transform: scale(0.5)}
60%{opacity: 1;transform: scale(1.12)}
}
@container (max-width: 340px){.ui-prc__why{margin-left: 16px !important}
.ui-prc__scopes{gap: 4px}
.ui-prc__scope{padding: 4px 4px}
.ui-prc__buttons > .ui-prc__btn{flex: 1}
.ui-prc__kbd{display: none}
}
@media (hover: none){.ui-prc__kbd{display: none}
}
@media (pointer: coarse){.ui-prc__scope{padding: 8px 10px}
.ui-prc__btn, .ui-prc__ghost{height: 40px}
.ui-prc__btn{padding: 0 16px}
}
@media (prefers-reduced-motion: reduce){.ui-prc *, .ui-prc *::before, .ui-prc *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-prc__scope[aria-checked="false"]:hover{background: rgba(255, 253, 251, 0.11)}
:where(.dark, [data-theme="dark"]) .ui-prc__btn--primary .ui-prc__kbd{background: rgba(11, 9, 8, 0.1);color: rgba(11, 9, 8, 0.55)}
:where(.dark, [data-theme="dark"]) .ui-prc[data-risk="destructive"] .ui-prc__btn--primary{background: #e2544a;color: #fffdfb}
:where(.dark, [data-theme="dark"]) .ui-prc[data-risk="destructive"] .ui-prc__btn--primary .ui-prc__kbd{background: rgba(255, 253, 251, 0.18);color: rgba(255, 253, 251, 0.75)}
:where(.dark, [data-theme="dark"]) .ui-prc{--ui-prc-card: #211b16;--ui-prc-strong: #fffdfb;--ui-prc-ink: rgba(255, 253, 251, 0.9);--ui-prc-text: rgba(255, 253, 251, 0.62);--ui-prc-muted: rgba(255, 253, 251, 0.45);--ui-prc-faint: rgba(255, 253, 251, 0.28);--ui-prc-icon: rgba(255, 253, 251, 0.5);--ui-prc-line: rgba(255, 253, 251, 0.08);--ui-prc-wash: rgba(255, 253, 251, 0.04);--ui-prc-fill: rgba(255, 253, 251, 0.08);--ui-prc-accent: #ff8a5c;--ui-prc-ok-bg: #2f8d5c1f;--ui-prc-ok-fg: #2f8d5c;--ui-prc-warn-bg: #ff6b3525;--ui-prc-warn-fg: #ff8a5c;--ui-prc-danger-bg: #e2544a2b;--ui-prc-danger-fg: #e2544a;--ui-prc-primary: #ebe3da;--ui-prc-on-primary: #181310;--ui-prc-focus: rgba(255, 138, 92, 0.45);--ui-prc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4)}

`;
