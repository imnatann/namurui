import { useEffect, useState } from "react";
import { CoverFlow, type CoverFlowItem } from "../cover-flow";

const RECORDS = [
  { id: "low-tide", title: "Low Tide", artist: "Mara Lind", year: "2024", no: "AU-014", from: "#0e7490", to: "#22d3ee", orb: "rgba(165, 243, 252, 0.65)" },
  { id: "night-drive", title: "Night Drive", artist: "Okto", year: "2023", no: "AU-021", from: "#312e81", to: "#7c3aed", orb: "rgba(196, 181, 253, 0.55)" },
  { id: "paper-moon", title: "Paper Moon", artist: "Ilse & June", year: "2024", no: "AU-027", from: "#9d174d", to: "#fb7185", orb: "rgba(255, 228, 230, 0.6)" },
  { id: "salt-flats", title: "Salt Flats", artist: "Vela", year: "2022", no: "AU-031", from: "#b45309", to: "#fbbf24", orb: "rgba(254, 243, 199, 0.65)" },
  { id: "afterglow", title: "Afterglow", artist: "Nils Rook", year: "2025", no: "AU-038", from: "#7f1d1d", to: "#f97316", orb: "rgba(254, 215, 170, 0.55)" },
  { id: "slow-coast", title: "Slow Coast", artist: "Hana Ito", year: "2023", no: "AU-042", from: "#065f46", to: "#34d399", orb: "rgba(167, 243, 208, 0.55)" },
];

function Art({ title, artist, year, no, from, to, orb }: (typeof RECORDS)[number]) {
  return (
    <div className="d-cf__art" style={{ background: `linear-gradient(155deg, ${from}, ${to})` }}>
      <span className="d-cf__orb" style={{ background: orb }} aria-hidden="true" />
      <span className="d-cf__no">{no}</span>
      <span className="d-cf__name">{title}</span>
      <span className="d-cf__artist">
        {artist} · {year}
      </span>
    </div>
  );
}

export default function Demo() {
  const [index, setIndex] = useState(0);
  const [reflection, setReflection] = useState(true);
  const [sound, setSound] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  // The row opens on the first cover, then springs to the middle one so the motion shows on mount
  useEffect(() => {
    const timer = window.setTimeout(() => setIndex(2), 520);
    return () => window.clearTimeout(timer);
  }, []);

  const items: CoverFlowItem[] = RECORDS.map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: `${r.artist} · ${r.year}`,
    cover: <Art {...r} />,
  }));

  return (
    <div className="d-cf">
      <style href="ui-demo-cover-flow" precedence="default">
        {css}
      </style>

      <div className="d-cf__card">
        <CoverFlow
          aria-label="Records"
          items={items}
          index={index}
          itemWidth={230}
          itemHeight={250}
          angle={52}
          reflection={reflection}
          sound={sound}
          onSelect={(item) => setPicked(item.title ?? "Untitled")}
        />
      </div>

      <p className="d-cf__status" role="status" aria-live="polite">
        {picked ? `Now playing “${picked}”` : "Drag, flick or scrub the row — click the front cover to play it"}
      </p>

      <div className="d-cf__controls">
        <div className="d-cf__seg" role="group" aria-label="Reflection">
          <button type="button" className="d-cf__pill" aria-pressed={reflection} onClick={() => setReflection(true)}>
            Reflection
          </button>
          <button type="button" className="d-cf__pill" aria-pressed={!reflection} onClick={() => setReflection(false)}>
            Flat
          </button>
        </div>
        <button type="button" className="d-cf__toggle" aria-pressed={sound} onClick={() => setSound((s) => !s)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9.5h3l4-3.5v12l-4-3.5H4z" />
            {sound ? <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="M15.5 9.5l4 5M19.5 9.5l-4 5" />}
          </svg>
          {sound ? "Sound on" : "Sound off"}
        </button>
      </div>
    </div>
  );
}

const css = /* css */ `
.d-cf {
  display: grid; gap: 14px; justify-items: center; width: 100%;
  font-family: var(--font-sans, "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  color: var(--text, #171717);
  -webkit-font-smoothing: antialiased;
}
.d-cf__card {
  width: min(100%, 500px); padding: 4px 0 10px; overflow: hidden; border-radius: 20px;
  background: var(--preview, #fafafa);
  box-shadow: inset 0 0 0 1px var(--border, rgba(0, 0, 0, 0.08)), 0 1px 2px rgba(0, 0, 0, 0.04), 0 24px 48px -34px rgba(0, 0, 0, 0.35);
}
.d-cf__status { margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--text-muted, #737373); text-align: center; }
.d-cf__controls { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.d-cf__seg {
  display: inline-flex; gap: 2px; padding: 3px; border-radius: 999px;
  background: var(--muted-bg, rgba(0, 0, 0, 0.04));
  box-shadow: inset 0 0 0 1px var(--border-soft, rgba(0, 0, 0, 0.06));
}
.d-cf__pill,
.d-cf__toggle {
  appearance: none; border: 0; margin: 0; padding: 7px 13px; border-radius: 999px;
  background: transparent; color: var(--text-muted, #737373);
  font: inherit; font-size: 12.5px; font-weight: 500; line-height: 1; cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease;
}
.d-cf__toggle { display: inline-flex; align-items: center; gap: 6px; box-shadow: inset 0 0 0 1px var(--border-soft, rgba(0, 0, 0, 0.06)); }
.d-cf__toggle svg { width: 14px; height: 14px; }
.d-cf__pill:hover,
.d-cf__toggle:hover { background: var(--hover-bg, rgba(0, 0, 0, 0.05)); color: var(--text, #171717); }
.d-cf__pill[aria-pressed="true"],
.d-cf__toggle[aria-pressed="true"] { background: var(--primary, #171717); color: var(--primary-fg, #ffffff); }
.d-cf__pill:focus-visible,
.d-cf__toggle:focus-visible { outline: 2px solid var(--text, #171717); outline-offset: 2px; }

/* Cover art */
/* The media layer bleeds 8% past the card on each side, so the art pads back inside */
.d-cf__art { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; gap: 1px; padding: 14px calc(7% + 14px); color: #ffffff; }
.d-cf__orb { position: absolute; top: 10%; right: 4%; width: 62%; aspect-ratio: 1; border-radius: 50%; filter: blur(7px); }
.d-cf__no { position: absolute; top: 12px; left: calc(7% + 14px); font-size: 9px; font-weight: 600; letter-spacing: 0.14em; opacity: 0.78; }
.d-cf__name { position: relative; font-size: 15px; font-weight: 600; letter-spacing: -0.02em; }
.d-cf__artist { position: relative; font-size: 10.5px; font-weight: 500; opacity: 0.82; }
@media (prefers-reduced-motion: reduce) {
  .d-cf__pill,
  .d-cf__toggle { transition: none; }
}
`;
