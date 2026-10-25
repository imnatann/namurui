import { useEffect, useRef, useState } from "react";
import { RuntimeSettings, type RuntimeSettingsValue } from "../runtime-settings";

/* The bridge round-trip is slower than the panel, so the demo holds Save in its saving
 * state for a moment and reports the fields the write carried. */
const WRITE_MS = 800;

export default function Demo() {
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState<RuntimeSettingsValue | null>(null);
  const [lastWrite, setLastWrite] = useState<{ at: string; settings: RuntimeSettingsValue } | null>(
    null,
  );
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const handleSave = (next: RuntimeSettingsValue) => {
    setSaving(true);
    setEdited(null);
    setLastWrite(null);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setSaving(false);
      setLastWrite({
        at: new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        settings: next,
      });
    }, WRITE_MS);
  };

  const shown = edited ?? lastWrite?.settings ?? null;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          fontSize: 11,
          color: "var(--text-muted, #6f625a)",
        }}
      >
        <span>
          session{" "}
          <code style={{ fontFamily: "ui-monospace, monospace", fontSize: 11 }}>01a169b8</code>
        </span>
        <span role="status" aria-live="polite">
          {saving
            ? "Writing 9 fields over the bridge…"
            : edited
              ? "Draft only — nothing sent"
              : lastWrite
                ? `Written ${lastWrite.at}`
                : "Nothing written this session"}
        </span>
      </div>

      <RuntimeSettings
        saving={saving}
        slowModeSupported
        onChange={(next) => {
          setEdited(next);
          setLastWrite(null);
        }}
        onSave={handleSave}
        onReset={() => {
          setEdited(null);
          setLastWrite(null);
        }}
      />

      {shown ? (
        <p
          style={{
            margin: 0,
            padding: "8px 11px",
            borderRadius: 12,
            background: "var(--muted-bg, #7a4a1c0a)",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 11,
            lineHeight: "17px",
            color: "var(--text-muted, #6f625a)",
            overflowWrap: "anywhere",
          }}
        >
          <b style={{ color: "var(--text, #1a1410)", fontWeight: 500 }}>
            {lastWrite ? "written" : "draft"}
          </b>{" "}
          steering={shown.steeringMode} · followUp={shown.followUpMode} ·
          interrupt={shown.interruptMode} · compaction={shown.autoCompaction ? "on" : "off"} ·
          retry={shown.autoRetry ? "on" : "off"} · fast={shown.fastMode ? "on" : "off"} ·
          cache={shown.cacheWarming}
        </p>
      ) : null}
    </div>
  );
}
