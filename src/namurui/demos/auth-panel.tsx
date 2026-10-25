import { useEffect, useRef, useState } from "react";
import { AuthPanel, type AuthProvider } from "../auth-panel";

/* The three shapes `get_login_providers` reports: a provider holding two credentials, one that
 * can sign in but holds none, and one this build cannot reach. */
const INITIAL: AuthProvider[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    available: true,
    authenticated: true,
    accounts: [
      { credentialId: "cred_or_7f21", label: "mira@northwind.dev", addedAt: "2026-03-14T09:12:00Z" },
      { credentialId: "cred_or_9c04", label: "team@northwind.dev", addedAt: "2026-06-02T16:40:00Z" },
    ],
  },
  { id: "google", name: "Google Gemini", available: true, authenticated: false },
  { id: "bedrock", name: "Amazon Bedrock", available: false, authenticated: false },
];

/* OMP hands login to `open_url` and waits for the browser, so the demo waits too instead of
 * flipping the row the moment the button is pressed. */
const HANDOFF_MS = 2400;

const control = {
  height: 28, padding: "0 10px", border: 0, borderRadius: 8, background: "transparent",
  boxShadow: "inset 0 0 0 1px var(--border, #e8e0d7)",
  color: "var(--text-muted, #6f625a)", font: "inherit", fontSize: 12, cursor: "pointer",
};

export default function Demo() {
  const [providers, setProviders] = useState<AuthProvider[]>(INITIAL);
  const [pending, setPending] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [open, setOpen] = useState<string | null>("openrouter");
  /* One login is in flight at a time, so one handle is all the cleanup needs */
  const handoff = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (handoff.current !== null) window.clearTimeout(handoff.current);
    },
    [],
  );

  const signIn = (providerId: string) => {
    if (pending !== undefined) return;
    setNotice(undefined);
    setPending(providerId);
    handoff.current = window.setTimeout(() => {
      handoff.current = null;
      const account = {
        credentialId: `cred_${providerId}_${Date.now()}`,
        label: "mira@northwind.dev",
        addedAt: new Date().toISOString(),
      };
      setProviders((list) =>
        list.map((provider) =>
          provider.id === providerId
            ? { ...provider, authenticated: true, accounts: [...(provider.accounts ?? []), account] }
            : provider,
        ),
      );
      setPending(undefined);
      setOpen(providerId);
    }, HANDOFF_MS);
  };

  const signOut = (providerId: string, credentialId: string) => {
    const left = (providers.find((entry) => entry.id === providerId)?.accounts ?? []).filter(
      (account) => account.credentialId !== credentialId,
    );
    setProviders((list) =>
      list.map((entry) =>
        entry.id === providerId ? { ...entry, authenticated: left.length > 0, accounts: left } : entry,
      ),
    );
    const [next] = left;
    setNotice(next ? `Still signed in via ${next.label}` : "That provider has no credentials left.");
  };

  const reset = () => {
    if (handoff.current !== null) window.clearTimeout(handoff.current);
    handoff.current = null;
    setProviders(INITIAL);
    setPending(undefined);
    setNotice(undefined);
    setOpen("openrouter");
  };

  return (
    <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: 460, margin: "0 auto", padding: "24px 0 32px" }}>
      <AuthPanel
        providers={providers}
        pendingProviderId={pending}
        notice={notice}
        expandedId={open}
        onExpandedChange={setOpen}
        onLogin={signIn}
        onLogout={signOut}
      />

      <p style={{ margin: 0, fontSize: 12, lineHeight: "18px", color: "var(--text-muted, #6f625a)" }}>
        {pending !== undefined
          ? "The bridge is waiting on the browser. The row stays pending until a credential comes back."
          : "OpenRouter holds two credentials. Sign one out and the panel says what is still connected."}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" onClick={reset} style={control}>
          Reset the panel
        </button>
      </div>
    </div>
  );
}
