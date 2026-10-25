import { useCallback, useEffect, useRef, useState } from "react";
import {
  AgentSteering,
  type SteerLandedNote,
  type SteerNote,
  type SteerStatus,
  type SteerStep,
} from "../agent-steering";

const STARTED_AT = Date.now() - 127_000;

/** The same plan the reference shows, still running on step 2. */
const PLAN: SteerStep[] = [
  { id: "schema", title: "Read schema and 14 migrations", status: "done", time: "1.4s" },
  {
    id: "plan",
    title: "Plan the split into accounts and profiles",
    status: "active",
    time: "1.0s",
  },
  { id: "write", title: "Write migration 0042_split_users", status: "pending" },
  { id: "dry-run", title: "Dry run on staging", status: "pending" },
  { id: "pr", title: "Open a pull request for review", status: "pending" },
];

const STEP_MS = 7_000;

export default function Demo() {
  const [steps, setSteps] = useState<SteerStep[]>(PLAN);
  const [queue, setQueue] = useState<SteerNote[]>([
    { id: "queued-1", text: "Use Postgres 16 syntax – prod isn’t on 17 yet." },
  ]);
  const [status, setStatus] = useState<SteerStatus>("running");
  const [draft, setDraft] = useState("");

  const stepsRef = useRef(steps);
  const queueRef = useRef(queue);
  const stepStartedAt = useRef(Date.now());
  const noteSeq = useRef(1);
  const landingTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => () => window.clearTimeout(landingTimer.current), []);

  /* The landing flourish is 1400ms of the sheet; drop the attribute once it has played. */
  const flashLanded = useCallback(() => {
    window.clearTimeout(landingTimer.current);
    landingTimer.current = window.setTimeout(() => {
      setSteps((list) =>
        list.map((step) => ({
          ...step,
          notes: step.notes?.map((note) => ({ ...note, landed: false })),
        })),
      );
    }, 1600);
  }, []);

  /* The agent closes the step it is on and takes the whole queue into the step it starts next. */
  const advance = useCallback(() => {
    const list = stepsRef.current;
    const index = list.findIndex((step) => step.status === "active");
    if (index < 0) return;

    const picked = queueRef.current;
    const carried: SteerLandedNote[] = picked.map((note) => ({
      id: note.id,
      text: note.text,
      picked: "next",
      landed: true,
    }));

    /* On the last step there is nothing to start, so it simply takes the queue in where it is. */
    if (index === list.length - 1) {
      if (picked.length === 0) return;
      setSteps((current) =>
        current.map((step, i): SteerStep =>
          i === index ? { ...step, notes: [...(step.notes ?? []), ...carried] } : step,
        ),
      );
      setQueue([]);
      flashLanded();
      return;
    }

    const duration = `${((Date.now() - stepStartedAt.current) / 1000).toFixed(1)}s`;
    stepStartedAt.current = Date.now();

    setSteps(
      list.map(
        (step, i): SteerStep =>
          i === index
            ? { ...step, status: "done", time: duration }
            : i === index + 1
              ? { ...step, status: "active", notes: [...(step.notes ?? []), ...carried] }
              : step,
      ),
    );

    if (picked.length > 0) {
      setQueue([]);
      flashLanded();
    }
  }, [flashLanded]);

  useEffect(() => {
    if (status !== "running") return;
    const id = window.setInterval(advance, STEP_MS);
    return () => window.clearInterval(id);
  }, [advance, status]);

  /* Interrupting drops the note on the step that is running and hands the run back to you. */
  const interrupt = (text: string, noteId?: string) => {
    noteSeq.current += 1;
    const body = text.trim() || "Hold the run until I have read the generated SQL.";

    if (noteId) setQueue((notes) => notes.filter((note) => note.id !== noteId));

    const note: SteerLandedNote = {
      id: `now-${noteSeq.current}`,
      text: body,
      picked: "now",
      landed: true,
    };
    setSteps((list) =>
      list.map((step): SteerStep =>
        step.status === "active" ? { ...step, notes: [...(step.notes ?? []), note] } : step,
      ),
    );
    setStatus("paused");
    setDraft("");
    flashLanded();
  };

  return (
    <div style={{ display: "grid", gap: 12, width: "100%", maxWidth: 460 }}>
      <AgentSteering
        title="Migrate users table"
        agent="Opus 5.5"
        steps={steps}
        queue={queue}
        status={status}
        startedAt={STARTED_AT}
        draft={draft}
        onDraftChange={setDraft}
        onSteer={(text) => {
          noteSeq.current += 1;
          setQueue((notes) => [...notes, { id: `queued-${noteSeq.current}`, text }]);
          setDraft("");
        }}
        onInterrupt={interrupt}
        onRemove={(noteId) => setQueue((notes) => notes.filter((note) => note.id !== noteId))}
        onPause={() => setStatus("paused")}
        onResume={() => setStatus("running")}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={advance}
          disabled={status !== "running"}
          style={{
            height: 28,
            padding: "0 12px",
            border: 0,
            borderRadius: 7,
            background: "#ffffff",
            color: "#3c3c40",
            boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.09), 0 1px 2px rgba(0,0,0,0.06)",
            font: "500 12px/1 Inter, system-ui, sans-serif",
            cursor: "pointer",
            opacity: status === "running" ? 1 : 0.45,
          }}
        >
          Finish this step
        </button>
        <span style={{ fontSize: 11.5, color: "#8b8b90" }}>
          Queue a note, then watch it land on the step that picks it up.
        </span>
      </div>
    </div>
  );
}
