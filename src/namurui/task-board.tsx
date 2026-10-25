"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

/*
 * Task Board – a kanban for one sprint, in a single self-contained file.
 * Cards move between columns with pointer events: the card keeps the pointer with capture, nothing
 * happens until the pointer has travelled past 6px, and while it moves a blue line inside the target
 * column marks the index the card will land on. The column the pointer is nearest to tints itself.
 * Quick add opens an input under a column, the detail panel edits status, priority, estimate,
 * assignee and labels in place, and search, label filters and the compact toggle narrow the board.
 * The styles are injected below, so no extra files are needed.
 */

/** The glyph a column and its cards carry – each one is a fixed mark from the reference */
export type ColumnMark = "todo" | "review" | "next" | "progress" | "done";

/** One column of the board */
export type BoardColumn = {
  /** Stable id – tasks point at it with their `column` */
  id: string;
  /** The heading, e.g. "In review" */
  label: string;
  /** The status glyph in the header and on every card (default "todo") */
  mark?: ColumnMark;
  /** Stroke colour of the glyph; without it the mark keeps its own colour */
  color?: string;
};

/** 0 = none, 1 = low, 2 = medium, 3 = high, 4 = urgent */
export type TaskPriority = 0 | 1 | 2 | 3 | 4;

export type TaskEstimate = "S" | "M" | "L" | "XL";

/** A due chip: the words plus the tone the sheet colours it with */
export type TaskDue = {
  /** Human text, e.g. "2d" or "1d late" */
  label: string;
  /** "soon" turns the text amber, "late" gives it a pink chip */
  tone?: "soon" | "late";
};

export type BoardTask = {
  /** Stable identity – React key, `data-card` and the handle every callback uses */
  id: string;
  /** The short key shown top-left, e.g. "NW-214" */
  key: string;
  title: string;
  /** Id of the column this card sits in */
  column: string;
  priority: TaskPriority;
  estimate?: TaskEstimate;
  /** Ids of the labels on the card */
  labels?: string[];
  /** Id of the assignee */
  assignee?: string;
  due?: TaskDue;
  /** Drawn as a ring chip, e.g. 2 of 4 */
  subtasks?: { done: number; total: number };
  /** Pull-request number, shown as "#412" */
  pullRequest?: number;
  /** Human date under the chips, e.g. "Oct 2"; the card reads "Created Oct 2" */
  created?: string;
};

export type BoardLabel = {
  id: string;
  /** The word on the chip */
  name: string;
  /** Any CSS colour – the dot and the filter swatch use it */
  color: string;
};

export type BoardPerson = {
  id: string;
  name: string;
  /** An image URL; without one the initials show */
  avatar?: string;
};

export type TaskBoardProps = {
  /** Every card, in board order – the order inside a column follows this array */
  tasks: BoardTask[];
  /** Columns left to right */
  columns: BoardColumn[];
  /** Labels used on cards, in the filter menu and in the panel (default none) */
  labels?: BoardLabel[];
  /** Assignees (default none) */
  people?: BoardPerson[];
  /** Breadcrumb above the board (default the reference trail) */
  crumbs?: string[];
  /** Called after a drop with the new column and the index inside it */
  onMove?: (id: string, column: string, index: number) => void;
  /** Called after any edit in the detail panel */
  onUpdate?: (id: string, patch: Partial<BoardTask>) => void;
  /** Called when quick add makes a card */
  onCreate?: (task: BoardTask) => void;
  /** Called when the detail panel deletes a card */
  onDelete?: (id: string) => void;
  /** Extra class on the root, merged after "ui-tb" */
  className?: string;
};

type DragState = {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  /** False until the pointer has moved past the threshold */
  active: boolean;
};

type DropTarget = { column: string; index: number };

/** Movement before a press turns into a drag */
const DRAG_THRESHOLD = 6;
/** The ring chip is a circle of r=5, so the dash pattern is this circumference */
const RING = 2 * Math.PI * 5;
const PRIORITY_TITLE: Record<TaskPriority, string> = {
  0: "No priority",
  1: "Low",
  2: "Medium",
  3: "High",
  4: "Urgent",
};
/** The reference glyphs: a muted square, an eye, a tray, a clock, a filled check */
const MARK_COLOR: Record<ColumnMark, string> = {
  todo: "#8f8f8f",
  review: "#8b5cf6",
  next: "#7aa2ff",
  progress: "#f59e0b",
  done: "#2f6bff",
};
const ESTIMATES: TaskEstimate[] = ["S", "M", "L", "XL"];

export function TaskBoard({
  tasks,
  columns,
  labels = [],
  people = [],
  crumbs = ["Northwind", "Launch", "Sprint 12"],
  onMove,
  onUpdate,
  onCreate,
  onDelete,
  className,
}: TaskBoardProps) {
  const [items, setItems] = useState<BoardTask[]>(tasks);
  const [query, setQuery] = useState("");
  const [activeLabels, setActiveLabels] = useState<string[]>([]);
  const [compact, setCompact] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [addingIn, setAddingIn] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [drag, setDrag] = useState<DragState | null>(null);
  const [drop, setDrop] = useState<DropTarget | null>(null);

  const dragRef = useRef<DragState | null>(null);
  const dropRef = useRef<DropTarget | null>(null);
  const ignoreClick = useRef(false);
  const columnRefs = useRef(new Map<string, HTMLDivElement>());
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const menuRef = useRef<HTMLDivElement>(null);
  const sequence = useRef(0);

  useEffect(() => {
    setItems(tasks);
  }, [tasks]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  const needle = query.trim().toLowerCase();
  const filtering = needle.length > 0 || activeLabels.length > 0;
  const visible = items.filter((task) => {
    if (activeLabels.length > 0 && !(task.labels ?? []).some((id) => activeLabels.includes(id))) {
      return false;
    }
    if (!needle) return true;
    const haystack = [
      task.key,
      task.title,
      ...(task.labels ?? []).map((id) => labels.find((label) => label.id === id)?.name ?? ""),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });

  const panelTask = openId ? items.find((task) => task.id === openId) ?? null : null;

  const applyDrag = (next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  const applyDrop = (next: DropTarget | null) => {
    dropRef.current = next;
    setDrop(next);
  };

  const patchTask = (id: string, patch: Partial<BoardTask>) => {
    setItems((current) => current.map((task) => (task.id === id ? { ...task, ...patch } : task)));
    onUpdate?.(id, patch);
  };

  const moveTask = (id: string, column: string, index: number) => {
    const from = items.findIndex((task) => task.id === id);
    if (from < 0) return;
    const next = items.slice();
    const [moved] = next.splice(from, 1);
    const updated = moved.column === column ? moved : { ...moved, column };
    const rest = next.filter((task) => task.column === column);
    const anchor = rest[index];
    const at = anchor
      ? next.findIndex((task) => task.id === anchor.id)
      : rest.length > 0
        ? next.findIndex((task) => task.id === rest[rest.length - 1].id) + 1
        : next.length;
    next.splice(at, 0, updated);
    if (
      items.length === next.length &&
      items.every((task, index) => task.id === next[index].id)
    ) {
      return;
    }
    setItems(next);
    onMove?.(id, column, index);
  };

  /** The nearest column plus the index the card would occupy among that column's other cards */
  const hitTest = (clientX: number, clientY: number, draggedId: string): DropTarget | null => {
    let nearest: { id: string; distance: number } | null = null;
    for (const column of columns) {
      const element = columnRefs.current.get(column.id);
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      const distance = clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
      if (!nearest || distance < nearest.distance) nearest = { id: column.id, distance };
    }
    if (!nearest) return null;
    const columnId = nearest.id;
    const rest = visible.filter((task) => task.column === columnId && task.id !== draggedId);
    let index = rest.length;
    for (let i = 0; i < rest.length; i += 1) {
      const element = cardRefs.current.get(rest[i].id);
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        index = i;
        break;
      }
    }
    return { column: nearest.id, index };
  };

  const startDrag = (task: BoardTask, event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    applyDrag({
      id: task.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    });
    applyDrop(null);
  };

  const dragCard = (event: ReactPointerEvent<HTMLElement>) => {
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!current.active) {
      const travelled = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
      if (travelled <= DRAG_THRESHOLD) return;
      applyDrag({ ...current, active: true });
    }
    applyDrop(hitTest(event.clientX, event.clientY, current.id));
  };

  const finishDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const target = dropRef.current;
    const moved = current.active;
    applyDrag(null);
    applyDrop(null);
    if (!moved) return;
    ignoreClick.current = true;
    window.setTimeout(() => {
      ignoreClick.current = false;
    }, 240);
    if (target) moveTask(current.id, target.column, target.index);
  };

  const cancelDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    applyDrag(null);
    applyDrop(null);
  };

  const openTask = (id: string) => {
    if (ignoreClick.current) return;
    setOpenId(id);
  };

  const closePanel = () => {
    const id = openId;
    setOpenId(null);
    if (!id) return;
    window.setTimeout(() => cardRefs.current.get(id)?.focus(), 0);
  };

  const submitDraft = (column: string) => {
    const title = draft.trim();
    if (!title) return;
    sequence.current += 1;
    const task: BoardTask = {
      id: `task-${Date.now()}-${sequence.current}`,
      key: `NW-${231 + sequence.current}`,
      title,
      column,
      priority: 0,
      created: "just now",
    };
    setItems((current) => [...current, task]);
    onCreate?.(task);
    setDraft("");
    setAddingIn(null);
  };

  const deleteTask = (id: string) => {
    setItems((current) => current.filter((task) => task.id !== id));
    onDelete?.(id);
    setOpenId(null);
  };

  const toggleLabelFilter = (id: string) => {
    setActiveLabels((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const registerColumn = (id: string, element: HTMLDivElement | null) => {
    if (element) columnRefs.current.set(id, element);
    else columnRefs.current.delete(id);
  };

  const registerCard = (id: string, element: HTMLElement | null) => {
    if (element) cardRefs.current.set(id, element);
    else cardRefs.current.delete(id);
  };

  const total = items.length;
  const shown = visible.length;
  const dragId = drag && drag.active ? drag.id : null;

  return (
    <section
      className={["ui-tb", className].filter(Boolean).join(" ")}
      aria-label={crumbs.length > 0 ? crumbs.join(" / ") : "Task board"}
      data-compact={compact ? "true" : undefined}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        if (menuOpen) {
          setMenuOpen(false);
          return;
        }
        if (openId) {
          event.preventDefault();
          closePanel();
        }
      }}
    >
      <style href="ui-task-board" precedence="default">
        {css}
      </style>

      <header className="ui-tb__top">
        <nav className="ui-tb__crumbs" aria-label="Breadcrumb">
          <span className="ui-tb__logo" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          {crumbs.map((crumb, index) => (
            <span
              key={`${crumb}-${index}`}
              className="ui-tb__crumb"
              aria-current={index === crumbs.length - 1 ? "page" : undefined}
            >
              {index > 0 && <ChevronIcon />}
              {crumb}
            </span>
          ))}
          <button
            type="button"
            className="ui-tb__icon"
            aria-pressed={favorite}
            aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
            onClick={() => setFavorite((value) => !value)}
          >
            <StarIcon />
            {favorite && <span className="ui-tb__dot" />}
          </button>
        </nav>
      </header>

      <div className="ui-tb__bar">
        <span className="ui-tb__count">
          {filtering ? (
            <>
              {shown} of{" "}
              <span>
                {total} task{total === 1 ? "" : "s"}
              </span>
            </>
          ) : (
            `${total} task${total === 1 ? "" : "s"}`
          )}
        </span>
        <div className="ui-tb__tools">
          <label className="ui-tb__search">
            <SearchIcon />
            <input
              placeholder="Search"
              aria-label="Search tasks"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="ui-tb__menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="ui-tb__icon"
              aria-label="Filter by label"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              data-active={activeLabels.length > 0 ? "" : undefined}
              onClick={() => setMenuOpen((value) => !value)}
            >
              <FilterIcon />
            </button>
            {menuOpen && (
              <div className="ui-tb__menu" role="menu" aria-label="Filter by label">
                <p className="ui-tb__menu-title">Labels</p>
                {labels.map((label) => {
                  const on = activeLabels.includes(label.id);
                  return (
                    <button
                      key={label.id}
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={on}
                      className="ui-tb__menu-item"
                      onClick={() => toggleLabelFilter(label.id)}
                    >
                      <span className="ui-tb__swatch" style={{ background: label.color }} />
                      {label.name}
                      {on && <CheckIcon />}
                    </button>
                  );
                })}
                {activeLabels.length > 0 && (
                  <button
                    type="button"
                    role="menuitem"
                    className="ui-tb__menu-item ui-tb__menu-clear"
                    onClick={() => setActiveLabels([])}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            className="ui-tb__icon"
            aria-pressed={compact}
            aria-label="Compact cards"
            title="Compact cards"
            onClick={() => setCompact((value) => !value)}
          >
            <CompactIcon />
          </button>
        </div>
      </div>

      <div className="ui-tb__columns">
        {columns.map((column) => {
          const cards = visible.filter((task) => task.column === column.id);
          const over = drop?.column === column.id;
          /* The drop index counts only the cards that stay put, so a card dragged out of this
           * column needs the index shifted back over its own gap before the line is drawn. */
          const draggedAt = dragId ? cards.findIndex((task) => task.id === dragId) : -1;
          const line = over && drop ? (draggedAt >= 0 && drop.index > draggedAt ? drop.index + 1 : drop.index) : -1;
          return (
            <div
              key={column.id}
              ref={(element) => registerColumn(column.id, element)}
              className="ui-tb__column"
              data-over={over ? "true" : undefined}
            >
              <div className="ui-tb__col-head">
                <span className="ui-tb__status">
                  <MarkIcon mark={column.mark ?? "todo"} color={column.color} />
                </span>
                <span className="ui-tb__col-title">{column.label}</span>
                <span className="ui-tb__col-count">{cards.length}</span>
                <button
                  type="button"
                  className="ui-tb__icon ui-tb__add"
                  aria-label={`Add task to ${column.label}`}
                  onClick={() => {
                    setAddingIn(column.id);
                    setDraft("");
                  }}
                >
                  <PlusIcon />
                </button>
              </div>
              <div className="ui-tb__cards">
                {cards.map((task, index) => (
                  <Fragment key={task.id}>
                    {line === index && <span className="ui-tb__drop" />}
                    <div className="ui-tb__slot">
                      <TaskCard
                        task={task}
                        column={column}
                        person={task.assignee ? people.find((person) => person.id === task.assignee) : undefined}
                        labels={labels}
                        dragging={dragId === task.id}
                        registerCard={registerCard}
                        onPointerDown={startDrag}
                        onPointerMove={dragCard}
                        onPointerUp={finishDrag}
                        onPointerCancel={cancelDrag}
                        onOpen={openTask}
                      />
                    </div>
                  </Fragment>
                ))}
                {line === cards.length && cards.length > 0 && <span className="ui-tb__drop" />}
                {cards.length === 0 && !addingIn && <p className="ui-tb__empty">No tasks</p>}
                {addingIn === column.id && (
                  <div className="ui-tb__new">
                    <input
                      autoFocus
                      placeholder="New task"
                      aria-label={`New task in ${column.label}`}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onBlur={() => {
                        setAddingIn(null);
                        setDraft("");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          submitDraft(column.id);
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          setAddingIn(null);
                          setDraft("");
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="ui-tb__scrim"
        aria-hidden="true"
        data-open={panelTask ? "true" : undefined}
        onClick={closePanel}
      />

      <aside
        className="ui-tb__panel"
        aria-label="Task details"
        data-open={panelTask ? "true" : undefined}
        inert={panelTask ? undefined : true}
      >
        {panelTask && (
          <>
            <div className="ui-tb__panel-head">
              <span className="ui-tb__key">{panelTask.key}</span>
              <button type="button" className="ui-tb__icon" aria-label="Close details" onClick={closePanel}>
                <CloseIcon />
              </button>
            </div>

            <textarea
              className="ui-tb__title-input"
              aria-label="Task title"
              rows={2}
              autoFocus
              value={panelTask.title}
              onChange={(event) => patchTask(panelTask.id, { title: event.target.value })}
            />

            <dl className="ui-tb__fields">
              <dt>Status</dt>
              <dd>
                <div className="ui-tb__choices">
                  {columns.map((column) => (
                    <button
                      key={column.id}
                      type="button"
                      className="ui-tb__choice"
                      aria-pressed={panelTask.column === column.id}
                      onClick={() => {
                        const rest = items.filter(
                          (task) => task.column === column.id && task.id !== panelTask.id,
                        );
                        moveTask(panelTask.id, column.id, rest.length);
                        onUpdate?.(panelTask.id, { column: column.id });
                      }}
                    >
                      <MarkIcon mark={column.mark ?? "todo"} color={column.color} size={12} />
                      {column.label}
                    </button>
                  ))}
                </div>
              </dd>

              <dt>Priority</dt>
              <dd>
                <div className="ui-tb__choices">
                  {([1, 2, 3, 4] as TaskPriority[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      className="ui-tb__choice"
                      aria-pressed={panelTask.priority === level}
                      onClick={() =>
                        patchTask(panelTask.id, {
                          priority: panelTask.priority === level ? 0 : level,
                        })
                      }
                    >
                      <PriorityIcon level={level} size={12} />
                      {PRIORITY_TITLE[level]}
                    </button>
                  ))}
                </div>
              </dd>

              <dt>Estimate</dt>
              <dd>
                <div className="ui-tb__choices">
                  {ESTIMATES.map((estimate) => (
                    <button
                      key={estimate}
                      type="button"
                      className="ui-tb__choice"
                      aria-pressed={panelTask.estimate === estimate}
                      onClick={() =>
                        patchTask(panelTask.id, {
                          estimate: panelTask.estimate === estimate ? undefined : estimate,
                        })
                      }
                    >
                      {estimate}
                    </button>
                  ))}
                </div>
              </dd>

              <dt>Assignee</dt>
              <dd>
                <div className="ui-tb__choices">
                  <button
                    type="button"
                    className="ui-tb__choice"
                    aria-pressed={!panelTask.assignee}
                    onClick={() => patchTask(panelTask.id, { assignee: undefined })}
                  >
                    Unassigned
                  </button>
                  {people.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      className="ui-tb__choice"
                      aria-pressed={panelTask.assignee === person.id}
                      onClick={() => patchTask(panelTask.id, { assignee: person.id })}
                    >
                      {person.name}
                    </button>
                  ))}
                </div>
              </dd>

              <dt>Labels</dt>
              <dd>
                <div className="ui-tb__choices">
                  {labels.map((label) => {
                    const on = (panelTask.labels ?? []).includes(label.id);
                    return (
                      <button
                        key={label.id}
                        type="button"
                        className="ui-tb__choice"
                        aria-pressed={on}
                        onClick={() => {
                          const current = panelTask.labels ?? [];
                          patchTask(panelTask.id, {
                            labels: on
                              ? current.filter((id) => id !== label.id)
                              : [...current, label.id],
                          });
                        }}
                      >
                        <span className="ui-tb__swatch ui-tb__swatch--dot" style={{ background: label.color }} />
                        {label.name}
                      </button>
                    );
                  })}
                </div>
              </dd>
            </dl>

            <div className="ui-tb__panel-foot">
              <span>{panelTask.created ? `Created ${panelTask.created}` : "No date"}</span>
              <button
                type="button"
                className="ui-tb__delete"
                onClick={() => deleteTask(panelTask.id)}
              >
                Delete
              </button>
            </div>
          </>
        )}
      </aside>
    </section>
  );
}

type TaskCardProps = {
  task: BoardTask;
  column: BoardColumn;
  person?: BoardPerson;
  labels: BoardLabel[];
  dragging: boolean;
  registerCard: (id: string, element: HTMLElement | null) => void;
  onPointerDown: (task: BoardTask, event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  onOpen: (id: string) => void;
};

function TaskCard({
  task,
  column,
  person,
  labels,
  dragging,
  registerCard,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onOpen,
}: TaskCardProps) {
  const chips: ReactNode[] = [];

  if (task.priority > 0) {
    chips.push(
      <span key="priority" className="ui-tb__prop" title={PRIORITY_TITLE[task.priority]}>
        <PriorityIcon level={task.priority} />
      </span>,
    );
  }

  if (task.due) {
    chips.push(
      <span key="due" className="ui-tb__prop" data-tone={task.due.tone}>
        <ClockIcon />
        {task.due.label}
      </span>,
    );
  }

  if (task.estimate) {
    chips.push(
      <span key="estimate" className="ui-tb__prop" title="Estimate">
        <EstimateIcon />
        {task.estimate}
      </span>,
    );
  }

  if (task.pullRequest) {
    chips.push(
      <span key="pull" className="ui-tb__prop">
        <BranchIcon />#{task.pullRequest}
      </span>,
    );
  }

  if (task.subtasks && task.subtasks.total > 0) {
    const ratio = Math.min(1, Math.max(0, task.subtasks.done / task.subtasks.total));
    chips.push(
      <span key="subtasks" className="ui-tb__prop">
        <svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true">
          <circle className="ui-tb__ring-track" cx="7" cy="7" r="5" fill="none" strokeWidth="2" />
          <circle
            cx="7"
            cy="7"
            r="5"
            fill="none"
            stroke="#2f6bff"
            strokeWidth="2"
            strokeDasharray={`${RING * ratio} ${RING}`}
            transform="rotate(-90 7 7)"
          />
        </svg>
        {task.subtasks.done}/{task.subtasks.total}
      </span>,
    );
  }

  for (const id of task.labels ?? []) {
    const label = labels.find((entry) => entry.id === id);
    if (!label) continue;
    chips.push(
      <span key={`label-${label.id}`} className="ui-tb__prop">
        <span className="ui-tb__swatch ui-tb__swatch--dot" style={{ background: label.color }} />
        {label.name}
      </span>,
    );
  }

  return (
    <article
      ref={(element) => registerCard(task.id, element)}
      className="ui-tb__card"
      data-card={task.id}
      data-dragging={dragging ? "true" : undefined}
      draggable="true"
      tabIndex={0}
      aria-label={`${task.key} ${task.title}`}
      onDragStart={(event) => event.preventDefault()}
      onPointerDown={(event) => onPointerDown(task, event)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={() => onOpen(task.id)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onOpen(task.id);
      }}
    >
      <div className="ui-tb__card-top">
        <span className="ui-tb__key">{task.key}</span>
        {person &&
          (person.avatar ? (
            <img
              className="ui-tb__avatar"
              alt={person.name}
              title={person.name}
              width={18}
              height={18}
              loading="lazy"
              src={person.avatar}
            />
          ) : (
            <span className="ui-tb__avatar ui-tb__avatar--initials" title={person.name}>
              {person.name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase() ?? "")
                .join("")}
            </span>
          ))}
      </div>
      <p className="ui-tb__card-title">
        <span className="ui-tb__status">
          <MarkIcon mark={column.mark ?? "todo"} color={column.color} />
        </span>
        <span>{task.title}</span>
      </p>
      {chips.length > 0 && <div className="ui-tb__props">{chips}</div>}
      {task.created && <p className="ui-tb__created">Created {task.created}</p>}
    </article>
  );
}

/* Marks – the five status glyphs, copied from the reference */

function MarkIcon({ mark, color, size = 15 }: { mark: ColumnMark; color?: string; size?: number }) {
  const stroke = color ?? MARK_COLOR[mark];
  if (mark === "done") {
    return (
      <svg
        viewBox="0 0 16 16"
        width={size}
        height={size}
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2.5" y="2.5" width="11" height="11" rx="3" fill={stroke} stroke="none" />
        <path d="m5.5 8.2 1.8 1.8 3.3-3.6" stroke="#fff" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke={stroke}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {mark === "review" && (
        <>
          <path d="M1.8 8S4 3.8 8 3.8 14.2 8 14.2 8 12 12.2 8 12.2 1.8 8 1.8 8Z" />
          <circle cx="8" cy="8" r="1.8" />
        </>
      )}
      {mark === "next" && (
        <path d="M2.5 9.5 4 3.5h8l1.5 6M2.5 9.5v3h11v-3M2.5 9.5H6l.8 1.5h2.4l.8-1.5h3.5" />
      )}
      {mark === "progress" && (
        <>
          <circle cx="8" cy="8" r="5.5" />
          <path d="M8 5v3l2 1.5" />
        </>
      )}
      {mark === "todo" && <rect x="3" y="3" width="10" height="10" rx="2.5" />}
    </svg>
  );
}

/* Priority: three bars for low, medium and high; a filled badge for urgent */

function PriorityIcon({ level, size = 14 }: { level: TaskPriority; size?: number }) {
  if (level === 4) {
    return (
      <svg className="ui-tb__prio" viewBox="0 0 14 14" width={size} height={size} aria-hidden="true">
        <rect x="1" y="1" width="12" height="12" rx="3" fill="#ec4899" />
        <path d="M7 3.8v4M7 9.9v.3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  const bar = (index: number, x: number, y: number, height: number) => (
    <rect
      x={x}
      y={y}
      width="2.4"
      height={height}
      rx="0.8"
      className={level > index ? "ui-tb__prio-on" : "ui-tb__prio-off"}
    />
  );
  return (
    <svg className="ui-tb__prio" viewBox="0 0 14 14" width={size} height={size} aria-hidden="true">
      {bar(0, 2, 9, 3)}
      {bar(1, 6, 6, 6)}
      {bar(2, 10, 3, 9)}
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 4 4 4-4 4" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <path
        d="m8 1.8 1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 12.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11ZM11 11l3.5 3.5" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 4.5h11M4.5 8h7M6.5 11.5h3" />
    </svg>
  );
}

function CompactIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 3.5h11v3h-11zM2.5 9.5h11v3h-11z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 14.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11ZM8 6v3l2 1.2M6.5 1.5h3" />
    </svg>
  );
}

function EstimateIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 2.5 13.5 12h-11Z" />
    </svg>
  );
}

function BranchIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 4v8M4.5 4a1.5 1.5 0 1 0 0-.01M11.5 12a1.5 1.5 0 1 0 0 .01M11.5 10.5V6.5a2 2 0 0 0-2-2H7.5M8.5 3.5l-1 1 1 1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3.5 8.4 3 3 6-6.8" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
    </svg>
  );
}

const css = /* css */ `
.ui-tb{--ui-tb-tray: #f5efe8;--ui-tb-card: #fffdfb;--ui-tb-line: #eae2d9;--ui-tb-ink: #1c1713;--ui-tb-text: #3d3226;--ui-tb-muted: #857567;--ui-tb-accent: #ff6b35;--ui-tb-ease: cubic-bezier(0.22, 1, 0.36, 1);position: relative;box-sizing: border-box;width: 100%;min-width: 0;overflow: hidden;container-type: inline-size;background: #fffdfb;border: 1px solid #ded4ca;border-radius: 20px;font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;color: var(--ui-tb-ink);-webkit-font-smoothing: antialiased}
.ui-tb *, .ui-tb *::before, .ui-tb *::after{box-sizing: border-box}
.ui-tb button{margin: 0;font: inherit;color: inherit;cursor: pointer}
.ui-tb button:focus-visible, .ui-tb [tabindex]:focus-visible{outline: 2px solid var(--ui-tb-accent);outline-offset: 2px}
.ui-tb__top{display: flex;align-items: center;min-height: 48px;padding: 0 14px 0 18px;border-bottom: 1px solid var(--ui-tb-line)}
.ui-tb__crumbs{display: flex;align-items: center;gap: 6px;font-size: 14px}
.ui-tb__logo{display: inline-flex;align-items: flex-end;gap: 2px;height: 14px;margin-right: 4px}
.ui-tb__logo i{width: 3px;border-radius: 1px;background: var(--ui-tb-accent)}
.ui-tb__logo i:nth-child(1){height: 6px;opacity: 0.45}
.ui-tb__logo i:nth-child(2){height: 10px;opacity: 0.7}
.ui-tb__logo i:nth-child(3){height: 14px}
.ui-tb__crumb{display: inline-flex;align-items: center;gap: 6px;white-space: nowrap;color: var(--ui-tb-muted)}
@container (max-width: 420px){.ui-tb__crumb:not(:nth-last-of-type(-n + 2)){display: none}
}
.ui-tb__crumb svg{color: #b4a89d}
.ui-tb__crumb[aria-current]{color: var(--ui-tb-ink);font-weight: 500}
.ui-tb__icon{position: relative;display: grid;place-items: center;width: 28px;height: 28px;padding: 0;border: 0;border-radius: 8px;background: transparent;color: var(--ui-tb-muted) !important;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-tb__icon:hover{background: #f2eae2;color: var(--ui-tb-ink) !important}
.ui-tb__icon[aria-pressed="true"], .ui-tb__icon[data-active]{background: #f6f0e9;color: var(--ui-tb-accent) !important}
.ui-tb__dot{position: absolute;top: 4px;right: 4px;width: 6px;height: 6px;border-radius: 50%;background: var(--ui-tb-accent)}
.ui-tb__bar{display: flex;align-items: center;justify-content: space-between;gap: 12px;min-height: 46px;padding: 0 12px 0 18px}
.ui-tb__count{font-size: 13px;font-variant-numeric: tabular-nums;white-space: nowrap;color: var(--ui-tb-text)}
.ui-tb__count span{color: var(--ui-tb-muted)}
.ui-tb__tools{display: flex;align-items: center;gap: 4px}
.ui-tb__search{display: flex;align-items: center;gap: 6px;width: clamp(110px, 30vw, 170px);height: 30px;margin-right: 4px;padding: 0 10px;border-radius: 9px;background: #f4ece5;color: var(--ui-tb-muted);transition: box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-tb__search:focus-within{background: #fffdfb;box-shadow: 0 0 0 1px var(--ui-tb-accent), 0 0 0 3px rgba(255, 107, 53, 0.12)}
.ui-tb__search input{flex: 1;min-width: 0;border: 0;outline: none;background: transparent;font: inherit;font-size: 13px;color: var(--ui-tb-ink)}
.ui-tb__search input::-webkit-search-cancel-button{display: none}
.ui-tb__menu-wrap{position: relative}
.ui-tb__menu{position: absolute;top: calc(100% + 6px);right: 0;z-index: 8;display: grid;gap: 2px;min-width: 180px;padding: 6px 4px 4px;border-radius: 12px;background: #fffdfb;box-shadow: 0 0 0 1px #ded4ca, 0 12px 30px -8px rgba(11, 9, 8, 0.2);animation: ui-tb-drop var(--nm-dur-2, 160ms) var(--ui-tb-ease)}
.ui-tb__menu-title{margin: 0 0 2px;padding: 0 10px;font-size: 11.5px;color: var(--ui-tb-muted)}
.ui-tb__menu-item{display: flex;align-items: center;gap: 8px;height: 30px;padding: 0 10px;border: 0;border-radius: 8px;background: transparent;font-size: 13px !important;text-align: left}
.ui-tb__menu-item svg{margin-left: auto;color: var(--ui-tb-accent)}
.ui-tb__menu-item:hover{background: #f4ece5}
.ui-tb__menu-clear{color: var(--ui-tb-muted) !important}
.ui-tb__swatch{flex: none;width: 8px;height: 8px;border-radius: 2px}
.ui-tb__swatch--dot{border-radius: 50%}
.ui-tb__prio-on{fill: #4a3d2f}
.ui-tb__prio-off{fill: #c6bab0}
.ui-tb__ring-track{stroke: #d5c9bf}
.ui-tb__columns{display: grid;grid-auto-columns: minmax(224px, 1fr);grid-auto-flow: column;gap: 10px;padding: 0 12px 12px;overflow-x: auto;scrollbar-width: thin}
.ui-tb__column{display: flex;flex-direction: column;min-height: 300px;padding: 4px 6px 6px;border-radius: 16px;background: var(--ui-tb-tray);transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-tb__column[data-over]{background: #f2eae2;box-shadow: inset 0 0 0 1px #ffb28f}
.ui-tb__col-head{display: flex;align-items: center;gap: 8px;height: 38px;padding: 0 4px 0 8px}
.ui-tb__col-title{font-size: 13.5px;font-weight: 500}
.ui-tb__col-count{font-size: 12.5px;font-variant-numeric: tabular-nums;color: var(--ui-tb-muted)}
.ui-tb__add{margin-left: auto}
.ui-tb__status{display: grid;place-items: center;flex: none;width: 15px;height: 15px}
.ui-tb__status svg{width: 15px;height: 15px}
.ui-tb__cards{display: grid;align-content: start;gap: 6px;flex: 1}
.ui-tb__slot{display: grid;gap: 6px}
.ui-tb__card{padding: 10px 12px 11px;border-radius: 12px;background: var(--ui-tb-card);box-shadow: 0 0 0 1px #e3dad1, 0 1px 2px rgba(11, 9, 8, 0.04);cursor: grab;animation: ui-tb-in var(--nm-dur-4, 380ms) var(--ui-tb-ease) both;transition: box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-2, 160ms) var(--ui-tb-ease)}
.ui-tb__card:hover{box-shadow: 0 0 0 1px #d0c4ba, 0 6px 16px -8px rgba(11, 9, 8, 0.14)}
.ui-tb__card:active{cursor: grabbing}
.ui-tb__card[data-dragging]{opacity: 0.35;transform: scale(0.98)}
.ui-tb__card-top{display: flex;align-items: center;justify-content: space-between;min-height: 18px}
.ui-tb__key{font-size: 12px;font-variant-numeric: tabular-nums;color: var(--ui-tb-muted)}
.ui-tb__avatar{flex: none;border-radius: 50%;object-fit: cover;box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06)}
.ui-tb__avatar--initials{display: grid;place-items: center;background: #eef3ff;font-size: 9px;font-weight: 600;color: var(--ui-tb-accent)}
.ui-tb__card-title{display: flex;gap: 8px;margin: 4px 0 0;font-size: 13.5px;font-weight: 450;line-height: 19px}
.ui-tb__card-title .ui-tb__status{margin-top: 2px}
.ui-tb__props{display: flex;flex-wrap: wrap;gap: 5px;margin-top: 9px}
.ui-tb__prop{display: inline-flex;align-items: center;gap: 5px;height: 22px;padding: 0 7px;border-radius: 7px;box-shadow: inset 0 0 0 1px #e8e0d8;font-size: 11.5px;font-variant-numeric: tabular-nums;white-space: nowrap;color: var(--ui-tb-text)}
.ui-tb__prop svg{flex: none;color: var(--ui-tb-muted)}
.ui-tb__prop[data-tone="soon"]{color: #d9541f}
.ui-tb__prop[data-tone="soon"] svg{color: #d99530}
.ui-tb__prop[data-tone="late"]{color: #b3261e;background: #faf7f4;box-shadow: inset 0 0 0 1px #ede5dc}
.ui-tb__prop[data-tone="late"] svg{color: #e2544a}
.ui-tb__created{margin: 9px 0 0;font-size: 11.5px;color: var(--ui-tb-muted)}
.ui-tb[data-compact] .ui-tb__props, .ui-tb[data-compact] .ui-tb__created{display: none}
.ui-tb__drop{display: block;height: 3px;margin: -1px 4px;border-radius: 2px;background: var(--ui-tb-accent);animation: ui-tb-grow 160ms var(--ui-tb-ease)}
.ui-tb__empty{display: grid;place-items: center;height: 80px;margin: 0;border: 1px dashed #ccc1b6;border-radius: 12px;font-size: 12.5px;color: var(--ui-tb-muted)}
.ui-tb__new input{width: 100%;height: 40px;padding: 0 12px;border: 0;border-radius: 12px;outline: none;background: #fffdfb;box-shadow: 0 0 0 1px var(--ui-tb-accent), 0 0 0 3px rgba(255, 107, 53, 0.12);font: inherit;font-size: 13.5px}
.ui-tb__scrim{position: absolute;inset: 0;z-index: 9;background: rgba(28, 23, 19, 0.08);opacity: 0;pointer-events: none;transition: opacity 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-tb__scrim[data-open]{opacity: 1;pointer-events: auto}
.ui-tb__panel{position: absolute;top: 8px;right: 8px;bottom: 8px;z-index: 10;display: flex;flex-direction: column;width: min(360px, calc(100% - 16px));padding: 14px 16px 14px;overflow-y: auto;border-radius: 16px;background: #fffdfb;box-shadow: 0 0 0 1px #ded4ca, 0 20px 50px -12px rgba(11, 9, 8, 0.25);transform: translateX(calc(100% + 24px));transition: transform 380ms var(--ui-tb-ease)}
.ui-tb__panel[data-open]{transform: none}
.ui-tb__panel-head{display: flex;align-items: center;justify-content: space-between}
.ui-tb__title-input{margin: 8px -6px 0;padding: 4px 6px;border: 0;border-radius: 8px;outline: none;resize: none;font: inherit;font-size: 17px;font-weight: 600;line-height: 23px;color: var(--ui-tb-ink)}
.ui-tb__title-input:focus{background: #f7f1eb}
.ui-tb__fields{display: grid;gap: 6px;margin: 14px 0 0}
.ui-tb__fields dt{margin-top: 8px;font-size: 12px;color: var(--ui-tb-muted)}
.ui-tb__fields dd{margin: 0}
.ui-tb__choices{display: flex;flex-wrap: wrap;gap: 5px}
.ui-tb__choice{display: inline-flex;align-items: center;gap: 6px;height: 28px;padding: 0 9px;border: 0;border-radius: 8px;background: #fffdfb;box-shadow: inset 0 0 0 1px #e3dad1;font-size: 12.5px !important;color: var(--ui-tb-text) !important;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-tb__choice:hover{background: #f7f1eb}
.ui-tb__choice[aria-pressed="true"]{background: #f6f0e9;box-shadow: inset 0 0 0 1px #ffb28f;color: var(--ui-tb-ink) !important}
.ui-tb__panel-foot{display: flex;align-items: center;justify-content: space-between;margin-top: auto;padding-top: 16px;font-size: 12px;color: var(--ui-tb-muted)}
.ui-tb__delete{height: 28px;padding: 0 10px;border: 0;border-radius: 8px;background: transparent;font-size: 12.5px !important;color: #e2544a !important}
.ui-tb__delete:hover{background: #f8f3ee}
@keyframes ui-tb-in{from{opacity: 0;transform: translateY(3px)}
}
@keyframes ui-tb-drop{from{opacity: 0;transform: translateY(-4px) scale(0.98)}
}
@keyframes ui-tb-grow{from{transform: scaleX(0.6);opacity: 0}
}
@media (prefers-reduced-motion: reduce){.ui-tb__card, .ui-tb__menu, .ui-tb__drop{animation: none}
.ui-tb__panel, .ui-tb__scrim, .ui-tb__card{transition: none}
}
.ui-tb input:not([type="checkbox"]):not([type="radio"]):focus-visible, .ui-tb textarea:focus-visible, .ui-tb [contenteditable]:focus-visible{outline: none}
:where(.dark, [data-theme="dark"]) .ui-tb{--ui-tb-tray: #1c1713;--ui-tb-card: #27201a;--ui-tb-line: rgba(255, 253, 251, 0.08);--ui-tb-ink: #ebe3da;--ui-tb-text: #b4a89d;--ui-tb-muted: #857567;background: #27201a;border-color: rgba(255, 253, 251, 0.08)}
:where(.dark, [data-theme="dark"]) .ui-tb__crumb svg{color: #625244}
:where(.dark, [data-theme="dark"]) .ui-tb__icon:hover{background: rgba(255, 253, 251, 0.06)}
:where(.dark, [data-theme="dark"]) .ui-tb__icon[aria-pressed="true"], :where(.dark, [data-theme="dark"]) .ui-tb__icon[data-active]{background: rgba(255, 107, 53, 0.16);color: #ff8a5c !important}
:where(.dark, [data-theme="dark"]) .ui-tb__search{background: #2b231b}
:where(.dark, [data-theme="dark"]) .ui-tb__search:focus-within{background: #2b231b;box-shadow: 0 0 0 1px var(--ui-tb-accent), 0 0 0 3px rgba(255, 107, 53, 0.24)}
:where(.dark, [data-theme="dark"]) .ui-tb__menu{background: #2b231b;box-shadow: 0 0 0 1px rgba(255, 253, 251, 0.1), 0 12px 30px -8px rgba(11, 9, 8, 0.5)}
:where(.dark, [data-theme="dark"]) .ui-tb__menu-item:hover{background: rgba(255, 253, 251, 0.06)}
:where(.dark, [data-theme="dark"]) .ui-tb__menu-item svg{color: #ff8a5c}
:where(.dark, [data-theme="dark"]) .ui-tb__column[data-over]{background: rgba(255, 107, 53, 0.12);box-shadow: inset 0 0 0 1px rgba(255, 107, 53, 0.4)}
:where(.dark, [data-theme="dark"]) .ui-tb__card{box-shadow: 0 0 0 1px rgba(255, 253, 251, 0.08), 0 1px 2px rgba(11, 9, 8, 0.4)}
:where(.dark, [data-theme="dark"]) .ui-tb__card:hover{box-shadow: 0 0 0 1px rgba(255, 253, 251, 0.14), 0 6px 16px -8px rgba(11, 9, 8, 0.5)}
:where(.dark, [data-theme="dark"]) .ui-tb__avatar{box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08)}
:where(.dark, [data-theme="dark"]) .ui-tb__avatar--initials{background: rgba(47, 107, 255, 0.16);color: #6b95ff}
:where(.dark, [data-theme="dark"]) .ui-tb__prop{box-shadow: inset 0 0 0 1px rgba(255, 253, 251, 0.1)}
:where(.dark, [data-theme="dark"]) .ui-tb__prop[data-tone="soon"]{color: #e8b05c}
:where(.dark, [data-theme="dark"]) .ui-tb__prop[data-tone="late"]{color: #e2544a;background: rgba(226, 84, 74, 0.14);box-shadow: inset 0 0 0 1px rgba(226, 84, 74, 0.28)}
:where(.dark, [data-theme="dark"]) .ui-tb__prio-on{fill: #b4a89d}
:where(.dark, [data-theme="dark"]) .ui-tb__prio-off{fill: #463a2c}
:where(.dark, [data-theme="dark"]) .ui-tb__ring-track{stroke: rgba(255, 253, 251, 0.14)}
:where(.dark, [data-theme="dark"]) .ui-tb__empty{border-color: rgba(255, 253, 251, 0.14)}
:where(.dark, [data-theme="dark"]) .ui-tb__new input{background: #2b231b;color: var(--ui-tb-ink);box-shadow: 0 0 0 1px var(--ui-tb-accent), 0 0 0 3px rgba(255, 107, 53, 0.24)}
:where(.dark, [data-theme="dark"]) .ui-tb__scrim{background: rgba(11, 9, 8, 0.4)}
:where(.dark, [data-theme="dark"]) .ui-tb__panel{background: #27201a;box-shadow: 0 0 0 1px rgba(255, 253, 251, 0.1), 0 20px 50px -12px rgba(11, 9, 8, 0.6)}
:where(.dark, [data-theme="dark"]) .ui-tb__title-input{background: transparent}
:where(.dark, [data-theme="dark"]) .ui-tb__title-input:focus{background: #2b231b}
:where(.dark, [data-theme="dark"]) .ui-tb__choice{background: #2b231b;box-shadow: inset 0 0 0 1px rgba(255, 253, 251, 0.08)}
:where(.dark, [data-theme="dark"]) .ui-tb__choice:hover{background: #33291f}
:where(.dark, [data-theme="dark"]) .ui-tb__choice[aria-pressed="true"]{background: rgba(255, 107, 53, 0.16);box-shadow: inset 0 0 0 1px rgba(255, 107, 53, 0.45)}
:where(.dark, [data-theme="dark"]) .ui-tb__delete{color: #e2544a !important}
:where(.dark, [data-theme="dark"]) .ui-tb__delete:hover{background: rgba(226, 84, 74, 0.14)}

`;
