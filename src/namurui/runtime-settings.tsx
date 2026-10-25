"use client";

import { useEffect, useId, useRef, useState } from "react";

/*
 * Runtime Settings: the nine agent-behaviour fields OMP keeps for a session, edited as a
 * draft rather than on contact. Every radio option says what the mode actually does, because
 * the names alone do not; the save bar rises only when the draft differs from the saved
 * snapshot, counts the fields that are pending, and folds away once the write lands.
 * Styles are injected below, so no extra files are needed.
 */

export type SteeringMode = "one-at-a-time" | "all";
export type FollowUpMode = "one-at-a-time" | "all";
export type InterruptMode = "immediate" | "wait";
export type CacheWarmingMode = "off" | "streaming" | "idle";

export type RuntimeSettingsValue = {
  /** How queued steering messages are drained into a running turn */
  steeringMode: SteeringMode;
  /** How queued follow-ups are admitted once the agent would otherwise stop */
  followUpMode: FollowUpMode;
  /** Whether steering signals cooperative tools while a turn is still running */
  interruptMode: InterruptMode;
  /** Compact the transcript as the context window fills */
  autoCompaction: boolean;
  /** Retry a failed turn on the provider's backoff */
  autoRetry: boolean;
  /** Ask for the provider's priority service tier */
  fastMode: boolean;
  /** Accept the provider's low-priority lane when a usage limit is reached */
  slowMode: boolean;
  /** Prompt-cache warming schedule */
  cacheWarming: CacheWarmingMode;
  /** Project state events as deltas instead of whole frames */
  eventFilterDelta: boolean;
};

export const RUNTIME_SETTINGS_DEFAULTS: RuntimeSettingsValue = {
  steeringMode: "one-at-a-time",
  followUpMode: "one-at-a-time",
  interruptMode: "immediate",
  autoCompaction: true,
  autoRetry: true,
  fastMode: false,
  slowMode: false,
  cacheWarming: "idle",
  eventFilterDelta: false,
};

export type RuntimeSettingsProps = {
  /** Settings as the session last saved them; omit to let the panel own the snapshot */
  value?: RuntimeSettingsValue;
  /** Called with the whole draft after every edit, before anything is saved */
  onChange?: (draft: RuntimeSettingsValue) => void;
  /** Called with the draft when Save is pressed */
  onSave?: (draft: RuntimeSettingsValue) => void;
  /** Called after Reset puts the draft back to the saved snapshot */
  onReset?: () => void;
  /** True while the save round-trip is in flight; Save and Reset are disabled */
  saving?: boolean;
  /** Whether the active provider offers the low-priority lane; false hides the switch */
  slowModeSupported?: boolean;
  /** Extra class on the root */
  className?: string;
};

type ModeOption<T extends string> = {
  value: T;
  label: string;
  note: string;
  factoryDefault?: boolean;
};

const STEERING_OPTIONS: readonly ModeOption<SteeringMode>[] = [
  {
    value: "one-at-a-time",
    label: "One at a time",
    note: "One queued message per drain, with the hidden companions that belong to it.",
    factoryDefault: true,
  },
  {
    value: "all",
    label: "All at once",
    note: "Every queued message in one drain, in the order it arrived.",
  },
];

const FOLLOW_UP_OPTIONS: readonly ModeOption<FollowUpMode>[] = [
  {
    value: "one-at-a-time",
    label: "One at a time",
    note: "One follow-up admitted per drain, once the agent would otherwise stop.",
    factoryDefault: true,
  },
  {
    value: "all",
    label: "All at once",
    note: "The whole follow-up queue is admitted in a single drain.",
  },
];

const INTERRUPT_OPTIONS: readonly ModeOption<InterruptMode>[] = [
  {
    value: "immediate",
    label: "Immediate",
    note: "Cooperative tools step aside mid-turn when steering arrives.",
    factoryDefault: true,
  },
  {
    value: "wait",
    label: "Wait for the batch",
    note: "Side-effecting tools finish first; steering lands at the batch boundary.",
  },
];

const CACHE_OPTIONS: readonly { value: CacheWarmingMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "streaming", label: "Streaming" },
  { value: "idle", label: "Idle" },
];

const CACHE_NOTE: Record<CacheWarmingMode, string> = {
  off: "Nothing is warmed. Every cache miss is paid in full.",
  streaming: "The prefix is warmed while long tool runs are in flight, and stops when the agent settles.",
  idle: "Also warms between turns, for thirty minutes after the last real request.",
};

const FIELD_LABEL: Record<keyof RuntimeSettingsValue, string> = {
  steeringMode: "steering",
  followUpMode: "follow-up",
  interruptMode: "interrupt",
  autoCompaction: "auto-compaction",
  autoRetry: "auto-retry",
  fastMode: "fast mode",
  slowMode: "slow mode",
  cacheWarming: "cache warming",
  eventFilterDelta: "delta events",
};

const FIELDS: readonly (keyof RuntimeSettingsValue)[] = [
  "steeringMode",
  "followUpMode",
  "interruptMode",
  "autoCompaction",
  "autoRetry",
  "fastMode",
  "slowMode",
  "cacheWarming",
  "eventFilterDelta",
];

/* A comparable identity for a snapshot, so a caller can re-render with an equal object
 * without the draft being disturbed. */
const keyOf = (settings: RuntimeSettingsValue) =>
  [
    settings.steeringMode,
    settings.followUpMode,
    settings.interruptMode,
    settings.autoCompaction,
    settings.autoRetry,
    settings.fastMode,
    settings.slowMode,
    settings.cacheWarming,
    settings.eventFilterDelta,
  ].join("|");

/* Matches the exit animation in the stylesheet, with a frame of slack */
const BAR_LEAVE_MS = 260;

const CHECK_GLYPH = (
  <svg
    viewBox="0 0 12 12"
    width="12"
    height="12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2.2 6.3 4.8 8.9 9.8 3.4" />
  </svg>
);

export function RuntimeSettings({
  value,
  onChange,
  onSave,
  onReset,
  saving = false,
  slowModeSupported = true,
  className,
}: RuntimeSettingsProps) {
  const seed = value ?? RUNTIME_SETTINGS_DEFAULTS;
  const [saved, setSaved] = useState<RuntimeSettingsValue>(seed);
  const [draft, setDraft] = useState<RuntimeSettingsValue>(seed);
  const [pending, setPending] = useState<{
    snapshot: RuntimeSettingsValue;
    count: number;
  } | null>(null);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [barMounted, setBarMounted] = useState(false);
  const [barCount, setBarCount] = useState(0);
  const baseId = useId();

  /* The parent can push a new snapshot — a save that landed elsewhere, a session switch.
   * A clean draft follows it; a dirty draft is the user's, so only the reference moves. */
  const valueKey = value === undefined ? "" : keyOf(value);
  const seenValueKey = useRef(valueKey);
  useEffect(() => {
    if (value === undefined || valueKey === seenValueKey.current) return;
    seenValueKey.current = valueKey;
    const wasClean = keyOf(draft) === keyOf(saved);
    setSaved(value);
    if (wasClean) {
      setDraft(value);
      setLastSaved(null);
    }
  }, [value, valueKey, draft, saved]);

  const changedFields = FIELDS.filter((field) => {
    /* A hidden control is not something the user can reconcile, so it never counts */
    if (field === "slowMode" && !slowModeSupported) return false;
    return draft[field] !== saved[field];
  });
  const changed = changedFields.length;
  const dirty = changed > 0;

  /* The bar stays mounted for the length of its exit animation, then drops out of flow */
  useEffect(() => {
    if (dirty) {
      setBarMounted(true);
      setBarCount(changed);
      return;
    }
    if (!barMounted) return;
    const timer = window.setTimeout(() => setBarMounted(false), BAR_LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [dirty, changed, barMounted]);

  /* The write is only believed once the caller stops saying it is in flight: a pending
   * snapshot is promoted to the saved one, so Reset afterwards restores what was written,
   * not what the panel opened with. */
  useEffect(() => {
    if (pending === null || saving) return;
    if (value === undefined) setSaved(pending.snapshot);
    setLastSaved(pending.count);
    setPending(null);
  }, [pending, saving, value]);

  const announcement =
    pending !== null && saving
      ? "Saving settings"
      : lastSaved !== null && !dirty
        ? `Saved, ${lastSaved} ${lastSaved === 1 ? "setting" : "settings"} written`
        : dirty
          ? `${changed} ${changed === 1 ? "setting" : "settings"} changed, not saved`
          : "";

  const commit = (patch: Partial<RuntimeSettingsValue>) => {
    const next: RuntimeSettingsValue = { ...draft, ...patch };
    setDraft(next);
    setLastSaved(null);
    onChange?.(next);
  };

  const save = () => {
    if (saving || pending !== null || !dirty) return;
    setLastSaved(null);
    setPending({ snapshot: draft, count: changed });
    onSave?.(draft);
  };

  const reset = () => {
    if (!dirty) return;
    setDraft(saved);
    setLastSaved(null);
    onReset?.();
  };

  return (
    <div className={["ui-rts", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-runtime-settings" precedence="default">
        {css}
      </style>

      <p className="ui-rts__sr" role="status" aria-live="polite">
        {announcement}
      </p>

      <header className="ui-rts__head">
        <p className="ui-rts__title">Runtime settings</p>
        <p className="ui-rts__sub">
          Session-scoped. Saving writes each field over RPC; it does not touch config.yml.
        </p>
      </header>

      <section className="ui-rts__section">
        <p className="ui-rts__section-title">Message delivery</p>

        <fieldset className="ui-rts__group" aria-describedby={`${baseId}-steering-note`}>
          <legend className="ui-rts__legend">Steering</legend>
          <p className="ui-rts__group-note" id={`${baseId}-steering-note`}>
            Messages you send while the agent is working.
          </p>
          <div className="ui-rts__options">
            {STEERING_OPTIONS.map((option) => (
              <Option
                key={option.value}
                name={`${baseId}-steering`}
                checked={draft.steeringMode === option.value}
                label={option.label}
                note={option.note}
                factoryDefault={option.factoryDefault}
                changed={
                  draft.steeringMode === option.value && draft.steeringMode !== saved.steeringMode
                }
                onSelect={() => commit({ steeringMode: option.value })}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="ui-rts__group" aria-describedby={`${baseId}-follow-up-note`}>
          <legend className="ui-rts__legend">Follow-up</legend>
          <p className="ui-rts__group-note" id={`${baseId}-follow-up-note`}>
            Messages that wait for the agent to finish the turn.
          </p>
          <div className="ui-rts__options">
            {FOLLOW_UP_OPTIONS.map((option) => (
              <Option
                key={option.value}
                name={`${baseId}-follow-up`}
                checked={draft.followUpMode === option.value}
                label={option.label}
                note={option.note}
                factoryDefault={option.factoryDefault}
                changed={
                  draft.followUpMode === option.value && draft.followUpMode !== saved.followUpMode
                }
                onSelect={() => commit({ followUpMode: option.value })}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="ui-rts__group" aria-describedby={`${baseId}-interrupt-note`}>
          <legend className="ui-rts__legend">Interrupt</legend>
          <p className="ui-rts__group-note" id={`${baseId}-interrupt-note`}>
            What a steering message may do to a running tool.
          </p>
          <div className="ui-rts__options">
            {INTERRUPT_OPTIONS.map((option) => (
              <Option
                key={option.value}
                name={`${baseId}-interrupt`}
                checked={draft.interruptMode === option.value}
                label={option.label}
                note={option.note}
                factoryDefault={option.factoryDefault}
                changed={
                  draft.interruptMode === option.value &&
                  draft.interruptMode !== saved.interruptMode
                }
                onSelect={() => commit({ interruptMode: option.value })}
              />
            ))}
          </div>
        </fieldset>
      </section>

      <section className="ui-rts__section">
        <p className="ui-rts__section-title">Turn handling</p>
        <div className="ui-rts__rows">
          <SwitchRow
            label="Auto-compaction"
            note="Summarise the transcript as the window fills, instead of failing the turn."
            checked={draft.autoCompaction}
            changed={draft.autoCompaction !== saved.autoCompaction}
            onToggle={(next) => commit({ autoCompaction: next })}
          />
          <SwitchRow
            label="Auto-retry"
            note="Retry a failed turn on the provider's backoff before giving up."
            checked={draft.autoRetry}
            changed={draft.autoRetry !== saved.autoRetry}
            onToggle={(next) => commit({ autoRetry: next })}
          />
          <SwitchRow
            label="Fast mode"
            note="Ask for the provider's priority tier: quicker tokens, billed at the higher rate."
            checked={draft.fastMode}
            changed={draft.fastMode !== saved.fastMode}
            onToggle={(next) => commit({ fastMode: next })}
          />
          {slowModeSupported ? (
            <SwitchRow
              label="Slow mode"
              note="Take the low-priority lane when a usage limit is hit, instead of waiting it out."
              checked={draft.slowMode}
              changed={draft.slowMode !== saved.slowMode}
              onToggle={(next) => commit({ slowMode: next })}
            />
          ) : null}
        </div>
      </section>

      <section className="ui-rts__section">
        <p className="ui-rts__section-title">Transport</p>

        <fieldset className="ui-rts__group">
          <legend className="ui-rts__legend">
            Cache warming
            {draft.cacheWarming !== saved.cacheWarming ? (
              <span className="ui-rts__tag" data-kind="changed" aria-hidden="true">
                changed
              </span>
            ) : null}
          </legend>
          <div className="ui-rts__segments">
            {CACHE_OPTIONS.map((option) => (
              <label className="ui-rts__segment" key={option.value}>
                <input
                  type="radio"
                  className="ui-rts__segment-input"
                  name={`${baseId}-cache`}
                  value={option.value}
                  checked={draft.cacheWarming === option.value}
                  onChange={() => commit({ cacheWarming: option.value })}
                />
                <span className="ui-rts__segment-text">{option.label}</span>
              </label>
            ))}
          </div>
          <p className="ui-rts__note">{CACHE_NOTE[draft.cacheWarming]}</p>
        </fieldset>

        <div className="ui-rts__rows ui-rts__rows--divided">
          <SwitchRow
            label="Delta event projection"
            note="Send only changed fields per frame. Cuts bridge bandwidth; a dropped frame costs a full resync."
            checked={draft.eventFilterDelta}
            changed={draft.eventFilterDelta !== saved.eventFilterDelta}
            onToggle={(next) => commit({ eventFilterDelta: next })}
          />
        </div>
      </section>

      {barMounted || lastSaved !== null ? (
        <div className="ui-rts__foot">
          {barMounted ? (
            <div className="ui-rts__dock" data-leaving={dirty ? undefined : "true"}>
              <span
                className="ui-rts__count"
                title={
                  dirty ? changedFields.map((field) => FIELD_LABEL[field]).join(", ") : undefined
                }
              >
                <b>{barCount}</b> changed
              </span>
              <span className="ui-rts__dock-note">
                {saving ? "Writing to the session…" : "Not written to the session yet"}
              </span>
              <span className="ui-rts__actions">
                <button type="button" className="ui-rts__reset" onClick={reset} disabled={saving}>
                  Reset
                </button>
                <button
                  type="button"
                  className="ui-rts__save"
                  onClick={save}
                  disabled={saving}
                  aria-busy={saving}
                >
                  {saving ? <span className="ui-rts__pulse" aria-hidden="true" /> : null}
                  {saving ? "Saving…" : "Save"}
                </button>
              </span>
            </div>
          ) : null}

          {lastSaved !== null && !barMounted ? (
            <p className="ui-rts__saved">
              <span className="ui-rts__saved-glyph" aria-hidden="true">
                {CHECK_GLYPH}
              </span>
              Saved · {lastSaved} {lastSaved === 1 ? "setting" : "settings"} written
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Option({
  name,
  checked,
  label,
  note,
  factoryDefault,
  changed,
  onSelect,
}: {
  name: string;
  checked: boolean;
  label: string;
  note: string;
  factoryDefault?: boolean;
  changed?: boolean;
  onSelect: () => void;
}) {
  const noteId = useId();
  return (
    <label className="ui-rts__option" data-checked={checked ? "true" : undefined}>
      <input
        type="radio"
        className="ui-rts__radio"
        name={name}
        checked={checked}
        aria-label={label}
        aria-describedby={noteId}
        onChange={onSelect}
      />
      <span className="ui-rts__dot" aria-hidden="true" />
      <span className="ui-rts__option-text">
        <span className="ui-rts__option-label">
          {label}
          {factoryDefault ? <span className="ui-rts__tag">default</span> : null}
          {changed ? (
            <span className="ui-rts__tag" data-kind="changed">
              changed
            </span>
          ) : null}
        </span>
        <span className="ui-rts__option-note" id={noteId}>
          {note}
        </span>
      </span>
    </label>
  );
}

function SwitchRow({
  label,
  note,
  checked,
  changed,
  onToggle,
}: {
  label: string;
  note: string;
  checked: boolean;
  changed: boolean;
  onToggle: (next: boolean) => void;
}) {
  const noteId = useId();
  return (
    <label className="ui-rts__row">
      <span className="ui-rts__row-text">
        <span className="ui-rts__row-label">
          {label}
          {changed ? (
            <span className="ui-rts__tag" data-kind="changed">
              changed
            </span>
          ) : null}
        </span>
        <span className="ui-rts__row-note" id={noteId}>
          {note}
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        className="ui-rts__switch"
        checked={checked}
        aria-label={label}
        aria-describedby={noteId}
        onChange={(event) => onToggle(event.target.checked)}
      />
      <span className="ui-rts__track" aria-hidden="true">
        <span className="ui-rts__knob" />
      </span>
    </label>
  );
}

const css = /* css */ `
.ui-rts {
  /* Knobs. Override any of these on .ui-rts to retheme the panel in a host. */
  --ui-rts-panel: var(--panel, #fffdfb);
  --ui-rts-card: var(--card, #ffffff);
  --ui-rts-ink: var(--text, #1a1410);
  --ui-rts-muted: var(--text-muted, #6f625a);
  /* The default/changed pills sit on a wash, which lifts the backdrop toward the ink.
   * They carry their own value so a chip stays legible without dimming the muted ink
   * that the rest of the panel uses. */
  --ui-rts-tag-ink: #5e5349;
  --ui-rts-line: var(--border, #e8e0d7);
  --ui-rts-edge: var(--border-soft, #1a14101a);
  --ui-rts-wash: #7a4a1c0a;
  --ui-rts-wash-strong: #7a4a1c12;
  --ui-rts-track: #1a141024;
  --ui-rts-on: var(--primary, #1a1410);
  --ui-rts-knob: var(--primary-fg, #fffdfb);
  --ui-rts-accent: var(--accent, #c2410c);
  --ui-rts-accent-hover: var(--accent-hover, #9a3412);
  --ui-rts-accent-ink: var(--accent-fg, #fffdfb);
  --ui-rts-ok: var(--success, #1a7a4a);
  --ui-rts-focus: var(--accent, #c2410c);
  --ui-rts-dur-1: var(--nm-dur-1, 90ms);
  --ui-rts-dur-2: var(--nm-dur-2, 160ms);
  --ui-rts-dur-3: var(--nm-dur-3, 240ms);
  --ui-rts-dur-4: var(--nm-dur-4, 380ms);
  --ui-rts-dur-6: var(--nm-dur-6, 1100ms);
  --ui-rts-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-rts-ease-in: var(--nm-ease-in, cubic-bezier(0.55, 0, 0.68, 0.19));
  --ui-rts-spring: var(--nm-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  --ui-rts-ease-soft: var(--nm-ease-soft, cubic-bezier(0.4, 0, 0.2, 1));

  position: relative;
  box-sizing: border-box;
  display: grid;
  gap: 16px;
  width: 100%;
  padding: 18px;
  background: var(--ui-rts-panel);
  border-radius: var(--radius-panel, 20px);
  box-shadow: inset 0 0 0 1px var(--ui-rts-line);
  color: var(--ui-rts-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 18px;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-rts *,
.ui-rts *::before,
.ui-rts *::after {
  box-sizing: border-box;
}
.ui-rts p,
.ui-rts legend {
  margin: 0;
}
:where(.ui-rts) button {
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
:where(.ui-rts) svg {
  display: block;
}

/* Header ------------------------------------------------------------------ */
.ui-rts__head {
  display: grid;
  gap: 2px;
}
.ui-rts__title {
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  letter-spacing: -0.015em;
  color: var(--ui-rts-ink);
}
.ui-rts__sub {
  max-width: 52ch;
  font-size: 11.5px;
  line-height: 16px;
  color: var(--ui-rts-muted);
}

/* Sections ---------------------------------------------------------------- */
.ui-rts__section {
  display: grid;
  gap: 12px;
  min-width: 0;
}
.ui-rts__section + .ui-rts__section {
  padding-top: 14px;
  box-shadow: inset 0 1px 0 var(--ui-rts-line);
}
.ui-rts__section-title {
  font-size: 10.5px;
  font-weight: 500;
  line-height: 14px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ui-rts-muted);
}

/* Radio groups ------------------------------------------------------------ */
.ui-rts__group {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.ui-rts__group + .ui-rts__group {
  margin-top: 14px;
}
.ui-rts__legend {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  color: var(--ui-rts-ink);
}
.ui-rts__group-note {
  font-size: 11px;
  line-height: 15px;
  color: var(--ui-rts-muted);
}
.ui-rts__options {
  display: grid;
  gap: 3px;
  margin-top: 7px;
}
.ui-rts__option {
  position: relative;
  display: grid;
  grid-template-columns: 15px minmax(0, 1fr);
  gap: 0 10px;
  align-items: start;
  padding: 7px 10px 7px 9px;
  border-radius: var(--radius-preview, 12px);
  cursor: pointer;
  transition: background-color var(--ui-rts-dur-2) var(--ui-rts-ease-out);
}
.ui-rts__option:hover {
  background: var(--ui-rts-wash);
}
.ui-rts__option[data-checked="true"] {
  background: var(--ui-rts-wash-strong);
  box-shadow: inset 0 0 0 1px var(--ui-rts-edge);
}
.ui-rts__radio {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  height: 1px;
  margin: 0;
  opacity: 0;
  pointer-events: none;
}
.ui-rts__dot {
  position: relative;
  display: block;
  width: 15px;
  height: 15px;
  margin-top: 1.5px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--ui-rts-line);
}
.ui-rts__dot::after {
  content: "";
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  background: var(--ui-rts-on);
  transform: scale(0);
  transition: transform var(--ui-rts-dur-2) var(--ui-rts-spring);
}
.ui-rts__radio:checked + .ui-rts__dot {
  box-shadow: inset 0 0 0 1.5px var(--ui-rts-on);
}
.ui-rts__radio:checked + .ui-rts__dot::after {
  transform: scale(1);
}
.ui-rts__radio:focus-visible + .ui-rts__dot {
  box-shadow:
    inset 0 0 0 1.5px var(--ui-rts-on),
    0 0 0 2px var(--ui-rts-panel),
    0 0 0 4px var(--ui-rts-focus);
}
.ui-rts__option-text {
  display: grid;
  gap: 1px;
  min-width: 0;
}
.ui-rts__option-label {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ui-rts-ink);
}
.ui-rts__option[data-checked="true"] .ui-rts__option-label {
  font-weight: 500;
}
.ui-rts__option-note {
  font-size: 11px;
  line-height: 15px;
  color: var(--ui-rts-muted);
}

/* Switch rows ------------------------------------------------------------- */
.ui-rts__rows {
  display: grid;
}
.ui-rts__rows--divided {
  padding-top: 3px;
  box-shadow: inset 0 1px 0 var(--ui-rts-line);
}
.ui-rts__row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 9px 0;
  cursor: pointer;
}
.ui-rts__row + .ui-rts__row {
  box-shadow: inset 0 1px 0 var(--ui-rts-line);
}
.ui-rts__row-text {
  display: grid;
  gap: 1px;
  min-width: 0;
}
.ui-rts__row-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ui-rts-ink);
}
.ui-rts__row-note {
  font-size: 11px;
  line-height: 15px;
  color: var(--ui-rts-muted);
}
.ui-rts__switch {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  height: 1px;
  margin: 0;
  opacity: 0;
  pointer-events: none;
}
.ui-rts__track {
  position: relative;
  flex: none;
  width: 34px;
  height: 20px;
  border-radius: 999px;
  background: var(--ui-rts-track);
  transition: background-color var(--ui-rts-dur-2) var(--ui-rts-ease-out);
}
.ui-rts__knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--ui-rts-knob);
  box-shadow: 0 1px 2px #1a141040;
  transform: translateX(0);
  transition: transform var(--ui-rts-dur-3) var(--ui-rts-spring);
}
.ui-rts__switch:checked + .ui-rts__track {
  background: var(--ui-rts-on);
}
.ui-rts__switch:checked + .ui-rts__track .ui-rts__knob {
  transform: translateX(14px);
}
.ui-rts__switch:focus-visible + .ui-rts__track {
  box-shadow:
    0 0 0 2px var(--ui-rts-panel),
    0 0 0 4px var(--ui-rts-focus);
}

/* Segmented control ------------------------------------------------------- */
.ui-rts__segments {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 3px;
  margin-top: 7px;
  padding: 3px;
  border-radius: 11px;
  background: var(--ui-rts-wash);
  box-shadow: inset 0 0 0 1px var(--ui-rts-edge);
}
.ui-rts__segment {
  position: relative;
  display: grid;
  min-width: 0;
}
.ui-rts__segment-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition: background-color var(--ui-rts-dur-2) var(--ui-rts-ease-out);
}
.ui-rts__segment-input:hover {
  background: var(--ui-rts-wash-strong);
}
.ui-rts__segment-input:checked {
  background: var(--ui-rts-card);
  box-shadow:
    inset 0 0 0 1px var(--ui-rts-edge),
    0 1px 1px #1a14101a;
}
.ui-rts__segment-input:focus-visible {
  outline: 2px solid var(--ui-rts-focus);
  outline-offset: 1px;
}
.ui-rts__segment-text {
  position: relative;
  padding: 5px 8px;
  pointer-events: none;
  text-align: center;
  font-size: 11.5px;
  line-height: 16px;
  color: var(--ui-rts-muted);
  white-space: nowrap;
  transition: color var(--ui-rts-dur-2) var(--ui-rts-ease-out);
}
.ui-rts__segment-input:checked + .ui-rts__segment-text {
  color: var(--ui-rts-ink);
}
.ui-rts__note {
  margin-top: 7px;
  font-size: 11px;
  line-height: 15px;
  color: var(--ui-rts-muted);
}

/* Tags -------------------------------------------------------------------- */
.ui-rts__tag {
  display: inline-flex;
  flex: none;
  align-items: center;
  height: 15px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--ui-rts-wash-strong);
  box-shadow: inset 0 0 0 1px var(--ui-rts-edge);
  color: var(--ui-rts-tag-ink);
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}
.ui-rts__tag[data-kind="changed"] {
  background: var(--ui-rts-ink);
  box-shadow: none;
  color: var(--ui-rts-panel);
}

/* Save bar ---------------------------------------------------------------- */
.ui-rts__foot {
  display: grid;
  gap: 0;
}
.ui-rts__dock {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  padding: 8px 10px;
  border-radius: var(--radius-preview, 12px);
  background: var(--ui-rts-card);
  box-shadow: inset 0 0 0 1px var(--ui-rts-line);
  animation: ui-rts-dock-in var(--ui-rts-dur-4) var(--ui-rts-ease-out) both;
}
.ui-rts__dock[data-leaving="true"] {
  pointer-events: none;
  animation: ui-rts-dock-out var(--ui-rts-dur-3) var(--ui-rts-ease-in) both;
}
.ui-rts__count {
  font-size: 12px;
  line-height: 18px;
  color: var(--ui-rts-ink);
  white-space: nowrap;
}
.ui-rts__count b {
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.ui-rts__dock-note {
  flex: 1 1 120px;
  min-width: 0;
  font-size: 11px;
  line-height: 15px;
  color: var(--ui-rts-muted);
}
.ui-rts__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.ui-rts__reset {
  height: 28px;
  padding: 0 10px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px var(--ui-rts-line);
  color: var(--ui-rts-muted);
  font-size: 12px;
  transition:
    background-color var(--ui-rts-dur-2) var(--ui-rts-ease-out),
    color var(--ui-rts-dur-2) var(--ui-rts-ease-out);
}
.ui-rts__reset:hover:not(:disabled) {
  background: var(--ui-rts-wash);
  color: var(--ui-rts-ink);
}
.ui-rts__reset:focus-visible {
  outline: 2px solid var(--ui-rts-focus);
  outline-offset: 1px;
}
.ui-rts__reset:disabled {
  opacity: 0.5;
  cursor: default;
}
.ui-rts__save {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 12px;
  border-radius: 8px;
  background: var(--ui-rts-accent);
  color: var(--ui-rts-accent-ink);
  font-size: 12px;
  font-weight: 500;
  transition:
    background-color var(--ui-rts-dur-2) var(--ui-rts-ease-out),
    transform var(--ui-rts-dur-1) var(--ui-rts-ease-out),
    opacity var(--ui-rts-dur-2) var(--ui-rts-ease-out);
}
.ui-rts__save:hover:not(:disabled) {
  background: var(--ui-rts-accent-hover);
}
.ui-rts__save:active:not(:disabled) {
  transform: translateY(1px);
}
.ui-rts__save:focus-visible {
  outline: 2px solid var(--ui-rts-focus);
  outline-offset: 2px;
}
.ui-rts__save:disabled {
  opacity: 0.6;
  cursor: default;
}
.ui-rts__pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: ui-rts-breathe var(--ui-rts-dur-6) var(--ui-rts-ease-soft) infinite;
}
.ui-rts__saved {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 2px 0;
  font-size: 11.5px;
  line-height: 16px;
  color: var(--ui-rts-ok);
  animation: ui-rts-saved-in var(--ui-rts-dur-3) var(--ui-rts-ease-out) both;
}
.ui-rts__saved-glyph {
  display: grid;
  flex: none;
  place-items: center;
  width: 12px;
  height: 12px;
}

/* The live region repeats the visible count for a screen reader, because the bar
 * arrives after the edit that filled it. */
.ui-rts__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

@keyframes ui-rts-dock-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes ui-rts-dock-out {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(6px);
  }
}
@keyframes ui-rts-saved-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes ui-rts-breathe {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 1;
  }
}

:where(.dark, [data-theme="dark"]) .ui-rts {
  --ui-rts-panel: var(--panel, #1a1512);
  --ui-rts-card: var(--card, #201a15);
  --ui-rts-ink: var(--text, #f4ece4);
  --ui-rts-muted: var(--text-muted, #a2958a);
  --ui-rts-tag-ink: #b5a89d;
  --ui-rts-line: var(--border, #33291f);
  --ui-rts-edge: var(--border-soft, #ffffff12);
  --ui-rts-wash: #ffffff0d;
  --ui-rts-wash-strong: #ffffff14;
  --ui-rts-track: #ffffff24;
  --ui-rts-on: var(--primary, #f4ece4);
  --ui-rts-knob: var(--primary-fg, #14100d);
  --ui-rts-accent: var(--accent, #ff6b35);
  --ui-rts-accent-hover: var(--accent-hover, #ff8256);
  --ui-rts-accent-ink: var(--accent-fg, #1a0f08);
  --ui-rts-ok: var(--success, #4f9d6e);
  --ui-rts-focus: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  .ui-rts__dock,
  .ui-rts__saved,
  .ui-rts__pulse,
  .ui-rts__dot,
  .ui-rts__dot::after,
  .ui-rts__knob,
  .ui-rts__track,
  .ui-rts__option,
  .ui-rts__segment-input,
  .ui-rts__segment-text,
  .ui-rts__reset,
  .ui-rts__save {
    animation: none;
    transition-duration: 1ms;
  }
  .ui-rts__dock[data-leaving="true"] {
    opacity: 0;
  }
}
`;
