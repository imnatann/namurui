/**
 * Pulls the live component styles and geometry out of a CDP page.
 * Usage: node scripts/extract-reference.mjs <slug> [outputDir]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const slug = process.argv[2] ?? "agent-graph";
const outDir = process.argv[3] ?? join(".affectui", "reference", slug);
const CDP = "http://127.0.0.1:9333";

const list = await (await fetch(`${CDP}/json/list`)).json();
const page = list.find((t) => t.type === "page" && t.url.includes(slug));
if (!page) throw new Error(`no page target for ${slug}`);

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
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};

mkdirSync(outDir, { recursive: true });

/* 1. The injected component stylesheets, verbatim. */
const styles = await evaluate(`
  [...document.querySelectorAll("style[data-href]")].map((s) => ({
    href: s.getAttribute("data-href"),
    bytes: s.textContent.length,
    css: s.textContent,
  }))
`);
for (const style of styles) {
  writeFileSync(join(outDir, `style-${style.href}.css`), style.css, "utf8");
  console.log(`style ${style.href}: ${style.bytes} bytes`);
}

/* 2. Every CSS rule whose selector mentions the component prefix. */
const prefix = slug.split("-")[0];
const rules = await evaluate(`
  (() => {
    const wanted = ${JSON.stringify(prefix)};
    const out = [];
    for (const sheet of document.styleSheets) {
      let list;
      try { list = sheet.cssRules; } catch { continue }
      const walk = (rs, ctx) => {
        for (const rule of rs) {
          if (rule.cssRules && rule.selectorText === undefined) { walk(rule.cssRules, rule.conditionText || rule.name || "group"); continue }
          if (!rule.selectorText) continue;
          if (!rule.selectorText.includes("ui-" + wanted)) continue;
          out.push({ ctx, selector: rule.selectorText, body: rule.style.cssText });
        }
      };
      walk(list, "");
    }
    return out;
  })()
`);
writeFileSync(join(outDir, "rules.json"), JSON.stringify(rules, null, 1), "utf8");
console.log(`rules mentioning ui-${prefix}: ${rules.length}`);

/* 3. Authored keyframes, so the motion timings are real. */
const keyframes = await evaluate(`
  (() => {
    const out = [];
    for (const sheet of document.styleSheets) {
      let list;
      try { list = sheet.cssRules } catch { continue }
      const walk = (rs) => {
        for (const rule of rs) {
          if (rule.cssRules && rule.selectorText === undefined) { walk(rule.cssRules); continue }
          if (rule.type === CSSRule.KEYFRAMES_RULE) out.push({ name: rule.name, css: rule.cssText });
        }
      };
      walk(list);
    }
    return out;
  })()
`);
writeFileSync(join(outDir, "keyframes.json"), JSON.stringify(keyframes, null, 1), "utf8");
console.log(`keyframes: ${keyframes.length}`);

/* 4. Rendered geometry + computed styles for the component's root and children. */
const geometry = await evaluate(`
  (() => {
    const root = document.querySelector(".ui-${prefix}");
    if (!root) return { error: "no root .ui-${prefix}" };
    const pick = (el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const keys = ["display","position","width","height","minWidth","borderRadius","background","backgroundColor",
        "boxShadow","border","color","fontSize","fontWeight","letterSpacing","lineHeight","gap","padding",
        "gridTemplateColumns","opacity","transform","filter","zIndex","overflow","justifyContent","alignItems",
        "strokeWidth","fill","stroke"];
      const style = {};
      for (const k of keys) { const v = cs[k]; if (v && v !== "none" && v !== "normal" && v !== "auto") style[k] = v; }
      return { tag: el.tagName.toLowerCase(), cls: el.className?.baseVal ?? el.className, w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y), style };
    };
    const nodes = [];
    const walk = (el, depth) => {
      if (depth > 5) return;
      nodes.push({ depth, ...pick(el) });
      if (el.tagName.toLowerCase() === "svg" || el.tagName.toLowerCase() === "path") return;
      for (const child of el.children) walk(child, depth + 1);
    };
    for (const child of root.children) walk(child, 0);
    return { root: pick(root), nodes: nodes.slice(0, 220) };
  })()
`);
writeFileSync(join(outDir, "geometry.json"), JSON.stringify(geometry, null, 1), "utf8");
console.log(`geometry nodes: ${geometry.nodes?.length ?? 0}`);

/* 5. The text content, so the header/legend wording is exact. */
const text = await evaluate(`document.querySelector(".ui-${prefix}").innerText`);
writeFileSync(join(outDir, "text.txt"), text, "utf8");

/* 6. A reference screenshot for visual diffing. */
const box = await evaluate(`
  (() => { const r = document.querySelector(".ui-${prefix}").getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height }; })()
`);
const shot = await send("Page.captureScreenshot", {
  format: "png",
  clip: { ...box, scale: 2 },
  captureBeyondViewport: true,
});
writeFileSync(join(outDir, "reference.png"), Buffer.from(shot.data, "base64"));

ws.close();
console.log(`wrote ${outDir}`);
