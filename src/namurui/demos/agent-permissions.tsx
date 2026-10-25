import { useState, type CSSProperties } from "react";
import {
  AgentPermissions,
  summarizePermissions,
  type PermissionDecision,
  type PermissionScope,
  type PermissionTool,
} from "../agent-permissions";

/* What the release agent asked for on its first run. The two that touch money or the live site
   arrive set to ask rather than allow, and deploy.production is already closed by the workspace
   policy, so the person cannot move it. */
const requested: PermissionTool[] = [
  { id: "db", name: "postgres.query", risk: "medium", reason: "Reads order rows to answer the billing question in the thread.", access: "read only · orders, refunds · 90 days" },
  { id: "pr", name: "github.pull_requests", risk: "medium", reason: "Opens the pricing fix as a pull request against main.", access: "namurco/checkout · write" },
  { id: "shell", name: "bash", risk: "high", reason: "Runs the migration and the test suite inside the checkout workspace.", access: "sandboxed workspace · no network" },
  { id: "refund", name: "stripe.refunds", risk: "high", reason: "Refunds the duplicate charge once the customer confirms it.", access: "live keys · refund scope" },
  { id: "notes", name: "filesystem.write", risk: "low", reason: "Writes the changelog and the release notes into the repo.", access: "/workspace/release" },
  { id: "mail", name: "email.send", risk: "medium", reason: "Replies to the customer thread with the refund confirmation.", access: "support@namurco.com · reply only" },
  { id: "fetch", name: "web.fetch", risk: "low", reason: "Reads the public pricing page that the answer cites.", access: "https · public hosts" },
  { id: "deploy", name: "deploy.production", risk: "high", reason: "Pushes the fix to production once CI is green.", access: "namurco.com · main branch", locked: true },
];

const opening: Record<string, PermissionDecision> = {
  db: "allow",
  pr: "allow",
  notes: "allow",
  fetch: "allow",
  shell: "ask",
  refund: "ask",
  mail: "ask",
};

const ghost: CSSProperties = {
  height: 28,
  padding: "0 12px",
  border: "1px solid var(--border, #33291f)",
  borderRadius: 999,
  background: "transparent",
  color: "var(--text, #f4ece4)",
  font: "inherit",
  cursor: "pointer",
};

export default function Demo() {
  const [tools, setTools] = useState<PermissionTool[]>(requested);
  const [rulings, setRulings] = useState<Record<string, PermissionDecision>>(() => ({ ...opening }));
  const [scope, setScope] = useState<PermissionScope>("session");
  const [sent, setSent] = useState<string | null>(null);

  const denyRest = () => {
    const next: Record<string, PermissionDecision> = { ...rulings };
    for (const tool of tools) if (!tool.locked) next[tool.id] = "deny";
    setRulings(next);
  };

  const restart = () => {
    setTools(requested);
    setRulings({ ...opening });
    setScope("session");
    setSent(null);
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <AgentPermissions
        tools={tools}
        value={rulings}
        onChange={(id, decision) => setRulings((map) => ({ ...map, [id]: decision }))}
        scope={scope}
        onScopeChange={setScope}
        onApply={(final, chosenScope) => {
          const counts = summarizePermissions(tools, final);
          setSent(`${counts.allow} allowed, ${counts.ask} will ask, ${counts.deny} denied, scope ${chosenScope}`);
        }}
        subject="Release agent"
        title="Tool permissions"
      />

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--text-muted, #a2958a)" }}>
        <button type="button" style={ghost} onClick={restart}>
          Start over
        </button>
        <button type="button" style={ghost} onClick={denyRest}>
          Deny the rest
        </button>
        <button type="button" style={ghost} onClick={() => setTools([])}>
          Request nothing
        </button>
        <span>
          {sent ? `Handed to the runner: ${sent}` : "Nothing handed to the runner yet"}
        </span>
      </div>
    </div>
  );
}