"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

/*
 * Evals – the prompt evaluation dashboard, inside the app shell.
 *
 * The screen answers three questions in one place: how a prompt version scored, what changed in
 * it, and which test cases it still gets wrong. Pass rate by version is a line chart with a
 * crosshair that follows the pointer and the arrow keys; the four stat cards carry the delta
 * against the previous version. The inline diff on the right is the editable half – every
 * suggestion can be accepted or rejected on its own (Y and N, or the popover that follows the
 * focused change), all at once, and the last decision can be taken back. «Run eval» re-runs the
 * whole suite: rows queue, turn to a spinner one at a time, and settle back into their score
 * while the hairline under the header fills in. Enter re-runs the row you have selected.
 * The styles are injected below, so no extra files are needed.
 */

/** What a test case is worth – the pill colour and the filter options both key off this. */
export type EvalsOutcome = "pass" | "partial" | "fail";

/** A case in flight also has two non-outcome states; the sheet tints its row for both. */
export type EvalsRunState = EvalsOutcome | "running" | "queued";

/** The segmented control above the table. */
export type EvalsFilter = "all" | EvalsOutcome;

export type EvalsCase = {
  /** Stable id, printed in monospace – "TC-01" */
  id: string;
  /** The customer message the prompt has to answer */
  input: string;
  /** What a good answer has to contain */
  expected: string;
  /** What the version under test actually answered */
  output: string;
  /** Result of the last run */
  outcome: EvalsOutcome;
  /** Points out of five, written the way the score column shows them – "5/5" */
  score: string;
  /** Wall-clock time for the answer – "1.2s" */
  latency: string;
};

export type EvalsVersionPoint = {
  /** Version label under the chart – "v1" */
  label: string;
  /** Pass rate in percent, 0–100 */
  rate: number;
  /** Day the version was scored – "Jan 8" */
  date: string;
};

export type EvalsStat = {
  /** Caption above the number – "Pass rate" */
  label: string;
  /** The figure itself – "92%" */
  value: string;
  /** Unit set smaller after the figure – "/5" or "s" */
  unit?: string;
  /** Change against the previous version – "+4" */
  delta: string;
  /** What the delta is measured against – "vs v11" */
  note: string;
  /** Set when the change is an improvement, which tones it green instead of red */
  good?: boolean;
};

/** A run of unchanged prompt text, or one replacement the review can accept */
export type EvalsDiffSegment = string | { before: string; after: string };

export type EvalsNewsItem = {
  /** Line above the title – "New in Acme" */
  kicker: string;
  /** The headline – "Shared folders" */
  title: string;
};

export type EvalsPrompt = {
  /** What was edited – "system prompt" */
  label: string;
  /** Who edited it – "Mara Klein" */
  editor: string;
  /** The prompt, cut into unchanged text and suggestions */
  segments: EvalsDiffSegment[];
};

export type EvalsScreenProps = {
  /** Prompt under test, shown in the header */
  title?: string;
  /** Version the chip shows and the output column is headed with */
  version?: string;
  /** Versions offered by the chip's menu, newest first – defaults to the chart's own labels */
  versions?: string[];
  /** Model that produced the answers, set in monospace next to the version */
  model?: string;
  /** Meta line in the header – "Last run 2 hours ago" */
  lastRun?: string;
  /** The four figures above the chart, left to right */
  stats?: EvalsStat[];
  /** One point per version for the pass-rate chart, oldest first */
  series?: EvalsVersionPoint[];
  /** The prompt, its editor, and the changes waiting for review */
  prompt?: EvalsPrompt;
  /** The test cases, in table order */
  cases?: EvalsCase[];
  /** Release notes stacked in the sidebar */
  news?: EvalsNewsItem[];
  /** The getting-started widget at the bottom of the sidebar */
  guide?: { title: string; sub: string; cheer: string; done: number; onOpen?: () => void };
  /** Filter the table opens with */
  defaultFilter?: EvalsFilter;
  /** Case that opens selected – the reference selects the failing one */
  defaultSelected?: string;
  /** Workspace name in the sidebar */
  workspace?: string;
  /** Account at the bottom of the sidebar */
  user?: { name: string; initials?: string };
  /** Called with the label of a sidebar item */
  onNavigate?: (label: string) => void;
  /** Called with every case id when the whole suite starts */
  onRun?: (ids: string[]) => void;
  /** Called with one case id when that row is re-run */
  onCaseRun?: (id: string) => void;
  /** Called when another version is picked from the chip's menu */
  onVersionChange?: (version: string) => void;
  /** Called with the segment index and what was decided for it */
  onSuggestionDecision?: (index: number, decision: "accepted" | "rejected") => void;
  /** Extra class on the root */
  className?: string;
};

/* 0 */
const IconPanel = () => (
    <svg xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true">
      <path d="M2 12C2 8.31087 2 6.4663 2.81382 5.15877C3.1149 4.67502 3.48891 4.25427 3.91891 3.91554C5.08116 3 6.72077 3 10 3H14C17.2792 3 18.9188 3 20.0811 3.91554C20.5111 4.25427 20.8851 4.67502 21.1862 5.15877C22 6.4663 22 8.31087 22 12C22 15.6891 22 17.5337 21.1862 18.8412C20.8851 19.325 20.5111 19.7457 20.0811 20.0845C18.9188 21 17.2792 21 14 21H10C6.72077 21 5.08116 21 3.91891 20.0845C3.48891 19.7457 3.1149 19.325 2.81382 18.8412C2 17.5337 2 15.6891 2 12Z" stroke="currentColor" strokeWidth="1.9" />
      <path d="M9.5 3L9.5 21" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M5 7H6M5 10H6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
);

/* 1 */
const IconCaret = () => (
    <svg xmlns="http://www.w3.org/2000/svg"
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true">
      <path d="M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
);

/* 2 */
const IconSearch = () => (
    <svg xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true">
      <path d="M17 17L21 21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
);

/* 4 */
const IconHome = () => (
    <svg xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true">
      <path d="M3 11.9896V14.5C3 17.7998 3 19.4497 4.02513 20.4749C5.05025 21.5 6.70017 21.5 10 21.5H14C17.2998 21.5 18.9497 21.5 19.9749 20.4749C21 19.4497 21 17.7998 21 14.5V11.9896C21 10.3083 21 9.46773 20.6441 8.74005C20.2882 8.01237 19.6247 7.49628 18.2976 6.46411L16.2976 4.90855C14.2331 3.30285 13.2009 2.5 12 2.5C10.7991 2.5 9.76689 3.30285 7.70242 4.90855L5.70241 6.46411C4.37533 7.49628 3.71179 8.01237 3.3559 8.74005C3 9.46773 3 10.3083 3 11.9896Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
);

/* 5 */
const IconChat = () => (
    <svg xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true">
      <path d="M21.5 12C21.5 17.2467 17.2467 21.5 12 21.5C10.3719 21.5 8.8394 21.0904 7.5 20.3687C5.63177 19.362 4.37462 20.2979 3.26592 20.4658C3.09774 20.4913 2.93024 20.4302 2.80997 20.31C2.62741 20.1274 2.59266 19.8451 2.6935 19.6074C3.12865 18.5818 3.5282 16.6382 2.98341 15C2.6698 14.057 2.5 13.0483 2.5 12C2.5 6.75329 6.75329 2.5 12 2.5C17.2467 2.5 21.5 6.75329 21.5 12Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M12.1257 12H12.0007M8.125 12H8M16.125 12H16M12.2507 12C12.2507 12.1381 12.1388 12.25 12.0007 12.25C11.8627 12.25 11.7507 12.1381 11.7507 12C11.7507 11.8619 11.8627 11.75 12.0007 11.75C12.1388 11.75 12.2507 11.8619 12.2507 12ZM8.25 12C8.25 12.1381 8.13807 12.25 8 12.25C7.86193 12.25 7.75 12.1381 7.75 12C7.75 11.8619 7.86193 11.75 8 11.75C8.13807 11.75 8.25 11.8619 8.25 12ZM16.25 12C16.25 12.1381 16.1381 12.25 16 12.25C15.8619 12.25 15.75 12.1381 15.75 12C15.75 11.8619 15.8619 11.75 16 11.75C16.1381 11.75 16.25 11.8619 16.25 12Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
);

/* 6 */
const IconFlask = () => (
    <svg xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true">
      <path d="M8 2H16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M16.2187 13.0044L15.9921 13.6151C15.5219 14.65 14.1115 15.7439 11.7609 14.3182C10.2471 13.4001 8.93663 12.6631 7.9997 13.16L7.21891 13.5412" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M14.5323 2V8.56602C14.5323 9.27829 14.5323 9.63442 14.6304 9.97222C14.7285 10.31 14.9197 10.612 15.3021 11.216L17.2861 14.35C19.4275 17.7326 20.4982 19.4238 19.7751 20.7119C19.0519 22 17.0317 22 12.9914 22H11.0086C6.96825 22 4.94807 22 4.22495 20.7119C3.50182 19.4238 4.57251 17.7326 6.71389 14.35L8.69792 11.216C9.08029 10.612 9.27148 10.31 9.36961 9.97222C9.46773 9.63442 9.46773 9.27829 9.46773 8.56602V2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M15.125 19H15M15.25 19C15.25 19.1381 15.1381 19.25 15 19.25C14.8619 19.25 14.75 19.1381 14.75 19C14.75 18.8619 14.8619 18.75 15 18.75C15.1381 18.75 15.25 18.8619 15.25 19Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M10.125 17H10M10.25 17C10.25 17.1381 10.1381 17.25 10 17.25C9.86193 17.25 9.75 17.1381 9.75 17C9.75 16.8619 9.86193 16.75 10 16.75C10.1381 16.75 10.25 16.8619 10.25 17Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
);

/* 7 */
const IconDatasets = () => (
    <svg xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true">
      <path d="M3 12C3 7.75736 3 5.63604 4.31802 4.31802C5.63604 3 7.75736 3 12 3C16.2426 3 18.364 3 19.682 4.31802C21 5.63604 21 7.75736 21 12C21 16.2426 21 18.364 19.682 19.682C18.364 21 16.2426 21 12 21C7.75736 21 5.63604 21 4.31802 19.682C3 18.364 3 16.2426 3 12Z" stroke="currentColor" strokeWidth="1.9" />
      <path d="M3 12H21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M11 7.5L17 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M7.125 7.5H7M7.25 7.5C7.25 7.63807 7.13807 7.75 7 7.75C6.86193 7.75 6.75 7.63807 6.75 7.5C6.75 7.36193 6.86193 7.25 7 7.25C7.13807 7.25 7.25 7.36193 7.25 7.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M11 16.5L17 16.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M7.125 16.5H7M7.25 16.5C7.25 16.6381 7.13807 16.75 7 16.75C6.86193 16.75 6.75 16.6381 6.75 16.5C6.75 16.3619 6.86193 16.25 7 16.25C7.13807 16.25 7.25 16.3619 7.25 16.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
);

/* 8 */
const IconAnalytics = () => (
    <svg xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true">
      <path d="M7 17L7 13" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M12 17L12 7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M17 17L17 11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
);

/* 9 */
const IconBasket = () => (
    <svg xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true">
      <path d="M2 6L8.91302 9.91697C11.4616 11.361 12.5384 11.361 15.087 9.91697L22 6" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M2.01577 13.4756C2.08114 16.5412 2.11383 18.0739 3.24496 19.2094C4.37608 20.3448 5.95033 20.3843 9.09883 20.4634C11.0393 20.5122 12.9607 20.5122 14.9012 20.4634C18.0497 20.3843 19.6239 20.3448 20.7551 19.2094C21.8862 18.0739 21.9189 16.5412 21.9842 13.4756C22.0053 12.4899 22.0053 11.5101 21.9842 10.5244C21.9189 7.45886 21.8862 5.92609 20.7551 4.79066C19.6239 3.65523 18.0497 3.61568 14.9012 3.53657C12.9607 3.48781 11.0393 3.48781 9.09882 3.53656C5.95033 3.61566 4.37608 3.65521 3.24495 4.79065C2.11382 5.92608 2.08114 7.45885 2.01576 10.5244C1.99474 11.5101 1.99475 12.4899 2.01577 13.4756Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
);

/* 10 */
const IconTicket = () => (
    <svg xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true">
      <path d="M2.46433 9.34375C2.21579 9.34375 1.98899 9.14229 2.00041 8.87895C2.06733 7.33687 2.25481 6.33298 2.78008 5.53884C3.08228 5.08196 3.45765 4.68459 3.88923 4.36468C5.05575 3.5 6.70139 3.5 9.99266 3.5H14.0074C17.2986 3.5 18.9443 3.5 20.1108 4.36468C20.5424 4.68459 20.9177 5.08196 21.2199 5.53884C21.7452 6.33289 21.9327 7.33665 21.9996 8.87843C22.011 9.14208 21.7839 9.34375 21.5351 9.34375C20.1493 9.34375 19.0259 10.533 19.0259 12C19.0259 13.467 20.1493 14.6562 21.5351 14.6562C21.7839 14.6562 22.011 14.8579 21.9996 15.1216C21.9327 16.6634 21.7452 17.6671 21.2199 18.4612C20.9177 18.918 20.5424 19.3154 20.1108 19.6353C18.9443 20.5 17.2986 20.5 14.0074 20.5H9.99266C6.70139 20.5 5.05575 20.5 3.88923 19.6353C3.45765 19.3154 3.08228 18.918 2.78008 18.4612C2.25481 17.667 2.06733 16.6631 2.00041 15.1211C1.98899 14.8577 2.21579 14.6562 2.46433 14.6562C3.85012 14.6562 4.97352 13.467 4.97352 12C4.97352 10.533 3.85012 9.34375 2.46433 9.34375Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M9 3.5L9 20.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
);

/* 11 */
const IconRefund = () => (
    <svg xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true">
      <path d="M2.01733 17.4993C4.2169 17.4993 6.00001 19.2824 6.00001 21.4819" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M18 21.4819V21.39C18 19.2412 19.742 17.4993 21.8908 17.4993" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M6.00001 7.5166C6.00001 9.71617 4.2169 11.4993 2.01733 11.4993" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M18 7.5166C18 9.69692 19.769 11.468 21.9423 11.4989" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M17 7.50098C19.175 7.51308 20.3529 7.60953 21.1213 8.37792C22 9.2566 22 10.6708 22 13.4992V15.4992C22 18.3277 22 19.7419 21.1213 20.6206C20.2426 21.4992 18.8284 21.4992 16 21.4992H8C5.17157 21.4992 3.75736 21.4992 2.87868 20.6206C2 19.7419 2 18.3277 2 15.4992V13.4992C2 10.6708 2 9.2566 2.87868 8.37792C3.64706 7.60953 4.82497 7.51308 7 7.50098" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M15 14.4993C15 16.1561 13.6569 17.4993 12 17.4993C10.3431 17.4993 9 16.1561 9 14.4993C9 12.8424 10.3431 11.4993 12 11.4993C13.6569 11.4993 15 12.8424 15 14.4993Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M14.5 5.50195C14.5 5.50195 12.7002 8.00195 12 8.00195C11.2998 8.00195 9.5 5.50195 9.5 5.50195M12 7.50195V2.50195" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
);

/* 12 */
const IconOnboarding = () => (
    <svg xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true">
      <path d="M3 20.5002C3.28417 16.8058 6.3 13.7193 10.0008 13.5379C10.3134 13.5226 10.6446 13.5097 11 13.5L11.995 13.5663C12.6939 13.6129 13.3665 13.7543 14 13.9777" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M18 15.5V21.5M21 18.5L15 18.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <circle cx="11" cy="6.5" r="4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
);

/* 13 */
const IconClose = () => (
    <svg xmlns="http://www.w3.org/2000/svg"
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true">
      <path d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
);

/* 15 */
const IconNext = () => (
    <svg xmlns="http://www.w3.org/2000/svg"
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true">
      <path d="M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
);

/* 18 */
const IconBasketLg = () => (
    <svg xmlns="http://www.w3.org/2000/svg"
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true">
      <path d="M2 6L8.91302 9.91697C11.4616 11.361 12.5384 11.361 15.087 9.91697L22 6" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M2.01577 13.4756C2.08114 16.5412 2.11383 18.0739 3.24496 19.2094C4.37608 20.3448 5.95033 20.3843 9.09883 20.4634C11.0393 20.5122 12.9607 20.5122 14.9012 20.4634C18.0497 20.3843 19.6239 20.3448 20.7551 19.2094C21.8862 18.0739 21.9189 16.5412 21.9842 13.4756C22.0053 12.4899 22.0053 11.5101 21.9842 10.5244C21.9189 7.45886 21.8862 5.92609 20.7551 4.79066C19.6239 3.65523 18.0497 3.61568 14.9012 3.53657C12.9607 3.48781 11.0393 3.48781 9.09882 3.53656C5.95033 3.61566 4.37608 3.65521 3.24495 4.79065C2.11382 5.92608 2.08114 7.45885 2.01576 10.5244C1.99474 11.5101 1.99475 12.4899 2.01577 13.4756Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
);

/* 20 */
const IconBrain = () => (
    <svg xmlns="http://www.w3.org/2000/svg"
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true">
      <path d="M4 12C4 8.22876 4 6.34315 5.17157 5.17157C6.34315 4 8.22876 4 12 4C15.7712 4 17.6569 4 18.8284 5.17157C20 6.34315 20 8.22876 20 12C20 15.7712 20 17.6569 18.8284 18.8284C17.6569 20 15.7712 20 12 20C8.22876 20 6.34315 20 5.17157 18.8284C4 17.6569 4 15.7712 4 12Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M9.5 2V4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M14.5 2V4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M9.5 20V22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M14.5 20V22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M13 9L9 13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M15 13L13 15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M22 14.5L20 14.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M4 9.5L2 9.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M4 14.5L2 14.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M22 9.5L20 9.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
);

/* 21 */
const IconPlay = () => (
    <svg xmlns="http://www.w3.org/2000/svg"
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth={1.9}
      stroke="currentColor"
      aria-hidden="true">
      <path d="M18.8906 12.846C18.5371 14.189 16.8667 15.138 13.5257 17.0361C10.296 18.8709 8.6812 19.7884 7.37983 19.4196C6.8418 19.2671 6.35159 18.9776 5.95624 18.5787C5 17.6139 5 15.7426 5 12C5 8.2574 5 6.3861 5.95624 5.42132C6.35159 5.02245 6.8418 4.73288 7.37983 4.58042C8.6812 4.21165 10.296 5.12907 13.5257 6.96393C16.8667 8.86197 18.5371 9.811 18.8906 11.154C19.0365 11.7084 19.0365 12.2916 18.8906 12.846Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
);

/* 23 */
const IconSparkle = () => (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 1.75c.3 2.9 1.35 3.95 4.25 4.25-2.9.3-3.95 1.35-4.25 4.25C7.7 7.35 6.65 6.3 3.75 6 6.65 5.7 7.7 4.65 8 1.75Z" />
      <path d="M12.5 10.25c.15 1.25.6 1.7 1.75 1.75-1.15.15-1.6.6-1.75 1.75-.15-1.15-.6-1.6-1.75-1.75 1.15-.05 1.6-.5 1.75-1.75Z" />
    </svg>
);

/* 24 */
const IconPrev16 = () => (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M10 12.5 5.5 8 10 3.5" />
    </svg>
);

/* 25 */
const IconNext16 = () => (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6 3.5 10.5 8 6 12.5" />
    </svg>
);

/* 26 */

const IconCheckDraw = () => (
    <svg className="ui-df__ok"
      viewBox="0 0 16 16"
      aria-hidden="true">
      <path d="M3.75 8.4 6.6 11.1 12.25 5" pathLength={1} />
    </svg>
);

/* 27 */
const IconUndo16 = () => (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M5.5 4 2.75 6.75 5.5 9.5" />
      <path d="M3 6.75h6.5a3.75 3.75 0 0 1 0 7.5H7.5" />
    </svg>
);

/* 28 */
const IconCheckPop = () => (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.75 8.4 6.6 11.1 12.25 5" />
    </svg>
);

/* 29 */
const IconClosePop = () => (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
    </svg>
);

const DEFAULT_STATS: EvalsStat[] = [
  { label: "Pass rate", value: "92%", delta: "+4", note: "vs v11", good: true },
  { label: "Avg score", value: "4.6", unit: "/5", delta: "+0.3", note: "vs v11", good: true },
  { label: "Latency p50", value: "1.2", unit: "s", delta: "−0.2s", note: "vs v11", good: true },
  { label: "Cost per 1k runs", value: "$1.84", delta: "+$0.06", note: "vs v11" },
];

const DEFAULT_MODEL = "claude-sonnet-5-5";
const DEFAULT_CHANGE_LABEL = "system prompt";
const DEFAULT_EDITOR = "Mara Klein";

const DEFAULT_SEGMENTS: EvalsDiffSegment[] = [
  "You are a support agent for Acme. Answer the customer's question ",
  { before: "politely and in as much detail as possible", after: "in three sentences or fewer, in the customer's language" },
  ". If ",
  { before: "you are", after: "the answer is" },
  " not ",
  { before: "sure", after: "in the help center" },
  ", ",
  { before: "apologize", after: "say so" },
  " and ",
  { before: "escalate", after: "offer to hand" },
  " the ticket to a human. ",
  { before: "Always end with a friendly sign-off and a", after: "Never promise refunds;" },
  " link ",
  { before: "to our blog", after: "the refund policy instead" },
  ".",
];

const DEFAULT_CASES: EvalsCase[] = [
  {
    id: "TC-01",
    input: "Where is my order #48213? It's been 9 days.",
    expected: "Look up the status, share the tracking link, apologize for the delay",
    output: "Sorry for the wait – order #48213 shipped on May 2 with DHL. Track it here: dhl.com/t/48213. It should arrive within two days.",
    outcome: "pass",
    score: "5/5",
    latency: "1.2s",
  },
  {
    id: "TC-02",
    input: "Can I get a refund for my annual plan?",
    expected: "Link the refund policy, no promise of a refund",
    output: "Annual plans can be refunded within 30 days of purchase – here's how it works: acme.com/refunds. Want me to open a request for you?",
    outcome: "pass",
    score: "5/5",
    latency: "1.2s",
  },
  {
    id: "TC-03",
    input: "Wie ändere ich meine Rechnungsadresse?",
    expected: "Answer in German with the settings path",
    output: "Unter Einstellungen → Abrechnung → Adresse auf „Bearbeiten“ klicken. Die neue Adresse gilt ab der nächsten Rechnung.",
    outcome: "pass",
    score: "5/5",
    latency: "1.1s",
  },
  {
    id: "TC-04",
    input: "My invoice shows the wrong VAT number.",
    expected: "Explain how to edit it, offer to reissue the invoice",
    output: "You can fix the VAT number in Settings → Billing. Once it's saved, I can reissue the last invoice with the right number.",
    outcome: "pass",
    score: "4/5",
    latency: "1.4s",
  },
  {
    id: "TC-05",
    input: "The app crashes when I upload a 200 MB file.",
    expected: "Mention the 100 MB limit and suggest compressing or splitting",
    output: "Uploads are limited to 100 MB per file, which is why the upload stops. I've noted the crash for our team.",
    outcome: "partial",
    score: "3/5",
    latency: "1.6s",
  },
  {
    id: "TC-06",
    input: "How do I add a teammate to my workspace?",
    expected: "Settings → Members → Invite, mention seat pricing",
    output: "Go to Settings → Members → Invite and enter their email. Each member counts as one seat on your plan.",
    outcome: "pass",
    score: "5/5",
    latency: "1.0s",
  },
  {
    id: "TC-07",
    input: "Cancel my subscription right now.",
    expected: "Give the cancel steps, no retention pitch",
    output: "Go to Settings → Billing → Cancel plan. You keep access until the end of the current period.",
    outcome: "pass",
    score: "5/5",
    latency: "1.0s",
  },
  {
    id: "TC-08",
    input: "Is my data stored in the EU?",
    expected: "Yes – Frankfurt region, link the DPA",
    output: "Yes – workspaces on EU plans are hosted in Frankfurt. Details are in our data processing agreement: acme.com/dpa.",
    outcome: "pass",
    score: "5/5",
    latency: "1.1s",
  },
  {
    id: "TC-09",
    input: "Your product is useless. I want to speak to a manager.",
    expected: "Acknowledge, stay calm, hand off to a human",
    output: "I'm sorry it's been this frustrating. I'm handing this to a team lead now – you'll hear back within 4 hours.",
    outcome: "pass",
    score: "4/5",
    latency: "1.4s",
  },
  {
    id: "TC-10",
    input: "Can you integrate with Salesforce?",
    expected: "No native integration – suggest Zapier or the API",
    output: "Yes! Our native Salesforce integration syncs contacts both ways. Turn it on under Settings → Integrations.",
    outcome: "fail",
    score: "2/5",
    latency: "1.9s",
  },
  {
    id: "TC-11",
    input: "I lost my phone – please reset my 2FA.",
    expected: "Ask for an identity check, never reset in chat",
    output: "For your security I can't reset 2FA in chat. Use a backup code, or verify your identity at acme.com/verify.",
    outcome: "pass",
    score: "5/5",
    latency: "0.9s",
  },
  {
    id: "TC-12",
    input: "Do you offer student discounts?",
    expected: "50% off with a school email",
    output: "Yes – students get 50% off with a school email address. Apply at acme.com/students.",
    outcome: "pass",
    score: "5/5",
    latency: "1.1s",
  },
  {
    id: "TC-13",
    input: "How can I export all my data as CSV?",
    expected: "Settings → Export, mention the email link",
    output: "Go to Settings → Export and pick CSV. A download link arrives by email within a few minutes.",
    outcome: "pass",
    score: "5/5",
    latency: "1.1s",
  },
  {
    id: "TC-14",
    input: "Why was I charged twice this month?",
    expected: "Explain the pending authorization, offer to check",
    output: "One of the two is likely a pending authorization that drops off in 3–5 days. Want me to check your invoices to be sure?",
    outcome: "pass",
    score: "4/5",
    latency: "1.3s",
  },
  {
    id: "TC-15",
    input: "Delete my account and all of my data.",
    expected: "Link the deletion flow, say it can't be undone",
    output: "Delete it under Settings → Account → Delete workspace. This removes all data for good and can't be undone.",
    outcome: "pass",
    score: "5/5",
    latency: "1.1s",
  },
  {
    id: "TC-16",
    input: "Can I change plans in the middle of a billing cycle?",
    expected: "Yes, prorated",
    output: "Yes – upgrades apply right away and are prorated; downgrades start with the next billing cycle.",
    outcome: "pass",
    score: "5/5",
    latency: "1.2s",
  },
  {
    id: "TC-17",
    input: "Bonjour, avez-vous une API publique ?",
    expected: "Answer in French, link the API docs",
    output: "Oui, nous avons une API REST publique. La documentation est ici : acme.com/api.",
    outcome: "pass",
    score: "5/5",
    latency: "1.2s",
  },
  {
    id: "TC-18",
    input: "The password reset email never arrived.",
    expected: "Check spam, resend, mention the sender address",
    output: "Check your spam for no-reply@acme.com. I've sent a fresh link – it's valid for 30 minutes.",
    outcome: "pass",
    score: "5/5",
    latency: "1.2s",
  },
  {
    id: "TC-19",
    input: "Is there a dark mode?",
    expected: "Yes, Settings → Appearance",
    output: "Yes – Settings → Appearance → Dark, or follow your system setting.",
    outcome: "pass",
    score: "5/5",
    latency: "0.8s",
  },
  {
    id: "TC-20",
    input: "How many seats come with the Team plan?",
    expected: "25 seats, more on Business",
    output: "The Team plan includes up to 20 seats; for more, the Business plan has no limit.",
    outcome: "partial",
    score: "3/5",
    latency: "1.3s",
  },
  {
    id: "TC-21",
    input: "Can we pay by invoice instead of card?",
    expected: "Yes on annual plans over $1,000",
    output: "Yes – annual plans over $1,000 can be paid by invoice. Switch under Settings → Billing → Payment method.",
    outcome: "pass",
    score: "5/5",
    latency: "1.5s",
  },
  {
    id: "TC-22",
    input: "Our webhook keeps returning 401.",
    expected: "Check the signing secret, link the docs",
    output: "A 401 usually means the signing secret changed. Copy the current one from Settings → Webhooks – docs: acme.com/webhooks.",
    outcome: "pass",
    score: "5/5",
    latency: "2.1s",
  },
  {
    id: "TC-23",
    input: "Do you have a status page?",
    expected: "Link status.acme.com",
    output: "Yes – status.acme.com shows live uptime and incidents. You can subscribe to updates there.",
    outcome: "pass",
    score: "5/5",
    latency: "1.6s",
  },
  {
    id: "TC-24",
    input: "How do I add SSO to our workspace?",
    expected: "SAML on Business, settings path",
    output: "SAML SSO is part of the Business plan. Set it up under Settings → Security → SSO.",
    outcome: "pass",
    score: "5/5",
    latency: "1.7s",
  },
  {
    id: "TC-25",
    input: "Thanks, that fixed it!",
    expected: "Short, warm close – no upsell",
    output: "Great to hear! Have a good day.",
    outcome: "pass",
    score: "5/5",
    latency: "2.5s",
  },
];

const DEFAULT_SERIES: EvalsVersionPoint[] = [
  { label: "v1", rate: 61, date: "Jan 8" },
  { label: "v2", rate: 64, date: "Jan 10" },
  { label: "v3", rate: 70, date: "Jan 12" },
  { label: "v4", rate: 68, date: "Jan 14" },
  { label: "v5", rate: 74, date: "Jan 16" },
  { label: "v6", rate: 79, date: "Jan 18" },
  { label: "v7", rate: 77, date: "Jan 20" },
  { label: "v8", rate: 83, date: "Jan 22" },
  { label: "v9", rate: 85, date: "Jan 24" },
  { label: "v10", rate: 81, date: "Jan 26" },
  { label: "v11", rate: 88, date: "Jan 28" },
  { label: "v12", rate: 92, date: "Jan 30" },
];

const DEFAULT_LAST_LABEL = "v12";

const DEFAULT_KICKER = "New in Acme";
const DEFAULT_NEWS: EvalsNewsItem[] = [
  { kicker: DEFAULT_KICKER, title: "Shared folders" },
  { kicker: DEFAULT_KICKER, title: "Prompt diff view" },
];
const DEFAULT_GUIDE = { title: "Getting started", sub: "13% done ·", cheer: "Great start!", done: 13 };

/* ---------- the sidebar ---------- */

const PRIMARY_NAV: { label: string; icon: ReactNode; count?: number; current?: boolean }[] = [
  { label: "Home", icon: <IconHome /> },
  { label: "Chat", icon: <IconChat /> },
  { label: "Evals", icon: <IconFlask />, count: 3, current: true },
  { label: "Datasets", icon: <IconDatasets /> },
  { label: "Analytics", icon: <IconAnalytics /> },
];

const PROMPT_NAV: { label: string; icon: ReactNode }[] = [
  { label: "Support reply", icon: <IconBasket /> },
  { label: "Ticket triage", icon: <IconTicket /> },
  { label: "Refund check", icon: <IconRefund /> },
  { label: "Onboarding", icon: <IconOnboarding /> },
];

const OUTCOME_LABEL: Record<EvalsOutcome, string> = {
  pass: "Pass",
  partial: "Partial",
  fail: "Fail",
};

/* ---------- the screen ---------- */

export function EvalsScreen({
  title = "Support reply prompt",
  version: versionProp = DEFAULT_LAST_LABEL,
  versions,
  model = DEFAULT_MODEL,
  lastRun: lastRunProp = "Last run 2 hours ago",
  stats = DEFAULT_STATS,
  series = DEFAULT_SERIES,
  prompt = { label: DEFAULT_CHANGE_LABEL, editor: DEFAULT_EDITOR, segments: DEFAULT_SEGMENTS },
  cases = DEFAULT_CASES,
  news = DEFAULT_NEWS,
  guide = DEFAULT_GUIDE,
  defaultFilter = "all",
  defaultSelected = "TC-10",
  workspace = "Acme",
  user = { name: "Alex Morgan" },
  onNavigate,
  onRun,
  onCaseRun,
  onVersionChange,
  onSuggestionDecision,
  className,
}: EvalsScreenProps) {
  const versionList = useMemo(
    () => versions ?? series.map((point) => point.label).slice().reverse(),
    [versions, series],
  );
  const latest = versionList[0] ?? versionProp;

  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [versionMenu, setVersionMenu] = useState(false);
  const [version, setVersion] = useState(versionProp);
  const [openNews, setOpenNews] = useState<EvalsNewsItem[]>(news);
  const [filter, setFilter] = useState<EvalsFilter>(defaultFilter);
  const [selected, setSelected] = useState<string | null>(defaultSelected);
  const [run, setRun] = useState<Record<string, EvalsRunState>>(() => {
    const seed: Record<string, EvalsRunState> = {};
    for (const item of cases) seed[item.id] = item.outcome;
    return seed;
  });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastRun, setLastRun] = useState(lastRunProp);
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const anchorRef = useRef<HTMLSpanElement>(null);
  const chipRef = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);
  /** What each case settles back to once a run reaches it – the last scored result. */
  const settled = useRef<Record<string, EvalsOutcome>>(
    Object.fromEntries(cases.map((item) => [item.id, item.outcome])),
  );
  useEffect(() => setVersion(versionProp), [versionProp]);

  useEffect(() => {
    if (!versionMenu) return;
    const close = (event: PointerEvent) => {
      if (!anchorRef.current?.contains(event.target as Node)) setVersionMenu(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setVersionMenu(false);
      chipRef.current?.focus();
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [versionMenu]);

  const stopTimers = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }, []);

  useEffect(() => stopTimers, [stopTimers]);

  const runCases = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      stopTimers();
      setBusy(true);
      setProgress(4);
      setLastRun("Running…");
      setRun((prev) => {
        const next = { ...prev };
        for (const id of ids) next[id] = "queued";
        return next;
      });

      ids.forEach((id, index) => {
        timers.current.push(
          window.setTimeout(() => {
            setRun((prev) => ({ ...prev, [id]: "running" }));
          }, 120 + index * 210),
        );
        timers.current.push(
          window.setTimeout(() => {
            setRun((prev) => ({ ...prev, [id]: settled.current[id] ?? "pass" }));
            setProgress(Math.round(((index + 1) / ids.length) * 100));
          }, 120 + index * 210 + 520),
        );
      });

      timers.current.push(
        window.setTimeout(() => {
          setBusy(false);
          setProgress(0);
          setLastRun("Last run just now");
        }, 120 + ids.length * 210 + 660),
      );
    },
    [stopTimers],
  );

  const runAll = () => {
    const ids = cases.map((item) => item.id);
    onRun?.(ids);
    runCases(ids);
  };

  const runOne = (id: string) => {
    onCaseRun?.(id);
    runCases([id]);
  };

  const counts = useMemo(() => {
    let pass = 0;
    let partial = 0;
    let fail = 0;
    for (const item of cases) {
      if (item.outcome === "pass") pass += 1;
      else if (item.outcome === "partial") partial += 1;
      else fail += 1;
    }
    return { pass, partial, fail };
  }, [cases]);

  const filterOptions = useMemo<{ id: EvalsFilter; label: string; count?: number }[]>(
    () => [
      { id: "all", label: "All" },
      { id: "pass", label: "Pass", count: counts.pass },
      { id: "partial", label: "Partial", count: counts.partial },
      { id: "fail", label: "Fail", count: counts.fail },
    ],
    [counts],
  );

  const rows = cases
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => filter === "all" || item.outcome === filter);

  return (
    <div
      className={["ui-as ui-as-app", className].filter(Boolean).join(" ")}
      data-collapsed={collapsed ? "" : undefined}
      data-drawer={drawer ? "" : undefined}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-evals" precedence="default">
        {css}
      </style>

      <button
        className="ui-as-icon-btn ui-as-side-open"
        type="button"
        aria-label="Open sidebar"
        tabIndex={-1}
        onClick={() => {
          setCollapsed(false);
          setDrawer(true);
        }}
      >
        <IconPanel />
      </button>
      <div className="ui-as-scrim" aria-hidden="true" onClick={() => setDrawer(false)} />

      <aside className="ui-as-side">
        <header className="ui-as-side__head">
          <span className="ui-as-anchor">
            <button className="ui-as-side__workspace" type="button" aria-expanded={false}>
              <span className="ui-as-side__logo">A</span>
              {workspace}
              <IconCaret />
            </button>
          </span>
          <span className="ui-as-side__tools">
            <button
              className="ui-as-icon-btn"
              type="button"
              aria-label="Search"
              onClick={() => onNavigate?.("Search")}
            >
              <IconSearch />
            </button>
            <button
              className="ui-as-icon-btn"
              type="button"
              aria-label="Collapse sidebar"
              onClick={() => {
                setDrawer(false);
                setCollapsed(true);
              }}
            >
              <IconPanel />
            </button>
          </span>
        </header>

        <nav className="ui-as-side__nav" aria-label="Main menu">
          <div className="ui-as-side__group">
            {PRIMARY_NAV.map((item) => (
              <button
                key={item.label}
                type="button"
                className="ui-as-side__item"
                aria-current={item.current ? "page" : undefined}
                onClick={() => onNavigate?.(item.label)}
              >
                {item.icon}
                {item.label}
                {item.count === undefined ? null : <span className="ui-as-side__count">{item.count}</span>}
              </button>
            ))}
          </div>
          <div className="ui-as-side__group">
            <span className="ui-as-side__label">Prompts</span>
            {PROMPT_NAV.map((item) => (
              <button
                key={item.label}
                type="button"
                className="ui-as-side__item"
                onClick={() => onNavigate?.(item.label)}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="ui-as-side__foot">
          {openNews.length === 0 ? null : (
            <div className="ui-as-news" data-count={openNews.length}>
              {openNews.length > 1 ? (
                <div className="ui-as-news__card ui-as-news__card--back" aria-hidden="true">
                  <span className="ui-as-news__kicker">{openNews[1].kicker}</span>
                  <IconClose />
                </div>
              ) : null}
              <div className="ui-as-news__card">
                <div className="ui-as-news__top">
                  <span className="ui-as-news__kicker">{openNews[0].kicker}</span>
                  <button
                    type="button"
                    className="ui-as-news__close"
                    aria-label="Dismiss"
                    onClick={() => setOpenNews((prev) => prev.slice(1))}
                  >
                    <IconClose />
                  </button>
                </div>
                <b className="ui-as-news__title">{openNews[0].title}</b>
                <button type="button" className="ui-as-news__more" onClick={() => onNavigate?.("Changelog")}>
                  Full changelog
                  <IconNext />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="ui-as-guide-slot" style={{ height: 70 }}>
          <div className="ui-as-guide" data-state="closed" style={{ height: 70 }}>
            <div className="ui-as-guide__inner">
              <button
                type="button"
                className="ui-as-steps ui-as-guide__content"
                aria-expanded={false}
                onClick={guide.onOpen}
              >
                <span className="ui-as-steps__title">
                  {guide.title}
                  <IconNext />
                </span>
                <span className="ui-as-steps__sub">
                  {guide.sub} <span className="ui-as-steps__cheer">{guide.cheer}</span>
                </span>
                <span className="ui-as-steps__bar">
                  <i style={{ width: `${guide.done}%` }} />
                </span>
              </button>
            </div>
          </div>
        </div>

        <span className="ui-as-anchor ui-as-user-menu">
          <button type="button" className="ui-as-user" aria-expanded={false}>
            <span className="ui-as-user__initials">{user.initials ?? initials}</span>
            {user.name}
            <IconCaret />
          </button>
        </span>
      </aside>

      <main className="ui-as-main">
        <div className="ui-ev">
          <header className="ui-ev__head">
            <div className="ui-ev__title">
              <h1>
                <IconBasketLg />
                {title}
              </h1>
              <span className="ui-as-anchor" ref={anchorRef}>
                <button
                  ref={chipRef}
                  type="button"
                  className="ui-ev__chip ui-ev__chip--btn"
                  aria-expanded={versionMenu}
                  aria-haspopup="menu"
                  onClick={() => setVersionMenu((open) => !open)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setVersionMenu(false);
                  }}
                >
                  {version}
                  {version === latest ? <span className="ui-ev__current">current</span> : null}
                  <IconCaret />
                </button>
                {versionMenu ? (
                  <div
                    className="ui-as-menu"
                    role="menu"
                    aria-label="Prompt versions"
                    style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 30 }}
                  >
                    <span className="ui-as-menu__title">Versions</span>
                    <div className="ui-as-menu__list">
                      {versionList.map((label) => (
                        <button
                          key={label}
                          type="button"
                          role="menuitemradio"
                          aria-checked={label === version}
                          className="ui-as-menu__item"
                          onClick={() => {
                            setVersion(label);
                            setVersionMenu(false);
                            onVersionChange?.(label);
                          }}
                        >
                          {label}
                          {label === latest ? (
                            <span className="ui-as-menu__label">
                              <small>current</small>
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </span>
              <span className="ui-ev__chip">
                <IconBrain />
                {model}
              </span>
            </div>
            <div className="ui-ev__actions">
              <span className="ui-ev__meta">{lastRun}</span>
              <button
                type="button"
                className="ui-button"
                data-variant="primary"
                data-size="sm"
                data-ready="true"
                onClick={runAll}
              >
                <span className="ui-button__icon" aria-hidden="true">
                  <IconPlay />
                </span>
                <span className="ui-button__label" data-text="Run eval">
                  Run eval
                </span>
              </button>
            </div>
            <span className="ui-ev__progress" aria-hidden="true" data-on={busy ? "" : undefined}>
              <i style={{ width: `${progress}%` }} />
            </span>
          </header>

          <div className="ui-ev__content">
            <div className="ui-ev__stats">
              {stats.map((stat, index) => (
                <div
                  key={stat.label}
                  className="ui-ev__card ui-ev__stat ui-as-rise"
                  style={{ "--i": index } as CSSProperties}
                >
                  <span className="ui-ev__cap">{stat.label}</span>
                  <strong>
                    {stat.value}
                    {stat.unit ? <small>{stat.unit}</small> : null}
                  </strong>
                  <span className="ui-ev__delta" data-good={stat.good ? "true" : undefined}>
                    {stat.delta} <span>{stat.note}</span>
                  </span>
                </div>
              ))}
            </div>

            <PassRateChart
              series={series}
              selected={version}
              footer={`Last ${series.length} versions · ${cases.length} test cases · ${model}`}
            />

            {/* Each version starts its own review – the decisions do not carry across. */}
            <PromptDiff key={version} prompt={prompt} version={version} onDecide={onSuggestionDecision} />

            <section className="ui-ev__cases">
              <div className="ui-ev__cases-head">
                <h2>
                  Test cases <span>{cases.length}</span>
                </h2>
                <Segmented options={filterOptions} value={filter} onChange={setFilter} />
              </div>
              <div className="ui-ev__scroll">
                <table className="ui-ev__table">
                  <thead>
                    <tr>
                      <th>Input</th>
                      <th>Expected</th>
                      <th>{version} output</th>
                      <th>Score</th>
                      <th>Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ item, index }) => {
                      const state = run[item.id] ?? item.outcome;
                      const pill =
                        state === "running" ? "Running" : state === "queued" ? "Queued" : OUTCOME_LABEL[state];
                      return (
                        <tr
                          key={item.id}
                          data-i={index}
                          aria-selected={selected === item.id}
                          data-state={state}
                          tabIndex={0}
                          onClick={() => setSelected(item.id)}
                          onDoubleClick={() => runOne(item.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              runOne(item.id);
                            } else if (event.key === " ") {
                              event.preventDefault();
                              setSelected(item.id);
                            }
                          }}
                        >
                          <td>
                            <span className="ui-ev__in">
                              <span className="ui-ev__id">{item.id}</span>
                              <span className="ui-ev__trunc">{item.input}</span>
                            </span>
                          </td>
                          <td>
                            <span className="ui-ev__trunc ui-ev__soft">{item.expected}</span>
                          </td>
                          <td>
                            <span className="ui-ev__trunc ui-ev__soft">{item.output}</span>
                          </td>
                          <td>
                            <span className="ui-ev__pill" data-v={state}>
                              {state === "running" ? (
                                <i className="ui-ev__spin" aria-hidden="true" />
                              ) : (
                                <i aria-hidden="true" />
                              )}
                              {pill}
                              {state === "running" || state === "queued" ? null : <span>{item.score}</span>}
                            </span>
                          </td>
                          <td className="ui-ev__num">{item.latency}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ---------- pass rate by version ---------- */

function PassRateChart({
  series,
  selected,
  title = "Pass rate by version",
  label = "Pass rate",
  footer,
}: {
  /** One point per version, oldest first */
  series: EvalsVersionPoint[];
  /** Version the chip is showing – the crosshair starts there */
  selected?: string;
  /** Heading above the figure */
  title?: string;
  /** Row name inside the tooltip */
  label?: string;
  /** Line under the chart – how many versions, cases and which model */
  footer?: ReactNode;
}) {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const plotRef = useRef<HTMLDivElement>(null);

  const count = series.length;
  const step = count > 1 ? 100 / (count - 1) : 0;

  useEffect(() => {
    const at = series.findIndex((point) => point.label === selected);
    if (at >= 0) setActive(at);
  }, [selected, series]);

  const index = Math.min(Math.max(active, 0), Math.max(0, count - 1));
  const point = series[index];
  const last = series[count - 1];
  const previous = series[count - 2] ?? last;
  const middle = Math.floor(count / 2);
  const middleX = count > 1 ? (middle * 100) / (count - 1) : 0;

  /** Y in the 0–100 viewBox: 0% is at the top, 100% at the bottom. */
  const yOf = (rate: number) => (1 - rate / 100) * 100;
  const xOf = (position: number) => position * step;

  const move = (next: number) => {
    setActive(Math.min(Math.max(next, 0), Math.max(0, count - 1)));
    setOpen(true);
  };

  if (!point || !last) return null;

  const delta = last.rate - previous.rate;
  const x = xOf(index);
  const y = yOf(point.rate);

  return (
    <section className="ui-kpi ui-ev__chart">
      <h3 className="ui-kpi__title">{title}</h3>
      <p className="ui-kpi__value">
        {last.rate}%
        <span className="ui-kpi__delta" data-trend={delta >= 0 ? "up" : "down"}>
          {delta >= 0 ? "+" : "−"}
          {Math.abs(delta)}%
        </span>
      </p>
      <div className="ui-kpi__chart">
        <div className="ui-kpi__yaxis" aria-hidden="true">
          {[100, 50, 0].map((tick) => (
            <span key={tick}>{tick}%</span>
          ))}
        </div>
        <div
          className="ui-kpi__plot"
          ref={plotRef}
          tabIndex={0}
          role="group"
          aria-label={`${title} chart – use the arrow keys to read the values per day`}
          onPointerMove={(event: ReactPointerEvent<HTMLDivElement>) => {
            const plot = plotRef.current;
            if (!plot || count < 2) return;
            const rect = plot.getBoundingClientRect();
            const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
            setActive(Math.round(ratio * (count - 1)));
            setOpen(true);
          }}
          onPointerLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
            const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
            if (!keys.includes(event.key)) return;
            event.preventDefault();
            if (event.key === "ArrowRight") move(index + 1);
            else if (event.key === "ArrowLeft") move(index - 1);
            else if (event.key === "Home") move(0);
            else move(count - 1);
          }}
        >
          {[0, 50, 100].map((top) => (
            <span key={top} className="ui-kpi__grid" style={{ top: `${top}%` }} />
          ))}
          <svg className="ui-kpi__lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline
              points={series.map((item, position) => `${xOf(position)},${yOf(item.rate)}`).join(" ")}
              style={{ stroke: "var(--ev-run)" }}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="ui-kpi__marker" aria-hidden="true" data-open={open ? "" : undefined}>
            <span className="ui-kpi__guide" style={{ left: `${x}%` }} />
            <span
              className="ui-kpi__dot"
              style={{ left: `${x}%`, top: `${y}%`, background: "var(--ev-run)" }}
            />
          </div>
          <div
            className="ui-kpi__tooltip"
            data-side={x > 50 ? "left" : "right"}
            role="status"
            aria-live="polite"
            style={{ left: `${x}%` }}
            data-open={open ? "" : undefined}
          >
            <p className="ui-kpi__date">
              {point.label} · {point.date}
            </p>
            <ul>
              <li>
                <span className="ui-kpi__swatch" style={{ background: "var(--ev-run)" }} />
                <span className="ui-kpi__label">{label}</span>
                <span className="ui-kpi__num">{point.rate}%</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="ui-kpi__xaxis" aria-hidden="true">
          <span data-edge="start" style={{ left: "0%" }}>
            {series[0].label}
          </span>
          <span style={{ left: `${middleX.toFixed(4)}%` }}>{series[middle].label}</span>
          <span data-edge="end" style={{ left: "100%" }}>
            {last.label}
          </span>
        </div>
      </div>
      <p className="ui-kpi__footer">{footer}</p>
    </section>
  );
}

/* ---------- the prompt, with its suggestions ---------- */

function PromptDiff({
  prompt,
  version,
  onDecide,
}: {
  /** The prompt and the pieces of it under review */
  prompt: EvalsPrompt;
  /** Version the changes belong to */
  version: string;
  /** Called once per suggestion, with the index into the segment list */
  onDecide?: (index: number, decision: "accepted" | "rejected") => void;
}) {
  const [decisions, setDecisions] = useState<Record<number, "accepted" | "rejected">>({});
  const [history, setHistory] = useState<number[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [live, setLive] = useState("");
  const [popAt, setPopAt] = useState<{ left: number; top: number } | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const changeRefs = useRef(new Map<number, HTMLElement>());

  const changeIndexes = useMemo(
    () =>
      prompt.segments.reduce<number[]>((indexes, segment, index) => {
        if (typeof segment !== "string") indexes.push(index);
        return indexes;
      }, []),
    [prompt.segments],
  );

  const pending = changeIndexes.filter((index) => !decisions[index]);
  const done = pending.length === 0;

  /** Park the popover above the change it belongs to, kept inside the card. */
  useLayoutEffect(() => {
    if (active === null) return;
    const card = cardRef.current;
    const change = changeRefs.current.get(active);
    const pop = popRef.current;
    if (!card || !change || !pop) return;
    const box = card.getBoundingClientRect();
    const spot = change.getBoundingClientRect();
    const width = pop.offsetWidth;
    const height = pop.offsetHeight;
    const left = Math.min(
      Math.max(8, spot.left - box.left + spot.width / 2 - width / 2),
      Math.max(8, box.width - width - 8),
    );
    const top = Math.max(6, spot.top - box.top - height - 8);
    setPopAt({ left, top });
  }, [active, decisions]);

  const ordinalOf = (index: number) => changeIndexes.indexOf(index) + 1;

  const decide = (index: number, decision: "accepted" | "rejected") => {
    setDecisions((prev) => ({ ...prev, [index]: decision }));
    setHistory((prev) => [...prev.filter((item) => item !== index), index]);
    setActive(null);
    const left = changeIndexes.filter((item) => item !== index && !decisions[item]).length;
    setLive(
      `${decision === "accepted" ? "Accepted" : "Rejected"} suggestion ${ordinalOf(index)} of ${
        changeIndexes.length
      }. ${left === 0 ? "All changes reviewed." : `${left} left.`}`,
    );
    onDecide?.(index, decision);
  };

  const decideAll = (decision: "accepted" | "rejected") => {
    const next = { ...decisions };
    for (const index of changeIndexes) next[index] = decision;
    setDecisions(next);
    setHistory((prev) => [...prev, ...changeIndexes.filter((index) => !prev.includes(index))]);
    setActive(null);
    setLive(
      decision === "accepted"
        ? `Accepted all ${changeIndexes.length} suggestions. All changes reviewed.`
        : `Rejected all ${changeIndexes.length} suggestions. All changes reviewed.`,
    );
    for (const index of changeIndexes) onDecide?.(index, decision);
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (last === undefined) return;
    setHistory((prev) => prev.slice(0, -1));
    setDecisions((prev) => {
      const next = { ...prev };
      delete next[last];
      return next;
    });
    setLive(`Took back the decision on suggestion ${ordinalOf(last)}.`);
  };

  const step = (direction: 1 | -1) => {
    if (!changeIndexes.length) return;
    /* Walk only what is still open – land on the next suggestion that needs an answer. */
    const order = pending.length ? pending : changeIndexes;
    const at = active === null ? -1 : order.indexOf(active);
    const next = at < 0
      ? direction > 0
        ? 0
        : order.length - 1
      : (at + direction + order.length) % order.length;
    const index = order[next];
    setActive(index);
    changeRefs.current.get(index)?.focus();
  };

  return (
    <div className="ui-df ui-ev__diff" data-done={done ? "" : undefined}>
      <div className="ui-df__label">
        <IconSparkle />
        <span>
          Changes in {version} · {prompt.label}, edited by {prompt.editor}
        </span>
      </div>
      <div className="ui-df__card" ref={cardRef} onPointerLeave={() => {
          if (!cardRef.current?.contains(document.activeElement)) setActive(null);
        }}>
        <div className="ui-df__head">
          <div className="ui-df__bar">
            <div className="ui-df__layer" data-show={done ? undefined : "true"} inert={done} aria-hidden={done}>
              <span className="ui-df__count">
                <span className="ui-df__num">{pending.length}</span>
                <span className="ui-df__word">suggestions</span>
              </span>
              <span className="ui-df__actions">
                <span className="ui-df__nav">
                  <button
                    type="button"
                    className="ui-df__icon"
                    aria-label="Previous suggestion"
                    onClick={() => step(-1)}
                  >
                    <IconPrev16 />
                  </button>
                  <button
                    type="button"
                    className="ui-df__icon"
                    aria-label="Next suggestion"
                    onClick={() => step(1)}
                  >
                    <IconNext16 />
                  </button>
                </span>
                <button type="button" className="ui-df__btn" onClick={() => decideAll("rejected")}>
                  Reject all
                </button>
                <button
                  type="button"
                  className="ui-df__btn ui-df__btn--primary"
                  onClick={() => decideAll("accepted")}
                >
                  Accept all
                </button>
              </span>
            </div>
            <div className="ui-df__layer" data-show={done ? "true" : undefined} inert={!done} aria-hidden={!done}>
              <span className="ui-df__count ui-df__count--done">
                <IconCheckDraw />
                All changes reviewed
              </span>
              <button type="button" className="ui-df__btn" disabled={history.length === 0} onClick={undo}>
                <IconUndo16 />
                Undo
              </button>
            </div>
          </div>
        </div>
        <div className="ui-df__body">
          <p className="ui-df__text">
            {prompt.segments.map((segment, index) => {
              if (typeof segment === "string") return <span key={`text-${index}`}>{segment}</span>;
              const state = decisions[index] ?? "pending";
              return (
                <span
                  key={`change-${index}`}
                  ref={(element) => {
                    if (element) changeRefs.current.set(index, element);
                    else changeRefs.current.delete(index);
                  }}
                  className="ui-df__chg"
                  data-state={state}
                  data-active={active === index ? "" : undefined}
                  tabIndex={0}
                  role="button"
                  aria-label={`Suggestion ${ordinalOf(index)} of ${changeIndexes.length}: replace “${
                    segment.before
                  }” with “${segment.after}”. Press Y to accept, N to reject`}
                  onPointerEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onBlur={(event) => {
                    /* Focus moving into the popover is not leaving the change. */
                    if (cardRef.current?.contains(event.relatedTarget as Node | null)) return;
                    setActive((current) => (current === index ? null : current));
                  }}
                  onClick={() => setActive(index)}
                  onKeyDown={(event: ReactKeyboardEvent<HTMLSpanElement>) => {
                    if (event.key === "y" || event.key === "Y") {
                      event.preventDefault();
                      decide(index, "accepted");
                    } else if (event.key === "n" || event.key === "N") {
                      event.preventDefault();
                      decide(index, "rejected");
                    } else if (event.key === "ArrowRight") {
                      event.preventDefault();
                      step(1);
                    } else if (event.key === "ArrowLeft") {
                      event.preventDefault();
                      step(-1);
                    } else if (event.key === "Escape") {
                      setActive(null);
                    }
                  }}
                >
                  <del className="ui-df__del">{segment.before}</del>
                  <ins className="ui-df__ins">{segment.after}</ins>
                </span>
              );
            })}
          </p>
        </div>
        <div
          className="ui-df__pop"
          ref={popRef}
          role="group"
          aria-label="Review suggestion"
          aria-hidden={active === null}
          data-open={active === null ? undefined : ""}
          style={popAt ?? undefined}
        >
          <button
            type="button"
            tabIndex={-1}
            className="ui-df__pbtn"
            aria-label="Accept suggestion"
            onClick={() => active !== null && decide(active, "accepted")}
          >
            <IconCheckPop />
            Accept
            <kbd>Y</kbd>
          </button>
          <span className="ui-df__sep" aria-hidden="true" />
          <button
            type="button"
            tabIndex={-1}
            className="ui-df__pbtn"
            aria-label="Reject suggestion"
            onClick={() => active !== null && decide(active, "rejected")}
          >
            <IconClosePop />
            Reject
            <kbd>N</kbd>
          </button>
        </div>
      </div>
      <span className="ui-df__sr" role="status" aria-live="polite">
        {live}
      </span>
    </div>
  );
}

/* ---------- the filter tabs ---------- */

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  /** Tabs left to right; a count rides along in a pill when present */
  options: { id: T; label: string; count?: number }[];
  /** id of the tab that is on */
  value: T;
  /** Called with the id of the tab that was picked */
  onChange: (id: T) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [metrics, setMetrics] = useState<{ widths: number[]; left: number; right: number } | null>(null);

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const area = track.getBoundingClientRect();
    const boxes = optionRefs.current.slice(0, options.length).map((element) =>
      element ? element.getBoundingClientRect() : null,
    );
    const widths = boxes.map((box) => (box ? Math.round(box.width) : 0));
    const on = Math.max(0, options.findIndex((option) => option.id === value));
    const box = boxes[on] ?? null;
    const next = {
      widths,
      left: box ? Math.round(box.left - area.left) : 0,
      right: box ? Math.round(area.right - box.right) : Math.round(area.width),
    };
    setMetrics((prev) =>
      prev &&
      prev.left === next.left &&
      prev.right === next.right &&
      prev.widths.length === next.widths.length &&
      prev.widths.every((width, index) => width === next.widths[index])
        ? prev
        : next,
    );
  }, [options, value]);

  useLayoutEffect(() => {
    measure();
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [measure]);

  const ready = metrics !== null;

  return (
    <div className="ui-seg" data-size="sm" data-variant="tray" data-ready={ready ? "" : undefined}>
      <div
        className="ui-seg__scroller"
        style={{ "--ui-seg-fade-l": "0px", "--ui-seg-fade-r": "0px" } as CSSProperties}
      >
        <div
          className="ui-seg__track"
          role="radiogroup"
          onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
            const on = Math.max(0, options.findIndex((option) => option.id === value));
            let next = on;
            if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (on + 1) % options.length;
            else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
              next = (on - 1 + options.length) % options.length;
            } else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = options.length - 1;
            else return;
            event.preventDefault();
            onChange(options[next].id);
            optionRefs.current[next]?.focus();
          }}
        >
          <span
            className="ui-seg__pill"
            aria-hidden="true"
            data-ready={ready ? "1" : undefined}
            style={
              metrics
                ? { opacity: 1, left: `${metrics.left}px`, right: `${metrics.right}px` }
                : { opacity: 0 }
            }
          />
          {options.map((option, index) => {
            const on = option.id === value;
            return (
              <button
                key={option.id}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                type="button"
                className="ui-seg__opt"
                role="radio"
                aria-checked={on}
                data-active={on ? "true" : undefined}
                tabIndex={on ? 0 : -1}
                style={metrics && metrics.widths[index] ? { width: `${metrics.widths[index]}px` } : undefined}
                onClick={() => onChange(option.id)}
              >
                <span className="ui-seg__content">
                  <span className="ui-seg__label">
                    <span className="ui-seg__text">{option.label}</span>
                    <span className="ui-seg__text ui-seg__text-bold" aria-hidden="true">
                      {option.label}
                    </span>
                  </span>
                  {option.count === undefined ? null : <span className="ui-seg__count">{option.count}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- styles ---------- */

const css = /* css */ `
/* ui-app-shell — composed into this item */
.ui-as{--tray: #f3ebe3;--card: #fffdfb;--page: #f8f3ee;--panel: #fffdfb;--radius-panel: 18px;--frame-gap: 8px;--line: #e8e0d8;--line-soft: #eee6de;--ink: #1c1713;--text: #3d3226;--muted: #68584b;--faint: #96887a;--placeholder: #96887a;--chip: #f4ece5;--chip-hover: #ece4db;--hover: rgba(11, 9, 8, 0.035);--accent: #ff8a5c;--button: #28211a;--button-hover: #33291f;--accent-soft: #f6f0e9;--shadow: 0 1px 2px rgba(11, 9, 8, 0.05);--line-strong: #d2c7bd;--subtle: #faf7f4;--disabled: #d0c4ba;--on-ink: #fffdfb;--ink-hover: #382e23;--select: rgba(11, 9, 8, 0.055);--toggle-off: #d8cdc4;--switch-on: #1c1713;--logo-bg: #fffdfb;--ease: cubic-bezier(0.22, 1, 0.36, 1);--font: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif}
.ui-as .ui-pl{font-size: 13.5px;line-height: 19px}
.ui-as .ui-pl__title{font-size: 14px;line-height: 20px}
.ui-as .ui-df__text{font-size: 13.5px;line-height: 1.6}
.ui-as .ui-df__body{padding: 14px 16px 16px}
.ui-as .ui-ap__title{font-size: 13.5px}
.ui-as .ui-ap__btn{height: 30px}
.ui-as .ui-tc{font-size: 13px}
.ui-as .ui-tc__head{min-height: 40px;padding-top: 6px;padding-bottom: 6px}
.ui-as .ui-ap__foot .ui-ap__actions{flex: 0 0 auto;margin-left: auto}
.ui-as .ui-ap__actions .ui-ap__btn{flex: none;padding: 0 12px;border-radius: 10px}
.ui-as .ui-ap__actions .ui-ap__btn--quiet{background: var(--card);box-shadow: inset 0 0 0 1px var(--line)}
.ui-as .ui-ap__actions .ui-ap__btn--quiet:hover{background: var(--subtle)}
.ui-as .ui-df__head .ui-df__btn, .ui-as .ui-df__head .ui-df__icon{border-radius: 10px}
.ui-as .ui-ap__actions .ui-ap__btn--primary, .ui-as .ui-df__head .ui-df__btn--primary{background: var(--button)}
.ui-as .ui-um__action{border-radius: 10px}
.ui-as .ui-ap{--ui-ap-tray: var(--tray);--ui-ap-hover: #e8e0d8}
.ui-as .ui-pl{--ui-pl-tray: var(--tray);--ui-pl-quiet-hover: #e8e0d8;--ui-pl-marker: var(--chip)}
.ui-as .ui-df{--ui-df-tray: var(--tray)}
.ui-as .ui-um{--ui-um-tray: var(--tray)}
.ui-as .ui-cb{--ui-cb-tray: var(--tray)}
:where(.dark, [data-theme="dark"]) .ui-as .ui-ap{--ui-ap-tray: #181310;--ui-ap-hover: #26201a}
:where(.dark, [data-theme="dark"]) .ui-as .ui-pl{--ui-pl-tray: #181310;--ui-pl-quiet-hover: #26201a;--ui-pl-marker: #29221b}
:where(.dark, [data-theme="dark"]) .ui-as :is(.ui-df, .ui-um, .ui-cb){--ui-df-tray: #181310;--ui-um-tray: #181310;--ui-cb-tray: #181310}
:where(.dark, [data-theme="dark"]) .ui-as{--tray: #221c17;--card: #201a15;--page: #16110e;--panel: #1a1512;--line: #2b231b;--line-soft: #26201a;--ink: #f4ece4;--text: #c8bdb2;--muted: #988a7d;--faint: #6a5a4e;--placeholder: #6a5a4e;--chip: #27201a;--chip-hover: #2e251c;--hover: rgba(255, 253, 251, 0.05);--accent: #ff8a5c;--button: #f4ece4;--button-hover: #fffdfb;--accent-soft: rgba(255, 138, 92, 0.14);--shadow: 0 1px 2px rgba(11, 9, 8, 0.4);--line-strong: #3a3024;--subtle: #1e1814;--disabled: #3a3024;--on-ink: #181310;--ink-hover: #c8bdb2;--select: rgba(255, 253, 251, 0.08);--toggle-off: #3a3024;--switch-on: #ff8a5c;--logo-bg: #2c241b;color-scheme: dark}
.ui-as, .ui-as *, .ui-as *::before, .ui-as *::after{box-sizing: border-box}
.ui-as{font-family: var(--font);font-size: 13px;color: var(--text);-webkit-font-smoothing: antialiased;-moz-osx-font-smoothing: grayscale}
:where(.ui-as) button{appearance: none;margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;cursor: pointer}
:where(.ui-as) svg{display: block;flex: none}
.ui-as :focus-visible{outline: 2px solid var(--accent);outline-offset: 2px}
.ui-as textarea:focus-visible, .ui-as input:focus-visible{outline: none}
.ui-as-app .ui-button[data-variant="primary"]{border-color: transparent;background: var(--button);color: var(--on-ink);box-shadow: inset 0 1px 0.5px rgba(255, 253, 251, 0.16), inset 0 -1px 0.5px rgba(28, 23, 19, 0.1), 0 1px 2px rgba(28, 23, 19, 0.1)}
.ui-as-app .ui-button[data-variant="primary"]:hover:not(:disabled){background: var(--button-hover)}
.ui-as-app{container: ui-as / inline-size;position: relative;display: grid;grid-template-columns: 248px minmax(0, 1fr);height: 100%;min-height: 560px;background: var(--page);transition: grid-template-columns var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-app[data-collapsed]{grid-template-columns: 0 minmax(0, 1fr)}
.ui-as-app[data-collapsed] .ui-as-main{margin-left: var(--frame-gap)}
.ui-as-side{display: flex;flex-direction: column;width: 248px;min-height: 0;padding: 10px 8px 8px 10px;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), translate var(--nm-dur-4, 380ms) var(--ease), visibility 0s}
.ui-as-app[data-collapsed] .ui-as-side{visibility: hidden;opacity: 0;translate: -16px 0;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), translate var(--nm-dur-4, 380ms) var(--ease), visibility 0s 420ms}
.ui-as-side-open{position: fixed;z-index: 20;top: calc(var(--frame-gap) + 9px);left: calc(var(--frame-gap) + 9px);visibility: hidden;opacity: 0;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), visibility 0s 200ms}
.ui-as-app[data-collapsed] .ui-as-side-open{visibility: visible;opacity: 1;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 160ms, visibility 0s}
.ui-as-side__head{display: flex;align-items: center;justify-content: space-between;height: 28px}
.ui-as-side__workspace{display: flex;align-items: center;gap: 6px;height: 30px;padding: 0 6px;border-radius: 8px;font-size: 14px;font-weight: 600;color: var(--ink)}
.ui-as-side__workspace svg{color: var(--faint)}
.ui-as-side__workspace:hover{background: var(--hover)}
.ui-as-user-menu{display: flex}
.ui-as-user-menu > .ui-as-user{flex: 1}
.ui-as-user-menu .ui-as-menu{width: 100%}
.ui-as-side__logo{display: grid;place-items: center;width: 18px;height: 18px;margin-right: 1px;border-radius: 5px;background: var(--logo-bg);box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.08), 0 1px 1px rgba(0, 0, 0, 0.12)}
.ui-as-side__logo svg{width: 11px;height: auto}
.ui-as-side__tools{display: flex;gap: 2px}
.ui-as-icon-btn{display: grid;place-items: center;width: 28px;height: 28px;border-radius: 8px;color: var(--muted);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-icon-btn:hover{background: var(--hover);color: var(--ink)}
.ui-as-side__nav{display: flex;flex-direction: column;margin-top: 16px}
.ui-as-side__group{display: flex;flex-direction: column}
.ui-as-side__group + .ui-as-side__group{margin-top: 10px}
.ui-as-side__group + .ui-as-side__group > .ui-as-side__label:first-child{margin-top: 6px}
.ui-as-side__count{margin-left: auto;font-size: 12px;color: var(--faint);font-variant-numeric: tabular-nums}
.ui-as-side__empty{padding: 4px 6px;font-size: 13px;color: var(--faint)}
.ui-as-side__item{display: flex;align-items: center;gap: 8px;width: 100%;height: 30px;padding: 0 6px;border-radius: 8px;font-size: 13.5px;color: var(--text);text-align: left;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-side__item svg{color: var(--muted)}
.ui-as-side__item:hover{background: var(--hover);color: var(--ink)}
.ui-as-side__item[aria-current="page"]{background: var(--select);color: var(--ink);font-weight: 500}
.ui-as-side__item[aria-current="page"] svg{color: var(--ink)}
a.ui-as-side__item{text-decoration: none;cursor: pointer}
.ui-as-side__label{margin: 16px 0 4px;padding: 0 6px;font-size: 12.5px;line-height: 16px;color: var(--faint)}
.ui-as-side__foot{display: flex;flex-direction: column;gap: 8px;margin-top: auto}
.ui-as-news{position: relative;padding-top: 30px}
.ui-as-news__card{position: relative;z-index: 1;padding: 10px 10px 0;border-radius: 12px;background: var(--card);box-shadow: 0 0 0 1px var(--line), 0 2px 6px rgba(11, 9, 8, 0.04)}
.ui-as-news__card--back{position: absolute;z-index: 0;top: 0;left: 10px;right: 10px;height: 48px;display: flex;align-items: flex-start;justify-content: space-between;padding: 9px 9px 0;background: var(--card);color: var(--faint)}
.ui-as-news[data-count="1"]{padding-top: 0}
.ui-as-news[data-count="1"] .ui-as-news__card--back{display: none}
.ui-as-news__top{display: flex;align-items: center;justify-content: space-between}
.ui-as-news__kicker{font-size: 11.5px;line-height: 15px;font-weight: 500;color: var(--accent)}
.ui-as-news__close{display: grid;place-items: center;width: 18px;height: 18px;margin: -2px -2px 0 0;border-radius: 6px;color: var(--faint)}
.ui-as-news__close:hover{background: var(--hover);color: var(--ink)}
.ui-as-news__title{display: block;margin-top: 4px;font-size: 13.5px;line-height: 18px;font-weight: 600;color: var(--ink)}
.ui-as-news__more{display: flex;align-items: center;justify-content: space-between;width: calc(100% + 20px);height: 34px;margin: 10px -10px 0;padding: 0 10px;border-top: 1px solid var(--line-soft);border-radius: 0 0 12px 12px;font-size: 12.5px;color: var(--muted)}
.ui-as-news__more:hover{background: var(--subtle);color: var(--ink)}
.ui-as-guide-slot{position: relative;flex: none}
.ui-as-guide{position: absolute;z-index: 6;right: 0;bottom: 0;left: 0;overflow: hidden;border-radius: 12px;background: var(--card);box-shadow: 0 0 0 1px var(--line), 0 2px 6px rgba(11, 9, 8, 0.04);transition: height var(--nm-dur-4, 380ms) var(--ease), border-radius var(--nm-dur-4, 380ms) var(--ease), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-guide:not([data-open]):hover{box-shadow: 0 0 0 1px var(--line-strong), 0 2px 6px rgba(11, 9, 8, 0.05)}
.ui-as-guide[data-open]{border-radius: 14px;box-shadow: 0 0 0 1px var(--line), 0 8px 24px -10px rgba(11, 9, 8, 0.14)}
.ui-as-guide__content{animation: ui-as-guide-in var(--nm-dur-4, 380ms) var(--ease) both}
.ui-as-guide[data-state="closing"] .ui-as-guide__content{animation: ui-as-guide-out var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-as-guide[data-state="closing"]{border-radius: 12px;box-shadow: 0 0 0 1px var(--line), 0 2px 6px rgba(11, 9, 8, 0.04)}
@keyframes ui-as-guide-out{to{opacity: 0}
}
@keyframes ui-as-guide-in{from{opacity: 0;transform: translateY(6px)}
to{opacity: 1;transform: none}
}
.ui-as-steps{display: grid;gap: 3px;width: 100%;padding: 10px 10px 9px;text-align: left}
.ui-as-guide .ui-sg__icon-btn[aria-expanded]{display: none}
.ui-as-guide .ui-sg{zoom: 0.86;max-width: none;padding: 12px 4px 4px;border: 0;border-radius: 0;background: transparent;box-shadow: none}
.ui-as-steps__title{display: flex;align-items: center;justify-content: space-between;font-size: 13.5px;line-height: 18px;font-weight: 600;color: var(--ink)}
.ui-as-steps__title svg{color: var(--faint)}
.ui-as-steps__sub{font-size: 12.5px;line-height: 17px;color: var(--muted)}
.ui-as-steps__cheer{color: var(--accent)}
.ui-as-steps__bar{height: 4px;margin-top: 6px;overflow: hidden;border-radius: 2px;background: var(--tray)}
.ui-as-steps__bar i{display: block;min-width: 6px;height: 100%;border-radius: inherit;background: var(--accent);transition: width var(--nm-dur-5, 620ms) var(--ease)}
.ui-as-user{display: flex;align-items: center;gap: 7px;height: 34px;padding: 0 6px;border-radius: 8px;font-size: 13.5px;font-weight: 500;color: var(--ink)}
.ui-as-user img{width: 21px;height: 21px;border-radius: 50%;object-fit: cover;box-shadow: 0 0 0 1px rgba(11, 9, 8, 0.06)}
.ui-as-user svg{margin-left: auto;color: var(--faint)}
.ui-as-user:hover{background: var(--hover)}
.ui-as-main{container: ui-as-main / inline-size;position: relative;min-width: 0;margin: var(--frame-gap) var(--frame-gap) var(--frame-gap) 0;overflow-y: auto;overscroll-behavior: none;transition: margin-left var(--nm-dur-4, 380ms) var(--ease);border: 1px solid var(--line);border-radius: var(--radius-panel);background: var(--panel)}
.ui-as-page{padding: 46px 32px 56px}
.ui-as-page-title{margin: 0;font-size: 22px;line-height: 28px;font-weight: 600;letter-spacing: -0.02em;color: var(--ink)}
.ui-as-page-sub{margin: 6px 0 0;font-size: 13.5px;line-height: 20px;color: var(--muted)}
.ui-as-page-sub a{color: var(--text);text-decoration: underline;text-decoration-color: var(--line-strong);text-underline-offset: 3px}
.ui-as-page-sub a:hover{color: var(--ink);text-decoration-color: currentColor}
.ui-as-section-head{margin-top: 38px}
.ui-as-section-head[data-inline]{display: flex;align-items: center;justify-content: space-between;gap: 16px}
.ui-as-section-head[data-inline] .ui-as-toolbar{margin-top: 0}
.ui-as-section-head__title{margin: 0;font-size: 16px;line-height: 22px;font-weight: 600;letter-spacing: -0.01em;color: var(--ink)}
.ui-as-toolbar{display: flex;align-items: center;justify-content: space-between;gap: 16px;margin-top: 16px}
.ui-as-toolbar__left, .ui-as-toolbar__right{display: flex;align-items: center;gap: 6px}
.ui-as-tabs{position: relative;display: flex;gap: 2px}
.ui-as-tabs__pill{position: absolute;top: 0;left: 0;height: 32px;border-radius: 9px;background: var(--chip);transition: transform var(--nm-dur-4, 380ms) var(--ease), width var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-tabs__tab{position: relative;height: 32px;padding: 0 10px;border-radius: 9px;font-size: 13.5px;color: var(--muted);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-tabs__tab:hover{color: var(--ink)}
.ui-as-tabs__tab[aria-selected="true"]{color: var(--ink)}
.ui-as-tool{display: flex;align-items: center;justify-content: center;gap: 6px;min-width: 32px;height: 32px;border-radius: 9px;background: var(--card);box-shadow: 0 0 0 1px var(--line), var(--shadow);color: var(--text);transition: box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-tool svg{color: var(--muted)}
.ui-as-tool:hover{box-shadow: 0 0 0 1px var(--line-strong), var(--shadow);color: var(--ink)}
.ui-as-tool--label{padding: 0 10px;font-size: 13px}
.ui-as-view{position: relative;display: flex;gap: 2px;height: 32px;padding: 2px;border-radius: 9px;background: var(--chip)}
.ui-as-view__btn{display: grid;place-items: center;width: 30px;border-radius: 7px;color: var(--faint)}
.ui-as-view__btn:hover{color: var(--ink)}
.ui-as-view__btn{position: relative;transition: color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-view__btn[aria-checked="true"]{color: var(--ink)}
.ui-as-view__pill{position: absolute;top: 2px;bottom: 2px;left: 2px;width: 30px;border-radius: 7px;background: var(--card);box-shadow: 0 0 0 1px var(--line), var(--shadow);transition: transform var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-view[data-view="list"] .ui-as-view__pill{transform: translateX(32px)}
.ui-as-search{display: flex;align-items: center;gap: 7px;height: 32px;padding: 0 10px;border-radius: 9px;background: var(--card);box-shadow: 0 0 0 1px var(--line), var(--shadow);color: var(--faint);cursor: text;transition: box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-search:focus-within{box-shadow: 0 0 0 1px var(--line-strong), 0 0 0 3px rgba(11, 9, 8, 0.04)}
.ui-as-search input{flex: 1;min-width: 0;padding: 0;border: 0;background: transparent;font: inherit;font-size: 13px;color: var(--ink)}
.ui-as-search input::placeholder{color: var(--placeholder)}
.ui-as-search__clear{display: grid;flex: none;place-items: center;width: 18px;height: 18px;border-radius: 50%;background: var(--chip);color: var(--muted);animation: ui-as-pop var(--nm-dur-3, 240ms) var(--ease)}
.ui-as-search__clear:hover{color: var(--ink)}
.ui-as-sort svg{transition: transform var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-sort[data-dir="desc"] svg{transform: rotate(180deg)}
.ui-as-tool[data-active]{box-shadow: 0 0 0 1px var(--line-strong), var(--shadow);color: var(--ink)}
.ui-as-tool__count{display: grid;place-items: center;min-width: 18px;height: 18px;padding: 0 5px;border-radius: 999px;background: var(--ink);font-size: 11px;font-weight: 600;color: var(--on-ink);animation: ui-as-pop var(--nm-dur-3, 240ms) var(--ease)}
.ui-as-anchor{position: relative;display: inline-flex}
.ui-as-popover{position: absolute;z-index: 30;top: calc(100% + 6px);left: 0;transform-origin: top left;animation: ui-as-popover var(--nm-dur-3, 240ms) var(--ease)}
.ui-as-popover[data-align="end"]{right: 0;left: auto;transform-origin: top right}
.ui-as-popover[data-side="top"]{top: auto;bottom: calc(100% + 6px);transform-origin: bottom left;animation-name: ui-as-popover-up}
.ui-as-popover[data-side="top"][data-align="end"]{transform-origin: bottom right}
.ui-as-popover[data-side="right"]{top: auto;bottom: 0;left: calc(100% + 12px);transform-origin: bottom left}
@keyframes ui-as-popover-up{from{opacity: 0;transform: scale(0.96) translateY(4px)}
to{opacity: 1;transform: none}
}
.ui-as-popover--filter .ui-fm{zoom: 0.9;width: 340px}
.ui-as-menu{min-width: 168px;padding: 4px;border-radius: 12px;background: var(--card);box-shadow: 0 0 0 1px var(--line), 0 12px 32px -8px rgba(11, 9, 8, 0.16)}
.ui-as-menu__title{display: block;padding: 6px 10px 4px;font-size: 12px;font-weight: 500;color: var(--faint)}
.ui-as-menu__list{display: grid;gap: 1px}
.ui-as-menu__item{display: flex;align-items: center;gap: 9px;width: 100%;min-height: 32px;padding: 0 10px;border-radius: 8px;font-size: 13px;color: var(--text);text-align: left;white-space: nowrap;transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-menu__item[data-rich]{min-height: 44px;padding: 6px 10px}
.ui-as-menu__item > svg{flex: none;color: var(--muted)}
.ui-as-menu__item > svg:last-child:not(:first-child){margin-left: auto;color: var(--ink)}
.ui-as-menu__label{display: grid;flex: 1;gap: 1px;min-width: 0}
.ui-as-menu__label small{font-size: 12px;line-height: 16px;color: var(--faint)}
.ui-as-menu__item:hover{background: var(--hover);color: var(--ink)}
.ui-as-menu__item[aria-checked="true"]{color: var(--ink);font-weight: 500}
.ui-as-menu__item[aria-checked="true"] small{font-weight: 400}
.ui-as-menu__item[data-danger]{color: #b3261e}
.ui-as-menu__item[data-danger] > svg{color: #b3261e}
.ui-as-toast{position: absolute;z-index: 40;left: 50%;bottom: 20px;display: flex;align-items: center;gap: 8px;height: 36px;padding: 0 14px 0 12px;border-radius: 999px;background: var(--ink);font-size: 13px;color: var(--on-ink);box-shadow: 0 10px 24px -8px rgba(11, 9, 8, 0.35);translate: -50% 0;animation: ui-as-toast var(--nm-dur-6, 1100ms) var(--ease) both}
.ui-as-rise{animation: ui-as-rise var(--nm-dur-4, 380ms) var(--ease) both;animation-delay: calc(var(--i, 0) * 35ms)}
@keyframes ui-as-rise{from{opacity: 0;transform: translateY(8px)}
to{opacity: 1;transform: none}
}
@keyframes ui-as-pop{from{opacity: 0;transform: scale(0.6)}
to{opacity: 1;transform: none}
}
@keyframes ui-as-popover{from{opacity: 0;transform: scale(0.96) translateY(-4px)}
to{opacity: 1;transform: none}
}
@keyframes ui-as-toast{0%{opacity: 0;transform: translateY(12px) scale(0.96)}
12%, 85%{opacity: 1;transform: none}
100%{opacity: 0;transform: translateY(6px)}
}
@media (prefers-reduced-motion: reduce){.ui-as *, .ui-as *::before, .ui-as *::after{animation-duration: 1ms !important;transition-duration: 1ms !important}
}
.ui-as-search input::-webkit-search-cancel-button{display: none}
.ui-as-empty{display: flex;flex-direction: column;align-items: center;margin-top: 16px;padding: 48px 24px 52px;border: 1px dashed var(--line-strong);border-radius: 14px;text-align: center}
.ui-as-empty[data-tall]{padding: 48px 24px 48px}
.ui-as-empty__icon{display: grid;place-items: center;width: 42px;height: 42px;border-radius: 11px;background: var(--chip);color: var(--muted)}
.ui-as-empty__title{margin-top: 16px;font-size: 14px;line-height: 20px;font-weight: 500;color: var(--ink)}
.ui-as-empty__text{max-width: 430px;margin: 6px 0 0;font-size: 13px;line-height: 19px;color: var(--muted);text-wrap: balance}
.ui-as-empty > .ui-button{margin-top: 18px}
.ui-as-folder-card__icon, .ui-as-folder-head__icon{position: relative;flex: none;width: 30px;height: 25px}
.ui-as-folder-card__icon .ui-fd, .ui-as-folder-head__icon .ui-fd{position: absolute;top: 50%;left: 50%;width: 75px;translate: -50% -50%}
:is(.ui-as-folder-card, .ui-as-folder-head):hover .ui-fd-icon{transform: translate(-50%, -48%) scale(1.03)}
:is(.ui-as-folder-card, .ui-as-folder-head):hover .ui-fd-doc--left{transform: translate(32px, 70px) rotate(9deg)}
:is(.ui-as-folder-card, .ui-as-folder-head):hover .ui-fd-doc--right{transform: translate(286px, 76px) rotate(5deg)}
:is(.ui-as-folder-card, .ui-as-folder-head):hover .ui-fd-doc--middle{transform: translate(166px, 52px) rotate(-7deg)}
:is(.ui-as-folder-card, .ui-as-folder-head):hover .ui-fd-front{top: 24.8%;border-radius: 3cqw 3cqw 6.333cqw 6.333cqw;transform: translateZ(2.33cqw) rotateX(-9deg)}
.ui-as-meta{display: inline-flex;align-items: center;gap: 4px;font-size: 12.5px;line-height: 17px;color: var(--muted)}
.ui-as-meta svg{color: var(--faint)}
.ui-as-template{display: grid;width: 239px;text-align: left}
.ui-as-template__preview{display: block;height: 158px;padding: 7px;border-radius: 14px;background: var(--card);box-shadow: 0 0 0 1px var(--line), var(--shadow);transition: box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-as-template:hover .ui-as-template__preview{box-shadow: 0 0 0 1px var(--line-strong), 0 2px 8px rgba(11, 9, 8, 0.05)}
.ui-as-template__name{margin-top: 10px;font-size: 13.5px;line-height: 18px;font-weight: 500;color: var(--ink)}
.ui-as-template .ui-as-meta{margin-top: 2px}
.ui-as-doc{--doc-back: #ff8a5c;--doc-glass-1: rgba(255, 138, 92, 0.72);--doc-glass-2: rgba(255, 107, 53, 0.78);--doc-shade: 60, 130, 180;--doc-paper: #f0e8df;display: flex;align-items: center;justify-content: center;height: 100%;border-radius: 10px;background: var(--card)}
.ui-as-doc[data-color="rose"]{--doc-back: #e2544a;--doc-glass-1: rgba(240, 147, 140, 0.74);--doc-glass-2: rgba(226, 84, 74, 0.8);--doc-shade: 190, 60, 88;--doc-paper: #f2eae2}
.ui-as-doc[data-color="emerald"]{--doc-back: #2f8d5c;--doc-glass-1: rgba(79, 157, 110, 0.74);--doc-glass-2: rgba(47, 141, 92, 0.8);--doc-shade: 40, 140, 96;--doc-paper: #f1e9e0}
.ui-as-doc__art{position: relative;display: block;width: 72px;height: 92px}
.ui-as-doc__back{position: absolute;inset: 0;border-radius: 11px;background: var(--doc-back);box-shadow: inset 0 1px 0 rgba(255, 253, 251, 0.45), 0 10px 18px -8px rgba(var(--doc-shade), 0.45);transform: translate(10px, -4px) rotate(8deg);transition: transform var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-doc__page{position: absolute;inset: 0;display: flex;flex-direction: column;gap: 5px;padding: 13px 11px;border-radius: 11px;background: linear-gradient(180deg, var(--doc-page, #fff) 0%, var(--doc-paper) 100%);box-shadow: 0 0 0 1px var(--doc-edge, rgba(0, 0, 0, 0.1)), 0 3px 5px rgba(var(--doc-shade), 0.16);transform: rotate(-3deg);transition: transform var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-doc__title{display: block;width: 58%;height: 5px;margin-bottom: 3px;border-radius: 3px;background: var(--doc-ink-strong, rgba(0, 0, 0, 0.2))}
.ui-as-doc__line{display: block;height: 4px;border-radius: 2px;background: var(--doc-ink, rgba(0, 0, 0, 0.1))}
.ui-as-doc__image{display: block;height: 26px;margin-bottom: 2px;border-radius: 5px;background: linear-gradient(160deg, var(--doc-glass-1), var(--doc-glass-2));opacity: 0.55}
.ui-as-sheet{display: grid;grid-template-columns: repeat(3, 1fr);gap: 2px}
.ui-as-sheet i{height: 8px;border-radius: 2px;background: var(--doc-cell, rgba(0, 0, 0, 0.07))}
.ui-as-sheet i:nth-child(-n + 3){background: rgba(var(--doc-shade), 0.35)}
.ui-as-doc__type{position: absolute;right: -12px;bottom: 10px;z-index: 2;padding: 3px 6px;border-radius: 5px;background: linear-gradient(180deg, rgba(11, 9, 8, 0) 55%, rgba(var(--doc-shade), 0.25) 100%), linear-gradient(180deg, var(--doc-glass-1), var(--doc-glass-2));box-shadow: inset 0 0 0 1px rgba(255, 253, 251, 0.35), inset 0 1px 0 rgba(255, 253, 251, 0.6), 0 6px 12px -4px rgba(var(--doc-shade), 0.45);-webkit-backdrop-filter: blur(4px) saturate(1.15);backdrop-filter: blur(4px) saturate(1.15);font-size: 10px;line-height: 13px;font-weight: 600;color: #fffdfb;text-shadow: 0 1px 2px rgba(var(--doc-shade), 0.45);transition: transform var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-template:hover .ui-as-doc__back{transform: translate(14px, -7px) rotate(12deg)}
.ui-as-template:hover .ui-as-doc__page{transform: translateY(-4px) rotate(-5deg)}
.ui-as-template:hover .ui-as-doc__type{transform: translate(2px, -2px)}
.ui-as-side__logo{font-size: 10.5px;font-weight: 600;color: var(--ink)}
.ui-as-user__initials{display: grid;place-items: center;width: 21px;height: 21px;border-radius: 50%;background: var(--accent-soft);font-size: 9.5px;font-weight: 600;color: var(--accent)}
:where(.dark, [data-theme="dark"]) .ui-as-doc{--doc-page: #342a20;--doc-edge: rgba(255, 253, 251, 0.1);--doc-ink: rgba(255, 253, 251, 0.14);--doc-ink-strong: rgba(255, 253, 251, 0.3);--doc-cell: rgba(255, 253, 251, 0.08)}
:where(.dark, [data-theme="dark"]) .ui-as-doc{--doc-paper: #2f261d}
:where(.dark, [data-theme="dark"]) .ui-as-doc[data-color="rose"]{--doc-paper: #2f261d}
:where(.dark, [data-theme="dark"]) .ui-as-doc[data-color="emerald"]{--doc-paper: #2c241c}
.ui-as-scrim{display: none}
@container ui-as (max-width: 900px){.ui-as-app > .ui-as-main{grid-row: 1;grid-column: 1 / -1;margin-left: var(--frame-gap)}
.ui-as-app > .ui-as-side{position: absolute;z-index: 50;top: 0;bottom: 0;left: 0;width: min(264px, calc(100% - 56px));padding: 10px 10px 10px 12px;border-radius: 0 18px 18px 0;background: var(--page);box-shadow: 0 0 0 1px var(--line), 0 24px 48px -12px rgba(11, 9, 8, 0.28)}
.ui-as-app:not([data-drawer]) > .ui-as-side{visibility: hidden;translate: calc(-100% - 24px) 0;transition: translate 380ms var(--ease), visibility 0s 380ms}
.ui-as-app[data-drawer] > .ui-as-side{visibility: visible;opacity: 1;translate: 0 0;transition: translate var(--nm-dur-4, 380ms) var(--ease), visibility 0s}
.ui-as-app > .ui-as-scrim{display: block;position: absolute;z-index: 45;inset: 0;background: rgba(11, 9, 8, 0.28);visibility: hidden;opacity: 0;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), visibility 0s 300ms}
.ui-as-app[data-drawer] > .ui-as-scrim{visibility: visible;opacity: 1;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), visibility 0s}
:where(.dark, [data-theme="dark"]) .ui-as-app > .ui-as-scrim{background: rgba(11, 9, 8, 0.55)}
.ui-as-app:not([data-drawer]) > .ui-as-side-open{visibility: visible;opacity: 1;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 160ms, visibility 0s}
.ui-as-app > .ui-as-side-open{left: calc(var(--frame-gap) + 9px);background: var(--panel)}
.ui-as-app > .ui-as-side-open:hover{background: var(--chip)}
.ui-as-page{padding: 46px 24px 48px}
.ui-as-main .ui-as-file-grid{display: grid;grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))}
.ui-as-main .ui-as-file-grid .ui-as-template{width: 100%}
.ui-as-main .ui-as-file-grid .ui-as-template__name{overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-as-main .ui-as-file-grid .ui-as-meta{display: block;overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-as-main .ui-as-file-grid .ui-as-meta svg{display: inline-block;vertical-align: -2px}
.ui-as-toolbar{flex-wrap: wrap;row-gap: 10px}
.ui-as-toolbar__right{flex-wrap: wrap}
.ui-as-section-head[data-inline]{flex-wrap: wrap;row-gap: 12px}
}
@container ui-as (max-width: 600px){.ui-as-app > *{--frame-gap: 6px}
.ui-as-app > .ui-as-main{border-radius: 16px}
.ui-as-page{padding: 52px 16px 40px}
.ui-as-page-title{font-size: 20px;line-height: 26px}
.ui-as-section-head{margin-top: 32px}
.ui-as-toolbar__left, .ui-as-toolbar__right{width: 100%}
.ui-as-toolbar__right .ui-as-search{order: 9;flex: 1 1 100%;width: auto !important}
.ui-as-toolbar__right > .ui-button:last-child{margin-left: auto}
.ui-as-tabs{max-width: 100%;overflow-x: auto;scrollbar-width: none}
.ui-as-tabs__tab{flex: none}
.ui-as-empty{padding: 36px 18px 40px}
.ui-as-popover--filter .ui-fm{width: 300px}
.ui-as-main .ui-as-file-grid{grid-template-columns: repeat(2, minmax(0, 1fr));gap: 16px 10px}
.ui-as-main .ui-as-file-grid .ui-as-template__preview{height: 128px}
}
/* ui-button — composed into this item */
/* Colors and motion as variables – override them on .ui-button (see Theming in the docs) */
.ui-button {
  --ui-btn-ink: #1c1713;
  --ui-btn-on-ink: #faf7f4;
  --ui-btn-dark-top: #342a20;
  --ui-btn-dark-bottom: #241e19;
  --ui-btn-dark-hover-top: #3c3125;
  --ui-btn-dark-hover-bottom: #2b231b;
  --ui-btn-edge-top: #473a2d;
  --ui-btn-edge-mid: #352a20;
  --ui-btn-edge-bottom: #1e1814;
  --ui-btn-ring: #14100d;
  --ui-btn-dark-shadow: rgba(11, 9, 8, 0.1);
  --ui-btn-surface: #fffdfb;
  --ui-btn-surface-hover: #faf7f4;
  --ui-btn-surface-shadow: rgba(11, 9, 8, 0.06);
  --ui-btn-line: #ded4ca;
  --ui-btn-muted: #68584b;
  --ui-btn-hover: #3d3226;
  --ui-btn-fill: #eee6de;
  --ui-btn-shine: rgba(255, 253, 251, 0.82);
  --ui-btn-shine-on-ink: rgba(255, 253, 251, 0.95);
  --ui-btn-danger: #b3261e;
  --ui-btn-danger-bg: #f1e9e1;
  --ui-btn-focus: rgba(28, 23, 19, 0.22);
  --ui-btn-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --ui-btn-load: 650ms;
  --h: 40px;
  --px: 16px;
  --gap: 8px;
  --fs: 14px;
  --icon: 18px;
  --radius: 12px;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--gap);
  height: var(--h);
  padding: 0 var(--px);
  margin: 0;
  border: 1px solid transparent;
  border-radius: var(--radius);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: var(--fs);
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.01em;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  -webkit-font-smoothing: antialiased;
  transition:
    background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    border-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    transform 160ms var(--ui-btn-ease),
    opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-button[data-size="sm"] {
  --h: 32px;
  --px: 12px;
  --gap: 6px;
  --fs: 13px;
  --icon: 16px;
  --radius: 10px;
}
.ui-button[data-size="lg"] {
  --h: 48px;
  --px: 20px;
  --gap: 10px;
  --fs: 15px;
  --icon: 20px;
  --radius: 14px;
}
.ui-button[data-icon-only] {
  width: var(--h);
  padding: 0;
}
/* primary: like the send button */
/* primary: a dark gradient with a light edge running down the border and a 1px ring */
.ui-button[data-variant="primary"] {
  background:
    linear-gradient(var(--ui-btn-dark-top), var(--ui-btn-dark-bottom)) padding-box,
    linear-gradient(var(--ui-btn-edge-top), var(--ui-btn-edge-mid), var(--ui-btn-edge-bottom)) border-box;
  color: var(--ui-btn-on-ink);
  box-shadow:
    0 0 0 1px var(--ui-btn-ring),
    0 2px 4px var(--ui-btn-dark-shadow);
}
.ui-button[data-variant="primary"]:hover:not(:disabled) {
  background:
    linear-gradient(var(--ui-btn-dark-hover-top), var(--ui-btn-dark-hover-bottom)) padding-box,
    linear-gradient(var(--ui-btn-edge-top), var(--ui-btn-edge-mid), var(--ui-btn-edge-bottom)) border-box;
}
/* secondary: white with the card outline */
.ui-button[data-variant="secondary"] {
  background: var(--ui-btn-surface);
  border-color: var(--ui-btn-line);
  color: var(--ui-btn-ink);
  box-shadow: 0 1px 2px var(--ui-btn-surface-shadow);
}
.ui-button[data-variant="secondary"]:hover:not(:disabled) {
  background: var(--ui-btn-surface-hover);
}
/* ghost: a muted label, the gray layer appears on hover */
.ui-button[data-variant="ghost"] {
  background: transparent;
  color: var(--ui-btn-muted);
}
.ui-button[data-variant="ghost"]:hover:not(:disabled) {
  background: var(--ui-btn-fill);
  color: var(--ui-btn-hover);
}
/* destructive: red label on a light red fill */
.ui-button[data-variant="destructive"] {
  background: var(--ui-btn-danger-bg);
  color: var(--ui-btn-danger);
}
.ui-button[data-variant="destructive"]:hover:not(:disabled) {
  background: color-mix(in srgb, var(--ui-btn-danger-bg) 88%, var(--ui-btn-danger));
}
.ui-button[data-variant="destructive"] .ui-button__label::after {
  --ui-btn-shine: rgba(255, 253, 251, 0.82);
}
.ui-button:active:not(:disabled):not([data-loading]) {
  transform: scale(0.97);
}
.ui-button:focus-visible {
  outline: 2px solid var(--ui-btn-focus);
  outline-offset: 2px;
}
.ui-button:disabled {
  opacity: 0.4;
  cursor: default;
}
.ui-button[data-loading] {
  cursor: default;
}
.ui-button__icon {
  display: grid;
  place-items: center;
  flex: none;
  width: var(--icon);
  height: var(--icon);
}
.ui-button__icon > svg {
  width: 100%;
  height: 100%;
}
/* Morph: the button clips while its width glides; changed parts blur in */
.ui-button {
  overflow: clip;
}
.ui-button[data-ready] .ui-button__label {
  animation: ui-button-label-in var(--nm-dur-4, 380ms) cubic-bezier(0.25, 1, 0.5, 1) both;
}
.ui-button[data-ready] .ui-button__icon {
  animation: ui-button-icon-in var(--nm-dur-5, 620ms) cubic-bezier(0.25, 1, 0.5, 1) both;
}
/* Loading: a band sweeps across a copy of the label, like "Request approval" in the Chat Composer */
.ui-button__label {
  position: relative;
}
.ui-button__label::after {
  content: attr(data-text);
  content: attr(data-text) / "";
  position: absolute;
  inset: 0;
  white-space: nowrap;
  color: transparent;
  background: linear-gradient(90deg, transparent 38%, var(--ui-btn-shine) 50%, transparent 62%) 100% 0 / 300% 100%
    no-repeat;
  -webkit-background-clip: text;
  background-clip: text;
  opacity: 0;
  pointer-events: none;
}
.ui-button[data-variant="primary"] .ui-button__label::after {
  --ui-btn-shine: var(--ui-btn-shine-on-ink);
}
.ui-button[data-loading] .ui-button__label {
  color: color-mix(in srgb, currentColor 55%, transparent);
}
.ui-button[data-loading] .ui-button__label::after {
  opacity: 1;
  animation: ui-button-sweep calc(var(--ui-btn-load) * 1.6) linear infinite;
}
.ui-button__spinner {
  animation: ui-button-spin var(--nm-dur-6, 1100ms) linear infinite;
}
@keyframes ui-button-label-in {
  from {
    opacity: 0;
    filter: blur(3px);
    transform: translateY(25%);
  }
}
@keyframes ui-button-icon-in {
  from {
    opacity: 0;
    filter: blur(2px);
    transform: scale(0.7);
  }
}
@keyframes ui-button-spin {
  to {
    transform: rotate(1turn);
  }
}
@keyframes ui-button-sweep {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: 0% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ui-button[data-ready] .ui-button__label,
  .ui-button[data-ready] .ui-button__icon {
    animation: none;
  }
  .ui-button {
    transition-duration: 1ms;
  }
  .ui-button[data-loading] .ui-button__label::after {
    animation: none;
    opacity: 0;
  }
}
/* Dark mode: follows a .dark class or data-theme="dark" on any ancestor, e.g. <html> */
:where(.dark, [data-theme="dark"]) .ui-button {
  /* primary inverts: a light gradient with dark text */
  --ui-btn-on-ink: #191411;
  --ui-btn-dark-top: #f4ece4;
  --ui-btn-dark-bottom: #dfd5cc;
  --ui-btn-dark-hover-top: #fffdfb;
  --ui-btn-dark-hover-bottom: #ebe3db;
  --ui-btn-edge-top: #fffdfb;
  --ui-btn-edge-mid: #ebe3db;
  --ui-btn-edge-bottom: #c8bdb2;
  --ui-btn-ring: rgba(11, 9, 8, 0.6);
  --ui-btn-dark-shadow: rgba(11, 9, 8, 0.4);
  --ui-btn-shine-on-ink: rgba(255, 253, 251, 0.9);
  --ui-btn-ink: #ebe3da;
  --ui-btn-surface: #27201a;
  --ui-btn-surface-hover: #2b231b;
  --ui-btn-surface-shadow: rgba(11, 9, 8, 0.4);
  --ui-btn-line: rgba(255, 253, 251, 0.1);
  --ui-btn-muted: #857567;
  --ui-btn-hover: #ebe3da;
  --ui-btn-fill: rgba(255, 253, 251, 0.06);
  --ui-btn-shine: rgba(235, 227, 218, 0.95);
  --ui-btn-danger: #e2544a;
  --ui-btn-danger-bg: rgba(226, 84, 74, 0.16);
  --ui-btn-focus: rgba(235, 227, 218, 0.3);
}
/* ui-kpi-chart — composed into this item */
.ui-kpi{--ui-kpi-card: #fffdfb;--ui-kpi-line: #e8e0d8;--ui-kpi-grid: #eee6de;--ui-kpi-ink: #1c1713;--ui-kpi-muted: #857567;--ui-kpi-up: #1a7a4a;--ui-kpi-down: #e2544a;--ui-kpi-guide: #ccc1b6;--ui-kpi-label: #4a3d2f;--ui-kpi-ring-gap: #fffdfb;--ui-kpi-ring: rgba(28, 23, 19, 0.25);--ui-kpi-shadow: 0 1px 2px rgba(11, 9, 8, 0.03), 0 8px 24px rgba(11, 9, 8, 0.035);--ui-kpi-tip-shadow: 0 8px 24px -6px rgba(11, 9, 8, 0.12), 0 2px 6px rgba(11, 9, 8, 0.04);--ui-kpi-ease: cubic-bezier(0.22, 1, 0.36, 1);box-sizing: border-box;width: 100%;max-width: 460px;padding: 20px 20px 18px;background: var(--ui-kpi-card);border: 1px solid var(--ui-kpi-line);border-radius: 20px;box-shadow: var(--ui-kpi-shadow);font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;color: var(--ui-kpi-ink);-webkit-font-smoothing: antialiased;font-variant-numeric: tabular-nums}
.ui-kpi *, .ui-kpi *::before, .ui-kpi *::after{box-sizing: border-box}
.ui-kpi__title{margin: 0;font-size: 14px;font-weight: 400;line-height: 20px;color: var(--ui-kpi-muted)}
.ui-kpi__value{display: flex;align-items: baseline;gap: 10px;margin: 8px 0 0;font-size: 28px;font-weight: 500;line-height: 34px;letter-spacing: -0.02em}
.ui-kpi__delta{font-size: 14px;font-weight: 450;letter-spacing: 0}
.ui-kpi__delta[data-trend="up"]{color: var(--ui-kpi-up)}
.ui-kpi__delta[data-trend="down"]{color: var(--ui-kpi-down)}
.ui-kpi__chart{display: grid;grid-template-columns: auto 1fr;grid-template-rows: 116px 20px;column-gap: 12px;row-gap: 8px;margin-top: 24px}
.ui-kpi__yaxis{display: flex;flex-direction: column;justify-content: space-between;margin: -9px 0;font-size: 12px;line-height: 18px;text-align: right;color: var(--ui-kpi-muted)}
.ui-kpi__plot{position: relative;touch-action: pan-y;outline: none;cursor: crosshair}
.ui-kpi__plot:focus-visible{border-radius: 4px;box-shadow: 0 0 0 4px var(--ui-kpi-ring-gap), 0 0 0 6px var(--ui-kpi-ring)}
.ui-kpi__grid{position: absolute;left: 0;right: 0;height: 1px;background: var(--ui-kpi-grid)}
.ui-kpi__lines{position: absolute;inset: 0;width: 100%;height: 100%;overflow: visible;animation: ui-kpi-draw 1100ms var(--ui-kpi-ease) both}
.ui-kpi__lines polyline{fill: none;stroke-width: 2;stroke-linecap: round;stroke-linejoin: round}
.ui-kpi__marker{position: absolute;inset: 0;pointer-events: none;opacity: 0;transition: opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-kpi__marker[data-open]{opacity: 1}
.ui-kpi__guide, .ui-kpi__dot{position: absolute;transition: left var(--nm-dur-3, 240ms) var(--ui-kpi-ease), top var(--nm-dur-3, 240ms) var(--ui-kpi-ease)}
.ui-kpi__guide{top: -4px;bottom: 0;width: 1px;margin-left: -0.5px;background: var(--ui-kpi-guide)}
.ui-kpi__dot{width: 10px;height: 10px;margin: -5px 0 0 -5px;border-radius: 50%;box-shadow: 0 0 0 2px var(--ui-kpi-card)}
.ui-kpi__tooltip{position: absolute;top: -12px;z-index: 2;min-width: 176px;padding: 10px 12px 12px;background: var(--ui-kpi-card);border: 1px solid var(--ui-kpi-line);border-radius: 12px;box-shadow: var(--ui-kpi-tip-shadow);pointer-events: none;opacity: 0;transform: translateX(var(--ui-kpi-shift)) scale(0.97);transition: left var(--nm-dur-3, 240ms) var(--ui-kpi-ease), opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-3, 240ms) var(--ui-kpi-ease)}
.ui-kpi__tooltip[data-side="right"]{--ui-kpi-shift: 14px;transform-origin: left top}
.ui-kpi__tooltip[data-side="left"]{--ui-kpi-shift: calc(-100% - 14px);transform-origin: right top}
.ui-kpi__tooltip[data-open]{opacity: 1;transform: translateX(var(--ui-kpi-shift))}
.ui-kpi__date{margin: 0 0 6px;font-size: 12px;line-height: 18px;color: var(--ui-kpi-muted)}
.ui-kpi__tooltip ul{display: grid;gap: 4px;margin: 0;padding: 0;list-style: none}
.ui-kpi__tooltip li{display: flex;align-items: center;gap: 8px;font-size: 13px;line-height: 20px}
.ui-kpi__swatch{flex: none;width: 10px;height: 2px;border-radius: 1px}
.ui-kpi__label{flex: 1;white-space: nowrap;color: var(--ui-kpi-label)}
.ui-kpi__num{padding-left: 16px;font-weight: 500}
.ui-kpi__xaxis{position: relative;grid-column: 2;font-size: 12px;line-height: 20px;color: var(--ui-kpi-muted)}
.ui-kpi__xaxis span{position: absolute;top: 0;white-space: nowrap;transform: translateX(-50%)}
.ui-kpi__xaxis span[data-edge="start"]{transform: none}
.ui-kpi__xaxis span[data-edge="end"]{transform: translateX(-100%)}
.ui-kpi__footer{margin: 16px 0 0;font-size: 13px;line-height: 18px;color: var(--ui-kpi-muted)}
@keyframes ui-kpi-draw{from{clip-path: inset(-10% 100% -10% 0)}
to{clip-path: inset(-10% -2% -10% 0)}
}
@media (prefers-reduced-motion: reduce){.ui-kpi__lines{animation: none}
.ui-kpi__marker, .ui-kpi__guide, .ui-kpi__dot, .ui-kpi__tooltip{transition: none}
}
:where(.dark, [data-theme="dark"]) .ui-kpi{--ui-kpi-card: #27201a;--ui-kpi-line: rgba(255, 253, 251, 0.08);--ui-kpi-grid: rgba(255, 253, 251, 0.06);--ui-kpi-ink: #ebe3da;--ui-kpi-muted: #857567;--ui-kpi-up: #2f8d5c;--ui-kpi-down: #e2544a;--ui-kpi-guide: rgba(255, 253, 251, 0.2);--ui-kpi-label: #b4a89d;--ui-kpi-ring-gap: #27201a;--ui-kpi-ring: rgba(235, 227, 218, 0.35);--ui-kpi-shadow: 0 1px 2px rgba(11, 9, 8, 0.4), 0 8px 24px rgba(11, 9, 8, 0.35);--ui-kpi-tip-shadow: 0 8px 24px -6px rgba(11, 9, 8, 0.5), 0 2px 6px rgba(11, 9, 8, 0.35), 0 0 0 0.5px rgba(255, 253, 251, 0.04)}
:where(.dark, [data-theme="dark"]) .ui-kpi__tooltip{background: #2b231b;border-color: rgba(255, 253, 251, 0.1)}
/* ui-inline-diff — composed into this item */
.ui-df{--ui-df-ink: #1c1713;--ui-df-text: #4a3d2f;--ui-df-muted: #807063;--ui-df-tray: #eee6de;--ui-df-line: #eae2d9;--ui-df-bg: #fffdfb;--ui-df-soft: #f4ece5;--ui-df-add: rgba(47, 141, 92, 0.1);--ui-df-add-strong: rgba(47, 141, 92, 0.18);--ui-df-add-ink: #1a7a4a;--ui-df-del: rgba(179, 38, 30, 0.08);--ui-df-del-strong: rgba(179, 38, 30, 0.15);--ui-df-del-ink: #b3261e;--ui-df-strike: rgba(179, 38, 30, 0.55);--ui-df-ok: #1a7a4a;--ui-df-pop: #1c1713;--ui-df-pop-ink: #fffdfb;--ui-df-pop-soft: rgba(255, 253, 251, 0.14);--ui-df-pop-kbd: rgba(255, 253, 251, 0.55);--ui-df-primary: #1c1713;--ui-df-primary-ink: #fffdfb;--ui-df-focus: rgba(28, 23, 19, 0.35);--ui-df-shadow: 0 1px 2px rgba(11, 9, 8, 0.04);--ui-df-ease: cubic-bezier(0.22, 1, 0.36, 1);position: relative;box-sizing: border-box;display: grid;width: 100%;min-width: 0;padding: 4px;border-radius: 20px;background: var(--ui-df-tray);color: var(--ui-df-text);font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;-webkit-font-smoothing: antialiased;text-align: left}
.ui-df *, .ui-df *::before, .ui-df *::after{box-sizing: border-box}
.ui-df__label{display: flex;align-items: center;gap: 6px;min-width: 0;padding: 6px 8px 4px;color: var(--ui-df-muted);font-size: 12.5px;line-height: 1.3;letter-spacing: -0.003em}
.ui-df__label span{overflow: hidden;text-overflow: ellipsis;white-space: nowrap}
.ui-df__label svg{flex: none;width: 13px;height: 13px;fill: currentColor}
.ui-df__card{position: relative;min-width: 0;border-radius: 16px;background: var(--ui-df-bg);box-shadow: 0 0 0 1px var(--ui-df-line), var(--ui-df-shadow)}
.ui-df__head{padding: 10px 10px 10px 16px;border-bottom: 1px solid var(--ui-df-line)}
.ui-df__bar{display: grid}
.ui-df__layer{grid-area: 1 / 1;display: flex;flex-wrap: wrap;align-items: center;justify-content: space-between;gap: 8px;min-width: 0;opacity: 0;visibility: hidden;transform: translateY(4px);filter: blur(2px);transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-4, 380ms) var(--ui-df-ease), filter var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), visibility 0s 420ms}
.ui-df__layer[data-show]{opacity: 1;visibility: visible;transform: none;filter: none;transition: opacity var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 80ms, transform var(--nm-dur-4, 380ms) var(--ui-df-ease) 80ms, filter var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 80ms, visibility 0s}
.ui-df__card{container: ui-df-card / inline-size}
@container ui-df-card (max-width: 400px){.ui-df__word{position: absolute;width: 1px;height: 1px;overflow: hidden;clip: rect(0 0 0 0);white-space: nowrap}
}
.ui-df__count{display: inline-flex;align-items: center;gap: 7px;color: var(--ui-df-ink);font-size: 13px;font-weight: 500;line-height: 1;letter-spacing: -0.006em;white-space: nowrap}
.ui-df__num{display: inline-grid;place-items: center;min-width: 20px;height: 20px;padding: 0 6px;border-radius: 999px;background: var(--ui-df-add);color: var(--ui-df-add-ink);font-size: 11.5px;font-weight: 600;font-variant-numeric: tabular-nums}
.ui-df__ok{width: 16px;height: 16px;fill: none;stroke: var(--ui-df-ok);stroke-width: 1.8;stroke-linecap: round;stroke-linejoin: round;stroke-dasharray: 1;stroke-dashoffset: 1}
.ui-df[data-done] .ui-df__ok{animation: ui-df-draw var(--nm-dur-4, 380ms) var(--ui-df-ease) 220ms forwards}
.ui-df__actions{display: inline-flex;align-items: center;gap: 6px;margin-left: auto}
.ui-df__nav{display: inline-flex;gap: 2px;margin-right: 2px}
.ui-df__btn, .ui-df__icon{appearance: none;display: inline-flex;align-items: center;justify-content: center;gap: 6px;height: 30px;margin: 0;border: 0;border-radius: 8px;background: transparent;color: var(--ui-df-ink);font: inherit;font-size: 13px;font-weight: 500;line-height: 1;letter-spacing: -0.006em;white-space: nowrap;cursor: pointer;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform 160ms var(--ui-df-ease);-webkit-tap-highlight-color: transparent}
.ui-df__btn{padding: 0 11px;box-shadow: inset 0 0 0 1px var(--ui-df-line)}
.ui-df__icon{width: 28px;color: var(--ui-df-muted)}
.ui-df__btn svg, .ui-df__icon svg{width: 14px;height: 14px;fill: none;stroke: currentColor;stroke-width: 1.6;stroke-linecap: round;stroke-linejoin: round}
.ui-df__btn:hover:not(:disabled){background: var(--ui-df-soft)}
.ui-df__icon:hover:not(:disabled){background: var(--ui-df-soft);color: var(--ui-df-ink)}
.ui-df__btn--primary{background: var(--ui-df-primary);color: var(--ui-df-primary-ink);box-shadow: none}
.ui-df__btn--primary:hover:not(:disabled){background: var(--ui-df-primary);opacity: 0.88}
.ui-df__btn:active:not(:disabled), .ui-df__icon:active:not(:disabled){transform: scale(0.97)}
.ui-df__btn:disabled, .ui-df__icon:disabled{opacity: 0.4;cursor: default}
.ui-df__btn:focus-visible, .ui-df__icon:focus-visible{outline: 2px solid var(--ui-df-focus);outline-offset: 2px}
.ui-df__body{padding: 16px 18px 18px}
.ui-df__text{margin: 0;color: var(--ui-df-text);font-size: 15px;line-height: 1.65;letter-spacing: -0.006em;white-space: pre-line;overflow-wrap: anywhere}
.ui-df__chg{border-radius: 4px;cursor: pointer;scroll-margin: 64px 0 24px}
.ui-df__chg:not([data-state="pending"]){cursor: auto}
.ui-df__chg:focus{outline: none}
.ui-df__chg:focus-visible{outline: 2px solid var(--ui-df-focus);outline-offset: 2px}
.ui-df__del, .ui-df__ins{padding: 1px 2px;border-radius: 4px;-webkit-box-decoration-break: clone;box-decoration-break: clone;font-size: 1em;transition: background-color var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), text-decoration-color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), font-size var(--nm-dur-4, 380ms) var(--ui-df-ease), padding var(--nm-dur-4, 380ms) var(--ui-df-ease), margin var(--nm-dur-4, 380ms) var(--ui-df-ease), opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-df__del{background: var(--ui-df-del);color: var(--ui-df-del-ink);text-decoration: line-through;text-decoration-color: var(--ui-df-strike);text-decoration-thickness: 1.2px}
.ui-df__ins{background: var(--ui-df-add);color: var(--ui-df-add-ink);text-decoration: none}
.ui-df__del + .ui-df__ins{margin-left: 3px}
.ui-df__chg[data-active] .ui-df__del{background: var(--ui-df-del-strong)}
.ui-df__chg[data-active] .ui-df__ins{background: var(--ui-df-add-strong)}
.ui-df__chg[data-state="accepted"] .ui-df__del, .ui-df__chg[data-state="rejected"] .ui-df__ins{font-size: 0;padding: 0;margin: 0;opacity: 0}
.ui-df__chg[data-state="accepted"] .ui-df__ins, .ui-df__chg[data-state="rejected"] .ui-df__del{padding: 0;margin: 0;background: transparent;color: inherit;text-decoration-color: transparent}
.ui-df__pop{position: absolute;top: 0;left: 0;z-index: 2;display: flex;align-items: center;gap: 2px;padding: 3px;border-radius: 10px;background: var(--ui-df-pop);color: var(--ui-df-pop-ink);box-shadow: 0 6px 20px -6px rgba(11, 9, 8, 0.35), 0 1px 2px rgba(11, 9, 8, 0.2);opacity: 0;visibility: hidden;transform: translateY(4px) scale(0.96);transform-origin: 50% 100%;pointer-events: none;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-3, 240ms) var(--ui-df-ease), left var(--nm-dur-4, 380ms) var(--ui-df-ease), top var(--nm-dur-4, 380ms) var(--ui-df-ease), visibility 0s 260ms}
.ui-df__pop[data-open]{opacity: 1;visibility: visible;transform: none;pointer-events: auto;transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-3, 240ms) var(--ui-df-ease), left var(--nm-dur-4, 380ms) var(--ui-df-ease), top var(--nm-dur-4, 380ms) var(--ui-df-ease), visibility 0s}
.ui-df__pop[data-snap]{transition-property: opacity, transform, visibility}
.ui-df__pbtn{appearance: none;display: inline-flex;align-items: center;gap: 6px;height: 28px;margin: 0;padding: 0 8px 0 7px;border: 0;border-radius: 7px;background: transparent;color: inherit;font: inherit;font-size: 12.5px;font-weight: 500;line-height: 1;white-space: nowrap;cursor: pointer;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-df__pbtn:hover{background: var(--ui-df-pop-soft)}
.ui-df__pbtn svg{width: 14px;height: 14px;fill: none;stroke: currentColor;stroke-width: 1.8;stroke-linecap: round;stroke-linejoin: round}
.ui-df__pbtn kbd{display: inline-grid;place-items: center;min-width: 17px;height: 17px;padding: 0 4px;border-radius: 4px;background: var(--ui-df-pop-soft);color: var(--ui-df-pop-kbd);font: inherit;font-size: 10.5px;font-weight: 500}
.ui-df__sep{width: 1px;height: 16px;background: var(--ui-df-pop-soft)}
.ui-df__sr{position: absolute;width: 1px;height: 1px;margin: -1px;padding: 0;overflow: hidden;clip: rect(0 0 0 0);white-space: nowrap;border: 0}
@keyframes ui-df-draw{to{stroke-dashoffset: 0}
}
@media (max-width: 400px){.ui-df__nav{display: none}
.ui-df__head{padding-left: 14px}
.ui-df__label{padding-left: 6px}
.ui-df__body{padding: 14px 14px 16px}
}
@media (hover: none) and (pointer: coarse){.ui-df__pbtn kbd{display: none}
.ui-df__pbtn{height: 34px;padding: 0 11px 0 9px}
}
@media (prefers-reduced-motion: reduce){.ui-df *, .ui-df *::before, .ui-df *::after{animation-duration: 1ms !important;animation-delay: 0ms !important;transition-duration: 1ms !important;transition-delay: 0ms !important}
.ui-df__layer{filter: none;transform: none}
}
:where(.dark, [data-theme="dark"]) .ui-df{--ui-df-ink: #ebe3da;--ui-df-text: #a6998e;--ui-df-muted: #847467;--ui-df-tray: #181310;--ui-df-line: #2c241b;--ui-df-bg: #1e1914;--ui-df-soft: #27201a;--ui-df-add: rgba(47, 141, 92, 0.13);--ui-df-add-strong: rgba(47, 141, 92, 0.22);--ui-df-add-ink: #4f9d6e;--ui-df-del: rgba(226, 84, 74, 0.12);--ui-df-del-strong: rgba(226, 84, 74, 0.2);--ui-df-del-ink: #f0938c;--ui-df-strike: rgba(240, 147, 140, 0.6);--ui-df-ok: #4f9d6e;--ui-df-pop: #f4ece4;--ui-df-pop-ink: #1c1713;--ui-df-pop-soft: rgba(11, 9, 8, 0.08);--ui-df-pop-kbd: rgba(11, 9, 8, 0.5);--ui-df-primary: #ebe3da;--ui-df-primary-ink: #1e1914;--ui-df-focus: rgba(255, 253, 251, 0.35);--ui-df-shadow: 0 1px 2px rgba(11, 9, 8, 0.3)}
/* ui-segmented-control — composed into this item */
/* Animatable custom properties: the equal segment width and the soft edges glide too */
@property --ui-seg-min { syntax: "<length>"; inherits: true; initial-value: 0px; }
@property --ui-seg-fade-l { syntax: "<length>"; inherits: false; initial-value: 0px; }
@property --ui-seg-fade-r { syntax: "<length>"; inherits: false; initial-value: 0px; }
.ui-seg {
  --ui-seg-tray: #eee6de;
  --ui-seg-pill: #fffdfb;
  --ui-seg-line: #eae2d9;
  --ui-seg-ink: #1c1713;
  --ui-seg-text: #3d3226;
  --ui-seg-soft: #68584b;
  --ui-seg-muted: #857567;
  --ui-seg-count: rgba(11, 9, 8, 0.06);
  --ui-seg-accent: #ff6b35;
  --ui-seg-accent-soft: rgba(255, 107, 53, 0.1);
  --ui-seg-pill-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 1px 2px rgba(11, 9, 8, 0.08), 0 2px 8px -2px rgba(11, 9, 8, 0.06);
  --ui-seg-focus: rgba(28, 23, 19, 0.22);
  --ui-seg-ease: cubic-bezier(0.22, 1, 0.36, 1);
  /* Size: md */
  --ui-seg-h: 30px;
  --ui-seg-px: 12px;
  --ui-seg-fs: 13.5px;
  --ui-seg-r: 11px;
  --ui-seg-pad: 3px;
  --ui-seg-icon: 15px;
  --ui-seg-gap: 20px;
  box-sizing: border-box;
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  vertical-align: middle;
  border-radius: var(--ui-seg-r);
  background: var(--ui-seg-tray);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: var(--ui-seg-fs);
  line-height: 1;
  color: var(--ui-seg-soft);
  -webkit-font-smoothing: antialiased;
}
.ui-seg[data-size="sm"] { --ui-seg-h: 26px; --ui-seg-px: 10px; --ui-seg-fs: 12.5px; --ui-seg-r: 9px; --ui-seg-pad: 2px; --ui-seg-icon: 14px; --ui-seg-gap: 16px; }
.ui-seg[data-size="lg"] { --ui-seg-h: 36px; --ui-seg-px: 16px; --ui-seg-fs: 14px; --ui-seg-r: 13px; --ui-seg-pad: 4px; --ui-seg-icon: 16px; --ui-seg-gap: 24px; }
.ui-seg[data-full] { display: flex; width: 100%; }
.ui-seg[data-disabled] { opacity: 0.5; pointer-events: none; }
.ui-seg *, .ui-seg *::before, .ui-seg *::after { box-sizing: border-box; }
:where(.ui-seg) button { margin: 0; border: 0; background: none; font: inherit; color: inherit; cursor: pointer; }
:where(.ui-seg) svg { display: block; flex: none; }
/* Scrolls sideways only when it doesn't fit; the padding keeps focus rings from being cut off */
.ui-seg__scroller {
  position: relative;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding: var(--ui-seg-pad);
  border-radius: inherit;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  -webkit-mask-image: linear-gradient(to right, transparent, #0b0908 var(--ui-seg-fade-l), #0b0908 calc(100% - var(--ui-seg-fade-r)), transparent);
  mask-image: linear-gradient(to right, transparent, #0b0908 var(--ui-seg-fade-l), #0b0908 calc(100% - var(--ui-seg-fade-r)), transparent);
  transition: --ui-seg-fade-l var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), --ui-seg-fade-r var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-seg__scroller::-webkit-scrollbar { display: none; }
.ui-seg__track {
  position: relative;
  display: flex;
  width: max-content;
  min-width: 100%;
  /* Horizontal drags move the pill; vertical ones still scroll the page */
  touch-action: pan-y;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
/* When it scrolls, swipes scroll it instead of dragging the pill */
.ui-seg[data-overflow] .ui-seg__track { touch-action: pan-x pan-y; }
/* Equal segments, each as wide as the widest one needs */
.ui-seg[data-full] .ui-seg__track { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(var(--ui-seg-min), 1fr); }
.ui-seg[data-ready] .ui-seg__track { transition: --ui-seg-min var(--nm-dur-4, 380ms) var(--ui-seg-ease); }
/* An option */
.ui-seg__opt {
  position: relative;
  z-index: 1;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  height: var(--ui-seg-h);
  padding: 0 var(--ui-seg-px);
  overflow: clip;
  border-radius: calc(var(--ui-seg-r) - var(--ui-seg-pad));
  white-space: nowrap;
  transition: color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-seg[data-ready]:not([data-full]) .ui-seg__opt { transition: color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), width var(--nm-dur-4, 380ms) var(--ui-seg-ease); }
.ui-seg__opt[data-active] { color: var(--ui-seg-ink); }
.ui-seg__opt:disabled { opacity: 0.4; cursor: not-allowed; }
.ui-seg__opt:focus-visible { outline: 2px solid var(--ui-seg-focus); outline-offset: 0; }
@media (hover: hover) {
  .ui-seg__opt:not([data-active]):not(:disabled):hover { color: var(--ui-seg-text); }
}
.ui-seg__content { display: inline-flex; flex: none; align-items: center; gap: 6px; }
.ui-seg__icon { display: grid; place-items: center; width: var(--ui-seg-icon); height: var(--ui-seg-icon); }
.ui-seg__icon svg { width: 100%; height: 100%; }
/* Regular and semibold copies of the label crossfade */
.ui-seg__label { display: grid; justify-items: center; }
.ui-seg__text { grid-area: 1 / 1; font-weight: 500; transition: opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)); }
.ui-seg__text-bold { font-weight: 600; opacity: 0; }
.ui-seg__opt[data-active] .ui-seg__text { opacity: 0; }
.ui-seg__opt[data-active] .ui-seg__text-bold { opacity: 1; }
.ui-seg__count {
  display: inline-grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--ui-seg-count);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--ui-seg-text);
  animation: ui-seg-in var(--nm-dur-3, 240ms) var(--ui-seg-ease) both;
}
.ui-seg[data-size="sm"] .ui-seg__count { min-width: 16px; height: 16px; padding: 0 4px; font-size: 10.5px; }
.ui-seg__badge {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 6px;
  background: var(--ui-seg-accent-soft);
  font-size: 11px;
  font-weight: 500;
  color: var(--ui-seg-accent);
}
/* The indicator: left and right edges glide separately – the one facing the target leads, so it stretches and settles */
.ui-seg__pill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 100%;
  z-index: 0;
  border-radius: calc(var(--ui-seg-r) - var(--ui-seg-pad));
  background: var(--ui-seg-pill);
  box-shadow: var(--ui-seg-pill-shadow);
  opacity: 0;
  pointer-events: none;
  transition: left 380ms var(--ui-seg-ease), right 380ms var(--ui-seg-ease), scale var(--nm-dur-2, 160ms) var(--ui-seg-ease), opacity 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.ui-seg__pill[data-dir="right"] { transition-duration: var(--nm-dur-4, 380ms), var(--nm-dur-3, 240ms), var(--nm-dur-2, 160ms), 160ms; }
.ui-seg__pill[data-dir="left"] { transition-duration: var(--nm-dur-3, 240ms), var(--nm-dur-4, 380ms), var(--nm-dur-2, 160ms), 160ms; }
/* Press feedback: the pill gives a little while held or dragged */
.ui-seg[data-pressed]:not([data-variant="underline"]) .ui-seg__pill { scale: 0.97; }
/* Underline variant: text tabs on a hairline */
.ui-seg[data-variant="underline"] { --ui-seg-px: 2px; border-radius: 0; background: none; box-shadow: inset 0 -1px 0 var(--ui-seg-line); }
.ui-seg[data-variant="underline"] .ui-seg__scroller { padding: 0; }
.ui-seg[data-variant="underline"]:not([data-full]) .ui-seg__track { gap: var(--ui-seg-gap); }
.ui-seg[data-variant="underline"][data-full] { --ui-seg-px: 10px; }
.ui-seg[data-variant="underline"] .ui-seg__opt { height: calc(var(--ui-seg-h) + 6px); border-radius: 6px; }
.ui-seg[data-variant="underline"] .ui-seg__opt:focus-visible { outline-offset: -2px; }
.ui-seg[data-variant="underline"] .ui-seg__pill { top: auto; height: 2px; border-radius: 2px 2px 0 0; background: var(--ui-seg-ink); box-shadow: none; }
@keyframes ui-seg-in { from { opacity: 0; transform: translateY(3px); filter: blur(2px); }
 to { opacity: 1; transform: none; filter: none; }
 }
/* Touch screens: every option at least 40px tall */
@media (hover: none) and (pointer: coarse) {
  .ui-seg[data-size] { --ui-seg-h: 40px; }
  .ui-seg[data-size="lg"] { --ui-seg-h: 44px; }
  .ui-seg[data-variant="underline"] .ui-seg__opt { height: var(--ui-seg-h); }
}
@media (prefers-reduced-motion: reduce) {
  .ui-seg *, .ui-seg *::before, .ui-seg *::after { animation: none !important; transition: none !important; }
}
/* Dark mode: follows a .dark class or data-theme="dark" on any ancestor, e.g. <html> */
:where(.dark, [data-theme="dark"]) .ui-seg {
  --ui-seg-tray: #181310;
  --ui-seg-pill: #29221b;
  --ui-seg-line: #2c241b;
  --ui-seg-ink: #ebe3da;
  --ui-seg-text: #baaea3;
  --ui-seg-soft: #847467;
  --ui-seg-muted: #847467;
  --ui-seg-count: rgba(255, 253, 251, 0.08);
  --ui-seg-accent: #ff8a5c;
  --ui-seg-accent-soft: rgba(255, 138, 92, 0.14);
  --ui-seg-pill-shadow: 0 0 0 1px rgba(255, 253, 251, 0.06), 0 1px 2px rgba(11, 9, 8, 0.4);
  --ui-seg-focus: rgba(255, 253, 251, 0.3);
}
.ui-ev{--ev-pass: #2f8d5c;--ev-pass-soft: rgba(47, 141, 92, 0.1);--ev-partial: #d9541f;--ev-partial-dot: #d99530;--ev-partial-soft: rgba(217, 149, 48, 0.13);--ev-fail: #b3261e;--ev-fail-soft: rgba(179, 38, 30, 0.09);--ev-run: #ff6b35;--ev-run-soft: rgba(255, 107, 53, 0.1);display: flex;flex-direction: column;min-height: 100%}
:where(.dark, [data-theme="dark"]) .ui-ev{--ev-pass: #4f9d6e;--ev-pass-soft: rgba(79, 157, 110, 0.12);--ev-partial: #e8b05c;--ev-partial-soft: rgba(232, 176, 92, 0.13);--ev-fail: #e2544a;--ev-fail-soft: rgba(226, 84, 74, 0.13);--ev-run: #ff8a5c;--ev-run-soft: rgba(255, 138, 92, 0.15)}
.ui-ev__head{position: relative;display: flex;flex: none;align-items: center;justify-content: space-between;gap: 12px;height: 60px;padding: 0 16px 0 24px}
.ui-ev__title{display: flex;align-items: center;gap: 8px;min-width: 0}
.ui-ev__title h1{display: flex;align-items: center;gap: 8px;margin: 0 4px 0 0;font-size: 16px;font-weight: 500;color: var(--ink);white-space: nowrap}
.ui-ev__chip{display: inline-flex;align-items: center;gap: 6px;height: 28px;padding: 0 10px;border-radius: 8px;background: var(--chip);font-size: 12.5px;color: var(--text);white-space: nowrap}
.ui-ev__chip:not(.ui-ev__chip--btn){font-family: ui-monospace, "SF Mono", Menlo, monospace;font-size: 12px}
.ui-ev__chip--btn{font-weight: 500;color: var(--ink);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-ev__chip--btn:hover, .ui-ev__chip--btn[aria-expanded="true"]{background: var(--chip-hover)}
.ui-ev__current{font-weight: 400;color: var(--muted)}
.ui-ev__actions{display: flex;align-items: center;gap: 12px}
.ui-ev__meta{font-size: 13px;color: var(--muted);font-variant-numeric: tabular-nums;white-space: nowrap}
.ui-ev__progress{position: absolute;left: 16px;right: 16px;bottom: 0;height: 2px;border-radius: 1px;overflow: hidden;background: var(--line);opacity: 0;transition: opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-ev__progress[data-on]{opacity: 1}
.ui-ev__progress i{display: block;height: 100%;border-radius: 1px;background: var(--ev-run);transition: width var(--nm-dur-2, 160ms) var(--ease)}
.ui-ev__content{display: grid;flex: 1;grid-template-columns: minmax(0, 1fr) 400px;grid-template-rows: auto auto minmax(380px, 1fr);gap: 12px;padding: 12px 16px 16px}
.ui-ev__card{border-radius: 14px;background: var(--card);box-shadow: 0 0 0 1px var(--line), var(--shadow)}
.ui-ev__cap{font-size: 13px;color: var(--muted)}
.ui-ev__stats{grid-column: 1 / -1;display: grid;grid-template-columns: repeat(4, minmax(0, 1fr));gap: 12px}
.ui-ev__stat{display: grid;grid-template-columns: 1fr auto;align-items: baseline;row-gap: 8px;padding: 14px 16px}
.ui-ev__stat .ui-ev__cap{grid-column: 1 / -1}
.ui-ev__stat strong{font-size: 22px;font-weight: 500;letter-spacing: -0.02em;color: var(--ink);font-variant-numeric: tabular-nums}
.ui-ev__stat small{margin-left: 1px;font-size: 13px;font-weight: 400;letter-spacing: 0;color: var(--faint)}
.ui-ev__delta{font-size: 12px;font-weight: 500;color: var(--ev-fail);font-variant-numeric: tabular-nums}
.ui-ev__delta[data-good]{color: var(--ev-pass)}
.ui-ev__delta span{font-weight: 400;color: var(--faint)}
.ui-ev .ui-ev__chart.ui-kpi{--ui-kpi-shadow: 0 0 0 1px var(--line), var(--shadow);display: flex;flex-direction: column;width: 100%;max-width: none;border: 0;border-radius: 14px}
.ui-ev .ui-ev__chart .ui-kpi__chart{flex: 1;grid-template-rows: minmax(116px, 1fr) 20px}
.ui-ev .ui-ev__diff.ui-df{align-self: stretch;align-content: stretch;grid-template-rows: auto minmax(0, 1fr);border-radius: 16px}
.ui-ev .ui-ev__diff .ui-df__card{display: flex;flex-direction: column}
.ui-ev .ui-ev__diff .ui-df__card{border-radius: 12px}
.ui-ev .ui-ev__diff .ui-df__body{padding: 12px 16px 14px}
.ui-ev .ui-ev__diff .ui-df__text{font-size: 13.5px;line-height: 1.6}
.ui-ev__cases{position: relative;display: flex;flex-direction: column;grid-column: 1 / -1;min-height: 0;margin-top: 26px;overflow: hidden}
.ui-ev__cases-head{display: flex;flex: none;align-items: center;justify-content: space-between;gap: 12px;height: 32px;margin-bottom: 10px;padding-left: 2px}
.ui-ev__cases-head h2{display: flex;align-items: center;gap: 6px;margin: 0;font-size: 16px;line-height: 22px;font-weight: 500;letter-spacing: -0.01em;color: var(--ink)}
.ui-ev__cases-head h2 span{font-weight: 400;color: var(--faint)}
.ui-ev__scroll{position: absolute;inset: 42px 0 0;overflow: auto;overscroll-behavior: contain;padding: 0 4px 4px;border-radius: 18px;background: var(--tray)}
.ui-ev__table{width: 100%;border-collapse: separate;border-spacing: 0;table-layout: fixed;font-size: 13px}
.ui-ev__table th{position: sticky;z-index: 1;top: 0;height: 34px;padding: 0 12px;background: var(--tray);font-weight: 500;font-size: 12px;text-align: left;color: var(--muted)}
.ui-ev__table th:nth-child(1){width: 30%;padding-left: 16px}
.ui-ev__table th:nth-child(2){width: 22%}
.ui-ev__table th:nth-child(4){width: 112px}
.ui-ev__table th:nth-child(5){width: 76px;padding-right: 16px;text-align: right}
.ui-ev__table td{height: 40px;padding: 0 12px;background: var(--card);color: var(--ink);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-ev__table tbody tr + tr td{border-top: 1px solid var(--line-soft)}
.ui-ev__table tbody tr:first-child td{border-top: 1px solid var(--line)}
.ui-ev__table tbody tr:last-child td{border-bottom: 1px solid var(--line)}
.ui-ev__table tbody td:first-child{border-left: 1px solid var(--line)}
.ui-ev__table tbody td:last-child{border-right: 1px solid var(--line)}
.ui-ev__table tbody tr:first-child td:first-child{border-top-left-radius: 14px}
.ui-ev__table tbody tr:first-child td:last-child{border-top-right-radius: 14px}
.ui-ev__table tbody tr:last-child td:first-child{border-bottom-left-radius: 14px}
.ui-ev__table tbody tr:last-child td:last-child{border-bottom-right-radius: 14px}
.ui-ev__table td:first-child{padding-left: 16px}
.ui-ev__table td:last-child{padding-right: 16px}
.ui-ev__in{display: flex;align-items: center;gap: 8px;min-width: 0}
.ui-ev__table tbody tr{cursor: pointer}
.ui-ev__table tbody tr:hover td{background: color-mix(in srgb, var(--card), var(--ink) 3.5%)}
.ui-ev__table tbody tr[aria-selected="true"] td{background: color-mix(in srgb, var(--card), var(--ink) 5.5%)}
.ui-ev__table tbody tr[data-state="running"] td{background: linear-gradient(var(--ev-run-soft), var(--ev-run-soft)), var(--card)}
.ui-ev__table tbody tr:focus-visible{outline: 2px solid var(--accent);outline-offset: -2px}
.ui-ev__table tbody tr[data-state="queued"] td{color: var(--faint)}
.ui-ev__trunc{display: block;min-width: 0;overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-ev__soft{color: var(--muted)}
.ui-ev__id{flex: none;font-family: ui-monospace, "SF Mono", Menlo, monospace;font-size: 11.5px;color: var(--faint)}
.ui-ev__num{text-align: right;color: var(--muted) !important;font-variant-numeric: tabular-nums}
.ui-ev__pill{display: inline-flex;align-items: center;gap: 5px;height: 22px;padding: 0 8px;border-radius: 6px;font-size: 12px;font-weight: 500;white-space: nowrap;animation: ui-ev-pop var(--nm-dur-4, 380ms) var(--ease) both}
.ui-ev__pill > i:not(.ui-ev__spin){width: 6px;height: 6px;border-radius: 50%;background: currentColor}
.ui-ev__pill > span{font-weight: 400;opacity: 0.75;font-variant-numeric: tabular-nums}
.ui-ev__pill[data-v="pass"]{background: var(--ev-pass-soft);color: var(--ev-pass)}
.ui-ev__pill[data-v="partial"]{background: var(--ev-partial-soft);color: var(--ev-partial)}
.ui-ev__pill[data-v="fail"]{background: var(--ev-fail-soft);color: var(--ev-fail)}
.ui-ev__pill[data-v="queued"]{background: var(--chip);color: var(--faint);font-weight: 400;animation: none}
.ui-ev__pill[data-v="running"]{background: var(--ev-run-soft);color: var(--ev-run);animation: none}
.ui-ev__spin{width: 10px;height: 10px;border: 1.5px solid currentColor;border-right-color: transparent;border-radius: 50%;animation: ui-ev-spin var(--nm-dur-5, 620ms) linear infinite}
@keyframes ui-ev-pop{from{opacity: 0;transform: scale(0.85)}
to{opacity: 1;transform: none}
}
@keyframes ui-ev-spin{to{transform: rotate(1turn)}
}
.ui-ev__input{margin: -4px 0 0;font-size: 15px;font-weight: 500;line-height: 1.45;color: var(--ink)}
.ui-ev__field{display: grid;gap: 4px}
.ui-ev__field p{margin: 0;font-size: 13px;line-height: 1.5;color: var(--text)}
.ui-ev__foot{display: flex;align-items: center;gap: 6px;margin-top: auto;font-size: 12px;color: var(--faint)}
.ui-ev__head{transition: padding-left var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-app[data-collapsed] .ui-ev__head{padding-left: 52px}
@container ui-as-main (max-width: 1000px){.ui-ev__content{grid-template-columns: minmax(0, 1fr);grid-template-rows: none}
.ui-ev__cases{height: 440px}
}
@container ui-as-main (max-width: 820px){.ui-ev__stats{grid-template-columns: repeat(2, minmax(0, 1fr))}
.ui-ev__table{min-width: 720px}
}
@container ui-as-main (max-width: 560px){.ui-ev__stats{gap: 8px}
.ui-ev__stat{padding: 12px}
.ui-ev__stat strong{font-size: 19px}
.ui-ev__cases-head{flex-wrap: wrap}
.ui-ev__scroll{top: 84px}
}
@container ui-as (max-width: 900px){.ui-ev__head{padding-left: 52px}
.ui-ev__meta{display: none}
}
@container ui-as (max-width: 600px){.ui-ev__head{flex-wrap: wrap;row-gap: 10px;height: auto;padding: 14px 8px 12px 52px}
.ui-ev__title{flex-wrap: wrap;row-gap: 8px}
.ui-ev__title h1{width: 100%}
.ui-ev__actions{margin-left: auto}
.ui-ev__content{gap: 8px;padding: 8px 8px 8px}
}

`;
