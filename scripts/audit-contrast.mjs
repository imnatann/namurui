/**
 * Measures real rendered contrast for every gallery route.
 *
 * It walks text nodes in the preview, resolves the effective backdrop through the
 * ancestor chain, and reports pairs below WCAG AA (4.5:1, or 3:1 for large text).
 * Elements painted over a gradient or image are skipped — the backdrop there is not
 * a single colour, so a ratio would be meaningless.
 *
 * Run inside the page (browser MCP / Playwright):
 *
 *   const tab = await browser.open({ url: "http://127.0.0.1:5199/" });
 *   const report = await tab.run(auditSource);
 *
 * Writes nothing; returns `{ slug: [{ fg, bg, ratio }] }` for gen-high-contrast.mjs.
 */
export const auditContrast = `(async () => {
  const manifest = await (await fetch("/src/gallery/manifest.json")).json();

  const parse = (c) => {
    const m = c.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(",").map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const hex = (c) =>
    "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  // Source-over with the accumulated alpha preserved. Forcing a:1 here would make the
  // "still translucent, keep climbing" test fire after two stacked washes and report the
  // wash colour itself as the backdrop.
  const over = (f, b) => {
    const a = f.a + b.a * (1 - f.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (f.r * f.a + b.r * b.a * (1 - f.a)) / a,
      g: (f.g * f.a + b.g * b.a * (1 - f.a)) / a,
      b: (f.b * f.a + b.b * b.a * (1 - f.a)) / a,
      a,
    };
  };
  const lum = (c) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  // null when an ancestor paints a gradient or image: the true backdrop is unknown.
  const backdrop = (el) => {
    let acc = null;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== "none") return null;
      const c = parse(cs.backgroundColor);
      if (!c || c.a === 0) continue;
      acc = acc ? over(acc, c) : c;
      if (acc.a === 1) return acc;
    }
    return acc && acc.a === 1 ? acc : null;
  };

  const out = {};
  for (const item of manifest) {
    location.hash = "/" + item.slug;
    await new Promise((r) => setTimeout(r, 220));
    const root = document.querySelector(".g-preview");
    if (!root) continue;
    const fails = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent.trim();
      if (text.length < 2) continue;
      const el = n.parentElement;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.1) continue;
      const fg = parse(cs.color);
      if (!fg) continue;
      const bg = backdrop(el);
      if (!bg) continue;
      const solid = fg.a < 1 ? over(fg, bg) : fg;
      const [l1, l2] = [lum(solid), lum(bg)];
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const size = parseFloat(cs.fontSize);
      const large = size >= 24 || (size >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
      if (ratio < (large ? 3 : 4.5)) {
        fails.push({ fg: hex(solid), bg: hex(bg), ratio: Math.round(ratio * 10) / 10 });
      }
    }
    if (fails.length) out[item.slug] = fails;
  }
  location.hash = "/";
  return out;
})()`;
