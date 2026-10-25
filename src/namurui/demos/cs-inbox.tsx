import { useState } from "react";
import { CsInbox, type InboxConversation } from "../cs-inbox";

/* A working day in a small Indonesian store's inbox: fifteen customers across four channels, two
 * already closed, three handed to a person. Jessica's thread is the one open on first paint, and
 * it is the one the AI is still answering. */
const CONVERSATIONS: InboxConversation[] = [
  {
    id: "jessica",
    name: "Jessica Tanu",
    initials: "JT",
    channel: "instagram",
    handle: "@jess.skin",
    preview: "Serum yang kemarin aku tanya masih ready?",
    status: "AI membalas",
    statusTone: "accent",
    unread: true,
    at: "09.34",
    messages: [
      { id: "j0", side: "in", text: "Halo Kak, aku langganan serumnya dari bulan lalu.", time: "09.29" },
      {
        id: "j0b",
        side: "out",
        text: "Halo Kak Jessica, ada yang bisa dibantu?",
        time: "09.30",
        agent: true,
      },
      {
        id: "j0c",
        side: "out",
        text: "Siap Kak, stok pagi ini masih lengkap.",
        time: "09.31",
        agent: true,
      },
      { id: "j1", side: "in", text: "Kak, serum yang kemarin aku tanya masih ready?", time: "09.32" },
      { id: "j2", side: "in", text: "Yang 30 ml ya", time: "09.33" },
      {
        id: "j3",
        side: "out",
        text: "Masih ready, Kak. Serum 30 ml Rp189.000, tinggal 4 botol.",
        time: "09.33",
        agent: true,
      },
      {
        id: "j4",
        side: "out",
        text: "Mau aku siapkan untuk pickup di Kemang atau dikirim?",
        time: "09.34",
        agent: true,
      },
    ],
  },
  {
    id: "andi",
    name: "Andi Pratama",
    initials: "AP",
    channel: "whatsapp",
    handle: "+62 812 3344 9012",
    preview: "Stok Fortuner 2.8 putih masih ada?",
    status: "AI membalas",
    statusTone: "accent",
    at: "09.28",
    messages: [
      { id: "a1", side: "in", text: "Stok Fortuner 2.8 putih masih ada?", time: "09.27" },
      {
        id: "a2",
        side: "out",
        text: "Ada, Pak. Satu unit di gudang BSD, siap kirim minggu ini.",
        time: "09.28",
        agent: true,
      },
    ],
  },
  {
    id: "rina",
    name: "Rina Lestari",
    initials: "RL",
    channel: "instagram",
    handle: "@rina.lestari",
    preview: "Ukuran M-nya tinggal warna apa aja?",
    status: "Baru",
    statusTone: "warning",
    unread: true,
    at: "09.19",
    messages: [
      { id: "r1", side: "in", text: "Ukuran M-nya tinggal warna apa aja?", time: "09.19" },
    ],
  },
  {
    id: "budi",
    name: "Budi Santoso",
    initials: "BS",
    channel: "telegram",
    handle: "@budisantoso",
    preview: "Invoice yang kemarin belum masuk email saya",
    status: "Menunggu pelanggan",
    statusTone: "neutral",
    at: "09.07",
    messages: [
      { id: "b1", side: "in", text: "Invoice yang kemarin belum masuk email saya", time: "08.58" },
      {
        id: "b2",
        side: "out",
        text: "Sudah saya kirim ulang ke budi.santoso@mail.com, cek folder promosi ya.",
        time: "09.07",
        agent: true,
      },
    ],
  },
  {
    id: "siti",
    name: "Siti Rahmawati",
    initials: "SR",
    channel: "whatsapp",
    handle: "+62 813 7788 2210",
    preview: "Bisa COD ke Depok hari Sabtu?",
    status: "Perlu admin",
    statusTone: "danger",
    unread: true,
    at: "08.54",
    messages: [
      { id: "s1", side: "in", text: "Bisa COD ke Depok hari Sabtu?", time: "08.54" },
    ],
  },
  {
    id: "dimas",
    name: "Dimas Anggara",
    initials: "DA",
    channel: "web",
    handle: "dimas.a@mail.com",
    preview: "Keranjang saya hilang setelah login ulang",
    status: "Ditangani Anda",
    statusTone: "success",
    owner: "human",
    at: "08.41",
    messages: [
      { id: "d1", side: "in", text: "Keranjang saya hilang setelah login ulang", time: "08.39" },
      {
        id: "d2",
        side: "out",
        text: "Saya pulihkan keranjangnya, coba muat ulang halaman checkout ya.",
        time: "08.41",
      },
    ],
  },
  {
    id: "ayu",
    name: "Ayu Wulandari",
    initials: "AW",
    channel: "instagram",
    handle: "@ayu.wulandari",
    preview: "Kak, ada varian tanpa pewangi?",
    status: "AI membalas",
    statusTone: "accent",
    at: "08.33",
    messages: [
      { id: "y1", side: "in", text: "Kak, ada varian tanpa pewangi?", time: "08.32" },
      {
        id: "y2",
        side: "out",
        text: "Ada, seri Sensitive. Bebas pewangi dan alkohol.",
        time: "08.33",
        agent: true,
      },
    ],
  },
  {
    id: "bayu",
    name: "Bayu Nugroho",
    initials: "BN",
    channel: "telegram",
    handle: "@bayunugroho",
    preview: "Resi pengiriman nomor 8821 belum bergerak",
    status: "Menunggu pelanggan",
    statusTone: "neutral",
    at: "08.12",
    messages: [
      { id: "n1", side: "in", text: "Resi pengiriman nomor 8821 belum bergerak", time: "08.05" },
      {
        id: "n2",
        side: "out",
        text: "Sudah saya eskalasi ke kurir, biasanya bergerak dalam 1x24 jam.",
        time: "08.12",
        agent: true,
      },
    ],
  },
  {
    id: "citra",
    name: "Citra Halim",
    initials: "CH",
    channel: "web",
    handle: "citra.halim@mail.com",
    preview: "Minta faktur pajak untuk pembelian kantor",
    status: "Ditangani Anda",
    statusTone: "success",
    owner: "human",
    at: "07.58",
    messages: [
      { id: "c1", side: "in", text: "Minta faktur pajak untuk pembelian kantor", time: "07.52" },
      {
        id: "c2",
        side: "out",
        text: "Siap, saya kirim faktur pajaknya hari ini sebelum jam 5.",
        time: "07.58",
      },
    ],
  },
  {
    id: "dewi",
    name: "Dewi Kartika",
    initials: "DK",
    channel: "whatsapp",
    handle: "+62 811 2200 5566",
    preview: "Promo bundling masih berlaku sampai kapan?",
    status: "AI membalas",
    statusTone: "accent",
    at: "07.44",
    messages: [
      { id: "w1", side: "in", text: "Promo bundling masih berlaku sampai kapan?", time: "07.43" },
      {
        id: "w2",
        side: "out",
        text: "Berlaku sampai 31 Oktober, selama stok masih ada.",
        time: "07.44",
        agent: true,
      },
    ],
  },
  {
    id: "eko",
    name: "Eko Prasetyo",
    initials: "EP",
    channel: "instagram",
    handle: "@ekopras",
    preview: "Warna yang di foto lebih gelap dari aslinya",
    status: "Baru",
    statusTone: "warning",
    at: "07.31",
    messages: [
      { id: "e1", side: "in", text: "Warna yang di foto lebih gelap dari aslinya", time: "07.31" },
    ],
  },
  {
    id: "fitri",
    name: "Fitri Handayani",
    initials: "FH",
    channel: "whatsapp",
    handle: "+62 815 9090 1122",
    preview: "Sudah transfer, ini bukti transfernya",
    status: "Menunggu pelanggan",
    statusTone: "neutral",
    unread: true,
    at: "07.16",
    messages: [
      { id: "f1", side: "in", text: "Sudah transfer, ini bukti transfernya", time: "07.16" },
    ],
  },
  {
    id: "gilang",
    name: "Gilang Ramadhan",
    initials: "GR",
    channel: "telegram",
    handle: "@gilangr",
    preview: "Bisa minta katalog grosir terbaru?",
    status: "Selesai",
    statusTone: "success",
    state: "done",
    at: "06.50",
    messages: [
      { id: "g1", side: "in", text: "Bisa minta katalog grosir terbaru?", time: "06.44" },
      {
        id: "g2",
        side: "out",
        text: "Katalog grosir Oktober sudah saya kirim ke email Anda.",
        time: "06.50",
        agent: true,
      },
    ],
  },
  {
    id: "hana",
    name: "Hana Wijaya",
    initials: "HW",
    channel: "web",
    handle: "hana.w@mail.com",
    preview: "Akun saya terkunci setelah salah sandi",
    status: "Selesai",
    statusTone: "success",
    state: "done",
    at: "06.21",
    messages: [
      { id: "h1", side: "in", text: "Akun saya terkunci setelah salah sandi", time: "06.10" },
      {
        id: "h2",
        side: "out",
        text: "Akun sudah terbuka, silakan atur sandi baru lewat tautan yang dikirim.",
        time: "06.21",
        agent: true,
      },
    ],
  },
  {
    id: "indra",
    name: "Indra Kusuma",
    initials: "IK",
    channel: "whatsapp",
    handle: "+62 819 4455 7788",
    preview: "Pesanan saya dikirim ke alamat lama",
    status: "Perlu admin",
    statusTone: "danger",
    at: "06.02",
    messages: [
      { id: "k1", side: "in", text: "Pesanan saya dikirim ke alamat lama", time: "06.02" },
    ],
  },
];

export default function Demo() {
  const [note, setNote] = useState("Belum ada aksi.");

  return (
    <div style={{ display: "grid", gap: 12, width: "100%", maxWidth: 1152, margin: "0 auto", padding: "20px 0 28px" }}>
      <CsInbox
        conversations={CONVERSATIONS}
        defaultSelectedId="jessica"
        onSelect={(id) => {
          const row = CONVERSATIONS.find((item) => item.id === id);
          setNote(`Membuka ${row ? row.name : id}.`);
        }}
        onTakeover={(id) => {
          const row = CONVERSATIONS.find((item) => item.id === id);
          setNote(`Takeover ${row ? row.name : id}: balasan berikutnya dari admin.`);
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          padding: "0 4px",
          color: "var(--text-muted)",
          fontSize: 12,
          lineHeight: "18px",
        }}
      >
        <span aria-live="polite">{note}</span>
        <span>15 percakapan · 4 kanal · 2 admin</span>
      </div>
    </div>
  );
}
