/**
 * Links every external sheet an extracted item depends on.
 *
 *   node scripts/link-companions.mjs [slug ...] [--all]
 *
 * A screen is composed from other items' sheets: `ui-button` for its buttons, `ui-kpi-chart`
 * for a chart card, `ui-um` for a usage meter. The extractor records each sheet's `href` in
 * `meta.json.sheets`, but it cannot know which of them the item actually renders — it filters
 * out page chrome, and it has no `component.css` to copy for a sheet that was never extracted
 * on its own.
 *
 * This walks each item's sheet list and materialises a `companion-<href>.css` for every sheet
 * that is:
 *   - not the item's own sheet
 *   - not page chrome that is always mounted (the toaster)
 *   - actually used by a class present in the item's DOM
 *
 * The sheet text is taken from another reference that owns it, or captured live when no
 * reference exists (e.g. `ui-button`, which belongs to a free item).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const refRoot = join(repoRoot, ".affectui", "reference");
const CDP = process.env.CDP ?? "http://127.0.0.1:9333";

/** Page chrome: always mounted, never part of the item being drawn. */
const CHROME = new Set(["ui-toaster"]);

/** Which reference directory owns a given stylesheet href. */
function ownerOf(href, slugs) {
  const candidates = [
    href.replace(/^ui-/, ""),
    href.replace(/^ui-screen-/, ""),
    href.replace(/^ui-block-/, ""),
    href.replace(/-clean$/, ""),
    href.replace(/^ui-/, "").replace(/-clean$/, ""),
  ];
  for (const candidate of candidates) {
    if (slugs.includes(candidate)) {
      const meta = join(refRoot, candidate, "meta.json");
      if (existsSync(meta)) {
        const parsed = JSON.parse(readFileSync(meta, "utf8"));
        if (parsed.styleHref === href) return candidate;
      }
    }
  }
  return null;
}

/** Classes a component's TSX emits, so we can tell a used sheet from a coincidental one. */
function classesUsedBy(slug) {
  const path = join(here, "..", "src", "namurui", `${slug}.tsx`);
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8");
  const found = new Set();
  for (const match of text.matchAll(/\bui-[a-z0-9]+(?:__[a-z0-9-]+)?(?:--[a-z0-9-]+)?\b/g)) found.add(match[0]);
  return found;
}

/** Does any class from `href`'s declared list appear in the item's component? */
function sheetIsUsed(css, used) {
  if (!used) return true;
  for (const match of css.matchAll(/\.(ui-[a-z0-9]+(?:__[a-z0-9-]+)?)/g)) {
    if (used.has(match[1])) return true;
  }
  return false;
}

let browser = null;
async function captureSheet(href) {
  if (!browser) {
    const pages = await (await fetch(`${CDP}/json/list`)).json();
    const page = pages.find((t) => t.type === "page");
    if (!page) throw new Error("no CDP page");
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
    browser = {
      ws,
      evaluate: async (expression) => {
        const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
        return result.result.value;
      },
    };
  }
  return await browser.evaluate(
    `(() => { const t = document.querySelector('style[data-href="${href}"]'); return t ? t.textContent : null; })()`,
  );
}

const args = process.argv.slice(2);
const all = args.includes("--all");
const slugs = all
  ? readdirSync(refRoot).filter((dir) => existsSync(join(refRoot, dir, "meta.json")))
  : args.filter((a) => !a.startsWith("--"));

mkdirSync(refRoot, { recursive: true });
const allSlugs = readdirSync(refRoot).filter((dir) => existsSync(join(refRoot, dir, "meta.json")));

let linked = 0;
let captured = 0;
const unresolved = [];

for (const slug of slugs) {
  const dir = join(refRoot, slug);
  const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
  const used = classesUsedBy(slug);
  const own = meta.styleHref;
  const ownCompanions = new Set(
    readdirSync(dir)
      .filter((f) => f.startsWith("companion-"))
      .map((f) => f.replace(/^companion-/, "").replace(/\.css$/, "")),
  );

  for (const sheet of meta.sheets ?? []) {
    const href = sheet.href;
    if (href === own || CHROME.has(href)) continue;
    const file = join(dir, `companion-${href.replace(/[^a-z0-9-]/gi, "")}.css`);
    const present = existsSync(file);

    // Which classes does this sheet style, and are any of them in use here?
    const owner = ownerOf(href, allSlugs);
    const sourceCss = owner ? join(refRoot, owner, "component.css") : null;
    let css = null;
    if (sourceCss && existsSync(sourceCss)) css = readFileSync(sourceCss, "utf8");

    if (!css && !present) {
      css = await captureSheet(href);
      if (css) captured += 1;
    }

    if (css && !sheetIsUsed(css, used)) continue;

    if (!present && css) {
      writeFileSync(file, css, "utf8");
      linked += 1;
    } else if (present && !ownCompanions.has(href.replace(/[^a-z0-9-]/gi, "").replace(/^companion-/, ""))) {
      // already on disk under the expected name
      linked += 0;
    }
  }
}

if (browser) browser.ws.close();
console.log(`linked ${linked} companion sheets (${captured} captured live) across ${slugs.length} items`);
for (const item of unresolved) console.log(`  unresolved: ${item}`);
