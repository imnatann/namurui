import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BrowserFrame } from "../browser-frame";

/* Three pages the build service sells, each one small enough to sit inside a 16 by 10 box. The
 * first frame is resizable so the ratio can be checked by hand; the address on it can be cleared
 * so the placeholder state is visible beside the real one. */

const ADDRESS = "chatrigo.id/chatrigo-build-website-service";

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
};

const controlStyle: CSSProperties = {
  height: 28,
  padding: "0 10px",
  border: 0,
  borderRadius: 8,
  background: "transparent",
  boxShadow: "inset 0 0 0 1px var(--border)",
  color: "var(--text)",
  font: "inherit",
  fontSize: 12,
  cursor: "pointer",
};

const line = (width: string, height: number, tone: number, radius = 999): CSSProperties => ({
  width,
  height,
  borderRadius: radius,
  background: "var(--text)",
  opacity: tone,
});

function SkeletonPage() {
  /* Rows keep their pixel heights and the card row takes whatever is left, so the same
   * skeleton reads as a page at 560px and at 230px without overflowing the 16 by 10 box. */
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "auto auto auto minmax(0, 1fr)",
        gap: "3.4%",
        height: "100%",
        padding: "3.6% 4%",
        overflow: "hidden",
      }}
    >
      <div style={line("clamp(44px, 16%, 86px)", 8, 0.16)} />
      <div style={{ display: "grid", gap: "2.6%" }}>
        <div style={line("68%", 20, 0.2, 6)} />
        <div style={line("84%", 7, 0.1)} />
        <div style={line("59%", 7, 0.1)} />
      </div>
      <div style={{ display: "flex", gap: "2.5%" }}>
        <div
          style={{
            width: "clamp(52px, 17%, 96px)",
            height: 26,
            borderRadius: 7,
            background: "var(--accent)",
          }}
        />
        <div
          style={{
            width: "clamp(40px, 13%, 74px)",
            height: 26,
            borderRadius: 7,
            background: "var(--text)",
            opacity: 0.1,
          }}
        />
      </div>
      {/* Three cards fill the rest of the box, so the resting frame reads as a page, not a slab */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "3%", minHeight: 0 }}>
        {[0, 1, 2].map((card) => (
          <div
            key={card}
            style={{
              display: "grid",
              gridTemplateRows: "minmax(0, 1fr) auto auto auto",
              gap: "7%",
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <div style={{ minHeight: 0, borderRadius: 6, background: "var(--text)", opacity: 0.06 }} />
            <div style={line("88%", 6, 0.12)} />
            <div style={line("96%", 6, 0.09)} />
            <div style={line("64%", 6, 0.09)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProsePage() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr) auto",
        gap: "2cqw",
        height: "100%",
        padding: "clamp(9px, 4.6cqw, 24px) clamp(10px, 5.4cqw, 26px)",
        overflow: "hidden",
        fontSize: "clamp(10px, 4.6cqw, 12.5px)",
        lineHeight: 1.62,
      }}
    >
      <div style={{ display: "grid", gap: "1.6cqw" }}>
        <p style={{ color: "var(--text)", fontWeight: 600 }}>
          Katalog, formulir, dan jalur chat di satu halaman.
        </p>
        <p style={{ color: "var(--text-muted)" }}>
          Setiap bagian ditulis pendek supaya terbaca di ponsel, dan tiap tombol menuju satu
          langkah berikutnya.
        </p>
      </div>
      {/* The body image a page like this carries; it takes whatever height is left */}
      <div
        style={{
          minHeight: 0,
          margin: "1.4cqw 0",
          overflow: "hidden",
          borderRadius: "clamp(4px, 2cqw, 8px)",
          background: "var(--text)",
          opacity: 0.07,
        }}
      />
      {/* Page furniture, so the lower half belongs to the page instead of going blank */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "2cqw",
          paddingTop: "clamp(5px, 2.2cqw, 10px)",
          borderTop: "1px solid var(--border)",
          fontSize: "clamp(9.5px, 3.4cqw, 11px)",
          color: "var(--text-muted)",
        }}
      >
        <span>Chatrigo Studio</span>
        <span style={{ color: "var(--text)" }}>Mulai dari Rp 4,5 jt</span>
      </div>
    </div>
  );
}

const ROWS = [
  ["Landing", "1", "Rp 4,5 jt"],
  ["Profil", "4", "Rp 7,2 jt"],
  ["Alur kerja", "6", "Rp 12 jt"],
  ["Toko", "3", "Rp 6,8 jt"],
];

function TablePage() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "minmax(0, 1fr) auto",
        gap: "2cqw",
        height: "100%",
        padding: "clamp(9px, 4.4cqw, 18px) clamp(10px, 4.9cqw, 20px)",
        overflow: "hidden",
      }}
    >
      <table
        style={{
          width: "100%",
          height: "100%",
          borderCollapse: "collapse",
          fontSize: "clamp(9px, 3cqw, 11.5px)",
          lineHeight: 1.35,
          color: "var(--text)",
        }}
      >
        <thead>
          <tr>
            {["Paket", "Halaman", "Harga"].map((head, index) => (
              <th
                key={head}
                scope="col"
                style={{
                  padding: "0 0 clamp(2px, 1.2cqw, 6px)",
                  borderBottom: "1px solid var(--border)",
                  color: "var(--text-muted)",
                  fontSize: "clamp(9px, 2.9cqw, 11px)",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textAlign: index === 0 ? "left" : "right",
                  textTransform: "uppercase",
                }}
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, index) => (
                <td
                  key={cell}
                  style={{
                    padding: "clamp(1px, 1.2cqw, 6px) 0",
                    borderBottom: "1px solid var(--border)",
                    textAlign: index === 0 ? "left" : "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {/* Page furniture, so the lower half belongs to the page instead of going blank */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "2cqw",
          paddingTop: "clamp(4px, 2cqw, 10px)",
          borderTop: "1px solid var(--border)",
          fontSize: "clamp(9.5px, 3.1cqw, 11px)",
          color: "var(--text-muted)",
        }}
      >
        <span>4 paket</span>
        <span style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>Rp 30,5 jt</span>
      </div>
    </div>
  );
}

export default function Demo() {
  const [width, setWidth] = useState(560);
  const [dots, setDots] = useState(true);
  const [address, setAddress] = useState<string | undefined>(ADDRESS);
  /* The readout reports the width the frame actually got, not the one the slider asked for:
   * on a narrow screen the wrapper clamps to the column and 560 would be a lie. */
  const slot = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(560);

  useEffect(() => {
    const node = slot.current;
    if (!node) return;
    /* ResizeObserver fires once on observe, so this covers the first paint too */
    const observer = new ResizeObserver(([entry]) =>
      setShown(Math.round(entry.contentRect.width)),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: 18,
        width: "100%",
        maxWidth: 820,
        margin: "0 auto",
        padding: "20px 0 32px",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)" }}>
          Frame width
          <input
            type="range"
            min={320}
            max={760}
            step={8}
            value={width}
            onChange={(event) => setWidth(Number(event.target.value))}
            aria-label="Frame width in pixels"
            style={{ width: 148, accentColor: "var(--accent)" }}
          />
        </label>
        <span style={{ fontSize: 12, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
          {shown} px
        </span>
        <button type="button" style={controlStyle} onClick={() => setDots((on) => !on)}>
          {dots ? "Hide dots" : "Show dots"}
        </button>
        <button
          type="button"
          style={controlStyle}
          onClick={() => setAddress((current) => (current ? undefined : ADDRESS))}
        >
          {address ? "Clear address" : "Set address"}
        </button>
      </div>

      <div ref={slot} style={{ display: "grid", gap: 8, width, maxWidth: "100%" }}>
        <span style={labelStyle}>Skeleton</span>
        <BrowserFrame url={address} trafficDots={dots}>
          <SkeletonPage />
        </BrowserFrame>
      </div>

      <div
        style={{
          display: "grid",
          gap: 18,
          gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <span style={labelStyle}>Paragraph</span>
          <BrowserFrame url="chatrigo.id/chatrigo-build-website-service">
            <ProsePage />
          </BrowserFrame>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <span style={labelStyle}>Table</span>
          <BrowserFrame>
            <TablePage />
          </BrowserFrame>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 12, lineHeight: "18px", color: "var(--text-muted)" }}>
        The viewport is locked to 16 by 10 and clips whatever the page puts in it, so the frame keeps
        its shape from 320 to 1920. A long address ends in an ellipsis, and a frame without one keeps
        the pill and shows a muted placeholder instead of an empty box.
      </p>
    </div>
  );
}
