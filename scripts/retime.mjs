#!/usr/bin/env node
// retime.mjs — repoint the reconstructed stylesheets' timing declarations at the
// NamurUI motion tokens defined in src/styles/motion.css.
//
// Every emitted var() carries a literal fallback. Each component injects its own
// <style>, so a host page that never loads motion.css must still get a valid
// declaration; a fallback-less var() would void the whole shorthand.
//
// CLI: node scripts/retime.mjs [--dir <path>] [--dry-run] [--no-snap] [--report <path>]

import fs from "node:fs";
import path from "node:path";

const SHEET_MARK = "const css = /* css */ `";

const CURVE = {
  out: "cubic-bezier(0.22, 1, 0.36, 1)",
  both: "cubic-bezier(0.65, 0, 0.35, 1)",
  soft: "cubic-bezier(0.4, 0, 0.2, 1)",
};

const DUR_STEPS = [
  { ms: 90, step: "1" },
  { ms: 160, step: "2" },
  { ms: 240, step: "3" },
  { ms: 380, step: "4" },
  { ms: 620, step: "5" },
  { ms: 1100, step: "6" },
];

// Snap bands: the upper edge of the range that resolves to each token.
const DUR_BANDS = [
  { limit: 120, step: "1", ms: 90 },
  { limit: 200, step: "2", ms: 160 },
  { limit: 300, step: "3", ms: 240 },
  { limit: 480, step: "4", ms: 380 },
  { limit: 800, step: "5", ms: 620 },
  { limit: Infinity, step: "6", ms: 1100 },
];

const AMBIENT_WORDS = new Set([
  "breathe", "pulse", "shimmer", "spin", "glow", "ping", "flow", "blink",
  "calm", "drift", "float", "wave", "march", "orbit", "sweep",
]);

// Beyond this a "duration" is a sentinel, not a timing — the 9999s autofill
// background-flash suppressors. Snapping one to the scale would restore the
// flash it exists to hide.
const SENTINEL_MS = 60000;

const MOTION_PROPS = [
  "transition-duration", "transition-timing-function", "transition",
  "animation-duration", "animation-timing-function", "animation",
];
const CONTEXT_PROPS = ["animation-iteration-count", "animation-name"];
const DURATION_PROPS = new Set([
  "transition", "animation", "transition-duration", "animation-duration",
]);
const SHORTHAND_PROPS = new Set(["transition", "animation"]);

// Anything an animation shorthand may contain other than the keyframes name.
const ANIMATION_KEYWORDS = new Set([
  "none", "linear", "ease", "ease-in", "ease-out", "ease-in-out", "step-start",
  "step-end", "infinite", "normal", "reverse", "alternate", "alternate-reverse",
  "forwards", "backwards", "both", "running", "paused", "initial", "inherit",
  "unset", "revert", "auto", "var", "cubic-bezier", "steps", "frames", "cubic",
]);

const PROP_RE = new RegExp(
  "(?<![\\w-])(" +
    [...MOTION_PROPS, ...CONTEXT_PROPS].sort((a, b) => b.length - a.length).join("|") +
    ")\\s*:",
  "g"
);
const TIME_RE = /(?<![\w.\-])(\d*\.?\d+)(ms|s)(?![\w\-])/g;
const KEYWORD_RE = /(?<![\w-])(ease-in-out|ease-out|ease)(?![\w-])/g;
const NAME_RE = /(?<![-\w])([A-Za-z][\w-]*)/g;
const MEDIA_RE = /@media[^{]*prefers-reduced-motion[^{]*\{/g;

/* ------------------------------------------------------------------ sheet */

function extractSheet(source) {
  const at = source.indexOf(SHEET_MARK);
  if (at < 0) return null;
  const start = at + SHEET_MARK.length;
  const end = source.indexOf("`", start);
  if (end < 0) throw new Error("unterminated css template literal");
  return { start, end, css: source.slice(start, end) };
}

function matchBrace(css, openIdx, guard) {
  let depth = 1;
  for (let k = openIdx + 1; k < css.length; k++) {
    if (guard[k]) continue;
    const ch = css[k];
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return k;
  }
  throw new Error("unbalanced braces in stylesheet");
}

// Two protected layers. `js` covers JavaScript template expressions, which are
// never CSS text. `rm` covers prefers-reduced-motion blocks: rule 3 forbids
// touching any duration there, but its curves are still fair game.
function markGuard(css) {
  const js = new Uint8Array(css.length);
  for (let i = 0; i + 1 < css.length; i++) {
    if (js[i] || css[i] !== "$" || css[i + 1] !== "{") continue;
    const close = matchBrace(css, i + 1, js);
    js.fill(1, i, close + 1);
  }
  const rm = new Uint8Array(css.length);
  MEDIA_RE.lastIndex = 0;
  let m;
  while ((m = MEDIA_RE.exec(css))) {
    if (js[m.index]) continue;
    const close = matchBrace(css, m.index + m[0].length - 1, js);
    rm.fill(1, m.index, close + 1);
  }
  return { js, rm };
}

/* ----------------------------------------------------------- declarations */

function findDeclarations(css, guard) {
  const out = [];
  PROP_RE.lastIndex = 0;
  let m;
  while ((m = PROP_RE.exec(css))) {
    if (guard[m.index]) continue;
    const valueStart = m.index + m[0].length;
    let depth = 0;
    let k = valueStart;
    for (; k < css.length; k++) {
      if (guard[k]) continue;
      const ch = css[k];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if ((ch === ";" || ch === "}") && depth <= 0) break;
    }
    out.push({ prop: m[1], start: m.index, valueStart, valueEnd: k });
  }
  return out;
}

function splitSegments(css, guard, from, to) {
  const segs = [];
  let depth = 0;
  let last = from;
  for (let k = from; k < to; k++) {
    if (guard[k]) continue;
    const ch = css[k];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      segs.push([last, k]);
      last = k + 1;
    }
  }
  segs.push([last, to]);
  return segs;
}

function collect(css, guard, re, from, to) {
  const hits = [];
  const text = css.slice(from, to);
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(text))) {
    if (guard[from + m.index]) continue;
    hits.push({ text: m[0], group: m[1], start: from + m.index, end: from + m.index + m[0].length });
  }
  return hits;
}

// Time tokens with their parenthesis depth. A time inside a function is a
// fallback or a function argument (var(--nm-dur-3, 240ms), steps(4)), never the
// declaration's own duration.
function timesIn(css, guard, from, to) {
  const out = [];
  const text = css.slice(from, to);
  let depth = 0;
  let cursor = 0;
  TIME_RE.lastIndex = 0;
  let m;
  while ((m = TIME_RE.exec(text))) {
    for (let k = cursor; k < m.index; k++) {
      if (guard[from + k]) continue;
      if (text[k] === "(") depth++;
      else if (text[k] === ")") depth--;
    }
    cursor = m.index;
    if (guard[from + m.index]) continue;
    out.push({ text: m[0], depth, start: from + m.index, end: from + m.index + m[0].length });
  }
  return out;
}

function enclosingBlock(css, guard, pos) {
  let open = -1;
  for (let k = pos - 1; k >= 0; k--) {
    if (guard[k]) continue;
    if (css[k] === "{") { open = k; break; }
  }
  if (open < 0) return null;
  return css.slice(open + 1, matchBrace(css, open, guard));
}

/* ---------------------------------------------------------------- motion */

function isAmbientName(name) {
  return name.split("-").some((part) => AMBIENT_WORDS.has(part));
}

function iterationCountInfinite(text) {
  return /(?<![-\w])animation-iteration-count\s*:\s*infinite(?![\w-])/.test(text);
}

function ambientNameIn(text) {
  const m = /(?<![-\w])animation-name\s*:\s*([A-Za-z][\w-]*)/.exec(text);
  return m ? m[1] : null;
}

// The keyframes name inside an animation value: the first identifier that is
// not a shorthand keyword, a function name, or a numeric token.
function animationNameOf(value) {
  NAME_RE.lastIndex = 0;
  let m;
  while ((m = NAME_RE.exec(value))) {
    if (!ANIMATION_KEYWORDS.has(m[1])) return m[1];
  }
  return null;
}

function isAmbient(css, guard, decl, value) {
  if (/(?<![-\w])infinite(?![\w-])/.test(value)) return true;
  const own = animationNameOf(value);
  if (own && isAmbientName(own)) return true;
  const block = enclosingBlock(css, guard, decl.start);
  if (block && (iterationCountInfinite(block) || isAmbientName(ambientNameIn(block) || ""))) {
    return true;
  }
  return false;
}

// Nearest token, expressed as the spec's bands. Above the last band the value
// is beyond the scale and lands on the ambience step.
function snapDuration(ms) {
  if (ms <= 1) return null;
  for (const { ms: token } of DUR_STEPS) if (ms === token) return null;
  for (const { limit, step, ms: token } of DUR_BANDS) {
    if (ms <= limit) return { step, token };
  }
}

function retimeSheet(css, guards, snap, stats) {
  const { js, rm } = guards;
  const edits = [];
  for (const decl of findDeclarations(css, js)) {
    if (CONTEXT_PROPS.includes(decl.prop)) {
      bump(stats.rules, "context." + decl.prop);
      continue;
    }
    stats.declarationsSeen++;
    const value = css.slice(decl.valueStart, decl.valueEnd);
    const isAnimation = decl.prop.startsWith("animation");
    const ambient = isAnimation && isAmbient(css, js, decl, value);
    const snapDurations = snap && DURATION_PROPS.has(decl.prop);
    const shorthand = SHORTHAND_PROPS.has(decl.prop);
    const local = [];

    for (const [from, to] of splitSegments(css, js, decl.valueStart, decl.valueEnd)) {
      for (const hit of collect(css, js, KEYWORD_RE, from, to)) {
        let after = null;
        let rule = null;
        if (hit.group === "ease-out") {
          rule = "ease-out.left";
        } else if (hit.group === "ease") {
          const soft = isAnimation && ambient;
          after = `var(--nm-ease-${soft ? "soft" : "out"}, ${soft ? CURVE.soft : CURVE.out})`;
          rule = isAnimation
            ? `animation.ease.${ambient ? "ambient" : "oneShot"}`
            : "transition.ease";
        } else if (isAnimation && ambient) {
          rule = "animation.ease-in-out.ambientLeft";
        } else {
          after = `var(--nm-ease-both, ${CURVE.both})`;
          rule = isAnimation
            ? "animation.ease-in-out.oneShot"
            : "transition.ease-in-out";
        }
        if (!after) {
          bump(stats.rules, rule);
          continue;
        }
        local.push({ start: hit.start, end: hit.end, before: hit.group, after });
        bump(stats.rules, rule);
      }

      if (!snapDurations) continue;
      let topLevelTimes = 0;
      for (const hit of timesIn(css, js, from, to)) {
        if (hit.depth > 0) {
          bump(stats.rules, "duration.inFunctionLeft");
          continue;
        }
        // In a shorthand the second top-level time value is the delay.
        const isDelay = shorthand && topLevelTimes > 0;
        topLevelTimes++;
        if (isDelay) {
          bump(stats.rules, "delay.left");
          continue;
        }
        if (rm[hit.start]) {
          bump(stats.rules, "duration.reducedMotionLeft");
          continue;
        }
        const unit = hit.text.endsWith("ms") ? "ms" : "s";
        const ms = parseFloat(hit.text) * (unit === "ms" ? 1 : 1000);
        if (ms > SENTINEL_MS) {
          bump(stats.rules, "duration.sentinelLeft");
          continue;
        }
        const snapped = snapDuration(ms);
        if (!snapped) {
          bump(stats.rules, ms <= 1 ? "duration.instantLeft" : "duration.tokenLeft");
          continue;
        }
        const after = `var(--nm-dur-${snapped.step}, ${snapped.token}ms)`;
        local.push({ start: hit.start, end: hit.end, before: hit.text, after });
        bump(stats.rules, "duration.snap");
      }
    }

    if (local.length) {
      stats.declarationsRewritten++;
      for (const e of local) {
        edits.push(e);
        bump(stats.pairs, `${e.before} -> ${e.after}`);
      }
    }
  }

  edits.sort((a, b) => a.start - b.start);
  for (let i = 1; i < edits.length; i++) {
    if (edits[i].start < edits[i - 1].end) throw new Error("overlapping edits");
  }
  for (const e of edits) {
    if (e.after.includes("`") || e.after.includes("${")) {
      throw new Error("replacement would break the template literal");
    }
  }
  return edits;
}

function applyEdits(css, edits) {
  let out = css;
  for (let i = edits.length - 1; i >= 0; i--) {
    const e = edits[i];
    out = out.slice(0, e.start) + e.after + out.slice(e.end);
  }
  return out;
}

function bump(obj, key) {
  obj[key] = (obj[key] || 0) + 1;
}

function sorted(obj) {
  return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));
}

/* -------------------------------------------------------------- fallbacks */

// A var() without a fallback voids the whole declaration; treat it as a defect.
function varWithoutFallback(text) {
  return (text.match(/var\(\s*--nm-[a-z0-9-]+\s*\)/g) || []).length;
}

function countBackticks(text) {
  return (text.match(/`/g) || []).length;
}

function countTemplateExprs(text) {
  return (text.match(/\$\{/g) || []).length;
}

/* ------------------------------------------------------------------- main */

function parseArgs(argv) {
  const opts = { dir: "src/namurui", dryRun: false, snap: true, report: ".tmp/retime-report.json" };
  const valued = new Set(["--dir", "--report"]);
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split("=");
    const value = inline !== undefined ? inline : valued.has(flag) ? argv[++i] : undefined;
    if (flag === "--dir") opts.dir = value;
    else if (flag === "--report") opts.report = value;
    else if (flag === "--dry-run") opts.dryRun = true;
    else if (flag === "--no-snap") opts.snap = false;
    else if (flag === "--help" || flag === "-h") opts.help = true;
    else throw new Error("unknown argument: " + argv[i]);
  }
  return opts;
}

const USAGE = `Usage: node scripts/retime.mjs [--dir <path>] [--dry-run] [--no-snap] [--report <path>]

  --dir default src/namurui ; --report default .tmp/retime-report.json`;

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(USAGE);
    return;
  }

  const dir = path.resolve(opts.dir);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".tsx")).sort();

  const stats = {
    declarationsSeen: 0,
    declarationsRewritten: 0,
    rules: {},
    pairs: {},
  };
  const skipped = [];
  const changedFiles = [];
  const emitted = [];
  let sheets = 0;
  let outputVars = 0;

  for (const file of files) {
    const source = fs.readFileSync(path.join(dir, file), "utf8");
    const sheet = extractSheet(source);
    if (!sheet) {
      skipped.push(file);
      continue;
    }
    sheets++;
    const guards = markGuard(sheet.css);
    const edits = retimeSheet(sheet.css, guards, opts.snap, stats);
    if (!edits.length) continue;

    const next = source.slice(0, sheet.start) + applyEdits(sheet.css, edits) + source.slice(sheet.end);
    // The sheet is a template literal: a stray backtick or ${ would end it.
    if (countBackticks(next) !== countBackticks(source) || countTemplateExprs(next) !== countTemplateExprs(source)) {
      throw new Error(`${file}: rewrite would break the css template literal`);
    }

    emitted.push(...edits.map((e) => e.after));
    outputVars += varWithoutFallback(next);
    changedFiles.push(file);
    if (!opts.dryRun && next !== source) fs.writeFileSync(path.join(dir, file), next);
  }

  const bareVars = emitted.reduce((n, text) => n + varWithoutFallback(text), 0);
  if (bareVars !== 0) throw new Error(`${bareVars} var(--nm-…) substitutions lack a fallback`);
  if (outputVars !== 0) throw new Error(`${outputVars} var(--nm-…) references in the output lack a fallback`);

  const report = {
    tool: "scripts/retime.mjs",
    options: { dir: opts.dir, dryRun: opts.dryRun, snap: opts.snap, report: opts.report },
    files: { scanned: files.length, sheets, changed: changedFiles.length, skipped },
    declarations: {
      seen: stats.declarationsSeen,
      rewritten: stats.declarationsRewritten,
    },
    rules: sorted(stats.rules),
    pairs: sorted(stats.pairs),
    limits: {
      tokenScaleMs: DUR_STEPS.map((s) => s.ms),
      bandLimitsMs: DUR_BANDS.map((b) => b.limit).filter(Number.isFinite),
      sentinelMs: SENTINEL_MS,
    },
    checks: { varWithoutFallback: bareVars, varWithoutFallbackInOutput: outputVars },
  };

  fs.mkdirSync(path.dirname(path.resolve(opts.report)), { recursive: true });
  fs.writeFileSync(path.resolve(opts.report), JSON.stringify(report, null, 2) + "\n");

  const mode = opts.dryRun ? "dry-run" : "write";
  console.log(`retime (${mode}) — dir ${opts.dir}, snap ${opts.snap ? "on" : "off"}`);
  console.log(`  files       : ${report.files.scanned} scanned, ${report.files.changed} rewritten, ${skipped.length} without a sheet`);
  console.log(`  declarations: ${report.declarations.seen} seen, ${report.declarations.rewritten} rewritten`);
  console.log("  rules:");
  for (const [key, count] of Object.entries(report.rules)) {
    console.log(`    ${key.padEnd(32)} ${count}`);
  }
  console.log(`  edges       : ${Object.keys(report.pairs).length} distinct (before -> after) pairs`);
  console.log(`  check       : var(--nm-…) without fallback: ${bareVars}`);
  console.log(`  check       : rewritten output without fallback: ${outputVars}`);
  console.log(`  report      : ${opts.report}`);
}

try {
  main();
} catch (err) {
  console.error(`retime: ${err.message}`);
  process.exit(1);
}