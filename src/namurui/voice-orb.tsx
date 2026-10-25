"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/*
 * Voice Orb — the face of a voice assistant.
 *
 * A sphere of dots breathes and turns while idle, swells with the voice while listening, collapses
 * into a slowly turning band while thinking and sends ripples from pole to pole while speaking.
 * The phases cross-fade dot by dot instead of switching, so the orb melts from one into the next.
 * Everything is one canvas: DPR-aware, paused off screen and in hidden tabs, stirred by the
 * pointer, and reduced to a single still frame when motion is reduced.
 */

export type VoiceOrbState = "idle" | "listening" | "thinking" | "speaking";

export type VoiceOrbProps = {
  /** What the assistant is doing — the orb melts from one shape into the next */
  state?: VoiceOrbState;
  /** Loudness from 0 to 1 while listening or speaking; omitted, it improvises a natural level */
  level?: number;
  /** Edge length of the canvas in px */
  size?: number;
  /** Dots in the sphere — raise it along with the size */
  dots?: number;
  /** The line under the orb: `false` hides it, an object relabels single states */
  label?: boolean | Partial<Record<VoiceOrbState, string>>;
  /** Makes the orb the button that starts and stops listening */
  onPress?: () => void;
  /** Dots give way to the pointer */
  interactive?: boolean;
  className?: string;
  /** Inline styles on the root — set `--ui-vo-accent` here to recolour the lit dots */
  style?: CSSProperties;
};

const LABELS: Record<VoiceOrbState, string> = {
  idle: "Tap to speak",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

/** The hidden swatch the canvas samples the accent colour from, exactly as the original shipped it */
const PROBE_STYLE: CSSProperties = { display: "none", color: "var(--ui-vo-accent)" };

const TAU = Math.PI * 2;

type Dot = {
  x: number;
  y: number;
  z: number;
  /** Where this dot lands on the collapsed ring: its distance from the middle, 0.5–1 of the radius */
  ring: number;
  /** Its longitude, which the ring keeps and slowly turns */
  angle: number;
  /** Stable 0–1 noise: every dot gets its own size, opacity and phase from it */
  grain: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Golden-spiral points on the unit sphere — evenly spread whatever the count */
function sphere(count: number): Dot[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const points: Dot[] = [];
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / Math.max(1, count - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = golden * i;
    const noise = Math.sin(i + 1) * 43758.5453123;
    points.push({
      x: Math.cos(angle) * ring,
      y,
      z: Math.sin(angle) * ring,
      // Latitudes collapse inward: the poles reach the rim, the equator stops short of the hole.
      ring: 0.5 + 0.5 * Math.abs(y) ** 0.45,
      angle: Math.atan2(Math.sin(angle) * ring, Math.cos(angle) * ring),
      grain: noise - Math.floor(noise),
    });
  }
  return points;
}

export function VoiceOrb({
  state = "idle",
  level,
  size = 220,
  dots = 560,
  label = true,
  onPress,
  interactive = true,
  className,
  style,
}: VoiceOrbProps) {
  const rootRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const pointerRef = useRef({ x: 0, y: 0, on: false });
  const drawRef = useRef<(() => void) | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const levelRef = useRef(level);
  levelRef.current = level;

  const [still, setStill] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setStill(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const points = sphere(Math.round(clamp(dots, 40, 2400)));
    const count = points.length;
    const px = new Float32Array(count);
    const py = new Float32Array(count);
    const pz = new Float32Array(count);
    const pr = new Float32Array(count);
    const pa = new Float32Array(count);
    const pl = new Uint8Array(count);
    const order = new Int32Array(count);
    for (let i = 0; i < count; i += 1) order[i] = i;

    let edge = size;
    let dpr = 1;

    // Phase weights: the sphere, the ring of thought, and the two sound-reactive layers.
    let think = 0;
    let listen = 0;
    let speak = 0;
    let levelNow = 0.5;
    let spin = 0;
    let time = 0;

    let ink = "#171717";
    let accent = "#2f6bff";
    const readColors = () => {
      ink = getComputedStyle(canvas).color || ink;
      const probe = probeRef.current;
      if (probe) accent = getComputedStyle(probe).color || accent;
    };
    readColors();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      edge = rect.width > 0 ? rect.width : size;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const backing = Math.max(1, Math.round(edge * dpr));
      if (canvas.width !== backing || canvas.height !== backing) {
        canvas.width = backing;
        canvas.height = backing;
      }
    };

    const render = () => {
      const centre = edge / 2;
      const radius = edge * 0.345;
      const dotR = Math.max(0.75, edge * 0.0056);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, edge, edge);

      const yaw = spin;
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const pitch = -0.24 + 0.05 * Math.sin(time * 0.6);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);

      const breath = 1 + Math.sin(time * 1.3) * 0.018 * (1 - think);
      const sound = listen * levelNow;
      const tilt = -0.13;
      const cosT = Math.cos(tilt);
      const sinT = Math.sin(tilt);
      const bob = Math.sin(time * 1.6) * radius * 0.008 * (1 - think);
      const ringTurn = time * 0.42;
      // The accent rides the rim: a narrow arc that drifts around the orb.
      const sweep = Math.PI * 0.86 + Math.sin(time * 0.33) * 0.4;
      const rim = (radius * 0.92) ** 2;
      const pointer = pointerRef.current;
      const reach = radius * 0.62;

      for (let i = 0; i < count; i += 1) {
        const dot = points[i];

        // Turn about the vertical, then tip the sphere towards the viewer.
        const sx = dot.x * cosY + dot.z * sinY;
        const sz = -dot.x * sinY + dot.z * cosY;
        const sy = dot.y;

        // Listening lifts the surface in a standing wave; speaking sends ripples along the
        // latitudes, so the whole sphere reads as a voice travelling pole to pole.
        let swell = 1;
        if (listen > 0.001) {
          const wave = 0.5 + 0.5 * Math.sin(sy * 3.2 + time * 4.6 + dot.grain * TAU);
          swell += listen * (0.03 + 0.14 * sound * (0.35 + wave));
        }
        if (speak > 0.001) {
          swell += speak * Math.sin(sy * 4.6 - time * 7.4 + 0.6) * (0.02 + 0.11 * levelNow);
        }

        const unit = radius * breath * swell;
        let ax = sx * unit;
        let ay = (sy * cosP - sz * sinP) * unit + bob;
        let az = sy * sinP + sz * cosP;

        if (think > 0.001) {
          // The sphere collapses onto a slowly turning band: the middle empties, the rim stays.
          const around = dot.angle + ringTurn;
          const band = radius * dot.ring * (0.975 + dot.grain * 0.05);
          const ex = Math.cos(around) * band;
          const ey = Math.sin(around) * band * 0.86;
          ax = ax * (1 - think) + (ex * cosT - ey * sinT) * think;
          ay = ay * (1 - think) + (ex * sinT + ey * cosT) * think;
          az = az * (1 - think) + dot.z * 0.9 * think;
        }

        // The pointer pushes the nearest dots aside.
        if (interactive && pointer.on) {
          const dx = ax - pointer.x;
          const dy = ay - pointer.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < reach) {
            const push = ((1 - distance / reach) ** 2 * radius * 0.34) / Math.max(distance, 0.001);
            ax += dx * push;
            ay += dy * push;
          }
        }

        const near = (az + 1) * 0.5;
        const lit = ax * ax + ay * ay > rim && near > 0.34 && Math.cos(Math.atan2(ay, ax) - sweep) > 0.9;
        let alpha = (0.1 + 0.8 * near ** 1.7) * (0.78 + dot.grain * 0.34);
        let r = dotR * (0.55 + near) * (0.85 + dot.grain * 0.3);

        if (think > 0.001) {
          alpha = alpha * (1 - think) + (0.4 + near * 0.52) * think;
          r *= 1 + think * 0.2;
        }
        if (lit) {
          alpha = Math.min(1, alpha + 0.22);
          r *= 1.14;
        }

        px[i] = centre + ax;
        py[i] = centre + ay;
        pz[i] = az;
        pr[i] = r;
        pa[i] = alpha;
        pl[i] = lit ? 1 : 0;
      }

      // Painter's order: the far side of the sphere first.
      order.sort((a, b) => pz[a] - pz[b]);

      let paint = "";
      for (let k = 0; k < count; k += 1) {
        const i = order[k];
        const colour = pl[i] ? accent : ink;
        if (colour !== paint) {
          ctx.fillStyle = colour;
          paint = colour;
        }
        ctx.globalAlpha = pa[i];
        ctx.beginPath();
        ctx.arc(px[i], py[i], pr[i], 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    // Reduced motion: one still frame that already shows the state's own shape.
    const drawStill = () => {
      think = stateRef.current === "thinking" ? 1 : 0;
      listen = stateRef.current === "listening" ? 1 : 0;
      speak = stateRef.current === "speaking" ? 1 : 0;
      levelNow = levelRef.current === undefined ? 0.6 : clamp(levelRef.current, 0, 1);
      time = 1.35;
      spin = 0.9;
      render();
    };
    drawRef.current = drawStill;

    let frameId = 0;
    let last = 0;

    const frame = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      time += dt;

      const current = stateRef.current;
      think += ((current === "thinking" ? 1 : 0) - think) * (1 - Math.exp(-dt / 0.26));
      listen += ((current === "listening" ? 1 : 0) - listen) * (1 - Math.exp(-dt / 0.14));
      speak += ((current === "speaking" ? 1 : 0) - speak) * (1 - Math.exp(-dt / 0.18));
      spin += dt * (0.3 + think * 1.6 + listen * 0.25 + speak * 0.12);

      const asked = levelRef.current;
      // With no level supplied the orb improvises one that never sits still.
      const wanted =
        asked !== undefined
          ? clamp(asked, 0, 1)
          : current === "thinking"
            ? 0.18
            : clamp(
                0.58 +
                  0.24 * Math.sin(time * (current === "speaking" ? 3.1 : 2.2)) +
                  0.15 * Math.sin(time * (current === "speaking" ? 7.4 : 5.3) + 1.3),
                0.05,
                0.98,
              );
      levelNow += (wanted - levelNow) * (1 - Math.exp(-dt / 0.08));

      render();
      frameId = requestAnimationFrame(frame);
    };

    let onScreen = true;
    const start = () => {
      if (frameId || still) return;
      last = 0;
      frameId = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
      last = 0;
    };
    const sync = () => {
      if (onScreen && !document.hidden) start();
      else stop();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        sync();
      },
      { rootMargin: "80px" },
    );
    observer.observe(root);

    const onVisibility = () => sync();
    document.addEventListener("visibilitychange", onVisibility);

    const onMove = (event: PointerEvent) => {
      if (!interactive) return;
      const rect = canvas.getBoundingClientRect();
      const unit = edge / Math.max(1, rect.width);
      pointerRef.current = {
        x: (event.clientX - rect.left) * unit - edge / 2,
        y: (event.clientY - rect.top) * unit - edge / 2,
        on: true,
      };
      if (still) render();
    };
    const onLeave = () => {
      pointerRef.current.on = false;
      if (still) render();
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (still) drawStill();
    });
    resizeObserver.observe(canvas);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    const palette = new MutationObserver(() => {
      readColors();
      if (still) render();
    });
    palette.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
    palette.observe(root, { attributes: true, attributeFilter: ["class", "style", "data-state"] });

    resize();

    if (still) drawStill();
    else sync();

    return () => {
      stop();
      drawRef.current = null;
      observer.disconnect();
      resizeObserver.disconnect();
      palette.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [dots, size, interactive, still]);

  // With motion reduced nothing runs, so a state change paints its own still frame.
  useEffect(() => {
    if (still) drawRef.current?.();
  }, [state, level, still]);

  const text =
    label === false ? "" : typeof label === "object" ? (label[state] ?? LABELS[state]) : LABELS[state];

  const rootStyle = { ...style, "--ui-vo-size": `${size}px` } as CSSProperties;

  return (
    <button
      ref={rootRef}
      type="button"
      className={["ui-vo", className].filter(Boolean).join(" ")}
      data-state={state}
      style={rootStyle}
      onClick={onPress}
      aria-label={text ? undefined : "Voice orb"}
    >
      {/* React 19 hoists this into <head> once, no matter how many orbs render */}
      <style href="ui-voice-orb" precedence="default">
        {css}
      </style>
      <canvas ref={canvasRef} className="ui-vo__canvas" aria-hidden="true" width={size} height={size} />
      {text ? (
        <span className="ui-vo__label" aria-live="polite">
          <span key={text}>
            {text}
            {state === "idle" ? null : (
              <span className="ui-vo__dots">
                <i />
                <i />
                <i />
              </span>
            )}
          </span>
        </span>
      ) : null}
      <span ref={probeRef} style={PROBE_STYLE} />
    </button>
  );
}

/* ---------- Styles ---------- */

const css = /* css */ `
.ui-vo{--ui-vo-ink: #1c1713;--ui-vo-muted: #857567;--ui-vo-accent: #ff6b35;--ui-vo-focus: rgba(28, 23, 19, 0.22);display: inline-grid;justify-items: center;gap: 2px;margin: 0;padding: 0;border: 0;background: none;font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;color: var(--ui-vo-ink);-webkit-font-smoothing: antialiased;-webkit-tap-highlight-color: transparent}
button.ui-vo{border-radius: 24px;cursor: pointer}
button.ui-vo:focus-visible{outline: 2px solid var(--ui-vo-focus);outline-offset: 4px}
.ui-vo__canvas{display: block;width: var(--ui-vo-size);height: var(--ui-vo-size);color: var(--ui-vo-ink);transition: transform var(--nm-dur-5, 620ms) cubic-bezier(0.32, 0.72, 0.24, 1)}
button.ui-vo:active .ui-vo__canvas{transform: scale(0.97)}
.ui-vo__label{height: 20px;overflow: hidden;font-size: 13px;font-weight: 500;line-height: 20px;color: var(--ui-vo-muted);white-space: nowrap}
.ui-vo__label > span{display: inline-flex;align-items: baseline;gap: 1px;animation: ui-vo-in var(--nm-dur-4, 380ms) cubic-bezier(0.32, 0.72, 0.24, 1) both}
.ui-vo[data-state="listening"] .ui-vo__label, .ui-vo[data-state="speaking"] .ui-vo__label{color: var(--ui-vo-ink)}
.ui-vo__dots{display: inline-flex;gap: 2px;margin-left: 2px}
.ui-vo__dots i{width: 2.5px;height: 2.5px;border-radius: 50%;background: currentColor;animation: ui-vo-blink var(--nm-dur-6, 1100ms) ease-in-out infinite}
.ui-vo__dots i:nth-child(2){animation-delay: 0.16s}
.ui-vo__dots i:nth-child(3){animation-delay: 0.32s}
@keyframes ui-vo-in{from{opacity: 0;transform: translateY(5px);filter: blur(3px)}
}
@keyframes ui-vo-blink{0%, 100%{opacity: 0.25}
40%{opacity: 1}
}
@media (prefers-reduced-motion: reduce){.ui-vo *, .ui-vo *::before, .ui-vo *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-vo{--ui-vo-ink: #ebe3da;--ui-vo-muted: #847467;--ui-vo-accent: #ff8a5c;--ui-vo-focus: rgba(255, 253, 251, 0.3)}

`;
