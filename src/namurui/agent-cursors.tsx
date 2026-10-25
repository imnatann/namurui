"use client";

import { Fragment, useState, type CSSProperties, type ReactElement } from "react";

/*
 * Agent Cursors – several agents editing one document at the same time, in a single
 * self-contained file. Each agent has a pointer with a caret on the line it is typing, an
 * arrow in its own ink and a dark flag that carries its name, what it is doing and what it
 * has cost. The pointers glide from line to line, suggestions stay in the text (underlined
 * for new, struck through for removed) until they are accepted, and comment pins grow into
 * their card when opened. A fade mask turns the page into a window onto a longer document,
 * and the tabs swap the same content for its table view.
 * The styles are injected below, so no extra files are needed.
 */

/** Brand mark on an agent's face and its comment pins */
export type AgentMark = "claude" | "gemini" | "codex" | "openai";

export type Agent = {
  /** Stable id – cursors and comments point at it */
  id: string;
  /** Name on the pointer flag and in the face tooltip */
  name: string;
  /** What it is doing right now – the second line of the flag */
  doing: string;
  /** Its brand mark; without one the initial shows instead */
  mark?: AgentMark;
  /** Letter on the face when it has no brand mark */
  initial?: string;
  /** In the document right now – it gets a turning ring and counts in the header. Defaults to true */
  here?: boolean;
  /** Its ink, set as --ui-agcc-c; without one it shares the document ink */
  color?: string;
};

/** One run of text inside a block – plain, typed in, or struck through */
export type TextRun = {
  text: string;
  /** "ins" for a typed addition, "del" for a removal still on the page */
  kind?: "plain" | "ins" | "del";
  /** The run's suggestion bubble is open */
  open?: boolean;
};

export type TextFields = {
  /** Stable id – this is what the pin and the caret anchor to */
  id: string;
  text: string;
  /** Overrides `text` when the block carries suggestions */
  runs?: readonly TextRun[];
  /** Character the caret is typing from; the whole text is on the page at 0 */
  from?: number;
};

export type TextBlock = TextFields & { kind: "title" | "heading" | "paragraph" };
export type CodeBlock = TextFields & { kind: "code" };
export type ListBlock = { kind: "list"; id?: string; items: readonly TextFields[] };

export type FigureBlock = {
  kind: "figure";
  id: string;
  /** Share of the page width in percent, or any CSS width */
  width?: number | string;
  /** Height in px while the image is still loading */
  height?: number;
  /** The text wraps around it */
  float?: "left" | "right";
  /** Once set the shimmer is replaced by the image */
  src?: string;
  alt?: string;
  caption?: string;
  /** Outline the frame – the image is being resized or discussed */
  held?: boolean;
};

export type Block = TextBlock | CodeBlock | ListBlock | FigureBlock;

/** The suggestion an agent is offering at its pointer */
export type CursorPopover = {
  /** The suggestion itself */
  note: string;
  /** Verb after the agent's name, e.g. "suggests an edit" */
  label?: string;
  /** Offset from the pointer, in px */
  x?: number;
  y?: number;
  acceptLabel?: string;
  rejectLabel?: string;
  onAccept?: () => void;
  onReject?: () => void;
};

export type Cursor = {
  /** The agent this pointer belongs to */
  agent: string;
  /** Position inside the sheet, in px */
  x: number;
  y: number;
  /** Caret height – the line height under the pointer */
  height?: number;
  /** Sideways nudge of the flag, in px */
  shift?: number;
  /** Pointer only, no caret – it is moving the mouse rather than typing */
  free?: boolean;
  /** Typing, so the caret stops blinking */
  typing?: boolean;
  /** The arrow is pressed down */
  press?: boolean;
  /** It has moved elsewhere – the pointer fades back */
  dim?: boolean;
  /** It has left the document */
  gone?: boolean;
  /** It has just arrived – no pop-in */
  arrive?: boolean;
  /** It is inside a comment card, so its flag hides */
  inNote?: boolean;
  /** It is dragging a selection, so it does not glide */
  drag?: boolean;
  /** Opacity of the pointer and its flag – for a fade while it works */
  opacity?: number;
  /** What it has spent, shown as a tag on the flag */
  cost?: number;
  /** Overrides the agent's doing line */
  doing?: string;
  /** Its ink, set as --ui-agcc-c */
  color?: string;
  /** The suggestion bubble it is offering */
  popover?: CursorPopover;
};

export type Comment = {
  /** Stable id – the anchor is keyed on it */
  id: string;
  /** Author agent */
  agent: string;
  /** Author name; defaults to the agent's */
  author?: string;
  /** Time label in the card */
  time?: string;
  text: string;
  /** Overrides `text` when the note carries suggestions */
  runs?: readonly TextRun[];
  /** Anchor inside the sheet, in px */
  x: number;
  y: number;
  /** Size of the opened card */
  width?: number;
  height?: number;
  /** Sideways offset of the card from the anchor */
  offsetX?: number;
  /** The card opens above the anchor */
  up?: boolean;
  /** Text in the reply field */
  reply?: string;
};

/** A highlight behind a stretch of the page – an agent's selection or a changed range */
export type Mark = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Its ink, set as --ui-agcc-c */
  color?: string;
  /** Another agent has the floor, so it fades back */
  dim?: boolean;
};

export type PillTone = "gray" | "blue" | "green" | "amber";

export type TableRow = {
  id: string;
  item: string;
  owner: string;
  status: string;
  /** Colour of the status pill */
  tone?: PillTone;
};

export type DocTable = {
  /** Column headers; three by default */
  columns?: readonly string[];
  rows?: readonly TableRow[];
  addLabel?: string;
  onAddRow?: () => void;
};

export type AgentCursorsView = "doc" | "table";

export type AgentCursorsProps = {
  /** Extra class on the root */
  className?: string;
  /** Document name in the top bar */
  title?: string;
  agents?: readonly Agent[];
  cursors?: readonly Cursor[];
  blocks?: readonly Block[];
  comments?: readonly Comment[];
  marks?: readonly Mark[];
  /** Which view the tabs show */
  view?: AgentCursorsView;
  onViewChange?: (view: AgentCursorsView) => void;
  /** The agent you are following, if any */
  followed?: string | null;
  onFollow?: (agent: string | null) => void;
  /** The comment whose card is open, if any */
  openComment?: string | null;
  onCommentOpen?: (comment: string | null) => void;
  /** Total spent; defaults to the sum of the pointers' costs */
  spent?: number;
  onAcceptAll?: () => void;
  onReplyChange?: (comment: string, reply: string) => void;
  onResolve?: (comment: string) => void;
  table?: DocTable;
  /** Visible height of the sheet, in px */
  height?: number;
  /** Fade the sheet out at the bottom */
  fade?: boolean;
  /** Announcement text for the live region */
  live?: string;
};

export function AgentCursors({
  className,
  title = "Untitled document",
  agents = [],
  cursors = [],
  blocks = [],
  comments = [],
  marks = [],
  view = "doc",
  onViewChange,
  followed = null,
  onFollow,
  openComment = null,
  onCommentOpen,
  spent,
  onAcceptAll,
  onReplyChange,
  onResolve,
  table,
  height = 620,
  fade = true,
  live = "",
}: AgentCursorsProps) {
  const agentById: Record<string, Agent> = {};
  for (const agent of agents) agentById[agent.id] = agent;

  const hereCount = agents.filter((agent) => agent.here !== false).length;
  const total = spent ?? cursors.reduce((sum, cursor) => sum + (cursor.cost ?? 0), 0);
  const pending = blocks.some((block) => {
    const runs =
      block.kind === "figure"
        ? []
        : block.kind === "list"
          ? block.items.flatMap((item) => item.runs ?? [])
          : (block.runs ?? []);
    return runs.some((run) => run.kind === "ins" || run.kind === "del");
  });
  const columns = table?.columns ?? ["Block", "Owner", "Status"];
  const rows = table?.rows ?? [];

  return (
    <div
      className={["ui-agcc", className].filter(Boolean).join(" ")}
      data-fade={fade ? "" : undefined}
      style={{ "--ui-agcc-height": `${height}px` } as CSSProperties}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-agent-cursors" precedence="default">
        {css}
      </style>

      <div className="ui-agcc__tabs" role="tablist" aria-label="Views">
        <button
          type="button"
          role="tab"
          className="ui-agcc__tab"
          aria-selected={view === "doc"}
          onClick={() => onViewChange?.("doc")}
        >
          Doc
        </button>
        <button
          type="button"
          role="tab"
          className="ui-agcc__tab"
          aria-selected={view === "table"}
          onClick={() => onViewChange?.("table")}
        >
          Table
        </button>
      </div>

      <div className="ui-agcc__stage">
        <div className="ui-agcc__shade" aria-hidden="true">
          <span />
        </div>

        <div className="ui-agcc__sheet">
          <header className="ui-agcc__bar">
            <span className="ui-agcc__doc" aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2.5H7.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7z" />
                <path d="M14 2.5V7h4.5M9 12.5h6M9 16h4" />
              </svg>
            </span>
            <span className="ui-agcc__title">{title}</span>

            <div className="ui-agcc__people" role="group" aria-label="Agents in this document">
              {agents.map((agent) => {
                const pressed = followed === agent.id;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    className="ui-agcc__face"
                    aria-pressed={pressed}
                    aria-label={`Follow ${agent.name} – ${agent.doing}`}
                    data-here={agent.here === false ? undefined : ""}
                    style={agent.color ? ({ "--ui-agcc-c": agent.color } as CSSProperties) : undefined}
                    onClick={() => onFollow?.(pressed ? null : agent.id)}
                  >
                    <span className="ui-agcc__face-mark">
                      <FaceMark agent={agent} />
                    </span>
                    <span className="ui-agcc__face-tip" aria-hidden="true">
                      <b>{agent.name}</b>
                      <span>{agent.doing}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <span className="ui-agcc__sum">
              {hereCount} here
              <b className="ui-agcc__spent" data-zero={total === 0 ? "" : undefined}>
                {`$${total.toFixed(2)}`}
              </b>
            </span>

            <button type="button" className="ui-agcc__all" disabled={!pending} onClick={onAcceptAll}>
              Accept all
            </button>
          </header>

          <div className="ui-agcc__paper" aria-hidden="true" />

          <div className="ui-agcc__marks" aria-hidden="true">
            {marks.map((mark) => (
              <span
                key={mark.id}
                className="ui-agcc__mark"
                data-dim={mark.dim ? "" : undefined}
                style={
                  {
                    left: mark.x,
                    top: mark.y,
                    width: mark.width,
                    height: mark.height,
                    ...(mark.color ? { "--ui-agcc-c": mark.color } : null),
                  } as CSSProperties
                }
              />
            ))}
          </div>

          <div className="ui-agcc__text" key={view}>
            {view === "table" ? (
              <div className="ui-agcc__table-card">
                <table className="ui-agcc__table">
                  <thead>
                    <tr>
                      {columns.map((column) => (
                        <th key={column} scope="col">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.item}</td>
                        <td>{row.owner}</td>
                        <td>
                          <span className="ui-agcc__pill" data-tone={row.tone ?? "gray"}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={columns.length}>
                        <AddRowButton label={table?.addLabel ?? "Add block"} onClick={table?.onAddRow} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              blocks.map((block) => <BlockView key={block.id ?? block.kind} block={block} />)
            )}
          </div>
        </div>

        <div className="ui-agcc__notes">
          {comments.map((comment) => {
            const agent = agentById[comment.agent];
            const author = comment.author ?? agent?.name ?? comment.agent;
            const open = openComment === comment.id;
            return (
              <div
                key={comment.id}
                className="ui-agcc__pin"
                data-comment={comment.id}
                data-open={open ? "" : undefined}
                data-up={comment.up ? "" : undefined}
                style={
                  {
                    left: comment.x,
                    top: comment.y,
                    "--ui-agcc-pin-h": `${comment.height ?? 132}px`,
                    "--ui-agcc-pin-w": `${comment.width ?? 248}px`,
                    "--ui-agcc-pin-x": `${comment.offsetX ?? 0}px`,
                  } as CSSProperties
                }
              >
                <div className="ui-agcc__pin-box">
                  <span className="ui-agcc__pin-mark">
                    <FaceMark agent={agent} fallback={author.slice(0, 1)} />
                  </span>
                  <button
                    type="button"
                    className="ui-agcc__pin-hit"
                    aria-expanded={open}
                    aria-label={`Comment from ${author}: ${comment.text}`}
                    tabIndex={0}
                    onClick={() => onCommentOpen?.(open ? null : comment.id)}
                  />
                  <div
                    className="ui-agcc__pin-body"
                    role="group"
                    aria-label={`Comment from ${author}`}
                    aria-hidden={open ? undefined : true}
                  >
                    <div className="ui-agcc__note-head">
                      <b>{author}</b>
                      <span>{comment.time ?? "now"}</span>
                    </div>
                    <p className="ui-agcc__note-text" data-block={comment.id}>
                      <Typed text={comment.text} runs={comment.runs} />
                    </p>
                    <div className="ui-agcc__pin-actions">
                      <input
                        className="ui-agcc__reply"
                        placeholder="Reply"
                        aria-label={`Reply to ${author}`}
                        tabIndex={open ? 0 : -1}
                        value={comment.reply ?? ""}
                        onChange={(event) => onReplyChange?.(comment.id, event.target.value)}
                      />
                      <button
                        type="button"
                        className="ui-agcc__resolve"
                        aria-label="Resolve"
                        title="Resolve"
                        tabIndex={open ? 0 : -1}
                        onClick={() => onResolve?.(comment.id)}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="ui-agcc__cursors" aria-hidden="true">
          {cursors.map((cursor) => {
            const agent = agentById[cursor.agent];
            const name = agent?.name ?? cursor.agent;
            const doing = cursor.doing ?? agent?.doing ?? "";
            return (
              <div
                key={cursor.agent}
                className="ui-agcc__cursor"
                data-agent={cursor.agent}
                data-free={cursor.free ? "" : undefined}
                data-typing={cursor.typing ? "" : undefined}
                data-press={cursor.press ? "" : undefined}
                data-dim={cursor.dim ? "" : undefined}
                data-gone={cursor.gone ? "" : undefined}
                data-arrive={cursor.arrive ? "" : undefined}
                data-in-note={cursor.inNote ? "" : undefined}
                data-drag={cursor.drag ? "" : undefined}
                style={
                  {
                    transform: `translate(${cursor.x}px, ${cursor.y}px)`,
                    "--ui-agcc-h": `${cursor.height ?? 18}px`,
                    "--ui-agcc-shift": `${cursor.shift ?? 0}px`,
                    ...(cursor.color ? { "--ui-agcc-c": cursor.color } : null),
                  } as CSSProperties
                }
              >
                <div
                  className="ui-agcc__cursor-in"
                  style={cursor.opacity === undefined ? undefined : { opacity: cursor.opacity }}
                >
                  <span className="ui-agcc__caret" />
                  <svg className="ui-agcc__arrow" viewBox="-2.186 -0.256 18.514 22.277">
                    <path
                      transform="rotate(21.37)"
                      d="M13.92 4.07c1.69.66 3.03 1.18 3.94 1.68.46.25.87.53 1.16.86.31.35.51.79.48 1.29-.03.51-.27.92-.62 1.23-.33.3-.77.53-1.25.74-.96.4-2.36.78-4.12 1.26-.56.15-.98.27-1.26.37-.26.1-.38.18-.47.27-.09.09-.17.21-.27.47-.1.28-.22.7-.37 1.26-.48 1.76-.86 3.16-1.26 4.12-.2.49-.44.93-.74 1.25-.32.35-.72.6-1.23.62-.51.03-.94-.17-1.29-.48-.33-.29-.61-.7-.86-1.16-.5-.91-1.02-2.25-1.68-3.94L1.66 7.76C.96 5.99.41 4.59.16 3.51-.09 2.44-.12 1.39.63.63 1.39-.12 2.44-.09 3.51.16c1.08.25 2.48.8 4.25 1.5l6.16 2.41Z"
                    />
                  </svg>
                  <span className="ui-agcc__flag">
                    <span className="ui-agcc__flag-row">
                      <span className="ui-agcc__flag-name">{name}</span>
                      {cursor.cost === undefined ? null : (
                        <span className="ui-agcc__flag-tags">
                          <span className="ui-agcc__flag-tag">{`$${cursor.cost.toFixed(2)}`}</span>
                        </span>
                      )}
                    </span>
                    <span className="ui-agcc__flag-doing" data-on={doing ? "" : undefined}>
                      <span>{doing}</span>
                    </span>
                  </span>

                  {cursor.popover ? (
                    <div
                      className="ui-agcc__pop"
                      style={{ left: cursor.popover.x ?? 14, top: cursor.popover.y ?? 26 }}
                    >
                      <div className="ui-agcc__pop-head">
                        <span className="ui-agcc__pop-mark">
                          <FaceMark agent={agent} fallback={name.slice(0, 1)} />
                        </span>
                        <b>{name}</b>
                        <span>{cursor.popover.label ?? "suggests an edit"}</span>
                      </div>
                      <p className="ui-agcc__pop-note">{cursor.popover.note}</p>
                      <div className="ui-agcc__pop-actions">
                        <button
                          type="button"
                          className="ui-agcc__btn"
                          onClick={cursor.popover.onReject}
                        >
                          {cursor.popover.rejectLabel ?? "Reject"}
                        </button>
                        <button
                          type="button"
                          className="ui-agcc__btn ui-agcc__btn--primary"
                          onClick={cursor.popover.onAccept}
                        >
                          {cursor.popover.acceptLabel ?? "Accept"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <span className="ui-agcc__live" role="status" aria-live="polite">
        {live}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ blocks */

function BlockView({ block }: { block: Block }) {
  if (block.kind === "figure") return <FigureView block={block} />;

  if (block.kind === "list") {
    return (
      <ul className="ui-agcc__list">
        {block.items.map((item) => (
          <li key={item.id} className="ui-agcc__block ui-agcc__block--item" data-block={item.id}>
            <Typed text={item.text} runs={item.runs} from={item.from} />
          </li>
        ))}
      </ul>
    );
  }

  if (block.kind === "code") {
    return (
      <pre className="ui-agcc__code" data-block={block.id}>
        <code>
          <Typed text={block.text} runs={block.runs} from={block.from} />
        </code>
      </pre>
    );
  }

  const Tag = block.kind === "title" ? "h2" : block.kind === "heading" ? "h3" : "p";
  return (
    <Tag className={`ui-agcc__block ui-agcc__block--${block.kind}`} data-block={block.id}>
      <Typed text={block.text} runs={block.runs} from={block.from} />
    </Tag>
  );
}

function FigureView({ block }: { block: FigureBlock }) {
  return (
    <figure
      className="ui-agcc__figure"
      data-block={block.id}
      data-kind="image"
      data-float={block.float}
      data-fit=""
      style={{ width: typeof block.width === "number" ? `${block.width}%` : block.width }}
    >
      <div
        className="ui-agcc__img"
        data-loading={block.src ? undefined : ""}
        data-held={block.held ? "" : undefined}
        role="img"
        aria-label={block.src ? (block.alt ?? "") : "Image loading"}
        style={{ height: block.height ?? 88 }}
      >
        {block.src ? (
          <img src={block.src} alt={block.alt ?? ""} />
        ) : (
          <span className="ui-agcc__shimmer" aria-hidden="true" />
        )}
      </div>
      {block.caption ? <figcaption className="ui-agcc__caption">{block.caption}</figcaption> : null}
    </figure>
  );
}

/** A block's text, with typed-in and struck-through runs where it has suggestions */
function Typed({
  text,
  runs,
  from = 0,
}: {
  text: string;
  runs?: readonly TextRun[];
  from?: number;
}) {
  return (
    <span data-from={from}>
      {runs
        ? runs.map((run, index) =>
            run.kind === "ins" || run.kind === "del" ? (
              <span
                key={index}
                className={run.kind === "ins" ? "ui-agcc__ins" : "ui-agcc__del"}
                data-open={run.open ? "" : undefined}
              >
                {run.text}
              </span>
            ) : (
              <Fragment key={index}>{run.text}</Fragment>
            ),
          )
        : text}
    </span>
  );
}

function AddRowButton({ label, onClick }: { label: string; onClick?: () => void }) {
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type="button"
      className="ui-agcc__add"
      data-hover={hover ? "" : undefined}
      data-pressed={pressed ? "" : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onClick={onClick}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ helpers */

/** The agent's brand mark, or its initial when it has none */
function FaceMark({ agent, fallback }: { agent?: Agent; fallback?: string }) {
  if (agent?.mark) return AgentMarks[agent.mark];
  return (
    <span className="ui-agcc__face-initial">
      {agent?.initial ?? fallback ?? agent?.name.slice(0, 1) ?? "?"}
    </span>
  );
}

const AgentMarks: Record<AgentMark, ReactElement> = {
  claude: (
    <svg viewBox="0 0 1200 1200" aria-hidden="true">
      <path
        fill="#D97757"
        d="M 233.959793 800.214905 L 468.644287 668.536987 L 472.590637 657.100647 L 468.644287 650.738403 L 457.208069 650.738403 L 417.986633 648.322144 L 283.892639 644.69812 L 167.597321 639.865845 L 54.926208 633.825623 L 26.577238 627.785339 L 3.3e-05 592.751709 L 2.73832 575.27533 L 26.577238 559.248352 L 60.724873 562.228149 L 136.187973 567.382629 L 249.422867 575.194763 L 331.570496 580.026978 L 453.261841 592.671082 L 472.590637 592.671082 L 475.328857 584.859009 L 468.724915 580.026978 L 463.570557 575.194763 L 346.389313 495.785217 L 219.543671 411.865906 L 153.100723 363.543762 L 117.181267 339.060425 L 99.060455 316.107361 L 91.248367 266.01355 L 123.865784 230.093994 L 167.677887 233.073853 L 178.872513 236.053772 L 223.248367 270.201477 L 318.040283 343.570496 L 441.825592 434.738342 L 459.946411 449.798706 L 467.194672 444.64447 L 468.080597 441.020203 L 459.946411 427.409485 L 392.617493 305.718323 L 320.778564 181.932983 L 288.80542 130.630859 L 280.348999 99.865845 C 277.369171 87.221436 275.194641 76.590698 275.194641 63.624268 L 312.322174 13.20813 L 332.8591 6.604126 L 382.389313 13.20813 L 403.248352 31.328979 L 434.013519 101.71814 L 483.865753 212.537048 L 561.181274 363.221497 L 583.812134 407.919434 L 595.892639 449.315491 L 600.40271 461.959839 L 608.214783 461.959839 L 608.214783 454.711609 L 614.577271 369.825623 L 626.335632 265.61084 L 637.771851 131.516846 L 641.718201 93.745117 L 660.402832 48.483276 L 697.530334 24.000122 L 726.52356 37.852417 L 750.362549 72 L 747.060486 94.067139 L 732.886047 186.201416 L 705.100708 330.52356 L 686.979919 427.167847 L 697.530334 427.167847 L 709.61084 415.087341 L 758.496704 350.174561 L 840.644348 247.490051 L 876.885925 206.738342 L 919.167847 161.71814 L 946.308838 140.29541 L 997.61084 140.29541 L 1035.38269 196.429626 L 1018.469849 254.416199 L 965.637634 321.422852 L 921.825562 378.201538 L 859.006714 462.765259 L 819.785278 530.41626 L 823.409424 535.812073 L 832.75177 534.92627 L 974.657776 504.724915 L 1051.328979 490.872559 L 1142.818848 475.167786 L 1184.214844 494.496582 L 1188.724854 514.147644 L 1172.456421 554.335693 L 1074.604126 578.496765 L 959.838989 601.449829 L 788.939636 641.879272 L 786.845764 643.409485 L 789.261841 646.389343 L 866.255127 653.637634 L 899.194702 655.409424 L 979.812134 655.409424 L 1129.932861 666.604187 L 1169.154419 692.537109 L 1192.671265 724.268677 L 1188.724854 748.429688 L 1128.322144 779.194641 L 1046.818848 759.865845 L 856.590759 714.604126 L 791.355774 698.335754 L 782.335693 698.335754 L 782.335693 703.731567 L 836.69812 756.885986 L 936.322205 846.845581 L 1061.073975 962.81897 L 1067.436279 991.490112 L 1051.409424 1014.120911 L 1034.496704 1011.704712 L 924.885986 929.234924 L 882.604126 892.107544 L 786.845764 811.48999 L 780.483276 811.48999 L 780.483276 819.946289 L 802.550415 852.241699 L 919.087341 1027.409424 L 925.127625 1081.127686 L 916.671204 1098.604126 L 886.469849 1109.154419 L 853.288696 1103.114136 L 785.073914 1007.355835 L 714.684631 899.516785 L 657.906067 802.872498 L 650.979858 806.81897 L 617.476624 1167.704834 L 601.771851 1186.147705 L 565.530212 1200 L 535.328857 1177.046997 L 519.302124 1139.919556 L 535.328857 1066.550537 L 554.657776 970.792053 L 570.362488 894.68457 L 584.536926 800.134277 L 592.993347 768.724976 L 592.429626 766.630859 L 585.503479 767.516968 L 514.22821 865.369263 L 405.825531 1011.865906 L 320.053711 1103.677979 L 299.516815 1111.812256 L 263.919525 1093.369263 L 267.221497 1060.429688 L 287.114136 1031.114136 L 405.825531 880.107361 L 477.422913 786.52356 L 523.651062 732.483276 L 523.328918 724.671265 L 520.590698 724.671265 L 205.288605 929.395935 L 149.154434 936.644409 L 124.993355 914.01355 L 127.973183 876.885986 L 139.409409 864.80542 L 234.201385 799.570435 L 233.879227 799.8927 Z"
      />
    </svg>
  ),
  gemini: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="gm_r_2_" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1C7DFF" />
          <stop offset="0.52" stopColor="#1C69FF" />
          <stop offset="1" stopColor="#B04DFF" />
        </linearGradient>
      </defs>
      <path
        fill="url(#gm_r_2_)"
        d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"
      />
    </svg>
  ),
  codex: (
    <svg viewBox="-2 -2 29 29" aria-hidden="true">
      <rect x="0" y="0" width="5" height="5" fill="#FFD800" />
      <rect x="20" y="0" width="5" height="5" fill="#FFD800" />
      <rect x="0" y="5" width="5" height="5" fill="#FFAF00" />
      <rect x="5" y="5" width="5" height="5" fill="#FFAF00" />
      <rect x="15" y="5" width="5" height="5" fill="#FFAF00" />
      <rect x="20" y="5" width="5" height="5" fill="#FFAF00" />
      <rect x="0" y="10" width="5" height="5" fill="#FF8205" />
      <rect x="5" y="10" width="5" height="5" fill="#FF8205" />
      <rect x="10" y="10" width="5" height="5" fill="#FF8205" />
      <rect x="15" y="10" width="5" height="5" fill="#FF8205" />
      <rect x="20" y="10" width="5" height="5" fill="#FF8205" />
      <rect x="0" y="15" width="5" height="5" fill="#FA500F" />
      <rect x="10" y="15" width="5" height="5" fill="#FA500F" />
      <rect x="20" y="15" width="5" height="5" fill="#FA500F" />
      <rect x="0" y="20" width="5" height="5" fill="#E10500" />
      <rect x="20" y="20" width="5" height="5" fill="#E10500" />
    </svg>
  ),
  openai: (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ color: "var(--ui-agcc-strong, #000)" }}
    >
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  ),
};

const css = /* css */ `
.ui-agcc{--ui-agcc-card: #fffdfb;--ui-agcc-tray: #f4ece5;--ui-agcc-strong: #0b0908;--ui-agcc-ink: rgba(11, 9, 8, 0.88);--ui-agcc-text: rgba(11, 9, 8, 0.72);--ui-agcc-muted: rgba(11, 9, 8, 0.45);--ui-agcc-faint: rgba(11, 9, 8, 0.27);--ui-agcc-line: rgba(11, 9, 8, 0.06);--ui-agcc-stroke: rgba(11, 9, 8, 0.05);--ui-agcc-grid: rgba(11, 9, 8, 0.05);--ui-agcc-gap: 16px;--ui-agcc-chip: rgba(11, 9, 8, 0.06);--ui-agcc-shimmer: rgba(11, 9, 8, 0.04);--ui-agcc-shine: rgba(11, 9, 8, 0.015);--ui-agcc-code: rgba(11, 9, 8, 0.025);--ui-agcc-ring: rgba(217, 84, 31, 0.35);--ui-agcc-solid: rgba(11, 9, 8, 0.88);--ui-agcc-on-solid: #fcf9f7;--ui-agcc-agent: #231d18;--ui-agcc-flag: #1a1512;--ui-agcc-flag-ink: #fffdfb;--ui-agcc-flag-soft: rgba(255, 253, 251, 0.14);--ui-agcc-edge: linear-gradient(90deg, #e2544a, #ff8a5c 55%, #ff6b35);--ui-agcc-c: var(--ui-agcc-agent);--ui-agcc-pop: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 12px 28px -10px rgba(11, 9, 8, 0.18), 0 1px 2px rgba(11, 9, 8, 0.05);--ui-agcc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-agcc-glide: 560ms;--ui-agcc-ease: cubic-bezier(0.32, 0.72, 0.24, 1);position: relative;box-sizing: border-box;width: 100%;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;font-weight: 400;line-height: 20px;color: var(--ui-agcc-text);text-align: left;-webkit-font-smoothing: antialiased}
.ui-agcc *, .ui-agcc *::before, .ui-agcc *::after{box-sizing: border-box}
:where(.ui-agcc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;text-align: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-agcc button:focus-visible{outline: 2px solid var(--ui-agcc-ring);outline-offset: 2px}
.ui-agcc svg{display: block;flex: none}
.ui-agcc__stage{position: relative}
.ui-agcc{container: agc / inline-size}
.ui-agcc__tabs{display: flex;gap: 6px;margin: 0 0 6px}
.ui-agcc__tab{height: 30px;padding: 0 12px;border-radius: 9px;background: rgba(11, 9, 8, 0.05);font-size: 13px;font-weight: 500;color: var(--ui-agcc-muted);transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agcc__tab:hover{color: var(--ui-agcc-ink)}
.ui-agcc__tab[aria-selected="true"]{background: var(--ui-agcc-card);box-shadow: inset 0 0 0 1px var(--ui-agcc-stroke), 0 1px 2px rgba(11, 9, 8, 0.05);color: var(--ui-agcc-ink)}
:where(.dark, [data-theme="dark"]) .ui-agcc__tab{background: rgba(255, 253, 251, 0.06)}
.ui-agcc__text{animation: ui-agcc-view 380ms var(--ui-agcc-ease) both}
@keyframes ui-agcc-view{from{opacity: 0;filter: blur(2px);transform: translateY(4px)}
}
.ui-agcc__table-card{overflow: hidden;border-radius: 12px;box-shadow: inset 0 0 0 1px var(--ui-agcc-line), 0 1px 2px rgba(11, 9, 8, 0.04);transition: height var(--nm-dur-4, 380ms) var(--ui-agcc-ease)}
.ui-agcc__table{width: 100%;border-collapse: collapse;table-layout: fixed;font-size: 13.5px;line-height: 20px}
.ui-agcc__table :is(th, td){height: 40px;padding: 0 12px;border-top: 1px solid var(--ui-agcc-grid);border-left: 1px solid var(--ui-agcc-grid);text-align: left;vertical-align: middle;white-space: nowrap;overflow: hidden;text-overflow: ellipsis}
.ui-agcc__table :is(th, td):first-child{border-left: 0}
.ui-agcc__table th:first-child{width: 38%}
.ui-agcc__table th{border-top: 0;font-size: 12.5px;font-weight: 500;color: var(--ui-agcc-muted)}
.ui-agcc__table td{color: var(--ui-agcc-ink)}
.ui-agcc__table tfoot td{height: 44px;padding: 0 6px}
.ui-agcc__add{display: inline-flex;align-items: center;gap: 8px;height: 30px;padding: 0 10px;border-radius: 8px;font-size: 13.5px;font-weight: 500;color: var(--ui-agcc-muted);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agcc__add[data-hover]{background: rgba(11, 9, 8, 0.04);color: var(--ui-agcc-ink)}
.ui-agcc__add[data-pressed]{background: rgba(11, 9, 8, 0.08);transform: scale(0.97)}
:where(.dark, [data-theme="dark"]) .ui-agcc__add[data-hover]{background: rgba(255, 253, 251, 0.06)}
:where(.dark, [data-theme="dark"]) .ui-agcc__add[data-pressed]{background: rgba(255, 253, 251, 0.1)}
.ui-agcc__table tbody tr{animation: ui-agcc-row var(--nm-dur-4, 380ms) var(--ui-agcc-ease) both}
@keyframes ui-agcc-row{from{opacity: 0;transform: translateY(-6px)}
}
.ui-agcc__pill{display: inline-flex;align-items: center;height: 22px;padding: 0 8px;border-radius: 999px;background: var(--ui-agcc-pill-bg);font-size: 12px;font-weight: 500;color: var(--ui-agcc-pill-fg)}
.ui-agcc__pill[data-tone="gray"]{--ui-agcc-pill-bg: rgba(11, 9, 8, 0.05);--ui-agcc-pill-fg: #5f4f41}
.ui-agcc__pill[data-tone="blue"]{--ui-agcc-pill-bg: #f4ece4;--ui-agcc-pill-fg: #ff6b35}
.ui-agcc__pill[data-tone="green"]{--ui-agcc-pill-bg: #ece4db;--ui-agcc-pill-fg: #1a7a4a}
.ui-agcc__pill[data-tone="amber"]{--ui-agcc-pill-bg: #fff3e0;--ui-agcc-pill-fg: #d9541f}
:where(.dark, [data-theme="dark"]) .ui-agcc__pill[data-tone="gray"]{--ui-agcc-pill-bg: rgba(255, 253, 251, 0.08);--ui-agcc-pill-fg: #97887b}
:where(.dark, [data-theme="dark"]) .ui-agcc__pill[data-tone="blue"]{--ui-agcc-pill-bg: #a33f16;--ui-agcc-pill-fg: #ff8a5c}
:where(.dark, [data-theme="dark"]) .ui-agcc__pill[data-tone="green"]{--ui-agcc-pill-bg: #1a7a4a;--ui-agcc-pill-fg: #2f8d5c}
:where(.dark, [data-theme="dark"]) .ui-agcc__pill[data-tone="amber"]{--ui-agcc-pill-bg: #a33f16;--ui-agcc-pill-fg: #ff8a5c}
.ui-agcc__sheet{position: relative;overflow: hidden;border-radius: 20px;background: var(--ui-agcc-tray)}
.ui-agcc__paper{position: absolute;inset: 48px 4px 4px;z-index: 0;border-radius: 16px;background: var(--ui-agcc-card);box-shadow: 0 0 0 1px var(--ui-agcc-line), 0 1px 2px rgba(11, 9, 8, 0.04)}
.ui-agcc[data-fade] .ui-agcc__sheet{height: var(--ui-agcc-height)}
.ui-agcc__shade{position: absolute;inset: -40px;pointer-events: none}
.ui-agcc__shade > span{position: absolute;inset: 40px;border-radius: 20px;box-shadow: 0 0 0 1px var(--ui-agcc-stroke), 0 1px 2px rgba(11, 9, 8, 0.05), 0 2px 10px rgba(11, 9, 8, 0.055)}
.ui-agcc[data-fade] .ui-agcc__shade{bottom: auto;height: calc(var(--ui-agcc-height) + 80px)}
.ui-agcc[data-fade] .ui-agcc__sheet{-webkit-mask: linear-gradient(#0b0908 0, #0b0908 calc(var(--ui-agcc-height) * 0.5), transparent calc(var(--ui-agcc-height) * 0.97));mask: linear-gradient(#0b0908 0, #0b0908 calc(var(--ui-agcc-height) * 0.5), transparent calc(var(--ui-agcc-height) * 0.97))}
.ui-agcc[data-fade] .ui-agcc__shade{-webkit-mask: linear-gradient(#0b0908 0, #0b0908 calc(40px + var(--ui-agcc-height) * 0.5), transparent calc(40px + var(--ui-agcc-height) * 0.97));mask: linear-gradient(#0b0908 0, #0b0908 calc(40px + var(--ui-agcc-height) * 0.5), transparent calc(40px + var(--ui-agcc-height) * 0.97))}
.ui-agcc__bar{position: relative;z-index: 3;display: flex;align-items: center;gap: 8px;min-width: 0;height: 48px;padding: 0 12px 0 16px}
.ui-agcc__doc{display: grid;flex: none;place-items: center;color: var(--ui-agcc-muted)}
.ui-agcc__title{flex: 1;min-width: 0;overflow: hidden;font-size: 13.5px;font-weight: 500;color: var(--ui-agcc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-agcc__sum{flex: none;font-size: 12.5px;color: var(--ui-agcc-muted);font-variant-numeric: tabular-nums}
.ui-agcc__spent{margin-left: 8px;font-weight: 600;color: var(--ui-agcc-ink);transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agcc__spent[data-zero]{opacity: 0.35}
.ui-agcc__all{flex: none;height: 28px;padding: 0 11px;border-radius: 9px;background: var(--ui-agcc-ink);font-size: 12.5px;font-weight: 500;color: var(--ui-agcc-card);transition: opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agcc__all:hover:not(:disabled){opacity: 0.86}
.ui-agcc__all:disabled{opacity: 0.2;cursor: default}
.ui-agcc__people{display: flex;flex: none;align-items: center}
.ui-agcc__face:first-child{margin-left: 0}
.ui-agcc__face{position: relative;display: grid;place-items: center;width: 28px;height: 28px;margin-left: 4px;border-radius: 50%;background: var(--ui-agcc-card);box-shadow: 0 0 0 2px var(--ui-agcc-tray), inset 0 0 0 1.5px var(--ui-agcc-line);transition: transform var(--nm-dur-3, 240ms) var(--ui-agcc-ease), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agcc__face:not([data-here]){opacity: 0.4}
.ui-agcc__face[data-here]::before{content: "";position: absolute;inset: 0;border-radius: 50%;background: conic-gradient(from 0deg, transparent 0deg, transparent 60deg, var(--ui-agcc-c) 360deg);-webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #0b0908 calc(100% - 1.5px));mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #0b0908 calc(100% - 1.5px));animation: ui-agcc-spin var(--nm-dur-6, 1100ms) linear infinite}
.ui-agcc__face:hover, .ui-agcc__face[aria-pressed="true"]{z-index: 1;transform: translateY(-1px)}
.ui-agcc__face[aria-pressed="true"]{background: var(--ui-agcc-tint, color-mix(in srgb, var(--ui-agcc-c) 16%, var(--ui-agcc-card)))}
.ui-agcc__face-mark, .ui-agcc__note-mark{display: grid;place-items: center;width: 14px;height: 14px}
.ui-agcc__face-mark svg, .ui-agcc__note-mark svg{width: 14px;height: 14px}
.ui-agcc__face-initial{font-size: 11px;font-weight: 600;line-height: 1;color: var(--ui-agcc-c)}
.ui-agcc__face-tip{position: absolute;top: calc(100% + 8px);right: -6px;z-index: 4;padding: 5px 9px;border-radius: 8px;background: var(--ui-agcc-ink);font-size: 12px;line-height: 16px;color: var(--ui-agcc-card);white-space: nowrap;opacity: 0;transform: translateY(-2px);pointer-events: none;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agcc__face-tip{display: grid;gap: 1px;text-align: left}
.ui-agcc__face-tip b{font-weight: 600}
.ui-agcc__face-tip > span{opacity: 0.75}
.ui-agcc__face:hover .ui-agcc__face-tip, .ui-agcc__face:focus-visible .ui-agcc__face-tip{opacity: 1;transform: none}
.ui-agcc__text{position: relative;z-index: 1;padding: 36px 48px 48px;font-size: 14px;line-height: 23px;color: var(--ui-agcc-text)}
.ui-agcc__block{margin: 0}
.ui-agcc__text > * + *{margin-top: var(--ui-agcc-gap)}
.ui-agcc__block--title{font-size: 22px;font-weight: 650;line-height: 28px;letter-spacing: -0.022em;color: var(--ui-agcc-ink)}
.ui-agcc__text > .ui-agcc__block--title + *{margin-top: 12px}
.ui-agcc__block--heading{font-size: 15.5px;font-weight: 600;line-height: 24px;letter-spacing: -0.012em;color: var(--ui-agcc-ink)}
.ui-agcc__text > .ui-agcc__block--heading:not(:first-child){margin-top: calc(var(--ui-agcc-gap) + 10px)}
.ui-agcc__text > .ui-agcc__block--heading + *{margin-top: 8px}
.ui-agcc__list{margin: 0;padding: 0 0 0 20px}
.ui-agcc__list .ui-agcc__block + .ui-agcc__block{margin-top: 4px}
.ui-agcc__block--item::marker{color: var(--ui-agcc-muted)}
.ui-agcc__code{margin: 0;padding: 14px 16px;overflow: hidden;border-radius: 12px;background: var(--ui-agcc-code);box-shadow: inset 0 0 0 1px var(--ui-agcc-line);font-family: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;font-size: 12.5px;line-height: 20px;letter-spacing: 0;color: var(--ui-agcc-ink);white-space: pre-wrap}
.ui-agcc__code code{font: inherit}
.ui-agcc__figure{margin: 0}
.ui-agcc__text::after{content: "";display: block;clear: both}
.ui-agcc__figure{max-width: 100%;transition: width 620ms var(--ui-agcc-ease)}
.ui-agcc__figure[data-float="left"]{float: left;margin: var(--ui-agcc-gap) 24px 8px 0}
.ui-agcc__figure[data-float="right"]{float: right;margin: var(--ui-agcc-gap) 0 8px 24px}
.ui-agcc__text > .ui-agcc__figure[data-float]{margin-top: var(--ui-agcc-gap)}
.ui-agcc__text > :is(.ui-agcc__block--heading, .ui-agcc__code, .ui-agcc__list){clear: both}
.ui-agcc__sheet{container-type: inline-size}
@container (max-width: 480px){.ui-agcc__figure[data-float]{float: none;margin: 0 0 12px}
}
.ui-agcc__img{position: relative;display: grid;width: 100%;border-radius: 12px;background: var(--ui-agcc-shimmer);transition: box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agcc__img > img{width: 100%;height: 100%;border-radius: inherit;object-fit: cover;animation: ui-agcc-fade var(--nm-dur-5, 620ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-agcc__shimmer{display: block;width: 100%;height: 100%;border-radius: inherit;background: linear-gradient(100deg, var(--ui-agcc-shimmer) 35%, var(--ui-agcc-shine) 50%, var(--ui-agcc-shimmer) 65%) 0 0 / 300% 100%;animation: ui-agcc-shimmer var(--nm-dur-6, 1100ms) linear infinite}
.ui-agcc__img[data-held]{box-shadow: 0 0 0 2px var(--ui-agcc-c)}
.ui-agcc__handle{position: absolute;width: 10px;height: 10px;border-radius: 3px;background: #fffdfb;box-shadow: 0 0 0 1.5px var(--ui-agcc-c), 0 1px 3px rgba(11, 9, 8, 0.18);animation: ui-agcc-fade 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-agcc__handle[data-at="tl"]{top: -5px;left: -5px}
.ui-agcc__handle[data-at="tr"]{top: -5px;right: -5px}
.ui-agcc__handle[data-at="bl"]{bottom: -5px;left: -5px}
.ui-agcc__handle[data-at="br"]{right: -5px;bottom: -5px}
.ui-agcc__size{position: absolute;bottom: 10px;left: 50%;translate: -50% 0;padding: 0 7px;border-radius: 6px;background: var(--ui-agcc-c);font-size: 11.5px;font-weight: 600;line-height: 20px;color: #fffdfb;white-space: nowrap;font-variant-numeric: tabular-nums;animation: ui-agcc-fade 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-agcc__caption{margin-top: 8px;font-size: 12.5px;line-height: 18px;color: var(--ui-agcc-muted)}
.ui-agcc__ins, .ui-agcc__del{border-radius: 3px;outline: none;cursor: pointer;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));-webkit-box-decoration-break: clone;box-decoration-break: clone}
.ui-agcc__ins{padding: 1px 0;background: color-mix(in srgb, var(--ui-agcc-c) 12%, transparent);color: var(--ui-agcc-ink);text-decoration: underline 1.5px var(--ui-agcc-c);text-underline-offset: 4px;animation: ui-agcc-in var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-agcc__del{color: var(--ui-agcc-muted);text-decoration: line-through 1.5px var(--ui-agcc-c)}
.ui-agcc__ins:hover, .ui-agcc__ins[data-open], .ui-agcc__ins:focus-visible{background: color-mix(in srgb, var(--ui-agcc-c) 22%, transparent)}
.ui-agcc__del:hover, .ui-agcc__del[data-open], .ui-agcc__del:focus-visible{background: color-mix(in srgb, var(--ui-agcc-c) 10%, transparent)}
.ui-agcc__marks{position: absolute;inset: 0;z-index: 0;pointer-events: none}
.ui-agcc__mark{position: absolute;border-radius: 3px;background: color-mix(in srgb, var(--ui-agcc-c) 20%, transparent);animation: ui-agcc-fade var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agcc__mark[data-dim]{opacity: 0.25}
.ui-agcc__notes{position: absolute;inset: 0;z-index: 4;pointer-events: none}
.ui-agcc__pin{position: absolute;width: 0;height: 0;pointer-events: auto;animation: ui-agcc-fade var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-agcc__pin{--ui-agcc-pin: 30px}
.ui-agcc__pin-box{position: absolute;top: calc(var(--ui-agcc-pin) * -1);left: var(--ui-agcc-pin-x, 0px);width: var(--ui-agcc-pin);height: var(--ui-agcc-pin);overflow: hidden;border-radius: 15px 15px 15px 3px;background: var(--ui-agcc-flag);color: var(--ui-agcc-flag-ink);box-shadow: 0 0 0 1px var(--ui-agcc-flag-soft), 0 8px 20px -8px rgba(11, 9, 8, 0.45);transition: left var(--nm-dur-4, 380ms) var(--ui-agcc-ease), width var(--nm-dur-4, 380ms) var(--ui-agcc-ease), height var(--nm-dur-4, 380ms) var(--ui-agcc-ease), border-radius var(--nm-dur-4, 380ms) var(--ui-agcc-ease), box-shadow var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agcc__pin[data-up] .ui-agcc__pin-box{top: auto;bottom: 0}
.ui-agcc__pin[data-open]{z-index: 1}
.ui-agcc__pin[data-open] .ui-agcc__pin-box{width: var(--ui-agcc-pin-w, 248px);height: var(--ui-agcc-pin-h);border-radius: 14px;box-shadow: 0 0 0 1px var(--ui-agcc-flag-soft), 0 16px 32px -14px rgba(11, 9, 8, 0.4)}
.ui-agcc__pin-mark{--ui-agcc-ink: var(--ui-agcc-flag-ink)}
.ui-agcc__pin-mark{position: absolute;z-index: 1;top: 7px;left: 7px;display: grid;place-items: center;width: 16px;height: 16px;transition: top var(--nm-dur-4, 380ms) var(--ui-agcc-ease), left var(--nm-dur-4, 380ms) var(--ui-agcc-ease), width var(--nm-dur-4, 380ms) var(--ui-agcc-ease), height var(--nm-dur-4, 380ms) var(--ui-agcc-ease);pointer-events: none}
.ui-agcc__pin-mark svg{width: 100%;height: 100%}
.ui-agcc__pin[data-open] .ui-agcc__pin-mark{top: 11px;left: 12px;width: 14px;height: 14px}
.ui-agcc__pin-hit{position: absolute;inset: 0;z-index: 2;border-radius: inherit}
.ui-agcc__pin[data-open] .ui-agcc__pin-hit{pointer-events: none}
.ui-agcc__pin-body{position: absolute;top: 0;left: 0;display: grid;gap: 4px;width: var(--ui-agcc-pin-w, 248px);padding: 10px 10px 10px 12px;opacity: 0;transition: opacity var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agcc__pin[data-up] .ui-agcc__pin-body{top: auto;bottom: 0}
.ui-agcc__pin[data-open] .ui-agcc__pin-body{opacity: 1;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 140ms}
.ui-agcc__pin-body .ui-agcc__note-head{padding-left: 22px;color: color-mix(in srgb, var(--ui-agcc-flag-ink) 50%, transparent)}
.ui-agcc__pin-body .ui-agcc__note-head b{color: var(--ui-agcc-flag-ink)}
.ui-agcc__pin-body .ui-agcc__note-text{color: color-mix(in srgb, var(--ui-agcc-flag-ink) 86%, transparent)}
.ui-agcc__note-head{display: flex;align-items: center;gap: 6px;font-size: 12px;line-height: 16px;color: var(--ui-agcc-muted)}
.ui-agcc__note-head b{font-weight: 600;color: var(--ui-agcc-ink)}
.ui-agcc__note-head > span:last-child{margin-left: auto}
.ui-agcc__note-text{margin: 0;font-size: 13px;line-height: 19px;color: var(--ui-agcc-text)}
.ui-agcc__pin-actions{display: flex;gap: 6px;margin-top: 6px}
.ui-agcc__reply{flex: 1;min-width: 0;height: 30px;padding: 0 10px;border: 0;border-radius: 9px;background: var(--ui-agcc-flag-soft);box-shadow: inset 0 0 0 1px var(--ui-agcc-flag-soft);font: inherit;font-size: 13px;color: var(--ui-agcc-flag-ink);outline: none}
.ui-agcc__reply::placeholder{color: color-mix(in srgb, var(--ui-agcc-flag-ink) 45%, transparent)}
.ui-agcc__reply:focus-visible{box-shadow: 0 0 0 1px var(--ui-agcc-ring), 0 0 0 3px color-mix(in srgb, var(--ui-agcc-ring) 40%, transparent)}
.ui-agcc__resolve{display: grid;flex: none;place-items: center;width: 30px;height: 30px;border-radius: 9px;background: var(--ui-agcc-flag-ink);color: var(--ui-agcc-flag);transition: opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agcc__resolve:hover{opacity: 0.86}
.ui-agcc__cursors{position: absolute;inset: 0;z-index: 3;pointer-events: none}
.ui-agcc__cursor-in{transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agcc__cursor{position: absolute;top: 0;left: 0;transition: transform var(--ui-agcc-glide) var(--ui-agcc-ease), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));will-change: transform}
.ui-agcc__cursor[data-typing]{transition: transform var(--nm-dur-1, 90ms) linear, opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agcc__cursor[data-drag]{transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agcc__cursor[data-arrive]{transition: none;opacity: 0}
.ui-agcc__cursor:not([data-arrive]):not([data-gone]){animation: ui-agcc-pop var(--nm-dur-3, 240ms) var(--ui-agcc-ease) both}
.ui-agcc__cursor[data-gone]{opacity: 0}
.ui-agcc__cursor[data-dim]{opacity: 0.22}
.ui-agcc__cursor[data-gone][data-dim]{opacity: 0}
.ui-agcc__caret{position: absolute;top: 0;left: -1px;width: 2px;height: var(--ui-agcc-h, 18px);border-radius: 1px;background: var(--ui-agcc-c);animation: ui-agcc-blink 1100ms steps(1, end) infinite}
.ui-agcc__cursor[data-typing] .ui-agcc__caret{animation: none}
.ui-agcc__cursor[data-free] .ui-agcc__caret{display: none}
.ui-agcc__arrow{position: absolute;z-index: 1;top: calc(var(--ui-agcc-h, 18px) - 6px);left: 0;width: 19px;height: 23px;overflow: visible;filter: drop-shadow(0 2px 4px rgba(11, 9, 8, 0.22))}
.ui-agcc__cursor[data-free] .ui-agcc__arrow{top: -0.6px;left: -2.3px}
.ui-agcc__arrow{transform-origin: 2px 1px;transition: transform var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agcc__cursor[data-press] .ui-agcc__arrow{transform: scale(0.82)}
.ui-agcc__arrow path{fill: var(--ui-agcc-c);stroke: #fffdfb;stroke-width: 1.4;paint-order: stroke}
.ui-agcc__flag{position: absolute;top: calc(var(--ui-agcc-h, 18px) + 15px);left: calc(16px + var(--ui-agcc-shift, 0px));display: grid;width: max-content;padding: 6px 10px 6px;border-bottom: 1px solid transparent;border-radius: 10px;background: linear-gradient(var(--ui-agcc-flag), var(--ui-agcc-flag)) padding-box, var(--ui-agcc-edge) border-box;box-shadow: 0 8px 18px -8px rgba(226, 84, 74, 0.5), 6px 8px 18px -8px rgba(255, 107, 53, 0.5), 0 2px 6px -2px rgba(11, 9, 8, 0.3);font-size: 12px;font-weight: 600;line-height: 16px;color: var(--ui-agcc-flag-ink);white-space: nowrap}
.ui-agcc__cursor[data-in-note] .ui-agcc__flag{opacity: 0}
.ui-agcc__cursor[data-free] .ui-agcc__flag{top: 21px;left: calc(14px + var(--ui-agcc-shift, 0px))}
.ui-agcc__flag-row{display: flex;align-items: center;gap: 12px}
.ui-agcc__flag-tags{display: flex;gap: 4px;margin-left: auto}
.ui-agcc__flag-tag{padding: 0 5px;border-radius: 5px;background: var(--ui-agcc-flag-soft);font-size: 10.5px;font-weight: 600;line-height: 16px;font-variant-numeric: tabular-nums}
.ui-agcc__flag-doing{display: block;max-height: 0;overflow: hidden;opacity: 0;transition: max-height var(--nm-dur-4, 380ms) var(--ui-agcc-ease), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), margin-top var(--nm-dur-4, 380ms) var(--ui-agcc-ease)}
.ui-agcc__flag-doing > span{display: block;width: max-content;font-size: 11.5px;font-weight: 500;white-space: nowrap}
.ui-agcc__flag-doing[data-on]{max-height: 18px;margin-top: 1px;opacity: 0.9}
.ui-agcc__cursor[data-dim] .ui-agcc__flag-doing{max-height: 0;opacity: 0}
.ui-agcc__pop{position: absolute;z-index: 5;display: grid;gap: 6px;width: 260px;padding: 10px;border-radius: 14px;background: var(--ui-agcc-card);box-shadow: 0 0 0 1px var(--ui-agcc-line), 0 16px 32px -12px rgba(11, 9, 8, 0.22);animation: ui-agcc-rise var(--nm-dur-2, 160ms) var(--ui-agcc-ease) both}
.ui-agcc__pop-head{display: flex;align-items: center;gap: 6px;font-size: 12.5px;line-height: 18px;color: var(--ui-agcc-muted)}
.ui-agcc__pop-head b{font-weight: 600;color: var(--ui-agcc-ink)}
.ui-agcc__pop-mark{display: grid;flex: none;place-items: center;width: 14px;height: 14px}
.ui-agcc__pop-mark svg{width: 100%;height: 100%}
.ui-agcc__pop-note{margin: 0;font-size: 12.5px;line-height: 18px;color: var(--ui-agcc-text)}
.ui-agcc__pop-actions{display: flex;justify-content: flex-end;gap: 6px;margin-top: 2px}
.ui-agcc__btn{display: inline-flex;align-items: center;height: 30px;padding: 0 12px;border-radius: 9px;background: var(--ui-agcc-card);box-shadow: 0 0 0 1px var(--ui-agcc-line), 0 1px 2px rgba(11, 9, 8, 0.04);font-size: 13px;font-weight: 500;color: var(--ui-agcc-ink);transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-agcc__btn:hover{background: var(--ui-agcc-chip)}
.ui-agcc__btn--primary{background: var(--ui-agcc-ink);box-shadow: none;color: var(--ui-agcc-card)}
.ui-agcc__btn--primary:hover{background: var(--ui-agcc-ink);opacity: 0.86}
.ui-agcc__live{position: absolute;width: 1px;height: 1px;overflow: hidden;clip: rect(0 0 0 0);white-space: nowrap}
@keyframes ui-agcc-blink{0%, 55%{opacity: 1}
56%, 100%{opacity: 0}
}
@keyframes ui-agcc-pop{from{opacity: 0;scale: 0.85}
}
@keyframes ui-agcc-fade{from{opacity: 0}
}
@keyframes ui-agcc-in{from{background-color: transparent}
}
@keyframes ui-agcc-rise{from{opacity: 0;transform: translateY(-4px) scale(0.98)}
}
@keyframes ui-agcc-spin{to{transform: rotate(360deg)}
}
@keyframes ui-agcc-shimmer{from{background-position: 100% 0}
to{background-position: 0 0}
}
@media (max-width: 520px){.ui-agcc__text{padding: 26px 22px 36px;font-size: 14px;line-height: 23px}
.ui-agcc__block--title{font-size: 20px;line-height: 26px}
.ui-agcc__sum{display: none}
}
@container agc (max-width: 480px){.ui-agcc__bar{gap: 6px;padding: 0 8px 0 12px}
.ui-agcc__title{display: none}
.ui-agcc__doc{margin-right: auto}
.ui-agcc__face{width: 26px;height: 26px;margin-left: 2px}
.ui-agcc__all{padding: 0 9px;font-size: 12px}
.ui-agcc__text{padding: 24px 20px 32px}
.ui-agcc__flag{padding: 4px 8px 4px;border-radius: 8px;font-size: 11px;line-height: 14px}
.ui-agcc__flag-tag{padding: 0 4px;font-size: 10px;line-height: 14px}
.ui-agcc__flag-doing > span{font-size: 10.5px}
.ui-agcc__flag-row{gap: 8px}
.ui-agcc__table{font-size: 11.5px;line-height: 16px}
.ui-agcc__table :is(th, td){height: auto;padding: 8px 5px;white-space: normal;text-overflow: clip}
.ui-agcc__table :is(th, td):first-child{padding-left: 9px}
.ui-agcc__table th{font-size: 11px}
.ui-agcc__table th:first-child{width: 30%}
.ui-agcc__pill{display: inline-block;height: auto;min-height: 18px;padding: 1px 6px;font-size: 10.5px;line-height: 16px;white-space: normal}
}
@container agc (max-width: 340px){.ui-agcc__text{padding-right: 12px;padding-left: 12px}
.ui-agcc__table{font-size: 11px}
.ui-agcc__table th:first-child{width: 28%}
}
@media (pointer: coarse){.ui-agcc__face{width: 32px;height: 32px}
.ui-agcc__btn{height: 36px;padding: 0 14px}
}
@media (prefers-reduced-motion: reduce){.ui-agcc *, .ui-agcc *::before, .ui-agcc *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-agcc{--ui-agcc-card: #211b16;--ui-agcc-tray: #1a1512;--ui-agcc-strong: #fffdfb;--ui-agcc-ink: rgba(255, 253, 251, 0.9);--ui-agcc-text: rgba(255, 253, 251, 0.7);--ui-agcc-muted: rgba(255, 253, 251, 0.45);--ui-agcc-faint: rgba(255, 253, 251, 0.28);--ui-agcc-line: rgba(255, 253, 251, 0.08);--ui-agcc-stroke: rgba(255, 253, 251, 0.09);--ui-agcc-grid: rgba(255, 253, 251, 0.06);--ui-agcc-chip: rgba(255, 253, 251, 0.08);--ui-agcc-shimmer: rgba(255, 253, 251, 0.05);--ui-agcc-shine: rgba(255, 253, 251, 0.1);--ui-agcc-code: rgba(255, 253, 251, 0.035);--ui-agcc-ring: rgba(255, 138, 92, 0.45);--ui-agcc-solid: rgba(255, 253, 251, 0.92);--ui-agcc-on-solid: #1a1512;--ui-agcc-agent: #dfd5cc;--ui-agcc-flag: #f4ece4;--ui-agcc-flag-ink: #1a1512;--ui-agcc-flag-soft: rgba(11, 9, 8, 0.08);--ui-agcc-pop: 0 0 0 0.5px rgba(255, 253, 251, 0.12), 0 12px 28px -10px rgba(11, 9, 8, 0.6);--ui-agcc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4)}
:where(.dark, [data-theme="dark"]) .ui-agcc__arrow path{stroke: #211b16}
:where(.dark, [data-theme="dark"]) .ui-agcc__handle{background: #211b16}
.ui-agcc button:focus-visible{outline-offset: 1px}
.ui-agcc__sheet{border-radius: 12px;background: var(--ui-agcc-card)}
.ui-agcc__paper{display: none}
.ui-agcc__shade > span{border-radius: 12px;box-shadow: 0 0 0 1px var(--ui-agcc-stroke), 0 1px 2px rgba(11, 9, 8, 0.045), 0 2px 10px rgba(11, 9, 8, 0.05)}
.ui-agcc__bar{height: 44px;padding: 0 10px 0 14px;border-bottom: 0.5px solid var(--ui-agcc-line)}
.ui-agcc__doc{color: rgba(11, 9, 8, 0.447)}
.ui-agcc__title{font-size: 13px;font-weight: 500}
.ui-agcc__sum{font-size: 12px;line-height: 16px}
.ui-agcc__spent{font-weight: 500;color: var(--ui-agcc-strong)}
.ui-agcc__tab{height: 28px;padding: 0 10px;border-radius: 6px;font-size: 13px}
.ui-agcc__tab[aria-selected="true"]{box-shadow: var(--ui-agcc-shadow)}
.ui-agcc__table-card{border-radius: 10px;box-shadow: var(--ui-agcc-shadow)}
.ui-agcc__table{font-size: 13px}
.ui-agcc__table :is(th, td){border-top: 0.5px solid var(--ui-agcc-line);border-left: 0}
.ui-agcc__table th{font-size: 12px;font-weight: 400}
.ui-agcc__pill{height: 20px;padding: 0 7px;border-radius: 5px;font-size: 11.5px}
.ui-agcc__table-card{transition: height var(--nm-dur-4, 380ms) var(--ui-agcc-ease)}
.ui-agcc__table tfoot td{height: 40px}
.ui-agcc__add{height: 28px;padding: 0 8px;border-radius: 6px;font-size: 13px}
.ui-agcc__all{height: 28px;padding: 0 10px;border-radius: 6px;background: var(--ui-agcc-solid);font-size: 13px;color: var(--ui-agcc-on-solid)}
.ui-agcc__face{width: 24px;height: 24px;margin-left: 3px;box-shadow: 0 0 0 1.5px var(--ui-agcc-card), inset 0 0 0 1px var(--ui-agcc-chip)}
.ui-agcc__face[data-here]::before{-webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 1.5px), #0b0908 calc(100% - 1px));mask: radial-gradient(farthest-side, transparent calc(100% - 1.5px), #0b0908 calc(100% - 1px))}
.ui-agcc__face-mark, .ui-agcc__note-mark{width: 12px;height: 12px}
.ui-agcc__face-mark svg, .ui-agcc__note-mark svg{width: 12px;height: 12px}
.ui-agcc__face-initial{font-size: 10px;font-weight: 500}
.ui-agcc__face-tip{padding: 4px 8px;border-radius: 6px;background: var(--ui-agcc-solid);color: var(--ui-agcc-on-solid)}
.ui-agcc__face-tip b{font-weight: 500}
.ui-agcc__text{padding: 32px 44px 44px;font-size: 13.5px;line-height: 22px}
.ui-agcc__block--title{font-size: 20px;font-weight: 500;line-height: 28px;letter-spacing: -0.01em;color: var(--ui-agcc-strong)}
.ui-agcc__block--heading{font-size: 14.5px;font-weight: 500;line-height: 22px;letter-spacing: -0.01em;color: var(--ui-agcc-strong)}
.ui-agcc__block--item::marker{color: var(--ui-agcc-faint)}
.ui-agcc__code{padding: 12px 14px;border-radius: 8px;box-shadow: inset 0 0 0 0.5px var(--ui-agcc-line);font-size: 12px;line-height: 19px}
.ui-agcc__img{border-radius: 8px}
.ui-agcc__img[data-held]{box-shadow: 0 0 0 1.5px var(--ui-agcc-c)}
.ui-agcc__handle{width: 8px;height: 8px;border-radius: 2px;box-shadow: 0 0 0 1px var(--ui-agcc-c), 0 1px 2px rgba(11, 9, 8, 0.16)}
.ui-agcc__handle[data-at="tl"]{top: -4px;left: -4px}
.ui-agcc__handle[data-at="tr"]{top: -4px;right: -4px}
.ui-agcc__handle[data-at="bl"]{bottom: -4px;left: -4px}
.ui-agcc__handle[data-at="br"]{right: -4px;bottom: -4px}
.ui-agcc__size{border-radius: 4px;font-size: 11px;font-weight: 500;line-height: 18px}
.ui-agcc__caption{font-size: 12px;line-height: 16px}
.ui-agcc__ins{background: color-mix(in srgb, var(--ui-agcc-c) 10%, transparent);text-decoration-thickness: 1px}
.ui-agcc__del{color: var(--ui-agcc-faint);text-decoration-thickness: 1px}
.ui-agcc__mark{background: color-mix(in srgb, var(--ui-agcc-c) 16%, transparent)}
.ui-agcc__pin{--ui-agcc-pin: 28px}
.ui-agcc__pin-box{border-radius: 14px 14px 14px 3px}
.ui-agcc__pin-mark{--ui-agcc-strong: var(--ui-agcc-flag-ink)}
.ui-agcc__pin[data-open] .ui-agcc__pin-box{border-radius: 10px}
.ui-agcc__pin-mark{top: 7px;left: 7px;width: 14px;height: 14px}
.ui-agcc__pin[data-open] .ui-agcc__pin-mark{top: 10px;left: 11px;width: 12px;height: 12px}
.ui-agcc__pin-body{gap: 2px;padding: 9px 9px 9px 11px}
.ui-agcc__pin-body .ui-agcc__note-head{padding-left: 19px}
.ui-agcc__pin-actions{gap: 6px;margin-top: 6px}
.ui-agcc__reply{height: 28px;padding: 0 9px;border-radius: 6px;font-size: 13px}
.ui-agcc__resolve{width: 28px;height: 28px;border-radius: 6px}
.ui-agcc__note-head b{font-weight: 500;color: var(--ui-agcc-strong)}
.ui-agcc__note-text{font-size: 13px;line-height: 20px}
.ui-agcc__caret{left: -0.75px;width: 1.5px}
.ui-agcc__arrow{width: 17px;height: 21px;filter: drop-shadow(0 1px 3px rgba(11, 9, 8, 0.2))}
.ui-agcc__cursor[data-free] .ui-agcc__arrow{top: -0.55px;left: -2.05px}
.ui-agcc__flag{top: calc(var(--ui-agcc-h, 18px) + 13px);left: calc(15px + var(--ui-agcc-shift, 0px));padding: 5px 9px 5px;border-radius: 8px;font-weight: 500}
.ui-agcc__cursor[data-free] .ui-agcc__flag{top: 19px;left: calc(13px + var(--ui-agcc-shift, 0px))}
.ui-agcc__flag-tag{border-radius: 4px;font-weight: 500}
.ui-agcc__flag-doing > span{font-weight: 400}
.ui-agcc__flag-doing[data-on]{opacity: 0.88}
.ui-agcc__pop{gap: 4px;border-radius: 10px;box-shadow: var(--ui-agcc-pop)}
.ui-agcc__pop-head{font-size: 12px;line-height: 16px}
.ui-agcc__pop-head b{font-weight: 500;color: var(--ui-agcc-strong)}
.ui-agcc__pop-mark{width: 12px;height: 12px}
.ui-agcc__pop-note{font-size: 13px;line-height: 20px}
.ui-agcc__btn{height: 28px;padding: 0 10px;border-radius: 6px;box-shadow: var(--ui-agcc-shadow)}
.ui-agcc__btn:hover{background: var(--ui-agcc-chip)}
.ui-agcc__btn--primary, .ui-agcc__btn--primary:hover{background: var(--ui-agcc-solid);color: var(--ui-agcc-on-solid)}
:where(.dark, [data-theme="dark"]) .ui-agcc__doc{color: rgba(255, 253, 251, 0.45)}
@container agc (max-width: 480px){.ui-agcc__bar{padding: 0 8px 0 12px}
.ui-agcc__face{width: 24px;height: 24px;margin-left: 2px}
.ui-agcc__text{padding: 22px 18px 30px}
.ui-agcc__flag{padding: 3px 7px 3px;border-radius: 7px}
.ui-agcc__table{font-size: 11.5px}
.ui-agcc__table :is(th, td){padding: 8px 5px}
.ui-agcc__table :is(th, td):first-child{padding-left: 9px}
.ui-agcc__table th{font-size: 11px}
.ui-agcc__pill{display: inline-block;height: auto;min-height: 18px}
}
@container agc (max-width: 340px){.ui-agcc__text{padding-right: 12px;padding-left: 12px}
.ui-agcc__table{font-size: 11px}
}
@media (max-width: 520px){.ui-agcc__text{padding: 24px 20px 32px}
.ui-agcc__block--title{font-size: 19px;line-height: 26px}
}

`;
