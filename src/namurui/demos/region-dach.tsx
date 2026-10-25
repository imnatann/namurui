import { useState } from "react";
import { RegionDach, type Region } from "../region-dach";

const REGIONS: { value: Region; label: string; blurb: string }[] = [
  { value: "dach", label: "DACH", blurb: "Germany, Austria and Switzerland" },
  { value: "us", label: "US", blurb: "The United States" },
  { value: "cn", label: "China", blurb: "China" },
  { value: "in", label: "India", blurb: "India" },
  { value: "br", label: "Brazil", blurb: "Brazil" },
  { value: "jp", label: "Japan", blurb: "Japan" },
];

export default function Demo() {
  const [region, setRegion] = useState<Region>("dach");
  const current = REGIONS.find((r) => r.value === region) ?? REGIONS[0];

  return (
    <div className="d-rd">
      <style href="ui-demo-region-dach" precedence="default">
        {css}
      </style>

      <figure className="d-rd__fig">
        <div className="d-rd__card">
          <RegionDach region={region} onRegionChange={setRegion} />
        </div>
        <figcaption className="d-rd__cap">
          <span className="d-rd__title">Where the team operates</span>
          <span className="d-rd__desc" role="status" aria-live="polite">
            {current.blurb}
          </span>
        </figcaption>
      </figure>

      <div className="d-rd__seg" role="group" aria-label="Region">
        {REGIONS.map((r) => (
          <button key={r.value} type="button" className="d-rd__pill" aria-pressed={r.value === region} onClick={() => setRegion(r.value)}>
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const css = /* css */ `
.d-rd {
  display: grid;
  gap: 18px;
  justify-items: center;
  width: 100%;
  font-family: var(--font-sans, "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  color: var(--text, #171717);
  -webkit-font-smoothing: antialiased;
}
.d-rd__fig { display: grid; gap: 12px; justify-items: center; width: 100%; margin: 0; }
.d-rd__card {
  position: relative;
  width: min(100%, 440px);
  overflow: hidden;
  border-radius: 20px;
  background: var(--preview, #fafafa);
  box-shadow: inset 0 0 0 1px var(--border, rgba(0, 0, 0, 0.08)), 0 1px 2px rgba(0, 0, 0, 0.04), 0 24px 48px -34px rgba(0, 0, 0, 0.35);
}
.d-rd__cap { display: grid; gap: 4px; max-width: 390px; text-align: center; }
.d-rd__title { font-size: 13.5px; font-weight: 600; letter-spacing: -0.01em; }
.d-rd__desc { font-size: 12.5px; line-height: 1.45; color: var(--text-muted, #737373); }
.d-rd__seg {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2px;
  padding: 3px;
  border-radius: 999px;
  background: var(--muted-bg, rgba(0, 0, 0, 0.04));
  box-shadow: inset 0 0 0 1px var(--border-soft, rgba(0, 0, 0, 0.06));
}
.d-rd__pill {
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
.d-rd__pill:hover { background: var(--hover-bg, rgba(0, 0, 0, 0.05)); color: var(--text, #171717); }
.d-rd__pill[aria-pressed="true"] { background: var(--primary, #171717); color: var(--primary-fg, #ffffff); }
.d-rd__pill:focus-visible { outline: 2px solid var(--text, #171717); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .d-rd__pill { transition: none; } }
`;
