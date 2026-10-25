import { useEffect, useMemo, useState } from "react";
import { AgentGraph, type GraphCall, type GraphNode } from "../agent-graph";

/* Brand marks – logos are not part of the component, so the demo supplies them. */
const ClaudeLogo = () => (
  <svg viewBox="0 0 1200 1200" aria-hidden="true">
    <path
      fill="#D97757"
      d="M 233.959793 800.214905 L 468.644287 668.536987 L 472.590637 657.100647 L 468.644287 650.738403 L 457.208069 650.738403 L 417.986633 648.322144 L 283.892639 644.69812 L 167.597321 639.865845 L 54.926208 633.825623 L 26.577238 627.785339 L 3.3e-05 592.751709 L 2.73832 575.27533 L 26.577238 559.248352 L 60.724873 562.228149 L 136.187973 567.382629 L 249.422867 575.194763 L 331.570496 580.026978 L 453.261841 592.671082 L 472.590637 592.671082 L 475.328857 584.859009 L 468.724915 580.026978 L 463.570557 575.194763 L 346.389313 495.785217 L 219.543671 411.865906 L 153.100723 363.54361 L 117.100678 339.221466 L 99.060402 316.389313 L 91.248322 275.11409 L 123.865776 245.31543 L 167.597321 248.295303 L 178.711411 251.275177 L 222.7651 285.100677 L 316.886597 357.986633 L 439.784821 448.429657 L 457.770508 463.463104 L 464.966431 453.261841 L 464.043579 446.577179 L 457.770508 436.107361 L 390.604004 314.751709 L 319.194656 199.409409 L 285.100677 144.644287 L 276.080536 111.865776 C 272.778519 98.255035 270.442963 86.657715 270.442963 72.72483 L 307.489929 22.308718 L 327.94693 14.818792 L 377.395325 21.502941 L 398.17447 39.54361 L 428.939606 109.923493 L 478.389313 219.865768 L 555.221436 369.54361 L 577.691275 413.154388 L 589.691275 453.583893 L 596.05365 466.30867 L 603.865784 466.30867 L 609.906036 457.208069 L 659.355713 369.865784 L 744.161072 260.248352 L 809.798645 189.865768 L 885.986633 139.812088 L 935.033569 139.812088 L 971.114075 193.54361 L 954.926025 249.422867 L 904.107361 313.82544 L 861.906067 368.375839 L 801.422913 447.94693 L 763.752869 541.958679 L 763.752869 548.29541 L 770.17487 548.948975 L 812.69812 542.658325 L 1022.738342 502.568329 L 1133.114136 482.174866 L 1265.637573 459.54361 L 1325.194763 487.409393 L 1331.516815 519.248352 L 1295.114136 593.27533 L 1006.577209 680.375839 L 869.765914 717.566406 L 869.765914 720.537109 L 886.899841 726.738281 L 936.966675 727.57019 L 1151.355713 772.577209 L 1348.046387 817.584229 L 1377.422913 836.655762 L 1322.577209 893.31543 L 1013.077209 746.577209 L 905.664429 701.57019 L 890.456055 701.57019 L 890.456055 710.537109 L 981.437073 799.865784 L 1064.187134 954.375977 L 1114.345825 1106.046387 L 1102.537109 1154.577209 L 1062.386597 1172.577209 L 1018.02771 1167.114136 L 926.456055 1052.577209 L 831.865784 918.375977 L 755.516846 782.577209 L 748.24115 786.375977 L 651.677185 1174.872681 L 589.791931 1210.738403 L 537.516846 1177.395325 L 556.086609 1112.227295 L 578.738403 1016.560181 L 598.738403 940.577209 L 617.034424 851.865784 L 627.034424 785.865784 L 627.034424 775.865784 L 622.657715 775.865784 L 521.516846 905.956055 L 367.570557 1108.329712 L 242.308105 1234.738403 L 215.114136 1224.577209 L 202.738403 1172.577209 L 230.657715 1128.644287 L 397.570557 897.865784 L 502.738403 761.865784 L 536.577209 701.57019 L 590.577209 625.865784 L 606.738403 590.738403 L 545.365906 463.865784 L 545.365906 411.54361 L 548.738403 392.738403 L 589.791931 384.738403 L 641.577209 394.738403 L 704.738403 464.738403 L 845.365906 674.738403 L 1013.365906 852.738403 L 1063.365906 898.738403 L 1153.365906 940.738403 L 1153.365906 975.738403 L 1061.365906 963.738403 L 991.365906 930.738403 L 838.738403 780.738403"
    />
  </svg>
);

const GeminiLogo = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="ui-demo-gemini" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
        <stop stopColor="#1C7DFF" />
        <stop offset="0.52" stopColor="#1C69FF" />
        <stop offset="1" stopColor="#B04DFF" />
      </linearGradient>
    </defs>
    <path
      fill="url(#ui-demo-gemini)"
      d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"
    />
  </svg>
);

const CoderLogo = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#0f0f0f"
      d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"
    />
  </svg>
);

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="9" />
    <path d="m17.5 17.5 4.5 4.5" />
  </svg>
);

const NotionLogo = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#0f0f0f"
      d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.434.327s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854l-1.168-.093c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.933c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"
    />
  </svg>
);

const SlackLogo = () => (
  <svg viewBox="0 0 50 50" aria-hidden="true">
    <path fill="#36C5F0" d="M18.35 10.48a5.24 5.24 0 1 1-5.24-5.24h5.24v5.24Zm1.31 0a5.24 5.24 0 0 1 10.48 0v13.12a5.24 5.24 0 0 1-10.48 0V10.48Z" />
    <path fill="#2EB67D" d="M39.64 18.36a5.24 5.24 0 1 1 5.24 5.24h-5.24v-5.24Zm0-1.31a5.24 5.24 0 1 1 0-10.48H23.12a5.24 5.24 0 1 0 0 10.48h13.12Z" />
    <path fill="#ECB22E" d="M31.77 39.72a5.24 5.24 0 1 1 5.24 5.24h-5.24v-5.24Zm-1.31 0a5.24 5.24 0 0 1-10.48 0V26.6a5.24 5.24 0 0 1 10.48 0v13.12Z" />
    <path fill="#E01E5A" d="M10.48 31.85a5.24 5.24 0 1 1-5.24-5.24h5.24v5.24Zm1.31 1.31a5.24 5.24 0 1 1 0 10.48h13.12a5.24 5.24 0 1 0 0-10.48H11.79Z" />
  </svg>
);

const HubSpotLogo = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#FF7A59"
      d="M18.164 7.93V5.084a2.198 2.198 0 0 0 1.267-1.978v-.067A2.2 2.2 0 0 0 17.238.845h-.067a2.2 2.2 0 0 0-2.193 2.193v.067a2.196 2.196 0 0 0 1.252 1.973l.013.006v2.852a6.22 6.22 0 0 0-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 1 0 4.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 0 0-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 0 0-.58-.095h-.002a2.033 2.033 0 1 0 2.033 2.033 1.978 1.978 0 0 0-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 1 0 4.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 1 1 3.215-3.207v.002a3.206 3.206 0 0 1-3.207 3.207z"
    />
  </svg>
);

const StripeLogo = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect width="24" height="24" rx="6" fill="#635BFF" />
    <path
      fill="#fff"
      transform="translate(5 5) scale(0.5833)"
      d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z"
    />
  </svg>
);

const DatabaseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="#0f0f0f" strokeWidth="2" aria-hidden="true">
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M20 12c0 1.657-3.582 3-8 3s-8-1.343-8-3" />
    <path d="M20 5v14c0 1.657-3.582 3-8 3s-8-1.343-8-3V5" />
  </svg>
);

const GitHubLogo = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#0f0f0f"
      d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
    />
  </svg>
);

const YouLogo = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <path
      fill="currentColor"
      d="M31.5 20.6a1.5 1.5 0 0 1-1.5 1.5h-8.4a1.5 1.5 0 0 0-1.5 1.5v8.4a1.5 1.5 0 0 1-1.5 1.5H9.6a1.5 1.5 0 0 1-1.5-1.5v-8.4A1.5 1.5 0 0 0 6.6 22H1.5A1.5 1.5 0 0 1 0 20.5V10.4a1.5 1.5 0 0 1 1.5-1.5h8.4a1.5 1.5 0 0 0 1.5-1.5V1.5A1.5 1.5 0 0 1 12.9 0h8.7a1.5 1.5 0 0 1 1.5 1.5v5.9a1.5 1.5 0 0 0 1.5 1.5h5.9a1.5 1.5 0 0 1 1.5 1.5zM10.5 19.4a1.5 1.5 0 0 0-1.5 1.5v8.6h6v-8.6a1.5 1.5 0 0 1 1.5-1.5h8.6v-6h-8.6a1.5 1.5 0 0 1-1.5-1.5V3.5h-6v8.4a1.5 1.5 0 0 1-1.5 1.5H3.5v6z"
    />
  </svg>
);

/* ---------- the run ---------- */

const agents: GraphNode[] = [
  {
    id: "lead",
    name: "Orchestrator",
    kind: "agent",
    detail: "Opus 5.5",
    status: "working",
    doing: "Waiting on four agents.",
    cost: 0.86,
    lead: true,
    icon: <ClaudeLogo />,
  },
  {
    id: "research",
    name: "Researcher",
    kind: "agent",
    detail: "Sonnet 5.5",
    status: "working",
    doing: "Saving the comparison to Notion.",
    cost: 0.34,
    icon: <ClaudeLogo />,
  },
  {
    id: "analyst",
    name: "Analyst",
    kind: "agent",
    detail: "Gemini 3.8 Pro",
    status: "working",
    doing: "Reading lost deals in HubSpot.",
    cost: 0.21,
    icon: <GeminiLogo />,
  },
  {
    id: "coder",
    name: "Coder",
    kind: "agent",
    detail: "GPT-6 Sol",
    status: "waiting",
    doing: "Wants to push a branch to GitHub.",
    cost: 0.19,
    icon: <CoderLogo />,
  },
  {
    id: "writer",
    name: "Writer",
    kind: "agent",
    detail: "Sonnet 5.5",
    status: "working",
    doing: "Drafting the copy for the three plans.",
    cost: 0.28,
    icon: <ClaudeLogo />,
  },
  { id: "web", name: "Web search", kind: "tool", short: "Search", icon: <SearchIcon /> },
  { id: "notion", name: "Notion", kind: "tool", icon: <NotionLogo /> },
  { id: "slack", name: "Slack", kind: "tool", icon: <SlackLogo /> },
  { id: "hubspot", name: "HubSpot", kind: "tool", icon: <HubSpotLogo /> },
  { id: "stripe", name: "Stripe", kind: "tool", icon: <StripeLogo /> },
  { id: "db", name: "Database", kind: "tool", short: "DB", icon: <DatabaseIcon /> },
  { id: "github", name: "GitHub", kind: "tool", icon: <GitHubLogo /> },
  { id: "you", name: "You", kind: "user", doing: "Asked for the pricing launch.", icon: <YouLogo /> },
];

const edges: [string, string][] = [
  ["you", "lead"],
  ["research", "notion"],
  ["analyst", "hubspot"],
  ["coder", "github"],
  ["writer", "slack"],
  ["analyst", "db"],
  ["lead", "stripe"],
];

/** Each beat starts a call; it answers a moment later. */
const BEATS: { from: string; to: string; label: string }[] = [
  { from: "lead", to: "research", label: "Compare pricing pages" },
  { from: "research", to: "web", label: "linear.app/pricing" },
  { from: "research", to: "notion", label: "Write the comparison" },
  { from: "lead", to: "analyst", label: "Lost deals in Q3" },
  { from: "analyst", to: "hubspot", label: "Deals closed lost" },
  { from: "lead", to: "writer", label: "Draft three plans" },
  { from: "writer", to: "slack", label: "#pricing-launch" },
  { from: "analyst", to: "db", label: "SELECT churn, plan" },
  { from: "lead", to: "coder", label: "Build the pricing page" },
  { from: "coder", to: "github", label: "Push feat/pricing" },
  { from: "lead", to: "stripe", label: "List current plans" },
];

export default function Demo() {
  const [calls, setCalls] = useState<GraphCall[]>([]);
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (paused) return;
    let beat = 0;
    let seq = 0;
    const start = () => {
      const spec = BEATS[beat % BEATS.length];
      beat += 1;
      const id = `call-${seq++}`;
      const now = Date.now();
      setCalls((current) => [
        ...current.slice(-40),
        { id, from: spec.from, to: spec.to, at: now, status: "pending", label: spec.label },
      ]);
      const settle = window.setTimeout(() => {
        const failed = spec.to === "github" && seq % 5 === 0;
        setCalls((current) =>
          current.map((call) =>
            call.id === id
              ? { ...call, status: failed ? "error" : "ok", ms: 420 + Math.round(Math.random() * 900) }
              : call,
          ),
        );
      }, 520 + Math.random() * 700);
      return settle;
    };

    const timers: number[] = [];
    timers.push(window.setTimeout(start, 260));
    const interval = window.setInterval(() => timers.push(start()), 1150);
    return () => {
      window.clearInterval(interval);
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [paused]);

  const callsPerMinute = useMemo(
    () => calls.filter((call) => Date.now() - call.at < 60000).length,
    [calls],
  );

  return (
    <div style={{ display: "grid", gap: 12, width: "100%", maxWidth: 620 }}>
      <AgentGraph
        nodes={agents}
        calls={calls}
        edges={edges}
        onSelect={(node) => setSelected(node ? node.name : null)}
        title="Agent graph"
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          justifyContent: "space-between",
          fontSize: 12,
          color: "var(--text-muted, #737373)",
        }}
      >
        <span aria-live="polite">
          {selected ? `${selected} selected · ` : ""}
          {callsPerMinute} calls this minute · {agents.filter((n) => n.kind === "agent").length} agents
        </span>
        <button
          type="button"
          onClick={() => setPaused((value) => !value)}
          style={{
            height: 30,
            padding: "0 11px",
            border: 0,
            borderRadius: 8,
            background: "#171717",
            color: "#fff",
            font: "inherit",
            fontSize: 12,
            fontWeight: 550,
            cursor: "pointer",
          }}
        >
          {paused ? "Resume the run" : "Pause the run"}
        </button>
      </div>
    </div>
  );
}
