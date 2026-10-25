import { useState, type CSSProperties } from "react";
import { PricingTiers, type TierPlan } from "../pricing-tiers";

/* The home page plans: four tiers, capacities in chat volume per month. */
const HOME_PLANS: TierPlan[] = [
  {
    id: "lite",
    name: "Lite",
    monthly: "Gratis",
    yearly: "Gratis",
    unit: "1 bulan",
    note: "Sekali per akun · Live Chat & Web Widget",
    caveat:
      "Chatrigo Lite tersedia sekali per akun. Bisnis kedua memerlukan paket berbayar Micro, Kecil, atau Menengah.",
    ribbon: { label: "Mulai di sini", tone: "neutral", shape: "pill" },
    features: [
      { text: "Live Chat link + Web Widget" },
      {
        text: "150 kontak",
        help: "Kontak tersimpan dari chat masuk, bisa disapa ulang kapan saja.",
      },
      { text: "Penyimpanan media 1 GB" },
      {
        text: "AI Agent 100 balasan per bulan",
        help: "Balasan otomatis dari Knowledge Base, dengan eskalasi ke admin bila AI ragu.",
      },
      { text: "Knowledge Base 20 artikel" },
      { text: "Integrasi Marketplace", included: false },
      { text: "Sales Agent & Work chat", included: false },
      {
        text: "Team 1 orang termasuk owner",
        help: "Satu akun admin. Bisnis kedua perlu paket berbayar.",
      },
    ],
    cta: { label: "Mulai gratis", href: "#daftar" },
  },
  {
    id: "micro",
    name: "Micro",
    monthly: "Rp 600.000",
    yearly: "Rp 500.000",
    unit: "bulan",
    note: "Ditagih per bulan, bisa berhenti kapan saja",
    features: [
      { text: "Semua fitur Lite" },
      {
        text: "1.500 kontak",
        help: "Termasuk impor kontak dari spreadsheet dan label per pelanggan.",
      },
      { text: "Penyimpanan media 5 GB" },
      {
        text: "AI Agent 2.000 balasan per bulan",
        help: "AI menjawab dari katalog dan riwayat chat, lalu menyerahkan ke admin bila perlu.",
      },
      { text: "Knowledge Base 200 artikel" },
      {
        text: "2 channel tambahan",
        help: "WhatsApp, Instagram, atau Facebook, dipilih saat onboarding.",
      },
      { text: "Integrasi Marketplace", included: false },
      { text: "Custom domain widget", included: false },
      { text: "Team 3 orang" },
    ],
    cta: { label: "Pilih Micro", href: "#daftar" },
  },
  {
    id: "kecil",
    name: "Kecil",
    monthly: "Rp 2.400.000",
    yearly: "Rp 2.000.000",
    unit: "bulan",
    note: "Termasuk onboarding dibantu tim kami",
    ribbon: { label: "Paling dipilih", tone: "accent", shape: "pill" },
    recommended: true,
    features: [
      { text: "Semua fitur Micro" },
      {
        text: "10.000 kontak",
        help: "Dengan segmen dan broadcast bertarget per label pelanggan.",
      },
      { text: "Penyimpanan media 20 GB" },
      {
        text: "AI Agent 20.000 balasan per bulan",
        help: "Tiga skenario otomatis berjalan bersamaan tanpa antre.",
      },
      { text: "Knowledge Base tanpa batas" },
      {
        text: "Sales Agent & Work chat",
        help: "Agen menawarkan produk dan mencatat pesanan langsung dari percakapan.",
      },
      { text: "Integrasi Marketplace" },
      { text: "Domain email sendiri", included: false },
      { text: "Dedicated success manager", included: false },
    ],
    cta: { label: "Pilih Kecil", href: "#daftar" },
  },
  {
    id: "menengah",
    name: "Menengah",
    monthly: "Rp 6.000.000",
    yearly: "Rp 5.000.000",
    unit: "bulan",
    note: "Untuk bisnis dengan beberapa cabang",
    features: [
      { text: "Semua fitur Kecil" },
      {
        text: "50.000 kontak",
        help: "Satu basis kontak dengan riwayat chat yang tetap utuh per cabang.",
      },
      { text: "Penyimpanan media 100 GB" },
      {
        text: "AI Agent 100.000 balasan per bulan",
        help: "Termasuk alur otomatis lintas cabang dan jam operasional.",
      },
      {
        text: "Multi-cabang 5 lokasi",
        help: "Setiap cabang punya inbox, admin, dan laporan sendiri.",
      },
      { text: "Integrasi Marketplace" },
      { text: "SLA 99,9% & prioritas antrean" },
      { text: "On-premise deployment", included: false },
      { text: "Custom integrasi ERP", included: false },
    ],
    cta: { label: "Hubungi sales", href: "#kontak" },
  },
];

/* The services page cards: three engagements, quoted per quarter. */
const SERVICE_PLANS: TierPlan[] = [
  {
    id: "landing",
    name: "Landing Page",
    subtitle: "Untuk satu campaign atau satu tujuan utama.",
    monthly: "Rp 4.500.000",
    yearly: "Rp 3.750.000",
    unit: "kuartal",
    priceLabel: "Mulai",
    ribbon: { label: "Mulai di sini", tone: "neutral", shape: "tab" },
    features: [
      { text: "Custom landing page" },
      { text: "Responsive di semua layar" },
      { text: "Custom domain", help: "Domain kamu sendiri, kami bantu arahkan DNS-nya." },
      {
        text: "Basic SEO on-page",
        help: "Judul, deskripsi, dan struktur heading disiapkan untuk mesin pencari.",
      },
      { text: "Hosting & SSL" },
      {
        text: "Maintenance bulanan",
        help: "Pembaruan konten kecil, pemantauan uptime, dan perbaikan bug.",
      },
      { text: "Admin sederhana", included: false },
      { text: "Copywriting halaman", included: false },
    ],
    cta: { label: "Mulai konsultasi", href: "#kontak" },
  },
  {
    id: "profil",
    name: "Company Profile",
    subtitle: "Untuk bisnis yang perlu tampil lengkap dan profesional.",
    monthly: "Rp 12.000.000",
    yearly: "Rp 10.000.000",
    unit: "kuartal",
    priceLabel: "Mulai",
    ribbon: { label: "Paling dipilih", tone: "accent", shape: "tab" },
    recommended: true,
    features: [
      { text: "Multi-page website" },
      { text: "Custom design" },
      {
        text: "Admin panel",
        help: "Halaman dan artikel diubah sendiri tanpa menunggu tim kami.",
      },
      { text: "Responsive di semua layar" },
      {
        text: "SEO on-page menyeluruh",
        help: "Sitemap, metadata per halaman, dan struktur URL yang rapi.",
      },
      { text: "Hosting & SSL" },
      { text: "Maintenance bulanan" },
      {
        text: "Chatrigo Micro disertakan",
        help: "Nilai layanan setara Rp 300.000 per bulan tanpa biaya tambahan.",
      },
    ],
    cta: { label: "Mulai konsultasi", href: "#kontak" },
  },
  {
    id: "custom",
    name: "Custom Workflow",
    subtitle: "Untuk proses bisnis yang tidak bisa diselesaikan template.",
    monthly: "Custom Pricing",
    yearly: "Custom Pricing",
    unit: "",
    priceKind: "custom",
    note: "Kami hitung setelah sesi discovery",
    features: [
      { text: "Custom workflow", help: "Alur disusun ulang mengikuti proses tim kamu." },
      {
        text: "Authentication & roles",
        help: "Hak akses per peran, dari staf lapangan sampai direktur.",
      },
      { text: "Dashboard operasional" },
      { text: "Database & integrasi" },
      {
        text: "Integrasi sistem lama",
        help: "Sambung ke ERP, POS, atau spreadsheet yang masih dipakai.",
      },
      { text: "Maintenance bulanan" },
      { text: "Mobile app native", included: false },
    ],
    cta: { label: "Diskusikan kebutuhan", href: "#kontak" },
  },
];

const HOME_PERIODS: [string, string] = ["Bulanan", "Tahunan"];
const SERVICE_PERIODS: [string, string] = ["Kuartal", "Tahunan"];

/* The stage answers its own width, so the reader picks it. Natural means no width at all:
 * the block simply fills the preview and never scrolls sideways on its own. */
const STAGE_WIDTHS: { label: string; value: number | null }[] = [
  { label: "Natural", value: null },
  { label: "480", value: 480 },
  { label: "720", value: 720 },
  { label: "1200", value: 1200 },
];

/* One pill shape for every option in the bar. The chosen one is marked by a filled chip, a ring
 * and a heavier weight rather than by being the only option with any surface at all, and every
 * colour is a gallery token, so the bar follows the theme instead of pinning a cream fill. */
const tabStyle = (on: boolean): CSSProperties => ({
  minHeight: 30,
  padding: "0 12px",
  border: 0,
  borderRadius: 999,
  background: on ? "var(--hover-bg, #7a4a1c12)" : "transparent",
  boxShadow: on ? "inset 0 0 0 1px var(--border-soft, #1a14101a)" : "none",
  color: on ? "var(--text, #1a1410)" : "var(--text-muted, #6f625a)",
  font: "inherit",
  fontSize: 12,
  fontWeight: on ? 600 : 500,
  whiteSpace: "nowrap",
  cursor: "pointer",
});

/* Both group labels carry the same weight and colour, so neither group reads as the leftover. */
const barLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-muted, #6f625a)",
};

/* A cluster wraps as a whole before its options do, so a narrow stage moves the pills to the
 * next line instead of breaking a label like "1200 px" across two of them. */
const barClusterStyle: CSSProperties = {
  display: "inline-flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  maxWidth: "100%",
};

const barGroupStyle: CSSProperties = {
  display: "inline-flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "center",
  gap: 2,
  maxWidth: "100%",
};

export default function Demo() {
  const [page, setPage] = useState<"home" | "services">("home");
  const [picked, setPicked] = useState<string | null>(null);
  const [stageWidth, setStageWidth] = useState<number | null>(null);

  return (
    <div style={{ display: "grid", gap: 10, width: "100%" }}>
      {/* Two labelled clusters on one quiet line. No band sits behind either cluster: a partial
       * fill under part of the row was what made the bar look like a stray element. */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px 24px",
          padding: "4px 0 6px",
        }}
      >
        <span style={barClusterStyle}>
          <span style={barLabelStyle}>Konfigurasi</span>
          <span role="group" aria-label="Konfigurasi blok harga" style={barGroupStyle}>
            <button
              type="button"
              aria-pressed={page === "home"}
              onClick={() => setPage("home")}
              style={tabStyle(page === "home")}
            >
              Empat paket
            </button>
            <button
              type="button"
              aria-pressed={page === "services"}
              onClick={() => setPage("services")}
              style={tabStyle(page === "services")}
            >
              Tiga layanan
            </button>
          </span>
        </span>
        <span style={barClusterStyle}>
          <span style={barLabelStyle}>Lebar</span>
          <span role="group" aria-label="Lebar panggung" style={barGroupStyle}>
            {STAGE_WIDTHS.map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={stageWidth === option.value}
                aria-label={
                  option.value === null
                    ? "Lebar panggung: natural"
                    : `Lebar panggung: ${option.value} piksel`
                }
                onClick={() => setStageWidth(option.value)}
                style={tabStyle(stageWidth === option.value)}
              >
                {option.value === null ? "Natural" : `${option.value} px`}
              </button>
            ))}
          </span>
        </span>
        {picked ? (
          <span style={{ fontSize: 12, color: "var(--text-muted, #6f625a)" }}>
            Tombol ditekan: {picked}
          </span>
        ) : null}
      </div>

      {/* The block answers its own box rather than the viewport, so the stage starts at the
       * preview's natural width and the reader widens it only when they want the wide-column
       * proof. The scroll container stays, but it never scrolls until a width is chosen. */}
      <div style={{ width: "100%", overflowX: "auto", overflowY: "hidden" }}>
        <div style={{ width: stageWidth ?? undefined, minHeight: 420 }}>
          {page === "home" ? (
            <PricingTiers
              plans={HOME_PLANS}
              eyebrow="Harga"
              title="Mulai gratis, naik saat chatnya ramai"
              lead="Setiap paket membawa Live Chat, AI Agent, dan Knowledge Base yang sama. Yang berubah hanya kapasitas dan jumlah orang di dalamnya."
              note="Lite gratis sekali per akun. Bisnis kedua memerlukan paket berbayar."
              periods={HOME_PERIODS}
              onSelect={(plan) => setPicked(plan.name)}
            />
          ) : (
            <PricingTiers
              plans={SERVICE_PLANS}
              eyebrow="Chatrigo Build"
              title="Website yang langsung melayani"
              lead="Kami bangun, kamu review, lalu kami yang merawat. Pilih yang paling dekat dengan kebutuhanmu."
              periods={SERVICE_PERIODS}
              discountBadge={false}
              ctaSize="lg"
              backdrop
              footnote="Semua layanan berjalan selama masa langganan aktif. Data tetap disimpan apabila layanan dihentikan dan dapat diaktifkan kembali sesuai ketentuan."
              onSelect={(plan) => setPicked(plan.name)}
            />
          )}
        </div>
      </div>
    </div>
  );
}