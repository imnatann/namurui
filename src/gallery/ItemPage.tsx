import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { CodeView } from "./CodeView";
import { items, loadDemoSource, loadExports, loadSource } from "./registry";
import type { Item } from "./registry";

/* One line per tier, shown under the description. `Core` marks components that
 * belong to NamurUI itself; the other two are both derived from the upstream
 * library, so the wording has to keep that distinction honest. */
const tierNotes: Record<Item["tier"], string> = {
  Free: "Free: derived from the upstream library's MIT-licensed originals.",
  Pro: "Pro: a reconstruction of the upstream item, rebuilt from its extracted stylesheets.",
  Core: "Core: original to NamurUI, written here rather than reconstructed.",
};

type ItemPageProps = {
  item: Item;
  /** Lazy loader for the item's demo; the page resolves it on mount. */
  demo?: () => Promise<{ default: ComponentType }>;
  onPick: (slug: string) => void;
};

/** One broken demo must not take the gallery down. */
class DemoBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  render() {
    return this.state.error ? (
      <p className="g-muted">This demo threw: {this.state.error}</p>
    ) : (
      this.props.children
    );
  }
}

export function ItemPage({ item, demo, onPick }: ItemPageProps) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [dark, setDark] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [flush, setFlush] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [source, setSource] = useState<string>();
  const [demoSource, setDemoSource] = useState<string>();
  const [api, setApi] = useState<string[]>([]);

  /* `lazy` must not be called during render for a changing component, so memoise per slug. */
  const Demo = useMemo(() => (demo ? lazy(demo) : undefined), [demo]);

  useEffect(() => {
    setTab("preview");
    setDark(false);
    setFlush(false);
    setNonce(0);
    setPromptCopied(false);
    setSource(undefined);
    setDemoSource(undefined);
    setApi([]);
    let live = true;
    void Promise.all([
      loadSource(item.slug),
      loadDemoSource(item.slug),
      loadExports(item.slug),
    ]).then(([text, demoText, names]) => {
      if (!live) return;
      setSource(text);
      setDemoSource(demoText);
      setApi(names);
    });
    return () => {
      live = false;
    };
  }, [item.slug]);

  /* The same affordance the site offers: a prompt a coding agent can act on.
   * It carries the component's real source, so the agent copies rather than guesses. */
  const copyPrompt = async () => {
    const body = [
      `Add the NamurUI "${item.title}" component to my project.`,
      "",
      `It is one self-contained React 19 file with its styles inside — no Tailwind, no animation library, no other dependencies. Save it as \`components/ui/${item.slug}.tsx\` and import it as \`@/components/ui/${item.slug}\`.`,
      "",
      `What it does: ${item.description}.`,
      "",
      "Keep the component's own styles, motion and CSS variable names. Adapt only the content and the props. Dark mode switches through an ancestor with `class=\"dark\"` or `data-theme=\"dark\"`.",
      "",
      "Source:",
      "```tsx",
      source ?? "",
      "```",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(body);
      setPromptCopied(true);
      window.setTimeout(() => setPromptCopied(false), 1800);
    } catch {
      setPromptCopied(false);
    }
  };

  /* Same category, same kind first: a component page should offer components before it
   * offers the screen that frames them. */
  const related = useMemo(() => {
    const sameKind = (i: { kind: string }) => (i.kind === item.kind ? 0 : 1);
    return items
      .filter((i) => i.category === item.category && i.slug !== item.slug)
      .sort(
        (a, b) =>
          sameKind(a) - sameKind(b) ||
          a.title.localeCompare(b.title, "en"),
      )
      .slice(0, 6);
  }, [item.slug, item.kind, item.category]);

  return (
    <>
      <header className="g-head">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span
              className="g-badge"
              data-tier={item.tier}
            >
              {item.tier}
            </span>
            <span className="g-muted" style={{ fontSize: 12.5, textTransform: "capitalize" }}>
              {item.kind} · {item.category}
            </span>
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}>{item.title}</h1>
          <p>{item.description}</p>
          <p className="g-muted" style={{ margin: "6px 0 0", fontSize: 12.5 }}>
            {tierNotes[item.tier]}
          </p>
        </div>
        <div className="g-head-actions">
          <button
            className="g-btn"
            type="button"
            onClick={copyPrompt}
            style={{
              borderColor: "transparent",
              borderRadius: "var(--radius-pill)",
              background: "var(--accent)",
              color: "var(--accent-fg)",
            }}
          >
            {promptCopied ? "Copied prompt" : "Copy prompt"}
          </button>
          {item.url ? (
            <a
              className="g-btn"
              href={item.url}
              target="_blank"
              rel="noreferrer"
              style={{ borderRadius: "var(--radius-pill)" }}
            >
              Original
            </a>
          ) : null}
        </div>
      </header>

      <div className="g-surface">
        <div className="g-surface-bar">
          <button className="g-tab" type="button" aria-selected={tab === "preview"} onClick={() => setTab("preview")}>
            Preview
          </button>
          <button className="g-tab" type="button" aria-selected={tab === "code"} onClick={() => setTab("code")}>
            Code
          </button>
          <span className="g-spacer" />
          <button
            className="g-icon-btn"
            type="button"
            data-on={flush || undefined}
            aria-label="Full width"
            title="Full width"
            onClick={() => setFlush((v) => !v)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" strokeLinecap="round" />
            </svg>
          </button>
          <button
            className="g-icon-btn"
            type="button"
            data-on={dark || undefined}
            aria-label="Dark preview"
            title="Dark preview"
            onClick={() => setDark((v) => !v)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2Z" strokeLinejoin="round" />
            </svg>
          </button>
          <button className="g-icon-btn" type="button" aria-label="Replay" title="Replay" onClick={() => setNonce((n) => n + 1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 12a8 8 0 1 1 2.6 5.9" strokeLinecap="round" />
              <path d="M4 17v-5h5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {tab === "preview" ? (
          <div className={dark ? "g-preview dark" : "g-preview"} data-flush={flush || undefined} key={`${item.slug}:${nonce}`}>
            {Demo ? (
              <DemoBoundary>
                <Suspense fallback={<p className="g-muted">Loading…</p>}>
                  <Demo />
                </Suspense>
              </DemoBoundary>
            ) : (
              <p className="g-muted">No demo registered for “{item.slug}” yet.</p>
            )}
          </div>
        ) : (
          <CodeView source={source ?? "// loading…"} demoSource={demoSource} />
        )}
      </div>

      <section className="g-section">
        <h2>Exports</h2>
        <div className="g-prose">
          {api.length ? (
            <ul>
              {api.map((name) => (
                <li key={name}>
                  <code>{name}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p className="g-muted">No source file for this item.</p>
          )}
        </div>
      </section>

      {related.length > 0 && (
        <section className="g-section">
          <h2>More in {item.category}</h2>
          <div className="g-prose">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {related.map((i) => (
                <button key={i.slug} className="g-chip" type="button" onClick={() => onPick(i.slug)}>
                  {i.title}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
