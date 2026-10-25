import { useState } from "react";
import { ChatWindow } from "../chat-window";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const STATES: { label: string; tone: Tone; detail: string }[] = [
  { label: "Terhubung", tone: "success", detail: "Pesan masuk mengalir ke inbox sejak 06:00." },
  { label: "Sinkronisasi", tone: "accent", detail: "Menyelaraskan kontak dan riwayat percakapan." },
  { label: "Menunggu izin", tone: "warning", detail: "Izin pesan belum disetujui pemilik nomor." },
  { label: "Terputus", tone: "danger", detail: "Token akses kedaluwarsa, sambungkan ulang nomor." },
  { label: "Nonaktif", tone: "neutral", detail: "Kanal dimatikan, tidak ada pesan yang masuk." },
];

const ROWS = [
  { name: "Andi Pratama", preview: "Stok Fortuner 2.8 putih masih ada?", time: "09:41" },
  { name: "Rina Lestari", preview: "Boleh kirim katalog lengkapnya?", time: "09:38" },
];

const control = {
  height: 30,
  padding: "0 11px",
  border: 0,
  borderRadius: 8,
  background: "transparent",
  boxShadow: "inset 0 0 0 1px var(--border, #e8e0d7)",
  color: "var(--text, #1a1410)",
  font: "inherit",
  fontSize: 12,
  cursor: "pointer",
};

const muted = "var(--text-muted, #6f625a)";

export default function Demo() {
  const [dots, setDots] = useState(true);
  const [state, setState] = useState(0);
  const current = STATES[state];

  return (
    <div
      style={{
        display: "grid",
        gap: 16,
        width: "100%",
        maxWidth: 1120,
        margin: "0 auto",
        padding: "24px 0 32px",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" style={control} onClick={() => setDots((on) => !on)}>
          {dots ? "Sembunyikan titik" : "Tampilkan titik"}
        </button>
        <button
          type="button"
          style={control}
          onClick={() => setState((index) => (index + 1) % STATES.length)}
        >
          Status berikutnya
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
          alignItems: "start",
        }}
      >
        {/* A list body: the frame takes its height from these two rows. */}
        <ChatWindow title="Inbox" trafficDots={dots} meta="3 terbuka">
          {ROWS.map((row, index) => (
            <div
              key={row.name}
              style={{
                display: "grid",
                gap: 2,
                padding: "9px 12px",
                boxShadow: index === 0 ? "inset 0 -1px 0 var(--border, #e8e0d7)" : "none",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{row.name}</span>
                <span style={{ fontSize: 11, color: muted, fontVariantNumeric: "tabular-nums" }}>
                  {row.time}
                </span>
              </div>
              <span
                style={{
                  fontSize: 11.5,
                  color: muted,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {row.preview}
              </span>
            </div>
          ))}
        </ChatWindow>

        {/* A prose body: one paragraph, no rows, and the frame still fits it exactly. */}
        <ChatWindow title="Ringkasan" trafficDots={dots} meta="baru saja">
          <p style={{ padding: "12px 14px", fontSize: 12, lineHeight: "19px", color: muted }}>
            Pelanggan menanyakan ketersediaan unit dan skema cicilan. Agen mengirim dua pilihan
            warna, lalu mencatat permintaan test drive untuk Sabtu pagi.
          </p>
        </ChatWindow>

        {/* The status case: the badge names the state and the tone only reinforces it. */}
        <ChatWindow
          title="Koneksi"
          trafficDots={dots}
          status={{ label: current.label, tone: current.tone }}
        >
          <div style={{ display: "grid", gap: 6, padding: "12px 14px" }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                gap: 2,
                columnGap: 12,
              }}
            >
              <span style={{ fontSize: 11.5, color: muted }}>WhatsApp Business</span>
              <span style={{ fontSize: 11.5, fontVariantNumeric: "tabular-nums" }}>
                +62 812 5500 118
              </span>
            </div>
            <p style={{ fontSize: 11.5, lineHeight: "17px", color: muted }}>{current.detail}</p>
          </div>
        </ChatWindow>
      </div>
    </div>
  );
}
