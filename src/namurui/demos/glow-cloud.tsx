import { useState } from "react";
import { GlowCloud } from "../glow-cloud";

type Sky = "blue" | "orange";

export default function Demo() {
  const [color, setColor] = useState<Sky>("blue");
  const [background, setBackground] = useState(true);

  return (
    <div className="d-glc">
      <style href="ui-demo-glow-cloud" precedence="default">
        {css}
      </style>

      <figure className="d-glc__fig">
        <div className="d-glc__card">
          <GlowCloud color={color} background={background} />
        </div>
        <figcaption className="d-glc__cap">
          <span className="d-glc__title">A mascot that glows</span>
          <span className="d-glc__desc">It follows your pointer, blinks, and winks when you click it.</span>
        </figcaption>
      </figure>

      <div className="d-glc__controls">
        <div className="d-glc__seg" role="group" aria-label="Sky colour">
          <button type="button" className="d-glc__pill" aria-pressed={color === "blue"} onClick={() => setColor("blue")}>
            Blue
          </button>
          <button type="button" className="d-glc__pill" aria-pressed={color === "orange"} onClick={() => setColor("orange")}>
            Orange
          </button>
        </div>
        <div className="d-glc__seg" role="group" aria-label="Backdrop">
          <button type="button" className="d-glc__pill" aria-pressed={background} onClick={() => setBackground(true)}>
            Sky
          </button>
          <button type="button" className="d-glc__pill" aria-pressed={!background} onClick={() => setBackground(false)}>
            Bare
          </button>
        </div>
      </div>
    </div>
  );
}

const css = /* css */ `
.d-glc {
  display: grid;
  gap: 16px;
  justify-items: center;
  width: 100%;
  font-family: var(--font-sans, "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  color: var(--text, #171717);
  -webkit-font-smoothing: antialiased;
}
.d-glc__fig { display: grid; gap: 12px; justify-items: center; width: 100%; margin: 0; }
.d-glc__card {
  position: relative;
  width: min(100%, 400px);
  overflow: hidden;
  border-radius: 20px;
  background: var(--preview, #fafafa);
  box-shadow: inset 0 0 0 1px var(--border, rgba(0, 0, 0, 0.08)), 0 1px 2px rgba(0, 0, 0, 0.04), 0 24px 48px -34px rgba(0, 0, 0, 0.35);
}
.d-glc__cap { display: grid; gap: 4px; max-width: 360px; text-align: center; }
.d-glc__title { font-size: 13.5px; font-weight: 600; letter-spacing: -0.01em; }
.d-glc__desc { font-size: 12.5px; line-height: 1.45; color: var(--text-muted, #737373); }
.d-glc__controls { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.d-glc__seg {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: 999px;
  background: var(--muted-bg, rgba(0, 0, 0, 0.04));
  box-shadow: inset 0 0 0 1px var(--border-soft, rgba(0, 0, 0, 0.06));
}
.d-glc__pill {
  appearance: none;
  border: 0;
  margin: 0;
  padding: 7px 13px;
  border-radius: 999px;
  background: transparent;
  color: var(--text-muted, #737373);
  font: inherit;
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease;
}
.d-glc__pill:hover { background: var(--hover-bg, rgba(0, 0, 0, 0.05)); color: var(--text, #171717); }
.d-glc__pill[aria-pressed="true"] { background: var(--primary, #171717); color: var(--primary-fg, #ffffff); }
.d-glc__pill:focus-visible { outline: 2px solid var(--text, #171717); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .d-glc__pill { transition: none; } }
`;
