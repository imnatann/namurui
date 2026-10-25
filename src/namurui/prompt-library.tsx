"use client";

import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

/*
 * Prompt Library – saved templates with variables you type straight into the sentence.
 * Pick a template on the left and its body becomes editable: every {variable} is a field sized by
 * a hidden copy of its own text, and the finished prompt assembles underneath with the values in
 * bold and the blanks still showing their braces. Four bars in the header tick as the blanks fill,
 * the token estimate in the footer counts the assembled text, Use wakes up once nothing is blank
 * and pulses the first time it does, and Copy swaps the caption to a green "Copied".
 * Choosing another template fades the panel out while the new one rises in, and the grey pill in
 * the list glides to the new row. The styles are injected below, so no extra files are needed.
 */

export type PromptTone = "blue" | "violet" | "amber" | "green" | "red" | "gray";

/** What the field for one `{variable}` knows about itself. */
export type PromptVariable = {
  /** Said after the name when the field is announced, e.g. "Who reads the notes" */
  description?: string;
  /** Text the field starts with – the variable counts as filled meanwhile */
  default?: string;
};

export type PromptTemplate = {
  /** Stable identity – this is what `value` holds */
  id: string;
  /** The row in the list and the heading above the sentence */
  title: string;
  /** The small tag beside the title, e.g. "Product" */
  category?: string;
  /** Tag colour – the category order supplies one when it is left out */
  tone?: PromptTone;
  /** The sentence, with `{variables}` where the fields go */
  body: string;
  /** A description and a starting value per variable name */
  variables?: Record<string, PromptVariable>;
};

export type PromptLibraryProps = {
  /** The saved templates */
  templates: PromptTemplate[];
  /** Id of the chosen template (controlled) */
  value?: string;
  /** Id chosen at first when uncontrolled – the first template by default */
  defaultValue?: string;
  /** Called when another template is chosen */
  onSelect?: (id: string, template: PromptTemplate) => void;
  /** Called with the assembled prompt when Use is pressed – every variable is filled by then */
  onUse: (prompt: string, template: PromptTemplate, values: Record<string, string>) => void;
  /** Called after the prompt was handed to the clipboard */
  onCopy?: (prompt: string) => void;
  /** Heading above the list */
  title?: string;
  /** Placeholder and accessible name of the search field */
  searchPlaceholder?: string;
  /** Name of the list for screen readers */
  listLabel?: string;
  /** Small uppercase label over the assembled prompt */
  previewLabel?: string;
  /** Text of the copy button */
  copyLabel?: string;
  /** Text of the use button */
  useLabel?: string;
  /** Shown when the search matches nothing */
  emptyText?: string;
  /** Extra class on the root */
  className?: string;
};

const VAR = /\{([A-Za-z0-9_-]+)\}/g;

/* Category colours follow the order the categories appear */
const TONES: PromptTone[] = ["blue", "violet", "amber", "green", "red", "gray"];

/** One word of the sentence – either plain text or a field, and whether it must stay unbroken. */
type Segment = {
  /** A run of text with no spaces, wrapped so a field cannot break away from its punctuation */
  glue: boolean;
  /** The pieces inside it, in order */
  pieces: Array<{ text: string } | { name: string }>;
};

const splitInline = (source: string) => {
  const pieces: Segment["pieces"] = [];
  let last = 0;
  for (const match of source.matchAll(VAR)) {
    const at = match.index ?? 0;
    if (at > last) pieces.push({ text: source.slice(last, at) });
    pieces.push({ name: match[1] });
    last = at + match[0].length;
  }
  if (last < source.length) pieces.push({ text: source.slice(last) });
  return pieces;
};

/** Split the body at whitespace, keeping runs that hold a field whole, punctuation included. */
const segment = (body: string): Segment[] => {
  const segments: Segment[] = [];
  let text = "";
  const flush = () => {
    if (!text) return;
    segments.push({ glue: false, pieces: [{ text }] });
    text = "";
  };
  for (const run of body.split(/(\s+)/)) {
    if (!run) continue;
    if (/^\s+$/.test(run)) {
      text += run;
      continue;
    }
    const pieces = splitInline(run);
    if (pieces.some((piece) => "name" in piece)) {
      flush();
      segments.push({ glue: true, pieces });
    } else {
      text += run;
    }
  }
  flush();
  return segments;
};

const variableNames = (body: string) => {
  const names: string[] = [];
  for (const match of body.matchAll(VAR)) if (!names.includes(match[1])) names.push(match[1]);
  return names;
};

export function PromptLibrary({
  templates,
  value,
  defaultValue,
  onSelect,
  onUse,
  onCopy,
  title = "Prompts",
  searchPlaceholder = "Search templates",
  listLabel = "Templates",
  previewLabel = "Preview",
  copyLabel = "Copy",
  useLabel = "Use prompt",
  emptyText = "No matching templates",
  className,
}: PromptLibraryProps) {
  const uid = useId();
  const [innerId, setInnerId] = useState(defaultValue ?? templates[0]?.id ?? "");
  const chosenId = value ?? innerId;
  const chosen = templates.find((template) => template.id === chosenId) ?? templates[0];

  const [query, setQuery] = useState("");
  const [stored, setStored] = useState<Record<string, Record<string, string>>>({});
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [glide, setGlide] = useState({ y: 0, h: 0, on: false, moved: false });
  const [copied, setCopied] = useState(false);
  const [captionOut, setCaptionOut] = useState<string | null>(null);
  const [pulse, setPulse] = useState<"a" | "b" | null>(null);
  const [flash, setFlash] = useState<{ id: string; tone: "a" | "b" } | null>(null);
  const [status, setStatus] = useState("");

  const listRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const fieldRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const leaveTimer = useRef<number | undefined>(undefined);
  const copyTimer = useRef<number | undefined>(undefined);
  const captionTimer = useRef<number | undefined>(undefined);
  const pulseTimer = useRef<number | undefined>(undefined);
  const flashTimer = useRef<number | undefined>(undefined);
  const pulseSeq = useRef(0);
  const flashSeq = useRef(0);

  useEffect(
    () => () => {
      for (const timer of [leaveTimer, copyTimer, captionTimer, pulseTimer, flashTimer]) {
        if (timer.current) window.clearTimeout(timer.current);
      }
    },
    [],
  );

  /* The value a variable currently holds – what was typed, then its default */
  const valueOf = (template: PromptTemplate, name: string) =>
    stored[template.id]?.[name] ?? template.variables?.[name]?.default ?? "";

  const names = chosen ? variableNames(chosen.body) : [];
  const current: Record<string, string> = {};
  if (chosen) for (const name of names) current[name] = valueOf(chosen, name);

  const filled = names.filter((name) => current[name].trim() !== "").length;
  const ready = !!chosen && filled === names.length;

  /* The prompt as it would be sent – unfilled blanks keep their braces */
  const assembled = chosen
    ? chosen.body.replace(VAR, (whole, name: string) => (current[name]?.trim() ? current[name] : whole))
    : "";
  const tokens = Math.max(1, Math.ceil(assembled.length / 4));
  const caption = `~${tokens} tokens`;

  const q = query.trim().toLowerCase();
  const visible = q
    ? templates.filter(
        (template) =>
          template.title.toLowerCase().includes(q) || (template.category ?? "").toLowerCase().includes(q),
      )
    : templates;
  const visibleKey = visible.map((template) => template.id).join("|");
  const shownInList = visible.some((template) => template.id === chosen?.id);
  const tabbableId = shownInList ? chosen?.id : visible[0]?.id;

  const categoryOrder = Array.from(
    new Set(templates.map((template) => template.category).filter((name): name is string => !!name)),
  );
  const toneOf = (template: PromptTemplate): PromptTone => {
    if (template.tone) return template.tone;
    const at = template.category ? categoryOrder.indexOf(template.category) : -1;
    return at >= 0 ? TONES[at % TONES.length] : "gray";
  };

  /* Use pulses the first time every blank is filled */
  const wasReady = useRef(ready);
  useEffect(() => {
    if (!wasReady.current && ready) {
      pulseSeq.current += 1;
      setPulse(pulseSeq.current % 2 === 1 ? "a" : "b");
      if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
      pulseTimer.current = window.setTimeout(() => setPulse(null), 1400);
    }
    wasReady.current = ready;
  }, [ready]);

  /* The grey pill measures the chosen row and follows it */
  useLayoutEffect(() => {
    const list = listRef.current;
    const row = chosen?.id ? rowRefs.current[chosen.id] : null;
    if (!list || !row || !shownInList) {
      setGlide((prev) => (prev.on ? { ...prev, on: false } : prev));
      return;
    }
    const place = () => {
      const y = row.offsetTop;
      const h = row.offsetHeight;
      setGlide((prev) => (prev.on && prev.y === y && prev.h === h ? prev : { y, h, on: true, moved: true }));
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(list);
    return () => observer.disconnect();
  }, [chosen?.id, shownInList, visibleKey]);

  const select = (id: string) => {
    if (!chosen || id === chosen.id) return;
    const next = templates.find((template) => template.id === id);
    if (!next) return;
    if (value === undefined) setInnerId(id);
    onSelect?.(id, next);

    setLeavingId(chosen.id);
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => setLeavingId(null), 240);

    /* Values remembered from last time flash back into the sentence */
    const remembered = stored[id];
    if (remembered && Object.values(remembered).some((entry) => entry.trim() !== "")) {
      flashSeq.current += 1;
      setFlash({ id, tone: flashSeq.current % 2 === 1 ? "a" : "b" });
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlash(null), 1100);
    }
    setStatus(`${next.title} selected`);
  };

  const goTo = (index: number) => {
    const next = visible[index];
    if (!next) return;
    select(next.id);
    rowRefs.current[next.id]?.focus();
  };

  const step = (delta: 1 | -1) => {
    if (!visible.length) return;
    const at = visible.findIndex((template) => template.id === chosen?.id);
    goTo(Math.max(0, Math.min(visible.length - 1, at === -1 ? 0 : at + delta)));
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(assembled);
    } catch {
      /* The clipboard is blocked on insecure origins – the prompt is still on screen */
    }
    onCopy?.(assembled);
    setCopied(true);
    setCaptionOut(caption);
    setStatus("Prompt copied");
    if (captionTimer.current) window.clearTimeout(captionTimer.current);
    captionTimer.current = window.setTimeout(() => setCaptionOut(null), 220);
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 1600);
  };

  const applyPrompt = () => {
    if (!chosen || !ready) return;
    onUse(assembled, chosen, { ...current });
    setStatus("Prompt used");
  };

  const onFieldKey = (event: KeyboardEvent<HTMLInputElement>, templateId: string, name: string) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const template = templates.find((entry) => entry.id === templateId);
    if (!template) return;
    const rest = variableNames(template.body).filter((entry) => entry !== name);
    const nextEmpty = rest.find((entry) => valueOf(template, entry).trim() === "");
    if (nextEmpty) fieldRefs.current[nextEmpty]?.focus();
    else applyPrompt();
  };

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const target = visible.find((template) => template.id === chosen?.id) ?? visible[0];
      if (target) {
        select(target.id);
        rowRefs.current[target.id]?.focus();
      }
    } else if (event.key === "Escape") {
      setQuery("");
    }
  };

  const onOptionKey = (event: KeyboardEvent<HTMLDivElement>, id: string) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      goTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      goTo(visible.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select(id);
    }
  };

  const sentence = (template: PromptTemplate, outgoing: boolean) =>
    segment(template.body).map((part, index) => {
      if (!part.glue) {
        const only = part.pieces[0];
        return <Fragment key={`t${index}`}>{"text" in only ? only.text : ""}</Fragment>;
      }
      return (
        <span className="ui-plic__glue" key={`g${index}`}>
          {part.pieces.map((piece, at) => {
            if ("text" in piece) return <Fragment key={`t${at}`}>{piece.text}</Fragment>;
            const raw = valueOf(template, piece.name);
            const isFilled = raw.trim() !== "";
            const description = template.variables?.[piece.name]?.description;
            const flashes = !outgoing && flash?.id === template.id && isFilled;
            return (
              <span
                className="ui-plic__token"
                key={`v${at}`}
                data-filled={isFilled ? "" : undefined}
                data-flash={flashes ? flash.tone : undefined}
              >
                <span className="ui-plic__sizer" aria-hidden="true">
                  {raw || piece.name}
                </span>
                <input
                  className="ui-plic__input"
                  data-var={piece.name}
                  size={1}
                  placeholder={piece.name}
                  aria-label={description ? `${piece.name} – ${description}` : piece.name}
                  spellCheck={false}
                  autoComplete="off"
                  value={raw}
                  ref={(element) => {
                    if (!outgoing) fieldRefs.current[piece.name] = element;
                  }}
                  onChange={(event) =>
                    setStored((prev) => ({
                      ...prev,
                      [template.id]: { ...(prev[template.id] ?? {}), [piece.name]: event.target.value },
                    }))
                  }
                  onKeyDown={(event) => onFieldKey(event, template.id, piece.name)}
                />
              </span>
            );
          })}
        </span>
      );
    });

  const assembledSentence = (template: PromptTemplate) =>
    segment(template.body).map((part, index) => {
      if (!part.glue) {
        const only = part.pieces[0];
        return <Fragment key={`p${index}`}>{"text" in only ? only.text : ""}</Fragment>;
      }
      return (
        <span className="ui-plic__glue" key={`pg${index}`}>
          {part.pieces.map((piece, at) => {
            if ("text" in piece) return <Fragment key={`pt${at}`}>{piece.text}</Fragment>;
            const raw = valueOf(template, piece.name);
            if (raw.trim() === "")
              return (
                <span className="ui-plic__hole" key={`pv${at}`}>
                  {`{${piece.name}}`}
                </span>
              );
            return (
              <span
                className="ui-plic__fill"
                key={`pf${at}`}
                data-flash={flash?.id === template.id ? flash.tone : undefined}
              >
                {raw}
              </span>
            );
          })}
        </span>
      );
    });

  const renderPanel = (template: PromptTemplate, outgoing: boolean) => {
    const templateNames = variableNames(template.body);
    const filledHere = templateNames.filter((name) => valueOf(template, name).trim() !== "").length;
    return (
      <div
        className="ui-plic__panel"
        key={`${template.id}-${outgoing ? "out" : "in"}`}
        data-out={outgoing ? "" : undefined}
        aria-hidden={outgoing || undefined}
        inert={outgoing || undefined}
      >
        <div className="ui-plic__panel-head">
          <span className="ui-plic__panel-title">{template.title}</span>
          {template.category ? (
            <span className="ui-plic__tag" data-tone={toneOf(template)}>
              {template.category}
            </span>
          ) : null}
          <span className="ui-plic__count">
            <span className="ui-plic__bars" aria-hidden="true">
              {templateNames.map((name) => (
                <span
                  className="ui-plic__bar"
                  key={name}
                  data-on={valueOf(template, name).trim() !== "" ? "" : undefined}
                />
              ))}
            </span>
            {filledHere} of {templateNames.length} filled
          </span>
        </div>
        <p className="ui-plic__body">{sentence(template, outgoing)}</p>
        <div className="ui-plic__label" id={outgoing ? undefined : `${uid}-preview`}>
          {previewLabel}
        </div>
        <div
          className="ui-plic__preview"
          role="region"
          aria-labelledby={outgoing ? undefined : `${uid}-preview`}
        >
          {assembledSentence(template)}
        </div>
      </div>
    );
  };

  const leaving = leavingId ? templates.find((template) => template.id === leavingId) : undefined;

  return (
    <div
      className={["ui-plic", className].filter(Boolean).join(" ")}
      role="group"
      aria-labelledby={`${uid}-title`}
    >
      {/* React 19 hoists this into <head> once, no matter how many libraries render */}
      <style href="ui-prompt-library" precedence="default">
        {css}
      </style>

      <div className="ui-plic__card">
        <div className="ui-plic__cols">
          <div className="ui-plic__side">
            <div className="ui-plic__side-head">
              <span className="ui-plic__title" id={`${uid}-title`}>
                {title}
              </span>
              <span className="ui-plic__total">{templates.length}</span>
            </div>

            <label className="ui-plic__search">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle
                  cx="7.25"
                  cy="7.25"
                  r="4.25"
                  stroke="currentColor"
                  strokeWidth="1.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="m10.5 10.5 3 3"
                  stroke="currentColor"
                  strokeWidth="1.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <input
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                aria-controls={`${uid}-list`}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onSearchKey}
              />
            </label>

            <div className="ui-plic__list" id={`${uid}-list`} role="listbox" aria-label={listLabel} ref={listRef}>
              <span
                className="ui-plic__glide"
                aria-hidden="true"
                data-on={glide.on ? "" : undefined}
                data-moved={glide.moved ? "" : undefined}
                style={{ transform: `translateY(${glide.y}px)`, height: `${glide.h}px` }}
              />

              {visible.map((template) => (
                <div
                  className="ui-plic__option"
                  key={template.id}
                  role="option"
                  aria-selected={template.id === chosen?.id}
                  tabIndex={template.id === tabbableId ? 0 : -1}
                  ref={(element) => {
                    rowRefs.current[template.id] = element;
                  }}
                  onClick={() => select(template.id)}
                  onKeyDown={(event) => onOptionKey(event, template.id)}
                >
                  <span className="ui-plic__option-title">{template.title}</span>
                  {template.category ? (
                    <span className="ui-plic__tag" data-tone={toneOf(template)}>
                      {template.category}
                    </span>
                  ) : null}
                </div>
              ))}

              {visible.length === 0 ? <div className="ui-plic__empty">{emptyText}</div> : null}
            </div>
          </div>

          <div className="ui-plic__main">
            {leaving ? renderPanel(leaving, true) : null}
            {chosen ? renderPanel(chosen, false) : null}
          </div>
        </div>

        <div className="ui-plic__foot">
          <span className="ui-plic__caption">
            <span className="ui-plic__swap">
              {copied && captionOut !== null ? (
                <span className="ui-plic__swap-item" data-out="">
                  {captionOut}
                </span>
              ) : null}
              <span className="ui-plic__swap-item" key={copied ? "ok" : "count"} data-tone={copied ? "ok" : undefined}>
                {copied ? "Copied" : caption}
              </span>
            </span>
          </span>

          <button type="button" className="ui-plic__copy" aria-label="Copy prompt" onClick={copy}>
            <span className="ui-plic__copy-icon" key={copied ? "done" : "idle"} data-done={copied ? "" : undefined}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect
                  x="5.5"
                  y="5.5"
                  width="8"
                  height="8"
                  rx="1.75"
                  stroke="currentColor"
                  strokeWidth="1.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M10.5 5.5V4.25A1.75 1.75 0 0 0 8.75 2.5h-4.5A1.75 1.75 0 0 0 2.5 4.25v4.5c0 .97.78 1.75 1.75 1.75H5.5"
                  stroke="currentColor"
                  strokeWidth="1.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="ui-plic__copy-text">{copyLabel}</span>
          </button>

          <button
            type="button"
            className="ui-plic__use"
            aria-disabled={ready ? undefined : "true"}
            data-pulse={pulse ?? undefined}
            onClick={applyPrompt}
          >
            {useLabel}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M3.5 8h9M9 4.5 12.5 8 9 11.5"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <span className="ui-plic__sr" role="status" aria-live="polite">
        {status}
      </span>
    </div>
  );
}

const css = /* css */ `
.ui-plic{--ui-plic-card: #fffdfb;--ui-plic-ink: rgba(11, 9, 8, 0.88);--ui-plic-strong: #0b0908;--ui-plic-text: rgba(11, 9, 8, 0.61);--ui-plic-muted: rgba(11, 9, 8, 0.45);--ui-plic-faint: rgba(11, 9, 8, 0.27);--ui-plic-icon: rgba(11, 9, 8, 0.447);--ui-plic-line: rgba(11, 9, 8, 0.06);--ui-plic-line-strong: rgba(11, 9, 8, 0.1);--ui-plic-wash: rgba(11, 9, 8, 0.03);--ui-plic-well: rgba(11, 9, 8, 0.025);--ui-plic-fill: rgba(11, 9, 8, 0.06);--ui-plic-accent: rgba(217, 84, 31, 0.765);--ui-plic-accent-bg: rgba(217, 84, 31, 0.05);--ui-plic-pulse: rgba(11, 9, 8, 0.2);--ui-plic-accent-flash: rgba(217, 84, 31, 0.16);--ui-plic-on-ink: #fcf9f7;--ui-plic-ok: #2f8d5c;--ui-plic-blue: #d9541f;--ui-plic-blue-bg: rgba(217, 84, 31, 0.07);--ui-plic-violet: #c2703a;--ui-plic-violet-bg: rgba(255, 107, 53, 0.08);--ui-plic-amber: #9a6410;--ui-plic-amber-bg: rgba(217, 149, 48, 0.1);--ui-plic-green: #1a7a4a;--ui-plic-green-bg: rgba(47, 141, 92, 0.08);--ui-plic-red: #b3261e;--ui-plic-red-bg: rgba(226, 84, 74, 0.08);--ui-plic-gray: rgba(11, 9, 8, 0.61);--ui-plic-gray-bg: rgba(11, 9, 8, 0.05);--ui-plic-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-plic-focus: rgba(217, 84, 31, 0.35);--ui-plic-ease: cubic-bezier(0.22, 1, 0.36, 1);box-sizing: border-box;width: 100%;max-width: 640px;min-width: 0;container-type: inline-size;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;font-weight: 400;color: var(--ui-plic-ink);text-align: left;-webkit-font-smoothing: antialiased}
.ui-plic *, .ui-plic *::before, .ui-plic *::after{box-sizing: border-box}
:where(.ui-plic) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;text-align: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
:where(.ui-plic) input{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;outline: none}
.ui-plic button:focus-visible, .ui-plic__option:focus-visible{outline: 2px solid var(--ui-plic-focus);outline-offset: 1px}
:where(.ui-plic) svg{display: block;flex: none}
.ui-plic b{font-weight: 500;color: var(--ui-plic-ink)}
.ui-plic p{margin: 0}
.ui-plic__sr{position: absolute;width: 1px;height: 1px;overflow: hidden;clip-path: inset(50%);white-space: nowrap}
.ui-plic__card{overflow: hidden;border-radius: 10px;background: var(--ui-plic-card);box-shadow: var(--ui-plic-shadow)}
.ui-plic__cols{display: grid;grid-template-columns: 220px minmax(0, 1fr)}
.ui-plic__side{min-width: 0;padding: 12px 8px 8px;border-right: 0.5px solid var(--ui-plic-line)}
.ui-plic__side-head{display: flex;align-items: center;gap: 6px;height: 20px;padding: 0 8px}
.ui-plic__title{overflow: hidden;font-weight: 500;color: var(--ui-plic-strong);white-space: nowrap;text-overflow: ellipsis}
.ui-plic__total{font-size: 12px;line-height: 16px;color: var(--ui-plic-faint);font-variant-numeric: tabular-nums}
.ui-plic__search{display: flex;align-items: center;gap: 6px;height: 28px;margin-top: 10px;padding: 0 8px 0 6px;border-radius: 6px;box-shadow: inset 0 0 0 0.5px var(--ui-plic-line-strong);color: var(--ui-plic-icon);cursor: text;transition: box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-plic__search:hover{box-shadow: inset 0 0 0 0.5px rgba(11, 9, 8, 0.16)}
.ui-plic__search:focus-within{outline: 2px solid var(--ui-plic-focus);outline-offset: 1px}
.ui-plic__search input{flex: 1;min-width: 0;height: 100%;font-size: 13px;color: var(--ui-plic-ink);caret-color: var(--ui-plic-accent);-webkit-appearance: none;appearance: none}
.ui-plic__search input::placeholder{color: var(--ui-plic-faint)}
.ui-plic__search input::-webkit-search-cancel-button{-webkit-appearance: none}
.ui-plic__list{position: relative;isolation: isolate;display: flex;flex-direction: column;gap: 2px;margin-top: 8px}
.ui-plic__glide{position: absolute;top: 0;left: 0;right: 0;z-index: -1;border-radius: 6px;background: var(--ui-plic-fill);opacity: 0;pointer-events: none;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-plic__glide[data-on]{opacity: 1}
.ui-plic__glide[data-moved]{transition: transform 90ms ease-out, height 90ms ease-out, opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-plic__option{position: relative;display: flex;align-items: center;gap: 8px;height: 32px;padding: 0 6px 0 8px;border-radius: 6px;color: var(--ui-plic-text);cursor: pointer;user-select: none;transition: color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));-webkit-tap-highlight-color: transparent}
.ui-plic__option::before{content: "";position: absolute;inset: 0;z-index: -1;border-radius: inherit;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-plic__option:hover:not([aria-selected="true"])::before{background: var(--ui-plic-wash)}
.ui-plic__option:hover, .ui-plic__option[aria-selected="true"]{color: var(--ui-plic-ink)}
.ui-plic__option-title{flex: 1;min-width: 0;overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-plic__empty{height: 32px;padding: 0 8px;line-height: 32px;color: var(--ui-plic-muted)}
.ui-plic__tag{flex: none;height: 18px;padding: 0 6px;border-radius: 5px;font-size: 11px;font-weight: 500;line-height: 18px;white-space: nowrap;color: var(--ui-plic-gray);background: var(--ui-plic-gray-bg)}
.ui-plic__tag[data-tone="blue"]{color: var(--ui-plic-blue);background: var(--ui-plic-blue-bg)}
.ui-plic__tag[data-tone="violet"]{color: var(--ui-plic-violet);background: var(--ui-plic-violet-bg)}
.ui-plic__tag[data-tone="amber"]{color: var(--ui-plic-amber);background: var(--ui-plic-amber-bg)}
.ui-plic__tag[data-tone="green"]{color: var(--ui-plic-green);background: var(--ui-plic-green-bg)}
.ui-plic__tag[data-tone="red"]{color: var(--ui-plic-red);background: var(--ui-plic-red-bg)}
.ui-plic__main{display: grid;min-width: 0}
.ui-plic__panel{grid-area: 1 / 1;min-width: 0;padding: 12px 16px 16px;animation: ui-plic-in var(--nm-dur-4, 380ms) var(--ui-plic-ease) both}
.ui-plic__panel[data-out]{animation: ui-plic-out 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both;pointer-events: none}
.ui-plic__panel-head{display: flex;align-items: center;gap: 8px;min-height: 20px}
.ui-plic__panel-title{min-width: 0;overflow: hidden;font-weight: 500;color: var(--ui-plic-strong);white-space: nowrap;text-overflow: ellipsis}
.ui-plic__count{display: inline-flex;flex: none;align-items: center;gap: 8px;margin-left: auto;font-size: 12px;line-height: 16px;color: var(--ui-plic-muted);white-space: nowrap;font-variant-numeric: tabular-nums}
.ui-plic__bars{display: inline-flex;gap: 2px}
.ui-plic__bar{width: 6px;height: 6px;border-radius: 1.5px;background: var(--ui-plic-fill);transition: background-color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-plic__bar[data-on]{background: var(--ui-plic-accent)}
.ui-plic__body{margin-top: 10px !important;font-size: 13px;line-height: 28px;color: var(--ui-plic-ink);overflow-wrap: anywhere}
.ui-plic__glue{white-space: nowrap}
.ui-plic__preview .ui-plic__glue{white-space: inherit}
.ui-plic__token{position: relative;display: inline-grid;vertical-align: top;max-width: 100%;height: 22px;margin: 3px 0;padding: 0 6px;border-radius: 5px;background: var(--ui-plic-wash);box-shadow: inset 0 0 0 0.5px var(--ui-plic-line-strong);line-height: 22px;color: var(--ui-plic-ink);cursor: text;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-plic__token:hover{background: var(--ui-plic-fill)}
.ui-plic__token[data-filled]{background: var(--ui-plic-accent-bg);box-shadow: inset 0 0 0 0.5px transparent}
.ui-plic__token:focus-within{outline: 2px solid var(--ui-plic-focus);outline-offset: 1px}
.ui-plic__token[data-flash="a"]{animation: ui-plic-flash-a var(--nm-dur-6, 1100ms) ease-out}
.ui-plic__token[data-flash="b"]{animation: ui-plic-flash-b var(--nm-dur-6, 1100ms) ease-out}
.ui-plic__sizer, .ui-plic__input{grid-area: 1 / 1;min-width: 2ch;font-size: 13px;line-height: 22px;white-space: pre}
.ui-plic__sizer{padding-right: 1px;font-weight: 500;visibility: hidden;overflow: hidden}
.ui-plic__input{width: 100%;height: 22px;color: inherit;font-weight: 500;text-overflow: ellipsis;caret-color: var(--ui-plic-accent)}
.ui-plic__input::placeholder{color: var(--ui-plic-muted);font-weight: 400;opacity: 1}
.ui-plic__label{margin-top: 12px;font-size: 10px;font-weight: 500;line-height: 16px;letter-spacing: 0.5px;text-transform: uppercase;color: var(--ui-plic-muted)}
.ui-plic__preview{margin-top: 4px;padding: 8px 12px;border-radius: 8px;background: var(--ui-plic-well);box-shadow: inset 0 0 0 0.5px var(--ui-plic-line);font-size: 13px;line-height: 20px;color: var(--ui-plic-text);white-space: pre-wrap;overflow-wrap: anywhere}
.ui-plic__fill{border-radius: 4px;color: var(--ui-plic-ink);font-weight: 500;box-decoration-break: clone;-webkit-box-decoration-break: clone}
.ui-plic__fill[data-flash="a"]{animation: ui-plic-mark-a 1100ms ease-out}
.ui-plic__fill[data-flash="b"]{animation: ui-plic-mark-b 1100ms ease-out}
.ui-plic__hole{color: var(--ui-plic-faint)}
.ui-plic__foot{display: flex;align-items: center;gap: 8px;height: 44px;padding: 0 8px 0 16px;border-top: 0.5px solid var(--ui-plic-line)}
.ui-plic__caption{flex: 1;min-width: 0;overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-plic-muted);white-space: nowrap;text-overflow: ellipsis;font-variant-numeric: tabular-nums}
.ui-plic__swap{display: grid;min-width: 0}
.ui-plic__swap-item{grid-area: 1 / 1;min-width: 0;overflow: hidden;text-overflow: ellipsis;animation: ui-plic-swap-in var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-plic__swap-item[data-out]{animation: ui-plic-swap-out var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-plic__swap-item[data-tone="ok"]{color: var(--ui-plic-ok)}
.ui-plic__copy{display: inline-flex;flex: none;align-items: center;gap: 6px;height: 28px;padding: 0 10px 0 8px;border-radius: 6px;background: var(--ui-plic-card);box-shadow: var(--ui-plic-shadow);font-size: 13px;font-weight: 500;color: var(--ui-plic-strong);white-space: nowrap;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-plic__copy:hover:not(:disabled){background: color-mix(in srgb, var(--ui-plic-card), #000 3%)}
.ui-plic__copy-icon{display: grid;place-items: center;width: 16px;height: 16px;color: var(--ui-plic-icon);animation: ui-plic-swap-in var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-plic__copy-icon[data-done]{color: var(--ui-plic-ok)}
.ui-plic__use{position: relative;display: inline-flex;flex: none;align-items: center;gap: 6px;height: 28px;padding: 0 8px 0 10px;border-radius: 6px;background: var(--ui-plic-ink);font-size: 13px;font-weight: 500;color: var(--ui-plic-on-ink);white-space: nowrap;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-plic__use svg{transition: transform var(--nm-dur-3, 240ms) var(--ui-plic-ease)}
.ui-plic__use:hover:not([aria-disabled="true"]){background: var(--ui-plic-strong)}
.ui-plic__use:hover:not([aria-disabled="true"]) svg{transform: translateX(2px)}
.ui-plic__use[aria-disabled="true"]{background: var(--ui-plic-fill);color: var(--ui-plic-muted);cursor: default}
.ui-plic__use[data-pulse="a"]{animation: ui-plic-pulse-a var(--nm-dur-6, 1100ms) ease-out}
.ui-plic__use[data-pulse="b"]{animation: ui-plic-pulse-b var(--nm-dur-6, 1100ms) ease-out}
@keyframes ui-plic-in{from{opacity: 0;filter: blur(2px);transform: translateY(3px)}
}
@keyframes ui-plic-out{to{opacity: 0;filter: blur(2px)}
}
@keyframes ui-plic-swap-in{from{opacity: 0;filter: blur(2px)}
}
@keyframes ui-plic-swap-out{from{opacity: 1}
to{opacity: 0;filter: blur(2px)}
}
@keyframes ui-plic-flash-a{from{background-color: var(--ui-plic-accent-flash)}
}
@keyframes ui-plic-flash-b{from{background-color: var(--ui-plic-accent-flash)}
}
@keyframes ui-plic-mark-a{from{background-color: var(--ui-plic-accent-flash);box-shadow: 0 0 0 2px var(--ui-plic-accent-flash)}
to{background-color: transparent;box-shadow: 0 0 0 2px transparent}
}
@keyframes ui-plic-mark-b{from{background-color: var(--ui-plic-accent-flash);box-shadow: 0 0 0 2px var(--ui-plic-accent-flash)}
to{background-color: transparent;box-shadow: 0 0 0 2px transparent}
}
@keyframes ui-plic-pulse-a{0%{box-shadow: 0 0 0 0 var(--ui-plic-pulse)}
60%, 100%{box-shadow: 0 0 0 6px transparent}
}
@keyframes ui-plic-pulse-b{0%{box-shadow: 0 0 0 0 var(--ui-plic-pulse)}
60%, 100%{box-shadow: 0 0 0 6px transparent}
}
@container (max-width: 540px){.ui-plic__cols{grid-template-columns: minmax(0, 1fr)}
.ui-plic__side{border-right: 0;border-bottom: 0.5px solid var(--ui-plic-line)}
}
@container (max-width: 360px){.ui-plic__copy{width: 28px;padding: 0;justify-content: center}
.ui-plic__copy-text{display: none}
.ui-plic__count .ui-plic__bars{display: none}
.ui-plic__panel{padding: 12px 12px 14px}
.ui-plic__foot{padding-left: 12px}
}
@media (pointer: coarse){.ui-plic__option{height: 40px}
.ui-plic__search{height: 36px}
.ui-plic__copy, .ui-plic__use{height: 34px}
.ui-plic__copy{padding-right: 12px}
.ui-plic__foot{height: 50px}
.ui-plic__body{line-height: 32px}
.ui-plic__token, .ui-plic__input, .ui-plic__sizer{height: 26px;line-height: 26px}
}
@media (prefers-reduced-motion: reduce){.ui-plic *, .ui-plic *::before, .ui-plic *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-plic{--ui-plic-card: #211b16;--ui-plic-ink: rgba(255, 253, 251, 0.9);--ui-plic-strong: #fffdfb;--ui-plic-text: rgba(255, 253, 251, 0.62);--ui-plic-muted: rgba(255, 253, 251, 0.46);--ui-plic-faint: rgba(255, 253, 251, 0.3);--ui-plic-icon: rgba(255, 253, 251, 0.5);--ui-plic-line: rgba(255, 253, 251, 0.08);--ui-plic-line-strong: rgba(255, 253, 251, 0.12);--ui-plic-wash: rgba(255, 253, 251, 0.04);--ui-plic-well: rgba(255, 253, 251, 0.03);--ui-plic-fill: rgba(255, 253, 251, 0.08);--ui-plic-accent: #ff8a5c;--ui-plic-accent-bg: rgba(255, 138, 92, 0.14);--ui-plic-pulse: rgba(255, 253, 251, 0.25);--ui-plic-accent-flash: rgba(255, 138, 92, 0.3);--ui-plic-on-ink: #211b16;--ui-plic-ok: #2f8d5c;--ui-plic-blue: #ffb28f;--ui-plic-blue-bg: rgba(255, 138, 92, 0.14);--ui-plic-violet: #ff8a5c;--ui-plic-violet-bg: rgba(255, 138, 92, 0.15);--ui-plic-amber: #e8b05c;--ui-plic-amber-bg: rgba(217, 149, 48, 0.14);--ui-plic-green: #4f9d6e;--ui-plic-green-bg: rgba(47, 141, 92, 0.16);--ui-plic-red: #f0938c;--ui-plic-red-bg: rgba(226, 84, 74, 0.15);--ui-plic-gray: rgba(255, 253, 251, 0.62);--ui-plic-gray-bg: rgba(255, 253, 251, 0.08);--ui-plic-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-plic-focus: rgba(255, 138, 92, 0.45)}
:where(.dark, [data-theme="dark"]) .ui-plic__search:hover{box-shadow: inset 0 0 0 0.5px rgba(255, 253, 251, 0.18)}
:where(.dark, [data-theme="dark"]) .ui-plic__copy:hover:not(:disabled){background: #27201a}
:where(.dark, [data-theme="dark"]) .ui-plic__use:hover:not([aria-disabled="true"]){background: #fffdfb}

`;
