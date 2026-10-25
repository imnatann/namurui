/**
 * Injects every extracted stylesheet, then reports what still needs work.
 *
 *   node scripts/rebuild-pass.mjs
 *
 * Steps:
 *   1. prepare-css for every reference (merges shell chrome where an item is composed)
 *   2. inject-css into every Pro component
 *   3. report any component whose css block is still a placeholder or missing entirely
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const repoRoot = join(root, "..");

const run = (script, args = []) => {
  const result = spawnSync(process.execPath, [join(here, script), ...args], {
    cwd: root,
    encoding: "utf8",
  });
  return { status: result.status, out: (result.stdout ?? "") + (result.stderr ?? "") };
};

console.log("1. preparing sheets");
const prepared = run("prepare-css.mjs", ["--all"]);
console.log(prepared.out.trim().split("\n")[0]);

console.log("2. injecting");
const injected = run("inject-css.mjs", ["--all"]);
console.log(injected.out.trim());

console.log("3. checking");

const manifest = JSON.parse(readFileSync(join(root, "src", "gallery", "manifest.json"), "utf8"));
const pro = manifest.filter((item) => item.tier === "Pro");

const placeholder = /const css = \/\* css \*\/ `\s*\/\* placeholder/;
const rows = [];
for (const item of pro) {
  const path = join(root, "src", "namurui", `${item.slug}.tsx`);
  if (!existsSync(path)) {
    rows.push({ slug: item.slug, status: "missing file" });
    continue;
  }
  const source = readFileSync(path, "utf8");
  const start = source.indexOf("const css = /* css */ `");
  const end = source.lastIndexOf("`;");
  const cssLength = start === -1 || end < start ? 0 : end - start;
  if (placeholder.test(source)) rows.push({ slug: item.slug, status: "still placeholder" });
  else if (cssLength < 800) rows.push({ slug: item.slug, status: `css only ${cssLength}B` });
  else rows.push({ slug: item.slug, status: "ok", cssLength });
}

const byStatus = rows.reduce((acc, row) => {
  const key = row.status === "ok" ? "ok" : "needs work";
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});

console.log(`   ${byStatus.ok ?? 0} injected, ${byStatus["needs work"] ?? 0} needing work`);
for (const row of rows.filter((r) => r.status !== "ok")) {
  console.log(`   ${row.slug}: ${row.status}`);
}
