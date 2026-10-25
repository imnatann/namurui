import { useMemo, useState } from "react";
import { highlight } from "./highlight";

type CodeViewProps = {
  source: string;
  /** The demo file that mounts it, shown on the second tab */
  demo?: string;
  demoSource?: string;
};

export function CodeView({ source, demo, demoSource }: CodeViewProps) {
  const [tab, setTab] = useState<"component" | "demo">("component");
  const [copied, setCopied] = useState(false);
  const active = tab === "demo" && demoSource ? demoSource : source;
  const html = useMemo(() => highlight(active), [active]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(active);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="g-section">
      <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button className="g-tab" type="button" aria-selected={tab === "component"} onClick={() => setTab("component")}>
          {demo ?? "Component"}
        </button>
        {demoSource && (
          <button className="g-tab" type="button" aria-selected={tab === "demo"} onClick={() => setTab("demo")}>
            Demo
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button className="g-btn" type="button" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </h2>
      <pre className="g-code">
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
}
