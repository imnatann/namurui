import { useEffect, useMemo, useState } from "react";
import { bySlug, demos, items, kinds } from "./gallery/registry";
import { ItemPage } from "./gallery/ItemPage";
import { Overview } from "./gallery/Overview";
import { Rail } from "./gallery/Rail";

const readHash = () => {
  const raw = window.location.hash.replace(/^#\/?/, "");
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const navigate = (slug: string) => {
  window.location.hash = slug ? `/${slug}` : "/";
};

export default function App() {
  const [slug, setSlug] = useState(readHash);
  // Ember is a warm-dark identity and this is an agent console, so a profile with no
  // stored choice opens dark. A persisted "theme" stays authoritative either way.
  const [dark, setDark] = useState(() => {
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "light") return false;
      if (stored === "dark") return true;
    } catch {
      /* private mode – fall through to the dark default */
    }
    return true;
  });
  const [contrast, setContrast] = useState(
    () => document.documentElement.dataset.contrast === "high",
  );

  useEffect(() => {
    const onHash = () => setSlug(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      /* private mode – the class is enough for this session */
    }
  }, [dark]);

  useEffect(() => {
    const root = document.documentElement;
    if (contrast) root.dataset.contrast = "high";
    else delete root.dataset.contrast;
  }, [contrast]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [slug]);

  const built = useMemo(() => items.filter((i) => demos[i.slug]).length, []);
  const current = bySlug[slug];
  const title = current ? `${current.title} · NamurUI` : "NamurUI · agent console components";

  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <div className="g-app">
      <Rail
        items={items}
        kinds={kinds}
        active={current ? current.slug : ""}
        onPick={(next) => {
          navigate(next);
          setSlug(next);
        }}
        dark={dark}
        onToggleDark={() => setDark((d) => !d)}
        contrast={contrast}
        onToggleContrast={() => setContrast((c) => !c)}
        built={built}
        total={items.length}
      />
      <main className="g-main">
        {current ? (
          <ItemPage
            item={current}
            demo={demos[current.slug]}
            onPick={(next) => {
              navigate(next);
              setSlug(next);
            }}
          />
        ) : (
          <Overview
            items={items}
            onPick={(next) => {
              navigate(next);
              setSlug(next);
            }}
          />
        )}
      </main>
    </div>
  );
}
