import { useEffect, useRef, useState } from "react";
import { SideQuestion, type SideQuestionRecord } from "../side-question";

/* The streamed answer is a real token sequence, so the caret trails text that actually grew
 * rather than a simulated progress state. */
const TOKENS =
  "Yes — /btw opens a second thread against the same session, so the turn in flight keeps its context and its place. Nothing is interrupted; the aside lands here when it settles.".split(
    " ",
  );

const SEED: SideQuestionRecord[] = [
  {
    id: "btw_2",
    question: "Does this touch the working tree while the turn runs?",
    answer: "",
    status: "running",
  },
  {
    id: "btw_1",
    question: "What does /btw do to the turn that is already running?",
    answer:
      "It forks a read-only aside on the same session. The running turn is never paused, and the aside never writes a message into it.",
    status: "complete",
    followUps: ["Where does the aside go?", "Can I cancel it?"],
  },
];

export default function Demo() {
  const [records, setRecords] = useState<readonly SideQuestionRecord[]>(SEED);
  const [draft, setDraft] = useState("");
  const stepRef = useRef<Record<string, number>>({});
  const seqRef = useRef(3);

  /* One token per tick for every live aside, on a timer that only touches data. The moment a
   * record stops being "running" — finished here, or cancelled by the reader — it is left be. */
  useEffect(() => {
    const live = records.filter((record) => record.status === "running");
    if (live.length === 0) return;
    const timer = window.setTimeout(() => {
      const plan = live.map((record) => {
        const step = stepRef.current[record.id] ?? 0;
        if (step >= TOKENS.length) return { id: record.id, done: true, text: "" };
        stepRef.current[record.id] = step + 1;
        return { id: record.id, done: false, text: `${step === 0 ? "" : " "}${TOKENS[step]}` };
      });
      setRecords((all) =>
        all.map((record) => {
          const move = plan.find((item) => item.id === record.id);
          if (!move || record.status !== "running") return record;
          return move.done
            ? { ...record, status: "complete" as const }
            : { ...record, answer: `${record.answer}${move.text}` };
        }),
      );
    }, 150);
    return () => window.clearTimeout(timer);
  }, [records]);

  const ask = (question: string) => {
    const id = `btw_${seqRef.current}`;
    seqRef.current += 1;
    setRecords((all) => [{ id, question, answer: "", status: "running" }, ...all]);
  };

  const cancel = (id: string) => {
    setRecords((all) =>
      all.map((record) =>
        record.id === id
          ? { ...record, status: "cancelled" as const, answer: `${record.answer} — stopped` }
          : record,
      ),
    );
  };

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 460 }}>
      <SideQuestion
        records={records}
        draft={draft}
        onDraftChange={setDraft}
        onAsk={ask}
        onCancel={cancel}
      />
      <p style={{ margin: 0, fontSize: 12, lineHeight: "18px", opacity: 0.72 }}>
        The head card streams while the turn keeps running. Cancel it mid-answer, or scroll
        down — the stack stops following you the moment you do.
      </p>
    </div>
  );
}
