"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/*
 * Tilt Card – a card that leans towards the pointer in 3D, in a single self-contained file.
 *
 * A pointer move is clamped to the card and kept as a fraction of its box; one
 * requestAnimationFrame writes the four variables the sheet reads – --rx/--ry for the rotation,
 * --gx/--gy for the point the glare sits on – so a frame only ever changes transform and
 * opacity. Pointing at the card adds data-active, which the sheet answers with the lift, the
 * deeper shadow and the glare's fade-in; leaving drops the variables again and the card springs
 * home on its 700ms overshoot curve. The side under the pointer comes towards the viewer, so
 * the card reads as a physical object being pressed. Touch pointers never tilt, and under
 * reduced motion the shadow still changes while the rotation is left to the sheet.
 */

export type TiltCardProps = {
  /** The card's content – it fills the tilting surface */
  children: ReactNode;
  /** Maximum tilt in degrees at the very edge of the card */
  maxTilt?: number;
  /** Show a soft glare that follows the pointer */
  glare?: boolean;
  /** Scale while the pointer is over the card */
  scale?: number;
  /** Perspective distance in px – smaller is more dramatic */
  perspective?: number;
  /** Extra class on the wrapper; set --ui-tlt-radius to match your card's corners */
  className?: string;
};

export function TiltCard({
  children,
  maxTilt = 10,
  glare = true,
  scale = 1.02,
  perspective = 900,
  className,
}: TiltCardProps) {
  const card = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const surface = card.current;
    if (!surface) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    // Where the pointer sits on the card, 0…1 on each axis, waiting for the next frame to paint it.
    let point: { x: number; y: number } | null = null;

    const paint = () => {
      frame = 0;
      if (!point) return;
      // The side under the pointer lifts towards the viewer: below centre the bottom edge comes
      // forward, right of centre the right edge comes forward.
      const rx = `${((point.y - 0.5) * 2 * maxTilt).toFixed(2)}deg`;
      const ry = `${((0.5 - point.x) * 2 * maxTilt).toFixed(2)}deg`;
      const gx = `${(point.x * 100).toFixed(2)}%`;
      const gy = `${(point.y * 100).toFixed(2)}%`;
      // --rx/--ry/--gx/--gy are the names the sheet's transform and glare read; the --ui-tlt-*
      // spellings are the documented aliases, kept in step so either can be styled against.
      surface.style.setProperty("--rx", rx);
      surface.style.setProperty("--ry", ry);
      surface.style.setProperty("--gx", gx);
      surface.style.setProperty("--gy", gy);
      surface.style.setProperty("--ui-tlt-rx", rx);
      surface.style.setProperty("--ui-tlt-ry", ry);
      surface.style.setProperty("--ui-tlt-gx", gx);
      surface.style.setProperty("--ui-tlt-gy", gy);
    };

    const rest = () => {
      point = null;
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      surface.removeAttribute("data-active");
      // Handing the properties back lets the sheet's own 0deg / 50% 50% be the target, so the
      // 700ms spring interpolates the transform home instead of jumping.
      for (const name of TILT_VARS) surface.style.removeProperty(name);
    };

    const enter = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      surface.setAttribute("data-active", "");
    };

    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      // A pointer that arrives without an enter – a captured drag, a synthetic move – still lifts.
      if (!surface.hasAttribute("data-active")) surface.setAttribute("data-active", "");
      if (reduced.matches) return;
      const box = surface.getBoundingClientRect();
      if (!box.width || !box.height) return;
      point = {
        x: Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)),
        y: Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)),
      };
      if (!frame) frame = requestAnimationFrame(paint);
    };

    surface.addEventListener("pointerenter", enter);
    surface.addEventListener("pointermove", move);
    surface.addEventListener("pointerleave", rest);
    surface.addEventListener("pointercancel", rest);

    return () => {
      surface.removeEventListener("pointerenter", enter);
      surface.removeEventListener("pointermove", move);
      surface.removeEventListener("pointerleave", rest);
      surface.removeEventListener("pointercancel", rest);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [maxTilt]);

  // Perspective has no fallback in the sheet, so both are always written; the wrapper carries
  // them because the card's own [data-active] rule reads --ui-tlt-scale from up here.
  const style = {
    "--ui-tlt-perspective": `${perspective}px`,
    "--ui-tlt-scale": `${scale}`,
  } as CSSProperties;

  return (
    <div className={["ui-tlt", className].filter(Boolean).join(" ")} style={style}>
      {/* React 19 hoists this into <head> once, no matter how many cards render */}
      <style href="ui-tilt-card" precedence="default">
        {css}
      </style>

      <div ref={card} className="ui-tlt-card">
        {children}
        {glare ? <span className="ui-tlt-glare" aria-hidden="true" /> : null}
      </div>
    </div>
  );
}

/** Everything the pointer writes, in the sheet's spelling and the documented aliases. */
const TILT_VARS = [
  "--rx",
  "--ry",
  "--gx",
  "--gy",
  "--ui-tlt-rx",
  "--ui-tlt-ry",
  "--ui-tlt-gx",
  "--ui-tlt-gy",
] as const;

const css = /* css */ `
.ui-tlt{--ui-tlt-radius: 20px;--ui-tlt-shadow: 0 1px 2px rgba(11, 9, 8, 0.06), 0 8px 24px -12px rgba(11, 9, 8, 0.18);--ui-tlt-shadow-active: 0 2px 4px rgba(11, 9, 8, 0.05), 0 24px 48px -16px rgba(11, 9, 8, 0.3);--ui-tlt-glare-color: rgba(255, 253, 251, 0.32);--ui-tlt-spring: cubic-bezier(0.34, 1.36, 0.64, 1);display: inline-block;perspective: var(--ui-tlt-perspective)}
.ui-tlt-card{--rx: 0deg;--ry: 0deg;--gx: 50%;--gy: 50%;--ui-tlt-lift: 0px;--ui-tlt-s: 1;position: relative;overflow: hidden;border-radius: var(--ui-tlt-radius);box-shadow: var(--ui-tlt-shadow);transform: translateY(var(--ui-tlt-lift)) rotateX(var(--rx)) rotateY(var(--ry)) scale(var(--ui-tlt-s));transition: transform var(--nm-dur-5, 620ms) var(--ui-tlt-spring), box-shadow var(--nm-dur-5, 620ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));will-change: transform}
.ui-tlt-card[data-active]{--ui-tlt-s: var(--ui-tlt-scale);--ui-tlt-lift: -2px;box-shadow: var(--ui-tlt-shadow-active);transition: transform var(--nm-dur-2, 160ms) ease-out, box-shadow var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-tlt:has(:focus-visible) .ui-tlt-card{--ui-tlt-lift: -4px;box-shadow: var(--ui-tlt-shadow-active)}
.ui-tlt-glare{position: absolute;inset: 0;z-index: 1;border-radius: inherit;pointer-events: none;background: radial-gradient(circle at var(--gx) var(--gy), var(--ui-tlt-glare-color), transparent 55%);mix-blend-mode: soft-light;opacity: 0;transition: opacity var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-tlt-card[data-active] .ui-tlt-glare{opacity: 1}
@media (hover: none), (pointer: coarse){.ui-tlt-card[data-active]{--ui-tlt-s: 1}
}
@media (prefers-reduced-motion: reduce){.ui-tlt-card, .ui-tlt-card[data-active], .ui-tlt:has(:focus-visible) .ui-tlt-card{transform: none;transition: box-shadow 300ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-tlt-glare{display: none}
}
:where(.dark, [data-theme="dark"]) .ui-tlt{--ui-tlt-shadow: 0 1px 2px rgba(11, 9, 8, 0.4), 0 8px 24px -12px rgba(11, 9, 8, 0.6);--ui-tlt-shadow-active: 0 2px 4px rgba(11, 9, 8, 0.4), 0 28px 56px -16px rgba(11, 9, 8, 0.75);--ui-tlt-glare-color: rgba(255, 253, 251, 0.24)}

`;
