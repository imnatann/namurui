/**
 * Extracts the real implementation surface of one affectUI item from its live doc page.
 *
 *   node scripts/extract-item.mjs <kind> <slug> [outDir]
 *
 * Writes into .affectui/reference/<slug>/:
 *   component.css     the item's own injected stylesheet, verbatim
 *   component.pretty.css  the same, one rule per line
 *   dom.html          the rendered subtree, exactly as React produced it
 *   nodes.json        every element: tag, class, attributes, computed style, box
 *   keyframes.json    authored @keyframes with their real timings
 *   text.txt          innerText, so the copy is exact
 *   meta.json         root class, style href, sizes, breakpoints observed
 *   reference.png     2x screenshot of the root, for visual diffing
 *
 * The stylesheet is the point: every affectUI item ships its CSS through
 * <style data-href="ui-<slug>[-clean]">, so this is the design system itself,
 * not a reconstruction of it.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [, , kind, slug] = process.argv;
/* argv[4] is an output directory only when it is a bare path, not a flag. */
const outArg = process.argv[4] && !process.argv[4].startsWith("--") ? process.argv[4] : undefined;
/* `--root .ui-as` overrides root detection. Screens are panels inside the app shell; capturing
 * the shell is what makes the capture a whole screen rather than one of its columns. */
const rootFlagIndex = process.argv.indexOf("--root");
const rootOverride = rootFlagIndex === -1 ? null : process.argv[rootFlagIndex + 1];
if (!kind || !slug) {
  console.error("usage: node scripts/extract-item.mjs <kind> <slug> [outDir]");
  process.exit(1);
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = outArg ?? join(repoRoot, ".affectui", "reference", slug);
const CDP = process.env.CDP ?? "http://127.0.0.1:9333";
const url = `https://www.affectui.com/${kind}/${slug}`;

const list = await (await fetch(`${CDP}/json/list`)).json();
const page = list.find((t) => t.type === "page") ?? (await (await fetch(`${CDP}/json/new?about:blank`, { method: "PUT" })).json());

const ws = new WebSocket(page.webSocketDebuggerUrl);
let nextId = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  const entry = pending.get(msg.id);
  if (!entry) return;
  pending.delete(msg.id);
  if (msg.error) entry.reject(new Error(JSON.stringify(msg.error)));
  else entry.resolve(msg.result);
});
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
    allowUnsafeEvalBlockedByCSP: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result.value;
};

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await send("Page.navigate", { url });

// Wait for network idle-ish, then for the component's first stylesheet.
const deadline = Date.now() + 30000;
let ready = false;
while (Date.now() < deadline && !ready) {
  await new Promise((r) => setTimeout(r, 400));
  ready = await evaluate(
    `document.readyState === "complete" && document.querySelectorAll("style[data-href]").length > 0`,
  ).catch(() => false);
}
// Give React a beat to finish layout + fonts.
await new Promise((r) => setTimeout(r, 1200));

/* Every stylesheet on the page, and which classes each one styles.
 *
 * Root selection is deliberately NOT automated. affectUI composes some items from another
 * item's sheet — `screens/app-shell-flat` renders the app shell and adds 800 bytes of its own
 * overrides — so any single "pick the root" heuristic is wrong for part of the library.
 * Instead this records the evidence and the dominance relation, and the rebuild brief says how
 * to read it. */
const found = await evaluate(`(() => {
  const slug = ${JSON.stringify(slug)};
  const present = new Set();
  for (const el of document.querySelectorAll("[class]")) {
    for (const cls of String(el.className).split(/\\s+/)) {
      if (/^ui-[a-z0-9-]+$/.test(cls)) present.add(cls);
    }
  }
  const sheets = [];
  for (const tag of document.querySelectorAll("style[data-href]")) {
    const href = tag.getAttribute("data-href") || "";
    const text = tag.textContent || "";
    if (!text.trim()) continue;
    const declared = [...new Set([...text.matchAll(/\\.(ui-[a-z0-9-]+)\\s*(?=[{,:])/g)].map((m) => m[1]))];
    const hits = declared.filter((cls) => present.has(cls));
    sheets.push({ href, bytes: text.length, declared, hits, css: text });
  }
  return { sheets, present: [...present] };
})()`);

/* Which element dominates the component? For each candidate class, does one element carrying
 * it contain every element carrying any other class this item uses?
 *
 * Page chrome (the toaster, the copy button) is always mounted and would otherwise win on
 * containment, so those sheets' classes are excluded outright. */
const dominance = await evaluate(`(() => {
  const CHROME = new Set(["ui-ts", "ui-button", "ui-btn"]);
  for (const sheet of ${JSON.stringify(found.sheets.map((x) => x.href))}) {
    if (sheet === "ui-toaster" || sheet === "ui-button") {
      const chrome = (${JSON.stringify(found.sheets.map((x) => ({ href: x.href, declared: x.declared })))}).find((s) => s.href === sheet);
      for (const cls of chrome?.declared ?? []) CHROME.add(cls);
    }
  }
  const classes = ${JSON.stringify(found.present)}.filter((c) => !CHROME.has(c));
  const set = new Set(classes);
  const carriers = [...document.querySelectorAll("[class]")].filter((el) => {
    const first = String(el.className).split(/\\s+/)[0];
    return first && first.startsWith("ui-");
  });
  const out = [];
  for (const candidate of carriers) {
    const cls = String(candidate.className).split(/\\s+/).find((c) => set.has(c));
    if (!cls) continue;
    const inside = carriers.filter((el) => el !== candidate && candidate.contains(el));
    const depth = (() => { let d = 0; let n = candidate; while (n && n !== document.documentElement) { d += 1; n = n.parentElement; } return d; })();
    out.push({ cls, tag: candidate.tagName.toLowerCase(), depth, contains: inside.length, total: carriers.length - 1 });
  }
  out.sort((a, b) => b.contains - a.contains || a.depth - b.depth);
  return out.slice(0, 24);
})()`);

/* The stylesheet the rebuild must target: the largest one whose href names this slug. Screens
 * and flat shells then pull extra sheets in as companions. */
const slugSheets = found.sheets.filter((s) => s.href === `ui-${slug}` || s.href === `ui-${slug}-clean`);
const kindSheets = found.sheets.filter((s) => s.href === `ui-screen-${slug}` || s.href === `ui-block-${slug}`);
const named = [...slugSheets, ...kindSheets].sort((a, b) => b.bytes - a.bytes);
const withCss = (href) => found.sheets.find((s) => s.href === href);

const bestSheet = named[0] ?? found.sheets.filter((s) => s.hits.length).sort((a, b) => b.bytes - a.bytes)[0] ?? null;
const bestCss = bestSheet ? withCss(bestSheet.href)?.css ?? "" : "";

const found2 = {
  best: bestSheet ? { href: bestSheet.href, bytes: bestSheet.bytes, css: bestCss } : null,
  companions: found.sheets
    .filter((s) => bestSheet && s.href !== bestSheet.href && s.href !== "ui-toaster" && s.href !== "ui-button" && s.hits.length)
    .map((s) => ({ href: s.href, root: s.hits.slice().sort((a, b) => a.length - b.length)[0], bytes: s.bytes, css: withCss(s.href)?.css ?? "" })),
  present: found.present,
  all: found.sheets.map((s) => ({ href: s.href, bytes: s.bytes, hits: s.hits })),
  dominance,
};

if (!found2?.best) {
  console.error(JSON.stringify({ error: "no stylesheet matched", url, sheets: found2?.all }, null, 1));
  process.exit(2);
}

mkdirSync(outDir, { recursive: true });

const css = found2.best.css;
writeFileSync(join(outDir, "component.css"), css, "utf8");

/* Sheets the item leans on for variables — a screen sits inside the app shell. */
const companions = found2.companions ?? [];
for (const companion of companions) {
  const name = companion.href.replace(/[^a-z0-9-]/gi, "") || "companion";
  writeFileSync(join(outDir, `companion-${name}.css`), companion.css, "utf8");
}
writeFileSync(join(outDir, "component.pretty.css"), css.replace(/}/g, "}\n"), "utf8");

/* The root class.
 *
 * Every affectUI sheet is authored tokens-first: the first rule sets the item's custom
 * properties on its root. So the first selector in the item's own sheet IS the root —
 * deterministic, and immune to whatever else happens to be mounted on the page. */
const ownSheet = found2.all.find(
  (s) =>
    s.href === `ui-${slug}` ||
    s.href === `ui-${slug}-clean` ||
    s.href === `ui-screen-${slug}` ||
    s.href === `ui-block-${slug}`,
);
const cssText = found2.best.css;
const firstSelectors = [...cssText.matchAll(/(^|\})\s*([^{}@]+)\{/g)]
  .map((m) => m[2].trim())
  .filter((sel) => !sel.startsWith("@") && !sel.includes(":"));
const firstRoot = (() => {
  for (const sel of firstSelectors) {
    const match = sel.match(/\.(ui-[a-z0-9-]+)/);
    if (match) return match[1];
  }
  return null;
})();
const rootClass =
  rootOverride?.replace(/^\./, "") ??
  firstRoot ??
  ownSheet?.hits?.[0] ??
  found2.best.href.replace(/^ui-/, "ui-");

/* The rendered subtree and a full computed-style dump. */
const dom = await evaluate(`(() => {
  const root = document.querySelector(${JSON.stringify("." + rootClass)});
  return root ? root.outerHTML : null;
})()`);
if (dom) writeFileSync(join(outDir, "dom.html"), dom, "utf8");

const nodes = await evaluate(`(() => {
  const root = document.querySelector(${JSON.stringify("." + rootClass)});
  if (!root) return null;
  const sr = root.getBoundingClientRect();
  const KEYS = ["display","position","width","height","minWidth","maxWidth","borderRadius","background",
    "backgroundColor","backgroundImage","boxShadow","color","fontSize","fontWeight","letterSpacing",
    "lineHeight","gap","padding","margin","gridTemplateColumns","gridTemplateRows","opacity","transform",
    "filter","zIndex","overflow","justifyContent","alignItems","flexDirection","flexWrap","strokeWidth",
    "stroke","fill","textAlign","whiteSpace","transition","animation","aspectRatio","containerType","inset"];
  const out = [];
  const walk = (el, depth, path) => {
    if (depth > 7) return;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const style = {};
    for (const key of KEYS) {
      const v = cs[key];
      if (v && v !== "none" && v !== "normal" && v !== "auto" && v !== "0px") style[key] = v.length > 220 ? v.slice(0, 220) + "…" : v;
    }
    const attrs = {};
    for (const a of el.attributes) attrs[a.name] = a.value.length > 300 ? a.value.slice(0, 300) + "…" : a.value;
    out.push({
      path,
      depth,
      tag: el.tagName.toLowerCase(),
      attrs,
      box: [+(r.x - sr.x).toFixed(1), +(r.y - sr.y).toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)],
      style,
    });
    [...el.children].forEach((child, i) => walk(child, depth + 1, path + "/" + i));
  };
  walk(root, 0, "");
  return { root: { box: [Math.round(sr.width), Math.round(sr.height)] }, nodes: out.slice(0, 700) };
})()`);
if (nodes) writeFileSync(join(outDir, "nodes.json"), JSON.stringify(nodes, null, 1), "utf8");

/* Authored keyframes, read straight out of the component's own sheet: the page-level
 * CSSOM walk misses rules inside an injected <style> on some builds. */
const keyframes = [...css.matchAll(/@keyframes\s+(?:--)?([\w-]+)\s*\{([\s\S]*?)\n?\}/g)].map((m) => ({
  name: m[1],
  css: `@keyframes ${m[1]} {${m[2]}}`,
}));
writeFileSync(join(outDir, "keyframes.json"), JSON.stringify(keyframes ?? [], null, 1), "utf8");

const text = await evaluate(`(() => {
  const root = document.querySelector(${JSON.stringify("." + rootClass)});
  return root ? root.innerText : "";
})()`);
writeFileSync(join(outDir, "text.txt"), text ?? "", "utf8");

/* Breakpoints: re-render the page at a few widths and record whether the root switches
 * to its narrow attributes and how it resizes. */
const breakpoints = [];
for (const width of [1440, 1100, 900, 760, 600, 480, 380]) {
  await send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
  await new Promise((r) => setTimeout(r, 500));
  const probe = await evaluate(`(() => {
    const root = document.querySelector(${JSON.stringify("." + rootClass)});
    if (!root) return null;
    const r = root.getBoundingClientRect();
    const attrs = [...root.attributes].filter((a) => a.name.startsWith("data-")).map((a) => a.name);
    return { w: Math.round(r.width), h: Math.round(r.height), dataAttrs: attrs };
  })()`);
  if (probe) breakpoints.push({ viewport: width, ...probe });
}
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await new Promise((r) => setTimeout(r, 600));

/* Screenshot at 2x for visual diffing. */
const box = await evaluate(`(() => {
  const root = document.querySelector(${JSON.stringify("." + rootClass)});
  if (!root) return null;
  const r = root.getBoundingClientRect();
  return {
    x: Math.max(0, r.x),
    y: Math.max(0, r.y),
    width: Math.max(1, r.width),
    height: Math.min(Math.max(120, r.height), 2600),
  };
})()`);
if (box && box.width > 1) {
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    clip: { ...box, scale: 2 },
    captureBeyondViewport: true,
  });
  writeFileSync(join(outDir, "reference.png"), Buffer.from(shot.data, "base64"));
}

writeFileSync(
  join(outDir, "meta.json"),
  JSON.stringify(
    {
      slug,
      kind,
      url,
      rootClass,
      styleHref: found2.best.href,
      cssBytes: css.length,
      domNodes: dom ? (dom.match(/</g) ?? []).length : 0,
      textChars: (text ?? "").length,
      keyframes: (keyframes ?? []).map((k) => k.name),
      breakpoints,
      otherStylesheets: found2.all,
      companions: companions.map((c) => ({ href: c.href, root: c.root, bytes: c.bytes })),
      classInventory: found2.present,
      dominance: found2.dominance,
      sheets: found2.all,
    },
    null,
    1,
  ),
  "utf8",
);

ws.close();
console.log(
  `${slug}: .${rootClass} via ${found2.best.href}, ${css.length} B css, ${nodes?.nodes.length ?? 0} nodes, ${(keyframes ?? []).length} keyframes`,
);
