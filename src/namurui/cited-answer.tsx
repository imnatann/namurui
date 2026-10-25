"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";

/*
 * Cited Answer – an answer wired to its sources, in a single self-contained file.
 * Point at a numbered marker and the sentence behind it lights while the other sentences and
 * every other marker step back; point at a source chip instead and every sentence leaning on
 * that source lights at once. Click either one and the quoted passage unfolds below with the
 * words the claim rests on marked, the footer swapping from the source line to "Quote from …".
 * The chip row measures itself off a hidden ruler: all chips sit on one line when they fit,
 * otherwise the first ones stay and the rest fold into a "+N" that expands them onto two rows.
 * The styles are injected below, so no extra files are needed.
 */

export type CitationTone = "blue" | "violet" | "green" | "amber" | "gray";

export type CitedSource = {
  /** Stable id a sentence points at */
  id: string;
  /** Site name, on the chip and in the footer */
  name: string;
  /** One or two characters in the glyph tile */
  glyph: string;
  /** Tile tint; gray when the source has no brand colour */
  tone?: CitationTone;
  /** Page title, shown on the unfolded preview and in the footer */
  title: string;
  /** Domain line on the preview, e.g. "latencynotes.io" */
  domain: string;
  /** Where the passage lives */
  href: string;
  /** Date shown next to the domain, e.g. "Aug 2, 2026" */
  date?: string;
  /** The passage the answer leans on */
  quote: string;
  /** Substrings of `quote` to mark, in the order the claim rests on them */
  marks?: string[];
};

export type CitedSentence = {
  text: string;
  /** Ids of the sources behind this sentence, in marker order */
  cites?: string[];
  /** Open a new paragraph at this sentence */
  newParagraph?: boolean;
};

export type CitedAnswerProps = {
  /** The answer, one entry per sentence; markers are appended from `cites` */
  sentences: CitedSentence[];
  /** The sources, in citation-number order */
  sources: CitedSource[];
  /** Pages read, shown beside the source count */
  pagesRead?: number;
  /** Source kept lit while nothing is pointed at */
  activeSource?: string | null;
  /** Open source id; omit to let the card own the state */
  openSource?: string | null;
  /** Source unfolded on first render when the card owns the state */
  defaultOpenSource?: string | null;
  onOpenSourceChange?: (id: string | null) => void;
  /** Footer action; "Follow up" by default */
  action?: { label?: string; onClick?: () => void };
  /** Called with the source once its quote is copied */
  onCopyQuote?: (source: CitedSource) => void;
  /** Accessible name for the card */
  label?: string;
  className?: string;
};

type Caption = { key: string; kind: "quote" | "source"; name: string; title?: string };

type Hot = { id: string; kind: "mark" | "chip"; segment?: number } | null;

type Fit = { count: number; wrap: boolean };

const CHIP_GAP = 4;

/** Leftmost-first pass over the quote, wrapping every substring the answer actually rests on. */
function splitQuote(quote: string, marks: string[]): { text: string; marked: boolean }[] {
  const parts: { text: string; marked: boolean }[] = [];
  let rest = quote;

  while (rest.length > 0) {
    let at = -1;
    let hit = "";

    for (const mark of marks) {
      if (!mark) continue;
      const index = rest.indexOf(mark);
      if (index !== -1 && (at === -1 || index < at)) {
        at = index;
        hit = mark;
      }
    }

    if (at === -1) {
      parts.push({ text: rest, marked: false });
      break;
    }
    if (at > 0) parts.push({ text: rest.slice(0, at), marked: false });
    parts.push({ text: hit, marked: true });
    rest = rest.slice(at + hit.length);
  }

  return parts;
}

/** The footer swap needs the caption it is leaving behind, so it can be keyed by hand. */
function captionFor(key: string, sources: CitedSource[]): Caption | null {
  const split = key.indexOf(":");
  if (split === -1) return null;

  const kind = key.slice(0, split);
  if (kind !== "quote" && kind !== "source") return null;

  const source = sources.find((item) => item.id === key.slice(split + 1));
  if (!source) return null;

  return kind === "quote"
    ? { key, kind, name: source.name }
    : { key, kind, name: source.name, title: source.title };
}

export function CitedAnswer({
  sentences,
  sources,
  pagesRead = 0,
  activeSource = null,
  openSource,
  defaultOpenSource = null,
  onOpenSourceChange,
  action,
  onCopyQuote,
  label = "Answer with sources",
  className,
}: CitedAnswerProps) {
  const uid = useId();
  const previewId = `${uid}-preview`;

  const [hot, setHot] = useState<Hot>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState<string | null>(defaultOpenSource);
  const [revealed, setRevealed] = useState(false);
  const [fit, setFit] = useState<Fit>({ count: sources.length, wrap: false });

  const chipsRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);

  const openId = openSource !== undefined ? openSource : uncontrolledOpen;
  const open = openId ? sources.find((source) => source.id === openId) ?? null : null;

  const litId = hot?.id ?? openId ?? activeSource;
  const lit = litId ? sources.find((source) => source.id === litId) ?? null : null;
  const dimming = hot !== null;

  const commitOpen = (id: string | null) => {
    if (openSource === undefined) setUncontrolledOpen(id);
    onOpenSourceChange?.(id);
  };

  const toggle = (id: string) => commitOpen(openId === id ? null : id);
  const clearHot = (id: string) =>
    setHot((current) => (current && current.id === id ? null : current));

  /* Paragraphs, keeping the running sentence index so a marker knows which sentence it sits in. */
  const paragraphs: { sentence: CitedSentence; index: number }[][] = [];
  let paragraph: { sentence: CitedSentence; index: number }[] = [];
  sentences.forEach((sentence, index) => {
    if (index === 0 || sentence.newParagraph) {
      if (paragraph.length > 0) paragraphs.push(paragraph);
      paragraph = [];
    }
    paragraph.push({ sentence, index });
  });
  if (paragraph.length > 0) paragraphs.push(paragraph);

  /* How many chips fit on one line — measured off the hidden ruler row. */
  useEffect(() => {
    const chips = chipsRef.current;
    const ruler = rulerRef.current;
    if (!chips || !ruler) return;

    const measure = () => {
      const items = Array.from(ruler.children) as HTMLElement[];
      if (items.length < sources.length + 1) return;

      const widths = items.slice(0, sources.length).map((item) => item.getBoundingClientRect().width);
      const moreWidth = items[items.length - 1].getBoundingClientRect().width + CHIP_GAP;
      const available = chips.getBoundingClientRect().width;
      if (available <= 0) return;

      let used = 0;
      let count = 0;
      for (const width of widths) {
        const next = used + width + (count > 0 ? CHIP_GAP : 0);
        if (next + (count + 1 < widths.length ? CHIP_GAP + moreWidth : 0) > available) break;
        used = next;
        count += 1;
      }

      const wrap = count === 0;
      setFit((current) => (current.count === count && current.wrap === wrap ? current : { count, wrap }));
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(chips);

    /* A late web font changes every chip width without resizing their row. */
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) measure();
    });

    return () => {
      live = false;
      observer.disconnect();
    };
  }, [sources]);

  /* Footer caption: the source line at rest, "Quote from …" once a passage is open. */
  const caption: Caption | null = open
    ? { key: `quote:${open.id}`, kind: "quote", name: open.name }
    : lit
      ? { key: `source:${lit.id}`, kind: "source", name: lit.name, title: lit.title }
      : sources[0]
        ? { key: `source:${sources[0].id}`, kind: "source", name: sources[0].name, title: sources[0].title }
        : null;
  const captionKey = caption?.key ?? "none";

  const lastCaption = useRef(captionKey);
  const [previousKey, setPreviousKey] = useState<string | null>(null);

  useEffect(() => {
    if (lastCaption.current === captionKey) return;
    setPreviousKey(lastCaption.current);
    lastCaption.current = captionKey;

    const timer = window.setTimeout(() => setPreviousKey(null), 240);
    return () => window.clearTimeout(timer);
  }, [captionKey]);

  const outgoing: Caption | null =
    previousKey === null || previousKey === "none" ? null : captionFor(previousKey, sources);

  const showAll = revealed || fit.wrap;
  const visibleCount = showAll ? sources.length : Math.min(fit.count, sources.length);
  const hiddenCount = sources.length - visibleCount;
  const actionLabel = action?.label ?? "Follow up";

  return (
    <div
      className={["ui-cac", className].filter(Boolean).join(" ")}
      role="group"
      aria-label={label}
      data-hot={hot ? hot.kind : undefined}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-cited-answer" precedence="default">
        {css}
      </style>

      <div className="ui-cac__body">
        <div className="ui-cac__head">
          <span className="ui-cac__stack" aria-hidden="true">
            {sources.map((source) => (
              <span key={source.id} className="ui-cac__glyph" data-tone={source.tone ?? "gray"} aria-hidden="true">
                {source.glyph}
              </span>
            ))}
          </span>
          <span className="ui-cac__meta">
            <span>
              {sources.length} {sources.length === 1 ? "source" : "sources"}
            </span>
            <span>
              <span className="ui-cac__dot">{" · "}</span>
              {pagesRead} {pagesRead === 1 ? "page" : "pages"} read
            </span>
          </span>
        </div>

        <div className="ui-cac__text">
          {paragraphs.map((group, groupIndex) => (
            <p className="ui-cac__p" key={groupIndex}>
              {group.map(({ sentence, index }, position) => {
                const markers = (sentence.cites ?? []).flatMap((id) => {
                  const at = sources.findIndex((source) => source.id === id);
                  return at === -1 ? [] : [{ source: sources[at], number: at + 1 }];
                });
                const cut =
                  markers.length > 0 ? sentence.text.lastIndexOf(" ") + 1 : sentence.text.length;
                const tail = sentence.text.slice(cut);
                const cited = (sentence.cites ?? []).includes(litId ?? "");
                const hotHere = hot?.kind === "mark" && hot.segment === index;
                const highlighted = hot?.kind === "mark" ? hotHere : cited;

                return (
                  <span key={index}>
                    {position > 0 ? " " : null}
                    <span className="ui-cac__seg" data-hl={highlighted ? "" : undefined}>
                      {sentence.text.slice(0, cut)}
                      <span className="ui-cac__keep">
                        {tail}
                        {markers.map(({ source, number }) => {
                          const markerLit =
                            (hotHere && hot?.id === source.id) ||
                            (hot?.kind === "chip" && hot.id === source.id);
                          const markerDim = dimming && !markerLit;

                          return (
                            <button
                              key={`${source.id}-${number}`}
                              type="button"
                              className="ui-cac__marker"
                              data-source={source.id}
                              data-lit={markerLit ? "" : undefined}
                              data-dim={markerDim ? "" : undefined}
                              aria-expanded={openId === source.id}
                              aria-controls={previewId}
                              aria-label={`Source ${number}: ${source.name} – ${source.title}`}
                              onClick={() => toggle(source.id)}
                              onPointerEnter={() => setHot({ id: source.id, kind: "mark", segment: index })}
                              onPointerLeave={() => clearHot(source.id)}
                              onFocus={() => setHot({ id: source.id, kind: "mark", segment: index })}
                              onBlur={() => clearHot(source.id)}
                            >
                              {number}
                            </button>
                          );
                        })}
                      </span>
                    </span>
                  </span>
                );
              })}
            </p>
          ))}
        </div>

        <div
          className="ui-cac__chips"
          role="list"
          aria-label="Sources"
          data-all={showAll ? "" : undefined}
          ref={chipsRef}
        >
          {sources.slice(0, visibleCount).map((source, index) => (
            <span role="listitem" className="ui-cac__chip-item" key={source.id}>
              <button
                type="button"
                className="ui-cac__chip"
                data-source={source.id}
                data-lit={hot?.id === source.id ? "" : undefined}
                data-dim={dimming && hot?.id !== source.id ? "" : undefined}
                aria-expanded={openId === source.id}
                aria-controls={previewId}
                aria-label={`Source ${index + 1}: ${source.name} – ${source.title}`}
                onClick={() => toggle(source.id)}
                onPointerEnter={() => setHot({ id: source.id, kind: "chip" })}
                onPointerLeave={() => clearHot(source.id)}
                onFocus={() => setHot({ id: source.id, kind: "chip" })}
                onBlur={() => clearHot(source.id)}
              >
                <span className="ui-cac__glyph" data-tone={source.tone ?? "gray"} aria-hidden="true">
                  {source.glyph}
                </span>
                <span className="ui-cac__chip-name">{source.name}</span>
                <span className="ui-cac__chip-num">{index + 1}</span>
              </button>
            </span>
          ))}
          {hiddenCount > 0 ? (
            <button
              type="button"
              className="ui-cac__more"
              aria-label={`Show ${hiddenCount} more ${hiddenCount === 1 ? "source" : "sources"}`}
              onClick={() => setRevealed(true)}
            >
              +{hiddenCount}
            </button>
          ) : null}
        </div>

        <div className="ui-cac__ruler" aria-hidden="true" ref={rulerRef}>
          {sources.map((source, index) => (
            <span className="ui-cac__chip" data-chip="" key={source.id}>
              <span className="ui-cac__glyph" data-tone={source.tone ?? "gray"} aria-hidden="true">
                {source.glyph}
              </span>
              <span className="ui-cac__chip-name">{source.name}</span>
              <span className="ui-cac__chip-num">{index + 1}</span>
            </span>
          ))}
          <span className="ui-cac__more" data-more="">
            +{sources.length}
          </span>
        </div>

        <div
          id={previewId}
          className="ui-cac__fold"
          data-open={open ? "" : undefined}
          inert={!open || undefined}
          role="region"
          aria-label="Source"
        >
          <div className="ui-cac__clip">
            {open ? (
              <Preview
                key={open.id}
                source={open}
                number={sources.findIndex((source) => source.id === open.id) + 1}
                onClose={() => commitOpen(null)}
                onCopy={onCopyQuote}
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="ui-cac__foot">
        <span className="ui-cac__caption" aria-live="polite">
          <span className="ui-cac__swap">
            {[
              ...(outgoing ? [{ caption: outgoing, out: true }] : []),
              ...(caption ? [{ caption, out: false }] : []),
            ].map(({ caption: item, out }) => (
              <span className="ui-cac__swap-item" data-out={out ? "" : undefined} key={item.key}>
                {item.kind === "quote" ? (
                  <>
                    Quote from <b>{item.name}</b>
                  </>
                ) : (
                  <>
                    <b>{item.name}</b> <span className="ui-cac__dot">·</span> {item.title}
                  </>
                )}
              </span>
            ))}
          </span>
        </span>
        <button type="button" className="ui-cac__action" onClick={action?.onClick}>
          {actionLabel}
          <svg viewBox="0 0 16 16" className="ui-cac__icon" aria-hidden="true">
            <path d="M3.5 8h9M8.75 4.25 12.5 8l-3.75 3.75" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function Preview({
  source,
  number,
  onClose,
  onCopy,
}: {
  source: CitedSource;
  number: number;
  onClose: () => void;
  onCopy?: (source: CitedSource) => void;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = () => {
    if (typeof navigator !== "undefined") {
      void navigator.clipboard?.writeText(source.quote).catch(() => undefined);
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1800);
    onCopy?.(source);
  };

  return (
    <div className="ui-cac__preview">
      <div className="ui-cac__pv-head">
        <span className="ui-cac__glyph" data-tone={source.tone ?? "gray"} aria-hidden="true">
          {source.glyph}
        </span>
        <span className="ui-cac__pv-meta">
          <span className="ui-cac__pv-domain">{source.domain}</span>
          {source.date ? (
            <>
              <span className="ui-cac__dot">{" · "}</span>
              {source.date}
            </>
          ) : null}
        </span>
        <span className="ui-cac__pv-num">{number}</span>
        <button type="button" className="ui-cac__close" aria-label="Close source" onClick={onClose}>
          <svg viewBox="0 0 16 16" className="ui-cac__icon" aria-hidden="true">
            <path d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5" />
          </svg>
        </button>
      </div>

      <div className="ui-cac__pv-title">{source.title}</div>

      <blockquote className="ui-cac__quote">
        {splitQuote(source.quote, source.marks ?? []).map((part, index) =>
          part.marked ? (
            <mark key={index}>{part.text}</mark>
          ) : (
            <Fragment key={index}>{part.text}</Fragment>
          ),
        )}
      </blockquote>

      <div className="ui-cac__pv-actions">
        <a
          className="ui-cac__btn ui-cac__btn--main"
          href={source.href}
          target="_blank"
          rel="noreferrer"
        >
          <span className="ui-cac__btn-icon">
            <svg viewBox="0 0 16 16" className="ui-cac__icon" aria-hidden="true">
              <path d="M6.5 3.5h-3v9h9v-3M9.5 3.5h3v3M12.5 3.5 7 9" />
            </svg>
          </span>
          <span className="ui-cac__btn-text">Open source</span>
        </a>
        <button
          type="button"
          className="ui-cac__btn"
          data-done={copied ? "" : undefined}
          onClick={copy}
        >
          <span className="ui-cac__btn-icon" key={copied ? "check" : "copy"}>
            {copied ? (
              <svg viewBox="0 0 16 16" className="ui-cac__icon" aria-hidden="true">
                <path d="M3.5 8.5 6.5 11.5 12 4.5" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" className="ui-cac__icon" aria-hidden="true">
                <path d="M5.5 5.5V3.5h7v7h-2M3.5 5.5h7v7h-7z" />
              </svg>
            )}
          </span>
          <span className="ui-cac__btn-text">{copied ? "Copied" : "Copy quote"}</span>
        </button>
      </div>
    </div>
  );
}

const css = /* css */ `
.ui-cac{--ui-cac-card: #fffdfb;--ui-cac-ink: rgba(11, 9, 8, 0.88);--ui-cac-strong: #0b0908;--ui-cac-text: rgba(11, 9, 8, 0.61);--ui-cac-muted: rgba(11, 9, 8, 0.45);--ui-cac-faint: rgba(11, 9, 8, 0.27);--ui-cac-icon: rgba(11, 9, 8, 0.447);--ui-cac-line: rgba(11, 9, 8, 0.06);--ui-cac-fill: rgba(11, 9, 8, 0.06);--ui-cac-fill-strong: rgba(11, 9, 8, 0.1);--ui-cac-wash: rgba(11, 9, 8, 0.03);--ui-cac-hl: rgba(217, 84, 31, 0.07);--ui-cac-mark: rgba(217, 84, 31, 0.1);--ui-cac-ok: #2f8d5c;--ui-cac-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-cac-focus: rgba(217, 84, 31, 0.35);--ui-cac-ease: cubic-bezier(0.22, 1, 0.36, 1);position: relative;box-sizing: border-box;width: 100%;max-width: 460px;min-width: 0;container-type: inline-size;border-radius: 10px;background: var(--ui-cac-card);box-shadow: var(--ui-cac-shadow);font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;font-weight: 400;color: var(--ui-cac-ink);text-align: left;-webkit-font-smoothing: antialiased}
.ui-cac *, .ui-cac *::before, .ui-cac *::after{box-sizing: border-box}
:where(.ui-cac) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;text-align: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-cac :is(button, a):focus-visible{outline: 2px solid var(--ui-cac-focus);outline-offset: 1px}
.ui-cac svg{display: block;flex: none}
.ui-cac b{font-weight: 500;color: var(--ui-cac-ink)}
.ui-cac__dot{color: var(--ui-cac-faint)}
.ui-cac__icon{width: 16px;height: 16px;fill: none;stroke: currentColor;stroke-width: 1.1;stroke-linecap: round;stroke-linejoin: round}
.ui-cac [data-tone="blue"]{--ui-cac-g: #ff6b35;--ui-cac-g-bg: rgba(217, 84, 31, 0.08)}
.ui-cac [data-tone="violet"]{--ui-cac-g: #c2703a;--ui-cac-g-bg: rgba(194, 112, 58, 0.09)}
.ui-cac [data-tone="green"]{--ui-cac-g: #1a7a4a;--ui-cac-g-bg: rgba(47, 141, 92, 0.09)}
.ui-cac [data-tone="amber"]{--ui-cac-g: #9a6410;--ui-cac-g-bg: rgba(217, 149, 48, 0.12)}
.ui-cac [data-tone="gray"]{--ui-cac-g: rgba(11, 9, 8, 0.55);--ui-cac-g-bg: rgba(11, 9, 8, 0.06)}
.ui-cac__glyph{display: grid;flex: none;place-items: center;width: 16px;height: 16px;overflow: hidden;border-radius: 4px;background: var(--ui-cac-g-bg);font-size: 9.5px;font-weight: 500;line-height: 1;color: var(--ui-cac-g)}
.ui-cac__glyph > :is(img, svg){width: 100%;height: 100%;object-fit: cover}
.ui-cac__body{padding: 16px 20px 16px}
.ui-cac__head{display: flex;align-items: center;gap: 8px;height: 16px}
.ui-cac__stack{display: flex;flex: none}
.ui-cac__stack .ui-cac__glyph{box-shadow: 0 0 0 1.5px var(--ui-cac-card)}
.ui-cac__stack .ui-cac__glyph + .ui-cac__glyph{margin-left: -4px}
.ui-cac__meta{min-width: 0;overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-cac-muted);white-space: nowrap;text-overflow: ellipsis;font-variant-numeric: tabular-nums}
.ui-cac__text{margin-top: 12px;color: var(--ui-cac-ink)}
.ui-cac__p{margin: 0;font-size: 13px;line-height: 22px}
.ui-cac__p + .ui-cac__p{margin-top: 10px}
.ui-cac__seg{margin: 0 -2px;padding: 2px 2px;border-radius: 4px;-webkit-box-decoration-break: clone;box-decoration-break: clone;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cac__seg[data-hl]{background: var(--ui-cac-hl);color: var(--ui-cac-strong)}
.ui-cac__seg[data-dim]{color: var(--ui-cac-faint)}
.ui-cac__keep{white-space: nowrap}
.ui-cac__marker{position: relative;display: inline-grid;place-items: center;min-width: 16px;height: 16px;margin-left: 3px;padding: 0 4px;border-radius: 4px;background: var(--ui-cac-fill);box-shadow: inset 0 0 0 0.5px var(--ui-cac-line);font-size: 10px;font-weight: 500;line-height: 16px;color: var(--ui-cac-text);vertical-align: 1px;font-variant-numeric: tabular-nums;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cac__marker + .ui-cac__marker{margin-left: 2px}
.ui-cac__marker::after{content: "";position: absolute;inset: -4px -2px}
.ui-cac__marker:hover, .ui-cac__marker[data-lit], .ui-cac__marker[aria-expanded="true"]{background: var(--ui-cac-fill-strong);color: var(--ui-cac-ink)}
.ui-cac__marker[data-dim]:not([aria-expanded="true"]){opacity: 0.5}
.ui-cac__chips{display: flex;gap: 4px;margin-top: 16px;min-width: 0}
.ui-cac__chips[data-all]{flex-wrap: wrap}
.ui-cac__chip-item{display: flex;flex: none;min-width: 0;max-width: 100%}
.ui-cac__chip-item:only-child, .ui-cac__chips:not([data-all]) .ui-cac__chip-item:first-child:nth-last-child(2){flex: 0 1 auto}
.ui-cac__chip{display: inline-flex;align-items: center;gap: 6px;min-width: 0;max-width: 100%;height: 28px;padding: 0 8px 0 6px;border-radius: 6px;box-shadow: inset 0 0 0 0.5px var(--ui-cac-line);font-size: 12px;font-weight: 500;line-height: 16px;color: var(--ui-cac-text);white-space: nowrap;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cac__chip:hover, .ui-cac__chip[data-lit]{background: var(--ui-cac-wash);color: var(--ui-cac-ink)}
.ui-cac__chip[aria-expanded="true"]{background: var(--ui-cac-fill);color: var(--ui-cac-ink)}
.ui-cac__chip[data-dim]:not([aria-expanded="true"]){opacity: 0.5}
.ui-cac__chip-name{min-width: 0;overflow: hidden;text-overflow: ellipsis}
.ui-cac__chip-num{flex: none;margin-left: -1px;font-size: 11px;font-weight: 400;color: var(--ui-cac-faint);font-variant-numeric: tabular-nums}
.ui-cac__more{display: inline-grid;flex: none;place-items: center;height: 28px;padding: 0 8px;border-radius: 6px;box-shadow: inset 0 0 0 0.5px var(--ui-cac-line);font-size: 12px;font-weight: 500;line-height: 16px;color: var(--ui-cac-text);font-variant-numeric: tabular-nums;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cac__more:hover{background: var(--ui-cac-wash);color: var(--ui-cac-ink)}
.ui-cac__ruler{position: absolute;top: 0;left: 0;display: flex;gap: 4px;height: 0;overflow: hidden;visibility: hidden;pointer-events: none}
.ui-cac__ruler > *{flex: none}
.ui-cac__fold{display: grid;grid-template-rows: 0fr;opacity: 0;transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-cac-ease), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cac__fold[data-open]{grid-template-rows: 1fr;opacity: 1;transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-cac-ease), opacity var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 80ms}
.ui-cac__clip{min-height: 0;overflow: hidden;margin: 0 -4px -4px;padding: 0 4px 4px}
.ui-cac__preview{margin-top: 12px;padding: 10px 12px 12px;border-radius: 8px;background: var(--ui-cac-card);box-shadow: var(--ui-cac-shadow);animation: ui-cac-swap-in var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-cac__pv-head{display: flex;align-items: center;gap: 8px;height: 24px}
.ui-cac__pv-meta{flex: 1;min-width: 0;overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-cac-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-cac__pv-domain{color: var(--ui-cac-text)}
.ui-cac__pv-num{display: grid;flex: none;place-items: center;min-width: 16px;height: 16px;padding: 0 4px;border-radius: 4px;background: var(--ui-cac-fill);font-size: 10px;font-weight: 500;line-height: 16px;color: var(--ui-cac-text);font-variant-numeric: tabular-nums}
.ui-cac__close{display: grid;flex: none;place-items: center;width: 24px;height: 24px;margin-right: -6px;border-radius: 6px;color: var(--ui-cac-icon);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cac__close:hover{background: var(--ui-cac-wash);color: var(--ui-cac-ink)}
.ui-cac__pv-title{display: -webkit-box;margin-top: 6px;overflow: hidden;font-size: 13px;font-weight: 500;line-height: 20px;color: var(--ui-cac-strong);-webkit-line-clamp: 2;-webkit-box-orient: vertical}
.ui-cac__quote{margin: 8px 0 0;padding: 0 0 0 10px;border-left: 2px solid var(--ui-cac-fill);font-size: 12px;line-height: 20px;color: var(--ui-cac-text)}
.ui-cac__quote mark{margin: 0 -1px;padding: 1px 1px;border-radius: 3px;background: var(--ui-cac-mark);color: var(--ui-cac-ink);-webkit-box-decoration-break: clone;box-decoration-break: clone}
.ui-cac__pv-actions{display: flex;flex-wrap: wrap;align-items: center;gap: 8px;margin-top: 12px}
.ui-cac__btn{display: inline-flex;align-items: center;gap: 6px;height: 28px;padding: 0 10px 0 8px;border-radius: 6px;font-size: 13px;font-weight: 500;line-height: 20px;color: var(--ui-cac-text);text-decoration: none;white-space: nowrap;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cac__btn .ui-cac__icon{color: var(--ui-cac-icon);transition: color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-3, 240ms) var(--ui-cac-ease)}
.ui-cac__btn:hover{background: var(--ui-cac-wash);color: var(--ui-cac-ink)}
.ui-cac__btn:hover .ui-cac__icon{color: var(--ui-cac-ink)}
.ui-cac__btn--main{background: var(--ui-cac-card);box-shadow: var(--ui-cac-shadow);color: var(--ui-cac-strong)}
.ui-cac__btn--main:hover{background: #faf7f4;color: var(--ui-cac-strong)}
.ui-cac__btn--main:hover .ui-cac__icon{transform: translate(1px, -1px)}
.ui-cac__btn[data-done], .ui-cac__btn[data-done] .ui-cac__icon{color: var(--ui-cac-ok)}
.ui-cac__btn-icon{display: grid;place-items: center;width: 16px;height: 16px;animation: ui-cac-swap-in var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-cac__foot{display: flex;align-items: center;gap: 12px;height: 44px;padding: 0 8px 0 20px;border-top: 0.5px solid var(--ui-cac-line)}
.ui-cac__foot:not(:has(.ui-cac__action)){padding-right: 20px}
.ui-cac__caption{flex: 1;min-width: 0;overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-cac-muted);white-space: nowrap;text-overflow: ellipsis;font-variant-numeric: tabular-nums}
.ui-cac__swap{display: grid;min-width: 0}
.ui-cac__swap-item{grid-area: 1 / 1;min-width: 0;overflow: hidden;text-overflow: ellipsis;animation: ui-cac-swap-in var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-cac__swap-item[data-out]{animation: ui-cac-swap-out var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-cac__swap-item[data-tone="ok"]{color: var(--ui-cac-ok)}
.ui-cac__action{display: inline-flex;flex: none;align-items: center;gap: 6px;height: 28px;padding: 0 8px 0 10px;border-radius: 6px;background: var(--ui-cac-card);box-shadow: var(--ui-cac-shadow);font-size: 13px;font-weight: 500;line-height: 20px;color: var(--ui-cac-strong);white-space: nowrap;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cac__action .ui-cac__icon{color: var(--ui-cac-icon);transition: transform var(--nm-dur-3, 240ms) var(--ui-cac-ease), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cac__action:hover{background: #faf7f4}
.ui-cac__action:hover .ui-cac__icon{color: var(--ui-cac-ink);transform: translateX(2px)}
@keyframes ui-cac-swap-in{from{opacity: 0;filter: blur(2px)}
}
@keyframes ui-cac-swap-out{from{opacity: 1}
to{opacity: 0;filter: blur(2px)}
}
@container (max-width: 400px){.ui-cac__body{padding: 14px 16px 16px}
.ui-cac__foot{padding-left: 16px}
}
@container (max-width: 360px){.ui-cac__pv-num{display: none}
}
@container (max-width: 280px){.ui-cac__btn-text{display: none}
}
@media (pointer: coarse){.ui-cac__marker::after{inset: -8px -5px}
.ui-cac__chip, .ui-cac__more{height: 34px}
.ui-cac__btn{height: 34px}
.ui-cac__close{width: 32px;height: 32px;margin-right: -8px}
.ui-cac__action{height: 34px}
.ui-cac__foot{height: 52px}
}
@media (prefers-reduced-motion: reduce){.ui-cac *, .ui-cac *::before, .ui-cac *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-cac{--ui-cac-card: #211b16;--ui-cac-ink: rgba(255, 253, 251, 0.9);--ui-cac-strong: #fffdfb;--ui-cac-text: rgba(255, 253, 251, 0.62);--ui-cac-muted: rgba(255, 253, 251, 0.46);--ui-cac-faint: rgba(255, 253, 251, 0.3);--ui-cac-icon: rgba(255, 253, 251, 0.5);--ui-cac-line: rgba(255, 253, 251, 0.08);--ui-cac-fill: rgba(255, 253, 251, 0.08);--ui-cac-fill-strong: rgba(255, 253, 251, 0.14);--ui-cac-wash: rgba(255, 253, 251, 0.04);--ui-cac-hl: rgba(255, 138, 92, 0.14);--ui-cac-mark: rgba(255, 138, 92, 0.24);--ui-cac-ok: #2f8d5c;--ui-cac-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-cac-focus: rgba(255, 138, 92, 0.5)}
:where(.dark, [data-theme="dark"]) .ui-cac__btn--main:hover, :where(.dark, [data-theme="dark"]) .ui-cac__action:hover{background: #27201a}
:where(.dark, [data-theme="dark"]) .ui-cac [data-tone="blue"]{--ui-cac-g: #ffb28f;--ui-cac-g-bg: rgba(255, 138, 92, 0.16)}
:where(.dark, [data-theme="dark"]) .ui-cac [data-tone="violet"]{--ui-cac-g: #ff8a5c;--ui-cac-g-bg: rgba(255, 138, 92, 0.18)}
:where(.dark, [data-theme="dark"]) .ui-cac [data-tone="green"]{--ui-cac-g: #4f9d6e;--ui-cac-g-bg: rgba(47, 141, 92, 0.16)}
:where(.dark, [data-theme="dark"]) .ui-cac [data-tone="amber"]{--ui-cac-g: #e8b05c;--ui-cac-g-bg: rgba(217, 149, 48, 0.16)}
:where(.dark, [data-theme="dark"]) .ui-cac [data-tone="gray"]{--ui-cac-g: rgba(255, 253, 251, 0.62);--ui-cac-g-bg: rgba(255, 253, 251, 0.08)}

`;
