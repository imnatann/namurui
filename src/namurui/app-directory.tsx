"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/*
 * App Directory – a browsable integrations catalogue in a single self-contained file.
 *
 * A rail of categories on the left narrows the grid beside it; each row in the rail carries the
 * size of that category in the full catalogue. The search field filters by app name, vendor and
 * description, and the Filter menu switches between all / connected / not connected. The grid
 * sits inside a measured shell, so switching category, filter or query slides the container to
 * the new height instead of jumping.
 *
 * A card's Connect button goes busy – spinner, muted label – while its handler settles, then
 * turns green with "Connected"; hovering that state swaps the label for "Disconnect". The button
 * measures its own label, so the 76px "Connect" pill and the 112px "Connected" pill widen and
 * narrow smoothly around the copy. Everything that animates stops under reduced motion.
 *
 * The styles are injected below, so no extra files are needed.
 */

/** One app in the catalogue. The tile art is an inline brand mark. */
export type AppDirectoryApp = {
  /** Stable id, used as the list key */
  id: string;
  /** Product name beside the mark */
  name: string;
  /** Vendor line, rendered as "By {vendor}" */
  vendor: string;
  /** Two lines at most; longer copy is clamped by the sheet */
  description: string;
  /** Category ids this app belongs to, e.g. ["essentials", "communication"] */
  categories: string[];
  /** Brand mark, 24×24 viewBox (or the mark's own box for Figma's 38×57) */
  icon: ReactNode;
  /** Show the trust badge after the name */
  verified?: boolean;
  /** Solid brand tile: fills the tile and lightens its hairline */
  tileColor?: string;
  /** Whether the team has already connected this app */
  connected?: boolean;
};

/** A row in the category rail. */
export type AppDirectoryCategory = {
  /** Stable id; "all" is the one id that matches every app without being listed on them */
  id: string;
  /** Rail label, also the grid heading */
  label: string;
  /** Icon in the rail */
  icon?: ReactNode;
  /** Catalogue size for this category; derived from `apps` when omitted */
  count?: number;
};

/** Brand marks stacked on the "Discover more" tile. */
export type AppDirectoryDiscoverTile = {
  /** Mark on the tile */
  icon: ReactNode;
  /** Brand background behind the mark */
  color: string;
};

/** The dashed tile that closes the grid and points at the rest of the catalogue. */
export type AppDirectoryDiscover = {
  /** Tile heading, default "Discover more" */
  label?: string;
  /** Apps still to discover; defaults to the catalogue total minus the rendered apps */
  count?: number;
  /** Stacked marks, default the three reference marks */
  tiles?: AppDirectoryDiscoverTile[];
  /** "View all" handler */
  onViewAll?: () => void;
};

/** Connection filter selected from the Filter menu. */
export type AppDirectoryFilter = "all" | "connected" | "available";

export type AppDirectoryProps = {
  /** The catalogue; defaults to the reference apps */
  apps?: AppDirectoryApp[];
  /** Rail entries; defaults to the reference categories */
  categories?: AppDirectoryCategory[];
  /** Card heading and section label */
  title?: string;
  /** Sentence above the toolbar; the "Learn more" link follows it */
  subtitle?: ReactNode;
  /** Where "Learn more" points; pass null to drop the link */
  learnMoreHref?: string | null;
  /** The dashed discover tile; pass null to drop it */
  discover?: AppDirectoryDiscover | null;
  /** Fired when a Connect press settles; wire it to mark the app connected */
  onConnect?: (app: AppDirectoryApp) => void | Promise<void>;
  /** Fired when a Disconnect press settles; wire it to clear the app's connected flag */
  onDisconnect?: (app: AppDirectoryApp) => void | Promise<void>;
  /** Extra class on the root */
  className?: string;
};

type ConnectState = "off" | "busy" | "on";

const filters: Array<{ id: AppDirectoryFilter; label: string }> = [
  { id: "all", label: "All apps" },
  { id: "connected", label: "Connected" },
  { id: "available", label: "Not connected" },
];

/* -------------------------------------------------------------------------------------------- */
/* Reference data                                                                                */
/* -------------------------------------------------------------------------------------------- */

/** Categories in the reference order, with the catalogue sizes the live rail shows. */
export const defaultCategories: AppDirectoryCategory[] = [
  { id: "essentials", label: "Essentials", count: 8, icon: <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m8 1.8 1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6Z" /></svg> },
  { id: "all", label: "All apps", count: 22, icon: <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 2.5h4v4h-4zM9.5 2.5h4v4h-4zM2.5 9.5h4v4h-4zM9.5 9.5h4v4h-4z" /></svg> },
  { id: "analytics", label: "Analytics", count: 2, icon: <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 2.5h11v11h-11zM5.5 10.5v-2M8 10.5v-5M10.5 10.5V7" /></svg> },
  { id: "automation", label: "Automation", count: 2, icon: <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 1.5 3.5 9H8l-1 5.5L12.5 7H8Z" /></svg> },
  { id: "billing", label: "Billing", count: 2, icon: <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM10 5.8C9.6 5.2 8.9 5 8 5c-1.1 0-2 .6-2 1.5S6.9 7.8 8 8s2 .6 2 1.5S9.1 11 8 11c-.9 0-1.7-.3-2.1-1M8 3.8V5M8 11v1.2" /></svg> },
  { id: "communication", label: "Communication", count: 4, icon: <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 3.5h11v7.5H7l-3 2.5V11H2.5Z" /></svg> },
  { id: "crm", label: "CRM", count: 2, icon: <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.5 13.5c.6-2.3 2.3-3.5 4.5-3.5s3.9 1.2 4.5 3.5M10.5 2.7a2.5 2.5 0 0 1 0 4.6M12.5 10.3c1 .6 1.7 1.6 2 3.2" /></svg> },
  { id: "design", label: "Design", count: 1, icon: <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.5 2.5 13.5 5.5 6 13H3v-3ZM9 4l3 3" /></svg> },
  { id: "development", label: "Development", count: 2, icon: <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5" /></svg> },
  { id: "docs", label: "Docs", count: 2, icon: <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 1.5h5.5l3 3v10H4zM9.5 1.5v3h3M6 8h4.5M6 10.5h4.5" /></svg> },
  { id: "product", label: "Product", count: 3, icon: <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 2.5h3v11h-3zM6.5 2.5h3v7h-3zM10.5 2.5h3v4h-3z" /></svg> },
  { id: "scheduling", label: "Scheduling", count: 3, icon: <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 3.5h11v10h-11zM2.5 6.5h11M5.5 1.5v3M10.5 1.5v3" /></svg> },
  { id: "storage", label: "Storage", count: 3, icon: <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 4c0-1.1 2.5-2 5.5-2s5.5.9 5.5 2-2.5 2-5.5 2-5.5-.9-5.5-2ZM2.5 4v8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V4M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2" /></svg> },
];

/** The eight curated apps the Essentials view renders, Slack already connected. */
export const directoryDefaultApps: AppDirectoryApp[] = [
  {
    id: "slack",
    name: "Slack",
    vendor: "Slack",
    description: "Get alerts in your channels and act on them without leaving the conversation.",
    categories: ["essentials", "communication"],
    verified: true,
    connected: true,
    icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#E01E5A" d="M5.04 15.17a2.53 2.53 0 0 1-2.52 2.52A2.53 2.53 0 0 1 0 15.17a2.53 2.53 0 0 1 2.52-2.53h2.52zm1.27 0a2.53 2.53 0 0 1 2.53-2.53 2.53 2.53 0 0 1 2.52 2.53v6.31A2.53 2.53 0 0 1 8.84 24a2.53 2.53 0 0 1-2.53-2.52z" /><path fill="#36C5F0" d="M8.84 5.04a2.53 2.53 0 0 1-2.53-2.52A2.53 2.53 0 0 1 8.84 0a2.53 2.53 0 0 1 2.52 2.52v2.52zm0 1.27a2.53 2.53 0 0 1 2.52 2.53 2.53 2.53 0 0 1-2.52 2.52H2.52A2.53 2.53 0 0 1 0 8.84a2.53 2.53 0 0 1 2.52-2.53z" /><path fill="#2EB67D" d="M18.96 8.84a2.53 2.53 0 0 1 2.52-2.53A2.53 2.53 0 0 1 24 8.84a2.53 2.53 0 0 1-2.52 2.52h-2.52zm-1.27 0a2.53 2.53 0 0 1-2.53 2.52 2.53 2.53 0 0 1-2.52-2.52V2.52A2.53 2.53 0 0 1 15.16 0a2.53 2.53 0 0 1 2.53 2.52z" /><path fill="#ECB22E" d="M15.16 18.96a2.53 2.53 0 0 1 2.53 2.52A2.53 2.53 0 0 1 15.16 24a2.53 2.53 0 0 1-2.52-2.52v-2.52zm0-1.27a2.53 2.53 0 0 1-2.52-2.53 2.53 2.53 0 0 1 2.52-2.52h6.32A2.53 2.53 0 0 1 24 15.16a2.53 2.53 0 0 1-2.52 2.53z" /></svg>,
  },
  {
    id: "notion",
    name: "Notion",
    vendor: "Notion",
    description: "Turn records into pages and keep project docs in sync both ways.",
    categories: ["essentials", "docs"],
    verified: true,
    icon: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" /></svg>,
  },
  {
    id: "linear",
    name: "Linear",
    vendor: "Linear",
    description: "Create issues from customer feedback and track them to release.",
    categories: ["essentials", "product"],
    verified: true,
    tileColor: "rgb(94, 106, 210)",
    icon: <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true"><path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" /></svg>,
  },
  {
    id: "figma",
    name: "Figma",
    vendor: "Figma",
    description: "Preview designs inline and link frames to the work they belong to.",
    categories: ["essentials", "design"],
    verified: true,
    icon: <svg viewBox="0 0 38 57" aria-hidden="true"><path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0Z" fill="#1ABCFE" /><path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0Z" fill="#0ACF83" /><path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19Z" fill="#FF7262" /><path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5Z" fill="#F24E1E" /><path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5Z" fill="#A259FF" /></svg>,
  },
  {
    id: "github",
    name: "GitHub",
    vendor: "GitHub",
    description: "Link pull requests and see deploy status next to every task.",
    categories: ["essentials", "development"],
    verified: true,
    tileColor: "rgb(23, 23, 23)",
    icon: <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>,
  },
  {
    id: "stripe",
    name: "Stripe",
    vendor: "Stripe",
    description: "Sync customers, invoices and subscriptions in real time.",
    categories: ["essentials", "billing"],
    verified: true,
    tileColor: "rgb(99, 91, 255)",
    icon: <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" /></svg>,
  },
  {
    id: "zapier",
    name: "Zapier",
    vendor: "Zapier",
    description: "Connect 6,000 apps with no-code workflows and triggers.",
    categories: ["essentials", "automation"],
    verified: true,
    tileColor: "rgb(255, 79, 0)",
    icon: <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true"><path d="M4.157 0A4.151 4.151 0 0 0 0 4.161v15.678A4.151 4.151 0 0 0 4.157 24h15.682A4.152 4.152 0 0 0 24 19.839V4.161A4.152 4.152 0 0 0 19.839 0H4.157Zm10.61 8.761h.03a.577.577 0 0 1 .23.038.585.585 0 0 1 .201.124.63.63 0 0 1 .162.431.612.612 0 0 1-.162.435.58.58 0 0 1-.201.128.58.58 0 0 1-.23.042.529.529 0 0 1-.235-.042.585.585 0 0 1-.332-.328.559.559 0 0 1-.038-.235.613.613 0 0 1 .17-.431.59.59 0 0 1 .405-.162Zm2.853 1.572c.03.004.061.004.095.004.325-.011.646.064.937.219.238.144.431.355.552.609.128.279.189.582.185.888v.193a2 2 0 0 1 0 .219h-2.498c.003.227.075.45.204.642a.78.78 0 0 0 .646.265.714.714 0 0 0 .484-.136.642.642 0 0 0 .23-.318l.915.257a1.398 1.398 0 0 1-.28.537c-.14.159-.321.284-.521.355a2.234 2.234 0 0 1-.836.136 1.923 1.923 0 0 1-1.001-.245 1.618 1.618 0 0 1-.665-.703 2.221 2.221 0 0 1-.227-1.036 1.95 1.95 0 0 1 .48-1.398 1.9 1.9 0 0 1 1.3-.488Zm-9.607.023c.162.004.325.026.48.079.207.065.4.174.563.314.26.302.393.692.366 1.088v2.276H8.53l-.109-.711h-.065c-.064.163-.155.31-.272.439a1.122 1.122 0 0 1-.374.264 1.023 1.023 0 0 1-.453.083 1.334 1.334 0 0 1-.866-.264.965.965 0 0 1-.329-.801.993.993 0 0 1 .076-.431 1.02 1.02 0 0 1 .242-.363 1.478 1.478 0 0 1 1.043-.303h.952v-.181a.696.696 0 0 0-.136-.454.553.553 0 0 0-.438-.154.695.695 0 0 0-.378.086.48.48 0 0 0-.193.254l-.99-.144a1.26 1.26 0 0 1 .257-.563c.14-.174.321-.302.533-.378.261-.091.54-.136.82-.129.053-.003.106-.007.163-.007Zm4.384.007c.174 0 .347.038.506.114.182.083.34.211.458.374.257.423.377.911.351 1.406a2.53 2.53 0 0 1-.355 1.448 1.148 1.148 0 0 1-1.009.517c-.204 0-.401-.045-.582-.136a1.052 1.052 0 0 1-.48-.457 1.298 1.298 0 0 1-.114-.234h-.045l.004 1.784h-1.059v-4.713h.904l.117.805h.057c.068-.208.177-.401.328-.56a1.129 1.129 0 0 1 .843-.344h.076v-.004Zm7.559.084h.903l.113.805h.053a1.37 1.37 0 0 1 .235-.484.813.813 0 0 1 .313-.242.82.82 0 0 1 .39-.076h.234v1.051h-.401a.662.662 0 0 0-.313.008.623.623 0 0 0-.272.155.663.663 0 0 0-.174.26.683.683 0 0 0-.027.314v1.875h-1.054v-3.666Zm-17.515.003h3.262v.896L3.73 13.104l.034.113h1.973l.042.9H2.4v-.9l1.931-1.754-.045-.117H2.441v-.896Zm11.815 0h1.055v3.659h-1.055V10.45Zm3.443.684.019.016a.69.69 0 0 0-.351.045.756.756 0 0 0-.287.204c-.11.155-.174.336-.189.522h1.545c-.034-.526-.257-.787-.74-.787h.003Zm-5.718.163c-.026 0-.057 0-.083.004a.78.78 0 0 0-.31.053.746.746 0 0 0-.257.189 1.016 1.016 0 0 0-.204.695v.064c-.015.257.057.507.204.711a.634.634 0 0 0 .253.196.638.638 0 0 0 .314.061.644.644 0 0 0 .578-.265c.14-.223.204-.48.189-.74a1.216 1.216 0 0 0-.181-.711.677.677 0 0 0-.503-.257Zm-4.509 1.266a.464.464 0 0 0-.268.102.373.373 0 0 0-.114.276c0 .053.008.106.027.155a.375.375 0 0 0 .087.132.576.576 0 0 0 .397.11v.004a.863.863 0 0 0 .563-.182.573.573 0 0 0 .211-.457v-.14h-.903Z" /></svg>,
  },
  {
    id: "hubspot",
    name: "HubSpot",
    vendor: "HubSpot",
    description: "Keep contacts, companies and deals matched across both tools.",
    categories: ["essentials", "crm"],
    verified: true,
    icon: <svg viewBox="0 0 24 24" fill="#FF7A59" aria-hidden="true"><path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z" /></svg>,
  },
];

/** The three marks stacked on the discover tile. */
export const defaultDiscoverTiles: AppDirectoryDiscoverTile[] = [
  { color: "rgb(11, 92, 255)", icon: <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true"><path d="M5.033 14.649H.743a.74.74 0 0 1-.686-.458.74.74 0 0 1 .16-.808L3.19 10.41H1.06A1.06 1.06 0 0 1 0 9.35h3.957c.301 0 .57.18.686.458a.74.74 0 0 1-.161.808L1.51 13.59h2.464c.585 0 1.06.475 1.06 1.06zM24 11.338c0-1.14-.927-2.066-2.066-2.066-.61 0-1.158.265-1.537.686a2.061 2.061 0 0 0-1.536-.686c-1.14 0-2.066.926-2.066 2.066v3.311a1.06 1.06 0 0 0 1.06-1.06v-2.251a1.004 1.004 0 0 1 2.013 0v2.251c0 .586.474 1.06 1.06 1.06v-3.311a1.004 1.004 0 0 1 2.012 0v2.251c0 .586.475 1.06 1.06 1.06zM16.265 12a2.728 2.728 0 1 1-5.457 0 2.728 2.728 0 0 1 5.457 0zm-1.06 0a1.669 1.669 0 1 0-3.338 0 1.669 1.669 0 0 0 3.338 0zm-4.82 0a2.728 2.728 0 1 1-5.458 0 2.728 2.728 0 0 1 5.457 0zm-1.06 0a1.669 1.669 0 1 0-3.338 0 1.669 1.669 0 0 0 3.338 0z" /></svg> },
  { color: "rgb(88, 101, 242)", icon: <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" /></svg> },
  { color: "rgb(0, 107, 255)", icon: <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true"><path d="M19.655 14.262c.281 0 .557.023.828.064 0 .005-.005.01-.005.014-.105.267-.234.534-.381.786l-1.219 2.106c-1.112 1.936-3.177 3.127-5.411 3.127h-2.432c-2.23 0-4.294-1.191-5.412-3.127l-1.218-2.106a6.251 6.251 0 0 1 0-6.252l1.218-2.106C6.736 4.832 8.8 3.641 11.035 3.641h2.432c2.23 0 4.294 1.191 5.411 3.127l1.219 2.106c.147.252.271.519.381.786 0 .004.005.009.005.014-.267.041-.543.064-.828.064-1.816 0-2.501-.607-3.291-1.306-.764-.676-1.711-1.517-3.44-1.517h-1.029c-1.251 0-2.387.455-3.2 1.278-.796.805-1.233 1.904-1.233 3.099v1.411c0 1.196.437 2.295 1.233 3.099.813.823 1.949 1.278 3.2 1.278h1.034c1.729 0 2.676-.841 3.439-1.517.791-.703 1.471-1.306 3.287-1.301Zm.005-3.237c.399 0 .794-.036 1.179-.11-.002-.004-.002-.01-.002-.014-.073-.414-.193-.823-.349-1.218.731-.12 1.407-.396 1.986-.819 0-.004-.005-.013-.005-.018-.331-1.085-.832-2.101-1.489-3.03-.649-.915-1.435-1.719-2.331-2.395-1.867-1.398-4.088-2.138-6.428-2.138-1.448 0-2.855.28-4.175.841-1.273.543-2.423 1.315-3.407 2.299S2.878 6.552 2.341 7.83c-.557 1.324-.842 2.726-.842 4.175 0 1.448.281 2.855.842 4.174.542 1.274 1.314 2.423 2.298 3.407s2.129 1.761 3.407 2.299c1.324.556 2.727.841 4.175.841 2.34 0 4.561-.74 6.428-2.137a10.815 10.815 0 0 0 2.331-2.396c.652-.929 1.158-1.949 1.489-3.03 0-.004.005-.014.005-.018-.579-.423-1.255-.699-1.986-.819.161-.395.276-.804.349-1.218.005-.009.005-.014.005-.023.869.166 1.692.506 2.404 1.035.685.505.552 1.075.446 1.416C22.184 20.437 17.619 24 12.221 24c-6.625 0-12-5.375-12-12s5.37-12 12-12c5.398 0 9.963 3.563 11.471 8.464.106.341.239.915-.446 1.421-.717.529-1.535.873-2.404 1.034.128.716.128 1.45 0 2.166-.387-.074-.782-.11-1.182-.11-4.184 0-3.968 2.823-6.736 2.823h-1.029c-1.899 0-3.15-1.357-3.15-3.095v-1.411c0-1.738 1.251-3.094 3.15-3.094h1.034c2.768 0 2.552 2.823 6.731 2.827Z" /></svg> },
];

/* -------------------------------------------------------------------------------------------- */
/* Component                                                                                     */
/* -------------------------------------------------------------------------------------------- */

export function AppDirectory({
  apps = directoryDefaultApps,
  categories = defaultCategories,
  title = "Integrations",
  subtitle = "Connect the tools your team already works in.",
  learnMoreHref = "#",
  discover,
  onConnect,
  onDisconnect,
  className,
}: AppDirectoryProps) {
  const searchId = useId();
  const filterRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AppDirectoryFilter>("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "all");
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [mainHeight, setMainHeight] = useState<number | null>(null);

  /* The rail can lose its selection when the catalogue is swapped out. */
  const activeId = categories.some((category) => category.id === activeCategory)
    ? activeCategory
    : categories[0]?.id ?? "all";

  const normalizedQuery = query.trim().toLowerCase();

  const visible = apps.filter((app) => {
    if (activeId !== "all" && !app.categories.includes(activeId)) return false;
    if (filter === "connected" && !app.connected) return false;
    if (filter === "available" && app.connected) return false;
    if (!normalizedQuery) return true;
    return `${app.name} ${app.vendor} ${app.description}`.toLowerCase().includes(normalizedQuery);
  });

  const connectedCount = apps.filter((app) => app.connected).length;
  const activeLabel = categories.find((category) => category.id === activeId)?.label ?? "All apps";

  /* The catalogue is bigger than what this view renders; the dashed tile says how much bigger. */
  const catalogueCount = categories.find((category) => category.id === "all")?.count ?? apps.length;
  const discoverCount = discover?.count ?? Math.max(0, catalogueCount - apps.length);
  const showDiscover =
    discover !== null &&
    discoverCount > 0 &&
    !normalizedQuery &&
    filter === "all" &&
    visible.length > 0;

  /* New category, filter or query: let the shell glide to the height the new content needs. */
  useLayoutEffect(() => {
    const node = mainRef.current;
    if (!node) return;
    const measure = () => setMainHeight(Math.ceil(node.getBoundingClientRect().height));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* Close the filter menu on an outside press or Escape. */
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const toggleConnection = async (app: AppDirectoryApp) => {
    if (busyIds.includes(app.id)) return;
    setBusyIds((ids) => [...ids, app.id]);
    try {
      if (app.connected) await onDisconnect?.(app);
      else await onConnect?.(app);
    } catch {
      /* The handler rejected: leave the app in the state it was in and let the button settle. */
    } finally {
      setBusyIds((ids) => ids.filter((id) => id !== app.id));
    }
  };

  const clearView = () => {
    setQuery("");
    setFilter("all");
    setActiveCategory("all");
  };

  const discoverTiles = discover?.tiles ?? defaultDiscoverTiles;

  return (
    <section className={["ui-ad", className].filter(Boolean).join(" ")} aria-label={title}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-app-directory" precedence="default">
        {css}
      </style>

      <header className="ui-ad__bar">
        <span className="ui-ad__bar-title">Apps</span>
        <span className="ui-ad__bar-meta">{connectedCount} connected</span>
      </header>

      <div className="ui-ad__card">
        <div className="ui-ad__intro">
          <h2 className="ui-ad__title">{title}</h2>
          <p className="ui-ad__subtitle">
            {subtitle}
            {learnMoreHref ? (
              <>
                {" "}
                <a href={learnMoreHref} className="ui-ad__link">
                  Learn more <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 11 11 5M6 5h5v5" /></svg>
                </a>
              </>
            ) : null}
          </p>
        </div>

        <div className="ui-ad__tools">
          <label className="ui-ad__search" htmlFor={searchId}>
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 12.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11ZM11 11l3.5 3.5" /></svg>
            <input
              id={searchId}
              type="search"
              placeholder="Search apps"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="ui-ad__filter" ref={filterRef}>
            <button
              type="button"
              className="ui-ad__btn"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              data-active={filter === "all" ? undefined : "true"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 4.5h11M4.5 8h7M6.5 11.5h3" /></svg>Filter
            </button>
            {menuOpen ? (
              <div className="ui-ad__menu" role="menu" aria-label="Filter apps">
                {filters.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={filter === option.id}
                    className="ui-ad__menu-item"
                    onClick={() => {
                      setFilter(option.id);
                      setMenuOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="ui-ad__layout">
          <nav className="ui-ad__nav" aria-label="Categories">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className="ui-ad__nav-item"
                aria-current={category.id === activeId ? "true" : undefined}
                onClick={() => setActiveCategory(category.id)}
              >
                <span className="ui-ad__nav-icon">{category.icon}</span>
                <span className="ui-ad__nav-label">{category.label}</span>
                <span className="ui-ad__nav-count">
                  {category.count ??
                    (category.id === "all"
                      ? apps.length
                      : apps.filter((app) => app.categories.includes(category.id)).length)}
                </span>
              </button>
            ))}
          </nav>

          <div
            className="ui-ad__morph"
            style={mainHeight === null ? undefined : { height: mainHeight }}
            data-smooth=""
          >
            <div className="ui-ad__main" ref={mainRef}>
              <h3 className="ui-ad__heading" aria-live="polite">
                {activeLabel}
                <span>{visible.length}</span>
              </h3>

              {visible.length === 0 ? (
                <div className="ui-ad__empty">
                  <p>
                    {normalizedQuery
                      ? `No apps match “${query.trim()}”.`
                      : filter === "connected"
                        ? "No connected apps here yet."
                        : "No apps in this category yet."}
                  </p>
                  <button type="button" className="ui-ad__btn" onClick={clearView}>
                    Show all apps
                  </button>
                </div>
              ) : (
                <ul className="ui-ad__grid">
                  {visible.map((app, index) => {
                    const state: ConnectState =
                      busyIds.includes(app.id) ? "busy" : app.connected ? "on" : "off";
                    return (
                      <li
                        key={app.id}
                        className="ui-ad__app"
                        data-connected={app.connected ? "true" : undefined}
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <div className="ui-ad__app-head">
                          <span
                            className="ui-ad__tile"
                            data-filled={app.tileColor ? "true" : undefined}
                            style={app.tileColor ? { background: app.tileColor } : undefined}
                          >
                            {app.icon}
                          </span>
                          <span className="ui-ad__app-name">
                            <span className="ui-ad__name">
                              {app.name}
                              {app.verified ? <svg className="ui-ad__verified" viewBox="0 0 16 16" width="15" height="15" role="img" aria-label="Verified"><path d="M8.00 0.80 L9.55 2.20 L11.60 1.76 L12.24 3.76 L14.24 4.40 L13.80 6.45 L15.20 8.00 L13.80 9.55 L14.24 11.60 L12.24 12.24 L11.60 14.24 L9.55 13.80 L8.00 15.20 L6.45 13.80 L4.40 14.24 L3.76 12.24 L1.76 11.60 L2.20 9.55 L0.80 8.00 L2.20 6.45 L1.76 4.40 L3.76 3.76 L4.40 1.76 L6.45 2.20Z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /><path d="m5.3 8.1 1.8 1.8 3.6-3.7" fill="none" stroke="var(--ui-ad-on-accent, #fff)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
                            </span>
                            <span className="ui-ad__vendor">By {app.vendor}</span>
                          </span>
                        </div>
                        <p className="ui-ad__desc">{app.description}</p>
                        <ConnectButton
                          name={app.name}
                          state={state}
                          busyLabel={app.connected ? "Disconnecting" : "Connecting"}
                          onToggle={() => void toggleConnection(app)}
                        />
                      </li>
                    );
                  })}

                  {showDiscover ? (
                    <li className="ui-ad__app ui-ad__discover">
                      <div className="ui-ad__discover-head">
                        <span>
                          <span className="ui-ad__name">{discover?.label ?? "Discover more"}</span>
                          <span className="ui-ad__vendor">+{discoverCount} apps</span>
                        </span>
                        <span className="ui-ad__stack" aria-hidden="true">
                          {discoverTiles.map((tile, index) => (
                            <span
                              key={index}
                              className="ui-ad__tile"
                              data-filled="true"
                              style={{ background: tile.color }}
                            >
                              {tile.icon}
                            </span>
                          ))}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="ui-ad__btn"
                        onClick={discover?.onViewAll ?? clearView}
                      >
                        View all
                      </button>
                    </li>
                  ) : null}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Connect button                                                                                */
/* -------------------------------------------------------------------------------------------- */

type ConnectButtonProps = {
  name: string;
  state: ConnectState;
  busyLabel: string;
  onToggle: () => void;
};

/*
 * Measures the label, not the button: the pill keeps a fixed width per label so swapping
 * "Connect" for "Connected" grows the control instead of reflowing the grid.
 */
function ConnectButton({ name, state, busyLabel, onToggle }: ConnectButtonProps) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const node = labelRef.current;
    if (!node) return;
    /* The pill hugs its copy: padding 12 + 12 either side of the measured label. */
    const measure = () => setWidth(Math.ceil(node.getBoundingClientRect().width) + 24);
    measure();
    /* A first paint in the fallback face measures short; settle again once Inter lands. */
    let alive = true;
    void document.fonts?.ready.then(() => {
      if (alive) measure();
    });
    return () => {
      alive = false;
    };
  }, [state]);

  const ariaLabel =
    state === "busy" ? `${busyLabel} ${name}` : state === "on" ? `Disconnect ${name}` : `Connect ${name}`;

  return (
    <button
      type="button"
      className="ui-ad__connect"
      data-state={state}
      data-smooth=""
      aria-label={ariaLabel}
      style={width === null ? undefined : { width }}
      onClick={onToggle}
    >
      <span className="ui-ad__connect-label" ref={labelRef}>
        {state === "busy" ? (
          <>
            <span className="ui-ad__spinner" />
            {busyLabel}
          </>
        ) : state === "on" ? (
          <>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6.5 9.5l3-3M7.3 4.7l.9-.9a2.5 2.5 0 0 1 3.5 3.5l-.9.9M8.7 11.3l-.9.9a2.5 2.5 0 0 1-3.5-3.5l.9-.9" /></svg>
            <span className="ui-ad__on-label">Connected</span>
            <span className="ui-ad__off-label">Disconnect</span>
          </>
        ) : (
          "Connect"
        )}
      </span>
    </button>
  );
}

const css = /* css */ `
.ui-ad{--ui-ad-tray: #eee6de;--ui-ad-card: #fffdfb;--ui-ad-line: #eae2d9;--ui-ad-ink: #1c1713;--ui-ad-text: #3d3226;--ui-ad-muted: #857567;--ui-ad-accent: #ff6b35;--ui-ad-ok: #1a7a4a;--ui-ad-accent-text: #ff6b35;--ui-ad-accent-ring: #ffb28f;--ui-ad-card-line: #ded4ca;--ui-ad-shadow: rgba(11, 9, 8, 0.06);--ui-ad-field: #fffdfb;--ui-ad-field-hover: #f7f1eb;--ui-ad-ring: #ded4ca;--ui-ad-app: #fffdfb;--ui-ad-app-hover-line: #d8cdc4;--ui-ad-app-hover-shadow: rgba(11, 9, 8, 0.12);--ui-ad-tile: #fffdfb;--ui-ad-tile-line: #e3dad1;--ui-ad-tile-filled-line: rgba(11, 9, 8, 0.06);--ui-ad-menu-shadow: rgba(11, 9, 8, 0.18);--ui-ad-menu-hover: #f4ece5;--ui-ad-nav-hover: #f5efe8;--ui-ad-nav-current: #eee6de;--ui-ad-count: #a5988d;--ui-ad-subtle: #96887a;--ui-ad-underline: #c6bab0;--ui-ad-spinner-track: #c6bab0;--ui-ad-dashed: #d2c7bd;--ui-ad-empty-line: #d8cdc4;--ui-ad-discover: #fcf9f7;--ui-ad-ok-bg: #f6f0e9;--ui-ad-ok-ring: #cfeedd;--ui-ad-danger: #b3261e;--ui-ad-danger-bg: #faf6f3;--ui-ad-danger-ring: #f6d0d1;--ui-ad-ease: cubic-bezier(0.22, 1, 0.36, 1);box-sizing: border-box;width: 100%;container-type: inline-size;background: var(--ui-ad-tray);padding: 6px;border-radius: 22px;font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;color: var(--ui-ad-ink);-webkit-font-smoothing: antialiased}
.ui-ad *, .ui-ad *::before, .ui-ad *::after{box-sizing: border-box}
.ui-ad button{margin: 0;font: inherit;color: inherit;cursor: pointer}
.ui-ad button:focus-visible, .ui-ad a:focus-visible{outline: 2px solid var(--ui-ad-accent);outline-offset: 2px}
.ui-ad__bar{display: flex;align-items: center;justify-content: space-between;padding: 11px 20px 10px;font-size: 14px;line-height: 20px}
.ui-ad__bar-title{font-weight: 500}
.ui-ad__bar-meta{font-size: 13px;color: var(--ui-ad-muted);font-variant-numeric: tabular-nums}
.ui-ad__card{padding: 40px 40px 44px;background: var(--ui-ad-card);border: 1px solid var(--ui-ad-card-line);border-radius: 16px;box-shadow: 0 1px 2px var(--ui-ad-shadow)}
.ui-ad__title{margin: 0;font-size: 26px;font-weight: 600;line-height: 32px;letter-spacing: -0.02em}
.ui-ad__subtitle{margin: 6px 0 0;font-size: 15px;line-height: 22px;color: var(--ui-ad-muted)}
.ui-ad__link{display: inline-flex;align-items: center;gap: 2px;color: var(--ui-ad-text);text-decoration: underline;text-decoration-color: var(--ui-ad-underline);text-underline-offset: 3px}
.ui-ad__link:hover{color: var(--ui-ad-ink);text-decoration-color: currentColor}
.ui-ad__tools{display: flex;gap: 10px;margin-top: 28px}
.ui-ad__search{display: flex;flex: 1;min-width: 0;align-items: center;gap: 8px;height: 38px;padding: 0 12px;border-radius: 11px;background: var(--ui-ad-field);box-shadow: 0 0 0 1px var(--ui-ad-ring), 0 1px 2px rgba(11, 9, 8, 0.03);color: var(--ui-ad-muted);transition: box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-ad__search:focus-within{box-shadow: 0 0 0 1px var(--ui-ad-accent), 0 0 0 4px rgba(255, 107, 53, 0.12)}
.ui-ad__search input{flex: 1;min-width: 0;border: 0;outline: none;background: transparent;font: inherit;font-size: 14px;color: var(--ui-ad-ink)}
.ui-ad__search input::placeholder{color: var(--ui-ad-subtle)}
.ui-ad__search input::-webkit-search-cancel-button{display: none}
.ui-ad__btn{display: inline-flex;align-items: center;gap: 7px;height: 38px;padding: 0 14px;border: 0;border-radius: 11px;background: var(--ui-ad-field);box-shadow: 0 0 0 1px var(--ui-ad-ring), 0 1px 2px rgba(11, 9, 8, 0.04);font-size: 14px !important;font-weight: 500;white-space: nowrap;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-ad__btn:hover{background: var(--ui-ad-field-hover)}
.ui-ad__btn[data-active]{color: var(--ui-ad-accent-text) !important;box-shadow: 0 0 0 1px var(--ui-ad-accent-ring)}
.ui-ad__filter{position: relative}
.ui-ad__menu{position: absolute;top: calc(100% + 6px);right: 0;z-index: 5;display: grid;gap: 2px;min-width: 180px;padding: 4px;border-radius: 12px;background: var(--ui-ad-field);box-shadow: 0 0 0 1px var(--ui-ad-ring), 0 10px 28px -8px var(--ui-ad-menu-shadow);animation: ui-ad-drop var(--nm-dur-2, 160ms) var(--ui-ad-ease)}
.ui-ad__menu-item{display: flex;align-items: center;justify-content: space-between;height: 32px;padding: 0 10px;border: 0;border-radius: 8px;background: transparent;font-size: 13px !important;text-align: left}
.ui-ad__menu-item:hover{background: var(--ui-ad-menu-hover)}
.ui-ad__menu-item[aria-checked="true"]{color: var(--ui-ad-accent-text) !important;font-weight: 500}
.ui-ad__layout{display: grid;grid-template-columns: 200px minmax(0, 1fr);gap: 32px;margin-top: 28px}
.ui-ad__nav{display: flex;flex-direction: column;gap: 2px}
.ui-ad__nav-item{display: flex;align-items: center;gap: 10px;height: 34px;padding: 0 10px;border: 0;border-radius: 10px;background: transparent;font-size: 14px !important;text-align: left;color: var(--ui-ad-text) !important;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-ad__nav-item:hover{background: var(--ui-ad-nav-hover);color: var(--ui-ad-ink) !important}
.ui-ad__nav-item[aria-current]{background: var(--ui-ad-nav-current);color: var(--ui-ad-ink) !important;font-weight: 500}
.ui-ad__nav-icon{display: grid;color: var(--ui-ad-muted)}
.ui-ad__nav-item[aria-current] .ui-ad__nav-icon{color: var(--ui-ad-ink)}
.ui-ad__nav-label{flex: 1;overflow: hidden;white-space: nowrap;text-overflow: ellipsis}
.ui-ad__nav-count{font-size: 12px;font-variant-numeric: tabular-nums;color: var(--ui-ad-count)}
.ui-ad__heading{display: flex;align-items: baseline;gap: 8px;margin: 4px 0 14px;font-size: 17px;font-weight: 600;line-height: 24px}
.ui-ad__heading span{font-size: 13px;font-weight: 400;color: var(--ui-ad-muted)}
.ui-ad__grid{display: grid;grid-template-columns: repeat(3, minmax(0, 1fr));gap: 14px;margin: 0;padding: 0;list-style: none}
.ui-ad__app{display: flex;flex-direction: column;padding: 16px;border: 1px solid var(--ui-ad-line);border-radius: 16px;background: var(--ui-ad-app);animation: ui-ad-in var(--nm-dur-4, 380ms) var(--ui-ad-ease) both;transition: border-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-ad__app:hover{border-color: var(--ui-ad-app-hover-line);box-shadow: 0 6px 18px -10px var(--ui-ad-app-hover-shadow)}
.ui-ad__app-head{display: flex;align-items: center;gap: 12px}
.ui-ad__tile{display: grid;place-items: center;flex: none;width: 40px;height: 40px;border-radius: 11px;background: var(--ui-ad-tile);box-shadow: inset 0 0 0 1px var(--ui-ad-tile-line)}
.ui-ad__tile[data-filled]{box-shadow: inset 0 0 0 1px var(--ui-ad-tile-filled-line)}
.ui-ad__tile svg{width: 21px;height: 21px}
.ui-ad__app-name{display: grid;min-width: 0}
.ui-ad__name{display: inline-flex;align-items: center;gap: 5px;font-size: 15px;font-weight: 500;line-height: 20px}
.ui-ad__verified{flex: none;color: var(--ui-ad-accent)}
.ui-ad__vendor{font-size: 13px;line-height: 18px;color: var(--ui-ad-muted)}
.ui-ad__desc{display: -webkit-box;flex: 1;margin: 10px 0 14px;overflow: hidden;-webkit-box-orient: vertical;-webkit-line-clamp: 2;line-clamp: 2;font-size: 13px;line-height: 19px;min-height: 38px;color: var(--ui-ad-muted)}
.ui-ad__connect{display: inline-flex;align-items: center;overflow: hidden;white-space: nowrap;align-self: flex-start;height: 30px;padding: 0 12px;border: 0;border-radius: 9px;background: var(--ui-ad-field);box-shadow: 0 0 0 1px var(--ui-ad-ring), 0 1px 2px rgba(11, 9, 8, 0.04);font-size: 13px !important;font-weight: 500;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-ad__connect[data-smooth]{transition: width var(--nm-dur-4, 380ms) cubic-bezier(0.22, 1, 0.36, 1), background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-ad__connect-label{display: inline-flex;flex: none;align-items: center;gap: 7px}
.ui-ad__connect:hover{background: var(--ui-ad-field-hover)}
.ui-ad__connect[data-state="busy"]{color: var(--ui-ad-muted) !important;cursor: progress}
.ui-ad__connect[data-state="on"]{color: var(--ui-ad-ok) !important;background: var(--ui-ad-ok-bg);box-shadow: 0 0 0 1px var(--ui-ad-ok-ring)}
.ui-ad__off-label{display: none}
.ui-ad__connect[data-state="on"]:hover{color: var(--ui-ad-danger) !important;background: var(--ui-ad-danger-bg);box-shadow: 0 0 0 1px var(--ui-ad-danger-ring)}
.ui-ad__connect[data-state="on"]:hover .ui-ad__on-label{display: none}
.ui-ad__connect[data-state="on"]:hover .ui-ad__off-label{display: inline}
.ui-ad__spinner{width: 12px;height: 12px;border: 1.5px solid var(--ui-ad-spinner-track);border-top-color: var(--ui-ad-ink);border-radius: 50%;animation: ui-ad-spin var(--nm-dur-5, 620ms) linear infinite}
.ui-ad__discover{justify-content: space-between;border-style: dashed;border-color: var(--ui-ad-dashed);background: var(--ui-ad-discover)}
.ui-ad__discover-head{display: flex;justify-content: space-between;gap: 12px}
.ui-ad__discover-head > span:first-child{display: grid}
.ui-ad__discover .ui-ad__btn{align-self: flex-start;height: 30px;margin-top: 18px;padding: 0 12px;font-size: 13px !important;border-radius: 9px}
.ui-ad__stack{display: flex}
.ui-ad__stack .ui-ad__tile{width: 34px;height: 34px;border-radius: 10px;box-shadow: 0 0 0 2px var(--ui-ad-discover), inset 0 0 0 1px var(--ui-ad-tile-line)}
.ui-ad__stack .ui-ad__tile + .ui-ad__tile{margin-left: -10px}
.ui-ad__stack .ui-ad__tile svg{width: 17px;height: 17px}
.ui-ad__empty{display: grid;justify-items: center;gap: 12px;padding: 48px 0;border: 1px dashed var(--ui-ad-empty-line);border-radius: 16px;font-size: 14px;color: var(--ui-ad-muted)}
.ui-ad__empty p{margin: 0}
@container (max-width: 820px){.ui-ad__layout{grid-template-columns: minmax(0, 1fr);gap: 18px}
.ui-ad__nav{flex-direction: row;overflow-x: auto;scrollbar-width: none}
.ui-ad__nav-item{flex: none}
.ui-ad__nav-count{display: none}
.ui-ad__grid{grid-template-columns: repeat(2, minmax(0, 1fr))}
}
@container (max-width: 560px){.ui-ad__card{padding: 24px 18px 28px}
.ui-ad__grid{grid-template-columns: minmax(0, 1fr)}
}
@keyframes ui-ad-in{from{opacity: 0;transform: translateY(4px)}
}
@keyframes ui-ad-drop{from{opacity: 0;transform: translateY(-4px) scale(0.98)}
}
@keyframes ui-ad-spin{to{transform: rotate(360deg)}
}
@media (prefers-reduced-motion: reduce){.ui-ad__app, .ui-ad__menu{animation: none}
}
.ui-ad__morph{overflow: hidden;margin: -6px}
.ui-ad__main{padding: 6px}
.ui-ad__morph[data-smooth]{transition: height var(--nm-dur-4, 380ms) cubic-bezier(0.22, 1, 0.36, 1)}
@media (prefers-reduced-motion: reduce){.ui-ad__morph[data-smooth], .ui-ad__connect[data-smooth]{transition: none}
}
.ui-ad input:not([type="checkbox"]):not([type="radio"]):focus-visible, .ui-ad textarea:focus-visible, .ui-ad [contenteditable]:focus-visible{outline: none}
:where(.dark, [data-theme="dark"]) .ui-ad{--ui-ad-tray: #1c1713;--ui-ad-card: #27201a;--ui-ad-line: rgba(255, 253, 251, 0.08);--ui-ad-ink: #ebe3da;--ui-ad-text: #b4a89d;--ui-ad-muted: #857567;--ui-ad-ok: #4f9d6e;--ui-ad-accent-text: #ff8a5c;--ui-ad-accent-ring: rgba(255, 138, 92, 0.45);--ui-ad-card-line: rgba(255, 253, 251, 0.08);--ui-ad-shadow: rgba(11, 9, 8, 0.4);--ui-ad-field: #2b231b;--ui-ad-field-hover: #33291f;--ui-ad-ring: rgba(255, 253, 251, 0.08);--ui-ad-app: #27201a;--ui-ad-app-hover-line: rgba(255, 253, 251, 0.14);--ui-ad-app-hover-shadow: rgba(11, 9, 8, 0.5);--ui-ad-tile: #2b231b;--ui-ad-tile-line: rgba(255, 253, 251, 0.08);--ui-ad-tile-filled-line: rgba(255, 253, 251, 0.1);--ui-ad-menu-shadow: rgba(11, 9, 8, 0.5);--ui-ad-menu-hover: rgba(255, 253, 251, 0.06);--ui-ad-nav-hover: rgba(255, 253, 251, 0.06);--ui-ad-nav-current: #2b231b;--ui-ad-count: #625244;--ui-ad-subtle: #625244;--ui-ad-underline: rgba(255, 253, 251, 0.24);--ui-ad-spinner-track: rgba(255, 253, 251, 0.14);--ui-ad-dashed: rgba(255, 253, 251, 0.14);--ui-ad-empty-line: rgba(255, 253, 251, 0.14);--ui-ad-discover: #211b16;--ui-ad-ok-bg: rgba(79, 157, 110, 0.12);--ui-ad-ok-ring: rgba(79, 157, 110, 0.28);--ui-ad-danger: #e2544a;--ui-ad-danger-bg: rgba(226, 84, 74, 0.14);--ui-ad-danger-ring: rgba(226, 84, 74, 0.32)}

`;
