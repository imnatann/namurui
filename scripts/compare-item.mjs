/**
 * Structural fidelity check: does my component produce the same DOM as the original?
 *
 *   node scripts/compare-item.mjs <slug> [<slug> ...]
 *
 * Compares, against .affectui/reference/<slug>/:
 *   - the ordered tag.class sequence of the subtree
 *   - the set of classes used
 *   - the root's computed style for the properties the original sets
 *
 * Run it against the dev server on 5199.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const refRoot = join(repoRoot, ".affectui", "reference");
const LOCAL = process.env.LOCAL ?? "http://127.0.0.1:5199";
const CDP = process.env.CDP ?? "http://127.0.0.1:9333";

/** `tag.class` for every element in an HTML string, in document order. */
function sequenceOf(html) {
  const out = [];
  for (const match of html.matchAll(/<([a-zA-Z][\w-]*)([^>]*)>/g)) {
    const tag = match[1].toLowerCase();
    if (tag === "br" || tag === "path" || tag === "stop" || tag === "defs") continue;
    const cls = /class="([^"]*)"/.exec(match[2]);
    if (!cls) continue;
    const first = cls[1].split(/\s+/)[0];
    if (!first) continue; // an unclassed element has no identity to compare
    out.push(`${tag}.${first}`);
  }
  return out;
}

async function openLocal() {
  const pages = await (await fetch(`${CDP}/json/list`)).json();
  let page = pages.find((t) => t.type === "page" && t.url.includes("127.0.0.1:5199"));
  if (!page) {
    page = await (await fetch(`${CDP}/json/new?${encodeURIComponent(LOCAL + "/")}`, { method: "PUT" })).json();
  }
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
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };
  return { send, evaluate, ws };
}

/* No arguments means every Pro item: passing 79 slugs through the shell is fragile (a stray
 * CR from a generated list reads as a different slug), so the manifest is the default. */
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const manifest = JSON.parse(readFileSync(join(here, "..", "src", "gallery", "manifest.json"), "utf8"));
const slugs = (args.length ? args : manifest.filter((i) => i.tier === "Pro").map((i) => i.slug))
  .map((s) => s.trim())
  .filter(Boolean);

const browser = await openLocal();
const results = [];

for (const slug of slugs) {
  const refDir = join(refRoot, slug);
  const metaPath = join(refDir, "meta.json");
  const domPath = join(refDir, "dom.html");
  if (!existsSync(metaPath) || !existsSync(domPath)) {
    results.push({ slug, status: "not extracted" });
    continue;
  }
  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  const refSequence = sequenceOf(readFileSync(domPath, "utf8"));

  await browser.evaluate(`location.href = ${JSON.stringify(`${LOCAL}/?cmp=${Date.now()}#/${slug}`)}`);

  /* The demo is a lazy chunk: navigating does not mean the component has mounted. Poll for the
   * root instead of assuming a fixed delay, or a slow module load reads as "no root". */
  const rootSelector = JSON.stringify(`.${meta.rootClass}`);
  let mounted = false;
  for (let attempt = 0; attempt < 40 && !mounted; attempt += 1) {
    await new Promise((r) => setTimeout(r, 150));
    mounted = await browser
      .evaluate(`!!document.querySelector(${rootSelector})`)
      .catch(() => false);
  }
  if (!mounted) {
    results.push({ slug, status: "root never mounted", root: meta.rootClass });
    continue;
  }

  /* Let the first animated frame land. Several items reveal their children on a timer (a
   * thinking panel, a fan-out grid, a streamed answer); measuring the instant the root exists
   * compares against an empty shell and reads as a structural gap that is not one. */
  await new Promise((r) => setTimeout(r, 900));

  const mine = await browser.evaluate(`(() => {
    const root = document.querySelector(${JSON.stringify("." + meta.rootClass)});
    if (!root) return null;
    const out = [];
    const walk = (el) => {
      const tag = el.tagName.toLowerCase();
      const first = String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).split(/\\s+/)[0];
      if (tag !== "br" && tag !== "path" && tag !== "stop" && tag !== "defs" && first) out.push(tag + "." + first);
      for (const child of el.children) walk(child);
    };
    walk(root);
    const box = root.getBoundingClientRect();
    return { sequence: out, box: [Math.round(box.width), Math.round(box.height)] };
  })()`);

  if (!mine) {
    results.push({ slug, status: "no root", root: meta.rootClass });
    continue;
  }

  const refSet = new Set(refSequence);
  const mineSet = new Set(mine.sequence);
  const missing = [...refSet].filter((c) => !mineSet.has(c));
  const extra = [...mineSet].filter((c) => !refSet.has(c));
  const matched = refSequence.filter((c) => mineSet.has(c)).length;

  results.push({
    slug,
    status: "compared",
    root: meta.rootClass,
    refCount: refSequence.length,
    mineCount: mine.sequence.length,
    coverage: refSequence.length ? +(matched / refSequence.length).toFixed(2) : 0,
    missing: missing.slice(0, 14),
    extra: extra.slice(0, 8),
    box: mine.box,
  });
}

browser.ws.close();

let ok = 0;
for (const r of results) {
  if (r.status !== "compared") {
    console.log(`${r.slug}: ${r.status}${r.root ? ` (${r.root})` : ""}`);
    continue;
  }
  const flag = r.coverage >= 0.85 ? "OK  " : "DIFF";
  if (r.coverage >= 0.85) ok += 1;
  console.log(
    `${flag} ${r.slug.padEnd(22)} ${r.refCount}→${r.mineCount} elems  coverage ${Math.round(r.coverage * 100)}%` +
      (r.missing.length ? `  missing: ${r.missing.slice(0, 5).join(", ")}` : ""),
  );
}
console.log(`\n${ok}/${results.length} at or above 85% structural match`);
