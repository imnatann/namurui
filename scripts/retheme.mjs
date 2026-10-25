#!/usr/bin/env node
// retheme.mjs — rewrite the colour literals inside NamurUI component stylesheets
// so the library renders in the Ember palette instead of the original affectUI one.
//
// Scope: only the stylesheet template literal at the bottom of each component
// (declared as `const css = ...` followed by a backtick) is rewritten. Imports,
// JSX, props and the demo files are never touched.
//
//   node scripts/retheme.mjs [--dir <path>] [--only <list>] [--dry-run] [--report <path>]
//
// `--only <list>` restricts the run to the component slugs named one-per-line in
// <list> (blank lines and `#` comments ignored). Without it every `.tsx` in
// `--dir` is processed, as before. A slug with no matching file is reported as a
// warning and skipped; the run is not aborted.
//
// Zero dependencies: Node's fs/path only.

import fs from 'node:fs';
import path from 'node:path';

/* ------------------------------------------------------------------ palette */

// Warm neutral ramp, keyed by the *original* perceptual lightness (HSL L, 0..1).
const NEUTRAL_RAMP = [
  [0.00, '#0b0908'],
  [0.05, '#14100d'],
  [0.08, '#1a1512'],
  [0.11, '#201a15'],
  [0.14, '#26201a'],
  [0.17, '#2b231b'],
  [0.20, '#33291f'],
  [0.25, '#3d3226'],
  [0.32, '#4a3d2f'],
  [0.40, '#5a4a3b'],
  [0.50, '#75655a'],
  [0.60, '#8f7f70'],
  [0.70, '#a2958a'],
  [0.80, '#bcb0a5'],
  [0.88, '#d5cac0'],
  [0.92, '#e8e0d7'],
  [0.96, '#f4ece4'],
  [0.98, '#faf7f4'],
  [1.00, '#fffdfb'],
].map(([l, hex]) => ({ l, rgb: hexToRgb(hex) }));

// Original-L thresholds -> Ember hex; final entry is the fallback above the last threshold.
const FAMILIES = {
  accent: { hue: [[185, 245], [19, 30]], sat: 0.45, steps: [[0.30, '#a33f16'], [0.45, '#d9541f'], [0.62, '#ff6b35'], [0.78, '#ff8a5c']], last: '#ffb28f' },
  red: { hue: [[320, 360], [0, 18]], sat: 0.45, steps: [[0.35, '#8f1d16'], [0.55, '#b3261e'], [0.75, '#e2544a']], last: '#f0938c' },
  green: { hue: [80, 175], sat: 0.35, steps: [[0.35, '#1a7a4a'], [0.55, '#2f8d5c'], [0.75, '#4f9d6e']], last: '#8cc4a3' },
  amber: { hue: [30, 70], sat: 0.45, steps: [[0.35, '#9a6410'], [0.55, '#d99530'], [0.75, '#e8b05c']], last: '#f2d19a' },
  purple: { hue: [240, 330], sat: 0.35, steps: [[0.45, '#8a4b1f'], [0.65, '#c2703a']], last: '#ff8a5c' },
};
const FAMILY_ORDER = ['accent', 'red', 'green', 'amber', 'purple'];

// Third-party brand marks drawn from memory of real services: never rewritten.
const BRAND_HEX = [
  // Slack
  '#e01e5a', '#36c5f0', '#2eb67d', '#ecb22e', '#4a154b', '#611f69',
  // Google / Gmail
  '#ea4335', '#34a853', '#4285f4', '#fbbc04', '#db4437', '#0f9d58', '#f4b400',
  // Figma
  '#f24e1e', '#ff7262', '#a259ff', '#1abcfe', '#0acf83',
  // GitHub
  '#24292f', '#57606a',
  // Stripe
  '#635bff', '#0a2540',
  // OpenAI
  '#10a37f',
  // Anthropic
  '#d4a27f', '#cc785c',
  // Linear
  '#5e6ad2',
  // Discord
  '#5865f2',
  // Twilio
  '#f22f46',
  // Zoom
  '#2d8cff',
  // Dropbox
  '#0061ff',
  // Atlassian
  '#0052cc',
  // AWS
  '#ff9900',
  // Azure
  '#0078d4',
  // Microsoft
  '#00a4ef', '#7fba00', '#f25022', '#ffb900',
];
const BRAND_RGB = new Set(BRAND_HEX.map((h) => hexToRgb(h).join(',')));

// Literals drawn inside one of these rulesets are third-party marks: never rewritten.
const BRAND_SELECTOR_RE = /logo|brand|favicon|avatar|provider|gsuite|app-icon/i;

/* -------------------------------------------------------------------- colour */

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(rgb) {
  return '#' + rgb
    .map((v) => Math.round(v < 0 ? 0 : v > 255 ? 255 : v).toString(16).padStart(2, '0'))
    .join('');
}

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

// Linear RGB interpolation between the two surrounding ramp stops.
function sampleRamp(l) {
  const L = clamp01(l);
  const stops = NEUTRAL_RAMP;
  if (L <= stops[0].l) return stops[0].rgb.slice();
  for (let i = 1; i < stops.length; i++) {
    if (L <= stops[i].l) {
      const a = stops[i - 1];
      const b = stops[i];
      const t = (L - a.l) / (b.l - a.l);
      return [0, 1, 2].map((k) => a.rgb[k] + (b.rgb[k] - a.rgb[k]) * t);
    }
  }
  return stops[stops.length - 1].rgb.slice();
}

function pickStep(family, l) {
  for (const [max, hex] of family.steps) {
    if (l < max) return hexToRgb(hex);
  }
  return hexToRgb(family.last);
}

function inHue(h, range) {
  return Array.isArray(range[0])
    ? range.some((r) => h >= r[0] && h <= r[1])
    : h >= range[0] && h <= range[1];
}

// Classify an opaque RGB triple into a rewrite rule, or null when nothing matches.
//
// Saturation is measured as HSV saturation (chroma / max), not HSL saturation:
// the HSL denominator (1 - |2L-1|) collapses near black and near white, so a
// barely-visible tint there scores as highly saturated and escapes the neutral
// test. An absolute chroma floor catches those faint tints explicitly, and dark
// low-chroma grounds are forced neutral because Ember's darks are warm charcoal.
function classify(rgb) {
  const [h, , l] = rgbToHsl(rgb);
  const max = Math.max(rgb[0], rgb[1], rgb[2]);
  const min = Math.min(rgb[0], rgb[1], rgb[2]);
  const chroma = (max - min) / 255;
  const sv = max === 0 ? 0 : (max - min) / max;
  if (sv < 0.12 || chroma < 0.05 || (max < 90 && sv < 0.45)) {
    return { rule: 'neutral', rgb: sampleRamp(l) };
  }
  for (const name of FAMILY_ORDER) {
    const fam = FAMILIES[name];
    if (inHue(h, fam.hue) && (sv >= fam.sat || chroma >= 0.15)) return { rule: name, rgb: pickStep(fam, l) };
  }
  return null;
}

/* ------------------------------------------------------- template extraction */

const SHEET_MARKER = 'const css = /* css */ ';
const PROTECTED_FNS = new Set(['color-mix', 'oklch', 'lab', 'var', 'url']);
const COLOUR_FNS = new Set(['rgb', 'rgba', 'hsl', 'hsla']);

// Index just past the matching `}` of the `{` at `open`.
function skipBraces(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i + 1; }
  }
  return src.length;
}

// Index just past the matching `)` of the `(` at `open`.
function skipParen(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) return i; }
  }
  return src.length - 1;
}

// Extract the stylesheet body, honouring `${...}` interpolation inside the template.
function extractSheet(src) {
  const start = src.indexOf(SHEET_MARKER);
  if (start < 0) return null;
  const openTick = start + SHEET_MARKER.length;
  if (src[openTick] !== '`') return null;
  for (let i = openTick + 1; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') { i++; continue; }
    if (c === '$' && src[i + 1] === '{') { i = skipBraces(src, i + 1) - 1; continue; }
    if (c === '`') return { start: openTick + 1, end: i };
  }
  return null;
}

/* ------------------------------------------------------------- block parsing */

// Blank out `${...}` interpolation so brace/paren bookkeeping sees pure CSS.
function maskInterpolations(body) {
  const out = body.split('');
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '$' && body[i + 1] === '{') {
      const end = skipBraces(body, i + 1);
      for (let k = i; k < end; k++) out[k] = ' ';
      i = end - 1;
    }
  }
  return out.join('');
}

// Parse the masked body into a tree of rulesets, so a literal can be attributed
// to the selector chain that contains it.
function parseBlocks(masked) {
  const blocks = [];
  const stack = [];
  let buf = '';
  for (let i = 0; i < masked.length; i++) {
    const c = masked[i];
    if (c === '{') {
      const sel = buf.replace(/\s+/g, ' ').trim();
      blocks.push({ sel, start: i + 1, end: masked.length, parent: stack.length ? stack[stack.length - 1] : -1 });
      stack.push(blocks.length - 1);
      buf = '';
    } else if (c === '}') {
      const top = stack.pop();
      if (top !== undefined) blocks[top].end = i;
      buf = '';
    } else {
      buf += c;
    }
  }
  return blocks;
}

function selectorChain(blocks, pos) {
  let best = -1;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (pos >= b.start && pos < b.end && (best === -1 || b.start >= blocks[best].start)) best = i;
  }
  const parts = [];
  for (let i = best; i !== -1; i = blocks[i].parent) parts.push(blocks[i].sel);
  return parts.join(' ');
}

/* ------------------------------------------------------- literal tokenisation */

// Match a known function name at `i` (needs an identifier boundary in front).
function matchFn(src, i) {
  if (i > 0 && /[a-zA-Z0-9_-]/.test(src[i - 1])) return null;
  let j = i;
  while (j < src.length && /[a-zA-Z-]/.test(src[j])) j++;
  const name = src.slice(i, j).toLowerCase();
  if (src[j] !== '(') return null;
  if (!PROTECTED_FNS.has(name) && !COLOUR_FNS.has(name)) return null;
  return { name, open: j, close: skipParen(src, j) };
}

function parseChannel(token) {
  const m = /^(\d*\.?\d+)(%?)$/.exec(token);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return m[2] === '%' ? Math.round((v / 100) * 255) : Math.round(v);
}

// Parse the inside of an rgb()/rgba()/hsl()/hsla() invocation. The three colour
// channels must be plain numeric literals; the alpha token is kept verbatim
// (so a `var(...)`/`calc(...)` alpha survives untouched while the channels warm).
function parseColourFn(name, inner) {
  const spaced = /,\s/.test(inner);
  if (inner.includes(',')) {
    const parts = inner.split(',').map((s) => s.trim());
    if (parts.length < 3 || parts.length > 4) return null;
    if (parts.length === 4 && !parts[3]) return null;
    return { name, syntax: 'comma', spaced, args: parts.slice(0, 3), alpha: parts.length === 4 ? parts[3] : null };
  }
  const slash = inner.split('/').map((s) => s.trim());
  if (slash.length > 2) return null;
  const args = slash[0].split(/\s+/).filter(Boolean);
  if (args.length !== 3) return null;
  if (slash.length === 2 && !slash[1]) return null;
  return { name, syntax: 'space', spaced: false, args, alpha: slash.length === 2 ? slash[1] : null };
}

function fnToRgb(parsed) {
  if (parsed.name.startsWith('hsl')) {
    const hue = parseFloat(parsed.args[0]);
    const sat = parseFloat(parsed.args[1]) / 100;
    const lig = parseFloat(parsed.args[2]) / 100;
    if ([hue, sat, lig].some((v) => Number.isNaN(v))) return null;
    return hslToRgb(hue, sat, lig);
  }
  const rgb = parsed.args.map(parseChannel);
  return rgb.some((v) => v === null) ? null : rgb;
}

function renderFn(parsed, rgb) {
  if (parsed.name.startsWith('hsl')) {
    const [h, s, l] = rgbToHsl(rgb);
    const deg = /deg\s*$/.test(parsed.args[0]) ? 'deg' : '';
    const r2 = (n) => String(Math.round(n * 100) / 100);
    const hue = r2(h) + deg;
    const sat = r2(s * 100) + '%';
    const lig = r2(l * 100) + '%';
    return parsed.syntax === 'comma'
      ? `${parsed.name}(${hue}${parsed.spaced ? ', ' : ','}${sat}${parsed.spaced ? ', ' : ','}${lig}${parsed.alpha !== null ? (parsed.spaced ? ', ' : ',') + parsed.alpha : ''})`
      : `${parsed.name}(${hue} ${sat} ${lig}${parsed.alpha !== null ? ' / ' + parsed.alpha : ''})`;
  }
  const [r, g, b] = rgb.map((v) => Math.round(v));
  if (parsed.syntax === 'comma') {
    const sep = parsed.spaced ? ', ' : ',';
    return `${parsed.name}(${r}${sep}${g}${sep}${b}${parsed.alpha !== null ? sep + parsed.alpha : ''})`;
  }
  return `${parsed.name}(${r} ${g} ${b}${parsed.alpha !== null ? ' / ' + parsed.alpha : ''})`;
}

// A `#` at position i that is a well-formed hex colour, or null.
function matchHex(src, i) {
  const m = /^#([0-9a-fA-F]+)/.exec(src.slice(i, i + 9));
  if (!m) return null;
  const digits = m[1];
  if (![3, 4, 6, 8].includes(digits.length)) return null;
  const after = src[i + 1 + digits.length];
  if (after !== undefined && /[0-9a-zA-Z]/.test(after)) return null;
  return { raw: src.slice(i, i + 1 + digits.length), digits };
}

/* -------------------------------------------------------------- sheet rewrite */

function transformSheet(body) {
  const masked = maskInterpolations(body);
  const blocks = parseBlocks(masked);
  const edits = [];
  const map = new Map();
  const kept = new Map();
  const ruleCounts = {};
  const keepCounts = {};
  const totals = { seen: 0, rewritten: 0, kept: 0 };

  const noteKept = (from, notation, reason) => {
    totals.seen++;
    totals.kept++;
    keepCounts[reason] = (keepCounts[reason] || 0) + 1;
    const key = from + '\u0000' + notation + '\u0000' + reason;
    const e = kept.get(key);
    if (e) e.occurrences++;
    else kept.set(key, { from, notation, reason, occurrences: 1 });
  };

  const noteEdit = (from, to, notation, rule, start, end, replacement) => {
    totals.seen++;
    totals.rewritten++;
    ruleCounts[rule] = (ruleCounts[rule] || 0) + 1;
    edits.push({ start, end, replacement });
    const key = from + '\u0000' + notation + '\u0000' + rule + '\u0000' + to;
    const e = map.get(key);
    if (e) e.occurrences++;
    else map.set(key, { from, to, notation, rule, occurrences: 1 });
  };

  // Rewrite decision shared by every notation.
  const decide = (rgb, pos) => {
    if (BRAND_RGB.has(rgb.map((v) => Math.round(v)).join(','))) return { keep: 'brand' };
    if (BRAND_SELECTOR_RE.test(selectorChain(blocks, pos))) return { keep: 'brand-selector' };
    const hit = classify(rgb);
    return hit ? { rewrite: hit } : { keep: 'unmapped' };
  };

  let i = 0;
  while (i < body.length) {
    if (body[i] === '$' && body[i + 1] === '{') { i = skipBraces(body, i + 1); continue; }

    const fn = matchFn(body, i);
    if (fn) {
      if (!COLOUR_FNS.has(fn.name)) { i = fn.close + 1; continue; }
      const parsed = parseColourFn(fn.name, body.slice(fn.open + 1, fn.close));
      const rgb = parsed && fnToRgb(parsed);
      if (rgb) {
        const from = body.slice(i, fn.close + 1);
        const notation = parsed.name;
        const verdict = decide(rgb, i);
        if (verdict.rewrite) {
          const to = renderFn(parsed, verdict.rewrite.rgb);
          noteEdit(from, to, notation, verdict.rewrite.rule, i, fn.close + 1, to);
        } else {
          noteKept(from, notation, verdict.keep);
        }
      }
      i = fn.close + 1;
      continue;
    }

    if (body[i] === '#') {
      const hex = matchHex(body, i);
      if (hex) {
        const digits = hex.digits;
        const rgb = hexToRgb(digits.length <= 4 ? digits.slice(0, 3) : digits.slice(0, 6));
        const alpha = digits.length === 8 ? digits.slice(6) : digits.length === 4 ? digits[3].repeat(2) : null;
        const notation = 'hex' + digits.length;
        const verdict = decide(rgb, i);
        if (verdict.rewrite) {
          const to = rgbToHex(verdict.rewrite.rgb) + (alpha === null ? '' : alpha);
          noteEdit(hex.raw, to, notation, verdict.rewrite.rule, i, i + hex.raw.length, to);
        } else {
          noteKept(hex.raw, notation, verdict.keep);
        }
        i += hex.raw.length;
        continue;
      }
    }

    i++;
  }

  let text = body;
  for (let k = edits.length - 1; k >= 0; k--) {
    const e = edits[k];
    text = text.slice(0, e.start) + e.replacement + text.slice(e.end);
  }

  return {
    text,
    totals,
    ruleCounts,
    keepCounts,
    mapping: [...map.values()],
    kept: [...kept.values()],
  };
}

/* ------------------------------------------------------------------- driver */

function parseArgs(argv) {
  const out = { dir: 'src/namurui', only: null, dryRun: false, report: '.tmp/retheme-report.json' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--dir') out.dir = argv[++i];
    else if (a.startsWith('--dir=')) out.dir = a.slice('--dir='.length);
    else if (a === '--only') out.only = argv[++i];
    else if (a.startsWith('--only=')) out.only = a.slice('--only='.length);
    else if (a === '--report') out.report = argv[++i];
    else if (a.startsWith('--report=')) out.report = a.slice('--report='.length);
    else { console.error(`retheme: unknown argument "${a}"`); process.exit(2); }
  }
  return out;
}

// One component slug per line. Blank lines and `#` comments (whole-line or
// trailing) are ignored; each surviving entry has the whitespace trimmed and a
// trailing `.tsx` stripped so both `agent-diff` and `agent-diff.tsx` select the
// same file. Order is irrelevant: the directory listing drives the run order.
function readSlugList(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const slugs = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split('#')[0].trim();
    if (!line) continue;
    slugs.push(line.endsWith('.tsx') ? line.slice(0, -'.tsx'.length) : line);
  }
  return slugs;
}

function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const allFiles = fs.readdirSync(args.dir)
    .filter((f) => f.endsWith('.tsx'))
    .sort();

  // Optional scope: process only the slugs named in --only, in directory order.
  let files = allFiles;
  let onlyInfo = null;
  if (args.only !== null) {
    const bySlug = new Map(allFiles.map((f) => [f.slice(0, -'.tsx'.length), f]));
    const seen = new Set();
    const matched = [];
    const missing = [];
    for (const slug of readSlugList(args.only)) {
      if (seen.has(slug)) continue;
      seen.add(slug);
      (bySlug.has(slug) ? matched : missing).push(slug);
    }
    const pick = new Set(matched);
    files = allFiles.filter((f) => pick.has(f.slice(0, -'.tsx'.length)));
    onlyInfo = {
      list: args.only,
      slugs: seen.size,
      matched: matched.sort(cmp),
      missing: missing.sort(cmp),
      ignored: allFiles.length - files.length,
    };
  }

  const totals = { files: files.length, literalsSeen: 0, rewritten: 0, kept: 0 };
  const ruleCounts = {};
  const keepCounts = {};
  const map = new Map();
  const kept = new Map();
  const skipped = [];

  for (const file of files) {
    const full = path.join(args.dir, file);
    const src = fs.readFileSync(full, 'utf8');
    const sheet = extractSheet(src);
    if (!sheet) { skipped.push(file); continue; }

    const body = src.slice(sheet.start, sheet.end);
    const res = transformSheet(body);

    totals.literalsSeen += res.totals.seen;
    totals.rewritten += res.totals.rewritten;
    totals.kept += res.totals.kept;
    for (const [k, v] of Object.entries(res.ruleCounts)) ruleCounts[k] = (ruleCounts[k] || 0) + v;
    for (const [k, v] of Object.entries(res.keepCounts)) keepCounts[k] = (keepCounts[k] || 0) + v;
    for (const e of res.mapping) {
      const key = e.from + '\u0000' + e.notation + '\u0000' + e.rule + '\u0000' + e.to;
      const cur = map.get(key);
      if (cur) cur.occurrences += e.occurrences;
      else map.set(key, { ...e });
    }
    for (const e of res.kept) {
      const key = e.from + '\u0000' + e.notation + '\u0000' + e.reason;
      const cur = kept.get(key);
      if (cur) cur.occurrences += e.occurrences;
      else kept.set(key, { ...e });
    }

    if (!args.dryRun && res.text !== body) {
      fs.writeFileSync(full, src.slice(0, sheet.start) + res.text + src.slice(sheet.end), 'utf8');
    }
  }

  const mapping = [...map.values()].sort((a, b) => cmp(a.from, b.from) || cmp(a.notation, b.notation) || cmp(a.rule, b.rule) || cmp(a.to, b.to));
  const keptList = [...kept.values()].sort((a, b) => cmp(a.from, b.from) || cmp(a.notation, b.notation) || cmp(a.reason, b.reason));

  const report = { dir: args.dir, files, skipped, totals, rewriteRules: ruleCounts, keepReasons: keepCounts, mapping, kept: keptList };
  if (onlyInfo) report.only = onlyInfo;
  const reportPath = path.resolve(args.report);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

  const sum = Object.values(ruleCounts).reduce((a, b) => a + b, 0);
  console.log(`retheme: ${args.dryRun ? 'dry-run' : 'write'} over ${totals.files} files in ${args.dir}`);
  if (onlyInfo) {
    console.log(`  only          : ${onlyInfo.list} (${onlyInfo.slugs} slugs, ${onlyInfo.matched.length} with a file, ${onlyInfo.missing.length} with none, ${onlyInfo.ignored} dir files out of scope)`);
    if (onlyInfo.missing.length) console.log(`    warning     : no file for ${onlyInfo.missing.join(', ')}`);
  }
  console.log(`  literals seen : ${totals.literalsSeen}`);
  console.log(`  rewritten     : ${totals.rewritten}`);
  console.log(`  kept          : ${totals.kept}`);
  console.log('  rewrite rules :');
  for (const name of [...FAMILY_ORDER, 'neutral'].sort(cmp)) {
    if (ruleCounts[name]) console.log(`    ${name.padEnd(9)} ${ruleCounts[name]}`);
  }
  console.log('  keep reasons  :');
  for (const name of Object.keys(keepCounts).sort(cmp)) console.log(`    ${name.padEnd(15)} ${keepCounts[name]}`);
  console.log(`  rule sum      : ${sum} (must equal rewritten ${totals.rewritten})`);
  if (skipped.length) console.log(`  skipped files : ${skipped.join(', ')}`);
  console.log(`  report        : ${reportPath}`);
}

main();