import { useEffect, useRef, useState } from "react";
import { FanoutGrid, type FanoutStatus, type FanoutTask } from "../fan-out-grid";

/* 240 leads enriched by fourteen workers – the grid fills left to right as the run comes back. */

const NAMES = [
  "Northwind",
  "Cobalt",
  "Lumen",
  "Harbor",
  "Fieldkit",
  "Atlas",
  "Quietloop",
  "Meridian",
  "Sunbeam",
  "Rivet",
  "Orbital",
  "Graystone",
  "Paperlane",
  "Tempo",
  "Vantage",
  "Hearth",
];

const KINDS = [
  "Labs",
  "Systems",
  "Studio",
  "Health",
  "Legal",
  "Energy",
  "Press",
  "Finance",
  "Cloud",
  "Logistics",
  "Analytics",
  "Robotics",
  "Foods",
  "Travel",
  "Media",
];

const COUNT = NAMES.length * KINDS.length; // 240
const WORKERS = 14;
/** One round of workers. Every task is shorter than this, so at most one round is in flight. */
const ROUND = 940;
/** The clock stops here: the last round, its slowest task and the second attempt after it. */
const RUN = 17_500;
/** Every 41st lead needs a second attempt; the rest land first time. */
const RETRY_EVERY = 41;
/** And every 113th gives up after two, so the retry in the footer has something to work on. */
const FAIL_EVERY = 113;
const COST = 0.029;

const RESULTS = [
  "ICP fit 0.82 · 41 employees · Series A",
  "ICP fit 0.64 · 180 employees · Enterprise",
  "ICP fit 0.91 · 12 employees · Seed",
];

const FAILURE = "Rate limited by the enrichment API (429) – gave up after 2 attempts";

type Slot = {
  /** When the first attempt starts */
  start: number;
  /** How long it takes */
  first: number;
  /** It fails at the end of the first attempt and goes again */
  retries: boolean;
  /** It fails and stays failed until someone retries it */
  givesUp: boolean;
  /** The second attempt */
  second: number;
};

export default function Demo() {
  const [now, setNow] = useState(0);
  const [arm, setArm] = useState(0);
  const [retried, setRetried] = useState<Record<string, number | undefined>>({});

  /* A retry rewinds the clock to the moment it was asked for and runs it forward again, so a
   * task that failed at the end of the run still animates on the way back. */
  const clock = useRef({ offset: 0, span: RUN });

  useEffect(() => {
    const from = performance.now();
    const { offset, span } = clock.current;
    let frame = 0;
    let last = -1;
    const step = (time: number) => {
      const elapsed = offset + (time - from);
      if (elapsed - last >= 70) {
        last = elapsed;
        setNow(elapsed);
      }
      if (elapsed - offset < span) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [arm]);

  const tasks: FanoutTask[] = [];
  for (let index = 0; index < COUNT; index += 1) {
    /* Round-robin over the workers; each attempt is shorter than a round, so at most one round
     * of fourteen is ever in flight. */
    const slot: Slot = {
      start: Math.floor(index / WORKERS) * ROUND + (index % 4) * 40,
      first: 420 + ((index * 271) % 460),
      retries: index % RETRY_EVERY === 7,
      givesUp: index % FAIL_EVERY === 55,
      second: 480 + ((index * 97) % 380),
    };
    const id = `lead-${String(index + 1).padStart(3, "0")}`;
    const label = `${NAMES[index % NAMES.length]} ${KINDS[Math.floor(index / NAMES.length)]}`;
    const worker = `w-${String((index % WORKERS) + 1).padStart(2, "0")}`;
    const result = RESULTS[index % RESULTS.length];
    const firstEnd = slot.start + slot.first;

    const again = retried[id];
    if (again !== undefined && slot.givesUp) {
      tasks.push(
        now < again + 1300
          ? { id, label, worker, start: again, status: "running", attempts: 2 }
          : {
              id,
              label,
              worker,
              start: again,
              end: again + 1300,
              status: "done",
              attempts: 2,
              cost: COST,
              result,
            },
      );
      continue;
    }

    if (slot.givesUp) {
      const settled = now >= firstEnd;
      tasks.push({
        id,
        label,
        worker,
        status: settled ? "failed" : now < slot.start ? "queued" : "running",
        start: slot.start,
        end: settled ? firstEnd : undefined,
        cost: settled ? COST / 3 : undefined,
        attempts: 1,
        error: settled ? FAILURE : undefined,
      });
      continue;
    }

    if (slot.retries) {
      const secondStart = firstEnd + 420;
      const secondEnd = secondStart + slot.second;
      let status: FanoutStatus;
      if (now < slot.start) status = "queued";
      else if (now < firstEnd) status = "running";
      else if (now < secondStart) status = "retrying";
      else if (now < secondEnd) status = "running";
      else status = "done";
      tasks.push({
        id,
        label,
        worker,
        status,
        start: now < secondStart ? slot.start : secondStart,
        end: status === "done" ? secondEnd : undefined,
        attempts: 2,
        cost: status === "done" ? COST : undefined,
        result: status === "done" ? result : undefined,
      });
      continue;
    }

    const status: FanoutStatus = now < slot.start ? "queued" : now < firstEnd ? "running" : "done";
    tasks.push({
      id,
      label,
      worker,
      status,
      start: slot.start,
      end: status === "done" ? firstEnd : undefined,
      attempts: 1,
      cost: status === "done" ? COST : undefined,
      result: status === "done" ? result : undefined,
    });
  }

  const retry = (ids: string[]) => {
    const at = now;
    setRetried((previous) => {
      const next = { ...previous };
      for (const id of ids) next[id] = at;
      return next;
    });
    clock.current = { offset: at, span: 2600 };
    setArm((value) => value + 1);
  };

  return (
    <div style={{ width: "100%", maxWidth: 756 }}>
      <FanoutGrid tasks={tasks} job="Enrich 240 leads" workers={WORKERS} now={now} onRetry={retry} />
    </div>
  );
}
