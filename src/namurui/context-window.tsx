"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/*
 * Context Window – what fills the model's context, in a single self-contained file.
 * The window is a field of small squares: every band of the context owns a run of cells in its
 * own colour, and the diagonal per-cell delay turns any change into a sweep. Hovering a band
 * lights its cells and dims the rest of the field; hovering one of its files lights only that
 * file's cells. Files fold open under their band and can be removed one at a time. Compacting
 * sets the band's cells waving and shining while the work runs, then the cells drain back to
 * free as the tokens come off.
 * The field is generated from the token maths, never hand-written: each band takes the cells
 * between its rounded cumulative token boundary and the previous one, so 216 cells fit 200K
 * tokens exactly.
 * The styles are injected below, so no extra files are needed.
 */

/** One file or attachment inside a band of the context. */
export type ContextItem = {
  id: string;
  label: string;
  tokens: number;
};

/** One band of the context window, in fill order. */
export type ContextPart = {
  id: string;
  label: string;
  /** Tokens the band holds when it carries no items. */
  tokens?: number;
  /** Files in the band; the band's total becomes the sum of these. */
  items?: ContextItem[];
  /** Renders the chevron and the collapsible list. Defaults to true when `items` is given. */
  expandable?: boolean;
  /** Renders the Compact control. Ignored on an expandable band, whose only control is the fold. */
  compactable?: boolean;
};

/** How urgent the readout looks; the sheet colours the pill, the caption and the root from it. */
export type ContextLevel = "ok" | "warn" | "full";

export type ContextWindowProps = {
  /** Bands of the context, top of the list first. */
  parts: ContextPart[];
  /** Total size of the window in tokens. */
  limit?: number;
  title?: string;
  /** The model the window belongs to. The mark defaults to Anthropic's. */
  model?: { name: string; icon?: ReactNode };
  /** Cells in the field, laid out `columns` wide. */
  cells?: number;
  columns?: number;
  /** Columns once the card is narrower than 310px. */
  narrowColumns?: number;
  /** Fill ratio at which the readout turns amber. */
  warnAt?: number;
  /** Fill ratio at which it turns red. */
  fullAt?: number;
  /** A file's remove control; the band's tokens arrive through props on the next render. */
  onRemove?: (part: ContextPart, item: ContextItem) => void;
  /** Compaction: return a promise to hold the shimmer until the work has settled. */
  onCompact?: (part: ContextPart) => void | Promise<void>;
  action?: { label: string; onClick?: () => void };
  className?: string;
};

const CELL_COUNT = 216;
const COLUMNS = 36;
const NARROW_COLUMNS = 24;

/** One cell of the six-slot palette, cycled across bands. */
const PALETTE = 6;

const MIN_BUSY = 1300;
const DONE_HOLD = 1300;
const LEAVE = 420;
const SWAP_OUT = 230;

type Span = { item: ContextItem; from: number; to: number };

type Layer = {
  part: ContextPart;
  /** 1-based palette slot. */
  color: number;
  from: number;
  to: number;
  tokens: number;
  spans: Span[];
};

type Layout = { layers: Layer[]; owner: number[]; tokens: number };

/** A band's total: its files when it has them, its own count otherwise. */
function tokensOf(part: ContextPart): number {
  return part.items && part.items.length > 0
    ? part.items.reduce((sum, item) => sum + Math.max(0, item.tokens), 0)
    : Math.max(0, part.tokens ?? 0);
}

/**
 * Every band takes the cells between its rounded cumulative token boundary and the previous
 * band's, so the field always holds exactly `cells` squares and the free tail stays truthful.
 */
function buildLayers(parts: ContextPart[], limit: number, cells: number): Layout {
  const safeLimit = limit > 0 ? limit : 1;

  let carried = 0;
  let edge = 0;

  const layers: Layer[] = parts.map((part, index) => {
    const start = edge;
    const spans: Span[] = [];

    for (const item of part.items ?? []) {
      const from = edge;
      carried += Math.max(0, item.tokens);
      edge = Math.min(cells, Math.max(0, Math.round((carried / safeLimit) * cells)));
      spans.push({ item, from, to: edge });
    }

    if (spans.length === 0) {
      carried += Math.max(0, part.tokens ?? 0);
      edge = Math.min(cells, Math.max(0, Math.round((carried / safeLimit) * cells)));
    }

    return {
      part,
      color: (index % PALETTE) + 1,
      from: start,
      to: edge,
      tokens: tokensOf(part),
      spans,
    };
  });

  const owner: number[] = new Array(cells).fill(-1);
  layers.forEach((layer, index) => {
    for (let cell = layer.from; cell < layer.to; cell += 1) owner[cell] = index;
  });

  return { layers, owner, tokens: carried };
}

/** "175.6K" – one decimal, dropped when it is a round thousand. */
function compactTokens(tokens: number): string {
  const value = Math.max(0, Math.round(tokens));
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${value}`;
}

/** "200.0K" – always the decimal, for the sentence a screen reader hears. */
function exactTokens(tokens: number): string {
  const value = Math.max(0, Math.round(tokens));
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return `${value}`;
}

export function ContextWindow({
  parts,
  limit = 200_000,
  title = "Context window",
  model = { name: "claude-sonnet-5-5" },
  cells = CELL_COUNT,
  columns = COLUMNS,
  narrowColumns = NARROW_COLUMNS,
  warnAt = 0.8,
  fullAt = 0.95,
  onRemove,
  onCompact,
  action = { label: "New chat" },
  className,
}: ContextWindowProps) {
  const uid = useId();
  const titleId = `${uid}-title`;

  const [hot, setHot] = useState<{ partId: string; itemId?: string } | null>(null);
  const [unfolded, setUnfolded] = useState<Record<string, boolean>>({});
  const [compaction, setCompaction] = useState<{
    partId: string;
    stage: "busy" | "done" | "leaving";
    from: number;
  } | null>(null);
  /** Tokens a band landed on after its last compaction; the control rests until that changes. */
  const [compacted, setCompacted] = useState<Record<string, number>>({});

  const partsRef = useRef(parts);
  useEffect(() => {
    partsRef.current = parts;
  }, [parts]);

  /* The control says "Compacted", holds, blurs out, and only then retires. */
  useEffect(() => {
    if (compaction === null) return;

    if (compaction.stage === "done") {
      const id = window.setTimeout(
        () => setCompaction({ ...compaction, stage: "leaving" }),
        DONE_HOLD,
      );
      return () => window.clearTimeout(id);
    }

    if (compaction.stage === "leaving") {
      const id = window.setTimeout(() => {
        const latest = partsRef.current.find((entry) => entry.id === compaction.partId);
        const settled = latest ? Math.round(tokensOf(latest)) : null;
        if (settled !== null && settled !== compaction.from) {
          setCompacted((current) => ({ ...current, [compaction.partId]: settled }));
        }
        setCompaction(null);
      }, LEAVE);
      return () => window.clearTimeout(id);
    }

    return;
  }, [compaction]);

  const layout = useMemo(() => buildLayers(parts, limit, cells), [parts, limit, cells]);

  const ratio = limit > 0 ? layout.tokens / limit : 0;
  const percent = Math.round(ratio * 100);
  const level: ContextLevel = ratio >= fullAt ? "full" : ratio >= warnAt ? "warn" : "ok";
  const left = Math.max(0, limit - layout.tokens);

  /* The lit run of cells: the hovered band, or just the hovered file inside it. */
  const lit = useMemo(() => {
    if (!hot) return null;
    const layer = layout.layers.find((entry) => entry.part.id === hot.partId);
    if (!layer) return null;
    if (hot.itemId) {
      const span = layer.spans.find((entry) => entry.item.id === hot.itemId);
      if (span) return { from: span.from, to: span.to };
    }
    return { from: layer.from, to: layer.to };
  }, [hot, layout]);

  const startCompact = async (part: ContextPart) => {
    if (compaction !== null) return;

    const from = Math.round(tokensOf(part));
    setCompaction({ partId: part.id, stage: "busy", from });

    const started = Date.now();
    try {
      await onCompact?.(part);
    } catch {
      setCompaction(null);
      return;
    }

    /* Even an instant compaction keeps the wave up long enough to read. */
    const remaining = MIN_BUSY - (Date.now() - started);
    if (remaining > 0) {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, remaining);
      });
    }

    setCompaction((current) =>
      current !== null && current.partId === part.id
        ? { ...current, stage: "done" as const }
        : current,
    );
  };

  return (
    <div
      className={["ui-cwc", className].filter(Boolean).join(" ")}
      role="group"
      aria-labelledby={titleId}
      data-level={level}
    >
      {/* React 19 hoists this into <head> once, no matter how many windows render */}
      <style href="ui-context-window" precedence="default">
        {css}
      </style>

      <div className="ui-cwc__card">
        <div className="ui-cwc__head">
          <span id={titleId} className="ui-cwc__title">
            {title}
          </span>
          <span className="ui-cwc__model">
            <span className="ui-cwc__model-icon">{model.icon ?? <AnthropicMark />}</span>
            <span>{model.name}</span>
          </span>
        </div>

        <div className="ui-cwc__figure">
          <span className="ui-cwc__big" aria-hidden="true">
            {compactTokens(layout.tokens)}
          </span>
          <span className="ui-cwc__of" aria-hidden="true">
            <Swap text={`of ${compactTokens(limit)} tokens`} />
          </span>
          <span className="ui-cwc__pill" aria-hidden="true">
            {percent}%
          </span>
          <span className="ui-cwc__sr">
            {`${compactTokens(layout.tokens)} of ${exactTokens(limit)} tokens used, ${percent} percent`}
          </span>
        </div>

        <div
          className="ui-cwc__field"
          aria-hidden="true"
          data-hot={hot ? "" : undefined}
          style={
            {
              "--ui-cwc-cols": columns,
              "--ui-cwc-cols-narrow": narrowColumns,
            } as CSSProperties
          }
        >
          {layout.owner.map((slot, cell) => {
            const layer = slot >= 0 ? layout.layers[slot] : null;
            const busy =
              layer !== null &&
              compaction !== null &&
              compaction.stage === "busy" &&
              compaction.partId === layer.part.id;
            const on = lit !== null && cell >= lit.from && cell < lit.to;

            return (
              <span
                key={cell}
                className="ui-cwc__cell"
                data-free={layer === null ? "" : undefined}
                data-on={on ? "" : undefined}
                data-busy={busy ? "" : undefined}
                style={
                  {
                    "--i": cell,
                    ...(layer === null
                      ? {}
                      : { "--ui-cwc-color": `var(--ui-cwc-c${layer.color})` }),
                  } as CSSProperties
                }
              />
            );
          })}
        </div>

        <ul className="ui-cwc__parts">
          {parts.map((part, index) => {
            const layer = layout.layers[index];
            const tokens = tokensOf(part);
            const expandable = part.expandable ?? part.items !== undefined;
            const compactable = part.compactable === true && !expandable;
            const isOpen = unfolded[part.id] ?? false;
            const foldId = `${uid}-${part.id}`;
            const isHot = hot?.partId === part.id;
            const stage = compaction?.partId === part.id ? compaction.stage : null;
            const busy = stage === "busy";
            const done = stage === "done";
            const leaving = stage === "leaving";
            const settled = compacted[part.id];
            const hidden = stage === null && settled !== undefined && Math.round(tokens) === settled;

            const row = (
              <>
                <span
                  className="ui-cwc__swatch"
                  style={{ background: `var(--ui-cwc-c${layer.color})` }}
                />
                <span className="ui-cwc__label">
                  {part.label}
                  {expandable && (
                    <span className="ui-cwc__open" data-open={isOpen ? "" : undefined}>
                      <svg
                        className="ui-cwc__chevron"
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="m5 6.75 3 3 3-3"
                          stroke="currentColor"
                          strokeWidth="1.1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                </span>
                {compactable && !hidden && (
                  <button
                    type="button"
                    className="ui-cwc__compact"
                    aria-label={`Compact ${part.label}`}
                    disabled={busy}
                    data-busy={busy ? "" : undefined}
                    data-done={done ? "" : undefined}
                    data-leaving={leaving ? "" : undefined}
                    onClick={() => void startCompact(part)}
                  >
                    <span className="ui-cwc__compact-icon" key={stage ?? "idle"}>
                      {busy ? (
                        <span className="ui-cwc__spinner" />
                      ) : done ? (
                        <CheckIcon />
                      ) : (
                        <CompactIcon />
                      )}
                    </span>
                    <span
                      key={stage ?? "idle"}
                      className={
                        busy ? "ui-cwc__compact-text ui-cwc__shimmer" : "ui-cwc__compact-text"
                      }
                      data-text={busy ? "Compacting" : undefined}
                    >
                      {busy ? "Compacting" : done ? "Compacted" : "Compact"}
                    </span>
                  </button>
                )}
                <span className="ui-cwc__value">{compactTokens(tokens)}</span>
              </>
            );

            return (
              <li
                key={part.id}
                className="ui-cwc__part"
                data-hot={isHot ? "" : undefined}
                data-dim={hot !== null && !isHot ? "" : undefined}
                onMouseEnter={() => setHot({ partId: part.id })}
                onMouseLeave={() => setHot(null)}
                onFocus={() => setHot({ partId: part.id })}
                onBlur={() => setHot(null)}
              >
                <div className="ui-cwc__row">
                  {expandable ? (
                    <button
                      type="button"
                      className="ui-cwc__main"
                      aria-expanded={isOpen}
                      aria-controls={foldId}
                      onClick={() =>
                        setUnfolded((current) => ({ ...current, [part.id]: !current[part.id] }))
                      }
                    >
                      {row}
                    </button>
                  ) : (
                    <div className="ui-cwc__main">{row}</div>
                  )}
                </div>

                {expandable && (
                  <div id={foldId} className="ui-cwc__fold" inert={!isOpen}>
                    <div className="ui-cwc__clip">
                      <ul className="ui-cwc__items">
                        {part.items && part.items.length > 0 ? (
                          part.items.map((item) => (
                            <li
                              key={item.id}
                              className="ui-cwc__fold ui-cwc__fold--item"
                              data-open=""
                            >
                              <div className="ui-cwc__clip">
                                <div
                                  className="ui-cwc__item"
                                  onMouseEnter={() =>
                                    setHot({ partId: part.id, itemId: item.id })
                                  }
                                  onMouseLeave={() => setHot({ partId: part.id })}
                                >
                                  <span className="ui-cwc__item-label">{item.label}</span>
                                  <span className="ui-cwc__item-value">
                                    {compactTokens(item.tokens)}
                                  </span>
                                  <button
                                    type="button"
                                    className="ui-cwc__remove"
                                    aria-label={`Remove ${item.label}`}
                                    onClick={() => onRemove?.(part, item)}
                                  >
                                    <svg
                                      width="16"
                                      height="16"
                                      viewBox="0 0 16 16"
                                      fill="none"
                                      aria-hidden="true"
                                    >
                                      <path
                                        d="m5 5 6 6m0-6-6 6"
                                        stroke="currentColor"
                                        strokeWidth="1.1"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </li>
                          ))
                        ) : (
                          <li className="ui-cwc__empty">No files</li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="ui-cwc__foot">
        <span className="ui-cwc__caption" aria-live="polite">
          <Swap text={`${compactTokens(left)} left`} tone={level} />
        </span>
        <button type="button" className="ui-cwc__action" onClick={action.onClick}>
          {action.label}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3.5 8h9M9 4.5 12.5 8 9 11.5"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

/*
 * Text that crossfades when it changes: the old line blurs out over the new one, which swaps
 * in. Both live in the same grid cell, so the row never jumps.
 */
function Swap({ text, tone }: { text: string; tone?: ContextLevel }) {
  const [state, setState] = useState<{ current: string; previous: string | null }>({
    current: text,
    previous: null,
  });

  useEffect(() => {
    setState((current) => (current.current === text ? current : { current: text, previous: current.current }));
  }, [text]);

  useEffect(() => {
    if (state.previous === null) return;
    const id = window.setTimeout(
      () => setState((current) => ({ current: current.current, previous: null })),
      SWAP_OUT,
    );
    return () => window.clearTimeout(id);
  }, [state.previous]);

  return (
    <span className="ui-cwc__swap">
      {state.previous !== null && (
        <span className="ui-cwc__swap-item" data-out="" data-tone={tone}>
          {state.previous}
        </span>
      )}
      <span className="ui-cwc__swap-item" data-tone={tone} key={state.current}>
        {state.current}
      </span>
    </span>
  );
}

/* ---------- Icons ---------- */

const AnthropicMark = () => (
  <svg viewBox="0 0 1200 1200" aria-hidden="true">
    <path
      fill="#D97757"
      d="M 233.959793 800.214905 L 468.644287 668.536987 L 472.590637 657.100647 L 468.644287 650.738403 L 457.208069 650.738403 L 417.986633 648.322144 L 283.892639 644.69812 L 167.597321 639.865845 L 54.926208 633.825623 L 26.577238 627.785339 L 3.3e-05 592.751709 L 2.73832 575.27533 L 26.577238 559.248352 L 60.724873 562.228149 L 136.187973 567.382629 L 249.422867 575.194763 L 331.570496 580.026978 L 453.261841 592.671082 L 472.590637 592.671082 L 475.328857 584.859009 L 468.724915 580.026978 L 463.570557 575.194763 L 346.389313 495.785217 L 219.543671 411.865906 L 153.100723 363.543762 L 117.181267 339.060425 L 99.060455 316.107361 L 91.248367 266.01355 L 123.865784 230.093994 L 167.677887 233.073853 L 178.872513 236.053772 L 223.248367 270.201477 L 318.040283 343.570496 L 441.825592 434.738342 L 459.946411 449.798706 L 467.194672 444.64447 L 468.080597 441.020203 L 459.946411 427.409485 L 392.617493 305.718323 L 320.778564 181.932983 L 288.80542 130.630859 L 280.348999 99.865845 C 277.369171 87.221436 275.194641 76.590698 275.194641 63.624268 L 312.322174 13.20813 L 332.8591 6.604126 L 382.389313 13.20813 L 403.248352 31.328979 L 434.013519 101.71814 L 483.865753 212.537048 L 561.181274 363.221497 L 583.812134 407.919434 L 595.892639 449.315491 L 600.40271 461.959839 L 608.214783 461.959839 L 608.214783 454.711609 L 614.577271 369.825623 L 626.335632 265.61084 L 637.771851 131.516846 L 641.718201 93.745117 L 660.402832 48.483276 L 697.530334 24.000122 L 726.52356 37.852417 L 750.362549 72 L 747.060486 94.067139 L 732.886047 186.201416 L 705.100708 330.52356 L 686.979919 427.167847 L 697.530334 427.167847 L 709.61084 415.087341 L 758.496704 350.174561 L 840.644348 247.490051 L 876.885925 206.738342 L 919.167847 161.71814 L 946.308838 140.29541 L 997.61084 140.29541 L 1035.38269 196.429626 L 1018.469849 254.416199 L 965.637634 321.422852 L 921.825562 378.201538 L 859.006714 462.765259 L 819.785278 530.41626 L 823.409424 535.812073 L 832.75177 534.92627 L 974.657776 504.724915 L 1051.328979 490.872559 L 1142.818848 475.167786 L 1184.214844 494.496582 L 1188.724854 514.147644 L 1172.456421 554.335693 L 1074.604126 578.496765 L 959.838989 601.449829 L 788.939636 641.879272 L 786.845764 643.409485 L 789.261841 646.389343 L 866.255127 653.637634 L 899.194702 655.409424 L 979.812134 655.409424 L 1129.932861 666.604187 L 1169.154419 692.537109 L 1192.671265 724.268677 L 1188.724854 748.429688 L 1128.322144 779.194641 L 1046.818848 759.865845 L 856.590759 714.604126 L 791.355774 698.335754 L 782.335693 698.335754 L 782.335693 703.731567 L 836.69812 756.885986 L 936.322205 846.845581 L 1061.073975 962.81897 L 1067.436279 991.490112 L 1051.409424 1014.120911 L 1034.496704 1011.704712 L 924.885986 929.234924 L 882.604126 892.107544 L 786.845764 811.48999 L 780.483276 811.48999 L 780.483276 819.946289 L 802.550415 852.241699 L 919.087341 1027.409424 L 925.127625 1081.127686 L 916.671204 1098.604126 L 886.469849 1109.154419 L 853.288696 1103.114136 L 785.073914 1007.355835 L 714.684631 899.516785 L 657.906067 802.872498 L 650.979858 806.81897 L 617.476624 1167.704834 L 601.771851 1186.147705 L 565.530212 1200 L 535.328857 1177.046997 L 519.302124 1139.919556 L 535.328857 1066.550537 L 554.657776 970.792053 L 570.362488 894.68457 L 584.536926 800.134277 L 592.993347 768.724976 L 592.429626 766.630859 L 585.503479 767.516968 L 514.22821 865.369263 L 405.825531 1011.865906 L 320.053711 1103.677979 L 299.516815 1111.812256 L 263.919525 1093.369263 L 267.221497 1060.429688 L 287.114136 1031.114136 L 405.825531 880.107361 L 477.422913 786.52356 L 523.651062 732.483276 L 523.328918 724.671265 L 520.590698 724.671265 L 205.288605 929.395935 L 149.154434 936.644409 L 124.993355 914.01355 L 127.973183 876.885986 L 139.409409 864.80542 L 234.201385 799.570435 L 233.879227 799.8927 Z"
    />
  </svg>
);

const CompactIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path
      d="M6 1.5v3m0 0L4.6 3.1M6 4.5l1.4-1.4M6 10.5v-3m0 0L4.6 8.9M6 7.5l1.4 1.4M2 6h8"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path
      d="m2.4 6.2 2.3 2.3 4.9-5.1"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const css = /* css */ `
.ui-cwc{--ui-cwc-card: #fffdfb;--ui-cwc-strong: #0b0908;--ui-cwc-ink: rgba(11, 9, 8, 0.88);--ui-cwc-text: rgba(11, 9, 8, 0.61);--ui-cwc-muted: rgba(11, 9, 8, 0.45);--ui-cwc-faint: rgba(11, 9, 8, 0.27);--ui-cwc-icon: rgba(11, 9, 8, 0.447);--ui-cwc-line: rgba(11, 9, 8, 0.06);--ui-cwc-fill: rgba(11, 9, 8, 0.06);--ui-cwc-wash: rgba(11, 9, 8, 0.03);--ui-cwc-free: rgba(11, 9, 8, 0.06);--ui-cwc-c1: rgba(217, 84, 31, 0.765);--ui-cwc-c2: rgba(217, 84, 31, 0.5);--ui-cwc-c3: rgba(217, 84, 31, 0.26);--ui-cwc-c4: rgba(255, 107, 53, 0.8);--ui-cwc-c5: rgba(47, 141, 92, 0.72);--ui-cwc-c6: rgba(217, 149, 48, 0.8);--ui-cwc-accent: rgba(217, 84, 31, 0.765);--ui-cwc-warn: #9a6410;--ui-cwc-warn-bg: rgba(217, 149, 48, 0.12);--ui-cwc-full: #b3261e;--ui-cwc-full-bg: rgba(226, 84, 74, 0.08);--ui-cwc-ok: #2f8d5c;--ui-cwc-ok-bg: rgba(47, 141, 92, 0.08);--ui-cwc-shine: rgba(255, 253, 251, 0.82);--ui-cwc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-cwc-focus: rgba(217, 84, 31, 0.35);--ui-cwc-ease: cubic-bezier(0.22, 1, 0.36, 1);box-sizing: border-box;width: 100%;max-width: 360px;min-width: 0;container-type: inline-size;border-radius: 10px;background: var(--ui-cwc-card);box-shadow: var(--ui-cwc-shadow);font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;font-weight: 400;color: var(--ui-cwc-ink);text-align: left;-webkit-font-smoothing: antialiased}
.ui-cwc *, .ui-cwc *::before, .ui-cwc *::after{box-sizing: border-box}
:where(.ui-cwc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;text-align: inherit;cursor: pointer;-webkit-tap-highlight-color: transparent}
.ui-cwc button:focus-visible{outline: 2px solid var(--ui-cwc-focus);outline-offset: 1px}
:where(.ui-cwc) svg{display: block;flex: none}
.ui-cwc b{font-weight: 500;color: var(--ui-cwc-ink)}
.ui-cwc ul{margin: 0;padding: 0;list-style: none}
.ui-cwc__sr{position: absolute;width: 1px;height: 1px;overflow: hidden;clip-path: inset(50%);white-space: nowrap}
.ui-cwc__card{position: relative;padding: 14px 16px 8px}
.ui-cwc__head{display: flex;align-items: center;justify-content: space-between;gap: 10px;min-height: 20px}
.ui-cwc__title{overflow: hidden;font-size: 13px;font-weight: 500;line-height: 20px;color: var(--ui-cwc-strong);white-space: nowrap;text-overflow: ellipsis}
.ui-cwc__model{display: inline-flex;flex: none;align-items: center;gap: 5px;max-width: 62%;height: 20px;padding: 0 6px;border-radius: 5px;background: var(--ui-cwc-fill);font-size: 11px;font-weight: 500;line-height: 16px;color: var(--ui-cwc-text);white-space: nowrap}
.ui-cwc__model > span:last-child{min-width: 0;overflow: hidden;text-overflow: ellipsis}
.ui-cwc__model-icon{display: grid;flex: none;place-items: center;width: 12px;height: 12px}
.ui-cwc__model-icon > *{width: 12px;height: 12px}
.ui-cwc__figure{display: flex;align-items: center;gap: 8px;margin-top: 10px}
.ui-cwc__big{font-size: 24px;font-weight: 500;line-height: 32px;letter-spacing: -0.02em;color: var(--ui-cwc-strong);font-variant-numeric: tabular-nums}
.ui-cwc__of{flex: 1;min-width: 0;overflow: hidden;padding-top: 4px;font-size: 12px;line-height: 16px;color: var(--ui-cwc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-cwc__pill{flex: none;height: 20px;padding: 0 6px;border-radius: 5px;background: var(--ui-cwc-fill);font-size: 12px;font-weight: 500;line-height: 20px;color: var(--ui-cwc-text);font-variant-numeric: tabular-nums;transition: color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cwc[data-level="warn"] .ui-cwc__pill{background: var(--ui-cwc-warn-bg);color: var(--ui-cwc-warn)}
.ui-cwc[data-level="full"] .ui-cwc__pill{background: var(--ui-cwc-full-bg);color: var(--ui-cwc-full)}
.ui-cwc__field{display: grid;grid-template-columns: repeat(var(--ui-cwc-cols), minmax(0, 1fr));gap: 2px;margin-top: 10px}
.ui-cwc__cell{position: relative;aspect-ratio: 1;border-radius: 2px;background: var(--ui-cwc-color);transition: background-color 380ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-3, 240ms) var(--ui-cwc-ease);transition-delay: calc(var(--i) * 2ms), 0ms, 0ms}
.ui-cwc__cell[data-free]{background: var(--ui-cwc-free)}
.ui-cwc__field[data-hot] .ui-cwc__cell:not([data-on], [data-free]){opacity: 0.25}
.ui-cwc__cell[data-on]{transform: scale(1.1)}
.ui-cwc__cell::after{content: "";position: absolute;inset: 0;border-radius: inherit;background: var(--ui-cwc-shine);opacity: 0;pointer-events: none}
.ui-cwc__cell[data-busy]{animation: ui-cwc-wave var(--nm-dur-6, 1100ms) ease-in-out infinite;animation-delay: calc(var(--i) * 15ms)}
.ui-cwc__cell[data-busy]::after{animation: ui-cwc-shine var(--nm-dur-6, 1100ms) ease-in-out infinite;animation-delay: calc(var(--i) * 15ms)}
.ui-cwc__parts{margin-top: 10px !important}
.ui-cwc__part{margin: 0 -8px;padding: 0 8px;border-radius: 6px;transition: background-color var(--nm-dur-1, 90ms) ease-out, opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cwc__part[data-hot]{background: var(--ui-cwc-wash)}
.ui-cwc__part[data-dim]{opacity: 0.5}
.ui-cwc__row{display: flex;align-items: center;gap: 8px;min-height: 32px}
.ui-cwc__main{display: flex;flex: 1;align-items: center;gap: 10px;min-width: 0;height: 32px;border-radius: 6px}
.ui-cwc__swatch{flex: none;width: 8px;height: 8px;border-radius: 2px}
.ui-cwc__label{display: flex;flex: 1;align-items: center;gap: 2px;min-width: 0;overflow: hidden;color: var(--ui-cwc-ink);white-space: nowrap;text-overflow: ellipsis}
.ui-cwc__value{flex: none;min-width: 52px;text-align: right;color: var(--ui-cwc-text);font-variant-numeric: tabular-nums;transition: color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cwc__part[data-hot] .ui-cwc__value{color: var(--ui-cwc-ink)}
.ui-cwc__open{display: grid;flex: none;place-items: center;width: 16px;height: 16px;color: var(--ui-cwc-icon)}
.ui-cwc__chevron{transition: transform var(--nm-dur-3, 240ms) var(--ui-cwc-ease)}
.ui-cwc__open[data-open] .ui-cwc__chevron{transform: rotate(180deg)}
.ui-cwc__compact{display: inline-flex;align-items: center;gap: 4px;height: 24px;margin-right: -8px;padding: 0 8px 0 6px;border-radius: 6px;font-size: 12px;font-weight: 500;line-height: 16px;color: var(--ui-cwc-text);white-space: nowrap;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cwc__compact:hover:not(:disabled){background: var(--ui-cwc-fill);color: var(--ui-cwc-ink)}
.ui-cwc__compact:disabled{cursor: default;opacity: 0.5}
.ui-cwc__compact[data-busy]{opacity: 1;color: var(--ui-cwc-ink)}
.ui-cwc__compact[data-done]{opacity: 1;background: var(--ui-cwc-ok-bg);color: var(--ui-cwc-ok)}
.ui-cwc__compact[data-leaving]{animation: ui-cwc-leave var(--nm-dur-4, 380ms) var(--ui-cwc-ease) both}
.ui-cwc__compact-icon{display: grid;place-items: center;width: 12px;height: 12px;animation: ui-cwc-swap-in var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-cwc__compact-text{animation: ui-cwc-swap-in var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-cwc__spinner{width: 11px;height: 11px;border: 1.25px solid var(--ui-cwc-fill);border-top-color: var(--ui-cwc-accent);border-radius: 50%;animation: ui-cwc-spin var(--nm-dur-5, 620ms) linear infinite}
.ui-cwc__fold{display: grid;grid-template-rows: 0fr;opacity: 0;transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-cwc-ease), opacity 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cwc__fold[data-open]{grid-template-rows: 1fr;opacity: 1;transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-cwc-ease), opacity var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 80ms}
.ui-cwc__fold--item{transition-duration: 240ms, var(--nm-dur-2, 160ms)}
.ui-cwc__clip{min-height: 0;overflow: hidden}
.ui-cwc__items{padding: 0 0 6px 18px !important}
.ui-cwc__item{display: flex;align-items: center;gap: 8px;height: 28px;margin-right: -4px;font-size: 12px;line-height: 16px}
.ui-cwc__item-label{flex: 1;min-width: 0;overflow: hidden;color: var(--ui-cwc-text);white-space: nowrap;text-overflow: ellipsis}
.ui-cwc__item-value{flex: none;color: var(--ui-cwc-muted);font-variant-numeric: tabular-nums}
.ui-cwc__remove{display: grid;flex: none;place-items: center;width: 24px;height: 24px;border-radius: 6px;color: var(--ui-cwc-icon);transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cwc__remove:hover{background: var(--ui-cwc-full-bg);color: var(--ui-cwc-full)}
.ui-cwc__empty{height: 28px;font-size: 12px;line-height: 28px;color: var(--ui-cwc-muted)}
.ui-cwc__foot{display: flex;align-items: center;gap: 8px;height: 44px;padding: 0 8px 0 16px;border-top: 0.5px solid var(--ui-cwc-line)}
.ui-cwc__caption{flex: 1;min-width: 0;overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-cwc-muted);white-space: nowrap;text-overflow: ellipsis;font-variant-numeric: tabular-nums}
.ui-cwc__swap{display: grid;min-width: 0}
.ui-cwc__swap-item{grid-area: 1 / 1;min-width: 0;overflow: hidden;text-overflow: ellipsis;animation: ui-cwc-swap-in var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-cwc__swap-item[data-out]{animation: ui-cwc-swap-out var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-cwc__swap-item[data-tone="ok"]{color: var(--ui-cwc-ok)}
.ui-cwc__swap-item[data-tone="ok"] b{color: inherit}
.ui-cwc__swap-item[data-tone="warn"]{color: var(--ui-cwc-warn)}
.ui-cwc__swap-item[data-tone="full"]{color: var(--ui-cwc-full)}
.ui-cwc__action{display: inline-flex;flex: none;align-items: center;gap: 6px;height: 28px;padding: 0 8px 0 10px;border-radius: 6px;background: var(--ui-cwc-card);box-shadow: var(--ui-cwc-shadow);font-size: 13px;font-weight: 500;line-height: 20px;color: var(--ui-cwc-strong);white-space: nowrap;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cwc__action:hover{background: #faf7f4}
.ui-cwc__action svg{color: var(--ui-cwc-icon);transition: transform var(--nm-dur-3, 240ms) var(--ui-cwc-ease), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cwc__action:hover svg{color: var(--ui-cwc-ink);transform: translateX(2px)}
.ui-cwc__shimmer{position: relative;display: inline-block}
.ui-cwc__shimmer::after{content: attr(data-text);content: attr(data-text) / "";position: absolute;inset: 0;white-space: nowrap;color: transparent;background: linear-gradient(90deg, transparent 38%, var(--ui-cwc-shine) 50%, transparent 62%) 100% 0 / 300% 100% no-repeat;-webkit-background-clip: text;background-clip: text;animation: ui-cwc-sweep var(--nm-dur-6, 1100ms) linear infinite;pointer-events: none}
@keyframes ui-cwc-leave{to{opacity: 0;filter: blur(3px);transform: scale(0.92)}
}
@keyframes ui-cwc-swap-in{from{opacity: 0;filter: blur(2px)}
}
@keyframes ui-cwc-swap-out{from{opacity: 1}
to{opacity: 0;filter: blur(2px)}
}
@keyframes ui-cwc-wave{0%, 100%{transform: none}
50%{transform: scale(0.82)}
}
@keyframes ui-cwc-shine{0%, 100%{opacity: 0}
50%{opacity: 0.75}
}
@keyframes ui-cwc-spin{to{transform: rotate(360deg)}
}
@keyframes ui-cwc-sweep{from{background-position: 100% 0}
to{background-position: 0% 0}
}
@container (max-width: 310px){.ui-cwc__card{padding: 12px 14px 6px}
.ui-cwc__foot{padding: 0 8px 0 14px}
.ui-cwc__model{max-width: 42%}
.ui-cwc__field{grid-template-columns: repeat(var(--ui-cwc-cols-narrow), minmax(0, 1fr))}
.ui-cwc__compact{padding: 0 6px}
.ui-cwc__compact-text{display: none}
}
@media (pointer: coarse){.ui-cwc__row{min-height: 38px}
.ui-cwc__main{height: 38px}
.ui-cwc__compact{height: 30px;padding: 0 9px 0 7px}
.ui-cwc__item{height: 34px}
.ui-cwc__remove{width: 30px;height: 30px}
.ui-cwc__foot{height: 52px}
.ui-cwc__action{height: 34px}
}
@media (prefers-reduced-motion: reduce){.ui-cwc *, .ui-cwc *::before, .ui-cwc *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-cwc{--ui-cwc-card: #211b16;--ui-cwc-strong: #fffdfb;--ui-cwc-ink: rgba(255, 253, 251, 0.9);--ui-cwc-text: rgba(255, 253, 251, 0.62);--ui-cwc-muted: rgba(255, 253, 251, 0.46);--ui-cwc-faint: rgba(255, 253, 251, 0.3);--ui-cwc-icon: rgba(255, 253, 251, 0.5);--ui-cwc-line: rgba(255, 253, 251, 0.08);--ui-cwc-fill: rgba(255, 253, 251, 0.08);--ui-cwc-wash: rgba(255, 253, 251, 0.04);--ui-cwc-free: rgba(255, 253, 251, 0.08);--ui-cwc-c1: #ff8a5c;--ui-cwc-c2: rgba(255, 138, 92, 0.7);--ui-cwc-c3: rgba(255, 138, 92, 0.46);--ui-cwc-c4: #ff8a5c;--ui-cwc-c5: #2f8d5c;--ui-cwc-c6: #e8b05c;--ui-cwc-accent: #ff8a5c;--ui-cwc-warn: #e8b05c;--ui-cwc-warn-bg: rgba(217, 149, 48, 0.16);--ui-cwc-full: #f0938c;--ui-cwc-full-bg: rgba(226, 84, 74, 0.14);--ui-cwc-ok: #2f8d5c;--ui-cwc-ok-bg: rgba(47, 141, 92, 0.14);--ui-cwc-shine: #fffdfb;--ui-cwc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-cwc-focus: rgba(255, 138, 92, 0.5)}
:where(.dark, [data-theme="dark"]) .ui-cwc__action:hover{background: #27201a}

`;
