"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type AnimationEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/**
 * Approval Card — an agent asks before it acts.
 *
 * While pending it shows the intent, a risk badge and a preview of what the action will
 * touch. Approve and Deny carry their shortcuts (⌘/Ctrl + Enter, Esc) and an optional
 * "always allow" checkbox. A countdown runs until an answer and pauses the moment the
 * pointer or focus enters the card, so reading never costs the user their window.
 *
 * Answering morphs the card into a single resolved row: the root animates its own height
 * between the two layouts, the pending card blurs away, and the verdict mark draws itself
 * in. Approving can be async — the button spins while the caller's promise settles and
 * the card only collapses once it resolves.
 */

export type ApprovalRisk = "low" | "medium" | "high";
export type ApprovalStatus = "pending" | "approved" | "denied";
/** `user` came from Deny/Esc; `timeout` is the countdown running out. */
export type ApprovalDenyReason = "user" | "timeout";
/** `card` puts the actions inside the card; `tray` gives them a separate footer bar. */
export type ApprovalActions = "tray" | "card";

/** One label/value row in the preview block. */
export type ApprovalDetail = {
  label: string;
  value: ReactNode;
};

export type ApprovalCardProps = {
  /** What the agent wants to do, e.g. "Send campaign email". */
  title: string;
  /** One line of context under the title. */
  description?: string;
  /** Risk badge. `low` is the unstyled default; `medium` and `high` recolour it. */
  risk?: ApprovalRisk;
  /** Leading glyph. Defaults to a shield. */
  icon?: ReactNode;
  /** Label/value rows shown under the divider. */
  details?: ApprovalDetail[];
  /** Custom preview content; `children` is used when this is absent. */
  preview?: ReactNode;
  /** Custom preview content. */
  children?: ReactNode;
  /** Controlled status. Leave undefined to let the card resolve itself. */
  status?: ApprovalStatus;
  /** Initial status when uncontrolled. */
  defaultStatus?: ApprovalStatus;
  /** Called on Approve. Return a promise to hold the button in its busy state. */
  onApprove?: (event: { always: boolean }) => void | Promise<void>;
  /** Called on Deny or when the countdown expires. */
  onDeny?: (event: { reason: ApprovalDenyReason }) => void;
  /** Adds an Edit button before Deny. */
  onEdit?: () => void;
  /** Countdown length in seconds. `0`/undefined hides the timer. */
  expiresIn?: number;
  /** Called when the countdown reaches zero, before `onDeny({ reason: "timeout" })`. */
  onExpire?: () => void;
  /** Show the "always allow" checkbox. */
  allowAlways?: boolean;
  alwaysLabel?: string;
  approveLabel?: string;
  denyLabel?: string;
  editLabel?: string;
  /** Show the Esc / ⌘↵ keycaps. */
  shortcuts?: boolean;
  /** Small caption above the card; also reserves the space the pending card animates over. */
  label?: string;
  /** Where the actions live. Defaults to the tray footer. */
  actions?: ApprovalActions;
  className?: string;
};

const RISK_LABEL: Record<ApprovalRisk, string> = { low: "Low", medium: "Medium", high: "High" };

const HEIGHT_MS = 560;
const RELATIVE_MS = 30_000;

type Flow = {
  /** Status the current layout was built for. */
  seen: ApprovalStatus;
  leaving: boolean;
  entering: boolean;
  resolvedAt: number | null;
  announcement: string;
};

function timeAgo(from: number): string {
  const seconds = Math.floor((Date.now() - from) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  return `${Math.floor(seconds / 3600)} h ago`;
}

export function ApprovalCard({
  title,
  description,
  risk,
  icon,
  details,
  preview,
  children,
  status: statusProp,
  defaultStatus = "pending",
  onApprove,
  onDeny,
  onEdit,
  expiresIn,
  onExpire,
  allowAlways = true,
  alwaysLabel = "Always allow this action",
  approveLabel = "Approve",
  denyLabel = "Deny",
  editLabel = "Edit",
  shortcuts = true,
  label,
  actions = "tray",
  className,
}: ApprovalCardProps) {
  const uid = useId();
  const [innerStatus, setInnerStatus] = useState<ApprovalStatus>(defaultStatus);
  const status = statusProp ?? innerStatus;
  const resolved = status !== "pending";

  const [always, setAlways] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<ApprovalDenyReason>("user");
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(() => Math.ceil(expiresIn ?? 0));
  const [, setClockTick] = useState(0);
  const [metaKey, setMetaKey] = useState<"⌘" | "Ctrl">("Ctrl");
  const [flow, setFlow] = useState<Flow>({
    seen: status,
    leaving: false,
    entering: false,
    resolvedAt: status === "pending" ? null : Date.now(),
    announcement: "",
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const resolvedRef = useRef<HTMLDivElement>(null);
  const approveRef = useRef<HTMLButtonElement>(null);
  const remainingRef = useRef(0);
  const heightRef = useRef(0);
  const measuredRef = useRef(false);
  const animatingRef = useRef(false);
  const returnFocusRef = useRef(false);
  const expireRef = useRef<() => void>(() => {});

  const expiresMs = expiresIn && expiresIn > 0 ? expiresIn * 1000 : 0;
  const paused = hovered || focused || busy;

  const statusWord = status === "approved" ? "Approved" : reason === "timeout" ? "Expired" : "Denied";

  /* Status changes are a layout switch, not a patch: capture which direction the card is
   * moving in the same render that first sees the new status, so the pending card can
   * animate out while the resolved row animates in. */
  if (flow.seen !== status) {
    setFlow({
      seen: status,
      leaving: flow.seen === "pending" && status !== "pending",
      entering: status === "pending",
      resolvedAt: status === "pending" ? null : Date.now(),
      announcement: status === "pending" ? "" : `${statusWord}: ${title}`,
    });
    if (status === "pending") {
      setAlways(false);
      setBusy(false);
      setReason("user");
    }
  }

  useEffect(() => {
    const platform =
      (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
      navigator.platform ??
      "";
    if (/mac|iphone|ipad|ipod/i.test(platform) || /mac|iphone|ipad|ipod/i.test(navigator.userAgent)) {
      setMetaKey("⌘");
    }
  }, []);

  /* Keep the relative timestamp honest for as long as the row is visible. */
  useEffect(() => {
    if (!resolved) return;
    const timer = window.setInterval(() => setClockTick((tick) => tick + 1), RELATIVE_MS);
    return () => window.clearInterval(timer);
  }, [resolved]);

  const approve = async () => {
    if (resolved || busy) return;
    const pendingResult = onApprove?.({ always });
    if (pendingResult !== undefined) {
      setBusy(true);
      try {
        await pendingResult;
      } catch {
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    if (statusProp === undefined) setInnerStatus("approved");
  };

  const deny = (denyReason: ApprovalDenyReason = "user") => {
    if (resolved || (busy && denyReason === "user")) return;
    setReason(denyReason);
    if (denyReason === "timeout") onExpire?.();
    onDeny?.({ reason: denyReason });
    if (statusProp === undefined) setInnerStatus("denied");
  };

  /* The countdown calls through a ref so a re-render never restarts it with a stale closure. */
  useLayoutEffect(() => {
    expireRef.current = () => deny("timeout");
  });

  useEffect(() => {
    if (status !== "pending") return;
    remainingRef.current = expiresMs;
    setSecondsLeft(Math.ceil(expiresMs / 1000));
  }, [status, expiresMs]);

  useEffect(() => {
    if (!expiresMs || resolved || paused) return;
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      remainingRef.current -= now - last;
      last = now;
      setSecondsLeft(Math.max(0, Math.ceil(remainingRef.current / 1000)));
      if (remainingRef.current <= 0) {
        expireRef.current();
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [expiresMs, resolved, paused]);

  /* Remember the card's natural height so the switch can animate from one to the other. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (!animatingRef.current) heightRef.current = root.offsetHeight;
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    if (!measuredRef.current) {
      measuredRef.current = true;
      heightRef.current = root.offsetHeight;
      return;
    }

    const active = document.activeElement;
    if (resolved && active && root.contains(active)) resolvedRef.current?.focus({ preventScroll: true });
    if (!resolved && returnFocusRef.current) approveRef.current?.focus({ preventScroll: true });
    returnFocusRef.current = false;

    const previous = heightRef.current;
    root.style.height = "";
    const next = root.offsetHeight;
    if (!previous || previous === next) return;

    animatingRef.current = true;
    root.style.height = `${previous}px`;
    void root.offsetHeight;
    root.style.height = `${next}px`;

    const timer = window.setTimeout(() => {
      root.style.height = "";
      animatingRef.current = false;
      heightRef.current = root.offsetHeight;
    }, HEIGHT_MS);

    return () => {
      window.clearTimeout(timer);
      root.style.height = "";
      animatingRef.current = false;
    };
  }, [resolved]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (resolved || busy || event.defaultPrevented) return;
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void approve();
    } else if (event.key === "Escape") {
      event.preventDefault();
      deny("user");
    }
  };

  const onPendingAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (flow.leaving) setFlow((current) => ({ ...current, leaving: false }));
    if (flow.entering) setFlow((current) => ({ ...current, entering: false }));
  };

  const titleId = `${uid}-title`;
  const rowId = `${uid}-row`;
  const descId = `${uid}-desc`;
  const timerId = `${uid}-timer`;

  const describedBy = [description ? descId : null, expiresMs && !resolved ? timerId : null]
    .filter(Boolean)
    .join(" ");

  const previewContent = preview ?? children;

  const alwaysRow = allowAlways ? (
    <label className="ui-apc__always">
      <span className="ui-apc__box">
        <input
          type="checkbox"
          checked={always}
          disabled={busy}
          onChange={(event) => setAlways(event.target.checked)}
        />
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 8.3 6.8 11 12 5.2" />
        </svg>
      </span>
      <span className="ui-apc__always-label">{alwaysLabel}</span>
    </label>
  ) : null;

  /* In `card` mode the foot is the card's last row, so the "always allow" checkbox rides in it;
   * in `tray` mode the foot is a separate bar and the checkbox stays in the card body. */
  const foot = (
    <div className="ui-apc__foot">
      {expiresMs > 0 ? (
        <span
          className="ui-apc__expires"
          data-paused={paused || undefined}
          data-low={secondsLeft <= 10 || undefined}
          aria-hidden="true"
        >
          <svg viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="6" />
            <path d="M8 5v3.2l2 1.3" />
          </svg>
          Expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
        </span>
      ) : null}
      {actions === "card" ? alwaysRow : null}
      <div className="ui-apc__actions">
        {onEdit ? (
          <button
            type="button"
            className="ui-apc__btn ui-apc__btn--ghost"
            aria-disabled={busy || undefined}
            onClick={() => {
              if (!busy) onEdit();
            }}
          >
            {editLabel}
          </button>
        ) : null}
        <button
          type="button"
          className="ui-apc__btn ui-apc__btn--quiet ui-apc__deny"
          aria-keyshortcuts="Escape"
          aria-disabled={busy || undefined}
          onClick={() => deny("user")}
        >
          {denyLabel}
          {shortcuts ? (
            <kbd className="ui-apc__kbd" aria-hidden="true">
              Esc
            </kbd>
          ) : null}
        </button>
        <button
          ref={approveRef}
          type="button"
          className="ui-apc__btn ui-apc__btn--primary ui-apc__approve"
          aria-keyshortcuts="Meta+Enter Control+Enter"
          aria-disabled={busy || undefined}
          onClick={() => void approve()}
        >
          {approveLabel}
          {busy ? (
            <svg className="ui-apc__spinner" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="6" />
            </svg>
          ) : shortcuts ? (
            <kbd className="ui-apc__kbd" aria-hidden="true">
              {metaKey === "⌘" ? "⌘↵" : "Ctrl ↵"}
            </kbd>
          ) : null}
        </button>
      </div>
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={["ui-apc", className].filter(Boolean).join(" ")}
      role="group"
      aria-labelledby={resolved ? rowId : titleId}
      aria-describedby={describedBy || undefined}
      aria-busy={busy || undefined}
      data-status={status}
      data-busy={busy || undefined}
      data-label={label ? "" : undefined}
      data-actions={actions}
      onKeyDown={onKeyDown}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-approval-card" precedence="default">
        {css}
      </style>

      {label ? <div className="ui-apc__label">{label}</div> : null}

      {(!resolved || flow.leaving) && (
        <div
          className="ui-apc__pending"
          data-leaving={flow.leaving || undefined}
          data-entering={flow.entering || undefined}
          inert={flow.leaving}
          aria-hidden={flow.leaving || undefined}
          onAnimationEnd={onPendingAnimationEnd}
        >
          <div className="ui-apc__card">
            <div className="ui-apc__head">
              <span className="ui-apc__icon" aria-hidden="true">
                {icon ?? (
                  <svg viewBox="0 0 24 24">
                    <path d="M12 3 5 5.8v5.4c0 4.3 2.9 8.2 7 9.8 4.1-1.6 7-5.5 7-9.8V5.8L12 3Z" />
                    <path d="m9.2 12.2 2 2 3.8-4" />
                  </svg>
                )}
              </span>
              <div className="ui-apc__titles">
                <h3 className="ui-apc__title" id={flow.leaving ? undefined : titleId}>
                  {title}
                </h3>
                {description ? (
                  <p className="ui-apc__desc" id={flow.leaving ? undefined : descId}>
                    {description}
                  </p>
                ) : null}
              </div>
              {risk ? (
                <span className="ui-apc__risk" data-risk={risk}>
                  <span className="ui-apc__risk-dot" aria-hidden="true" />
                  {RISK_LABEL[risk]}
                  <span className="ui-apc__risk-word"> risk</span>
                </span>
              ) : null}
            </div>

            {previewContent || details?.length ? (
              <div className="ui-apc__preview">
                {previewContent ? <div className="ui-apc__custom">{previewContent}</div> : null}
                {details?.length ? (
                  <dl className="ui-apc__details">
                    {details.map((row, index) => (
                      <div className="ui-apc__detail" key={`${row.label}-${index}`}>
                        <dt>{row.label}</dt>
                        <dd>{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
            ) : null}

            {actions === "tray" ? alwaysRow : null}

            {actions === "card" ? foot : null}
          </div>

          {actions === "tray" ? foot : null}

          {expiresMs > 0 ? (
            <span className="ui-apc__sr" id={flow.leaving ? undefined : timerId}>
              Expires in {secondsLeft} seconds unless approved. The timer pauses while the card is hovered or
              focused.
            </span>
          ) : null}
        </div>
      )}

      {resolved && (
        <div
          ref={resolvedRef}
          className="ui-apc__card ui-apc__resolved"
          tabIndex={-1}
          data-status={status}
          onFocus={() => {
            returnFocusRef.current = true;
          }}
          onBlur={(event) => {
            if (event.relatedTarget || event.currentTarget.isConnected) returnFocusRef.current = false;
          }}
        >
          <span className="ui-apc__mark" aria-hidden="true">
            <svg viewBox="0 0 16 16">
              {status === "approved" ? (
                <path d="M4.2 8.4 6.9 11 11.8 5.6" pathLength={1} />
              ) : (
                <path d="M5.2 5.2 10.8 10.8M10.8 5.2 5.2 10.8" pathLength={1} />
              )}
            </svg>
          </span>
          <span className="ui-apc__row-title" id={rowId}>
            {title}
          </span>
          <span className="ui-apc__row-status">
            {statusWord}
            {status === "approved" && always ? <span className="ui-apc__row-extra"> · Always</span> : null}
            {flow.resolvedAt !== null ? (
              <span className="ui-apc__row-time"> · {timeAgo(flow.resolvedAt)}</span>
            ) : null}
          </span>
        </div>
      )}

      <span className="ui-apc__sr" role="status" aria-live="polite">
        {flow.announcement}
      </span>
    </div>
  );
}

const css = /* css */ `
.ui-apc{--ui-apc-tray: #eee6de;--ui-apc-bg: #fffdfb;--ui-apc-ink: #1c1713;--ui-apc-text: #5f4f41;--ui-apc-muted: #807063;--ui-apc-line: #eae2d9;--ui-apc-soft: #faf7f4;--ui-apc-tile: #f3ebe3;--ui-apc-hover: #ddd3c9;--ui-apc-primary: #1c1713;--ui-apc-primary-hover: #2e251c;--ui-apc-primary-ink: #fffdfb;--ui-apc-primary-kbd: rgba(255, 253, 251, 0.14);--ui-apc-primary-kbd-ink: rgba(255, 253, 251, 0.72);--ui-apc-kbd: rgba(11, 9, 8, 0.055);--ui-apc-box: #c6bab0;--ui-apc-box-hover: #a5988d;--ui-apc-ring: rgba(28, 23, 19, 0.32);--ui-apc-timer-low: #d99530;--ui-apc-low-bg: #f1e9e0;--ui-apc-low-ink: #5f4f41;--ui-apc-med-bg: #ede5dc;--ui-apc-med-ink: #9a6410;--ui-apc-high-bg: #f3ebe3;--ui-apc-high-ink: #b3261e;--ui-apc-ok-bg: #eee6dd;--ui-apc-ok-ink: #1a7a4a;--ui-apc-no-bg: #f1e9e0;--ui-apc-no-ink: #5f4f41;--ui-apc-ease: cubic-bezier(0.22, 1, 0.36, 1);position: relative;box-sizing: border-box;width: 100%;min-width: 0;overflow: hidden;container-type: inline-size;padding: 4px;border-radius: 20px;background: var(--ui-apc-tray);color: var(--ui-apc-text);font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 1.45;letter-spacing: -0.006em;text-align: left;-webkit-font-smoothing: antialiased;transition: height var(--nm-dur-5, 620ms) var(--ui-apc-ease)}
.ui-apc *, .ui-apc *::before, .ui-apc *::after{box-sizing: border-box}
.ui-apc__card{position: relative;border-radius: 16px;background: var(--ui-apc-bg);box-shadow: 0 0 0 1px var(--ui-apc-line), 0 1px 2px rgba(11, 9, 8, 0.04)}
.ui-apc__pending > .ui-apc__card{padding: 16px}
.ui-apc__pending[data-leaving]{position: absolute;top: 4px;left: 4px;right: 4px;pointer-events: none;animation: ui-apc-out var(--nm-dur-3, 240ms) var(--ui-apc-ease) both}
.ui-apc__pending[data-entering]{animation: ui-apc-in var(--nm-dur-4, 380ms) var(--ui-apc-ease) 80ms both}
.ui-apc[data-busy] .ui-apc__pending{pointer-events: none}
.ui-apc__head{display: grid;grid-template-columns: auto minmax(0, 1fr) auto;align-items: start;gap: 12px}
.ui-apc__icon{display: grid;place-items: center;width: 32px;height: 32px;border-radius: 9px;background: transparent;box-shadow: inset 0 0 0 1px var(--ui-apc-line);color: var(--ui-apc-ink)}
.ui-apc__icon svg{width: 16px;height: 16px;fill: none;stroke: currentColor;stroke-width: 1.7;stroke-linecap: round;stroke-linejoin: round}
.ui-apc__titles{min-width: 0;padding-top: 1px}
.ui-apc__title{margin: 0;overflow: hidden;color: var(--ui-apc-ink);font-size: 14px;font-weight: 550;line-height: 20px;letter-spacing: -0.011em;white-space: nowrap;text-overflow: ellipsis}
.ui-apc__desc{margin: 1px 0 0;overflow: hidden;font-size: 13px;line-height: 18px;white-space: nowrap;text-overflow: ellipsis}
.ui-apc__risk{display: inline-flex;align-items: center;gap: 6px;height: 22px;margin-top: 1px;padding: 0 7px;border-radius: 6px;background: var(--ui-apc-low-bg);color: var(--ui-apc-low-ink);font-size: 12px;font-weight: 500;line-height: 1;white-space: nowrap}
.ui-apc__risk-dot{display: none}
.ui-apc__risk-word{white-space: pre}
.ui-apc__risk[data-risk="medium"]{background: var(--ui-apc-med-bg);color: var(--ui-apc-med-ink)}
.ui-apc__risk[data-risk="high"]{background: var(--ui-apc-high-bg);color: var(--ui-apc-high-ink)}
.ui-apc__preview{display: grid;gap: 12px;margin-top: 14px;padding-top: 14px;border-top: 1px solid var(--ui-apc-line)}
.ui-apc__custom{min-width: 0}
.ui-apc__custom + .ui-apc__details{padding-top: 2px}
.ui-apc__details{display: grid;grid-template-columns: max-content minmax(0, 1fr);gap: 6px 16px;margin: 0}
.ui-apc__detail{display: contents}
.ui-apc__detail dt{color: var(--ui-apc-muted)}
.ui-apc__detail dd{min-width: 0;margin: 0;overflow: hidden;color: var(--ui-apc-ink);white-space: nowrap;text-overflow: ellipsis}
.ui-apc__always{display: flex;width: fit-content;max-width: 100%;margin-top: 14px;align-items: center;gap: 8px;min-width: 0;cursor: pointer;user-select: none}
.ui-apc__always-label{overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-apc__box{position: relative;display: grid;flex: none;width: 16px;height: 16px}
.ui-apc__box input{appearance: none;-webkit-appearance: none;width: 16px;height: 16px;margin: 0;border-radius: 5px;background: var(--ui-apc-bg);box-shadow: inset 0 0 0 1px var(--ui-apc-box);cursor: pointer;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-apc__box input:hover{box-shadow: inset 0 0 0 1px var(--ui-apc-box-hover)}
.ui-apc__box input:checked{background: var(--ui-apc-primary);box-shadow: inset 0 0 0 1px var(--ui-apc-primary)}
.ui-apc__box input:focus-visible{outline: none;box-shadow: inset 0 0 0 1px var(--ui-apc-primary), 0 0 0 2px var(--ui-apc-bg), 0 0 0 4px var(--ui-apc-ring)}
.ui-apc__box svg{position: absolute;inset: 0;width: 16px;height: 16px;fill: none;stroke: var(--ui-apc-primary-ink);stroke-width: 1.8;stroke-linecap: round;stroke-linejoin: round;opacity: 0;transform: scale(0.6);transition: opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-3, 240ms) var(--ui-apc-ease);pointer-events: none}
.ui-apc__box input:checked + svg{opacity: 1;transform: none}
.ui-apc__label{overflow: hidden;padding: 6px 8px 4px;color: var(--ui-apc-muted);font-size: 12.5px;line-height: 16px;white-space: nowrap;text-overflow: ellipsis}
.ui-apc[data-label] .ui-apc__pending[data-leaving]{top: 30px}
.ui-apc[data-actions="card"]{padding: 0;border-radius: 16px;background: transparent}
.ui-apc[data-actions="card"] .ui-apc__card{box-shadow: inset 0 0 0 1px var(--ui-apc-line)}
.ui-apc[data-actions="card"] .ui-apc__pending[data-leaving]{top: 0;left: 0;right: 0}
.ui-apc[data-actions="card"][data-label] .ui-apc__pending[data-leaving]{top: 26px}
.ui-apc[data-actions="card"] .ui-apc__label{padding-left: 2px}
.ui-apc__card > .ui-apc__foot{min-height: 0;margin-top: 16px;padding: 14px 0 0;border-top: 1px solid var(--ui-apc-line)}
.ui-apc__card > .ui-apc__foot .ui-apc__always{margin-top: 0}
.ui-apc__foot{display: flex;flex-wrap: wrap;align-items: center;gap: 6px 12px;min-height: 44px;padding: 6px 2px 2px 10px}
.ui-apc__expires{display: inline-flex;align-items: center;gap: 6px;min-width: 0;color: var(--ui-apc-muted);font-size: 12.5px;font-variant-numeric: tabular-nums;white-space: nowrap;transition: color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-apc__expires svg{width: 14px;height: 14px;flex: none;fill: none;stroke: currentColor;stroke-width: 1.5;stroke-linecap: round;stroke-linejoin: round}
.ui-apc__expires[data-low]{color: var(--ui-apc-timer-low)}
.ui-apc__actions{display: flex;flex: 0 0 auto;gap: 4px;margin-left: auto}
.ui-apc__btn{display: inline-flex;align-items: center;justify-content: center;gap: 8px;height: 34px;padding: 0 12px;border: 0;border-radius: 10px;font: inherit;font-size: 13px;font-weight: 500;line-height: 1;white-space: nowrap;cursor: pointer;-webkit-tap-highlight-color: transparent;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 160ms var(--ui-apc-ease), opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-apc__btn:active, .ui-apc__btn[data-pressed]{transform: scale(0.97)}
.ui-apc__btn:focus-visible{outline: none}
.ui-apc__btn--primary{padding-right: 8px;background: var(--ui-apc-primary);color: var(--ui-apc-primary-ink);box-shadow: 0 1px 2px rgba(11, 9, 8, 0.12)}
.ui-apc__btn--primary:hover, .ui-apc__btn--primary[data-pressed]{background: var(--ui-apc-primary-hover)}
.ui-apc__btn--primary:focus-visible{box-shadow: 0 0 0 2px var(--ui-apc-tray), 0 0 0 4px var(--ui-apc-ring)}
.ui-apc__btn--quiet{padding-right: 8px;background: transparent;color: var(--ui-apc-ink)}
.ui-apc__btn--quiet:hover, .ui-apc__btn--quiet[data-pressed]{background: var(--ui-apc-hover)}
.ui-apc__btn--quiet:focus-visible{box-shadow: 0 0 0 2px var(--ui-apc-ring)}
.ui-apc__btn--ghost{background: transparent;color: var(--ui-apc-text)}
.ui-apc__btn--ghost:hover{background: var(--ui-apc-hover);color: var(--ui-apc-ink)}
.ui-apc__btn--ghost:focus-visible{box-shadow: 0 0 0 2px var(--ui-apc-ring)}
.ui-apc[data-busy] .ui-apc__btn:not(.ui-apc__approve), .ui-apc[data-busy] .ui-apc__always{opacity: 0.5}
.ui-apc[data-busy] .ui-apc__approve{cursor: progress}
.ui-apc__kbd{display: inline-grid;place-items: center;min-width: 20px;height: 20px;padding: 0 5px;border-radius: 6px;background: var(--ui-apc-kbd);color: var(--ui-apc-muted);font: inherit;font-size: 11px;font-weight: 500;line-height: 1}
.ui-apc__btn--primary .ui-apc__kbd{background: var(--ui-apc-primary-kbd);color: var(--ui-apc-primary-kbd-ink)}
.ui-apc__spinner{width: 20px;height: 14px;fill: none;stroke: currentColor;stroke-width: 1.8;stroke-linecap: round;stroke-dasharray: 26 38;transform-origin: 50% 50%;animation: ui-apc-spin var(--nm-dur-5, 620ms) linear infinite}
.ui-apc__resolved{display: flex;align-items: center;gap: 10px;min-height: 48px;padding: 12px 14px;outline: none;animation: ui-apc-in var(--nm-dur-4, 380ms) var(--ui-apc-ease) 120ms both}
.ui-apc__resolved:focus-visible{box-shadow: 0 0 0 1px var(--ui-apc-line), inset 0 0 0 2px var(--ui-apc-ring)}
.ui-apc__mark{display: grid;flex: none;place-items: center;width: 22px;height: 22px;border-radius: 50%;background: var(--ui-apc-ok-bg);color: var(--ui-apc-ok-ink);animation: ui-apc-pop var(--nm-dur-4, 380ms) var(--ui-apc-ease) 140ms both}
.ui-apc__resolved[data-status="denied"] .ui-apc__mark{background: var(--ui-apc-no-bg);color: var(--ui-apc-no-ink)}
.ui-apc__mark svg{width: 14px;height: 14px;fill: none;stroke: currentColor;stroke-width: 1.9;stroke-linecap: round;stroke-linejoin: round}
.ui-apc__mark path{stroke-dasharray: 1;stroke-dashoffset: 1;animation: ui-apc-draw var(--nm-dur-4, 380ms) var(--ui-apc-ease) 300ms forwards}
.ui-apc__row-title{flex: 1 1 auto;min-width: 0;overflow: hidden;color: var(--ui-apc-ink);font-size: 13.5px;font-weight: 500;white-space: nowrap;text-overflow: ellipsis}
.ui-apc__row-status{flex: none;color: var(--ui-apc-muted);white-space: nowrap}
.ui-apc__sr{position: absolute;width: 1px;height: 1px;margin: -1px;padding: 0;overflow: hidden;clip: rect(0 0 0 0);white-space: nowrap;border: 0}
@container (max-width: 400px){.ui-apc__actions{flex: 1 1 100%;margin-left: 0}
.ui-apc__foot{padding-left: 2px}
.ui-apc__expires{padding-left: 8px}
.ui-apc__actions .ui-apc__btn{flex: 1 1 0;min-width: 0;padding: 0 10px}
.ui-apc__kbd{display: none}
}
@container (max-width: 340px){.ui-apc__pending > .ui-apc__card{padding: 14px}
.ui-apc__head{gap: 10px}
.ui-apc__risk-word{display: none}
.ui-apc__row-time{display: none}
.ui-apc__details{column-gap: 12px}
}
@media (hover: none){.ui-apc__kbd{display: none}
}
@keyframes ui-apc-out{to{opacity: 0;transform: translateY(-6px) scale(0.985);filter: blur(2px)}
}
@keyframes ui-apc-in{from{opacity: 0;transform: translateY(4px);filter: blur(2px)}
to{opacity: 1;transform: none;filter: none}
}
@keyframes ui-apc-pop{from{opacity: 0;transform: scale(0.5)}
to{opacity: 1;transform: none}
}
@keyframes ui-apc-draw{to{stroke-dashoffset: 0}
}
@keyframes ui-apc-spin{to{transform: rotate(360deg)}
}
@media (prefers-reduced-motion: reduce){.ui-apc, .ui-apc *, .ui-apc *::before, .ui-apc *::after{animation-duration: 1ms !important;animation-delay: 0ms !important;transition-duration: 1ms !important}
.ui-apc__spinner{animation: ui-apc-spin 1.6s linear infinite !important}
.ui-apc__mark path{stroke-dashoffset: 0}
}
:where(.dark, [data-theme="dark"]) .ui-apc{--ui-apc-tray: #181310;--ui-apc-bg: #1e1914;--ui-apc-ink: #ebe3da;--ui-apc-text: #958678;--ui-apc-muted: #847467;--ui-apc-line: #2c241b;--ui-apc-soft: #231d18;--ui-apc-tile: #231d18;--ui-apc-hover: #26201a;--ui-apc-primary: #ebe3da;--ui-apc-primary-hover: #fffdfb;--ui-apc-primary-ink: #1e1914;--ui-apc-primary-kbd: rgba(11, 9, 8, 0.08);--ui-apc-primary-kbd-ink: rgba(30, 25, 20, 0.6);--ui-apc-kbd: rgba(255, 253, 251, 0.07);--ui-apc-box: rgba(255, 253, 251, 0.2);--ui-apc-box-hover: rgba(255, 253, 251, 0.32);--ui-apc-ring: rgba(255, 253, 251, 0.4);--ui-apc-timer-low: #e8b05c;--ui-apc-low-bg: rgba(255, 253, 251, 0.07);--ui-apc-low-ink: #958678;--ui-apc-med-bg: rgba(232, 176, 92, 0.12);--ui-apc-med-ink: #e8b05c;--ui-apc-high-bg: rgba(226, 84, 74, 0.12);--ui-apc-high-ink: #e2544a;--ui-apc-ok-bg: rgba(79, 157, 110, 0.13);--ui-apc-ok-ink: #4f9d6e;--ui-apc-no-bg: rgba(255, 253, 251, 0.07);--ui-apc-no-ink: #958678}

`;
