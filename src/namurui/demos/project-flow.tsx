import { useState } from "react";
import { ProjectFlow } from "../project-flow";

export default function Demo() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [run, setRun] = useState(0);
  const dark = theme === "dark";

  return (
    <section className="d-pf" data-theme={theme}>
      <style href="ui-demo-project-flow" precedence="default">
        {css}
      </style>

      <div className="d-pf__board">
        {/* `key` remounts the scene so the cards build in and the hand drags again */}
        <ProjectFlow key={run} theme={theme} />
      </div>

      <div className="d-pf__bar">
        <p className="d-pf__cap">
          <span className="d-pf__name">Unify · Web design</span>
          <span className="d-pf__sub">
            One task splits into subtasks, client notes and two owning roles — the hand drops the subtask cards onto
            the board.
          </span>
        </p>

        <div className="d-pf__controls">
          <div className="d-pf__seg" role="group" aria-label="Card theme">
            {(["light", "dark"] as const).map((option) => (
              <button
                key={option}
                className="d-pf__btn"
                type="button"
                aria-pressed={theme === option}
                onClick={() => setTheme(option)}
              >
                {option === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
          <button className="d-pf__btn d-pf__btn--solid" type="button" onClick={() => setRun((n) => n + 1)}>
            Replay
          </button>
        </div>
      </div>

      <p className="d-pf__hint" role="status" aria-live="polite">
        {dark
          ? "Dark cards keep the same blue connectors — the sheet carries both themes."
          : run === 0
            ? "Watching the build-up: client, task, notes, then the two role cards."
            : `Replay ${run} — the hand drags the subtask cards in again.`}
      </p>
    </section>
  );
}

const css = /* css */ `
.d-pf {
  display: grid;
  gap: 14px;
  width: 100%;
  font-family: var(--font-sans, "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  color: var(--text, #0a0a0a);
  -webkit-font-smoothing: antialiased;
}
.d-pf[data-theme="dark"] { color: #f4f4f5; }

.d-pf__board {
  overflow: hidden;
  border-radius: 18px;
  /* the sheet fades the scene's edges to --ui-pf-fade, so the board takes the same value */
  background: #ffffff;
  box-shadow:
    inset 0 0 0 1px var(--border, #e5e5e5),
    0 1px 2px rgba(0, 0, 0, 0.04);
}
.d-pf[data-theme="dark"] .d-pf__board {
  background: #141414;
  box-shadow:
    inset 0 0 0 1px #232326,
    0 1px 2px rgba(0, 0, 0, 0.4);
}

.d-pf__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}
.d-pf__cap { display: grid; gap: 3px; margin: 0; min-width: 220px; }
.d-pf__name { font-size: 13.5px; font-weight: 600; letter-spacing: -0.01em; }
.d-pf__sub { font-size: 12.5px; line-height: 1.5; color: var(--text-muted, #737373); max-width: 46ch; }
.d-pf[data-theme="dark"] .d-pf__sub { color: #a1a1aa; }

.d-pf__controls { display: flex; align-items: center; gap: 8px; }
.d-pf__seg {
  display: flex;
  padding: 3px;
  border-radius: 999px;
  background: var(--muted-bg, rgba(0, 0, 0, 0.04));
}
.d-pf[data-theme="dark"] .d-pf__seg { background: rgba(255, 255, 255, 0.07); }

.d-pf__btn {
  appearance: none;
  border: 0;
  border-radius: 999px;
  padding: 5px 12px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12px;
  font-weight: 550;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: background-color 140ms ease, color 140ms ease, box-shadow 140ms ease;
}
.d-pf__btn:hover { background: var(--hover-bg, rgba(0, 0, 0, 0.05)); }
.d-pf__btn[aria-pressed="true"] {
  background: var(--card, #ffffff);
  box-shadow: 0 1px 3px rgba(20, 30, 60, 0.14);
}
.d-pf[data-theme="dark"] .d-pf__btn[aria-pressed="true"] { background: #26262a; box-shadow: none; }
.d-pf__btn--solid { padding: 6px 13px; background: var(--primary, #171717); color: var(--primary-fg, #fff); }
.d-pf__btn--solid:hover { background: #2a2a2a; }
.d-pf[data-theme="dark"] .d-pf__btn--solid { background: #f4f4f5; color: #111113; }
.d-pf[data-theme="dark"] .d-pf__btn--solid:hover { background: #ffffff; }
.d-pf__btn:focus-visible { outline: 2px solid var(--accent, #1d93d2); outline-offset: 2px; }

.d-pf__hint { margin: 0; font-size: 12px; line-height: 1.5; color: var(--text-muted, #737373); }
.d-pf[data-theme="dark"] .d-pf__hint { color: #a1a1aa; }
`;
