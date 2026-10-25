import { useState } from "react";
import {
  ToolRegistry,
  type RegisteredTool,
  type ToolParameter,
  type ToolRisk,
} from "../tool-registry";

/** Parameter row: required defaults to false so the table only marks the exceptions. */
const p = (
  name: string,
  type: string,
  description: string,
  required = false,
): ToolParameter => ({ name, type, description, required });

/** Tool row: the callable name doubles as the id used by `referenced` and `enabled`. */
const t = (
  name: string,
  source: string,
  risk: ToolRisk,
  purpose: string,
  returns: string,
  parameters: ToolParameter[],
): RegisteredTool => ({ id: name, name, source, risk, purpose, returns, parameters });

const TOOLS: RegisteredTool[] = [
  t("read_file", "workspace", "low", "Read a file from the workspace by path", "string", [
    p("path", "string", "Absolute path inside the workspace", true),
    p("encoding", "string", "Text encoding, utf-8 when omitted"),
  ]),
  t("write_file", "workspace", "high", "Create or replace a file in the workspace", "void", [
    p("path", "string", "Absolute path inside the workspace", true),
    p("contents", "string", "Full file contents to write", true),
    p("mode", '"replace" | "append"', "Whether the write replaces the file or appends"),
  ]),
  t("search_files", "workspace", "low", "Find files and lines matching a pattern", "Match[]", [
    p("pattern", "string", "Regular expression to match", true),
    p("glob", "string", "Restrict the walk, for example src/**/*.ts"),
  ]),
  t("fetch_url", "web", "low", "Fetch a page and return it as readable text", "Page", [
    p("url", "string", "Absolute https URL to fetch", true),
    p("timeout_ms", "number", "Give up after this many milliseconds"),
  ]),
  t("browser_click", "web", "high", "Click an element in the shared browser session", "void", [
    p("selector", "string", "CSS selector for the target element", true),
    p("wait_ms", "number", "Settle time before the next action"),
  ]),
  t("run_command", "shell", "high", "Run a shell command in the task sandbox", "ProcessHandle", [
    p("command", "string", "Command line to execute", true),
    p("cwd", "string", "Working directory, defaults to the workspace root"),
    p("timeout_ms", "number", "Kill the process after this many milliseconds"),
  ]),
  t("list_issues", "issues", "low", "List issues assigned to the current team", "Issue[]", [
    p("state", '"open" | "closed"', "Which issues to return"),
    p("assignee", "string", "Filter to one teammate"),
  ]),
  t("update_issue", "issues", "medium", "Change an issue state, assignee or labels", "Issue", [
    p("issue_id", "string", "Issue key, for example ENG-412", true),
    p("state", '"open" | "closed"', "New state for the issue"),
    p("labels", "string[]", "Replaces the label set when present"),
  ]),
  t("query_warehouse", "data", "medium", "Run a read-only SQL query and return rows", "Rows", [
    p("sql", "string", "Read-only SQL statement", true),
    p("limit", "number", "Maximum rows to return"),
  ]),
  t("export_csv", "data", "high", "Write a previous query result to the workspace", "string", [
    p("query_id", "string", "Handle returned by query_warehouse", true),
    p("path", "string", "Destination path inside the workspace", true),
  ]),
];

const REFERENCED = ["read_file", "write_file", "run_command", "query_warehouse"];

const INITIAL = [
  "read_file",
  "search_files",
  "fetch_url",
  "list_issues",
  "query_warehouse",
  "export_csv",
];

export default function Demo() {
  const [enabled, setEnabled] = useState<string[]>(INITIAL);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <ToolRegistry
        tools={TOOLS}
        referenced={REFERENCED}
        enabled={enabled}
        onEnabledChange={setEnabled}
        subtitle="Planner · run 4f21c8"
      />
    </div>
  );
}