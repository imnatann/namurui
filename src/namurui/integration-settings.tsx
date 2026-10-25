"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

/*
 * Integration Settings – the settings card of one connected service, in a single self-contained file.
 * The switch in the header folds the settings away. The API key can be generated, revealed, copied and
 * regenerated in place; the site address is checked as it is typed; the time zone opens a small searchable
 * listbox. The save bar unfolds only while the value differs from what was last saved, and folds shut again
 * once the save lands or the changes are discarded.
 * The styles are injected below, so no extra files are needed.
 */

export type IntegrationValues = {
  /** Whether the service is switched on and its settings are unfolded */
  enabled: boolean;
  /** The key the service is called with; empty until one is generated */
  apiKey: string;
  /** Your store's primary domain, without the "https://" prefix */
  siteUrl: string;
  /** The picked time zone, e.g. "(GMT +01:00) Berlin" */
  timeZone: string;
};

export type IntegrationSettingsProps = {
  /** Name of the connected service, shown next to its mark */
  name?: string;
  /** Mark in the white tile; the Shopify mark is drawn when left out */
  logo?: ReactNode;
  /** Number of records the connection has pulled, shown next to the name */
  count?: number;
  /** Line under the name, e.g. "Connected on March 4, 2026 at 09:12" */
  meta?: string;
  /** The settings value; leave it out and the component keeps its own copy */
  value?: Partial<IntegrationValues>;
  /** Called with the complete next value on every edit */
  onChange?: (next: IntegrationValues) => void;
  /** Called by Save with the value on screen; resolving marks it saved, rejecting keeps the bar open */
  onSave?: (next: IntegrationValues) => void | Promise<void>;
  /** Called when the save rejects, so the failure can be shown above the card */
  onError?: (error: unknown) => void;
  /** Creates the replacement key; a random demo key when left out */
  createKey?: () => string | Promise<string>;
  /** Helper line under the address field */
  siteHint?: string;
  /** Choices offered in the time zone listbox */
  timeZones?: string[];
  className?: string;
};

/** The zones the picker offers when it is not given a list */
export const TIME_ZONES = [
  "(GMT −08:00) Los Angeles",
  "(GMT −05:00) New York",
  "(GMT −03:00) São Paulo",
  "(GMT +00:00) London",
  "(GMT +01:00) Berlin",
  "(GMT +02:00) Helsinki",
  "(GMT +04:00) Dubai",
  "(GMT +05:30) Mumbai",
  "(GMT +07:00) Bangkok",
  "(GMT +08:00) Singapore",
  "(GMT +09:00) Tokyo",
  "(GMT +10:00) Sydney",
];

const DEFAULT_VALUES: IntegrationValues = {
  enabled: true,
  apiKey: "",
  siteUrl: "",
  timeZone: "(GMT +01:00) Berlin",
};

const HOST = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,24}(?::\d{2,5})?$/i;

export function IntegrationSettings({
  name = "Shopify store",
  logo,
  count,
  meta = "Connected on March 4, 2026 at 09:12",
  value,
  onChange,
  onSave,
  onError,
  createKey,
  siteHint = "Your store's primary domain from Settings › Domains",
  timeZones = TIME_ZONES,
  className,
}: IntegrationSettingsProps) {
  const fieldId = useId();
  const hintId = useId();

  const [draft, setDraft] = useState<IntegrationValues>(() => ({ ...DEFAULT_VALUES, ...(value ?? {}) }));
  const [saved, setSaved] = useState<IntegrationValues>(() => ({ ...DEFAULT_VALUES, ...(value ?? {}) }));

  const current: IntegrationValues = value ? { ...DEFAULT_VALUES, ...value } : draft;

  const [zoneOpen, setZoneOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [busy, setBusy] = useState<"create" | "regenerate" | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const zoneRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const noteTimer = useRef<number | undefined>(undefined);

  const dirty =
    current.enabled !== saved.enabled ||
    current.apiKey !== saved.apiKey ||
    current.siteUrl !== saved.siteUrl ||
    current.timeZone !== saved.timeZone;

  const address = current.siteUrl.trim();
  const addressState: "empty" | "valid" | "invalid" =
    address === "" ? "empty" : HOST.test(address) ? "valid" : "invalid";
  const invalid = addressState === "invalid";

  const hasKey = current.apiKey.trim() !== "";
  const visibleZones = query.trim()
    ? timeZones.filter((zone) => zone.toLowerCase().includes(query.trim().toLowerCase()))
    : timeZones;

  useEffect(() => () => window.clearTimeout(noteTimer.current), []);

  useEffect(() => {
    if (!zoneOpen) return;
    searchRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (zoneRef.current?.contains(event.target as Node)) return;
      setZoneOpen(false);
      setQuery("");
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [zoneOpen]);

  const commit = (patch: Partial<IntegrationValues>) => {
    const next = { ...current, ...patch };
    if (!value) setDraft(next);
    onChange?.(next);
  };

  const announce = (message: string) => {
    setNote(message);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), 4200);
  };

  const generateKey = async (mode: "create" | "regenerate") => {
    if (busy) return;
    setBusy(mode);
    try {
      const nextKey = createKey ? await createKey() : demoKey();
      commit({ apiKey: nextKey });
      setKeyVisible(true);
      setFresh(true);
      announce("New key generated — copy it now, it is not shown again.");
    } finally {
      setBusy(null);
    }
  };

  const copyKey = async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(current.apiKey);
      setFresh(false);
      announce("Copied to clipboard.");
    } catch {
      setKeyVisible(true);
      announce("The browser blocked the clipboard — the key is shown, select and copy it.");
    }
  };

  const save = async () => {
    if (!dirty || saving || invalid) return;
    const snapshot = current;
    setSaving(true);
    try {
      await onSave?.(snapshot);
      setSaved(snapshot);
      setFresh(false);
    } catch (error) {
      onError?.(error);
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    if (!value) setDraft(saved);
    onChange?.(saved);
    setFresh(false);
  };

  const closeZone = () => {
    setZoneOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  };

  const pickZone = (zone: string) => {
    commit({ timeZone: zone });
    closeZone();
  };

  const focusOption = (index: number) => {
    if (index < 0 || index >= visibleZones.length) return;
    optionRefs.current[index]?.focus();
  };

  const onSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeZone();
    } else if (event.key === "Enter" && visibleZones.length === 1) {
      event.preventDefault();
      pickZone(visibleZones[0]);
    }
  };

  const onOptionKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (index === 0) searchRef.current?.focus();
      else focusOption(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusOption(visibleZones.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeZone();
    }
  };

  return (
    <section className={["ui-isc", className].filter(Boolean).join(" ")} aria-label={`${name} settings`}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-integration-settings" precedence="default">
        {css}
      </style>

      <header className="ui-isc__head">
        <span className="ui-isc__logo">{logo ?? <ShopifyMark />}</span>
        <span className="ui-isc__who">
          <span className="ui-isc__name">
            <span className="ui-isc__name-text">{name}</span>
            {count !== undefined ? <span className="ui-isc__count">{count}</span> : null}
          </span>
          <span className="ui-isc__meta">{meta}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={current.enabled}
          aria-label={`${name} sync`}
          className="ui-isc__switch"
          onClick={() => commit({ enabled: !current.enabled })}
        >
          <span />
        </button>
      </header>

      <div className="ui-isc__fold" data-open={current.enabled || undefined} inert={current.enabled ? undefined : true}>
        <div className="ui-isc__fold-inner">
          <div className="ui-isc__section">
            <span className="ui-isc__label">API key</span>
            {hasKey ? (
              <div className="ui-isc__key" data-new={fresh || undefined}>
                <code>{keyVisible ? current.apiKey : maskKey(current.apiKey)}</code>
                <button
                  type="button"
                  className="ui-isc__mini"
                  aria-label={keyVisible ? "Hide API key" : "Show API key"}
                  aria-pressed={keyVisible}
                  onClick={() => setKeyVisible((shown) => !shown)}
                >
                  {keyVisible ? <EyeOffGlyph /> : <EyeGlyph />}
                </button>
                <button type="button" className="ui-isc__mini" aria-label="Copy API key" onClick={copyKey}>
                  <CopyGlyph />
                </button>
                <button
                  type="button"
                  className="ui-isc__regen"
                  aria-label="Regenerate API key"
                  disabled={busy !== null}
                  onClick={() => generateKey("regenerate")}
                >
                  {busy === "regenerate" ? <span className="ui-isc__spinner" /> : "Regenerate"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="ui-isc__generate"
                disabled={busy !== null}
                onClick={() => generateKey("create")}
              >
                <span
                  className={busy === "create" ? "ui-isc__shimmer" : undefined}
                  data-text={busy === "create" ? "Generating a new API key" : undefined}
                >
                  {busy === "create" ? "Generating a new API key" : "Generate a new API key"}
                </span>
                {busy === "create" ? <span className="ui-isc__spinner" /> : <KeyGlyph />}
              </button>
            )}
            {note ? (
              <p className="ui-isc__note" role="status">
                {note}
              </p>
            ) : null}
          </div>

          <div className="ui-isc__section">
            <label className="ui-isc__label" htmlFor={fieldId}>
              Site address
            </label>
            <div className="ui-isc__field" data-invalid={invalid || undefined}>
              <span className="ui-isc__prefix">https://</span>
              <input
                id={fieldId}
                placeholder="yourstore.com"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={invalid}
                aria-describedby={hintId}
                value={current.siteUrl}
                onChange={(event) => commit({ siteUrl: event.target.value })}
              />
              {addressState === "valid" ? (
                <span className="ui-isc__ok" aria-hidden="true">
                  <CheckGlyph />
                </span>
              ) : null}
            </div>
            <p className="ui-isc__hint" id={hintId} data-error={invalid || undefined}>
              {invalid ? "Enter your store's domain, like yourstore.com" : siteHint}
            </p>
          </div>

          <div className="ui-isc__section">
            <span className="ui-isc__label" id={`${fieldId}-tz`}>
              Time zone
            </span>
            <div className="ui-isc__zone" ref={zoneRef}>
              <button
                type="button"
                ref={triggerRef}
                className="ui-isc__field ui-isc__zone-btn"
                aria-haspopup="listbox"
                aria-expanded={zoneOpen}
                aria-labelledby={`${fieldId}-tz`}
                onClick={() => (zoneOpen ? closeZone() : setZoneOpen(true))}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setZoneOpen(true);
                  }
                }}
              >
                <span className="ui-isc__zone-value">{current.timeZone}</span>
                <ClockGlyph />
              </button>

              {zoneOpen ? (
                <div className="ui-isc__menu">
                  <div className="ui-isc__menu-search">
                    <SearchGlyph />
                    <input
                      ref={searchRef}
                      value={query}
                      placeholder="Search time zones"
                      aria-label="Search time zones"
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={onSearchKeyDown}
                    />
                  </div>
                  {visibleZones.length > 0 ? (
                    <div className="ui-isc__menu-list" role="listbox" aria-label="Time zones">
                      {visibleZones.map((zone, index) => {
                        const selected = zone === current.timeZone;
                        return (
                          <button
                            key={zone}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            className="ui-isc__option"
                            ref={(node) => {
                              optionRefs.current[index] = node;
                            }}
                            onClick={() => pickZone(zone)}
                            onKeyDown={(event) => onOptionKeyDown(event, index)}
                          >
                            <span>{zone}</span>
                            {selected ? <CheckGlyph /> : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="ui-isc__menu-empty">No time zones match</p>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className="ui-isc__save" data-open={dirty || undefined} inert={dirty ? undefined : true}>
            <div className="ui-isc__save-inner">
              <span className="ui-isc__save-text">Unsaved changes</span>
              <div className="ui-isc__save-actions">
                <button type="button" className="ui-isc__btn" disabled={saving} onClick={discard}>
                  Discard
                </button>
                <button
                  type="button"
                  className="ui-isc__btn ui-isc__btn--primary"
                  disabled={saving || invalid}
                  onClick={save}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* icons and helpers */

function ShopifyMark() {
  return (
    <svg viewBox="0 0 24 24" fill="#7AB55C" aria-hidden="true">
      <path d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.045-.037-.075-.057-.121-.074l-.914 21.104h.023zM11.71 11.305s-.81-.424-1.774-.424c-1.447 0-1.504.906-1.504 1.141 0 1.232 3.24 1.715 3.24 4.629 0 2.295-1.44 3.76-3.406 3.76-2.354 0-3.54-1.465-3.54-1.465l.646-2.086s1.245 1.066 2.28 1.066c.675 0 .975-.545.975-.932 0-1.619-2.654-1.694-2.654-4.359-.034-2.237 1.571-4.416 4.827-4.416 1.257 0 1.875.361 1.875.361l-.945 2.715-.02.01zM11.17.83c.136 0 .271.038.405.135-.984.465-2.064 1.639-2.508 3.992-.656.213-1.293.405-1.889.578C7.697 3.75 8.951.84 11.17.84V.83zm1.235 2.949v.135c-.754.232-1.583.484-2.394.736.466-1.777 1.333-2.645 2.085-2.971.193.501.309 1.176.309 2.1zm.539-2.234c.694.074 1.141.867 1.429 1.755-.349.114-.735.231-1.158.366v-.252c0-.752-.096-1.371-.271-1.871v.002zm2.992 1.289c-.02 0-.06.021-.078.021s-.289.075-.714.21c-.423-1.233-1.176-2.37-2.508-2.37h-.115C12.135.209 11.669 0 11.265 0 8.159 0 6.675 3.877 6.21 5.846c-1.194.365-2.063.636-2.16.674-.675.213-.694.232-.772.87-.075.462-1.83 14.063-1.83 14.063L15.009 24l.927-21.166z" />
    </svg>
  );
}

function glyphProps() {
  return {
    className: "ui-isc__glyph",
    viewBox: "0 0 16 16",
    width: 16,
    height: 16,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": "true" as const,
  };
}

function KeyGlyph() {
  return (
    <svg
      className="ui-isc__glyph-solid"
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M10.5 1.5a4 4 0 0 0-3.86 5.05L1.8 11.4a1 1 0 0 0-.3.7v1.9a.5.5 0 0 0 .5.5h1.9a.5.5 0 0 0 .5-.5V13h1v-1h1v-1l.95-.95A4 4 0 1 0 10.5 1.5Zm1 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg {...glyphProps()}>
      <path d="m3.5 8.5 3 3 6-7" />
    </svg>
  );
}

function ClockGlyph() {
  return (
    <svg {...glyphProps()}>
      <path d="M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM8 4.5V8l2.5 1.5" />
    </svg>
  );
}

function EyeGlyph() {
  return (
    <svg {...glyphProps()}>
      <path d="M1.7 8S4 4.3 8 4.3 14.3 8 14.3 8 12 11.7 8 11.7 1.7 8 1.7 8Z" />
      <path d="M8 6.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z" />
    </svg>
  );
}

function EyeOffGlyph() {
  return (
    <svg {...glyphProps()}>
      <path d="M1.7 8S4 4.3 8 4.3c1.2 0 2.2.3 3.1.8M14.3 8s-2.3 3.7-6.3 3.7c-1.2 0-2.2-.3-3.1-.8" />
      <path d="M2.6 2.6l10.8 10.8" />
    </svg>
  );
}

function CopyGlyph() {
  return (
    <svg {...glyphProps()}>
      <path d="M6.2 6H3.5a1 1 0 0 0-1 1v5.5a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1V9.8" />
      <path d="M7 2.5h5.5a1 1 0 0 1 1 1V9a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function SearchGlyph() {
  return (
    <svg {...glyphProps()}>
      <path d="M7.2 12.4a5.2 5.2 0 1 0 0-10.4 5.2 5.2 0 0 0 0 10.4ZM11.1 11.1l3 3" />
    </svg>
  );
}

/** Keeps the shape of the key readable without showing it. */
function maskKey(key: string): string {
  if (key.length <= 10) return "•".repeat(Math.max(8, key.length));
  return `${key.slice(0, 6)}${"•".repeat(10)}${key.slice(-4)}`;
}

/** A Shopify-shaped key, so the demo has something real to copy. */
function demoKey(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return `shpat_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

const css = /* css */ `
.ui-isc{--ui-isc-card: #fffdfb;--ui-isc-ink: rgba(11, 9, 8, 0.88);--ui-isc-strong: #0b0908;--ui-isc-text: rgba(11, 9, 8, 0.61);--ui-isc-muted: rgba(11, 9, 8, 0.45);--ui-isc-faint: rgba(11, 9, 8, 0.27);--ui-isc-icon: rgba(11, 9, 8, 0.447);--ui-isc-line: rgba(11, 9, 8, 0.06);--ui-isc-fill: rgba(11, 9, 8, 0.06);--ui-isc-fill-strong: rgba(11, 9, 8, 0.1);--ui-isc-wash: rgba(11, 9, 8, 0.03);--ui-isc-accent: rgba(217, 84, 31, 0.765);--ui-isc-ok: #2f8d5c;--ui-isc-ok-soft: rgba(47, 141, 92, 0.08);--ui-isc-danger: #e2544a;--ui-isc-danger-soft: rgba(226, 84, 74, 0.08);--ui-isc-solid: rgba(11, 9, 8, 0.88);--ui-isc-solid-hover: rgba(11, 9, 8, 0.8);--ui-isc-on-solid: #fcf9f7;--ui-isc-switch-off: rgba(11, 9, 8, 0.12);--ui-isc-shine: rgba(255, 253, 251, 0.82);--ui-isc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-isc-shadow-hover: 0 0 0 0.5px rgba(11, 9, 8, 0.12), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-isc-shadow-pop: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 12px 28px -10px rgba(11, 9, 8, 0.16), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-isc-focus: rgba(217, 84, 31, 0.35);--ui-isc-ease: cubic-bezier(0.22, 1, 0.36, 1);box-sizing: border-box;container-type: inline-size;width: 100%;max-width: 560px;border-radius: 10px;background: var(--ui-isc-card);box-shadow: var(--ui-isc-shadow);font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;font-weight: 400;color: var(--ui-isc-ink);-webkit-font-smoothing: antialiased}
.ui-isc *, .ui-isc *::before, .ui-isc *::after{box-sizing: border-box}
:where(.ui-isc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;cursor: pointer}
:where(.ui-isc) svg{display: block;flex: none}
.ui-isc button:focus-visible{outline: 2px solid var(--ui-isc-focus);outline-offset: 1px}
.ui-isc__head{display: flex;align-items: center;gap: 12px;padding: 16px}
.ui-isc__logo{display: grid;place-items: center;flex: none;width: 40px;height: 40px;border-radius: 8px;background: var(--ui-isc-card);box-shadow: var(--ui-isc-shadow)}
.ui-isc__logo svg{width: 22px;height: 22px}
.ui-isc__who{display: grid;flex: 1;min-width: 0}
.ui-isc__name{display: flex;align-items: center;gap: 8px;min-width: 0;font-size: 15px;line-height: 24px;font-weight: 500;color: var(--ui-isc-strong)}
.ui-isc__name-text{min-width: 0;overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-isc__count{flex: none;padding: 0 5px;border-radius: 5px;background: var(--ui-isc-fill);font-size: 11px;line-height: 16px;font-weight: 500;font-variant-numeric: tabular-nums;color: var(--ui-isc-text)}
.ui-isc__meta{overflow: hidden;font-size: 12px;line-height: 16px;white-space: nowrap;text-overflow: ellipsis;color: var(--ui-isc-muted)}
.ui-isc__switch{position: relative;flex: none;width: 28px;height: 16px;border-radius: 8px;background: var(--ui-isc-switch-off) !important;transition: background-color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-isc__switch[aria-checked="true"]{background: var(--ui-isc-accent) !important}
.ui-isc__switch span{position: absolute;top: 2px;left: 2px;width: 12px;height: 12px;border-radius: 50%;background: #fffdfb;box-shadow: var(--ui-isc-shadow);transition: transform var(--nm-dur-3, 240ms) var(--ui-isc-ease)}
.ui-isc__switch[aria-checked="true"] span{transform: translateX(12px)}
.ui-isc__switch::after{content: "";position: absolute;inset: -8px -6px}
.ui-isc__fold{display: grid;grid-template-columns: minmax(0, 1fr);grid-template-rows: 0fr;opacity: 0;transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-isc-ease), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-isc__fold[data-open]{grid-template-rows: 1fr;opacity: 1}
.ui-isc__fold-inner{min-width: 0;min-height: 0;overflow: hidden}
.ui-isc__fold[data-open] .ui-isc__fold-inner{overflow: visible}
.ui-isc__section{padding: 14px 16px 16px;border-top: 0.5px solid var(--ui-isc-line)}
.ui-isc__label{display: block;margin: 0 0 6px;font-size: 13px;line-height: 20px;font-weight: 500;color: var(--ui-isc-ink)}
.ui-isc__generate{display: flex;align-items: center;justify-content: space-between;gap: 8px;width: 100%;height: 32px;padding: 0 8px 0 10px !important;border-radius: 8px;background: var(--ui-isc-wash) !important;box-shadow: inset 0 0 0 0.5px var(--ui-isc-line);color: var(--ui-isc-text) !important;text-align: left;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-isc__generate svg{color: var(--ui-isc-icon);transition: color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-isc__generate:hover:not(:disabled){background: var(--ui-isc-fill) !important;color: var(--ui-isc-ink) !important}
.ui-isc__generate:hover:not(:disabled) svg{color: var(--ui-isc-ink)}
.ui-isc__generate:disabled{cursor: progress}
.ui-isc__key{display: flex;align-items: center;gap: 2px;height: 36px;padding: 0 4px 0 10px;border-radius: 8px;background: var(--ui-isc-card);box-shadow: var(--ui-isc-shadow);transition: background-color 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));animation: ui-isc-in var(--nm-dur-4, 380ms) var(--ui-isc-ease)}
.ui-isc__key[data-new]{background: var(--ui-isc-ok-soft);box-shadow: none}
.ui-isc__key code{flex: 1;min-width: 0;overflow: hidden;font-family: ui-monospace, SFMono-Regular, Menlo, monospace;font-size: 12px;line-height: 16px;white-space: nowrap;text-overflow: ellipsis;color: var(--ui-isc-ink)}
.ui-isc__mini{display: grid;place-items: center;flex: none;width: 28px;height: 28px;border-radius: 6px;color: var(--ui-isc-icon) !important;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-isc__mini:hover{background: var(--ui-isc-wash) !important;color: var(--ui-isc-ink) !important}
.ui-isc__key[data-new] .ui-isc__mini:hover{background: var(--ui-isc-fill) !important}
.ui-isc__regen{display: grid;place-items: center;flex: none;min-width: 88px;height: 28px;margin-left: 2px;padding: 0 10px !important;border-radius: 6px;background: var(--ui-isc-card) !important;box-shadow: var(--ui-isc-shadow);font-size: 13px;font-weight: 500;color: var(--ui-isc-strong) !important;transition: box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-isc__regen:hover:not(:disabled){box-shadow: var(--ui-isc-shadow-hover)}
.ui-isc__regen:disabled{cursor: progress}
.ui-isc__note{margin: 6px 0 0;font-size: 12px;line-height: 16px;color: var(--ui-isc-ok);animation: ui-isc-in 240ms var(--ui-isc-ease)}
.ui-isc__spinner{width: 14px;height: 14px;border: 1.5px solid var(--ui-isc-fill-strong);border-top-color: var(--ui-isc-ink);border-radius: 50%;animation: ui-isc-spin var(--nm-dur-5, 620ms) linear infinite}
.ui-isc__field{display: flex;align-items: center;gap: 2px;width: 100%;height: 32px;padding: 0 8px 0 10px;border-radius: 8px;background: var(--ui-isc-card);box-shadow: var(--ui-isc-shadow);transition: box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-isc__field:hover{box-shadow: var(--ui-isc-shadow-hover)}
.ui-isc__field:focus-within{outline: 2px solid var(--ui-isc-focus);outline-offset: 1px}
.ui-isc__field[data-invalid]{background: var(--ui-isc-danger-soft);box-shadow: none}
.ui-isc__field[data-invalid]:focus-within{outline-color: rgba(226, 84, 74, 0.35)}
.ui-isc__prefix{flex: none;color: var(--ui-isc-faint)}
.ui-isc__field input{flex: 1;min-width: 0;height: 100%;margin: 0;padding: 0;border: 0;outline: none;background: transparent;font: inherit;color: var(--ui-isc-ink)}
.ui-isc__field input::placeholder{color: var(--ui-isc-faint)}
.ui-isc__ok{display: grid;flex: none;color: var(--ui-isc-ok);animation: ui-isc-in 240ms var(--ui-isc-ease)}
.ui-isc__hint{margin: 6px 0 0;font-size: 12px;line-height: 16px;color: var(--ui-isc-muted)}
.ui-isc__hint[data-error]{color: var(--ui-isc-danger)}
.ui-isc__zone{position: relative}
.ui-isc__zone-btn{justify-content: space-between;gap: 8px;padding: 0 8px 0 10px !important;text-align: left;background: var(--ui-isc-card) !important;color: var(--ui-isc-ink) !important}
.ui-isc__zone-btn:focus-visible{outline-offset: 1px}
.ui-isc__zone-value{min-width: 0;overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-isc__zone-btn svg{color: var(--ui-isc-icon)}
.ui-isc__menu{position: absolute;top: calc(100% + 6px);left: 0;right: 0;z-index: 10;padding: 4px;border-radius: 10px;background: var(--ui-isc-card);box-shadow: var(--ui-isc-shadow-pop);transform-origin: top center;animation: ui-isc-drop var(--nm-dur-2, 160ms) var(--ui-isc-ease)}
.ui-isc__menu-search{display: flex;align-items: center;gap: 8px;height: 32px;margin: 0 0 4px;padding: 0 8px;border-bottom: 0.5px solid var(--ui-isc-line);color: var(--ui-isc-icon)}
.ui-isc__menu-search input{flex: 1;min-width: 0;height: 100%;margin: 0;padding: 0;border: 0;outline: none;background: transparent;font: inherit;color: var(--ui-isc-ink)}
.ui-isc__menu-search input::placeholder{color: var(--ui-isc-faint)}
.ui-isc__menu-list{display: grid;gap: 1px;max-height: 200px;overflow-y: auto;overscroll-behavior: contain;scrollbar-width: thin}
.ui-isc__option{display: flex;align-items: center;justify-content: space-between;gap: 8px;min-height: 32px;padding: 0 8px !important;border-radius: 6px;background: transparent;color: var(--ui-isc-ink) !important;text-align: left;transition: background-color 90ms ease-out}
.ui-isc__option:hover{background: var(--ui-isc-fill) !important}
.ui-isc__option svg{color: var(--ui-isc-accent);animation: ui-isc-pop var(--nm-dur-3, 240ms) var(--ui-isc-ease)}
.ui-isc__menu-empty{margin: 0;padding: 10px 8px;text-align: center;color: var(--ui-isc-muted)}
.ui-isc__save{display: grid;grid-template-columns: minmax(0, 1fr);grid-template-rows: 0fr;transition: grid-template-rows var(--nm-dur-4, 380ms) var(--ui-isc-ease)}
.ui-isc__save[data-open]{grid-template-rows: 1fr}
.ui-isc__save-inner{display: flex;align-items: center;justify-content: space-between;gap: 12px;min-height: 0;overflow: hidden;padding: 0 12px 0 16px;border-top: 0.5px solid var(--ui-isc-line);color: var(--ui-isc-text)}
.ui-isc__save[data-open] .ui-isc__save-inner{padding-top: 10px;padding-bottom: 10px}
.ui-isc__save-text{min-width: 0;overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-isc__save-actions{display: flex;flex: none;gap: 6px}
.ui-isc__btn{height: 28px;padding: 0 10px !important;border-radius: 6px;background: var(--ui-isc-card) !important;box-shadow: var(--ui-isc-shadow);font-size: 13px;font-weight: 500;color: var(--ui-isc-strong) !important;transition: box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-isc__btn:hover:not(:disabled){box-shadow: var(--ui-isc-shadow-hover)}
.ui-isc__btn--primary{min-width: 56px;background: var(--ui-isc-solid) !important;box-shadow: none;color: var(--ui-isc-on-solid) !important}
.ui-isc__btn--primary:hover:not(:disabled){background: var(--ui-isc-solid-hover) !important;box-shadow: none}
.ui-isc__btn--primary:disabled{opacity: 0.4;cursor: default}
.ui-isc__shimmer{position: relative;display: inline-block}
.ui-isc__shimmer::after{content: attr(data-text);content: attr(data-text) / "";position: absolute;inset: 0;white-space: nowrap;color: transparent;background: linear-gradient(90deg, transparent 38%, var(--ui-isc-shine) 50%, transparent 62%) 100% 0 / 300% 100% no-repeat;-webkit-background-clip: text;background-clip: text;animation: ui-isc-sweep var(--nm-dur-6, 1100ms) linear infinite;pointer-events: none}
@keyframes ui-isc-in{from{opacity: 0;transform: translateY(2px)}
}
@keyframes ui-isc-drop{from{opacity: 0;transform: translateY(-4px) scale(0.98)}
}
@keyframes ui-isc-pop{from{opacity: 0;transform: scale(0.5)}
}
@keyframes ui-isc-spin{to{transform: rotate(360deg)}
}
@keyframes ui-isc-sweep{from{background-position: 100% 0}
to{background-position: 0% 0}
}
@container (max-width: 400px){.ui-isc__head{gap: 10px;padding: 14px 14px 14px 12px}
.ui-isc__logo{width: 36px;height: 36px}
.ui-isc__logo svg{width: 20px;height: 20px}
.ui-isc__section{padding: 12px 12px 14px}
.ui-isc__regen{min-width: 0}
.ui-isc__save-inner{padding: 0 10px 0 12px}
}
@media (hover: none) and (pointer: coarse){.ui-isc__field, .ui-isc__generate{height: 40px}
.ui-isc__field input, .ui-isc__menu-search input{font-size: 16px}
.ui-isc__key{height: 44px}
.ui-isc__mini{width: 36px;height: 36px}
.ui-isc__regen, .ui-isc__btn{height: 36px}
.ui-isc__menu-search{height: 40px}
.ui-isc__option{min-height: 44px}
}
@media (prefers-reduced-motion: reduce){.ui-isc *, .ui-isc *::before, .ui-isc *::after{animation: none !important;transition: none !important}
}
.ui-isc input:not([type="checkbox"]):not([type="radio"]):focus-visible, .ui-isc textarea:focus-visible, .ui-isc [contenteditable]:focus-visible{outline: none}
:where(.dark, [data-theme="dark"]) .ui-isc{--ui-isc-card: #211b16;--ui-isc-ink: rgba(255, 253, 251, 0.9);--ui-isc-strong: #fffdfb;--ui-isc-text: rgba(255, 253, 251, 0.62);--ui-isc-muted: rgba(255, 253, 251, 0.46);--ui-isc-faint: rgba(255, 253, 251, 0.3);--ui-isc-icon: rgba(255, 253, 251, 0.5);--ui-isc-line: rgba(255, 253, 251, 0.08);--ui-isc-fill: rgba(255, 253, 251, 0.08);--ui-isc-fill-strong: rgba(255, 253, 251, 0.13);--ui-isc-wash: rgba(255, 253, 251, 0.04);--ui-isc-accent: #ff8a5c;--ui-isc-ok: #2f8d5c;--ui-isc-ok-soft: rgba(47, 141, 92, 0.14);--ui-isc-danger: #e2544a;--ui-isc-danger-soft: rgba(226, 84, 74, 0.14);--ui-isc-solid: rgba(255, 253, 251, 0.9);--ui-isc-solid-hover: rgba(255, 253, 251, 0.82);--ui-isc-on-solid: #1c1713;--ui-isc-switch-off: rgba(255, 253, 251, 0.16);--ui-isc-shine: #fffdfb;--ui-isc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-isc-shadow-hover: 0 0 0 0.5px rgba(255, 253, 251, 0.16), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-isc-shadow-pop: 0 0 0 0.5px rgba(255, 253, 251, 0.12), 0 12px 28px -10px rgba(11, 9, 8, 0.6);--ui-isc-focus: rgba(255, 138, 92, 0.5)}
:where(.dark, [data-theme="dark"]) .ui-isc__switch span{background: #f4ece4;box-shadow: 0 1px 2px rgba(11, 9, 8, 0.4)}
:where(.dark, [data-theme="dark"]) .ui-isc__menu{background: #27201a}

`;
