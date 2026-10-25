import { useState, type CSSProperties } from "react";
import { ServiceRow } from "../service-row";

/* The three services the chatrigo page sells, each with the shot it ships: a landing page, a
 * company profile, and a workflow built to the client's own process. The middle row flips so the
 * shot alternates sides down the stack; the checkbox drops the third shot to show the row taking
 * the full width when a service has no visual yet.
 *
 * The three shots are one product at three pages: one page surface, one block style, one skeleton
 * ink, one ember action each, and the same three-up strip to close on. Every size inside a shot is
 * a share of the shot's own width, so the picture keeps its proportions and gives up detail
 * instead of clipping when the row is narrow. */

/* One pixel of the 508 wide shot, as a share of the frame the shot is drawn in. */
const u = (n: number): string => `${(n / 5.08).toFixed(3)}cqw`;

const ink = "var(--text, #1a1410)";
const muted = "var(--text-muted, #6f625a)";
const subtle = "var(--text-subtle, #1a141099)";
const line = "var(--border, #e8e0d7)";
/* The page a shot draws, and the blocks that sit on it: one step apart, and apart from the row. */
const surface = "var(--preview, #fdfaf7)";
const block = "var(--card, #fffdfb)";
const accent = "var(--accent, #c2410c)";
const accentInk = "var(--accent-fg, #fffdfb)";
const success = "var(--success, #1a7a4a)";
const warning = "var(--warning, #9a6410)";
const danger = "var(--danger, #b3261e)";

const page: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: u(14),
  height: "100%",
  padding: `${u(16)} ${u(18)}`,
  background: surface,
  color: ink,
  fontFamily: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontSize: u(9.5),
  lineHeight: 1.3,
  letterSpacing: "-0.01em",
};

/* The one ember element a page gets: its primary action. */
const accentPill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: u(18),
  padding: `0 ${u(11)}`,
  borderRadius: 999,
  background: accent,
  color: accentInk,
  fontSize: u(8.5),
  fontWeight: 600,
  letterSpacing: "0.01em",
  whiteSpace: "nowrap",
};

/* Quiet chrome: a chip states a fact, it never carries the action. */
const chip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: u(16),
  padding: `0 ${u(7)}`,
  borderRadius: 999,
  boxShadow: `inset 0 0 0 1px ${line}`,
  color: muted,
  fontSize: u(8),
  fontWeight: 500,
  whiteSpace: "nowrap",
};

/* Every page closes on the same three-up strip of blocks. */
const tile: CSSProperties = {
  display: "grid",
  alignContent: "start",
  gap: u(5),
  padding: u(9),
  borderRadius: u(8),
  boxShadow: `inset 0 0 0 1px ${line}`,
  background: block,
};

const strip: CSSProperties = {
  flex: "none",
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: u(8),
};

const navRow: CSSProperties = {
  flex: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: u(12),
};

/* The band between the top bar and the closing strip, held in its own air. */
const middle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "grid",
  alignContent: "center",
  justifyItems: "center",
  gap: u(7),
};

const note: CSSProperties = {
  flex: "none",
  display: "flex",
  alignItems: "center",
  gap: u(7),
};

function Bar({
  w,
  h = 5,
  ink = false,
  style,
}: {
  w: number | string;
  h?: number;
  ink?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        display: "block",
        width: typeof w === "number" ? u(w) : w,
        height: u(h),
        borderRadius: u(h / 2),
        background: ink ? "var(--text, #1a1410)" : subtle,
        opacity: ink ? 0.72 : 1,
        ...style,
      }}
    />
  );
}

function LandingShot() {
  return (
    <div style={page}>
      <div style={navRow}>
        <Bar w={38} h={7} ink />
        <div style={{ display: "flex", gap: u(10) }}>
          <Bar w={20} h={4} />
          <Bar w={24} h={4} />
          <Bar w={16} h={4} />
        </div>
        <span style={chip}>Coba</span>
      </div>

      <div style={middle}>
        <span style={chip}>Baru</span>
        <Bar w={238} h={13} ink />
        <Bar w={172} h={13} ink />
        <Bar w={206} h={4} style={{ marginTop: u(4) }} />
        <Bar w={164} h={4} />
        <Bar w={118} h={4} />
        <span style={{ ...accentPill, marginTop: u(6) }}>Mulai gratis</span>
      </div>

      <div style={strip}>
        {["Balasan instan", "Katalog", "Handoff"].map((label) => (
          <div key={label} style={tile}>
            <span
              style={{
                width: u(14),
                height: u(14),
                borderRadius: u(5),
                background: subtle,
                opacity: 0.5,
              }}
            />
            <span style={{ fontSize: u(9.5), fontWeight: 600, whiteSpace: "nowrap" }}>{label}</span>
            <Bar w="82%" h={4} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CompanyShot() {
  return (
    <div style={page}>
      <div style={navRow}>
        <Bar w={38} h={7} ink />
        <div style={{ display: "flex", gap: u(10) }}>
          <Bar w={20} h={4} />
          <Bar w={24} h={4} />
          <Bar w={16} h={4} />
        </div>
        <span style={chip}>ID / EN</span>
      </div>

      <div
        style={{
          ...middle,
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          alignItems: "center",
          justifyItems: "stretch",
          gap: u(14),
        }}
      >
        <div
          style={{
            display: "grid",
            justifyItems: "center",
            gap: u(8),
            padding: u(12),
            borderRadius: u(10),
            boxShadow: `inset 0 0 0 1px ${line}`,
            background: block,
          }}
        >
          <div style={{ display: "flex", gap: u(6) }}>
            {[0, 1, 2].map((seat) => (
              <span
                key={seat}
                style={{
                  width: u(20),
                  height: u(20),
                  borderRadius: 999,
                  background: subtle,
                  opacity: 0.45,
                }}
              />
            ))}
          </div>
          <Bar w="70%" h={6} ink />
          <Bar w="46%" h={4} />
        </div>

        <div style={{ display: "grid", justifyItems: "start", alignContent: "center", gap: u(6) }}>
          <Bar w="92%" h={10} ink />
          <Bar w="64%" h={10} ink />
          <Bar w="100%" h={4} style={{ marginTop: u(3) }} />
          <Bar w="94%" h={4} />
          <Bar w="86%" h={4} />
          <Bar w="58%" h={4} />
          <span style={{ ...accentPill, marginTop: u(5) }}>Hubungi kami</span>
        </div>
      </div>

      <div style={strip}>
        {[
          ["2019", "Berdiri"],
          ["48", "Klien"],
          ["12", "Kota"],
        ].map(([value, label]) => (
          <div key={label} style={tile}>
            <span style={{ fontSize: u(12), fontWeight: 600 }}>{value}</span>
            <span style={{ fontSize: u(9.5), color: muted }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkflowShot() {
  const rows = [
    { name: "Pembelian stok gudang", meta: "Rp 12,4 jt · Budi", state: "Menunggu", tone: warning },
    { name: "Diskon distributor", meta: "12% · Rina", state: "Disetujui", tone: success },
    { name: "Pengiriman luar kota", meta: "3 truk · Andi", state: "Ditolak", tone: danger },
    {
      name: "Perpanjangan kontrak vendor",
      meta: "Rp 4,8 jt · Sari",
      state: "Menunggu",
      tone: warning,
    },
  ];

  return (
    <div style={page}>
      <div style={navRow}>
        <span style={{ display: "flex", alignItems: "center", gap: u(9), minWidth: 0 }}>
          <Bar w={34} h={7} ink />
          <span style={{ width: u(1), height: u(12), background: line, flex: "none" }} />
          <span style={{ fontSize: u(11), fontWeight: 600, letterSpacing: "-0.02em" }}>
            Approval pembelian
          </span>
        </span>
        <span style={accentPill}>Setujui</span>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridAutoRows: "minmax(0, 1fr)",
          gap: u(7),
        }}
      >
        {rows.map((row) => (
          <div
            key={row.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: u(8),
              padding: `0 ${u(10)}`,
              borderRadius: u(8),
              boxShadow: `inset 0 0 0 1px ${line}`,
              background: block,
            }}
          >
            <span
              style={{
                flex: "none",
                width: u(6),
                height: u(6),
                borderRadius: 999,
                background: row.tone,
              }}
            />
            <span style={{ display: "grid", gap: u(3), minWidth: 0 }}>
              <span style={{ fontSize: u(10.5), fontWeight: 600, whiteSpace: "nowrap" }}>
                {row.name}
              </span>
              <span style={{ fontSize: u(9.5), color: muted, whiteSpace: "nowrap" }}>
                {row.meta}
              </span>
            </span>
            <span
              style={{
                marginLeft: "auto",
                flex: "none",
                padding: `${u(2)} ${u(7)}`,
                borderRadius: 999,
                boxShadow: `inset 0 0 0 1px ${row.tone}`,
                color: row.tone,
                fontSize: u(9.5),
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {row.state}
            </span>
          </div>
        ))}
      </div>

      <div style={note}>
        <span
          style={{ width: u(5), height: u(5), borderRadius: 999, background: subtle, flex: "none" }}
        />
        <span style={{ fontSize: u(9.5), color: muted }}>
          Anggaran dicek otomatis sebelum diteruskan ke manajer
        </span>
      </div>
    </div>
  );
}

export default function Demo() {
  const [showThirdShot, setShowThirdShot] = useState(true);

  return (
    <div style={{ display: "grid", gap: 20, width: "100%", maxWidth: 1152 }}>
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          justifySelf: "end",
          color: "var(--text-muted, #6f625a)",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={!showThirdShot}
          onChange={(event) => setShowThirdShot(!event.target.checked)}
          style={{ accentColor: "var(--accent, #c2410c)", width: 15, height: 15 }}
        />
        Tampilkan Custom Workflow tanpa shot
      </label>

      <ServiceRow
        chip="Landing Page"
        title="Landing page yang menjelaskan produk Anda dalam satu layar."
        tags={["Responsive", "SEO-ready", "Analytics", "Custom Domain"]}
        cta={{ label: "Lihat contoh landing page", href: "#landing-page" }}
        shot={<LandingShot />}
      />

      <ServiceRow
        chip="Company Profile"
        title="Company profile yang membuat bisnis Anda terlihat kredibel."
        tags={["Multi-page", "CMS", "Responsive", "SEO-ready"]}
        cta={{ label: "Lihat contoh company profile", href: "#company-profile" }}
        shot={<CompanyShot />}
        flip
      />

      <ServiceRow
        chip="Custom Workflow"
        title="Alur kerja internal yang mengikuti cara tim Anda bekerja."
        tags={["Approval", "Inventory", "CRM", "Reporting", "Internal Tools"]}
        cta={{ label: "Diskusikan alur kerja Anda", href: "#custom-workflow" }}
        shot={showThirdShot ? <WorkflowShot /> : undefined}
      />
    </div>
  );
}