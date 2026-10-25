import { useEffect, useRef, useState } from "react";
import { EntryActions } from "../entry-actions";

const ENTRY_ID = "e-7f3c2a91";

const control = {
  height: 28,
  padding: "0 10px",
  border: 0,
  borderRadius: 8,
  background: "transparent",
  boxShadow: "inset 0 0 0 1px var(--border, #e8e0d7)",
  color: "var(--text-muted, #6f625a)",
  font: "inherit",
  fontSize: 12,
  cursor: "pointer",
};

const active = { ...control, boxShadow: "inset 0 0 0 1px var(--accent, #c2410c)" };

const mono = { fontFamily: "ui-monospace, monospace" };

export default function Demo() {
  const [streaming, setStreaming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [last, setLast] = useState("Nothing pressed yet");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  /* The demo owns the copied value, so it owns the clock that clears it: 1.2 s, the same
   * window the row uses when the value is left uncontrolled. */
  const flash = () => {
    setCopied(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setCopied(false);
      timer.current = null;
    }, 1200);
  };

  return (
    <div
      style={{
        display: "grid",
        gap: 14,
        width: "100%",
        maxWidth: 520,
        margin: "0 auto",
        padding: "24px 0 32px",
      }}
    >
      <div
        style={{
          padding: "14px 16px 6px",
          borderRadius: 16,
          background: "var(--panel, #fffdfb)",
          boxShadow: "inset 0 0 0 1px var(--border, #e8e0d7)",
          color: "var(--text, #1a1410)",
          fontSize: 13,
          lineHeight: "20px",
        }}
      >
        <p style={{ margin: "0 0 2px", fontSize: 11.5, color: "var(--text-muted, #6f625a)" }}>
          assistant · 14:32 · {ENTRY_ID}
        </p>
        <p style={{ margin: "0 0 10px" }}>
          Traced the drop to <code style={mono}>bridge.ts:184</code>: the socket is torn down on{" "}
          <code style={mono}>visibilitychange</code> before the <code style={mono}>turn_end</code> frame lands. Holding the teardown until the in-flight turn finishes.
        </p>

        <EntryActions
          entryId={ENTRY_ID}
          streaming={streaming}
          copied={copied}
          onFork={() => setLast("Forked the session at this entry")}
          onBranch={() => setLast("Branch opened from this entry")}
          onCopy={() => {
            flash();
            setLast("Entry text copied");
          }}
          onJump={() => setLast("Scrolled back to this entry")}
        />
      </div>

      <p style={{ margin: 0, fontSize: 12, lineHeight: "18px", color: "var(--text-muted, #6f625a)" }}>
        Hover the entry, or tab into the row, to bring the actions up. {last}.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          aria-pressed={streaming}
          onClick={() => setStreaming((on) => !on)}
          style={streaming ? active : control}
        >
          Streaming: {streaming ? "on" : "off"}
        </button>
        <button
          type="button"
          aria-pressed={copied}
          onClick={() => {
            if (!copied) {
              flash();
              return;
            }
            if (timer.current !== null) window.clearTimeout(timer.current);
            timer.current = null;
            setCopied(false);
          }}
          style={copied ? active : control}
        >
          Copied: {copied ? "on" : "off"}
        </button>
      </div>
    </div>
  );
}
