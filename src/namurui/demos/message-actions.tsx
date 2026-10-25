import { useState } from "react";
import { MessageActions, MessageText, type FeedbackKind } from "../message-actions";

const answers = [
  "Activation fell 4 points because the new workspace step asks for a company name before anyone sees the product. Removing that field and moving it to the second session should recover most of the drop — we saw the same pattern in March.",
  "The 4-point drop comes from one extra field: the workspace step now asks for a company name up front. Move it after the first session and activation returns to roughly 41%.",
  "Short answer: one added field. The workspace step asks for a company name before the first project exists, so 4% of sign-ups stop there. Defer the field and the curve flattens again.",
  "Two changes overlapped last week: the company-name field in onboarding, and a slower first-load on the dashboard. The field accounts for about 3 of the 4 points; the load time covers the rest.",
];

export default function Demo() {
  const [versions, setVersions] = useState(answers.slice(0, 2));
  const [version, setVersion] = useState(1);
  const [note, setNote] = useState("Hover the message — the bar wakes up.");

  const regenerate = () => {
    const next = [...versions, answers[versions.length % answers.length]];
    setVersions(next);
    setVersion(next.length - 1);
    setNote("Regenerating — a new version arrives in the switcher.");
  };

  const feedback = (kind: FeedbackKind | null, reason?: string) => {
    if (!kind) setNote("Feedback withdrawn.");
    else if (kind === "up") setNote("Marked as a good answer.");
    else setNote(reason ? `Thanks — “${reason}” recorded.` : "Tell us what went wrong below.");
  };

  return (
    <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: 520 }}>
      <div
        style={{
          justifySelf: "end",
          maxWidth: "78%",
          padding: "9px 13px",
          borderRadius: "14px 14px 4px 14px",
          background: "#f1f1f1",
          color: "#3f3f46",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        Why did activation drop after last week&apos;s release?
      </div>

      <div
        data-ui-message
        style={{
          display: "grid",
          gap: 6,
          padding: "14px 16px 10px",
          borderRadius: 14,
          background: "#ffffff",
          boxShadow: "inset 0 0 0 1px #ececec",
          color: "#262626",
          fontSize: 13.5,
          lineHeight: 1.6,
        }}
      >
        <MessageText version={version}>{versions[version]}</MessageText>
        <MessageActions
          text={versions[version]}
          versions={versions}
          version={version}
          onVersionChange={setVersion}
          onRegenerate={regenerate}
          onFeedback={feedback}
          onCopy={() => setNote("Copied to clipboard.")}
          speakDuration={3200}
          reasons={["Not accurate", "Too long", "Missed the data", "Other"]}
        />
      </div>

      <p role="status" style={{ margin: 0, fontSize: 12.5, color: "#8f8f8f" }}>
        {note}
      </p>
    </div>
  );
}
