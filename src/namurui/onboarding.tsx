"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/*
 * Onboarding – the first run of an AI workspace, inside the app shell.
 *
 * Four stages: name the workspace, connect the tools agents may read from, invite the team and
 * create the first agent. The header names the stage you are on and counts the steps; the card
 * holds one stage at a time and glides in from the side it was entered from. A setup checklist
 * sits beside it, marking done, current and skipped stages and letting you jump back to one.
 * Skipping a stage is a first-class outcome: the checklist draws a dash instead of a check.
 *
 * The tool rows are switches – an unconnected tool goes busy for a beat, then reports Connected.
 * Invitees become chips (Enter or comma commits, an invalid or repeated address is refused), and
 * the template cards on the last stage are a radio group. The flow ends on a summary panel whose
 * rows lead into the workspace; the primary button there hands every collected value to
 * onComplete. All motion is defined by the sheet and removed under reduced motion.
 *
 * The styles are injected below, so no extra files are needed.
 */

/** The four stages, in order. */
export type OnboardingStageId = "workspace" | "tools" | "team" | "agent";

/** One tool an agent can be allowed to use. */
export type OnboardingTool = {
  /** Stable id, used as the list key and in `onComplete` */
  id: string;
  /** Product name beside the mark */
  name: string;
  /** One line of why it helps; the sheet ellipsises it */
  description: string;
  /** Brand mark on a 24 grid */
  icon: ReactNode;
  /** Already authorized when the screen opens */
  connected?: boolean;
  /** Solid brand tile: fills the logo tile and drops its hairline */
  tint?: string;
};

/** A teammate who has been put on the invite list. */
export type OnboardingInvite = {
  /** Stable id, used as the chip key */
  id: string;
  /** Address the invitation goes to */
  email: string;
  /** Two letters on the chip; derived from the address when omitted */
  initials?: string;
};

/** What an invited teammate may do. */
export type OnboardingRole = "Admin" | "Member" | "Viewer";

/** A starting point for the first agent. */
export type OnboardingTemplate = {
  /** Stable id, used as the key and in `onComplete` */
  id: string;
  /** Card heading */
  name: string;
  /** Two lines on what the agent does */
  description: string;
  /** Footer line, e.g. what it starts with */
  meta: string;
  /** Glyph on the card */
  icon: ReactNode;
};

/** Everything the flow collected, handed to onComplete. */
export type OnboardingValues = {
  /** Workspace name as typed */
  workspace: string;
  /** Workspace slug as typed, without the domain */
  slug: string;
  /** Ids of the tools left switched on */
  tools: string[];
  /** Addresses on the invite list */
  invites: string[];
  /** Role the invitees will get */
  role: OnboardingRole;
  /** Id of the chosen template, "" when the stage was skipped */
  template: string;
  /** Name of the first agent, "" when the stage was skipped */
  agentName: string;
};

export type OnboardingScreenProps = {
  /** Called with every collected value when the summary's primary button is pressed */
  onComplete?: (values: OnboardingValues) => void;
  /** Stage to open on (1–4); the stages before it read as done. Default 1 */
  defaultStep?: 1 | 2 | 3 | 4;
  /** Workspace name: the sidebar, the greeting, the checklist and the invites */
  workspace?: string;
  /** Account at the foot of the sidebar; the first name greets the user */
  user?: { name: string; initials?: string };
  /** Tools on the tools stage */
  tools?: OnboardingTool[];
  /** Teammates already on the invite list */
  invites?: OnboardingInvite[];
  /** Templates on the agent stage */
  templates?: OnboardingTemplate[];
  /** Share of the sidebar's getting-started card that is done, 0–100 */
  progress?: number;
  /** Called with the label of a sidebar item, the help row or a summary row */
  onNavigate?: (label: string) => void;
  /** Extra class on the root */
  className?: string;
};

type Stage = {
  id: OnboardingStageId;
  /** Short label in the header's progress rail */
  label: string;
  /** Longer label in the setup checklist */
  checklist: string;
};

const STAGES: Stage[] = [
  { id: "workspace", label: "Workspace", checklist: "Workspace" },
  { id: "tools", label: "Tools", checklist: "Connect your tools" },
  { id: "team", label: "Team", checklist: "Invite your team" },
  { id: "agent", label: "Agent", checklist: "Your first agent" },
];

const ROLES: OnboardingRole[] = ["Admin", "Member", "Viewer"];

/* ---------- icons: lifted verbatim from the reference DOM ---------- */

const IconPanel = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
    <path d="M2 12C2 8.31087 2 6.4663 2.81382 5.15877C3.1149 4.67502 3.48891 4.25427 3.91891 3.91554C5.08116 3 6.72077 3 10 3H14C17.2792 3 18.9188 3 20.0811 3.91554C20.5111 4.25427 20.8851 4.67502 21.1862 5.15877C22 6.4663 22 8.31087 22 12C22 15.6891 22 17.5337 21.1862 18.8412C20.8851 19.325 20.5111 19.7457 20.0811 20.0845C18.9188 21 17.2792 21 14 21H10C6.72077 21 5.08116 21 3.91891 20.0845C3.48891 19.7457 3.1149 19.325 2.81382 18.8412C2 17.5337 2 15.6891 2 12Z" stroke="currentColor" strokeWidth="1.9"></path>
    <path d="M9.5 3L9.5 21" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9"></path>
    <path d="M5 7H6M5 10H6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9"></path>
  </svg>
);

const IconChevronDown = (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
    <path d="M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9"></path>
  </svg>
);

const IconSearch = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
    <path d="M17 17L21 21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9"></path>
    <path d="M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9"></path>
  </svg>
);

const IconHome = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
    <path d="M3 11.9896V14.5C3 17.7998 3 19.4497 4.02513 20.4749C5.05025 21.5 6.70017 21.5 10 21.5H14C17.2998 21.5 18.9497 21.5 19.9749 20.4749C21 19.4497 21 17.7998 21 14.5V11.9896C21 10.3083 21 9.46773 20.6441 8.74005C20.2882 8.01237 19.6247 7.49628 18.2976 6.46411L16.2976 4.90855C14.2331 3.30285 13.2009 2.5 12 2.5C10.7991 2.5 9.76689 3.30285 7.70242 4.90855L5.70241 6.46411C4.37533 7.49628 3.71179 8.01237 3.3559 8.74005C3 9.46773 3 10.3083 3 11.9896Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9"></path>
  </svg>
);

const IconChat = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
    <path d="M21.5 12C21.5 17.2467 17.2467 21.5 12 21.5C10.3719 21.5 8.8394 21.0904 7.5 20.3687C5.63177 19.362 4.37462 20.2979 3.26592 20.4658C3.09774 20.4913 2.93024 20.4302 2.80997 20.31C2.62741 20.1274 2.59266 19.8451 2.6935 19.6074C3.12865 18.5818 3.5282 16.6382 2.98341 15C2.6698 14.057 2.5 13.0483 2.5 12C2.5 6.75329 6.75329 2.5 12 2.5C17.2467 2.5 21.5 6.75329 21.5 12Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9"></path>
    <path d="M12.1257 12H12.0007M8.125 12H8M16.125 12H16M12.2507 12C12.2507 12.1381 12.1388 12.25 12.0007 12.25C11.8627 12.25 11.7507 12.1381 11.7507 12C11.7507 11.8619 11.8627 11.75 12.0007 11.75C12.1388 11.75 12.2507 11.8619 12.2507 12ZM8.25 12C8.25 12.1381 8.13807 12.25 8 12.25C7.86193 12.25 7.75 12.1381 7.75 12C7.75 11.8619 7.86193 11.75 8 11.75C8.13807 11.75 8.25 11.8619 8.25 12ZM16.25 12C16.25 12.1381 16.1381 12.25 16 12.25C15.8619 12.25 15.75 12.1381 15.75 12C15.75 11.8619 15.8619 11.75 16 11.75C16.1381 11.75 16.25 11.8619 16.25 12Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9"></path>
  </svg>
);

const IconAnalytics = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
    <path d="M7 17L7 13" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9"></path>
    <path d="M12 17L12 7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9"></path>
    <path d="M17 17L17 11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9"></path>
    <path d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9"></path>
  </svg>
);

const IconIntegrations = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
    <path d="M10.5 8.75V6.75C10.5 5.10626 10.5 4.28439 10.046 3.73121C9.96291 3.62995 9.87005 3.53709 9.76879 3.45398C9.21561 3 8.39374 3 6.75 3C5.10626 3 4.28439 3 3.73121 3.45398C3.62995 3.53709 3.53709 3.62995 3.45398 3.73121C3 4.28439 3 5.10626 3 6.75V8.75C3 10.3937 3 11.2156 3.45398 11.7688C3.53709 11.8701 3.62995 11.9629 3.73121 12.046C4.28439 12.5 5.10626 12.5 6.75 12.5C8.39374 12.5 9.21561 12.5 9.76879 12.046C9.87005 11.9629 9.96291 11.8701 10.046 11.7688C10.5 11.2156 10.5 10.3937 10.5 8.75Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9"></path>
    <path d="M7.75 15.5H5.75C5.05222 15.5 4.70333 15.5 4.41943 15.5861C3.78023 15.78 3.28002 16.2802 3.08612 16.9194C3 17.2033 3 17.5522 3 18.25C3 18.9478 3 19.2967 3.08612 19.5806C3.28002 20.2198 3.78023 20.72 4.41943 20.9139C4.70333 21 5.05222 21 5.75 21H7.75C8.44778 21 8.79667 21 9.08057 20.9139C9.71977 20.72 10.22 20.2198 10.4139 19.5806C10.5 19.2967 10.5 18.9478 10.5 18.25C10.5 17.5522 10.5 17.2033 10.4139 16.9194C10.22 16.2802 9.71977 15.78 9.08057 15.5861C8.79667 15.5 8.44778 15.5 7.75 15.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9"></path>
    <path d="M21 17.25V15.25C21 13.6063 21 12.7844 20.546 12.2312C20.4629 12.1299 20.3701 12.0371 20.2688 11.954C19.7156 11.5 18.8937 11.5 17.25 11.5C15.6063 11.5 14.7844 11.5 14.2312 11.954C14.1299 12.0371 14.0371 12.1299 13.954 12.2312C13.5 12.7844 13.5 13.6063 13.5 15.25V17.25C13.5 18.8937 13.5 19.7156 13.954 20.2688C14.0371 20.3701 14.1299 20.4629 14.2312 20.546C14.7844 21 15.6063 21 17.25 21C18.8937 21 19.7156 21 20.2688 20.546C20.3701 20.4629 20.4629 20.3701 20.546 20.2688C21 19.7156 21 18.8937 21 17.25Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9"></path>
    <path d="M18.25 3H16.25C15.5522 3 15.2033 3 14.9194 3.08612C14.2802 3.28002 13.78 3.78023 13.5861 4.41943C13.5 4.70333 13.5 5.05222 13.5 5.75C13.5 6.44778 13.5 6.79667 13.5861 7.08057C13.78 7.71977 14.2802 8.21998 14.9194 8.41388C15.2033 8.5 15.5522 8.5 16.25 8.5H18.25C18.9478 8.5 19.2967 8.5 19.5806 8.41388C20.2198 8.21998 20.72 7.71977 20.9139 7.08057C21 6.79667 21 6.44778 21 5.75C21 5.05222 21 4.70333 20.9139 4.41943C20.72 3.78023 20.2198 3.28002 19.5806 3.08612C19.2967 3 18.9478 3 18.25 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9"></path>
  </svg>
);

const IconFolder = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
    <path d="M2.5 20V8.87695C2.5 7.58945 2.5 6.9457 2.78533 6.47048C2.9541 6.18939 3.18939 5.9541 3.47048 5.78533C3.9457 5.5 4.59449 5.5 5.89206 5.5C6.52339 5.5 6.83906 5.5 7.12612 5.58819C7.31759 5.64702 7.49914 5.73428 7.66469 5.84705C7.91289 6.01611 8.10859 6.26074 8.5 6.75C8.89141 7.23926 9.08711 7.48389 9.33531 7.65295C9.50086 7.76572 9.68241 7.85298 9.87388 7.91181C10.1609 8 10.4742 8 11.1008 8H15C16.4045 8 17.1067 8 17.6111 8.33706C17.8295 8.48298 18.017 8.67048 18.1629 8.88886C18.5 9.39331 18.5 10.0955 18.5 11.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9"></path>
    <path d="M4.42028 14.0144L3.63368 16.0144C2.65618 18.4998 2.16743 19.7425 2.7524 20.6213C3.33737 21.5 4.65337 21.5 7.28537 21.5H15.1903C16.4249 21.5 17.0422 21.5 17.5295 21.1795C18.0169 20.859 18.2702 20.2865 18.7769 19.1415L19.6618 17.1415C20.7866 14.5992 21.349 13.3281 20.7679 12.4141C20.1868 11.5 18.8163 11.5 16.0752 11.5H8.07196C6.78232 11.5 6.1375 11.5 5.63811 11.8439C5.13872 12.1877 4.89924 12.7966 4.42028 14.0144Z" stroke="currentColor" strokeWidth="1.9"></path>
    <path d="M11.5 4.51456C12.4151 3.28409 13.6662 2.55594 15.5125 2.50161C16.1155 2.48386 16.7152 2.61395 17.2682 2.85544C18.5748 3.42601 19.4185 4.15644 20 5.5L21.5 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9"></path>
  </svg>
);

const IconClose = (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
    <path d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9"></path>
  </svg>
);

const IconChevronRight = (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
    <path d="M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9"></path>
  </svg>
);

const IconCheck = (
  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="2.4" stroke="currentColor" aria-hidden="true">
    <path d="M5 14L8.5 17.5L19 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4"></path>
  </svg>
);

const IconCheckSmall = (
  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="2.6" stroke="currentColor" aria-hidden="true">
    <path d="M5 14L8.5 17.5L19 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6"></path>
  </svg>
);

const IconChevronLeft14 = (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
    <path d="M15 6C15 6 9.00001 10.4189 9 12C8.99999 13.5812 15 18 15 18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9"></path>
  </svg>
);

const IconChevronRight14 = (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
    <path d="M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9"></path>
  </svg>
);

const IconHeadset = (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" color="currentColor" className="" strokeWidth="1.9" stroke="currentColor" aria-hidden="true">
    <path d="M17 10.8045C17 10.4588 17 10.286 17.052 10.132C17.2032 9.68444 17.6018 9.51076 18.0011 9.32888C18.45 9.12442 18.6744 9.02219 18.8968 9.0042C19.1493 8.98378 19.4022 9.03818 19.618 9.15929C19.9041 9.31984 20.1036 9.62493 20.3079 9.87302C21.2513 11.0188 21.7229 11.5918 21.8955 12.2236C22.0348 12.7334 22.0348 13.2666 21.8955 13.7764C21.6438 14.6979 20.8485 15.4704 20.2598 16.1854C19.9587 16.5511 19.8081 16.734 19.618 16.8407C19.4022 16.9618 19.1493 17.0162 18.8968 16.9958C18.6744 16.9778 18.45 16.8756 18.0011 16.6711C17.6018 16.4892 17.2032 16.3156 17.052 15.868C17 15.714 17 15.5412 17 15.1955V10.8045Z" stroke="currentColor" strokeWidth="1.9"></path>
    <path d="M7 10.8046C7 10.3694 6.98778 9.97821 6.63591 9.6722C6.50793 9.5609 6.33825 9.48361 5.99891 9.32905C5.55001 9.12458 5.32556 9.02235 5.10316 9.00436C4.43591 8.9504 4.07692 9.40581 3.69213 9.87318C2.74875 11.019 2.27706 11.5919 2.10446 12.2237C1.96518 12.7336 1.96518 13.2668 2.10446 13.7766C2.3562 14.6981 3.15152 15.4705 3.74021 16.1856C4.11129 16.6363 4.46577 17.0475 5.10316 16.996C5.32556 16.978 5.55001 16.8757 5.99891 16.6713C6.33825 16.5167 6.50793 16.4394 6.63591 16.3281C6.98778 16.0221 7 15.631 7 15.1957V10.8046Z" stroke="currentColor" strokeWidth="1.9"></path>
    <path d="M5 9C5 5.68629 8.13401 3 12 3C15.866 3 19 5.68629 19 9" stroke="currentColor" strokeLinecap="square" strokeLinejoin="round" strokeWidth="1.9"></path>
    <path d="M19 17V17.8C19 19.5673 17.2091 21 15 21H13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9"></path>
  </svg>
);

const IconSlack = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#E01E5A" d="M5.04 15.17a2.53 2.53 0 0 1-2.52 2.52A2.53 2.53 0 0 1 0 15.17a2.53 2.53 0 0 1 2.52-2.53h2.52zm1.27 0a2.53 2.53 0 0 1 2.53-2.53 2.53 2.53 0 0 1 2.52 2.53v6.31A2.53 2.53 0 0 1 8.84 24a2.53 2.53 0 0 1-2.53-2.52z"></path>
    <path fill="#36C5F0" d="M8.84 5.04a2.53 2.53 0 0 1-2.53-2.52A2.53 2.53 0 0 1 8.84 0a2.53 2.53 0 0 1 2.52 2.52v2.52zm0 1.27a2.53 2.53 0 0 1 2.52 2.53 2.53 2.53 0 0 1-2.52 2.52H2.52A2.53 2.53 0 0 1 0 8.84a2.53 2.53 0 0 1 2.52-2.53z"></path>
    <path fill="#2EB67D" d="M18.96 8.84a2.53 2.53 0 0 1 2.52-2.53A2.53 2.53 0 0 1 24 8.84a2.53 2.53 0 0 1-2.52 2.52h-2.52zm-1.27 0a2.53 2.53 0 0 1-2.53 2.52 2.53 2.53 0 0 1-2.52-2.52V2.52A2.53 2.53 0 0 1 15.16 0a2.53 2.53 0 0 1 2.53 2.52z"></path>
    <path fill="#ECB22E" d="M15.16 18.96a2.53 2.53 0 0 1 2.53 2.52A2.53 2.53 0 0 1 15.16 24a2.53 2.53 0 0 1-2.52-2.52v-2.52zm0-1.27a2.53 2.53 0 0 1-2.52-2.53 2.53 2.53 0 0 1 2.52-2.52h6.32A2.53 2.53 0 0 1 24 15.16a2.53 2.53 0 0 1-2.52 2.53z"></path>
  </svg>
);

const IconNotion = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"></path>
  </svg>
);

const IconDrive = (
  <svg viewBox="0 0 24 24" fill="#1FA463" aria-hidden="true">
    <path d="M12.01 1.485c-2.082 0-3.754.02-3.743.047.01.02 1.708 3.001 3.774 6.62l3.76 6.574h3.76c2.081 0 3.753-.02 3.742-.047-.005-.02-1.708-3.001-3.775-6.62l-3.76-6.574zm-4.76 1.73a789.828 789.861 0 0 0-3.63 6.319L0 15.868l1.89 3.298 1.885 3.297 3.62-6.335 3.618-6.33-1.88-3.287C8.1 4.704 7.255 3.22 7.25 3.214zm2.259 12.653-.203.348c-.114.198-.96 1.672-1.88 3.287a423.93 423.948 0 0 1-1.698 2.97c-.01.026 3.24.042 7.222.042h7.244l1.796-3.157c.992-1.734 1.85-3.23 1.906-3.323l.104-.167h-7.249z"></path>
  </svg>
);

const IconHubSpot = (
  <svg viewBox="0 0 24 24" fill="#FF7A59" aria-hidden="true">
    <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z"></path>
  </svg>
);

const IconLinear = (
  <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
    <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z"></path>
  </svg>
);

const IconCalendar = (
  <svg viewBox="0 0 24 24" fill="#4285F4" aria-hidden="true">
    <path d="M18.316 5.684H24v12.632h-5.684V5.684zM5.684 24h12.632v-5.684H5.684V24zM18.316 5.684V0H1.895A1.894 1.894 0 0 0 0 1.895v16.421h5.684V5.684h12.632zm-7.207 6.25v-.065c.272-.144.5-.349.687-.617s.279-.595.279-.982c0-.379-.099-.72-.3-1.025a2.05 2.05 0 0 0-.832-.714 2.703 2.703 0 0 0-1.197-.257c-.6 0-1.094.156-1.481.467-.386.311-.65.671-.793 1.078l1.085.452c.086-.249.224-.461.413-.633.189-.172.445-.257.767-.257.33 0 .602.088.816.264a.86.86 0 0 1 .322.703c0 .33-.12.589-.36.778-.24.19-.535.284-.886.284h-.567v1.085h.633c.407 0 .748.109 1.02.327.272.218.407.499.407.843 0 .336-.129.614-.387.832s-.565.327-.924.327c-.351 0-.651-.103-.897-.311-.248-.208-.422-.502-.521-.881l-1.096.452c.178.616.505 1.082.977 1.401.472.319.984.478 1.538.477a2.84 2.84 0 0 0 1.293-.291c.382-.193.684-.458.902-.794.218-.336.327-.72.327-1.149 0-.429-.115-.797-.344-1.105a2.067 2.067 0 0 0-.881-.689zm2.093-1.931l.602.913L15 10.045v5.744h1.187V8.446h-.827l-2.158 1.557zM22.105 0h-3.289v5.184H24V1.895A1.894 1.894 0 0 0 22.105 0zm-3.289 23.5l4.684-4.684h-4.684V23.5zM0 22.105C0 23.152.848 24 1.895 24h3.289v-5.184H0v3.289z"></path>
  </svg>
);

/* The success badge: the sheet strokes the path and draws it in. */
const IconSuccessCheck = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 14L8.5 17.5L19 6.5" />
  </svg>
);

/* A 10px cross for a remove affordance; drawn on the icons' 24 grid. */
const IconCloseSmall = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    color="currentColor"
    strokeWidth="2"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  </svg>
);

/* A link glyph for the invite-link row. */
const IconLink = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    color="currentColor"
    strokeWidth="1.9"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path d="M12 8.5L14.5 6C15.88 4.62 18.12 4.62 19.5 6C20.88 7.38 20.88 9.62 19.5 11L17 13.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    <path d="M12 15.5L9.5 18C8.12 19.38 5.88 19.38 4.5 18C3.12 16.62 3.12 14.38 4.5 13L7 10.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    <path d="M9.5 14.5L14.5 9.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
  </svg>
);

export const defaultTools: OnboardingTool[] = [
  {
    id: "slack",
    name: "Slack",
    description: "Ask your agents from any channel and get their reports there.",
    icon: IconSlack,
    connected: true,
  },
  {
    id: "notion",
    name: "Notion",
    description: "Search pages while you chat and save answers as docs.",
    icon: IconNotion,
  },
  {
    id: "drive",
    name: "Google Drive",
    description: "Pick files from Drive and let agents read them for context.",
    icon: IconDrive,
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Look up contacts and deals, and log what agents find.",
    icon: IconHubSpot,
  },
  {
    id: "linear",
    name: "Linear",
    description: "Turn requests from chat into issues and follow them to release.",
    icon: IconLinear,
    tint: "rgb(94, 106, 210)",
  },
  {
    id: "calendar",
    name: "Google Calendar",
    description: "Schedule agent runs and prepare briefs before meetings.",
    icon: IconCalendar,
  },
];

export const defaultInvites: OnboardingInvite[] = [
  { id: "jordan", email: "jordan@acme.co", initials: "JD" },
  { id: "riley", email: "riley@acme.co", initials: "RK" },
];

export const defaultTemplates: OnboardingTemplate[] = [
  {
    id: "research",
    name: "Research analyst",
    description: "Reads your sources, answers with citations and flags what it could not verify.",
    meta: "Uses 2 connected tools",
    icon: IconSearch,
  },
  {
    id: "triage",
    name: "Inbox triage",
    description: "Sorts inbound mail, drafts replies and escalates anything sensitive.",
    meta: "Works from Slack",
    icon: IconChat,
  },
  {
    id: "notes",
    name: "Meeting notes",
    description: "Turns calls into decisions, owners and a short summary your team reads.",
    meta: "Needs a calendar",
    icon: IconAnalytics,
  },
];

export function OnboardingScreen({
  onComplete,
  defaultStep = 1,
  workspace = "Acme",
  user = { name: "Alex Morgan" },
  tools = defaultTools,
  invites: initialInvites = defaultInvites,
  templates = defaultTemplates,
  progress = 13,
  onNavigate,
  className,
}: OnboardingScreenProps) {
  const uid = useId();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(defaultStep);
  const [dir, setDir] = useState<"next" | "back">("next");
  const [finished, setFinished] = useState(false);
  const [skipped, setSkipped] = useState<OnboardingStageId[]>([]);

  const [name, setName] = useState(workspace);
  const [slug, setSlug] = useState(slugify(workspace));
  const [connected, setConnected] = useState<string[]>(
    tools.filter((tool) => tool.connected).map((tool) => tool.id),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [invites, setInvites] = useState<OnboardingInvite[]>(initialInvites);
  const [draft, setDraft] = useState("");
  const [role, setRole] = useState<OnboardingRole>("Member");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [agentName, setAgentName] = useState("Scout");
  const [error, setError] = useState<string | null>(null);

  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [newsOpen, setNewsOpen] = useState(true);

  const draftRef = useRef<HTMLInputElement>(null);
  const busyTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (busyTimer.current !== null) window.clearTimeout(busyTimer.current);
    },
    [],
  );

  const firstName = user.name.trim().split(/\s+/)[0] || user.name;
  const initials =
    user.initials ??
    user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  const workspaceName = name.trim() || workspace;
  const workspaceSlug = slug.trim() || slugify(workspaceName);

  const values: OnboardingValues = {
    workspace: workspaceName,
    slug: workspaceSlug,
    tools: connected,
    invites: invites.map((invite) => invite.email),
    role,
    template: skipped.includes("agent") ? "" : templateId,
    agentName: skipped.includes("agent") ? "" : agentName.trim(),
  };

  const stageState = (index: number): "done" | "current" | "todo" | "skipped" => {
    const stage = STAGES[index];
    if (skipped.includes(stage.id)) return "skipped";
    if (finished) return "done";
    if (index < step - 1) return "done";
    if (index === step - 1) return "current";
    return "todo";
  };

  const doneCount = STAGES.filter((_, index) => stageState(index) === "done").length;

  /* The rail and the checklist name their states differently: the checklist has todo, the rail
   * has next. Both sheets only ever paint done and current differently. */
  const railState = (index: number): "done" | "current" | "next" => {
    const state = stageState(index);
    return state === "done" || state === "current" ? state : "next";
  };

  const goTo = (next: 1 | 2 | 3 | 4) => {
    setDir(next > step ? "next" : "back");
    setStep(next);
    /* Walking back onto a stage the user skipped makes it live again, so the checklist stops
     * calling it skipped while its form is on screen. */
    setSkipped((list) => list.filter((id) => id !== STAGES[next - 1].id));
    setFinished(false);
    setError(null);
  };

  const skipStage = () => {
    const stage = STAGES[step - 1];
    setSkipped((list) => (list.includes(stage.id) ? list : [...list, stage.id]));
    if (step === 4) setFinished(true);
    else goTo((step + 1) as 1 | 2 | 3 | 4);
  };

  const advance = () => {
    if (step === 1 && !name.trim()) {
      setError("Give the workspace a name your team will recognise.");
      return;
    }
    setSkipped((list) => list.filter((id) => id !== STAGES[step - 1].id));
    setError(null);
    if (step === 4) setFinished(true);
    else goTo((step + 1) as 1 | 2 | 3 | 4);
  };

  const toggleTool = (id: string) => {
    if (busy === id) return;
    if (connected.includes(id)) {
      setConnected((list) => list.filter((item) => item !== id));
      return;
    }
    setBusy(id);
    busyTimer.current = window.setTimeout(() => {
      setConnected((list) => (list.includes(id) ? list : [...list, id]));
      setBusy(null);
    }, 520);
  };

  const addInvite = () => {
    const email = draft.trim().replace(/,$/, "");
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(`“${email}” is not an email address.`);
      return;
    }
    if (invites.some((invite) => invite.email.toLowerCase() === email.toLowerCase())) {
      setError(`${email} is already on the list.`);
      return;
    }
    setInvites((list) => [...list, { id: email, email, initials: initialsOf(email) }]);
    setDraft("");
    setError(null);
  };

  const removeInvite = (id: string) => {
    setInvites((list) => list.filter((invite) => invite.id !== id));
    setError(null);
  };

  const copyInviteLink = () => {
    const link = `https://acme.app/${workspaceSlug}/join`;
    void navigator.clipboard?.writeText(link).catch(() => undefined);
    onNavigate?.("Invite link copied");
  };

  const nextLabel = step === 4 ? "Create agent" : "Continue";
  const stage = STAGES[step - 1];

  const checklistNote = (index: number, state: "done" | "current" | "todo" | "skipped"): string => {
    if (index === 0) return `${workspaceName} · 2–10 people`;
    if (state === "done") {
      if (index === 1) return `${connected.length} connected`;
      if (index === 2) return `${invites.length} invited`;
      return `${agentName.trim() || "Scout"} created`;
    }
    if (state === "skipped") return "Skipped";
    if (state === "current") return "In progress";
    return index === 2 ? "Under a minute" : "About 1 min";
  };

  return (
    <div
      className={["ui-as ui-as-app", className].filter(Boolean).join(" ")}
      data-collapsed={collapsed ? "" : undefined}
      data-drawer={drawer ? "" : undefined}
    >
      <style href="ui-onboarding" precedence="default">
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
        {IconPanel}
      </button>
      <div className="ui-as-scrim" aria-hidden="true" onClick={() => setDrawer(false)} />
      <aside className="ui-as-side">
        <header className="ui-as-side__head">
          <span className="ui-as-anchor">
            <button className="ui-as-side__workspace" type="button" aria-expanded={false}>
              <span className="ui-as-side__logo">{workspaceName.charAt(0).toUpperCase()}</span>
              {workspaceName}
              {IconChevronDown}
            </button>
          </span>
          <span className="ui-as-side__tools">
            <button className="ui-as-icon-btn" type="button" aria-label="Search">
              {IconSearch}
            </button>
            <button
              className="ui-as-icon-btn"
              type="button"
              aria-label="Collapse sidebar"
              onClick={() => setCollapsed(true)}
            >
              {IconPanel}
            </button>
          </span>
        </header>
        <nav className="ui-as-side__nav" aria-label="Main menu">
          <div className="ui-as-side__group">
            <button
              type="button"
              className="ui-as-side__item"
              aria-current="page"
              onClick={() => onNavigate?.("Home")}
            >
              {IconHome}Home
            </button>
            <button type="button" className="ui-as-side__item" onClick={() => onNavigate?.("Chat")}>
              {IconChat}Chat
            </button>
            <button
              type="button"
              className="ui-as-side__item"
              onClick={() => onNavigate?.("Analytics")}
            >
              {IconAnalytics}Analytics
            </button>
            <button
              type="button"
              className="ui-as-side__item"
              onClick={() => onNavigate?.("Integrations")}
            >
              {IconIntegrations}Integrations
            </button>
          </div>
          <span className="ui-as-side__label">Projects</span>
          <button type="button" className="ui-as-side__item" onClick={() => onNavigate?.("Q3 Campaign")}>
            {IconFolder}Q3 Campaign
          </button>
          <button type="button" className="ui-as-side__item" onClick={() => onNavigate?.("Brand assets")}>
            {IconFolder}Brand assets
          </button>
          <button type="button" className="ui-as-side__item" onClick={() => onNavigate?.("Hiring")}>
            {IconFolder}Hiring
          </button>
          <button type="button" className="ui-as-side__item" onClick={() => onNavigate?.("Research")}>
            {IconFolder}Research
          </button>
        </nav>
        <div className="ui-as-side__foot">
          {newsOpen ? (
            <div className="ui-as-news" data-count="2">
              <div className="ui-as-news__card ui-as-news__card--back" aria-hidden="true">
                <span className="ui-as-news__kicker">New in {workspaceName}</span>
                {IconClose}
              </div>
              <div className="ui-as-news__card">
                <div className="ui-as-news__top">
                  <span className="ui-as-news__kicker">New in {workspaceName}</span>
                  <button
                    type="button"
                    className="ui-as-news__close"
                    aria-label="Dismiss"
                    onClick={() => setNewsOpen(false)}
                  >
                    {IconClose}
                  </button>
                </div>
                <b className="ui-as-news__title">Shared folders</b>
                <button
                  type="button"
                  className="ui-as-news__more"
                  onClick={() => onNavigate?.("Changelog")}
                >
                  Full changelog{IconChevronRight}
                </button>
              </div>
            </div>
          ) : null}
          <div className="ui-as-guide-slot" style={{ height: 70 }}>
            <div className="ui-as-guide" data-state="closed" style={{ height: 70 }}>
              <div className="ui-as-guide__inner">
                <button type="button" className="ui-as-steps ui-as-guide__content" aria-expanded={false}>
                  <span className="ui-as-steps__title">
                    Getting started{IconChevronRight}
                  </span>
                  <span className="ui-as-steps__sub">
                    {`${progress}% done ·`}
                    <span className="ui-as-steps__cheer">{cheerFor(progress)}</span>
                  </span>
                  <span className="ui-as-steps__bar">
                    <i style={{ width: `${progress}%` }} />
                  </span>
                </button>
              </div>
            </div>
          </div>
          <span className="ui-as-anchor ui-as-user-menu">
            <button type="button" className="ui-as-user" aria-expanded={false}>
              <span className="ui-as-user__initials">{initials}</span>
              {user.name}
              {IconChevronDown}
            </button>
          </span>
        </div>
      </aside>
      <main className="ui-as-main">
        <div className="ui-onb">
          <header className="ui-onb-head">
            <span className="ui-onb-kicker">{`Step ${step} of ${STAGES.length}`}</span>
            <h1 className="ui-onb-title">{`Welcome to ${workspaceName}, ${firstName}`}</h1>
            <p className="ui-onb-sub">
              A few quick steps and your workspace is ready – about two minutes.
            </p>
            <ol className="ui-onb-steps" aria-label="Onboarding progress">
              {STAGES.map((item, index) => {
                const state = railState(index);
                return (
                  <li
                    key={item.id}
                    className="ui-onb-steps__item"
                    data-state={state}
                    aria-current={state === "current" ? "step" : undefined}
                  >
                    <span className="ui-onb-steps__mark" aria-hidden="true">
                      {state === "done" ? IconCheck : index + 1}
                    </span>
                    <span className="ui-onb-steps__label">
                      {item.label}
                      <span className="ui-onb-sr">
                        {state === "done" ? ", done" : state === "current" ? ", current step" : null}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </header>
          <div className="ui-onb-card">
            {finished ? (
              <div className="ui-onb-success">
                <div className="ui-onb-success__body">
                  <span className="ui-onb-success__badge" aria-hidden="true">
                    {IconSuccessCheck}
                  </span>
                  <h2 className="ui-onb-step__title">{`You’re all set, ${firstName}`}</h2>
                  <p className="ui-onb-step__text">
                    {`${workspaceName} has ${countOf(connected.length, "tool")} connected and ${countOf(
                      invites.length,
                      "teammate",
                    )} invited. ${
                      skipped.includes("agent")
                        ? "You can create an agent whenever you’re ready."
                        : `${agentName.trim() || "Scout"} is ready when you are.`
                    }`}
                  </p>
                  <ul className="ui-onb-next">
                    <li style={{ "--i": 0 } as CSSProperties}>
                      <button
                        type="button"
                        className="ui-onb-next__item"
                        onClick={() => onNavigate?.("Chat")}
                      >
                        <span className="ui-onb-next__icon" aria-hidden="true">
                          {IconChat}
                        </span>
                        <span className="ui-onb-next__text">
                          <b>Ask your first question</b>
                          <span>Try “What changed in the Q3 campaign this week?”</span>
                        </span>
                        {IconChevronRight}
                      </button>
                    </li>
                    <li style={{ "--i": 1 } as CSSProperties}>
                      <button
                        type="button"
                        className="ui-onb-next__item"
                        onClick={() => onNavigate?.("Team")}
                      >
                        <span className="ui-onb-next__icon" aria-hidden="true">
                          {IconIntegrations}
                        </span>
                        <span className="ui-onb-next__text">
                          <b>Invite the rest of the team</b>
                          <span>Anyone with the invite link can request access.</span>
                        </span>
                        {IconChevronRight}
                      </button>
                    </li>
                    <li style={{ "--i": 2 } as CSSProperties}>
                      <button
                        type="button"
                        className="ui-onb-next__item"
                        onClick={() => onNavigate?.("Integrations")}
                      >
                        <span className="ui-onb-next__icon" aria-hidden="true">
                          {IconAnalytics}
                        </span>
                        <span className="ui-onb-next__text">
                          <b>Connect one more tool</b>
                          <span>Notion and Linear are asking to be let in.</span>
                        </span>
                        {IconChevronRight}
                      </button>
                    </li>
                  </ul>
                </div>
                <footer className="ui-onb-foot">
                  <button
                    type="button"
                    className="ui-onb-skip"
                    onClick={() => {
                      setFinished(false);
                      setSkipped([]);
                      goTo(1);
                    }}
                  >
                    Start over
                  </button>
                  <span className="ui-onb-foot__actions">
                    <button
                      type="button"
                      className="ui-button"
                      data-variant="primary"
                      data-size="sm"
                      data-ready="true"
                      onClick={() => onComplete?.(values)}
                    >
                      <span className="ui-button__label" data-text="Open workspace">
                        Open workspace
                      </span>
                      <span className="ui-button__icon" aria-hidden="true">
                        {IconChevronRight14}
                      </span>
                    </button>
                  </span>
                </footer>
              </div>
            ) : (
              <form
                className="ui-onb-form"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  advance();
                }}
              >
                <div key={stage.id} className="ui-onb-step" data-dir={dir}>
                  {step === 1 ? (
                    <>
                      <div className="ui-onb-step__head">
                        <h2 className="ui-onb-step__title">Set up your workspace</h2>
                        <p className="ui-onb-step__text">
                          This is the name your team sees and the address they sign in at.
                        </p>
                      </div>
                      <div className="ui-onb-fields">
                        <label className="ui-onb-field" htmlFor={`${uid}-name`}>
                          <span className="ui-onb-label">Workspace name</span>
                          <span className="ui-onb-input">
                            <input
                              id={`${uid}-name`}
                              value={name}
                              aria-invalid={error ? true : undefined}
                              placeholder="Acme"
                              onChange={(event) => {
                                setName(event.target.value);
                                setError(null);
                              }}
                            />
                          </span>
                          {error ? <span className="ui-onb-error">{error}</span> : null}
                        </label>
                        <label className="ui-onb-field" htmlFor={`${uid}-slug`}>
                          <span className="ui-onb-label">Workspace address</span>
                          <span className="ui-onb-input">
                            <span className="ui-onb-prefix">https://acme.app/</span>
                            <input
                              id={`${uid}-slug`}
                              value={slug}
                              placeholder="acme"
                              onChange={(event) => setSlug(slugify(event.target.value))}
                            />
                          </span>
                          <span className="ui-onb-hint">
                            Your team signs in at <b>{`${workspaceSlug}.app`}</b>. You can change
                            the address later.
                          </span>
                        </label>
                      </div>
                    </>
                  ) : null}

                  {step === 2 ? (
                    <>
                      <div className="ui-onb-step__head">
                        <h2 className="ui-onb-step__title">Connect your tools</h2>
                        <p className="ui-onb-step__text">
                          Your agents can read from and act in the apps you connect. Change this
                          anytime.
                        </p>
                      </div>
                      <ul className="ui-onb-tools">
                        {tools.map((tool, index) => {
                          const isConnected = connected.includes(tool.id);
                          return (
                            <li
                              key={tool.id}
                              className="ui-onb-tool"
                              style={{ "--i": index } as CSSProperties}
                            >
                              <span
                                className="ui-onb-logo"
                                style={
                                  tool.tint
                                    ? { background: tool.tint, boxShadow: "none" }
                                    : undefined
                                }
                              >
                                {tool.icon}
                              </span>
                              <span className="ui-onb-tool__text">
                                <span className="ui-onb-tool__name">
                                  {tool.name}
                                  {isConnected ? (
                                    <span className="ui-onb-tool__state">Connected</span>
                                  ) : null}
                                </span>
                                <span className="ui-onb-tool__desc">{tool.description}</span>
                              </span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={isConnected}
                                aria-label={`Connect ${tool.name}`}
                                className="ui-onb-switch"
                                data-busy={busy === tool.id ? "" : undefined}
                                onClick={() => toggleTool(tool.id)}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  ) : null}

                  {step === 3 ? (
                    <>
                      <div className="ui-onb-step__head">
                        <h2 className="ui-onb-step__title">Invite your team</h2>
                        <p className="ui-onb-step__text">
                          Everyone you invite can use the tools you just connected. They join in a
                          minute.
                        </p>
                      </div>
                      <div className="ui-onb-fields">
                        <div className="ui-onb-field">
                          <label className="ui-onb-label" htmlFor={`${uid}-invite`}>
                            Invite by email
                          </label>
                          <div className="ui-onb-invite-row">
                            <div
                              className="ui-onb-chips"
                              data-invalid={error ? "" : undefined}
                              onClick={() => draftRef.current?.focus()}
                            >
                              {invites.map((invite) => (
                                <span key={invite.id} className="ui-onb-chip">
                                  <span className="ui-onb-chip__avatar" aria-hidden="true">
                                    {invite.initials ?? initialsOf(invite.email)}
                                  </span>
                                  {invite.email}
                                  <button
                                    type="button"
                                    className="ui-onb-chip__remove"
                                    aria-label={`Remove ${invite.email}`}
                                    onClick={() => removeInvite(invite.id)}
                                  >
                                    {IconCloseSmall}
                                  </button>
                                </span>
                              ))}
                              <input
                                ref={draftRef}
                                id={`${uid}-invite`}
                                value={draft}
                                placeholder="name@company.com"
                                aria-invalid={error ? true : undefined}
                                onChange={(event) => {
                                  setDraft(event.target.value);
                                  setError(null);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === ",") {
                                    event.preventDefault();
                                    addInvite();
                                  }
                                  if (event.key === "Backspace" && !draft && invites.length > 0) {
                                    removeInvite(invites[invites.length - 1].id);
                                  }
                                }}
                                onBlur={() => {
                                  if (draft.trim()) addInvite();
                                }}
                              />
                            </div>
                            <button
                              type="button"
                              className="ui-onb-input ui-onb-role"
                              aria-label={`Invite as ${role}`}
                              aria-expanded={false}
                              onClick={() =>
                                setRole(ROLES[(ROLES.indexOf(role) + 1) % ROLES.length])
                              }
                            >
                              {role}
                              {IconChevronDown}
                            </button>
                          </div>
                          {error ? (
                            <span className="ui-onb-error">{error}</span>
                          ) : (
                            <span className="ui-onb-hint">
                              Press <b>Enter</b> to add each address. Invitees join as{" "}
                              {role.toLowerCase()}.
                            </span>
                          )}
                        </div>
                        <div className="ui-onb-link">
                          <span className="ui-onb-link__icon" aria-hidden="true">
                            {IconLink}
                          </span>
                          <span className="ui-onb-link__text">
                            <b>Invite with a link</b>
                            <span>Anyone with the link can request access to this workspace.</span>
                          </span>
                          <button
                            type="button"
                            className="ui-button"
                            data-variant="secondary"
                            data-size="sm"
                            data-ready="true"
                            onClick={copyInviteLink}
                          >
                            <span className="ui-button__label" data-text="Copy link">
                              Copy link
                            </span>
                          </button>
                        </div>
                      </div>
                    </>
                  ) : null}

                  {step === 4 ? (
                    <>
                      <div className="ui-onb-step__head">
                        <h2 className="ui-onb-step__title">Create your first agent</h2>
                        <p className="ui-onb-step__text">
                          Pick a starting point. You can rewrite the instructions at any time.
                        </p>
                      </div>
                      <div className="ui-onb-fields">
                        <label className="ui-onb-field" htmlFor={`${uid}-agent`}>
                          <span className="ui-onb-label">Agent name</span>
                          <span className="ui-onb-input">
                            <input
                              id={`${uid}-agent`}
                              value={agentName}
                              placeholder="Scout"
                              onChange={(event) => setAgentName(event.target.value)}
                            />
                          </span>
                        </label>
                        <div className="ui-onb-field">
                          <span className="ui-onb-label" id={`${uid}-templates`}>
                            Template
                          </span>
                          <div
                            className="ui-onb-templates"
                            role="radiogroup"
                            aria-labelledby={`${uid}-templates`}
                          >
                            {templates.map((template, index) => (
                              <button
                                key={template.id}
                                type="button"
                                role="radio"
                                aria-checked={template.id === templateId}
                                className="ui-onb-template"
                                style={{ "--i": index } as CSSProperties}
                                onClick={() => setTemplateId(template.id)}
                              >
                                <span className="ui-onb-template__top">
                                  <span className="ui-onb-template__icon" aria-hidden="true">
                                    {template.icon}
                                  </span>
                                  <span className="ui-onb-template__check" aria-hidden="true">
                                    {IconCheckSmall}
                                  </span>
                                </span>
                                <span className="ui-onb-template__name">{template.name}</span>
                                <span className="ui-onb-template__text">{template.description}</span>
                                <span className="ui-onb-template__meta">{template.meta}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
                <footer className="ui-onb-foot">
                  <button type="button" className="ui-onb-skip" onClick={skipStage}>
                    Skip for now
                  </button>
                  <span className="ui-onb-foot__actions">
                    {step > 1 ? (
                      <button
                        type="button"
                        className="ui-button"
                        data-variant="secondary"
                        data-size="sm"
                        data-ready="true"
                        onClick={() => goTo((step - 1) as 1 | 2 | 3 | 4)}
                      >
                        <span className="ui-button__icon" aria-hidden="true">
                          {IconChevronLeft14}
                        </span>
                        <span className="ui-button__label" data-text="Back">
                          Back
                        </span>
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      className="ui-button"
                      data-variant="primary"
                      data-size="sm"
                      data-ready="true"
                    >
                      <span className="ui-button__label" data-text={nextLabel}>
                        {nextLabel}
                      </span>
                      <span className="ui-button__icon" aria-hidden="true">
                        {IconChevronRight14}
                      </span>
                    </button>
                  </span>
                </footer>
              </form>
            )}
          </div>
          <aside className="ui-onb-aside" aria-label="Setup checklist">
            <div className="ui-onb-check">
              <div className="ui-onb-check__head">
                <b>Setup checklist</b>
                <span className="ui-onb-check__count">
                  <span key={doneCount}>{doneCount}</span>/{STAGES.length}
                </span>
              </div>
              <span className="ui-onb-check__bar" aria-hidden="true">
                <i style={{ transform: `scaleX(${doneCount / STAGES.length})` }} />
              </span>
              <ol className="ui-onb-check__list">
                {STAGES.map((item, index) => {
                  const state = stageState(index);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="ui-onb-check__item"
                        data-state={state}
                        aria-current={state === "current" ? "step" : undefined}
                        onClick={() => goTo((index + 1) as 1 | 2 | 3 | 4)}
                      >
                        <span className="ui-onb-check__mark" aria-hidden="true">
                          {state === "done" ? (
                            IconCheckSmall
                          ) : state === "skipped" ? (
                            <span className="ui-onb-dash" />
                          ) : null}
                        </span>
                        <span className="ui-onb-check__text">
                          <span className="ui-onb-check__label">{item.checklist}</span>
                          <span className="ui-onb-check__sub">{checklistNote(index, state)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
            <button
              type="button"
              className="ui-onb-help"
              onClick={() => onNavigate?.("Book a setup call")}
            >
              <span className="ui-onb-help__icon">{IconHeadset}</span>
              <span>
                <b>Need a hand?</b>
                <span>Book a free 15-minute setup call</span>
              </span>
            </button>
          </aside>
        </div>
      </main>
    </div>
  );
}

/* ---------- helpers ---------- */

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function initialsOf(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

function countOf(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function cheerFor(progress: number): string {
  if (progress >= 100) return "All set";
  if (progress >= 60) return "Almost there";
  if (progress >= 30) return "Nice work";
  return "Great start!";
}

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
.ui-onb{display: grid;grid-template-columns: minmax(0, 640px) 264px;grid-template-areas: "head ." "card aside";justify-content: center;align-items: start;column-gap: 40px;padding: 52px 40px 64px}
.ui-onb-head{grid-area: head}
.ui-onb-card{grid-area: card;min-width: 0}
.ui-onb-aside{grid-area: aside;position: sticky;top: 24px;display: grid;gap: 10px}
.ui-onb-kicker{font-size: 12.5px;line-height: 16px;font-weight: 500;color: var(--muted)}
.ui-onb-title{margin: 8px 0 0;font-size: 26px;line-height: 32px;font-weight: 600;letter-spacing: -0.025em;color: var(--ink)}
.ui-onb-sub{margin: 6px 0 0;font-size: 14px;line-height: 20px;color: var(--muted)}
.ui-onb-steps{display: flex;align-items: center;margin: 22px 0 24px;padding: 0;list-style: none}
.ui-onb-steps__item{display: flex;align-items: center;gap: 8px;min-width: 0;font-size: 13px;line-height: 16px;color: var(--muted)}
.ui-onb-steps__item:not(:last-child){flex: 1}
.ui-onb-steps__item:not(:last-child)::after{content: "";flex: 1;min-width: 12px;height: 1px;margin: 0 4px 0 6px;background: var(--line);transition: background-color var(--nm-dur-4, 380ms) var(--ease)}
.ui-onb-steps__item[data-state="done"]::after{background: var(--line-strong)}
.ui-onb-steps__mark{display: grid;place-items: center;flex: none;width: 20px;height: 20px;border-radius: 50%;box-shadow: inset 0 0 0 1px var(--line);font-size: 11px;font-weight: 500;font-variant-numeric: tabular-nums;color: var(--faint);transition: background-color var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-4, 380ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-onb-steps__item[data-state="done"] .ui-onb-steps__mark{background: var(--chip);box-shadow: none;color: var(--ink)}
.ui-onb-steps__item[data-state="current"]{color: var(--ink);font-weight: 500}
.ui-onb-steps__item[data-state="current"] .ui-onb-steps__mark{box-shadow: inset 0 0 0 1px var(--line-strong);color: var(--ink)}
.ui-onb-steps__label{white-space: nowrap}
.ui-onb-sr{position: absolute;width: 1px;height: 1px;overflow: hidden;clip: rect(0 0 0 0);white-space: nowrap}
.ui-onb-card{padding: 4px;border-radius: 20px;background: var(--tray)}
.ui-onb-form{display: grid}
.ui-onb-step, .ui-onb-success__body{border-radius: 16px;background: var(--card);box-shadow: 0 0 0 1px var(--line), 0 1px 2px rgba(11, 9, 8, 0.04)}
.ui-onb-step{padding: 26px 28px 26px;animation: ui-onb-in-next 380ms var(--ease) both}
.ui-onb-success__body{padding: 30px 0 22px}
.ui-onb-step[data-dir="back"]{animation-name: ui-onb-in-back}
@keyframes ui-onb-in-next{from{opacity: 0;transform: translateX(14px)}
to{opacity: 1;transform: none}
}
@keyframes ui-onb-in-back{from{opacity: 0;transform: translateX(-14px)}
to{opacity: 1;transform: none}
}
.ui-onb-step__head{margin-bottom: 22px}
.ui-onb-step__title{margin: 0;font-size: 17px;line-height: 24px;font-weight: 600;letter-spacing: -0.01em;color: var(--ink)}
.ui-onb-step__text{margin: 4px 0 0;font-size: 13.5px;line-height: 20px;color: var(--muted)}
.ui-onb-foot{display: flex;align-items: center;justify-content: space-between;gap: 12px;min-height: 52px;padding: 6px 6px 2px 16px}
.ui-onb-foot__actions{display: flex;gap: 8px}
.ui-onb-skip{font-size: 13px;color: var(--muted);text-decoration: underline;text-decoration-color: transparent;text-underline-offset: 3px;transition: color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), text-decoration-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-onb-skip:hover{color: var(--ink);text-decoration-color: var(--line-strong)}
.ui-onb-fields{display: grid;gap: 20px}
.ui-onb-field{display: grid;gap: 7px;min-width: 0}
.ui-onb-label{font-size: 13px;line-height: 18px;font-weight: 500;color: var(--ink)}
.ui-onb-hint, .ui-onb-error{font-size: 12.5px;line-height: 17px;color: var(--muted)}
.ui-onb-hint b{font-weight: 500;color: var(--text)}
.ui-onb-error{color: #b3261e}
.ui-onb-input, .ui-onb-chips{display: flex;align-items: center;min-height: 38px;border-radius: 10px;background: var(--card);box-shadow: 0 0 0 1px var(--line-strong), var(--shadow);transition: box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-onb-input:hover, .ui-onb-chips:hover{box-shadow: 0 0 0 1px var(--faint), var(--shadow)}
.ui-onb-input:focus-within, .ui-onb-chips:focus-within{box-shadow: 0 0 0 1px var(--ink), 0 0 0 4px var(--select)}
.ui-onb-input[aria-invalid], .ui-onb-chips[data-invalid]{box-shadow: 0 0 0 1px #b3261e, 0 0 0 4px rgba(179, 38, 30, 0.1)}
input.ui-onb-input{width: 100%;padding: 0 12px}
.ui-onb-input, .ui-onb-input input, .ui-onb-chips input{border: 0;outline: none;font: inherit;font-size: 14px;color: var(--ink)}
.ui-onb-input input, .ui-onb-chips input{flex: 1;min-width: 0;height: 36px;padding: 0 12px 0 0;background: none}
.ui-onb-input::placeholder, .ui-onb-input input::placeholder, .ui-onb-chips input::placeholder{color: var(--placeholder)}
.ui-onb-prefix{padding: 0 1px 0 12px;font-size: 14px;color: var(--muted);white-space: nowrap}
.ui-onb-tools{display: grid;margin: -6px -10px 0;padding: 0;list-style: none}
.ui-onb-tool{display: flex;align-items: center;gap: 12px;min-height: 56px;padding: 0 10px;border-radius: 12px;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));animation: ui-onb-rise 380ms var(--ease) both;animation-delay: calc(var(--i, 0) * 30ms)}
.ui-onb-tool:hover{background: var(--subtle)}
@keyframes ui-onb-rise{from{opacity: 0;transform: translateY(6px)}
to{opacity: 1;transform: none}
}
.ui-onb-logo{display: grid;place-items: center;flex: none;width: 32px;height: 32px;border-radius: 9px;background: var(--logo-bg);box-shadow: 0 0 0 1px var(--line), var(--shadow);color: var(--ink)}
.ui-onb-logo svg{width: 17px;height: 17px}
.ui-onb-tool__text{display: grid;gap: 2px;flex: 1;min-width: 0}
.ui-onb-tool__name{display: flex;align-items: center;gap: 8px;font-size: 14px;line-height: 19px;font-weight: 500;color: var(--ink)}
.ui-onb-tool__state{padding: 1px 7px;border-radius: 999px;background: var(--chip);font-size: 11.5px;line-height: 16px;font-weight: 500;color: var(--muted);animation: ui-onb-fade 240ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
@keyframes ui-onb-fade{from{opacity: 0}
}
.ui-onb-tool__desc{overflow: hidden;font-size: 13px;line-height: 18px;color: var(--muted);white-space: nowrap;text-overflow: ellipsis}
.ui-onb-switch{position: relative;flex: none;width: 32px;height: 20px;border-radius: 999px;background: var(--toggle-off);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-onb-switch::after{content: "";position: absolute;top: 2px;left: 2px;width: 16px;height: 16px;border-radius: 50%;background: #fffdfb;box-shadow: 0 1px 2px rgba(11, 9, 8, 0.2);transition: translate 240ms var(--ease)}
.ui-onb-switch[aria-checked="true"]{background: var(--switch-on)}
.ui-onb-switch[aria-checked="true"]::after, .ui-onb-switch[data-busy]::after{translate: 12px 0}
.ui-onb-switch[data-busy]{background: var(--faint)}
.ui-onb-spinner{flex: none;width: 14px;height: 14px;border: 2px solid var(--line);border-top-color: var(--ink);border-radius: 50%;animation: ui-onb-spin var(--nm-dur-5, 620ms) linear infinite}
@keyframes ui-onb-spin{to{transform: rotate(360deg)}
}
.ui-onb-invite-row{display: flex;align-items: flex-start;gap: 8px}
.ui-onb-chips{flex: 1;flex-wrap: wrap;gap: 6px;min-width: 0;padding: 4px 4px 4px 6px;cursor: text}
.ui-onb-chips input{min-width: 120px;height: 28px;padding-left: 4px}
.ui-onb-chip{display: inline-flex;align-items: center;gap: 6px;height: 28px;padding: 0 4px 0 4px;border-radius: 8px;background: var(--chip);font-size: 13px;color: var(--ink);animation: ui-as-pop var(--nm-dur-3, 240ms) var(--ease)}
.ui-onb-chip__avatar{display: grid;place-items: center;width: 20px;height: 20px;border-radius: 6px;background: var(--card);box-shadow: 0 0 0 1px var(--line);font-size: 10.5px;font-weight: 600;color: var(--text)}
.ui-onb-chip__remove{display: grid;place-items: center;width: 20px;height: 20px;border-radius: 6px;color: var(--faint);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-onb-chip__remove:hover{background: var(--chip-hover);color: var(--ink)}
.ui-onb-role{height: 38px;min-width: 104px;justify-content: space-between;border-radius: 10px}
.ui-onb-role > svg{color: var(--faint)}
.ui-onb-link{display: flex;align-items: center;gap: 12px;padding: 12px 12px 12px 14px;border-radius: 12px;background: var(--subtle);box-shadow: inset 0 0 0 1px var(--line-soft)}
.ui-onb-link__icon{display: grid;place-items: center;flex: none;width: 30px;height: 30px;border-radius: 9px;background: var(--card);box-shadow: 0 0 0 1px var(--line);color: var(--text)}
.ui-onb-link__text{display: grid;gap: 1px;flex: 1;min-width: 0}
.ui-onb-link__text b{font-size: 13.5px;font-weight: 500;color: var(--ink)}
.ui-onb-link__text span{overflow: hidden;font-size: 12.5px;color: var(--muted);white-space: nowrap;text-overflow: ellipsis}
.ui-onb-templates{display: grid;grid-template-columns: repeat(3, minmax(0, 1fr));gap: 12px}
.ui-onb-template{display: flex;flex-direction: column;align-items: flex-start;gap: 4px;padding: 14px 14px 13px;border-radius: 12px;background: var(--card);box-shadow: 0 0 0 1px var(--line), var(--shadow);text-align: left;transition: box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));animation: ui-onb-rise 380ms var(--ease) both;animation-delay: calc(var(--i, 0) * 40ms)}
.ui-onb-template:hover{box-shadow: 0 0 0 1px var(--line-strong), var(--shadow)}
.ui-onb-template[aria-checked="true"]{background: var(--subtle);box-shadow: 0 0 0 1.5px var(--ink), var(--shadow)}
.ui-onb-template__top{display: flex;align-self: stretch;align-items: flex-start;justify-content: space-between;margin-bottom: 10px}
.ui-onb-template__icon{display: grid;place-items: center;width: 32px;height: 32px;border-radius: 9px;background: var(--chip);color: var(--ink)}
.ui-onb-template__check{display: grid;place-items: center;width: 18px;height: 18px;border-radius: 50%;box-shadow: inset 0 0 0 1.5px var(--line-strong);color: transparent;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-onb-template[aria-checked="true"] .ui-onb-template__check{background: var(--ink);box-shadow: none;color: var(--on-ink)}
.ui-onb-template__name{font-size: 14px;line-height: 19px;font-weight: 500;color: var(--ink)}
.ui-onb-template__text{font-size: 12.5px;line-height: 18px;color: var(--muted)}
.ui-onb-template__meta{margin-top: auto;padding-top: 10px;font-size: 12px;line-height: 16px;color: var(--faint)}
.ui-onb-success{animation: ui-onb-in-next var(--nm-dur-4, 380ms) var(--ease) both}
.ui-onb-success__body > .ui-onb-step__title, .ui-onb-success__body > .ui-onb-step__text{padding: 0 28px}
.ui-onb-success__badge{display: grid;place-items: center;width: 40px;height: 40px;margin: 0 28px 16px;border-radius: 50%;background: var(--ink);animation: ui-as-pop var(--nm-dur-4, 380ms) var(--ease) both}
.ui-onb-success__badge svg{width: 20px;height: 20px;fill: none;stroke: var(--on-ink);stroke-width: 2.4;stroke-linecap: round;stroke-linejoin: round}
.ui-onb-success__badge path{stroke-dasharray: 1;stroke-dashoffset: 1;animation: ui-onb-draw var(--nm-dur-4, 380ms) var(--ease) 220ms forwards}
@keyframes ui-onb-draw{to{stroke-dashoffset: 0}
}
.ui-onb-next{display: grid;margin: 20px 18px 0;padding: 0;list-style: none}
.ui-onb-next li{animation: ui-onb-rise 380ms var(--ease) both;animation-delay: calc(200ms + var(--i, 0) * 50ms)}
.ui-onb-next__item{display: flex;align-items: center;gap: 12px;width: 100%;min-height: 56px;padding: 0 10px;border-radius: 12px;text-align: left;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-onb-next__item:hover{background: var(--subtle)}
.ui-onb-next__item > svg{color: var(--faint);transition: translate var(--nm-dur-2, 160ms) var(--ease), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-onb-next__item:hover > svg{color: var(--ink);translate: 2px 0}
.ui-onb-next__icon{display: grid;place-items: center;flex: none;width: 32px;height: 32px;border-radius: 9px;background: var(--chip);color: var(--ink)}
.ui-onb-next__text{display: grid;gap: 1px;flex: 1;min-width: 0}
.ui-onb-next__text b{font-size: 14px;line-height: 19px;font-weight: 500;color: var(--ink)}
.ui-onb-next__text span{font-size: 13px;line-height: 18px;color: var(--muted)}
.ui-onb-check{padding: 16px 8px 8px;border-radius: 14px;background: var(--subtle);box-shadow: inset 0 0 0 1px var(--line-soft)}
.ui-onb-check__head{display: flex;align-items: baseline;justify-content: space-between;padding: 0 8px}
.ui-onb-check__head b{font-size: 13.5px;font-weight: 600;color: var(--ink)}
.ui-onb-check__count{font-size: 12.5px;color: var(--muted);font-variant-numeric: tabular-nums}
.ui-onb-check__count span{display: inline-block;color: var(--ink);animation: ui-onb-rise var(--nm-dur-4, 380ms) var(--ease)}
.ui-onb-check__bar{display: block;height: 4px;margin: 12px 8px 8px;overflow: hidden;border-radius: 999px;background: var(--chip-hover)}
.ui-onb-check__bar i{display: block;height: 100%;border-radius: inherit;background: var(--ink);transform-origin: left;transition: transform 620ms var(--ease)}
.ui-onb-check__list{display: grid;gap: 1px;margin: 0;padding: 0;list-style: none}
.ui-onb-check__item{display: flex;align-items: flex-start;gap: 10px;width: 100%;padding: 8px;border-radius: 9px;text-align: left;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-onb-check__item:hover{background: var(--hover)}
.ui-onb-check__item[aria-current]{background: var(--card);box-shadow: 0 0 0 1px var(--line), var(--shadow)}
.ui-onb-check__mark{display: grid;place-items: center;flex: none;width: 16px;height: 16px;margin-top: 1px;border-radius: 50%;box-shadow: inset 0 0 0 1.5px var(--line-strong);color: var(--on-ink);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-onb-check__mark svg{animation: ui-as-pop var(--nm-dur-3, 240ms) var(--ease)}
.ui-onb-check__item[data-state="current"] .ui-onb-check__mark{box-shadow: inset 0 0 0 1.5px var(--ink)}
.ui-onb-check__item[data-state="done"] .ui-onb-check__mark{background: var(--ink);box-shadow: none}
.ui-onb-check__item[data-state="skipped"] .ui-onb-check__mark{box-shadow: inset 0 0 0 1.5px var(--line-strong)}
.ui-onb-dash{display: block;width: 6px;height: 1.5px;border-radius: 1px;background: var(--faint)}
.ui-onb-check__text{display: grid;gap: 1px;min-width: 0}
.ui-onb-check__label{font-size: 13px;line-height: 18px;font-weight: 500;color: var(--ink)}
.ui-onb-check__item[data-state="todo"] .ui-onb-check__label{color: var(--text);font-weight: 400}
.ui-onb-check__item[data-state="done"] .ui-onb-check__label{color: var(--muted)}
.ui-onb-check__sub{overflow: hidden;font-size: 12px;line-height: 16px;color: var(--muted);white-space: nowrap;text-overflow: ellipsis}
.ui-onb-check__item[data-state="todo"] .ui-onb-check__sub{color: var(--faint)}
.ui-onb-help{display: flex;align-items: center;gap: 10px;padding: 10px 12px;border-radius: 12px;text-align: left;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-onb-help:hover{background: var(--hover)}
.ui-onb-help__icon{display: grid;place-items: center;flex: none;width: 28px;height: 28px;border-radius: 8px;background: var(--chip);color: var(--text)}
.ui-onb-help > span:last-child{display: grid;gap: 1px}
.ui-onb-help b{font-size: 13px;font-weight: 500;color: var(--ink)}
.ui-onb-help > span:last-child > span{font-size: 12px;color: var(--muted)}
@container ui-as-main (max-width: 1000px){.ui-onb{grid-template-columns: minmax(0, 640px);grid-template-areas: "head" "card" "aside";row-gap: 16px;padding: 44px 32px 56px}
.ui-onb-head .ui-onb-steps{margin-bottom: 8px}
.ui-onb-aside{position: static;grid-template-columns: minmax(0, 1fr)}
}
@container ui-as-main (max-width: 620px){.ui-onb-templates{grid-template-columns: minmax(0, 1fr)}
.ui-onb-template__meta{padding-top: 6px}
.ui-onb-invite-row{flex-direction: column;align-items: stretch}
.ui-onb-role{width: 100%}
.ui-onb-tool__desc{white-space: normal}
.ui-onb-tool{padding-top: 8px;padding-bottom: 8px}
}
@container ui-as (max-width: 600px){.ui-onb{padding: 56px 16px 40px}
.ui-onb-title{font-size: 22px;line-height: 28px}
.ui-onb-step{padding: 22px 18px 22px}
.ui-onb-foot{padding: 6px 4px 2px 12px}
.ui-onb-success__body > .ui-onb-step__title, .ui-onb-success__body > .ui-onb-step__text{padding: 0 18px}
.ui-onb-steps__item:not([data-state="current"]) .ui-onb-steps__label{position: absolute;width: 1px;height: 1px;overflow: hidden;clip: rect(0 0 0 0)}
.ui-onb-success__badge{margin-left: 18px;margin-right: 18px}
.ui-onb-next{margin: 16px 8px 0}
.ui-onb-link .ui-button{flex: none}
}
@media (prefers-reduced-motion: reduce){.ui-onb *, .ui-onb *::before, .ui-onb *::after{animation-duration: 1ms !important;animation-delay: 0ms !important;transition-duration: 1ms !important}
.ui-onb-success__badge path{stroke-dashoffset: 0}
}

`;
