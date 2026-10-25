import { useState, type CSSProperties } from "react";
import { SiteHeader, type HeaderNavGroup, type HeaderNavItem } from "../site-header";

/*
 * A marketing page as a visitor first meets it: four plain links with one Solutions group between
 * the leading Product link and the rest, a quiet login, a gradient trial CTA. The frame below is a
 * real scroll container, so dragging it is what earns the bar its ground.
 */

const LINKS: HeaderNavItem[] = [
  { label: "Product", href: "#product" },
  { label: "Case studies", href: "#cases" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

const GROUPS: HeaderNavGroup[] = [
  {
    label: "Solutions",
    items: [
      { label: "AI Sales Agent", href: "#sales" },
      { label: "Rigo Build", href: "#build" },
    ],
  },
];

const eyebrow: CSSProperties = {
  margin: "0 0 6px",
  color: "var(--text-muted, #6f625a)",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};

const heading: CSSProperties = {
  margin: 0,
  color: "var(--text, #1a1410)",
  fontSize: 26,
  fontWeight: 600,
  lineHeight: 1.15,
  letterSpacing: "-0.03em",
};

const copy: CSSProperties = {
  margin: "10px 0 0",
  maxWidth: 560,
  color: "var(--text-muted, #6f625a)",
  fontSize: 14,
  lineHeight: 1.65,
};

const card: CSSProperties = {
  padding: "14px 16px",
  borderRadius: 12,
  background: "var(--card, #ffffff)",
  boxShadow: "inset 0 0 0 1px var(--border, #e8e0d7)",
};

const cardTitle: CSSProperties = {
  margin: 0,
  color: "var(--text, #1a1410)",
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: "-0.01em",
};

const cardCopy: CSSProperties = {
  margin: "6px 0 0",
  color: "var(--text-muted, #6f625a)",
  fontSize: 12.5,
  lineHeight: 1.6,
};

function Brand() {
  return (
    <a href="#top" style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <span
        aria-hidden="true"
        style={{
          display: "grid",
          flex: "none",
          placeItems: "center",
          width: 28,
          height: 28,
          borderRadius: 9,
          backgroundImage:
            "linear-gradient(160deg, var(--accent, #c2410c), var(--accent-hover, #9a3412))",
          color: "var(--accent-fg, #fffdfb)",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          boxShadow: "inset 0 1px 0 #ffffff33",
        }}
      >
        R
      </span>
      <span
        style={{
          overflow: "hidden",
          color: "var(--text, #1a1410)",
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
      >
        Rigo
      </span>
    </a>
  );
}

export default function Demo() {
  const [last, setLast] = useState("nothing yet");

  return (
    <div style={{ width: "100%", maxWidth: 1040, margin: "0 auto" }}>
      <div
        style={{
          position: "relative",
          height: 560,
          overflow: "hidden",
          borderRadius: 16,
          background: "var(--bg, #faf7f4)",
          /* A page, not a panel: the slab and its ground carry the edge, so only a hairline stroke
           * is left rather than a full bordered box */
          boxShadow: "inset 0 0 0 1px var(--card-stroke, #1a14100e)",
          /* Contains the fixed backdrop to this frame, the way a host page would contain it to
           * the viewport, so the preview dims itself and not the gallery. */
          transform: "translateZ(0)",
        }}
      >
        <div id="top" style={{ height: "100%", overflowY: "auto", overscrollBehavior: "contain" }}>
          <SiteHeader
            brand={<Brand />}
            links={LINKS}
            groups={GROUPS}
            login={{ label: "Login", href: "#login" }}
            cta={{ label: "Start free", href: "#start" }}
            onNavigate={(item) => setLast(item.label)}
          />

          <main
            style={{
              display: "grid",
              gap: 30,
              width: "100%",
              /* The bar's own inset: the page's left edge lines up with the brand and its right
               * edge with the CTA, instead of the content sitting on a second grid */
              padding: "36px clamp(16px, 3vw, 24px) 64px",
            }}
          >
            <section id="product">
              <p style={eyebrow}>WhatsApp customer service</p>
              <h2 style={heading}>Every thread answered before the second ring</h2>
              <p style={copy}>
                Rigo reads the live catalogue, quotes stock and delivery, and hands the thread to a
                person with the whole conversation attached when the question leaves the script.
              </p>
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  /* 210px is the comfortable two-up width; below that the track shrinks to the
                   * frame instead of pushing a 210px min through the edge */
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(210px, 100%), 1fr))",
                  marginTop: 18,
                }}
              >
                <article id="sales" style={card}>
                  <h3 style={cardTitle}>AI Sales Agent</h3>
                  <p style={cardCopy}>
                    Answers price, stock and shipping from the catalogue you already keep.
                  </p>
                </article>
                <article id="build" style={card}>
                  <h3 style={cardTitle}>Rigo Build</h3>
                  <p style={cardCopy}>
                    Turns a product sheet into an agent that speaks in your brand's voice.
                  </p>
                </article>
              </div>
            </section>

            <section id="cases">
              <p style={eyebrow}>Case studies</p>
              <h2 style={heading}>Nine hundred threads a day, two people on shift</h2>
              <p style={copy}>
                A parts distributor in Surabaya moved 82 percent of first replies to the agent and
                cut the average answer from four minutes to eleven seconds.
              </p>
            </section>

            <section id="pricing">
              <p style={eyebrow}>Pricing</p>
              <h2 style={heading}>Plans that follow volume, not seats</h2>
              <p style={copy}>
                One rate per answered conversation, with the catalogue sync, the handoff and the
                transcript history included on every plan.
              </p>
            </section>

            <section id="faq">
              <p style={eyebrow}>FAQ</p>
              <h2 style={heading}>Questions before you start</h2>
              <p style={copy}>
                What happens when the agent cannot answer, how the number is verified, and what the
                first week of setup actually looks like.
              </p>
            </section>

            <section id="start">
              <p style={eyebrow}>Start free</p>
              <h2 style={heading}>Connect one number and watch the first week</h2>
              <p style={copy}>
                Fourteen days on your own catalogue, no card, and a written summary of what the
                agent answered and what it escalated.
              </p>
              <p style={{ ...copy, marginTop: 14 }}>
                <a
                  href="#login"
                  style={{
                    color: "var(--text, #1a1410)",
                    fontWeight: 500,
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                    textDecorationColor: "var(--text-subtle, #1a14108c)",
                  }}
                >
                  Already a customer? Login
                </a>
              </p>
            </section>
          </main>
        </div>
      </div>

      <p style={{ margin: "12px 2px 0", color: "var(--text-muted, #6f625a)", fontSize: 12 }}>
        Last activated:{" "}
        <strong style={{ color: "var(--text, #1a1410)", fontWeight: 600 }}>{last}</strong>
        {" · "}scroll the frame, then open Solutions or the menu
      </p>
    </div>
  );
}
