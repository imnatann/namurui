/**
 * Harvests every stylesheet from every item's own page into `.affectui/reference/_shared/`.
 *
 *   node scripts/harvest-sheets.mjs
 *
 * Each affectUI item composes from other items' sheets: a screen renders buttons, charts, meters
 * and folders that belong to separate items. `prepare-css.mjs` merges whatever it finds in the
 * shared pool, so the pool must be complete before injection — otherwise a screen renders with
 * half its chrome unstyled.
 *
 * One browser, one pass, every page; each `style[data-href]` is written once by name.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const repoRoot = join(root, "..");
const refRoot = join(repoRoot, ".affectui", "reference");
const shared = join(refRoot, "_shared");
const CDP = process.env.CDP ?? "http://127.0.0.1:9333";

mkdirSync(shared, { recursive: true });

const manifest = JSON.parse(readFileSync(join(root, "src", "gallery", "manifest.json"), "utf8"));
const targets = manifest.filter((item) => item.tier === "Pro");

const pages = await (await fetch(`${CDP}/json/list`)).json();
const page = pages.find((t) => t.type === "page");
if (!page) throw new Error("no CDP page target");

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  const entry = pending.get(msg.id);
  if (!entry) return;
  pending.delete(msg.id);
  msg.error ? entry.reject(new Error(JSON.stringify(msg.error))) : entry.resolve(msg.result);
});
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const i = ++id;
    pending.set(i, { resolve, reject });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

const seen = new Map();
for (const item of targets) {
  const url = `https://www.affectui.com/${item.kind}/${item.slug}`;
  await send("Page.navigate", { url });
  await new Promise((r) => setTimeout(r, 2600));
  const sheets = await evaluate(`(() => {
    const out = {};
    for (const tag of document.querySelectorAll("style[data-href]")) {
      const href = tag.getAttribute("data-href");
      const text = tag.textContent || "";
      if (href && text.length > 120) out[href] = text;
    }
    return out;
  })()`);
  for (const [href, css] of Object.entries(sheets ?? {})) {
    if (seen.has(href) && seen.get(href) >= css.length) continue;
    seen.set(href, css.length);
    writeFileSync(join(shared, `${href}.css`), css, "utf8");
  }
  process.stdout.write(`\r${item.slug.padEnd(24)} ${seen.size} sheets`);
}
ws.close();
console.log(`\nharvested ${seen.size} distinct sheets into .affectui/reference/_shared/`);

const listed = manifest.length;
console.log(`${existsSync(shared) ? "ok" : "missing"} — pool feeds ${listed} items`);
