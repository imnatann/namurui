import { GlassFolder } from "../glass-folder";

export default function Demo() {
  return (
    <div className="d-gfd">
      <style href="ui-demo-glass-folder" precedence="default">
        {css}
      </style>

      <figure className="d-gfd__fig">
        <div className="d-gfd__card">
          <GlassFolder />
        </div>
        <figcaption className="d-gfd__cap">
          <span className="d-gfd__title">Everything filed in one pocket</span>
          <span className="d-gfd__desc">
            Three documents sit behind frosted glass — the pocket lifts and the sheets fan out when you reach for them.
          </span>
        </figcaption>
      </figure>

      <p className="d-gfd__hint">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M9 18.5V5.5M5 9l4-4 4 4M15 5.5v13M11 15l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Hover the folder — the pocket tips open and the documents shift
      </p>
    </div>
  );
}

const css = /* css */ `
.d-gfd {
  display: grid;
  gap: 16px;
  justify-items: center;
  width: 100%;
  font-family: var(--font-sans, "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  color: var(--text, #171717);
  -webkit-font-smoothing: antialiased;
}
.d-gfd__fig { display: grid; gap: 12px; justify-items: center; width: 100%; margin: 0; }
.d-gfd__card {
  position: relative;
  width: min(100%, 560px);
  overflow: hidden;
  border-radius: 20px;
  background: var(--preview, #f7f9fb);
  box-shadow: inset 0 0 0 1px var(--border, rgba(0, 0, 0, 0.08)), 0 1px 2px rgba(0, 0, 0, 0.04), 0 24px 48px -34px rgba(0, 0, 0, 0.35);
}
.d-gfd__cap { display: grid; gap: 4px; max-width: 400px; text-align: center; }
.d-gfd__title { font-size: 13.5px; font-weight: 600; letter-spacing: -0.01em; }
.d-gfd__desc { font-size: 12.5px; line-height: 1.45; color: var(--text-muted, #737373); }
.d-gfd__hint {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-muted, #737373);
}
`;
