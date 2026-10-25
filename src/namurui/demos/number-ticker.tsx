import { useState, type CSSProperties, type ReactNode } from "react";
import { NumberTicker } from "../number-ticker";

type Snapshot = {
  period: string;
  revenue: number;
  signups: number;
  conversion: number;
  delta: string;
};

const snapshots: Snapshot[] = [
  { period: "Last 30 days", revenue: 48240, signups: 12480, conversion: 0.034, delta: "+8.2% vs. previous" },
  { period: "Last 7 days", revenue: 51680, signups: 13195, conversion: 0.038, delta: "+12.4% vs. previous" },
  { period: "Quarter to date", revenue: 47920, signups: 14062, conversion: 0.032, delta: "+3.1% vs. previous" },
];

export default function Demo() {
  const [step, setStep] = useState(0);
  const snapshot = snapshots[step];

  return (
    <section style={{ display: "grid", gap: 20, width: "min(100%, 860px)" }}>
      <style>{demoCss}</style>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <Stat label="Net revenue" period={snapshot.period} delta={snapshot.delta}>
          <NumberTicker
            value={snapshot.revenue}
            locale="en-US"
            format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }}
          />
        </Stat>
        <Stat label="New signups" period={snapshot.period} delta={snapshot.delta}>
          <NumberTicker value={snapshot.signups} locale="en-US" format={{ maximumFractionDigits: 0 }} />
        </Stat>
        <Stat label="Trial conversion" period={snapshot.period} delta={snapshot.delta}>
          <NumberTicker value={snapshot.conversion} locale="en-US" format={{ style: "percent", maximumFractionDigits: 1 }} />
        </Stat>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button type="button" className="dm-btn" onClick={() => setStep((s) => (s + 1) % snapshots.length)}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M4 12a8 8 0 1 1 2.6 5.9" strokeLinecap="round" />
            <path d="M4 17v-5h5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Refresh numbers
        </button>
        <span role="status" aria-live="polite" style={{ fontSize: 12, opacity: 0.6 }}>
          {snapshot.period} — snapshot {step + 1} of {snapshots.length}
        </span>
      </div>
    </section>
  );
}

function Stat({ label, period, delta, children }: { label: string; period: string; delta: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        padding: "16px 16px 14px",
        borderRadius: 14,
        background: "color-mix(in srgb, currentColor 4%, transparent)",
        boxShadow: "inset 0 0 0 1px color-mix(in srgb, currentColor 9%, transparent)",
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: "-0.005em", opacity: 0.62 }}>{label}</span>
      <span style={{ fontSize: "clamp(26px, 3.4vw, 34px)", fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
        {children}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, opacity: 0.6 }}>
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M5 16 12 9l7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {delta} · {period}
      </span>
    </div>
  );
}

const demoCss = /* css */ `
.dm-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 13px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  background: color-mix(in srgb, currentColor 4%, transparent);
  color: inherit;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: background-color 140ms ease, transform 140ms cubic-bezier(0.22, 1, 0.36, 1);
}
.dm-btn:hover { background: color-mix(in srgb, currentColor 9%, transparent); }
.dm-btn:active { transform: scale(0.97); }
.dm-btn:focus-visible { outline: 2px solid #6b8cff; outline-offset: 2px; }
`;
