import { useState, type CSSProperties } from "react";
import { ImageViewer, type ImageViewerImage } from "../image-viewer";

/* Three captures a run hands back, drawn inline as SVG so the demo needs no files and no
 * network. Every colour is the Ember palette, so the lightbox is judged against real content. */
const shot = (draw: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 540" width="880" height="540" font-family="ui-monospace, Menlo, monospace">${draw}</svg>`,
  )}`;

const TERMINAL = shot(`
  <rect width="880" height="540" fill="#14100d"/><rect width="880" height="44" fill="#1a1512"/>
  <circle cx="26" cy="22" r="5" fill="#e2544a"/><circle cx="46" cy="22" r="5" fill="#d99530"/><circle cx="66" cy="22" r="5" fill="#4f9d6e"/>
  <text x="92" y="27" font-size="13" fill="#a2958a">omp · session 4f21 · ~/affectui</text>
  <g font-size="15">
    <text x="28" y="96" fill="#ff6b35">$ omp run --trace "fix the flaky auth test"</text>
    <text x="28" y="132" fill="#a2958a">turn 1  read    src/auth/session.test.ts</text>
    <text x="28" y="164" fill="#a2958a">turn 2  grep    refreshToken</text>
    <text x="28" y="196" fill="#a2958a">turn 3  edit    src/auth/session.ts</text>
    <text x="28" y="228" fill="#f4ece4">turn 4  bash    npm test -- auth</text>
    <text x="28" y="264" fill="#4f9d6e">✓ 42 passing · 0 failing · 3.8s</text>
    <text x="28" y="300" fill="#a2958a">turn 5  edit    src/auth/session.test.ts</text>
    <text x="28" y="336" fill="#f4ece4">turn 6  bash    npm test -- auth</text>
    <text x="28" y="372" fill="#4f9d6e">✓ 43 passing · 0 failing · 3.6s</text>
  </g>
  <rect x="24" y="416" width="832" height="1" fill="#26201a"/>
  <text x="28" y="452" font-size="13" fill="#a2958a">done in 48s · 61.2k tokens · 2 files changed</text>
`);

const DIFF = shot(`
  <rect width="880" height="540" fill="#14100d"/><rect width="880" height="44" fill="#1a1512"/>
  <text x="24" y="27" font-size="13" fill="#a2958a">src/auth/session.ts · +12 −4</text>
  <g font-size="14">
    <text x="24" y="92" fill="#6f625a">31</text><text x="76" y="92" fill="#a2958a">export async function refresh(token: string) {</text>
    <text x="24" y="124" fill="#6f625a">32</text><text x="76" y="124" fill="#e2544a">−  const res = await fetch(endpoint, { method: "POST" });</text>
    <text x="24" y="156" fill="#6f625a">32</text><text x="76" y="156" fill="#4f9d6e">+  const res = await fetch(endpoint, {</text>
    <text x="76" y="188" fill="#4f9d6e">+    method: "POST",</text>
    <text x="76" y="220" fill="#4f9d6e">+    signal: AbortSignal.timeout(5_000),</text>
    <text x="76" y="252" fill="#4f9d6e">+  });</text>
    <text x="24" y="284" fill="#6f625a">33</text><text x="76" y="284" fill="#a2958a">  if (!res.ok) throw new AuthError(res.status);</text>
    <text x="24" y="316" fill="#6f625a">34</text><text x="76" y="316" fill="#e2544a">−  return res.json();</text>
    <text x="24" y="348" fill="#6f625a">34</text><text x="76" y="348" fill="#4f9d6e">+  const body: unknown = await res.json();</text>
    <text x="76" y="380" fill="#4f9d6e">+  return Token.parse(body);</text>
  </g>
`);

const SPEND = shot(`
  <rect width="880" height="540" fill="#14100d"/><rect width="880" height="44" fill="#1a1512"/>
  <text x="24" y="27" font-size="13" fill="#a2958a">token spend by turn · ceiling 80k</text>
  <g fill="#ff6b35">
    <rect x="48" y="330" width="52" height="110" rx="4"/><rect x="132" y="284" width="52" height="156" rx="4"/><rect x="216" y="252" width="52" height="188" rx="4"/><rect x="300" y="296" width="52" height="144" rx="4"/>
    <rect x="384" y="212" width="52" height="228" rx="4"/><rect x="468" y="176" width="52" height="264" rx="4"/><rect x="552" y="238" width="52" height="202" rx="4"/><rect x="636" y="146" width="52" height="294" rx="4"/>
  </g>
  <rect x="720" y="98" width="52" height="342" rx="4" fill="#8f7f70"/>
  <rect x="48" y="74" width="784" height="1" fill="#e2544a" opacity="0.7"/>
  <text x="694" y="66" font-size="12" fill="#e2544a">ceiling</text>
  <g font-size="12" fill="#a2958a">
    <text x="58" y="472">t1</text><text x="142" y="472">t2</text><text x="226" y="472">t3</text><text x="310" y="472">t4</text>
    <text x="394" y="472">t5</text><text x="478" y="472">t6</text><text x="562" y="472">t7</text><text x="646" y="472">t8</text>
    <text x="722" y="472">cache</text>
  </g>
  <text x="48" y="512" font-size="13" fill="#f4ece4">73.4k spent · 6.6k left · pacing over</text>
`);

const IMAGES: ImageViewerImage[] = [
  { src: TERMINAL, alt: "Terminal pane listing six tool calls and two passing test runs", caption: "Turn-by-turn trace for session 4f21, captured when the run finished." },
  { src: DIFF, alt: "Diff of src/auth/session.ts adding a request timeout and response parsing", caption: "The edit that fixed the flaky test: a five second timeout and a parsed token." },
  { src: SPEND, alt: "Bar chart of token spend across eight turns against an eighty thousand ceiling", caption: "Spend by turn. The last bar is cached reads, which cost a fifth as much." },
];

const panel: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: "16px 18px 18px",
  borderRadius: 16,
  background: "var(--panel, #fffdfb)",
  boxShadow: "inset 0 0 0 1px var(--border, #e8e0d7)",
  color: "var(--text, #1a1410)",
};

const quiet: CSSProperties = { margin: 0, fontSize: 11.5, color: "var(--text-muted, #6f625a)" };

const trigger: CSSProperties = {
  justifySelf: "start",
  height: 32,
  padding: "0 14px",
  border: 0,
  borderRadius: 999,
  background: "transparent",
  boxShadow: "inset 0 0 0 1px var(--border, #e8e0d7)",
  color: "var(--text, #1a1410)",
  font: "inherit",
  fontSize: 12.5,
  fontWeight: 500,
  cursor: "pointer",
};

export default function Demo() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={panel}>
        <p style={{ ...quiet, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Run 4f21 · 3 captures
        </p>
        <p style={{ margin: 0, fontSize: 14 }}>
          The bridge returns each image block as base64 and a MIME type, so the client can show
          it without a second request.
        </p>
        <button type="button" style={trigger} onClick={() => setOpen(true)}>
          Open the captures
        </button>
        <p style={quiet}>{IMAGES[index].caption}</p>
      </div>

      <ImageViewer
        images={IMAGES}
        open={open}
        index={index}
        onIndexChange={setIndex}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
