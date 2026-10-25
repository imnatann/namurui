/**
 * Class coverage: does the component's JSX name every class the reference DOM uses?
 *
 *   node scripts/class-coverage.mjs [slug ...] [--all] [--min 0.9]
 *
 * The reference DOM is the contract. If `.ui-aic__fold` exists in `dom.html` and never appears
 * in the TSX, the sheet has a rule for a state the component cannot produce — so this catches
 * missing structure without needing a browser.
 *
 * Classes that only appear in a dynamic state (a menu that opens, a toast in flight) are
 * expected to be missed; the report names them so the miss can be judged rather than assumed.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const repoRoot = join(root, "..");
const refRoot = join(repoRoot, ".affectui", "reference");

const args = process.argv.slice(2);
const min = args.includes("--min") ? Number(args[args.indexOf("--min") + 1]) : 0.9;
const all = args.includes("--all");
const manifest = JSON.parse(readFileSync(join(root, "src", "gallery", "manifest.json"), "utf8"));
const slugs = all
  ? manifest.filter((item) => item.tier === "Pro").map((item) => item.slug)
  : args.filter((a) => !a.startsWith("--") && !/^\d*\.?\d+$/.test(a));

/**
 * Every ui-* class token in a blob of HTML or JSX.
 *
 * JSX writes classes in three shapes — `className="ui-x__a"`, `className={"ui-x__a"}` and
 * `className={["ui-x__a", extra].join(" ")}` — and class names also live in ternaries and
 * lookup maps. Rather than parse JSX, this scans every string literal and every bare class-like
 * token in the file, which over-counts slightly and never under-counts.
 */
const classesOf = (text) => {
  const found = new Set();
  for (const match of text.matchAll(/\bui-[a-z0-9]+(?:__[a-z0-9-]+)?(?:--[a-z0-9-]+)?\b/g)) {
    found.add(match[0]);
  }
  return found;
};

const rows = [];
for (const slug of slugs) {
  const domPath = join(refRoot, slug, "dom.html");
  const tsxPath = join(root, "src", "namurui", `${slug}.tsx`);
  if (!existsSync(domPath) || !existsSync(tsxPath)) {
    rows.push({ slug, status: "missing" });
    continue;
  }
  const ref = classesOf(readFileSync(domPath, "utf8"));
  const mine = classesOf(readFileSync(tsxPath, "utf8"));
  const missing = [...ref].filter((cls) => !mine.has(cls));
  const extra = [...mine].filter((cls) => !ref.has(cls));
  const coverage = ref.size ? (ref.size - missing.length) / ref.size : 1;
  rows.push({ slug, status: "compared", refSize: ref.size, mineSize: mine.size, coverage, missing, extra });
}

let pass = 0;
for (const row of rows) {
  if (row.status !== "compared") {
    console.log(`${row.slug.padEnd(22)} ${row.status}`);
    continue;
  }
  const ok = row.coverage >= min;
  if (ok) pass += 1;
  const note = row.missing.length ? `  missing ${row.missing.length}: ${row.missing.slice(0, 4).join(", ")}` : "";
  console.log(
    `${ok ? "OK  " : "GAP "} ${row.slug.padEnd(22)} ${row.refSize} classes, ${Math.round(row.coverage * 100)}% covered${note}`,
  );
}
console.log(`\n${pass}/${rows.length} at or above ${Math.round(min * 100)}% class coverage`);
