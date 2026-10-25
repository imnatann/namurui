import { useState } from "react";

import { GlowKeyboard } from "../glow-keyboard";

/*
 * The scene as the site shows it: an empty composer and a glass keyboard, then a question
 * arrives one key at a time, goes out with the return key and the next one follows. The
 * prompt can be paused where it stands, or the whole run starts again from the first key.
 */
const PROMPTS = [
  "Find a hiker hut above Innsbruck",
  "Plan two quiet days around the lake",
  "Pack for a cold morning at altitude",
];

export default function Demo() {
  const [running, setRunning] = useState(true);
  const [round, setRound] = useState(0);

  return (
    <div className="d-gk">
      <style href="ui-demo-glow-keyboard" precedence="default">
        {css}
      </style>

      <figure className="d-gk__fig">
        <div className="d-gk__card">
          <GlowKeyboard key={round} prompts={PROMPTS} autoType={running} />
        </div>
        <figcaption className="d-gk__cap">
          <span className="d-gk__title">A question that types itself</span>
          <span className="d-gk__desc">
            Every key dips under the stroke and pushes a wave of colour up the floor — click the composer to take over.
          </span>
        </figcaption>
      </figure>

      <div className="d-gk__controls">
        <button type="button" className="d-gk__pill" onClick={() => setRunning((value) => !value)}>
          {running ? "Pause" : "Resume"}
        </button>
        <button type="button" className="d-gk__pill" onClick={() => setRound((value) => value + 1)}>
          Start again
        </button>
      </div>
    </div>
  );
}

const css = /* css */ `
.d-gk {
  display: grid;
  gap: 16px;
  justify-items: center;
  width: 100%;
  font-family: var(--font-sans, "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  color: var(--text, #171717);
  -webkit-font-smoothing: antialiased;
}
.d-gk__fig { display: grid; gap: 12px; justify-items: center; width: 100%; margin: 0; }
.d-gk__card {
  position: relative;
  width: min(100%, 860px);
  overflow: hidden;
  border-radius: 20px;
  background: var(--preview, #fafafa);
  box-shadow: inset 0 0 0 1px var(--border, rgba(0, 0, 0, 0.08)), 0 1px 2px rgba(0, 0, 0, 0.04), 0 24px 48px -34px rgba(0, 0, 0, 0.35);
}
.d-gk__cap { display: grid; gap: 4px; max-width: 420px; text-align: center; }
.d-gk__title { font-size: 13.5px; font-weight: 600; letter-spacing: -0.01em; }
.d-gk__desc { font-size: 12.5px; line-height: 1.45; color: var(--text-muted, #737373); }
.d-gk__controls { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.d-gk__pill {
  appearance: none;
  border: 0;
  padding: 7px 14px;
  border-radius: 999px;
  font: inherit;
  font-size: 12.5px;
  font-weight: 550;
  cursor: pointer;
  color: var(--text, #171717);
  background: var(--muted-bg, rgba(0, 0, 0, 0.04));
  box-shadow: inset 0 0 0 1px var(--border-soft, rgba(0, 0, 0, 0.06));
  transition: background-color 0.18s ease;
}
.d-gk__pill:hover { background: var(--hover-bg, rgba(0, 0, 0, 0.08)); }
`;
