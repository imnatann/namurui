import { useState } from "react";
import { HeroBand } from "../hero-band";

/* The mark that sits inside the headline: a chat bubble with a bolt through it. */
function ChatMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ color: "var(--accent, #c2410c)" }}>
      <path
        d="M12 3.4c-5.1 0-9.2 3.7-9.2 8.2 0 2.3 1 4.3 2.8 5.8l-.7 3.5 3.7-1.6c1 .3 2.2.5 3.4.5 5.1 0 9.2-3.7 9.2-8.2S17.1 3.4 12 3.4Z"
        fill="currentColor"
      />
      <path d="M12.9 7.2 9.6 12.4h2.3l-.8 4.4 3.3-5.2h-2.3l.8-4.4Z" fill="var(--accent-fg, #fffdfb)" />
    </svg>
  );
}

export default function Demo() {
  const [note, setNote] = useState("");

  return (
    <div style={{ padding: "8px 0", borderRadius: 16, background: "var(--bg, #faf7f4)" }}>
      <HeroBand
        pill={
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              minHeight: 29,
              padding: "4px 12px 4px 4px",
              borderRadius: 999,
              background: "var(--panel, #fffdfb)",
              boxShadow: "inset 0 0 0 1px var(--border, #e8e0d7)",
              color: "var(--text, #1a1410)",
              fontSize: "0.8rem",
              fontWeight: 500,
              lineHeight: 1.35,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 21,
                padding: "0 8px",
                borderRadius: 999,
                background: "var(--accent, #c2410c)",
                color: "var(--accent-fg, #fffdfb)",
                fontSize: "0.6875rem",
                fontWeight: 700,
                letterSpacing: "0.09em",
                textTransform: "uppercase",
              }}
            >
              Baru
            </span>
            Asisten AI untuk WhatsApp
          </span>
        }
        title="Perkenalkan Rigo"
        glyph={<ChatMark />}
        lead="AI customer service yang menjawab chat WhatsApp dan Instagram saat tim kamu sedang sibuk."
        subLead="Hubungkan nomor WhatsApp Business, ajarkan katalog dan SOP toko, lalu biarkan balasan pertama keluar dalam hitungan detik."
        actions={
          <>
            <button type="button" onClick={() => setNote("Tautan uji coba dikirim ke WhatsApp kamu.")}>
              Coba Gratis
            </button>
            <a
              href="#sales"
              onClick={(event) => {
                event.preventDefault();
                setNote("Tim sales menghubungi kamu pada jam kerja berikutnya.");
              }}
            >
              Hubungi Sales
            </a>
          </>
        }
      />

      <p
        role="status"
        aria-live="polite"
        style={{
          minHeight: 20,
          margin: "0 24px 20px",
          color: "var(--text-muted, #6f625a)",
          fontSize: "0.8rem",
          textAlign: "center",
        }}
      >
        {note}
      </p>
    </div>
  );
}
