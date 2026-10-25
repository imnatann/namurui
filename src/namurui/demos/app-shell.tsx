import { useState } from "react";
import { AppShell } from "../app-shell";

/* The page the shell wraps in its inset card – the shell owns the frame, the demo owns the copy. */
function Overview() {
  return (
    <div style={{ padding: "46px 32px 56px" }}>
      <h1 style={{ margin: 0, fontSize: 22, lineHeight: "28px", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink)" }}>
        Overview
      </h1>
      <p style={{ margin: "6px 0 0", fontSize: 13.5, lineHeight: "20px", color: "var(--muted)" }}>
        Everything in your workspace at a glance.
      </p>
      <div style={{ marginTop: 28 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: 16,
            padding: "48px 24px",
            border: "1px dashed var(--line-strong)",
            borderRadius: 14,
            textAlign: "center",
          }}
        >
          <span
            style={{
              display: "grid",
              placeItems: "center",
              width: 42,
              height: 42,
              borderRadius: 11,
              background: "var(--chip)",
              color: "var(--muted)",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              color="currentColor"
              className=""
              strokeWidth={1.9}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                d="M8 17H16"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.9}
              />
              <path
                d="M8 13H12"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.9}
              />
              <path
                d="M13 2.5V3C13 5.82843 13 7.24264 13.8787 8.12132C14.7574 9 16.1716 9 19 9H19.5M20 10.6569V14C20 17.7712 20 19.6569 18.8284 20.8284C17.6569 22 15.7712 22 12 22C8.22876 22 6.34315 22 5.17157 20.8284C4 19.6569 4 17.7712 4 14V9.45584C4 6.21082 4 4.58831 4.88607 3.48933C5.06508 3.26731 5.26731 3.06508 5.48933 2.88607C6.58831 2 8.21082 2 11.4558 2C12.1614 2 12.5141 2 12.8372 2.11401C12.9044 2.13772 12.9702 2.165 13.0345 2.19575C13.3436 2.34355 13.593 2.593 14.0919 3.09188L18.8284 7.82843C19.4065 8.40649 19.6955 8.69552 19.8478 9.06306C20 9.4306 20 9.83935 20 10.6569Z"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.9}
              />
            </svg>
          </span>
          <b style={{ marginTop: 16, fontSize: 14, lineHeight: "20px", fontWeight: 500, color: "var(--ink)" }}>
            Your page goes here
          </b>
          <p
            style={{
              maxWidth: 430,
              margin: "6px 0 0",
              fontSize: 13,
              lineHeight: "19px",
              color: "var(--muted)",
              textWrap: "balance",
            }}
          >
            The shell brings the sidebar and the scroll container – put any screen inside.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Demo() {
  const [active, setActive] = useState("New chat");
  const [workspace, setWorkspace] = useState("Acme");
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          width: "100%",
          maxWidth: 1100,
          margin: "0 auto",
          height: 820,
          borderRadius: 18,
          overflow: "hidden",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.08)",
          background: "var(--card)",
        }}
      >
        <AppShell
          active={active}
          onNavigate={setActive}
          workspace={workspace}
          onWorkspaceChange={setWorkspace}
          user={{ name: "Alex Morgan" }}
          projects={["Q3 Campaign", "Brand assets", "Hiring", "Research"]}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
        >
          <Overview />
        </AppShell>
      </div>
      <p
        style={{
          maxWidth: 1100,
          margin: "12px auto 0",
          fontSize: 12,
          color: "var(--text-muted)",
        }}
      >
        Switch workspaces from the sidebar header, open the account menu at the bottom, or collapse the
        sidebar – the page is whatever you pass as children.
      </p>
    </div>
  );
}
