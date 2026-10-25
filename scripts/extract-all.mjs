/**
 * Extracts every Pro item's real implementation surface.
 *
 *   node scripts/extract-all.mjs [kindFilter]
 *
 * One Chrome target is reused; each item takes a few seconds. Results land in
 * .affectui/reference/<slug>/ and a summary is printed at the end.
 */
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const manifest = JSON.parse(
  readFileSync(join(here, "..", "src", "gallery", "manifest.json"), "utf8"),
);

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const filter = args.find((a) => !a.startsWith("--") && !/^\d+$/.test(a));
const start = Number(flag("--start") ?? 0);
const end = Number(flag("--end") ?? Number.MAX_SAFE_INTEGER);
const all = manifest.filter((item) => item.tier === "Pro" && (!filter || item.kind === filter));
const targets = all.slice(start, end);

console.log(`extracting ${targets.length} Pro items`);

const failures = [];
let done = 0;

for (const item of targets) {
  const outDir = join(repoRoot, ".affectui", "reference", item.slug);
  if (existsSync(join(outDir, "meta.json"))) {
    done += 1;
    console.log(`skip ${item.slug} (already extracted)`);
    continue;
  }
  const code = await new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [join(here, "extract-item.mjs"), item.kind, item.slug],
      { cwd: join(here, ".."), stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (out += chunk));
    child.on("close", (status) => resolve({ status, out }));
  });
  if (code.status === 0) {
    done += 1;
    console.log(code.out.trim().split("\n").pop());
  } else {
    failures.push({ slug: item.slug, kind: item.kind, log: code.out.trim().slice(0, 300) });
    console.log(`FAIL ${item.slug}: ${code.out.trim().split("\n").pop()}`);
  }
}

console.log(`\n${done}/${targets.length} extracted`);
if (failures.length) {
  console.log("failures:");
  for (const f of failures) console.log(`  ${f.kind}/${f.slug}: ${f.log.split("\n").pop()}`);
}
