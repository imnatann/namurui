import { useState } from "react";
import { ProcessSteps, type ProcessStep } from "../process-steps";

/* The four steps the services page runs, in its own wording. The detail line is the promise
 * each step carries, so the demo exercises the optional slot as well. */
const STEPS: ProcessStep[] = [
  {
    id: "brief",
    title: "Ceritakan kebutuhan kamu",
    detail: "Satu sesi singkat, tanpa biaya di awal.",
  },
  {
    id: "design",
    title: "Kami rancang solusinya",
    detail: "Alur, konten dan sistemnya kami susun.",
  },
  {
    id: "review",
    title: "Kamu review",
    detail: "Satu putaran revisi sebelum naik.",
  },
  {
    id: "launch",
    title: "Launch & kami maintain",
    detail: "Hosting, monitoring dan perubahan kecil.",
  },
];

const chip = {
  height: 32,
  padding: "0 12px",
  border: 0,
  borderRadius: 8,
  background: "transparent",
  boxShadow: "inset 0 0 0 1px var(--border, #e8e0d7)",
  color: "var(--text-muted, #6f625a)",
  font: "inherit",
  fontSize: 12,
  cursor: "pointer",
};

const chipOn = {
  background: "var(--accent, #c2410c)",
  boxShadow: "inset 0 0 0 1px var(--accent, #c2410c)",
  color: "var(--accent-fg, #fffdfb)",
};

const caption = {
  margin: 0,
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "var(--text-muted, #6f625a)",
};

export default function Demo() {
  /* The host owns progress: the index lives here and goes in as a prop, which is also the
   * proof that the component keeps no state of its own. */
  const [current, setCurrent] = useState(1);

  return (
    <div
      style={{
        display: "grid",
        gap: 26,
        width: "100%",
        maxWidth: 1152,
        margin: "0 auto",
        padding: "28px 0 36px",
      }}
    >
      <div style={{ display: "grid", gap: 10 }}>
        <p style={caption}>Horizontal</p>
        <ProcessSteps steps={STEPS} current={current} />
      </div>

      <div style={{ display: "grid", gap: 10, width: "100%", maxWidth: 340 }}>
        <p style={caption}>Stacked</p>
        <ProcessSteps steps={STEPS} orientation="vertical" current={current} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <span style={caption}>Reached</span>
        {STEPS.map((step, index) => (
          <button
            key={step.id}
            type="button"
            aria-pressed={current === index}
            onClick={() => setCurrent(index)}
            style={current === index ? { ...chip, ...chipOn } : chip}
          >
            {index + 1}
          </button>
        ))}
        <button type="button" onClick={() => setCurrent(-1)} style={chip}>
          Not started
        </button>
      </div>

      <p style={{ margin: 0, fontSize: 12, lineHeight: "18px", color: "var(--text-muted, #6f625a)" }}>
        {current < 0
          ? "Nothing reached yet: every badge is outlined and the ink stays muted."
          : `Step ${current + 1} of ${STEPS.length} is the last one reached. Every badge up to it is filled; the rest stay outlined.`}{" "}
        Below 640px both layouts stack, so the rule never runs past the edge.
      </p>
    </div>
  );
}