import { useEffect, useRef, useState } from "react";
import { StatusStrip, type StatusSlot } from "../status-strip";

/* The chrome row of a local OMP session as the bridge reports it: the model the run is on, the
 * branch it is editing, how much of the context window is spent, and the bridge address. A slot
 * clears by arriving with no text, which is what `setStatus` sends when a plugin drops one. */
const OPENING: StatusSlot[] = [
  { key: "model", text: "sonnet-4.5" },
  { key: "branch", text: "feat/stream-rpc" },
  { key: "context", text: "41% of 128k" },
  { key: "bridge", text: "127.0.0.1:4477" },
];

const BRANCHES = ["feat/stream-rpc", "fix/tool-timeout", "main"];

const FULL: StatusSlot[] = [
  ...OPENING,
  { key: "agent", text: "main" },
  { key: "sandbox", text: "seccomp · 512 MB" },
  { key: "tokens", text: "38.4k spent" },
  { key: "queue", text: "3 prompts waiting" },
];

const control = {
  height: 28,
  padding: "0 10px",
  border: 0,
  borderRadius: 8,
  background: "transparent",
  boxShadow: "inset 0 0 0 1px var(--border)",
  color: "var(--text-muted)",
  font: "inherit",
  fontSize: 12,
  cursor: "pointer",
};

export default function Demo() {
  const [slots, setSlots] = useState<StatusSlot[]>(OPENING);
  const [height, setHeight] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  /* The strip is measured rather than described, so clearing every slot shows its real height
   * dropping to zero instead of a promise that it does. */
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => setHeight(Math.round(el.getBoundingClientRect().height));
    read();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const branch = slots.find((slot) => slot.key === "branch")?.text ?? "";
  const nextBranch = BRANCHES[(BRANCHES.indexOf(branch) + 1) % BRANCHES.length];

  return (
    <div style={{ display: "grid", gap: 12, width: "100%", maxWidth: 560, margin: "0 auto", padding: "24px 0 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)" }}>
        <span>Session chrome</span>
        <span style={{ letterSpacing: 0, textTransform: "none", fontVariantNumeric: "tabular-nums" }}>
          {height} px tall
        </span>
      </div>

      <div ref={box} style={{ borderRadius: 12, outline: "1px dashed var(--border)", outlineOffset: 6 }}>
        <StatusStrip slots={slots} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          style={control}
          onClick={() =>
            setSlots((current) => current.map((slot) => (slot.key === "branch" ? { key: "branch", text: nextBranch } : slot)))
          }
        >
          Switch branch
        </button>
        <button
          type="button"
          style={control}
          disabled={slots.some((slot) => slot.key === "sandbox")}
          onClick={() => setSlots((current) => [...current, { key: "sandbox", text: "seccomp · 512 MB" }])}
        >
          Add sandbox slot
        </button>
        <button
          type="button"
          style={control}
          onClick={() =>
            setSlots((current) => current.map((slot) => (slot.key === "context" ? { key: "context", text: "" } : slot)))
          }
        >
          Clear context
        </button>
        <button type="button" style={control} onClick={() => setSlots(FULL)}>
          Fill past five
        </button>
        <button
          type="button"
          style={control}
          onClick={() => setSlots((current) => current.map((slot) => ({ key: slot.key, text: "" })))}
        >
          Clear every slot
        </button>
        <button type="button" style={control} onClick={() => setSlots(OPENING)}>
          Reset session
        </button>
      </div>

      <p style={{ margin: 0, fontSize: 12, lineHeight: "18px", color: "var(--text-muted)" }}>
        The key stays in muted small caps and the value in body ink. Clearing a slot fades its chip
        out; with every slot empty the row is zero pixels tall and holds nothing focusable. What a
        screen reader hears is one line per push — the number of slots that moved, not every value
        read again.
      </p>
    </div>
  );
}
