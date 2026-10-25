import { useState } from "react";
import { CommentsPanel, type CommentAuthor, type PanelComment } from "../comments-panel";

/* Neutral silhouette portraits, so the demo needs no image files */
const portrait = (from: string, to: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="96" height="96" fill="url(#g)"/><circle cx="48" cy="37" r="15" fill="#fff" fill-opacity="0.9"/><path d="M16 96c0-17.7 14.3-32 32-32s32 14.3 32 32z" fill="#fff" fill-opacity="0.9"/></svg>`,
  )}`;

const mara: CommentAuthor = { name: "Mara Lindqvist", avatar: portrait("#fda4af", "#e11d48") };
const jonas: CommentAuthor = { name: "Jonas Weber", avatar: portrait("#93c5fd", "#2563eb") };
const lena: CommentAuthor = { name: "Lena Hart", avatar: portrait("#86efac", "#16a34a") };
const theo: CommentAuthor = { name: "Theo Brandt", avatar: portrait("#fcd34d", "#d97706") };
const sofia: CommentAuthor = { name: "Sofia Marin", avatar: portrait("#c4b5fd", "#7c3aed") };
const noah: CommentAuthor = { name: "Noah Feld", avatar: portrait("#5eead4", "#0d9488") };

const minute = 60_000;
const started = Date.now();

const seed: PanelComment[] = [
  {
    id: "c1",
    author: mara,
    createdAt: started - 2 * minute,
    text: "/edit Rename every “customers” to “members” on the pricing page.",
  },
  {
    id: "c2",
    author: jonas,
    createdAt: started - 5 * minute,
    text: "Should we mention the launch discount in the hero too?",
  },
  {
    id: "c3",
    author: lena,
    createdAt: started - 11 * minute,
    text: "The new illustrations look great on mobile.",
  },
  {
    id: "c4",
    author: theo,
    createdAt: started - 18 * minute,
    text: "/edit Shorten every FAQ answer to two sentences.",
  },
  {
    id: "c5",
    author: sofia,
    createdAt: started - 26 * minute,
    text: "Can we ship this before Friday?",
  },
];

export default function Demo() {
  const [comments, setComments] = useState(seed);
  const [edits, setEdits] = useState<string[]>([]);

  const runEdit = async (comment: PanelComment) => {
    // Stand-in for the real edit pass – the row spins until this settles
    await new Promise<void>((resolve) => setTimeout(resolve, 1200));
    setEdits((applied) => (applied.includes(comment.id) ? applied : [...applied, comment.id]));
  };

  const resolve = (comment: PanelComment, resolved: boolean) => {
    setComments((current) =>
      current.map((entry) => (entry.id === comment.id ? { ...entry, resolved } : entry)),
    );
  };

  const send = (text: string) => {
    setComments((current) => [
      { id: `local-${Date.now()}`, author: noah, createdAt: new Date(), text },
      ...current,
    ]);
  };

  return (
    <div style={{ width: "100%", maxWidth: 400 }}>
      <CommentsPanel
        comments={comments}
        title="Comments"
        currentUser={noah}
        onResolve={resolve}
        onRunEdit={runEdit}
        onSend={send}
      />
      {edits.length > 0 && (
        <p style={{ margin: "10px 2px 0", fontSize: 12, color: "var(--text-muted, #8f8f8f)" }}>
          Applied {edits.length === 1 ? "1 edit" : `${edits.length} edits`} to the page.
        </p>
      )}
    </div>
  );
}
