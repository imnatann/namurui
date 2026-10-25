import { useEffect, useState, type CSSProperties } from "react";
import { VoiceSession, type LivePhase, type VoiceCaption } from "../voice-session";

const PHASES: LivePhase[] = ["connecting", "listening", "working", "speaking", "muted", "error"];

const NOTE: Record<LivePhase, string> = {
  connecting: "The bridge is opening the audio stream; no levels arrive yet.",
  listening: "The microphone is open, so input moves and output sits at the floor.",
  working: "The turn is with the model and both channels drop to the floor.",
  speaking: "The reply is read back and transcribed as it lands, word by word.",
  muted: "live_mute sent: the microphone is closed, the session stays open.",
  error: "live_end carried an error, so the session is over.",
};

const ASK = "Read the failing auth test and tell me what actually broke.";

const REPLY = [
  "The refresh token is written ",
  "before the retry, so a retry that fails ",
  "leaves the session holding a token ",
  "the server already rotated. ",
  "I moved the write after the retry settles ",
  "and the test goes green.",
];

const SILENT = { input: 0, output: 0 };

/* Demo input only: the client forwards live_levels from the bridge, at most once every
 * 100 ms. These numbers stand in for that payload — the component turns them into a
 * transform, so nothing here is drawn and no waveform is invented inside the component. */
const envelope = (step: number, rate: number, offset: number) =>
  0.16 + 0.58 * Math.abs(Math.sin(step * rate + offset) * Math.sin(step * 0.09 + 0.6));

const levelFor = (phase: LivePhase, step: number) => {
  if (phase === "listening") return { input: envelope(step, 0.27, 0.2), output: 0.02 };
  if (phase === "speaking") return { input: 0.03, output: envelope(step, 0.23, 1.4) };
  if (phase === "working") return { input: 0.04, output: 0.02 };
  return SILENT;
};

const chip: CSSProperties = {
  height: 26,
  padding: "0 9px",
  border: 0,
  borderRadius: 8,
  background: "transparent",
  boxShadow: "inset 0 0 0 1px var(--border, #e8e0d7)",
  color: "var(--text-muted, #6f625a)",
  font: "inherit",
  fontSize: 11.5,
  textTransform: "capitalize",
  cursor: "pointer",
};

export default function Demo() {
  const [phase, setPhase] = useState<LivePhase>("listening");
  const [levels, setLevels] = useState(SILENT);
  const [tick, setTick] = useState(0);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    if (ended || phase === "connecting" || phase === "error") {
      setLevels(SILENT);
      return;
    }
    let step = 0;
    const id = window.setInterval(() => {
      step += 1;
      setTick((value) => value + 1);
      setLevels(levelFor(phase, step));
    }, 100);
    return () => window.clearInterval(id);
  }, [ended, phase]);

  const spoken = Math.max(0, Math.min(REPLY.length, Math.floor((tick - 6) / 2)));
  const userFinal = tick >= 4;
  const captions: VoiceCaption[] = [
    { role: "user", turn: 1, text: userFinal ? ASK : ASK.slice(0, 6 + tick * 12), final: userFinal },
  ];
  if (spoken > 0) {
    captions.push({ role: "assistant", turn: 2, text: REPLY.slice(0, spoken).join(""), final: tick >= 6 + REPLY.length * 2 + 2 });
  }

  const shown: LivePhase = ended ? "connecting" : phase;
  const pick = (next: LivePhase) => {
    setPhase(next);
    setEnded(false);
  };

  return (
    <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: 460, margin: "0 auto", padding: "24px 0 32px" }}>
      <VoiceSession
        phase={shown}
        inputLevel={ended ? 0 : levels.input}
        outputLevel={ended ? 0 : levels.output}
        captions={ended ? [] : captions}
        error={shown === "error" ? "live_end: microphone permission was revoked" : undefined}
        onMute={() => pick(shown === "muted" ? "listening" : "muted")}
        onStop={() => {
          setEnded(true);
          setTick(0);
        }}
      />

      <p style={{ margin: 0, fontSize: 12, lineHeight: "18px", color: "var(--text-muted, #6f625a)" }}>
        {ended
          ? "live_stop sent — the session closed. A new one is opening; pick a phase to answer live_phase."
          : NOTE[phase]}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }} role="group" aria-label="Demo phase">
        {PHASES.map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => pick(entry)}
            aria-pressed={!ended && phase === entry}
            style={
              !ended && phase === entry
                ? { ...chip, color: "var(--text, #1a1410)", boxShadow: "inset 0 0 0 1px var(--text-muted, #6f625a)" }
                : chip
            }
          >
            {entry}
          </button>
        ))}
      </div>
    </div>
  );
}
