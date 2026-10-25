import { useEffect, useRef, useState } from "react";
import { AnnouncementPill } from "../announcement-pill";

/* A launch notice as a host would place it: one linked pill that stays, and one a reader can
 * dismiss. The dismissed pill is unmounted on the callback, which is the contract, and the demo
 * brings it back after two seconds so the interaction can be run again.
 *
 * The pills sit in the notice band of a product surface. A pill on bare preview reads as a stray
 * object; in a band above a run view it reads as an announcement, which is what it is. The band
 * uses the theme's muted wash, so the pill stays the only raised thing in it. */

const RETURN_MS = 2000;

export default function Demo() {
  const [open, setOpen] = useState(true);
  const [dismissals, setDismissals] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
    },
    [],
  );

  const dismiss = () => {
    setOpen(false);
    setDismissals((count) => count + 1);
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      setOpen(true);
    }, RETURN_MS);
  };

  return (
    <div style={{ width: "100%", maxWidth: 700, margin: "0 auto" }}>
      <div
        style={{
          overflow: "hidden",
          border: "1px solid var(--border, #e8e0d7)",
          borderRadius: "var(--radius-card, 16px)",
          background: "var(--panel, #fffdfb)",
          boxShadow: "var(--panel-shadow, 0 1px 0 #3d1f0a0a, 0 2px 1px -1px #3d1f0a0d)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            height: 42,
            padding: "0 clamp(11px, 3.2vw, 16px)",
            borderBottom: "1px solid var(--border-soft, #1a14101a)",
          }}
        >
          <span
            style={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: "var(--text, #1a1410)",
            }}
          >
            Northwind workspace
          </span>
          <span style={{ flex: "none", fontSize: 11, color: "var(--text-subtle, #1a141099)" }}>
            v2.4
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 8,
            padding: "13px clamp(11px, 3.2vw, 16px)",
            /* The theme's muted ground: a 4% warm tint over the panel in light, 5% light in dark.
             * A band, not a cut to --bg, which in dark is the page colour outside the card. */
            background: "var(--muted-bg, #7a4a1c0a)",
            borderBottom: "1px solid var(--border-soft, #1a14101a)",
          }}
        >
          <AnnouncementPill href="#/announcement-pill">
            Tool calls stream live into the run view
          </AnnouncementPill>

          {open ? (
            <AnnouncementPill label="Nota" onDismiss={dismiss}>
              Billing moves on 1 November
            </AnnouncementPill>
          ) : (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: 29,
                paddingBlock: 4,
                fontSize: 12,
                lineHeight: 1.45,
                color: "var(--text-muted, #6f625a)",
              }}
            >
              Dismissed. It returns in two seconds so the demo can be run again.
            </span>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gap: 4,
            padding: "15px clamp(11px, 3.2vw, 16px) 17px",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text, #1a1410)" }}>
            Run view
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted, #6f625a)" }}>
            Three runs finished in the last hour.
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted, #6f625a)" }}>
            Next run starts in 12 minutes.
          </span>
        </div>
      </div>

      <p
        style={{
          margin: "12px 0 0",
          textAlign: "center",
          fontSize: 12,
          color: "var(--text-muted, #6f625a)",
        }}
      >
        {dismissals === 0
          ? "The second pill is dismissible. The first one is a link."
          : `${dismissals} dismissal${dismissals === 1 ? "" : "s"} reported through onDismiss.`}
      </p>
    </div>
  );
}
