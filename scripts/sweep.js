/**
 * Browser sweep for the gallery. Runs inside the page via the browser MCP:
 * walks every hash route, waits for the preview to settle, and records the
 * outcome. Returns a compact report so 119 items fit in one tool result.
 */
(async () => {
  const report = { ok: [], empty: [], threw: [], missing: [] };
  const list = await fetch("/src/gallery/manifest.json").then((r) => r.json());
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  for (const item of list) {
    location.hash = `/${item.slug}`;
    await wait(120);
    const page = document.querySelector(".g-preview");
    if (!page) {
      report.missing.push(item.slug);
      continue;
    }
    // Let mount effects, rAF and ResizeObserver settle.
    await wait(260);
    const text = page.textContent || "";
    if (/No demo registered|This demo threw|not found/.test(text)) {
      if (/This demo threw/.test(text)) report.threw.push(`${item.slug}: ${text.slice(0, 140)}`);
      else report.missing.push(item.slug);
      continue;
    }
    if (page.children.length === 0 || page.getBoundingClientRect().height < 24) {
      report.empty.push(item.slug);
      continue;
    }
    report.ok.push(item.slug);
  }

  location.hash = "/";
  return {
    total: list.length,
    ok: report.ok.length,
    empty: report.empty,
    threw: report.threw,
    missing: report.missing,
  };
})();
