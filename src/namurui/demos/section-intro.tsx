import { useState } from "react";
import { SectionIntro } from "../section-intro";

type Period = "monthly" | "yearly";

/* The slot under the lead is a real switch here: the two buttons change the sentence above them,
 * which is the shape the pricing block on a landing page needs. */
const LEAD: Record<Period, string> = {
  monthly:
    "From $29 a month per workspace, with WhatsApp, Instagram, Telegram and web chat on the same plan.",
  yearly:
    "From $290 a year per workspace, two months on the house and the same four channels included.",
};

export default function Demo() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [run, setRun] = useState(0);

  return (
    <div className="sci-demo">
      <style href="ui-demo-section-intro" precedence="default">
        {css}
      </style>

      <div className="sci-demo__bar">
        <span className="sci-demo__hint">Entry plays once per mount</span>
        <button type="button" className="sci-demo__replay" onClick={() => setRun((n) => n + 1)}>
          Replay
        </button>
      </div>

      {/* The key remounts the stack, so the entry can be watched again without a reload */}
      <div className="sci-demo__stage" key={run}>
        <SectionIntro
          eyebrow="Pricing"
          title="Pay for the conversations you answer"
          lead={LEAD[period]}
        >
          <div className="sci-demo__switch">
            <button
              type="button"
              className="sci-demo__pill"
              aria-pressed={period === "monthly"}
              onClick={() => setPeriod("monthly")}
            >
              Monthly
            </button>
            <button
              type="button"
              className="sci-demo__pill"
              aria-pressed={period === "yearly"}
              onClick={() => setPeriod("yearly")}
            >
              Yearly
            </button>
          </div>
        </SectionIntro>

        <div className="sci-demo__rule" aria-hidden="true" />

        <SectionIntro
          align="left"
          as="h3"
          eyebrow="How it works"
          title="Answers that cite the catalogue, not the model"
          lead="Every reply carries the product row it used, so a wrong answer is one click away from its source."
        />
      </div>
    </div>
  );
}

const css = /* css */ `
.sci-demo {
  display: grid;
  gap: 8px;
  width: 100%;
  color: var(--text, #1a1410);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.sci-demo *,
.sci-demo *::before,
.sci-demo *::after {
  box-sizing: border-box;
}
.sci-demo__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  max-width: 780px;
  margin-inline: auto;
  padding: 0 18px;
}
.sci-demo__hint {
  color: var(--text-muted, #6f625a);
  font-size: 11px;
  line-height: 1.4;
  letter-spacing: 0.01em;
}
.sci-demo__replay {
  flex: none;
  height: 26px;
  margin: 0;
  padding: 0 10px;
  border: 0;
  border-radius: 999px;
  background: var(--muted-bg, #7a4a1c0a);
  box-shadow: inset 0 0 0 1px var(--border, #e8e0d7);
  color: var(--text-muted, #6f625a);
  font: inherit;
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition:
    background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.sci-demo__replay:hover {
  background: var(--muted-bg, #7a4a1c0a);
  color: var(--text, #1a1410);
}
.sci-demo__replay:focus-visible {
  outline: 2px solid var(--accent, #c2410c);
  outline-offset: 2px;
}
.sci-demo__stage {
  display: grid;
  gap: 40px;
  width: 100%;
  max-width: 780px;
  margin-inline: auto;
  padding: 22px 18px 6px;
}
.sci-demo__rule {
  height: 1px;
  background: var(--border-soft, #1a14101a);
}
.sci-demo__switch {
  display: inline-flex;
  gap: 3px;
  padding: 3px;
  border-radius: 999px;
  background: var(--panel, #fffdfb);
  box-shadow: inset 0 0 0 1px var(--border, #e8e0d7);
}
.sci-demo__pill {
  height: 30px;
  margin: 0;
  padding: 0 13px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  box-shadow: none;
  color: var(--text-muted, #6f625a);
  font: inherit;
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition:
    background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.sci-demo__pill:hover {
  background: var(--hover-bg, #7a4a1c12);
  color: var(--text, #1a1410);
}
.sci-demo__pill[aria-pressed="true"] {
  background: var(--accent, #c2410c);
  box-shadow: inset 0 0 0 1px var(--accent, #c2410c);
  color: var(--accent-fg, #fffdfb);
}
.sci-demo__pill:focus-visible {
  outline: 2px solid var(--accent, #c2410c);
  outline-offset: 2px;
}

:where(.dark, [data-theme="dark"]) .sci-demo__pill[aria-pressed="true"] {
  color: var(--accent-fg, #1a0f08);
}

@media (prefers-reduced-motion: reduce) {
  .sci-demo__replay,
  .sci-demo__pill {
    transition-duration: 1ms;
  }
}
`;
