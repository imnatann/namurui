import { useEffect, useState, type CSSProperties } from "react";
import { MockThread, type ChatBubble } from "../mock-thread";

/* The thread a marketing page loops: a buyer asking about a unit, the assistant answering from
 * the shop catalogue, and the handoff note that closes the exchange. */
const OPENING: ChatBubble[] = [
  {
    id: "b1",
    side: "in",
    text: "Fortuner 2.8 putih masih ada? Kirim ke Bandung?",
    initials: "AP",
  },
  {
    id: "b2",
    side: "out",
    text: "Ada, 1 unit di gudang BSD. Kirim 2 hari.",
    time: "09:41",
    agent: true,
  },
  { id: "b3", side: "in", text: "Oke, kalau DP-nya berapa?", initials: "AP" },
];

const REPLY: ChatBubble = {
  id: "b4",
  side: "out",
  text: "DP 20 persen, Rp 112 juta. Saya kirim rinciannya.",
  time: "09:42",
  agent: true,
};

const SOURCE = {
  label: "Dipakai di jawaban AI",
  quote: "Fortuner 2.8 putih · 1 unit · gudang BSD",
};

const NOTE = "Dialihkan ke admin · konteks lengkap";

const EMPTY: ChatBubble[] = [];

/* Five beats, each one a timeout into the next: the thread, the typing row, the reply landing,
 * the handoff note, then an empty beat so the staggered arrival is visible on the restart. */
const BEATS = [1800, 1500, 1800, 2400, 900];

export default function Demo() {
  const [beat, setBeat] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(
      () => setBeat((current) => (current + 1) % BEATS.length),
      BEATS[beat],
    );
    return () => window.clearTimeout(timer);
  }, [beat, paused]);

  const answered = beat === 2 || beat === 3;
  const messages = beat === 4 ? EMPTY : answered ? [...OPENING, REPLY] : OPENING;

  return (
    <div
      style={{
        display: "grid",
        gap: 14,
        width: "100%",
        maxWidth: 384,
        margin: "0 auto",
        padding: "28px 0 32px",
      }}
    >
      {/* The reserved height keeps the controls still while the thread is empty on the reset
       * beat, and the thread grows upward from the bottom the way a chat does. */}
      <div style={{ display: "flex", alignItems: "flex-end", minHeight: 330 }}>
        <MockThread
          messages={messages}
          typing={beat === 1}
          note={beat === 3 ? NOTE : undefined}
          source={answered ? SOURCE : undefined}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", gap: 5 }} aria-hidden="true">
          {BEATS.map((_, index) => (
            <span
              key={index}
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: index === beat ? "var(--accent)" : "var(--border)",
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" style={control} onClick={() => setPaused((on) => !on)}>
            {paused ? "Lanjut" : "Jeda"}
          </button>
          <button
            type="button"
            style={control}
            onClick={() => {
              setBeat(0);
              setPaused(false);
            }}
          >
            Putar ulang
          </button>
        </div>
      </div>

      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 12, lineHeight: "18px" }}>
        Siklus berjalan sendiri: percakapan masuk, AI menulis, jawaban mendarat, lalu dialihkan ke
        admin.
      </p>
    </div>
  );
}

const control: CSSProperties = {
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
