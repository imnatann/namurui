import { useState } from "react";
import { AgentSandbox, type SandboxChange, type SandboxNode } from "../agent-sandbox";

/* The docs agent rewrote the pricing page, added a changelog, dropped the last stylesheet the old
   layout needed and tightened the release notes. Each draft below is id, change, size in bytes,
   what the agent did, and the excerpt the preview shows. */
type Draft = readonly [string, SandboxChange, number, string, string];

const asFile = ([id, change, size, note, excerpt]: Draft): SandboxNode => ({
  id,
  name: id.split("/").pop() ?? id,
  kind: "file",
  change,
  size,
  note: note || undefined,
  excerpt: excerpt || undefined,
});

const folder = (id: string, open: boolean, kids: readonly SandboxNode[]): SandboxNode => ({
  id,
  name: id.split("/").pop() ?? id,
  kind: "folder",
  open,
  children: kids,
});

/* What the agent left behind. */
const afterRun: readonly SandboxNode[] = [
  folder("src", true, [
    folder("src/pages", true, [
      asFile([
        "src/pages/pricing.tsx",
        "changed",
        5480,
        "Replaced the table with the grid, so it stops overflowing below 360px.",
        `const tiers = [tier("Starter", 9), tier("Team", 18)];\nexport const Pricing = () => <Grid tiers={tiers} />;`,
      ]),
      asFile([
        "src/pages/changelog.tsx",
        "created",
        2140,
        "New page, built from the release notes the agent had already read.",
        `export const Changelog = () => (\n  <List items={releases} label="Release history" />\n);`,
      ]),
    ]),
    folder("src/styles", false, [
      asFile([
        "src/styles/legacy.css",
        "deleted",
        8780,
        "Nothing imports it once the grid lands.",
        `.old-grid { display: flex; }\n.old-grid > * { flex: 1 1 240px; }`,
      ]),
    ]),
  ]),
  folder("content", true, [
    asFile([
      "content/release-notes.md",
      "changed",
      3260,
      "Dropped the known-issue note the grid just fixed.",
      `# Release notes\n\n2.3 ships the new pricing grid.\nThe table now reflows below 360px instead of overflowing.`,
    ]),
    asFile(["content/summary.json", "untouched", 760, "", ""]),
  ]),
  asFile(["package.json", "untouched", 1420, "", ""]),
];

/* The same workspace as it stood before the run, which is what Reset puts back. */
const beforeRun: readonly SandboxNode[] = [
  folder("src", true, [
    folder("src/pages", true, [
      asFile([
        "src/pages/pricing.tsx",
        "untouched",
        4120,
        "",
        `export const Pricing = () => <Table rows={plans} />;`,
      ]),
    ]),
    folder("src/styles", false, [
      asFile([
        "src/styles/legacy.css",
        "untouched",
        8780,
        "",
        `.old-grid { display: flex; }\n.old-grid > * { flex: 1 1 240px; }`,
      ]),
    ]),
  ]),
  folder("content", true, [
    asFile([
      "content/release-notes.md",
      "untouched",
      2980,
      "",
      `# Release notes\n\n2.2 adds the usage meter.\n\n## Known issues\nThe pricing table overflows below 360px.`,
    ]),
    asFile(["content/summary.json", "untouched", 760, "", ""]),
  ]),
  asFile(["package.json", "untouched", 1420, "", ""]),
];

export default function Demo() {
  const [run, setRun] = useState(1);
  const [note, setNote] = useState("Four files changed, one was removed. Reset puts them all back.");

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <AgentSandbox
        key={run}
        title="Docs workspace"
        nodes={afterRun}
        baseline={beforeRun}
        defaultSelectedId="src/pages/pricing.tsx"
        onOpen={(node) => setNote(`Opened ${node.name} from the tree.`)}
        onReset={() => setNote("Reset confirmed. The workspace is back to before the run.")}
      />
      <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
        <span
          role="status"
          aria-live="polite"
          style={{ fontSize: 12.5, lineHeight: "18px", color: "var(--text-muted, #a2958a)" }}
        >
          {note}
        </span>
        <button
          type="button"
          onClick={() => {
            setRun((value) => value + 1);
            setNote("The agent ran again on the restored workspace.");
          }}
          style={{
            height: 32,
            padding: "0 12px",
            border: 0,
            borderRadius: 9,
            background: "var(--muted-bg, #ffffff12)",
            color: "var(--text, #f4ece4)",
            font: "inherit",
            fontSize: 12.5,
            cursor: "pointer",
          }}
        >
          Run the agent again
        </button>
      </div>
    </div>
  );
}