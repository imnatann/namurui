import { useState, type CSSProperties } from "react";
import { SiteFooter, type FooterGroup, type FooterLink } from "../site-footer";

/* The chatrigo.id footer link set, in the order the live page renders it. The product group and
 * the legal group are the same ten destinations split the way a host that wants columns would. */
const LINKS: FooterLink[] = [
  { label: "Produk", href: "#produk" },
  { label: "AI Sales Agent", href: "#ai-sales-agent" },
  { label: "Chatrigo Build", href: "#chatrigo-build" },
  { label: "Harga", href: "#harga" },
  { label: "Perbandingan", href: "#perbandingan" },
  { label: "FAQ", href: "#faq" },
  { label: "Privasi", href: "/privacy" },
  { label: "Syarat", href: "/terms" },
  { label: "DPA", href: "/dpa" },
  { label: "Subprosesor", href: "/subprocessors" },
];

const GROUPS: FooterGroup[] = [
  { label: "Produk", items: LINKS.slice(0, 3) },
  { label: "Paket", items: LINKS.slice(3, 6) },
  { label: "Legal", items: LINKS.slice(6) },
];

const NOTE = "© 2026 PT Rigo Inovasi Digital";

const bar: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 8,
  marginBottom: 4,
};

/* The two variants are one choice, so they read as a segmented control; the toggles beside it
 * stay separate chips. Nothing in the bar wears the ember, which belongs to the footer's mark. */
const segment: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 2,
  height: 30,
  padding: 2,
  borderRadius: 999,
  background: "transparent",
  boxShadow: "inset 0 0 0 1px var(--border, #e8e0d7)",
};

const segmentButton = (active: boolean): CSSProperties => ({
  height: 26,
  padding: "0 12px",
  border: 0,
  borderRadius: 999,
  background: active ? "var(--panel-raised, #ffffff)" : "transparent",
  boxShadow: active ? "inset 0 0 0 1px var(--border, #e8e0d7)" : "none",
  color: active ? "var(--text, #1a1410)" : "var(--text-muted, #6f625a)",
  font: "inherit",
  fontSize: 12,
  fontWeight: active ? 600 : 500,
  whiteSpace: "nowrap",
  cursor: "pointer",
});

const chip = (active: boolean): CSSProperties => ({
  height: 28,
  padding: "0 11px",
  border: 0,
  borderRadius: 999,
  background: active ? "var(--panel-raised, #ffffff)" : "transparent",
  boxShadow: "inset 0 0 0 1px var(--border, #e8e0d7)",
  color: active ? "var(--text, #1a1410)" : "var(--text-muted, #6f625a)",
  font: "inherit",
  fontSize: 12,
  cursor: "pointer",
});

const frame: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  maxWidth: "100%",
  overflow: "hidden",
  borderRadius: 16,
  /* One step above the gallery ground, so the band reads as a page surface in both themes
   * instead of dissolving into the preview's own background. */
  background: "var(--panel, #fffdfb)",
  boxShadow: "inset 0 0 0 1px var(--border, #e8e0d7)",
};

/* A page tail above the band, so the footer is seen closing something instead of floating in an
 * empty frame. The lines are the page's own muted ink, not a second palette. */
const tail: CSSProperties = {
  display: "grid",
  flex: "1 1 auto",
  gap: 6,
  padding: "22px 20px 24px",
  minHeight: 84,
  alignContent: "start",
};

const tailLead: CSSProperties = {
  margin: 0,
  color: "var(--text, #1a1410)",
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "-0.01em",
};

const tailCopy: CSSProperties = {
  margin: 0,
  maxWidth: 460,
  color: "var(--text-muted, #6f625a)",
  fontSize: 12,
  lineHeight: 1.6,
};

export default function Demo() {
  /* Grouped is the default: three labelled columns fill the band and read as a finished footer,
   * where the flat row is a single line that leaves the width empty. */
  const [grouped, setGrouped] = useState(true);
  const [narrow, setNarrow] = useState(false);
  const [note, setNote] = useState(NOTE);

  return (
    <div style={{ display: "grid", gap: 14, width: "100%", padding: "20px 0 28px" }}>
      <div style={bar}>
        <div style={segment} role="group" aria-label="Footer layout">
          <button type="button" style={segmentButton(!grouped)} onClick={() => setGrouped(false)}>
            Flat row
          </button>
          <button type="button" style={segmentButton(grouped)} onClick={() => setGrouped(true)}>
            Grouped columns
          </button>
        </div>
        <button type="button" style={chip(narrow)} onClick={() => setNarrow((on) => !on)}>
          {narrow ? "Full width" : "320px"}
        </button>
        <button
          type="button"
          style={chip(false)}
          onClick={() => setNote((line) => (line === NOTE ? "" : NOTE))}
        >
          {note ? "Hide copyright" : "Show copyright"}
        </button>
      </div>

      <div
        style={{
          ...frame,
          width: narrow ? 320 : "100%",
        }}
      >
        <div style={tail}>
          <p style={tailLead}>Chatrigo menjawab setiap chat WhatsApp</p>
          <p style={tailCopy}>
            Katalog, stok dan ongkir dibaca dari data yang sudah Anda simpan, lalu thread
            diserahkan ke tim dengan riwayat percakapan ikut terbawa.
          </p>
        </div>
        <SiteFooter
          links={LINKS}
          groups={grouped ? GROUPS : undefined}
          note={note || undefined}
        />
      </div>
    </div>
  );
}
