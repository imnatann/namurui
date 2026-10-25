"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

/*
 * Analytics – the revenue screen, in a single self-contained file.
 * Four key figures over a mini bar trend, revenue by channel as four lines sharing one cursor,
 * the revenue mix with a sparkline per row, the ranked products, and sessions and average order
 * value over time. Every chart is SVG drawn from its own numbers against a 0–100 viewBox, so
 * nothing is measured from the DOM.
 *
 * The cursor is the interaction. The pointer snaps to the nearest day, a guide drops through the
 * plot, one dot lands on each line and the tooltip slides to that day, flipping past the midpoint
 * so it never leaves the card. Tabbing into a plot opens the same cursor, the arrow keys walk it,
 * Home and End jump to the ends and Escape closes it; the tooltip is a live region, so each day's
 * numbers are announced as they change. The lines draw themselves once on mount, and the sheet
 * drops that animation under prefers-reduced-motion.
 *
 * The sidebar folds to an icon rail and becomes a drawer under 900px, the workspace, period and
 * account menus open from their anchors, and the changelog card dismisses.
 */

export type AnalyticsNavItem = {
  /** Text in the sidebar and the value handed to onNavigate */
  label: string;
  /** Glyph before the label; the built-in set is used when omitted */
  icon?: ReactNode;
  /** Trailing counter, e.g. open invoices */
  count?: number;
};

export type AnalyticsNavGroup = {
  /** Heading above the group, e.g. "Channels" */
  label?: string;
  /** Rows in the group, in order */
  items: AnalyticsNavItem[];
};

export type AnalyticsStat = {
  /** Caption over the figure */
  label: string;
  /** Headline figure, already formatted */
  value: string;
  /** Change against the previous period, already formatted */
  delta: string;
  /** Seven bar heights as percentages of the 26px track */
  bars: number[];
};

export type AnalyticsSeries = {
  /** Name in the tooltip */
  label: string;
  /** Line, dot and swatch colour */
  color: string;
  /** One value per point, in order */
  values: number[];
};

export type AnalyticsChart = {
  /** Card heading */
  title: string;
  /** Figure under the heading, already formatted */
  value: string;
  /** Change beside the figure, already formatted */
  delta: string;
  /** Whether the change reads as a gain or a loss; gains by default */
  deltaTrend?: "up" | "down";
  /** Three y-axis labels, top to bottom */
  ticks: string[];
  /** The value at the top tick – every point is drawn against it */
  max: number;
  /** Axis labels under the plot */
  labels: string[];
  /** One date per point, shown in the tooltip; the axis labels are used when omitted */
  dates?: string[];
  /** Lines in the plot, in draw order */
  series: AnalyticsSeries[];
  /** Line under the card, e.g. what the chart compares */
  footer?: string;
  /** How a tooltip number is written; thousands are compacted by default */
  format?: (value: number) => string;
};

export type AnalyticsBreakdownRow = {
  /** Row label, e.g. "Gross sales" */
  label: string;
  /** Amount, already formatted */
  value: string;
  /** Direction of the sparkline, which also picks its stroke */
  tone: "up" | "down" | "flat";
  /** Raw `points` for the 40×14 sparkline */
  spark: string;
};

export type AnalyticsProduct = {
  /** Product name */
  label: string;
  /** Revenue, already formatted */
  value: string;
  /** Bar width as a percentage of the widest product */
  share: number;
};

export type AnalyticsScreenProps = {
  /** Extra class on the root */
  className?: string;
  /** Workspace name in the sidebar, and the news kicker */
  workspace?: string;
  /** Workspaces the switcher offers */
  workspaces?: string[];
  /** Account at the bottom; initials are drawn from the name */
  user?: { name: string; avatar?: string };
  /** Label of the open page, which carries aria-current */
  active?: string;
  /** Sidebar rows, in groups */
  nav?: AnalyticsNavGroup[];
  /** Called with the label of anything that navigates */
  onNavigate?: (label: string) => void;
  /** The four cards above the charts */
  stats?: AnalyticsStat[];
  /** Main chart, drawn taller than the two beside the products */
  revenue?: AnalyticsChart;
  /** Sessions over time, bottom row */
  sessions?: AnalyticsChart;
  /** Average order value, bottom row */
  orderValue?: AnalyticsChart;
  /** Revenue mix under the main chart */
  breakdown?: AnalyticsBreakdownRow[];
  /** Ranked products beside the bottom charts */
  products?: AnalyticsProduct[];
  /** Changelog card in the sidebar foot; dismissed by its close button */
  news?: { kicker?: string; title: string; action: string };
  /** Progress card under the changelog */
  guide?: { title: string; progress: number; cheer: string };
  /** Period shown in the header before the menu is used */
  period?: string;
  /** Periods the header menu offers */
  periods?: string[];
  /** Called with the period picked from the header menu */
  onPeriodChange?: (period: string) => void;
};

/* ---------- Icons ---------- */

type IconProps = {
  /** px square; the reference sizes each glyph individually */
  size?: number;
};

/** 16px panel glyph with the rail on the left – open and collapse the sidebar. */
function SidebarIcon({ size = 16 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth="1.9"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M2 12C2 8.31087 2 6.4663 2.81382 5.15877C3.1149 4.67502 3.48891 4.25427 3.91891 3.91554C5.08116 3 6.72077 3 10 3H14C17.2792 3 18.9188 3 20.0811 3.91554C20.5111 4.25427 20.8851 4.67502 21.1862 5.15877C22 6.4663 22 8.31087 22 12C22 15.6891 22 17.5337 21.1862 18.8412C20.8851 19.325 20.5111 19.7457 20.0811 20.0845C18.9188 21 17.2792 21 14 21H10C6.72077 21 5.08116 21 3.91891 20.0845C3.48891 19.7457 3.1149 19.325 2.81382 18.8412C2 17.5337 2 15.6891 2 12Z"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="M9.5 3L9.5 21"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M5 7H6M5 10H6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

/** Chevron pointing down – the workspace, period and account menus. */
function ChevronDownIcon({ size = 13 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth="1.9"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

/** Magnifier in the sidebar tools. */
function SearchIcon({ size = 16 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth="1.9"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M17 17L21 21"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

/** House outline – the first menu row. */
function HomeIcon({ size = 16 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth="1.9"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M3 11.9896V14.5C3 17.7998 3 19.4497 4.02513 20.4749C5.05025 21.5 6.70017 21.5 10 21.5H14C17.2998 21.5 18.9497 21.5 19.9749 20.4749C21 19.4497 21 17.7998 21 14.5V11.9896C21 10.3083 21 9.46773 20.6441 8.74005C20.2882 8.01237 19.6247 7.49628 18.2976 6.46411L16.2976 4.90855C14.2331 3.30285 13.2009 2.5 12 2.5C10.7991 2.5 9.76689 3.30285 7.70242 4.90855L5.70241 6.46411C4.37533 7.49628 3.71179 8.01237 3.3559 8.74005C3 9.46773 3 10.3083 3 11.9896Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

/** Three bars in a rounded frame – the revenue page and its title. */
function BarsIcon({ size = 16 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth="1.9"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M7 17L7 13"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      <path
        d="M12 17L12 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      <path
        d="M17 17L17 11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      <path
        d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

/** Receipt with two ruled lines – the invoices row. */
function InvoiceIcon({ size = 16 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth="1.9"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M4 18.6458V8.05426C4 5.20025 4 3.77325 4.87868 2.88663C5.75736 2 7.17157 2 10 2H14C16.8284 2 18.2426 2 19.1213 2.88663C20 3.77325 20 5.20025 20 8.05426V18.6458C20 20.1575 20 20.9133 19.538 21.2108C18.7831 21.6971 17.6161 20.6774 17.0291 20.3073C16.5441 20.0014 16.3017 19.8485 16.0325 19.8397C15.7417 19.8301 15.4949 19.9768 14.9709 20.3073L13.06 21.5124C12.5445 21.8374 12.2868 22 12 22C11.7132 22 11.4555 21.8374 10.94 21.5124L9.02913 20.3073C8.54415 20.0014 8.30166 19.8485 8.03253 19.8397C7.74172 19.8301 7.49493 19.9768 6.97087 20.3073C6.38395 20.6774 5.21687 21.6971 4.46195 21.2108C4 20.9133 4 20.1575 4 18.6458Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M11 11H8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M14 7L8 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

/** Billfold with a clasp – payouts and wholesale. */
function WalletIcon({ size = 16 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth="1.9"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M14 3H5C3.89543 3 3 3.89543 3 5C3 6.10457 3.89543 7 5 7H18C18 6.07003 18 5.60504 17.8978 5.22354C17.6204 4.18827 16.8117 3.37962 15.7765 3.10222C15.395 3 14.93 3 14 3Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M3 5V15C3 17.8284 3 19.2426 3.87868 20.1213C4.75736 21 6.17157 21 9 21H15C17.8284 21 19.2426 21 20.1213 20.1213C21 19.2426 21 17.8284 21 15V13C21 10.1716 21 8.75736 20.1213 7.87868C19.2426 7 17.8284 7 15 7H7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M21 12H19C18.535 12 18.3025 12 18.1118 12.0511C17.5941 12.1898 17.1898 12.5941 17.0511 13.1118C17 13.3025 17 13.535 17 14C17 14.465 17 14.6975 17.0511 14.8882C17.1898 15.4059 17.5941 15.8102 18.1118 15.9489C18.3025 16 18.535 16 19 16H21"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

/** Two people – the customers row. */
function CustomersIcon({ size = 16 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth="1.9"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M16 21C15.7668 18.0685 13.3422 15.7477 10.3085 15.5521L9.49999 15.5C9.21121 15.5076 8.94209 15.5178 8.68816 15.5298C5.68124 15.6723 3.23089 18.0974 3 21"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M12.75 9.75C12.75 11.5449 11.2949 13 9.5 13C7.70508 13 6.25 11.5449 6.25 9.75C6.25 7.95507 7.70508 6.5 9.5 6.5C11.2949 6.5 12.75 7.95507 12.75 9.75Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M21 17.501C20.7709 14.6314 18.4541 12.2748 15.5 11.9961"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M15.9877 9C16.8965 8.42434 17.5001 7.40788 17.5001 6.25C17.5001 4.45507 16.0496 3 14.2602 3C13.3811 3 12.5838 3.35121 12.0001 3.92139"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

/** Shopfront with an awning – the online store channel. */
function StoreIcon({ size = 16 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth="1.9"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M3.50002 10V15C3.50002 17.8284 3.50002 19.2426 4.37869 20.1213C5.25737 21 6.67159 21 9.50002 21H14.5C17.3284 21 18.7427 21 19.6213 20.1213C20.5 19.2426 20.5 17.8284 20.5 15V10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M17 7.50184C17 8.88255 15.8807 9.99997 14.5 9.99997C13.1193 9.99997 12 8.88068 12 7.49997C12 8.88068 10.8807 9.99997 9.50002 9.99997C8.1193 9.99997 7.00002 8.88068 7.00002 7.49997C7.00002 8.88068 5.82655 9.99997 4.37901 9.99997C3.59984 9.99997 2.90008 9.67567 2.42 9.16087C1.59462 8.2758 2.12561 6.97403 2.81448 5.98842L3.20202 5.45851C4.08386 4.2527 4.52478 3.6498 5.16493 3.32494C5.80508 3.00008 6.55201 3.00018 8.04587 3.00038L15.9551 3.00143C17.4485 3.00163 18.1952 3.00173 18.8351 3.32658C19.475 3.65143 19.9158 4.25414 20.7974 5.45957L21.1855 5.99029C21.8744 6.97589 22.4054 8.27766 21.58 9.16273C21.0999 9.67754 20.4002 10.0018 19.621 10.0018C18.1734 10.0018 17 8.88255 17 7.50184Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M14.9971 17C14.3133 17.6072 13.2247 18 11.9985 18C10.7723 18 9.68376 17.6072 9 17"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

/** Shopping bag with a handle – the marketplace channel. */
function BagIcon({ size = 16 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth="1.9"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M3.32352 13.0113C3.6739 10.009 4.18586 7.75784 4.66063 6.15851C5.04994 4.84711 5.24459 4.19141 6.04283 3.5957C6.84107 3 7.65697 3 9.28876 3H14.7113C16.3431 3 17.159 3 17.9572 3.5957C18.7554 4.19141 18.9501 4.84711 19.3394 6.15851C19.8142 7.75784 20.3261 10.009 20.6765 13.0113C21.0895 16.5497 21.2959 18.3189 20.1027 19.6594C18.9095 21 16.9758 21 13.1084 21H10.8916C7.02422 21 5.09052 21 3.89731 19.6594C2.70411 18.3189 2.91058 16.5497 3.32352 13.0113Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M9 7C9 8.65685 10.3431 10 12 10C13.6569 10 15 8.65685 15 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

/** Two arrows chasing each other – the subscriptions channel. */
function SubscriptionsIcon({ size = 16 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth="1.9"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M16.3884 3L17.3913 3.97574C17.8393 4.41165 18.0633 4.62961 17.9844 4.81481C17.9056 5 17.5888 5 16.9552 5H9.19422C5.22096 5 2 8.13401 2 12C2 13.4872 2.47668 14.8662 3.2895 16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M7.61156 21L6.60875 20.0243C6.16074 19.5883 5.93673 19.3704 6.01557 19.1852C6.09441 19 6.4112 19 7.04478 19H14.8058C18.779 19 22 15.866 22 12C22 10.5128 21.5233 9.13383 20.7105 8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

/** Cross – dismiss the changelog card. */
function CloseIcon({ size = 13 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth="1.9"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

/** Chevron pointing right – the changelog link and the guide card. */
function ChevronRightIcon({ size = 13 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth="1.9"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

/** Calendar with a ruled head and a dotted grid – the period button. */
function CalendarIcon({ size = 15 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth="1.9"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M16 2V6M8 2V6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M13 4H11C7.22876 4 5.34315 4 4.17157 5.17157C3 6.34315 3 8.22876 3 12V14C3 17.7712 3 19.6569 4.17157 20.8284C5.34315 22 7.22876 22 11 22H13C16.7712 22 18.6569 22 19.8284 20.8284C21 19.6569 21 17.7712 21 14V12C21 8.22876 21 6.34315 19.8284 5.17157C18.6569 4 16.7712 4 13 4Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M3 10H21"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M12.1258 14H12.0008M12.1258 18H12.0008M7.625 14H7.5M7.625 18H7.5M16.625 14H16.5M12.2508 14C12.2508 14.1381 12.1389 14.25 12.0008 14.25C11.8628 14.25 11.7508 14.1381 11.7508 14C11.7508 13.8619 11.8628 13.75 12.0008 13.75C12.1389 13.75 12.2508 13.8619 12.2508 14ZM12.2508 18C12.2508 18.1381 12.1389 18.25 12.0008 18.25C11.8628 18.25 11.7508 18.1381 11.7508 18C11.7508 17.8619 11.8628 17.75 12.0008 17.75C12.1389 17.75 12.2508 17.8619 12.2508 18ZM7.75 14C7.75 14.1381 7.63807 14.25 7.5 14.25C7.36193 14.25 7.25 14.1381 7.25 14C7.25 13.8619 7.36193 13.75 7.5 13.75C7.63807 13.75 7.75 13.8619 7.75 14ZM7.75 18C7.75 18.1381 7.63807 18.25 7.5 18.25C7.36193 18.25 7.25 18.1381 7.25 18C7.25 17.8619 7.36193 17.75 7.5 17.75C7.63807 17.75 7.75 17.8619 7.75 18ZM16.75 14C16.75 14.1381 16.6381 14.25 16.5 14.25C16.3619 14.25 16.25 14.1381 16.25 14C16.25 13.8619 16.3619 13.75 16.5 13.75C16.6381 13.75 16.75 13.8619 16.75 14Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

/** Arrow dropping onto a tray – the export button. */
function DownloadIcon({ size = 14 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className=""
      strokeWidth="1.9"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M16.9504 12.1817C17.1981 12.814 16.5076 13.5726 15.1267 15.0899C13.6702 16.6902 12.9201 17.4904 12 17.5C11.0799 17.4904 10.3298 16.6902 8.87331 15.0899C7.49239 13.5726 6.80193 12.814 7.04964 12.1817C7.05868 12.1586 7.06851 12.1359 7.0791 12.1135C7.34928 11.542 8.24477 11.5029 10 11.5002V4.99998C10 4.53501 10 4.30253 10.0511 4.11179C10.1898 3.59414 10.5941 3.1898 11.1118 3.05111C11.3025 3 11.535 3 12 3C12.4649 3 12.6974 3 12.8882 3.05111C13.4058 3.1898 13.8102 3.59414 13.9489 4.11179C14 4.30253 14 4.53501 14 4.99998V11.5002C15.7552 11.5029 16.6507 11.542 16.9209 12.1135C16.9315 12.1359 16.9413 12.1586 16.9504 12.1817Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M5.00006 21H19.0001"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

/* ---------- Defaults ---------- */

/** 4200 → "4.2k", 960 → "960": the way the charts write a tooltip number. */
const compact = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${value}`);

const WEEK = ["Mar 3", "Mar 6", "Mar 9"];

const WEEK_DATES = [
  "Mon, Mar 3",
  "Tue, Mar 4",
  "Wed, Mar 5",
  "Thu, Mar 6",
  "Fri, Mar 7",
  "Sat, Mar 8",
  "Sun, Mar 9",
];

const WORKSPACES = ["Acme", "Northwind", "Fieldnotes"];

const PERIODS = ["Last 7 days", "Last 30 days", "Last 90 days"];

const NAV: AnalyticsNavGroup[] = [
  {
    items: [
      { label: "Home", icon: <HomeIcon /> },
      { label: "Revenue", icon: <BarsIcon /> },
      { label: "Invoices", icon: <InvoiceIcon />, count: 12 },
      { label: "Payouts", icon: <WalletIcon /> },
      { label: "Customers", icon: <CustomersIcon /> },
    ],
  },
  {
    label: "Channels",
    items: [
      { label: "Online store", icon: <StoreIcon /> },
      { label: "Marketplace", icon: <BagIcon /> },
      { label: "Wholesale", icon: <WalletIcon /> },
      { label: "Subscriptions", icon: <SubscriptionsIcon /> },
    ],
  },
];

const STATS: AnalyticsStat[] = [
  { label: "Gross revenue", value: "$96,412", delta: "+12.5%", bars: [50, 70, 60, 80, 70, 90, 100] },
  { label: "Active customers", value: "2,847", delta: "+8.2%", bars: [60, 60, 70, 70, 80, 80, 90] },
  { label: "Conversion", value: "3.24%", delta: "+0.4%", bars: [70, 50, 60, 80, 60, 70, 80] },
  { label: "Refund rate", value: "1.8%", delta: "-0.3%", bars: [90, 80, 80, 60, 70, 50, 40] },
];

const REVENUE: AnalyticsChart = {
  title: "Revenue by channel",
  value: "$96.4k",
  delta: "+$7.9k",
  ticks: ["$6k", "$3k", "$0"],
  max: 6000,
  labels: WEEK,
  dates: WEEK_DATES,
  series: [
    { label: "Organic", color: "#2f6bff", values: [4200, 4700, 3900, 4600, 5400, 5100, 5900] },
    { label: "Paid ads", color: "#ec4899", values: [3600, 3300, 4400, 4800, 4000, 4500, 4200] },
    { label: "Referral", color: "#8b5cf6", values: [1800, 2300, 2000, 1500, 2400, 2200, 2700] },
    { label: "Email", color: "#14b8a6", values: [1200, 1100, 1700, 2100, 1600, 1300, 1500] },
  ],
  footer: "Top 4 channels",
  format: (value) => `$${compact(value)}`,
};

const SESSIONS: AnalyticsChart = {
  title: "Sessions over time",
  value: "16.4k",
  delta: "+2.3k",
  ticks: ["3k", "1.5k", "0"],
  max: 3000,
  labels: WEEK,
  dates: WEEK_DATES,
  series: [
    { label: "This week", color: "#2f6bff", values: [1820, 2140, 1960, 2480, 2710, 2390, 2950] },
    { label: "Last week", color: "#a5c0ff", values: [1650, 1720, 1880, 1790, 2010, 1940, 2100] },
  ],
  footer: "This week vs. last week",
};

const ORDER_VALUE: AnalyticsChart = {
  title: "Average order value",
  value: "$141",
  delta: "+$17",
  ticks: ["$160", "$80", "$0"],
  max: 160,
  labels: WEEK,
  dates: WEEK_DATES,
  series: [
    { label: "This week", color: "#2f6bff", values: [118, 124, 121, 132, 129, 137, 141] },
    { label: "Last week", color: "#a5c0ff", values: [112, 115, 119, 117, 121, 120, 124] },
  ],
  footer: "This week vs. last week",
  format: (value) => `$${value}`,
};

const BREAKDOWN: AnalyticsBreakdownRow[] = [
  {
    label: "Gross sales",
    value: "$104,210",
    tone: "up",
    spark: "0,13 6.666666666666666,8.2 13.333333333333332,10.6 20,5.800000000000001 26.666666666666664,8.2 33.333333333333336,3.3999999999999986 40,1",
  },
  {
    label: "Discounts",
    value: "\u2212$4,180",
    tone: "down",
    spark: "0,7 6.666666666666666,13 13.333333333333332,1 20,7 26.666666666666664,13 33.333333333333336,7 40,13",
  },
  {
    label: "Refunds",
    value: "\u2212$1,734",
    tone: "down",
    spark: "0,1 6.666666666666666,5 13.333333333333332,5 20,9 26.666666666666664,9 33.333333333333336,13 40,13",
  },
  {
    label: "Shipping",
    value: "$2,940",
    tone: "up",
    spark: "0,13 6.666666666666666,9 13.333333333333332,9 20,5 26.666666666666664,9 33.333333333333336,5 40,1",
  },
  {
    label: "Taxes",
    value: "$8,316",
    tone: "flat",
    spark: "0,7 6.666666666666666,7 13.333333333333332,7 20,7 26.666666666666664,7 33.333333333333336,7 40,7",
  },
  {
    label: "Net revenue",
    value: "$96,412",
    tone: "up",
    spark: "0,13 6.666666666666666,10.6 13.333333333333332,10.6 20,8.2 26.666666666666664,5.800000000000001 33.333333333333336,5.800000000000001 40,1",
  },
];

const PRODUCTS: AnalyticsProduct[] = [
  { label: "Annual plan", value: "$38,400", share: 100 },
  { label: "Team seats", value: "$24,150", share: 63 },
  { label: "Monthly plan", value: "$18,920", share: 49 },
  { label: "Add-ons", value: "$9,640", share: 25 },
];

const NEWS = { title: "Shared folders", action: "Full changelog" };

const GUIDE = { title: "Getting started", progress: 13, cheer: "Great start!" };

/* ---------- Chart ---------- */

type ChartProps = {
  /** Numbers, scale and copy for one card */
  chart: AnalyticsChart;
  /** Stretches the plot for the revenue card in the main row */
  tall?: boolean;
};

/**
 * One KPI card: the figure, the axis, the lines and the cursor the pointer and the keyboard
 * share. The marker and the tooltip stay in the DOM – `open` only fades them in – so the card
 * reads the same day before anyone touches it.
 */
function Chart({ chart, tall }: ChartProps) {
  const { title, value, delta, deltaTrend = "up", ticks, max, labels, dates, series, footer } = chart;
  const format = chart.format ?? compact;

  const points = series.reduce((count, line) => Math.max(count, line.values.length), 0);
  const last = Math.max(points - 1, 0);

  const [cursor, setCursor] = useState(0);
  const [open, setOpen] = useState(false);
  const index = Math.min(Math.max(cursor, 0), last);

  const x = points > 1 ? (index / last) * 100 : 50;

  const follow = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (!box.width || points === 0) return;
    const ratio = (event.clientX - box.left) / box.width;
    setCursor(Math.min(last, Math.max(0, Math.round(ratio * last))));
    setOpen(true);
  };

  const walk = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (points === 0) return;
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    let next = index;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = Math.max(0, index - 1);
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") next = Math.min(last, index + 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    setCursor(next);
    setOpen(true);
    event.preventDefault();
  };

  return (
    <section className={tall ? "ui-kpi ui-as-rev__chart ui-as-rev__chart--tall" : "ui-kpi ui-as-rev__chart"}>
      <h3 className="ui-kpi__title">{title}</h3>
      <p className="ui-kpi__value">
        {value}
        <span className="ui-kpi__delta" data-trend={deltaTrend}>
          {delta}
        </span>
      </p>

      <div className="ui-kpi__chart">
        <div className="ui-kpi__yaxis" aria-hidden="true">
          {ticks.map((tick, at) => (
            <span key={at}>{tick}</span>
          ))}
        </div>

        <div
          className="ui-kpi__plot"
          tabIndex={0}
          role="group"
          aria-label={`${title} chart \u2013 use the arrow keys to read the values per day`}
          onPointerMove={follow}
          onPointerDown={follow}
          onPointerLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={walk}
        >
          {ticks.map((tick, at) => (
            <span
              key={at}
              className="ui-kpi__grid"
              style={{ top: `${(at / Math.max(ticks.length - 1, 1)) * 100}%` }}
            />
          ))}

          <svg className="ui-kpi__lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {series.map((line) => (
              <polyline
                key={line.label}
                points={Array.from({ length: points }, (_, at) => {
                  // One division per point across the 0–100 box, and one against `max` up it
                  const px = points > 1 ? (at / (points - 1)) * 100 : 50;
                  const py = max > 0 ? (1 - (line.values[at] ?? 0) / max) * 100 : 100;
                  return `${px},${py}`;
                }).join(" ")}
                stroke={line.color}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          <div className="ui-kpi__marker" aria-hidden="true" data-open={open ? "" : undefined}>
            <span className="ui-kpi__guide" style={{ left: `${x}%` }} />
            {series.map((line) => (
              <span
                key={line.label}
                className="ui-kpi__dot"
                style={{
                  left: `${x}%`,
                  top: `${max > 0 ? (1 - (line.values[index] ?? 0) / max) * 100 : 100}%`,
                  background: line.color,
                }}
              />
            ))}
          </div>

          <div
            className="ui-kpi__tooltip"
            data-side={x > 50 ? "left" : "right"}
            data-open={open ? "" : undefined}
            role="status"
            aria-live="polite"
            style={{ left: `${x}%` }}
          >
            <p className="ui-kpi__date">{dates?.[index] ?? labels[index]}</p>
            <ul>
              {series.map((line) => (
                <li key={line.label}>
                  <span className="ui-kpi__swatch" style={{ background: line.color }} />
                  <span className="ui-kpi__label">{line.label}</span>
                  <span className="ui-kpi__num">{format(line.values[index] ?? 0)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="ui-kpi__xaxis" aria-hidden="true">
          {labels.map((label, at) => (
            <span
              key={`${label}-${at}`}
              data-edge={at === 0 ? "start" : at === labels.length - 1 ? "end" : undefined}
              style={{ left: `${labels.length > 1 ? (at / (labels.length - 1)) * 100 : 50}%` }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {footer ? <p className="ui-kpi__footer">{footer}</p> : null}
    </section>
  );
}

/* ---------- Screen ---------- */

export function AnalyticsScreen({
  className,
  workspace = "Acme",
  workspaces = WORKSPACES,
  user = { name: "Alex Morgan" },
  active = "Revenue",
  nav = NAV,
  onNavigate,
  stats = STATS,
  revenue = REVENUE,
  sessions = SESSIONS,
  orderValue = ORDER_VALUE,
  breakdown = BREAKDOWN,
  products = PRODUCTS,
  news = NEWS,
  guide = GUIDE,
  period = "Last 7 days",
  periods = PERIODS,
  onPeriodChange,
}: AnalyticsScreenProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [page, setPage] = useState(active);
  const [space, setSpace] = useState(workspace);
  const [range, setRange] = useState(period);
  const [showNews, setShowNews] = useState(true);
  const [menu, setMenu] = useState<"workspace" | "period" | "account" | null>(null);
  const shell = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLSpanElement>(null);
  const periodButton = useRef<HTMLSpanElement>(null);
  const account = useRef<HTMLSpanElement>(null);

  useEffect(() => setPage(active), [active]);
  useEffect(() => setSpace(workspace), [workspace]);
  useEffect(() => setRange(period), [period]);

  // One listener pair closes whichever popover is open – Esc also closes the drawer
  useEffect(() => {
    if (!menu && !drawer) return;
    const onDown = (event: PointerEvent) => {
      const node = event.target as Node;
      if (!top.current?.contains(node) && !periodButton.current?.contains(node) && !account.current?.contains(node)) {
        setMenu(null);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenu(null);
      setDrawer(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu, drawer]);

  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  const go = (label: string) => {
    setPage(label);
    setDrawer(false);
    setMenu(null);
    onNavigate?.(label);
  };

  // The rail's open button restores the sidebar, as an overlay where the shell is narrow
  const openSide = () => {
    setCollapsed(false);
    if ((shell.current?.getBoundingClientRect().width ?? Number.POSITIVE_INFINITY) < 900) {
      setDrawer(true);
    }
  };

  return (
    <div
      className={["ui-as ui-as-app", className].filter(Boolean).join(" ")}
      data-collapsed={collapsed || undefined}
      data-drawer={drawer || undefined}
      ref={shell}
    >
      {/* React 19 hoists this into <head> once, no matter how many screens render */}
      <style href="ui-analytics" precedence="default">
        {css}
      </style>

      <button
        className="ui-as-icon-btn ui-as-side-open"
        type="button"
        aria-label="Open sidebar"
        tabIndex={collapsed ? 0 : -1}
        onClick={openSide}
      >
        <SidebarIcon />
      </button>

      <div className="ui-as-scrim" aria-hidden="true" onClick={() => setDrawer(false)} />

      <aside className="ui-as-side">
        <header className="ui-as-side__head">
          <span className="ui-as-anchor" ref={top}>
            <button
              className="ui-as-side__workspace"
              type="button"
              aria-expanded={menu === "workspace"}
              onClick={() => setMenu(menu === "workspace" ? null : "workspace")}
            >
              <span className="ui-as-side__logo">{space.charAt(0).toUpperCase()}</span>
              {space}
              <ChevronDownIcon />
            </button>

            {menu === "workspace" && (
              <div className="ui-as-popover" role="menu" aria-label="Switch workspace">
                <div className="ui-as-menu">
                  <span className="ui-as-menu__title">Workspaces</span>
                  <div className="ui-as-menu__list">
                    {workspaces.map((name) => (
                      <button
                        key={name}
                        type="button"
                        role="menuitemradio"
                        aria-checked={name === space}
                        className="ui-as-menu__item"
                        onClick={() => {
                          setSpace(name);
                          setMenu(null);
                          onNavigate?.(name);
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </span>

          <span className="ui-as-side__tools">
            <button className="ui-as-icon-btn" type="button" aria-label="Search" onClick={() => go("Search")}>
              <SearchIcon />
            </button>
            <button
              className="ui-as-icon-btn"
              type="button"
              aria-label="Collapse sidebar"
              onClick={() => setCollapsed(true)}
            >
              <SidebarIcon />
            </button>
          </span>
        </header>

        <nav className="ui-as-side__nav" aria-label="Main menu">
          {nav.map((group, at) => (
            <div key={group.label ?? `group-${at}`} className="ui-as-side__group">
              {group.label ? <span className="ui-as-side__label">{group.label}</span> : null}
              {group.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="ui-as-side__item"
                  aria-current={item.label === page ? "page" : undefined}
                  onClick={() => go(item.label)}
                >
                  {item.icon}
                  {item.label}
                  {item.count === undefined ? null : <span className="ui-as-side__count">{item.count}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="ui-as-side__foot">
          {showNews && (
            <div className="ui-as-news" data-count="2">
              <div className="ui-as-news__card ui-as-news__card--back" aria-hidden="true">
                <span className="ui-as-news__kicker">{news.kicker ?? `New in ${space}`}</span>
                <CloseIcon />
              </div>
              <div className="ui-as-news__card">
                <div className="ui-as-news__top">
                  <span className="ui-as-news__kicker">{news.kicker ?? `New in ${space}`}</span>
                  <button
                    type="button"
                    className="ui-as-news__close"
                    aria-label="Dismiss"
                    onClick={() => setShowNews(false)}
                  >
                    <CloseIcon />
                  </button>
                </div>
                <b className="ui-as-news__title">{news.title}</b>
                <button type="button" className="ui-as-news__more" onClick={() => go(news.action)}>
                  {news.action}
                  <ChevronRightIcon />
                </button>
              </div>
            </div>
          )}

          <div className="ui-as-guide-slot" style={{ height: 70 }}>
            <div className="ui-as-guide" data-state="closed" style={{ height: 70 }}>
              <div className="ui-as-guide__inner">
                <button
                  type="button"
                  className="ui-as-steps ui-as-guide__content"
                  aria-expanded={false}
                  onClick={() => go(guide.title)}
                >
                  <span className="ui-as-steps__title">
                    {guide.title}
                    <ChevronRightIcon />
                  </span>
                  <span className="ui-as-steps__sub">
                    {guide.progress}% done · <span className="ui-as-steps__cheer">{guide.cheer}</span>
                  </span>
                  <span className="ui-as-steps__bar">
                    <i style={{ width: `${guide.progress}%` }} />
                  </span>
                </button>
              </div>
            </div>
          </div>

          <span className="ui-as-anchor ui-as-user-menu" ref={account}>
            <button
              type="button"
              className="ui-as-user"
              aria-expanded={menu === "account"}
              onClick={() => setMenu(menu === "account" ? null : "account")}
            >
              {user.avatar ? (
                <img src={user.avatar} alt="" width={21} height={21} />
              ) : (
                <span className="ui-as-user__initials">{initials}</span>
              )}
              {user.name}
              <ChevronDownIcon />
            </button>

            {menu === "account" && (
              <div className="ui-as-popover" data-side="top" role="menu" aria-label="Account">
                <div className="ui-as-menu">
                  <div className="ui-as-menu__list">
                    <button
                      type="button"
                      role="menuitem"
                      className="ui-as-menu__item"
                      onClick={() => go("Account settings")}
                    >
                      Account settings
                    </button>
                    <button type="button" role="menuitem" className="ui-as-menu__item" onClick={() => go("Billing")}>
                      Billing
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="ui-as-menu__item"
                      data-danger
                      onClick={() => go("Sign out")}
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            )}
          </span>
        </div>
      </aside>

      <main className="ui-as-main">
        <div className="ui-as-rev">
          <header className="ui-as-rev__head">
            <h1>
              <BarsIcon size={17} />
              Revenue
            </h1>

            <div className="ui-as-rev__actions">
              <span className="ui-as-anchor" ref={periodButton}>
                <button
                  type="button"
                  className="ui-as-tool ui-as-tool--label ui-as-rev__period"
                  aria-expanded={menu === "period"}
                  aria-haspopup="menu"
                  onClick={() => setMenu(menu === "period" ? null : "period")}
                >
                  <CalendarIcon />
                  {range}
                  <ChevronDownIcon />
                </button>

                {menu === "period" && (
                  <div className="ui-as-popover" data-align="end" role="menu" aria-label="Date range">
                    <div className="ui-as-menu">
                      <div className="ui-as-menu__list">
                        {periods.map((option) => (
                          <button
                            key={option}
                            type="button"
                            role="menuitemradio"
                            aria-checked={option === range}
                            className="ui-as-menu__item"
                            onClick={() => {
                              setRange(option);
                              setMenu(null);
                              onPeriodChange?.(option);
                            }}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </span>

              <button
                type="button"
                className="ui-button"
                data-variant="secondary"
                data-size="sm"
                data-ready="true"
                onClick={() => go("Export")}
              >
                <span className="ui-button__icon" aria-hidden="true">
                  <DownloadIcon />
                </span>
                <span className="ui-button__label" data-text="Export">
                  Export
                </span>
              </button>

              <button
                type="button"
                className="ui-button"
                data-variant="primary"
                data-size="sm"
                data-ready="true"
                onClick={() => go("Save as report")}
              >
                <span className="ui-button__label" data-text="Save as report">
                  Save as report
                </span>
              </button>
            </div>
          </header>

          <div className="ui-as-rev__content">
            <div className="ui-as-rev__stats">
              {stats.map((stat, at) => (
                <div
                  key={stat.label}
                  className="ui-as-rev__card ui-as-rev__stat ui-as-rise"
                  style={{ "--i": at } as CSSProperties}
                >
                  <span className="ui-as-rev__cap">{stat.label}</span>
                  <div className="ui-as-rev__stat-row">
                    <strong>
                      {stat.value}
                      <em>{stat.delta}</em>
                    </strong>
                    <span className="ui-as-rev__minibars" aria-hidden="true">
                      {stat.bars.map((bar, index) => (
                        <i key={index} style={{ height: `${bar}%` }} />
                      ))}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="ui-as-rev__row ui-as-rev__row--main">
              <Chart chart={revenue} tall />

              <div className="ui-as-rev__card ui-as-rev__breakdown">
                <span className="ui-as-rev__cap">Revenue breakdown</span>
                <ul>
                  {breakdown.map((row) => (
                    <li key={row.label}>
                      <span>{row.label}</span>
                      <b>{row.value}</b>
                      <svg className="ui-as-rev__spark" data-tone={row.tone} viewBox="0 0 40 14" aria-hidden="true">
                        <polyline points={row.spark} />
                      </svg>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="ui-as-rev__row ui-as-rev__row--3">
              <div className="ui-as-rev__card ui-as-rev__products">
                <span className="ui-as-rev__cap">Top products</span>
                {products.map((product) => (
                  <div key={product.label} className="ui-as-rev__product">
                    <span>
                      {product.label}
                      <b>{product.value}</b>
                    </span>
                    <i style={{ width: `${product.share}%` }} />
                  </div>
                ))}
              </div>

              <Chart chart={sessions} />
              <Chart chart={orderValue} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
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
.ui-as-rev{display: flex;flex-direction: column;min-height: 100%}
.ui-as-rev__head{display: flex;flex: none;align-items: center;justify-content: space-between;height: 60px;padding: 0 16px 0 24px}
.ui-as-rev__head h1{display: flex;align-items: center;gap: 8px;margin: 0;font-size: 16px;font-weight: 500;color: var(--ink)}
.ui-as-rev__actions{display: flex;align-items: center;gap: 6px}
.ui-as-rev__period{border-radius: 9px}
.ui-as-rev__content{display: flex;flex: 1;flex-direction: column;gap: 12px;padding: 0 16px 16px}
.ui-as-rev__card{padding: 14px 16px;border-radius: 14px;background: var(--card);box-shadow: 0 0 0 1px var(--line), var(--shadow)}
.ui-as-rev__cap{align-self: flex-start;font-size: 13px;color: var(--muted);text-decoration: underline dotted var(--faint);text-underline-offset: 3px}
.ui-as-rev__stats{display: grid;grid-template-columns: repeat(4, minmax(0, 1fr));gap: 12px}
.ui-as-rev__stat{display: flex;flex-direction: column;gap: 14px}
.ui-as-rev__stat-row{display: flex;align-items: flex-end;justify-content: space-between}
.ui-as-rev__stat strong{display: flex;align-items: baseline;gap: 8px;font-size: 22px;font-weight: 500;letter-spacing: -0.02em;color: var(--ink);font-variant-numeric: tabular-nums}
.ui-as-rev__stat em{font-size: 12px;font-style: normal;font-weight: 500;letter-spacing: 0;color: #2f8d5c}
.ui-as-rev__minibars{display: flex;align-items: flex-end;gap: 3px;height: 26px}
.ui-as-rev__minibars i{width: 5px;border-radius: 2px;background: var(--line)}
.ui-as-rev__minibars i:last-child{background: var(--faint)}
.ui-as-rev__row{display: grid;grid-template-columns: minmax(0, 1fr) 340px;gap: 12px;align-items: stretch}
.ui-as-rev__row--main{flex: 1}
.ui-as-rev__row--3{grid-template-columns: repeat(3, minmax(0, 1fr))}
.ui-as-rev .ui-as-rev__chart.ui-kpi{--ui-kpi-shadow: 0 0 0 1px var(--line), var(--shadow);width: 100%;max-width: none;border: 0;border-radius: 14px}
.ui-as-rev .ui-as-rev__chart--tall.ui-kpi{display: flex;flex-direction: column}
.ui-as-rev .ui-as-rev__chart--tall .ui-kpi__chart{flex: 1;grid-template-rows: minmax(116px, 1fr) 20px}
.ui-as-rev__breakdown{display: flex;flex-direction: column}
.ui-as-rev__breakdown ul{display: flex;flex-direction: column;margin: 12px -6px 0;padding: 0;list-style: none}
.ui-as-rev__breakdown li{display: grid;grid-template-columns: 1fr auto 40px;align-items: center;gap: 12px;height: 38px;padding: 0 8px;border-radius: 8px;font-size: 13.5px}
.ui-as-rev__breakdown li:nth-child(even){background: var(--chip)}
.ui-as-rev__breakdown li span{color: var(--muted)}
.ui-as-rev__breakdown li b{font-weight: 500;color: var(--ink);font-variant-numeric: tabular-nums}
.ui-as-rev__spark{width: 40px;height: 14px;overflow: visible}
.ui-as-rev__spark polyline{fill: none;stroke-width: 1.5;stroke-linecap: round;stroke-linejoin: round;vector-effect: non-scaling-stroke}
.ui-as-rev__spark[data-tone="up"] polyline{stroke: #2f8d5c}
.ui-as-rev__spark[data-tone="down"] polyline{stroke: #b3261e}
.ui-as-rev__spark[data-tone="flat"] polyline{stroke: var(--faint)}
.ui-as-rev__products{display: flex;flex-direction: column;gap: 14px}
.ui-as-rev__product{display: flex;flex-direction: column;gap: 7px}
.ui-as-rev__product span{display: flex;justify-content: space-between;font-size: 13.5px;color: var(--muted)}
.ui-as-rev__product b{font-weight: 500;color: var(--ink);font-variant-numeric: tabular-nums}
.ui-as-rev__product i{display: block;height: 6px;border-radius: 3px;background: #ff6b35}
.ui-as-rev__head{transition: padding-left var(--nm-dur-4, 380ms) var(--ease)}
.ui-as-app[data-collapsed] .ui-as-rev__head{padding-left: 52px}
@container ui-as-main (max-width: 900px){.ui-as-rev__row{grid-template-columns: minmax(0, 1fr)}
.ui-as-rev__row--3{grid-template-columns: repeat(2, minmax(0, 1fr))}
.ui-as-rev__row--3 > .ui-as-rev__products{grid-column: 1 / -1}
}
@container ui-as-main (max-width: 820px){.ui-as-rev__stats{grid-template-columns: repeat(2, minmax(0, 1fr))}
}
@container ui-as-main (max-width: 560px){.ui-as-rev__row--3{grid-template-columns: minmax(0, 1fr)}
.ui-as-rev__stats{gap: 8px}
.ui-as-rev__stat{gap: 10px;padding: 12px}
.ui-as-rev__stat strong{flex-wrap: wrap;gap: 0 6px;font-size: 19px}
.ui-as-rev__minibars{display: none}
}
@container ui-as (max-width: 900px){.ui-as-rev__head{padding-left: 52px}
}
@container ui-as (max-width: 600px){.ui-as-rev__head{flex-wrap: wrap;row-gap: 10px;height: auto;padding: 14px 8px 12px 52px}
.ui-as-rev__actions{flex-wrap: wrap;gap: 6px 4px;width: calc(100% + 44px);margin-left: -44px}
.ui-as-rev__actions > :last-child{margin-left: auto}
.ui-as-rev__actions button{white-space: nowrap}
.ui-as-rev__content{gap: 8px;padding: 0 8px 8px}
}

`;
