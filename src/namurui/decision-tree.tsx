"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/*
 * Decision Tree – an agent's fork drawn as a tree, in a single self-contained file.
 * The question sits in the root card on the left, the branches hang off a rounded rail, and each
 * branch carries what it leads to: a follow-up question with its own answers, or the consequences
 * of taking it. The agent's own preference is marked at both levels, and a consequence the agent is
 * unsure about is flagged – hover, focus or tab to it and the note opens in a card over the tree.
 * Number keys take a branch, the number after the last one opens a field for your own instruction,
 * and the arrow keys walk to the next decision in the queue. Picking fades the rest of the tree
 * away and a reply grows in under the branch.
 * The links are measured from the laid-out cards, so the rails follow the real geometry of the tree
 * at any width; the sheet reflows the whole thing to one column under 639px.
 * The styles are injected below, so no extra files are needed.
 */

export type DecisionRisk = "high" | "medium";

/** A consequence the agent flagged; the note opens on hover or focus. */
export type DecisionFlag = {
  text: string;
  /** One line explaining why it is flagged */
  note?: string;
  /** Where the note comes from, e.g. a runbook section */
  source?: string;
};

/** One line of consequences: plain text, or text with flagged parts mixed in. */
export type DecisionEffect = string | (string | DecisionFlag)[];

/** A mark for a branch or a tool it touches. */
export type DecisionIconId = "alert" | "github" | "flag" | "intercom" | "slack" | "telemetry";

export type DecisionSubOption = {
  label: string;
  /** Marks the agent's own preference – at most one per question */
  pick?: boolean;
  icon?: DecisionIconId;
  /** What this answer leads to, one line each */
  effects?: DecisionEffect[];
  /** Tools it touches, shown as small marks at the end of the line */
  apps?: DecisionIconId[];
};

/** The follow-up the agent asks once a branch is taken. */
export type DecisionSub = {
  question: string;
  options: DecisionSubOption[];
};

export type DecisionBranch = {
  label: string;
  icon?: DecisionIconId;
  /** Marks the agent's own preference – at most one branch */
  pick?: boolean;
  /** What the branch leads to when it is the last fork */
  effects?: DecisionEffect[];
  apps?: DecisionIconId[];
  /** A follow-up question under the branch */
  ask?: DecisionSub;
};

export type Decision = {
  id: string;
  question: string;
  /** The line under the question – the damage so far, how long it has been going on */
  context?: string;
  agent: string;
  model?: string;
  /** Replaces the agent mark in the avatar square */
  icon?: ReactNode;
  risk?: DecisionRisk;
  branches: DecisionBranch[];
};

/** The path that was taken through one decision. */
export type DecisionChoice = {
  /** What was clicked, ready for your own log */
  label: string;
  branch?: DecisionBranch;
  /** The follow-up answer, when the branch asked one */
  sub?: DecisionSubOption;
  /** Your own instruction, when "Other…" was used */
  other?: string;
};

export type DecisionTreeProps = {
  /** The queue; each entry is one question with its branches */
  decisions: Decision[];
  /** Called with the decision and the path taken – return a line for the agent's reply */
  onChoose?: (
    decision: Decision,
    choice: DecisionChoice,
  ) => string | void | Promise<string | void>;
  /** Shows the "Other…" branch with a field for your own instruction */
  allowOther?: boolean;
  /** Heading in the header row */
  title?: string;
  className?: string;
};

type PickState = { branch: number; sub?: number; other?: string };

type Stage = "idle" | "picked" | "replied" | "leaving";

type LinkSpec = {
  key: string;
  kind: "branch" | "leaf" | "sub";
  i: number;
  j: number;
  d: string;
};

type Layout = {
  width: number;
  height: number;
  links: LinkSpec[];
  out: { left: number; top: number } | null;
};

type TipState = {
  note: string;
  source?: string;
  left: number;
  width: number;
  x: number;
  top: number | null;
  bottom: number | null;
};

const PICK_LABEL = "Agent's pick";

export function DecisionTree({
  decisions,
  onChoose,
  allowOther = true,
  title = "Decisions",
  className,
}: DecisionTreeProps) {
  const rootEl = useRef<HTMLDivElement>(null);
  const bodyEl = useRef<HTMLDivElement>(null);
  const treeEl = useRef<HTMLDivElement>(null);
  const inputEl = useRef<HTMLTextAreaElement>(null);
  const mirrorEl = useRef<HTMLSpanElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const timers = useRef<number[]>([]);
  const signature = useRef("");

  const [answered, setAnswered] = useState<Record<string, true>>({});
  const [index, setIndex] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [hot, setHot] = useState<number | null>(null);
  const [hotSub, setHotSub] = useState<{ branch: number; sub: number } | null>(null);
  const [pick, setPick] = useState<PickState | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [reply, setReply] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [inputHeight, setInputHeight] = useState(32);
  const [pressed, setPressed] = useState<string | null>(null);
  const [openFlag, setOpenFlag] = useState<string | null>(null);
  const [tip, setTip] = useState<TipState | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);

  const remaining = decisions.filter((decision) => !answered[decision.id]);
  const position = Math.min(index, Math.max(0, remaining.length - 1));
  const current = remaining[position] ?? null;
  const branches = current?.branches ?? [];
  const rows = branches.length + (allowOther ? 1 : 0);
  const otherIndex = branches.length;
  const pickTarget = pick?.other != null ? otherIndex : (pick?.branch ?? -1);

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current = timers.current.filter((timer) => timer !== id);
      fn();
    }, ms);
    timers.current.push(id);
  };

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current = [];
    },
    [],
  );

  /* Focus the panel once so the number keys work before anything is clicked. */
  useEffect(() => {
    const el = rootEl.current;
    if (!el) return;
    const focused = document.activeElement;
    if (focused && focused !== document.body) return;
    el.focus({ preventScroll: true });
  }, []);

  const setRef = (key: string) => (el: HTMLElement | null) => {
    if (el) els.current.set(key, el);
    else els.current.delete(key);
  };

  const keyOf = (kind: string, i: number, j?: number) =>
    current ? `${current.id}:${kind}:${i}${j == null ? "" : `:${j}`}` : `${kind}:none`;

  /* ---------------- measuring ---------------- */

  useLayoutEffect(() => {
    const tree = treeEl.current;
    if (!tree) return;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const base = tree.getBoundingClientRect();
      if (!base.width) return;

      /* Every box relative to the tree, looked up by the key its ref registered. */
      const at = (key: string) => {
        const el = els.current.get(key);
        if (!el) return null;
        const box = el.getBoundingClientRect();
        return { x: box.left - base.left, y: box.top - base.top, w: box.width, h: box.height };
      };

      const root = at(keyOf("root", 0));
      const links: LinkSpec[] = [];
      let out: Layout["out"] = null;

      for (let i = 0; i < rows; i += 1) {
        const opt = at(keyOf("opt", i));
        if (!root || !opt) continue;
        links.push({
          key: `branch:${i}`,
          kind: "branch",
          i,
          j: 0,
          d:
            opt.x > root.x + root.w
              ? rail(root.x + root.w, root.y + root.h / 2, opt.x, opt.y + opt.h / 2, 6)
              : elbow(opt.x - 10, root.y + root.h, opt.x, opt.y + opt.h / 2),
        });
        if (i >= branches.length) continue;

        const subq = at(keyOf("subq", i));
        const leaf = at(keyOf("leaf", i));
        const landing = subq ?? leaf;
        if (landing) {
          links.push({
            key: `leaf:${i}`,
            kind: "leaf",
            i,
            j: 0,
            d:
              landing.x > opt.x + opt.w
                ? rail(opt.x + opt.w, opt.y + opt.h / 2, landing.x, landing.y + landing.h / 2, 4)
                : elbow(landing.x - 10, opt.y + opt.h, landing.x, landing.y + landing.h / 2),
          });
        }
        if (subq) {
          const options = branches[i].ask?.options ?? [];
          for (let j = 0; j < options.length; j += 1) {
            const sopt = at(keyOf("sopt", i, j));
            if (!sopt) continue;
            links.push({
              key: `sub:${i}:${j}`,
              kind: "sub",
              i,
              j,
              d: elbow(subq.x + 14, subq.y + subq.h, sopt.x, sopt.y + 16),
            });
          }
        }
      }

      if (pick) {
        const from = at(keyOf("opt", pickTarget));
        const row = at(keyOf("row", pickTarget));
        const side =
          pick.other == null
            ? (at(keyOf("subq", pick.branch)) ?? at(keyOf("leaf", pick.branch)))
            : null;
        if (from) {
          const left = side ? side.x : from.x + from.w + 24;
          const bottom = row ? row.y + row.h : from.y + from.h;
          out = {
            left: Math.max(0, Math.min(left, base.width - 284)),
            top: bottom + 10,
          };
        }
      }

      const next: Layout = { width: base.width, height: base.height, links, out };
      const sig = `${round(base.width)}x${round(base.height)}|${links
        .map((link) => `${link.key}=${link.d}`)
        .join("|")}|${out ? `${round(out.left)},${round(out.top)}` : ""}`;
      if (sig === signature.current) return;
      signature.current = sig;
      setLayout(next);
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(tree);
    if (bodyEl.current) observer.observe(bodyEl.current);
    if (document.fonts) document.fonts.ready.then(schedule).catch(() => undefined);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [current, rows, pick, pickTarget, otherOpen, otherText, inputHeight, stage]);

  /* Grow the "Other…" field to its text, and put the caret in it. */
  useLayoutEffect(() => {
    if (!otherOpen) return;
    const mirror = mirrorEl.current;
    if (mirror) setInputHeight(Math.max(32, mirror.offsetHeight));
    inputEl.current?.focus();
  }, [otherOpen, otherText]);

  /* ---------------- deciding ---------------- */

  const commit = (value: PickState, label: string) => {
    if (!current || pick) return;
    const decision = current;
    const branch = value.branch >= 0 ? branches[value.branch] : undefined;
    const sub = value.sub == null ? undefined : branch?.ask?.options[value.sub];

    setPick(value);
    setStage("picked");
    setActive(null);
    setHotSub(null);
    setTip(null);
    setOpenFlag(null);
    setOtherOpen(false);
    setAnnouncement(`Chose ${label}.`);

    const finish = () => {
      setStage("leaving");
      later(() => {
        setAnswered((previous) => ({ ...previous, [decision.id]: true }));
        setPick(null);
        setReply(null);
        setStage("idle");
        setActive(null);
        setHot(null);
        setOtherText("");
        setOtherOpen(false);
        setInputHeight(32);
        setAnnouncement("Next decision.");
        rootEl.current?.focus({ preventScroll: true });
      }, 320);
    };

    let result: string | void | Promise<string | void> | undefined;
    try {
      result = onChoose?.(decision, { label, branch, sub, other: value.other });
    } catch {
      result = undefined;
    }

    Promise.resolve(result)
      .then((answer) => {
        later(() => {
          const line = typeof answer === "string" && answer ? answer : null;
          setReply(line);
          setStage("replied");
          setAnnouncement(line ? `${label}. ${line}` : `Chose ${label}.`);
          later(finish, line ? 1700 : 1000);
        }, 650);
      })
      .catch(() => {
        setReply("The agent could not take that path.");
        setStage("replied");
        setAnnouncement(`${label}. The agent could not take that path.`);
        later(finish, 1500);
      });
  };

  const takeBranch = (i: number) => {
    if (!current || pick) return;
    const branch = branches[i];
    if (!branch) return;
    setTip(null);
    if (branch.ask && branch.ask.options.length > 0) {
      setActive(i);
      setOtherOpen(false);
      setOtherText("");
      setInputHeight(32);
      setAnnouncement(`${branch.ask.question} ${branch.ask.options.length} options.`);
      return;
    }
    commit({ branch: i }, branch.label);
  };

  const openOther = () => {
    if (!current || pick || !allowOther) return;
    setActive(null);
    setOtherOpen(true);
    setAnnouncement("Type what the agent should do instead. Enter sends.");
  };

  const closeOther = () => {
    setOtherOpen(false);
    setOtherText("");
    setInputHeight(32);
  };

  const sendOther = () => {
    if (!current || pick) return;
    const text = otherText.trim();
    if (!text) {
      inputEl.current?.focus();
      return;
    }
    commit({ branch: -1, other: text }, text);
  };

  const step = (direction: 1 | -1) => {
    if (!current || pick || remaining.length < 2) return;
    const next = (position + direction + remaining.length) % remaining.length;
    setIndex(next);
    setActive(null);
    setHot(null);
    setHotSub(null);
    setTip(null);
    setOpenFlag(null);
    setOtherOpen(false);
    setOtherText("");
    setInputHeight(32);
    setAnnouncement(`Decision ${next + 1} of ${remaining.length}.`);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable)) return;
    if (event.metaKey || event.ctrlKey || event.altKey || !current) return;

    if (event.key.length === 1 && event.key >= "1" && event.key <= "9") {
      const wanted = Number(event.key);
      if (wanted > rows) return;
      event.preventDefault();
      if (wanted < rows || !allowOther) takeBranch(wanted - 1);
      else openOther();
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "Escape" && otherOpen) {
      event.preventDefault();
      closeOther();
    }
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendOther();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeOther();
    }
  };

  const showTip = (flag: DecisionFlag, el: HTMLElement) => {
    const body = bodyEl.current;
    if (!body) return;
    const area = body.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const width = Math.min(300, Math.max(180, area.width - 20));
    const center = box.left - area.left + box.width / 2;
    const left = Math.max(4, Math.min(center - width / 2, area.width - width - 4));
    const below = area.height - (box.bottom - area.top) > 112;
    setTip({
      note: flag.note ?? "The agent flagged this consequence.",
      source: flag.source,
      width,
      left,
      x: Math.max(0, center - left),
      top: below ? box.bottom - area.top + 8 : null,
      bottom: below ? null : area.height - (box.top - area.top) + 8,
    });
  };

  const flagParts = (parts: DecisionEffect, id: string) => {
    const items = typeof parts === "string" ? [parts] : parts;
    return items.map((part, partIndex) => {
      if (typeof part === "string") return <span key={partIndex}>{part}</span>;
      const key = `${id}:${partIndex}`;
      return (
        <mark
          key={partIndex}
          className="ui-dctc__flag"
          tabIndex={0}
          data-on={openFlag === key ? "" : undefined}
          aria-label={`${part.text} – the agent is unsure`}
          onMouseEnter={(event) => showTip(part, event.currentTarget)}
          onMouseLeave={() => setTip(null)}
          onFocus={(event) => {
            setOpenFlag(key);
            showTip(part, event.currentTarget);
          }}
          onBlur={() => {
            setOpenFlag(null);
            setTip(null);
          }}
        >
          {part.text}
        </mark>
      );
    });
  };

  const effects = (lines: DecisionEffect[], id: string) =>
    lines.map((line, lineIndex) => (
      <span key={lineIndex} className="ui-dctc__effect">
        {flagParts(line, `${id}:${lineIndex}`)}
      </span>
    ));

  const apps = (list: DecisionIconId[] | undefined) =>
    list && list.length > 0 ? (
      <span className="ui-dctc__apps" aria-hidden="true">
        {list.map((icon, iconIndex) => (
          <span key={`${icon}-${iconIndex}`} className="ui-dctc__app">
            <ToolIcon id={icon} />
          </span>
        ))}
      </span>
    ) : null;

  const busy = pick != null;
  const dimmed = active != null || busy;
  const pickedBranch = pick == null || pick.other != null ? null : pick.branch;
  const pickedSub = pick?.sub ?? null;
  const pickSide = pick == null ? -1 : pick.other != null ? otherIndex : pick.branch;
  const focusBranch = busy ? pickSide : (active ?? -1);
  const pickedLabel = (() => {
    if (pick == null) return "";
    if (pick.other != null) return pick.other;
    const branch = branches[pick.branch];
    const option = pick.sub == null ? undefined : branch?.ask?.options[pick.sub];
    return option?.label ?? branch?.label ?? "Your instruction";
  })();
  const settled = stage === "replied" || stage === "leaving";

  return (
    <div
      ref={rootEl}
      className={["ui-dctc", className].filter(Boolean).join(" ")}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <style href="ui-decision-tree" precedence="default">
        {css}
      </style>

      <header className="ui-dctc__head">
        <span className="ui-dctc__mark">
          <TreeMark />
        </span>
        <span className="ui-dctc__heading">{title}</span>
        <span className="ui-dctc__count">
          {remaining.length === 0 ? "Nothing waiting" : `${remaining.length} waiting for you`}
        </span>
        {remaining.length > 0 && (
          <span className="ui-dctc__pager" aria-label={`Decision ${position + 1} of ${remaining.length}`}>
            <span className="ui-dctc__dots" aria-hidden="true">
              {remaining.map((decision, dot) => (
                <span key={decision.id} data-on={dot === position ? "" : undefined} />
              ))}
            </span>
            <span className="ui-dctc__of">
              {position + 1} of {remaining.length}
            </span>
          </span>
        )}
      </header>

      <div className="ui-dctc__body" ref={bodyEl}>
        {current ? (
          <div
            className="ui-dctc__tree"
            ref={treeEl}
            data-picked={busy ? "" : undefined}
            data-final={settled ? "" : undefined}
            data-leaving={stage === "leaving" ? "" : undefined}
          >
            <svg
              className="ui-dctc__links"
              width={layout ? round(layout.width) : undefined}
              height={layout ? round(layout.height) : undefined}
              aria-hidden="true"
            >
              {(layout?.links ?? []).map((link) => {
                const branch = branches[link.i];
                const onPath = !busy || link.i === focusBranch;
                return (
                  <path
                    key={link.key}
                    pathLength={1}
                    d={link.d}
                    className="ui-dctc__link"
                    data-kind={link.kind}
                    data-pick={
                      link.kind === "sub"
                        ? branch?.ask?.options[link.j]?.pick
                          ? ""
                          : undefined
                        : branch?.pick
                          ? ""
                          : undefined
                    }
                    data-hot={!busy && hot === link.i ? "" : undefined}
                    data-soft={
                      link.kind === "sub" &&
                      pickedBranch === link.i &&
                      pickedSub != null &&
                      pickedSub !== link.j
                        ? ""
                        : undefined
                    }
                    data-dim={!onPath ? "" : undefined}
                    data-live={!busy && (active ?? hot) === link.i ? "" : undefined}
                    style={{ "--i": link.i, "--j": link.j } as CSSProperties}
                  />
                );
              })}
            </svg>

            <div className="ui-dctc__root" ref={setRef(keyOf("root", 0))}>
              {current.risk && (
                <span className="ui-dctc__risk" data-risk={current.risk}>
                  {current.risk === "high" ? "High risk" : "Medium risk"}
                </span>
              )}
              <div className="ui-dctc__who">
                <span className="ui-dctc__avatar" aria-hidden="true">
                  {current.icon ?? <AgentMark />}
                </span>
                <span className="ui-dctc__meta">
                  <span className="ui-dctc__agent">{current.agent}</span>
                  {current.model && <span className="ui-dctc__model">{current.model}</span>}
                </span>
              </div>
              <h3 className="ui-dctc__q">{current.question}</h3>
              {current.context && <p className="ui-dctc__context">{current.context}</p>}
            </div>

            <div className="ui-dctc__branches" role="group" aria-label="How should the agent go on?">
              {branches.map((branch, i) => {
                const isActive = active === i;
                const isPicked = pickedBranch === i;
                const live = !busy && (active ?? hot) === i;
                return (
                  <div
                    key={`${current.id}-${i}`}
                    className="ui-dctc__row"
                    ref={setRef(keyOf("row", i))}
                    data-dim={dimmed && focusBranch !== i ? "" : undefined}
                    style={{ "--i": i } as CSSProperties}
                  >
                    <button
                      type="button"
                      className="ui-dctc__opt"
                      ref={setRef(keyOf("opt", i))}
                      data-pick={branch.pick ? "" : undefined}
                      data-hot={!busy && (isActive || hot === i) ? "" : undefined}
                      data-pressed={pressed === `b${i}` ? "" : undefined}
                      aria-keyshortcuts={String(i + 1)}
                      aria-label={`${branch.label}${branch.pick ? " – the agent's pick" : ""}`}
                      disabled={busy}
                      onMouseEnter={() => setHot(i)}
                      onMouseLeave={() => {
                        setHot(null);
                        setPressed(null);
                      }}
                      onFocus={() => setHot(i)}
                      onBlur={() => setHot(null)}
                      onPointerDown={() => setPressed(`b${i}`)}
                      onPointerUp={() => setPressed(null)}
                      onPointerCancel={() => setPressed(null)}
                      onClick={() => takeBranch(i)}
                    >
                      <kbd className="ui-dctc__kbd">{i + 1}</kbd>
                      <span className="ui-dctc__label">
                        {branch.icon && (
                          <span className="ui-dctc__icon" aria-hidden="true">
                            <ToolIcon id={branch.icon} />
                          </span>
                        )}
                        {branch.label}
                      </span>
                      {branch.pick && <span className="ui-dctc__pick">{PICK_LABEL}</span>}
                    </button>

                    {branch.ask ? (
                      <div
                        className="ui-dctc__sub"
                        data-live={live || isPicked ? "" : undefined}
                        data-asking={isActive ? "" : undefined}
                      >
                        <div className="ui-dctc__subq" ref={setRef(keyOf("subq", i))}>
                          {branch.ask.question}
                          <span className="ui-dctc__more">
                            {branch.ask.options.length} option
                            {branch.ask.options.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="ui-dctc__subopts" role="group" aria-label={branch.ask.question}>
                          {branch.ask.options.map((option, j) => (
                            <button
                              key={`${option.label}-${j}`}
                              type="button"
                              className="ui-dctc__sopt"
                              ref={setRef(keyOf("sopt", i, j))}
                              data-pick={option.pick ? "" : undefined}
                              data-hot={
                                !busy && hotSub?.branch === i && hotSub.sub === j ? "" : undefined
                              }
                              data-pressed={pressed === `s${i}-${j}` ? "" : undefined}
                              data-soft={
                                pickedBranch === i &&
                                pickedSub != null &&
                                pickedSub !== j
                                  ? ""
                                  : undefined
                              }
                              aria-label={`${option.label}${option.pick ? " – the agent's pick" : ""}`}
                              disabled={!isActive}
                              tabIndex={isActive ? 0 : -1}
                              style={{ "--j": j } as CSSProperties}
                              onMouseEnter={() => setHotSub({ branch: i, sub: j })}
                              onMouseLeave={() => {
                                setHotSub(null);
                                setPressed(null);
                              }}
                              onFocus={() => setHotSub({ branch: i, sub: j })}
                              onBlur={() => setHotSub(null)}
                              onPointerDown={() => setPressed(`s${i}-${j}`)}
                              onPointerUp={() => setPressed(null)}
                              onPointerCancel={() => setPressed(null)}
                              onClick={() => commit({ branch: i, sub: j }, option.label)}
                            >
                              <span className="ui-dctc__sopt-top">
                                <span className="ui-dctc__label">
                                  {option.icon && (
                                    <span className="ui-dctc__icon" aria-hidden="true">
                                      <ToolIcon id={option.icon} />
                                    </span>
                                  )}
                                  {option.label}
                                </span>
                                {option.pick && <span className="ui-dctc__pick">{PICK_LABEL}</span>}
                              </span>
                              {(option.effects?.length || option.apps?.length) && (
                                <span className="ui-dctc__sopt-effects">
                                  <span className="ui-dctc__lines">
                                    {effects(option.effects ?? [], `${current.id}:${i}:${j}`)}
                                  </span>
                                  {apps(option.apps)}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : branch.effects?.length ? (
                      <div className="ui-dctc__leaf" ref={setRef(keyOf("leaf", i))}>
                        <span className="ui-dctc__lines">
                          {effects(branch.effects, `${current.id}:leaf:${i}`)}
                        </span>
                        {apps(branch.apps)}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {allowOther && (
                <div
                  className="ui-dctc__row"
                  ref={setRef(keyOf("row", otherIndex))}
                  data-dim={dimmed && focusBranch !== otherIndex ? "" : undefined}
                  style={{ "--i": otherIndex } as CSSProperties}
                >
                  <div
                    className="ui-dctc__opt"
                    data-other=""
                    data-open={otherOpen ? "" : undefined}
                    ref={setRef(keyOf("opt", otherIndex))}
                  >
                    {pick?.other != null ? (
                      <div className="ui-dctc__said">{pick.other}</div>
                    ) : otherOpen ? (
                      <div className="ui-dctc__grow" style={{ height: inputHeight }}>
                        <span className="ui-dctc__mirror" ref={mirrorEl} aria-hidden="true">
                          {otherText || " "}
                        </span>
                        <textarea
                          ref={inputEl}
                          className="ui-dctc__input"
                          rows={1}
                          value={otherText}
                          placeholder="Tell the agent what to do instead…"
                          onChange={(event) => setOtherText(event.target.value)}
                          onKeyDown={onInputKeyDown}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="ui-dctc__other"
                        aria-keyshortcuts={String(otherIndex + 1)}
                        disabled={busy}
                        onClick={openOther}
                      >
                        <kbd className="ui-dctc__kbd">{otherIndex + 1}</kbd>
                        <span className="ui-dctc__label">Other…</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {busy && layout?.out && (
              <div
                className="ui-dctc__out"
                data-kind={settled ? "replied" : undefined}
                style={{ left: layout.out.left, top: layout.out.top }}
              >
                <span className="ui-dctc__out-head">
                  <CheckIcon />
                  {pickedLabel}
                  {stage === "picked" && <span className="ui-dctc__running">running</span>}
                </span>
                {stage === "picked" ? (
                  <span className="ui-dctc__typing" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                ) : reply ? (
                  <span className="ui-dctc__answer">{reply}</span>
                ) : null}
              </div>
            )}
          </div>
        ) : (
          <div className="ui-dctc__empty">
            <span className="ui-dctc__empty-mark" aria-hidden="true">
              <CheckIcon />
            </span>
            <b>No decisions waiting</b>
            <span>New ones show up here as soon as an agent needs you.</span>
          </div>
        )}

        {current && (
          <p className="ui-dctc__hint" aria-hidden="true">
            Pick a branch <kbd className="ui-dctc__kbd">1</kbd>–<kbd className="ui-dctc__kbd">{rows}</kbd>
            <span>·</span> next <kbd className="ui-dctc__kbd">→</kbd>
          </p>
        )}

        {tip && (
          <div
            className="ui-dctc__tip"
            data-side={tip.bottom == null ? undefined : "above"}
            role="tooltip"
            style={
              {
                left: tip.left,
                top: tip.top == null ? "auto" : tip.top,
                bottom: tip.bottom == null ? "auto" : tip.bottom,
                width: tip.width,
                "--x": `${round(tip.x)}px`,
              } as CSSProperties
            }
          >
            <span className="ui-dctc__tip-head">
              <FlagGlyph />
              Unsure
            </span>
            <p>{tip.note}</p>
            {tip.source && <span className="ui-dctc__tip-source">{tip.source}</span>}
          </div>
        )}
      </div>

      <div className="ui-dctc__sr" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
}

/* ---------------- geometry ---------------- */

const round = (value: number) => {
  const next = Math.round(value * 100) / 100;
  return Object.is(next, -0) ? 0 : next;
};

/** A rail between two boxes: a short lead, an 8px corner, a vertical run and the same back out. */
function rail(x0: number, y0: number, x1: number, y1: number, lead: number) {
  const dy = y1 - y0;
  if (Math.abs(dy) < 0.5) return `M${round(x0)} ${round(y0)}H${round(x1)}`;
  const radius = Math.min(8, Math.abs(dy) / 2, Math.max(0, (x1 - x0 - lead * 2) / 2));
  const dir = dy > 0 ? 1 : -1;
  const turn = x0 + lead + radius;
  return [
    `M${round(x0)} ${round(y0)}`,
    `H${round(x0 + lead)}`,
    `Q${round(turn)} ${round(y0)} ${round(turn)} ${round(y0 + dir * radius)}`,
    `V${round(y1 - dir * radius)}`,
    `Q${round(turn)} ${round(y1)} ${round(x1 - lead)} ${round(y1)}`,
    `H${round(x1)}`,
  ].join("");
}

/** A follow-up question to one of its answers: straight down, a 4px corner, then a short run in. */
function elbow(x0: number, y0: number, x1: number, y1: number) {
  const dy = y1 - y0;
  if (Math.abs(dy) < 0.5) return `M${round(x0)} ${round(y0)}H${round(x1)}`;
  const radius = Math.min(4, Math.abs(dy) / 2);
  const dir = dy > 0 ? 1 : -1;
  return [
    `M${round(x0)} ${round(y0)}`,
    `V${round(y1 - dir * radius)}`,
    `Q${round(x0)} ${round(y1)} ${round(x0 + radius)} ${round(y1)}`,
    `H${round(x1)}`,
  ].join("");
}

/* ---------------- icons ---------------- */

function TreeMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="3.5" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12.5" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12.5" cy="12.5" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M5.5 8H7.5C8.3 8 8.5 7.6 8.5 6.8V5C8.5 4 9 3.5 10 3.5H10.5M8.5 8.2V11C8.5 12 9 12.5 10 12.5H10.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m5.5 12.5 4.2 4.2 8.8-9.4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FlagGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 22.525H0l12-21.05 12 21.05z" />
    </svg>
  );
}

function AgentMark() {
  return (
    <svg viewBox="0 0 1200 1200" aria-hidden="true">
      <path
        fill="#D97757"
        d="M 233.959793 800.214905 L 468.644287 668.536987 L 472.590637 657.100647 L 468.644287 650.738403 L 457.208069 650.738403 L 417.986633 648.322144 L 283.892639 644.69812 L 167.597321 639.865845 L 54.926208 633.825623 L 26.577238 627.785339 L 3.3e-05 592.751709 L 2.73832 575.27533 L 26.577238 559.248352 L 60.724873 562.228149 L 136.187973 567.382629 L 249.422867 575.194763 L 331.570496 580.026978 L 453.261841 592.671082 L 472.590637 592.671082 L 475.328857 584.859009 L 468.724915 580.026978 L 463.570557 575.194763 L 346.389313 495.785217 L 219.543671 411.865906 L 153.100723 363.543762 L 117.181267 339.060425 L 99.060455 316.107361 L 91.248367 266.01355 L 123.865784 230.093994 L 167.677887 233.073853 L 178.872513 236.053772 L 223.248367 270.201477 L 318.040283 343.570496 L 441.825592 434.738342 L 459.946411 449.798706 L 467.194672 444.64447 L 468.080597 441.020203 L 459.946411 427.409485 L 392.617493 305.718323 L 320.778564 181.932983 L 288.80542 130.630859 L 280.348999 99.865845 C 277.369171 87.221436 275.194641 76.590698 275.194641 63.624268 L 312.322174 13.20813 L 332.8591 6.604126 L 382.389313 13.20813 L 403.248352 31.328979 L 434.013519 101.71814 L 483.865753 212.537048 L 561.181274 363.221497 L 583.812134 407.919434 L 595.892639 449.315491 L 600.40271 461.959839 L 608.214783 461.959839 L 608.214783 454.711609 L 614.577271 369.825623 L 626.335632 265.61084 L 637.771851 131.516846 L 641.718201 93.745117 L 660.402832 48.483276 L 697.530334 24.000122 L 726.52356 37.852417 L 750.362549 72 L 747.060486 94.067139 L 732.886047 186.201416 L 705.100708 330.52356 L 686.979919 427.167847 L 697.530334 427.167847 L 709.61084 415.087341 L 758.496704 350.174561 L 840.644348 247.490051 L 876.885925 206.738342 L 919.167847 161.71814 L 946.308838 140.29541 L 997.61084 140.29541 L 1035.38269 196.429626 L 1018.469849 254.416199 L 965.637634 321.422852 L 921.825562 378.201538 L 859.006714 462.765259 L 819.785278 530.41626 L 823.409424 535.812073 L 832.75177 534.92627 L 974.657776 504.724915 L 1051.328979 490.872559 L 1142.818848 475.167786 L 1184.214844 494.496582 L 1188.724854 514.147644 L 1172.456421 554.335693 L 1074.604126 578.496765 L 959.838989 601.449829 L 788.939636 641.879272 L 786.845764 643.409485 L 789.261841 646.389343 L 866.255127 653.637634 L 899.194702 655.409424 L 979.812134 655.409424 L 1129.932861 666.604187 L 1169.154419 692.537109 L 1192.671265 724.268677 L 1188.724854 748.429688 L 1128.322144 779.194641 L 1046.818848 759.865845 L 856.590759 714.604126 L 791.355774 698.335754 L 782.335693 698.335754 L 782.335693 703.731567 L 836.69812 756.885986 L 936.322205 846.845581 L 1061.073975 962.81897 L 1067.436279 991.490112 L 1051.409424 1014.120911 L 1034.496704 1011.704712 L 924.885986 929.234924 L 882.604126 892.107544 L 786.845764 811.48999 L 780.483276 811.48999 L 780.483276 819.946289 L 802.550415 852.241699 L 919.087341 1027.409424 L 925.127625 1081.127686 L 916.671204 1098.604126 L 886.469849 1109.154419 L 853.288696 1103.114136 L 785.073914 1007.355835 L 714.684631 899.516785 L 657.906067 802.872498 L 650.979858 806.81897 L 617.476624 1167.704834 L 601.771851 1186.147705 L 565.530212 1200 L 535.328857 1177.046997 L 519.302124 1139.919556 L 535.328857 1066.550537 L 554.657776 970.792053 L 570.362488 894.68457 L 584.536926 800.134277 L 592.993347 768.724976 L 592.429626 766.630859 L 585.503479 767.516968 L 514.22821 865.369263 L 405.825531 1011.865906 L 320.053711 1103.677979 L 299.516815 1111.812256 L 263.919525 1093.369263 L 267.221497 1060.429688 L 287.114136 1031.114136 L 405.825531 880.107361 L 477.422913 786.52356 L 523.651062 732.483276 L 523.328918 724.671265 L 520.590698 724.671265 L 205.288605 929.395935 L 149.154434 936.644409 L 124.993355 914.01355 L 127.973183 876.885986 L 139.409409 864.80542 L 234.201385 799.570435 L 233.879227 799.8927 Z"
      />
    </svg>
  );
}

function ToolIcon({ id }: { id: DecisionIconId }) {
  switch (id) {
    case "alert":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ color: "var(--ui-dctc-strong)" }}>
          <path d="M24 22.525H0l12-21.05 12 21.05z" />
        </svg>
      );
    case "github":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ color: "var(--ui-dctc-strong)" }}>
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
      );
    case "flag":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ color: "var(--ui-dctc-strong)" }}>
          <path d="M9.854 14.5 5 9.647.854 5.5A.5.5 0 0 0 0 5.854V8.44a.5.5 0 0 0 .146.353L5 13.647l.147.146L9.854 18.5l.146.147v-.049c.065.03.134.049.207.049h2.586a.5.5 0 0 0 .353-.854L9.854 14.5zm0-5-4-4a.487.487 0 0 0-.409-.144.515.515 0 0 0-.356.21.493.493 0 0 0-.089.288V8.44a.5.5 0 0 0 .147.353l9 9a.5.5 0 0 0 .853-.354v-2.585a.5.5 0 0 0-.146-.354l-5-5zm1-4a.5.5 0 0 0-.854.354V8.44a.5.5 0 0 0 .147.353l4 4a.5.5 0 0 0 .853-.354V9.854a.5.5 0 0 0-.146-.354l-4-4zm12.647 11.515a3.863 3.863 0 0 1-2.232-1.1l-4.708-4.707a.5.5 0 0 0-.854.354v6.585a.5.5 0 0 0 .5.5H23.5a.5.5 0 0 0 .5-.5v-.6c0-.276-.225-.497-.499-.532zm-5.394.032a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6zM.854 15.5a.5.5 0 0 0-.854.354v2.293a.5.5 0 0 0 .5.5h2.293c.222 0 .39-.135.462-.309a.493.493 0 0 0-.109-.545L.854 15.501zM5 14.647.854 10.5a.5.5 0 0 0-.854.353v2.586a.5.5 0 0 0 .146.353L4.854 18.5l.146.147h2.793a.5.5 0 0 0 .353-.854L5 14.647z" />
        </svg>
      );
    case "intercom":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ color: "rgb(0, 82, 204)" }}>
          <path d="M12.008 9.597a5.623 5.623 0 1 1 0 11.245 5.623 5.623 0 0 1 0-11.245zM.154 8.717l3.02 3.574a.639.639 0 0 0 .913.068c4.885-4.379 10.97-4.379 15.84 0a.642.642 0 0 0 .916-.068l3.006-3.574a.646.646 0 0 0-.075-.906c-7.1-6.204-16.462-6.204-23.555 0a.65.65 0 0 0-.065.906z" />
        </svg>
      );
    case "slack":
      return (
        <svg viewBox="0 0 49.883 49.877" fill="none" aria-hidden="true">
          <g transform="translate(0 0)">
            <path d="M18.3549 10.4784C15.4713 10.4784 13.1157 8.12279 13.1157 5.2392C13.1157 2.35561 15.4713 0 18.3549 0C21.2385 0 23.5941 2.35561 23.5941 5.2392V10.4784H18.3549Z" fill="#36C5F0" />
            <path d="M18.3575 13.12C21.2411 13.12 23.5967 15.4756 23.5967 18.3592C23.5967 21.2428 21.2411 23.5984 18.3575 23.5984H5.2392C2.35561 23.5984 0 21.2428 0 18.3592C0 15.4756 2.35561 13.12 5.2392 13.12H18.3575Z" fill="#36C5F0" />
          </g>
          <g transform="translate(26.28 0)">
            <path d="M13.1244 18.3592C13.1244 15.4756 15.48 13.12 18.3636 13.12C21.2472 13.12 23.6028 15.4756 23.6028 18.3592C23.6028 21.2428 21.2472 23.5984 18.3636 23.5984H13.1244V18.3592Z" fill="#2EB67D" />
            <path d="M10.4785 18.3575C10.4785 21.2411 8.12286 23.5967 5.23927 23.5967C2.35568 23.5967 7.4362e-05 21.2411 7.4362e-05 18.3575V5.2392C7.4362e-05 2.35561 2.35568 0 5.23927 0C8.12286 0 10.4785 2.35561 10.4785 5.2392V18.3575Z" fill="#2EB67D" />
          </g>
          <g transform="translate(0 26.28)">
            <path d="M10.4784 5.2392C10.4784 8.12279 8.12279 10.4784 5.2392 10.4784C2.35561 10.4784 0 8.12279 0 5.2392C0 2.35561 2.35561 0 5.2392 0H10.4784V5.2392Z" fill="#E01E5A" />
            <path d="M13.1157 5.2392C13.1157 2.35561 15.4713 0 18.3549 0C21.2385 0 23.5941 2.35561 23.5941 5.2392V18.3575C23.5941 21.2411 21.2385 23.5967 18.3549 23.5967C15.4713 23.5967 13.1157 21.2411 13.1157 18.3575V5.2392Z" fill="#E01E5A" />
          </g>
          <g transform="translate(26.28 26.28)">
            <path d="M5.23927 13.1157C8.12286 13.1157 10.4785 15.4713 10.4785 18.3549C10.4785 21.2385 8.12286 23.5941 5.23927 23.5941C2.35568 23.5941 7.4362e-05 21.2385 7.4362e-05 18.3549V13.1157H5.23927Z" fill="#ECB22E" />
            <path d="M5.23927 10.4784C2.35568 10.4784 7.4362e-05 8.12279 7.4362e-05 5.2392C7.4362e-05 2.35561 2.35568 0 5.23927 0H18.3576C21.2412 0 23.5968 2.35561 23.5968 5.2392C23.5968 8.12279 21.2412 10.4784 18.3576 10.4784H5.23927Z" fill="#ECB22E" />
          </g>
        </svg>
      );
    case "telemetry":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ color: "var(--ui-dctc-strong)" }}>
          <path d="M13.91 2.505c-.873-1.448-2.972-1.448-3.844 0L6.904 7.92a15.478 15.478 0 0 1 8.53 12.811h-2.221A13.301 13.301 0 0 0 5.784 9.814l-2.926 5.06a7.65 7.65 0 0 1 4.435 5.848H2.194a.365.365 0 0 1-.298-.534l1.413-2.402a5.16 5.16 0 0 0-1.614-.913L.296 19.275a2.182 2.182 0 0 0 .812 2.999 2.24 2.24 0 0 0 1.086.288h6.983a9.322 9.322 0 0 0-3.845-8.318l1.11-1.922a11.47 11.47 0 0 1 4.95 10.24h5.915a17.242 17.242 0 0 0-7.885-15.28l2.244-3.845a.37.37 0 0 1 .504-.13c.255.14 9.75 16.708 9.928 16.9a.365.365 0 0 1-.327.543h-2.287c.029.612.029 1.223 0 1.831h2.297a2.206 2.206 0 0 0 1.922-3.31z" />
        </svg>
      );
  }
}

const css = /* css */ `
.ui-dctc{--ui-dctc-card: #fffdfb;--ui-dctc-strong: #0b0908;--ui-dctc-ink: rgba(11, 9, 8, 0.88);--ui-dctc-text: rgba(11, 9, 8, 0.61);--ui-dctc-muted: rgba(11, 9, 8, 0.45);--ui-dctc-faint: rgba(11, 9, 8, 0.27);--ui-dctc-line: rgba(11, 9, 8, 0.06);--ui-dctc-line-strong: rgba(11, 9, 8, 0.12);--ui-dctc-fill: rgba(11, 9, 8, 0.06);--ui-dctc-leaf-bg: rgba(11, 9, 8, 0.015);--ui-dctc-accent: rgba(217, 84, 31, 0.765);--ui-dctc-focus: rgba(217, 84, 31, 0.35);--ui-dctc-link: rgba(11, 9, 8, 0.15);--ui-dctc-link-pick: rgba(217, 84, 31, 0.42);--ui-dctc-link-hot: rgba(11, 9, 8, 0.38);--ui-dctc-link-pick-hot: rgba(217, 84, 31, 0.6);--ui-dctc-high-bg: #b3261e18;--ui-dctc-high-fg: #b3261eda;--ui-dctc-mid-bg: #d9953024;--ui-dctc-mid-fg: #d9541f;--ui-dctc-ok-bg: #1a7a4a19;--ui-dctc-ok-edge: rgba(26, 122, 74, 0.3);--ui-dctc-ok-fg: #1a7a4ae0;--ui-dctc-flag-bg: rgba(217, 149, 48, 0.16);--ui-dctc-flag-edge: rgba(217, 149, 48, 0.55);--ui-dctc-flag-hot: rgba(217, 149, 48, 0.28);--ui-dctc-flag-ink: #9a6410;--ui-dctc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-dctc-raised: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 1px 1px -1px rgba(11, 9, 8, 0.12), 0 2px 4px 0 rgba(11, 9, 8, 0.05);--ui-dctc-lift: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 4px 12px -4px rgba(11, 9, 8, 0.14), 0 1px 2px 0 rgba(11, 9, 8, 0.06);--ui-dctc-lift-hot: 0 0 0 0.5px rgba(11, 9, 8, 0.07), 0 8px 20px -6px rgba(11, 9, 8, 0.18), 0 1px 3px 0 rgba(11, 9, 8, 0.07);--ui-dctc-pick-lift: 0 0 0 0.5px rgba(217, 84, 31, 0.24), 0 3px 8px -4px rgba(217, 84, 31, 0.14), 0 1px 2px 0 rgba(163, 63, 22, 0.05);--ui-dctc-pick-lift-hot: 0 0 0 0.5px rgba(217, 84, 31, 0.42), 0 8px 22px -6px rgba(217, 84, 31, 0.34), 0 2px 4px -1px rgba(217, 84, 31, 0.16);--ui-dctc-pop: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 12px 28px -10px rgba(11, 9, 8, 0.18), 0 1px 2px rgba(11, 9, 8, 0.05);--ui-dctc-height: 400px;--ui-dctc-ease: cubic-bezier(0.32, 0.72, 0.24, 1);position: relative;box-sizing: border-box;width: 100%;outline: none;container: ui-dctc / inline-size;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;font-weight: 400;line-height: 20px;color: var(--ui-dctc-text);text-align: left;-webkit-font-smoothing: antialiased}
.ui-dctc *, .ui-dctc *::before, .ui-dctc *::after{box-sizing: border-box}
:where(.ui-dctc) :is(button, textarea){margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;letter-spacing: inherit;text-align: inherit;-webkit-tap-highlight-color: transparent}
:where(.ui-dctc) button{cursor: pointer}
:where(.ui-dctc) button:disabled{cursor: default}
.ui-dctc :is(button, mark):focus-visible{outline: 2px solid var(--ui-dctc-focus);outline-offset: 1px}
:where(.ui-dctc) :is(p, h3){margin: 0}
.ui-dctc svg{display: block;flex: none}
.ui-dctc__kbd{display: inline-grid;place-items: center;min-width: 16px;height: 16px;padding: 0 4px;border-radius: 4px;background: var(--ui-dctc-fill);font-family: inherit;font-size: 10.5px;font-weight: 500;line-height: 1;color: var(--ui-dctc-muted);letter-spacing: 0}
.ui-dctc__sr{position: absolute;width: 1px;height: 1px;overflow: hidden;clip-path: inset(50%);white-space: nowrap}
.ui-dctc__head{display: flex;align-items: center;gap: 8px;min-width: 0;margin-bottom: 16px}
.ui-dctc__mark{display: grid;flex: none;place-items: center;width: 16px;color: var(--ui-dctc-accent)}
.ui-dctc__heading{flex: none;font-weight: 500;color: var(--ui-dctc-strong)}
.ui-dctc__count{flex: 1;min-width: 0;overflow: hidden;font-size: 12px;color: var(--ui-dctc-muted);white-space: nowrap;text-overflow: ellipsis;font-variant-numeric: tabular-nums}
.ui-dctc__pager{display: inline-flex;flex: none;align-items: center;gap: 10px;font-size: 12px;line-height: 16px;color: var(--ui-dctc-muted);white-space: nowrap;font-variant-numeric: tabular-nums}
.ui-dctc__dots{display: flex;gap: 4px}
.ui-dctc__dots > span{width: 5px;height: 5px;border-radius: 1.5px;background: var(--ui-dctc-line-strong);transition: background-color 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 240ms var(--ui-dctc-ease)}
.ui-dctc__dots > span[data-on]{background: var(--ui-dctc-ink);transform: scale(1.15)}
.ui-dctc__body{position: relative;display: flex;align-items: center;justify-content: center;min-height: var(--ui-dctc-height);padding: 28px 0 44px}
.ui-dctc__tree{position: relative;isolation: isolate;display: grid;grid-template-columns: minmax(0, 204px) minmax(0, 1fr);align-items: center;column-gap: 28px;width: 100%;max-width: 900px;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dctc__tree[data-leaving]{opacity: 0}
.ui-dctc__links{position: absolute;top: 0;left: 0;z-index: -1;overflow: visible;pointer-events: none}
.ui-dctc__link{fill: none;stroke: var(--ui-dctc-link);stroke-width: 0.5px;stroke-linecap: round;stroke-dasharray: 1 1;animation: ui-dctc-draw var(--nm-dur-4, 380ms) var(--ui-dctc-ease) calc(180ms + var(--i, 0) * 80ms) both;transition: stroke var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), stroke-width var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dctc__link[data-kind="leaf"]{animation-delay: calc(360ms + var(--i, 0) * 80ms)}
.ui-dctc__link[data-kind="out"]{animation: ui-dctc-draw 380ms var(--ui-dctc-ease) 120ms both}
.ui-dctc__link[data-kind="sub"]{animation-delay: calc(520ms + var(--i, 0) * 80ms + var(--j, 0) * 60ms)}
.ui-dctc__link[data-kind="sub"]:not([data-live]){opacity: 0.6}
.ui-dctc__link[data-soft]{opacity: 0.25}
.ui-dctc__tree[data-final] .ui-dctc__link[data-soft]{opacity: 0}
.ui-dctc__link[data-pick]{stroke: var(--ui-dctc-link-pick)}
.ui-dctc__link[data-hot]{stroke: var(--ui-dctc-link-hot);stroke-width: 1.25px}
.ui-dctc__link[data-pick][data-hot]{stroke: var(--ui-dctc-link-pick-hot)}
.ui-dctc__link[data-dim]{opacity: 0.25}
.ui-dctc__tree[data-picked] .ui-dctc__link[data-dim]{opacity: 0}
.ui-dctc__root{position: relative;display: grid;gap: 10px;padding: 14px 16px 15px;border-radius: 8px;background: var(--ui-dctc-card);box-shadow: var(--ui-dctc-shadow);animation: ui-dctc-node var(--nm-dur-4, 380ms) var(--ui-dctc-ease) 40ms backwards}
.ui-dctc__who{display: flex;align-items: center;gap: 10px;min-width: 0}
.ui-dctc__avatar{display: grid;flex: none;place-items: center;width: 28px;height: 28px;border-radius: 6px;background: var(--ui-dctc-card);box-shadow: var(--ui-dctc-shadow);font-size: 12px;font-weight: 500;color: var(--ui-dctc-text)}
.ui-dctc__avatar > svg{width: 14px;height: 14px}
.ui-dctc__meta{display: grid;flex: 1;gap: 1px;min-width: 0}
.ui-dctc__agent{overflow: hidden;font-size: 13px;font-weight: 500;line-height: 18px;color: var(--ui-dctc-ink);white-space: nowrap;text-overflow: ellipsis}
.ui-dctc__model{overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-dctc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-dctc__risk{position: absolute;bottom: calc(100% + 6px);left: 2px;display: inline-flex;flex: none;align-items: center;height: 20px;padding: 0 7px;border-radius: 5px;background: var(--k-bg);font-size: 11.5px;font-weight: 500;line-height: 16px;color: var(--k-fg);white-space: nowrap}
.ui-dctc [data-risk="high"]{--k-bg: var(--ui-dctc-high-bg);--k-fg: var(--ui-dctc-high-fg)}
.ui-dctc [data-risk="medium"]{--k-bg: var(--ui-dctc-mid-bg);--k-fg: var(--ui-dctc-mid-fg)}
.ui-dctc__q{font-size: 13.5px;font-weight: 500;line-height: 20px;color: var(--ui-dctc-strong);text-wrap: pretty}
.ui-dctc__context{margin-top: -4px;font-size: 12px;line-height: 17px;color: var(--ui-dctc-muted);text-wrap: pretty}
.ui-dctc__branches{display: grid;gap: 14px}
.ui-dctc__row{display: grid;grid-template-columns: minmax(0, 184px) minmax(0, 1fr);align-items: center;column-gap: 24px;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));animation: ui-dctc-node var(--nm-dur-4, 380ms) var(--ui-dctc-ease) calc(140ms + var(--i, 0) * 80ms) backwards}
.ui-dctc__row[data-dim]{opacity: 0.38}
.ui-dctc__tree[data-picked] .ui-dctc__row[data-dim]{opacity: 0;pointer-events: none}
.ui-dctc__opt{display: grid;grid-template-columns: auto minmax(0, 1fr);align-items: center;gap: 2px 8px;min-width: 0;padding: 9px 12px;border-radius: 8px;background: var(--ui-dctc-card);box-shadow: var(--ui-dctc-shadow);text-align: left;transition: box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
button.ui-dctc__opt:hover:not(:disabled), .ui-dctc__opt[data-hot]{box-shadow: var(--ui-dctc-lift-hot)}
.ui-dctc__opt[data-pick]{box-shadow: var(--ui-dctc-pick-lift)}
button.ui-dctc__opt[data-pick]:hover:not(:disabled), .ui-dctc__opt[data-pick][data-hot]{box-shadow: var(--ui-dctc-pick-lift-hot)}
.ui-dctc__opt[data-pressed]{transform: scale(0.98)}
.ui-dctc__label{display: inline-flex;align-items: center;gap: 7px;min-width: 0;font-size: 13px;font-weight: 500;line-height: 18px;color: var(--ui-dctc-ink)}
.ui-dctc__icon{display: grid;flex: none;place-items: center;width: 18px;height: 18px;border-radius: 5px;background: var(--ui-dctc-card);box-shadow: var(--ui-dctc-shadow)}
.ui-dctc__icon > svg{width: 11px;height: 11px}
.ui-dctc__lines{display: grid;gap: 1px;min-width: 0}
.ui-dctc__apps{display: flex;flex: none}
.ui-dctc__app{display: grid;place-items: center;width: 20px;height: 20px;border-radius: 6px;background: var(--ui-dctc-card);box-shadow: var(--ui-dctc-shadow), 0 0 0 1.5px var(--ui-dctc-card)}
.ui-dctc__app + .ui-dctc__app{margin-left: -3px}
.ui-dctc__app > svg{width: 12px;height: 12px}
.ui-dctc__pick{grid-column: 2;font-size: 11.5px;line-height: 14px;color: var(--ui-dctc-accent)}
.ui-dctc__leaf{display: flex;align-items: center;gap: 12px;justify-self: start;min-width: 0;padding: 8px 12px;border-radius: 8px;background: var(--ui-dctc-leaf-bg);box-shadow: inset 0 0 0 0.5px var(--ui-dctc-line);animation: ui-dctc-node var(--nm-dur-4, 380ms) var(--ui-dctc-ease) calc(300ms + var(--i, 0) * 80ms) backwards}
.ui-dctc__effect{font-size: 12.5px;line-height: 18px;color: var(--ui-dctc-text)}
.ui-dctc__sub{display: grid;gap: 8px;justify-items: start;min-width: 0;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));animation: ui-dctc-node var(--nm-dur-4, 380ms) var(--ui-dctc-ease) calc(300ms + var(--i, 0) * 80ms) backwards}
.ui-dctc__sub:not([data-live]){opacity: 0.62}
.ui-dctc__subq{max-width: 100%;padding: 6px 10px;border-radius: 8px;background: var(--ui-dctc-card);box-shadow: var(--ui-dctc-shadow);font-size: 12.5px;font-weight: 500;line-height: 17px;color: var(--ui-dctc-ink);text-wrap: pretty}
.ui-dctc__subopts{display: grid;gap: 6px;justify-items: start;padding-left: 22px}
.ui-dctc__sopt{display: grid;gap: 2px;min-width: 0;max-width: 100%;padding: 6px 10px 7px;border-radius: 8px;background: var(--ui-dctc-card);box-shadow: var(--ui-dctc-shadow);text-align: left;transition: box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));animation: ui-dctc-node var(--nm-dur-4, 380ms) var(--ui-dctc-ease) calc(560ms + var(--i, 0) * 80ms + var(--j, 0) * 60ms) backwards}
.ui-dctc__sopt[data-pick]{box-shadow: var(--ui-dctc-pick-lift)}
button.ui-dctc__sopt:hover:not(:disabled), .ui-dctc__sopt[data-hot]{box-shadow: var(--ui-dctc-lift-hot)}
button.ui-dctc__sopt[data-pick]:hover:not(:disabled), .ui-dctc__sopt[data-pick][data-hot]{box-shadow: var(--ui-dctc-pick-lift-hot)}
.ui-dctc__sopt[data-pressed]{transform: scale(0.98)}
.ui-dctc__sopt[data-soft]{opacity: 0.38}
.ui-dctc__tree[data-final] .ui-dctc__sopt[data-soft]{opacity: 0;pointer-events: none}
.ui-dctc__sopt-top{display: flex;flex-wrap: wrap;align-items: center;gap: 2px 8px}
.ui-dctc__sopt .ui-dctc__label{font-size: 12.5px}
.ui-dctc__sopt .ui-dctc__pick{grid-column: auto}
.ui-dctc__sopt-effects{display: flex;align-items: center;gap: 10px}
.ui-dctc__sopt .ui-dctc__effect{font-size: 12px;line-height: 17px}
.ui-dctc__more{display: none;margin-left: 6px;font-weight: 400;color: var(--ui-dctc-muted);white-space: nowrap}
.ui-dctc__sub[data-asking] .ui-dctc__subq{box-shadow: var(--ui-dctc-raised)}
.ui-dctc__flag{padding: 1px 2px;margin: 0 -1px;border-radius: 3px;background: var(--ui-dctc-flag-bg);box-shadow: inset 0 -1px 0 var(--ui-dctc-flag-edge);color: var(--ui-dctc-flag-ink);cursor: help;-webkit-box-decoration-break: clone;box-decoration-break: clone;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dctc__flag:is(:hover, [data-on]){background: var(--ui-dctc-flag-hot);box-shadow: inset 0 0 0 0.5px var(--ui-dctc-flag-edge)}
.ui-dctc__opt[data-other]{padding: 0;background: transparent;box-shadow: inset 0 0 0 0.5px var(--ui-dctc-line-strong)}
.ui-dctc__opt[data-other][data-open]{background: var(--ui-dctc-card)}
.ui-dctc__opt[data-other][data-open]:focus-within{box-shadow: inset 0 0 0 0.5px var(--ui-dctc-link-hot)}
.ui-dctc__other{display: flex;align-items: center;gap: 8px;width: 100%;padding: 9px 12px;border-radius: inherit;text-align: left}
.ui-dctc__other .ui-dctc__label{font-weight: 400;color: var(--ui-dctc-muted)}
.ui-dctc__grow{position: relative;height: 32px;overflow: hidden;transition: height var(--nm-dur-3, 240ms) var(--ui-dctc-ease)}
.ui-dctc__mirror{position: absolute;top: 0;right: 0;left: 0;padding: 6px 12px;font-size: 13px;line-height: 20px;white-space: pre-wrap;overflow-wrap: anywhere;visibility: hidden;pointer-events: none}
.ui-dctc__input{display: block;width: 100%;height: 100%;padding: 6px 12px;font-size: 13px;line-height: 20px;color: var(--ui-dctc-ink);resize: none;overflow-y: hidden;outline: none;scrollbar-width: thin}
.ui-dctc .ui-dctc__input:focus-visible{outline: none}
.ui-dctc__input::placeholder{color: var(--ui-dctc-muted)}
.ui-dctc__said{padding: 6px 12px;font-size: 13px;line-height: 20px;color: var(--ui-dctc-ink);white-space: pre-wrap}
.ui-dctc__out{position: absolute;z-index: 1;display: grid;gap: 6px;max-width: 280px;padding: 9px 12px;border-radius: 8px;background: var(--ui-dctc-card);box-shadow: var(--ui-dctc-raised), 0 0 0 0.5px var(--ui-dctc-ok-edge);animation: ui-dctc-node var(--nm-dur-4, 380ms) var(--ui-dctc-ease) 320ms backwards}
.ui-dctc__out[data-kind="replied"]{box-shadow: var(--ui-dctc-lift)}
.ui-dctc__out-head{display: inline-flex;align-items: center;gap: 6px;font-size: 13px;font-weight: 500;color: var(--ui-dctc-ink);white-space: nowrap}
.ui-dctc__out-head > svg{width: 15px;height: 15px;color: var(--ui-dctc-ok-fg)}
.ui-dctc__running{font-weight: 400;color: var(--ui-dctc-muted)}
.ui-dctc__answer{font-size: 12.5px;line-height: 18px;color: var(--ui-dctc-text);animation: ui-dctc-fade-up var(--nm-dur-3, 240ms) var(--ui-dctc-ease) backwards}
.ui-dctc__typing{display: inline-flex;gap: 4px;justify-self: start;padding: 6px 0 4px}
.ui-dctc__typing > span{width: 5px;height: 5px;border-radius: 50%;background: var(--ui-dctc-muted);animation: ui-dctc-dot 1100ms ease-in-out infinite}
.ui-dctc__typing > span:nth-child(2){animation-delay: 150ms}
.ui-dctc__typing > span:nth-child(3){animation-delay: 300ms}
.ui-dctc__hint{position: absolute;bottom: 8px;left: 0;display: inline-flex;align-items: center;gap: 5px;font-size: 12px;color: var(--ui-dctc-muted);pointer-events: none;animation: ui-dctc-fade var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 600ms backwards}
.ui-dctc__hint > span{margin: 0 3px;color: var(--ui-dctc-faint)}
.ui-dctc__tip{position: absolute;top: 0;left: 0;z-index: 6;display: grid;gap: 2px;width: min(300px, calc(100% - 20px));padding: 10px 12px 11px;border-radius: 10px;background: var(--ui-dctc-card);box-shadow: var(--ui-dctc-pop);pointer-events: none;transform-origin: var(--x, 50%) top;animation: ui-dctc-tip var(--nm-dur-2, 160ms) var(--ui-dctc-ease) both}
.ui-dctc__tip[data-side="above"]{transform-origin: var(--x, 50%) bottom}
.ui-dctc__tip-head{display: inline-flex;align-items: center;gap: 6px;font-size: 10px;font-weight: 500;line-height: 16px;letter-spacing: 0.5px;text-transform: uppercase;color: var(--ui-dctc-mid-fg)}
.ui-dctc__tip-head > svg{width: 12px;height: 12px}
.ui-dctc__tip p{font-size: 12.5px;line-height: 18px;color: var(--ui-dctc-ink);text-wrap: pretty}
.ui-dctc__tip-source{justify-self: start;margin-top: 2px;padding: 1px 7px;border-radius: 4px;background: var(--ui-dctc-fill);font-size: 11.5px;line-height: 16px;color: var(--ui-dctc-text)}
.ui-dctc__empty{display: grid;justify-items: center;gap: 4px;text-align: center;animation: ui-dctc-fade-up var(--nm-dur-4, 380ms) var(--ui-dctc-ease) both}
.ui-dctc__empty-mark{display: grid;place-items: center;width: 44px;height: 44px;margin-bottom: 8px;border-radius: 10px;background: var(--ui-dctc-card);color: var(--ui-dctc-ok-fg);box-shadow: var(--ui-dctc-shadow), 0 0 0 4px var(--ui-dctc-ok-bg)}
.ui-dctc__empty b{font-size: 15px;font-weight: 500;line-height: 22px;color: var(--ui-dctc-strong)}
.ui-dctc__empty > span:last-child{font-size: 13px;color: var(--ui-dctc-muted)}
@container ui-dctc (max-width: 639px){.ui-dctc__body{min-height: 0;padding: 24px 0 40px}
.ui-dctc__count{display: none}
.ui-dctc__tree{grid-template-columns: minmax(0, 1fr);row-gap: 18px}
.ui-dctc__branches{padding-left: 34px}
.ui-dctc__row{grid-template-columns: minmax(0, 1fr);row-gap: 8px}
.ui-dctc__leaf, .ui-dctc__sub{margin-left: 26px}
.ui-dctc__subopts{padding-left: 22px}
.ui-dctc__sub:not([data-live]) .ui-dctc__subopts{display: none}
.ui-dctc__sub:not([data-live]) .ui-dctc__more{display: inline}
.ui-dctc__sub[data-live] .ui-dctc__sopt{animation-delay: calc(120ms + var(--j, 0) * 60ms)}
.ui-dctc__link[data-kind="sub"]{animation-delay: calc(80ms + var(--j, 0) * 60ms)}
.ui-dctc__hint{left: 0;bottom: 8px}
.ui-dctc__hint kbd:last-of-type, .ui-dctc__hint > span{display: none}
}
@container ui-dctc (max-width: 380px){.ui-dctc__of{display: none}
.ui-dctc__branches{padding-left: 26px}
.ui-dctc__leaf, .ui-dctc__sub{margin-left: 18px}
}
@keyframes ui-dctc-draw{from{stroke-dashoffset: 1}
to{stroke-dashoffset: 0}
}
@keyframes ui-dctc-node{from{opacity: 0;transform: translateX(-8px)}
}
@keyframes ui-dctc-fade{from{opacity: 0}
}
@keyframes ui-dctc-fade-up{from{opacity: 0;transform: translateY(6px)}
}
@keyframes ui-dctc-tip{from{opacity: 0;transform: translateY(4px) scale(0.96)}
}
@keyframes ui-dctc-dot{0%, 60%, 100%{opacity: 0.35}
30%{opacity: 1}
}
@media (pointer: coarse){.ui-dctc .ui-dctc__kbd, .ui-dctc__hint{display: none}
}
@media (prefers-reduced-motion: reduce){.ui-dctc *, .ui-dctc *::before, .ui-dctc *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-dctc{--ui-dctc-card: #211b16;--ui-dctc-strong: #fffdfb;--ui-dctc-ink: rgba(255, 253, 251, 0.9);--ui-dctc-text: rgba(255, 253, 251, 0.62);--ui-dctc-muted: rgba(255, 253, 251, 0.45);--ui-dctc-faint: rgba(255, 253, 251, 0.28);--ui-dctc-line: rgba(255, 253, 251, 0.08);--ui-dctc-line-strong: rgba(255, 253, 251, 0.16);--ui-dctc-fill: rgba(255, 253, 251, 0.08);--ui-dctc-leaf-bg: rgba(255, 253, 251, 0.02);--ui-dctc-accent: #ff8a5c;--ui-dctc-focus: rgba(255, 138, 92, 0.45);--ui-dctc-link: rgba(255, 253, 251, 0.16);--ui-dctc-link-pick: rgba(255, 138, 92, 0.5);--ui-dctc-link-hot: rgba(255, 253, 251, 0.36);--ui-dctc-link-pick-hot: rgba(255, 138, 92, 0.7);--ui-dctc-high-bg: #e2544a2b;--ui-dctc-high-fg: #e2544a;--ui-dctc-mid-bg: #ff6b3525;--ui-dctc-mid-fg: #ff8a5c;--ui-dctc-ok-bg: #2f8d5c1f;--ui-dctc-ok-edge: rgba(47, 141, 92, 0.36);--ui-dctc-ok-fg: #2f8d5c;--ui-dctc-flag-bg: rgba(232, 176, 92, 0.16);--ui-dctc-flag-edge: rgba(232, 176, 92, 0.55);--ui-dctc-flag-hot: rgba(232, 176, 92, 0.28);--ui-dctc-flag-ink: #f2d19a;--ui-dctc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-dctc-raised: 0 0 0 0.5px rgba(255, 253, 251, 0.16), 0 1px 3px 0 rgba(11, 9, 8, 0.5);--ui-dctc-lift: 0 0 0 0.5px rgba(255, 253, 251, 0.12), 0 6px 16px -4px rgba(11, 9, 8, 0.6), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-dctc-lift-hot: 0 0 0 0.5px rgba(255, 253, 251, 0.16), 0 10px 24px -6px rgba(11, 9, 8, 0.7), 0 1px 3px 0 rgba(11, 9, 8, 0.5);--ui-dctc-pick-lift: 0 0 0 0.5px rgba(255, 138, 92, 0.34), 0 4px 12px -4px rgba(255, 107, 53, 0.24), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-dctc-pick-lift-hot: 0 0 0 0.5px rgba(255, 138, 92, 0.55), 0 10px 26px -6px rgba(255, 107, 53, 0.5), 0 2px 5px -1px rgba(255, 107, 53, 0.25);--ui-dctc-pop: 0 0 0 0.5px rgba(255, 253, 251, 0.12), 0 12px 28px -10px rgba(11, 9, 8, 0.6)}

`;
