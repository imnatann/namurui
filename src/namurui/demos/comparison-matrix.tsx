import { ComparisonMatrix, type MatrixColumn, type MatrixRow } from "../comparison-matrix";

const columns: MatrixColumn[] = [
  { title: "Auto-reply WhatsApp", note: "Template & pemicu" },
  { title: "AI customer service", note: "Jawab dari konteks" },
  { title: "Chatrigo", note: "Inbox + AI + handoff", badge: "Paling lengkap" },
];

const rows: MatrixRow[] = [
  {
    feature: "Cara menjawab",
    values: [
      { text: "Template dan pemicu" },
      {
        text: "Jawaban dari konteks",
        help: "Model menyusun jawaban dari pertanyaan pelanggan, bukan dari daftar kata kunci.",
      },
      {
        text: "AI dulu, admin kapan saja",
        help: "Balasan pertama dikirim AI; admin bisa mengambil alih tanpa pelanggan mengulang cerita.",
      },
    ],
  },
  {
    feature: "Sumber jawaban",
    values: [
      { text: "Daftar kata kunci" },
      {
        text: "Pengetahuan umum model",
        help: "Jawaban bisa benar secara umum tetapi tidak tahu stok, harga, atau SOP toko.",
      },
      { text: "Katalog, SOP, dan riwayat chat" },
    ],
  },
  {
    feature: "Channel",
    values: [
      { text: "WhatsApp saja" },
      { text: "WhatsApp dan web" },
      {
        text: "WhatsApp, Instagram, Telegram, web",
        help: "Semua channel masuk ke satu inbox dengan identitas pelanggan yang sama.",
      },
    ],
  },
  {
    feature: "Banyak admin",
    values: [
      { text: "Satu nomor, satu admin" },
      { text: "Tidak dibatasi kursi" },
      {
        text: "Tim dengan antrean otomatis",
        help: "Antrean dibagi per channel dan label, lalu dirotasi ke admin yang sedang online.",
      },
    ],
  },
  {
    feature: "Human handoff",
    values: [
      { text: "Manual, konteks hilang" },
      {
        text: "Terbatas pada eskalasi",
        help: "Percakapan diteruskan sebagai pesan baru, riwayat sebelumnya tidak ikut.",
      },
      {
        text: "Sekali klik, konteks ikut",
        help: "Admin menerima seluruh riwayat, catatan AI, dan data pelanggan dalam satu panel.",
      },
    ],
  },
  {
    feature: "Harga mulai",
    values: [
      { text: "Rp150 ribu per bulan" },
      { text: "Bayar per token" },
      {
        text: "Rp499 ribu per bulan",
        help: "Termasuk 3.000 percakapan AI per bulan; kelebihannya ditagih per percakapan.",
      },
    ],
  },
];

export default function Demo() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <ComparisonMatrix
        caption="Perbandingan auto-reply WhatsApp, AI customer service, dan Chatrigo untuk layanan pelanggan"
        columns={columns}
        rows={rows}
        raisedIndex={2}
      />
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, opacity: 0.7 }}>
        Harga per Oktober 2026, sudah termasuk PPN. Arahkan kursor atau tekan Tab ke tanda tanya
        untuk membaca catatan tiap nilai.
      </p>
    </div>
  );
}
