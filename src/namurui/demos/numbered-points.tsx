import { useState } from "react";
import { NumberedPoints, type NumberedPoint } from "../numbered-points";

/* The three promises the services page opens with, kept as the page writes them. */
const POINTS: NumberedPoint[] = [
  { text: "Mulai tanpa investasi besar." },
  { text: "Kami tidak hilang setelah launch." },
  { text: "Mulai kecil, berkembang nanti." },
];

const STARTS = [
  { value: 1, label: "Mulai 01" },
  { value: 4, label: "Mulai 04" },
];

export default function Demo() {
  const [start, setStart] = useState(1);
  const [run, setRun] = useState(0);

  return (
    <div className="npt-demo">
      <style href="ui-demo-numbered-points" precedence="default">
        {css}
      </style>

      <div className="npt-demo__bar">
        <p className="npt-demo__hint">
          Numbers follow start: three rows from 4 read 04, 05, 06
        </p>
        <div className="npt-demo__group" role="group" aria-label="First number">
          {STARTS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="npt-demo__chip"
              aria-pressed={start === option.value}
              onClick={() => setStart(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button type="button" className="npt-demo__chip" onClick={() => setRun((n) => n + 1)}>
          Replay
        </button>
      </div>

      {/* The key remounts the block, so the entry can be watched again and replays when the
       * numbering changes. */}
      <div className="npt-demo__stage" key={`${start}-${run}`}>
        <NumberedPoints
          title="Website yang tumbuh bersama bisnis kamu."
          lead="Kami membangun satu halaman dulu, mengukur apakah ia benar-benar dipakai, lalu menambah bagian berikutnya. Biaya di depan kecil, dan pekerjaan tidak berhenti di hari peluncuran."
          points={POINTS}
          start={start}
        />
      </div>
    </div>
  );
}

const css = /* css */ `
.npt-demo {
  display: grid;
  gap: 10px;
  width: 100%;
  color: var(--text, #1a1410);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.npt-demo *,
.npt-demo *::before,
.npt-demo *::after {
  box-sizing: border-box;
}
.npt-demo__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 0 2px;
}
.npt-demo__hint {
  flex: 1 1 12rem;
  min-width: 0;
  margin: 0;
  color: var(--text-muted, #6f625a);
  font-size: 11px;
  line-height: 1.4;
  letter-spacing: 0.01em;
}
.npt-demo__group {
  display: inline-flex;
  gap: 6px;
}
.npt-demo__chip {
  flex: none;
  height: 26px;
  margin: 0;
  padding: 0 10px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--border, #e8e0d7);
  color: var(--text-muted, #6f625a);
  font: inherit;
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition:
    background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.npt-demo__chip:hover {
  background: var(--muted-bg, #7a4a1c0a);
  color: var(--text, #1a1410);
}
.npt-demo__chip[aria-pressed="true"] {
  background: var(--accent, #c2410c);
  box-shadow: inset 0 0 0 1px var(--accent, #c2410c);
  color: var(--accent-fg, #fffdfb);
}
.npt-demo__chip:focus-visible {
  outline: 2px solid var(--accent, #c2410c);
  outline-offset: 2px;
}
.npt-demo__stage {
  width: 100%;
  max-width: 1000px;
  margin-inline: auto;
  padding: 30px 20px 12px;
}

:where(.dark, [data-theme="dark"]) .npt-demo__chip[aria-pressed="true"] {
  color: var(--accent-fg, #1a0f08);
}

@media (prefers-reduced-motion: reduce) {
  .npt-demo__chip {
    transition-duration: 1ms;
  }
}
`;
