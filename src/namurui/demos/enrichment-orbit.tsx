import { EnrichmentOrbit } from "../enrichment-orbit";

export default function Demo() {
  return (
    <div className="d-eo">
      <style href="ui-demo-enrichment-orbit" precedence="default">
        {css}
      </style>

      <figure className="d-eo__fig">
        <div className="d-eo__card">
          <EnrichmentOrbit />
        </div>
        <figcaption className="d-eo__cap">
          <span className="d-eo__title">The record fills itself in</span>
          <span className="d-eo__desc">Comets run the two rings in opposite directions while data nodes orbit the tile.</span>
        </figcaption>
      </figure>
    </div>
  );
}

const css = /* css */ `
.d-eo {
  display: grid;
  gap: 18px;
  justify-items: center;
  width: 100%;
  font-family: var(--font-sans, "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  color: var(--text, #171717);
  -webkit-font-smoothing: antialiased;
}
.d-eo__fig { display: grid; gap: 12px; justify-items: center; width: 100%; margin: 0; }
.d-eo__card {
  position: relative;
  width: min(100%, 440px);
  overflow: hidden;
  border-radius: 20px;
  background: var(--preview, #fafafa);
  box-shadow: inset 0 0 0 1px var(--border, rgba(0, 0, 0, 0.08)), 0 1px 2px rgba(0, 0, 0, 0.04), 0 24px 48px -34px rgba(0, 0, 0, 0.35);
}
.d-eo__cap { display: grid; gap: 4px; max-width: 380px; text-align: center; }
.d-eo__title { font-size: 13.5px; font-weight: 600; letter-spacing: -0.01em; }
.d-eo__desc { font-size: 12.5px; line-height: 1.45; color: var(--text-muted, #737373); }
`;
