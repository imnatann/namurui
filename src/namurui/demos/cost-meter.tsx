import { useEffect, useState, type CSSProperties } from "react";
import { CostMeter, type CostMeterModel, type CostMeterPoint } from "../cost-meter";

/* Five-minute intervals, so the last one is the interval still running */
const WINDOW_SECONDS = 300;

/** Ten intervals ending at 15:50; the costs add up to the same 5.54 the models do */
const COSTS = [0.22, 0.31, 0.18, 0.44, 0.39, 0.52, 0.61, 0.48, 0.87, 1.52];
const SEED_SERIES: CostMeterPoint[] = COSTS.map((cost, index) => {
  const at = `15:${String(5 + index * 5).padStart(2, "0")}`;
  return { id: at, label: at, cost };
});

const SEED_MODELS: CostMeterModel[] = [
  { id: "sonnet", name: "claude-sonnet-4-5", tokens: 2_140_000, cost: 4.28 },
  { id: "mini", name: "gpt-5-mini", tokens: 1_320_000, cost: 0.94 },
  { id: "haiku", name: "claude-haiku-4-5", tokens: 486_000, cost: 0.32 },
];

/** The calls the agent makes, in the order the button replays them */
const CALLS = [
  { id: "sonnet", name: "claude-sonnet-4-5", tokens: 18_400, cost: 0.26 },
  { id: "mini", name: "gpt-5-mini", tokens: 41_200, cost: 0.07 },
  { id: "sonnet", name: "claude-sonnet-4-5", tokens: 9_600, cost: 0.11 },
  { id: "haiku", name: "claude-haiku-4-5", tokens: 22_800, cost: 0.04 },
];

/** Money is read in cents, so the figure and the breakdown never drift apart */
const toCents = (value: number) => Math.round(value * 100) / 100;

const base: CSSProperties = {
  height: 34,
  padding: "0 14px",
  borderRadius: 10,
  background: "transparent",
  boxShadow: "inset 0 0 0 1px var(--border, #33291f)",
  color: "var(--text, #f4ece4)",
  font: "inherit",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};

export default function Demo() {
  const [series, setSeries] = useState(SEED_SERIES);
  const [models, setModels] = useState(SEED_MODELS);
  const [elapsed, setElapsed] = useState(4512);
  const [step, setStep] = useState(0);

  // The clock is the only thing on a timer, and it never touches the rendered geometry
  useEffect(() => {
    const id = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const total = toCents(models.reduce((sum, model) => sum + model.cost, 0));
  const tokens = models.reduce((sum, model) => sum + model.tokens, 0);

  const record = () => {
    const call = CALLS[step % CALLS.length];
    setStep(step + 1);
    setModels((list) =>
      list.some((model) => model.id === call.id)
        ? list.map((model) =>
            model.id === call.id
              ? {
                  ...model,
                  tokens: model.tokens + call.tokens,
                  cost: toCents(model.cost + call.cost),
                }
              : model,
          )
        : [...list, { id: call.id, name: call.name, tokens: call.tokens, cost: call.cost }],
    );
    setSeries((list) => {
      if (list.length === 0) return [{ id: "now", label: "now", cost: call.cost }];
      const last = list[list.length - 1];
      return [...list.slice(0, -1), { ...last, cost: toCents(last.cost + call.cost) }];
    });
  };

  const restart = () => {
    setModels([]);
    setSeries([]);
    setElapsed(0);
    setStep(0);
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <CostMeter
        title="Session spend"
        total={total}
        tokens={tokens}
        elapsedSeconds={elapsed}
        series={series}
        models={models}
        intervalSeconds={WINDOW_SECONDS}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          style={{
            ...base,
            background: "var(--primary, #f4ece4)",
            color: "var(--primary-fg, #14100d)",
            boxShadow: "none",
            fontWeight: 600,
          }}
          onClick={record}
        >
          Record a tool call
        </button>
        <button type="button" style={base} onClick={restart}>
          Start a new session
        </button>
      </div>
    </div>
  );
}