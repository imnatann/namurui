import { useState } from "react";
import { AgentBudget, type BudgetPart } from "../agent-budget";

const LIMIT = 240_000;

/* Five turns of a support triage run: what each window had cost by the end of the turn, how
 * long the run has left, and the rate it was burning at. The first turn has no rate yet, so
 * the meter has nothing to project from. */
type Turn = { input: number; output: number; cached: number; endsIn: number; rate?: number };

const TURNS: Turn[] = [
  { input: 38_400, output: 8_600, cached: 24_100, endsIn: 1_050 },
  { input: 61_200, output: 14_800, cached: 44_900, endsIn: 840, rate: 2_140 },
  { input: 94_700, output: 21_300, cached: 63_800, endsIn: 620, rate: 3_060 },
  { input: 118_400, output: 24_600, cached: 82_300, endsIn: 430, rate: 3_940 },
  { input: 152_800, output: 31_400, cached: 104_900, endsIn: 300, rate: 4_180 },
];

const NOTES = [
  "The first turn is still landing, so there is no rate to project from yet.",
  "Two turns in the run is reading comfortably under its ceiling.",
  "Thread 3 dragged a long mail chain into the window and the spend jumped.",
  "The rate climbed. Halve it and watch the projection decide the other way.",
  "The run is past its ceiling, so the overflowed part of the bar breathes.",
];

const control = {
  height: 28,
  padding: "0 10px",
  border: 0,
  borderRadius: 8,
  background: "transparent",
  boxShadow: "inset 0 0 0 1px var(--border, #e8e0d7)",
  color: "var(--text-muted, #6f625a)",
  font: "inherit",
  fontSize: 12,
  cursor: "pointer",
};

export default function Demo() {
  const [step, setStep] = useState(0);
  const [rateScale, setRateScale] = useState(1);
  const turn = TURNS[step];
  const lastTurn = step === TURNS.length - 1;
  const slow = rateScale <= 0.125;
  const rate = turn.rate === undefined ? undefined : Math.round(turn.rate * rateScale);

  const segments: BudgetPart[] = [
    { kind: "input", tokens: turn.input },
    { kind: "output", tokens: turn.output },
    { kind: "cached", tokens: turn.cached },
  ];

  return (
    <div
      style={{
        display: "grid",
        gap: 14,
        width: "100%",
        maxWidth: 460,
        margin: "0 auto",
        padding: "24px 0 32px",
      }}
    >
      <AgentBudget
        title="Inbox triage"
        limit={LIMIT}
        segments={segments}
        rate={rate}
        endsInSeconds={turn.endsIn}
      />

      <p style={{ margin: 0, fontSize: 12, lineHeight: "18px", color: "var(--text-muted, #6f625a)" }}>
        Turn {step + 1} of {TURNS.length}. {NOTES[step]}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          disabled={lastTurn}
          onClick={() => {
            setStep((current) => Math.min(current + 1, TURNS.length - 1));
            setRateScale(1);
          }}
          style={lastTurn ? { ...control, opacity: 0.45, cursor: "default" } : control}
        >
          Run another turn
        </button>
        <button
          type="button"
          disabled={rate === undefined || slow}
          onClick={() => setRateScale((scale) => scale / 2)}
          style={rate === undefined || slow ? { ...control, opacity: 0.45, cursor: "default" } : control}
        >
          Halve the rate
        </button>
        <button
          type="button"
          onClick={() => {
            setStep(0);
            setRateScale(1);
          }}
          style={control}
        >
          Restart the run
        </button>
      </div>
    </div>
  );
}