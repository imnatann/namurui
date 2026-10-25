import { useState } from "react";
import { PortfolioMarquee, type WorkItem } from "../portfolio-marquee";

/*
 * The demo draws each preview as plain markup rather than an image, because a skeleton of bars is
 * what a real screenshot looks like at 280px and it keeps the gallery free of binary assets.
 */

/* The skeletons are drawn from the theme, never from a palette of their own: the shot ground is
 * the page behind the browser, the page itself is a card, and every bar is a border or a muted
 * fill. One ember element per variant, so the accent still marks the live thing. */
const ground = "var(--bg, #faf7f4)";
const page = "var(--card, #ffffff)";
const raised = "var(--preview, #fdfaf7)";
const edge = "var(--border-soft, #1a14101a)";
const rule = "var(--border, #e8e0d7)";
const faint = "var(--muted-bg, #7a4a1c0a)";
const bar = "color-mix(in srgb, var(--text-subtle, #1a141099) 46%, transparent)";
const ember = "var(--accent, #c2410c)";

function Shot({ variant }: { variant: "landing" | "profile" | "workflow" }) {
  return (
    <div style={{ display: "flex", height: "100%", padding: 12, background: ground }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: "1 1 auto",
          minWidth: 0,
          gap: 8,
          padding: 10,
          overflow: "hidden",
          borderRadius: 8,
          background: page,
          boxShadow: `inset 0 0 0 1px ${edge}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 4, background: bar }} />
          <span style={{ width: 34, height: 4, borderRadius: 2, background: rule }} />
          <span style={{ marginLeft: "auto", width: 40, height: 10, borderRadius: 999, background: faint }} />
        </div>

        {variant === "landing" ? (
          <div style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0, gap: 6 }}>
            <div style={{ display: "grid", gap: 5, marginTop: 2 }}>
              <span style={{ width: "72%", height: 9, borderRadius: 3, background: bar }} />
              <span style={{ width: "52%", height: 9, borderRadius: 3, background: bar }} />
              <span style={{ width: "78%", height: 4, borderRadius: 2, background: rule, marginTop: 2 }} />
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
              <span style={{ width: 58, height: 14, borderRadius: 999, background: ember }} />
              <span style={{ width: 46, height: 14, borderRadius: 999, background: faint }} />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                flex: "1 1 auto",
                minHeight: 0,
                marginTop: 2,
              }}
            >
              {[0, 1].map((key) => (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    padding: 7,
                    minHeight: 0,
                    borderRadius: 7,
                    background: raised,
                    boxShadow: `inset 0 0 0 1px ${edge}`,
                  }}
                >
                  <span style={{ flex: "1 1 auto", minHeight: 12, borderRadius: 5, background: faint }} />
                  <span style={{ width: "70%", height: 4, borderRadius: 2, background: rule }} />
                  <span style={{ width: "90%", height: 3, borderRadius: 2, background: faint }} />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {variant === "profile" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.9fr",
              gap: 10,
              flex: "1 1 auto",
              minHeight: 0,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
              <span style={{ width: 18, height: 18, borderRadius: 6, background: faint }} />
              {[66, 54, 60, 48].map((width, key) => (
                <span
                  key={key}
                  style={{ width: `${width}%`, height: 4, borderRadius: 2, background: key === 0 ? ember : rule }}
                />
              ))}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 6,
                  flex: "1 1 auto",
                  minHeight: 0,
                  marginTop: 2,
                  padding: "0 7px",
                  borderRadius: 7,
                  background: raised,
                  boxShadow: `inset 0 0 0 1px ${edge}`,
                }}
              >
                {[80, 62, 70].map((width, key) => (
                  <span key={key} style={{ width: `${width}%`, height: 3, borderRadius: 2, background: faint }} />
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, minHeight: 0 }}>
              <span style={{ width: "60%", height: 8, borderRadius: 3, background: bar }} />
              {[92, 84, 88, 64].map((width, key) => (
                <span key={key} style={{ width: `${width}%`, height: 4, borderRadius: 2, background: rule }} />
              ))}
              <div style={{ display: "flex", gap: 6, flex: "1 1 auto", minHeight: 0, marginTop: 2 }}>
                <span
                  style={{ flex: 1, borderRadius: 7, background: raised, boxShadow: `inset 0 0 0 1px ${edge}` }}
                />
                <span
                  style={{ flex: 1, borderRadius: 7, background: raised, boxShadow: `inset 0 0 0 1px ${edge}` }}
                />
              </div>
            </div>
          </div>
        ) : null}

        {variant === "workflow" ? (
          <div style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0, gap: 6 }}>
            <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
              <span style={{ width: 50, height: 13, borderRadius: 999, background: ember }} />
              <span style={{ width: 50, height: 13, borderRadius: 999, background: faint }} />
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: "1 1 auto",
                minHeight: 0,
                gap: 6,
                marginTop: 2,
              }}
            >
              {[0, 1, 2].map((key) => (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flex: "1 1 auto",
                    minHeight: 0,
                    padding: "0 8px",
                    borderRadius: 7,
                    background: raised,
                    boxShadow: `inset 0 0 0 1px ${edge}`,
                  }}
                >
                  <span style={{ width: 14, height: 14, borderRadius: 4, background: faint }} />
                  <span style={{ flex: 1, height: 4, borderRadius: 2, background: rule }} />
                  <span style={{ width: 30, height: 8, borderRadius: 999, background: faint }} />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const work: WorkItem[] = [
  { id: "senja", name: "Rumah Kopi Senja", category: "Landing page", shot: <Shot variant="landing" /> },
  { id: "arunika", name: "Arunika Dental", category: "Company profile", shot: <Shot variant="profile" /> },
  { id: "tani", name: "Gudang Tani", category: "Custom workflow", shot: <Shot variant="workflow" /> },
  { id: "pelita", name: "Sekolah Pelita", category: "Landing page", shot: <Shot variant="landing" /> },
  { id: "katering", name: "Bumi Katering", category: "Company profile", shot: <Shot variant="profile" /> },
  { id: "klinik", name: "Klinik Sehat Bersama", category: "Custom workflow", shot: <Shot variant="workflow" /> },
];

const pill = {
  height: 30,
  padding: "0 12px",
  border: 0,
  borderRadius: 999,
  background: "transparent",
  boxShadow: "inset 0 0 0 1px var(--border, #e8e0d7)",
  color: "var(--text-muted, #6f625a)",
  font: "inherit",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
} as const;

const pillOn = {
  background: "var(--accent, #c2410c)",
  boxShadow: "inset 0 0 0 1px var(--accent, #c2410c)",
  color: "var(--accent-fg, #ffffff)",
} as const;

export default function Demo() {
  const [rows, setRows] = useState<2 | 1>(2);
  const [fast, setFast] = useState(false);
  const [custom, setCustom] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const renderItem = (item: WorkItem) => (
    <button
      type="button"
      onClick={() => setPicked(item.id)}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: 0,
        border: 0,
        borderRadius: 12,
        overflow: "hidden",
        background: "var(--panel, #ffffff)",
        boxShadow:
          picked === item.id
            ? "inset 0 0 0 2px var(--accent, #c2410c)"
            : "inset 0 0 0 1px var(--border, #e8e0d7)",
        font: "inherit",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden" }}>{item.shot}</div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          boxShadow: "inset 0 1px 0 var(--border-soft, #1a14101a)",
        }}
      >
        <span
          title={item.name}
          style={{
            minWidth: 0,
            overflow: "hidden",
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--text, #1a1410)",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
        >
          {item.name}
        </span>
        <span
          style={{
            flex: "none",
            marginLeft: "auto",
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: "nowrap",
            color: picked === item.id ? "var(--accent, #c2410c)" : "var(--text-muted, #6f625a)",
          }}
        >
          {picked === item.id ? "Terpilih" : item.category}
        </span>
      </div>
    </button>
  );

  return (
    <div style={{ display: "grid", gap: 16, width: "100%" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <button type="button" onClick={() => setRows(2)} style={rows === 2 ? { ...pill, ...pillOn } : pill}>
          Dua baris
        </button>
        <button type="button" onClick={() => setRows(1)} style={rows === 1 ? { ...pill, ...pillOn } : pill}>
          Satu baris
        </button>
        <button type="button" onClick={() => setFast((on) => !on)} style={fast ? { ...pill, ...pillOn } : pill}>
          Cepat
        </button>
        <button type="button" onClick={() => setCustom((on) => !on)} style={custom ? { ...pill, ...pillOn } : pill}>
          Sel kustom
        </button>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted, #6f625a)" }}>
          {picked ? `Terpilih: ${work.find((item) => item.id === picked)?.name}` : "Arahkan kursor untuk jeda"}
        </span>
      </div>

      <PortfolioMarquee
        rows={rows}
        items={work}
        speed={fast ? 140 : 58}
        renderItem={custom ? renderItem : undefined}
      />
    </div>
  );
}
