import { useState } from "react";
import { CtaBand } from "../cta-band";

/* The mark a band carries is a slot, so the demo draws its own: a filled agent spark, with a
 * smaller one beside it. Both are solid shapes with no stroke, so at six percent behind the copy
 * they read as texture and never as a box drawn around the band. */
const MARK = (
  <svg viewBox="0 0 120 120" fill="none" aria-hidden="true" focusable="false">
    <path
      d="M50 16C55 43 69 56 96 62C69 68 55 81 50 108C45 81 31 68 4 62C31 56 45 43 50 16Z"
      fill="currentColor"
    />
    <path
      d="M103 9C105 18 109 22 118 24C109 26 105 30 103 39C101 30 97 26 88 24C97 22 101 18 103 9Z"
      fill="currentColor"
    />
  </svg>
);

export default function Demo() {
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <CtaBand
        title="Setiap pelanggan dapat jawaban, bahkan saat tim Anda tidur."
        lead="Chatrigo menjawab pertanyaan di WhatsApp dalam hitungan detik, membaca katalog dan riwayat pesanan, lalu mengoper percakapan yang rumit ke admin dengan konteks lengkap."
        watermark={MARK}
        actions={
          <>
            <a
              href="#coba-gratis"
              onClick={(event) => {
                event.preventDefault();
                setPicked("Mulai gratis 14 hari");
              }}
            >
              Mulai gratis 14 hari
            </a>
            <a
              href="#demo"
              data-tone="quiet"
              onClick={(event) => {
                event.preventDefault();
                setPicked("Lihat demo 2 menit");
              }}
            >
              Lihat demo 2 menit
            </a>
          </>
        }
      />

      <p
        role="status"
        aria-live="polite"
        style={{
          margin: 0,
          minHeight: 18,
          color: "var(--text-muted, #a2958a)",
          fontSize: 12,
          textAlign: "center",
        }}
      >
        {picked ? `Anda memilih: ${picked}` : ""}
      </p>
    </div>
  );
}
