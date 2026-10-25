import { useState, type CSSProperties } from "react";
import { LayerStack, type LayerStackItem } from "../layer-stack";

const items: LayerStackItem[] = [
  { title: "Triggered by events", hint: "Webhooks", icon: "bolt" },
  { title: "Grounded in your data", hint: "Context", icon: "database" },
  { title: "Connected to your apps", hint: "APIs", icon: "plug" },
  { title: "Works with any model", hint: "Routing", icon: "spark" },
  { title: "Traced at every step", hint: "Logs", icon: "pulse" },
];

export default function Demo() {
  const [picked, setPicked] = useState<number | null>(null);

  return (
    <div style={{ display: "grid", gap: 12, width: "min(100%, 640px)" }}>
      <LayerStack items={items} interval={2400} onChange={(i) => setPicked(i)} />
      <p role="status" aria-live="polite" style={status}>
        {picked === null
          ? "Auto-playing — hover to pause, or pick a layer to take over."
          : `You picked layer ${picked + 1}: ${items[picked].title}.`}
      </p>
    </div>
  );
}

const status: CSSProperties = {
  margin: 0,
  textAlign: "center",
  fontSize: 13,
  letterSpacing: "-0.01em",
  opacity: 0.62,
};
