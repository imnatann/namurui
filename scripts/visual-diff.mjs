/**
 * Visual fidelity check: my component vs the reference screenshot.
 *
 *   node scripts/visual-diff.mjs <slug> [<slug> ...] [--all] [--threshold 0.12]
 *
 * Captures the gallery preview for each item at 2x and compares it pixel-by-pixel with
 * `.affectui/reference/<slug>/reference.png`, using the browser's own PNG decoder through a
 * canvas so no image library is needed.
 *
 * A pixel ratio is not proof of identity — antialiasing, font hinting and animation phase all
 * move pixels. It is a cheap way to catch an item that renders structurally but looks wrong:
 * missing sheet, collapsed height, stacked instead of gridded.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const repoRoot = join(root, "..");
const refRoot = join(repoRoot, ".affectui", "reference");
const outRoot = join(repoRoot, ".affectui", "visual");
const CDP = process.env.CDP ?? "http://127.0.0.1:9333";
const LOCAL = "http://127.0.0.1:5199";

const args = process.argv.slice(2);
const threshold = args.includes("--threshold") ? Number(args[args.indexOf("--threshold") + 1]) : 0.12;
const all = args.includes("--all");
const manifest = JSON.parse(readFileSync(join(root, "src", "gallery", "manifest.json"), "utf8"));
const slugs = all
  ? manifest.filter((item) => item.tier === "Pro").map((item) => item.slug)
  : args.filter((a) => !a.startsWith("--") && !/^\d*\.?\d+$/.test(a));

mkdirSync(outRoot, { recursive: true });

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

await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

const results = [];
for (const slug of slugs) {
  const refShot = join(refRoot, slug, "reference.png");
  const metaPath = join(refRoot, slug, "meta.json");
  if (!existsSync(refShot) || !existsSync(metaPath)) {
    results.push({ slug, status: "no reference" });
    continue;
  }
  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  const refBase64 = readFileSync(refShot).toString("base64");

  await evaluate(`location.href = ${JSON.stringify(`${LOCAL}/?vd=${Date.now()}#/${slug}`)}`);
  await new Promise((r) => setTimeout(r, 2400));

  /* Pin the preview to the reference's own width before capturing. Without this the gallery's
   * flex sizing renders the item at a different width than the original page did, and every
   * full-width comparison becomes a diff between two layouts rather than two implementations. */
  const refSize = await evaluate(`(async () => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = "data:image/png;base64," + ${JSON.stringify(refBase64)}; });
    return [img.width, img.height];
  })()`).catch(() => null);
  if (refSize) {
    const targetWidth = Math.round(refSize[0] / 2);
    await evaluate(`(() => {
      const pane = document.querySelector(".g-preview");
      if (!pane) return;
      pane.style.width = "${targetWidth}px";
      pane.style.maxWidth = "none";
      pane.style.padding = "0";
      pane.style.background = "transparent";
      pane.style.minHeight = "0";
    })()`);
    await new Promise((r) => setTimeout(r, 900));
  }

  const box = await evaluate(`(() => {
    const root = document.querySelector(${JSON.stringify("." + meta.rootClass)});
    if (!root) return null;
    const r = root.getBoundingClientRect();
    if (r.width < 2) return { width: 0 };
    return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.width, height: Math.min(Math.max(120, r.height), 2400) };
  })()`);
  if (!box || box.width < 2) {
    results.push({ slug, status: "root not found or zero width", root: meta.rootClass });
    continue;
  }

  const shot = await send("Page.captureScreenshot", {
    format: "png",
    clip: { ...box, scale: 2 },
    captureBeyondViewport: true,
  });
  const minePath = join(outRoot, `${slug}.png`);
  writeFileSync(minePath, Buffer.from(shot.data, "base64"));

  const mineBase64 = readFileSync(minePath).toString("base64");
  const diff = await evaluate(`(async () => {
    const load = (b64) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = "data:image/png;base64," + b64;
    });
    const [a, b] = await Promise.all([load(${JSON.stringify(refBase64)}), load(${JSON.stringify(mineBase64)})]);
    const w = Math.min(a.width, b.width);
    const h = Math.min(a.height, b.height);
    const read = (img) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, w, h).data;
    };
    const da = read(a);
    const db = read(b);
    let changed = 0;
    const tolerance = 24;
    for (let i = 0; i < da.length; i += 4) {
      if (
        Math.abs(da[i] - db[i]) > tolerance ||
        Math.abs(da[i + 1] - db[i + 1]) > tolerance ||
        Math.abs(da[i + 2] - db[i + 2]) > tolerance
      ) changed += 1;
    }
    return {
      ratio: changed / (da.length / 4),
      refW: a.width, refH: a.height, mineW: b.width, mineH: b.height,
      compared: [w, h],
    };
  })()`);

  results.push({
    slug,
    status: "compared",
    ratio: +diff.ratio.toFixed(3),
    refSize: [diff.refW, diff.refH],
    mineSize: [diff.mineW, diff.mineH],
  });
}

ws.close();

let pass = 0;
for (const r of results) {
  if (r.status !== "compared") {
    console.log(`${r.slug.padEnd(22)} ${r.status}${r.root ? ` (.${r.root})` : ""}`);
    continue;
  }
  const ok = r.ratio <= threshold;
  if (ok) pass += 1;
  const sizeNote =
    r.refSize.join("x") === r.mineSize.join("x") ? "" : `  size ${r.refSize.join("x")} vs ${r.mineSize.join("x")}`;
  console.log(`${ok ? "OK  " : "DIFF"} ${r.slug.padEnd(22)} ${(r.ratio * 100).toFixed(1)}% differ${sizeNote}`);
}
console.log(`\n${pass}/${results.length} within ${(threshold * 100).toFixed(0)}% pixel difference`);
