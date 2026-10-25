/**
 * Replaces a component's `const css` block with the exact stylesheet extracted from the live
 * affectUI page, so no CSS is ever retyped by hand.
 *
 *   node scripts/inject-css.mjs <slug> [<slug> ...] [--all]
 *
 * Reads  .affectui/reference/<slug>/prepared.css   (or component.css when no shell is involved)
 * Writes src/namurui/<slug>.tsx, replacing everything between the css template backticks.
 *
 * A `--from <refSlug>` pair lets a scratch file borrow another item's sheet, which is only used
 * for pipeline testing.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const srcDir = join(here, "..", "src", "namurui");
const refRoot = join(repoRoot, ".affectui", "reference");

/** A template literal cannot carry a raw backtick or `${`, so escape both. */
const escapeForTemplate = (css) =>
  css.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

function inject(slug, refSlug) {
  const componentPath = join(srcDir, `${slug}.tsx`);
  if (!existsSync(componentPath)) return { slug, status: "no component" };

  const refDir = join(refRoot, refSlug);
  const prepared = join(refDir, "prepared.css");
  const raw = join(refDir, "component.css");
  const cssPath = existsSync(prepared) ? prepared : raw;
  if (!existsSync(cssPath)) return { slug, status: "no reference", refSlug };

  /* One rule per line: the shipped sheets are minified, which makes the gallery's Code tab
   * unreadable. Adding a newline after each `}` is whitespace between rules — no string in any
   * extracted sheet contains a brace, so this cannot change a selector or a value. */
  const css = readFileSync(cssPath, "utf8").replace(/}/g, "}\n").replace(/\n\s*\n/g, "\n");
  const source = readFileSync(componentPath, "utf8");

  const marker = "const css = /* css */ `";
  const start = source.indexOf(marker);
  if (start === -1) return { slug, status: "no css block" };
  const openTick = start + marker.length;
  const closeTick = source.lastIndexOf("`;");
  if (closeTick < openTick) return { slug, status: "malformed css block" };

  const next = source.slice(0, openTick) + "\n" + escapeForTemplate(css) + "\n" + source.slice(closeTick);
  writeFileSync(componentPath, next, "utf8");
  return { slug, status: "injected", bytes: css.length, refSlug };
}

const args = process.argv.slice(2);
const fromIndex = args.indexOf("--from");
const refOverride = fromIndex !== -1 ? args[fromIndex + 1] : undefined;
const all = args.includes("--all");
const slugs = all
  ? JSON.parse(readFileSync(join(here, "..", "src", "gallery", "manifest.json"), "utf8"))
      .filter((item) => item.tier === "Pro")
      .map((item) => item.slug)
  : args.filter((a) => !a.startsWith("--") && a !== refOverride);

let injected = 0;
const problems = [];
for (const slug of slugs) {
  const result = inject(slug, refOverride ?? slug);
  if (result.status === "injected") injected += 1;
  else problems.push(result);
}
console.log(`injected ${injected}/${slugs.length}`);
for (const p of problems) console.log(`  ${p.slug}: ${p.status}${p.refSlug ? ` (${p.refSlug})` : ""}`);
