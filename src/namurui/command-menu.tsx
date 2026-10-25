"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/*
 * Command Menu – search and run anything from one field, in a single self-contained file.
 * Suggestions carry their tool logo and a Ctrl 1–5 hint; everyday commands carry a line icon
 * and their own shortcut chips. Typing filters every section fuzzily and highlights the letters
 * that matched, a gray pill glides from row to row behind the pointer, Tab jumps between sections
 * and Ctrl K reaches the field from anywhere. Running a row presses it and leaves a check with
 * its name in the footer tray; the row list animates its own height as the matches thin out.
 * The styles are injected below, so no extra files are needed.
 */

export type CommandItem = {
  /** Stable id – it also makes the row's DOM id, so it must be unique in the menu */
  id: string;
  /** The command itself, the only text the search always looks at */
  label: string;
  /** Second, quieter text after the name – the tool, the channel, the destination */
  hint?: string;
  /** A tool brand mark, shown in the small white tile in front of the name */
  logo?: ReactNode;
  /** A line icon, used instead of a logo */
  icon?: ReactNode;
  /** Shortcut chips on the right, e.g. ["Ctrl", "1"] or ["G", "S"] */
  keys?: string[];
  /** Extra words the fuzzy search should match but never show */
  keywords?: string[];
};

export type CommandGroup = {
  id: string;
  /** The small uppercase heading above the rows */
  label: string;
  commands: CommandItem[];
};

export type CommandMenuProps = {
  /** Sections in the order they are listed – defaults to the tool suggestions below */
  groups?: CommandGroup[];
  /** Text in the empty field */
  placeholder?: string;
  /** Controlled open state – the menu renders nothing while closed */
  open?: boolean;
  /** Starts open when uncontrolled – on by default so a menu renders standalone */
  defaultOpen?: boolean;
  /** Called when the menu opens or closes, including Esc on an empty field */
  onOpenChange?: (open: boolean) => void;
  /** Called with the row that was run and whatever was typed at the time */
  onRun?: (command: CommandItem, query: string) => void;
  /** Head of the check line in the tray after a run */
  ranLabel?: (command: CommandItem) => string;
  /** The modifier name on the shortcut chips – pass ⌘ on Apple platforms */
  modifierKey?: string;
  /** Bind Ctrl/⌘ K on the window to focus the field, or open the menu when it is closed */
  hotkey?: boolean;
  /** Focus the field as soon as the menu opens */
  autoFocus?: boolean;
  /** Extra class on the root */
  className?: string;
};

const MAX_LIST_HEIGHT = 360;
/** The sheet pads the list by 4px at the bottom, outside the rows */
const LIST_PAD_BOTTOM = 4;
const FALLBACK_ROW_HEIGHT = 36;
const FALLBACK_PILL_TOP = 30;
const PRESS_MS = 640;

/* ---------- Brand marks for the default suggestions ---------- */

type BrandMarks = {
  gmail: ReactNode;
  spark: ReactNode;
  clickup: ReactNode;
  hubspot: ReactNode;
  calendar: ReactNode;
  slack: ReactNode;
  notion: ReactNode;
};

/** Logos, drawn inline. Gradient ids are scoped so two menus never share a definition. */
function brandMarks(scope: string): BrandMarks {
  const gmailA = `${scope}-gmail-a`;
  const gmailB = `${scope}-gmail-b`;
  const sparkId = `${scope}-spark`;
  const clickupA = `${scope}-clickup-a`;
  const clickupB = `${scope}-clickup-b`;

  return {
    gmail: (
      <svg viewBox="0 0 56.4108 44.8722" fill="none" aria-hidden="true">
        <path d="M44.2255 5.76727H56.4051V41.0239C56.4051 43.148 54.683 44.8701 52.5589 44.8701H46.1486C45.8961 44.8701 45.646 44.8204 45.4127 44.7237C45.1794 44.6271 44.9674 44.4854 44.7888 44.3069C44.6102 44.1283 44.4686 43.9163 44.3719 43.683C44.2753 43.4497 44.2255 43.1996 44.2255 42.947V5.76727Z" fill={`url(#${gmailA})`} />
        <path d="M12.1796 5.76727H0V41.0239C0 43.148 1.72213 44.8701 3.84618 44.8701H10.2565C10.509 44.8701 10.7591 44.8204 10.9924 44.7237C11.2257 44.6271 11.4377 44.4854 11.6163 44.3069C11.7949 44.1283 11.9365 43.9163 12.0332 43.683C12.1298 43.4497 12.1796 43.1996 12.1796 42.947V5.76727Z" fill="#FC413D" />
        <path d="M10.0085 1.42778C7.43377 -0.736342 3.5924 -0.403647 1.42828 2.17105C-0.735843 4.74543 -0.403148 8.58681 2.17155 10.7512L26.5557 31.2479C27.0178 31.6362 27.602 31.8492 28.2056 31.8492C28.8091 31.8492 29.3934 31.6362 29.8554 31.2479L54.2396 10.7509C56.814 8.58681 57.1467 4.74543 54.9825 2.17073C52.8184 -0.403648 48.977 -0.736342 46.4027 1.42778L28.2054 16.724L10.0085 1.42778Z" fill={`url(#${gmailB})`} />
        <defs>
          <linearGradient id={gmailA} x1="50.3153" y1="5.76727" x2="50.3153" y2="44.8701" gradientUnits="userSpaceOnUse">
            <stop stopColor="#60D673" />
            <stop offset="0.17" stopColor="#42C868" />
            <stop offset="0.39" stopColor="#0EBC5F" />
            <stop offset="0.62" stopColor="#00A9BB" />
            <stop offset="0.86" stopColor="#3C90FF" />
            <stop offset="1" stopColor="#3186FF" />
          </linearGradient>
          <linearGradient id={gmailB} x1="6.04194e-05" y1="6.45153" x2="56.4107" y2="6.45153" gradientUnits="userSpaceOnUse">
            <stop offset="0.08" stopColor="#FF63A0" />
            <stop offset="0.3" stopColor="#FC413D" />
            <stop offset="0.5" stopColor="#FC413D" />
            <stop offset="0.65" stopColor="#FC413D" />
            <stop offset="0.72" stopColor="#FC5C30" />
            <stop offset="0.86" stopColor="#FEB10C" />
            <stop offset="0.91" stopColor="#FEC700" />
            <stop offset="0.96" stopColor="#FFDB0F" />
          </linearGradient>
        </defs>
      </svg>
    ),
    spark: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id={sparkId} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#7C5CFF" />
            <stop offset="1" stopColor="#2F9BFF" />
          </linearGradient>
        </defs>
        <path fill={`url(#${sparkId})`} d="M12 2.5c.6 3.9 2.1 6.4 4.4 7.6 1.1.6 2.4.9 4.1 1.1v1.6c-4.6.6-7.3 3-8.5 8.7h-1.6c-.6-3.9-2.1-6.4-4.4-7.6-1.1-.6-2.4-.9-4.1-1.1v-1.6c4.6-.6 7.3-3 8.5-8.7z" />
      </svg>
    ),
    clickup: (
      <svg viewBox="0 0 49.7096 59.6884" fill="none" aria-hidden="true">
        <path fillRule="evenodd" clipRule="evenodd" d="M0 45.9002L9.1618 38.8247C14.0602 45.1745 19.2307 48.1679 24.9455 48.1679C30.6603 48.1679 35.7401 45.2652 40.3663 38.9154L49.7096 45.8094C42.997 54.8805 34.6516 59.6882 24.9455 59.6882C15.3301 59.6882 6.89403 54.8805 0 45.9002Z" fill={`url(#${clickupA})`} />
        <path fillRule="evenodd" clipRule="evenodd" d="M24.9535 15.3301L8.62558 29.3903L1.09657 20.5914L25.0442 0L48.8105 20.5914L41.1908 29.2996L24.9535 15.3301Z" fill={`url(#${clickupB})`} />
        <defs>
          <linearGradient id={clickupA} x1="0" y1="49.2666" x2="49.75" y2="49.2666" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8930FD" />
            <stop offset="1" stopColor="#49CCF9" />
          </linearGradient>
          <linearGradient id={clickupB} x1="1.09231" y1="14.6901" x2="48.7603" y2="14.6901" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FF02F0" />
            <stop offset="1" stopColor="#FFC800" />
          </linearGradient>
        </defs>
      </svg>
    ),
    hubspot: (
      <svg viewBox="0 0 24 24" fill="#FF7A59" aria-hidden="true">
        <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z" />
      </svg>
    ),
    calendar: (
      <svg viewBox="0 0 24 24" fill="#4285F4" aria-hidden="true">
        <path d="M18.316 5.684H24v12.632h-5.684V5.684zM5.684 24h12.632v-5.684H5.684V24zM18.316 5.684V0H1.895A1.894 1.894 0 0 0 0 1.895v16.421h5.684V5.684h12.632zm-7.207 6.25v-.065c.272-.144.5-.349.687-.617s.279-.595.279-.982c0-.379-.099-.72-.3-1.025a2.05 2.05 0 0 0-.832-.714 2.703 2.703 0 0 0-1.197-.257c-.6 0-1.094.156-1.481.467-.386.311-.65.671-.793 1.078l1.085.452c.086-.249.224-.461.413-.633.189-.172.445-.257.767-.257.33 0 .602.088.816.264a.86.86 0 0 1 .322.703c0 .33-.12.589-.36.778-.24.19-.535.284-.886.284h-.567v1.085h.633c.407 0 .748.109 1.02.327.272.218.407.499.407.843 0 .336-.129.614-.387.832s-.565.327-.924.327c-.351 0-.651-.103-.897-.311-.248-.208-.422-.502-.521-.881l-1.096.452c.178.616.505 1.082.977 1.401.472.319.984.478 1.538.477a2.84 2.84 0 0 0 1.293-.291c.382-.193.684-.458.902-.794.218-.336.327-.72.327-1.149 0-.429-.115-.797-.344-1.105a2.067 2.067 0 0 0-.881-.689zm2.093-1.931l.602.913L15 10.045v5.744h1.187V8.446h-.827l-2.158 1.557zM22.105 0h-3.289v5.184H24V1.895A1.894 1.894 0 0 0 22.105 0zm-3.289 23.5l4.684-4.684h-4.684V23.5zM0 22.105C0 23.152.848 24 1.895 24h3.289v-5.184H0v3.289z" />
      </svg>
    ),
    slack: (
      <svg viewBox="0 0 49.883 49.877" fill="none" aria-hidden="true">
        <g transform="translate(0 0)">
          <path d="M18.3549 10.4784C15.4713 10.4784 13.1157 8.12279 13.1157 5.2392C13.1157 2.35561 15.4713 0 18.3549 0C21.2385 0 23.5941 2.35561 23.5941 5.2392V10.4784H18.3549Z" fill="#36C5F0" />
          <path d="M18.3575 13.12C21.2411 13.12 23.5967 15.4756 23.5967 18.3592C23.5967 21.2428 21.2411 23.5984 18.3575 23.5984H5.2392C2.35561 23.5984 0 21.2428 0 18.3592C0 15.4756 2.35561 13.12 5.2392 13.12H18.3575Z" fill="#36C5F0" />
        </g>
        <g transform="translate(26.28 0)">
          <path d="M13.1244 18.3592C13.1244 15.4756 15.48 13.12 18.3636 13.12C21.2472 13.12 23.6028 15.4756 23.6028 18.3592C23.6028 21.2428 21.2472 23.5984 18.3636 23.5984H13.1244V18.3592Z" fill="#2EB67D" />
          <path d="M10.4785 18.3575C10.4785 21.2411 8.12286 23.5967 5.23927 23.5967C2.35568 23.5967 7.4362e-05 21.2411 7.4362e-05 18.3575V5.2392C7.4362e-05 2.35561 2.35568 0 5.23927 0C8.12286 0 10.4785 2.35561 10.4785 5.2392V18.3575Z" fill="#2EB67D" />
        </g>
        <g transform="translate(0 26.28)">
          <path d="M10.4784 5.2392C10.4784 8.12279 8.12279 10.4784 5.2392 10.4784C2.35561 10.4784 0 8.12279 0 5.2392C0 2.35561 2.35561 0 5.2392 0H10.4784V5.2392Z" fill="#E01E5A" />
          <path d="M13.1157 5.2392C13.1157 2.35561 15.4713 0 18.3549 0C21.2385 0 23.5941 2.35561 23.5941 5.2392V18.3575C23.5941 21.2411 21.2385 23.5967 18.3549 23.5967C15.4713 23.5967 13.1157 21.2411 13.1157 18.3575V5.2392Z" fill="#E01E5A" />
        </g>
        <g transform="translate(26.28 26.28)">
          <path d="M5.23927 13.1157C8.12286 13.1157 10.4785 15.4713 10.4785 18.3549C10.4785 21.2385 8.12286 23.5941 5.23927 23.5941C2.35568 23.5941 7.4362e-05 21.2385 7.4362e-05 18.3549V13.1157H5.23927Z" fill="#ECB22E" />
          <path d="M5.23927 10.4784C2.35568 10.4784 7.4362e-05 8.12279 7.4362e-05 5.2392C7.4362e-05 2.35561 2.35568 0 5.23927 0H18.3576C21.2412 0 23.5968 2.35561 23.5968 5.2392C23.5968 8.12279 21.2412 10.4784 18.3576 10.4784H5.23927Z" fill="#ECB22E" />
        </g>
      </svg>
    ),
    notion: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
      </svg>
    ),
  };
}

/* ---------- Line icons for the everyday commands ---------- */

const glyphs = {
  doc: (
    <svg viewBox="0 0 24 24" className="ui-cmc__glyph" aria-hidden="true">
      <path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h4" />
    </svg>
  ),
  invite: (
    <svg viewBox="0 0 24 24" className="ui-cmc__glyph" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0M19 8v4M17 10h4" />
    </svg>
  ),
  upload: (
    <svg viewBox="0 0 24 24" className="ui-cmc__glyph" aria-hidden="true">
      <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 24 24" className="ui-cmc__glyph" aria-hidden="true">
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  ),
  home: (
    <svg viewBox="0 0 24 24" className="ui-cmc__glyph" aria-hidden="true">
      <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />
    </svg>
  ),
  inbox: (
    <svg viewBox="0 0 24 24" className="ui-cmc__glyph" aria-hidden="true">
      <path d="M4 13l2.5-8h11L20 13v6H4zM4 13h4.5a3.5 3.5 0 0 0 7 0H20" />
    </svg>
  ),
  reports: (
    <svg viewBox="0 0 24 24" className="ui-cmc__glyph" aria-hidden="true">
      <path d="M5 20V10M12 20V4M19 20v-7" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" className="ui-cmc__glyph" aria-hidden="true">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-1.7 1L15 20.5h-4l-.4-2.1a7 7 0 0 1-1.7-1l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-3l-1.6-1.2 2-3.4 1.9.7a7 7 0 0 1 1.7-1L11 3.5h4l.4 2.1a7 7 0 0 1 1.7 1l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 3z" />
    </svg>
  ),
  help: (
    <svg viewBox="0 0 24 24" className="ui-cmc__glyph" aria-hidden="true">
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" />
    </svg>
  ),
};

/* ---------- The default menu ---------- */

function defaultGroups(modifier: string, brand: BrandMarks): CommandGroup[] {
  return [
    {
      id: "suggestions",
      label: "Suggestions",
      commands: [
        { id: "email", label: "Write an email", hint: "Gmail", logo: brand.gmail, keys: [modifier, "1"], keywords: ["compose", "draft", "inbox"] },
        { id: "ask", label: "Ask assistant", hint: "Summaries, drafts, answers", logo: brand.spark, keys: [modifier, "2"], keywords: ["ai", "summary", "question"] },
        { id: "task", label: "Create a task", hint: "ClickUp", logo: brand.clickup, keys: [modifier, "3"], keywords: ["todo", "ticket", "assign"] },
        { id: "crm", label: "Add contact to CRM", hint: "HubSpot", logo: brand.hubspot, keys: [modifier, "4"], keywords: ["lead", "deal", "pipeline"] },
        { id: "meet", label: "Schedule a meeting", hint: "Google Calendar", logo: brand.calendar, keys: [modifier, "5"], keywords: ["event", "call", "invite"] },
      ],
    },
    {
      id: "share",
      label: "Share",
      commands: [
        { id: "slack", label: "Post an update", hint: "#team-updates", logo: brand.slack, keywords: ["channel", "message", "standup"] },
        { id: "notion", label: "Save as page", hint: "Notion · Meeting notes", logo: brand.notion, keywords: ["docs", "notes", "wiki"] },
      ],
    },
    {
      id: "general",
      label: "General",
      commands: [
        { id: "new-doc", label: "New document", icon: glyphs.doc, keys: ["N"], keywords: ["create", "file", "page"] },
        { id: "invite", label: "Invite teammates", icon: glyphs.invite, keys: ["I"], keywords: ["people", "members", "share"] },
        { id: "upload", label: "Upload files", icon: glyphs.upload, keys: ["U"], keywords: ["attach", "import", "assets"] },
        { id: "theme", label: "Switch to dark mode", icon: glyphs.moon, keys: ["⇧", "D"], keywords: ["appearance", "night", "light"] },
      ],
    },
    {
      id: "go-to",
      label: "Go to",
      commands: [
        { id: "home", label: "Home", icon: glyphs.home, keys: ["G", "H"], keywords: ["start", "dashboard"] },
        { id: "inbox", label: "Inbox", icon: glyphs.inbox, keys: ["G", "I"], keywords: ["messages", "mail"] },
        { id: "reports", label: "Reports", icon: glyphs.reports, keys: ["G", "R"], keywords: ["analytics", "charts"] },
        { id: "settings", label: "Settings", icon: glyphs.settings, keys: ["G", "S"], keywords: ["preferences", "account"] },
        { id: "help", label: "Help & feedback", icon: glyphs.help, keys: ["?"], keywords: ["support", "docs", "contact"] },
      ],
    },
  ];
}

/* ---------- Fuzzy matching ---------- */

type FuzzyHit = { score: number; indices: number[] };

/** Substring first, subsequence after – the indices are what gets wrapped in <mark>. */
function fuzzy(text: string, needle: string): FuzzyHit | null {
  const haystack = text.toLowerCase();
  const direct = haystack.indexOf(needle);
  if (direct >= 0) {
    const indices: number[] = [];
    for (let index = 0; index < needle.length; index += 1) indices.push(direct + index);
    return { score: 120 - direct * 2 - haystack.length * 0.1, indices };
  }

  const indices: number[] = [];
  let cursor = 0;
  let score = 0;
  let previous = -2;

  for (const character of needle) {
    const found = haystack.indexOf(character, cursor);
    if (found === -1) return null;
    indices.push(found);
    score += found === previous + 1 ? 10 : 4;
    if (found === 0 || /[\s·,/()#-]/.test(haystack[found - 1] ?? "")) score += 6;
    previous = found;
    cursor = found + 1;
  }

  return { score, indices };
}

type ScoredMatch = { score: number; labelMarks: number[]; hintMarks: number[] };

/** Every word typed has to land somewhere: the name, the hint, a keyword or the section. */
function scoreCommand(command: CommandItem, groupLabel: string, query: string): ScoredMatch | null {
  if (!query) return { score: 0, labelMarks: [], hintMarks: [] };

  const labelMarks: number[] = [];
  const hintMarks: number[] = [];
  let total = 0;

  for (const token of query.toLowerCase().split(/\s+/).filter(Boolean)) {
    const labelHit = fuzzy(command.label, token);
    const hintHit = command.hint ? fuzzy(command.hint, token) : null;
    const groupHit = fuzzy(groupLabel, token);

    let keywordHit: FuzzyHit | null = null;
    for (const keyword of command.keywords ?? []) {
      const hit = fuzzy(keyword, token);
      if (hit && (!keywordHit || hit.score > keywordHit.score)) keywordHit = hit;
    }

    const candidates: { hit: FuzzyHit; weight: number; target: "label" | "hint" | "none" }[] = [];
    if (labelHit) candidates.push({ hit: labelHit, weight: 3, target: "label" });
    if (hintHit) candidates.push({ hit: hintHit, weight: 1.6, target: "hint" });
    if (keywordHit) candidates.push({ hit: keywordHit, weight: 1.2, target: "none" });
    if (groupHit) candidates.push({ hit: groupHit, weight: 0.8, target: "none" });
    if (candidates.length === 0) return null;

    let best = candidates[0];
    for (const candidate of candidates) {
      if (candidate.hit.score * candidate.weight > best.hit.score * best.weight) best = candidate;
    }

    total += best.hit.score * best.weight;
    if (best.target === "label") labelMarks.push(...best.hit.indices);
    else if (best.target === "hint") hintMarks.push(...best.hit.indices);
  }

  if (command.label.toLowerCase().startsWith(query.toLowerCase())) total += 30;
  return { score: total, labelMarks, hintMarks };
}

/** Wraps the matched letters in <mark>, which the sheet tints. */
function highlight(text: string, indices: number[]): ReactNode {
  if (indices.length === 0) return text;

  const sorted = [...indices].sort((a, b) => a - b);
  const parts: ReactNode[] = [];
  let cursor = 0;
  let index = 0;

  while (index < sorted.length) {
    const start = sorted[index];
    if (start < cursor) {
      index += 1;
      continue;
    }
    let end = start;
    index += 1;
    while (index < sorted.length && sorted[index] <= end + 1) {
      end = Math.max(end, sorted[index]);
      index += 1;
    }
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(<mark key={`mark-${start}`}>{text.slice(start, end + 1)}</mark>);
    cursor = end + 1;
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

/** A command is runnable from the keyboard when its chip pair is [modifier, digit]. */
function matchesShortcut(command: CommandItem, key: string, modifierKey: string): boolean {
  const keys = command.keys;
  if (!keys || keys.length !== 2) return false;
  const [first, second] = keys;
  if (second !== key) return false;
  return first === modifierKey || first === "Ctrl" || first === "⌘";
}

/* ---------- The component ---------- */

type Row = {
  command: CommandItem;
  labelMarks: number[];
  hintMarks: number[];
};

type Section = { group: CommandGroup; rows: Row[] };

const defaultRanLabel = (command: CommandItem) => `Ran ${command.label}`;

export function CommandMenu({
  groups,
  placeholder = "Type a command or search…",
  open,
  defaultOpen = true,
  onOpenChange,
  onRun,
  ranLabel = defaultRanLabel,
  modifierKey = "Ctrl",
  hotkey = true,
  autoFocus = false,
  className,
}: CommandMenuProps) {
  const scope = `ui-cmc_${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const isOpen = open ?? innerOpen;

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [ran, setRan] = useState<{ text: string; token: number } | null>(null);
  const [pressed, setPressed] = useState<{ id: string; token: number } | null>(null);
  const [pill, setPill] = useState({ y: FALLBACK_PILL_TOP, h: FALLBACK_ROW_HEIGHT });
  const [listHeight, setListHeight] = useState(MAX_LIST_HEIGHT);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const focusOnOpen = useRef(false);

  const requestOpen = useCallback(
    (next: boolean) => {
      if (open === undefined) setInnerOpen(next);
      onOpenChange?.(next);
    },
    [open, onOpenChange],
  );

  const resolved = groups ?? defaultGroups(modifierKey, brandMarks(scope));
  const trimmed = query.trim();

  const sections: Section[] = [];
  for (const group of resolved) {
    const scored: { score: number; row: Row }[] = [];
    for (const command of group.commands) {
      const match = scoreCommand(command, group.label, trimmed);
      if (!match) continue;
      scored.push({
        score: match.score,
        row: { command, labelMarks: match.labelMarks, hintMarks: match.hintMarks },
      });
    }
    if (scored.length === 0) continue;
    if (trimmed) scored.sort((a, b) => b.score - a.score);
    sections.push({ group, rows: scored.map((entry) => entry.row) });
  }

  const rows = sections.flatMap((section) => section.rows);
  const activeIndex = rows.length === 0 ? -1 : Math.min(active, rows.length - 1);
  const activeRow = activeIndex >= 0 ? rows[activeIndex] : undefined;

  const sectionStarts: number[] = [];
  let offset = 0;
  for (const section of sections) {
    sectionStarts.push(offset);
    offset += section.rows.length;
  }

  const run = useCallback(
    (command: CommandItem) => {
      onRun?.(command, query);
      setRan({ text: ranLabel(command), token: Date.now() });
      setPressed({ id: command.id, token: Date.now() });
    },
    [onRun, query, ranLabel],
  );

  useEffect(() => {
    if (!autoFocus && !focusOnOpen.current) return;
    if (!isOpen) return;
    focusOnOpen.current = false;
    inputRef.current?.focus();
  }, [isOpen, autoFocus]);

  useEffect(() => {
    if (!hotkey) return;
    const onWindowKey = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      if (isOpen) {
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      focusOnOpen.current = true;
      requestOpen(true);
    };
    window.addEventListener("keydown", onWindowKey);
    return () => window.removeEventListener("keydown", onWindowKey);
  }, [hotkey, isOpen, requestOpen]);

  useEffect(() => {
    if (!pressed) return;
    const timer = window.setTimeout(() => setPressed(null), PRESS_MS);
    return () => window.clearTimeout(timer);
  }, [pressed]);

  const rowKey = rows.map((row) => row.command.id).join("|");

  /* The list carries its own height so the sheet can glide between filtered sizes. */
  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

    const measure = () => {
      const height = inner.getBoundingClientRect().height;
      if (height > 0) setListHeight(Math.min(MAX_LIST_HEIGHT, height + LIST_PAD_BOTTOM));
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  /* The pill takes the active row's box, and the list scrolls just enough to show it. */
  useLayoutEffect(() => {
    const list = listRef.current;
    const inner = innerRef.current;
    if (!list || !inner) return;

    const height = inner.getBoundingClientRect().height;
    if (height <= 0) return;
    const nextHeight = Math.min(MAX_LIST_HEIGHT, height + LIST_PAD_BOTTOM);
    setListHeight(nextHeight);

    const items = list.querySelectorAll<HTMLElement>(".ui-cmc__item");
    const item = activeIndex >= 0 ? items[activeIndex] : undefined;
    if (!item) return;

    const listRect = list.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    setPill({ y: itemRect.top - listRect.top + list.scrollTop, h: itemRect.height });

    const viewport = nextHeight - LIST_PAD_BOTTOM;
    if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + viewport) {
      list.scrollTop = item.offsetTop + item.offsetHeight - viewport;
    }
  }, [activeIndex, rowKey]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const withModifier = event.metaKey || event.ctrlKey;

    if (withModifier && /^[1-9]$/.test(event.key)) {
      const shortcut = rows.find((row) => matchesShortcut(row.command, event.key, modifierKey));
      if (shortcut) {
        event.preventDefault();
        run(shortcut.command);
      }
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (rows.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (Math.min(current, rows.length - 1) + step + rows.length) % rows.length);
      return;
    }

    if (event.key === "Tab") {
      if (sectionStarts.length === 0) return;
      event.preventDefault();
      const current = sectionStarts.findIndex((start, index) => {
        const end = index + 1 < sectionStarts.length ? sectionStarts[index + 1] : rows.length;
        return activeIndex >= start && activeIndex < end;
      });
      const direction = event.shiftKey ? -1 : 1;
      setActive(sectionStarts[(current + direction + sectionStarts.length) % sectionStarts.length]);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (activeRow) run(activeRow.command);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      if (query) {
        setQuery("");
        setActive(0);
        setRan(null);
        return;
      }
      requestOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={["ui-cmc", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-command-menu" precedence="default">
        {css}
      </style>

      <div className="ui-cmc__card">
        <label className="ui-cmc__search">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7.25" cy="7.25" r="4.75" />
            <path d="m13.5 13.5-2.9-2.9" />
          </svg>
          <input
            ref={inputRef}
            placeholder={placeholder}
            aria-label="Command"
            role="combobox"
            aria-expanded="true"
            aria-controls={`${scope}-list`}
            aria-activedescendant={activeRow ? `${scope}-${activeRow.command.id}` : undefined}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
              setRan(null);
            }}
            onKeyDown={onKeyDown}
          />
          <kbd className="ui-cmc__enter" aria-hidden="true">
            <svg viewBox="0 0 16 16">
              <path d="M12.5 4v3a2 2 0 0 1-2 2h-7M6 6.5 3.5 9 6 11.5" />
            </svg>
          </kbd>
        </label>

        <div
          ref={listRef}
          id={`${scope}-list`}
          className="ui-cmc__list"
          role="listbox"
          aria-label="Commands"
          style={{ height: `${listHeight}px` }}
        >
          <span
            className="ui-cmc__pill"
            data-lit={activeRow ? "true" : undefined}
            aria-hidden="true"
            style={{ transform: `translateY(${pill.y}px)`, height: `${pill.h}px` }}
          />

          <div className="ui-cmc__inner" ref={innerRef}>
            {sections.map((section, sectionIndex) => (
              <div key={section.group.id} role="group" aria-label={section.group.label} className="ui-cmc__group">
                <span className="ui-cmc__label">{section.group.label}</span>
                {section.rows.map((row, rowIndex) => {
                  const index = sectionStarts[sectionIndex] + rowIndex;
                  const command = row.command;
                  return (
                    <button
                      key={command.id}
                      id={`${scope}-${command.id}`}
                      data-id={command.id}
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      className="ui-cmc__item"
                      tabIndex={-1}
                      data-ran={pressed && pressed.id === command.id ? "" : undefined}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => run(command)}
                    >
                      {command.logo ? (
                        <span className="ui-cmc__logo">{command.logo}</span>
                      ) : (
                        <span className="ui-cmc__icon">{command.icon ?? glyphs.doc}</span>
                      )}
                      <span className="ui-cmc__text">
                        <span className="ui-cmc__name">{highlight(command.label, row.labelMarks)}</span>
                        {command.hint ? (
                          <span className="ui-cmc__hint">{highlight(command.hint, row.hintMarks)}</span>
                        ) : null}
                      </span>
                      {command.keys && command.keys.length > 0 ? (
                        <span className="ui-cmc__keys" aria-hidden="true">
                          {command.keys.map((key, keyIndex) => (
                            <kbd key={`${key}-${keyIndex}`}>{key}</kbd>
                          ))}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <footer className="ui-cmc__foot" aria-live="polite">
          {ran ? (
            <span key={ran.token} className="ui-cmc__done">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 12.5 4 4 8-9" />
              </svg>
              <span className="ui-cmc__done-text">{ran.text}</span>
            </span>
          ) : (
            <span className="ui-cmc__tip">
              <kbd>Tab</kbd> to jump between sections
            </span>
          )}
          <span className="ui-cmc__foot-right">
            <span className="ui-cmc__keys">
              <kbd>{modifierKey}</kbd>
              <kbd>K</kbd>
            </span>
            to open
          </span>
        </footer>
      </div>
    </div>
  );
}

const css = /* css */ `
.ui-cmc{--ui-cmc-card: #fffdfb;--ui-cmc-ink: rgba(11, 9, 8, 0.88);--ui-cmc-strong: #0b0908;--ui-cmc-text: rgba(11, 9, 8, 0.61);--ui-cmc-muted: rgba(11, 9, 8, 0.45);--ui-cmc-faint: rgba(11, 9, 8, 0.27);--ui-cmc-icon: rgba(11, 9, 8, 0.447);--ui-cmc-line: rgba(11, 9, 8, 0.06);--ui-cmc-line-strong: rgba(11, 9, 8, 0.1);--ui-cmc-active: rgba(11, 9, 8, 0.06);--ui-cmc-tile: #fffdfb;--ui-cmc-tile-ring: rgba(11, 9, 8, 0.1);--ui-cmc-mark: rgba(217, 84, 31, 0.12);--ui-cmc-accent: rgba(217, 84, 31, 0.765);--ui-cmc-ok: #2f8d5c;--ui-cmc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.08), 0 12px 28px -10px rgba(11, 9, 8, 0.16), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-cmc-ease: cubic-bezier(0.22, 1, 0.36, 1);box-sizing: border-box;container-type: inline-size;display: grid;width: 100%;max-width: 600px;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;font-weight: 400;color: var(--ui-cmc-ink);-webkit-font-smoothing: antialiased}
.ui-cmc *, .ui-cmc *::before, .ui-cmc *::after{box-sizing: border-box}
:where(.ui-cmc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;cursor: pointer}
:where(.ui-cmc) svg{display: block;flex: none}
.ui-cmc__card{overflow: hidden;border-radius: 12px;background: var(--ui-cmc-card);box-shadow: var(--ui-cmc-shadow)}
.ui-cmc__search{display: flex;align-items: center;gap: 12px;height: 48px;padding: 0 12px 0 14px;border-bottom: 0.5px solid var(--ui-cmc-line);cursor: text}
.ui-cmc__search > svg{width: 16px;height: 16px;fill: none;stroke: var(--ui-cmc-icon);stroke-width: 1.1;stroke-linecap: round}
.ui-cmc__search input{flex: 1;min-width: 0;height: 20px;padding: 0;border: 0;background: transparent;font: inherit;font-size: 13px;line-height: 20px;color: var(--ui-cmc-ink);caret-color: var(--ui-cmc-accent);outline: none}
.ui-cmc__search input::placeholder{color: var(--ui-cmc-faint)}
.ui-cmc__search input:focus-visible{outline: none}
.ui-cmc__enter svg{width: 12px;height: 12px;fill: none;stroke: currentColor;stroke-width: 1.1;stroke-linecap: round;stroke-linejoin: round}
.ui-cmc__list{position: relative;max-height: 360px;padding: 0 4px 4px;overflow-y: auto;scrollbar-width: thin;transition: height var(--nm-dur-4, 380ms) var(--ui-cmc-ease)}
.ui-cmc__group{display: flex;flex-direction: column}
.ui-cmc__label{padding: 10px 8px 4px;font-size: 10px;font-weight: 500;line-height: 16px;letter-spacing: 0.5px;text-transform: uppercase;color: var(--ui-cmc-muted)}
.ui-cmc__group:first-child:not(:has(.ui-cmc__label)){padding-top: 4px}
.ui-cmc__pill{position: absolute;top: 0;left: 4px;right: 4px;border-radius: 6px;background: var(--ui-cmc-active);opacity: 0;transition: transform 90ms ease-out, height 90ms ease-out, opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cmc__pill[data-lit]{opacity: 1}
.ui-cmc__item{position: relative;display: flex;align-items: center;gap: 10px;height: 36px;padding: 0 8px;border-radius: 6px;text-align: left}
.ui-cmc__logo{display: grid;place-items: center;flex: none;width: 20px;height: 20px;border-radius: 5px;background: var(--ui-cmc-tile);box-shadow: 0 0 0 0.5px var(--ui-cmc-tile-ring), 0 1px 1px -1px rgba(0, 0, 0, 0.1);color: var(--ui-cmc-strong)}
.ui-cmc__logo svg{width: 12px;height: 12px}
.ui-cmc__icon{display: grid;place-items: center;flex: none;width: 20px;height: 20px;color: var(--ui-cmc-icon);transition: color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cmc__glyph{width: 16px;height: 16px;fill: none;stroke: currentColor;stroke-width: 1.1;stroke-linecap: round;stroke-linejoin: round}
.ui-cmc__glyph path{vector-effect: non-scaling-stroke}
.ui-cmc__item[aria-selected="true"] .ui-cmc__icon{color: var(--ui-cmc-ink)}
.ui-cmc__text{display: flex;flex: 1;align-items: baseline;gap: 8px;min-width: 0}
.ui-cmc__name{overflow: hidden;color: var(--ui-cmc-ink);white-space: nowrap;text-overflow: ellipsis}
.ui-cmc__hint{overflow: hidden;color: var(--ui-cmc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-cmc mark{border-radius: 3px;background: var(--ui-cmc-mark);color: inherit}
.ui-cmc__keys{display: inline-flex;flex: none;gap: 2px}
.ui-cmc kbd{display: inline-grid;place-items: center;min-width: 20px;height: 20px;padding: 0 5px;border-radius: 5px;box-shadow: inset 0 0 0 0.5px var(--ui-cmc-line-strong);font-family: inherit;font-size: 11px;font-weight: 500;line-height: 16px;color: var(--ui-cmc-muted);transition: color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-cmc__item[aria-selected="true"] kbd{color: var(--ui-cmc-text)}
.ui-cmc__enter{padding: 0 4px;color: var(--ui-cmc-icon)}
.ui-cmc__item[data-ran]{animation: ui-cmc-ran var(--nm-dur-5, 620ms) var(--ui-cmc-ease)}
@keyframes ui-cmc-ran{30%{transform: scale(0.985)}
}
.ui-cmc__foot{display: flex;align-items: center;justify-content: space-between;gap: 12px;height: 40px;padding: 0 12px;border-top: 0.5px solid var(--ui-cmc-line);font-size: 12px;line-height: 16px;color: var(--ui-cmc-muted)}
.ui-cmc__foot > span{display: inline-flex;align-items: center;gap: 6px;min-width: 0;white-space: nowrap}
.ui-cmc__done{color: var(--ui-cmc-ink);animation: ui-cmc-in var(--nm-dur-3, 240ms) var(--ui-cmc-ease)}
.ui-cmc__done-text{overflow: hidden;text-overflow: ellipsis}
.ui-cmc__done svg{width: 16px;height: 16px;fill: none;stroke: var(--ui-cmc-ok);stroke-width: 1.4;stroke-linecap: round;stroke-linejoin: round}
.ui-cmc__foot-right{flex: none}
@keyframes ui-cmc-in{from{opacity: 0;transform: translateY(3px)}
to{opacity: 1;transform: none}
}
@container (max-width: 480px){.ui-cmc__item .ui-cmc__keys, .ui-cmc__foot > .ui-cmc__foot-right, .ui-cmc__foot > .ui-cmc__tip, .ui-cmc__enter, .ui-cmc__hint{display: none}
.ui-cmc__item{height: 40px}
.ui-cmc__list{max-height: 360px}
.ui-cmc__foot:not(:has(.ui-cmc__done)){display: none}
}
@media (hover: none) and (pointer: coarse){.ui-cmc__item{height: 44px}
.ui-cmc__search{height: 52px}
}
@media (prefers-reduced-motion: reduce){.ui-cmc *, .ui-cmc *::before, .ui-cmc *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-cmc{--ui-cmc-card: #211b16;--ui-cmc-ink: rgba(255, 253, 251, 0.9);--ui-cmc-strong: #fffdfb;--ui-cmc-text: rgba(255, 253, 251, 0.62);--ui-cmc-muted: rgba(255, 253, 251, 0.46);--ui-cmc-faint: rgba(255, 253, 251, 0.3);--ui-cmc-icon: rgba(255, 253, 251, 0.5);--ui-cmc-line: rgba(255, 253, 251, 0.08);--ui-cmc-line-strong: rgba(255, 253, 251, 0.12);--ui-cmc-active: rgba(255, 253, 251, 0.08);--ui-cmc-tile: #2b231b;--ui-cmc-tile-ring: rgba(255, 253, 251, 0.12);--ui-cmc-mark: rgba(255, 138, 92, 0.24);--ui-cmc-accent: #ff8a5c;--ui-cmc-ok: #2f8d5c;--ui-cmc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4)}

`;
