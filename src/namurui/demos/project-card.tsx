import { useState } from "react";
import {
  ProjectCard,
  type Project,
  type ProjectPerson,
  type ProjectSubtask,
} from "../project-card";

const PEOPLE: ProjectPerson[] = [
  { id: "mara", name: "Mara", hue: 122 },
  { id: "jonas", name: "Jonas", hue: 244 },
  { id: "priya", name: "Priya", hue: 224 },
];

const SUBTASKS: ProjectSubtask[] = [
  { id: "welcome", label: "Welcome screen", done: true, assignee: "mara" },
  { id: "workspace", label: "Workspace setup", done: true, assignee: "jonas" },
  { id: "invite", label: "Invite teammates", done: true, assignee: "mara" },
  { id: "checklist", label: "First-run checklist", done: false, assignee: "priya" },
  { id: "emails", label: "Lifecycle emails", done: false, assignee: "jonas" },
];

/**
 * The reference demo: the onboarding project, open on load, three of five subtasks done.
 * Ticking a row moves an arc on the ring and rewrites the foot line; picking a status in the
 * head swaps the tag and the tone. Hovering a face dims the rows that belong to someone else.
 */
export default function Demo() {
  const [subtasks, setSubtasks] = useState(SUBTASKS);
  const [project, setProject] = useState<Project>({
    name: "Onboarding flow",
    status: "progress",
    due: "Oct 24",
  });
  const [lastOpened, setLastOpened] = useState(0);

  const toggleSubtask = (id: string, done: boolean): void => {
    setSubtasks((previous) =>
      previous.map((task) => (task.id === id ? { ...task, done } : task)),
    );
  };

  return (
    <div style={{ display: "grid", justifyItems: "center", width: "100%" }}>
      <ProjectCard
        project={project}
        subtasks={subtasks}
        people={PEOPLE}
        onStatusChange={(status) => setProject((previous) => ({ ...previous, status }))}
        onSubtaskToggle={toggleSubtask}
        onOpen={() => setLastOpened((count) => count + 1)}
        defaultOpen
      />

      <p
        style={{
          margin: "18px 0 0",
          font: "12.5px/1.5 Inter, ui-sans-serif, system-ui, sans-serif",
          color: "#8a8a8a",
          textAlign: "center",
        }}
      >
        {lastOpened === 0
          ? "Hover a face to preview someone's subtasks, click to pin the filter."
          : `Opened the project ${lastOpened}× — click a row to move an arc on the ring.`}
      </p>
    </div>
  );
}
