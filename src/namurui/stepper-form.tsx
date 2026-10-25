"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/*
 * Stepper Form – a multi-step flow for onboarding and setup, in a single self-contained file.
 * The rail at the top is a list of steps: the current one fills its bar, finished ones swap their
 * number for a check that draws itself in, and a finished step is a button that walks back.
 * The card glides to the height of the step inside it while the new step slides in from the side
 * you are heading to and the old one slides out the other way; on narrow containers the rail
 * collapses to "Step 2 of 4 · Team" for the eye but stays whole for a screen reader.
 * Continue validates inline: a broken field shakes once, folds its message open and takes the
 * focus, and the button stays dimmed but answering while the step is incomplete. The last step
 * submits to a promise, then the footer folds away and the success view pops in.
 * The styles are injected below, so no extra files are needed.
 */

/** Values, setters and navigation handed to a step's render. */
export type StepperContext<V> = {
  /** Values shared by every step – Back and Edit keep them */
  values: V;
  /** Merge a patch into the values */
  setValues: (patch: Partial<V>) => void;
  /** Messages returned by this step's validate, by field name */
  errors: Record<string, string | undefined>;
  /** Jump to a step by index or by id */
  goTo: (step: number | string) => void;
  /** Validate and move on – the same thing Continue does */
  next: () => void;
};

export type Step<V> = {
  /** Stable id – review rows use it with goTo */
  id: string;
  /** Short name in the step list */
  title: string;
  /** Heading of the step – defaults to the title */
  heading?: string;
  /** A muted line under the heading */
  description?: string;
  /** The step's fields, built from StepperField, StepperChoices or StepperReview */
  render: (context: StepperContext<V>) => ReactNode;
  /** Returns a message per field name; anything falsy means valid */
  validate?: (values: V) => Record<string, string | undefined> | void;
};

export type StepperFormProps<V extends object> = {
  /** The steps in order – ids keep Back and Edit in place */
  steps: Step<V>[];
  /** Values shared by every step */
  initialValues: V;
  /** The work behind the last step's button – a promise keeps the busy label until it settles */
  onSubmit?: (values: V) => void | Promise<void>;
  /** Runs once onSubmit has settled, e.g. to close a dialog or move on; the success view follows it */
  onComplete?: (values: V) => void | Promise<void>;
  /** Index of the first step shown */
  initialStep?: number;
  /** Controlled step index – pair with onStepChange */
  step?: number;
  /** Called whenever the step changes */
  onStepChange?: (step: number) => void;
  /** Label of the button on the last step */
  submitLabel?: string;
  /** Label while onSubmit and onComplete run */
  submittingLabel?: string;
  /** Replaces the steps once done – StepperSuccess gives the popping check, a heading and a line */
  success?: (values: V, reset: () => void) => ReactNode;
  /** Extra class on the root */
  className?: string;
};

export type StepperFieldProps = {
  /** Field name the step's validate uses */
  name: string;
  /** Label above the control */
  label: string;
  /** A muted line under the control */
  hint?: string;
  /** Shows a small "Optional" tag and never blocks Continue */
  optional?: boolean;
  /** The control – StepperInput, StepperTags or your own */
  children: ReactNode;
};

export type StepperInputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Fixed text in front of the field, e.g. "affect.app/" */
  prefix?: string;
};

export type StepperTagsProps = {
  /** The entries as chips */
  value: string[];
  onChange: (value: string[]) => void;
  /** Message for the current entries, e.g. a duplicate check */
  validate?: (value: string[]) => string | undefined;
  /** Most entries allowed, emails by default */
  max?: number;
  placeholder?: string;
};

export type StepperChoiceOption = {
  value: string;
  title: string;
  /** Text under the title, e.g. a price */
  aside?: ReactNode;
  description?: string;
  badge?: ReactNode;
};

export type StepperChoicesProps = {
  /** Group label above the cards */
  label: string;
  /** The picked option */
  value: string;
  onChange: (value: string) => void;
  /** Cards to pick from – a radio group with a gliding ring */
  options: StepperChoiceOption[];
};

export type StepperReviewRow = {
  label: string;
  value: ReactNode;
  /** A step id – shows an Edit link when onEdit is given */
  step?: string;
};

export type StepperReviewProps = {
  /** Summary rows, in order */
  rows: StepperReviewRow[];
  /** Called with the step id of the row that was edited – usually goTo */
  onEdit?: (step: string) => void;
};

export type StepperSuccessProps = {
  /** Heading under the popping check */
  title?: string;
  /** One line under the heading */
  description?: string;
  /** The actions, laid out in a centered row */
  children?: ReactNode;
};

/** What the fields in the current step read and register into. */
type FieldState = {
  errors: Record<string, string | undefined>;
  invalid: string | null;
  shake: number;
  register: (name: string, node: HTMLElement) => () => void;
  next: () => void;
};

type FieldBinding = {
  id: string;
  error?: string;
  describedBy?: string;
};

const FieldStateContext = createContext<FieldState>({
  errors: {},
  invalid: null,
  shake: 0,
  register: () => () => {},
  next: () => {},
});

const FieldContext = createContext<FieldBinding | null>(null);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** The check that draws itself in – rail marks and the success view share it. */
function DrawnCheck() {
  return (
    <svg viewBox="0 0 24 24" className="ui-sfc__draw" aria-hidden="true">
      <path d="M5 12.5l4.4 4.4L19 7.2" pathLength="1" />
    </svg>
  );
}

export function StepperField({ name, label, hint, optional = false, children }: StepperFieldProps) {
  const { errors, invalid, shake, register } = useContext(FieldStateContext);
  const error = errors[name];
  const uid = useId();
  const msgId = `${uid}-msg`;
  const hintId = `${uid}-hint`;
  const describedBy = [hint ? hintId : null, error ? msgId : null].filter(Boolean).join(" ") || undefined;
  const controlRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = controlRef.current;
    if (!node) return;
    return register(name, node);
  }, [register, name]);

  useEffect(() => {
    if (!shake || invalid !== name) return;
    const box = controlRef.current?.firstElementChild;
    if (!box || window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof box.animate !== "function") return;
    box.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-5px)" },
        { transform: "translateX(4px)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(2px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 320, easing: "ease-in-out" },
    );
  }, [shake, invalid, name]);

  return (
    <div className="ui-sfc__field">
      <label className="ui-sfc__label" htmlFor={uid}>
        {label}
        {optional ? <span className="ui-sfc__optional">Optional</span> : null}
      </label>
      <div className="ui-sfc__control" ref={controlRef}>
        <FieldContext.Provider value={{ id: uid, error, describedBy }}>{children}</FieldContext.Provider>
      </div>
      <div className="ui-sfc__fold" data-open={error ? "true" : undefined}>
        <div>
          <p className="ui-sfc__msg" id={msgId} key={error ?? "empty"}>
            {error}
          </p>
        </div>
      </div>
      {hint ? (
        <div className="ui-sfc__fold" data-open="true">
          <div>
            <p className="ui-sfc__hint" id={hintId}>
              {hint}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function StepperInput({ prefix, className, id, autoComplete = "off", spellCheck = false, ...rest }: StepperInputProps) {
  const field = useContext(FieldContext);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="ui-sfc__input" data-invalid={field?.error ? "true" : undefined} onClick={() => inputRef.current?.focus()}>
      {prefix ? (
        <span className="ui-sfc__prefix" aria-hidden="true">
          {prefix}
        </span>
      ) : null}
      <input
        {...rest}
        ref={inputRef}
        id={id ?? field?.id}
        className={className}
        autoComplete={autoComplete}
        spellCheck={spellCheck}
        aria-invalid={field?.error ? true : undefined}
        aria-describedby={field?.describedBy}
      />
    </div>
  );
}

export function StepperTags({
  value,
  onChange,
  validate,
  max = 8,
  placeholder = "name@company.com",
}: StepperTagsProps) {
  const field = useContext(FieldContext);
  const [draft, setDraft] = useState("");
  const [localError, setLocalError] = useState<string | undefined>(undefined);
  const [leaving, setLeaving] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const msgId = `${useId()}-tags-msg`;
  const message = localError ?? validate?.(value);
  const full = value.length >= max;
  const describedBy = [field?.describedBy, message ? msgId : null].filter(Boolean).join(" ") || undefined;

  const commit = (raw: string) => {
    const entries = raw
      .split(/[,;\n]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (!entries.length) return;
    const next = [...value];
    let problem: string | undefined;
    for (const entry of entries) {
      if (next.length >= max) {
        problem = `Up to ${max} addresses`;
        break;
      }
      if (!EMAIL.test(entry)) {
        problem = `“${entry}” is not an email address`;
        continue;
      }
      if (!next.some((existing) => existing.toLowerCase() === entry.toLowerCase())) next.push(entry);
    }
    setLocalError(problem);
    if (next.length !== value.length) onChange(next);
    if (!problem) setDraft("");
  };

  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  const removeAt = (index: number) => {
    const entry = value[index];
    if (entry === undefined) return;
    const node = boxRef.current?.querySelectorAll<HTMLElement>(".ui-sfc__chip")[index];
    setLocalError(undefined);
    const drop = () => {
      onChange(latest.current.filter((candidate) => candidate !== entry));
      setLeaving(null);
    };
    if (!node || typeof node.animate !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      drop();
      return;
    }
    setLeaving(entry);
    const animation = node.animate(
      [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "scale(0.85)" },
      ],
      { duration: 180, easing: "ease-in", fill: "forwards" },
    );
    void animation.finished.then(drop, drop);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      if (!draft.trim()) return;
      event.preventDefault();
      commit(draft);
      return;
    }
    if (event.key === ",") {
      event.preventDefault();
      commit(draft);
      return;
    }
    if (event.key === "Backspace" && !draft && value.length) {
      event.preventDefault();
      removeAt(value.length - 1);
    }
  };

  return (
    <>
      <div
        className="ui-sfc__tags"
        data-invalid={field?.error || message ? "true" : undefined}
        ref={boxRef}
        onClick={() => inputRef.current?.focus()}
      >
        <ul className="ui-sfc__chips">
          {value.map((entry, index) => (
            <li className="ui-sfc__chip" key={entry} data-leaving={leaving === entry ? "true" : undefined}>
              <span className="ui-sfc__chip-text">{entry}</span>
              <button
                type="button"
                className="ui-sfc__chip-x"
                aria-label={`Remove ${entry}`}
                onClick={(event) => {
                  event.stopPropagation();
                  removeAt(index);
                }}
              >
                <svg viewBox="0 0 24 24" className="ui-sfc__glyph" aria-hidden="true">
                  <path d="M7 7l10 10M17 7L7 17" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
        <input
          ref={inputRef}
          id={field?.id}
          className="ui-sfc__tags-input"
          value={draft}
          autoComplete="off"
          spellCheck={false}
          placeholder={full ? `Up to ${max} addresses` : value.length ? "" : placeholder}
          aria-invalid={field?.error || message ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => {
            setDraft(event.target.value);
            if (localError) setLocalError(undefined);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (draft.trim()) commit(draft);
          }}
          onPaste={(event) => {
            const text = event.clipboardData.getData("text");
            if (/[,;\n]/.test(text)) {
              event.preventDefault();
              commit(text);
            }
          }}
        />
      </div>
      {message ? (
        <div className="ui-sfc__fold" data-open="true">
          <div>
            <p className="ui-sfc__msg" id={msgId}>
              {message}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function StepperChoices({ label, value, onChange, options }: StepperChoicesProps) {
  const { next } = useContext(FieldStateContext);
  const groupRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const [ring, setRing] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const activeIndex = options.findIndex((option) => option.value === value);
  const tabbable = activeIndex >= 0 ? activeIndex : 0;

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const measure = () => {
      const active = group.querySelector<HTMLElement>('[aria-checked="true"]');
      if (!active) {
        setRing(null);
        return;
      }
      const box = group.getBoundingClientRect();
      const rect = active.getBoundingClientRect();
      setRing((previous) => {
        const next = { x: rect.left - box.left, y: rect.top - box.top, width: rect.width, height: rect.height };
        const same =
          previous &&
          Math.abs(previous.x - next.x) < 0.5 &&
          Math.abs(previous.y - next.y) < 0.5 &&
          Math.abs(previous.width - next.width) < 0.5 &&
          Math.abs(previous.height - next.height) < 0.5;
        return same ? previous : next;
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    return () => observer.disconnect();
  }, [value, options.length]);

  const pick = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')[index]?.focus();
  };

  return (
    <div className="ui-sfc__field">
      <span className="ui-sfc__label" id={labelId}>
        {label}
      </span>
      <div className="ui-sfc__control">
        <div className="ui-sfc__choices" role="radiogroup" aria-labelledby={labelId} ref={groupRef}>
          <span
            className="ui-sfc__ring"
            aria-hidden="true"
            style={
              ring
                ? {
                    transform: `translate(${ring.x}px, ${ring.y}px)`,
                    width: ring.width,
                    height: ring.height,
                    opacity: 1,
                  }
                : undefined
            }
          />
          {options.map((option, index) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={index === tabbable ? 0 : -1}
                className="ui-sfc__choice"
                onClick={() => onChange(option.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                    event.preventDefault();
                    pick(Math.min(options.length - 1, index + 1));
                  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                    event.preventDefault();
                    pick(Math.max(0, index - 1));
                  } else if (event.key === " ") {
                    event.preventDefault();
                    onChange(option.value);
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    onChange(option.value);
                    next();
                  }
                }}
              >
                <span className="ui-sfc__choice-top">
                  <span className="ui-sfc__choice-title">{option.title}</span>
                  {option.badge ? <span className="ui-sfc__badge">{option.badge}</span> : null}
                  <span className="ui-sfc__radio" aria-hidden="true" />
                </span>
                {option.aside ? <span className="ui-sfc__choice-aside">{option.aside}</span> : null}
                {option.description ? <span className="ui-sfc__choice-desc">{option.description}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function StepperReview({ rows, onEdit }: StepperReviewProps) {
  return (
    <dl className="ui-sfc__review">
      {rows.map((row, index) => {
        const step = row.step;
        return (
          <div className="ui-sfc__review-row" key={`${row.label}-${index}`}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
            {step !== undefined && onEdit ? (
              <button type="button" className="ui-sfc__edit" aria-label={`Edit ${row.label}`} onClick={() => onEdit(step)}>
                Edit
              </button>
            ) : null}
          </div>
        );
      })}
    </dl>
  );
}

export function StepperSuccess({
  title = "You’re all set",
  description = "Everything is ready – you can change any of it later in settings.",
  children,
}: StepperSuccessProps) {
  return (
    <div className="ui-sfc__success">
      <span className="ui-sfc__success-check" aria-hidden="true">
        <DrawnCheck />
      </span>
      <h2 className="ui-sfc__heading" tabIndex={-1}>
        {title}
      </h2>
      <p className="ui-sfc__desc">{description}</p>
      {children ? <div className="ui-sfc__success-actions">{children}</div> : null}
    </div>
  );
}

export function StepperForm<V extends object>({
  steps,
  initialValues,
  onSubmit,
  onComplete,
  initialStep = 0,
  step,
  onStepChange,
  submitLabel = "Finish",
  submittingLabel = "Creating…",
  success,
  className,
}: StepperFormProps<V>) {
  const uid = useId();
  const headingId = `${uid}-h0`;

  const [values, setValuesState] = useState<V>(initialValues);
  const [innerStep, setInnerStep] = useState(initialStep);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [invalid, setInvalid] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [height, setHeight] = useState<number | null>(null);
  const [announce, setAnnounce] = useState("");
  const [btnWidth, setBtnWidth] = useState<number | undefined>(undefined);

  const viewportRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const controls = useRef(new Map<string, HTMLElement>());
  const navigated = useRef(false);

  const last = steps.length - 1;
  const current = Math.max(0, Math.min(last, step !== undefined ? step : innerStep));
  const definition = steps[current];

  const setValues = (patch: Partial<V>) => {
    setValuesState((previous) => Object.assign({}, previous, patch));
  };

  const register = useCallback((name: string, node: HTMLElement) => {
    controls.current.set(name, node);
    return () => {
      if (controls.current.get(name) === node) controls.current.delete(name);
    };
  }, []);

  const focusField = (name: string) => {
    const box = controls.current.get(name);
    if (!box) return;
    const target = box.querySelector<HTMLElement>("input, textarea, select, button, [tabindex]");
    target?.focus({ preventScroll: true });
  };

  const go = (index: number, direction: 1 | -1) => {
    const target = Math.max(0, Math.min(last, index));
    if (target === current) return;
    setLeaving(current);
    setDir(direction);
    setErrors({});
    setInvalid(null);
    setSubmitError(null);
    setDone(false);
    navigated.current = true;
    setInnerStep(target);
    onStepChange?.(target);
  };

  const goTo = (target: number | string) => {
    const index = typeof target === "number" ? target : steps.findIndex((entry) => entry.id === target);
    if (index < 0) return;
    go(index, index < current ? -1 : 1);
  };

  const next = () => {
    if (!definition?.validate) {
      advance();
      return;
    }
    const result = definition.validate(values) ?? {};
    const cleaned: Record<string, string | undefined> = {};
    for (const key of Object.keys(result)) {
      const message = result[key];
      if (message) cleaned[key] = message;
    }
    setErrors(cleaned);
    const first = Object.keys(cleaned)[0];
    setInvalid(first ?? null);
    if (first) {
      setShake((count) => count + 1);
      focusField(first);
      setAnnounce(`${cleaned[first]}. Step ${current + 1} of ${steps.length}.`);
      return;
    }
    advance();
  };

  const advance = () => {
    if (current === last) {
      void submit();
      return;
    }
    go(current + 1, 1);
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit?.(values);
      await onComplete?.(values);
      setDone(true);
      setAnnounce("Done");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Something went wrong – try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setValuesState(initialValues);
    setErrors({});
    setInvalid(null);
    setSubmitError(null);
    setDone(false);
    setInnerStep(initialStep);
    onStepChange?.(initialStep);
  };

  useEffect(() => {
    if (leaving === null) return;
    const timer = window.setTimeout(() => setLeaving(null), 300);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  useEffect(() => {
    if (!navigated.current) return;
    setAnnounce(`Step ${current + 1} of ${steps.length}: ${steps[current]?.title ?? ""}`);
  }, [current, steps.length]);

  useLayoutEffect(() => {
    if (!navigated.current) return;
    const pane = paneRef.current;
    if (!pane) return;
    const field = pane.querySelector<HTMLElement>(".ui-sfc__input input, .ui-sfc__tags-input, .ui-sfc__choice");
    const heading = pane.querySelector<HTMLElement>(".ui-sfc__heading");
    (field ?? heading)?.focus({ preventScroll: true });
  }, [current]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const currentPane = viewport.querySelector<HTMLElement>('.ui-sfc__pane[data-pane="current"]');
    const first = viewport.firstElementChild;
    const target = currentPane ?? (first instanceof HTMLElement ? first : null);
    if (!target) return;
    const measure = () => setHeight(target.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    return () => observer.disconnect();
  }, [current, done]);

  useLayoutEffect(() => {
    if (!done) return;
    viewportRef.current
      ?.querySelector<HTMLElement>(".ui-sfc__success h1, .ui-sfc__success h2, .ui-sfc__success h3")
      ?.focus({ preventScroll: true });
  }, [done]);

  const label = submitting ? submittingLabel : current === last ? submitLabel : "Continue";

  useLayoutEffect(() => {
    const node = innerRef.current;
    if (!node) return;
    setBtnWidth(node.offsetWidth);
  }, [label]);

  const pending = definition?.validate?.(values) ?? {};
  const ready = Object.values(pending).every((message) => !message);
  const context: StepperContext<V> = { values, setValues, errors, goTo, next };

  const paneFor = (index: number, kind: "current" | "leaving") => {
    const source = steps[index];
    if (!source) return null;
    return (
      <div
        className="ui-sfc__pane"
        key={`${kind}-${index}`}
        data-pane={kind}
        data-dir={dir}
        data-first={kind === "current" && !navigated.current ? "true" : undefined}
        ref={kind === "current" ? paneRef : undefined}
      >
        <h2
          className="ui-sfc__heading"
          tabIndex={-1}
          id={kind === "current" ? headingId : undefined}
        >
          {source.heading ?? source.title}
        </h2>
        {source.description ? <p className="ui-sfc__desc">{source.description}</p> : null}
        <div className="ui-sfc__body">{source.render(context)}</div>
      </div>
    );
  };

  return (
    <div className={["ui-sfc", className].filter(Boolean).join(" ")} style={{ "--ui-sfc-n": steps.length } as CSSProperties}>
      <style href="ui-stepper-form-clean" precedence="default">
        {css}
      </style>

      <div className="ui-sfc__head">
        <div className="ui-sfc__steps">
          <ol className="ui-sfc__list" aria-label="Progress">
            {steps.map((entry, index) => {
              const state = done || index < current ? "done" : index === current ? "current" : "upcoming";
              const body = (
                <>
                  <span className="ui-sfc__bar" aria-hidden="true" />
                  <span className="ui-sfc__mark">
                    {state === "done" ? <DrawnCheck /> : <span>{index + 1}</span>}
                  </span>
                  <span className="ui-sfc__step-label">{entry.title}</span>
                  <span className="ui-sfc__sr">{state === "current" ? " (current)" : ""}</span>
                </>
              );
              return (
                <li
                  className="ui-sfc__step"
                  key={entry.id}
                  data-state={state}
                  aria-current={state === "current" ? "step" : undefined}
                >
                  {state === "done" && !done ? (
                    <button
                      type="button"
                      className="ui-sfc__step-btn"
                      aria-label={`${entry.title}, completed – go back`}
                      onClick={() => goTo(index)}
                    >
                      {body}
                    </button>
                  ) : (
                    <span className="ui-sfc__step-btn">{body}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
        <div className="ui-sfc__compact" aria-hidden="true">
          <span className="ui-sfc__compact-text">
            Step {current + 1} of {steps.length}
            <span className="ui-sfc__compact-dot">·</span>
            <span className="ui-sfc__compact-title">{done ? "Done" : steps[current]?.title ?? ""}</span>
          </span>
        </div>
      </div>

      <form
        className="ui-sfc__card"
        noValidate
        aria-labelledby={done ? undefined : headingId}
        onSubmit={(event) => {
          event.preventDefault();
          if (!submitting) next();
        }}
      >
        <div className="ui-sfc__viewport" data-ready="1" style={height === null ? undefined : { height }}>
          <FieldStateContext.Provider value={{ errors, invalid, shake, register, next }}>
            {leaving !== null ? paneFor(leaving, "leaving") : null}
            {done
              ? (success ? success(values, reset) : (
                  <StepperSuccess>
                    <button type="button" className="ui-sfc__btn ui-sfc__btn-secondary" onClick={reset}>
                      Start over
                    </button>
                  </StepperSuccess>
                ))
              : paneFor(current, "current")}
          </FieldStateContext.Provider>
        </div>

        <div className="ui-sfc__foot-fold" data-hidden={done ? "true" : undefined}>
          <div className="ui-sfc__foot">
            <button
              type="button"
              className="ui-sfc__btn ui-sfc__btn-ghost"
              data-hidden={current === 0 ? "true" : undefined}
              disabled={current === 0}
              onClick={() => go(current - 1, -1)}
            >
              <svg viewBox="0 0 24 24" className="ui-sfc__glyph" aria-hidden="true">
                <path d="M14.5 6l-6 6 6 6" />
              </svg>
              Back
            </button>
            {submitError ? (
              <span className="ui-sfc__submit-error" role="alert">
                {submitError}
              </span>
            ) : null}
            <button
              type="submit"
              className="ui-sfc__btn ui-sfc__btn-primary"
              data-busy={submitting ? "true" : undefined}
              aria-disabled={ready ? undefined : "true"}
              style={btnWidth === undefined ? undefined : { width: btnWidth }}
            >
              <span className="ui-sfc__btn-inner" ref={innerRef}>
                {submitting ? <span className="ui-sfc__spinner" aria-hidden="true" /> : null}
                <span className="ui-sfc__btn-label">{label}</span>
              </span>
            </button>
          </div>
        </div>
      </form>

      <span className="ui-sfc__sr" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}

const css = /* css */ `
.ui-sfc{--ui-sfc-card: #fffdfb;--ui-sfc-ink: rgba(11, 9, 8, 0.88);--ui-sfc-strong: #0b0908;--ui-sfc-text: rgba(11, 9, 8, 0.61);--ui-sfc-muted: rgba(11, 9, 8, 0.45);--ui-sfc-faint: rgba(11, 9, 8, 0.27);--ui-sfc-icon: rgba(11, 9, 8, 0.447);--ui-sfc-line: rgba(11, 9, 8, 0.06);--ui-sfc-fill: rgba(11, 9, 8, 0.06);--ui-sfc-fill-strong: rgba(11, 9, 8, 0.1);--ui-sfc-wash: rgba(11, 9, 8, 0.03);--ui-sfc-wash-soft: rgba(11, 9, 8, 0.015);--ui-sfc-accent: rgba(217, 84, 31, 0.765);--ui-sfc-accent-soft: rgba(217, 84, 31, 0.08);--ui-sfc-accent-fill: rgba(217, 84, 31, 0.05);--ui-sfc-accent-line: rgba(217, 84, 31, 0.35);--ui-sfc-ok: #2f8d5c;--ui-sfc-ok-soft: rgba(47, 141, 92, 0.1);--ui-sfc-danger: #e2544a;--ui-sfc-danger-soft: rgba(226, 84, 74, 0.55);--ui-sfc-chip: rgba(11, 9, 8, 0.88);--ui-sfc-chip-hover: rgba(11, 9, 8, 0.8);--ui-sfc-on-chip: #fcf9f7;--ui-sfc-white-hover: #faf7f4;--ui-sfc-focus: rgba(217, 84, 31, 0.35);--ui-sfc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-sfc-shadow-hover: 0 0 0 0.5px rgba(11, 9, 8, 0.12), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-sfc-ease: cubic-bezier(0.22, 1, 0.36, 1);position: relative;box-sizing: border-box;container-type: inline-size;display: grid;width: 100%;max-width: 520px;border-radius: 10px;background: var(--ui-sfc-card);box-shadow: var(--ui-sfc-shadow);font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;font-weight: 400;color: var(--ui-sfc-ink);-webkit-font-smoothing: antialiased}
.ui-sfc *, .ui-sfc *::before, .ui-sfc *::after{box-sizing: border-box}
:where(.ui-sfc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;cursor: pointer}
:where(.ui-sfc) svg{display: block;flex: none}
:where(.ui-sfc) :is(h2, p, dl, dd, ul, ol){margin: 0}
.ui-sfc button:focus-visible{outline: 2px solid var(--ui-sfc-focus);outline-offset: 1px}
.ui-sfc__glyph{width: 16px;height: 16px;fill: none;stroke: currentColor;stroke-width: 1.65;stroke-linecap: round;stroke-linejoin: round}
.ui-sfc__sr{position: absolute;width: 1px;height: 1px;overflow: hidden;clip-path: inset(50%);white-space: nowrap}
.ui-sfc__draw{width: 14px;height: 14px;fill: none;stroke: currentColor;stroke-width: 2.2;stroke-linecap: round;stroke-linejoin: round}
.ui-sfc__draw path{stroke-dasharray: 1;stroke-dashoffset: 1;animation: ui-sfc-draw var(--nm-dur-4, 380ms) var(--ui-sfc-ease) 80ms forwards}
.ui-sfc__head{padding: 16px 20px 0}
.ui-sfc__steps{position: relative}
.ui-sfc__list{display: grid;grid-template-columns: repeat(var(--ui-sfc-n), minmax(0, 1fr));gap: 8px;padding: 0;list-style: none}
.ui-sfc__step{position: relative;display: grid;min-width: 0}
.ui-sfc__step-btn{display: grid;grid-template-columns: auto minmax(0, 1fr);align-items: center;column-gap: 6px;row-gap: 6px;min-width: 0;margin: -4px;padding: 4px 4px 2px;border-radius: 6px;text-align: left;cursor: default;transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
button.ui-sfc__step-btn{cursor: pointer}
button.ui-sfc__step-btn:hover{background: var(--ui-sfc-wash)}
.ui-sfc__bar{position: relative;grid-column: 1 / -1;height: 2px;overflow: hidden;border-radius: 1px;background: var(--ui-sfc-line)}
.ui-sfc__bar::after{content: "";position: absolute;inset: 0;border-radius: inherit;background: var(--ui-sfc-accent);transform: scaleX(0);transform-origin: left center;transition: transform var(--nm-dur-4, 380ms) var(--ui-sfc-ease)}
.ui-sfc__step:not([data-state="upcoming"]) .ui-sfc__bar::after{transform: none}
.ui-sfc__mark{display: inline-flex;flex: none;align-items: center;justify-content: flex-start;min-width: 12px;height: 16px;font-size: 10px;font-weight: 500;line-height: 16px;font-variant-numeric: tabular-nums;color: var(--ui-sfc-faint);transition: color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-sfc__mark > span{animation: ui-sfc-in var(--nm-dur-3, 240ms) var(--ui-sfc-ease) both}
.ui-sfc__mark .ui-sfc__draw{width: 12px;height: 12px;stroke-width: 2.4}
.ui-sfc__step[data-state="current"] .ui-sfc__mark{color: var(--ui-sfc-accent)}
.ui-sfc__step[data-state="done"] .ui-sfc__mark{color: var(--ui-sfc-accent)}
.ui-sfc__step-label{overflow: hidden;min-width: 0;font-size: 10px;font-weight: 500;line-height: 16px;letter-spacing: 0.5px;text-transform: uppercase;white-space: nowrap;text-overflow: ellipsis;color: var(--ui-sfc-muted);transition: color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-sfc__step[data-state="done"] .ui-sfc__step-label{color: var(--ui-sfc-text)}
.ui-sfc__step[data-state="current"] .ui-sfc__step-label{color: var(--ui-sfc-strong)}
button.ui-sfc__step-btn:hover .ui-sfc__step-label{color: var(--ui-sfc-ink)}
.ui-sfc__compact{display: none}
.ui-sfc__compact-text{display: flex;min-width: 0;font-size: 10px;font-weight: 500;line-height: 16px;letter-spacing: 0.5px;text-transform: uppercase;font-variant-numeric: tabular-nums;color: var(--ui-sfc-muted);white-space: nowrap;animation: ui-sfc-in var(--nm-dur-3, 240ms) var(--ui-sfc-ease) both}
.ui-sfc__compact-dot{margin: 0 6px;color: var(--ui-sfc-faint)}
.ui-sfc__compact-title{overflow: hidden;text-overflow: ellipsis;color: var(--ui-sfc-strong)}
.ui-sfc__card{display: grid;min-width: 0}
.ui-sfc__viewport{position: relative;overflow: hidden;transition: height var(--nm-dur-4, 380ms) var(--ui-sfc-ease)}
.ui-sfc__pane{padding: 20px 20px 20px;animation: ui-sfc-enter var(--nm-dur-4, 380ms) var(--ui-sfc-ease) both}
.ui-sfc__pane[data-dir="-1"]{animation-name: ui-sfc-enter-back}
.ui-sfc__pane[data-first]{animation: none}
.ui-sfc__pane[data-pane="leaving"]{position: absolute;top: 0;left: 0;right: 0;pointer-events: none;animation: ui-sfc-leave var(--nm-dur-3, 240ms) var(--ui-sfc-ease) both}
.ui-sfc__pane[data-pane="leaving"][data-dir="-1"]{animation-name: ui-sfc-leave-back}
.ui-sfc__heading{font-size: 15px;font-weight: 500;line-height: 24px;color: var(--ui-sfc-strong);outline: none}
.ui-sfc__desc{color: var(--ui-sfc-text);text-wrap: pretty}
.ui-sfc__body{display: grid;gap: 16px;margin-top: 16px}
.ui-sfc__field{display: grid;min-width: 0}
.ui-sfc__label{display: flex;align-items: baseline;justify-content: space-between;gap: 8px;margin: 0 0 6px 2px;font-size: 12px;font-weight: 500;line-height: 16px;color: var(--ui-sfc-text)}
.ui-sfc__optional{font-weight: 400;color: var(--ui-sfc-muted)}
.ui-sfc__control{min-width: 0}
.ui-sfc__input, .ui-sfc__tags{display: flex;align-items: center;min-width: 0;height: 32px;border-radius: 8px;background: var(--ui-sfc-card);box-shadow: var(--ui-sfc-shadow);transition: box-shadow var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));cursor: text}
.ui-sfc__input:hover, .ui-sfc__tags:hover{box-shadow: var(--ui-sfc-shadow-hover)}
.ui-sfc__input:focus-within, .ui-sfc__tags:focus-within{outline: 2px solid var(--ui-sfc-focus);outline-offset: 1px}
.ui-sfc__input[data-invalid], .ui-sfc__tags[data-invalid]{box-shadow: 0 0 0 0.5px var(--ui-sfc-danger), 0 1px 2px 0 rgba(226, 84, 74, 0.08)}
.ui-sfc__input[data-invalid]:focus-within, .ui-sfc__tags[data-invalid]:focus-within{outline-color: rgba(226, 84, 74, 0.3)}
.ui-sfc__input input, .ui-sfc__tags-input{flex: 1;min-width: 0;height: 32px;margin: 0;padding: 0 10px;border: 0;outline: none;background: none;font: inherit;color: var(--ui-sfc-ink)}
.ui-sfc__input input::placeholder, .ui-sfc__tags-input::placeholder{color: var(--ui-sfc-faint)}
.ui-sfc__prefix{flex: none;padding-left: 10px;color: var(--ui-sfc-muted);white-space: nowrap;user-select: none}
.ui-sfc__prefix + input{padding-left: 0}
.ui-sfc__fold{display: grid;grid-template-rows: 0fr;opacity: 0;transition: grid-template-rows var(--nm-dur-3, 240ms) var(--ui-sfc-ease), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-sfc__fold[data-open]{grid-template-rows: 1fr;opacity: 1}
.ui-sfc__fold > div{min-height: 0;overflow: hidden}
.ui-sfc__msg, .ui-sfc__hint{padding: 6px 0 0 2px;font-size: 12px;line-height: 16px;text-wrap: pretty}
.ui-sfc__msg{color: var(--ui-sfc-danger);animation: ui-sfc-in 240ms var(--ui-sfc-ease) both}
.ui-sfc__hint{color: var(--ui-sfc-muted)}
.ui-sfc__tags{gap: 4px;padding: 0 4px;overflow-x: auto;overflow-y: hidden;scrollbar-width: none;overscroll-behavior-x: contain}
.ui-sfc__tags::-webkit-scrollbar{display: none}
.ui-sfc__chips{display: contents;padding: 0;list-style: none}
.ui-sfc__chip{display: inline-flex;flex: none;align-items: center;gap: 2px;max-width: 220px;height: 24px;padding: 0 3px 0 8px;overflow: hidden;border-radius: 6px;background: var(--ui-sfc-fill);font-size: 12px;font-weight: 500;line-height: 16px;color: var(--ui-sfc-ink);white-space: nowrap;animation: ui-sfc-chip var(--nm-dur-3, 240ms) var(--ui-sfc-ease) both}
.ui-sfc__chip[data-leaving]{pointer-events: none}
.ui-sfc__chip-text{overflow: hidden;text-overflow: ellipsis}
.ui-sfc__chip-x{display: grid;place-items: center;flex: none;width: 18px;height: 18px;border-radius: 4px;color: var(--ui-sfc-icon);transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-sfc__chip-x .ui-sfc__glyph{width: 12px;height: 12px;stroke-width: 1.9}
.ui-sfc__chip-x:hover{background: var(--ui-sfc-fill);color: var(--ui-sfc-ink)}
.ui-sfc__chip[data-leaving] .ui-sfc__chip-x{background: none}
.ui-sfc__tags-input{flex: 1 0 140px;height: 24px;padding: 0 6px}
.ui-sfc__tags-input:first-child{padding-left: 6px}
.ui-sfc__choices{position: relative;display: grid;grid-auto-columns: minmax(0, 1fr);grid-auto-flow: column;gap: 8px}
.ui-sfc__ring{position: absolute;top: 0;left: 0;z-index: 2;border-radius: 8px;box-shadow: 0 0 0 0.5px var(--ui-sfc-accent-line);opacity: 0;pointer-events: none;transition: transform var(--nm-dur-3, 240ms) var(--ui-sfc-ease), width var(--nm-dur-3, 240ms) var(--ui-sfc-ease), height var(--nm-dur-3, 240ms) var(--ui-sfc-ease), opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-sfc__choice{position: relative;display: grid;align-content: start;gap: 2px;min-width: 0;padding: 10px 12px 12px;border-radius: 8px;background: var(--ui-sfc-card);box-shadow: var(--ui-sfc-shadow);text-align: left;transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-sfc__choice:hover{background: var(--ui-sfc-wash-soft)}
.ui-sfc__choice[aria-checked="true"]{background: var(--ui-sfc-accent-fill)}
.ui-sfc__choice:focus-visible{outline-offset: 3px}
.ui-sfc__choice-top{display: flex;align-items: center;gap: 6px;min-width: 0}
.ui-sfc__choice-title{overflow: hidden;font-weight: 500;color: var(--ui-sfc-strong);white-space: nowrap;text-overflow: ellipsis}
.ui-sfc__badge{flex: none;padding: 0 5px;border-radius: 5px;background: var(--ui-sfc-accent-soft);font-size: 11px;font-weight: 500;line-height: 16px;color: var(--ui-sfc-accent)}
.ui-sfc__radio{position: relative;flex: none;width: 14px;height: 14px;margin-left: auto;border-radius: 50%;box-shadow: inset 0 0 0 1px var(--ui-sfc-fill-strong);transition: box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-sfc__radio::after{content: "";position: absolute;inset: 3.5px;border-radius: 50%;background: var(--ui-sfc-accent);transform: scale(0);transition: transform var(--nm-dur-3, 240ms) cubic-bezier(0.34, 1.56, 0.64, 1)}
.ui-sfc__choice[aria-checked="true"] .ui-sfc__radio{box-shadow: inset 0 0 0 1px var(--ui-sfc-accent)}
.ui-sfc__choice[aria-checked="true"] .ui-sfc__radio::after{transform: scale(1)}
.ui-sfc__choice-aside{font-variant-numeric: tabular-nums;color: var(--ui-sfc-ink)}
.ui-sfc__choice-desc{margin-top: 2px;font-size: 12px;line-height: 16px;color: var(--ui-sfc-text);text-wrap: pretty}
.ui-sfc__review{display: grid;border-radius: 8px;box-shadow: var(--ui-sfc-shadow)}
.ui-sfc__review-row{display: grid;grid-template-columns: 96px minmax(0, 1fr) auto;align-items: baseline;gap: 12px;padding: 10px 8px 10px 12px}
.ui-sfc__review-row + .ui-sfc__review-row{border-top: 0.5px solid var(--ui-sfc-line)}
.ui-sfc__review dt{font-size: 12px;line-height: 20px;color: var(--ui-sfc-muted)}
.ui-sfc__review dd{min-width: 0;color: var(--ui-sfc-ink);overflow-wrap: break-word}
.ui-sfc__edit{height: 24px;margin: -2px 0;padding: 0 8px;border-radius: 6px;font-size: 12px;font-weight: 500;line-height: 16px;color: var(--ui-sfc-text);transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-sfc__edit:hover{background: var(--ui-sfc-wash);color: var(--ui-sfc-ink)}
.ui-sfc__success{display: grid;justify-items: center;padding: 16px 0 8px;text-align: center}
.ui-sfc__success-check{display: grid;place-items: center;width: 36px;height: 36px;margin-bottom: 12px;border-radius: 50%;background: var(--ui-sfc-ok-soft);color: var(--ui-sfc-ok);animation: ui-sfc-pop var(--nm-dur-5, 620ms) cubic-bezier(0.34, 1.56, 0.64, 1) 120ms both}
.ui-sfc__success-check .ui-sfc__draw{width: 18px;height: 18px;stroke-width: 2}
.ui-sfc__success-check .ui-sfc__draw path{animation-delay: 320ms}
.ui-sfc__success .ui-sfc__heading{animation: ui-sfc-in var(--nm-dur-4, 380ms) var(--ui-sfc-ease) 220ms both}
.ui-sfc__success .ui-sfc__desc{max-width: 40ch;text-wrap: balance;animation: ui-sfc-in var(--nm-dur-4, 380ms) var(--ui-sfc-ease) 290ms both}
.ui-sfc__success-actions{display: flex;flex-wrap: wrap;justify-content: center;gap: 8px;margin-top: 16px;animation: ui-sfc-in var(--nm-dur-4, 380ms) var(--ui-sfc-ease) 360ms both}
.ui-sfc__foot-fold{position: sticky;bottom: 0;z-index: 3;display: grid;grid-template-rows: 1fr;border-radius: 0 0 10px 10px;background: var(--ui-sfc-card);transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-sfc-ease), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-sfc__foot-fold[data-hidden]{grid-template-rows: 0fr;opacity: 0}
.ui-sfc__foot{display: flex;align-items: center;gap: 12px;min-height: 0;overflow: hidden;padding: 0 12px;border-top: 0.5px solid var(--ui-sfc-line)}
.ui-sfc__foot::before{content: "";flex: none;width: 0;height: 48px;margin-right: -12px}
.ui-sfc__btn{display: inline-flex;align-items: center;justify-content: center;flex: none;height: 28px;border-radius: 6px;font-size: 13px;font-weight: 500;line-height: 20px;white-space: nowrap;transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), width var(--nm-dur-3, 240ms) var(--ui-sfc-ease), visibility var(--nm-dur-2, 160ms)}
.ui-sfc__btn-ghost, .ui-sfc__btn-secondary{gap: 6px;padding: 0 10px 0 8px;background: var(--ui-sfc-card);box-shadow: var(--ui-sfc-shadow);color: var(--ui-sfc-strong)}
.ui-sfc__btn-secondary{padding: 0 10px}
.ui-sfc__btn-ghost .ui-sfc__glyph{color: var(--ui-sfc-icon)}
.ui-sfc__btn-ghost:hover, .ui-sfc__btn-secondary:hover{background: var(--ui-sfc-white-hover)}
.ui-sfc__btn-ghost[data-hidden]{opacity: 0;visibility: hidden}
.ui-sfc__btn-primary{margin-left: auto;overflow: hidden;background: var(--ui-sfc-chip);color: var(--ui-sfc-on-chip)}
.ui-sfc__btn-primary:hover{background: var(--ui-sfc-chip-hover)}
.ui-sfc__btn:active{transform: scale(0.97)}
.ui-sfc__btn-primary[aria-disabled="true"]{opacity: 0.35}
.ui-sfc__btn-primary[data-busy]{opacity: 0.7;cursor: progress}
.ui-sfc__btn-inner{display: inline-flex;flex: none;align-items: center;gap: 6px;padding: 0 10px}
.ui-sfc__btn-label{animation: ui-sfc-in 240ms var(--ui-sfc-ease) both}
.ui-sfc__spinner{width: 12px;height: 12px;border-radius: 50%;border: 1.5px solid currentColor;border-right-color: transparent;animation: ui-sfc-spin var(--nm-dur-5, 620ms) linear infinite}
.ui-sfc__submit-error{min-width: 0;font-size: 12px;line-height: 16px;color: var(--ui-sfc-danger);animation: ui-sfc-in 240ms var(--ui-sfc-ease) both}
@keyframes ui-sfc-in{from{opacity: 0;transform: translateY(3px);filter: blur(2px)}
to{opacity: 1;transform: none;filter: none}
}
@keyframes ui-sfc-enter{from{opacity: 0;transform: translateX(24px)}
to{opacity: 1;transform: none}
}
@keyframes ui-sfc-enter-back{from{opacity: 0;transform: translateX(-24px)}
to{opacity: 1;transform: none}
}
@keyframes ui-sfc-leave{to{opacity: 0;transform: translateX(-24px)}
}
@keyframes ui-sfc-leave-back{to{opacity: 0;transform: translateX(24px)}
}
@keyframes ui-sfc-draw{to{stroke-dashoffset: 0}
}
@keyframes ui-sfc-pop{0%{opacity: 0;transform: scale(0.4)}
60%{opacity: 1;transform: scale(1.08)}
100%{opacity: 1;transform: scale(1)}
}
@keyframes ui-sfc-chip{from{opacity: 0;transform: scale(0.85)}
to{opacity: 1;transform: none}
}
@keyframes ui-sfc-spin{to{transform: rotate(360deg)}
}
@container (max-width: 420px){.ui-sfc__head{padding: 14px 16px 0}
.ui-sfc__compact{display: flex;margin-bottom: 8px}
.ui-sfc__step-btn{row-gap: 0;padding-bottom: 4px}
.ui-sfc__mark, .ui-sfc__step-label{position: absolute;width: 1px;height: 1px;overflow: hidden;clip-path: inset(50%);white-space: nowrap}
.ui-sfc__pane{padding: 16px 16px 16px}
.ui-sfc__foot{padding: 0 12px}
.ui-sfc__choices{grid-template-columns: minmax(0, 1fr);grid-auto-flow: row}
.ui-sfc__choice{grid-template-columns: minmax(0, 1fr) auto;column-gap: 10px;padding: 10px 12px}
.ui-sfc__choice-top{grid-column: 1}
.ui-sfc__choice-aside{grid-column: 2;grid-row: 1;align-self: center}
.ui-sfc__choice-desc{grid-column: 1 / -1;margin-top: 0}
.ui-sfc__radio{order: -1;margin-left: 0;margin-right: 2px}
.ui-sfc__review-row{grid-template-columns: minmax(0, 1fr) auto;row-gap: 0}
.ui-sfc__review dt{grid-column: 1}
.ui-sfc__review dd{grid-column: 1;grid-row: 2}
.ui-sfc__edit{grid-column: 2;grid-row: 1 / span 2;align-self: center;margin: 0}
}
@media (hover: none) and (pointer: coarse){.ui-sfc__input input, .ui-sfc__tags-input, .ui-sfc__prefix{font-size: 16px}
.ui-sfc__input, .ui-sfc__tags, .ui-sfc__input input{height: 40px}
.ui-sfc__chip{height: 30px}
.ui-sfc__chip-x{width: 26px;height: 26px}
.ui-sfc__tags-input{height: 30px}
.ui-sfc__btn{height: 36px}
.ui-sfc__foot::before{height: 56px}
.ui-sfc__edit{height: 34px;padding: 0 12px}
.ui-sfc__step-btn{padding-top: 10px;padding-bottom: 8px;margin: -10px -4px -8px}
}
@media (prefers-reduced-motion: reduce){.ui-sfc *, .ui-sfc *::before, .ui-sfc *::after{animation-duration: 1ms !important;animation-delay: 0ms !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-sfc{--ui-sfc-card: #211b16;--ui-sfc-ink: rgba(255, 253, 251, 0.9);--ui-sfc-strong: #fffdfb;--ui-sfc-text: rgba(255, 253, 251, 0.62);--ui-sfc-muted: rgba(255, 253, 251, 0.46);--ui-sfc-faint: rgba(255, 253, 251, 0.3);--ui-sfc-icon: rgba(255, 253, 251, 0.5);--ui-sfc-line: rgba(255, 253, 251, 0.08);--ui-sfc-fill: rgba(255, 253, 251, 0.08);--ui-sfc-fill-strong: rgba(255, 253, 251, 0.16);--ui-sfc-wash: rgba(255, 253, 251, 0.04);--ui-sfc-wash-soft: rgba(255, 253, 251, 0.025);--ui-sfc-accent: #ff8a5c;--ui-sfc-accent-soft: rgba(255, 138, 92, 0.14);--ui-sfc-accent-fill: rgba(255, 138, 92, 0.09);--ui-sfc-accent-line: rgba(255, 138, 92, 0.5);--ui-sfc-ok: #2f8d5c;--ui-sfc-ok-soft: rgba(47, 141, 92, 0.14);--ui-sfc-danger: #e2544a;--ui-sfc-chip: rgba(255, 253, 251, 0.9);--ui-sfc-chip-hover: rgba(255, 253, 251, 0.8);--ui-sfc-on-chip: #181310;--ui-sfc-white-hover: #27201a;--ui-sfc-focus: rgba(255, 138, 92, 0.5);--ui-sfc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-sfc-shadow-hover: 0 0 0 0.5px rgba(255, 253, 251, 0.16), 0 1px 2px 0 rgba(11, 9, 8, 0.4)}

`;
