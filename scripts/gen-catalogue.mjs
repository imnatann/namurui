/**
 * Generates docs/catalogue.md from the manifest and each component's exported props type.
 * Run: node scripts/gen-catalogue.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const manifest = JSON.parse(readFileSync(join(root, "src", "gallery", "manifest.json"), "utf8"));
const categories = JSON.parse(
  readFileSync(join(root, "src", "gallery", "categories.json"), "utf8"),
);

const kindLabels = {
  components: "Components",
  screens: "Screens",
  blocks: "Blocks",
  illustrations: "Illustrations",
  motion: "Motion",
};

/** Inner text of the brace at `open`, matched to its close. */
function braceBody(source, open) {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return null;
}

/** End index of a type expression: the first `;` outside `{}`, `()` and `[]`. */
function typeExpressionEnd(source, start) {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{" || ch === "(" || ch === "[") depth++;
    else if (ch === "}" || ch === ")" || ch === "]") depth--;
    else if (ch === ";" && depth === 0) return i;
  }
  return source.length;
}

/** Split on a separator outside `{}`, `()` and `[]`. */
function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{" || ch === "(" || ch === "[") depth++;
    else if (ch === "}" || ch === ")" || ch === "]") depth--;
    else if (ch === separator && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

/** Whether the first `(` of `text` closes on its last character. */
function wrapsWhole(text) {
  if (!text.startsWith("(") || !text.endsWith(")")) return false;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") {
      depth--;
      if (depth === 0) return i === text.length - 1;
    }
  }
  return false;
}

/** The first exported `*Props` declaration: an inline body or a type expression. */
function propsDeclaration(source) {
  const decl = /export\s+(type|interface)\s+(\w+Props)\b\s*(<[^>{}]*>)?/.exec(source);
  if (!decl) return null;
  const after = decl.index + decl[0].length;
  if (decl[1] === "interface") {
    const open = source.indexOf("{", after);
    if (open === -1) return null;
    if (!/^\s*(?:extends\s+[\w$.,\s<>]+)?$/.test(source.slice(after, open))) return null;
    const body = braceBody(source, open);
    return body === null ? null : { name: decl[2], body };
  }
  const eq = source.indexOf("=", after);
  if (eq === -1) return null;
  const end = typeExpressionEnd(source, eq + 1);
  return { name: decl[2], expr: source.slice(eq + 1, end).trim() };
}

/** A local (possibly non-exported) type alias or interface declared in the same file. */
function localType(source, name) {
  const alias = new RegExp(
    `(?:^|\\n)\\s*(?:export\\s+)?type\\s+${name}\\b\\s*(?:<[^>{}]*>)?\\s*=`,
  ).exec(source);
  if (alias) {
    const start = alias.index + alias[0].length;
    return { expr: source.slice(start, typeExpressionEnd(source, start)).trim() };
  }
  const iface = new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?interface\\s+${name}\\b[^{]*\\{`).exec(source);
  if (iface) {
    const body = braceBody(source, iface.index + iface[0].length - 1);
    if (body !== null) return { body };
  }
  return null;
}

/** Net `{}`, `()` and `[]` depth of one line, used to follow a member type across lines. */
function bracketDelta(text) {
  let depth = 0;
  for (const ch of text) {
    if (ch === "{" || ch === "(" || ch === "[") depth++;
    else if (ch === "}" || ch === ")" || ch === "]") depth--;
  }
  return depth;
}

/** A doc block as one sentence: comment markers and line-leading stars removed. */
function cleanDoc(block) {
  return block
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\|/g, "\\|");
}

/** One level of `name?: type;` members, with the doc comment immediately above each. */
function parsePropsMembers(body) {
  const lines = body.split(/\r?\n/);
  const members = [];
  let doc = [];
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      i++;
      continue;
    }
    if (trimmed.startsWith("/**")) {
      let block = trimmed;
      while (!block.includes("*/") && i + 1 < lines.length) {
        i++;
        block += "\n" + lines[i];
      }
      doc.push(block);
      i++;
      continue;
    }
    if (trimmed.startsWith("*") || trimmed.startsWith("//")) {
      i++;
      continue;
    }
    const member = /^([\w$]+|"[^"]+"|'[^']+')\s*(\?)?\s*:\s*([\s\S]*)$/.exec(trimmed);
    if (!member) {
      i++;
      doc = [];
      continue;
    }
    let type = member[3];
    let depth = bracketDelta(type);
    while (i + 1 < lines.length && (depth > 0 || !/;\s*$/.test(type))) {
      i++;
      type += " " + lines[i];
      depth += bracketDelta(lines[i]);
    }
    type = type
      .replace(/;\s*$/, "")
      .replace(/\s+/g, " ")
      .replace(/\(\s+/g, "(")
      .replace(/\s*,\s*\)/g, ")")
      .trim();
    members.push({
      name: member[1].replace(/^["']|["']$/g, ""),
      type,
      optional: Boolean(member[2]),
      doc: cleanDoc(doc.join("\n")),
    });
    doc = [];
    i++;
  }
  return members;
}

/** Resolve one intersection part to its members. */
function resolvePart(source, part, seen) {
  let text = part.trim();
  if (wrapsWhole(text)) return resolveExpression(source, text.slice(1, -1), seen).flat();
  if (text.startsWith("{")) {
    const body = braceBody(text, 0);
    return body === null ? [] : parsePropsMembers(body);
  }
  const id = /^([A-Za-z_$][\w$]*)$/.exec(text);
  if (id && !seen.has(id[1])) {
    const local = localType(source, id[1]);
    if (local) {
      const next = new Set(seen).add(id[1]);
      if (local.body !== undefined) return parsePropsMembers(local.body);
      return resolveExpression(source, local.expr, next).flat();
    }
  }
  return [];
}

/** Resolve a type expression to its union arms, each arm a list of members. */
function resolveExpression(source, expr, seen) {
  return splitTopLevel(expr, "|").map((arm) => {
    const members = [];
    for (const part of splitTopLevel(arm, "&")) members.push(...resolvePart(source, part, seen));
    return members;
  });
}

/** Union two member types, parenthesising function types so the union stays readable. */
function unionType(left, right) {
  const wrap = (type) => (type.includes("=>") && !wrapsWhole(type) ? `(${type})` : type);
  return `${wrap(left)} | ${wrap(right)}`;
}

/** Merge union arms, unioning the types of members that appear in more than one arm. */
function mergeArms(arms) {
  const merged = new Map();
  for (const arm of arms) {
    for (const member of arm) {
      const prev = merged.get(member.name);
      if (!prev) {
        merged.set(member.name, { ...member });
        continue;
      }
      if (prev.type !== member.type) prev.type = unionType(prev.type, member.type);
      prev.optional = prev.optional || member.optional;
      if (!prev.doc) prev.doc = member.doc;
    }
  }
  return [...merged.values()];
}

/** The members of the first exported `*Props` type, or null when there is none. */
function propsMembers(source) {
  const decl = propsDeclaration(source);
  if (!decl) return null;
  if (decl.body !== undefined) return parsePropsMembers(decl.body);
  return mergeArms(resolveExpression(source, decl.expr, new Set([decl.name])));
}

/** The props the shipped component accepts, read from its exported props type. */
function propsTable(slug) {
  const path = join(root, "src", "namurui", `${slug}.tsx`);
  if (!existsSync(path)) return "_Takes no props._";
  const members = propsMembers(readFileSync(path, "utf8"));
  if (!members || !members.length) return "_Takes no props._";
  const table = ["| Name | Type | Description |", "| --- | --- | --- |"];
  for (const m of members) {
    table.push(`| ${m.name} | \`${m.type.replace(/\|/g, "\\|")}\` | ${m.doc} |`);
  }
  return table.join("\n");
}

const rows = [];
rows.push("# Catalogue", "");
rows.push(
  `All ${manifest.length} items. \`Tier\` is \`Free\` for the original MIT sources, \`Pro\` for the`,
  "reimplementations, and `Core` for first-party NamurUI components that have no upstream",
  "original.",
  "",
  "Every prop table is generated from that component's exported props type, so it lists exactly",
  "what the shipped component accepts.",
  "",
  "Items are grouped by what they do in a product. `Kind` is the shape (component, screen,",
  "block, illustration, motion), which is a separate axis and a separate filter in the gallery.",
  "",
);

for (const category of categories) {
  const list = manifest
    .filter((i) => i.category === category.id)
    .sort((a, b) => a.title.localeCompare(b.title, "en"));
  rows.push(`## ${category.id} (${list.length})`, "");
  rows.push(category.blurb, "");
  rows.push("| Item | Kind | Tier | What it is |");
  rows.push("| --- | --- | --- | --- |");
  for (const i of list) {
    rows.push(
      `| [${i.title}](#${i.slug}) | ${kindLabels[i.kind]} | ${i.tier} | ${i.description} |`,
    );
  }
  rows.push("");
}

rows.push("---", "", "## API reference", "");

for (const category of categories) {
  const list = manifest
    .filter((i) => i.category === category.id)
    .sort((a, b) => a.title.localeCompare(b.title, "en"));
  rows.push(`### ${category.id}`, "");
  for (const i of list) {
    rows.push(`#### ${i.title}`, "");
    rows.push(`<a id="${i.slug}"></a>`, "");
    rows.push(`\`${i.tier}\` · ${kindLabels[i.kind]}: ${i.description}`, "");
    rows.push(`\`\`\`tsx`, `import { … } from "@/components/${i.slug}";`, `\`\`\``, "");
    rows.push(propsTable(i.slug), "");
  }
}

const out = join(root, "docs");
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "catalogue.md"), rows.join("\n"), "utf8");
console.log("wrote docs/catalogue.md —", rows.length, "lines");
