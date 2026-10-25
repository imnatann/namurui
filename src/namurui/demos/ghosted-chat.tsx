import { useState } from "react";
import { GhostedChat } from "../ghosted-chat";

export default function Demo() {
  const [run, setRun] = useState(0);

  return (
    <div className="d-gc">
      <style href="ui-demo-ghosted-chat" precedence="default">
        {css}
      </style>

      <figure className="d-gc__fig">
        <div className="d-gc__card">
          <GhostedChat key={run} />
        </div>
        <figcaption className="d-gc__cap">
          <span className="d-gc__title">Left on read, every time</span>
          <span className="d-gc__desc">Three messages arrive and get marked as read — hover the card for the reply.</span>
        </figcaption>
      </figure>

      <button type="button" className="d-gc__replay" onClick={() => setRun((n) => n + 1)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4.5 12a7.5 7.5 0 1 1 2.4 5.5" />
          <path d="M4.5 17v-5h5" />
        </svg>
        Replay
      </button>
    </div>
  );
}

const css = /* css */ `
.d-gc {
  display: grid;
  gap: 16px;
  justify-items: center;
  width: 100%;
  font-family: var(--font-sans, "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  color: var(--text, #171717);
  -webkit-font-smoothing: antialiased;
}
.d-gc__fig { display: grid; gap: 12px; justify-items: center; width: 100%; margin: 0; }
.d-gc__card {
  position: relative;
  width: min(100%, 460px);
  overflow: hidden;
  border-radius: 20px;
  background: var(--preview, #fafafa);
  box-shadow: inset 0 0 0 1px var(--border, rgba(0, 0, 0, 0.08)), 0 1px 2px rgba(0, 0, 0, 0.04), 0 24px 48px -34px rgba(0, 0, 0, 0.35);
}
.d-gc__cap { display: grid; gap: 4px; max-width: 380px; text-align: center; }
.d-gc__title { font-size: 13.5px; font-weight: 600; letter-spacing: -0.01em; }
.d-gc__desc { font-size: 12.5px; line-height: 1.45; color: var(--text-muted, #737373); }
.d-gc__replay {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  appearance: none;
  border: 0;
  margin: 0;
  padding: 7px 13px;
  border-radius: 999px;
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--border-soft, rgba(0, 0, 0, 0.08));
  color: var(--text-muted, #737373);
  font: inherit;
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease;
}
.d-gc__replay svg { width: 14px; height: 14px; }
.d-gc__replay:hover { background: var(--hover-bg, rgba(0, 0, 0, 0.05)); color: var(--text, #171717); }
.d-gc__replay:focus-visible { outline: 2px solid var(--text, #171717); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .d-gc__replay { transition: none; } }
`;
