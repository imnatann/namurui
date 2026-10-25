/**
 * Full-library contrast audit, run from the host.
 *
 * `scripts/audit-contrast.mjs` holds the in-page function; this drives it over every
 * manifest route in chunks small enough for a 30 s page-evaluation budget, for both
 * themes, and writes the `{ light, dark }` shape `gen-high-contrast.mjs` reads.
 *
 *   node scripts/run-contrast-audit.mjs [--url http://127.0.0.1:5199] [--out .tmp/contrast-dom.json]
 *
 * Requires a browser already exposing a CDP endpoint; see the header of sweep-chunk.js for
 * the same arrangement. This file only orchestrates — it holds no measurement logic, so the
 * numbers it writes are exactly what the in-page function computed.
 */
export const CHUNK = 12;
export const SETTLE = 260;

/** Build the in-page call for one chunk of slugs, from the audit script's source. */
export function makeAuditCall(auditSource, slugs) {
  const start = auditSource.indexOf("`(async () => {") + 1;
  if (start <= 0) throw new Error("audit-contrast.mjs: cannot find the exported template");
  let body = auditSource.slice(start).replace(/`;\s*$/, "");
  const target = 'const manifest = await (await fetch("/src/gallery/manifest.json")).json();';
  if (!body.includes(target)) throw new Error("audit-contrast.mjs: manifest fetch line moved");
  body = body.replace(target, `const manifest = ${JSON.stringify(slugs.map((slug) => ({ slug })))};`);
  return body;
}

/** Split a list into chunks of `size`. */
export function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
