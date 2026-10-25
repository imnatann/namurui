"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/*
 * Smart Recommendation – a suggestion card with a confidence signal, alternatives and one-click accept, in a single
 * self-contained file. Fold it away, pick an alternative instead, accept and undo.
 * The styles are injected below, so no extra files are needed.
 */

export type Recommendation = {
  id: string;
  /** Short name, used in the accept button, e.g. "Incremental sync" */
  label: string;
  /** One sentence why – shown in the card */
  reason: ReactNode;
  /** 0 = no signal, 1 = weak, 2 = good, 3 = strong */
  signal: 0 | 1 | 2 | 3;
};

export type SmartRecommendationProps = {
  title?: string;
  /** First entry is the recommendation, the rest are offered as alternatives */
  options: Recommendation[];
  onAccept?: (option: Recommendation) => void;
  onUndo?: (option: Recommendation) => void;
  defaultOpen?: boolean;
  className?: string;
};

const signalText = ["No signal", "Weak signal", "Good signal", "Strong signal"];

export function SmartRecommendation({
  title = "Smart recommendation",
  options,
  onAccept,
  onUndo,
  defaultOpen = true,
  className,
}: SmartRecommendationProps) {
  const [chosen, setChosen] = useState(options[0].id);
  const [accepted, setAccepted] = useState<string | null>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const away = (e: PointerEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const current = options.find((o) => o.id === chosen) ?? options[0];
  const isRecommended = current.id === options[0].id;
  const done = accepted === current.id;

  return (
    <>
      <style href="ui-smart-recommendation" precedence="default">
        {css}
      </style>
      <section className={["ui-sr", className].filter(Boolean).join(" ")} aria-label={title} data-accepted={done || undefined}>
        <div className="ui-sr__card">
          <button type="button" className="ui-sr__head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <SparkIcon />
            <span className="ui-sr__title">{title}</span>
            {!isRecommended && <span className="ui-sr__pill">Alternative</span>}
            <span className="ui-sr__chevron">
              <Icon d="m4.5 6.25 3.5 3.5 3.5-3.5" />
            </span>
          </button>
          <div className="ui-sr__body" data-open={open || undefined} inert={!open}>
            <p className="ui-sr__reason" key={current.id}>
              {current.reason}
            </p>
          </div>
        </div>

        <footer className="ui-sr__foot">
          <span className="ui-sr__signal" data-level={current.signal} title={signalText[current.signal]}>
            <span className="ui-sr__bars" aria-hidden="true">
              {[1, 2, 3].map((n) => (
                <span key={n} data-on={current.signal >= n || undefined} />
              ))}
            </span>
            {signalText[current.signal]}
          </span>

          <div className="ui-sr__actions">
            {options.length > 1 && !done && (
              <div className="ui-sr__alt" ref={menuRef}>
                <button
                  type="button"
                  className="ui-sr__btn"
                  aria-haspopup="menu"
                  aria-expanded={menu}
                  onClick={() => setMenu((m) => !m)}
                >
                  Alternatives
                </button>
                {menu && (
                  <div className="ui-sr__menu" role="menu">
                    {options.map((o, i) => (
                      <button
                        key={o.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={o.id === chosen}
                        className="ui-sr__option"
                        onClick={() => {
                          setChosen(o.id);
                          setMenu(false);
                          setOpen(true);
                        }}
                      >
                        <span className="ui-sr__option-label">
                          {o.label}
                          {i === 0 && <span className="ui-sr__tag">Recommended</span>}
                        </span>
                        <span className="ui-sr__mini" data-level={o.signal} aria-label={signalText[o.signal]}>
                          {[1, 2, 3].map((n) => (
                            <span key={n} data-on={o.signal >= n || undefined} />
                          ))}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {done ? (
              <>
                <span className="ui-sr__done" role="status">
                  <Icon d="m3.5 8.5 3 3 6-7" size={14} />
                  {current.label} accepted
                </span>
                <button
                  type="button"
                  className="ui-sr__btn"
                  onClick={() => {
                    setAccepted(null);
                    onUndo?.(current);
                  }}
                >
                  Undo
                </button>
              </>
            ) : (
              <button
                type="button"
                className="ui-sr__btn ui-sr__btn--primary"
                onClick={() => {
                  setAccepted(current.id);
                  setMenu(false);
                  onAccept?.(current);
                }}
              >
                Accept {current.label.toLowerCase()}
              </button>
            )}
          </div>
        </footer>
      </section>
    </>
  );
}

const SparkIcon = () => (
  <svg className="ui-sr__spark" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 3.5H4A1.5 1.5 0 0 0 2.5 5v7A1.5 1.5 0 0 0 4 13.5h7a1.5 1.5 0 0 0 1.5-1.5V8" />
    <path d="M12.5 1.5v4M10.5 3.5h4" />
  </svg>
);

const Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

/* ---------- Styles ---------- */

const css = /* css */ `
.ui-sr {
  --ui-sr-tray: #eee6de;
  --ui-sr-card: #fffdfb;
  --ui-sr-ink: #1c1713;
  --ui-sr-text: #3d3226;
  --ui-sr-muted: #857567;
  --ui-sr-accent: #ff6b35;
  --ui-sr-ok: #1a7a4a;
  --ui-sr-accent-text: #ff6b35;
  --ui-sr-border: #ded4ca;
  --ui-sr-shadow: 0 1px 2px rgba(11, 9, 8, 0.06);
  --ui-sr-head-hover: #f8f3ee;
  --ui-sr-pill: #f7f2ec;
  --ui-sr-pill-text: #ff8a5c;
  --ui-sr-bar: #c6bab0;
  --ui-sr-btn: #fffdfb;
  --ui-sr-btn-hover: #f7f1eb;
  --ui-sr-menu: #fffdfb;
  --ui-sr-option-hover: #f4ece5;
  --ui-sr-option-on: #faf7f4;
  --ui-sr-tag: #f6f0e9;
  --ui-sr-ease: cubic-bezier(0.22, 1, 0.36, 1);
  box-sizing: border-box;
  width: 100%;
  max-width: 440px;
  container-type: inline-size;
  /* Like the Chat Composer: the white card on a gray tray, the actions live in the tray below */
  background: var(--ui-sr-tray);
  /* The gray tray frames the white card on every side */
  padding: 6px;
  border-radius: 22px;
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: var(--ui-sr-ink);
  -webkit-font-smoothing: antialiased;
}
.ui-sr *, .ui-sr *::before, .ui-sr *::after { box-sizing: border-box; }
.ui-sr :where(button) { margin: 0; font: inherit; color: inherit; cursor: pointer; }
.ui-sr button:focus-visible { outline: 2px solid var(--ui-sr-accent); outline-offset: 2px; }

.ui-sr__card {
  padding: 6px 8px 8px;
  background: var(--ui-sr-card);
  border: 1px solid var(--ui-sr-border);
  border-radius: 16px;
  box-shadow: var(--ui-sr-shadow);
}
.ui-sr__head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 40px;
  padding: 0 10px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  text-align: left;
  transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-sr__head:hover { background: var(--ui-sr-head-hover); }
.ui-sr__spark { flex: none; color: var(--ui-sr-accent-text); }
.ui-sr__title { font-size: 15px; font-weight: 500; }
.ui-sr__pill {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--ui-sr-pill);
  font-size: 11.5px;
  font-weight: 500;
  color: var(--ui-sr-pill-text);
}
.ui-sr__chevron { display: grid; margin-left: auto; color: var(--ui-sr-muted); transition: transform var(--nm-dur-3, 240ms) var(--ui-sr-ease); }
.ui-sr__head[aria-expanded="false"] .ui-sr__chevron { transform: rotate(-90deg); }
.ui-sr__body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-sr-ease);
}
.ui-sr__body[data-open] { grid-template-rows: 1fr; }
.ui-sr__reason {
  min-height: 0;
  overflow: hidden;
  margin: 0;
  padding: 0 10px;
  font-size: 14px;
  line-height: 21px;
  color: var(--ui-sr-text);
  animation: ui-sr-swap var(--nm-dur-4, 380ms) var(--ui-sr-ease);
}
.ui-sr__body[data-open] .ui-sr__reason { padding-bottom: 8px; }
.ui-sr__reason strong { font-weight: 500; color: var(--ui-sr-ink); }

.ui-sr__foot {
  display: flex;
  align-items: center;
  /* Narrow containers: the actions move below the signal instead of running out of the tray */
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px 10px;
  min-height: 50px;
  padding: 8px 8px 8px 16px;
}
.ui-sr__signal {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  white-space: nowrap;
  color: var(--ui-sr-muted);
}
.ui-sr__bars, .ui-sr__mini { display: inline-flex; align-items: flex-end; gap: 2px; }
.ui-sr__bars span, .ui-sr__mini span {
  width: 3px;
  border-radius: 1px;
  background: var(--ui-sr-bar);
  transition: background-color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-sr__bars span:nth-child(1), .ui-sr__mini span:nth-child(1) { height: 6px; }
.ui-sr__bars span:nth-child(2), .ui-sr__mini span:nth-child(2) { height: 9px; }
.ui-sr__bars span:nth-child(3), .ui-sr__mini span:nth-child(3) { height: 12px; }
[data-level="1"] > span[data-on] { background: #d99530; }
[data-level="2"] > span[data-on] { background: var(--ui-sr-accent); }
[data-level="3"] > span[data-on] { background: var(--ui-sr-ok); }
.ui-sr__signal[data-level="0"] .ui-sr__bars span:first-child { background: #857567; }

.ui-sr__actions { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.ui-sr__btn {
  height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: 10px;
  background: var(--ui-sr-btn);
  box-shadow: 0 0 0 1px var(--ui-sr-border), 0 1px 2px rgba(11, 9, 8, 0.04);
  font-size: 13px !important;
  font-weight: 500;
  white-space: nowrap;
  transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-sr__btn:hover { background: var(--ui-sr-btn-hover); }
.ui-sr__btn:active { transform: scale(0.98); }
.ui-sr__btn--primary {
  background: linear-gradient(#342a20, #241e19);
  box-shadow: 0 0 0 1px #14100d, 0 2px 4px rgba(11, 9, 8, 0.1), inset 0 1px 0 rgba(255, 253, 251, 0.12);
  color: #fffdfb !important;
}
.ui-sr__btn--primary:hover { background: linear-gradient(#3b3025, #28211a); }
.ui-sr__done {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding-right: 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-sr-ok);
  animation: ui-sr-swap var(--nm-dur-3, 240ms) var(--ui-sr-ease);
}

.ui-sr__alt { position: relative; }
.ui-sr__menu {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  z-index: 5;
  display: grid;
  gap: 2px;
  width: 260px;
  padding: 4px;
  border-radius: 12px;
  background: var(--ui-sr-menu);
  box-shadow: 0 0 0 1px var(--ui-sr-border), 0 12px 30px -8px rgba(11, 9, 8, 0.2);
  animation: ui-sr-drop var(--nm-dur-2, 160ms) var(--ui-sr-ease);
}
/* Narrow: the actions sit on their own row – the menu lines up with its right edge so it stays inside */
@container (max-width: 420px) {
  .ui-sr__actions { position: relative; }
  .ui-sr__alt { position: static; }
  .ui-sr__menu { width: min(260px, 100cqw - 24px); }
}
.ui-sr__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 34px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  font-size: 13px !important;
  text-align: left;
}
.ui-sr__option:hover { background: var(--ui-sr-option-hover); }
.ui-sr__option[aria-checked="true"] { background: var(--ui-sr-option-on); }
.ui-sr__option-label { display: inline-flex; align-items: center; gap: 6px; }
.ui-sr__tag { padding: 0 6px; border-radius: 999px; background: var(--ui-sr-tag); font-size: 10.5px; font-weight: 500; line-height: 16px; color: var(--ui-sr-accent-text); }

@keyframes ui-sr-swap { from { opacity: 0; transform: translateY(2px); } }
@keyframes ui-sr-drop { from { opacity: 0; transform: translateY(4px) scale(0.98); } }
@media (prefers-reduced-motion: reduce) {
  .ui-sr__reason, .ui-sr__done, .ui-sr__menu { animation: none; }
  .ui-sr__body, .ui-sr__chevron { transition: none; }
}

/* Dark mode: follows a .dark class or data-theme="dark" on any ancestor, e.g. <html> */
:where(.dark, [data-theme="dark"]) .ui-sr {
  --ui-sr-tray: #1c1713;
  --ui-sr-card: #27201a;
  --ui-sr-ink: #ebe3da;
  --ui-sr-text: #b4a89d;
  --ui-sr-muted: #857567;
  --ui-sr-ok: #2f8d5c;
  --ui-sr-accent-text: #ff8a5c;
  --ui-sr-border: rgba(255, 253, 251, 0.08);
  --ui-sr-shadow: 0 1px 2px rgba(11, 9, 8, 0.4);
  --ui-sr-head-hover: rgba(255, 253, 251, 0.06);
  --ui-sr-pill: rgba(255, 138, 92, 0.18);
  --ui-sr-pill-text: #ff8a5c;
  --ui-sr-bar: rgba(255, 253, 251, 0.14);
  --ui-sr-btn: #2b231b;
  --ui-sr-btn-hover: #33291f;
  --ui-sr-menu: #2b231b;
  --ui-sr-option-hover: #33291f;
  --ui-sr-option-on: rgba(255, 107, 53, 0.16);
  --ui-sr-tag: rgba(255, 107, 53, 0.16);
}
:where(.dark, [data-theme="dark"]) .ui-sr__menu {
  box-shadow: 0 0 0 1px rgba(255, 253, 251, 0.1), 0 12px 30px -8px rgba(11, 9, 8, 0.5);
}
:where(.dark, [data-theme="dark"]) .ui-sr__btn--primary {
  background: linear-gradient(#f4ece4, #dfd5cc);
  box-shadow: 0 0 0 1px rgba(11, 9, 8, 0.6), 0 2px 4px rgba(11, 9, 8, 0.35), inset 0 1px 0 #fffdfb;
  color: #191411 !important;
}
:where(.dark, [data-theme="dark"]) .ui-sr__btn--primary:hover { background: linear-gradient(#fffdfb, #ebe3db); }
`;
