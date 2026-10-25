"use client";

import { useState } from "react";

/*
 * Decision Inbox – open decisions with two quick actions each, in a gray tray with a white card, in a single self-contained file.
 * Answering a decision confirms it briefly, then folds it away and the count goes down.
 * The styles are injected below, so no extra files are needed.
 */

export type InboxDecision = {
  id: string;
  title: string;
  /** Short context under the title */
  detail?: string;
  /** Main answer, shown as the dark button */
  primary: string;
  /** Other answer, shown as the light button */
  secondary: string;
  /** Starts folded to one muted line – click to open */
  collapsed?: boolean;
};

export type DecisionInboxProps = {
  decisions: InboxDecision[];
  /** Called with the decision and the chosen answer */
  onDecide?: (decision: InboxDecision, answer: "primary" | "secondary") => void;
  className?: string;
};

type State = { open: boolean; answered?: string; gone?: boolean };

export function DecisionInbox({ decisions, onDecide, className }: DecisionInboxProps) {
  const [state, setState] = useState<Record<string, State>>(() =>
    Object.fromEntries(decisions.map((d) => [d.id, { open: !d.collapsed }])),
  );
  const patch = (id: string, next: Partial<State>) => setState((s) => ({ ...s, [id]: { ...s[id], ...next } }));

  const open = decisions.filter((d) => !state[d.id]?.answered).length;

  const decide = (d: InboxDecision, answer: "primary" | "secondary") => {
    patch(d.id, { answered: answer === "primary" ? d.primary : d.secondary });
    onDecide?.(d, answer);
    // Show the confirmation for a moment, then fold the row away and open the next folded one
    window.setTimeout(() => {
      setState((s) => {
        const next = { ...s, [d.id]: { ...s[d.id], gone: true } };
        const folded = decisions.find((x) => x.id !== d.id && !next[x.id]?.open && !next[x.id]?.answered);
        if (folded) next[folded.id] = { ...next[folded.id], open: true };
        return next;
      });
    }, 1100);
  };

  return (
    <>
      <style href="ui-decision-inbox" precedence="default">
        {css}
      </style>
      <section className={["ui-di", className].filter(Boolean).join(" ")} data-clear={open === 0 || undefined}>
        <header className="ui-di__head" aria-live="polite">
          {open > 0 ? (
            <>
              <AlertIcon />
              <span>
                {open} {open === 1 ? "needs" : "need"} your input
              </span>
            </>
          ) : (
            <>
              <DoneIcon />
              <span>All caught up</span>
            </>
          )}
        </header>

        <div className="ui-di__card">
          {decisions.map((d) => {
            const s = state[d.id] ?? { open: true };
            return (
              <div key={d.id} className="ui-di__row" data-gone={s.gone || undefined} inert={s.gone}>
                <div className="ui-di__row-inner">
                  <div className="ui-di__item" data-open={s.open || undefined} data-answered={s.answered ? true : undefined}>
                    {s.open ? (
                      <p className="ui-di__title">{d.title}</p>
                    ) : (
                      <button type="button" className="ui-di__title ui-di__title--folded" onClick={() => patch(d.id, { open: true })}>
                        {d.title}
                      </button>
                    )}
                    <div className="ui-di__body" data-open={s.open || undefined}>
                      <div className="ui-di__body-inner">
                        {d.detail && <p className="ui-di__detail">{d.detail}</p>}
                        <div className="ui-di__actions">
                          {s.answered ? (
                            <span className="ui-di__done" role="status">
                              <DoneIcon />
                              {s.answered}
                            </span>
                          ) : (
                            <>
                              <button type="button" className="ui-di__btn ui-di__btn--primary" onClick={() => decide(d, "primary")}>
                                {d.primary}
                              </button>
                              <button type="button" className="ui-di__btn" onClick={() => decide(d, "secondary")}>
                                {d.secondary}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <p className="ui-di__empty">Nothing waiting on you – new decisions show up here.</p>
        </div>
      </section>
    </>
  );
}

/* ---------- Icons ---------- */

const AlertIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M6.7 2.3a1.5 1.5 0 0 1 2.6 0l5.4 9.4A1.5 1.5 0 0 1 13.4 14H2.6a1.5 1.5 0 0 1-1.3-2.3Z" fill="currentColor" />
    <path d="M8 5.6v3.6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="8" cy="11.4" r="0.85" fill="#fff" />
  </svg>
);

const DoneIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <circle cx="8" cy="8" r="7" fill="currentColor" />
    <path d="m5 8.2 2 2 4-4.2" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ---------- Styles ---------- */

const css = /* css */ `
.ui-di {
  --ui-di-tray: #eee6de;
  --ui-di-card: #fffdfb;
  --ui-di-line: #eee6de;
  --ui-di-ink: #1c1713;
  --ui-di-text: #3d3226;
  --ui-di-muted: #857567;
  --ui-di-faint: #a5988d;
  --ui-di-alert: #ff6b35;
  --ui-di-ok: #1a7a4a;
  --ui-di-ease: cubic-bezier(0.22, 1, 0.36, 1);
  box-sizing: border-box;
  width: 100%;
  max-width: 440px;
  /* Like the Chat Composer: a gray tray with the heading, the white card sits on top of it */
  background: var(--ui-di-tray);
  /* The gray tray frames the white card on every side */
  padding: 6px;
  border-radius: 22px;
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: var(--ui-di-ink);
  -webkit-font-smoothing: antialiased;
}
.ui-di *, .ui-di *::before, .ui-di *::after { box-sizing: border-box; }
.ui-di button { margin: 0; font: inherit; cursor: pointer; }
.ui-di button:focus-visible { outline: 2px solid #ff6b35; outline-offset: 2px; }

.ui-di__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 18px 10px;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  color: var(--ui-di-alert);
  transition: color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-di[data-clear] .ui-di__head { color: var(--ui-di-ok); }

.ui-di__card {
  overflow: hidden;
  background: var(--ui-di-card);
  border: 1px solid #ded4ca;
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(11, 9, 8, 0.06);
}

/* Rows fold away with a height transition once answered */
.ui-di__row {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-di-ease), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-di__row[data-gone] { grid-template-rows: 0fr; opacity: 0; }
.ui-di__row-inner { min-height: 0; overflow: hidden; }
.ui-di__row + .ui-di__row .ui-di__item { border-top: 1px solid var(--ui-di-line); }
.ui-di__row[data-gone] + .ui-di__row .ui-di__item { border-top-color: transparent; }

.ui-di__item { padding: 16px 20px 14px; }
.ui-di__item:not([data-open]) { padding-bottom: 16px; }
.ui-di__title {
  display: block;
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-align: left;
  color: var(--ui-di-ink);
}
.ui-di__title--folded {
  color: var(--ui-di-faint);
  transition: color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-di__title--folded:hover { color: var(--ui-di-muted); }

.ui-di__body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-di-ease);
}
.ui-di__body[data-open] { grid-template-rows: 1fr; }
/* Room around the buttons so the clipping for the fold never cuts their ring and shadow */
.ui-di__body-inner {
  min-height: 0;
  overflow: hidden;
  margin: 0 -4px -4px;
  padding: 0 4px 4px;
}
.ui-di__detail {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ui-di-muted);
}
.ui-di__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  margin-top: 12px;
}

.ui-di__btn {
  height: 30px;
  padding: 0 12px;
  border: 0;
  border-radius: 9px;
  background: #fffdfb;
  box-shadow: 0 0 0 1px #ded4ca, 0 1px 2px rgba(11, 9, 8, 0.04);
  font-size: 13px !important;
  font-weight: 500;
  line-height: 20px;
  color: var(--ui-di-ink);
  transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-di__btn:hover { background: #f7f1eb; }
.ui-di__btn:active { transform: scale(0.98); }
.ui-di__btn--primary {
  background: linear-gradient(#342a20, #241e19);
  box-shadow: 0 0 0 1px #14100d, 0 2px 4px rgba(11, 9, 8, 0.1), inset 0 1px 0 rgba(255, 253, 251, 0.12);
  color: #fffdfb;
}
.ui-di__btn--primary:hover { background: linear-gradient(#3b3025, #28211a); }

.ui-di__done {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  color: var(--ui-di-ok);
  animation: ui-di-in var(--nm-dur-4, 380ms) var(--ui-di-ease);
}

.ui-di__empty {
  display: none;
  margin: 0;
  padding: 18px 20px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ui-di-muted);
}
.ui-di[data-clear] .ui-di__empty { display: block; animation: ui-di-in var(--nm-dur-4, 380ms) var(--ui-di-ease) 300ms both; }

@keyframes ui-di-in {
  from { opacity: 0; transform: translateY(3px); }
}

@media (prefers-reduced-motion: reduce) {
  .ui-di__row, .ui-di__body { transition: none; }
  .ui-di__done, .ui-di__empty { animation: none !important; }
}

/* Dark mode: follows a .dark class or data-theme="dark" on any ancestor, e.g. <html> */
:where(.dark, [data-theme="dark"]) .ui-di {
  --ui-di-tray: #1c1713;
  --ui-di-card: #27201a;
  --ui-di-line: rgba(255, 253, 251, 0.08);
  --ui-di-ink: #ebe3da;
  --ui-di-text: #b4a89d;
  --ui-di-muted: #857567;
  --ui-di-faint: #625244;
  --ui-di-alert: #ff6b35;
  --ui-di-ok: #2f8d5c;
}
:where(.dark, [data-theme="dark"]) .ui-di__card {
  border-color: rgba(255, 253, 251, 0.08);
  box-shadow: 0 1px 2px rgba(11, 9, 8, 0.4);
}
:where(.dark, [data-theme="dark"]) .ui-di__btn {
  background: #2b231b;
  box-shadow: 0 0 0 1px rgba(255, 253, 251, 0.1), 0 1px 2px rgba(11, 9, 8, 0.4);
}
:where(.dark, [data-theme="dark"]) .ui-di__btn:hover { background: #33291f; }
/* The dark primary button inverts, like on the site */
:where(.dark, [data-theme="dark"]) .ui-di__btn--primary {
  background: linear-gradient(#f4ece4, #dfd5cc);
  box-shadow: 0 0 0 1px rgba(11, 9, 8, 0.6), 0 2px 4px rgba(11, 9, 8, 0.3), inset 0 1px 0 #fffdfb;
  color: #191411;
}
:where(.dark, [data-theme="dark"]) .ui-di__btn--primary:hover { background: linear-gradient(#fffdfb, #ebe3db); }
`;
