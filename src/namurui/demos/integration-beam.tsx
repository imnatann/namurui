import { useState } from "react";
import { IntegrationBeam, type BeamTool } from "../integration-beam";

/** A compact monogram tile, so the demo carries its own logos */
function Monogram({ label, bg }: { label: string; bg: string }) {
  const text = label.slice(0, 2);
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1" y="1" width="22" height="22" rx="6.5" fill={bg} />
      <text
        x="12"
        y="15.2"
        textAnchor="middle"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontSize={text.length > 1 ? 8.6 : 11}
        fontWeight="600"
        letterSpacing="0.02em"
        fill="#ffffff"
      >
        {text}
      </text>
    </svg>
  );
}

type Preset = { id: string; label: string; left: BeamTool[]; right: BeamTool[] };

const PRESETS: Preset[] = [
  {
    id: "sales",
    label: "Sales stack",
    left: [
      { name: "Stripe", logo: <Monogram label="St" bg="#635bff" /> },
      { name: "LinkedIn", logo: <Monogram label="in" bg="#0a66c2" /> },
      { name: "Typeform", logo: <Monogram label="Ty" bg="#262627" /> },
    ],
    right: [
      { name: "HubSpot", logo: <Monogram label="Hu" bg="#ff7a59" /> },
      { name: "Slack", logo: <Monogram label="Sl" bg="#611f69" /> },
      { name: "Notion", logo: <Monogram label="No" bg="#1f1f1f" /> },
    ],
  },
  {
    id: "support",
    label: "Support stack",
    left: [
      { name: "Zendesk", logo: <Monogram label="Ze" bg="#03363d" /> },
      { name: "Intercom", logo: <Monogram label="Ic" bg="#1f8ded" /> },
      { name: "Front", logo: <Monogram label="Fr" bg="#001b38" /> },
    ],
    right: [
      { name: "Linear", logo: <Monogram label="Li" bg="#5e6ad2" /> },
      { name: "Jira", logo: <Monogram label="Ji" bg="#0052cc" /> },
      { name: "Notion", logo: <Monogram label="No" bg="#1f1f1f" /> },
    ],
  },
];

export default function Demo() {
  const [id, setId] = useState(PRESETS[0].id);
  const preset = PRESETS.find((p) => p.id === id) ?? PRESETS[0];

  return (
    <div className="d-ib">
      <style href="ui-demo-integration-beam" precedence="default">
        {css}
      </style>

      <figure className="d-ib__fig">
        <div className="d-ib__card">
          <IntegrationBeam left={preset.left} right={preset.right} center={{ name: "Acme" }} />
        </div>
        <figcaption className="d-ib__cap">
          <span className="d-ib__title">Every tool, one flow</span>
          <span className="d-ib__desc">Click a tool to pause its beam; hover to see which one it is.</span>
        </figcaption>
      </figure>

      <div className="d-ib__seg" role="group" aria-label="Integration set">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" className="d-ib__pill" aria-pressed={p.id === id} onClick={() => setId(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const css = /* css */ `
.d-ib {
  display: grid; gap: 18px; justify-items: center; width: 100%;
  font-family: var(--font-sans, "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  color: var(--text, #171717);
  -webkit-font-smoothing: antialiased;
}
.d-ib__fig { display: grid; gap: 12px; justify-items: center; width: 100%; margin: 0; }
.d-ib__card {
  position: relative; width: min(100%, 520px); padding: 16px 18px; overflow: hidden; border-radius: 20px;
  background: var(--preview, #fafafa);
  box-shadow: inset 0 0 0 1px var(--border, rgba(0, 0, 0, 0.08)), 0 1px 2px rgba(0, 0, 0, 0.04), 0 24px 48px -34px rgba(0, 0, 0, 0.35);
}
.d-ib__cap { display: grid; gap: 4px; max-width: 400px; text-align: center; }
.d-ib__title { font-size: 13.5px; font-weight: 600; letter-spacing: -0.01em; }
.d-ib__desc { font-size: 12.5px; line-height: 1.45; color: var(--text-muted, #737373); }
.d-ib__seg {
  display: inline-flex; gap: 2px; padding: 3px; border-radius: 999px;
  background: var(--muted-bg, rgba(0, 0, 0, 0.04));
  box-shadow: inset 0 0 0 1px var(--border-soft, rgba(0, 0, 0, 0.06));
}
.d-ib__pill {
  appearance: none; border: 0; margin: 0; padding: 7px 13px; border-radius: 999px;
  background: transparent; color: var(--text-muted, #737373);
  font: inherit; font-size: 12.5px; font-weight: 500; line-height: 1; cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease;
}
.d-ib__pill:hover { background: var(--hover-bg, rgba(0, 0, 0, 0.05)); color: var(--text, #171717); }
.d-ib__pill[aria-pressed="true"] { background: var(--primary, #171717); color: var(--primary-fg, #ffffff); }
.d-ib__pill:focus-visible { outline: 2px solid var(--text, #171717); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .d-ib__pill { transition: none; } }
`;
