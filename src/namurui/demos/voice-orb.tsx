import { useEffect, useState } from "react";
import { VoiceOrb, type VoiceOrbState } from "../voice-orb";

type Beat = {
  state: VoiceOrbState;
  /** The line the assistant is working on, shown under the orb */
  line: string;
  /** How long the beat holds before the next one, in ms */
  hold: number;
};

const SCRIPT: Beat[] = [
  { state: "thinking", line: "Reading fourteen threads from this morning…", hold: 3600 },
  { state: "speaking", line: "Two of them need you. The rest can wait until after lunch.", hold: 3800 },
  { state: "idle", line: "Say “what else” and I'll keep digging.", hold: 2600 },
  { state: "listening", line: "Go ahead — I'm transcribing as you speak.", hold: 3400 },
];

/** The words the orb shows while it is busy; idle falls back to the component's own prompt */
const DEMO_LABELS: Record<Exclude<VoiceOrbState, "idle">, string> = {
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

export default function Demo() {
  const [beat, setBeat] = useState(0);
  const [level, setLevel] = useState(0.62);
  const [automatic, setAutomatic] = useState(true);
  const current = SCRIPT[beat];

  useEffect(() => {
    const timer = window.setTimeout(() => setBeat((index) => (index + 1) % SCRIPT.length), current.hold);
    return () => window.clearTimeout(timer);
  }, [current]);

  const state = current.state;

  return (
    <div style={{ display: "grid", gap: 22, justifyItems: "center", maxWidth: 380, fontFamily: "inherit" }}>
      <VoiceOrb
        state={state}
        size={220}
        level={automatic ? undefined : level}
        label={DEMO_LABELS}
        onPress={() => setBeat((index) => (SCRIPT[index].state === "listening" ? 2 : 3))}
      />

      <div style={{ display: "grid", gap: 6, justifyItems: "center", textAlign: "center", padding: "0 8px" }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: "21px", color: "#3a4150", minHeight: 21 }}>
          {current.line}
        </p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
          {SCRIPT.map((step, index) => (
            <button
              key={step.state}
              type="button"
              onClick={() => setBeat(index)}
              aria-pressed={index === beat}
              style={{
                appearance: "none",
                border: 0,
                borderRadius: 999,
                padding: "6px 11px",
                background: index === beat ? "#1b1d22" : "#f0f1f4",
                color: index === beat ? "#ffffff" : "#4b5260",
                font: "inherit",
                fontSize: 12,
                fontWeight: 550,
                cursor: "pointer",
              }}
            >
              {step.state}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gap: 6, width: "100%", fontSize: 12, color: "#5b6678" }}>
        <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span>{automatic ? "Microphone level — automatic" : `Microphone level — ${Math.round(level * 100)}%`}</span>
          <button
            type="button"
            onClick={() => setAutomatic((on) => !on)}
            style={{
              appearance: "none",
              border: 0,
              background: "none",
              padding: 0,
              color: "#2f6bff",
              font: "inherit",
              fontSize: 12,
              fontWeight: 560,
              cursor: "pointer",
            }}
          >
            {automatic ? "Set by hand" : "Follow the room"}
          </button>
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={level}
          disabled={automatic}
          onChange={(event) => setLevel(Number(event.target.value))}
          aria-label="Microphone level"
          style={{ width: "100%", accentColor: "#2f6bff", opacity: automatic ? 0.4 : 1 }}
        />
      </div>
    </div>
  );
}
