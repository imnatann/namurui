/**
 * Renames a root class across one item's extracted reference.
 *
 *   node scripts/reference-rename.mjs <slug> <oldRoot> <newRoot>
 *
 * Needed because two items in the library genuinely share an abbreviation — `agent-lanes` and
 * `agent-ledger` both ship `.ui-alc`, and `onboarding` collides with `outreach-branches` on
 * `.ui-ob`. On affectui.com each lives on its own page so it never shows; in the gallery both
 * stylesheets are hoisted into one document, and whichever mounts second would restyle the
 * first. Renaming here keeps the CSS byte-identical apart from the selector.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

const [, , slug, oldRoot, newRoot] = process.argv;
if (!slug || !oldRoot || !newRoot) {
  console.error("usage: node scripts/reference-rename.mjs <slug> <oldRoot> <newRoot>");
  process.exit(1);
}

const refDir = join(repoRoot, ".affectui", "reference", slug);
if (!existsSync(refDir)) {
  console.error(`no reference at ${refDir}`);
  process.exit(1);
}

/* Class-token boundary: a letter/digit or a lone `_` continues the name, but `-` and BEM `__`
 * belong to the same namespace — so `.ui-ob-head` and `.ui-ob-check__bar` rename while
 * `ui-onboarding` and `ui-object` do not. The leading guard also excludes `--ui-ob-*`. */
const pattern = new RegExp(`(?<![\\w-])${oldRoot.replace(/-/g, "\\-")}(?![A-Za-z0-9]|_(?!_))`, "g");

const textFiles = ["component.css", "component.pretty.css", "prepared.css", "dom.html", "text.txt"];
const jsonFiles = ["nodes.json", "meta.json"];

let total = 0;
for (const file of textFiles) {
  const path = join(refDir, file);
  if (!existsSync(path)) continue;
  const before = readFileSync(path, "utf8");
  const after = before.replace(pattern, newRoot);
  if (after !== before) {
    writeFileSync(path, after, "utf8");
    total += 1;
  }
}

for (const file of jsonFiles) {
  const path = join(refDir, file);
  if (!existsSync(path)) continue;
  const before = readFileSync(path, "utf8");
  const after = before.replace(pattern, newRoot);
  if (after !== before) {
    writeFileSync(path, after, "utf8");
    total += 1;
  }
}

console.log(`${slug}: ${oldRoot} -> ${newRoot} in ${total} files`);
