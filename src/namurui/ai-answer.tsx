"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/*
 * AI Answer – a streamed answer with the sources it was built from, in a single file.
 * The card opens by reading the sources (the sparkle breathes while it does), then writes: words
 * arrive out of a light blur, one dot of accent light marks the growing edge, and each citation
 * chip pops in behind its claim. Pointing at a chip lifts its source card and opens a small
 * preview of the passage; pointing at a card lights the chips that cite it. When the text settles
 * the label stops shimmering, follow-ups slide in under the answer, and the foot swaps the stop
 * button for copy / regenerate / feedback with the time the answer took on the right.
 * The styles are injected below, so no extra files are needed.
 */

export type AnswerSource = {
  /** Short label for the site, e.g. "Notion" – on the citation chip and the source card */
  name: string;
  /** Page or document title – the two lines on the card, the heading in the preview */
  title: string;
  /** Where the card and preview link to; the preview shows the host instead of the name */
  href?: string;
  /** Favicon: an inline SVG or an image, dropped into the 14px rounded tile */
  icon?: ReactNode;
  /** The passage itself, shown when a chip cites only this source */
  snippet?: string;
};

export type AIAnswerProps = {
  /** The question the answer replies to – the card's title */
  question?: string;
  /** Numbered in order: chip "1" and the "1" on the first card are the same source */
  sources: AnswerSource[];
  /**
   * The markdown-ish answer. Blank lines make paragraphs, "- " lines a list, `**bold**` is
   * heavier, and `[1]` or `[1,3]` (1-based) become citation chips.
   */
  answer: string;
  /** More text is still coming: the answer will not settle once it has caught up */
  streaming?: boolean;
  /** Stream the text in word by word; false shows the whole answer at once */
  animate?: boolean;
  /** Words per second while writing; the original demo writes at 38 */
  speed?: number;
  /** Related questions offered under the finished answer */
  followUps?: string[];
  onFollowUp?: (question: string) => void;
  onRegenerate?: () => void;
  onStop?: () => void;
  /** Thumbs. A down vote opens the reason chips; guessing why is up to the caller */
  onFeedback?: (value: "up" | "down", reason?: string) => void;
  /** The chips under a down vote – "Not accurate", "Wrong source", … */
  feedbackReasons?: string[];
  /** Called with the copied text: markup gone, sources numbered underneath */
  onCopy?: (text: string) => void;
  className?: string;
};

type Phase = "reading" | "writing" | "done" | "stopped";
type Vote = "up" | "down";

type WordToken = { kind: "word"; i: number; text: string; bold: boolean };
type CiteToken = { kind: "cite"; i: number; ids: number[] };
type Token = WordToken | CiteToken;
type Block = { kind: "p"; tokens: Token[] } | { kind: "ul"; items: Token[][] };

type Pop = { ids: number[]; left: number; top: number; width: number };

/** How long the reading beat lasts before the first word: 700ms plus 90ms per source card */
const READ_MS = 700;
const READ_PER_SOURCE_MS = 90;

/* ---------- The answer text ---------- */

/**
 * Splits "**bold**" and "[1,3]" out of a run of text. Citations are 1-based in the markup and
 * 0-based here; a citation that repeats the previous one is merged into the same chip, so
 * "[1][3]" reads "Notion +1" instead of two chips.
 */
function inlineTokens(text: string, sourceCount: number, counter: { n: number }): Token[] {
  const tokens: Token[] = [];

  for (const part of text.split(/(\*\*[^*]+\*\*|\[\d+(?:\s*,\s*\d+)*\])/)) {
    if (!part) continue;

    const cite = part.match(/^\[([\d,\s]+)\]$/);
    if (cite) {
      const ids = cite[1]
        .split(",")
        .map((n) => Number(n) - 1)
        .filter((id) => id >= 0 && id < sourceCount);
      if (!ids.length) continue;
      const previous = tokens[tokens.length - 1];
      if (previous?.kind === "cite") previous.ids = [...new Set([...previous.ids, ...ids])];
      else tokens.push({ i: counter.n++, kind: "cite", ids });
      continue;
    }

    const bold = part.startsWith("**");
    for (const piece of (bold ? part.slice(2, -2) : part).match(/\S+\s*|\s+/g) ?? []) {
      const last = tokens[tokens.length - 1];
      if (!piece.trim()) {
        if (last?.kind === "word") last.text += piece;
        continue;
      }
      tokens.push({ i: counter.n++, kind: "word", text: piece, bold });
    }
  }

  return tokens;
}

/** Paragraphs split on blank lines, list items on "- ", and every word gets an index */
function parseAnswer(markdown: string, sourceCount: number): { blocks: Block[]; total: number } {
  const counter = { n: 0 };
  const blocks: Block[] = [];

  for (const section of markdown.split(/\n\s*\n/)) {
    const lines = section.split("\n").filter((line) => line.trim());
    if (!lines.length) continue;
    if (lines.every((line) => /^\s*[-*]\s/.test(line))) {
      blocks.push({
        kind: "ul",
        items: lines.map((line) => inlineTokens(line.replace(/^\s*[-*]\s/, ""), sourceCount, counter)),
      });
    } else {
      blocks.push({ kind: "p", tokens: inlineTokens(lines.join(" "), sourceCount, counter) });
    }
  }

  return { blocks, total: counter.n };
}

/** The answer as plain text: markup gone, citations kept, sources listed underneath */
export function answerToPlainText(answer: string, sources: AnswerSource[]): string {
  const body = answer
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\s*\[(\d+(?:\s*,\s*\d+)*)\]/g, (_match: string, ids: string) => ` [${ids.replace(/\s/g, "")}]`)
    .trim();

  if (!sources.length) return body;

  return `${body}\n\nSources:\n${sources
    .map((source, index) => `[${index + 1}] ${source.title}${source.href ? ` – ${source.href}` : ""}`)
    .join("\n")}`;
}

/* ---------- The component ---------- */

export function AIAnswer({
  question,
  sources,
  answer,
  streaming = false,
  animate = true,
  speed = 38,
  followUps = [],
  onFollowUp,
  onRegenerate,
  onStop,
  onFeedback,
  feedbackReasons = ["Not accurate", "Wrong source", "Too long", "Out of date"],
  onCopy,
  className,
}: AIAnswerProps) {
  const { blocks, total } = useMemo(() => parseAnswer(answer, sources.length), [answer, sources.length]);

  const [generation, setGeneration] = useState(0);
  const [phase, setPhase] = useState<Phase>("reading");
  const [revealed, setRevealed] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [vote, setVote] = useState<Vote | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [pop, setPop] = useState<Pop | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const writtenRef = useRef(0);
  const startedRef = useRef(0);
  const answerRef = useRef(answer);
  const popTimerRef = useRef<number | undefined>(undefined);
  const popId = useId();

  const settled = phase === "done" || phase === "stopped";
  /* Reduced motion skips the reading beat and the word-by-word write; the sheet drops the animations */
  const still =
    !animate ||
    (typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true);

  /* A new answer – unless it only extends the last one, which is the same answer arriving */
  useEffect(() => {
    if (!answer.startsWith(answerRef.current)) setGeneration((n) => n + 1);
    answerRef.current = answer;
  }, [answer]);

  /* A fresh run: rewind the text, drop the old votes, read the sources first */
  useEffect(() => {
    startedRef.current = performance.now();
    writtenRef.current = 0;
    setRevealed(0);
    setVote(null);
    setReason(null);
    setCopied(false);
    setPop(null);

    if (still) {
      writtenRef.current = Number.POSITIVE_INFINITY;
      setPhase("writing");
      return;
    }

    setPhase("reading");
    const timer = window.setTimeout(
      () => setPhase("writing"),
      sources.length ? READ_MS + sources.length * READ_PER_SOURCE_MS : 0,
    );
    return () => window.clearTimeout(timer);
  }, [generation, sources.length, still]);

  /* Writing: one frame loop moves a fractional word cursor, whole words become visible */
  useEffect(() => {
    if (phase !== "writing") return;
    let frame = 0;
    let last = performance.now();

    const step = (time: number) => {
      writtenRef.current = Math.min(total, writtenRef.current + ((time - last) / 1000) * speed);
      last = time;
      setRevealed(Math.floor(writtenRef.current));

      if (writtenRef.current >= total && !streaming) {
        setElapsed(Math.max(0.1, Math.round((performance.now() - startedRef.current) / 100) / 10));
        setPhase("done");
        return;
      }
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [generation, phase, total, streaming, speed]);

  /* The card's height follows the content, so 44 pages of answer and one line animate the same */
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const inner = innerRef.current;
    if (!body || !inner) return;

    const resize = () => {
      body.style.height = `${inner.offsetHeight}px`;
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  /* Tick back from the copied check after a moment */
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  /* A chip's preview: centred on the chip, clamped inside the card, never wider than 300px */
  const openPop = (ids: number[], chip: HTMLElement) => {
    if (popTimerRef.current !== undefined) window.clearTimeout(popTimerRef.current);
    const root = rootRef.current;
    if (!root) return;

    const card = root.getBoundingClientRect();
    const target = chip.getBoundingClientRect();
    const width = Math.min(300, card.width - 16);
    const left = Math.max(
      8,
      Math.min(card.width - width - 8, target.left - card.left + target.width / 2 - width / 2),
    );

    setPop({ ids, left, top: target.bottom - card.top + 6, width });
  };

  /* A grace period, so the pointer can travel from the chip up into the preview */
  const closePop = () => {
    if (popTimerRef.current !== undefined) window.clearTimeout(popTimerRef.current);
    popTimerRef.current = window.setTimeout(() => setPop(null), 140);
  };

  const lit = new Set<number>(pop ? pop.ids : hovered === null ? [] : [hovered]);

  const copy = () => {
    const text = answerToPlainText(answer, sources);
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    onCopy?.(text);
  };

  const stop = () => {
    setElapsed(Math.max(0.1, Math.round((performance.now() - startedRef.current) / 100) / 10));
    setPhase("stopped");
    onStop?.();
  };

  const regenerate = () => {
    setGeneration((n) => n + 1);
    onRegenerate?.();
  };

  const voteOn = (value: Vote) => {
    const next = vote === value ? null : value;
    setVote(next);
    setReason(null);
    if (next === "up") onFeedback?.("up");
  };

  const status = copied
    ? "Copied"
    : vote === "up" || reason
      ? "Thanks for the feedback"
      : vote === "down"
        ? "What went wrong?"
        : phase === "stopped"
          ? "Stopped"
          : `Answered in ${elapsed}s`;

  const label =
    phase === "reading" ? `Reading ${sources.length} sources` : phase === "writing" ? "Writing" : "Answer";

  const renderTokens = (tokens: Token[]) =>
    tokens.map((token) => {
      if (token.i >= revealed) return null;

      const caret =
        phase === "writing" && token.i === revealed - 1 ? (
          <span className="ui-ansc__caret" aria-hidden="true" />
        ) : null;

      if (token.kind === "word") {
        return (
          <span className="ui-ansc__w" data-bold={token.bold || undefined} key={token.i}>
            {token.text}
            {caret}
          </span>
        );
      }

      const first = sources[token.ids[0]];
      return (
        <span className="ui-ansc__w" key={token.i}>
          <button
            type="button"
            className="ui-ansc__cite"
            data-lit={token.ids.some((id) => lit.has(id)) || undefined}
            aria-label={`Source: ${token.ids.map((id) => sources[id].title).join(", ")}`}
            aria-describedby={pop && pop.ids === token.ids ? popId : undefined}
            onMouseEnter={(event) => openPop(token.ids, event.currentTarget)}
            onMouseLeave={closePop}
            onFocus={(event) => openPop(token.ids, event.currentTarget)}
            onBlur={closePop}
            onClick={(event) => (pop?.ids === token.ids ? setPop(null) : openPop(token.ids, event.currentTarget))}
            onKeyDown={(event) => {
              if (event.key === "Escape") setPop(null);
            }}
          >
            {first.name}
            {token.ids.length > 1 && (
              <span className="ui-ansc__more">
                {"+"}
                {token.ids.length - 1}
              </span>
            )}
          </button>
          {caret}
        </span>
      );
    });

  return (
    <div
      ref={rootRef}
      className={["ui-ansc", className].filter(Boolean).join(" ")}
      data-phase={phase}
      onMouseLeave={() => setHovered(null)}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-ai-answer-clean" precedence="default">
        {css}
      </style>

      <div className="ui-ansc__card">
        <div ref={bodyRef} className="ui-ansc__body">
          <div ref={innerRef} className="ui-ansc__inner">
            {question && <h3 className="ui-ansc__question">{question}</h3>}

            {sources.length > 0 && (
              <div className="ui-ansc__sources" aria-label="Sources" role="list">
                {sources.map((source, index) => {
                  const content = (
                    <>
                      <span className="ui-ansc__site">
                        {source.icon && <span className="ui-ansc__favicon">{source.icon}</span>}
                        <span className="ui-ansc__site-name">{source.name}</span>
                        <span className="ui-ansc__num">{index + 1}</span>
                      </span>
                      <span className="ui-ansc__title">{source.title}</span>
                    </>
                  );

                  const isLit = lit.has(index) || undefined;
                  const delay = still ? "0ms" : `${120 + index * READ_PER_SOURCE_MS}ms`;

                  return (
                    <div role="listitem" className="ui-ansc__source-wrap" key={index}>
                      {source.href ? (
                        <a
                          className="ui-ansc__source"
                          data-lit={isLit}
                          style={{ animationDelay: delay }}
                          href={source.href}
                          target="_blank"
                          rel="noreferrer"
                          onMouseEnter={() => setHovered(index)}
                          onMouseLeave={() => setHovered(null)}
                        >
                          {content}
                        </a>
                      ) : (
                        <div
                          className="ui-ansc__source"
                          data-lit={isLit}
                          style={{ animationDelay: delay }}
                          onMouseEnter={() => setHovered(index)}
                          onMouseLeave={() => setHovered(null)}
                        >
                          {content}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="ui-ansc__label">
              <Mark />
              <span
                key={label}
                className={settled ? "ui-ansc__label-text" : "ui-ansc__label-text ui-ansc__shimmer"}
                data-text={label}
              >
                {label}
              </span>
            </div>

            <div className="ui-ansc__answer" aria-busy={!settled}>
              {phase === "writing" && revealed === 0 && (
                <p>
                  <span className="ui-ansc__caret" aria-hidden="true" />
                </p>
              )}
              {phase === "stopped" && revealed === 0 && (
                <p className="ui-ansc__empty">Stopped before answering.</p>
              )}
              {blocks.map((block, index) => {
                const start =
                  (block.kind === "p" ? block.tokens[0]?.i : block.items[0]?.[0]?.i) ??
                  Number.POSITIVE_INFINITY;
                if (start >= revealed) return null;

                return block.kind === "p" ? (
                  <p key={`${generation}-${index}`}>{renderTokens(block.tokens)}</p>
                ) : (
                  <ul key={`${generation}-${index}`}>
                    {block.items.map((item, itemIndex) =>
                      item[0] && item[0].i < revealed ? <li key={itemIndex}>{renderTokens(item)}</li> : null,
                    )}
                  </ul>
                );
              })}
            </div>

            {phase === "done" && followUps.length > 0 && (
              <div className="ui-ansc__follow">
                <span className="ui-ansc__follow-label">Related</span>
                {followUps.map((followUp, index) => (
                  <button
                    type="button"
                    className="ui-ansc__follow-item"
                    key={followUp}
                    style={{ animationDelay: `${still ? 0 : 80 + index * 60}ms` }}
                    onClick={() => onFollowUp?.(followUp)}
                  >
                    <span>{followUp}</span>
                    <Glyph d={GLYPHS.chevron} solid />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="ui-ansc__foot">
          {settled ? (
            <div className="ui-ansc__actions" key="actions">
              <button
                type="button"
                className="ui-ansc__action"
                aria-label={copied ? "Copied" : "Copy answer"}
                onClick={copy}
              >
                <Glyph d={copied ? GLYPHS.check : GLYPHS.copy} solid className={copied ? "ui-ansc__ok" : undefined} />
              </button>
              <button
                type="button"
                className="ui-ansc__action ui-ansc__redo"
                aria-label="Regenerate"
                onClick={regenerate}
              >
                <Glyph d={GLYPHS.redo} />
              </button>
              <button
                type="button"
                className="ui-ansc__action"
                aria-label="Good answer"
                aria-pressed={vote === "up"}
                onClick={() => voteOn("up")}
              >
                <Glyph d={GLYPHS.thumb} solid />
              </button>
              <button
                type="button"
                className="ui-ansc__action ui-ansc__down"
                aria-label="Bad answer"
                aria-pressed={vote === "down"}
                onClick={() => voteOn("down")}
              >
                <Glyph d={GLYPHS.thumb} solid />
              </button>
            </div>
          ) : (
            <button type="button" className="ui-ansc__stop" key="stop" onClick={stop}>
              <span className="ui-ansc__stop-icon" aria-hidden="true" />
              Stop
            </button>
          )}

          {settled && (
            <span className="ui-ansc__status" aria-live="polite" key={status}>
              {status.startsWith("Answered in ") ? (
                <>
                  <span className="ui-ansc__status-lead">Answered in </span>
                  {status.slice(12)}
                </>
              ) : (
                status
              )}
            </span>
          )}
        </div>

        <div className="ui-ansc__reasons" data-open={vote === "down" && !reason}>
          <div>
            {feedbackReasons.map((item) => (
              <button
                type="button"
                key={item}
                tabIndex={vote === "down" && !reason ? 0 : -1}
                onClick={() => {
                  setReason(item);
                  onFeedback?.("down", item);
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      {pop && (
        <div
          id={popId}
          role="tooltip"
          className="ui-ansc__pop"
          style={{ left: pop.left, top: pop.top, width: pop.width }}
          onMouseEnter={() => {
            if (popTimerRef.current !== undefined) window.clearTimeout(popTimerRef.current);
          }}
          onMouseLeave={closePop}
        >
          {pop.ids.map((id) => {
            const source = sources[id];
            return (
              <a
                className="ui-ansc__pop-item"
                href={source.href}
                target="_blank"
                rel="noreferrer"
                tabIndex={-1}
                key={id}
              >
                <span className="ui-ansc__site">
                  {source.icon && <span className="ui-ansc__favicon">{source.icon}</span>}
                  <span className="ui-ansc__site-name">
                    {source.href ? source.href.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] : source.name}
                  </span>
                  <span className="ui-ansc__num">{id + 1}</span>
                </span>
                <span className="ui-ansc__pop-title">{source.title}</span>
                {source.snippet && pop.ids.length === 1 && (
                  <span className="ui-ansc__snippet">{source.snippet}</span>
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Icons ---------- */

const GLYPHS = {
  copy: "M5.5 2A1.5 1.5 0 0 0 4 3.5V4h5A3 3 0 0 1 12 7v5h.5a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 12.5 2h-7ZM3.5 5A1.5 1.5 0 0 0 2 6.5v6A1.5 1.5 0 0 0 3.5 14H9a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 9 5H3.5Z",
  check:
    "M1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0Zm8.9-1.2a.5.5 0 0 0-.8-.6L7.44 9.23 6.35 8.15a.5.5 0 1 0-.7.7l1.5 1.5a.5.5 0 0 0 .76-.06l2.5-3.5Z",
  redo: "M13 8a5 5 0 1 1-1.46-3.54M13 2.5v2.5h-2.5",
  thumb:
    "M4.5 7v6.5H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h1.5Zm1 6.5h5.95a1.5 1.5 0 0 0 1.47-1.2l.86-4.3A1.5 1.5 0 0 0 12.31 6.2H9.5l.42-2.08A1.4 1.4 0 0 0 7.3 3.1L5.5 6.8v6.7Z",
  chevron: "M10.85 7.65a.5.5 0 0 1 0 .7L7.2 12a.5.5 0 0 1-.7-.7L9.79 8 6.5 4.7a.5.5 0 1 1 .7-.7l3.65 3.65Z",
} as const;

function Glyph({ d, solid = false, className }: { d: string; solid?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={["ui-ansc__glyph", className].filter(Boolean).join(" ")}
      data-solid={solid || undefined}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

/** The two sparks that lead the label: the big one breathes, the small one twinkles */
function Mark() {
  return (
    <svg viewBox="0 0 16 16" className="ui-ansc__mark" aria-hidden="true">
      <path
        className="ui-ansc__mark-big"
        d="M6.5 2.2c.2 0 .36.14.4.33.53 2.6 1.4 3.48 4 4.02a.4.4 0 0 1 0 .79c-2.6.53-3.47 1.4-4 4a.4.4 0 0 1-.8 0c-.53-2.6-1.4-3.47-4-4a.4.4 0 0 1 0-.79c2.6-.54 3.47-1.42 4-4.02a.4.4 0 0 1 .4-.33Z"
      />
      <path
        className="ui-ansc__mark-small"
        d="M12 9.6c.12 0 .22.08.25.2.28 1.3.72 1.75 2.03 2.03a.25.25 0 0 1 0 .49c-1.31.28-1.75.72-2.03 2.03a.25.25 0 0 1-.5 0c-.28-1.31-.72-1.75-2.03-2.03a.25.25 0 0 1 0-.49c1.31-.28 1.75-.73 2.03-2.03a.25.25 0 0 1 .25-.2Z"
      />
    </svg>
  );
}

const css = /* css */ `
.ui-ansc{--ui-ansc-card: #fffdfb;--ui-ansc-ink: rgba(11, 9, 8, 0.88);--ui-ansc-strong: #0b0908;--ui-ansc-text: rgba(11, 9, 8, 0.61);--ui-ansc-muted: rgba(11, 9, 8, 0.45);--ui-ansc-faint: rgba(11, 9, 8, 0.27);--ui-ansc-icon: rgba(11, 9, 8, 0.447);--ui-ansc-line: rgba(11, 9, 8, 0.06);--ui-ansc-fill: rgba(11, 9, 8, 0.06);--ui-ansc-fill-strong: rgba(11, 9, 8, 0.1);--ui-ansc-wash: rgba(11, 9, 8, 0.015);--ui-ansc-accent: rgba(217, 84, 31, 0.765);--ui-ansc-ok: #2f8d5c;--ui-ansc-shine: rgba(255, 253, 251, 0.82);--ui-ansc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-ansc-shadow-pop: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 12px 28px -10px rgba(11, 9, 8, 0.16), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-ansc-focus: rgba(217, 84, 31, 0.35);--ui-ansc-ease: cubic-bezier(0.22, 1, 0.36, 1);position: relative;box-sizing: border-box;container-type: inline-size;display: grid;width: 100%;max-width: 640px;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;font-weight: 400;color: var(--ui-ansc-ink);-webkit-font-smoothing: antialiased}
.ui-ansc *, .ui-ansc *::before, .ui-ansc *::after{box-sizing: border-box}
:where(.ui-ansc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;cursor: pointer}
:where(.ui-ansc) svg{display: block;flex: none}
.ui-ansc button:focus-visible, .ui-ansc a:focus-visible{outline: 2px solid var(--ui-ansc-focus);outline-offset: 1px}
.ui-ansc__card{overflow: hidden;border-radius: 10px;background: var(--ui-ansc-card);box-shadow: var(--ui-ansc-shadow)}
.ui-ansc__body{overflow: hidden;transition: height var(--nm-dur-4, 380ms) var(--ui-ansc-ease)}
.ui-ansc__inner{display: flow-root;padding: 20px 20px 16px}
.ui-ansc__question{margin: 0 0 14px;font-size: 15px;font-weight: 500;line-height: 24px;color: var(--ui-ansc-strong)}
.ui-ansc__sources{display: flex;gap: 8px;margin: 0 -20px;padding: 2px 20px 4px;overflow-x: auto;scroll-padding: 0 20px;scrollbar-width: none;-webkit-mask: linear-gradient(90deg, transparent, transparent 6px, #0b0908 20px, #0b0908 calc(100% - 120px), transparent calc(100% - 20px));mask: linear-gradient(90deg, transparent, transparent 6px, #0b0908 20px, #0b0908 calc(100% - 120px), transparent calc(100% - 20px))}
.ui-ansc__sources::-webkit-scrollbar{display: none}
.ui-ansc__source-wrap{flex: none;display: flex}
.ui-ansc__source{display: flex;flex-direction: column;gap: 4px;width: 168px;padding: 8px 10px 9px;border-radius: 8px;background: var(--ui-ansc-card);box-shadow: var(--ui-ansc-shadow);color: inherit;text-decoration: none;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));animation: ui-ansc-card var(--nm-dur-4, 380ms) var(--ui-ansc-ease) both}
a.ui-ansc__source:hover{background: var(--ui-ansc-wash)}
.ui-ansc__source[data-lit]{background: var(--ui-ansc-wash);box-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.1), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05)}
.ui-ansc__site{display: flex;align-items: center;gap: 6px;min-width: 0;font-size: 12px;line-height: 16px;color: var(--ui-ansc-text)}
.ui-ansc__site-name{flex: 1;min-width: 0;overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-ansc__num{flex: none;font-size: 10px;line-height: 16px;font-weight: 500;letter-spacing: 0.5px;font-variant-numeric: tabular-nums;color: var(--ui-ansc-faint)}
.ui-ansc__favicon{display: grid;flex: none;width: 14px;height: 14px;overflow: hidden;border-radius: 4px;box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.1)}
.ui-ansc__favicon svg{width: 100%;height: 100%}
.ui-ansc__title{display: -webkit-box;overflow: hidden;-webkit-line-clamp: 2;-webkit-box-orient: vertical;font-size: 13px;font-weight: 500;line-height: 20px;color: var(--ui-ansc-strong)}
.ui-ansc__label{display: flex;align-items: center;gap: 6px;margin: 16px 0 6px;font-size: 12px;line-height: 16px;color: var(--ui-ansc-text)}
.ui-ansc__mark{width: 16px;height: 16px;fill: var(--ui-ansc-accent);overflow: visible}
.ui-ansc__mark path{transform-box: fill-box;transform-origin: center}
.ui-ansc[data-phase="reading"] .ui-ansc__mark-big, .ui-ansc[data-phase="writing"] .ui-ansc__mark-big{animation: ui-ansc-breathe var(--nm-dur-6, 1100ms) ease-in-out infinite}
.ui-ansc[data-phase="reading"] .ui-ansc__mark-small, .ui-ansc[data-phase="writing"] .ui-ansc__mark-small{animation: ui-ansc-twinkle var(--nm-dur-6, 1100ms) ease-in-out infinite}
.ui-ansc__label-text{position: relative;animation: ui-ansc-fade var(--nm-dur-4, 380ms) var(--ui-ansc-ease) both}
.ui-ansc[data-phase="done"] .ui-ansc__label-text, .ui-ansc[data-phase="stopped"] .ui-ansc__label-text{color: var(--ui-ansc-text)}
.ui-ansc__answer{font-size: 13px;line-height: 20px;color: var(--ui-ansc-ink)}
.ui-ansc__answer p{margin: 0 0 8px}
.ui-ansc__answer ul{margin: 0 0 8px;padding: 0 0 0 18px}
.ui-ansc__answer li{margin: 0 0 4px;padding-left: 2px}
.ui-ansc__answer li::marker{color: var(--ui-ansc-faint)}
.ui-ansc__answer > :last-child{margin-bottom: 0}
.ui-ansc__empty{color: var(--ui-ansc-muted)}
.ui-ansc__w{animation: ui-ansc-word var(--nm-dur-4, 380ms) var(--ui-ansc-ease) both}
.ui-ansc__w[data-bold]{font-weight: 500;color: var(--ui-ansc-strong)}
.ui-ansc__caret{display: inline-block;width: 6px;height: 6px;margin-left: 4px;border-radius: 1.5px;background: var(--ui-ansc-accent);vertical-align: 0.1em;animation: ui-ansc-pulse var(--nm-dur-6, 1100ms) ease-in-out infinite}
.ui-ansc__cite{display: inline-flex;align-items: center;gap: 3px;height: 18px;margin: 0 1px 0 3px;padding: 0 6px;border-radius: 5px;background: var(--ui-ansc-fill);box-shadow: inset 0 0 0 0.5px var(--ui-ansc-line);font-size: 11px;font-weight: 500;line-height: 1;color: var(--ui-ansc-text);vertical-align: 0.1em;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));animation: ui-ansc-chip 380ms var(--ui-ansc-ease) both}
.ui-ansc__cite:hover, .ui-ansc__cite[data-lit]{background: var(--ui-ansc-fill-strong);color: var(--ui-ansc-ink)}
.ui-ansc__more{opacity: 0.7}
.ui-ansc__pop{position: absolute;z-index: 5;display: grid;gap: 2px;padding: 4px;border-radius: 10px;background: var(--ui-ansc-card);box-shadow: var(--ui-ansc-shadow-pop);animation: ui-ansc-pop var(--nm-dur-2, 160ms) var(--ui-ansc-ease) both}
.ui-ansc__pop-item{display: grid;gap: 2px;padding: 8px 10px 9px;border-radius: 6px;color: inherit;text-decoration: none;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-ansc__pop-item[href]:hover{background: var(--ui-ansc-wash)}
.ui-ansc__pop-title{font-size: 13px;font-weight: 500;line-height: 20px;color: var(--ui-ansc-strong)}
.ui-ansc__snippet{display: -webkit-box;overflow: hidden;-webkit-line-clamp: 3;-webkit-box-orient: vertical;font-size: 12px;line-height: 16px;color: var(--ui-ansc-text)}
.ui-ansc__follow{display: grid;margin-top: 16px}
.ui-ansc__follow-label{padding-bottom: 4px;font-size: 10px;font-weight: 500;line-height: 16px;letter-spacing: 0.5px;text-transform: uppercase;color: var(--ui-ansc-muted);animation: ui-ansc-fade var(--nm-dur-4, 380ms) var(--ui-ansc-ease) both}
.ui-ansc__follow-item{display: flex;align-items: center;justify-content: space-between;gap: 12px;min-height: 32px;padding: 6px 0;border-top: 0.5px solid var(--ui-ansc-line);text-align: left;color: var(--ui-ansc-ink);animation: ui-ansc-fade 380ms var(--ui-ansc-ease) both}
.ui-ansc__follow-item .ui-ansc__glyph{color: var(--ui-ansc-faint);transition: transform var(--nm-dur-3, 240ms) var(--ui-ansc-ease), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-ansc__follow-item:hover .ui-ansc__glyph{color: var(--ui-ansc-ink);transform: translateX(2px)}
.ui-ansc__foot{display: flex;align-items: center;justify-content: space-between;gap: 12px;height: 44px;padding: 0 12px 0 8px;border-top: 0.5px solid var(--ui-ansc-line)}
.ui-ansc__actions{display: flex;gap: 2px}
.ui-ansc__action{display: grid;place-items: center;width: 28px;height: 28px;border-radius: 6px;color: var(--ui-ansc-icon);transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));animation: ui-ansc-fade var(--nm-dur-4, 380ms) var(--ui-ansc-ease) both}
.ui-ansc__action:nth-child(2){animation-delay: 40ms}
.ui-ansc__action:nth-child(3){animation-delay: 80ms}
.ui-ansc__action:nth-child(4){animation-delay: 120ms}
.ui-ansc__action:hover{background: var(--ui-ansc-wash);color: var(--ui-ansc-ink)}
.ui-ansc__action[aria-pressed="true"]{background: var(--ui-ansc-fill);box-shadow: inset 0 0 0 0.5px var(--ui-ansc-line);color: var(--ui-ansc-ink)}
.ui-ansc__glyph{width: 16px;height: 16px;fill: none;stroke: currentColor;stroke-width: 1.1;stroke-linecap: round;stroke-linejoin: round}
.ui-ansc__glyph[data-solid]{fill: currentColor;stroke: none}
.ui-ansc__down .ui-ansc__glyph{transform: scaleY(-1)}
.ui-ansc__redo:active .ui-ansc__glyph{transform: rotate(120deg);transition: transform var(--nm-dur-3, 240ms) var(--ui-ansc-ease)}
.ui-ansc__ok{color: var(--ui-ansc-ok);animation: ui-ansc-chip var(--nm-dur-3, 240ms) var(--ui-ansc-ease) both}
.ui-ansc__action:has(.ui-ansc__ok){color: var(--ui-ansc-ok)}
.ui-ansc__status{font-size: 12px;line-height: 16px;white-space: nowrap;color: var(--ui-ansc-muted);animation: ui-ansc-fade var(--nm-dur-3, 240ms) var(--ui-ansc-ease) both}
@container (max-width: 330px){.ui-ansc__status-lead{display: none}
}
.ui-ansc__stop{display: inline-flex;align-items: center;gap: 6px;height: 28px;padding: 0 10px 0 8px;border-radius: 6px;background: var(--ui-ansc-card);box-shadow: var(--ui-ansc-shadow);font-size: 13px;font-weight: 500;color: var(--ui-ansc-strong);transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));animation: ui-ansc-fade var(--nm-dur-3, 240ms) var(--ui-ansc-ease) both}
.ui-ansc__stop:hover{background: #faf7f4}
.ui-ansc__stop-icon{width: 8px;height: 8px;margin: 0 2px;border-radius: 2px;background: var(--ui-ansc-ink)}
.ui-ansc__reasons{display: grid;grid-template-rows: 0fr;opacity: 0;transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-ansc-ease), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-ansc__reasons[data-open="true"]{grid-template-rows: 1fr;opacity: 1}
.ui-ansc__reasons > div{display: flex;flex-wrap: wrap;gap: 8px;min-height: 0;overflow: hidden;margin-top: -4px;padding: 4px 12px 0}
.ui-ansc__reasons[data-open="true"] > div{padding-bottom: 12px}
.ui-ansc__reasons button{height: 28px;padding: 0 10px;border-radius: 6px;box-shadow: inset 0 0 0 0.5px var(--ui-ansc-line);font-size: 13px;font-weight: 500;color: var(--ui-ansc-text);transition: color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-ansc__reasons button:hover{color: var(--ui-ansc-ink);background: var(--ui-ansc-fill)}
.ui-ansc__shimmer::after{content: attr(data-text);content: attr(data-text) / "";position: absolute;inset: 0;white-space: nowrap;color: transparent;background: linear-gradient(90deg, transparent 38%, var(--ui-ansc-shine) 50%, transparent 62%) 100% 0 / 300% 100% no-repeat;-webkit-background-clip: text;background-clip: text;animation: ui-ansc-sweep var(--nm-dur-6, 1100ms) linear infinite;pointer-events: none}
@keyframes ui-ansc-word{from{opacity: 0;filter: blur(3px)}
to{opacity: 1;filter: none}
}
@keyframes ui-ansc-card{from{opacity: 0;transform: translateY(4px) scale(0.97)}
to{opacity: 1;transform: none}
}
@keyframes ui-ansc-chip{from{opacity: 0;transform: scale(0.8)}
to{opacity: 1;transform: none}
}
@keyframes ui-ansc-fade{from{opacity: 0;transform: translateY(3px)}
to{opacity: 1;transform: none}
}
@keyframes ui-ansc-pop{from{opacity: 0;transform: translateY(-4px) scale(0.98)}
to{opacity: 1;transform: none}
}
@keyframes ui-ansc-pulse{50%{opacity: 0.3}
}
@keyframes ui-ansc-breathe{50%{transform: scale(0.86)}
}
@keyframes ui-ansc-twinkle{0%, 100%{opacity: 1;transform: none}
50%{opacity: 0.3;transform: scale(0.6) rotate(45deg)}
}
@keyframes ui-ansc-sweep{from{background-position: 100% 0}
to{background-position: 0% 0}
}
@container (max-width: 480px){.ui-ansc__inner{padding: 16px 16px 14px}
.ui-ansc__sources{margin: 0 -16px;padding: 2px 16px 4px;scroll-padding: 0 16px}
.ui-ansc__source{width: 150px}
}
@media (hover: none) and (pointer: coarse){.ui-ansc__action{width: 36px;height: 36px}
.ui-ansc__foot{height: 52px}
.ui-ansc__stop{height: 34px}
.ui-ansc__reasons button{height: 34px;padding: 0 12px}
.ui-ansc__follow-item{min-height: 44px}
.ui-ansc__cite{position: relative}
.ui-ansc__cite::after{content: "";position: absolute;inset: -10px -4px}
}
@media (prefers-reduced-motion: reduce){.ui-ansc *, .ui-ansc *::before, .ui-ansc *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-ansc{--ui-ansc-card: #211b16;--ui-ansc-ink: rgba(255, 253, 251, 0.9);--ui-ansc-strong: #fffdfb;--ui-ansc-text: rgba(255, 253, 251, 0.62);--ui-ansc-muted: rgba(255, 253, 251, 0.46);--ui-ansc-faint: rgba(255, 253, 251, 0.28);--ui-ansc-icon: rgba(255, 253, 251, 0.5);--ui-ansc-line: rgba(255, 253, 251, 0.08);--ui-ansc-fill: rgba(255, 253, 251, 0.08);--ui-ansc-fill-strong: rgba(255, 253, 251, 0.13);--ui-ansc-wash: rgba(255, 253, 251, 0.025);--ui-ansc-accent: #ff8a5c;--ui-ansc-ok: #2f8d5c;--ui-ansc-shine: #fffdfb;--ui-ansc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-ansc-shadow-pop: 0 0 0 0.5px rgba(255, 253, 251, 0.12), 0 12px 28px -10px rgba(11, 9, 8, 0.6);--ui-ansc-focus: rgba(255, 138, 92, 0.5)}
:where(.dark, [data-theme="dark"]) .ui-ansc__source[data-lit]{box-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.16)}
:where(.dark, [data-theme="dark"]) .ui-ansc__stop:hover{background: #27201a}
:where(.dark, [data-theme="dark"]) .ui-ansc__favicon{box-shadow: 0 0 0 0.5px rgba(255, 255, 255, 0.14)}

`;
