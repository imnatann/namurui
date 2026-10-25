import { useEffect, useState } from "react";
import { AttachmentTray, type AttachmentFile } from "../attachment-tray";

/* A real composer strip: one image already through, a log still on its way up, a replay
 * the bridge refused for size, and enough ordinary files to fold the tail behind +2. */
const INITIAL: AttachmentFile[] = [
  { id: "shot", name: "pasted-image.png", sizeBytes: 421_882, mimeType: "image/png", state: "ready" },
  {
    id: "log",
    name: "omp-bridge.log",
    sizeBytes: 2_184_311,
    mimeType: "text/plain",
    state: "uploading",
    progress: 0.34,
  },
  {
    id: "replay",
    name: "session-replay.mov",
    sizeBytes: 6_710_016,
    mimeType: "video/quicktime",
    state: "rejected",
    reason: "larger than 5 MB",
  },
  {
    id: "protocol",
    name: "protocol.md",
    sizeBytes: 18_204,
    mimeType: "text/markdown",
    state: "ready",
  },
  { id: "tokens", name: "theme-tokens.json", sizeBytes: 4_310, mimeType: "application/json", state: "ready" },
  { id: "notes", name: "run-notes.txt", sizeBytes: 2_048, mimeType: "text/plain", state: "ready" },
];

export default function Demo() {
  const [files, setFiles] = useState<AttachmentFile[]>(INITIAL);
  const [note, setNote] = useState("Ready to send with the next prompt.");
  const uploading = files.some((file) => file.state === "uploading");

  /* The tick only moves data. It stops the moment nothing is uploading, and it is
   * cleared on unmount, so the tray is never driven by a timer for anything visual. */
  useEffect(() => {
    if (!uploading) return;
    const timer = window.setInterval(() => {
      setFiles((current) =>
        current.map((file): AttachmentFile => {
          if (file.state !== "uploading") return file;
          const next = Math.min(1, (file.progress ?? 0) + 0.07);
          return next >= 1
            ? { ...file, state: "ready", progress: undefined }
            : { ...file, progress: next };
        }),
      );
    }, 600);
    return () => window.clearInterval(timer);
  }, [uploading]);

  const nameOf = (id: string) => files.find((file) => file.id === id)?.name ?? id;

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 560 }}>
      <AttachmentTray
        files={files}
        onRemove={(id) => {
          setNote(`Removed ${nameOf(id)} from the prompt.`);
          setFiles((current) => current.filter((file) => file.id !== id));
        }}
        onRetry={(id) => {
          setNote(`Retrying ${nameOf(id)} — the bridge is re-checking its size.`);
          setFiles((current) =>
            current.map((file): AttachmentFile =>
              file.id === id
                ? { ...file, state: "uploading", progress: 0, reason: undefined }
                : file,
            ),
          );
        }}
        onOpen={(id) => setNote(`Opened ${nameOf(id)} in the viewer.`)}
      />
      <p
        style={{
          margin: 0,
          opacity: 0.72,
          fontSize: 12,
          lineHeight: "18px",
        }}
      >
        {note}
      </p>
      {files.length === 0 ? (
        <button
          type="button"
          onClick={() => {
            setFiles(INITIAL);
            setNote("Attachments restored.");
          }}
          style={{
            justifySelf: "start",
            height: 28,
            padding: "0 10px",
            border: 0,
            borderRadius: 8,
            boxShadow: "inset 0 0 0 1px currentColor",
            background: "transparent",
            color: "inherit",
            font: "inherit",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Restore the strip
        </button>
      ) : null}
    </div>
  );
}
