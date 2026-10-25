import { useEffect, useState } from "react";
import { BlurCrossfade } from "../blur-crossfade";

type Status = "idle" | "publishing" | "published";

const NOTES = [
  {
    id: "headline",
    tab: "Headline",
    body: "Publishing is now a single request. The build you already reviewed goes out as it is — no rebuild, no new link to resend.",
  },
  {
    id: "detail",
    tab: "Detail",
    body: "Every publish writes a revision you can roll back to from the same panel. Revisions keep their comments attached, so a note left on the second draft still points at the second draft after the third one ships.",
  },
  {
    id: "fix",
    tab: "Fix",
    body: "Fixed a flicker when the preview reloaded while a comment was being typed.",
  },
];

export default function Demo() {
  const [status, setStatus] = useState<Status>("idle");
  const [note, setNote] = useState(0);

  // The button runs its own lifecycle so the label can settle on "Published" before going back
  useEffect(() => {
    if (status === "idle") return;
    const timer = window.setTimeout(
      () => setStatus((s) => (s === "publishing" ? "published" : "idle")),
      status === "publishing" ? 1100 : 1500,
    );
    return () => window.clearTimeout(timer);
  }, [status]);

  const label = status === "publishing" ? "Publishing…" : status === "published" ? "Published" : "Publish";

  return (
    <div className="bxd-demo">
      <style>{demoCss}</style>

      {/* The box is inline-block, so the button around it keeps its own padding and radius */}
      <div className="bxd-row">
        <button
          type="button"
          className="bxd-pill"
          aria-live="polite"
          aria-busy={status === "publishing"}
          onClick={() => setStatus(status === "idle" ? "publishing" : status)}
        >
          <BlurCrossfade as="span" id={status} morph="both" duration={380} blur={6}>
            <span className="bxd-btn">{label}</span>
          </BlurCrossfade>
        </button>
        <span className="bxd-caption">
          morph="both" · 380 ms · 6 px
        </span>
      </div>

      {/* Height glides between notes of different length, so nothing below the card moves */}
      <div className="bxd-card">
        <span className="bxd-eyebrow">What changed</span>
        <BlurCrossfade id={note} duration={440} blur={9}>
          <p className="bxd-note">{NOTES[note].body}</p>
        </BlurCrossfade>

        <div className="bxd-tabs">
          {NOTES.map((n, i) => (
            <button
              key={n.id}
              type="button"
              className="bxd-tab"
              aria-pressed={note === i}
              onClick={() => setNote(i)}
            >
              {n.tab}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const demoCss = `
.bxd-demo {
  display: grid;
  gap: 20px;
  width: 100%;
  max-width: 430px;
  font-family: var(--font-sans);
}

.bxd-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.bxd-pill {
  appearance: none;
  border: 0;
  padding: 0;
  border-radius: 8px;
  background: linear-gradient(180deg, #46464b, #222027);
  color: #fff;
  font: inherit;
  cursor: pointer;
  box-shadow: 0 1px 2px #14131a33, 0 8px 18px -14px #14131a99;
}
.bxd-pill:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.bxd-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 9px;
  border-radius: inherit;
  font-size: 12.5px;
  font-weight: 500;
  white-space: nowrap;
}

.bxd-caption {
  font-size: 12px;
  color: var(--text-muted);
}

.bxd-card {
  display: grid;
  gap: 12px;
  padding: 18px 18px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background: var(--card);
  box-shadow: var(--shadow-card);
}

.bxd-eyebrow {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.bxd-note {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--text);
}

.bxd-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.bxd-tab {
  appearance: none;
  border: 1px solid var(--border);
  padding: 5px 10px;
  border-radius: 999px;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: color 180ms var(--ease), border-color 180ms var(--ease);
}
.bxd-tab:hover {
  color: var(--text);
}
.bxd-tab[aria-pressed="true"] {
  border-color: var(--text);
  color: var(--text);
}
.bxd-tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
`;
