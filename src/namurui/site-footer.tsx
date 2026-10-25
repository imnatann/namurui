"use client";

import { useId, type ReactNode } from "react";

/*
 * Site Footer: the closing band of a marketing page. The brand and the copyright share the top
 * line and the destinations take the full width beneath them, as a flat row or, when the host
 * supplies `groups`, as labelled columns. Links rest in muted ink and warm to full ink under the
 * pointer, the underline arrives with the colour, and a visible ring takes over for the keyboard.
 * `groups` replaces the flat row rather than adding to it; below 560px of container width the
 * parts stack. The styles are injected below, so no extra files are needed.
 */

export type FooterLink = {
  /** Link label, as it reads in the row */
  label: string;
  /** Destination */
  href: string;
};

export type FooterGroup = {
  /** Column label, set in small caps above its links */
  label: string;
  /** Links under the label */
  items: FooterLink[];
};

export type SiteFooterProps = {
  /** Brand slot; a mark and wordmark are drawn when omitted */
  brand?: ReactNode;
  /** Flat link row; not rendered when `groups` carries a column set */
  links: FooterLink[];
  /** Labelled columns, replacing the flat row */
  groups?: FooterGroup[];
  /** Copyright line */
  note?: string;
  /** Extra class on the root */
  className?: string;
};

/* Two links can share a destination, so the label is part of the key as well */
const keyOf = (link: FooterLink) => `${link.href}::${link.label}`;

export function SiteFooter({ brand, links, groups, note, className }: SiteFooterProps) {
  const uid = useId();
  /* A supplied but empty group list is the same as none: the flat row is the fallback, never both */
  const columnSet = groups !== undefined && groups.length > 0 ? groups : null;

  return (
    <footer className={["ui-sft", className].filter(Boolean).join(" ")}>
      <style href="ui-site-footer" precedence="default">
        {css}
      </style>

      <div className="ui-sft__row">
        <div className="ui-sft__brand">{brand ?? <DefaultBrand />}</div>

        {columnSet ? (
          <nav className="ui-sft__columns" aria-label="Footer">
            {columnSet.map((group, index) => {
              const labelId = `${uid}-group-${index}`;
              return (
                <div className="ui-sft__group" key={labelId}>
                  <p className="ui-sft__group-label" id={labelId}>
                    {group.label}
                  </p>
                  <ul className="ui-sft__group-list" aria-labelledby={labelId}>
                    {group.items.map((link) => (
                      <li key={keyOf(link)}>
                        <a className="ui-sft__link" href={link.href}>
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </nav>
        ) : (
          <nav className="ui-sft__links" aria-label="Footer">
            {links.map((link) => (
              <a className="ui-sft__link" href={link.href} key={keyOf(link)}>
                {link.label}
              </a>
            ))}
          </nav>
        )}

        {note ? <p className="ui-sft__note">{note}</p> : null}
      </div>
    </footer>
  );
}

/* The fallback mark: an ember glyph on a tinted rounded square, then the wordmark. A host that
 * passes `brand` replaces both pieces as one slot, so the footer never guesses at its own logo. */
function DefaultBrand() {
  return (
    <span className="ui-sft__mark">
      <svg
        className="ui-sft__glyph"
        viewBox="0 0 24 24"
        width="24"
        height="24"
        aria-hidden="true"
        focusable="false"
      >
        <rect
          x="0.75"
          y="0.75"
          width="22.5"
          height="22.5"
          rx="7"
          fill="currentColor"
          opacity="0.14"
        />
        <path
          d="M12 4.6c.5 2.6 1.7 3.9 2.9 5.2 1.1 1.3 2 2.6 2 4.5a4.9 4.9 0 0 1-9.8 0c0-1.7.7-3.1 1.8-4.3.5.8 1.1 1.4 1.9 1.7-.2-2.6.4-5 1.2-7.1Z"
          fill="currentColor"
        />
      </svg>
      <span className="ui-sft__wordmark">NamurUI</span>
    </span>
  );
}

const css = /* css */ `
.ui-sft {
  /* Knobs. Override any of these on .ui-sft to retheme the footer in a host. */
  --ui-sft-ink: var(--text, #1a1410);
  --ui-sft-muted: var(--text-muted, #6f625a);
  --ui-sft-line: var(--border, #e8e0d7);
  --ui-sft-accent: var(--accent, #c2410c);
  --ui-sft-focus: var(--accent, #c2410c);
  --ui-sft-gutter: 20px;
  --ui-sft-dur-1: var(--nm-dur-1, 90ms);
  --ui-sft-dur-2: var(--nm-dur-2, 160ms);
  --ui-sft-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));

  container-type: inline-size;
  box-sizing: border-box;
  width: 100%;
  padding: 32px var(--ui-sft-gutter, 20px);
  border-top: 1px solid var(--ui-sft-line, #e8e0d7);
  color: var(--ui-sft-ink, #1a1410);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 16px;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-sft *,
.ui-sft *::before,
.ui-sft *::after {
  box-sizing: border-box;
}
.ui-sft p {
  margin: 0;
}

/* Two tiers: the brand and the copyright share the top one, the flat link row takes the full
 * width underneath. Ten labels at 12px never fit beside both of them, and letting the row break
 * on its own leaves a single stranded label next to the copyright, so the row is ordered rather
 * than left to chance. */
.ui-sft__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
  width: 100%;
  min-width: 0;
}

/* Brand ------------------------------------------------------------------- */
.ui-sft__brand {
  display: flex;
  flex: 0 0 auto;
  order: 1;
  align-items: center;
  min-width: 0;
  min-height: 24px;
}
.ui-sft__mark {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 24px;
  color: var(--ui-sft-ink, #1a1410);
}
.ui-sft__glyph {
  display: block;
  flex: none;
  width: 24px;
  height: 24px;
  color: var(--ui-sft-accent, #c2410c);
}
.ui-sft__wordmark {
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: -0.02em;
  white-space: nowrap;
}

/* Flat row ---------------------------------------------------------------- */
.ui-sft__links {
  display: flex;
  flex: 1 1 100%;
  order: 3;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 20px;
  min-width: 0;
  margin: 0;
  padding: 0;
}

/* Grouped columns --------------------------------------------------------- */
.ui-sft__columns {
  display: flex;
  flex: 1 1 100%;
  order: 3;
  flex-wrap: wrap;
  gap: 20px 40px;
  min-width: 0;
}
.ui-sft__group {
  /* Equal shares of the band, so the three columns land on a real grid instead of bunching up
   * against the brand with one wide hole beside them. */
  flex: 1 1 0;
  min-width: 0;
}
.ui-sft__group-label {
  margin: 0 0 6px;
  color: var(--ui-sft-ink, #1a1410);
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.ui-sft__group-list {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.ui-sft__group-list li {
  min-width: 0;
}

/* Links ------------------------------------------------------------------- */
.ui-sft__link {
  display: inline-block;
  max-width: 100%;
  border-radius: 3px;
  color: var(--ui-sft-muted, #6f625a);
  font-size: 12px;
  line-height: 16px;
  text-decoration-line: underline;
  text-decoration-color: transparent;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  overflow-wrap: break-word;
  transition:
    color var(--ui-sft-dur-1, 90ms) var(--ui-sft-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    text-decoration-color var(--ui-sft-dur-2, 160ms)
      var(--ui-sft-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-sft__link:hover {
  color: var(--ui-sft-ink, #1a1410);
  text-decoration-color: currentColor;
}
.ui-sft__link:focus-visible {
  color: var(--ui-sft-ink, #1a1410);
  outline: 2px solid var(--ui-sft-focus, #c2410c);
  outline-offset: 3px;
}

/* Copyright --------------------------------------------------------------- */
.ui-sft__note {
  flex: 0 1 auto;
  order: 2;
  margin: 0 0 0 auto;
  color: var(--ui-sft-muted, #6f625a);
  font-size: 12px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  overflow-wrap: break-word;
}

/* Below 560px of container width the three parts take their own line, so the link row can wrap
 * inside the full width instead of competing with the brand and the copyright for one line. */
@container (max-width: 560px) {
  .ui-sft__row {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  .ui-sft__links,
  .ui-sft__columns {
    flex: 0 0 auto;
    order: 2;
    width: 100%;
  }
  /* A phone-width band fits three or four labels per line at this gap; at 20px the row breaks
   * into single words on their own line. */
  .ui-sft__links {
    gap: 8px 14px;
  }
  /* Groups stack: three equal shares of a phone-width band are ~45px each, which breaks every
   * label mid-word. Stacked, each column gets the full width and reads as a list. */
  .ui-sft__columns {
    gap: 16px;
  }
  .ui-sft__group {
    flex: 1 0 100%;
  }
  .ui-sft__note {
    order: 3;
    margin-left: 0;
    text-align: left;
  }
}

:where(.dark, [data-theme="dark"]) .ui-sft {
  --ui-sft-ink: var(--text, #f4ece4);
  --ui-sft-muted: var(--text-muted, #a2958a);
  --ui-sft-line: var(--border, #33291f);
  --ui-sft-accent: var(--accent, #ff6b35);
  --ui-sft-focus: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  .ui-sft__link {
    transition-duration: 1ms;
  }
}
`;
