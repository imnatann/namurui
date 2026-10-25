import { useState } from "react";
import { AgentChatScreen } from "../agent-chat";

/**
 * The reference screen, at the size it was captured: the orchestrator's thread, the five
 * agents it has put to work and the summer-launch brief beside them. Picking a selling angle,
 * switching a channel, sending a message and pressing Generate ads each report themselves
 * under the frame, so the props API is visible without inventing content the reference lacks.
 */
export default function Demo() {
  const [last, setLast] = useState("nothing yet");

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          width: "100%",
          maxWidth: 1440,
          margin: "0 auto",
          height: 900,
          borderRadius: 18,
          overflow: "hidden",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.08)",
          background: "var(--card)",
        }}
      >
        <AgentChatScreen
          workspace="Acme"
          user={{ name: "Alex Morgan" }}
          onNavigate={(label) => setLast(`opened ${label}`)}
          onSend={(text) => setLast(`sent "${text}"`)}
          onAngleChange={(name) => setLast(`selling the shirt as ${name.toLowerCase()}`)}
          onChannelChange={(name, on) => setLast(`${name} ${on ? "on" : "off"}`)}
          onGenerate={() => setLast("briefed the creative pipeline")}
        />
      </div>
      <p style={{ maxWidth: 1440, margin: "12px auto 0", fontSize: 12, color: "var(--text-muted)" }}>
        Pick a selling angle or a channel in the brief, send a message in the composer, or collapse the
        sidebar · last action: {last}
      </p>
    </div>
  );
}
