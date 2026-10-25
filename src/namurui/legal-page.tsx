"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/*
 * Legal Page: one policy document on one page, with its sibling documents one chip away.
 * The header band carries the eyebrow, title, lead and date over a tinted ground; below it a
 * sticky contents list on the left tracks the section being read and the prose runs down the
 * right. A single IntersectionObserver moves the mark, so scrolling never costs a handler per
 * frame, and every contents entry is a real anchor that lands clear of a sticky host header.
 * The styles are injected below, so no extra files are needed.
 */

/** One section of the document: an anchor id, a heading and the prose under it. */
export type LegalSection = {
  /** Anchor id, used by both the contents link and the scroll target */
  id: string;
  /** Heading text without its number; the number follows the section's position */
  title: string;
  /** Paragraphs and lists, rendered as prose */
  body: ReactNode;
};

/** One sibling document in the switcher above the body. */
type LegalDocumentLink = {
  /** Chip label, e.g. "Privasi" */
  label: string;
  /** Where the chip points */
  href: string;
  /** Marks the document already open; the chip takes the accent ground */
  active?: boolean;
};

export type LegalPageProps = {
  /** Document title, rendered as the page heading */
  title: string;
  /** One or two sentences under the title */
  lead?: string;
  /** Date the document last changed; the line reads "Terakhir diperbarui" */
  updated?: string;
  /** Sibling documents in the switcher; the active one carries aria-current */
  documents?: readonly LegalDocumentLink[];
  /** Sections in reading order; numbering and the contents list both follow this order */
  sections: readonly LegalSection[];
  /** Closing note under the article, e.g. a contact line and a version */
  footnote?: ReactNode;
  /** Extra class on the root */
  className?: string;
};

/* Distance from the viewport top to the reading line: clear of a sticky host header and of
 * this page's own sticky contents list. The CSS scroll margin uses the same 96px. */
const READING_LINE = 96;

export function LegalPage({
  title,
  lead,
  updated,
  documents,
  sections,
  footnote,
  className,
}: LegalPageProps) {
  const headingId = useId();
  const article = useRef<HTMLElement>(null);
  const [current, setCurrent] = useState(() => sections[0]?.id ?? "");
  const sectionKey = sections.map((section) => section.id).join("\u0000");

  /* One observer over every section. Its callback reads the section tops once and marks the
   * last one whose top has passed the reading line, which is the section under the eye even
   * when a very long section spans the whole band. The band starts below the sticky header,
   * so the mark never jumps to a section the header still covers. */
  useEffect(() => {
    const host = article.current;
    if (!host || typeof IntersectionObserver === "undefined") return;
    const nodes = Array.from(host.querySelectorAll<HTMLElement>("[data-lgp-section]"));
    if (nodes.length === 0) return;

    const read = () => {
      let found = nodes[0];
      for (const node of nodes) {
        if (node.getBoundingClientRect().top <= READING_LINE + 1) found = node;
      }
      const id = found.getAttribute("data-lgp-section");
      if (id) setCurrent(id);
    };

    const io = new IntersectionObserver(read, {
      rootMargin: `-${READING_LINE}px 0px -62% 0px`,
      threshold: 0,
    });
    nodes.forEach((node) => io.observe(node));
    read();
    return () => io.disconnect();
  }, [sectionKey]);

  return (
    <div className={["ui-lgp", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-legal-page" precedence="default">
        {css}
      </style>

      <header className="ui-lgp__head">
        <div className="ui-lgp__head-inner">
          <p className="ui-lgp__eyebrow">Legal</p>
          <h1 className="ui-lgp__title" id={headingId}>
            {title}
          </h1>
          {lead ? <p className="ui-lgp__lead">{lead}</p> : null}
          {updated ? <p className="ui-lgp__updated">Terakhir diperbarui {updated}</p> : null}

          {documents && documents.length > 0 ? (
            <ul className="ui-lgp__docs">
              {documents.map((document) => (
                <li key={`${document.href}-${document.label}`}>
                  <a
                    className="ui-lgp__doc"
                    href={document.href}
                    data-active={document.active ? "true" : "false"}
                    aria-current={document.active ? "page" : undefined}
                  >
                    {document.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </header>

      <div className="ui-lgp__body">
        <aside className="ui-lgp__aside">
          <p className="ui-lgp__toc-label" id={`${headingId}-toc`}>
            Daftar isi
          </p>
          <nav className="ui-lgp__toc" aria-labelledby={`${headingId}-toc`}>
            {sections.map((section, index) => {
              const active = section.id === current;
              return (
                <a
                  key={section.id}
                  className="ui-lgp__toc-link"
                  href={`#${section.id}`}
                  data-active={active ? "true" : "false"}
                  aria-current={active ? "true" : undefined}
                >
                  <span className="ui-lgp__toc-num">{index + 1}</span>
                  <span className="ui-lgp__toc-title">{section.title}</span>
                </a>
              );
            })}
          </nav>
        </aside>

        <article className="ui-lgp__article" ref={article} aria-labelledby={headingId}>
          {sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              className="ui-lgp__section"
              data-lgp-section={section.id}
            >
              <h2 className="ui-lgp__h2">
                {index + 1}. {section.title}
              </h2>
              <div className="ui-lgp__prose">{section.body}</div>
            </section>
          ))}

          {footnote ? <footer className="ui-lgp__foot">{footnote}</footer> : null}
        </article>
      </div>
    </div>
  );
}

const css = /* css */ `
.ui-lgp {
  /* Knobs. Override any of these on .ui-lgp to retheme the page in a host. */
  --ui-lgp-ink: var(--text, #1a1410);
  --ui-lgp-muted: var(--text-muted, #6f625a);
  --ui-lgp-prose: #1a1410b8;
  --ui-lgp-ground: #faf7f4;
  --ui-lgp-head: #f6efe8;
  --ui-lgp-line: var(--border, #e8e0d7);
  --ui-lgp-edge: var(--border-soft, #1a14101a);
  --ui-lgp-accent: var(--accent, #c2410c);
  --ui-lgp-on-accent: #fdf9f5;
  --ui-lgp-hover: #7a4a1c0f;
  --ui-lgp-focus: var(--accent, #c2410c);
  --ui-lgp-reading-line: 96px;
  --ui-lgp-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-lgp-dur-2: var(--nm-dur-2, 160ms);
  --ui-lgp-dur-3: var(--nm-dur-3, 240ms);
  --ui-lgp-dur-4: var(--nm-dur-4, 380ms);

  box-sizing: border-box;
  width: 100%;
  background: var(--ui-lgp-ground, #faf7f4);
  color: var(--ui-lgp-ink, #1a1410);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  line-height: 22px;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-lgp *,
.ui-lgp *::before,
.ui-lgp *::after {
  box-sizing: border-box;
}
.ui-lgp p {
  margin: 0;
}
.ui-lgp a {
  color: inherit;
  text-decoration: none;
}
.ui-lgp a:focus-visible {
  outline: 2px solid var(--ui-lgp-focus, #c2410c);
  outline-offset: 2px;
}

/* Header band ------------------------------------------------------------- */
.ui-lgp__head {
  position: relative;
  overflow: hidden;
  padding-block: 40px 48px;
  background: var(--ui-lgp-head, #f6efe8);
  box-shadow: inset 0 -1px 0 var(--ui-lgp-line, #e8e0d7);
}
.ui-lgp__head-inner {
  max-width: 1152px;
  margin-inline: auto;
  padding-inline: clamp(20px, 5vw, 32px);
  animation: ui-lgp-rise var(--ui-lgp-dur-4, 380ms) var(--ui-lgp-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both;
}
.ui-lgp__eyebrow {
  color: var(--ui-lgp-muted, #6f625a);
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.ui-lgp__title {
  margin: 10px 0 0;
  color: var(--ui-lgp-ink, #1a1410);
  font-size: clamp(2rem, 4vw, 2.75rem);
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.025em;
  text-wrap: balance;
}
.ui-lgp__lead {
  max-width: 54ch;
  margin-top: 14px;
  color: var(--ui-lgp-muted, #6f625a);
  font-size: 15px;
  line-height: 26px;
}
.ui-lgp__updated {
  margin-top: 18px;
  color: var(--ui-lgp-muted, #6f625a);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}

/* Document chips ---------------------------------------------------------- */
.ui-lgp__docs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 32px 0 0;
  padding: 0;
  list-style: none;
}
.ui-lgp__doc {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  padding: 0 14px;
  border-radius: var(--radius-pill, 999px);
  box-shadow: inset 0 0 0 1px var(--ui-lgp-edge, #1a14101a);
  color: var(--ui-lgp-muted, #6f625a);
  font-size: 12.5px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
  transition:
    color var(--ui-lgp-dur-2, 160ms) var(--ui-lgp-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    background-color var(--ui-lgp-dur-2, 160ms) var(--ui-lgp-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    box-shadow var(--ui-lgp-dur-2, 160ms) var(--ui-lgp-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-lgp__doc:hover {
  background: var(--ui-lgp-hover, #7a4a1c0f);
  color: var(--ui-lgp-ink, #1a1410);
}
.ui-lgp__doc[data-active="true"] {
  background: var(--ui-lgp-accent, #c2410c);
  box-shadow: inset 0 0 0 1px var(--ui-lgp-accent, #c2410c);
  color: var(--ui-lgp-on-accent, #fdf9f5);
}

/* Body -------------------------------------------------------------------- */
.ui-lgp__body {
  display: grid;
  gap: 32px;
  max-width: 1152px;
  margin-inline: auto;
  padding: 48px clamp(20px, 5vw, 32px) 72px;
}
.ui-lgp__aside {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.ui-lgp__toc-label {
  color: var(--ui-lgp-muted, #6f625a);
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.ui-lgp__toc {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ui-lgp__toc-link {
  position: relative;
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  align-items: start;
  gap: 6px;
  padding: 5px 8px 5px 12px;
  border-radius: var(--radius-preview, 12px);
  color: var(--ui-lgp-muted, #6f625a);
  font-size: 12px;
  line-height: 18px;
  transition:
    color var(--ui-lgp-dur-3, 240ms) var(--ui-lgp-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    background-color var(--ui-lgp-dur-2, 160ms) var(--ui-lgp-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
/* The reading mark is its own straight rule. As an inset shadow on the rounded row it curled
 * into a bracket at both ends, so the position read as a shape rather than a marker. */
.ui-lgp__toc-link::before {
  content: "";
  position: absolute;
  left: 1px;
  top: 5px;
  bottom: 5px;
  width: 2px;
  border-radius: 1px;
  background: transparent;
  transition: background-color var(--ui-lgp-dur-3, 240ms) var(--ui-lgp-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-lgp__toc-link:hover {
  background: var(--ui-lgp-hover, #7a4a1c0f);
  color: var(--ui-lgp-ink, #1a1410);
}
.ui-lgp__toc-link[data-active="true"] {
  color: var(--ui-lgp-accent, #c2410c);
  font-weight: 500;
}
.ui-lgp__toc-link[data-active="true"]::before {
  background: var(--ui-lgp-accent, #c2410c);
}
.ui-lgp__toc-num {
  color: var(--ui-lgp-muted, #6f625a);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.ui-lgp__toc-link[data-active="true"] .ui-lgp__toc-num {
  color: var(--ui-lgp-accent, #c2410c);
}

/* Article ----------------------------------------------------------------- */
.ui-lgp__article {
  display: flex;
  flex-direction: column;
  gap: 40px;
  min-width: 0;
}
.ui-lgp__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  scroll-margin-top: var(--ui-lgp-reading-line, 96px);
}
.ui-lgp__h2 {
  margin: 0;
  color: var(--ui-lgp-ink, #1a1410);
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: -0.01em;
}
.ui-lgp__prose {
  color: var(--ui-lgp-prose, #1a1410b8);
  font-size: 14px;
  line-height: 28px;
}
.ui-lgp__prose > p + p,
.ui-lgp__prose > p + ul,
.ui-lgp__prose > p + ol,
.ui-lgp__prose > ul + p,
.ui-lgp__prose > ol + p {
  margin-top: 12px;
}
.ui-lgp__prose > ul,
.ui-lgp__prose > ol {
  margin: 0;
  padding-left: 18px;
  list-style: disc;
}
.ui-lgp__prose > ol {
  list-style: decimal;
}
.ui-lgp__prose li + li {
  margin-top: 6px;
}
.ui-lgp__prose li {
  padding-left: 2px;
}
.ui-lgp__prose li::marker {
  color: var(--ui-lgp-muted, #6f625a);
}
.ui-lgp__prose strong {
  color: var(--ui-lgp-ink, #1a1410);
  font-weight: 600;
}
.ui-lgp__prose a {
  color: var(--ui-lgp-accent, #c2410c);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}
.ui-lgp__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px 24px;
  padding-top: 20px;
  box-shadow: inset 0 1px 0 var(--ui-lgp-line, #e8e0d7);
  color: var(--ui-lgp-muted, #6f625a);
  font-size: 12px;
  line-height: 20px;
}

/* The header block settles in once; content never waits on an animation. */
@keyframes ui-lgp-rise {
  from {
    opacity: 0;
    transform: translate3d(0, 10px, 0);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* From sm the band takes the live page's larger step, still with the inner gutter doing the
 * horizontal inset so the header lines up with the prose below. */
@media (min-width: 640px) {
  .ui-lgp__head {
    padding-block: 56px 64px;
  }
}

/* From lg the contents list keeps the reader's place while the prose runs past it. */
@media (min-width: 1024px) {
  .ui-lgp__body {
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 40px;
    padding-top: 64px;
    padding-bottom: 96px;
  }
  .ui-lgp__aside {
    position: sticky;
    top: var(--ui-lgp-reading-line, 96px);
    align-self: start;
    max-height: calc(100dvh - 128px);
    overflow-y: auto;
    overscroll-behavior: contain;
  }
}

:where(.dark, [data-theme="dark"]) .ui-lgp {
  --ui-lgp-ink: var(--text, #f4ece4);
  --ui-lgp-muted: var(--text-muted, #a2958a);
  --ui-lgp-prose: #f4ece4b8;
  --ui-lgp-ground: #14100d;
  --ui-lgp-head: #1a1512;
  --ui-lgp-line: var(--border, #33291f);
  --ui-lgp-edge: var(--border-soft, #ffffff12);
  --ui-lgp-accent: var(--accent, #ff6b35);
  --ui-lgp-on-accent: #1a0f08;
  --ui-lgp-hover: #ffffff0a;
  --ui-lgp-focus: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  .ui-lgp__head-inner {
    animation: none;
    opacity: 1;
    transform: none;
  }
  .ui-lgp__doc,
  .ui-lgp__toc-link,
  .ui-lgp__toc-link::before {
    transition-duration: 1ms;
  }
}
`;
