import type { CSSProperties } from "react";
import { TeamInvite, type TeamInviteAvatar } from "../team-invite";

/** Small illustrated portraits, inlined so the demo renders without any assets */
function portrait(from: string, to: string) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>` +
    `</linearGradient></defs>` +
    `<rect width="96" height="96" fill="url(#g)"/>` +
    `<circle cx="48" cy="37" r="16.5" fill="#fff" fill-opacity="0.92"/>` +
    `<path d="M17 96c2.4-19.6 15-30 31-30s28.6 10.4 31 30Z" fill="#fff" fill-opacity="0.92"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const avatars: [TeamInviteAvatar, TeamInviteAvatar, TeamInviteAvatar] = [
  { src: portrait("#F7B267", "#E4572E"), name: "Maya" },
  { src: portrait("#7FB2FF", "#2F5BEA"), name: "Finn" },
  { src: portrait("#B3A4FF", "#6C4AE0"), name: "Lea" },
];

export default function Demo() {
  return (
    <article style={{ display: "grid", gap: 12, width: "min(100%, 460px)" }}>
      <TeamInvite avatars={avatars} />

      <div style={{ display: "grid", gap: 7 }}>
        <h3 style={title}>Invite your team</h3>
        <p style={body}>
          Maya and Finn are already connected. Watch Lea drop into the open seat — the dashed line turns solid and she
          is online.
        </p>
      </div>

      <div style={seats}>
        <span style={dot} aria-hidden="true" />
        3 of 5 seats filled
      </div>
    </article>
  );
}

const title: CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 600,
  letterSpacing: "-0.025em",
  lineHeight: 1.25,
};

const body: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.55,
  opacity: 0.62,
};

const seats: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  alignSelf: "start",
  padding: "5px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 500,
  background: "color-mix(in srgb, currentColor 5%, transparent)",
  boxShadow: "inset 0 0 0 1px color-mix(in srgb, currentColor 9%, transparent)",
};

const dot: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 999,
  background: "#34c46a",
};
