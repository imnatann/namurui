/**
 * Captures every stylesheet an item composes from but that no reference owns.
 *
 *   node scripts/capture-shared.mjs
 *
 * After extracting all 79 items, some sheets are referenced by many items yet never extracted
 * on their own — `ui-button` is a Free item, `ui-screen-composer` belongs to no single slug.
 * `prepare-css.mjs` merges whatever sits in `.affectui/reference/_shared/`, so this fills the
 * pool by visiting the pages that load each missing sheet and taking its text verbatim.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const repoRoot = join(root, "..");
const refRoot = join(repoRoot, ".affectui", "reference");
const shared = join(refRoot, "_shared");
const CDP = process.env.CDP ?? "http://127.0.0.1:9333";

mkdirSync(shared, { recursive: true });

const dirs = readdirSync(refRoot).filter((d) => existsSync(join(refRoot, d, "meta.json")));

/** href -> the page that loads it. */
const wanted = new Map();
const owned = new Set();
for (const slug of dirs) {
  const meta = JSON.parse(readFileSync(join(refRoot, slug, "meta.json"), "utf8"));
  owned.add(meta.styleHref);
  for (const sheet of meta.sheets ?? []) {
    if (!sheet.href || sheet.href === "ui-toaster") continue;
    if (!wanted.has(sheet.href)) wanted.set(sheet.href, meta.url);
  }
}

const missing = [...wanted.keys()].filter(
  (href) => !owned.has(href) && !existsSync(join(shared, `${href}.css`)),
);
console.log(`${wanted.size} sheets referenced, ${missing.length} missing from the pool`);
if (!missing.length) process.exit(0);

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

/* Visit each distinct page once; take every sheet it loads, not only the one we were after. */
const pagesToVisit = [...new Set([...missing.map((href) => wanted.get(href))])];
const captured = new Set();
for (const url of pagesToVisit) {
  if ([...missing].every((href) => captured.has(href))) break;
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
    if (captured.has(href)) continue;
    if (!missing.includes(href)) continue;
    writeFileSync(join(shared, `${href}.css`), css, "utf8");
    captured.add(href);
  }
  process.stdout.write(`\r${url.split("/").pop().padEnd(24)} ${captured.size}/${missing.length}`);
}
ws.close();

console.log(`\ncaptured ${captured.size}/${missing.length}`);
const still = missing.filter((href) => !captured.has(href));
if (still.length) console.log("still missing:", still.join(", "));
