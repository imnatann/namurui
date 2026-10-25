"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type Ref,
} from "react";

/*
 * Data Table – a compact spreadsheet that lives inside a card.
 *
 * Click a cell to activate it, drag or Shift-click to grow a range, and type to replace the value
 * in place. Double-click opens the editor; tag cells open their picker too. Enter commits and
 * steps down, Tab commits and moves across, Escape backs out. ⌘/Ctrl+C, X and V move a TSV block
 * between this table and Numbers, Excel or Google Sheets; ⌘/Ctrl+Z and ⇧Z walk the edit history.
 * Column headers cycle ascending → descending → unsorted, and checked rows come with a bulk
 * delete action in the footer. The extracted stylesheet is injected at the end of this file.
 */

export type TagTone = "blue" | "violet" | "pink" | "green" | "amber" | "gray";

export type DataColumnType = "title" | "tag" | "link" | "number" | "text";

export type DataColumn = {
  /** Row key this column reads and writes */
  key: string;
  /** Header label */
  label: string;
  /** How the cell is drawn and edited */
  type: DataColumnType;
  /** A line icon shown in the header – defaults to the icon for `type` */
  icon?: ReactNode;
  /** Column width as a px number or any CSS length, e.g. "30%" */
  width?: number | string;
  /** false keeps the column read-only; defaults to true */
  editable?: boolean;
  /** Choices offered by a tag column's picker – defaults to the values already present */
  options?: string[];
};

export type CellValue = string | number | boolean | ReactNode | undefined;

export type DataRow = {
  id: string;
  /** Mark drawn in front of a title cell – the original accepts an inline SVG */
  logo?: ReactNode;
} & Record<string, CellValue>;

export type DataTableProps = {
  /** Card heading and the grid's accessible name */
  title?: string;
  /** Replaces the built-in stack mark in the header */
  icon?: ReactNode;
  columns: DataColumn[];
  rows: DataRow[];
  /** Tag colour per tag text; unknown tags fall back to gray */
  tagTones?: Record<string, TagTone>;
  /** false keeps selection and copying, but turns off editing, paste, delete and Add row */
  editable?: boolean;
  onRowsChange?: (rows: DataRow[]) => void;
  /** Checked row ids */
  onSelectionChange?: (ids: string[]) => void;
  className?: string;
  ref?: Ref<HTMLElement>;
};

type Pos = { r: number; c: number };

type Bounds = { r1: number; r2: number; c1: number; c2: number };

type SortState = { key: string; dir: "asc" | "desc" };

type Editing = {
  pos: Pos;
  draft: string;
  original: string;
  picked: number;
  navigated: boolean;
};

type PickerAt = { top: number; left: number; width: number };

const HISTORY_LIMIT = 60;
const ROW_HEIGHT = 40;
const HEAD_HEIGHT = 36.5;
const EMPTY_HEIGHT = 68.5;
const DEFAULT_SUMMARY = "Double-click a cell to edit";

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

export function TitleColumnIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4h10M3 7h10M3 10h10M3 13h6" />
    </svg>
  );
}

export function TagColumnIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z" />
    </svg>
  );
}

export function LinkColumnIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6.5 9.5l3-3M7.25 4.75l1-1a2.5 2.5 0 0 1 3.5 3.5l-1 1M8.75 11.25l-1 1a2.5 2.5 0 0 1-3.5-3.5l1-1" />
    </svg>
  );
}

export function TextColumnIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4.5h10v9H3zM3 7.5h10M6 2.5v3M10 2.5v3" />
    </svg>
  );
}

export function NumberColumnIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6.5 3.5 5 12.5M11 3.5 9.5 12.5M3.5 6.5h9M3 9.5h9" />
    </svg>
  );
}

const COLUMN_ICONS: Record<DataColumnType, ReactNode> = {
  title: <TitleColumnIcon />,
  tag: <TagColumnIcon />,
  link: <LinkColumnIcon />,
  number: <NumberColumnIcon />,
  text: <TextColumnIcon />,
};

function StackIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="2" y="2" width="16" height="16" rx="4.5" fill="#0060e2" />
      <path d="M6 7.5h8M6 10h8M6 12.5h5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5.5 3.5 2.5 6.5l3 3M2.5 6.5h7a3.5 3.5 0 0 1 0 7H7" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m10.5 3.5 3 3-3 3M13.5 6.5h-7a3.5 3.5 0 0 0 0 7H9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="m4.5 8.25 2.25 2.25L11.5 5.75" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 3.5v9M5 9.5l3 3 3-3" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 4.5h11M6 4.5V2.75h4V4.5M4 4.5l.6 8.75h6.8L12 4.5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function cellText(value: CellValue) {
  return value === undefined || value === null ? "" : String(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function tsvOf(rows: DataRow[], columns: DataColumn[], from: Pos, to: Pos) {
  const r1 = Math.min(from.r, to.r);
  const r2 = Math.max(from.r, to.r);
  const c1 = Math.min(from.c, to.c);
  const c2 = Math.max(from.c, to.c);
  const lines: string[] = [];
  for (let r = r1; r <= r2; r += 1) {
    const row = rows[r];
    if (!row) continue;
    const cells: string[] = [];
    for (let c = c1; c <= c2; c += 1) {
      const column = columns[c];
      if (!column) continue;
      const value = cellText(row[column.key]);
      cells.push(/[\t\n"\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    }
    lines.push(cells.join("\t"));
  }
  return lines.join("\n");
}

function parseTsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === "\t") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function DataTable({
  title = "Design Stack",
  icon,
  columns,
  rows,
  tagTones = {},
  editable = true,
  onRowsChange,
  onSelectionChange,
  className,
  ref,
}: DataTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const pickerAnchorRef = useRef<HTMLSpanElement>(null);
  const pickerId = useId();
  const clipboard = useRef("");
  const skipBlur = useRef(false);
  const rowToken = useRef(0);

  const [data, setData] = useState<DataRow[]>(rows);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const [sort, setSort] = useState<SortState | null>(null);
  const [active, setActive] = useState<Pos | null>(null);
  const [anchor, setAnchor] = useState<Pos | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [pickerAt, setPickerAt] = useState<PickerAt | null>(null);
  const [dragging, setDragging] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set<string>());
  const [past, setPast] = useState<DataRow[][]>([]);
  const [future, setFuture] = useState<DataRow[][]>([]);
  const [announcement, setAnnouncement] = useState<string | null>(null);

  useEffect(() => {
    setData(rows);
  }, [rows]);

  const view = useMemo(() => {
    if (!sort) return data;
    const column = columns.find((entry) => entry.key === sort.key);
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...data].sort((a, b) => {
      if (column?.type === "number") {
        const an = Number(cellText(a[sort.key]).replace(/[^\d.-]/g, ""));
        const bn = Number(cellText(b[sort.key]).replace(/[^\d.-]/g, ""));
        if (!Number.isNaN(an) && !Number.isNaN(bn) && an !== bn) return (an - bn) * factor;
      }
      return cellText(a[sort.key]).localeCompare(cellText(b[sort.key]), "en", { numeric: true }) * factor;
    });
  }, [columns, data, sort]);

  const rowCount = view.length;
  const columnCount = columns.length;

  const sel: Bounds | null = active
    ? {
        r1: Math.min(active.r, (anchor ?? active).r),
        r2: Math.max(active.r, (anchor ?? active).r),
        c1: Math.min(active.c, (anchor ?? active).c),
        c2: Math.max(active.c, (anchor ?? active).c),
      }
    : null;

  const clampPos = (pos: Pos): Pos => ({
    r: clamp(pos.r, 0, Math.max(0, rowCount - 1)),
    c: clamp(pos.c, 0, Math.max(0, columnCount - 1)),
  });

  const focusGrid = () => {
    scrollRef.current?.focus();
  };

  const commit = (next: DataRow[], message?: string) => {
    setPast((current) => [...current.slice(-(HISTORY_LIMIT - 1)), data.map((row) => ({ ...row }))]);
    setFuture([]);
    setData(next);
    onRowsChange?.(next);
    if (message) setAnnouncement(message);
  };

  const undo = () => {
    const snapshot = past[past.length - 1];
    if (!snapshot) return;
    setPast(past.slice(0, -1));
    setFuture([...future, data.map((row) => ({ ...row }))]);
    setData(snapshot);
    onRowsChange?.(snapshot);
    setAnnouncement("Undo.");
  };

  const redo = () => {
    const snapshot = future[future.length - 1];
    if (!snapshot) return;
    setFuture(future.slice(0, -1));
    setPast([...past, data.map((row) => ({ ...row }))]);
    setData(snapshot);
    onRowsChange?.(snapshot);
    setAnnouncement("Redo.");
  };

  const moveActive = (target: Pos, extend: boolean) => {
    if (rowCount === 0 || columnCount === 0) return;
    const next = clampPos(target);
    setActive(next);
    if (!extend || !anchor) setAnchor(next);
    focusGrid();
  };

  const clearRange = () => {
    if (!editable || !sel) return;
    const next = data.map((row) => ({ ...row }));
    let count = 0;
    for (let r = sel.r1; r <= sel.r2; r += 1) {
      const source = view[r];
      if (!source) continue;
      const target = next.find((row) => row.id === source.id);
      if (!target) continue;
      for (let c = sel.c1; c <= sel.c2; c += 1) {
        const column = columns[c];
        if (!column || column.editable === false) continue;
        if (cellText(target[column.key]) === "") continue;
        target[column.key] = "";
        count += 1;
      }
    }
    if (count === 0) return;
    commit(next, `Cleared ${count} cell${count === 1 ? "" : "s"}.`);
  };

  const selectionTsv = () =>
    sel ? tsvOf(view, columns, { r: sel.r1, c: sel.c1 }, { r: sel.r2, c: sel.c2 }) : "";

  const selectionCount = () => (sel ? (sel.r2 - sel.r1 + 1) * (sel.c2 - sel.c1 + 1) : 0);

  const copySelection = (cut: boolean) => {
    const tsv = selectionTsv();
    if (!tsv) return;
    clipboard.current = tsv;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(tsv).catch(() => {});
    }
    const count = selectionCount();
    setAnnouncement(`${cut ? "Cut" : "Copied"} ${count} cell${count === 1 ? "" : "s"} as TSV.`);
    if (cut) window.setTimeout(clearRange, 0);
  };

  const pasteText = (text: string) => {
    if (!editable || !active || !text) return;
    const parsed = parseTsv(text);
    if (parsed.length === 0) return;
    const next = data.map((row) => ({ ...row }));
    let count = 0;
    parsed.forEach((line, dr) => {
      const source = view[active.r + dr];
      if (!source) return;
      const target = next.find((row) => row.id === source.id);
      if (!target) return;
      line.forEach((value, dc) => {
        const column = columns[active.c + dc];
        if (!column || column.editable === false) return;
        if (cellText(target[column.key]) === value) return;
        target[column.key] = value;
        count += 1;
      });
    });
    if (count === 0) return;
    const widest = parsed.reduce((widestLine, line) => Math.max(widestLine, line.length), 1);
    const start = { ...active };
    commit(next, `Pasted ${count} cell${count === 1 ? "" : "s"}.`);
    setAnchor(start);
    setActive(clampPos({ r: start.r + parsed.length - 1, c: start.c + widest - 1 }));
  };

  const pasteClipboard = async () => {
    if (!editable) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          pasteText(text);
          return;
        }
      }
    } catch {
      // Clipboard permission denied – fall back to what this table copied last.
    }
    if (clipboard.current) pasteText(clipboard.current);
  };

  const uniqueTagValues = (key: string) => {
    const seen: string[] = [];
    view.forEach((row) => {
      const value = cellText(row[key]);
      if (value && !seen.includes(value)) seen.push(value);
    });
    return seen;
  };

  const startEdit = (pos: Pos, seed?: string) => {
    if (!editable) return;
    const column = columns[pos.c];
    const row = view[pos.r];
    if (!column || !row || column.editable === false) return;
    const current = cellText(row[column.key]);
    const options = column.type === "tag" ? column.options ?? uniqueTagValues(column.key) : [];
    setActive(pos);
    setAnchor(pos);
    setEditing({
      pos,
      draft: seed ?? current,
      original: current,
      picked: Math.max(0, options.indexOf(current)),
      navigated: false,
    });
  };

  const cancelEdit = () => {
    const pos = editing?.pos ?? active;
    skipBlur.current = true;
    window.setTimeout(() => {
      skipBlur.current = false;
    }, 0);
    setEditing(null);
    setPickerAt(null);
    if (pos) {
      setActive(pos);
      setAnchor(pos);
      focusGrid();
    }
  };

  const commitEdit = (draft: string, move: "down" | "right" | "left" | "stay", refocus = true) => {
    if (!editing) return;
    const { pos } = editing;
    const column = columns[pos.c];
    const row = view[pos.r];
    skipBlur.current = true;
    window.setTimeout(() => {
      skipBlur.current = false;
    }, 0);
    setEditing(null);
    setPickerAt(null);
    if (column && row && draft !== cellText(row[column.key])) {
      const next = data.map((entry) => (entry.id === row.id ? { ...entry, [column.key]: draft } : entry));
      commit(next, `${column.label} updated.`);
    }
    if (move === "stay") {
      setActive(pos);
      setAnchor(pos);
      if (refocus) focusGrid();
      return;
    }
    const offset = move === "down" ? { r: 1, c: 0 } : move === "right" ? { r: 0, c: 1 } : { r: 0, c: -1 };
    moveActive({ r: pos.r + offset.r, c: pos.c + offset.c }, false);
  };

  const editingColumn = editing ? columns[editing.pos.c] : undefined;
  const tagOptions =
    editingColumn && editingColumn.type === "tag"
      ? editingColumn.options ?? uniqueTagValues(editingColumn.key)
      : [];
  const query = editing ? editing.draft.trim().toLowerCase() : "";
  const showAllTags = !editing || editing.draft === editing.original || query === "";
  const pickerOptions = showAllTags
    ? tagOptions
    : tagOptions.filter((option) => option.toLowerCase().includes(query));
  const pickedIndex = editing ? clamp(editing.picked, 0, Math.max(0, pickerOptions.length - 1)) : 0;
  const pickerOpen =
    editing !== null && editingColumn !== undefined && editingColumn.type === "tag" && pickerOptions.length > 0;

  const positionPicker = () => {
    const anchorEl = pickerAnchorRef.current;
    if (!anchorEl) return;
    const rect = (anchorEl.closest("td") ?? anchorEl).getBoundingClientRect();
    const width = Math.max(160, rect.width);
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
    setPickerAt({ top: rect.bottom + 4, left, width });
  };

  useLayoutEffect(() => {
    if (pickerOpen) positionPicker();
    else setPickerAt(null);
    // The anchor moves with the editor, so re-measure whenever the draft or the cell changes.
  }, [pickerOpen, editing?.pos.r, editing?.pos.c]);

  useEffect(() => {
    if (!dragging) return;
    const stop = () => setDragging(false);
    window.addEventListener("mouseup", stop);
    window.addEventListener("blur", stop);
    return () => {
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("blur", stop);
    };
  }, [dragging]);

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const measure = () => {
      setContentHeight(table.getBoundingClientRect().height + (rowCount === 0 ? EMPTY_HEIGHT : 0));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(table);
    return () => observer.disconnect();
  }, [rowCount]);

  useEffect(() => {
    if (rowCount === 0 || columnCount === 0) {
      setActive(null);
      setAnchor(null);
      return;
    }
    setActive((pos) =>
      pos ? { r: clamp(pos.r, 0, rowCount - 1), c: clamp(pos.c, 0, columnCount - 1) } : pos,
    );
    setAnchor((pos) =>
      pos ? { r: clamp(pos.r, 0, rowCount - 1), c: clamp(pos.c, 0, columnCount - 1) } : pos,
    );
  }, [rowCount, columnCount]);

  const toggleCheck = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
    onSelectionChange?.(Array.from(next));
  };

  const toggleAll = () => {
    const all = rowCount > 0 && view.every((row) => checked.has(row.id));
    const next = all ? new Set<string>() : new Set(view.map((row) => row.id));
    setChecked(next);
    onSelectionChange?.(Array.from(next));
  };

  const deleteChecked = () => {
    if (!editable || checked.size === 0) return;
    const count = checked.size;
    commit(
      data.filter((row) => !checked.has(row.id)),
      `${count} row${count === 1 ? "" : "s"} deleted.`,
    );
    setChecked(new Set<string>());
    onSelectionChange?.([]);
  };

  const addRow = () => {
    if (!editable) return;
    rowToken.current += 1;
    const row: DataRow = { id: `row-${Date.now().toString(36)}-${rowToken.current}` };
    columns.forEach((column) => {
      row[column.key] = "";
    });
    const next = [...data, row];
    setSort(null);
    commit(next, "Row added.");
    const pos = { r: next.length - 1, c: 0 };
    setActive(pos);
    setAnchor(pos);
    window.requestAnimationFrame(focusGrid);
  };

  const cycleSort = (key: string) => {
    setEditing(null);
    setPickerAt(null);
    setSort((current) => {
      if (!current || current.key !== key) return { key, dir: "asc" };
      if (current.dir === "asc") return { key, dir: "desc" };
      return null;
    });
    setAnnouncement(null);
  };

  const onGridKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (editing) return;
    const meta = event.metaKey || event.ctrlKey;
    const key = event.key;
    const current = active ?? { r: 0, c: 0 };

    if (meta && key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (meta && key.toLowerCase() === "y") {
      event.preventDefault();
      redo();
      return;
    }
    if (meta && key.toLowerCase() === "a") {
      event.preventDefault();
      if (rowCount === 0 || columnCount === 0) return;
      setAnchor({ r: 0, c: 0 });
      setActive({ r: rowCount - 1, c: columnCount - 1 });
      setAnnouncement("Every cell selected.");
      return;
    }
    if (meta && key.toLowerCase() === "c") {
      event.preventDefault();
      copySelection(false);
      return;
    }
    if (meta && key.toLowerCase() === "x") {
      event.preventDefault();
      copySelection(true);
      return;
    }
    if (meta && key.toLowerCase() === "v") {
      event.preventDefault();
      void pasteClipboard();
      return;
    }
    if (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight") {
      event.preventDefault();
      if (rowCount === 0 || columnCount === 0) return;
      const target: Pos = { ...current };
      if (meta) {
        if (key === "ArrowUp") target.r = 0;
        if (key === "ArrowDown") target.r = rowCount - 1;
        if (key === "ArrowLeft") target.c = 0;
        if (key === "ArrowRight") target.c = columnCount - 1;
      } else {
        if (key === "ArrowUp") target.r -= 1;
        if (key === "ArrowDown") target.r += 1;
        if (key === "ArrowLeft") target.c -= 1;
        if (key === "ArrowRight") target.c += 1;
      }
      moveActive(target, event.shiftKey);
      return;
    }
    if (key === "Tab") {
      if (rowCount === 0 || columnCount === 0) return;
      const flat = current.r * columnCount + current.c + (event.shiftKey ? -1 : 1);
      if (flat < 0 || flat >= rowCount * columnCount) return;
      event.preventDefault();
      moveActive({ r: Math.floor(flat / columnCount), c: flat % columnCount }, false);
      return;
    }
    if (key === "Enter" || key === "F2") {
      event.preventDefault();
      if (editable && rowCount > 0 && columnCount > 0) startEdit(clampPos(current));
      return;
    }
    if (key === "Escape") {
      event.preventDefault();
      setAnchor(active);
      setAnnouncement(null);
      return;
    }
    if (key === "Delete" || key === "Backspace") {
      event.preventDefault();
      clearRange();
      return;
    }
    if (!meta && !event.altKey && key.length === 1 && editable) {
      event.preventDefault();
      startEdit(clampPos(current), key);
    }
  };

  const onEditorKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (!editing || event.nativeEvent.isComposing) return;

    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
      return;
    }

    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && editingColumn?.type === "tag") {
      if (pickerOptions.length > 0) {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        const nextIndex =
          (clamp(editing.picked, 0, pickerOptions.length - 1) + step + pickerOptions.length) %
          pickerOptions.length;
        setEditing({ ...editing, picked: nextIndex, navigated: true });
      }
      return;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      let value = editing.draft;
      if (editingColumn?.type === "tag" && pickerOptions.length > 0) {
        if (editing.navigated) {
          value = pickerOptions[pickedIndex];
        } else {
          const typed = editing.draft.trim().toLowerCase();
          const exact = pickerOptions.find((option) => option.toLowerCase() === typed);
          if (exact) value = exact;
          else if (editing.draft !== editing.original) value = pickerOptions[pickedIndex];
        }
      }
      const move = event.key === "Tab" ? (event.shiftKey ? "left" : "right") : "down";
      commitEdit(value, move);
    }
  };

  const onCellMouseDown = (event: ReactMouseEvent<HTMLTableCellElement>, r: number, c: number) => {
    if (event.button !== 0) return;
    if (editing) {
      if (editing.pos.r === r && editing.pos.c === c) return;
      commitEdit(editing.draft, "stay");
    }
    event.preventDefault();
    setAnnouncement(null);
    setActive({ r, c });
    if (!event.shiftKey || !anchor) {
      setAnchor({ r, c });
      setDragging(true);
    }
    focusGrid();
  };

  const onCopyEvent = (event: ReactClipboardEvent<HTMLDivElement>) => {
    if (editing) return;
    const tsv = selectionTsv();
    if (!tsv) return;
    event.preventDefault();
    event.clipboardData.setData("text/plain", tsv);
    clipboard.current = tsv;
    const count = selectionCount();
    setAnnouncement(`Copied ${count} cell${count === 1 ? "" : "s"} as TSV.`);
  };

  const onCutEvent = (event: ReactClipboardEvent<HTMLDivElement>) => {
    if (editing) return;
    const tsv = selectionTsv();
    if (!tsv) return;
    event.preventDefault();
    event.clipboardData.setData("text/plain", tsv);
    clipboard.current = tsv;
    const count = selectionCount();
    setAnnouncement(`Cut ${count} cell${count === 1 ? "" : "s"} as TSV.`);
    clearRange();
  };

  const onPasteEvent = (event: ReactClipboardEvent<HTMLDivElement>) => {
    if (editing) return;
    const text = event.clipboardData.getData("text/plain");
    if (!text) return;
    event.preventDefault();
    pasteText(text);
  };

  const allChecked = rowCount > 0 && view.every((row) => checked.has(row.id));
  const someChecked = rowCount > 0 && view.some((row) => checked.has(row.id));

  const morphHeight = Math.ceil(
    contentHeight ?? HEAD_HEIGHT + rowCount * ROW_HEIGHT + (rowCount === 0 ? EMPTY_HEIGHT : 0),
  );

  const rangeSummary =
    sel && (sel.r2 > sel.r1 || sel.c2 > sel.c1)
      ? `${sel.r2 - sel.r1 + 1} × ${sel.c2 - sel.c1 + 1} selected`
      : null;

  return (
    <section className={["ui-dtc", className].filter(Boolean).join(" ")} aria-label={title} ref={ref}>
      <style href="ui-data-table" precedence="default">
        {css}
      </style>

      <header className="ui-dtc__head">
        <span className="ui-dtc__title-icon">{icon ?? <StackIcon />}</span>
        <h3 className="ui-dtc__title">{title}</h3>
        <div className="ui-dtc__tools">
          <button
            type="button"
            className="ui-dtc__tool"
            aria-label="Undo (Ctrl Z)"
            title="Undo · Ctrl Z"
            disabled={past.length === 0}
            onClick={undo}
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            className="ui-dtc__tool"
            aria-label="Redo (Ctrl Shift Z)"
            title="Redo · Ctrl ⇧ Z"
            disabled={future.length === 0}
            onClick={redo}
          >
            <RedoIcon />
          </button>
        </div>
      </header>

      <div className="ui-dtc__body">
        <div className="ui-dtc__morph" data-smooth="" style={{ height: morphHeight }}>
          <div
            className="ui-dtc__scroll"
            role="grid"
            aria-label={title}
            aria-rowcount={rowCount + 1}
            aria-multiselectable="true"
            tabIndex={0}
            data-dragging={dragging ? "" : undefined}
            ref={scrollRef}
            onKeyDown={onGridKeyDown}
            onCopy={onCopyEvent}
            onCut={onCutEvent}
            onPaste={onPasteEvent}
            onMouseUp={() => setDragging(false)}
            onScroll={pickerOpen ? positionPicker : undefined}
          >
            <table className="ui-dtc__table" role="presentation" ref={tableRef}>
              <colgroup>
                <col style={{ width: 40 }} />
                {columns.map((column) => (
                  <col
                    key={column.key}
                    style={column.width === undefined ? undefined : { width: column.width }}
                  />
                ))}
              </colgroup>

              <thead>
                <tr role="row">
                  <th className="ui-dtc__select" role="columnheader">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={allChecked ? "true" : someChecked ? "mixed" : "false"}
                      aria-label="Select all rows"
                      className="ui-dtc__check"
                      onClick={toggleAll}
                    >
                      <CheckIcon />
                    </button>
                  </th>
                  {columns.map((column, c) => {
                    const dir = sort !== null && sort.key === column.key ? sort.dir : null;
                    return (
                      <th
                        key={column.key}
                        role="columnheader"
                        aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
                        data-type={column.type}
                        data-col-active={active?.c === c ? "" : undefined}
                      >
                        <button type="button" className="ui-dtc__th" onClick={() => cycleSort(column.key)}>
                          <span className="ui-dtc__col-icon">{column.icon ?? COLUMN_ICONS[column.type]}</span>
                          <span className="ui-dtc__th-label">{column.label}</span>
                          <span className="ui-dtc__sort" data-dir={dir ?? undefined} aria-hidden="true">
                            <SortIcon />
                          </span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {view.map((row, r) => {
                  const rowChecked = checked.has(row.id);
                  const titleColumn = columns.find((column) => column.type === "title");
                  const rowLabel = (titleColumn && cellText(row[titleColumn.key])) || "row";
                  return (
                    <tr key={row.id} role="row" data-selected={rowChecked ? "" : undefined}>
                      <td className="ui-dtc__select" role="gridcell">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={rowChecked ? "true" : "false"}
                          aria-label={`Select ${rowLabel}`}
                          className="ui-dtc__check"
                          onClick={() => toggleCheck(row.id)}
                        >
                          <CheckIcon />
                        </button>
                      </td>

                      {columns.map((column, c) => {
                        const isActive = active?.r === r && active?.c === c;
                        const inRange =
                          sel !== null && r >= sel.r1 && r <= sel.r2 && c >= sel.c1 && c <= sel.c2;
                        const isEditing = editing !== null && editing.pos.r === r && editing.pos.c === c;
                        const value = cellText(row[column.key]);

                        return (
                          <td
                            key={column.key}
                            role="gridcell"
                            data-cell={`${r}-${c}`}
                            data-type={column.type}
                            aria-selected={inRange ? "true" : "false"}
                            data-in-range={inRange ? "" : undefined}
                            data-active={isActive ? "" : undefined}
                            data-editing={isEditing ? "" : undefined}
                            onMouseDown={(event) => onCellMouseDown(event, r, c)}
                            onMouseEnter={() => {
                              if (dragging && !editing) setActive({ r, c });
                            }}
                            onDoubleClick={() => startEdit({ r, c })}
                          >
                            {isEditing && editing ? (
                              <>
                                <input
                                  className="ui-dtc__input"
                                  value={editing.draft}
                                  autoFocus
                                  aria-label={`Edit ${column.label}`}
                                  role={column.type === "tag" ? "combobox" : undefined}
                                  aria-expanded={column.type === "tag" ? pickerOpen : undefined}
                                  aria-controls={column.type === "tag" ? pickerId : undefined}
                                  aria-autocomplete={column.type === "tag" ? "list" : undefined}
                                  onChange={(event) =>
                                    setEditing({ ...editing, draft: event.target.value, picked: 0, navigated: false })
                                  }
                                  onKeyDown={onEditorKeyDown}
                                  onBlur={() => {
                                    if (skipBlur.current) return;
                                    commitEdit(editing.draft, "stay", false);
                                  }}
                                />
                                <span
                                  className="ui-dtc__picker-anchor"
                                  ref={column.type === "tag" ? pickerAnchorRef : undefined}
                                  aria-hidden="true"
                                />
                                <span className="ui-dtc__picker-origin" aria-hidden="true" />
                                {column.type === "tag" && pickerOpen && pickerAt && (
                                  <div
                                    id={pickerId}
                                    className="ui-dtc__picker"
                                    role="listbox"
                                    aria-label={`${column.label} options`}
                                    style={{ top: pickerAt.top, left: pickerAt.left, minWidth: pickerAt.width }}
                                  >
                                    {pickerOptions.map((option, index) => (
                                      <button
                                        key={option}
                                        type="button"
                                        role="option"
                                        aria-selected={index === pickedIndex ? "true" : "false"}
                                        className="ui-dtc__option"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => commitEdit(option, "stay")}
                                      >
                                        <span className="ui-dtc__tag" data-tone={tagTones[option] ?? "gray"}>
                                          {option}
                                        </span>
                                        <svg className="ui-dtc__option-check" viewBox="0 0 16 16" aria-hidden="true">
                                          <path d="m4.5 8.25 2.25 2.25L11.5 5.75" />
                                        </svg>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : (
                              <CellContent row={row} column={column} value={value} tagTones={tagTones} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {rowCount === 0 && <p className="ui-dtc__empty">No rows yet. Add a row to start filling the table.</p>}
          </div>
        </div>
      </div>

      <footer className="ui-dtc__foot">
        {checked.size > 0 ? (
          <div className="ui-dtc__bulk">
            <span>{checked.size} selected</span>
            <button
              type="button"
              className="ui-dtc__add ui-dtc__add--danger"
              onClick={deleteChecked}
              disabled={!editable}
            >
              <TrashIcon />
              Delete rows
            </button>
          </div>
        ) : (
          <button type="button" className="ui-dtc__add" onClick={addRow} disabled={!editable}>
            <PlusIcon />
            Add row
          </button>
        )}
        <span className="ui-dtc__summary" aria-live="polite">
          {announcement ?? rangeSummary ?? DEFAULT_SUMMARY}
        </span>
      </footer>
    </section>
  );
}

function CellContent({
  row,
  column,
  value,
  tagTones,
}: {
  row: DataRow;
  column: DataColumn;
  value: string;
  tagTones: Record<string, TagTone>;
}) {
  if (column.type === "title") {
    return (
      <span className="ui-dtc__name">
        {row.logo ? (
          <span className="ui-dtc__logo">{row.logo}</span>
        ) : (
          <span className="ui-dtc__logo ui-dtc__logo--empty" aria-hidden="true" />
        )}
        <span className="ui-dtc__name-text" data-empty={value ? undefined : ""}>
          {value}
        </span>
      </span>
    );
  }

  if (column.type === "tag") {
    if (!value) return null;
    return (
      <span className="ui-dtc__tag" data-tone={tagTones[value] ?? "gray"}>
        {value}
      </span>
    );
  }

  if (column.type === "link") {
    if (!value) return null;
    const label = value.replace(/^https?:\/\//i, "").replace(/\/$/, "");
    return (
      <a
        className="ui-dtc__link"
        href={/^https?:\/\//i.test(value) ? value : `https://${value}`}
        target="_blank"
        rel="noreferrer"
        tabIndex={-1}
      >
        {label}
      </a>
    );
  }

  return <span className="ui-dtc__text">{value}</span>;
}

const css = /* css */ `
.ui-dtc{--ui-dtc-card: #fffdfb;--ui-dtc-ink: rgba(11, 9, 8, 0.88);--ui-dtc-strong: #0b0908;--ui-dtc-text: rgba(11, 9, 8, 0.61);--ui-dtc-muted: rgba(11, 9, 8, 0.45);--ui-dtc-faint: rgba(11, 9, 8, 0.27);--ui-dtc-icon: rgba(11, 9, 8, 0.447);--ui-dtc-line: rgba(11, 9, 8, 0.06);--ui-dtc-fill: rgba(11, 9, 8, 0.06);--ui-dtc-wash: rgba(11, 9, 8, 0.03);--ui-dtc-row-hover: rgba(11, 9, 8, 0.015);--ui-dtc-accent: rgba(217, 84, 31, 0.765);--ui-dtc-selected: rgba(217, 84, 31, 0.05);--ui-dtc-active-blur: rgba(217, 84, 31, 0.35);--ui-dtc-check-ring: rgba(11, 9, 8, 0.22);--ui-dtc-check-ring-hover: rgba(11, 9, 8, 0.4);--ui-dtc-check-on: rgba(11, 9, 8, 0.88);--ui-dtc-check-mark: #fcf9f7;--ui-dtc-underline: rgba(11, 9, 8, 0.16);--ui-dtc-danger: #e2544a;--ui-dtc-danger-wash: rgba(226, 84, 74, 0.08);--ui-dtc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-dtc-shadow-pop: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 12px 28px -10px rgba(11, 9, 8, 0.16), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-dtc-focus: rgba(217, 84, 31, 0.35);--ui-dtc-ease: cubic-bezier(0.22, 1, 0.36, 1);box-sizing: border-box;width: 100%;min-width: 0;overflow: hidden;border-radius: 10px;background: var(--ui-dtc-card);box-shadow: var(--ui-dtc-shadow);font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;font-weight: 400;color: var(--ui-dtc-ink);-webkit-font-smoothing: antialiased}
.ui-dtc *, .ui-dtc *::before, .ui-dtc *::after{box-sizing: border-box}
:where(.ui-dtc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;cursor: pointer}
:where(.ui-dtc) svg{display: block;flex: none}
.ui-dtc button:focus-visible, .ui-dtc a:focus-visible{outline: 2px solid var(--ui-dtc-focus);outline-offset: 1px}
.ui-dtc__head{display: flex;align-items: center;gap: 8px;min-height: 52px;padding: 12px 12px 12px 16px}
.ui-dtc__title{margin: 0;overflow: hidden;font-size: 15px;font-weight: 500;line-height: 24px;white-space: nowrap;text-overflow: ellipsis;color: var(--ui-dtc-strong)}
.ui-dtc__title-icon{display: grid;flex: none}
.ui-dtc__title-icon svg{width: 18px;height: 18px}
.ui-dtc__tools{display: flex;gap: 2px;margin-left: auto}
.ui-dtc__tool{display: grid;place-items: center;width: 28px;height: 28px;border-radius: 6px;color: var(--ui-dtc-icon);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dtc__tool:hover:not(:disabled){background: var(--ui-dtc-wash);color: var(--ui-dtc-ink)}
.ui-dtc__tool:disabled{opacity: 0.4;cursor: default}
.ui-dtc__scroll{overflow-x: auto;scrollbar-width: thin;outline: none}
.ui-dtc__scroll[data-dragging]{cursor: cell;user-select: none}
.ui-dtc__table{width: 100%;min-width: 600px;border-collapse: collapse;table-layout: fixed;font-size: 13px;line-height: 20px}
.ui-dtc__table th, .ui-dtc__table td{position: relative;height: 40px;padding: 0 12px;border-top: 0.5px solid var(--ui-dtc-line);text-align: left;vertical-align: middle;white-space: nowrap;overflow: hidden;text-overflow: ellipsis}
.ui-dtc__table th{height: 36px;padding: 0 6px;font-size: 12px;font-weight: 500;line-height: 16px;color: var(--ui-dtc-text);transition: color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dtc__table th[data-col-active]{color: var(--ui-dtc-ink)}
.ui-dtc__th{display: flex;align-items: center;gap: 6px;width: 100%;height: 28px;padding: 0 6px;border-radius: 6px;text-align: left;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dtc__th:hover{background: var(--ui-dtc-wash);color: var(--ui-dtc-ink)}
.ui-dtc__th:focus-visible{outline-offset: -2px}
.ui-dtc__th-label{overflow: hidden;text-overflow: ellipsis;white-space: nowrap}
.ui-dtc__col-icon{display: grid;color: var(--ui-dtc-icon)}
.ui-dtc__sort{display: grid;margin-left: auto;color: var(--ui-dtc-icon);opacity: 0;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-3, 240ms) var(--ui-dtc-ease)}
.ui-dtc__th:hover .ui-dtc__sort{opacity: 1}
.ui-dtc__sort[data-dir]{opacity: 1;color: var(--ui-dtc-accent)}
.ui-dtc__sort[data-dir="asc"]{transform: rotate(180deg)}
.ui-dtc__table .ui-dtc__select{padding: 0;text-align: center}
.ui-dtc__select .ui-dtc__check{margin: 0 auto}
.ui-dtc__table tbody tr{transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dtc__table tbody tr:hover{background: var(--ui-dtc-row-hover)}
.ui-dtc__table tbody tr[data-selected]{background: var(--ui-dtc-selected)}
.ui-dtc__table td[data-cell]{cursor: cell}
.ui-dtc__table td[data-in-range]{background: var(--ui-dtc-selected)}
.ui-dtc__table td[data-active]::after{content: "";position: absolute;inset: 1px;border-radius: 4px;box-shadow: inset 0 0 0 1.5px var(--ui-dtc-accent);pointer-events: none}
.ui-dtc__scroll:not(:focus-within) td[data-active]::after{box-shadow: inset 0 0 0 1px var(--ui-dtc-active-blur)}
.ui-dtc__table td[data-editing]{padding: 0;overflow: visible;background: var(--ui-dtc-card)}
.ui-dtc__input{width: 100%;height: 100%;padding: 0 12px;border: 0;outline: none;background: transparent;font: inherit;color: var(--ui-dtc-ink);caret-color: var(--ui-dtc-accent)}
.ui-dtc__table td[data-type="number"] .ui-dtc__input{font-variant-numeric: tabular-nums}
.ui-dtc__picker-anchor{display: block}
.ui-dtc__picker-origin{position: fixed;left: 0;top: 0;width: 0;height: 0;pointer-events: none}
.ui-dtc__picker{position: fixed;z-index: 50;display: grid;gap: 2px;padding: 4px;border-radius: 10px;background: var(--ui-dtc-card);box-shadow: var(--ui-dtc-shadow-pop);animation: ui-dtc-drop var(--nm-dur-2, 160ms) var(--ui-dtc-ease)}
.ui-dtc__option{display: flex;align-items: center;justify-content: space-between;gap: 12px;height: 32px;padding: 0 6px;border-radius: 6px;text-align: left}
.ui-dtc__option:hover, .ui-dtc__option:focus-visible{background: var(--ui-dtc-fill);outline: none}
.ui-dtc__option-check{width: 16px;height: 16px;fill: none;stroke: var(--ui-dtc-accent);stroke-width: 1.5;stroke-linecap: round;stroke-linejoin: round;opacity: 0}
.ui-dtc__option[aria-selected="true"] .ui-dtc__option-check{opacity: 1}
.ui-dtc__name{display: flex;align-items: center;gap: 8px;min-width: 0}
.ui-dtc__name-text{overflow: hidden;text-overflow: ellipsis;font-weight: 500;color: var(--ui-dtc-ink)}
.ui-dtc__name-text[data-empty]{font-weight: 400;color: var(--ui-dtc-faint)}
.ui-dtc__logo{display: grid;place-items: center;flex: none;width: 16px;height: 16px}
.ui-dtc__logo svg{width: 100%;height: 100%}
.ui-dtc__logo--empty{border-radius: 4px;background: var(--ui-dtc-fill)}
.ui-dtc__check{display: grid;place-items: center;flex: none;width: 14px;height: 14px;border-radius: 4px;background: var(--ui-dtc-card);box-shadow: inset 0 0 0 0.5px var(--ui-dtc-check-ring), 0 1px 1px 0 rgba(11, 9, 8, 0.04);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dtc__check:hover{box-shadow: inset 0 0 0 0.5px var(--ui-dtc-check-ring-hover), 0 1px 1px 0 rgba(11, 9, 8, 0.04)}
.ui-dtc__check:focus-visible{outline-offset: 2px}
.ui-dtc__check svg{width: 12px;height: 12px;fill: none;stroke: var(--ui-dtc-check-mark);stroke-width: 1.6;stroke-linecap: round;stroke-linejoin: round;opacity: 0;transform: scale(0.6);transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-3, 240ms) cubic-bezier(0.34, 1.56, 0.64, 1)}
.ui-dtc__check[aria-checked="true"], .ui-dtc__check[aria-checked="mixed"]{background: var(--ui-dtc-check-on);box-shadow: none}
.ui-dtc__check[aria-checked="true"] svg, .ui-dtc__check[aria-checked="mixed"] svg{opacity: 1;transform: none}
.ui-dtc__tag{display: inline-block;max-width: 100%;height: 20px;padding: 0 6px;border-radius: 5px;overflow: hidden;font-size: 12px;font-weight: 500;line-height: 20px;white-space: nowrap;text-overflow: ellipsis;vertical-align: middle}
.ui-dtc__tag[data-tone="blue"]{background: rgba(217, 84, 31, 0.08);color: #ff6b35}
.ui-dtc__tag[data-tone="violet"]{background: rgba(255, 138, 92, 0.09);color: #c2703a}
.ui-dtc__tag[data-tone="pink"]{background: rgba(179, 38, 30, 0.08);color: #b3261e}
.ui-dtc__tag[data-tone="green"]{background: rgba(47, 141, 92, 0.09);color: #1a7a4a}
.ui-dtc__tag[data-tone="amber"]{background: rgba(217, 149, 48, 0.12);color: #9a6410}
.ui-dtc__tag[data-tone="gray"]{background: rgba(11, 9, 8, 0.05);color: var(--ui-dtc-text)}
.ui-dtc__link{color: var(--ui-dtc-text);text-decoration: underline;text-decoration-color: var(--ui-dtc-underline);text-decoration-thickness: 1px;text-underline-offset: 3px;transition: text-decoration-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dtc__link:hover{color: var(--ui-dtc-ink);text-decoration-color: currentColor}
.ui-dtc__text{color: var(--ui-dtc-text);font-variant-numeric: tabular-nums}
.ui-dtc__empty{margin: 0;padding: 24px;border-top: 0.5px solid var(--ui-dtc-line);text-align: center;color: var(--ui-dtc-muted)}
.ui-dtc__foot{display: flex;align-items: center;justify-content: space-between;gap: 12px;min-height: 44px;padding: 8px 16px 8px 8px;border-top: 0.5px solid var(--ui-dtc-line)}
.ui-dtc__bulk{display: flex;align-items: center;gap: 2px;min-width: 0;padding-left: 8px}
.ui-dtc__bulk > span{margin-right: 8px;font-weight: 500;white-space: nowrap;color: var(--ui-dtc-ink)}
.ui-dtc__add{display: inline-flex;align-items: center;gap: 6px;height: 28px;padding: 0 10px 0 8px;border-radius: 6px;font-weight: 500;white-space: nowrap;color: var(--ui-dtc-text);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dtc__add svg{color: var(--ui-dtc-icon);transition: color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dtc__add:not(:has(svg)){padding: 0 10px}
.ui-dtc__add:hover{background: var(--ui-dtc-wash);color: var(--ui-dtc-ink)}
.ui-dtc__add:hover svg{color: var(--ui-dtc-ink)}
.ui-dtc__add--danger, .ui-dtc__add--danger svg, .ui-dtc__add--danger:hover svg{color: var(--ui-dtc-danger)}
.ui-dtc__add--danger:hover{background: var(--ui-dtc-danger-wash);color: var(--ui-dtc-danger)}
.ui-dtc__summary{min-width: 0;overflow: hidden;font-size: 12px;line-height: 16px;font-variant-numeric: tabular-nums;white-space: nowrap;text-overflow: ellipsis;color: var(--ui-dtc-muted)}
@keyframes ui-dtc-drop{from{opacity: 0;transform: translateY(-4px) scale(0.98)}
}
.ui-dtc__morph{overflow: hidden}
.ui-dtc__morph[data-smooth]{transition: height 380ms var(--ui-dtc-ease)}
@media (max-width: 480px){.ui-dtc__head{padding-left: 14px}
.ui-dtc__foot{padding-right: 14px}
}
@media (hover: none) and (pointer: coarse){.ui-dtc__tool{width: 36px;height: 36px}
.ui-dtc__add{height: 36px}
.ui-dtc__table td{height: 44px}
.ui-dtc__option{height: 40px}
.ui-dtc__check{position: relative}
.ui-dtc__check::after{content: "";position: absolute;inset: -12px}
}
@media (prefers-reduced-motion: reduce){.ui-dtc *, .ui-dtc *::before, .ui-dtc *::after{animation: none !important;transition: none !important}
}
.ui-dtc input:not([type="checkbox"]):not([type="radio"]):focus-visible, .ui-dtc textarea:focus-visible, .ui-dtc [contenteditable]:focus-visible{outline: none}
:where(.dark, [data-theme="dark"]) .ui-dtc{--ui-dtc-card: #211b16;--ui-dtc-ink: rgba(255, 253, 251, 0.9);--ui-dtc-strong: #fffdfb;--ui-dtc-text: rgba(255, 253, 251, 0.62);--ui-dtc-muted: rgba(255, 253, 251, 0.46);--ui-dtc-faint: rgba(255, 253, 251, 0.3);--ui-dtc-icon: rgba(255, 253, 251, 0.5);--ui-dtc-line: rgba(255, 253, 251, 0.08);--ui-dtc-fill: rgba(255, 253, 251, 0.08);--ui-dtc-wash: rgba(255, 253, 251, 0.05);--ui-dtc-row-hover: rgba(255, 253, 251, 0.025);--ui-dtc-accent: #ff8a5c;--ui-dtc-selected: rgba(255, 138, 92, 0.14);--ui-dtc-active-blur: rgba(255, 138, 92, 0.5);--ui-dtc-check-ring: rgba(255, 253, 251, 0.28);--ui-dtc-check-ring-hover: rgba(255, 253, 251, 0.45);--ui-dtc-check-on: rgba(255, 253, 251, 0.9);--ui-dtc-check-mark: #211b16;--ui-dtc-underline: rgba(255, 253, 251, 0.22);--ui-dtc-danger: #e2544a;--ui-dtc-danger-wash: rgba(226, 84, 74, 0.14);--ui-dtc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-dtc-shadow-pop: 0 0 0 0.5px rgba(255, 253, 251, 0.12), 0 12px 28px -10px rgba(11, 9, 8, 0.6);--ui-dtc-focus: rgba(255, 138, 92, 0.5)}
:where(.dark, [data-theme="dark"]) .ui-dtc__check{box-shadow: inset 0 0 0 0.5px var(--ui-dtc-check-ring)}
:where(.dark, [data-theme="dark"]) .ui-dtc__check[aria-checked="true"], :where(.dark, [data-theme="dark"]) .ui-dtc__check[aria-checked="mixed"]{box-shadow: none}
:where(.dark, [data-theme="dark"]) .ui-dtc__tag[data-tone="blue"]{background: rgba(255, 138, 92, 0.16);color: #ff8a5c}
:where(.dark, [data-theme="dark"]) .ui-dtc__tag[data-tone="violet"]{background: rgba(255, 138, 92, 0.18);color: #ff8a5c}
:where(.dark, [data-theme="dark"]) .ui-dtc__tag[data-tone="pink"]{background: rgba(226, 84, 74, 0.16);color: #f0938c}
:where(.dark, [data-theme="dark"]) .ui-dtc__tag[data-tone="green"]{background: rgba(47, 141, 92, 0.15);color: #4f9d6e}
:where(.dark, [data-theme="dark"]) .ui-dtc__tag[data-tone="amber"]{background: rgba(217, 149, 48, 0.15);color: #e8b05c}
:where(.dark, [data-theme="dark"]) .ui-dtc__tag[data-tone="gray"]{background: rgba(255, 253, 251, 0.08);color: var(--ui-dtc-text)}

`;
