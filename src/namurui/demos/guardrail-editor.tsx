import { useState } from "react";
import { GuardrailEditor, type GuardrailRule } from "../guardrail-editor";

/*
 * A support agent's outbound message policy. Rules 1 and 2 both match the sample, so the order
 * decides the outcome: send a reply that quotes a card number and the policy either blocks the
 * whole message or masks the number, depending only on which rule sits first.
 */

const POLICY: GuardrailRule[] = [
  {
    id: "card-context",
    label: "Anything that refers to a card ending",
    pattern: "card ending",
    action: "block",
    enabled: true,
  },
  {
    id: "card-number",
    label: "Payment card numbers in the body",
    pattern: "\\b(?:\\d{4}[ -]){3}\\d{4}\\b",
    match: "regex",
    action: "redact",
    enabled: true,
  },
  {
    id: "internal-host",
    label: "Internal hostnames in a customer reply",
    pattern: "\\b[a-z0-9][a-z0-9-]*\\.(?:internal|corp)\\b",
    match: "regex",
    action: "block",
    enabled: true,
  },
  {
    id: "unreleased-price",
    label: "A price table that has not shipped yet",
    pattern: "pricing preview",
    action: "warn",
    enabled: true,
  },
  {
    id: "stack-trace",
    label: "Pasted stack traces in a customer reply",
    pattern: "(?i)Traceback \\(most recent call last",
    match: "regex",
    action: "warn",
    enabled: false,
  },
];

const SAMPLE = "The card ending 4111 1111 1111 1111 was declined, so I looped in ops@acme.internal.";

export default function Demo() {
  const [changes, setChanges] = useState(0);
  const [caption, setCaption] = useState("");

  return (
    <div style={{ display: "grid", gap: 12, width: "100%", maxWidth: 700 }}>
      <GuardrailEditor
        title="Outbound message policy"
        defaultRules={POLICY}
        defaultSample={SAMPLE}
        onRulesChange={() => setChanges((count) => count + 1)}
        onEvaluate={(verdict) =>
          setCaption(
            verdict.state === "clear"
              ? "No rule matches. The sample would send unchanged."
              : `Rule ${verdict.rank} fires: ${verdict.action} on "${verdict.matched}".`
          )
        }
      />

      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--text-subtle, #1a141066)" }}>
        Rules 1 and 2 both match this sample. Move rule 2 to the top and the tester starts masking
        the number instead of blocking the send.
      </p>

      <p
        role="status"
        aria-live="polite"
        style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--text-muted, #6f625a)" }}
      >
        {changes > 0 ? `${changes} policy change${changes === 1 ? "" : "s"} · ` : ""}
        {caption || "Reading the sample against the policy."}
      </p>
    </div>
  );
}