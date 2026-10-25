"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

/*
 * Combobox – pick one or many from a searchable, grouped list, in a single self-contained file.
 * What is picked sits in the field as chips with initials; typing filters the groups and wraps the
 * matching letters in <mark>. Arrow keys move a gray pill that glides between rows, Enter picks or
 * unpicks, Backspace arms the last chip and removes it on a second press, Escape clears the query
 * then closes, and text that matches nothing grows a create row when the list is creatable.
 * The chip row is measured in a hidden copy of itself, so the field can fold the overflow into a
 * single "+N" chip instead of wrapping; the count in the footer rolls to its new value.
 * The styles are injected below, so no extra files are needed.
 */

export type ComboboxOption = {
  /** Stable identity – this is what `value` holds */
  value: string;
  /** The main line, e.g. a person's name */
  label: string;
  /** A quieter second line beside it – a role, an email address */
  hint?: string;
  /** `true` for initials on a tinted disc, or the URL of an image */
  avatar?: string | true;
  /** A small coloured dot before the label – any CSS colour */
  dot?: string;
  /** A line icon, used when there is no avatar or dot */
  icon?: ReactNode;
  /** Extra words the search should match */
  keywords?: string[];
};

/** Options listed under one small uppercase title. */
export type ComboboxGroup = {
  label: string;
  options: ComboboxOption[];
};

type ComboboxBaseProps = {
  /** Groups, or a flat list – bare options join the run of options around them */
  options: ComboboxGroup[] | ComboboxOption[];
  /** Label above the field – it also names the list for screen readers */
  label?: string;
  /** Shown while nothing is picked */
  placeholder?: string;
  /** Shown when the query matches nothing and nothing can be created */
  emptyText?: string;
  /** Most chips to show, on top of the width the field can actually hold */
  maxVisibleChips?: number;
  /** Offer a row that creates an option from the typed text */
  creatable?: boolean;
  /** Builds the option for a new entry – without it the text becomes both value and label */
  onCreate?: (text: string) => ComboboxOption | void;
  /** Copy for the create row */
  createLabel?: (text: string) => string;
  /** Render the list on the first paint */
  defaultOpen?: boolean;
  className?: string;
};

type ComboboxSingleProps = {
  /** Pick one – picking closes the list */
  multiple?: false;
  /** The picked value (controlled) */
  value?: string;
  /** The picked value when uncontrolled */
  defaultValue?: string;
  onChange?: (value: string, option: ComboboxOption | undefined) => void;
};

type ComboboxMultipleProps = {
  /** Pick many – every pick becomes a chip */
  multiple: true;
  /** The picked values (controlled) */
  value?: string[];
  /** The picked values when uncontrolled */
  defaultValue?: string[];
  onChange?: (value: string[], options: ComboboxOption[]) => void;
};

export type ComboboxProps = (ComboboxBaseProps & ComboboxSingleProps) | (ComboboxBaseProps & ComboboxMultipleProps);

type Group = { label?: string; options: ComboboxOption[] };

type Row =
  | { kind: "option"; option: ComboboxOption; id: string }
  | { kind: "create"; text: string; id: string };

/* ---------- helpers ---------- */

/** Case- and accent-insensitive, so "yilmaz" finds "Yılmaz" */
function fold(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function normalizeGroups(entries: ComboboxGroup[] | ComboboxOption[], created: ComboboxOption[]): Group[] {
  const groups: Group[] = [];
  for (const entry of entries) {
    if ("options" in entry) {
      groups.push({ label: entry.label, options: [...entry.options] });
    } else {
      const last = groups[groups.length - 1];
      if (last && last.label === undefined) last.options.push(entry);
      else groups.push({ options: [entry] });
    }
  }
  const known = new Set(groups.flatMap((group) => group.options.map((option) => option.value)));
  const fresh = created.filter((option) => !known.has(option.value));
  if (fresh.length > 0) groups.push({ options: fresh });
  return groups;
}

/** The letters the query matched, wrapped so the sheet can tint them */
function Highlighted({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const pattern = new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  const parts = text.split(pattern);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? <mark key={index}>{part}</mark> : <span key={index}>{part}</span>,
      )}
    </>
  );
}

/** Avatar, dot or icon in front of a label – the same mark in the list and in a chip */
function OptionLead({ option }: { option: ComboboxOption }) {
  if (typeof option.avatar === "string") {
    return <img className="ui-cbxc__avatar" src={option.avatar} alt="" loading="lazy" />;
  }
  if (option.avatar) {
    return (
      <span className="ui-cbxc__avatar" aria-hidden="true">
        {option.label
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((word) => word.charAt(0).toUpperCase())
          .join("")}
      </span>
    );
  }
  if (option.dot) return <span className="ui-cbxc__dot" style={{ background: option.dot }} aria-hidden="true" />;
  if (option.icon) {
    return (
      <span className="ui-cbxc__icon" aria-hidden="true">
        {option.icon}
      </span>
    );
  }
  return null;
}

type ChipProps = {
  option: ComboboxOption;
  /** The last chip, waiting for a second Backspace */
  armed?: boolean;
  /** Folding away after removal */
  leaving?: boolean;
  /** A measured stand-in – same box, nothing to press */
  measured?: boolean;
  onRemove?: () => void;
};

function Chip({ option, armed, leaving, measured, onRemove }: ChipProps) {
  const plain = !option.avatar && !option.dot && !option.icon;
  const glyph = (
    <svg viewBox="0 0 24 24" className="ui-cbxc__glyph" aria-hidden="true">
      <path d="M7 7l10 10M17 7L7 17" />
    </svg>
  );
  const removable = !measured && !leaving && onRemove !== undefined;
  return (
    <li
      className="ui-cbxc__chip"
      data-plain={plain ? "true" : undefined}
      data-armed={armed ? "true" : undefined}
      data-leaving={leaving ? "true" : undefined}
    >
      <span className="ui-cbxc__chip-body">
        <OptionLead option={option} />
        <span className="ui-cbxc__chip-label">{option.label}</span>
        {removable ? (
          <button
            type="button"
            className="ui-cbxc__chip-x"
            tabIndex={-1}
            aria-label={`Remove ${option.label}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onRemove}
          >
            {glyph}
          </button>
        ) : (
          <span className="ui-cbxc__chip-x">{glyph}</span>
        )}
      </span>
    </li>
  );
}

/* ---------- component ---------- */

export function Combobox(props: ComboboxProps) {
  const {
    options,
    label,
    placeholder = "Search…",
    emptyText = "No matches",
    maxVisibleChips,
    creatable = false,
    onCreate,
    createLabel = (text: string) => `Create “${text}”`,
    defaultOpen = false,
    className,
  } = props;

  const id = `ui-cbxc${useId()}`;
  const inputId = `${id}-input`;
  const listId = `${id}-list`;

  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const fieldInnerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listInnerRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLUListElement>(null);

  const [inner, setInner] = useState<string[]>(() => {
    const initial = props.defaultValue;
    if (initial === undefined) return [];
    return Array.isArray(initial) ? initial : [initial];
  });
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [armed, setArmed] = useState(false);
  const [created, setCreated] = useState<ComboboxOption[]>([]);
  const [leaving, setLeaving] = useState<{ option: ComboboxOption; index: number }[]>([]);
  const [shown, setShown] = useState(Number.POSITIVE_INFINITY);
  const [box, setBox] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  const multiple = props.multiple === true;
  const controlled = props.value;
  const selected =
    controlled === undefined ? inner : Array.isArray(controlled) ? controlled : [controlled];
  const selectionKey = selected.join("\u0000");

  const groups = normalizeGroups(options, created);
  const flatOptions = groups.flatMap((group) => group.options);
  const selectedOptions = selected.map(
    (value): ComboboxOption => flatOptions.find((option) => option.value === value) ?? { value, label: value },
  );

  const needle = query.trim();
  const folded = fold(needle);
  const matches = (option: ComboboxOption, groupLabel?: string) => {
    if (!folded) return true;
    if (fold(option.label).includes(folded)) return true;
    if (option.hint && fold(option.hint).includes(folded)) return true;
    if (groupLabel && fold(groupLabel).includes(folded)) return true;
    return (option.keywords ?? []).some((word) => fold(word).includes(folded));
  };

  const visibleGroups: { index: number; label?: string; options: ComboboxOption[] }[] = [];
  const rows: Row[] = [];
  for (const group of groups) {
    const picks = group.options.filter((option) => matches(option, group.label));
    if (picks.length === 0) continue;
    visibleGroups.push({ index: visibleGroups.length, label: group.label, options: picks });
    for (const option of picks) rows.push({ kind: "option", option, id: `${id}-o${rows.length}` });
  }

  const canCreate =
    creatable &&
    needle.length > 0 &&
    !flatOptions.some((option) => fold(option.label) === folded || fold(option.value) === folded);
  if (canCreate) rows.push({ kind: "create", text: needle, id: `${id}-o${rows.length}` });

  const activeIndex = rows.length === 0 ? -1 : Math.min(active, rows.length - 1);
  const activeRow = activeIndex >= 0 ? rows[activeIndex] : undefined;

  const visibleChips = selectedOptions.slice(0, shown);
  const hiddenCount = selectedOptions.length - visibleChips.length;
  const armedValue = armed && hiddenCount === 0 ? selected[selected.length - 1] : undefined;

  // A removed chip keeps its slot for one collapse, so the chips after it slide instead of jump
  const chips: { option: ComboboxOption; leaving: boolean }[] = visibleChips.map((option) => ({
    option,
    leaving: false,
  }));
  for (const gone of leaving) chips.splice(Math.min(gone.index, chips.length), 0, { option: gone.option, leaving: true });

  const commit = (next: string[], pool: ComboboxOption[]) => {
    if (controlled === undefined) setInner(next);
    const resolved = next.map((value) => pool.find((option) => option.value === value) ?? { value, label: value });
    if (props.multiple === true) props.onChange?.(next, resolved);
    else props.onChange?.(next[0] ?? "", resolved[0]);
  };

  const leave = (option: ComboboxOption) => {
    const index = selected.indexOf(option.value);
    setLeaving((list) =>
      list.some((item) => item.option.value === option.value)
        ? list
        : [...list, { option, index: index < 0 ? 0 : index }],
    );
  };

  const remove = (option: ComboboxOption) => {
    const next = selected.filter((value) => value !== option.value);
    commit(next, flatOptions);
    leave(option);
    setArmed(false);
    setAnnouncement(`${option.label} removed. ${next.length} selected.`);
    inputRef.current?.focus();
  };

  const toggle = (option: ComboboxOption) => {
    const isOn = selected.includes(option.value);
    setArmed(false);
    if (multiple) {
      const next = isOn
        ? selected.filter((value) => value !== option.value)
        : [...selected, option.value];
      commit(next, flatOptions);
      if (isOn) leave(option);
      setQuery("");
      setActive(0);
      setAnnouncement(`${option.label} ${isOn ? "removed" : "added"}. ${next.length} selected.`);
      inputRef.current?.focus();
      return;
    }
    const next = isOn ? [] : [option.value];
    commit(next, flatOptions);
    setQuery("");
    setOpen(false);
    setAnnouncement(isOn ? `${option.label} cleared.` : `${option.label} selected.`);
    inputRef.current?.focus();
  };

  const create = (text: string) => {
    const built = onCreate?.(text);
    const option: ComboboxOption = built ? built : { value: text, label: text };
    const pool = flatOptions.some((item) => item.value === option.value) ? flatOptions : [...flatOptions, option];
    setCreated((list) => (list.some((item) => item.value === option.value) ? list : [...list, option]));
    const next =
      multiple
        ? [...selected.filter((value) => value !== option.value), option.value]
        : [option.value];
    commit(next, pool);
    setQuery("");
    setArmed(false);
    setAnnouncement(`${option.label} created.`);
    if (!multiple) setOpen(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setArmed(false);
      if (!open) {
        setOpen(true);
        setActive(0);
        return;
      }
      if (rows.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + rows.length) % rows.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (!activeRow) return;
      if (activeRow.kind === "create") create(activeRow.text);
      else toggle(activeRow.option);
      return;
    }
    if (event.key === "Backspace" && !query) {
      if (!multiple || selected.length === 0) return;
      event.preventDefault();
      const last = selectedOptions[selectedOptions.length - 1];
      if (armed && last) {
        setArmed(false);
        remove(last);
      } else {
        setArmed(true);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (query) {
        setQuery("");
        setActive(0);
      } else if (open) {
        setOpen(false);
        setArmed(false);
      } else {
        setArmed(false);
      }
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      setArmed(false);
    }
  };

  const onFieldDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;
    if (target === inputRef.current) {
      setOpen(true);
      return;
    }
    event.preventDefault();
    inputRef.current?.focus();
    setOpen(true);
  };

  // The footer count rolls up or down when it changes
  const counted = useRef(selected.length);
  const grew = selected.length >= counted.current;
  useEffect(() => {
    counted.current = selected.length;
  }, [selected.length]);

  // The outer box follows the inner box, so a taller field eases instead of jumping
  useLayoutEffect(() => {
    const field = fieldRef.current;
    const innerBox = fieldInnerRef.current;
    if (!field || !innerBox) return;
    const sync = () => {
      field.style.height = `${innerBox.offsetHeight}px`;
    };
    sync();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      sync();
      setBox((count) => count + 1);
    });
    observer.observe(innerBox);
    return () => observer.disconnect();
  }, []);

  // The list eases to its content height, and the sheet caps it at 300px
  useLayoutEffect(() => {
    const list = listRef.current;
    const innerList = listInnerRef.current;
    if (!list || !innerList) return;
    const styles = getComputedStyle(list);
    const padding = parseFloat(styles.paddingTop || "0") + parseFloat(styles.paddingBottom || "0");
    const cap = parseFloat(styles.maxHeight);
    const full = innerList.offsetHeight + padding;
    list.style.height = `${Number.isFinite(cap) ? Math.min(full, cap) : full}px`;
  }, [open, rows.length, box, selectionKey]);

  // The pill glides to the active row
  useLayoutEffect(() => {
    const list = listRef.current;
    const pill = pillRef.current;
    if (!list || !pill) return;
    const element = activeRow ? document.getElementById(activeRow.id) : null;
    if (!element) {
      pill.style.opacity = "0";
      return;
    }
    pill.style.opacity = "1";
    pill.style.height = `${element.offsetHeight}px`;
    pill.style.transform = `translateY(${element.offsetTop}px)`;
    pill.setAttribute("data-ready", "1");
  }, [open, activeRow?.id, rows.length, box, query]);

  // Keep the active row in view without moving the page
  useEffect(() => {
    const list = listRef.current;
    if (!list || activeIndex < 0) return;
    const element = activeRow ? document.getElementById(activeRow.id) : null;
    if (!element) return;
    const top = element.offsetTop;
    const bottom = top + element.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }, [activeRow?.id, rows.length, open]);

  useEffect(() => {
    setActive((current) => Math.min(current, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    if (leaving.length === 0) return;
    const timer = window.setTimeout(() => setLeaving([]), 320);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  // How many chips fit before the field would have to push the input off its line
  useLayoutEffect(() => {
    const measure = measureRef.current;
    const field = fieldInnerRef.current;
    const input = inputRef.current;
    if (!measure || !field || !input) return;
    const boxStyles = getComputedStyle(field);
    const padX = parseFloat(boxStyles.paddingLeft || "0") + parseFloat(boxStyles.paddingRight || "0");
    const inputStyles = getComputedStyle(input);
    const inputMin = parseFloat(inputStyles.minWidth || "0");
    const available = field.clientWidth - padX - inputMin;
    if (available <= 0) return;

    const items = Array.from(measure.children) as HTMLElement[];
    const more = items.pop();
    const gap = more ? parseFloat(getComputedStyle(more).marginRight || "0") : 0;
    const moreWidth = more ? more.getBoundingClientRect().width + gap : 0;
    const widths = items.map((item) => item.getBoundingClientRect().width + gap);

    let fit = 0;
    let used = 0;
    for (let count = 0; count <= widths.length; count += 1) {
      if (count > 0) used += widths[count - 1];
      const overflow = count < widths.length ? moreWidth : 0;
      if (used + overflow <= available) fit = count;
    }
    const capped = maxVisibleChips === undefined ? fit : Math.min(fit, Math.max(0, maxVisibleChips));
    setShown((current) => (current === capped ? current : capped));
  }, [selectionKey, created.length, maxVisibleChips, box]);

  let cursor = 0;

  return (
    <div
      className={["ui-cbxc", className].filter(Boolean).join(" ")}
      data-open={open ? "true" : undefined}
      ref={rootRef}
    >
      <style href="ui-combobox" precedence="default">
        {css}
      </style>

      {label && (
        <label className="ui-cbxc__label" id={`${id}-label`} htmlFor={inputId}>
          {label}
        </label>
      )}

      <div className="ui-cbxc__field" ref={fieldRef} onMouseDown={onFieldDown}>
        <div className="ui-cbxc__field-inner" ref={fieldInnerRef}>
          <ul className="ui-cbxc__measure" aria-hidden="true" ref={measureRef}>
            {selectedOptions.map((option) => (
              <Chip key={`measure-${option.value}`} option={option} measured />
            ))}
            <li className="ui-cbxc__chip ui-cbxc__more">
              <span className="ui-cbxc__chip-body">+99</span>
            </li>
          </ul>

          {chips.length > 0 && (
            <ul className="ui-cbxc__chips">
              {chips.map((entry) => (
                <Chip
                  key={`${entry.leaving ? "out-" : ""}${entry.option.value}`}
                  option={entry.option}
                  leaving={entry.leaving}
                  armed={entry.option.value === armedValue && !entry.leaving}
                  onRemove={entry.leaving ? undefined : () => remove(entry.option)}
                />
              ))}
              <li className="ui-cbxc__chip ui-cbxc__more" data-hidden={hiddenCount === 0 ? "true" : undefined}>
                <span className="ui-cbxc__chip-body">+{hiddenCount}</span>
              </li>
            </ul>
          )}

          <input
            id={inputId}
            ref={inputRef}
            className="ui-cbxc__input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && activeRow ? activeRow.id : undefined}
            placeholder={selected.length === 0 ? placeholder : ""}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              setActive(0);
              setArmed(false);
            }}
            onKeyDown={onKeyDown}
          />
        </div>

        <button
          type="button"
          className="ui-cbxc__toggle"
          tabIndex={-1}
          aria-label={open ? "Close list" : "Open list"}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setOpen((current) => !current);
            inputRef.current?.focus();
          }}
        >
          <svg viewBox="0 0 24 24" className="ui-cbxc__glyph" aria-hidden="true">
            <path d="M8 10l4 4 4-4" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="ui-cbxc__pop">
          <div
            id={listId}
            className="ui-cbxc__list"
            role="listbox"
            aria-multiselectable={multiple || undefined}
            aria-labelledby={label ? `${id}-label` : undefined}
            aria-label={label ? undefined : "Options"}
            ref={listRef}
          >
            <span className="ui-cbxc__pill" aria-hidden="true" ref={pillRef} />

            <div className="ui-cbxc__list-inner" ref={listInnerRef}>
              {visibleGroups.map((group) => (
                <div
                  key={group.label ?? `group-${group.index}`}
                  role="group"
                  aria-labelledby={group.label ? `${id}-g${group.index}` : undefined}
                  className="ui-cbxc__group"
                >
                  {group.label && (
                    <div className="ui-cbxc__group-label" id={`${id}-g${group.index}`}>
                      {group.label}
                    </div>
                  )}
                  {group.options.map((option) => {
                    const index = cursor++;
                    const isOn = selected.includes(option.value);
                    return (
                      <div
                        key={option.value}
                        id={`${id}-o${index}`}
                        role="option"
                        aria-selected={isOn}
                        data-active={index === activeIndex ? "true" : undefined}
                        className="ui-cbxc__option"
                        onMouseDown={(event) => event.preventDefault()}
                        onPointerEnter={() => setActive(index)}
                        onClick={() => toggle(option)}
                      >
                        <OptionLead option={option} />
                        <span className="ui-cbxc__text">
                          <span className="ui-cbxc__name">
                            <Highlighted text={option.label} query={query} />
                          </span>
                          {option.hint && (
                            <span className="ui-cbxc__hint">
                              <Highlighted text={option.hint} query={query} />
                            </span>
                          )}
                        </span>
                        <svg viewBox="0 0 24 24" className="ui-cbxc__glyph ui-cbxc__check" aria-hidden="true">
                          <path d="M5.5 12.5l4 4L18.5 8" />
                        </svg>
                      </div>
                    );
                  })}
                </div>
              ))}

              {canCreate &&
                (() => {
                  const index = cursor++;
                  return (
                    <div
                      id={`${id}-o${index}`}
                      role="option"
                      aria-selected={false}
                      data-active={index === activeIndex ? "true" : undefined}
                      className="ui-cbxc__option ui-cbxc__create"
                      onMouseDown={(event) => event.preventDefault()}
                      onPointerEnter={() => setActive(index)}
                      onClick={() => create(needle)}
                    >
                      <span className="ui-cbxc__plus" aria-hidden="true">
                        <svg viewBox="0 0 24 24" className="ui-cbxc__glyph">
                          <path d="M12 5.5v13M5.5 12h13" />
                        </svg>
                      </span>
                      <span className="ui-cbxc__text">
                        <span className="ui-cbxc__name">{createLabel(needle)}</span>
                      </span>
                    </div>
                  );
                })()}

              {rows.length === 0 && <div className="ui-cbxc__empty">{emptyText}</div>}
            </div>
          </div>

          <div className="ui-cbxc__foot" aria-hidden="true">
            <span className="ui-cbxc__count">
              <span className="ui-cbxc__roll"><span key={selected.length} data-dir={grew ? "up" : "down"}>{selected.length}</span></span>
              &nbsp;selected
            </span>
            <span className="ui-cbxc__keys">
              <kbd>↑</kbd>
              <kbd>↓</kbd>
              <span>to move</span>
              <kbd>↵</kbd>
              <span>{multiple ? "to toggle" : "to pick"}</span>
            </span>
          </div>
        </div>
      )}

      <span className="ui-cbxc__live" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}

const css = /* css */ `
.ui-cbxc{--ui-cbxc-card: #fffdfb;--ui-cbxc-ink: rgba(11, 9, 8, 0.88);--ui-cbxc-strong: #0b0908;--ui-cbxc-text: rgba(11, 9, 8, 0.61);--ui-cbxc-muted: rgba(11, 9, 8, 0.45);--ui-cbxc-faint: rgba(11, 9, 8, 0.27);--ui-cbxc-icon: rgba(11, 9, 8, 0.447);--ui-cbxc-line: rgba(11, 9, 8, 0.06);--ui-cbxc-fill: rgba(11, 9, 8, 0.06);--ui-cbxc-fill-strong: rgba(11, 9, 8, 0.1);--ui-cbxc-wash: rgba(11, 9, 8, 0.03);--ui-cbxc-flash: rgba(11, 9, 8, 0.14);--ui-cbxc-avatar: rgba(11, 9, 8, 0.06);--ui-cbxc-mark: rgba(217, 84, 31, 0.12);--ui-cbxc-accent: rgba(217, 84, 31, 0.765);--ui-cbxc-focus: rgba(217, 84, 31, 0.35);--ui-cbxc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-cbxc-shadow-hover: 0 0 0 0.5px rgba(11, 9, 8, 0.12), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-cbxc-shadow-pop: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 12px 28px -10px rgba(11, 9, 8, 0.16), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-cbxc-ease: cubic-bezier(0.22, 1, 0.36, 1);--ui-cbxc-spring: cubic-bezier(0.34, 1.56, 0.64, 1);position: relative;display: block;width: 100%;max-width: 440px;container-type: inline-size;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;font-weight: 400;color: var(--ui-cbxc-ink);-webkit-font-smoothing: antialiased}
.ui-cbxc *, .ui-cbxc *::before, .ui-cbxc *::after{box-sizing: border-box}
:where(.ui-cbxc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;cursor: pointer}
:where(.ui-cbxc) svg{display: block;flex: none}
.ui-cbxc__glyph{width: 16px;height: 16px;fill: none;stroke: currentColor;stroke-width: 1.65;stroke-linecap: round;stroke-linejoin: round}
.ui-cbxc__label{display: block;margin: 0 0 6px 2px;font-size: 12px;line-height: 16px;font-weight: 500;color: var(--ui-cbxc-text)}
.ui-cbxc__field{position: relative;overflow: hidden;border-radius: 8px;background: var(--ui-cbxc-card);box-shadow: var(--ui-cbxc-shadow);cursor: text;transition: height var(--nm-dur-3, 240ms) var(--ui-cbxc-ease), box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cbxc__field:hover{box-shadow: var(--ui-cbxc-shadow-hover)}
.ui-cbxc__field:focus-within{outline: 2px solid var(--ui-cbxc-focus);outline-offset: 1px}
.ui-cbxc__field-inner{position: relative;display: flex;flex-wrap: nowrap;align-items: center;min-height: 32px;padding: 4px 32px 4px 4px;overflow: hidden}
.ui-cbxc__measure{position: absolute;top: 0;left: 0;display: flex;width: max-content;margin: 0;padding: 0;list-style: none;visibility: hidden;pointer-events: none;white-space: nowrap}
.ui-cbxc__chips > .ui-cbxc__chip{flex: none}
.ui-cbxc__measure > .ui-cbxc__chip{flex: none;max-width: none}
.ui-cbxc__chips{display: contents;margin: 0;padding: 0;list-style: none}
.ui-cbxc__chip{display: grid;grid-template-columns: 1fr;min-width: 0;max-width: 100%;overflow: hidden;margin-right: 4px;transition: grid-template-columns var(--nm-dur-3, 240ms) var(--ui-cbxc-ease) 160ms, margin-right var(--nm-dur-3, 240ms) var(--ui-cbxc-ease) 160ms, opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 140ms}
.ui-cbxc__chip[data-leaving]{grid-template-columns: 0fr;margin-right: 0;opacity: 0;pointer-events: none}
.ui-cbxc__chip-body{display: inline-flex;align-items: center;gap: 6px;min-width: 0;height: 24px;overflow: hidden;padding: 0 2px 0 4px;border-radius: 6px;background: var(--ui-cbxc-fill);white-space: nowrap;font-size: 12px;line-height: 16px;font-weight: 500;color: var(--ui-cbxc-ink);transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cbxc__chip[data-plain] .ui-cbxc__chip-body{padding-left: 8px}
.ui-cbxc__chip[data-armed] .ui-cbxc__chip-body{background: var(--ui-cbxc-fill-strong);box-shadow: inset 0 0 0 0.5px var(--ui-cbxc-faint)}
.ui-cbxc__chip[data-leaving] .ui-cbxc__chip-body{animation: ui-cbxc-flash var(--nm-dur-3, 240ms) ease-out both}
.ui-cbxc__chip-label{min-width: 0;max-width: 168px;overflow: hidden;text-overflow: ellipsis}
.ui-cbxc__chip-x{display: grid;place-items: center;flex: none;width: 18px;height: 18px;border-radius: 4px;color: var(--ui-cbxc-icon);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cbxc__chip-x:hover{background: var(--ui-cbxc-fill);color: var(--ui-cbxc-ink)}
.ui-cbxc__chip-x .ui-cbxc__glyph{width: 12px;height: 12px;stroke-width: 1.9}
.ui-cbxc__chip .ui-cbxc__avatar{width: 16px;height: 16px;font-size: 7px;background: var(--ui-cbxc-card);box-shadow: 0 0 0 0.5px var(--ui-cbxc-line)}
.ui-cbxc__chip .ui-cbxc__dot{margin: 0 1px 0 2px}
.ui-cbxc__chip .ui-cbxc__icon{width: 16px;height: 16px}
.ui-cbxc__more .ui-cbxc__chip-body{padding: 0 8px;gap: 0;color: var(--ui-cbxc-text);font-variant-numeric: tabular-nums}
.ui-cbxc__more{transition-delay: 0ms}
.ui-cbxc__more[data-hidden]{grid-template-columns: 0fr;margin-right: 0;opacity: 0}
.ui-cbxc__roll{display: inline-grid;overflow: hidden}
.ui-cbxc__roll > span{animation: ui-cbxc-roll-up var(--nm-dur-3, 240ms) var(--ui-cbxc-ease) both}
.ui-cbxc__roll > span[data-dir="down"]{animation-name: ui-cbxc-roll-down}
.ui-cbxc__input{flex: 1 0 72px;min-width: 72px;height: 24px;margin: 0;padding: 0 4px 0 6px;border: 0;background: transparent;font: inherit;color: var(--ui-cbxc-ink);outline: none}
.ui-cbxc__input::placeholder{color: var(--ui-cbxc-faint)}
.ui-cbxc__toggle{position: absolute;top: 4px;right: 4px;display: grid;place-items: center;width: 24px;height: 24px;border-radius: 6px;color: var(--ui-cbxc-icon);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cbxc__toggle:hover{background: var(--ui-cbxc-wash);color: var(--ui-cbxc-ink)}
.ui-cbxc__toggle .ui-cbxc__glyph{transition: transform var(--nm-dur-3, 240ms) var(--ui-cbxc-ease)}
.ui-cbxc[data-open] .ui-cbxc__toggle .ui-cbxc__glyph{transform: rotate(180deg)}
.ui-cbxc__avatar{display: grid;place-items: center;flex: none;width: 20px;height: 20px;border-radius: 50%;object-fit: cover;background: var(--ui-cbxc-avatar);color: var(--ui-cbxc-text);font-size: 8px;line-height: 1;font-weight: 500;letter-spacing: 0.02em}
.ui-cbxc__dot{flex: none;width: 8px;height: 8px;margin: 0 4px;border-radius: 50%}
.ui-cbxc__icon{display: grid;place-items: center;flex: none;width: 20px;height: 20px;color: var(--ui-cbxc-icon)}
.ui-cbxc__icon svg{width: 16px;height: 16px}
.ui-cbxc__pop{position: absolute;z-index: 30;top: calc(100% + 6px);left: 0;right: 0;overflow: hidden;border-radius: 10px;background: var(--ui-cbxc-card);box-shadow: var(--ui-cbxc-shadow-pop);transform-origin: top center;animation: ui-cbxc-open 240ms var(--ui-cbxc-ease) both}
.ui-cbxc__list{position: relative;max-height: 300px;padding: 4px;overflow-y: auto;overscroll-behavior: contain;scrollbar-width: thin;transition: height var(--nm-dur-3, 240ms) var(--ui-cbxc-ease)}
.ui-cbxc__pill{position: absolute;top: 0;left: 4px;right: 4px;border-radius: 6px;background: var(--ui-cbxc-fill);opacity: 0;pointer-events: none;transition: transform 90ms ease-out, height 90ms ease-out, opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cbxc__group-label{padding: 8px 8px 4px;font-size: 10px;line-height: 16px;font-weight: 500;letter-spacing: 0.5px;text-transform: uppercase;color: var(--ui-cbxc-muted)}
.ui-cbxc__group:first-child .ui-cbxc__group-label{padding-top: 4px}
.ui-cbxc__option{position: relative;display: flex;align-items: center;gap: 8px;height: 32px;padding: 0 8px;border-radius: 6px;cursor: pointer;user-select: none;-webkit-tap-highlight-color: transparent}
.ui-cbxc__text{display: flex;flex: 1;align-items: baseline;gap: 8px;min-width: 0}
.ui-cbxc__name{flex: 0 0 auto;max-width: 100%;min-width: 0;overflow: hidden;color: var(--ui-cbxc-ink);white-space: nowrap;text-overflow: ellipsis}
.ui-cbxc__hint{flex: 0 100 auto;min-width: 0;overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-cbxc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-cbxc mark{border-radius: 3px;background: var(--ui-cbxc-mark);color: inherit}
.ui-cbxc__check{width: 16px;height: 16px;margin-left: auto;color: var(--ui-cbxc-accent);stroke-width: 1.8;opacity: 0;transform: scale(0.4);transition: opacity var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cbxc__option[aria-selected="true"] .ui-cbxc__check{opacity: 1;transform: none;transition: opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 380ms var(--ui-cbxc-spring)}
.ui-cbxc__empty{padding: 12px 8px 10px;text-align: center;color: var(--ui-cbxc-muted);animation: ui-cbxc-in 240ms var(--ui-cbxc-ease) both}
.ui-cbxc__create{animation: ui-cbxc-in 240ms var(--ui-cbxc-ease) both}
.ui-cbxc__plus{display: grid;place-items: center;flex: none;width: 20px;height: 20px;border-radius: 6px;color: var(--ui-cbxc-icon);box-shadow: inset 0 0 0 0.5px var(--ui-cbxc-fill-strong)}
.ui-cbxc__plus .ui-cbxc__glyph{width: 12px;height: 12px;stroke-width: 1.9}
.ui-cbxc__foot{display: flex;align-items: center;justify-content: space-between;gap: 12px;height: 32px;padding: 0 12px;border-top: 0.5px solid var(--ui-cbxc-line);font-size: 12px;line-height: 16px;color: var(--ui-cbxc-muted)}
.ui-cbxc__count{display: inline-flex;font-variant-numeric: tabular-nums}
.ui-cbxc__keys{display: inline-flex;align-items: center;gap: 2px;white-space: nowrap}
.ui-cbxc kbd{display: inline-grid;place-items: center;min-width: 16px;height: 16px;padding: 0 4px;border-radius: 4px;background: var(--ui-cbxc-card);box-shadow: var(--ui-cbxc-shadow);font-family: inherit;font-size: 10px;line-height: 16px;font-weight: 500;color: var(--ui-cbxc-text)}
.ui-cbxc__keys > span{margin: 0 6px 0 2px}
.ui-cbxc__keys > span:last-child{margin-right: 0}
.ui-cbxc__live{position: absolute;width: 1px;height: 1px;overflow: hidden;clip-path: inset(50%);white-space: nowrap}
@keyframes ui-cbxc-open{from{opacity: 0;transform: translateY(-4px) scale(0.98)}
to{opacity: 1;transform: none}
}
@keyframes ui-cbxc-in{from{opacity: 0;transform: translateY(3px)}
to{opacity: 1;transform: none}
}
@keyframes ui-cbxc-flash{0%{background-color: var(--ui-cbxc-fill)}
35%{background-color: var(--ui-cbxc-flash)}
100%{background-color: var(--ui-cbxc-flash);transform: scale(0.92)}
}
@keyframes ui-cbxc-roll-up{from{opacity: 0;transform: translateY(70%)}
to{opacity: 1;transform: none}
}
@keyframes ui-cbxc-roll-down{from{opacity: 0;transform: translateY(-70%)}
to{opacity: 1;transform: none}
}
@container (max-width: 380px){.ui-cbxc__keys{display: none}
.ui-cbxc__chip-label{max-width: 132px}
.ui-cbxc__input{flex-basis: 44px;min-width: 44px}
}
@media (hover: none) and (pointer: coarse){.ui-cbxc__field-inner{min-height: 40px;padding: 4px 40px 4px 4px}
.ui-cbxc__chip-body{height: 32px}
.ui-cbxc__chip-x{width: 26px;height: 26px}
.ui-cbxc__input{height: 32px;font-size: 16px}
.ui-cbxc__toggle{width: 32px;height: 32px}
.ui-cbxc__option{height: 44px}
.ui-cbxc__list{max-height: 340px}
.ui-cbxc__keys{display: none}
}
@media (prefers-reduced-motion: reduce){.ui-cbxc *, .ui-cbxc *::before, .ui-cbxc *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-cbxc{--ui-cbxc-card: #211b16;--ui-cbxc-ink: rgba(255, 253, 251, 0.9);--ui-cbxc-strong: #fffdfb;--ui-cbxc-text: rgba(255, 253, 251, 0.62);--ui-cbxc-muted: rgba(255, 253, 251, 0.46);--ui-cbxc-faint: rgba(255, 253, 251, 0.3);--ui-cbxc-icon: rgba(255, 253, 251, 0.5);--ui-cbxc-line: rgba(255, 253, 251, 0.08);--ui-cbxc-fill: rgba(255, 253, 251, 0.08);--ui-cbxc-fill-strong: rgba(255, 253, 251, 0.13);--ui-cbxc-wash: rgba(255, 253, 251, 0.04);--ui-cbxc-flash: rgba(255, 253, 251, 0.18);--ui-cbxc-avatar: rgba(255, 253, 251, 0.08);--ui-cbxc-mark: rgba(255, 138, 92, 0.24);--ui-cbxc-accent: #ff8a5c;--ui-cbxc-focus: rgba(255, 138, 92, 0.5);--ui-cbxc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-cbxc-shadow-hover: 0 0 0 0.5px rgba(255, 253, 251, 0.16), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-cbxc-shadow-pop: 0 0 0 0.5px rgba(255, 253, 251, 0.12), 0 12px 28px -10px rgba(11, 9, 8, 0.6)}

`;
