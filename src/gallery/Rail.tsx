import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Item } from "./registry";
import { categories } from "./registry";

/* Tier is a quiet metadata dot, never a second accent: Free is an empty ring,
 * Pro a mid ink, Core solid ink. The only ember on the rail is the live row. */
const tierDot: Record<Item["tier"], CSSProperties> = {
  Free: { background: "transparent", boxShadow: "inset 0 0 0 1px var(--text-subtle)" },
  Pro: { background: "var(--text-muted)" },
  Core: { background: "var(--text)" },
};

/* The selected item is the one live thing on screen, so it is the one place the
 * ember accent appears. Everything else in the rail stays neutral. */
const liveRow: CSSProperties = {
  background: "var(--accent-soft)",
  boxShadow: "inset 2px 0 0 var(--accent)",
  color: "var(--text)",
};

type RailProps = {
  items: Item[];
  kinds: readonly { id: Item["kind"]; label: string }[];
  active: string;
  onPick: (slug: string) => void;
  dark: boolean;
  onToggleDark: () => void;
  contrast: boolean;
  onToggleContrast: () => void;
  built: number;
  total: number;
};

/* Every tier the manifest can carry, in the order the gallery presents them.
 * A tier chip is a toggle: pick one to narrow, pick it again to clear. */
const tiers: Item["tier"][] = ["Free", "Pro", "Core"];

export function Rail({ items, kinds, active, onPick, dark, onToggleDark, contrast, onToggleContrast, built, total }: RailProps) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Item["kind"] | "all">("all");
  const [tier, setTier] = useState<Item["tier"] | "all">("all");
  const search = useRef<HTMLInputElement>(null);

  /* ⌘K / Ctrl-K focuses the field, Escape clears it — the shortcut the kbd hint advertises. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        search.current?.focus();
        search.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((item) => {
      if (kind !== "all" && item.kind !== kind) return false;
      if (tier !== "all" && item.tier !== tier) return false;
      if (words.length === 0) return true;
      const tokens = `${item.title} ${item.slug} ${item.description} ${item.category} ${item.kind} ${item.tier}`
        .toLowerCase()
        .split(/[^a-z0-9]+/);
      return words.every((word) => tokens.some((token) => token.startsWith(word)));
    });
  }, [items, query, kind, tier]);

  /* Category is the grouping, kind and tier are the filters. Alphabetical inside a group
   * so a known name is in a predictable place instead of wherever its build wave left it. */
  const grouped = useMemo(() => {
    const groups: { label: string; items: Item[] }[] = [];
    for (const c of categories) {
      const list = filtered
        .filter((i) => i.category === c.id)
        .sort((a, b) => a.title.localeCompare(b.title, "en"));
      if (list.length) groups.push({ label: c.id, items: list });
    }
    return groups;
  }, [filtered]);

  const filters = [
    kind === "all" ? "" : (kinds.find((k) => k.id === kind)?.label ?? kind),
    tier === "all" ? "" : tier,
  ].filter(Boolean);

  return (
    <aside className="g-rail">
      <a
        className="g-brand"
        href="#/"
        style={{ fontFamily: "var(--font-display)", fontWeight: 500, letterSpacing: "0" }}
        onClick={(event) => {
          event.preventDefault();
          onPick("");
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="currentColor" />
          <path d="M8 15.5V8.5h3.2a2.3 2.3 0 0 1 0 4.6H8" stroke="var(--panel)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        NamurUI
      </a>

      <div className="g-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" strokeLinecap="round" />
        </svg>
        <input
          ref={search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
          }}
          placeholder="Search…"
          aria-label="Search components"
          spellCheck={false}
        />
        <kbd>
          <span>⌘</span>
          <span>K</span>
        </kbd>
      </div>

      <div className="g-filters">
        <button
          className="g-chip"
          data-on={(kind === "all" && tier === "all") || undefined}
          onClick={() => {
            setKind("all");
            setTier("all");
          }}
          type="button"
        >
          All
        </button>
        {kinds.map((k) => (
          <button
            key={k.id}
            className="g-chip"
            data-on={kind === k.id || undefined}
            onClick={() => setKind((current) => (current === k.id ? "all" : k.id))}
            type="button"
          >
            {k.label}
          </button>
        ))}
        {tiers.map((t) => (
          <button
            key={t}
            className="g-chip"
            data-on={tier === t || undefined}
            onClick={() => setTier((current) => (current === t ? "all" : t))}
            type="button"
          >
            {t}
          </button>
        ))}
      </div>

      <nav className="g-nav" aria-label="Library">
        {grouped.length === 0 && (
          <p className="g-empty">
            {query
              ? `Nothing matches “${query}”.`
              : filters.length > 0
                ? `Nothing matches ${filters.join(" + ")}.`
                : "Nothing matches this filter."}
          </p>
        )}
        {grouped.map((group) => (
          <section key={group.label}>
            <h2>
              {group.label} · {group.items.length}
            </h2>
            {group.items.map((item) => (
              <button
                key={item.slug}
                type="button"
                aria-current={item.slug === active ? "page" : undefined}
                style={item.slug === active ? liveRow : undefined}
                onClick={() => onPick(item.slug)}
              >
                <span>{item.title}</span>
                <i className="g-dot" style={tierDot[item.tier]} aria-hidden="true" />
              </button>
            ))}
          </section>
        ))}
      </nav>

      <div className="g-rail-foot">
        <span>
          {built}/{total} built
        </span>
        <button
          className="g-icon-btn"
          type="button"
          data-on={contrast || undefined}
          onClick={onToggleContrast}
          aria-pressed={contrast}
          aria-label="High contrast"
          title="High contrast (WCAG AA labels)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 3.5v17" />
            <path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" stroke="none" />
          </svg>
        </button>
        <button className="g-icon-btn" type="button" onClick={onToggleDark} aria-label="Toggle dark mode" title="Toggle dark mode">
          {dark ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <circle cx="12" cy="12" r="4.2" />
              <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2Z" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>
    </aside>
  );
}
