import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Toaster, toast } from "../toaster";

/*
 * Demo – the toaster anchored inside a card, top centre, so the stack's inline shell sits in
 * the stage instead of the viewport corner. The three toasts the reference captured are raised
 * on mount; the buttons then replay each path: a quiet save, an undoable delete, a promise that
 * morphs from spinner to check (or cross on every third failure) and a hard error.
 */

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const stage: CSSProperties = {
  position: "relative",
  display: "grid",
  alignContent: "center",
  width: "min(100%, 520px)",
  minHeight: 360,
  padding: "104px 20px 28px",
  borderRadius: 16,
  background: "var(--card)",
  boxShadow: "inset 0 0 0 1px var(--border)",
};

const button: CSSProperties = {
  height: 34,
  padding: "0 12px",
  border: 0,
  borderRadius: 9,
  background: "var(--muted-bg)",
  boxShadow: "inset 0 0 0 1px var(--border)",
  color: "var(--text)",
  font: "inherit",
  fontSize: 12.5,
  fontWeight: 550,
  cursor: "pointer",
};

const heading: CSSProperties = { margin: 0, fontSize: 15, fontWeight: 590, color: "var(--text)" };

const body: CSSProperties = { margin: 0, fontSize: 12.5, lineHeight: "18px", color: "var(--text-subtle)" };

/** The custom icon the reference used for a deleted file – sized by `.ui-tsc__icon[data-type="custom"]` */
const TrashGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 7.5h14M10 7.5V5.8h4v1.7M6.8 7.5l.7 10.2h9l.7-10.2M10.4 10.6v4M13.6 10.6v4" />
  </svg>
);

export default function Demo() {
  const [drafts, setDrafts] = useState(0);
  const uploads = useRef(0);

  /* The stack the reference was captured in: a save, the undoable delete, then the upload on top.
   * Deferred by a frame so StrictMode's first, discarded mount never seeds the shared store. */
  useEffect(() => {
    const seed = window.setTimeout(() => {
      toast.success("Draft saved", { description: "Q3 Board Report · all changes kept" });
      toast("File moved to trash", {
        description: "Budget-2027.xlsx",
        icon: <TrashGlyph />,
        action: { label: "Undo", onClick: () => toast.info("Restored to the Finance folder") },
      });
      toast.success("Report uploaded", { description: "Shared with 4 people in Finance" });
    }, 60);

    return () => {
      window.clearTimeout(seed);
      toast.dismiss();
    };
  }, []);

  const upload = () => {
    uploads.current += 1;
    const attempt = uploads.current;
    void toast.promise(
      async () => {
        await wait(1900);
        if (attempt % 3 === 0) throw new Error("The connection dropped after 84%");
        return { people: 4 + attempt };
      },
      {
        loading: { title: "Uploading report…", description: "Q3-board-report.pdf · 2.4 MB" },
        success: (result) => ({ title: "Report uploaded", description: `Shared with ${result.people} people in Finance` }),
        error: (error) => ({
          title: "Upload failed",
          description: error instanceof Error ? error.message : "Try again",
        }),
      },
    );
  };

  return (
    <div style={stage}>
      <Toaster position="top-center" inline label="Notifications">
        <div style={{ display: "grid", gap: 14, justifyItems: "center" }}>
          <div style={{ display: "grid", gap: 5, maxWidth: 400, textAlign: "center" }}>
            <h3 style={heading}>Every confirmation, one quiet corner</h3>
            <p style={body}>
              Raise a toast from anywhere with <code>toast()</code>. The stack folds to a single card, fans out when
              you reach for it, and a promise keeps its place while it turns into a check.
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 420 }}>
            <button
              type="button"
              style={button}
              onClick={() => {
                const next = drafts + 1;
                setDrafts(next);
                toast.success("Draft saved", {
                  description: next === 1 ? "Q3 Board Report · all changes kept" : `Q3 Board Report · revision ${next}`,
                });
              }}
            >
              Save a draft
            </button>
            <button
              type="button"
              style={button}
              onClick={() =>
                toast("File moved to trash", {
                  description: "Budget-2027.xlsx",
                  icon: <TrashGlyph />,
                  action: { label: "Undo", onClick: () => toast.info("Restored to the Finance folder") },
                })
              }
            >
              Delete a file
            </button>
            <button type="button" style={button} onClick={upload}>
              Upload the report
            </button>
            <button
              type="button"
              style={button}
              onClick={() => toast.error("Sync failed", { description: "Notion · retrying in 30 seconds" })}
            >
              Break a sync
            </button>
            <button type="button" style={button} onClick={() => toast.dismiss()}>
              Dismiss all
            </button>
          </div>
          <p style={{ ...body, fontSize: 12 }}>
            Hover the stack to fan it out · swipe a card sideways to throw it away · F8 jumps to the newest
          </p>
        </div>
      </Toaster>
    </div>
  );
}
