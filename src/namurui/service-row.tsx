"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/*
 * Service Row: one service explained across the full width of the page. A chip names the
 * service, then its heading, the capabilities it covers and a CTA on one side, a shot on the other.
 * The shot side flips per row, so a stack of three alternates; below lg the copy always leads so
 * a phone reader is never sent to the picture first. The row rises a few pixels into place the
 * first time it reaches the viewport, and a row without a shot gives the copy the whole width.
 * Styles are injected below, so no extra files are needed.
 */

/** One service: the chip, heading, capability tags, CTA and the shot that sits beside them */
export type ServiceItem = {
  /** Category the row is about, set in the chip */
  chip: string;
  /** Row heading */
  title: string;
  /** Capability tags under the heading */
  tags: string[];
  /** Link at the end of the copy column */
  cta: { label: string; href: string };
  /** The visual beside the copy; omit it and the copy takes the full width, centred */
  shot?: ReactNode;
  /** Puts the shot on the left from lg up; below lg the copy always comes first */
  flip?: boolean;
};

export type ServiceRowProps = ServiceItem & {
  /** Extra class merged onto the row */
  className?: string;
};

export function ServiceRow({
  chip,
  title,
  tags,
  cta,
  shot,
  flip = false,
  className,
}: ServiceRowProps) {
  const headingId = useId();
  const root = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  const hasShot = shot !== undefined && shot !== null && shot !== false;

  /* One rise per row, then the observer lets go: a row that scrolls out and back in does not
   * replay its entrance. With reduced motion asked for, the row is simply already in place and
   * no observer is installed at all. */
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (typeof window === "undefined") return;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <article
      ref={root}
      className={["ui-svr", className].filter(Boolean).join(" ")}
      aria-labelledby={headingId}
      data-flip={flip ? "true" : "false"}
      data-shot={hasShot ? "true" : "false"}
      data-shown={shown ? "true" : "false"}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-service-row" precedence="default">
        {css}
      </style>

      <div className="ui-svr__inner">
        <div className="ui-svr__copy">
          <p className="ui-svr__chip">{chip}</p>
          <h3 className="ui-svr__title" id={headingId}>
            {title}
          </h3>
          <ul className="ui-svr__tags">
            {tags.map((tag) => (
              <li className="ui-svr__tag" key={tag}>
                {tag}
              </li>
            ))}
          </ul>
          <a className="ui-svr__cta" href={cta.href}>
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path
                d="M6 3.25 10.75 8 6 12.75"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="ui-svr__cta-label">{cta.label}</span>
          </a>
        </div>

        {hasShot ? <div className="ui-svr__shot">{shot}</div> : null}
      </div>
    </article>
  );
}

const css = /* css */ `
.ui-svr {
  /* Knobs. Override any of these on .ui-svr to retheme the row in a host. */
  --ui-svr-ink: var(--text, #1a1410);
  --ui-svr-muted: var(--text-muted, #6f625a);
  --ui-svr-ground: #7a4a1c0a;
  --ui-svr-panel: var(--panel, #fffdfb);
  --ui-svr-chip: #fffdfb80;
  --ui-svr-tag: #7a4a1c0d;
  --ui-svr-line: var(--border, #e8e0d7);
  --ui-svr-edge: var(--border-soft, #1a14101a);
  --ui-svr-accent: var(--accent, #c2410c);
  --ui-svr-accent-ink: var(--accent-fg, #fffdfb);
  --ui-svr-lift: #3d1f0a1f;
  --ui-svr-dur: var(--nm-dur-4, 380ms);
  --ui-svr-dur-fast: var(--nm-dur-2, 160ms);
  --ui-svr-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));

  position: relative;
  box-sizing: border-box;
  width: 100%;
  padding: 32px 20px;
  border-radius: var(--radius-panel, 20px);
  background: var(--ui-svr-ground);
  box-shadow:
    inset 0 0 0 1px var(--ui-svr-edge),
    0 34px 64px -48px var(--ui-svr-lift);
  color: var(--ui-svr-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
  opacity: 0;
  transform: translateY(14px);
  transition:
    opacity var(--ui-svr-dur) var(--ui-svr-ease-out),
    transform var(--ui-svr-dur) var(--ui-svr-ease-out);
}
.ui-svr[data-shown="true"] {
  opacity: 1;
  transform: none;
}
.ui-svr *,
.ui-svr *::before,
.ui-svr *::after {
  box-sizing: border-box;
}

/* One column until lg, so the copy is always read before the shot ---------- */
.ui-svr__inner {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 28px;
}
/* No shot: the copy owns the row and no gap is left behind for a column that is not there. */
.ui-svr[data-shot="false"] .ui-svr__inner {
  gap: 0;
}

.ui-svr__copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}
.ui-svr[data-shot="false"] .ui-svr__copy {
  align-items: center;
  text-align: center;
}
.ui-svr[data-shot="false"] .ui-svr__tags {
  justify-content: center;
}

.ui-svr__chip {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  height: 34px;
  margin: 0;
  padding: 0 16px;
  overflow: hidden;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-svr-chip);
  box-shadow: inset 0 0 0 1px var(--ui-svr-line);
  color: var(--ui-svr-ink);
  font-size: 0.8rem;
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.01em;
  white-space: nowrap;
}
.ui-svr__title {
  margin: 16px 0 0;
  color: var(--ui-svr-ink);
  font-size: 1.55rem;
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.03em;
  text-wrap: balance;
  overflow-wrap: break-word;
}
.ui-svr__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}
.ui-svr__tags:empty {
  display: none;
}
.ui-svr__tag {
  display: inline-flex;
  align-items: center;
  margin: 0;
  padding: 3px 12px;
  border-radius: var(--radius-control, 8px);
  background: var(--ui-svr-tag);
  color: var(--ui-svr-muted);
  font-size: 0.8rem;
  font-weight: 500;
  line-height: 21px;
}

.ui-svr__cta {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  max-width: 100%;
  height: 48px;
  margin-top: 24px;
  padding: 0 22px;
  border-radius: var(--radius-panel, 20px);
  background: var(--ui-svr-accent);
  color: var(--ui-svr-accent-ink);
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.01em;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  transition:
    transform var(--ui-svr-dur-fast) var(--ui-svr-ease-out),
    box-shadow var(--ui-svr-dur-fast) var(--ui-svr-ease-out);
}
.ui-svr__cta svg {
  flex: none;
  width: 16px;
  height: 16px;
  transition: transform var(--ui-svr-dur-fast) var(--ui-svr-ease-out);
}
.ui-svr__cta-label {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-svr__cta:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 26px -16px var(--ui-svr-lift);
}
.ui-svr__cta:hover svg {
  transform: translateX(2px);
}
.ui-svr__cta:focus-visible {
  outline: 2px solid var(--ui-svr-accent);
  outline-offset: 3px;
}

/* The shot frame: the measured 508 by 350, kept at every width. It is also the query container
 * a drawn shot measures itself against, so the picture scales with the frame instead of clipping. */
.ui-svr__shot {
  position: relative;
  width: 100%;
  min-width: 0;
  aspect-ratio: 508 / 350;
  overflow: hidden;
  container-type: inline-size;
  border-radius: var(--radius-card, 16px);
  background: var(--ui-svr-panel);
  box-shadow:
    inset 0 0 0 1px var(--ui-svr-line),
    0 26px 44px -36px var(--ui-svr-lift);
}
.ui-svr__shot > img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Two columns from lg up; the shot may take the left side there ------------- */
@media (min-width: 64rem) {
  .ui-svr__inner {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 32px;
  }
  .ui-svr[data-shot="false"] .ui-svr__inner {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }
  .ui-svr[data-flip="true"] .ui-svr__copy {
    order: 2;
  }
  .ui-svr[data-flip="true"] .ui-svr__shot {
    order: 1;
  }
}

:where(.dark, [data-theme="dark"]) .ui-svr {
  --ui-svr-ink: var(--text, #f4ece4);
  --ui-svr-muted: var(--text-muted, #a2958a);
  --ui-svr-ground: #ffffff08;
  --ui-svr-panel: var(--panel, #1a1512);
  --ui-svr-chip: #ffffff10;
  --ui-svr-tag: #ffffff0d;
  --ui-svr-line: var(--border, #33291f);
  --ui-svr-edge: var(--border-soft, #ffffff12);
  --ui-svr-accent: var(--accent, #ff6b35);
  --ui-svr-accent-ink: var(--accent-fg, #1a0f08);
  --ui-svr-lift: #00000066;
}

@media (prefers-reduced-motion: reduce) {
  .ui-svr {
    opacity: 1;
    transform: none;
    transition-duration: 1ms;
  }
  .ui-svr__cta,
  .ui-svr__cta svg {
    transition-duration: 1ms;
  }
  .ui-svr__cta:hover,
  .ui-svr__cta:hover svg {
    transform: none;
  }
}
`;
