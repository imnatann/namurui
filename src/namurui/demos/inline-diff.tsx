import { useState } from "react";
import { InlineDiff, type DiffChange } from "../inline-diff";

const ANNOUNCEMENT =
  "Hi everyone, we are very excited to announce that the new dashboard is now available for all users. It loads a lot faster than before, and you can now export any report to CSV with just a single click. Let us know what you think!";

const SHORTER =
  "Hi everyone, the new dashboard is now live for all users. It loads twice as fast, and you can now export any report to CSV in one click. Let us know what you think!";

type Decision = { verdict: "accepted" | "rejected"; change: DiffChange };

export default function Demo() {
  const [log, setLog] = useState<Decision[]>([]);
  const [text, setText] = useState(ANNOUNCEMENT);

  return (
    <div style={{ display: "grid", gap: 10, width: "100%", maxWidth: 520 }}>
      <InlineDiff
        label="Suggested by AI · Make it shorter"
        original={ANNOUNCEMENT}
        revised={SHORTER}
        onChange={setText}
        onAccept={(_, change) => setLog((entries) => [...entries, { verdict: "accepted", change }])}
        onReject={(_, change) => setLog((entries) => [...entries, { verdict: "rejected", change }])}
      />

      {/* The caret line the announcement goes back to once every suggestion is decided */}
      {log.length > 0 && (
        <p style={{ margin: 0, fontSize: 12, lineHeight: "18px", color: "#8f8f8f" }}>
          {log.filter((entry) => entry.verdict === "accepted").length} kept ·{" "}
          {log.filter((entry) => entry.verdict === "rejected").length} rejected ·{" "}
          {text === SHORTER
            ? "announcement updated"
            : text === ANNOUNCEMENT
              ? "original wording"
              : "mixed wording"}
        </p>
      )}
    </div>
  );
}
