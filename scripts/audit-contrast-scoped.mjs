/**
 * Scoped contrast audit.
 *
 * Same rules as `audit-contrast.mjs` — walk text nodes in `.g-preview`, resolve the
 * effective backdrop through the ancestor chain, flag pairs under WCAG AA — with two
 * changes:
 *
 * 1. Compositing preserves the accumulated alpha. The original forced `a: 1` after
 *    every step, so two stacked translucent washes ended the climb and the wash colour
 *    itself was reported as the backdrop. That produced failures at exactly 1.0:1.
 * 2. It takes an explicit slug list and reports coverage per route, so a route that
 *    measured nothing is visible instead of silently "passing".
 *
 * Run inside the page (browser MCP / Playwright):
 *
 *   const report = await tab.evaluate(`(${auditScoped.toString()})(${JSON.stringify(slugs)})`);
 *
 * Returns `{ [slug]: { measured, fails: [{ text, fg, bg, ratio, size, cls }] } }`.
 */
export function auditScoped(slugs) {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const hex = (c) =>
    "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
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
  return (async () => {
    for (const slug of slugs) {
      location.hash = "/" + slug;
      await new Promise((r) => setTimeout(r, 240));
      const root = document.querySelector(".g-preview");
      if (!root) {
        out[slug] = { measured: 0, fails: [], note: "no .g-preview" };
        continue;
      }
      let measured = 0;
      const fails = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const text = (n.textContent || "").trim();
        if (text.length < 2) continue;
        const el = n.parentElement;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.1) continue;
        const fg = parse(cs.color);
        if (!fg) continue;
        const bg = backdrop(el);
        if (!bg) continue;
        measured++;
        const solid = fg.a < 1 ? over(fg, bg) : fg;
        const [l1, l2] = [lum(solid), lum(bg)];
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        const size = parseFloat(cs.fontSize);
        const large = size >= 24 || (size >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
        if (ratio < (large ? 3 : 4.5)) {
          fails.push({
            text: text.slice(0, 48),
            fg: hex(solid),
            bg: hex(bg),
            ratio: Math.round(ratio * 10) / 10,
            size,
            cls: String(el.className || el.tagName),
          });
        }
      }
      out[slug] = { measured, fails };
    }
    location.hash = "/";
    return out;
  })();
}
