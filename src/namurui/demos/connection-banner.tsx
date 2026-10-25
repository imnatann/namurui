import { useEffect, useState, type CSSProperties } from "react";
import { ConnectionBanner, type ConnectionState } from "../connection-banner";

const ORDER: ConnectionState[] = ["starting", "ready", "reconnecting", "exited", "error"];

const COPY: Record<ConnectionState, { message?: string; code?: number | string }> = {
  starting: { message: "Spawned omp bridge on port 7420, waiting for the socket" },
  ready: {},
  reconnecting: { message: "SSE stream closed by the bridge during a tool call" },
  exited: { message: "The bridge process ended while a run was in flight", code: 137 },
  error: { message: "bridge_status reported a protocol mismatch", code: "EPROTO" },
};

const NOTE: Record<ConnectionState, string> = {
  starting: "Starting pulses slowly, then settles into ready on its own.",
  ready: "Ready is the quiet state: the banner leaves the flow and the transcript sits flush.",
  reconnecting: "The backoff clock stops at 0s and waits for the bridge to report the next state.",
  exited: "Restart respawns the bridge and walks back through starting, then ready.",
  error: "A code from bridge_status rides beside the state word, not instead of it.",
};

const control: CSSProperties = {
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
  const [state, setState] = useState<ConnectionState>("starting");
  const [gap, setGap] = useState(false);
  const [reloaded, setReloaded] = useState(false);

  /* A restart walks the real handshake: starting holds for a beat, then the bridge
   * reports ready and the banner leaves the flow. */
  useEffect(() => {
    if (state !== "starting") return;
    const timer = window.setTimeout(() => setState("ready"), 1600);
    return () => window.clearTimeout(timer);
  }, [state]);

  const copy = COPY[state];
  const restart = () => {
    setReloaded(false);
    setState("starting");
  };

  return (
    <div style={{ display: "grid", width: "100%", maxWidth: 520, margin: "0 auto", padding: "24px 0 32px" }}>
      <ConnectionBanner
        state={state}
        message={copy.message}
        code={copy.code}
        retryInSeconds={state === "reconnecting" ? 4 : undefined}
        historyGap={gap}
        onRestart={restart}
        onRetryNow={restart}
        onReload={() => {
          setGap(false);
          setReloaded(true);
        }}
      />

      <p
        style={{
          margin: "14px 0 0",
          fontSize: 12,
          lineHeight: "18px",
          color: "var(--text-muted, #6f625a)",
        }}
      >
        {reloaded
          ? "Transcript refetched over REST. The live stream keeps appending from here."
          : NOTE[state]}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        <button
          type="button"
          onClick={() => {
            setReloaded(false);
            setState((current) => ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]);
          }}
          style={control}
        >
          Next state
        </button>
        <button
          type="button"
          aria-pressed={gap}
          onClick={() => {
            setReloaded(false);
            setGap((open) => !open);
          }}
          style={gap ? { ...control, boxShadow: "inset 0 0 0 1px var(--accent, #c2410c)" } : control}
        >
          {gap ? "Hide history gap" : "Show history gap"}
        </button>
        <button type="button" onClick={restart} style={control}>
          Restart the demo
        </button>
      </div>
    </div>
  );
}
