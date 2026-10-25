import { LogoMarquee, type MarqueeLogo } from "../logo-marquee";

const logos: MarqueeLogo[] = [
  {
    name: "Fieldnote",
    color: "#1f7a5c",
    href: "#fieldnote",
    svg: (
      <svg viewBox="0 0 28 28" fill="currentColor">
        <path d="M4.5 6.2c0-1.1.9-2 2-2h6.1v19.6H6.5a2 2 0 0 1-2-2V6.2Z" opacity=".55" />
        <path d="M14.9 4.2h4.6a2 2 0 0 1 2 2v15.6a2 2 0 0 1-2 2h-4.6V4.2Z" />
        <rect x="7.4" y="8.4" width="3.6" height="1.5" rx=".75" opacity=".7" />
        <rect x="7.4" y="12.2" width="3.6" height="1.5" rx=".75" opacity=".7" />
        <rect x="17.2" y="8.4" width="3.2" height="1.5" rx=".75" opacity=".7" />
      </svg>
    ),
  },
  {
    name: "Ledgerline",
    color: "#2f6bff",
    svg: (
      <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M5 8.5h18M5 14h13M5 19.5h7.5" />
        <circle cx="21.5" cy="19.5" r="2.4" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: "Northbeam",
    color: "#c2410c",
    svg: (
      <svg viewBox="0 0 28 28" fill="currentColor">
        <path d="M14 3.5 25 24.5H17.4L14 17.8l-3.4 6.7H3L14 3.5Z" opacity=".55" />
        <path d="M14 3.5 18.7 12.6 14 17.8l-4.7-5.2L14 3.5Z" />
      </svg>
    ),
  },
  {
    name: "Cadence",
    color: "#7c4dff",
    svg: (
      <svg viewBox="0 0 28 28" fill="currentColor">
        <rect x="3.5" y="11" width="3.4" height="6" rx="1.7" />
        <rect x="8.6" y="6.5" width="3.4" height="15" rx="1.7" opacity=".55" />
        <rect x="13.7" y="2.8" width="3.4" height="22.4" rx="1.7" />
        <rect x="18.8" y="7.8" width="3.4" height="12.4" rx="1.7" opacity=".55" />
        <rect x="23.1" y="12" width="2.4" height="4" rx="1.2" opacity=".4" />
      </svg>
    ),
  },
  {
    name: "Parcelworks",
    color: "#a16207",
    svg: (
      <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M14 3.6 24 8.8v10.4L14 24.4 4 19.2V8.8L14 3.6Z" />
        <path d="M4 8.8 14 14l10-5.2M14 14v10.4" />
      </svg>
    ),
  },
  {
    name: "Tandem",
    color: "#0f766e",
    svg: (
      <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2.2">
        <circle cx="10.4" cy="14" r="6.4" />
        <circle cx="17.6" cy="14" r="6.4" opacity=".5" />
      </svg>
    ),
  },
  {
    name: "Vellum",
    color: "#8a5a44",
    svg: (
      <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M6.5 4.5h9.4l5.6 5.6v13.4H6.5V4.5Z" />
        <path d="M15.9 4.5v5.6h5.6M10 15h8M10 19h5.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Kestrel",
    color: "#b42318",
    svg: (
      <svg viewBox="0 0 28 28" fill="currentColor">
        <path d="M3 20.5c5.6 0 9.2-2.6 11.4-6.4C16.6 10.3 19.6 7 25 6.2c-2.4 3.2-3.6 6.6-4.6 9.8-1.2 4.2-4.4 6.4-9 6.4H3Z" opacity=".55" />
        <path d="M6.5 22.8c3.2-4 6.4-6.6 11.2-8.6-3.4 1.2-6.4 3.2-8.8 6.1l-2.4 2.5Z" />
      </svg>
    ),
  },
];

export default function Demo() {
  return (
    <div style={{ display: "grid", gap: 14, width: "100%" }}>
      <p
        style={{
          margin: 0,
          textAlign: "center",
          fontSize: 12.5,
          fontWeight: 500,
          letterSpacing: "0.02em",
          color: "var(--text-subtle, #8f8f8f)",
        }}
      >
        Trusted by teams at
      </p>

      <LogoMarquee logos={logos} rows={2} speed={34} labels="beside" gap={52} label="Companies using the product" />

      <p style={{ margin: 0, textAlign: "center", fontSize: 12, color: "var(--text-subtle, #a3a3a3)" }}>
        Hover or Tab into the strip — it eases to a stop. Drag it to scrub, let go to fling.
      </p>
    </div>
  );
}
