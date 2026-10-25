import type { CSSProperties } from "react";
import { UseCaseSwitcher, type UseCase } from "../use-case-switcher";

/* Eight flows from one WhatsApp number, written the way a shop owner would describe them. */
const USE_CASES: UseCase[] = [
  {
    id: "cart",
    label: "Follow-up keranjang",
    headline: "Keranjang ditinggal dua jam, chat masuk sendiri.",
    body: "Chatrigo membaca keranjang yang belum dibayar, lalu menyapa pembeli dengan nama barang dan ukuran yang dia pilih. Kalau pembeli membalas, percakapan lanjut ke admin dengan riwayat yang sudah lengkap.",
  },
  {
    id: "stock",
    label: "Cek stok & promo",
    headline: "Stok dan promo dijawab dari data toko, bukan tebakan.",
    body: "Pertanyaan soal ukuran, warna, atau diskon yang berlaku hari ini dijawab dari katalog yang sama dengan yang dipakai kasir. Kalau barang kosong, bot menawarkan alternatif yang masih ada.",
  },
  {
    id: "booking",
    label: "Booking janji",
    headline: "Jadwal servis dipilih pembeli, kalender toko ikut terisi.",
    body: "Bot menampilkan slot yang masih kosong di minggu berjalan, mengunci pilihan pembeli, dan mengirim pengingat sehari sebelum jadwal. Pindah jadwal cukup lewat chat yang sama.",
  },
  {
    id: "faq",
    label: "FAQ operasional",
    headline: "Jam buka, ongkir, dan retur dijawab tanpa menunggu admin.",
    body: "Pertanyaan yang paling sering masuk dijawab langsung dengan kalimat yang sudah disetujui tim. Yang tidak ada di daftar diteruskan ke admin, tidak dikarang sendiri.",
  },
  {
    id: "lead",
    label: "Lead inbound",
    headline: "Setiap chat baru jadi lead yang rapi di pipeline.",
    body: "Nomor, kebutuhan, dan anggaran yang disebut di chat dicatat sebagai satu lead. Admin melihat dari mana lead datang dan apa yang sudah dijanjikan bot sebelum bicara.",
  },
  {
    id: "aftersales",
    label: "After-sales",
    headline: "Keluhan sampai, tiket dibuat, pembeli tetap dapat kabar.",
    body: "Bot menanyakan nomor pesanan, mengelompokkan keluhan, dan membuat tiket untuk tim. Pembeli menerima pembaruan status di chat yang sama sampai kasusnya ditutup.",
  },
  {
    id: "reminder",
    label: "Reminder pembayaran",
    headline: "Tagihan jatuh tempo diingatkan tanpa menagih dua kali.",
    body: "Pengingat keluar pada hari yang ditentukan, dengan nominal dan batas waktu yang jelas. Begitu pembayaran masuk, pesan berikutnya berhenti sendiri.",
  },
  {
    id: "handoff",
    label: "Handoff ke admin",
    headline: "Bot berhenti bicara begitu admin mengambil alih.",
    body: "Percakapan berpindah ke admin dengan ringkasan dan seluruh konteks sebelumnya. Bot menunggu, lalu kembali menjawab setelah admin mengembalikan percakapan.",
  },
];

const cta: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 44,
  padding: "0 20px",
  borderRadius: 12,
  background: "linear-gradient(135deg, var(--accent, #c2410c), var(--accent-hover, #9a3412))",
  color: "var(--accent-fg, #fffdfb)",
  fontSize: "0.9rem",
  fontWeight: 600,
  textDecoration: "none",
  boxShadow: "0 1px 2px #3d1f0a1f, inset 0 1px 0 #ffffff2e",
};

const phone: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  width: "min(100%, 15.5rem)",
  /* On desktop the slot hands down the copy's height; on a phone screen the frame falls back to a
   * real handset ratio instead of growing with every message. */
  aspectRatio: "1 / 2.05",
  height: "100%",
  marginInline: "auto",
  padding: 10,
  borderRadius: 26,
  background: "var(--card, #ffffff)",
  boxShadow: "inset 0 0 0 1px var(--border, #e8e0d7), 0 12px 32px #3d1f0a14",
};

/* Drawn bezel cues: a speaker slot above the app bar and a home bar under the composer. They are
 * what makes the frame read as a phone rather than a stack of bubbles. */
const notch: CSSProperties = {
  flex: "none",
  width: 46,
  height: 5,
  margin: "0 auto 2px",
  borderRadius: 999,
  background: "var(--border, #e8e0d7)",
};

const homeBar: CSSProperties = {
  flex: "none",
  width: 62,
  height: 4,
  margin: "2px auto 0",
  borderRadius: 999,
  background: "var(--border, #e8e0d7)",
};

const bar: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "4px 6px 2px",
};

const avatar: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 26,
  height: 26,
  borderRadius: 999,
  background: "var(--accent-soft, #c2410c1a)",
  color: "var(--accent, #c2410c)",
  fontSize: "0.72rem",
  fontWeight: 700,
};

const who: CSSProperties = {
  display: "grid",
  gap: 1,
  fontSize: "0.78rem",
  fontWeight: 600,
  color: "var(--text, #1a1410)",
  lineHeight: 1.2,
};

const status: CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 400,
  color: "var(--text-muted, #6f625a)",
};

const thread: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
  flex: "1 1 auto",
  minHeight: 0,
  overflowY: "auto",
  overscrollBehavior: "contain",
  padding: "10px 8px",
  borderRadius: 16,
  background: "var(--panel, #fffdfb)",
  boxShadow: "inset 0 0 0 1px var(--border-soft, #1a14101a)",
};

/* The first bubble pushes the thread down, so the newest message always sits above the composer,
 * which is how a chat looks when it has more room than messages. */
const threadStart: CSSProperties = {
  marginTop: "auto",
};

const bubble = (out: boolean): CSSProperties => ({
  alignSelf: out ? "flex-end" : "flex-start",
  maxWidth: "84%",
  margin: 0,
  padding: "7px 10px",
  borderRadius: 13,
  background: out ? "var(--accent, #c2410c)" : "var(--card, #ffffff)",
  color: out ? "var(--accent-fg, #fffdfb)" : "var(--text, #1a1410)",
  fontSize: "0.74rem",
  lineHeight: 1.45,
  boxShadow: out ? "none" : "inset 0 0 0 1px var(--border, #e8e0d7)",
});

const composer: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  height: 34,
  padding: "0 10px",
  borderRadius: 999,
  background: "var(--panel, #fffdfb)",
  boxShadow: "inset 0 0 0 1px var(--border, #e8e0d7)",
  color: "var(--text-muted, #6f625a)",
  fontSize: "0.72rem",
};

/* A phone drawn with plain markup: bezel cues, app bar, a scrollable thread, a composer. Scrolling
 * it and then switching a chip leaves the scroll position alone, which is the point of the slot. */
function PhonePreview() {
  return (
    <div style={phone}>
      <span style={notch} aria-hidden="true" />
      <div style={bar}>
        <span style={avatar} aria-hidden="true">
          C
        </span>
        <span style={who}>
          Chatrigo
          <span style={status}>online, dibalas bot</span>
        </span>
      </div>
      <div style={thread}>
        <p style={{ ...bubble(false), ...threadStart }}>Halo, sepatu lari ukuran 42 masih ada?</p>
        <p style={bubble(true)}>Ada, Kak. Warna hitam sisa 3 pasang, Rp 549.000.</p>
        <p style={bubble(false)}>Bisa kirim hari ini?</p>
        <p style={bubble(true)}>Bisa. Dipesan sebelum jam 4, kurir ambil sore ini.</p>
        <p style={bubble(false)}>Oke, saya ambil yang hitam.</p>
        <p style={bubble(true)}>Sudah saya siapkan. Lanjut ke admin untuk pembayaran.</p>
        <p style={bubble(false)}>Sudah saya bayar lewat transfer.</p>
        <p style={bubble(true)}>Diterima, Kak. Pesanan masuk antrean kirim hari ini.</p>
        <p style={bubble(false)}>Resinya nanti dikirim ke chat ini?</p>
        <p style={bubble(true)}>Betul, resi menyusul lewat chat yang sama.</p>
      </div>
      <div style={composer}>
        <span>Tulis pesan</span>
        <span style={{ color: "var(--accent, #c2410c)", fontWeight: 600 }}>Kirim</span>
      </div>
      <span style={homeBar} aria-hidden="true" />
    </div>
  );
}

export default function Demo() {
  return (
    <UseCaseSwitcher
      useCases={USE_CASES}
      defaultId="cart"
      title="Delapan alur yang paling sering ditanyakan pembeli."
      caption="Contoh alur, bukan hasil pelanggan."
      cta={
        <a href="#alur" style={cta}>
          Lihat semua alur
        </a>
      }
      preview={<PhonePreview />}
    />
  );
}
