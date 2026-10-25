import { useEffect, useRef, useState } from "react";
import {
  GroupChat,
  type GroupChatMessage,
  type GroupChatParticipant,
} from "../group-chat";

const TEAM: GroupChatParticipant[] = [
  { id: "dana", name: "Dana", role: "Owner", kind: "human", glyph: "person" },
  { id: "rowan", name: "Rowan", role: "Plan", kind: "agent", glyph: "steps" },
  { id: "iris", name: "Iris", role: "Sources", kind: "agent", glyph: "sweep" },
  { id: "bram", name: "Bram", role: "Migrations", kind: "agent", glyph: "blocks", presence: "away" },
];

const THREAD: GroupChatMessage[] = [
  {
    id: "s1",
    author: "rowan",
    time: "09:41",
    text: "Here is the shape of the cutover: two windows, one reversibility check between them.",
  },
  {
    id: "s2",
    author: "rowan",
    time: "09:41",
    text: "Window one moves the read path. Window two moves the write path, and it only opens if window one holds.",
  },
  {
    id: "s3",
    author: "iris",
    time: "09:44",
    text: "I read the last four write path incident reports. Two are the same failure: a retry landing after the batch commits.",
  },
  {
    id: "s4",
    author: "dana",
    time: "09:47",
    text: "That matches what support is seeing. When do we take window one?",
  },
  {
    id: "s5",
    author: "rowan",
    time: "09:48",
    text: "Thursday 02:00 to 04:00. The read path is already warm from Monday, so the window stays short.",
    replyTo: "s4",
  },
  {
    id: "s6",
    author: "bram",
    time: "09:52",
    text: "The migration is written and the dry run is clean against a copy of Tuesday's volume.",
  },
  {
    id: "s7",
    author: "iris",
    time: "09:53",
    text: "@Bram one guard before we open: the idempotency key on the retry table is not unique yet.",
  },
];

const stamp = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

export default function Demo() {
  const [team, setTeam] = useState(TEAM);
  const [thread, setThread] = useState(THREAD);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  const compose = (id: string, composing: boolean) =>
    setTeam((all) => all.map((person) => (person.id === id ? { ...person, composing } : person)));

  const send = (message: GroupChatMessage) => {
    setThread((all) => [...all, message]);
    compose("iris", true);
    const timer = window.setTimeout(() => {
      compose("iris", false);
      setThread((all) => [
        ...all,
        {
          id: `iris-${all.length}`,
          author: "iris",
          time: stamp(),
          text: "Logged. I will attach the retry key check to window one before it opens.",
        },
      ]);
    }, 1400);
    timers.current.push(timer);
  };

  return (
    <div style={{ display: "grid", gap: 16, width: "100%" }}>
      <GroupChat
        participants={team}
        messages={thread}
        selfId="dana"
        title="Cutover planning"
        rosterTitle="In this thread"
        placeholder="Answer the thread"
        onSend={send}
      />
      <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>
        Reply to any line and it quotes the line it answers. Iris picks up the thread 1.4s after you
        send.
      </p>
    </div>
  );
}