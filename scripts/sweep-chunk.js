/**
 * Browser sweep for the gallery, chunked so a 157-route pass fits inside a
 * 30 s page-evaluation budget. Runs inside the page via CDP.
 *
 * Call `window.__sweepChunk(slugs)` from the host: it walks the given slugs,
 * waits for the preview to settle, records the outcome, and returns a compact
 * report. The host concatenates the chunks.
 */
window.__sweepChunk = async function sweepChunk(slugs) {
  const report = { ok: [], empty: [], threw: [], missing: [], overflow: [] };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  for (const slug of slugs) {
    location.hash = `/${slug}`;
    await wait(110);
    const page = document.querySelector(".g-preview");
    if (!page) {
      report.missing.push(slug);
      continue;
    }
    // Let mount effects, rAF and ResizeObserver settle.
    await wait(340);
    const text = page.textContent || "";
    if (/This demo threw|No demo registered|not found/.test(text)) {
      if (/This demo threw/.test(text)) report.threw.push(`${slug}: ${text.slice(0, 160)}`);
      else report.missing.push(slug);
      continue;
    }
    if (page.children.length === 0 || page.getBoundingClientRect().height < 24) {
      report.empty.push(slug);
      continue;
    }
    // A component that pushes past the preview's own scroll box is a layout defect
    // unless it declares horizontal scrolling itself.
    if (page.scrollWidth > page.clientWidth + 2) report.overflow.push(`${slug}: ${page.scrollWidth}>${page.clientWidth}`);
    report.ok.push(slug);
  }

  return report;
};
"__sweepChunk installed__";
