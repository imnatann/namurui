import { useEffect, useState } from "react";
import { CommandMenu, type CommandItem } from "../command-menu";

export default function Demo() {
  const [open, setOpen] = useState(true);
  const [log, setLog] = useState<CommandItem[]>([]);

  /* The menu owns Ctrl K while it is mounted; this reopens it once it is gone. */
  useEffect(() => {
    if (open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div style={{ display: "grid", gap: 12, width: "100%", maxWidth: 600 }}>
      <CommandMenu
        open={open}
        onOpenChange={setOpen}
        onRun={(command) => setLog((entries) => [command, ...entries].slice(0, 3))}
      />

      {open ? null : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "#6b6b6b" }}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              padding: "7px 12px",
              borderRadius: 8,
              border: "1px solid #e2e2e2",
              background: "#fff",
              font: "inherit",
              fontSize: 12.5,
              color: "#2c2c2c",
              cursor: "pointer",
            }}
          >
            Open the command menu
          </button>
          <span>
            or press Ctrl K
            {log.length > 0 ? ` · last run: ${log[0].label}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
