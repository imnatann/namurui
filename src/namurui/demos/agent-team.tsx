import { useState } from "react";
import { AgentTeam, type AgentTeamMember } from "../agent-team";

type Preset = {
  id: string;
  label: string;
  prompt: string;
  members: [AgentTeamMember, AgentTeamMember, AgentTeamMember];
};

/* A neutral silhouette portrait, so the demo needs no image files */
const portrait = (from: string, to: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="96" height="96" fill="url(#g)"/><circle cx="48" cy="37" r="15" fill="#fff" fill-opacity="0.9"/><path d="M16 96c0-17.7 14.3-32 32-32s32 14.3 32 32z" fill="#fff" fill-opacity="0.9"/></svg>`,
  )}`;

const PRESETS: Preset[] = [
  {
    id: "inbound",
    label: "Inbound",
    prompt: "Build a team to work my inbound pipeline",
    members: [
      { role: "Lead Researcher", avatar: portrait("#f0abfc", "#a855f7"), tools: ["linkedin", "hubspot"] },
      { role: "Inbound Qualifier", avatar: portrait("#fda4af", "#fb7185"), tools: ["hubspot", "slack"] },
      { role: "Outbound SDR", avatar: portrait("#93c5fd", "#3b82f6"), tools: ["gmail", "salesforce"] },
    ],
  },
  {
    id: "renewals",
    label: "Renewals",
    prompt: "Watch renewals and flag accounts going quiet",
    members: [
      { role: "Usage Analyst", avatar: portrait("#fcd34d", "#f59e0b"), tools: ["salesforce", "slack"] },
      { role: "Risk Scorer", avatar: portrait("#a7f3d0", "#10b981"), tools: ["hubspot"] },
      { role: "Renewal Owner", avatar: portrait("#c7d2fe", "#6366f1"), tools: ["gmail", "linkedin"] },
    ],
  },
  {
    id: "support",
    label: "Support",
    prompt: "Triage overnight tickets before standup",
    members: [
      { role: "Ticket Triager", avatar: portrait("#bae6fd", "#0ea5e9"), tools: ["slack", "gmail"] },
      { role: "Knowledge Scout", avatar: portrait("#fbcfe8", "#ec4899"), tools: ["hubspot", "slack"] },
      { role: "Escalation Lead", avatar: portrait("#ddd6fe", "#8b5cf6"), tools: ["gmail", "salesforce"] },
    ],
  },
];

export default function Demo() {
  const [id, setId] = useState(PRESETS[0].id);
  const preset = PRESETS.find((p) => p.id === id) ?? PRESETS[0];

  return (
    <div className="d-at">
      <style href="ui-demo-agent-team" precedence="default">
        {css}
      </style>

      <figure className="d-at__fig">
        <div className="d-at__card">
          <AgentTeam prompt={preset.prompt} members={preset.members} />
        </div>
        <figcaption className="d-at__cap">
          <span className="d-at__title">One brief, a whole team</span>
          <span className="d-at__desc">The prompt types itself, then three agents arrive with the tools each one works in.</span>
        </figcaption>
      </figure>

      <div className="d-at__seg" role="group" aria-label="Example brief">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" className="d-at__pill" aria-pressed={p.id === id} onClick={() => setId(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const css = /* css */ `
.d-at {
  display: grid; gap: 18px; justify-items: center; width: 100%;
  font-family: var(--font-sans, "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  color: var(--text, #171717);
  -webkit-font-smoothing: antialiased;
}
.d-at__fig { display: grid; gap: 12px; justify-items: center; width: 100%; margin: 0; }
.d-at__card {
  position: relative; width: min(100%, 460px); overflow: hidden; border-radius: 20px;
  background: var(--preview, #fafafa);
  box-shadow: inset 0 0 0 1px var(--border, rgba(0, 0, 0, 0.08)), 0 1px 2px rgba(0, 0, 0, 0.04), 0 24px 48px -34px rgba(0, 0, 0, 0.35);
}
.d-at__cap { display: grid; gap: 4px; max-width: 390px; text-align: center; }
.d-at__title { font-size: 13.5px; font-weight: 600; letter-spacing: -0.01em; }
.d-at__desc { font-size: 12.5px; line-height: 1.45; color: var(--text-muted, #737373); }
.d-at__seg {
  display: inline-flex; gap: 2px; padding: 3px; border-radius: 999px;
  background: var(--muted-bg, rgba(0, 0, 0, 0.04));
  box-shadow: inset 0 0 0 1px var(--border-soft, rgba(0, 0, 0, 0.06));
}
.d-at__pill {
  appearance: none; border: 0; margin: 0; padding: 7px 13px; border-radius: 999px;
  background: transparent; color: var(--text-muted, #737373);
  font: inherit; font-size: 12.5px; font-weight: 500; line-height: 1; cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease;
}
.d-at__pill:hover { background: var(--hover-bg, rgba(0, 0, 0, 0.05)); color: var(--text, #171717); }
.d-at__pill[aria-pressed="true"] { background: var(--primary, #171717); color: var(--primary-fg, #ffffff); }
.d-at__pill:focus-visible { outline: 2px solid var(--text, #171717); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .d-at__pill { transition: none; } }
`;
