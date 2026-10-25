import { OutreachBranches } from "../outreach-branches";

export default function Demo() {
  return (
    <div className="d-ob">
      <style href="ui-demo-outreach-branches" precedence="default">
        {css}
      </style>

      <figure className="d-ob__fig">
        <div className="d-ob__card">
          <OutreachBranches />
        </div>
        <figcaption className="d-ob__cap">
          <span className="d-ob__title">One release note, three audiences</span>
          <span className="d-ob__desc">
            The draft leaves the composer once. The pulse lands in the Gmail thread, then
            #launch, then the Notion changelog — six hundred milliseconds apart, then the
            loop starts over.
          </span>
        </figcaption>
      </figure>
    </div>
  );
}

const css = /* css */ `
.d-ob {
  display: grid;
  gap: 18px;
  justify-items: center;
  width: 100%;
  font-family: var(--font-sans, "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  color: var(--text, #171717);
  -webkit-font-smoothing: antialiased;
}
.d-ob__fig { display: grid; gap: 12px; justify-items: center; width: 100%; margin: 0; }
.d-ob__card {
  position: relative;
  width: min(100%, 480px);
  overflow: hidden;
  border-radius: 20px;
  background: var(--preview, #fafafa);
  box-shadow: inset 0 0 0 1px var(--border, rgba(0, 0, 0, 0.08)), 0 1px 2px rgba(0, 0, 0, 0.04), 0 24px 48px -34px rgba(0, 0, 0, 0.35);
}
.d-ob__cap { display: grid; gap: 4px; max-width: 400px; text-align: center; }
.d-ob__title { font-size: 13.5px; font-weight: 600; letter-spacing: -0.01em; }
.d-ob__desc { font-size: 12.5px; line-height: 1.5; color: var(--text-muted, #737373); }
`;
