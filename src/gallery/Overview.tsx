import type { Item } from "./registry";
import { categories } from "./registry";

type OverviewProps = {
  items: Item[];
  onPick: (slug: string) => void;
};

export function Overview({ items, onPick }: OverviewProps) {
  const built = items.filter((i) => i.tier === "Free").length;

  /* Same eight buckets, same order, as the rail: the overview is the rail read as a page. */
  const groups = categories
    .map((category) => ({
      ...category,
      items: items
        .filter((item) => item.category === category.id)
        .sort((a, b) => a.title.localeCompare(b.title, "en")),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <header className="g-head">
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 500, letterSpacing: "-0.01em" }}>
            {items.length} pieces, one identity
          </h1>
          <p>
            Every component, screen, block, illustration and motion effect in NamurUI, each one a
            self-contained <code>.tsx</code> file. No Tailwind, no animation library, no dependencies.
            {` ${built} derive from the upstream library's MIT sources, the Pro pieces reconstruct its stylesheets and have been re-themed to Ember, and the Core pieces are NamurUI's own, built first-party rather than reconstructed.`}
          </p>
        </div>
      </header>

      {groups.map((group) => (
        <section key={group.id} className="g-cat">
          <div className="g-cat-head">
            <h2>{group.id}</h2>
            <span>{group.items.length}</span>
            <p>{group.blurb}</p>
          </div>
          <div className="g-grid">
            {group.items.map((item) => (
              <button key={item.slug} className="g-tile" type="button" onClick={() => onPick(item.slug)}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h3>{item.title}</h3>
                  <span className="g-badge" data-tier={item.tier} style={{ marginLeft: "auto" }}>
                    {item.tier}
                  </span>
                </div>
                <p>{item.description}</p>
                <div className="g-tile-foot">
                  <span style={{ textTransform: "capitalize" }}>{item.kind}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
