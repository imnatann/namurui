import { EmptyCalendar } from "../empty-calendar";

export default function Demo() {
  return (
    <div className="d-ec">
      <style href="ui-demo-empty-calendar" precedence="default">
        {css}
      </style>

      <figure className="d-ec__fig">
        <div className="d-ec__card">
          <EmptyCalendar />
        </div>
        <figcaption className="d-ec__cap">
          <span className="d-ec__title">Nothing on the calendar</span>
          <span className="d-ec__desc">Hover the stack — the front card lifts and the back ones slide further out.</span>
        </figcaption>
      </figure>
    </div>
  );
}

const css = /* css */ `
.d-ec {
  display: grid;
  gap: 18px;
  justify-items: center;
  width: 100%;
  font-family: var(--font-sans, "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  color: var(--text, #171717);
  -webkit-font-smoothing: antialiased;
}
.d-ec__fig { display: grid; gap: 12px; justify-items: center; width: 100%; margin: 0; }
.d-ec__card {
  position: relative;
  width: min(100%, 440px);
  overflow: hidden;
  border-radius: 20px;
  background: var(--preview, #fafafa);
  box-shadow: inset 0 0 0 1px var(--border, rgba(0, 0, 0, 0.08)), 0 1px 2px rgba(0, 0, 0, 0.04), 0 24px 48px -34px rgba(0, 0, 0, 0.35);
}
.d-ec__cap { display: grid; gap: 4px; max-width: 380px; text-align: center; }
.d-ec__title { font-size: 13.5px; font-weight: 600; letter-spacing: -0.01em; }
.d-ec__desc { font-size: 12.5px; line-height: 1.45; color: var(--text-muted, #737373); }
`;
