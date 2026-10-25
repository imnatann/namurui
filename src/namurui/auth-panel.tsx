"use client";

import { useId, useState, type ReactNode } from "react";

/*
 * Auth panel: the model providers OMP can sign in to, which of them already hold a
 * credential, and the accounts behind each one. Sign-in leaves the panel — the row waits on
 * the browser handoff until the bridge reports a credential — so the pending row says what is
 * actually happening instead of claiming success, and the panel never asks for a key. An
 * account list folds out beneath its provider on the element step; a sign-out that leaves
 * another credential behind says so quietly at the foot. Styles are injected below, so no
 * extra files are needed.
 */

export type AuthProviderAccount = {
  /** Credential id from `get_logout_accounts`, sent back with `logout` */
  credentialId: string;
  /** What the bridge calls the account, usually the address or key name */
  label: string;
  /** ISO timestamp of when the credential was added */
  addedAt?: string;
};

export type AuthProvider = {
  /** Provider id sent back with `login` */
  id: string;
  /** Display name, e.g. "Anthropic" */
  name: string;
  /** False when the bridge reports the provider cannot sign in right now */
  available: boolean;
  /** True when at least one credential is stored */
  authenticated: boolean;
  /** Accounts from `get_logout_accounts`; omit until they have been fetched */
  accounts?: readonly AuthProviderAccount[];
};

export type AuthPanelProps = {
  /** Providers from `get_login_providers`, in row order */
  providers: readonly AuthProvider[];
  /** Called with the provider id when Sign in is pressed */
  onLogin?: (providerId: string) => void;
  /** Called with the provider and credential id when an account is signed out */
  onLogout?: (providerId: string, credentialId: string) => void;
  /** Provider whose login is in flight; its row waits on the browser handoff */
  pendingProviderId?: string;
  /** Quiet line shown after a logout, e.g. "Still signed in via github-copilot" */
  notice?: ReactNode;
  /** Expanded provider when the caller owns the disclosure; omit for internal state */
  expandedId?: string | null;
  /** Called with the next expanded provider id, or null when a row folds shut */
  onExpandedChange?: (providerId: string | null) => void;
  /** Extra class on the root */
  className?: string;
};

type Tone = "ok" | "muted" | "warn";

/* A badge always carries a glyph and a word, so a state is never read from colour alone */
function Badge({ tone, glyph, children }: { tone: Tone; glyph: ReactNode; children: ReactNode }) {
  return (
    <span className="ui-aup__badge" data-tone={tone}>
      <span className="ui-aup__badge-glyph" aria-hidden="true">
        {glyph}
      </span>
      {children}
    </span>
  );
}

const CHECK = (
  <svg
    viewBox="0 0 12 12"
    width="11"
    height="11"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2.2 6.3 4.8 8.9 9.8 3.4" />
  </svg>
);

/* A struck circle, not a warning triangle: the provider is not reachable, nothing is broken */
const BLOCKED = (
  <svg
    viewBox="0 0 12 12"
    width="11"
    height="11"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <circle cx="6" cy="6" r="4.3" />
    <path d="M3.1 8.9 8.9 3.1" />
  </svg>
);

const CHEVRON = (
  <svg
    viewBox="0 0 12 12"
    width="12"
    height="12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2.8 4.5 6 7.7l3.2-3.2" />
  </svg>
);

/* The ring is drawn at full opacity; the animation only turns it */
const SPINNER = (
  <svg viewBox="0 0 14 14" width="11" height="11" fill="none" aria-hidden="true">
    <circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1.8" />
    <path
      d="M7 1.8a5.2 5.2 0 0 1 5.2 5.2"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

/* Out of the panel and into the browser, which is where the handoff actually happens */
const HANDOFF = (
  <svg
    viewBox="0 0 12 12"
    width="12"
    height="12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6.8 1.8h3.4v3.4" />
    <path d="M10.2 1.8 5.4 6.6" />
    <path d="M9.2 7.6v2.2a.6.6 0 0 1-.6.6H2.4a.6.6 0 0 1-.6-.6V3.4a.6.6 0 0 1 .6-.6h2.2" />
  </svg>
);

/* Fixed to UTC and to one format, so the same credential reads the same on every host */
const ADDED = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/* A neutral monogram: the first letter of the name, never a brand mark */
function monogram(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toUpperCase() : "?";
}

/* An unparseable timestamp is dropped rather than printed as "Invalid Date" */
function addedLabel(iso: string): string | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : ADDED.format(date);
}

export function AuthPanel({
  providers,
  onLogin,
  onLogout,
  pendingProviderId,
  notice,
  expandedId,
  onExpandedChange,
  className,
}: AuthPanelProps) {
  const base = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const titleId = `ui-aup-${base}-title`;
  const [ownOpen, setOwnOpen] = useState<string | null>(null);
  const open = expandedId === undefined ? ownOpen : expandedId;
  const signedIn = providers.filter((provider) => provider.authenticated).length;
  const waiting = pendingProviderId !== undefined;

  const toggle = (providerId: string) => {
    const next = open === providerId ? null : providerId;
    if (expandedId === undefined) setOwnOpen(next);
    onExpandedChange?.(next);
  };

  return (
    <div
      className={["ui-aup", className].filter(Boolean).join(" ")}
      role="group"
      aria-labelledby={titleId}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-auth-panel" precedence="default">
        {css}
      </style>

      <div className="ui-aup__head">
        <p className="ui-aup__title" id={titleId}>
          Model providers
        </p>
        <p className="ui-aup__summary" data-pending={waiting ? "true" : undefined}>
          {waiting
            ? "Waiting for the browser"
            : `${signedIn} of ${providers.length} signed in`}
        </p>
      </div>

      {providers.length === 0 ? (
        <p className="ui-aup__empty-panel">No providers were reported by the bridge.</p>
      ) : (
        <ul className="ui-aup__list">
          {providers.map((provider) => {
            const isOpen = provider.authenticated && open === provider.id;
            const isPending = provider.id === pendingProviderId;
            const accounts = provider.accounts;
            const accountCount =
              accounts === undefined
                ? "accounts"
                : accounts.length === 1
                  ? "1 account"
                  : `${accounts.length} accounts`;
            /* Provider ids are protocol strings; keep the DOM id safe whatever they contain */
            const panelId = `ui-aup-${base}-p-${provider.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
            return (
              <li
                key={provider.id}
                className="ui-aup__row"
                data-authenticated={provider.authenticated ? "true" : "false"}
                data-available={provider.available ? "true" : "false"}
                data-pending={isPending ? "true" : undefined}
                data-open={isOpen ? "true" : "false"}
              >
                <div className="ui-aup__row-main">
                  <span className="ui-aup__monogram" aria-hidden="true">
                    {monogram(provider.name)}
                  </span>

                  <span className="ui-aup__ident">
                    <span className="ui-aup__name" title={provider.name}>
                      {provider.name}
                    </span>
                    <span className="ui-aup__meta">
                      {provider.authenticated ? (
                        <Badge tone="ok" glyph={CHECK}>
                          Signed in
                        </Badge>
                      ) : null}
                      {provider.available ? null : (
                        <Badge tone="muted" glyph={BLOCKED}>
                          Unavailable
                        </Badge>
                      )}
                      {isPending ? (
                        <Badge
                          tone="warn"
                          glyph={<span className="ui-aup__spin">{SPINNER}</span>}
                        >
                          Waiting
                        </Badge>
                      ) : null}
                    </span>
                  </span>

                  <span className="ui-aup__actions">
                    {provider.authenticated ? (
                      <button
                        type="button"
                        className="ui-aup__disclosure"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        aria-label={`${isOpen ? "Hide" : "Show"} ${accountCount} for ${provider.name}`}
                        onClick={() => toggle(provider.id)}
                      >
                        {accountCount}
                        <span className="ui-aup__chevron" aria-hidden="true">
                          {CHEVRON}
                        </span>
                      </button>
                    ) : null}

                    <button
                      type="button"
                      className="ui-aup__signin"
                      aria-label={`Sign in to ${provider.name}`}
                      disabled={!provider.available || isPending}
                      onClick={() => onLogin?.(provider.id)}
                    >
                      Sign in
                    </button>
                  </span>
                </div>

                {isPending ? (
                  <p className="ui-aup__pending" role="status">
                    <span className="ui-aup__pending-glyph" aria-hidden="true">
                      {HANDOFF}
                    </span>
                    Finish signing in in your browser
                  </p>
                ) : null}

                {provider.authenticated ? (
                  <div
                    className="ui-aup__accounts"
                    id={panelId}
                    hidden={!isOpen}
                    role="group"
                    aria-label={`Accounts for ${provider.name}`}
                  >
                    {accounts && accounts.length > 0 ? (
                      <ul className="ui-aup__account-list">
                        {accounts.map((account) => {
                          const added = account.addedAt ? addedLabel(account.addedAt) : null;
                          return (
                            <li className="ui-aup__account" key={account.credentialId}>
                              <span className="ui-aup__account-text">
                                <span className="ui-aup__account-label" title={account.label}>
                                  {account.label}
                                </span>
                                {added ? (
                                  <span className="ui-aup__account-added">Added {added}</span>
                                ) : null}
                              </span>
                              <button
                                type="button"
                                className="ui-aup__signout"
                                aria-label={`Sign out ${account.label} from ${provider.name}`}
                                onClick={() => onLogout?.(provider.id, account.credentialId)}
                              >
                                Sign out
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="ui-aup__empty">No stored accounts reported for this provider.</p>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {notice ? (
        <p className="ui-aup__notice" role="status">
          <span className="ui-aup__notice-dot" aria-hidden="true" />
          {notice}
        </p>
      ) : null}

      <p className="ui-aup__foot">
        This panel never asks for a key. Sign-in happens in your browser.
      </p>
    </div>
  );
}

const css = /* css */ `
.ui-aup {
  /* Knobs. Override any of these on .ui-aup to retheme the panel in a host. */
  --ui-aup-ink: var(--text, #1a1410);
  --ui-aup-muted: var(--text-muted, #6f625a);
  --ui-aup-panel: var(--panel, #fffdfb);
  --ui-aup-card: var(--card, #faf6f1);
  --ui-aup-line: var(--border, #e8e0d7);
  --ui-aup-edge: var(--border-soft, #1a14101a);
  --ui-aup-wash: #7a4a1c0a;
  --ui-aup-tile: #7a4a1c12;
  --ui-aup-ok: var(--success, #1a7a4a);
  --ui-aup-warn: var(--warning, #9a6410);
  --ui-aup-danger: var(--danger, #b3261e);
  --ui-aup-accent: var(--accent, #c2410c);
  --ui-aup-focus: var(--accent, #c2410c);
  --ui-aup-dur-1: var(--nm-dur-1, 90ms);
  --ui-aup-dur-2: var(--nm-dur-2, 160ms);
  --ui-aup-dur-3: var(--nm-dur-3, 240ms);
  --ui-aup-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-aup-ease-both: var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1));
  --ui-aup-ease-soft: var(--nm-ease-soft, cubic-bezier(0.4, 0, 0.2, 1));
  --ui-aup-spin: var(--nm-dur-6, 1100ms);

  box-sizing: border-box;
  display: grid;
  gap: 10px;
  width: 100%;
  padding: 16px 16px 14px;
  background: var(--ui-aup-panel);
  border-radius: var(--radius-card, 16px);
  box-shadow: inset 0 0 0 1px var(--ui-aup-line);
  color: var(--ui-aup-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 18px;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.ui-aup *,
.ui-aup *::before,
.ui-aup *::after {
  box-sizing: border-box;
}
:where(.ui-aup) p,
:where(.ui-aup) ul,
:where(.ui-aup) li {
  margin: 0;
  padding: 0;
}
:where(.ui-aup) button {
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
:where(.ui-aup) svg {
  display: block;
}

/* Header ------------------------------------------------------------------ */
.ui-aup__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 2px 12px;
  min-height: 20px;
}
.ui-aup__title {
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  color: var(--ui-aup-ink);
}
.ui-aup__summary {
  font-size: 11.5px;
  line-height: 18px;
  color: var(--ui-aup-muted);
  font-variant-numeric: tabular-nums;
  transition: color var(--ui-aup-dur-2) var(--ui-aup-ease-out);
}
/* The summary carries the word "waiting" as well as the tone, so it reads without colour */
.ui-aup__summary[data-pending="true"] {
  color: var(--ui-aup-warn);
}

/* Rows -------------------------------------------------------------------- */
.ui-aup__list {
  display: grid;
  gap: 6px;
  list-style: none;
}
.ui-aup__row {
  position: relative;
  padding: 10px 12px;
  border-radius: var(--radius-preview, 12px);
  background: var(--ui-aup-card);
  box-shadow: inset 0 0 0 1px var(--ui-aup-edge);
}
/* The live row gets the one ember mark on the surface; it grows from the top so the
 * pending state arrives as something starting rather than a stripe appearing. */
.ui-aup__row[data-pending="true"]::before {
  content: "";
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 2px;
  border-radius: 999px;
  background: var(--ui-aup-accent);
  transform: scaleY(0);
  transform-origin: 50% 0;
  animation: ui-aup-rail var(--ui-aup-dur-3) var(--ui-aup-ease-out) forwards;
}
.ui-aup__row[data-pending="true"] {
  box-shadow: inset 0 0 0 1px var(--ui-aup-line);
}
.ui-aup__row-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
}
.ui-aup__monogram {
  display: grid;
  flex: none;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--ui-aup-tile);
  box-shadow: inset 0 0 0 1px var(--ui-aup-edge);
  color: var(--ui-aup-ink);
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  user-select: none;
}
.ui-aup__ident {
  display: grid;
  flex: 1 1 120px;
  gap: 1px;
  min-width: 0;
}
.ui-aup__name {
  overflow: hidden;
  font-size: 12.5px;
  font-weight: 500;
  line-height: 17px;
  color: var(--ui-aup-ink);
  white-space: nowrap;
  text-overflow: ellipsis;
}
/* A provider the bridge cannot reach is quiet, not struck through: it is a fact, not a fault */
.ui-aup__row[data-available="false"] .ui-aup__name {
  color: var(--ui-aup-muted);
}
.ui-aup__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px 6px;
}
.ui-aup__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 18px;
  padding: 0 7px;
  border-radius: var(--radius-pill, 999px);
  background: var(--ui-aup-wash);
  color: var(--ui-aup-muted);
  font-size: 10.5px;
  font-weight: 500;
  line-height: 14px;
  white-space: nowrap;
  transition: color var(--ui-aup-dur-2) var(--ui-aup-ease-out);
}
.ui-aup__badge[data-tone="ok"] {
  color: var(--ui-aup-ok);
}
.ui-aup__badge[data-tone="warn"] {
  color: var(--ui-aup-warn);
}
.ui-aup__badge-glyph {
  display: grid;
  flex: none;
  place-items: center;
  width: 11px;
  height: 11px;
}
.ui-aup__spin {
  display: grid;
  place-items: center;
  width: 11px;
  height: 11px;
  animation: ui-aup-spin var(--ui-aup-spin) var(--ui-aup-ease-soft) infinite;
}

/* Actions ----------------------------------------------------------------- */
.ui-aup__actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.ui-aup__signin {
  height: 26px;
  padding: 0 11px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px var(--ui-aup-edge);
  color: var(--ui-aup-ink);
  font-size: 11.5px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
  transition:
    background-color var(--ui-aup-dur-2) var(--ui-aup-ease-out),
    opacity var(--ui-aup-dur-2) var(--ui-aup-ease-out),
    transform var(--ui-aup-dur-1) var(--ui-aup-ease-out);
}
.ui-aup__signin:hover:not(:disabled) {
  background: var(--ui-aup-wash);
}
.ui-aup__signin:active:not(:disabled) {
  transform: scale(0.97);
}
.ui-aup__signin:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.ui-aup__disclosure {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 8px;
  border-radius: 8px;
  color: var(--ui-aup-muted);
  font-size: 11.5px;
  line-height: 16px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  transition:
    color var(--ui-aup-dur-2) var(--ui-aup-ease-out),
    background-color var(--ui-aup-dur-2) var(--ui-aup-ease-out),
    transform var(--ui-aup-dur-1) var(--ui-aup-ease-out);
}
.ui-aup__disclosure:hover {
  background: var(--ui-aup-wash);
  color: var(--ui-aup-ink);
}
.ui-aup__disclosure:active {
  transform: scale(0.97);
}
.ui-aup__disclosure[aria-expanded="true"] {
  background: var(--ui-aup-wash);
  color: var(--ui-aup-ink);
}
.ui-aup__chevron {
  display: grid;
  flex: none;
  place-items: center;
  width: 12px;
  height: 12px;
  transition: transform var(--ui-aup-dur-2) var(--ui-aup-ease-both);
}
.ui-aup__disclosure[aria-expanded="true"] .ui-aup__chevron {
  transform: rotate(180deg);
}
.ui-aup__signin:focus-visible,
.ui-aup__disclosure:focus-visible,
.ui-aup__signout:focus-visible {
  outline: 2px solid var(--ui-aup-focus);
  outline-offset: 2px;
}

/* Handoff ----------------------------------------------------------------- */
.ui-aup__pending {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 7px;
  padding-left: 2px;
  color: var(--ui-aup-muted);
  font-size: 11.5px;
  line-height: 16px;
  animation: ui-aup-settle var(--ui-aup-dur-3) var(--ui-aup-ease-out) both;
}
.ui-aup__pending-glyph {
  display: grid;
  flex: none;
  place-items: center;
  width: 12px;
  height: 12px;
  color: var(--ui-aup-muted);
}

/* Accounts ---------------------------------------------------------------- */
.ui-aup__accounts {
  display: grid;
  gap: 2px;
  margin-top: 8px;
  padding-top: 8px;
  box-shadow: inset 0 1px 0 0 var(--ui-aup-edge);
}
.ui-aup__accounts[hidden] {
  display: none;
}
/* Folding out is a reveal, not a height change: the panel is either present or absent,
 * and only opacity and position move, so the row below never jumps frame by frame. */
.ui-aup__row[data-open="true"] .ui-aup__accounts {
  animation: ui-aup-reveal var(--ui-aup-dur-3) var(--ui-aup-ease-out) both;
}
.ui-aup__account-list {
  display: grid;
  gap: 1px;
  list-style: none;
}
.ui-aup__account {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0 3px 40px;
}
.ui-aup__account-text {
  display: grid;
  flex: 1;
  gap: 0;
  min-width: 0;
}
.ui-aup__account-label {
  overflow: hidden;
  font-size: 11.5px;
  line-height: 16px;
  color: var(--ui-aup-ink);
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-aup__account-added {
  font-size: 10.5px;
  line-height: 14px;
  color: var(--ui-aup-muted);
  font-variant-numeric: tabular-nums;
}
.ui-aup__signout {
  flex: none;
  height: 24px;
  padding: 0 8px;
  border-radius: 7px;
  color: var(--ui-aup-muted);
  font-size: 11px;
  line-height: 15px;
  white-space: nowrap;
  transition:
    color var(--ui-aup-dur-2) var(--ui-aup-ease-out),
    background-color var(--ui-aup-dur-2) var(--ui-aup-ease-out);
}
.ui-aup__signout:hover {
  background: var(--ui-aup-wash);
  color: var(--ui-aup-danger);
}
.ui-aup__empty {
  padding: 2px 0 2px 40px;
  color: var(--ui-aup-muted);
  font-size: 11.5px;
  line-height: 16px;
}
.ui-aup__empty-panel {
  padding: 12px;
  border-radius: var(--radius-preview, 12px);
  background: var(--ui-aup-wash);
  color: var(--ui-aup-muted);
  font-size: 11.5px;
  line-height: 16px;
}

/* Foot -------------------------------------------------------------------- */
.ui-aup__notice {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 8px 11px;
  border-radius: var(--radius-preview, 12px);
  background: var(--ui-aup-wash);
  color: var(--ui-aup-muted);
  font-size: 11.5px;
  line-height: 17px;
  animation: ui-aup-reveal var(--ui-aup-dur-3) var(--ui-aup-ease-out) both;
}
.ui-aup__notice-dot {
  flex: none;
  width: 5px;
  height: 5px;
  margin-top: 6px;
  border-radius: 999px;
  background: var(--ui-aup-warn);
}
.ui-aup__foot {
  color: var(--ui-aup-muted);
  font-size: 11px;
  line-height: 16px;
}

@keyframes ui-aup-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
@keyframes ui-aup-rail {
  from {
    transform: scaleY(0);
  }
  to {
    transform: scaleY(1);
  }
}
@keyframes ui-aup-settle {
  from {
    opacity: 0;
    transform: translateY(-2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes ui-aup-reveal {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

:where(.dark, [data-theme="dark"]) .ui-aup {
  --ui-aup-ink: var(--text, #f4ece4);
  --ui-aup-muted: var(--text-muted, #a2958a);
  --ui-aup-panel: var(--panel, #1a1512);
  --ui-aup-card: var(--card, #201a15);
  --ui-aup-line: var(--border, #33291f);
  --ui-aup-edge: var(--border-soft, #ffffff12);
  --ui-aup-wash: #ffffff0d;
  --ui-aup-tile: #ffffff14;
  --ui-aup-ok: var(--success, #4f9d6e);
  --ui-aup-warn: var(--warning, #d99530);
  --ui-aup-danger: var(--danger, #e2544a);
  --ui-aup-accent: var(--accent, #ff6b35);
  --ui-aup-focus: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  .ui-aup,
  .ui-aup *,
  .ui-aup *::before,
  .ui-aup *::after {
    transition-duration: 1ms;
  }
  .ui-aup__spin,
  .ui-aup__pending,
  .ui-aup__notice,
  .ui-aup__row[data-pending="true"]::before,
  .ui-aup__row[data-open="true"] .ui-aup__accounts {
    animation: none;
  }
  /* The rail is the only mark that the row is live once the spinner stops */
  .ui-aup__row[data-pending="true"]::before {
    transform: scaleY(1);
  }
}
`;
