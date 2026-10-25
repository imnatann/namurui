/**
 * Builds `prepared.css` for one item: the sheet to inject.
 *
 * Most items are self-contained. Screens are not — `ui-screen-<slug>` only carries layout and
 * takes its colours from the app shell it sits inside, so the shell's custom properties are
 * lifted onto the screen root first. Anything a rule reads but nothing declares is reported,
 * because that is a variable the item expects from its host.
 *
 *   node scripts/prepare-css.mjs [--all]
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const refRoot = join(repoRoot, ".affectui", "reference");

/** Custom properties declared directly on one selector. */
function varsOf(css, selector) {
  const match = css.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`));
  if (!match) return "";
  return match[1]
    .split(";")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("--"))
    .join(";\n  ");
}

/** Every selector block that declares custom properties, keyed by selector. */
function varBlocks(css) {
  const out = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim();
    const body = match[2];
    const vars = body
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.startsWith("--"));
    if (vars.length) out.push({ selector, vars });
  }
  return out;
}

function prepare(slug) {
  const refDir = join(refRoot, slug);
  const metaPath = join(refDir, "meta.json");
  if (!existsSync(metaPath)) return { slug, status: "not extracted" };

  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  const css = readFileSync(join(refDir, "component.css"), "utf8");
  const root = meta.rootClass;

  /* Which variables does the item read but not declare? Those come from a shell. */
  const declared = new Set();
  for (const block of varBlocks(css)) for (const v of block.vars) declared.add(v.split(":")[0].trim());
  // Anything the component sets inline is declared at runtime, not in the sheet.
  const nodesPath = join(refDir, "nodes.json");
  if (existsSync(nodesPath)) {
    const { nodes } = JSON.parse(readFileSync(nodesPath, "utf8"));
    for (const node of nodes) {
      const inline = node.attrs?.style ?? "";
      for (const m of inline.matchAll(/(--[\w-]+)\s*:/g)) declared.add(m[1]);
    }
  }
  const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
  const missing = [...used].filter((v) => !declared.has(v));

  /* Shared sheets live once in `_shared/` and are linked in as companions. A screen composes
   * from several of them — buttons, a chart, a meter — and each has to be merged or the screen
   * renders half-styled. */
  const sharedDir = join(refRoot, "_shared");
  const shared = existsSync(sharedDir)
    ? readdirSync(sharedDir).filter((f) => f.endsWith(".css")).map((f) => f.replace(/\.css$/, ""))
    : [];
  const metaSheets = (meta.sheets ?? []).map((s) => s.href);
  for (const href of metaSheets) {
    if (href === meta.styleHref) continue;
    const name = `companion-${href.replace(/[^a-z0-9-]/gi, "")}.css`;
    const target = join(refDir, name);
    const source = join(sharedDir, `${href}.css`);
    if (!existsSync(target) && existsSync(source)) {
      writeFileSync(target, readFileSync(source, "utf8"), "utf8");
    }
  }

  /* Pull the declarations out of the companion sheets, in order, and re-scope them. */
  const companions = readdirSync(refDir).filter((f) => f.startsWith("companion-") && f.endsWith(".css"));
  const lifted = [];
  const stillMissing = new Set(missing);
  for (const file of companions) {
    const companion = readFileSync(join(refDir, file), "utf8");
    for (const block of varBlocks(companion)) {
      for (const line of block.vars) {
        const name = line.split(":")[0].trim();
        if (!stillMissing.has(name)) continue;
        lifted.push(line);
        stillMissing.delete(name);
      }
    }
    if (!stillMissing.size) break;
  }

  /* A screen is a modifier of the shell (`.ui-as-chat` on top of `.ui-as`) and its rules
   * select shell classes such as `.ui-as-icon-btn`. Those live in the companion sheet, so the
   * companion is included with its root selector re-pointed at the screen's own root. Without
   * this the screen renders with half its chrome unstyled. */
  /* Every companion sheet the item composes from, in meta order, then the item's own sheet
   * last so its rules win. A screen leans on the shell for chrome, on `ui-button` for its
   * buttons, on `ui-glass-folder` for illustration marks — leaving any of them out renders
   * part of the item unstyled, which is exactly what a half-merged sheet looks like. */
  const parts = [];
  const seen = new Set([meta.styleHref]);
  for (const sheet of meta.sheets ?? []) {
    const href = sheet.href;
    if (!href || seen.has(href) || href === "ui-toaster") continue;
    seen.add(href);

    const name = `companion-${href.replace(/[^a-z0-9-]/gi, "")}.css`;
    let text = null;
    const materialised = join(refDir, name);
    if (existsSync(materialised)) text = readFileSync(materialised, "utf8");
    else if (existsSync(join(sharedDir, `${href}.css`))) text = readFileSync(join(sharedDir, `${href}.css`), "utf8");
    if (!text) continue;

    /* A shell sheet is also a palette source, so its root rules are re-pointed at this item's
     * root. Other sheets are used verbatim: their class names are the ones the JSX emits. */
    if (href.includes("app-shell") || href.includes("screen-")) {
      const sharedRoot = (text.match(/^\.(ui-[a-z0-9-]+)\s*\{/m) ?? [])[1];
      if (sharedRoot && sharedRoot !== root) {
        text = text.replace(new RegExp(`\\.${sharedRoot}(?![\\w-])`, "g"), `.${root}`);
      }
    }
    parts.push(`/* ${href} — composed into this item */\n${text}`);
  }

  parts.push(css);

  writeFileSync(join(refDir, "prepared.css"), parts.join("\n\n"), "utf8");
  return {
    slug,
    status: "lifted shell vars",
    lifted: lifted.length,
    missing: stillMissing.size,
    unresolved: [...stillMissing].slice(0, 8),
    bytes: parts.join("\n\n").length,
  };
}

const all = process.argv.includes("--all");
const slugs = all
  ? readdirSync(refRoot).filter((d) => existsSync(join(refRoot, d, "meta.json")))
  : process.argv.slice(2).filter((a) => !a.startsWith("--"));

const lifted = [];
const unresolved = [];
for (const slug of slugs) {
  const result = prepare(slug);
  if (result.status === "lifted shell vars") lifted.push(result);
  if (result.missing) unresolved.push(result);
}
console.log(`prepared ${slugs.length} — ${lifted.length} needed shell variables`);
for (const r of lifted) {
  console.log(`  ${r.slug}: +${r.lifted} vars${r.missing ? `, ${r.missing} unresolved (${r.unresolved.join(", ")})` : ""}`);
}
