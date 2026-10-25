import { useState } from "react";
import type { CSSProperties } from "react";
import { ModelPicker, type PickerEffort, type PickerModel } from "../model-picker";

const MODELS: PickerModel[] = [
  { id: "opus", name: "Opus 5.5", description: "Hardest problems", speed: 2, quality: 5, cost: 5, latencyMs: 2100, pricePerM: 25 },
  { id: "sonnet", name: "Sonnet 5.5", description: "Everyday work", speed: 4, quality: 4, cost: 3, latencyMs: 900, pricePerM: 15 },
  { id: "haiku", name: "Haiku 5.5", description: "Quick and light", speed: 5, quality: 3, cost: 1, latencyMs: 400, pricePerM: 4 },
  { id: "auto", name: "Auto", description: "Picks per message" },
];

export default function Demo() {
  const [model, setModel] = useState("sonnet");
  const [thinking, setThinking] = useState(false);
  const [effort, setEffort] = useState<PickerEffort>("medium");
  const [search, setSearch] = useState(false);
  const [open, setOpen] = useState(true);

  const picked = MODELS.find((item) => item.id === model);

  return (
    <div style={stage}>
      {/* The card is positioned from the trigger, so the stage reserves the room it opens into */}
      <div style={{ ...docket, minHeight: open ? 378 : 0 }}>
        <ModelPicker
          models={MODELS}
          value={model}
          onChange={setModel}
          thinking={thinking}
          onThinkingChange={setThinking}
          effort={effort}
          onEffortChange={setEffort}
          webSearch={search}
          onWebSearchChange={setSearch}
          open={open}
          onOpenChange={setOpen}
          align="start"
          side="bottom"
        />
      </div>

      <p style={readout}>
        {picked?.name} · thinking {thinking ? `on (${effort})` : "off"} · web {search ? "on" : "off"}
      </p>
    </div>
  );
}

const stage: CSSProperties = {
  display: "grid",
  gap: 10,
  justifyItems: "center",
  width: "100%",
};

const docket: CSSProperties = {
  position: "relative",
  display: "grid",
  /* The trigger keeps its own width – the card is anchored to the root, and this box is only
   * wide enough that a 320px card opening from the trigger's left edge stays inside it. The demo
   * adds the card's height back while it is open, since it is positioned out of flow. */
  justifyItems: "start",
  width: "min(100%, 344px)",
};

const readout: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  opacity: 0.6,
};
