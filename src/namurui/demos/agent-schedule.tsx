import { useState } from "react";
import { AgentSchedule, type AgentTrigger } from "../agent-schedule";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The next 09:00 from the moment the demo mounts, so the digest counts down to a real time. */
function nextNine(now: number): number {
  const at = new Date(now);
  at.setHours(9, 0, 0, 0);
  if (at.getTime() <= now) at.setDate(at.getDate() + 1);
  return at.getTime();
}

/* What wakes the ops agent. Every time is anchored to the mount, so the countdowns are live ones
   rather than fixtures: the sweep is minutes away, the digest is hours away. */
function rules(now: number): AgentTrigger[] {
  return [
    {
      kind: "schedule",
      id: "digest",
      name: "Morning digest",
      cadence: "Every day at 09:00",
      expression: "0 9 * * *",
      timezone: "Europe/Amsterdam",
      enabled: true,
      nextRunAt: nextNine(now),
      everyMs: DAY,
      lastRun: {
        at: now - 23 * HOUR,
        status: "ok",
        note: "18 threads summarised into one brief",
        durationMs: 42_400,
      },
    },
    {
      kind: "schedule",
      id: "sweep",
      name: "Price sweep",
      cadence: "Every 15 minutes",
      expression: "*/15 * * * *",
      enabled: true,
      nextRunAt: now + 6 * MINUTE,
      everyMs: 15 * MINUTE,
      lastRun: { at: now - 9 * MINUTE, status: "failed", note: "Stripe answered 429 on /v1/prices", durationMs: 3_100 },
    },
    {
      kind: "event",
      id: "inbox",
      name: "Inbox triage",
      source: "Gmail",
      event: "message.received",
      enabled: true,
      lastRun: { at: now - 4 * MINUTE, status: "ok", note: "Filed 3 receipts", durationMs: 900 },
    },
    {
      kind: "event",
      id: "release",
      name: "Release notes",
      source: "GitHub",
      event: "release.published",
      enabled: true,
      blockedReason: "The GitHub app has no write access to the docs repository.",
      lastRun: { at: now - 2 * HOUR, status: "failed", note: "Push rejected, write access denied" },
    },
    {
      kind: "schedule",
      id: "rollup",
      name: "Weekly sales rollup",
      cadence: "Every Monday at 07:30",
      expression: "30 7 * * 1",
      timezone: "Europe/Amsterdam",
      enabled: false,
      nextRunAt: now + 3 * DAY,
      everyMs: 7 * DAY,
      lastRun: { at: now - 6 * DAY, status: "ok", durationMs: 128_000 },
    },
  ];
}

export default function Demo() {
  const [triggers] = useState(() => rules(Date.now()));
  const [log, setLog] = useState("Nothing has moved yet.");

  const named = (id: string) => triggers.find((one) => one.id === id)?.name ?? id;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <AgentSchedule
        title="Wake rules"
        agent="ops-agent"
        triggers={triggers}
        onToggle={(id, on) => setLog(on ? `${named(id)} switched on.` : `${named(id)} switched off.`)}
        onRunNow={(id) => setLog(`${named(id)} asked to run now.`)}
      />
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted, #a2958a)" }}>{log}</p>
    </div>
  );
}