/**
 * Generates src/styles/high-contrast.css from a DOM contrast audit.
 *
 * The library ships the NamurUI Ember palette — warm paper surfaces in light, near-black
 * ember surfaces in dark — and its muted labels sit below WCAG AA by design. That is the
 * shipped look, so it stays the default. This produces an opt-in layer
 * (`[data-contrast="high"]`) that raises only the tokens a real audit measured as failing
 * text. Surfaces, lines and shadows are never touched.
 *
 * The adjustment direction follows the measured backdrop rather than a constant: a token
 * measured on a light surface is darkened, one measured on a dark surface is lightened, and
 * each moves only as far as it must to clear the target. A token measured against both a
 * light and a dark surface in one theme has no single value that satisfies both, so it is
 * left alone for that theme rather than given an arbitrary colour.
 *
 * Input: .tmp/contrast-dom.json, produced by the browser sweep in scripts/audit-contrast.mjs:
 *
 *   { "light": { slug: [{ fg, bg, ratio }] }, "dark": { slug: [{ fg, bg, ratio }] } }
 *
 * A flat `{ slug: [...] }` map is still accepted and treated as light-only.
 *
 * The sheet emits one light block per component, then the dark blocks. The light selectors are
 * not theme-scoped — `data-contrast="high"` lives on <html> — so the dark block is made
 * complete instead: every token the light block emits is emitted again in dark, either as the
 * measured dark fix or as the token's unmodified dark-mode value. The dark selector has the
 * same specificity as the light one and comes later, so it always decides, and a light fix can
 * never survive into dark. That holds for the page-wide opt-in, where the theme marker and
 * `data-contrast` share the root element, and for a component that opts in on its own root,
 * because the dark selectors take the component as a descendant.
 *
 *   node scripts/gen-high-contrast.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const auditPath = join(root, "..", ".tmp", "contrast-dom.json");

if (!existsSync(auditPath)) {
  console.error(`No audit at ${auditPath}. Run the browser sweep first.`);
  process.exit(1);
}

const raw = JSON.parse(readFileSync(auditPath, "utf8"));

// Two-theme shape `{ light, dark }`; a flat map is the old light-only shape.
const themed =
  raw !== null && typeof raw === "object" && raw.light !== undefined && !Array.isArray(raw.light);
const audit = themed
  ? { light: raw.light ?? {}, dark: raw.dark ?? {} }
  : { light: raw, dark: {} };

const isHex = (value) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

const luminance = (hex) => {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** 4.5:1 for body text; 3:1 when the audit marks the pair as large text. */
const targetFor = (pair) => (pair.large ? 3 : 4.5);

const toRgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.replace("#", "").slice(i, i + 2), 16));
const toHex = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;

/** Mix `from` toward `toward` by `k` (0..1), keeping the hue direction intact. */
const mix = (from, toward, k) => {
  const a = toRgb(from);
  const b = toRgb(toward);
  return toHex(a.map((v, i) => Math.round(v + (b[i] - v) * k)));
};

/**
 * Move `start` away from every measured backdrop until it clears the target.
 *
 * The direction comes from each backdrop's luminance: darken on a light ground, lighten on a
 * dark one. A token measured against both kinds in one theme has no single answer, so it is
 * declined. `forbidBlack` keeps pure black out of the dark block. Returns null when nothing
 * clears every pair without making a measured pair worse.
 */
function solveToken(pairs, start, { forbidBlack = false } = {}) {
  const directions = [...new Set(pairs.map((p) => (luminance(p.bg) > 0.5 ? "darken" : "lighten")))];
  if (directions.length > 1) return null;

  const candidates = [];
  for (const direction of directions) {
    const toward = direction === "darken" ? "#000000" : "#ffffff";
    const last = direction === "darken" && forbidBlack ? 99 : 100;
    for (let step = 1; step <= last; step += 1) {
      const value = mix(start, toward, step / 100);
      if (value === start) continue;
      if (forbidBlack && value === "#000000") continue;
      candidates.push({ value, step, direction });
    }
  }

  // Smallest change first; lighten wins the tie so mixed input stays deterministic.
  candidates.sort(
    (a, b) =>
      a.step - b.step ||
      (a.direction === b.direction ? 0 : a.direction === "lighten" ? -1 : 1),
  );

  for (const { value } of candidates) {
    const ok = pairs.every((pair) => {
      const ratio = contrast(value, pair.bg);
      return ratio >= targetFor(pair) && ratio >= contrast(pair.fg, pair.bg);
    });
    if (ok) return value;
  }
  return null;
}

/** Tokens whose names say they are surfaces, lines or marks are never text. */
const NOT_TEXT =
  /-(card|bg|panel|surface|paper|fill|line|edge|shadow|ring|border|stroke|track|bar|chip|tag|badge|dot|glow|wash|halo|pill|icon|avatar|mark)(-|$)/;

const DARK_SCOPE = /(?:\.dark\b|\[data-theme\s*=\s*["']?dark["']?\])/;
const RULE = /([^{}]+)\{([^{}]*)\}/g;
const DECLARATION = /(--ui-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g;

/** Whether the component paints something with this token (a text colour, not a surface). */
const usesAsText = (source, name) =>
  new RegExp(`(?:^|[^-a-z])color\\s*:\\s*var\\(\\s*${name}\\b`).test(source);

/**
 * Whether a rule targets the component root itself: the last compound of some comma branch is
 * `.ui-x`, optionally followed by an attribute or pseudo-class. `:where(.dark, …) .ui-x` counts;
 * `:where(.dark, …) .ui-x .ui-inner` does not, because its value never lands on the root.
 */
function targetsRoot(selector, rootClass) {
  const atRoot = new RegExp(`^\\.${rootClass}(?![a-z0-9-])`);
  return selector.split(",").some((branch) => {
    const last = branch.trim().split(/[\s>+~]+/).pop() ?? "";
    return atRoot.test(last);
  });
}

const componentCache = new Map();

function readComponent(slug) {
  if (componentCache.has(slug)) return componentCache.get(slug);
  componentCache.set(slug, null);

  const path = join(root, "src", "namurui", `${slug}.tsx`);
  if (!existsSync(path)) return null;
  const source = readFileSync(path, "utf8");
  const byClass = source.match(/className=\{\["(ui-[a-z0-9]+)"/);
  const byRule = source.match(/^\.(ui-[a-z0-9]+)\s*\{/m);
  const rootClass = byClass?.[1] ?? byRule?.[1];
  if (!rootClass) return null;

  // Split declarations by the rule they sit in: the dark scope overrides the light one.
  const light = new Map();
  const dark = new Map();
  // The values the root element itself resolves to, before any high-contrast layer.
  const base = new Map();
  const darkRoot = new Map();
  for (const [, selector, body] of source.matchAll(RULE)) {
    const isDark = DARK_SCOPE.test(selector);
    const scope = isDark ? dark : light;
    const onRoot = targetsRoot(selector, rootClass);
    for (const [, name, value] of body.matchAll(DECLARATION)) {
      const hex = value.toLowerCase();
      if (!scope.has(name)) scope.set(name, hex);
      if (!onRoot) continue;
      const own = isDark ? darkRoot : base;
      if (!own.has(name)) own.set(name, hex);
    }
  }
  const component = { rootClass, source, light, dark, base, darkRoot };
  componentCache.set(slug, component);
  return component;
}

/** Resolve every measured failure into per-token overrides for one theme. */
function buildTheme(failures, theme) {
  const components = new Map();
  let declined = 0;

  for (const [slug, pairs] of Object.entries(failures)) {
    if (!Array.isArray(pairs)) continue;
    const component = readComponent(slug);
    if (!component) continue;

    // A token's effective value in dark is its dark override, else its light value.
    const effective =
      theme === "dark"
        ? new Map([...component.light, ...component.dark])
        : component.light;

    const byValue = new Map();
    for (const [name, value] of effective) {
      if (!byValue.has(value)) byValue.set(value, new Set());
      byValue.get(value).add(name);
    }

    const groups = new Map();
    for (const pair of pairs) {
      if (!pair || !isHex(pair.fg) || !isHex(pair.bg)) continue;
      const fg = pair.fg.toLowerCase();
      const bg = pair.bg.toLowerCase();
      for (const name of byValue.get(fg) ?? []) {
        if (NOT_TEXT.test(name)) continue;
        if (!usesAsText(component.source, name)) continue;
        if (!groups.has(name)) groups.set(name, { start: fg, pairs: [] });
        groups.get(name).pairs.push({ fg, bg, large: Boolean(pair.large) });
      }
    }

    const tokens = new Map();
    for (const [name, group] of groups) {
      const value = solveToken(group.pairs, group.start, { forbidBlack: theme === "dark" });
      if (value) tokens.set(name, value);
      else declined += 1;
    }
    if (tokens.size) components.set(slug, { rootClass: component.rootClass, tokens });
  }

  return { components, declined };
}

const light = buildTheme(audit.light, "light");
const dark = buildTheme(audit.dark, "dark");

/**
 * The light selectors are not theme-scoped, so the dark block must decide every token the
 * light block emits: a measured dark fix where one exists, otherwise the token's own
 * unmodified dark-mode value. Reading the unmodified value from the component sheet — its
 * dark-scope root declaration, else its root-class base declaration — restores exactly what
 * the sheet resolves to without the high-contrast layer, which neutralises the light fix.
 */
function unmodifiedDarkValue(slug, name) {
  const component = readComponent(slug);
  if (!component) return null;
  const value =
    component.darkRoot.get(name) ??
    component.base.get(name) ??
    component.dark.get(name) ??
    component.light.get(name);
  if (!value) return null;
  // The dark block never carries pure black; one step off it is indistinguishable.
  return value === "#000000" ? "#010101" : value;
}

const darkComponents = new Map();
for (const [slug, { rootClass, tokens }] of dark.components) {
  darkComponents.set(slug, { rootClass, tokens: new Map(tokens) });
}

const neutralised = [];
const uncovered = [];
for (const [slug, { rootClass, tokens }] of light.components) {
  const entry = darkComponents.get(slug) ?? { rootClass, tokens: new Map() };
  for (const name of tokens.keys()) {
    if (entry.tokens.has(name)) continue;
    const value = unmodifiedDarkValue(slug, name);
    if (!value) {
      uncovered.push(`${slug} ${name}`);
      continue;
    }
    entry.tokens.set(name, value);
    neutralised.push({ slug, name, value });
  }
  darkComponents.set(slug, entry);
}

if (uncovered.length) {
  throw new Error(
    `dark block would leave ${uncovered.length} light token(s) uncovered: ${uncovered.join(", ")}`,
  );
}

for (const [slug, { tokens }] of darkComponents) {
  for (const [name, value] of tokens) {
    if (value === "#000000") {
      throw new Error(`dark block would emit pure black for ${slug} ${name}`);
    }
  }
}

const sum = (components) => [...components.values()].reduce((n, c) => n + c.tokens.size, 0);
const lightTokenCount = sum(light.components);
const darkFixCount = sum(dark.components);
const darkTokenCount = sum(darkComponents);
const coveredByDark = [...light.components].reduce(
  (n, [slug, { tokens }]) =>
    n + [...tokens.keys()].filter((name) => darkComponents.get(slug)?.tokens.has(name)).length,
  0,
);

const byName = ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0);

const CONTRAST = '[data-contrast="high"]';
const DARK = ':where(.dark, [data-theme="dark"])';

/**
 * `data-contrast` and the theme marker normally sit on the *same* element (<html>), so the
 * dark page-wide branch must put them in one compound: `:where(…) [data-contrast]` with a
 * space would demand an extra element level that does not exist, and the whole dark block
 * would silently never match. `:where()` contributes no specificity, so the dark rule stays
 * at (0,2,0) — the same as the light rule — and wins by coming later.
 */
const selectors = {
  light: (cls) => `${CONTRAST} .${cls},\n.${cls}${CONTRAST}`,
  dark: (cls) => `${DARK}${CONTRAST} .${cls},\n${DARK} .${cls}${CONTRAST}`,
};

/** A mis-shaped selector disables the block silently, so every emitted one is checked. */
function assertSelector(selector, cls, theme) {
  const [first, second] = selector.split(",\n");
  const expectedFirst = theme === "dark" ? `${DARK}${CONTRAST} .${cls}` : `${CONTRAST} .${cls}`;
  const expectedSecond =
    theme === "dark" ? `${DARK} .${cls}${CONTRAST}` : `.${cls}${CONTRAST}`;
  if (/\s\[data-contrast/.test(first ?? "")) {
    throw new Error(
      `${theme} selector for .${cls} has a space between the theme marker and the contrast ` +
        `carrier: "${first}". Both live on the same element, so that branch cannot match.`,
    );
  }
  if (first !== expectedFirst || second !== expectedSecond) {
    throw new Error(
      `${theme} selector for .${cls} is "${selector}", expected "${expectedFirst},\n${expectedSecond}"`,
    );
  }
}

function emitBlock(lines, theme, rootClass, tokens) {
  const selector = selectors[theme](rootClass);
  assertSelector(selector, rootClass, theme);
  lines.push(`${selector} {`);
  for (const [name, value] of [...tokens].sort(byName)) lines.push(`  ${name}: ${value};`);
  lines.push("}", "");
}

const lines = [
  "/* ---------------------------------------------------------------------------",
  " * High contrast — an opt-in layer, generated from a real DOM audit.",
  " *",
  " * The library ships the NamurUI Ember palette, whose muted labels sit below WCAG AA",
  " * by design; that stays the default. This sheet raises only the tokens a DOM audit",
  " * measured as failing text, moving each away from its measured backdrop — darker on a",
  " * light surface, lighter on a dark one — just far enough to clear the target (4.5:1, or",
  " * 3:1 for large text when the audit says so). Surfaces, lines and shadows are never",
  " * touched.",
  " *",
  ' *   <html data-contrast="high">        every component on the page',
  ' *   <div class="ui-tc" data-contrast>   one component only',
  " *",
  " * Light fixes come first. The theme-scoped dark blocks come last and cover every token the",
  " * light blocks emit — the measured dark fix, or the token's unmodified dark value — so they",
  " * win over both the light rule and the sheet's own dark override at equal specificity, and no",
  " * light fix can survive into a dark document. The page-wide dark branch puts the theme marker",
  ' * and [data-contrast] in one compound, because both sit on <html>; a space between them would',
  " * demand an extra element level and disable the block.",
  " *",
  " * Generated by scripts/gen-high-contrast.mjs — do not edit by hand.",
  " * ------------------------------------------------------------------------- */",
  "",
];

for (const slug of [...light.components.keys()].sort()) {
  const { rootClass, tokens } = light.components.get(slug);
  emitBlock(lines, "light", rootClass, tokens);
}

lines.push(
  "/* Dark — after the light blocks, so the later rule wins at equal specificity. Every token the",
  " * light blocks emit is repeated here: a measured dark fix, or the unmodified dark value. */",
  "",
);

for (const slug of [...darkComponents.keys()].sort()) {
  const { rootClass, tokens } = darkComponents.get(slug);
  emitBlock(lines, "dark", rootClass, tokens);
}

writeFileSync(join(root, "src", "styles", "high-contrast.css"), lines.join("\n"), "utf8");

console.log(
  `wrote src/styles/high-contrast.css — ` +
    `light ${light.components.size} components / ${lightTokenCount} tokens, ` +
    `dark ${darkComponents.size} components / ${darkTokenCount} tokens ` +
    `(${darkFixCount} measured fixes, ${darkTokenCount - darkFixCount} unmodified), ` +
    `light tokens covered by dark ${coveredByDark}/${lightTokenCount}, ` +
    `declined ${light.declined + dark.declined} (light ${light.declined}, dark ${dark.declined})`,
);
